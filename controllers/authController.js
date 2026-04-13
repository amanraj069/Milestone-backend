const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");
const { User, Employer, Freelancer, Moderator } = require("../models");
const Admin = require("../models/admin");
const { generateOTP, sendOTPEmail } = require("../utils/emailService");

// Send OTP for email verification (called after password is entered)
exports.sendOtp = async (req, res) => {
  const { email, name, password, role } = req.body;
  try {
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Check if email already exists with a verified and fully registered user
    const existingUser = await User.findOne({ email });
    if (existingUser && existingUser.isVerified && existingUser.role) {
      return res.status(409).json({ error: "Email already exists" });
    }

    // Normalize role to proper case
    let normalizedRole = "";
    if (role) {
      switch ((role || "").toLowerCase()) {
        case "employer":
          normalizedRole = "Employer";
          break;
        case "freelancer":
          normalizedRole = "Freelancer";
          break;
        case "moderator":
          normalizedRole = "Moderator";
          break;
        case "admin":
          normalizedRole = "Admin";
          break;
        default:
          return res.status(400).json({ error: "Invalid role" });
      }
    }

    // Generate OTP and expiry (10 minutes)
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    // Hash the password if provided
    let hashedPassword = "temp_password_pending_verification";
    if (password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    // If user exists but not verified, update their details and OTP
    if (existingUser) {
      existingUser.otp = otp;
      existingUser.otpExpiry = otpExpiry;
      existingUser.name = name || existingUser.name;
      if (password) {
        existingUser.password = hashedPassword;
      }
      if (normalizedRole) {
        existingUser.role = normalizedRole;
      }
      await existingUser.save();
    } else {
      // Create a new user record with OTP (pending verification)
      const newUser = new User({
        userId: uuidv4(),
        email,
        password: hashedPassword,
        otp,
        otpExpiry,
        isVerified: false,
        name: name || "",
        role: normalizedRole || undefined, // Don't set empty string
      });
      await newUser.save();
    }

    // Send OTP email
    const emailResult = await sendOTPEmail(email, otp, name);
    if (!emailResult.success) {
      return res.status(500).json({ error: "Failed to send OTP email" });
    }

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully to your email",
    });
  } catch (error) {
    console.error("Send OTP error:", error);
    return res.status(500).json({ error: "Error sending OTP" });
  }
};

