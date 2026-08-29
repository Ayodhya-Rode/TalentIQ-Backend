import prisma from "../config/db.js";
import { uploadToCloudinary } from "../utils/uploadToCloudinary.js";
import groq from "../utils/groqClient.js";
import { buildResumePrompt } from "../utils/buildResumePrompt.js";
import { uploadToImageKit } from "../utils/uploadToImageKit.js";
/**
 * Get the profile of the currently authenticated candidate
 * @route GET /api/candidate/profile
 * @access Private
 */
export const getMyProfile = async (req, res) => {
  try {
    const profile = await prisma.candidateProfile.findUnique({
      where: { userId: req.user.id },
      include: {
        user: {
          select: {
            email: true,
          },
        },
        education: true,
        certificates: true,
        projects: true,
      },
    });

    if (!profile) {
      return res
        .status(404)
        .json({ success: false, message: "Profile not found" });
    }

    res.status(200).json({ success: true, data: { profile } });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch profile",
      error: error.message,
    });
  }
};

/**
 * Update the profile of the currently authenticated candidate
 * @route PUT /api/candidate/profile
 * @access Private
 */
export const updateMyProfile = async (req, res) => {
  try {
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.id },
    });

    if (!currentUser.isActive) {
      return res.status(403).json({
        success: false,
        message: "Reactivate your account (log in again) to edit your profile",
      });
    }

    const {
      fullName,
      phone,
      skills,
      bio,
      location,
      education,
      certifications,
      projects,
      portfolioUrl,
      githubUrl,
      linkedinUrl,
    } = req.body;

    const existingProfile = await prisma.candidateProfile.findUnique({
      where: { userId: req.user.id },
    });

    const profile = await prisma.$transaction(async (tx) => {
      await tx.candidateProfile.update({
        where: { userId: req.user.id },
        data: {
          fullName,
          phone,
          skills,
          bio,
          location,
          portfolioUrl,
          githubUrl,
          linkedinUrl,
        },
      });

      await tx.education.deleteMany({
        where: { candidateProfileId: existingProfile.id },
      });
      if (education?.length) {
        await tx.education.createMany({
          data: education.map((e) => ({
            candidateProfileId: existingProfile.id,
            institution: e.institution,
            degree: e.degree,
            startYear: e.startYear,
            endYear: e.endYear || null,
          })),
        });
      }

      await tx.certificate.deleteMany({
        where: { candidateProfileId: existingProfile.id },
      });
      if (certifications?.length) {
        await tx.certificate.createMany({
          data: certifications.map((c) => ({
            candidateProfileId: existingProfile.id,
            name: c.name,
            issuer: c.issuer,
            issueDate: c.date ? new Date(`${c.date}-01`) : null,
            credentialUrl: c.url || null,
          })),
        });
      }

      await tx.project.deleteMany({
        where: { candidateProfileId: existingProfile.id },
      });
      if (projects?.length) {
        await tx.project.createMany({
          data: projects.map((p) => ({
            candidateProfileId: existingProfile.id,
            name: p.name,
            description: p.description || null,
            techStack: p.techStack
              ? p.techStack
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
              : [],
            link: p.link || null,
          })),
        });
      }

      return tx.candidateProfile.findUnique({
        where: { userId: req.user.id },
        include: { education: true, certificates: true, projects: true },
      });
    });

    res
      .status(200)
      .json({ success: true, message: "Profile updated", data: { profile } });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to update profile",
      error: error.message,
    });
  }
};

export const uploadProfileImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Profile image is required",
      });
    }

    const result = await uploadToImageKit(
      req.file.buffer,
      "talentiq/profile-images",
      req.file.originalname,
    );

    const profile = await prisma.candidateProfile.update({
      where: { userId: req.user.id },
      data: { profileImage: result },
    });

    res.status(200).json({
      success: true,
      message: "Profile image uploaded",
      data: { profileImage: profile.profileImage },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Profile image upload failed",
      error: error.message,
    });
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
      return res
        .status(400)
        .json({ success: false, message: "Resume file is required" });
    }

    const result = await uploadToImageKit(
      req.file.buffer,
      "talentiq/resumes",
      req.file.originalname,
    );

    const profile = await prisma.candidateProfile.update({
      where: { userId: req.user.id },
      data: { resumeUrl: result },
    });

    res.status(200).json({
      success: true,
      message: "Resume uploaded",
      data: { resumeUrl: profile.resumeUrl },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Resume upload failed",
      error: error.message,
    });
  }
};

/**
 * Generate AI resume content for the currently authenticated candidate
 * @route POST /api/candidate/resume/generate
 * @access Private
 */
export const generateResume = async (req, res) => {
  try {
    const { targetRole } = req.body;

    if (!targetRole || !targetRole.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Target role is required" });
    }

    const profile = await prisma.candidateProfile.findUnique({
      where: { userId: req.user.id },
      include: { education: true, certificates: true, projects: true },
    });

    if (!profile) {
      return res
        .status(404)
        .json({ success: false, message: "Profile not found" });
    }

    const { systemPrompt, userPrompt } = buildResumePrompt(profile, targetRole);

    const completion = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.4,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content;
    let generated;
    try {
      generated = JSON.parse(raw);
    } catch (parseErr) {
      return res.status(502).json({
        success: false,
        message: "AI returned an unparseable response",
      });
    }

    res.status(200).json({
      success: true,
      message: "Resume content generated",
      data: { resume: generated, targetRole, profile },
    });
  } catch (error) {
    console.error("❌ Resume generation error:", error);
    console.error("Message:", error.message);
    console.error("Response:", error.response?.data);
    res.status(500).json({
      success: false,
      message: "Resume generation failed",
      error: error.message,
    });
  }
};
