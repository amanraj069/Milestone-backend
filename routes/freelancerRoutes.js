const express = require("express");
const freelancerController = require("../controllers/freelancerController");
const employerController = require("../controllers/employerController");
const { upload } = require("../middleware/imageUpload");
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
router.get(
    "/payment_success", 
    requireFreelancer, 
    freelancerController.getPaymentAnimation
);
router.post(
    "/upgrade_subscription", 
    requireFreelancer,
    freelancerController.upgradeSubscription
);

module.exports = router;