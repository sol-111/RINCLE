import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', '..', 'documents', '1_requirements', '02_screen')

const COLORS = {
  user:     { label: 'ユーザー',   fill: '#1a3a28', stroke: '#34a853' },
  store:    { label: '店舗',       fill: '#1e1a38', stroke: '#8060d8' },
  admin:    { label: '管理者',     fill: '#3a1818', stroke: '#d05050' },
  decision: { label: '判定',       fill: '#151e38', stroke: '#4a72c0' },
  startend: { label: '開始/終了',  fill: '#222230', stroke: '#686890' },
  popup:    { label: 'ポップアップ', fill: '#3a3010', stroke: '#c8a030' },
  external: { label: '外部サービス', fill: '#181e3a', stroke: '#3878d0' },
  notify:   { label: '通知',       fill: '#182030', stroke: '#3090b0' },
  io:       { label: 'エラー/入出力', fill: '#301e10', stroke: '#a07030' },
}

const SHAPES = { rect: '矩形', diamond: 'ひし形(判定)', ellipse: '楕円(開始/終了)' }

function parseNodes(raw) {
  return raw.map(n => ({
    id: n[0],
    x: n[1], y: n[2],
    role: n[3],
    roleLabel: COLORS[n[3]]?.label || n[3],
    shape: n[4],
    shapeLabel: SHAPES[n[4]] || n[4],
    label: n.slice(5).join('\n'),
  }))
}

function parseEdges(edgeLines) {
  return edgeLines.map(e => ({
    from: e[0],
    fromSide: e[1],
    to: e[2],
    toSide: e[3],
    ...(e[4] || {}),
  }))
}

