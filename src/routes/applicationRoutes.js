import express from "express";
import {
  applyToJob,
  getMyApplications,
  getApplicationsForJob,
  updateApplicationStatus,
  getAllApplicationsForOrg,
} from "../controllers/applicationController.js";
import { protect, authorize } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/apply/:jobId", protect, authorize("CANDIDATE"), applyToJob);
router.get("/my-applications", protect, authorize("CANDIDATE"), getMyApplications);
router.get("/job/:jobId", protect, authorize("RECRUITER"), getApplicationsForJob);
router.patch("/:id/status", protect, authorize("RECRUITER"), updateApplicationStatus);
router.get("/org-all", protect, authorize("ORG_ADMIN"), getAllApplicationsForOrg);

export default router;