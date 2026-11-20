import {
  db, ref, set, update, remove, onValue,
  ROOT, ITEMS, EDITABLE, MAP_CENTER, mergeItems, $, esc, toast, requireConfig, requireSecure, distM, fmtDist,
} from "./common.js?v=202611201717";
import { CELLS } from "./memory.js?v=202611201717";

let meta = { radius: 15 };
let spots = {};
let overrides = {};
let items = mergeItems({});
let players = {};
let map = null;
let itemMarkers = {};
let playerMarkers = {};
let meMarker = null;
let meCircle = null;
let myPos = null;
let selected = ITEMS[0].id;
let editing = null;
let showPlayers = true;
let round = null;

const itemById = (id) => items.find((it) => it.id === id);

function init() {
  document.querySelectorAll("[data-close]").forEach((b) =>
    b.addEventListener("click", () => closeSheets()));
  document.querySelectorAll(".overlay").forEach((o) =>
    o.addEventListener("click", (e) => e.target === o && closeSheets()));

  document.querySelectorAll(".tabs button").forEach((b) => (b.onclick = () => switchTab(b.dataset.tab)));
  $("#panelHandle").onclick = () => {
    $("#panel").classList.toggle("collapsed");
    setTimeout(() => map && map.invalidateSize(), 50);
  };

  $("#locateBtn").onclick = () => {
    if (myPos) map.setView([myPos.lat, myPos.lng], Math.max(map.getZoom(), 18));
    else toast("還在取得你的 GPS 位置…");
  };
  $("#shareBtn").onclick = openShare;
  $("#copyBtn").onclick = async () => {
    try { await navigator.clipboard.writeText(playerLink()); toast("已複製連結"); }
    catch { toast("無法複製，請長按連結手動複製"); }
  };
  $("#nativeShareBtn").onclick = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: "尋找內心的倉鼠", url: playerLink() }); } catch {}
    } else toast("這台裝置不支援分享，請用複製連結");
  };

  $("#saveSettingsBtn").onclick = saveSettings;
  $("#showPlayers").onchange = (e) => { showPlayers = e.target.checked; renderPlayerMarkers(); };
  $("#resetBtn").onclick = resetProgress;
  $("#saveEditBtn").onclick = saveEdit;
  $("#resetEditBtn").onclick = resetEdit;

  // 物品清單（事件委派，避免重新渲染時按鈕失效）
  $("#tab-items").addEventListener("click", (e) => {
    const here = e.target.closest("[data-here]");
    const edit = e.target.closest("[data-edit]");
    const row = e.target.closest(".item-row");
    if (here) {
      if (!myPos) return toast("還沒拿到 GPS 位置，請稍候或直接點地圖");
      if (myPos.acc > 25) toast(`目前 GPS 誤差約 ${Math.round(myPos.acc)} 公尺，放好後可拖曳微調`, 3500);
      select(here.dataset.here);
      placeItem(here.dataset.here, myPos.lat, myPos.lng);
    } else if (edit) {
      openEdit(edit.dataset.edit);
    } else if (row) {
      select(row.dataset.id, true);
    }
  });

  // 玩家清單：按「完成」
  $("#tab-players").addEventListener("click", (e) => {
    const one = e.target.closest("[data-done]");
    const all = e.target.closest("[data-done-all]");
    const row = e.target.closest("[data-pid]");
    if (one) {
      const [p, id] = one.dataset.done.split("|");
      completeMission([p], id);
    } else if (all) {
      const id = all.dataset.doneAll;
      const list = waitingOn(id);
      if (confirm(`確定讓 ${list.length} 位玩家完成「${itemById(id).name}」任務？`)) completeMission(list, id);
    } else if (row) {
      const p = players[row.dataset.pid];
      if (p?.lat) map.setView([p.lat, p.lng], Math.max(map.getZoom(), 18));
    }
  });

  $("#roundMainBtn").onclick = onRoundMain;
  $("#roundRestartBtn").onclick = onRoundRestart;
  $("#roundDoneBtn").onclick = onRoundDone;

  initMap();
  subscribe();
  onValue(ref(db, `${ROOT}/round`), (s) => { round = s.val(); renderSeedTab(); });
  setInterval(renderSeedTab, 1000);
  renderItems();
}

