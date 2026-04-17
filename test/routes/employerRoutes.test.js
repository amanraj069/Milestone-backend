const express = require("express");
const request = require("supertest");

const mockControllerProxy = new Proxy(
  {},
  {
    get: (_target, prop) => {
      return (_req, res) =>
        res.status(200).json({ success: true, handler: String(prop) });
    },
  },
);

jest.mock("../../controllers/employerController", () => mockControllerProxy);

jest.mock("../../middleware/imageUpload", () => ({
  upload: {
    single: () => (_req, _res, next) => next(),
  },
  uploadLocalImage: {
    single: () => (_req, _res, next) => next(),
  },
}));

jest.mock("../../middleware/pdfUpload", () => ({
  upload: {
    single: () => (_req, _res, next) => next(),
  },
  uploadCloud: (_req, _res, next) => next(),
  uploadVerification: {
    single: () => (_req, _res, next) => next(),
  },
}));

jest.mock("../../middleware/rateLimiter", () => ({
  subscriptionRateLimiter: (_req, _res, next) => next(),
  jobApplicationRateLimiter: (_req, _res, next) => next(),
  uploadRateLimiter: (_req, _res, next) => next(),
  jobPostingLimiter: (_req, _res, next) => next(),
}));

jest.mock("../../middleware/asyncHandler", () => (handler) => handler);

const employerRoutes = require("../../routes/employerRoutes");

function createApp(sessionUser) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = sessionUser ? { user: sessionUser } : {};
    next();
  });
  app.use("/api/employer", employerRoutes);
  return app;
}

describe("employer routes access control", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("rejects request when session user is missing", async () => {
    const app = createApp(null);

    const res = await request(app).get("/api/employer/job-listings");

    expect(res.status).toBe(403);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: false,
        error: "Access denied. Employer access required.",
      }),
    );
  });

  test("rejects request when role is not Employer", async () => {
    const app = createApp({ id: "u-1", role: "Freelancer" });

    const res = await request(app).get("/api/employer/job-listings");

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test("allows request when role is Employer", async () => {
    const app = createApp({ id: "u-2", role: "Employer", roleId: "emp-1" });

    const res = await request(app).get("/api/employer/job-listings");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: true,
        handler: "getJobListings",
      }),
    );
  });
});


