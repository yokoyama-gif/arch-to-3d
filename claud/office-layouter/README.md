# Office Layouter (MVP)

オフィス空間に机・会議テーブル・収納・受付・コピー機などを平面上で配置し、
席数・通路幅・干渉を素早く検討するためのローカルツールです。

> 本ツールは **初期レイアウト検討用の簡易判定** です。法適合判定や厳密な建築 CAD ではありません。

## 技術構成

- Electron / React / TypeScript / Vite
- Tailwind CSS / Zustand
- 描画: SVG（MVP は Konva 不採用）
- 保存: localStorage + JSON エクスポート

## ディレクトリ

```
src/
  main/electron.ts        # Electron メインプロセス
  renderer/
    app/App.tsx
    components/{toolbar,sidebar,canvas,inspector,report}/
    store/projectStore.ts
    models/{types.ts, presets.ts}
    logic/{geometry,evaluation,seating,snapping,export}/
```

## 使い方

```bash
npm install
npm run dev          # ブラウザでの開発サーバ
npm run build        # 本番ビルド
npm test             # ユニットテスト (vitest)

# Electron でデスクトップ起動 (本番ビルド経由)
npm run build
npm run build:electron
npm run dev:electron
```

## MVP 機能

- 矩形のオフィス空間 (幅・奥行 mm 入力)
- 家具プリセットからのワンクリック配置（机、会議、収納、受付、コピー機、ロッカー、ソファ、ブース、柱、扉、障害物 ほか）
- ドラッグで移動 / R キーで 90°回転 / Delete で削除
- グリッド表示・グリッドスナップ
- 重なり判定・部屋外はみ出し判定・通路幅不足判定・椅子引き代考慮・前面塞ぎ判定
- 席数 / 会議席数 / 占有率 / 最小通路幅 / warning / ng / 総合点
- 複数案 (案追加 / 案削除 / 案切替)
- ローカル保存 (localStorage) / JSON 出力 / JSON 取込

## キーボード

- `R`: 選択オブジェクトを 90° 回転
- `Delete` / `Backspace`: 選択オブジェクトを削除

## 評価ロジック (MVP)

- 優先度 A: 部屋外はみ出し / 重なり / 通路幅不足 / 椅子引き代不足
- 優先度 B (一部): 扉前塞ぎ / コピー機・受付の操作スペース塞ぎ
- 優先度 C: 未実装（次段階）

## 次段階の予定

- ゾーニング機能
- 複数案比較ビュー
- PNG / PDF / CSV 出力
- ユーザー定義ライブラリ
- React Konva 採用検討（ズーム/パン強化時）
- 自動配置補助
