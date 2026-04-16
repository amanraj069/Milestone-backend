const mockQuizSave = jest.fn();
const MockQuiz = jest.fn().mockImplementation((payload) => ({
  ...payload,
  _id: payload._id || "quiz-1",
  save: mockQuizSave,
}));
MockQuiz.countDocuments = jest.fn();
MockQuiz.distinct = jest.fn();
MockQuiz.aggregate = jest.fn();
MockQuiz.findById = jest.fn();
MockQuiz.findByIdAndUpdate = jest.fn();
MockQuiz.findByIdAndDelete = jest.fn();
MockQuiz.find = jest.fn();

const mockAttemptFindById = jest.fn();

const MockBadge = jest.fn().mockImplementation((payload) => ({
  ...payload,
  save: jest.fn().mockResolvedValue(true),
}));
MockBadge.findOne = jest.fn();

jest.mock("../../models/Quiz", () => MockQuiz);
jest.mock("../../models/Attempt", () => ({
  find: jest.fn(),
  countDocuments: jest.fn(),
  findById: (...args) => mockAttemptFindById(...args),
}));
jest.mock("../../models/Badge", () => MockBadge);
jest.mock("../../models/UserBadge", () => ({
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
}));

const quizController = require("../../controllers/quizController");
const Quiz = require("../../models/Quiz");
const Badge = require("../../models/Badge");

function createRes() {
  const status = jest.fn().mockReturnThis();
  const json = jest.fn();
  return { status, json };
}

describe("quizController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQuizSave.mockResolvedValue(true);
  });

  test("createQuiz returns 400 for invalid payload", async () => {
    const req = { body: null, session: { user: { _id: "mod-1" } } };
    const res = createRes();

    await quizController.createQuiz(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false }),
    );
  });

  test("createQuiz validates minimum fields", async () => {
    const req = {
      body: { title: "Hi", skillName: "J", questions: [] },
      session: { user: { _id: "mod-1" } },
    };
    const res = createRes();

    await quizController.createQuiz(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test("createQuiz saves quiz and auto-creates badge", async () => {
    Badge.findOne.mockResolvedValue(null);

    const req = {
      body: {
        title: "React Mastery",
        skillName: "React",
        passingScore: 60,
        questions: [
          {
            text: "What is JSX?",
            marks: 5,
            options: [{ text: "A", isCorrect: true }],
          },
        ],
      },
      session: { user: { _id: "mod-1" } },
    };
    const res = createRes();

    await quizController.createQuiz(req, res);

    expect(Quiz).toHaveBeenCalledWith(
      expect.objectContaining({ title: "React Mastery", createdBy: "mod-1" }),
    );
    expect(mockQuizSave).toHaveBeenCalled();
    expect(Badge).toHaveBeenCalledWith(
      expect.objectContaining({
        skillName: "React",
        criteria: expect.objectContaining({ quizId: "quiz-1", minPercentage: 60 }),
      }),
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
    );
  });

  test("listQuizzes returns paginated response", async () => {
    Quiz.countDocuments.mockResolvedValue(2);
    Quiz.distinct.mockResolvedValue(["React"]);
    Quiz.aggregate
      .mockResolvedValueOnce([
        { _id: "quiz-1", title: "Quiz 1", questionCount: 2 },
        { _id: "quiz-2", title: "Quiz 2", questionCount: 3 },
      ])
      .mockResolvedValueOnce([{ totalQuestions: 5, avgPassingScore: 55 }]);

    const req = {
      query: { page: "1", limit: "2", search: "Quiz", sortBy: "newest" },
    };
    const res = createRes();

    await quizController.listQuizzes(req, res);

    expect(Quiz.countDocuments).toHaveBeenCalled();
    expect(Quiz.aggregate).toHaveBeenCalledTimes(2);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          total: 2,
          pagination: expect.objectContaining({ page: 1, limit: 2, totalPages: 1 }),
          summary: expect.objectContaining({ totalQuizzes: 2, totalQuestions: 5 }),
        }),
      }),
    );
  });

  test("reportViolation auto-terminates at max violations", async () => {
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
    Quiz.findById.mockResolvedValue({ maxViolations: 2 });

    const req = {
      body: { attemptId: "attempt-1", type: "fullscreen_exit" },
      session: { user: { id: "user-1" } },
    };
    const res = createRes();

    await quizController.reportViolation(req, res);

    expect(attempt.status).toBe("auto_terminated");
    expect(attempt.violationsCount).toBe(2);
    expect(attempt.save).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          terminated: true,
          violationsCount: 2,
          maxViolations: 2,
        }),
      }),
    );
  });

  test("submitAttempt rejects timed-out attempts", async () => {
    const attempt = {
      _id: "attempt-2",
      userId: "user-2",
      quizId: "quiz-2",
      status: "in_progress",
      startedAt: new Date(Date.now() - 5 * 60 * 1000),
      save: jest.fn().mockResolvedValue(true),
      violations: [],
    };

    Quiz.findById.mockResolvedValue({
      _id: "quiz-2",
      timeLimitMinutes: 1,
      questions: [{ _id: "q1", marks: 10, options: [{ isCorrect: true }] }],
      passingScore: 50,
      violationPenaltyPercent: 5,
      title: "Quiz",
      skillName: "JS",
    });
    mockAttemptFindById.mockResolvedValue(attempt);

    const req = {
      params: { id: "quiz-2" },
      body: { attemptId: "attempt-2", answers: [] },
      session: { user: { id: "user-2" } },
    };
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
      }),
    );
  });
});
