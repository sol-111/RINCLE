'use client'

import React, { useEffect, useRef, useState } from 'react'

// ── Shared constants ───────────────────────────────────────────────────────────
type ColorKey = 'user'|'store'|'admin'|'decision'|'startend'|'popup'|'external'|'notify'|'io'
type Shape = 'rect'|'diamond'|'ellipse'

const C: Record<ColorKey, { fill:string; stroke:string; tc:string }> = {
  user:     { fill:'#1a3a28', stroke:'#34a853', tc:'#a0e8b8' },
  store:    { fill:'#1e1a38', stroke:'#8060d8', tc:'#c0a8f8' },
  admin:    { fill:'#3a1818', stroke:'#d05050', tc:'#f0a8a8' },
  decision: { fill:'#151e38', stroke:'#4a72c0', tc:'#88b0e0' },
  startend: { fill:'#222230', stroke:'#686890', tc:'#b0b0d0' },
  popup:    { fill:'#3a3010', stroke:'#c8a030', tc:'#ffe066' },
  external: { fill:'#181e3a', stroke:'#3878d0', tc:'#80b0f0' },
  notify:   { fill:'#182030', stroke:'#3090b0', tc:'#80c8d8' },
  io:       { fill:'#301e10', stroke:'#a07030', tc:'#d8a060' },
}
const SD: Record<Shape, { hw:number; hh:number }> = {
  rect:    { hw:70,  hh:24 },
  diamond: { hw:62,  hh:34 },
  ellipse: { hw:52,  hh:20 },
}

function esc(s: string) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }

function mText(cx: number, cy: number, lines: string|string[], color: string, fs = 11): string {
  const a = Array.isArray(lines) ? lines : lines.split('\n')
  return a.map((l, i) => {
    const dy = cy + (i - (a.length-1)/2) * (fs+3) + 1
    return `<text x="${cx}" y="${dy}" text-anchor="middle" dominant-baseline="central" fill="${color}" font-size="${fs}" font-family="'Hiragino Sans',sans-serif">${esc(l)}</text>`
  }).join('')
}

type NodeDef = { id:string; cx:number; cy:number; ck:ColorKey; shape:Shape; lines:string[] }

function nEl(n: NodeDef): string {
  const c = C[n.ck], lines = n.lines.flatMap(l => l.split('\n'))
  if (n.shape === 'ellipse') {
    const d = SD.ellipse
    return `<ellipse cx="${n.cx}" cy="${n.cy}" rx="${d.hw}" ry="${d.hh}" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5"/>${mText(n.cx, n.cy, lines, c.tc)}`
  }
  if (n.shape === 'diamond') {
    const { hw, hh } = SD.diamond
    const pts = `${n.cx},${n.cy-hh} ${n.cx+hw},${n.cy} ${n.cx},${n.cy+hh} ${n.cx-hw},${n.cy}`
    return `<polygon points="${pts}" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5"/>${mText(n.cx, n.cy, lines, c.tc, 10)}`
  }
  const { hw, hh } = SD.rect
  return `<rect x="${n.cx-hw}" y="${n.cy-hh}" width="${hw*2}" height="${hh*2}" rx="8" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.5"/>${mText(n.cx, n.cy, lines, c.tc)}`
}

type PtFn = (id: string, side: string) => [number, number]

function buildNM(rawNodes: (string|number)[][]): Record<string, NodeDef> {
  const NM: Record<string, NodeDef> = {}
  rawNodes.forEach(n => {
    NM[n[0] as string] = { id:n[0] as string, cx:n[1] as number, cy:n[2] as number, ck:n[3] as ColorKey, shape:n[4] as Shape, lines: n.slice(5) as string[] }
  })
  return NM
}

function makePt(NM: Record<string, NodeDef>): PtFn {
  return (id, side) => {
    const n = NM[id], d = SD[n.shape]
    return ({ r:[n.cx+d.hw,n.cy], l:[n.cx-d.hw,n.cy], t:[n.cx,n.cy-d.hh], b:[n.cx,n.cy+d.hh] } as Record<string, [number,number]>)[side]
  }
}

function buildContent(rawNodes: (string|number)[][], lanesF: (pt:PtFn)=>string, edgesF: (pt:PtFn)=>string): string {
  const NM = buildNM(rawNodes)
  const pt = makePt(NM)
  let h = lanesF(pt) + edgesF(pt)
  rawNodes.forEach(([id]) => { h += nEl(NM[id as string]) })
  return h
}

// ── Edge builder factory ───────────────────────────────────────────────────────
type EdgeOpts = { label?:string; cross?:boolean; ng?:boolean; loop?:boolean }
type MkIds = { def:string; cross:string; ng:string; loop?:string }

function makeEdgeFn(mk: MkIds) {
  return function e(pt: PtFn, fid:string, fs:string, tid:string, ts:string, opts:EdgeOpts={}): string {
    const { label='', cross=false, ng=false, loop=false } = opts
    const [fx,fy] = pt(fid,fs), [tx,ty] = pt(tid,ts)
    const mkId = cross ? mk.cross : ng ? mk.ng : (loop && mk.loop) ? mk.loop : mk.def
    const sc   = cross ? '#3090b0' : ng ? '#a07030' : loop ? '#8060a0' : '#5a6a7a'
    const sw   = (cross||loop) ? '1.2' : '1.5'
    const da   = (cross||loop) ? ' stroke-dasharray="5,3"' : ''
    let d: string
    if (Math.abs(fy-ty)<2)          d = `M ${fx} ${fy} H ${tx}`
    else if (Math.abs(fx-tx)<2)     d = `M ${fx} ${fy} V ${ty}`
    else if (fs==='t'||fs==='b') { const m=(fy+ty)/2; d = `M ${fx} ${fy} V ${m} H ${tx} V ${ty}` }
    else                           { const m=(fx+tx)/2; d = `M ${fx} ${fy} H ${m} V ${ty} H ${tx}` }
    let s = `<path d="${d}" fill="none" stroke="${sc}" stroke-width="${sw}"${da} marker-end="url(#${mkId})"/>`
    if (label) { const lx=(fx+tx)/2, ly=Math.min(fy,ty)-7; s += `<text x="${lx}" y="${ly}" text-anchor="middle" fill="${sc}" font-size="9" font-family="monospace">${esc(label)}</text>` }
    return s
  }
}

