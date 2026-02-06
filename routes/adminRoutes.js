const express = require("express");
const adminController = require("../controllers/adminController");
const { upload } = require("../middleware/imageUpload");
const router = express.Router();

// Inline admin authentication check (consistent with auth pattern in controllers)
// This is kept as inline middleware here for DRY principle since all admin routes require it
const requireAdmin = (req, res, next) => {
  if (!req.session?.user || req.session.user.role !== "Admin") {
    return res.status(403).json({
      success: false,
      error: "Access denied. Admin access required.",
    });
  }
  next();
};

// Complaint routes
router.get(
  "/complaints",
  requireAdmin,
  adminController.getAllComplaints
);

router.get(
  "/complaints/:complaintId",
  requireAdmin,
  adminController.getComplaintById
);

router.put(
  "/complaints/:complaintId",
  requireAdmin,
  adminController.updateComplaintStatus
);

// Profile routes
router.get(
  "/profile",
  requireAdmin,
  adminController.getAdminProfile
);

router.post(
  "/profile/update",
  requireAdmin,
  adminController.updateAdminProfile
);

router.post(
  "/profile/picture/upload",
  requireAdmin,
  upload.single("profilePicture"),
  adminController.uploadProfilePicture
);

// Dashboard statistics routes
router.get(
  "/dashboard/stats",
  requireAdmin,
  adminController.getDashboardStats
);

router.get(
  "/dashboard/activities",
  requireAdmin,
  adminController.getRecentActivities
);

// Admin quiz management (mounted at /api/admin/quizzes)
const adminQuizRoutes = require('./adminQuizRoutes');
router.use('/quizzes', requireAdmin, adminQuizRoutes);

// Freelancer routes
router.get(
  "/freelancers",
  requireAdmin,
  adminController.getAllFreelancers
);

router.delete(
  "/freelancers/:freelancerId",
  requireAdmin,
  adminController.deleteFreelancer
);

// Employer routes
router.get(
  "/employers",
  requireAdmin,
  adminController.getAllEmployers
);

router.delete(
  "/employers/:employerId",
  requireAdmin,
  adminController.deleteEmployer
);

// Job Listing routes
router.get(
  "/jobs",
  requireAdmin,
  adminController.getAllJobListings
);

router.delete(
  "/jobs/:jobId",
  requireAdmin,
  adminController.deleteJobListing
);

module.exports = router;
