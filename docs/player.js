import {
  db, ref, update, onValue,
  ROOT, ITEMS, mergeItems, heatLevel, TREND, $, distM, fmtDist, esc, toast, requireConfig, requireSecure,
} from "./common.js";
import { startRound, openWall, hasWall, COUNTDOWN_MS, DRAW_MS } from "./memory.js";

const LS = "hamster_player_v2";

let pid, myName;
let meta = { radius: 15 };
let spots = {};
let items = mergeItems({});
let me = { found: {}, done: {} };
let meLoaded = false;
let knownDone = new Set();
let pos = null;
let lastTarget = null; // { id, d }
let lastUpload = 0;
let allDoneShown = false;
let revealQueue = [];
let round = null;        // 主持人發起的 12 格出題 { id, startAt(伺服器時間) }
let startedRound = null; // 這支手機已經進入過的回合
let serverOffset = 0;    // 伺服器時間 - 本機時間

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

  $("#nameBox").onclick = rename;
  $("#mWho").onclick = rename;
  $("#findBtn").onclick = tryFind;
  $("#revealClose").onclick = () => {
    $("#revealSheet").classList.add("hidden");
    showNextReveal();
  };
  $("#photoInput").onchange = onPhoto;
  $("#memWallBtn").onclick = openWall;
  setName(myName);

  update(ref(db, `${ROOT}/players/${pid}`), { name: myName, joinedAt: Date.now() }).catch(() => {});

  onValue(ref(db, `${ROOT}/meta`), (s) => { meta = s.val() || { radius: 15 }; render(); });
  onValue(ref(db, `${ROOT}/spots`), (s) => { spots = s.val() || {}; render(); });
  onValue(ref(db, `${ROOT}/items`), (s) => { items = mergeItems(s.val()); render(); });
  onValue(ref(db, `${ROOT}/players/${pid}`), (s) => {
    if (!s.exists()) {
      // 主持人清空了進度 → 重新登記
      me = { found: {}, done: {} };
      knownDone = new Set();
      allDoneShown = false;
      update(ref(db, `${ROOT}/players/${pid}`), { name: myName, joinedAt: Date.now() }).catch(() => {});
    } else {
      me = s.val();
      me.found = me.found || {};
      me.done = me.done || {};
      // 主持人剛按下「完成」→ 跳出獲得意義
      const nowDone = Object.keys(me.done);
      if (meLoaded) {
        nowDone.filter((id) => !knownDone.has(id)).forEach((id) => queueReveal(id));
      }
      knownDone = new Set(nowDone);
    }
    meLoaded = true;
    render();
  });
  onValue(ref(db, ".info/serverTimeOffset"), (s) => { serverOffset = Number(s.val()) || 0; });
  onValue(ref(db, `${ROOT}/round`), (s) => { round = s.val(); maybeStartRound(); });

  startGps();
  render();
}

function setName(n) {
  $("#meName").textContent = n;
  $("#mWho").textContent = n;
}

