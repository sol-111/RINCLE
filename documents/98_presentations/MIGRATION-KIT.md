# A案（誌面エディトリアル）移植キット — 全24ページ用

作成: 2026-08-21（Fable）。**判断はすべてこのキットで確定済み。実行者（Opus可）は迷ったらこのキットに従い、書いていないことは発明せず現状維持で報告する。**

## 0. 前提（実行者は最初にやること）

1. `/html-doc-design` スキルを読む（SKILL.md・template.css・snippets.html）
2. 見本を読む: `~/.claude/skills/html-doc-design/guide.html`（この様式の完成品）
3. **共有CSS化**: `template.css` を `documents/98_presentations/assets/design.css` にコピーして配置。各ページは`<style>`インラインではなく `<link rel="stylesheet" href="(相対)assets/design.css">` で参照する（GitHub Pages配信なので同一リポ参照OK。オフラインでも同一フォルダ構成なら開ける）。ページ固有CSSだけ各ページの`<style>`に残す
4. フォントlinkをInterから **Shippori Mincho+Noto Sans JP** に差し替え（snippets.html冒頭の雛形）
5. 順番: まず `proposal/seo/sitemap-creation-guide.html` を移植して**清野さんの確認を取り**、OK後に残りへ展開。1ページ完了ごとに検証（§5）

## 1. 旧→新の機械置換表（全ページ共通）

| 旧（パステル版） | 新（誌面版） | 備考 |
|---|---|---|
| `#F95320` / `#FF7A45` | `var(--accent)` #B8532F | グラデは廃止して単色 |
| `#D8400F` | `var(--accent-deep)` #8F3E20 | |
| `#FFF0EA` | `var(--accent-soft)` #F3E6DC（選択面）/ `--accent-faint` #F7F1EA（行ホバー） | |
| `#23201D` `#2E2A26` | `var(--ink)` #26221E / `--text` #57504A | |
| `#F8F6F3` | `var(--paper)` #FBF9F5 | |
| `#E9E4DE` / `#F2EEE9` | `--line` #DCD3C8 / `--line-soft` #E5DDD2 | |
| `#2563EB` | `--info` #3B5B84 | |
| `#1D9E5F` | `--ok` #3E6B4F | |
| `#C21B3A` | `--danger` #A8323E | |
| `#221B16`（コード面） | そのまま | 唯一のダーク面 |
| 影 `box-shadow`（カード類） | **削除**（罫線1pxに置換） | 影は浮遊部品（メニュー/モーダル/トースト/スライド額）のみ |
| 角丸 12〜24px | 4px（コード面5px・レーン枠6px） | |
| 数字チップのグラデsection-num | 薄い明朝大数字（.section-num） | |

構造の共通変換: ヒーロー→snippets雛形の`.hero`型 / 章ナビ→`.flow`（タブは`.flow-tabs`）/ 章の交互背景は design.css が自動適用（`.container>`と`.tab-panel>`両対応済み）/ ドーナツ中央は数字のみ / 表は`.table-wrap`型（上罫墨2px・項目名`td.label`明朝）。

## 2. ページ一覧と個別メモ

- **タブ維持（5）**: seo-guide, competitive-analysis, current-issues, ui-references +（他は非タブ）。タブは`.flow-tabs`のまま新トークンで
- **スイムレーンあり**: stripe/payment-flow → スキルの`.lanes`部品にクラスごと寄せてよい（構造一致）。bizflow 2枚は§3-A参照
- **ドーナツあり（7ページ）**: 線2.4化・中央数字のみ・凡例は罫線リスト型（guide/Chartsシート参照）
- **seo系4ページ・marketing 3・pay.jp 4・stripe 4・strategy残り3**: 共通変換のみで完結（固有図なし or 型あり）。機械的に実施
- 文言・情報は一切変更しない。落ちた情報ゼロを検証で保証

## 3. 型のない図の翻訳仕様（判断済み・ここが本キットの核）

### 3-A. bizflow/asis.html・tobe.html（大型フロー図）

役割色は**スキル原則11の固定色**に統一: ユーザー=`--info`藍 / 店舗=`--ok`緑 / システム・管理者=`--accent`焦がし / お金・通知=`--gold`琥珀 / 例外・エラー=`--danger`紅。

- `.swim-row/.swim-track/.swim-node/.swim-arrow`（横スイムレーン）: 構造維持。ノード=白面+1px `--line`・角丸4px、ラベルはNoto 11px 700。レーン帯の背景色は役割色の**面ではなく**、`.swim-label`に役割色の文字+8px丸ドット（`.lane-label`と同型）。矢印`.swim-arrow`は`--line`色・現在強調のみ`--accent`。例外分岐`.swim-branch-label`は紅文字+破線罫線
- `.pflow-*`（役割つき縦ステップ）: `.pflow-dot`を役割色の輪郭丸（塗りは白・線1.5px役割色・数字は明朝）に。`.pflow-actor`は役割色文字のキッカー。つなぎ線は`--line`1px
- `.tl-*`（フェーズ目次タイムライン）: スキルの`.phases`型に置換（done=墨/now=焦がし/予定=罫線色の上3px線）
- 凡例: スキルの`.legend`型に置換し全図の直下に配置

