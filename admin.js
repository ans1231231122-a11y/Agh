/**
 * شُرَاك - لوحة الإدارة
 */

document.addEventListener("DOMContentLoaded", () => {
  // انتظر قليلاً عشان app.js يحمل المستخدم
  setTimeout(initAdmin, 300);
});

async function initAdmin() {
  updateAuthUI();

  if (!currentUser) {
    document.getElementById("adminGuest").classList.remove("hidden");
    document.getElementById("adminDenied").classList.add("hidden");
    document.getElementById("adminPanel").classList.add("hidden");
    return;
  }

  // تحقق من صلاحية الأدمن
  let isAdmin = false; // لا نثق بدور محفوظ في المتصفح؛ الصلاحية تُقرأ من Firestore فقط.

  // جرب تجيب الدور من Firestore (أدق)
  if (window.SHURAK && window.SHURAK.db) {
    try {
      const doc = await window.SHURAK.db.collection("customers").doc(currentUser.uid).get();
      if (doc.exists && doc.data().role === "admin") {
        isAdmin = true;
        currentUser.role = "admin";
        localStorage.setItem("shurak_user", JSON.stringify(currentUser));
      }
    } catch (e) {
      console.warn("ما قدرنا نتحقق من الدور:", e);
    }
  }

  if (!isAdmin) {
    document.getElementById("adminDenied").classList.remove("hidden");
    document.getElementById("adminGuest").classList.add("hidden");
    document.getElementById("adminPanel").classList.add("hidden");
    return;
  }

  // أدمن → أظهر اللوحة
  document.getElementById("adminPanel").classList.remove("hidden");
  document.getElementById("adminGuest").classList.add("hidden");
  document.getElementById("adminDenied").classList.add("hidden");

  // التبويبات
  document.querySelectorAll(".admin-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".admin-tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".admin-section").forEach(s => s.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById("tab-" + tab.dataset.tab).classList.add("active");
    });
  });

  await loadAdminData();
}

async function loadAdminData() {
  let productsList = [];
  let usersList = [];
  let ordersList = [];

  if (window.SHURAK && window.SHURAK.db) {
    try {
      const [pSnap, uSnap, oSnap] = await Promise.all([
        window.SHURAK.db.collection("products").get(),
        window.SHURAK.db.collection("customers").get(),
        window.SHURAK.db.collection("orders").get()
      ]);
      productsList = pSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      usersList = uSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      ordersList = oSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) {
      console.warn("Firestore error, using local:", e.message);
      productsList = JSON.parse(localStorage.getItem("shurak_products") || "[]");
      ordersList = JSON.parse(localStorage.getItem("shurak_orders") || "[]");
    }
  } else {
    productsList = JSON.parse(localStorage.getItem("shurak_products") || "[]");
    ordersList = JSON.parse(localStorage.getItem("shurak_orders") || "[]");
  }

  // إحصائيات
  document.getElementById("statProducts").textContent = productsList.length;
  document.getElementById("statUsers").textContent = usersList.length || "—";
  document.getElementById("statOrders").textContent = ordersList.length;
  document.getElementById("statBanned").textContent = usersList.filter(u => u.banned).length;

  renderAdminProducts(productsList);
  renderAdminUsers(usersList);
  renderAdminOrders(ordersList);
}

