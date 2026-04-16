jest.mock("../../models/job_listing", () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));

jest.mock("../../models/job_application", () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  countDocuments: jest.fn(),
}));

jest.mock("../../models/user", () => ({
  find: jest.fn(),
}));

jest.mock("../../models/employer", () => ({}));
jest.mock("../../models/freelancer", () => ({}));
jest.mock("../../models/complaint", () => ({}));
jest.mock("../../models/Payment", () => ({}));
jest.mock("../../middleware/pdfUpload", () => ({ uploadToCloudinary: jest.fn() }));
jest.mock("../../middleware/imageUpload", () => ({ uploadToCloudinary: jest.fn() }));

const employerController = require("../../controllers/employerController");
const JobListing = require("../../models/job_listing");
const JobApplication = require("../../models/job_application");
const User = require("../../models/user");

function createRes() {
  const status = jest.fn().mockReturnThis();
  const json = jest.fn();
  const send = jest.fn();
  return { status, json, send };
}

describe("employer applications workflow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("getJobApplicationsAPI returns 401 when employer roleId missing", async () => {
    const req = { session: { user: {} }, query: {} };
    const res = createRes();

    await employerController.getJobApplicationsAPI(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false }),
    );
  });

  test("getJobApplicationsAPI returns empty payload when employer has no jobs", async () => {
    JobListing.find.mockReturnValue({
      select: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
    });

    const req = { session: { user: { roleId: "emp-1" } }, query: {} };
    const res = createRes();

    await employerController.getJobApplicationsAPI(req, res);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          applications: [],
          stats: expect.objectContaining({ total: 0 }),
        }),
      }),
    );
  });

  test("getJobApplicationsAPI applies status filter and pagination", async () => {
    JobListing.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([{ jobId: "job-1", title: "J1" }]),
      }),
    });

    JobApplication.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([
        {
          applicationId: "app-1",
          freelancerId: "freelancer-1",
          jobId: "job-1",
          status: "Pending",
          appliedDate: new Date().toISOString(),
        },
      ]),
    });

    User.find.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([
          {
            roleId: "freelancer-1",
            userId: "user-1",
            name: "Alice",
            subscription: "Premium",
          },
        ]),
      }),
    });

    const req = {
      session: { user: { roleId: "emp-1" } },
      query: { status: "Pending", limit: "1", page: "1", sort: "newest" },
    };
    const res = createRes();

    await employerController.getJobApplicationsAPI(req, res);

    expect(JobApplication.find).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "Pending",
      }),
    );

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          pagination: expect.objectContaining({ page: 1, limit: 1, total: 1 }),
        }),
      }),
    );
  });

  test("acceptJobApplication updates application and assigns freelancer", async () => {
    JobApplication.findOne.mockResolvedValue({
      applicationId: "app-1",
      jobId: "job-1",
      freelancerId: "freelancer-1",
    });
    JobListing.findOne.mockResolvedValue({ jobId: "job-1", employerId: "emp-1" });
    JobApplication.findOneAndUpdate.mockResolvedValue({});
    JobListing.findOneAndUpdate.mockResolvedValue({});

    const req = {
      params: { applicationId: "app-1" },
      session: { user: { roleId: "emp-1" } },
    };
    const res = createRes();

    await employerController.acceptJobApplication(req, res);

    expect(JobApplication.findOneAndUpdate).toHaveBeenCalledWith(
      { applicationId: "app-1" },
      { $set: { status: "Accepted" } },
    );
    expect(JobListing.findOneAndUpdate).toHaveBeenCalledWith(
      { jobId: "job-1" },
      expect.objectContaining({
        $set: expect.objectContaining({ status: "closed" }),
      }),
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
    );
  });

  test("acceptJobApplication returns 500 when employer does not own job", async () => {
    JobApplication.findOne.mockResolvedValue({
      applicationId: "app-1",
      jobId: "job-1",
      freelancerId: "freelancer-1",
    });
    JobListing.findOne.mockResolvedValue({ jobId: "job-1", employerId: "emp-2" });

    const req = {
      params: { applicationId: "app-1" },
      session: { user: { roleId: "emp-1" } },
    };
    const res = createRes();

    await employerController.acceptJobApplication(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.send).toHaveBeenCalledWith(
      expect.stringContaining("Not authorized to modify this application"),
    );
  });

  test("rejectJobApplication updates status to Rejected", async () => {
    JobApplication.findOne.mockResolvedValue({
      applicationId: "app-1",
      jobId: "job-1",
      freelancerId: "freelancer-1",
    });
    JobListing.findOne.mockResolvedValue({ jobId: "job-1", employerId: "emp-1" });
    JobApplication.findOneAndUpdate.mockResolvedValue({});

    const req = {
      params: { applicationId: "app-1" },
      session: { user: { roleId: "emp-1" } },
    };
    const res = createRes();

    await employerController.rejectJobApplication(req, res);

    expect(JobApplication.findOneAndUpdate).toHaveBeenCalledWith(
      { applicationId: "app-1" },
      { $set: { status: "Rejected" } },
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
    );
  });
});



