const express = require("express");
const { query } = require("../db");
const { requireAdmin } = require("../middleware");
const router = express.Router();

const parse = (row) => row ? { ...row, sizes: row.sizes || [], images: row.images || [], variant_label: row.variant_label || 'المقاس' } : null;

router.get("/", async (req, res) => {
  try {
    const r = await query("SELECT * FROM products ORDER BY created_at DESC");
    res.json(r.rows.map(parse));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get("/:id", async (req, res) => {
  try {
    const r = await query("SELECT * FROM products WHERE id = $1", [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: "المنتج غير موجود" });
    res.json(parse(r.rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/", requireAdmin, async (req, res) => {
  try {
    const { id, name, category, price, color, sizes, variant_label, stock, images } = req.body || {};
    if (!name || !category || !price) return res.status(400).json({ error: "الاسم والتصنيف والسعر مطلوبة" });
    const productId = id || "p" + Date.now();
    const r = await query(
      `INSERT INTO products (id,name,category,price,color,sizes,variant_label,stock,images,rating,reviews)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,0) RETURNING *`,
      [productId, name, category, price, color || "", JSON.stringify(sizes || []), variant_label || "المقاس", stock || 0, JSON.stringify(images || [])]
    );
    res.status(201).json(parse(r.rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const cur = await query("SELECT * FROM products WHERE id = $1", [req.params.id]);
    if (!cur.rows[0]) return res.status(404).json({ error: "المنتج غير موجود" });
    const p = cur.rows[0];
    const { name, category, price, color, sizes, variant_label, stock, images } = req.body || {};
    const r = await query(
      `UPDATE products SET name=$1,category=$2,price=$3,color=$4,sizes=$5,variant_label=$6,stock=$7,images=$8 WHERE id=$9 RETURNING *`,
      [
        name ?? p.name, category ?? p.category, price ?? p.price, color ?? p.color,
        JSON.stringify(sizes ?? p.sizes), variant_label ?? p.variant_label ?? "المقاس",
        stock ?? p.stock, JSON.stringify(images ?? p.images), req.params.id
      ]
    );
    res.json(parse(r.rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    await query("DELETE FROM products WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
