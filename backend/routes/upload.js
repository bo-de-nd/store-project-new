const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { requireAdmin } = require("../middleware");

const router = express.Router();

const uploadsDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error("نوع الملف غير مدعوم، استخدم صورة JPG أو PNG أو WEBP"));
  },
});

// رفع صورة واحدة (أدمن فقط) - تُستخدم لصور المنتجات والشعار
router.post("/", requireAdmin, upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "لم يتم إرفاق أي صورة" });
  res.json({ url: `/uploads/${req.file.filename}` });
});

module.exports = router;
