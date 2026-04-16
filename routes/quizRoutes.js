const express = require("express");
const quizController = require("../controllers/quizController");
const {
  cacheMiddleware,
  invalidateCacheMiddleware,
} = require("../middleware/cacheMiddleware");
const router = express.Router();

// Invalidate quiz caches when attempts or modifications happen
router.use(invalidateCacheMiddleware("api/quizzes"));

/**
 * @swagger
 * tags:
 *   - name: Quiz
 *     description: Public quiz endpoints for users
 *
 * /api/quizzes:
 *   get:
 *     summary: List all published quizzes
 *     tags: [Quiz]
 *     responses:
 *       200:
 *         description: Quizzes listed
 *
 * /api/quizzes/{id}:
 *   get:
 *     summary: Get a quiz for taking (no correct answers)
 *     tags: [Quiz]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Quiz returned
 *       404:
 *         description: Quiz not found
 *
 * /api/quizzes/{id}/eligibility:
 *   get:
 *     summary: Check if user is eligible to attempt quiz
 *     tags: [Quiz]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Eligibility status returned
 *
 * /api/quizzes/{id}/start:
 *   post:
 *     summary: Start a quiz attempt (server-side timer)
 *     tags: [Quiz]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Attempt started
 *       400:
 *         description: Not eligible or already in progress
 *
 * /api/quizzes/report-violation:
 *   post:
 *     summary: Report a violation during an active attempt
 *     tags: [Quiz]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               attemptId:
 *                 type: string
 *               violationType:
 *                 type: string
 *     responses:
 *       200:
 *         description: Violation reported
 *
 * /api/quizzes/{id}/attempt:
 *   post:
 *     summary: Submit a quiz attempt
 *     tags: [Quiz]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [answers]
 *             properties:
 *               attemptId:
 *                 type: string
 *               answers:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Attempt submitted and scored
 *       400:
 *         description: Validation error
 *
 * /api/quizzes/users/{userId}/attempts:
 *   get:
 *     summary: List user quiz attempts
 *     tags: [Quiz]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Attempts listed
 *
 * /api/quizzes/users/{userId}/badges:
 *   get:
 *     summary: List user quiz badges
 *     tags: [Quiz]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Badges listed
 */

// List quizzes
router.get("/", cacheMiddleware(300), quizController.publicListQuizzes);

// Get quiz for taking (no correct answers)
router.get("/:id", cacheMiddleware(300), quizController.getQuizForUser);

// Check attempt eligibility
router.get(
  "/:id/eligibility",
  cacheMiddleware(60),
  quizController.checkAttemptEligibility
);

// Start a quiz attempt (server-side timer + violation tracking)
router.post("/:id/start", quizController.startAttempt);

// Report a violation during an active attempt
router.post("/report-violation", quizController.reportViolation);

// Submit attempt
router.post("/:id/attempt", quizController.submitAttempt);

// User endpoints
router.get(
  "/users/:userId/attempts",
  cacheMiddleware(60),
  quizController.listUserAttempts
);
router.get(
  "/users/:userId/badges",
  cacheMiddleware(120),
  quizController.listUserBadges
);

module.exports = router;
