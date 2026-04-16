const express = require("express");
const moderatorController = require("../controllers/moderatorController");
const { upload } = require("../middleware/imageUpload");
const { uploadRateLimiter } = require("../middleware/rateLimiter");
const router = express.Router();
const {
  cacheMiddleware,
  invalidateCacheMiddleware,
} = require("../middleware/cacheMiddleware");

// Invalidate moderator caches on mutations
router.use(invalidateCacheMiddleware("api/moderator"));

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

/**
 * @swagger
 * tags:
 *   - name: Moderator
 *     description: Moderator operations (requires Moderator role)
 *
 * /api/moderator/complaints:
 *   get:
 *     summary: Get all complaints
 *     tags: [Moderator]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Complaints returned
 *       403:
 *         description: Access denied
 *
 * /api/moderator/complaints/{complaintId}:
 *   get:
 *     summary: Get a complaint by ID
 *     tags: [Moderator]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: complaintId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Complaint details returned
 *       404:
 *         description: Complaint not found
 *   put:
 *     summary: Update complaint status
 *     tags: [Moderator]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: complaintId
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
 *               status:
 *                 type: string
 *               resolution:
 *                 type: string
 *     responses:
 *       200:
 *         description: Complaint updated
 *       404:
 *         description: Complaint not found
 *
 * /api/moderator/profile:
 *   get:
 *     summary: Get moderator profile
 *     tags: [Moderator]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Profile returned
 *
 * /api/moderator/profile/update:
 *   post:
 *     summary: Update moderator profile
 *     tags: [Moderator]
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
 * /api/moderator/profile/picture/upload:
 *   post:
 *     summary: Upload moderator profile picture
 *     tags: [Moderator]
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
 * /api/moderator/dashboard/stats:
 *   get:
 *     summary: Get moderator dashboard statistics
 *     tags: [Moderator]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Dashboard stats returned
 *
 * /api/moderator/dashboard/activities:
 *   get:
 *     summary: Get recent moderator activities
 *     tags: [Moderator]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Activities returned
 *
 * /api/moderator/freelancers:
 *   get:
 *     summary: Get all freelancers
 *     tags: [Moderator]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Freelancers list returned
 *
 * /api/moderator/freelancers/{freelancerId}/applications:
 *   get:
 *     summary: Get applications for a freelancer
 *     tags: [Moderator]
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
 *         description: Applications returned
 *
 * /api/moderator/freelancers/{freelancerId}:
 *   delete:
 *     summary: Delete a freelancer
 *     tags: [Moderator]
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
 *         description: Freelancer deleted
 *       404:
 *         description: Freelancer not found
 *
 * /api/moderator/employers:
 *   get:
 *     summary: Get all employers
 *     tags: [Moderator]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Employers list returned
 *
 * /api/moderator/employers/{employerId}/job-listings:
 *   get:
 *     summary: Get job listings for an employer
 *     tags: [Moderator]
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
 *         description: Job listings returned
 *
 * /api/moderator/employers/{employerId}:
 *   delete:
 *     summary: Delete an employer
 *     tags: [Moderator]
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
 *         description: Employer deleted
 *       404:
 *         description: Employer not found
 *
 * /api/moderator/jobs:
 *   get:
 *     summary: Get all job listings
 *     tags: [Moderator]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Job listings returned
 *
 * /api/moderator/jobs/{jobId}/applicants:
 *   get:
 *     summary: Get applicants for a job
 *     tags: [Moderator]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Applicants returned
 *
 * /api/moderator/jobs/{jobId}:
 *   delete:
 *     summary: Delete a job listing
 *     tags: [Moderator]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Job deleted
 *       404:
 *         description: Job not found
 *
 * /api/moderator/approvals/pending:
 *   get:
 *     summary: Get pending employer approvals
 *     tags: [Moderator]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Pending approvals returned
 *
 * /api/moderator/approvals/{userId}/approve:
 *   post:
 *     summary: Approve an employer
 *     tags: [Moderator]
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
 *         description: Employer approved
 *       404:
 *         description: User not found
 *
 * /api/moderator/approvals/{userId}/reject:
 *   post:
 *     summary: Reject an employer
 *     tags: [Moderator]
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
 *         description: Employer rejected
 *       404:
 *         description: User not found
 *
 * /api/moderator/users/{targetUserId}/rating:
 *   put:
 *     summary: Adjust a user's rating
 *     tags: [Moderator]
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
 * /api/moderator/users/{userId}/rating-history:
 *   get:
 *     summary: Get rating audit history for a user
 *     tags: [Moderator]
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
 * /api/moderator/users/{userId}/revert-rating:
 *   post:
 *     summary: Revert user to calculated rating
 *     tags: [Moderator]
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
 */

// Complaint routes
router.get(
  "/complaints",
  requireModerator,
  cacheMiddleware(300),
  moderatorController.getAllComplaints
);

router.get(
  "/complaints/:complaintId",
  requireModerator,
  cacheMiddleware(300),
  moderatorController.getComplaintById
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
  cacheMiddleware(300),
  moderatorController.getModeratorProfile
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
  cacheMiddleware(300),
  moderatorController.getDashboardStats
);

router.get(
  "/dashboard/activities",
  requireModerator,
  cacheMiddleware(300),
  moderatorController.getRecentActivities
);

// Moderator quiz management (mounted at /api/moderator/quizzes)
const moderatorQuizRoutes = require("./moderatorQuizRoutes");
router.use("/quizzes", requireModerator, moderatorQuizRoutes);

// Freelancer routes
router.get(
  "/freelancers",
  requireModerator,
  cacheMiddleware(300),
  moderatorController.getAllFreelancers
);

router.get(
  "/freelancers/:freelancerId/applications",
  requireModerator,
  cacheMiddleware(300),
  moderatorController.getFreelancerApplications
);

router.delete(
  "/freelancers/:freelancerId",
  requireModerator,
  moderatorController.deleteFreelancer,
);

// Employer routes
router.get(
  "/employers",
  requireModerator,
  cacheMiddleware(300),
  moderatorController.getAllEmployers
);

router.get(
  "/employers/:employerId/job-listings",
  requireModerator,
  cacheMiddleware(300),
  moderatorController.getEmployerJobListings
);

router.delete(
  "/employers/:employerId",
  requireModerator,
  moderatorController.deleteEmployer,
);

// Job Listing routes
router.get(
  "/jobs",
  requireModerator,
  cacheMiddleware(300),
  moderatorController.getAllJobListings
);

router.get(
  "/jobs/:jobId/applicants",
  requireModerator,
  cacheMiddleware(300),
  moderatorController.getJobApplicants
);

router.delete(
  "/jobs/:jobId",
  requireModerator,
  moderatorController.deleteJobListing,
);

// Employer Approval routes
router.get(
  "/approvals/pending",
  requireModerator,
  cacheMiddleware(300),
  moderatorController.getPendingApprovals
);

router.post(
  "/approvals/:userId/approve",
  requireModerator,
  moderatorController.approveEmployer,
);

router.post(
  "/approvals/:userId/reject",
  requireModerator,
  moderatorController.rejectEmployer,
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
  cacheMiddleware(300),
  moderatorController.getRatingAuditHistory
);

router.post(
  "/users/:userId/revert-rating",
  requireModerator,
  moderatorController.revertToCalculatedRating,
);

module.exports = router;
