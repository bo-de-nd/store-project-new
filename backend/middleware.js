const jwt = require("jsonwebtoken");

function requireAdmin(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "غير مصرح، يلزم تسجيل الدخول" });
  try {
    req.admin = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "جلسة منتهية، يرجى تسجيل الدخول مرة أخرى" });
  }
}

module.exports = { requireAdmin };
