# RINCLE SEO設定ガイド

> 作成日: 2026-05-20 / 最終更新: 2026-08-20（Step 2を全面改訂: sitemapはBubble自動生成を撤回し手動生成に方針変更〈正本: sitemap-creation-guide.md〉。1-7 noindex対象とチェックリストをDB再構築後の新ページ構成に更新。店舗56・自転車374〈2026-08-20 本番サイト実測〉）
> 2026-07-02更新: title/h1の設定例を「ロードバイク」軸に統一〈6/12 KW方針・keyword-research.md〉、GA4の進捗と6/30定例のブログ方針を反映
> 2026-06-11更新: 実測値・Bubbleネイティブ機能・Prerender最新情報を反映。本番DB実測の店舗54・車種369、アクセスログ実測の流入/CVRデータ
> 対象: SEO初心者向け。専門用語をできるだけ噛み砕いて説明

---

## そもそもSEOって何？

**SEO（Search Engine Optimization）= 検索エンジン最適化**

Googleで「ロードバイク レンタル 神戸」と検索したとき、RINCLEのサイトが上の方に出てくるようにすること。

上に出れば出るほど、広告費をかけずにお客さんが来る。逆に、検索結果に出なければ「存在しないのと同じ」。

### RINCLEの現状（2026-06-11実測で更新）

```
Googleに認識されているページ: 実質2〜3ページのみ
  1. トップページ
  2. 店舗詳細1件（しかも日付・検索条件のクエリパラメータ付きのままインデックス）
  3. 規約ページ
「スポーツバイク レンタル」で検索: 圏外（表示されない）
「ロードバイク レンタル 神戸」で検索: 圏外（表示されない）
```

**つまり、今のRINCLEはGoogleから見てほぼ存在していない。** 正確なインデックス数はSearch Console導入後に確認する。

### なぜ今SEOをやるのか — 数字で見る期待効果（2026-06-11追記: 本番アクセスログ実測）

GA4が未設置のため、サーバーのアクセスログから実測した現状:

```
月間アクセス: 約700ユニークIP / 約2,300PV
予約CVR:     約4%（サイトに来た人の約4%が予約まで完了）→ 健全な水準
```

CVR約4%というのは「サイトに来てもらえさえすれば、ちゃんと予約につながっている」という意味。つまり**今のボトルネックは流入**で、検索からの流入を増やせば予約はほぼ比例して増える見込みが立つ。

お金に換算すると:
- 平均予約単価 ¥10,200 × 手数料15% = **予約1件 ≒ ¥1,530 の売上**
- 例えば検索流入が月100人増えれば、予約 +4件/月 ≒ +¥6,100/月。広告費ゼロで、設定すれば効き続ける

ちなみに2026年2月に **3,402PV / 1,603IP** へのスパイクがあったが、**要因は特定できていない**（アクセスログでは参照元まで分からない）。GA4を導入すれば（Step 4）、こうした急増がどこから来たのか（SNSで紹介された？メディアに載った？）が分かるようになる。

---

## なぜこうなっているのか（2026-06-11実測で更新）

RINCLEはBubble.io（ノーコードツール）で作られている。Bubble.ioで作ったサイトは「中身（本文）がJavaScriptで後から読み込まれる」構造になっている。

2026-06-11に実際のHTMLを取得して確認した結果:

```
意外と設定されていたもの（サーバー側でHTMLに出力済み）:
  → titleタグ（店舗詳細では店舗名入りの動的タイトルまで生成されている）
  → meta description / OGP一式

問題が残っているもの:
  → 本文がHTMLにほぼ無い: トップの可視テキストは「Rincle」の6文字だけ。
    店舗詳細でも31文字（タイトルの重複のみ）。料金・車種・住所・営業時間はゼロ
  → 初期HTMLにh1/h2が一切ない
  → ページ間の<a>リンクが初期HTMLに無い（リンクはJS生成のみ）
  → sitemap.xmlが404 / robots.txtにSitemap行なし
  → canonicalなし → 検索条件付きのゴミURLが「正式なページ」としてインデックスされる実害が発生中
  → meta descriptionは全ページ同一文面、og:imageはアイコン画像の流用（品質課題）
```

**重要な補足: 「Bubble（JSレンダリング）だからインデックスされない」は正確ではない。** Vercel×MERJの大規模調査（Googlebotのフェッチ10万件以上を分析）では、GoogleはCSRページを含むHTML 200ページの100%をフルレンダリングしており、レンダリング待ちも中央値10秒程度だった（出典: https://vercel.com/blog/how-google-handles-javascript-throughout-the-indexing-process / Google公式のJavaScript SEO解説: https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics ）。

RINCLEのインデックスが2〜3ページに留まっている主因は、**sitemapが無い+内部リンクがJS生成のみ→Googleがページを発見できない「ディスカバリーの問題」**である可能性が高い。つまり、このガイドのStep 1〜3（メタ情報・sitemap・Search Console）という基本の整備だけでも大きく改善する余地がある。

---

## やるべきことの全体像

```
Step 1: Googleに「このサイトは何か」を教える（メタ情報の設定）
Step 2: Googleに「このサイトにはこんなページがあるよ」と教える（sitemap）
Step 3: Googleに「うちのサイトを見に来て」とお願いする（Search Console）
Step 4: サイトに来た人の行動を記録する（GA4）
Step 4.5: ユーザーの動きを録画して「なぜ離脱するか」を見る（クラリティ）
Step 5: 検索結果に表示されるようになったか確認・改善する
```

---

## Step 1: メタ情報の設定

### メタ情報とは

Googleや、SNSでリンクを貼ったときに表示される「サイトの説明書」のようなもの。HTMLの中に書く。

### 1-1. titleタグ（ページタイトル）

**これは何？**
ブラウザのタブに表示される文字。Googleの検索結果で青い文字で表示されるタイトル。

