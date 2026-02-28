const rateLimit = require("express-rate-limit");

const subscriptionRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 2,
  message: {
    success: false,
    error: "Too many subscription requests. Please try again after 1 minute.",
    retryAfter: "1 minute",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    console.error(
      `RATE LIMIT - SUBSCRIPTION | IP: ${req.ip} | User: ${req.session?.user?.email || "Anonymous"}`,
    );
    res.status(options.statusCode).json(options.message);
  },
  skip: (req, res) => {
    if (req.session?.user?.role === "Moderator") {
      return true;
    }
    return false;
  },
  keyGenerator: (req, res) => {
    return req.session?.user?.id || req.ip;
  },
});

const jobApplicationRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 3,
  message: {
    success: false,
    error: "Too many job application requests. Please slow down.",
    retryAfter: "1 minute",
  },
  handler: (req, res, next, options) => {
    console.error(
      `RATE LIMIT - JOB APPLICATION | User: ${req.session?.user?.email || req.ip}`,
    );
    res.status(options.statusCode).json(options.message);
  },
  keyGenerator: (req, res) => {
    return req.session?.user?.id || req.ip;
  },
});

const uploadRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 3,
  message: {
    success: false,
    error:
      "Too many file uploads. Please wait 1 minute before uploading again.",
    retryAfter: "1 minute",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    console.error(
      `RATE LIMIT - FILE UPLOAD | User: ${req.session?.user?.email || req.ip}`,
    );
    res.status(options.statusCode).json(options.message);
  },
  keyGenerator: (req, res) => {
    return req.session?.user?.id || req.ip;
  },
});

const jobPostingLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    error:
      "Daily job posting limit reached (10 jobs per day). Contact support if you need to post more jobs.",
    retryAfter: "24 hours",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    console.error(
      `RATE LIMIT - JOB POSTING | Employer: ${req.session?.user?.email || req.ip}`,
    );
    res.status(options.statusCode).json(options.message);
  },
  keyGenerator: (req, res) => {
    return req.session?.user?.roleId || req.ip;
  },
});

const sendOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: {
    success: false,
    error: "Too many OTP requests. Please try again after 15 minutes.",
    retryAfter: "15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    console.error(
      `RATE LIMIT - SEND OTP | Email: ${req.body?.email || req.ip}`,
    );
    res.status(options.statusCode).json(options.message);
  },
  keyGenerator: (req, res) => {
    return req.body?.email || req.ip;
  },
});

const verifyOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    error:
      "Too many OTP verification attempts. Please request a new OTP or try again after 15 minutes.",
    retryAfter: "15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    console.error(
      `RATE LIMIT - VERIFY OTP | Email: ${req.body?.email || req.ip}`,
    );
    res.status(options.statusCode).json(options.message);
  },
  keyGenerator: (req, res) => {
    return req.body?.email || req.ip;
  },
});

const signupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: {
    success: false,
    error: "Too many signup attempts. Please try again after 1 hour.",
    retryAfter: "1 hour",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    console.error(
      `RATE LIMIT - SIGNUP | IP: ${req.ip} | Email: ${req.body?.email || "Unknown"}`,
    );
    res.status(options.statusCode).json(options.message);
  },
  keyGenerator: (req, res) => {
    return req.ip;
  },
});

const loginLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    error: "Too many login attempts. Please try again after 1 minute.",
    retryAfter: "1 minute",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    console.error(`RATE LIMIT - LOGIN | Email: ${req.body?.email || req.ip}`);
    res.status(options.statusCode).json(options.message);
  },
  keyGenerator: (req, res) => {
    return req.body?.email || req.ip;
  },
});

const logoutLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    error: "Too many logout requests. Please try again after 1 minute.",
    retryAfter: "1 minute",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    console.error(`RATE LIMIT - LOGOUT | IP: ${req.ip}`);
    res.status(options.statusCode).json(options.message);
  },
  keyGenerator: (req, res) => {
    return req.session?.user?.id || req.ip;
  },
});

const getUserInfoLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 30,
  message: {
    success: false,
    error: "Too many requests. Please try again after 1 minute.",
    retryAfter: "1 minute",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    console.error(`RATE LIMIT - GET USER INFO | IP: ${req.ip}`);
    res.status(options.statusCode).json(options.message);
  },
  keyGenerator: (req, res) => {
    return req.session?.user?.id || req.ip;
  },
});

const forgotPasswordSendOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: {
    success: false,
    error:
      "Too many password reset requests. Please try again after 15 minutes.",
    retryAfter: "15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    console.error(
      `RATE LIMIT - FORGOT PASSWORD SEND OTP | Email: ${req.body?.email || req.ip}`,
    );
    res.status(options.statusCode).json(options.message);
  },
  keyGenerator: (req, res) => {
    return req.body?.email || req.ip;
  },
});

const forgotPasswordVerifyOtpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    error:
      "Too many OTP verification attempts. Please request a new OTP or try again after 15 minutes.",
    retryAfter: "15 minutes",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    console.error(
      `RATE LIMIT - FORGOT PASSWORD VERIFY OTP | Email: ${req.body?.email || req.ip}`,
    );
    res.status(options.statusCode).json(options.message);
  },
  keyGenerator: (req, res) => {
    return req.body?.email || req.ip;
  },
});

const resetPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: {
    success: false,
    error: "Too many password reset attempts. Please try again after 1 hour.",
    retryAfter: "1 hour",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    console.error(
      `RATE LIMIT - RESET PASSWORD | Email: ${req.body?.email || req.ip}`,
    );
    res.status(options.statusCode).json(options.message);
  },
  keyGenerator: (req, res) => {
    return req.body?.email || req.ip;
  },
});

const generalRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 50,
  message: {
    success: false,
    error: "Too many requests from this user/IP. Please try again later.",
    retryAfter: "1 minute",
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    console.error(
      `RATE LIMIT - GENERAL API | ${req.method} ${req.originalUrl} | IP: ${req.ip}`,
    );
    res.status(options.statusCode).json(options.message);
  },
});

module.exports = {
  subscriptionRateLimiter,
  jobApplicationRateLimiter,
  uploadRateLimiter,
  jobPostingLimiter,
  sendOtpLimiter,
  verifyOtpLimiter,
  signupLimiter,
  loginLimiter,
  logoutLimiter,
  getUserInfoLimiter,
  forgotPasswordSendOtpLimiter,
  forgotPasswordVerifyOtpLimiter,
  resetPasswordLimiter,
  generalRateLimiter,
};
