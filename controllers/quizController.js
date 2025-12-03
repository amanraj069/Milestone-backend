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
    
    // Auto-create badge for this quiz
    try {
      const existingBadge = await Badge.findOne({ 'criteria.quizId': String(quiz._id) });
      if (!existingBadge) {
        const badge = new Badge({
          title: `${payload.skillName} Expert`,
          skillName: payload.skillName,
          description: `Earned by passing the ${payload.title} quiz with ${payload.passingScore || 50}% or higher`,
          // icon: '🏆',
          criteria: {
            type: 'pass_quiz',
            quizId: String(quiz._id),
            minPercentage: payload.passingScore || 50
          }
        });
        await badge.save();
        console.log('Auto-created badge for quiz:', badge.title);
      }
    } catch (badgeErr) {
      console.error('Failed to create badge:', badgeErr);
      // Don't fail quiz creation if badge creation fails
    }
    
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
    
    // Find all attempts (userId is a String UUID, not ObjectId reference)
    const attempts = await Attempt.find({ quizId })
      .sort({ createdAt: -1 });
    
    // Get all unique user IDs
    const userIds = [...new Set(attempts.map(a => a.userId))];
    
    // Fetch user details separately
    const User = require('../models/user');
    const users = await User.find({ userId: { $in: userIds } })
      .select('userId name email')
      .lean();
    
    // Create a map for quick user lookup
    const userMap = {};
    users.forEach(u => {
      userMap[u.userId] = u;
    });
    
    // Get badge info for this quiz
    const Badge = require('../models/Badge');
    const UserBadge = require('../models/UserBadge');
    const badge = await Badge.findOne({ 'criteria.quizId': quizId });
    
    // Build detailed attempt data
    const attemptDetails = await Promise.all(attempts.map(async (attempt) => {
      const user = userMap[attempt.userId];
      let badgeAwarded = false;
      if (badge && attempt.passed) {
        const userBadge = await UserBadge.findOne({ 
          userId: attempt.userId, 
          badgeId: badge._id 
        });
        badgeAwarded = !!userBadge;
      }
      
      return {
        attemptId: attempt._id,
        freelancerName: user?.name || 'Unknown User',
        email: user?.email || 'N/A',
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
    const quizzes = await Quiz.find(q).select('title skillName description timeLimitMinutes passingScore questions');
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
    // Remove isCorrect flags but keep code snippet fields
    sanitized.questions = sanitized.questions.map(q => ({
      _id: q._id,
      text: q.text,
      marks: q.marks,
      hasCode: q.hasCode,
      codeSnippet: q.codeSnippet,
      codeLanguage: q.codeLanguage,
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
    console.log('Submit attempt request received');
    console.log('Session user:', req.session.user);
    console.log('Request body:', req.body);
    
    if (!req.session.user) {
      console.log('Authentication failed - no session user');
      return res.status(401).json({ success: false, error: { message: 'Authentication required' } });
    }
    
    const quizId = req.params.id;
    const { answers, violationsCount = 0 } = req.body; // [{questionId, selectedOptionIndex}], violationsCount
    
    console.log('Quiz ID:', quizId);
    console.log('Answers received:', answers);
    console.log('Violations detected:', violationsCount);
    
    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      console.log('Quiz not found:', quizId);
      return res.status(404).json({ success: false, error: { message: 'Quiz not found' } });
    }

    // FIX: Get attempts for THIS USER only (not all users)
    const userAttempts = await Attempt.find({ userId: req.session.user.id, quizId }).sort({ createdAt: -1 });
    const attemptCount = userAttempts.length;
    console.log('Previous attempts for this user:', attemptCount);
    
    // Check user's actual subscription status
    const User = require('../models/user');
    const user = await User.findOne({ userId: req.session.user.id });
    const isPremium = user?.subscription === 'Premium' && 
                      user?.subscriptionExpiryDate && 
                      new Date(user.subscriptionExpiryDate) > new Date();
    
    console.log('User subscription check:', { 
      subscription: user?.subscription, 
      expiryDate: user?.subscriptionExpiryDate,
      isPremium 
    });
    
    const maxAttempts = isPremium ? 3 : 2; // Premium: 3 attempts, Free: 2 attempts
    const cooldownDays = isPremium ? 5 : 10; // Premium: 5 days, Free: 10 days
    
    // Check if max consecutive attempts reached
    if (attemptCount >= maxAttempts) {
      // Check cooldown period from last attempt
      const lastAttempt = userAttempts[0];
      const cooldownMs = cooldownDays * 24 * 60 * 60 * 1000;
      const timeSinceLastAttempt = Date.now() - new Date(lastAttempt.createdAt).getTime();
      
      if (timeSinceLastAttempt < cooldownMs) {
        const daysRemaining = Math.ceil((cooldownMs - timeSinceLastAttempt) / (24 * 60 * 60 * 1000));
        console.log('Cooldown period active. Days remaining:', daysRemaining);
        return res.status(400).json({ 
          success: false, 
          error: { 
            message: `You can take your next attempt after ${cooldownDays} days. Please wait ${daysRemaining} more day(s).`,
            cooldownDays,
            daysRemaining,
            nextAttemptDate: new Date(new Date(lastAttempt.createdAt).getTime() + cooldownMs)
          } 
        });
      }
      // Cooldown expired - reset attempt counter for this cooldown period
      console.log('Cooldown expired, allowing new attempt');
    }

    let totalMarks = 0;
    let userMarks = 0;
    const answerRecords = [];

    quiz.questions.forEach((question, qIndex) => {
      const qMarks = question.marks || 0;
      totalMarks += qMarks;
      const provided = answers.find(a => String(a.questionId) === String(question._id));
      const selectedIndex = provided ? provided.selectedOptionIndex : null;
      
      console.log(`Question ${qIndex + 1}:`, {
        questionId: question._id,
        selectedIndex,
        totalOptions: question.options.length,
        options: question.options.map((opt, idx) => ({
          index: idx,
          text: opt.text.substring(0, 30),
          isCorrect: opt.isCorrect
        }))
      });
      
      let awarded = 0;
      if (selectedIndex !== null && typeof selectedIndex === 'number') {
        const opt = question.options[selectedIndex];
        console.log(`Selected option at index ${selectedIndex}:`, {
          text: opt?.text?.substring(0, 30),
          isCorrect: opt?.isCorrect
        });
        if (opt && opt.isCorrect) awarded = qMarks;
      }
      userMarks += awarded;
      answerRecords.push({ questionId: question._id, selectedOptionIndex: selectedIndex, awardedMarks: awarded });
    });

    console.log('Score calculation:', { totalMarks, userMarks, answerRecords });

    // Calculate penalty: deduct passing percentage marks per violation
    const passingScore = quiz.passingScore || 50;
    const penaltyPerViolation = totalMarks; // Each violation = passing% of total marks
    const totalPenalty = violationsCount * penaltyPerViolation;
    const finalMarks = Math.max(0, userMarks - totalPenalty); // Can't go below 0
    
    console.log('Violation penalty:', { 
      violationsCount, 
      passingScore: passingScore + '%', 
      penaltyPerViolation, 
      totalPenalty, 
      originalMarks: userMarks, 
      finalMarks 
    });

    const percentage = totalMarks ? (finalMarks / totalMarks) * 100 : 0;
    const passed = percentage >= passingScore;

    console.log('Creating attempt document...');
    // Calculate current attempt number (considering cooldown resets)
    let attemptNumber = attemptCount + 1;
    if (attemptCount >= maxAttempts) {
      // This is after cooldown, so reset to 1
      attemptNumber = 1;
    }
    
    const attempt = new Attempt({ 
      userId: req.session.user.id, 
      quizId, 
      answers: answerRecords, 
      totalMarks, 
      userMarks: finalMarks, // Use final marks after penalty
      percentage, 
      passed,
      attemptNumber,
      violationsCount // Store violations count for records
    });
    
    try {
      await attempt.save();
      console.log('Attempt saved successfully with attemptNumber:', attemptNumber);
    } catch (saveError) {
      console.error('Error saving attempt:', saveError);
      throw saveError;
    }

    // Check badges and award if applicable
    const badges = await Badge.find({ 'criteria.type': 'pass_quiz', 'criteria.quizId': String(quiz._id) });
    const awardedBadges = [];
    for (const badge of badges) {
      const min = badge.criteria.minPercentage || 0;
      if (passed && percentage >= min) {
        try {
          const ub = await UserBadge.findOneAndUpdate({ userId: req.session.user.id, badgeId: badge._id }, { $setOnInsert: { awardedAt: new Date() } }, { upsert: true, new: true });
          awardedBadges.push(badge);
        } catch (e) {
          // ignore duplicate key errors
          console.log('Badge already awarded or error:', e.message);
        }
      }
    }

    console.log('Attempt submission successful');
    res.json({ success: true, data: { attempt, awardedBadges } });
  } catch (err) {
    console.error('Submit attempt error:', err);
    console.error('Error stack:', err.stack);
    res.status(500).json({ success: false, error: { message: 'Server error: ' + err.message } });
  }
};

/**
 * Check if user can attempt quiz (check cooldown)
 */
exports.checkAttemptEligibility = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ success: false, error: { message: 'Authentication required' } });
    }
    
    const quizId = req.params.id;
    const userId = req.session.user.id;
    
    // Get user's attempts for this quiz
    const userAttempts = await Attempt.find({ userId, quizId }).sort({ createdAt: -1 });
    const attemptCount = userAttempts.length;
    
    // Check user's actual subscription status
    const User = require('../models/user');
    const user = await User.findOne({ userId });
    const isPremium = user?.subscription === 'Premium' && 
                      user?.subscriptionExpiryDate && 
                      new Date(user.subscriptionExpiryDate) > new Date();
    
    const maxAttempts = isPremium ? 3 : 2;
    const cooldownDays = isPremium ? 5 : 10;
    
    // If no attempts yet, user can take quiz
    if (attemptCount === 0) {
      return res.json({ 
        success: true, 
        canAttempt: true,
        attemptsUsed: 0,
        maxAttempts,
        isPremium
      });
    }
    
    // If under max attempts, user can take quiz
    if (attemptCount < maxAttempts) {
      return res.json({ 
        success: true, 
        canAttempt: true,
        attemptsUsed: attemptCount,
        maxAttempts,
        isPremium
      });
    }
    
    // Max attempts reached - check cooldown
    const lastAttempt = userAttempts[0];
    const cooldownMs = cooldownDays * 24 * 60 * 60 * 1000;
    const timeSinceLastAttempt = Date.now() - new Date(lastAttempt.createdAt).getTime();
    
    if (timeSinceLastAttempt < cooldownMs) {
      const daysRemaining = Math.ceil((cooldownMs - timeSinceLastAttempt) / (24 * 60 * 60 * 1000));
      const hoursRemaining = Math.ceil((cooldownMs - timeSinceLastAttempt) / (60 * 60 * 1000));
      const nextAttemptDate = new Date(new Date(lastAttempt.createdAt).getTime() + cooldownMs);
      
      return res.json({ 
        success: true, 
        canAttempt: false,
        attemptsUsed: attemptCount,
        maxAttempts,
        cooldownActive: true,
        cooldownDays,
        daysRemaining,
        hoursRemaining,
        nextAttemptDate,
        lastAttemptDate: lastAttempt.createdAt,
        isPremium
      });
    }
    
    // Cooldown expired - user can attempt again
    return res.json({ 
      success: true, 
      canAttempt: true,
      attemptsUsed: attemptCount,
      maxAttempts,
      cooldownExpired: true,
      isPremium
    });
  } catch (err) {
    console.error('Check attempt eligibility error:', err);
    res.status(500).json({ success: false, error: { message: 'Server error' } });
  }
};

/**
 * List attempts for a user (self)
 */
exports.listUserAttempts = async (req, res) => {
  try {
    const userId = req.params.userId;
    if (!req.session.user || String(req.session.user.id) !== String(userId)) return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
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
    if (!req.session.user || String(req.session.user.id) !== String(userId)) return res.status(403).json({ success: false, error: { message: 'Forbidden' } });
    const userBadges = await UserBadge.find({ userId }).populate('badgeId');
    res.json({ success: true, data: userBadges.map(ub => ({ badge: ub.badgeId, awardedAt: ub.awardedAt })) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: { message: 'Server error' } });
  }
};
