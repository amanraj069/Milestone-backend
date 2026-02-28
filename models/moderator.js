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

module.exports = mongoose.model("Moderator", moderatorSchema);
