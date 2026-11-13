/**
 * شُرَاك | SHURAK - المنطق الرئيسي
 */

const CATEGORIES = [
  { id: "إلكترونيات", name: "إلكترونيات" },
  { id: "أزياء", name: "أزياء" },
  { id: "كتب", name: "كتب" },
  { id: "ألعاب", name: "ألعاب" },
  { id: "أخرى", name: "أخرى" }
];

let cart = JSON.parse(localStorage.getItem("shurak_cart") || "[]");
let currentUser = JSON.parse(localStorage.getItem("shurak_user") || "null");
let products = JSON.parse(localStorage.getItem("shurak_products") || "[]");
let appliedCoupon = null;

document.addEventListener("DOMContentLoaded", () => {
  updateCartBadge();
  updateAuthUI();
  bindGlobal();

  const page = document.body.dataset.page || getPage();
  recordSiteVisit(page);

  if (page === "home") {
    applyPublicSiteSettings();
    renderCategories("categoriesGrid");
    loadProducts().then(list => renderProducts("productsGrid", list.slice(0, 8)));
  }
  if (page === "products") {
    renderCategories("categoriesGrid");
    setupFilters();
    loadProducts().then(list => renderProducts("productsGrid", list));
    setupSearch();
  }
  if (page === "cart") renderCartPage();
  if (page === "checkout") renderCheckoutPage();
  if (page === "account") renderAccountPage();
  if (page === "seller") {
    loadProducts().finally(() => renderSellerPage());
    renderSellerPage();
  }
  if (page === "orders") renderOrdersPage();
});

// تسجيل زيارة مجهولة الهوية لأغراض الإحصاءات فقط.
function recordSiteVisit(page) {
  try {
    if (!window.SHURAK?.db) return;
    let visitorId = localStorage.getItem('shurak_visitor_id');
    if (!visitorId) {
      visitorId = (window.crypto?.randomUUID ? crypto.randomUUID() : 'v-' + Date.now() + '-' + Math.random().toString(36).slice(2));
      localStorage.setItem('shurak_visitor_id', visitorId);
    }
    window.SHURAK.db.collection('site_visits').add({
      visitorId, page: String(page || 'unknown').slice(0,40), createdAt: new Date().toISOString()
    }).catch(err => console.warn('تعذر تسجيل الزيارة:', err.message));
  } catch (e) { console.warn('تعذر تسجيل الزيارة:', e); }
}

async function applyPublicSiteSettings() {
  if (!window.SHURAK?.db) return;
  try {
    const snap = await window.SHURAK.db.collection('site_settings').doc('public').get();
    if (!snap.exists) return;
    const cfg = snap.data();
    const title = document.querySelector('.hero-content h1');
    const desc = document.querySelector('.hero-content p');
    const button = document.querySelector('.hero-btns .btn-primary');
    const banner = document.querySelector('.hero-image');
    if (title && cfg.heroTitle) title.textContent = cfg.heroTitle;
    if (desc && cfg.heroText) desc.textContent = cfg.heroText;
    if (button && cfg.buttonText) button.textContent = cfg.buttonText;
    if (banner && cfg.bannerUrl) banner.src = cfg.bannerUrl;
    if (cfg.announcement) {
      let strip = document.getElementById('siteAnnouncementBar');
      if (!strip) { strip=document.createElement('div'); strip.id='siteAnnouncementBar'; strip.className='site-announcement-bar'; document.querySelector('.header')?.after(strip); }
      strip.textContent = cfg.announcement;
    }
  } catch (e) { console.warn('تعذر تحميل إعدادات الموقع:', e.message); }
}

function getPage() {
  const p = location.pathname;
  if (p.includes("products")) return "products";
  if (p.includes("cart")) return "cart";
  if (p.includes("checkout")) return "checkout";
  if (p.includes("account")) return "account";
  if (p.includes("seller")) return "seller";
  if (p.includes("orders")) return "orders";
  if (p.includes("admin")) return "admin";
  if (p.includes("terms")) return "terms";
  return "home";
}

