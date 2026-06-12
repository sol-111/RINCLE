# Stripe API 一覧・概要（日本語まとめ・RINCLE向け）

> Stripe移行（ルートC）を検討する際の設計たたき台。[Pay.jp v1まとめ](../pay.jp/payjp-api-v1-summary-ja.md) / [v2まとめ](../pay.jp/payjp-api-v2-summary-ja.md)の姉妹編。
> 作成: 2026-06-12（タスク#20の派生）。**RINCLEの集約モデルで使う範囲に絞っている**（Stripe全体は数百エンドポイントあるため）。詳細は[公式APIリファレンス](https://docs.stripe.com/api)を参照。

---

## 1. 全体像

| 項目 | 内容 |
|------|------|
| ベースURL | `https://api.stripe.com/v1/...` |
| 認証 | シークレットキー（`sk_live_` / `sk_test_`）。Basic認証またはBearer |
| 公開キー | `pk_...` — ブラウザ側（Stripe.js / Elements）でカード情報を直接Stripeへ送るときに使用 |
| ボディ形式 | `application/x-www-form-urlencoded`（ネストは `metadata[key]=value` 形式） |
| バージョニング | **日付ベース**（例: `2026-xx-xx`）。アカウントに固定され、`Stripe-Version` ヘッダで上書き可能。後方互換が強い |
| 冪等性 | `Idempotency-Key` ヘダー対応（二重課金防止。決済系POSTでは必須運用にすべき） |
| Stripeの `/v2` 名前空間 | イベント配信（Event Destinations）等の一部APIのみ。**カード決済は引き続き `/v1` が現行**（2026-06時点） |
| Bubble連携 | 公式プラグインあり（Elements・PaymentIntent対応）。3DSはPaymentIntentが自動でハンドリング |

---

## 2. Pay.jpとの対応表（載せ替え時の読み替え）

| Pay.jp v1 | Pay.jp v2 | Stripe | 備考 |
|-----------|-----------|--------|------|
| Charge | PaymentFlow | **PaymentIntent** | 状態機械もほぼ同じ（requires_confirmation / requires_action / requires_capture …） |
| Token / Card | PaymentMethod | **PaymentMethod** | カード情報はElementsで直接Stripeへ。**登録時にCVC検証あり** |
| —（50円オーソリで代用） | SetupFlow | **SetupIntent** | 決済なしでカード検証・保存。**¥50オーソリ自体が不要になる**（SetupIntentが0円で同等の検証を行う） |
| Checkout | Checkout Session | **Checkout Session** | ホスト型決済ページ |
| Plan / Subscription | （未提供・2026年中） | **Price + Subscription（Billing）** | 店舗月額課金に使える。請求書・按分・トライアル等が高機能 |
| Transfer（入金） | payment_transactions等 | **Payout / BalanceTransaction** | 自社口座への入金管理 |
| Platform API（テナント） | （未対応・2027年） | **Connect** | **集約モデルでは不要**（単一アカウントで完結） |
| 3DS（自前実装） | 全カード必須 | **自動**（PaymentIntentがリスクベースで要求） | 義務化対応が標準で済む |

---

## 3. 決済の中心概念: PaymentIntent

```
requires_payment_method → requires_confirmation → (requires_action: 3DS等)
  → processing → succeeded
                ↘ requires_capture（capture_method=manual のとき）→ capture → succeeded
いつでも → canceled
```

| 項目 | 値 |
|------|----|
| capture_method | `automatic`（即時確定・デフォルト）/ `manual`（オーソリ→確定） |
| オーソリ期間 | 標準7日（Visa非対面5日）。**日本アカウントの円建ては最長30日** |
| 部分キャプチャ | ○（`amount_to_capture` 指定・残額は自動解放） |
| オーバーキャプチャ / 延長オーソリ | 対象決済のみ（extended authorization） |
| レシート | `receipt_email` 指定で**決済完了メールを自動送信**（集約モデルの領収書要件に対応） |

---

## 4. リソース別エンドポイント（RINCLEで使う範囲）

### PaymentIntent（支払い）

| メソッド | パス | 意味 |
|----------|------|------|
| POST | `/v1/payment_intents` | 作成（amount, currency=jpy, customer, payment_method, capture_method 等） |
| GET | `/v1/payment_intents` / `:id` | 一覧 / 取得 |
| POST | `/v1/payment_intents/:id` | 更新 |
| POST | `/v1/payment_intents/:id/confirm` | 確定実行（3DSが必要なら requires_action へ） |
| POST | `/v1/payment_intents/:id/capture` | 売上確定（`amount_to_capture` で部分キャプチャ可） |
| POST | `/v1/payment_intents/:id/cancel` | キャンセル（オーソリ解放） |

### SetupIntent（カード検証・保存 — 50円オーソリの代替）

