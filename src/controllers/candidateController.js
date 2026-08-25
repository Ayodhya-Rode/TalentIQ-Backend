import prisma from "../config/db.js";
import { uploadToCloudinary } from "../utils/uploadToCloudinary.js";

/**
 * Get the profile of the currently authenticated candidate
 * @route GET /api/candidate/profile
 * @access Private
 */
export const getMyProfile = async (req, res) => {
  try {
    const profile = await prisma.candidateProfile.findUnique({
      where: { userId: req.user.id },
      include: { education: true, certificates: true },
    });

    if (!profile) {
      return res.status(404).json({ success: false, message: "Profile not found" });
    }

    res.status(200).json({ success: true, data: { profile } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch profile", error: error.message });
  }
};

/**
 * Update the profile of the currently authenticated candidate
 * @route PUT /api/candidate/profile
 * @access Private
 */
export const updateMyProfile = async (req, res) => {
  try {
    const { fullName, phone, skills, bio } = req.body;

    const profile = await prisma.candidateProfile.update({
      where: { userId: req.user.id },
      data: { fullName, phone, skills, bio },
    });

    res.status(200).json({ success: true, message: "Profile updated", data: { profile } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to update profile", error: error.message });
  }
};

/**
 * Upload a resume for the currently authenticated candidate
 * @route POST /api/candidate/resume
 * @access Private
 */
export const uploadResume = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "Resume file is required" });
    }
    
    const result = await uploadToCloudinary(req.file.buffer, "talentiq/resumes");

    const profile = await prisma.candidateProfile.update({
      where: { userId: req.user.id },
      data: { resumeUrl: result.secure_url },
    });

    res.status(200).json({ success: true, message: "Resume uploaded", data: { resumeUrl: profile.resumeUrl } });
  } catch (error) {
    res.status(500).json({ success: false, message: "Resume upload failed", error: error.message });
  }
};