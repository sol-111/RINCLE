# メールURL確認（リリース前タスク#12）検証結果

- 検証日: 2026-07-12
- 対象（新）: `documents/rincle.bubble`（新構築のBubbleエクスポート、7/12時点）
- 対象（旧）: `.context/rincle.bubble`（現行本番のエクスポート、2026-03-23時点）
- 比較元: `documents/2_requirements/03_email/emails.csv`（メール仕様一覧・全19通）
- 方法:
  - 新旧エクスポートJSONから SendEmail / SendPasswordResetEmail / SendConfirmationEmail を**全ツリー走査で全数抽出**（新34件・旧21件、ChangeEmailForAnotherUser 新8件・旧4件）し、件名・本文・宛先・リンクをレンダリングして三者突合（仕様CSV ↔ 旧実装 ↔ 新実装）
  - 本文中のURL（ベタ書き・動的参照）を全数チェックし、新URL設計のページ実在と照合
  - 疑わしいURLは**現行本番に対して実アクセス・DNS解決を実測**（7/12実施）
- 本番ドメイン: `rincle.co.jp`（新旧とも app_topdomain。redirect_all_to_domain=有効）

## 本書の呼び名: 予約確定メールの3系統

予約確定時の3通セット（ユーザー向け・店舗向け・管理者向け）は、新構築内にほぼ同じ内容で3か所に重複実装されている。本書では以下の呼び名で区別する。

| 呼び名 | 実装場所 | 実体 |
|---|---|---|
| cart版 | reusable element `cart`（bUplD0） | **`reservation` ページ（予約ページ）に設置されている**（7/12調査で設置箇所を特定。本線はこれの可能性が高い） |
| mypage版 | `mypage` ページ（bUEiH0）内のワークフロー | ページに直書き。**内容は旧実装（旧indexページ）のほぼそのままコピー** |
| legal版 | `legal` ページ（bUPpl0）内のワークフロー | ページに直書き（mypage版の丸コピー） |

`cart` 部品の設置箇所はエクスポートJSON全体を検索して `reservation` ページの1か所のみだった。**予約フローの本線で動くのはcart版で、mypage版・legal版は旧実装からの移植途中のコピーの残骸である可能性が高い**（cart版だけが新DB構造・新ページ名を参照しており、mypage版・legal版は旧DB構造のフィールド参照と旧ページ名 `shop_admin` を引きずっている）。ただしカスタムイベント経由の呼び出しまでは追い切れていないため、削除判断はBubbleエディタ上で要確認。

## 結論サマリ

1. **仕様一覧19通のうち16通は新構築に実装あり。未実装3通（決済失敗通知×2、退会完了）は旧実装にも存在しない**（仕様上「協議中」のまま新旧とも未実装）。**旧→新のメール機能のデグレはなし**
2. **タスク#12の「アウト事項」（URLベタ書き）は複数あるが、大半は旧実装からの持ち越し**。リリースで新たに壊れるもの（真のリグレッション）は限定的で、**最重要は「cart版の管理者向け予約通知の宛先誤り」と「`shop_admin` リンクのリリース後404化」の2点**
3. `https://rincle.jp`（フッター署名）は**DNS未設定で現時点でも名前解決不可**、`https://rincle.co.jp/reservations` は**現行本番でも404**を実測確認。つまりこの2つは今も壊れており、リリース可否には影響しないが、この機会に直すべき

---

## 1. 仕様一覧（emails.csv）との突合（旧No順）

