const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  type: {
    type: String,
    enum: [
      "task_reward",
      "payment_approved",
      "withdrawal_request",
      "withdrawal_approved",
      "withdrawal_rejected_refund",
      "trade_simulation"
    ],
    required: true
  },

  title: {
    type: String,
    required: true
  },

  amount: {
    type: Number,
    default: 0
  },

  status: {
    type: String,
    enum: ["completed", "pending", "approved", "rejected"],
    default: "completed"
  },

  referenceId: {
    type: String,
    default: ""
  },

  meta: {
    type: Object,
    default: {}
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("Transaction", transactionSchema);