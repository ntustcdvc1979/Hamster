import {
  db, ref, set, update, onValue, get, push,
  $, distM, fmtDist, esc, sortedSpots, toast, requireConfig, requireSecure,
} from "./common.js";

const LS = "hamster_player";
const EMOJIS = ["🌻", "🥜", "🧀", "🍓", "🌰", "🍎", "🥕", "🌽", "⭐", "💛"];

let code, pid, myName;
let meta = { radius: 15 };
let spots = {};
let me = { found: {} };
let pos = null;
let lastTarget = null; // { id, d }
let lastUpload = 0;
let watchId = null;
let unsubs = [];
let allDoneShown = false;

function init() {
  const params = new URLSearchParams(location.search);
  const urlRoom = (params.get("room") || "").toUpperCase();
  const saved = JSON.parse(localStorage.getItem(LS) || "null");

  $("#codeInput").value = urlRoom || saved?.code || "";
  $("#nameInput").value = saved?.name || "";
  $("#joinBtn").onclick = join;
  $("#nameInput").addEventListener("keydown", (e) => e.key === "Enter" && join());

  $("#findBtn").onclick = tryFind;
  document.querySelectorAll("[data-close]").forEach((b) =>
    b.addEventListener("click", () => $("#revealSheet").classList.add("hidden")));
  $(".p-head").addEventListener("click", () => {
    if (confirm("要離開這場遊戲嗎？（進度會保留，之後用同一支手機再加入就能繼續）")) {
      localStorage.removeItem(LS);
      location.href = "player.html";
    }
  });

  // 同一場遊戲自動重新加入
  if (saved && saved.pid && (!urlRoom || urlRoom === saved.code)) join();
}

async function join() {
  const c = $("#codeInput").value.trim().toUpperCase();
  const name = $("#nameInput").value.trim();
  if (!/^[A-Z0-9]{4}$/.test(c)) return toast("請輸入 4 碼遊戲代碼");
  if (!name) return toast("請輸入暱稱");
  $("#joinBtn").disabled = true;
  try {
    const snap = await get(ref(db, `rooms/${c}/meta`));
    if (!snap.exists()) { toast("找不到這個遊戲，請確認代碼"); return; }
    const saved = JSON.parse(localStorage.getItem(LS) || "null");
    pid = saved && saved.code === c && saved.pid ? saved.pid : push(ref(db, `rooms/${c}/players`)).key;
    code = c;
    myName = name;
    await update(ref(db, `rooms/${c}/players/${pid}`), { name, joinedAt: Date.now() });
    localStorage.setItem(LS, JSON.stringify({ code, pid, name }));
    start();
  } catch (e) {
    console.error(e);
    toast("連線失敗：" + e.message, 5000);
  } finally {
    $("#joinBtn").disabled = false;
  }
}

function start() {
  $("#joinScreen").classList.add("hidden");
  $("#gameScreen").classList.remove("hidden");
  $("#meName").textContent = myName;
  $("#roomLabel").textContent = `遊戲 ${code}`;

  unsubs.forEach((u) => u());
  unsubs = [
    onValue(ref(db, `rooms/${code}/meta`), (s) => {
      if (!s.exists()) {
        localStorage.removeItem(LS);
        alert("這場遊戲已被主持人刪除");
        location.href = "player.html";
        return;
      }
      meta = s.val();
      $("#roomLabel").textContent = `${meta.name || ""} · ${code}`;
      render();
    }),
    onValue(ref(db, `rooms/${code}/spots`), (s) => { spots = s.val() || {}; render(); }),
    onValue(ref(db, `rooms/${code}/players/${pid}`), (s) => {
      if (!s.exists()) {
        // 主持人清空了進度 → 重新登記
        me = { found: {} };
        allDoneShown = false;
        update(ref(db, `rooms/${code}/players/${pid}`), { name: myName, joinedAt: Date.now() });
      } else {
        me = s.val();
        me.found = me.found || {};
      }
      render();
    }),
  ];

  startGps();
  keepAwake();
}

