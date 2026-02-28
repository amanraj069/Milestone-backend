const Feedback = require('../models/Feedback');
const JobListing = require('../models/job_listing');
const User = require('../models/user');

// Create feedback
exports.createFeedback = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Please log in' });
    }

    const { jobId, toUserId, toRole, rating, comment, tags, anonymous } = req.body;

    // Validate required fields
    if (!jobId || !toUserId || !toRole || !rating) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields: jobId, toUserId, toRole, rating' 
      });
    }

    // Validate rating range
    if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      return res.status(400).json({ 
        success: false, 
        error: 'Rating must be an integer between 1 and 5' 
      });
    }

    // Validate comment length
    if (comment && comment.length > 1000) {
      return res.status(400).json({ 
        success: false, 
        error: 'Comment must be less than 1000 characters' 
      });
    }

    // Verify job exists
    const job = await JobListing.findOne({ jobId });
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    // Verify user is participant in the job
    const currentUserRoleId = req.session.user.roleId;
    const isEmployer = job.employerId === currentUserRoleId;
    const isFreelancer = job.assignedFreelancer && job.assignedFreelancer.freelancerId === currentUserRoleId;

    if (!isEmployer && !isFreelancer) {
      return res.status(403).json({ 
        success: false, 
        error: 'You are not a participant in this job' 
      });
    }

    // Verify toUserId is the counterparty
    const counterpartyRoleId = isEmployer ? job.assignedFreelancer?.freelancerId : job.employerId;
    
    // Get the userId from roleId
    const counterpartyUser = await User.findOne({ roleId: counterpartyRoleId });
    if (!counterpartyUser || counterpartyUser.userId !== toUserId) {
      return res.status(400).json({ 
        success: false, 
        error: 'Invalid recipient user' 
      });
    }

    // Check for duplicate feedback
    const existingFeedback = await Feedback.findOne({ 
      jobId, 
      fromUserId: req.session.user.id 
    });

    if (existingFeedback) {
      return res.status(400).json({ 
        success: false, 
        error: 'You have already submitted feedback for this job' 
      });
    }

    // Create feedback
    const feedback = new Feedback({
      jobId,
      fromUserId: req.session.user.id,
      toUserId,
      toRole,
      rating,
      comment: comment ? comment.trim() : '',
      tags: tags || [],
      anonymous: anonymous || false,
      attachments: []
    });

    await feedback.save();

    // Update the recipient's profile rating
    const allFeedbacksForUser = await Feedback.find({ toUserId });
    if (allFeedbacksForUser.length > 0) {
      const totalRating = allFeedbacksForUser.reduce((sum, fb) => sum + fb.rating, 0);
      const averageRating = totalRating / allFeedbacksForUser.length;
      
      // Update the user's rating in User model
      await User.findOneAndUpdate(
        { userId: toUserId },
        { rating: parseFloat(averageRating.toFixed(1)) },
        { new: true }
      );
    }

    res.status(201).json({ 
      success: true, 
      data: feedback,
      message: 'Feedback submitted successfully' 
    });

  } catch (error) {
    console.error('Error creating feedback:', error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false, 
        error: 'You have already submitted feedback for this job' 
      });
    }

    res.status(500).json({ 
      success: false, 
      error: 'Failed to submit feedback' 
    });
  }
};

// Get feedbacks for a specific job
exports.getFeedbacksForJob = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Please log in' });
    }

    const { jobId } = req.params;

    // Verify job exists and user is participant
    const job = await JobListing.findOne({ jobId });
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    const currentUserRoleId = req.session.user.roleId;
    const isParticipant = job.employerId === currentUserRoleId || 
                          (job.assignedFreelancer && job.assignedFreelancer.freelancerId === currentUserRoleId);

    if (!isParticipant && req.session.user.role !== 'Moderator') {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied' 
      });
    }

    const feedbacks = await Feedback.find({ jobId }).sort({ createdAt: -1 }).lean();

    // Populate user details for non-anonymous feedbacks
    const populatedFeedbacks = await Promise.all(feedbacks.map(async (fb) => {
      if (fb.anonymous && req.session.user.role !== 'Moderator') {
        return {
          ...fb,
          fromUser: { name: 'Anonymous' }
        };
      }
      
      const fromUser = await User.findOne({ userId: fb.fromUserId }).select('name picture').lean();
      return {
        ...fb,
        fromUser: fromUser || { name: 'Unknown User' }
      };
    }));

    res.json({ 
      success: true, 
      data: populatedFeedbacks,
      total: populatedFeedbacks.length
    });

  } catch (error) {
    console.error('Error fetching job feedbacks:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch feedbacks' 
    });
  }
};

// Get feedbacks received by a user
exports.getFeedbacksForUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const feedbacks = await Feedback.find({ toUserId: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Feedback.countDocuments({ toUserId: userId });

    // Populate user details for non-anonymous feedbacks
    const populatedFeedbacks = await Promise.all(feedbacks.map(async (fb) => {
      if (fb.anonymous) {
        return {
          ...fb,
          fromUser: { name: 'Anonymous' }
        };
      }
      
      const fromUser = await User.findOne({ userId: fb.fromUserId }).select('name picture').lean();
      return {
        ...fb,
        fromUser: fromUser || { name: 'Unknown User' }
      };
    }));

    res.json({ 
      success: true, 
      data: populatedFeedbacks,
      total,
      page,
      limit
    });

  } catch (error) {
    console.error('Error fetching user feedbacks:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch feedbacks' 
    });
  }
};

