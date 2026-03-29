const crypto = require("crypto");
const razorpay = require("../utils/razorpay");
const Payment = require("../models/Payment");

/**
 * @desc    Create a Razorpay order and persist initial payment record
 * @route   POST /api/payment/create-order
 * @body    { amount (in paise), currency, paymentType, metadata }
 */
const createOrder = async (req, res) => {
  try {
    const {
      amount,
      currency = "INR",
      paymentType = "subscription",
      metadata = {},
      userId,
    } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "A valid amount (in paise) is required.",
      });
    }

    const options = {
      amount: Number(amount), // amount already in paise from frontend
      currency,
      receipt: `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);
    const provisionalPaymentId = `pending_${order.id}`;

    // Persist a payment record with status "created"
    await Payment.create({
      userId: userId || req.session?.user?.id || "anonymous",
      razorpayOrderId: order.id,
      razorpayPaymentId: provisionalPaymentId,
      amount: order.amount,
      currency: order.currency,
      status: "created",
      paymentType,
      metadata,
    });

    return res.status(200).json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
    });
  } catch (error) {
    console.error("Razorpay createOrder error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create Razorpay order.",
    });
  }
};

/**
 * @desc    Verify Razorpay payment signature and update payment record
 * @route   POST /api/payment/verify
 * @body    { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 */
const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } =
      req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Missing required payment verification fields.",
      });
    }

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generatedSignature === razorpay_signature) {
      // Update the payment record to "verified"
      const payment = await Payment.findOneAndUpdate(
        { razorpayOrderId: razorpay_order_id },
        {
          $set: {
            razorpayPaymentId: razorpay_payment_id,
            razorpaySignature: razorpay_signature,
            status: "verified",
            ...(req.session?.user?.id && { userId: req.session.user.id }),
          },
        },
        { new: true },
      );

      // Auto-upgrade subscription if this is a subscription payment
      let subscriptionUpgraded = false;
      if (payment?.paymentType === "subscription" && req.session?.user?.id) {
        try {
          const User = require("../models/user");
          const userId = req.session.user.id;
          const duration = payment.metadata?.planDuration || 1;

          const expiryDate = new Date();
          expiryDate.setMonth(expiryDate.getMonth() + duration);

          await User.updateOne(
            { userId },
            {
              $set: {
                subscription: "Premium",
                subscriptionDuration: duration,
                subscriptionExpiryDate: expiryDate,
              },
            },
          );

          // Update session so subsequent requests reflect the upgrade
          req.session.user.subscription = "Premium";
          req.session.user.subscriptionDuration = duration;
          req.session.user.subscriptionExpiryDate = expiryDate;

          subscriptionUpgraded = true;
        } catch (upgradeErr) {
          console.error("Auto-upgrade subscription error:", upgradeErr);
          // Payment is still verified — upgrade can be retried via upgrade_subscription
        }
      }

      return res.status(200).json({
        success: true,
        paymentId: razorpay_payment_id,
        subscriptionUpgraded,
      });
    } else {
      // Mark as failed
      await Payment.findOneAndUpdate(
        { razorpayOrderId: razorpay_order_id },
        {
          $set: {
            razorpayPaymentId: razorpay_payment_id,
            status: "failed",
          },
        },
      );

      return res.status(400).json({
        success: false,
        message: "Payment verification failed. Invalid signature.",
      });
    }
  } catch (error) {
    console.error("Razorpay verifyPayment error:", error);
    return res.status(500).json({
      success: false,
      message: "Payment verification encountered an error.",
    });
  }
};

/**
 * @desc    Get all payments for the logged-in user
 * @route   GET /api/payment/my-payments
 */
const getMyPayments = async (req, res) => {
  try {
    const userId = req.session?.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Not logged in" });
    }

    const payments = await Payment.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ success: true, payments });
  } catch (error) {
    console.error("getMyPayments error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch payments." });
  }
};

/**
 * @desc    Mark a payment as failed (called by frontend on Razorpay payment.failed)
 * @route   POST /api/payment/fail
 * @body    { razorpay_order_id, razorpay_payment_id, error_reason }
 */
const markPaymentFailed = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, error_reason } = req.body;

    if (!razorpay_order_id) {
      return res.status(400).json({
        success: false,
        message: "Missing razorpay_order_id.",
      });
    }

    await Payment.findOneAndUpdate(
      { razorpayOrderId: razorpay_order_id },
      {
        $set: {
          status: "failed",
          ...(razorpay_payment_id && { razorpayPaymentId: razorpay_payment_id }),
        },
      },
    );

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("markPaymentFailed error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to mark payment as failed.",
    });
  }
};

module.exports = { createOrder, verifyPayment, getMyPayments, markPaymentFailed };
