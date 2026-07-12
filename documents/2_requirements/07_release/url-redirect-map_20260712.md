# 旧URL→新URLリダイレクト対応表（リリース前タスク#10）

- 作成日: 2026-07-12
- 対象: 旧 `.context/rincle.bubble`（現行本番・3/23）→ 新 `documents/rincle.bubble`（7/12）
- 方法: 新旧全ページの構成・データ型（page_item_type）を突合し、メール以外の全経路（画面要素・ワークフロー・API・option set・設定・ページproperties・mobile_views・user_types）のベタ書きURLを機械抽出。Googleインデックス状況とrobots/sitemapは実測。**新旧ページの生死は開発ブランチ（version-13fge）への実アクセスで確認済み**
- ドメインは新旧同一（`rincle.co.jp`）のため、対象は**ページパスの変更のみ**

## 結論サマリ

1. **ページ単位の301は4件だけ**（廃止4ページ）。#11でBubbleのSEO設定に登録するだけで済む。**新ブランチで実地確認済み: 新ページ（mypage/legal/reservation/signin/admin_signin/bicycle_detail）は全て200、廃止ページ（shop_admin/shop_term/admin_login）は404**
2. **最重要論点は店舗詳細ページのURL形式変更**: 旧 `/shop_detail/<旧ID>`（パスにID）→ 新 `/shop_detail?shop=<新ID>`（クエリ方式）。**ページ単位301では救えず、旧ID→新IDの対応が必要**（#7のDB対応表と連動）
3. **Googleにインデックスされている旧URLは実測3件のみ**（トップ+店舗詳細2件）。SEO被害は軽微だが、メール内リンク・加盟店が配布した自店URL・ブックマークのために301推奨
4. メール以外のベタ書きは**旧ページ名への参照0件**（メール内の分は#12レポートで対応済み）。新規検出は開発版URLベタ書き1件（後述）

---

## 1. 301リダイレクト設定リスト（#11用・yamaoto）

Bubbleの Settings > SEO/metatags の301設定にそのまま登録する想定。

| # | 旧パス | 新パス（リダイレクト先） | 備考 |
|---|---|---|---|
| 1 | `/shop_admin` | `/admin_signin?role=shop&mode=sign_in` | 旧店舗管理画面。**現行本番で200・新ブランチで404を実測（7/12）**。メールにも記載があったため301必須 |
| 2 | `/shop_admin_login` | `/admin_signin?role=shop&mode=sign_in` | 旧店舗ログイン。審査通過メール・キャンセルメールに記載歴あり |
| 3 | `/admin_login` | `/admin_signin?role=admin&mode=sign_in` | 旧運営ログイン |
| 4 | `/shop_term` | `/legal`（**要確認**） | 旧は店舗向け規約。ただし旧ページはデータ付き（type=user・店舗ごとのURL）なので、新`legal`への単純マッピングで良いか増永さん・yamaoto確認 |

※ Bubbleの301設定がクエリ付きリダイレクト先を受け付けない場合は、`/admin_signin` に落とすだけでも可（ログイン画面には着地する）。

## 2. 店舗詳細URLの形式変更（最重要・#7と連動）

**実測したGoogleインデックス済みの旧URL例:**

```
https://rincle.co.jp/shop_detail/1756713251792x650516246419728000?…&shop_id=1756713251792x650516246419728000&…
```

| | 旧 | 新 |
|---|---|---|
| 形式 | `/shop_detail/<ID>`（パスにID埋め込み） | `/shop_detail?shop=<ID>`（クエリパラメータ） |
| IDの実体 | 旧DBの**userレコード**のunique ID（旧設計は店舗情報がuserに載っていた） | 新DBの**shopレコード**のID |
| ページ設定 | page_item_type=user のデータ付きページ | データ型なし・`?shop=` `?start=` `?end=` 等をWFで読む |

**問題**: ページ名は同じでも、旧URLで来たアクセスは新ページでは店舗を特定できない（パスのIDを読まない＋旧IDは新DBに存在しない）。ページ単位301では救えない。

