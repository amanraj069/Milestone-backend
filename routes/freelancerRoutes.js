const express = require("express");
const freelancerController = require("../controllers/feelancerController");
const employerController = require("../controllers/employerController");
const { upload } = require("../middleware/imageUpload");
const { upload: pdfUpload } = require("../middleware/pdfUpload");
const router = express.Router();

// Middleware to check if user is authenticated and is a freelancer
const requireFreelancer = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== "Freelancer") {
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
router.get(
    "/subscription", 
    requireFreelancer,  
    freelancerController.getSubscription
);
router.post(
    "/upgrade_subscription", 
    requireFreelancer,
    freelancerController.upgradeSubscription
);
router.post(
    "/downgrade_subscription", 
    requireFreelancer,
    freelancerController.downgradeSubscription
);

// Profile and application routes
router.get(
    "/profile",
    requireFreelancer,
    freelancerController.getFreelancerProfile
);
router.put(
    "/profile/update",
    requireFreelancer,
    freelancerController.updateFreelancerProfile
);
router.post(
    "/resume/upload",
    requireFreelancer,
    pdfUpload.single("resume"),
    freelancerController.uploadResume
);
router.post(
    "/apply/:jobId",
    requireFreelancer,
    freelancerController.applyForJob
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

module.exports = router;