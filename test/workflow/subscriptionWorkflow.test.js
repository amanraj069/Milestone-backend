jest.mock("../../models/job_listing", () => ({}));
jest.mock("../../models/job_application", () => ({}));
jest.mock("../../models/complaint", () => ({}));
jest.mock("../../models/freelancer", () => ({}));

jest.mock("../../models/user", () => ({
  updateOne: jest.fn(),
  findOne: jest.fn(),
}));

jest.mock("../../models/employer", () => ({
  findByIdAndUpdate: jest.fn(),
}));

jest.mock("../../models/Payment", () => ({
  findOneAndUpdate: jest.fn(),
}));

jest.mock("../../middleware/pdfUpload", () => ({
  uploadToCloudinary: jest.fn(),
}));

jest.mock("../../middleware/imageUpload", () => ({
  uploadToCloudinary: jest.fn(),
}));

const employerController = require("../../controllers/employerController");
const freelancerController = require("../../controllers/feelancerController");

const User = require("../../models/user");
const Employer = require("../../models/employer");
const Payment = require("../../models/Payment");

function createRes() {
  const status = jest.fn().mockReturnThis();
  const json = jest.fn();
  const send = jest.fn();
  const render = jest.fn();
  return { status, json, send, render };
}

describe("subscription workflow (employer + freelancer)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("employer subscription", () => {
    test("upgradeSubscription updates user, links payment, and updates session", async () => {
      const req = {
        body: {
          duration: 3,
          paymentDetails: { razorpayOrderId: "order_emp_1" },
        },
        session: { user: { id: "user-emp-1", subscription: "Basic" } },
      };
      const res = createRes();

      await employerController.upgradeSubscription(req, res);

      expect(User.updateOne).toHaveBeenCalledWith(
        { userId: "user-emp-1" },
        {
          $set: expect.objectContaining({
            subscription: "Premium",
            subscriptionDuration: 3,
            subscriptionExpiryDate: expect.any(Date),
          }),
        },
      );
      expect(Payment.findOneAndUpdate).toHaveBeenCalledWith(
        { razorpayOrderId: "order_emp_1" },
        { $set: { userId: "user-emp-1" } },
      );
      expect(req.session.user.subscription).toBe("Premium");
      expect(req.session.user.subscriptionDuration).toBe(3);
      expect(req.session.user.subscriptionExpiryDate).toBeInstanceOf(Date);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );
    });

    test("downgradeSubscription resets premium fields", async () => {
      const req = {
        session: {
          user: {
            id: "user-emp-2",
            subscription: "Premium",
            subscriptionDuration: 6,
            subscriptionExpiryDate: new Date(),
          },
        },
      };
      const res = createRes();

      await employerController.downgradeSubscription(req, res);

      expect(User.updateOne).toHaveBeenCalledWith(
        { userId: "user-emp-2" },
        {
          $set: { subscription: "Basic" },
          $unset: { subscriptionDuration: "", subscriptionExpiryDate: "" },
        },
      );
      expect(req.session.user.subscription).toBe("Basic");
      expect(req.session.user.subscriptionDuration).toBeUndefined();
      expect(req.session.user.subscriptionExpiryDate).toBeUndefined();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );
    });

    test("purchaseSubscription for Premium returns payment redirect", async () => {
      const req = {
        body: { planType: "Premium", amount: 999 },
        session: { user: { id: "user-emp-3", subscription: "Basic" } },
      };
      const res = createRes();

      await employerController.purchaseSubscription(req, res);

      expect(Employer.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          requiresPayment: true,
          amount: 999,
          redirectUrl: "/employerD/payment?plan=Premium&amount=999",
        }),
      );
    });

    test("purchaseSubscription for Basic updates employer and session", async () => {
      const req = {
        body: { planType: "Basic" },
        session: { user: { id: "user-emp-4", subscription: "Premium" } },
      };
      const res = createRes();

      await employerController.purchaseSubscription(req, res);

      expect(Employer.findByIdAndUpdate).toHaveBeenCalledWith("user-emp-4", {
        subscription: "Basic",
      });
      expect(req.session.user.subscription).toBe("Basic");
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, requiresPayment: false }),
      );
    });
  });

  describe("freelancer subscription", () => {
    test("upgradeSubscription updates user, links payment, and updates session", async () => {
      const req = {
        body: {
          duration: 12,
          paymentDetails: { razorpayOrderId: "order_fr_1" },
        },
        session: { user: { id: "user-fr-1", subscription: "Basic" } },
      };
      const res = createRes();

      await freelancerController.upgradeSubscription(req, res);

      expect(User.updateOne).toHaveBeenCalledWith(
        { userId: "user-fr-1" },
        {
          $set: expect.objectContaining({
            subscription: "Premium",
            subscriptionDuration: 12,
            subscriptionExpiryDate: expect.any(Date),
          }),
        },
      );
      expect(Payment.findOneAndUpdate).toHaveBeenCalledWith(
        { razorpayOrderId: "order_fr_1" },
        { $set: { userId: "user-fr-1" } },
      );
      expect(req.session.user.subscription).toBe("Premium");
      expect(req.session.user.subscriptionDuration).toBe(12);
      expect(req.session.user.subscriptionExpiryDate).toBeInstanceOf(Date);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );
    });

    test("downgradeSubscription resets premium fields", async () => {
      const req = {
        session: {
          user: {
            id: "user-fr-2",
            subscription: "Premium",
            subscriptionDuration: 9,
            subscriptionExpiryDate: new Date(),
          },
        },
      };
      const res = createRes();

      await freelancerController.downgradeSubscription(req, res);

      expect(User.updateOne).toHaveBeenCalledWith(
        { userId: "user-fr-2" },
        {
          $set: { subscription: "Basic" },
          $unset: { subscriptionDuration: "", subscriptionExpiryDate: "" },
        },
      );
      expect(req.session.user.subscription).toBe("Basic");
      expect(req.session.user.subscriptionDuration).toBeUndefined();
      expect(req.session.user.subscriptionExpiryDate).toBeUndefined();
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );
    });
  });
});



