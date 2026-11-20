// 🌻 12 格飽滿記憶大考驗（主持人出題版）
// 主持人在主持人頁面一格一格念出題目（文字，可在主持人頁面修改），玩家憑印象畫下來；
// 每按一次「下一格」，所有玩家同步換格。畫完顯示完整 12 宮格，主持人搶答後按「公布答案」，
// 每格下方才會出現題目文字；最後主持人按完成結束這關。

const INK = "#2b2b2b";

/** 預設的 12 題（主持人可以在主持人頁面修改，存在資料庫 hamster/prompts） */
export const DEFAULT_PROMPTS = [
  "籃球 (Basketball)",
  "足球 (Soccer / Football)",
  "棒球 (Baseball)",
  "排球 (Volleyball)",
  "網球 (Tennis)",
  "桌球 (Table Tennis / Ping Pong)",
  "羽球 (Badminton)",
  "高爾夫球 (Golf)",
  "撞球 (Billiards / Pool)",
  "美式足球 (American Football)",
  "橄欖球 (Rugby)",
  "保齡球 (Bowling)",
];

/** 資料庫內容 + 預設值 → 12 題 */
export function mergePrompts(saved) {
  return DEFAULT_PROMPTS.map((d, i) => {
    const v = saved?.[i];
    return typeof v === "string" && v.trim() ? v.trim() : d;
  });
}

const LS_WALL = "hamster_memory_wall";   // 最近一次的作品 { imgs: [12], answers: [12] | null }
const LS_ROUND = "hamster_memory_round"; // 進行中的回合 { id, out }，重新整理後可接續

function loadWall() {
  try {
    const w = JSON.parse(localStorage.getItem(LS_WALL) || "null");
    return w && Array.isArray(w.imgs) && w.imgs.length === 12 ? w : null;
  } catch { return null; }
}
function saveWall(w) { try { localStorage.setItem(LS_WALL, JSON.stringify(w)); } catch {} }
function loadRound() {
  try { return JSON.parse(localStorage.getItem(LS_ROUND) || "null"); } catch { return null; }
}
function saveRound(id, out) { try { localStorage.setItem(LS_ROUND, JSON.stringify({ id, out })); } catch {} }

export function hasWall() { return !!loadWall(); }

let root = null;
let mode = null;    // "draw" | "wall"
let session = null; // { id, k, out, revealed }
let canvas = null;  // { cv, ctx, size }

function mount(inner, m) {
  if (!root) {
    root = document.createElement("div");
    root.className = "mem";
    document.body.appendChild(root);
    document.body.classList.add("no-scroll");
  }
  root.innerHTML = inner;
  mode = m;
  return root;
}

/** 關掉畫面（主持人按完成時呼叫） */
export function closeGame() {
  if (root) root.remove();
  root = null;
  mode = null;
  canvas = null;
  document.body.classList.remove("no-scroll");
}

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

/** 從「我的 12 宮格」按鈕開啟（可關閉） */
export function openWall() {
  const w = loadWall();
  if (w) showWall(w.imgs, w.answers, false);
}

/**
 * 跟著主持人的進度走。
 * round = { id, cell, revealed }：cell 0～11 = 正在畫第 cell+1 格，12 = 畫完了；revealed = 已公布答案。
 * prompts = 12 題文字（公布答案時顯示）。
 */
export function syncRound(round, prompts) {
  if (!round?.id || typeof round.cell !== "number") return;
  const k = Math.max(0, Math.min(12, round.cell));
  const revealed = k >= 12 && !!round.revealed;

  if (!session || session.id !== round.id) {
    const saved = loadRound();
    const resumed = saved?.id === round.id && Array.isArray(saved.out);
    if (k >= 12 && !resumed) return; // 這回合沒參加到，就不打擾
    session = { id: round.id, k: null, out: resumed ? saved.out : Array(12).fill(null), revealed: null };
    if (!resumed) saveRound(round.id, session.out);
  }

  if (k === session.k) {
    if (k < 12 && mode !== "draw") enterCell(k);                       // 例如重新整理後補回畫面
    if (k >= 12 && (mode !== "wall" || session.revealed !== revealed)) finish(revealed, prompts);
    return;
  }

  // 把剛剛那一格存起來
  if (session.k !== null && session.k < 12 && mode === "draw" && canvas) {
    session.out[session.k] = snapshot(canvas.cv);
    saveRound(session.id, session.out);
  }
  session.k = k;
  if (k >= 12) finish(revealed, prompts);
  else enterCell(k);
}

