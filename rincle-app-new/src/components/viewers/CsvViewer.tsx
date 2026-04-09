'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { readTextFile, writeTextFile } from '@/lib/fs'

// ── CSV parse / serialize ───────────────────────────────────

function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ''; let q = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ } else if (c === '"') q = false; else cell += c }
    else { if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = '' } else if (c === '\n' || (c === '\r' && text[i + 1] === '\n')) { row.push(cell); cell = ''; rows.push(row); row = []; if (c === '\r') i++ } else cell += c }
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows
}

function toCsv(rows: string[][]): string {
  return rows.map(r => r.map(c => c.includes(',') || c.includes('"') || c.includes('\n') ? `"${c.replace(/"/g, '""')}"` : c).join(',')).join('\n')
}

// ── Component ───────────────────────────────────────────────

type Cell = { r: number; c: number }
type UndoEntry = { r: number; c: number; prev: string; next: string }

export default function CsvViewer({ rootHandle, filePath }: { rootHandle: FileSystemDirectoryHandle; filePath: string }) {
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])
  const [filters, setFilters] = useState<Record<number, string>>({})
  const [saving, setSaving] = useState(false)

  // selection
  const [selected, setSelected] = useState<Cell | null>(null)
  const [selFocus, setSelFocus] = useState<Cell | null>(null)
  const [editCell, setEditCell] = useState<Cell | null>(null)
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set())
  const [selectedCols, setSelectedCols] = useState<Set<number>>(new Set())

  // fill handle
  const [fillSrc, setFillSrc] = useState<Cell | null>(null)
  const [fillTarget, setFillTarget] = useState<number | null>(null)

  // column widths
  const [colWidths, setColWidths] = useState<number[]>([])

  // drag reorder
  const [draggingRow, setDraggingRow] = useState<number | null>(null)
  const [dragOverRow, setDragOverRow] = useState<number | null>(null)

  // context menu
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; colIdx: number } | null>(null)

  // find & replace
  const [showFind, setShowFind] = useState(false)
  const [findText, setFindText] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [findCount, setFindCount] = useState(0)

  // refs
  const dirtyRef = useRef(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const headersRef = useRef(headers); headersRef.current = headers
  const rowsRef = useRef(rows); rowsRef.current = rows
  const selectedRef = useRef(selected); selectedRef.current = selected
  const selFocusRef = useRef(selFocus); selFocusRef.current = selFocus
  const editCellRef = useRef(editCell); editCellRef.current = editCell
  const fillSrcRef = useRef(fillSrc); fillSrcRef.current = fillSrc
  const fillTargetRef = useRef(fillTarget); fillTargetRef.current = fillTarget
  const selectedRowsRef = useRef(selectedRows); selectedRowsRef.current = selectedRows
  const selectedColsRef = useRef(selectedCols); selectedColsRef.current = selectedCols
  const undoStack = useRef<UndoEntry[]>([])
  const redoStack = useRef<UndoEntry[]>([])
  const isDragSelecting = useRef(false)

  // ── Load ──

  useEffect(() => {
    readTextFile(rootHandle, filePath).then(text => {
      const parsed = parseCsv(text)
      if (parsed.length > 0) {
        setHeaders(parsed[0])
        const data = parsed.slice(1).filter(r => r.some(c => c.trim()))
        setRows(data)
        setColWidths(parsed[0].map(() => 150))
      }
    })
  }, [rootHandle, filePath])

  // ── Save ──

  const scheduleSave = useCallback(() => {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      if (!dirtyRef.current) return
      setSaving(true)
      await writeTextFile(rootHandle, filePath, toCsv([headersRef.current, ...rowsRef.current]))
      dirtyRef.current = false
      setSaving(false)
    }, 1000)
  }, [rootHandle, filePath])

  const markDirty = useCallback(() => { dirtyRef.current = true; scheduleSave() }, [scheduleSave])

  // ── Cell operations ──

  const applyCell = useCallback((r: number, c: number, val: string) => {
    setRows(prev => { const n = [...prev]; n[r] = [...n[r]]; n[r][c] = val; return n })
    markDirty()
  }, [markDirty])

  const updateCell = useCallback((r: number, c: number, val: string) => {
    const prev = rowsRef.current[r]?.[c] ?? ''
    if (prev === val) return
    undoStack.current.push({ r, c, prev, next: val })
    redoStack.current = []
    applyCell(r, c, val)
  }, [applyCell])

  // ── Row operations ──

  const addRowAfter = useCallback((rowIdx: number) => {
    setRows(prev => { const n = [...prev]; n.splice(rowIdx + 1, 0, new Array(headersRef.current.length).fill('')); return n })
    markDirty()
  }, [markDirty])

  const deleteRow = useCallback((rowIdx: number) => {
    setRows(prev => prev.filter((_, i) => i !== rowIdx))
    markDirty()
  }, [markDirty])

  const deleteSelectedRows = useCallback(() => {
    if (selectedRows.size === 0) return
    setRows(prev => prev.filter((_, i) => !selectedRows.has(i)))
    setSelectedRows(new Set())
    setSelected(null); setSelFocus(null)
    markDirty()
  }, [selectedRows, markDirty])

  const clearSelectedRows = useCallback(() => {
    if (selectedRows.size === 0) return
    setRows(prev => prev.map((r, i) => selectedRows.has(i) ? r.map(() => '') : r))
    markDirty()
  }, [selectedRows, markDirty])

  const clearSelectedCols = useCallback(() => {
    if (selectedCols.size === 0) return
    setRows(prev => prev.map(r => r.map((c, ci) => selectedCols.has(ci) ? '' : c)))
    markDirty()
  }, [selectedCols, markDirty])

  // ── Column operations ──

  const addColAfter = useCallback((colIdx: number) => {
    setHeaders(prev => { const n = [...prev]; n.splice(colIdx + 1, 0, '新規列'); return n })
    setRows(prev => prev.map(r => { const n = [...r]; n.splice(colIdx + 1, 0, ''); return n }))
    setColWidths(prev => { const n = [...prev]; n.splice(colIdx + 1, 0, 150); return n })
    setFilters({})
    markDirty()
  }, [markDirty])

  const deleteCol = useCallback((colIdx: number) => {
    if (headersRef.current.length <= 1) return
    setHeaders(prev => prev.filter((_, i) => i !== colIdx))
    setRows(prev => prev.map(r => r.filter((_, i) => i !== colIdx)))
    setColWidths(prev => prev.filter((_, i) => i !== colIdx))
    setFilters({})
    markDirty()
  }, [markDirty])

  const renameCol = useCallback((colIdx: number) => {
    const current = headersRef.current[colIdx]
    const name = prompt('列名を入力', current)
    if (name === null || name === current) return
    setHeaders(prev => { const n = [...prev]; n[colIdx] = name; return n })
    markDirty()
  }, [markDirty])

  // ── Find & Replace ──

  useEffect(() => {
    if (!findText) { setFindCount(0); return }
    const lower = findText.toLowerCase()
    let count = 0
    for (const r of rows) for (const c of r) if (c.toLowerCase().includes(lower)) count++
    setFindCount(count)
  }, [findText, rows])

  const doReplace = useCallback((all: boolean) => {
    if (!findText) return
    const lower = findText.toLowerCase()
    let replaced = false
    setRows(prev => {
      const n = prev.map(r => r.map(c => {
        if (c.toLowerCase().includes(lower)) {
          if (!all && replaced) return c
          replaced = true
          return c.replace(new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), all ? 'gi' : 'i'), replaceText)
        }
        return c
      }))
      return n
    })
    if (replaced) markDirty()
  }, [findText, replaceText, markDirty])

  // ── Filtered rows ──

  const filtered = useMemo(() => {
    return rows.map((r, i) => ({ row: r, idx: i })).filter(({ row }) => {
      for (const [ci, fv] of Object.entries(filters)) {
        if (fv && !String(row[Number(ci)] || '').toLowerCase().includes(fv.toLowerCase())) return false
      }
      return true
    })
  }, [rows, filters])
  const filteredRef = useRef(filtered); filteredRef.current = filtered

  // ── Selection range helpers ──

  const selRange = useMemo(() => {
    const set = new Set<string>()
    if (selected && selFocus) {
      const [ra, rb] = [Math.min(selected.r, selFocus.r), Math.max(selected.r, selFocus.r)]
      const [ca, cb] = [Math.min(selected.c, selFocus.c), Math.max(selected.c, selFocus.c)]
      for (let r = ra; r <= rb; r++) for (let c = ca; c <= cb; c++) set.add(`${r}:${c}`)
    }
    return set
  }, [selected, selFocus])

  const fillRangeSet = useMemo(() => {
    const set = new Set<number>()
    if (fillSrc && fillTarget !== null) {
      const [a, b] = [Math.min(fillSrc.r, fillTarget), Math.max(fillSrc.r, fillTarget)]
      for (let r = a; r <= b; r++) set.add(r)
    }
    return set
  }, [fillSrc, fillTarget])

  // ── Keyboard ──

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey
      const sc = selectedRef.current
      const ec = editCellRef.current

      // Find & Replace
      if (meta && e.key === 'h') {
        e.preventDefault()
        setShowFind(v => !v)
        return
      }

      // Undo / Redo
      if (meta && e.key === 'z' && !ec) {
        e.preventDefault()
        if (e.shiftKey) {
          const ent = redoStack.current.pop()
          if (ent) { undoStack.current.push(ent); applyCell(ent.r, ent.c, ent.next); setSelected({ r: ent.r, c: ent.c }); setSelFocus(null) }
        } else {
          const ent = undoStack.current.pop()
          if (ent) { redoStack.current.push(ent); applyCell(ent.r, ent.c, ent.prev); setSelected({ r: ent.r, c: ent.c }); setSelFocus(null) }
        }
        return
      }

      // Arrow keys
      if (sc && !ec && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault()
        const cur = filteredRef.current
        const fi = cur.findIndex(f => f.idx === sc.r)
        if (fi === -1) return
        let nr = fi, nc = sc.c
        if (e.key === 'ArrowUp') nr = Math.max(0, fi - 1)
        else if (e.key === 'ArrowDown') nr = Math.min(cur.length - 1, fi + 1)
        else if (e.key === 'ArrowLeft') nc = Math.max(0, sc.c - 1)
        else if (e.key === 'ArrowRight') nc = Math.min(headersRef.current.length - 1, sc.c + 1)
        const newRow = cur[nr]
        if (newRow) {
          setSelected({ r: newRow.idx, c: nc }); setSelFocus(null)
          requestAnimationFrame(() => {
            const el = document.querySelector(`[data-cellpos="${newRow.idx}:${nc}"]`)
            if (el) el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
          })
        }
        return
      }

      // Row/Col selection: Delete/Backspace → clear
      if ((e.key === 'Delete' || e.key === 'Backspace') && !meta && !ec) {
        if (selectedRowsRef.current.size > 0) { e.preventDefault(); clearSelectedRows(); return }
        if (selectedColsRef.current.size > 0) { e.preventDefault(); clearSelectedCols(); return }
      }

      if (!sc || ec) return

      // Printable character → start editing
      if (e.key.length === 1 && !meta && !e.altKey) {
        e.preventDefault()
        setEditCell({ r: sc.r, c: sc.c })
        requestAnimationFrame(() => {
          const inp = document.querySelector<HTMLInputElement>(`[data-cellinput="${sc.r}-${sc.c}"]`)
          if (inp) { inp.value = e.key; inp.setSelectionRange(1, 1) }
        })
        return
      }

      // Delete / Backspace
      if ((e.key === 'Delete' || e.key === 'Backspace') && !meta) {
        e.preventDefault()
        const sf = selFocusRef.current
        if (sf) {
          const [ra, rb] = [Math.min(sc.r, sf.r), Math.max(sc.r, sf.r)]
          const [ca, cb] = [Math.min(sc.c, sf.c), Math.max(sc.c, sf.c)]
          for (let r = ra; r <= rb; r++) for (let c = ca; c <= cb; c++) updateCell(r, c, '')
        } else { updateCell(sc.r, sc.c, '') }
        return
      }

      // Copy
      if (meta && e.key === 'c') {
        e.preventDefault()
        const sf = selFocusRef.current
        if (sf) {
          const [ra, rb] = [Math.min(sc.r, sf.r), Math.max(sc.r, sf.r)]
          const [ca, cb] = [Math.min(sc.c, sf.c), Math.max(sc.c, sf.c)]
          const tsv = Array.from({ length: rb - ra + 1 }, (_, ri) =>
            Array.from({ length: cb - ca + 1 }, (_, ci) => rowsRef.current[ra + ri]?.[ca + ci] ?? '').join('\t')
          ).join('\n')
          navigator.clipboard.writeText(tsv).catch(() => {})
        } else {
          navigator.clipboard.writeText(rowsRef.current[sc.r]?.[sc.c] ?? '').catch(() => {})
        }
        return
      }

      // Paste
      if (meta && e.key === 'v') {
        e.preventDefault()
        navigator.clipboard.readText().then(text => {
          const sc2 = selectedRef.current
          if (!sc2) return
          const lines = text.split('\n')
          if (lines.length <= 1 && !text.includes('\t')) { updateCell(sc2.r, sc2.c, text); return }
          lines.forEach((line, ri) => {
            line.split('\t').forEach((val, ci) => {
              const tr = sc2.r + ri, tc = sc2.c + ci
              if (tr < rowsRef.current.length && tc < headersRef.current.length) updateCell(tr, tc, val)
            })
          })
        }).catch(() => {})
        return
      }

      // Escape
      if (e.key === 'Escape') { setSelected(null); setEditCell(null); setSelFocus(null); setSelectedRows(new Set()); setSelectedCols(new Set()) }

      // Enter → edit
      if (e.key === 'Enter' && !meta) { e.preventDefault(); setEditCell({ r: sc.r, c: sc.c }) }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [applyCell, updateCell])

  // ── Edit cell focus ──

  useEffect(() => {
    if (!editCell) return
    const el = document.querySelector<HTMLInputElement>(`[data-cellinput="${editCell.r}-${editCell.c}"]`)
    if (el) { el.focus(); el.select() }
  }, [editCell])

  // ── Fill handle mouse ──

  useEffect(() => {
    if (!fillSrc) return
    document.body.style.cursor = 'crosshair'; document.body.style.userSelect = 'none'
    function onMove(e: MouseEvent) {
      const tr = (document.elementFromPoint(e.clientX, e.clientY) as Element | null)?.closest('tr[data-rowidx]')
      const idx = tr?.getAttribute('data-rowidx')
      if (idx !== null && idx !== undefined) setFillTarget(Number(idx))
    }
    function onUp() {
      const src = fillSrcRef.current; const tgt = fillTargetRef.current
      if (src && tgt !== null && src.r !== tgt) {
        const val = rowsRef.current[src.r]?.[src.c] ?? ''
        const [a, b] = [Math.min(src.r, tgt), Math.max(src.r, tgt)]
        for (let r = a; r <= b; r++) { if (r !== src.r) updateCell(r, src.c, val) }
      }
      setFillSrc(null); setFillTarget(null)
      document.body.style.cursor = ''; document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); document.body.style.cursor = ''; document.body.style.userSelect = '' }
  }, [fillSrc, updateCell])

  // ── Drag select mouse ──

  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!isDragSelecting.current) return
      const td = (document.elementFromPoint(e.clientX, e.clientY) as Element | null)?.closest('[data-cellpos]') as HTMLElement | null
      const pos = td?.getAttribute('data-cellpos')
      if (!pos) return
      const [r, c] = pos.split(':').map(Number)
      setSelFocus(prev => (prev?.r === r && prev?.c === c) ? prev : { r, c })
    }
    function onUp() { if (isDragSelecting.current) { isDragSelecting.current = false; document.body.style.userSelect = '' } }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  // ── Close context menu on click ──

  useEffect(() => {
    if (!ctxMenu) return
    const close = (e: MouseEvent) => {
      const menu = document.getElementById('csv-ctx-menu')
      if (menu && menu.contains(e.target as Node)) return
      setCtxMenu(null)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [ctxMenu])

  // ── Drag reorder ──

  const handleDragStart = useCallback((e: React.DragEvent, rowIdx: number) => { e.dataTransfer.effectAllowed = 'move'; setDraggingRow(rowIdx) }, [])
  const handleDragOver = useCallback((e: React.DragEvent, rowIdx: number) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (rowIdx !== draggingRow) setDragOverRow(rowIdx) }, [draggingRow])
  const handleDrop = useCallback((e: React.DragEvent, targetIdx: number) => {
    e.preventDefault(); setDragOverRow(null); setDraggingRow(null)
    if (draggingRow === null || draggingRow === targetIdx) return
    setRows(prev => { const n = [...prev]; const [moved] = n.splice(draggingRow, 1); n.splice(draggingRow < targetIdx ? targetIdx - 1 : targetIdx, 0, moved); return n })
    markDirty()
  }, [draggingRow, markDirty])
  const handleDragEnd = useCallback(() => { setDraggingRow(null); setDragOverRow(null) }, [])

  // ── Column resize ──

  const startResize = useCallback((colIdx: number, e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX; const startW = colWidths[colIdx] || 150
    const onMove = (me: MouseEvent) => setColWidths(prev => { const n = [...prev]; n[colIdx] = Math.max(50, startW + me.clientX - startX); return n })
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove); window.addEventListener('mouseup', onUp)
  }, [colWidths])

  // ── Cell click helpers ──

  const onCellClick = useCallback((e: React.MouseEvent, r: number, c: number) => {
    e.stopPropagation()
    if (e.shiftKey && selected) { setSelFocus({ r, c }) } else { setSelected({ r, c }); setSelFocus(null) }
    setSelectedRows(new Set()); setSelectedCols(new Set())
  }, [selected])

  const onCellDbl = useCallback((r: number, c: number) => { setSelected({ r, c }); setSelFocus(null); setEditCell({ r, c }) }, [])

  const onCellMouseDown = useCallback((e: React.MouseEvent, r: number, c: number) => {
    if (e.button !== 0 || e.shiftKey) return
    isDragSelecting.current = true; document.body.style.userSelect = 'none'
    setSelected({ r, c }); setSelFocus(null)
  }, [])

  // ── Row select (# click) ──

  const lastRowClick = useRef<number | null>(null)

  const onRowNumClick = useCallback((e: React.MouseEvent, rowIdx: number) => {
    e.stopPropagation()
    if (e.shiftKey && lastRowClick.current !== null) {
      // Shift+click: select range between last clicked and current
      const [a, b] = [Math.min(lastRowClick.current, rowIdx), Math.max(lastRowClick.current, rowIdx)]
      setSelectedRows(prev => {
        const n = new Set(prev)
        for (let i = a; i <= b; i++) n.add(i)
        return n
      })
    } else if (e.metaKey || e.ctrlKey) {
      // Cmd/Ctrl+click: toggle individual row
      setSelectedRows(prev => { const n = new Set(prev); if (n.has(rowIdx)) n.delete(rowIdx); else n.add(rowIdx); return n })
      lastRowClick.current = rowIdx
    } else {
      // Plain click: select single row
      setSelectedRows(new Set([rowIdx]))
      lastRowClick.current = rowIdx
    }
    setSelected(null); setSelFocus(null); setEditCell(null); setSelectedCols(new Set())
  }, [])

  // ── Column select (header click) ──

  const lastColClick = useRef<number | null>(null)

  const onHeaderClick = useCallback((e: React.MouseEvent, colIdx: number) => {
    e.stopPropagation()
    if (e.shiftKey && lastColClick.current !== null) {
      const [a, b] = [Math.min(lastColClick.current, colIdx), Math.max(lastColClick.current, colIdx)]
      setSelectedCols(prev => { const n = new Set(prev); for (let i = a; i <= b; i++) n.add(i); return n })
    } else if (e.metaKey || e.ctrlKey) {
      setSelectedCols(prev => { const n = new Set(prev); if (n.has(colIdx)) n.delete(colIdx); else n.add(colIdx); return n })
      lastColClick.current = colIdx
    } else {
      setSelectedCols(new Set([colIdx]))
      lastColClick.current = colIdx
    }
    setSelected(null); setSelFocus(null); setEditCell(null); setSelectedRows(new Set())
  }, [])

  // ── Header right-click ──

  const onHeaderContext = useCallback((e: React.MouseEvent, colIdx: number) => {
    e.preventDefault(); e.stopPropagation()
    setCtxMenu({ x: e.clientX, y: e.clientY, colIdx })
  }, [])

  // ── Render helpers ──

  const isSel = (r: number, c: number) => selected?.r === r && selected?.c === c
  const isEdit = (r: number, c: number) => editCell?.r === r && editCell?.c === c
  const inRange = (r: number, c: number) => selRange.has(`${r}:${c}`)
  const inFill = (r: number, c: number) => fillSrc?.c === c && fillRangeSet.has(r) && r !== fillSrc?.r

  const hlStyle = (r: number, c: number): React.CSSProperties => {
    if (isEdit(r, c)) return {}
    if (isSel(r, c)) return { outline: '2px solid #007acc', outlineOffset: -2, background: 'rgba(0,122,204,.12)' }
    if (selFocus && inRange(r, c)) return { background: 'rgba(0,122,204,.15)', outline: '1px solid rgba(0,122,204,.35)', outlineOffset: -1 }
    if (selectedCols.has(c)) return { background: 'rgba(0,122,204,.1)' }
    return {}
  }

  const fillHlStyle = (r: number, c: number): React.CSSProperties =>
    inFill(r, c) ? { background: 'rgba(0,122,204,.12)', outline: '1.5px dashed #007acc', outlineOffset: -1 } : {}

  // ── Find highlight ──
  const findLower = findText.toLowerCase()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={{ background: '#2a2a2f', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #3c3c3c', flexShrink: 0 }}>
        <span style={{ fontSize: 11, color: '#888' }}>{filtered.length} / {rows.length} 行</span>
        {saving && <span style={{ fontSize: 11, color: '#5588cc' }}>保存中...</span>}
        {selectedRows.size > 0 && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button onClick={clearSelectedRows} style={toolBtnStyle}>{selectedRows.size}行をクリア</button>
            <button onClick={deleteSelectedRows} style={{ ...toolBtnStyle, background: '#5a1d1d', color: '#f48771', borderColor: '#ea4335' }}>{selectedRows.size}行を削除</button>
          </div>
        )}
        {selectedCols.size > 0 && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button onClick={clearSelectedCols} style={toolBtnStyle}>{selectedCols.size}列をクリア</button>
          </div>
        )}
      </div>

      {/* Find & Replace bar */}
      {showFind && (
        <div style={{ background: '#252528', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #3c3c3c', flexShrink: 0 }}>
          <input value={findText} onChange={e => setFindText(e.target.value)} placeholder="検索..." autoFocus
            style={{ padding: '4px 8px', border: '1px solid #444', borderRadius: 3, fontSize: 12, outline: 'none', background: '#3c3c3c', color: '#d0d0d8', width: 180 }} />
          <input value={replaceText} onChange={e => setReplaceText(e.target.value)} placeholder="置換..."
            style={{ padding: '4px 8px', border: '1px solid #444', borderRadius: 3, fontSize: 12, outline: 'none', background: '#3c3c3c', color: '#d0d0d8', width: 180 }} />
          <button onClick={() => doReplace(false)} style={findBtnStyle}>置換</button>
          <button onClick={() => doReplace(true)} style={findBtnStyle}>全て置換</button>
          <span style={{ fontSize: 11, color: '#888' }}>{findCount} 件</span>
          <button onClick={() => { setShowFind(false); setFindText('') }} style={{ ...findBtnStyle, marginLeft: 'auto' }}>×</button>
        </div>
      )}

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto' }} onClick={() => { setSelected(null); setSelFocus(null); setEditCell(null); setSelectedRows(new Set()); setSelectedCols(new Set()) }}>
        <table style={{ borderCollapse: 'collapse', width: 'max-content', minWidth: '100%', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 44 }} />
            {headers.map((_, i) => <col key={i} style={{ width: colWidths[i] || 150 }} />)}


          </colgroup>
          <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
            <tr>
              <th style={{ ...thStyle, width: 44 }}>#</th>
              {headers.map((h, i) => (
                <th key={i} onClick={e => onHeaderClick(e, i)} style={{ ...thStyle, position: 'relative', cursor: 'pointer', background: selectedCols.has(i) ? 'rgba(0,122,204,.25)' : '#252528', color: selectedCols.has(i) ? '#4fc1ff' : '#9090a8' }} onContextMenu={e => onHeaderContext(e, i)}>
                  {h}
                  <div onMouseDown={e => startResize(i, e)} style={resizerStyle} />
                </th>
              ))}


            </tr>
            <tr>
              <th style={thFilterStyle} />
              {headers.map((_, i) => (
                <th key={i} style={thFilterStyle}>
                  <input value={filters[i] || ''} onChange={e => setFilters(prev => ({ ...prev, [i]: e.target.value }))} placeholder={headers[i]} style={filterInputStyle} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(({ row, idx }) => {
              const rowSelected = selectedRows.has(idx)
              return (
                <tr key={idx} data-rowidx={idx}
                  onDragOver={e => handleDragOver(e, idx)} onDrop={e => handleDrop(e, idx)} onDragLeave={() => setDragOverRow(null)}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,.05)',
                    opacity: draggingRow === idx ? 0.4 : 1,
                    borderTop: dragOverRow === idx ? '2px solid #007acc' : undefined,
                    background: rowSelected ? 'rgba(0,122,204,.18)' : undefined,
                  }}
                  onMouseEnter={e => { if (draggingRow === null && !rowSelected) e.currentTarget.style.background = '#2a2d2e' }}
                  onMouseLeave={e => { if (!rowSelected) e.currentTarget.style.background = '' }}
                >
                  {/* # drag handle + row select */}
                  <td
                    draggable
                    onDragStart={e => handleDragStart(e, idx)}
                    onDragEnd={handleDragEnd}
                    onClick={e => onRowNumClick(e, idx)}
                    onDoubleClick={e => { e.preventDefault(); e.stopPropagation(); addRowAfter(idx) }}
                    onMouseDown={e => { if (e.detail > 1) e.preventDefault() }}
                    style={{ ...tdStyle, textAlign: 'center', color: rowSelected ? '#4fc1ff' : '#555', fontSize: 11, cursor: 'grab', userSelect: 'none', fontWeight: rowSelected ? 700 : 400 }}
                    title="ダブルクリックで下に行追加"
                  >{idx + 1}</td>

                  {/* Data cells */}
                  {row.map((cell, ci) => (
                    <td
                      key={ci}
                      data-cellpos={`${idx}:${ci}`}
                      onClick={e => { e.stopPropagation(); onCellClick(e, idx, ci) }}
                      onMouseDown={e => { e.stopPropagation(); onCellMouseDown(e, idx, ci) }}
                      onDoubleClick={e => { e.stopPropagation(); onCellDbl(idx, ci) }}
                      style={{ ...tdStyle, cursor: 'cell', position: 'relative', ...hlStyle(idx, ci), ...fillHlStyle(idx, ci) }}
                    >
                      {isEdit(idx, ci) ? (
                        <input
                          data-cellinput={`${idx}-${ci}`}
                          autoFocus defaultValue={cell}
                          onBlur={e => { updateCell(idx, ci, e.target.value); setEditCell(null) }}
                          onKeyDown={e => {
                            if (e.key === 'Enter') { updateCell(idx, ci, (e.target as HTMLInputElement).value); setEditCell(null) }
                            if (e.key === 'Escape') setEditCell(null)
                            if (e.key === 'Tab') { e.preventDefault(); updateCell(idx, ci, (e.target as HTMLInputElement).value); setEditCell(null); const nc = e.shiftKey ? Math.max(0, ci - 1) : Math.min(headersRef.current.length - 1, ci + 1); setSelected({ r: idx, c: nc }) }
                          }}
                          onClick={e => e.stopPropagation()}
                          style={{ width: '100%', background: '#1e1e1e', border: 'none', color: '#d0d0d8', fontSize: 13, outline: 'none', padding: 0, margin: 0 }}
                        />
                      ) : (
                        <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {showFind && findLower && cell.toLowerCase().includes(findLower)
                            ? highlightText(cell, findText)
                            : cell}
                        </span>
                      )}
                      {isSel(idx, ci) && !isEdit(idx, ci) && !selFocus && (
                        <div style={{ position: 'absolute', bottom: -3, right: -3, width: 7, height: 7, background: '#007acc', border: '1.5px solid #fff', cursor: 'crosshair', zIndex: 10 }}
                          onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setFillSrc({ r: idx, c: ci }) }} />
                      )}
                    </td>
                  ))}



                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={headers.length + 1} style={{ padding: 24, textAlign: 'center', color: '#555', fontSize: 12 }}>表示する行がありません</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Column context menu */}
      {ctxMenu && (
        <div id="csv-ctx-menu" style={{ position: 'fixed', left: ctxMenu.x, top: ctxMenu.y, background: '#2d2d30', border: '1px solid #454545', borderRadius: 4, boxShadow: '0 4px 12px rgba(0,0,0,.5)', zIndex: 100, minWidth: 160, padding: '4px 0' }}>
          <div onClick={() => { renameCol(ctxMenu.colIdx); setCtxMenu(null) }} style={menuItemStyle}>列名を変更</div>
          <div onClick={() => { addColAfter(ctxMenu.colIdx); setCtxMenu(null) }} style={menuItemStyle}>右に列を追加</div>
          <div style={{ borderTop: '1px solid #454545', margin: '4px 0' }} />
          <div onClick={() => { deleteCol(ctxMenu.colIdx); setCtxMenu(null) }} style={{ ...menuItemStyle, color: '#f48771' }}>列を削除</div>
        </div>
      )}
    </div>
  )
}

