# 🐹 尋找內心的倉鼠

用手機玩的真實地點尋寶遊戲。主持人在地圖上放好四個物品，玩家打開網頁就能直接開始，拿著手機靠 GPS 找出它們。

- **玩家**（`docs/index.html`，網站首頁）：打開就開始，不用輸入代碼。畫面顯示「離最近、還沒找到的物品還有幾公尺」，加上冷/熱提示和「越來越近/越來越遠」。走進判定範圍後「我找到了！」才會亮起，按下去跳出物品的「獲得意義」和「給自己的一句話」。點左上角名字可以改暱稱。
- **主持人**（`docs/host.html`）：選一個物品後點地圖就能放置或移動，也能拖曳圖釘、按「📍 放我這」用目前 GPS 位置放置。可以即時看到玩家位置與進度。

四個物品（文字與圖示在 [docs/common.js](docs/common.js) 的 `ITEMS`）：靜音滾輪、柔軟紙棉、飽滿的瓜子、蘋果木磨牙棒。

後端是 Firebase Realtime Database（即時同步），網站架在 GitHub Pages（GPS 一定要 https 才能用）。

---

## 網址

- 玩家（首頁）：<https://ntustcdvc1979.github.io/Hamster/>
- 主持人：<https://ntustcdvc1979.github.io/Hamster/host.html>

網站放在 GitHub Pages（`main` 分支的 `docs/` 資料夾），資料存在 Firebase 專案 `hamster-hunt-2026` 的 Realtime Database。

## 更新網站

改完 `docs/` 裡的檔案後 commit 並 push 到 `main`，GitHub Pages 約 1 分鐘內自動更新。

## 更新資料庫規則

改了 [database.rules.json](database.rules.json) 才需要：

```bash
firebase deploy --only database
```

## 玩法

1. 主持人用手機開主持人網址，在「物品」分頁選一個物品，點地圖放好位置（建議事先到現場按「📍 放我這」最準），四個都放好
2. 「設定」分頁可以調整找到的判定範圍（預設 15 公尺）
3. 按「玩家連結」讓玩家掃 QR code
4. 玩家允許定位權限後就能開始找；活動重來前可在「設定」清空所有玩家進度

## 注意事項

- **GPS 誤差**：戶外一般 5–15 公尺，室內、高樓旁會更差。判定範圍建議 10–20 公尺；地點之間最好距離 30 公尺以上，不然提示容易混淆。
- **iPhone**：Safari 要允許「定位服務」（設定 → 隱私權 → 定位服務 → Safari 網站 → 使用 App 期間）。
- **螢幕常亮**：玩家畫面會嘗試讓螢幕不自動關閉；鎖屏後 GPS 會暫停，回來會自動恢復。
- **安全性**：為了好上手，資料庫規則沒有登入機制，知道網址的人都能修改物品位置；懂技術的玩家也能從瀏覽器開發者工具看到地點座標。朋友間的活動通常沒問題，若要更嚴謹可以再加上 Firebase Authentication。
- 本機測試：`npx serve docs` 之後用 `http://localhost:3000` 開（localhost 可以用 GPS）。