```
Googleの検索結果で見ると:

  ロードバイク・E-Bikeをレンタルするなら RINCLE｜全国のプロショップで安心体験  ← これがtitleタグ
  https://rincle.co.jp/                                                        ← これがURL
  全国54店舗のプロショップでロードバイク・E-Bikeをレンタル。                     ← これがdescription
```

**RINCLEの現状（2026-06-11実測で更新）:** 設定済みだが品質が低い。トップは `Rincle` の6文字だけでキーワードが無く、店舗詳細は `Rincle｜RINCLE 箕面稲店 / スペシャライズド箕面` と動的生成はできているが「レンタル」等の検索キーワードが入っていない。

**設定すべき内容:**（2026-07-02更新: 「ロードバイク」軸に統一）

| ページ | titleタグの例 |
|--------|-------------|
| トップページ | ロードバイク・E-Bikeをレンタルするなら RINCLE｜全国のプロショップで安心体験 |
| 店舗一覧 | 店舗一覧｜RINCLE - ロードバイク・E-Bikeレンタル |
| 店舗詳細（例: 神戸） | スペシャライズド神戸｜ロードバイク・E-Bikeレンタル｜RINCLE |
| 車種一覧 | レンタルできる車種一覧｜RINCLE - ロードバイクレンタル |
| 料金 | 料金プラン｜RINCLE - ロードバイクレンタル |
| はじめての方へ | はじめての方へ｜RINCLEの使い方ガイド |
| 会員登録 | 無料会員登録｜RINCLE - ロードバイクレンタル |

**ルール:**
- 30〜60文字が目安（長すぎると途中で切れる）
- ページの内容を表すキーワードを前の方に入れる
- **検索キーワードは「ロードバイク」「eバイク/E-Bike」軸を使い、「スポーツバイク」は使わない**（サジェスト調査で「スポーツバイク レンタル」は誰も検索しないことを確認済み。社名・ブランド説明の文中で使うのはOK。詳細: keyword-research.md・6/12確定方針）
- 全ページに「RINCLE」を含める（ブランド認知）
- ページごとに違うタイトルにする（全ページ同じはNG）

**Bubble.ioでの設定方法:**
1. Bubble.ioエディタを開く
2. 対象のページを選択
3. 左メニュー「Appearance」→「Page title」に入力

### 1-2. meta description（ページの説明文）

**これは何？**
Googleの検索結果で、タイトルの下に表示されるグレーの説明文。

**RINCLEの現状（2026-06-11実測で更新）:** 設定済み。ただし**全ページ同一文面**（店舗詳細ページもトップと同じ説明文）。ページごとに固有の文面へ差し替えるのが課題。

**設定すべき内容:**

| ページ | meta descriptionの例 |
|--------|---------------------|
| トップページ | 全国54店舗のプロショップでロードバイク・E-Bikeをレンタル。プロの整備で安心、ネットで簡単予約。初めてのスポーツバイク体験にも最適です。 |
| 店舗一覧 | RINCLEのパートナーショップを検索。全国54店舗から、最寄りの店舗を見つけてロードバイク・E-Bikeをレンタルできます。 |
| 店舗詳細（例: 神戸） | スペシャライズド神戸でロードバイク・E-Bikeをレンタル。JR神戸駅から徒歩3分。プロスタッフが初心者にも丁寧にサポートします。 |

**ルール:**
- 70〜120文字が目安
- そのページに何が書いてあるかを具体的に書く
- 「全国54店舗」「プロショップ」等の差別化ポイントを入れる（店舗数は2026-06-11時点のDB実数。対外表記は「全国100店舗以上」で決め打ちする方向で協議中〈6/19・タスク#33・増永さん側で決定〉→ 確定後に全ページの文言を差し替える）
- 行動を促す言葉を入れる（「簡単予約」「今すぐ検索」等）

**Bubble.ioでの設定方法:**
1. 対象のページを選択
2. 「Appearance」→「Meta description」に入力

### 1-3. OGP（Open Graph Protocol）

**これは何？**
LINE、X（Twitter）、FacebookでRINCLEのリンクを貼ったときに表示されるカード画像・タイトル・説明文のこと。

```
LINEでリンクを送ったとき:

  ┌─────────────────────┐
  │ [RINCLEのロゴ画像]            │
  │ ロードバイク・E-Bikeをレンタル... │
  │ 全国54店舗のプロショップで...   │
  └─────────────────────┘
```

**RINCLEの現状（2026-06-11実測で更新）:** og:title / og:description / og:image / og:url / og:type / og:site_name すべて設定済み。ただし**og:imageがアプリアイコン（apple-touch-icon.png）の流用**で、推奨の1200×630pxサイズでない。SNSカードの見栄えのため専用画像への差し替えが課題。

**設定すべき内容:**

| OGP項目 | 設定値 |
|---------|-------|
| og:title | ページのtitleと同じ |
| og:description | ページのmeta descriptionと同じ |
| og:image | RINCLEのロゴ or 自転車の写真（1200×630px推奨） |
| og:url | そのページのURL |
| og:type | website |
| og:site_name | RINCLE |

**Bubble.ioでの設定方法:**
1. 対象ページの「Appearance」設定内
2. 「SEO / metatags」セクションで設定
3. または Settings > SEO/metatags > Script/meta tags in header にHTMLで直接記述:

```html
<meta property="og:title" content="ロードバイク・E-Bikeをレンタルするなら RINCLE">
<meta property="og:description" content="全国54店舗のプロショップでロードバイク・E-Bikeをレンタル。">
<meta property="og:image" content="https://rincle.co.jp/og-image.png">
<meta property="og:url" content="https://rincle.co.jp/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="RINCLE">
```

### 1-4. h1タグ（見出し）

**これは何？**
そのページで一番大きな見出し。Googleは「h1タグに書いてある内容 = このページのメインテーマ」と判断する。

**RINCLEの現状（2026-06-11実測）:** 初期HTMLにh1/h2が一切ない（Googleがページのテーマを判断できない）

