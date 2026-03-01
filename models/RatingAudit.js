const mongoose = require('mongoose');

const RatingAuditSchema = new mongoose.Schema({
  auditId: {
    type: String,
    default: () => new mongoose.Types.ObjectId().toString(),
    unique: true,
    required: true
  },
  targetUserId: {
    type: String,
    required: true,
    index: true
  },
  targetUserName: {
    type: String,
    required: true
  },
  targetUserRole: {
    type: String,
    enum: ['Freelancer', 'Employer'],
    required: true
  },
  previousRating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  newRating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  adjustment: {
    type: Number,
    required: true
  },
  reason: {
    type: String,
    required: true,
    minlength: 20,
    maxlength: 500
  },
  relatedComplaintId: {
    type: String,
    default: null
  },
  adjustedBy: {
    type: String,
    required: true
  },
  adjustedByName: {
    type: String,
    required: true
  },
  adjustedByRole: {
    type: String,
    required: true
  },
  ipAddress: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: false
});

// Index for efficient queries
RatingAuditSchema.index({ targetUserId: 1, createdAt: -1 });
RatingAuditSchema.index({ adjustedBy: 1, createdAt: -1 });

module.exports = mongoose.model('RatingAudit', RatingAuditSchema);