/* ===== Auth & Profile Menu ===== */
function updateAuthUI() {
  const loginArea = document.getElementById("profileMenuGuest");
  const userArea = document.getElementById("profileMenuUser");
  const avatarImg = document.getElementById("profileAvatar");
  const avatarIcon = document.getElementById("profileIcon");
  const adminLink = document.getElementById("adminLink");

  if (currentUser) {
    if (loginArea) loginArea.classList.add("hidden");
    if (userArea) userArea.classList.remove("hidden");
    if (avatarImg && currentUser.photoURL) {
      avatarImg.src = currentUser.photoURL;
      avatarImg.classList.remove("hidden");
      if (avatarIcon) avatarIcon.classList.add("hidden");
    }
    if (adminLink) {
      currentUser.role === "admin" ? adminLink.classList.remove("hidden") : adminLink.classList.add("hidden");
    }
  } else {
    if (loginArea) loginArea.classList.remove("hidden");
    if (userArea) userArea.classList.add("hidden");
    if (avatarImg) avatarImg.classList.add("hidden");
    if (avatarIcon) avatarIcon.classList.remove("hidden");
    if (adminLink) adminLink.classList.add("hidden");
  }
}

function toggleProfileMenu(e) {
  e.stopPropagation();
  document.getElementById("profileMenu")?.classList.toggle("open");
}

document.addEventListener("click", () => {
  document.getElementById("profileMenu")?.classList.remove("open");
  document.getElementById("logoMenu")?.classList.remove("open");
});

async function loginWithGoogle() {
  document.getElementById("profileMenu")?.classList.remove("open");
  if (window.SHURAK?.isFirebaseConfigured && window.SHURAK.auth) {
    try {
      const result = await window.SHURAK.auth.signInWithPopup(window.SHURAK.googleProvider);
      const u = result.user;
      currentUser = {
        uid: u.uid,
        name: u.displayName,
        email: u.email,
        photoURL: u.photoURL,
        phone: "", city: "", address: "",
        role: "user",
        createdAt: new Date().toISOString()
      };
      // merge existing data from firestore if any
      if (window.SHURAK.db) {
        const doc = await window.SHURAK.db.collection("customers").doc(u.uid).get();
        if (doc.exists) {
          const d = doc.data();
          currentUser.phone = d.phone || "";
          currentUser.city = d.city || "";
          currentUser.address = d.address || "";
          currentUser.role = d.role || "user";
        }
        await window.SHURAK.db.collection("customers").doc(u.uid).set(currentUser, { merge: true });
      }
      localStorage.setItem("shurak_user", JSON.stringify(currentUser));
      updateAuthUI();
      showToast("تم تسجيل الدخول بنجاح");
      // طلب تفعيل الإشعارات
      requestNotificationPermission();
    } catch (err) {
      console.error(err);
      showToast("خطأ في تسجيل الدخول: " + err.message);
    }
  } else {
    showToast("Firebase غير مُعد. تأكد من تفعيل Google Sign-in");
  }
}

function logout() {
  if (window.SHURAK?.auth) window.SHURAK.auth.signOut().catch(() => {});
  currentUser = null;
  localStorage.removeItem("shurak_user");
  updateAuthUI();
  showToast("تم تسجيل الخروج");
  if (["account", "seller", "checkout", "orders", "admin"].some(p => location.pathname.includes(p))) {
    location.href = "index.html";
  }
}

if (window.SHURAK?.auth) {
  window.SHURAK.auth.onAuthStateChanged(async (user) => {
    if (user && (!currentUser || currentUser.uid !== user.uid)) {
      currentUser = {
        uid: user.uid, name: user.displayName, email: user.email,
        photoURL: user.photoURL, phone: "", city: "", address: "", role: "user"
      };
      if (window.SHURAK.db) {
        try {
          const doc = await window.SHURAK.db.collection("customers").doc(user.uid).get();
          if (doc.exists) Object.assign(currentUser, doc.data());
        } catch (_) {}
      }
      localStorage.setItem("shurak_user", JSON.stringify(currentUser));
      updateAuthUI();
    }
  });
}

