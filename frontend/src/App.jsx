import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  Search, Heart, ShoppingBag, X, Plus, Minus, Star, Package, TrendingUp, Bell,
  Check, Trash2, Lock, FileText, ListOrdered, Share2, Upload, Image as Img,
  Tag, Settings as Cog, LogOut, Palette, Truck, MapPin, Phone, User,
  ChevronLeft, ChevronRight, Grid3x3, Sparkles, ShieldCheck, Clock, ArrowLeft,
  Eye, RefreshCw, CheckCircle2, AlertCircle, Edit3, BarChart3, ShoppingCart,
} from "lucide-react";
import { api } from "./api";

/* ─── helpers ────────────────────────────────────────────────── */
const ADMIN_PATH = "/store-admin-control";
const fmt = (n) => Number(n || 0).toLocaleString("ar-SA") + " ر.ي";
const stockLabel = (s) =>
  s === 0 ? { text: "نفذ من المخزون", cls: "bg-red-100 text-red-600" }
  : s <= 3 ? { text: `آخر ${s} قطع`, cls: "bg-amber-100 text-amber-700" }
  : { text: "متوفر", cls: "bg-emerald-100 text-emerald-700" };

function useShadeColor(hex, pct) {
  if (!hex) return "#1d4ed8";
  const n = parseInt(hex.replace("#",""), 16);
  const r = Math.min(255, Math.max(0, (n>>16) + pct*2.55|0));
  const g = Math.min(255, Math.max(0, ((n>>8)&0xff) + pct*2.55|0));
  const b = Math.min(255, Math.max(0, (n&0xff) + pct*2.55|0));
  return "#"+((r<<16)|(g<<8)|b).toString(16).padStart(6,"0");
}


/* ─── useLocalStorage hook ──────────────────────────────────── */
function useLocalStorage(key, initial) {
  const [val, setVal] = useState(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : initial; }
    catch { return initial; }
  });
  const set = useCallback((v) => {
    const next = typeof v === "function" ? v(val) : v;
    setVal(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
  }, [key, val]);
  return [val, set];
}


/* ─── أنواع خيارات المنتج ───────────────────────────────────── */
const VARIANT_TYPES = [
  { label: "لا يوجد خيارات",  value: "none",    placeholder: "" },
  { label: "المقاس",           value: "المقاس",   placeholder: "S,M,L,XL  أو  38,39,40,41" },
  { label: "حجم العبوة (مل)",  value: "الحجم",   placeholder: "50ml,100ml,200ml" },
  { label: "اللون",            value: "اللون",   placeholder: "أسود,أبيض,ذهبي" },
  { label: "النكهة",           value: "النكهة",  placeholder: "شوكولاتة,فانيليا,فراولة" },
  { label: "الوزن",            value: "الوزن",   placeholder: "250g,500g,1kg" },
  { label: "خيار مخصص",        value: "custom",  placeholder: "" },
];

