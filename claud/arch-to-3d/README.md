# Sky Factor Study Tool

建築の天空率を初期検討するための FastAPI + React アプリです。

## 現在の対応範囲

- 建物ボリューム入力による天空率試算
- 境界ごとの `固定閾値` / `道路斜線` / `隣地斜線` 比較
- DXF 取込
- JWW / JWC の DXF 変換経由取込
- 境界測点ごとの実天空率、基準天空率、差分表示

## フロントエンド

- 場所: `frontend`
- 想定起動: `npm install` -> `npm run dev`

## バックエンド

- 場所: `backend`
- 想定起動: `python -m venv .venv` -> `.venv\\Scripts\\activate` -> `pip install -r requirements.txt` -> `uvicorn main:app --reload`

## ローカル起動スクリプト

このリポジトリには、確認済みのポータブル runtime を使う起動スクリプトを同梱しています。

- backend: `.\start-backend.ps1`
- frontend: `.\start-frontend.ps1`

起動後の URL:

- backend: `http://127.0.0.1:8000`
- frontend: `http://127.0.0.1:5173`

## JWW / JWC 取込

JWW / JWC は直接解析ではなく、DXF 変換コマンド経由です。

環境変数 `JWC_CONVERTER_COMMAND` に、`{input}` と `{output}` を含むコマンド文字列を設定してください。

例:

```powershell
$env:JWC_CONVERTER_COMMAND = '"C:\\path\\to\\converter.exe" "{input}" "{output}"'
```

未設定時は、JWW / JWC 取込 API はエラーを返します。

## DXF レイヤ判定

以下の文字列を含むレイヤ名を優先して判定します。

- 敷地: `site`, `敷地`, `boundary`
- 計画建物: `planned`, `proposal`, `計画`, `building`, `建物`
- 周辺建物: `context`, `neighbor`, `existing`, `周辺`, `隣地`, `既存`

## 高さの読取

レイヤ名に以下のような記法があれば高さとして読取ります。

- `H=12`
- `height:10.5`
- `高さ12`

指定が無い場合は、取込画面で指定した既定高さを使います。

## 注意

この版は法適合の最終判定用ではなく、初期ボリューム比較用の近似計算です。
