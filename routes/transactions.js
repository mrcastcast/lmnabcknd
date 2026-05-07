const express = require("express");
const router = express.Router();

const Transaction = require("../models/Transaction");
const requireAuth = require("../middleware/auth");

router.get("/my", requireAuth, async (req, res) => {
  try {
    const transactions = await Transaction.find({
      userId: req.userId
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      transactions
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error"
    });
  }
});

module.exports = router;