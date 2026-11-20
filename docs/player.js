import {
  db, ref, update, onValue,
  ROOT, ITEMS, ITEM, $, distM, fmtDist, esc, placedItems, toast, requireConfig, requireSecure,
} from "./common.js";

const LS = "hamster_player_v2";

let pid, myName;
let meta = { radius: 15 };
let spots = {};
let me = { found: {} };
let pos = null;
let lastTarget = null; // { id, d }
let lastUpload = 0;
let allDoneShown = false;

function init() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(LS) || "null"); } catch {}
  if (!saved?.pid) {
    saved = {
      pid: "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      name: "鼠鼠" + Math.floor(100 + Math.random() * 900),
    };
    try { localStorage.setItem(LS, JSON.stringify(saved)); } catch {}
  }
  pid = saved.pid;
  myName = saved.name;
  $("#meName").textContent = myName;

  $("#nameBox").onclick = rename;
  $("#findBtn").onclick = tryFind;
  document.querySelectorAll("[data-close]").forEach((b) =>
    b.addEventListener("click", () => $("#revealSheet").classList.add("hidden")));

  update(ref(db, `${ROOT}/players/${pid}`), { name: myName, joinedAt: Date.now() }).catch(() => {});

  onValue(ref(db, `${ROOT}/meta`), (s) => { meta = s.val() || { radius: 15 }; render(); });
  onValue(ref(db, `${ROOT}/spots`), (s) => { spots = s.val() || {}; render(); });
  onValue(ref(db, `${ROOT}/players/${pid}`), (s) => {
    if (!s.exists()) {
      // 主持人清空了進度 → 重新登記
      me = { found: {} };
      allDoneShown = false;
      update(ref(db, `${ROOT}/players/${pid}`), { name: myName, joinedAt: Date.now() }).catch(() => {});
    } else {
      me = s.val();
      me.found = me.found || {};
    }
    render();
  });

  startGps();
  keepAwake();
  render();
}

function rename() {
  const n = prompt("你的暱稱", myName);
  if (!n || !n.trim()) return;
  myName = n.trim().slice(0, 16);
  $("#meName").textContent = myName;
  try { localStorage.setItem(LS, JSON.stringify({ pid, name: myName })); } catch {}
  update(ref(db, `${ROOT}/players/${pid}`), { name: myName }).catch(() => {});
}

/* ---------------- GPS ---------------- */
function startGps() {
  if (!requireSecure()) {
    $("#tempLbl").textContent = "此網址無法使用 GPS（需要 https）";
    return;
  }
  navigator.geolocation.watchPosition(
    (p) => {
      pos = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy };
      render();
      const now = Date.now();
      if (now - lastUpload > 5000) {
        lastUpload = now;
        update(ref(db, `${ROOT}/players/${pid}`), {
          lat: pos.lat, lng: pos.lng, acc: Math.round(pos.acc), updatedAt: now,
        }).catch(() => {});
      }
    },
    (err) => {
      const msg = err.code === 1
        ? "定位權限被拒絕，請到瀏覽器設定允許此網站使用位置"
        : "暫時抓不到 GPS，請到空曠處試試";
      $("#tempLbl").textContent = msg;
      toast(msg, 4000);
    },
    { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 },
  );
}

async function keepAwake() {
  try { if ("wakeLock" in navigator) await navigator.wakeLock.request("screen"); } catch {}
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") keepAwake();
});
// iOS 等需要使用者點擊後才能鎖定螢幕常亮
document.addEventListener("click", keepAwake, { once: true });

/* ---------------- 畫面 ---------------- */
function nearestUnfound() {
  if (!pos) return null;
  let best = null;
  placedItems(spots).forEach((it) => {
    if (me.found?.[it.id]) return;
    const d = distM(pos, it);
    if (!best || d < best.d) best = { ...it, d };
  });
  return best;
}

function canFind(t) {
  if (!t || !pos) return false;
  // 允許一點 GPS 誤差補償（最多 10 公尺）
  return t.d - Math.min(pos.acc, 20) * 0.5 <= (meta.radius || 15);
}

function level(d) {
  const r = meta.radius || 15;
  if (d > 300) return [0, "🧊 冰天雪地"];
  if (d > 120) return [1, "❄️ 有點冷"];
  if (d > 50) return [2, "🌤️ 溫溫的"];
  if (d > Math.max(r * 2, 25)) return [3, "🔥 很熱了！"];
  return [4, "🌋 超級燙！就在附近！"];
}

