const express = require("express");
const router = express.Router();
const {
  cacheMiddleware,
  invalidateCacheMiddleware,
} = require("../middleware/cacheMiddleware");

// Invalidate payment caches on mutations
router.use(invalidateCacheMiddleware("api/payment"));
const {
  createOrder,
  verifyPayment,
  getMyPayments,
  markPaymentFailed,
} = require("../controllers/paymentController");

// POST /api/payment/create-order — Create a new Razorpay order
router.post("/create-order", createOrder);

// POST /api/payment/verify — Verify Razorpay payment signature
router.post("/verify", verifyPayment);

// POST /api/payment/fail — Mark a payment as failed
router.post("/fail", markPaymentFailed);

// GET /api/payment/my-payments — Get logged-in user's payments
router.get("/my-payments", cacheMiddleware(300), getMyPayments);

module.exports = router;
