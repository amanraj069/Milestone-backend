const express = require("express");
const freelancerController = require("../controllers/feelancerController");
const employerController = require("../controllers/employerController");
const { upload } = require("../middleware/imageUpload");
const { upload: pdfUpload } = require("../middleware/pdfUpload");
const { subscriptionRateLimiter, jobApplicationRateLimiter, uploadRateLimiter } = require("../middleware/rateLimiter");
const asyncHandler = require("../middleware/asyncHandler");
const router = express.Router();

// Middleware to check if user is authenticated and is a freelancer
const requireFreelancer = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== "Freelancer") {
    console.error('UNAUTHORIZED ACCESS ATTEMPT - FREELANCER ROUTE');
    console.error(`Path: ${req.method} ${req.originalUrl}`);
    console.error(`User: ${req.session?.user?.name || 'Not logged in'}`);
    console.error(`Role: ${req.session?.user?.role || 'None'}`);
    return res.status(403).json({
      success: false,
      error: "Access denied. Freelancer access required.",
    });
  }
  next();
};

router.get(
  "/active_job",
  requireFreelancer,
  freelancerController.getFreelancerActiveJobs
);
router.get(
  "/active_job/api",
  requireFreelancer,
  freelancerController.getFreelancerActiveJobsAPI
);
router.delete(
  "/active_job/leave/:jobId",
  requireFreelancer,
  freelancerController.leaveActiveJob
);
router.get(
  "/job_history",
  requireFreelancer,
  freelancerController.getFreelancerJobHistory
);
router.get(
  "/job_history/api",
  requireFreelancer,
  freelancerController.getFreelancerJobHistoryAPI
);
// Subscription - with rate limiter
router.get(
  "/subscription",
  requireFreelancer,
  asyncHandler(freelancerController.getSubscription)
);
router.post(
  "/upgrade_subscription",
  requireFreelancer,
  subscriptionRateLimiter,
  asyncHandler(freelancerController.upgradeSubscription)
);
router.post(
  "/downgrade_subscription",
  requireFreelancer,
  subscriptionRateLimiter,
  asyncHandler(freelancerController.downgradeSubscription)
);

// Profile and application routes
router.get(
  "/profile",
  requireFreelancer,
  freelancerController.getFreelancerProfile
);
router.post(
  "/profile/update",
  requireFreelancer,
  freelancerController.updateFreelancerProfile
);
router.post(
  "/profile/picture/upload",
  requireFreelancer,
  uploadRateLimiter,
  upload.single("profilePicture"),
  freelancerController.uploadProfilePicture
);
router.post(
  "/portfolio/image/upload",
  requireFreelancer,
  uploadRateLimiter,
  upload.single("portfolioImage"),
  freelancerController.uploadPortfolioImage
);
router.post(
  "/resume/upload",
  requireFreelancer,
  uploadRateLimiter,
  pdfUpload.single("resume"),
  freelancerController.uploadResume
);
router.post(
  "/apply/:jobId",
  requireFreelancer,
  jobApplicationRateLimiter,
  asyncHandler(freelancerController.applyForJob)
);
router.get(
  "/applications",
  requireFreelancer,
  freelancerController.getFreelancerApplications
);
router.get(
  "/cover-message/last",
  requireFreelancer,
  freelancerController.getLastCoverMessage
);

// Complaint routes
router.post(
  "/complaints",
  requireFreelancer,
  freelancerController.createComplaint
);
router.get(
  "/complaints",
  requireFreelancer,
  freelancerController.getFreelancerComplaints
);

// Payment routes
router.get(
  "/payments",
  requireFreelancer,
  freelancerController.getFreelancerPayments
);
router.get(
  "/payments/:jobId",
  requireFreelancer,
  freelancerController.getFreelancerPaymentDetails
);
router.post(
  "/payments/:jobId/milestones/:milestoneId/request",
  requireFreelancer,
  freelancerController.requestMilestonePayment
);

module.exports = router;
