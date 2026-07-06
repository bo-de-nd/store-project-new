const express    = require("express");
const multer     = require("multer");
const cloudinary = require("cloudinary").v2;
const streamifier = require("streamifier");
const { requireAdmin } = require("../middleware");

const router = express.Router();

// ── إعداد Cloudinary من متغيرات البيئة ─────────────────────────
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// multer في الذاكرة فقط (بدون حفظ محلي) ────────────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif|jpg)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error("نوع الملف غير مدعوم، استخدم صورة JPG أو PNG أو WEBP"));
  },
});

// ── رفع صورة إلى Cloudinary ─────────────────────────────────────
router.post("/", requireAdmin, upload.single("image"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "لم يتم إرفاق أي صورة" });

  // تحقق من وجود إعدادات Cloudinary
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    return res.status(500).json({ error: "لم يتم إعداد Cloudinary بعد. أضف متغيرات CLOUDINARY_* في Render." });
  }

  // رفع الصورة عبر Stream مباشرة بدون حفظ على القرص
  const uploadStream = cloudinary.uploader.upload_stream(
    { folder: "store-products", resource_type: "image" },
    (error, result) => {
      if (error) return res.status(500).json({ error: "فشل رفع الصورة: " + error.message });
      // نُعيد الـ URL الآمن من Cloudinary
      res.json({ url: result.secure_url });
    }
  );

  streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
});

module.exports = router;
