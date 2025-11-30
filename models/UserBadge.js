const mongoose = require('mongoose');

const UserBadgeSchema = new mongoose.Schema({
  userId: { type: String, ref: 'User', required: true, index: true },
  badgeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Badge', required: true },
  awardedAt: { type: Date, default: Date.now }
});

UserBadgeSchema.index({ userId: 1, badgeId: 1 }, { unique: true });

module.exports = mongoose.model('UserBadge', UserBadgeSchema);
