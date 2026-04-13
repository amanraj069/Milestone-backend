const mongoose = require("mongoose");
const { Schema } = mongoose;
const { v4: uuidv4 } = require("uuid");

const employerSchema = new Schema(
  {
    employerId: { type: String, required: true, unique: true, default: uuidv4 },
    userId: { type: String, ref: "User", required: true },
    companyName: { type: String, default: "" },
    websiteLink: { type: String, default: "" },
    companyDetails: {
      companyName: { type: String, default: "" },
      companyPAN: { type: String, default: "" },
      billingAddress: { type: String, default: "" },
      accountsPayableEmail: { type: String, default: "" },
      taxIdentificationNumber: { type: String, default: "" },
      proofOfAddressUrl: { type: String, default: "" },
      officialBusinessEmail: { type: String, default: "" },
      companyLogoUrl: { type: String, default: "" },
      isSubmitted: { type: Boolean, default: false },
      submittedAt: { type: Date, default: null },
    },
    jobsPosted: [{ type: String, ref: "Job_Listing", default: [] }],
    currentFreelancers: [
      {
        freelancerId: { type: String, ref: "Freelancer", default: "" },
        jobId: { type: String, ref: "Job_Listing", default: "" },
        startDate: { type: Date, default: null },
      },
    ],
    previouslyWorkedFreelancers: [
      { type: String, ref: "Freelancer", default: [] },
    ],
  },
  { timestamps: true }
);

employerSchema.index({ createdAt: -1, _id: -1 });
employerSchema.index({ userId: 1 });

module.exports = mongoose.model("Employer", employerSchema);
