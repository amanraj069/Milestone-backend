const express = require("express");
const adminController = require("../controllers/adminController");
const { upload } = require("../middleware/imageUpload");
const { uploadRateLimiter } = require("../middleware/rateLimiter");
const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Admin
 *     description: Admin dashboard and management endpoints
 *
 * /api/admin/profile:
 *   get:
 *     summary: Get admin profile
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Profile fetched
 *       403:
 *         description: Admin access required
 *
 * /api/admin/profile/update:
 *   post:
 *     summary: Update admin profile
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *               location:
 *                 type: string
 *               profileImageUrl:
 *                 type: string
 *               about:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated
 *
 * /api/admin/profile/picture/upload:
 *   post:
 *     summary: Upload admin profile picture
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [profilePicture]
 *             properties:
 *               profilePicture:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Picture uploaded
 *
 * /api/admin/dashboard/overview:
 *   get:
 *     summary: Get dashboard overview metrics
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Overview fetched
 *
 * /api/admin/dashboard/activities:
 *   get:
 *     summary: Get recent platform activities
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Activities fetched
 *
 * /api/admin/dashboard/revenue:
 *   get:
 *     summary: Get dashboard revenue analytics
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Revenue analytics fetched
 *
 * /api/admin/revenue:
 *   get:
 *     summary: Get revenue stats
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Revenue stats fetched
 *
 * /api/admin/payments:
 *   get:
 *     summary: Get all payments
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Payments fetched
 *
 * /api/admin/moderators:
 *   get:
 *     summary: List moderators
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Moderators fetched
 *
 * /api/admin/moderators/{moderatorId}/activity:
 *   get:
 *     summary: Get activity for one moderator
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: moderatorId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Moderator activity fetched
 *       404:
 *         description: Moderator not found
 *
 * /api/admin/moderators/{moderatorId}:
 *   delete:
 *     summary: Delete a moderator
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: moderatorId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Moderator deleted
 *       404:
 *         description: Moderator not found
 *
 * /api/admin/users:
 *   get:
 *     summary: List all users
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Users fetched
 *
 * /api/admin/users/{userId}:
 *   delete:
 *     summary: Delete a user
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User deleted
 *       404:
 *         description: User not found
 *
 * /api/admin/statistics:
 *   get:
 *     summary: Get platform statistics
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Platform stats fetched
 *
 * /api/admin/complaints:
 *   get:
 *     summary: Get all complaints
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Complaints fetched
 *
 * /api/admin/users/{targetUserId}/rating:
 *   put:
 *     summary: Adjust user rating
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: targetUserId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [adjustment, reason]
 *             properties:
 *               adjustment:
 *                 type: number
 *                 description: Multiple of 0.1, range -4.0 to +0.5
 *                 example: -0.5
 *               reason:
 *                 type: string
 *                 minLength: 20
 *               complaintId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Rating adjusted
 *       400:
 *         description: Validation failed
 *       404:
 *         description: User not found
 *
 * /api/admin/users/{userId}/rating-history:
 *   get:
 *     summary: Get rating adjustment history for user
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Rating history fetched
 *
 * /api/admin/users/{userId}/revert-rating:
 *   post:
 *     summary: Revert user to calculated rating
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason:
 *                 type: string
 *                 minLength: 20
 *     responses:
 *       200:
 *         description: Rating reverted
 *       400:
 *         description: Validation failed
 *       404:
 *         description: User not found
 *
 * /api/admin/freelancers:
 *   get:
 *     summary: List freelancers
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Freelancers fetched
 *
 * /api/admin/freelancers/{freelancerId}:
 *   get:
 *     summary: Get freelancer detail
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: freelancerId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Freelancer detail fetched
 *       404:
 *         description: Freelancer not found
 *
 * /api/admin/employers:
 *   get:
 *     summary: List employers
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Employers fetched
 *
 * /api/admin/employers/{employerId}:
 *   get:
 *     summary: Get employer detail
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: employerId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Employer detail fetched
 *       404:
 *         description: Employer not found
 *
 * /api/admin/jobs:
 *   get:
 *     summary: List job listings
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Jobs fetched
 *
 * /api/admin/feedbacks:
 *   get:
 *     summary: List feedback entries
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Feedback entries fetched
 */

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

