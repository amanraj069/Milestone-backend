const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();
const Quiz = require('../models/Quiz');
const Badge = require('../models/Badge');

describe('Quiz seed and models', () => {
  beforeAll(async () => {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/milestone_test', { useNewUrlParser: true, useUnifiedTopology: true });
    await Quiz.deleteMany({});
    await Badge.deleteMany({});
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  test('create and read a quiz and badge', async () => {
    const quiz = new Quiz({ title: 'Test Quiz', skillName: 'Test', questions: [{ text: 'Q1 question text', marks: 1, options: [{ text: 'A', isCorrect: true }, { text: 'B', isCorrect: false }] }] });
    await quiz.save();
    const badge = new Badge({ title: 'Test Badge', skillName: 'Test', criteria: { type: 'pass_quiz', quizId: String(quiz._id), minPercentage: 50 } });
    await badge.save();

    const q = await Quiz.findById(quiz._id);
    expect(q.title).toBe('Test Quiz');
    const b = await Badge.findOne({ skillName: 'Test' });
    expect(b).not.toBeNull();
  });
});
