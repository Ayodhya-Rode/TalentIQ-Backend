import prisma from "../config/db.js";
import { uploadToCloudinary } from "../utils/uploadToCloudinary.js";

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
      logoUrl = await uploadToCloudinary(fileBuffer, "talentiq/org_logos");
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