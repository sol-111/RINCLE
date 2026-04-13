#!/usr/bin/env node
// ── Generate DB CSV files from seed data ──────────────────────────
// Parses seed.sql + migrations and outputs CSV files to 05_db/

import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

const BASE = '/Users/shoki.seino/Documents/rincle/documents/1_requirements/05_db'
const DT_DIR = join(BASE, 'datatype')
const OS_DIR = join(BASE, 'optionset')

// ── CSV helper ────────────────────────────────────────────────────
function csvEscape(v) {
  const s = String(v ?? '')
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
}
function toCsv(headers, rows) {
  const lines = [headers.map(csvEscape).join(',')]
  for (const row of rows) lines.push(headers.map(h => csvEscape(row[h] ?? '')).join(','))
  return lines.join('\n') + '\n'
}

// ── TABLE DESCRIPTIONS ────────────────────────────────────────────
const TABLE_DESC = {
  user:               'ユーザー（事業者・加盟店）。認証・プロフィール・Pay.JP決済情報を管理。アプリの中心テーブル',
  bicycle:            '自転車情報。加盟店が登録する貸出可能な自転車。料金プランと紐づく',
  price_menu:         '料金プラン。時間・日・週・月単位の単価を管理。自転車に紐づく',
  option:             'オプション商品。自転車に追加できるアクセサリ等。加盟店ごとに管理',
  sub_option:         'サブオプション。オプションの詳細・数量・単価。対応自転車を複数持てる',
  prefecture:         '都道府県マスタ。ショップのサービスエリア管理',
  q_a:                'よくある質問と回答。カテゴリに紐づく',
  q_a_category:       'FAQカテゴリ。Q&Aの分類に使用',
  news:               'お知らせ。管理者・運営からユーザーへの通知',
  banner:             'バナー広告。トップページ等に表示する画像+リンク',
  fv:                 'ファーストビュー。トップページのヒーロー画像・リンク',
  holidays:           '祝日マスタ。貸出不可日の管理に使用',
  access_log:         'アクセスログ。ユーザーの訪問日時・IPを記録',
  webhook_event:      'Webhookイベント。Pay.JPなど外部サービスからの通知を記録',
  reservation:        '予約情報。貸出・返却・決済の中心テーブル。明細・オプション価格と紐づく',
  booking_customer:   '予約顧客情報。会員登録なしで予約した顧客の氏名・連絡先',
  reservation_detail: '予約明細。予約ごとの自転車・料金プラン・金額の詳細',
  option_price:       'オプション価格。予約に紐づくオプション金額の記録',
  shop_schedule:      'ショップスケジュール。特定日の営業状態と対象自転車を管理',
  business_hours:     '営業時間設定。曜日・期間ごとの営業時間ルール',
  sales_record:       '売上記録。月次集計・振込処理用のデータ',
  shop_notification:  'ショップ通知。お問い合わせ・請求・キャンセル等の通知',
  contact_inquiry:    'お問い合わせ。ユーザーからの問い合わせフォームデータ',
  ip_rights:          'IPベースのアクセス制御',
  holiday_defaults:   '祝日デフォルト設定',
  holiday_master:     '祝日マスタ（マスタテーブル）',
  reservation_count:  '予約カウント。手数料計算の補助テーブル',
}

// ── Map bubble names to English names ─────────────────────────────
const BUBBLE_TO_ENG = {
  'user': 'user',
  'bicycle': 'bicycle',
  'price_menu': 'price_menu',
  'option': 'option',
  'sub_option': 'sub_option',
  'prefecture': 'prefecture',
  'q_a': 'q_a',
  'q_a_category': 'q_a_category',
  'news': 'news',
  'banner': 'banner',
  'fv': 'fv',
  'holidays': 'holidays',
  'access_log': 'access_log',
  'webhook_event': 'webhook_event',
  '____ (reservation)': 'reservation',
  '_____ (booking_customer)': 'booking_customer',
  '_______1 (reservation_detail)': 'reservation_detail',
  '_________1 (option_price)': 'option_price',
  '_______ (shop_schedule)': 'shop_schedule',
  '___________ (business_hours)': 'business_hours',
  '______ (sales_record)': 'sales_record',
  '_______news (shop_notification)': 'shop_notification',
  '________1 (contact_inquiry)': 'contact_inquiry',
  '________ (ip_rights)': 'ip_rights',
  '______defaults': 'holiday_defaults',
  '_________ (holiday_master)': 'holiday_master',
  '______1 (reservation_count)': 'reservation_count',
}

// Reverse mapping for ref_target resolution
function resolveRefTarget(raw) {
  if (!raw) return ''
  // Already an English name?
  if (TABLE_DESC[raw]) return raw
  // Bubble format like '_____ (booking_customer)'
  if (BUBBLE_TO_ENG[raw]) return BUBBLE_TO_ENG[raw]
  // Try to extract parenthetical
  const m = raw.match(/\((\w+)\)/)
  if (m) return m[1]
  return raw
}

