#!/usr/bin/env python3
"""html-doc-design デザイン規約リント — 誌面エディトリアル様式のHTML資料を機械チェックする。

使い方:
  python3 lint.py <ディレクトリ or HTMLファイル...> [--allow-emoji "🥑👍"] [--multi-doc]
  --multi-doc: 資料集（SPA等・ページごとにキッカーが異なる構成）ではキッカー統一とロゴ有無の統一チェックを外す

チェック内容(構造検証で拾えない規約違反を検出する):
  構造   : HTMLパース可能・<div>開閉一致
  統一性 : ヒーロー部品(キッカー/資料番号/h1/リード)・キッカー文言・ロゴの有無が全ファイルで同一(ロゴ自体は任意)
           ロゴを置く場合の相対パス実在・Webフォントlink・読み進みバー・演出スクリプト
           ヒーローに統計チップ/カードを置かない・footerに保守者向けの同期指示を書かない(HTMLコメントへ)
  章ナビ : flow/flow-tabsの存在・アンカーの解決・flowは8個以下・タブdata-targetとpanel idの完全一致
           タブ切替スクリプトが1つ・active初期状態・タブ9個以下
  部品   : statは「ラベル→数字」順(全変種)・recapの親はcontainer/tab-panel直下
           図の部品は<figure class="fig" aria-label="主張">で包む(原則11。カタログ=specimenは対象外。
           表のセル内の棒 .hbar.cell は図でなく数値の見せ方なので対象外 — 表全体を1つのfigureで包む)
           ul.notesに※の直書きなし・alertにSVGアイコン・compare-boxに×○マーク
           alertの色は3種固定(alert-blue/green/red以外を作らない。琥珀のalertは不採用)
           結論は01章として置く(章の外の専用の箱=aside.conclusion/.conclusion-box は廃止。specimenは対象外)
           変更点バッジの語彙(CHANGED/NEW等の英字を使わない=「決定済み/弊社提案/変更点/旧設計」の4語)
           fnumは英数字・表の字下げに全角空白の直書きなし(td.label.indを使う)
           推奨の面(std)は1列だけ(2段ヘッダーの比較表では1グループだけ)
           色ベタの行ハイライトなし(tr.xxx td{background} — 強調は焦がしの太字かtd.stdの薄い面で)
           琥珀のバッジなし(バッジ語彙はink/brand/mid/good/bad/plain/muted。琥珀は「お金」の役割色で意味が二重になる)
           .badge.ink(黒ベタ)は1ページ3個まで(唯一の最重要マーク。3段階の「中」は.badge.mid)
           章番号は01始まり・小見出し番号はハイフン式(「4-1」。ドット式「7.1」は使わない)
           h2は1行(全角26字まで。補足はsh-subへ)・H1に副題の子要素を入れない(副題はリードへ)
           01章のsh-subと結論本文の1文目が同文でない(01章のsh-sub=何を扱うか / 本文=答え。02章以降のsh-subは主張文=目視)
           ページ固有<style>で共通部品(stat/badge/tag/alert/term/card/step(s)/hbar/legend/chart/
           table/notes/compare-box/sub-item)を再定義・新変種を作らない(メディアクエリ内の調整は対象外)
           沈めるのにopacityを使わない(文字色と罫線をグレーに落として沈める=tr.muted / .option.dim)
           見出しタグへのfont-size直書きなし(階段4段固定)・部品への個別max-widthなし(.slideの額は例外)
           固定px幅の空白divなし・inlineのbox-shadowなし(影は浮かぶ部品のCSSだけ)・スライド内の表は5行まで
           差分表(.dtable): .drowの種別はeq/rep/del/insのどれか1つ・.dcellは<pre>を持つ・凡例.dlegendがページに1枚・
           #hlトグルを置いたらbody.nohlを切り替えるscriptがある(specimenは凡例チェックのみ免除しない=見本も凡例を持つ)
  残骸   : トークン外の配色直書き(template.css自身が使う色は自動許可)・絵文字(許可リスト外)
  文章   : 半角()の使用(全角（）を使う)・全角／の使用(半角/+前後半角スペース)・/の前後スペース欠け
           接続助詞「し、/り、/て、/が、」の文つなぎ(句点で切る。ただし/つまり/〜のとおり等の接続詞・
           慣用句と主語の「が、」は除外。code/pre内は対象外)
  敬語   : 二重敬語「ご〜される」・提案側の「で結構です」(それ以外の敬語=主体依存は機械判定不能のためSKILL.md参照)
  目視   : footerの正本パス(mdが正本の場合のみ必須=機械判定不能)・章の背景交互・図解の役割色と凡例

部品カタログ(gallery等・部品を文脈の外に展示するページ)は、ページ内に
<!-- lint-mode: specimen --> を置くと文脈依存チェック(章ナビ/タブ・recap配置)だけ免除される。
構造・配色・絵文字・stat順などの実質チェックはカタログにもかかる。
アプリ画面をHTMLで模写して見せる資料は <!-- lint-mode: mockup --> で
描写のための直書き(box-shadow・固定px幅・部品max-width)だけ免除される(文章・構造チェックはかかる)。
デッキ(投影用スライド・<!-- lint-mode: deck --> または body.deck)は誌面の規約(ヒーロー/章ナビ/01章)の代わりに
デッキの規約でみる: 送りスクリプト・全枚に下枠(.slide-ft)と2枚目以降のページ番号(.pg)・
本文スライドの見出し h1.sd-h は1つ/48字以内/常体/「ラベル：」や題名形でない・表5行/箇条書き5本まで・
h1は1枚1つ・本文より小さい文字の直書きなし(.sd-src除く)・図はfigure.fig・30枚まで。文章規約と敬語は誌面と同じ。

exit code: 指摘ありなら1、クリーンなら0。
生成をエージェントに並列分担させた後は必ず実行すること(参照割れは構造検証では出ない)。
"""
import sys, re, glob, os, html
from html.parser import HTMLParser

OLD_COLORS = ['#F95320', '#23201D', '#B8532F', '#8F3E20', '#F3E6DC',
              '#FBF9F5', '#26221E', '#EAE2D6', '#F3EFE8', '#F6EFE9', '#221B16']
