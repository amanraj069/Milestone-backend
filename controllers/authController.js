const bcrypt = require("bcrypt");
const { v4: uuidv4 } = require("uuid");
const { User, Employer, Freelancer, Admin } = require("../models");

exports.signup = async (req, res) => {
  const { name, email, password, role } = req.body;
  try {
    if (!email || !password || !role) {
      return res
        .status(400)
        .json({ error: "Email, password, and role are required" });
    }
    const existingUser = await User.findOne({ email });
    if (existingUser) {
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
      case "admin":
        normalizedRole = "Admin";
        break;
      default:
        return res.status(400).json({ error: "Invalid role" });
    }

    const roleId = uuidv4();
    const userId = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      userId,
      email,
      password: hashedPassword,
      role: normalizedRole,
      roleId,
      name: name || "",
    });

    let roleEntity;
    switch (normalizedRole) {
      case "Employer":
        roleEntity = new Employer({ employerId: roleId, userId });
        break;
      case "Freelancer":
        roleEntity = new Freelancer({ freelancerId: roleId, userId });
        break;
      case "Admin":
        roleEntity = new Admin({ adminId: roleId, userId });
        break;
      default:
        return res.status(400).json({ error: "Invalid role" });
    }

    await newUser.save();
    await roleEntity.save();

    // Automatically log in the user after successful signup
    req.session.user = {
      id: newUser.userId,
      email: newUser.email,
      role: newUser.role,
      name: newUser.name,
      roleId: newUser.roleId,
      subscription: newUser.subscription || 'Basic',
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
      subscription: user.subscription || 'Basic',
      authenticated: true,
    };
    req.session.save(() => res.json({ success: true }));
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ error: "Server error" });
  }
};

exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ success: true });
  });
};

exports.me = async (req, res) => {
  try {
    if (!req.session.user) {
      return res.json({ user: null });
    }

    // Fetch fresh user data from database
    const User = require('../models/user');
    
    const user = await User.findOne({ userId: req.session.user.id })
      .select('userId name email role picture subscription')
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
        picture: user.picture, // Fresh from database
        subscription: user.subscription
      }
    });
  } catch (error) {
    console.error('Error in /me endpoint:', error);
    return res.status(500).json({ error: 'Failed to fetch user data' });
  }
};