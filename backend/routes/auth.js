const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { query } = require("../db");
const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: "أدخل اسم المستخدم وكلمة المرور" });
    const result = await query("SELECT * FROM admins WHERE username = $1", [username]);
    const admin = result.rows[0];
    if (!admin || !bcrypt.compareSync(password, admin.password_hash))
      return res.status(401).json({ error: "بيانات الدخول غير صحيحة" });
    const token = jwt.sign({ id: admin.id, username: admin.username }, process.env.JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, username: admin.username });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
