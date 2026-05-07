const mongoose = require("mongoose");

const withdrawalSchema = new mongoose.Schema({
  withdrawalId: {
    type: String,
    unique: true
  },

  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  fullName: String,
  email: String,

  amount: {
    type: Number,
    required: true
  },

  walletAddress: {
    type: String,
    required: true
  },

  network: {
    type: String,
    default: "USDT TRC20"
  },

  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending"
  },

  createdAt: {
    type: Date,
    default: Date.now
  },

  reviewedAt: {
    type: Date,
    default: null
  }
});

module.exports = mongoose.model("Withdrawal", withdrawalSchema);