/**
 * @swagger
 * tags:
 *   - name: Admin
 *     description: Admin operations (requires Admin role)
 *
 * /api/admin/profile:
 *   get:
 *     summary: Get admin profile
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Profile returned
 *       403:
 *         description: Access denied
 *
 * /api/admin/profile/update:
 *   post:
 *     summary: Update admin profile
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated
 *
 * /api/admin/profile/picture/upload:
 *   post:
 *     summary: Upload admin profile picture
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [profilePicture]
 *             properties:
 *               profilePicture:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Picture uploaded
 *       429:
 *         description: Too many requests
 *
 * /api/admin/dashboard/overview:
 *   get:
 *     summary: Get admin dashboard overview
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Overview returned
 *
 * /api/admin/dashboard/activities:
 *   get:
 *     summary: Get recent admin activities
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Activities returned
 *
 * /api/admin/dashboard/revenue:
 *   get:
 *     summary: Get dashboard revenue data
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Revenue data returned
 *
 * /api/admin/revenue:
 *   get:
 *     summary: Get revenue statistics
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Revenue stats returned
 *
 * /api/admin/payments:
 *   get:
 *     summary: Get all payments
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Payments returned
 *
 * /api/admin/moderators:
 *   get:
 *     summary: Get all moderators
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Moderators list returned
 *
 * /api/admin/moderators/{moderatorId}/activity:
 *   get:
 *     summary: Get moderator activity
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: moderatorId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Activity returned
 *
 * /api/admin/moderators/{moderatorId}:
 *   delete:
 *     summary: Delete a moderator
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: moderatorId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Moderator deleted
 *       404:
 *         description: Moderator not found
 *
 * /api/admin/users:
 *   get:
 *     summary: Get all users
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Users list returned
 *
 * /api/admin/users/{userId}:
 *   delete:
 *     summary: Delete a user
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User deleted
 *       404:
 *         description: User not found
 *
 * /api/admin/statistics:
 *   get:
 *     summary: Get platform statistics
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Statistics returned
 *
 * /api/admin/complaints:
 *   get:
 *     summary: Get all complaints
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Complaints returned
 *
 * /api/admin/users/{targetUserId}/rating:
 *   put:
 *     summary: Adjust a user's rating
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: targetUserId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               newRating:
 *                 type: number
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Rating adjusted
 *       404:
 *         description: User not found
 *
 * /api/admin/users/{userId}/rating-history:
 *   get:
 *     summary: Get rating audit history for a user
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Rating history returned
 *
 * /api/admin/users/{userId}/revert-rating:
 *   post:
 *     summary: Revert user to calculated rating
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Rating reverted
 *       404:
 *         description: User not found
 *
 * /api/admin/freelancers:
 *   get:
 *     summary: Get all freelancers
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Freelancers list returned
 *
 * /api/admin/freelancers/{freelancerId}:
 *   get:
 *     summary: Get freelancer detail
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: freelancerId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Freelancer detail returned
 *       404:
 *         description: Freelancer not found
 *
 * /api/admin/employers:
 *   get:
 *     summary: Get all employers
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Employers list returned
 *
 * /api/admin/employers/{employerId}:
 *   get:
 *     summary: Get employer detail
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: employerId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Employer detail returned
 *       404:
 *         description: Employer not found
 *
 * /api/admin/jobs:
 *   get:
 *     summary: Get all job listings
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Job listings returned
 *
 * /api/admin/feedbacks:
 *   get:
 *     summary: Get all feedbacks
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Feedbacks returned
 */

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
router.put(
  "/users/:targetUserId/rating",
  requireAdmin,
  adminController.adjustUserRating,
);
router.get(
  "/users/:userId/rating-history",
  requireAdmin,
  adminController.getRatingAuditHistory,
);
router.post(
  "/users/:userId/revert-rating",
  requireAdmin,
  adminController.revertToCalculatedRating,
);

// Freelancers & Employers
router.get("/freelancers", requireAdmin, adminController.getAllFreelancers);
router.get(
  "/freelancers/:freelancerId",
  requireAdmin,
  adminController.getFreelancerDetail,
);
router.get("/employers", requireAdmin, adminController.getAllEmployers);
router.get(
  "/employers/:employerId",
  requireAdmin,
  adminController.getEmployerDetail,
);

// Job Listings
router.get("/jobs", requireAdmin, adminController.getAllJobListings);

// Feedback
router.get("/feedbacks", requireAdmin, adminController.getAllFeedbacks);

module.exports = router;
