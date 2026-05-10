# -*- coding: utf-8 -*-
"""
完全版 Bubble To-Be CSV（As-Is 対応・変更区分付き）を生成する。

正規の編集ソース:
  - to_be_bubble_schema_core.tsv … 中核 To-Be 定義 + 既存 datatype マッピング（142 行）
  - 本スクリプト内 SUPPLEMENTAL … CMS 等（datatype 定義はあるがコア TSV に無い Thing）
出力:
  - rincle_to_be_bubble_schema_full.csv（リポジトリ上の参照用マスタ）
"""
from __future__ import annotations

import csv
from pathlib import Path

BASE = Path(__file__).resolve().parent
DTYPE_DIR = BASE / "datatype"
CORE_TSV = BASE / "to_be_bubble_schema_core.tsv"
OUT_CSV = BASE / "rincle_to_be_bubble_schema_full.csv"

COLUMNS = [
    "テーブル論理名(To-Be)",
    "テーブル名（日本語名）(To-Be)",
    "フィールド名(英語)",
    "フィールド名日本語",
    "フィールドタイプ",
    "refの場合のData TypeかOption Sets",
    "リストかどうか",
    "メモ（説明）",
    "既存datatype(As-Is)",
    "既存field_name(As-Is)",
    "変更区分",
]

