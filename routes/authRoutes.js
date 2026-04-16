const express = require("express");
const router = express.Router();
const auth = require("../controllers/authController");
const { cacheMiddleware } = require("../middleware/cacheMiddleware");
const {
  sendOtpLimiter,
  verifyOtpLimiter,
  signupLimiter,
  loginLimiter,
  logoutLimiter,
  getUserInfoLimiter,
  forgotPasswordSendOtpLimiter,
  forgotPasswordVerifyOtpLimiter,
  resetPasswordLimiter,
} = require("../middleware/rateLimiter");

/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: Authentication and account recovery
 *
 * /api/auth/send-otp:
 *   post:
 *     summary: Send signup OTP to email
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               name:
 *                 type: string
 *               password:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [Employer, Freelancer, Moderator, Admin]
 *     responses:
 *       200:
 *         description: OTP sent
 *       400:
 *         description: Validation error
 *       409:
 *         description: Email already exists
 *
 * /api/auth/verify-otp:
 *   post:
 *     summary: Verify signup OTP
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: OTP verified
 *       400:
 *         description: Invalid or expired OTP
 *       404:
 *         description: User not found
 *
 * /api/auth/signup:
 *   post:
 *     summary: Complete signup and create role profile
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, role]
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [Employer, Freelancer, Moderator, Admin]
 *     responses:
 *       201:
 *         description: Account created
 *       400:
 *         description: Verification or validation failed
 *       409:
 *         description: Email already exists
 *
 * /api/auth/login:
 *   post:
 *     summary: Login and create session
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, role]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [Employer, Freelancer, Moderator, Admin]
 *     responses:
 *       200:
 *         description: Logged in successfully
 *       400:
 *         description: Invalid credentials or input
 *
 * /api/auth/logout:
 *   post:
 *     summary: Logout and destroy session
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 *
 * /api/auth/me:
 *   get:
 *     summary: Get current session user
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Session user or null user
 *
 * /api/auth/forgot-password/send-otp:
 *   post:
 *     summary: Send OTP for password reset
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Reset OTP sent
 *       404:
 *         description: Account not found
 *
 * /api/auth/forgot-password/verify-otp:
 *   post:
 *     summary: Verify OTP for password reset
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: OTP verified
 *       400:
 *         description: Invalid or expired OTP
 *
 * /api/auth/forgot-password/reset:
 *   post:
 *     summary: Reset password using OTP
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp, newPassword]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               otp:
 *                 type: string
 *               newPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset successful
 *       400:
 *         description: Validation failed
 *       404:
 *         description: User not found
 */

// Signup flow with rate limiting
router.post("/send-otp", sendOtpLimiter, auth.sendOtp);
router.post("/verify-otp", verifyOtpLimiter, auth.verifyOtp);
router.post("/signup", signupLimiter, auth.signup);

// Login/logout with rate limiting
router.post("/login", loginLimiter, auth.login);
router.post("/logout", logoutLimiter, auth.logout);

// Get user info with rate limiting
router.get("/me", getUserInfoLimiter, cacheMiddleware(60), auth.me);

// Forgot password routes with rate limiting
router.post(
  "/forgot-password/send-otp",
  forgotPasswordSendOtpLimiter,
  auth.forgotPasswordSendOtp,
);
router.post(
  "/forgot-password/verify-otp",
  forgotPasswordVerifyOtpLimiter,
  auth.forgotPasswordVerifyOtp,
);
router.post("/forgot-password/reset", resetPasswordLimiter, auth.resetPassword);

module.exports = router;
