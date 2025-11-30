const mongoose = require("mongoose");
const { Schema } = mongoose;
const { v4: uuidv4 } = require("uuid");

const messageSchema = new Schema(
  {
    messageId: {
      type: String,
      required: true,
      unique: true,
      default: uuidv4,
    },
    conversationId: {
      type: String,
      ref: "Conversation",
      required: true,
    },
    from: {
      type: String,
      ref: "User",
      required: true,
    },
    to: {
      type: String,
      ref: "User",
      required: true,
    },
    messageData: {
      type: String,
      required: true,
    },
    replyTo: {
      messageId: { type: String, ref: "Message" },
      text: { type: String },
      sender: { type: String, ref: "User" },
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for faster queries
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ from: 1, to: 1 });

const Message = mongoose.model("Message", messageSchema);

module.exports = Message;