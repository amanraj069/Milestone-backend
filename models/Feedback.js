const mongoose = require('mongoose');

const FeedbackSchema = new mongoose.Schema({
  feedbackId: {
    type: String,
    default: () => new mongoose.Types.ObjectId().toString(),
    unique: true,
    required: true
  },
  jobId: {
    type: String,
    required: true,
    index: true
  },
  fromUserId: {
    type: String,
    required: true,
    index: true
  },
  toUserId: {
    type: String,
    required: true,
    index: true
  },
  toRole: {
    type: String,
    enum: ['Freelancer', 'Employer'],
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    maxlength: 1000,
    trim: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  anonymous: {
    type: Boolean,
    default: false
  },
  attachments: [{
    url: String,
    filename: String
  }]
}, {
  timestamps: true
});

// Compound index to prevent duplicate feedback from same user for same job
FeedbackSchema.index({ jobId: 1, fromUserId: 1 }, { unique: true });

// Index for efficient stats queries
FeedbackSchema.index({ toUserId: 1, rating: 1 });

module.exports = mongoose.model('Feedback', FeedbackSchema);
