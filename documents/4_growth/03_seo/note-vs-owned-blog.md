# note vs 自社ドメインブログ SEO比較調査

> タスク#24 / 2026-06-12調査 / 次回定例の報告用
> 背景: 増永さんの「地域ごとのサイクリングコースLP/ブログで集客したい」構想（6/12定例 19:08〜24:48）。弊社仮説「短期=note / 長期=自社ドメイン」の検証
> 関連: [seo-setup-guide.md](seo-setup-guide.md)（Phase 3 サブディレクトリ構想）/ [action-plan.md](../01_strategy/action-plan.md)（T2-4 SEO LP）

---

## 結論サマリー

**仮説「短期=note / 長期=自社ドメイン」は、そのままでは成立しない。修正が必要。**

理由は1つに尽きる: **noteで貯めたSEO評価は、後から自社ドメインに移せない**（無料版noteにはリダイレクト機能がなく、評価はnote.comドメインに帰属したまま。詳細は§4）。つまり「まずnoteで始めて、育ったら自社に引っ越す」という連続的なモデルは、引っ越しの瞬間に検索評価がゼロリセットされる。

修正後の推奨は **「移行」ではなく「最初から分業併用」**:

| 役割 | 置き場所 | 理由 |
|------|---------|------|
| **SEO資産**（「ロードバイク レンタル 名古屋」「しまなみ海道 レンタサイクル」等を狙う地域×コース記事） | **初日から自社サブディレクトリ**（rincle.co.jp/blog/ 等） | 検索評価をrincleドメインに蓄積する。後から移せない以上、最初からここに書くしかない |
| **拡散・ブランド用**（運営の想い・店舗ストーリー・イベントレポ） | **note（無料版）** | note.comの集客力とSNS拡散に乗る。検索資産にする必要がないコンテンツ |

増永さんの「どっちもやっていかないとダメなんでしょうね」は結果的に正しい。ただし「両方で同じことをやる」のではなく、**役割を分けて両方やる**のが定石（§5）。

---

## 1. noteのSEO実態

### 強さの実態

