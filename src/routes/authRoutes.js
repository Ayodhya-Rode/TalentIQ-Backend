import express from "express";
import {
  register,
  verifyOtp,
  login,
  refreshAccessToken,
  logout,
  forgotPassword,
  resetPassword,
  resendOtp,
  getMe,
  deactivateAccount,
  deleteAccount,
} from "../controllers/authController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();
router.post("/register", register);
router.post("/verify-otp", verifyOtp);
router.post("/login", login);
router.post("/refresh-token", refreshAccessToken);
router.post("/logout", logout);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);
router.post("/resend-otp", resendOtp);
router.get("/me", protect, getMe); 
router.post("/deactivate", protect, deactivateAccount);
router.delete("/delete-account", protect, deleteAccount);
export default router;