function subscribe() {
  let first = true;
  onValue(ref(db, `${ROOT}/meta`), (s) => {
    meta = s.val() || { radius: 15 };
    $("#radiusInput").value = meta.radius || 15;
  });
  onValue(ref(db, `${ROOT}/items`), (s) => {
    overrides = s.val() || {};
    items = mergeItems(overrides);
    renderItems();
    renderPlayers();
  });
  onValue(ref(db, `${ROOT}/spots`), (s) => {
    spots = s.val() || {};
    renderItems();
    renderPlayers();
    if (first) { first = false; fitToItems(); }
  });
  onValue(ref(db, `${ROOT}/players`), (s) => {
    players = s.val() || {};
    renderItems();
    renderPlayers();
    renderPlayerMarkers();
    renderSeedTab();
  });
}

/* ---------------- 地圖 ---------------- */
function initMap() {
  const street = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 20, maxNativeZoom: 19, attribution: "© OpenStreetMap",
  });
  const sat = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 20, maxNativeZoom: 19, attribution: "Tiles © Esri" });
  map = L.map("map", { zoomControl: false, layers: [street] }).setView(MAP_CENTER, 18);
  L.control.layers({ "街道": street, "衛星": sat }, null, { position: "topright" }).addTo(map);
  L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map);

  map.on("click", (e) => placeItem(selected, e.latlng.lat, e.latlng.lng));

  if (requireSecure()) {
    navigator.geolocation.watchPosition(
      (p) => {
        myPos = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy };
        const ll = [myPos.lat, myPos.lng];
        if (!meMarker) {
          meCircle = L.circle(ll, { radius: myPos.acc, color: "#2f7cf6", weight: 1, fillOpacity: .1, interactive: false }).addTo(map);
          meMarker = L.marker(ll, { icon: L.divIcon({ className: "", html: '<div class="me-dot"></div>', iconSize: [18, 18] }), interactive: false }).addTo(map);
        } else {
          meMarker.setLatLng(ll);
          meCircle.setLatLng(ll).setRadius(myPos.acc);
        }
        renderItems(); // 更新「離我多遠」
      },
      (err) => toast("無法取得 GPS：" + err.message, 4000),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 },
    );
  }
  setTimeout(() => map.invalidateSize(), 100);
}

function itemIcon(it, isSelected) {
  return L.divIcon({
    className: "",
    html: `<div class="item-pin ${isSelected ? "sel" : ""}" style="--c:${it.color}"><div class="ico">${it.icon}</div><span class="pin-order">${it.order}</span></div>`,
    iconSize: [48, 56], iconAnchor: [24, 56],
  });
}

function fitToItems() {
  const pts = ITEMS.filter((it) => spots[it.id]).map((it) => [spots[it.id].lat, spots[it.id].lng]);
  if (!pts.length || !map) return;
  if (pts.length === 1) map.setView(pts[0], 18);
  else map.fitBounds(L.latLngBounds(pts), { padding: [50, 50], maxZoom: 19 });
}

async function placeItem(id, lat, lng) {
  try {
    await update(ref(db, `${ROOT}/spots/${id}`), { lat, lng, updatedAt: Date.now() });
    toast(`已放置「${itemById(id).name}」`);
  } catch (e) {
    toast("儲存失敗：" + e.message, 4000);
  }
}

/* ---------------- 物品 ---------------- */
function select(id, pan = false) {
  selected = id;
  const s = spots[id];
  if (pan && s) map.setView([s.lat, s.lng], Math.max(map.getZoom(), 18));
  renderItems();
}

function renderItems() {
  if (!map) return;
  $("#placedCount").textContent = ITEMS.filter((it) => spots[it.id]).length;

  items.forEach((it) => {
    const s = spots[it.id];
    let m = itemMarkers[it.id];
    if (!s) {
      if (m) { map.removeLayer(m); delete itemMarkers[it.id]; }
      return;
    }
    if (!m) {
      m = L.marker([s.lat, s.lng], { draggable: true }).addTo(map);
      m.on("click", () => select(it.id));
      m.on("dragstart", () => select(it.id));
      m.on("dragend", () => {
        const ll = m.getLatLng();
        placeItem(it.id, ll.lat, ll.lng);
      });
      itemMarkers[it.id] = m;
    } else if (!m.dragging?.moving?.()) {
      m.setLatLng([s.lat, s.lng]);
    }
    m.bindTooltip(`${it.order}. ${esc(it.name)}`, { direction: "top", offset: [0, -52] });
    m.setIcon(itemIcon(it, it.id === selected));
    m.setZIndexOffset(it.id === selected ? 1000 : 0);
  });

  const count = (id, key) => Object.values(players).filter((p) => p[key]?.[id]).length;
  $("#tab-items").innerHTML = items.map((it, i) => {
    const s = spots[it.id];
    let status = "尚未放置";
    if (s) {
      status = `已放置 · ${count(it.id, "done")} 人完成`;
      if (myPos) status += ` · 離我 ${Object.values(fmtDist(distM(myPos, s))).join(" ")}`;
      const prev = i > 0 && spots[items[i - 1].id];
      if (prev) status += ` · 距上一個 ${Math.round(distM(prev, s))} 公尺`;
    }
    const edited = overrides[it.id] ? " ✏️" : "";
    return `<div class="list-item item-row ${it.id === selected ? "sel" : ""}" data-id="${it.id}">
      <span class="order">${it.order}</span>
      <div class="item-ico">${it.icon}</div>
      <div class="grow"><div class="t">${esc(it.name)}${edited}</div>
        <div class="s" style="white-space:normal">${status}</div></div>
      <div class="row-btns">
        <button class="btn small here-btn" data-here="${it.id}">📍 放我這</button>
        <button class="btn small secondary here-btn" data-edit="${it.id}">✏️ 說明</button>
      </div>
    </div>`;
  }).join("");

  const it = itemById(selected);
  $("#mapHint").innerHTML = `${it.icon}<span>點地圖${spots[selected] ? "移動" : "放置"}「${it.order}. ${esc(it.name)}」</span>`;
}

