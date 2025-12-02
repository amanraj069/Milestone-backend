const express = require("express");
const router = express.Router();
const auth = require("../controllers/authController");

router.post("/send-otp", auth.sendOtp);
router.post("/verify-otp", auth.verifyOtp);
router.post("/signup", auth.signup);
router.post("/login", auth.login);
router.post("/logout", auth.logout);
router.get("/me", auth.me);

// Forgot password routes
router.post("/forgot-password/send-otp", auth.forgotPasswordSendOtp);
router.post("/forgot-password/verify-otp", auth.forgotPasswordVerifyOtp);
router.post("/forgot-password/reset", auth.resetPassword);

module.exports = router;