**対応オプション**（推奨は a）:

- a. **旧ID→新IDの個別301を登録**（54店舗分）。#7の新旧DB対応表に「旧user ID → 新shop ID」のマッピング列を含めれば機械生成できる
- b. 新shop_detailのページロードWFで「パス末尾にIDが付いていたら変換テーブルを引いて `?shop=` に開き直す」実装（DB側に変換テーブが必要・実装コスト高）
- c. 割り切って `/shop_detail`（店舗未指定）へフォールバック（ユーザーは検索し直し）

**判断材料**: Googleインデックスは店舗2件のみ。ただし**加盟店が自店URLをSNS・店頭で配布している可能性**があるので、増永さんに配布実態を確認してから a/c を決めるのが良い。

## 3. 継続ページ（リダイレクト不要）と新規ページ

- 継続（同名・10ページ）: `index` `search` `shop_detail`（※上記の形式問題あり） `user_reservation_list` `shop_form` `admin` `admin_price_simulation` `admin_update_calendar` `reset_pw` `404`
- 新規: `signin` `mypage` `reservation` `bicycle_detail` `legal` `admin_signin`

## 4. メール以外のベタ書きURL洗い出し結果（タスク但し書き分）

新アプリの画面要素・ワークフロー・API・option set・設定を全走査した結果:

| 対象 | 結果 |
|---|---|
| 旧ページ名（shop_admin等）への参照 | **0件**（唯一の残存はメール本文内だが、配信されない死にページ内のみと確認済み = #12レポートA-2〈格下げ〉参照） |
| 画面上の固定リンク（フッター等） | 外部リンクのみ（pedalstandard.com・zengin.ajtw.net・checkout.pay.jp）→ 問題なし |
| 利用規約・プライバシーポリシー・Q&A（option set格納分） | 内部リンクのベタ書きなし（Googleポリシーへの外部リンク1件のみ） |
| APIワークフローが返す/呼ぶURL | 自アプリWF呼び出しに `https://rincle.co.jp[version]/api/1.1/wf/...` — `[version]` が動的なので環境追従する。実害小（ドメイン変更時のみ注意） |
| **新規検出** | option set `pay_jp_apply_redirect_url` に**開発版URL `https://rincle.bubbleapps.io/version-test/shop_form` がベタ書き**（旧から持ち越し）。Pay.JP加盟店申請後の戻り先が開発環境を向く。shop_form導線（加盟店招待）の実挙動を要確認。Stripe移行（#35）で消える可能性はあるが、それまでの加盟店追加に影響しうる |

## 5. 残課題・関連タスクへの引き継ぎ

- **DB内コンテンツのリンク**: news / topics / Q&A の本文はアプリ定義外（DBデータ）なので、本文中に旧URLがないかは**移行データ側で確認**（#7/#8とセットで。SQLかCSVでURLパターンをgrepすれば済む）
- **sitemap**: 新旧とも未設定（`sitemap_pages: []`）→ リリース後のSEO設定一式（#21-22）で対応
- **robots.txt**: 現行は `Disallow: /version-test/` のみ。新環境でも同等になっているか#44（開発版のGA計測除外）と合わせて確認
- メール内の旧URL手直しは `email-url-check_20260712.md（同ディレクトリ）`（#12レポート）参照

---

## 検証履歴

- 2026-07-12 初回作成
- 2026-07-12 見直し: ①スキャン範囲をページproperties・mobile_views・user_types・commentsまで拡張 → 新規ヒット0件（洗い出しの網羅性を確認）。②新ブランチ（version-13fge）への実アクセスで、新ページ全200・廃止3ページ404を確認し301リストの妥当性を裏取り。③新エクスポート内の同名重複ページ（mypage×2・legal×2）は小さい方が配信されることを配信JSで確認 — URLマッピングへの影響なし（詳細は email-url-check_20260712.md（同ディレクトリ） 追補3）
