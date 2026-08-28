import prisma from "../config/db.js";

/**
 * Create a new Job posting. Goes to PENDING_APPROVAL — not visible to candidates until Org Admin approves.
 * @route POST /api/jobs
 * @access RECRUITER
 */
export const createJob = async (req, res) => {
  try {
    const {
      title,
      description,
      department,
      employmentType,
      location,
      isRemote,
    } = req.body;

    if (!title || !description || !employmentType) {
      return res
        .status(400)
        .json({
          success: false,
          message: "Title, description and employment type are required",
        });
    }

    const validTypes = ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP"];
    if (!validTypes.includes(employmentType)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid employment type" });
    }

    // org derived from logged-in recruiter's own membership — never from request body
    const recruiter = await prisma.user.findUnique({
      where: { id: req.user.id },
    });
    if (!recruiter.memberOrgId) {
      return res
        .status(404)
        .json({ success: false, message: "No organization membership found" });
    }

    const job = await prisma.job.create({
      data: {
        title,
        description,
        department,
        employmentType,
        location,
        isRemote: !!isRemote,
        recruiterId: req.user.id,
        organizationId: recruiter.memberOrgId,
      },
    });

    res
      .status(201)
      .json({
        success: true,
        message: "Job submitted for approval",
        data: job,
      });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to create job",
        error: error.message,
      });
  }
};

/**
 * Get all jobs created by the logged-in Recruiter.
 * @route GET /api/jobs/my-jobs
 * @access RECRUITER
 */
export const getMyJobs = async (req, res) => {
  try {
    const jobs = await prisma.job.findMany({
      where: { recruiterId: req.user.id },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({ success: true, data: jobs });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch jobs",
        error: error.message,
      });
  }
};

/**
 * Get all jobs pending approval for the logged-in Org Admin's organization.
 * @route GET /api/jobs/pending-approval
 * @access ORG_ADMIN
 */
export const getPendingJobsForOrg = async (req, res) => {
  try {
    const org = await prisma.organization.findUnique({
      where: { adminId: req.user.id },
    });
    if (!org) {
      return res
        .status(404)
        .json({
          success: false,
          message: "No organization found for this admin",
        });
    }

    const jobs = await prisma.job.findMany({
      where: { organizationId: org.id, status: "PENDING_APPROVAL" },
      include: { recruiter: { select: { email: true } } },
      orderBy: { createdAt: "asc" }, // oldest pending first — first in, first reviewed
    });

    res.status(200).json({ success: true, data: jobs });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch pending jobs",
        error: error.message,
      });
  }
};

/**
 * Approve a pending Job — makes it live.
 * @route PATCH /api/jobs/:id/approve-job
 * @access ORG_ADMIN
 */
export const approveJob = async (req, res) => {
  try {
    const { id } = req.params;

    const org = await prisma.organization.findUnique({
      where: { adminId: req.user.id },
    });
    if (!org) {
      return res
        .status(404)
        .json({
          success: false,
          message: "No organization found for this admin",
        });
    }

    const job = await prisma.job.findUnique({ where: { id: Number(id) } });
    if (!job || job.organizationId !== org.id) {
      return res
        .status(404)
        .json({
          success: false,
          message: "Job not found in your organization",
        });
    }

    if (job.status !== "PENDING_APPROVAL") {
      return res
        .status(400)
        .json({
          success: false,
          message: "Only jobs pending approval can be approved",
        });
    }

    const updated = await prisma.job.update({
      where: { id: job.id },
      data: {
        status: "APPROVED",
        previousSnapshot: null,
        rejectionReason: null,
      },
    });

    res
      .status(200)
      .json({ success: true, message: "Job approved", data: updated });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to approve job",
        error: error.message,
      });
  }
};

/**
 * Reject a pending Job — Recruiter can edit and resubmit.
 * @route PATCH /api/jobs/:id/reject-job
 * @access ORG_ADMIN
 */
