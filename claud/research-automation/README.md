# Research Automation

Gemini Deep Research → NotebookLM → Google Slides を自動で一気通貫に処理するオペレーター。

## 構成

```
src/
  main.ts                        # メインループ（オーケストレーター）
  config.ts                      # URL・セレクタ・定数の集約（要カスタマイズ）
  types.ts                       # 型定義
  theme-loader.ts                # themes.json 読み込み
  state-manager.ts               # state.json 読み書き
  logger.ts                      # 日付付きログ出力
  scheduler.ts                   # クールダウン管理
  browser/
    launch.ts                    # Playwright ブラウザ起動（シングルトン）
    selectors.ts                 # セレクタ検索ユーティリティ
  workflows/
    deepresearch-create.ts       # Deep Research 新規作成
    deepresearch-monitor.ts      # 完了監視
    deepresearch-export.ts       # テキスト取得
    notebooklm-create.ts         # ノートブック作成
    notebooklm-add-text-source.ts # テキストソース追加
    slide-create.ts              # スライド生成
  utils/
    retry.ts                     # リトライユーティリティ
    sleep.ts                     # sleep / sleepUntil
    time.ts                      # 時刻パース・フォーマット
    text.ts                      # テキスト操作
    dedupe.ts                    # 重複防止
data/
  themes.json                    # 処理対象テーマ一覧（編集して使う）
  state.json                     # 進捗状態（自動生成）
logs/                            # 日付付きログ（自動生成）
screenshots/                     # ステップごとのスクリーンショット（自動生成）
```

---

## 前提条件

- Node.js 20+
- Google アカウント（Gemini / NotebookLM にログイン済み）
- Playwright インストール済みブラウザ

---

## セットアップ

```bash
cd research-automation
npm install
npx playwright install chromium
```

---

## テーマ投入

`data/themes.json` を編集:

```json
[
  {
    "id": "theme-001",
    "title": "テーマ名",
    "prompt": "Gemini Deep Research に入力する指示文"
  }
]
```

- `id` は一意のキー（重複チェックに使用）
- `title` が重複している場合もスキップされる

---

## 起動

```bash
# 開発実行（tsx: TypeScript を直接実行）
npm run dev

# ビルド後実行
npm run build
npm start
```

初回起動時はブラウザが立ち上がります。**Google アカウントにログインしてください**（`.browser-profile/` にセッションが保存され、以降は自動ログイン）。

---

## 再開方法

途中で停止しても `data/state.json` が残っていれば自動的に続きから再開します。

```bash
npm run dev   # そのまま再実行するだけ
```

状態ファイルをリセットして最初からやり直す場合:

```bash
rm data/state.json
npm run dev
```

---

## ログ確認

```
logs/
  2024-01-15.log   ← 日付ごとに蓄積
```

各テーマの処理は `[theme-001] [DR_CREATE]` のように **テーマID + ステップ名** でフィルタ可能。

---

## セレクタのカスタマイズ

`src/config.ts` の `SELECTORS` オブジェクトを編集してください。

Google の UI は定期的に変わるため、セレクタが効かなくなった場合は以下の手順で確認:

1. `screenshots/` に保存されたスクリーンショットを確認
2. ブラウザの DevTools で実際の要素を検査
3. `SELECTORS.gemini.*` または `SELECTORS.notebooklm.*` を更新

---

## 同時実行制御

- Deep Research は **同時3件まで**（`CONCURRENCY.maxDeepResearch`）
- 3件実行中は新規投入せずポーリング待機
- `config.ts` の `CONCURRENCY` で変更可能

---

## 制限到達時の動作

1. 画面テキストから解除時刻を自動パース
2. `state.json` の `cooldownUntil` に記録
3. 解除時刻まで待機（他の処理可能テーマは継続）
4. 時刻不明の場合: 5分 → 15分 → 30分 → 60分 のバックオフ

再起動時も `cooldownUntil` を読んで正確に再開します。

---

## 状態の確認

```bash
cat data/state.json | python -m json.tool
```

各テーマの `status` フィールドで進行状況を確認できます:

| status | 意味 |
|--------|------|
| `pending` | 未処理 |
| `deepresearch_running` | Deep Research 実行中 |
| `deepresearch_completed` | Deep Research 完了 |
| `notebooklm_created` | ノートブック作成済み |
| `source_added` | テキストソース追加済み |
| `slide_created` | スライド作成済み |
| `completed` | 全工程完了 |
| `waiting_limit_reset` | 制限解除待ち |
| `error` | エラー（`lastError` を確認） |

---

## 注意事項

- **Google アカウントは事前にブラウザでログインしておくこと**（初回起動時に手動ログイン）
- Gemini の UI は変更されることがあります。セレクタが合わなくなったら `config.ts` を更新してください
- `headless: false` で実際のブラウザ画面が表示されます。操作中は画面を閉じないでください
- 制限に達した場合は自動待機しますが、非常に長い待機が発生することもあります
