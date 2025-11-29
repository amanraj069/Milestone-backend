const mongoose = require('mongoose');

const BadgeSchema = new mongoose.Schema({
  title: { type: String, required: true },
  skillName: { type: String, required: true, index: true },
  description: { type: String },
  icon: { type: String },
  criteria: { type: Object, required: true }, // e.g. { type: 'pass_quiz', quizId: '...' , minPercentage: 80 }
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Badge', BadgeSchema);
