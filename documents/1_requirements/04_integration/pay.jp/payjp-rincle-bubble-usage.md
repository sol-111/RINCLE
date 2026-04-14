# Rincle（Bubble）で使われている Pay.jp 関連一覧

`rincle.bubble` から自動抽出。生成: 2026-04-09 17:29 UTC

## 既存ドキュメントとの関係

- **同じ情報の断片**は [api-workflows.md](./api-workflows.md)（API Connector 表の先頭＋フォルダ `pay.jp`）にも載っています。
- 本ファイルは **Pay.jp だけ**に絞り、**コネクタ定義とエクスポート内参照回数**を併記します。
- Pay.jp 全 API の解説は [payjp-api-summary-ja.md](./payjp-api-summary-ja.md)（公式ベース）。

## 1. API Connector（HTTP で api.pay.jp を呼ぶ定義）

Bubble の `apiconnector2` のうち、URL に `api.pay.jp` を含む呼び出し。

| connector_id | call_id | Bubble 上の名前 | メソッド | URL | エクスポート内参照回数 |
|---|---|---|---|---|---:|
| `bTHZi` | `bTHZj` | Create Tenant | post | `https://api.pay.jp/v1/tenants` | 1 |
| `bTHZi` | `bTHbI` | Create Tenant Approval Link | post | `https://api.pay.jp/v1/tenants/[tenant_id]/application_urls` | 1 |
| `bTHZi` | `bTHqD` | Delete Tenant | delete_method | `https://api.pay.jp/v1/tenants/[tenant_id]` | 1 |
| `bTHZi` | `bTOAP` | Create Client | post | `https://api.pay.jp/v1/customers` | 1 |
| `bTHZi` | `bTOAX` | Create Card | post | `https://api.pay.jp/v1/customers/[id]/cards` | 2 |
| `bTHZi` | `bTOAh` | Create Token | post | `https://api.pay.jp/v1/tokens` | 0 |
| `bTHZi` | `bTOFU0` | Get Client | get | `https://api.pay.jp/v1/customers/[id]` | 0 |
| `bTHZi` | `bTTcd` | Charge | post | `https://api.pay.jp/v1/charges` | 0 |
| `bTHZi` | `bTVFu` | Charge_refund | post | `https://api.pay.jp/v1/charges/[id]/refund` | 2 |
| `bTHZi` | `bTVGG` | account_create | post | `https://api.pay.jp/v1/customers` | 2 |
| `bTHZi` | `bTVHC` | account_register_card | post | `https://api.pay.jp/v1/customers/[customer_id]` | 1 |
| `bTHZi` | `bTVHy` | account_register_default_card | post | `https://api.pay.jp/v1/customers/[customer_id]` | 2 |
| `bTHZi` | `bTVIE` | Charge_by_car_id | post | `https://api.pay.jp/v1/charges` | 3 |
| `bTHZi` | `bTVNI` | Get Client action | get | `https://api.pay.jp/v1/customers/[id]` | 5 |
| `bTHZi` | `bTYlx` | account_register_card_error | post | `https://api.pay.jp/v1/customers/[customer_id]` | 0 |

参照回数はエクスポート JSON 文字列に `apiconnector2-{connector}.{call}` が出現した回数（**0 でも定義は残っている**＝未使用や別形式参照の可能性）。

## 2. バックエンドワークフロー（フォルダ名に pay が含まれるもの）

| wf_name / event_name | type | id | フォルダ |
|---|---|---|---|
| payjp_webhook_update_talent | `APIEvent` | `bTHef` | pay.jp |
| payjp_webhook_charge_captured | `APIEvent` | `bTHex` | pay.jp |
| create_card | `APIEvent` | `bTOEl` | pay.jp |

## 3. 名前に payjp を含む API 定義（フォルダ外も含む）

| wf_name / event_name | type | id |
|---|---|---|
| payjp_webhook_update_talent | `APIEvent` | `bTHef` |
| payjp_webhook_charge_captured | `APIEvent` | `bTHex` |

## 4. 関連しやすい Option Set（名前に pay が含まれるもの）

詳細値は [option-sets.md](./option-sets.md) を参照。

- `pay_jp_apply_redirect_url` — Pay.jp apply redirect url
- `pay_jp_key` — pay_jp_key
- `pay_jp_pk` — pay.jp pk

## 5. User 型フィールド（pay / payjp を含む表示名・キー）

`data-models/user.md` も参照。

- `pay_jp_apply_form_url_text` — pay.jp apply form url
- `shop_pay_real_text` — shop_pay_real
- `user_id_payjp_text` — user_id_payjp
