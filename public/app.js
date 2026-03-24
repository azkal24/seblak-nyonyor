/* ================================================
   SEBLAK NYO-NYOR — Complete App Logic
   Firebase Realtime Database + Vanilla JS
   ================================================ */

// ===== FIREBASE CONFIG =====
// Ganti nilai di bawah ini dengan konfigurasi Firebase project kamu
const firebaseConfig = {
  apiKey: "AIzaSyDXORD4m4u_BZysde5L5agqfkghA0EhO_k",
  authDomain: "seblak-nyonyor-app.firebaseapp.com",
  databaseURL: "https://seblak-nyonyor-app-default-rtdb.firebaseio.com",
  projectId: "seblak-nyonyor-app",
  storageBucket: "seblak-nyonyor-app.firebasestorage.app",
  messagingSenderId: "625490303149",
  appId: "1:625490303149:web:cae31e00b884abb8d84e24"
};

const ADMIN_PIN = "1234";
const ADMIN_WA  = "6285814675340";

// ===== APP STATE =====
let currentUser      = null; // { name, wa }
let isAdmin          = false;
let cart             = [];
let allOrders        = [];
let activeFilter     = "Semua"; // filter aktif admin
let storeStatus      = { closed: false, reason: "" };
let db               = null;

// Pilihan sementara di modal
let sel = {
  paketPrice : null,
  paketSpicy : null,
  custSpicy  : null,
  custToppings: {},
  bobaFlavor : null,
  bobaPrice  : 0,
  simpleMenu : null,
  simpleQty  : 1,
};

// ===== DATA MENU =====
const MENUS = [
  { id:"paketan", name:"Seblak Paketan",       icon:"🍲", price:"10.000 – 25.000", desc:"Seblak komplit dengan pilihan harga paket & level pedas favorit!", type:"paketan" },
  { id:"custom",  name:"Seblak Suka-Suka",     icon:"🌶️", price:"Mulai 10.000",    desc:"Harga dasar Rp 10.000, pilih topping sendiri sesukamu, level pedas sesuai selera!", type:"custom"  },
  { id:"bakso",   name:"Bakso Sapi (Isi Urat)", icon:"🥩", price:"15.000",          desc:"Bakso sapi kenyal isi urat gurih, kuah kaldu segar nan lezat!",    type:"simple", fixedPrice:15000 },
  { id:"mie",     name:"Mie Ayam",             icon:"🍜", price:"12.000",          desc:"Mie ayam dengan topping ayam empuk & sayuran segar!",               type:"simple", fixedPrice:12000 },
  { id:"boba",    name:"Special Drink Boba",   icon:"🧋", price:"6.000 – 8.000",  desc:"Minuman boba segar dengan berbagai pilihan rasa yang enak!",        type:"boba"    },
];

const TOPPING_GROUPS = [
  { price:1000, items:["Fish Koin","Sosis Hijau","Koin Star","Udang Mini","Kerupuk Warna Warni","Kerupuk Orange","Kerupuk Viral Rafael","Otak-Otak Sunfish","Sosis Salju","Bakso Ikan","Bakso Udang","Pilus Kencur","Cumi","Cikua Mini"] },
  { price:1500, items:["Sosis Koktail"] },
  { price:2000, items:["Tofu","Lobster Lapis","Dumpling Ayam","Dumpling Ayam Pedas","Stik Rasa Salmon","Jamur Salju","Cikua Isi Keju","Odeng Pedas","Stik Kepiting Guling","Stik Kepiting Lebar","Kerupuk Batagor Kering","Kerupuk Cuangki","Odeng Original","Jamur Enoki","Ceker Ayam","Dumpling Keju","Fishroll","Sosis Ayam","Bakso Sayur","Otak Otak Singapur","Duo Twister","Kue Ikan Pedas"] },
  { price:3000, items:["Udang Besar"] },
  { price:5000, items:["Sosis Besar"] },
];

const BOBA_GROUPS = [
  { price:8000, items:["Milo","Belgian Hilo","Zee Vanilla","Zee Chocolate","Frisian Flag Vanilla","Frisian Flag Chocolate","Dancow Vanilla","Dancow Chocolate"] },
  { price:7000, items:["Beng Beng","Matcha","Chocolatos Chocolate","Choco Hazelnut","Good Day Cappucino"] },
  { price:6000, items:["Vanilla Latte","Cappucino","Mocacinno","Red Velvet","Chocolate","Alpukat","Permen Karet","Vanilla Blue","Caramel","Mangga","Taro","Melon"] },
];

// ===== INISIALISASI =====
window.addEventListener("load", function() {
  // Inisialisasi Firebase dengan penanganan error
  try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
  } catch(e) {
    console.error("Firebase init error:", e);
    // Tetap lanjutkan untuk tampilkan UI, Firebase mungkin belum dikonfigurasi
  }

  // Tampilkan loading sebentar lalu ke halaman login
  setTimeout(function() {
    var splash = document.getElementById("splashScreen");
    splash.classList.add("hide");
    setTimeout(function() {
      splash.style.display = "none";
      showPage("loginPage");
    }, 500);
  }, 1800);

  // Build UI komponen
  buildToppingArea();
  buildBobaArea();
  buildMenuList();

  // Listen store status jika Firebase sudah siap
  if (db) listenStoreStatus();
});

// ===== ROUTING HALAMAN =====
function showPage(id) {
  ["loginPage","custApp","adminPanel"].forEach(function(p) {
    var el = document.getElementById(p);
    if (el) el.classList.add("d-none");
  });
  var target = document.getElementById(id);
  if (target) target.classList.remove("d-none");
}

// ===== LOGIN TAB =====
function switchTab(tab) {
  var isCust = tab === "cust";
  document.getElementById("tabCust").classList.toggle("active", isCust);
  document.getElementById("tabAdmin").classList.toggle("active", !isCust);
  document.getElementById("formCust").classList.toggle("d-none", !isCust);
  document.getElementById("formAdmin").classList.toggle("d-none", isCust);
  document.getElementById("pinErr").classList.add("d-none");
}

