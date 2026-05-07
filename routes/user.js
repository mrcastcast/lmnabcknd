const express = require("express");
const router = express.Router();

const User = require("../models/User");
const requireAuth = require("../middleware/auth");

router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        balance: user.balance,

        referralCode: user.referralCode,
        referralCount: user.referralCount || 0,
        activeReferralCount: user.activeReferralCount || 0,
        investBoostPercent: (user.activeReferralCount || 0) * 20,

        plan: user.plan,
        planName: user.planName,
        planActive: user.planActive,
        planActivatedAt: user.planActivatedAt
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error"
    });
  }
});

module.exports = router;