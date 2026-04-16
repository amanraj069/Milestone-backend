const express = require("express");
const quizController = require("../controllers/quizController");
const badgeController = require("../controllers/badgeController");
const router = express.Router();
const {
  cacheMiddleware,
  invalidateCacheMiddleware,
} = require("../middleware/cacheMiddleware");

// Invalidate quiz caches on mutations
router.use(invalidateCacheMiddleware("api/quizzes"));

/**
 * @swagger
 * tags:
 *   - name: Moderator Quiz
 *     description: Moderator quiz management (requires Moderator role)
 *
 * /api/moderator/quizzes:
 *   post:
 *     summary: Create a new quiz
 *     tags: [Moderator Quiz]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, questions]
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               category:
 *                 type: string
 *               difficulty:
 *                 type: string
 *                 enum: [Easy, Medium, Hard]
 *               timeLimit:
 *                 type: integer
 *               questions:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       201:
 *         description: Quiz created
 *       400:
 *         description: Validation error
 *   get:
 *     summary: List all quizzes (moderator)
 *     tags: [Moderator Quiz]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Quizzes listed
 *
 * /api/moderator/quizzes/{id}:
 *   get:
 *     summary: Get a quiz by ID (moderator, includes answers)
 *     tags: [Moderator Quiz]
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
 *         description: Quiz returned
 *       404:
 *         description: Quiz not found
 *   put:
 *     summary: Update a quiz
 *     tags: [Moderator Quiz]
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
 *             properties:
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               questions:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Quiz updated
 *       404:
 *         description: Quiz not found
 *   delete:
 *     summary: Delete a quiz
 *     tags: [Moderator Quiz]
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
 *         description: Quiz deleted
 *       404:
 *         description: Quiz not found
 *
 * /api/moderator/quizzes/{id}/stats:
 *   get:
 *     summary: Get quiz statistics
 *     tags: [Moderator Quiz]
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
 *         description: Quiz stats returned
 *
 * /api/moderator/quizzes/{id}/attempts:
 *   get:
 *     summary: Get detailed quiz attempts
 *     tags: [Moderator Quiz]
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
 *         description: Attempts returned
 *
 * /api/moderator/quizzes/badges:
 *   post:
 *     summary: Create a new badge
 *     tags: [Moderator Quiz]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               icon:
 *                 type: string
 *     responses:
 *       201:
 *         description: Badge created
 *
 * /api/moderator/quizzes/badges/list:
 *   get:
 *     summary: List all badges
 *     tags: [Moderator Quiz]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Badges listed
 */

// Create quiz
// Create quiz
router.post("/", quizController.createQuiz);

// List quizzes
router.get("/", cacheMiddleware(300), quizController.listQuizzes);

// Get quiz
router.get("/:id", cacheMiddleware(300), quizController.getQuiz);

// Update quiz
router.put("/:id", quizController.updateQuiz);

// Delete quiz
router.delete("/:id", quizController.deleteQuiz);

// Stats
router.get("/:id/stats", cacheMiddleware(300), quizController.getQuizStats);

// Detailed attempts
router.get("/:id/attempts", cacheMiddleware(300), quizController.getQuizAttempts);

// Badge endpoints for moderator
router.post("/badges", badgeController.createBadge);
router.get("/badges/list", cacheMiddleware(300), badgeController.listBadges);

module.exports = router;
