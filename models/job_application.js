const mongoose = require("mongoose");
const { Schema } = mongoose;
const { v4: uuidv4 } = require("uuid");

const jobApplicationSchema = new Schema(
  {
    applicationId: {
      type: String,
      required: true,
      unique: true,
      default: uuidv4,
    },
    freelancerId: {
      type: String,
      ref: "Freelancer",
      required: true,
    },
    jobId: {
      type: String,
      ref: "Job_Listing",
      required: true,
    },
    coverMessage: {
      type: String,
      default: "",
    },
    resumeLink: {
      type: String,
      default: "",
    },
    appliedDate: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["Pending", "Accepted", "Rejected"],
      default: "Pending",
    },
    contactEmail: {
      type: String,
      default: "",
    },
    skillRating: {
      type: String,
      default: "",
    },
    availability: {
      type: String,
      enum: ["immediate", "notice", "serve-notice", "other"],
      default: "immediate",
    },
  },
  {
    timestamps: true,
  }
);

jobApplicationSchema.index({ jobId: 1, status: 1, appliedDate: 1 });
jobApplicationSchema.index({ freelancerId: 1, appliedDate: -1 });

const JobApplication = mongoose.model("Job_Application", jobApplicationSchema);

module.exports = JobApplication;