| 旧No | メール | 宛先 | 新構築 | 実装場所 / 備考 |
|---|---|---|---|---|
| 1 | メールアドレス確認（6桁コード） | ユーザー | ✅ | mypage / legal ページ。旧実装と同内容。別途URL認証方式（api: send_conform_email + SendConfirmationEmail〈トークン生成のみ〉）が新規追加 |
| 2 | アカウント登録完了 | ユーザー | ✅ | mypage / legal（旧のコピー）+ api: create_user_info（新規・`signin` ページへ正しくリンク）。※旧コピー側のログインURL `index/signup` は旧から持ち越し（C-3） |
| 3 | パスワード再設定 | ユーザー | ✅ | api: send_reset_pass_mail に統合。組み込みアクションはURL生成のみ（`delivery_mode: generate_url`）→カスタムメール1通に `&role=` 付きURLを載せる構成。7/12実機テストで1通受信・リンク正常を確認。旧は index / admin_login / shop_admin_login の3ページで組み込みメールを直接送信していた（機能は維持） |
| 4 | 新メールアドレス確認（協議中） | ユーザー | ✅ | 旧実装と同じ6桁コード方式を踏襲（仕様の24h有効URL方式ではない）。※コード生成の弱さは旧から持ち越し（D-4） |
| 5 | 予約確定 | ユーザー | ✅ | cart版（新DB対応）+ mypage / legal版（旧コピー）。本文は旧実装と同文。※`/reservations` ベタ書きは旧から持ち越し（A-1） |
| 6 | 予約キャンセル | ユーザー | ✅ | api: cancel_reservation（旧は user_reservation_list ページ内）。本文は旧と同文（誤字「キャンセルされましました」も持ち越し） |
| 7 | 決済失敗通知（協議中） | ユーザー | ❌ 未実装 | **旧実装にも無し**（「決済失敗」の文言は新旧とも0件）。差異なし |
| 8 | お問い合わせ受付 | ユーザー | ✅ | contact（共通）+ shop_detail（店舗宛フォーム）。旧と同文 |
| 9 | 退会完了（協議中） | ユーザー | ❌ 未実装 | **旧実装にも無し**。差異なし |
| 10 | 加盟店申請案内 | 店舗 | ✅ | r_admin_shop_list（旧は admin ページ直書き）。URLは動的（Website Home + `shop_form`）でセーフ |
| 11 | 審査通過通知 | 店舗 | ⚠️ | api: payjp_webhook_update_talent。**ログインURLに新規の組み立て不備**（C-1）。旧は `{home}/shop_admin_login` で実在ページだった |
| 12 | 審査否決通知 | 店舗 | ✅ | 同上APIワークフロー。旧と同文 |
| 13 | 予約確定通知 | 店舗 | ⚠️ | cart版はOK（`admin_signin?role=shop&mode=sign_in` へ動的リンク）。**mypage / legal版は旧ページ名 `shop_admin` のまま → リリース後404**（A-2） |
| 14 | 予約キャンセル通知 | 店舗 | ⚠️ | api: cancel_reservation。**ログインURLのパスが旧より劣化**（旧: `{home}shop_admin_login`〈実在〉→ 新: `{home}` のみ）。specialized_kyoto ベタ書きは旧から持ち越し（D-3）。宛先は旧 `user.email` → 新 `shop.contact_mail_text` に変更（新DB対応） |
| 15 | お問い合わせ転送 | 店舗 | ✅ | shop_detail。旧と同文（データ参照が CurrentPageItem → URLパラメータに変更） |
| 16 | 予約確定通知 | 管理者 | ⚠️ | mypage / legal版は rincle@pedalstandard.com 宛で旧と同じ。**cart版のみ宛先がユーザー本人・件名も誤りに変わっている = 新規リグレッション**（D-1）。旧実装は正しかった |
| 17 | 予約キャンセル通知 | 管理者 | ⚠️ | api: cancel_reservation。宛名は旧の変な「{店舗名} ご担当者様」→「RINCLE運営チーム 各位」に改善。ただし**件名・本文冒頭に真偽値のデバッグ出力が新規混入**（D-5） |
| 18 | お問い合わせ通知 | 管理者 | ✅ | contact。旧と同文 |
| 19 | 決済失敗アラート（協議中） | 管理者 | ❌ 未実装 | **旧実装にも無し**。差異なし |

新構築で追加されたメール: URL方式のメール認証（api: send_conform_email）、API版アカウント登録完了（api: create_user_info）。
旧にあって新に無いメール: admin_login / shop_admin_login ページの独立したパスワードリセット（→ api: send_reset_pass_mail の `role` パラメータに統合。機能としては維持）。

---

## 2. タスク#12「アウト事項」= URLベタ書きの検出結果

**リリース判断の観点で「持ち越し（今も壊れている/今も同じ挙動）」と「新規リグレッション（リリースで壊れる）」を区別した。**

### A. ベタ書き＋パスが新URL設計に存在しない → リンク切れ

| # | 記載URL | 出現箇所 | 分類 | 問題 |
|---|---|---|---|---|
| A-1 | `https://rincle.co.jp/reservations` | 予約確定（ユーザー）cart版含む3箇所、キャンセル（ユーザー・店舗） | **持ち越し**（旧にも同記載。**現行本番で404を実測済み〈7/12〉**。正しくは `user_reservation_list`） | 「予約の確認・キャンセルはこちら」導線が旧から一貫して404。リリースブロッカーではないがこの機会に修正すべき。なお旧実装の店舗向けキャンセルは `https://rincle.jp/reservations`（ドメインごと死んでいる）で、新はドメインだけ直っている |
| A-2 | `Website Home` + `shop_admin` | 予約確定通知（店舗）mypage版・legal版 | **新規リグレッション**（`shop_admin` は旧アプリの実在ページ。**現行本番で200を実測済み**。新URL設計で廃止） | mypage / legal版が本線でなければ実害なし。cart版は `admin_signin?role=shop&mode=sign_in` へ正しく更新済みなので、残すならこれに揃える |

