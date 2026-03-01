const express = require("express");
const adminController = require("../controllers/adminController");
const { upload } = require("../middleware/imageUpload");
const { uploadRateLimiter } = require("../middleware/rateLimiter");
const router = express.Router();

// Inline admin authentication check
const requireAdmin = (req, res, next) => {
  if (!req.session?.user || req.session.user.role !== "Admin") {
    return res.status(403).json({
      success: false,
      error: "Access denied. Admin access required.",
    });
  }
  next();
};

// Profile routes
router.get("/profile", requireAdmin, adminController.getAdminProfile);
router.post(
  "/profile/update",
  requireAdmin,
  adminController.updateAdminProfile,
);
router.post(
  "/profile/picture/upload",
  requireAdmin,
  uploadRateLimiter,
  upload.single("profilePicture"),
  adminController.uploadProfilePicture,
);

// Dashboard overview
router.get(
  "/dashboard/overview",
  requireAdmin,
  adminController.getDashboardOverview,
);
router.get(
  "/dashboard/activities",
  requireAdmin,
  adminController.getRecentActivities,
);
router.get(
  "/dashboard/revenue",
  requireAdmin,
  adminController.getDashboardRevenue,
);

// Revenue & Payments
router.get("/revenue", requireAdmin, adminController.getRevenueStats);
router.get("/payments", requireAdmin, adminController.getAllPayments);

// Moderator management
router.get("/moderators", requireAdmin, adminController.getAllModerators);
router.get(
  "/moderators/:moderatorId/activity",
  requireAdmin,
  adminController.getModeratorActivity,
);
router.delete(
  "/moderators/:moderatorId",
  requireAdmin,
  adminController.deleteModerator,
);

// All users management
router.get("/users", requireAdmin, adminController.getAllUsers);
router.delete("/users/:userId", requireAdmin, adminController.deleteUser);

// Platform statistics
router.get("/statistics", requireAdmin, adminController.getPlatformStats);

// Complaints
router.get("/complaints", requireAdmin, adminController.getAllComplaints);

// Rating Adjustments
router.put("/users/:targetUserId/rating", requireAdmin, adminController.adjustUserRating);
router.get("/users/:userId/rating-history", requireAdmin, adminController.getRatingAuditHistory);
router.post("/users/:userId/revert-rating", requireAdmin, adminController.revertToCalculatedRating);

// Freelancers & Employers
router.get("/freelancers", requireAdmin, adminController.getAllFreelancers);
router.get("/employers", requireAdmin, adminController.getAllEmployers);

// Job Listings
router.get("/jobs", requireAdmin, adminController.getAllJobListings);

// Feedback
router.get("/feedbacks", requireAdmin, adminController.getAllFeedbacks);

module.exports = router;