**設定すべき内容:**

| ページ | h1タグの例 |
|--------|-----------|
| トップページ | ロードバイク・E-Bikeを全国のプロショップでレンタル |
| 店舗一覧 | 店舗を探す |
| 店舗詳細 | スペシャライズド神戸 |
| 車種一覧 | レンタルできる車種一覧 |

**ルール:**
- 1ページにh1は1つだけ
- ページのメインテーマを表す内容にする
- 検索キーワードを自然に含める

**Bubble.ioでの設定方法:**
1. テキスト要素を選択
2. 「Appearance」→ HTML tag を「H1」に変更

### 1-5. 画像のalt属性

**これは何？**
画像の「代替テキスト」。画像が表示できないときや、視覚障害者がスクリーンリーダーを使っているときに読まれるテキスト。Googleも画像の内容を理解するのにaltを使う。

**RINCLEの現状:** alt属性がほぼ設定されていない

**設定すべき内容:**
- 車種画像: 「Specialized Allez E5 Disc ロードバイク」
- 店舗画像: 「スペシャライズド神戸 店舗外観」
- バナー画像: 「RINCLEでロードバイク・E-Bikeをレンタル」

**Bubble.ioでの設定方法:**
1. 画像要素を選択
2. 「Appearance」→ 「Alt text」に入力

### 1-6. canonical URL

**これは何？**
「このページの正式なURLはこれです」とGoogleに教えるもの。

例えば、同じページに以下の複数URLでアクセスできる場合:
```
https://rincle.co.jp/shop_detail?shop=12345
https://rincle.co.jp/shop_detail?shop=12345&ref=top
https://rincle.co.jp/shop_detail?shop=12345#section1
```
Googleは「これは別々のページ？同じページ？」と迷う。canonicalを設定すると「全部同じページです。正式URLはこれです」と伝えられる。

**RINCLEの現状（2026-06-11実測）:** canonicalが無いため、**日付・検索条件のクエリパラメータが付いたままのURLが「店舗ページの正式な姿」としてインデックスされている**実害が確認済み。早急に設定すべき。

**Bubble.ioでの設定方法（2026-06-11更新: ネイティブ機能で対応可能）:**
Bubbleには標準で canonical 出力機能がある。手書きHTMLは不要。
1. Settings > SEO/metatags を開く
2. 「**Enable canonical url**」のチェックボックスをONにする（説明文に "Check this box to enable a Bubble-defined canonical url tag." とある。2026-06-11にBubble公式マニュアルで名称を確認済み）

（参考: Bubble公式マニュアル https://manual.bubble.io/core-resources/application-settings/seo-metatags ）

### 1-7. noindex（検索結果に出さないページの設定）

**これは何？**
「このページはGoogleの検索結果に載せないで」と伝えるタグ。ページによって「検索結果に出てほしいページ」と「出ても意味がない・出てはいけないページ」があるため、後者に設定する。

**対象ページ:**（詳細は `seo_page_settings.csv`（同フォルダ） の「index方針」列を参照）

| 方針 | ページ | 理由 |
|------|--------|------|
| **noindex必須** | マイページ（`/mypage`）/ 予約履歴一覧（`/user_reservation_list`） | ログイン後の個人情報ページ。検索結果に出ること自体が望ましくない |
| **noindex推奨** | ログイン・会員登録（`/signin`）/ 予約（`/reservation`）/ パスワード再設定（`/reset_pw`）/ 加盟店申込（`/shop_form`）/ 管理画面4ページ（`/admin` `/admin_signin` `/admin_price_simulation` `/admin_update_calendar`） | 検索からいきなり来ても意味がない機能・内部ページ |
| index（何もしない） | 上記以外の全ページ（トップ/検索/店舗詳細/自転車詳細/legal） | 検索流入の入口。特に店舗詳細・自転車詳細はSEOの主力 |

※ 2026-08-20更新: DB再構築後の新ページ構成（19ページ）に合わせてページ名を差し替えた（旧: mypage / login / register / reserve）

**Bubble.ioでの設定方法:**
1. エディタで対象ページ（mypage / user_reservation_list / signin / reservation / reset_pw / shop_form / admin系4ページ）を開く
2. ページの何もない部分をダブルクリックしてページのプロパティを開く
3. 「**Page HTML Header**」欄に以下を貼り付け:

```html
<meta name="robots" content="noindex">
```

4. 対象ページぶん繰り返してデプロイ

**⚠️ 絶対にやってはいけないこと:**
Settings > SEO/metatags > Script/meta tags in header（GA4スニペットを貼った場所）には貼らないこと。あそこは**全ページ共通**のヘッダーなので、noindexを書くとサイト全体がGoogleから消える。noindexは必ず**ページごと**のPage HTML Headerに設定する。

**あわせて確認（2026-06-11更新）:**
以前のBubbleには Settings > SEO/metatags に「Allow search engines to index this app」というアプリ全体のインデックス許可チェックがあったが、**現在の公式マニュアルにはこの項目の記載がなく、画面に表示されないという報告もある**。見当たらなくても探し回らなくてよい（本番アプリは標準でインデックス許可される）。代わりに次の2点で確認する:
- 公開ページのソースに意図しない `noindex` が入っていないか
- robots.txt でサイト全体をブロックしていないか（現状の robots.txt は `/version-test/` のみDisallowなので問題なし）

**設定後の確認方法:**
- 公開ページで右クリック →「ページのソースを表示」→ `<head>`内に`noindex`が入っているか確認（noindex対象ページに**だけ**入っていればOK）
- Search Console導入済みなら「URL検査」で「インデックス登録: 許可されていません（noindex）」と表示される

**sitemapとの関係:**
noindexにするページはsitemap.xmlに載せない（「登録して」と「登録しないで」が矛盾するため）。現在のsitemap登録URL一覧には予約・ログイン・マイページ系は含まれていないので、そのままでOK。