// D2: 全体フロー
const D2_NODES = [
  ['u_start',110,250,'startend','ellipse','開始'],['u_new_q',275,250,'decision','diamond','新規登録?'],
  ['u_login',450,190,'user','rect','ログインフォーム'],['u_auth_ok',650,190,'decision','diamond','認証OK?'],['u_auth_err',650,260,'io','rect','エラー表示(再入力)'],['u_mypage',840,190,'user','rect','マイページ確認'],
  ['u_signup',450,320,'user','rect','新規登録フォーム'],['u_mail_out',650,320,'notify','rect','確認メール送信'],['u_verified',840,320,'user','rect','メール本人確認'],
  ['u_pw_req',450,415,'user','rect','PWリセット申請'],['u_pw_mail',650,415,'notify','rect','リセットメール送信'],['u_pw_done',840,415,'user','rect','新PW設定完了'],
  ['s_start',110,560,'startend','ellipse','開始'],['s_form',290,560,'store','rect','店舗登録フォーム'],['s_submit',470,560,'store','rect','申請送信'],
  ['a_start',110,775,'startend','ellipse','開始'],['a_login',290,775,'admin','rect','ログイン'],['a_dash',470,775,'admin','rect','ダッシュボード'],
  ['s_wait',975,560,'store','rect','審査待ち'],['a_rev',1180,775,'decision','diamond','店舗審査'],['a_approve',1375,715,'admin','rect','承認'],['a_reject',1375,845,'io','rect','却下'],['n_rej_m',1560,845,'notify','rect','却下通知メール(店舗)'],['n_app_m',1375,635,'notify','rect','承認メール送信(店舗)'],['s_activate',1560,560,'store','rect','アカウント有効化'],['s_login',1750,560,'store','rect','ログイン(shop_admin)'],
  ['s_bike',1940,505,'store','rect','自転車登録・編集'],['s_status',1940,615,'store','rect','在庫ステータス管理'],['s_price',2130,505,'store','rect','料金プラン設定'],['s_cal',2320,560,'store','rect','カレンダー(休業日)設定'],
  ['u_search',1930,190,'user','rect','エリア・日時選択'],['u_exec',2120,190,'user','rect','検索実行'],['u_has_res',2310,190,'decision','diamond','空車あり?'],['u_no_res',2310,305,'io','rect','空車なし(条件変更)'],['u_list',2500,190,'user','rect','検索結果一覧'],
  ['u_detail',2700,190,'user','rect','自転車詳細/日時選択'],['u_inv_q',2890,190,'decision','diamond','在庫最終確認'],['u_inv_ng',2890,305,'io','rect','在庫切れ(別の自転車)'],['u_cart1',3080,190,'user','rect','予約① 空車確認'],['u_cart2',3270,190,'user','rect','予約② 顧客情報'],['u_cart3',3460,190,'user','rect','予約③ 内容確認'],
  ['u_cart4',3590,190,'user','rect','予約④ 決済'],['u_card',3590,85,'popup','rect','カード情報入力'],['u_payjp',3780,85,'external','rect','Pay.JP決済処理'],['u_pay_ok',3780,190,'decision','diamond','決済OK?'],['u_pay_err',3780,305,'io','rect','決済エラー表示'],['u_retry_q',3970,305,'decision','diamond','再試行?(3回上限)'],['u_max_err',3970,415,'io','rect','予約中断(上限超過)'],['n_fail_u',4170,415,'notify','rect','決済失敗メール(ユーザー)'],['u_pay_done',3970,190,'user','rect','決済完了/予約確定'],
  ['n_fail_a',4170,870,'notify','rect','決済失敗アラート(管理者)'],
  ['n_conf_u',4480,190,'notify','rect','予約確認メール(ユーザー)'],['u_resv',4670,190,'user','rect','予約一覧確認'],['n_conf_s',4480,560,'notify','rect','予約通知メール(店舗)'],['s_resv',4670,560,'store','rect','予約詳細確認'],['s_prep',4860,560,'store','rect','自転車準備'],['a_pay_mgmt',4480,775,'admin','rect','決済問題対応'],['a_monitor',4670,775,'admin','rect','予約モニタリング'],['a_report',4860,775,'admin','rect','売上レポート'],
  ['u_cq',5180,190,'decision','diamond','キャンセルする?'],['u_pq',5370,190,'decision','diamond','キャンセル期限内?'],['u_refund',5560,140,'user','rect','全額返金処理'],['u_noref',5560,250,'io','rect','返金なし(規定外)'],['u_cancel',5750,190,'user','rect','キャンセル完了'],['n_can_u',5750,85,'notify','rect','キャンセル確認メール(ユーザー)'],['n_can_s',5750,480,'notify','rect','キャンセル通知メール(店舗)'],['s_cancel',5750,560,'store','rect','キャンセル確認・対応'],['a_refund',5560,775,'admin','rect','返金処理'],['a_sim',5750,775,'admin','rect','料金シミュレーション'],
]

