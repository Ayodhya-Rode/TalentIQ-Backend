import prisma from "../config/db.js";
import { uploadToCloudinary } from "../utils/uploadToCloudinary.js";
import jwt from "jsonwebtoken";
import config from "../config/config.js";
import { sendEmail } from "../utils/sendEmail.js";
import bcrypt from "bcryptjs";
import { uploadToImageKit } from "../utils/uploadToImageKit.js";

/**
 * Register a new organization. Only ORG_ADMIN can register an organization. The organization will be pending approval by SUPER_ADMIN.
 * @route POST /api/organizations/register
 * @access ORG_ADMIN
 */
export const registerOrganization = async (req, res) => {
  try {
    const { name, industry } = req.body;
    const userId = req.user.id;

    if (!name || !industry) {
      return res.status(400).json({ success: false, message: "Name and industry are required" });
    }

    const existing = await prisma.organization.findUnique({ where: { adminId: userId } });
    if (existing) {
      return res.status(409).json({ success: false, message: "You already registered an organization" });
    }

    let logoUrl = null;
    if (req.file) {
      const fileBuffer = req.file.buffer;
      logoUrl = await uploadToImageKit(fileBuffer, "talentiq/org_logos", req.file.originalname);
      // logoUrl = await uploadToCloudinary(fileBuffer, "talentiq/org_logos");
    } 

    const org = await prisma.organization.create({
      data: { name, industry, logo:logoUrl, adminId: userId },
    });

    res.status(201).json({ success: true, message: "Organization registered, pending approval", data: org });
  } catch (error) {
    res.status(500).json({ success: false, message: "Registration failed", error: error.message });
  }
};


/**
 * To fetch all organizations. Only SUPER_ADMIN can fetch all organizations.
 * @route GET /api/organizations/get-all-organizations
 * @access SUPER_ADMIN
 */
export const getAllOrganizations = async (req, res) => {
  try {
    const orgs = await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        industry: true,
        status: true,
        logo:true,
        createdAt: true,
        admin: { select: { email: true } },
      },
    });
    res.status(200).json({ success: true, data: orgs });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch organizations", error: error.message });
  }
};

/**
 * To approve an organization. Only SUPER_ADMIN can approve an organization.
 * @route PATCH /api/organizations/:id/approve
 * @access SUPER_ADMIN
 */
export const approveOrganization = async (req, res) => {
  try {
    const org = await prisma.organization.update({
      where: { id: Number(req.params.id) },
      data: { status: "APPROVED" },
    });
    res.status(200).json({ success: true, message: "Organization approved", data: org });
  } catch (error) {
    res.status(500).json({ success: false, message: "Approval failed", error: error.message });
  }
};

/**
 * To reject an organization. Only SUPER_ADMIN can reject an organization.
 * @route PATCH /api/organizations/:id/reject
 * @access SUPER_ADMIN
 */
export const rejectOrganization = async (req, res) => {
  try {
    const org = await prisma.organization.update({
      where: { id: Number(req.params.id) },
      data: { status: "REJECTED" },
    });
    res.status(200).json({ success: true, message: "Organization rejected", data: org });
  } catch (error) {
    res.status(500).json({ success: false, message: "Rejection failed", error: error.message });
  }
};

/**
 * To suspend an organization. Only SUPER_ADMIN can suspend an organization.
 * @route PATCH /api/organizations/:id/suspend
 * @access SUPER_ADMIN
 */
export const suspendOrganization = async (req, res) => {
  try {
    const org = await prisma.organization.update({
      where: { id: Number(req.params.id) },
      data: { status: "SUSPENDED" },
    });
    res.status(200).json({ success: true, message: "Organization suspended", data: org });
  } catch (error) {
    res.status(500).json({ success: false, message: "Suspension failed", error: error.message });
  }
};

/**
 * To activate an organization. Only SUPER_ADMIN can activate an organization.
 * @route PATCH /api/organizations/:id/activate
 * @access SUPER_ADMIN
 */
export const activateOrganization = async (req, res) => {
  try {
    const org = await prisma.organization.update({
      where: { id: Number(req.params.id) },
      data: { status: "APPROVED" },
    });
    res.status(200).json({ success: true, message: "Organization activated", data: org });
  } catch (error) {
    res.status(500).json({ success: false, message: "Activation failed", error: error.message });
  }
};


/**
 * Get a single organization by ID. Only SUPER_ADMIN can fetch a single organization.
 * @route GET /api/organizations/:id
 * @access SUPER_ADMIN
 */
export const getOrganizationById = async (req, res) => {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: Number(req.params.id) },
      select: {
        id: true,
        name: true,
        industry: true,
        status: true,
        logo: true,
        createdAt: true,
        admin: { select: { email: true } },
      },
    });

    if (!org) {
      return res.status(404).json({ success: false, message: "Organization not found" });
    }

    res.status(200).json({ success: true, data: org });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch organization", error: error.message });
  }
};

