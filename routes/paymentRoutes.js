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

/**
 * @swagger
 * tags:
 *   - name: REST - Payments
 *     description: Payment processing and Razorpay integration
 *
 * /api/payment/create-order:
 *   post:
 *     summary: Create a new Razorpay order
 *     tags: [REST - Payments]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount]
 *             properties:
 *               amount:
 *                 type: number
 *               currency:
 *                 type: string
 *                 default: INR
 *     responses:
 *       200:
 *         description: Order created
 *
 * /api/payment/verify:
 *   post:
 *     summary: Verify Razorpay payment signature
 *     tags: [REST - Payments]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [razorpay_order_id, razorpay_payment_id, razorpay_signature]
 *     responses:
 *       200:
 *         description: Payment verified
 *
 * /api/payment/fail:
 *   post:
 *     summary: Mark a payment as failed
 *     tags: [REST - Payments]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Failure recorded
 *
 * /api/payment/my-payments:
 *   get:
 *     summary: Get logged-in user's payments
 *     tags: [REST - Payments]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Payment history returned
 */

// POST /api/payment/create-order — Create a new Razorpay order
router.post("/create-order", createOrder);

// POST /api/payment/verify — Verify Razorpay payment signature
router.post("/verify", verifyPayment);

// POST /api/payment/fail — Mark a payment as failed
router.post("/fail", markPaymentFailed);

// GET /api/payment/my-payments — Get logged-in user's payments
router.get("/my-payments", cacheMiddleware(300), getMyPayments);

module.exports = router;
