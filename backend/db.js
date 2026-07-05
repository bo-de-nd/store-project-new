require("dotenv").config();
const { Pool } = require("pg");

// ── اتصال بقاعدة البيانات ──────────────────────────────────────
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("supabase") ? { rejectUnauthorized: false } : false,
});

// ── دالة تنفيذ الاستعلامات ─────────────────────────────────────
async function query(text, params) {
  const client = await pool.connect();
  try {
    const res = await client.query(text, params);
    return res;
  } finally {
    client.release();
  }
}

// ── إنشاء الجداول عند أول تشغيل ────────────────────────────────
async function initDB() {
  await query(`
    CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS categories (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS shipping_zones (
      id SERIAL PRIMARY KEY,
      city TEXT UNIQUE NOT NULL,
      cost INTEGER NOT NULL DEFAULT 0,
      notes TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price INTEGER NOT NULL,
      color TEXT DEFAULT '',
      sizes JSONB DEFAULT '[]',
      stock INTEGER NOT NULL DEFAULT 0,
      images JSONB DEFAULT '[]',
      rating REAL DEFAULT 0,
      reviews INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_city TEXT NOT NULL,
      customer_address TEXT NOT NULL,
      items JSONB NOT NULL,
      subtotal INTEGER NOT NULL,
      shipping INTEGER NOT NULL,
      total INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'قيد المعالجة',
      payment_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id SERIAL PRIMARY KEY,
      product_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      rating INTEGER NOT NULL,
      comment TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await seedAdmin();
  await seedSettings();
  await seedCategories();
  await seedShipping();
  await seedProducts();

  console.log("✔ قاعدة البيانات جاهزة");
}

// ── بيانات أولية ────────────────────────────────────────────────
async function seedAdmin() {
  const bcrypt = require("bcryptjs");
  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "admin123";
  const existing = await query("SELECT id FROM admins WHERE username = $1", [username]);
  if (existing.rows.length === 0) {
    const hash = bcrypt.hashSync(password, 10);
    await query("INSERT INTO admins (username, password_hash) VALUES ($1, $2)", [username, hash]);
    console.log(`✔ تم إنشاء حساب الأدمن: ${username}`);
  }
}

async function seedSettings() {
  const defaults = {
    store_name: process.env.STORE_NAME || "متجري",
    store_logo: "",
    whatsapp: process.env.STORE_WHATSAPP || "",
    primary_color: "#1D4ED8",
  };
  for (const [k, v] of Object.entries(defaults)) {
    await query(
      "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING",
      [k, v]
    );
  }
}

async function seedCategories() {
  const res = await query("SELECT COUNT(*) FROM categories");
  if (parseInt(res.rows[0].count) > 0) return;
  for (const [name, i] of [["ملابس", 0], ["أحذية", 1], ["عطور", 2]]) {
    await query("INSERT INTO categories (name, sort_order) VALUES ($1, $2) ON CONFLICT DO NOTHING", [name, i]);
  }
}

async function seedShipping() {
  const res = await query("SELECT COUNT(*) FROM shipping_zones");
  if (parseInt(res.rows[0].count) > 0) return;
  const zones = [["صنعاء", 1000, ""], ["عدن", 2500, ""], ["تعز", 2000, ""], ["الحديدة", 2000, ""], ["أخرى", 3000, "باقي المحافظات"]];
  for (const [city, cost, notes] of zones) {
    await query("INSERT INTO shipping_zones (city, cost, notes) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING", [city, cost, notes]);
  }
}

async function seedProducts() {
  const res = await query("SELECT COUNT(*) FROM products");
  if (parseInt(res.rows[0].count) > 0) return;
  const seed = [
    ["p1", "عباية تطريز يدوي", "ملابس", 18000, "أسود", ["S","M","L"], 6],
    ["p2", "فستان سهرة مطرز", "ملابس", 32000, "كحلي", ["M","L","XL"], 2],
    ["p3", "حذاء كعب كلاسيك", "أحذية", 12500, "بيج", ["37","38","39","40"], 0],
    ["p4", "عطر ورد عماني", "عطور", 9500, "-", ["50ml","100ml"], 15],
  ];
  for (const [id, name, category, price, color, sizes, stock] of seed) {
    await query(
      `INSERT INTO products (id, name, category, price, color, sizes, stock, images, rating, reviews)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING`,
      [id, name, category, price, color, JSON.stringify(sizes), stock,
       JSON.stringify(["https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=600"]), 4.5, 0]
    );
  }
}

module.exports = { query, initDB };