// ===== LOGIN CUSTOMER =====
function doLoginCustomer() {
  var name = document.getElementById("inpName").value.trim();
  var wa   = document.getElementById("inpWa").value.trim();
  if (!name) { showToast("Masukkan nama kamu dulu!", "error"); return; }
  if (!wa)   { showToast("Masukkan nomor WhatsApp kamu!", "error"); return; }

  currentUser = { name: name, wa: wa };
  isAdmin = false;
  document.getElementById("greetUser").textContent = "Halo, " + name + "! 👋";
  document.getElementById("coName").value = name;
  document.getElementById("coWa").value   = wa;
  showPage("custApp");

  if (db) {
    listenOrders();
    listenCustomerPoints(cleanWa(wa));
  }
  showToast("Selamat datang, " + name + "! 🎉", "success");
}

// ===== LOGIN ADMIN =====
function doLoginAdmin() {
  var pin = document.getElementById("inpPin").value;
  if (pin === ADMIN_PIN) {
    isAdmin = true;
    currentUser = null;
    showPage("adminPanel");
    if (db) {
      listenOrdersAdmin();
      listenStoreStatus();
      listenCustomersAdmin();
    }
    document.getElementById("inpPin").value = "";
    document.getElementById("pinErr").classList.add("d-none");
    showToast("Selamat datang, Admin! 🔐", "success");
  } else {
    document.getElementById("pinErr").classList.remove("d-none");
    document.getElementById("inpPin").value = "";
  }
}

// ===== LOGOUT =====
function doLogout() {
  currentUser = null;
  isAdmin     = false;
  cart        = [];
  allOrders   = [];
  if (db) {
    try { db.ref("orders").off(); } catch(e){}
  }
  showPage("loginPage");
  document.getElementById("inpName").value = "";
  document.getElementById("inpWa").value   = "";
}

// ===== STORE STATUS LISTENER =====
function listenStoreStatus() {
  if (!db) return;
  db.ref("storeStatus").on("value", function(snap) {
    var data = snap.val() || {};
    storeStatus.closed = data.closed === true;
    storeStatus.reason = data.reason || "";
    updateClosedBanner();
    if (isAdmin) updateAdminStoreCard();
  });
}

function updateClosedBanner() {
  var banner = document.getElementById("closedBanner");
  var rsnEl  = document.getElementById("closedReason");
  if (!banner) return;
  if (storeStatus.closed) {
    banner.classList.remove("d-none");
    rsnEl.textContent = storeStatus.reason ? "— " + storeStatus.reason : "";
  } else {
    banner.classList.add("d-none");
  }
}

// ===== VIEW SWITCHING =====
function goView(viewId) {
  document.querySelectorAll(".view").forEach(function(v) { v.classList.remove("show"); });
  var el = document.getElementById(viewId);
  if (el) el.classList.add("show");

  document.querySelectorAll(".bot-item").forEach(function(b) { b.classList.remove("active"); });
  if (viewId === "vMenu")   { var m = document.getElementById("bnMenu");   if(m) m.classList.add("active"); }
  if (viewId === "vStatus") { var s = document.getElementById("bnStatus"); if(s) s.classList.add("active"); renderStatusList(); }
  if (viewId === "vPoin")   { var p = document.getElementById("bnPoin");   if(p) p.classList.add("active"); }
}

// ===== BUILD MENU CARDS =====
function buildMenuList() {
  var container = document.getElementById("menuList");
  if (!container) return;
  container.innerHTML = MENUS.map(function(m) {
    return '<div class="menu-card">' +
      '<div class="menu-card-emoji">' + m.icon + '</div>' +
      '<div class="menu-card-body">' +
        '<h3>' + m.name + '</h3>' +
        '<p>' + m.desc + '</p>' +
        '<div class="menu-card-price">Rp ' + m.price + '</div>' +
      '</div>' +
      '<div class="menu-card-action">' +
        '<button class="btn-order-sm" onclick="openMenuModal(\'' + m.id + '\')">' +
          '+ Pesan' +
        '</button>' +
      '</div>' +
    '</div>';
  }).join("");
}

function openMenuModal(id) {
  if (storeStatus.closed) { showToast("Maaf, toko sedang tutup 🚪", "warning"); return; }
  if (id === "paketan") {
    sel.paketPrice = null; sel.paketSpicy = null;
    document.querySelectorAll("#paketGrid .price-chip").forEach(function(b){ b.classList.remove("sel"); });
    document.querySelectorAll("#paketSpicyRow .spicy-btn").forEach(function(b){ b.classList.remove("sel"); });
    document.getElementById("paketAddBtn").disabled = true;
    document.getElementById("paketAddBtn").textContent = "Tambah ke Keranjang";
    openModal("mPaketan");
  } else if (id === "custom") {
    sel.custSpicy = null; sel.custToppings = {};
    document.querySelectorAll("#custSpicyRow .spicy-btn").forEach(function(b){ b.classList.remove("sel"); });
    document.querySelectorAll("#toppingArea .topping-chip").forEach(function(b){ b.classList.remove("sel"); });
    updateCustomSummary();
    checkCustomReady();
    openModal("mCustom");
  } else if (id === "boba") {
    sel.bobaFlavor = null; sel.bobaPrice = 0;
    document.querySelectorAll("#bobaArea .boba-chip").forEach(function(b){ b.classList.remove("sel"); });
    var addBtn = document.getElementById("bobaAddBtn");
    addBtn.disabled = true;
    addBtn.textContent = "Pilih Rasa Dulu";
    openModal("mBoba");
  } else {
    var menu = MENUS.find(function(m){ return m.id === id; });
    if (!menu) return;
    sel.simpleMenu = menu;
    sel.simpleQty  = 1;
    document.getElementById("simpleTitle").textContent  = menu.icon + " " + menu.name;
    document.getElementById("simpleIcon").textContent   = menu.icon;
    document.getElementById("simpleDesc").textContent   = menu.desc;
    document.getElementById("simpleHarga").textContent  = "Rp " + fmtRp(menu.fixedPrice);
    document.getElementById("simpleQtyVal").textContent = "1";
    openModal("mSimple");
  }
}