// ── SEED DATA (from seed.sql + migration_db_fields_update.sql) ───
// Each entry: [field_id, bubble_table_name, field_name, display_name, required, ix, dtype, list, ref_target_raw, notes]
// When bubble_table_name is '', it inherits from the previous non-empty entry
const SEED = [
  // ── user ──
  ['1', 'user', '____1_text', '事業者名', false, false, 'text', false, '', ''],
  ['2', '', 'name_text', '氏名', false, false, 'text', false, '', ''],
  ['3', '', 'name_kana_text', '氏名（カナ）', false, false, 'text', false, '', ''],
  ['4', '', 'shop_name_text', '店舗名', false, false, 'text', false, '', ''],
  ['5', '', 'shop_address_text', '店舗住所', false, false, 'text', false, '', ''],
  ['6', '', 'shop_access_text', '店舗アクセス', false, false, 'text', false, '', ''],
  ['7', '', 'shop_comment_text', '店舗コメント', false, false, 'text', false, '', ''],
  ['8', '', 'business_hour_text', '営業時間', false, false, 'text', false, '', ''],
  ['9', '', 'address_text', '住所', false, false, 'text', false, '', ''],
  ['10', '', 'contact_mail_text', '連絡用メール', false, false, 'text', false, '', ''],
  ['11', '', 'hp_text', 'ホームページURL', false, false, 'text', false, '', ''],
  ['12', '', 'phone_text', '電話番号', false, false, 'text', false, '', ''],
  ['13', '', 'post_number_number', '郵便番号', false, false, 'number', false, '', ''],
  ['14', '', 'birth_date', '生年月日', false, false, 'date', false, '', ''],
  ['15', '', 'last_visit_date', '最終訪問日', false, false, 'date', false, '', ''],
  ['16', '', 'image_image', 'プロフィール画像', false, false, 'image', false, '', ''],
  ['17', '', 'cus_id_text', 'Pay.JP 顧客ID', false, false, 'text', false, '', ''],
  ['18', '', 'shop_pay_real_text', 'Pay.JP 公開鍵（本番）', false, false, 'text', false, '', '⚠️ ハードコードリスク'],
  ['19', '', 'user_id_payjp_text', 'Pay.JP ユーザーID', false, false, 'text', false, '', ''],
  ['20', '', 'tenant_id_text', 'テナントID', false, false, 'text', false, '', ''],
  ['21', '', 'tall_number', '身長', false, false, 'number', false, '', ''],
  ['22', '', '_______number', '前日貸し出し設定値', false, false, 'number', false, '', ''],
  ['23', '', 'shop_onboading_boolean', 'オンボーディング完了', false, false, 'boolean', false, '', ''],
  ['24', '', 'is____boolean', 'フラグ①', false, false, 'boolean', false, '', ''],
  ['25', '', 'cart_custom_____', 'カート参照', false, false, 'ref', false, 'reservation', ''],
  ['26', '', 'prefecture_custom_prefecture', '都道府県', false, false, 'ref', false, 'prefecture', ''],
  ['27', '', 'right_option_rights', 'アクセス権限', false, false, 'option', false, '', 'Rights'],
  ['28', '', 'reviewed_brand_option_brand_status', 'ブランドレビュー', false, false, 'option', false, '', 'brand_status'],
  ['29', '', '______list_option______', '支払い方法', false, false, 'option', true, '', '支払い方法'],
  // migration additions for user
  ['207', 'user', '____text', '担当者名', false, false, 'text', false, '', ''],
  ['208', '', '_____text', '認証番号', false, false, 'text', false, '', ''],
  ['209', '', 'phone1_text', '電話番号②', false, false, 'text', false, '', ''],
  ['210', '', 'car_id_text', 'car_id', false, false, 'text', false, '', ''],
  ['211', '', 'archive_boolean', 'アーカイブ済み', false, false, 'boolean', false, '', ''],
  ['212', '', 'is__________boolean', 'キャンペーン通知', false, false, 'boolean', false, '', ''],
  ['213', '', 'business_address_text', '事業者住所', false, false, 'text', false, '', ''],
  ['214', '', 'pay_jp_apply_form_url_text', 'Pay.JP申請URL(text)', false, false, 'text', false, '', ''],
  ['215', '', 'pay_jp_apply_form_url_user', 'Pay.JP申請URL(user参照)', false, false, 'ref', false, 'user', ''],

  // ── bicycle ──
  ['30', 'bicycle', 'name_text', '自転車名', true, false, 'text', false, '', ''],
  ['31', '', 'brand_name_text', 'ブランド名', false, false, 'text', false, '', ''],
  ['32', '', 'color_text', 'カラー', false, false, 'text', false, '', ''],
  ['33', '', 'size_text', 'サイズ', false, false, 'text', false, '', ''],
  ['34', '', 'serial_number_text', 'シリアル番号', false, true, 'text', false, '', ''],
  ['35', '', 'comment_text', 'コメント', false, false, 'text', false, '', ''],
  ['36', '', 'no_number', '管理番号', false, true, 'number', false, '', ''],
  ['37', '', 'max_date_number', '最大貸出日数', false, false, 'number', false, '', ''],
  ['38', '', 'ebike_boolean', '電動アシスト', false, false, 'boolean', false, '', ''],
  ['39', '', 'is_archive_boolean', 'アーカイブ済み', false, false, 'boolean', false, '', ''],
  ['40', '', 'images_list_image', '画像', false, false, 'image', true, '', ''],
  ['41', '', 'a_hour_price_number', '時間単価', false, false, 'number', false, '', ''],
  ['42', '', 'a_day_price_number', '日単価', false, false, 'number', false, '', ''],
  ['43', '', 'a_week_price_number', '週単価', false, false, 'number', false, '', ''],
  ['44', '', 'a_month_price_number', '月単価', false, false, 'number', false, '', ''],
  ['45', '', 'two_weeks_price_number', '2週間単価', false, false, 'number', false, '', ''],
  ['46', '', 'three_weeks_price_number', '3週間単価', false, false, 'number', false, '', ''],
  ['47', '', 'four_weeks_price_number', '4週間単価', false, false, 'number', false, '', ''],
  ['48', '', '1_______number', '1〜6日単価', false, false, 'number', false, '', ''],
  ['49', '', '7__13__number', '7〜13日単価', false, false, 'number', false, '', ''],
  ['50', '', '14__29__number', '14〜29日単価', false, false, 'number', false, '', ''],
  ['51', '', 'tax_percent_number', '税率', false, false, 'number', false, '', ''],
  ['52', '', 'shop_user', '所属ショップ', true, false, 'ref', false, 'user', ''],
  ['53', '', 'price_menu_custom_price_menu', '料金プラン', false, false, 'ref', false, 'price_menu', ''],
  ['54', '', 'bicycle_category_option_bicycle_category', '自転車カテゴリ', false, false, 'option', false, '', 'Bicycle Category'],
  // migration additions for bicycle
  ['216', 'bicycle', '_____1_______number', '（税抜き）1日プラン料金', false, false, 'number', false, '', ''],
  ['217', '', '_____1_____number', '（税抜き）4時間プラン料金', false, false, 'number', false, '', ''],
  ['218', '', '_____1____number', '（税抜き）3日間プラン料金', false, false, 'number', false, '', ''],
  ['219', '', '_____1____1_number', '（税抜き）2日間プラン料金', false, false, 'number', false, '', ''],
  ['220', '', '_____1____2_number', '（税抜き）7日間プラン料金', false, false, 'number', false, '', ''],
  ['221', '', '_____7__13__number', '（税抜き）14日間プラン料金', false, false, 'number', false, '', ''],
  ['222', '', '_____14__29__number', '（税抜き）30日間プラン料金', false, false, 'number', false, '', ''],
  ['223', '', '_______1____number', '（税抜き）延長1日料金', false, false, 'number', false, '', ''],
  ['224', '', '_______1_____number', '（税抜き）延長1時間料金', false, false, 'number', false, '', ''],
  ['225', '', 'more_a_day_price_number', '延長日単価', false, false, 'number', false, '', ''],
  ['226', '', 'more_a_hour_price_number', '延長時間単価', false, false, 'number', false, '', ''],
  ['227', '', '________option____________', '貸出ステータス', false, false, 'option', false, '', '貸し出し可能ステータス'],

  // ── price_menu ──
  ['55', 'price_menu', 'name_text', 'プラン名', true, false, 'text', false, '', ''],
  ['56', '', 'default_boolean', 'デフォルトフラグ', false, false, 'boolean', false, '', ''],
  ['57', '', 'for_simulation_boolean', 'シミュレーション用', false, false, 'boolean', false, '', ''],
  ['58', '', 'a_hour_price_number', '時間単価', false, false, 'number', false, '', ''],
  ['59', '', 'a_day_price_number', '日単価', false, false, 'number', false, '', ''],
  ['60', '', 'a_week_price_number', '週単価', false, false, 'number', false, '', ''],
  ['61', '', 'a_month_price_number', '月単価', false, false, 'number', false, '', ''],
  ['62', '', 'two_weeks_price_number', '2週間単価', false, false, 'number', false, '', ''],
  ['63', '', 'three_weeks_price_number', '3週間単価', false, false, 'number', false, '', ''],
  ['64', '', 'four_weeks_price_number', '4週間単価', false, false, 'number', false, '', ''],
  ['65', '', '14____________number', '14日〜単価', false, false, 'number', false, '', ''],
  ['66', '', '30____________number', '30日〜単価', false, false, 'number', false, '', ''],
  ['67', '', '_7____________number', '7日〜単価', false, false, 'number', false, '', ''],
  ['68', '', 'more_a_day_price_number', '追加日単価', false, false, 'number', false, '', ''],
  ['69', '', 'more_a_hour_number', '追加時間単価', false, false, 'number', false, '', ''],
  ['70', '', 'tax_percent_number', '税率', false, false, 'number', false, '', ''],
  ['71', '', 'shop_user', '所属ショップ', true, false, 'ref', false, 'user', ''],

  // ── option ──
  ['72', 'option', 'name_text', 'オプション名', true, false, 'text', false, '', ''],
  ['73', '', 'description_text', '説明', false, false, 'text', false, '', ''],
  ['74', '', '________option__________', '難読化オプション', false, false, 'option', false, '', ''],
  ['75', '', 'shop_user', '所属ショップ', true, false, 'ref', false, 'user', ''],

  // ── sub_option ──
  ['76', 'sub_option', 'name_text', 'サブオプション名', true, false, 'text', false, '', ''],
  ['77', '', 'description_text', '説明', false, false, 'text', false, '', ''],
  ['78', '', 'max_number_number', '最大数量', false, false, 'number', false, '', ''],
  ['79', '', 'is_archive_boolean', 'アーカイブ済み', false, false, 'boolean', false, '', ''],
  ['80', '', 'a_hour_price_number', '時間単価', false, false, 'number', false, '', ''],
  ['81', '', 'a_day_price_number', '日単価', false, false, 'number', false, '', ''],
  ['82', '', 'a_week_price_number', '週単価', false, false, 'number', false, '', ''],
  ['83', '', 'a_month_price_number', '月単価', false, false, 'number', false, '', ''],
  ['84', '', 'two_weeks_price_number', '2週間単価', false, false, 'number', false, '', ''],
  ['85', '', 'four_weeks_price_number', '4週間単価', false, false, 'number', false, '', ''],
  ['86', '', 'tax_percent_number', '税率', false, false, 'number', false, '', ''],
  ['87', '', 'parent_option_custom_option', '親オプション', false, false, 'ref', false, 'option', ''],
  ['88', '', 'bicycles_list_custom_bicycle', '対応自転車', false, false, 'ref', true, 'bicycle', ''],
  ['89', '', 'shop_user', '所属ショップ', true, false, 'ref', false, 'user', ''],
  // migration additions for sub_option
  ['228', 'sub_option', '7________number', '7日間プラン料金', false, false, 'number', false, '', ''],
  ['229', '', '14________number', '14日間プラン料金', false, false, 'number', false, '', ''],
  ['230', '', '30________number', '30日間プラン料金', false, false, 'number', false, '', ''],
  ['231', '', '_____1____number', '（税抜き）1日プラン料金', false, false, 'number', false, '', ''],
  ['232', '', '_____1_____number', '（税抜き）3日間プラン料金', false, false, 'number', false, '', ''],
  ['233', '', '_____1____1_number', '（税抜き）4時間プラン料金', false, false, 'number', false, '', ''],
  ['234', '', '_____1____2_number', '（税抜き）2日間プラン料金', false, false, 'number', false, '', ''],
  ['235', '', '_______1____number', '（税抜き）延長1日料金', false, false, 'number', false, '', ''],
  ['236', '', '_______1_____number', '（税抜き）延長1時間料金', false, false, 'number', false, '', ''],
  ['237', '', '_____7________number', '（税抜き）7日間プラン料金', false, false, 'number', false, '', ''],
  ['238', '', '_____14________number', '（税抜き）14日間プラン料金', false, false, 'number', false, '', ''],
  ['239', '', '_____30________number', '（税抜き）30日間プラン料金', false, false, 'number', false, '', ''],
  ['240', '', 'more_a_day_price_number', '延長日単価', false, false, 'number', false, '', ''],
  ['241', '', 'more_a_hour_price_number', '延長時間単価', false, false, 'number', false, '', ''],
  ['242', '', 'three_weeks_price_number', '3週間単価', false, false, 'number', false, '', ''],
  ['243', '', '________option____________', '貸出ステータス', false, false, 'option', false, '', '貸し出し可能ステータス'],
  ['244', '', 'number0_list_custom________', 'number0（営業日リスト）', false, false, 'ref', true, 'shop_schedule', ''],
  ['245', '', 'number1_list_custom________', 'number1（営業日リスト）', false, false, 'ref', true, 'shop_schedule', ''],
  ['246', '', 'number2_list_custom________', 'number2（営業日リスト）', false, false, 'ref', true, 'shop_schedule', ''],
  ['247', '', 'number3_list_custom________', 'number3（営業日リスト）', false, false, 'ref', true, 'shop_schedule', ''],
  ['248', '', 'number4_list_custom________', 'number4（営業日リスト）', false, false, 'ref', true, 'shop_schedule', ''],
  ['249', '', 'number5_list_custom________', 'number5（営業日リスト）', false, false, 'ref', true, 'shop_schedule', ''],
  ['250', '', 'number1_custom________', 'number1（営業日）', false, false, 'ref', false, 'shop_schedule', ''],
  ['251', '', 'number2_custom________', 'number2（営業日）', false, false, 'ref', false, 'shop_schedule', ''],

  // ── prefecture ──
  ['90', 'prefecture', 'name_text', '都道府県名', true, false, 'text', false, '', ''],
  ['91', '', 'index_number', 'ソート順', false, false, 'number', false, '', ''],
  ['92', '', 'shop_user', '所属ショップ', false, false, 'ref', false, 'user', ''],
  ['93', '', 'shoplist_list_user', '該当ショップ一覧', false, false, 'ref', true, 'user', ''],

  // ── q_a ──
  ['94', 'q_a', 'title_text', 'タイトル', true, false, 'text', false, '', ''],
  ['95', '', 'q_text', '質問', true, false, 'text', false, '', ''],
  ['96', '', 'a_text', '回答', true, false, 'text', false, '', ''],
  ['97', '', 'show_boolean', '表示フラグ', false, false, 'boolean', false, '', ''],
  ['98', '', 'index_number', '表示順①', false, false, 'number', false, '', ''],
  ['99', '', 'index1_number', '表示順②', false, false, 'number', false, '', ''],
  ['100', '', 'category_custom_q_a_category', 'カテゴリ（参照）', false, false, 'ref', false, 'q_a_category', ''],
  ['101', '', 'category_option_q_a_category', 'カテゴリ（OptionSet）', false, false, 'option', false, '', 'q_a_category'],

  // ── q_a_category ──
  ['102', 'q_a_category', 'title_text', 'カテゴリ名', true, false, 'text', false, '', ''],
  ['103', '', 'index_number', '表示順', false, false, 'number', false, '', ''],

  // ── news ──
  ['104', 'news', 'title_text', 'タイトル', true, false, 'text', false, '', ''],
  ['105', '', 'content_text', '本文', false, false, 'text', false, '', ''],
  ['106', '', 'page_boolean', '内部ページフラグ', false, false, 'boolean', false, '', ''],
  ['107', '', 'page_content_text', '内部ページコンテンツ', false, false, 'text', false, '', ''],
  ['108', '', 'external_url_text', '外部URL', false, false, 'text', false, '', ''],
  ['109', '', 'rights_option_rights', '表示権限', false, false, 'option', false, '', 'Rights'],

  // ── banner ──
  ['110', 'banner', 'title_text', 'タイトル', true, false, 'text', false, '', ''],
  ['111', '', 'content_text', '説明文', false, false, 'text', false, '', ''],
  ['112', '', 'external_url_text', '外部URL', false, false, 'text', false, '', ''],
  ['113', '', 'image_image', 'バナー画像', false, false, 'image', false, '', ''],
  ['114', '', 'page_boolean', '内部ページフラグ', false, false, 'boolean', false, '', ''],
  ['115', '', 'page_content_text', '内部ページコンテンツ', false, false, 'text', false, '', ''],

  // ── fv ──
  ['116', 'fv', 'title_text', 'タイトル', true, false, 'text', false, '', ''],
  ['117', '', 'external_url_text', '外部URL', false, false, 'text', false, '', ''],
  ['118', '', 'image_image', '画像', false, false, 'image', false, '', ''],
  ['119', '', 'page_boolean', '内部ページフラグ', false, false, 'boolean', false, '', ''],
  ['120', '', 'page_content_text', '内部ページコンテンツ', false, false, 'text', false, '', ''],

  // ── holidays ──
  ['121', 'holidays', 'date_date', '日付', true, false, 'date', false, '', ''],

  // ── access_log ──
  ['122', 'access_log', 'date_date', 'アクセス日時', true, false, 'date', false, '', ''],
  ['123', '', 'ip_text', 'IPアドレス', false, false, 'text', false, '', ''],

  // ── webhook_event ──
  ['124', 'webhook_event', 'text_text', 'イベント本文', false, false, 'text', false, '', ''],
  ['125', '', 'type_text', 'イベント種別', false, false, 'text', false, '', ''],

  // ── reservation ──
  ['126', '____ (reservation)', '____1_number', '予約番号', false, true, 'number', false, '', ''],
  ['127', '', '____date', '貸出日', true, false, 'date', false, '', ''],
  ['128', '', '___1_date', '返却日', true, false, 'date', false, '', ''],
  ['129', '', '_____number', '合計金額', false, false, 'number', false, '', ''],
  ['130', '', '____2_number', '延長料金', false, false, 'number', false, '', ''],
  ['131', '', 'charge_id_text', 'Pay.JP チャージID', false, false, 'text', false, '', ''],
  ['132', '', '__charge_id_text', 'Pay.JP チャージID②', false, false, 'text', false, '', ''],
  ['133', '', 'token_text', '決済トークン', false, false, 'text', false, '', ''],
  ['134', '', '_______boolean', 'ステータス①', false, false, 'boolean', false, '', ''],
  ['135', '', '________boolean', 'ステータス②', false, false, 'boolean', false, '', ''],
  ['136', '', '_____boolean', 'ステータス③', false, false, 'boolean', false, '', ''],
  ['137', '', '___user', 'ユーザー', true, false, 'ref', false, 'user', ''],
  ['138', '', '________list_custom_______1', '予約明細リスト', false, false, 'ref', true, 'reservation_detail', ''],
  ['139', '', '__________list_custom__________1', 'オプション価格リスト', false, false, 'ref', true, 'option_price', ''],
  ['140', '', '________option___yesno', 'Yes/No選択', false, false, 'option', false, '', 'yes/no'],
  // migration additions for reservation
  ['199', '____ (reservation)', '______date', '延長返却日', false, false, 'date', false, '', ''],
  ['200', '', '______text', '支払い方法', false, false, 'text', false, '', ''],
  ['201', '', '___id_text', '返金ID', false, false, 'text', false, '', ''],
  ['202', '', '____1_boolean', '返金済み', false, false, 'boolean', false, '', ''],
  ['203', '', '_________number', '手数料デフォルト', false, false, 'number', false, '', ''],
  ['204', '', '__charge_id1_text', '返金charge_id', false, false, 'text', false, '', ''],
  ['205', '', '____custom_______1', '手数料', false, false, 'ref', false, 'reservation_count', ''],
  ['206', '', '______option________', 'ステータス', false, false, 'option', false, '', '予約ステータス'],

  // ── booking_customer ──
  ['141', '_____ (booking_customer)', 'name_text', '氏名', false, false, 'text', false, '', ''],
  ['142', '', 'name_kana_text', '氏名（カナ）', false, false, 'text', false, '', ''],
  ['143', '', 'email_text', 'メールアドレス', false, false, 'text', false, '', ''],
  ['144', '', 'phone_text_text', '電話番号', false, false, 'text', false, '', ''],
  ['145', '', 'address_text', '住所', false, false, 'text', false, '', ''],
  ['146', '', 'signup_user_boolean', '会員登録フラグ', false, false, 'boolean', false, '', ''],
  ['147', '', '_____number', '数値②', false, false, 'number', false, '', ''],
  ['148', '', '_____date', '日付', false, false, 'date', false, '', ''],
  // migration additions
  ['256', '_____ (booking_customer)', '___text', '住所（bubble key）', false, false, 'text', false, '', ''],
  ['257', '', '___number', '身長', false, false, 'number', false, '', ''],
  ['258', '', '____1_number', '郵便番号', false, false, 'number', false, '', ''],

  // ── reservation_detail ──
  ['149', '_______1 (reservation_detail)', '____date', '貸出日', true, false, 'date', false, '', ''],
  ['150', '', '___1_date', '返却日', true, false, 'date', false, '', ''],
  ['151', '', '_____number', '合計金額', false, false, 'number', false, '', ''],
  ['152', '', '____1_number', '金額①', false, false, 'number', false, '', ''],
  ['153', '', '____2_number', '金額②', false, false, 'number', false, '', ''],
  ['154', '', '____custom_bicycle', '自転車', true, false, 'ref', false, 'bicycle', ''],
  ['155', '', 'price_menu_custom_price_menu', '料金プラン', false, false, 'ref', false, 'price_menu', ''],
  ['156', '', '______custom______', '乗車人情報参照', false, false, 'ref', false, 'booking_customer', ''],
  ['157', '', '_____custom_____', '予約情報参照', false, false, 'ref', false, 'reservation', ''],
  ['158', '', '__________list_custom__________1', 'オプション価格リスト', false, false, 'ref', true, 'option_price', ''],
  ['159', '', '___user', 'ユーザー', false, false, 'ref', false, 'user', ''],

  // ── option_price ──
  ['160', '_________1 (option_price)', '___number', '金額', false, false, 'number', false, '', ''],
  ['161', '', 'price_menu_custom_price_menu', '料金プラン', false, false, 'ref', false, 'price_menu', ''],
  ['162', '', '______custom_sub_option', 'サブオプション', false, false, 'ref', false, 'sub_option', ''],

  // ── shop_schedule ──
  ['163', '_______ (shop_schedule)', '___date', '対象日', true, false, 'date', false, '', ''],
  ['164', '', 'starttime_option_time', '開始時間', false, false, 'option', false, '', 'Time'],
  ['165', '', 'endtime_option_time', '終了時間', false, false, 'option', false, '', 'Time'],
  ['166', '', '____user', '所属ショップ', true, false, 'ref', false, 'user', ''],
  ['167', '', '_____option_____op', 'スケジュール区分', false, false, 'option', false, '', '営業状態op'],
  ['168', '', '__________s_list_custom_bicycle', '対象自転車リスト', false, false, 'ref', true, 'bicycle', ''],

  // ── business_hours ──
  ['169', '___________ (business_hours)', 'startdate_date', '開始日', true, false, 'date', false, '', ''],
  ['170', '', 'enddate_date', '終了日', true, false, 'date', false, '', ''],
  ['171', '', 'starttime_option_time', '開始時間', false, false, 'option', false, '', 'Time'],
  ['172', '', 'endtime_option_time', '終了時間', false, false, 'option', false, '', 'Time'],
  ['173', '', '____user', '所属ショップ', true, false, 'ref', false, 'user', ''],
  ['174', '', '_____option_____op', 'スケジュール区分', false, false, 'option', false, '', '営業状態op'],
  ['175', '', '___option___', '曜日区分', false, false, 'option', false, '', '曜日'],
  ['176', '', '___boolean', 'フラグ', false, false, 'boolean', false, '', ''],

  // ── sales_record ──
  ['177', '______ (sales_record)', 'date_date', '記録日', true, false, 'date', false, '', ''],
  ['178', '', '__number', '金額①', false, false, 'number', false, '', ''],
  ['179', '', '_1_number', '金額②', false, false, 'number', false, '', ''],
  ['180', '', '____number', '金額③', false, false, 'number', false, '', ''],
  ['181', '', '___boolean', '処理済みフラグ', false, false, 'boolean', false, '', ''],
  ['182', '', 'shop_user', '所属ショップ', true, false, 'ref', false, 'user', ''],
  // migration addition
  ['252', '______ (sales_record)', '__________option__________', '振り込みステータス', false, false, 'option', false, '', '振り込みステータス'],

  // ── shop_notification ──
  ['183', '_______news (shop_notification)', 'viewed_boolean', '既読フラグ', false, false, 'boolean', false, '', ''],
  ['184', '', 'shop_user', '所属ショップ', true, false, 'ref', false, 'user', ''],
  ['185', '', 'right_option_rights', '表示権限', false, false, 'option', false, '', 'Rights'],
  ['186', '', 'news_type_option________news_type', '通知種別', false, false, 'option', false, '', '管理者/運営_news_type'],
  // migration additions
  ['253', '_______news (shop_notification)', '___custom_______', '請求参照', false, false, 'ref', false, 'sales_record', ''],
  ['254', '', '_______custom_________1', 'お問い合わせ参照', false, false, 'ref', false, 'contact_inquiry', ''],

  // ── contact_inquiry ──
  ['187', '________1 (contact_inquiry)', '__1_text', '氏名', false, false, 'text', false, '', ''],
  ['188', '', '___text', 'メールアドレス', false, false, 'text', false, '', ''],
  ['189', '', '________text', '本文', false, false, 'text', false, '', ''],
  ['190', '', '______boolean', '対応済みフラグ', false, false, 'boolean', false, '', ''],
  ['191', '', '_____user', 'ユーザー参照', false, false, 'ref', false, 'user', ''],
  // migration addition
  ['255', '________1 (contact_inquiry)', '___custom_________', '種別', false, false, 'ref', false, 'ip_rights', 'お問い合わせ種別テーブル参照'],

  // ── ip_rights ──
  ['192', '________ (ip_rights)', '___text', 'IPアドレス等', false, false, 'text', false, '', ''],
  ['193', '', '____option_rights', 'アクセス権限', false, false, 'option', false, '', 'Rights'],

  // ── holiday_defaults ──
  ['194', '______defaults', 'date_date', '日付', true, false, 'date', false, '', ''],
  ['195', '', 'holiday_boolean', '祝日フラグ', false, false, 'boolean', false, '', ''],

  // ── holiday_master ──
  ['196', '_________ (holiday_master)', 'date_date', '日付', true, false, 'date', false, '', ''],
  ['197', '', 'hliday_boolean', '祝日フラグ', false, false, 'boolean', false, '', 'typo: holiday'],

  // ── reservation_count ──
  ['198', '______1 (reservation_count)', 'number_number', '数値', false, false, 'number', false, '', ''],
]

