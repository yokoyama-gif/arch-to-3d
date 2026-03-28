# 共同住宅パイプスペースシミュレータ

木造3階共同住宅を中心とした集合住宅の初期設計段階で、住戸内の水回り配置・PS（パイプスペース）寸法・配管ルート・排水勾配成立性を素早く検討できるローカル完結ツールです。

## できること

- 平面グリッド上に水回り設備（トイレ・UB・洗面台・洗濯パン・キッチン）とPSを配置
- 各設備からPSへの簡易配管ルートを自動生成・表示
- 横引き距離・必要高低差の自動算出
- 排水勾配の成立性判定（OK / WARNING / NG）
- PS必要寸法の概算と判定
- 案の保存・比較（スコアリング付き）
- JSON形式での保存・読込
- 建物条件（階数・構造種別・天井懐・床段差許容値等）の変更
- プリセット（木造3階1K標準 / コンパクト優先 / 点検性優先）

## できないこと（MVPの限界）

- 厳密な法規判定
- 実施設計レベルの配管計算
- 梁・柱・壁の干渉回避
- 上下階の完全連動
- 雨水・EPS・MBの詳細連動
- PDF出力
- クラウド保存・ユーザー認証

## セットアップ手順

```bash
cd ps-simulator
npm install
```

## 起動方法

```bash
npm run dev
```

ブラウザで http://localhost:5173 を開きます。

## ディレクトリ構成

```
src/
  domain/           # ドメインロジック（UIから独立）
    types.ts        # 型定義
    calcPipeRoutes.ts  # 配管ルート算定
    calcPsSize.ts   # PS寸法算定
    calcSlope.ts    # 排水勾配計算
    scoring.ts      # スコア計算
    fixtureRules.ts # ルール再エクスポート
    rules/          # 設備ルール・定数
      buildingDefaults.ts
      fixtureDefaults.ts
      pipeSpecs.ts
      slopeRules.ts
      psRules.ts
      scoringRules.ts
      presets.ts
  components/       # UIコンポーネント
    GridCanvas.tsx   # 平面グリッド
    FixturePalette.tsx  # 設備パレット
    PropertyPanel.tsx   # 物件設定・選択設備詳細
    ResultPanel.tsx     # 判定結果
    ComparisonTable.tsx # 案比較テーブル
    Toolbar.tsx         # ツールバー
  store/
    useSimulatorStore.ts  # Zustand状態管理
  utils/
    geometry.ts     # 幾何計算ユーティリティ
    exportJson.ts   # JSON出力
    importJson.ts   # JSON読込
    id.ts           # ID生成
  App.tsx
  main.tsx
```

## 今後の拡張案

- 障害物回避付きの配管ルーティング
- 上下階の配管連動表示
- 梁貫通チェック
- Electron化によるデスクトップアプリ化
- PDF / DXF出力
- 法規チェック連携
- 複数住戸タイプの一括検討
