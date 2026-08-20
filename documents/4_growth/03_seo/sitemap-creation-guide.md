# sitemap.xml 作成手順

## 前提: なぜ手作業で作るのか

sitemap.xmlは「このサイトにはこんなページがあります」とGoogleに伝える一覧ファイル
RINCLEのページはほとんどが「店舗詳細」「自転車詳細」
- 店舗: `https://rincle.co.jp/shop_detail?shop=<店舗ID>`
- 自転車: `https://rincle.co.jp/bicycle_detail?bicycle=<自転車ID>`

Bubbleには「sitemapを自動で作る機能」があるが、それでデータごとのURLが自動で載るのは「ページとデータの種類を直接ひも付けた作り」の場合だけ。
新サイトはひも付けない作り（`?shop=` のようにURLの後ろにIDを付ける方式）なので、**自動生成では店舗・自転車の1件1件のURLが載らない**。
そのため、ID一覧を自分たちで集めてsitemap.xmlを組み立てる。

必要な材料は2つ
1. **ページの種類の一覧** → bubbleファイル（アプリの設計データ）から洗い出す（手順1）
2. **店舗・自転車のID一覧** → Data APIで取得する（手順2）

## sitemapに載せるページ / 載せないページ

Bubble設定（`sitemap_pages`）で既に選定済みの5ページに合わせる:

| 載せる | URL | 優先度の目安 |
|---|---|---|
| トップ | `/` | 1.0 |
| 検索 | `/search`（条件パラメータなしの素のURL） | 0.9 |
| 店舗詳細 | `/shop_detail?shop=<ID>` × 店舗数 | 0.8 |
| 自転車詳細 | `/bicycle_detail?bicycle=<ID>` × 台数 | 0.7 |
| 規約・ポリシー | `/legal` | 0.2 |

| 載せない | URL | 理由 |
|---|---|---|
| ログイン・会員登録 | `/signin` | 機能ページ。検索から来てもらう価値がない |
| マイページ | `/mypage` | ログイン後の個人情報ページ。検索結果に出してはいけない |
| 予約 | `/reservation` | 予約フロー途中のページ。検索流入は不要 |
| 予約履歴一覧 | `/user_reservation_list` | ログイン後の個人情報ページ |
| パスワード再設定 | `/reset_pw` | 機能ページ |
| 加盟店申込フォーム | `/shop_form` | 招待経由で使うページ。一般公開の入り口ではない |
| 管理画面（4ページ） | `/admin` `/admin_signin` `/admin_price_simulation` `/admin_update_calendar` | 運営・店舗の内部ページ |
| エラー・メンテ画面 | `/404` `/maintenance` | 案内用のページで中身がない |

---

## 手順1. bubbleファイルの用意（ページの種類を洗い出す）

▼ bubbleファイル
Bubbleアプリの設計図まるごと1つのファイル（中身はJSON）
ページ一覧・SEO設定・データベースの構造がすべて入っている

1. Bubbleエディタを開く
2. 左メニューの Settings > General にある「Export this application」からファイルを書き出す
3. このリポジトリの `documents/rincle.bubble` に置く

## 手順2. Data APIの設定（店舗・自転車のID一覧を取る）

▼ Data API
画面を開かなくても、プログラムからデータベースの中身を一覧でもらえる窓口
これを使うと店舗・自転車の全IDが数回の通信で取れる

▼ 別のやり方: 画面を巡回して集める方法もある
本番サイトの検索画面を都道府県ごとに自動で開き、表示された店舗・自転車を1件ずつ拾ってIDを集めるやり方
Data APIが使えない状況の予備手段になる

### 2-1. Bubble側の設定（1回だけ・要Bubbleエディタ）

入り口のスイッチ（Enable Data API）は既にONになっている。足りないのはデータの種類ごとの公開チェックだけ

1. Bubbleエディタ → Settings > API タブを開く
2. 「Enable Data API」の下にあるデータ種類の一覧で、**`shop` と `Bicycle` の2つだけ**にチェック
3. **本番に反映（デプロイ）する** 

### 2-2. 取得の仕方

```bash
# 店舗一覧（1回につき最大100件）
curl "https://rincle.co.jp/api/1.1/obj/shop?limit=100"

# 自転車一覧。100件を超える分は cursor で続きを取る（100, 200, 300…）
curl "https://rincle.co.jp/api/1.1/obj/bicycle?limit=100&cursor=100"
```

返ってくるJSONの `response.results` に1件ずつのデータ（`_id` が店舗ID/自転車ID）、`response.remaining` に残り件数が入る
remainingが0になるまでcursorを進める。

## 手順3. sitemap.xmlを生成する

同じフォルダの `generate_sitemap.js` が手順2の取得〜XML組み立てまで全部やる:

```bash
node documents/4_growth/03_seo/generate_sitemap.js
# → documents/4_growth/03_seo/sitemap.xml が出力される
```

スクリプトがやっていること

1. Data APIから店舗・自転車の全件を取得（cursorを進めながら）
2. サイトに出ていないものを除外 — 店舗: 削除済み（`deleted_at`）・審査未通過（`brand_status` が passed 以外）/ 自転車: 削除済み・アーカイブ済み（`__is_archive`）・ユーザー非表示（`rental_status`）
3. 静的3ページ + 店舗 + 自転車のURLを並べたXMLを出力

本番反映前に動きを試したい時は `--dev` を付けると開発版（version-test）のData APIで動く
**生成後の確認**: 出力された店舗数・自転車数が、本番サイトの検索で見える数とだいたい合っているか見る
大きくズレたら除外条件（削除・アーカイブの判定）が実態と合っていないので要調査

## 手順4. 公開とGoogleへの登録

作ったsitemap.xmlは、Bubbleの機能でそのまま `rincle.co.jp/sitemap.xml` に置ける。

▼ Search Console
Googleが無料で提供している「自分のサイトがGoogleにどう見えているか」の管理画面
検索結果に何ページ登録されたか・どんな検索語で表示されたか・エラーがないかが見られる
RINCLEはまだ導入していない（導入は別タスク#21-22。サイトの所有者確認などの初期設定が必要）

▼ なぜ「送信」するのか
sitemap.xmlをサイトに置いただけだと、Googleが自分で気づくのを待つことになる
Search Consoleから送信すると「ここに一覧表を置いたので読みに来て」とGoogleに直接知らせられる（待つより確実で早い）

1. Bubbleエディタ → Settings > SEO / metatags タブの「**Hosting files in the root directory**」を開く
2. File name に `sitemap.xml`、File に手順3で作ったファイルをアップロードして Save
3. `https://rincle.co.jp/sitemap.xml` で中身が見えることを確認
4. Search Console導入後、左メニューの「サイトマップ」を開き、「新しいサイトマップの追加」の入力欄に `sitemap.xml` と打って送信ボタンを押す
5. 同じ画面のステータスが「成功しました」になるか、読み込んだURL数が表示されれば、Googleに受け取ってもらえている

注意すること
- ファイルは**バージョンごと**の扱い（Bubble画面の説明文より）。本番で見えない場合はどのバージョンにアップしたかを確認
- ファイル名はアプリのページ名と重複してはいけない（`sitemap.xml` なら問題なし）
- Bubble標準のsitemap自動生成（Settings > SEO/metatags の「Expose a sitemap file」）は**OFFのまま**にする。ONにすると同じ `sitemap.xml` の場所を取り合ってしまう