export const rejectJob = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const org = await prisma.organization.findUnique({
      where: { adminId: req.user.id },
    });
    if (!org) {
      return res
        .status(404)
        .json({
          success: false,
          message: "No organization found for this admin",
        });
    }

    const job = await prisma.job.findUnique({ where: { id: Number(id) } });
    if (!job || job.organizationId !== org.id) {
      return res
        .status(404)
        .json({
          success: false,
          message: "Job not found in your organization",
        });
    }

    if (job.status !== "PENDING_APPROVAL") {
      return res
        .status(400)
        .json({
          success: false,
          message: "Only jobs pending approval can be rejected",
        });
    }

    const updated = await prisma.job.update({
      where: { id: job.id },
      data: { status: "REJECTED", rejectionReason: reason || null },
    });

    res
      .status(200)
      .json({ success: true, message: "Job rejected", data: updated });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to reject job",
        error: error.message,
      });
  }
};

/**
 * Update a Job. If the job is currently APPROVED (live), editing reverts it to
 * PENDING_APPROVAL and stores the pre-edit values in previousSnapshot for admin review.
 * If the job is PENDING_APPROVAL or REJECTED, it just updates normally (no snapshot needed).
 * @route PATCH /api/jobs/:id/update-job
 * @access RECRUITER (own jobs only)
 */
export const updateJob = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      department,
      employmentType,
      location,
      isRemote,
    } = req.body;

    const job = await prisma.job.findUnique({ where: { id: Number(id) } });
    if (!job || job.recruiterId !== req.user.id) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    if (job.status === "CLOSED") {
      return res
        .status(400)
        .json({ success: false, message: "Closed jobs cannot be edited" });
    }

    if (employmentType) {
      const validTypes = ["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP"];
      if (!validTypes.includes(employmentType)) {
        return res
          .status(400)
          .json({ success: false, message: "Invalid employment type" });
      }
    }

    const data = {};
    if (title) data.title = title;
    if (description) data.description = description;
    if (department !== undefined) data.department = department;
    if (employmentType) data.employmentType = employmentType;
    if (location !== undefined) data.location = location;
    if (isRemote !== undefined) data.isRemote = !!isRemote;

    const wasLive = job.status === "APPROVED";
    const wasRejected = job.status === "REJECTED";

    if (wasLive) {
      // snapshot the pre-edit values, revert to pending, clear old rejection reason
      data.previousSnapshot = {
        title: job.title,
        description: job.description,
        department: job.department,
        employmentType: job.employmentType,
        location: job.location,
        isRemote: job.isRemote,
      };
      data.status = "PENDING_APPROVAL";
      data.rejectionReason = null;
    } else if (wasRejected) {
      data.status = "PENDING_APPROVAL";
      data.rejectionReason = null;
      // no snapshot — it wasn't live, nothing to diff against
    }

    const updated = await prisma.job.update({ where: { id: job.id }, data });

    res.status(200).json({
      success: true,
      message: (wasLive || wasRejected)
        ? "Job updated — resubmitted for approval"
        : "Job updated",
      data: updated,
    });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to update job",
        error: error.message,
      });
  }
};


/**
 * Close a Job (soft delete) — visible only to the Recruiter in their own list, never to candidates.
 * @route PATCH /api/jobs/:id/close-job
 * @access RECRUITER (own jobs only)
 */
export const closeJob = async (req, res) => {
  try {
    const { id } = req.params;

    const job = await prisma.job.findUnique({ where: { id: Number(id) } });
    if (!job || job.recruiterId !== req.user.id) {
      return res.status(404).json({ success: false, message: "Job not found" });
    }

    if (job.status === "CLOSED") {
      return res.status(400).json({ success: false, message: "Job is already closed" });
    }

    const updated = await prisma.job.update({
      where: { id: job.id },
      data: { status: "CLOSED" },
    });

    res.status(200).json({ success: true, message: "Job closed", data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to close job", error: error.message });
  }
};


/**
 * Get all APPROVED jobs (public listing — for candidates).
 * @route GET /api/jobs/approved
 * @access Public
 */
export const getApprovedJobs = async (req, res) => {
  try {
    const jobs = await prisma.job.findMany({
      where: { status: "APPROVED" },
      include: {
        organization: { select: { name: true, logo: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({ success: true, data: jobs });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch jobs", error: error.message });
  }
};