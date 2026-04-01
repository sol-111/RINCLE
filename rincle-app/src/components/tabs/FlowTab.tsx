'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── TYPES ────────────────────────────────────────────────────────────────────
const TYPES: Record<string, { fill: string; stroke: string; tc: string }> = {
  bubble:   { fill:'#1a3a28', stroke:'#34a853', tc:'#a0e8b8' },
  popup:    { fill:'#3a3010', stroke:'#c8a030', tc:'#ffe066' },
  external: { fill:'#1a2a4a', stroke:'#4a90d9', tc:'#90b8f8' },
  custom1:  { fill:'#3a1a2a', stroke:'#c040a0', tc:'#f090d0' },
  custom2:  { fill:'#1a1a3a', stroke:'#7060e0', tc:'#b0a0f8' },
}
const PALETTE = [
  null,'#111111','#555566','#3d2868','#2d3d5a','#2d4a8a','#1a3d28','#4a3a18','#4a1a1a',
  '#ffffff','#aaaaaa','#777788','#8040d0','#2060c0','#4a90d9','#34a853','#d4b000','#e03020',
]

type NodeObj    = { id:string;x:number;y:number;w:number;h:number;type:string;lines:string[];fill?:string|null;fillOpacity?:number;stroke?:string|null;dashed?:boolean }
type EdgeObj    = { id:string;from:string;fromSide:string;to:string;toSide:string;label:string;dashed:boolean;offset?:number|null }
type FrameObj   = { id:string;x:number;y:number;w:number;h:number;label:string;fillHex?:string;fillOpacity?:number;stroke:string;labelColor:string;dashed:boolean }
type SelObj     = { type:'node'|'edge'|'frame'; id:string } | null
type MultiSel   = { type:'node'|'frame'; id:string }
type CommentDef = { id:string; svgX:number; svgY:number; svgW:number; svgH:number; text:string }

// ─── INIT DATA ────────────────────────────────────────────────────────────────
const INIT_NODES: NodeObj[] = [
  // ── メインフロー ──────────────────────────────────────────────────────────
  {id:'top',        x:60,   y:80,  w:120, h:52, type:'bubble',   lines:['TOP']},
  {id:'search',     x:210,  y:80,  w:120, h:52, type:'bubble',   lines:['空車検索']},
  {id:'results',    x:390,  y:175, w:120, h:52, type:'bubble',   lines:['検索','一覧']},
  {id:'shop_dtl',   x:540,  y:175, w:120, h:52, type:'bubble',   lines:['店舗','詳細']},
  {id:'bicycle',    x:690,  y:175, w:120, h:52, type:'bubble',   lines:['自転車','詳細']},
  {id:'cart1',      x:840,  y:175, w:120, h:52, type:'bubble',   lines:['予約内容','(空車検索)']},
  {id:'cart2',      x:1020, y:175, w:120, h:52, type:'bubble',   lines:['予約内容','(顧客情報入力)']},
  {id:'cart3',      x:1210, y:175, w:120, h:52, type:'bubble',   lines:['予約内容','(予約内容確認)']},
  {id:'cart4',      x:1390, y:175, w:120, h:52, type:'bubble',   lines:['予約内容','(決済)']},
  {id:'resv',       x:1555, y:175, w:120, h:52, type:'bubble',   lines:['予約','一覧']},
  {id:'card',       x:1390, y:65,  w:120, h:52, type:'popup',    lines:['カード情報','入力']},
  {id:'payjp',      x:1550, y:65,  w:100, h:52, type:'external', lines:['Pay.JP']},
  // ── 左側コンテンツ ────────────────────────────────────────────────────────
  {id:'news_top',   x:210,  y:330, w:120, h:52, type:'bubble',   lines:['新着情報','一覧']},
  {id:'news_dtl',   x:380,  y:330, w:120, h:52, type:'bubble',   lines:['新着情報','詳細']},
  {id:'topics_top', x:210,  y:420, w:120, h:52, type:'bubble',   lines:['お知らせ','一覧']},
  {id:'topics_dtl', x:380,  y:420, w:120, h:52, type:'bubble',   lines:['お知らせ','詳細']},
  {id:'faq_main',   x:210,  y:510, w:120, h:52, type:'bubble',   lines:['FAQ','一覧']},
  // ── ヘッダー/フッター ─────────────────────────────────────────────────────
  {id:'login',      x:560,  y:395, w:120, h:52, type:'bubble',   lines:['ログイン']},
  {id:'signup',     x:560,  y:485, w:120, h:52, type:'bubble',   lines:['新規会員','登録']},
  {id:'hdr_faq',    x:710,  y:395, w:120, h:52, type:'bubble',   lines:['FAQ','一覧']},
  {id:'contact',    x:710,  y:485, w:120, h:52, type:'bubble',   lines:['お問い合わせ']},
  {id:'terms',      x:710,  y:590, w:120, h:52, type:'bubble',   lines:['規約等']},
  {id:'company',    x:710,  y:680, w:120, h:52, type:'external', lines:['会社概要']},
  {id:'mypage',     x:880,  y:395, w:120, h:52, type:'bubble',   lines:['マイページ']},
  {id:'edit',       x:1040, y:395, w:120, h:52, type:'bubble',   lines:['アカウント','詳細/編集']},
  {id:'user_resv',  x:1040, y:485, w:120, h:52, type:'bubble',   lines:['予約','一覧']},
]
const INIT_EDGES: EdgeObj[] = [
  // メインフロー
  {id:'e1',  from:'top',       fromSide:'r', to:'search',     toSide:'l', label:'', dashed:false},
  {id:'e2',  from:'search',    fromSide:'r', to:'results',    toSide:'l', label:'', dashed:false},
  {id:'e3',  from:'results',   fromSide:'r', to:'shop_dtl',   toSide:'l', label:'', dashed:false},
  {id:'e4',  from:'shop_dtl',  fromSide:'r', to:'bicycle',    toSide:'l', label:'', dashed:false},
  {id:'e5',  from:'bicycle',   fromSide:'r', to:'cart1',      toSide:'l', label:'', dashed:false},
  {id:'e6',  from:'cart1',     fromSide:'r', to:'cart2',      toSide:'l', label:'', dashed:false},
  {id:'e7',  from:'cart2',     fromSide:'r', to:'cart3',      toSide:'l', label:'', dashed:false},
  {id:'e8',  from:'cart3',     fromSide:'r', to:'cart4',      toSide:'l', label:'', dashed:false},
  {id:'e9',  from:'cart4',     fromSide:'r', to:'resv',       toSide:'l', label:'', dashed:false},
  {id:'e10', from:'cart4',     fromSide:'t', to:'card',       toSide:'b', label:'', dashed:false},
  {id:'e10b',from:'card',      fromSide:'r', to:'payjp',      toSide:'l', label:'', dashed:false},
  // 検索系の戻り矢印
  {id:'eb1', from:'results',   fromSide:'t', to:'search',     toSide:'t', label:'', dashed:true},
  {id:'eb2', from:'shop_dtl',  fromSide:'t', to:'search',     toSide:'t', label:'', dashed:true},
  {id:'eb3', from:'bicycle',   fromSide:'t', to:'search',     toSide:'t', label:'', dashed:true},
  // TOPから左側コンテンツ
  {id:'ed1', from:'top',       fromSide:'b', to:'news_top',   toSide:'l', label:'', dashed:false},
  {id:'ed2', from:'top',       fromSide:'b', to:'topics_top', toSide:'l', label:'', dashed:false},
  {id:'ed3', from:'top',       fromSide:'b', to:'faq_main',   toSide:'l', label:'', dashed:false},
  // コンテンツ詳細
  {id:'e11', from:'news_top',  fromSide:'r', to:'news_dtl',   toSide:'l', label:'', dashed:false},
  {id:'e12', from:'topics_top',fromSide:'r', to:'topics_dtl', toSide:'l', label:'', dashed:false},
  // ヘッダー/フッター
  {id:'e13', from:'login',     fromSide:'b', to:'signup',     toSide:'t', label:'', dashed:false},
  {id:'e14', from:'signup',    fromSide:'t', to:'login',      toSide:'b', label:'', dashed:false},
  {id:'e15', from:'mypage',    fromSide:'r', to:'edit',       toSide:'l', label:'', dashed:false},
  {id:'e16', from:'mypage',    fromSide:'r', to:'user_resv',  toSide:'l', label:'', dashed:false},
]
const INIT_FRAMES: FrameObj[] = [
  {id:'f1', x:30,  y:30,  w:1720, h:790, label:'利用者',             fillHex:'#1e50b4', fillOpacity:0.07, stroke:'#2a3a5a', labelColor:'#4a6a9a', dashed:false},
  {id:'f2', x:470, y:355, w:750,  h:430, label:'ヘッダー / フッター', fillHex:'#c8a030', fillOpacity:0.12, stroke:'#a08020', labelColor:'#705800', dashed:false},
]

