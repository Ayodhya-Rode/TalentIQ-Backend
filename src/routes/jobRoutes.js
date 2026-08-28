import express from "express";
import {
  createJob,
  getMyJobs,
  getPendingJobsForOrg,
  approveJob,
  rejectJob,
  updateJob,
  closeJob,
  getApprovedJobs,
} from "../controllers/jobController.js";
import { protect, authorize } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/create-job", protect, authorize("RECRUITER"), createJob);
router.get("/my-jobs", protect, authorize("RECRUITER"), getMyJobs);
router.get(
  "/pending-approval",
  protect,
  authorize("ORG_ADMIN"),
  getPendingJobsForOrg,
);
router.patch("/:id/approve-job", protect, authorize("ORG_ADMIN"), approveJob);
router.patch("/:id/reject-job", protect, authorize("ORG_ADMIN"), rejectJob);
router.patch("/:id/update-job", protect, authorize("RECRUITER"), updateJob);
router.patch("/:id/close-job", protect, authorize("RECRUITER"), closeJob);
router.get("/approved", getApprovedJobs);

export default router;
