# 🐹 尋找內心的倉鼠

用手機玩的真實地點尋寶遊戲。主持人在地圖上藏 N 個寶物，玩家拿著手機靠 GPS 找出它們。

- `docs/host.html`：**主持人畫面**。在地圖上點一下就能新增地點、填入寶物名稱（例如「葵花籽」）和文字描述；可以拖曳圖釘微調、切換衛星圖、按 ➕ 直接用「我現在的位置」新增。也能即時看到每位玩家的位置和進度。
- `docs/player.html`：**玩家畫面**。輸入代碼加入後，畫面會顯示「離最近、還沒找到的地點還有幾公尺」，加上冷/熱提示和「越來越近/越來越遠」。走到判定範圍內，「我找到了！」按鈕才會亮起，按下去就跳出主持人寫的寶物和描述。

後端是 Firebase Realtime Database（即時同步），網站架在 GitHub Pages（GPS 一定要 https 才能用）。

---

## 網址

- 首頁：<https://ntustcdvc1979.github.io/Hamster/>
- 主持人：<https://ntustcdvc1979.github.io/Hamster/host.html>
- 玩家：<https://ntustcdvc1979.github.io/Hamster/player.html>

網站放在 GitHub Pages（`main` 分支的 `docs/` 資料夾），資料存在 Firebase 專案 `hamster-hunt-2026` 的 Realtime Database。

## 更新網站

改完 `docs/` 裡的檔案後 commit 並 push 到 `main`，GitHub Pages 約 1 分鐘內自動更新。

## 更新資料庫規則

改了 [database.rules.json](database.rules.json) 才需要：

```bash
firebase deploy --only database
```

## 玩法

1. 主持人用手機開主持人網址 → 建立新遊戲 → 得到 4 碼代碼
2. 在地圖上點要藏寶物的位置，填寫寶物名稱與描述（建議主持人事先到現場，按 ➕ 用目前位置新增最準）
3. 「設定」分頁可以調整找到的判定範圍（預設 15 公尺）
4. 按「邀請玩家」→ 讓玩家掃 QR code 或輸入代碼
5. 玩家允許定位權限後就能開始找

## 注意事項

- **GPS 誤差**：戶外一般 5–15 公尺，室內、高樓旁會更差。判定範圍建議 10–20 公尺；地點之間最好距離 30 公尺以上，不然提示容易混淆。
- **iPhone**：Safari 要允許「定位服務」（設定 → 隱私權 → 定位服務 → Safari 網站 → 使用 App 期間）。
- **螢幕常亮**：玩家畫面會嘗試讓螢幕不自動關閉；鎖屏後 GPS 會暫停，回來會自動恢復。
- **安全性**：為了好上手，資料庫規則沒有登入機制，知道代碼的人都能讀寫該場遊戲；懂技術的玩家也能從瀏覽器開發者工具看到地點座標。朋友間的活動通常沒問題，若要更嚴謹可以再加上 Firebase Authentication。
- 本機測試：`npx serve docs` 之後用 `http://localhost:3000` 開（localhost 可以用 GPS）。
