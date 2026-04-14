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
│   │   └── pay.jp/                 #   Pay.JP 決済連携
│   │       ├── payjp-flow-asis.md                # 現行の決済フロー仕様（As-Is）
│   │       ├── payjp-api-summary-ja.md          # API一覧・概要
│   │       ├── payjp-flow-tobe.md                # To-Be 支払い・予約フロー統合版
│   │       ├── payjp-rincle-bubble-usage.md     # Bubble既存実装のPay.jp利用箇所
│   │       └── payjp-test-mode-e2e.md           # テストモード・E2Eテスト調査
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

- フォルダの先頭番号（`0_`, `1_`, `99_`）は大分類の並び順
- サブフォルダの番号（`00_`, `01_`, ...）はセクションの並び順
- CSV ファイルの番号（`01_`, `02_`, ...）はエクスポート順