SUPPLEMENTAL = [
    ("Access_log", "Access_log", "access_at", "アクセス日時", "Date", "", "No", "date→access_at", "Access_log", "date", "移行改名", ""),
    ("Access_log", "Access_log", "ip_address", "IPアドレス", "Text", "", "No", "", "Access_log", "ip", "継続", ""),
    ("Banner", "Banner", "title", "タイトル", "Text", "", "No", "", "Banner", "title", "継続", ""),
    ("Banner", "Banner", "content", "説明文", "Text", "", "No", "", "Banner", "content", "継続", ""),
    ("Banner", "Banner", "external_url", "外部URL", "Text", "", "No", "空白含むfield名を整理", "Banner", "external url", "移行改名", ""),
    ("Banner", "Banner", "image", "バナー画像", "Image", "", "No", "", "Banner", "image", "継続", ""),
    ("Banner", "Banner", "is_internal_page", "内部ページ", "Yes/No", "", "No", "", "Banner", "page", "移行改名", ""),
    ("Banner", "Banner", "internal_content", "内部本文", "Text", "", "No", "", "Banner", "page content", "移行改名", ""),
    ("FV", "FV", "title", "タイトル", "Text", "", "No", "", "FV", "title", "継続", ""),
    ("FV", "FV", "external_url", "外部URL", "Text", "", "No", "", "FV", "external URL", "移行改名", ""),
    ("FV", "FV", "image", "画像", "Image", "", "No", "", "FV", "image", "継続", ""),
    ("FV", "FV", "is_internal_page", "内部ページ", "Yes/No", "", "No", "", "FV", "page", "移行改名", ""),
    ("FV", "FV", "internal_content", "内部本文", "Text", "", "No", "", "FV", "page content", "移行改名", ""),
    ("News", "News", "title", "タイトル", "Text", "", "No", "", "News", "title", "継続", ""),
    ("News", "News", "body", "本文", "Text", "", "No", "", "News", "content", "移行改名", ""),
    ("News", "News", "external_url", "外部URL", "Text", "", "No", "", "News", "external url", "移行改名", ""),
    ("News", "News", "is_internal_page", "内部ページ", "Yes/No", "", "No", "", "News", "page", "移行改名", ""),
    ("News", "News", "internal_content", "内部本文", "Text", "", "No", "", "News", "page content", "移行改名", ""),
    ("Q_and_A", "Q&A", "title", "タイトル", "Text", "", "No", "", "Q&A", "title", "継続", ""),
    ("Q_and_A", "Q&A", "question", "質問", "Text", "", "No", "", "Q&A", "q", "移行改名", ""),
    ("Q_and_A", "Q&A", "answer", "回答", "Text", "", "No", "", "Q&A", "a", "移行改名", ""),
    ("Q_and_A", "Q&A", "sort_index", "表示順", "Number", "", "No", "", "Q&A", "index", "移行改名", ""),
    ("Q_and_A", "Q&A", "is_visible", "表示", "Yes/No", "", "No", "", "Q&A", "show", "移行改名", ""),
    ("Q_and_A_Category", "Q&A Category", "sort_index", "表示順", "Number", "", "No", "", "Q&A Category", "index", "継続", ""),
    ("Q_and_A_Category", "Q&A Category", "title", "カテゴリ名", "Text", "", "No", "", "Q&A Category", "title", "継続", ""),
    ("Webhook_Event", "Webhook_Event", "payload", "イベント本文", "Text", "", "No", "", "Webhook_Event", "text", "移行改名", ""),
    ("Webhook_Event", "Webhook_Event", "event_type", "種別", "Text", "", "No", "", "Webhook_Event", "type", "移行改名", ""),
    ("Site_Maintenance", "工事中（メンテ）", "enabled", "表示", "Yes/No", "", "No", "", "工事中", "yes/no", "移行改名", ""),
    ("Contact_Inquiry", "Contact_Inquiry", "customer_name", "氏名", "Text", "", "No", "", "お問い合わせ履歴", "名前", "移行改名", ""),
    ("Contact_Inquiry", "Contact_Inquiry", "message_body", "問い合わせ本文", "Text", "", "No", "表示名とfield逆の可能性", "お問い合わせ履歴", "メールアドレス", "要確認", ""),
    ("Contact_Inquiry", "Contact_Inquiry", "customer_email", "メール", "Text", "", "No", "表示名とfield逆の可能性", "お問い合わせ履歴", "内容", "要確認", ""),
    ("Contact_Inquiry", "Contact_Inquiry", "target_shop", "対象店舗", "Reference", "Shop", "No", "", "お問い合わせ履歴", "対象店舗", "移行先変更", ""),
    ("Contact_Inquiry", "Contact_Inquiry", "inquiry_type", "種別", "Reference", "Access_Rule", "No", "", "お問い合わせ履歴", "種別", "移行改名", ""),
    ("Contact_Inquiry", "Contact_Inquiry", "is_archived", "対応済み", "Yes/No", "", "No", "", "お問い合わせ履歴", "アーカイブ", "移行改名", ""),
    ("Access_Rule", "Access_Rule", "content_pattern", "パターン文字列", "Text", "", "No", "", "お問い合わせ種別", "内容", "継続", ""),
    ("Access_Rule", "Access_Rule", "target_right", "対象権限", "Option set", "Rights", "No", "", "お問い合わせ種別", "対象者", "移行改名", ""),
    ("Shop_Notification", "Shop_Notification", "shop", "対象店舗", "Reference", "Shop", "No", "", "管理者_運営_news", "shop", "移行先変更", ""),
    ("Shop_Notification", "Shop_Notification", "news_kind", "種別", "Option set", "管理者/運営_news_type", "No", "", "管理者_運営_news", "news_type", "継続", ""),
    ("Shop_Notification", "Shop_Notification", "target_right", "表示権限", "Option set", "Rights", "No", "", "管理者_運営_news", "right", "継続", ""),
    ("Shop_Notification", "Shop_Notification", "is_read", "既読", "Yes/No", "", "No", "", "管理者_運営_news", "viewed", "移行改名", ""),
    ("Shop_Notification", "Shop_Notification", "related_inquiry", "お問い合わせ", "Reference", "Contact_Inquiry", "No", "", "管理者_運営_news", "お問い合わせ", "移行改名", ""),
    ("Shop_Notification", "Shop_Notification", "related_fee_record", "月次手数料レコード", "Reference", "Monthly_Shop_Fee", "No", "sales_record=手数料月次", "管理者_運営_news", "請求", "移行改名", ""),
    ("Holiday", "Holiday（祝日・日付マスタ）", "target_date_extra", "日付(追加用マスタ)", "Date", "", "No", "追加マスタ統合", "日付データ 追加用", "date", "統合移行", ""),
]

