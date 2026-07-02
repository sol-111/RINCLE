# RINCLE プロジェクト

スポーツバイクレンタルPF「RINCLE」（運営: PEDALSTANDARD社・増永さん）の受託開発+グロース支援。
弊社（清野・山本）はDB再構築・バグ修正が本務で、収益分析・マーケ・SEOの提案も並走している。

## セッション開始時にまず読むもの（この順で・全部はコンテキストの無駄なので必要分だけ）

1. `documents/1_meeting_minutes/task_list.md` — タスク台帳と方針まとめ（現在地はここが正）
2. `documents/1_meeting_minutes/` の最新日付の議事録 — 直近の決定事項
3. 数字・収益の話 → `documents/4_growth/01_strategy/revenue-model.xlsx`（**収益モデルの正本**。openpyxlで読む。「出典と経緯」シートに全数字の根拠と検証履歴）

## リポジトリの地図

- `documents/README.md` — 全体のディレクトリ構成（詳細はここ）
- `documents/4_growth/` — グロース: `01_strategy/`（戦略md4本+revenue-model.xlsx+ヒアリング設計）/ `02_marketing/`（ペルソナA〜F・チャネルROI）/ `03_seo/` / `04_analytics/`
- `documents/98_presentations/` — クライアント向けHTML資料（SPA）。**mdが正本でHTMLは派生** — md更新時はproposal/配下の対応HTMLも同期すること。GitHub Pages（sol-111.github.io/RINCLE）で公開
- `documents/2_requirements/05_db/` — DB設計（ErViewer用CSV）
- `documents/4_growth/01_strategy/context/` — 本番DBエクスポート置き場（**gitignore対象・個人情報あり・コミット禁止**）

## このプロジェクトの約束事

- **数字には必ず出典**: revenue-model.xlsxの「出典と経緯」シートに数値→出典の対応を残す。誤分析も訂正履歴として消さずに記録
- **Excel成果物**: 先頭に「はじめに」読み方ガイドシート必須。色ルール=黄(入力可)/青(自動計算)/ピンク(仮置き・注意)。シート間参照は丸数字でなくシート名で
- **検索KW・文言は「ロードバイク」軸**（「スポーツバイク」では誰も検索しない — 6/12運営ヒアリング+Googleサジェストで定量裏付け済み: `4_growth/03_seo/keyword-research.md`）
- **店舗数の対外表記は「全国100店舗以上」で決め打ちの方向・確定待ち**（6/19概ね合意・#33で増永さん側が決定。DB実数は54店〈2026-06-11〉）— 資料更新時は要注意
- ペルソナはA〜F（D=既存顧客が最重要。シニア層は2026-06-12に削除済み・経緯はpersonas md参照）
- コミットメッセージは日本語で `docs:`/`fix:` 等のプレフィックス。pushは清野さんが手動で行う

## 主要な未解決事項（2026-07-02時点・詳細はtask_list.md）

- DB再構築ほぼ完了 → 本番リリースは7/6(月)か7/7(火)予定（検索速度改善込み・6/30定例）。リリース後にSEO設定一式+GA4/Clarity設置（#21-22。**GA4設置時にGoogle広告アカウントも開設してKW実数を取得する** — keyword-research.md。開発版URLのGA計測除外も#44）
- **決済はStripe載せ替えで決定（6/19・実装#35）**。増永さんの決済フロー構想（`1_meeting_minutes/増永さん構想.md`＝予約時カード登録+有効性確認・当日チェックインで本決済）を弊社が図に整理し、実装可否+アドバイスを7/4定例で報告。比較の正本: `2_requirements/04_integration/stripe/payjp-vs-stripe-comparison.md`。デポジットは今回スコープ外で確定（6/30）
- **ブログは6/30に方針更新**: 当面**サブドメイン**で増永さんがClaude Code製の静的LPを自走量産（WordPress・サブディレクトリ〈リバースプロキシ〉は保留）。note併用は変わらず。**サブディレクトリvsサブドメインのSEO差の洗い出しが弊社宿題**。正本: `4_growth/03_seo/blog-seo-strategy.md` §0（旧note-vs-owned-blog等はここに統合済み）
- KGI/KPI目標は凍結中（実績の月次記録は継続・ユーザー増と差別化実装後に設定。紙請求突合#29は中止 — 2026-06-12清野さん判断）
