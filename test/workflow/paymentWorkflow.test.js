const crypto = require("crypto");

jest.mock("../../utils/razorpay", () => ({
  orders: {
    create: jest.fn(),
  },
}));

jest.mock("../../models/Payment", () => ({
  create: jest.fn(),
  findOneAndUpdate: jest.fn(),
  find: jest.fn(),
}));

jest.mock("../../models/user", () => ({
  updateOne: jest.fn(),
}));

const paymentController = require("../../controllers/paymentController");
const razorpay = require("../../utils/razorpay");
const Payment = require("../../models/Payment");
const User = require("../../models/user");

function createRes() {
  const status = jest.fn().mockReturnThis();
  const json = jest.fn();
  return { status, json };
}

describe("payment workflow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.RAZORPAY_KEY_ID = "rzp_test_key";
    process.env.RAZORPAY_KEY_SECRET = "secret_123";
  });

  test("createOrder persists provisional payment and returns order details", async () => {
    razorpay.orders.create.mockResolvedValue({
      id: "order_123",
      amount: 86800,
      currency: "INR",
    });

    const req = {
      body: {
        amount: 86800,
        paymentType: "subscription",
        metadata: { planDuration: 3 },
        userId: "user-1",
      },
      session: { user: { id: "fallback-user" } },
    };
    const res = createRes();

    await paymentController.createOrder(req, res);

    expect(razorpay.orders.create).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 86800, currency: "INR" }),
    );
    expect(Payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        razorpayOrderId: "order_123",
        razorpayPaymentId: "pending_order_123",
        status: "created",
        paymentType: "subscription",
      }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        orderId: "order_123",
        amount: 86800,
        keyId: "rzp_test_key",
      }),
    );
  });

  test("createOrder rejects invalid amount", async () => {
    const req = { body: { amount: 0 } };
    const res = createRes();

    await paymentController.createOrder(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false }),
    );
    expect(razorpay.orders.create).not.toHaveBeenCalled();
  });

  test("verifyPayment marks payment verified and upgrades subscription", async () => {
    const orderId = "order_abc";
    const paymentId = "pay_xyz";
    const signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    Payment.findOneAndUpdate.mockResolvedValue({
      paymentType: "subscription",
      metadata: { planDuration: 6 },
    });

    const req = {
      body: {
        razorpay_order_id: orderId,
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
      },
      session: { user: { id: "user-42", subscription: "Basic" } },
    };
    const res = createRes();

    await paymentController.verifyPayment(req, res);

    expect(Payment.findOneAndUpdate).toHaveBeenCalledWith(
      { razorpayOrderId: orderId },
      expect.objectContaining({
        $set: expect.objectContaining({
          razorpayPaymentId: paymentId,
          razorpaySignature: signature,
          status: "verified",
          userId: "user-42",
        }),
      }),
      { new: true },
    );
    expect(User.updateOne).toHaveBeenCalledWith(
      { userId: "user-42" },
      {
        $set: expect.objectContaining({
          subscription: "Premium",
          subscriptionDuration: 6,
          subscriptionExpiryDate: expect.any(Date),
        }),
      },
    );
    expect(req.session.user.subscription).toBe("Premium");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, subscriptionUpgraded: true }),
    );
  });

  test("verifyPayment returns 400 when required fields are missing", async () => {
    const req = {
      body: {
        razorpay_order_id: "order_missing",
      },
    };
    const res = createRes();

    await paymentController.verifyPayment(req, res);

    expect(Payment.findOneAndUpdate).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "Missing required payment verification fields.",
      }),
    );
  });

  test("verifyPayment marks payment failed for invalid signature", async () => {
    const req = {
      body: {
        razorpay_order_id: "order_bad",
        razorpay_payment_id: "pay_bad",
        razorpay_signature: "not-valid",
      },
      session: { user: { id: "user-99" } },
    };
    const res = createRes();

    await paymentController.verifyPayment(req, res);

    expect(Payment.findOneAndUpdate).toHaveBeenCalledWith(
      { razorpayOrderId: "order_bad" },
      {
        $set: {
          razorpayPaymentId: "pay_bad",
          status: "failed",
        },
      },
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false }),
    );
  });

  test("getMyPayments requires authenticated user", async () => {
    const req = { session: {} };
    const res = createRes();

    await paymentController.getMyPayments(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false }),
    );
  });

  test("getMyPayments returns user payments", async () => {
    const payments = [{ paymentId: "p-1", status: "verified" }];
    const lean = jest.fn().mockResolvedValue(payments);
    const sort = jest.fn().mockReturnValue({ lean });
    Payment.find.mockReturnValue({ sort });

    const req = { session: { user: { id: "user-1" } } };
    const res = createRes();

    await paymentController.getMyPayments(req, res);

    expect(Payment.find).toHaveBeenCalledWith({ userId: "user-1" });
    expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, payments });
  });

  test("markPaymentFailed validates required order id", async () => {
    const req = { body: {} };
    const res = createRes();

    await paymentController.markPaymentFailed(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false }),
    );
  });

  test("markPaymentFailed updates payment status", async () => {
    const req = {
      body: {
        razorpay_order_id: "order_1",
        razorpay_payment_id: "pay_1",
      },
    };
    const res = createRes();

    await paymentController.markPaymentFailed(req, res);

    expect(Payment.findOneAndUpdate).toHaveBeenCalledWith(
      { razorpayOrderId: "order_1" },
      {
        $set: {
          status: "failed",
          razorpayPaymentId: "pay_1",
        },
      },
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });
});



