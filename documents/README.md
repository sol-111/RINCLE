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
├── 1_requirements/                 # 要件定義
│   ├── 00_overview/                # プロジェクト概要
│   │   ├── project_summary.md      #   プロジェクト概要
│   │   └── glossary.md             #   用語集
│   │
│   ├── 01_functional/              # 機能要件
│   │   ├── features.csv            #   画面設計書（画面・機能・改善点）
│   │   └── screens_improvements.md #   画面別の改善提案
│   │
│   ├── 02_flow/                    # フロー図（JSON → FlowViewer で表示）
│   │   ├── screenflow.json         #   画面遷移図
│   │   └── bizflow.json            #   業務フロー図
│   │
│   ├── 03_email/                   # メール設計
│   │   ├── emails.csv              #   メールテンプレート一覧
│   │   └── emails_config.csv       #   送信設定（差出人・フッター等）
│   │
│   ├── 04_integration/             # 外部連携
│   │   └── payjp_integration.md    #   Pay.JP 決済フロー仕様
│   │
│   └── 05_db/                      # DB設計（_index.csv → ErViewer で表示）
│       ├── _index.csv              #   テーブル/オプションセット一覧
│       ├── datatype/               #   テーブル定義（27テーブル）
│       │   ├── 01_user.csv
│       │   ├── 02_bicycle.csv
│       │   └── ...
│       └── optionset/              #   オプションセット定義（25セット）
│           ├── 01_Rights.csv
│           ├── 02_予約ステータス.csv
│           └── ...
│
└── 99_ receives/                   # クライアント提供資料（原本）
    ├── *.pdf                       #   業務フロー・マニュアル等のPDF
    ├── image/                      #   スクリーンショット
    └── page/                       #   Luminous社 納品HTML（旧実装の参考資料）
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
| `05_db/_index.csv` | ErViewer（ER図 + テーブル一覧 + オプションセット） | CSVを個別編集 |

## 番号体系

- フォルダの先頭番号（`0_`, `1_`, `99_`）は大分類の並び順
- サブフォルダの番号（`00_`, `01_`, ...）はセクションの並び順
- CSV ファイルの番号（`01_`, `02_`, ...）はエクスポート順