function render() {
  const placed = placedItems(spots);
  const total = placed.length;
  const n = placed.filter((it) => me.found?.[it.id]).length;
  $("#foundN").textContent = n;
  $("#totalN").textContent = total || 4;
  $("#progBar").style.width = total ? `${(n / total) * 100}%` : "0";

  // 收藏：四格，找到的亮起
  $("#bagItems").innerHTML = ITEMS.map((it) => {
    const got = !!me.found?.[it.id];
    return `<div class="bag-slot ${got ? "got" : ""}" data-id="${it.id}">
      <div class="ico">${it.icon}</div><div class="nm">${got ? esc(it.name) : "？？？"}</div></div>`;
  }).join("");
  $("#bagItems").querySelectorAll(".bag-slot.got").forEach((el) =>
    (el.onclick = () => showReveal(el.dataset.id, true)));

  const btn = $("#findBtn");
  $("#accLbl").textContent = pos ? `GPS 誤差 ±${Math.round(pos.acc)} 公尺` : "";

  if (!total) {
    setRadar(0, "", "--", "", "主持人還在藏寶物，請稍候…", "");
    btn.disabled = true;
    return;
  }
  if (n >= total) {
    setRadar(4, "", "🏆", "", "全部找到了！", "你找到了內心的倉鼠 🐹💛");
    btn.disabled = true;
    btn.textContent = "🎉 任務完成";
    if (!allDoneShown && total >= 4) { allDoneShown = true; confetti(); }
    return;
  }
  btn.textContent = "🔍 我找到了！";
  if (!pos) {
    setRadar(0, "離最近的寶物還有", "--", "", "取得定位中…", "");
    btn.disabled = true;
    return;
  }

  const t = nearestUnfound();
  const { num, unit } = fmtDist(t.d);
  const [lv, label] = level(t.d);

  let trend = $("#trendLbl").textContent;
  if (!lastTarget || lastTarget.id !== t.id) {
    trend = "";
    lastTarget = { id: t.id, d: t.d };
  } else if (Math.abs(t.d - lastTarget.d) >= 3) {
    trend = t.d < lastTarget.d ? "⬆️ 越來越近了！" : "⬇️ 越走越遠了…";
    lastTarget.d = t.d;
  }

  const ok = canFind(t);
  setRadar(lv, "離最近的寶物還有", num, unit, ok ? "✨ 就是這裡！按下面的按鈕！" : label, trend);
  btn.disabled = !ok;
}

function setRadar(lv, lbl, num, unit, temp, trend) {
  $("#radar").className = `radar lv${lv}`;
  $("#radarLbl").textContent = lbl;
  $("#distNum").textContent = num;
  $("#distUnit").textContent = unit;
  $("#tempLbl").textContent = temp;
  $("#trendLbl").textContent = trend;
}

/* ---------------- 找到 ---------------- */
async function tryFind() {
  const t = nearestUnfound();
  if (!canFind(t)) return toast("還不夠近喔，再找找看！");
  $("#findBtn").disabled = true;
  try {
    await update(ref(db, `${ROOT}/players/${pid}/found`), { [t.id]: Date.now() });
    try { navigator.vibrate?.([80, 40, 160]); } catch {}
    showReveal(t.id, false);
    confetti();
  } catch (e) {
    toast("送出失敗：" + e.message, 4000);
    $("#findBtn").disabled = false;
  }
}

function showReveal(id, again) {
  const it = ITEM[id];
  if (!it) return;
  $("#revealIco").innerHTML = it.icon;
  $("#revealSub").textContent = again ? "我的收藏" : "🎉 恭喜！你找到了";
  $("#revealName").textContent = it.name;
  $("#revealTag").textContent = it.sub ? `（${it.sub}）` : "";
  $("#revealMeaning").textContent = it.meaning;
  $("#revealQuestion").textContent = it.question;
  $("#revealSheet").classList.remove("hidden");
  $("#revealSheet .sheet").scrollTop = 0;
}

function confetti() {
  const pool = ["🌻", "🐹", "✨", "🥜", "💛", "🎉"];
  for (let i = 0; i < 28; i++) {
    const el = document.createElement("div");
    el.className = "confetti";
    el.textContent = pool[i % pool.length];
    el.style.left = Math.random() * 100 + "vw";
    el.style.animationDuration = 1.8 + Math.random() * 1.8 + "s";
    el.style.animationDelay = Math.random() * 0.5 + "s";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4500);
  }
}

if (requireConfig()) init();
