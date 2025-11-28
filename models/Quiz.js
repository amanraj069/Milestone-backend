const mongoose = require('mongoose');

const OptionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  // isCorrect should NOT be exposed to quiz takers
  isCorrect: { type: Boolean, default: false }
});

const QuestionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  marks: { type: Number, default: 1 },
  options: { type: [OptionSchema], validate: v => Array.isArray(v) && v.length >= 2 && v.length <= 6 }
});

const QuizSchema = new mongoose.Schema({
  title: { type: String, required: true },
  skillName: { type: String, required: true, index: true },
  description: { type: String },
  timeLimitMinutes: { type: Number },
  passingScore: { type: Number, default: 50 },
  questions: { type: [QuestionSchema], default: [] },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Quiz', QuizSchema);
