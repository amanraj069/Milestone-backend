const express = require("express");
const adminController = require("../controllers/adminController");
const { upload } = require("../middleware/imageUpload");
const router = express.Router();

// Middleware to check if user is authenticated and is an admin
const requireAdmin = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== "Admin") {
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

module.exports = router;
