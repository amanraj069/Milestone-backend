const express = require("express");
const router = express.Router();
const {
  cacheMiddleware,
  invalidateCacheMiddleware,
} = require("../middleware/cacheMiddleware");

// Invalidate question caches on mutations
router.use(invalidateCacheMiddleware("api/questions"));
const {
  getJobQuestions,
  postQuestion,
  postAnswer,
  canAnswerQuestions,
} = require("../controllers/questionController");

/**
 * @swagger
 * tags:
 *   - name: Questions
 *     description: Job Q&A - questions and answers
 *
 * /api/questions/job/{jobId}:
 *   get:
 *     summary: Get all questions for a job
 *     tags: [Questions]
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Questions returned
 *       404:
 *         description: Job not found
 *   post:
 *     summary: Post a new question for a job
 *     tags: [Questions]
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
 *             required: [question]
 *             properties:
 *               question:
 *                 type: string
 *     responses:
 *       201:
 *         description: Question posted
 *       400:
 *         description: Validation error
 *
 * /api/questions/job/{jobId}/can-answer:
 *   get:
 *     summary: Check if user can answer questions for a job
 *     tags: [Questions]
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
 * /api/questions/{questionId}/answer:
 *   post:
 *     summary: Post an answer to a question
 *     tags: [Questions]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: questionId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [answer]
 *             properties:
 *               answer:
 *                 type: string
 *     responses:
 *       200:
 *         description: Answer posted
 *       404:
 *         description: Question not found
 */

// Get all questions for a job
router.get("/job/:jobId", cacheMiddleware(300), getJobQuestions);

// Check if user can answer questions for a job
router.get("/job/:jobId/can-answer", cacheMiddleware(300), canAnswerQuestions);

// Post a new question for a job
router.post("/job/:jobId", postQuestion);

// Post an answer to a question
router.post("/:questionId/answer", postAnswer);

module.exports = router;
