const mongoose = require('mongoose');

const AnswerSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
  selectedOptionIndex: { type: Number, default: null },
  awardedMarks: { type: Number, required: true }
});

const AttemptSchema = new mongoose.Schema({
  userId: { type: String, ref: 'User', index: true, required: true },
  quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
  answers: { type: [AnswerSchema], default: [] },
  totalMarks: { type: Number, required: true },
  userMarks: { type: Number, required: true },
  percentage: { type: Number, required: true },
  passed: { type: Boolean, required: true },
  attemptNumber: { type: Number, default: 1 }, // Track which attempt this is (1, 2, 3, etc.)
  violationsCount: { type: Number, default: 0 }, // Track quiz violations (tab switch, fullscreen exit, etc.)
  createdAt: { type: Date, default: Date.now }
});

// Compound index to ensure proper attempt counting per user per quiz
AttemptSchema.index({ userId: 1, quizId: 1, createdAt: -1 });

module.exports = mongoose.model('Attempt', AttemptSchema);
