// 🌻 12 格飽滿記憶大考驗
// 12 格的內容與順序是固定陣列，所有玩家看到的位置都一模一樣，主持人才能針對「第幾格」搶答。

import { toast } from "./common.js";

const INK = "#2b2b2b";
const ST = `fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"`;
const svg = (body) => `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><g ${ST}>${body}</g></svg>`;

function face({ eyes = "dot", mouth = "w", cheeks = false, extra = "" } = {}) {
  const ears = `<circle cx="26" cy="33" r="9"/><circle cx="74" cy="33" r="9"/>`;
  const head = cheeks
    ? `<path d="M18 56 C14 40 32 30 50 30 C68 30 86 40 82 56 C94 62 92 84 74 84 C64 90 36 90 26 84 C8 84 6 62 18 56Z"/>`
    : `<ellipse cx="50" cy="59" rx="33" ry="28"/>`;
  const E = {
    dot: `<circle cx="38" cy="54" r="2.6" fill="${INK}"/><circle cx="62" cy="54" r="2.6" fill="${INK}"/>`,
    closed: `<path d="M33 55 q5 4 10 0 M57 55 q5 4 10 0"/>`,
    big: `<circle cx="38" cy="53" r="6.5"/><circle cx="62" cy="53" r="6.5"/><circle cx="38" cy="53" r="1.8" fill="${INK}"/><circle cx="62" cy="53" r="1.8" fill="${INK}"/>`,
  }[eyes];
  const M = {
    w: `<path d="M44 68 q3 4 6 0 q3 4 6 0"/>`,
    o: `<ellipse cx="50" cy="72" rx="4" ry="5"/>`,
    flat: `<path d="M45 70 h10"/>`,
  }[mouth];
  const nose = `<path d="M47.5 62 l2.5 2.5 l2.5 -2.5"/>`;
  const whisk = `<path d="M24 63 h-12 M24 68 l-10 4 M76 63 h12 M76 68 l10 4"/>`;
  return svg(ears + head + E + nose + M + whisk + extra);
}

function seed(n) {
  const xs = { 2: [44, 56], 3: [40, 50, 60], 4: [37, 45.5, 54.5, 63] }[n];
  const lines = xs.map((x) => `<path d="M${x} 24 Q${x + (x - 50) * 0.35} 53 ${x} 82"/>`).join("");
  return svg(`<path d="M50 8 C74 28 77 68 62 88 C56 94 44 94 38 88 C23 68 26 28 50 8Z"/>` + lines);
}

const cheese = svg(`<path d="M10 72 L90 72 L90 44 L22 28 Z"/><path d="M10 72 L22 28"/>
  <circle cx="42" cy="58" r="6"/><circle cx="68" cy="60" r="4.5"/><circle cx="80" cy="50" r="3"/>`);

const strawberry = svg(`<path d="M50 90 C20 72 16 42 30 35 C40 30 46 34 50 37 C54 34 60 30 70 35 C84 42 80 72 50 90Z"/>
  <path d="M34 34 L40 20 L50 30 L60 20 L66 34"/><path d="M50 30 V14"/>
  <circle cx="38" cy="52" r="1.5" fill="${INK}"/><circle cx="50" cy="50" r="1.5" fill="${INK}"/><circle cx="62" cy="52" r="1.5" fill="${INK}"/>
  <circle cx="44" cy="64" r="1.5" fill="${INK}"/><circle cx="56" cy="64" r="1.5" fill="${INK}"/><circle cx="50" cy="76" r="1.5" fill="${INK}"/>`);

const sunflower = svg(
  Array.from({ length: 10 }, (_, i) => `<ellipse cx="50" cy="22" rx="6" ry="12" transform="rotate(${i * 36} 50 50)"/>`).join("") +
  `<circle cx="50" cy="50" r="14" fill="#fff"/><path d="M42 46 l16 8 M42 54 l16 -8"/>`);

const peanut = svg(`<path d="M50 9 C67 9 71 28 62 40 C58 46 58 54 62 60 C71 72 67 91 50 91 C33 91 29 72 38 60 C42 54 42 46 38 40 C29 28 33 9 50 9Z"/>
  <path d="M42 22 l6 6 M52 18 l6 6 M40 72 l6 6 M52 70 l6 6"/>`);