// ===== PAKETAN =====
function pickPaket(price, btn) {
  sel.paketPrice = price;
  document.querySelectorAll("#paketGrid .price-chip").forEach(function(b){ b.classList.remove("sel"); });
  btn.classList.add("sel");
  checkPaketReady();
}

function pickSpicy(ctx, level, btn) {
  if (ctx === "p") {
    sel.paketSpicy = level;
    document.querySelectorAll("#paketSpicyRow .spicy-btn").forEach(function(b){ b.classList.remove("sel"); });
  } else {
    sel.custSpicy = level;
    document.querySelectorAll("#custSpicyRow .spicy-btn").forEach(function(b){ b.classList.remove("sel"); });
    checkCustomReady();
  }
  btn.classList.add("sel");
  if (ctx === "p") checkPaketReady();
}

function checkPaketReady() {
  var ready = (sel.paketPrice !== null && sel.paketSpicy !== null);
  var btn   = document.getElementById("paketAddBtn");
  btn.disabled = !ready;
  btn.textContent = ready
    ? "Tambah ke Keranjang — Rp " + fmtRp(sel.paketPrice)
    : "Tambah ke Keranjang";
}

function addPaket() {
  if (sel.paketPrice === null || sel.paketSpicy === null) return;
  addToCart({
    id        : uid(),
    menuId    : "paketan",
    menuName  : "Seblak Paketan",
    icon      : "🍲",
    variant   : "Paket Rp " + fmtRp(sel.paketPrice),
    spicyLevel: sel.paketSpicy,
    toppings  : null,
    bobaFlavor: null,
    qty       : 1,
    unitPrice : sel.paketPrice,
  });
  closeModal("mPaketan");
}

