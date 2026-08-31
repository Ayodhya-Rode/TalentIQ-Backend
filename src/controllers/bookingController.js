import prisma from "../config/db.js";
import razorpay from "../config/razorpay.js";
import crypto from "crypto";
import config from "../config/config.js";
import { RoomServiceClient, AccessToken } from "livekit-server-sdk";

const LOOKAHEAD_DAYS = 14;
const dayNameToIndex = {
  SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3,
  THURSDAY: 4, FRIDAY: 5, SATURDAY: 6,
};
const indexToDayName = ["SUNDAY","MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY"];

/**
 * Get available interview time slots for a given org + domain, over the next 14 days.
 * Converts each matching emp's recurring weekly availability into actual calendar dates,
 * merges them, and excludes any time where every matching emp is already booked.
 * Never reveals which emp owns which slot.
 * @route GET /api/bookings/available-slots?organizationId=X&domain=Y
 * @access CANDIDATE
 */
export const getAvailableSlots = async (req, res) => {
  try {
    const { organizationId, domain } = req.query;

    if (!organizationId || !domain) {
      return res.status(400).json({ success: false, message: "organizationId and domain are required" });
    }

    // 1. find all active emps in this org covering this domain
    const emps = await prisma.user.findMany({
      where: {
        memberOrgId: Number(organizationId),
        role: { in: ["RECRUITER", "INTERVIEWER"] },
        isActive: true,
        domains: { has: domain },
      },
      include: { availabilitySlots: true },
    });

    if (emps.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }

    // 2. expand each emp's recurring weekly slots into actual dates within the lookahead window
    const now = new Date();
    const candidateTimes = new Map(); // key: ISO datetime -> { date, empIds: Set }

    for (const emp of emps) {
      for (const slot of emp.availabilitySlots) {
        const targetDayIndex = dayNameToIndex[slot.dayOfWeek];

        for (let offset = 0; offset < LOOKAHEAD_DAYS; offset++) {
          const candidateDate = new Date(now);
          candidateDate.setDate(now.getDate() + offset);

          if (candidateDate.getDay() !== targetDayIndex) continue;

          const [hours, minutes] = slot.startTime.split(":").map(Number);
          candidateDate.setHours(hours, minutes, 0, 0);

          if (candidateDate <= now) continue; // skip times already in the past

          const key = candidateDate.toISOString();
          if (!candidateTimes.has(key)) {
            candidateTimes.set(key, { date: candidateDate, empIds: new Set() });
          }
          candidateTimes.get(key).empIds.add(emp.id);
        }
      }
    }

    // 3. exclude times where every matching emp for that slot is already booked
    const allDates = Array.from(candidateTimes.values()).map((v) => v.date);
    const existingBookings = await prisma.interviewBooking.findMany({
      where: {
        scheduledDate: { in: allDates },
        status: { not: "CANCELLED" },
        assignedEmpId: { not: null },
      },
      select: { scheduledDate: true, assignedEmpId: true },
    });

    const bookedPairs = new Set(
      existingBookings.map((b) => `${b.scheduledDate.toISOString()}_${b.assignedEmpId}`)
    );

    const availableSlots = [];
    for (const [key, { date, empIds }] of candidateTimes.entries()) {
      const freeEmpExists = Array.from(empIds).some(
        (empId) => !bookedPairs.has(`${key}_${empId}`)
      );
      if (freeEmpExists) {
        availableSlots.push(date);
      }
    }

    availableSlots.sort((a, b) => a - b);

    res.status(200).json({ success: true, data: availableSlots });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch available slots", error: error.message });
  }
};

/**
 * Create an interview booking for the given org + domain + exact date/time,
 * and immediately auto-assign a genuinely available matching emp.
 * Uses the DB unique constraint (assignedEmpId + scheduledDate) as the real
 * race-condition safety net — if two candidates try the same emp+time at once,
 * only one create() succeeds; the loser retries the next eligible emp.
 * Booking status starts ASSIGNED but payment is handled separately (Step 3) —
 * emp is locked in immediately to prevent the slot being taken during payment.
 * @route POST /api/bookings
 * @access CANDIDATE
 */
