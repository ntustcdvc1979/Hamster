import {
  db, ref, set, update, push, remove, onValue, get, serverTimestamp,
  $, genCode, esc, sortedSpots, toast, requireConfig, requireSecure, distM, fmtDist,
} from "./common.js";

const LS_ROOM = "hamster_host_room";

let code = null;
let roomData = {};
let spots = {};
let players = {};
let unsubs = [];
let map = null;
let spotMarkers = {};
let playerMarkers = {};
let meMarker = null;
let meCircle = null;
let myPos = null;
let watchId = null;
let editing = null; // { id|null, lat, lng }
let tempMarker = null;
let showPlayers = true;

function init() {
  const last = localStorage.getItem(LS_ROOM);
  if (last) $("#openCode").value = last;

  $("#createBtn").onclick = createRoom;
  $("#openBtn").onclick = () => openRoom($("#openCode").value.trim().toUpperCase());
  $("#openCode").addEventListener("keydown", (e) => e.key === "Enter" && $("#openBtn").click());

  document.querySelectorAll("[data-close]").forEach((b) =>
    b.addEventListener("click", () => closeSheets()));
  document.querySelectorAll(".overlay").forEach((o) =>
    o.addEventListener("click", (e) => e.target === o && closeSheets()));

  document.querySelectorAll(".tabs button").forEach((b) => (b.onclick = () => switchTab(b.dataset.tab)));
  $("#panelHandle").onclick = () => {
    $("#panel").classList.toggle("collapsed");
    setTimeout(() => map && map.invalidateSize(), 50);
  };

  $("#saveSpotBtn").onclick = saveSpot;
  $("#deleteSpotBtn").onclick = deleteSpot;
  $("#locateBtn").onclick = () => {
    if (myPos) map.setView([myPos.lat, myPos.lng], Math.max(map.getZoom(), 17));
    else toast("還在取得你的 GPS 位置…");
  };
  $("#addHereBtn").onclick = () => {
    if (!myPos) return toast("還沒拿到 GPS 位置，請稍候或直接點地圖");
    if (myPos.acc > 30) toast(`目前 GPS 誤差約 ${Math.round(myPos.acc)} 公尺，存好後可以拖曳微調`, 3500);
    startNewSpot(myPos.lat, myPos.lng);
  };
  $("#shareBtn").onclick = openShare;
  $("#copyBtn").onclick = async () => {
    try { await navigator.clipboard.writeText(joinLink()); toast("已複製連結"); }
    catch { toast("無法複製，請長按連結手動複製"); }
  };
  $("#nativeShareBtn").onclick = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: "尋找內心的倉鼠", text: `遊戲代碼 ${code}`, url: joinLink() }); } catch {}
    } else toast("這台裝置不支援分享，請用複製連結");
  };

  $("#saveSettingsBtn").onclick = saveSettings;
  $("#showPlayers").onchange = (e) => { showPlayers = e.target.checked; renderPlayerMarkers(); };
  $("#resetBtn").onclick = resetProgress;
  $("#leaveBtn").onclick = leaveRoom;
  $("#deleteRoomBtn").onclick = deleteRoom;
}

/* ---------------- 房間 ---------------- */
async function createRoom() {
  const name = $("#roomName").value.trim() || "尋找內心的倉鼠";
  $("#createBtn").disabled = true;
  try {
    let c;
    for (let i = 0; i < 10; i++) {
      c = genCode();
      const snap = await get(ref(db, `rooms/${c}/meta`));
      if (!snap.exists()) break;
    }
    await set(ref(db, `rooms/${c}/meta`), { name, radius: 15, createdAt: serverTimestamp() });
    await openRoom(c);
  } catch (e) {
    console.error(e);
    toast("建立失敗：" + e.message, 5000);
  } finally {
    $("#createBtn").disabled = false;
  }
}

async function openRoom(c) {
  if (!/^[A-Z0-9]{4}$/.test(c)) return toast("請輸入 4 碼遊戲代碼");
  try {
    const snap = await get(ref(db, `rooms/${c}/meta`));
    if (!snap.exists()) return toast("找不到這個遊戲代碼");
  } catch (e) {
    console.error(e);
    return toast("連線失敗：" + e.message, 5000);
  }
  code = c;
  localStorage.setItem(LS_ROOM, c);
  $("#startScreen").classList.add("hidden");
  $("#hostApp").classList.remove("hidden");
  $("#codeLabel").textContent = c;
  initMap();
  subscribe();
}

function subscribe() {
  unsubs.forEach((u) => u());
  unsubs = [
    onValue(ref(db, `rooms/${code}/meta`), (s) => {
      roomData = s.val() || {};
      $("#nameLabel").textContent = roomData.name || "";
      $("#nameInput").value = roomData.name || "";
      $("#radiusInput").value = roomData.radius || 15;
    }),
    onValue(ref(db, `rooms/${code}/spots`), (s) => {
      const first = !Object.keys(spots).length;
      spots = s.val() || {};
      renderSpots();
      if (first) fitToSpots();
    }),
    onValue(ref(db, `rooms/${code}/players`), (s) => {
      players = s.val() || {};
      renderSpots();
      renderPlayers();
      renderPlayerMarkers();
    }),
  ];
}