// ── OPTION SETS (from ErTab.tsx OS_DATA) ──────────────────────────
const OPTION_SETS = [
  { name: 'Rights', desc: 'ユーザー / 加盟店 / 管理者のアクセス権限', attrs: [], options: [{d:'ユーザー'},{d:'加盟店'},{d:'管理者'}] },
  { name: '予約ステータス', desc: '貸出中・来客待ち・返却済み等、予約の進行状態', attrs: [], options: [{d:'貸出中'},{d:'来客待ち'},{d:'返却済み'},{d:'キャンセル'},{d:'仮情報'},{d:'キャンセル（返金なし）'}] },
  { name: '決済ステータス', desc: '決済済み・未決済・返金済み等、支払い状態', attrs: [], options: [{d:'決済済み'},{d:'未決済'},{d:'返金済み'},{d:'キャンセル'}] },
  { name: '振り込みステータス', desc: '振込済 / 未振込', attrs: [], options: [{d:'振込済'},{d:'未振込'}] },
  { name: '支払い方法', desc: '店頭決済 / クレカ決済', attrs: [], options: [{d:'店頭決済'},{d:'クレカ決済'}] },
  { name: '貸し出し可能ステータス', desc: '自転車のユーザー表示フラグ', attrs: [], options: [{d:'ユーザー表示'},{d:'ユーザー非表示'}] },
  { name: 'brand_status', desc: 'ブランドレビューの審査状態', attrs: [], options: [{d:'passed'},{d:'in_review'},{d:'declined'},{d:'before_review'}] },
  { name: 'Bicycle Category', desc: '自転車カテゴリ（ロード・クロス・MTB等）', attrs: [], options: [{d:'ロードバイク'},{d:'クロスバイク'},{d:'マウンテンバイク'},{d:'小径車'},{d:'キッズ'}] },
  { name: 'yes/no', desc: 'True/False の汎用フラグ', attrs: ['yes','yes_no'], options: [{d:'yes',v:['yes','True']},{d:'no',v:['no','False']}] },
  { name: '営業状態op', desc: '営業 / 休業', attrs: [], options: [{d:'営業'},{d:'休業'}] },
  { name: '予約管理並び替え', desc: '予約一覧の並び順オプション', attrs: [], options: [{d:'貸出日時が新しい順'},{d:'貸出日時が古い順'},{d:'予約が新しい順'},{d:'予約が古い順'}] },
  { name: '管理者/運営_news_type', desc: 'お知らせ種別（お問い合わせ・請求/入金・キャンセル）', attrs: [], options: [{d:'お問い合わせ'},{d:'請求/入金'},{d:'キャンセル'}] },
  { name: 'Admin_info', desc: '管理者メール・サービス名などグローバル設定', attrs: ['mail','service_name'], options: [{d:'デフォルト',v:['manmosutarou@gmail.com','Rincle']}] },
  { name: 'Platform_Fee', desc: 'プラットフォーム手数料率（デフォルト10%）', attrs: ['number'], options: [{d:'デフォルト',v:['10']}] },
  { name: 'index_page', desc: 'インデックスページのパラメータ定義', attrs: ['parameter'], options: [{d:'top',v:['']},{d:'search',v:['search']},{d:'bicycle_detail',v:['bicycle_detail']},{d:'guide',v:['guide']},{d:'signup',v:['signup']},{d:'mypage',v:['mypage']},{d:'cart',v:['cart']},{d:'contact',v:['contact']}] },
  { name: 'Shop_Sidebar_sub', desc: 'ショップ管理画面のサイドバー項目', attrs: ['parameter'], options: [{d:'顧客一覧',v:['customer_all']},{d:'自転車一覧',v:['bicycle_all']},{d:'料金管理',v:['price']},{d:'予約一覧',v:['reservation']},{d:'売上レポート',v:['sales']},{d:'店舗情報',v:['info']},{d:'ログアウト',v:['logout']}] },
  { name: 'Admin_Sidebar_sub', desc: '管理者画面のサイドバー項目', attrs: ['parameter'], options: [{d:'顧客一覧',v:['customer_all']},{d:'加盟店一覧',v:['shop_all']},{d:'予約一覧',v:['reservation']},{d:'FV管理',v:['first_view']},{d:'お知らせ管理',v:['news']},{d:'ログアウト',v:['logout']}] },
  { name: 'pay_jp_key', desc: 'Pay.JP の公開鍵・秘密鍵', attrs: ['key'], options: [{d:'test_sk',v:['sk_test_7737…']},{d:'live',v:['pk_live_17c3…']},{d:'test_pk',v:['pk_test_0ede…']}] },
  { name: '曜日', desc: '月〜日・祝日のスラグ定義', attrs: ['slug'], options: [{d:'月曜',v:['月']},{d:'火曜',v:['火']},{d:'水曜',v:['水']},{d:'木曜',v:['木']},{d:'金曜',v:['金']},{d:'土曜',v:['土']},{d:'日曜',v:['日']},{d:'祝日',v:['祝']}] },
  { name: '月', desc: '1月〜12月', attrs: [], options: [{d:'1月'},{d:'2月'},{d:'3月'},{d:'4月'},{d:'5月'},{d:'6月'},{d:'7月'},{d:'8月'},{d:'9月'},{d:'10月'},{d:'11月'},{d:'12月'}] },
  { name: '日付', desc: '1〜31の日付マスタ（31件）', attrs: ['number'], abbrev: '1〜31（31件）' },
  { name: 'Time', desc: '0:00〜23:50の時刻マスタ（10分刻み・144件）', attrs: ['display','date','index'], abbrev: '0:00〜23:50（10分刻み・144件）' },
  { name: 'menu_利用規約', desc: '利用規約本文（長文テキスト）', attrs: ['content'], options: [{d:'Ver1',v:['利用規約本文（長文）']}] },
  { name: 'menu_プライバシーポリシー', desc: 'プライバシーポリシー本文（長文テキスト）', attrs: ['content'], options: [{d:'ver1',v:['PP本文（長文）']}] },
  { name: 'menu_特商法', desc: '特定商取引法表記（長文テキスト）', attrs: ['content'], options: [{d:'Ver1',v:['特商法表記（長文）']}] },
]

