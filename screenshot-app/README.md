# ScreenSnap

Windows 用のスクリーンショット + 注釈ツール。Screenpresso を意識した機能セットを、追加インストール不要の単一 PowerShell スクリプトで実装したプロトタイプ。

## 特徴

- **キャプチャ**: 領域選択（ドラッグ）/ 全画面
- **注釈**: 矢印 / 矩形 / 楕円 / 直線 / 蛍光ペン / テキスト / 番号付きステップマーカー / モザイク / 切り抜き
- **編集**: 元に戻す・やり直し（Ctrl+Z / Ctrl+Y）
- **保存**: PNG / JPG（自動保存 + 名前を付けて保存）/ クリップボードコピー
- **ライブラリ**: 直近 30 件のキャプチャをサイドバーに表示、ダブルクリックで開く
- **トレイ常駐**: 通知領域からアクセス、ダブルクリックで領域キャプチャ
- **依存ゼロ**: 追加 DLL・ネイティブ Interop なし。PowerShell + WPF + WinForms の素機能のみ

## 動作要件

- Windows 10 / 11
- Windows PowerShell 5.1 もしくは PowerShell 7+
- .NET Framework 4.7.2+ または .NET 6+（PowerShell 同梱）

## 使い方

### 通常起動（タスクトレイ常駐）

```powershell
powershell -ExecutionPolicy Bypass -File .\ScreenSnap.ps1
```

または PowerShell 7:

```powershell
pwsh -File .\ScreenSnap.ps1
```

通知領域にアイコンが現れます:
- **ダブルクリック**: 領域キャプチャ
- **右クリック**: メニュー（領域 / 全画面 / 保存フォルダ / 自動保存切替 / 終了）

### コマンドラインモード（一発キャプチャ）

```powershell
powershell -File .\ScreenSnap.ps1 -Capture region
powershell -File .\ScreenSnap.ps1 -Capture screen
```

エディタを閉じるとプロセスが終了します。

### グローバルホットキー設定（任意）

ScreenSnap 自体はホットキーを登録しません（AMSI フレンドリのため）。Windows 標準のショートカット機能で割り当てられます:

1. `ScreenSnap-region.lnk` というショートカットを作成
2. リンク先: `powershell.exe -WindowStyle Hidden -File "C:\path\to\ScreenSnap.ps1" -Capture region`
3. ショートカットのプロパティを開き「ショートカットキー」に `Ctrl+Shift+1` などを設定
4. ショートカットを `スタートメニュー` 配下のフォルダ（例 `%APPDATA%\Microsoft\Windows\Start Menu\Programs\`）に置くと、登録キーがグローバルに効きます

## 保存先

既定: `%USERPROFILE%\Pictures\ScreenSnap\`

ファイル名: `snap_yyyyMMdd_HHmmss.png`

## エディタのショートカット

| キー | 動作 |
|---|---|
| Ctrl+Z | 元に戻す |
| Ctrl+Y | やり直し |
| Ctrl+S | 保存 |
| Ctrl+C | クリップボードへコピー |
| Esc    | エディタを閉じる |

## 領域選択中のショートカット

| キー | 動作 |
|---|---|
| ドラッグ | 範囲指定 |
| Esc      | キャンセル |
| Enter    | 全画面を選択 |

## 既知の制限（プロトタイプ）

- アクティブウィンドウだけのキャプチャは未実装（領域選択で代替）
- スクロールキャプチャ・GIF 録画は未実装
- 注釈は配置後の選択／移動／編集ができない（Undo して描き直し）
- 高 DPI 環境で WPF のスケーリングが効かない場合があります

## ファイル構成

```
screenshot-app/
├── ScreenSnap.ps1   # 本体（単一スクリプト）
└── README.md        # このファイル
```
