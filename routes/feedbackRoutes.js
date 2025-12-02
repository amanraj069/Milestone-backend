const express = require('express');
const feedbackController = require('../controllers/feedbackController');
const router = express.Router();

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
