const BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

const auth = () => {
  const t = localStorage.getItem("admin_token");
  return t ? { Authorization: `Bearer ${t}` } : {};
};

const J = () => ({ "Content-Type": "application/json" });

async function req(url, opts = {}) {
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "خطأ غير متوقع");
  return data;
}

export const api = {
  // إعدادات
  getSettings:    ()    => req(`${BASE}/settings`),
  updateSettings: (p)   => req(`${BASE}/settings`, { method:"PUT", headers:{...J(),...auth()}, body:JSON.stringify(p) }),

  // تصنيفات
  getCategories:  ()    => req(`${BASE}/categories`),
  createCategory: (n)   => req(`${BASE}/categories`, { method:"POST", headers:{...J(),...auth()}, body:JSON.stringify({name:n}) }),
  deleteCategory: (id)  => req(`${BASE}/categories/${id}`, { method:"DELETE", headers:auth() }),

  // مناطق الشحن
  getShippingZones:   ()      => req(`${BASE}/shipping`),
  createShippingZone: (p)     => req(`${BASE}/shipping`, { method:"POST", headers:{...J(),...auth()}, body:JSON.stringify(p) }),
  updateShippingZone: (id, p) => req(`${BASE}/shipping/${id}`, { method:"PUT", headers:{...J(),...auth()}, body:JSON.stringify(p) }),
  deleteShippingZone: (id)    => req(`${BASE}/shipping/${id}`, { method:"DELETE", headers:auth() }),

  // رفع ملفات
  uploadImage: (file) => {
    const fd = new FormData();
    fd.append("image", file);
    return req(`${BASE}/upload`, { method:"POST", headers:auth(), body:fd });
  },
  fileUrl:  (p) => p?.startsWith("http") ? p : `${BASE.replace("/api","")}${p||""}`,
  shareUrl: (id) => `${BASE.replace("/api","")}/share/product/${id}`,

  // منتجات
  getProducts:   ()       => req(`${BASE}/products`),
  createProduct: (p)      => req(`${BASE}/products`, { method:"POST", headers:{...J(),...auth()}, body:JSON.stringify(p) }),
  updateProduct: (id, p)  => req(`${BASE}/products/${id}`, { method:"PUT", headers:{...J(),...auth()}, body:JSON.stringify(p) }),
  deleteProduct: (id)     => req(`${BASE}/products/${id}`, { method:"DELETE", headers:auth() }),

  // طلبات
  createOrder:      (p)    => req(`${BASE}/orders`, { method:"POST", headers:J(), body:JSON.stringify(p) }),
  getOrdersByPhone: (phone)=> req(`${BASE}/orders/by-phone/${encodeURIComponent(phone)}`),
  getAllOrders:      ()     => req(`${BASE}/orders`, { headers:auth() }),
  updateOrderStatus:(id,s) => req(`${BASE}/orders/${id}/status`, { method:"PATCH", headers:{...J(),...auth()}, body:JSON.stringify({status:s}) }),
  confirmPayment:   (id)   => req(`${BASE}/orders/confirm-payment`, { method:"POST", headers:{...J(),...auth()}, body:JSON.stringify({orderId:id}) }),
  invoiceUrl:       (id)   => `${BASE}/orders/${id}/invoice`,
  getStats:         ()     => req(`${BASE}/orders/stats/summary`, { headers:auth() }),

  // تقييمات
  rateProduct: (productId, stars) => req(`${BASE}/ratings/${productId}`, { method:"POST", headers:J(), body:JSON.stringify({stars}) }),
  getProductRating: (productId) => req(`${BASE}/ratings/${productId}`),

  // مصادقة
  login: (u, p) => req(`${BASE}/auth/login`, { method:"POST", headers:J(), body:JSON.stringify({username:u,password:p}) }),
};

// تقييمات (يُضاف في نهاية الملف)
// نحتاج تصدير دالة منفصلة — نُضيف في الكائن
