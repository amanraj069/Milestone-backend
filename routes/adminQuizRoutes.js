const express = require('express');
const quizController = require('../controllers/quizController');
const badgeController = require('../controllers/badgeController');
const router = express.Router();

// Create quiz
// Create quiz
router.post('/', quizController.createQuiz);

// List quizzes
router.get('/', quizController.listQuizzes);

// Get quiz
router.get('/:id', quizController.getQuiz);

// Update quiz
router.put('/:id', quizController.updateQuiz);

// Delete quiz
router.delete('/:id', quizController.deleteQuiz);

// Stats
router.get('/:id/stats', quizController.getQuizStats);

// Detailed attempts
router.get('/:id/attempts', quizController.getQuizAttempts);

// Badge endpoints for admin
router.post('/badges', badgeController.createBadge);
router.get('/badges/list', badgeController.listBadges);

module.exports = router;
