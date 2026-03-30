'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── DB row type ─────────────────────────────────────────────────────────────────
type DbRow = {
  id: string
  sort_order: number
  table_name: string
  field_name: string
  display_name: string
  required: boolean
  ix: boolean
  dtype: string
  list: boolean
  ref_target: string
  validation: string
  notes: string
}

type FieldDef = { d: string; t: string; r?: string; l?: boolean }
type TableDef = { fields: FieldDef[] }
type EdgeDef = { f: string; t: string }
type PosMap = Record<string, { x: number; y: number }>

// ── Option Set (static) ─────────────────────────────────────────────────────────
const OS_DATA = [
  {name:'Rights', attrs:[], options:[{display:'ユーザー'},{display:'加盟店'},{display:'管理者'}]},
  {name:'予約ステータス', attrs:[], options:[{display:'貸出中'},{display:'来客待ち'},{display:'返却済み'},{display:'キャンセル'},{display:'仮情報'},{display:'キャンセル（返金なし）'}]},
  {name:'決済ステータス', attrs:[], options:[{display:'決済済み'},{display:'未決済'},{display:'返金済み'},{display:'キャンセル'}]},
  {name:'振り込みステータス', attrs:[], options:[{display:'振込済'},{display:'未振込'}]},
  {name:'支払い方法', attrs:[], options:[{display:'店頭決済'},{display:'クレカ決済'}]},
  {name:'貸し出し可能ステータス', attrs:[], options:[{display:'ユーザー表示'},{display:'ユーザー非表示'}]},
  {name:'brand_status', attrs:[], options:[{display:'passed'},{display:'in_review'},{display:'declined'},{display:'before_review'}]},
  {name:'Bicycle Category', attrs:[], options:[{display:'ロードバイク'},{display:'クロスバイク'},{display:'マウンテンバイク'},{display:'小径車'},{display:'キッズ'}]},
  {name:'yes/no', attrs:[{label:'yes'},{label:'yes_no'}], options:[{display:'yes',vals:['yes','True']},{display:'no',vals:['no','False']}]},
  {name:'営業状態op', attrs:[], options:[{display:'営業'},{display:'休業'}]},
  {name:'予約管理並び替え', attrs:[], options:[{display:'貸出日時が新しい順'},{display:'貸出日時が古い順'},{display:'予約が新しい順'},{display:'予約が古い順'}]},
  {name:'管理者/運営_news_type', attrs:[], options:[{display:'お問い合わせ'},{display:'請求/入金'},{display:'キャンセル'}]},
  {name:'Admin_info', attrs:[{label:'mail'},{label:'service_name'}], options:[{display:'デフォルト',vals:['manmosutarou@gmail.com','Rincle']}]},
  {name:'Platform_Fee', attrs:[{label:'number'}], options:[{display:'デフォルト',vals:['10']}]},
  {name:'index_page', attrs:[{label:'parameter'}], options:[
    {display:'top',vals:['']},{display:'search',vals:['search']},{display:'bicycle_detail',vals:['bicycle_detail']},
    {display:'guide',vals:['guide']},{display:'signup',vals:['signup']},{display:'mypage',vals:['mypage']},
    {display:'cart',vals:['cart']},{display:'contact',vals:['contact']},
  ]},
  {name:'Shop_Sidebar_sub', attrs:[{label:'parameter'}], options:[
    {display:'顧客一覧',vals:['customer_all']},{display:'自転車一覧',vals:['bicycle_all']},
    {display:'料金管理',vals:['price']},{display:'予約一覧',vals:['reservation']},
    {display:'売上レポート',vals:['sales']},{display:'店舗情報',vals:['info']},
    {display:'ログアウト',vals:['logout']},
  ]},
  {name:'Admin_Sidebar_sub', attrs:[{label:'parameter'}], options:[
    {display:'顧客一覧',vals:['customer_all']},{display:'加盟店一覧',vals:['shop_all']},
    {display:'予約一覧',vals:['reservation']},{display:'FV管理',vals:['first_view']},
    {display:'お知らせ管理',vals:['news']},{display:'ログアウト',vals:['logout']},
  ]},
  {name:'pay_jp_key', attrs:[{label:'key'}], options:[{display:'test_sk',vals:['sk_test_7737…']},{display:'live',vals:['pk_live_17c3…']},{display:'test_pk',vals:['pk_test_0ede…']}]},
  {name:'曜日', attrs:[{label:'slug'}], options:[{display:'月曜',vals:['月']},{display:'火曜',vals:['火']},{display:'水曜',vals:['水']},{display:'木曜',vals:['木']},{display:'金曜',vals:['金']},{display:'土曜',vals:['土']},{display:'日曜',vals:['日']},{display:'祝日',vals:['祝']}]},
  {name:'月', attrs:[], options:[{display:'1月'},{display:'2月'},{display:'3月'},{display:'4月'},{display:'5月'},{display:'6月'},{display:'7月'},{display:'8月'},{display:'9月'},{display:'10月'},{display:'11月'},{display:'12月'}]},
  {name:'日付', attrs:[{label:'number'}], options:null as null, abbrev:'1〜31（31件）'},
  {name:'Time', attrs:[{label:'display'},{label:'date'},{label:'index'}], options:null as null, abbrev:'0:00〜23:50（10分刻み・144件）'},
  {name:'menu_利用規約', attrs:[{label:'content'}], options:[{display:'Ver1',vals:['利用規約本文（長文）']}]},
  {name:'menu_プライバシーポリシー', attrs:[{label:'content'}], options:[{display:'ver1',vals:['PP本文（長文）']}]},
  {name:'menu_特商法', attrs:[{label:'content'}], options:[{display:'Ver1',vals:['特商法表記（長文）']}]},
]

