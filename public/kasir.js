/* ================================================
   SEBLAK NYO-NYOR — Premium Loyalty System
   Firebase Realtime Database + Vanilla JS
   ================================================ */

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

let currentUser  = null; 
let isAdmin      = false;
let db           = null;
let allCustomers = [];

window.addEventListener("load", function() {
  try { firebase.initializeApp(firebaseConfig); db = firebase.database(); } 
  catch(e) { console.error(e); }

  setTimeout(function() {
    var splash = document.getElementById("splashScreen");
    splash.classList.add("hide");
    setTimeout(function() { splash.style.display = "none"; showPage("loginPage"); }, 500);
  }, 1800);
});

function showPage(id) {
  ["loginPage","custApp","adminPanel"].forEach(function(p) {
    var el = document.getElementById(p);
    if (el) el.classList.add("d-none");
  });
  var target = document.getElementById(id);
  if (target) target.classList.remove("d-none");
}

function switchTab(tab) {
  var isCust = tab === "cust";
  document.getElementById("tabCust").classList.toggle("active", isCust);
  document.getElementById("tabAdmin").classList.toggle("active", !isCust);
  document.getElementById("formCust").classList.toggle("d-none", !isCust);
  document.getElementById("formAdmin").classList.toggle("d-none", isCust);
  document.getElementById("pinErr").classList.add("d-none");
}

// LOKASI ANTI-BAJAK & LOGIN
function doLoginCustomer() {
  var inputName = document.getElementById("inpName").value.trim();
  var wa   = document.getElementById("inpWa").value.trim();
  
  if (!inputName) { showToast("Masukkan nama kamu dulu!", "error"); return; }
  if (!wa)   { showToast("Masukkan nomor WhatsApp kamu!", "error"); return; }

  if (db) {
    var waClean = cleanWa(wa);
    var ref = db.ref("customers/" + waClean);
    
    ref.once("value", function(snap) {
      var data = snap.val();
      var finalName = inputName; 
      
      if (data && data.name && data.name !== "Pelanggan VIP") {
        if (inputName.toLowerCase() !== data.name.toLowerCase()) {
          showToast("❌ Gagal masuk! Nama tidak sesuai dengan Nomor WA ini.", "error");
          return; 
        }
        finalName = data.name; 
      } else {
        ref.update({ name: inputName, wa: waClean });
      }

      currentUser = { name: finalName, wa: waClean };
      isAdmin = false;
      document.getElementById("greetUser").textContent = "Halo, " + finalName + "!";
      showPage("custApp");
      
      listenCustomerPoints(waClean);
    });
  }
}

function doLoginAdmin() {
  var pin = document.getElementById("inpPin").value;
  if (pin === ADMIN_PIN) {
    isAdmin = true; currentUser = null;
    showPage("adminPanel");
    if (db) { listenCustomersAdmin(); }
    document.getElementById("inpPin").value = "";
    document.getElementById("pinErr").classList.add("d-none");
  } else {
    document.getElementById("pinErr").classList.remove("d-none");
    document.getElementById("inpPin").value = "";
  }
}

function doLogout() {
  currentUser = null; isAdmin = false;
  showPage("loginPage");
  document.getElementById("inpName").value = "";
  document.getElementById("inpWa").value   = "";
}

function switchAdminTab(tab, btn) {
  document.querySelectorAll(".admin-tab").forEach(function(b){ b.classList.remove("active"); });
  btn.classList.add("active");
  var kasirEl     = document.getElementById("adminTabKasir");
  var customersEl = document.getElementById("adminTabCustomers");
  
  if (tab === "kasir") {
    kasirEl.classList.remove("d-none"); customersEl.classList.add("d-none");
  } else {
    kasirEl.classList.add("d-none"); customersEl.classList.remove("d-none");
    renderCustomerList();
  }
}