function renderAdminProducts(list) {
  const tbody = document.getElementById("adminProductsBody");
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:#888">لا توجد منتجات</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(p => `
    <tr>
      <td>${p.imageUrl ? `<img src="${p.imageUrl}" class="product-thumb" />` : "—"}</td>
      <td>
        <strong>${p.name || "—"}</strong><br>
        <small style="color:#888">${(p.description || "").slice(0, 40)}</small>
      </td>
      <td>${p.price} ر.س</td>
      <td>${p.sellerName || "—"}</td>
      <td>
        <span class="badge ${p.status === "available" ? "badge-green" : "badge-gray"}">
          ${p.status === "available" ? "متاح" : (p.status || "—")}
        </span>
      </td>
      <td>
        <button class="action-btn btn-del" onclick="adminDeleteProduct('${p.id}')">حذف</button>
        <button class="action-btn btn-ban" onclick="adminHideProduct('${p.id}')">إخفاء</button>
      </td>
    </tr>
  `).join("");
}

function renderAdminUsers(list) {
  const tbody = document.getElementById("adminUsersBody");
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:30px;color:#888">لا يوجد عملاء بعد</td></tr>`;
    return;
  }
  tbody.innerHTML = list.map(u => {
    const uid = u.id || u.uid || "";
    const notif = u.notificationsEnabled ? "مفعّل" : "غير مفعّل";
    const notifClass = u.notificationsEnabled ? "badge-green" : "badge-gray";
    return `
    <tr>
      <td>
        <strong>${u.name || u.displayName || "—"}</strong><br>
        <small style="color:#888">${uid.slice(0, 12)}...</small>
      </td>
      <td>${u.email || "—"}</td>
      <td>${u.phone || "—"}</td>
      <td>${u.city || "—"}<br><small style="color:#888">${(u.address || "").slice(0, 30)}</small></td>
      <td><span class="badge ${notifClass}">${notif}</span></td>
      <td>
        <span class="badge ${u.banned ? "badge-red" : (u.role === "admin" ? "badge-blue" : "badge-green")}">
          ${u.banned ? "محظور" : (u.role === "admin" ? "أدمن" : "نشط")}
        </span>
      </td>
      <td>
        ${u.role === "admin" ? "—" : `
          ${u.banned 
            ? `<button class="action-btn btn-ok" onclick="adminUnbanUser('${uid}')">إلغاء الحظر</button>`
            : `<button class="action-btn btn-ban" onclick="adminBanUser('${uid}')">حظر</button>`
          }
          ${u.notificationsEnabled ? `<button class="action-btn btn-ok" onclick="adminSendNotif('${uid}', '${(u.name || "").replace(/'/g, "")}')">إشعار</button>` : ""}
        `}
      </td>
    </tr>`;
  }).join("");
}

function adminSendNotif(uid, name) {
  const msg = prompt("اكتب نص الإشعار لـ " + (name || "المستخدم") + ":");
  if (!msg) return;
  // حفظ الإشعار في Firestore ليظهر للمستخدم لاحقاً / أو يُرسل عبر FCM
  if (window.SHURAK && window.SHURAK.db) {
    window.SHURAK.db.collection("notifications").add({
      userId: uid,
      title: "إشعار من شُرَاك",
      body: msg,
      createdAt: new Date().toISOString(),
      read: false
    }).then(() => alert("تم إرسال الإشعار (يظهر للمستخدم عند فتح الموقع)"))
      .catch(e => alert("خطأ: " + e.message));
  } else {
    alert("تم تسجيل الإشعار محلياً: " + msg);
  }
}

function renderAdminOrders(list) {
  const tbody = document.getElementById("adminOrdersBody");
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:#888">لا توجد طلبات</td></tr>`;
    return;
  }
  // الأحدث أولاً
  list = [...list].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  tbody.innerHTML = list.map(o => `
    <tr>
      <td><strong>${o.id}</strong></td>
      <td>${o.userName || o.userId || "—"}</td>
      <td>${o.total} ر.س</td>
      <td>${o.paymentLabel || o.paymentMethod || "—"}</td>
      <td>
        <span class="badge ${
          o.status === "مكتمل" ? "badge-green" :
          o.status === "تم الرفض" ? "badge-red" :
          o.status === "قيد المراجعة" ? "badge-orange" : "badge-blue"
        }">${o.status || "جديد"}</span>
      </td>
      <td>
        <button class="action-btn btn-ok" onclick="adminUpdateOrder('${o.id}', 'تم القبول')">قبول</button>
        <button class="action-btn btn-ban" onclick="adminUpdateOrder('${o.id}', 'قيد المراجعة')">مراجعة</button>
        <button class="action-btn btn-del" onclick="adminUpdateOrder('${o.id}', 'تم الرفض')">رفض</button>
        <button class="action-btn btn-ok" onclick="adminUpdateOrder('${o.id}', 'مكتمل')">مكتمل</button>
      </td>
    </tr>
  `).join("");
}

// ========== إجراءات ==========
async function adminDeleteProduct(id) {
  if (!confirm("هل تريد حذف هذا المنتج نهائياً؟")) return;
  try {
    if (window.SHURAK && window.SHURAK.db) {
      await window.SHURAK.db.collection("products").doc(id).delete();
    }
    // محلي
    let products = JSON.parse(localStorage.getItem("shurak_products") || "[]");
    products = products.filter(p => p.id !== id);
    localStorage.setItem("shurak_products", JSON.stringify(products));
    alert("تم حذف المنتج");
    loadAdminData();
  } catch (e) {
    alert("خطأ: " + e.message);
  }
}

