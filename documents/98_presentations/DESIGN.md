# 98_presentations デザインシステム（2026-08-20制定）

クライアント向けSPA配下の全HTMLページ共通のデザイン定義。
**見本ページ: `proposal/seo/sitemap-creation-guide.html`**（迷ったらこれに合わせる）

## ブランドカラー

RINCLEのファビコン（`assets/rincle-favicon.png`・オレンジ地に白い自転車）から抽出。

| トークン | 値 | 用途 |
|---|---|---|
| `--brand` | `#F95320` | メインオレンジ。アクセント・番号チップ・リンク・バー |
| `--brand-deep` | `#D8400F` | 濃いオレンジ。ホバー・グラデーションの起点 |
| `--brand-soft` | `#FFF0EA` | 薄いオレンジ。ホバー背景・淡い強調 |
| `--ink` | `#23201D` | 見出し・表ヘッダ・ダークパネルの土台（暖色チャコール） |
| `--text` | `#2E2A26` | 本文 |
| `--sub` | `#6E675F` | 補足テキスト |
| `--bg` | `#F8F6F3` | ページ背景（暖色オフホワイト） |
| `--border` | `#E9E4DE` | 罫線 |
| `--ok` | `#1D9E5F` | 成功・OK（緑） |
| `--danger` | `#C21B3A` | 警告・NG（深紅。オレンジと混同しないよう紅寄り） |
| `--info` | `#2563EB` | 補足情報（青） |

## フォント（2026-08-20追加）

- 欧文 = **Inter**、和文 = **Noto Sans JP**（Google Fonts）。`<head>`の`<title>`直後に:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;800&family=Noto+Sans+JP:wght@400;500;700;800&display=swap" rel="stylesheet">
```

- Interを選んだ理由: `1 l I`の判別性（ID・URLが多い資料のため）、等幅数字で表の桁が揃う、Noto Sans JPと濃度が馴染む
- フォールバックにシステムフォントを並べる（オフラインでも読める）。和文は`palt`、表は`tabular-nums`を有効化（テンプレに含む）
- 「自己完結」原則の唯一の例外がこのGoogle Fonts

## 配色方針の更新（2026-08-20・清野さん指摘）

- **オレンジは差し色**。背景を塗りつぶす使い方はしない（全面オレンジのヒーローは廃止→ライトヒーロー）
- **黒い塊（チャコール背景+白文字のチップ・帯・表ヘッダ）は使わない**。番号チップ・帯はオレンジ系2段階（濃=solid brand/淡=brand-soft+brand-deep文字）、表ヘッダは`#FBF8F5`+オレンジ下線
- ダークを使ってよいのはコードブロック・URL構造図などの「画面・コードの表現」と、チャートのデータ色のみ

## ページの基本構造

1. **hero** — ごく薄いオレンジがかったライト背景（`#FFF3ED`→`#FFFDFC`） + eyebrowラベル + h1 + リード文。左に`assets/rincle-favicon.png`のロゴチップ（角丸14px・48px）を置く。**ヒーローに統計チップは置かない**（2026-08-20清野さん指示で廃止）
2. **flow nav（任意）** — 手順・章が3〜5個あるページは、ヒーロー下に重ねるカード型ナビ（アンカーリンク）
3. **section** — 番号チップ（section-num）+ h2 + サブ見出し。手順はオレンジ、前提・補足は`.plain`（チャコール）
4. **card / term / alert / table / codeblock / ol.steps** — 下のテンプレート参照
5. **recap（任意）** — ページ末尾のまとめバンド（オレンジのグラデーション）
6. **footer** — `正本: <mdパス>（md更新時はこのHTMLも同期すること）`

## 禁止・注意

