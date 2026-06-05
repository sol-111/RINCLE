# RINCLE SEO設定ガイド

> 作成日: 2026-05-20
> 対象: SEO初心者向け。専門用語をできるだけ噛み砕いて説明

---

## そもそもSEOって何？

**SEO（Search Engine Optimization）= 検索エンジン最適化**

Googleで「ロードバイク レンタル 神戸」と検索したとき、RINCLEのサイトが上の方に出てくるようにすること。

上に出れば出るほど、広告費をかけずにお客さんが来る。逆に、検索結果に出なければ「存在しないのと同じ」。

### RINCLEの現状

```
Googleに認識されているページ: たった2ページ
「スポーツバイク レンタル」で検索: 圏外（表示されない）
「ロードバイク レンタル 神戸」で検索: 圏外（表示されない）
```

**つまり、今のRINCLEはGoogleから見てほぼ存在していない。**

---

## なぜこうなっているのか

RINCLEはBubble.io（ノーコードツール）で作られている。Bubble.ioで作ったサイトは、普通のサイトと違って「中身がJavaScriptで後から読み込まれる」構造になっている。

Googleのロボット（クローラー）がRINCLEのサイトを見に来ると:

```
普通のサイト:
  → HTMLにタイトル、説明文、料金、車種情報が全部書いてある
  → Googleが「このサイトはスポーツバイクのレンタルだな」と理解できる

RINCLEの現状:
  → HTMLがほぼ空っぽ（タイトルすらない）
  → 料金や車種はJavaScriptが動いた後に表示される
  → Googleが「このサイト、何のサイトか分からない」となる
```

---

## やるべきことの全体像

```
Step 1: Googleに「このサイトは何か」を教える（メタ情報の設定）
Step 2: Googleに「このサイトにはこんなページがあるよ」と教える（sitemap）
Step 3: Googleに「うちのサイトを見に来て」とお願いする（Search Console）
Step 4: サイトに来た人の行動を記録する（GA4）
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

  スポーツバイクをレンタル・試乗するならRINCLE｜全国のプロショップで安心体験  ← これがtitleタグ
  https://rincle.co.jp/                                                        ← これがURL
  全国24店舗のプロショップでロードバイク・E-Bikeをレンタル。                     ← これがdescription
```

**RINCLEの現状:** titleタグが設定されていない（空欄）

**設定すべき内容:**

| ページ | titleタグの例 |
|--------|-------------|
| トップページ | スポーツバイクをレンタル・試乗するならRINCLE｜全国のプロショップで安心体験 |
| 店舗一覧 | 店舗一覧｜RINCLE - スポーツバイクレンタル |
| 店舗詳細（例: 神戸） | スペシャライズド神戸｜ロードバイク・E-Bikeレンタル｜RINCLE |
| 車種一覧 | レンタルできる車種一覧｜RINCLE - スポーツバイクレンタル |
| 料金 | 料金プラン｜RINCLE - スポーツバイクレンタル |
| はじめての方へ | はじめての方へ｜RINCLEの使い方ガイド |
| 会員登録 | 無料会員登録｜RINCLE - スポーツバイクレンタル |

**ルール:**
- 30〜60文字が目安（長すぎると途中で切れる）
- ページの内容を表すキーワードを前の方に入れる
- 全ページに「RINCLE」を含める（ブランド認知）
- ページごとに違うタイトルにする（全ページ同じはNG）

**Bubble.ioでの設定方法:**
1. Bubble.ioエディタを開く
2. 対象のページを選択
3. 左メニュー「Appearance」→「Page title」に入力

### 1-2. meta description（ページの説明文）

**これは何？**
Googleの検索結果で、タイトルの下に表示されるグレーの説明文。

**RINCLEの現状:** 設定されていない

**設定すべき内容:**

| ページ | meta descriptionの例 |
|--------|---------------------|
| トップページ | 全国24店舗のプロショップでロードバイク・E-Bikeをレンタル。プロの整備で安心、ネットで簡単予約。初めてのスポーツバイク体験にも最適です。 |
| 店舗一覧 | RINCLEのパートナーショップを検索。東京・神戸・福岡など全国12都府県24店舗から、最寄りの店舗を見つけてスポーツバイクをレンタルできます。 |
| 店舗詳細（例: 神戸） | スペシャライズド神戸でロードバイク・E-Bikeをレンタル。JR神戸駅から徒歩3分。プロスタッフが初心者にも丁寧にサポートします。 |

