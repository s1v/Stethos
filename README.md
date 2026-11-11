# Stethos

> No install needed. Read live vehicle data from BLE OBD2 adapters right in your browser via Web Bluetooth.

**Stethos**（聴診器 / Stethoscope に由来）は、ELM327 互換の **BLE** OBD-II アダプターから車両データを読み取る、インストール不要の Web アプリ（PWA）です。

## できること
- ホーム：アダプター名、VIN、DTC 件数、MIL（チェックランプ）、ECU 電圧、対応 PID 数
- ステータス：車速・回転数・負荷・スロットル・各種温度・MAF・MAP／ブースト圧・燃料補正・O2・燃料残量・電圧・稼働時間（リアルタイム、Wake Lock 対応）
- 診断情報：DTC の読み取り（Mode 03）と消去（Mode 04、確認ダイアログあり）
- 未登録アダプターでも、サービス UUID を入力して接続・保存できる

## 動作環境
| 環境 | 対応 |
|---|---|
| Android + Chrome / Edge / Samsung Internet | ◯ |
| iPhone + Safari / Chrome | ✕（WebKit が Web Bluetooth 非対応） |
| iPhone + **Bluefy** | ◯ |
| PC + Chrome / Edge | ◯（開発・デバッグ用） |

対応アダプター：**ELM327 互換の BLE 版のみ**（Bluetooth Classic / Wi-Fi 版は不可）

## GitHub Pages への公開（初回）
1. zip を展開し、中身をリポジトリのルートにアップロードする
   - ⚠ `.github` フォルダは名前が「.」で始まるため、macOS の Finder では表示されないことがあります（`Command + Shift + .` で表示）。アップロード漏れに注意してください。
2. リポジトリの **Settings → Pages** を開く
3. **Source** を「**GitHub Actions**」にする
4. **Actions** タブでワークフロー（Deploy to GitHub Pages）が成功したことを確認する
5. `https://ユーザー名.github.io/リポジトリ名/` を開く

以降は `main` ブランチへの push で自動デプロイされます（Actions タブから手動実行も可）。
全てのパスは相対パスなので、サブパス（`/リポジトリ名/`）でもそのまま動きます。

### 更新時
`sw.js` の `VERSION` を変更してから push すると、利用者の画面に「更新があります」が表示されます。

## ファイル構成
```
index.html / manifest.webmanifest / sw.js / css/style.css / icons/
js/app.js            起動・画面の切り替え・メニュー生成
js/connection.js     接続の流れ（UUID 宣言 → 選択 → 確認 → 初期化）
js/ble.js            Web Bluetooth の接続処理
js/elm327.js         ELM327 のコマンド送受信・初期化
js/obd.js            PID の取得・計算、DTC の解析
js/storage.js        localStorage（保存済み UUID）、UUID の正規化
js/ui.js             通知・ダイアログ・Wake Lock
js/screens/          各画面
js/config/known-uuids.js  既知のサービス UUID
js/config/pids.js         PID の定義（名前・単位・計算式・表示範囲）
js/config/dtc-codes.js    共通 DTC の説明文
js/config/menu.js         メニュー項目（将来のカスタム画面はここに追加）
js/debug/mock-adapter.js  デバッグモード用の疑似アダプター
docs/spec.md         仕様書
```

## 既知の UUID を追加する
`js/config/known-uuids.js` に 1 行追加するだけです。キャラクタリスティックは write / notify の性質から自動判別するので、サービス UUID のみで OK です。
接続に成功したアダプターの情報（製品名・サービス UUID）は Issue で報告してください。

## デバッグモード
- トップ画面の「デバッグモードで起動」、または URL に `?debug=1`（`&scenario=unknown` などで状況指定）
- 状況：`normal` / `nodtc` / `unknown`（UUID 入力画面。疑似 UUID は `ABCD`） / `connect-error` / `no-elm` / `disconnect`
- Web Bluetooth 非対応ブラウザでも使えます

### デバッグモードの削除手順
1. `js/debug/` フォルダを削除
2. `index.html` の `<!-- DEBUG-START -->` 〜 `<!-- DEBUG-END -->` を削除
3. `js/app.js` 末尾の `// DEBUG-START` 〜 `// DEBUG-END` を削除
4. （任意）`sw.js` の `ASSETS` から `./js/debug/mock-adapter.js` を削除し、`VERSION` を更新

ヘッダーの DEBUG バッジは `session.debug` が true のときだけ表示されるため、そのままで問題ありません。

## 注意
- 走行中は画面を操作しないでください（表示専用の設計です）。
- DTC の消去は、原因が直っていなければ再び記録されます。
- 汎用 OBD で読めるのは主にエンジン系（排ガス関連）です。メーカー独自データ（Mode 22）は今後の「おまけ」扱いです。
- 「ELM327」は ELM Electronics の製品です。本アプリは「ELM327 互換」アダプターに対応しています。