/* ---------------- 編輯說明 ---------------- */
function openEdit(id) {
  const it = itemById(id);
  editing = id;
  $("#editIco").innerHTML = it.icon;
  $("#editTitle").textContent = `${it.order}. 編輯說明`;
  $("#editFields").innerHTML = EDITABLE.map((f) => `
    <div class="edit-field">
      <label for="f_${f.key}">${f.label}</label>
      ${f.rows === 1
        ? `<input id="f_${f.key}" maxlength="30">`
        : `<textarea id="f_${f.key}" rows="${f.rows}" maxlength="2000"></textarea>`}
    </div>`).join("");
  EDITABLE.forEach((f) => { $(`#f_${f.key}`).value = it[f.key] || ""; });
  $("#resetEditBtn").classList.toggle("hidden", !overrides[id]);
  $("#editSheet").classList.remove("hidden");
}

async function saveEdit() {
  const data = {};
  const def = ITEMS.find((x) => x.id === editing);
  EDITABLE.forEach((f) => {
    const v = $(`#f_${f.key}`).value.trim();
    if (v && v !== def[f.key]) data[f.key] = v; // 只存跟預設不同的
  });
  try {
    if (Object.keys(data).length) await set(ref(db, `${ROOT}/items/${editing}`), data);
    else await remove(ref(db, `${ROOT}/items/${editing}`));
    toast("已儲存");
    closeSheets();
  } catch (e) {
    toast("儲存失敗：" + e.message, 4000);
  }
}

async function resetEdit() {
  if (!confirm("確定把這個物品的說明還原成預設內容？")) return;
  await remove(ref(db, `${ROOT}/items/${editing}`));
  toast("已還原");
  closeSheets();
}

/* ---------------- 玩家 / 任務完成 ---------------- */
function playerState(p) {
  const cur = items.find((it) => !p.done?.[it.id]);
  if (!cur) return { kind: "all" };
  if (p.found?.[cur.id]) return { kind: "wait", item: cur };
  return { kind: "hunt", item: cur };
}

function waitingOn(id) {
  return Object.entries(players)
    .filter(([, p]) => { const s = playerState(p); return s.kind === "wait" && s.item.id === id; })
    .map(([pid]) => pid);
}

async function completeMission(pids, id) {
  const upd = {};
  pids.forEach((p) => { upd[`${p}/done/${id}`] = Date.now(); });
  try {
    await update(ref(db, `${ROOT}/players`), upd);
    toast(`✅ 已完成「${itemById(id).name}」任務（${pids.length} 人）`);
  } catch (e) {
    toast("失敗：" + e.message, 4000);
  }
}

function seenText(p) {
  const ago = p.updatedAt ? Math.round((Date.now() - p.updatedAt) / 1000) : null;
  return ago == null ? "尚未定位" : ago < 60 ? `${ago} 秒前` : `${Math.round(ago / 60)} 分鐘前`;
}