/* ─── SPLASH ─────────────────────────────────────────────────── */
function Splash({ settings, onDone }) {
  const [out, setOut] = useState(false);
  useEffect(() => {
    const t1 = setTimeout(() => setOut(true), 2000);
    const t2 = setTimeout(onDone, 2500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  return (
    <div className={`fixed inset-0 z-[200] flex flex-col items-center justify-center transition-all duration-500 ${out ? "opacity-0 scale-105 pointer-events-none" : "opacity-100 scale-100"}`}
      style={{ background: `linear-gradient(135deg, ${settings.primary_color||"#2563EB"} 0%, ${useShadeColor(settings.primary_color||"#2563EB",-25)} 100%)` }}>
      <div className="flex flex-col items-center gap-5 anim-fadeUp">
        {settings.store_logo
          ? <img src={api.fileUrl(settings.store_logo)} className="w-28 h-28 rounded-full object-cover shadow-2xl ring-4 ring-white/30" alt="logo"/>
          : <div className="w-28 h-28 rounded-full bg-white/20 ring-4 ring-white/30 shadow-2xl flex items-center justify-center text-6xl font-black text-white">
              {settings.store_name?.[0]||"م"}
            </div>
        }
        <div className="text-center">
          <h1 className="text-white text-4xl font-black drop-shadow">{settings.store_name||"لقطة ستور"}</h1>
          <p className="text-white/70 mt-1.5 text-base font-medium">✨ تسوّق بسهولة وثقة ✨</p>
        </div>
        <div className="flex gap-2 mt-1">
          {[0,150,300].map(d => (
            <span key={d} className="w-2.5 h-2.5 rounded-full bg-white/50 animate-bounce" style={{animationDelay:`${d}ms`}}/>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── ROOT APP ───────────────────────────────────────────────── */
export default function App() {
  const isAdmin = window.location.pathname.startsWith(ADMIN_PATH);
  const [splashDone, setSplashDone] = useState(isAdmin);
  const [route, setRoute]           = useState(isAdmin ? "admin" : "shop");
  const [settings, setSettings]     = useState({ store_name:"", store_logo:"", whatsapp:"", primary_color:"#2563EB" });
  const [categories, setCategories] = useState([]);
  const [zones, setZones]           = useState([]);
  const [products, setProducts]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [cart, setCart]             = useLocalStorage("store_cart", []);
  const [favs, setFavs]             = useLocalStorage("store_favs", []);
  const [cartOpen, setCartOpen]     = useState(false);
  const [modalProduct, setModalProd]= useState(null);
  const [checkoutOpen, setCheckout] = useState(false);
  const [token, setToken]           = useState(localStorage.getItem("admin_token")||"");

  const brand = settings.primary_color || "#2563EB";

  const setBrandCss = (c) => {
    document.documentElement.style.setProperty("--brand", c||"#2563EB");
    document.documentElement.style.setProperty("--brand-dark", useShadeColor(c||"#2563EB",-18));
    document.documentElement.style.setProperty("--brand-light", useShadeColor(c||"#2563EB",55));
  };

  const loadAll = useCallback(() => {
    setLoading(true);
    Promise.all([api.getProducts(), api.getSettings(), api.getCategories(), api.getShippingZones()])
      .then(([p,s,c,z]) => { setProducts(p); setSettings(s); setCategories(c); setZones(z); setBrandCss(s.primary_color); })
      .catch(()=>{})
      .finally(()=>setLoading(false));
  }, []);

  useEffect(() => {
    loadAll();
    const pid = new URLSearchParams(window.location.search).get("product");
    if (pid) api.getProducts().then(list => { const f=list.find(p=>p.id===pid); if(f) setModalProd(f); });
  }, []);

  const addToCart = (item) => setCart(c => {
    const ex = c.find(x => x.id===item.id && x.size===item.size);
    return ex ? c.map(x => x===ex ? {...x, qty:x.qty+item.qty} : x) : [...c, item];
  });

  const cartCount = cart.reduce((s,c)=>s+c.qty, 0);

  return (
    <div dir="rtl" style={{"--brand":brand,"--brand-dark":useShadeColor(brand,-18),"--brand-light":useShadeColor(brand,58)}}>
      {/* Splash */}
      {!splashDone && <Splash settings={settings} onDone={()=>setSplashDone(true)}/>}

      {route !== "admin" && <>
        <TopBar settings={settings} route={route} setRoute={setRoute} cartCount={cartCount} onCart={()=>setCartOpen(true)}/>
        {route==="shop"     && <ShopView products={products} categories={categories} loading={loading} favs={favs} setFavs={setFavs} onOpen={setModalProd} settings={settings}/>}
        {route==="myorders" && <MyOrdersView onPrint={o=>openInvoice(o.id)}/>}
        {modalProduct && <ProductModal product={modalProduct} settings={settings}
          onClose={()=>{setModalProd(null);window.history.replaceState({},"","/");}}
          onAdd={i=>{addToCart(i);setModalProd(null);setCartOpen(true);}}/>}
        {cartOpen && <CartDrawer cart={cart} products={products} setCart={setCart} onClose={()=>setCartOpen(false)} onCheckout={()=>{setCartOpen(false);setCheckout(true);}}/>}
        {checkoutOpen && <CheckoutModal cart={cart} products={products} settings={settings} zones={zones}
          onClose={()=>setCheckout(false)} onDone={()=>{setCart([]);setCheckout(false);loadAll();}}/>}
        <Footer settings={settings}/>
      </>}

      {route==="admin" && (token
        ? <AdminPanel settings={settings} categories={categories} zones={zones} token={token}
            onLogout={()=>{localStorage.removeItem("admin_token");setToken("");}}
            onChanged={loadAll} onPrint={o=>openInvoice(o.id)}/>
        : <AdminLogin onLogin={t=>{localStorage.setItem("admin_token",t);setToken(t);}} brand={brand}/>
      )}
    </div>
  );
}

/* ─── openInvoice helper ────────────────────────────────────── */
// يفتح الفاتورة من الباك إند في تاب جديد — يدعم الطباعة وحفظ PDF
function openInvoice(orderId) {
  if (!orderId) return;
  window.open(api.invoiceUrl(orderId), "_blank", "noopener");
}


/* ─── TOP BAR ─────────────────────────────────────────────────── */
function TopBar({ settings, route, setRoute, cartCount, onCart }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(()=>{
    const fn=()=>setScrolled(window.scrollY>8);
    window.addEventListener("scroll",fn);
    return ()=>window.removeEventListener("scroll",fn);
  },[]);
  return (
    <header className={`sticky top-0 z-40 bg-white transition-shadow ${scrolled?"shadow-md":"border-b border-slate-100"}`}>
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <button className="flex items-center gap-2.5 group" onClick={()=>setRoute("shop")}>
          {settings.store_logo
            ? <img src={api.fileUrl(settings.store_logo)} className="w-9 h-9 rounded-full object-cover ring-2 ring-[var(--brand)]/20" alt=""/>
            : <div className="w-9 h-9 rounded-xl bg-[var(--brand)] flex items-center justify-center text-white font-black text-lg">{settings.store_name?.[0]||"م"}</div>
          }
          <span className="font-black text-[17px] text-slate-800 group-hover:text-[var(--brand)] transition">{settings.store_name||"متجري"}</span>
        </button>

        <nav className="hidden sm:flex items-center gap-1">
          {[["shop","المتجر"],["myorders","طلباتي"]].map(([r,l])=>(
            <button key={r} onClick={()=>setRoute(r)}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition ${route===r?"bg-[var(--brand)] text-white":"text-slate-500 hover:text-[var(--brand)] hover:bg-[var(--brand-light)]"}`}>
              {l}
            </button>
          ))}
        </nav>

        <button onClick={onCart} className="relative w-10 h-10 rounded-xl bg-[var(--brand)] text-white flex items-center justify-center shadow hover:shadow-md transition hover:scale-105 active:scale-95">
          <ShoppingBag size={18}/>
          {cartCount>0 && <span className="absolute -top-1.5 -left-1.5 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-black border-2 border-white">{cartCount}</span>}
        </button>
      </div>
    </header>
  );
}

/* ─── HERO ─────────────────────────────────────────────────────── */
function Hero({ settings }) {
  return (
    <section className="relative overflow-hidden" style={{background:`linear-gradient(135deg, var(--brand) 0%, var(--brand-dark) 100%)`}}>
      <div className="absolute inset-0 opacity-10" style={{backgroundImage:"radial-gradient(circle at 20% 80%, white 0%, transparent 60%), radial-gradient(circle at 80% 20%, white 0%, transparent 60%)"}}/>
      <div className="relative max-w-6xl mx-auto px-4 py-16 flex flex-col sm:flex-row items-center gap-10">
        <div className="flex-1 text-center sm:text-right anim-fadeUp">
          <div className="inline-flex items-center gap-2 bg-white/20 text-white/90 text-xs px-3 py-1.5 rounded-full mb-4 font-medium">
            <Sparkles size={12}/> أهلاً بك في {settings.store_name||"متجرنا"}
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-white leading-tight mb-4">
            تسوّق أذكى<br/><span className="text-white/70">بجودة أعلى</span>
          </h1>
          <p className="text-white/75 text-base mb-6">اكتشف منتجاتنا المميزة واطلب بسهولة عبر واتساب</p>
          <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
            {[["ShieldCheck","جودة مضمونة"],["Truck","توصيل سريع"],["Clock","دعم 24/7"]].map(([I,t])=>(
              <span key={t} className="flex items-center gap-1.5 bg-white/15 backdrop-blur text-white text-xs px-3 py-1.5 rounded-full font-medium">{t}</span>
            ))}
          </div>
        </div>
        <div className="shrink-0 anim-scaleIn">
          {settings.store_logo
            ? <img src={api.fileUrl(settings.store_logo)} className="w-36 h-36 rounded-3xl object-cover shadow-2xl ring-4 ring-white/20" alt=""/>
            : <div className="w-36 h-36 rounded-3xl bg-white/20 ring-4 ring-white/20 shadow-2xl flex items-center justify-center text-7xl font-black text-white">{settings.store_name?.[0]||"م"}</div>
          }
        </div>
      </div>
    </section>
  );
}

/* ─── SHOP VIEW ────────────────────────────────────────────────── */
function ShopView({ products, categories, loading, favs, setFavs, onOpen, settings }) {
  const [q, setQ]         = useState("");
  const [cat, setCat]     = useState("الكل");
  const [sort, setSort]   = useState("default");
  const [favOnly, setFavOnly] = useState(false);

  const list = useMemo(()=>{
    let l = products.filter(p=>(cat==="الكل"||p.category===cat)&&p.name.includes(q)&&(!favOnly||favs.includes(p.id)));
    if (sort==="asc")  l=[...l].sort((a,b)=>a.price-b.price);
    if (sort==="desc") l=[...l].sort((a,b)=>b.price-a.price);
    return l;
  },[products,q,cat,sort,favOnly,favs]);

  const toggle = id=>setFavs(f=>f.includes(id)?f.filter(x=>x!==id):[...f,id]);

  return (
    <div className="bg-slate-50 min-h-screen">
      <Hero settings={settings}/>

      {/* شريط البحث */}
      <div className="max-w-6xl mx-auto px-4">
        <div className="bg-white rounded-2xl shadow-lg -mt-6 p-3 flex gap-2 relative z-10">
          <div className="flex-1 relative">
            <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="ابحث عن منتج..."
              className="w-full pr-9 pl-3 py-2.5 text-sm rounded-xl outline-none bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[var(--brand)]/20 border border-transparent focus:border-[var(--brand)]/30 transition"/>
          </div>
          <select value={sort} onChange={e=>setSort(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 text-sm outline-none bg-slate-50 text-slate-600 shrink-0">
            <option value="default">ترتيب</option>
            <option value="asc">سعر ↑</option>
            <option value="desc">سعر ↓</option>
          </select>
          <button onClick={()=>setFavOnly(v=>!v)}
            className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 transition ${favOnly?"bg-red-50 border-red-200":"border-slate-200 bg-slate-50"}`}>
            <Heart size={16} className={favOnly?"fill-red-500 text-red-500":"text-slate-400"}/>
          </button>
        </div>
      </div>

      {/* التصنيفات */}
      <div className="max-w-6xl mx-auto px-4 mt-6 mb-5">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {["الكل",...categories.map(c=>c.name)].map(name=>(
            <button key={name} onClick={()=>setCat(name)}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition whitespace-nowrap border
                ${cat===name?"bg-[var(--brand)] text-white border-[var(--brand)] shadow-md shadow-[var(--brand)]/20":"bg-white text-slate-600 border-slate-200 hover:border-[var(--brand)]/40 hover:text-[var(--brand)]"}`}>
              {name}
            </button>
          ))}
        </div>
      </div>

      {/* المنتجات */}
      <div className="max-w-6xl mx-auto px-4 pb-16">
        {loading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_,i)=>(
              <div key={i} className="bg-white rounded-2xl overflow-hidden animate-pulse">
                <div className="h-52 bg-slate-100"/>
                <div className="p-3 space-y-2"><div className="h-3 bg-slate-100 rounded w-3/4"/><div className="h-3 bg-slate-100 rounded w-1/2"/><div className="h-4 bg-slate-100 rounded w-1/3"/></div>
              </div>
            ))}
          </div>
        ) : list.length===0 ? (
          <div className="text-center py-24 text-slate-400">
            <Package size={52} className="mx-auto mb-3 opacity-20"/>
            <p className="font-medium">لا توجد منتجات مطابقة</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-slate-400 mb-4 font-medium">{list.length} منتج</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {list.map(p=><ProductCard key={p.id} p={p} fav={favs.includes(p.id)} onToggleFav={()=>toggle(p.id)} onClick={()=>onOpen(p)}/>)}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── PRODUCT CARD ─────────────────────────────────────────────── */
function ProductCard({ p, fav, onToggleFav, onClick }) {
  const sl = stockLabel(p.stock);
  return (
    <div className="product-card bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group flex flex-col">
      <div className="relative overflow-hidden" onClick={onClick}>
        <img src={api.fileUrl(p.images?.[0])} alt={p.name} className="product-img w-full h-48 sm:h-52 object-cover"/>
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition duration-300"/>

        <button onClick={e=>{e.stopPropagation();onToggleFav();}}
          className="absolute top-2.5 left-2.5 w-8 h-8 rounded-full bg-white/90 backdrop-blur flex items-center justify-center shadow transition hover:scale-110 active:scale-95">
          <Heart size={14} className={fav?"fill-red-500 text-red-500":"text-slate-400"}/>
        </button>

        {sl.text!=="متوفر" && <span className={`absolute bottom-2.5 right-2.5 text-[11px] px-2.5 py-1 rounded-full font-bold ${sl.cls}`}>{sl.text}</span>}

        <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-3 opacity-0 group-hover:opacity-100 transition duration-300">
          <span className="bg-white text-[var(--brand)] text-xs px-4 py-1.5 rounded-full shadow-lg font-bold flex items-center gap-1">
            <Eye size={12}/> عرض
          </span>
        </div>
      </div>

      <div className="p-3 flex flex-col flex-1" onClick={onClick}>
        <p className="text-sm font-bold text-slate-800 line-clamp-2 leading-snug mb-1.5">{p.name}</p>
        <div className="flex items-center gap-0.5 mb-2">
          {[...Array(5)].map((_,i)=>(
            <Star key={i} size={11} className={i<Math.round(p.rating||0)?"star-filled":"star-empty"}/>
          ))}
          <span className="text-[10px] text-slate-400 mr-1">{p.rating?.toFixed(1)||"0"} ({p.reviews||0})</span>
        </div>
        <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-50">
          <span className="text-base font-black text-[var(--brand)]">{fmt(p.price)}</span>
          <span className="text-[10px] bg-[var(--brand-light)] text-[var(--brand)] px-2 py-0.5 rounded-full font-semibold">{p.category}</span>
        </div>
      </div>
    </div>
  );
}

/* ─── ProductRating Component ───────────────────────────────── */
function ProductRating({ productId, rating, reviews, interactive, onRated }) {
  const [myRating, setMyRating]   = useLocalStorage(`rated_${productId}`, 0);
  const [hovered, setHovered]     = useState(0);
  const [current, setCurrent]     = useState(rating);
  const [count, setCount]         = useState(reviews);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage]     = useState("");

  const handleRate = async (stars) => {
    if (myRating || submitting) return;
    setSubmitting(true);
    try {
      const res = await api.rateProduct(productId, stars);
      setMyRating(stars);
      setCurrent(res.rating);
      setCount(res.reviews);
      setMessage("شكراً على تقييمك! ⭐");
      if (onRated) onRated(res.rating, res.reviews);
      setTimeout(() => setMessage(""), 3000);
    } catch { setMessage("تعذّر إرسال التقييم"); }
    finally { setSubmitting(false); }
  };

  const displayRating = hovered || myRating || current;

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-1">
        {[1,2,3,4,5].map(i => (
          <button key={i}
            onClick={() => interactive && !myRating && handleRate(i)}
            onMouseEnter={() => interactive && !myRating && setHovered(i)}
            onMouseLeave={() => setHovered(0)}
            className={`transition-transform ${interactive && !myRating ? "cursor-pointer hover:scale-125" : "cursor-default"}`}
            disabled={!!myRating || submitting}>
            <Star size={22}
              className={`transition-colors ${
                i <= displayRating ? "fill-amber-400 text-amber-400" :
                i <= current       ? "fill-amber-300 text-amber-300" :
                                     "fill-slate-200 text-slate-200"
              }`}/>
          </button>
        ))}
        <span className="text-sm font-bold text-slate-700">{current.toFixed(1)}</span>
        <span className="text-xs text-slate-400">({count} تقييم)</span>
      </div>
      {interactive && !myRating && (
        <p className="text-[11px] text-slate-400">اضغط على النجوم لتقييم هذا المنتج</p>
      )}
      {interactive && myRating > 0 && (
        <p className="text-[11px] text-emerald-600 font-medium flex items-center gap-1"><Check size={11}/> قيّمت هذا المنتج بـ {myRating} نجوم</p>
      )}
      {message && <p className="text-[11px] text-[var(--brand)] font-medium mt-0.5">{message}</p>}
    </div>
  );
}

/* ─── PRODUCT MODAL ─────────────────────────────────────────────── */
function ProductModal({ product: p, settings, onClose, onAdd }) {
  const [size, setSize] = useState(p.sizes?.[0]||"");
  const [qty, setQty]   = useState(1);
  const [imgIdx, setImg]= useState(0);
  const sl = stockLabel(p.stock);
  const imgs = p.images||[];

  const share = ()=>{
    const link = api.shareUrl(p.id);
    const text = `✨ ${p.name}\n💰 ${fmt(p.price)}\n🔗 ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl max-h-[92vh] overflow-y-auto shadow-2xl anim-scaleIn" onClick={e=>e.stopPropagation()}>
        {/* صورة */}
        <div className="relative">
          <img src={api.fileUrl(imgs[imgIdx]||imgs[0])} alt={p.name} className="w-full h-72 sm:h-80 object-cover sm:rounded-t-3xl"/>
          <button onClick={onClose} className="absolute top-3 left-3 w-9 h-9 rounded-full bg-white/90 flex items-center justify-center shadow hover:scale-105 transition">
            <X size={17}/>
          </button>
          {imgs.length>1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {imgs.map((_,i)=><button key={i} onClick={()=>setImg(i)} className={`w-2 h-2 rounded-full transition ${i===imgIdx?"bg-white":"bg-white/50"}`}/>)}
            </div>
          )}
        </div>

        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <h2 className="font-black text-xl text-slate-800 leading-tight flex-1">{p.name}</h2>
            <span className="text-2xl font-black text-[var(--brand)] shrink-0">{fmt(p.price)}</span>
          </div>

          <div className="flex items-center justify-between mb-4">
            <ProductRating
  productId={p.id}
  rating={p.rating || 0}
  reviews={p.reviews || 0}
  interactive={true}
  onRated={(rating, reviews) => {
    p.rating = rating;
    p.reviews = reviews;
  }}
/>
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${sl.cls}`}>{sl.text}</span>
          </div>

          {p.sizes?.length>0 && p.variant_label !== "none" && (
            <div className="mb-4">
              <p className="text-xs font-black text-slate-500 uppercase tracking-wider mb-2">{p.variant_label || "المقاس"}</p>
              <div className="flex flex-wrap gap-2">
                {p.sizes.map(s=>(
                  <button key={s} onClick={()=>setSize(s)}
                    className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition ${size===s?"bg-[var(--brand)] text-white border-[var(--brand)]":"border-slate-200 hover:border-[var(--brand)]/50"}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between bg-slate-50 rounded-2xl p-3 mb-4">
            <span className="text-sm font-bold text-slate-700">الكمية</span>
            <div className="flex items-center gap-3">
              <button onClick={()=>setQty(q=>Math.max(1,q-1))} className="w-9 h-9 rounded-xl bg-white border-2 border-slate-200 flex items-center justify-center hover:border-[var(--brand)] transition"><Minus size={14}/></button>
              <span className="w-7 text-center text-lg font-black">{qty}</span>
              <button onClick={()=>setQty(q=>Math.min(p.stock,q+1))} className="w-9 h-9 rounded-xl bg-[var(--brand)] text-white flex items-center justify-center"><Plus size={14}/></button>
            </div>
          </div>

          <div className="flex gap-2">
            <button disabled={p.stock===0} onClick={()=>onAdd({id:p.id,qty,size})}
              className="flex-1 bg-[var(--brand)] disabled:bg-slate-200 disabled:cursor-not-allowed text-white py-3.5 rounded-2xl text-sm font-black shadow hover:shadow-lg transition hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2">
              <ShoppingBag size={16}/>{p.stock===0?"غير متوفر":"أضف للسلة"}
            </button>
            <button onClick={share} className="w-12 h-12 rounded-2xl border-2 border-slate-200 flex items-center justify-center text-slate-500 hover:border-emerald-400 hover:text-emerald-600 transition hover:bg-emerald-50">
              <Share2 size={17}/>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── CART ─────────────────────────────────────────────────────── */
function CartDrawer({ cart, products, setCart, onClose, onCheckout }) {
  const items = cart.map(c=>({...c,p:products.find(x=>x.id===c.id)})).filter(i=>i.p);
  const total = items.reduce((s,i)=>s+i.p.price*i.qty,0);
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex justify-end" onClick={onClose}>
      <div className="bg-white w-full sm:w-96 h-full flex flex-col shadow-2xl anim-fadeIn" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-black text-lg flex items-center gap-2"><ShoppingCart size={20} className="text-[var(--brand)]"/>السلة <span className="text-slate-400 text-sm font-normal">({items.length})</span></h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition"><X size={16}/></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {items.length===0
            ? <div className="text-center py-20 text-slate-400"><ShoppingBag size={52} className="mx-auto mb-3 opacity-20"/><p>سلتك فارغة</p></div>
            : items.map((i,idx)=>(
              <div key={idx} className="flex gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <img src={api.fileUrl(i.p.images?.[0])} className="w-16 h-16 rounded-xl object-cover shrink-0"/>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold line-clamp-1">{i.p.name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">المقاس: {i.size} · الكمية: {i.qty}</p>
                  <p className="text-sm font-black text-[var(--brand)] mt-1">{fmt(i.p.price*i.qty)}</p>
                </div>
                <button onClick={()=>setCart(c=>c.filter((_,x)=>x!==idx))} className="text-red-400 hover:text-red-600 self-start mt-1 transition"><Trash2 size={15}/></button>
              </div>
            ))
          }
        </div>
        {items.length>0 && (
          <div className="p-4 border-t border-slate-100 space-y-3">
            <div className="flex justify-between"><span className="text-slate-500 text-sm">الإجمالي (قبل الشحن)</span><span className="font-black text-lg text-[var(--brand)]">{fmt(total)}</span></div>
            <button onClick={onCheckout} className="w-full bg-[var(--brand)] text-white py-3.5 rounded-2xl font-black text-sm shadow hover:shadow-lg transition hover:scale-[1.02] active:scale-[0.98]">إتمام الطلب ←</button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── CHECKOUT ──────────────────────────────────────────────────── */
function CheckoutModal({ cart, products, settings, zones, onClose, onDone }) {
  const [savedInfo, setSavedInfo] = useLocalStorage("store_customer_info", {});
  const [f, setF] = useState({ name:savedInfo.name||"", phone:savedInfo.phone||"", city:savedInfo.city||zones[0]?.city||"", address:savedInfo.address||"" });
  const [busy, setBusy]     = useState(false);
  const [err, setErr]       = useState("");
  const [result, setResult] = useState(null);
  const sf = (k,v) => setF(x=>({...x,[k]:v}));

  const items = cart.map(c=>({...c,p:products.find(x=>x.id===c.id)})).filter(i=>i.p);
  const subtotal = items.reduce((s,i)=>s+i.p.price*i.qty,0);
  const zone     = zones.find(z=>z.city===f.city)||zones.find(z=>z.city==="أخرى")||{cost:0};
  const total    = subtotal+zone.cost;

  const submit = async()=>{
    setBusy(true); setErr("");
    try {
      const res = await api.createOrder({customerName:f.name,customerPhone:f.phone,customerCity:f.city,customerAddress:f.address,items:items.map(i=>({id:i.id,qty:i.qty,size:i.size})),shipping:zone.cost});
      setSavedInfo({ name:f.name, phone:f.phone, city:f.city, address:f.address });
      setResult(res);
      onDone();
      window.location.href = res.whatsappLink;
    } catch(e){setErr(e.message);}
    finally{setBusy(false);}
  };

  if (result) return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-3xl max-w-sm w-full p-8 text-center shadow-2xl anim-scaleIn" onClick={e=>e.stopPropagation()}>
        <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4"><CheckCircle2 size={30} className="text-emerald-500"/></div>
        <h3 className="font-black text-xl mb-1">تم تأكيد طلبك 🎉</h3>
        <p className="font-mono font-black text-2xl text-[var(--brand)] my-3 tracking-widest">{result.order.id}</p>
        <p className="text-xs text-slate-500 mb-5">يتم تحويلك إلى واتساب {settings.store_name} لإتمام الدفع</p>
        <a href={result.whatsappLink} className="block w-full bg-emerald-500 text-white py-3.5 rounded-2xl text-sm font-black mb-2 hover:bg-emerald-600 transition">فتح واتساب</a>
        <button onClick={onClose} className="text-xs text-slate-400 underline">إغلاق</button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[92vh] overflow-y-auto shadow-2xl anim-scaleIn" onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-3xl z-10">
          <h3 className="font-black text-lg">تأكيد الطلب</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"><X size={16}/></button>
        </div>
        <div className="p-5 space-y-3">
          {err && <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-xl p-3"><AlertCircle size={14}/>{err}</div>}

          {[["الاسم الكامل","name","text","سارة أحمد",<User size={13}/>],["رقم الهاتف","phone","tel","7xxxxxxxx",<Phone size={13}/>],["العنوان","address","text","الحي، الشارع، أقرب نقطة",<MapPin size={13}/>]].map(([lbl,k,t,ph,icon])=>(
            <div key={k}>
              <label className="text-xs font-black text-slate-500 flex items-center gap-1 mb-1.5">{icon}{lbl}</label>
              <input type={t} value={f[k]} onChange={e=>sf(k,e.target.value)} placeholder={ph}
                className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--brand)] transition bg-white"/>
            </div>
          ))}

          <div>
            <label className="text-xs font-black text-slate-500 flex items-center gap-1 mb-1.5"><MapPin size={13}/>المدينة</label>
            <select value={f.city} onChange={e=>sf("city",e.target.value)}
              className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--brand)] bg-white">
              {zones.map(z=><option key={z.id} value={z.city}>{z.city} — {z.cost===0?"مجاني ":fmt(z.cost)}</option>)}
            </select>
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 space-y-2">
            {items.map((i,idx)=>(
              <div key={idx} className="flex justify-between text-xs text-slate-500">
                <span>{i.p.name} × {i.qty}</span><span>{fmt(i.p.price*i.qty)}</span>
              </div>
            ))}
            <div className="border-t border-slate-200 pt-2 mt-1 space-y-1.5">
              {[["المجموع الفرعي",fmt(subtotal)],["رسوم الشحن",zone.cost===0?"مجاني ":fmt(zone.cost)]].map(([l,v])=>(
                <div key={l} className="flex justify-between text-sm text-slate-500"><span>{l}</span><span>{v}</span></div>
              ))}
              <div className="flex justify-between font-black text-base text-[var(--brand)] pt-1"><span>الإجمالي</span><span>{fmt(total)}</span></div>
            </div>
          </div>

          {savedInfo.name && (
            <p className="text-[11px] text-slate-400 flex items-center gap-1"><Check size={10}/> تم تعبئة بياناتك المحفوظة تلقائياً</p>
          )}
          <button disabled={!f.name.trim()||!f.phone.trim()||!f.address.trim()||busy} onClick={submit}
            className="w-full bg-[var(--brand)] disabled:bg-slate-200 text-white py-4 rounded-2xl font-black text-sm shadow hover:shadow-lg transition hover:scale-[1.01] active:scale-[0.99]">
            {busy?"جاري الإرسال...":"✓ تأكيد الطلب والتوجه لواتساب"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── MY ORDERS ─────────────────────────────────────────────────── */
const STATUS_STEPS = ["قيد المعالجة","تم الشحن","تم التسليم"];
const STATUS_ICONS = { "قيد المعالجة":"🔄", "تم الشحن":"🚚", "تم التسليم":"✅" };
const STATUS_COLORS = { "قيد المعالجة":"bg-amber-50 text-amber-700 border-amber-200", "تم الشحن":"bg-blue-50 text-blue-700 border-blue-200", "تم التسليم":"bg-emerald-50 text-emerald-700 border-emerald-200" };

function OrderTimeline({ status, paymentConfirmed }) {
  const idx = STATUS_STEPS.indexOf(status);
  return (
    <div className="mt-3 mb-2">
      {/* حالة الدفع */}
      <div className={`flex items-center gap-2 text-xs px-3 py-2 rounded-xl mb-3 font-bold border ${paymentConfirmed ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-orange-50 text-orange-700 border-orange-200"}`}>
        <span>{paymentConfirmed ? "💰 تم تأكيد الدفع" : "⏳ بانتظار تأكيد الدفع"}</span>
      </div>
      {/* مراحل الطلب */}
      <div className="flex items-center gap-0">
        {STATUS_STEPS.map((step, i) => {
          const done = i <= idx;
          const active = i === idx;
          return (
            <React.Fragment key={step}>
              <div className="flex flex-col items-center gap-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black border-2 transition-all ${done ? "bg-[var(--brand)] border-[var(--brand)] text-white shadow-md" : "bg-white border-slate-200 text-slate-300"}`}>
                  {done ? (active ? STATUS_ICONS[step] : "✓") : (i+1)}
                </div>
                <span className={`text-[9px] font-bold whitespace-nowrap ${done ? "text-[var(--brand)]" : "text-slate-300"}`}>{step}</span>
              </div>
              {i < STATUS_STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mb-4 mx-1 ${i < idx ? "bg-[var(--brand)]" : "bg-slate-200"}`}/>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

function MyOrdersView({ onPrint }) {
  const [savedPhone, setSavedPhone] = useLocalStorage("store_customer_phone", "");
  const [phone, setPhone] = useState(savedPhone);
  const [orders, setOrders] = useState(null);
  const [busy, setBusy] = useState(false);
  const [autoLoaded, setAutoLoaded] = useState(false);

  const search = (ph) => {
    const p = (ph ?? phone).trim();
    if (!p) return;
    setBusy(true);
    setSavedPhone(p);
    api.getOrdersByPhone(p).then(setOrders).finally(() => setBusy(false));
  };

  // تحميل تلقائي إذا كان الهاتف محفوظاً
  useEffect(() => {
    if (savedPhone && !autoLoaded) { setAutoLoaded(true); search(savedPhone); }
  }, []);

  return (
    <div className="max-w-lg mx-auto px-4 py-10 min-h-screen bg-slate-50">
      {/* هيدر */}
      <div className="text-center mb-6">
        <div className="w-14 h-14 rounded-2xl bg-[var(--brand)]/10 flex items-center justify-center mx-auto mb-3">
          <ListOrdered size={24} className="text-[var(--brand)]"/>
        </div>
        <h2 className="font-black text-2xl mb-1">طلباتي</h2>
        <p className="text-slate-400 text-sm">تابع حالة طلباتك ومدفوعاتك لحظة بلحظة</p>
      </div>

      {/* بحث */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-5">
        <label className="text-xs font-black text-slate-500 block mb-2 flex items-center gap-1"><Phone size={12}/>رقم الهاتف</label>
        <div className="flex gap-2">
          <input value={phone} onChange={e => setPhone(e.target.value)} onKeyDown={e => e.key==="Enter" && search()}
            placeholder="أدخل رقم الهاتف المستخدم عند الطلب"
            className="flex-1 border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--brand)] transition"/>
          <button onClick={() => search()} disabled={busy}
            className="bg-[var(--brand)] text-white px-5 rounded-xl font-black text-sm hover:shadow-md transition flex items-center gap-1.5">
            {busy ? <RefreshCw size={15} className="animate-spin"/> : <Search size={15}/>}
            {busy ? "" : "بحث"}
          </button>
        </div>
        {savedPhone && <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1"><Check size={10}/> تم حفظ رقمك تلقائياً للمرة القادمة</p>}
      </div>

      {/* النتائج */}
      {orders !== null && orders.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <Package size={48} className="mx-auto mb-3 opacity-20"/>
          <p className="font-medium">لا توجد طلبات بهذا الرقم</p>
          <p className="text-xs mt-1">تأكد من الرقم المستخدم عند الطلب</p>
        </div>
      )}

      <div className="space-y-4">
        {orders?.map(o => (
          <div key={o.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {/* رأس الكارد */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-50 bg-slate-50/50">
              <div>
                <span className="font-mono font-black text-slate-700 text-sm">{o.id}</span>
                <p className="text-[10px] text-slate-400 mt-0.5">{new Date(o.created_at||Date.now()).toLocaleDateString("ar-YE",{year:"numeric",month:"long",day:"numeric"})}</p>
              </div>
              <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold border ${STATUS_COLORS[o.status]||"bg-slate-50 text-slate-500 border-slate-200"}`}>
                {STATUS_ICONS[o.status]} {o.status}
              </span>
            </div>

            <div className="p-4">
              {/* مخطط التقدم */}
              <OrderTimeline status={o.status} paymentConfirmed={o.payment_confirmed||o.paymentConfirmed}/>

              {/* المنتجات */}
              <div className="bg-slate-50 rounded-xl p-3 mt-3 space-y-1.5">
                {o.items?.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-xs">
                    <span className="text-slate-600">{item.name} <span className="text-slate-400">({item.size}) × {item.qty}</span></span>
                    <span className="font-bold text-slate-700">{fmt(item.price * item.qty)}</span>
                  </div>
                ))}
                <div className="border-t border-slate-200 pt-1.5 mt-1.5 flex justify-between">
                  <span className="text-xs text-slate-500">الإجمالي</span>
                  <span className="text-sm font-black text-[var(--brand)]">{fmt(o.total)}</span>
                </div>
              </div>

              {/* أزرار */}
              <div className="flex gap-2 mt-3">
                <a href={api.invoiceUrl(o.id)} target="_blank" rel="noreferrer"
                  className="flex-1 border-2 border-slate-200 text-slate-600 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 hover:border-[var(--brand)] hover:text-[var(--brand)] transition">
                  <FileText size={13}/> طباعة الفاتورة
                </a>
                {o.status !== "تم التسليم" && (
                  <button onClick={() => search()}
                    className="border-2 border-slate-200 text-slate-500 px-3 rounded-xl hover:border-[var(--brand)] hover:text-[var(--brand)] transition"
                    title="تحديث الحالة">
                    <RefreshCw size={14}/>
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── FOOTER ─────────────────────────────────────────────────────── */
function Footer({ settings }) {
  return (
    <footer className="bg-white border-t border-slate-100 py-10 text-center">
      <div className="flex flex-col items-center gap-2">
        {settings.store_logo
          ? <img src={api.fileUrl(settings.store_logo)} className="w-10 h-10 rounded-xl object-cover" alt=""/>
          : <div className="w-10 h-10 rounded-xl bg-[var(--brand)] flex items-center justify-center text-white font-black">{settings.store_name?.[0]||"م"}</div>
        }
        <p className="font-black text-slate-700">{settings.store_name}</p>
        <p className="text-xs text-slate-400">تجربة تسوق منظمة عبر واتساب · جميع الحقوق محفوظة</p>
      </div>
    </footer>
  );
}

/* ─── ADMIN LOGIN ───────────────────────────────────────────────── */
function AdminLogin({ onLogin, brand }) {
  const [u,setU]=useState(""); const [p,setP]=useState(""); const [err,setErr]=useState(""); const [busy,setBusy]=useState(false);
  const submit=async()=>{setBusy(true);setErr("");try{const r=await api.login(u,p);onLogin(r.token);}catch(e){setErr(e.message);}finally{setBusy(false);}};
  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{background:`linear-gradient(135deg, ${brand} 0%, ${useShadeColor(brand,-22)} 100%)`}}>
      <div className="bg-white rounded-3xl w-full max-w-sm p-8 shadow-2xl anim-scaleIn">
        <div className="w-14 h-14 rounded-2xl bg-[var(--brand)]/10 flex items-center justify-center mx-auto mb-5"><Lock size={24} style={{color:brand}}/></div>
        <h2 className="font-black text-xl text-center mb-6">دخول لوحة التحكم</h2>
        {err && <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-xl p-3 mb-3"><AlertCircle size={14}/>{err}</div>}
        <div className="space-y-3">
          <input value={u} onChange={e=>setU(e.target.value)} placeholder="اسم المستخدم"
            className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[var(--brand)] transition"/>
          <input type="password" value={p} onChange={e=>setP(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()} placeholder="كلمة المرور"
            className="w-full border-2 border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[var(--brand)] transition"/>
        </div>
        <button onClick={submit} disabled={busy} className="w-full text-white py-3.5 rounded-2xl font-black text-sm mt-4 hover:shadow-lg transition" style={{background:brand}}>
          {busy?"...":"دخول"}
        </button>
      </div>
    </div>
  );
}

/* ─── ADMIN PANEL ───────────────────────────────────────────────── */
function AdminPanel({ settings, categories: initCats, zones: initZones, onLogout, onChanged, onPrint }) {
  const [tab,setTab]       = useState("orders");
  const [orders,setOrders] = useState([]);
  const [products,setProd] = useState([]);
  const [cats,setCats]     = useState(initCats);
  const [zones,setZones]   = useState(initZones);
  const [stats,setStats]   = useState(null);
  const [authErr,setAuthErr]= useState(false);

  const refresh=()=>Promise.all([api.getAllOrders(),api.getProducts(),api.getStats(),api.getCategories(),api.getShippingZones()])
    .then(([o,p,s,c,z])=>{setOrders(o);setProd(p);setStats(s);setCats(c);setZones(z);})
    .catch(e=>{if(e.message.includes("غير مصرح")||e.message.includes("منتهية"))setAuthErr(true);});

  useEffect(()=>{refresh();},[]);
  if (authErr){onLogout();return null;}

  const TABS=[["orders","الطلبات",ListOrdered],["products","المنتجات",Package],["categories","التصنيفات",Tag],["shipping","الشحن",Truck],["settings","الإعدادات",Cog]];

  return (
    <div className="min-h-screen bg-slate-50">
      {/* هيدر */}
      <div className="sticky top-0 z-30 bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2.5">
              {settings.store_logo
                ? <img src={api.fileUrl(settings.store_logo)} className="w-8 h-8 rounded-lg object-cover" alt=""/>
                : <div className="w-8 h-8 rounded-lg bg-[var(--brand)] flex items-center justify-center text-white font-black text-sm">{settings.store_name?.[0]||"م"}</div>
              }
              <div><p className="font-black text-slate-800 text-sm leading-none">{settings.store_name}</p><p className="text-[10px] text-slate-400">لوحة التحكم</p></div>
            </div>
            <button onClick={onLogout} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-500 transition font-medium border border-slate-200 px-3 py-1.5 rounded-full hover:border-red-200">
              <LogOut size={13}/> خروج
            </button>
          </div>
          {/* تبويبات */}
          <div className="flex overflow-x-auto scrollbar-hide border-t border-slate-100">
            {TABS.map(([k,l,Icon])=>(
              <button key={k} onClick={()=>setTab(k)}
                className={`flex items-center gap-1.5 px-4 py-3 text-xs font-bold border-b-2 shrink-0 transition whitespace-nowrap
                  ${tab===k?"border-[var(--brand)] text-[var(--brand)]":"border-transparent text-slate-400 hover:text-slate-600"}`}>
                <Icon size={13}/>{l}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-5">
        {/* إحصائيات */}
        {stats && <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              {l:"مبيعات اليوم",v:fmt(stats.todaySales),I:TrendingUp,c:"blue"},
              {l:"مبيعات الشهر",v:fmt(stats.monthSales),I:BarChart3,c:"indigo"},
              {l:"إجمالي المبيعات",v:fmt(stats.totalSales),I:Package,c:"violet"},
              {l:"تنبيهات المخزون",v:stats.lowStock.length+stats.outOfStock.length,I:Bell,c:stats.lowStock.length+stats.outOfStock.length>0?"red":"slate"},
            ].map(({l,v,I,c})=>(
              <div key={l} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
                <div className={`w-9 h-9 rounded-xl bg-${c}-50 flex items-center justify-center mb-2`}><I size={16} className={`text-${c}-500`}/></div>
                <p className="text-xs text-slate-400 mb-0.5">{l}</p>
                <p className="font-black text-slate-800">{v}</p>
              </div>
            ))}
          </div>
          {stats.topProducts?.length>0 && (
            <div className="bg-white rounded-2xl border border-slate-100 p-4 mb-4">
              <p className="text-xs font-black text-slate-500 mb-2 flex items-center gap-1.5"><Sparkles size={13} className="text-amber-400"/>الأكثر مبيعًا</p>
              <div className="flex flex-wrap gap-2">
                {stats.topProducts.map((t,i)=>(
                  <span key={i} className="text-xs bg-[var(--brand-light)] text-[var(--brand)] px-3 py-1.5 rounded-full font-bold">#{i+1} {t.name} ({t.qty})</span>
                ))}
              </div>
            </div>
          )}
        </>}

        {tab==="orders"     && <OrdersTab orders={orders} onChanged={refresh} onPrint={onPrint}/>}
        {tab==="products"   && <ProductsTab products={products} cats={cats} onChanged={()=>{refresh();onChanged();}}/>}
        {tab==="categories" && <CatsTab cats={cats} onChanged={()=>{refresh();onChanged();}}/>}
        {tab==="shipping"   && <ShippingTab zones={zones} onChanged={()=>{refresh();onChanged();}}/>}
        {tab==="settings"   && <SettingsTab settings={settings} onChanged={()=>{refresh();onChanged();}}/>}
      </div>
    </div>
  );
}

/* ─── ORDERS TAB ─────────────────────────────────────────────────── */
function OrdersTab({ orders, onChanged, onPrint }) {
  const [cid,setCid]=useState(""); const [msg,setMsg]=useState("");
  const upStatus=async(id,s)=>{await api.updateOrderStatus(id,s);onChanged();};
  const confirm=async()=>{try{await api.confirmPayment(cid);setMsg("✅ تم تأكيد الدفع");setCid("");onChanged();}catch(e){setMsg("❌ "+e.message);}};
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-100 p-4">
        <p className="text-xs font-black text-slate-500 mb-2 flex items-center gap-1"><CheckCircle2 size={13} className="text-emerald-500"/>تأكيد استلام الدفع</p>
        <div className="flex gap-2">
          <input value={cid} onChange={e=>setCid(e.target.value)} placeholder="ORD-XXXXX"
            className="flex-1 border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--brand)]"/>
          <button onClick={confirm} className="bg-emerald-500 text-white text-xs px-5 rounded-xl font-black">تأكيد</button>
        </div>
        {msg && <p className="text-xs text-slate-500 mt-2">{msg}</p>}
      </div>
      {orders.length===0 ? <p className="text-center text-slate-400 py-16">لا توجد طلبات بعد</p>
        : orders.map(o=>(
        <div key={o.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
          <div className="flex justify-between items-start mb-2">
            <span className="font-mono font-black text-slate-700">{o.id}</span>
            <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold ${o.paymentConfirmed?"bg-emerald-50 text-emerald-600":"bg-amber-50 text-amber-700"}`}>
              {o.paymentConfirmed?"✓ مدفوع":"⏳ انتظار"}
            </span>
          </div>
          <p className="text-xs text-slate-500 mb-1 flex items-center gap-1"><User size={11}/>{o.customer_name} · {o.customer_phone} · {o.customer_city}</p>
          <ul className="text-xs text-slate-400 mb-2">{o.items?.map((i,idx)=><li key={idx}>• {i.name} ({i.size}) × {i.qty}</li>)}</ul>
          <div className="flex items-center justify-between pt-2 border-t border-slate-50">
            <span className="font-black text-[var(--brand)]">{fmt(o.total)}</span>
            <div className="flex items-center gap-2">
              <select value={o.status} onChange={e=>upStatus(o.id,e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 outline-none">
                <option>قيد المعالجة</option><option>تم الشحن</option><option>تم التسليم</option>
              </select>
              <a href={api.invoiceUrl(o.id)} target="_blank" rel="noreferrer" className="text-xs text-slate-500 hover:text-[var(--brand)] flex items-center gap-1 transition"><FileText size={13}/>فاتورة PDF</a>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── PRODUCTS TAB ───────────────────────────────────────────────── */
function ProductsTab({ products, cats, onChanged }) {
  const [editing,setEditing]=useState(null);
  const remove=async id=>{await api.deleteProduct(id);onChanged();};
  return (
    <div className="space-y-3">
      <button onClick={()=>setEditing({id:null,name:"",category:cats[0]?.name||"",price:0,color:"",sizes:[],stock:0,images:[]})}
        className="w-full bg-[var(--brand)] text-white py-3 rounded-2xl text-sm font-black flex items-center justify-center gap-2 shadow hover:shadow-lg transition">
        <Plus size={15}/>إضافة منتج جديد
      </button>
      {products.map(p=>(
        <div key={p.id} className="bg-white rounded-2xl border border-slate-100 p-3 flex gap-3 items-center">
          {p.images?.[0]
            ? <img src={api.fileUrl(p.images[0])} className="w-14 h-14 rounded-xl object-cover shrink-0"/>
            : <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center shrink-0"><Img size={18} className="text-slate-300"/></div>
          }
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold line-clamp-1">{p.name}</p>
            <p className="text-xs text-slate-400">{fmt(p.price)} · مخزون: {p.stock} · {p.category}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={()=>setEditing(p)} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-[var(--brand)] hover:bg-[var(--brand-light)] transition"><Edit3 size={13}/></button>
            <button onClick={()=>remove(p.id)} className="w-8 h-8 rounded-lg border border-red-100 flex items-center justify-center text-red-400 hover:bg-red-50 transition"><Trash2 size={13}/></button>
          </div>
        </div>
      ))}
      {editing && <ProductModal2 product={editing} cats={cats} onClose={()=>setEditing(null)} onSaved={()=>{setEditing(null);onChanged();}}/>}
    </div>
  );
}

function ProductModal2({ product, cats, onClose, onSaved }) {
  const getVariantType = (vl) => {
    if (!vl || vl === "none") return "none";
    const found = VARIANT_TYPES.find(v => v.value === vl && v.value !== "custom");
    return found ? found.value : "custom";
  };

  const [f, setF]           = useState({ ...product, variant_label: product.variant_label || "المقاس" });
  const [err, setErr]       = useState("");
  const [uploading, setUp]  = useState(false);
  const [variantType, setVT]= useState(getVariantType(product.variant_label));
  const [customLabel, setCL]= useState(getVariantType(product.variant_label) === "custom" ? product.variant_label : "");
  const ref = useRef();

  const sf = (k, v) => setF(x => ({ ...x, [k]: v }));

  const handleVariantType = (val) => {
    setVT(val);
    if (val === "none")   { sf("variant_label", "none");  sf("sizes", []); }
    else if (val !== "custom") sf("variant_label", val);
  };

  const handleCustomLabel = (v) => {
    setCL(v);
    sf("variant_label", v);
  };

  const upload = async e => {
    const file = e.target.files[0];
    if (!file) return;
    setUp(true);
    try { const r = await api.uploadImage(file); sf("images", [r.url]); }
    catch (er) { setErr(er.message); }
    finally { setUp(false); }
  };

  const save = async () => {
    try {
      const payload = { ...f };
      if (variantType === "none") payload.sizes = [];
      if (f.id) await api.updateProduct(f.id, payload);
      else await api.createProduct(payload);
      onSaved();
    } catch (e) { setErr(e.message); }
  };

  const activeVariant = VARIANT_TYPES.find(v => v.value === variantType);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[92vh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-3xl z-10">
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center"><ChevronLeft size={16}/></button>
          <h3 className="font-black">{f.id ? "تعديل المنتج" : "منتج جديد"}</h3>
          <span className="w-8"/>
        </div>

        <div className="p-5 space-y-4">
          {err && <div className="text-xs text-red-600 bg-red-50 rounded-xl p-3">{err}</div>}

          {/* صورة */}
          <div>
            <label className="text-xs font-black text-slate-500 mb-1.5 block">صورة المنتج</label>
            <div className="flex items-center gap-3">
              {f.images?.[0]
                ? <img src={api.fileUrl(f.images[0])} className="w-20 h-20 rounded-2xl object-cover border-2 border-slate-200"/>
                : <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center"><Img size={24} className="text-slate-300"/></div>
              }
              <div className="flex flex-col gap-2">
                <button onClick={() => ref.current.click()} disabled={uploading}
                  className="text-xs border-2 border-slate-200 rounded-xl px-4 py-2 font-semibold flex items-center gap-1.5 hover:border-[var(--brand)] transition">
                  <Upload size={13}/>{uploading ? "جاري الرفع..." : "رفع صورة من الجهاز"}
                </button>
                {f.images?.[0] && <p className="text-[10px] text-slate-400 text-center">✔ الصورة محفوظة على Supabase</p>}
              </div>
              <input ref={ref} type="file" accept="image/*" className="hidden" onChange={upload}/>
            </div>
          </div>

          {/* الاسم */}
          <div>
            <label className="text-xs font-black text-slate-500 mb-1.5 block">اسم المنتج *</label>
            <input value={f.name} onChange={e => sf("name", e.target.value)} placeholder="مثال: عطر ورد عماني"
              className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--brand)] transition"/>
          </div>

          {/* التصنيف + السعر */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-black text-slate-500 mb-1.5 block">التصنيف *</label>
              <select value={f.category} onChange={e => sf("category", e.target.value)}
                className="w-full border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]">
                {cats.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-black text-slate-500 mb-1.5 block">السعر (ر.ي) *</label>
              <input type="number" value={f.price} onChange={e => sf("price", Number(e.target.value) || 0)}
                className="w-full border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]"/>
            </div>
          </div>

          {/* الكمية */}
          <div>
            <label className="text-xs font-black text-slate-500 mb-1.5 block">الكمية المتوفرة</label>
            <input type="number" min="0" value={f.stock} onChange={e => sf("stock", Number(e.target.value) || 0)}
              className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--brand)]"/>
          </div>

          {/* نوع الخيار */}
          <div className="bg-slate-50 rounded-2xl p-4 space-y-3">
            <label className="text-xs font-black text-slate-600 block">نوع خيارات المنتج</label>
            <div className="grid grid-cols-2 gap-2">
              {VARIANT_TYPES.map(vt => (
                <button key={vt.value} onClick={() => handleVariantType(vt.value)}
                  className={`text-xs px-3 py-2 rounded-xl border-2 font-semibold text-right transition
                    ${variantType === vt.value
                      ? "bg-[var(--brand)] text-white border-[var(--brand)]"
                      : "bg-white border-slate-200 text-slate-600 hover:border-[var(--brand)]/50"}`}>
                  {vt.label}
                </button>
              ))}
            </div>

            {variantType === "custom" && (
              <div>
                <label className="text-xs font-black text-slate-500 mb-1.5 block">اسم الخيار المخصص</label>
                <input value={customLabel} onChange={e => handleCustomLabel(e.target.value)} placeholder="مثال: الإصدار"
                  className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"/>
              </div>
            )}

            {variantType !== "none" && (
              <div>
                <label className="text-xs font-black text-slate-500 mb-1.5 block">
                  قيم {variantType === "custom" ? customLabel || "الخيار" : variantType} — مفصولة بفاصلة
                </label>
                <input
                  value={(f.sizes || []).join(",")}
                  onChange={e => sf("sizes", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                  placeholder={activeVariant?.placeholder || "أدخل القيم مفصولة بفاصلة"}
                  className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"/>
                {f.sizes?.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {f.sizes.map((s, i) => (
                      <span key={i} className="bg-[var(--brand)]/10 text-[var(--brand)] text-xs px-2.5 py-1 rounded-full font-medium">{s}</span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <button onClick={save} disabled={!f.name || !f.price}
            className="w-full bg-[var(--brand)] disabled:bg-slate-200 text-white py-3.5 rounded-2xl font-black text-sm hover:shadow-lg transition">
            حفظ المنتج
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── CATS TAB ────────────────────────────────────────────────────── */
function CatsTab({ cats, onChanged }) {
  const [name,setName]=useState(""); const [err,setErr]=useState("");
  const add=async()=>{if(!name.trim())return;try{await api.createCategory(name);setName("");onChanged();}catch(e){setErr(e.message);}};
  const remove=async id=>{try{await api.deleteCategory(id);onChanged();}catch(e){setErr(e.message);}};
  return (
    <div className="space-y-3">
      {err && <div className="text-xs text-red-600 bg-red-50 rounded-xl p-3">{err}</div>}
      <div className="bg-white rounded-2xl border border-slate-100 p-4">
        <div className="flex gap-2">
          <input value={name} onChange={e=>setName(e.target.value)} placeholder="اسم التصنيف الجديد"
            className="flex-1 border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--brand)]"/>
          <button onClick={add} className="bg-[var(--brand)] text-white px-5 rounded-xl font-black text-sm flex items-center gap-1"><Plus size={14}/>إضافة</button>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {cats.map(c=>(
          <div key={c.id} className="bg-white border-2 border-slate-200 rounded-2xl pl-3 pr-2 py-2 flex items-center gap-2 shadow-sm hover:border-[var(--brand)]/30 transition">
            <Tag size={13} className="text-[var(--brand)]"/>
            <span className="text-sm font-bold">{c.name}</span>
            <button onClick={()=>remove(c.id)} className="w-5 h-5 rounded-full bg-red-50 text-red-400 flex items-center justify-center hover:bg-red-100 transition"><X size={11}/></button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── SHIPPING TAB ────────────────────────────────────────────────── */
function ShippingTab({ zones, onChanged }) {
  const [f,setF]=useState({city:"",cost:0,notes:""}); const [editing,setEditing]=useState(null); const [err,setErr]=useState("");
  const add=async()=>{if(!f.city.trim())return;try{await api.createShippingZone(f);setF({city:"",cost:0,notes:""});onChanged();}catch(e){setErr(e.message);}};
  const save=async()=>{try{await api.updateShippingZone(editing.id,editing);setEditing(null);onChanged();}catch(e){setErr(e.message);}};
  const remove=async id=>{await api.deleteShippingZone(id);onChanged();};
  return (
    <div className="space-y-3">
      {err && <div className="text-xs text-red-600 bg-red-50 rounded-xl p-3">{err}</div>}
      <div className="bg-white rounded-2xl border border-slate-100 p-4">
        <p className="text-sm font-black text-slate-700 mb-3 flex items-center gap-1.5"><Plus size={14}/>إضافة منطقة شحن</p>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div><label className="text-xs font-bold text-slate-400 mb-1 block">المدينة</label>
            <input value={f.city} onChange={e=>setF(x=>({...x,city:e.target.value}))} placeholder="مثال: إب"
              className="w-full border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]"/></div>
          <div><label className="text-xs font-bold text-slate-400 mb-1 block">الرسوم (0 = مجاني)</label>
            <input type="number" min="0" value={f.cost} onChange={e=>setF(x=>({...x,cost:Number(e.target.value)||0}))}
              className="w-full border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]"/></div>
        </div>
        <input value={f.notes} onChange={e=>setF(x=>({...x,notes:e.target.value}))} placeholder="ملاحظة اختيارية"
          className="w-full border-2 border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)] mb-3"/>
        <button onClick={add} className="bg-[var(--brand)] text-white text-sm px-6 py-2.5 rounded-xl font-black">إضافة</button>
      </div>
      <div className="space-y-2">
        {zones.map(z=>(
          <div key={z.id} className="bg-white rounded-2xl border border-slate-100 p-4">
            {editing?.id===z.id?(
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <input value={editing.city} onChange={e=>setEditing(x=>({...x,city:e.target.value}))} className="border-2 border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"/>
                  <input type="number" min="0" value={editing.cost} onChange={e=>setEditing(x=>({...x,cost:Number(e.target.value)||0}))} className="border-2 border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"/>
                </div>
                <input value={editing.notes} onChange={e=>setEditing(x=>({...x,notes:e.target.value}))} className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[var(--brand)]"/>
                <div className="flex gap-2"><button onClick={save} className="bg-emerald-500 text-white text-xs px-4 py-1.5 rounded-lg font-black">حفظ</button><button onClick={()=>setEditing(null)} className="border border-slate-200 text-xs px-4 py-1.5 rounded-lg">إلغاء</button></div>
              </div>
            ):(
              <div className="flex items-center justify-between">
                <div><p className="font-bold text-slate-700 flex items-center gap-1.5"><MapPin size={13} className="text-[var(--brand)]"/>{z.city}</p>
                  <p className="text-sm font-black text-[var(--brand)] mt-0.5">{z.cost===0?"مجاني ":fmt(z.cost)}</p>
                  {z.notes&&<p className="text-xs text-slate-400 mt-0.5">{z.notes}</p>}</div>
                <div className="flex gap-2">
                  <button onClick={()=>setEditing({...z})} className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-[var(--brand)] hover:bg-[var(--brand-light)] transition"><Edit3 size={13}/></button>
                  <button onClick={()=>remove(z.id)} className="w-8 h-8 rounded-lg border border-red-100 flex items-center justify-center text-red-400 hover:bg-red-50 transition"><Trash2 size={13}/></button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── SETTINGS TAB ────────────────────────────────────────────────── */
function SettingsTab({ settings, onChanged }) {
  const [f,setF]=useState(settings); const [busy,setBusy]=useState(false); const [msg,setMsg]=useState("");
  const logoRef=useRef();
  useEffect(()=>setF(settings),[settings]);
  const uploadLogo=async e=>{const file=e.target.files[0];if(!file)return;try{const r=await api.uploadImage(file);setF(x=>({...x,store_logo:r.url}));}catch{}};
  const save=async()=>{setBusy(true);setMsg("");try{await api.updateSettings(f);setMsg("✅ تم الحفظ");onChanged();}catch(e){setMsg("❌ "+e.message);}finally{setBusy(false);}};
  const COLORS=["#2563EB","#7C3AED","#059669","#DC2626","#D97706","#0891B2","#DB2777","#64748B"];
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-5 max-w-md space-y-5">
      {msg && <p className="text-xs bg-slate-50 rounded-xl p-3">{msg}</p>}
      <div>
        <label className="text-xs font-black text-slate-500 mb-2 block flex items-center gap-1"><Img size={12}/>شعار المتجر</label>
        <div className="flex items-center gap-3">
          {f.store_logo?<img src={api.fileUrl(f.store_logo)} className="w-16 h-16 rounded-2xl object-cover border-2 border-slate-200"/>:<div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center"><Img size={22} className="text-slate-300"/></div>}
          <button onClick={()=>logoRef.current.click()} className="text-xs border-2 border-slate-200 rounded-xl px-4 py-2.5 font-semibold flex items-center gap-1.5 hover:border-[var(--brand)] transition"><Upload size={13}/>رفع شعار</button>
          <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={uploadLogo}/>
        </div>
      </div>
      {[["اسم المتجر","store_name"],["رقم واتساب (بدون +)","whatsapp"]].map(([lbl,k])=>(
        <div key={k}>
          <label className="text-xs font-black text-slate-500 mb-1.5 block">{lbl}</label>
          <input value={f[k]||""} onChange={e=>setF(x=>({...x,[k]:e.target.value}))} className="w-full border-2 border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[var(--brand)] transition"/>
        </div>
      ))}
      <div>
        <label className="text-xs font-black text-slate-500 mb-2 block flex items-center gap-1"><Palette size={12}/>اللون الرئيسي</label>
        <div className="flex items-center gap-2 flex-wrap">
          {COLORS.map(c=>(
            <button key={c} onClick={()=>setF(x=>({...x,primary_color:c}))} className="w-9 h-9 rounded-xl border-3 transition hover:scale-110"
              style={{background:c,outline:f.primary_color===c?`3px solid ${c}`:"none",outlineOffset:2}}/>
          ))}
          <input type="color" value={f.primary_color||"#2563EB"} onChange={e=>setF(x=>({...x,primary_color:e.target.value}))} className="w-9 h-9 rounded-xl cursor-pointer border-2 border-slate-200 p-0.5"/>
        </div>
      </div>
      <button onClick={save} disabled={busy} className="w-full bg-[var(--brand)] text-white py-3.5 rounded-2xl font-black text-sm hover:shadow-lg transition">
        {busy?"جاري الحفظ...":"حفظ الإعدادات"}
      </button>
    </div>
  );
}
