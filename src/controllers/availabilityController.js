import prisma from "../config/db.js";

const validDomains = ["FULL_STACK", "DATA_SCIENCE", "DEVOPS", "JAVA_DEVELOPER", "AI_ENGINEER", "FRONTEND", "BACKEND"];
const validDays = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

/**
 * Set the logged-in emp's domains (specializations). Overwrites the full list each time.
 * @route PUT /api/availability/domains
 * @access RECRUITER, INTERVIEWER
 */
export const setMyDomains = async (req, res) => {
  try {
    const { domains } = req.body;

    if (!Array.isArray(domains) || domains.length === 0) {
      return res.status(400).json({ success: false, message: "At least one domain is required" });
    }

    const invalid = domains.filter((d) => !validDomains.includes(d));
    if (invalid.length > 0) {
      return res.status(400).json({ success: false, message: `Invalid domain(s): ${invalid.join(", ")}` });
    }

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { domains },
    });

    res.status(200).json({ success: true, message: "Domains updated", data: { domains: user.domains } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update domains", error: error.message });
  }
};

/**
 * Add one availability slot for the logged-in emp.
 * @route POST /api/availability/slots
 * @access RECRUITER, INTERVIEWER
 */
export const addAvailabilitySlot = async (req, res) => {
  try {
    const { dayOfWeek, startTime, endTime } = req.body;

    if (!dayOfWeek || !startTime || !endTime) {
      return res.status(400).json({ success: false, message: "Day, start time and end time are required" });
    }
    if (!validDays.includes(dayOfWeek)) {
      return res.status(400).json({ success: false, message: "Invalid day of week" });
    }

    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
      return res.status(400).json({ success: false, message: "Time must be in HH:MM 24-hour format" });
    }
    if (startTime >= endTime) {
      return res.status(400).json({ success: false, message: "Start time must be before end time" });
    }

    const slot = await prisma.availabilitySlot.create({
      data: { dayOfWeek, startTime, endTime, empId: req.user.id },
    });

    res.status(201).json({ success: true, message: "Availability slot added", data: slot });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to add slot", error: error.message });
  }
};

/**
 * Get the logged-in emp's own domains + availability slots.
 * @route GET /api/availability/mine
 * @access RECRUITER, INTERVIEWER
 */
export const getMyAvailability = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        domains: true,
        availabilitySlots: { orderBy: { dayOfWeek: "asc" } },
      },
    });

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch availability", error: error.message });
  }
};

/**
 * Delete one of the logged-in emp's own availability slots.
 * @route DELETE /api/availability/slots/:id
 * @access RECRUITER, INTERVIEWER
 */
export const deleteAvailabilitySlot = async (req, res) => {
  try {
    const { id } = req.params;

    const slot = await prisma.availabilitySlot.findUnique({ where: { id: Number(id) } });
    if (!slot || slot.empId !== req.user.id) {
      return res.status(404).json({ success: false, message: "Slot not found" });
    }

    await prisma.availabilitySlot.delete({ where: { id: slot.id } });

    res.status(200).json({ success: true, message: "Slot removed" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to remove slot", error: error.message });
  }
};