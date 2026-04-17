const mockJobSave = jest.fn();

const MockJobListing = jest.fn().mockImplementation((payload) => ({
  ...payload,
  jobId: payload.jobId || "job-1",
  save: mockJobSave,
}));
MockJobListing.findOneAndUpdate = jest.fn();

jest.mock("../../models/job_listing", () => MockJobListing);
jest.mock("../../models/job_application", () => ({}));
jest.mock("../../models/user", () => ({}));
jest.mock("../../models/employer", () => ({}));
jest.mock("../../models/freelancer", () => ({}));
jest.mock("../../models/complaint", () => ({}));
jest.mock("../../models/Payment", () => ({
  findOneAndUpdate: jest.fn(),
}));

jest.mock("../../middleware/pdfUpload", () => ({ uploadToCloudinary: jest.fn() }));
jest.mock("../../middleware/imageUpload", () => ({ uploadToCloudinary: jest.fn() }));

jest.mock("uuid", () => ({ v4: jest.fn(() => "job-uuid-1") }));

const employerController = require("../../controllers/employerController");
const JobListing = require("../../models/job_listing");
const Payment = require("../../models/Payment");

function createRes() {
  const status = jest.fn().mockReturnThis();
  const json = jest.fn();
  return { status, json };
}

describe("employerController job creation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockJobSave.mockResolvedValue(true);
  });

  test("getFeePreview blocks invalid budget", async () => {
    const req = {
      query: {
        budget: "",
      },
    };
    const res = createRes();

    await employerController.getFeePreview(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: "Valid budget is required",
      }),
    );
  });

  test("createJobListing returns 401 when employer session missing", async () => {
    const req = { session: { user: {} }, body: {} };
    const res = createRes();

    await employerController.createJobListing(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: "Unauthorized" }),
    );
  });

  test("createJobListing validates required fields", async () => {
    const req = {
      session: { user: { roleId: "emp-1" } },
      body: { title: "Job title only" },
    };
    const res = createRes();

    await employerController.createJobListing(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: "Missing required fields" }),
    );
  });

  test("createJobListing persists job and links payment order", async () => {
    const req = {
      session: { user: { roleId: "emp-1", id: "user-1" } },
      body: {
        title: "Build landing page",
        budget: 10000,
        location: "Remote",
        locationCoordinates: { lat: 12.9, lng: 77.5 },
        jobType: "contract",
        experienceLevel: "mid",
        remote: true,
        applicationDeadline: "2026-05-01",
        description: { summary: "Need React developer" },
        applicationCap: 25,
        isBoosted: false,
        paymentDetails: { razorpayOrderId: "order_1" },
      },
    };
    const res = createRes();

    await employerController.createJobListing(req, res);

    expect(JobListing).toHaveBeenCalledWith(
      expect.objectContaining({
        employerId: "emp-1",
        title: "Build landing page",
        applicationCapFeeRate: 1,
        platformFeeRate: 2,
      }),
    );
    expect(mockJobSave).toHaveBeenCalled();
    expect(Payment.findOneAndUpdate).toHaveBeenCalledWith(
      { razorpayOrderId: "order_1" },
      { $set: { userId: "user-1", "metadata.jobId": "job-uuid-1" } },
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, message: "Job listing created successfully" }),
    );
  });

  test("getFeePreview computes expected fee bands", async () => {
    const req = {
      query: {
        budget: "10000",
        isBoosted: "true",
        applicationCap: "25",
      },
    };
    const res = createRes();

    await employerController.getFeePreview(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        platformFeeRate: 4,
        applicationCapFeeRate: 0.5,
        totalFeeRate: 4.5,
        platformFeeAmount: 450,
      }),
    );
  });
});
