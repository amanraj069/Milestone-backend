const mongoose = require("mongoose");
const { Schema } = mongoose;
const { v4: uuidv4 } = require("uuid");

const jobListingSchema = new Schema(
  {
    jobId: {
      type: String,
      required: true,
      unique: true,
      default: uuidv4,
    },
    employerId: {
      type: String,
      ref: "Employer",
      required: true,
    },
    imageUrl: {
      type: String,
      default: "/assets/company_logo.jpg",
    },
    title: {
      type: String,
      required: true,
    },
    budget: {
      type: Number,
      required: true,
    },
    location: {
      type: String,
      default: "",
    },
    locationCoordinates: {
      lat: { type: Number, min: -90, max: 90, default: null },
      lng: { type: Number, min: -180, max: 180, default: null },
    },
    jobType: {
      type: String,
      enum: ["full-time", "part-time", "contract", "freelance"],
      required: true,
    },
    experienceLevel: {
      type: String,
      enum: ["Entry", "Mid", "Senior", "Expert"],
      required: true,
    },
    remote: {
      type: Boolean,
      default: false,
    },
    postedDate: {
      type: Date,
      default: Date.now,
    },
    applicationDeadline: {
      type: Date,
      required: true,
    },
    description: {
      text: { type: String, required: true },
      responsibilities: [{ type: String, default: [] }],
      requirements: [{ type: String, default: [] }],
      skills: [{ type: String, default: [] }],
    },
    milestones: [
      {
        milestoneId: {
          type: String,
          default: uuidv4,
        },
        description: { type: String, required: true },
        deadline: { type: String, required: true },
        payment: { type: String, required: true },
        status: {
          type: String,
          enum: ["paid", "not-paid", "in-progress"],
          default: "not-paid",
        },
        requested: {
          type: Boolean,
          default: false,
        },
        subTasks: [
          {
            subTaskId: {
              type: String,
              default: uuidv4,
            },
            description: { type: String, required: true },
            status: {
              type: String,
              enum: ["pending", "in-progress", "completed"],
              default: "pending",
            },
            completedDate: {
              type: Date,
              default: null,
            },
            notes: {
              type: String,
              default: "",
            },
          },
        ],
        completionPercentage: {
          type: Number,
          default: 0,
        },
      },
    ],
    status: {
      type: String,
      enum: ["active", "open", "in-progress", "completed", "closed"],
      default: "open",
    },
    applicants: {
      type: Number,
      default: 0,
    },
    // Platform fee & boost fields
    platformFeeRate: {
      type: Number,
      default: 2, // 2% for normal, 4% for boosted
    },
    applicationCap: {
      type: Number,
      default: null, // null = unlimited
    },
    applicationCapFeeRate: {
      type: Number,
      default: 2, // 0.5% | 1% | 1.5% | 2% based on cap tier
    },
    platformFeeAmount: {
      type: Number,
      default: 0, // calculated at creation: (platformFeeRate + applicationCapFeeRate) / 100 * budget
    },
    isBoosted: {
      type: Boolean,
      default: false,
    },
    boostExpiresAt: {
      type: Date,
      default: null,
    },
    assignedFreelancer: {
      freelancerId: { type: String, ref: "Freelancer", default: null },
      startDate: { type: Date, default: null },
      endDate: { type: Date, default: null },
      status: {
        type: String,
        enum: ["working", "finished", "left"],
        default: null,
      },
      employerRating: { type: Number, min: 1, max: 5, default: null },
      employerReview: { type: String, default: "" },
      rated: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
  },
);

const JobListing = mongoose.model("Job_Listing", jobListingSchema);

module.exports = JobListing;
