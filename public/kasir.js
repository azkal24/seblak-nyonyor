/* ================================================
   SEBLAK NYO-NYOR — POS & Loyalty System
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
  try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
  } catch(e) {
    console.error("Firebase init error:", e);
  }

  setTimeout(function() {
    var splash = document.getElementById("splashScreen");
    splash.classList.add("hide");
    setTimeout(function() {
      splash.style.display = "none";
      showPage("loginPage");
    }, 500);
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

function doLoginCustomer() {
  var name = document.getElementById("inpName").value.trim();
  var wa   = document.getElementById("inpWa").value.trim();
  if (!name) { showToast("Masukkan nama kamu dulu!", "error"); return; }
  if (!wa)   { showToast("Masukkan nomor WhatsApp kamu!", "error"); return; }

  currentUser = { name: name, wa: wa };
  isAdmin = false;
  document.getElementById("greetUser").textContent = "Halo, " + name + "! 👋";
  showPage("custApp");

  if (db) {
    var waClean = cleanWa(wa);
    db.ref("customers/" + waClean).update({
      name: name,
      wa: waClean
    });
    listenCustomerPoints(waClean);
  }
  showToast("Selamat datang, " + name + "! 🎉", "success");
}

function doLoginAdmin() {
  var pin = document.getElementById("inpPin").value;
  if (pin === ADMIN_PIN) {
    isAdmin = true;
    currentUser = null;
    showPage("adminPanel");
    if (db) { listenCustomersAdmin(); }
    document.getElementById("inpPin").value = "";
    document.getElementById("pinErr").classList.add("d-none");
    showToast("Login Kasir Berhasil! 🔐", "success");
  } else {
    document.getElementById("pinErr").classList.remove("d-none");
    document.getElementById("inpPin").value = "";
  }
}

function doLogout() {
  currentUser = null;
  isAdmin     = false;
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
    kasirEl.classList.remove("d-none");
    customersEl.classList.add("d-none");
  } else {
    kasirEl.classList.add("d-none");
    customersEl.classList.remove("d-none");
    renderCustomerList();
  }
}

// ======================
// PROSES KASIR (KIRIM POIN)
// ======================
function prosesKasir() {
  var waRaw    = document.getElementById("kasirWa").value.trim();
  var totalVal = document.getElementById("kasirTotal").value.trim();

  if (!db) { showToast("Firebase belum terkoneksi!", "error"); return; }
  if (!waRaw) { showToast("Nomor WA wajib diisi!", "warning"); return; }
  if (!totalVal) { showToast("Total belanja wajib diisi!", "warning"); return; }

  var wa    = cleanWa(waRaw);
  var total = parseInt(totalVal, 10);

  if (total < 1000 || total > 200000) { showToast("Total belanja harus antara Rp 1.000 - Rp 200.000", "warning"); return; }
  if (total % 500 !== 0) { showToast("Gagal! Nominal harus kelipatan 500 ya", "warning"); return; }

  var pts = calcPoints(total);

  if (pts === 0) {
    showToast("Transaksi Rp " + fmtRp(total) + " sukses, tapi belum dapat poin.", "info");
    db.ref("customers/" + wa + "/history").push({
      type: "earn", spend: total, pts: 0, date: Date.now()
    });
    resetFormKasir();
    return;
  }

  var ref = db.ref("customers/" + wa);
  ref.transaction(function(current) {
    if (!current) {
      return { name: "Pelanggan VIP", wa: wa, totalPoints: pts, totalOrders: 1, lastOrder: Date.now() };
    }
    
    // FIX: Cegah error undefined dari Firebase
    var newData = {
      name       : current.name || "Pelanggan VIP",
      wa         : wa,
      totalPoints: (current.totalPoints || 0) + pts,
      totalOrders: (current.totalOrders || 0) + 1,
      lastOrder  : Date.now()
    };
    
    if (current.history) {
      newData.history = current.history; // Masukin history lama cuma kalau emang ada isinya
    }
    
    return newData;

  }, function(error, committed) {
    if (error) { 
      console.error(error);
      showToast("Gagal mengirim poin!", "error"); 
    } 
    else if (committed) {
      db.ref("customers/" + wa + "/history").push({
        type: "earn",
        spend: total,
        pts: pts,
        date: Date.now()
      });
      showToast("Berhasil! +" + pts + " Poin terkirim ke " + wa, "success");
      resetFormKasir();
    }
  });
}

function resetFormKasir() {
  document.getElementById("kasirWa").value = "";
  document.getElementById("kasirTotal").value = "";
}

function calcPoints(total) {
  if (total < 1000) return 0;
  if (total <= 15500) return 1;
  return 2 + Math.floor((total - 16000) / 10000);
}

// ======================
// PROSES TUKAR POIN (POTONG)
// ======================
function prosesTukarPoin() {
  var waRaw  = document.getElementById("redeemWa").value.trim();
  var ptsVal = document.getElementById("redeemPts").value.trim();
  var item   = document.getElementById("redeemItem").value.trim();

  if (!db) return;
  if (!waRaw || !ptsVal || !item) { showToast("Semua kolom (WA, Poin, Barang Tukar) wajib diisi!", "warning"); return; }

  var wa = cleanWa(waRaw);
  var ptsToDeduct = parseInt(ptsVal, 10);

  if (ptsToDeduct <= 0) { showToast("Jumlah poin harus lebih dari 0!", "warning"); return; }

  var ref = db.ref("customers/" + wa);
  ref.once("value", function(snap) {
    var data = snap.val();
    if (!data) { showToast("Pelanggan tidak ditemukan.", "error"); return; }
    
    var currentPts = data.totalPoints || 0;
    if (currentPts < ptsToDeduct) { showToast("Gagal! Poin tidak cukup (Sisa: " + currentPts + " ⭐)", "error"); return; }

    ref.update({
      totalPoints: currentPts - ptsToDeduct
    }).then(function() {
      db.ref("customers/" + wa + "/history").push({
        type: "redeem",
        pts: ptsToDeduct,
        item: item,
        date: Date.now()
      });
      showToast("Berhasil potong " + ptsToDeduct + " poin buat " + item, "success");
      document.getElementById("redeemWa").value = "";
      document.getElementById("redeemPts").value = "";
      document.getElementById("redeemItem").value = "";
    }).catch(function(err) { showToast("Gagal memotong poin dari server!", "error"); });
  });
}

// ======================
// TAMPILAN CUSTOMER (CEK POIN & RIWAYAT)
// ======================
function listenCustomerPoints(wa) {
  if (!db || !wa) return;
  db.ref("customers/" + wa).on("value", function(snap) {
    var data  = snap.val() || {};
    var pts   = data.totalPoints || 0;
    var total = data.totalOrders || 0;

    var ptEl  = document.getElementById("myPointsVal");
    var subEl = document.getElementById("myPointsSub");
    var ordEl = document.getElementById("myTotalOrders");
    var histList = document.getElementById("historyList");
    
    if (ptEl)  ptEl.textContent  = pts;
    if (ordEl) ordEl.textContent = total;
    if (subEl) {
      if (pts === 0) subEl.textContent = "Belum ada poin. Yuk jajan ke toko!";
      else if (pts < 5)  subEl.textContent = "Terus semangat jajan, poin bertambah! 🔥";
      else if (pts < 10) subEl.textContent = "Wah, udah " + pts + " poin! Pelanggan setia nih 😍";
      else               subEl.textContent = "Luar biasa! " + pts + " poin — VIP Nyo-Nyor! 🌶️👑";
    }

    if (histList) {
      var historyData = data.history || {};
      var historyArray = Object.values(historyData).sort(function(a,b) { return b.date - a.date; }); 

      if (historyArray.length === 0) {
        histList.innerHTML = '<div class="hist-empty">Belum ada riwayat transaksi.</div>';
      } else {
        histList.innerHTML = historyArray.slice(0, 10).map(function(h) { 
          var isEarn = h.type === "earn";
          var dateStr = new Date(h.date).toLocaleString('id-ID', {day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit'});
          
          if (isEarn) {
            return '<div class="hist-card earn">' +
                     '<div class="hist-icon">🛒</div>' +
                     '<div class="hist-info">' +
                       '<div class="hist-title">Jajan Seblak (Rp ' + fmtRp(h.spend) + ')</div>' +
                       '<div class="hist-date">' + dateStr + '</div>' +
                     '</div>' +
                     '<div class="hist-pts earn">+' + h.pts + '</div>' +
                   '</div>';
          } else {
            return '<div class="hist-card redeem">' +
                     '<div class="hist-icon">🎁</div>' +
                     '<div class="hist-info">' +
                       '<div class="hist-title">Tukar ' + h.item + '</div>' +
                       '<div class="hist-date">' + dateStr + '</div>' +
                     '</div>' +
                     '<div class="hist-pts redeem">-' + h.pts + '</div>' +
                   '</div>';
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

  if (allCustomers.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">⭐</div><p>Belum ada data</p></div>';
    return;
  }

  var MEDALS = ["🥇","🥈","🥉"];
  container.innerHTML = allCustomers.map(function(c, idx) {
    var medal   = idx < 3 ? MEDALS[idx] : (idx + 1) + ".";
    var pts     = c.totalPoints  || 0;
    var orders  = c.totalOrders  || 0;
    var lastDt  = c.lastOrder ? new Date(c.lastOrder).toLocaleDateString("id-ID") : "-";
    var barW    = allCustomers[0] && allCustomers[0].totalPoints ? Math.round((pts / allCustomers[0].totalPoints) * 100) : 100;

    return '<div class="customer-card' + (idx < 3 ? " top-customer" : "") + '">' +
      '<div class="customer-rank">' + medal + '</div>' +
      '<div class="customer-info">' +
        '<div class="customer-name">' + (c.name || "—") + '</div>' +
        '<div class="customer-wa">📱 ' + c.wa + '</div>' +
        '<div class="customer-meta">🛒 ' + orders + ' jajan · 📅 Terakhir: ' + lastDt + '</div>' +
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

function fmtRp(n) { return Number(n).toLocaleString("id-ID"); }
function cleanWa(wa) { if (!wa) return ""; return wa.replace(/\D/g,"").replace(/^0/, "62"); }

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