export const createBooking = async (req, res) => {
  try {
    const { organizationId, domain, scheduledDate } = req.body;

    if (!organizationId || !domain || !scheduledDate) {
      return res.status(400).json({ success: false, message: "organizationId, domain and scheduledDate are required" });
    }

    const date = new Date(scheduledDate);
    if (isNaN(date.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid date" });
    }
    if (date <= new Date()) {
      return res.status(400).json({ success: false, message: "Cannot book a past time" });
    }

    // find emps in this org covering this domain
    const emps = await prisma.user.findMany({
      where: {
        memberOrgId: Number(organizationId),
        role: { in: ["RECRUITER", "INTERVIEWER"] },
        isActive: true,
        domains: { has: domain },
      },
      include: { availabilitySlots: true },
    });

    const dayName = indexToDayName[date.getDay()];
    const timeStr = `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

    // only emps whose recurring availability actually covers this exact day+time
    const eligibleEmpIds = emps
      .filter((e) =>
        e.availabilitySlots.some(
          (s) => s.dayOfWeek === dayName && s.startTime <= timeStr && timeStr < s.endTime
        )
      )
      .map((e) => e.id);

    if (eligibleEmpIds.length === 0) {
      return res.status(400).json({ success: false, message: "No emp available for this domain at that time" });
    }

    // try each eligible emp in turn; unique constraint protects against double-booking
    for (const empId of eligibleEmpIds) {
      try {
        const booking = await prisma.interviewBooking.create({
          data: {
            domain,
            scheduledDate: date,
            candidateId: req.user.id,
            organizationId: Number(organizationId),
            assignedEmpId: empId,
            status: "PENDING_PAYMENT",
          },
        });
        return res.status(201).json({ success: true, message: "Booking created", data: booking });
      } catch (err) {
        if (err.code === "P2002") continue; // that emp was just taken by someone else — try next
        throw err;
      }
    }

    // every eligible emp got taken between our check and our insert attempts
    return res.status(409).json({ success: false, message: "This slot was just taken. Please pick another time." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to create booking", error: error.message });
  }
};

/**
 * Emp marks themselves unavailable for a specific assigned booking.
 * Tries to reassign to another eligible emp in the same slot; if none found,
 * flips booking to NEEDS_ATTENTION and increments reassignCount.
 * If reassignCount reaches 2+ across attempts, this booking needs Org Admin attention.
 * @route PATCH /api/bookings/:id/emp-cancel
 * @access RECRUITER, INTERVIEWER
 */
export const empCancelBooking = async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await prisma.interviewBooking.findUnique({ where: { id: Number(id) } });
    if (!booking || booking.assignedEmpId !== req.user.id) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }
    if (booking.status !== "ASSIGNED") {
      return res.status(400).json({ success: false, message: "This booking can't be cancelled now" });
    }

    const hoursUntil = (booking.scheduledDate - new Date()) / (1000 * 60 * 60);
    if (hoursUntil < 1) {
      return res.status(400).json({ success: false, message: "Too close to the interview time to cancel" });
    }

    // log this cancellation for monthly tracking
    await prisma.bookingCancellation.create({
      data: { bookingId: booking.id, empId: req.user.id },
    });

    // find another eligible emp for the same domain/org/exact time, excluding this emp
    const emps = await prisma.user.findMany({
      where: {
        memberOrgId: booking.organizationId,
        role: { in: ["RECRUITER", "INTERVIEWER"] },
        isActive: true,
        domains: { has: booking.domain },
        id: { not: req.user.id },
      },
      include: { availabilitySlots: true },
    });

    const dayName = ["SUNDAY","MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY"][booking.scheduledDate.getDay()];
    const timeStr = `${String(booking.scheduledDate.getHours()).padStart(2,"0")}:${String(booking.scheduledDate.getMinutes()).padStart(2,"0")}`;

    const eligibleEmpIds = emps
      .filter((e) => e.availabilitySlots.some((s) => s.dayOfWeek === dayName && s.startTime <= timeStr && timeStr < s.endTime))
      .map((e) => e.id);

    for (const empId of eligibleEmpIds) {
      try {
        const updated = await prisma.interviewBooking.update({
          where: { id: booking.id },
          data: { assignedEmpId: empId },
        });
        return res.status(200).json({ success: true, message: "Reassigned to another emp", data: updated });
      } catch (err) {
        if (err.code === "P2002") continue;
        throw err;
      }
    }

    // no replacement found — escalate
    const updated = await prisma.interviewBooking.update({
      where: { id: booking.id },
      data: { status: "NEEDS_ATTENTION", reassignCount: { increment: 1 }, assignedEmpId: null },
    });
    res.status(200).json({ success: true, message: "No replacement found — flagged for admin", data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to cancel booking", error: error.message });
  }
};

/**
 * Candidate reschedules a NEEDS_ATTENTION booking to a new date/time they pick themselves.
 * Re-runs the same eligible-emp-assignment logic as creating a fresh booking.
 * @route PATCH /api/bookings/:id/reschedule
 * @access CANDIDATE
 */
export const rescheduleBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const { scheduledDate } = req.body;

    const booking = await prisma.interviewBooking.findUnique({ where: { id: Number(id) } });
    if (!booking || booking.candidateId !== req.user.id) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }
    if (booking.status !== "NEEDS_ATTENTION") {
      return res.status(400).json({ success: false, message: "This booking doesn't need rescheduling" });
    }

    const date = new Date(scheduledDate);
    if (isNaN(date.getTime()) || date <= new Date()) {
      return res.status(400).json({ success: false, message: "Invalid or past date" });
    }

    const emps = await prisma.user.findMany({
      where: {
        memberOrgId: booking.organizationId,
        role: { in: ["RECRUITER", "INTERVIEWER"] },
        isActive: true,
        domains: { has: booking.domain },
      },
      include: { availabilitySlots: true },
    });

    const dayName = ["SUNDAY","MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY"][date.getDay()];
    const timeStr = `${String(date.getHours()).padStart(2,"0")}:${String(date.getMinutes()).padStart(2,"0")}`;

    const eligibleEmpIds = emps
      .filter((e) => e.availabilitySlots.some((s) => s.dayOfWeek === dayName && s.startTime <= timeStr && timeStr < s.endTime))
      .map((e) => e.id);

    if (eligibleEmpIds.length === 0) {
      return res.status(400).json({ success: false, message: "No emp available at that time either" });
    }

    for (const empId of eligibleEmpIds) {
      try {
        const updated = await prisma.interviewBooking.update({
          where: { id: booking.id },
          data: { scheduledDate: date, assignedEmpId: empId, status: "ASSIGNED" },
        });
        return res.status(200).json({ success: true, message: "Rescheduled", data: updated });
      } catch (err) {
        if (err.code === "P2002") continue;
        throw err;
      }
    }

    return res.status(409).json({ success: false, message: "That slot was just taken. Try another time." });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to reschedule", error: error.message });
  }
};

/**
 * Org Admin views all bookings needing attention in their org.
 * @route GET /api/bookings/needs-attention
 * @access ORG_ADMIN
 */
export const getBookingsNeedingAttention = async (req, res) => {
  try {
    const org = await prisma.organization.findUnique({ where: { adminId: req.user.id } });
    if (!org) {
      return res.status(404).json({ success: false, message: "No organization found for this admin" });
    }

    const bookings = await prisma.interviewBooking.findMany({
      where: { organizationId: org.id, status: "NEEDS_ATTENTION" },
      include: { candidate: { select: { email: true } } },
      orderBy: { scheduledDate: "asc" },
    });

    res.status(200).json({ success: true, data: bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch bookings", error: error.message });
  }
};

/**
 * Org Admin views emps whose last-minute cancellations this month exceed the threshold (3).
 * @route GET /api/bookings/flagged-emps
 * @access ORG_ADMIN
 */
export const getFlaggedEmps = async (req, res) => {
  try {
    const org = await prisma.organization.findUnique({ where: { adminId: req.user.id } });
    if (!org) {
      return res.status(404).json({ success: false, message: "No organization found for this admin" });
    }

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const cancellations = await prisma.bookingCancellation.findMany({
      where: {
        createdAt: { gte: startOfMonth },
        emp: { memberOrgId: org.id },
      },
      include: { emp: { select: { id: true, email: true } } },
    });

    const counts = {};
    for (const c of cancellations) {
      const key = c.emp.id;
      if (!counts[key]) counts[key] = { emp: c.emp, count: 0 };
      counts[key].count++;
    }

    const flagged = Object.values(counts).filter((c) => c.count > 3);

    res.status(200).json({ success: true, data: flagged });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch flagged emps", error: error.message });
  }
};

export const getMyAssignedBookings = async (req, res) => {
  try {
    const bookings = await prisma.interviewBooking.findMany({
      where: { assignedEmpId: req.user.id, status: "ASSIGNED" },
      orderBy: { scheduledDate: "asc" },
    });
    res.status(200).json({ success: true, data: bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch bookings", error: error.message });
  }
};

export const getMyBookings = async (req, res) => {
  try {
    const bookings = await prisma.interviewBooking.findMany({
      where: { candidateId: req.user.id },
      include: { organization: { select: { name: true } } },
      orderBy: { scheduledDate: "desc" },
    });
    res.status(200).json({ success: true, data: bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch bookings", error: error.message });
  }
};


const INTERVIEW_PRICE_PAISE = 5000; // ₹50

/**
 * Candidate creates a Razorpay payment order for a booking that is pending payment.
 * @route POST /api/bookings/payment-order
 * @access CANDIDATE
 */
export const createPaymentOrder = async (req, res) => {
  try {
    const { bookingId } = req.body;

    const booking = await prisma.interviewBooking.findUnique({ where: { id: Number(bookingId) } });
    if (!booking || booking.candidateId !== req.user.id) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }
    if (booking.status !== "PENDING_PAYMENT") {
      return res.status(400).json({ success: false, message: "This booking doesn't need payment" });
    }

    const order = await razorpay.orders.create({
      amount: INTERVIEW_PRICE_PAISE,
      currency: "INR",
      receipt: `booking_${booking.id}`,
    });

    res.status(200).json({ success: true, data: { orderId: order.id, amount: order.amount, keyId: config.razorpayKeyId } });
  } catch (error) {
    console.error("Razorpay order creation error:", error);
    res.status(500).json({ success: false, message: "Failed to create payment order", error: error.message });
  }
};

/**
 * Candidate verifies the Razorpay payment for a booking.
 * @route POST /api/bookings/verify-payment
 * @access CANDIDATE
 */

const roomService = new RoomServiceClient(config.livekitUrl, config.livekitApiKey, config.livekitApiSecret);

export const verifyPayment = async (req, res) => {
  try {
    const { bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", config.razorpayKeySecret)
      .update(body)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: "Payment verification failed" });
    }

    const roomName = `booking-${bookingId}`;
    await roomService.createRoom({ name: roomName });

    const booking = await prisma.interviewBooking.update({
      where: { id: Number(bookingId) },
      data: { status: "ASSIGNED", videoRoomUrl: roomName },
    });

    res.status(200).json({ success: true, message: "Payment verified", data: booking });
  } catch (error) {
    console.log("verify payment :", error);
    res.status(500).json({ success: false, message: "Failed to verify payment", error: error.message });
  }
};


export const getVideoToken = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await prisma.interviewBooking.findUnique({ where: { id: Number(bookingId) } });
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }
    if (booking.candidateId !== req.user.id && booking.assignedEmpId !== req.user.id) {
      return res.status(403).json({ success: false, message: "Not part of this interview" });
    }

    const at = new AccessToken(config.livekitApiKey, config.livekitApiSecret, {
      identity: `user-${req.user.id}`,
    });
    at.addGrant({ room: booking.videoRoomUrl, roomJoin: true, canPublish: true, canSubscribe: true });

    const token = await at.toJwt();

    res.status(200).json({ success: true, data: { token, wsUrl: config.livekitUrl, roomName: booking.videoRoomUrl } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to generate token", error: error.message });
  }
};


export const cancelPendingBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await prisma.interviewBooking.findUnique({ where: { id: Number(id) } });
    if (!booking || booking.candidateId !== req.user.id) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }
    if (booking.status !== "PENDING_PAYMENT") {
      return res.status(400).json({ success: false, message: "Cannot cancel this booking" });
    }
    await prisma.interviewBooking.update({
      where: { id: booking.id },
      data: { status: "CANCELLED", assignedEmpId: null },
    });
    res.status(200).json({ success: true, message: "Booking cancelled" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to cancel", error: error.message });
  }
};