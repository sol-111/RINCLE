# html-doc-design スキル 初見技術レビュー（コミット e0edb3a・2026年9月4日）

レビュー日: 2026年9月14日 / 対象: `.claude/skills/html-doc-design/`（24ファイル・+4139/-125行）
やったこと: 5点セットのクラス名機械突合 / template.css の変数・重複セレクタ走査 / lint.py へ自作テストHTML 30本 / Playwright 描画（gallery・snippets・新部品・章ナビ 3〜7項目 × 720/760/1280px）/ shoot.mjs の README どおりの実行 / shell.html の操作テスト / decisions.md と SKILL.md の突合。
**元ファイルは一切編集していない。** 検証用HTMLは `scratchpad/review2/t/` に置いた。

---

## ① 不具合

| 重要度 | ファイル:行 | 何が起きるか | 直し方 |
|---|---|---|---|
| **高** | `lint.py:46-53`（`OLD_COLORS` の自動許可） | **「旧様式の配色が直書き」チェックが実質死んでいる。** 許可リストを作る時に template.css を**コメントを落とさずに**読んでいるため、ヘッダコメントの「RINCLE: #F95320 → #B8532F」に含まれる `#F95320` が「template.css が使っている色」と誤認され許可される。結果、11色のうち生き残るのは `#23201D` の1色だけ。実測: `<p style="color:#F95320">` を置いたページが `ALL CLEAN` で通る（`t/oldcolor.html`） | 許可リスト生成側にも opacity 許可リストと同じ `re.sub(r'/\*.*?\*/','',src,flags=re.S)` を入れてコメントを除いてから色を拾う（52行目） |
| **高** | `lint.py:265-286`（図の主張チェックの1200文字さかのぼり） | **SKILL.md が推奨する組み方そのものが誤検知になる。** 原則10・情報の性格表は「`.tilemap`（面の広がり）+ 上位の `.hbar`（順位）を併置」を指定しているが、47タイルのマークアップが1200文字を軽く超えるため、後ろに置いた `.hbar` から `<figure>` が見えず「図に主張がない: .hbar」と誤検知する。実測: `t/fp_tilemap_hbar.html`（1つの `<figure class="fig" aria-label="…">` にタイルマップと横棒2本を正しく入れたページ）が NG | 文字数さかのぼりをやめ、`<figure` / `</figure>` の出現位置を走査して「いま figure の中か」を状態で持つ（Tracker に figure 深さを持たせるのが素直）。暫定回避なら 1200 → 8000 程度 |
| **中** | `template.css:211` / `template.css:371` / `gallery.html:1801,1804,1807` | **存在しない変数 `var(--sans)` を参照している。** `:root`（7〜25行）に `--sans` の定義がない。無効値なので font-family は継承に落ち、`.bars .bv small` と `.funnel .fv small` は親が `var(--serif)` のため**単位が明朝で出る**。Playwright 実測: gallery の「前月」「セッション」の computed font-family = `"Shippori Mincho", serif`（意図はゴシック）。`template.css:200` の `td .td-sub` は `'Noto Sans JP',sans-serif` と直書きしてあり、書き手も `--sans` が無いことに気づいていない | `:root` に `--sans:'Noto Sans JP',-apple-system,…,sans-serif;` を追加する（body:28行の並びを切り出す）。gallery のインライン3箇所も同時に直る |
| **中** | `review/shoot.mjs:44` | **RINCLE固有のハッシュ `#stripe-payment-flow` が埋め込まれている。** 他案件で回すとハッシュが解決されず**ようこそ画面のまま撮れる**。エラーも出ないので気づけない。実測: 別案件を模したフォルダで撮った `index__page-open.png` が `index__welcome.png` と**バイナリ一致**した | ハッシュを第5引数（省略時は `pages[0]` 相当）にするか、この行を削って「1ページ開いた状態」は撮らない。README の「スキル側には案件固有の記述を入れない」と正面から矛盾する |
| **中** | `review/shoot.mjs:41-45` / `review/README.md:8` | **index.html が無い案件で未処理例外で落ちる。** `page.goto('file://…/index.html')` が ERR_FILE_NOT_FOUND を投げ、スタックトレースを吐いて異常終了する（本文ページの撮影は終わっているので実害は小さいが、初見の人は「壊れている」と受け取る）。README は「無ければその2行を消す」と書くが、実際は41〜45行の**5行**（`goto`+`screenshot` が2組+`console.log`） | `if (fs.existsSync(path.join(ROOT,'index.html'))) { … }` で囲む。README の「2行」も実数に直す |
| **中** | `shell.html:514` + `shell.html:569` | **ブラウザの「戻る」でシェルの外に出る。** ページ切替を `history.replaceState` でやっているので履歴エントリが増えず、末尾の `hashchange` リスナ（コメントは「戻る/進むボタンでの直リンク移動にも追従」）はシェル内移動では一度も発火しない。実測: ようこそ → 資料1 → 資料2 と進んで `goBack()` すると `about:blank` へ抜けた | ユーザー操作由来の `loadPage` は `pushState`、ハッシュ復元時だけ `replaceState` にする。直さないならコメントと `hashchange` を消す |
| **低** | `shell.html:508-517`（`loadPage`） | ようこそ画面 `#welcome` が `#content` の子なので、1ページ開いた時点で `contentEl.innerHTML=''` により**破棄され、二度と戻れない**（topbar は `display:none`、ホームリンクも無い）。実測: 資料を開いた後の `#welcome` の要素数 = 0 | `#welcome` を `#content` の外に出して `hidden` で出し入れするか、サイドバーヘッダに「はじめに」リンクを足す |
| **低** | `template.css:341-346`（`.tile.b1`〜`.b4`） | タイルマップの6段階の色が **RINCLE の焦がし色から起こした生ハードコード**（`#F3DDD1 / #EBC0A9 / #DE9873 / #CB6F44`）。原則2「色を差し替えるのは `:root` だけ」に反し、**別案件でブランド色を替えてもタイルマップだけオレンジのまま残る**（`.b5` と `.b0` だけがトークン・下地由来） | `color-mix(in srgb, var(--accent) 20%, var(--paper))` 等でトークンから導出するか、`--tile-1`〜`--tile-4` を `:root` に足す。同種のものに `.chart text.big{fill:#26221E}`（302行・`var(--ink)` にできる）がある |
| **低** | `template.css:355` + `:359` | `.stat .n.md`（30px）の中の `<small>` が 60px 用の 20px のままで、**単位が数字の2/3の大きさ**になる。原則10「数字の大きさで序列をつける」の効きが半減する。実測: gallery の3件すべて 数字30px / 単位20px | `.stat .n.md small{font-size:13px}` を足す |
| **低** | `review/shoot.mjs:16`（`settle()`） | 演出無効化の CSS が `.reveal,[data-reveal],.section,section` を対象にしているが、**このデザインシステムの reveal クラスは `.rv`/`.rv-in`**（`template.css:504`）。別システムのセレクタが残っている。いまは `newContext({reducedMotion:'reduce'})` のおかげで snippets のスクリプトが `.rv` を付けないため実害は出ていないが、保険として機能していない | セレクタを `.rv` に直す（`.rv{opacity:1!important;transform:none!important}`） |
| **低** | `review/shoot.mjs:10` | ページ一覧txtを `split('\n')` するだけなので、**CRLF や途中の空行があると `file://…/` を goto して落ちる** | `.split(/\r?\n/).filter(Boolean)` |
| **低** | `template.css:47-49`（`.flow a:nth-child(4n+1)`） | 760px以下で2カラムになるのに、左罫線の消去が4列前提（`4n+1`）のまま。3項目目・7項目目が1列目にいるのに `border-left` を持つ。描画実測では枠線と重なって視認できず**実害なし**（3・5・6・7項目 × 720/1280px で横溢れ0・行数も正しい） | 直すなら `@media (max-width:760px)` に `.flow a:nth-child(2n+1){border-left:none}` を足す。優先度は低い |

