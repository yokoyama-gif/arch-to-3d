# GPS速度オーバーレイ（Uber Eats向け自分用APK）

Uber Eats配達中に他アプリの上に「現在速度・走行距離・経過時間」を小さく表示し、
あとから時間別の速度推移を分析するための個人用Androidアプリです。
Google Play 公開は想定していません（自分でビルドして自分の端末にインストール）。

## 主な機能（MVP）

- **計測開始 / 停止**：Foreground Service（`foregroundServiceType="location"`）で
  バックグラウンド中も止まらず GPS を取得します。
- **GPS計測**：FusedLocationProviderClient で 1〜3 秒ごとに位置を取得。
  - `speed` を km/h に変換
  - 精度（accuracy）も保存
  - 異常値（精度 50m 超 / 速度 130 km/h 超）は除外
  - 直近 5 秒の平均を「現在速度」として表示
- **オーバーレイ表示**：WindowManager で他アプリの上に半透明パネルを表示。
  - 表示項目：現在速度・走行距離・経過時間・GPS精度
  - ドラッグで移動、タップで折りたたみ／展開
  - α=0.78 の半透明、Uber Eats 画面を邪魔しないコンパクトサイズ
- **データ保存**：Room（`gps-overlay.db`）に
  `timestamp / latitude / longitude / speed_kmh / accuracy / session_id` を保存。
  セッション単位（開始〜終了）で管理。
- **今日の分析画面**：
  - 平均速度・最高速度・走行距離・走行時間
  - 時間別 平均速度の棒グラフ（最高速度はオレンジの線でオーバーレイ）
  - 時間帯ごとの帯グラフ（0/3/6/9/12/15/18/21/24 区切り）
- **権限確認画面**：位置情報・通知・他アプリの上に表示の付与状況を可視化。
- **更新間隔の設定**：1〜5 秒の範囲でスライダー調整（DataStore に保存）。

## 後回し（このMVPには含めていない）

- 歩数 / 心拍 / Uber 売上連携
- Uber Eats画面の読み取り
- 過去日分の分析画面（今日のみ実装）

## 技術スタック

- Kotlin 1.9 / Jetpack Compose（Material 3）
- Foreground Service（`location` + `specialUse`）
- FusedLocationProviderClient（Google Play services Location 21.x）
- WindowManager オーバーレイ（`TYPE_APPLICATION_OVERLAY`）
- Room 2.6（KSP）
- Navigation Compose
- DataStore Preferences
- minSdk 29（Android 10）/ targetSdk 34 / compileSdk 34
- Android 14 の `foregroundServiceType="location"` および
  `FOREGROUND_SERVICE_LOCATION` 権限に対応

## ビルド手順

1. Android Studio Hedgehog 以降で `gps-speed-overlay/` を開く
   （Gradle Wrapper の `gradle-wrapper.jar` は Android Studio が初回同期時に
   自動生成します。CLI でいきなり `./gradlew` する場合は
   `gradle wrapper --gradle-version 8.7` を一度走らせてください。）
2. 初回 Sync で依存をダウンロード（Compose BOM, Room, Play services Location 等）
3. 実機（USB デバッグ有効）を接続
4. `Run > Run 'app'` で起動

リリース APK が欲しい場合：
```
./gradlew assembleRelease
# app/build/outputs/apk/release/app-release-unsigned.apk
# 自分用なら debug ビルドで十分です:
./gradlew assembleDebug
```

## 使い方

1. アプリ起動 → 「権限の確認」で 3 つの権限を全部付与
   - 位置情報（Fine）
   - 通知
   - 他のアプリの上に表示
2. メイン画面で「計測開始」
3. 「オーバーレイ表示」を ON にすると、Uber Eats 等を前面にしても
   速度パネルが浮いた状態で見えます
4. 配達終了後にアプリへ戻り「計測停止」
5. 「今日の分析を見る」で時間別速度推移を確認

### 省電力対策

メーカー独自の省電力（Doze・自動最適化）でサービスが止められる端末では、
Android 設定 → アプリ → GPS速度オーバーレイ → 電池 → 「制限なし」にしてください。
記録精度を最優先する仕様のため、計測中は WAKE_LOCK を取得しています。

## ファイル構成（主要）

```
app/src/main/
├── AndroidManifest.xml
├── java/com/example/gpsspeedoverlay/
│   ├── MainActivity.kt              … Compose ナビゲーションのエントリ
│   ├── GpsApp.kt                    … Application クラス
│   ├── data/
│   │   ├── AppDatabase.kt           … Room シングルトン
│   │   ├── GpsLog.kt / GpsLogDao.kt … 1サンプル＝1行
│   │   ├── Session.kt / SessionDao  … 計測セッション
│   │   └── GpsRepository.kt         … 集計クエリ
│   ├── service/
│   │   ├── LocationTrackingService.kt … Foreground Service + GPS購読
│   │   ├── OverlayService.kt          … WindowManagerオーバーレイ
│   │   └── TrackingState.kt           … 全画面共有のStateFlow
│   ├── ui/
│   │   ├── MainScreen.kt
│   │   ├── AnalysisScreen.kt
│   │   ├── PermissionScreen.kt
│   │   ├── components/SpeedBarChart.kt … Canvasで描く棒グラフ
│   │   └── theme/Theme.kt
│   └── viewmodel/
│       ├── MainViewModel.kt
│       └── AnalysisViewModel.kt
└── res/
    ├── values/{strings,colors,themes}.xml
    ├── xml/{backup,data_extraction}_rules.xml
    ├── drawable/{ic_speed,ic_launcher_foreground}.xml
    └── mipmap-anydpi-v26/ic_launcher{,_round}.xml
```

## 注意

- Google Play 公開を想定していないため、Android 14 以降で必要な
  `FOREGROUND_SERVICE_LOCATION` の Play Console 申告書類はありません。
- バックグラウンド位置情報（`ACCESS_BACKGROUND_LOCATION`）は使用していません。
  Foreground Service が前提のため、配達中は通知バーから常に状態が確認できます。
- 1〜3 秒間隔の常時 GPS は端末バッテリーをそれなりに消費します。
  配達中はモバイルバッテリーの併用を推奨します。
