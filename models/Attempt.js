const mongoose = require('mongoose');

const AnswerSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
  selectedOptionIndex: { type: Number, default: null },
  awardedMarks: { type: Number, required: true }
});

const ViolationSchema = new mongoose.Schema({
  type: { type: String, required: true }, // tab_switch, fullscreen_exit, window_blur, copy_attempt, devtools_open
  timestamp: { type: Date, default: Date.now }
}, { _id: false });

const AttemptSchema = new mongoose.Schema({
  userId: { type: String, ref: 'User', index: true, required: true },
  quizId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
  answers: { type: [AnswerSchema], default: [] },
  totalMarks: { type: Number, default: 0 },
  userMarks: { type: Number, default: 0 },
  percentage: { type: Number, default: 0 },
  passed: { type: Boolean, default: false },
  attemptNumber: { type: Number, default: 1 },
  // Server-side violation tracking
  violations: { type: [ViolationSchema], default: [] },
  violationsCount: { type: Number, default: 0 },
  // Attempt lifecycle
  status: { type: String, enum: ['in_progress', 'submitted', 'auto_terminated', 'timed_out'], default: 'in_progress' },
  startedAt: { type: Date, default: Date.now },
  submittedAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

// Compound index to ensure proper attempt counting per user per quiz
AttemptSchema.index({ userId: 1, quizId: 1, createdAt: -1 });

module.exports = mongoose.model('Attempt', AttemptSchema);