/** 固定 12 格（3 欄 × 4 列），所有手機都一樣 */
export const CELLS = [
  { label: "開心的鼠鼠", svg: face() },
  { label: "瓜子（2 條線）", svg: seed(2) },
  { label: "起司", svg: cheese },
  { label: "睡覺的鼠鼠", svg: face({ eyes: "closed", mouth: "flat", extra: `<path d="M74 10 h8 l-8 9 h8 M86 2 h6 l-6 7 h6" stroke-width="2.5"/>` }) },
  { label: "戴皇冠的鼠鼠", svg: face({ extra: `<path d="M35 32 L37 15 L44 23 L50 11 L56 23 L63 15 L65 32"/>` }) },
  { label: "草莓", svg: strawberry },
  { label: "臉頰塞滿的鼠鼠", svg: face({ cheeks: true, mouth: "flat" }) },
  { label: "瓜子（3 條線）", svg: seed(3) },
  { label: "戴眼鏡的鼠鼠", svg: face({ extra: `<circle cx="38" cy="54" r="8.5"/><circle cx="62" cy="54" r="8.5"/><path d="M46.5 54 h7"/>` }) },
  { label: "向日葵", svg: sunflower },
  { label: "驚訝的鼠鼠", svg: face({ eyes: "big", mouth: "o" }) },
  { label: "花生", svg: peanut },
];

const LS = "hamster_memory_wall";
const SHOW_MS = 3000;
const DRAW_MS = 3000;

function loadWall() {
  try { const a = JSON.parse(localStorage.getItem(LS) || "null"); return Array.isArray(a) && a.length === 12 ? a : null; }
  catch { return null; }
}
function saveWall(a) { try { localStorage.setItem(LS, JSON.stringify(a)); } catch {} }

export function hasWall() { return !!loadWall(); }

let root = null;

function el(html) {
  const d = document.createElement("div");
  d.innerHTML = html.trim();
  return d.firstChild;
}

function close() {
  if (root) root.remove();
  root = null;
  document.body.classList.remove("no-scroll");
}

function mount(inner) {
  if (!root) {
    root = el(`<div class="mem"></div>`);
    document.body.appendChild(root);
    document.body.classList.add("no-scroll");
  }
  root.innerHTML = inner;
  return root;
}

function grid(cells, cls = "") {
  return `<div class="mem-grid ${cls}">${cells.map((c, i) =>
    `<div class="mem-cell"><span class="no">${i + 1}</span>${c}</div>`).join("")}</div>`;
}

/** 開啟遊戲。startAt: "intro" | "wall" */
export function openMemoryGame(startAt = "intro") {
  if (startAt === "wall" && loadWall()) return showWall(loadWall(), false);
  intro();
}

function intro() {
  const r = mount(`
    <div class="mem-top"><b>🌻 12 格飽滿記憶大考驗</b><button class="close" data-x>×</button></div>
    <div class="mem-body center-col">
      <div class="mem-rules">
        <p>① 等主持人喊「1、2、3 開始！」再按下面的按鈕</p>
        <p>② 12 格圖只出現 <b>3 秒</b>，盡量塞進腦袋！</p>
        <p>③ 算對一題數學題才能解鎖畫布</p>
        <p>④ 每格限時 <b>3 秒</b>，憑記憶畫出第 1～12 格</p>
      </div>
      <button class="btn mem-go" data-start>🚀 開始挑戰</button>
      ${loadWall() ? `<button class="btn secondary" data-wall>🖼️ 看我上次的作品牆</button>` : ""}
    </div>`);
  r.querySelector("[data-x]").onclick = close;
  r.querySelector("[data-start]").onclick = showGrid;
  const w = r.querySelector("[data-wall]");
  if (w) w.onclick = () => showWall(loadWall(), false);
}

function showGrid() {
  const r = mount(`
    <div class="mem-top"><b>記住它們！</b><span class="mem-count" id="memCount">3</span></div>
    <div class="mem-body">${grid(CELLS.map((c) => c.svg), "big")}</div>
    <div class="mem-bar"><div style="animation-duration:${SHOW_MS}ms"></div></div>`);
  let left = 3;
  const t = setInterval(() => {
    left -= 1;
    const c = r.querySelector("#memCount");
    if (c) c.textContent = Math.max(left, 0);
  }, 1000);
  setTimeout(() => { clearInterval(t); math(); }, SHOW_MS);
}

