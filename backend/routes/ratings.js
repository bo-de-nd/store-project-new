const express = require("express");
const { query } = require("../db");
const router  = express.Router();

// POST /api/ratings/:productId  — عميل يعطي تقييم (1-5 نجوم)
router.post("/:productId", async (req, res) => {
  try {
    const { stars } = req.body || {};
    const productId = req.params.productId;

    if (!stars || stars < 1 || stars > 5)
      return res.status(400).json({ error: "يجب أن يكون التقييم بين 1 و 5" });

    // تحقق أن المنتج موجود
    const prod = await query("SELECT id, rating, reviews FROM products WHERE id = $1", [productId]);
    if (!prod.rows[0]) return res.status(404).json({ error: "المنتج غير موجود" });

    // أضف التقييم
    await query("INSERT INTO ratings (product_id, stars) VALUES ($1, $2)", [productId, Number(stars)]);

    // احسب المتوسط الجديد من جدول ratings
    const avg = await query(
      "SELECT ROUND(AVG(stars)::numeric, 1) AS avg, COUNT(*) AS total FROM ratings WHERE product_id = $1",
      [productId]
    );

    const newRating  = parseFloat(avg.rows[0].avg) || 0;
    const newReviews = parseInt(avg.rows[0].total) || 0;

    // حدّث المنتج
    await query(
      "UPDATE products SET rating = $1, reviews = $2 WHERE id = $3",
      [newRating, newReviews, productId]
    );

    res.json({ rating: newRating, reviews: newReviews });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/ratings/:productId — احصل على تقييم منتج
router.get("/:productId", async (req, res) => {
  try {
    const r = await query(
      "SELECT ROUND(AVG(stars)::numeric, 1) AS avg, COUNT(*) AS total FROM ratings WHERE product_id = $1",
      [req.params.productId]
    );
    res.json({
      rating:  parseFloat(r.rows[0].avg)  || 0,
      reviews: parseInt(r.rows[0].total) || 0,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
