# PAY.JP テストモード & E2Eテスト調査結果

## 1. テストモードの有無

**結論: あり。** PAY.JPはテストモードとライブモードを完全に分離して提供している。

### テストキーの形式

| 種別 | プレフィックス | 例 | 用途 |
|------|--------------|-----|------|
| テスト公開鍵 | `pk_test_` | `pk_test_0ede...` | フロントエンド（Checkout.js / トークン作成） |
| テスト秘密鍵 | `sk_test_` | `sk_test_7737...` | サーバーサイド（API認証・Basic認証のユーザー名） |
| 本番公開鍵 | `pk_live_` | `pk_live_17c3...` | 本番フロントエンド |
| 本番秘密鍵 | `sk_live_` | （管理画面で確認） | 本番サーバーサイド |

**重要な仕様:**
- テスト用キーでは本番の決済ネットワークへ接続されず、実際の請求は一切行われない
- テストモードのデータは本番に影響しない（完全分離）
- 本番モードでテストカードを使うと `test_card_on_livemode` エラーが返される

### Rincle既存実装での管理

Option Set `pay_jp_key` で管理されている:
- `test_sk` → `sk_test_7737...`
- `test_pk` → `pk_test_0ede...`
- `live` → `pk_live_17c3...`

---

## 2. テストカード番号一覧

### 正常系（トークン作成成功）

| カード番号 | ブランド | 備考 |
|-----------|---------|------|
| `4242424242424242` | Visa | **最も標準的なテストカード** |
| `4012888888881881` | Visa | |
| `5555555555554444` | Mastercard | |
| `5105105105105100` | Mastercard | |
| `3530111333300000` | JCB | |
| `3566002020360505` | JCB | |
| `378282246310005` | American Express | |
| `371449635398431` | American Express | |
| `38520000023237` | Diners Club | |
| `30569309025904` | Diners Club | |
| `6011111111111117` | Discover | |
| `6011000990139424` | Discover | |

> テストモードでは、カード番号以外の有効期限・CVC・名義には任意の値を送信可能（バリデーションを通過する値であれば）。

### 異常系 - トークン作成時にエラーを返すカード

| カード番号 | エラーコード | 意味 |
|-----------|------------|------|
| `4000000000000002` | `card_declined` | カード利用不可 |
| `4000000000000069` | `expired_card` | 有効期限切れ |
| `4000000000000127` | `invalid_cvc` | 不正なセキュリティコード |
| `4000000000000119` | `processing_error` | 決済サーバーエラー |
| `4000003720000278` | `invalid_expiration_date` | 不正な有効期限 |
| `4000000000001110` | `invalid_expiration_date` | 不正な有効期限（旧カード） |
| `36227206271667` | `unacceptable_brand` | 利用可能ブランド以外 |

### 異常系 - 支払い（Charge）時にエラーを返すカード

| カード番号 | エラーコード | 意味 |
|-----------|------------|------|
| `4000000000080319` | `card_declined` | 支払い不可 |
| `4000000000004012` | `expired_card` | 有効期限切れ |
| `4000000000080202` | `card_declined` | 10,000円超で与信枠超過 |
| `4000000000000077` | `invalid_expiration_date` | 不正な有効期限 |
| `4000000000001111` | `invalid_expiration_date` | 不正な有効期限（旧カード） |

> **E2Eテストのポイント:** `4000000000080319` はトークン作成は成功するが、Charge時にエラーになる。これにより「カード登録は通るが決済で失敗する」シナリオをテスト可能。

### 特殊ステータスを返すカード

| カード番号 | 動作 |
|-----------|------|
| `4000000000000036` | `address_zip_check=failed`（郵便番号確認失敗） |
| `4000000000000101` | `cvc_check=failed`（CVC確認失敗） |
| `4000000000000044` | `cvc_check=unavailable`（CVC確認不可） |

### 海外発行カード

| カード番号 | ブランド | 動作 |
|-----------|---------|------|
| `4000000900000003` | Visa | `is_jp=false`、オーソリ期限が7日に制限 |

---

## 3. フルフローテスト（token → charge → capture → refund）

**結論: 全て可能。** テストモードで以下のフルフローをE2Eテストできる。

### テスト可能なフロー

```
Step 1: トークン作成
  POST /v1/tokens
  body: card[number]=4242424242424242&card[exp_month]=12&card[exp_year]=2028&card[cvc]=123
  → tok_xxxx を取得

Step 2: 仮売上（オーソリ）
  POST /v1/charges
  body: amount=1000&currency=jpy&card=tok_xxxx&capture=false
  → ch_xxxx を取得（captured=false）
  ※ capture=false で与信枠確保のみ

Step 3: 売上確定（キャプチャ）
  POST /v1/charges/ch_xxxx/capture
  → captured=true に変更
  ※ 確定時に元の金額より少額での確定も可能（差額は返金扱い）

Step 4: 返金
  POST /v1/charges/ch_xxxx/refund
  → refunded=true
  ※ amount指定で部分返金も可能
```

### 各パラメータの詳細

| パラメータ | 説明 |
|-----------|------|
| `capture=false` | 仮売上（オーソリのみ） |
| `expiry_days` | 与信枠確保期限。デフォルト7日、1〜60日で設定可能 |
| `capture` 時の `amount` | 元金額以下で確定可能（差額は返金扱い） |
| `refund` 時の `amount` | 部分返金の金額指定。省略で全額返金 |
| 返金可能期限 | 売上作成より**180日以内** |

### Rincleの決済フローとの対応

```
Rincle予約時の決済:
  Token作成（Checkout.js） → Charge（capture=true、即時確定）→ 必要に応じてRefund

延長料金:
  別のCharge → 必要に応じてRefund

キャンセル返金:
  通常分Refund + 延長分Refund（2回返金）
```

