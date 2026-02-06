const express = require("express");
const router = express.Router();
const employerController = require("../controllers/employerController");
const { upload } = require("../middleware/imageUpload");
const { subscriptionRateLimiter, jobApplicationRateLimiter } = require("../middleware/rateLimiter");
const asyncHandler = require("../middleware/asyncHandler");

// Middleware to check if user is authenticated and is an employer
const requireEmployer = (req, res, next) => {
  console.log("Session user:", req.session.user);
  console.log("Session role:", req.session.user?.role);
  if (!req.session.user || req.session.user.role !== "Employer") {
    console.log("Access denied for employer route");
    console.error('UNAUTHORIZED ACCESS ATTEMPT - EMPLOYER ROUTE');
    console.error(`Path: ${req.method} ${req.originalUrl}`);
    console.error(`User: ${req.session?.user?.name || 'Not logged in'}`);
    console.error(`Role: ${req.session?.user?.role || 'None'}`);
    return res.status(403).json({
      success: false,
      error: "Access denied. Employer access required.",
    });
  }
  next();
};

// Job listing routes
router.get("/job-listings", requireEmployer, employerController.getJobListings);
router.post(
  "/job-listings",
  requireEmployer,
  employerController.createJobListing
);
router.put(
  "/job-listings/:jobId",
  requireEmployer,
  employerController.updateJobListing
);
router.delete(
  "/job-listings/:jobId",
  requireEmployer,
  employerController.deleteJobListing
);
router.get(
  "/job-listings/:jobId",
  requireEmployer,
  employerController.getJobById
);

// Job Applications - with rate limiter
router.get(
  "/job_applications",
  requireEmployer,
  asyncHandler(employerController.getJobApplications)
);
router.get(
  "/job_applications/api/data",
  requireEmployer,
  asyncHandler(employerController.getJobApplicationsAPI)
);
router.post(
  "/job_applications/:applicationId/accept",
  requireEmployer,
  jobApplicationRateLimiter,
  asyncHandler(employerController.acceptJobApplication)
);
router.post(
  "/job_applications/:applicationId/reject",
  requireEmployer,
  jobApplicationRateLimiter,
  asyncHandler(employerController.rejectJobApplication)
);

// Subscription - with rate limiter
router.get(
  "/subscription",
  requireEmployer,
  asyncHandler(employerController.getSubscription)
);
router.post(
  "/subscription/purchase",
  requireEmployer,
  subscriptionRateLimiter,
  asyncHandler(employerController.purchaseSubscription)
);
router.post(
  "/upgrade_subscription",
  requireEmployer,
  subscriptionRateLimiter,
  asyncHandler(employerController.upgradeSubscription)
);
router.post(
  "/downgrade_subscription",
  requireEmployer,
  subscriptionRateLimiter,
  asyncHandler(employerController.downgradeSubscription)
);

// Current Freelancers and Work History
router.get(
  "/current-freelancers",
  requireEmployer,
  employerController.getCurrentFreelancers
);
router.get("/work-history", requireEmployer, employerController.getWorkHistory);

// Complaint routes
router.post("/complaints", requireEmployer, employerController.createComplaint);
router.get(
  "/complaints",
  requireEmployer,
  employerController.getEmployerComplaints
);

// Profile routes
router.get("/profile", requireEmployer, employerController.getEmployerProfile);
router.put(
  "/profile",
  requireEmployer,
  employerController.updateEmployerProfile
);
router.post(
  "/upload-image",
  requireEmployer,
  upload.single("picture"),
  employerController.uploadEmployerImage
);

// Dashboard stats
router.get(
  "/dashboard/stats",
  requireEmployer,
  employerController.getEmployerDashboardStats
);

// Transactions routes
router.get(
  "/transactions",
  requireEmployer,
  employerController.getTransactions
);
router.get(
  "/transactions/:jobId",
  requireEmployer,
  employerController.getTransactionDetails
);
router.post(
  "/transactions/:jobId/milestones/:milestoneId/pay",
  requireEmployer,
  employerController.payMilestone
);

module.exports = router;
