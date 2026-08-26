#!/usr/bin/env python3
"""html-doc-design デザイン規約リント — 誌面エディトリアル様式のHTML資料を機械チェックする。

使い方:
  python3 lint.py <ディレクトリ or HTMLファイル...> [--allow-emoji "🥑👍"] [--multi-doc]
  --multi-doc: 資料集（SPA等・ページごとにキッカーが異なる構成）ではキッカー統一チェックを外す

チェック内容(構造検証で拾えない規約違反を検出する):
  構造   : HTMLパース可能・<div>開閉一致
  統一性 : ヒーロー部品(ロゴ/キッカー/資料番号/h1/リード)・キッカー文言が全ファイルで同一
           footerに「正本:」・Webフォントlink・読み進みバー・演出スクリプト
  章ナビ : flow/flow-tabsの存在・アンカーの解決・タブdata-targetとpanel idの完全一致
           タブ切替スクリプトが1つ・active初期状態・タブ9個以下
  部品   : statは「ラベル→数字」順(全変種)・recapの親はcontainer/tab-panel直下
           ul.notesに※の直書きなし・alertにSVGアイコン・compare-boxに×○マーク
           fnumは英数字
  残骸   : トークン外の配色直書き(template.css自身が使う色は自動許可)・絵文字(許可リスト外)
  目視   : footerの正本パス(mdが正本の場合のみ必須=機械判定不能)・ロゴパス実在・背景交互・図解の役割色

exit code: 指摘ありなら1、クリーンなら0。
生成をエージェントに並列分担させた後は必ず実行すること(参照割れは構造検証では出ない)。
"""
import sys, re, glob, os
from html.parser import HTMLParser

OLD_COLORS = ['#F95320', '#23201D', '#B8532F', '#8F3E20', '#F3E6DC',
              '#FBF9F5', '#26221E', '#EAE2D6', '#F3EFE8', '#F6EFE9', '#221B16']
# デザインシステム自身（template.css）が使っている色は「直書き」でも正規とみなす
_tpl = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'template.css')
if os.path.exists(_tpl):
    _tpl_colors = {c.upper() for c in re.findall(r'#[0-9A-Fa-f]{6}', open(_tpl, encoding='utf-8').read())}
    OLD_COLORS = [c for c in OLD_COLORS if c.upper() not in _tpl_colors]
EMOJI = re.compile('[\U0001F300-\U0001FAFF☀-➿]')


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
        return issues, None, True

    # --- ヒーロー・共通部品 ---
    for token, label in [('hero-logo', 'ヒーローロゴ'), ('hero-no', '資料番号(hero-no)'),
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
    # 正本パスの明記はmdが正本の場合のみ必須のため機械判定しない（目視チェック）

    # --- 章ナビ / タブ ---
    is_tabs = 'flow-tabs' in s
    if not is_tabs and '<nav class="flow">' not in s:
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
            missing = [h for h in re.findall(r'href="#([^"]+)"', nav.group(0)) if h not in ids]
            if missing:
                bad(f"章ナビの迷子アンカー: {missing}")

    # --- 部品規約 ---
    for m in re.finditer(r'<span class="fnum">(.*?)</span>', s, re.S):
        inner = m.group(1)
        if '<svg' in inner:
            continue  # アイコンfnumは可
        text = re.sub(r'<[^>]+>', '', inner).strip()
        if not re.fullmatch(r'[0-9A-Za-z.¥✓]+', text):
            bad(f"fnumが英数字でない: '{text}'")
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
    for m in re.finditer(r'<div class="compare-box([^"]*)">(.{0,200})', s, re.S):
        if ('bad' in m.group(1) or 'good' in m.group(1)) and 'cb-mark' not in m.group(2):
            bad("compare-boxに×○マーク(cb-mark)なし")

    # --- 残骸 ---
    lower = s.lower()
    for color in OLD_COLORS:
        if color.lower() in lower:
            bad(f"旧様式の配色が直書き: {color}")
    found = [ch for ch in set(EMOJI.findall(s)) if ch not in allow_emoji]
    if found:
        bad(f"絵文字(アイコンはSVGスプライトを使う): {found}")

    return issues, kicker, False


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
    for p in paths:
        issues, kicker, skipped = lint_file(p, allow_emoji)
        if kicker:
            kickers.setdefault(kicker, []).append(os.path.basename(p))
        tag = 'SKIP(ヒーローなし)' if skipped and not issues else ('NG' if issues else 'OK')
        print(f"{tag:4} {os.path.basename(p)}")
        for i in issues:
            print(f"     - {i}")
        total += len(issues)
    if len(kickers) > 1 and not multi_doc:
        print("NG   キッカー文言が割れている(全ページ統一する):")
        for k, files in kickers.items():
            print(f"     - '{k}': {len(files)}ファイル (例: {files[0]})")
        total += 1
    print(f"\n{len(paths)}ファイル / 指摘 {total}件" + ("" if total else " — ALL CLEAN"))
    return 1 if total else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