function finish(revealed, prompts) {
  session.revealed = revealed;
  const imgs = session.out.map((u) => u || blank());
  const answers = revealed ? prompts : null;
  saveWall({ imgs, answers });
  showWall(imgs, answers, true);
  if (revealed) { try { navigator.vibrate?.([60, 40, 60]); } catch {} }
}

function enterCell(k) {
  if (mode !== "draw" || !canvas) buildCanvas();
  const r = root;
  canvas.ctx.clearRect(0, 0, canvas.size, canvas.size);
  r.querySelector("#memTitle").innerHTML = `畫出 <span class="mem-cellno">第 ${k + 1} 格</span>`;
  r.querySelector("#memOf").textContent = `${k + 1} / 12`;
  r.querySelector("#memMini").innerHTML = Array.from({ length: 12 }, (_, i) =>
    `<i class="${i < k ? "done" : i === k ? "now" : ""}"></i>`).join("");
  const stage = r.querySelector(".mem-stage");
  stage.classList.remove("flash"); void stage.offsetWidth; stage.classList.add("flash");
  try { navigator.vibrate?.(60); } catch {}
}

function buildCanvas() {
  const r = mount(`
    <div class="mem-top"><b id="memTitle"></b><span class="muted" id="memOf"></span></div>
    <div class="mem-body center-col">
      <div class="mem-mini" id="memMini"></div>
      <div class="mem-stage"><canvas class="mem-canvas" id="memCanvas"></canvas></div>
      <p class="muted" style="margin:6px 0 0">聽主持人出題，主持人說「下一格」畫面就會自動換</p>
    </div>`, "draw");

  const cv = r.querySelector("#memCanvas");
  const size = Math.floor(Math.min(window.innerWidth - 32, window.innerHeight - 190, 560));
  const dpr = window.devicePixelRatio || 1;
  cv.style.width = cv.style.height = size + "px";
  cv.width = cv.height = size * dpr;
  const ctx = cv.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.lineCap = ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(4, size / 70);
  ctx.strokeStyle = ctx.fillStyle = INK;
  canvas = { cv, ctx, size };

  let drawing = false;
  let last = null;
  const pt = (e) => { const b = cv.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
  cv.addEventListener("pointerdown", (e) => {
    drawing = true; last = pt(e);
    try { cv.setPointerCapture(e.pointerId); } catch {}
    ctx.beginPath(); ctx.arc(last.x, last.y, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill();
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

function blank() {
  const c = document.createElement("canvas");
  c.width = c.height = 20;
  const x = c.getContext("2d");
  x.fillStyle = "#fff";
  x.fillRect(0, 0, 20, 20);
  return c.toDataURL("image/png");
}

/** waiting = true：剛畫完，固定顯示直到主持人按完成（不能關掉）；answers = 已公布的題目文字 */
function showWall(imgs, answers, waiting) {
  const cells = imgs.map((u, i) => `<div class="mem-cell"><span class="no">${i + 1}</span><img src="${u}" alt="">
      ${answers ? `<div class="ans">${esc(answers[i])}</div>` : ""}</div>`).join("");
  const r = mount(`
    <div class="mem-top"><b>🎨 我的 12 宮格</b>${waiting ? "" : `<button class="close" data-x>×</button>`}</div>
    <div class="mem-body">
      ${waiting ? `<p class="mem-tip">${answers ? "📢 主持人公布答案了！你畫對了幾格？" : "把手機螢幕朝上放到中間，等主持人搶答！"}</p>` : ""}
      <div class="mem-grid big wall ${answers ? "answered" : ""}">${cells}</div>
    </div>
    ${waiting ? `<div class="mem-wait-done">${answers ? "" : "📢 等主持人公布答案… "}⏳ 主持人按「完成」後結束這關<span class="dots"></span></div>` : ""}`, "wall");
  r.querySelector("[data-x]")?.addEventListener("click", closeGame);
}
