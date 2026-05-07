const express = require("express");
const router = express.Router();

const User = require("../models/User");
const TradeCooldown = require("../models/TradeCooldown");
const Transaction = require("../models/Transaction");
const requireAuth = require("../middleware/auth");

const PLAN_CONFIG = {
  1: {
    name: "Starter",
    maxInvests: 2,
    cooldownHours: 24,
    rewardPerInvest: 2.50
  },

  2: {
    name: "Pro",
    maxInvests: 3,
    cooldownHours: 24,
    rewardPerInvest: 4.22
  },

  3: {
    name: "Elite",
    maxInvests: 5,
    cooldownHours: 24,
    rewardPerInvest: 4.33
  },

  4: {
    name: "Legend",
    maxInvests: 6,
    cooldownHours: 24,
    rewardPerInvest: 6.39
  }
};

function getPlanConfig(plan) {
  return PLAN_CONFIG[Number(plan)] || null;
}

function getRemainingMs(cooldownStart, cooldownHours) {
  const cooldownMs = cooldownHours * 60 * 60 * 1000;
  const endTime = new Date(cooldownStart).getTime() + cooldownMs;

  return Math.max(0, endTime - Date.now());
}

function formatCooldown(ms) {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);

  return `${hours}h ${minutes}m ${seconds}s`;
}

async function getOrResetCooldown(userId, cooldownHours) {
  let cooldown = await TradeCooldown.findOne({ userId });

  if (!cooldown) {
    cooldown = await TradeCooldown.create({
      userId,
      tradesUsed: 0,
      cooldownStart: new Date()
    });
  }

  const remainingMs = getRemainingMs(cooldown.cooldownStart, cooldownHours);

  if (remainingMs <= 0) {
    cooldown.tradesUsed = 0;
    cooldown.cooldownStart = new Date();
    await cooldown.save();
  }

  return cooldown;
}

router.get("/status", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    if (!user.planActive || user.plan === 0) {
      return res.json({
        success: true,
        plan: user.plan,
        planName: user.planName || "Free User",
        planActive: false,
        maxTrades: 0,
        maxInvests: 0,
        tradesUsed: 0,
        tradesLeft: 0,
        investsLeft: 0,
        rewardPerInvest: 0,
        activeReferralCount: user.activeReferralCount || 0,
        referralBoostPercent: 0,
        cooldownRemainingMs: 0,
        cooldownText: "No active plan"
      });
    }

    const config = getPlanConfig(user.plan);

    if (!config) {
      return res.status(400).json({
        message: "Invalid plan"
      });
    }

    const cooldown = await getOrResetCooldown(user._id, config.cooldownHours);

    const remainingMs = getRemainingMs(
      cooldown.cooldownStart,
      config.cooldownHours
    );

    const investsLeft = Math.max(0, config.maxInvests - cooldown.tradesUsed);

    const activeReferralCount = user.activeReferralCount || 0;
    const referralBoostPercent = activeReferralCount * 20;
    const finalRewardPreview = config.rewardPerInvest * (1 + activeReferralCount * 0.20);

    res.json({
      success: true,
      plan: user.plan,
      planName: user.planName,
      planActive: user.planActive,
      maxTrades: config.maxInvests,
      maxInvests: config.maxInvests,
      tradesUsed: cooldown.tradesUsed,
      tradesLeft: investsLeft,
      investsLeft,
      baseRewardPerInvest: config.rewardPerInvest,
      rewardPerInvest: Number(finalRewardPreview.toFixed(2)),
      activeReferralCount,
      referralBoostPercent,
      cooldownHours: config.cooldownHours,
      cooldownStart: cooldown.cooldownStart,
      cooldownRemainingMs: remainingMs,
      cooldownText: formatCooldown(remainingMs)
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

    if (!user.planActive || user.plan === 0) {
      return res.status(403).json({
        message: "Your plan is not active yet"
      });
    }

    const config = getPlanConfig(user.plan);

    if (!config) {
      return res.status(400).json({
        message: "Invalid plan"
      });
    }

    const cooldown = await getOrResetCooldown(user._id, config.cooldownHours);

    if (cooldown.tradesUsed >= config.maxInvests) {
      const remainingMs = getRemainingMs(
        cooldown.cooldownStart,
        config.cooldownHours
      );

      return res.status(429).json({
        message: "Invest cooldown active",
        maxTrades: config.maxInvests,
        maxInvests: config.maxInvests,
        tradesUsed: cooldown.tradesUsed,
        tradesLeft: 0,
        investsLeft: 0,
        cooldownRemainingMs: remainingMs,
        cooldownText: formatCooldown(remainingMs)
      });
    }

    cooldown.tradesUsed += 1;
    await cooldown.save();

    const baseReward = config.rewardPerInvest;

    // Само paid/approved referrals даваат boost.
    // 1 active referral = +20%
    const activeReferralCount = user.activeReferralCount || 0;
    const referralBonusPercent = activeReferralCount * 0.20;
    const bonusAmount = baseReward * referralBonusPercent;
    const finalReward = baseReward + bonusAmount;

    user.balance += finalReward;
    await user.save();

    await Transaction.create({
      userId: user._id,
      type: "trade_simulation",
      title: "AI Investment Reward",
      amount: Number(finalReward.toFixed(2)),
      status: "completed",
      referenceId: "INVEST-" + Date.now(),
      meta: {
        plan: user.plan,
        planName: user.planName,
        baseReward: Number(baseReward.toFixed(2)),
        activeReferralCount,
        referralBonusPercent: Number((referralBonusPercent * 100).toFixed(2)),
        bonusAmount: Number(bonusAmount.toFixed(2)),
        finalReward: Number(finalReward.toFixed(2)),
        cooldownHours: config.cooldownHours,
        maxInvests: config.maxInvests
      }
    });

    const remainingMs = getRemainingMs(
      cooldown.cooldownStart,
      config.cooldownHours
    );

    const investsLeft = Math.max(0, config.maxInvests - cooldown.tradesUsed);

    res.json({
      success: true,
      message: "Invest completed",
      plan: user.plan,
      planName: user.planName,
      maxTrades: config.maxInvests,
      maxInvests: config.maxInvests,
      tradesUsed: cooldown.tradesUsed,
      tradesLeft: investsLeft,
      investsLeft,
      baseReward: Number(baseReward.toFixed(2)),
      activeReferralCount,
      referralBonusPercent: Number((referralBonusPercent * 100).toFixed(2)),
      bonusAmount: Number(bonusAmount.toFixed(2)),
      finalReward: Number(finalReward.toFixed(2)),
      rewardPerInvest: Number(finalReward.toFixed(2)),
      reward: Number(finalReward.toFixed(2)),
      newBalance: Number(user.balance.toFixed(2)),
      cooldownRemainingMs: remainingMs,
      cooldownText: formatCooldown(remainingMs)
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error"
    });
  }
});

module.exports = router;