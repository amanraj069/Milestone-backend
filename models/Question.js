const mongoose = require("mongoose");
const { Schema } = mongoose;
const { v4: uuidv4 } = require("uuid");

const answerSchema = new Schema(
  {
    answerId: {
      type: String,
      required: true,
      default: uuidv4,
    },
    answererId: {
      type: String,
      required: true,
    },
    answererType: {
      type: String,
      enum: ["Freelancer", "Employer"],
      required: true,
    },
    answererName: {
      type: String,
      default: "",
    },
    answererPicture: {
      type: String,
      default: "",
    },
    text: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const questionSchema = new Schema(
  {
    questionId: {
      type: String,
      required: true,
      unique: true,
      default: uuidv4,
    },
    jobId: {
      type: String,
      ref: "Job_Listing",
      required: true,
    },
    askerId: {
      type: String,
      required: true,
    },
    askerType: {
      type: String,
      enum: ["Freelancer", "Employer"],
      required: true,
    },
    askerName: {
      type: String,
      default: "",
    },
    askerPicture: {
      type: String,
      default: "",
    },
    text: {
      type: String,
      required: true,
    },
    answers: [answerSchema],
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
questionSchema.index({ jobId: 1 });
questionSchema.index({ jobId: 1, createdAt: -1 });
questionSchema.index({ askerId: 1 });

const Question = mongoose.model("Question", questionSchema);

module.exports = Question;