// ===== CUSTOM / TOPPING =====
function buildToppingArea() {
  var area = document.getElementById("toppingArea");
  if (!area) return;
  area.innerHTML = TOPPING_GROUPS.map(function(g) {
    return '<div class="topping-group">' +
      '<div class="topping-group-header">' +
        '<span class="topping-price-badge">Rp ' + fmtRp(g.price) + ' / topping</span>' +
      '</div>' +
      '<div class="topping-chips">' +
        g.items.map(function(item) {
          return '<button class="topping-chip" onclick="toggleTopping(' + g.price + ',\'' + item.replace(/'/g,"\\'") + '\',this)">' + item + '</button>';
        }).join("") +
      '</div>' +
    '</div>';
  }).join("");
}

function toggleTopping(price, name, btn) {
  var key = String(price);
  if (!sel.custToppings[key]) sel.custToppings[key] = [];
  var idx = sel.custToppings[key].indexOf(name);
  if (idx === -1) {
    sel.custToppings[key].push(name);
    btn.classList.add("sel");
  } else {
    sel.custToppings[key].splice(idx, 1);
    btn.classList.remove("sel");
  }
  updateCustomSummary();
  checkCustomReady();
}

var CUSTOM_BASE_PRICE = 10000;

function updateCustomSummary() {
  var count = 0, toppingTotal = 0;
  Object.keys(sel.custToppings).forEach(function(price) {
    var tops = sel.custToppings[price];
    count += tops.length;
    toppingTotal += Number(price) * tops.length;
  });
  var total = CUSTOM_BASE_PRICE + toppingTotal;
  var el = document.getElementById("custTotal");
  if (el) {
    el.innerHTML =
      '<span>Harga dasar: <strong>Rp ' + fmtRp(CUSTOM_BASE_PRICE) + '</strong></span>' +
      (count > 0 ? ' + <span>' + count + ' topping: <strong>Rp ' + fmtRp(toppingTotal) + '</strong></span>' : '') +
      '<br><span style="font-size:15px;color:var(--primary)">Total: <strong>Rp ' + fmtRp(total) + '</strong></span>';
  }
  return { count: count, total: total };
}

function checkCustomReady() {
  var res = updateCustomSummary();
  var btn = document.getElementById("custAddBtn");
  var ready = (sel.custSpicy !== null);
  btn.disabled = !ready;
  btn.textContent = ready
    ? "Tambah ke Keranjang — Rp " + fmtRp(res.total)
    : "Pilih Level Pedas Dulu";
}

function addCustom() {
  var res = updateCustomSummary();
  if (sel.custSpicy === null) return;
  var tCopy = {};
  Object.keys(sel.custToppings).forEach(function(k) {
    if (sel.custToppings[k].length) tCopy[k] = sel.custToppings[k].slice();
  });
  addToCart({
    id        : uid(),
    menuId    : "custom",
    menuName  : "Seblak Suka-Suka",
    icon      : "🌶️",
    variant   : null,
    spicyLevel: sel.custSpicy,
    toppings  : tCopy,
    bobaFlavor: null,
    qty       : 1,
    unitPrice : res.total,
  });
  closeModal("mCustom");
}

// ===== BOBA =====
function buildBobaArea() {
  var area = document.getElementById("bobaArea");
  if (!area) return;
  area.innerHTML = BOBA_GROUPS.map(function(g) {
    return '<div class="boba-group">' +
      '<div class="topping-group-header">' +
        '<span class="topping-price-badge" style="background:linear-gradient(135deg,#7c3aed,#a855f7)">Rp ' + fmtRp(g.price) + '</span>' +
      '</div>' +
      '<div class="boba-flavors">' +
        g.items.map(function(item) {
          return '<button class="boba-chip" onclick="pickBoba(' + g.price + ',\'' + item.replace(/'/g,"\\'") + '\',this)">' + item + '</button>';
        }).join("") +
      '</div>' +
    '</div>';
  }).join("");
}

function pickBoba(price, flavor, btn) {
  document.querySelectorAll("#bobaArea .boba-chip").forEach(function(b){ b.classList.remove("sel"); });
  btn.classList.add("sel");
  sel.bobaFlavor = flavor;
  sel.bobaPrice  = price;
  var addBtn = document.getElementById("bobaAddBtn");
  addBtn.disabled = false;
  addBtn.textContent = flavor + " — Rp " + fmtRp(price);
}

function addBoba() {
  if (!sel.bobaFlavor) return;
  addToCart({
    id        : uid(),
    menuId    : "boba",
    menuName  : "Special Drink Boba",
    icon      : "🧋",
    variant   : sel.bobaFlavor,
    spicyLevel: null,
    toppings  : null,
    bobaFlavor: sel.bobaFlavor,
    qty       : 1,
    unitPrice : sel.bobaPrice,
  });
  closeModal("mBoba");
}

// ===== SIMPLE MENU =====
function chgSimpleQty(delta) {
  sel.simpleQty = Math.max(1, sel.simpleQty + delta);
  document.getElementById("simpleQtyVal").textContent = sel.simpleQty;
}

function addSimple() {
  var m = sel.simpleMenu;
  if (!m) return;
  addToCart({
    id        : uid(),
    menuId    : m.id,
    menuName  : m.name,
    icon      : m.icon,
    variant   : null,
    spicyLevel: null,
    toppings  : null,
    bobaFlavor: null,
    qty       : sel.simpleQty,
    unitPrice : m.fixedPrice,
  });
  closeModal("mSimple");
}

// ===== CART =====
function addToCart(item) {
  var existing = cart.find(function(c) {
    return c.menuId === item.menuId &&
      c.variant === item.variant &&
      c.spicyLevel === item.spicyLevel &&
      c.bobaFlavor === item.bobaFlavor &&
      JSON.stringify(c.toppings) === JSON.stringify(item.toppings);
  });
  if (existing) {
    existing.qty += item.qty;
  } else {
    cart.push(item);
  }
  updateCartBadge();
  showToast(item.icon + " " + item.menuName + " ditambahkan!", "success");
}

function updateCartBadge() {
  var total = cart.reduce(function(s,i){ return s + i.qty; }, 0);
  var badge = document.getElementById("cartCount");
  if (total > 0) {
    badge.classList.remove("d-none");
    badge.textContent = total;
  } else {
    badge.classList.add("d-none");
  }
}

function openCart() {
  document.getElementById("cartOverlay").classList.remove("d-none");
  document.getElementById("cartDrawer").classList.remove("d-none");
  renderCartBody();
}

function closeCart() {
  document.getElementById("cartOverlay").classList.add("d-none");
  document.getElementById("cartDrawer").classList.add("d-none");
}

function renderCartBody() {
  var body = document.getElementById("cartBody");
  var foot = document.getElementById("cartFoot");

  if (cart.length === 0) {
    body.innerHTML = '<div class="empty-state"><div class="empty-icon">🛒</div><p>Keranjang kosong</p><span>Tambahkan menu favoritmu!</span></div>';
    foot.classList.add("d-none");
    return;
  }
  foot.classList.remove("d-none");

  body.innerHTML = cart.map(function(item, idx) {
    var varParts = [];
    if (item.variant)    varParts.push(item.variant);
    if (item.spicyLevel !== null && item.spicyLevel !== undefined) varParts.push("🌶️ Level " + item.spicyLevel);
    if (item.toppings) {
      Object.keys(item.toppings).forEach(function(price) {
        var tops = item.toppings[price];
        if (tops.length) varParts.push("Topping " + fmtRp(Number(price)) + ": " + tops.join(", "));
      });
    }
    if (item.bobaFlavor) varParts.push("Rasa: " + item.bobaFlavor);

    return '<div class="cart-item">' +
      '<div class="cart-item-icon">' + item.icon + '</div>' +
      '<div class="cart-item-info">' +
        '<div class="cart-item-name">' + item.menuName + '</div>' +
        (varParts.length ? '<div class="cart-item-var">' + varParts.join(" · ") + '</div>' : '') +
        '<div class="cart-item-price">Rp ' + fmtRp(item.unitPrice * item.qty) + '</div>' +
      '</div>' +
      '<div class="cart-item-ctrl">' +
        '<button onclick="changeCartQty(' + idx + ',-1)">−</button>' +
        '<span>' + item.qty + '</span>' +
        '<button onclick="changeCartQty(' + idx + ',1)">+</button>' +
      '</div>' +
    '</div>';
  }).join("");

  recalcTotal();
}

function changeCartQty(idx, delta) {
  cart[idx].qty += delta;
  if (cart[idx].qty <= 0) cart.splice(idx, 1);
  updateCartBadge();
  renderCartBody();
}

function recalcTotal() {
  var subtotal = cart.reduce(function(s,i){ return s + i.unitPrice * i.qty; }, 0);
  var pkgRadio = document.querySelector('input[name="pkg"]:checked');
  var pkgFee   = pkgRadio && pkgRadio.value === "box" ? 2000 : 0;
  var total    = subtotal + pkgFee;
  document.getElementById("tSubtotal").textContent = "Rp " + fmtRp(subtotal);
  document.getElementById("tPack").textContent     = pkgFee ? "+Rp " + fmtRp(pkgFee) : "Gratis";
  document.getElementById("tTotal").textContent    = "Rp " + fmtRp(total);
  var pts = calcPoints(total);
  var ptEl = document.getElementById("tPoints");
  if (ptEl) ptEl.textContent = pts > 0 ? "+" + pts + " poin ⭐" : "0 poin";
}

// ===== ORDER SUBMIT =====
function doOrder() {
  if (!db) { showToast("Firebase belum dikonfigurasi!", "error"); return; }
  if (storeStatus.closed) { showToast("Maaf, toko sedang tutup!", "error"); return; }
  if (cart.length === 0)  { showToast("Keranjang masih kosong!", "error"); return; }

  var time = document.getElementById("coTime").value;
  if (!time) { showToast("Masukkan jam ambil dulu!", "error"); return; }

  var name    = currentUser.name;
  var wa      = currentUser.wa;
  var pkg     = (document.querySelector('input[name="pkg"]:checked') || {}).value || "plastic";
  var subtotal = cart.reduce(function(s,i){ return s + i.unitPrice * i.qty; }, 0);
  var pkgFee  = pkg === "box" ? 2000 : 0;
  var total   = subtotal + pkgFee;

  generateOrderId(function(orderId) {
    var order = {
      id          : orderId,
      customerName: name,
      whatsapp    : cleanWa(wa),
      pickupTime  : time,
      items       : JSON.parse(JSON.stringify(cart)),
      packaging   : pkg,
      subtotal    : subtotal,
      pkgFee      : pkgFee,
      totalPrice  : total,
      status      : "Menunggu",
      createdAt   : Date.now(),
    };

    db.ref("orders/" + orderId).set(order).then(function() {
      var pts = calcPoints(total);
      if (pts > 0) awardPoints(cleanWa(wa), name, pts);

      var msg    = buildWaMsg(order, pts);
      var waUrl  = "https://wa.me/" + ADMIN_WA + "?text=" + encodeURIComponent(msg);
      window.open(waUrl, "_blank");
      cart = [];
      updateCartBadge();
      closeCart();
      var toastMsg = "Pesanan " + orderId + " berhasil! ✅";
      if (pts > 0) toastMsg += " Kamu dapat +" + pts + " poin ⭐";
      showToast(toastMsg, "success");
      goView("vStatus");
    }).catch(function(err) {
      console.error(err);
      showToast("Gagal kirim pesanan, coba lagi!", "error");
    });
  });
}

function buildWaMsg(order, pts) {
  var msg = "🌶️ *PESANAN BARU SEBLAK NYO-NYOR* 🌶️\n";
  msg    += "━━━━━━━━━━━━━━━━━━━━━━\n";
  msg    += "📋 *ID: " + order.id + "*\n";
  msg    += "👤 Nama: " + order.customerName + "\n";
  msg    += "📱 WA: " + order.whatsapp + "\n";
  msg    += "🕐 Jam Ambil: " + order.pickupTime + " WIB\n";
  msg    += "━━━━━━━━━━━━━━━━━━━━━━\n";
  msg    += "📦 *DETAIL PESANAN*\n\n";

  order.items.forEach(function(item) {
    msg += item.qty + "x *" + item.menuName + "*\n";
    if (item.variant)    msg += "   Varian: " + item.variant + "\n";
    if (item.spicyLevel !== null && item.spicyLevel !== undefined)
                          msg += "   Level Pedas: " + item.spicyLevel + "\n";
    if (item.toppings) {
      Object.keys(item.toppings).forEach(function(price) {
        var tops = item.toppings[price];
        if (tops.length) {
          msg += "\n   *Topping Rp " + fmtRp(Number(price)) + ":*\n";
          tops.forEach(function(t){ msg += "   • " + t + "\n"; });
        }
      });
    }
    if (item.bobaFlavor) msg += "   Rasa: " + item.bobaFlavor + "\n";
    msg += "   Harga: Rp " + fmtRp(item.unitPrice * item.qty) + "\n\n";
  });

  msg += "━━━━━━━━━━━━━━━━━━━━━━\n";
  msg += "📦 Kemasan: " + (order.packaging === "box" ? "Box Delivery (+Rp 2.000)" : "Bungkus Plastik (Gratis)") + "\n";
  msg += "\n💰 *TOTAL: Rp " + fmtRp(order.totalPrice) + "*\n\n";
  msg += "💳 Bayar saat ambil (COD)\n";
  if (pts && pts > 0) msg += "⭐ Poin didapat: +" + pts + " poin\n";
  msg += "━━━━━━━━━━━━━━━━━━━━━━\n";
  msg += "Terima kasih sudah pesan di Seblak Nyo-Nyor! 🌶️❤️";
  return msg;
}

function generateOrderId(callback) {
  db.ref("orderCounter").transaction(function(current) {
    return (current || 0) + 1;
  }, function(err, committed, snap) {
    var count = snap.val() || 1;
    callback("NYO-NYOR-" + String(count).padStart(2, "0"));
  });
}

// ===== REALTIME PESANAN (CUSTOMER) =====
function listenOrders() {
  if (!db) return;
  db.ref("orders").on("value", function(snap) {
    var data = snap.val() || {};
    allOrders = Object.values(data).sort(function(a,b){ return b.createdAt - a.createdAt; });
    var statusView = document.getElementById("vStatus");
    if (statusView && statusView.classList.contains("show")) renderStatusList();
  });
}

function renderStatusList() {
  var q   = (document.getElementById("searchInp") || {}).value || "";
  var qLow = q.trim().toLowerCase();
  var container = document.getElementById("statusList");
  if (!container) return;

  var list;
  if (qLow) {
    list = allOrders.filter(function(o) {
      return o.id.toLowerCase().includes(qLow) ||
             (o.customerName || "").toLowerCase().includes(qLow);
    });
  } else {
    var myName = (currentUser && currentUser.name || "").toLowerCase();
    var myWa   = cleanWa(currentUser && currentUser.wa || "");
    list = allOrders.filter(function(o) {
      return (o.customerName || "").toLowerCase() === myName || o.whatsapp === myWa;
    });
  }

  if (list.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📦</div>' +
      '<p>Belum ada pesanan</p>' +
      '<span>' + (qLow ? "Tidak ditemukan" : "Yuk mulai pesan!") + '</span></div>';
    return;
  }

  var STEPS = ["Menunggu","Diproses","Siap Diambil","Selesai"];
  var BADGE_CLS = { "Menunggu":"badge-menunggu","Diproses":"badge-diproses","Siap Diambil":"badge-siap","Selesai":"badge-selesai" };

  container.innerHTML = list.map(function(order) {
    var stepIdx  = STEPS.indexOf(order.status);
    var segs     = STEPS.map(function(_,i){ return '<div class="progress-seg ' + (i <= stepIdx ? "done" : "") + '"></div>'; }).join("");
    var lbls     = STEPS.map(function(s,i){ return '<span class="' + (i === stepIdx ? "active-lbl" : "") + '">' + s + '</span>'; }).join("");
    var itemsHtml = (order.items || []).map(function(item) {
      var label = item.qty + "x " + item.menuName;
      if (item.variant)    label += " (" + item.variant + ")";
      if (item.spicyLevel != null) label += " 🌶️" + item.spicyLevel;
      if (item.bobaFlavor) label += " — " + item.bobaFlavor;
      return '<div class="status-item-row"><strong>' + label + '</strong><span>Rp ' + fmtRp(item.unitPrice * item.qty) + '</span></div>';
    }).join("");

    return '<div class="status-card">' +
      '<div class="status-card-top">' +
        '<div>' +
          '<div class="status-card-id">' + order.id + '</div>' +
          '<div class="status-card-name">' + order.customerName + '</div>' +
          '<div class="status-card-time">⏰ Ambil: ' + order.pickupTime + ' WIB</div>' +
        '</div>' +
        '<div class="status-right">' +
          '<div class="status-total">Rp ' + fmtRp(order.totalPrice) + '</div>' +
          '<span class="status-badge ' + (BADGE_CLS[order.status] || "") + '">' + order.status + '</span>' +
        '</div>' +
      '</div>' +
      '<div class="progress-track">' + segs + '</div>' +
      '<div class="progress-labels">' + lbls + '</div>' +
      '<div class="status-items">' + itemsHtml + '</div>' +
    '</div>';
  }).join("");
}

// ===== ADMIN REALTIME =====
var prevOrderIds     = new Set();
var isFirstAdminLoad = true;

function listenOrdersAdmin() {
  if (!db) return;
  db.ref("orders").on("value", function(snap) {
    var data = snap.val() || {};
    var list = Object.values(data).sort(function(a,b){ return b.createdAt - a.createdAt; });

    if (!isFirstAdminLoad) {
      list.forEach(function(o) {
        if (!prevOrderIds.has(o.id)) {
          playNotif();
          showToast("🛎️ Pesanan baru: " + o.id + " dari " + o.customerName + "!", "success");
        }
      });
    }
    isFirstAdminLoad = false;
    prevOrderIds = new Set(list.map(function(o){ return o.id; }));
    allOrders    = list;
    renderAdminOrders();
    updateNewBadge();
  });
}

function updateNewBadge() {
  var count = allOrders.filter(function(o){ return o.status === "Menunggu"; }).length;
  var badge = document.getElementById("newBadge");
  if (!badge) return;
  if (count > 0) {
    badge.classList.remove("d-none");
    badge.textContent = count + " Baru";
  } else {
    badge.classList.add("d-none");
  }
}

function adminFilter(status, btn) {
  activeFilter = status;
  document.querySelectorAll(".filter-btn").forEach(function(b){ b.classList.remove("active"); });
  btn.classList.add("active");
  renderAdminOrders();
}

function renderAdminOrders() {
  var container = document.getElementById("adminOrders");
  if (!container) return;

  var filtered = activeFilter === "Semua"
    ? allOrders
    : allOrders.filter(function(o){ return o.status === activeFilter; });

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">🛎️</div>' +
      '<p>Belum ada pesanan</p><span>Pesanan baru akan muncul di sini</span></div>';
    return;
  }

  var STATUS_OPTS = ["Menunggu","Diproses","Siap Diambil","Selesai"];
  var BADGE_CLS   = { "Menunggu":"badge-menunggu","Diproses":"badge-diproses","Siap Diambil":"badge-siap","Selesai":"badge-selesai" };

  container.innerHTML = filtered.map(function(order) {
    var itemsHtml = (order.items || []).map(function(item) {
      var toppingLines = "";
      if (item.toppings) {
        Object.keys(item.toppings).forEach(function(price) {
          var tops = item.toppings[price];
          if (tops.length) toppingLines += '<div class="detail-topping">• Topping Rp ' + fmtRp(Number(price)) + ': ' + tops.join(", ") + '</div>';
        });
      }
      return '<div class="detail-item">' +
        '<strong>' + item.qty + 'x ' + item.menuName + '</strong>' +
        (item.variant ? '<em> — ' + item.variant + '</em>' : '') +
        (item.spicyLevel != null ? ' <em>🌶️ Level ' + item.spicyLevel + '</em>' : '') +
        (item.bobaFlavor ? '<em> — ' + item.bobaFlavor + '</em>' : '') +
        toppingLines +
      '</div>';
    }).join("");

    var statusBtns = STATUS_OPTS.map(function(s) {
      var isCurrent = order.status === s;
      var cls       = "status-btn" + (isCurrent ? " current" : "") + (s === "Selesai" && !isCurrent ? " btn-done" : "");
      return '<button class="' + cls + '" ' +
        (isCurrent ? "disabled" : 'onclick="adminSetStatus(\'' + order.id + '\',\'' + s + '\',\'' + order.whatsapp + '\',\'' + order.customerName.replace(/'/g,"\\'") + '\')"') +
        '>' + s + '</button>';
    }).join("");

    var waMsg = encodeURIComponent(
      "Halo kak *" + order.customerName + "*! 👋\n\n" +
      "Pesanan kamu *" + order.id + "* sudah selesai dan siap diambil! 🎉\n\n" +
      "Silahkan segera ke toko ya kak!\n\n" +
      "Terima kasih sudah pesan di *Seblak Nyo-Nyor*! 🌶️❤️"
    );

    var custData   = allCustomers.find(function(c){ return c.wa === order.whatsapp; });
    var custPoints = custData ? (custData.totalPoints || 0) : 0;
    var ptsBadge   = '<span class="order-pts-badge">⭐ ' + custPoints + ' poin</span>';

    return '<div class="admin-order-card" id="acard-' + order.id + '">' +
      '<div class="order-card-top" onclick="toggleDetail(\'' + order.id + '\')">' +
        '<div class="order-card-left">' +
          '<div class="order-card-id">' + order.id + '</div>' +
          '<div class="order-card-name">' + order.customerName + ' ' + ptsBadge + '</div>' +
          '<div class="order-card-meta">📱 ' + order.whatsapp + ' · ⏰ ' + order.pickupTime + ' WIB</div>' +
          '<div class="order-card-meta">📦 ' + (order.packaging === "box" ? "Box Delivery" : "Plastik") + '</div>' +
        '</div>' +
        '<div class="order-card-right">' +
          '<div class="order-card-total">Rp ' + fmtRp(order.totalPrice) + '</div>' +
          '<span class="status-badge ' + (BADGE_CLS[order.status] || "") + '">' + order.status + '</span>' +
          '<svg class="chevron" id="chev-' + order.id + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>' +
        '</div>' +
      '</div>' +
      '<div class="order-card-detail" id="detail-' + order.id + '">' +
        '<div class="detail-customer-pts">' +
          '<div><strong>👤 ' + order.customerName + '</strong></div>' +
          '<div>📱 ' + order.whatsapp + '</div>' +
          '<div class="detail-pts-row">Total Poin: <strong>' + custPoints + ' ⭐</strong></div>' +
        '</div>' +
        '<div class="detail-items">' + itemsHtml + '</div>' +
        '<div style="font-size:12px;color:var(--gray-500);margin:6px 0 10px">Kemasan: ' +
          (order.packaging === "box" ? "Box Delivery (+Rp 2.000)" : "Bungkus Plastik (Gratis)") + '</div>' +
        '<div class="status-action-row">' +
          statusBtns +
          '<a class="wa-btn" href="https://wa.me/' + order.whatsapp + '?text=' + waMsg + '" target="_blank">📲 WhatsApp</a>' +
        '</div>' +
      '</div>' +
    '</div>';
  }).join("");
}

function toggleDetail(id) {
  var detail = document.getElementById("detail-" + id);
  var chev   = document.getElementById("chev-"   + id);
  if (detail) detail.classList.toggle("open");
  if (chev)   chev.classList.toggle("open");
}

function adminSetStatus(orderId, newStatus, waNum, custName) {
  if (!db) return;
  db.ref("orders/" + orderId).update({ status: newStatus });
  if (newStatus === "Selesai") {
    var msg = encodeURIComponent(
      "Halo kak *" + custName + "*! 👋\n\n" +
      "Pesanan kamu *" + orderId + "* sudah *SELESAI* dan siap diambil! 🎉✅\n\n" +
      "Silahkan segera ke toko ya kak!\n\n" +
      "Terima kasih sudah pesan di *Seblak Nyo-Nyor*! 🌶️❤️"
    );
    window.open("https://wa.me/" + waNum + "?text=" + msg, "_blank");
    showToast("Notifikasi selesai dikirim! ✅", "success");
  } else {
    showToast("Status diubah ke \"" + newStatus + "\"", "success");
  }
}

// ===== ADMIN STORE CONTROL =====
function updateAdminStoreCard() {
  var emoji  = document.getElementById("storeEmoji");
  var lbl    = document.getElementById("storeLbl");
  var rsnLbl = document.getElementById("storeRsnLbl");
  var btn    = document.getElementById("storeBtn");
  var rsnForm = document.getElementById("rsnForm");
  if (!emoji) return;

  if (storeStatus.closed) {
    emoji.textContent   = "🔴";
    lbl.textContent     = "Toko Tutup";
    rsnLbl.textContent  = storeStatus.reason || "";
    btn.textContent     = "Buka Toko";
    btn.className       = "toggle-btn close-btn";
    rsnForm.classList.remove("d-none");
    document.getElementById("rsnInp").value = storeStatus.reason;
  } else {
    emoji.textContent   = "🟢";
    lbl.textContent     = "Toko Buka";
    rsnLbl.textContent  = "";
    btn.textContent     = "Tutup Toko";
    btn.className       = "toggle-btn open-btn";
    rsnForm.classList.add("d-none");
  }
}

function toggleStore() {
  if (!db) return;
  var newClosed = !storeStatus.closed;
  var reason    = newClosed ? (document.getElementById("rsnInp") || {}).value || "" : "";
  db.ref("storeStatus").set({ closed: newClosed, reason: reason });
  showToast(newClosed ? "Toko ditutup! 🚪" : "Toko dibuka! 🟢", newClosed ? "warning" : "success");
}

function saveReason() {
  if (!db) return;
  var rsn = (document.getElementById("rsnInp") || {}).value || "";
  db.ref("storeStatus").update({ reason: rsn });
  showToast("Alasan tutup disimpan!", "success");
}

// ===== MODAL =====
function openModal(id) {
  var el = document.getElementById(id);
  if (el) el.classList.remove("d-none");
  document.body.style.overflow = "hidden";
}

function closeModal(id) {
  var el = document.getElementById(id);
  if (el) el.classList.add("d-none");
  document.body.style.overflow = "";
}

function overlayClose(overlay, modalId) {
  if (overlay === event.target) closeModal(modalId);
}

// ===== NOTIFIKASI SUARA =====
function playNotif() {
  try {
    var ctx   = new (window.AudioContext || window.webkitAudioContext)();
    var notes = [880, 1047, 1319];
    notes.forEach(function(freq, i) {
      var osc  = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = "sine"; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.28, ctx.currentTime + i * 0.18);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.18 + 0.35);
      osc.start(ctx.currentTime + i * 0.18);
      osc.stop(ctx.currentTime + i * 0.18 + 0.35);
    });
  } catch(e) { /* no sound support */ }
}

// ===== TOAST =====
function showToast(msg, type) {
  type = type || "info";
  var box  = document.getElementById("toastBox");
  if (!box) return;
  var el   = document.createElement("div");
  var icons = { success:"✅", error:"❌", warning:"⚠️", info:"ℹ️" };
  el.className = "toast " + type;
  el.innerHTML = '<span class="toast-icon">' + (icons[type] || "ℹ️") + '</span><span>' + msg + '</span>';
  box.appendChild(el);
  setTimeout(function() {
    el.style.animation = "toastOut .3s ease forwards";
    setTimeout(function(){ if(el.parentNode) el.remove(); }, 300);
  }, 3200);
}

// ===== SISTEM POIN =====

function calcPoints(total) {
  if (total < 10000) return 0;
  if (total <= 15000) return 1;
  return 2 + Math.floor((total - 16000) / 10000);
}

function awardPoints(wa, name, pts) {
  if (!db || !wa || pts <= 0) return;
  var ref = db.ref("customers/" + wa);
  ref.transaction(function(current) {
    if (!current) {
      return { name: name, wa: wa, totalPoints: pts, totalOrders: 1, lastOrder: Date.now() };
    }
    return {
      name       : current.name || name,
      wa         : wa,
      totalPoints: (current.totalPoints || 0) + pts,
      totalOrders: (current.totalOrders || 0) + 1,
      lastOrder  : Date.now(),
    };
  });
}

function listenCustomerPoints(wa) {
  if (!db || !wa) return;
  db.ref("customers/" + wa).on("value", function(snap) {
    var data = snap.val() || {};
    var pts   = data.totalPoints || 0;
    var total = data.totalOrders || 0;

    var ptEl  = document.getElementById("myPointsVal");
    var subEl = document.getElementById("myPointsSub");
    var ordEl = document.getElementById("myTotalOrders");
    if (ptEl)  ptEl.textContent  = pts;
    if (ordEl) ordEl.textContent = total;
    if (subEl) {
      if (pts === 0) subEl.textContent = "Belum ada poin. Yuk mulai pesan!";
      else if (pts < 5)  subEl.textContent = "Terus semangat belanja, poin kamu bertambah! 🔥";
      else if (pts < 10) subEl.textContent = "Wah, udah " + pts + " poin! Kamu pelanggan setia nih 😍";
      else               subEl.textContent = "Luar biasa! " + pts + " poin — kamu pelanggan VIP Seblak Nyo-Nyor! 🌶️👑";
    }
  });
}

// ===== ADMIN TAB =====

function switchAdminTab(tab, btn) {
  document.querySelectorAll(".admin-tab").forEach(function(b){ b.classList.remove("active"); });
  btn.classList.add("active");
  var ordersEl    = document.getElementById("adminTabOrders");
  var customersEl = document.getElementById("adminTabCustomers");
  if (tab === "orders") {
    ordersEl.classList.remove("d-none");
    customersEl.classList.add("d-none");
  } else {
    ordersEl.classList.add("d-none");
    customersEl.classList.remove("d-none");
    renderCustomerList();
  }
}

var allCustomers = [];

function listenCustomersAdmin() {
  if (!db) return;
  db.ref("customers").on("value", function(snap) {
    var data = snap.val() || {};
    allCustomers = Object.values(data).sort(function(a,b){
      return (b.totalPoints || 0) - (a.totalPoints || 0);
    });
    var custTab = document.getElementById("adminTabCustomers");
    if (custTab && !custTab.classList.contains("d-none")) renderCustomerList();
  });
}

function renderCustomerList() {
  var container = document.getElementById("customerList");
  if (!container) return;

  if (allCustomers.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">⭐</div>' +
      '<p>Belum ada data pelanggan</p>' +
      '<span>Data muncul setelah pelanggan pertama pesan</span></div>';
    return;
  }

  var MEDALS = ["🥇","🥈","🥉"];

  container.innerHTML = allCustomers.map(function(c, idx) {
    var medal   = idx < 3 ? MEDALS[idx] : (idx + 1) + ".";
    var pts     = c.totalPoints  || 0;
    var orders  = c.totalOrders  || 0;
    var lastDt  = c.lastOrder ? new Date(c.lastOrder).toLocaleDateString("id-ID") : "-";
    var barW    = allCustomers[0] && allCustomers[0].totalPoints
      ? Math.round((pts / allCustomers[0].totalPoints) * 100)
      : 100;

    return '<div class="customer-card' + (idx < 3 ? " top-customer" : "") + '">' +
      '<div class="customer-rank">' + medal + '</div>' +
      '<div class="customer-info">' +
        '<div class="customer-name">' + (c.name || "—") + '</div>' +
        '<div class="customer-wa">📱 ' + c.wa + '</div>' +
        '<div class="customer-meta">🛒 ' + orders + ' pesanan · 📅 Terakhir: ' + lastDt + '</div>' +
        '<div class="customer-bar-wrap"><div class="customer-bar" style="width:' + barW + '%"></div></div>' +
      '</div>' +
      '<div class="customer-pts">' +
        '<div class="customer-pts-val">' + pts + '</div>' +
        '<div class="customer-pts-lbl">poin</div>' +
      '</div>' +
      '<a class="customer-wa-btn" href="https://wa.me/' + c.wa + '" target="_blank">💬</a>' +
    '</div>';
  }).join("");
}

// ===== HELPERS =====
function fmtRp(n) { return Number(n).toLocaleString("id-ID"); }
function uid()    { return Date.now() + "-" + Math.random().toString(36).slice(2,7); }
function cleanWa(wa) {
  if (!wa) return "";
  return wa.replace(/\D/g,"").replace(/^0/, "62");
}