### 1-8. 構造化データ（JSON-LD）

**これは何？**
「このページは自転車店の情報です」「これは商品で価格は6,000円です」と、Googleが機械的に理解できる形式（JSON-LD）でページに埋め込むデータ。検索結果に星評価・パンくず・FAQ等の「リッチリザルト」が表示される条件になる。

**RINCLEの現状（2026-06-11実測）:** 構造化データなし

**設定すべきスキーマ:**

| スキーマ | 適用ページ | 備考 |
|---------|----------|------|
| `BikeStore`（LocalBusinessのサブタイプ） | 各店舗詳細 | schema.orgに自転車店専用タイプがある。name / address / geo / openingHours / priceRange を設定。Googleのローカルビジネス・リッチリザルト対象 |
| `Product` + `Offer` | 各車種詳細 | レンタル価格を offers.price に。レビュー獲得後は `AggregateRating` を追加すると★表示が狙える（現状レビューゼロのため当面は価格のみ） |
| `BreadcrumbList` | 全ページ | 検索結果のパンくず表示 |
| `FAQPage` | よくある質問 | リッチリザルト対象 |
| `Organization` | トップ | ロゴ・SNSプロフィールの紐付け |

※「レンタル専用」のリッチリザルトはGoogleに存在しないため、上記の組み合わせで対応する。

