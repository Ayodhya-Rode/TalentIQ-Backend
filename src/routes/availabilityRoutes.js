import express from "express";
import {
  setMyDomains,
  addAvailabilitySlot,
  getMyAvailability,
  deleteAvailabilitySlot,
} from "../controllers/availabilityController.js";
import { protect, authorize } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.put("/domains", protect, authorize("RECRUITER", "INTERVIEWER"), setMyDomains);
router.get("/mine", protect, authorize("RECRUITER", "INTERVIEWER"), getMyAvailability);
router.post("/slots", protect, authorize("RECRUITER", "INTERVIEWER"), addAvailabilitySlot);
router.delete("/slots/:id", protect, authorize("RECRUITER", "INTERVIEWER"), deleteAvailabilitySlot);

export default router;