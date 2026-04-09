'use client'

import { useMemo } from 'react'
import { marked } from 'marked'

const MD = `# Pay.JP 決済連携仕様書

## サマリ

- Rincleの決済は **Pay.JP** という外部の決済サービスを使っている
- お金の流れ: **お客さん → Pay.JP → 店舗**（Rincleは間に入って手数料10%をもらう）
- 店舗がカード決済を受けるには、Pay.JPの **審査に合格する必要がある**（Rincle側に承認機能はない）
- お客さんはカードを1回登録すれば、以降の予約でそのまま使える

---

## 概要

Rincleは「お客さんが店舗に予約してカードで払う」ための仕組みを、**Pay.JP** という決済サービスを使って実現しています。

登場人物は3者です:

| 登場人物 | 役割 | 例えるなら... |
|---|---|---|
| **Rincle** | 全体を取りまとめる（プラットフォーム） | ショッピングモールの運営会社 |
| **店舗** | サービスを提供してお金を受け取る | モール内のお店 |
| **お客さん** | 予約してお金を支払う | お店のお客さん |

Pay.JPは「ショッピングモールのレジシステム」のような存在で、カード決済の処理やお金の分配を代行してくれます。

---

## 決済フロー

> このセクションでは、Pay.JP決済に関わる全フローを「誰が・何をするか」の視点で説明します。

### 1. 店舗の登録〜審査フロー

店舗がRincleで決済を受け取れるようになるまでの流れです。

\`\`\`
【誰が何をする？】

① 店舗オーナー: Rincleで店舗アカウントを登録する
      ↓
② Rincle（自動）: Pay.JPに「この店舗の決済口座を作ってください」と依頼する
   このとき以下の情報を送る:
     - 店舗名
     - 銀行口座情報（振込先）
     - 手数料率: 10%（Rincleの取り分）
     - 最低振込金額: 1,000円
      ↓
③ Rincle（自動）: Pay.JPに「この店舗の審査ページを作ってください」と依頼する
      ↓
④ Rincle: 店舗オーナーにメールで審査用URLを送る
      ↓
⑤ 店舗オーナー: メールのリンクからPay.JPの審査ページを開き、
   本人確認書類（免許証など）をアップロードする
   ※ この画面はPay.JPが用意したもので、Rincleの画面ではない
      ↓
⑥ Pay.JP（自動）: 提出された書類を審査する（数日かかる場合あり）
      ↓
⑦ Pay.JP（自動）: 審査が終わったら、Rincleに「結果出たよ」と自動通知する
      ↓
⑧ Rincle（自動）: 通知を受け取って、店舗の審査状態を更新する
   - 合格 → 決済受付OK
   - 不合格 → 決済受付NG
\`\`\`

**ポイント:**
- **審査はPay.JPが行う。** Rincleの管理画面に「承認ボタン」はない
- Rincleは審査結果を自動で受け取るだけ
- 審査に通るまで、その店舗ではクレジットカード決済ができない

**審査状態の一覧:**

| 状態 | 意味 | いつこの状態になる？ | カード決済 |
|---|---|---|---|
| 審査前 | まだ書類を出していない | 店舗登録直後 | 不可 |
| 審査中 | Pay.JPが確認している最中 | 書類提出後 | 不可 |
| 審査通過 | 問題なしと判断された | Pay.JPが承認した時 | **可能** |
| 審査否認 | 不備や問題があると判断された | Pay.JPが否認した時 | 不可 |

---

### 2. お客さんのカード登録フロー

お客さん（予約する人）がクレジットカードを登録する流れです。

\`\`\`
【誰が何をする？】

① お客さん: Rincleのマイページを開く
      ↓
② Rincle（自動）: そのお客さんが既にカード登録済みか確認する
   - 登録済み → 登録済みのカード情報を表示
   - 未登録 → カード登録ボタンを表示
      ↓
③ お客さん: 「新しいカードを登録する」ボタンを押す
      ↓
④ Pay.JP（自動）: カード入力フォームを表示する
   ※ カード番号はRincleのサーバーを通らない（セキュリティのため）
      ↓
⑤ お客さん: カード番号・有効期限・セキュリティコードを入力する
      ↓
⑥ Pay.JP（自動）: カード情報を受け取り、「トークン」（使い捨ての引換券）を発行する
      ↓
⑦ Rincle（自動）: トークンを使ってカードを登録する
   - 初めてのお客さん → まず顧客アカウントを作成してからカード登録
   - 既存のお客さん → カードを追加登録
      ↓
⑧ Rincle（自動）: 登録したカードを「メインカード」に設定する
\`\`\`

**ポイント:**
- カード番号はRincleには保存されない（Pay.JPが安全に管理する）
- お客さんは複数のカードを登録でき、メインカードを選べる

---

### 3. 予約時の決済フロー

お客さんが予約したときに、クレジットカードで支払いが行われる流れです。

\`\`\`
【誰が何をする？】

① お客さん: Rincleで予約を確定する（支払方法: クレジットカード）
      ↓
② Rincle（自動）: Pay.JPに「このお客さんのカードから○○円を引き落としてください」と依頼する
   このとき以下の情報を送る:
     - 誰のカード？ → お客さん
     - いくら？ → 合計金額
     - どの店舗に払う？ → 予約先の店舗
     - Rincleの手数料は？ → 合計金額 × 10%
      ↓
③ Pay.JP（自動）: カードから引き落としを実行する
      ↓
④ Pay.JP（自動）: 決済完了をRincleに自動通知する
      ↓
⑤ Rincle（自動）: 決済情報を予約データに保存する
\`\`\`

**お金の流れ:**
\`\`\`
例: 予約金額 10,000円 の場合

  お客さんのカード → 10,000円 引き落とし
       ↓
  Pay.JP が一時預かり
       ↓  振込時に分配:
  ├── 店舗へ: 9,000円（10,000円 − 手数料10%）
  └── Rincleへ: 1,000円（手数料10%）
  ※ 別途 Pay.JP自体の手数料がかかる（上記とは別計算）
\`\`\`

---

### 4. 延長料金の決済フロー

ライド（利用）が予定より長くなった場合、追加料金が発生する流れです。

\`\`\`
【誰が何をする？】

① 店舗スタッフ: ライドの利用時間を確定する（延長あり）
      ↓
② Rincle（自動）: 延長料金を計算する
      ↓
③ Rincle（自動）: Pay.JPに「追加で○○円を引き落としてください」と依頼する
   ※ 予約時と同じ仕組み
      ↓
④ Pay.JP（自動）: カードから追加引き落としを実行する
      ↓
⑤ Rincle（自動）: 延長用の決済情報を予約データに保存する
\`\`\`

**ポイント:**
- 延長料金は、最初の予約決済とは**別の決済**として処理される
- 返金するときも、それぞれ個別に返金する必要がある

---

### 5. 返金フロー

予約がキャンセルされたなどの理由で、お客さんに返金する流れです。

\`\`\`
【誰が何をする？】

① Rincle管理者: 管理画面から返金を実行する
      ↓
② Rincle（自動）: Pay.JPに「この決済を返金してください」と依頼する
      ↓
③ Pay.JP（自動）: お客さんのカードに返金処理を行う
      ↓
④ Rincle（自動）: もし延長料金の決済もあれば、そちらも返金する
\`\`\`

**ポイント:**
- 返金は管理画面からの手動操作（お客さん側からは返金できない）
- 延長料金がある場合は、通常分と延長分の**2回返金**が必要
- 返金されると、店舗への振込額からもその分が差し引かれる

---

### フロー全体のまとめ

\`\`\`
【店舗側の準備】
  店舗登録 → Pay.JP審査（数日）→ 審査通過 → 決済受付OK！

【お客さん側の準備】
  カード登録（1回だけ）→ 以降はそのカードで決済OK！

【予約〜決済】
  予約確定 → カード引き落とし → 完了

【延長が発生したら】
  延長料金を追加で引き落とし

【キャンセル・返金】
  管理者が返金実行 → カードに返金（通常分 + 延長分）
\`\`\`

---
---

# 以下、開発者向けの技術リファレンス

> ここから先は開発に必要な技術情報です。決済の仕組みを理解するだけであれば、上記のフロー説明で十分です。

---

## API一覧

Pay.JP API Base URL: \`https://api.pay.jp/v1\`
認証方式: Basic認証（Secret Keyをusernameに使用）

### テナント（店舗）管理

| API名 | メソッド | エンドポイント | 用途 |
|---|---|---|---|
| Create Tenant | POST | \`/tenants\` | 店舗アカウント作成時にテナントを作成 |
| Create Tenant Approval Link | POST | \`/tenants/{tenant_id}/application_urls\` | 店舗の本人確認・審査用URLを生成 |
| Delete Tenant | DELETE | \`/tenants/{tenant_id}\` | テナント削除（管理画面から） |

### 顧客（エンドユーザー）管理

| API名 | メソッド | エンドポイント | 用途 |
|---|---|---|---|
| Create Client (account_create) | POST | \`/customers\` | 顧客オブジェクト作成 |
| Get Client | GET | \`/customers/{id}\` | 顧客情報取得（カード情報含む） |
| Register Card (account_register_card) | POST | \`/customers/{customer_id}/cards\` | カードトークンを顧客に紐付け |
| Register Default Card | POST | \`/customers/{customer_id}\` | デフォルトカードの設定（default_cardパラメータで指定） |

### トークン・決済

| API名 | メソッド | エンドポイント | 用途 |
|---|---|---|---|
| Create Token | POST | \`/tokens\` | カード情報からトークン生成 |
| Charge | POST | \`/charges\` | トークンで決済（初回用） |
| Charge by Card ID | POST | \`/charges\` | 登録済みカードで決済 |
| Charge Refund | POST | \`/charges/{id}/refund\` | 返金処理 |

API計11本（テナント管理3本 + 顧客管理4本 + トークン・決済4本）

---

## Webhook

| イベント | エンドポイント名 | トリガー条件 | 処理内容 |
|---|---|---|---|
| \`charge.captured\` | payjp_webhook_charge_captured | \`body.type == "charge.captured"\` | Webhook_Eventレコード作成（type: charge.captured） |
| \`tenant.updated\` | payjp_webhook_update_tenant | \`body.type == "tenant.updated"\` | Webhook_Eventレコード作成 + ユーザーのreviewed_brand更新（passed / in_review / declined / before_review） |

---

## フロントエンド実装（Checkout.js）

- \`https://checkout.pay.jp/\` をscriptタグで読み込み
- \`data-partial = "true"\`（トークン取得のみ、決済は行わない）
- \`data-submit-text = "新しいカードを登録する"\`
- トークン取得成功時: \`bubble_fn_tokenget(response.id)\` でBubbleのJavascriptToBubble要素にトークンを渡す

---

## データモデル（Pay.JP関連フィールド）

### User

| フィールド | 型 | 用途 |
|---|---|---|
| cus_id | text | Pay.JP顧客ID（\`cus_xxxxx\`） |
| tenant_id | text | Pay.JPテナントID（\`ten_xxxxx\`） |
| reviewed_brand | option (brand_status) | 審査状態（before_review / in_review / passed / declined） |
| user_id_payjp | text | Pay.JPユーザーID |
| pay_jp_apply_form_url | text | 審査申請フォームURL |

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

## プラットフォーム手数料

- デフォルト手数料率: **10%**（option_set \`platform_fee\` → \`デフォルト\` = 10）
- 計算式: \`platform_fee = amount × platform_fee_rate / 100\`
- \`payjp_fee_included: false\` → Pay.JP手数料はプラットフォーム手数料に含まない

---

## キー管理

| 用途 | Option Set値 |
|---|---|
| 本番公開鍵 | \`option.pay_jp_key.live\`（Checkout.jsで使用） |
| テスト公開鍵 | \`option.pay_jp_key.test_pk\` |
| テスト秘密鍵 | \`option.pay_jp_key.test_sk\` |
| 本番秘密鍵 | API Connector の Basic認証で設定 |
`

