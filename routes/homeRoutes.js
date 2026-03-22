const express = require("express");
const router = express.Router();
const home = require("../controllers/homeController");

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

router.get("/home", home.getHome);
router.get("/jobs/api", home.getPublicJobs);
router.get("/jobs/api/:jobId", home.getJobDetail);
router.get("/jobs/:jobId/applicants", home.getJobApplicants);
router.get("/freelancer/:freelancerId", home.getFreelancerPublicProfile);

module.exports = router;