### 3-B. proposal/strategy/competitive-analysis.html（SWOT・競合カード）

- **SWOT 2×2**: 塗り面をやめ、4セルとも白面+1px `--line-soft`、各セルの**上3px罫線だけ役割色**（強み=`--ok` / 弱み=`--danger` / 機会=`--info` / 脅威=`--gold`）。セル見出しは役割色のキッカー（11px 700 字間0.16em）+明朝は使わない（表内なので）
- **競合カード（comp-card）**: 白面+1px `--line`・角丸4px・影なし。ヘッダーは社名を明朝18px、`.comp-num`は薄い明朝数字（rgba墨15%・40px）を右上に。RINCLE自社カードだけ罫線を`--accent`にして区別（塗らない）
- `.num-chip`: `ol.steps li::before`と同型（白面+accent輪郭+明朝数字）
- `.vs-section-label`: キッカー型（accent 11px 字間0.16em）
- 市場統計カード: スキル`.stat`型（左1px墨罫+明朝特大+日付つき出典）

### 3-C. proposal/strategy/ui-references.html（UIモック多数）

- **`.mockup`（UIモック）**: 中身の実機再現（アプリ画面・検索バー・地図ピン等）は**再現物なので現状の色を維持してよい**（原則の例外として明記済み）。ただし額縁を統一: すべてのモックをスキル「ウィンドウ」型の枠（白面+1px `--line`・上部にグレードット3つのタイトルバー・角丸6px）で包む。`.mock-label`はキッカー型に
- **`.ref-card`（参考サービス12社カード）**: 白面+1px罫線・影なし。`.card-number`は`.num-chip`同型（accent輪郭丸+明朝数字）。`.card-url`は`--sub`の小文字リンク。`.starbadge`は星文字をやめ**明朝数字+「/5」**（例「4.5 <small>/5</small>」accent色）— 星の絵文字的表現は原則8に抵触するため
- `.learn-points`: `ul.notes`型（※印）に置換
- `.ui-chip`: badge.plain型（選択中=badge.ink）
- Honda GO等のフィーチャーカード: 白面+罫線、見出し明朝

### 3-D. 共通の細部判断

- グラデーションは全廃（単色 or 罫線で置換）
- 絵文字が図中に残るページ（bizflowの👤🚲等）: **図の登場人物アイコンはSVG化**（スキルのスプライト+線1.5px。人物=circle+shoulders、既存iconに無ければ`<circle cx12 cy8 r3.5/><path d="M5 20a7 7 0 0 1 14 0"/>`で作る）
- KPI/統計カード列はすべて`.stat`型へ（枠カードをやめ左罫線型に）

## 4. 実行手順（1ページあたり）

1. 対象HTMLを読み、情報の一覧（見出し・表・図・数値・注記）をメモ
2. `<style>`を捨て、`<link href="…assets/design.css">`+ページ固有CSSのみに
3. 本文をsnippets雛形+§3仕様で組み直す（情報ゼロ欠落）
4. §5検証 → 合格したら次へ

## 5. 検証（各ページ必須・コピペ実行）

```bash
python3 - << 'EOF'
import re, sys
from html.parser import HTMLParser
f = 'PATH'  # 対象ページ
s = open(f).read()
class P(HTMLParser):
    def error(self, m): raise Exception(m)
P().feed(s)
o, c = len(re.findall(r'<div\b', s)), s.count('</div>')
old = [x for x in ['#F95320','#FF7A45','#F8F6F3','#E9E4DE','#2563EB','#1D9E5F','#C21B3A','Inter:wght'] if x in s]
btns = re.findall(r'data-target="([^"]+)"', s)
panels = re.findall(r'class="tab-panel[^"]*" id="([^"]+)"', s)
print('div', o, c, o==c, '| 旧値残存', old or 'なし', '| tabs', set(btns)==set(panels))
EOF
```

合格条件: パースOK・div一致・旧値残存なし（※本文の説明文中に色コードが「文字として」出る場合のみ許容）・タブ一致・`design.css`参照・ロゴ相対パス実在。

## 6. 完了後

- index.html（SPAシェル）: サイドバーを墨#26221E地+焦がしオレンジ差し色に、フォントも差し替え
- DESIGN.md を誌面エディトリアル版に全面改訂（スキルSKILL.mdの内容+RINCLE値で書き直し、旧版の経緯は「更新履歴」として残す）
- 全ページ一括検証 → コミット（日本語 `docs:`、pushは清野さんが手動）
- このキットは役目を終えたら削除してよい