async function adminHideProduct(id) {
  try {
    if (window.SHURAK && window.SHURAK.db) {
      await window.SHURAK.db.collection("products").doc(id).update({ status: "hidden" });
    }
    let products = JSON.parse(localStorage.getItem("shurak_products") || "[]");
    products = products.map(p => p.id === id ? { ...p, status: "hidden" } : p);
    localStorage.setItem("shurak_products", JSON.stringify(products));
    alert("تم إخفاء المنتج");
    loadAdminData();
  } catch (e) {
    alert("خطأ: " + e.message);
  }
}

async function adminBanUser(uid) {
  if (!confirm("هل تريد حظر هذا الحساب؟")) return;
  try {
    if (window.SHURAK && window.SHURAK.db) {
      await window.SHURAK.db.collection("customers").doc(uid).update({ banned: true });
    }
    alert("تم حظر الحساب");
    loadAdminData();
  } catch (e) {
    alert("خطأ: " + e.message);
  }
}

async function adminUnbanUser(uid) {
  try {
    if (window.SHURAK && window.SHURAK.db) {
      await window.SHURAK.db.collection("customers").doc(uid).update({ banned: false });
    }
    alert("تم إلغاء الحظر");
    loadAdminData();
  } catch (e) {
    alert("خطأ: " + e.message);
  }
}

async function adminUpdateOrder(id, status) {
  try {
    if (window.SHURAK && window.SHURAK.db) {
      await window.SHURAK.db.collection("orders").doc(id).update({ status });
    }
    let orders = JSON.parse(localStorage.getItem("shurak_orders") || "[]");
    orders = orders.map(o => o.id === id ? { ...o, status } : o);
    localStorage.setItem("shurak_orders", JSON.stringify(orders));
    alert("تم تحديث حالة الطلب إلى: " + status);
    loadAdminData();
  } catch (e) {
    alert("خطأ: " + e.message);
  }
}

