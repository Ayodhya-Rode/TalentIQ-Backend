import express from "express";
import {
  registerOrganization,
  getAllOrganizations,
  approveOrganization,
  rejectOrganization,
  suspendOrganization,
  activateOrganization,
  getOrganizationById,
  getMyOrganization,
  updateOrganization,   
  deleteOrganization,
  inviteTeamMember,
  verifyInvite, 
  acceptInvite,
  getMyMembership,
  deactivateTeamMember,
  activateTeamMember,
  getTeamMembers,
  getApprovedOrganizations
} from "../controllers/organizationController.js";
import { protect, authorize } from "../middlewares/authMiddleware.js";
import upload from "../middlewares/uploadMiddleware.js";


const router = express.Router();

router.post("/register", protect, authorize("ORG_ADMIN"), upload.single("logo"), registerOrganization);
router.get("/my-organization", protect, authorize("ORG_ADMIN"), getMyOrganization);
router.patch("/my-organization", protect, authorize("ORG_ADMIN"), upload.single("logo"), updateOrganization); 
router.delete("/my-organization", protect, authorize("ORG_ADMIN"), deleteOrganization); 
router.post("/team-members", protect, authorize("ORG_ADMIN"), inviteTeamMember);

router.get("/get-all-organizations", protect, authorize("SUPER_ADMIN"), getAllOrganizations);
router.get("/verify-invite", verifyInvite);   // public — no protect/authorize
router.post("/accept-invite", acceptInvite);  // public — no protect/authorize
router.get("/my-membership", protect, authorize("RECRUITER", "INTERVIEWER"), getMyMembership);
router.patch("/team-members/:id/deactivate", protect, authorize("ORG_ADMIN"), deactivateTeamMember);
router.patch("/team-members/:id/activate", protect, authorize("ORG_ADMIN"), activateTeamMember);
router.get("/team-members", protect, authorize("ORG_ADMIN"), getTeamMembers);
router.get("/approved", getApprovedOrganizations);
router.patch("/:id/approve", protect, authorize("SUPER_ADMIN"), approveOrganization);
router.patch("/:id/reject", protect, authorize("SUPER_ADMIN"), rejectOrganization);
router.patch("/:id/suspend", protect, authorize("SUPER_ADMIN"), suspendOrganization);
router.patch("/:id/activate", protect, authorize("SUPER_ADMIN"), activateOrganization);
router.get("/:id", protect, authorize("SUPER_ADMIN"), getOrganizationById);


export default router;