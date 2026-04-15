const mongoose = require("mongoose");
const { Schema } = mongoose;
const { v4: uuidv4 } = require("uuid");

const userSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true, default: uuidv4 },
    name: { type: String, default: "" },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: { type: String, default: "" },
    otp: { type: String, default: null },
    otpExpiry: { type: Date, default: null },
    otpVerified: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
    picture: {
      type: String,
      default:
        "https://cdn.pixabay.com/photo/2018/04/18/18/56/user-3331256_1280.png",
    },
    location: { type: String, default: "" },
    socialMedia: {
      linkedin: { type: String, default: "" },
      twitter: { type: String, default: "" },
      facebook: { type: String, default: "" },
      instagram: { type: String, default: "" },
    },
    aboutMe: { type: String, default: "" },
    subscription: {
      type: String,
      enum: ["Basic", "Premium"],
      default: "Basic",
    },
    subscriptionDuration: {
      type: Number,
      default: null,
    },
    subscriptionExpiryDate: {
      type: Date,
      default: null,
    },
    role: {
      type: String,
      enum: ["Employer", "Freelancer", "Moderator", "Admin", ""],
      default: "",
    },
    roleId: { type: String, default: "" },
    isApproved: { type: Boolean, default: true }, // false for new employers until approved by moderator
    isRejected: { type: Boolean, default: false }, // true when moderator rejects an employer
    rating: { type: Number, min: 1, max: 5, default: 4.5 },
    calculatedRating: { type: Number, min: 1, max: 5, default: null },
    moderatorRating: { type: Number, min: 1, max: 5, default: null },
    useModeratorRating: { type: Boolean, default: false },
    moderatorAdjustmentReason: { type: String, default: "" },
    adjustedBy: { type: String, default: null },
    adjustedAt: { type: Date, default: null },
    lastCoverMessage: { type: String, default: "" },
  },
  { timestamps: true },
);

// Supports adminUsers cursor pagination: filter by role and sort by createdAt/_id.
userSchema.index({ role: 1, createdAt: -1, _id: -1 });
// Supports frequent roleId-based joins/lookups in controllers and GraphQL loaders.
userSchema.index({ roleId: 1 });

module.exports = mongoose.model("User", userSchema);