/* ===== Products ===== */
async function loadProducts() {
  if (window.SHURAK?.db) {
    try {
      const snap = await window.SHURAK.db.collection("products").where("status", "==", "available").get();
      if (!snap.empty) {
        products = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        localStorage.setItem("shurak_products", JSON.stringify(products));
      }
    } catch (e) {
      console.warn("Firestore products:", e.message);
    }
  }
  products = JSON.parse(localStorage.getItem("shurak_products") || "[]");
  return products;
}

function renderCategories(id) {
  const grid = document.getElementById(id);
  if (!grid) return;
  grid.innerHTML = CATEGORIES.map(c => `
    <div class="category-card" data-category="${c.id}"><h3>${c.name}</h3></div>
  `).join("");
  grid.querySelectorAll(".category-card").forEach(card => {
    card.addEventListener("click", () => {
      const cat = card.dataset.category;
      if (location.pathname.includes("products")) {
        document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
        document.querySelector(`.filter-btn[data-category="${cat}"]`)?.classList.add("active");
        filterProducts(cat);
      } else {
        location.href = `products.html?cat=${encodeURIComponent(cat)}`;
      }
    });
  });
}

function renderProducts(containerId, list) {
  const grid = document.getElementById(containerId);
  if (!grid) return;
  if (!list?.length) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><h3>لا توجد منتجات حالياً</h3><p>كن أول من يضيف منتجاً</p><a href="seller.html" class="btn btn-primary" style="margin-top:12px">أضف منتجك</a></div>`;
    return;
  }
  grid.innerHTML = list.map((p, i) => {
    const img = p.imageUrl
      ? `<img src="${p.imageUrl}" alt="${p.name}" loading="lazy" />`
      : `<div style="color:#94A3B8;font-size:0.85rem">لا توجد صورة</div>`;
    return `
    <article class="product-card" style="animation-delay:${i * 0.04}s">
      <div class="product-image">${img}</div>
      <div class="product-body">
        <h3 class="product-name">${p.name}</h3>
        <p class="product-desc">${p.description || ""}</p>
        <div class="product-seller">${p.sellerName || "بائع"}</div>
        <div class="product-footer">
          <div class="product-price">${p.price} <span>ريال</span></div>
          <button class="btn-add" data-id="${p.id}">أضف للسلة</button>
        </div>
      </div>
    </article>`;
  }).join("");
  grid.querySelectorAll(".btn-add").forEach(btn => {
    btn.addEventListener("click", () => addToCart(btn.dataset.id));
  });
}

function setupFilters() {
  const cat = new URLSearchParams(location.search).get("cat");
  if (cat) {
    document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
    document.querySelector(`.filter-btn[data-category="${cat}"]`)?.classList.add("active");
    filterProducts(cat);
  }
  document.querySelectorAll(".filter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      filterProducts(btn.dataset.category);
    });
  });
}

function filterProducts(category) {
  let list = products;
  if (category && category !== "all") list = list.filter(p => p.category === category);
  const q = document.getElementById("searchInput")?.value?.trim().toLowerCase() || "";
  if (q) list = list.filter(p => p.name?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q));
  renderProducts("productsGrid", list);
}

function setupSearch() {
  const input = document.getElementById("searchInput");
  if (!input) return;
  const go = () => {
    const active = document.querySelector(".filter-btn.active");
    filterProducts(active?.dataset.category || "all");
  };
  input.addEventListener("input", go);
  document.getElementById("searchBtn")?.addEventListener("click", go);
}

/* ===== Cart ===== */
function addToCart(id) {
  const p = products.find(x => x.id === id);
  if (!p) return;
  const ex = cart.find(x => x.id === id);
  if (ex) ex.qty += 1;
  else cart.push({ ...p, qty: 1 });
  saveCart();
  updateCartBadge();
  showToast("تمت الإضافة إلى السلة");
}

function saveCart() { localStorage.setItem("shurak_cart", JSON.stringify(cart)); }
function updateCartBadge() {
  const el = document.getElementById("cartCount");
  if (el) el.textContent = cart.reduce((s, i) => s + i.qty, 0);
}
function getCartTotal() { return cart.reduce((s, i) => s + i.price * i.qty, 0); }

function renderCartPage() {
  const listEl = document.getElementById("cartItemsList");
  const emptyEl = document.getElementById("emptyCart");
  const contentEl = document.getElementById("cartContent");
  if (!listEl) return;

  if (!cart.length) {
    emptyEl?.classList.remove("hidden");
    contentEl?.classList.add("hidden");
    return;
  }
  emptyEl?.classList.add("hidden");
  contentEl?.classList.remove("hidden");

  listEl.innerHTML = cart.map(item => `
    <div class="cart-item-row">
      ${item.imageUrl ? `<img src="${item.imageUrl}" class="cart-item-img" />` : `<div class="cart-item-img"></div>`}
      <div class="cart-item-details">
        <h4>${item.name}</h4>
        <div class="price">${item.price} ريال</div>
        <div class="qty-controls">
          <button class="qty-btn" data-id="${item.id}" data-a="dec">−</button>
          <span>${item.qty}</span>
          <button class="qty-btn" data-id="${item.id}" data-a="inc">+</button>
          <button class="btn btn-ghost" style="color:#EF4444;font-size:0.82rem" data-id="${item.id}" data-a="rm">حذف</button>
        </div>
      </div>
    </div>
  `).join("");

  document.getElementById("cartTotal").textContent = getCartTotal() + " ريال";
  document.getElementById("cartTotal2") && (document.getElementById("cartTotal2").textContent = getCartTotal() + " ريال");

  listEl.querySelectorAll("[data-a]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id, a = btn.dataset.a;
      if (a === "rm") cart = cart.filter(i => i.id !== id);
      else {
        const it = cart.find(i => i.id === id);
        if (!it) return;
        it.qty += a === "inc" ? 1 : -1;
        if (it.qty <= 0) cart = cart.filter(i => i.id !== id);
      }
      saveCart(); updateCartBadge(); renderCartPage();
    });
  });
}

/* ===== Checkout ===== */
function goCheckout() {
  if (!cart.length) return showToast("السلة فارغة");
  if (!currentUser) {
    showToast("سجل دخولك أولاً لإتمام الطلب");
    document.getElementById("profileMenu")?.classList.add("open");
    return;
  }
  location.href = "checkout.html";
}

function renderCheckoutPage() {
  if (!currentUser) {
    document.getElementById("checkoutGuest")?.classList.remove("hidden");
    document.getElementById("checkoutFormEl")?.classList.add("hidden");
    return;
  }
  if (!cart.length) {
    location.href = "cart.html";
    return;
  }
  document.getElementById("checkoutGuest")?.classList.add("hidden");
  document.getElementById("checkoutFormEl")?.classList.remove("hidden");

  // prefill
  document.getElementById("shipName").value = currentUser.name || "";
  document.getElementById("shipPhone").value = currentUser.phone || "";
  document.getElementById("shipCity").value = currentUser.city || "";
  document.getElementById("shipAddress").value = currentUser.address || "";

  // summary
  const box = document.getElementById("checkoutItems");
  if (box) {
    box.innerHTML = cart.map(i => `
      <div class="summary-row"><span>${i.name} × ${i.qty}</span><span>${i.price * i.qty} ر.س</span></div>
    `).join("");
  }
  document.getElementById("checkoutTotal").textContent = getCartTotal() + " ريال";
  document.getElementById("checkoutDiscount").textContent = "0 ريال";
  const couponBtn=document.getElementById("applyCouponBtn");
  if(couponBtn) couponBtn.onclick=applyCheckoutCoupon;
}

async function applyCheckoutCoupon() {
  const code=(document.getElementById('checkoutCoupon')?.value||'').trim().toUpperCase();
  const feedback=document.getElementById('couponFeedback');
  if(!code || !window.SHURAK?.db){ if(feedback) feedback.textContent='أدخل رمزاً صحيحاً وتأكد من اتصال المتجر.'; return; }
  try {
    const snap=await window.SHURAK.db.collection('coupons').doc(code).get();
    if(!snap.exists){appliedCoupon=null;feedback.textContent='الكوبون غير موجود.';return;}
    const c=snap.data(), now=new Date();
    if(!c.active || (c.expiresAt && new Date(c.expiresAt+'T23:59:59')<now) || (c.usageLimit && (c.usedCount||0)>=c.usageLimit)) {appliedCoupon=null;feedback.textContent='الكوبون منتهي أو غير متاح.';return;}
    const subtotal=getCartTotal();
    let discount=c.type==='percent'?subtotal*Math.min(Number(c.value)||0,100)/100:c.type==='fixed'?Math.min(subtotal,Number(c.value)||0):0;
    appliedCoupon={code:c.code||code,type:c.type,discount:Math.round(discount*100)/100};
    document.getElementById('checkoutDiscount').textContent=appliedCoupon.discount+' ريال';
    document.getElementById('checkoutTotal').textContent=Math.max(0,subtotal-appliedCoupon.discount)+' ريال';
    feedback.textContent=c.type==='shipping'?'تم تطبيق الشحن المجاني (تُحسب رسوم الشحن عند تفعيل نظام الشحن).':'تم تطبيق الكوبون بنجاح.';
  } catch(err){feedback.textContent='تعذر التحقق من الكوبون حالياً.';}
}

async function submitOrder(e) {
  e.preventDefault();
  if (!currentUser || !cart.length) return;

  const name = document.getElementById("shipName").value.trim();
  const phone = document.getElementById("shipPhone").value.trim();
  const city = document.getElementById("shipCity").value.trim();
  const address = document.getElementById("shipAddress").value.trim();
  const payment = document.querySelector('input[name="payment"]:checked')?.value || "cod";

  if (!name || !phone || !city || !address) {
    showToast("أكمل بيانات التوصيل");
    return;
  }

  const labels = { cod: "الدفع عند الاستلام", transfer: "تحويل بنكي", applepay: "Apple Pay" };

  const order = {
    id: "ORD-" + Date.now(),
    userId: currentUser.uid,
    userName: name,
    phone, city, address,
    items: cart.map(i => ({ id: i.id, name: i.name, price: i.price, qty: i.qty, imageUrl: i.imageUrl || "" })),
    subtotal: getCartTotal(),
    discount: appliedCoupon?.discount || 0,
    couponCode: appliedCoupon?.code || null,
    total: Math.max(0, getCartTotal() - (appliedCoupon?.discount || 0)),
    paymentMethod: payment,
    paymentLabel: labels[payment],
    status: "جديد",
    createdAt: new Date().toISOString()
  };

  // save profile address
  currentUser.phone = phone;
  currentUser.city = city;
  currentUser.address = address;
  localStorage.setItem("shurak_user", JSON.stringify(currentUser));

  const orders = JSON.parse(localStorage.getItem("shurak_orders") || "[]");
  orders.push(order);
  localStorage.setItem("shurak_orders", JSON.stringify(orders));

  if (window.SHURAK?.db) {
    try {
      await window.SHURAK.db.collection("orders").doc(order.id).set(order);
      await window.SHURAK.db.collection("customers").doc(currentUser.uid).set(
        { phone, city, address }, { merge: true }
      );
    } catch (err) { console.error(err); }
  }

  if (appliedCoupon && window.SHURAK?.db) {
    // تحديث عداد الاستخدام للواجهة؛ يجب نقله إلى معاملة خادمية قبل الإطلاق التجاري.
    try { await window.SHURAK.db.collection('coupons').doc(appliedCoupon.code).update({usedCount: firebase.firestore.FieldValue.increment(1)}); } catch(e) { console.warn('تعذر تحديث عداد الكوبون',e); }
  }
  appliedCoupon = null;
  cart = [];
  saveCart();
  updateCartBadge();

  // redirect to success view inside account/orders
  sessionStorage.setItem("lastOrderId", order.id);
  location.href = "orders.html?success=1";
}

/* ===== Account & Orders ===== */
function renderAccountPage() {
  if (!currentUser) {
    document.getElementById("accountGuest")?.classList.remove("hidden");
    document.getElementById("accountContent")?.classList.add("hidden");
    return;
  }
  document.getElementById("accountGuest")?.classList.add("hidden");
  document.getElementById("accountContent")?.classList.remove("hidden");

  const av = document.getElementById("accountAvatar");
  if (av) av.src = currentUser.photoURL || "";
  document.getElementById("accountName").textContent = currentUser.name || "—";
  document.getElementById("accountEmail").textContent = currentUser.email || "—";
  document.getElementById("userPhone").value = currentUser.phone || "";
  document.getElementById("userCity").value = currentUser.city || "";
  document.getElementById("userAddress").value = currentUser.address || "";
}

function saveProfile() {
  if (!currentUser) return;
  currentUser.phone = document.getElementById("userPhone").value.trim();
  currentUser.city = document.getElementById("userCity").value.trim();
  currentUser.address = document.getElementById("userAddress").value.trim();
  localStorage.setItem("shurak_user", JSON.stringify(currentUser));
  if (window.SHURAK?.db) {
    window.SHURAK.db.collection("customers").doc(currentUser.uid)
      .set({ phone: currentUser.phone, city: currentUser.city, address: currentUser.address }, { merge: true });
  }
  showToast("تم حفظ البيانات");
}

function renderOrdersPage() {
  const success = new URLSearchParams(location.search).get("success");
  const lastId = sessionStorage.getItem("lastOrderId");
  if (success && lastId) {
    const box = document.getElementById("orderSuccess");
    if (box) {
      box.classList.remove("hidden");
      document.getElementById("successOrderId").textContent = lastId;
    }
    sessionStorage.removeItem("lastOrderId");
  }

  if (!currentUser) {
    document.getElementById("ordersGuest")?.classList.remove("hidden");
    document.getElementById("ordersList")?.classList.add("hidden");
    return;
  }
  document.getElementById("ordersGuest")?.classList.add("hidden");
  document.getElementById("ordersList")?.classList.remove("hidden");

  let orders = JSON.parse(localStorage.getItem("shurak_orders") || "[]")
    .filter(o => o.userId === currentUser.uid)
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));

  const el = document.getElementById("ordersList");
  if (!orders.length) {
    el.innerHTML = `<div class="empty-state"><h3>لا توجد طلبات بعد</h3><a href="products.html" class="btn btn-primary" style="margin-top:12px">تصفح المنتجات</a></div>`;
    return;
  }
  el.innerHTML = orders.map(o => `
    <div class="form-card" style="margin-bottom:16px;max-width:none">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:10px">
        <strong>${o.id}</strong>
        <span style="color:var(--blue);font-weight:700">${o.status}</span>
      </div>
      <div style="font-size:0.88rem;color:var(--muted);margin-bottom:8px">
        ${o.paymentLabel} · ${new Date(o.createdAt).toLocaleDateString("ar-SA")}
      </div>
      <div style="font-size:0.88rem;margin-bottom:8px">${o.city} — ${o.address}</div>
      ${o.items.map(i => `<div class="summary-row"><span>${i.name} × ${i.qty}</span><span>${i.price * i.qty} ر.س</span></div>`).join("")}
      <div class="summary-total summary-row"><span>الإجمالي</span><span>${o.total} ريال</span></div>
    </div>
  `).join("");
}

/* ===== Seller ===== */
function renderSellerPage() {
  if (!currentUser) {
    document.getElementById("sellerGuest")?.classList.remove("hidden");
    document.getElementById("sellerContent")?.classList.add("hidden");
    return;
  }
  document.getElementById("sellerGuest")?.classList.add("hidden");
  document.getElementById("sellerContent")?.classList.remove("hidden");

  const mine = products.filter(p => p.sellerId === currentUser.uid);
  const list = document.getElementById("myProductsList");
  if (!list) return;
  if (!mine.length) {
    list.innerHTML = `<p style="color:var(--muted);text-align:center;padding:20px">لم تضف منتجات بعد</p>`;
    return;
  }
  list.innerHTML = mine.map(p => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:12px;background:var(--bg);border-radius:10px;margin-bottom:8px">
      <div style="display:flex;gap:10px;align-items:center">
        ${p.imageUrl ? `<img src="${p.imageUrl}" style="width:48px;height:48px;border-radius:8px;object-fit:cover" />` : ""}
        <div><strong>${p.name}</strong><br><span style="color:var(--blue)">${p.price} ريال</span></div>
      </div>
      <button class="btn btn-ghost" style="color:#EF4444" onclick="deleteMyProduct('${p.id}')">حذف</button>
    </div>
  `).join("");
}