// ════════════════ D2 — 全体フロー ════════════════════════════════════════════
const D2_NODES: (string|number)[][] = [
  ['u_start',110,250,'startend','ellipse','開始'],['u_new_q',275,250,'decision','diamond','新規\n登録?'],
  ['u_login',450,190,'user','rect','ログイン\nフォーム'],['u_auth_ok',650,190,'decision','diamond','認証\nOK?'],['u_auth_err',650,260,'io','rect','エラー表示\n(再入力)'],['u_mypage',840,190,'user','rect','マイページ\n確認'],
  ['u_signup',450,320,'user','rect','新規登録\nフォーム'],['u_mail_out',650,320,'notify','rect','確認メール\n送信'],['u_verified',840,320,'user','rect','メール\n本人確認'],
  ['u_pw_req',450,415,'user','rect','PW\nリセット申請'],['u_pw_mail',650,415,'notify','rect','リセットメール\n送信'],['u_pw_done',840,415,'user','rect','新PW\n設定完了'],
  ['s_start',110,560,'startend','ellipse','開始'],['s_form',290,560,'store','rect','店舗登録\nフォーム'],['s_submit',470,560,'store','rect','申請送信'],
  ['a_start',110,775,'startend','ellipse','開始'],['a_login',290,775,'admin','rect','ログイン'],['a_dash',470,775,'admin','rect','ダッシュ\nボード'],
  ['s_wait',975,560,'store','rect','審査\n待ち'],['a_rev',1180,775,'decision','diamond','店舗\n審査'],['a_approve',1375,715,'admin','rect','承認'],['a_reject',1375,845,'io','rect','却下'],['n_rej_m',1560,845,'notify','rect','却下通知\nメール(店舗)'],['n_app_m',1375,635,'notify','rect','承認メール\n送信(店舗)'],['s_activate',1560,560,'store','rect','アカウント\n有効化'],['s_login',1750,560,'store','rect','ログイン\n(shop_admin)'],
  ['s_bike',1940,505,'store','rect','自転車\n登録・編集'],['s_status',1940,615,'store','rect','在庫\nステータス管理'],['s_price',2130,505,'store','rect','料金\nプラン設定'],['s_cal',2320,560,'store','rect','カレンダー\n(休業日)設定'],
  ['u_search',1930,190,'user','rect','エリア・日時\n選択'],['u_exec',2120,190,'user','rect','検索実行'],['u_has_res',2310,190,'decision','diamond','空車\nあり?'],['u_no_res',2310,305,'io','rect','空車なし\n(条件変更)'],['u_list',2500,190,'user','rect','検索結果\n一覧'],
  ['u_detail',2700,190,'user','rect','自転車詳細\n日時選択'],['u_inv_q',2890,190,'decision','diamond','在庫\n最終確認'],['u_inv_ng',2890,305,'io','rect','在庫切れ\n(別の自転車)'],['u_cart1',3080,190,'user','rect','予約①\n空車確認'],['u_cart2',3270,190,'user','rect','予約②\n顧客情報'],['u_cart3',3460,190,'user','rect','予約③\n内容確認'],
  ['u_cart4',3590,190,'user','rect','予約④\n決済'],['u_card',3590,85,'popup','rect','カード情報\n入力'],['u_payjp',3780,85,'external','rect','Pay.JP\n決済処理'],['u_pay_ok',3780,190,'decision','diamond','決済\nOK?'],['u_pay_err',3780,305,'io','rect','決済エラー\n表示'],['u_retry_q',3970,305,'decision','diamond','再試行?\n(3回上限)'],['u_max_err',3970,415,'io','rect','予約中断\n(上限超過)'],['n_fail_u',4170,415,'notify','rect','決済失敗\nメール(ユーザー)'],['u_pay_done',3970,190,'user','rect','決済完了\n予約確定'],
  ['n_fail_a',4170,870,'notify','rect','決済失敗\nアラート(管理者)'],
  ['n_conf_u',4480,190,'notify','rect','予約確認\nメール(ユーザー)'],['u_resv',4670,190,'user','rect','予約一覧\n確認'],['n_conf_s',4480,560,'notify','rect','予約通知\nメール(店舗)'],['s_resv',4670,560,'store','rect','予約\n詳細確認'],['s_prep',4860,560,'store','rect','自転車\n準備'],['a_pay_mgmt',4480,775,'admin','rect','決済問題\n対応'],['a_monitor',4670,775,'admin','rect','予約\nモニタリング'],['a_report',4860,775,'admin','rect','売上\nレポート'],
  ['u_cq',5180,190,'decision','diamond','キャンセル\nする?'],['u_pq',5370,190,'decision','diamond','キャンセル\n期限内?'],['u_refund',5560,140,'user','rect','全額\n返金処理'],['u_noref',5560,250,'io','rect','返金なし\n(規定外)'],['u_cancel',5750,190,'user','rect','キャンセル\n完了'],['n_can_u',5750,85,'notify','rect','キャンセル確認\nメール(ユーザー)'],['n_can_s',5750,480,'notify','rect','キャンセル通知\nメール(店舗)'],['s_cancel',5750,560,'store','rect','キャンセル\n確認・対応'],['a_refund',5560,775,'admin','rect','返金\n処理'],['a_sim',5750,775,'admin','rect','料金\nシミュレーション'],
]

function d2Lanes(): string {
  const W=5820, BOTTOM=910
  const PH=[
    {x:60,  w:840,  label:'アカウント・認証',             fill:'#1e2030',stroke:'#4a4a70',tc:'#9090c0'},
    {x:900, w:940,  label:'店舗準備・承認 / マスタ管理',   fill:'#1c2820',stroke:'#3a5838',tc:'#70a070'},
    {x:1840,w:780,  label:'自転車検索・閲覧',              fill:'#1e2820',stroke:'#385828',tc:'#78a868'},
    {x:2620,w:860,  label:'予約フロー',                    fill:'#282018',stroke:'#5a4828',tc:'#a08840'},
    {x:3480,w:940,  label:'決済',                          fill:'#281828',stroke:'#5a3058',tc:'#a068a0'},
    {x:4420,w:680,  label:'完了・通知',                    fill:'#182028',stroke:'#305060',tc:'#6090a0'},
    {x:5100,w:720,  label:'キャンセル・返金',              fill:'#281e10',stroke:'#5a4020',tc:'#a07838'},
  ]
  let s = ''
  PH.forEach(p => {
    s += `<rect x="${p.x+1}" y="1" width="${p.w-3}" height="38" rx="5" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1.2"/>`
    s += `<text x="${p.x+p.w/2}" y="25" text-anchor="middle" fill="${p.tc}" font-size="12" font-weight="700" font-family="'Hiragino Sans',sans-serif">${p.label}</text>`
  })
  PH.slice(1).forEach(p => { s += `<line x1="${p.x}" y1="0" x2="${p.x}" y2="${BOTTOM}" stroke="#303040" stroke-width="1" stroke-dasharray="4,4"/>` })
  s += `<rect x="60" y="42" width="${W}" height="398" rx="6" fill="rgba(26,60,40,0.10)" stroke="#2a4a34" stroke-width="1"/><text x="72" y="64" fill="#34a853" font-size="13" font-weight="700" font-family="'Hiragino Sans',sans-serif">ユーザー</text>`
  s += `<rect x="60" y="450" width="${W}" height="220" rx="6" fill="rgba(40,26,70,0.12)" stroke="#3a2a54" stroke-width="1"/><text x="72" y="472" fill="#8060d8" font-size="13" font-weight="700" font-family="'Hiragino Sans',sans-serif">店舗</text>`
  s += `<rect x="60" y="680" width="${W}" height="225" rx="6" fill="rgba(70,26,26,0.12)" stroke="#542a2a" stroke-width="1"/><text x="72" y="702" fill="#d05050" font-size="13" font-weight="700" font-family="'Hiragino Sans',sans-serif">管理者</text>`
  return s
}

