# 原理講論 訓読トラッカー — プロジェクト設定

## 概要

夫婦2名（こうへい & まりあ）が毎日の原理講論訓読をリアルタイムに記録・共有するWebアプリ。

## 技術スタック

| 項目 | 内容 |
|------|------|
| フロントエンド | 単一HTMLファイル（バニラJS / CSS）、フレームワークなし |
| データベース | Firebase Realtime Database（compat SDK v10.12.0） |
| ホスティング | GitHub Pages |
| PWA | manifest.json + sw.js（Periodic Background Sync） |
| フォント | Noto Sans JP (Google Fonts) |
| BGM | 432hz.mp3（ループ再生） |

**Next.js / Supabase / Vercel / Stripe は使用していない。**

## ファイル構成

```
index.html       ← アプリ本体（CSS・HTML・JS すべて1ファイル）
manifest.json    ← PWA マニフェスト
sw.js            ← Service Worker（キャッシュ + 通知）
icon-192.png     ← PWA アイコン 192×192
icon-512.png     ← PWA アイコン 512×512
icon.png         ← 元画像（397×415）
432hz.mp3        ← BGM ファイル
requirements.md  ← 要件定義書
```

## Firebase 設定

設定値は `index.html` の `boot()` 関数に直接埋め込まれている（環境変数不使用）。

```js
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyD0gL-QTPNGD3MLqaat3zGAvjamqvEwBHI",
  authDomain: "genri-daily-memo.firebaseapp.com",
  databaseURL: "https://genri-daily-memo-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "genri-daily-memo",
  storageBucket: "genri-daily-memo.firebasestorage.app",
  messagingSenderId: "265666084439",
  appId: "1:265666084439:web:58ba1f475b3eb030c02d12",
  measurementId: "G-1GBK14KD8W"
};
```

## Firebase データ構造

```
readings/
  husband/
    YYYY-MM-DD: true   ← JST基準の日付キー
  wife/
    YYYY-MM-DD: true

seijou_kikan/
  name: string         ← 精誠期間の名前
  start: YYYY-MM-DD
  end: YYYY-MM-DD

nudge/
  husband: { from, text, ts }   ← ペアプレッシャー通知
  wife:    { from, text, ts }

reactions/
  YYYY-MM-DD/
    husband: emoji     ← スタンプリアクション
    wife:    emoji
```

## ユーザー定数

```js
const PEOPLE = {
  husband: { name: 'こうへい', emoji: '👨' },
  wife:    { name: 'まりあ',   emoji: '👩' }
};
```

- こうへい色: `--k: #60a5fa`（スカイブルー）
- まりあ色: `--m: #f472b6`（ピンク）
- アクセント: `--gold: #f59e0b`（ゴールド）

## JS 主要変数

| 変数 | 型 | 用途 |
|------|----|------|
| `db` | Firebase DB | Realtime Database インスタンス |
| `who` | `'husband' \| 'wife'` | 現在操作中のユーザー |
| `reads` | `{husband: Set, wife: Set}` | 全訓読記録（日付文字列セット） |
| `sp` | `{name, start, end} \| null` | 精誠期間設定 |
| `calY, calM` | number | カレンダー表示年月 |
| `notifOn` | boolean | 通知ON/OFF |

## localStorage キー

| キー | 内容 |
|------|------|
| `who_v2` | 選択済みユーザー（`'husband'` or `'wife'`） |
| `notif_on` | 通知設定（`'true'` or `'false'`） |
| `rem_time` | リマインダー時刻（`'HH:MM'` 形式） |

## 日付ユーティリティ

すべての日付はJST基準の `YYYY-MM-DD` 文字列。

```js
const jstNow  = () => new Date(Date.now() + 9 * 3600 * 1000);
const todayStr = () => jstNow().toISOString().slice(0, 10);
```

## 主要関数一覧

| 関数 | 役割 |
|------|------|
| `boot()` | Firebase初期化（IIFE） |
| `startApp()` | ログイン後の全初期化 |
| `renderAll()` | 全UI再描画（readリスナーから呼ばれる） |
| `renderStreak()` | 連続記録を計算して表示 |
| `renderCal()` | カレンダー描画（日付タップで`editDay`） |
| `renderSP()` | 精誠期間カード描画 |
| `renderGraph()` | 月間達成グラフ描画 |
| `doCheck(e)` | 今日の訓読完了 + フラッシュ + BGM停止 |
| `undoCheck()` | 今日の記録削除 |
| `editDay(ds)` | 過去記録の追加/削除モーダル |
| `flashScreen()` | 完了時フラッシュ演出 |
| `launchConfetti()` | 両者完了時の紙吹雪 |
| `switchTab(tab)` | ホーム/設定タブ切替 |
| `switchWho(w)` | ユーザー切替 |
| `saveSP()` | 精誠期間をFirebaseに保存 |
| `clearSP()` | 精誠期間を削除 |
| `startSeijou()` | ホームタブの精誠開始ボタン → BGM再生/停止 |
| `toggleBGM()` | 設定タブのBGM再生/停止 |
| `updateBGMBtn()` | 設定タブBGMボタンの表示更新 |
| `updateStartBtn()` | ホームタブ開始ボタンの表示更新 |
| `sendNudge()` | ペアプレッシャー通知送信 |
| `sendStamp(emoji)` | スタンプリアクション送信 |
| `applyTimeTheme()` | 時間帯に応じてbodyクラスを変更 |

## 時間帯テーマ

`applyTimeTheme()` が起動時 + 30分ごとに自動実行。

| 時間帯 | CSSクラス | 色 |
|--------|----------|----|
| 5〜9時 | `theme-morning` | ライトエメラルドグリーン |
| 10〜15時 | `theme-afternoon` | スカイブルー |
| 16〜18時 | `theme-sunset` | 濃いアンバー茶オレンジ |
| 19〜4時 | `theme-night` | 深い宇宙紫（デフォルト） |

各テーマは `body::before` のグラデーションに加え、`--bg-1`・`--card`・`--border` CSS変数を上書きする。

## 画面構成（タブ）

### ホームタブ
1. 今日の状況（こうへい・まりあ それぞれのチェック状態 + スタンプ）
2. 精誠を開始するボタン（BGM再生）
3. 今日の訓読を完了するボタン（チェック + BGM停止）
4. 精誠期間カード（日数・進捗バー・両者達成数）
5. 連続記録（ストリーク）
6. カレンダー（過去日をタップして記録の追加/削除が可能）
7. 月間達成グラフ

### 設定タブ
- BGM再生/停止ボタン
- ユーザー切替（こうへい / まりあ）
- 精誠期間の設定フォーム
- 通知設定（許可・リマインダー時刻）
- データリセット

## デプロイ

- **GitHub**: `kou56250046-cloud/genri-daily-memo`（masterブランチ）
- **GitHub Pages**: `https://kou56250046-cloud.github.io/genri-daily-memo/`
- デプロイ方法: `git push` するだけで自動反映（数分かかる場合あり）

## 開発上の注意

- `index.html` を編集して `git push` するだけでデプロイ完了
- Firebaseキーはフロントに直書きで問題ない（Firebase公式の設計）
- 日付計算は常に JST 基準（`jstNow()` を使う）
- BGM再生はブラウザのAutoplay Policy制限のため、必ずユーザー操作後に `.play()` を呼ぶ
- 精誠期間の達成数カウントは「精誠期間の開始日以降の記録のみ」対象