**Bubble.ioでの設定方法:**
1. 各ページの「Page HTML Header」に `<script type="application/ld+json">...</script>` を記述（動的データの差し込み可）
2. 設定後は [リッチリザルトテスト](https://search.google.com/test/rich-results) で検証

（参考: Google LocalBusiness構造化データ https://developers.google.com/search/docs/appearance/structured-data/local-business ）

---

## Step 2: sitemapの作成

### sitemapとは

**サイトの「地図」のようなもの。** RINCLEのサイトにどんなページがあるかを一覧にしたファイル（XML形式）。

Googleのロボットは、このファイルを読んで「このサイトにはこんなページがあるんだな。全部見に行こう」と判断する。

### なぜ必要？

sitemapがないと:
```
Googleロボット: 「rincle.co.jpに来たけど、トップページから
                リンクを辿っていくしかページを見つける方法がない。
                リンクで繋がってないページは永遠に見つけられない」
```

sitemapがあると:
```
Googleロボット: 「sitemapを見たら56店舗分のページと374台分の自転車ページがあるんだな。
                全部見に行こう」
```

### ⚠ 2026-08-20 作成方法を変更（旧記述の訂正）

以前この節では「**方法A: Bubble標準のsitemap自動生成（Expose a sitemap file）を推奨**」としていたが、**撤回する**。

- 自動生成で店舗・自転車の1件ずつのURLが載るのは、ページとデータの種類を直接ひも付けた作り（URLがパスにIDを含む方式）の場合だけ
- DB再構築後の新サイトはひも付けない作り（`/shop_detail?shop=<ID>` のようにURLの後ろにIDを付ける方式）のため、**自動生成では店舗・自転車の個別URLが載らない**（2026-08-20 bubbleファイル+本番実測で確認）
- そのため**手動生成に方針変更**。手順の正本は `sitemap-creation-guide.md`（同フォルダ）

### sitemapの中身（イメージ）

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://rincle.co.jp/</loc>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://rincle.co.jp/shop_detail?shop=1784194786574x498131851707290800</loc>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://rincle.co.jp/bicycle_detail?bicycle=1767680741415x960023914326261800</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <!-- 他のページも同様に追加 -->
</urlset>
```

### sitemapに登録するURL一覧

登録するのは検索結果に出したいページだけ。noindexにするページ（1-7参照）は載せない（「登録して」と「登録しないで」が矛盾するため）。載せる/載せないの全ページ一覧は `sitemap-creation-guide.md` 参照。

```
静的ページ（固定・3ページ）:
  /                  トップページ
  /search            検索（条件パラメータなしの素のURL）
  /legal             利用規約・プライバシーポリシー

動的ページ（データに応じて増える）:
  /shop_detail?shop=<店舗ID>          店舗詳細 × 店舗数分
  /bicycle_detail?bicycle=<自転車ID>  自転車詳細 × 台数分
```

実数で計算すると（2026-08-20 本番サイト実測: 店舗56・自転車374）:
```
静的ページ:     3 URL
店舗詳細:      56 URL
自転車詳細:   374 URL
──────────────
合計:        約433 URL → 全部sitemapに登録する
```

### 各タグの意味

| タグ | 意味 | 設定例 |
|------|------|--------|
| `<loc>` | ページのURL | `https://rincle.co.jp/shop_detail?shop=<店舗ID>` |
| `<changefreq>` | 更新頻度のヒント | daily / weekly / monthly / yearly |
| `<priority>` | サイト内での重要度（0.0〜1.0） | トップ=1.0、店舗詳細=0.8、規約=0.2 |

### RINCLEの現状

```
https://rincle.co.jp/sitemap.xml → 404エラー（存在しない。2026-08-20実測で再確認）
```

### 作成方法（2026-08-20更新: 手動生成に方針変更）

手順の正本は **`sitemap-creation-guide.md`（同フォルダ）**。概要だけ書くと:

1. **bubbleファイルの用意** — アプリの設計データからページの種類を洗い出す（済み・ページを増やした時だけ再確認）
2. **Data APIの設定** — Bubbleの Settings > API で `shop` と `Bicycle` だけ公開にチェックし、店舗・自転車のID一覧をプログラムから取れるようにする（個人情報を含む種類は絶対にチェックしない）
3. **生成** — `generate_sitemap.js`（`documents/4_growth/03_seo/`）を実行するとData APIから全件取得してsitemap.xmlを出力する。削除済み・審査未通過の店舗、非表示・アーカイブの自転車は自動で除外
4. **公開** — Settings > SEO/metatags の「**Hosting files in the root directory**」でsitemap.xmlをアップロードすると `rincle.co.jp/sitemap.xml` で配信される。標準の自動生成（Expose a sitemap file）は**OFFのまま**にする（同じURLを取り合うため）

店舗・自転車が増えたら3→4を再実行する（月1回など運用の取り決めは増永さんと相談）。

### robots.txtへの追記

**robots.txtとは？**
Googleのロボットに「このサイトのルール」を伝えるファイル。「ここは見に来ていいよ」「ここは見ないで」等を指定する。

**RINCLEの現状:**
```
User-agent: *
Disallow: /version-test/
```
sitemapの場所が書かれていない。

**追記すべき内容:**
```
User-agent: *
Disallow: /version-test/
Sitemap: https://rincle.co.jp/sitemap.xml
```

**Bubble.ioでの設定方法（2026-06-11更新）:**
1. Settings > SEO/metatags の「**Customize robots.txt (advanced)**」のチェックボックスをONにする
2. 表示された編集欄に上記を入力

---

## Step 3: Google Search Consoleの登録

### Google Search Consoleとは

**Googleが無料で提供する「あなたのサイトがGoogleにどう見えているか」を確認するツール。**

確認できること:
- Google検索で何回表示されたか
- どんなキーワードで表示されたか
- クリック数
- どのページがインデックスされているか
- エラーがあるか

### なぜ必要？

SEO設定をしても、実際にGoogleに認識されているかを確認する手段がないと、効果が出ているか分からない。

### 登録手順

**1. Search Consoleにアクセス**
- https://search.google.com/search-console/ にアクセス
- Googleアカウントでログイン

**2. プロパティを追加**
- 「プロパティを追加」をクリック
- 「URLプレフィックス」を選択
- `https://rincle.co.jp/` を入力

**3. サイトの所有権を確認**
- 確認方法はいくつかあるが、Bubble.ioの場合は「HTMLタグ」が簡単:
  1. Search Consoleが表示するメタタグ（`<meta name="google-site-verification" content="xxxxx">`）をコピー
  2. Bubble.io の Settings > SEO/metatags > Script/meta tags in header に貼り付け
  3. Search Consoleに戻って「確認」をクリック

**4. sitemapを送信**
- 左メニューの「サイトマップ」をクリック
- 「新しいサイトマップの追加」に `sitemap.xml` と入力
- 「送信」をクリック

**5. インデックス登録をリクエスト**
- 上部の検索バーにRINCLEの主要ページURLを入力
- 「インデックス登録をリクエスト」をクリック
- トップページ、検索ページ、主要な店舗詳細ページを最低限リクエスト

### 登録後にやること

1〜2週間後にSearch Consoleで以下を確認:
- 「カバレッジ」レポート: 何ページがインデックスされたか
- 「検索パフォーマンス」: どんなキーワードで表示・クリックされているか
- 「エラー」: Googleがアクセスできないページがないか

---

## Step 4: GA4（Google Analytics 4）の導入

### GA4とは

**Googleが無料で提供する「サイトに来た人の行動を記録・分析するツール」。**

確認できること:
- 何人がサイトに来たか
- どこから来たか（Google検索 / SNS / 直接 / 広告）
- どのページを見たか
- どこで離脱したか（= どこで「もういいや」とページを閉じたか）
- 予約ボタンを押した人は何人か

### なぜ必要？

```
GA4なしでサイト改善:
  「なんとなく料金ページを直してみた」
  → 効果があったかどうか分からない

GA4ありでサイト改善:
  「料金ページの離脱率が70%だった」
  → 料金を明示したら離脱率が30%に下がった
  → 予約数が2倍になった
```

実例（2026-06-11追記）: 2026年2月にアクセスが普段の約1.5倍（3,402PV/1,603IP）に急増したが、アクセスログでは参照元が分からず**要因を特定できなかった**。GA4が入っていれば「集客 > トラフィック獲得」レポートで、どこから来た急増なのか一目で分かる。

**進捗（2026-07-02追記）:** GA4アカウントは増永さん側で作成済み・弊社も招待済み（タスク#22。計測資産はクライアント所有）。6/29の確認で**開発版URL（`/version-xxx/`）が本番と別ページとして二重カウントされている**ことが分かったため、GAタグの読み込みを本番（live）バージョンのみに限定する対応を行う（タスク#44）。

### 導入手順

**1. GA4アカウントを作成**
- https://analytics.google.com/ にアクセス
- Googleアカウントでログイン
- 「測定を開始」をクリック
- アカウント名: 「RINCLE」
- プロパティ名: 「RINCLE Web」
- タイムゾーン: 日本
- 通貨: 日本円

**2. データストリームを設定**
- 「ウェブ」を選択
- URL: `https://rincle.co.jp`
- ストリーム名: 「RINCLE Web」
- 「ストリームを作成」

**3. 測定IDを取得**
- 作成後に表示される **G-XXXXXXXXXX** という形式のIDをコピー

**4. Bubble.ioにGA4を設置**

方法A: gtag.jsを直接貼り付け（推奨）
1. Bubble.io の Settings > SEO/metatags > Script/meta tags in header に以下を貼り付け:

```html
<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

※ `G-XXXXXXXXXX` の部分を、手順3で取得した自分の測定IDに置き換える

方法B: Bubble.ioのGA4プラグインを使う
1. プラグインストアで「Google Analytics」を検索
2. インストール後、測定IDを入力

**5. 動作確認**
- GA4の「リアルタイム」レポートを開く
- 別のブラウザやスマホでrincle.co.jpにアクセス
- リアルタイムレポートに「アクティブユーザー: 1」と表示されればOK

**6. 拡張計測機能をONにする（1分）**

GA4にはスニペットを貼るだけで自動取得できる「拡張計測機能」がある。デフォルトでほとんどONだが、「フォーム操作」だけOFFになっているのでONにする。

```
GA4管理画面
  → データストリーム → 自分のストリームをクリック
    → 「拡張計測機能」の歯車アイコンをクリック
      → 「フォーム操作」をONにする
      → 保存
```

| 拡張計測項目 | デフォルト | 何が取れるか |
|------------|----------|-----------|
| ページビュー | ON | 各ページの表示回数 |
| スクロール | ON | ページの90%までスクロールしたか |
| 離脱クリック | ON | サイト外へのリンクをクリックしたか |
| サイト内検索 | ON | サイト内検索で何を入力したか |
| **フォーム操作** | **OFF → ONにする** | **フォームの入力開始/送信を記録。予約フォームや会員登録フォームの離脱が分かる** |
| 動画エンゲージメント | ON | YouTube埋め込み動画の再生/完了 |
| ファイルダウンロード | ON | PDFなどのダウンロード |

これで「フォームに入力し始めたけど送信しなかった人」が分かるようになる。カスタムイベントを設定しなくても、フォーム離脱がざっくり把握できる。

### Phase 1でやることまとめ

```
1. GA4アカウント作成 → 測定ID取得（2分）
2. Bubble.ioのheaderにスニペット貼り付け（1分）
3. 拡張計測の「フォーム操作」をONにする（1分）
4. 動作確認（1分）
合計: 約5分
```

これだけで22項目が自動で計測され始める。

### GA4で見るべき指標

| 指標 | 場所 | 何が分かるか |
|------|------|------------|
| ユーザー数 | レポート > ユーザー属性 | 何人来ているか |
| 流入元 | レポート > 集客 > トラフィック獲得 | Google検索/SNS/直接/広告のどこから来ているか |
| ページ別閲覧数 | レポート > エンゲージメント > ページとスクリーン | どのページが人気か、どこで離脱しているか |
| 直帰率 | 同上（標準では非表示。レポートのカスタマイズで列を追加） | エンゲージメントしなかったセッションの割合（旧アナリティクスと定義が異なる） |
| イベント | レポート > エンゲージメント > イベント | ボタンクリック等の行動 |

### カスタムイベント（余裕があれば）

予約フローの各ステップにイベントを仕込むと、「どのステップで離脱しているか」が分かる。

```javascript
// 検索実行時
gtag('event', 'search_executed', {
  area: '神戸',
  bike_type: 'ロードバイク',
  date: '2026-05-24'
});

// 車種詳細ページ表示時
gtag('event', 'bike_detail_view', {
  bike_name: 'Specialized Allez',
  shop_name: 'スペシャライズド神戸'
});

// 予約開始時
gtag('event', 'booking_start');

// 予約完了時
gtag('event', 'booking_complete', {
  value: 6000,
  currency: 'JPY'
});
```

---

## Step 4.5: Microsoft Clarity（クラリティ）の導入

### クラリティとは

**Microsoftが無料で提供する「ユーザーがサイト上でどう動いているかを録画・可視化するツール」。**

GA4が「何人来て、どのページを見たか」の**数字**を教えてくれるのに対し、クラリティは「ユーザーが実際にどこをクリックし、どこでスクロールを止め、どこで迷っているか」を**映像**で見せてくれる。

### 主な機能

| 機能 | 何が分かるか |
|------|------------|
| **セッション録画** | 実際のユーザーの画面操作を動画として再生できる。「ここで迷ってるな」「このボタンに気づいてないな」が一目で分かる |
| **ヒートマップ** | ページのどこがよくクリックされているか、どこまでスクロールされているかを色で可視化 |
| **デッドクリック検出** | ユーザーがクリックしたけど何も起きなかった箇所（= UIが分かりにくい箇所）を自動検出 |
| **レイジクリック検出** | ユーザーが同じ場所を何度もクリックした箇所（= 反応が遅い or 動かないと思われた箇所）を自動検出 |

### なぜGA4と両方必要？

```
GA4だけの場合:
  「予約フローで60%が離脱している」 → 分かるけど「なぜ」離脱したかは分からない

GA4 + クラリティの場合:
  「予約フローで60%が離脱している」（GA4）
  → 録画を見ると「料金表示がなくて、ユーザーが戻るボタンを押している」（クラリティ）
  → 「料金を明示すれば離脱が減る」と具体的な改善案が出る
```

### 料金

**完全無料。トラフィック制限なし。** GA4と同じくMicrosoftが無料で提供している。

### 導入手順

**1. クラリティのアカウントを作成**
- https://clarity.microsoft.com/ にアクセス
- Microsoft / Google / Facebook アカウントでログイン
- 「New project」をクリック
- プロジェクト名: 「RINCLE」
- URL: `https://rincle.co.jp`

**2. トラッキングコードを取得**
- プロジェクト作成後に表示されるスニペットをコピー:

```html
<script type="text/javascript">
    (function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
    })(window, document, "clarity", "script", "XXXXXXXXXX");
</script>
```

※ `XXXXXXXXXX` はプロジェクトごとに異なるID

**3. Bubble.ioに設置**
- Bubble.io の Settings > SEO/metatags > Script/meta tags in header に貼り付け
- GA4のスニペットの下に追加すればOK

**4. 動作確認**
- クラリティのダッシュボードを開く
- 別ブラウザでrincle.co.jpにアクセスして操作
- 数分後にダッシュボードに録画が表示されればOK

### クラリティで見るべきポイント

| 見るもの | 何のために |
|---------|----------|
| **予約フローの録画** | ユーザーがどこで詰まっているか。フォームの入力で迷っていないか |
| **トップページのヒートマップ** | 検索バーがクリックされているか。スクロールされずに離脱していないか |
| **車種詳細ページの録画** | 料金を探してページ内を行ったり来たりしていないか |
| **デッドクリック** | ユーザーがボタンだと思ってクリックしたけど反応しなかった箇所 |

### GA4との使い分け

| 知りたいこと | 使うツール |
|------------|----------|
| 何人来たか、どこから来たか | GA4 |
| どのページで離脱しているか（数字） | GA4 |
| なぜ離脱しているか（映像） | クラリティ |
| どこがクリックされているか | クラリティ |
| 広告の効果測定 | GA4 |
| UIの改善ポイント発見 | クラリティ |

---

## Step 5: 効果測定と改善

### 設定後1週間で確認すること

| 確認項目 | 確認方法 | 期待値 |
|---------|---------|--------|
| GA4が動いているか | GA4リアルタイムレポート | アクセスが記録されている |
| Search Consoleが動いているか | Search Console > サマリー | 所有権が確認済み |
| sitemapが送信されたか | Search Console > サイトマップ | ステータスが「成功」 |

### 設定後2〜4週間で確認すること

| 確認項目 | 確認方法 | 期待値 |
|---------|---------|--------|
| インデックス数が増えたか | Search Console > ページ（カバレッジ） | 2〜3ページ → 主要ページ分に増加 |
| 検索キーワードが出てきたか | Search Console > 検索パフォーマンス | 何かしらのキーワードが表示される |
| サイトの表示速度 | PageSpeed Insights (https://pagespeed.web.dev/) | LCP 2.5秒以下が理想 |

### 表示速度の現状（2026-06-11 Lighthouse実測）

Lighthouse 12（モバイルエミュレーション・simulated slow 4G）での実測値:

| 指標 | 実測値 | Google推奨 |
|------|--------|-----------|
| Performanceスコア | **25/100** | 90以上 |
| FCP（最初の表示） | 20.3秒 | 1.8秒以下 |
| **LCP** | **49.3秒** | **2.5秒以下** |
| 総ページ重量 | 9.2MB | - |

※ これは低速回線を模したラボ値で、実際のWiFi/4Gでの体感はもっと短い。とはいえ総重量9.2MB（JSバンドルだけで圧縮前8.5MB）という構造上、どんな回線でもLCP 2.5秒合格はほぼ不可能な水準。

**ただし優先度に注意:** 表示速度の根本改善はBubbleの設定だけでは難しい。まずはこのガイドのStep 1〜3（メタ情報・sitemap・Search Console）= 無料で即日できる対策を完遂し、インデックス数の改善を実測するのが先（下記ロードマップ参照）。

### うまくいかないときは

| 症状 | 原因の可能性 | 対処法 |
|------|------------|--------|
| インデックスが増えない | sitemap・内部リンク等のディスカバリー問題（Step 1〜3の設定漏れ） | チェックリストを再確認。それでも増えなければプリレンダリング導入を検討（下記） |
| 検索に全く出ない | メタ情報が正しく設定されていない | [Google リッチリザルトテスト](https://search.google.com/test/rich-results)で確認 |
| GA4にデータが来ない | スニペットが正しく貼れていない | ブラウザの開発者ツール > Console でエラーを確認 |

### プリレンダリング（Prerender.io）の導入（2026-06-11更新）

Step 1〜3を完遂してもインデックスが伸びない場合の次の一手。クローラーにだけ、JSレンダリング済みの完全なHTML（本文・リンク入り）を返す仕組み。

- **方式:** Cloudflare Workerをドメインのフロントに置き、ボットのリクエストだけPrerenderへルーティングする公式手順がある（人間のアクセスは従来どおりBubbleへ）
- **所要時間:** 30〜45分。Cloudflare無料プランで可。**Bubble側のプラン変更は不要**（「Bubbleの上位プランが必要」という古いフォーラム情報は過去のもの）
- **料金（2025年10月改定 / 2026-06-11に公式料金ページで再確認済み）:** **無料プランは2025年10月15日に廃止**。現在はStarter $49/月（25,000レンダー）〜、Growth $149/月（100,000レンダー）。30日間の無料トライアルあり
- **注意:** 改善するのはクローラーから見えるHTMLだけで、**人間のユーザーの表示速度は1ミリ秒も変わらない**

（参考: Prerender.io公式 Bubble統合手順 https://docs.prerender.io/docs/bubble / 料金改定 https://docs.prerender.io/docs/changes-to-prerender-pricing ）

---

## 導入ロードマップ（段階導入の推奨）

いきなり外部サービスや別サイト構築に投資せず、無料の設定から始めて効果を実測してから次に進む。

```
Phase 1（今週・無料）: Bubbleネイティブ設定の完遂 = このガイドのStep 1〜4.5
  ├─ sitemap手動生成→Bubbleにアップロード（Step 2・自動生成は使わない）+ robots.txtにSitemap行
  ├─ canonical有効化 ← クエリパラメータ付きURLのインデックス汚染を止める（実害確認済み）
  ├─ ページ別title/meta description（店舗詳細はDB差し込みで店舗固有の文面に）
  ├─ og:imageを1200×630の専用画像に差し替え
  ├─ h1設定、noindex設定、構造化データ
  └─ Search Console登録 → インデックス数を実測

  ↓ 2〜4週間、Search Consoleでインデックス数・表示回数を計測してから投資判断
    （主因がディスカバリー問題なら、Phase 1だけで大きく改善する可能性が十分ある）

Phase 2（必要なら・$49/月〜）: Cloudflareをフロントに導入 + Prerender.io
  ├─ ボットに完全レンダリング済みHTMLを配信 → 本文・内部リンクの可視化
  └─ 副産物: Cloudflareがフロントに入ることでPhase 3の土台が完成

Phase 3（中期）: SEOコンテンツを自社ドメイン配下で配信
  ├─ まず増永さん側がClaude Codeで作り込んだ静的LP（HTML/CSS）を
  │  サブドメインで量産して様子見（6/30定例で決定・WordPress構築は保留）
  ├─ 地域×コース記事 + 初心者ガイド記事
  └─ 予約導線・店舗/エリアページはBubble本体（メタ情報設定でSEO最適化）へリンク
```

※ Phase 3の方式は6/30定例で更新: 当初はサブディレクトリ（rincle.co.jp/blog/）+WordPressを推奨していたが、サブディレクトリ同居に必要なリバースプロキシは**落ちるとブログもアプリも全滅する単一障害点**になり、弊社にBubble×WordPressでの運用実績がなく障害切り分けも難しいため、**当面は安全なサブドメイン配信で開始**。サブディレクトリとのSEO差は弊社が改めて洗い出して再判断する（詳細: blog-seo-strategy.md §6）。

---

## 用語集

| 用語 | 意味 |
|------|------|
| **SEO** | Search Engine Optimization。Googleで上位に表示されるようにすること |
| **クローラー** | Googleのロボット。Webサイトを巡回して情報を集める |
| **インデックス** | Googleのデータベースにサイトの情報が登録されること。登録されないと検索結果に出ない |
| **titleタグ** | ブラウザのタブに表示される文字。検索結果の青い文字 |
| **meta description** | 検索結果のタイトル下に表示されるグレーの説明文 |
| **OGP** | Open Graph Protocol。SNSでリンクを貼ったときに表示されるカードの情報 |
| **sitemap.xml** | サイトのページ一覧をまとめたファイル。Googleのロボットに「うちにはこんなページがあるよ」と教える |
| **robots.txt** | Googleのロボットへの指示書。「ここは見ていいよ」「ここは見ないで」を指定 |
| **Search Console** | Googleが無料で提供する「あなたのサイトがGoogleにどう見えているか」確認ツール |
| **GA4** | Google Analytics 4。サイトに来た人の行動を記録・分析する無料ツール |
| **canonical URL** | 「このページの正式URLはこれです」とGoogleに教えるタグ |
| **noindex** | 「このページは検索結果に載せないで」とGoogleに伝えるタグ。マイページ等の検索に出すべきでないページに設定する |
| **h1タグ** | ページの大見出し。Googleはこれを見て「このページの主題」を判断する |
| **alt属性** | 画像の代替テキスト。Googleが画像の内容を理解するために使う |
| **LCP** | Largest Contentful Paint。ページの一番大きな要素が表示されるまでの時間 |
| **直帰率** | エンゲージメントしなかったセッションの割合。GA4では旧アナリティクス（1ページだけ見て帰った割合）と定義が異なる |
| **CVR** | Conversion Rate。サイトに来た人のうち、予約まで完了した人の割合 |
| **プリレンダリング** | JSで動的に表示されるページを、事前にHTMLとして生成しておく技術。SEO対策に有効 |
| **Microsoft Clarity** | Microsoftが無料提供するユーザー行動可視化ツール。セッション録画・ヒートマップ・デッドクリック検出ができる |
| **セッション録画** | ユーザーがサイト上でどう操作したかを動画として記録・再生する機能 |
| **ヒートマップ** | ページのどこがよくクリックされているか、どこまでスクロールされているかを色（赤=多い/青=少ない）で可視化したもの |
| **デッドクリック** | ユーザーがクリックしたけど何も反応しなかった箇所。UIが分かりにくい証拠 |

---

## チェックリスト

設定が完了したら、以下を確認:

### メタ情報
- [ ] 全ページのtitleタグをキーワード入りの固有の文面に修正した（現状: 設定済みだがトップは「Rincle」のみ）
- [ ] 全ページのmeta descriptionをページ固有の文面に修正した（現状: 全ページ同一文面）
- [ ] og:imageを1200×630の専用画像に差し替えた（現状: アイコン流用）
- [ ] 各ページにh1タグを設定した
- [ ] 画像にalt属性を設定した
- [ ] 「Enable canonical url」のチェックボックスをONにした（Bubble-defined canonical url tagが出力される）
- [ ] 主要ページに構造化データ（BikeStore / Product+Offer / BreadcrumbList / FAQPage）を設定し、リッチリザルトテストで検証した
- [ ] noindex対象ページ（マイページ/予約履歴一覧/ログイン・会員登録/予約/パスワード再設定/加盟店申込/管理画面4ページ）のPage HTML Headerにnoindexを設定した
- [ ] index対象ページにnoindexが入っていないことを確認した
- [ ] アプリ全体がインデックス可能なことを確認した（公開ページのソースに意図しないnoindexが無い・robots.txtで全体をブロックしていない。2026-06-11更新）

### sitemap / robots.txt
- [ ] Data APIで shop / Bicycle を公開にチェックし、本番デプロイした（`sitemap-creation-guide.md` 手順2）
- [ ] `generate_sitemap.js` でsitemap.xmlを生成し、店舗数・自転車数がサイトの実数と合っていることを確認した
- [ ] 「Hosting files in the root directory」でsitemap.xmlをアップロードした（自動生成「Expose a sitemap file」はOFFのまま）
- [ ] https://rincle.co.jp/sitemap.xml でアクセスできることを確認した
- [ ] robots.txtに `Sitemap: https://rincle.co.jp/sitemap.xml` を追記した

### Search Console
- [ ] Google Search Consoleにプロパティを追加した
- [ ] サイトの所有権を確認した
- [ ] sitemapを送信した
- [ ] 主要ページのインデックス登録をリクエストした

### GA4
- [ ] GA4アカウントを作成した
- [ ] 測定ID（G-XXXXXXXXXX）を取得した
- [ ] Bubble.ioのheaderにGA4スニペットを貼り付けた
- [ ] リアルタイムレポートで動作確認した

### Microsoft Clarity
- [ ] クラリティのアカウントを作成した
- [ ] トラッキングコードを取得した
- [ ] Bubble.ioのheaderにクラリティのスニペットを貼り付けた
- [ ] ダッシュボードでセッション録画が表示されることを確認した

### 効果測定
- [ ] 1週間後: GA4とSearch Consoleが動作していることを確認
- [ ] 2〜4週間後: インデックス数の増加と検索キーワードの出現を確認
