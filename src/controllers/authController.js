import config from "../config/config.js";
import bcrypt from "bcryptjs";
import prisma from "../config/db.js";
import { sendEmail } from "../utils/sendEmail.js";
import jwt from "jsonwebtoken";

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */

export const register = async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: "Email, password, and role are required",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email format",
      });
    }

    const passwordRegex =
      /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;

    if (!passwordRegex.test(password)) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 8 characters long and contain letters, special characters, and numbers",
      });
    }

    const validRoles = ["CANDIDATE", "ORG_ADMIN"];

    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role.",
      });
    }

    // Check if the email is already registered
    const existingUser = await prisma.user.findUnique({ where: { email } });

    // If the user exists and is unverified
    if (existingUser) {
      // If the user exists but is not verified, we can allow them to re-register and send a new OTP
      if (existingUser.isVerified) {
        return res.status(409).json({
          success: false,
          message: "Email already registered",
        });
      }

      // unverified user exists, check if the OTP is still valid (within 24 hours of creation)
      const hoursSinceCreated =
        (Date.now() - existingUser.createdAt.getTime()) / 36e5;

      if (hoursSinceCreated > 24) {
        // Too old — delete stale row, fall through to fresh create below
        await prisma.user.delete({ where: { email } });
      } else {
        // Recent unverified — regenerate OTP + update password/role
        const hashedPassword = await bcrypt.hash(password, 10);
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

        const user = await prisma.user.update({
          where: { email },
          data: { password: hashedPassword, role, otp, otpExpiry },
        });

        await sendEmail({
          to: user.email,
          subject: "TalentIQ - Verify your email",
          htmlContent: `<p>Your OTP is <b>${otp}</b>. It expires in 10 minutes.</p>`,
        });

        return res.status(200).json({
          success: true,
          message: "OTP resent to email for verification.",
          data: { id: user.id, email: user.email, role: user.role },
        });
      }
    }

    // Fresh user (either new email, or old stale row just deleted above)
    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    const user = await prisma.user.create({
      data: { email, password: hashedPassword, role, otp, otpExpiry },
    });

    await sendEmail({
      to: user.email,
      subject: "TalentIQ - Verify your email",
      htmlContent: `<p>Your OTP is <b>${otp}</b>. It expires in 10 minutes.</p>`,
    });

    res.status(201).json({
      success: true,
      message: "User registered. OTP sent to email for verification.",
      data: { id: user.id, email: user.email, role: user.role },
    });
  } catch (error) {
    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "Email already registered",
      });
    }
    res.status(500).json({
      success: false,
      message: "Registration failed",
      error: error.message,
    });
  }
};

/**
 * @desc    Verify OTP for email verification while registering a new user
 * @route   POST /api/auth/verify-otp
 * @access  Public
 */
export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res
        .status(400)
        .json({ success: false, message: "Email and OTP are required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    if (user.isVerified) {
      return res
        .status(400)
        .json({ success: false, message: "User already verified" });
    }

    if (user.otp !== otp) {
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    if (new Date() > user.otpExpiry) {
      return res
        .status(400)
        .json({ success: false, message: "OTP has expired" });
    }

    const accessToken = jwt.sign(
      { id: user.id, role: user.role },
      config.jwt_access_secret,
      { expiresIn: "15m" },
    );

    const refreshToken = jwt.sign({ id: user.id }, config.jwt_refresh_secret, {
      expiresIn: "7d",
    });

    const updatedUser = await prisma.user.update({
      where: { email },
      data: { isVerified: true, otp: null, otpExpiry: null, refreshToken },
    });

    // Auto-create empty candidate profile only for candidates
    if (updatedUser.role === "CANDIDATE") {
      await prisma.candidateProfile.create({
        data: { userId: updatedUser.id },
      });
    }

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      success: true,
      message: "Email verified successfully",
      data: {
        accessToken,
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          role: updatedUser.role,
        },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Verification failed",
      error: error.message,
    });
  }
};

/**
 * @desc    Resend OTP for email verification
 * @route   POST /api/auth/resend-otp
 * @access  Public
 */

export const resendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: "Email is already verified",
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.user.update({
      where: { email },
      data: {
        otp,
        otpExpiry,
      },
    });

    await sendEmail({
      to: user.email,
      subject: "TalentIQ - Verify your email",
      htmlContent: `
        <p>Your new OTP is <b>${otp}</b>.</p>
        <p>This OTP expires in 10 minutes.</p>
      `,
    });

    return res.status(200).json({
      success: true,
      message: "OTP resent successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to resend OTP",
      error: error.message,
    });
  }
};

/**
 * @desc    Login a user after verifying their email otp
 * @route   POST /api/auth/login
 * @access  Public
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Email and password are required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }
    if (!user.password) {
      return res
        .status(403)
        .json({
          success: false,
          message:
            "Account not activated. Check your email for the invite link.",
        });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    if (!user.isVerified) {
      return res
        .status(403)
        .json({ success: false, message: "Please verify your email first" });
    }

    let isReactivated = false;
    if (!user.isActive) {
      await prisma.user.update({
        where: { id: user.id },
        data: { isActive: true },
      });
      isReactivated = true;
    }

    const accessToken = jwt.sign(
      { id: user.id, role: user.role },
      config.jwt_access_secret,
      { expiresIn: "15m" },
    );

    const refreshToken = jwt.sign({ id: user.id }, config.jwt_refresh_secret, {
      expiresIn: "7d",
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken },
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      success: true,
      message: "Login successful",
      data: {
        accessToken,
        user: { id: user.id, email: user.email, role: user.role },
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Login failed", error: error.message });
  }
};

/**
 * @desc    Refresh access token using refresh token
 * @route   POST /api/auth/refresh-token
 * @access  Public
 */
