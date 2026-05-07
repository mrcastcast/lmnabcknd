const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const app = express();

app.use(cors({
  origin: "*",
  credentials: true
}));

app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected Successfully"))
  .catch(err => console.error("❌ MongoDB Error:", err));

const adminAuth = require("./routes/admin");

app.use("/api/auth", require("./routes/auth"));
app.use("/api/payments", require("./routes/payments"));
app.use("/api/tasks", require("./routes/tasks"));
app.use("/api/user", require("./routes/user"));
app.use("/api/admin", adminAuth.router);
app.use("/api/withdrawals", require("./routes/withdrawals"));
app.use("/api/trades", require("./routes/trades"));
app.use("/api/transactions", require("./routes/transactions"));

app.get("/", (req, res) => {
  res.send("🚀 Lumina Backend is running successfully!");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🌐 Server running on http://localhost:${PORT}`);
});