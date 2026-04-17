const bcrypt = require("bcrypt");

const mockUserSave = jest.fn();
const mockRoleSave = jest.fn();

const mockUserModel = jest.fn().mockImplementation((payload) => ({
  ...payload,
  save: mockUserSave,
}));
mockUserModel.findOne = jest.fn();

const mockEmployerModel = jest.fn().mockImplementation((payload) => ({
  ...payload,
  save: mockRoleSave,
}));
const mockFreelancerModel = jest.fn().mockImplementation((payload) => ({
  ...payload,
  save: mockRoleSave,
}));
const mockModeratorModel = jest.fn().mockImplementation((payload) => ({
  ...payload,
  save: mockRoleSave,
}));

const mockAdminSave = jest.fn();
const mockAdminModel = jest.fn().mockImplementation((payload) => ({
  ...payload,
  save: mockAdminSave,
}));

const mockGenerateOTP = jest.fn();
const mockSendOTPEmail = jest.fn();

jest.mock("bcrypt", () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

jest.mock("uuid", () => ({
  v4: jest.fn(() => "uuid-role-1"),
}));

jest.mock("../../models", () => ({
  User: mockUserModel,
  Employer: mockEmployerModel,
  Freelancer: mockFreelancerModel,
  Moderator: mockModeratorModel,
}));

jest.mock("../../models/admin", () => mockAdminModel);

jest.mock("../../utils/emailService", () => ({
  generateOTP: (...args) => mockGenerateOTP(...args),
  sendOTPEmail: (...args) => mockSendOTPEmail(...args),
}));

const authController = require("../../controllers/authController");
const { User } = require("../../models");

function createRes() {
  const status = jest.fn().mockReturnThis();
  const json = jest.fn();
  return { status, json };
}

describe("auth lifecycle coverage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGenerateOTP.mockReturnValue("123456");
    mockSendOTPEmail.mockResolvedValue({ success: true, messageId: "id-1" });
    bcrypt.hash.mockResolvedValue("hashed-password");
  });

  test("sendOtp rejects invalid role", async () => {
    User.findOne.mockResolvedValue(null);

    const req = {
      body: { email: "user@test.com", role: "wrong-role" },
    };
    const res = createRes();

    await authController.sendOtp(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid role" });
  });

  test("sendOtp blocks duplicate verified users", async () => {
    User.findOne.mockResolvedValue({
      isVerified: true,
      role: "Employer",
    });

    const req = {
      body: {
        email: "dup@test.com",
        role: "Employer",
      },
    };
    const res = createRes();

    await authController.sendOtp(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({ error: "Email already exists" });
  });

  test("sendOtp creates new pending user and sends otp email", async () => {
    User.findOne.mockResolvedValue(null);

    const req = {
      body: {
        email: "user@test.com",
        name: "Alice",
        password: "pass123",
        role: "freelancer",
      },
    };
    const res = createRes();

    await authController.sendOtp(req, res);

    expect(User).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "user@test.com",
        otp: "123456",
        role: "Freelancer",
      }),
    );
    expect(mockUserSave).toHaveBeenCalled();
    expect(mockSendOTPEmail).toHaveBeenCalledWith("user@test.com", "123456", "Alice");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
    );
  });

  test("verifyOtp marks user verified for matching otp", async () => {
    const save = jest.fn();
    User.findOne.mockResolvedValue({
      otp: "123456",
      otpExpiry: new Date(Date.now() + 100000).toISOString(),
      save,
    });

    const req = { body: { email: "user@test.com", otp: "123456" } };
    const res = createRes();

    await authController.verifyOtp(req, res);

    expect(save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
    );
  });

  test("verifyOtp rejects expired OTP", async () => {
    const save = jest.fn();
    User.findOne.mockResolvedValue({
      otp: "123456",
      otpExpiry: new Date(Date.now() - 1000).toISOString(),
      save,
    });

    const req = { body: { email: "otp@test.com", otp: "123456" } };
    const res = createRes();

    await authController.verifyOtp(req, res);

    expect(save).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "OTP has expired. Please request a new one.",
    });
  });

  test("signup creates employer role and sets approval false", async () => {
    const existingUser = {
      userId: "user-1",
      email: "emp@test.com",
      isVerified: true,
      save: jest.fn(),
      subscription: "Basic",
      picture: "pic.png",
      name: "Emp",
    };
    User.findOne.mockResolvedValue(existingUser);

    const req = {
      body: {
        name: "Emp",
        email: "emp@test.com",
        password: "new-pass",
        role: "employer",
      },
      session: {
        save: (cb) => cb(),
      },
    };
    const res = createRes();

    await authController.signup(req, res);

    expect(existingUser.role).toBe("Employer");
    expect(existingUser.isApproved).toBe(false);
    expect(mockEmployerModel).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1" }),
    );
    expect(mockRoleSave).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test("forgotPasswordSendOtp rejects non-existing user", async () => {
    User.findOne.mockResolvedValue(null);

    const req = { body: { email: "none@test.com" } };
    const res = createRes();

    await authController.forgotPasswordSendOtp(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining("No account") }),
    );
  });

  test("forgotPasswordVerifyOtp marks otpVerified true", async () => {
    const save = jest.fn();
    const user = {
      otp: "999999",
      otpExpiry: new Date(Date.now() + 100000).toISOString(),
      otpVerified: false,
      save,
    };
    User.findOne.mockResolvedValue(user);

    const req = { body: { email: "user@test.com", otp: "999999" } };
    const res = createRes();

    await authController.forgotPasswordVerifyOtp(req, res);

    expect(user.otpVerified).toBe(true);
    expect(save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test("resetPassword hashes and clears otp fields", async () => {
    const save = jest.fn();
    const user = {
      otp: "555555",
      otpExpiry: new Date(Date.now() + 100000).toISOString(),
      otpVerified: true,
      save,
    };
    User.findOne.mockResolvedValue(user);
    bcrypt.hash.mockResolvedValue("new-hash");

    const req = {
      body: { email: "user@test.com", otp: "555555", newPassword: "NewPass123" },
    };
    const res = createRes();

    await authController.resetPassword(req, res);

    expect(user.password).toBe("new-hash");
    expect(user.otp).toBeNull();
    expect(user.otpExpiry).toBeNull();
    expect(user.otpVerified).toBe(false);
    expect(save).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true }),
    );
  });
});


