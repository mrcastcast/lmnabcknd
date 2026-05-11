const mongoose = require("mongoose");

const tradeCooldownSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true
  },

  usedTrades: {
    type: Number,
    default: 0
  },

  resetAt: {
    type: Date,
    default: null
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model("TradeCooldown", tradeCooldownSchema);