- 各ページは自己完結（CSSは`<style>`にインライン）。外部CSS・JSライブラリ禁止
- ロゴのパスはページの階層に合わせる（`bizflow/` → `../assets/…`、`proposal/seo/` → `../../assets/…`）
- 旧配色（紺 `#0f3460`・赤 `#e94560`）は使わない
- 文章は平易な日本語（カタカナ専門用語は日常語に開く）。数字には出典（日付つき実測など）を残す

## CSSテンプレート（そのままコピーして使う）

```css
:root{
  --brand:#F95320; --brand-deep:#D8400F; --brand-soft:#FFF0EA;
  --ink:#23201D; --text:#2E2A26; --sub:#6E675F;
  --bg:#F8F6F3; --border:#E9E4DE; --radius:14px;
  --ok:#1D9E5F; --danger:#C21B3A; --info:#2563EB;
  --shadow:0 1px 3px rgba(35,32,29,.08),0 4px 14px rgba(35,32,29,.06);
  --shadow-lg:0 4px 8px rgba(216,64,15,.08),0 12px 32px rgba(35,32,29,.12);
}
*{margin:0;padding:0;box-sizing:border-box}
html{scroll-behavior:smooth}
body{font-family:'Inter','Noto Sans JP',-apple-system,BlinkMacSystemFont,'Segoe UI','Hiragino Sans',Meiryo,sans-serif;background:var(--bg);color:var(--text);line-height:1.85;-webkit-font-smoothing:antialiased;font-feature-settings:'palt' 1}
table{font-variant-numeric:tabular-nums}

/* hero */
.hero{position:relative;background:linear-gradient(135deg,#FFF3ED 0%,#FFF9F5 55%,#FFFDFC 100%);color:var(--ink);border-bottom:1px solid var(--border);padding:52px 40px 88px;overflow:hidden}
.hero::before{content:"";position:absolute;right:-120px;top:-120px;width:380px;height:380px;border-radius:50%;background:rgba(249,83,32,.05)}
.hero::after{content:"";position:absolute;right:70px;bottom:-160px;width:280px;height:280px;border-radius:50%;background:rgba(249,83,32,.07)}
.hero-inner{position:relative;max-width:980px;margin:0 auto;z-index:1;display:flex;gap:20px;align-items:flex-start}
.hero-logo{width:48px;height:48px;border-radius:14px;box-shadow:0 4px 14px rgba(35,32,29,.25);flex-shrink:0;margin-top:4px}
.hero .eyebrow{display:inline-block;font-size:12px;font-weight:700;letter-spacing:.12em;background:var(--brand-soft);border:1px solid #F8C9B5;color:var(--brand-deep);border-radius:999px;padding:3px 14px;margin-bottom:12px}
.hero h1{font-size:2.05rem;font-weight:800;margin-bottom:10px;letter-spacing:.01em}
.hero p.lead{font-size:1rem;color:#5A5049;max-width:700px}

.container{max-width:980px;margin:0 auto;padding:36px 28px 80px}

/* flow nav（ヒーロー下に重ねる章ナビ・任意） */
.flow{display:grid;grid-template-columns:repeat(4,1fr);gap:0;margin:-64px auto 44px;position:relative;z-index:2;max-width:980px;background:#fff;border-radius:var(--radius);box-shadow:var(--shadow-lg);overflow:hidden}
.flow a{display:block;text-decoration:none;color:inherit;padding:20px 18px 18px;position:relative;border-left:1px solid var(--border);transition:background .15s}
.flow a:first-child{border-left:none}
.flow a:hover{background:var(--brand-soft)}
.flow .fnum{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;background:var(--brand-soft);color:var(--brand-deep);box-shadow:inset 0 0 0 1.5px #F8C9B5;font-weight:800;font-size:14px;margin-bottom:8px}
.flow .ft{font-weight:800;font-size:14.5px;color:var(--ink);line-height:1.5}
.flow .fd{font-size:12px;color:var(--sub);margin-top:3px;line-height:1.6}
.flow a::after{content:"›";position:absolute;right:8px;top:50%;transform:translateY(-50%);font-size:22px;color:#E3C9BB;font-weight:700}
.flow a:last-child::after{content:""}

/* sections */
.section{margin-bottom:56px;scroll-margin-top:20px}
.section-header{display:flex;align-items:center;gap:14px;margin-bottom:22px}
.section-num{display:flex;align-items:center;justify-content:center;width:44px;height:44px;background:linear-gradient(135deg,var(--brand),#FF7A45);color:#fff;border-radius:12px;font-size:19px;font-weight:800;flex-shrink:0;box-shadow:0 4px 12px rgba(249,83,32,.35)}
.section-num.plain{background:var(--brand-soft);color:var(--brand-deep);box-shadow:inset 0 0 0 1.5px #F8C9B5}
.section-header h2{font-size:21px;font-weight:800;color:var(--ink)}
.section-header .sh-sub{font-size:12.5px;color:var(--sub);margin-top:1px}
h3{font-size:16px;font-weight:800;color:var(--ink);margin:28px 0 12px;padding-left:12px;border-left:4px solid var(--brand)}

.card{background:#fff;border:1px solid var(--border);border-radius:var(--radius);padding:26px 28px;box-shadow:var(--shadow);margin:16px 0}

/* term = 用語解説 */
.term{display:flex;gap:14px;background:linear-gradient(135deg,#FFF4EF,#FFF9F6);border:1px solid #FBD3C4;border-radius:12px;padding:16px 20px;margin:14px 0;font-size:14px}
.term .t-icon{flex-shrink:0;width:34px;height:34px;border-radius:9px;background:var(--brand);color:#fff;display:flex;align-items:center;justify-content:center;font-size:16px}
.term .term-name{font-weight:800;color:var(--ink);margin-bottom:2px}
.term .t-body{color:#4A3F38}

/* alerts */
.alert{border-radius:12px;padding:16px 20px;margin:16px 0;font-size:14px;display:flex;gap:12px;align-items:flex-start}
.alert .a-icon{flex-shrink:0;font-size:17px;line-height:1.6}
.alert-red{background:#FDECEF;border:1px solid #F6C6D0;color:#8E1230}
.alert-green{background:#EDFAF2;border:1px solid #BFE9D0;color:#136A41}
.alert-blue{background:#EEF3FE;border:1px solid #CBDCFA;color:#1D48A6}

/* compare（×/○の対比2枚組） */
.compare{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:18px 0}
.compare-box{border-radius:12px;padding:20px 22px;background:#fff;border:2px solid var(--border)}
.compare-box.bad{border-color:#F2AEBC;background:#FFF7F9}
.compare-box.good{border-color:#9ADBB4;background:#F6FDF9}
.compare-box .cb-head{display:flex;align-items:center;gap:10px;font-weight:800;font-size:15px;margin-bottom:8px}
.compare-box.bad .cb-head{color:#8E1230}
.compare-box.good .cb-head{color:#136A41}
.cb-mark{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:50%;color:#fff;font-weight:800;font-size:14px}
.bad .cb-mark{background:var(--danger)}
.good .cb-mark{background:var(--ok)}
.compare-box p{font-size:13.5px;color:#544B44}

/* tables */
.table-wrap{overflow-x:auto;border-radius:12px;box-shadow:var(--shadow);margin:16px 0;border:1px solid var(--border)}
table{width:100%;border-collapse:collapse;background:#fff;font-size:14px}
thead th{background:#FBF8F5;color:var(--ink);border-bottom:2px solid var(--brand);padding:12px 16px;text-align:left;font-size:13px;font-weight:700;white-space:nowrap}
td{padding:12px 16px;border-bottom:1px solid #F2EEE9;vertical-align:middle}
tr:last-child td{border-bottom:none}
tbody tr:hover td{background:#FBF8F5}
td.label{font-weight:700;color:var(--ink);white-space:nowrap}
.pri{display:flex;align-items:center;gap:10px;min-width:150px}
.pri .bar{height:8px;border-radius:99px;background:linear-gradient(90deg,var(--brand-deep),var(--brand));flex-shrink:0}
.pri .pv{font-size:12.5px;font-weight:700;color:var(--sub)}
.ng{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;background:#FBD9E0;color:var(--danger);font-weight:800;font-size:12px;margin-right:4px}

/* badges */
.badge{display:inline-block;padding:2px 12px;border-radius:999px;font-size:12px;font-weight:700;white-space:nowrap}
.badge.good{background:#EDFAF2;color:#136A41}
.badge.bad{background:#FDECEF;color:#8E1230}
.badge.warn{background:#FFF4E0;color:#8F5A0A}
.badge.brand{background:var(--brand-soft);color:var(--brand-deep)}

/* code */
code{background:#F6EFE9;border:1px solid #E8DCD2;border-radius:5px;padding:1px 7px;font-size:.88em;font-family:'SFMono-Regular',Menlo,Consolas,monospace;color:#9C3D12}
.codeblock{background:#221B16;color:#EDE6DF;border-radius:12px;padding:18px 22px;margin:16px 0;overflow-x:auto}
.codeblock pre{font-size:13px;line-height:1.8;white-space:pre;font-family:'SFMono-Regular',Menlo,Consolas,monospace;color:#EDE6DF}
.codeblock .cm{color:#A89A8E}
.codeblock .hl{color:#FFB27D}

/* 番号つき手順（縦の連結線） */
ol.steps{list-style:none;counter-reset:st;font-size:14px}
ol.steps li{counter-increment:st;position:relative;padding:0 0 18px 46px}
ol.steps li:last-child{padding-bottom:0}
ol.steps li::before{content:counter(st);position:absolute;left:0;top:1px;width:28px;height:28px;border-radius:50%;background:var(--brand-soft);border:2px solid var(--brand);color:var(--brand-deep);font-weight:800;font-size:13px;display:flex;align-items:center;justify-content:center}
ol.steps li:not(:last-child)::after{content:"";position:absolute;left:13.5px;top:32px;bottom:2px;width:2px;background:#F0E3DA}

/* 注意リスト */
ul.notes{list-style:none;font-size:14px}
ul.notes li{position:relative;padding:6px 0 6px 28px}
ul.notes li::before{content:"!";position:absolute;left:2px;top:8px;width:18px;height:18px;border-radius:50%;background:#FDE68A;color:#92400E;font-weight:800;font-size:11px;display:flex;align-items:center;justify-content:center}

/* まとめバンド */
.recap{background:linear-gradient(135deg,var(--brand-deep) 0%,var(--brand) 70%,#FF7A45 100%);color:#fff;border-radius:var(--radius);padding:26px 30px;margin-top:8px;box-shadow:var(--shadow-lg)}
.recap h2{font-size:17px;font-weight:800;margin-bottom:14px}
.recap .r-flow{display:flex;flex-wrap:wrap;gap:10px;align-items:center;font-size:13.5px}
.recap .r-chip{background:rgba(255,255,255,.13);border:1px solid rgba(255,255,255,.28);border-radius:999px;padding:6px 16px;font-weight:700}
.recap .r-arr{opacity:.6;font-weight:800}
.recap p{font-size:12.5px;opacity:.82;margin-top:14px}

footer{text-align:center;padding:36px 0;color:var(--sub);font-size:13px}

@media (max-width:760px){
  .flow{grid-template-columns:1fr 1fr;margin-top:-40px}
  .flow a{border-top:1px solid var(--border)}
  .compare{grid-template-columns:1fr}
  .hero{padding:44px 24px 84px}
  .container{padding:28px 18px 60px}
}

/* ---------- SVGアイコン（スプライト参照・snippets.html参照） ---------- */
.icon{width:1.05em;height:1.05em;stroke:currentColor;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:-.14em}
.t-icon .icon,.a-icon .icon{width:18px;height:18px}
.section-num .icon{width:22px;height:22px}

/* ---------- 読み進みバー ---------- */
.progress{position:fixed;top:0;left:0;right:0;height:3px;z-index:99;pointer-events:none}
.progress i{display:block;height:100%;width:0;background:linear-gradient(90deg,var(--brand-deep),var(--brand))}

/* ---------- ふわっと表示（JSが.rvを付与するのでJS無効時は普通に見える） ---------- */
.rv{opacity:0;transform:translateY(16px);transition:opacity .55s ease,transform .55s ease}
.rv-in{opacity:1;transform:none}
@media (prefers-reduced-motion: reduce){.rv{opacity:1;transform:none;transition:none}}

/* ---------- フローナビの現在地ハイライト ---------- */
.flow a.cur{background:var(--brand-soft)}
.flow a.cur .fnum{background:var(--brand);color:#fff;box-shadow:none}

/* ---------- ミニチャート（ドーナツ） ---------- */
.chart{display:flex;gap:24px;align-items:center;flex-wrap:wrap}
.chart svg{width:130px;height:130px;flex-shrink:0}
.chart .cl{font-size:13.5px}
.chart .cl div{display:flex;align-items:center;gap:8px;margin:4px 0}
.chart .cl i{width:10px;height:10px;border-radius:3px;display:inline-block;flex-shrink:0}
.chart text.big{font-size:9px;font-weight:800;fill:var(--ink);dominant-baseline:central}
```