- noteはドメイン評価が高く、公開直後でも検索流入が得られやすい。自社サイトより早く順位がつくケースもある（出典: [LeadGrid](https://goleadgrid.com/blog/ownedmedia-note) / [東京SEOメーカー](https://www.switchitmaker2.com/sns/note-seo/)）
- 会員数777万人（2024年時点）・膨大な記事数により、Googleから「専門性・情報量のあるドメイン」と評価されている（出典: [note SEO解説記事](https://note.com/alpaka_ai/n/nbcf99684616a)）
- note運営者の個人報告では「流入の約40%が検索経由」という例もある（出典: [note記事](https://note.com/kobayashinokizi/n/nc049e668980a)。個人の一事例であり一般化はできない点に注意）

### 限界

- プラットフォーム依存のため、**個別のSEO対策の自由度がない**: HTMLタグのカスタマイズ・構造化データ・デザイン変更・カテゴリ設計などが不可（出典: [wizblog](https://wizblog.jp/note-seo/)）
- カスタマイズ性が低く差別化が困難。note内でできるSEO対策はタイトル・ハッシュタグ・本文品質程度（出典: [Strategy by ipe](https://ipeinc.jp/media/note-seo/)）

### SEO価値は誰のものか（重要）

- **無料版・noteプレミアム（月500円）では独自ドメイン不可**。記事URLは `note.com/アカウント名/n/xxxx` であり、**検索評価はすべてnote社のドメインに帰属する**。独自ドメイン適用はnote pro限定（出典: [noteヘルプ「独自ドメインの適用をすることはできますか」](https://www.help-note.com/hc/ja/articles/900000581406)）
- コンテンツの所有者はnote社側であり、サービス終了時には掲載コンテンツが削除されるリスクがある（出典: [LeadGrid 2023-03](https://goleadgrid.com/blog/ownedmedia-note)）

### note proの現行プラン（2026年6月時点）

| 項目 | 内容 |
|------|------|
| 基本料金 | **月払い 80,000円/月（税抜）・年払い 880,000円/年（税抜）**、初月無料 | 
| 料金の経緯 | 2023年3月に50,000円/月→80,000円/月へ改定済み（古い記事の「月5万円」は旧料金なので注意） |
| 独自ドメイン | **適用可能（note proの標準機能）**。既存の自社ドメインのサブドメイン利用も可。ドメイン自体は自分で取得する必要あり |
| 主な有料オプション | Googleアナリティクス 月10,000円（税抜）・SmartNews外部配信 月20,000円（税抜）等。**GA等の一部機能は独自ドメイン適用が前提** |

出典: [noteヘルプ「note proの基本料金と支払い方法」](https://www.help-note.com/hc/ja/articles/900000576123) / [noteとnote proの機能一覧（2026/01/15更新）](https://www.help-note.com/hc/ja/articles/360000621702) / [ユニークワン解説](https://unique1.co.jp/column/public-relations/7158/)

→ 月8万円はRINCLEの収益規模（予約1件≒¥1,530の売上）に対して**月52件分の予約に相当**し、現段階では割に合わない。

### 外部リンクの扱い（rincle.co.jpへの誘導効果）

- **noteに設置したすべてのリンク（記事本文・プロフィール・つぶやき）にnofollow属性が自動付与される**。リンク先（rincle.co.jp）への直接的なSEO評価の受け渡しは限定的（出典: [mesut 2025-12-15公開・2026-04-05更新](https://mesut.co.jp/backlink-note/) / [COUNTER](https://counter-digital.jp/counter-media/note-backlink/)）
- ただしGoogleは2019年9月以降nofollowを「命令」でなく「ヒント」として扱うため効果ゼロとは言い切れず、またリンクをクリックした人間のトラフィック・サイテーション（言及）効果は普通にある（出典: 同上）

---

## 2. 自社ドメイン側の実現方式の比較

### Googleの見解と通説（2026年時点）

- **Google公式の立場: サブドメインとサブディレクトリは「本質的に同等」**（John Mueller「subdomains and subdirectories are essentially equivalent. You can put your content however you want」。出典: [Search Engine Journal](https://www.searchenginejournal.com/google-treats-subdomains-subdirectories-john-mueller-says/254687/)）。Muellerは「特にこだわりがなければサブディレクトリで同一サイトにまとめてよい」「サブドメインはクロールの学習に短い調整期間が要る」とも発言
- **実務レベルではサブディレクトリ優位の報告が根強い**: サブドメインは別サイト扱いされる傾向があり、本体ドメインの評価に寄与しにくいケースがある。Backlinkoの1,180万件の検索結果分析でもサブディレクトリが競合KWで優位（出典: [ignitevisibility](https://ignitevisibility.com/why-blogs-on-subdomains-are-basically-worthless-for-seo/) / [国内解説](https://mieru-ca.com/blog/subdomain/)）
- 国内SEO各社の使い分け基準: **テーマの関連性が高いコンテンツ（同じ事業のブログ）はサブディレクトリ、独立サービス（採用・EC等）はサブドメイン**。本体のドメインパワーが弱いうちは、評価を1カ所に集めるサブディレクトリ推奨（出典: [stock-sun](https://stock-sun.com/column/subdomain-seo/) / [grannet](https://grannet.co.jp/column/seo-subdomain)）

RINCLEは現状インデックス2〜3ページの弱小ドメイン（seo-setup-guide実測）なので、**評価を分散させるサブドメインを選ぶ理由がない**。

### 3方式の比較

| 方式 | SEO | 技術難度 | RINCLE評価 |
|------|-----|---------|-----------|
| ① サブドメイン（blog.rincle.co.jp） | 別サイト扱いの傾向。本体に評価が貯まりにくい | 低（DNS設定のみ） | △ 次善策 |
| ② **サブディレクトリ（rincle.co.jp/blog/）** | **本体ドメインに評価集約。実務報告で優位** | 中（リバースプロキシが必要） | **◎ 推奨** |
| ③ 別ドメイン | ゼロから育成。最も不利 | 低 | × 選ぶ理由なし |

### ②の技術的可否 — Bubble本体と別システムの同居

**結論: Cloudflare Workerのリバースプロキシ（パスルーティング）で実現可能。実例・手順ガイドが複数存在する（事実）。**

- Bubble本体はそのまま、`rincle.co.jp/blog/*` へのリクエストだけ外部のブログ（Ghost/WordPress/静的サイト）にWorkerで振り分ける構成。Ghost CMS+Bubbleの完全手順ガイドあり（出典: [Ghost CMS x Bubble: /blog subfolder using Cloudflare Workers](https://blog.hackerhouse.world/ghost-cms-bubble-blog-subfolder-cloudflare-workers/)）
- Bubble公式フォーラムにも「SEOのためサブドメインでなくサブフォルダでCMSを同居させた」事例スレッドが複数（出典: [Bubble Forum 1](https://forum.bubble.io/t/blog-seo-ghost-wordpress-or-any-cms-on-subfolder-blog-with-bubble/121411) / [Bubble Forum 2](https://forum.bubble.io/t/solved-new-more-eyes-on-website-improve-seo-with-cloudflare-subfolder-instead-of-subdomain/180078)）
- **注意点（事実）**: Bubble自体がCloudflareインフラに移行しているため、DNSをA/AAAAレコードで向けているとWorkerがバイパスされる場合があり、BubbleにCNAMEレコードを依頼する回避策が報告されている（出典: 上記Bubble Forumスレッド）。→ rincle.co.jpの現DNS構成の確認が必要（未確認事項へ）
- この構成は、seo-setup-guideのPhase 2（Prerender.io用にCloudflareをフロントに置く）と**同じ土台**。Phase 2を先にやればPhase 3（サブディレクトリ配信）の基盤がそのまま使える、という既存ロードマップと整合する

---

## 3. CMS・運用コストの比較

| 選択肢 | 初期費用 | 月額 | 保守の手間 | 備考 |
|--------|---------|------|-----------|------|
| **レンタルサーバー+WordPress** | ほぼゼロ（有料テーマ買うなら1〜2.5万円） | **600〜1,100円程度**（エックスサーバー693円〜・ConoHa WING 660円〜、2026年6月時点のキャンペーン価格） | **中**: コア/プラグイン更新・バックアップ・セキュリティ対応が継続的に必要 | 記事執筆者にとって最も馴染みやすい管理画面。情報量最多 |
| **ヘッドレスCMS+静的サイト**（microCMS+Astro+Cloudflare Pages） | 構築に開発工数（弊社対応可） | **ほぼゼロ**: microCMS Hobbyプランは無料・商用利用可（有料はTeam 4,900円/月〜）。Cloudflare Pagesホスティング無料 | **小**: サーバー保守不要。表示が最速でLCP1秒以下を狙える | seo-setup-guide Phase 3の構成。執筆はmicroCMSの管理画面から非エンジニアでも可 |
| **STUDIO** | ゼロ | Starter 1,480円/月（月払い）〜、CMS機能は上位プラン | 小 | **サブディレクトリ同居が不可（独自ドメイン/サブドメインのみ）のため今回の目的には不向き** |
| **note（無料）** | ゼロ | ゼロ | 最小 | ドメイン資産は貯まらない（§1） |

出典: [エックスサーバー料金解説](https://www.xserver.ne.jp/blog/server-total-cost/) / [ConoHa WING料金](https://www.conoha.jp/pricing/) / [microCMS料金](https://microcms.io/pricing/)（2025年6月10日にプラン改定済み・Hobby/Team/Business/Enterpriseの4階層） / [STUDIO料金](https://studio.design/ja/pricing)

→ 金額はどれも誤差レベル（月0〜1,100円）。**差が出るのは保守の手間と表示速度**で、Bubble本体がLCP49秒という弱点を抱えるRINCLEにとって、ブログ側が高速（静的サイト）であることはSEO上の強みになる。

---

## 4. 「note→後で自社に移す」の落とし穴（仮説の核心・必ず押さえる）

**結論: noteで貯めた検索評価は、自社ドメインへ移転できない（無料版では）。これが仮説「短期note→長期自社」を不成立にする。**

1. **note無料版にはリダイレクト設定機能がない**（事実）。noteヘルプにそのような機能は存在せず、note.comのサーバー側で301リダイレクトを打つ手段がユーザーに提供されていない。SEO評価の引き継ぎには301リダイレクトが必要であり、それができない以上、移転先の記事は検索エンジンから見て「新規記事」扱いになる（リダイレクトとSEO評価の関係の出典: [301リダイレクト解説](https://lucy.ne.jp/bazubu/301redirect-seo-41094.html)）
2. noteはHTML編集も不可のため、JavaScript/meta refreshによる擬似リダイレクトすら設置できない（そもそもこれらは301と違いSEO評価を引き継がない。出典: [サイト引越し屋さん](https://site-hikkoshi.com/1614/)）
3. 移転=記事の手動コピーになるが、note側の元記事を残すと**重複コンテンツ問題**が起きる。noteではcanonicalも設定できないため、ドメインの強いnote側が「オリジナル」、自社側が「コピー」と判定されるリスクがある（推測だが、重複コンテンツの一般的な評価メカニズムから蓋然性が高い）。回避にはnote側の記事削除が必要で、その瞬間にnoteで得た検索流入は消える
4. **唯一の例外: note proの独自ドメイン適用**。適用すると、それまでのnote.com配下のページは新ドメインへ自動リダイレクトされる（出典: [note pro公式 2020-08](https://biz.note.com/n/nbed55cfa0256)）。ただし (a) 月8万円（税抜）が前提、(b) **note pro解約後もこのリダイレクトが維持されるかは公開情報なし** — note.com側のURLはnote社の管理下なので、解約後は維持されないリスクが高いと思われる（推測）

つまり「noteを育ててから自社へ」は、**note proに月8万円を払い続ける場合にのみ部分的に成立する**特殊ルートであり、RINCLEの規模では現実的でない。SEO資産にしたい記事は最初から自社ドメインに書くしかない。

---

## 5. 併用パターンの設計（定石）

- noteをオウンドメディアとして利用する企業は3万社以上あり、**自社メディアとの併用時は「コンテンツの内容とターゲットを明確に分ける」のが定石**。分けないと自社サイト側のSEOと食い合う（カニバリ・重複）リスクが指摘されている（出典: [comnico note企業活用ガイド2025](https://www.comnico.jp/we-love-social/note_matome) / [東京SEOメーカー](https://www.switchitmaker2.com/webmarketing/note-ownedmedia/)）
- 典型的な使い分け: **自社ブログ=検索KWを狙うSEO資産（自由なSEO設計が可能）/ note=初動の露出・ストーリー訴求・ファン形成**（出典: [LeadGrid](https://goleadgrid.com/blog/ownedmedia-note)）
- 導線設計: SNS→note→自社サイト（CV）という流れを作りやすいのがnoteの利点（出典: [QUERYY](https://n-works.link/blog/marketing/note-is-recommended-for-owned-media)）

---

## RINCLEへの推奨

### 実現方式

1. **地域×コース記事（SEO資産）= 自社サブディレクトリ一択**: `rincle.co.jp/blog/`（または `/areas/`）に、Cloudflare Workerのパスルーティングで静的サイト（Astro+microCMS）を同居させる。月額コストほぼゼロ・保守最小・表示最速。seo-setup-guide Phase 2/3のCloudflare導入と土台を共有できる
   - CMSはmicroCMS（無料・日本製・非エンジニアでも記事投稿可）を第一候補、増永さん側がWordPress管理画面に強いこだわりがあればWP（月1,100円程度+保守）も可
2. **note = 無料版で開設し、拡散・ブランド用に限定**: 運営の想い、神戸店のようなアクティブ店舗のストーリー、イベントレポなど。記事末尾からrincle.co.jpへ誘導（nofollowだが人間のトラフィックは流れる）。本体サイトのトピックス欄にnoteサムネイルを置く案（6/12定例での瀬野提案）はこの用途で有効
3. **同じ記事を両方に置かない**（重複コンテンツ回避）。KWを狙う記事は自社側だけに書く

### 始め方と順序

- **前提が先**: DB再構築完了（6月末目安）→ SEO基盤一式（#21-22: sitemap・canonical・Search Console・GA4）→ Cloudflareフロント導入 → サブディレクトリブログ構築、の順。ブログだけ先行しても本体の受け皿が壊れたままでは効果が半減する
- 構築を待つ間も**記事の書き溜めは今日から可能**（md等で原稿化しておき、CMS完成後に一括投入）。noteは技術的前提がないので即日開始できる
- 記事の優先KWはaction-plan T2-4の通り: 最優先「観光ルート名×レンタサイクル」（しまなみ海道・ビワイチ等）、次点「都市名×ロードバイク レンタル」（名古屋・東京・神戸）。**「スポーツバイク」軸の文言は使わない**（6/12確定）
- 月数本ペースなら、1本目は加盟店が実在する地域×実走できるコース（例: 神戸エリア）から。店舗（浜田さんのような現場の動きがある店）からコース情報を吸い上げる体制が記事品質の鍵になると思われる
- デザインは凝らなくてよい: 記事テンプレ1種（コース概要・マップ・立ち寄りスポット・レンタル導線）を最初に設計し量産する形を推奨

### note proについて

月8万円（税抜）は予約52件/月分に相当し、現フェーズでは非推奨。将来、note上での発信が大きく育ち独自ドメイン化したくなった場合にのみ再検討。

---

## 未確認事項・増永さんへの確認点

| # | 項目 | 内容 |
|---|------|------|
| 1 | **rincle.co.jpのDNS構成** | Cloudflare Workerルーティングの可否はDNSレコード形式（A/CNAME）に依存。Bubble側の制約があるため、DB再構築後に弊社で技術検証が必要（§2の注意点） |
| 2 | note pro解約後のリダイレクト維持 | 公開情報なし。note proを検討する場合のみnote社へ要問い合わせ |
| 3 | **記事の書き手は誰か** | 運営（増永さん）/ 加盟店（神戸店等）/ 外注ライター。月数本の継続体制をどう組むか → 次回定例で要相談 |
| 4 | 地域の優先順位 | 増永さん構想は名古屋・東京だが、SEO的には「加盟店が実在し・観光ルートKWの実需がある」地域（しまなみ・神戸等）が先ではないか → 要すり合わせ |
| 5 | noteアカウントの開設名義・運用者 | 無料なので先行開設してよいが、誰が投稿を続けるか |
| 6 | 店舗数の対外表記 | ブログ記事内で店舗数に言及する場合は確認リスト#7（公式24店/DB54店）の決着待ち |

---

*調査実施: 2026-06-12 / 一次情報はいずれも2026年6月時点で確認。note pro料金等は変動しうるため、意思決定時に [noteヘルプセンター](https://www.help-note.com/hc/ja/articles/900000576123) で最新を再確認のこと。*
