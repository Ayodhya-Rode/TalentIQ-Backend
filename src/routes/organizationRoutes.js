import express from "express";
import {
  registerOrganization,
  getAllOrganizations,
  approveOrganization,
  rejectOrganization,
  suspendOrganization,
  activateOrganization,
} from "../controllers/organizationController.js";
import { protect, authorize } from "../middlewares/authMiddleware.js";
import upload from "../middlewares/uploadMiddleware.js";


const router = express.Router();

router.post("/register", protect, authorize("ORG_ADMIN"), upload.single("logo"), registerOrganization);
router.get("/get-all-organizations", protect, authorize("SUPER_ADMIN"), getAllOrganizations);
router.patch("/:id/approve", protect, authorize("SUPER_ADMIN"), approveOrganization);
router.patch("/:id/reject", protect, authorize("SUPER_ADMIN"), rejectOrganization);
router.patch("/:id/suspend", protect, authorize("SUPER_ADMIN"), suspendOrganization);
router.patch("/:id/activate", protect, authorize("SUPER_ADMIN"), activateOrganization);
export default router;