export const refreshAccessToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res
        .status(401)
        .json({ success: false, message: "Refresh token required" });
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, config.jwt_refresh_secret);
    } catch {
      return res
        .status(403)
        .json({ success: false, message: "Invalid or expired refresh token" });
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });

    if (!user || user.refreshToken !== refreshToken) {
      return res
        .status(403)
        .json({ success: false, message: "Invalid refresh token" });
    }

    const newAccessToken = jwt.sign(
      { id: user.id, role: user.role },
      config.jwt_access_secret,
      { expiresIn: "15m" },
    );

    res
      .status(200)
      .json({ success: true, data: { accessToken: newAccessToken } });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Token refresh failed",
      error: error.message,
    });
  }
};

/**
 * @desc    Logout a user by clearing the refresh token
 * @route   POST /api/auth/logout
 * @access  Public
 */
export const logout = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res
        .status(400)
        .json({ success: false, message: "You are already logged out" });
    }
    if (refreshToken) {
      try {
        const decoded = jwt.verify(refreshToken, config.jwt_refresh_secret, {
          ignoreExpiration: true,
        });
        await prisma.user.update({
          where: { id: decoded.id },
          data: { refreshToken: null },
        });
      } catch (error) {
        // If the token is invalid or expired, we can still clear the cookie and respond with success
        console.error(
          "Error verifying refresh token during logout:",
          error.message,
        );
      }
    }

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: false,
      sameSite: "strict",
    });

    res.status(200).json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Logout failed", error: error.message });
  }
};

/**
 * @desc    Forgot password - send reset token to email
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Email is required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(200).json({
        success: true,
        message: `If an account exists for ${email}, a reset link has been sent`,
      });
    }

    //create a 15-minute reset token
    const resetToken = jwt.sign(
      { id: user.id },
      config.jwt_reset_password_secret,
      {
        expiresIn: "15m",
      },
    );

    const resetExpiry = new Date(Date.now() + 15 * 60 * 1000);

    // Store the reset token and its expiry in the database to verify later in reset password endpoint
    await prisma.user.update({
      where: { email },
      data: {
        resetPasswordToken: resetToken,
        resetPasswordExpiry: resetExpiry,
      },
    });

    await sendEmail({
      to: user.email,
      subject: "TalentIQ - Reset your password",
      htmlContent: `<p>Click the link below to reset your password:</p>
  <p><a href="${config.frontend_url}/reset-password?token=${resetToken}">Reset Password</a></p>
  <p>This link expires in 15 minutes.</p>`,
    });

    res.status(200).json({
      success: true,
      message: `If an account exists for ${email}, a reset link has been sent`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Request failed",
      error: error.message,
    });
  }
};

/**
 * @desc    Reset password using reset token
 * @route   POST /api/auth/reset-password
 * @access  Public
 */

export const resetPassword = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Reset token and new password are required",
      });
    }

    const passwordRegex =
      /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;

    if (!passwordRegex.test(newPassword)) {
      return res.status(400).json({
        success: false,
        message:
          "Password must be at least 8 characters long and contain letters, special characters, and numbers",
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(resetToken, config.jwt_reset_password_secret);
    } catch {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired reset token" });
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });

    if (!user || user.resetPasswordToken !== resetToken) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or expired reset token" });
    }

    if (new Date() > user.resetPasswordExpiry) {
      return res
        .status(400)
        .json({ success: false, message: "Reset token has expired" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetPasswordToken: null, // clear token so it can't be reused (single-use)
        resetPasswordExpiry: null, // clear expiry along with the token
        refreshToken: null, // clear refresh token to force re-login after password reset
      },
    });

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: false,
      sameSite: "strict",
    });
    res.status(200).json({
      success: true,
      message: "Password reset successfully. Please log in again.",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Password reset failed",
      error: error.message,
    });
  }
};

/**
 * @desc    Get currently logged-in user's details
 * @route   GET /api/auth/me
 * @access  Private (requires valid accessToken)
 */
export const getMe = async (req, res) => {
  try {
    // req.user is set by your auth middleware after verifying the accessToken
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    res.status(200).json({
      success: true,
      data: { user: { id: user.id, email: user.email, role: user.role } },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch user",
      error: error.message,
    });
  }
};

/**
 * @desc    Deactivate the currently logged-in user's account
 * @route   POST /api/auth/deactivate-account
 * @access  Private (requires valid accessToken)
 */
export const deactivateAccount = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    if (!user.isActive) {
      return res.status(400).json({
        success: false,
        message: "Account is already deactivated",
      });
    }

    await prisma.user.update({
      where: { id: req.user.id },
      data: { isActive: false, refreshToken: null },
    });

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: false,
      sameSite: "strict",
    });

    res.status(200).json({
      success: true,
      message: "Account deactivated. Log in again anytime to reactivate.",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to deactivate account",
      error: error.message,
    });
  }
};

/**
 * @desc    Delete the currently logged-in user's account
 * @route   POST /api/auth/delete-account
 * @access  Private (requires valid accessToken)
 */
export const deleteAccount = async (req, res) => {
  try {
    await prisma.user.delete({
      where: { id: req.user.id },
    });

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: false,
      sameSite: "strict",
    });

    res.status(200).json({
      success: true,
      message: "Account deleted permanently.",
    });
  } catch (error) {
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to delete account",
        error: error.message,
      });
  }
};
