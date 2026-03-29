# rincle-test

## 概要

[RINCLE](https://rincle.co.jp/version-test)（自転車レンタルサービス）のユーザー向け全機能を自動テストするPlaywright E2Eテストプロジェクト。

サービスはBubble.io製のSPAで、通常のセレクターやクリックが効かないケースがあるため、調査スクリプト群でBubble内部の仕組みを解析し、テストを構築した。

---

## 主要ファイル

### `rincle.e2e.ts` — メインE2Eテストファイル

17テストをserialモードで順番に実行する。`.env` の認証情報・予約情報を使用。

| # | テスト | 内容 |
|---|--------|------|
| 1 | ログイン | メール・パスワードでログイン |
| 2 | マイページ | アカウント編集・予約一覧・退会ボタン、ユーザー情報表示 |
| 3 | ガイドページ | `/index/guide` 遷移確認 |
| 4 | 料金ページ | `/index/howtopay` 遷移確認 |
| 5 | 自転車検索・一覧 | エリア選択 → 検索 → 貸出可能一覧表示 |
| 6 | 自転車詳細ページ | 詳細ページのpickerフォーム表示確認 |
| 7 | 予約フロー | 日時選択 → カート → 確認 → 予約確定（`top_search`遷移で成功判定） |
| 8 | 予約一覧確認 | `/user_reservation_list` の件数確認 |
| 9 | 予約キャンセル | 先頭の予約をキャンセル |
| 10 | ログアウト | ログアウト後にログインボタン表示確認 |
| 11 | 新着情報詳細 | トップの新着情報クリック → `/index/news_detail` 遷移確認 |
| 12 | TOPICS詳細 | トップのTOPICSクリック → `/index/topics_detail` 遷移確認 |
| 13 | よくある質問 | `/index/faq` 遷移確認 |
| 14 | プライバシーポリシー | `/index/privacypolicy` 遷移確認 |
| 15 | お問い合わせフォーム | `/index/contact` のフォーム表示確認 |
| 16 | アカウント情報編集 | `/index/edit` の編集フォーム表示確認 |
| 17 | 自転車種類フィルタ | ロードバイクフィルタで検索実行 |

**Bubble特有の対応（テスト内の重要実装）:**

- `selectPikadayDate()` — `aria-owns` でカレンダーを特定し、月ナビゲーション → 日付クリック → Closeボタンで確定
- `clickBubbleButton()` — Bubbleの`button_disabled`プリコンピュートキャッシュを上書き（`get_precomputed`メソッドを差し替え）してから、jQueryクリックハンドラを直接発火させることでボタンの無効化状態を回避

---

### `playwright.config.ts` — Playwright設定

```
testMatch: "**/*.e2e.ts"
timeout: 120000ms
headless: false（ブラウザを表示して実行）
actionTimeout: 15000ms
```

---

### `.env` — 環境変数（gitignore推奨）

```
RINCLE_EMAIL      # ログイン用メールアドレス
RINCLE_PASSWORD   # ログイン用パスワード
RINCLE_AREA       # 検索エリア（例: 兵庫県）
RINCLE_DATE       # 貸出日時（例: 2026/04/05 11:00）
RINCLE_TIME       # 返却日時（例: 2026/04/05 19:00）
```

---

### `read.me` — 初期セットアップメモ

プロジェクト構築時の手順メモ（npm init、Playwright導入、テスト実行手順）。

---

## 調査スクリプト群（`inspect_*.js` / `get_html.js`）

テスト構築の過程でBubbleの内部動作を解析するために作成した使い捨てデバッグスクリプト。`node <ファイル名>` で単体実行する。

### ログイン・ナビゲーション調査

| ファイル | 調査内容 |
|----------|----------|
| `get_html.js` | トップページのHTML取得 |
| `inspect.js` | ログイン関連要素の特定 |
| `inspect2.js` | ログインポップアップ・フォームのDOM構造 |
| `inspect3.js` | ログイン動作の確認 |
| `inspect4.js` | エリア選択ドロップダウンの確認 |
| `inspect5.js` | 検索フロー（エリア→日付未定→検索）の動作確認 |
| `inspect6.js` | 検索結果一覧ページの確認 |
| `inspect7.js` | 一覧から詳細への遷移確認 |
| `inspect8.js` | 自転車詳細ページの要素確認 |
| `inspect_pages.js` | マイページ・ガイド・料金・予約一覧など全ページの構造調査 |
| `inspect_bicycle_id.js` | 自転車詳細ページのURLに含まれるbicycle_idの取得 |

### 予約フォーム・日時選択の調査

| ファイル | 調査内容 |
|----------|----------|
| `inspect_pickers.js` | Pikaday日付ピッカーの構造（`picker__input`のインデックス特定） |
| `inspect_calendar.js` | カレンダーの空き状況表示の確認 |
| `inspect_form_inputs.js` | 予約フォームのinput/select要素一覧 |
| `inspect_selects.js` | 時間選択SELECTの値・オプション調査 |
| `inspect_after_date.js` | 日付選択前後のDOMの変化確認 |
| `inspect_after_time.js` | 時間選択後のDOMの変化確認 |
| `inspect_time.js` | 時間選択（貸出・返却）の動作確認 |
| `inspect_time2.js` | 時間選択の詳細確認 |

### 「予約画面へ進む」ボタン問題の調査

通常クリックでBubbleのワークフローが発火しない問題を解析するために作成したスクリプト群。

| ファイル | 調査内容 |
|----------|----------|
| `inspect_btn_click.js` | ボタンクリック時の挙動確認（2台目の自転車でも試行） |
| `inspect_btn_disabled.js` | `button_disabled`プロパティの取得方法の調査 |
| `inspect_force_click.js` | `force: true`オプションでのクリック試行 |
| `inspect_opacity.js` | ボタンのopacity・visibility・CSSの状態確認 |
| `inspect_click_target.js` | クリック座標での実際のDOM要素の確認 |
| `inspect_group_click.js` | 親要素（`.clickable-element`）経由のクリック試行 |
| `inspect_network.js` | クリック時のネットワークリクエスト有無の監視 |
| `inspect_console.js` | クリック時のコンソールログ・エラーの監視 |
| `inspect_reserve_btn.js` | 「予約画面へ進む」ボタンの属性・イベント調査（1回目） |
| `inspect_reserve_btn2.js` | 同上（2回目） |
| `inspect_reserve_btn3.js` | 同上（3回目） |
| `inspect_reserve_btn4.js` | `picker__holder`の構造・Closeボタン周辺の調査 |
| `inspect_reserve_btn5.js` | ボタンのCSS詳細プロパティ調査 |

### Bubble内部構造の解析

| ファイル | 調査内容 |
|----------|----------|
| `inspect_bubble_page.js` | `window.bubble_page_name`等のBubbleグローバル変数の確認 |
| `inspect_bubble_state.js` | Bubbleのステート変数・リアクティブキャッシュの確認 |
| `inspect_bubble_element.js` | Bubble要素定義（element.json相当）の取得 |
| `inspect_bubble_instance.js` | `bubble_data.bubble_instance`経由のインスタンス・ワークフロー取得 |
| `inspect_app_object.js` | Bubbleのappオブジェクト内のワークフロー一覧取得 |
| `inspect_element_json.js` | `inst.element.json()`でのelement定義取得 |
| `inspect_conditions.js` | ボタンのdisabled条件関数の取得・実行 |
| `inspect_wf_condition.js` | ワークフロー発火条件関数の解析 |
| `inspect_wf_direct.js` | `get_related_workflows()`でのワークフロー定義直接取得 |
| `inspect_workflow_api.js` | ワークフロー実行時の実際のAPIリクエスト内容の確認 |
| `inspect_intercept.js` | `run_element_workflow`関数の傍受・ログ取得 |
| `inspect_run_js.js` | BubbleのビルドファイルであるrunJSのURLとコード取得 |
| `inspect_custom_html.js` | ページ内のカスタムHTML要素の内容確認 |
| `inspect_jquery_handler.js` | `jQuery._data(element, "events")`でのクリックハンドラ取得 |
| `inspect_parent_ctx.js` | 親要素チェーンを遡った`_child`コンテキストの探索 |

### カート・予約完了フローの調査

| ファイル | 調査内容 |
|----------|----------|
| `inspect_popup.js` | 日時入力後のポップアップ・遷移の確認（1回目） |
| `inspect_popup2.js` | 同上（見積もりエリアの確認） |
| `inspect_popup3.js` | 予約確認フローの詳細確認 |
| `inspect_booking.js` | 予約フロー全体の動作確認 |
| `inspect_booking_form.js` | 予約フォーム送信後の挙動確認 |
| `inspect_cart.js` | カートページの構造・ボタン・タイムスタンプ値の調査 |
| `inspect_direct_nav.js` | カートURLへの直接ナビゲーション試行（URLパラメータ探索） |
| `inspect_direct_with_dates.js` | 日付パラメータ付きURLでのカート直接アクセス確認 |
| `inspect_yoyaku_btn.js` | 「予約する」ボタンの属性・表示状態の詳細確認 |
| `inspect_final.js` | 最終的な予約フローの動作確認 |

---

## 技術的なポイント

### なぜ通常クリックが効かないのか

BubbleはSPAフレームワークで、ボタンの無効/有効状態を`button_disabled`というプロパティで管理している。このプロパティは`get_precomputed()`というメソッドが返すキャッシュオブジェクトに格納されており、`run_element_workflow()`関数が最初にこの値をチェックして`true`なら即座に処理を中断する。

日時が未入力の状態ではBubble側が`button_disabled = true`と判定するため、`click()`を呼んでもワークフロー（画面遷移・API呼び出し）が一切発火しない。

### 解決策

```
// 1. get_precomputed を上書きして button_disabled を強制的に false にする
inst.element.get_precomputed = () => {
  const p = origFn();
  if (p) p.button_disabled = false;
  return p;
};

// 2. 同一 page.evaluate() 内で jQuery クリックハンドラを直接発火させる
const handler = jQuery._data(clickable, "events").click[0].handler;
handler.call(clickable, jQuery.Event("click"));
```

上書きとハンドラ発火を同一の同期処理ブロックで実行することで、Bubbleのリアクティブシステムが`button_disabled`を再評価する前にワークフローを起動できる。
