import express from "express";
import {
  getAvailableSlots,
  createBooking,
  empCancelBooking,
  rescheduleBooking,
  getBookingsNeedingAttention,
  getFlaggedEmps,
  getMyAssignedBookings,
  getMyBookings,
  createPaymentOrder,
  verifyPayment,
  getVideoToken
} from "../controllers/bookingController.js";
import { protect, authorize } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/available-slots", protect, authorize("CANDIDATE"), getAvailableSlots);
router.get("/needs-attention", protect, authorize("ORG_ADMIN"), getBookingsNeedingAttention);
router.get("/flagged-emps", protect, authorize("ORG_ADMIN"), getFlaggedEmps);
router.post("/", protect, authorize("CANDIDATE"), createBooking);
router.patch("/:id/emp-cancel", protect, authorize("RECRUITER", "INTERVIEWER"), empCancelBooking);
router.patch("/:id/reschedule", protect, authorize("CANDIDATE"), rescheduleBooking);
router.get("/my-assigned", protect, authorize("RECRUITER", "INTERVIEWER"), getMyAssignedBookings);
router.get("/mine", protect, authorize("CANDIDATE"), getMyBookings);
router.post("/create-payment-order", protect, authorize("CANDIDATE"), createPaymentOrder);
router.post("/verify-payment", protect, authorize("CANDIDATE"), verifyPayment);
router.get("/:bookingId/video-token", protect, authorize("CANDIDATE", "RECRUITER", "INTERVIEWER"), getVideoToken);
export default router;