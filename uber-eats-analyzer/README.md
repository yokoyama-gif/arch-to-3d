# Uber Eats 稼働分析ツール

Uber Eats配達の稼働ログ（売上・件数・距離・エリア・時間帯）をローカルに記録し、
**どの時間帯・どのエリアが最も効率よく稼げるか**を分析するためのデスクトップアプリです。

- **Electron + React + TypeScript + Vite + Tailwind**
- **SQLite (better-sqlite3)** によるローカル保存
- **外部API一切なし** — ネットワーク不要、完全オフライン

## 機能

| カテゴリ | 内容 |
| --- | --- |
| 入力 | 日付・開始/終了時刻・稼働時間（自動算出）・売上・件数・距離・エリア・天気・メモ |
| 自動計算 | 実質時給・1件単価・1km単価・件数/時・平均配達時間 |
| ダッシュボード | 今日/今月の売上・平均時給・走行距離 / 時間帯別棒グラフ / 直近30日棒グラフ / エリアランキング |
| 履歴 | テーブル + 日付/エリア/天気フィルタ + 行内編集モーダル + CSV出力 |
| インポート | CSV貼り付けまたはファイル選択 → プレビュー → 一括INSERT |

## セットアップ

```bash
cd uber-eats-analyzer
npm install
# better-sqlite3 はネイティブモジュールのため初回のみ Electron 用にリビルドが必要なことがあります
npm run rebuild:sqlite
npm run dev
```

`npm run dev` で以下が並列起動します：

1. Vite dev server (renderer, port 5173)
2. TypeScript watch (main → `dist-electron/`)
3. Electron 本体（renderer 起動を `wait-on` で待機）

### 本番ビルド

```bash
npm run build
# dist/ (renderer) と dist-electron/ (main) が生成される
# パッケージング (electron-builder 等) は別途追加可能
```

## データ保存先

`app.getPath('userData')/uber-eats-analyzer.db`

- Windows: `%APPDATA%\uber-eats-analyzer\uber-eats-analyzer.db`
- macOS: `~/Library/Application Support/uber-eats-analyzer/uber-eats-analyzer.db`

## CSVフォーマット

必須列: `date, start_time, end_time, earnings, delivery_count, distance_km`
任意列: `duration_minutes, area, weather, memo`

```csv
date,start_time,end_time,duration_minutes,earnings,delivery_count,distance_km,area,weather,memo
2026-05-01,11:00,14:00,180,4500,12,28.5,渋谷,晴,ランチピーク
```

`duration_minutes` を省略すると `end_time - start_time` から自動計算します（翌日跨ぎ補正あり）。

## ディレクトリ構成

```
uber-eats-analyzer/
├── package.json / tsconfig*.json / vite.config.ts / tailwind.config.ts
├── index.html
└── src/
    ├── main/
    │   ├── electron.ts   # BrowserWindow + IPC配線
    │   ├── preload.ts    # window.uberApi (contextBridge)
    │   └── db.ts         # better-sqlite3 + マイグレーション
    └── renderer/
        ├── main.tsx
        ├── app/App.tsx
        ├── pages/        # Dashboard / Entry / History / Import
        ├── components/   # Sidebar / KpiCard / BarChart / DataTable
        ├── lib/          # format / stats / csv
        ├── store/        # zustand
        └── types/
```

## 将来拡張のポイント

- `shifts.source` 列 (`manual` / `csv` / `ocr` / `gps`) でデータ起源を区別済み
- `db.ts` がリポジトリ層として閉じているため、OCR / GPSログ / 画面録画解析モジュールは
  「`ShiftInput[]` を組み立てて `bulkInsertShifts` を呼ぶ」だけで統合可能
- `lib/stats.ts` は純粋関数で集計を行うため、新しい集計軸（曜日・天気別など）の追加が容易