// ── Constants ───────────────────────────────────────────────────────────────────
// ROW_H: minHeight(20) + padding(2+2) + border-bottom(1) = 25 → 26 with buffer
// HDR_H: font-line-height(~18) + padding(5+5) + border-bottom(1) = 29 → 30 with buffer
const BOX_W = 260, ROW_H = 26, HDR_H = 30
const GAP_X = 40, GAP_Y = 40
const COL_MAX_H = 1600

const TYPE_COLORS: Record<string, string> = {
  text:'#5a90c0', number:'#5a9060', date:'#a07040',
  boolean:'#8060a0', image:'#a06080', ref:'#50a0a0', option:'#a09050',
}

// ── Data processing helpers ─────────────────────────────────────────────────────
function buildTablesFromRows(rows: DbRow[]): Record<string, TableDef> {
  const tables: Record<string, TableDef> = {}
  let lastTable = ''
  for (const row of rows) {
    const tname = row.table_name || lastTable
    if (row.table_name) lastTable = row.table_name
    if (!tname) continue
    if (!tables[tname]) tables[tname] = { fields: [] }
    if (row.field_name || row.display_name) {
      tables[tname].fields.push({
        d: row.display_name || row.field_name,
        t: row.dtype,
        r: row.dtype === 'ref' && row.ref_target ? row.ref_target : undefined,
        l: row.list || undefined,
      })
    }
  }
  return tables
}

function autoLayout(tables: Record<string, TableDef>): PosMap {
  const pos: PosMap = {}
  let colX = 30, colY = 30
  for (const [id, tbl] of Object.entries(tables)) {
    const h = HDR_H + ROW_H + tbl.fields.length * ROW_H
    if (colY > 30 && colY + h > COL_MAX_H) {
      colX += BOX_W + GAP_X
      colY = 30
    }
    pos[id] = { x: colX, y: colY }
    colY += h + GAP_Y
  }
  return pos
}

function buildEdges(tables: Record<string, TableDef>): EdgeDef[] {
  const edges: EdgeDef[] = []
  const seen = new Set<string>()
  for (const [fromTable, tbl] of Object.entries(tables)) {
    for (const field of tbl.fields) {
      if (field.t === 'ref' && field.r && tables[field.r]) {
        const key = `${fromTable}=>${field.r}`
        if (!seen.has(key)) {
          seen.add(key)
          edges.push({ f: fromTable, t: field.r })
        }
      }
    }
  }
  return edges
}

