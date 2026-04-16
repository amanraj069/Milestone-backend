const crypto = require("crypto");
const { createReq, createRes } = require("../helpers/httpMocks");

const mockOrdersCreate = jest.fn();
const mockPaymentCreate = jest.fn();
const mockPaymentFindOneAndUpdate = jest.fn();
const mockUserUpdateOne = jest.fn();

jest.mock("../../../utils/razorpay", () => ({
  orders: {
    create: (...args) => mockOrdersCreate(...args),
  },
}));

jest.mock("../../../models/Payment", () => ({
  create: (...args) => mockPaymentCreate(...args),
  findOneAndUpdate: (...args) => mockPaymentFindOneAndUpdate(...args),
}));

jest.mock("../../../models/user", () => ({
  updateOne: (...args) => mockUserUpdateOne(...args),
}));

const { createOrder, verifyPayment } = require("../../../controllers/paymentController");

describe("paymentController core financial-security tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.RAZORPAY_KEY_SECRET = "test-secret";
    process.env.RAZORPAY_KEY_ID = "test-key-id";
  });

  test("createOrder rejects non-positive amount to prevent payment tampering", async () => {
    const req = createReq({ body: { amount: 0 } });
    const res = createRes();

    await createOrder(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "A valid amount (in paise) is required.",
      })
    );
  });

  test("verifyPayment rejects invalid signature and marks payment failed", async () => {
    mockPaymentFindOneAndUpdate.mockResolvedValueOnce({});
    const req = createReq({
      body: {
        razorpay_order_id: "order_1",
        razorpay_payment_id: "pay_1",
        razorpay_signature: "invalid-signature",
      },
    });
    const res = createRes();

    await verifyPayment(req, res);

    expect(mockPaymentFindOneAndUpdate).toHaveBeenCalledWith(
      { razorpayOrderId: "order_1" },
      expect.objectContaining({ $set: expect.objectContaining({ status: "failed" }) })
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "Payment verification failed. Invalid signature.",
      })
    );
  });

  test("verifyPayment accepts valid signature and upgrades subscription for subscription payments", async () => {
    const razorpay_order_id = "order_valid";
    const razorpay_payment_id = "pay_valid";
    const razorpay_signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    mockPaymentFindOneAndUpdate.mockResolvedValueOnce({
      paymentType: "subscription",
      metadata: { planDuration: 2 },
    });
    mockUserUpdateOne.mockResolvedValueOnce({ acknowledged: true });

    const req = createReq({
      body: {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      },
      session: {
        user: {
          id: "user-1",
          subscription: "Basic",
        },
      },
    });
    const res = createRes();

    await verifyPayment(req, res);

    expect(mockPaymentFindOneAndUpdate).toHaveBeenCalledWith(
      { razorpayOrderId: razorpay_order_id },
      expect.objectContaining({
        $set: expect.objectContaining({
          razorpayPaymentId: razorpay_payment_id,
          razorpaySignature: razorpay_signature,
          status: "verified",
          userId: "user-1",
        }),
      }),
      { new: true }
    );
    expect(mockUserUpdateOne).toHaveBeenCalledWith(
      { userId: "user-1" },
      expect.objectContaining({ $set: expect.objectContaining({ subscription: "Premium" }) })
    );
    expect(req.session.user.subscription).toBe("Premium");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, subscriptionUpgraded: true })
    );
  });

  test("verifyPayment returns 400 when required verification fields are missing", async () => {
    const req = createReq({ body: { razorpay_order_id: "order_2" } });
    const res = createRes();

    await verifyPayment(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        message: "Missing required payment verification fields.",
      })
    );
  });
});
