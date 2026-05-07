const express = require("express");
const router = express.Router();

const User = require("../models/User");
const Withdrawal = require("../models/Withdrawal");
const Transaction = require("../models/Transaction");

const requireAuth = require("../middleware/auth");
const { requireAdmin } = require("./admin");

function generateWithdrawalId() {
  return "LUM-WD-" + Math.floor(10000000 + Math.random() * 90000000);
}

router.post("/request", requireAuth, async (req, res) => {
  try {
    const { amount, walletAddress } = req.body;

    if (!amount || !walletAddress) {
      return res.status(400).json({
        message: "Amount and wallet address are required"
      });
    }

    const withdrawAmount = Number(amount);

    if (withdrawAmount <= 0) {
      return res.status(400).json({
        message: "Invalid withdrawal amount"
      });
    }

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    if (user.balance < withdrawAmount) {
      return res.status(400).json({
        message: "Insufficient balance"
      });
    }

    user.balance -= withdrawAmount;
    await user.save();

    const withdrawal = await Withdrawal.create({
      withdrawalId: generateWithdrawalId(),
      userId: user._id,
      fullName: user.fullName,
      email: user.email,
      amount: withdrawAmount,
      walletAddress,
      network: "USDT TRC20",
      status: "pending"
    });

    await Transaction.create({
      userId: user._id,
      type: "withdrawal_request",
      title: "Withdrawal Requested",
      amount: withdrawAmount,
      status: "pending",
      referenceId: withdrawal.withdrawalId,
      meta: {
        walletAddress,
        network: "USDT TRC20"
      }
    });

    res.status(201).json({
      success: true,
      message: "Withdrawal request submitted for admin review",
      withdrawal,
      newBalance: user.balance
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error"
    });
  }
});

router.get("/my", requireAuth, async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({
      userId: req.userId
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      withdrawals
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error"
    });
  }
});

router.get("/pending", requireAdmin, async (req, res) => {
  try {
    const withdrawals = await Withdrawal.find({
      status: "pending"
    }).sort({ createdAt: -1 });

    res.json(withdrawals);

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error"
    });
  }
});

router.post("/:id/approve", requireAdmin, async (req, res) => {
  try {
    const withdrawal = await Withdrawal.findById(req.params.id);

    if (!withdrawal) {
      return res.status(404).json({
        message: "Withdrawal not found"
      });
    }

    if (withdrawal.status !== "pending") {
      return res.status(400).json({
        message: "Withdrawal already reviewed"
      });
    }

    withdrawal.status = "approved";
    withdrawal.reviewedAt = new Date();

    await withdrawal.save();

    await Transaction.create({
      userId: withdrawal.userId,
      type: "withdrawal_approved",
      title: "Withdrawal Approved",
      amount: withdrawal.amount,
      status: "approved",
      referenceId: withdrawal.withdrawalId,
      meta: {
        walletAddress: withdrawal.walletAddress,
        network: withdrawal.network
      }
    });

    res.json({
      success: true,
      message: "Withdrawal approved",
      withdrawal
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error"
    });
  }
});

router.post("/:id/reject", requireAdmin, async (req, res) => {
  try {
    const withdrawal = await Withdrawal.findById(req.params.id);

    if (!withdrawal) {
      return res.status(404).json({
        message: "Withdrawal not found"
      });
    }

    if (withdrawal.status !== "pending") {
      return res.status(400).json({
        message: "Withdrawal already reviewed"
      });
    }

    const user = await User.findById(withdrawal.userId);

    if (user) {
      user.balance += withdrawal.amount;
      await user.save();
    }

    withdrawal.status = "rejected";
    withdrawal.reviewedAt = new Date();

    await withdrawal.save();

    await Transaction.create({
      userId: withdrawal.userId,
      type: "withdrawal_rejected_refund",
      title: "Withdrawal Rejected - Balance Returned",
      amount: withdrawal.amount,
      status: "completed",
      referenceId: withdrawal.withdrawalId,
      meta: {
        walletAddress: withdrawal.walletAddress,
        network: withdrawal.network
      }
    });

    res.json({
      success: true,
      message: "Withdrawal rejected and balance returned",
      withdrawal
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error"
    });
  }
});

module.exports = router;