function d2Edges(pt: PtFn): string {
  const e = makeEdgeFn({ def:'m2', cross:'m2c', ng:'m2n', loop:'m2l' })
  let h = ''
  h+=e(pt,'u_start','r','u_new_q','l')
  h+=e(pt,'u_new_q','t','u_login','l',{label:'No(既存)'})
  h+=e(pt,'u_new_q','b','u_signup','l',{label:'Yes(新規)'})
  h+=e(pt,'u_login','r','u_auth_ok','l')
  h+=e(pt,'u_auth_ok','r','u_mypage','l',{label:'OK'})
  h+=e(pt,'u_auth_ok','b','u_auth_err','t',{label:'NG',ng:true})
  h+=e(pt,'u_auth_err','b','u_pw_req','t',{label:'PW忘れ',ng:true})
  h+=e(pt,'u_signup','r','u_mail_out','l')
  h+=e(pt,'u_mail_out','r','u_verified','l')
  h+=e(pt,'u_pw_req','r','u_pw_mail','l')
  h+=e(pt,'u_pw_mail','r','u_pw_done','l')
  h+=e(pt,'s_start','r','s_form','l')
  h+=e(pt,'s_form','r','s_submit','l')
  h+=e(pt,'s_submit','r','s_wait','l')
  h+=e(pt,'s_submit','b','a_dash','t',{cross:true,label:'申請通知'})
  h+=e(pt,'a_start','r','a_login','l')
  h+=e(pt,'a_login','r','a_dash','l')
  h+=e(pt,'a_dash','r','a_rev','l')
  h+=e(pt,'s_wait','b','a_rev','t',{cross:true})
  h+=e(pt,'a_rev','t','a_approve','b',{label:'承認'})
  h+=e(pt,'a_rev','b','a_reject','t',{label:'却下',ng:true})
  h+=e(pt,'a_reject','r','n_rej_m','l')
  h+=e(pt,'a_approve','t','n_app_m','b')
  h+=e(pt,'n_app_m','t','s_activate','b',{cross:true})
  h+=e(pt,'s_activate','r','s_login','l')
  h+=e(pt,'s_login','r','s_bike','l')
  h+=e(pt,'s_bike','r','s_price','l')
  h+=e(pt,'s_price','r','s_cal','l')
  h+=e(pt,'u_mypage','r','u_search','l')
  h+=e(pt,'u_verified','r','u_search','l')
  h+=e(pt,'u_pw_done','r','u_search','l')
  h+=e(pt,'u_search','r','u_exec','l')
  h+=e(pt,'u_exec','r','u_has_res','l')
  h+=e(pt,'u_has_res','r','u_list','l',{label:'あり'})
  h+=e(pt,'u_has_res','b','u_no_res','t',{label:'なし',ng:true})
  h+=e(pt,'u_list','r','u_detail','l')
  h+=e(pt,'u_detail','r','u_inv_q','l')
  h+=e(pt,'u_inv_q','r','u_cart1','l',{label:'OK'})
  h+=e(pt,'u_inv_q','b','u_inv_ng','t',{label:'NG',ng:true})
  h+=e(pt,'u_cart1','r','u_cart2','l')
  h+=e(pt,'u_cart2','r','u_cart3','l')
  h+=e(pt,'u_cart3','r','u_cart4','l')
  h+=e(pt,'u_cart4','t','u_card','b')
  h+=e(pt,'u_card','r','u_payjp','l')
  h+=e(pt,'u_payjp','b','u_pay_ok','t')
  h+=e(pt,'u_pay_ok','r','u_pay_done','l',{label:'OK'})
  h+=e(pt,'u_pay_ok','b','u_pay_err','t',{label:'NG',ng:true})
  h+=e(pt,'u_pay_err','r','u_retry_q','l')
  h+=e(pt,'u_retry_q','b','u_max_err','t',{label:'上限超過',ng:true})
  h+=e(pt,'u_max_err','r','n_fail_u','l')
  h+=e(pt,'n_fail_u','b','n_fail_a','t',{cross:true})
  const [rpx,rpy]=pt('u_retry_q','t'), [cpx,cpy]=pt('u_card','t')
  h+=`<path d="M ${rpx} ${rpy} V 20 H ${cpx} V ${cpy}" fill="none" stroke="#8060a0" stroke-width="1.2" stroke-dasharray="4,3" marker-end="url(#m2l)"/>`
  h+=`<text x="${(rpx+cpx)/2}" y="12" text-anchor="middle" fill="#8060a0" font-size="9" font-family="monospace">Yes→再試行</text>`
  h+=e(pt,'u_pay_done','r','n_conf_u','l')
  h+=e(pt,'n_conf_u','r','u_resv','l')
  h+=e(pt,'u_pay_done','b','n_conf_s','t',{cross:true})
  h+=e(pt,'n_conf_s','r','s_resv','l')
  h+=e(pt,'s_resv','r','s_prep','l')
  h+=e(pt,'n_fail_a','r','a_pay_mgmt','l',{cross:true})
  h+=e(pt,'a_pay_mgmt','r','a_monitor','l')
  h+=e(pt,'a_monitor','r','a_report','l')
  h+=e(pt,'u_resv','r','u_cq','l')
  h+=e(pt,'u_cq','r','u_pq','l',{label:'する'})
  h+=e(pt,'u_pq','t','u_refund','b',{label:'期限内'})
  h+=e(pt,'u_pq','b','u_noref','t',{label:'期限外',ng:true})
  h+=e(pt,'u_refund','r','u_cancel','l')
  h+=e(pt,'u_noref','r','u_cancel','l')
  h+=e(pt,'u_cancel','t','n_can_u','b')
  h+=e(pt,'u_cancel','b','n_can_s','t',{cross:true})
  h+=e(pt,'n_can_s','b','s_cancel','t',{cross:true})
  h+=e(pt,'u_refund','b','a_refund','t',{cross:true})
  h+=e(pt,'a_refund','r','a_sim','l')
  return h
}

// ════════════════ D3 — 決済フロー（詳細）════════════════════════════════════
const D3_NODES: (string|number)[][] = [
  ['u_cart4',  110,200,'user',    'rect','予約④\n決済画面'],
  ['u_card',   300,120,'popup',   'rect','カード情報\n入力(POP)'],
  ['u_token',  490,120,'external','rect','Pay.JP\nトークン化'],
  ['u_charge', 700,200,'external','rect','Pay.JP\nチャージ実行'],
  ['u_pay_ok', 900,200,'decision','diamond','決済\nOK?'],
  ['u_pay_err',900,330,'io',      'rect','決済エラー\n表示'],
  ['u_retry_q',1090,330,'decision','diamond','再試行?\n(3回上限)'],
  ['u_give_up',1090,450,'io',     'rect','予約中断\n(上限超過)'],
  ['u_done',   1090,200,'user',   'rect','決済完了\n予約確定'],
  ['u_resv',   1280,200,'user',   'rect','予約一覧\n確認'],
  ['u_cancel', 1470,200,'user',   'rect','キャンセル\n申請'],
  ['u_refund_q',1660,200,'decision','diamond','期限\n内?'],
  ['u_ref_ok', 1850,130,'user',   'rect','Pay.JP\n返金処理'],
  ['u_ref_ng', 1850,270,'io',     'rect','返金なし\n(規定外)'],
  ['u_cancel_done',2050,200,'user','rect','キャンセル\n完了'],
  ['n_conf_u', 1090,90,'notify',  'rect','確認メール\n(ユーザー)'],
  ['n_conf_s',  700,510,'notify', 'rect','予約通知\n(店舗)'],
  ['n_fail',   1280,490,'notify', 'rect','決済失敗メール\n(ユーザー+管理者)'],
  ['n_refund', 2050,80,'notify',  'rect','返金完了メール\n(ユーザー)'],
  ['n_cancel_s',2050,340,'notify','rect','キャンセル通知\n(店舗)'],
  ['a_monitor',1280,610,'admin',  'rect','決済問題\nモニタリング'],
  ['a_refund', 1850,510,'admin',  'rect','返金承認\n(管理者)'],
]

