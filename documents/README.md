# Rincle ドキュメント

Rincle（スポーツバイクレンタルプラットフォーム）の設計ドキュメント一式。
`rincle-app` の Explorer で開いて閲覧・編集する。

## ディレクトリ構成

```
documents/
├── 0_sales/                        # 営業資料・議事録
│   ├── 1st_sales_meeting_minutes.txt
│   ├── 2nd_sales_meeting_minutes.txt
│   ├── 3rd_sales_meeting_minutes.txt
│   └── summary.md
│
├── 1_meeting_minutes/              # 定例議事録
│   ├── 3.31.txt
│   ├── 4.7.txt
│   ├── 4.10.txt
│   ├── 4.21.txt
│   ├── 5.1.txt
│   ├── 5.12.txt
│   ├── 5.15.txt
│   ├── 5.29.txt
│   ├── 6.12.txt
│   ├── 6.19.txt
│   ├── 6.30.txt
│   ├── task_list.md                #   タスクリスト
│   ├── 増永さん構想.md             #   決済フロー構想（増永さん作成・6/30受領）
│   └── 増永さん気になりリスト.md   #   定例での質問・宿題の追跡台帳（内部メモ）
│
├── 2_requirements/                 # 要件定義
│   ├── 00_overview/                # プロジェクト概要
│   │   ├── project_summary.md      #   プロジェクト概要
│   │   └── glossary.md             #   用語集
│   │
│   ├── 01_functional/              # 機能要件
│   │   ├── features.csv            #   画面設計書（画面・機能・改善点）
│   │   ├── screens.csv             #   画面一覧
│   │   ├── improvements.md         #   改善点一覧（E2Eテスト+コード分析）
│   │   └── improvements_ux.md      #   UX改善点一覧
│   │
│   ├── 02_flow/                    # フロー図（JSON → FlowViewer で表示）
│   │   ├── screenflow.json         #   画面遷移図
│   │   ├── bizflow-asis.json       #   業務フロー図（As-Is）
│   │   └── bizflow-tobe.json       #   業務フロー図（To-Be）
│   │
│   ├── 03_email/                   # メール設計
│   │   ├── emails.csv              #   メールテンプレート一覧
│   │   └── emails_config.csv       #   送信設定（差出人・フッター等）
│   │
│   ├── 04_integration/             # 外部連携
│   │   ├── pay.jp/                 #   Pay.JP 決済連携
│   │   │   ├── payjp-flow-asis.md          # クライアント向け: 現行の決済フロー（As-Is）
│   │   │   ├── payjp-api-v1-summary-ja.md     # 公式APIリファレンス日本語まとめ（v1）
│   │   │   ├── payjp-api-v2-summary-ja.md  # 公式APIリファレンス日本語まとめ（v2・2026-02提供開始）
│   │   │   ├── payjp-dev-reference.md      # 開発者向け: Bubble実装詳細・ワークフロー
│   │   │   └── payjp-issues.md             # 修正一覧（課題・改善点）
│   │   └── stripe/                 #   Stripe 移行
│   │       ├── stripe-api-summary-ja.md    # Stripe APIリファレンス日本語まとめ（RINCLE向け）
│   │       └── payjp-vs-stripe-comparison.md   # 決済基盤の方針（PayJP vs Stripe比較+移行計画を統合）
│   │
│   ├── 05_db/                      # DB設計（_index.csv → ErViewer で表示）
│   │   ├── _index.csv              #   テーブル/オプションセット一覧
│   │   ├── datatype/               #   テーブル定義（28テーブル）
│   │   │   ├── 01_Access_log.csv
│   │   │   ├── 02_Banner.csv
│   │   │   └── ...
│   │   └── optionset/              #   オプションセット定義（35セット）
│   │       ├── 01_Admin_info.csv
│   │       ├── 02_Admin_Sidebar.csv
│   │       └── ...
│   │
│   └── 06_module/                  # モジュール設計
│       ├── module_list.csv         #   モジュール一覧
│       ├── module_flow_admin.json  #   管理者モジュールフロー
│       ├── module_flow_shop.json   #   店舗モジュールフロー
│       └── module_flow_user.json   #   ユーザーモジュールフロー
│
├── 3_test/                         # テスト結果
│   ├── e2e_test_report.md          #   E2Eテスト実行レポート（84/85 passed）
│   └── payjp-test-mode-e2e.md     #   Pay.JPテストモード・E2Eテスト調査
│
├── 4_growth/                       # グロース（分析・提案 + マーケ実行）
│   ├── 01_strategy/                # 分析・提案（クライアント合意用）
│   │   ├── competitive-analysis.md #   競合調査（市場概況・競合詳細・SWOT・ペルソナ）
│   │   ├── differentiation-strategy.md  # 差別化戦略（vs 2027年競合参入・ポイント/店舗ロックイン案）
│   │   ├── current-issues-and-solutions.md  # 現状課題と解決策（ファネル分析・UIモック）
│   │   ├── action-plan.md          #   アクションプラン（Phase1〜4・KPI・費用）
│   │   ├── ui-ux-reference-catalog.md  # UI/UXリファレンスカタログ
│   │   ├── revenue-model.xlsx      #   収益モデルの正本（実態/論点/試算/KPIツリー・計画・進捗/出典の11+シート）
│   │   ├── shop-hearing-design.md  #   ショップヒアリング設計（仮説14×質問32・対象店舗実名）
│   │   ├── idea-log.md             #   施策・提携アイデア検討ログ（採否と理由・ボツ案も記録）
│   │   └── context/                #   本番DBエクスポート置き場（個人情報を含むためgitignore対象）
│   │
│   ├── 02_marketing/               # マーケティング戦略
│   │   ├── marketing-knowledge-map.md  # toCマーケ手法 全体マップ（汎用知識・約37手法）
│   │   ├── marketing-channels.md   #   toCマーケ手法一覧・ROI比較
│   │   └── marketing-personas.md   #   ペルソナ6種（A〜F、実データ検証状況つき）
│   │
│   ├── 03_seo/                     # SEO実務
│   │   ├── seo-setup-guide.md      #   SEO設定ガイド（GA4・Clarity導入手順含む）
│   │   ├── blog-seo-strategy.md    #   ブログSEOの方針（どこに/形式/ツール・#24統合・2026-06-24）
│   │   ├── seo-support-plan.md      #   SEO記事作成代行プラン（提案・2026-06-19）
│   │   ├── keyword-research.md     #   検索KW調査メモ（ロードバイク軸の定量裏付け・2026-06-12）
│   │   ├── seo_page_settings.csv   #   15画面分のtitle/description/OGP/h1/canonical
│   │   ├── sitemap/                # sitemap関連をまとめたフォルダ
│   │   │   ├── sitemap-creation-guide.md  # 作成手順（正本）
│   │   │   ├── generate_sitemap.js #   Data APIから生成するスクリプト
│   │   │   └── sitemap.xml         #   本番用（2026-08-21生成・408 URL）
│   │   └── seo-report/             # 先方向けSEOレポート（月次生成。**gitignore対象・push禁止** — 売上数字を公開リポジトリに載せないため。中身: 手順書+生成スクリプト+レポート置き場）
│   │
│   └── 04_analytics/               # 計測
│       └── ga4_tracking_items.csv  #   GA4計測項目一覧（41項目・KPI対応・Phase1〜3）
│
├── 98_presentations/               # 説明資料（HTML SPA）
│   ├── index.html                  #   SPA エントリポイント（サイドバーナビ）
│   ├── bizflow/                    #   業務フロー
│   │   ├── asis.html               #     As-Is フロー
│   │   └── tobe.html               #     To-Be フロー
│   ├── pay.jp/                     #   Pay.JP 決済連携
│   │   ├── asis.html               #     As-Is フロー
│   │   ├── api-v1-reference.html   #     APIリファレンス（v1）
│   │   ├── api-v2-reference.html   #     APIリファレンス（v2）
│   ├── proposal/                   #   提案資料（4_growthのmd構成とミラー）
│   │   ├── strategy/               #     戦略（01_strategy対応）
│   │   │   ├── competitive-analysis.html # 競合調査
│   │   │   ├── current-issues.html       # 現状課題
│   │   │   ├── action-plan.html          # アクションプラン
│   │   │   ├── differentiation-strategy.html # 差別化戦略
│   │   │   └── ui-references.html        # UI/UXリファレンス
│   │   ├── marketing/              #     マーケ（02_marketing対応）
│   │   │   ├── marketing-channels.html   # チャネル&ROI比較
│   │   │   ├── marketing-personas.html   # ペルソナ
│   │   │   └── marketing-knowledge-map.html # toCマーケ手法マップ
│   │   └── seo/                    #     SEO（03_seo対応）
│   │       ├── seo-guide.html            # SEO設定ガイド
│   │       ├── seo-support-plan.html     # SEO記事作成代行プラン
│   │       ├── blog-seo-strategy.html    # ブログSEOの方針（統合版）
│   │       └── keyword-research.html     # 検索キーワード調査
│   └── stripe/                     #   Stripe 関連
│       ├── api-reference.html      #     Stripe APIリファレンス
│       ├── payjp-vs-stripe.html    #     決済基盤の方針（比較+移行計画）
│       ├── payment-flow.html       #     予約・決済・貸出・返却フロー（7/3定例で決定）
│       └── receipt-invoice.html    #     領収書・インボイスの扱い（集約モデル・7/10報告）
│
└── 99_ receives/                   # クライアント提供資料（原本）
    ├── 仕様管理表.xlsx             #   検索・決済・料金・キャンセル等のケースロジック
    ├── questions.md                #   仕様の未確認事項・矛盾点まとめ
    ├── RINCLEクレジット支払いフロー.pdf
    ├── RINCLEバイク登録.pdf
    ├── RINCLE加盟店登録フロー.pdf
    ├── RINCLE加盟店管理画面初期設定マニュアル.pdf
    ├── RINCLE店舗でのバイク貸出フロー.pdf
    ├── rincle_sales_pitch_20260314.pdf
    ├── image/                      #   スクリーンショット（業務フロー図・UIキャプチャ）
    └── page/                       #   Luminous社 納品HTML（旧実装の参考資料）
        ├── index.html              #     タブナビゲーション（エントリポイント）
        ├── scope.html              #     改修スコープ（要件定義）
        ├── test_cases.html         #     テストケース一覧
        ├── flow_credit.html        #     クレジット支払いフロー図
        ├── flow_bike_reg.html      #     バイク登録フロー図
        ├── flow_store_reg.html     #     加盟店登録フロー図
        └── flow_bike_rental.html   #     バイク貸出フロー図
```

## ファイル形式と対応ビューア

| 拡張子 | ビューア | 編集 |
|--------|----------|------|
| `.csv` | CsvViewer（スプレッドシート） | 可 |
| `.json` | FlowViewer（フロー図エディタ） | 可 |
| `.md` | MdViewer（Markdownレンダリング） | 不可 |
| `.pdf` | MediaViewer | 不可 |
| `.html` | HtmlViewer（iframe） | 不可 |
| `.png` / `.jpg` | MediaViewer | 不可 |
| `.xlsx` | — （外部ツールで閲覧） | 不可 |
| `05_db/_index.csv` | ErViewer（ER図 + テーブル一覧 + オプションセット） | CSVを個別編集 |

## 番号体系

- フォルダの先頭番号（`0_`〜`4_`, `98_`, `99_`）は大分類の並び順
- サブフォルダの番号（`00_`, `01_`, ...）はセクションの並び順
- CSV ファイルの番号（`01_`, `02_`, ...）はエクスポート順