---

## ② 矛盾・食い違い

| 重要度 | ファイル:行 | 何が食い違っているか | 直し方 |
|---|---|---|---|
| **高** | `decisions.md:90`（2026-09-04「初見レビュー174件…」#2） | **撤回の断りが入っていない。** 同日の最上段の項が「章の外の箱（`aside.conclusion`）は廃止」と決め、lint も `aside.conclusion` を指摘するのに、この #2 は「そのため **`<aside class="conclusion">`** で置くことを規約にした」「短い答えは `.alert.alert-green`+『結論:』」と**現行規約と正反対**のまま残っている。撤回マーカーが付いているのは「結論はアラートの流用をやめ、専用部品にした」の項（17行目）だけ | #2 の冒頭にも `> **この項は同日中に改定した**（現行は「結論は01章」）` の1行を入れる。少なくとも `aside class="conclusion"` の段落に取り消しの断りを付ける |
| **中** | `decisions.md:101` vs `decisions.md:13` | 同じ9月4日の中で新設CSSの数え方が3通りに割れている。101行「実際に新設したCSSは `.conclusion`・`table.qa`・`.badge.muted` の3つだけ」/ 13行「この件で新設したCSSは結局ゼロになり」/ 15行「**残したもの**: `table.qa` と `.flow + .container{padding-top:0}` はそのまま使う」。13行の「ゼロ」は 15行の「残したもの」と直接ぶつかる | 13行を「結論の箱のために作ったCSSは結局ゼロになり」に限定する。101行にも撤回後の実数（`table.qa`・`.badge.muted` の2つ）を追記する |
| **中** | `SKILL.md:44`（badge の語彙） vs `template.css:223` / `gallery.html:847` / `lint.py:24` | **`.badge.bad`（紅）が CSS と見本に実在するのに、規約のどこにも載っていない。** SKILL.md は「ink=強調 / brand=最重要 / good=実測 / plain=中立 / muted=沈める」の5語、lint のメッセージも「バッジ語彙は ink/brand/good/plain/muted に固定」と書くが、`template.css:223` に `.badge.bad` があり `gallery.html:847` が `<span class="badge bad">要確認</span>` で見本まで出している。読み手は「見本にあるのに規約に無い」を前にどちらが正か判断できない | 使うなら SKILL.md と lint のメッセージに6語目として足す。使わないなら `template.css:223` と `gallery.html:847` を落とす |
| **中** | `template.css:375-381`（`figure.fig`） vs `gallery.html` | **原則11の新部品 `figure.fig` だけ gallery に見本が無い**（gallery 全体で `figure` 0件）。SKILL.md:15 の「5点セットで更新」の①②④⑤は揃っているが③が欠けている。見た目の正本が gallery だと宣言している以上、抜けたことに気づけない（皮肉にも `guide.html:143` には `figure.fig` が使われている） | gallery の「図」シートの各見本を `<figure class="fig" aria-label="…">` で包み、aria-label の良い例・悪い例を `g-ds` に添える |
| **中** | `SKILL.md:30`（`.n.md`） vs `snippets.html` | **`.n.md` の雛形が snippets.html に無い**（`class="n md"` 0件・gallery には3件）。原則10 が名指しで指定する変種なのに、コピー元が無い | snippets の `.stat-row` の雛形の隣に「答えでない数字」の1行を足す |
| **中** | `lint.py:11`（docstring「footerに「正本:」」） vs `lint.py:143` | **docstring が実装より多く約束している。** 統一性の項に「footerに「正本:」」と書いてあるが、実装は 143行のコメントで「正本パスの明記はmdが正本の場合のみ必須のため機械判定しない（目視チェック）」と明言し、チェックしていない。同じ docstring の「目視」の行には同じ項目が正しく載っている（同一 docstring 内で自己矛盾） | 統一性の行から「footerに「正本:」」を削る（目視の行だけ残す）。SKILL.md:90 が「チェック項目の一覧は lint.py 冒頭のdocstringが正」と宣言している以上、ここのずれは規約の穴に直結する |
| **中** | `lint.py:318`（コメント「原則11」） | **原則番号のずれ。** この commit が「図には主張を書く」を原則11として**挿入**したため、旧・原則11（図解の役割色・`.swim`の規格）は原則12に繰り下がった。318行の「位置合わせ用の固定px幅の空白div禁止(原則11 — レーン格子に置き換える)」は、いまや「図には主張を書く」を指してしまう（正しくは原則12） | `原則11` → `原則12` |
| **中** | `README.md:22` / `guide.html:68` | **「原則11箇条」が古い。** SKILL.md の原則はこの commit で 11 → **12** になった（11=図には主張・12=図解の役割色） | 両方「原則12箇条」に。人間向けの説明書2本なので両方を直す |
| **中** | `README.md:20-35`（ファイル構成） / `guide.html:66-77` | **新設した `review/` がファイル一覧に載っていない。** SKILL.md:94 は `review/` を使えと書くのに、人間が読む2つの説明書のディレクトリ図には `_source/` まであって `review/` が無い | 両方のツリーに `review/ … 初見デザインレビューの道具（撮影・依頼文・手順）` を足す |
| **低** | `lint.py:6`（docstring の `--multi-doc`） vs `lint.py:426` | docstring は「キッカー統一チェックを外す」としか書いていないが、実装は**ロゴ有無の混在チェックも**外している（`if len(logo_state) > 1 and not multi_doc`） | docstring を「キッカー統一とロゴ有無の統一チェックを外す」に |
| **低** | `SKILL.md:39` vs `lint.py:169` | SKILL.md は章ナビ「最大8個」しか書かないが、lint はタブのときだけ9個まで許す（「最大9: 本文8+参考資料」）。規約側にこの例外の記述が無い | SKILL.md の「長いページはタブ化」節に「タブは参考資料を足して最大9」と書く |
| **低** | `SKILL.md:94` / `review/README.md:3`（20万トークン） vs `decisions.md:110`（19万トークン） | 初見レビュー1回のコストが19万/20万で割れている | どちらかに寄せる（実測が19万なら3箇所を19万に） |
| **低** | `guide.html:31`（`最終更新 2026-09-02`） | この commit で guide.html の中身（lint.py・shell.html の行を追加）を更新しているのに、ヒーローのメタ行が 2026-09-02 のまま | `2026年9月4日` に（SKILL.md の表記統一に合わせて和文日付） |
| **低** | `guide.html:120-128`（検査の種類の表） | 今回 lint に入った主要規約（結論は01章・図の主張・色ベタの行ハイライト・琥珀のバッジ・opacity・alert3色・変更点バッジ）が1つも載っていない。「など」で逃げているが、人間向けの唯一の要約なので実態とずれる | 「部品の組み方」行に主要4件を足すか、「一覧は lint.py の冒頭が正」と1行足して逃げを明示する |
| **低** | `prompt.md:16` | 依頼文が `/Users/shoki.seino/.claude/skills/html-doc-design/SKILL.md` という**個人の絶対パス**を指す。リポジトリ同梱版（`.claude/skills/…`）が正本の案件では別コピーを読ませることになる（現時点では2つのコピーは `diff -rq` で完全一致だが、同期は手作業） | `{SKILL}` プレースホルダにして README の埋め込み手順に足す（README は {PROJECT}/{READER}/{DOCS} と {SHOTS}/{PAGES}/{OUT} の6つを挙げていて、この6つは prompt.md と完全一致していた＝ここは問題なし） |
| **低** | `documents/4_growth/03_seo/seo-report/generate_report.js` | 今回の新規約（原則11の図の主張・全角／・接続助詞）が**98_presentations の外にある生成物に伝播していない**。生成済みの `reports/seo-report-2026-08.html` に lint をかけると8件 NG（図に主張がない .funnel / 全角／2件 / 接続助詞4件）。98_presentations 配下は23ファイル ALL CLEAN で、差が出ている | 月次レポートの生成器も5点セットの波及先として SKILL.md か decisions.md に明記する |

