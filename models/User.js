const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({

  fullName: {
    type: String,
    required: true,
    trim: true
  },

  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },

  phone: {
    type: String,
    required: true
  },

  password: {
    type: String,
    required: true
  },

  balance: {
    type: Number,
    default: 0
  },

  referralCode: {
    type: String,
    unique: true
  },

  referredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },

  // Сите registrations преку referral
  referralCount: {
    type: Number,
    default: 0
  },

  // Само referrals кои купиле пакет и биле approved
  activeReferralCount: {
    type: Number,
    default: 0
  },

  plan: {
    type: Number,
    default: 0
  },

  planName: {
    type: String,
    default: "Free User"
  },

  planActive: {
    type: Boolean,
    default: false
  },

  planActivatedAt: {
    type: Date,
    default: null
  },

  createdAt: {
    type: Date,
    default: Date.now
  }

});

module.exports = mongoose.model("User", userSchema);