# デザインシステム自身（template.css）が使っている色は「直書き」でも正規とみなす
_tpl = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'template.css')
if os.path.exists(_tpl):
    # コメントを先に落とす — ヘッダコメントの「RINCLE: #F95320 → #B8532F」を拾うと
    # 旧ブランド原色まで「template.cssが使っている色」として許可され、チェックが死ぬ（2026-09-14修正）
    _tpl_nocmt = re.sub(r'/\*.*?\*/', '', open(_tpl, encoding='utf-8').read(), flags=re.S)
    _tpl_colors = {c.upper() for c in re.findall(r'#[0-9A-Fa-f]{6}', _tpl_nocmt)}
    OLD_COLORS = [c for c in OLD_COLORS if c.upper() not in _tpl_colors]
EMOJI = re.compile('[\U0001F300-\U0001FAFF☀-➿]')
# template.css自身がopacityを使うセレクタのクラス名(.recap/.funnel/.rv 等)。
# CSSを丸ごと<style>に埋め込んだページで「沈めるのにopacity」チェックが誤反応しないための許可リスト
_TPL_OPACITY_CLASSES = set()
if os.path.exists(_tpl):
    _tpl_src = re.sub(r'/\*.*?\*/', '', open(_tpl, encoding='utf-8').read(), flags=re.S)
    for _sel, _dec in re.findall(r'([^{}]+)\{([^{}]*)\}', _tpl_src):
        if re.search(r'(?<![\w-])opacity\s*:', _dec):
            _TPL_OPACITY_CLASSES |= set(re.findall(r'\.([\w-]+)', _sel))
GOLD_TOKEN = re.compile(r'--gold|#EAD9AE|#C99A2E|#F7EFDF|#8F5A0A', re.I)
BG_NEUTRAL = {'none', 'transparent', 'inherit', 'unset', 'initial'}


def css_rules_ctx(s):
    """ページ固有の<style>内のCSSルールを (セレクタ, 宣言, メディアクエリ内か) で返す(コメントは除去済み)"""
    for m in re.finditer(r'<style[^>]*>(.*?)</style>', s, re.S):
        body = re.sub(r'/\*.*?\*/', '', m.group(1), flags=re.S)
        media = []  # @media{...} の範囲（狭い幅での微調整は「部品の再定義」の対象外にする）
        for am in re.finditer(r'@media[^{]*\{', body):
            depth, i = 1, am.end()
            while i < len(body) and depth:
                depth += (body[i] == '{') - (body[i] == '}')
                i += 1
            media.append((am.start(), i))
        for r in re.finditer(r'([^{}]+)\{([^{}]*)\}', body):  # @media等の入れ子は中のルールだけ拾える
            yield r.group(1).strip(), r.group(2), any(a <= r.start() < b for a, b in media)


def css_rules(s):
    """ページ固有の<style>内のCSSルールを (セレクタ, 宣言) で返す(コメントは除去済み)"""
    for sel, dec, _inm in css_rules_ctx(s):
        yield sel, dec


# ページ固有CSSで再定義・新変種を作ってはいけない共通部品（2026-09-14追加）。
# トークン一致か「部品名-」の接頭辞一致で判定する（.stat-card / .steps-flow / .alert-amber 等）
PART_CLASSES = ('stat', 'badge', 'tag', 'alert', 'term', 'card', 'step', 'steps', 'hbar',
                'legend', 'chart', 'table', 'notes', 'compare', 'compare-box', 'sub-item', 'section',
                'dtable', 'dmeta', 'dlegend')
# template.css / parts.css を丸ごと<style>に埋め込む自己完結ページで誤検知しないための許可リスト。
# 「セレクタも宣言も本体と同一」なら埋め込みのコピーなので対象外。宣言が違えば再定義として拾う
_TPL_RULES = {}
for _f in ('template.css', 'parts.css'):
    _fp = os.path.join(os.path.dirname(os.path.abspath(__file__)), _f)
    if os.path.exists(_fp):
        _src = re.sub(r'/\*.*?\*/', '', open(_fp, encoding='utf-8').read(), flags=re.S)
        for _sel, _dec in re.findall(r'([^{}]+)\{([^{}]*)\}', _src):
            for _one in _sel.split(','):
                _one = re.sub(r'\s+', ' ', _one).strip()
                if _one:
                    _TPL_RULES.setdefault(_one, set()).add(re.sub(r'\s+', '', _dec))


def _part_class(sel):
    """セレクタが共通部品のクラス（またはその接頭辞を持つクラス）に触っていれば部品名を返す"""
    for tok in re.findall(r'\.([\w-]+)', sel):
        for p in PART_CLASSES:
            if tok == p or tok.startswith(p + '-'):
                return p
    if re.search(r'(?:^|[\s,>+~])table\b(?!-)', sel):  # 素の table 要素セレクタ
        return 'table'
    return None


def _part_violation(sel):
    """ページ固有CSSのセレクタが「共通部品の新しい変種」なら (部品名, 種別) を返す。
    対象は ①部品名を接頭辞にした新クラス（.stat-card / .steps-flow / .section-lead）
          ②部品クラスとの複合＝新変種（.stat.win / .tag.geo / .hbar.cell）。
    .card li のような子孫セレクタ（部品の中身の調整）は対象外 — 既存セレクタの再定義は呼び出し側で見る"""
    toks = re.findall(r'\.([\w-]+)', sel)
    for tok in toks:
        for p in PART_CLASSES:
            if tok.startswith(p + '-') and tok not in _TPL_CLASSES:
                return p, '部品名を接頭辞にした新クラス'
    for p in PART_CLASSES:
        if re.search(r'\.' + re.escape(p) + r'\.[\w-]+|\.[\w-]+\.' + re.escape(p) + r'(?![\w-])', sel):
            return p, '部品クラスの新しい変種'
    return None


_TPL_CLASSES = set()
for _sel in _TPL_RULES:
    _TPL_CLASSES |= set(re.findall(r'\.([\w-]+)', _sel))


def _zen_len(t):
    """全角=1・半角=0.5 で数えた見出しの字数"""
    import unicodedata
    return sum(1 if unicodedata.east_asian_width(c) in 'FWA' else 0.5 for c in t)


def _text(frag):
    """タグを落として文字列にする"""
    return html.unescape(re.sub(r'<[^>]+>', '', frag)).strip()


