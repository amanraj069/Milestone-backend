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
