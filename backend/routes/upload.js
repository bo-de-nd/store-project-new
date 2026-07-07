const express  = require("express");
const multer   = require("multer");
const { createClient } = require("@supabase/supabase-js");
const { requireAdmin } = require("../middleware");

const router = express.Router();

const BUCKET = "product-images";

// ── إنشاء عميل Supabase بصلاحيات كاملة (service role key) ──────
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

// ── ضمان وجود الـ bucket عند أول تشغيل ──────────────────────────
async function ensureBucket(supabase) {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b) => b.name === BUCKET);
  if (!exists) {
    await supabase.storage.createBucket(BUCKET, { public: true });
  }
}

// ── multer: تخزين في الذاكرة فقط (بدون أي ملفات محلية) ─────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|jpg|png|webp|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error("نوع الملف غير مدعوم — استخدم JPG أو PNG أو WEBP"));
  },
});

// ── POST /api/upload  (أدمن فقط) ────────────────────────────────
router.post("/", requireAdmin, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "لم يتم إرفاق أي صورة" });

    const supabase = getSupabase();
    if (!supabase) {
      return res.status(500).json({
        error: "لم يتم إعداد Supabase Storage. أضف SUPABASE_URL و SUPABASE_SERVICE_KEY في متغيرات Render.",
      });
    }

    // تأكد من وجود الـ bucket
    await ensureBucket(supabase);

    // اسم فريد للملف
    const ext = req.file.originalname.split(".").pop().toLowerCase() || "jpg";
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    // رفع الملف من الذاكرة مباشرة
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filename, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (uploadError) {
      return res.status(500).json({ error: "فشل الرفع: " + uploadError.message });
    }

    // الحصول على الرابط العام الدائم
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(filename);
    res.json({ url: data.publicUrl });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
