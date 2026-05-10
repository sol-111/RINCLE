# 自転車検索〜予約完了〜当日レンタル〜延長・返却・キャンセル／返金までのレコード（As-Is）

本稿は **現行 Bubble アプリ（As-Is）** において、利用者が自転車を検索してから、延長料・返却の決済、または **キャンセル・管理者返金**に至るまでに **データベース上で想定される Thing の作成・更新** を整理したものです。

根拠:

- Pay.JP 連携の行為順: [`documents/2_requirements/04_integration/pay.jp/payjp-flow-asis.md`](../../04_integration/pay.jp/payjp-flow-asis.md)
- **Bubble エクスポート JSON に基づくワークフロー ID・主アクション列**: [reservation_workflows_from_bubble.md](reservation_workflows_from_bubble.md)（[`documents/2_requirements/99_app_json/rincle.bubble`](../../99_app_json/rincle.bubble)）
- 画面遷移の大枠: [`documents/2_requirements/02_flow/screenflow.json`](../../02_flow/screenflow.json)（TOP → 空車検索 → 一覧 → 店舗詳細 → 自転車詳細 → 予約内容 → 決済 → 予約一覧）
- Thing 名・関係: [`documents/2_requirements/05_db/_index.csv`](../_index.csv) と `datatype/*.csv`

---

## 1. シーケンスの概要（フェーズ別）

メインの貸出ライフサイクルは **A〜E**（§2 表のとおり）。**予約情報**の更新はそれにとどまらず、**利用者キャンセル・店舗操作・管理者の返金／課金**でも発生するため、**F〜H** として併記します。ワークフロー ID と画面対応は [reservation_workflows_from_bubble.md](reservation_workflows_from_bubble.md) §3。

以下はシーケンスを **フェーズごとに箇条書き**したものです。末尾に **一枚の Mermaid**（A〜H）を併記します。

### A. 検索〜詳細

- **利用者 → Bubble** — 空車検索、一覧、店舗／自転車の閲覧
- **Bubble → 利用者** — `Bicycle`・`User`・`Price_Menu` 等の参照データ
- **Bubble 内** — 予約系 Thing の新規作成は基本なし（**Access_log** は実装次第で作成され得る）

### B. カート〜予約確定

根拠（index の WF 例）: カート `bTOUO`、予約確定 `bTTbx`。別導線としてカード登録 `bTYRv`、ログイン＋予約 `bTOxR` あり。詳細は [reservation_workflows_from_bubble.md](reservation_workflows_from_bubble.md)。

**カート（「予約画面へ進む」に相当するワークフロー）— Thing の作成に続く処理**

- **乗車人情報** — 作成（空のレコード。後続ステップで明細から参照）
- **自転車予約詳細** — 作成  
  - 乗車人情報を紐付け  
  - 選択中の自転車（Bicycle）  
  - 選択された **オプション予約詳細** のリスト（オプション行が先に存在するか、同じワークフロー内で作られる）
- **自転車予約詳細** — 反復する **ChangeThing / ChangeListOfThings**（複数ステップ）で、明細・オプション行・リスト参照の整合や金額の確定を取る（エクスポート上は名称マスクが多い）
- **オプション予約詳細** — 作成（および必要なら更新）  
  - 貸出日の日数に応じて料金を登録
- **予約情報** — 作成（カートに予約が無い場合の分岐に応じて **NewThing** が走る構成あり）  
  - 貸出期間  
  - 自転車予約詳細との紐付け（一覧カスタムフィールド等）  
  - **ステータス＝仮情報**（確定前のカート／下書きに相当）  
  - 店舗  
- **ログイン時** — **MakeChangeCurrentUser** でカート紐付け、**ChangeThing** で `User` の **cart** に **予約情報** を載せる／明細側に **予約情報** を逆参照で紐付け（「カートに予約情報紐づけ」「予約情詳細に予約情報を紐づけ」等）
- **未ログイン時** — **SetCustomState** で予約コンテキストを保持する分岐（カート相当の状態管理）
- **合計金額** — **ChangeThing** で算出・反映（「合計値算出」）
- **UI** — **SetCustomState**（複数）で画面状態を更新
- **利用者への画面遷移** — **ChangePage** で予約内容・確認画面へ

**確定・決済準備（初回は本課金なし・token のみ）— 予約確定ボタン等のワークフロー**