// KASIR & POIN
function prosesKasir() {
  var waRaw = document.getElementById("kasirWa").value.trim();
  var totalVal = document.getElementById("kasirTotal").value.trim();

  if (!db || !waRaw || !totalVal) { showToast("Data belum lengkap!", "warning"); return; }
  var wa = cleanWa(waRaw);
  var total = parseInt(totalVal, 10);

  if (total < 1000) return;
  var pts = calcPoints(total);

  var ref = db.ref("customers/" + wa);
  ref.transaction(function(current) {
    if (!current) return { name: "Pelanggan VIP", wa: wa, totalPoints: pts, totalOrders: 1, lastOrder: Date.now() };
    var newData = {
      name: current.name || "Pelanggan VIP", wa: wa,
      totalPoints: (current.totalPoints || 0) + pts,
      totalOrders: (current.totalOrders || 0) + 1,
      lastOrder: Date.now()
    };
    if (current.history) newData.history = current.history;
    return newData;
  }, function(error, committed) {
    if (committed && pts > 0) {
      db.ref("customers/" + wa + "/history").push({ type: "earn", spend: total, pts: pts, date: Date.now() });
      showToast("+" + pts + " Poin sukses terkirim ke " + wa, "success");
      document.getElementById("kasirWa").value = ""; document.getElementById("kasirTotal").value = "";
    }
  });
}

function calcPoints(total) {
  if (total < 1000) return 0;
  if (total <= 15500) return 1;
  return 2 + Math.floor((total - 16000) / 10000);
}

function prosesTukarPoin() {
  var waRaw = document.getElementById("redeemWa").value.trim();
  var ptsVal = document.getElementById("redeemPts").value.trim();
  var item = document.getElementById("redeemItem").value.trim();

  if (!db || !waRaw || !ptsVal || !item) { showToast("Data penukaran belum lengkap!", "warning"); return; }
  var wa = cleanWa(waRaw); var ptsToDeduct = parseInt(ptsVal, 10);

  var ref = db.ref("customers/" + wa);
  ref.once("value", function(snap) {
    var data = snap.val();
    if (!data) return;
    var currentPts = data.totalPoints || 0;
    if (currentPts < ptsToDeduct) { showToast("Poin tidak cukup!", "error"); return; }

    ref.update({ totalPoints: currentPts - ptsToDeduct }).then(function() {
      db.ref("customers/" + wa + "/history").push({ type: "redeem", pts: ptsToDeduct, item: item, date: Date.now() });
      showToast("Berhasil menukar " + item, "success");
      document.getElementById("redeemWa").value = ""; document.getElementById("redeemPts").value = ""; document.getElementById("redeemItem").value = "";
    });
  });
}

// LOGIKA TIER SYSTEM SULTAN
function getTierInfo(pts) {
  if (pts >= 101) return { name: "PLATINUM", class: "tier-platinum", next: null, target: 0, badge: "bdg-platinum" };
  if (pts >= 51)  return { name: "GOLD", class: "tier-gold", next: "PLATINUM", target: 101, badge: "bdg-gold" };
  if (pts >= 21)  return { name: "SILVER", class: "tier-silver", next: "GOLD", target: 51, badge: "bdg-silver" };
  return { name: "CLASSIC", class: "tier-classic", next: "SILVER", target: 21, badge: "bdg-classic" };
}