// ── Process seed data → group by table ───────────────────────────
const tables = new Map() // tableName → { engName, fields[] }
let lastBubble = ''

for (const [fid, rawTable, field_name, display_name, required, ix, dtype, list, ref_target, notes] of SEED) {
  const bubbleTable = rawTable || lastBubble
  if (rawTable) lastBubble = rawTable

  const engName = BUBBLE_TO_ENG[bubbleTable] || bubbleTable

  if (!tables.has(engName)) {
    tables.set(engName, { engName, fields: [] })
  }

  tables.get(engName).fields.push({
    field_name,
    display_name,
    required: required ? 'true' : 'false',
    ix: ix ? 'true' : 'false',
    dtype,
    list: list ? 'true' : 'false',
    ref_target: ref_target || '',
    notes: notes || '',
  })
}

// ── Table ordering (export order) ─────────────────────────────────
const TABLE_ORDER = [
  'user', 'bicycle', 'price_menu', 'option', 'sub_option',
  'prefecture', 'q_a', 'q_a_category',
  'news', 'banner', 'fv',
  'holidays', 'access_log', 'webhook_event',
  'reservation', 'booking_customer', 'reservation_detail', 'option_price',
  'shop_schedule', 'business_hours',
  'sales_record', 'shop_notification', 'contact_inquiry',
  'ip_rights', 'holiday_defaults', 'holiday_master', 'reservation_count',
]

