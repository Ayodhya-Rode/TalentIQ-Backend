import prisma from "../config/db.js";

/**
 * Candidate applies to a Job. Uses existing profile — only cover note is new input.
 * @route POST /api/applications/apply/:jobId
 * @access CANDIDATE
 */
export const applyToJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { coverNote } = req.body;

    const job = await prisma.job.findUnique({ where: { id: Number(jobId) } });
    if (!job) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }
    if (job.status !== "APPROVED") {
      return res.status(400).json({ success: false, message: "This job is not accepting applications" });
    }

    const existing = await prisma.application.findUnique({
      where: { candidateId_jobId: { candidateId: req.user.id, jobId: job.id } },
    });
    if (existing) {
      return res.status(409).json({ success: false, message: "You've already applied to this job" });
    }

    const application = await prisma.application.create({
      data: { candidateId: req.user.id, jobId: job.id, coverNote: coverNote || null },
    });

    res.status(201).json({ success: true, message: "Application submitted", data: application });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to apply", error: error.message });
  }
};

/**
 * Candidate views their own applications.
 * @route GET /api/applications/my-applications
 * @access CANDIDATE
 */
export const getMyApplications = async (req, res) => {
  try {
    const applications = await prisma.application.findMany({
      where: { candidateId: req.user.id },
      include: { job: { select: { title: true, organization: { select: { name: true, logo: true } } } } },
      orderBy: { createdAt: "desc" },
    });
    res.status(200).json({ success: true, data: applications });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch applications", error: error.message });
  }
};

/**
 * Recruiter views applications for one of their own jobs.
 * @route GET /api/applications/job/:jobId
 * @access RECRUITER (own jobs only)
 */
export const getApplicationsForJob = async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await prisma.job.findUnique({ where: { id: Number(jobId) } });
    if (!job || job.recruiterId !== req.user.id) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    const applications = await prisma.application.findMany({
      where: { jobId: job.id },
      include: {
        candidate: {
          select: {
            email: true,
            candidateProfile: { select: { fullName: true, skills: true, resumeUrl: true, phone: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    res.status(200).json({ success: true, data: applications });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch applications", error: error.message });
  }
};

/**
 * Recruiter updates an application's status. Enforces strict flow:
 * APPLIED -> UNDER_REVIEW -> SHORTLISTED or REJECTED (no skipping).
 * @route PATCH /api/applications/:id/status
 * @access RECRUITER (own jobs only)
 */
export const updateApplicationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ["UNDER_REVIEW", "SHORTLISTED", "REJECTED"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const application = await prisma.application.findUnique({
      where: { id: Number(id) },
      include: { job: true },
    });
    if (!application || application.job.recruiterId !== req.user.id) {
      return res.status(404).json({ success: false, message: "Application not found" });
    }

    // enforce strict flow — no skipping 
    const allowedTransitions = {
      APPLIED: ["UNDER_REVIEW"],
      UNDER_REVIEW: ["SHORTLISTED", "REJECTED"],
      SHORTLISTED: [],
      REJECTED: [],
    };

    if (!allowedTransitions[application.status].includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot move from ${application.status} to ${status}`,
      });
    }

    const updated = await prisma.application.update({
      where: { id: application.id },
      data: { status },
    });

    res.status(200).json({ success: true, message: "Application status updated", data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update status", error: error.message });
  }
};

/**
 * Org Admin views all applications across their org, read-only.
 * @route GET /api/applications/org-all
 * @access ORG_ADMIN
 */
export const getAllApplicationsForOrg = async (req, res) => {
  try {
    const org = await prisma.organization.findUnique({ where: { adminId: req.user.id } });
    if (!org) {
      return res.status(404).json({ success: false, message: "No organization found for this admin" });
    }

    const applications = await prisma.application.findMany({
      where: { job: { organizationId: org.id } },
      include: {
        job: { select: { title: true, recruiter: { select: { email: true } } } },
        candidate: { select: { email: true, candidateProfile: { select: { fullName: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({ success: true, data: applications });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch applications", error: error.message });
  }
};