const express = require("express");
const jwt = require("jsonwebtoken");

const router = express.Router();

router.post("/login", (req, res) => {
  const { password } = req.body;

  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({
      message: "Invalid admin password"
    });
  }

  const token = jwt.sign(
    { role: "admin" },
    process.env.ADMIN_SECRET,
    { expiresIn: "12h" }
  );

  res.json({
    success: true,
    message: "Admin login successful",
    token
  });
});

function requireAdmin(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      message: "Admin token missing"
    });
  }

  try {
    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.ADMIN_SECRET);

    if (decoded.role !== "admin") {
      return res.status(403).json({
        message: "Forbidden"
      });
    }

    next();

  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired admin token"
    });
  }
}

module.exports = {
  router,
  requireAdmin
};