// ─── PURE HELPERS ─────────────────────────────────────────────────────────────
function hexToRgba(hex:string|null|undefined, opacity:number):string {
  if(!hex) return 'none'
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16)
  return `rgba(${r},${g},${b},${opacity})`
}
function getContrastColor(hex:string):string {
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16)
  return (0.299*r+0.587*g+0.114*b)>140?'#1a1a1a':'#e8e8f0'
}
function esc(s:string):string { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }
function resizeHandlesHtml(item:{id:string;x:number;y:number;w:number;h:number}, type:string, vscale:number):string {
  const sc=1/vscale, hs=8*sc
  const handles=[
    {edge:'nw',cx:item.x,          cy:item.y,          cur:'nw-resize'},
    {edge:'n', cx:item.x+item.w/2, cy:item.y,          cur:'n-resize'},
    {edge:'ne',cx:item.x+item.w,   cy:item.y,          cur:'ne-resize'},
    {edge:'e', cx:item.x+item.w,   cy:item.y+item.h/2, cur:'e-resize'},
    {edge:'se',cx:item.x+item.w,   cy:item.y+item.h,   cur:'se-resize'},
    {edge:'s', cx:item.x+item.w/2, cy:item.y+item.h,   cur:'s-resize'},
    {edge:'sw',cx:item.x,          cy:item.y+item.h,   cur:'sw-resize'},
    {edge:'w', cx:item.x,          cy:item.y+item.h/2, cur:'w-resize'},
  ]
  return handles.map(h=>
    `<rect class="ft-rh" data-id="${item.id}" data-type="${type}" data-edge="${h.edge}"
     x="${h.cx-hs/2}" y="${h.cy-hs/2}" width="${hs}" height="${hs}" rx="${1.5*sc}"
     fill="#5a8abf" stroke="#fff" stroke-width="${0.75*sc}" style="cursor:${h.cur}" pointer-events="all"/>`
  ).join('')
}
function nodePt(n:NodeObj,side:string):[number,number] {
  const cx=n.x+n.w/2,cy=n.y+n.h/2
  return ({r:[n.x+n.w,cy],l:[n.x,cy],t:[cx,n.y],b:[cx,n.y+n.h]} as Record<string,[number,number]>)[side]
}
const ROUTE_GAP=40
function buildPath(e:EdgeObj,nodes:NodeObj[]):string {
  const fn=nodes.find(n=>n.id===e.from),tn=nodes.find(n=>n.id===e.to)
  if(!fn||!tn) return ''
  const [fx,fy]=nodePt(fn,e.fromSide),[tx,ty]=nodePt(tn,e.toSide)
  const fs=e.fromSide,ts=e.toSide,off=e.offset??null
  if((fs==='r'&&ts==='l')||(fs==='l'&&ts==='r')){
    const fwd=fs==='r'?tx>fx:tx<fx
    const midX=off??(fwd?(fx+tx)/2:(fs==='r'?Math.max(fx,tx)+ROUTE_GAP:Math.min(fx,tx)-ROUTE_GAP))
    if(!off&&Math.abs(fy-ty)<1) return `M ${fx} ${fy} H ${tx}`
    return `M ${fx} ${fy} H ${midX} V ${ty} H ${tx}`
  }
  if((fs==='t'&&ts==='b')||(fs==='b'&&ts==='t')){
    const fwd=fs==='b'?ty>fy:ty<fy
    const midY=off??(fwd?(fy+ty)/2:(fs==='b'?Math.max(fy,ty)+ROUTE_GAP:Math.min(fy,ty)-ROUTE_GAP))
    if(!off&&Math.abs(fx-tx)<1) return `M ${fx} ${fy} V ${ty}`
    return `M ${fx} ${fy} V ${midY} H ${tx} V ${ty}`
  }
  if(fs==='r'&&ts==='r'){const o=off??Math.max(fx,tx)+ROUTE_GAP;return `M ${fx} ${fy} H ${o} V ${ty} H ${tx}`}
  if(fs==='l'&&ts==='l'){const o=off??Math.min(fx,tx)-ROUTE_GAP;return `M ${fx} ${fy} H ${o} V ${ty} H ${tx}`}
  if(fs==='b'&&ts==='b'){const o=off??Math.max(fy,ty)+ROUTE_GAP;return `M ${fx} ${fy} V ${o} H ${tx} V ${ty}`}
  if(fs==='t'&&ts==='t'){const o=off??Math.min(fy,ty)-ROUTE_GAP;return `M ${fx} ${fy} V ${o} H ${tx} V ${ty}`}
  if((fs==='r'||fs==='l')&&(ts==='t'||ts==='b')) return `M ${fx} ${fy} H ${tx} V ${ty}`
  if((fs==='t'||fs==='b')&&(ts==='r'||ts==='l')) return `M ${fx} ${fy} V ${ty} H ${tx}`
  return `M ${fx} ${fy} L ${tx} ${ty}`
}
function getEdgeHandles(e:EdgeObj,nodes:NodeObj[]):{x:number;y:number;axis:'x'|'y';cursor:string}[] {
  const fn=nodes.find(n=>n.id===e.from),tn=nodes.find(n=>n.id===e.to)
  if(!fn||!tn) return []
  const [fx,fy]=nodePt(fn,e.fromSide),[tx,ty]=nodePt(tn,e.toSide)
  const fs=e.fromSide,ts=e.toSide,off=e.offset??null
  if((fs==='r'&&ts==='l')||(fs==='l'&&ts==='r')){
    const fwd=fs==='r'?tx>fx:tx<fx
    const midX=off??(fwd?(fx+tx)/2:(fs==='r'?Math.max(fx,tx)+ROUTE_GAP:Math.min(fx,tx)-ROUTE_GAP))
    return [{x:midX,y:(fy+ty)/2,axis:'x',cursor:'ew-resize'}]
  }
  if((fs==='t'&&ts==='b')||(fs==='b'&&ts==='t')){
    const fwd=fs==='b'?ty>fy:ty<fy
    const midY=off??(fwd?(fy+ty)/2:(fs==='b'?Math.max(fy,ty)+ROUTE_GAP:Math.min(fy,ty)-ROUTE_GAP))
    return [{x:(fx+tx)/2,y:midY,axis:'y',cursor:'ns-resize'}]
  }
  if(fs==='r'&&ts==='r'){const o=off??Math.max(fx,tx)+ROUTE_GAP;return [{x:o,y:(fy+ty)/2,axis:'x',cursor:'ew-resize'}]}
  if(fs==='l'&&ts==='l'){const o=off??Math.min(fx,tx)-ROUTE_GAP;return [{x:o,y:(fy+ty)/2,axis:'x',cursor:'ew-resize'}]}
  if(fs==='b'&&ts==='b'){const o=off??Math.max(fy,ty)+ROUTE_GAP;return [{x:(fx+tx)/2,y:o,axis:'y',cursor:'ns-resize'}]}
  if(fs==='t'&&ts==='t'){const o=off??Math.min(fy,ty)-ROUTE_GAP;return [{x:(fx+tx)/2,y:o,axis:'y',cursor:'ns-resize'}]}
  return []
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
#ft-tb{background:#2a2a2f;padding:6px 12px;display:flex;align-items:center;gap:8px;border-bottom:1px solid #38383f;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,.4)}
#ft-tb h1{font-size:14px;font-weight:700;color:#d0d0d8;white-space:nowrap;margin:0 4px 0 0}
.ft-sep{width:1px;height:18px;background:#38383f;flex-shrink:0}
.ft-btn{padding:4px 10px;border:1px solid #444450;border-radius:4px;background:#38383f;color:#a0a0b8;font-size:11px;cursor:pointer;white-space:nowrap;user-select:none}
.ft-btn:hover{background:#484855;color:#d0d0d8}
.ft-btn.active{background:#3a5a8a;border-color:#5a8abf;color:#b0d0f8}
#ft-hint{font-size:10px;color:#666678;margin-left:auto;white-space:nowrap}
#ft-panel{width:220px;flex-shrink:0;background:#23232a;border-left:1px solid #38383f;display:flex;flex-direction:column;overflow-y:auto;z-index:10}
#ft-panel-empty{padding:18px 12px;font-size:11px;color:#555568;line-height:1.5}
#ft-panel-inner{padding:12px;display:flex;flex-direction:column;gap:10px}
.ft-ps{display:flex;flex-direction:column;gap:6px}
.ft-pl{font-size:10px;color:#888898;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
textarea.ft-ta{width:100%;background:#2a2a33;border:1px solid #444450;border-radius:3px;color:#c0c0cc;padding:4px 6px;font-size:11px;resize:vertical;min-height:54px;font-family:inherit}
input.ft-ti{flex:1;background:#2a2a33;border:1px solid #444450;border-radius:3px;color:#c0c0cc;padding:3px 5px;font-size:11px;width:100%}
.ft-swrow{display:flex;gap:5px;flex-wrap:wrap}
.ft-sw{width:32px;height:22px;border-radius:4px;border:2px solid transparent;cursor:pointer;transition:border-color .15s}
.ft-sw.sel{border-color:#fff!important}
.ft-del{width:100%;padding:5px;border:1px solid #8a2020;border-radius:4px;background:#3a1010;color:#f08080;font-size:11px;cursor:pointer}
.ft-del:hover{background:#5a1515}
.ft-cbrow{display:flex;align-items:center;gap:6px;font-size:11px;color:#a0a0b8}
.ft-cbrow input{cursor:pointer}
.ft-segrow{display:flex}
.ft-seg{flex:1;padding:4px 0;font-size:11px;color:#888898;background:#2a2a33;border:1px solid #444450;cursor:pointer}
.ft-seg:first-child{border-radius:3px 0 0 3px}
.ft-seg:last-child{border-radius:0 3px 3px 0;border-left:none}
.ft-seg.active{background:#3a5a8a;border-color:#5a8abf;color:#b0d0f8}
#ft-cp{position:fixed;z-index:10000;background:#2a2a33;border:1px solid #444458;border-radius:8px;padding:12px;box-shadow:0 6px 24px rgba(0,0,0,.8);display:none;width:260px}
#ft-cp-grid{display:grid;grid-template-columns:repeat(9,24px);gap:4px;margin-bottom:10px}
.ft-cpsw{width:24px;height:24px;border-radius:50%;cursor:pointer;border:2px solid transparent;flex-shrink:0}
.ft-cpsw:hover{transform:scale(1.2)}
.ft-cpsw.csel{border-color:#fff}
.ft-cpsw.cnone{border-color:#666;display:flex;align-items:center;justify-content:center;font-size:13px;color:#666;line-height:1}
#ft-cp-oprow{display:flex;align-items:center;gap:6px;margin-top:2px}
#ft-cp-oplbl{font-size:10px;color:#888898;width:44px;flex-shrink:0}
#ft-cp-op{flex:1;accent-color:#5a8abf}
#ft-cp-opval{font-size:10px;color:#888898;width:32px;text-align:right}
.ft-cpbtn{display:flex;align-items:center;gap:5px;padding:4px 8px;border:1px solid #444450;border-radius:4px;background:#2a2a33;cursor:pointer;font-size:11px;color:#a0a0b8;flex:1}
.ft-cpbtn:hover{background:#38384a}
.ft-cpdot{width:16px;height:16px;border-radius:3px;border:1px solid rgba(255,255,255,.25);flex-shrink:0}
.ft-cprow{display:flex;gap:6px}
#ft-ctx{position:fixed;background:#2a2a33;border:1px solid #444458;border-radius:5px;padding:4px 0;z-index:9999;min-width:120px;display:none;box-shadow:0 4px 14px rgba(0,0,0,.6)}
#ft-ctx div{padding:6px 14px;font-size:12px;cursor:pointer;color:#c0c0cc}
#ft-ctx div:hover{background:#38384a}
`

export default function FlowTab() {
  const [saveStatus, setSaveStatus] = useState<'idle'|'saving'|'saved'>('idle')
  const setSaveStatusRef = useRef(setSaveStatus)
  useEffect(() => { setSaveStatusRef.current = setSaveStatus }, [setSaveStatus])

  // ─── COMMENT STATE ────────────────────────────────────────────────────────
  const cmtRef         = useRef<SVGGElement>(null)
  const selRef         = useRef<HTMLDivElement>(null)
  const commentModeRef = useRef(false)
  const [commentMode, setCommentMode]   = useState(false)
  const [comments, setComments]         = useState<CommentDef[]>([])
  const [pendingCmt, setPendingCmt]     = useState<{svgX:number;svgY:number;svgW:number;svgH:number;screenX:number;screenY:number}|null>(null)
  const [cmtInput, setCmtInput]         = useState('')

  function toggleCommentMode() {
    const next = !commentModeRef.current
    commentModeRef.current = next
    setCommentMode(next)
  }

  async function confirmComment() {
    if (!pendingCmt || !cmtInput.trim()) { setPendingCmt(null); return }
    const supabase = createClient()
    const { data:{ user } } = await supabase.auth.getUser()
    if (!user) { setPendingCmt(null); return }
    const { data, error } = await supabase.from('flow_comments').insert({
      user_id: user.id,
      svg_x: pendingCmt.svgX, svg_y: pendingCmt.svgY,
      svg_w: pendingCmt.svgW, svg_h: pendingCmt.svgH,
      text: cmtInput.trim(),
    }).select().single()
    if (error || !data) { setPendingCmt(null); return }
    setComments(prev => [...prev, { id:data.id, svgX:data.svg_x, svgY:data.svg_y, svgW:data.svg_w, svgH:data.svg_h, text:data.text }])
    setPendingCmt(null); setCmtInput('')
  }

  async function deleteComment(id: string) {
    const supabase = createClient()
    await supabase.from('flow_comments').delete().eq('id', id)
    setComments(prev => prev.filter(c => c.id !== id))
  }

  // Cursor sync
  useEffect(() => {
    if (wrapRef.current) wrapRef.current.style.cursor = commentMode ? 'crosshair' : 'default'
  }, [commentMode])

  const wrapRef    = useRef<HTMLDivElement>(null)
  const vpRef      = useRef<SVGGElement>(null)
  const pemptyRef  = useRef<HTMLDivElement>(null)
  const pinnerRef  = useRef<HTMLDivElement>(null)
  const cpRef      = useRef<HTMLDivElement>(null)
  const cpGridRef  = useRef<HTMLDivElement>(null)
  const cpOpRowRef = useRef<HTMLDivElement>(null)
  const cpOpRef    = useRef<HTMLInputElement>(null)
  const cpOpValRef = useRef<HTMLSpanElement>(null)
  const ctxRef     = useRef<HTMLDivElement>(null)
  const hintRef    = useRef<HTMLSpanElement>(null)
  const btnSelRef  = useRef<HTMLButtonElement>(null)
  const btnNdRef   = useRef<HTMLButtonElement>(null)
  const btnFrRef   = useRef<HTMLButtonElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fns        = useRef<Record<string,(...a:any[])=>void>>({})

  useEffect(() => {
    const s = {
      nodes:[] as NodeObj[], edges:[] as EdgeObj[], frames:[] as FrameObj[],
      nextId:200, selected:null as SelObj, tool:'select',
      vx:0, vy:0, vscale:1,
      drag:null as unknown, conn:null as unknown, fdraw:null as unknown,
      multi:[] as MultiSel[], rband:null as unknown,
      hist:[] as string[], clip:null as unknown,
      cp:{hex:null as string|null,opacity:1,showOpacity:true,cb:null as unknown},
    }

    const wrap=wrapRef.current!, vp=vpRef.current!
    const pempty=pemptyRef.current!, pinner=pinnerRef.current!
    const cpEl=cpRef.current!, cpGrid=cpGridRef.current!
    const cpOpRow=cpOpRowRef.current!, cpOp=cpOpRef.current!, cpOpVal=cpOpValRef.current!
    const ctx=ctxRef.current!, hint=hintRef.current!
    const btnSel=btnSelRef.current!, btnNd=btnNdRef.current!, btnFr=btnFrRef.current!

    let snapGuides: {type:'x'|'y'; pos:number}[] = []
    const SNAP_THRESH = 5
    function computeSnapGuides(item:{x:number;y:number;w:number;h:number}, excludeIds:Set<string>) {
      const guides: {type:'x'|'y'; pos:number}[] = []
      const others=[...s.nodes.filter(n=>!excludeIds.has(n.id)),...s.frames.filter(f=>!excludeIds.has(f.id))]
      const ix=[item.x, item.x+item.w/2, item.x+item.w]
      const iy=[item.y, item.y+item.h/2, item.y+item.h]
      others.forEach(o=>{
        [o.x,o.x+o.w/2,o.x+o.w].forEach(ox=>ix.forEach(iv=>{if(Math.abs(iv-ox)<SNAP_THRESH&&!guides.some(g=>g.type==='x'&&Math.abs(g.pos-ox)<1))guides.push({type:'x',pos:ox})}))
        ;[o.y,o.y+o.h/2,o.y+o.h].forEach(oy=>iy.forEach(iv=>{if(Math.abs(iv-oy)<SNAP_THRESH&&!guides.some(g=>g.type==='y'&&Math.abs(g.pos-oy)<1))guides.push({type:'y',pos:oy})}))
      })
      return guides
    }

    const getNode=(id:string)=>s.nodes.find(n=>n.id===id)
    const getEdge=(id:string)=>s.edges.find(e=>e.id===id)
    const getFrame=(id:string)=>s.frames.find(f=>f.id===id)
    const genId=(p:string)=>p+(s.nextId++)
    const svgPt=(cx:number,cy:number):[number,number]=>{
      const r=wrap.getBoundingClientRect()
      return [(cx-r.left-s.vx)/s.vscale,(cy-r.top-s.vy)/s.vscale]
    }

    // ─── AUTO-SAVE TO DB ──────────────────────────────────────────────────
    let saveTimer: ReturnType<typeof setTimeout> | null = null
    async function saveToDb(){
      setSaveStatusRef.current('saving')
      try {
        const supabase = createClient()
        const { data:{ user } } = await supabase.auth.getUser()
        if (!user) { setSaveStatusRef.current('idle'); return }
        await supabase.from('flow_diagrams').upsert({
          user_id: user.id,
          nodes: s.nodes,
          edges: s.edges,
          frames: s.frames,
          next_id: s.nextId,
          vx: s.vx, vy: s.vy, vscale: s.vscale,
        }, { onConflict: 'user_id' })
        setSaveStatusRef.current('saved')
        setTimeout(() => setSaveStatusRef.current('idle'), 2000)
      } catch {
        setSaveStatusRef.current('idle')
      }
    }
    function scheduleSave(){
      if (saveTimer) clearTimeout(saveTimer)
      saveTimer = setTimeout(saveToDb, 1500)
    }

    function pushHist(){
      s.hist.push(JSON.stringify({nodes:s.nodes,edges:s.edges,frames:s.frames,nextId:s.nextId}))
      if(s.hist.length>50) s.hist.shift()
      scheduleSave()
    }
    function undo(){
      if(!s.hist.length) return
      const snap=JSON.parse(s.hist.pop()!)
      s.nodes=snap.nodes;s.edges=snap.edges;s.frames=snap.frames;s.nextId=snap.nextId
      s.selected=null; updatePanel(); render(); showHint('元に戻しました')
      scheduleSave()
    }

    function showHint(msg:string,ms=1500){
      const prev=hint.textContent; hint.textContent=msg
      setTimeout(()=>hint.textContent=prev,ms)
    }

    // ─── COLOR PICKER ─────────────────────────────────────────────────────
    type CpCb=(hex:string|null,op:number)=>void
    function renderCp(){
      cpGrid.innerHTML=PALETTE.map(c=>{
        if(c===null) return `<div class="ft-cpsw cnone${s.cp.hex===null?' csel':''}" data-cpick="null">⊘</div>`
        return `<div class="ft-cpsw${c===s.cp.hex?' csel':''}" style="background:${c}" data-cpick="${c}"></div>`
      }).join('')
      const pct=Math.round(s.cp.opacity*100)
      cpOp.value=String(pct); cpOpVal.textContent=pct+'%'
    }
    function cpPick(hex:string|null){
      s.cp.hex=hex; renderCp()
      if(s.cp.cb)(s.cp.cb as CpCb)(s.cp.hex,s.cp.opacity)
    }
    function showCp(anchor:HTMLElement,hex:string|null,op:number,showOp:boolean,cb:CpCb){
      s.cp={hex,opacity:op,showOpacity:showOp,cb}; renderCp()
      cpEl.style.display='block'
      const panelEl=document.getElementById('ft-panel')!
      const pr=panelEl.getBoundingClientRect(), ar=anchor.getBoundingClientRect()
      cpEl.style.left=(pr.left-268)+'px'
      cpEl.style.top=Math.min(ar.top,window.innerHeight-220)+'px'
      cpOpRow.style.display=showOp?'flex':'none'
    }
    cpGrid.addEventListener('click',e=>{
      const el=(e.target as HTMLElement).closest('[data-cpick]') as HTMLElement|null
      if(el) cpPick(el.dataset.cpick==='null'?null:el.dataset.cpick!)
    })
    cpOp.addEventListener('input',()=>{
      s.cp.opacity=Number(cpOp.value)/100; cpOpVal.textContent=cpOp.value+'%'
      if(s.cp.cb)(s.cp.cb as CpCb)(s.cp.hex,s.cp.opacity)
    })

    // ─── SAVE/LOAD ────────────────────────────────────────────────────────
    function loadInitial(){
      s.nodes=INIT_NODES.map(n=>({...n,lines:[...n.lines]}))
      s.edges=INIT_EDGES.map(e=>({...e}))
      s.frames=INIT_FRAMES.map(f=>({...f}))
      s.nextId=200
    }
    function saveState(){
      localStorage.setItem('flow-editor-state',JSON.stringify({nodes:s.nodes,edges:s.edges,frames:s.frames,nextId:s.nextId,vx:s.vx,vy:s.vy,vscale:s.vscale}))
      showHint('保存しました')
    }
    function loadState(){
      try{
        const d=JSON.parse(localStorage.getItem('flow-editor-state')||'null')
        if(!d) return false
        s.nodes=d.nodes;s.edges=d.edges;s.frames=d.frames;s.nextId=d.nextId||200
        s.vx=d.vx||0;s.vy=d.vy||0;s.vscale=d.vscale||1; return true
      }catch{return false}
    }
    function exportJSON(){
      const b=new Blob([JSON.stringify({nodes:s.nodes,edges:s.edges,frames:s.frames},null,2)],{type:'application/json'})
      const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download='flow.json'; a.click()
    }

    // ─── CLIPBOARD ────────────────────────────────────────────────────────
    function copySelected(){
      if(!s.selected) return
      const {type,id}=s.selected
      const item=type==='node'?getNode(id):type==='frame'?getFrame(id):null
      if(item) s.clip={type,data:JSON.parse(JSON.stringify(item))}
    }
    function pasteClipboard(){
      if(!s.clip) return; pushHist()
      const cl=s.clip as {type:string;data:NodeObj&FrameObj}
      if(cl.type==='node'){
        const nn={...cl.data,id:genId('n'),x:cl.data.x+24,y:cl.data.y+24,lines:[...cl.data.lines]}
        s.nodes.push(nn); select('node',nn.id)
      } else if(cl.type==='frame'){
        const nf={...cl.data,id:genId('f'),x:cl.data.x+24,y:cl.data.y+24}
        s.frames.push(nf); select('frame',nf.id)
      }
      render()
    }

    // ─── TOOL ─────────────────────────────────────────────────────────────
    function setTool(t:string){
      s.tool=t; s.conn=null; s.fdraw=null
      btnSel.classList.toggle('active',t==='select')
      btnNd.classList.toggle('active',t==='node')
      btnFr.classList.toggle('active',t==='frame')
      wrap.style.cursor=t==='select'?'default':'crosshair'
      render()
    }

    // ─── TRANSFORM ────────────────────────────────────────────────────────
    function applyTransform(){
      const t=`translate(${s.vx},${s.vy}) scale(${s.vscale})`
      vp.setAttribute('transform',t)
      if(cmtRef.current) cmtRef.current.setAttribute('transform',t)
    }
    function fitView(){
      const pw=wrap.clientWidth,ph=wrap.clientHeight
      s.vscale=Math.min(pw/1800,ph/960)*0.92
      s.vx=(pw-1800*s.vscale)/2; s.vy=(ph-960*s.vscale)/2
      applyTransform()
    }

    // ─── RENDER ───────────────────────────────────────────────────────────
    function render(){
      let h=''
      // Frames
      s.frames.forEach(f=>{
        const isSel=s.selected?.type==='frame'&&s.selected.id===f.id
        const isMS=s.multi.some(m=>m.type==='frame'&&m.id===f.id)
        const da=f.dashed?' stroke-dasharray="4,3"':''
        const ss=(isSel||isMS)?' stroke="#5a8abf" stroke-width="2.5"':` stroke="${f.stroke}" stroke-width="1"`
        const ff=f.fillHex?hexToRgba(f.fillHex,f.fillOpacity??0.1):'rgba(0,0,0,0.05)'
        h+=`<g class="frame-el" data-id="${f.id}">`
        h+=`<rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" rx="12" fill="${ff}"${ss}${da}/>`
        h+=`<text x="${f.x+18}" y="${f.y+18}" fill="${f.labelColor}" font-size="13" font-weight="700" font-family="'Hiragino Sans',sans-serif">${esc(f.label)}</text>`
        if(isSel) h+=resizeHandlesHtml(f,'frame',s.vscale)
        h+=`</g>`
      })
      // Edges
      s.edges.forEach(e=>{
        const isSel=s.selected?.type==='edge'&&s.selected.id===e.id
        const d=buildPath(e,s.nodes); if(!d) return
        const da=e.dashed?' stroke-dasharray="5,3"':''
        const sc=isSel?'#5a8abf':'#5a6a7a', mk=isSel?'ft-arr-sel':'ft-arr', sw=isSel?'2.5':'1.5'
        h+=`<path class="edge-hit" data-id="${e.id}" d="${d}" fill="none" stroke="transparent" stroke-width="10"/>`
        h+=`<path class="edge-el" data-id="${e.id}" d="${d}" fill="none" stroke="${sc}" stroke-width="${sw}"${da} marker-end="url(#${mk})"/>`
        const fn2=getNode(e.from),tn2=getNode(e.to)
        if(fn2&&tn2&&e.label){
          const [ex2,ey2]=nodePt(fn2,e.fromSide),[tx2,ty2]=nodePt(tn2,e.toSide)
          h+=`<text x="${(ex2+tx2)/2}" y="${(ey2+ty2)/2-4}" text-anchor="middle" fill="#4a5a6a" font-size="9" font-family="monospace">${esc(e.label)}</text>`
        }
      })
      // Nodes
      s.nodes.forEach(n=>{
        const t=TYPES[n.type]||TYPES.bubble, cx=n.x+n.w/2
        const isSel=s.selected?.type==='node'&&s.selected.id===n.id
        const isMS=s.multi.some(m=>m.type==='node'&&m.id===n.id)
        const fc=n.fill?hexToRgba(n.fill,n.fillOpacity??1):t.fill
        const sc=n.stroke||t.stroke, tc=n.fill?getContrastColor(n.fill):t.tc
        const nd=n.dashed?' stroke-dasharray="5,3"':''
        const sa=(isSel||isMS)?` stroke="#5a8abf" stroke-width="2.5"${nd}`:` stroke="${sc}" stroke-width="1.5"${nd}`
        let labels=''
        if(n.lines.length===1){
          labels=`<text x="${cx}" y="${n.y+n.h/2+4}" text-anchor="middle" fill="${tc}" font-size="11" pointer-events="none">${esc(n.lines[0])}</text>`
        } else {
          n.lines.forEach((l,i)=>{
            const dy=n.y+n.h/2+(i-(n.lines.length-1)/2)*15+4
            labels+=`<text x="${cx}" y="${dy}" text-anchor="middle" fill="${tc}" font-size="11" pointer-events="none">${esc(l)}</text>`
          })
        }
        h+=`<g class="node-el" data-id="${n.id}" style="cursor:move">`
        h+=`<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="8" fill="${fc}"${sa}/>`
        h+=labels
        if(isSel) h+=resizeHandlesHtml(n,'node',s.vscale)
        h+=`</g>`
        const isHT=s.conn&&(s.conn as {hoverNodeId?:string;fromId:string}).hoverNodeId===n.id&&n.id!==(s.conn as {fromId:string}).fromId
        if(isSel||isHT){
          ;['t','b','l','r'].forEach(side=>{
            const [px,py]=nodePt(n,side)
            const snap=isHT&&(s.conn as {snapSide?:string}).snapSide===side
            h+=`<circle class="port-dot" data-node="${n.id}" data-side="${side}" cx="${px}" cy="${py}" r="${snap?8:6}" fill="${snap?'#80c0ff':'#5a8abf'}" stroke="#fff" stroke-width="1.5" style="cursor:crosshair" opacity="0.9"/>`
          })
        }
      })
      // Edge handles (last = above nodes)
      if(s.selected?.type==='edge'){
        const se=getEdge(s.selected.id)
        if(se){
          const sc2=1/s.vscale
          const efn=getNode(se.from),etn=getNode(se.to)
          if(efn&&etn){
            const [efx,efy]=nodePt(efn,se.fromSide),[etx,ety]=nodePt(etn,se.toSide)
            h+=`<circle cx="${efx}" cy="${efy}" r="${6*sc2}" fill="#5a8abf" stroke="#fff" stroke-width="${2*sc2}" style="pointer-events:none"/>`
            h+=`<circle cx="${etx}" cy="${ety}" r="${6*sc2}" fill="#5a8abf" stroke="#fff" stroke-width="${2*sc2}" style="pointer-events:none"/>`
          }
          getEdgeHandles(se,s.nodes).forEach(hdl=>{
            const isX=hdl.axis==='x'
            const vW=isX?10*sc2:28*sc2,vH=isX?28*sc2:10*sc2
            const hW=isX?20*sc2:40*sc2,hH=isX?40*sc2:20*sc2
            const sw=Math.max(0.5,1.5*sc2)
            h+=`<rect class="edge-handle" data-edge="${se.id}" data-axis="${hdl.axis}" x="${hdl.x-hW/2}" y="${hdl.y-hH/2}" width="${hW}" height="${hH}" rx="${3*sc2}" fill="rgba(0,0,0,0.001)" pointer-events="all" style="cursor:${hdl.cursor}"/>`
            h+=`<rect pointer-events="none" x="${hdl.x-vW/2}" y="${hdl.y-vH/2}" width="${vW}" height="${vH}" rx="${4*sc2}" fill="#5a8abf" stroke="#fff" stroke-width="${sw}"/>`
          })
        }
      }
      // Connect preview
      const co=s.conn as {x2?:number;y2?:number;x1:number;y1:number;hoverNodeId?:string;snapSide?:string}|null
      if(co?.x2!=null){
        let ex=co.x2!,ey=co.y2!
        if(co.hoverNodeId&&co.snapSide){const hn=getNode(co.hoverNodeId);if(hn)[ex,ey]=nodePt(hn,co.snapSide)}
        h+=`<line x1="${co.x1}" y1="${co.y1}" x2="${ex}" y2="${ey}" stroke="#5a8abf" stroke-width="1.5" stroke-dasharray="5,3"/>`
      }
      // Frame draw preview
      const fd=s.fdraw as {sx:number;sy:number;ex?:number;ey?:number}|null
      if(fd?.ex!=null){
        const fx=Math.min(fd.sx,fd.ex!),fy=Math.min(fd.sy,fd.ey!)
        h+=`<rect x="${fx}" y="${fy}" width="${Math.abs(fd.ex!-fd.sx)}" height="${Math.abs(fd.ey!-fd.sy)}" rx="8" fill="rgba(30,80,180,0.07)" stroke="#5a8abf" stroke-width="1.5" stroke-dasharray="5,3"/>`
      }
      // Rubber band
      const rb=s.rband as {sx:number;sy:number;ex?:number;ey?:number}|null
      if(rb?.ex!=null){
        const bx=Math.min(rb.sx,rb.ex!),by=Math.min(rb.sy,rb.ey!)
        const bsw=1/s.vscale
        h+=`<rect x="${bx}" y="${by}" width="${Math.abs(rb.ex!-rb.sx)}" height="${Math.abs(rb.ey!-rb.sy)}" fill="rgba(90,138,191,0.12)" stroke="#5a8abf" stroke-width="${bsw}" stroke-dasharray="${4/s.vscale},${2/s.vscale}"/>`
      }
      // Snap guides
      snapGuides.forEach(g=>{
        const sw=1/s.vscale,da=`${6/s.vscale},${3/s.vscale}`
        if(g.type==='x') h+=`<line x1="${g.pos}" y1="-9999" x2="${g.pos}" y2="9999" stroke="#5a8abf" stroke-width="${sw}" stroke-dasharray="${da}" opacity="0.75" pointer-events="none"/>`
        else             h+=`<line x1="-9999" y1="${g.pos}" x2="9999" y2="${g.pos}" stroke="#5a8abf" stroke-width="${sw}" stroke-dasharray="${da}" opacity="0.75" pointer-events="none"/>`
      })
      vp.innerHTML=h; applyTransform()
    }

    // ─── PANEL ────────────────────────────────────────────────────────────
    function updatePanel(){
      if(!s.selected){
        pempty.style.display=''; pinner.style.display='none'
        pempty.innerHTML=s.multi.length>1
          ?`${s.multi.length} 個選択中<br><small style="color:#666">Deleteで削除</small>`
          :'要素を選択すると<br>プロパティが表示されます'
        return
      }
      pempty.style.display='none'; pinner.style.display='flex'
      let h=''
      if(s.selected.type==='node'){
        const n=getNode(s.selected.id)!
        h+=`<div class="ft-ps"><div class="ft-pl">タイプ</div><div class="ft-swrow">`
        Object.entries(TYPES).forEach(([k,v])=>{
          h+=`<div class="ft-sw${n.type===k?' sel':''}" title="${k}" data-stype="${k}" style="background:${v.fill};border-color:${v.stroke}"></div>`
        })
        h+=`</div></div>`
        const nf=n.fill||(TYPES[n.type]||TYPES.bubble).fill
        const ns=n.stroke||(TYPES[n.type]||TYPES.bubble).stroke
        h+=`<div class="ft-ps"><div class="ft-pl">カラー</div><div class="ft-cprow">
          <button class="ft-cpbtn" id="ft-nbtnf"><div class="ft-cpdot" style="background:${nf}"></div>背景色</button>
          <button class="ft-cpbtn" id="ft-nbtns"><div class="ft-cpdot" style="background:${ns}"></div>枠色</button>
        </div></div>`
        h+=`<div class="ft-ps"><div class="ft-pl">線の種類</div><div class="ft-segrow">
          <button class="ft-seg${!n.dashed?' active':''}" data-ndash="solid">実線</button>
          <button class="ft-seg${n.dashed?' active':''}" data-ndash="dashed">点線</button>
        </div></div>`
        h+=`<div class="ft-ps"><div class="ft-pl">ラベル（改行区切り）</div><textarea class="ft-ta" id="ft-nlbl">${esc(n.lines.join('\n'))}</textarea></div>`
        h+=`<button class="ft-del" data-del="1">削除</button>`
      } else if(s.selected.type==='edge'){
        const e=getEdge(s.selected.id)!
        h+=`<div class="ft-ps"><div class="ft-pl">ラベル</div><input class="ft-ti" id="ft-elbl" value="${esc(e.label)}"></div>`
        h+=`<div class="ft-ps"><div class="ft-cbrow"><input type="checkbox" id="ft-edash"${e.dashed?' checked':''}><label for="ft-edash">点線</label></div></div>`
        if(e.offset!=null) h+=`<button class="ft-seg" id="ft-ereset" style="border-radius:3px">ルートをリセット</button>`
        h+=`<button class="ft-del" data-del="1">削除</button>`
      } else if(s.selected.type==='frame'){
        const f=getFrame(s.selected.id)!
        h+=`<div class="ft-ps"><div class="ft-pl">ラベル</div><input class="ft-ti" id="ft-flbl" value="${esc(f.label)}"></div>`
        const ff2=f.fillHex||'#1e50b4'
        h+=`<div class="ft-ps"><div class="ft-pl">カラー</div><div class="ft-cprow">
          <button class="ft-cpbtn" id="ft-fbtnf"><div class="ft-cpdot" style="background:${hexToRgba(ff2,f.fillOpacity??0.1)}"></div>背景色</button>
          <button class="ft-cpbtn" id="ft-fbtns"><div class="ft-cpdot" style="background:${f.stroke}"></div>枠色</button>
          <button class="ft-cpbtn" id="ft-fbtnl"><div class="ft-cpdot" style="background:${f.labelColor}"></div>文字</button>
        </div></div>`
        h+=`<div class="ft-ps"><div class="ft-pl">線の種類</div><div class="ft-segrow">
          <button class="ft-seg${!f.dashed?' active':''}" data-fdash="solid">実線</button>
          <button class="ft-seg${f.dashed?' active':''}" data-fdash="dashed">点線</button>
        </div></div>`
        h+=`<button class="ft-del" data-del="1">削除</button>`
      }
      pinner.innerHTML=h
      const byId=(id:string)=>document.getElementById(id)
      if(s.selected.type==='node'){
        const n=getNode(s.selected.id)!
        const ta=byId('ft-nlbl') as HTMLTextAreaElement|null
        if(ta){ta.onfocus=pushHist;ta.oninput=()=>{n.lines=ta.value.split('\n');render();scheduleSave()}}
        pinner.querySelectorAll('[data-stype]').forEach(el=>{
          (el as HTMLElement).onclick=()=>{pushHist();n.type=(el as HTMLElement).dataset.stype!;updatePanel();render()}
        })
        pinner.querySelectorAll('[data-ndash]').forEach(el=>{
          (el as HTMLElement).onclick=()=>{pushHist();n.dashed=(el as HTMLElement).dataset.ndash==='dashed';updatePanel();render()}
        })
        const nbf=byId('ft-nbtnf'),nbs=byId('ft-nbtns')
        if(nbf)(nbf as HTMLElement).onclick=()=>showCp(nbf as HTMLElement,n.fill??null,n.fillOpacity??1,true,(hex,op)=>{pushHist();n.fill=hex;n.fillOpacity=op;updatePanel();render()})
        if(nbs)(nbs as HTMLElement).onclick=()=>showCp(nbs as HTMLElement,n.stroke??null,1,false,(hex)=>{pushHist();n.stroke=hex;updatePanel();render()})
      } else if(s.selected.type==='edge'){
        const e=getEdge(s.selected.id)!
        const li=byId('ft-elbl') as HTMLInputElement|null,dc=byId('ft-edash') as HTMLInputElement|null,rb=byId('ft-ereset')
        if(li){li.onfocus=pushHist;li.oninput=()=>{e.label=li.value;render();scheduleSave()}}
        if(dc) dc.onchange=()=>{pushHist();e.dashed=dc.checked;render()}
        if(rb) rb.onclick=()=>{pushHist();e.offset=null;updatePanel();render()}
      } else if(s.selected.type==='frame'){
        const f=getFrame(s.selected.id)!
        const li=byId('ft-flbl') as HTMLInputElement|null
        if(li){li.onfocus=pushHist;li.oninput=()=>{f.label=li.value;render();scheduleSave()}}
        pinner.querySelectorAll('[data-fdash]').forEach(el=>{
          (el as HTMLElement).onclick=()=>{pushHist();f.dashed=(el as HTMLElement).dataset.fdash==='dashed';updatePanel();render()}
        })
        const fbf=byId('ft-fbtnf'),fbs=byId('ft-fbtns'),fbl=byId('ft-fbtnl')
        if(fbf)(fbf as HTMLElement).onclick=()=>showCp(fbf as HTMLElement,f.fillHex||'#1e50b4',f.fillOpacity??0.1,true,(hex,op)=>{pushHist();f.fillHex=hex??undefined;f.fillOpacity=op;updatePanel();render()})
        if(fbs)(fbs as HTMLElement).onclick=()=>showCp(fbs as HTMLElement,f.stroke,1,false,(hex)=>{pushHist();if(hex)f.stroke=hex;updatePanel();render()})
        if(fbl)(fbl as HTMLElement).onclick=()=>showCp(fbl as HTMLElement,f.labelColor,1,false,(hex)=>{pushHist();if(hex)f.labelColor=hex;updatePanel();render()})
      }
      pinner.querySelector('[data-del]')?.addEventListener('click',deleteSelected)
    }

    function select(type:'node'|'edge'|'frame',id:string|null){
      s.selected=id?{type,id}:null
      if(id) s.multi=[]
      updatePanel(); render()
    }
    function deleteSelected(){
      if(!s.selected&&!s.multi.length) return
      pushHist()
      if(s.multi.length>0){
        const nids=new Set(s.multi.filter(m=>m.type==='node').map(m=>m.id))
        const fids=new Set(s.multi.filter(m=>m.type==='frame').map(m=>m.id))
        // collect nodes and sub-frames inside deleted frames
        s.frames.filter(f=>fids.has(f.id)).forEach(df=>{
          s.nodes.filter(n=>n.x>=df.x&&n.y>=df.y&&n.x+n.w<=df.x+df.w&&n.y+n.h<=df.y+df.h).forEach(n=>nids.add(n.id))
          s.frames.filter(f=>!fids.has(f.id)&&f.x>=df.x&&f.y>=df.y&&f.x+f.w<=df.x+df.w&&f.y+f.h<=df.y+df.h).forEach(f=>fids.add(f.id))
        })
        s.nodes=s.nodes.filter(n=>!nids.has(n.id))
        s.edges=s.edges.filter(e=>!nids.has(e.from)&&!nids.has(e.to))
        s.frames=s.frames.filter(f=>!fids.has(f.id))
        s.multi=[]
      } else if(s.selected){
        const {type,id}=s.selected
        if(type==='node'){s.nodes=s.nodes.filter(n=>n.id!==id);s.edges=s.edges.filter(e=>e.from!==id&&e.to!==id)}
        else if(type==='edge') s.edges=s.edges.filter(e=>e.id!==id)
        else {
          const delF=getFrame(id)
          if(delF){
            const inside=(item:{x:number;y:number;w:number;h:number})=>item.x>=delF.x&&item.y>=delF.y&&item.x+item.w<=delF.x+delF.w&&item.y+item.h<=delF.y+delF.h
            const delNids=new Set(s.nodes.filter(inside).map(n=>n.id))
            s.nodes=s.nodes.filter(n=>!delNids.has(n.id))
            s.edges=s.edges.filter(e=>!delNids.has(e.from)&&!delNids.has(e.to))
            s.frames=s.frames.filter(f=>f.id!==id&&!inside(f))
          } else {
            s.frames=s.frames.filter(f=>f.id!==id)
          }
        }
      }
      s.selected=null; updatePanel(); render()
    }

    // ─── CTX MENU ─────────────────────────────────────────────────────────
    const showCtx=(e:MouseEvent)=>{ctx.style.left=e.clientX+'px';ctx.style.top=e.clientY+'px';ctx.style.display='block'}
    const hideCtx=()=>ctx.style.display='none'
    function ctxDup(){
      hideCtx(); if(!s.selected) return; pushHist()
      if(s.selected.type==='node'){const n=getNode(s.selected.id)!;const nn={...n,id:genId('n'),x:n.x+20,y:n.y+20,lines:[...n.lines]};s.nodes.push(nn);select('node',nn.id)}
      else if(s.selected.type==='frame'){const f=getFrame(s.selected.id)!;const nf={...f,id:genId('f'),x:f.x+20,y:f.y+20};s.frames.push(nf);select('frame',nf.id)}
      render()
    }
    function ctxDel(){hideCtx();deleteSelected()}
    ctx.querySelector('[data-ctx="dup"]')?.addEventListener('click',ctxDup)
    ctx.querySelector('[data-ctx="del"]')?.addEventListener('click',ctxDel)

    // ─── INSIDE FRAME ─────────────────────────────────────────────────────
    const inFrame=(item:{x:number;y:number;w:number;h:number},fr:FrameObj)=>
      item.x>=fr.x&&item.y>=fr.y&&item.x+item.w<=fr.x+fr.w&&item.y+item.h<=fr.y+fr.h

    // ─── EVENTS ───────────────────────────────────────────────────────────
    // Comment selection state (shared across onDown/onMove/onUp)
    let cmtSel: {startX:number;startY:number;curX:number;curY:number}|null = null

    function onWheel(e:WheelEvent){
      e.preventDefault()
      if(e.ctrlKey){
        const f=e.deltaY<0?1.12:0.88,r=wrap.getBoundingClientRect()
        const mx=e.clientX-r.left,my=e.clientY-r.top
        s.vx=mx-(mx-s.vx)*f; s.vy=my-(my-s.vy)*f; s.vscale*=f
      } else {s.vx-=e.deltaX; s.vy-=e.deltaY}
      applyTransform()
    }

    function onDbl(e:MouseEvent){
      const eh=(e.target as HTMLElement).closest('.edge-handle')
      if(eh){const de=getEdge((eh as HTMLElement).dataset.edge!);if(de){pushHist();de.offset=null;render();return}}
      const ne=(e.target as HTMLElement).closest('.node-el')
      if(ne){select('node',(ne as HTMLElement).dataset.id!);setTimeout(()=>document.getElementById('ft-nlbl')?.focus(),50)}
    }

    function onDown(e:MouseEvent){
      if(e.button!==0) return; hideCtx()
      if((e.target as Element).closest?.('[data-cmt-del]')) return
      if(commentModeRef.current){
        e.preventDefault()
        const r=wrap.getBoundingClientRect(), ovl=selRef.current
        cmtSel={startX:e.clientX,startY:e.clientY,curX:e.clientX,curY:e.clientY}
        if(ovl){ovl.style.display='block';ovl.style.left=`${e.clientX-r.left}px`;ovl.style.top=`${e.clientY-r.top}px`;ovl.style.width='0';ovl.style.height='0'}
        return
      }
      const rh=(e.target as HTMLElement).closest('.ft-rh')
      if(rh){
        e.stopPropagation()
        const id=(rh as HTMLElement).dataset.id!,type=(rh as HTMLElement).dataset.type as 'node'|'frame',edge=(rh as HTMLElement).dataset.edge!
        const item=type==='node'?getNode(id):getFrame(id)
        if(item){pushHist();s.drag={mode:'resize',type,id,edge,origX:item.x,origY:item.y,origW:item.w,origH:item.h,sx:e.clientX,sy:e.clientY}}
        return
      }
      const pd=(e.target as HTMLElement).closest('.port-dot')
      if(pd&&s.tool==='select'){
        const nid=(pd as HTMLElement).dataset.node!,side=(pd as HTMLElement).dataset.side!
        const n=getNode(nid);if(n){const [px,py]=nodePt(n,side);s.conn={fromId:nid,fromSide:side,x1:px,y1:py}}
        return
      }
      if(s.tool==='frame'){const [sx,sy]=svgPt(e.clientX,e.clientY);s.fdraw={sx,sy};return}

      const ne=(e.target as HTMLElement).closest('.node-el')
      if(ne&&s.tool==='select'){
        const id=(ne as HTMLElement).dataset.id!;let n=getNode(id)!
        const inMN=s.multi.length>1&&s.multi.some(m=>m.type==='node'&&m.id===id)
        if(inMN&&!e.altKey){
          pushHist()
          const no=s.multi.filter(m=>m.type==='node').map(m=>{const mn=getNode(m.id)!;return{id:m.id,ox:mn.x,oy:mn.y}})
          const fo=s.multi.filter(m=>m.type==='frame').map(m=>{const mf=getFrame(m.id)!;return{id:m.id,ox:mf.x,oy:mf.y}})
          s.drag={mode:'drag-multi',sx:e.clientX,sy:e.clientY,nodeOffsets:no,frameOffsets:fo}; return
        }
        if(e.altKey){pushHist();const cl={...n,id:genId('n'),lines:[...n.lines]};s.nodes.push(cl);select('node',cl.id);n=cl}
        else{s.multi=[];select('node',id);pushHist()}
        s.drag={mode:'drag-node',id:n.id,ox:n.x,oy:n.y,sx:e.clientX,sy:e.clientY}; return
      }

      const eh=(e.target as HTMLElement).closest('.edge-handle')
      if(eh&&s.tool==='select'){
        const eid=(eh as HTMLElement).dataset.edge!,axis=(eh as HTMLElement).dataset.axis!
        const ee=getEdge(eid)
        if(ee){
          select('edge',eid); pushHist()
          const [emx,emy]=svgPt(e.clientX,e.clientY)
          const hs=getEdgeHandles(ee,s.nodes)
          const start=hs.length?(axis==='x'?hs[0].x:hs[0].y):(axis==='x'?emx:emy)
          s.drag={mode:'drag-edge-offset',edgeId:eid,axis,startPos:axis==='x'?emx:emy,startOffset:start}
        }
        return
      }

      const eht=(e.target as HTMLElement).closest('.edge-hit')
      if(eht&&s.tool==='select'){select('edge',(eht as HTMLElement).dataset.id!);return}

      const fe=(e.target as HTMLElement).closest('.frame-el')
      if(fe&&s.tool==='select'){
        const id=(fe as HTMLElement).dataset.id!;let f=getFrame(id)!
        const inMF=s.multi.length>1&&s.multi.some(m=>m.type==='frame'&&m.id===id)
        if(inMF&&!e.altKey){
          pushHist()
          const no=s.multi.filter(m=>m.type==='node').map(m=>{const mn=getNode(m.id)!;return{id:m.id,ox:mn.x,oy:mn.y}})
          const fo=s.multi.filter(m=>m.type==='frame').map(m=>{const mf=getFrame(m.id)!;return{id:m.id,ox:mf.x,oy:mf.y}})
          s.drag={mode:'drag-multi',sx:e.clientX,sy:e.clientY,nodeOffsets:no,frameOffsets:fo}; return
        }
        s.multi=[]; pushHist()
        if(e.altKey){
          const cf={...f,id:genId('f')}; s.frames.push(cf)
          const nim:Record<string,string>={}
          s.nodes.filter(n=>inFrame(n,f)).forEach(n=>{const cn={...n,id:genId('n'),lines:[...n.lines]};nim[n.id]=cn.id;s.nodes.push(cn)})
          const csf:Array<{id:string;ox:number;oy:number}>=[]
          s.frames.filter(fr=>fr.id!==f.id&&fr.id!==cf.id&&inFrame(fr,f)).forEach(fr=>{const c={...fr,id:genId('f')};s.frames.push(c);csf.push({id:c.id,ox:c.x,oy:c.y})})
          const oids=new Set(Object.keys(nim))
          s.edges.filter(eg=>oids.has(eg.from)&&oids.has(eg.to)).forEach(eg=>s.edges.push({...eg,id:genId('e'),from:nim[eg.from],to:nim[eg.to]}))
          select('frame',cf.id)
          const cno=Object.values(nim).map(nid=>{const cn=getNode(nid)!;return{id:nid,ox:cn.x,oy:cn.y}})
          s.drag={mode:'drag-frame',id:cf.id,ox:cf.x,oy:cf.y,sx:e.clientX,sy:e.clientY,containedNodes:cno,containedFrames:csf}; return
        }
        select('frame',id)
        const cno=s.nodes.filter(n=>inFrame(n,f)).map(n=>({id:n.id,ox:n.x,oy:n.y}))
        const cfo=s.frames.filter(fr=>fr.id!==id&&inFrame(fr,f)).map(fr=>({id:fr.id,ox:fr.x,oy:fr.y}))
        s.drag={mode:'drag-frame',id,ox:f.x,oy:f.y,sx:e.clientX,sy:e.clientY,containedNodes:cno,containedFrames:cfo}; return
      }

      if(s.tool==='node'){
        const [cx,cy]=svgPt(e.clientX,e.clientY); pushHist()
        const nn:NodeObj={id:genId('n'),x:cx-60,y:cy-26,w:120,h:52,type:'bubble',lines:['新しい画面']}
        s.nodes.push(nn); select('node',nn.id); setTool('select'); return
      }
      if(s.tool==='select'){
        const [rx,ry]=svgPt(e.clientX,e.clientY)
        s.multi=[]; s.selected=null; s.rband={sx:rx,sy:ry}; updatePanel(); render()
      }
    }

    function onMove(e:MouseEvent){
      if(cmtSel){
        cmtSel.curX=e.clientX; cmtSel.curY=e.clientY
        const r=wrap.getBoundingClientRect(), ovl=selRef.current
        if(ovl){
          const x1=Math.min(cmtSel.startX,cmtSel.curX)-r.left, y1=Math.min(cmtSel.startY,cmtSel.curY)-r.top
          ovl.style.left=`${x1}px`; ovl.style.top=`${y1}px`
          ovl.style.width=`${Math.abs(cmtSel.curX-cmtSel.startX)}px`
          ovl.style.height=`${Math.abs(cmtSel.curY-cmtSel.startY)}px`
        }
        return
      }
      type Drag={mode:string;id?:string;ox?:number;oy?:number;sx:number;sy:number;containedNodes?:{id:string;ox:number;oy:number}[];containedFrames?:{id:string;ox:number;oy:number}[];nodeOffsets?:{id:string;ox:number;oy:number}[];frameOffsets?:{id:string;ox:number;oy:number}[];type?:string;edge?:string;origX?:number;origY?:number;origW?:number;origH?:number;edgeId?:string;axis?:string;startPos?:number;startOffset?:number}
      const dr=s.drag as Drag|null
      if(dr){
        if(dr.mode==='drag-node'){
          const n=getNode(dr.id!)
          if(n){n.x=dr.ox!+(e.clientX-dr.sx)/s.vscale;n.y=dr.oy!+(e.clientY-dr.sy)/s.vscale;snapGuides=computeSnapGuides(n,new Set([n.id]))}; render()
        } else if(dr.mode==='drag-frame'){
          const dx=(e.clientX-dr.sx)/s.vscale,dy=(e.clientY-dr.sy)/s.vscale
          const f=getFrame(dr.id!);if(f){f.x=dr.ox!+dx;f.y=dr.oy!+dy}
          dr.containedNodes!.forEach(c=>{const n=getNode(c.id);if(n){n.x=c.ox+dx;n.y=c.oy+dy}})
          dr.containedFrames!.forEach(c=>{const fr=getFrame(c.id);if(fr){fr.x=c.ox+dx;fr.y=c.oy+dy}})
          if(f){const excl=new Set([f.id,...dr.containedNodes!.map((c:{id:string})=>c.id),...dr.containedFrames!.map((c:{id:string})=>c.id)]);snapGuides=computeSnapGuides(f,excl)}; render()
        } else if(dr.mode==='drag-multi'){
          const dx=(e.clientX-dr.sx)/s.vscale,dy=(e.clientY-dr.sy)/s.vscale
          dr.nodeOffsets!.forEach(({id,ox,oy})=>{const n=getNode(id);if(n){n.x=ox+dx;n.y=oy+dy}})
          dr.frameOffsets!.forEach(({id,ox,oy})=>{const f=getFrame(id);if(f){f.x=ox+dx;f.y=oy+dy}}); render()
        } else if(dr.mode==='drag-edge-offset'){
          const ee=getEdge(dr.edgeId!)
          if(ee){const [emx,emy]=svgPt(e.clientX,e.clientY);const cur=dr.axis==='x'?emx:emy;ee.offset=dr.startOffset!+(cur-dr.startPos!);render()}
        } else if(dr.mode==='resize'){
          const dx=(e.clientX-dr.sx)/s.vscale,dy=(e.clientY-dr.sy)/s.vscale
          const item=dr.type==='node'?getNode(dr.id!):getFrame(dr.id!)
          if(item){
            const minW=dr.type==='node'?40:60, minH=dr.type==='node'?20:40
            const edge=dr.edge!
            if(edge.includes('e')) item.w=Math.max(minW,dr.origW!+dx)
            if(edge.includes('s')) item.h=Math.max(minH,dr.origH!+dy)
            if(edge.includes('w')){const nw=Math.max(minW,dr.origW!-dx);item.x=dr.origX!+(dr.origW!-nw);item.w=nw}
            if(edge.includes('n')){const nh=Math.max(minH,dr.origH!-dy);item.y=dr.origY!+(dr.origH!-nh);item.h=nh}
          };render()
        }
      }
      if(s.conn){
        const [mx,my]=svgPt(e.clientX,e.clientY)
        const co=s.conn as {fromId:string;x2?:number;y2?:number;hoverNodeId?:string;snapSide?:string}
        co.x2=mx;co.y2=my
        const hEl=document.elementFromPoint(e.clientX,e.clientY)
        const pdEl=(hEl as HTMLElement)?.closest('.port-dot')
        const hnEl=(hEl as HTMLElement)?.closest('.node-el')
        if(pdEl&&(pdEl as HTMLElement).dataset.node!==co.fromId){co.hoverNodeId=(pdEl as HTMLElement).dataset.node;co.snapSide=(pdEl as HTMLElement).dataset.side}
        else if(hnEl&&(hnEl as HTMLElement).dataset.id!==co.fromId){co.hoverNodeId=(hnEl as HTMLElement).dataset.id;co.snapSide=undefined}
        else{co.hoverNodeId=undefined;co.snapSide=undefined}
        render()
      }
      if(s.fdraw){const [ex,ey]=svgPt(e.clientX,e.clientY);(s.fdraw as {ex?:number;ey?:number}).ex=ex;(s.fdraw as {ey?:number}).ey=ey;render()}
      if(s.rband){const [rx,ry]=svgPt(e.clientX,e.clientY);(s.rband as {ex?:number;ey?:number}).ex=rx;(s.rband as {ey?:number}).ey=ry;render()}
    }

    function onUp(e:MouseEvent){
      if(cmtSel){
        const sel=cmtSel; cmtSel=null
        const ovl=selRef.current; if(ovl) ovl.style.display='none'
        const dw=Math.abs(sel.curX-sel.startX), dh=Math.abs(sel.curY-sel.startY)
        if(dw>=20&&dh>=20){
          const r=wrap.getBoundingClientRect()
          const sx1=Math.min(sel.startX,sel.curX), sy1=Math.min(sel.startY,sel.curY)
          setPendingCmt({svgX:(sx1-r.left-s.vx)/s.vscale, svgY:(sy1-r.top-s.vy)/s.vscale, svgW:dw/s.vscale, svgH:dh/s.vscale, screenX:sx1, screenY:sy1})
          setCmtInput('')
        }
        return
      }
      if(s.drag){s.drag=null;snapGuides=[];render();scheduleSave()}
      if(s.rband){
        const rb=s.rband as {sx:number;sy:number;ex?:number;ey?:number}
        if(rb.ex!=null&&(Math.abs(rb.ex-rb.sx)>5||Math.abs(rb.ey!-rb.sy)>5)){
          const rx1=Math.min(rb.sx,rb.ex!),ry1=Math.min(rb.sy,rb.ey!)
          const rx2=Math.max(rb.sx,rb.ex!),ry2=Math.max(rb.sy,rb.ey!)
          s.multi=[]
          s.nodes.forEach(n=>{if(n.x>=rx1&&n.y>=ry1&&n.x+n.w<=rx2&&n.y+n.h<=ry2)s.multi.push({type:'node',id:n.id})})
          s.frames.forEach(f=>{if(f.x>=rx1&&f.y>=ry1&&f.x+f.w<=rx2&&f.y+f.h<=ry2)s.multi.push({type:'frame',id:f.id})})
          if(s.multi.length===1){s.selected=s.multi[0];updatePanel()}else{s.selected=null;updatePanel()}
        }
        s.rband=null; render(); return
      }
      if(s.conn){
        const co=s.conn as {fromId:string;fromSide:string;x2?:number;y2?:number;snapSide?:string}
        if(co.x2==null){
          // ドラッグなし（クリックのみ）→ その方向へノードを自動生成
          const fn2=getNode(co.fromId)
          if(fn2){
            const GAP=80
            const opp=({r:'l',l:'r',t:'b',b:'t'} as Record<string,string>)[co.fromSide]
            let nx=fn2.x,ny=fn2.y
            if(co.fromSide==='r') nx=fn2.x+fn2.w+GAP
            else if(co.fromSide==='l') nx=fn2.x-fn2.w-GAP
            else if(co.fromSide==='b') ny=fn2.y+fn2.h+GAP
            else ny=fn2.y-fn2.h-GAP
            pushHist()
            const nn:NodeObj={id:genId('n'),x:nx,y:ny,w:fn2.w,h:fn2.h,type:fn2.type,lines:['新しい画面'],fill:fn2.fill||null,fillOpacity:fn2.fillOpacity,stroke:fn2.stroke||null}
            s.nodes.push(nn)
            s.edges.push({id:genId('e'),from:co.fromId,fromSide:co.fromSide,to:nn.id,toSide:opp,label:'',dashed:false})
            select('node',nn.id)
          }
          s.conn=null; render(); return
        }
        if(co.x2!=null){
          const el=document.elementFromPoint(e.clientX,e.clientY)
          const port=(el as HTMLElement)?.closest('.port-dot')
          if(port&&(port as HTMLElement).dataset.node!==co.fromId){
            pushHist()
            s.edges.push({id:genId('e'),from:co.fromId,fromSide:co.fromSide,to:(port as HTMLElement).dataset.node!,toSide:(port as HTMLElement).dataset.side!,label:'',dashed:false})
            select('edge',s.edges[s.edges.length-1].id)
          } else if(!port){
            const hn=(el as HTMLElement)?.closest('.node-el')
            if(hn&&(hn as HTMLElement).dataset.id!==co.fromId){
              const toId=(hn as HTMLElement).dataset.id!
              let toSide=co.snapSide
              if(!toSide){const tn=getNode(toId)!,[cx,cy]=svgPt(e.clientX,e.clientY);const dx=cx-(tn.x+tn.w/2),dy=cy-(tn.y+tn.h/2);toSide=Math.abs(dx)>Math.abs(dy)?(dx>0?'r':'l'):(dy>0?'b':'t')}
              pushHist()
              s.edges.push({id:genId('e'),from:co.fromId,fromSide:co.fromSide,to:toId,toSide,label:'',dashed:false})
              select('edge',s.edges[s.edges.length-1].id)
            } else if(!hn&&!(el as HTMLElement)?.closest('.frame-el')){
              const fn2=getNode(co.fromId)!,[cx,cy]=svgPt(e.clientX,e.clientY)
              const opp=({r:'l',l:'r',t:'b',b:'t'} as Record<string,string>)[co.fromSide]
              let nx=0,ny=0
              if(co.fromSide==='r'){nx=cx;ny=cy-fn2.h/2}
              else if(co.fromSide==='l'){nx=cx-fn2.w;ny=cy-fn2.h/2}
              else if(co.fromSide==='t'){nx=cx-fn2.w/2;ny=cy-fn2.h}
              else{nx=cx-fn2.w/2;ny=cy}
              pushHist()
              const nn:NodeObj={id:genId('n'),x:nx,y:ny,w:fn2.w,h:fn2.h,type:fn2.type,lines:['新しい画面'],fill:fn2.fill||null,fillOpacity:fn2.fillOpacity,stroke:fn2.stroke||null}
              s.nodes.push(nn)
              s.edges.push({id:genId('e'),from:co.fromId,fromSide:co.fromSide,to:nn.id,toSide:opp,label:'',dashed:false})
              select('node',nn.id)
            }
          }
        }
        s.conn=null; render()
      }
      if(s.fdraw){
        const fd=s.fdraw as {sx:number;sy:number;ex?:number;ey?:number}
        if(fd.ex!=null){
          const fx=Math.min(fd.sx,fd.ex!),fy=Math.min(fd.sy,fd.ey!)
          const fw=Math.abs(fd.ex!-fd.sx),fh=Math.abs(fd.ey!-fd.sy)
          if(fw>20&&fh>20){
            pushHist()
            const nf:FrameObj={id:genId('f'),x:fx,y:fy,w:fw,h:fh,label:'新しいフレーム',fillHex:'#1e50b4',fillOpacity:0.07,stroke:'#2a3a5a',labelColor:'#4a6a9a',dashed:false}
            s.frames.push(nf); select('frame',nf.id)
          }
        }
        s.fdraw=null; setTool('select'); render()
      }
    }

    function onCtx(e:MouseEvent){
      e.preventDefault()
      const tgt=(e.target as HTMLElement).closest('[data-id]')
      if(tgt){
        const id=(tgt as HTMLElement).dataset.id!
        if((tgt as HTMLElement).classList.contains('node-el')||(tgt as HTMLElement).closest('.node-el')){select('node',id);showCtx(e)}
        else if((tgt as HTMLElement).classList.contains('frame-el')||(tgt as HTMLElement).closest('.frame-el')){select('frame',id);showCtx(e)}
      }
    }

    function onKey(e:KeyboardEvent){
      const inInput=['INPUT','TEXTAREA'].includes((e.target as HTMLElement)?.tagName||'')
      if((e.metaKey||e.ctrlKey)&&e.key==='z'){if(inInput)return;e.preventDefault();undo();return}
      if((e.metaKey||e.ctrlKey)&&e.key==='c'){if(inInput)return;e.preventDefault();copySelected();return}
      if((e.metaKey||e.ctrlKey)&&e.key==='v'){if(inInput)return;e.preventDefault();pasteClipboard();return}
      if(inInput) return
      if(e.key==='Delete'||e.key==='Backspace') deleteSelected()
      if(e.key==='Escape'){s.conn=null;s.fdraw=null;s.rband=null;s.multi=[];select('node',null);setTool('select');commentModeRef.current=false;setCommentMode(false);render()}
    }

    function onDocClick(e:MouseEvent){
      if(!(e.target as HTMLElement).closest('#ft-cp')&&!(e.target as HTMLElement).closest('.ft-cpbtn')) cpEl.style.display='none'
      if(!(e.target as HTMLElement).closest('#ft-ctx')) hideCtx()
    }

    // ─── INIT ─────────────────────────────────────────────────────────────
    if(!loadState()) loadInitial()
    render(); fitView()
    // Supabaseからロード（非同期）
    ;(async () => {
      try {
        const supabase = createClient()
        const { data:{ user } } = await supabase.auth.getUser()
        if (!user) return
        const { data } = await supabase.from('flow_diagrams').select('*').eq('user_id', user.id).maybeSingle()
        if (data) {
          s.nodes = data.nodes ?? []
          s.edges = data.edges ?? []
          s.frames = data.frames ?? []
          s.nextId = data.next_id ?? 200
          s.vx = data.vx ?? 0; s.vy = data.vy ?? 0; s.vscale = data.vscale ?? 1
          // 欠損ノード・エッジを補完
          let patched = false
          if (!s.nodes.find((n:NodeObj)=>n.id==='payjp')) {
            const card = s.nodes.find((n:NodeObj)=>n.id==='card')
            s.nodes.push({id:'payjp', x:(card?card.x+card.w+60:1550), y:(card?card.y:65), w:100, h:52, type:'external', lines:['Pay.JP']})
            patched = true
          }
          if (!s.edges.find((e:EdgeObj)=>e.from==='cart4'&&e.to==='card')) {
            s.edges = s.edges.filter((e:EdgeObj)=>!(e.from==='card'&&e.to==='cart4'))
            s.edges.push({id:'e10', from:'cart4', fromSide:'t', to:'card', toSide:'b', label:'', dashed:false})
            patched = true
          }
          if (!s.edges.find((e:EdgeObj)=>e.from==='card'&&e.to==='payjp')) {
            s.edges.push({id:'e10b', from:'card', fromSide:'r', to:'payjp', toSide:'l', label:'', dashed:false})
            patched = true
          }
          s.selected = null; render(); applyTransform()
          if (patched) scheduleSave()
        }
        // Load comments
        const { data:cmtData } = await supabase.from('flow_comments').select('*')
        if (cmtData) {
          setComments(cmtData.map((r:Record<string,unknown>) => ({
            id:r.id as string, svgX:r.svg_x as number, svgY:r.svg_y as number,
            svgW:r.svg_w as number, svgH:r.svg_h as number, text:r.text as string,
          })))
        }
      } catch {}
    })()

    fns.current.setTool=setTool; fns.current.fitView=fitView
    fns.current.saveState=saveState; fns.current.exportJSON=exportJSON

    wrap.addEventListener('wheel',onWheel,{passive:false})
    wrap.addEventListener('mousedown',onDown)
    wrap.addEventListener('contextmenu',onCtx)
    wrap.addEventListener('dblclick',onDbl)
    window.addEventListener('mousemove',onMove)
    window.addEventListener('mouseup',onUp)
    document.addEventListener('keydown',onKey)
    document.addEventListener('click',onDocClick,true)

    return ()=>{
      if(saveTimer) clearTimeout(saveTimer)
      wrap.removeEventListener('wheel',onWheel)
      wrap.removeEventListener('mousedown',onDown)
      wrap.removeEventListener('contextmenu',onCtx)
      wrap.removeEventListener('dblclick',onDbl)
      window.removeEventListener('mousemove',onMove)
      window.removeEventListener('mouseup',onUp)
      document.removeEventListener('keydown',onKey)
      document.removeEventListener('click',onDocClick,true)
    }
  },[])

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',overflow:'hidden',background:'#212124',fontFamily:"'Hiragino Sans','Segoe UI',-apple-system,sans-serif",fontSize:13,color:'#c0c0cc'}}>
      <style dangerouslySetInnerHTML={{__html:CSS}}/>
      {/* Topbar */}
      <div id="ft-tb">
        <h1>📐 Rincle 画面遷移図</h1>
        <div className="ft-sep"/>
        <button ref={btnSelRef} className="ft-btn active" onClick={()=>fns.current.setTool('select')}>選択</button>
        <button ref={btnNdRef}  className="ft-btn"        onClick={()=>fns.current.setTool('node')}>ノード追加</button>
        <button ref={btnFrRef}  className="ft-btn"        onClick={()=>fns.current.setTool('frame')}>フレーム</button>
        <div className="ft-sep"/>
        <button className="ft-btn" onClick={()=>fns.current.fitView()}>全体表示</button>
        <div className="ft-sep"/>
        <button onClick={toggleCommentMode} style={{
          display:'flex',alignItems:'center',gap:5,padding:'4px 10px',
          border:`1.5px solid ${commentMode?'#c8a030':'#444450'}`,
          borderRadius:4,cursor:'pointer',fontSize:11,fontWeight:700,
          background:commentMode?'#3a2c08':'#38383f',
          color:commentMode?'#e8c060':'#a0a0b8',
        }}>💬 コメント{commentMode?' ON':''}</button>
        {saveStatus==='saving'&&<span style={{fontSize:10,color:'#888898',marginLeft:4}}>保存中...</span>}
        {saveStatus==='saved'&&<span style={{fontSize:10,color:'#34a853',marginLeft:4}}>保存済み</span>}
        <span ref={hintRef} id="ft-hint">ホイールでズーム / ドラッグでパン / Delで削除</span>
      </div>
      {/* Main */}
      <div style={{display:'flex',flex:1,overflow:'hidden'}}>
        <div ref={wrapRef} style={{flex:1,overflow:'hidden',background:'#1a1a1f',position:'relative',cursor:'default'}}>
          <svg style={{width:'100%',height:'100%'}}>
            <defs>
              <marker id="ft-arr"     markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#7a8a9a"/></marker>
              <marker id="ft-arr-sel" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#5a8abf"/></marker>
            </defs>
            <g ref={vpRef}/>
            <g ref={cmtRef}>{comments.map(c=><CommentBox key={c.id} c={c} onDelete={deleteComment}/>)}</g>
          </svg>
          <div ref={selRef} style={{position:'absolute',pointerEvents:'none',display:'none',border:'2px dashed #c8a030',background:'rgba(200,160,48,0.07)',borderRadius:2,boxSizing:'border-box'}}/>
          {/* Legend */}
          <div style={{position:'absolute',bottom:16,left:16,background:'#2a2a2f',border:'1px solid #38383f',borderRadius:8,padding:'10px 14px',display:'flex',flexDirection:'column',gap:6,boxShadow:'0 4px 12px rgba(0,0,0,.5)',zIndex:100,pointerEvents:'none'}}>
            <div style={{fontSize:11,fontWeight:700,color:'#888898',marginBottom:2}}>凡例</div>
            <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
              {[
                {bg:'#1a3a28',stroke:'#34a853',label:'bubble画面'},
                {bg:'#1a2a4a',stroke:'#4a90d9',label:'外部サービス'},
                {bg:'#3a3010',stroke:'#c8a030',label:'ポップアップ'},
              ].map(({bg,stroke,label})=>(
                <div key={label} style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'#a0a0b8'}}>
                  <div style={{width:22,height:13,borderRadius:3,border:`1.5px solid ${stroke}`,background:bg,flexShrink:0}}/>{label}
                </div>
              ))}
            </div>
            <div style={{display:'flex',alignItems:'center',gap:14}}>
              {[
                {stroke:'#7a8a9a',dash:false,label:'進む処理'},
                {stroke:'#5a6a7a',dash:true, label:'戻る処理'},
              ].map(({stroke,dash,label})=>(
                <div key={label} style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'#a0a0b8'}}>
                  <svg width="28" height="10" viewBox="0 0 28 10">
                    <defs><marker id={`fl-${label}`} markerWidth="5" markerHeight="4" refX="4" refY="2" orient="auto"><polygon points="0 0,5 2,0 4" fill={stroke}/></marker></defs>
                    <line x1="0" y1="5" x2="22" y2="5" stroke={stroke} strokeWidth={dash?1.2:1.5} strokeDasharray={dash?'4,3':undefined} markerEnd={`url(#fl-${label})`}/>
                  </svg>{label}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div id="ft-panel">
          <div ref={pemptyRef} id="ft-panel-empty">要素を選択すると<br/>プロパティが表示されます</div>
          <div ref={pinnerRef} id="ft-panel-inner" style={{display:'none'}}/>
        </div>
      </div>
      {/* Color picker */}
      <div ref={cpRef} id="ft-cp">
        <div ref={cpGridRef} id="ft-cp-grid"/>
        <div ref={cpOpRowRef} id="ft-cp-oprow">
          <span id="ft-cp-oplbl">不透明度</span>
          <input type="range" ref={cpOpRef} id="ft-cp-op" min="0" max="100" defaultValue="100"/>
          <span ref={cpOpValRef} id="ft-cp-opval">100%</span>
        </div>
      </div>
      {/* Context menu */}
      <div ref={ctxRef} id="ft-ctx">
        <div data-ctx="dup">複製</div>
        <div data-ctx="del">削除</div>
      </div>
      {/* Comment input popover */}
      {pendingCmt && (
        <div style={{
          position:'fixed',
          left:Math.min(pendingCmt.screenX,(typeof window!=='undefined'?window.innerWidth:1200)-240),
          top:Math.min(pendingCmt.screenY,(typeof window!=='undefined'?window.innerHeight:800)-170),
          zIndex:2000,background:'#2a2810',border:'1.5px solid #c8a030',borderRadius:8,
          padding:'10px 12px',boxShadow:'0 4px 20px rgba(0,0,0,.7)',
          display:'flex',flexDirection:'column',gap:8,minWidth:224,
          fontFamily:"'Hiragino Sans',sans-serif",
        }}>
          <div style={{fontSize:11,fontWeight:700,color:'#c8a030'}}>💬 コメントを入力</div>
          <textarea
            autoFocus
            value={cmtInput}
            onChange={e=>setCmtInput(e.target.value)}
            onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();confirmComment()}if(e.key==='Escape')setPendingCmt(null)}}
            style={{background:'#1e1a08',border:'1px solid #705820',borderRadius:4,color:'#e8d080',fontSize:12,padding:'6px 8px',resize:'none',width:200,height:72,fontFamily:'inherit',outline:'none'}}
            placeholder="Shift+Enterで改行 / Enterで確定"
          />
          <div style={{display:'flex',gap:6,justifyContent:'flex-end'}}>
            <button onClick={()=>setPendingCmt(null)} style={{padding:'3px 10px',border:'1px solid #444450',borderRadius:4,background:'#38383f',color:'#a0a0b8',fontSize:11,cursor:'pointer'}}>キャンセル</button>
            <button onClick={confirmComment} style={{padding:'3px 10px',border:'1px solid #a07030',borderRadius:4,background:'#503010',color:'#e8c060',fontSize:11,fontWeight:700,cursor:'pointer'}}>追加</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── CommentBox ───────────────────────────────────────────────────────────────
function CommentBox({ c, onDelete }: { c: CommentDef; onDelete:(id:string)=>void }) {
  const lines = c.text.split('\n')
  const DS = 18
  return (
    <g>
      <rect x={c.svgX} y={c.svgY} width={c.svgW} height={c.svgH}
        fill="rgba(200,160,48,0.10)" stroke="#c8a030" strokeWidth="1.5" strokeDasharray="6,3" rx="4"/>
      {lines.map((l,i) => (
        <text key={i} x={c.svgX+8} y={c.svgY+18+i*15}
          fill="#e8d080" fontSize="11" fontFamily="'Hiragino Sans',sans-serif">{l}</text>
      ))}
      <g data-cmt-del="true" style={{ cursor:'pointer' }}
        onMouseDown={(e)=>e.stopPropagation()}
        onClick={(e)=>{ e.stopPropagation(); onDelete(c.id) }}>
        <rect x={c.svgX+c.svgW-DS} y={c.svgY} width={DS} height={DS}
          fill="#402010" stroke="#c06030" strokeWidth="0.5" rx="3"/>
        <text x={c.svgX+c.svgW-DS/2} y={c.svgY+DS-4}
          textAnchor="middle" fill="#e08060" fontSize="12" style={{ userSelect:'none' }}>×</text>
      </g>
    </g>
  )
}