**ルール:**
- 70〜120文字が目安
- そのページに何が書いてあるかを具体的に書く
- 「全国24店舗」「プロショップ」等の差別化ポイントを入れる
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
  │ スポーツバイクをレンタル...     │
  │ 全国24店舗のプロショップで...   │
  └─────────────────────┘
```

**RINCLEの現状:** 設定されていない（リンクを貼ってもカードが表示されない）

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
<meta property="og:title" content="スポーツバイクをレンタル・試乗するならRINCLE">
<meta property="og:description" content="全国24店舗のプロショップでロードバイク・E-Bikeをレンタル。">
<meta property="og:image" content="https://rincle.co.jp/og-image.png">
<meta property="og:url" content="https://rincle.co.jp/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="RINCLE">
```

### 1-4. h1タグ（見出し）

**これは何？**
そのページで一番大きな見出し。Googleは「h1タグに書いてある内容 = このページのメインテーマ」と判断する。

**RINCLEの現状:** h1タグがない（Googleがページのテーマを判断できない）

**設定すべき内容:**

| ページ | h1タグの例 |
|--------|-----------|
| トップページ | 全国のプロショップでスポーツバイクをレンタル |
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
- バナー画像: 「RINCLEでスポーツバイクをレンタル」

**Bubble.ioでの設定方法:**
1. 画像要素を選択
2. 「Appearance」→ 「Alt text」に入力

### 1-6. canonical URL

**これは何？**
「このページの正式なURLはこれです」とGoogleに教えるもの。

例えば、同じページに以下の複数URLでアクセスできる場合:
```
https://rincle.co.jp/shop_detail/12345
https://rincle.co.jp/shop_detail/12345?ref=top
https://rincle.co.jp/shop_detail/12345#section1
```
Googleは「これは別々のページ？同じページ？」と迷う。canonicalを設定すると「全部同じページです。正式URLはこれです」と伝えられる。

**Bubble.ioでの設定方法:**
1. Settings > SEO/metatags > Script/meta tags in header に以下を追加:

```html
<link rel="canonical" href="https://rincle.co.jp/（ページのパス）">
```

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
Googleロボット: 「sitemapを見たら24店舗分のページと車種ページがあるんだな。
                全部見に行こう」
```

### sitemapの中身（イメージ）

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://rincle.co.jp/</loc>
    <lastmod>2026-05-20</lastmod>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://rincle.co.jp/shop_list</loc>
    <lastmod>2026-05-20</lastmod>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>https://rincle.co.jp/shop_detail/specialized-kobe</loc>
    <lastmod>2026-05-20</lastmod>
    <priority>0.7</priority>
  </url>
  <!-- 他のページも同様に追加 -->
</urlset>
```

### sitemapに登録するURL一覧

sitemapには**サイト内の全ページ**のURLを登録する。

```
静的ページ（固定）:
  /                  トップページ
  /shop_list         店舗一覧
  /bike_list         車種一覧
  /search            検索
  /beginner          はじめての方へ
  /pricing           料金
  /faq               よくある質問
  /register          会員登録
  /contact           お問い合わせ
  /terms             利用規約
  /privacy           プライバシーポリシー
  → 計11ページ（固定で書く）

動的ページ（データに応じて増える）:
  /shop_detail/specialized-kobe    店舗詳細 × 店舗数分
  /shop_detail/specialized-kyoto
  /shop_detail/winds-bikes
  ... 全24店舗分（今後100店舗になったら100URL）

  /bike_detail/specialized-allez   車種詳細 × 車種数分
  /bike_detail/trek-domane-al2
  /bike_detail/giant-escape-r3
  ... 全車種分
```

例えば店舗100 + 車種200の場合:
```
静的ページ:    11 URL
店舗詳細:     100 URL
車種詳細:     200 URL
──────────────
合計:         311 URL → 全部sitemapに登録する
```

### 各タグの意味

