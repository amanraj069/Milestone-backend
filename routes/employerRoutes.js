const express = require("express");
const router = express.Router();
const {
  cacheMiddleware,
  invalidateCacheMiddleware,
} = require("../middleware/cacheMiddleware");

// Invalidate employer caches on mutations
router.use(invalidateCacheMiddleware("api/employer"));
const employerController = require("../controllers/employerController");
const { upload, uploadLocalImage } = require("../middleware/imageUpload");
const { upload: uploadPdf, uploadCloud: uploadPdfCloud, uploadVerification } = require("../middleware/pdfUpload");
const { subscriptionRateLimiter, jobApplicationRateLimiter, uploadRateLimiter, jobPostingLimiter } = require("../middleware/rateLimiter");
const asyncHandler = require("../middleware/asyncHandler");

// Middleware to check if user is authenticated and is an employer
const requireEmployer = (req, res, next) => {
  console.log("Session user:", req.session.user);
  console.log("Session role:", req.session.user?.role);
  if (!req.session.user || req.session.user.role !== "Employer") {
    console.log("Access denied for employer route");
    console.error("UNAUTHORIZED ACCESS ATTEMPT - EMPLOYER ROUTE");
    console.error(`Path: ${req.method} ${req.originalUrl}`);
    console.error(`User: ${req.session?.user?.name || "Not logged in"}`);
    console.error(`Role: ${req.session?.user?.role || "None"}`);
    return res.status(403).json({
      success: false,
      error: "Access denied. Employer access required.",
    });
  }
  next();
};