---

## ③ lint の誤検知・見逃しテストの結果

テスト用HTMLは `scratchpad/review2/t/` に置いた。土台は `t/base.html`（章ナビ2項目・01章「結論」・footer 正本パス・演出スクリプトを備えた最小の適合ページ。単体で `ALL CLEAN`）で、これに `<!--BODY_SLOT-->` と `/*CSS_SLOT*/` を差し替えて作った。

### (a) 実在する違反を拾うか — 拾えたもの

| テストファイル | 仕込んだ違反 | 結果 |
|---|---|---|
| `d_aside.html` | `<aside class="conclusion">` | ✅ 検出 |
| `d_concbox.html` | `<div class="conclusion-box">` | ✅ 検出 |
| `d_conccss.html` | ページ固有CSSに `.conclusion-box{…}` だけ残留 | ✅ 検出（HTMLに無くてもCSS残骸を拾う） |
| `d_trhl.html` | `tr.hl td{background:#F7EFDF}` | ✅ 検出 |
| `d_goldbadge.html` | `.badge.warn{background:var(--gold-soft)}` | ✅ 検出 |
| `d_opacity.html` | `.route-box.faded{opacity:.62}`（decisions.md が現物として挙げた値） | ✅ 検出 |
| `d_svgaria.html` | `figure.fig` の中の `<svg aria-label="ドーナツグラフ">` | ✅ 検出 |
| `d_engbadge.html` | `<span class="badge brand">CHANGED</span>` | ✅ 検出 |
| `d_alertgold.html` | `alert-amber` | ✅ 検出 |
| `f_short.html` / `f_noaria.html` | aria-label が「内訳」/ 無し | ✅ 検出（6文字未満） |
| `f_multi.html` | 素の `.chart` 3個 | ⚠️ 検出するが **1件だけ**（`break` があるため。直しては再実行の繰り返しになる） |
| `stat_*.html` 3本 | stat が数字→ラベル順（先頭/末尾/単独） | ✅ 3本とも検出 |
| `text_ng.html` | 半角()2 / 全角／ / `500円/回` / し、り、て、が、 / ご〜される / で結構です | ✅ 10件すべて検出 |