### B. ドメインのベタ書き・不一致

| # | 記載URL | 出現箇所 | 分類 | 問題 |
|---|---|---|---|---|
| B-1 | `https://rincle.jp` | フッター署名（予約確定・キャンセル・メール確認など計11通）＋ option set `admin_info.email_signature` | **持ち越し**（旧の同メールにも同記載）。ただし **`rincle.jp` はDNS未設定・名前解決不可を実測済み〈7/12〉= 完全な死リンク** | 本番ドメインは `rincle.co.jp`。option set分は登録完了（API版）とメール認証メールにも波及するため、option set の1箇所修正+ベタ書き11箇所の一括置換を推奨 |
| B-2 | `https://rincle.co.jp`（署名・本文のベタ書き） | 店舗向け予約確定・お問い合わせ転送・登録完了など8箇所 | **持ち越し** | 現ドメインと一致するので動くが、ドメイン変更に追従しない。優先度低。`Website home URL` 化を推奨 |

### C. URL組み立ての不備（動的だが壊れている・疑義あり）

| # | 内容 | 出現箇所 | 分類 |
|---|---|---|---|
| C-1 | `Website Home` + `/admin_signin? role=...` — `?` の直後に半角スペースがありクエリが壊れる（先頭 `/` 由来の二重スラッシュは旧からあったが、スペース混入は新規） | 審査通過通知（api: payjp_webhook_update_talent） | **新規** |
| C-2 | ログインURLが `Website Home` のみでパス無し。直後に改行無しで「■ログインID」が続く。旧は `{home}shop_admin_login`（実在ページ）へリンクしていたので劣化 | 予約キャンセル通知（店舗） | **新規（劣化）** |
| C-3 | `Website Home` + `index/signup` — signupというページは新旧とも無い（indexページが開くだけ）。API版登録完了は `signin?mode=sign_in` で正しく組めているので揃えるべき | アカウント登録完了 mypage / legal版×4箇所 | 持ち越し |

### 送信経路の網羅性確認（7/12追補）

メール送信がSendEmail系アクション以外の経路に存在しないことを確認した:

- **プラグイン**: 番号付きプラグインアクションの正体を全て確認（最多使用のものはToolboxの「Run javascript」＝日付・価格計算用）。メール送信系プラグインは新旧とも未導入
- **API Connector**: 全21コールを列挙 — Pay.JP（16）・郵便番号検索・祝日API・自アプリWF呼び出しのみ。SendGrid等の外部メールAPIコールは無し
- **送信基盤の差分（新規発見・要確認）**: **新アプリには独自SendGrid APIキーが設定されている（旧は未設定＝Bubble共有送信）**。つまりリリースでメール送信基盤自体が変わる。SendGrid側のSender Authentication（rincle.co.jpのSPF/DKIM）が未設定だと迷惑メール行き・送信失敗のリスク。7/12のテスト受信でOutlookが「信頼できる差出人でない」警告を出していたのはこの文脈で要チェック → **タスク#14のE2Eで到達性（迷惑メール判定含む）を必ず確認**

### セーフ確認済み

- `Website Home`（動的参照）+ 実在ページ名: `shop_form`（加盟店案内）、`admin_signin?role=shop&mode=sign_in`（cart版店舗通知）、`signin`（API版登録完了・メール認証）→ ページ名変更にも追従、問題なし
- Googleマップ `https://www.google.co.jp/maps/place/{店舗住所}` → 外部URLなのでOK
- パスワードリセットURLは自動生成（アプリドメインの `reset_pw` を指す）のためドメイン追従OK。7/12実機テストで受信・リンク先とも正常を確認
- 組み込みSendConfirmationEmailは `just_make_token=true` でトークン生成のみ（二重送信なし）

---

## 3. ついでに検知したバグ（URL以外）

