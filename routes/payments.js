const express = require("express");
const router = express.Router();

const Payment = require("../models/Payment");
const User = require("../models/User");
const Transaction = require("../models/Transaction");

const { requireAdmin } = require("./admin");

function generatePaymentId() {
  return "LUM-PAY-" + Math.floor(10000000 + Math.random() * 90000000);
}

router.post("/submit", async (req, res) => {
  try {
    const { fullName, email, planNumber, planName, amount, txid } = req.body;

    if (!fullName || !email || !planNumber || !planName || !amount || !txid) {
      return res.status(400).json({
        message: "Missing payment data"
      });
    }

    const payment = await Payment.create({
      paymentId: generatePaymentId(),
      fullName,
      email,
      planNumber,
      planName,
      amount,
      txid,
      network: "USDT TRC20",
      status: "pending"
    });

    res.status(201).json({
      success: true,
      message: "Payment submitted for admin approval",
      payment
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
    const payments = await Payment.find({
      status: "pending"
    }).sort({ createdAt: -1 });

    res.json(payments);

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error"
    });
  }
});

router.get("/all", requireAdmin, async (req, res) => {
  try {
    const payments = await Payment.find().sort({
      createdAt: -1
    });

    res.json(payments);

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error"
    });
  }
});

router.post("/:id/approve", requireAdmin, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({
        message: "Payment not found"
      });
    }

    if (payment.status !== "pending") {
      return res.status(400).json({
        message: "Payment already reviewed"
      });
    }

    const user = await User.findOne({
      email: payment.email
    });

    if (!user) {
      return res.status(404).json({
        message: "User not found for this payment email: " + payment.email
      });
    }

    payment.status = "approved";
    await payment.save();

    const wasAlreadyActive = user.planActive === true;

    user.plan = Number(payment.planNumber);
    user.planName = payment.planName;
    user.planActive = true;
    user.planActivatedAt = new Date();

    await user.save();

    // Ако user бил донесен преку referral И првпат купува approved пакет,
    // тогаш referrer добива +1 active referral.
    if (user.referredBy && !wasAlreadyActive) {
      const referrer = await User.findById(user.referredBy);

      if (referrer) {
        referrer.activeReferralCount = (referrer.activeReferralCount || 0) + 1;
        await referrer.save();
      }
    }

    await Transaction.create({
      userId: user._id,
      type: "payment_approved",
      title: "Plan Activated: " + payment.planName,
      amount: Number(payment.amount),
      status: "approved",
      referenceId: payment.paymentId,
      meta: {
        planNumber: payment.planNumber,
        planName: payment.planName,
        txid: payment.txid,
        network: payment.network || "USDT TRC20"
      }
    });

    res.json({
      success: true,
      message: "Payment approved and user plan activated",
      payment,
      user: {
        id: user._id,
        email: user.email,
        plan: user.plan,
        planName: user.planName,
        planActive: user.planActive,
        planActivatedAt: user.planActivatedAt,
        referredBy: user.referredBy
      }
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
    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({
        message: "Payment not found"
      });
    }

    if (payment.status !== "pending") {
      return res.status(400).json({
        message: "Payment already reviewed"
      });
    }

    payment.status = "rejected";
    await payment.save();

    res.json({
      success: true,
      message: "Payment rejected",
      payment
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error"
    });
  }
});

module.exports = router;