function calcCanvasSize(tables: Record<string, TableDef>, pos: PosMap) {
  let maxX = 600, maxY = 400
  for (const [id, tbl] of Object.entries(tables)) {
    const p = pos[id]; if (!p) continue
    const h = HDR_H + ROW_H + tbl.fields.length * ROW_H
    maxX = Math.max(maxX, p.x + BOX_W)
    maxY = Math.max(maxY, p.y + h)
  }
  return { w: maxX + 60, h: maxY + 60 }
}

// ── DOM helpers ─────────────────────────────────────────────────────────────────
function mkRow(badge: string, name: string, type: string): HTMLElement {
  const row = document.createElement('div')
  Object.assign(row.style, { display:'grid', gridTemplateColumns:'26px 1fr 80px', gap:'0 3px', padding:'2px 5px', borderBottom:'1px solid rgba(255,255,255,.04)', alignItems:'center', minHeight:'20px' })

  const b = document.createElement('span')
  Object.assign(b.style, { fontSize:'9px', fontWeight:'700', textAlign:'center', padding:'1px 3px', borderRadius:'2px', width:'22px', display:'inline-block' })
  if (badge === 'PK') { b.style.background = '#382800'; b.style.color = '#ffb74d' }
  else if (badge === 'FK') { b.style.background = '#0a2828'; b.style.color = '#80cbc4' }
  b.textContent = badge

  const n = document.createElement('span')
  Object.assign(n.style, { color:'#b0b0c8', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', fontSize:'11px' })
  n.textContent = name

  const typeKey = type.split(' ').pop() || ''
  const t = document.createElement('span')
  Object.assign(t.style, { fontSize:'10px', fontFamily:'monospace', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', color: TYPE_COLORS[typeKey] ?? '#6a7a8a' })
  t.textContent = type

  row.appendChild(b); row.appendChild(n); row.appendChild(t)
  return row
}

function renderTables(canvas: HTMLElement, tables: Record<string, TableDef>, pos: PosMap) {
  canvas.querySelectorAll('.er-tbl').forEach(el => el.remove())

  Object.entries(tables).forEach(([id, tbl]) => {
    const p = pos[id]; if (!p) return
    const box = document.createElement('div')
    box.className = 'er-tbl'
    Object.assign(box.style, {
      position:'absolute', width:'260px', background:'#1c1e26', border:'1px solid #3a3a50',
      borderRadius:'4px', overflow:'hidden', boxShadow:'0 2px 10px rgba(0,0,0,.6)',
      fontSize:'11px', userSelect:'none', left:`${p.x}px`, top:`${p.y}px`,
    })

    const hd = document.createElement('div')
    Object.assign(hd.style, {
      padding:'5px 8px', fontWeight:'700', fontSize:'12px', color:'#d0d8ec',
      textAlign:'center', fontFamily:'monospace',
      background:'#1a3050', borderBottom:'1px solid #2a4870',
    })
    hd.textContent = id
    box.appendChild(hd)

    box.appendChild(mkRow('PK', 'Unique id', 'text'))

    tbl.fields.forEach(f => {
      const isFK = f.t === 'ref'
      const typeLabel = isFK
        ? (f.l ? 'List ' : '') + (f.r || '?')
        : (f.l ? 'List ' : '') + f.t
      box.appendChild(mkRow(isFK ? 'FK' : '', f.d, typeLabel))
    })

    canvas.appendChild(box)
  })
}

function drawLines(svg: SVGSVGElement, edges: EdgeDef[], tables: Record<string, TableDef>, pos: PosMap) {
  svg.querySelectorAll('path:not(defs path),line').forEach(el => el.remove())

  function getBox(id: string) {
    const p = pos[id]; if (!p) return null
    const tbl = tables[id]; if (!tbl) return null
    const h = HDR_H + ROW_H + tbl.fields.length * ROW_H
    return {
      x:p.x, y:p.y, w:BOX_W, h,
      L:{x:p.x,         y:p.y+h/2},
      R:{x:p.x+BOX_W,   y:p.y+h/2},
      T:{x:p.x+BOX_W/2, y:p.y},
      B:{x:p.x+BOX_W/2, y:p.y+h},
    }
  }

  edges.forEach(({ f, t }) => {
    const s = getBox(f), tg = getBox(t); if (!s || !tg) return
    let x1: number, y1: number, x2: number, y2: number

    if (tg.x > s.x + s.w - 10)       { x1=s.R.x; y1=s.R.y; x2=tg.L.x; y2=tg.L.y }
    else if (tg.x + tg.w < s.x + 10) { x1=s.L.x; y1=s.L.y; x2=tg.R.x; y2=tg.R.y }
    else if (tg.y > s.y + s.h - 10)  { x1=s.B.x; y1=s.B.y; x2=tg.T.x; y2=tg.T.y }
    else                               { x1=s.T.x; y1=s.T.y; x2=tg.B.x; y2=tg.B.y }

    const ddx = Math.abs(x2 - x1) * 0.45 + 20
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('stroke', '#384858')
    path.setAttribute('stroke-width', '1.5')
    path.setAttribute('fill', 'none')
    path.setAttribute('d', `M${x1},${y1} C${x1+(x2>x1?ddx:-ddx)},${y1} ${x2-(x2>x1?ddx:-ddx)},${y2} ${x2},${y2}`)
    path.setAttribute('marker-end', 'url(#arr)')
    svg.appendChild(path)
  })
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ErTab() {
  const [activeTab, setActiveTab] = useState<'dt'|'os'>('dt')
  const [loading, setLoading] = useState(true)
  const [canvasSize, setCanvasSize] = useState({ w: 1560, h: 2400 })

  const wrapRef    = useRef<HTMLDivElement>(null)
  const canvasRef  = useRef<HTMLDivElement>(null)
  const svgRef     = useRef<SVGSVGElement>(null)
  const state      = useRef({ tx:10, ty:10, sc:0.65 })
  const dragRef    = useRef<{ mx0:number; my0:number } | null>(null)

  // Derived data refs (stable between renders)
  const tablesRef  = useRef<Record<string, TableDef>>({})
  const posRef     = useRef<PosMap>({})
  const edgesRef   = useRef<EdgeDef[]>([])
  const sizeRef    = useRef({ w: 1560, h: 2400 })

  const supabase = createClient()

  function applyT() {
    if (!canvasRef.current) return
    const { tx, ty, sc } = state.current
    canvasRef.current.style.transform = `translate(${tx}px,${ty}px) scale(${sc})`
  }

  function erFit() {
    if (!wrapRef.current) return
    const ww = wrapRef.current.clientWidth, wh = wrapRef.current.clientHeight
    const { w, h } = sizeRef.current
    state.current.sc = Math.min(ww/w, wh/h) * 0.9
    state.current.tx = (ww - w * state.current.sc) / 2
    state.current.ty = (wh - h * state.current.sc) / 2
    applyT()
  }

  function erZoom(f: number) {
    state.current.sc = Math.min(3, Math.max(0.15, state.current.sc * f))
    applyT()
  }

  const redraw = useCallback(() => {
    if (!canvasRef.current || !svgRef.current) return
    renderTables(canvasRef.current, tablesRef.current, posRef.current)
    requestAnimationFrame(() => {
      if (svgRef.current) drawLines(svgRef.current, edgesRef.current, tablesRef.current, posRef.current)
    })
  }, [])

  const processRows = useCallback((rows: DbRow[]) => {
    const tables = buildTablesFromRows(rows)
    const pos    = autoLayout(tables)
    const edges  = buildEdges(tables)
    const size   = calcCanvasSize(tables, pos)
    tablesRef.current = tables
    posRef.current    = pos
    edgesRef.current  = edges
    sizeRef.current   = size
    setCanvasSize(size)
    setLoading(false)
  }, [])

  // Initial load
  useEffect(() => {
    supabase.from('db_fields').select('*').order('sort_order').then(({ data }) => {
      processRows((data || []) as DbRow[])
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('er-db-fields')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'db_fields' }, () => {
        supabase.from('db_fields').select('*').order('sort_order').then(({ data }) => {
          processRows((data || []) as DbRow[])
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-render canvas when canvasSize changes (means data changed)
  useEffect(() => {
    if (!loading) {
      redraw()
    }
  }, [canvasSize, loading, redraw])

  // Pan/zoom event listeners (mount once)
  useEffect(() => {
    const wrap = wrapRef.current; if (!wrap) return

    function onMouseDown(e: MouseEvent) {
      if ((e.target as HTMLElement).closest('.zoom-btns')) return
      dragRef.current = { mx0: e.clientX - state.current.tx, my0: e.clientY - state.current.ty }
      e.preventDefault()
    }
    function onMouseMove(e: MouseEvent) {
      if (!dragRef.current) return
      state.current.tx = e.clientX - dragRef.current.mx0
      state.current.ty = e.clientY - dragRef.current.my0
      applyT()
    }
    function onMouseUp() { dragRef.current = null }
    function onWheel(e: WheelEvent) {
      e.preventDefault()
      const f = e.deltaY < 0 ? 1.15 : 1/1.15
      state.current.sc = Math.min(3, Math.max(0.15, state.current.sc * f))
      applyT()
    }

    wrap.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    wrap.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      wrap.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      wrap.removeEventListener('wheel', onWheel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // After initial render + data ready, fit view
  useEffect(() => {
    if (!loading) {
      requestAnimationFrame(erFit)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  const tabBtn = (id: 'dt'|'os', label: string) => (
    <button key={id} onClick={() => setActiveTab(id)} style={{
      display:'flex', alignItems:'center', padding:'0 16px', height:34, border:'none',
      background:'transparent', color: activeTab === id ? '#90b8f0' : '#686880',
      fontSize:12, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap',
      borderBottom: `2px solid ${activeTab === id ? '#4a8ad8' : 'transparent'}`,
      marginBottom:-1,
    }}>{label}</button>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden', background:'#212124', fontFamily:"'Segoe UI',-apple-system,BlinkMacSystemFont,'Hiragino Sans',sans-serif" }}>

      {/* Topbar */}
      <div style={{ background:'#2a2a2f', padding:'6px 14px', display:'flex', alignItems:'center', gap:10, borderBottom:'1px solid #38383f', boxShadow:'0 2px 8px rgba(0,0,0,.4)', flexShrink:0 }}>
        <h1 style={{ fontSize:14, fontWeight:700, color:'#d0d0d8', whiteSpace:'nowrap' }}>🔗 Rincle ER図</h1>
        {activeTab === 'dt' && (<>
          <button onClick={erFit}             style={btnStyle}>全体表示</button>
          <button onClick={() => erZoom(1.25)} style={btnStyle}>拡大</button>
          <button onClick={() => erZoom(0.8)}  style={btnStyle}>縮小</button>
          <div style={{ flex:1 }} />
          {loading && <span style={{ fontSize:11, color:'#555568' }}>読み込み中...</span>}
          {!loading && <span style={{ fontSize:11, color:'#555568' }}>
            {Object.keys(tablesRef.current).length} テーブル / {edgesRef.current.length} リレーション
          </span>}
        </>)}
      </div>

      {/* Sub-tabs */}
      <div style={{ display:'flex', alignItems:'stretch', background:'#252528', borderBottom:'1px solid #38383f', padding:'0 14px', gap:2, flexShrink:0 }}>
        {tabBtn('dt', 'Data Type')}
        {tabBtn('os', 'Option Set')}
      </div>

      {/* ── Data Type tab ── */}
      <div style={{ flex:1, display: activeTab === 'dt' ? 'flex' : 'none', padding:14, overflow:'hidden', flexDirection:'column' }}>
        <div ref={wrapRef} style={{ position:'relative', width:'100%', flex:1, minHeight:300, border:'1.5px solid #2a4a7a', borderRadius:6, overflow:'hidden', background:'#181820', cursor:'grab' }}>
          <div ref={canvasRef} style={{ position:'absolute', top:0, left:0, transformOrigin:'0 0' }}>
            <svg ref={svgRef} style={{ position:'absolute', top:0, left:0, pointerEvents:'none', width:canvasSize.w, height:canvasSize.h }}>
              <defs>
                <marker id="arr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <path d="M0,0 L8,3 L0,6 Z" fill="#4a6a80"/>
                </marker>
              </defs>
            </svg>
          </div>
          {/* Zoom buttons */}
          <div className="zoom-btns" style={{ position:'absolute', bottom:10, left:10, display:'flex', flexDirection:'column', gap:4, zIndex:10 }}>
            {[['1.25','+',' 拡大'],['0.8','−','縮小'],['fit','⊡','全体']].map(([f,icon,title]) => (
              <button key={f} title={title}
                onClick={() => f === 'fit' ? erFit() : erZoom(parseFloat(f))}
                style={{ width:28, height:28, border:'1px solid #38383f', borderRadius:4, background:'#2a2a2f', color:'#a0a0b8', fontSize: f==='fit'?11:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1 }}>
                {icon}
              </button>
            ))}
          </div>
          {loading && (
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', color:'#555568', fontSize:13 }}>
              読み込み中...
            </div>
          )}
        </div>
      </div>

      {/* ── Option Set tab ── */}
      <div style={{ flex:1, display: activeTab === 'os' ? 'block' : 'none', padding:14, overflowY:'auto' }}>
        <div style={{ display:'flex', flexWrap:'wrap', gap:12 }}>
          {OS_DATA.map(os => (
            <div key={os.name} style={{ background:'#1e1820', border:'1px solid #3a2838', borderRadius:4, overflow:'hidden', minWidth:140, flex:'0 0 auto' }}>
              <div style={{ padding:'4px 10px', fontWeight:700, fontSize:11, fontFamily:'monospace', background:'#2a1a28', color:'#c8a0d8', borderBottom:'1px solid #3a2838', textAlign:'center' }}>{os.name}</div>
              {os.abbrev ? (
                <div style={{ padding:'6px 10px', color:'#7a7a8a', fontSize:11, fontStyle:'italic' }}>{os.abbrev}</div>
              ) : os.options && os.options.length > 0 ? (
                <table style={{ borderCollapse:'collapse', width:'100%', fontSize:11 }}>
                  <thead>
                    <tr>
                      {['Display', ...os.attrs.map((a: {label:string}) => a.label)].map(h => (
                        <th key={h} style={{ background:'#1e1620', color:'#9090a8', padding:'3px 8px', borderRight:'1px solid rgba(255,255,255,.05)', fontSize:10, fontWeight:700, whiteSpace:'nowrap', borderBottom:'1px solid rgba(255,255,255,.06)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {os.options.map((opt: {display:string; vals?:string[]}, oi: number) => (
                      <tr key={oi} style={{ borderBottom:'1px solid rgba(255,255,255,.04)' }}>
                        <td style={{ padding:'3px 8px', borderRight:'1px solid rgba(255,255,255,.04)', color:'#c0c0cc', whiteSpace:'nowrap' }}>{opt.display}</td>
                        {os.attrs.length > 0 && opt.vals && opt.vals.map((v: string, vi: number) => (
                          <td key={vi} style={{ padding:'3px 8px', borderRight:'1px solid rgba(255,255,255,.04)', color:'#c0c0cc', whiteSpace:'nowrap' }}>{v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  padding:'4px 12px', border:'1px solid #444450', borderRadius:4,
  background:'#38383f', color:'#a0a0b8', fontSize:11, cursor:'pointer',
}
