const { createReq, createRes } = require("../helpers/httpMocks");

const mockUserFindOne = jest.fn();
const mockUserSave = jest.fn();
const mockBcryptHash = jest.fn();
const mockBcryptCompare = jest.fn();
const mockGenerateOtp = jest.fn();
const mockSendOtpEmail = jest.fn();

const MockUser = jest.fn((doc) => ({
  ...doc,
  save: mockUserSave,
}));
MockUser.findOne = mockUserFindOne;

const mockEmployerSave = jest.fn();
const MockEmployer = jest.fn((doc) => ({
  ...doc,
  save: mockEmployerSave,
}));

const MockFreelancer = jest.fn(() => ({ save: jest.fn() }));
const MockModerator = jest.fn(() => ({ save: jest.fn() }));
const MockAdmin = jest.fn(() => ({ save: jest.fn() }));

jest.mock("bcrypt", () => ({
  hash: (...args) => mockBcryptHash(...args),
  compare: (...args) => mockBcryptCompare(...args),
}));

jest.mock("../../../models", () => ({
  User: MockUser,
  Employer: MockEmployer,
  Freelancer: MockFreelancer,
  Moderator: MockModerator,
}));

jest.mock("../../../models/admin", () => MockAdmin);

jest.mock("../../../utils/emailService", () => ({
  generateOTP: (...args) => mockGenerateOtp(...args),
  sendOTPEmail: (...args) => mockSendOtpEmail(...args),
}));

const authController = require("../../../controllers/authController");

describe("authController core security tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBcryptHash.mockResolvedValue("hashed-password");
    mockBcryptCompare.mockResolvedValue(true);
    mockGenerateOtp.mockReturnValue("123456");
    mockSendOtpEmail.mockResolvedValue({ success: true });
  });

  test("sendOtp rejects invalid role to prevent role escalation", async () => {
    mockUserFindOne.mockResolvedValue(null);
    const req = createReq({
      body: {
        email: "u@test.com",
        role: "superadmin",
        password: "Secret123!",
      },
    });
    const res = createRes();

    await authController.sendOtp(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid role" });
  });

  test("sendOtp blocks duplicate verified users to prevent account takeover-by-reuse", async () => {
    mockUserFindOne.mockResolvedValue({
      isVerified: true,
      role: "Employer",
    });

    const req = createReq({ body: { email: "dup@test.com", role: "Employer" } });
    const res = createRes();

    await authController.sendOtp(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: "Email already exists" });
  });

  test("verifyOtp rejects expired OTP to prevent replay", async () => {
    mockUserFindOne.mockResolvedValue({
      otp: "123456",
      otpExpiry: new Date(Date.now() - 1_000).toISOString(),
      save: jest.fn(),
    });

    const req = createReq({ body: { email: "otp@test.com", otp: "123456" } });
    const res = createRes();

    await authController.verifyOtp(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "OTP has expired. Please request a new one.",
    });
  });

  test("signup keeps Employer unapproved until moderator action", async () => {
    const existingUser = {
      userId: "u-1",
      email: "employer@test.com",
      name: "Emp",
      isVerified: true,
      roleId: null,
      save: jest.fn().mockResolvedValue(true),
    };
    mockUserFindOne.mockResolvedValue(existingUser);

    const req = createReq({
      body: {
        name: "Emp",
        email: "employer@test.com",
        password: "Secret123!",
        role: "Employer",
      },
      session: {
        save: jest.fn((cb) => cb()),
      },
    });
    const res = createRes();

    await authController.signup(req, res);

    expect(existingUser.isApproved).toBe(false);
    expect(MockEmployer).toHaveBeenCalledTimes(1);
    expect(mockEmployerSave).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });
});
