const express = require("express");
const router = express.Router();

const User = require("../models/User");
const TradeCooldown = require("../models/TradeCooldown");
const Transaction = require("../models/Transaction");
const requireAuth = require("../middleware/auth");

const COOLDOWN_HOURS = 24;

const PLAN_CONFIG = {
  1: {
    name: "Starter",
    maxTrades: 2,
    monthlyProfit: 150
  },
  2: {
    name: "Pro",
    maxTrades: 3,
    monthlyProfit: 380
  },
  3: {
    name: "Elite",
    maxTrades: 5,
    monthlyProfit: 650
  },
  4: {
    name: "Legend",
    maxTrades: 6,
    monthlyProfit: 1150
  }
};

function getCooldownResetDate() {
  return new Date(Date.now() + COOLDOWN_HOURS * 60 * 60 * 1000);
}

function formatCooldownText(resetAt) {
  if (!resetAt) return "Available";

  const remainingMs = new Date(resetAt).getTime() - Date.now();

  if (remainingMs <= 0) {
    return "Available";
  }

  const hours = Math.floor(remainingMs / (1000 * 60 * 60));
  const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

  return `${hours}h ${minutes}m`;
}

function getRewardPerInvest(config) {
  return config.monthlyProfit / 30 / config.maxTrades;
}

router.get("/status", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    const planNumber = Number(user.plan || 0);
    const config = PLAN_CONFIG[planNumber];

    if (!user.planActive || !config) {
      return res.json({
        planActive: false,
        planName: "Free User",
        maxTrades: 0,
        usedTrades: 0,
        tradesLeft: 0,
        cooldownText: "Plan inactive",
        rewardPerInvest: 0,
        referralBoostPercent: 0,
        finalRewardPreview: 0
      });
    }

    let cooldown = await TradeCooldown.findOne({
      userId: user._id
    });

    if (
      cooldown &&
      cooldown.resetAt &&
      new Date(cooldown.resetAt).getTime() <= Date.now()
    ) {
      cooldown.usedTrades = 0;
      cooldown.resetAt = null;
      await cooldown.save();
    }

    const usedTrades = cooldown ? cooldown.usedTrades || 0 : 0;
    const tradesLeft = Math.max(config.maxTrades - usedTrades, 0);

    const activeReferralCount = Number(user.activeReferralCount || 0);

    const referralBoostPercent = activeReferralCount * 7;

    const rewardPerInvest = getRewardPerInvest(config);

    const finalRewardPreview =
      rewardPerInvest * (1 + activeReferralCount * 0.07);

    res.json({
      planActive: true,
      planName: user.planName || config.name,
      maxTrades: config.maxTrades,
      usedTrades,
      tradesLeft,
      cooldownText: cooldown && cooldown.resetAt
        ? formatCooldownText(cooldown.resetAt)
        : "Available",
      rewardPerInvest: Number(rewardPerInvest.toFixed(2)),
      referralBoostPercent,
      finalRewardPreview: Number(finalRewardPreview.toFixed(2))
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error"
    });
  }
});

router.post("/use", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    const planNumber = Number(user.plan || 0);
    const config = PLAN_CONFIG[planNumber];

    if (!user.planActive || !config) {
      return res.status(403).json({
        message: "You need an active plan to invest"
      });
    }

    let cooldown = await TradeCooldown.findOne({
      userId: user._id
    });

    if (!cooldown) {
      cooldown = await TradeCooldown.create({
        userId: user._id,
        usedTrades: 0,
        resetAt: null
      });
    }

    if (
      cooldown.resetAt &&
      new Date(cooldown.resetAt).getTime() <= Date.now()
    ) {
      cooldown.usedTrades = 0;
      cooldown.resetAt = null;
      await cooldown.save();
    }

    if (cooldown.usedTrades >= config.maxTrades) {
      return res.status(429).json({
        message: "Daily invest limit reached",
        cooldownText: formatCooldownText(cooldown.resetAt)
      });
    }

    const activeReferralCount = Number(user.activeReferralCount || 0);

    const rewardPerInvest = getRewardPerInvest(config);

    const referralBonusPercent = activeReferralCount * 0.07;

    const finalReward =
      rewardPerInvest * (1 + referralBonusPercent);

    user.balance =
      Number(user.balance || 0) + finalReward;

    await user.save();

    cooldown.usedTrades += 1;

    if (cooldown.usedTrades >= config.maxTrades) {
      cooldown.resetAt = getCooldownResetDate();
    }

    await cooldown.save();

    await Transaction.create({
      userId: user._id,
      type: "trade_simulation",
      title: "AI Investment Reward",
      amount: Number(finalReward.toFixed(2)),
      status: "completed",
      description: "AI Investment Reward",
      meta: {
        planNumber,
        planName: user.planName || config.name,
        baseReward: Number(rewardPerInvest.toFixed(2)),
        activeReferralCount,
        referralBonusPercent: activeReferralCount * 7,
        finalReward: Number(finalReward.toFixed(2))
      }
    });

    res.json({
      success: true,
      message: "Investment completed successfully",
      baseReward: Number(rewardPerInvest.toFixed(2)),
      activeReferralCount,
      referralBonusPercent: activeReferralCount * 7,
      finalReward: Number(finalReward.toFixed(2)),
      newBalance: Number(user.balance.toFixed(2)),
      usedTrades: cooldown.usedTrades,
      maxTrades: config.maxTrades,
      tradesLeft: Math.max(config.maxTrades - cooldown.usedTrades, 0),
      cooldownText: cooldown.resetAt
        ? formatCooldownText(cooldown.resetAt)
        : "Available"
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error"
    });
  }
});

module.exports = router;