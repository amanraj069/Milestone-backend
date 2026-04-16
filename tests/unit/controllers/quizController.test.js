const { createReq, createRes } = require("../helpers/httpMocks");

const mockQuizFindById = jest.fn();
const mockAttemptFindById = jest.fn();
const mockAttemptUpdateMany = jest.fn();
const mockAttemptFind = jest.fn();
const mockAttemptCountDocuments = jest.fn();
const mockBadgeFind = jest.fn();
const mockUserBadgeFindOneAndUpdate = jest.fn();

jest.mock("../../../models/Quiz", () => ({
  findById: (...args) => mockQuizFindById(...args),
}));

jest.mock("../../../models/Attempt", () => ({
  findById: (...args) => mockAttemptFindById(...args),
  updateMany: (...args) => mockAttemptUpdateMany(...args),
  find: (...args) => mockAttemptFind(...args),
  countDocuments: (...args) => mockAttemptCountDocuments(...args),
}));

jest.mock("../../../models/Badge", () => ({
  find: (...args) => mockBadgeFind(...args),
}));

jest.mock("../../../models/UserBadge", () => ({
  findOneAndUpdate: (...args) => mockUserBadgeFindOneAndUpdate(...args),
}));

jest.mock("../../../models/user", () => ({
  findOne: jest.fn(async () => ({ subscription: "Basic" })),
}));

const quizController = require("../../../controllers/quizController");

describe("quizController anti-cheat and timing tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBadgeFind.mockResolvedValue([]);
    mockAttemptCountDocuments.mockResolvedValue(0);
    mockUserBadgeFindOneAndUpdate.mockResolvedValue({});
  });

  test("reportViolation auto-terminates when max violations threshold is reached", async () => {
    const attempt = {
      _id: "attempt-1",
      userId: "user-1",
      quizId: "quiz-1",
      status: "in_progress",
      violations: [{ type: "tab_switch", timestamp: new Date() }],
      violationsCount: 1,
      save: jest.fn().mockResolvedValue(true),
    };

    mockAttemptFindById.mockResolvedValue(attempt);
    mockQuizFindById.mockResolvedValue({ maxViolations: 2 });

    const req = createReq({
      body: { attemptId: "attempt-1", type: "fullscreen_exit" },
      session: { user: { id: "user-1" } },
    });
    const res = createRes();

    await quizController.reportViolation(req, res);

    expect(attempt.status).toBe("auto_terminated");
    expect(attempt.violationsCount).toBe(2);
    expect(attempt.save).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ terminated: true, violationsCount: 2, maxViolations: 2 }),
      })
    );
  });

  test("submitAttempt rejects timed-out attempts to prevent client-side timer bypass", async () => {
    const attempt = {
      _id: "attempt-2",
      userId: "user-2",
      quizId: "quiz-2",
      status: "in_progress",
      startedAt: new Date(Date.now() - 5 * 60 * 1000),
      save: jest.fn().mockResolvedValue(true),
    };

    mockQuizFindById.mockResolvedValue({
      _id: "quiz-2",
      timeLimitMinutes: 1,
      questions: [{ _id: "q1", marks: 10, options: [{ isCorrect: true }] }],
      passingScore: 50,
      violationPenaltyPercent: 5,
      title: "Quiz",
      skillName: "JS",
    });
    mockAttemptFindById.mockResolvedValue(attempt);

    const req = createReq({
      params: { id: "quiz-2" },
      body: { attemptId: "attempt-2", answers: [] },
      session: { user: { id: "user-2" } },
    });
    const res = createRes();

    await quizController.submitAttempt(req, res);

    expect(attempt.status).toBe("timed_out");
    expect(attempt.save).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          message: "Time limit exceeded. Your attempt has been marked as timed out.",
        }),
      })
    );
  });
});