### (b) 正当なものを誤検知しないか

| テストファイル | 正当な書き方 | 結果 |
|---|---|---|
| `inline_tpl.html` | template.css を丸ごと `<style>` に埋め込んだ自己完結ページ | ✅ ALL CLEAN（opacity 許可リスト・`:hover` 除外が効いている） |
| `inline_tpl_parts.html` | template.css + parts.css を埋め込み | ✅ ALL CLEAN |
| `text_ok.html` | `訪問2回 / オンライン2回` / `POST /v1/charges`（code内）/ `3.6%（税込）` / URL / 「増永さんが、清野さんが」（主語の が、）/ 「ご記入いただく」 | ✅ ALL CLEAN |
| `f_attrorder.html` | `<figure aria-label="…" class="fig">`（属性順が逆） | ✅ 誤検知なし |
| `f_newline.html` | figure タグが複数行に折れている | ✅ 誤検知なし |
| `f_desc.html` | aria-label が「内訳の帯グラフです」= **規約が × としている見た目の説明** | ⚠️ 通る（6文字以上なので機械では区別不能。docstring どおりの限界・仕様として妥当） |
| `ok_chart.html` / `fp_stackbar2.html` | `figure.fig` に `.chart` / `.stackbar` 2本 | ✅ 誤検知なし |
| `flow3/5/6/7.html` | 章ナビ3・5・6・7項目 | ✅ 誤検知なし（描画も 720/1280px で崩れなし） |
| **`fp_tilemap_hbar.html`** | **`figure.fig` に `.tilemap` + `.hbar`（SKILL.md の推奨組み合わせ）** | ❌ **誤検知**（①の高重要度） |
| **`base.html` 初版**（`正本: documents/test.md`） | **スラッシュ1つの正本パス** | ❌ **誤検知**「/の前後に半角スペースがない」。`lint.py:368` の `_is_path()` が「スラッシュ2個以上 / 先頭か末尾がスラッシュ」しか除外しないため、`documents/README.md` のような2階層の正本パスが**原則5どおりに書いた footer で NG になる**。98_presentations の実在パスは全部3階層以上なので今は表面化していない。直し方: `_is_path` に `re.search(r'\.(md|html|css|js|json|py|xlsx)$', tok)` を足す |
| `oldcolor.html` | `style="color:#F95320"`（**違反のはず**） | ❌ **見逃し**（①の高重要度・許可リストがコメントを拾っている） |