class Tracker(HTMLParser):
    """recapの親要素を追跡する"""
    VOID = {'br', 'img', 'meta', 'link', 'input', 'hr', 'use', 'circle',
            'line', 'path', 'polyline', 'polygon', 'symbol', 'text', 'rect'}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack, self.recap_parents = [], []

    def handle_starttag(self, tag, attrs):
        cls = dict(attrs).get('class', '')
        if tag == 'div' and 'recap' in cls.split():
            parents = [c for t, c in self.stack if t == 'div' and c]
            self.recap_parents.append(parents[-1].split()[0] if parents else '(root)')
        if tag not in self.VOID:
            self.stack.append((tag, cls))

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                del self.stack[i]
                break



def text_rules(s, bad):
    """文章規約・敬語(2026-09-01追加)。誌面ページとデッキの両方から呼ぶ。カタログ=specimenは見本文のため対象外"""
    text = re.sub(r'<!--.*?-->', ' ', s, flags=re.S)
    text = re.sub(r'<(style|script|code|pre|svg)\b.*?</\1>', ' ', text, flags=re.S)
    text = re.sub(r'<[^>]+>', ' ', text)
    text = html.unescape(text)
    text = re.sub(r'https?://\S+', ' ', text)

    def ctx(m, t):
        return re.sub(r'\s+', ' ', t[max(0, m.start() - 14):m.end() + 14]).strip()

    for m in re.finditer(r'[()]', text):
        bad(f"半角括弧(全角（）を使う): …{ctx(m, text)}…")
    for m in re.finditer(r'／', text):
        bad(f"全角／(半角/を前後半角スペース付きで使う): …{ctx(m, text)}…")
    # ファイルパス(footerの正本パス等)・URL断片・APIエンドポイント(/captureなど先頭スラッシュ)の
    # スラッシュは文章ではないので対象外。1個だけの「円/回」等は文章として拾う
    def _is_path(tok):
        # 「documents/README.md」のようにスラッシュ1個の正本パスも除外する（原則5のfooterが誤検知していた）
        return (tok.count('/') >= 2 or tok.endswith('/') or tok.startswith('/') or '/.' in tok
                or re.search(r'\.(md|html|css|js|mjs|json|py|xlsx|csv|txt|png|svg|webp)$', tok) is not None)
    text_slash = ' '.join(tok for tok in text.split() if not ('/' in tok and _is_path(tok)))
    for m in re.finditer(r'\S/|/\S', text_slash):
        bad(f"/の前後に半角スペースがない: …{ctx(m, text_slash)}…")
    # 接続助詞の文つなぎ。接続詞・慣用句(ただし/しかし/つまり/やはり/〜のとおり/さて/よって/したがって)は除外。
    # 「が、」は動詞の言い切りに続く逆接だけを拾う(名詞+主語の「が、」は正当なので除外)
    EXC = ('ただし', 'しかし', 'つまり', 'やはり', 'とおり', 'どおり', 'より', 'さて', 'よって', 'したがって')  # 「より」=比較・「により」の助詞(「〜おり、」は拾う)
    for m in re.finditer(r'([しりてが])、', text):
        pre = text[max(0, m.start() - 5):m.end() - 1]
        if any(pre.endswith(e) for e in EXC):
            continue
        if m.group(1) == 'が' and not re.search(r'(ます|です|ません|ました|でした|る|た)が$', pre):
            continue
        bad(f"接続助詞「{m.group(1)}、」で文をつないでいる(句点で切るか読点を落とす): …{ctx(m, text)}…")
    # 敬語: 機械で確実に拾える2パターンだけ(主体依存の使い分けはSKILL.mdの敬語規約=目視)
    for m in re.finditer(r'ご[一-龥]{1,4}され', text):
        bad(f"二重敬語「ご〜される」(「ご決裁いただく」等に): …{ctx(m, text)}…")
    for m in re.finditer(r'で結構です', text):
        bad(f"提案側の「で結構です」は上から目線(「お時間をいただければ十分です」等に): …{ctx(m, text)}…")


def lint_deck(path, s, issues):
    """デッキ(投影用スライド・body.deck)の規約。誌面ページの規約(ヒーロー/章ナビ/01章)は適用しない"""
    bad = issues.append
    if 'fonts.googleapis.com' not in s:
        bad("Webフォントlinkなし")
    if 'class="deck-nav"' not in s or 'section.slide' not in s:
        bad("デッキ送りのスクリプト/.deck-navなし(deck.htmlの雛形を使う)")
    slides = re.findall(r'<section class="slide"[^>]*>(.*?)</section>', s, re.S)
    if not slides:
        bad("section.slide が1枚もない(1 section=1スライド)")
    for i, sl in enumerate(slides, 1):
        tag = f"{i:02d}枚目"
        if 'class="slide-ft"' not in sl:
            bad(f"{tag}: 共通の下枠(.slide-ft)なし")
        elif i > 1 and 'class="pg"' not in sl:
            bad(f"{tag}: 下枠にページ番号(.pg)なし(表紙だけ日付)")
        # 本文スライドは見出し帯(sd-head)に主張の h1.sd-h を1つ持つ
        if 'sd-head' in sl:
            hs = re.findall(r'<h1 class="sd-h">(.*?)</h1>', sl, re.S)
            if len(hs) != 1:
                bad(f"{tag}: .sd-head の h1.sd-h が{len(hs)}個(1個)")
            else:
                h = _text(hs[0])
                if _zen_len(h) > 48:
                    bad(f"{tag}: 見出しが長い(全角48字=2行を超える): {h[:30]}…")
                if re.search(r'(です|ます|でした|ました|ません)[。]?$', h):
                    bad(f"{tag}: 見出しは常体で書く(です・ます禁止): {h[:30]}")
                if re.search(r'[：:]', h):
                    bad(f"{tag}: 見出しに「ラベル：」形式を使わない(主張1文にする): {h[:30]}")
                if re.search(r'(について|の件|のご説明|のまとめ|の概要|の紹介)$', h):
                    bad(f"{tag}: 見出しが題名になっている(主張1文にする): {h[:30]}")
        # 型に関係なく: 表は5行まで・箇条書きは5本まで・見出しは1枚に1つ
        for t in re.findall(r'<table\b.*?</table>', sl, re.S):
            rows = len(re.findall(r'<tr\b', t.split('<tbody', 1)[-1])) if '<tbody' in t else len(re.findall(r'<tr\b', t)) - 1
            if rows > 5:
                bad(f"{tag}: 表が{rows}行(5行まで。分けるか削る)")
        for u in re.findall(r'<ul\b[^>]*>(.*?)</ul>', sl, re.S):
            n = len(re.findall(r'<li\b', u))
            if n > 5:
                bad(f"{tag}: 箇条書きが{n}本(5本まで)")
        if len(re.findall(r'<h1\b', sl)) > 1:
            bad(f"{tag}: h1が複数(1枚1メッセージ)")
        if 'sd-msg' in sl and re.search(r'class="sd-h"', sl):
            bad(f"{tag}: 1メッセージ型と見出し帯を同居させない")
        # 本文の最小サイズ: .sd-body より小さい font-size の直書き禁止(投影で読めない)
        for m in re.finditer(r'font-size:\s*(\.\d+|0\.\d+)em', sl):
            if float(m.group(1)) < .8 and 'sd-src' not in sl[max(0, m.start()-80):m.start()]:
                bad(f"{tag}: 本文より小さい文字の直書き(font-size:{m.group(1)}em。出典の .sd-src 以外は18px相当を下回らない)")
    if len(slides) > 30:
        bad(f"スライドが{len(slides)}枚(目安は30枚まで。長い話は誌面ページにする)")
    # 図の部品は figure.fig で包む(原則11・誌面と同じ)
    for cls in ('lanes', 'swim', 'pflow', 'funnel', 'tilemap', 'stackbar', 'hbar', 'phases'):
        for m in re.finditer(r'<(\w+)[^>]*class="[^"]*\b' + cls + r'\b[^"]*"', s):
            before = s[max(0, m.start() - 400):m.start()]
            if '<figure' not in before or before.rfind('</figure>') > before.rfind('<figure'):
                bad(f"図の部品 .{cls} が figure.fig で包まれていない")
                break
    text_rules(s, bad)


