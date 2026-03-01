const express = require("express");
const moderatorController = require("../controllers/moderatorController");
const { upload } = require("../middleware/imageUpload");
const { uploadRateLimiter } = require("../middleware/rateLimiter");
const router = express.Router();

// Inline moderator authentication check (consistent with auth pattern in controllers)
// This is kept as inline middleware here for DRY principle since all moderator routes require it
const requireModerator = (req, res, next) => {
  if (!req.session?.user || req.session.user.role !== "Moderator") {
    return res.status(403).json({
      success: false,
      error: "Access denied. Moderator access required.",
    });
  }
  next();
};

// Complaint routes
router.get(
  "/complaints",
  requireModerator,
  moderatorController.getAllComplaints,
);

router.get(
  "/complaints/:complaintId",
  requireModerator,
  moderatorController.getComplaintById,
);

router.put(
  "/complaints/:complaintId",
  requireModerator,
  moderatorController.updateComplaintStatus,
);

// Profile routes
router.get(
  "/profile",
  requireModerator,
  moderatorController.getModeratorProfile,
);

router.post(
  "/profile/update",
  requireModerator,
  moderatorController.updateModeratorProfile,
);

router.post(
  "/profile/picture/upload",
  requireModerator,
  uploadRateLimiter,
  upload.single("profilePicture"),
  moderatorController.uploadProfilePicture,
);

// Dashboard statistics routes
router.get(
  "/dashboard/stats",
  requireModerator,
  moderatorController.getDashboardStats,
);

router.get(
  "/dashboard/activities",
  requireModerator,
  moderatorController.getRecentActivities,
);

// Moderator quiz management (mounted at /api/moderator/quizzes)
const moderatorQuizRoutes = require("./moderatorQuizRoutes");
router.use("/quizzes", requireModerator, moderatorQuizRoutes);

// Freelancer routes
router.get(
  "/freelancers",
  requireModerator,
  moderatorController.getAllFreelancers,
);

router.get(
  "/freelancers/:freelancerId/applications",
  requireModerator,
  moderatorController.getFreelancerApplications,
);

router.delete(
  "/freelancers/:freelancerId",
  requireModerator,
  moderatorController.deleteFreelancer,
);

// Employer routes
router.get("/employers", requireModerator, moderatorController.getAllEmployers);

router.get(
  "/employers/:employerId/job-listings",
  requireModerator,
  moderatorController.getEmployerJobListings,
);

router.delete(
  "/employers/:employerId",
  requireModerator,
  moderatorController.deleteEmployer,
);

// Job Listing routes
router.get("/jobs", requireModerator, moderatorController.getAllJobListings);

router.get(
  "/jobs/:jobId/applicants",
  requireModerator,
  moderatorController.getJobApplicants,
);

router.delete(
  "/jobs/:jobId",
  requireModerator,
  moderatorController.deleteJobListing,
);

// Rating adjustment routes
router.put(
  "/users/:targetUserId/rating",
  requireModerator,
  moderatorController.adjustUserRating,
);

router.get(
  "/users/:userId/rating-history",
  requireModerator,
  moderatorController.getRatingAuditHistory,
);

router.post(
  "/users/:userId/revert-rating",
  requireModerator,
  moderatorController.revertToCalculatedRating,
);

module.exports = router;
