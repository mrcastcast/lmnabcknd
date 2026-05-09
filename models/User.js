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

  emailVerified: {
    type: Boolean,
    default: false
  },

  verificationCode: {
    type: String,
    default: null
  },

  verificationCodeExpires: {
    type: Date,
    default: null
  },

  resetPasswordCode: {
  type: String,
  default: null
  },

  resetPasswordExpires: {
  type: Date,
  default: null
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

  referralCount: {
    type: Number,
    default: 0
  },

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