## アイコン・演出・ミニチャート（2026-08-20追加）

- **アイコンはSVGスプライト**: `<body>`先頭に`<symbol id="i-〇〇">`のスプライトを置き、`<svg class="icon"><use href="#i-check"/></svg>`で参照。絵文字・文字記号（⇄▦🔍等）は使わない。アイコンの実体は見本ページ（sitemap-creation-guide.html）のスプライトをコピー（check/info/alert/help/file/api/refresh/search/send/list/map/arrow の12種）
- **読み進みバー**: `<body>`先頭に`<div class="progress"><i></i></div>`、末尾のスクリプトで幅を更新
- **ふわっと表示**: セクション単位（.section/.recap/nav.flow）で画面に入った時にfade-up。JSが`.rv`を付与する方式なのでJS無効でも全部見える。`prefers-reduced-motion`では無効化
- **フローナビの現在地**: flow navがあるページはスクロールに応じて現在の章がハイライトされる（スクリプトが自動で有効化）
- **ミニチャート**: 構成比・比較など数字が主役の箇所にはSVGドーナツ（.chart）を使ってよい。**出典のある数字のみ・1ページ1〜2個まで**。飾りのためのチャートは作らない。**中央は大きな数字だけ**（小さな補足文言は読めないので入れない。単位・出典は凡例側に。2026-08-20清野さん指示）
- 上記のスクリプトは見本ページ末尾の`<script>`をそのままコピー（タブ用スクリプトとは独立して共存可）

## ヒーローのHTML雛形

```html
<div class="hero">
  <div class="hero-inner">
    <img class="hero-logo" src="../../assets/rincle-favicon.png" alt="RINCLE">
    <div>
      <span class="eyebrow">カテゴリ名 — テーマ</span>
      <h1>ページタイトル</h1>
      <p class="lead">1〜2文のリード。誰向けに何をまとめた資料か。</p>
    </div>
  </div>
</div>
```

※ flow navを使わないページはheroの`padding-bottom`を40px程度に減らす。

## タブが必要な長いページ

縦に長いページ（例: seo-guide.html）はタブ切り替え式にする。実装はseo-guide.htmlの`.tabs`/`.tab-btn`/`.tab-panel`+末尾の`<script>`を踏襲し、配色トークンだけ本デザインに合わせる。