---

## 4. Platform / Tenant機能のテスト

**結論: テストモードで利用可能。**

### テスト可能な操作

| 操作 | テスト可否 | エンドポイント |
|------|----------|--------------|
| テナント作成 | 可能 | `POST /v1/tenants` |
| テナント更新 | 可能 | `POST /v1/tenants/:id` |
| テナント削除 | 可能 | `DELETE /v1/tenants/:id` |
| 審査用URL生成 | 可能 | `POST /v1/tenants/:id/application_urls` |
| テナント指定での課金 | 可能 | `POST /v1/charges`（`tenant`パラメータ指定） |
| プラットフォーム手数料 | 可能 | `platform_fee`パラメータで指定 |

### テスト環境での制限事項

- テストキー（`sk_test_`）では**本番環境のテナント操作は不可**
- テナント審査（本人確認）の実際の審査プロセスはテストでは発生しない
- 本番環境の開通までは、本番キーでのテナント作成・更新が制限される

### Rincle向けのテストシナリオ例

```
1. テナント作成（店舗登録）
   POST /v1/tenants
   body: name=テスト店舗&platform_fee_rate=10&bank_code=0001&...

2. テナント指定で課金
   POST /v1/charges
   body: amount=10000&currency=jpy&card=tok_xxxx&tenant=ten_xxxx&platform_fee=1000

3. Webhook受信（tenant.updated）でreviewed_brand更新の確認
```

---

## 5. Webhookのテスト

**結論: テストモードでWebhookテスト可能。管理画面からテスト送信も可能。**

### Webhook設定方法

1. [PAY.JP管理画面](https://console.pay.jp/d/settings) にアクセス
2. Webhook送信先URLを入力
3. テストモード / 本番モードを選択
4. 複数の送信先URLを追加可能

### テスト送信機能

- **管理画面から各種イベントのテスト送信が可能**
- 実際のイベント発生を待たずにWebhookの受信確認ができる

### Webhook仕様

| 項目 | 内容 |
|------|------|
| HTTPメソッド | POST |
| リクエストボディ | イベントのJSONデータ |
| 正常応答 | HTTPステータス 200 |
| リトライ | 4xx/5xxレスポンス時、3分間隔で最大3回 |
| セキュリティヘッダ | `X-Payjp-Webhook-Token`（アカウント固有トークン） |
| 本番推奨 | HTTPS必須 |

### Rincleで使用中のWebhookイベント

| イベント | 用途 |
|---------|------|
| `charge.captured` | 支払い確定の通知受信 → Webhook_Eventレコード作成 |
| `tenant.updated` | テナント審査状態の更新 → ユーザーのreviewed_brand更新 |

### ローカル開発でのWebhookテスト方法

テスト環境でWebhookを受信するには、ローカルサーバーを外部公開する必要がある:

1. **ngrok** 等のトンネリングツールを使用
   ```bash
   ngrok http 3000
   ```
2. 生成されたURL（例: `https://xxxx.ngrok.io/api/webhook/payjp`）をPAY.JP管理画面に登録
3. テスト送信 or テストカードで実際に決済してWebhook受信を確認

---

## 6. テスト環境の制限事項まとめ

### レートリミット

| ゾーン | テストモード | ライブモード |
|--------|------------|-----------|
| pk（公開鍵系） | **2 req/sec** | 10 req/sec |
| payment（決済系） | **2 req/sec** | 14 req/sec |
| sk（秘密鍵系） | **2 req/sec** | 30 req/sec |

> テストモードは全ゾーン一律 2 req/sec。負荷テストには不向き。

### その他の制限

| 項目 | 制限内容 |
|------|---------|
| 実決済 | テストモードでは実際の決済ネットワークに接続されない（当然ながら） |
| テストカード | テストカードは本番では使用不可（`test_card_on_livemode`エラー） |
| レートリミット | 全ゾーン 2 req/sec（負荷テスト不可） |
| テナント審査 | 実際のPay.JPによる審査プロセスは発生しない |
| 入金（Transfer） | テストモードでは実際の銀行振込は発生しない |
| 3Dセキュア | テストモードでの3DS認証フローの挙動は公式ドキュメント要確認 |
| レートリミット変更 | サーバー攻撃・過負荷時は予告なく変更される可能性あり |

---

## 7. E2Eテスト実装に向けた推奨事項

### 推奨テストシナリオ

1. **正常系フロー**
   - カード: `4242424242424242`
   - Token作成 → Customer作成 → Card登録 → Charge（capture=true）→ Refund

2. **仮売上フロー**
   - Token → Charge（capture=false）→ Capture → Refund

3. **カード拒否シナリオ**
   - カード: `4000000000080319`（Charge時にcard_declined）
   - Token作成は成功するが、決済で失敗するケースの確認

4. **Platform決済フロー**
   - Tenant作成 → Token作成 → Charge（tenant指定 + platform_fee）→ Refund

5. **Webhook受信フロー**
   - `charge.captured` イベントの受信・処理確認
   - `tenant.updated` イベントの受信・reviewed_brand更新確認

### 環境変数の管理

```
PAYJP_PUBLIC_KEY=pk_test_0ede...
PAYJP_SECRET_KEY=sk_test_7737...
```

---

## 参考リンク

- [テストカード一覧](https://docs.pay.jp/v1/testcard)
- [API リファレンス](https://docs.pay.jp/v1/api/)
- [Webhook ドキュメント](https://docs.pay.jp/v1/webhook)
- [Platform 導入ガイド](https://docs.pay.jp/v1/platform-introduction)
- [PAY.JP 管理画面](https://console.pay.jp/)
