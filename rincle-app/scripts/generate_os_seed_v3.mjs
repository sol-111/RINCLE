// option_items リセット用 SQL 生成スクリプト（v3）
// ヘッダー行の val_1/val_2/val_3 に列名を格納する新スキーマ対応
const OS_DATA = [
  {name:'Rights', attrs:[],
   options:[{display:'ユーザー'},{display:'加盟店'},{display:'管理者'}], notes:'アクセス権限'},
  {name:'予約ステータス', attrs:[],
   options:[{display:'貸出中'},{display:'来客待ち'},{display:'返却済み'},{display:'キャンセル'},{display:'仮情報'},{display:'キャンセル（返金なし）'}], notes:''},
  {name:'決済ステータス', attrs:[],
   options:[{display:'決済済み'},{display:'未決済'},{display:'返金済み'},{display:'キャンセル'}], notes:''},
  {name:'振り込みステータス', attrs:[],
   options:[{display:'振込済'},{display:'未振込'}], notes:''},
  {name:'支払い方法', attrs:[],
   options:[{display:'店頭決済'},{display:'クレジットカード決済'}], notes:''},
  {name:'貸し出し可能ステータス', attrs:[],
   options:[{display:'ユーザー表示'},{display:'ユーザー非表示'}], notes:''},
  {name:'brand_status', attrs:[],
   options:[{display:'passed'},{display:'in_review'},{display:'declined'},{display:'before_review'}], notes:''},
  {name:'Bicycle Category', attrs:[],
   options:[{display:'ロードバイク'},{display:'クロスバイク'},{display:'マウンテンバイク'},{display:'小径車'},{display:'キッズ'}], notes:''},
  {name:'yes/no', attrs:[{label:'yes'},{label:'yes_no'}],
   options:[{display:'yes',vals:['yes','True']},{display:'no',vals:['no','False']}], notes:''},
  {name:'管理者/運営_news_type', attrs:[],
   options:[{display:'お問い合わせ'},{display:'請求/入金'},{display:'キャンセル'}], notes:''},
  {name:'営業状態op', attrs:[],
   options:[{display:'営業'},{display:'休業'}], notes:''},
  {name:'予約種別', attrs:[],
   options:[{display:'過去の予約表示'},{display:'現在の予約表示'}], notes:''},
  {name:'Admin_info', attrs:[{label:'mail'},{label:'service_name'}],
   options:[{display:'デフォルト',vals:['manmosutarou@gmail.com','Rincle']}], notes:'管理者情報'},
  {name:'Platform_Fee', attrs:[{label:'number'}],
   options:[{display:'デフォルト',vals:['10']}], notes:'プラットフォーム手数料率(%)'},
  {name:'index_page', attrs:[{label:'parameter'}],
   options:[
     {display:'top',vals:['']},{display:'search',vals:['search']},{display:'bicycle_detail',vals:['bicycle_detail']},
     {display:'guide',vals:['guide']},{display:'signup',vals:['signup']},{display:'howtopay',vals:['howtopay']},
     {display:'cart',vals:['cart']},{display:'personal_info',vals:['personal_info']},
     {display:'reservation_info',vals:['reservation_info']},{display:'campaign_details',vals:['campaign_details']},
     {display:'campaign_list',vals:['campaign_list']},{display:'contact',vals:['contact']},
     {display:'top_search',vals:['top_search']},{display:'news_list',vals:['news_list']},
     {display:'news_detail',vals:['news_detail']},{display:'topics_list',vals:['topics_list']},
     {display:'topics_detail',vals:['topics_detail']},{display:'fv',vals:['fv']},
     {display:'利用規約',vals:['Rights']},{display:'プライバシーポリシー',vals:['privacypolicy']},
     {display:'特商法の記載',vals:['docs']},{display:'user_edit',vals:['edit']},{display:'mypage',vals:['mypage']}
   ], notes:'23件'},
  {name:'Shop_Sidebar', attrs:[{label:'sub_items'}],
   options:[
     {display:'顧客管理',vals:['顧客一覧']},
     {display:'在庫管理',vals:['自転車一覧 / 料金管理 / オプション管理 / 営業時間設定 / 営業カレンダー']},
     {display:'予約・売上管理',vals:['予約一覧 / 売上レポート / 利用料管理 / ...']},
     {display:'アカウント情報',vals:['店舗情報 / メール変更 / パスワード変更 / ...']}
   ], notes:''},
  {name:'Admin_Sidebar', attrs:[{label:'sub_items'},{label:'image'}],
   options:[
     {display:'顧客管理',vals:['顧客一覧','CDN URL']},
     {display:'加盟店管理',vals:['加盟店一覧 / 新規追加','CDN URL']},
     {display:'予約・売上管理',vals:['予約一覧 / 売上レポート / ...','']},
     {display:'トップページ管理',vals:['FV / お知らせ / バナー / Q&A','']},
     {display:'アカウント情報',vals:['メール変更 / パスワード変更 / ...','（空）']}
   ], notes:''},
  {name:'Shop_Sidebar_sub', attrs:[{label:'parameter'}],
   options:[
     {display:'顧客一覧',vals:['customer_all']},{display:'自転車一覧',vals:['bicycle_all']},
     {display:'料金管理',vals:['price']},{display:'オプション管理',vals:['options']},
     {display:'営業時間設定',vals:['business_hour']},{display:'営業カレンダー',vals:['business_calendar']},
     {display:'予約一覧',vals:['reservation']},{display:'売上レポート',vals:['sales']},
     {display:'利用料管理',vals:['pay']},{display:'店舗情報',vals:['info']},
     {display:'お問い合わせ一覧',vals:['contact']},{display:'メールアドレスの変更',vals:['mail']},
     {display:'パスワードの変更',vals:['pass']},{display:'ログアウト',vals:['logout']},
     {display:'お知らせ一覧',vals:['news']},{display:'過去の予約',vals:['old_reservation']}
   ], notes:'16件'},
  {name:'Admin_Sidebar_sub', attrs:[{label:'parameter'}],
   options:[
     {display:'顧客一覧',vals:['customer_all']},{display:'加盟店一覧',vals:['shop_all']},
     {display:'新規追加',vals:['shop_create']},{display:'料金表管理',vals:['price_menu']},
     {display:'予約一覧',vals:['reservation']},{display:'売上レポート',vals:['sales']},
     {display:'利用料管理',vals:['invoice']},{display:'FV管理',vals:['first_view']},
     {display:'お知らせ管理',vals:['news']},{display:'バナー管理',vals:['banner']},
     {display:'Q&A管理',vals:['faq']},{display:'お問い合わせ一覧',vals:['contact']},
     {display:'メールアドレスの変更',vals:['mail']},{display:'パスワードの変更',vals:['pass']},
     {display:'ログアウト',vals:['logout']},{display:'お知らせ一覧',vals:['notice']}
   ], notes:'16件'},
  {name:'新着/古い', attrs:[],
   options:[{display:'新着順'},{display:'古い順'}], notes:''},
  {name:'予約管理並び替え', attrs:[],
   options:[{display:'貸出日時が新しい順'},{display:'貸出日時が古い順'},{display:'予約が新しい順'},{display:'予約が古い順'}], notes:''},
  {name:'検索カテゴリ', attrs:[],
   options:[{display:'貸出日'},{display:'返却日'},{display:'エリア'},{display:'自転車タイプ'},{display:'フリーワード'},{display:'店舗'}], notes:''},
  {name:'表示項目', attrs:[],
   options:[{display:'売上状況'},{display:'ユーザー利用状況'},{display:'加盟店利用状況'},{display:'アクティブユーザー'}], notes:''},
  {name:'表示レポート_加盟店', attrs:[],
   options:[{display:'単月総売上高'},{display:'年間総売上高合計'},{display:'カテゴリー別総売上'},{display:'新規/リピーター比'},{display:'バイク毎データ'}], notes:''},
  {name:'pay_jp_key', attrs:[{label:'key'}],
   options:[
     {display:'test_sk',vals:['sk_test_7737…']},
     {display:'live',vals:['pk_live_17c3…']},
     {display:'test_pk',vals:['pk_test_0ede…']}
   ], notes:'Pay.jp APIキー'},
  {name:'pay.jp pk', attrs:[{label:'value'}],
   options:[{display:'1',vals:['pk_test_cc71…']}], notes:'公開鍵'},
  {name:'Pay.jp apply redirect url', attrs:[{label:'url'}],
   options:[{display:'デフォルト',vals:['?return_to=https://rincle.bubbleapps.io/...']}], notes:'オンボーディング完了後のリダイレクトURL'},
  {name:'noplan_list', attrs:[],
   options:[{display:'no_plan'},{display:'start_no_plan'},{display:'end_no_plan'}], notes:''},
  {name:'曜日', attrs:[{label:'slug'}],
   options:[
     {display:'月曜',vals:['月']},{display:'火曜',vals:['火']},{display:'水曜',vals:['水']},
     {display:'木曜',vals:['木']},{display:'金曜',vals:['金']},{display:'土曜',vals:['土']},
     {display:'日曜',vals:['日']},{display:'祝日',vals:['祝']}
   ], notes:''},
  {name:'月', attrs:[],
   options:[{display:'1月'},{display:'2月'},{display:'3月'},{display:'4月'},{display:'5月'},{display:'6月'},{display:'7月'},{display:'8月'},{display:'9月'},{display:'10月'},{display:'11月'},{display:'12月'}], notes:''},
  {name:'日付', attrs:[{label:'number'}],
   options:null, abbrev:'1〜31（31件、number属性は空）', notes:''},
  {name:'Time', attrs:[{label:'display'},{label:'date'},{label:'index'}],
   options:null, abbrev:'0:00〜23:50（10分刻み・144件）', notes:'時間選択用'},
  {name:'menu_利用規約', attrs:[{label:'content'}],
   options:[{display:'Ver1',vals:['利用規約本文（長文）']}], notes:'ToS本文'},
  {name:'menu_プライバシーポリシー', attrs:[{label:'content'}],
   options:[{display:'ver1',vals:['プライバシーポリシー本文（長文）']}], notes:'PP本文'},
  {name:'menu_特定商取引法に基づく表記', attrs:[{label:'content'}],
   options:[{display:'Ver1',vals:['特商法表記本文（長文）']}], notes:'特商法表記'},
  {name:'会員登録表示', attrs:[],
   options:[{display:'登録１'},{display:'登録２'},{display:'登録３'}], notes:''},
  {name:'ステート文章', attrs:[],
   options:[{display:'※'},{display:'出'},{display:'発'},{display:'日'},{display:'の'}], notes:''},
];

