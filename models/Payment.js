const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({

  paymentId: {
    type: String,
    required: true,
    unique: true
  },

  fullName: {
    type: String,
    default: "Demo User"
  },

  referralBonusApplied: {
  type: Boolean,
  default: false
  }

  email: {
    type: String,
    default: "demo@lumina.local"
  },

  planNumber: {
    type: Number,
    required: true
  },

  planName: {
    type: String,
    required: true
  },

  amount: {
    type: Number,
    required: true
  },

  network: {
    type: String,
    default: "USDT TRC20"
  },

  txid: {
    type: String,
    default: ""
  },

  proofImage: {
    type: String,
    default: ""
  },

  proofImageName: {
    type: String,
    default: ""
  },

  status: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending"
  },

  createdAt: {
    type: Date,
    default: Date.now
  }

});

module.exports = mongoose.model("Payment", paymentSchema);