function renderPlayers() {
  const list = Object.entries(players).map(([pid, p]) => ({ pid, ...p, st: playerState(p) }));
  $("#playerCount").textContent = list.length;
  const waits = list.filter((p) => p.st.kind === "wait");
  $("#waitBadge").textContent = waits.length ? String(waits.length) : "";
  $("#waitBadge").classList.toggle("hidden", !waits.length);

  if (!list.length) {
    $("#tab-players").innerHTML = `<div class="empty">還沒有玩家<br>按上方「玩家連結」分享給大家</div>`;
    return;
  }

  let html = "";
  // 等待完成任務：依物品分組
  items.forEach((it) => {
    const w = waits.filter((p) => p.st.item.id === it.id).sort((a, b) => (a.found?.[it.id] || 0) - (b.found?.[it.id] || 0));
    if (!w.length) return;
    html += `<div class="sec-title"><span class="mini-ico">${it.icon}</span>⏳ ${it.order}. ${esc(it.name)} 任務中（${w.length}）
      ${w.length > 1 ? `<button class="btn small done-btn" data-done-all="${it.id}">全部完成</button>` : ""}</div>`;
    html += w.map((p) => `<div class="list-item wait-row" data-pid="${p.pid}">
        <div class="grow"><div class="t">${esc(p.name)}</div>
        <div class="s">找到於 ${new Date(p.found[it.id]).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}</div></div>
        <button class="btn small done-btn" data-done="${p.pid}|${it.id}">✅ 完成</button>
      </div>`).join("");
  });

  const hunting = list.filter((p) => p.st.kind === "hunt").sort((a, b) => b.st.item.order - a.st.item.order);
  if (hunting.length) {
    html += `<div class="sec-title">🔍 尋找中（${hunting.length}）</div>`;
    html += hunting.map((p) => {
      const s = spots[p.st.item.id];
      const d = s && p.lat ? ` · 離目標 ${Math.round(distM(p, s))} 公尺` : "";
      return `<div class="list-item" data-pid="${p.pid}">
        <div class="num-badge">${p.st.item.order}</div>
        <div class="grow"><div class="t">${esc(p.name)}</div>
        <div class="s">找第 ${p.st.item.order} 個：${esc(p.st.item.name)}${d} · ${seenText(p)}</div></div></div>`;
    }).join("");
  }

  const finished = list.filter((p) => p.st.kind === "all");
  if (finished.length) {
    html += `<div class="sec-title">🏆 全部完成（${finished.length}）</div>`;
    html += finished.map((p) => `<div class="list-item" data-pid="${p.pid}">
        <div class="num-badge" style="background:var(--ok)">4</div>
        <div class="grow"><div class="t">${esc(p.name)} 🏆</div><div class="s">${seenText(p)}</div></div></div>`).join("");
  }
  $("#tab-players").innerHTML = html;
}

function renderPlayerMarkers() {
  if (!map) return;
  Object.keys(playerMarkers).forEach((id) => {
    if (!players[id] || !showPlayers || !players[id].lat) { map.removeLayer(playerMarkers[id]); delete playerMarkers[id]; }
  });
  if (!showPlayers) return;
  Object.entries(players).forEach(([id, p]) => {
    if (!p.lat) return;
    const icon = L.divIcon({ className: "", html: `<div class="player-dot">🐹 ${esc(p.name)}</div>`, iconSize: [0, 0] });
    if (playerMarkers[id]) playerMarkers[id].setLatLng([p.lat, p.lng]).setIcon(icon);
    else playerMarkers[id] = L.marker([p.lat, p.lng], { icon, interactive: false }).addTo(map);
  });
}

/* ---------------- 設定 ---------------- */
async function saveSettings() {
  const radius = Math.min(200, Math.max(3, parseInt($("#radiusInput").value, 10) || 15));
  await update(ref(db, `${ROOT}/meta`), { radius });
  toast("設定已儲存");
}

async function resetProgress() {
  if (!confirm("確定要清空所有玩家的進度嗎？（玩家名單也會清除，物品位置與說明會保留）")) return;
  await remove(ref(db, `${ROOT}/players`));
  toast("已清空");
}

/* ---------------- 分頁 / 分享 ---------------- */
function switchTab(t) {
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === t));
  ["items", "players", "seed", "settings"].forEach((x) => $(`#tab-${x}`).classList.toggle("hidden", x !== t));
  if ($("#panel").classList.contains("collapsed")) {
    $("#panel").classList.remove("collapsed");
    setTimeout(() => map.invalidateSize(), 50);
  }
}

function closeSheets() {
  document.querySelectorAll(".overlay").forEach((o) => o.classList.add("hidden"));
  editing = null;
}

function playerLink() {
  return new URL("./", location.href).href;
}

function openShare() {
  $("#shareLink").textContent = playerLink();
  $("#qr").innerHTML = "";
  if (window.QRCode) new QRCode($("#qr"), { text: playerLink(), width: 200, height: 200 });
  $("#shareSheet").classList.remove("hidden");
}

/* ---------------- 🌻 12 格出題（主持人控制換格） ---------------- */
const SEED_ID = ITEMS.find((it) => it.activity === "memory").id;