EXTRA_CONSUMED = [
    ("Sub_Option", "name"),
    ("Sub_Option", "Shop"),
    ("Sub_Option", "is_archive"),
    ("Sub_Option", "貸出ステータス"),
    ("Holidays", "date"),
    ("日付データ Defaults", "date"),
    ("日付データ 追加用", "holiday"),
]

SPECIAL_ORPHAN = {
    ("予約情報", "________list_custom_______1"): ("構造変更", "Reservation_Line.reservation 逆参照へ"),
    ("自転車予約詳細", "乗車人情報"): ("廃止", "Reservation_Line に rider_* 直書き"),
}

LABEL_ALIASES = {
    "日付データ_Defaults": "日付データ Defaults",
    "日付データ_追加用": "日付データ 追加用",
}


def dtype_label(p: Path) -> str:
    s = p.stem
    rest = s.split("_", 1)[-1] if "_" in s else s
    return LABEL_ALIASES.get(rest, rest)


def load_core_tsv():
    rows = []
    with CORE_TSV.open(encoding="utf-8") as f:
        for row in csv.DictReader(f, delimiter="\t"):
            tt = row["テーブル論理名"].strip()
            tf = row["フィールド名"].strip()
            as_dt = (row.get("既存datatype") or "").strip() or None
            as_fn = (row.get("既存field_name") or "").strip() or None
            chg = (row.get("変更区分") or "").strip()
            m_des = (row.get("メモ_To-Be設計") or "").strip()
            m_map = (row.get("メモ_移行マッピング") or "").strip()
            memo = m_des
            if m_map and m_map not in ("-", ""):
                memo = (memo + "; " + m_map).strip("; ").strip() if memo else m_map
            refc = (row.get("refの場合のData TypeかOption Sets") or "").strip()
            rows.append(
                (
                    tt,
                    row.get("テーブル名（日本語名）", ""),
                    tf,
                    row.get("フィールド名日本語", ""),
                    row.get("フィールドタイプ", ""),
                    refc,
                    row.get("リストかどうか", ""),
                    memo,
                    as_dt or "",
                    as_fn or "",
                    chg or "要確認",
                )
            )
    return rows


def load_as_is():
    rows = []
    for p in sorted(DTYPE_DIR.glob("*.csv")):
        lab = dtype_label(p)
        with p.open(newline="", encoding="utf-8") as f:
            r = csv.DictReader(f)
            if not r.fieldnames or "field_name" not in r.fieldnames:
                continue
            for row in r:
                fn = (row.get("field_name") or "").strip()
                if fn:
                    rows.append((lab, fn))
    return rows


def main():
    out = []
    consumed = set()
    for tup in load_core_tsv():
        out.append(tup)
        as_dt, as_fn = tup[8], tup[9]
        if as_dt and as_fn:
            consumed.add((as_dt, as_fn))
    for t in EXTRA_CONSUMED:
        consumed.add(t)
    for sup in SUPPLEMENTAL:
        if len(sup) >= 10 and sup[8] and sup[9]:
            consumed.add((sup[8], sup[9]))
    out.extend(SUPPLEMENTAL)
    for dt, fn in load_as_is():
        if (dt, fn) in consumed:
            continue
        ch, extra = SPECIAL_ORPHAN.get((dt, fn), ("廃止", ""))
        out.append(("", "", "", "", "", "", "", extra, dt, fn, ch))
    with OUT_CSV.open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(COLUMNS)
        w.writerows(out)
    print("rows", len(out), "->", OUT_CSV)


if __name__ == "__main__":
    main()
