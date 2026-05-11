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
    rewardPerInvest: 3
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
    const referralBonusPercent = activeReferralCount * 0.07;
    const finalRewardPreview = config.rewardPerInvest * (1 + activeReferralCount * 0.07);

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

router.post("/:id/approve", async (req, res) => {

  try {

    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({
        message:"Payment not found"
      });
    }

    if (payment.status !== "pending") {
      return res.status(400).json({
        message:"Payment already processed"
      });
    }

    payment.status = "approved";

    await payment.save();

    const user = await User.findOne({
      email: payment.email
    });

    if (user) {

      user.plan = payment.planNumber;
      user.planName = payment.planName;
      user.planActive = true;
      user.planActivatedAt = new Date();

      await user.save();

      if (user.referredBy && !payment.referralBonusApplied) {

        const referrer = await User.findById(user.referredBy);

        if (referrer) {

          const referralBonusByPlan = {
            1: 25,
            2: 60,
            3: 115,
            4: 210
          };

          const bonusAmount =
            referralBonusByPlan[Number(payment.planNumber)] || 0;

          referrer.activeReferralCount =
            (referrer.activeReferralCount || 0) + 1;

          referrer.balance =
            Number(referrer.balance || 0) + bonusAmount;

          await referrer.save();

          await Transaction.create({
            userId: referrer._id,
            type: "referral_bonus",
            title: "Referral Plan Bonus",
            amount: bonusAmount,
            status: "completed",
            referenceId: payment.paymentId,
            meta: {
              referredUserEmail: user.email,
              planNumber: payment.planNumber,
              planName: payment.planName,
              bonusAmount
            }
          });

          payment.referralBonusApplied = true;

          await payment.save();
        }
      }

      await Transaction.create({
        userId: user._id,
        type: "payment_approved",
        title: "Plan Activated: " + payment.planName,
        amount: payment.amount,
        status: "approved",
        referenceId: payment.paymentId,
        meta: {
          planNumber: payment.planNumber,
          planName: payment.planName,
        }
      });
    }

    res.json({
      success:true,
      message:"Payment approved"
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      message:"Server error"
    });
  }
});

module.exports = router;