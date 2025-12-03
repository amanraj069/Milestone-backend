const mongoose = require("mongoose");
const { Schema } = mongoose;
const { v4: uuidv4 } = require("uuid");

const notificationSchema = new Schema(
  {
    notificationId: {
      type: String,
      required: true,
      unique: true,
      default: uuidv4,
    },
    userId: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["question_posted", "question_answered"],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    jobId: {
      type: String,
      ref: "Job_Listing",
      required: true,
    },
    questionId: {
      type: String,
      ref: "Question",
      required: true,
    },
    fromUserId: {
      type: String,
      default: null,
    },
    fromUserName: {
      type: String,
      default: "",
    },
    read: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
notificationSchema.index({ userId: 1, read: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });

const Notification = mongoose.model("Notification", notificationSchema);

module.exports = Notification;
