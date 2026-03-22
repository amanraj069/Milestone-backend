const express = require('express');
const feedbackController = require('../controllers/feedbackController');
const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Feedback
 *     description: Feedback and ratings between users
 *
 * /api/feedback:
 *   post:
 *     summary: Create feedback for a job
 *     tags: [Feedback]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [jobId, targetUserId, rating]
 *             properties:
 *               jobId:
 *                 type: string
 *               targetUserId:
 *                 type: string
 *               rating:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 5
 *               comment:
 *                 type: string
 *               categories:
 *                 type: object
 *     responses:
 *       201:
 *         description: Feedback created
 *       400:
 *         description: Validation error
 *
 * /api/feedback/job/{jobId}:
 *   get:
 *     summary: Get feedbacks for a job
 *     tags: [Feedback]
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
 *         description: Feedbacks returned
 *
 * /api/feedback/user/{userId}:
 *   get:
 *     summary: Get feedbacks received by a user
 *     tags: [Feedback]
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
 *         description: Feedbacks returned
 *
 * /api/feedback/stats/{userId}:
 *   get:
 *     summary: Get feedback statistics for a user
 *     tags: [Feedback]
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
 *         description: Stats returned
 *
 * /api/feedback/can-give/{jobId}:
 *   get:
 *     summary: Check if user can give feedback for a job
 *     tags: [Feedback]
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
 *         description: Eligibility returned
 *
 * /api/feedback/public/user/{userId}:
 *   get:
 *     summary: Get public feedbacks for a user
 *     tags: [Feedback]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Public feedbacks returned
 *
 * /api/feedback/public/stats/{userId}:
 *   get:
 *     summary: Get public feedback stats for a user
 *     tags: [Feedback]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Public stats returned
 */

// Create feedback
router.post('/', feedbackController.createFeedback);

// Get feedbacks for a job
router.get('/job/:jobId', feedbackController.getFeedbacksForJob);

// Get feedbacks received by a user
router.get('/user/:userId', feedbackController.getFeedbacksForUser);

// Get feedback statistics for a user
router.get('/stats/:userId', feedbackController.getFeedbackStats);

// Check if user can give feedback for a job
router.get('/can-give/:jobId', feedbackController.canGiveFeedback);

// Public routes (no authentication required for viewing)
router.get('/public/user/:userId', feedbackController.getPublicFeedbacksForUser);
router.get('/public/stats/:userId', feedbackController.getPublicFeedbackStats);

module.exports = router;