async function addProduct(e) {
  e.preventDefault();
  if (!currentUser) return showToast("سجل دخولك أولاً");
  if (!document.getElementById("acceptTerms")?.checked) {
    return showToast("يجب الموافقة على الشروط والأحكام");
  }
  const name = document.getElementById("prodName").value.trim();
  const description = document.getElementById("prodDesc").value.trim();
  const price = parseFloat(document.getElementById("prodPrice").value);
  const category = document.getElementById("prodCategory").value;
  const imageFile = document.getElementById("prodImage")?.files[0];

  if (!name || !description || !price || price <= 0) return showToast("أكمل الحقول بشكل صحيح");
  if (!imageFile) return showToast("أضف صورة للمنتج");
  if (!imageFile.type.startsWith("image/")) return showToast("الملف يجب أن يكون صورة");

  const btn = e.target.querySelector('[type="submit"]');
  if (btn) { btn.disabled = true; btn.textContent = "جاري ضغط الصورة..."; }

  try {
    // ضغط الصورة لتقليل الحجم
    const compressed = await compressImage(imageFile, 1200, 0.75);
    if (btn) btn.textContent = "جاري الرفع...";

    let imageUrl = "";
    if (window.SHURAK?.storage) {
      const path = `products/${currentUser.uid}/${Date.now()}.jpg`;
      const ref = window.SHURAK.storage.ref().child(path);
      const snap = await ref.put(compressed, { contentType: "image/jpeg" });
      imageUrl = await snap.ref.getDownloadURL();
    } else {
      throw new Error("خدمة تخزين الصور غير مفعلة في Firebase");
    }

    const newProduct = {
      id: "p_" + Date.now(), name, description, price, category, imageUrl,
      sellerId: currentUser.uid, sellerName: currentUser.name || "بائع",
      status: "available", createdAt: new Date().toISOString().slice(0, 10)
    };

    // لا نعرض نجاح النشر إلا بعد حفظ المنتج فعلياً في قاعدة البيانات.
    if (!window.SHURAK?.db) throw new Error("قاعدة البيانات غير متصلة؛ لم يتم نشر المنتج");
    await window.SHURAK.db.collection("products").doc(newProduct.id).set(newProduct);

    products = [newProduct, ...products.filter(p => p.id !== newProduct.id)];
    localStorage.setItem("shurak_products", JSON.stringify(products));

    document.getElementById("addProductForm").reset();
    const prev = document.getElementById("imagePreview");
    if (prev) prev.innerHTML = "";
    showToast("تم نشر المنتج بنجاح");
    renderSellerPage();
  } catch (err) {
    console.error(err);
    showToast("خطأ في الرفع: " + (err.message || "حاول مرة أخرى"));
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "نشر المنتج"; }
  }
}

