const express = require("express");
const router = express.Router();
const home = require("../controllers/homeController");
const { cacheMiddleware } = require("../middleware/cacheMiddleware");

/**
 * @swagger
 * tags:
 *   - name: Home
 *     description: Public home and job browsing endpoints
 *
 * /api/home:
 *   get:
 *     summary: Get home page data
 *     tags: [Home]
 *     responses:
 *       200:
 *         description: Home page data returned
 *       500:
 *         description: Server error
 *
 * /api/jobs/api:
 *   get:
 *     summary: Get public job listings
 *     tags: [Home]
 *     responses:
 *       200:
 *         description: List of public jobs
 *       500:
 *         description: Server error
 *
 * /api/jobs/api/{jobId}:
 *   get:
 *     summary: Get public job details
 *     tags: [Home]
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Job details returned
 *       404:
 *         description: Job not found
 *
 * /api/jobs/{jobId}/applicants:
 *   get:
 *     summary: Get applicants for a job
 *     tags: [Home]
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of applicants
 *       404:
 *         description: Job not found
 *
 * /api/freelancer/{freelancerId}:
 *   get:
 *     summary: Get freelancer public profile
 *     tags: [Home]
 *     parameters:
 *       - in: path
 *         name: freelancerId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Public freelancer profile returned
 *       404:
 *         description: Freelancer not found
 */

router.get("/home", cacheMiddleware(120), home.getHome);
router.get("/geocode", cacheMiddleware(3600), home.geocode); // Geocode results rarely change
router.get("/geocode/reverse", cacheMiddleware(3600), home.reverseGeocode);
router.get("/jobs/api", cacheMiddleware(120), home.getPublicJobs);
router.get("/jobs/api/:jobId", cacheMiddleware(120), home.getJobDetail);
router.get(
  "/jobs/:jobId/applicants",
  cacheMiddleware(60),
  home.getJobApplicants
); // Applicants change frequently
router.get(
  "/freelancer/:freelancerId",
  cacheMiddleware(300),
  home.getFreelancerPublicProfile
);

module.exports = router;