/**
 * @swagger
 * tags:
 *   - name: Employer
 *     description: Employer operations (requires Employer role)
 *
 * /api/employer/job-listings:
 *   get:
 *     summary: Get all job listings for the employer
 *     tags: [Employer]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Job listings returned
 *       403:
 *         description: Access denied
 *   post:
 *     summary: Create a new job listing
 *     tags: [Employer]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, description, budget]
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               budget:
 *                 type: number
 *               skills:
 *                 type: array
 *                 items:
 *                   type: string
 *               duration:
 *                 type: string
 *               jobType:
 *                 type: string
 *     responses:
 *       201:
 *         description: Job listing created
 *       400:
 *         description: Validation error
 *       429:
 *         description: Too many requests
 *
 * /api/employer/job-listings/fee-preview:
 *   get:
 *     summary: Preview fees for a job listing
 *     tags: [Employer]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Fee preview returned
 *
 * /api/employer/job-listings/{jobId}:
 *   get:
 *     summary: Get a specific job listing by ID
 *     tags: [Employer]
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
 *         description: Job listing returned
 *       404:
 *         description: Job not found
 *   put:
 *     summary: Update a job listing
 *     tags: [Employer]
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
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               budget:
 *                 type: number
 *               skills:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Job listing updated
 *       404:
 *         description: Job not found
 *   delete:
 *     summary: Delete a job listing
 *     tags: [Employer]
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
 *         description: Job listing deleted
 *       404:
 *         description: Job not found
 *
 * /api/employer/job-listings/{jobId}/boost:
 *   post:
 *     summary: Boost a job listing
 *     tags: [Employer]
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
 *         description: Job boosted successfully
 *       404:
 *         description: Job not found
 *
 * /api/employer/job_applications:
 *   get:
 *     summary: Get all job applications
 *     tags: [Employer]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Job applications returned
 *
 * /api/employer/job_applications/pending-count:
 *   get:
 *     summary: Get pending applications count
 *     tags: [Employer]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Pending count returned
 *
 * /api/employer/job_applications/{applicationId}/accept:
 *   post:
 *     summary: Accept a job application
 *     tags: [Employer]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Application accepted
 *       404:
 *         description: Application not found
 *       429:
 *         description: Too many requests
 *
 * /api/employer/job_applications/{applicationId}/reject:
 *   post:
 *     summary: Reject a job application
 *     tags: [Employer]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: applicationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Application rejected
 *       404:
 *         description: Application not found
 *       429:
 *         description: Too many requests
 *
 * /api/employer/subscription:
 *   get:
 *     summary: Get employer subscription details
 *     tags: [Employer]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Subscription details returned
 *
 * /api/employer/subscription/purchase:
 *   post:
 *     summary: Purchase a subscription
 *     tags: [Employer]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               plan:
 *                 type: string
 *               duration:
 *                 type: integer
 *               paymentDetails:
 *                 type: object
 *     responses:
 *       200:
 *         description: Subscription purchased
 *       429:
 *         description: Too many requests
 *
 * /api/employer/upgrade_subscription:
 *   post:
 *     summary: Upgrade employer subscription
 *     tags: [Employer]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Subscription upgraded
 *       429:
 *         description: Too many requests
 *
 * /api/employer/downgrade_subscription:
 *   post:
 *     summary: Downgrade employer subscription
 *     tags: [Employer]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Subscription downgraded
 *       429:
 *         description: Too many requests
 *
 * /api/employer/current-freelancers:
 *   get:
 *     summary: Get currently hired freelancers
 *     tags: [Employer]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Current freelancers returned
 *
 * /api/employer/work-history:
 *   get:
 *     summary: Get employer work history
 *     tags: [Employer]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Work history returned
 *
 * /api/employer/complaints:
 *   post:
 *     summary: Create employer complaint
 *     tags: [Employer]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [freelancerId, subject, description]
 *             properties:
 *               freelancerId:
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
 *     summary: Get employer complaints
 *     tags: [Employer]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Complaints returned
 *
 * /api/employer/profile:
 *   get:
 *     summary: Get employer profile
 *     tags: [Employer]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Profile returned
 *   put:
 *     summary: Update employer profile
 *     tags: [Employer]
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
 *     responses:
 *       200:
 *         description: Profile updated
 *
 * /api/employer/upload-image:
 *   post:
 *     summary: Upload employer profile image
 *     tags: [Employer]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [picture]
 *             properties:
 *               picture:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Image uploaded
 *       400:
 *         description: File missing or invalid
 *       429:
 *         description: Too many requests
 *
 * /api/employer/company-details:
 *   get:
 *     summary: Get employer company details
 *     tags: [Employer]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Company details returned
 *   put:
 *     summary: Update employer company details
 *     tags: [Employer]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               companyName:
 *                 type: string
 *               companyWebsite:
 *                 type: string
 *               companySize:
 *                 type: string
 *               industry:
 *                 type: string
 *               companyDescription:
 *                 type: string
 *     responses:
 *       200:
 *         description: Company details updated
 *
 * /api/employer/company-details/logo/upload:
 *   post:
 *     summary: Upload company logo
 *     tags: [Employer]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [companyLogo]
 *             properties:
 *               companyLogo:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Logo uploaded
 *       429:
 *         description: Too many requests
 *
 * /api/employer/company-details/proof/upload:
 *   post:
 *     summary: Upload company proof document
 *     tags: [Employer]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [proofDocument]
 *             properties:
 *               proofDocument:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Proof document uploaded
 *       429:
 *         description: Too many requests
 *
 * /api/employer/dashboard/stats:
 *   get:
 *     summary: Get employer dashboard statistics
 *     tags: [Employer]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Dashboard stats returned
 *
 * /api/employer/transactions:
 *   get:
 *     summary: Get employer transactions
 *     tags: [Employer]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Transactions returned
 *
 * /api/employer/transactions/{jobId}:
 *   get:
 *     summary: Get transaction details for a job
 *     tags: [Employer]
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
 *         description: Transaction details returned
 *       404:
 *         description: Job not found
 *
 * /api/employer/transactions/{jobId}/milestones/{milestoneId}/pay:
 *   post:
 *     summary: Pay a milestone
 *     tags: [Employer]
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
 *         description: Milestone paid
 *       404:
 *         description: Job or milestone not found
 */

