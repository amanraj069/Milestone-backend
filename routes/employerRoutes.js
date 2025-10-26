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

module.exports = router;
