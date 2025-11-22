const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const complaintSchema = new mongoose.Schema({
  complaintId: {
    type: String,
    default: () => uuidv4(),
    unique: true,
    required: true,
  },
  complainantType: {
    type: String,
    enum: ["Freelancer", "Employer"],
    required: true,
  },
  complainantId: {
    type: String,
    required: true,
  },
  complainantName: {
    type: String,
    required: true,
  },
  freelancerId: {
    type: String,
    required: true,
  },
  freelancerName: {
    type: String,
    required: true,
  },
  jobId: {
    type: String,
    required: true,
  },
  jobTitle: {
    type: String,
    required: true,
  },
  employerId: {
    type: String,
    required: true,
  },
  employerName: {
    type: String,
    required: true,
  },
  complaintType: {
    type: String,
    enum: [
      "Payment Issue",
      "Communication Issue",
      "Scope Creep",
      "Contract Violation",
      "Harassment",
      "Other"
    ],
    required: true,
  },
  priority: {
    type: String,
    enum: ["Low", "Medium", "High", "Critical"],
    default: "Medium",
  },
  subject: {
    type: String,
    required: true,
    minlength: 10,
    maxlength: 200,
  },
  description: {
    type: String,
    required: true,
    minlength: 50,
  },
  status: {
    type: String,
    enum: ["Pending", "Under Review", "Resolved", "Rejected"],
    default: "Pending",
  },
  adminNotes: {
    type: String,
    default: "",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
  resolvedAt: {
    type: Date,
  },
});

// Update the updatedAt timestamp before saving
complaintSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

const Complaint = mongoose.model("Complaint", complaintSchema);

module.exports = Complaint;
