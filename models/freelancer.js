const mongoose = require("mongoose");
const { Schema } = mongoose;
const { v4: uuidv4 } = require("uuid");

const freelancerSchema = new Schema(
  {
    freelancerId: {
      type: String,
      required: true,
      unique: true,
      default: uuidv4,
    },
    userId: { type: String, ref: "User", required: true },
    resume: { type: String, default: "" },
    skills: [String], // Array of skill names as strings
    experience: [
      {
        title: { type: String, default: "" },
        date: { type: String, default: "" },
        description: { type: String, default: "" },
      },
    ],
    education: [
      {
        degree: { type: String, default: "" },
        institution: { type: String, default: "" },
        date: { type: String, default: "" },
      },
    ],
    portfolio: [
      {
        title: { type: String, default: "" },
        description: { type: String, default: "" },
        image: { type: String, default: "" },
        link: { type: String, default: "" },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Freelancer", freelancerSchema);
