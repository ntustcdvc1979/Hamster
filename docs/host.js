import {
  db, ref, update, remove, onValue,
  ROOT, ITEMS, ITEM, $, esc, toast, requireConfig, requireSecure, distM, fmtDist,
} from "./common.js";

let meta = { radius: 15 };
let spots = {};
let players = {};
let map = null;
let itemMarkers = {};
let playerMarkers = {};
let meMarker = null;
let meCircle = null;
let myPos = null;
let selected = ITEMS[0].id;
let showPlayers = true;

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
    if (myPos) map.setView([myPos.lat, myPos.lng], Math.max(map.getZoom(), 17));
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

  initMap();
  subscribe();
  renderItems();
}

function subscribe() {
  let first = true;
  onValue(ref(db, `${ROOT}/meta`), (s) => {
    meta = s.val() || { radius: 15 };
    $("#radiusInput").value = meta.radius || 15;
  });
  onValue(ref(db, `${ROOT}/spots`), (s) => {
    spots = s.val() || {};
    renderItems();
    if (first) { first = false; fitToItems(); }
  });
  onValue(ref(db, `${ROOT}/players`), (s) => {
    players = s.val() || {};
    renderItems();
    renderPlayers();
    renderPlayerMarkers();
  });
}

/* ---------------- 地圖 ---------------- */
function initMap() {
  const street = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19, attribution: "© OpenStreetMap",
  });
  const sat = L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 19, attribution: "Tiles © Esri" });
  map = L.map("map", { zoomControl: false, layers: [street] }).setView([25.0330, 121.5654], 16);
  L.control.layers({ "街道": street, "衛星": sat }, null, { position: "topright" }).addTo(map);
  L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map);

  map.on("click", (e) => placeItem(selected, e.latlng.lat, e.latlng.lng));

  if (requireSecure()) {
    let centered = false;
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
        if (!centered && !Object.keys(spots).length) map.setView(ll, 17);
        centered = true;
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
    html: `<div class="item-pin ${isSelected ? "sel" : ""}" style="--c:${it.color}"><div class="ico">${it.icon}</div></div>`,
    iconSize: [48, 56], iconAnchor: [24, 56],
  });
}

function fitToItems() {
  const pts = ITEMS.filter((it) => spots[it.id]).map((it) => [spots[it.id].lat, spots[it.id].lng]);
  if (!pts.length || !map) return;
  if (pts.length === 1) map.setView(pts[0], 17);
  else map.fitBounds(L.latLngBounds(pts), { padding: [50, 50] });
}

async function placeItem(id, lat, lng) {
  try {
    await update(ref(db, `${ROOT}/spots/${id}`), { lat, lng, updatedAt: Date.now() });
    toast(`已放置「${ITEM[id].name}」`);
  } catch (e) {
    toast("儲存失敗：" + e.message, 4000);
  }
}

/* ---------------- 物品 ---------------- */
function select(id, pan = false) {
  selected = id;
  const s = spots[id];
  if (pan && s) map.setView([s.lat, s.lng], Math.max(map.getZoom(), 17));
  renderItems();
}

function renderItems() {
  if (!map) return;
  const placed = ITEMS.filter((it) => spots[it.id]);
  $("#placedCount").textContent = placed.length;

  ITEMS.forEach((it) => {
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
      m.bindTooltip(esc(it.name), { direction: "top", offset: [0, -52] });
      itemMarkers[it.id] = m;
    } else if (!m.dragging?.moving?.()) {
      m.setLatLng([s.lat, s.lng]);
    }
    m.setIcon(itemIcon(it, it.id === selected));
    m.setZIndexOffset(it.id === selected ? 1000 : 0);
  });

  const foundCount = (id) => Object.values(players).filter((p) => p.found?.[id]).length;
  $("#tab-items").innerHTML = ITEMS.map((it) => {
    const s = spots[it.id];
    let status = "尚未放置";
    if (s) {
      status = `已放置 · ${foundCount(it.id)} 人找到`;
      if (myPos) status += ` · 離我 ${Object.values(fmtDist(distM(myPos, s))).join(" ")}`;
    }
    return `<div class="list-item item-row ${it.id === selected ? "sel" : ""}" data-id="${it.id}">
      <div class="item-ico">${it.icon}</div>
      <div class="grow"><div class="t">${esc(it.name)}</div>
        <div class="s">${status}</div></div>
      <button class="btn small here-btn" data-here="${it.id}">📍 放我這</button>
    </div>`;
  }).join("");

  $("#tab-items").querySelectorAll(".item-row").forEach((el) =>
    (el.onclick = () => select(el.dataset.id, true)));
  $("#tab-items").querySelectorAll("[data-here]").forEach((b) =>
    (b.onclick = (e) => {
      e.stopPropagation();
      if (!myPos) return toast("還沒拿到 GPS 位置，請稍候或直接點地圖");
      if (myPos.acc > 30) toast(`目前 GPS 誤差約 ${Math.round(myPos.acc)} 公尺，放好後可拖曳微調`, 3500);
      select(b.dataset.here);
      placeItem(b.dataset.here, myPos.lat, myPos.lng);
    }));

  const it = ITEM[selected];
  $("#mapHint").innerHTML = `${it.icon}<span>點地圖${spots[selected] ? "移動" : "放置"}「${esc(it.name)}」</span>`;
}

/* ---------------- 玩家 ---------------- */
function renderPlayers() {
  const list = Object.entries(players).map(([id, p]) => ({ id, ...p }));
  $("#playerCount").textContent = list.length;
  const n = (p) => ITEMS.filter((it) => p.found?.[it.id]).length;
  list.sort((a, b) => n(b) - n(a));
  $("#tab-players").innerHTML = list.length
    ? list.map((p) => {
        const c = n(p);
        const ago = p.updatedAt ? Math.round((Date.now() - p.updatedAt) / 1000) : null;
        const seen = ago == null ? "尚未定位" : ago < 60 ? `${ago} 秒前` : `${Math.round(ago / 60)} 分鐘前`;
        const icons = ITEMS.filter((it) => p.found?.[it.id]).map((it) => `<span class="mini-ico">${it.icon}</span>`).join("");
        return `<div class="list-item" data-id="${p.id}">
          <div class="num-badge" style="background:${c >= 4 ? "var(--ok)" : "var(--brand)"}">${c}</div>
          <div class="grow"><div class="t">${esc(p.name)} ${c >= 4 ? "🏆" : ""}</div>
          <div class="s">${c}/4 · ${seen}</div></div><div>${icons}</div></div>`;
      }).join("")
    : `<div class="empty">還沒有玩家<br>按上方「玩家連結」分享給大家</div>`;
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
  await update(ref(db, `${ROOT}/meta`), { radius });
  toast("設定已儲存");
}

async function resetProgress() {
  if (!confirm("確定要清空所有玩家的進度嗎？（玩家名單也會清除，物品位置會保留）")) return;
  await remove(ref(db, `${ROOT}/players`));
  toast("已清空");
}

/* ---------------- 分頁 / 分享 ---------------- */
function switchTab(t) {
  document.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("active", b.dataset.tab === t));
  ["items", "players", "settings"].forEach((x) => $(`#tab-${x}`).classList.toggle("hidden", x !== t));
  if ($("#panel").classList.contains("collapsed")) {
    $("#panel").classList.remove("collapsed");
    setTimeout(() => map.invalidateSize(), 50);
  }
}

function closeSheets() {
  document.querySelectorAll(".overlay").forEach((o) => o.classList.add("hidden"));
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

// 每 15 秒刷新「幾秒前」
setInterval(() => renderPlayers(), 15000);

if (requireConfig()) init();