function d3Lanes(): string {
  const W=2200, BOTTOM=720
  const PH=[
    {x:60,  w:570,label:'カード入力・トークン化',fill:'#1e1828',stroke:'#503060',tc:'#9060b0'},
    {x:630, w:600,label:'チャージ・決済判定',   fill:'#281828',stroke:'#5a3058',tc:'#a068a0'},
    {x:1230,w:500,label:'完了・確認',           fill:'#182028',stroke:'#305060',tc:'#6090a0'},
    {x:1730,w:500,label:'キャンセル・返金',      fill:'#281e10',stroke:'#5a4020',tc:'#a07838'},
  ]
  let s = ''
  PH.forEach(p => {
    s += `<rect x="${p.x+1}" y="1" width="${p.w-3}" height="38" rx="5" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1.2"/>`
    s += `<text x="${p.x+p.w/2}" y="25" text-anchor="middle" fill="${p.tc}" font-size="12" font-weight="700" font-family="'Hiragino Sans',sans-serif">${p.label}</text>`
  })
  PH.slice(1).forEach(p => { s += `<line x1="${p.x}" y1="0" x2="${p.x}" y2="${BOTTOM}" stroke="#303040" stroke-width="1" stroke-dasharray="4,4"/>` })
  s += `<rect x="60" y="42" width="${W}" height="370" rx="6" fill="rgba(26,60,40,0.10)" stroke="#2a4a34" stroke-width="1"/><text x="72" y="64" fill="#34a853" font-size="13" font-weight="700" font-family="'Hiragino Sans',sans-serif">ユーザー</text>`
  s += `<rect x="60" y="422" width="${W}" height="270" rx="6" fill="rgba(70,26,26,0.12)" stroke="#542a2a" stroke-width="1"/><text x="72" y="444" fill="#d05050" font-size="13" font-weight="700" font-family="'Hiragino Sans',sans-serif">管理者 / 通知</text>`
  return s
}

function d3Edges(pt: PtFn): string {
  const e = makeEdgeFn({ def:'m3', cross:'m3x', ng:'m3n', loop:'m3l' })
  let h = ''
  h+=e(pt,'u_cart4','t','u_card','b')
  h+=e(pt,'u_card','r','u_token','l')
  h+=e(pt,'u_token','b','u_charge','t')
  h+=e(pt,'u_charge','r','u_pay_ok','l')
  h+=e(pt,'u_pay_ok','r','u_done','l',{label:'OK'})
  h+=e(pt,'u_pay_ok','b','u_pay_err','t',{label:'NG',ng:true})
  h+=e(pt,'u_pay_err','r','u_retry_q','l')
  h+=e(pt,'u_retry_q','b','u_give_up','t',{label:'上限',ng:true})
  h+=e(pt,'u_give_up','r','n_fail','l')
  h+=e(pt,'n_fail','b','a_monitor','t',{cross:true})
  const [rpx,rpy]=pt('u_retry_q','t'), [cpx,cpy]=pt('u_card','t')
  h+=`<path d="M ${rpx} ${rpy} V 50 H ${cpx} V ${cpy}" fill="none" stroke="#8060a0" stroke-width="1.2" stroke-dasharray="4,3" marker-end="url(#m3l)"/>`
  h+=`<text x="${(rpx+cpx)/2}" y="42" text-anchor="middle" fill="#8060a0" font-size="9" font-family="monospace">Yes→再試行</text>`
  h+=e(pt,'u_done','t','n_conf_u','b')
  h+=e(pt,'u_done','b','n_conf_s','t',{cross:true})
  h+=e(pt,'u_done','r','u_resv','l')
  h+=e(pt,'u_resv','r','u_cancel','l')
  h+=e(pt,'u_cancel','r','u_refund_q','l')
  h+=e(pt,'u_refund_q','t','u_ref_ok','b',{label:'期限内'})
  h+=e(pt,'u_refund_q','b','u_ref_ng','t',{label:'期限外',ng:true})
  h+=e(pt,'u_ref_ok','r','u_cancel_done','l')
  h+=e(pt,'u_ref_ng','r','u_cancel_done','l')
  h+=e(pt,'u_cancel_done','t','n_refund','b')
  h+=e(pt,'u_cancel_done','b','n_cancel_s','t',{cross:true})
  h+=e(pt,'u_ref_ok','b','a_refund','t',{cross:true})
  return h
}

// ════════════════ D4 — 予約フロー（詳細）════════════════════════════════════
const D4_NODES: (string|number)[][] = [
  ['u_search', 100,210,'user',    'rect','エリア・日時\n選択'],
  ['u_list',   290,210,'user',    'rect','検索結果\n一覧'],
  ['u_detail', 480,210,'user',    'rect','自転車詳細\n日時選択'],
  ['u_inv_q',  670,210,'decision','diamond','在庫\n確認'],
  ['u_inv_ng', 670,340,'io',      'rect','在庫切れ\n(別を選択)'],
  ['u_c1',     860,210,'user',    'rect','予約①\n空車確認'],
  ['u_c2',    1050,210,'user',    'rect','予約②\n顧客情報'],
  ['u_c3',    1240,210,'user',    'rect','予約③\n内容確認'],
  ['u_c4',    1430,210,'user',    'rect','予約④\n決済'],
  ['u_pay_ok',1620,210,'decision','diamond','決済\nOK?'],
  ['u_pay_ng',1620,340,'io',      'rect','決済失敗\n(再試行)'],
  ['u_confirmed',1820,210,'user', 'rect','予約確定\n(来客待ち)'],
  ['u_lend',  2010,210,'user',    'rect','来店・\n貸出開始'],
  ['u_return',2200,210,'user',    'rect','返却\n手続き'],
  ['u_done',  2390,210,'user',    'rect','返却済み\n完了'],
  ['u_myresv',2010,80,'user',     'rect','予約一覧\n確認'],
  ['u_cancel_q',1820,340,'decision','diamond','キャン\nセル?'],
  ['u_limit_q',2010,400,'decision','diamond','期限\n内?'],
  ['u_ref',   2200,330,'user',    'rect','返金あり\nキャンセル'],
  ['u_noref', 2200,470,'io',      'rect','返金なし\nキャンセル'],
  ['s_notify', 1820,560,'store',  'rect','予約通知\n受信'],
  ['s_prep',   2010,560,'store',  'rect','自転車\n準備'],
  ['s_lend',   2200,560,'store',  'rect','貸出確認\n(ステータス変更)'],
  ['s_ret',    2390,560,'store',  'rect','返却確認\n(ステータス変更)'],
  ['s_cancel', 2390,460,'store',  'rect','キャンセル\n対応'],
  ['n_conf',   1820,80,'notify',  'rect','予約確認\nメール'],
  ['n_canc',   2390,340,'notify', 'rect','キャンセル\n確認メール'],
]

