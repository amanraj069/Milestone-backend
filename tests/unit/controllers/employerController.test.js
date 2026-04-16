const { createReq, createRes } = require("../helpers/httpMocks");

const mockJobListingSave = jest.fn();
const MockJobListing = jest.fn((doc) => ({
  ...doc,
  save: mockJobListingSave,
}));
MockJobListing.find = jest.fn();
MockJobListing.countDocuments = jest.fn();
MockJobListing.aggregate = jest.fn();
MockJobListing.findOneAndUpdate = jest.fn();
MockJobListing.findOne = jest.fn();
MockJobListing.deleteOne = jest.fn();

const MockJobApplication = {
  aggregate: jest.fn(),
};

const MockPayment = {
  findOneAndUpdate: jest.fn(),
};

jest.mock("../../../models/job_listing", () => MockJobListing);
jest.mock("../../../models/job_application", () => MockJobApplication);
jest.mock("../../../models/user", () => ({}));
jest.mock("../../../models/employer", () => ({}));
jest.mock("../../../models/freelancer", () => ({}));
jest.mock("../../../models/complaint", () => ({}));
jest.mock("../../../models/Payment", () => MockPayment);
jest.mock("uuid", () => ({ v4: jest.fn(() => "job-uuid-1") }));
jest.mock("../../../middleware/pdfUpload", () => ({ uploadToCloudinary: jest.fn() }));
jest.mock("../../../middleware/imageUpload", () => ({ uploadToCloudinary: jest.fn() }));

const employerController = require("../../../controllers/employerController");

describe("employerController core pricing tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockJobListingSave.mockResolvedValue(true);
    MockPayment.findOneAndUpdate.mockResolvedValue({});
  });

  test("getFeePreview blocks invalid budget to prevent fee bypass", async () => {
    const req = createReq({ query: { budget: "" } });
    const res = createRes();

    await employerController.getFeePreview(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: "Valid budget is required" })
    );
  });

  test("getFeePreview computes boosted + unlimited cap rates correctly", async () => {
    const req = createReq({
      query: { budget: "1000", isBoosted: "true", applicationCap: "null" },
    });
    const res = createRes();

    await employerController.getFeePreview(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        platformFeeRate: 4,
        applicationCapFeeRate: 2,
        totalFeeRate: 6,
        platformFeeAmount: 60,
      })
    );
  });

  test("createJobListing rejects missing required fields to prevent invalid job records", async () => {
    const req = createReq({
      session: { user: { roleId: "emp-1" } },
      body: { title: "Only title" },
    });
    const res = createRes();

    await employerController.createJobListing(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: "Missing required fields" })
    );
  });

  test("createJobListing persists computed fee fields to prevent undercharging", async () => {
    const req = createReq({
      session: { user: { roleId: "emp-1", id: "user-1" } },
      body: {
        title: "Senior React Dev",
        budget: 2000,
        location: "Remote",
        jobType: "contract",
        experienceLevel: "mid",
        applicationDeadline: "2030-01-01",
        description: { text: "Build app", skills: ["React"] },
        isBoosted: true,
        applicationCap: 25,
        paymentDetails: { razorpayOrderId: "order_123" },
      },
    });
    const res = createRes();

    await employerController.createJobListing(req, res);

    expect(MockJobListing).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-uuid-1",
        platformFeeRate: 4,
        applicationCapFeeRate: 1,
        platformFeeAmount: 100,
      })
    );
    expect(MockPayment.findOneAndUpdate).toHaveBeenCalledWith(
      { razorpayOrderId: "order_123" },
      { $set: { userId: "user-1", "metadata.jobId": "job-uuid-1" } }
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
