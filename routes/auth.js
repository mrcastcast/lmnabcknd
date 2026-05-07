const express = require("express");
const router = express.Router();

const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

function generateReferralCode() {
  return "LUM" + Math.floor(100000 + Math.random() * 900000);
}

router.post("/register", async (req, res) => {
  try {
    const { fullName, email, phone, password, referralCode } = req.body;

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      return res.status(400).json({
        message: "User already exists"
      });
    }

    let referrer = null;

    if (referralCode && referralCode.trim() !== "") {
      referrer = await User.findOne({
        referralCode: referralCode.trim()
      });

      if (!referrer) {
        return res.status(400).json({
          message: "Invalid referral code"
        });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({
      fullName,
      email,
      phone,
      password: hashedPassword,

      balance: 0,

      referralCode: generateReferralCode(),
      referredBy: referrer ? referrer._id : null,

      plan: 0,
      planName: "Free User",
      planActive: false
    });

    if (referrer) {
      referrer.referralCount += 1;
      await referrer.save();
    }

    const token = jwt.sign(
      { id: newUser._id },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.status(201).json({
      success: true,
      message: "Registration successful",
      token,
      user: {
        id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        balance: newUser.balance,
        referralCode: newUser.referralCode,
        referralCount: newUser.referralCount,
        referredBy: referrer ? referrer.referralCode : null,
        plan: newUser.plan,
        planName: newUser.planName,
        planActive: newUser.planActive
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error"
    });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({
      email
    });

    if (!user) {
      return res.status(400).json({
        message: "Invalid email or password"
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid email or password"
      });
    }

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        balance: user.balance,
        referralCode: user.referralCode,
        referralCount: user.referralCount,
        plan: user.plan,
        planName: user.planName,
        planActive: user.planActive
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