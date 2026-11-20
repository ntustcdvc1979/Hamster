import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

export {
  ref, set, update, remove, onValue, get,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

export const configured = !Object.values(firebaseConfig).some((v) => String(v).includes("YOUR_"));
export const db = configured ? getDatabase(initializeApp(firebaseConfig)) : null;

/** 資料庫根路徑（整個活動只有一場遊戲） */
export const ROOT = "hamster";

/* ---------------- 四個固定物品 ---------------- */
const ICONS = {
  wheel: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <path d="M18 60 L32 31 L46 60" stroke="#8a6a4f" stroke-width="4.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M14 60 H50" stroke="#8a6a4f" stroke-width="4.5" stroke-linecap="round"/>
    <circle cx="32" cy="29" r="23" fill="#eaf4ff" stroke="#4a8fd8" stroke-width="5"/>
    <circle cx="32" cy="29" r="16.5" fill="none" stroke="#9cc6f2" stroke-width="2.5" stroke-dasharray="4 3.2"/>
    <g stroke="#4a8fd8" stroke-width="2.5" stroke-linecap="round">
      <path d="M32 29 L32 8"/><path d="M32 29 L50 18.5"/><path d="M32 29 L50 39.5"/>
      <path d="M32 29 L32 50"/><path d="M32 29 L14 39.5"/><path d="M32 29 L14 18.5"/>
    </g>
    <circle cx="32" cy="29" r="5" fill="#4a8fd8"/><circle cx="32" cy="29" r="2" fill="#fff"/>
  </svg>`,
  nest: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="32" cy="46" rx="27" ry="12" fill="#e9d6b8"/>
    <path d="M6 42 Q32 62 58 42 Q56 30 32 30 Q8 30 6 42Z" fill="#fffaf0" stroke="#d8c2a0" stroke-width="2"/>
    <g fill="none" stroke-linecap="round" stroke-width="3.2">
      <path d="M12 40 q6 -8 12 -2 t12 -2" stroke="#f7d9e3"/>
      <path d="M24 46 q6 -7 12 -1 t12 -3" stroke="#d9ecf7"/>
      <path d="M14 47 q5 -5 10 0" stroke="#fde9b6"/>
      <path d="M38 38 q5 -6 11 0" stroke="#f7d9e3"/>
      <path d="M20 34 q6 -6 12 0 t12 0" stroke="#ffffff"/>
    </g>
    <g stroke="#cdb48f" stroke-width="1.6" fill="none" stroke-linecap="round">
      <path d="M17 31 l-3 -9"/><path d="M27 29 l1 -11"/><path d="M38 29 l4 -10"/><path d="M47 32 l6 -7"/>
    </g>
    <rect x="12" y="15" width="5" height="9" rx="1" fill="#fffaf0" stroke="#d8c2a0" transform="rotate(-18 14 19)"/>
    <rect x="25" y="11" width="5" height="10" rx="1" fill="#fbe3ea" stroke="#d8c2a0" transform="rotate(4 27 16)"/>
    <rect x="38" y="13" width="5" height="9" rx="1" fill="#e3f0fa" stroke="#d8c2a0" transform="rotate(20 40 17)"/>
  </svg>`,
  seed: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <path d="M32 4 C48 16 52 38 44 52 C40 59 24 59 20 52 C12 38 16 16 32 4Z" fill="#3b3330" stroke="#211b19" stroke-width="2"/>
    <path d="M32 9 C30 24 30 40 32 56" stroke="#f3eee6" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M25 14 C21 26 21 40 25 52" stroke="#e8e0d4" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <path d="M39 14 C43 26 43 40 39 52" stroke="#e8e0d4" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <ellipse cx="26" cy="20" rx="2.5" ry="5" fill="#fff" opacity=".35" transform="rotate(20 26 20)"/>
  </svg>`,
  chew: `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <g transform="rotate(-38 32 32)">
      <rect x="6" y="24" width="48" height="16" rx="7" fill="#c98f5a" stroke="#8a5a32" stroke-width="2.4"/>
      <path d="M14 27 q4 5 0 10 M24 27 q-3 5 1 10 M36 27 q3 5 -1 10 M45 27 q-3 5 0 10" stroke="#a46d3d" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <ellipse cx="54" cy="32" rx="4.5" ry="8" fill="#f2cf9f" stroke="#8a5a32" stroke-width="2.2"/>
      <ellipse cx="54" cy="32" rx="2" ry="4" fill="none" stroke="#c98f5a" stroke-width="1.4"/>
      <path d="M17 24 q1 -9 9 -11 q-1 8 -9 11Z" fill="#6cbf5a" stroke="#3f8a33" stroke-width="1.5"/>
    </g>
    <circle cx="13" cy="13" r="6.5" fill="#e5463a"/><path d="M13 7 q1 -3 3 -4" stroke="#6b4a2b" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    <ellipse cx="10.5" cy="11" rx="1.6" ry="2.4" fill="#fff" opacity=".5"/>
  </svg>`,
};

export const ITEMS = [
  {
    id: "wheel",
    name: "靜音滾輪",
    color: "#4a8fd8",
    meaning: "在有限的空間裡日夜奔跑，滾輪讓鼠鼠釋放精力，但太小的滾輪卻會讓脊椎受傷。它提醒我們：忙碌本身不是目的，找到適合自己的節奏與方向，才不會在原地空轉。",
    question: "你最近每天都在奔跑的事情，是讓你成長的跑道，還是讓你喘不過氣的滾輪？",
  },
  {
    id: "nest",
    name: "柔軟紙棉",
    sub: "築巢墊材",
    color: "#d9a37a",
    meaning: "視力不好的鼠鼠，是靠著一片片撕碎的紙棉，為自己築出能安心睡覺的窩。它提醒我們：真正能接住生命的，往往不是驚天動地的大事，而是那些微小卻溫柔的日常細節。",
    question: "今天服務中哪個微小的動作讓你覺得「對牠來說很重要」？生活裡又是誰給過你這樣的安全感？",
  },
  {
    id: "seed",
    name: "飽滿的瓜子",
    sub: "頰囊囤糧",
    color: "#3b3330",
    meaning: "鼠鼠遇到喜歡的食物會先塞滿臉頰帶回窩裡，但塞得太滿時，其實連咀嚼都變得困難。它提醒我們：安全感不是靠無止盡的囤積換來的，適時把空間留出來，才能真正品嚐當下的滿足。",
    question: "面對未來的焦慮，你最常往自己生命裡「囤積」什麼？現在有什麼是你可以放心分享出去的？",
  },
  {
    id: "chew",
    name: "蘋果木磨牙棒",
    color: "#b5793f",
    meaning: "鼠鼠的門牙終生都會不斷生長，必須靠一次次啃咬硬物，才能維持剛好的長度。它提醒我們：生活裡的摩擦與難題不會自動消失，但每一次耐心的面對與調適，都在幫我們修整出更好的狀態。",
    question: "遇到卡關或需要耐心的時刻，你通常用什麼方式幫自己「磨牙」排解壓力？",
  },
].map((it) => ({ ...it, icon: ICONS[it.id] }));

export const ITEM = Object.fromEntries(ITEMS.map((it) => [it.id, it]));

/* ---------------- 工具 ---------------- */
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

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

/** 已經放好位置的物品 [{...item, lat, lng}] */
export function placedItems(spots) {
  return ITEMS.filter((it) => spots?.[it.id]?.lat != null)
    .map((it) => ({ ...it, lat: spots[it.id].lat, lng: spots[it.id].lng }));
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
    <p>請打開 <code>docs/firebase-config.js</code>，把裡面的 <code>YOUR_...</code> 換成你 Firebase 專案的設定，再重新整理。</p>`);
  return false;
}

export function requireSecure() {
  if (window.isSecureContext && "geolocation" in navigator) return true;
  toast("⚠️ GPS 需要 https 網址才能使用", 5000);
  return false;
}
