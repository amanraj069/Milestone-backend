const bcrypt = require("bcrypt");

jest.mock("bcrypt", () => ({
  compare: jest.fn(),
}));

jest.mock("../../models", () => ({
  User: {
    findOne: jest.fn(),
  },
  Employer: {},
  Freelancer: {},
  Moderator: {},
}));

jest.mock("../../models/user", () => ({
  findOne: jest.fn(),
}));

const authController = require("../../controllers/authController");
const { User } = require("../../models");
const UserModel = require("../../models/user");

describe("authController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("login", () => {
    test("returns 400 for missing required fields", async () => {
      const req = { body: { email: "user@example.com" }, session: {} };
      const status = jest.fn().mockReturnThis();
      const json = jest.fn();
      const res = { status, json };

      await authController.login(req, res);

      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.stringContaining("Missing") }),
      );
    });

    test("returns 400 for invalid role", async () => {
      const req = {
        body: {
          email: "user@example.com",
          password: "pass123",
          role: "invalid",
        },
        session: {},
      };
      const status = jest.fn().mockReturnThis();
      const json = jest.fn();
      const res = { status, json };

      await authController.login(req, res);

      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith({ error: "Invalid role" });
    });

    test("returns 400 for invalid credentials when user is missing", async () => {
      User.findOne.mockResolvedValue(null);

      const req = {
        body: {
          email: "user@example.com",
          password: "pass123",
          role: "Freelancer",
        },
        session: {},
      };
      const status = jest.fn().mockReturnThis();
      const json = jest.fn();
      const res = { status, json };

      await authController.login(req, res);

      expect(User.findOne).toHaveBeenCalledWith({
        email: "user@example.com",
        role: "Freelancer",
      });
      expect(status).toHaveBeenCalledWith(400);
      expect(json).toHaveBeenCalledWith({ error: "Invalid credentials" });
    });

    test("creates session and returns success on valid credentials", async () => {
      const save = jest.fn((cb) => cb());
      User.findOne.mockResolvedValue({
        userId: "u-1",
        email: "user@example.com",
        role: "Freelancer",
        name: "Test User",
        roleId: "f-1",
        subscription: "Basic",
        picture: "img.png",
        isApproved: true,
        password: "hashed-pass",
      });
      bcrypt.compare.mockResolvedValue(true);

      const req = {
        body: {
          email: "user@example.com",
          password: "pass123",
          role: "Freelancer",
        },
        session: { save },
      };
      const json = jest.fn();
      const res = { json };

      await authController.login(req, res);

      expect(bcrypt.compare).toHaveBeenCalledWith("pass123", "hashed-pass");
      expect(req.session.user).toEqual(
        expect.objectContaining({
          id: "u-1",
          role: "Freelancer",
          authenticated: true,
        }),
      );
      expect(json).toHaveBeenCalledWith({ success: true });
    });
  });

  describe("me", () => {
    test("returns null user when no active session", async () => {
      const req = { session: {} };
      const json = jest.fn();
      const res = { json };

      await authController.me(req, res);

      expect(json).toHaveBeenCalledWith({ user: null });
    });

    test("returns fresh user data from database", async () => {
      const lean = jest.fn().mockResolvedValue({
        userId: "u-1",
        name: "Test User",
        email: "user@example.com",
        role: "Freelancer",
        roleId: "f-1",
        picture: "img.png",
        subscription: "Premium",
        isApproved: true,
      });
      const select = jest.fn(() => ({ lean }));
      UserModel.findOne.mockReturnValue({ select });

      const req = { session: { user: { id: "u-1" }, destroy: jest.fn() } };
      const json = jest.fn();
      const res = { json };

      await authController.me(req, res);

      expect(UserModel.findOne).toHaveBeenCalledWith({ userId: "u-1" });
      expect(json).toHaveBeenCalledWith({
        user: {
          id: "u-1",
          name: "Test User",
          email: "user@example.com",
          role: "Freelancer",
          roleId: "f-1",
          picture: "img.png",
          subscription: "Premium",
          isApproved: true,
        },
      });
    });

    test("destroys stale session when user no longer exists", async () => {
      const lean = jest.fn().mockResolvedValue(null);
      const select = jest.fn(() => ({ lean }));
      UserModel.findOne.mockReturnValue({ select });

      const destroy = jest.fn();
      const req = { session: { user: { id: "u-404" }, destroy } };
      const json = jest.fn();
      const res = { json };

      await authController.me(req, res);

      expect(destroy).toHaveBeenCalled();
      expect(json).toHaveBeenCalledWith({ user: null });
    });
  });
});



