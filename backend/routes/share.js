const express = require("express");
const { query } = require("../db");
const router = express.Router();

function esc(s = "") {
  return String(s).replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
}

router.get("/product/:id", async (req, res) => {
  try {
    const r = await query("SELECT * FROM products WHERE id = $1", [req.params.id]);
    if (!r.rows[0]) return res.status(404).send("المنتج غير موجود");
    const product = r.rows[0];
    const settingsRes = await query("SELECT key, value FROM settings");
    const settings = settingsRes.rows.reduce((o, r) => { o[r.key] = r.value; return o; }, {});
    const images  = product.images || [];
    const image   = images[0] || "";
    const frontendUrl = process.env.FRONTEND_ORIGIN || "";
    const productUrl  = `${frontendUrl}/?product=${product.id}`;
    const apiBase     = `${req.protocol}://${req.get("host")}`;
    const absoluteImg = image.startsWith("http") ? image : `${apiBase}${image}`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8"/>
  <title>${esc(product.name)} - ${esc(settings.store_name || "")}</title>
  <meta property="og:title" content="${esc(product.name)}"/>
  <meta property="og:description" content="${product.price} ر.ي - ${esc(settings.store_name || "")}"/>
  <meta property="og:image" content="${esc(absoluteImg)}"/>
  <meta property="og:type" content="product"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta http-equiv="refresh" content="0; url=${esc(productUrl)}"/>
</head>
<body>جاري التحويل... <a href="${esc(productUrl)}">اضغط هنا</a></body>
</html>`);
  } catch (e) { res.status(500).send("خطأ"); }
});

module.exports = router;
