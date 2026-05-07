const express = require("express");
const router = express.Router();

const User = require("../models/User");
const TaskClaim = require("../models/TaskClaim");
const Transaction = require("../models/Transaction");

const requireAuth = require("../middleware/auth");

const TASKS = {
  market_update: {
    title: "Watch market update",
    reward: 5
  },

  ai_strategy: {
    title: "Read AI strategy note",
    reward: 7
  },

  community_feed: {
    title: "Check community feed",
    reward: 3
  },

  weekly_portfolio: {
    title: "Complete weekly portfolio insight",
    reward: 20
  }
};

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

router.get("/status", requireAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const today = startOfToday();

    const claims = await TaskClaim.find({
      userId,
      claimedAt: {
        $gte: today
      }
    });

    const completedTaskIds = claims.map(c => c.taskId);

    const tasks = Object.entries(TASKS).map(([id, task]) => ({
      id,
      title: task.title,
      reward: task.reward,
      completed: completedTaskIds.includes(id)
    }));

    res.json({
      success: true,
      tasks
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error"
    });
  }
});

router.post("/complete", requireAuth, async (req, res) => {
  try {
    const { taskId } = req.body;
    const userId = req.userId;

    if (!taskId || !TASKS[taskId]) {
      return res.status(400).json({
        message: "Invalid task"
      });
    }

    const today = startOfToday();

    const alreadyClaimed = await TaskClaim.findOne({
      userId,
      taskId,
      claimedAt: {
        $gte: today
      }
    });

    if (alreadyClaimed) {
      return res.status(400).json({
        message: "Task already completed today"
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    const baseReward = TASKS[taskId].reward;

    const referralBonusPercent = user.referralCount * 0.10;
    const bonusAmount = baseReward * referralBonusPercent;
    const finalReward = baseReward + bonusAmount;

    user.balance += finalReward;
    await user.save();

    await TaskClaim.create({
      userId,
      taskId,
      reward: baseReward,
      finalReward
    });

    await Transaction.create({
      userId,
      type: "task_reward",
      title: TASKS[taskId].title,
      amount: Number(finalReward.toFixed(2)),
      status: "completed",
      referenceId: taskId,
      meta: {
        taskId,
        baseReward: Number(baseReward.toFixed(2)),
        referralCount: user.referralCount,
        referralBonusPercent: Number((referralBonusPercent * 100).toFixed(2)),
        bonusAmount: Number(bonusAmount.toFixed(2))
      }
    });

    res.json({
      success: true,
      message: "Task completed",
      taskId,
      baseReward: Number(baseReward.toFixed(2)),
      referralCount: user.referralCount,
      referralBonusPercent: Number((referralBonusPercent * 100).toFixed(2)),
      bonusAmount: Number(bonusAmount.toFixed(2)),
      finalReward: Number(finalReward.toFixed(2)),
      newBalance: Number(user.balance.toFixed(2))
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error"
    });
  }
});

module.exports = router;