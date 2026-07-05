require("dotenv").config();
const express   = require("express");
const cors      = require("cors");
const path      = require("path");
const { initDB } = require("./db");

const app = express();
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || "*" }));
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/auth",       require("./routes/auth"));
app.use("/api/products",   require("./routes/products"));
app.use("/api/orders",     require("./routes/orders"));
app.use("/api/settings",   require("./routes/settings"));
app.use("/api/categories", require("./routes/categories"));
app.use("/api/shipping",   require("./routes/shipping"));
app.use("/api/upload",     require("./routes/upload"));
app.use("/share",          require("./routes/share"));

app.get("/api/health", (req, res) => res.json({ ok: true, store: process.env.STORE_NAME }));
app.use((req, res) => res.status(404).json({ error: "المسار غير موجود" }));

const PORT = process.env.PORT || 4000;

initDB()
  .then(() => app.listen(PORT, () => console.log(`🚀 الخادم يعمل على المنفذ ${PORT}`)))
  .catch(err => { console.error("فشل الاتصال بقاعدة البيانات:", err.message); process.exit(1); });
