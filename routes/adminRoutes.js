const express = require("express");
const adminController = require("../controllers/adminController");
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

module.exports = router;
