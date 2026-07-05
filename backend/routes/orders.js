const express = require("express");
const { query } = require("../db");
const { requireAdmin } = require("../middleware");
const router = express.Router();

function genOrderId() {
  return "ORD-" + Math.random().toString(36).slice(2, 7).toUpperCase();
}

function parseOrder(row) {
  return { ...row, items: row.items || [], paymentConfirmed: !!row.payment_confirmed };
}

// ── إنشاء طلب جديد ────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const { customerName, customerPhone, customerCity, customerAddress, items, shipping } = req.body || {};
    if (!customerName || !customerPhone || !customerAddress || !items?.length)
      return res.status(400).json({ error: "بيانات الطلب غير مكتملة" });

    const checked = [];
    let subtotal = 0;
    for (const item of items) {
      const pr = await query("SELECT * FROM products WHERE id = $1", [item.id]);
      const product = pr.rows[0];
      if (!product) return res.status(400).json({ error: `منتج غير موجود: ${item.id}` });
      if (product.stock < item.qty) return res.status(400).json({ error: `الكمية غير متوفرة: ${product.name}` });
      checked.push({ productId: product.id, name: product.name, size: item.size, qty: item.qty, price: product.price });
      subtotal += product.price * item.qty;
    }

    const shippingFee = Number(shipping) || 0;
    const total = subtotal + shippingFee;
    const orderId = genOrderId();

    await query(
      `INSERT INTO orders (id,customer_name,customer_phone,customer_city,customer_address,items,subtotal,shipping,total)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [orderId, customerName, customerPhone, customerCity || "", customerAddress, JSON.stringify(checked), subtotal, shippingFee, total]
    );

    for (const item of checked) {
      await query("UPDATE products SET stock = stock - $1 WHERE id = $2", [item.qty, item.productId]);
    }

    const settingsRes = await query("SELECT key, value FROM settings");
    const settings = settingsRes.rows.reduce((o, r) => { o[r.key] = r.value; return o; }, {});
    const whatsapp = settings.whatsapp || process.env.STORE_WHATSAPP || "";
    const message = `طلب جديد ${orderId}\nالاسم: ${customerName}\nالمدينة: ${customerCity || "-"}\nالمنتجات:\n${checked.map(i => `- ${i.name} (${i.size}) × ${i.qty}`).join("\n")}\nالإجمالي: ${total} ر.ي`;
    const whatsappLink = `https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`;

    const orderRes = await query("SELECT * FROM orders WHERE id = $1", [orderId]);
    res.status(201).json({ order: parseOrder(orderRes.rows[0]), whatsappLink });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── تتبع الطلبات برقم الهاتف ─────────────────────────────────
router.get("/by-phone/:phone", async (req, res) => {
  try {
    const r = await query("SELECT * FROM orders WHERE customer_phone = $1 ORDER BY created_at DESC", [req.params.phone]);
    res.json(r.rows.map(parseOrder));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── كل الطلبات (أدمن) ───────────────────────────────────────
router.get("/", requireAdmin, async (req, res) => {
  try {
    const r = await query("SELECT * FROM orders ORDER BY created_at DESC");
    res.json(r.rows.map(parseOrder));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── تحديث حالة الطلب ────────────────────────────────────────
router.patch("/:id/status", requireAdmin, async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!["قيد المعالجة", "تم الشحن", "تم التسليم"].includes(status))
      return res.status(400).json({ error: "حالة غير صحيحة" });
    await query("UPDATE orders SET status = $1 WHERE id = $2", [status, req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── تأكيد الدفع ──────────────────────────────────────────────
router.post("/confirm-payment", requireAdmin, async (req, res) => {
  try {
    const { orderId } = req.body || {};
    const r = await query("SELECT * FROM orders WHERE id = $1", [(orderId || "").trim()]);
    if (!r.rows[0]) return res.status(404).json({ error: "رقم الطلب غير موجود" });
    await query("UPDATE orders SET payment_confirmed = TRUE WHERE id = $1", [r.rows[0].id]);
    const updated = await query("SELECT * FROM orders WHERE id = $1", [r.rows[0].id]);
    res.json({ ok: true, order: parseOrder(updated.rows[0]) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── فاتورة HTML جميلة ────────────────────────────────────────
router.get("/:id/invoice", async (req, res) => {
  try {
    const r = await query("SELECT * FROM orders WHERE id = $1", [req.params.id]);
    if (!r.rows[0]) return res.status(404).json({ error: "الطلب غير موجود" });
    const order = parseOrder(r.rows[0]);
    const settingsRes = await query("SELECT key, value FROM settings");
    const settings = settingsRes.rows.reduce((o, r) => { o[r.key] = r.value; return o; }, {});
    const storeName  = settings.store_name || process.env.STORE_NAME || "المتجر";
    const brandColor = settings.primary_color || "#1D4ED8";
    const fmt  = (n) => Number(n || 0).toLocaleString("ar-SA") + " ر.ي";
    const date = new Date(order.created_at).toLocaleDateString("ar-YE", { year: "numeric", month: "long", day: "numeric" });

    const itemsRows = order.items.map(i => `
      <tr>
        <td class="td-right">${i.name}</td>
        <td class="td-center">${i.size || "-"}</td>
        <td class="td-center">${i.qty}</td>
        <td class="td-center">${fmt(i.price)}</td>
        <td class="td-center bold brand">${fmt(i.price * i.qty)}</td>
      </tr>`).join("");

    const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>فاتورة ${order.id}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap" rel="stylesheet"/>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Cairo',Arial,sans-serif;background:#f8fafc;color:#0f172a;direction:rtl;padding:20px}
  .page{max-width:780px;margin:0 auto;background:#fff;border-radius:16px;box-shadow:0 4px 32px rgba(0,0,0,.08);overflow:hidden}
  .header{background:${brandColor};padding:32px 40px;display:flex;justify-content:space-between;align-items:center}
  .h-title h1{color:#fff;font-size:24px;font-weight:800}
  .h-title p{color:rgba(255,255,255,.75);font-size:13px;margin-top:4px}
  .badge{background:rgba(255,255,255,.2);color:#fff;padding:8px 20px;border-radius:50px;font-size:13px;font-weight:700}
  .body{padding:32px 40px}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:28px}
  .card{background:#f8fafc;border-radius:12px;padding:14px 18px}
  .card label{display:block;font-size:11px;color:#94a3b8;margin-bottom:4px;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
  .card span{font-size:14px;font-weight:600}
  .status{display:inline-block;padding:3px 12px;border-radius:50px;font-size:12px;font-weight:700}
  .paid{background:#dcfce7;color:#16a34a} .unpaid{background:#fef9c3;color:#a16207}
  table{width:100%;border-collapse:collapse;margin-bottom:24px}
  thead tr{background:${brandColor}18}
  thead th{padding:11px 14px;font-size:12px;font-weight:700;color:${brandColor}}
  .th-right{text-align:right} .th-center{text-align:center}
  tbody td{padding:10px 14px;border-bottom:1px solid #f1f5f9;font-size:13px}
  .td-right{text-align:right} .td-center{text-align:center}
  .bold{font-weight:700} .brand{color:${brandColor}}
  .totals{background:#f8fafc;border-radius:12px;padding:20px;max-width:280px;margin-right:auto}
  .t-row{display:flex;justify-content:space-between;padding:5px 0;font-size:13px;color:#475569}
  .t-grand{border-top:2px solid ${brandColor}30;margin-top:8px;padding-top:10px;font-weight:800;font-size:16px;color:${brandColor}}
  .footer{background:#f8fafc;padding:18px 40px;text-align:center;font-size:12px;color:#94a3b8;border-top:1px solid #f1f5f9}
  .print-btn{display:block;margin:16px auto;background:${brandColor};color:#fff;border:none;padding:10px 28px;border-radius:10px;font-family:'Cairo',Arial,sans-serif;font-size:14px;font-weight:700;cursor:pointer}
  @media print{.print-btn{display:none}.page{box-shadow:none;border-radius:0}body{background:#fff;padding:0}}
  @media(max-width:580px){.grid{grid-template-columns:1fr}.body,.header{padding:20px}}
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">🖨️ طباعة / حفظ PDF</button>
<div class="page">
  <div class="header">
    <div class="h-title"><h1>${storeName}</h1><p>فاتورة رقم: ${order.id}</p></div>
    <div class="badge">فاتورة ضريبية</div>
  </div>
  <div class="body">
    <div class="grid">
      <div class="card"><label>رقم الطلب</label><span style="font-family:monospace">${order.id}</span></div>
      <div class="card"><label>تاريخ الطلب</label><span>${date}</span></div>
      <div class="card"><label>اسم العميل</label><span>${order.customer_name}</span></div>
      <div class="card"><label>رقم الهاتف</label><span dir="ltr">${order.customer_phone}</span></div>
      <div class="card"><label>المدينة</label><span>${order.customer_city}</span></div>
      <div class="card"><label>حالة الدفع</label><span class="status ${order.paymentConfirmed ? 'paid' : 'unpaid'}">${order.paymentConfirmed ? "✓ تم تأكيد الدفع" : "⏳ بانتظار الدفع"}</span></div>
      <div class="card" style="grid-column:1/-1"><label>عنوان الشحن</label><span>${order.customer_address}</span></div>
    </div>
    <table>
      <thead><tr>
        <th class="th-right">المنتج</th><th class="th-center">المقاس</th>
        <th class="th-center">الكمية</th><th class="th-center">سعر الوحدة</th><th class="th-center">الإجمالي</th>
      </tr></thead>
      <tbody>${itemsRows}</tbody>
    </table>
    <div class="totals">
      <div class="t-row"><span>المجموع الفرعي</span><span>${fmt(order.subtotal)}</span></div>
      <div class="t-row"><span>رسوم الشحن</span><span>${order.shipping === 0 ? "مجاني 🎉" : fmt(order.shipping)}</span></div>
      <div class="t-row t-grand"><span>الإجمالي</span><span>${fmt(order.total)}</span></div>
    </div>
  </div>
  <div class="footer">شكرًا لتسوقك من ${storeName} · يمكنك الطباعة أو الحفظ كـ PDF من الزر أعلاه</div>
</div>
</body></html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── إحصائيات ─────────────────────────────────────────────────
router.get("/stats/summary", requireAdmin, async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const month = new Date().toISOString().slice(0, 7);

    const [todayRes, monthRes, totalRes, topRes, lowRes, outRes] = await Promise.all([
      query(`SELECT COALESCE(SUM(total),0) AS s FROM orders WHERE payment_confirmed=TRUE AND created_at::date = $1`, [today]),
      query(`SELECT COALESCE(SUM(total),0) AS s FROM orders WHERE payment_confirmed=TRUE AND TO_CHAR(created_at,'YYYY-MM') = $1`, [month]),
      query(`SELECT COALESCE(SUM(total),0) AS s FROM orders WHERE payment_confirmed=TRUE`),
      query(`SELECT name, SUM(qty) as total_qty FROM (SELECT jsonb_array_elements(items)->>'name' AS name, (jsonb_array_elements(items)->>'qty')::int AS qty FROM orders) t GROUP BY name ORDER BY total_qty DESC LIMIT 5`),
      query(`SELECT id, name, stock FROM products WHERE stock > 0 AND stock <= 3`),
      query(`SELECT id, name FROM products WHERE stock = 0`),
    ]);

    res.json({
      todaySales:   parseInt(todayRes.rows[0].s),
      monthSales:   parseInt(monthRes.rows[0].s),
      totalSales:   parseInt(totalRes.rows[0].s),
      topProducts:  topRes.rows.map(r => ({ name: r.name, qty: parseInt(r.total_qty) })),
      lowStock:     lowRes.rows,
      outOfStock:   outRes.rows,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