def lint_file(path, allow_emoji):
    s = open(path, encoding='utf-8').read()
    name = os.path.basename(path)
    issues = []
    bad = issues.append

    # --- 構造 ---
    tracker = Tracker()
    try:
        tracker.feed(s)
    except Exception as e:
        bad(f"HTMLパースエラー: {e}")
    n_open, n_close = len(re.findall(r'<div\b', s)), s.count('</div>')
    if n_open != n_close:
        bad(f"div開閉不一致 {n_open}/{n_close}")

    # デッキ(投影用スライド): 誌面の規約でなくデッキの規約でみる
    if '<!-- lint-mode: deck -->' in s or re.search(r'<body[^>]*class="[^"]*\bdeck\b', s):
        lint_deck(path, s, issues)
        return issues, None, False, None

    # 資料ページでないもの(SPAシェル等)はここまで
    if 'class="hero"' not in s:
        return issues, None, True, None

    # 部品カタログ(gallery等): 部品を本来の文脈の外に展示するページ。
    # 文脈依存チェック(章ナビ/タブ・recap配置)だけ免除し、実質チェックは全部残す
    specimen = '<!-- lint-mode: specimen -->' in s
    # UI模写ページ(アプリ画面をHTMLで描いて見せる資料): 影・幅などの「描写のための直書き」を免除
    mockup = '<!-- lint-mode: mockup -->' in s

    # --- ヒーロー・共通部品 ---
    for token, label in [('hero-no', '資料番号(hero-no)'),
                         ('<p class="lead">', 'リード文'), ('fonts.googleapis.com', 'Webフォントlink'),
                         ('class="progress"', '読み進みバー'), ('IntersectionObserver', '演出スクリプト')]:
        if token not in s:
            bad(f"{label}なし")
    kickers = re.findall(r'hero-kicker">([^<]*)<', s)
    kicker = kickers[0].strip() if kickers else None
    if not kicker:
        bad("キッカーなし")
    if '<footer>' not in s:
        bad("footerなし")
    # footerに書くのは正本パスだけ(原則5・2026-09-04改定)。
    # 「md更新時はこのHTMLも同期すること」は保守者向けの指示なので <!-- --> コメントへ移す
    for m in re.finditer(r'<footer[^>]*>(.*?)</footer>', s, re.S):
        ftext = re.sub(r'<[^>]+>', '', m.group(1))
        if '同期' in ftext:
            bad(f"footerに保守者向けの同期指示(正本パスだけにし、指示はHTMLコメントへ): {ftext.strip()[:44]!r}")
    # 正本パスの明記はmdが正本の場合のみ必須のため機械判定しない（目視チェック）
    # ヒーローに統計チップ・カードを置かない(原則7)。ヒーロー開始〜本文開始までの間に .stat/.chip があれば違反
    hero_start = s.find('class="hero"')
    body_start = min([i for i in (s.find('<nav', hero_start), s.find('class="container"', hero_start), s.find('class="flow-tabs"', hero_start)) if i > 0] or [len(s)])
    hero_seg = s[hero_start:body_start]
    if re.search(r'class="(stat|chip)[" ]', hero_seg):
        bad("ヒーローに統計チップ/カード(統計はサマリー章の.stat-rowへ)")
    # ロゴを置く場合、相対パスの実在を確認(data:とhttpは対象外)
    for m in re.finditer(r'<img[^>]*class="[^"]*hero-logo[^"]*"[^>]*src="([^"]+)"', s):
        src = m.group(1)
        if not src.startswith(('data:', 'http')):
            if not os.path.exists(os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(path)), src))):
                bad(f"ヒーローのロゴパスが実在しない: {src}")

    # --- 章ナビ / タブ ---
    # CSSを丸ごと埋め込むページでは、スタイル定義内の "flow-tabs" に誤反応する。
    # 実際にタブ部品をマークアップで使っている時だけタブ扱いにする
    is_tabs = (not specimen) and re.search(r'<\w+[^>]*class="[^"]*flow-tabs', s) is not None
    if not specimen and not is_tabs and '<nav class="flow">' not in s:
        bad("章ナビなし(flow/flow-tabs必須)")
    if is_tabs:
        targets = re.findall(r'data-target="([^"]+)"', s)
        panels = re.findall(r'<div class="tab-panel[^"]*" id="([^"]+)"', s)
        if sorted(targets) != sorted(panels):
            bad(f"タブとパネルの不一致: {sorted(set(targets) ^ set(panels))}")
        if s.count('function openTab') != 1:
            bad(f"タブ切替スクリプトが{s.count('function openTab')}個(1個であるべき)")
        if 'tab-btn active' not in s:
            bad("初期activeタブなし")
        if 'tab-panel active' not in s:
            bad("初期activeパネルなし")
        if len(targets) > 9:
            bad(f"タブ{len(targets)}個(最大9: 本文8+参考資料)")
    else:
        nav = re.search(r'<nav class="flow">.*?</nav>', s, re.S)
        if nav:
            ids = set(re.findall(r'id="([^"]+)"', s))
            anchors = re.findall(r'<a href="#([^"]+)"', nav.group(0))  # <use href="#icon">を数えない
            missing = [h for h in anchors if h not in ids]
            if missing:
                bad(f"章ナビの迷子アンカー: {missing}")
            if len(anchors) > 8 and not specimen:  # カタログはシート数ぶん並ぶので対象外
                bad(f"章ナビ{len(anchors)}個(最大8: 4列×2行)")

    # --- 部品規約 ---
    for m in re.finditer(r'<span class="fnum">(.*?)</span>', s, re.S):
        inner = m.group(1)
        if '<svg' in inner:
            continue  # アイコンfnumは可
        text = re.sub(r'<[^>]+>', '', inner).strip()
        if not re.fullmatch(r'[0-9A-Za-z.¥✓]+', text):
            bad(f"fnumが英数字でない: '{text}'")
    if not specimen:
        for parent in tracker.recap_parents:
            if parent not in ('container', 'tab-panel'):
                bad(f"recapの親が{parent}(container/tab-panel直下に置く)")
    # stat順: ブロック内で n が l より先に来たら違反(ラベル→数字→前月比)。.stat の全変種(<div class="stat hot">等)が対象
    _STAT_TAG = r'<div[^>]*class="(?:[^"]*\s)?stat(?:\s[^"]*)?"[^>]*>'
    for m in re.finditer(_STAT_TAG + r'(.{0,500}?)(?=' + _STAT_TAG + r'|</div>\s*</div>|</footer>)', s, re.S):
        block = m.group(1)
        ni, li = block.find('class="n'), block.find('class="l"')
        if ni >= 0 and (li < 0 or ni < li):
            bad(f"statが数字→ラベル順(ラベルを上に): {block[:60].strip()!r}")
    for m in re.finditer(r'<ul class="notes"[^>]*>(.*?)</ul>', s, re.S):
        for li_html in re.findall(r'<li[^>]*>(.*?)</li>', m.group(1), re.S):
            text = re.sub(r'<[^>]+>', '', li_html).strip()
            if text.startswith('※'):
                bad(f"notes内に※直書き(CSSが付けるので二重になる): {text[:30]}…")
    for m in re.finditer(r'<div[^>]*class="[^"]*\balert\b[^"]*"[^>]*>(.{0,120})', s, re.S):
        if '<svg' not in m.group(1):
            bad(f"alertにSVGアイコンなし: {m.group(1)[:50].strip()!r}")
    # alertの色は3種固定(2026-09-04決定): 緑=結論・決定 / 藍=読み方・補足 / 紅=リスク・注意。
    # 琥珀(黄)のalertは作らない — 琥珀は「お金」の役割色で意味が二重になる
    extra_alerts = sorted(set(re.findall(r'(?<![\w-])alert-([a-z][a-z0-9-]*)', s)) - {'blue', 'green', 'red'})
    if extra_alerts:
        bad("alertの色は3種固定(緑=結論・決定 / 藍=読み方・補足 / 紅=リスク・注意。"
            f"琥珀のalertは作らず、課題はul.notesの※か.compare-box.badへ): {extra_alerts}")
    # 変更点バッジの語彙は4語に固定(2026-09-04決定): 決定済み(good) / 弊社提案(brand) / 変更点(brand) / 旧設計(muted)
    ENG_STATUS = {'changed', 'new', 'old', 'updated', 'update', 'deprecated',
                  'todo', 'wip', 'draft', 'fixed', 'added', 'removed', 'legacy', 'before', 'after'}
    for m in re.finditer(r'<span[^>]*class="[^"]*\b(?:badge|tag-[\w-]+)\b[^"]*"[^>]*>(.*?)</span>', s, re.S):
        txt = re.sub(r'<[^>]+>', '', m.group(1)).strip()
        if txt.lower() in ENG_STATUS:
            bad(f"変更点バッジが英字の語彙: '{txt}'(「決定済み」「弊社提案」「変更点」「旧設計」の4語に固定)")
    # ページ固有CSSの規約(2026-09-04追加。ページごとの再発明で規約が崩れるのを止める)
    for sel, dec in css_rules(s):
        # 色ベタの行ハイライトは使わない — 強調は焦がしの太字か td.std の薄い面で
        # <tr class="hl"> に対して CSS を「.hl td{…}」と書く形（tr. を省く）も拾う
        if ':hover' not in sel and re.search(r'(?:^|[\s,>])(?:tr)?\.[\w-]+[^{,]*\btd\b', sel):
            mv = re.search(r'(?<![\w-])background(?:-color)?\s*:\s*([^;!]+)', dec)
            if mv and mv.group(1).strip().lower() not in BG_NEUTRAL:
                bad(f"色ベタの行ハイライト(強調は焦がしの太字か td.std の薄い面で): {sel[:44]!r}")
        # 琥珀のバッジは語彙外 — バッジは ink/brand/good/plain/muted に固定(琥珀は「お金」の役割色)
        if re.search(r'\.badge\b', sel) and GOLD_TOKEN.search(dec):
            bad(f"琥珀のバッジ(バッジ語彙は ink/brand/mid/good/bad/plain/muted に固定。琥珀は「お金」の役割色): {sel[:44]!r}")
        # 沈めるのに opacity を使わない — 文字色と罫線をグレーに落とす(tr.muted / .option.dim と同じ思想)
        mo = re.search(r'(?<![\w-])opacity\s*:\s*([\d.]+)', dec)
        if mo:
            try:
                v = float(mo.group(1))
            except ValueError:
                v = 1.0
            if 0 < v < 1 and not (set(re.findall(r'\.([\w-]+)', sel)) & _TPL_OPACITY_CLASSES):
                bad(f"沈めるのにopacity(文字色と罫線をグレーに落として沈める): {sel[:40]!r} opacity:{mo.group(1)}")
    # 結論は「01章」として置く(2026-09-04改定)。章の外の専用の箱(旧 aside.conclusion / .conclusion-box)は廃止。
    # カタログ(specimen)は部品を文脈の外に展示するので対象外。
    if not specimen:
        msg = ('結論を章の外の箱で置いている(結論は01章にする: 章ナビの1番目に「1 結論」・'
               '最初の.section#conclusionのh2を「結論」に。補足はその章のul.notesへ)')
        for m in re.finditer(r'<(\w+)[^>]*\sclass="([^"]*)"', s):
            cls = m.group(2).split()
            if 'conclusion-box' in cls or (m.group(1).lower() == 'aside' and 'conclusion' in cls):
                bad(msg)
                break
        else:
            for sel, _dec in css_rules(s):
                if re.search(r'\.conclusion-box\b|aside\.conclusion\b', sel):
                    bad(f"結論用のCSSが残っている(結論は01章にする。この定義は削除する): {sel[:44]!r}")
                    break

    # --- 2026-09-14 検収レビューで追加した規約（A-2） ---
    # 3段階の重さ: 高=.badge.brand（焦がしベタ）/ 中=.badge.mid（白面・焦がし輪郭）/ 低=.badge.plain（罫線のみ）。
    # .badge.ink（黒ベタ）はページ内で唯一の最重要マークにだけ使う（並べると焦がしベタより重く見え、格付けが逆に読める）
    if not specimen:
        n_ink = sum(1 for m in re.finditer(r'<\w+[^>]*class="([^"]*)"', s)
                    if {'badge', 'ink'} <= set(m.group(1).split()))
        if n_ink >= 4:
            bad(f".badge.ink（黒ベタ）が{n_ink}個(ページ内で唯一の最重要マークにだけ使う。"
                "3段階の「中」は .badge.mid〈白面・焦がし輪郭〉へ)")
    # 章番号は常に1始まり。Step等の通し番号は見出し側（「Step 1.」）で持ち、章番号は動かさない
    if not specimen:
        secnums = [_text(m.group(1)) for m in re.finditer(r'<div class="section-num"[^>]*>(.*?)</div>', s, re.S)]
        if secnums and secnums[0] != '01':
            bad(f"章番号が01始まりでない(最初の章は「01 結論」。通し番号は見出し側で持つ): '{secnums[0]}'")
    # 小見出しの番号はハイフン式（「4-1」）。ドット式「7.1」は使わない
    for m in re.finditer(r'<h([34])[^>]*>(.*?)</h\1>', s, re.S):
        t = _text(m.group(2))
        if re.match(r'^\d+\.\d+', t):
            bad(f"小見出しの番号がドット式(ハイフン式「4-1」にする): {t[:24]!r}")
    # h2は1行（全角26字まで）。補足は sh-sub へ降ろす
    for m in re.finditer(r'<h2[^>]*>(.*?)</h2>', s, re.S):
        t = _text(m.group(1))
        if _zen_len(t) > 26:
            bad(f"h2が長い(1行=全角26字まで。「—」以降の補足はsh-subへ): {t[:40]!r}")
    # H1に副題を入れない（副題はリードに降ろす）
    for m in re.finditer(r'<h1[^>]*>(.*?)</h1>', s, re.S):
        if re.search(r'<\w', m.group(1)):
            bad(f"H1に子要素(副題・装飾はH1に入れず、リード文に降ろす): {m.group(1).strip()[:50]!r}")
    # 01章の副題（sh-sub）と結論本文を同文にしない。sh-sub=この章が何を扱うか / 本文=答え
    if not specimen:
        ci = s.find('id="conclusion"')
        if ci >= 0:
            seg = s[ci:ci + 8000]
            msub = re.search(r'class="sh-sub"[^>]*>(.*?)</div>', seg, re.S)
            mp = re.search(r'<p[^>]*>(.*?)</p>', seg, re.S)
            if msub and mp:
                def _key(t):
                    return re.sub(r'[\s　、。（）()「」『』・：:；;…—\-\u2010-\u2015]', '', t)
                sub = _key(_text(msub.group(1)))
                para = _key(re.split(r'。', _text(mp.group(1)))[0])
                pre = 0
                for _a, _b in zip(sub, para):
                    if _a != _b:
                        break
                    pre += 1
                if len(sub) >= 10 and len(para) >= 10 and (sub in para or para in sub or pre >= 10):
                    bad("01章の副題(sh-sub)と結論本文の1文目が同文"
                        f"(sh-sub=この章が何を扱うか / 本文=答え): {sub[:30]!r}")
    # ページ固有<style>で共通部品を再定義しない・新しい変種（.stat.win / .tag.geo 等）を作らない。
    # メディアクエリ内の調整と、.flow/.flow-tabs の列数指定は対象外
    seen_part_sel = set()
    # template.css を丸ごと <style> に埋め込む自己完結ページでは、本体と同じセレクタが大量に並ぶ。
    # 埋め込んだ版が古いだけで「再定義」が全部並ぶので、その場合は再定義チェックを外し、
    # 新しい変種（.stat.win 等・本体には無いセレクタ）だけを見る
    _page_sels = [re.sub(r'\s+', ' ', o).strip()
                  for sel, _d, _m in css_rules_ctx(s) for o in sel.split(',')]
    embedded_tpl = sum(1 for x in _page_sels if x in _TPL_RULES) >= 30
    for sel, dec, in_media in css_rules_ctx(s):
        if in_media:
            continue  # 狭い幅での調整は対象外
        for one in sel.split(','):
            one = re.sub(r'\s+', ' ', one).strip()
            if not one or one.startswith(('@', '%', 'from', 'to')):
                continue
            ndec = re.sub(r'\s+', '', dec)
            if ndec in _TPL_RULES.get(one, ()):
                continue  # template.css/parts.css を丸ごと<style>に埋め込んだ自己完結ページ（同一定義）
            if one in seen_part_sel:
                continue
            if one in _TPL_RULES and _part_class(one) and not embedded_tpl:  # 本体の部品セレクタを別の中身で上書き＝再定義
                seen_part_sel.add(one)
                bad("ページ固有CSSで共通部品を再定義している"
                    f"(本体の定義が効かなくなる。部品に寄せるか5点セットで本体を直す): {one[:44]!r}")
                continue
            hit = _part_violation(one)
            if hit:
                seen_part_sel.add(one)
                bad(f"ページ固有CSSで共通部品({hit[0]})の{hit[1]}"
                    f"(既存部品に寄せるか、5点セットで部品に昇格させる): {one[:44]!r}")

    # 図には主張を書く(原則11): 図の部品は <figure class="fig" aria-label="…"> で包む。
    # aria-label は見た目の説明でなく「読者に持ち帰ってほしい結論」を1文で。
    # カタログ(specimen)は部品を文脈の外に展示するので対象外。
    if not specimen:
        FIG_PARTS = ('lanes', 'swim', 'pflow', 'funnel', 'tilemap',
                     'stackbar', 'hbar', 'bars', 'chart', 'phases', 'gantt')
        # <figure>/</figure> の出現を走査して「いま figure の中か」を状態で持つ（2026-09-14）。
        # 旧実装は直前1200文字をさかのぼっていたため、.tilemap のように長いマークアップの後ろに
        # 置いた .hbar から figure が見えず誤検知していた（SKILL.md が推奨する併置そのものが NG になった）。
        # 図ごとに指摘する（break しない — 1ファイルの複数の図を1回の実行で出す）
        marks = [(m.start(), 'open', m.group(0)) for m in re.finditer(r'<figure\b[^>]*>', s)]
        marks += [(m.start(), 'close', None) for m in re.finditer(r'</figure\s*>', s)]
        marks += [(m.start(), 'part', m) for m in re.finditer(r'<(?:div|section)[^>]*class="([^"]*)"', s)]
        marks.sort(key=lambda t: t[0])
        cur_fig, cur_pos, done = None, -1, set()
        for pos, kind, payload in marks:
            if kind == 'open':
                cur_fig, cur_pos = payload, pos
                continue
            if kind == 'close':
                cur_fig, cur_pos = None, -1
                continue
            m = payload
            cls = m.group(1).split()
            part = next((p for p in FIG_PARTS if p in cls), None)
            if not part:
                continue
            # 表のセルの中の小さな棒（.hbar.cell）は図でなく数値の見せ方 — 対象外。
            # 部品として template.css に登録済み（2026-09-14）で、表全体を1つの figure で包むのが規約
            if 'cell' in cls:
                continue
            cell = s[max(0, m.start() - 600):m.start()]
            c = max(cell.rfind('<td'), cell.rfind('<th'))
            if c >= 0 and '</td>' not in cell[c:] and '</th>' not in cell[c:]:
                continue
            if cur_fig is None:
                bad(f'図に主張がない(<figure class="fig" aria-label="この図が言っていること"> で包む): .{part}')
                continue
            if cur_pos in done:  # 1つの figure に複数の図が入っている時は1回だけ
                continue
            if not re.search(r'aria-label\s*=\s*"[^"]{6,}"', cur_fig):
                done.add(cur_pos)
                bad(f'図のaria-labelが空か短すぎる(読者に持ち帰ってほしい結論を1文で): .{part}')

    # figure の中の svg に aria-label があると、figure の主張と二重に読み上げられる
    for m in re.finditer(r'<figure class="fig"[^>]*>(.*?)</figure>', s, re.S):
        for sv in re.finditer(r'<svg[^>]*aria-label="([^"]{4,})"', m.group(1)):
            bad(f'図の中のsvgにaria-label(figureの主張と二重に読まれる。svgはaria-hidden="true"に): {sv.group(1)[:34]!r}')

    for m in re.finditer(r'<div[^>]*class="([^"]*\bcompare-box\b[^"]*)"[^>]*>(.{0,200})', s, re.S):
        if ('bad' in m.group(1).split() or 'good' in m.group(1).split()) and 'cb-mark' not in m.group(2):
            bad("compare-boxに×○マーク(cb-mark)なし")
    # 表の字下げ: 全角空白の直書き禁止(td.label.indを使う — 2026-09-01にSEOレポートの旧方式から統一)
    for m in re.finditer(r'<td[^>]*class="[^"]*\blabel\b[^"]*"[^>]*>(\s*　[^<]{0,24})', s):
        bad(f"項目名の字下げに全角空白の直書き(td.label.indを使う): {m.group(1).strip()[:24]!r}")
    # 推奨の面(std)は1列だけ。2段ヘッダーの比較表(th-grpあり)では「1グループだけ」——
    # 推奨グループ配下は行内に複数のtd.stdが並ぶのが正しいので、行内チェックの代わりにstdグループ数を見る
    for tm in re.finditer(r'<table[^>]*>(.*?)</table>', s, re.S):
        tbl = tm.group(1)
        if 'th-grp' in tbl:
            n_grp_std = len(re.findall(r'<th[^>]*class="[^"]*\bth-grp\b[^"]*\bstd\b[^"]*"', tbl)) + \
                        len(re.findall(r'<th[^>]*class="[^"]*\bstd\b[^"]*\bth-grp\b[^"]*"', tbl))
            if n_grp_std > 1:
                bad(f"推奨の面(std)が{n_grp_std}グループ(面を着せるのは1グループだけ)")
            continue
        for tr in re.findall(r'<tr[^>]*>(.*?)</tr>', tbl, re.S):
            n_std = len(re.findall(r'<t[dh][^>]*class="[^"]*\bstd\b[^"]*"', tr))
            if n_std > 1:
                bad(f"推奨列の面(std)が1行に{n_std}セル(面を着せるのは1列だけ)")
                break
    # 見出しの階段は4段固定(原則4): 見出しタグへのinline font-size上書きは階段を崩す
    for m in re.finditer(r'<h([1-4])[^>]*style="[^"]*font-size[^"]*"', s):
        bad(f"h{m.group(1)}にfont-sizeの直書き(見出しの階段は4段固定・CSSに任せる)")
    # 差分表(.dtable) — 2026-09-24昇格。行の種別・原文の入れ物・凡例・トグルのscriptを揃える
    if re.search(r'class="[^"]*\bdtable\b', s):
        for m in re.finditer(r'<div[^>]*class="([^"]*\bdrow\b[^"]*)"', s):
            kinds = [k for k in ('eq', 'rep', 'del', 'ins') if k in m.group(1).split()]
            if len(kinds) != 1:
                bad(f"差分表の行(.drow)の種別はeq/rep/del/insのどれか1つ: {m.group(1)!r}")
        n_cell = len(re.findall(r'<div[^>]*class="[^"]*\bdcell\b[^"]*"', s))
        n_pre = len(re.findall(r'<div[^>]*class="[^"]*\bdcell\b[^"]*"[^>]*>\s*<pre\b', s))
        if n_cell != n_pre:
            bad(f"差分表のセル(.dcell)は原文を<pre>で持つ(加工しない・空行は&nbsp;): {n_cell - n_pre}個が<pre>でない")
        n_leg = len(re.findall(r'class="[^"]*\bdlegend\b', s))
        if n_leg == 0:
            bad("差分表に凡例がない(.dlegend を読み方ボックス.alert-blueの中にページで1枚)")
        elif n_leg > 1:
            bad(f"差分表の凡例(.dlegend)が{n_leg}枚(ページで1枚。差分表が複数ある章は最初の表の前か01章に)")
        if re.search(r'id="hl"', s) and not re.search(r"classList\.toggle\(\s*['\"]nohl['\"]", s):
            bad("差分の色トグル(#hl)があるのに body.nohl を切り替えるscriptがない(snippets.htmlの差分表のscript)")
    # 位置合わせ用の固定px幅の空白div禁止(原則12 — レーン格子に置き換える)
    if not mockup:
        for m in re.finditer(r'<div style="width:\s*\d+px;?\s*">\s*</div>', s):  # styleがwidthだけの空div=スペーサー(背景つきのサムネ見本等は対象外)
            bad(f"固定px幅の空白div(位置合わせはレーン格子.lanesで): {m.group(0)[:50]!r}")
        # 影は浮かぶ部品だけ(原則3)。CSS部品側の影はtemplate.cssにあるので、inlineのbox-shadowは違反
        for m in re.finditer(r'<(?!style)\w+[^>]*style="[^"]*box-shadow[^"]*"', s):
            bad(f"box-shadowの直書き(影は浮かぶ部品のCSSだけ): {m.group(0)[:60]!r}")
    # 部品への個別max-width禁止(原則3。カタログ=specimenは標本を小さく見せるため対象外・.slideの額は例外)
    if not specimen and not mockup:
        for m in re.finditer(r'<\w+[^>]*class="[^"]*\b(term|steps|notes|table-wrap|compare|card)\b[^"]*"[^>]*style="[^"]*max-width', s):
            bad(f"部品({m.group(1)})に個別max-width(コンテナ幅いっぱいに使う。例外は.slideの額だけ)")
    # スライドの表は5行まで(スライド共通規格)
    for m in re.finditer(r'class="slide[" ]', s):
        seg = s[m.end():m.end() + 12000]
        nxt = seg.find('class="slide')
        if nxt > 0:
            seg = seg[:nxt]
        t0 = seg.find('<table')
        if t0 >= 0:
            tbl = seg[t0:seg.find('</table>', t0)]
            rows = len(re.findall(r'<tr[^>]*>', tbl)) - (1 if '<thead' in tbl else 0)
            if rows > 5:
                bad(f"スライド内の表が{rows}行(5行まで — 超えるなら本文ページへ)")

    # --- 残骸 ---
    # コメントと <code>/<pre> の中は対象外 — 「原色#F95320は使わない」という説明の引用（guide.htmlの×の例）や、
    # template.css を丸ごと <style> に埋め込んだページのヘッダコメントを違反として拾わないため
    _sc = re.sub(r'<!--.*?-->', ' ', s, flags=re.S)
    _sc = re.sub(r'<style[^>]*>(.*?)</style>', lambda m: re.sub(r'/\*.*?\*/', ' ', m.group(0), flags=re.S), _sc, flags=re.S)
    lower = re.sub(r'<(code|pre)\b.*?</\1>', ' ', _sc, flags=re.S).lower()
    for color in OLD_COLORS:
        if color.lower() in lower:
            bad(f"旧様式の配色が直書き: {color}")
    found = [ch for ch in set(EMOJI.findall(s)) if ch not in allow_emoji]
    if found:
        bad(f"絵文字(アイコンはSVGスプライトを使う): {found}")

    # --- 文章規約(関数 text_rules に切り出し・デッキと共用) ---
    if not specimen:
        text_rules(s, bad)

    return issues, kicker, False, ('hero-logo' in s)


