# ChatGPT chat history to Excel

`ChatGPT` のエクスポート ZIP から会話履歴を読み取り、ルールベースで分類し、`Excel (.xlsx)` に出力するツールです。

## 前提

- 入力は `ChatGPT` の公式データエクスポートを想定しています。
- 取得手順の公式案内:
  - [How do I export my ChatGPT history and data?](https://help.openai.com/en/articles/7260999-how-do-i-export-my-chatgpt-history-and-data)
- このスクリプトは、ZIP 内または展開済みフォルダ内の `conversations.json` を使います。

## 出力内容

- `Summary` シート
  - 会話単位の一覧
  - タイトル、分類、更新日時、件数、プレビューなど
- `Messages` シート
  - メッセージ単位の明細
  - 会話 ID、話者、時刻、モデル、本文
- `Stats` シート
  - 分類別件数
  - 月別件数
  - 利用モデル集計
  - 話者別件数

## セットアップ

```powershell
cd C:\Users\admin\Desktop\chatgpt_history_exporter
py -m pip install -r requirements.txt
```

## 実行例

ZIP を直接入力する場合:

```powershell
py .\chatgpt_history_to_excel.py --input "C:\path\to\chatgpt-export.zip"
```

出力先を指定する場合:

```powershell
py .\chatgpt_history_to_excel.py `
  --input "C:\path\to\chatgpt-export.zip" `
  --output "C:\path\to\chatgpt_history_classified.xlsx" `
  --timezone "Asia/Tokyo"
```

展開済みフォルダを入力する場合:

```powershell
py .\chatgpt_history_to_excel.py --input "C:\path\to\export-folder"
```

`Messages` シートを省略して軽くする場合:

```powershell
py .\chatgpt_history_to_excel.py --input "C:\path\to\chatgpt-export.zip" --skip-messages-sheet
```

## 分類ルール

- 分類ルールは `category_rules.json` にあります。
- 既定の分類は `開発 / AI・データ / 文章作成 / 調査 / 業務 / デザイン / 生活 / その他` です。
- `label` が Excel 上の表示名です。
- `keywords` にタイトルまたはユーザーメッセージ内で検出したいキーワードを追加してください。
- タイトル一致は本文一致より強くスコアされます。

## 補足

- 会話の分岐がある場合は、原則として `current_node` の主系列を採用します。
- `conversations.json` が ZIP に見つからない場合はエラー終了します。
- この環境ではシェル実行確認ができていないため、動作確認は未実施です。
