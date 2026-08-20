# PAY.JP API v2 一覧・概要（日本語まとめ）

> **注記（2026-08-20）:** 今後の決済は **Stripeへの載せ替えが決定**（2026-06-19定例・実装タスク#35）。本書はその判断材料となったPay.JP v2の調査まとめ（現行本番はPay.JP v1で稼働中）。
>
> PAY.JPの新世代API（**2026-02-12提供開始**）のリファレンスまとめ。[v1まとめ](./payjp-api-v1-summary-ja.md)の姉妹編。
> 作成: 2026-06-12（タスク#20 Pay.jp vs Stripe再調査の派生）。出典: [docs.pay.jp/v2](https://docs.pay.jp/v2) の公開OpenAPI定義（2.0.0）を解析 + [v1→v2移行ガイド](https://docs.pay.jp/v2/guide/v2-migration)。詳細パラメータは必ず公式を参照。

---

## 1. 全体像

| 項目 | 内容 |
|------|------|
| パス | `/v2/...`（v1の `/v1/...` と並存。**v1は継続提供**） |
| 認証 | Basic認証（シークレットキー）に加え **Bearer** にも対応。**APIキーはv1/v2共通** |
| 対応決済手段 | `card` / `paypay` / `apple_pay`（v1はカード+Apple Payのみ。**PayPayはv2限定**） |
| 通貨 | `jpy` のみ |
| モバイルSDK | **v2は非対応**（iOS/Android/Flutter/React Native SDKはv1のみ）。v2はWeb中心 |
| 3Dセキュア | **v2では全カードが初回決済までに3DS認証必須**（構造に織り込み済み） |

---

## 2. v1との対応関係（移行ガイドの要点）

| v1 | v2 | 備考 |
|----|----|------|
| Charge（支払い） | **PaymentFlow** | 別システム扱い。**v1のChargeはv1 APIで操作し続ける**（返金期限180日など既存分はv1で完結） |
| Token / Card | **PaymentMethod** | v1で登録済みのCardは**v2のPaymentMethodとして自動マッピング**される（逆方向は不可: v2で作ったPaymentMethodはv1から見えない） |
| Customer | Customer | **IDはv1/v2で共通** |
| `default_card` | `default_payment_method` | フィールド名変更 |
| `cvc_check` / `address_zip_check` | **廃止** | カードオブジェクトから削除 |
| Plan / Subscription（定期課金） | **未提供**（2026年中に提供予定） | それまで定期課金はv1を使い続ける |
| Platform API（テナント） | **未対応**（2027年対応予定） | マーケットプレイス型はv1のみ |
| Checkout | Checkout Session | ホスト型決済ページとして再設計 |

> **設計上の注目点**: PaymentFlow / SetupFlow / Checkout Session / Product / Price / TaxRate という構成は、StripeのPaymentIntent / SetupIntent / Checkout / Products / Prices / Tax Ratesと**ほぼ同型の概念体系**。v1→v2移行は「Stripe移行と同程度の概念変更」と考えてよい（#20比較資料の「どのルートでも決済実装の作り替えは避けられない」の根拠）。

---

## 3. 決済の中心概念: PaymentFlow

支払い1件のライフサイクルを状態機械で管理するオブジェクト（v1のChargeの後継）。

```
requires_payment_method → requires_confirmation → (requires_action: 3DS等)
  → processing → succeeded
                ↘ requires_capture（capture_method=manual のとき）→ capture → succeeded
いつでも → canceled
```

| 項目 | 値 |
|------|----|
| ステータス | `requires_payment_method` / `requires_confirmation` / `requires_action` / `processing` / `requires_capture` / `succeeded` / `canceled` |
| capture_method | `automatic`（即時確定）/ `manual`（オーソリ→確定。**v2のオーソリ期間は最大30日** — v1の60日より短い） |
| 操作 | `confirm`（確定実行）/ `capture`（売上確定）/ `cancel`（取消・オーソリ解放） |

カード保存（決済なしの有効性確認・将来課金用）は **SetupFlow**（Stripe SetupIntent相当）で行う。ステータス体系はPaymentFlowと同様（requires_captureを除く）。

---

## 4. リソース別エンドポイント（OpenAPI 2.0.0 / 44パス）

### PaymentFlow（支払い）

| メソッド | パス | 意味 |
|----------|------|------|
| POST | `/v2/payment_flows` | 支払いフロー作成 |
| GET | `/v2/payment_flows` / `/v2/payment_flows/:id` | 一覧 / 取得 |
| POST | `/v2/payment_flows/:id` | 更新 |
| POST | `/v2/payment_flows/:id/confirm` | 確定実行（3DS等のアクションへ） |
| POST | `/v2/payment_flows/:id/capture` | 売上確定（manualキャプチャ） |
| POST | `/v2/payment_flows/:id/cancel` | キャンセル（オーソリ解放） |
| GET | `/v2/payment_flows/:id/refunds` | 紐づく返金一覧 |

### PaymentMethod（支払い手段）

