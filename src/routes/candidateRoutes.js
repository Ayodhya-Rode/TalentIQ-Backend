import express from "express";

import {
  getMyProfile,
  updateMyProfile,
  uploadResume,
  uploadProfileImage,
  generateResume
} from "../controllers/candidateController.js";

import { protect } from "../middlewares/authMiddleware.js";
import upload from "../middlewares/uploadMiddleware.js";

const router = express.Router();
router.get("/profile", protect, getMyProfile);
router.patch("/profile", protect, updateMyProfile);
router.post("/profile/resume", protect, upload.single("resume"), uploadResume);
router.post(
  "/profile/image",
  protect,
  upload.single("profileImage"),
  uploadProfileImage,
);

router.post("/resume/generate", protect, generateResume);
export default router;
