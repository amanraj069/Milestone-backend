const express = require("express");
const freelancerController = require("../controllers/feelancerController");
const employerController = require("../controllers/employerController");
const { upload } = require("../middleware/imageUpload");
const { upload: pdfUpload } = require("../middleware/pdfUpload");
const { subscriptionRateLimiter, jobApplicationRateLimiter, uploadRateLimiter } = require("../middleware/rateLimiter");
const asyncHandler = require("../middleware/asyncHandler");
const router = express.Router();
const {
  cacheMiddleware,
  invalidateCacheMiddleware,
} = require("../middleware/cacheMiddleware");

// Invalidate freelancer caches on mutations
router.use(invalidateCacheMiddleware("api/freelancer"));

/**
 * @swagger
 * tags:
 *   - name: Freelancer
 *     description: Freelancer operations
 *
 * components:
 *   securitySchemes:
 *     cookieAuth:
 *       type: apiKey
 *       in: cookie
 *       name: connect.sid
 *   schemas:
 *     BasicSuccess:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: true
 *         message:
 *           type: string
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         error:
 *           type: string
 *
 * /api/freelancer/active_job:
 *   get:
 *     summary: Render active jobs page
 *     tags: [Freelancer]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Active jobs page rendered
 *       403:
 *         description: Access denied
 *
 * /api/freelancer/active_job/api:
 *   get:
 *     summary: Get active jobs as JSON
 *     tags: [Freelancer]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Active jobs fetched
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 *
 * /api/freelancer/active_job/leave/{jobId}:
 *   delete:
 *     summary: Leave an active job
 *     tags: [Freelancer]
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
 *         description: Job left successfully
 *       404:
 *         description: Job not found or not authorized
 *
 * /api/freelancer/job_history:
 *   get:
 *     summary: Render freelancer job history page
 *     tags: [Freelancer]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Job history page rendered
 *
 * /api/freelancer/job_history/api:
 *   get:
 *     summary: Get freelancer job history as JSON
 *     tags: [Freelancer]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Job history fetched
 *       401:
 *         description: Unauthorized
 *
 * /api/freelancer/subscription:
 *   get:
 *     summary: Render subscription page
 *     tags: [Freelancer]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Subscription page rendered
 *
 * /api/freelancer/upgrade_subscription:
 *   post:
 *     summary: Upgrade subscription to Premium
 *     tags: [Freelancer]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               duration:
 *                 type: integer
 *                 example: 1
 *               paymentDetails:
 *                 type: object
 *     responses:
 *       200:
 *         description: Subscription upgraded
 *       401:
 *         description: Unauthorized
 *
 * /api/freelancer/downgrade_subscription:
 *   post:
 *     summary: Downgrade subscription to Basic
 *     tags: [Freelancer]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Subscription downgraded
 *       401:
 *         description: Unauthorized
 *
 * /api/freelancer/profile:
 *   get:
 *     summary: Get freelancer profile
 *     tags: [Freelancer]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Profile fetched
 *
 * /api/freelancer/profile/update:
 *   post:
 *     summary: Update freelancer profile
 *     tags: [Freelancer]
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
 *               location:
 *                 type: string
 *               profileImageUrl:
 *                 type: string
 *               about:
 *                 type: string
 *               resumeLink:
 *                 type: string
 *               skills:
 *                 type: array
 *                 items:
 *                   type: string
 *               experience:
 *                 type: array
 *                 items:
 *                   type: object
 *               education:
 *                 type: array
 *                 items:
 *                   type: object
 *               portfolio:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Profile updated
 *       404:
 *         description: Profile not found
 *
 * /api/freelancer/profile/picture/upload:
 *   post:
 *     summary: Upload profile picture
 *     tags: [Freelancer]
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
 *         description: Profile picture uploaded
 *       400:
 *         description: File missing or invalid
 *
 * /api/freelancer/portfolio/image/upload:
 *   post:
 *     summary: Upload portfolio image
 *     tags: [Freelancer]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [portfolioImage]
 *             properties:
 *               portfolioImage:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Portfolio image uploaded
 *
 * /api/freelancer/resume/upload:
 *   post:
 *     summary: Upload resume PDF
 *     tags: [Freelancer]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [resume]
 *             properties:
 *               resume:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Resume uploaded
 *       400:
 *         description: File missing or invalid
 *
 * /api/freelancer/apply/{jobId}:
 *   post:
 *     summary: Apply for a job
 *     tags: [Freelancer]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [coverMessage]
 *             properties:
 *               coverMessage:
 *                 type: string
 *                 example: I have 5+ years experience and can deliver this quickly with high quality output...
 *               skillRating:
 *                 type: number
 *               availability:
 *                 type: string
 *                 example: immediate
 *               contactEmail:
 *                 type: string
 *                 format: email
 *     responses:
 *       200:
 *         description: Application submitted
 *       400:
 *         description: Validation error or already applied
 *       404:
 *         description: Job or freelancer profile not found
 *
 * /api/freelancer/applications:
 *   get:
 *     summary: Get all freelancer applications
 *     tags: [Freelancer]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Applications fetched
 *
 * /api/freelancer/cover-message/last:
 *   get:
 *     summary: Get last cover message used by freelancer
 *     tags: [Freelancer]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Last cover message fetched
 *
 * /api/freelancer/complaints:
 *   post:
 *     summary: Create a complaint
 *     tags: [Freelancer]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [jobId, complaintType, subject, description]
 *             properties:
 *               jobId:
 *                 type: string
 *               complaintType:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [Low, Medium, High]
 *               subject:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Complaint created
 *       400:
 *         description: Validation error
 *   get:
 *     summary: Get freelancer complaints
 *     tags: [Freelancer]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Complaints fetched
 *
 * /api/freelancer/payments:
 *   get:
 *     summary: Get freelancer payments overview
 *     tags: [Freelancer]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Payments data fetched
 *       401:
 *         description: Unauthorized
 *
 * /api/freelancer/payments/{jobId}:
 *   get:
 *     summary: Get payment details for a job
 *     tags: [Freelancer]
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
 *         description: Payment details fetched
 *       404:
 *         description: Job not found
 *
 * /api/freelancer/payments/{jobId}/milestones/{milestoneId}/request:
 *   post:
 *     summary: Request payment for a milestone
 *     tags: [Freelancer]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: milestoneId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payment requested
 *       400:
 *         description: Already paid or already requested
 *       404:
 *         description: Job or milestone not found
 */

