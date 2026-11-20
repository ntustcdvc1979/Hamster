// 每次更新網站前執行：node bump-version.js
// 幫 docs/ 裡的 .js / .css 連結加上新的版本號（?v=...），
// 讓玩家手機不會拿到「新的 HTML + 舊的 JS」這種混在一起的快取版本（GitHub Pages 會快取 10 分鐘）。
const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "docs");
const v = new Date().toISOString().replace(/\D/g, "").slice(0, 12); // 例如 202611211530
const local = /((?:src|href)="|from ")(\.\/)?((?:common|memory|host|player|firebase-config)\.js|style\.css)(\?v=\w+)?"/g;

for (const f of fs.readdirSync(dir)) {
  if (!/\.(html|js)$/.test(f)) continue;
  const p = path.join(dir, f);
  const s = fs.readFileSync(p, "utf8");
  const out = s.replace(local, (_, pre, dot, file) => `${pre}${dot || ""}${file}?v=${v}"`);
  if (out !== s) {
    fs.writeFileSync(p, out);
    console.log(`${f}: v=${v}`);
  }
}
