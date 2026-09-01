import express from "express";
import { submitFeedback, getFeedback } from "../controllers/feedbackController.js";
import { protect, authorize } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/:bookingId/feedback", protect, authorize("RECRUITER", "INTERVIEWER"), submitFeedback);
router.get("/:bookingId/feedback", protect, authorize("CANDIDATE", "RECRUITER", "INTERVIEWER", "ORG_ADMIN"), getFeedback);

export default router;