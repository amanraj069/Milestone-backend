const mockSendMail = jest.fn();

jest.mock("nodemailer", () => ({
  createTransport: jest.fn(() => ({
    sendMail: (...args) => mockSendMail(...args),
  })),
}));

const nodemailer = require("nodemailer");
const { generateOTP, sendOTPEmail } = require("../../utils/emailService");

describe("emailService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.EMAIL_SERVICE = "gmail";
    process.env.EMAIL_USER = "milestone@test.com";
    process.env.EMAIL_PASS = "secret";
  });

  test("generateOTP returns a 6-digit numeric string", () => {
    const otp = generateOTP();

    expect(otp).toMatch(/^\d{6}$/);
  });

  test("sendOTPEmail sends signup verification mail", async () => {
    mockSendMail.mockResolvedValue({ messageId: "msg-1" });

    const result = await sendOTPEmail("user@test.com", "123456", "Alice", "signup");

    expect(nodemailer.createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        service: "gmail",
        auth: {
          user: "milestone@test.com",
          pass: "secret",
        },
      }),
    );
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "user@test.com",
        subject: "Verify Your Email - Milestone OTP",
        html: expect.stringContaining("123456"),
      }),
    );
    expect(result).toEqual({ success: true, messageId: "msg-1" });
  });

  test("sendOTPEmail sends reset mail", async () => {
    mockSendMail.mockResolvedValue({ messageId: "msg-reset" });

    const result = await sendOTPEmail("user@test.com", "654321", "Bob", "reset");

    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Reset Your Password - Milestone OTP",
      }),
    );
    expect(result).toEqual({ success: true, messageId: "msg-reset" });
  });

  test("sendOTPEmail returns failure when transporter throws", async () => {
    mockSendMail.mockRejectedValue(new Error("smtp down"));

    const result = await sendOTPEmail("user@test.com", "111111", "", "signup");

    expect(result).toEqual({ success: false, error: "smtp down" });
  });
});


