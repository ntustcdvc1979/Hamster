import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js?v=202611210100";

export {
  ref, set, update, remove, onValue, get, serverTimestamp,
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

/** 預設內容，依尋找順序排列（主持人可在主持人頁面修改 name / mission / meaning / question） */
export const ITEMS = [
  {
    id: "seed",
    name: "飽滿的瓜子",
    sub: "頰囊囤糧",
    color: "#3b3330",
    activity: "memory",
    meaning: "鼠鼠遇到喜歡的食物總想一次全部塞進頰囊，塞得太滿時，連走路都變得笨重。就像剛剛的 12 格記憶考驗一樣，當我們試圖把所有事物、待辦事項與焦慮一股腦全往生命裡塞，只要一點點干擾（就像那題數學題），原本想抓住的東西反而容易遺忘。\n\n安全感不是靠「全部擁有」換來的，懂得為自己篩選、留白，才能真正留住最重要的事物。",
    question: "【基礎題】剛剛在 3 秒高壓作畫時，你的腦袋是不是一片空白？在 12 格裡面，你印象最深刻、畫得最有自信的是哪一格？為什麼那一格特別留得住？\n\n【延伸題】回到大學生活裡，你最近最常往自己生命裡「囤積」什麼（例如：學分、活動、待辦清單或焦慮）？如果現在必須從滿滿的頰囊裡「吐出幾顆瓜子」放手，你最想先放下哪一件事？",
    mission: "【12 格飽滿記憶大考驗】\n① 全組到齊後，主持人按下開始，大家的手機會直接進入畫布。\n② 主持人一格一格念出題目，聽到就畫下來；主持人說「下一格」，畫面會自動換到下一格。\n③ 12 格畫完，手機會顯示你的完整 12 宮格，把螢幕朝上放在中間，等主持人搶答，最後主持人會公布答案！\n④ 主持人按「完成」後就結束這關。",
  },
  {
    id: "nest",
    name: "柔軟紙棉",
    sub: "築巢墊材",
    color: "#d9a37a",
    activity: "photo",
    meaning: "視力不好的鼠鼠，是靠著一片片撕碎的紙棉，為自己築出能安心睡覺的窩。它提醒我們：真正能接住生命的，往往不是驚天動地的大事，而是那些微小卻溫柔的日常細節。",
    question: "今天服務中哪個微小的動作讓你覺得「對牠來說很重要」？生活裡又是誰給過你這樣的安全感？",
    mission: "【鼠鼠視角微距攝影】\n4 個人把手機鏡頭貼近地面、草叢或牆角（模擬鼠鼠身高只有幾公分的視角），各自拍下一張「鼠鼠眼中的世界」。\n\n拍好後回來圍成一圈展示照片，分享：「如果你是一隻鼠鼠，看到這個畫面會有什麼感覺？覺得安全、害怕，還是新奇？」\n\n💭 蹲低身體換個視角，才能體會小生命在龐大環境裡需要尋找安全感的心情。",
  },
  {
    id: "wheel",
    name: "滾輪",
    color: "#4a8fd8",
    activity: "spin",
    meaning: "鼠鼠在滾輪上日夜狂奔，雙腳跑得飛快，實際上卻一步也沒有往前。就像剛剛閉著眼睛跟著指令轉得團團轉一樣，明明理論上應該回到原本面向的正前方，但當我們只顧著被動回應各種突發任務、別人的期待與眼前的忙碌，卻沒有停下來確認自己心裡的座標時，忙完一輪張開眼才發現自己早就偏離了原本的方向。忙碌本身並不等於前進；偶爾停下來張開眼睛確認方位，比一直跑更重要。",
    question: "【回顧體驗】剛剛閉著眼睛一直轉時，你是不是以為自己還面向原本的地方？張開眼發現身體早就歪掉時有什麼感覺？\n\n【連結生活】最近這段時間，你每天都在奔跑的事情（課業、社團、實習或生活瑣事），是真正帶你往目標前進的跑道，還是讓你轉得頭暈、卻在原地空轉的滾輪？",
    mission: "【盲眼「原地自轉迷航記」】\n① 全組到齊後，請 4 個人在空地站開一點，全部面向同一個指定的起點目標（例如正對著司令台或某棵大樹），並把這個方向記在心裡。\n② 主持人會依序挑戰簡單、中等、困難三道關卡。每一輪開始前大家必須閉上眼睛，跟著主持人念出的一連串指令轉動身體與踏步。\n③ 指令結束後，大家保持閉眼，直接伸出手指出「你認為原本面向的起點目標現在在哪裡」，指好後主持人喊「張開眼睛」，看看誰能精準指回正前方、誰又轉到徹底迷航！\n④ 三輪挑戰結束後，由主持人點名偏離最誇張的同學，分享剛才「閉眼轉動時的感覺」，即可解鎖本關寶物。",
  },
  {
    id: "chew",
    name: "蘋果木磨牙棒",
    color: "#b5793f",
    activity: "album",
    meaning: "蘋果木帶有天然的果木香氣，是鼠鼠在陌生環境裡最安心的陪伴。我們在忙碌與壓力之中，也都需要找到屬於自己的「精神蘋果木」，在快要被焦慮淹沒時，隨時拿出來為自己充電與安撫情緒。",
    question: "遇到卡關或需要耐心的時刻，你通常用什麼方式幫自己「磨牙」排解壓力？",
    mission: "【手機相簿「尋找你的精神蘋果木」】\n每個人的減壓方式都不一樣，用一張照片分享你的療癒物！\n\n① 主持人喊開始後，你有 15 秒，在手機相簿裡翻出一張「每次看到就能讓你瞬間放鬆、心情變好」的照片（可能是食物、寵物、風景或梗圖）。可以按下面的按鈕直接從相簿挑。\n② 15 秒一到，主持人喊「亮手機！」，4 個人同時把螢幕轉向中間。\n③ 先不准主人開口！另外 3 個人搶答猜猜看，這張照片的主人是怎麼靠它紓壓的？猜完後再由照片主人揭曉答案。",
  },
].map((it, i) => ({ ...it, order: i + 1, icon: ICONS[it.id] }));

export const ITEM = Object.fromEntries(ITEMS.map((it) => [it.id, it]));

/** 主持人可以修改的欄位 */
export const EDITABLE = [
  { key: "name", label: "物品名稱", rows: 1 },
  { key: "mission", label: "找到後的小任務", rows: 6 },
  { key: "meaning", label: "✨ 獲得意義（主持人按完成後顯示）", rows: 6 },
  { key: "question", label: "💬 給自己的一句話", rows: 5 },
];

/** 預設內容 + 主持人在資料庫裡的修改 */
export function mergeItems(overrides) {
  return ITEMS.map((it) => {
    const o = overrides?.[it.id] || {};
    const out = { ...it };
    EDITABLE.forEach(({ key }) => { if (typeof o[key] === "string" && o[key].trim()) out[key] = o[key]; });
    return out;
  });
}

/** 校園尺度的「鼠鼠嗅覺」提示（永吉國中校區約 185 × 210 公尺） */
export function heatLevel(d, radius = 15) {
  if (d > 120) return [0, "🐾 鼠鼠什麼味道都聞不到…"];
  if (d > 70) return [1, "👃 好像聞到一點點味道了"];
  if (d > 40) return [2, "🐹 鬍鬚動了動！味道變明顯了"];
  if (d > Math.max(radius + 8, 20)) return [3, "💨 香味撲鼻！就在不遠處"];
  return [4, "💛 鼠鼠興奮到轉圈圈！就在附近！"];
}

/** 走動時的變化提示 */
export const TREND = { closer: "🐾 方向對了，味道越來越濃！", farther: "🌀 味道變淡了，換個方向試試…" };

/** 地圖預設中心：台北市立永吉國中 */
export const MAP_CENTER = [25.04829, 121.57347];

/** 主持人開場介紹（只顯示在主持人頁面） */
export const INTRO_TEXT = `歡迎來到今天的鼠鼠志工特別企劃！無論你正準備走進愛鼠協會、挽起袖子照顧這群可愛的小生命，或是剛剛才結束一場充實的照護服務，在把溫柔與耐心分給鼠鼠的同時，我們更想邀請你，花一點時間好好照顧「住在自己心裡的那隻倉鼠」。

其實，我們每個人心裡都住著一隻小小的倉鼠：有時候在生活的跑道上拼命狂奔、卻不確定方向；有時候把所有期待與煩惱都塞進心裡，重得快要走不動；有時候則在龐大的世界裡小心翼翼，尋找一個能讓自己安心喘息的角落。

接下來，這座校園裡散落著四樣屬於鼠鼠的日常寶物。請跟身邊的夥伴一起跟著距離提示出發，透過四個有趣的小挑戰，體驗鼠鼠眼中的世界，也把這份覺察帶回自己的生活裡，找齊照顧「內心倉鼠」的四把鑰匙吧！`;

/** 收尾（四關都完成後顯示在玩家畫面） */
export const OUTRO_TITLE = "恭喜你們，找到了內心的那隻倉鼠！";
export const OUTRO_TEXT = `走完這四個角落、解鎖了四樣寶物，你是不是也看見了自己平時的影子呢？

大學生活就像一座忙碌的遊樂場，我們常在課業、社團與社交的「滾輪」上日夜狂奔，習慣把焦慮與待辦事項全塞進「頰囊」，卻忘了像貼近「柔軟紙棉」一樣蹲下來看看周遭的風景，也忘了幫自己找一根能安心紓壓的「蘋果木」。

透過這四個小挑戰，我們重新認識了鼠鼠的世界，也練習溫柔地接住那個在忙碌裡有點疲憊的自己。願今天這份換位思考與自我覺察，能成為一份溫暖的力量，陪你走過接下來的每一段日常！`;

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

/** 已經放好位置的物品（依順序） [{...item, lat, lng}] */
export function placedItems(spots, items = ITEMS) {
  return items.filter((it) => spots?.[it.id]?.lat != null)
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