- **入力検証・分岐** — **ShowElement** / **TerminateWorkflow** の組み合わせ（不備時に処理打切り・案内表示と推定。詳細は Editor）
- **Pay.JP 連携（API Connector）** — 連続で **2 系統**の `apiconnector2-bTHZi`（例: `bTVNI` / `bTVHy`）。顧客・決済手段まわりの事前処理（具体パラメータは payjp-flow-asis および Bubble の API 定義に依存）
- **Current User** — **MakeChangeCurrentUser**（カード登録情報やユーザー属性の反映等と推定）
- **予約情報** — **ChangeThing**（確定内容・ステータス、決済準備に必要なフィールド）
- **営業カレンダー（日付）** — **ChangeListOfThings**（自転車リストの **remove_list** 等で枠の確保。同一 WF 内の **PreviousStep** 参照とリンク）
- **通知** — **SendEmail** が **複数本**（利用者・店舗・運営等。宛先・文面は Editor 上のテンプレ）
- **UI** — **SetCustomState**・**ShowElement**（完了案内・エラー表示の切替）
- **（補足）** payjp-flow-asis に沿い、このタイミングでは **本課金（当日ライドの Charge）は行わない**。カード登録／トークン取得と **予約情報** への保存が中心。
- **（別導線・フェーズ B にまたがることあり）**  
  - **カード登録中心**の WF（`bTYRv`）: **MakeChangeCurrentUser** → API Connector → **PauseWFClient** → **CopyListOfThings** → **予約情報** の **NewThing** → **ChangeListOfThings** / **ChangeThing** → **SendEmail** → **ChangePage** 等  
  - **ログイン誘導＋予約**（`bTOxR`）: **LogIn** / **LogOut**、**PauseWFClient**、**予約情報** の **NewThing**、**ChangeListOfThings**、**ChangeThing**、**MakeChangeCurrentUser**、**ChangePage** 等

明細・オプション・乗車人の行そのものは主にカート段階で作成され、確定では **親の予約情報** と **営業カレンダー** を中心に更新されます。

**確定フローとトークン（シーケンス図レベルの要約）**

- **利用者 → Bubble** — 内容確認・予約確定操作
- **Bubble 内** — 上記の検証・API・**予約情報** 更新・**営業カレンダー** 更新
- **利用者 ⇄ Pay.JP** — カード登録またはトークン取得と結果の返却（別導線では WF が分かれる場合あり）
- **Bubble 内** — **予約情報** に token・支払い方法等を保存

### C. ライド開始（本決済）

- **店舗スタッフ → Bubble** — ライド開始操作（WF `bTTeN`）
- **Bubble → Pay.JP** — 合計金額の **Charge**
- **Pay.JP → Bubble** — 成功、**charge_id**
- **Bubble 内** — **予約情報** を更新（**charge_id**、請求済み等）
- **Bubble 内** — **管理者手数料** に紐付け得る

### D. 延長登録・延長の追加課金（店舗）

- **店舗スタッフ → Bubble** — 延長返却日・延長料金等を登録（`bTUAL` 等。明細・**営業カレンダー**も連動し得る）
- **Bubble 内** — **予約情報** の延長系フィールド・合計等を更新
- **（分岐）延長分を即時カード決済する操作** — WF `bTWcb0`: **Pay.JP `Charge_by_car_id`（`bTVIE`）** → 成否で **予約情報** を二段更新（成功／店頭決済フォールバック等）

### E. ライド終了

- **店舗スタッフ → Bubble** — 返却・ライド終了操作（`bTdud` 等の別導線あり）
- **分岐（延長分など追加徴収がある場合）**  
  - **Bubble → Pay.JP** — 延長分の **Charge**  
  - **Pay.JP → Bubble** — 成功  
  - **Bubble 内** — **予約情報** を更新（**延長 charge_id** 等）
- **分岐（追加徴収がない場合）**  
  - **Bubble 内** — **予約情報** を更新（ステータス、返却完了等）

### F. 利用者キャンセル（マイページ・予約一覧）

- **利用者 → Bubble** — 予約一覧からキャンセル操作（`user_reservation_list` / WF `bTSmh`）
- **Bubble 内** — **予約情報** を **ChangeThing**（ステータス等）
- **Bubble 内** — **営業カレンダー（日付）** を **ChangeListOfThings**（枠の戻し・`add_list` 等。利用者キャンセルと同型）
- **Bubble → 利用者／店舗／運営** — **SendEmail** 複数（確認・通知）
- **Bubble 内** — 画面遷移（`HideElement` / `ShowElement` / `ChangePage`）

