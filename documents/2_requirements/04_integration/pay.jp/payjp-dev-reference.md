# Pay.JP 開発者向けリファレンス

> Bubbleエクスポート（`rincle.bubble`）の実装に基づいて記載。
> フロー全体の説明は [payjp-flow-asis.md](./payjp-flow-asis.md) を参照。

---

## 1. Pay.jp 契約形態

現状は **Marketplace型** で契約しており、テナント単位での審査が必要。

|  | Marketplace型 | Payouts型 |
|--|--------------|-----------|
| 想定 | 出店者（テナント）が商品・役務の販売主体 | プラットフォーマーが商品・役務の販売主体 |
| 審査 | テナント単位で申請・審査（原則は法人・個人事業主） | 審査対象はプラットフォーマー。テナント単位の個別審査は不要 |

Marketplace型のため、必須パラメータや使えるAPI（審査申請URLは Marketplace型のみ等）が Payouts型と異なる。

---

## 2. API Connector 定義一覧

Bubble API Connector ID: `bTHZi`
Pay.JP API Base URL: `https://api.pay.jp/v1`
認証方式: HTTP Basic認証（Secret Keyをusernameに使用）

### テナント（店舗）管理

| Bubble call_id | API名 | メソッド | エンドポイント | 参照数 | 用途 |
|---|---|---|---|---:|---|
| `bTHZj` | Create Tenant | POST | `/tenants` | 1 | 店舗アカウント作成時にテナントを作成 |
| `bTHbI` | Create Tenant Approval Link | POST | `/tenants/{tenant_id}/application_urls` | 1 | 店舗の本人確認・審査用URLを生成 |
| `bTHqD` | Delete Tenant | DELETE | `/tenants/{tenant_id}` | 1 | テナント削除（管理画面から） |

### 顧客（エンドユーザー）管理

| Bubble call_id | API名 | メソッド | エンドポイント | 参照数 | 用途 |
|---|---|---|---|---:|---|
| `bTVGG` | account_create | POST | `/customers` | 2 | 顧客オブジェクト作成（**実使用**） |
| `bTOAP` | Create Client | POST | `/customers` | 1 | 顧客オブジェクト作成（**実使用。** account_createと同一エンドポイントだが、カード登録フローで cus_id 未作成時のフォールバックとして使用） |
| `bTVNI` | Get Client action | GET | `/customers/{id}` | 5 | 顧客情報取得・カード情報含む（**実使用**） |
| `bTOFU0` | Get Client | GET | `/customers/{id}` | 0 | 顧客情報取得（**未使用。Get Client actionと同一**） |
| `bTOAX` | Create Card | POST | `/customers/{id}/cards` | 2 | カードトークンを顧客に紐付け |
| `bTVHC` | account_register_card | POST | `/customers/{customer_id}` | 1 | カード情報を顧客に登録 |
| `bTVHy` | account_register_default_card | POST | `/customers/{customer_id}` | 2 | デフォルトカードの設定（`default_card`パラメータで指定） |
| `bTYlx` | account_register_card_error | POST | `/customers/{customer_id}` | 0 | カード登録エラー処理用（**未使用**） |

### トークン・決済

| Bubble call_id | API名 | メソッド | エンドポイント | 参照数 | 用途 |
|---|---|---|---|---:|---|
| `bTOAh` | Create Token | POST | `/tokens` | 0 | カード情報からトークン生成（**未使用。フロントエンドCheckout.jsで代替**） |
| `bTTcd` | Charge | POST | `/charges` | 0 | トークンで決済（**未使用。Charge_by_car_idで代替**） |
| `bTVIE` | Charge_by_car_id | POST | `/charges` | 3 | 登録済みカードで決済（**実使用。決済の本体**） |
| `bTVFu` | Charge_refund | POST | `/charges/{id}/refund` | 2 | 返金処理 |

API定義は計15本。うち実使用は**11本**、未使用が**3本**（Get Client / Create Token / Charge）、エラー用1本。

参照回数はエクスポート JSON 文字列に `apiconnector2-{connector}.{call}` が出現した回数（**0 でも定義は残っている**）。

### Charge_by_car_id の送信パラメータ

| パラメータ | 型 | 説明 |
|---|---|---|
| `customer` | text | 顧客ID（`cus_xxxxx`）※ APIキー名には末尾スペースあり |
| `amount` | number | 決済金額 |
| `currency` | text | `"jpy"`（固定・private） |
| `tenant` | text | 店舗のテナントID（`ten_xxxxx`） |
| `platform_fee` | number | Rincleの手数料額 |

---

## 3. ワークフロー詳細（ページ別）

### 店舗フロー（shop_form / shop_admin）

