import prisma from "../config/db.js";

export const submitFeedback = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { score, feedback } = req.body;

    if (score === undefined || !feedback) {
      return res.status(400).json({ success: false, message: "Score and feedback are required" });
    }

    if (score < 1 || score > 10) {
      return res.status(400).json({ success: false, message: "Score must be between 1 and 10" });
    }

    const booking = await prisma.interviewBooking.findUnique({ where: { id: Number(bookingId) } });
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    if (booking.assignedEmpId !== req.user.id) {
      return res.status(403).json({ success: false, message: "Only the assigned interviewer can submit feedback" });
    }

    const existing = await prisma.interviewFeedback.findUnique({ where: { bookingId: Number(bookingId) } });
    if (existing) {
      return res.status(409).json({ success: false, message: "Feedback already submitted for this booking" });
    }

    const created = await prisma.interviewFeedback.create({
      data: {
        bookingId: Number(bookingId),
        empId: req.user.id,
        score,
        feedback,
      },
    });

    await prisma.interviewBooking.update({
      where: { id: Number(bookingId) },
      data: { status: "COMPLETED" },
    });

    res.status(201).json({ success: true, data: created });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to submit feedback", error: error.message });
  }
};

export const getFeedback = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const booking = await prisma.interviewBooking.findUnique({ where: { id: Number(bookingId) } });
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    // adjust roles allowed to view: candidate, assigned emp, org admin — your call
    if (
      booking.candidateId !== req.user.id &&
      booking.assignedEmpId !== req.user.id
    ) {
      return res.status(403).json({ success: false, message: "Not authorized to view this feedback" });
    }

    const feedback = await prisma.interviewFeedback.findUnique({ where: { bookingId: Number(bookingId) } });
    if (!feedback) {
      return res.status(404).json({ success: false, message: "Feedback not yet submitted" });
    }

    res.status(200).json({ success: true, data: feedback });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch feedback", error: error.message });
  }
};