// ── Write datatype CSVs ──────────────────────────────────────────
const DT_HEADERS = ['field_name', 'display_name', 'required', 'ix', 'dtype', 'list', 'ref_target', 'notes']

let num = 1
for (const tname of TABLE_ORDER) {
  const tbl = tables.get(tname)
  if (!tbl) { console.warn(`Missing table: ${tname}`); continue }
  const prefix = String(num).padStart(2, '0')
  const fileName = `${prefix}_${tname}.csv`
  const csv = toCsv(DT_HEADERS, tbl.fields)
  writeFileSync(join(DT_DIR, fileName), csv, 'utf8')
  console.log(`  ✓ datatype/${fileName} (${tbl.fields.length} fields)`)
  num++
}

// ── Write optionset CSVs ─────────────────────────────────────────
num = 1
for (const os of OPTION_SETS) {
  const prefix = String(num).padStart(2, '0')
  // Sanitize filename (replace / with _)
  const safeName = os.name.replace(/\//g, '_')
  const fileName = `${prefix}_${safeName}.csv`

  if (os.abbrev) {
    // Abbreviated set - just write a note
    const csv = `display,notes\n${csvEscape(os.abbrev)},省略表記\n`
    writeFileSync(join(OS_DIR, fileName), csv, 'utf8')
  } else if (os.options) {
    const headers = ['display', ...os.attrs]
    const rows = os.options.map(opt => {
      const row = { display: opt.d }
      if (opt.v) os.attrs.forEach((a, i) => { row[a] = opt.v[i] || '' })
      return row
    })
    const csv = toCsv(headers, rows)
    writeFileSync(join(OS_DIR, fileName), csv, 'utf8')
  }
  console.log(`  ✓ optionset/${fileName} (${os.options?.length ?? 0} items)`)
  num++
}

// ── Write _index.csv ─────────────────────────────────────────────
const INDEX_HEADERS = ['no', 'type', 'name', 'description']
const indexRows = []

num = 1
for (const tname of TABLE_ORDER) {
  indexRows.push({ no: String(num).padStart(2, '0'), type: 'datatype', name: tname, description: TABLE_DESC[tname] || '' })
  num++
}

num = 1
for (const os of OPTION_SETS) {
  indexRows.push({ no: String(num).padStart(2, '0'), type: 'optionset', name: os.name, description: os.desc || '' })
  num++
}

writeFileSync(join(BASE, '_index.csv'), toCsv(INDEX_HEADERS, indexRows), 'utf8')
console.log(`\n  ✓ _index.csv (${indexRows.length} entries)`)

console.log('\n✅ Done! All CSV files generated.')
