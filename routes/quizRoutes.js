const express = require('express');
const quizController = require('../controllers/quizController');
const router = express.Router();

// List quizzes
router.get('/', quizController.publicListQuizzes);

// Get quiz for taking (no correct answers)
router.get('/:id', quizController.getQuizForUser);

// Check attempt eligibility
router.get('/:id/eligibility', quizController.checkAttemptEligibility);

// Submit attempt
router.post('/:id/attempt', quizController.submitAttempt);

// User endpoints
router.get('/users/:userId/attempts', quizController.listUserAttempts);
router.get('/users/:userId/badges', quizController.listUserBadges);

module.exports = router;