### G. 店舗によるキャンセル等（加盟店・予約一覧／詳細）

- **店舗スタッフ → Bubble** — 予約に対するキャンセル等ボタン（WF **`bTVKs`** / **`bTVLV`**。利用者キャンセルと同様に **予約情報 + 営業カレンダー** を更新する構成）
- **Bubble 内** — **ChangeThing**（予約情報）→ **ChangeListOfThings** ×2 → **AlertShowMessage** → **HideElement**

### H. 管理者の返金・ドロップダウン課金（本部 admin・予約一覧）

- **管理者 → Bubble** — 予約一覧で **Dropdown により「キャンセル」等** → 返金用ポップアップ（[`payjp-flow-asis.md`](../../04_integration/pay.jp/payjp-flow-asis.md) の返金ストーリー）。WF **`bTXOb0`**
- **分岐（返金あり）** — **Bubble → Pay.JP** — **`Charge_refund`**（本体・延長の **2 回**あり得る）
- **Bubble 内** — **予約情報** に返金 ID・ステータス、**営業カレンダー** を **ChangeListOfThings** で更新
- **（別操作）ドロップダウンで来客待ち・未請求への課金** — WF **`bTXdC0`**（`InputChanged`）: **Charge_by_car_id** → **予約情報** 更新
- **（ステータス変更のみ返金 API なし）** — WF **`bTXOH0`** が近い役割の可能性（Editor 突合）

### 全体シーケンス図（Mermaid・A〜H）

```mermaid
sequenceDiagram
    participant U as 利用者
    participant R as Rincle_Bubble
    participant P as PayJP
    participant S as 店舗スタッフ
    participant M as 管理者

    Note over U,R: A. 検索〜詳細（閲覧）
    U->>R: 空車検索・一覧・店舗/自転車閲覧
    R-->>U: Bicycle User Price_Menu 等（参照）
    Note over R: 予約系 Thing の新規作成は基本なし Access_log は実装次第

    Note over U,R: B. カート〜予約確定（初回は本課金なし・token のみ）
    Note over R: カート: 連鎖する Change 明細確定 cart 紐付け 合計算出 ChangePage
    U->>R: 予約画面へ進む（カート）
    R->>R: create 乗車人情報
    R->>R: create 自転車予約詳細
    opt オプションあり
        R->>R: create オプション予約詳細
    end
    R->>R: create 予約情報 仮情報
    R->>R: update User.cart
    Note over R: 確定: APIx2 MakeChangeCurrentUser 予約情報 営業カレンダー SendEmail x3
    U->>R: 内容確認・予約確定
    R->>R: update 予約情報
    R->>R: update 営業カレンダー 日付（自転車のリスト操作で確保）
    U->>P: カード登録またはトークン取得
    P-->>R: token 等
    R->>R: update 予約情報 token 支払い方法
    Note over R,P: payjp-flow-asis この時点では本課金なし

    Note over S,R,P: C. ライド開始（本決済）
    S->>R: ライド開始
    R->>P: Charge（合計金額）
    P-->>R: 成功 charge_id
    R->>R: update 予約情報 charge_id 請求済み等
    Note over R: 管理者手数料 へ紐付け得る

    Note over S,R,P: D. 延長登録と延長の追加課金
    S->>R: 延長返却日・延長料金等を登録
    R->>R: update 予約情報 延長系フィールド 合計等
    opt 延長分の即時カード決済 bTWcb0
        R->>P: Charge_by_car_id（延長分）
        P-->>R: 成功 or 失敗
        R->>R: update 予約情報 charge 結果反映
    end

    Note over S,R,P: E. ライド終了
    S->>R: 返却・ライド終了操作
    alt 延長分など追加徴収あり
        R->>P: Charge（延長分）
        P-->>R: 成功
        R->>R: update 予約情報 延長charge_id 等
    else 追加徴収なし
        R->>R: update 予約情報 ステータス・返却完了等
    end

    Note over U,R: F. 利用者キャンセル
    U->>R: キャンセル（予約一覧 bTSmh）
    R->>R: update 予約情報
    R->>R: ChangeListOfThings 営業カレンダー
    R-->>U: SendEmail 等

    Note over S,R: G. 店舗キャンセル等
    S->>R: キャンセル等（bTVKs bTVLV）
    R->>R: update 予約情報
    R->>R: ChangeListOfThings 営業カレンダー

    Note over M,R,P: H. 管理者 返金・課金
    M->>R: 予約一覧 キャンセル 返金ポップアップ（bTXOb0）
    opt 返金あり
        R->>P: Charge_refund 本体
        R->>P: Charge_refund 延長（存在時）
        P-->>R: OK
        R->>R: update 予約情報 返金ID 等
        R->>R: ChangeListOfThings 営業カレンダー
    end
    opt ドロップダウン課金 bTXdC0
        M->>R: 来客待ち未請求 等で課金
        R->>P: Charge_by_car_id
        R->>R: update 予約情報
    end
```

