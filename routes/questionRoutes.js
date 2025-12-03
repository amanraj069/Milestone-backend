const express = require("express");
const router = express.Router();
const {
  getJobQuestions,
  postQuestion,
  postAnswer,
  canAnswerQuestions,
} = require("../controllers/questionController");

// Get all questions for a job
router.get("/job/:jobId", getJobQuestions);

// Check if user can answer questions for a job
router.get("/job/:jobId/can-answer", canAnswerQuestions);

// Post a new question for a job
router.post("/job/:jobId", postQuestion);

// Post an answer to a question
router.post("/:questionId/answer", postAnswer);

module.exports = router;