### (c) 見逃し（拾ってほしいのに拾わないもの）

| テストファイル | 書き方 | なぜ抜けるか |
|---|---|---|
| `d_trhl_noprefix.html` | `.hl td{background:#F7EFDF}`（`tr.` を書かない） | `lint.py:229` の正規表現が `\btr\.[\w-]+` を要求する。decisions.md が挙げた実在の再発明は `tr.highlight`/`tr.hl`/`tr.sum` なので当座は効くが、`<tr class="hl">` に対してCSSを `.hl td` と書くのはごく普通。`(?:^|[\s,>])(?:tr)?\.[\w-]+[^{,]*\btd\b` 相当に緩める |
| `d_alertattr.html` | `<div class="alert alert-blue" id="x">`（class の後に属性） | `lint.py:210` の `<div class="alert[^"]*">` が `">` で終わることを要求するため、属性が続くと**チェック自体が走らない**（SVGアイコンの有無を見ない）。`compare-box` の ×○マークチェック（`lint.py:294`）も同じ形で同じ穴。`<div[^>]*class="[^"]*\balert\b[^"]*"[^>]*>` 形に統一する |
| `d_statvar.html` | `<div class="stat hot">` で数字→ラベル順 | `lint.py:200` が `<div class="stat">` の完全一致。docstring は「statは「ラベル→数字」順(**全変種**)」と書いているので**docstringと実装のずれ**。現状 template.css に `.stat` の container 変種は無いので実害は出ていないが、文言どおりなら `<div[^>]*class="[^"]*\bstat\b[^"]*"` にすべき |
| （未テスト・コード読み） | `lint.py:271` の `if 'cell' in cls: continue` | 「表のセルの中の小さな棒（`.hbar.cell`）は対象外」という免除だが、**`.cell` は template.css にも snippets にも gallery にも存在しない**。どこにも定義のないクラスに免除を与えている（誤って `class="… cell"` を付ければ図のチェックを丸ごと回避できる）。`.hbar.cell` を部品として5点セットに入れるか、免除を消して td/th 判定だけに頼る |

