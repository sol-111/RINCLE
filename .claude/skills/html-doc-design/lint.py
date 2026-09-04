#!/usr/bin/env python3
"""html-doc-design デザイン規約リント — 誌面エディトリアル様式のHTML資料を機械チェックする。

使い方:
  python3 lint.py <ディレクトリ or HTMLファイル...> [--allow-emoji "🥑👍"] [--multi-doc]
  --multi-doc: 資料集（SPA等・ページごとにキッカーが異なる構成）ではキッカー統一チェックを外す

チェック内容(構造検証で拾えない規約違反を検出する):
  構造   : HTMLパース可能・<div>開閉一致
  統一性 : ヒーロー部品(キッカー/資料番号/h1/リード)・キッカー文言・ロゴの有無が全ファイルで同一(ロゴ自体は任意)
           ロゴを置く場合の相対パス実在・footerに「正本:」・Webフォントlink・読み進みバー・演出スクリプト
           ヒーローに統計チップ/カードを置かない・footerに保守者向けの同期指示を書かない(HTMLコメントへ)
  章ナビ : flow/flow-tabsの存在・アンカーの解決・flowは8個以下・タブdata-targetとpanel idの完全一致
           タブ切替スクリプトが1つ・active初期状態・タブ9個以下
  部品   : statは「ラベル→数字」順(全変種)・recapの親はcontainer/tab-panel直下
           図の部品は<figure class="fig" aria-label="主張">で包む(原則11。カタログ=specimenは対象外)
           ul.notesに※の直書きなし・alertにSVGアイコン・compare-boxに×○マーク
           alertの色は3種固定(alert-blue/green/red以外を作らない。琥珀のalertは不採用)
           結論は01章として置く(章の外の専用の箱=aside.conclusion/.conclusion-box は廃止。specimenは対象外)
           変更点バッジの語彙(CHANGED/NEW等の英字を使わない=「決定済み/弊社提案/変更点/旧設計」の4語)
           fnumは英数字・表の字下げに全角空白の直書きなし(td.label.indを使う)
           推奨の面(std)は1列だけ(2段ヘッダーの比較表では1グループだけ)
           色ベタの行ハイライトなし(tr.xxx td{background} — 強調は焦がしの太字かtd.stdの薄い面で)
           琥珀のバッジなし(バッジ語彙はink/brand/good/plain/muted。琥珀は「お金」の役割色で意味が二重になる)
           沈めるのにopacityを使わない(文字色と罫線をグレーに落として沈める=tr.muted / .option.dim)
           見出しタグへのfont-size直書きなし(階段4段固定)・部品への個別max-widthなし(.slideの額は例外)
           固定px幅の空白divなし・inlineのbox-shadowなし(影は浮かぶ部品のCSSだけ)・スライド内の表は5行まで
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
    _tpl_colors = {c.upper() for c in re.findall(r'#[0-9A-Fa-f]{6}', open(_tpl, encoding='utf-8').read())}
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


def css_rules(s):
    """ページ固有の<style>内のCSSルールを (セレクタ, 宣言) で返す(コメントは除去済み)"""
    for m in re.finditer(r'<style[^>]*>(.*?)</style>', s, re.S):
        body = re.sub(r'/\*.*?\*/', '', m.group(1), flags=re.S)
        for r in re.finditer(r'([^{}]+)\{([^{}]*)\}', body):  # @media等の入れ子は中のルールだけ拾える
            yield r.group(1).strip(), r.group(2)


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
    # stat順: ブロック内で n が l より先に来たら違反(ラベル→数字→前月比)
    for m in re.finditer(r'<div class="stat">(.{0,500}?)(?=<div class="stat">|</div>\s*</div>|</footer>)', s, re.S):
        block = m.group(1)
        ni, li = block.find('class="n'), block.find('class="l"')
        if ni >= 0 and (li < 0 or ni < li):
            bad(f"statが数字→ラベル順(ラベルを上に): {block[:60].strip()!r}")
    for m in re.finditer(r'<ul class="notes"[^>]*>(.*?)</ul>', s, re.S):
        for li_html in re.findall(r'<li[^>]*>(.*?)</li>', m.group(1), re.S):
            text = re.sub(r'<[^>]+>', '', li_html).strip()
            if text.startswith('※'):
                bad(f"notes内に※直書き(CSSが付けるので二重になる): {text[:30]}…")
    for m in re.finditer(r'<div class="alert[^"]*">(.{0,120})', s, re.S):
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
        if ':hover' not in sel and re.search(r'\btr\.[\w-]+[^{,]*\btd\b', sel):
            mv = re.search(r'(?<![\w-])background(?:-color)?\s*:\s*([^;!]+)', dec)
            if mv and mv.group(1).strip().lower() not in BG_NEUTRAL:
                bad(f"色ベタの行ハイライト(強調は焦がしの太字か td.std の薄い面で): {sel[:44]!r}")
        # 琥珀のバッジは語彙外 — バッジは ink/brand/good/plain/muted に固定(琥珀は「お金」の役割色)
        if re.search(r'\.badge\b', sel) and GOLD_TOKEN.search(dec):
            bad(f"琥珀のバッジ(バッジ語彙は ink/brand/good/plain/muted に固定。琥珀は「お金」の役割色): {sel[:44]!r}")
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

    # 図には主張を書く(原則11): 図の部品は <figure class="fig" aria-label="…"> で包む。
    # aria-label は見た目の説明でなく「読者に持ち帰ってほしい結論」を1文で。
    # カタログ(specimen)は部品を文脈の外に展示するので対象外。
    if not specimen:
        FIG_PARTS = ('lanes', 'swim', 'pflow', 'funnel', 'tilemap',
                     'stackbar', 'hbar', 'bars', 'chart', 'phases')
        for m in re.finditer(r'<(?:div|section)[^>]*class="([^"]*)"', s):
            cls = m.group(1).split()
            part = next((p for p in FIG_PARTS if p in cls), None)
            if not part:
                continue
            # 表のセルの中の小さな棒（.hbar.cell 等）は図でなく数値の見せ方 — 対象外
            if 'cell' in cls:
                continue
            cell = s[max(0, m.start() - 600):m.start()]
            c = max(cell.rfind('<td'), cell.rfind('<th'))
            if c >= 0 and '</td>' not in cell[c:] and '</th>' not in cell[c:]:
                continue
            # 直前1200文字に <figure ... aria-label="…"> があり、その後に </figure> が来ていないか
            head = s[max(0, m.start() - 1200):m.start()]
            k = head.rfind('<figure')
            if k < 0 or '</figure>' in head[k:]:
                bad(f'図に主張がない(<figure class="fig" aria-label="この図が言っていること"> で包む): .{part}')
                break
            if not re.search(r'aria-label\s*=\s*"[^"]{6,}"', head[k:head.find('>', k) + 1 if head.find('>', k) > 0 else len(head)]):
                bad(f'図のaria-labelが空か短すぎる(読者に持ち帰ってほしい結論を1文で): .{part}')
                break

    # figure の中の svg に aria-label があると、figure の主張と二重に読み上げられる
    for m in re.finditer(r'<figure class="fig"[^>]*>(.*?)</figure>', s, re.S):
        for sv in re.finditer(r'<svg[^>]*aria-label="([^"]{4,})"', m.group(1)):
            bad(f'図の中のsvgにaria-label(figureの主張と二重に読まれる。svgはaria-hidden="true"に): {sv.group(1)[:34]!r}')

    for m in re.finditer(r'<div class="compare-box([^"]*)">(.{0,200})', s, re.S):
        if ('bad' in m.group(1) or 'good' in m.group(1)) and 'cb-mark' not in m.group(2):
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
    # 位置合わせ用の固定px幅の空白div禁止(原則11 — レーン格子に置き換える)
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
    lower = s.lower()
    for color in OLD_COLORS:
        if color.lower() in lower:
            bad(f"旧様式の配色が直書き: {color}")
    found = [ch for ch in set(EMOJI.findall(s)) if ch not in allow_emoji]
    if found:
        bad(f"絵文字(アイコンはSVGスプライトを使う): {found}")

    # --- 文章規約(2026-09-01追加。カタログ=specimenは見本文のため対象外) ---
    if not specimen:
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
            return tok.count('/') >= 2 or tok.endswith('/') or tok.startswith('/') or '/.' in tok
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