function compressImage(file, maxWidth, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let w = img.width, h = img.height;
      if (w > maxWidth) { h = h * (maxWidth / w); w = maxWidth; }
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(blob => {
        URL.revokeObjectURL(url);
        if (blob) resolve(blob);
        else reject(new Error("فشل ضغط الصورة"));
      }, "image/jpeg", quality);
    };
    img.onerror = () => reject(new Error("فشل قراءة الصورة"));
    img.src = url;
  });
}

function blobToDataURL(blob) {
  return new Promise(res => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.readAsDataURL(blob);
  });
}


function deleteMyProduct(id) {
  if (!confirm("حذف المنتج؟")) return;
  products = products.filter(p => p.id !== id);
  localStorage.setItem("shurak_products", JSON.stringify(products));
  if (window.SHURAK?.db) window.SHURAK.db.collection("products").doc(id).delete().catch(() => {});
  renderSellerPage();
  showToast("تم الحذف");
}

/* ===== Helpers ===== */
function showToast(msg) {
  let t = document.getElementById("toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    t.className = "toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 2800);
}


async function requestNotificationPermission() {
  if (!("Notification" in window)) return;
  try {
    const perm = await Notification.requestPermission();
    const enabled = perm === "granted";
    if (currentUser) {
      currentUser.notificationsEnabled = enabled;
      localStorage.setItem("shurak_user", JSON.stringify(currentUser));
      if (window.SHURAK?.db) {
        await window.SHURAK.db.collection("customers").doc(currentUser.uid)
          .set({ notificationsEnabled: enabled }, { merge: true });
      }
    }
    if (enabled) showToast("تم تفعيل الإشعارات");
  } catch (e) {
    console.warn("Notification permission:", e);
  }
}