図は **可能な相互作用を一枚に配置**したもので、**F〜H は貸出完了前に発生し得る**など、実際の順序はケースによって異なります。

---

## 2. フェーズ別: Thing の作成 / 更新（一覧）

`_index.csv` の **datatype 名（日本語）** と対応します。

### メインライフサイクル（A〜E）

| フェーズ | 主な操作 | 予約情報 | 自転車予約詳細 | オプション予約詳細 | 乗車人情報 | 営業カレンダー（日付） | User | Access_log | 管理者手数料 | Pay.JP 連携 |
|----------|----------|----------|----------------|---------------------|------------|------------------------|------|------------|--------------|-------------|
| A. 検索〜詳細 | 閲覧 | — | — | — | — | 読取のみ | 読取 | 作成の可能性 | — | — |
| B. カート〜予約確定 | 確定まで | **作成＋更新** | **作成**（台数分） | **作成**（該当時） | **作成**（該当時） | **更新**（確保） | **更新**（cart） | 可能性 | 参照先作成の可能性 | token 保存、**課金なし** |
| C. ライド開始 | 店舗操作 | **更新**（charge_id 等） | 読取/表示 | — | — | 読取 | — | — | 紐付け更新の可能性 | **本課金** |
| D. 延長登録・延長課金 | 店舗入力／即時決済 | **更新**（延長フィールド・合計等） | — | — | — | **更新**（延長登録系あり得る） | — | — | — | **延長即時課金時 Charge** |
| E. ライド終了 | 店舗操作 | **更新**（延長課金フィールド・ステータス） | — | — | — | — | — | — | — | 延長あり時 **別 Charge** |

### キャンセル・返金・運営（F〜H）

| フェーズ | 主な操作 | 予約情報 | 営業カレンダー（日付） | Pay.JP 連携 |
|----------|----------|----------|------------------------|-------------|
| F. 利用者キャンセル | マイページ／予約一覧 | **更新** | **ChangeListOfThings** | — |
| G. 店舗キャンセル等 | 加盟店・予約一覧／詳細 | **更新** | **ChangeListOfThings** | — |
| H. 管理者 | admin 予約一覧（返金・ドロップダウン課金） | **更新**（返金 ID・ステータス等） | **更新**（返金時） | **Charge_refund**／**Charge** |

詳細な WF ID は [reservation_workflows_from_bubble.md](reservation_workflows_from_bubble.md) §3。

### フィールド観点（予約情報）

`datatype/18_予約情報.csv` より、途中で埋まっていく主な列:

- **予約確定〜来店前**: `店舗` `貸出日` `返却日` `ステータス` `予約明細リスト` `token` `支払い方法` `合計金額` `前日貸し出し` 等
- **ライド開始後**: `charge_id` `請求済み` など
- **延長〜終了**: `延長料金` `延長返却日` `延長charge_id` 等

---

## 3. 補足（管理者・Webhook）

- **管理者** が予約ステータスを変更して **ライド開始相当の課金** が走る経路は payjp-flow-asis 「3.6. 管理者による決済フロー」に記載あり。作成される Thing は上表と同様で **予約情報の更新** が中心。
- **Webhook_Event** は Pay.JP 等からの通知を保存する datatype。通知連携が有効なら **イベント受信ごとに作成**され得る（必須ではない）。

---

## 4. 参照・改訂

| 種別 | パス |
|------|------|
| 本シーケンス | 本ファイル |
| 決済フロー詳細 | `documents/2_requirements/04_integration/pay.jp/payjp-flow-asis.md` |
| DB 再設計案（To-Be） | `documents/2_requirements/05_db/rincle_db_analysis_and_redesign.md` |

To-Be で `Product` / `Reservation_Line` 等に置き換わる場合は、**同じ利用ストーリーでも Thing 名・作成タイミングが変わる**ため、本稿は As-Is のみを対象とする。