const D2_EDGES = [
  ['u_start','r','u_new_q','l'],['u_new_q','t','u_login','l',{label:'No(既存)'}],['u_new_q','b','u_signup','l',{label:'Yes(新規)'}],
  ['u_login','r','u_auth_ok','l'],['u_auth_ok','r','u_mypage','l',{label:'OK'}],['u_auth_ok','b','u_auth_err','t',{label:'NG',ng:true}],['u_auth_err','b','u_pw_req','t',{label:'PW忘れ',ng:true}],
  ['u_signup','r','u_mail_out','l'],['u_mail_out','r','u_verified','l'],['u_pw_req','r','u_pw_mail','l'],['u_pw_mail','r','u_pw_done','l'],
  ['s_start','r','s_form','l'],['s_form','r','s_submit','l'],['s_submit','r','s_wait','l'],['s_submit','b','a_dash','t',{cross:true,label:'申請通知'}],
  ['a_start','r','a_login','l'],['a_login','r','a_dash','l'],['a_dash','r','a_rev','l'],['s_wait','b','a_rev','t',{cross:true}],
  ['a_rev','t','a_approve','b',{label:'承認'}],['a_rev','b','a_reject','t',{label:'却下',ng:true}],['a_reject','r','n_rej_m','l'],['a_approve','t','n_app_m','b'],['n_app_m','t','s_activate','b',{cross:true}],
  ['s_activate','r','s_login','l'],['s_login','r','s_bike','l'],['s_bike','r','s_price','l'],['s_price','r','s_cal','l'],
  ['u_mypage','r','u_search','l'],['u_verified','r','u_search','l'],['u_pw_done','r','u_search','l'],
  ['u_search','r','u_exec','l'],['u_exec','r','u_has_res','l'],['u_has_res','r','u_list','l',{label:'あり'}],['u_has_res','b','u_no_res','t',{label:'なし',ng:true}],
  ['u_list','r','u_detail','l'],['u_detail','r','u_inv_q','l'],['u_inv_q','r','u_cart1','l',{label:'OK'}],['u_inv_q','b','u_inv_ng','t',{label:'NG',ng:true}],
  ['u_cart1','r','u_cart2','l'],['u_cart2','r','u_cart3','l'],['u_cart3','r','u_cart4','l'],['u_cart4','t','u_card','b'],['u_card','r','u_payjp','l'],['u_payjp','b','u_pay_ok','t'],
  ['u_pay_ok','r','u_pay_done','l',{label:'OK'}],['u_pay_ok','b','u_pay_err','t',{label:'NG',ng:true}],['u_pay_err','r','u_retry_q','l'],['u_retry_q','b','u_max_err','t',{label:'上限超過',ng:true}],['u_max_err','r','n_fail_u','l'],['n_fail_u','b','n_fail_a','t',{cross:true}],
  ['u_retry_q','t','u_card','t',{loop:true,label:'Yes→再試行'}],
  ['u_pay_done','r','n_conf_u','l'],['n_conf_u','r','u_resv','l'],['u_pay_done','b','n_conf_s','t',{cross:true}],['n_conf_s','r','s_resv','l'],['s_resv','r','s_prep','l'],
  ['n_fail_a','r','a_pay_mgmt','l',{cross:true}],['a_pay_mgmt','r','a_monitor','l'],['a_monitor','r','a_report','l'],
  ['u_resv','r','u_cq','l'],['u_cq','r','u_pq','l',{label:'する'}],['u_pq','t','u_refund','b',{label:'期限内'}],['u_pq','b','u_noref','t',{label:'期限外',ng:true}],
  ['u_refund','r','u_cancel','l'],['u_noref','r','u_cancel','l'],['u_cancel','t','n_can_u','b'],['u_cancel','b','n_can_s','t',{cross:true}],['n_can_s','b','s_cancel','t',{cross:true}],['u_refund','b','a_refund','t',{cross:true}],['a_refund','r','a_sim','l'],
]

// D3: 決済フロー
const D3_NODES = [
  ['u_cart4',110,200,'user','rect','予約④ 決済画面'],['u_card',300,120,'popup','rect','カード情報入力(POP)'],['u_token',490,120,'external','rect','Pay.JPトークン化'],['u_charge',700,200,'external','rect','Pay.JPチャージ実行'],
  ['u_pay_ok',900,200,'decision','diamond','決済OK?'],['u_pay_err',900,330,'io','rect','決済エラー表示'],['u_retry_q',1090,330,'decision','diamond','再試行?(3回上限)'],['u_give_up',1090,450,'io','rect','予約中断(上限超過)'],
  ['u_done',1090,200,'user','rect','決済完了/予約確定'],['u_resv',1280,200,'user','rect','予約一覧確認'],['u_cancel',1470,200,'user','rect','キャンセル申請'],
  ['u_refund_q',1660,200,'decision','diamond','期限内?'],['u_ref_ok',1850,130,'user','rect','Pay.JP返金処理'],['u_ref_ng',1850,270,'io','rect','返金なし(規定外)'],['u_cancel_done',2050,200,'user','rect','キャンセル完了'],
  ['n_conf_u',1090,90,'notify','rect','確認メール(ユーザー)'],['n_conf_s',700,510,'notify','rect','予約通知(店舗)'],['n_fail',1280,490,'notify','rect','決済失敗メール(ユーザー+管理者)'],['n_refund',2050,80,'notify','rect','返金完了メール(ユーザー)'],['n_cancel_s',2050,340,'notify','rect','キャンセル通知(店舗)'],
  ['a_monitor',1280,610,'admin','rect','決済問題モニタリング'],['a_refund',1850,510,'admin','rect','返金承認(管理者)'],
]