/**
 * Get the organization belonging to the logged-in ORG_ADMIN.
 * @route GET /api/organizations/my-organization
 * @access ORG_ADMIN
 */
export const getMyOrganization = async (req, res) => {
  try {
    const org = await prisma.organization.findUnique({
      where: { adminId: req.user.id },
      select: {
        id: true,
        name: true,
        industry: true,
        status: true,
        logo: true,
        createdAt: true,
      },
    });

    if (!org) {
      return res.status(404).json({ success: false, message: "No organization registered yet" });
    }

    res.status(200).json({ success: true, data: org });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch organization", error: error.message });
  }
};

/**
 * Update the organization belonging to the logged-in ORG_ADMIN.
 * @route PATCH /api/organizations/my-organization
 * @access ORG_ADMIN
 */
export const updateOrganization = async (req, res) => {
  try {
    const { name, industry } = req.body;
    const userId = req.user.id;

    const existing = await prisma.organization.findUnique({ where: { adminId: userId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: "No organization found to update" });
    }

    const data = {};
    if (name) data.name = name;
    if (industry) data.industry = industry;

    if (req.file) {
      const fileBuffer = req.file.buffer;
       data.logo = await uploadToImageKit(fileBuffer, "talentiq/org_logos", req.file.originalname);
      // data.logo = await uploadToCloudinary(fileBuffer, "talentiq/org_logos");
    }

    const org = await prisma.organization.update({ where: { adminId: userId }, data });

    res.status(200).json({ success: true, message: "Organization updated", data: org });
  } catch (error) {
    res.status(500).json({ success: false, message: "Update failed", error: error.message });
  }
};

/**
 * Delete the organization belonging to the logged-in ORG_ADMIN.
 * @route DELETE /api/organizations/my-organization
 * @access ORG_ADMIN
 */
export const deleteOrganization = async (req, res) => {
  try {
    const userId = req.user.id;

    const existing = await prisma.organization.findUnique({ where: { adminId: userId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: "No organization found to delete" });
    }

    await prisma.organization.delete({ where: { adminId: userId } });

    res.status(200).json({ success: true, message: "Organization deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Delete failed", error: error.message });
  }
};


/**
 * Invite a Recruiter or Interviewer into the logged-in Org Admin's organization.
 * Org must be APPROVED. Org derived from req.user.id, never from request body.
 * @route POST /api/organizations/team-members
 * @access ORG_ADMIN
 */
export const inviteTeamMember = async (req, res) => {
  try {
    const { name, email, role } = req.body;

    if (!name || !email || !role) {
      return res.status(400).json({ success: false, message: "Name, email and role are required" });
    }

    if (!["RECRUITER", "INTERVIEWER"].includes(role)) {
      return res.status(400).json({ success: false, message: "Role must be RECRUITER or INTERVIEWER" });
    }

    // org derived from logged-in admin's own token — never from body
    const org = await prisma.organization.findUnique({ where: { adminId: req.user.id } });
    if (!org) {
      return res.status(404).json({ success: false, message: "No organization found for this admin" });
    }
    if (org.status !== "APPROVED") {
      return res.status(403).json({ success: false, message: "Organization must be approved before inviting team members" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ success: false, message: "A user with this email already exists" });
    }

    // create pending user first (need the id to sign the token)
    const pendingUser = await prisma.user.create({
      data: {
        email,
        role,
        isVerified: false,
        memberOrgId: org.id,
      },
    });

    const inviteToken = jwt.sign(
      { id: pendingUser.id, role },
      config.jwt_reset_password_secret, // reusing existing secret, same as reset-password tokens
      { expiresIn: "48h" }
    );
    const inviteExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000);

    await prisma.user.update({
      where: { id: pendingUser.id },
      data: { inviteToken, inviteExpiry },
    });

    await sendEmail({
      to: email,
      subject: `TalentIQ - You've been invited as ${role === "RECRUITER" ? "a Recruiter" : "an Interviewer"}`,
      htmlContent: `<p>Hi ${name},</p>
<p>You've been invited to join <strong>${org.name}</strong> on TalentIQ as a <strong>${role}</strong>.</p>
<p><a href="${config.frontend_url}/accept-invite?token=${inviteToken}">Accept Invite & Set Password</a></p>
<p>This link expires in 48 hours.</p>`,
    });

    res.status(201).json({ success: true, message: "Invite sent", data: { id: pendingUser.id, email, role } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to send invite", error: error.message });
  }
};

/**
 * Verify an invite token is valid before showing the accept-invite form.
 * @route GET /api/organizations/verify-invite?token=xxxx
 * @access Public
 */
export const verifyInvite = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) {
      return res.status(400).json({ success: false, message: "Invite token is required" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt_reset_password_secret);
    } catch {
      return res.status(400).json({ success: false, message: "Invalid or expired invite" });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { memberOrg: { select: { name: true } } },
    });

    if (!user || user.inviteToken !== token) {
      return res.status(400).json({ success: false, message: "Invalid or expired invite" });
    }
    if (new Date() > user.inviteExpiry) {
      return res.status(400).json({ success: false, message: "Invite has expired" });
    }
    if (user.isVerified) {
      return res.status(400).json({ success: false, message: "This invite has already been accepted" });
    }

    res.status(200).json({
      success: true,
      data: { email: user.email, role: user.role, orgName: user.memberOrg?.name },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to verify invite", error: error.message });
  }
};