// Get feedback statistics for a user
exports.getFeedbackStats = async (req, res) => {
  try {
    const { userId } = req.params;

    const stats = await Feedback.aggregate([
      { $match: { toUserId: userId } },
      {
        $group: {
          _id: null,
          totalFeedbacks: { $sum: 1 },
          averageRating: { $avg: '$rating' },
          ratings: { $push: '$rating' }
        }
      }
    ]);

    if (stats.length === 0) {
      return res.json({ 
        success: true, 
        data: {
          totalFeedbacks: 0,
          averageRating: 0,
          ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
        }
      });
    }

    // Calculate rating distribution
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    stats[0].ratings.forEach(rating => {
      ratingDistribution[rating] = (ratingDistribution[rating] || 0) + 1;
    });

    res.json({ 
      success: true, 
      data: {
        totalFeedbacks: stats[0].totalFeedbacks,
        averageRating: Math.round(stats[0].averageRating * 10) / 10, // Round to 1 decimal
        ratingDistribution
      }
    });

  } catch (error) {
    console.error('Error fetching feedback stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch feedback statistics' 
    });
  }
};

// Get public feedbacks for a user (no auth required for viewing)
exports.getPublicFeedbacksForUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Get all feedback received by this user
    const feedbacks = await Feedback.find({ toUserId: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Feedback.countDocuments({ toUserId: userId });

    // Populate feedback with job title and user details (with anonymity)
    const populatedFeedbacks = await Promise.all(feedbacks.map(async (fb) => {
      // Get job title only (not full job details)
      const job = await JobListing.findOne({ jobId: fb.jobId }).select('title').lean();
      
      // Handle anonymity
      let fromUser = { name: 'Anonymous' };
      if (!fb.anonymous) {
        const user = await User.findOne({ userId: fb.fromUserId }).select('name picture role').lean();
        if (user) {
          fromUser = {
            name: user.name,
            picture: user.picture,
            role: user.role
          };
        }
      }

      return {
        _id: fb._id,
        rating: fb.rating,
        comment: fb.comment,
        tags: fb.tags,
        anonymous: fb.anonymous,
        jobTitle: job?.title || 'Unknown Project',
        fromUser,
        createdAt: fb.createdAt
      };
    }));

    res.json({ 
      success: true, 
      data: populatedFeedbacks,
      total,
      page,
      limit
    });

  } catch (error) {
    console.error('Error fetching public user feedbacks:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch feedbacks' 
    });
  }
};

// Get public feedback statistics for a user (no auth required)
exports.getPublicFeedbackStats = async (req, res) => {
  try {
    const { userId } = req.params;

    const stats = await Feedback.aggregate([
      { $match: { toUserId: userId } },
      {
        $group: {
          _id: null,
          totalFeedbacks: { $sum: 1 },
          averageRating: { $avg: '$rating' },
          ratings: { $push: '$rating' }
        }
      }
    ]);

    if (stats.length === 0) {
      return res.json({ 
        success: true, 
        data: {
          totalFeedbacks: 0,
          averageRating: 0,
          ratingDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
        }
      });
    }

    // Calculate rating distribution
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    stats[0].ratings.forEach(rating => {
      ratingDistribution[rating] = (ratingDistribution[rating] || 0) + 1;
    });

    res.json({ 
      success: true, 
      data: {
        totalFeedbacks: stats[0].totalFeedbacks,
        averageRating: Math.round(stats[0].averageRating * 10) / 10,
        ratingDistribution
      }
    });

  } catch (error) {
    console.error('Error fetching public feedback stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch feedback statistics' 
    });
  }
};
exports.canGiveFeedback = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { jobId } = req.params;

    // Check if job exists and is finished
    const job = await JobListing.findOne({ jobId });
    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    // Check if user is participant
    const currentUserRoleId = req.session.user.roleId;
    const isParticipant = job.employerId === currentUserRoleId || 
                          (job.assignedFreelancer && job.assignedFreelancer.freelancerId === currentUserRoleId);

    if (!isParticipant) {
      return res.json({ 
        success: true, 
        data: { canGiveFeedback: false, reason: 'Not a participant' }
      });
    }

    // Check if job is finished
    const isFinished = job.assignedFreelancer && 
                      (job.assignedFreelancer.status === 'finished' || job.assignedFreelancer.status === 'left');

    if (!isFinished) {
      return res.json({ 
        success: true, 
        data: { canGiveFeedback: false, reason: 'Job not completed' }
      });
    }

    // Check if already gave feedback
    const existingFeedback = await Feedback.findOne({ 
      jobId, 
      fromUserId: req.session.user.id 
    });

    if (existingFeedback) {
      return res.json({ 
        success: true, 
        data: { canGiveFeedback: false, reason: 'Already submitted' }
      });
    }

    // Get counterparty info
    const counterpartyRoleId = job.employerId === currentUserRoleId 
      ? job.assignedFreelancer.freelancerId 
      : job.employerId;
    
    const counterpartyUser = await User.findOne({ roleId: counterpartyRoleId }).select('userId name role').lean();

    res.json({ 
      success: true, 
      data: { 
        canGiveFeedback: true,
        counterparty: counterpartyUser ? {
          userId: counterpartyUser.userId,
          name: counterpartyUser.name,
          role: counterpartyUser.role
        } : null
      }
    });

  } catch (error) {
    console.error('Error checking feedback eligibility:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to check feedback eligibility' 
    });
  }
};
