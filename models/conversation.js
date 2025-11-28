const mongoose = require("mongoose");
const { Schema } = mongoose;
const { v4: uuidv4 } = require("uuid");

const conversationSchema = new Schema(
  {
    conversationId: {
      type: String,
      required: true,
      unique: true,
      default: uuidv4,
    },
    participants: [
      {
        type: String,
        ref: "User",
        required: true,
      },
    ],
    lastMessage: {
      messageId: { type: String, ref: "Message" },
      text: { type: String, default: "" },
      sender: { type: String, ref: "User" },
      timestamp: { type: Date },
    },
    unreadCount: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
conversationSchema.index({ participants: 1 });
conversationSchema.index({ updatedAt: -1 });

const Conversation = mongoose.model("Conversation", conversationSchema);

module.exports = Conversation;