const D3_EDGES = [
  ['u_cart4','t','u_card','b'],['u_card','r','u_token','l'],['u_token','b','u_charge','t'],['u_charge','r','u_pay_ok','l'],
  ['u_pay_ok','r','u_done','l',{label:'OK'}],['u_pay_ok','b','u_pay_err','t',{label:'NG',ng:true}],['u_pay_err','r','u_retry_q','l'],['u_retry_q','b','u_give_up','t',{label:'上限',ng:true}],
  ['u_give_up','r','n_fail','l'],['n_fail','b','a_monitor','t',{cross:true}],['u_retry_q','t','u_card','t',{loop:true,label:'Yes→再試行'}],
  ['u_done','t','n_conf_u','b'],['u_done','b','n_conf_s','t',{cross:true}],['u_done','r','u_resv','l'],['u_resv','r','u_cancel','l'],['u_cancel','r','u_refund_q','l'],
  ['u_refund_q','t','u_ref_ok','b',{label:'期限内'}],['u_refund_q','b','u_ref_ng','t',{label:'期限外',ng:true}],['u_ref_ok','r','u_cancel_done','l'],['u_ref_ng','r','u_cancel_done','l'],
  ['u_cancel_done','t','n_refund','b'],['u_cancel_done','b','n_cancel_s','t',{cross:true}],['u_ref_ok','b','a_refund','t',{cross:true}],
]

// D4: 予約フロー
const D4_NODES = [
  ['u_search',100,210,'user','rect','エリア・日時選択'],['u_list',290,210,'user','rect','検索結果一覧'],['u_detail',480,210,'user','rect','自転車詳細/日時選択'],
  ['u_inv_q',670,210,'decision','diamond','在庫確認'],['u_inv_ng',670,340,'io','rect','在庫切れ(別を選択)'],['u_c1',860,210,'user','rect','予約① 空車確認'],['u_c2',1050,210,'user','rect','予約② 顧客情報'],['u_c3',1240,210,'user','rect','予約③ 内容確認'],
  ['u_c4',1430,210,'user','rect','予約④ 決済'],['u_pay_ok',1620,210,'decision','diamond','決済OK?'],['u_pay_ng',1620,340,'io','rect','決済失敗(再試行)'],['u_confirmed',1820,210,'user','rect','予約確定(来客待ち)'],
  ['u_lend',2010,210,'user','rect','来店・貸出開始'],['u_return',2200,210,'user','rect','返却手続き'],['u_done',2390,210,'user','rect','返却済み完了'],['u_myresv',2010,80,'user','rect','予約一覧確認'],
  ['u_cancel_q',1820,340,'decision','diamond','キャンセル?'],['u_limit_q',2010,400,'decision','diamond','期限内?'],['u_ref',2200,330,'user','rect','返金ありキャンセル'],['u_noref',2200,470,'io','rect','返金なしキャンセル'],
  ['s_notify',1820,560,'store','rect','予約通知受信'],['s_prep',2010,560,'store','rect','自転車準備'],['s_lend',2200,560,'store','rect','貸出確認(ステータス変更)'],['s_ret',2390,560,'store','rect','返却確認(ステータス変更)'],['s_cancel',2390,460,'store','rect','キャンセル対応'],
  ['n_conf',1820,80,'notify','rect','予約確認メール'],['n_canc',2390,340,'notify','rect','キャンセル確認メール'],
]

