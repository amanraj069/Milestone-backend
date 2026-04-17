const mockFeedbackSave = jest.fn();
const MockFeedback = jest.fn().mockImplementation((payload) => ({
  ...payload,
  save: mockFeedbackSave,
}));
MockFeedback.findOne = jest.fn();
MockFeedback.find = jest.fn();
MockFeedback.countDocuments = jest.fn();
MockFeedback.aggregate = jest.fn();

const MockNotification = jest.fn().mockImplementation((payload) => ({
  ...payload,
  save: jest.fn().mockResolvedValue(true),
}));

jest.mock("../../models/Feedback", () => MockFeedback);
jest.mock("../../models/job_listing", () => ({
  findOne: jest.fn(),
}));
jest.mock("../../models/user", () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  find: jest.fn(),
}));
jest.mock("../../models/Notification", () => MockNotification);
jest.mock("uuid", () => ({ v4: jest.fn(() => "notif-uuid-1") }));

const feedbackController = require("../../controllers/feedbackController");
const Feedback = require("../../models/Feedback");
const JobListing = require("../../models/job_listing");
const User = require("../../models/user");

function createRes() {
  const status = jest.fn().mockReturnThis();
  const json = jest.fn();
  return { status, json };
}

function createReq(overrides = {}) {
  return {
    session: {
      user: {
        id: "user-employer-1",
        roleId: "emp-1",
        role: "Employer",
        name: "Employer One",
      },
    },
    body: {},
    params: {},
    app: { get: jest.fn().mockReturnValue({ to: jest.fn().mockReturnValue({ emit: jest.fn() }) }) },
    ...overrides,
  };
}

describe("feedbackController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("createFeedback returns 401 when anonymous", async () => {
    const req = { session: {}, body: {} };
    const res = createRes();

    await feedbackController.createFeedback(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test("createFeedback validates required fields", async () => {
    const req = createReq({ body: { jobId: "job-1" } });
    const res = createRes();

    await feedbackController.createFeedback(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false }),
    );
  });

  test("createFeedback validates rating bounds", async () => {
    const req = createReq({
      body: {
        jobId: "job-1",
        toUserId: "user-fr-1",
        toRole: "Freelancer",
        rating: 6,
      },
    });
    const res = createRes();

    await feedbackController.createFeedback(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("Rating") }),
    );
  });

  test("createFeedback returns 404 for unknown job", async () => {
    JobListing.findOne.mockResolvedValue(null);

    const req = createReq({
      body: {
        jobId: "job-404",
        toUserId: "user-fr-1",
        toRole: "Freelancer",
        rating: 5,
      },
    });
    const res = createRes();

    await feedbackController.createFeedback(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test("createFeedback blocks duplicate feedback per job/user", async () => {
    JobListing.findOne.mockResolvedValue({
      jobId: "job-1",
      employerId: "emp-1",
      assignedFreelancer: { freelancerId: "fr-1" },
      title: "Design work",
    });
    User.findOne.mockResolvedValue({ userId: "user-fr-1", roleId: "fr-1" });
    Feedback.findOne.mockResolvedValue({ feedbackId: "fb-1" });

    const req = createReq({
      body: {
        jobId: "job-1",
        toUserId: "user-fr-1",
        toRole: "Freelancer",
        rating: 5,
      },
    });
    const res = createRes();

    await feedbackController.createFeedback(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("already submitted") }),
    );
  });

  test("createFeedback succeeds and updates recipient rating", async () => {
    JobListing.findOne.mockResolvedValue({
      jobId: "job-1",
      employerId: "emp-1",
      assignedFreelancer: { freelancerId: "fr-1" },
      title: "Design work",
    });

    User.findOne
      .mockResolvedValueOnce({ userId: "user-fr-1", roleId: "fr-1" })
      .mockResolvedValueOnce({ userId: "user-fr-1", useModeratorRating: false });

    Feedback.findOne.mockResolvedValue(null);
    Feedback.find.mockResolvedValue([{ rating: 5 }, { rating: 4 }]);
    User.findOneAndUpdate.mockResolvedValue(true);
    mockFeedbackSave.mockResolvedValue(true);

    const req = createReq({
      body: {
        jobId: "job-1",
        toUserId: "user-fr-1",
        toRole: "Freelancer",
        rating: 5,
        comment: "Great work",
      },
    });
    const res = createRes();

    await feedbackController.createFeedback(req, res);

    expect(Feedback).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-1",
        fromUserId: "user-employer-1",
        toUserId: "user-fr-1",
        rating: 5,
      }),
    );
    expect(mockFeedbackSave).toHaveBeenCalled();
    expect(User.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: "user-fr-1" },
      expect.objectContaining({ calculatedRating: 4.5, rating: 4.5 }),
      { new: true },
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
    );
  });
});