function leaveRoom() {
  unsubs.forEach((u) => u());
  unsubs = [];
  location.reload();
}

/* ---------------- 地圖 ---------------- */
function initMap() {
  if (map) return;
  const street = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, attribution: "© OpenStreetMap",
  });
  const sat = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 19, attribution: "Tiles © Esri" });
  map = L.map("map", { zoomControl: false, layers: [street] }).setView([25.0330, 121.5654], 16);
  L.control.layers({ "街道": street, "衛星": sat }, null, { position: "topright" }).addTo(map);
  L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map);

  map.on("click", (e) => startNewSpot(e.latlng.lat, e.latlng.lng));

  if (requireSecure()) {
    let centered = false;
    watchId = navigator.geolocation.watchPosition(
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
        if (!centered && !Object.keys(spots).length) { map.setView(ll, 17); }
        centered = true;
        renderSpots(); // 更新「離我多遠」
      },
      (err) => toast("無法取得 GPS：" + err.message, 4000),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 },
    );
  }
  setTimeout(() => map.invalidateSize(), 100);
}

function pinIcon(label, temp = false) {
  return L.divIcon({
    className: "",
    html: `<div class="spot-pin ${temp ? "temp" : ""}"><b>${esc(label)}</b></div>`,
    iconSize: [34, 34], iconAnchor: [17, 34],
  });
}

function fitToSpots() {
  const list = sortedSpots(spots);
  if (!list.length || !map) return;
  if (list.length === 1) map.setView([list[0].lat, list[0].lng], 17);
  else map.fitBounds(L.latLngBounds(list.map((s) => [s.lat, s.lng])), { padding: [40, 40] });
}

/* ---------------- 地點 ---------------- */
function renderSpots() {
  const list = sortedSpots(spots);
  $("#spotCount").textContent = list.length;

  // markers
  Object.keys(spotMarkers).forEach((id) => {
    if (!spots[id]) { map.removeLayer(spotMarkers[id]); delete spotMarkers[id]; }
  });
  list.forEach((s, i) => {
    let m = spotMarkers[s.id];
    if (!m) {
      m = L.marker([s.lat, s.lng], { draggable: true, icon: pinIcon(i + 1) }).addTo(map);
      m.on("click", () => openSpot(m._spotId));
      m.on("dragend", () => {
        const ll = m.getLatLng();
        update(ref(db, `rooms/${code}/spots/${m._spotId}`), { lat: ll.lat, lng: ll.lng });
        toast("位置已更新");
      });
      spotMarkers[s.id] = m;
    } else if (!m.dragging?.moving?.()) {
      m.setLatLng([s.lat, s.lng]);
    }
    m._spotId = s.id;
    m.setIcon(pinIcon(i + 1));
    m.bindTooltip(esc(s.item || "(未命名)"), { direction: "top", offset: [0, -32] });
  });

  // list
  const foundCount = (id) => Object.values(players).filter((p) => p.found && p.found[id]).length;
  $("#tab-spots").innerHTML = list.length
    ? list.map((s, i) => {
        const far = myPos ? ` · 離我 ${Object.values(fmtDist(distM(myPos, s))).join(" ")}` : "";
        return `<div class="list-item" data-id="${s.id}">
          <div class="num-badge">${i + 1}</div>
          <div class="grow"><div class="t">${esc(s.item || "(未命名)")}</div>
          <div class="s">${foundCount(s.id)} 人找到${far}</div></div><div>›</div></div>`;
      }).join("")
    : `<div class="empty">🐹 還沒有任何地點<br>點地圖，或按右下角 ➕ 在你現在的位置新增</div>`;
  $("#tab-spots").querySelectorAll(".list-item").forEach((el) =>
    (el.onclick = () => {
      const s = spots[el.dataset.id];
      map.setView([s.lat, s.lng], Math.max(map.getZoom(), 17));
      openSpot(el.dataset.id);
    }));
  $("#mapHint").classList.toggle("hidden", list.length > 0);
}

function startNewSpot(lat, lng) {
  clearTemp();
  tempMarker = L.marker([lat, lng], { icon: pinIcon("?", true), interactive: false }).addTo(map);
  editing = { id: null, lat, lng };
  $("#sheetTitle").textContent = "新增寶物";
  $("#itemInput").value = "";
  $("#descInput").value = "";
  $("#deleteSpotBtn").classList.add("hidden");
  showCoords(lat, lng);
  $("#spotSheet").classList.remove("hidden");
  setTimeout(() => $("#itemInput").focus(), 250);
}

function openSpot(id) {
  const s = spots[id];
  if (!s) return;
  clearTemp();
  editing = { id, lat: s.lat, lng: s.lng };
  const idx = sortedSpots(spots).findIndex((x) => x.id === id);
  $("#sheetTitle").textContent = `地點 ${idx + 1}`;
  $("#itemInput").value = s.item || "";
  $("#descInput").value = s.desc || "";
  $("#deleteSpotBtn").classList.remove("hidden");
  showCoords(s.lat, s.lng);
  $("#spotSheet").classList.remove("hidden");
}