### (d) 本番資料への当て込み（回帰確認）

- `python3 lint.py documents/98_presentations --multi-doc` → **23ファイル / 指摘0件 ALL CLEAN**（新5チェック導入後も既存資料は通る＝誤検知が出ていない）
- `python3 lint.py documents/4_growth/03_seo/seo-report/reports/seo-report-2026-08.html` → **8件 NG**（②の最終行）

---

## ④ 問題なしと確認できた項目

**5点セットの整合（クラス名の機械突合）**
- template.css の全クラス（214個）を snippets.html / gallery.html の実使用クラスと突合し、**snippets・gallery が使っているのに CSS に定義が無いクラスは 0 件**（gallery 固有の `g-*`・`intro`・`is-add` はページ内 `<style>` で定義済み）。綴り違い（`.c-note` vs `.cnote` の類）は1件も無し
- 今回新設の4部品 `.options`/`.option`・`.dev-detail`+`.dd-body`・`.num-chip`・`.method` は **SKILL.md / template.css / snippets.html / gallery.html の4点すべてに揃っている**。`.method` はドット記法で統一され、ハイフン記法 `.method-get` は1件も残っていない
- `table.qa`・`.badge.muted`・`.term-row`・`.stackbar`・`.tilemap`・`.funnel.labeled`・`.chart.compact`・`.table-mom` 系（`.tgroup`/`.label.ind`/`.label.wrap`/`.label-sub`/`.td-sub`/`.num.cnt`/`.num.calc`/`.std`/`.th-grp`）も4点揃い
- 変更点バッジの4語（決定済み / 弊社提案 / 変更点 / 旧設計）は snippets:273・gallery:1327-1330 に見本あり。gallery が説明文中で使う `<code>CHANGED</code>` は lint の誤検知を引き起こさない
- 廃止した `aside.conclusion` / `.conclusion-box` / `.c-note` / `p.ans` の**CSS残骸は template.css・parts.css・gallery・snippets・shell・guide のどこにも残っていない**（残るのは lint の検出コードと decisions.md の記録だけ）

