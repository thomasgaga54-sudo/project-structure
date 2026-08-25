const router = require("express").Router();
const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const SECRET = process.env.JWT_SECRET || "zunny_secret_key";

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Register (Admin only ideally)
router.post("/register", async (req, res) => {
  try {
    const { username, password, role } = req.body;
    const normalizedUsername = typeof username === "string" ? username.trim() : "";

    const hashed = await bcrypt.hash(password, 10);

    const user = new User({ username: normalizedUsername, password: hashed, role });
    await user.save();

    res.json({ message: "User registered", user: { username, role } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    const normalizedUsername = typeof username === "string" ? username.trim() : "";
    const escapedUsername = escapeRegex(normalizedUsername);

    const user = await User.findOne({ username: { $regex: `^${escapedUsername}$`, $options: "i" } });
    if (!user) return res.status(400).json({ message: "User not found" });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(400).json({ message: "Invalid password" });

    const token = jwt.sign(
      { id: user._id, role: user.role, username: user.username },
      SECRET,
      { expiresIn: "8h" }
    );

    res.json({ token, role: user.role, username: user.username });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