function d4Lanes(): string {
  const W=2480, BOTTOM=680
  const PH=[
    {x:60,  w:670,label:'自転車検索・閲覧',fill:'#1e2820',stroke:'#385828',tc:'#78a868'},
    {x:730, w:770,label:'予約フロー',       fill:'#282018',stroke:'#5a4828',tc:'#a08840'},
    {x:1500,w:580,label:'決済・確定',       fill:'#281828',stroke:'#5a3058',tc:'#a068a0'},
    {x:2080,w:480,label:'利用・返却',       fill:'#182028',stroke:'#305060',tc:'#6090a0'},
  ]
  let s = ''
  PH.forEach(p => {
    s += `<rect x="${p.x+1}" y="1" width="${p.w-3}" height="38" rx="5" fill="${p.fill}" stroke="${p.stroke}" stroke-width="1.2"/>`
    s += `<text x="${p.x+p.w/2}" y="25" text-anchor="middle" fill="${p.tc}" font-size="12" font-weight="700" font-family="'Hiragino Sans',sans-serif">${p.label}</text>`
  })
  PH.slice(1).forEach(p => { s += `<line x1="${p.x}" y1="0" x2="${p.x}" y2="${BOTTOM}" stroke="#303040" stroke-width="1" stroke-dasharray="4,4"/>` })
  s += `<rect x="60" y="42" width="${W}" height="395" rx="6" fill="rgba(26,60,40,0.10)" stroke="#2a4a34" stroke-width="1"/><text x="72" y="64" fill="#34a853" font-size="13" font-weight="700" font-family="'Hiragino Sans',sans-serif">ユーザー</text>`
  s += `<rect x="60" y="447" width="${W}" height="200" rx="6" fill="rgba(40,26,70,0.12)" stroke="#3a2a54" stroke-width="1"/><text x="72" y="469" fill="#8060d8" font-size="13" font-weight="700" font-family="'Hiragino Sans',sans-serif">店舗</text>`
  return s
}

function d4Edges(pt: PtFn): string {
  const e = makeEdgeFn({ def:'m4', cross:'m4x', ng:'m4n' })
  let h = ''
  h+=e(pt,'u_search','r','u_list','l')
  h+=e(pt,'u_list','r','u_detail','l')
  h+=e(pt,'u_detail','r','u_inv_q','l')
  h+=e(pt,'u_inv_q','r','u_c1','l',{label:'OK'})
  h+=e(pt,'u_inv_q','b','u_inv_ng','t',{label:'NG',ng:true})
  h+=e(pt,'u_c1','r','u_c2','l')
  h+=e(pt,'u_c2','r','u_c3','l')
  h+=e(pt,'u_c3','r','u_c4','l')
  h+=e(pt,'u_c4','r','u_pay_ok','l')
  h+=e(pt,'u_pay_ok','r','u_confirmed','l',{label:'OK'})
  h+=e(pt,'u_pay_ok','b','u_pay_ng','t',{label:'NG',ng:true})
  h+=e(pt,'u_confirmed','t','n_conf','b')
  h+=e(pt,'n_conf','r','u_myresv','l')
  h+=e(pt,'u_confirmed','r','u_lend','l')
  h+=e(pt,'u_lend','r','u_return','l')
  h+=e(pt,'u_return','r','u_done','l')
  h+=e(pt,'u_confirmed','b','u_cancel_q','t')
  h+=e(pt,'u_cancel_q','r','u_limit_q','l',{label:'する'})
  h+=e(pt,'u_limit_q','t','u_ref','b',{label:'期限内'})
  h+=e(pt,'u_limit_q','b','u_noref','t',{label:'期限外',ng:true})
  h+=e(pt,'u_ref','r','n_canc','l')
  h+=e(pt,'u_noref','r','s_cancel','l',{cross:true})
  h+=e(pt,'u_confirmed','b','s_notify','t',{cross:true})
  h+=e(pt,'s_notify','r','s_prep','l')
  h+=e(pt,'s_prep','r','s_lend','l')
  h+=e(pt,'s_lend','r','s_ret','l')
  h+=e(pt,'s_lend','t','u_lend','b',{cross:true})
  h+=e(pt,'s_ret','t','u_return','b',{cross:true})
  return h
}

// ── Diagram controller hook ───────────────────────────────────────────────────
function useDiagram(
  wrapRef: React.RefObject<HTMLDivElement | null>,
  vpRef:   React.RefObject<SVGGElement | null>,
  svgW: number, svgH: number,
  content: string,
) {
  const state = useRef({ vx:0, vy:0, vscale:1 })

  function applyT() {
    if (!vpRef.current) return
    const { vx, vy, vscale } = state.current
    vpRef.current.setAttribute('transform', `translate(${vx},${vy}) scale(${vscale})`)
  }

  function fitView() {
    if (!wrapRef.current) return
    const pw = wrapRef.current.clientWidth, ph = wrapRef.current.clientHeight
    state.current.vscale = Math.min(pw/svgW, ph/svgH) * 0.92
    state.current.vx = (pw - svgW*state.current.vscale) / 2
    state.current.vy = (ph - svgH*state.current.vscale) / 2
    applyT()
  }

  function render() {
    if (vpRef.current) vpRef.current.innerHTML = content
  }

  return { render, fitView, applyT, state }
}

// ── Main component ────────────────────────────────────────────────────────────
type BizTab = 'zen' | 'kessai' | 'yoyaku'

