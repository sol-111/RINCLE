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
│   └── task_list.md                #   タスクリスト
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
│   │   │   ├── payjp-flow-tobe.md          # クライアント向け: To-Be 支払い・予約フロー
│   │   │   ├── payjp-api-summary-ja.md     # 公式APIリファレンス日本語まとめ
│   │   │   ├── payjp-dev-reference.md      # 開発者向け: Bubble実装詳細・ワークフロー
│   │   │   ├── payjp-authorization-guide.md # オーソリ実装ガイド
│   │   │   └── payjp-issues.md             # 修正一覧（課題・改善点）
│   │   ├── stripe/                 #   Stripe 移行
│   │   │   └── stripe-migration-plan.md    # Stripe移行計画
│   │   └── payjp-vs-stripe-comparison.md   # PayJP vs Stripe 比較
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
├── 4_proposal/                     # 提案資料
│   ├── 01_competitive-analysis.md  #   競合調査
│   ├── 02_current-issues-and-solutions.md  # 現状課題と解決策
│   ├── 03_action-plan.md           #   アクションプラン
│   ├── 04_seo-setup-guide.md       #   SEO設定ガイド
│   └── 05_ui-ux-reference-catalog.md  # UI/UXリファレンスカタログ
│
├── 98_presentations/               # 説明資料（HTML SPA）
│   ├── index.html                  #   SPA エントリポイント（サイドバーナビ）
│   ├── bizflow/                    #   業務フロー
│   │   ├── asis.html               #     As-Is フロー
│   │   └── tobe.html               #     To-Be フロー
│   ├── pay.jp/                     #   Pay.JP 決済連携
│   │   ├── asis.html               #     As-Is フロー
│   │   ├── tobe.html               #     To-Be フロー
│   │   ├── api-reference.html      #     APIリファレンス
│   │   ├── dev-reference.html      #     開発者リファレンス
│   │   ├── authorization-guide.html #    オーソリガイド
│   │   └── issues.html             #     修正一覧
│   ├── proposal/                   #   提案資料
│   │   ├── 01_competitive-analysis.html  # 競合調査
│   │   ├── 02_current-issues.html        # 現状課題
│   │   ├── 03_action-plan.html           # アクションプラン
│   │   ├── 04_seo-guide.html             # SEOガイド
│   │   └── 05_ui-references.html         # UI/UXリファレンス
│   └── stripe/                     #   Stripe 関連
│       ├── migration-plan.html     #     Stripe移行計画
│       └── payjp-vs-stripe.html    #     PayJP vs Stripe 比較
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

- フォルダの先頭番号（`0_`, `1_`, `2_`, `3_`, `99_`）は大分類の並び順
- サブフォルダの番号（`00_`, `01_`, ...）はセクションの並び順
- CSV ファイルの番号（`01_`, `02_`, ...）はエクスポート順
