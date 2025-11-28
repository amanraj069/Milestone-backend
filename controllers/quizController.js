// lightweight validation will be handled inline to avoid extra runtime deps
const Quiz = require('../models/Quiz');
const Attempt = require('../models/Attempt');
const Badge = require('../models/Badge');
const UserBadge = require('../models/UserBadge');

/**
 * Create a new quiz (admin)
 */
exports.createQuiz = async (req, res) => {
  try {
    const payload = req.body;
    // Basic validation
    if (!payload || typeof payload !== 'object') return res.status(400).json({ success: false, error: { message: 'Invalid payload' } });
    if (!payload.title || String(payload.title).trim().length < 3) return res.status(400).json({ success: false, error: { message: 'Title required (min 3 chars)' } });
    if (!payload.skillName || String(payload.skillName).trim().length < 2) return res.status(400).json({ success: false, error: { message: 'Skill name required' } });
    if (!Array.isArray(payload.questions) || payload.questions.length < 1) return res.status(400).json({ success: false, error: { message: 'At least one question required' } });
    const quiz = new Quiz({ ...payload, createdBy: req.session.user?._id });
    await quiz.save();
    res.json({ success: true, data: quiz });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: { message: 'Server error' } });
  }
};

/**
 * List quizzes (admin with pagination)
 */
exports.listQuizzes = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const q = {};
    if (req.query.skill) q.skillName = req.query.skill;
    const total = await Quiz.countDocuments(q);
    const quizzes = await Quiz.find(q).sort({ createdAt: -1 }).skip(skip).limit(limit);
    res.json({ success: true, data: { quizzes, total, page, limit } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: { message: 'Server error' } });
  }
};

/**
 * Get quiz detail (admin)
 */
exports.getQuiz = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ success: false, error: { message: 'Quiz not found' } });
    res.json({ success: true, data: quiz });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: { message: 'Server error' } });
  }
};

/**
 * Update quiz (admin)
 */
exports.updateQuiz = async (req, res) => {
  try {
    const updated = await Quiz.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ success: false, error: { message: 'Quiz not found' } });
    res.json({ success: true, data: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: { message: 'Server error' } });
  }
};

/**
 * Delete quiz (admin)
 */
exports.deleteQuiz = async (req, res) => {
  try {
    const removed = await Quiz.findByIdAndDelete(req.params.id);
    if (!removed) return res.status(404).json({ success: false, error: { message: 'Quiz not found' } });
    res.json({ success: true, data: removed });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: { message: 'Server error' } });
  }
};

/**
 * Admin: quiz stats
 */
exports.getQuizStats = async (req, res) => {
  try {
    const quizId = req.params.id;
    const quiz = await Quiz.findById(quizId);
    if (!quiz) return res.status(404).json({ success: false, error: { message: 'Quiz not found' } });
    const totalQuestions = quiz.questions.length;
    const totalMarks = quiz.questions.reduce((s, q) => s + (q.marks || 0), 0);
    const attempts = await Attempt.find({ quizId });
    const attemptCount = attempts.length;
    const avg = attemptCount ? attempts.reduce((s, a) => s + a.percentage, 0) / attemptCount : 0;
    const passRate = attemptCount ? (attempts.filter(a => a.passed).length / attemptCount) * 100 : 0;
    res.json({ success: true, data: { totalQuestions, totalMarks, attemptCount, avg, passRate } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: { message: 'Server error' } });
  }
};

/**
 * Admin: detailed quiz attempts with user info
 */