function math() {
  let a = 10 + Math.floor(Math.random() * 90);
  let b = 10 + Math.floor(Math.random() * 90);
  const plus = Math.random() < 0.5;
  if (!plus && b > a) [a, b] = [b, a];
  const ans = plus ? a + b : a - b;
  const r = mount(`
    <div class="mem-top"><b>🧮 先算出答案才能解鎖畫布！</b></div>
    <div class="mem-body center-col">
      <div class="mem-q">${a} ${plus ? "+" : "−"} ${b} = ?</div>
      <input class="mem-ans" id="memAns" type="number" inputmode="numeric" pattern="[0-9]*" autocomplete="off">
      <button class="btn" data-ok>🔓 解鎖</button>
    </div>`);
  const inp = r.querySelector("#memAns");
  setTimeout(() => inp.focus(), 50);
  const check = () => {
    if (Number(inp.value) === ans) { inp.blur(); draw(); }
    else {
      inp.classList.remove("shake"); void inp.offsetWidth; inp.classList.add("shake");
      inp.value = "";
      toast("答錯了，再算一次！");
    }
  };
  r.querySelector("[data-ok]").onclick = check;
  inp.addEventListener("keydown", (e) => e.key === "Enter" && check());
}

function draw() {
  const r = mount(`
    <div class="mem-top"><b>憑記憶畫出 <span class="mem-cellno" id="memNo">第 1 格</span></b><span class="muted" id="memOf">1 / 12</span></div>
    <div class="mem-body center-col">
      <div class="mem-mini" id="memMini"></div>
      <canvas class="mem-canvas" id="memCanvas"></canvas>
    </div>
    <div class="mem-bar"><div id="memBar"></div></div>`);
  const cv = r.querySelector("#memCanvas");
  const size = Math.floor(Math.min(window.innerWidth - 32, window.innerHeight - 230, 560));
  const dpr = window.devicePixelRatio || 1;
  cv.style.width = cv.style.height = size + "px";
  cv.width = cv.height = size * dpr;
  const ctx = cv.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.lineCap = ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(4, size / 70);
  ctx.strokeStyle = INK;

  let drawing = false;
  let last = null;
  const pt = (e) => { const b = cv.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
  cv.addEventListener("pointerdown", (e) => {
    drawing = true; last = pt(e);
    try { cv.setPointerCapture(e.pointerId); } catch {}
    ctx.beginPath(); ctx.arc(last.x, last.y, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fillStyle = INK; ctx.fill();
  });
  cv.addEventListener("pointermove", (e) => {
    if (!drawing) return;
    const p = pt(e);
    ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    last = p;
  });
  const stop = () => { drawing = false; };
  cv.addEventListener("pointerup", stop);
  cv.addEventListener("pointercancel", stop);

  const out = [];
  let k = 0;
  const mini = r.querySelector("#memMini");
  const next = () => {
    r.querySelector("#memNo").textContent = `第 ${k + 1} 格`;
    r.querySelector("#memOf").textContent = `${k + 1} / 12`;
    mini.innerHTML = Array.from({ length: 12 }, (_, i) => `<i class="${i < k ? "done" : i === k ? "now" : ""}"></i>`).join("");
    ctx.clearRect(0, 0, size, size);
    const bar = r.querySelector("#memBar");
    bar.style.animation = "none"; void bar.offsetWidth;
    bar.style.animation = `memBar ${DRAW_MS}ms linear forwards`;
    setTimeout(() => {
      drawing = false;
      out.push(snapshot(cv));
      k += 1;
      if (k < 12) next();
      else { saveWall(out); showWall(out, true); }
    }, DRAW_MS);
  };
  next();
}

function snapshot(cv) {
  const s = 200;
  const c = document.createElement("canvas");
  c.width = c.height = s;
  const x = c.getContext("2d");
  x.fillStyle = "#fff";
  x.fillRect(0, 0, s, s);
  x.drawImage(cv, 0, 0, s, s);
  return c.toDataURL("image/png");
}

function showWall(imgs, fresh) {
  let showOriginal = false;
  const render = () => {
    const r = mount(`
      <div class="mem-top"><b>${showOriginal ? "👀 原圖對照" : "🎨 我的作品牆"}</b><button class="close" data-x>×</button></div>
      <div class="mem-body">
        ${fresh && !showOriginal ? `<p class="mem-tip">把手機螢幕朝上放到中間，等主持人搶答！</p>` : ""}
        ${grid(showOriginal ? CELLS.map((c) => c.svg) : imgs.map((u) => `<img src="${u}" alt="">`), showOriginal ? "big" : "big wall")}
      </div>
      <div class="mem-actions">
        <button class="btn ${showOriginal ? "" : "secondary"}" data-toggle>${showOriginal ? "🎨 看我的作品" : "👀 原圖對照"}</button>
        <button class="btn secondary" data-again>🔁 再挑戰一次</button>
      </div>`);
    r.querySelector("[data-x]").onclick = close;
    r.querySelector("[data-toggle]").onclick = () => { showOriginal = !showOriginal; render(); };
    r.querySelector("[data-again]").onclick = () => {
      if (confirm("再挑戰一次會覆蓋這次的作品，確定嗎？")) intro();
    };
  };
  render();
}
