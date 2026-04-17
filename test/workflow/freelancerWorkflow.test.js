const mockSaveApplication = jest.fn();
const mockSaveComplaint = jest.fn();

const mockJobApplication = jest.fn().mockImplementation((payload) => ({
  ...payload,
  applicationId: "app-1",
  save: mockSaveApplication,
}));
mockJobApplication.findOne = jest.fn();
mockJobApplication.countDocuments = jest.fn();
mockJobApplication.find = jest.fn();

const mockComplaint = jest.fn().mockImplementation((payload) => ({
  ...payload,
  complaintId: "cmp-1",
  save: mockSaveComplaint,
}));
mockComplaint.find = jest.fn();

jest.mock("../../models/job_listing", () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  find: jest.fn(),
  countDocuments: jest.fn(),
}));

jest.mock("../../models/job_application", () => mockJobApplication);
jest.mock("../../models/complaint", () => mockComplaint);

jest.mock("../../models/user", () => ({
  findOne: jest.fn(),
  find: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));

jest.mock("../../models/employer", () => ({
  findOne: jest.fn(),
  find: jest.fn(),
}));

jest.mock("../../models/freelancer", () => ({
  findOne: jest.fn(),
}));

jest.mock("../../models/Feedback", () => ({
  find: jest.fn(),
}));

jest.mock("../../models/Payment", () => ({}));
jest.mock("../../middleware/imageUpload", () => ({ uploadToCloudinary: jest.fn() }));

const freelancerController = require("../../controllers/feelancerController");
const JobListing = require("../../models/job_listing");
const JobApplication = require("../../models/job_application");
const User = require("../../models/user");
const Employer = require("../../models/employer");
const Freelancer = require("../../models/freelancer");

function createRes() {
  const status = jest.fn().mockReturnThis();
  const json = jest.fn();
  const send = jest.fn();
  return { status, json, send };
}

function leanResult(data) {
  return { lean: jest.fn().mockResolvedValue(data) };
}

describe("freelancer workflow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("applyForJob", () => {
    test("rejects too-short cover message", async () => {
      const req = {
        session: { user: { roleId: "fr-1" } },
        params: { jobId: "job-1" },
        body: { coverMessage: "short" },
      };
      const res = createRes();

      await freelancerController.applyForJob(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false }),
      );
    });

    test("returns 404 when job does not exist", async () => {
      JobListing.findOne.mockReturnValue(leanResult(null));

      const req = {
        session: { user: { roleId: "fr-1" } },
        params: { jobId: "job-404" },
        body: {
          coverMessage:
            "This is a sufficiently long cover letter with more than fifty chars.",
        },
      };
      const res = createRes();

      await freelancerController.applyForJob(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: "Job not found" }),
      );
    });

    test("rejects duplicate application", async () => {
      JobListing.findOne.mockReturnValue(leanResult({ jobId: "job-1", applicationCap: null }));
      JobApplication.findOne.mockResolvedValue({ applicationId: "app-existing" });

      const req = {
        session: { user: { roleId: "fr-1" } },
        params: { jobId: "job-1" },
        body: {
          coverMessage:
            "This is a sufficiently long cover letter with more than fifty chars.",
        },
      };
      const res = createRes();

      await freelancerController.applyForJob(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: "You have already applied for this job" }),
      );
    });

    test("enforces application cap", async () => {
      JobListing.findOne.mockReturnValue(leanResult({ jobId: "job-1", applicationCap: 1 }));
      JobApplication.findOne.mockResolvedValue(null);
      JobApplication.countDocuments.mockResolvedValue(1);

      const req = {
        session: { user: { roleId: "fr-1" } },
        params: { jobId: "job-1" },
        body: {
          coverMessage:
            "This is a sufficiently long cover letter with more than fifty chars.",
        },
      };
      const res = createRes();

      await freelancerController.applyForJob(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false }),
      );
    });

    test("creates application and updates counters on success", async () => {
      JobListing.findOne.mockReturnValue(leanResult({ jobId: "job-1", applicationCap: null }));
      JobApplication.findOne.mockResolvedValue(null);
      Freelancer.findOne.mockReturnValue(leanResult({ freelancerId: "fr-1", resume: "resume.pdf" }));
      User.findOne.mockReturnValue(leanResult({ roleId: "fr-1", email: "fr@example.com" }));
      JobListing.findOneAndUpdate.mockResolvedValue({});
      User.findOneAndUpdate.mockResolvedValue({});
      mockSaveApplication.mockResolvedValue({});

      const req = {
        session: { user: { roleId: "fr-1" } },
        params: { jobId: "job-1" },
        body: {
          coverMessage:
            "This is a sufficiently long cover letter with more than fifty chars.",
          availability: "immediate",
        },
      };
      const res = createRes();

      await freelancerController.applyForJob(req, res);

      expect(JobApplication).toHaveBeenCalledWith(
        expect.objectContaining({
          freelancerId: "fr-1",
          jobId: "job-1",
          status: "Pending",
        }),
      );
      expect(JobListing.findOneAndUpdate).toHaveBeenCalledWith(
        { jobId: "job-1" },
        { $inc: { applicants: 1 } },
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );
    });
  });

  describe("active/history guards", () => {
    test("getFreelancerActiveJobsAPI returns 401 for anonymous user", async () => {
      const req = { session: {} };
      const res = createRes();

      await freelancerController.getFreelancerActiveJobsAPI(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining("Unauthorized") }),
      );
    });

    test("getFreelancerJobHistoryAPI returns 401 for anonymous user", async () => {
      const req = { session: {} };
      const res = createRes();

      await freelancerController.getFreelancerJobHistoryAPI(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false }),
      );
    });
  });

  describe("createComplaint", () => {
    test("validates required complaint fields", async () => {
      const req = {
        session: { user: { roleId: "fr-1", id: "u-1" } },
        body: { jobId: "job-1", complaintType: "Payment Issue" },
      };
      const res = createRes();

      await freelancerController.createComplaint(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ error: "All fields are required" }),
      );
    });

    test("creates complaint successfully", async () => {
      JobListing.findOne.mockReturnValue(leanResult({
        jobId: "job-1",
        title: "Design Job",
        employerId: "emp-1",
      }));

      User.findOne
        .mockReturnValueOnce(leanResult({ userId: "u-1", name: "Freelancer One" }))
        .mockReturnValueOnce(leanResult({ roleId: "emp-1", name: "Employer User" }));

      Employer.findOne.mockReturnValue(leanResult({ employerId: "emp-1", companyName: "Acme" }));
      mockSaveComplaint.mockResolvedValue({});

      const req = {
        session: { user: { roleId: "fr-1", id: "u-1" } },
        body: {
          jobId: "job-1",
          complaintType: "Payment Issue",
          priority: "High",
          subject: "Payment delay issue for completed milestone",
          description:
            "The milestone has been completed and approved but payment is still pending after multiple follow ups.",
        },
      };
      const res = createRes();

      await freelancerController.createComplaint(req, res);

      expect(mockComplaint).toHaveBeenCalledWith(
        expect.objectContaining({
          complainantType: "Freelancer",
          freelancerId: "fr-1",
          employerId: "emp-1",
          status: "Pending",
        }),
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );
    });
  });
});



