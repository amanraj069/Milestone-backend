const rateLimit = require('express-rate-limit');

// Rate limiter for subscription operations
const subscriptionRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 2, // Max 2 requests per minute
  message: {
    success: false,
    error: 'Too many subscription requests. Please try again after 1 minute.',
    retryAfter: '1 minute'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res, next, options) => {
    console.error('RATE LIMIT EXCEEDED - SUBSCRIPTION');
    console.error(`Path: ${req.method} ${req.originalUrl}`);
    console.error(`Time: ${new Date().toISOString()}`);
    console.error(`Limit: ${options.max} requests per ${options.windowMs / 1000} seconds`);
    console.error(`IP: ${req.ip}`);
    
    if (req.session?.user) {
      console.error(`User: ${req.session.user.name} (${req.session.user.id})`);
      console.error(`Email: ${req.session.user.email}`);
      console.error(`Role: ${req.session.user.role}`);
    }
    
    console.error(`Retry After: ${options.message.retryAfter}`);
    
    res.status(options.statusCode).json(options.message);
  },
  skip: (req, res) => {
    // Skip rate limiting for admins if needed
    if (req.session?.user?.role === 'Admin') {
      console.log(`Rate limit skipped for Admin: ${req.session.user.name}`);
      return true;
    }
    return false;
  },
  // Use user ID as key if available, otherwise use IP
  keyGenerator: (req, res) => {
    return req.session?.user?.id || req.ip;
  }
});

// Rate limiter for job application operations
const jobApplicationRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 3, // Max 3 applications per minute
  message: {
    success: false,
    error: 'Too many job application requests. Please slow down.',
    retryAfter: '1 minute'
  },
  handler: (req, res, next, options) => {
    console.error('RATE LIMIT EXCEEDED - JOB APPLICATION');
    console.error(`Path: ${req.method} ${req.originalUrl}`);
    console.error(`Time: ${new Date().toISOString()}`);
    console.error(`User: ${req.session?.user?.name || 'Unknown'} (${req.session?.user?.id || 'N/A'})`);
    console.error(`Retry After: 1 minute`);
    
    res.status(options.statusCode).json(options.message);
  },
  keyGenerator: (req, res) => {
    return req.session?.user?.id || req.ip;
  }
});

// Rate limiter for general API requests
const generalRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 50, // Max 50 requests per minute
  message: {
    success: false,
    error: 'Too many requests from this user/IP. Please try again later.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    console.error('RATE LIMIT EXCEEDED - GENERAL API');
    console.error(`Path: ${req.method} ${req.originalUrl}`);
    console.error(`IP: ${req.ip}`);
    console.error(`User: ${req.session?.user?.name || 'Anonymous'}`);
    
    res.status(options.statusCode).json(options.message);
  }
});

// Rate limiter for file uploads (images and PDFs)
const uploadRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 3, // Max 3 uploads per minute (allows pfp + portfolio + resume in one session)
  message: {
    success: false,
    error: 'Too many file uploads. Please wait 1 minute before uploading again.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    console.error('RATE LIMIT EXCEEDED - FILE UPLOAD');
    console.error(`Path: ${req.method} ${req.originalUrl}`);
    console.error(`Time: ${new Date().toISOString()}`);
    console.error(`IP: ${req.ip}`);
    
    if (req.session?.user) {
      console.error(`User: ${req.session.user.name} (${req.session.user.id})`);
      console.error(`Email: ${req.session.user.email}`);
      console.error(`Role: ${req.session.user.role}`);
    }
    
    console.error(`Limit: ${options.max} uploads per ${options.windowMs / 1000} seconds`);
    console.error(`Retry After: ${options.message.retryAfter}`);
    
    res.status(options.statusCode).json(options.message);
  },
  // Use user ID as key if available, otherwise use IP
  keyGenerator: (req, res) => {
    return req.session?.user?.id || req.ip;
  }
});

// Rate limiter for job postings
const jobPostingLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 10, // Max 10 job postings per day
  message: {
    success: false,
    error: 'Daily job posting limit reached (10 jobs per day). Contact support if you need to post more jobs.',
    retryAfter: '24 hours'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    console.error('RATE LIMIT EXCEEDED - JOB POSTING');
    console.error(`Path: ${req.method} ${req.originalUrl}`);
    console.error(`Time: ${new Date().toISOString()}`);
    console.error(`IP: ${req.ip}`);
    
    if (req.session?.user) {
      console.error(`User: ${req.session.user.name} (${req.session.user.id})`);
      console.error(`Email: ${req.session.user.email}`);
      console.error(`Role: ${req.session.user.role}`);
      console.error(`Employer ID: ${req.session.user.roleId}`);
    }
    
    console.error(`Limit: ${options.max} job postings per 24 hours`);
    console.error(`Retry After: ${options.message.retryAfter}`);
    
    res.status(options.statusCode).json(options.message);
  },
  // Use employer roleId as key for per-employer limit
  keyGenerator: (req, res) => {
    return req.session?.user?.roleId || req.ip;
  }
});

module.exports = {
  subscriptionRateLimiter,
  jobApplicationRateLimiter,
  generalRateLimiter,
  uploadRateLimiter,
  jobPostingLimiter
};
