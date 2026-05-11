const express = require("express");
const router = express.Router();

const Payment = require("../models/Payment");
const User = require("../models/User");
const Transaction = require("../models/Transaction");

function generatePaymentId() {
  return "LUM-PAY-" + Math.floor(10000000 + Math.random() * 90000000);
}

/*
|--------------------------------------------------------------------------
| SUBMIT PAYMENT
|--------------------------------------------------------------------------
*/

router.post("/submit", async (req, res) => {

  try {

    const {
      fullName,
      email,
      planNumber,
      planName,
      amount,
    } = req.body;

    if (
      !fullName ||
      !email ||
      !planNumber ||
      !planName ||
      !amount
    ) {
      return res.status(400).json({
        message:"Missing payment data"
      });
    }

    const payment = await Payment.create({

      paymentId: generatePaymentId(),

      fullName,
      email,

      planNumber,
      planName,
      amount,

      txid:"",

      status:"pending"
    });

    res.status(201).json({
      success:true,
      message:"Payment submitted successfully",
      payment
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      message:"Server error"
    });
  }
});

/*
|--------------------------------------------------------------------------
| GET PENDING PAYMENTS
|--------------------------------------------------------------------------
*/

router.get("/pending", async (req, res) => {

  try {

    const payments = await Payment
      .find({ status:"pending" })
      .sort({ createdAt:-1 });

    res.json(payments);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      message:"Server error"
    });
  }
});

/*
|--------------------------------------------------------------------------
| APPROVE PAYMENT
|--------------------------------------------------------------------------
*/

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

      const wasAlreadyActive = user.planActive === true;

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

      const bonusAmount = referralBonusByPlan[Number(payment.planNumber)] || 0;

      referrer.activeReferralCount = (referrer.activeReferralCount || 0) + 1;
      referrer.balance = Number(referrer.balance || 0) + bonusAmount;

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
});

/*
|--------------------------------------------------------------------------
| REJECT PAYMENT
|--------------------------------------------------------------------------
*/

router.post("/:id/reject", async (req, res) => {

  try {

    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({
        message:"Payment not found"
      });
    }

    payment.status = "rejected";

    await payment.save();

    res.json({
      success:true,
      message:"Payment rejected"
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      message:"Server error"
    });
  }
});

module.exports = router;