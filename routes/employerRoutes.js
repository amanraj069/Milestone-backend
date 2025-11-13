const express = require("express");
const router = express.Router();
const employerController = require("../controllers/employerController");

// Middleware to check if user is authenticated and is an employer
const requireEmployer = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== "Employer") {
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

// Job Applications
router.get(
  "/job_applications",
  requireEmployer,
  employerController.getJobApplications
);
router.get(
  "/job_applications/api/data",
  requireEmployer,
  employerController.getJobApplicationsAPI
);
router.post(
  "/job_applications/:applicationId/accept",
  requireEmployer,
  employerController.acceptJobApplication
);
router.post(
  "/job_applications/:applicationId/reject",
  requireEmployer,
  employerController.rejectJobApplication
);

// Subscription
router.get(
  "/subscription",
  requireEmployer,
  employerController.getSubscription
);
router.post(
  "/subscription/purchase",
  requireEmployer,
  employerController.purchaseSubscription
);
router.post(
  "/upgrade_subscription",
  requireEmployer,
  employerController.upgradeSubscription
);
router.post(
  "/downgrade_subscription",
  requireEmployer,
  employerController.downgradeSubscription
);

// Current Freelancers and Work History
router.get(
  "/current-freelancers",
  requireEmployer,
  employerController.getCurrentFreelancers
);
router.get(
  "/work-history",
  requireEmployer,
  employerController.getWorkHistory
);
router.post(
  "/rate-freelancer/:jobId",
  requireEmployer,
  employerController.rateFreelancer
);

module.exports = router;