// Middleware to check if user is authenticated and is a freelancer
const requireFreelancer = (req, res, next) => {
  if (!req.session.user || req.session.user.role !== "Freelancer") {
    console.error('UNAUTHORIZED ACCESS ATTEMPT - FREELANCER ROUTE');
    console.error(`Path: ${req.method} ${req.originalUrl}`);
    console.error(`User: ${req.session?.user?.name || 'Not logged in'}`);
    console.error(`Role: ${req.session?.user?.role || 'None'}`);
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
  cacheMiddleware(300),
  freelancerController.getFreelancerActiveJobs
);
router.get(
  "/active_job/api",
  requireFreelancer,
  cacheMiddleware(300),
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
  cacheMiddleware(300),
  freelancerController.getFreelancerJobHistory
);
router.get(
  "/job_history/api",
  requireFreelancer,
  cacheMiddleware(300),
  freelancerController.getFreelancerJobHistoryAPI
);
// Subscription - with rate limiter
router.get(
  "/subscription",
  requireFreelancer,
  cacheMiddleware(300),
  asyncHandler(freelancerController.getSubscription)
);
router.post(
  "/upgrade_subscription",
  requireFreelancer,
  subscriptionRateLimiter,
  asyncHandler(freelancerController.upgradeSubscription)
);
router.post(
  "/downgrade_subscription",
  requireFreelancer,
  subscriptionRateLimiter,
  asyncHandler(freelancerController.downgradeSubscription)
);

// Profile and application routes
router.get(
  "/profile",
  requireFreelancer,
  cacheMiddleware(300),
  freelancerController.getFreelancerProfile
);
router.post(
  "/profile/update",
  requireFreelancer,
  freelancerController.updateFreelancerProfile
);
router.post(
  "/profile/picture/upload",
  requireFreelancer,
  uploadRateLimiter,
  upload.single("profilePicture"),
  freelancerController.uploadProfilePicture
);
router.post(
  "/portfolio/image/upload",
  requireFreelancer,
  uploadRateLimiter,
  upload.single("portfolioImage"),
  freelancerController.uploadPortfolioImage
);
router.post(
  "/resume/upload",
  requireFreelancer,
  uploadRateLimiter,
  pdfUpload.single("resume"),
  freelancerController.uploadResume
);
router.post(
  "/apply/:jobId",
  requireFreelancer,
  jobApplicationRateLimiter,
  asyncHandler(freelancerController.applyForJob)
);
router.get(
  "/applications",
  requireFreelancer,
  cacheMiddleware(300),
  freelancerController.getFreelancerApplications
);
router.get(
  "/cover-message/last",
  requireFreelancer,
  cacheMiddleware(300),
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
  cacheMiddleware(300),
  freelancerController.getFreelancerComplaints
);

// Payment routes
router.get(
  "/payments",
  requireFreelancer,
  cacheMiddleware(300),
  freelancerController.getFreelancerPayments
);
router.get(
  "/payments/:jobId",
  requireFreelancer,
  cacheMiddleware(300),
  freelancerController.getFreelancerPaymentDetails
);
router.post(
  "/payments/:jobId/milestones/:milestoneId/request",
  requireFreelancer,
  freelancerController.requestMilestonePayment
);

module.exports = router;