// Verify OTP
exports.verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  try {
    if (!email || !otp) {
      return res.status(400).json({ error: "Email and OTP are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if OTP matches
    if (user.otp !== otp) {
      return res.status(400).json({ error: "Invalid OTP" });
    }

    // Check if OTP is expired
    if (new Date() > new Date(user.otpExpiry)) {
      return res
        .status(400)
        .json({ error: "OTP has expired. Please request a new one." });
    }

    // Mark as verified but don't complete signup yet
    user.otp = null;
    user.otpExpiry = null;
    user.isVerified = true;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Email verified successfully",
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    return res.status(500).json({ error: "Error verifying OTP" });
  }
};

exports.signup = async (req, res) => {
  const { name, email, password, role } = req.body;
  try {
    if (!email || !role) {
      return res.status(400).json({ error: "Email and role are required" });
    }

    const existingUser = await User.findOne({ email });

    // Check if user exists and is verified
    if (!existingUser) {
      return res.status(400).json({ error: "Please verify your email first" });
    }

    if (!existingUser.isVerified) {
      return res.status(400).json({ error: "Please verify your email first" });
    }

    // Check if user is already fully registered (has roleId which means role entity was created)
    if (existingUser.roleId) {
      return res.status(409).json({ error: "Email already exists" });
    }

    // Normalize role to proper case
    let normalizedRole;
    switch ((role || "").toLowerCase()) {
      case "employer":
        normalizedRole = "Employer";
        break;
      case "freelancer":
        normalizedRole = "Freelancer";
        break;
      case "moderator":
        normalizedRole = "Moderator";
        break;
      case "admin":
        normalizedRole = "Admin";
        break;
      default:
        return res.status(400).json({ error: "Invalid role" });
    }

    const roleId = uuidv4();

    // Password was already hashed and saved during sendOtp, but if provided, update it
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      existingUser.password = hashedPassword;
    }

    // Update the existing verified user with full details
    existingUser.role = normalizedRole;
    existingUser.roleId = roleId;
    existingUser.name = name || existingUser.name;
    // Employers need moderator approval before they can access the platform
    existingUser.isApproved = normalizedRole !== "Employer";
    await existingUser.save();

    let roleEntity;
    switch (normalizedRole) {
      case "Employer":
        roleEntity = new Employer({
          employerId: roleId,
          userId: existingUser.userId,
        });
        break;
      case "Freelancer":
        roleEntity = new Freelancer({
          freelancerId: roleId,
          userId: existingUser.userId,
        });
        break;
      case "Moderator":
        roleEntity = new Moderator({
          moderatorId: roleId,
          userId: existingUser.userId,
        });
        break;
      case "Admin":
        roleEntity = new Admin({
          adminId: roleId,
          userId: existingUser.userId,
        });
        break;
      default:
        return res.status(400).json({ error: "Invalid role" });
    }

    await roleEntity.save();

    // Automatically log in the user after successful signup
    req.session.user = {
      id: existingUser.userId,
      email: existingUser.email,
      role: existingUser.role,
      name: existingUser.name,
      roleId: existingUser.roleId,
      subscription: existingUser.subscription || "Basic",
      picture: existingUser.picture,
      isApproved: existingUser.isApproved,
      authenticated: true,
    };

    req.session.save(() => res.status(201).json({ success: true }));
  } catch (error) {
    console.error("Signup error:", error);
    return res.status(500).json({ error: "Error creating account" });
  }
};

exports.login = async (req, res) => {
  const { email, password, role } = req.body;
  try {
    if (!email || !password || !role) {
      return res
        .status(400)
        .json({ error: "Missing email, password, or role" });
    }

    // Normalize role to proper case for consistent querying
    let normalizedRole;
    switch ((role || "").toLowerCase()) {
      case "employer":
        normalizedRole = "Employer";
        break;
      case "freelancer":
        normalizedRole = "Freelancer";
        break;
      case "moderator":
        normalizedRole = "Moderator";
        break;
      case "admin":
        normalizedRole = "Admin";
        break;
      default:
        return res.status(400).json({ error: "Invalid role" });
    }

    const user = await User.findOne({ email, role: normalizedRole });
    if (!user || !user.password) {
      return res.status(400).json({ error: "Invalid credentials" });
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(400).json({ error: "Invalid credentials" });
    }
    req.session.user = {
      id: user.userId,
      email: user.email,
      role: user.role,
      name: user.name,
      roleId: user.roleId,
      subscription: user.subscription || "Basic",
      picture: user.picture,
      isApproved: user.isApproved,
      authenticated: true,
    };
    req.session.save(() => res.json({ success: true }));
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Server error" });
  }
};

exports.logout = (req, res) => {
  const isProduction = process.env.NODE_ENV === "production";
  req.session.destroy(() => {
    res.clearCookie("connect.sid", {
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      httpOnly: true,
    });
    res.json({ success: true });
  });
};

// Send OTP for forgot password
exports.forgotPasswordSendOtp = async (req, res) => {
  const { email } = req.body;
  try {
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Check if user exists and is verified
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ error: "No account found with this email" });
    }

    if (!user.isVerified || !user.roleId) {
      return res
        .status(400)
        .json({ error: "Account not fully registered. Please sign up again." });
    }

    // Generate OTP and expiry (10 minutes)
    const otp = generateOTP();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000);

    // Save OTP to user
    user.otp = otp;
    user.otpExpiry = otpExpiry;
    await user.save();

    // Send OTP email
    const emailResult = await sendOTPEmail(email, otp, user.name, "reset");
    if (!emailResult.success) {
      return res.status(500).json({ error: "Failed to send OTP email" });
    }

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully to your email",
    });
  } catch (error) {
    console.error("Forgot password send OTP error:", error);
    return res.status(500).json({ error: "Error sending OTP" });
  }
};

// Verify OTP for forgot password
exports.forgotPasswordVerifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  try {
    if (!email || !otp) {
      return res.status(400).json({ error: "Email and OTP are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if OTP matches
    if (user.otp !== otp) {
      return res.status(400).json({ error: "Invalid OTP" });
    }

    // Check if OTP is expired
    if (new Date() > new Date(user.otpExpiry)) {
      return res
        .status(400)
        .json({ error: "OTP has expired. Please request a new one." });
    }

    // Don't clear OTP yet - we'll clear it after password reset
    // Just mark that OTP was verified by setting a temporary flag
    user.otpVerified = true;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully",
    });
  } catch (error) {
    console.error("Forgot password verify OTP error:", error);
    return res.status(500).json({ error: "Error verifying OTP" });
  }
};

// Reset password
exports.resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;
  try {
    if (!email || !otp || !newPassword) {
      return res
        .status(400)
        .json({ error: "Email, OTP, and new password are required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Verify OTP again for security
    if (user.otp !== otp) {
      return res.status(400).json({ error: "Invalid OTP" });
    }

    if (new Date() > new Date(user.otpExpiry)) {
      return res
        .status(400)
        .json({ error: "OTP has expired. Please request a new one." });
    }

    // Hash new password and save
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.otp = null;
    user.otpExpiry = null;
    user.otpVerified = false;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({ error: "Error resetting password" });
  }
};

exports.me = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.json({ user: null });
    }

    // Fetch fresh user data from database
    const User = require("../models/user");

    const user = await User.findOne({ userId: req.session.user.id })
      .select("userId name email role roleId picture subscription isApproved")
      .lean();

    if (!user) {
      req.session.destroy();
      return res.json({ user: null });
    }

    // DON'T modify req.session.user - just return fresh data
    // This way other endpoints that depend on session structure won't break
    return res.json({
      user: {
        id: user.userId,
        name: user.name,
        email: user.email,
        role: user.role,
        roleId: user.roleId,
        picture: user.picture, // Fresh from database
        subscription: user.subscription,
        isApproved: user.isApproved,
      },
    });
  } catch (error) {
    console.error("Error in /me endpoint:", error);
    return res.status(500).json({ error: "Failed to fetch user data" });
  }
};