| # | 内容 | 分類 | 深刻度 |
|---|---|---|---|
| D-1 | **cart版（=本線）の管理者向け新規予約通知が、宛先 `Current User's email`（=予約したユーザー本人）・件名「ご予約の確認」になっている**。ユーザーに「RINCLE運営チーム 各位」で始まる内部通知が届き、運営には届かない。旧実装・mypage / legal版は `rincle@pedalstandard.com` 宛で正しい | **新規リグレッション** | 高 |
| D-2 | ~~パスワードリセットが2通届く疑い~~ **→ 誤検知・訂正済み（7/12実機テストで1通のみ受信を確認）**。組み込みSendPasswordResetEmailは `delivery_mode: "generate_url"`（URL生成のみ・送信しない）設定で、カスタムSendEmailがそのURLに `&role=` を付けて1通だけ送る正しい構成だった。初回調査では旧形式のキー名（just_make_token）だけ確認して見落とした | －（問題なし） | － |
| D-3 | 予約キャンセル通知（店舗）の本文に**テスト用店舗ID「specialized_kyoto」がベタ書き**。全加盟店にこのIDが送られる | 持ち越し（旧にも同記載） | 高（旧から実害継続中） |
| D-4 | メール変更の6桁確認コードが「現在日時を数値変換」した値 = 受信時刻からほぼ推測可能 | 持ち越し | 中 |
| D-5 | 管理者向けキャンセル通知の件名・本文の冒頭に真偽値の `format_boolean` 出力（デバッグ痕）が混入 | **新規** | 低 |
| D-6 | option set `admin_info.mail` に開発者個人のGmail（manmosutarou@gmail.com）が残存（旧から）。使用箇所の確認要 | 持ち越し | 低 |
| D-7 | 誤字: 「キャンセルされましました」（ユーザー向けキャンセル）、「お問い合わせください。。」（キャンセル系2通） | 持ち越し | 低 |

---

## 4. 旧→新のページ構成差分（タスク#10 リダイレクト対応表へのインプット）

メール調査の副産物として、新旧エクスポートのページ一覧差分を記録しておく（#10の対応表作成にそのまま使える）。

| 旧ページ | 新での扱い |
|---|---|
| `shop_admin` | **廃止**（→ `admin` に統合か。店舗ログインは `admin_signin?role=shop`）。**現行本番で200 = リリース後は301必須** |
| `shop_admin_login` | **廃止**（→ `admin_signin?role=shop`） |
| `admin_login` | **廃止**（→ `admin_signin?role=admin`） |
| `shop_term` | **廃止**（→ `legal` ページか。要確認） |
| index / search / shop_detail / user_reservation_list / shop_form / admin / admin_price_simulation / admin_update_calendar / reset_pw / 404 | 継続（同名） |
| （新規） | `signin`, `mypage`, `reservation`, `bicycle_detail`, `legal`, `admin_signin` |

---

## 5. 推奨対応（修正はBubbleエディタ側 = yamaotoさん作業）

リリース前必須（新規リグレッションのみ）:

1. **D-1**: cart版の管理者向け予約通知の宛先を `rincle@pedalstandard.com`、件名を「新規予約確定のお知らせ…」に修正（旧実装 or mypage版が正）
2. **A-2 / 上記4章**: `shop_admin` ほか廃止ページの301リダイレクト設定（タスク#11）に `shop_admin_login` / `admin_login` / `shop_term` も含める。メール本文側は mypage / legal版の生死確認のうえ、残すなら `admin_signin?role=shop&mode=sign_in` へ
3. **C-1 / C-2**: 審査通過メールの `? role=` スペース除去、店舗向けキャンセルのログインURLに `admin_signin?role=shop&mode=sign_in` を補完
4. **D-5**: キャンセル管理者通知の `format_boolean` デバッグ痕を除去

この機会に直すべき（持ち越しバグ・リリースブロッカーではない）:

5. **A-1**: `/reservations` ベタ書き5箇所（cart版含む）→ `Website home URL` + `user_reservation_list`（動的参照）へ
6. **B-1**: 署名の `rincle.jp` → `rincle.co.jp`（option set `admin_info.email_signature` の修正が最優先。ベタ書き11箇所も一括置換）
7. **D-3**: specialized_kyoto 除去（実IDの動的参照 or 記載自体を削除）
8. **C-3**: 登録完了メールのリンクを `signin?mode=sign_in` に統一
9. mypage / legal の重複ワークフロー（旧実装コピー）はどちらが本番導線か確認のうえ削除
10. 修正後、タスク#14のE2Eで「予約確定→キャンセル」「登録→パスワードリセット」のメール実受信とリンク先を実機確認

---

## 検証履歴

- 2026-07-12 初回: 新エクスポート vs 仕様CSV。D-2（リセット二重送信）を検知
- 2026-07-12 訂正: 実機テストでリセットメールは1通のみと確認 → D-2は誤検知（`delivery_mode: generate_url` の見落とし）として訂正
- 2026-07-12 追補: 旧エクスポート（3/23本番）との三者突合＋本番URL実測を実施。全指摘を「持ち越し / 新規リグレッション」に分類。`rincle.jp` のDNS未設定、`/reservations` の本番404、`shop_admin` の本番200（リリース後404化）を実測確認
- 2026-07-12 追補2: 送信経路の網羅性を確認（プラグイン・API Connector経由のメール送信なし）。新アプリのみ独自SendGridキー設定を発見 → E-1として#14へ引き継ぎ