function listenCustomerPoints(wa) {
  if (!db || !wa) return;
  db.ref("customers/" + wa).on("value", function(snap) {
    var data = snap.val() || {};
    var pts = data.totalPoints || 0;
    
    // UPDATE KARTU MEMBER (WARNA & TIER)
    var tier = getTierInfo(pts);
    var cardEl = document.getElementById("memberCard");
    var badgeEl = document.getElementById("tierBadge");
    var progressEl = document.getElementById("tierProgress");
    var msgEl = document.getElementById("tierMsg");
    var ptsEl = document.getElementById("myPointsVal");

    if (ptsEl) ptsEl.textContent = pts;
    
    if (cardEl) {
      cardEl.className = "points-hero-card " + tier.class;
      badgeEl.innerHTML = "🏆 TIER: " + tier.name;
      
      if (tier.next) {
        var prevTarget = tier.name === "CLASSIC" ? 0 : (tier.name === "SILVER" ? 21 : 51);
        var progress = ((pts - prevTarget) / (tier.target - prevTarget)) * 100;
        progressEl.style.width = progress + "%";
        msgEl.innerHTML = "Butuh <b>" + (tier.target - pts) + " Poin</b> untuk naik ke " + tier.next;
      } else {
        progressEl.style.width = "100%";
        msgEl.innerHTML = "👑 Kamu adalah Pelanggan Sultan Tertinggi!";
      }
    }

    // RENDER HISTORY
    var histList = document.getElementById("historyList");
    if (histList) {
      var historyData = data.history || {};
      var historyArray = Object.values(historyData).sort(function(a,b) { return b.date - a.date; }); 

      if (historyArray.length === 0) {
        histList.innerHTML = '<div class="hist-empty">Belum ada riwayat transaksi.</div>';
      } else {
        histList.innerHTML = historyArray.slice(0, 10).map(function(h) { 
          var dateStr = new Date(h.date).toLocaleString('id-ID', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'});
          if (h.type === "earn") {
            return '<div class="hist-card earn"><div class="hist-icon">🛒</div><div class="hist-info"><div class="hist-title">Jajan Nyo-Nyor</div><div class="hist-date">' + dateStr + '</div></div><div class="hist-pts earn">+' + h.pts + '</div></div>';
          } else {
            return '<div class="hist-card redeem"><div class="hist-icon">🎁</div><div class="hist-info"><div class="hist-title">Tukar ' + h.item + '</div><div class="hist-date">' + dateStr + '</div></div><div class="hist-pts redeem">-' + h.pts + '</div></div>';
          }
        }).join("");
      }
    }
  });
}

function listenCustomersAdmin() {
  if (!db) return;
  db.ref("customers").on("value", function(snap) {
    var data = snap.val() || {};
    allCustomers = Object.values(data).sort(function(a,b){ return (b.totalPoints || 0) - (a.totalPoints || 0); });
    var custTab = document.getElementById("adminTabCustomers");
    if (custTab && !custTab.classList.contains("d-none")) renderCustomerList();
  });
}

function renderCustomerList() {
  var container = document.getElementById("customerList");
  if (!container) return;
  if (allCustomers.length === 0) { container.innerHTML = '<div class="empty-state">Belum ada data</div>'; return; }

  container.innerHTML = allCustomers.map(function(c, idx) {
    var pts = c.totalPoints || 0;
    var tier = getTierInfo(pts);
    var medal = idx === 0 ? "🥇" : (idx === 1 ? "🥈" : (idx === 2 ? "🥉" : (idx + 1) + "."));
    
    return '<div class="customer-card">' +
      '<div class="customer-rank">' + medal + '</div>' +
      '<div class="customer-info">' +
        '<div class="customer-name">' + (c.name || "—") + ' <span class="badge-tier ' + tier.badge + '">' + tier.name + '</span></div>' +
        '<div class="customer-meta">📱 ' + c.wa + ' · 🛒 ' + (c.totalOrders || 0) + ' jajan</div>' +
      '</div>' +
      '<div class="customer-pts-val">' + pts + '</div>' +
    '</div>';
  }).join("");
}

function fmtRp(n) { return Number(n).toLocaleString("id-ID"); }
function cleanWa(wa) { if (!wa) return ""; return wa.replace(/\D/g,"").replace(/^0/, "62"); }
function showToast(msg, type) {
  var box = document.getElementById("toastBox");
  var el = document.createElement("div");
  el.className = "toast " + (type || "info");
  var icon = type === "error" ? "❌" : (type === "success" ? "✅" : "ℹ️");
  el.innerHTML = '<span class="toast-icon">' + icon + '</span><span>' + msg + '</span>';
  box.appendChild(el);
  setTimeout(function() { el.style.animation = "toastOut .3s forwards"; setTimeout(function(){ el.remove(); }, 300); }, 3000);
}