**CSS の健全性**
- 未定義変数は `--sans` の1件のみ（①に記載）。`--gold-line` は今回の追加で定義済み・`.method.put` から正しく参照
- 同一セレクタの重複は13件あるが**すべてメディアクエリ内の上書きか別プロパティ**で、後勝ちで意図が消えているものは無し（`table` の2定義も `tabular-nums` と `width/border-collapse` で衝突なし）
- 新規追加の `@media (max-width:1100px){.hero h1{font-size:44px}}` は 760px ブロックより前にあり、階段 52/44/32px が正しく効く
- `.flow + .container{padding-top:0}` は実在のタブ式ページ（`current-issues.html` 等）の構造 `<nav class="flow-tabs">` → `<div class="container">` に正しく当たる
- `.option.dim .num-chip`（0,3,0）が `.num-chip.brand`（0,2,0）に勝つなど、新部品の特異度の優先順は意図どおり

**描画（Playwright 1.58 / Chromium）**
- `gallery.html` を **1280px と 760px** で描画 → 横溢れ0・幅0/高さ0の要素0・重なり0・JSエラー0。空要素として出たのは `.sb-seg`（狭いセグメントの無ラベル＝仕様）のみ
- 新部品6種（`.options`/2段ヘッダー表/`.method`/`.dev-detail`/`.num-chip`/`.chart.compact`/`.funnel.labeled`）を実ページに組んで 1280/760px → 崩れなし。`.options` は狭幅で1列に折り返す・`.option.dim` は opacity を使わず文字と罫線だけがグレーに落ちる（規約どおり）
- 章ナビ 3・5・6・7項目 × 720/1280px → `::after`+`:has()` の空きマス埋めが全パターンで機能し、はみ出し・余分な行は発生せず

**道具と派生物**
- `review/shoot.mjs` は README の手順（playwright のあるフォルダで `node shoot.mjs <出力dir> <一覧txt> <資料フォルダ>`）で**実行できる**。`createRequire(process.cwd()+'/')` の修正は効いており、スキルフォルダから起動しても playwright を解決できる。`clip` と `fullPage:true` の同時指定も Playwright 1.58 では正しく縦分割される（1800px刻み・タブ式は `__tabN`）
- `review/prompt.md` のプレースホルダは `{PROJECT}` `{READER}` `{DOCS}` `{SHOTS}` `{PAGES}` `{OUT}` の6つで、**README の説明（案件側で埋める3つ + エージェント起動時に埋める3つ）と過不足なく一致**
- `shell.html` はサンプル2ページで動作確認 — ようこそ画面（まず読む2本のカード+セクション目次）が `welcome`/`sectionNotes` から正しく組まれ、カードクリック・サイドバークリック・ハッシュ同期・iframe 読み込みが JSエラー0 で動く（「戻る」だけが①の不具合）
- `documents/98_presentations/assets/design.css` は `template.css` と **`diff` で完全一致**（新部品4種・`figure.fig`・`--gold-line`・`.n.md` まで反映済み）
- `~/.claude/skills/html-doc-design/` と `.claude/skills/html-doc-design/` の2コピーは現時点で `diff -rq` 差分なし

**decisions.md**
- 2026-09-04 の「結論はアラートの流用をやめ、専用部品にした」の項には撤回マーカー（`> **この項は同日中に撤回した**`）が正しく入り、最上段の「結論は「01章」にする」が「同じ日の（すぐ下の項）を撤回した決定」と明示している。撤回した案を消さずに残す方針も守られている（欠けているのは②の1件＝174件レビューの #2 箇条書き）
- SKILL.md から decisions.md への日付参照（2026-08-25 / 08-26 / 09-01 / 09-02 / 09-04）は**すべて実在する見出しを指している**
