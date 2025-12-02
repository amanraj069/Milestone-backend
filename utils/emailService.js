const nodemailer = require("nodemailer");

// Create transporter using environment variables
const createTransporter = () => {
  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

// Generate a 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP email
const sendOTPEmail = async (email, otp, name = "", type = "signup") => {
  const transporter = createTransporter();

  const isReset = type === "reset";
  const subject = isReset
    ? "Reset Your Password - Milestone OTP"
    : "Verify Your Email - Milestone OTP";
  const heading = isReset ? "Password Reset" : "Email Verification";
  const message = isReset
    ? "You requested to reset your password. Please use the following OTP to proceed:"
    : "Thank you for signing up with Milestone. Please use the following OTP to verify your email address:";

  const mailOptions = {
    from: `"Milestone" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: subject,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 40px; border-radius: 10px; margin-top: 20px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #2563eb; margin: 0; font-size: 28px;">Milestone</h1>
            <p style="color: #666; margin-top: 5px;">${heading}</p>
          </div>
          
          <div style="text-align: center;">
            <h2 style="color: #333; margin-bottom: 10px;">Hello${
              name ? ` ${name}` : ""
            }!</h2>
            <p style="color: #666; font-size: 16px; line-height: 1.6;">
              ${message}
            </p>
            
            <div style="background: linear-gradient(135deg, ${
              isReset ? "#dc2626 0%, #b91c1c" : "#2563eb 0%, #1d4ed8"
            } 100%); padding: 20px 40px; border-radius: 10px; margin: 30px 0; display: inline-block;">
              <span style="font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #ffffff;">${otp}</span>
            </div>
            
            <p style="color: #999; font-size: 14px;">
              This OTP is valid for <strong>10 minutes</strong>. Do not share it with anyone.
            </p>
          </div>
          
          <div style="border-top: 1px solid #eee; margin-top: 30px; padding-top: 20px; text-align: center;">
            <p style="color: #999; font-size: 12px; margin: 0;">
              If you didn't request this ${
                isReset ? "password reset" : "verification"
              }, please ignore this email.
            </p>
            <p style="color: #999; font-size: 12px; margin-top: 10px;">
              © ${new Date().getFullYear()} Milestone. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("OTP email sent:", info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("Error sending OTP email:", error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  generateOTP,
  sendOTPEmail,
};