// ── Highlight helper ──

function highlightText(text: string, find: string) {
  const parts: React.ReactNode[] = []
  const lower = text.toLowerCase(); const fl = find.toLowerCase()
  let last = 0
  while (true) {
    const idx = lower.indexOf(fl, last)
    if (idx === -1) { parts.push(text.slice(last)); break }
    if (idx > last) parts.push(text.slice(last, idx))
    parts.push(<mark key={idx} style={{ background: '#613214', color: '#f0c674', borderRadius: 2, padding: '0 1px' }}>{text.slice(idx, idx + find.length)}</mark>)
    last = idx + find.length
  }
  return <>{parts}</>
}

// ── Styles ──────────────────────────────────────────────────

const thStyle: React.CSSProperties = {
  background: '#252528', color: '#9090a8', padding: '7px 10px',
  textAlign: 'left', fontSize: 12, fontWeight: 700,
  borderRight: '1px solid rgba(255,255,255,.06)', whiteSpace: 'nowrap',
  overflow: 'hidden', textOverflow: 'ellipsis', userSelect: 'none',
}
const thFilterStyle: React.CSSProperties = { background: '#2e2e34', padding: '3px 5px', borderRight: '1px solid #3c3c3c' }
const filterInputStyle: React.CSSProperties = { width: '100%', border: '1px solid #444', borderRadius: 3, padding: '3px 6px', fontSize: 11, outline: 'none', background: '#3c3c3c', color: '#b8b8c8' }
const tdStyle: React.CSSProperties = { padding: '5px 10px', verticalAlign: 'top', borderRight: '1px solid rgba(255,255,255,.04)', color: '#c0c0cc', lineHeight: 1.5, fontSize: 13 }
const resizerStyle: React.CSSProperties = { position: 'absolute', right: 0, top: 0, width: 5, height: '100%', cursor: 'col-resize', userSelect: 'none', zIndex: 1 }
const menuItemStyle: React.CSSProperties = { padding: '6px 16px', fontSize: 12, color: '#cccccc', cursor: 'pointer' }
const findBtnStyle: React.CSSProperties = { padding: '3px 10px', background: '#0e639c', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: 11 }
const toolBtnStyle: React.CSSProperties = { padding: '3px 10px', background: '#2d2d30', color: '#cccccc', border: '1px solid #454545', borderRadius: 4, cursor: 'pointer', fontSize: 11 }
