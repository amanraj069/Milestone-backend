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

jest.mock("../../controllers/feelancerController", () => mockControllerProxy);
jest.mock("../../controllers/employerController", () => ({}));

jest.mock("../../middleware/imageUpload", () => ({
  upload: {
    single: () => (_req, _res, next) => next(),
  },
}));

jest.mock("../../middleware/pdfUpload", () => ({
  upload: {
    single: () => (_req, _res, next) => next(),
  },
}));

jest.mock("../../middleware/rateLimiter", () => ({
  subscriptionRateLimiter: (_req, _res, next) => next(),
  jobApplicationRateLimiter: (_req, _res, next) => next(),
  uploadRateLimiter: (_req, _res, next) => next(),
}));

const freelancerRoutes = require("../../routes/freelancerRoutes");

function createApp(sessionUser) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = sessionUser ? { user: sessionUser } : {};
    next();
  });
  app.use("/api/freelancer", freelancerRoutes);
  return app;
}

describe("freelancer routes access control", () => {
  test("rejects request when session user is missing", async () => {
    const app = createApp(null);

    const res = await request(app).get("/api/freelancer/active_job/api");

    expect(res.status).toBe(403);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: false,
        error: "Access denied. Freelancer access required.",
      }),
    );
  });

  test("rejects request when role is not Freelancer", async () => {
    const app = createApp({ id: "u-1", role: "Employer" });

    const res = await request(app).get("/api/freelancer/job_history/api");

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test("allows request when role is Freelancer", async () => {
    const app = createApp({ id: "u-2", role: "Freelancer", roleId: "fr-1" });

    const res = await request(app).get("/api/freelancer/active_job/api");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: true,
        handler: "getFreelancerActiveJobsAPI",
      }),
    );
  });
});



