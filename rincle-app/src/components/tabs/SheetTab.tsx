'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_COLS  = 26
const DEFAULT_ROWS  = 100
const ROW_HDR_W     = 46
const DEFAULT_COL_W = 80
const DEFAULT_ROW_H = 22

// ── Types ────────────────────────────────────────────────────────────────────
type Addr      = { row: number; col: number }
type SheetMeta = { id: string; name: string; sort_order: number }
type CellFormat = {
  bold?:   boolean
  italic?: boolean
  strike?: boolean
  color?:  string
  bg?:     string
  align?:  'left' | 'center' | 'right'
  vAlign?: 'top' | 'middle' | 'bottom'
  wrap?:   boolean
  numFmt?: 'general' | 'number' | 'currency' | 'percent' | 'integer'
  borders?: { t?: string; b?: string; l?: string; r?: string }
}
type CtxMenu = { x: number; y: number } & (
  | { kind: 'row';  row: number }
  | { kind: 'col';  col: number }
  | { kind: 'cell' }
)

// ── Color palette ────────────────────────────────────────────────────────────
const PALETTE = [
  '#000000','#434343','#666666','#999999','#b7b7b7','#d9d9d9','#efefef','#ffffff',
  '#ff0000','#ff9900','#ffff00','#00ff00','#00ffff','#4a86e8','#9900ff','#ff00ff',
  '#e6b8a2','#f4cccc','#fce5cd','#fff2cc','#d9ead3','#d0e0e3','#c9daf8','#d9d2e9',
  '#cc4125','#e06666','#f6b26b','#ffd966','#93c47d','#76a5af','#6d9eeb','#8e7cc3',
  '#a61c00','#cc0000','#e69138','#f1c232','#6aa84f','#45818e','#3c78d8','#674ea7',
]

// ── Label helpers ─────────────────────────────────────────────────────────────
function colLabel(c: number): string {
  let s = '', n = c + 1
  while (n > 0) { n--; s = String.fromCharCode(65 + n % 26) + s; n = Math.floor(n / 26) }
  return s
}
function cellLabel(r: number, c: number) { return `${colLabel(c)}${r + 1}` }
function parseLabel(s: string): Addr | null {
  const m = s.toUpperCase().match(/^([A-Z]+)(\d+)$/)
  if (!m) return null
  let col = 0; for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64)
  return { col: col - 1, row: parseInt(m[2]) - 1 }
}