/**
 * Accept an invite — set password, activate account, auto-login.
 * @route POST /api/organizations/accept-invite
 * @access Public
 */
export const acceptInvite = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ success: false, message: "Token and password are required" });
    }

    const passwordRegex =
      /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters long and contain letters, special characters, and numbers",
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, config.jwt_reset_password_secret);
    } catch {
      return res.status(400).json({ success: false, message: "Invalid or expired invite" });
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user || user.inviteToken !== token) {
      return res.status(400).json({ success: false, message: "Invalid or expired invite" });
    }
    if (new Date() > user.inviteExpiry) {
      return res.status(400).json({ success: false, message: "Invite has expired" });
    }
    if (user.isVerified) {
      return res.status(400).json({ success: false, message: "This invite has already been accepted" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const accessToken = jwt.sign({ id: user.id, role: user.role }, config.jwt_access_secret, { expiresIn: "15m" });
    const refreshToken = jwt.sign({ id: user.id }, config.jwt_refresh_secret, { expiresIn: "7d" });

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        isVerified: true,
        inviteToken: null,      // single-use — cleared same as reset token
        inviteExpiry: null,
        refreshToken,
      },
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      success: true,
      message: "Invite accepted, welcome to TalentIQ",
      accessToken,
      data: { id: user.id, email: user.email, role: user.role },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to accept invite", error: error.message });
  }
};

/**
 * Deactivate a Recruiter/Interviewer belonging to the logged-in Org Admin's org.
 * @route PATCH /api/organizations/team-members/:id/deactivate
 * @access ORG_ADMIN
 */
export const deactivateTeamMember = async (req, res) => {
  try {
    const { id } = req.params;

    const org = await prisma.organization.findUnique({ where: { adminId: req.user.id } });
    if (!org) {
      return res.status(404).json({ success: false, message: "No organization found for this admin" });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: Number(id) } });
    if (!targetUser || targetUser.memberOrgId !== org.id) {
      return res.status(404).json({ success: false, message: "Team member not found in your organization" });
    }

    if (!["RECRUITER", "INTERVIEWER"].includes(targetUser.role)) {
      return res.status(400).json({ success: false, message: "Only Recruiter/Interviewer accounts can be deactivated" });
    }

    await prisma.user.update({
      where: { id: targetUser.id },
      data: { isActive: false, deactivatedByAdmin: true, refreshToken: null },
    });

    res.status(200).json({ success: true, message: "Team member deactivated" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to deactivate", error: error.message });
  }
};

/**
 * Reactivate a Recruiter/Interviewer belonging to the logged-in Org Admin's org.
 * @route PATCH /api/organizations/team-members/:id/activate
 * @access ORG_ADMIN
 */
export const activateTeamMember = async (req, res) => {
  try {
    const { id } = req.params;

    const org = await prisma.organization.findUnique({ where: { adminId: req.user.id } });
    if (!org) {
      return res.status(404).json({ success: false, message: "No organization found for this admin" });
    }

    const targetUser = await prisma.user.findUnique({ where: { id: Number(id) } });
    if (!targetUser || targetUser.memberOrgId !== org.id) {
      return res.status(404).json({ success: false, message: "Team member not found in your organization" });
    }

    await prisma.user.update({
      where: { id: targetUser.id },
      data: { isActive: true, deactivatedByAdmin: false },
    });

    res.status(200).json({ success: true, message: "Team member activated" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to activate", error: error.message });
  }
};

/**
 * Get the org a Recruiter/Interviewer belongs to (via memberOrgId).
 * @route GET /api/organizations/my-membership
 * @access RECRUITER, INTERVIEWER
 */
export const getMyMembership = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { memberOrg: true },
    });

    if (!user || !user.memberOrg) {
      return res.status(404).json({ success: false, message: "No organization membership found" });
    }

    res.status(200).json({ success: true, data: user.memberOrg });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch organization", error: error.message });
  }
};


/**
 * List all Recruiters/Interviewers belonging to the logged-in Org Admin's org.
 * @route GET /api/organizations/team-members
 * @access ORG_ADMIN
 */
export const getTeamMembers = async (req, res) => {
  try {
    const org = await prisma.organization.findUnique({ where: { adminId: req.user.id } });
    if (!org) {
      return res.status(404).json({ success: false, message: "No organization found for this admin" });
    }

    const members = await prisma.user.findMany({
      where: { memberOrgId: org.id },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        isVerified: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.status(200).json({ success: true, data: members });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch team members", error: error.message });
  }
};