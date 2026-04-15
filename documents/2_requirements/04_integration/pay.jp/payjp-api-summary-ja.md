# PAY.JP API 一覧・概要（日本語まとめ）

[PAY.JP API リファレンス](https://pay.jp/docs/api/)（REST / 主に **v1**）の構成を、移行・設計のたたき台として整理したものです。詳細パラメータ・制約は必ず公式ドキュメントを参照してください。

---

## 1. 全体像

| 項目 | 内容 |
|------|------|
| ベース URL | `https://api.pay.jp/v1/` |
| プロトコル | **HTTPS のみ** |
| 認証 | **Basic 認証** — ユーザー名に **シークレットキー**（`sk_...`）、パスワードは空 |
| パブリックキー | `pk_...` — 主にブラウザ側でカードを **トークン化** するときに使用（シークレットと役割が異なる） |
| メソッド | **GET** / **POST** / **DELETE** |
| POST のボディ | `Content-Type: application/x-www-form-urlencoded` |
| レスポンス | JSON（UTF-8） |

**API v2 について:** [PAY.JP v2 ドキュメント](https://docs.pay.jp/v2) では、クレジット以外の手段や Checkout 等が扱われます。本ファイルは **v1 REST のリソース中心**です。

---

## 2. 共通機能（リソース以外）

| 区分 | 内容（日本語） |
|------|----------------|
| **Error** | エラーは JSON の `error` オブジェクト（`type`, `code`, `message`, `param` 等）。SDK では用途別例外で捕捉可能 |
| **Rate Limit** | レートリミットゾーンあり。超過時は `429` 等 — 公式のチュートリアル参照 |
| **List（ページネーション）** | `limit` / `offset` 等で一覧 API をページ分割 |
| **Metadata** | 各オブジェクトに付与可能なメタデータ（キー数・文字数に上限あり） |
| **イベントと Webhook** | リソース操作時に `event` が生成され、登録先があれば Webhook 送信（下表） |

### Webhook / イベント `type` 一覧（公式表の要約）

| type | 意味（日本語） |
|------|----------------|
| charge.succeeded / failed / updated / refunded / captured | 支払いの成功・失敗・更新・返金・確定 |
| dispute.created | チャージバック発生 |
| token.created | トークン作成 |
| customer.created / updated / deleted | 顧客の作成・更新・削除 |
| customer.card.created / updated / deleted | 顧客に紐づくカードの作成・更新・削除 |
| plan.created / updated / deleted | プランの作成・更新・削除 |
| subscription.* | 定期課金の作成・更新・削除・一時停止・再開・キャンセル・期間更新 等 |
| transfer.succeeded | 入金内容の確定（通常加盟店・プラットフォーマー） |
| tenant.* / tenant_transfer.succeeded | **Platform** 向けテナント・テナント入金 |
| term.created / closed | 集計区間の作成・締め完了 |
| statement.created | 取引明細の作成 |
| balance.* | 残高の作成・確定・精算完了・マージ 等 |

---

## 3. 標準 API — リソース別エンドポイント

### Charge（支払い）

| メソッド | パス | 意味（日本語） |
|----------|------|----------------|
| POST | `/v1/charges` | 支払いを作成 |
| GET | `/v1/charges/:id` | 支払いを取得 |
| POST | `/v1/charges/:id` | 支払いを更新 |
| GET | `/v1/charges` | 支払い一覧 |
| POST | `/v1/charges/:id/capture` | 支払いを確定（オーソリの確定） |
| POST | `/v1/charges/:id/refund` | 返金 |
| POST | `/v1/charges/:id/reauth` | 再度与信枠確保 |
| POST | `/v1/charges/:id/tds_finish` | **3D セキュア**フロー完了 |

### Customer（顧客）

| メソッド | パス | 意味（日本語） |
|----------|------|----------------|
| POST | `/v1/customers` | 顧客を作成 |
| GET | `/v1/customers/:id` | 顧客を取得 |
| POST | `/v1/customers/:id` | 顧客を更新 |
| DELETE | `/v1/customers/:id` | 顧客を削除 |
| GET | `/v1/customers` | 顧客一覧 |

### Customer に紐づく Card（カード）

| メソッド | パス | 意味（日本語） |
|----------|------|----------------|
| POST | `/v1/customers/:id/cards` | 顧客のカードを追加 |
| GET | `/v1/customers/:id/cards/:card_id` | 特定カードを取得 |
| POST | `/v1/customers/:id/cards/:card_id` | カード情報を更新 |
| DELETE | `/v1/customers/:id/cards/:card_id` | カードを削除 |
| GET | `/v1/customers/:id/cards` | カード一覧 |

### Customer に紐づく Subscription（定期課金の参照）

| メソッド | パス | 意味（日本語） |
|----------|------|----------------|
| GET | `/v1/customers/:id/subscriptions/:subscription_id` | 特定の定期課金を取得 |
| GET | `/v1/customers/:id/subscriptions` | 定期課金一覧 |

### Plan（プラン）

| メソッド | パス | 意味（日本語） |
|----------|------|----------------|
| POST | `/v1/plans` | プラン作成 |
| GET | `/v1/plans/:id` | プラン取得 |
| POST | `/v1/plans/:id` | プラン更新 |
| DELETE | `/v1/plans/:id` | プラン削除 |
| GET | `/v1/plans` | プラン一覧 |

### Subscription（定期課金）

| メソッド | パス | 意味（日本語） |
|----------|------|----------------|
| POST | `/v1/subscriptions` | 定期課金を作成 |
| GET | `/v1/subscriptions/:id` | 取得 |
| POST | `/v1/subscriptions/:id` | 更新 |
| POST | `/v1/subscriptions/:id/pause` | 一時停止 |
| POST | `/v1/subscriptions/:id/resume` | 再開 |
| POST | `/v1/subscriptions/:id/cancel` | キャンセル |
| DELETE | `/v1/subscriptions/:id` | 削除 |
| GET | `/v1/subscriptions` | 一覧 |

### Token（トークン）

カード番号等を **トークン化** したオブジェクト。サーバーは原則 **生のカードデータを扱わず** トークンで Charge 等に渡す。

| メソッド | パス | 意味（日本語） |
|----------|------|----------------|
| POST | `/v1/tokens` | トークン作成 |
| GET | `/v1/tokens/:id` | トークン取得 |
| POST | `/v1/tokens/:id/tds_finish` | 3D セキュア完了 |

### Transfer（入金）

| メソッド | パス | 意味（日本語） |
|----------|------|----------------|
| GET | `/v1/transfers/:id` | 入金情報を取得 |
| GET | `/v1/transfers` | 入金一覧 |
| GET | `/v1/transfers/:id/charges` | その入金に含まれる支払い一覧 |

### Statement（取引明細）

| メソッド | パス | 意味（日本語） |
|----------|------|----------------|
| GET | `/v1/statements/:id` | 取引明細を取得 |
| POST | `/v1/statements/:id/statement_urls` | 明細 URL 関連の操作（詳細は公式） |
| GET | `/v1/statements` | 取引明細一覧 |

### Term（集計区間）

| メソッド | パス | 意味（日本語） |
|----------|------|----------------|
| GET | `/v1/terms/:id` | 区間を取得 |
| GET | `/v1/terms` | 区間一覧 |

### Balance（残高）

| メソッド | パス | 意味（日本語） |
|----------|------|----------------|
| GET | `/v1/balances/:id` | 残高を取得 |
| POST | `/v1/balances/:id/statement_urls` | 明細 URL 関連（詳細は公式） |
| GET | `/v1/balances` | 残高一覧 |

### Event（イベント）

| メソッド | パス | 意味（日本語） |
|----------|------|----------------|
| GET | `/v1/events/:id` | イベント 1 件取得 |
| GET | `/v1/events` | イベント一覧 |

### ThreeDSecureRequest（3D セキュアリクエスト）

| メソッド | パス | 意味（日本語） |
|----------|------|----------------|
| POST | `/v1/three_d_secure_requests` | 3DS リクエスト作成 |
| GET | `/v1/three_d_secure_requests/:id` | 取得 |
| GET | `/v1/three_d_secure_requests/` | 一覧 |

### Account（アカウント）

| メソッド | パス | 意味（日本語） |
|----------|------|----------------|
| GET | `/v1/accounts` | 自アカウント情報取得（`account` / 内包の `merchant` 等） |

### 3-D Secure（開始 URL）

| メソッド | パス | 意味（日本語） |
|----------|------|----------------|
| GET | `/v1/tds/:resource_id/start` | 3D セキュア認証画面への開始（戻り先 URL 等は公式参照） |

---

## 4. Platform API（β版）

マーケットプレイス型・Payouts 型アカウント向け。**テナント**ごとに売上分配・入金・プラットフォーム手数料などを扱う。

- 通常の **Charge / Transfer** を拡張して利用する部分と、**Tenant / TenantTransfer** 専用リソースがある。
- Platform 利用時、**Plan / Subscription の一部 API は利用不可**（公式に「準備中」と記載）という制約あり。
- 認証・JSON 形式は v1 共通項目に準拠。Platform 固有の `error[code]` が追加される。

### Tenant（テナント）

| メソッド | パス | 意味（日本語） |
|----------|------|----------------|
| POST | `/v1/tenants` | テナント作成 |
| GET | `/v1/tenants/:id` | 取得 |
| POST | `/v1/tenants/:id` | 更新 |
| DELETE | `/v1/tenants/:id` | 削除 |
| GET | `/v1/tenants` | 一覧 |
| POST | `/v1/tenants/:id/application_urls` | 本番申請用 URL 等（承認フロー向け） |

### Tenant Transfer（テナント入金）

| メソッド | パス | 意味（日本語） |
|----------|------|----------------|
| GET | `/v1/tenant_transfers/:tenant_transfer_id` | テナント入金を取得 |
| POST | `/v1/tenant_transfers/:tenant_transfer_id/statement_urls` | 明細 URL 関連 |
| GET | `/v1/tenant_transfers` | 一覧 |
| GET | `/v1/tenant_transfers/:tenant_transfer_id/charges` | 紐づく支払い一覧 |

### Charge for Platform / Transfer for Platform

- **Charge:** 通常の `/v1/charges` を利用。作成時に **`tenant` 指定が必須**、`platform_fee` 等 Platform 専用プロパティあり（公式の「Charge for Platform」節参照）。
- **Transfer:** プラットフォーマー側の入金は通常の **`/v1/transfers`**。テナント側の入金は **`tenant_transfers`**。

---

## 5. Rincle（Bubble）で実際に定義されているもの

**一覧の正本（コネクタ全件・参照回数・Webhook WF 等）は [payjp-rincle-bubble-usage.md](./payjp-rincle-bubble-usage.md)**（`scripts/generate_bubble_docs.py` が `rincle.bubble` から生成）。

概要として、API Connector には **テナント／顧客／カード／トークン／課金／返金** など `api.pay.jp/v1/...` の呼び出しがまとまって定義されています。Webhook では `payjp_webhook_charge_captured` 等の **API Event** が `pay.jp` フォルダにあります（詳細は上記ファイルおよび `api-workflows.md`）。

---

## 6. 参考リンク

- [PAY.JP API リファレンス（v1）](https://pay.jp/docs/api/)
- [PAY.JP ドキュメントトップ](https://pay.jp/docs/)
- [PAY.JP v2 ドキュメント](https://docs.pay.jp/v2)
- [PAY.JP Platform チュートリアル](https://pay.jp/v1/platform-introduction)（Platform 利用時）
