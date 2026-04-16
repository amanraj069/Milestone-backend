const mongoose = require("mongoose");
const { Schema } = mongoose;
const { v4: uuidv4 } = require("uuid");

const moderatorSchema = new Schema(
  {
    moderatorId: {
      type: String,
      required: true,
      unique: true,
      default: uuidv4,
    },
    userId: { type: String, ref: "User", required: true },
  },
  { timestamps: true },
);

moderatorSchema.index({ userId: 1 });
moderatorSchema.index({ createdAt: -1, _id: -1 });

module.exports = mongoose.model("Moderator", moderatorSchema);