function rename() {
  const n = prompt("你的暱稱（主持人會用這個名字幫你按完成）", myName);
  if (!n || !n.trim()) return;
  myName = n.trim().slice(0, 16);
  setName(myName);
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
document.addEventListener("click", keepAwake, { once: true });

/* ---------------- 狀態 ---------------- */
/** 目前關卡：依順序第一個主持人還沒按完成的物品 */
function currentItem() {
  return items.find((it) => !me.done?.[it.id]) || null;
}

function targetInfo(it) {
  const s = spots[it.id];
  if (!s || !pos) return null;
  return { ...it, lat: s.lat, lng: s.lng, d: distM(pos, s) };
}

function canFind(t) {
  if (!t || !pos) return false;
  // 允許一點 GPS 誤差補償（最多 10 公尺）
  return t.d - Math.min(pos.acc, 20) * 0.5 <= (meta.radius || 15);
}

/* ---------------- 畫面 ---------------- */
function render() {
  const doneN = items.filter((it) => me.done?.[it.id]).length;
  $("#doneN").textContent = doneN;
  $("#progBar").style.width = `${(doneN / 4) * 100}%`;
  renderBag();

  const cur = currentItem();
  const inMission = cur && me.found?.[cur.id];
  $("#huntView").classList.toggle("hidden", !!inMission);
  $("#missionView").classList.toggle("hidden", !inMission);

  if (!cur) return renderAllDone();
  if (inMission) return renderMission(cur);
  renderHunt(cur);
}

function renderBag() {
  $("#bagItems").innerHTML = items.map((it) => {
    const done = !!me.done?.[it.id];
    const pending = !done && !!me.found?.[it.id];
    const cls = done ? "got" : pending ? "pending" : "";
    const label = done ? esc(it.name) : pending ? "任務中…" : `第 ${it.order} 個`;
    return `<div class="bag-slot ${cls}" data-id="${it.id}">
      <div class="ico">${it.icon}</div><div class="nm">${label}</div></div>`;
  }).join("");
  $("#bagItems").querySelectorAll(".bag-slot.got").forEach((el) =>
    (el.onclick = () => showReveal(el.dataset.id, true)));
}

function renderHunt(cur) {
  const btn = $("#findBtn");
  btn.textContent = "🔍 我找到了！";
  $("#targetIco").innerHTML = cur.icon;
  $("#targetIco").classList.remove("won");
  $("#targetTitle").textContent = `第 ${cur.order} 個寶物`;
  $("#targetSub").textContent = cur.order === 1 ? "依照順序，一次找一個" : `已完成 ${cur.order - 1} 關，繼續前進！`;
  $("#accLbl").textContent = pos ? `GPS 誤差 ±${Math.round(pos.acc)} 公尺` : "";

  if (!spots[cur.id]) {
    setRadar(0, "", "--", "", `主持人還在藏第 ${cur.order} 個寶物，請稍候…`, "");
    btn.disabled = true;
    return;
  }
  if (!pos) {
    setRadar(0, "離寶物還有", "--", "", "取得定位中…", "");
    btn.disabled = true;
    return;
  }

  const t = targetInfo(cur);
  const { num, unit } = fmtDist(t.d);
  const [lv, label] = heatLevel(t.d, meta.radius || 15);

  let trend = $("#trendLbl").textContent;
  if (!lastTarget || lastTarget.id !== t.id) {
    trend = "";
    lastTarget = { id: t.id, d: t.d };
  } else if (Math.abs(t.d - lastTarget.d) >= 2) {
    trend = t.d < lastTarget.d ? TREND.closer : TREND.farther;
    lastTarget.d = t.d;
  }

  const ok = canFind(t);
  setRadar(lv, "離寶物還有", num, unit, ok ? "✨ 找到味道的源頭了！按下面的按鈕！" : label, trend);
  btn.disabled = !ok;
}

function renderMission(cur) {
  $("#mIco").innerHTML = cur.icon;
  $("#mStep").textContent = `第 ${cur.order} 關 · 找到了！`;
  $("#mName").textContent = cur.name;
  $("#mTask").textContent = cur.mission;
  $("#photoBox").classList.toggle("hidden", cur.activity !== "photo");
  $("#memoryBox").classList.toggle("hidden", cur.activity !== "memory");
  $("#memWallBtn").classList.toggle("hidden", !hasWall());
  maybeStartRound();
}

/** 主持人按下 12 格「開始」→ 正在瓜子任務的玩家直接進入畫布 */
function maybeStartRound() {
  if (!round?.id || typeof round.startAt !== "number" || round.id === startedRound) return;
  const cur = currentItem();
  if (!cur || cur.activity !== "memory" || !me.found?.[cur.id]) return;
  const drawStart = round.startAt - serverOffset + COUNTDOWN_MS;
  if (Date.now() > drawStart + DRAW_MS * 12) return; // 回合已經結束
  startedRound = round.id;
  try { navigator.vibrate?.(200); } catch {}
  startRound(drawStart);
}

function renderAllDone() {
  $("#huntView").classList.remove("hidden");
  $("#targetIco").innerHTML = "🏆";
  $("#targetIco").classList.add("won");
  $("#targetTitle").textContent = "四個寶物都找到了！";
  $("#targetSub").textContent = "點下面的收藏可以再讀一次";
  $("#accLbl").textContent = "";
  setRadar(4, "", "🏆", "", "全部完成！", "你找到了內心的倉鼠 🐹💛");
  const btn = $("#findBtn");
  btn.disabled = true;
  btn.textContent = "🎉 任務完成";
  if (!allDoneShown && meLoaded) { allDoneShown = true; if (!revealQueue.length) confetti(); }
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
  const cur = currentItem();
  if (!cur || me.found?.[cur.id]) return;
  const t = targetInfo(cur);
  if (!canFind(t)) return toast("還不夠近喔，再找找看！");
  $("#findBtn").disabled = true;
  try {
    await update(ref(db, `${ROOT}/players/${pid}/found`), { [cur.id]: Date.now() });
    try { navigator.vibrate?.([80, 40, 160]); } catch {}
    toast(`找到「${cur.name}」了！完成小任務吧`, 3000);
    confetti();
  } catch (e) {
    toast("送出失敗：" + e.message, 4000);
    $("#findBtn").disabled = false;
  }
}

/* ---------------- 任務：拍照 ---------------- */
function onPhoto(e) {
  const f = e.target.files?.[0];
  if (!f) return;
  const url = URL.createObjectURL(f);
  const img = document.createElement("img");
  img.src = url;
  img.alt = "鼠鼠眼中的世界";
  img.onclick = () => {
    const full = document.createElement("div");
    full.className = "photo-full";
    full.innerHTML = `<img src="${url}" alt="">`;
    full.onclick = () => full.remove();
    document.body.appendChild(full);
  };
  $("#photoList").prepend(img);
  e.target.value = "";
  toast("拍好了！點照片可以全螢幕展示");
}

/* ---------------- 揭曉 ---------------- */
function queueReveal(id) {
  revealQueue.push(id);
  if ($("#revealSheet").classList.contains("hidden")) showNextReveal();
}

function showNextReveal() {
  const id = revealQueue.shift();
  if (!id) return;
  showReveal(id, false);
  try { navigator.vibrate?.([60, 30, 60, 30, 200]); } catch {}
  confetti();
}

function showReveal(id, again) {
  const it = items.find((x) => x.id === id);
  if (!it) return;
  $("#revealIco").innerHTML = it.icon;
  $("#revealSub").textContent = again ? "我的收藏" : `🎉 第 ${it.order} 關完成！你獲得了`;
  $("#revealName").textContent = it.name;
  $("#revealTag").textContent = it.sub ? `（${it.sub}）` : "";
  $("#revealMeaning").textContent = it.meaning;
  $("#revealQuestion").textContent = it.question;
  $("#revealClose").textContent = again ? "關閉" : it.order < 4 ? "收進背包，找下一個 🎒" : "收進背包 🎒";
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