export default function BizFlowTab() {
  const [activeTab, setActiveTab] = useState<BizTab>('zen')

  const d2WrapRef = useRef<HTMLDivElement>(null)
  const d2VpRef   = useRef<SVGGElement>(null)
  const d3WrapRef = useRef<HTMLDivElement>(null)
  const d3VpRef   = useRef<SVGGElement>(null)
  const d4WrapRef = useRef<HTMLDivElement>(null)
  const d4VpRef   = useRef<SVGGElement>(null)

  const d2Content = buildContent(D2_NODES, d2Lanes, d2Edges)
  const d3Content = buildContent(D3_NODES, d3Lanes, d3Edges)
  const d4Content = buildContent(D4_NODES, d4Lanes, d4Edges)

  const d2 = useDiagram(d2WrapRef, d2VpRef, 5900, 960, d2Content)
  const d3 = useDiagram(d3WrapRef, d3VpRef, 2260, 740, d3Content)
  const d4 = useDiagram(d4WrapRef, d4VpRef, 2560, 680, d4Content)

  // Global drag state shared across all diagrams
  const dragRef = useRef<{ sx:number; sy:number; applyT:()=>void; state:React.MutableRefObject<{vx:number;vy:number;vscale:number}> } | null>(null)

  function setupDiagramEvents(
    wrap: HTMLDivElement,
    diagState: React.MutableRefObject<{vx:number;vy:number;vscale:number}>,
    applyT: ()=>void
  ) {
    function onWheel(ev: WheelEvent) {
      ev.preventDefault()
      const f = ev.deltaY < 0 ? 1.12 : 0.88
      const r = wrap.getBoundingClientRect()
      const mx = ev.clientX - r.left, my = ev.clientY - r.top
      diagState.current.vx = mx - (mx - diagState.current.vx) * f
      diagState.current.vy = my - (my - diagState.current.vy) * f
      diagState.current.vscale *= f
      applyT()
    }
    function onMouseDown(ev: MouseEvent) {
      dragRef.current = { sx: ev.clientX - diagState.current.vx, sy: ev.clientY - diagState.current.vy, applyT, state: diagState }
    }
    wrap.addEventListener('wheel', onWheel, { passive: false })
    wrap.addEventListener('mousedown', onMouseDown)
    return () => {
      wrap.removeEventListener('wheel', onWheel)
      wrap.removeEventListener('mousedown', onMouseDown)
    }
  }

  useEffect(() => {
    // Global move/up handlers
    function onMouseMove(ev: MouseEvent) {
      if (!dragRef.current) return
      dragRef.current.state.current.vx = ev.clientX - dragRef.current.sx
      dragRef.current.state.current.vy = ev.clientY - dragRef.current.sy
      dragRef.current.applyT()
    }
    function onMouseUp() { dragRef.current = null }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    // D2 init
    d2.render(); d2.fitView()
    const c2 = d2WrapRef.current ? setupDiagramEvents(d2WrapRef.current, d2.state, d2.applyT) : null
    const c3 = d3WrapRef.current ? setupDiagramEvents(d3WrapRef.current, d3.state, d3.applyT) : null
    const c4 = d4WrapRef.current ? setupDiagramEvents(d4WrapRef.current, d4.state, d4.applyT) : null

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      c2?.(); c3?.(); c4?.()
    }
  }, [])

  // On tab switch, render + fitView the newly active diagram
  useEffect(() => {
    if (activeTab === 'kessai') { d3.render(); setTimeout(() => d3.fitView(), 50) }
    if (activeTab === 'yoyaku') { d4.render(); setTimeout(() => d4.fitView(), 50) }
  }, [activeTab])

  const tabBtnStyle = (id: BizTab): React.CSSProperties => ({
    display:'flex', alignItems:'center', gap:6, padding:'0 16px', height:34,
    border:'none', background:'transparent',
    color: activeTab === id ? '#90b8f0' : '#686880',
    fontSize:12, fontWeight:600, cursor:'pointer',
    borderBottom: `2px solid ${activeTab === id ? '#4a8ad8' : 'transparent'}`,
    marginBottom:-1, whiteSpace:'nowrap',
  })

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden', background:'#212124' }}>

      {/* Topbar */}
      <div style={{
        background:'#2a2a2f', padding:'6px 14px', display:'flex', alignItems:'center',
        gap:10, borderBottom:'1px solid #38383f', flexShrink:0, boxShadow:'0 2px 8px rgba(0,0,0,.4)',
      }}>
        <h1 style={{ fontSize:15, fontWeight:700, color:'#d0d0d8', whiteSpace:'nowrap' }}>📋 Rincle 業務フロー図</h1>
        <div style={{ width:1, height:18, background:'#38383f' }} />
        <span style={{ fontSize:11, color:'#666678' }}>マウスホイールでズーム / ドラッグでパン（上下それぞれ独立）</span>
      </div>

      {/* Page tabs */}
      <div style={{ display:'flex', alignItems:'stretch', background:'#252528', borderBottom:'1px solid #38383f', padding:'0 14px', gap:2, flexShrink:0 }}>
        {([['zen','全体'],['kessai','決済'],['yoyaku','予約']] as [BizTab,string][]).map(([id, label]) => (
          <button key={id} onClick={() => setActiveTab(id)} style={tabBtnStyle(id)}>{label}</button>
        ))}
      </div>

      {/* ── Tab: 全体 ── */}
      <div style={{ display: activeTab === 'zen' ? 'flex' : 'none', flex:1, flexDirection:'column', minHeight:0, overflow:'hidden' }}>
        <div style={{ height:28, display:'flex', alignItems:'center', gap:8, padding:'0 14px', flexShrink:0, background:'#201a08', borderBottom:'1px solid #303040', borderTop:'2px solid #605020' }}>
          <span style={{ fontSize:12, fontWeight:700, color:'#c8a030' }}>📋 全体フロー</span>
          <div style={{ width:1, height:18, background:'#38383f' }} />
          <button onClick={() => { d2.render(); d2.fitView() }} style={{ padding:'3px 10px', border:'1px solid #444450', borderRadius:4, background:'#38383f', color:'#a0a0b8', fontSize:11, cursor:'pointer' }}>全体表示</button>
        </div>
        <div ref={d2WrapRef} style={{ flex:1, overflow:'hidden', cursor:'grab', background:'#1a1a1f' }}>
          <svg style={{ width:'100%', height:'100%' }}>
            <defs>
              <marker id="m2"  markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#7a8a9a"/></marker>
              <marker id="m2c" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#3090b0"/></marker>
              <marker id="m2n" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#a07030"/></marker>
              <marker id="m2l" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#8060a0"/></marker>
            </defs>
            <g ref={d2VpRef} />
          </svg>
        </div>

        {/* Legend (only on 全体 tab) */}
        <div style={{ position:'absolute', bottom:16, left:16, background:'#2a2a2f', border:'1px solid #38383f', borderRadius:8, padding:'10px 14px', display:'flex', flexDirection:'column', gap:6, boxShadow:'0 4px 12px rgba(0,0,0,.5)', zIndex:100 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#888898', marginBottom:2 }}>凡例</div>
          <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
            {[
              { bg:'#1a3a28',stroke:'#34a853',label:'ユーザー' },
              { bg:'#1e1a38',stroke:'#8060d8',label:'店舗' },
              { bg:'#3a1818',stroke:'#d05050',label:'管理者' },
              { bg:'#3a3010',stroke:'#c8a030',label:'ポップアップ' },
              { bg:'#181e3a',stroke:'#3878d0',label:'外部' },
              { bg:'#182030',stroke:'#3090b0',label:'通知' },
              { bg:'#301e10',stroke:'#a07030',label:'エラー' },
            ].map(({ bg, stroke, label }) => (
              <div key={label} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#a0a0b8' }}>
                <div style={{ width:22, height:13, borderRadius:3, border:`1.5px solid ${stroke}`, background:bg, flexShrink:0 }} />{label}
              </div>
            ))}
            <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#a0a0b8' }}>
              <div style={{ width:11, height:11, transform:'rotate(45deg)', border:'1.5px solid #4a72c0', background:'#151e38', flexShrink:0 }} />分岐
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            {[
              { stroke:'#7a8a9a', dash:false, label:'通常' },
              { stroke:'#3090b0', dash:true,  label:'アクター間' },
              { stroke:'#8060a0', dash:true,  label:'ループバック' },
            ].map(({ stroke, dash, label }) => (
              <div key={label} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#a0a0b8' }}>
                <svg width="28" height="10" viewBox="0 0 28 10">
                  <defs><marker id={`ll-${label}`} markerWidth="5" markerHeight="4" refX="4" refY="2" orient="auto"><polygon points="0 0,5 2,0 4" fill={stroke}/></marker></defs>
                  <line x1="0" y1="5" x2="22" y2="5" stroke={stroke} strokeWidth={dash?1.2:1.5} strokeDasharray={dash?'4,3':undefined} markerEnd={`url(#ll-${label})`}/>
                </svg>{label}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tab: 決済 ── */}
      <div style={{ display: activeTab === 'kessai' ? 'flex' : 'none', flex:1, flexDirection:'column', minHeight:0, overflow:'hidden' }}>
        <div style={{ height:28, display:'flex', alignItems:'center', gap:8, padding:'0 14px', flexShrink:0, background:'#201828', borderBottom:'1px solid #303040', borderTop:'2px solid #7040b0' }}>
          <span style={{ fontSize:12, fontWeight:700, color:'#b080e0' }}>💳 決済フロー（詳細）</span>
          <div style={{ width:1, height:18, background:'#38383f' }} />
          <button onClick={() => { d3.render(); d3.fitView() }} style={{ padding:'3px 10px', border:'1px solid #444450', borderRadius:4, background:'#38383f', color:'#a0a0b8', fontSize:11, cursor:'pointer' }}>全体表示</button>
        </div>
        <div ref={d3WrapRef} style={{ flex:'1.4', overflow:'hidden', cursor:'grab', background:'#1a1a1f', minHeight:0 }}>
          <svg style={{ width:'100%', height:'100%' }}>
            <defs>
              <marker id="m3"  markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#7a8a9a"/></marker>
              <marker id="m3x" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#3090b0"/></marker>
              <marker id="m3n" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#a07030"/></marker>
              <marker id="m3l" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#8060a0"/></marker>
            </defs>
            <g ref={d3VpRef} />
          </svg>
        </div>
        <div style={{ height:28, display:'flex', alignItems:'center', gap:8, padding:'0 14px', flexShrink:0, background:'#181828', borderBottom:'1px solid #303040', borderTop:'2px solid #304880' }}>
          <span style={{ fontSize:12, fontWeight:700, color:'#6088c0' }}>📊 決済ステータス</span>
        </div>
        <div style={{ flex:'0 0 auto', maxHeight:260, overflowY:'auto', padding:'14px 18px' }}>
          <div style={{ marginBottom:28 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#888898', marginBottom:10, paddingBottom:4, borderBottom:'1px solid #2e2e38' }}>ステータス一覧</div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead><tr>
                <th style={slTh}>ステータス名</th><th style={slTh}>詳細</th>
              </tr></thead>
              <tbody>
                {[
                  { bg:'#282010',border:'#a07030',color:'#f0c060',label:'未決済',   desc:'ユーザーが決済画面に進んだ直後に設定される初期状態。Pay.JP へのチャージ処理が完了しておらず、予約はまだ仮の状態。決済成功 or 失敗／放棄で次のステータスへ遷移する。' },
                  { bg:'#102818',border:'#40a860',color:'#80e8a0',label:'決済済み', desc:'Pay.JP チャージ API が正常完了した際に設定。予約が正式に確定し、ユーザー・店舗それぞれに確認メールが自動送信される。通常の予約サイクルにおける「確定」状態。' },
                  { bg:'#102028',border:'#3080b0',color:'#70c0e0',label:'返金済み', desc:'期限内のキャンセル申請が承認され、Pay.JP 返金 API の処理が正常に完了した際に設定。ユーザーへの返金が確定した終端状態。' },
                  { bg:'#281018',border:'#a03050',color:'#e08080',label:'キャンセル',desc:'①決済を3回失敗した場合、②予約を途中放棄した場合、③期限外キャンセル（返金なし）の場合に設定。いずれも予約が無効になる終端状態。' },
                ].map(({ bg,border,color,label,desc },i) => (
                  <tr key={label} style={{ borderBottom:'1px solid rgba(255,255,255,.04)', background: i%2===1 ? 'rgba(255,255,255,.02)' : 'transparent' }}>
                    <td style={slTd}><span style={{ ...slBadge, background:bg, borderColor:border, color }}>{label}</span></td>
                    <td style={{ ...slTd, color:'#9090a8' }}>{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <div style={{ fontSize:12, fontWeight:700, color:'#888898', marginBottom:10, paddingBottom:4, borderBottom:'1px solid #2e2e38' }}>ステータス遷移（reservation.決済ステータス）</div>
            <div style={{ display:'flex', alignItems:'flex-start', gap:16, flexWrap:'wrap', marginBottom:4 }}>
              <StNode bg="#282010" border="#a07030" color="#f0c060" label="未決済" sub="予約直後"/>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4, marginTop:2 }}>
                <div style={{ color:'#5a6a5a', fontSize:10 }}>Pay.JP決済成功</div><div style={{ color:'#555568', fontSize:13 }}>→</div>
              </div>
              <StNode bg="#102818" border="#40a860" color="#80e8a0" label="決済済み" sub="予約確定"/>
              <div style={{ display:'flex', flexDirection:'column', gap:10, margin:'0 4px' }}>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                  <div style={{ color:'#5a6a5a', fontSize:10 }}>返金申請承認</div><div style={{ color:'#555568', fontSize:13 }}>→</div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, marginTop:14 }}>
                  <div style={{ color:'#8a4a4a', fontSize:10 }}>返金なしキャンセル</div><div style={{ color:'#555568', fontSize:13 }}>→</div>
                </div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                <StNode bg="#102028" border="#3080b0" color="#70c0e0" label="返金済み" sub="Pay.JP返金完了"/>
                <StNode bg="#281018" border="#a03050" color="#e08080" label="キャンセル" sub="返金なし確定"/>
              </div>
            </div>
            <div style={{ display:'flex', alignItems:'flex-start', gap:16, flexWrap:'wrap', marginTop:8 }}>
              <StNode bg="#282010" border="#a07030" color="#f0c060" label="未決済"/>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, margin:'0 4px' }}>
                <div style={{ color:'#8a4a4a', fontSize:10 }}>決済失敗3回 / 放棄</div><div style={{ color:'#555568', fontSize:13 }}>→</div>
              </div>
              <StNode bg="#281018" border="#a03050" color="#e08080" label="キャンセル"/>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tab: 予約 ── */}
      <div style={{ display: activeTab === 'yoyaku' ? 'flex' : 'none', flex:1, flexDirection:'column', minHeight:0, overflow:'hidden' }}>
        <div style={{ height:28, display:'flex', alignItems:'center', gap:8, padding:'0 14px', flexShrink:0, background:'#182818', borderBottom:'1px solid #303040', borderTop:'2px solid #308050' }}>
          <span style={{ fontSize:12, fontWeight:700, color:'#60b878' }}>📅 予約フロー（詳細）</span>
          <div style={{ width:1, height:18, background:'#38383f' }} />
          <button onClick={() => { d4.render(); d4.fitView() }} style={{ padding:'3px 10px', border:'1px solid #444450', borderRadius:4, background:'#38383f', color:'#a0a0b8', fontSize:11, cursor:'pointer' }}>全体表示</button>
        </div>
        <div ref={d4WrapRef} style={{ flex:'1.4', overflow:'hidden', cursor:'grab', background:'#1a1a1f', minHeight:0 }}>
          <svg style={{ width:'100%', height:'100%' }}>
            <defs>
              <marker id="m4"  markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#7a8a9a"/></marker>
              <marker id="m4x" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#3090b0"/></marker>
              <marker id="m4n" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#a07030"/></marker>
            </defs>
            <g ref={d4VpRef} />
          </svg>
        </div>
        <div style={{ height:28, display:'flex', alignItems:'center', gap:8, padding:'0 14px', flexShrink:0, background:'#181828', borderBottom:'1px solid #303040', borderTop:'2px solid #304880' }}>
          <span style={{ fontSize:12, fontWeight:700, color:'#6088c0' }}>📊 予約ステータス</span>
        </div>
        <div style={{ flex:'0 0 auto', maxHeight:280, overflowY:'auto', padding:'14px 18px' }}>
          <div style={{ marginBottom:28 }}>
            <div style={{ fontSize:12, fontWeight:700, color:'#888898', marginBottom:10, paddingBottom:4, borderBottom:'1px solid #2e2e38' }}>ステータス一覧</div>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead><tr><th style={slTh}>ステータス名</th><th style={slTh}>詳細</th></tr></thead>
              <tbody>
                {[
                  { bg:'#202028',border:'#6060a0',color:'#a0a0e0',label:'仮情報',         desc:'ユーザーがカートに自転車を追加し決済画面に進んだ際に作成される仮の予約レコード。決済が完了していないため、在庫には影響しない。' },
                  { bg:'#102818',border:'#40a860',color:'#80e8a0',label:'来客待ち',        desc:'決済が完了し予約が正式確定した状態。ユーザーの来店と貸出開始を待っている。キャンセル申請が来た場合は期限の有無で次のステータスが分岐する。' },
                  { bg:'#102030',border:'#3090c0',color:'#70c8e8',label:'貸出中',          desc:'店舗スタッフがユーザーの来店を確認し貸出開始操作を行った際に設定される。自転車がユーザーの手元にある利用中の状態。' },
                  { bg:'#183020',border:'#50a870',color:'#90d8a8',label:'返却済み',        desc:'店舗スタッフが返却を確認し返却完了操作を行った際に設定される。予約サイクルの正常完了を示す終端状態。売上レポートの集計対象となる。' },
                  { bg:'#281018',border:'#a03050',color:'#e08080',label:'キャンセル',      desc:'①決済失敗による予約中断、②キャンセル期限内にユーザーが申請し返金処理が完了した場合に設定。' },
                  { bg:'#302010',border:'#904020',color:'#d07840',label:'キャンセル（返金なし）',desc:'キャンセル期限を過ぎた申請、またはノーショー（予約当日に来店なし）の場合に設定。Pay.JP への返金処理は行われない。' },
                ].map(({ bg,border,color,label,desc },i) => (
                  <tr key={label} style={{ borderBottom:'1px solid rgba(255,255,255,.04)', background: i%2===1 ? 'rgba(255,255,255,.02)' : 'transparent' }}>
                    <td style={slTd}><span style={{ ...slBadge, background:bg, borderColor:border, color }}>{label}</span></td>
                    <td style={{ ...slTd, color:'#9090a8' }}>{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <div style={{ fontSize:12, fontWeight:700, color:'#888898', marginBottom:10, paddingBottom:4, borderBottom:'1px solid #2e2e38' }}>ステータス遷移（reservation.予約ステータス）</div>
            {[
              { nodes: [
                  {bg:'#202028',border:'#6060a0',color:'#a0a0e0',label:'仮情報',      sub:'カート投入直後'},
                  {bg:'#102818',border:'#40a860',color:'#80e8a0',label:'来客待ち',    sub:'予約確定・貸出前'},
                  {bg:'#102030',border:'#3090c0',color:'#70c8e8',label:'貸出中',      sub:'利用中'},
                  {bg:'#183020',border:'#50a870',color:'#90d8a8',label:'返却済み',    sub:'完了'},
                ], arrows: ['決済完了','貸出開始','返却確認']
              },
              { nodes: [
                  {bg:'#102818',border:'#40a860',color:'#80e8a0',label:'来客待ち',    sub:''},
                  {bg:'#281018',border:'#a03050',color:'#e08080',label:'キャンセル',  sub:'返金あり'},
                ], arrows: ['キャンセル（期限内）'], mt: 10
              },
              { nodes: [
                  {bg:'#102818',border:'#40a860',color:'#80e8a0',label:'来客待ち',    sub:''},
                  {bg:'#302010',border:'#904020',color:'#d07840',label:'キャンセル（返金なし）',sub:'返金なし'},
                ], arrows: ['期限外・ノーショー'], arrowColor:'#8a4a4a', mt: 6
              },
              { nodes: [
                  {bg:'#202028',border:'#6060a0',color:'#a0a0e0',label:'仮情報',      sub:''},
                  {bg:'#281018',border:'#a03050',color:'#e08080',label:'キャンセル',  sub:''},
                ], arrows: ['決済失敗'], arrowColor:'#8a4a4a', mt: 6
              },
            ].map((row, ri) => (
              <div key={ri} style={{ display:'flex', alignItems:'flex-start', gap:16, flexWrap:'wrap', marginTop: ri===0 ? 0 : (row as {mt?:number}).mt ?? 0 }}>
                {row.nodes.map((n, ni) => (
                  <React.Fragment key={n.label+ni}>
                    {ni > 0 && (
                      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, margin:'0 4px' }}>
                        <div style={{ color:(row as {arrowColor?:string}).arrowColor ?? '#5a6a5a', fontSize:10 }}>{row.arrows[ni-1]}</div>
                        <div style={{ color:'#555568', fontSize:13 }}>→</div>
                      </div>
                    )}
                    <StNode bg={n.bg} border={n.border} color={n.color} label={n.label} sub={n.sub}/>
                  </React.Fragment>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────
function StNode({ bg, border, color, label, sub }: { bg:string; border:string; color:string; label:string; sub?:string }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
      <div style={{ padding:'5px 14px', borderRadius:6, fontSize:12, fontWeight:700, border:`1.5px solid ${border}`, background:bg, color, whiteSpace:'nowrap' }}>{label}</div>
      {sub && <div style={{ fontSize:10, color:'#6a7a6a', marginTop:-2, textAlign:'center' }}>{sub}</div>}
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const slTh: React.CSSProperties = {
  background:'#1e1e28', color:'#7878a0', fontSize:11, fontWeight:700,
  padding:'6px 10px', textAlign:'left', borderBottom:'1px solid #2e2e3a', whiteSpace:'nowrap',
}
const slTd: React.CSSProperties = { padding:'7px 10px', verticalAlign:'middle', lineHeight:1.5 }
const slBadge: React.CSSProperties = {
  display:'inline-block', padding:'3px 10px', borderRadius:4, fontSize:11, fontWeight:700,
  border:'1.5px solid', whiteSpace:'nowrap',
}