| 大項目 | ユーザー操作 | トリガー | アクション | 詳細 | 改善点 |
|--------|------------|---------|-----------|------|--------|
| 店舗追加 | シスアド画面から「新規追加」 | Button 新規追加 click | show popup | popup add company表示 | |
| | popupでメアド登録 | 招待メール送信 click | send mail | shop_formへのメール送信 | |
| 加盟店申し込み | メアド登録、パス、店舗名、銀行口座保存 | Button 申請する click | | | 招待メールを投げているなら、パラメータにメアドか招待アカウントをDB保存してunique_idをつけて最初から設定しておきたい。URLさえわかれば誰でも登録できるけどいいのか？ |
| | | | sign up | サインアップ | |
| | | | make change user | reviewed_brand = passedで登録（開発のみ） | |
| | | | pay.jp API Create Tenant | テナント作成 | |
| | | | pay.jp API Create Tenant Approval Link | 本番のカード用ブランド審査用のURLを払い出す | |
| | | | make change user | テナントIDやURLを登録する | |
| | | | Schedule API営業日初期登録 | | |
| | | | open page 審査用URL | 審査用のURL画面を表示 | →Pay.jpの画面に移動する |
| Pay.jpに審査情報を登録する | | | | pay.jpで審査情報を登録（口座情報や本人確認書類など） | APIコネクタの設定が本番キーになっているので、本番向けの審査フォームが表示されている |
| 審査中 | | | | popupで審査中が表示 | |
| 審査OK | | Webhook受け取り | Create Webhook Event | ログ作成 | |
| | | | Send Mail | 審査結果をメール送信 | |
| クレカ払い: ライド開始 | 予約情報から「ライド開始」クリック | Button ライド開始 click | showPopup決済_ライド開始 | | |
| | 清算終了しましたか？Yes | Button クレカ決済_はい click | API Charge_by_car_id | 顧客のデフォルトカードに対して、指定した店舗の売上として支払いを実行する | |
| | | | エラーコードなし：予約情報更新 | 請求済みとして更新 | |
| | | | エラーコードあり：予約情報更新 | 店頭決済として更新（未請求） | |
| 店頭払い: ライド開始 | | | | 店頭決済として更新（未請求） | |
| 延長 | 延長はこちらをクリック | Text延長はこちら | show popup延長 | | |
| | 延長を確定するクリック | Button 延長を確定する | make change 予約 | 合計金額を更新 | |
| | | | make change 営業カレンダー | レンタル可能な自転車情報を更新 | |
| | | | make change 予約 | 手数料、延長返却日を更新 | |
| | | | make change 営業カレンダー | レンタル可能な自転車情報を更新 | |
| 延長清算 | ライド終了ボタンクリック | Button ライド終了click | make change 予約 | 返却済み | |
| | | | （延長あり）API Charge_by_car_id | 延長料金の支払い実行 | |
| | | | make change 予約 | 決済済み | |
| | | | エラーのとき：予約更新 | 返却済み、延長未決済、請求no | |

### ユーザーフロー（index）

| 大項目 | ユーザー操作 | トリガー | アクション | 詳細 | 改善点 |
|--------|------------|---------|-----------|------|--------|
| 予約（支払いから） | 自転車・日付選択後 | 画面表示時 | （Dropdown要素） | Dropdownに現在ユーザーのカード取得、表示 | |
| | カードがないとき カード情報を登録する | | （HTML要素） | checkout.pay.jpでカード登録 ★トークン発行 | 本番APIキーになってしまっている。本番か開発かで切り分ける |
| | | get_tokenイベント | API Create Client | 顧客作成 | |
| | | | make change user | 作成した顧客IDを保存 | |
| | | | API account_register_card | 顧客にカード情報を登録 ★トークンで登録 | |
| | | | API get client action | 顧客情報を取得 | |
| 予約確定 | 予約確定ボタンクリック | Button 予約を確定する | （クレジットの場合）API get client action | 顧客情報を取得 | |
| | | | （クレジットの場合）account_register_default_card | 顧客情報を更新。直前で取得したカード情報のうち最新カードをデフォルトカードとして登録 | dropdownで選択したカードではない？ |
| | | | （クレジットの場合）make change user | カードidを更新 | |
| | | | 予約更新 | ステータス＝来客待ち、予約番号、支払い方法 | |
| | | | 営業日カレンダー更新 | | |
| | | | Send Mail | 顧客にメール送信 | |
| | | | Send Mail | 店舗にメール送信 | |
| | | | Send Mail | pedalstandardにメール送信 | |
| お客様情報登録 | 登録を完了するボタンクリック | Button 登録を完了する | make change user | 入力情報を保存 | |
| | | | API account_create | 顧客を作成（email） | |

### 運営者フロー（admin）

