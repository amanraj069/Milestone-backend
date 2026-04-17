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

jest.mock("../../controllers/moderatorController", () => mockControllerProxy);

jest.mock("../../middleware/imageUpload", () => ({
  upload: {
    single: () => (_req, _res, next) => next(),
  },
}));

jest.mock("../../middleware/rateLimiter", () => ({
  uploadRateLimiter: (_req, _res, next) => next(),
}));

jest.mock("../../routes/moderatorQuizRoutes", () => {
  const expressModule = require("express");
  const router = expressModule.Router();
  router.get("/", (_req, res) => res.json({ success: true, feature: "quiz" }));
  return router;
});

const moderatorRoutes = require("../../routes/moderatorRoutes");

function createApp(sessionUser) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.session = sessionUser ? { user: sessionUser } : {};
    next();
  });
  app.use("/api/moderator", moderatorRoutes);
  return app;
}

describe("moderator routes access control", () => {
  test("rejects request when session user is missing", async () => {
    const app = createApp(null);

    const res = await request(app).get("/api/moderator/complaints");

    expect(res.status).toBe(403);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: false,
        error: "Access denied. Moderator access required.",
      }),
    );
  });

  test("rejects request when role is not Moderator", async () => {
    const app = createApp({ id: "u-1", role: "Employer" });

    const res = await request(app).get("/api/moderator/jobs");

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test("allows request when role is Moderator", async () => {
    const app = createApp({ id: "u-2", role: "Moderator" });

    const res = await request(app).get("/api/moderator/complaints");

    expect(res.status).toBe(200);
    expect(res.body).toEqual(
      expect.objectContaining({
        success: true,
        handler: "getAllComplaints",
      }),
    );
  });
});



