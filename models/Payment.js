const mongoose = require('mongoose');
const { Schema } = mongoose;
const { v4: uuidv4 } = require('uuid');

const paymentSchema = new Schema(
  {
    paymentId: {
      type: String,
      required: true,
      unique: true,
      default: uuidv4,
    },
    userId: {
      type: String,
      required: true,
      index: true,
    },
    razorpayOrderId: {
      type: String,
      required: true,
      index: true,
    },
    razorpayPaymentId: {
      type: String,
      required: true,
      unique: true,
    },
    razorpaySignature: {
      type: String,
      default: null,
    },
    amount: {
      type: Number,
      required: true, // stored in paise
    },
    currency: {
      type: String,
      default: 'INR',
    },
    status: {
      type: String,
      enum: ['created', 'verified', 'failed'],
      default: 'created',
    },
    // What was this payment for?
    paymentType: {
      type: String,
      enum: ['subscription', 'platform_fee', 'boost'],
      required: true,
    },
    // Additional context depending on type
    metadata: {
      // For subscription payments
      planDuration: { type: Number, default: null },       // e.g. 3, 9, 12
      planDurationText: { type: String, default: null },   // e.g. "12 Months"
      planPrice: { type: Number, default: null },          // in rupees

      // For platform fee / boost payments
      jobId: { type: String, default: null },
      isBoosted: { type: Boolean, default: null },
      feeRate: { type: Number, default: null },            // total fee %
      feeAmount: { type: Number, default: null },          // in rupees
    },
  },
  { timestamps: true }
);

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;