| 大項目 | ユーザー操作 | トリガー | アクション | 詳細 | 改善点 |
|--------|------------|---------|-----------|------|--------|
| 返金 | 予約一覧店舗のdropdownから「キャンセル」選択 | Dropdown 予約一覧選択's value changed | show popupキャンセル | popup表示 | |
| 返金あり | 返金あり選択 | Button 返金ありclick | make change予約 | キャンセル、返金済み | |
| | | | （クレジットカードの時）API Charge_refund | 本体料金を返金 | |
| | | | （クレジットカードの時）API Charge_refund | 延長料金を返金 | |
| | | | make change予約 | 返金ID登録 | |
| | | | | 営業日カレンダーを更新 | |
| 課金 | 予約一覧からステータス変更 | Dropdown 予約一覧選択's value changed | API Charge_by_car_id 来客まち・未請求 | 予約金額を請求 | これは何のためにしている？現金支払い等で、支払いが行われていないユーザーに対して実行？ |
| 退会させる | | Button 退会させる click | API Delete Tenant | テナントを削除 | |
| | | | make change user | archive=yes | |

---

## 4. バックエンドワークフロー

### Webhook（Pay.JPからの自動通知受信）

| Bubble WF ID | エンドポイント名 | トリガー条件 | 処理内容 |
|---|---|---|---|
| `bTHex` | payjp_webhook_charge_captured | `body.type == "charge.captured"` | Webhook_Eventレコード作成（type: charge.captured）。決済完了時に発火 |
| `bTHef` | payjp_webhook_update_**talent** | `body.type == "tenant.updated"` | Webhook_Eventレコード作成 + Userの`reviewed_brand`更新 + 審査結果メール送信（通過/否決）。審査結果通知時に発火 |

> **注意:** `payjp_webhook_update_talent` は `tenant` の**typo**。Bubbleの内部IDで紐づいているため動作しているが、名前としては誤り。

Webhook認証ヘッダー: `x-payjp-webhook-token`

### その他のAPIイベント

| Bubble WF ID | エンドポイント名 | 用途 |
|---|---|---|
| `bTOEl` | create_card | カード登録処理用のAPIイベント |

---

## 5. フロントエンド実装（Checkout.js）

- `https://checkout.pay.jp/` をscriptタグで読み込み
- `data-partial = "true"`（トークン取得のみ、決済は行わない）
- `data-submit-text = "新しいカードを登録する"`
- トークン取得成功時: `bubble_fn_tokenget(response.id)` でBubbleのJavascriptToBubble要素にトークンを渡す

> サーバーサイドの `Create Token`（call_id: `bTOAh`）は参照0。トークン生成はフロントエンドのCheckout.jsが担当。

---

## 6. データモデル（Pay.JP関連フィールド）

### User

| フィールド | 型 | 用途 |
|---|---|---|
| cus_id | text | Pay.JP顧客ID（`cus_xxxxx`） |
| tenant_id | text | Pay.JPテナントID（`ten_xxxxx`） |
| reviewed_brand | option (brand_status) | 審査状態（before_review / in_review / passed / declined） |
| user_id_payjp | text | Pay.JPユーザーID |
| pay_jp_apply_form_url | text | 審査申請フォームURL |
| shop_pay_real | text | 店舗決済アカウント情報 |

### 予約情報

| フィールド | 型 | 用途 |
|---|---|---|
| token | text | 決済トークン |
| charge_id | text | 通常決済のチャージID |
| __charge_id | text | 延長料金のチャージID |
| __charge_id1 | text | 返金ID |

### Webhook_Event

| フィールド | 型 | 用途 |
|---|---|---|
| type | text | イベント種別（charge.captured / tenant.updated） |
| text | text | ペイロードテキスト（テナントID等） |

---

## 7. プラットフォーム手数料

- デフォルト手数料率: **10%**（option_set `platform_fee` → `デフォルト` = 10）
- 計算式: `platform_fee = amount × platform_fee_rate / 100`
- `payjp_fee_included: false` → Pay.JP手数料はプラットフォーム手数料に含まない

---

## 8. キー管理

| 用途 | 管理場所 |
|---|---|
| 本番秘密鍵 | API Connector `bTHZi` の Basic認証（`settings.secure`） |
| 本番公開鍵 | Option Set `pay_jp_key` → `live`（Checkout.jsで使用） |
| テスト秘密鍵 | Option Set `pay_jp_key` → `test_sk` |
| テスト公開鍵 | Option Set `pay_jp_key` → `test_pk` / Option Set `pay_jp_pk` |
| 審査後リダイレクトURL | Option Set `pay_jp_apply_redirect_url` |

---

## 9. 関連 Option Set

- `pay_jp_apply_redirect_url` — Pay.jp apply redirect url
- `pay_jp_key` — pay_jp_key
- `pay_jp_pk` — pay.jp pk
