# RINCLE プロジェクト

スポーツバイクレンタルPF「RINCLE」（運営: PEDALSTANDARD社・増永さん）の受託開発+グロース支援。
弊社（瀬野・山本）はDB再構築・バグ修正が本務で、収益分析・マーケ・SEOの提案も並走している。

## セッション開始時にまず読むもの（この順で・全部はコンテキストの無駄なので必要分だけ）

1. `documents/1_meeting_minutes/task_list.md` — タスク台帳と方針まとめ（現在地はここが正）
2. `documents/1_meeting_minutes/` の最新日付の議事録 — 直近の決定事項
3. 数字・収益の話 → `documents/4_growth/01_strategy/revenue-model.xlsx`（**収益モデルの正本**。openpyxlで読む。「出典と経緯」シートに全数字の根拠と検証履歴）

## リポジトリの地図

- `documents/README.md` — 全体のディレクトリ構成（詳細はここ）
- `documents/4_growth/` — グロース: `01_strategy/`（戦略md4本+revenue-model.xlsx+ヒアリング設計）/ `02_marketing/`（ペルソナA〜F・チャネルROI）/ `03_seo/` / `04_analytics/`
- `documents/98_presentations/` — クライアント向けHTML資料（SPA）。**mdが正本でHTMLは派生** — md更新時はproposal/配下の対応HTMLも同期すること。GitHub Pages（sol-111.github.io/RINCLE）で公開
- `documents/2_requirements/05_db/` — DB設計（ErViewer用CSV）
- `documents/4_growth/01_strategy/source/` — 本番DBエクスポート置き場（**gitignore対象・個人情報あり・コミット禁止**）

## このプロジェクトの約束事

- **数字には必ず出典**: revenue-model.xlsxの「出典と経緯」シートに数値→出典の対応を残す。誤分析も訂正履歴として消さずに記録
- **Excel成果物**: 先頭に「はじめに」読み方ガイドシート必須。色ルール=黄(入力可)/青(自動計算)/ピンク(仮置き・注意)。シート間参照は丸数字でなくシート名で
- **検索KW・文言は「ロードバイク」軸**（「スポーツバイク」では誰も検索しない — 6/12運営ヒアリングで確定）
- **店舗数の対外表記は未確定**（公式24店/DB54店。確認リスト#7でクライアント協議中）— 資料更新時は要注意
- ペルソナはA〜F（D=既存顧客が最重要。シニア層は2026-06-12に削除済み・経緯はpersonas md参照）
- コミットメッセージは日本語で `docs:`/`fix:` 等のプレフィックス。pushは瀬野さんが手動で行う

## 主要な未解決事項（詳細はtask_list.md）

- 紙請求の累計額とDB記録の突合 + KGI認識合わせ（#29・次回定例の山場）
- DB再構築が進行中（〜6月末目安）→ 完了後にSEO設定一式+GA4/Clarity設置（#21-22）
- Pay.jp（オーソリ前提）vs Stripe の再調査（#20）