// ===== أدوات الإدارة الإضافية: كوبونات، تحكم بالموقع، تحليلات =====
function adminDb() { return window.SHURAK && window.SHURAK.db; }
function adminEscape(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

async function loadAdminExtras() {
  const db = adminDb();
  if (!db) return;
  try {
    const [coupons, settings, visits] = await Promise.all([
      db.collection('coupons').get(),
      db.collection('site_settings').doc('public').get(),
      db.collection('site_visits').get()
    ]);
    renderAdminCoupons(coupons.docs.map(d => ({id:d.id,...d.data()})));
    const cfg = settings.exists ? settings.data() : {};
    const fields = {siteHeroTitle:cfg.heroTitle,siteHeroText:cfg.heroText,siteButtonText:cfg.buttonText,siteBanner:cfg.bannerUrl,siteAnnouncement:cfg.announcement};
    Object.entries(fields).forEach(([id,val]) => { const el=document.getElementById(id); if(el && val) el.value=val; });
    updateHeroPreview();
    const allVisits = visits.docs.map(d=>d.data());
    const today = new Date().toISOString().slice(0,10);
    document.getElementById('statVisits').textContent = allVisits.length;
    document.getElementById('visitsToday').textContent = allVisits.filter(v=>(v.createdAt||'').slice(0,10)===today).length;
    document.getElementById('visitsPages').textContent = new Set(allVisits.map(v=>v.page).filter(Boolean)).size;
  } catch (e) { console.warn('تعذر تحميل أدوات الإدارة:', e); }
}

function renderAdminCoupons(list) {
  const body=document.getElementById('adminCouponsBody'); if(!body) return;
  if(!list.length){body.innerHTML='<tr><td colspan="7" style="text-align:center;padding:24px">لا توجد كوبونات بعد</td></tr>';return;}
  body.innerHTML=list.map(c=>`<tr><td><strong>${adminEscape(c.code||c.id)}</strong></td><td>${c.type==='percent'?'نسبة':c.type==='fixed'?'مبلغ':'شحن مجاني'}</td><td>${c.type==='shipping'?'—':adminEscape(c.value)}</td><td>${c.usedCount||0} / ${c.usageLimit||'∞'}</td><td>${adminEscape(c.expiresAt||'—')}</td><td><span class="badge ${c.active?'badge-green':'badge-gray'}">${c.active?'فعال':'موقوف'}</span></td><td><button class="action-btn ${c.active?'btn-ban':'btn-ok'}" onclick="toggleCoupon('${adminEscape(c.id)}',${!c.active})">${c.active?'إيقاف':'تفعيل'}</button></td></tr>`).join('');
}

async function toggleCoupon(id, active) {
  try { await adminDb().collection('coupons').doc(id).update({active}); await loadAdminExtras(); }
  catch(e){alert('تعذر تحديث الكوبون: '+e.message);}
}

function bindAdminExtras() {
  document.getElementById('couponForm')?.addEventListener('submit', async e=>{
    e.preventDefault(); const db=adminDb(); if(!db){alert('يجب إعداد Firebase أولاً');return;}
    const code=document.getElementById('couponCode').value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g,'');
    const type=document.getElementById('couponType').value;
    const value=type==='shipping'?0:Number(document.getElementById('couponValue').value);
    const limit=document.getElementById('couponLimit').value;
    const expiresAt=document.getElementById('couponExpiry').value;
    if(!code || (type!=='shipping' && !(value>0))){alert('تحقق من الرمز وقيمة الخصم');return;}
    try { await db.collection('coupons').doc(code).set({code,type,value,usageLimit:limit?Number(limit):null,usedCount:0,expiresAt:expiresAt||null,active:true,createdAt:new Date().toISOString()}); e.target.reset(); await loadAdminExtras(); alert('تم إنشاء الكوبون'); }
    catch(err){alert('تعذر إنشاء الكوبون: '+err.message);}
  });
  document.getElementById('siteSettingsForm')?.addEventListener('submit', async e=>{
    e.preventDefault(); const db=adminDb(); if(!db){alert('يجب إعداد Firebase أولاً');return;}
    const settings={heroTitle:document.getElementById('siteHeroTitle').value.trim(),heroText:document.getElementById('siteHeroText').value.trim(),buttonText:document.getElementById('siteButtonText').value.trim(),bannerUrl:document.getElementById('siteBanner').value.trim(),announcement:document.getElementById('siteAnnouncement').value.trim(),updatedAt:new Date().toISOString()};
    const submit=e.currentTarget.querySelector('[type="submit"]');
    if(submit){submit.disabled=true;submit.textContent='جاري الحفظ والنشر...';}
    try {
      await db.collection('site_settings').doc('public').set(settings,{merge:true});
      updateHeroPreview();
      alert('تم حفظ الإعلان وإعدادات الموقع بنجاح. حدّث الصفحة الرئيسية لمشاهدة التغيير.');
    } catch(err) {
      console.error('فشل نشر إعدادات الموقع:',err);
      alert('لم يتم إرسال الإعلان أو حفظ التعديلات: '+(err.message||'تحقق من صلاحيات Firebase'));
    } finally {
      if(submit){submit.disabled=false;submit.textContent='حفظ ونشر التعديلات';}
    }
  });
  ['siteHeroTitle','siteHeroText'].forEach(id=>document.getElementById(id)?.addEventListener('input',updateHeroPreview));
  document.getElementById('customerSearch')?.addEventListener('input',e=>{
    const q=e.target.value.trim().toLowerCase();
    document.querySelectorAll('#adminUsersBody tr').forEach(row=>row.style.display=row.textContent.toLowerCase().includes(q)?'':'none');
  });
}
function updateHeroPreview(){
  const title=document.getElementById('siteHeroTitle')?.value || 'كل اللي تحتاجه، في مكان واحد.';
  const desc=document.getElementById('siteHeroText')?.value || 'سوقك في مكان واحد.';
  const t=document.getElementById('heroPreviewTitle'), d=document.getElementById('heroPreviewText'); if(t)t.textContent=title;if(d)d.textContent=desc;
}

// اربط الأدوات بعد نجاح التحقق من صلاحية المدير.
const _shurakOriginalLoadAdminData = loadAdminData;
loadAdminData = async function(){ await _shurakOriginalLoadAdminData(); await loadAdminExtras(); };
document.addEventListener('DOMContentLoaded', bindAdminExtras);
