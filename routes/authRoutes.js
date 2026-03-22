const express = require("express");
const router = express.Router();
const auth = require("../controllers/authController");
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
 *     description: Authentication and account management
 *
 * /api/auth/send-otp:
 *   post:
 *     summary: Send OTP for signup verification
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
 *         description: OTP sent successfully
 *       400:
 *         description: Invalid email or user already exists
 *       429:
 *         description: Too many requests
 *
 * /api/auth/verify-otp:
 *   post:
 *     summary: Verify OTP for signup
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
 *         description: OTP verified successfully
 *       400:
 *         description: Invalid or expired OTP
 *       429:
 *         description: Too many requests
 *
 * /api/auth/signup:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, role]
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *               role:
 *                 type: string
 *                 enum: [Freelancer, Employer]
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Validation error or email already in use
 *       429:
 *         description: Too many requests
 *
 * /api/auth/login:
 *   post:
 *     summary: Log in a user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Login successful, session created
 *       401:
 *         description: Invalid credentials
 *       429:
 *         description: Too many requests
 *
 * /api/auth/logout:
 *   post:
 *     summary: Log out the current user
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
 *       429:
 *         description: Too many requests
 *
 * /api/auth/me:
 *   get:
 *     summary: Get current logged-in user info
 *     tags: [Auth]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: User info returned
 *       401:
 *         description: Not authenticated
 *       429:
 *         description: Too many requests
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
 *         description: OTP sent for password reset
 *       400:
 *         description: Email not found
 *       429:
 *         description: Too many requests
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
 *         description: OTP verified for password reset
 *       400:
 *         description: Invalid or expired OTP
 *       429:
 *         description: Too many requests
 *
 * /api/auth/forgot-password/reset:
 *   post:
 *     summary: Reset password with verified OTP
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, newPassword]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               newPassword:
 *                 type: string
 *                 format: password
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       400:
 *         description: Validation error
 *       429:
 *         description: Too many requests
 */

// Signup flow with rate limiting
router.post("/send-otp", sendOtpLimiter, auth.sendOtp);
router.post("/verify-otp", verifyOtpLimiter, auth.verifyOtp);
router.post("/signup", signupLimiter, auth.signup);

// Login/logout with rate limiting
router.post("/login", loginLimiter, auth.login);
router.post("/logout", logoutLimiter, auth.logout);

// Get user info with rate limiting
router.get("/me", getUserInfoLimiter, auth.me);

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