const D4_EDGES = [
  ['u_search','r','u_list','l'],['u_list','r','u_detail','l'],['u_detail','r','u_inv_q','l'],['u_inv_q','r','u_c1','l',{label:'OK'}],['u_inv_q','b','u_inv_ng','t',{label:'NG',ng:true}],
  ['u_c1','r','u_c2','l'],['u_c2','r','u_c3','l'],['u_c3','r','u_c4','l'],['u_c4','r','u_pay_ok','l'],['u_pay_ok','r','u_confirmed','l',{label:'OK'}],['u_pay_ok','b','u_pay_ng','t',{label:'NG',ng:true}],
  ['u_confirmed','t','n_conf','b'],['n_conf','r','u_myresv','l'],['u_confirmed','r','u_lend','l'],['u_lend','r','u_return','l'],['u_return','r','u_done','l'],
  ['u_confirmed','b','u_cancel_q','t'],['u_cancel_q','r','u_limit_q','l',{label:'する'}],['u_limit_q','t','u_ref','b',{label:'期限内'}],['u_limit_q','b','u_noref','t',{label:'期限外',ng:true}],
  ['u_ref','r','n_canc','l'],['u_noref','r','s_cancel','l',{cross:true}],['u_confirmed','b','s_notify','t',{cross:true}],['s_notify','r','s_prep','l'],['s_prep','r','s_lend','l'],['s_lend','r','s_ret','l'],
  ['s_lend','t','u_lend','b',{cross:true}],['s_ret','t','u_return','b',{cross:true}],
]

const output = {
  title: "RINCLE 業務フロー図",
  description: "利用者・店舗・管理者の業務フローをノード・エッジで定義",
  colorLegend: COLORS,
  shapeLegend: SHAPES,
  diagrams: {
    "全体フロー": {
      id: "zen",
      description: "アカウント・認証 → 店舗準備 → 検索 → 予約 → 決済 → 完了 → キャンセル の全工程",
      svgSize: { width: 5900, height: 960 },
      lanes: [
        { label: "ユーザー", y: 42, height: 398, color: "user" },
        { label: "店舗", y: 450, height: 220, color: "store" },
        { label: "管理者", y: 680, height: 225, color: "admin" },
      ],
      phases: [
        { label: "アカウント・認証", x: 60, width: 840 },
        { label: "店舗準備・承認 / マスタ管理", x: 900, width: 940 },
        { label: "自転車検索・閲覧", x: 1840, width: 780 },
        { label: "予約フロー", x: 2620, width: 860 },
        { label: "決済", x: 3480, width: 940 },
        { label: "完了・通知", x: 4420, width: 680 },
        { label: "キャンセル・返金", x: 5100, width: 720 },
      ],
      nodes: parseNodes(D2_NODES),
      edges: parseEdges(D2_EDGES),
    },
    "決済フロー（詳細）": {
      id: "kessai",
      description: "カード入力 → トークン化 → チャージ → 決済判定 → 完了/キャンセル/返金",
      svgSize: { width: 2260, height: 740 },
      lanes: [
        { label: "ユーザー", y: 42, height: 370, color: "user" },
        { label: "管理者 / 通知", y: 422, height: 270, color: "admin" },
      ],
      phases: [
        { label: "カード入力・トークン化", x: 60, width: 570 },
        { label: "チャージ・決済判定", x: 630, width: 600 },
        { label: "完了・確認", x: 1230, width: 500 },
        { label: "キャンセル・返金", x: 1730, width: 500 },
      ],
      nodes: parseNodes(D3_NODES),
      edges: parseEdges(D3_EDGES),
    },
    "予約フロー（詳細）": {
      id: "yoyaku",
      description: "検索 → 予約 → 決済 → 確定 → 貸出 → 返却、およびキャンセル分岐",
      svgSize: { width: 2560, height: 680 },
      lanes: [
        { label: "ユーザー", y: 42, height: 395, color: "user" },
        { label: "店舗", y: 447, height: 200, color: "store" },
      ],
      phases: [
        { label: "自転車検索・閲覧", x: 60, width: 670 },
        { label: "予約フロー", x: 730, width: 770 },
        { label: "決済・確定", x: 1500, width: 580 },
        { label: "利用・返却", x: 2080, width: 480 },
      ],
      nodes: parseNodes(D4_NODES),
      edges: parseEdges(D4_EDGES),
    },
  },
}

writeFileSync(join(OUT, 'bizflow.json'), JSON.stringify(output, null, 2), 'utf-8')
console.log(`✅ bizflow.json exported`)