function seedWaiting() {
  return Object.entries(players).filter(([, p]) => {
    const st = playerState(p);
    return st.kind === "wait" && st.item.id === SEED_ID;
  }).map(([pid, p]) => ({ pid, name: p.name }));
}

/** null = 沒有進行中；0～11 = 正在畫的格子；12 = 畫完了 */
function roundCell() {
  return round?.id && typeof round.cell === "number" ? Math.min(12, round.cell) : null;
}

let lastCueKey = "";
function renderSeedTab() {
  const waiting = seedWaiting();
  const k = roundCell();
  const names = waiting.map((w) => w.name).join("、");

  const main = $("#roundMainBtn");
  const doneBtn = $("#roundDoneBtn");
  const restart = $("#roundRestartBtn");
  if (k === null || k >= 12) {
    main.textContent = k === null ? "🚀 開始（第 1 格）" : "🚀 開始新的一輪（第 1 格）";
    main.classList.toggle("secondary", k === 12 && waiting.length > 0);
  } else if (k < 11) {
    main.textContent = `▶ 下一格（第 ${k + 2} 格）`;
    main.classList.remove("secondary");
  } else {
    main.textContent = "🏁 畫完了，顯示 12 宮格";
    main.classList.remove("secondary");
  }
  restart.classList.toggle("hidden", k === null || k >= 12);
  doneBtn.classList.toggle("hidden", !(k === 12 && waiting.length));
  doneBtn.textContent = `✅ 完成這關（${waiting.length} 人）`;

  $("#roundStatus").textContent =
    k === null ? (waiting.length ? `在瓜子任務：${names}` : "目前沒有玩家在瓜子任務")
    : k >= 12 ? `🏁 作畫結束，玩家手機正顯示 12 宮格。搶答完按「完成這關」${waiting.length ? `（${names}）` : ""}`
    : `✏️ 玩家正在畫第 ${k + 1} 格${waiting.length ? `（${names}）` : ""}`;
  $("#roundNow").innerHTML = k !== null && k < 12
    ? `<div class="round-now">${CELLS[k].svg}<div><div class="muted">請描述</div><div class="big">第 ${k + 1} 格：${esc(CELLS[k].label)}</div></div></div>`
    : "";

  const key = String(k);
  if (key === lastCueKey && $("#cueGrid").childElementCount) return;
  lastCueKey = key;
  $("#cueGrid").innerHTML = CELLS.map((c, i) => {
    const cls = k === null || k >= 12 ? "" : i === k ? "now" : i < k ? "past" : "";
    return `<div class="cue ${cls}"><span class="no">${i + 1}</span>${c.svg}<div>${esc(c.label)}</div></div>`;
  }).join("");
}

async function writeRound(data, msg) {
  const btn = $("#roundMainBtn");
  btn.disabled = true;
  try {
    await set(ref(db, `${ROOT}/round`), data);
    if (msg) toast(msg);
  } catch (e) {
    toast("失敗：" + e.message, 4000);
  } finally {
    btn.disabled = false;
  }
}

function newRound() {
  return { id: "r" + Date.now().toString(36), cell: 0, updatedAt: Date.now() };
}

function onRoundMain() {
  const k = roundCell();
  if (k === null || k >= 12) {
    const n = seedWaiting().length;
    const msg = k === 12
      ? "開始新的一輪？正在顯示 12 宮格的玩家會回到畫布、重新從第 1 格畫起。"
      : n ? `開始？${n} 位玩家的手機會進入畫布第 1 格。` : "目前沒有玩家在瓜子任務，仍要開始嗎？";
    if (!confirm(msg)) return;
    writeRound(newRound(), "🚀 已開始，玩家正在畫第 1 格");
  } else {
    writeRound({ ...round, cell: k + 1, updatedAt: Date.now() }, k + 1 >= 12 ? "🏁 玩家手機顯示 12 宮格" : `▶ 第 ${k + 2} 格`);
  }
}

function onRoundRestart() {
  if (!confirm("重新開始一輪？玩家目前畫到的內容會清掉，從第 1 格重來。")) return;
  writeRound(newRound(), "已重新開始");
}

function onRoundDone() {
  const list = seedWaiting().map((w) => w.pid);
  if (!list.length) return;
  if (confirm(`確定讓 ${list.length} 位玩家完成「${itemById(SEED_ID).name}」這關？`)) completeMission(list, SEED_ID);
}

// 每 15 秒刷新「幾秒前」
setInterval(() => renderPlayers(), 15000);

if (requireConfig()) init();