function esc(s) { return String(s ?? '').replace(/'/g, "''") }

const flatRows = [];
let sortOrder = 0;

for (const os of OS_DATA) {
  // ヘッダー行: val_1/val_2/val_3 に列名を格納（新スキーマ）
  flatRows.push({
    sort_order: sortOrder++,
    set_name: os.name,
    notes: os.notes || '',
    abbrev: os.abbrev || '',
    display: '',
    val_1: os.attrs[0]?.label || '',
    val_2: os.attrs[1]?.label || '',
    val_3: os.attrs[2]?.label || '',
  });

  // アイテム行
  if (os.options) {
    for (const opt of os.options) {
      flatRows.push({
        sort_order: sortOrder++,
        set_name: '',
        notes: '',
        abbrev: '',
        display: opt.display,
        val_1: (opt.vals || [])[0] ?? '',
        val_2: (opt.vals || [])[1] ?? '',
        val_3: (opt.vals || [])[2] ?? '',
      });
    }
  }
}

let sql = '-- ── option_items リセット（v3: ヘッダー行にカラム名を格納する新スキーマ） ──\n';
sql += 'truncate table option_items restart identity cascade;\n\n';
sql += 'insert into option_items (sort_order, set_name, notes, abbrev, display, val_1, val_2, val_3) values\n';
sql += flatRows.map(r =>
  `(${r.sort_order}, '${esc(r.set_name)}', '${esc(r.notes)}', '${esc(r.abbrev)}', '${esc(r.display)}', '${esc(r.val_1)}', '${esc(r.val_2)}', '${esc(r.val_3)}')`
).join(',\n') + ';\n';

import { writeFileSync } from 'fs';
writeFileSync('scripts/seed_os_v3.sql', sql);
console.log(`✓ scripts/seed_os_v3.sql を生成しました (${flatRows.length} 行 / ${OS_DATA.length} セット)`);