def main(argv):
    allow_emoji = set()
    multi_doc = False
    paths = []
    args = argv[1:]
    while args:
        a = args.pop(0)
        if a == '--allow-emoji':
            allow_emoji = set(args.pop(0))
        elif a == '--multi-doc':
            multi_doc = True
        elif os.path.isdir(a):
            paths += sorted(glob.glob(os.path.join(a, '**', '*.html'), recursive=True))  # サブフォルダも再帰（SPA構成対応）
        else:
            paths.append(a)
    if not paths:
        print(__doc__)
        return 2

    total = 0
    kickers = {}
    logo_state = {}
    for p in paths:
        issues, kicker, skipped, has_logo = lint_file(p, allow_emoji)
        if kicker:
            kickers.setdefault(kicker, []).append(os.path.basename(p))
        if has_logo is not None:
            logo_state.setdefault(has_logo, []).append(os.path.basename(p))
        tag = 'SKIP(ヒーローなし)' if skipped and not issues else ('NG' if issues else 'OK')
        print(f"{tag:4} {os.path.basename(p)}")
        for i in issues:
            print(f"     - {i}")
        total += len(issues)
    if len(logo_state) > 1 and not multi_doc:
        print("NG   ヒーローロゴの有無が混在(ロゴなし案件は全ページ省略・あり案件は全ページ設置):")
        for state, files in logo_state.items():
            print(f"     - {'あり' if state else 'なし'}: {len(files)}ファイル (例: {files[0]})")
        total += 1
    if len(kickers) > 1 and not multi_doc:
        print("NG   キッカー文言が割れている(全ページ統一する):")
        for k, files in kickers.items():
            print(f"     - '{k}': {len(files)}ファイル (例: {files[0]})")
        total += 1
    print(f"\n{len(paths)}ファイル / 指摘 {total}件" + ("" if total else " — ALL CLEAN"))
    return 1 if total else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
