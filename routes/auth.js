const express = require("express");
const router = express.Router();

const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const sendVerificationEmail = require("../utils/sendVerificationEmail");
const sendResetPasswordEmail = require("../utils/sendResetPasswordEmail");

function generateReferralCode() {
  return "LUM" + Math.floor(100000 + Math.random() * 900000);
}

function generateVerificationCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

router.post("/register", async (req, res) => {
  try {
    const { fullName, email, phone, password, referralCode } = req.body;

    if (!fullName || !email || !phone || !password) {
      return res.status(400).json({
        message: "All fields are required"
      });
    }

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

    const verificationCode = generateVerificationCode();

    const newUser = await User.create({
      fullName,
      email,
      phone,
      password: hashedPassword,

      emailVerified: false,
      verificationCode,
      verificationCodeExpires: new Date(Date.now() + 10 * 60 * 1000),

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

    await sendVerificationEmail(email, verificationCode);

    res.status(201).json({
      success: true,
      message: "Verification code sent to email",
      requiresVerification: true,
      email: newUser.email
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error"
    });
  }
});

router.post("/verify-email", async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        message: "Email and verification code are required"
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    if (user.emailVerified) {
      return res.json({
        success: true,
        message: "Email already verified"
      });
    }

    if (!user.verificationCode || !user.verificationCodeExpires) {
      return res.status(400).json({
        message: "No verification code found. Please request a new code."
      });
    }

    if (new Date() > user.verificationCodeExpires) {
      return res.status(400).json({
        message: "Verification code expired. Please request a new code."
      });
    }

    if (user.verificationCode !== code) {
      return res.status(400).json({
        message: "Invalid verification code"
      });
    }

    user.emailVerified = true;
    user.verificationCode = null;
    user.verificationCodeExpires = null;

    await user.save();

    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.json({
      success: true,
      message: "Email verified successfully",
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        balance: user.balance,
        referralCode: user.referralCode,
        referralCount: user.referralCount,
        activeReferralCount: user.activeReferralCount || 0,
        plan: user.plan,
        planName: user.planName,
        planActive: user.planActive,
        emailVerified: user.emailVerified
      }
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error"
    });
  }
});

router.post("/resend-code", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: "Email is required"
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    if (user.emailVerified) {
      return res.status(400).json({
        message: "Email is already verified"
      });
    }

    const verificationCode = generateVerificationCode();

    user.verificationCode = verificationCode;
    user.verificationCodeExpires = new Date(Date.now() + 10 * 60 * 1000);

    await user.save();

    await sendVerificationEmail(email, verificationCode);

    res.json({
      success: true,
      message: "New verification code sent"
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

    if (!user.emailVerified) {
      return res.status(403).json({
        message: "Please verify your email first",
        requiresVerification: true,
        email: user.email
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
        activeReferralCount: user.activeReferralCount || 0,
        plan: user.plan,
        planName: user.planName,
        planActive: user.planActive,
        emailVerified: user.emailVerified
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

router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

    user.resetPasswordCode = resetCode;
    user.resetPasswordExpires = new Date(Date.now() + 10 * 60 * 1000);

    await user.save();

    await sendResetPasswordEmail(email, resetCode);

    res.json({
      success: true,
      message: "Password reset code sent to email"
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/reset-password", async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({
        message: "Email, code and new password are required"
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters"
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.resetPasswordCode || !user.resetPasswordExpires) {
      return res.status(400).json({
        message: "No reset code found. Please request a new code."
      });
    }

    if (new Date() > user.resetPasswordExpires) {
      return res.status(400).json({
        message: "Reset code expired. Please request a new code."
      });
    }

    if (user.resetPasswordCode !== code) {
      return res.status(400).json({
        message: "Invalid reset code"
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetPasswordCode = null;
    user.resetPasswordExpires = null;

    await user.save();

    res.json({
      success: true,
      message: "Password reset successfully"
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});