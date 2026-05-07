const mongoose = require("mongoose");

const taskClaimSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  taskId: {
    type: String,
    required: true
  },

  reward: {
    type: Number,
    required: true
  },

  finalReward: {
    type: Number,
    required: true
  },

  claimedAt: {
    type: Date,
    default: Date.now
  }
});

taskClaimSchema.index({ userId: 1, taskId: 1, claimedAt: 1 });

module.exports = mongoose.model("TaskClaim", taskClaimSchema);