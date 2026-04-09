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

// ======================
// LOGIN CUSTOMER (UPDATE ANTI BAJAK)
// ======================
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
          showToast("Gagal masuk! Nama dan Nomor WA tidak cocok.", "error");
          return;
        }
        finalName = data.name;
      } else {
        ref.update({
          name: inputName,
          wa: waClean
        });
      }

      currentUser = { name: finalName, wa: waClean };
      isAdmin = false;
      document.getElementById("greetUser").textContent = "Halo, " + finalName + "! 👋";
      showPage("custApp");
      
      listenCustomerPoints(waClean);
      showToast("Selamat datang, " + finalName + "! 🎉", "success");
    });
  }
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
      return { name: "Pelanggan VIP", wa: wa, currentPoints: pts, totalPoints: pts, totalOrders: 1, lastOrder: Date.now() };
    }
    
    var newData = {
      name          : current.name || "Pelanggan VIP",
      wa            : wa,
      currentPoints : (current.currentPoints || 0) + pts,
      totalPoints   : (current.totalPoints   || 0) + pts,
      totalOrders   : (current.totalOrders   || 0) + 1,
      lastOrder     : Date.now()
    };
    
    if (current.history)        newData.history        = current.history;
    if (current.claimedSilver)  newData.claimedSilver  = true;
    if (current.claimedPlatinum)newData.claimedPlatinum= true;
    if (current.claimedGold)    newData.claimedGold    = true;
    
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
// PROSES TUKAR POIN ADMIN — potong currentPoints saja
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
    
    var currentPts = data.currentPoints || 0;
    if (currentPts < ptsToDeduct) { showToast("Gagal! Poin tidak cukup (Sisa: " + currentPts + " ⭐)", "error"); return; }

    ref.update({
      currentPoints: currentPts - ptsToDeduct
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
// KLAIM HADIAH KECIL (20pt / 35pt)
// Potong currentPoints saja, totalPoints TIDAK berubah
// ======================
function klaimHadiahKecil(pts, itemName) {
  if (!currentUser || !db) { showToast("Kamu harus login dulu!", "error"); return; }
  var wa = currentUser.wa;
  var ref = db.ref("customers/" + wa);

  ref.once("value", function(snap) {
    var data = snap.val();
    if (!data) { showToast("Data tidak ditemukan!", "error"); return; }
    var currPts = data.currentPoints || 0;
    if (currPts < pts) {
      showToast("Poin belum cukup! Butuh " + pts + " poin, kamu punya " + currPts + " poin.", "error");
      return;
    }
    ref.update({ currentPoints: currPts - pts }).then(function() {
      db.ref("customers/" + wa + "/history").push({
        type: "redeem", pts: pts, item: itemName, date: Date.now()
      });
      showToast("🎉 Yeay! Kamu klaim " + itemName + "! -" + pts + " Poin. Tunjukkan ke kasir!", "success");
    }).catch(function() {
      showToast("Gagal klaim hadiah, coba lagi!", "error");
    });
  });
}

// ======================
// KLAIM HADIAH TIER (Silver / Platinum / Gold)
// Silver & Platinum: hanya mark claimed, totalPoints TIDAK berubah
// Gold: mark + RESET semua (1 siklus selesai)
// ======================
function klaimTier(tier) {
  if (!currentUser || !db) { showToast("Kamu harus login dulu!", "error"); return; }
  var wa = currentUser.wa;
  var ref = db.ref("customers/" + wa);

  var tierConfig = {
    silver   : { minPts: 150, field: "claimedSilver",   prize: "2 Porsi Seblak Paketan 15k" },
    platinum : { minPts: 225, field: "claimedPlatinum", prize: "2 Porsi Seblak Paketan 20k" },
    gold     : { minPts: 350, field: "claimedGold",     prize: "THR Ramadhan" }
  };
  var cfg = tierConfig[tier];
  if (!cfg) return;

  ref.once("value", function(snap) {
    var data = snap.val();
    if (!data) { showToast("Data tidak ditemukan!", "error"); return; }

    var totalPts = data.totalPoints || 0;
    if (totalPts < cfg.minPts) { showToast("Total poin belum cukup! Butuh " + cfg.minPts + " total poin.", "error"); return; }
    if (data[cfg.field]) { showToast("Kamu sudah pernah klaim hadiah " + tier.toUpperCase() + "!", "warning"); return; }
    if (tier === "gold" && !isRamadhan()) { showToast("Hadiah Gold hanya bisa diklaim saat Ramadhan! 🌙", "warning"); return; }

    var updates = {};
    updates[cfg.field] = true;

    if (tier === "gold") {
      updates.totalPoints      = 0;
      updates.claimedSilver    = false;
      updates.claimedPlatinum  = false;
      updates.claimedGold      = false;
    }

    ref.update(updates).then(function() {
      db.ref("customers/" + wa + "/history").push({
        type: "redeem", pts: cfg.minPts,
        item: "Hadiah Tier " + tier.toUpperCase() + ": " + cfg.prize,
        date: Date.now()
      });
      if (tier === "gold") {
        showToast("🎊 Selamat! THR Ramadhan diklaim! Total poin di-reset untuk siklus baru.", "success");
      } else {
        showToast("🎉 Selamat! Kamu klaim " + cfg.prize + "! 🍜 Tunjukkan ke kasir ya!", "success");
      }
    }).catch(function() {
      showToast("Gagal klaim hadiah tier, coba lagi!", "error");
    });
  });
}

// ======================
// CEK BULAN RAMADHAN
// ======================
function isRamadhan() {
  var now = new Date();
  var ramadhanDates = [
    { start: new Date(2025,  2,  1), end: new Date(2025,  2, 30) },
    { start: new Date(2026,  1, 18), end: new Date(2026,  2, 19) },
    { start: new Date(2027,  1,  7), end: new Date(2027,  2,  8) },
    { start: new Date(2028,  0, 27), end: new Date(2028,  1, 25) }
  ];
  return ramadhanDates.some(function(r) { return now >= r.start && now <= r.end; });
}

// ======================
// UPDATE STATUS TOMBOL KLAIM
// ======================
function updateClaimButtons(currPts, totalPts, data) {
  var btn20   = document.getElementById("btnKlaim20");
  var btn35   = document.getElementById("btnKlaim35");
  var btnS    = document.getElementById("btnKlaimSilver");
  var btnP    = document.getElementById("btnKlaimPlatinum");
  var btnG    = document.getElementById("btnKlaimGold");
  var cardS   = document.getElementById("cardSilver");
  var cardP   = document.getElementById("cardPlatinum");
  var cardG   = document.getElementById("cardGold");
  var ramadhan = isRamadhan();

  if (btn20) btn20.disabled = currPts < 20;
  if (btn35) btn35.disabled = currPts < 35;

  if (btnS) {
    btnS.disabled    = totalPts < 150 || !!data.claimedSilver;
    btnS.textContent = data.claimedSilver ? "✅ Diklaim" : "Klaim";
  }
  if (cardS) {
    cardS.classList.toggle("tier-claim-unlocked", totalPts >= 150);
    cardS.classList.toggle("tier-claim-done", !!data.claimedSilver);
  }

  if (btnP) {
    btnP.disabled    = totalPts < 225 || !!data.claimedPlatinum;
    btnP.textContent = data.claimedPlatinum ? "✅ Diklaim" : "Klaim";
  }
  if (cardP) {
    cardP.classList.toggle("tier-claim-unlocked", totalPts >= 225);
    cardP.classList.toggle("tier-claim-done", !!data.claimedPlatinum);
  }

  if (btnG) {
    btnG.disabled = totalPts < 350 || !!data.claimedGold || !ramadhan;
    if (data.claimedGold)   btnG.textContent = "✅ Diklaim";
    else if (!ramadhan)     btnG.textContent = "🌙 Saat Ramadhan";
    else                    btnG.textContent = "Klaim";
  }
  if (cardG) {
    cardG.classList.toggle("tier-claim-unlocked", totalPts >= 350 && ramadhan);
    cardG.classList.toggle("tier-claim-done", !!data.claimedGold);
  }
}

// ======================
// LOGIKA TIER — Classic<150 | Silver 150 | Platinum 225 | Gold 350
// ======================
function getTierInfo(totalPts) {
  if (totalPts >= 350) return { name:"GOLD",     class:"tier-gold",     next:null,       target:350, prevTarget:225, badge:"bdg-gold"     };
  if (totalPts >= 225) return { name:"PLATINUM", class:"tier-platinum", next:"GOLD",     target:350, prevTarget:150, badge:"bdg-platinum" };
  if (totalPts >= 150) return { name:"SILVER",   class:"tier-silver",   next:"PLATINUM", target:225, prevTarget:0,   badge:"bdg-silver"   };
  return                      { name:"CLASSIC",  class:"tier-classic",  next:"SILVER",   target:150, prevTarget:0,   badge:"bdg-classic"  };
}

// ======================
// TAMPILAN CUSTOMER (CEK POIN & RIWAYAT)
// ======================
function listenCustomerPoints(wa) {
  if (!db || !wa) return;
  db.ref("customers/" + wa).on("value", function(snap) {
    var data     = snap.val() || {};
    var currPts  = data.currentPoints || 0;
    var totalPts = data.totalPoints   || 0;
    var orders   = data.totalOrders   || 0;
    var tier     = getTierInfo(totalPts);

    var currPtEl   = document.getElementById("myCurrentPointsVal");
    var totalPtEl  = document.getElementById("myPointsVal");
    var subEl      = document.getElementById("myPointsSub");
    var ordEl      = document.getElementById("myTotalOrders");
    var histList   = document.getElementById("historyList");
    var cardEl     = document.getElementById("memberCard");
    var badgeEl    = document.getElementById("tierBadge");
    var progressEl = document.getElementById("tierProgress");
    var msgEl      = document.getElementById("tierMsg");

    if (currPtEl)  currPtEl.textContent  = currPts;
    if (totalPtEl) totalPtEl.textContent = totalPts;
    if (ordEl)     ordEl.textContent     = orders;

    if (subEl) {
      if (currPts === 0)    subEl.textContent = "Belum ada poin. Yuk jajan ke toko!";
      else if (currPts < 20) subEl.textContent = "Kumpulin terus, sebentar lagi bisa klaim! 🔥";
      else if (currPts < 35) subEl.textContent = "Udah " + currPts + " poin! Buruan klaim boba! 🧋";
      else                   subEl.textContent = "Wah " + currPts + " poin! Sultan banget nih! 🌶️👑";
    }

    if (cardEl)  cardEl.className       = "points-hero-card " + tier.class;
    if (badgeEl) badgeEl.innerHTML      = "🏆 TIER: " + tier.name;

    if (progressEl && msgEl) {
      if (tier.next) {
        var progress = ((totalPts - tier.prevTarget) / (tier.target - tier.prevTarget)) * 100;
        progressEl.style.width = Math.min(100, Math.max(0, progress)) + "%";
        msgEl.innerHTML = "Butuh <b>" + (tier.target - totalPts) + " Total Poin</b> lagi untuk naik ke " + tier.next;
      } else {
        progressEl.style.width = "100%";
        msgEl.innerHTML = "👑 Kamu Pelanggan Sultan! Klaim THR saat Ramadhan!";
      }
    }

    updateClaimButtons(currPts, totalPts, data);

    if (histList) {
      var historyData  = data.history || {};
      var historyArray = Object.values(historyData).sort(function(a,b) { return b.date - a.date; });

      if (historyArray.length === 0) {
        histList.innerHTML = '<div class="hist-empty">Belum ada riwayat transaksi.</div>';
      } else {
        histList.innerHTML = historyArray.slice(0, 10).map(function(h) {
          var isEarn  = h.type === "earn";
          var dateStr = new Date(h.date).toLocaleString("id-ID", {day:"numeric",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"});
          if (isEarn) {
            return '<div class="hist-card earn"><div class="hist-icon">🛒</div><div class="hist-info"><div class="hist-title">Jajan Seblak (Rp ' + fmtRp(h.spend) + ')</div><div class="hist-date">' + dateStr + '</div></div><div class="hist-pts earn">+' + h.pts + '</div></div>';
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

  if (allCustomers.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">⭐</div><p>Belum ada data</p></div>';
    return;
  }

  var MEDALS = ["🥇","🥈","🥉"];
  container.innerHTML = allCustomers.map(function(c, idx) {
    var totalPts = c.totalPoints   || 0;
    var currPts  = c.currentPoints || 0;
    var tier     = getTierInfo(totalPts);
    var medal    = idx < 3 ? MEDALS[idx] : (idx + 1) + ".";
    var orders   = c.totalOrders || 0;
    var lastDt   = c.lastOrder ? new Date(c.lastOrder).toLocaleDateString("id-ID") : "-";
    var barW     = allCustomers[0] && allCustomers[0].totalPoints ? Math.round((totalPts / allCustomers[0].totalPoints) * 100) : 100;

    return '<div class="customer-card' + (idx < 3 ? " top-customer" : "") + '">' +
      '<div class="customer-rank">' + medal + '</div>' +
      '<div class="customer-info">' +
        '<div class="customer-name">' + (c.name || "—") + ' <span class="badge-tier ' + tier.badge + '">' + tier.name + '</span></div>' +
        '<div class="customer-wa">📱 ' + c.wa + '</div>' +
        '<div class="customer-meta">⭐ ' + currPts + ' poin · 📊 ' + totalPts + ' total · 🛒 ' + orders + ' jajan · 📅 ' + lastDt + '</div>' +
        '<div class="customer-bar-wrap"><div class="customer-bar" style="width:' + barW + '%"></div></div>' +
      '</div>' +
      '<div class="customer-pts"><div class="customer-pts-val">' + totalPts + '</div><div class="customer-pts-lbl">total poin</div></div>' +
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