| メソッド | パス | 意味 |
|----------|------|------|
| POST | `/v2/payment_methods` | 作成（card / paypay / apple_pay） |
| GET | `/v2/payment_methods` / `/v2/payment_methods/:id` | 一覧 / 取得 |
| POST | `/v2/payment_methods/:id` | 更新 |
| GET | `/v2/payment_methods/cards/:card_id` | **v1のCard IDから対応するPaymentMethodを取得**（移行用） |
| POST | `/v2/payment_methods/:id/attach` / `:id/detach` | 顧客への紐付け / 解除 |

### Customer（顧客）

| メソッド | パス | 意味 |
|----------|------|------|
| POST / GET | `/v2/customers` | 作成 / 一覧 |
| GET / POST / DELETE | `/v2/customers/:id` | 取得 / 更新 / 削除 |
| GET | `/v2/customers/:id/payment_methods` | 顧客の支払い手段一覧 |

### SetupFlow（カード等の保存・有効性確認）

| メソッド | パス | 意味 |
|----------|------|------|
| POST / GET | `/v2/setup_flows` | 作成 / 一覧 |
| GET / POST | `/v2/setup_flows/:id` | 取得 / 更新 |
| POST | `/v2/setup_flows/:id/cancel` | キャンセル |

### Checkout Session（ホスト型決済ページ）

| メソッド | パス | 意味 |
|----------|------|------|
| POST / GET | `/v2/checkout/sessions` | 作成 / 一覧 |
| GET / POST | `/v2/checkout/sessions/:id` | 取得 / 更新 |
| GET | `/v2/checkout/sessions/:id/line_items` | 明細一覧 |

mode: `payment`（決済）/ `setup`（カード登録）。

### Product / Price / TaxRate（商品・価格・税率）

| メソッド | パス | 意味 |
|----------|------|------|
| POST / GET | `/v2/products`、`/v2/prices`、`/v2/tax_rates` | 作成 / 一覧 |
| GET / POST | `/v2/products/:id` 等 | 取得 / 更新 |
| DELETE | `/v2/products/:id` | 削除（Productのみ） |

### PaymentRefund（返金）/ PaymentDispute（チャージバック）

| メソッド | パス | 意味 |
|----------|------|------|
| POST / GET | `/v2/payment_refunds` | 返金作成 / 一覧（reason: duplicate / fraudulent / requested_by_customer） |
| GET / POST | `/v2/payment_refunds/:id` | 取得 / 更新 |
| GET | `/v2/payment_disputes` / `:id` | チャージバック一覧 / 取得 |

### 入金・会計系（v1の Transfer/Statement/Balance/Term に相当）

| メソッド | パス | 意味 |
|----------|------|------|
| GET | `/v2/payment_transactions` / `:id` | 決済トランザクション一覧 / 取得 |
| GET | `/v2/statements` / `:id` + POST `:id/statement_urls` | 取引明細 |
| GET | `/v2/balances` / `:id` + POST `:id/balance_urls` | 残高 |
| GET | `/v2/terms` / `:id` | 集計区間 |

### その他

| メソッド | パス | 意味 |
|----------|------|------|
| GET | `/v2/events` / `:id` | イベント（Webhook払い出し元） |
| GET / POST | `/v2/payment_method_configurations` 系 | 決済手段の表示設定（card/paypay/apple_payの有効化管理） |

---

## 5. RINCLEにとっての意味（2026-06時点）

1. **v2移行 = 実質書き直し**: PaymentFlow中心の概念体系はv1のChargeとは別物（むしろStripeとほぼ同型）。「Pay.jpに残れば実装を流用できる」はv1に留まる場合のみ成立
2. **集約モデルとの相性**: 単一アカウントの都度決済・オーソリ（manual capture）・返金はv2で素直に作れる。ただし**店舗月額課金（サブスク）は未提供（2026年中予定）**、**Platform API（テナント型）は2027年予定** — 今のRINCLEのテナント型はv2に移行先がない
3. **3DS**: v2は全カード3DS必須が前提の設計。義務化対応はv2に乗れば構造的に解決する（v1では自前実装）
4. **オーソリ期間**: v2は最大30日（v1の60日から短縮）。Stripeの日本特例30日と同条件
5. **PayPay対応はv2限定**: 将来PayPayを足したくなったらv2（またはStripe等の他社）が前提

---

## 6. 参考リンク

- [PAY.JP API v2 リファレンス](https://docs.pay.jp/v2/api)（公開OpenAPI: `https://docs.pay.jp/v2/openapi.json`）
- [v2ガイド: 支払いを構築する](https://docs.pay.jp/v2/guide/payments)
- [v1からの移行ガイド](https://docs.pay.jp/v2/guide/v2-migration)
- [v2提供開始のお知らせ（2026-02-12・PayPay対応）](https://pay.jp/info/2026-02-12-123000)
- [仮売上（オーソリ）と支払い確定（v2）](https://docs.pay.jp/v2/guide/status-management/auth-capture)
- 関連: [payjp-api-v1-summary-ja.md](./payjp-api-v1-summary-ja.md)（v1） / [payjp-vs-stripe-comparison.md](../stripe/payjp-vs-stripe-comparison.md)（#20比較）