// ── Number formatter ─────────────────────────────────────────────────────────
function applyNumFmt(display: string, numFmt?: CellFormat['numFmt']): string {
  if (!numFmt || numFmt === 'general') return display
  const n = parseFloat(display)
  if (isNaN(n)) return display
  if (numFmt === 'currency') return `¥${n.toLocaleString('ja-JP', { minimumFractionDigits: 0 })}`
  if (numFmt === 'percent')  return `${(n * 100).toFixed(1)}%`
  if (numFmt === 'integer')  return Math.round(n).toLocaleString('ja-JP')
  if (numFmt === 'number')   return n.toLocaleString('ja-JP', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return display
}

// ── Formula evaluator ─────────────────────────────────────────────────────────
function evalFormula(formula: string, getVal: (r: number, c: number) => string): string {
  try {
    const expr = formula.slice(1).trim().toUpperCase()
    const rangeM = expr.match(/^(SUM|AVERAGE|COUNT|COUNTA|MAX|MIN)\(([A-Z]+\d+):([A-Z]+\d+)\)$/)
    if (rangeM) {
      const [, fn, a1, b1] = rangeM
      const a = parseLabel(a1), b = parseLabel(b1)
      if (!a || !b) return '#REF!'
      const nums: number[] = []; let cnt = 0
      for (let r = Math.min(a.row,b.row); r <= Math.max(a.row,b.row); r++)
        for (let c = Math.min(a.col,b.col); c <= Math.max(a.col,b.col); c++) {
          const v = getVal(r,c); if (v) cnt++
          const n = parseFloat(v); if (!isNaN(n)) nums.push(n)
        }
      if (fn==='SUM')     return String(nums.reduce((a,b)=>a+b,0))
      if (fn==='AVERAGE') return nums.length ? String(nums.reduce((a,b)=>a+b,0)/nums.length) : '#DIV/0!'
      if (fn==='COUNT')   return String(nums.length)
      if (fn==='COUNTA')  return String(cnt)
      if (fn==='MAX')     return nums.length ? String(Math.max(...nums)) : '0'
      if (fn==='MIN')     return nums.length ? String(Math.min(...nums)) : '0'
    }
    const withVals = expr.replace(/([A-Z]+)(\d+)/g, (_, col, row) => {
      const addr = parseLabel(`${col}${row}`); if (!addr) return '0'
      const v = getVal(addr.row, addr.col); return isNaN(Number(v)) ? '0' : (v || '0')
    })
    if (!/^[\d\s+\-*/.()]+$/.test(withVals)) return '#ERR!'
    // eslint-disable-next-line no-new-func
    return String(Function(`"use strict";return(${withVals})`)())
  } catch { return '#ERR!' }
}

// ── Toolbar sub-components ────────────────────────────────────────────────────
function TBtn({ icon, title, active, onClick, style: extraStyle }: {
  icon: React.ReactNode; title: string; active?: boolean; onClick: () => void; style?: React.CSSProperties
}) {
  return (
    <button onClick={onClick} title={title}
      style={{
        display:'flex',alignItems:'center',justifyContent:'center',
        width:28,height:28,border:'none',borderRadius:3,cursor:'pointer',
        background: active ? 'rgba(74,138,216,.25)' : 'transparent',
        color: active ? '#90b8f0' : '#c0c0cc',
        fontSize:12,fontWeight:600,flexShrink:0,...extraStyle,
      }}
      onMouseEnter={e=>(e.currentTarget.style.background=active?'rgba(74,138,216,.35)':'rgba(255,255,255,.08)')}
      onMouseLeave={e=>(e.currentTarget.style.background=active?'rgba(74,138,216,.25)':'transparent')}
    >{icon}</button>
  )
}
function TSep() {
  return <div style={{width:1,height:20,background:'#3a3a42',margin:'0 3px',flexShrink:0}}/>
}

// Color picker popup — uses position:fixed to escape overflow:auto toolbar clipping
function ColorPicker({ label, title, value, onChange }: {
  label: string; title: string; value: string; onChange: (c: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [pos,  setPos]  = useState({x:0,y:0})
  const btnRef  = useRef<HTMLButtonElement>(null)
  const popRef  = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!popRef.current?.contains(e.target as Node) && !btnRef.current?.contains(e.target as Node))
        setOpen(false)
    }
    setTimeout(() => window.addEventListener('mousedown', close), 0)
    return () => window.removeEventListener('mousedown', close)
  }, [open])
  function handleOpen() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({x: r.left, y: r.bottom + 4})
    }
    setOpen(v=>!v)
  }
  return (
    <div style={{position:'relative',flexShrink:0}}>
      <button ref={btnRef} onClick={handleOpen} title={title}
        style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',width:28,height:28,border:'none',borderRadius:3,cursor:'pointer',background:'transparent',color:'#c0c0cc',fontSize:12,fontWeight:700,gap:1,padding:0}}
        onMouseEnter={e=>(e.currentTarget.style.background='rgba(255,255,255,.08)')}
        onMouseLeave={e=>(e.currentTarget.style.background='transparent')}
      >
        <span style={{lineHeight:1}}>{label}</span>
        <div style={{width:16,height:3,background:value||'#d0d0d8',borderRadius:1,marginTop:1}}/>
      </button>
      {open && (
        <div ref={popRef} style={{position:'fixed',top:pos.y,left:pos.x,zIndex:9999,background:'#2a2a32',border:'1px solid #3a3a48',borderRadius:4,padding:6,boxShadow:'0 4px 16px rgba(0,0,0,.6)'}}>
          <div onClick={()=>{onChange('');setOpen(false)}}
            style={{display:'flex',alignItems:'center',gap:6,padding:'4px 6px',fontSize:11,color:'#888898',cursor:'pointer',borderRadius:3,marginBottom:4}}
            onMouseEnter={e=>(e.currentTarget.style.background='rgba(255,255,255,.08)')}
            onMouseLeave={e=>(e.currentTarget.style.background='transparent')}
          >
            <div style={{width:14,height:14,border:'1px solid #666',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,color:'#f66'}}>✕</div>
            なし
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(8,18px)',gap:2}}>
            {PALETTE.map(c=>(
              <div key={c} onClick={()=>{onChange(c);setOpen(false)}}
                style={{width:18,height:18,background:c,borderRadius:2,cursor:'pointer',border:`2px solid ${value===c?'#90b8f0':'transparent'}`,boxSizing:'border-box'}}
                title={c}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function SheetTab() {

  // Sheets
  const [sheets,        setSheets]        = useState<SheetMeta[]>([])
  const [activeSheetId, setActiveSheetId] = useState('')
  const [renamingId,    setRenamingId]    = useState<string | null>(null)
  const [renameVal,     setRenameVal]     = useState('')
  const activeSheetIdRef = useRef(''); activeSheetIdRef.current = activeSheetId

  // Cell values (sparse: `sid:row:col` → value)
  const [cells, setCells] = useState<Map<string, string>>(new Map())
  const cellsRef = useRef(cells); cellsRef.current = cells

  // Cell formats (sparse: `sid:row:col` → CellFormat)
  const [formats, setFormats] = useState<Map<string, CellFormat>>(new Map())
  const formatsRef = useRef(formats); formatsRef.current = formats

  // Grid size
  const [numCols, setNumCols]       = useState(DEFAULT_COLS)
  const [numRows, setNumRows]       = useState(DEFAULT_ROWS)
  const numColsRef = useRef(numCols); numColsRef.current = numCols
  const numRowsRef = useRef(numRows); numRowsRef.current = numRows
  const [colWidths,  setColWidths]  = useState<number[]>(() => Array(DEFAULT_COLS).fill(DEFAULT_COL_W))
  const [rowHeights, setRowHeights] = useState<number[]>(() => Array(DEFAULT_ROWS).fill(DEFAULT_ROW_H))

  // Selection
  const [selAnchor, setSelAnchor] = useState<Addr | null>(null)
  const [selFocus,  setSelFocus]  = useState<Addr | null>(null)
  const selAnchorRef = useRef<Addr | null>(null); selAnchorRef.current = selAnchor
  const selFocusRef  = useRef<Addr | null>(null); selFocusRef.current  = selFocus

  // Editing
  const [editingCell, setEditingCell] = useState<Addr | null>(null)
  const [editValue,   setEditValue]   = useState('')
  const [editMode,    setEditMode]    = useState<'over' | 'append'>('append')
  const editingCellRef = useRef<Addr | null>(null); editingCellRef.current = editingCell
  const editValueRef   = useRef('');                editValueRef.current   = editValue
  const cellEditorRef  = useRef<HTMLInputElement>(null)

  // Undo / Redo
  const undoStack = useRef<{ key: string; prev: string; prevFmt?: CellFormat; next: string; nextFmt?: CellFormat }[]>([])
  const redoStack = useRef<{ key: string; prev: string; prevFmt?: CellFormat; next: string; nextFmt?: CellFormat }[]>([])

  // Name box
  const [nameBoxVal,     setNameBoxVal]     = useState('A1')
  const [nameBoxFocused, setNameBoxFocused] = useState(false)

  // Cut marker
  const [cutSrc, setCutSrc] = useState<{ r1:number;c1:number;r2:number;c2:number;sid:string }|null>(null)
  const cutSrcRef = useRef(cutSrc); cutSrcRef.current = cutSrc

  // Fill handle
  const [fillAnchor, setFillAnchor] = useState<Addr | null>(null)
  const [fillFocus,  setFillFocus]  = useState<Addr | null>(null)
  const fillAnchorRef = useRef<Addr | null>(null); fillAnchorRef.current = fillAnchor
  const fillFocusRef  = useRef<Addr | null>(null); fillFocusRef.current  = fillFocus

  // Drag-select
  const isDragSelecting = useRef(false)

  // Row drag (threshold-based, no handle icon)
  const [rowDragSrc,  setRowDragSrc]  = useState<number | null>(null)
  const [rowDragOver, setRowDragOver] = useState<number | null>(null)
  const rowDragSrcRef   = useRef<number | null>(null)
  const rowDragOverRef  = useRef<number | null>(null)
  const rowDragStartY   = useRef(0)
  const rowDragStarted  = useRef(false)

  // Col drag
  const [colDragSrc,  setColDragSrc]  = useState<number | null>(null)
  const [colDragOver, setColDragOver] = useState<number | null>(null)
  const colDragSrcRef   = useRef<number | null>(null)
  const colDragOverRef  = useRef<number | null>(null)
  const colDragStartX   = useRef(0)
  const colDragStarted  = useRef(false)

  // Context menu
  const [ctxMenu, setCtxMenu] = useState<CtxMenu | null>(null)

  // Color picker open state (toolbar)
  const [colorTarget, setColorTarget] = useState<'color' | 'bg' | null>(null)

  // Border settings
  const [borderColor,     setBorderColor]     = useState('#888888')
  const [borderLineStyle, setBorderLineStyle] = useState<'solid'|'dashed'|'dotted'>('solid')
  const [borderWidth,     setBorderWidth]     = useState<2|4>(2)

  // Internal copy buffer (preserves formats across copy/paste)
  const copyBuffer = useRef<{
    tsv: string
    values: string[][]
    formats: (CellFormat | undefined)[][]
    isCut: boolean
    cutSrc?: { r1:number;r2:number;c1:number;c2:number;sid:string }
  } | null>(null)
  const scheduleSaveRef = useRef<()=>void>(()=>{})

  // Supabase
  const supabase            = useRef(createClient()).current
  const [saving,  setSaving]  = useState(false)
  const [loading, setLoading] = useState(true)
  const saveTimer   = useRef<ReturnType<typeof setTimeout>>(undefined)
  const dirtyKeys   = useRef<Set<string>>(new Set())

  // ── Helpers ──────────────────────────────────────────────────────────────
  const mkKey = (sid: string, r: number, c: number) => `${sid}:${r}:${c}`

  const getRaw = useCallback((r: number, c: number, sid?: string): string =>
    cellsRef.current.get(mkKey(sid ?? activeSheetIdRef.current, r, c)) ?? ''
  , [])

  const getFmt = useCallback((r: number, c: number, sid?: string): CellFormat =>
    formatsRef.current.get(mkKey(sid ?? activeSheetIdRef.current, r, c)) ?? {}
  , [])

  const getDisplay = useCallback((r: number, c: number, sid?: string): string => {
    const v = getRaw(r, c, sid)
    const raw = v.startsWith('=') ? evalFormula(v, (rr,cc) => getRaw(rr,cc,sid)) : v
    return applyNumFmt(raw, getFmt(r, c, sid).numFmt)
  }, [getRaw, getFmt])

  const getRange = (a: Addr | null, f: Addr | null) => {
    if (!a) return null
    const b = f ?? a
    return { r1:Math.min(a.row,b.row), r2:Math.max(a.row,b.row), c1:Math.min(a.col,b.col), c2:Math.max(a.col,b.col) }
  }
  const inSel = (r:number,c:number,a:Addr|null,f:Addr|null) => {
    const rng=getRange(a,f); return !!rng&&r>=rng.r1&&r<=rng.r2&&c>=rng.c1&&c<=rng.c2
  }

  // ── Save ─────────────────────────────────────────────────────────────────
  const scheduleSave = useCallback(() => {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      const keys = [...dirtyKeys.current]; dirtyKeys.current.clear()
      if (!keys.length) return
      setSaving(true)
      for (const k of keys) {
        const p = k.split(':'); const sid=p[0],ri=+p[1],ci=+p[2]
        const v = cellsRef.current.get(k)
        const fmt = formatsRef.current.get(k)
        if (!v && !fmt) {
          await supabase.from('sheet_cells').delete()
            .eq('sheet_id',sid).eq('row_idx',ri).eq('col_idx',ci)
        } else {
          await supabase.from('sheet_cells').upsert(
            { sheet_id:sid, row_idx:ri, col_idx:ci, value:v||'', format:fmt||null },
            { onConflict:'sheet_id,row_idx,col_idx' }
          )
        }
      }
      setSaving(false)
    }, 800)
  }, [supabase])

  const scheduleFullSave = useCallback(async (sid: string) => {
    clearTimeout(saveTimer.current)
    setSaving(true)
    await supabase.from('sheet_cells').delete().eq('sheet_id', sid)
    const rows: object[] = []
    const allKeys = new Set([...cellsRef.current.keys(), ...formatsRef.current.keys()])
    for (const k of allKeys) {
      const p = k.split(':'); if(p[0]!==sid) continue
      const v = cellsRef.current.get(k); const fmt = formatsRef.current.get(k)
      if (!v && !fmt) continue
      rows.push({ sheet_id:sid, row_idx:+p[1], col_idx:+p[2], value:v||'', format:fmt||null })
    }
    if (rows.length) await supabase.from('sheet_cells').insert(rows)
    setSaving(false)
  }, [supabase])
  scheduleSaveRef.current = scheduleSave

  // ── Cell value setter ─────────────────────────────────────────────────────
  const setCellVal = useCallback((r: number, c: number, val: string, sid?: string) => {
    const sheetId = sid ?? activeSheetIdRef.current
    const key = mkKey(sheetId, r, c)
    const prev = cellsRef.current.get(key) ?? ''
    if (prev === val) return
    undoStack.current.push({ key, prev, next: val })
    redoStack.current = []
    setCells(m => { const n=new Map(m); if(val==='') n.delete(key); else n.set(key,val); return n })
    dirtyKeys.current.add(key); scheduleSave()
  }, [scheduleSave])
  const setCellValRef = useRef(setCellVal); setCellValRef.current = setCellVal

  // ── Format setter ─────────────────────────────────────────────────────────
  const applyFormat = useCallback((patch: Partial<CellFormat>, anchor?: Addr | null, focus?: Addr | null) => {
    const a   = anchor ?? selAnchorRef.current
    const f   = focus  ?? selFocusRef.current
    const rng = getRange(a, f) ?? (a ? {r1:a.row,r2:a.row,c1:a.col,c2:a.col} : null)
    if (!rng) return
    const sid = activeSheetIdRef.current
    setFormats(prev => {
      const next = new Map(prev)
      for (let r=rng.r1; r<=rng.r2; r++)
        for (let c=rng.c1; c<=rng.c2; c++) {
          const k = mkKey(sid, r, c)
          next.set(k, { ...prev.get(k), ...patch })
          dirtyKeys.current.add(k)
        }
      return next
    })
    scheduleSave()
  }, [scheduleSave])

  const toggleFormat = useCallback((key: keyof CellFormat) => {
    const a = selAnchorRef.current; if (!a) return
    const cur = formatsRef.current.get(mkKey(activeSheetIdRef.current, a.row, a.col))
    applyFormat({ [key]: !cur?.[key] })
  }, [applyFormat])

  // ── Commit edit ───────────────────────────────────────────────────────────
  const commitEdit = useCallback(() => {
    const ec = editingCellRef.current; if (!ec) return
    setCellValRef.current(ec.row, ec.col, editValueRef.current)
    setEditingCell(null)
  }, [])
  const commitEditRef = useRef(commitEdit); commitEditRef.current = commitEdit

  // ── Undo/Redo ─────────────────────────────────────────────────────────────
  const applyEntry = useCallback((key: string, val: string, fmt?: CellFormat) => {
    setCells(m => { const n=new Map(m); if(val==='') n.delete(key); else n.set(key,val); return n })
    if (fmt !== undefined) setFormats(m => { const n=new Map(m); n.set(key,fmt); return n })
    dirtyKeys.current.add(key); scheduleSave()
    const p = key.split(':'); setSelAnchor({row:+p[1],col:+p[2]}); setSelFocus(null)
  }, [scheduleSave])

  // ── Focus cell editor ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!editingCell) return
    const t = setTimeout(() => {
      const el = cellEditorRef.current; if (!el) return
      el.focus()
      if (editMode==='over') el.select()
      else { const len=el.value.length; el.setSelectionRange(len,len) }
    }, 0)
    return () => clearTimeout(t)
  }, [editingCell, editMode])

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      const { data:{user} } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      const [sheetsRes, cellsRes] = await Promise.all([
        supabase.from('sheet_tabs').select('*').order('sort_order'),
        supabase.from('sheet_cells').select('*'),
      ])
      let list: SheetMeta[] = sheetsRes.data ?? []
      if (!list.length) {
        const s = { id:crypto.randomUUID(), name:'Sheet1', sort_order:0 }
        await supabase.from('sheet_tabs').insert({...s, user_id:user.id})
        list = [s]
      }
      setSheets(list); setActiveSheetId(list[0].id); activeSheetIdRef.current = list[0].id
      const valMap = new Map<string, string>()
      const fmtMap = new Map<string, CellFormat>()
      for (const row of (cellsRes.data ?? [])) {
        if (row.value) valMap.set(mkKey(row.sheet_id,row.row_idx,row.col_idx), row.value)
        if (row.format) fmtMap.set(mkKey(row.sheet_id,row.row_idx,row.col_idx), row.format)
      }
      setCells(valMap); setFormats(fmtMap); setLoading(false)
    }
    load()
  }, [supabase])

  // ── Grid operations ───────────────────────────────────────────────────────
  const shiftCells = useCallback((sid: string, axis: 'row'|'col', at: number, delta: 1|-1, nRows: number, nCols: number) => {
    const transformKey = (p: string[]) => {
      const r=+p[1], c=+p[2]
      if (axis==='row') { if(r<at) return null; return mkKey(sid,r+delta,c) }
      else              { if(c<at) return null; return mkKey(sid,r,c+delta) }
    }
    setCells(prev => {
      const next = new Map<string,string>()
      for (const [k,v] of prev) {
        const p=k.split(':'); if(p[0]!==sid){next.set(k,v);continue}
        const r=+p[1],c=+p[2]
        if (axis==='row'&&r===at&&delta===-1) continue
        if (axis==='col'&&c===at&&delta===-1) continue
        const nk=transformKey(p); if(nk)next.set(nk,v); else next.set(k,v)
      }
      return next
    })
    setFormats(prev => {
      const next = new Map<string,CellFormat>()
      for (const [k,v] of prev) {
        const p=k.split(':'); if(p[0]!==sid){next.set(k,v);continue}
        const r=+p[1],c=+p[2]
        if (axis==='row'&&r===at&&delta===-1) continue
        if (axis==='col'&&c===at&&delta===-1) continue
        const nk=transformKey(p); if(nk)next.set(nk,v); else next.set(k,v)
      }
      return next
    })
    setTimeout(()=>scheduleFullSave(sid),0)
  }, [scheduleFullSave])

  const insertRow  = useCallback((r:number)=>{const sid=activeSheetIdRef.current;shiftCells(sid,'row',r,1,numRowsRef.current,numColsRef.current);setNumRows(n=>n+1);setRowHeights(h=>[...h.slice(0,r),DEFAULT_ROW_H,...h.slice(r)])}, [shiftCells])
  const deleteRow  = useCallback((r:number)=>{const sid=activeSheetIdRef.current;shiftCells(sid,'row',r,-1,numRowsRef.current,numColsRef.current);setNumRows(n=>Math.max(1,n-1));setRowHeights(h=>h.filter((_,i)=>i!==r))}, [shiftCells])
  const insertCol  = useCallback((c:number)=>{const sid=activeSheetIdRef.current;shiftCells(sid,'col',c,1,numRowsRef.current,numColsRef.current);setNumCols(n=>n+1);setColWidths(w=>[...w.slice(0,c),DEFAULT_COL_W,...w.slice(c)])}, [shiftCells])
  const deleteCol  = useCallback((c:number)=>{const sid=activeSheetIdRef.current;shiftCells(sid,'col',c,-1,numRowsRef.current,numColsRef.current);setNumCols(n=>Math.max(1,n-1));setColWidths(w=>w.filter((_,i)=>i!==c))}, [shiftCells])

  const moveRow = useCallback((src:number,tgt:number)=>{
    if(src===tgt)return
    const sid=activeSheetIdRef.current; const nCols=numColsRef.current
    const [lo,hi]=src<tgt?[src,tgt]:[tgt,src]
    setCells(prev=>{
      const next=new Map(prev)
      const snap=Array.from({length:hi-lo+1},(_,i)=>Array.from({length:nCols},(_,c)=>prev.get(mkKey(sid,lo+i,c))||''))
      const arr=[...snap]; if(src<tgt)arr.push(arr.shift()!); else arr.unshift(arr.pop()!)
      arr.forEach((row,i)=>row.forEach((v,c)=>{const k=mkKey(sid,lo+i,c);if(v)next.set(k,v);else next.delete(k);dirtyKeys.current.add(k)}))
      return next
    })
    setFormats(prev=>{
      const next=new Map(prev)
      const snap=Array.from({length:hi-lo+1},(_,i)=>Array.from({length:nCols},(_,c)=>prev.get(mkKey(sid,lo+i,c))))
      const arr=[...snap]; if(src<tgt)arr.push(arr.shift()!); else arr.unshift(arr.pop()!)
      arr.forEach((row,i)=>row.forEach((fmt,c)=>{const k=mkKey(sid,lo+i,c);if(fmt)next.set(k,fmt);else next.delete(k)}))
      return next
    })
    scheduleSave()
  }, [scheduleSave])

  const moveCol = useCallback((src:number,tgt:number)=>{
    if(src===tgt)return
    const sid=activeSheetIdRef.current; const nRows=numRowsRef.current
    const [lo,hi]=src<tgt?[src,tgt]:[tgt,src]
    setCells(prev=>{
      const next=new Map(prev)
      for(let r=0;r<nRows;r++){
        const snap=Array.from({length:hi-lo+1},(_,i)=>prev.get(mkKey(sid,r,lo+i))||'')
        const arr=[...snap]; if(src<tgt)arr.push(arr.shift()!); else arr.unshift(arr.pop()!)
        arr.forEach((v,i)=>{const k=mkKey(sid,r,lo+i);if(v)next.set(k,v);else next.delete(k);dirtyKeys.current.add(k)})
      }
      return next
    })
    setFormats(prev=>{
      const next=new Map(prev)
      for(let r=0;r<nRows;r++){
        const snap=Array.from({length:hi-lo+1},(_,i)=>prev.get(mkKey(sid,r,lo+i)))
        const arr=[...snap]; if(src<tgt)arr.push(arr.shift()!); else arr.unshift(arr.pop()!)
        arr.forEach((fmt,i)=>{const k=mkKey(sid,r,lo+i);if(fmt)next.set(k,fmt);else next.delete(k)})
      }
      return next
    })
    setColWidths(w=>{const n=[...w];const sl=n.slice(lo,hi+1);if(src<tgt)sl.push(sl.shift()!);else sl.unshift(sl.pop()!);n.splice(lo,hi-lo+1,...sl);return n})
    scheduleSave()
  }, [scheduleSave])

  const moveRowRef = useRef(moveRow); moveRowRef.current = moveRow
  const moveColRef = useRef(moveCol); moveColRef.current = moveCol

  // ── Keyboard handler ──────────────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const active = document.activeElement as HTMLElement|null
      if (active?.closest('[data-namebox],[data-sheettab-rename],[data-fxbar]')) return
      const isMeta  = e.metaKey || e.ctrlKey
      const anchor  = selAnchorRef.current
      const focus   = selFocusRef.current
      const editing = editingCellRef.current
      const nRows   = numRowsRef.current
      const nCols   = numColsRef.current

      // Undo / Redo
      if (isMeta&&e.key==='z'&&!editing) {
        e.preventDefault()
        const stack = e.shiftKey ? redoStack : undoStack
        const other = e.shiftKey ? undoStack : redoStack
        const en = stack.current.pop()
        if (en) { other.current.push(en); applyEntry(en.key, e.shiftKey?en.next:en.prev, e.shiftKey?en.nextFmt:en.prevFmt) }
        return
      }
      // Bold / Italic / Strike
      if (isMeta&&e.key==='b'&&!editing) { e.preventDefault(); toggleFormat('bold'); return }
      if (isMeta&&e.key==='i'&&!editing) { e.preventDefault(); toggleFormat('italic'); return }
      if (isMeta&&e.shiftKey&&e.key==='X'&&!editing) { e.preventDefault(); toggleFormat('strike'); return }

      // Copy
      if (isMeta&&e.key==='c'&&!editing) {
        e.preventDefault(); setCutSrc(null)
        const rng=getRange(anchor,focus); if(!rng) return
        const values=Array.from({length:rng.r2-rng.r1+1},(_,ri)=>Array.from({length:rng.c2-rng.c1+1},(_,ci)=>getRaw(rng.r1+ri,rng.c1+ci)))
        const fmts=Array.from({length:rng.r2-rng.r1+1},(_,ri)=>Array.from({length:rng.c2-rng.c1+1},(_,ci)=>{const f=getFmt(rng.r1+ri,rng.c1+ci);return Object.keys(f).length?f:undefined}))
        const tsv=values.map(r=>r.join('\t')).join('\n')
        copyBuffer.current={tsv,values,formats:fmts,isCut:false}
        navigator.clipboard.writeText(tsv).catch(()=>{})
        return
      }
      // Cut
      if (isMeta&&e.key==='x'&&!editing&&anchor) {
        e.preventDefault()
        const rng=getRange(anchor,focus)!
        const values=Array.from({length:rng.r2-rng.r1+1},(_,ri)=>Array.from({length:rng.c2-rng.c1+1},(_,ci)=>getRaw(rng.r1+ri,rng.c1+ci)))
        const fmts=Array.from({length:rng.r2-rng.r1+1},(_,ri)=>Array.from({length:rng.c2-rng.c1+1},(_,ci)=>{const f=getFmt(rng.r1+ri,rng.c1+ci);return Object.keys(f).length?f:undefined}))
        const tsv=values.map(r=>r.join('\t')).join('\n')
        const cutSrcVal={...rng,sid:activeSheetIdRef.current}
        copyBuffer.current={tsv,values,formats:fmts,isCut:true,cutSrc:cutSrcVal}
        navigator.clipboard.writeText(tsv).catch(()=>{})
        setCutSrc(cutSrcVal); return
      }
      // Paste
      if (isMeta&&e.key==='v'&&!editing) {
        e.preventDefault()
        navigator.clipboard.readText().then(text=>{
          const anc=selAnchorRef.current; if(!anc) return
          const sid=activeSheetIdRef.current
          const buf=copyBuffer.current
          if(buf&&text===buf.tsv){
            // Internal paste: values + formats
            for(let ri=0;ri<buf.values.length;ri++)
              for(let ci=0;ci<buf.values[ri].length;ci++)
                setCellValRef.current(anc.row+ri,anc.col+ci,buf.values[ri][ci])
            setFormats(prev=>{
              const next=new Map(prev)
              for(let ri=0;ri<buf.formats.length;ri++)
                for(let ci=0;ci<buf.formats[ri].length;ci++){
                  const k=mkKey(sid,anc.row+ri,anc.col+ci)
                  const fmt=buf.formats[ri][ci]
                  if(fmt)next.set(k,{...fmt}); else next.delete(k)
                  dirtyKeys.current.add(k)
                }
              return next
            })
            scheduleSaveRef.current()
            // Cut: clear source cells
            if(buf.isCut&&buf.cutSrc){
              const cs=buf.cutSrc
              for(let r=cs.r1;r<=cs.r2;r++)for(let c=cs.c1;c<=cs.c2;c++){
                setCellValRef.current(r,c,'',cs.sid)
                const k=mkKey(cs.sid,r,c)
                setFormats(prev=>{const next=new Map(prev);next.delete(k);dirtyKeys.current.add(k);return next})
              }
              setCutSrc(null); copyBuffer.current=null
            }
          } else {
            // External paste: values only
            text.split('\n').forEach((line,ri)=>line.split('\t').forEach((val,ci)=>setCellValRef.current(anc.row+ri,anc.col+ci,val)))
            const cut=cutSrcRef.current
            if(cut){for(let r=cut.r1;r<=cut.r2;r++)for(let c=cut.c1;c<=cut.c2;c++)setCellValRef.current(r,c,'',cut.sid);setCutSrc(null)}
          }
        }).catch(()=>{})
        return
      }
      // Delete / Backspace
      if ((e.key==='Delete'||e.key==='Backspace')&&!editing&&anchor) {
        e.preventDefault()
        const rng=getRange(anchor,focus)!
        for(let r=rng.r1;r<=rng.r2;r++)for(let c=rng.c1;c<=rng.c2;c++)setCellValRef.current(r,c,'')
        return
      }
      // Escape
      if (e.key==='Escape') { if(editing)setEditingCell(null); else{setSelAnchor(null);setSelFocus(null)}; setCutSrc(null); return }
      // Enter
      if (e.key==='Enter') {
        if(editing){e.preventDefault();commitEditRef.current();setSelAnchor(p=>p?{row:Math.min(nRows-1,p.row+1),col:p.col}:p);setSelFocus(null)}
        else if(anchor){e.preventDefault();setEditingCell(anchor);setEditValue(getRaw(anchor.row,anchor.col));setEditMode('append')}
        return
      }
      // Tab
      if (e.key==='Tab') {
        e.preventDefault()
        if(editing)commitEditRef.current()
        setSelAnchor(p=>p?{row:p.row,col:e.shiftKey?Math.max(0,p.col-1):Math.min(nCols-1,p.col+1)}:p)
        setSelFocus(null); setEditingCell(null); return
      }
      // Arrows
      if (!editing&&anchor&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
        e.preventDefault()
        const base=e.shiftKey?(selFocusRef.current??anchor):anchor
        let {row,col}=base
        if(e.key==='ArrowUp')   row=Math.max(0,row-1)
        if(e.key==='ArrowDown') row=Math.min(nRows-1,row+1)
        if(e.key==='ArrowLeft') col=Math.max(0,col-1)
        if(e.key==='ArrowRight')col=Math.min(nCols-1,col+1)
        if(e.shiftKey)setSelFocus({row,col}); else{setSelAnchor({row,col});setSelFocus(null)}
        return
      }
      // Ctrl+Home/End
      if (!editing&&isMeta&&e.key==='Home') { e.preventDefault();setSelAnchor({row:0,col:0});setSelFocus(null);return }
      if (!editing&&isMeta&&e.key==='End') {
        e.preventDefault(); let mr=0,mc=0
        const sid=activeSheetIdRef.current
        for(const k of cellsRef.current.keys()){const p=k.split(':');if(p[0]!==sid)continue;mr=Math.max(mr,+p[1]);mc=Math.max(mc,+p[2])}
        setSelAnchor({row:mr,col:mc}); setSelFocus(null); return
      }
      // PageUp/Down
      if (!editing&&anchor&&(e.key==='PageUp'||e.key==='PageDown')) {
        e.preventDefault()
        setSelAnchor({row:Math.max(0,Math.min(nRows-1,anchor.row+(e.key==='PageDown'?15:-15))),col:anchor.col})
        setSelFocus(null); return
      }
      // F2
      if (e.key==='F2'&&anchor&&!editing) { e.preventDefault();setEditingCell(anchor);setEditValue(getRaw(anchor.row,anchor.col));setEditMode('append');return }
      // Printable → overwrite
      if (!editing&&anchor&&e.key.length===1&&!isMeta&&!e.altKey) { setEditingCell(anchor);setEditValue(e.key);setEditMode('over') }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [getRaw, applyEntry, toggleFormat]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Name box sync ─────────────────────────────────────────────────────────
  useEffect(() => { if(selAnchor&&!nameBoxFocused) setNameBoxVal(cellLabel(selAnchor.row,selAnchor.col)) }, [selAnchor, nameBoxFocused])

  // ── Global: row/col drag + fill + drag-select ──────────────────────────────
  useEffect(() => {
    function onMove(e: MouseEvent) {
      // Row drag
      if (rowDragSrcRef.current !== null) {
        if (!rowDragStarted.current) {
          if (Math.abs(e.clientY - rowDragStartY.current) > 5) {
            rowDragStarted.current=true; setRowDragSrc(rowDragSrcRef.current)
            document.body.style.cursor='grabbing'; document.body.style.userSelect='none'
          }
        }
        if (rowDragStarted.current) {
          const el=(document.elementFromPoint(e.clientX,e.clientY) as Element|null)?.closest('[data-row]') as HTMLElement|null
          const v=el?.getAttribute('data-row')
          if(v!=null){const r=+v;if(!isNaN(r)){rowDragOverRef.current=r;setRowDragOver(r)}}
        }
      }
      // Col drag
      if (colDragSrcRef.current !== null) {
        if (!colDragStarted.current) {
          if (Math.abs(e.clientX - colDragStartX.current) > 5) {
            colDragStarted.current=true; setColDragSrc(colDragSrcRef.current)
            document.body.style.cursor='grabbing'; document.body.style.userSelect='none'
          }
        }
        if (colDragStarted.current) {
          const el=(document.elementFromPoint(e.clientX,e.clientY) as Element|null)?.closest('[data-col]') as HTMLElement|null
          const v=el?.getAttribute('data-col')
          if(v!=null){const c=+v;if(!isNaN(c)){colDragOverRef.current=c;setColDragOver(c)}}
        }
      }
      // Fill handle
      if (fillAnchorRef.current) {
        const td=(document.elementFromPoint(e.clientX,e.clientY) as Element|null)?.closest('[data-cell]') as HTMLElement|null
        const attr=td?.getAttribute('data-cell'); if(!attr) return
        const [rStr,cStr]=attr.split(':'); const r=+rStr,c=+cStr
        if(!isNaN(r)&&!isNaN(c)) setFillFocus({row:r,col:c})
      }
      // Drag-select
      if (isDragSelecting.current) {
        const td=(document.elementFromPoint(e.clientX,e.clientY) as Element|null)?.closest('[data-cell]') as HTMLElement|null
        const attr=td?.getAttribute('data-cell'); if(!attr) return
        const [rStr,cStr]=attr.split(':'); const r=+rStr,c=+cStr
        if(!isNaN(r)&&!isNaN(c)) setSelFocus(prev=>prev?.row===r&&prev?.col===c?prev:{row:r,col:c})
      }
    }
    function onUp() {
      if (rowDragSrcRef.current!==null) {
        if(rowDragStarted.current){const src=rowDragSrcRef.current;const tgt=rowDragOverRef.current;if(tgt!==null&&tgt!==src)moveRowRef.current(src,tgt);setRowDragSrc(null);setRowDragOver(null)}
        rowDragSrcRef.current=null;rowDragOverRef.current=null;rowDragStarted.current=false
        document.body.style.cursor='';document.body.style.userSelect=''
      }
      if (colDragSrcRef.current!==null) {
        if(colDragStarted.current){const src=colDragSrcRef.current;const tgt=colDragOverRef.current;if(tgt!==null&&tgt!==src)moveColRef.current(src,tgt);setColDragSrc(null);setColDragOver(null)}
        colDragSrcRef.current=null;colDragOverRef.current=null;colDragStarted.current=false
        document.body.style.cursor='';document.body.style.userSelect=''
      }
      if (fillAnchorRef.current) {
        const src=fillAnchorRef.current;const tgt=fillFocusRef.current
        if(src&&tgt&&(src.row!==tgt.row||src.col!==tgt.col)){
          const val=getRaw(src.row,src.col)
          if(tgt.col===src.col){const[a,b]=[Math.min(src.row,tgt.row),Math.max(src.row,tgt.row)];for(let r=a;r<=b;r++)if(r!==src.row)setCellValRef.current(r,src.col,val)}
          else{const[a,b]=[Math.min(src.col,tgt.col),Math.max(src.col,tgt.col)];for(let c=a;c<=b;c++)if(c!==src.col)setCellValRef.current(src.row,c,val)}
        }
        setFillAnchor(null);setFillFocus(null);document.body.style.cursor='';document.body.style.userSelect=''
      }
      if(isDragSelecting.current){isDragSelecting.current=false;document.body.style.userSelect=''}
    }
    window.addEventListener('mousemove',onMove); window.addEventListener('mouseup',onUp)
    return ()=>{window.removeEventListener('mousemove',onMove);window.removeEventListener('mouseup',onUp)}
  }, [getRaw]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Context menu close ────────────────────────────────────────────────────
  useEffect(() => {
    if(!ctxMenu) return
    const close=()=>setCtxMenu(null)
    setTimeout(()=>window.addEventListener('click',close),0)
    return ()=>window.removeEventListener('click',close)
  }, [ctxMenu])

  // ── Sheet ops ─────────────────────────────────────────────────────────────
  async function addSheet() {
    const {data:{user}}=await supabase.auth.getUser(); if(!user) return
    const s={id:crypto.randomUUID(),name:`Sheet${sheets.length+1}`,sort_order:sheets.length}
    setSheets(p=>[...p,s]); setActiveSheetId(s.id); setSelAnchor(null); setSelFocus(null)
    await supabase.from('sheet_tabs').insert({...s,user_id:user.id})
  }
  async function deleteSheet(id:string) {
    if(sheets.length<=1) return; if(!confirm('シートを削除しますか？')) return
    const next=sheets.filter(s=>s.id!==id); setSheets(next); if(activeSheetId===id)setActiveSheetId(next[0].id)
    await supabase.from('sheet_tabs').delete().eq('id',id)
  }
  async function renameSheet(id:string,name:string) {
    const n=name.trim()||sheets.find(s=>s.id===id)?.name||'Sheet'
    setSheets(p=>p.map(s=>s.id===id?{...s,name:n}:s)); setRenamingId(null)
    await supabase.from('sheet_tabs').update({name:n}).eq('id',id)
  }

  // ── Resize ────────────────────────────────────────────────────────────────
  function startColResize(ci:number,e:React.MouseEvent){
    e.preventDefault();e.stopPropagation()
    const sx=e.clientX,sw=colWidths[ci]??DEFAULT_COL_W
    const mv=(me:MouseEvent)=>setColWidths(p=>{const n=[...p];n[ci]=Math.max(24,sw+me.clientX-sx);return n})
    const up=()=>{window.removeEventListener('mousemove',mv);window.removeEventListener('mouseup',up)}
    window.addEventListener('mousemove',mv);window.addEventListener('mouseup',up)
  }
  function startRowResize(ri:number,e:React.MouseEvent){
    e.preventDefault();e.stopPropagation()
    const sy=e.clientY,sh=rowHeights[ri]??DEFAULT_ROW_H
    const mv=(me:MouseEvent)=>setRowHeights(p=>{const n=[...p];n[ri]=Math.max(14,sh+me.clientY-sy);return n})
    const up=()=>{window.removeEventListener('mousemove',mv);window.removeEventListener('mouseup',up)}
    window.addEventListener('mousemove',mv);window.addEventListener('mouseup',up)
  }

  // ── Cell click ────────────────────────────────────────────────────────────
  function handleCellClick(e:React.MouseEvent,r:number,c:number){
    e.stopPropagation()
    if(e.shiftKey&&selAnchor){setSelFocus({row:r,col:c});return}
    if(editingCellRef.current&&(editingCellRef.current.row!==r||editingCellRef.current.col!==c))commitEditRef.current()
    setSelAnchor({row:r,col:c}); setSelFocus(null)
  }

  // ── Select all row / col ──────────────────────────────────────────────────
  function selectRow(r:number,e:React.MouseEvent){
    commitEditRef.current()
    if(e.shiftKey&&selAnchor)setSelFocus({row:r,col:numCols-1})
    else{setSelAnchor({row:r,col:0});setSelFocus({row:r,col:numCols-1})}
  }
  function selectCol(c:number,e:React.MouseEvent){
    commitEditRef.current()
    if(e.shiftKey&&selAnchor)setSelFocus({row:numRows-1,col:c})
    else{setSelAnchor({row:0,col:c});setSelFocus({row:numRows-1,col:c})}
  }
  function selectAll(){ commitEditRef.current(); setSelAnchor({row:0,col:0}); setSelFocus({row:numRows-1,col:numCols-1}) }

  // ── Context menu ──────────────────────────────────────────────────────────
  function CtxItem({label,onClick,danger}:{label:string;onClick:()=>void;danger?:boolean}){
    return(
      <div onClick={onClick} style={{padding:'7px 14px',fontSize:12,color:danger?'#ff7070':'#c8c8d4',cursor:'pointer',userSelect:'none'}}
        onMouseEnter={e=>(e.currentTarget.style.background='#3a3a48')}
        onMouseLeave={e=>(e.currentTarget.style.background='transparent')}
      >{label}</div>
    )
  }

  // ── Toolbar: current cell format ──────────────────────────────────────────
  const curFmt: CellFormat = selAnchor ? getFmt(selAnchor.row, selAnchor.col) : {}

  // ── Computed ──────────────────────────────────────────────────────────────
  if (loading) return <div style={{padding:20,color:'#555568'}}>読み込み中...</div>

  const selRange = getRange(selAnchor, selFocus)
  const isColSel = (c:number) => selRange?(selRange.r1===0&&selRange.r2===numRows-1&&c>=selRange.c1&&c<=selRange.c2):false
  const isRowSel = (r:number) => selRange?(selRange.c1===0&&selRange.c2===numCols-1&&r>=selRange.r1&&r<=selRange.r2):false
  const fillRange = fillAnchor&&fillFocus?{r1:Math.min(fillAnchor.row,fillFocus.row),r2:Math.max(fillAnchor.row,fillFocus.row),c1:Math.min(fillAnchor.col,fillFocus.col),c2:Math.max(fillAnchor.col,fillFocus.col)}:null
  const inFill=(r:number,c:number)=>!!fillRange&&!!fillAnchor&&!(r===fillAnchor.row&&c===fillAnchor.col)&&r>=fillRange.r1&&r<=fillRange.r2&&c>=fillRange.c1&&c<=fillRange.c2
  const inCut=(r:number,c:number)=>!!cutSrc&&r>=cutSrc.r1&&r<=cutSrc.r2&&c>=cutSrc.c1&&c<=cutSrc.c2

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',overflow:'hidden',background:'#1e1e24',fontFamily:'Consolas,"Courier New",monospace'}}
      onClick={()=>setCtxMenu(null)}>

      {/* ── Toolbar ───────────────────────────────────────────────────────── */}
      <div style={{display:'flex',alignItems:'center',height:36,flexShrink:0,background:'#252528',borderBottom:'1px solid #38383f',padding:'0 8px',gap:2,overflowX:'auto'}}>

        {/* Undo / Redo */}
        <TBtn icon="↩" title="元に戻す (⌘Z)"     onClick={()=>{const en=undoStack.current.pop();if(en){redoStack.current.push(en);applyEntry(en.key,en.prev,en.prevFmt)}}} />
        <TBtn icon="↪" title="やり直し (⌘⇧Z)"    onClick={()=>{const en=redoStack.current.pop();if(en){undoStack.current.push(en);applyEntry(en.key,en.next,en.nextFmt)}}} />
        <TSep/>

        {/* Text format */}
        <TBtn icon={<b>B</b>}   title="太字 (⌘B)"       active={curFmt.bold}   onClick={()=>toggleFormat('bold')} />
        <TBtn icon={<i>I</i>}   title="斜体 (⌘I)"       active={curFmt.italic} onClick={()=>toggleFormat('italic')} />
        <TBtn icon={<s>S</s>}   title="取り消し線"       active={curFmt.strike} onClick={()=>toggleFormat('strike')} />
        <TSep/>

        {/* Font color */}
        <ColorPicker label="A" title="文字色" value={curFmt.color??''} onChange={c=>applyFormat({color:c})} />
        {/* Background color */}
        <ColorPicker label="◼" title="背景色" value={curFmt.bg??''} onChange={c=>applyFormat({bg:c})} />
        <TSep/>

        {/* Horizontal align */}
        <TBtn icon="⬛▏" title="左揃え"   active={!curFmt.align||curFmt.align==='left'}   onClick={()=>applyFormat({align:'left'})}   style={{fontSize:10}} />
        <TBtn icon="▏⬛▏" title="中央揃え" active={curFmt.align==='center'} onClick={()=>applyFormat({align:'center'})} style={{fontSize:9}} />
        <TBtn icon="▏⬛" title="右揃え"   active={curFmt.align==='right'}  onClick={()=>applyFormat({align:'right'})}  style={{fontSize:10}} />
        <TSep/>

        {/* Vertical align */}
        <TBtn icon="↑≡" title="上揃え"   active={curFmt.vAlign==='top'}    onClick={()=>applyFormat({vAlign:'top'})}    style={{fontSize:10}} />
        <TBtn icon="≡"  title="中央縦揃え" active={!curFmt.vAlign||curFmt.vAlign==='middle'} onClick={()=>applyFormat({vAlign:'middle'})} style={{fontSize:13}} />
        <TBtn icon="↓≡" title="下揃え"   active={curFmt.vAlign==='bottom'} onClick={()=>applyFormat({vAlign:'bottom'})} style={{fontSize:10}} />
        <TSep/>

        {/* Wrap */}
        <TBtn icon="↵" title="テキスト折り返し" active={curFmt.wrap} onClick={()=>toggleFormat('wrap')} style={{fontSize:14}} />
        <TSep/>

        {/* Number format */}
        <TBtn icon="¥"   title="通貨"           active={curFmt.numFmt==='currency'} onClick={()=>applyFormat({numFmt:curFmt.numFmt==='currency'?'general':'currency'})} />
        <TBtn icon="%"   title="パーセント"      active={curFmt.numFmt==='percent'}  onClick={()=>applyFormat({numFmt:curFmt.numFmt==='percent'?'general':'percent'})} />
        <TBtn icon=".0"  title="整数"            active={curFmt.numFmt==='integer'}  onClick={()=>applyFormat({numFmt:curFmt.numFmt==='integer'?'general':'integer'})} style={{fontSize:10}} />
        <TBtn icon=".00" title="小数 2桁"        active={curFmt.numFmt==='number'}   onClick={()=>applyFormat({numFmt:curFmt.numFmt==='number'?'general':'number'})}   style={{fontSize:9}} />
        <TSep/>

        {/* ── Borders ── */}
        {/* Color */}
        <ColorPicker label="罫" title="線の色" value={borderColor} onChange={c=>setBorderColor(c||'#888888')} />
        {/* Thickness */}
        <TBtn icon="─" title="細線" active={borderWidth===2} onClick={()=>setBorderWidth(2)} style={{fontSize:13}} />
        <TBtn icon="━" title="太線" active={borderWidth===4} onClick={()=>setBorderWidth(4)} style={{fontSize:13}} />
        {/* Style */}
        <select value={borderLineStyle} onChange={e=>setBorderLineStyle(e.target.value as 'solid'|'dashed'|'dotted')}
          title="線の種類"
          style={{height:22,background:'#252528',border:'1px solid #3a3a42',color:'#c0c0cc',fontSize:11,borderRadius:3,cursor:'pointer',outline:'none',padding:'0 2px',flexShrink:0}}>
          <option value="solid">─ 実線</option>
          <option value="dashed">- - 破線</option>
          <option value="dotted">··· 点線</option>
        </select>
        {/* Type buttons — clicking active button removes that side's border */}
        {(()=>{
          const b=`${borderWidth}px ${borderLineStyle} ${borderColor}`
          const haT=!!curFmt.borders?.t, haB=!!curFmt.borders?.b
          const haL=!!curFmt.borders?.l, haR=!!curFmt.borders?.r
          return (<>
            <TBtn icon="⊞" title="全ての罫線"  onClick={()=>applyFormat({borders:{t:b,b:b,l:b,r:b}})} style={{fontSize:14}} />
            <TBtn icon="▣" title="外枠のみ"    onClick={()=>{
              const rng=selRange??(selAnchor?{r1:selAnchor.row,r2:selAnchor.row,c1:selAnchor.col,c2:selAnchor.col}:null)
              if(!rng) return
              const sid=activeSheetIdRef.current
              setFormats(prev=>{
                const next=new Map(prev)
                for(let r=rng.r1;r<=rng.r2;r++) for(let c=rng.c1;c<=rng.c2;c++){
                  const k=mkKey(sid,r,c)
                  next.set(k,{...(prev.get(k)??{}),borders:{
                    t:r===rng.r1?b:undefined,
                    b:r===rng.r2?b:undefined,
                    l:c===rng.c1?b:undefined,
                    r:c===rng.c2?b:undefined,
                  }})
                  dirtyKeys.current.add(k)
                }
                return next
              })
              scheduleSave()
            }} style={{fontSize:14}} />
            <TBtn icon="⊤" title={haT?'上罫線を削除':'上罫線'} active={haT} onClick={()=>applyFormat({borders:{...curFmt.borders,t:haT?undefined:b}})} style={{fontSize:14}} />
            <TBtn icon="⊥" title={haB?'下罫線を削除':'下罫線'} active={haB} onClick={()=>applyFormat({borders:{...curFmt.borders,b:haB?undefined:b}})} style={{fontSize:14}} />
            <TBtn icon="⊣" title={haL?'左罫線を削除':'左罫線'} active={haL} onClick={()=>applyFormat({borders:{...curFmt.borders,l:haL?undefined:b}})} style={{fontSize:11}} />
            <TBtn icon="⊢" title={haR?'右罫線を削除':'右罫線'} active={haR} onClick={()=>applyFormat({borders:{...curFmt.borders,r:haR?undefined:b}})} style={{fontSize:11}} />
            <TBtn icon="⊟" title="全罫線を削除" onClick={()=>applyFormat({borders:{}})} style={{fontSize:14,color:'#e06060'}} />
          </>)
        })()}
        <TSep/>

        {/* Clear format */}
        <TBtn icon="✕" title="書式をクリア" onClick={()=>{
          const rng=selRange??(selAnchor?{r1:selAnchor.row,r2:selAnchor.row,c1:selAnchor.col,c2:selAnchor.col}:null)
          if(!rng) return
          const sid=activeSheetIdRef.current
          setFormats(prev=>{const next=new Map(prev);for(let r=rng.r1;r<=rng.r2;r++)for(let c=rng.c1;c<=rng.c2;c++){next.delete(mkKey(sid,r,c));dirtyKeys.current.add(mkKey(sid,r,c))};return next})
          scheduleSave()
        }} style={{fontSize:10,color:'#888'}} />

        <div style={{flex:1}}/>
        {saving && <span style={{fontSize:11,color:'#5588cc',paddingRight:4}}>保存中...</span>}
      </div>

      {/* ── Formula bar ───────────────────────────────────────────────────── */}
      <div style={{display:'flex',alignItems:'center',height:28,flexShrink:0,background:'#2a2a2f',borderBottom:'1px solid #38383f'}}>
        {/* Name box */}
        <input data-namebox value={nameBoxVal}
          onFocus={()=>setNameBoxFocused(true)}
          onChange={e=>setNameBoxVal(e.target.value.toUpperCase())}
          onBlur={()=>{const addr=parseLabel(nameBoxVal);if(addr){setSelAnchor(addr);setSelFocus(null)};setNameBoxFocused(false)}}
          onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();const addr=parseLabel(nameBoxVal);if(addr){setSelAnchor(addr);setSelFocus(null)};setNameBoxFocused(false)}}}
          style={{width:72,height:'100%',border:'none',borderRight:'1px solid #38383f',background:'transparent',color:'#d0d0d8',fontSize:12,fontWeight:600,textAlign:'center',outline:'none',flexShrink:0}}
        />
        <span style={{padding:'0 8px',color:'#5588cc',fontSize:12,flexShrink:0,userSelect:'none',fontStyle:'italic'}}>fx</span>
        <div style={{width:1,height:18,background:'#38383f',flexShrink:0}}/>
        {/* Formula bar input */}
        <input data-fxbar
          value={editingCell ? editValue : (selAnchor ? getRaw(selAnchor.row, selAnchor.col) : '')}
          readOnly={!editingCell}
          onChange={e=>setEditValue(e.target.value)}
          onFocus={()=>{
            if(!editingCell&&selAnchor){
              setEditingCell(selAnchor);setEditValue(getRaw(selAnchor.row,selAnchor.col));setEditMode('append')
            }
          }}
          onKeyDown={e=>{
            if(e.key==='Enter'){e.preventDefault();commitEdit();setSelAnchor(p=>p?{...p,row:Math.min(numRows-1,p.row+1)}:p);setSelFocus(null)}
            if(e.key==='Escape'){e.preventDefault();setEditingCell(null)}
          }}
          style={{flex:1,height:'100%',border:'none',background:editingCell?'rgba(74,138,216,.05)':'transparent',color:'#d0d0d8',fontSize:13,outline:'none',padding:'0 8px',cursor:editingCell?'text':selAnchor?'pointer':'default'}}
          placeholder={selAnchor?undefined:'セルを選択...'}
        />
      </div>

      {/* ── Grid ──────────────────────────────────────────────────────────── */}
      <div style={{flex:1,overflow:'auto',position:'relative'}}>
        <table style={{borderCollapse:'collapse',tableLayout:'fixed'}}>
          <colgroup>
            <col style={{width:ROW_HDR_W}}/>
            {Array.from({length:numCols},(_,c)=><col key={c} style={{width:colWidths[c]??DEFAULT_COL_W}}/>)}
            <col style={{width:28}}/>
          </colgroup>

          {/* Column headers */}
          <thead>
            <tr style={{position:'sticky',top:0,zIndex:20}}>
              {/* Corner */}
              <th onClick={selectAll}
                style={{position:'sticky',left:0,top:0,zIndex:30,width:ROW_HDR_W,height:22,background:'#252528',borderTop:'1px solid #3a3a42',borderBottom:'1px solid #3a3a42',borderLeft:'1px solid #3a3a42',borderRight:'1px solid #3a3a42',cursor:'pointer',userSelect:'none'}}
              />
              {Array.from({length:numCols},(_,c)=>{
                const isSrc  = colDragSrc===c
                const isOver = colDragOver===c&&colDragSrc!==null&&colDragSrc!==c
                return (
                  <th key={c} data-col={String(c)}
                    onClick={e=>{if(colDragStarted.current)return;selectCol(c,e)}}
                    onMouseDown={e=>{if(e.button!==0)return;e.stopPropagation();colDragSrcRef.current=c;colDragOverRef.current=c;colDragStartX.current=e.clientX;colDragStarted.current=false}}
                    onContextMenu={e=>{e.preventDefault();setCtxMenu({x:e.clientX,y:e.clientY,kind:'col',col:c})}}
                    style={{position:'relative',width:colWidths[c]??DEFAULT_COL_W,height:22,background:isSrc?'#2a4060':isOver?'#3a5a7a':isColSel(c)?'#3a4a5a':'#252528',borderTop:'1px solid #3a3a42',borderBottom:'1px solid #3a3a42',borderRight:'1px solid #3a3a42',borderLeft:isOver?'2px solid #5599cc':'1px solid #3a3a42',color:isSrc||isColSel(c)?'#90b8f0':'#888898',fontSize:11,fontWeight:600,textAlign:'center',userSelect:'none',cursor:colDragSrc!==null?'grabbing':'grab',whiteSpace:'nowrap',overflow:'hidden',opacity:isSrc?0.5:1}}
                  >
                    {colLabel(c)}
                    <div onMouseDown={e=>{e.stopPropagation();startColResize(c,e)}} style={{position:'absolute',right:0,top:0,bottom:0,width:4,cursor:'col-resize',zIndex:2}}/>
                  </th>
                )
              })}
              <th onClick={()=>{setNumCols(n=>n+1);setColWidths(w=>[...w,DEFAULT_COL_W])}}
                style={{width:28,height:22,background:'#252528',border:'1px solid #3a3a42',color:'#555568',fontSize:14,textAlign:'center',cursor:'pointer',userSelect:'none'}}>+</th>
            </tr>
          </thead>

          <tbody>
            {Array.from({length:numRows},(_,r)=>{
              const rh      = rowHeights[r]??DEFAULT_ROW_H
              const isSrc   = rowDragSrc===r
              const isOver  = rowDragOver===r&&rowDragSrc!==null&&rowDragSrc!==r
              return (
                <tr key={r} data-row={String(r)}
                  style={{height:rh,opacity:isSrc?0.4:1,borderTop:isOver?'2px solid #5599cc':undefined}}
                >
                  {/* Row header — drag by mousedown anywhere on it */}
                  <td
                    onClick={e=>selectRow(r,e)}
                    onMouseDown={e=>{
                      if(e.button!==0) return
                      // Don't start drag if clicking resize handle area (bottom 4px)
                      const rect=(e.currentTarget as HTMLElement).getBoundingClientRect()
                      if(e.clientY>rect.bottom-4) return
                      rowDragSrcRef.current=r;rowDragOverRef.current=r
                      rowDragStartY.current=e.clientY;rowDragStarted.current=false
                    }}
                    onContextMenu={e=>{e.preventDefault();setCtxMenu({x:e.clientX,y:e.clientY,kind:'row',row:r})}}
                    style={{position:'sticky',left:0,zIndex:5,width:ROW_HDR_W,height:rh,background:isRowSel(r)?'#3a4a5a':'#252528',borderTop:'1px solid #3a3a42',borderBottom:'1px solid #3a3a42',borderLeft:'1px solid #3a3a42',borderRight:'1px solid #3a3a42',userSelect:'none',cursor:rowDragSrc!==null?'grabbing':'grab',boxSizing:'border-box',verticalAlign:'middle',padding:0}}
                  >
                    <span style={{display:'block',textAlign:'center',fontSize:11,color:isRowSel(r)?'#90b8f0':'#888898'}}>{r+1}</span>
                    <div onMouseDown={e=>startRowResize(r,e)} style={{position:'absolute',left:0,right:0,bottom:0,height:4,cursor:'row-resize',zIndex:2}}/>
                  </td>

                  {/* Data cells */}
                  {Array.from({length:numCols},(_,c)=>{
                    const isAnchor  = selAnchor?.row===r&&selAnchor?.col===c
                    const isSel     = inSel(r,c,selAnchor,selFocus)
                    const isEditing = editingCell?.row===r&&editingCell?.col===c
                    const isFillHl  = inFill(r,c)
                    const isCutHl   = inCut(r,c)
                    const display   = getDisplay(r,c)
                    const raw       = getRaw(r,c)
                    const fmt       = getFmt(r,c)
                    const isNum     = display!==''&&!isNaN(Number(display))

                    let bg=fmt.bg??'#1e1e24', outline='none', outOff=0
                    if(isEditing){outline='2px solid #4a8ad8';outOff=-2}
                    else if(isAnchor&&!selFocus){if(!fmt.bg)bg='rgba(74,138,216,.1)';outline='2px solid #4a8ad8';outOff=-2}
                    else if(isAnchor&&selFocus){outline='2px solid #4a8ad8';outOff=-2}
                    else if(isSel){if(!fmt.bg)bg='rgba(74,138,216,.15)';outline='1px solid rgba(74,138,216,.35)';outOff=-1}
                    if(isFillHl){outline='1.5px dashed #4a8ad8';outOff=-1}
                    if(isCutHl){outline='1.5px dashed #ffaa44';outOff=-1}

                    const textAlign = fmt.align ?? (isNum?'right':'left')
                    const vAlign    = fmt.vAlign ?? 'middle'

                    return (
                      <td key={c} data-cell={`${r}:${c}`}
                        style={{
                          position:'relative',
                          borderTop:    fmt.borders?.t ?? '1px solid #2e2e36',
                          borderBottom: fmt.borders?.b ?? '1px solid #2e2e36',
                          borderLeft:   fmt.borders?.l ?? '1px solid #2e2e36',
                          borderRight:  fmt.borders?.r ?? '1px solid #2e2e36',
                          height:rh, maxHeight:rh, boxSizing:'border-box',
                          fontSize:12,
                          fontWeight: fmt.bold   ? 700 : 400,
                          fontStyle:  fmt.italic ? 'italic' : 'normal',
                          textDecoration: fmt.strike ? 'line-through' : 'none',
                          color: isEditing ? '#d0d0d8' : (fmt.color ?? '#d0d0d8'),
                          textAlign,
                          verticalAlign: vAlign,
                          whiteSpace: fmt.wrap ? 'pre-wrap' : 'nowrap',
                          overflow:'hidden',
                          padding: isEditing ? 0 : '0 3px',
                          background: bg,
                          outline, outlineOffset: outOff,
                        }}
                        onClick={e=>handleCellClick(e,r,c)}
                        onMouseDown={e=>{
                          if(e.button!==0||e.shiftKey) return
                          isDragSelecting.current=true; document.body.style.userSelect='none'
                          setSelAnchor({row:r,col:c}); setSelFocus(null)
                        }}
                        onDoubleClick={e=>{
                          e.stopPropagation()
                          setSelAnchor({row:r,col:c}); setSelFocus(null)
                          setEditingCell({row:r,col:c}); setEditValue(raw); setEditMode('append')
                        }}
                        onContextMenu={e=>{e.preventDefault();setCtxMenu({x:e.clientX,y:e.clientY,kind:'cell'})}}
                      >
                        {isEditing ? (
                          <input ref={cellEditorRef} value={editValue}
                            onChange={e=>setEditValue(e.target.value)}
                            onKeyDown={e=>{
                              if(e.key==='Enter'){e.preventDefault();commitEdit();setSelAnchor({row:Math.min(numRows-1,r+1),col:c});setSelFocus(null)}
                              if(e.key==='Tab'){e.preventDefault();commitEdit();setSelAnchor({row:r,col:e.shiftKey?Math.max(0,c-1):Math.min(numCols-1,c+1)});setSelFocus(null)}
                              if(e.key==='Escape'){e.stopPropagation();setEditingCell(null)}
                            }}
                            onBlur={()=>{setTimeout(()=>{if(editingCellRef.current?.row===r&&editingCellRef.current?.col===c)commitEdit()},100)}}
                            style={{width:'100%',height:'100%',border:'none',background:'#252a2f',color:'#d0d0d8',fontSize:12,fontWeight:fmt.bold?700:400,fontStyle:fmt.italic?'italic':'normal',outline:'none',padding:'0 3px',boxSizing:'border-box',textAlign}}
                          />
                        ) : (
                          <>
                            <span style={{display:'block',overflow:'hidden',textOverflow:'ellipsis'}}>{display}</span>
                            {isAnchor&&!selFocus&&!editingCell&&(
                              <div style={{position:'absolute',bottom:-3,right:-3,width:7,height:7,background:'#4a8ad8',border:'1.5px solid #1e1e24',cursor:'crosshair',zIndex:10}}
                                onMouseDown={e=>{e.preventDefault();e.stopPropagation();setFillAnchor({row:r,col:c});document.body.style.cursor='crosshair';document.body.style.userSelect='none'}}
                              />
                            )}
                          </>
                        )}
                      </td>
                    )
                  })}
                  <td style={{border:'1px solid #2e2e36',borderTop:'none',borderLeft:'none',background:'#1a1a20'}}/>
                </tr>
              )
            })}
            <tr>
              <td colSpan={numCols+2} style={{borderTop:'1px solid #2e2e36',padding:'3px 8px',background:'#1a1a20'}}>
                <button onClick={()=>{setNumRows(n=>n+100);setRowHeights(h=>[...h,...Array(100).fill(DEFAULT_ROW_H)])}}
                  style={{border:'none',background:'transparent',color:'#555568',fontSize:11,cursor:'pointer'}}>+ 100行追加</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Sheet tabs ────────────────────────────────────────────────────── */}
      <div style={{height:30,flexShrink:0,background:'#252528',borderTop:'1px solid #3a3a42',display:'flex',alignItems:'stretch'}}>
        {sheets.map(s=>(
          <div key={s.id}
            style={{display:'flex',alignItems:'center',gap:4,padding:'0 12px',background:s.id===activeSheetId?'#1e1e24':'transparent',borderRight:'1px solid #3a3a42',color:s.id===activeSheetId?'#d0d0d8':'#666678',fontSize:12,cursor:'pointer',userSelect:'none',borderTop:`2px solid ${s.id===activeSheetId?'#4a8ad8':'transparent'}`}}
            onClick={()=>{setActiveSheetId(s.id);setSelAnchor(null);setSelFocus(null);setEditingCell(null)}}
            onDoubleClick={()=>{setRenamingId(s.id);setRenameVal(s.name)}}
          >
            {renamingId===s.id?(
              <input data-sheettab-rename autoFocus value={renameVal}
                onChange={e=>setRenameVal(e.target.value)}
                onBlur={()=>renameSheet(s.id,renameVal)}
                onKeyDown={e=>{if(e.key==='Enter')renameSheet(s.id,renameVal);if(e.key==='Escape')setRenamingId(null)}}
                style={{width:80,background:'#1e1e24',border:'1px solid #4a8ad8',color:'#d0d0d8',fontSize:12,outline:'none',padding:'0 4px'}}
              />
            ):s.name}
            {sheets.length>1&&(
              <span onClick={e=>{e.stopPropagation();deleteSheet(s.id)}} style={{fontSize:10,color:'#555568',marginLeft:2,opacity:.6}}>✕</span>
            )}
          </div>
        ))}
        <button onClick={addSheet} style={{padding:'0 14px',border:'none',background:'transparent',color:'#666678',fontSize:18,cursor:'pointer',lineHeight:1}}>+</button>
      </div>

      {/* ── Context menu ─────────────────────────────────────────────────── */}
      {ctxMenu&&(
        <div onClick={e=>e.stopPropagation()}
          style={{position:'fixed',top:ctxMenu.y,left:ctxMenu.x,zIndex:1000,background:'#2a2a32',border:'1px solid #3a3a48',borderRadius:4,boxShadow:'0 4px 16px rgba(0,0,0,.6)',minWidth:180,overflow:'hidden'}}>
          {ctxMenu.kind==='row'&&(<>
            <CtxItem label="上に行を挿入" onClick={()=>{insertRow(ctxMenu.row);setCtxMenu(null)}}/>
            <CtxItem label="下に行を挿入" onClick={()=>{insertRow(ctxMenu.row+1);setCtxMenu(null)}}/>
            <div style={{height:1,background:'#3a3a48',margin:'2px 0'}}/>
            <CtxItem label="行を削除"     onClick={()=>{deleteRow(ctxMenu.row);setCtxMenu(null)}} danger/>
          </>)}
          {ctxMenu.kind==='col'&&(<>
            <CtxItem label="左に列を挿入" onClick={()=>{insertCol(ctxMenu.col);setCtxMenu(null)}}/>
            <CtxItem label="右に列を挿入" onClick={()=>{insertCol(ctxMenu.col+1);setCtxMenu(null)}}/>
            <div style={{height:1,background:'#3a3a48',margin:'2px 0'}}/>
            <CtxItem label="列を削除"     onClick={()=>{deleteCol(ctxMenu.col);setCtxMenu(null)}} danger/>
            <div style={{height:1,background:'#3a3a48',margin:'2px 0'}}/>
            <CtxItem label="列幅をリセット" onClick={()=>{setColWidths(p=>{const n=[...p];n[ctxMenu.col]=DEFAULT_COL_W;return n});setCtxMenu(null)}}/>
          </>)}
          {ctxMenu.kind==='cell'&&(<>
            <CtxItem label="コピー"     onClick={()=>{
              const rng=selRange??(selAnchor?{r1:selAnchor.row,r2:selAnchor.row,c1:selAnchor.col,c2:selAnchor.col}:null);if(!rng)return
              const values=Array.from({length:rng.r2-rng.r1+1},(_,ri)=>Array.from({length:rng.c2-rng.c1+1},(_,ci)=>getRaw(rng.r1+ri,rng.c1+ci)))
              const fmts=Array.from({length:rng.r2-rng.r1+1},(_,ri)=>Array.from({length:rng.c2-rng.c1+1},(_,ci)=>{const f=getFmt(rng.r1+ri,rng.c1+ci);return Object.keys(f).length?f:undefined}))
              const tsv=values.map(r=>r.join('\t')).join('\n')
              copyBuffer.current={tsv,values,formats:fmts,isCut:false}
              navigator.clipboard.writeText(tsv).catch(()=>{});setCutSrc(null);setCtxMenu(null)
            }}/>
            <CtxItem label="切り取り"   onClick={()=>{
              const rng=selRange??(selAnchor?{r1:selAnchor.row,r2:selAnchor.row,c1:selAnchor.col,c2:selAnchor.col}:null);if(!rng||!selAnchor)return
              const values=Array.from({length:rng.r2-rng.r1+1},(_,ri)=>Array.from({length:rng.c2-rng.c1+1},(_,ci)=>getRaw(rng.r1+ri,rng.c1+ci)))
              const fmts=Array.from({length:rng.r2-rng.r1+1},(_,ri)=>Array.from({length:rng.c2-rng.c1+1},(_,ci)=>{const f=getFmt(rng.r1+ri,rng.c1+ci);return Object.keys(f).length?f:undefined}))
              const tsv=values.map(r=>r.join('\t')).join('\n')
              const cs={...rng,sid:activeSheetId}
              copyBuffer.current={tsv,values,formats:fmts,isCut:true,cutSrc:cs}
              navigator.clipboard.writeText(tsv).catch(()=>{});setCutSrc(cs);setCtxMenu(null)
            }}/>
            <CtxItem label="貼り付け"   onClick={()=>{
              navigator.clipboard.readText().then(text=>{
                if(!selAnchor)return
                const sid=activeSheetIdRef.current
                const buf=copyBuffer.current
                if(buf&&text===buf.tsv){
                  for(let ri=0;ri<buf.values.length;ri++)for(let ci=0;ci<buf.values[ri].length;ci++)setCellVal(selAnchor.row+ri,selAnchor.col+ci,buf.values[ri][ci])
                  setFormats(prev=>{
                    const next=new Map(prev)
                    for(let ri=0;ri<buf.formats.length;ri++)for(let ci=0;ci<buf.formats[ri].length;ci++){
                      const k=mkKey(sid,selAnchor.row+ri,selAnchor.col+ci)
                      const fmt=buf.formats[ri][ci]
                      if(fmt)next.set(k,{...fmt});else next.delete(k)
                      dirtyKeys.current.add(k)
                    }
                    return next
                  })
                  scheduleSaveRef.current()
                  if(buf.isCut&&buf.cutSrc){const cs=buf.cutSrc;for(let r=cs.r1;r<=cs.r2;r++)for(let c=cs.c1;c<=cs.c2;c++){setCellVal(r,c,'',cs.sid);const k=mkKey(cs.sid,r,c);setFormats(prev=>{const next=new Map(prev);next.delete(k);dirtyKeys.current.add(k);return next})};setCutSrc(null);copyBuffer.current=null}
                }else{
                  text.split('\n').forEach((l,ri)=>l.split('\t').forEach((v,ci)=>setCellVal(selAnchor.row+ri,selAnchor.col+ci,v)))
                }
              }).catch(()=>{});setCtxMenu(null)
            }}/>
            <div style={{height:1,background:'#3a3a48',margin:'2px 0'}}/>
            <CtxItem label="内容をクリア" onClick={()=>{const rng=selRange??(selAnchor?{r1:selAnchor.row,r2:selAnchor.row,c1:selAnchor.col,c2:selAnchor.col}:null);if(!rng)return;for(let r=rng.r1;r<=rng.r2;r++)for(let c=rng.c1;c<=rng.c2;c++)setCellVal(r,c,'');setCtxMenu(null)}} danger/>
            <CtxItem label="書式をクリア" onClick={()=>{const rng=selRange??(selAnchor?{r1:selAnchor.row,r2:selAnchor.row,c1:selAnchor.col,c2:selAnchor.col}:null);if(!rng)return;const sid=activeSheetIdRef.current;setFormats(p=>{const n=new Map(p);for(let r=rng.r1;r<=rng.r2;r++)for(let c=rng.c1;c<=rng.c2;c++){n.delete(mkKey(sid,r,c));dirtyKeys.current.add(mkKey(sid,r,c))};return n});scheduleSave();setCtxMenu(null)}}/>
            <div style={{height:1,background:'#3a3a48',margin:'2px 0'}}/>
            {selAnchor&&<>
              <CtxItem label="上に行を挿入" onClick={()=>{insertRow(selAnchor.row);setCtxMenu(null)}}/>
              <CtxItem label="下に行を挿入" onClick={()=>{insertRow(selAnchor.row+1);setCtxMenu(null)}}/>
              <CtxItem label="左に列を挿入" onClick={()=>{insertCol(selAnchor.col);setCtxMenu(null)}}/>
              <CtxItem label="右に列を挿入" onClick={()=>{insertCol(selAnchor.col+1);setCtxMenu(null)}}/>
            </>}
          </>)}
        </div>
      )}
    </div>
  )
}
