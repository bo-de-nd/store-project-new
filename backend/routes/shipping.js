const express = require("express");
const { query } = require("../db");
const { requireAdmin } = require("../middleware");
const router = express.Router();

router.get("/", async (req, res) => {
  try {
    const r = await query("SELECT * FROM shipping_zones ORDER BY id");
    res.json(r.rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post("/", requireAdmin, async (req, res) => {
  const { city, cost, notes } = req.body || {};
  if (!city?.trim()) return res.status(400).json({ error: "اسم المدينة مطلوب" });
  try {
    const r = await query(
      "INSERT INTO shipping_zones (city, cost, notes) VALUES ($1, $2, $3) RETURNING *",
      [city.trim(), Number(cost) || 0, notes || ""]
    );
    res.status(201).json(r.rows[0]);
  } catch { res.status(400).json({ error: "هذه المدينة موجودة مسبقًا" }); }
});

router.put("/:id", requireAdmin, async (req, res) => {
  try {
    const { city, cost, notes } = req.body || {};
    const cur = await query("SELECT * FROM shipping_zones WHERE id = $1", [req.params.id]);
    if (!cur.rows[0]) return res.status(404).json({ error: "المنطقة غير موجودة" });
    const z = cur.rows[0];
    const r = await query(
      "UPDATE shipping_zones SET city=$1, cost=$2, notes=$3 WHERE id=$4 RETURNING *",
      [city ?? z.city, cost !== undefined ? Number(cost) : z.cost, notes ?? z.notes, req.params.id]
    );
    res.json(r.rows[0]);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  try {
    await query("DELETE FROM shipping_zones WHERE id = $1", [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