// Job listing routes
router.get(
  "/job-listings",
  requireEmployer,
  cacheMiddleware(300),
  employerController.getJobListings
);
router.get(
  "/job-listings/fee-preview",
  requireEmployer,
  cacheMiddleware(300),
  employerController.getFeePreview
);
router.post(
  "/job-listings",
  requireEmployer,
  jobPostingLimiter,
  employerController.createJobListing,
);
router.put(
  "/job-listings/:jobId",
  requireEmployer,
  employerController.updateJobListing,
);
router.delete(
  "/job-listings/:jobId",
  requireEmployer,
  employerController.deleteJobListing,
);
router.get(
  "/job-listings/:jobId",
  requireEmployer,
  cacheMiddleware(300),
  employerController.getJobById
);
router.post(
  "/job-listings/:jobId/boost",
  requireEmployer,
  employerController.boostJobListing,
);

// Job Applications - with rate limiter
router.get(
  "/job_applications",
  requireEmployer,
  cacheMiddleware(300),
  asyncHandler(employerController.getJobApplications)
);
router.get(
  "/job_applications/pending-count",
  requireEmployer,
  cacheMiddleware(300),
  asyncHandler(employerController.getPendingApplicationsCount)
);
router.post(
  "/job_applications/:applicationId/accept",
  requireEmployer,
  jobApplicationRateLimiter,
  asyncHandler(employerController.acceptJobApplication),
);
router.post(
  "/job_applications/:applicationId/reject",
  requireEmployer,
  jobApplicationRateLimiter,
  asyncHandler(employerController.rejectJobApplication),
);

// Subscription - with rate limiter
router.get(
  "/subscription",
  requireEmployer,
  cacheMiddleware(300),
  asyncHandler(employerController.getSubscription)
);
router.post(
  "/subscription/purchase",
  requireEmployer,
  subscriptionRateLimiter,
  asyncHandler(employerController.purchaseSubscription),
);
router.post(
  "/upgrade_subscription",
  requireEmployer,
  subscriptionRateLimiter,
  asyncHandler(employerController.upgradeSubscription),
);
router.post(
  "/downgrade_subscription",
  requireEmployer,
  subscriptionRateLimiter,
  asyncHandler(employerController.downgradeSubscription),
);

// Current Freelancers and Work History
router.get(
  "/current-freelancers",
  requireEmployer,
  cacheMiddleware(300),
  employerController.getCurrentFreelancers
);
router.get(
  "/work-history",
  requireEmployer,
  cacheMiddleware(300),
  employerController.getWorkHistory
);

// Complaint routes
router.post("/complaints", requireEmployer, employerController.createComplaint);
router.get(
  "/complaints",
  requireEmployer,
  cacheMiddleware(300),
  employerController.getEmployerComplaints
);

// Profile routes
router.get(
  "/profile",
  requireEmployer,
  cacheMiddleware(300),
  employerController.getEmployerProfile
);
router.put(
  "/profile",
  requireEmployer,
  employerController.updateEmployerProfile,
);
router.post(
  "/upload-image",
  requireEmployer,
  uploadRateLimiter,
  upload.single("picture"),
  employerController.uploadEmployerImage
);
router.get(
  "/company-details",
  requireEmployer,
  cacheMiddleware(300),
  employerController.getEmployerCompanyDetails
);
router.put(
  "/company-details",
  requireEmployer,
  employerController.updateEmployerCompanyDetails
);
router.post(
  "/company-details/logo/upload",
  requireEmployer,
  uploadRateLimiter,
  uploadLocalImage.single("companyLogo"),
  employerController.uploadCompanyLogo
);
router.post(
  "/company-details/proof/upload",
  requireEmployer,
  uploadRateLimiter,
  uploadVerification.single("proofDocument"),
  employerController.uploadCompanyProofDocument
);

// Dashboard stats
router.get(
  "/dashboard/stats",
  requireEmployer,
  cacheMiddleware(300),
  employerController.getEmployerDashboardStats
);

// Transactions routes
router.get(
  "/transactions",
  requireEmployer,
  cacheMiddleware(300),
  employerController.getTransactions
);
router.post(
  "/transactions/:jobId/milestones/:milestoneId/pay",
  requireEmployer,
  employerController.payMilestone,
);

module.exports = router;
