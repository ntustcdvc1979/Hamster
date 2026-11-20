import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

export {
  ref, set, update, push, remove, onValue, get, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

export const configured = !Object.values(firebaseConfig).some((v) => String(v).includes("YOUR_"));
export const db = configured ? getDatabase(initializeApp(firebaseConfig)) : null;

export const $ = (s, el = document) => el.querySelector(s);

/** 兩點距離（公尺），Haversine */
export function distM(a, b) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function fmtDist(d) {
  if (d < 1000) return { num: String(Math.round(d)), unit: "公尺" };
  return { num: (d / 1000).toFixed(d < 10000 ? 2 : 1), unit: "公里" };
}

export function genCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

/** 依建立時間排序後的地點陣列 [{id, ...}] */
export function sortedSpots(spots) {
  return Object.entries(spots || {})
    .map(([id, s]) => ({ id, ...s }))
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
}

export function toast(msg, ms = 2200) {
  let t = $("#toast");
  if (!t) {
    t = document.createElement("div");
    t.id = "toast";
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._h);
  t._h = setTimeout(() => t.classList.remove("show"), ms);
}

export function fatal(html) {
  document.body.innerHTML = `<div class="screen center"><div class="card">
    <div class="big-emoji">🐹💦</div>${html}</div></div>`;
}

export function requireConfig() {
  if (configured) return true;
  fatal(`<h2>還沒設定 Firebase</h2>
    <p>請打開 <code>public/firebase-config.js</code>，把裡面的 <code>YOUR_...</code> 換成你 Firebase 專案的設定，再重新整理。</p>
    <p class="muted">詳細步驟請看 README.md</p>`);
  return false;
}

export function requireSecure() {
  if (window.isSecureContext && "geolocation" in navigator) return true;
  toast("⚠️ GPS 需要 https 網址才能使用", 5000);
  return false;
}