/* ---------------- GPS ---------------- */
function startGps() {
  if (!requireSecure()) {
    $("#tempLbl").textContent = "此網址無法使用 GPS（需要 https）";
    return;
  }
  if (watchId != null) navigator.geolocation.clearWatch(watchId);
  watchId = navigator.geolocation.watchPosition(
    (p) => {
      pos = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy };
      render();
      const now = Date.now();
      if (now - lastUpload > 5000) {
        lastUpload = now;
        update(ref(db, `rooms/${code}/players/${pid}`), {
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

let wakeLock = null;
async function keepAwake() {
  try {
    if ("wakeLock" in navigator) wakeLock = await navigator.wakeLock.request("screen");
  } catch {}
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && code) keepAwake();
});

/* ---------------- 畫面 ---------------- */
function nearestUnfound() {
  if (!pos) return null;
  let best = null;
  sortedSpots(spots).forEach((s) => {
    if (me.found?.[s.id]) return;
    const d = distM(pos, s);
    if (!best || d < best.d) best = { ...s, d };
  });
  return best;
}

function canFind(t) {
  if (!t || !pos) return false;
  const radius = meta.radius || 15;
  // 允許一點 GPS 誤差補償（最多 10 公尺）
  return t.d - Math.min(pos.acc, 20) * 0.5 <= radius;
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
  const list = sortedSpots(spots);
  const total = list.length;
  const foundIds = list.filter((s) => me.found?.[s.id]).map((s) => s.id);
  const n = foundIds.length;
  $("#foundN").textContent = n;
  $("#totalN").textContent = total;
  $("#progBar").style.width = total ? `${(n / total) * 100}%` : "0";

  // 背包
  $("#bagItems").innerHTML = n
    ? list.filter((s) => me.found[s.id]).map((s) =>
        `<span class="bag-chip" data-id="${s.id}">${emojiFor(s.id)} ${esc(s.item)}</span>`).join("")
    : `<span class="muted">還沒有找到任何東西</span>`;
  $("#bagItems").querySelectorAll(".bag-chip").forEach((el) =>
    (el.onclick = () => showReveal(el.dataset.id, true)));

  const radar = $("#radar");
  const btn = $("#findBtn");
  $("#accLbl").textContent = pos ? `GPS 誤差 ±${Math.round(pos.acc)} 公尺` : "";

  if (!total) {
    setRadar(radar, 0, "", "--", "", "主持人還在藏倉鼠，請稍候…", "");
    btn.disabled = true;
    return;
  }
  if (n >= total) {
    setRadar(radar, 4, "", "🏆", "", "全部找到了！", "你找到了內心的倉鼠 🐹💛");
    btn.disabled = true;
    btn.textContent = "🎉 任務完成";
    if (!allDoneShown) { allDoneShown = true; confetti(); }
    return;
  }
  btn.textContent = "🔍 我找到了！";
  if (!pos) {
    setRadar(radar, 0, "離最近的倉鼠還有", "--", "", "取得定位中…", "");
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
  setRadar(radar, lv, "離最近的倉鼠還有", num, unit, ok ? "✨ 就是這裡！按下面的按鈕！" : label, trend);
  btn.disabled = !ok;
}

function setRadar(el, lv, lbl, num, unit, temp, trend) {
  el.className = `radar lv${lv}`;
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
    await update(ref(db, `rooms/${code}/players/${pid}/found`), { [t.id]: Date.now() });
    if (navigator.vibrate) navigator.vibrate([80, 40, 160]);
    showReveal(t.id, false);
    confetti();
  } catch (e) {
    toast("送出失敗：" + e.message, 4000);
    $("#findBtn").disabled = false;
  }
}

function emojiFor(id) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return EMOJIS[h % EMOJIS.length];
}

function showReveal(id, again) {
  const s = spots[id];
  if (!s) return;
  $("#revealEmoji").textContent = emojiFor(id);
  $("#revealSub").textContent = again ? "你的收藏" : "🎉 恭喜！你找到了";
  $("#revealName").textContent = s.item || "神秘寶物";
  $("#revealDesc").textContent = s.desc || "（主持人沒有留下描述）";
  $("#revealDesc").classList.toggle("hidden", false);
  $("#revealSheet").classList.remove("hidden");
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
