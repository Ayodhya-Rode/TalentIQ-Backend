import express from "express";
import {
  register,
  verifyOtp,
  login,
  refreshAccessToken,
  logout
} from "../controllers/authController.js";

const router = express.Router();
router.post("/register", register);
router.post("/verify-otp", verifyOtp);
router.post("/login", login);
router.post("/refresh-token", refreshAccessToken);
router.post("/logout", logout);

export default router;