exports.getQuizAttempts = async (req, res) => {
  try {
    const quizId = req.params.id;
    const quiz = await Quiz.findById(quizId);
    if (!quiz) return res.status(404).json({ success: false, error: { message: 'Quiz not found' } });
    
    // Find all attempts with user details populated
    const attempts = await Attempt.find({ quizId })
      .populate('userId', 'firstName lastName email')
      .sort({ createdAt: -1 });
    
    // Get badge info for this quiz
    const Badge = require('../models/Badge');
    const UserBadge = require('../models/UserBadge');
    const badge = await Badge.findOne({ 'criteria.quizId': quizId });
    
    // Build detailed attempt data
    const attemptDetails = await Promise.all(attempts.map(async (attempt) => {
      let badgeAwarded = false;
      if (badge && attempt.passed) {
        const userBadge = await UserBadge.findOne({ 
          userId: attempt.userId._id, 
          badgeId: badge._id 
        });
        badgeAwarded = !!userBadge;
      }
      
      return {
        attemptId: attempt._id,
        freelancerName: `${attempt.userId.firstName} ${attempt.userId.lastName}`,
        email: attempt.userId.email,
        marksObtained: attempt.userMarks,
        totalMarks: attempt.totalMarks,
        percentage: attempt.percentage,
        passed: attempt.passed,
        badgeAwarded,
        attemptedAt: attempt.createdAt
      };
    }));
    
    res.json({ 
      success: true, 
      data: {
        quizTitle: quiz.title,
        skillName: quiz.skillName,
        passingScore: quiz.passingScore,
        totalAttempts: attempts.length,
        passedAttempts: attempts.filter(a => a.passed).length,
        attempts: attemptDetails
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: { message: 'Server error' } });
  }
};

/**
 * Public: list quizzes (filter by skill)
 */
exports.publicListQuizzes = async (req, res) => {
  try {
    const q = {};
    if (req.query.skill) q.skillName = req.query.skill;
    const quizzes = await Quiz.find(q).select('title skillName description timeLimitMinutes passingScore questions.createdAt');
    res.json({ success: true, data: quizzes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: { message: 'Server error' } });
  }
};

/**
 * Public: get quiz for taking (do NOT leak correct answers)
 */
exports.getQuizForUser = async (req, res) => {
  try {
    const quiz = await Quiz.findById(req.params.id);
    if (!quiz) return res.status(404).json({ success: false, error: { message: 'Quiz not found' } });
    const sanitized = quiz.toObject();
    // Remove isCorrect flags
    sanitized.questions = sanitized.questions.map(q => ({
      _id: q._id,
      text: q.text,
      marks: q.marks,
      options: q.options.map(o => ({ text: o.text }))
    }));
    res.json({ success: true, data: sanitized });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: { message: 'Server error' } });
  }
};

/**
 * Submit attempt: evaluate and store
 */
exports.submitAttempt = async (req, res) => {
  try {
    if (!req.session.user) return res.status(401).json({ success: false, error: { message: 'Authentication required' } });
    const quizId = req.params.id;
    const { answers } = req.body; // [{questionId, selectedOptionIndex}]
    const quiz = await Quiz.findById(quizId);
    if (!quiz) return res.status(404).json({ success: false, error: { message: 'Quiz not found' } });

    let totalMarks = 0;
    let userMarks = 0;
    const answerRecords = [];

    quiz.questions.forEach((question, qIndex) => {
      const qMarks = question.marks || 0;
      totalMarks += qMarks;
      const provided = answers.find(a => String(a.questionId) === String(question._id));
      const selectedIndex = provided ? provided.selectedOptionIndex : null;
      let awarded = 0;
      if (selectedIndex !== null && typeof selectedIndex === 'number') {
        const opt = question.options[selectedIndex];
        if (opt && opt.isCorrect) awarded = qMarks;
      }
      userMarks += awarded;
      answerRecords.push({ questionId: question._id, selectedOptionIndex: selectedIndex, awardedMarks: awarded });
    });

    const percentage = totalMarks ? (userMarks / totalMarks) * 100 : 0;
    const passed = percentage >= (quiz.passingScore || 50);

    const attempt = new Attempt({ userId: req.session.user._id, quizId, answers: answerRecords, totalMarks, userMarks, percentage, passed });
    await attempt.save();

    // Check badges and award if applicable
    const badges = await Badge.find({ 'criteria.type': 'pass_quiz', 'criteria.quizId': String(quiz._id) });
    const awardedBadges = [];
    for (const badge of badges) {
      const min = badge.criteria.minPercentage || 0;
      if (passed && percentage >= min) {
        try {
          const ub = await UserBadge.findOneAndUpdate({ userId: req.session.user._id, badgeId: badge._id }, { $setOnInsert: { awardedAt: new Date() } }, { upsert: true, new: true });
          awardedBadges.push(badge);
        } catch (e) {
          // ignore duplicate key errors
        }
      }
    }

    res.json({ success: true, data: { attempt, awardedBadges } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: { message: 'Server error' } });
  }
};

/**
 * List attempts for a user (self)
 */
exports.listUserAttempts = async (req, res) => {
  try {
    const userId = req.params.userId;
    if (!req.session.user || String(req.session.user._id) !== String(userId)) return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
    const attempts = await Attempt.find({ userId }).sort({ createdAt: -1 }).limit(50);
    res.json({ success: true, data: attempts });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: { message: 'Server error' } });
  }
};

/**
 * List badges for a user
 */
exports.listUserBadges = async (req, res) => {
  try {
    const userId = req.params.userId;
    if (!req.session.user || String(req.session.user._id) !== String(userId)) return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
    const userBadges = await UserBadge.find({ userId }).populate('badgeId');
    res.json({ success: true, data: userBadges.map(ub => ({ badge: ub.badgeId, awardedAt: ub.awardedAt })) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: { message: 'Server error' } });
  }
};