| メソッド | パス | 意味 |
|----------|------|------|
| POST | `/v1/setup_intents` | 作成（将来課金用にカードを検証して保存） |
| GET / POST | `/v1/setup_intents/:id` | 取得 / 更新 |
| POST | `/v1/setup_intents/:id/confirm` / `:id/cancel` | 確定 / キャンセル |

### Customer / PaymentMethod（顧客・カード）

| メソッド | パス | 意味 |
|----------|------|------|
| POST / GET | `/v1/customers`、GET/POST/DELETE `/v1/customers/:id` | 顧客のCRUD |
| GET | `/v1/customers/:id/payment_methods` | 顧客の支払い手段一覧 |
| POST / GET | `/v1/payment_methods` / `:id` | 作成（通常はElements経由）/ 取得 |
| POST | `/v1/payment_methods/:id/attach` / `:id/detach` | 顧客への紐付け / 解除 |

### Refund（返金）

| メソッド | パス | 意味 |
|----------|------|------|
| POST | `/v1/refunds` | 返金作成（`payment_intent` + `amount` で部分返金可。キャンセルポリシーの実装箇所） |
| GET / POST | `/v1/refunds/:id` | 取得 / 更新 |

### Checkout Session（ホスト型決済ページ・任意）

| メソッド | パス | 意味 |
|----------|------|------|
| POST / GET | `/v1/checkout/sessions` / `:id` | 作成 / 取得（mode: payment / setup / subscription） |
| GET | `/v1/checkout/sessions/:id/line_items` | 明細一覧 |

### Billing（店舗月額課金に使う系）

| メソッド | パス | 意味 |
|----------|------|------|
| POST / GET | `/v1/products`、`/v1/prices` | 商品・価格（月額プランの定義） |
| POST / GET | `/v1/subscriptions` / `:id` | 定期課金の作成・取得（cancel は DELETE `/v1/subscriptions/:id`） |
| GET | `/v1/invoices` / `:id` | 請求書（自動生成・支払い状況の追跡） |

### 入金・会計系

| メソッド | パス | 意味 |
|----------|------|------|
| GET | `/v1/balance` | 現在の残高 |
| GET | `/v1/balance_transactions` | 残高の増減明細（手数料・返金含む。**月次の実入金照合はここ**） |
| GET | `/v1/payouts` / `:id` | 自社銀行口座への入金（自動・手数料無料） |
| GET | `/v1/disputes` / `:id` | チャージバック |

### Webhook / イベント

| メソッド | パス | 意味 |
|----------|------|------|
| GET | `/v1/events` / `:id` | イベント取得 |
| POST / GET / DELETE | `/v1/webhook_endpoints` 系 | Webhook送信先の管理（署名検証 `Stripe-Signature` 必須） |

主要イベントtype: `payment_intent.succeeded` / `payment_intent.payment_failed` / `payment_intent.requires_action` / `charge.refunded` / `charge.dispute.created` / `setup_intent.succeeded` / `invoice.paid` / `invoice.payment_failed` / `customer.subscription.created|updated|deleted` / `payout.paid`

---

## 5. RINCLEにとっての意味（2026-06時点）

1. **集約モデルは素のアカウント1つで完結**: Connect（Pay.jpのPlatform API相当）は不要。店舗の決済アカウント・審査が消える
2. **50円オーソリが要らなくなる**: カード有効性チェックはSetupIntentが標準機能（0円・3DS込み）。キャンセルポリシーの与信担保はこれで設計できる
3. **店舗月額課金は今日から作れる**: Billing（Price+Subscription+Invoice）が揃っている。Pay.jp v2は2026年中提供予定でまだ無い
4. **3DS・CVC・領収書が標準**: 義務化対応（3DS）はPaymentIntentに任せられる。CVCは登録時検証。レシートメールは `receipt_email` だけ
5. **移行コスト**: カード再登録88人（Elementsで再入力・SetupIntent経由）。既存Pay.jp API定義15本の置き換え。Bubble公式プラグインで主要フローは素直
6. **手数料は3.6%でPay.jp（3.3%〜2.78%）より高い** — これが唯一の構造的デメリット（詳細は[比較資料](../payjp-vs-stripe-comparison.md)§2）

---

## 6. 参考リンク

- [Stripe APIリファレンス](https://docs.stripe.com/api) / [PaymentIntent](https://docs.stripe.com/api/payment_intents) / [SetupIntent](https://docs.stripe.com/api/setup_intents)
- [オーソリ（Place a hold）](https://docs.stripe.com/payments/place-a-hold-on-a-payment-method)（日本円30日特例の記載あり）
- [Billing（サブスクリプション）](https://docs.stripe.com/billing) / [Webhook](https://docs.stripe.com/webhooks)
- [API v2名前空間の概要](https://docs.stripe.com/api-v2-overview)（決済は引き続きv1）
- [料金（日本）](https://stripe.com/jp/pricing)
- 関連: [payjp-vs-stripe-comparison.md](../payjp-vs-stripe-comparison.md)（#20比較・移行計画は同mdの§9に統合済み）
