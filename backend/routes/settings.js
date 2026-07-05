const express = require("express");
const { query } = require("../db");
const { requireAdmin } = require("../middleware");
const router = express.Router();

async function getAllSettings() {
  const res = await query("SELECT key, value FROM settings");
  return res.rows.reduce((o, r) => { o[r.key] = r.value; return o; }, {});
}

router.get("/", async (req, res) => {
  try { res.json(await getAllSettings()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.put("/", requireAdmin, async (req, res) => {
  try {
    const allowed = ["store_name", "store_logo", "whatsapp", "primary_color"];
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        await query(
          "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2",
          [key, String(req.body[key])]
        );
      }
    }
    res.json(await getAllSettings());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