const CSS = `
  .md-body { max-width: 820px; margin: 0 auto; padding: 32px 24px 80px; color: #c0c0cc; font-size: 14px; line-height: 1.8; }
  .md-body h1 { font-size: 22px; font-weight: 800; color: #d0d0d8; border-bottom: 1px solid #2e2e38; padding-bottom: 10px; margin: 0 0 20px; }
  .md-body h2 { font-size: 17px; font-weight: 700; color: #90b8f0; margin: 36px 0 12px; padding-bottom: 6px; border-bottom: 1px solid #2a2a34; }
  .md-body h3 { font-size: 15px; font-weight: 700; color: #c0c0cc; margin: 28px 0 10px; }
  .md-body p { margin: 8px 0; }
  .md-body strong { color: #e0e0e8; }
  .md-body hr { border: none; border-top: 1px solid #2e2e38; margin: 24px 0; }
  .md-body ul, .md-body ol { padding-left: 22px; margin: 6px 0; }
  .md-body li { margin: 3px 0; }
  .md-body blockquote { border-left: 3px solid #4a8ad8; padding: 8px 16px; margin: 12px 0; background: rgba(74,138,216,.08); border-radius: 0 6px 6px 0; color: #a0a0b0; }
  .md-body code { background: #2a2a34; padding: 1px 6px; border-radius: 4px; font-size: 13px; color: #e8a0d0; }
  .md-body pre { background: #1e1e28; border: 1px solid #2e2e38; border-radius: 8px; padding: 16px; overflow-x: auto; margin: 12px 0; }
  .md-body pre code { background: none; padding: 0; color: #a8a8b8; font-size: 13px; white-space: pre; }
  .md-body table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 13px; }
  .md-body th { background: #22222c; padding: 8px 12px; text-align: left; font-weight: 600; color: #888898; border-bottom: 1px solid #2e2e38; }
  .md-body td { padding: 7px 12px; border-bottom: 1px solid #2a2a34; }
  .md-body tr:hover td { background: rgba(74,138,216,.04); }
`

export default function PayjpFlowTab() {
  const html = useMemo(() => marked.parse(MD) as string, [])

  return (
    <div style={{ height: '100%', overflow: 'auto', background: '#1a1a22' }}>
      <style>{CSS}</style>
      <div className="md-body" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}