| タグ | 意味 | 設定例 |
|------|------|--------|
| `<loc>` | ページのURL | `https://rincle.co.jp/shop_detail/specialized-kobe` |
| `<changefreq>` | 更新頻度のヒント | daily / weekly / monthly / yearly |
| `<priority>` | サイト内での重要度（0.0〜1.0） | トップ=1.0、店舗詳細=0.8、規約=0.2 |

### RINCLEの現状

```
https://rincle.co.jp/sitemap.xml → 404エラー（存在しない）
```

### 作成方法

**方法A: Bubble.ioプラグインを使う（推奨）**

店舗や車種が増えるたびに手動でURLを追加するのは現実的ではない。Bubble.ioのプラグインを使えば、DBのデータから自動生成される。

1. Bubble.ioのプラグインストアで「SEO」「sitemap」で検索
2. 「Simple Sitemap」等のプラグインをインストール
3. プラグインの設定でページ一覧を登録
4. 自動的に `/sitemap.xml` が生成される

**方法B: 手動で作成してホスティング**
1. 上のXMLの例を参考に、全ページのURLを列挙したファイルを作成
2. `sitemap.xml` という名前で保存
3. Bubble.ioのファイルマネージャーにアップロード、またはCloudflare等の外部サービス経由で配信

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

**Bubble.ioでの設定方法:**
1. Settings > SEO/metatags > robots.txt に上記を入力

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
- トップページ、店舗一覧、主要な店舗詳細ページを最低限リクエスト

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

※ `G-XXXXXXXXXX` の部分を、Step 3で取得した自分の測定IDに置き換える

方法B: Bubble.ioのGA4プラグインを使う
1. プラグインストアで「Google Analytics」を検索
2. インストール後、測定IDを入力

**5. 動作確認**
- GA4の「リアルタイム」レポートを開く
- 別のブラウザやスマホでrincle.co.jpにアクセス
- リアルタイムレポートに「アクティブユーザー: 1」と表示されればOK

### GA4で見るべき指標

| 指標 | 場所 | 何が分かるか |
|------|------|------------|
| ユーザー数 | レポート > ユーザー属性 | 何人来ているか |
| 流入元 | レポート > 集客 > トラフィック獲得 | Google検索/SNS/直接/広告のどこから来ているか |
| ページ別閲覧数 | レポート > エンゲージメント > ページとスクリーン | どのページが人気か、どこで離脱しているか |
| 直帰率 | 同上 | サイトに来てすぐ帰った人の割合 |
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
| インデックス数が増えたか | Search Console > ページ（カバレッジ） | 2ページ → 主要ページ分に増加 |
| 検索キーワードが出てきたか | Search Console > 検索パフォーマンス | 何かしらのキーワードが表示される |
| サイトの表示速度 | PageSpeed Insights (https://pagespeed.web.dev/) | LCP 2.5秒以下が理想 |

### うまくいかないときは

| 症状 | 原因の可能性 | 対処法 |
|------|------------|--------|
| インデックスが増えない | Bubble.ioのJSレンダリング問題 | プリレンダリング（prerender.io等）の導入を検討 |
| 検索に全く出ない | メタ情報が正しく設定されていない | [Google リッチリザルトテスト](https://search.google.com/test/rich-results)で確認 |
| GA4にデータが来ない | スニペットが正しく貼れていない | ブラウザの開発者ツール > Console でエラーを確認 |

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
| **h1タグ** | ページの大見出し。Googleはこれを見て「このページの主題」を判断する |
| **alt属性** | 画像の代替テキスト。Googleが画像の内容を理解するために使う |
| **LCP** | Largest Contentful Paint。ページの一番大きな要素が表示されるまでの時間 |
| **直帰率** | サイトに来て、1ページだけ見てすぐ帰った人の割合 |
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
- [ ] トップページにtitleタグを設定した
- [ ] トップページにmeta descriptionを設定した
- [ ] 全ページにtitleタグを設定した
- [ ] 全ページにmeta descriptionを設定した
- [ ] OGP（og:title / og:description / og:image）を設定した
- [ ] 各ページにh1タグを設定した
- [ ] 画像にalt属性を設定した
- [ ] canonical URLを設定した

### sitemap / robots.txt
- [ ] sitemap.xmlを生成した
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
