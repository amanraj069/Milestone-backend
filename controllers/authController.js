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
    const roleId = uuidv4();
    const userId = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      userId,
      email,
      password: hashedPassword,
      role,
      roleId,
      name: name || "",
    });

    let roleEntity;
    switch ((role || "").toLowerCase()) {
      case "employer":
        roleEntity = new Employer({ employerId: roleId, userId });
        break;
      case "freelancer":
        roleEntity = new Freelancer({ freelancerId: roleId, userId });
        break;
      case "admin":
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
    const user = await User.findOne({ email, role });
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

exports.me = (req, res) => {
  if (!req.session.user) return res.json({ user: null });
  return res.json({ user: req.session.user });
};