/* ===== Email/Password Auth ===== */
async function loginWithEmail(email, password) {
  if (!window.SHURAK?.auth) throw new Error("Firebase غير جاهز");
  const result = await window.SHURAK.auth.signInWithEmailAndPassword(email, password);
  const u = result.user;
  let profile = {
    uid: u.uid, name: u.displayName || email.split("@")[0], email: u.email,
    photoURL: u.photoURL || "", phone: "", city: "", address: "", role: "user"
  };
  if (window.SHURAK.db) {
    const doc = await window.SHURAK.db.collection("customers").doc(u.uid).get();
    if (doc.exists) profile = { ...profile, ...doc.data() };
  }
  currentUser = profile;
  localStorage.setItem("shurak_user", JSON.stringify(currentUser));
  updateAuthUI();
  showToast("تم تسجيل الدخول بنجاح");
  setTimeout(() => location.href = "index.html", 600);
}

async function registerWithEmail(data) {
  if (!window.SHURAK?.auth) throw new Error("Firebase غير جاهز — فعّل Email/Password في Authentication");
  const result = await window.SHURAK.auth.createUserWithEmailAndPassword(data.email, data.password);
  const u = result.user;
  const fullName = data.firstName + " " + data.lastName;
  try { await u.updateProfile({ displayName: fullName }); } catch (_) {}

  const profile = {
    uid: u.uid,
    name: fullName,
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email,
    photoURL: "",
    age: data.age,
    gender: data.gender,
    phone: data.phone,
    city: data.city,
    district: data.district,
    street: data.street,
    address: data.district + "، " + data.street,
    role: "user",
    notificationsEnabled: false,
    createdAt: new Date().toISOString()
  };

  if (window.SHURAK.db) {
    await window.SHURAK.db.collection("customers").doc(u.uid).set(profile);
  }
  currentUser = profile;
  localStorage.setItem("shurak_user", JSON.stringify(currentUser));
  updateAuthUI();
  showToast("تم إنشاء الحساب بنجاح");
  setTimeout(() => location.href = "index.html", 800);
}