function showCoords(lat, lng) {
  $("#sheetCoords").textContent = `📍 ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

async function saveSpot() {
  const item = $("#itemInput").value.trim();
  const desc = $("#descInput").value.trim();
  if (!item) return toast("請輸入寶物名稱");
  try {
    if (editing.id) {
      await update(ref(db, `rooms/${code}/spots/${editing.id}`), { item, desc });
    } else {
      await set(push(ref(db, `rooms/${code}/spots`)), {
        lat: editing.lat, lng: editing.lng, item, desc, createdAt: Date.now(),
      });
    }
    toast("已儲存 🌻");
    closeSheets();
  } catch (e) {
    toast("儲存失敗：" + e.message, 4000);
  }
}

async function deleteSpot() {
  if (!editing?.id) return;
  if (!confirm("確定要刪除這個地點嗎？")) return;
  const id = editing.id;
  await remove(ref(db, `rooms/${code}/spots/${id}`));
  // 一併清掉玩家的找到紀錄
  const upd = {};
  Object.keys(players).forEach((pid) => { if (players[pid].found?.[id]) upd[`players/${pid}/found/${id}`] = null; });
  if (Object.keys(upd).length) await update(ref(db, `rooms/${code}`), upd);
  toast("已刪除");
  closeSheets();
}

function clearTemp() {
  if (tempMarker) { map.removeLayer(tempMarker); tempMarker = null; }
}

function closeSheets() {
  document.querySelectorAll(".overlay").forEach((o) => o.classList.add("hidden"));
  clearTemp();
  editing = null;
}

/* ---------------- 玩家 ---------------- */
function renderPlayers() {
  const list = Object.entries(players).map(([id, p]) => ({ id, ...p }));
  const total = Object.keys(spots).length;
  $("#playerCount").textContent = list.length;
  list.sort((a, b) => Object.keys(b.found || {}).length - Object.keys(a.found || {}).length);
  $("#tab-players").innerHTML = list.length
    ? list.map((p) => {
        const n = Object.keys(p.found || {}).filter((k) => spots[k]).length;
        const ago = p.updatedAt ? Math.round((Date.now() - p.updatedAt) / 1000) : null;
        const seen = ago == null ? "尚未定位" : ago < 60 ? `${ago} 秒前` : `${Math.round(ago / 60)} 分鐘前`;
        const items = Object.keys(p.found || {}).map((k) => spots[k]?.item).filter(Boolean).join("、");
        return `<div class="list-item" data-id="${p.id}">
          <div class="num-badge" style="background:${n >= total && total ? "var(--ok)" : "var(--brand)"}">${n}</div>
          <div class="grow"><div class="t">${esc(p.name)} ${n >= total && total ? "🏆" : ""}</div>
          <div class="s">${n}/${total} · ${seen}${items ? " · " + esc(items) : ""}</div></div></div>`;
      }).join("")
    : `<div class="empty">還沒有玩家加入<br>按上方「邀請玩家」分享代碼</div>`;
  $("#tab-players").querySelectorAll(".list-item").forEach((el) =>
    (el.onclick = () => {
      const p = players[el.dataset.id];
      if (p?.lat) map.setView([p.lat, p.lng], Math.max(map.getZoom(), 17));
    }));
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
  const name = $("#nameInput").value.trim() || "尋找內心的倉鼠";
  await update(ref(db, `rooms/${code}/meta`), { radius, name });
  toast("設定已儲存");
}

async function resetProgress() {
  if (!confirm("確定要清空所有玩家的進度嗎？（玩家名單也會清除）")) return;
  await remove(ref(db, `rooms/${code}/players`));
  toast("已清空");
}

async function deleteRoom() {
  if (!confirm(`確定要刪除遊戲 ${code}？所有地點和玩家資料都會消失。`)) return;
  unsubs.forEach((u) => u());
  unsubs = [];
  await remove(ref(db, `rooms/${code}`));
  localStorage.removeItem(LS_ROOM);
  location.reload();
}

/* ---------------- 分頁 / 分享 ---------------- */
function switchTab(t) {
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === t));
  ["spots", "players", "settings"].forEach((x) => $(`#tab-${x}`).classList.toggle("hidden", x !== t));
  if ($("#panel").classList.contains("collapsed")) {
    $("#panel").classList.remove("collapsed");
    setTimeout(() => map.invalidateSize(), 50);
  }
}

function joinLink() {
  return new URL(`player.html?room=${code}`, location.href).href;
}

function openShare() {
  $("#shareCode").textContent = code;
  $("#shareLink").textContent = joinLink();
  $("#qr").innerHTML = "";
  if (window.QRCode) new QRCode($("#qr"), { text: joinLink(), width: 200, height: 200 });
  $("#shareSheet").classList.remove("hidden");
}

// 每 15 秒刷新「幾秒前」
setInterval(() => code && renderPlayers(), 15000);

if (requireConfig()) init();
