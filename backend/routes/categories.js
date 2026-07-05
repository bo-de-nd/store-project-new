const express = require("express");
const { query } = require("../db");
const { requireAdmin } = require("../middleware");
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const r = await query("SELECT * FROM categories ORDER BY sort_order, id");
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/", requireAdmin, async (req, res) => {
  const { name } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: "اسم التصنيف مطلوب" });
  try {
    const maxRes = await query("SELECT MAX(sort_order) AS m FROM categories");
    const maxOrder = parseInt(maxRes.rows[0].m || 0) + 1;
    const r = await query(
      "INSERT INTO categories (name, sort_order) VALUES ($1, $2) RETURNING *",
      [name.trim(), maxOrder]
    );
    res.status(201).json(r.rows[0]);
  } catch { res.status(400).json({ error: "هذا التصنيف موجود مسبقًا" }); }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    const cat = await query("SELECT name FROM categories WHERE id = $1", [req.params.id]);
    if (!cat.rows[0]) return res.status(404).json({ error: "التصنيف غير موجود" });
    const inUse = await query("SELECT COUNT(*) FROM products WHERE category = $1", [cat.rows[0].name]);
    if (parseInt(inUse.rows[0].count) > 0)
      return res.status(400).json({ error: `لا يمكن حذف التصنيف لأنه مستخدم في ${inUse.rows[0].count} منتج` });
    await query("DELETE FROM categories WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