function toggleLogoMenu(e) {
  e.stopPropagation();
  document.getElementById("logoMenu")?.classList.toggle("open");
  document.getElementById("profileMenu")?.classList.remove("open");
}


function bindGlobal() {
  document.getElementById("profileBtn")?.addEventListener("click", toggleProfileMenu);
  document.getElementById("logoBtn")?.addEventListener("click", toggleLogoMenu);
  document.getElementById("loginMenuBtn")?.addEventListener("click", loginWithGoogle);
  document.getElementById("logoutBtn")?.addEventListener("click", logout);
  document.getElementById("saveProfileBtn")?.addEventListener("click", saveProfile);
  document.getElementById("goCheckoutBtn")?.addEventListener("click", goCheckout);
  document.getElementById("checkoutFormEl")?.addEventListener("submit", submitOrder);
  document.getElementById("addProductForm")?.addEventListener("submit", addProduct);

  document.querySelectorAll(".payment-option").forEach(opt => {
    opt.addEventListener("click", () => {
      document.querySelectorAll(".payment-option").forEach(o => o.classList.remove("selected"));
      opt.classList.add("selected");
      opt.querySelector("input").checked = true;
    });
  });

  const imgInput = document.getElementById("prodImage");
  if (imgInput) {
    imgInput.addEventListener("change", () => {
      const f = imgInput.files[0];
      const prev = document.getElementById("imagePreview");
      if (f && prev) {
        prev.innerHTML = `<img src="${URL.createObjectURL(f)}" style="max-width:160px;border-radius:10px;margin-top:8px" />`;
      }
    });
  }
}
