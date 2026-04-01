'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

type Row = {
  id: string
  sort_order: number
  no: string
  status: string
  name: string
  timing: string
  recipient: string
  subject: string
  body: string
}

type Config = {
  from: string
  sender: string
  footer: string
}

const STATUSES = ['協議中', '確定', '実装済', '不要'] as const
const RECIPIENTS = ['ユーザー', '店舗', '管理者'] as const

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  '協議中': { bg: '#3a1a1a', color: '#ff8a80' },
  '確定':   { bg: '#1a2e40', color: '#64b5f6' },
  '実装済': { bg: '#1a3a1a', color: '#81c784' },
  '不要':   { bg: '#252528', color: '#888898' },
}

const RCPT_STYLE: Record<string, { bg: string; color: string }> = {
  'ユーザー': { bg: '#1a2e40', color: '#64b5f6' },
  '店舗':     { bg: '#1a3a1a', color: '#81c784' },
  '管理者':   { bg: '#3a2a10', color: '#ffb74d' },
}

const COL_KEYS = ['no', 'status', 'name', 'timing', 'recipient', 'subject', 'body'] as const
type ColKey = typeof COL_KEYS[number]

const COL_LABELS: Record<ColKey, string> = {
  no: 'No', status: '進捗', name: 'メール', timing: '送付タイミング',
  recipient: '誰に送るか', subject: '件名', body: '文書',
}

const COL_PLACEHOLDERS: Record<ColKey, string> = {
  no: 'No', status: '進捗', name: 'メール', timing: 'タイミング',
  recipient: '宛先', subject: '件名', body: '文書',
}

const INIT_WIDTHS: Record<ColKey, number> = {
  no: 44, status: 90, name: 160, timing: 160,
  recipient: 100, subject: 260, body: 420,
}

const DEFAULT_CONFIG: Config = {
  from: 'no-reply@rincle.co.jp',
  sender: 'RINCLE（リンクル）',
  footer: `もし本メールに心当たりがない場合は、メールにてお問い合わせをお願いいたします。\n\n--------\nこのメールは送信専用のため、ご返信いただいてもお答えできませんのでご了承ください。\nまた、このメールに心当たりがない場合は、下記までご連絡ください。\n\n────────────────────\nRINCLE（リンクル）スポーツバイクレンタル\nno-reply@rincle.co.jp\nhttps://rincle.co.jp`,
}

// col-filter select の index → ColKey のマッピング
const COL_FILTER_OPTIONS: { label: string; key: ColKey }[] = [
  { label: 'メール名', key: 'name' },
  { label: '送付タイミング', key: 'timing' },
  { label: '件名', key: 'subject' },
  { label: '文書', key: 'body' },
]

export default function EmailsTab() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [configSaving, setConfigSaving] = useState(false)
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG)
  const [configExpanded, setConfigExpanded] = useState(true)
  const [search, setSearch] = useState('')
  const [colFilterKey, setColFilterKey] = useState<ColKey | ''>('')
  const [rcptFilter, setRcptFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [colFilters, setColFilters] = useState<Record<ColKey, string>>({
    no: '', status: '', name: '', timing: '', recipient: '', subject: '', body: ''
  })
  const [colWidths, setColWidths] = useState<Record<ColKey, number>>({ ...INIT_WIDTHS })
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [selectedCell, setSelectedCell] = useState<{ rowId: string; col: string } | null>(null)
  const [editingCell, setEditingCell] = useState<{ rowId: string; col: string } | null>(null)
  const [selFocus, setSelFocus] = useState<{ rowId: string; col: string } | null>(null)
  const [fillSrc, setFillSrc] = useState<{ rowId: string; col: string } | null>(null)
  const [fillTarget, setFillTarget] = useState<string | null>(null)

  const dragSrcId        = useRef<string | null>(null)
  const dragHandleActive = useRef(false)
  const dirtyRows = useRef<Map<string, Row>>(new Map())
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const cfgTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const supabase = useRef(createClient()).current
  const rowsRef = useRef(rows)
  rowsRef.current = rows
  const filteredRef = useRef<Row[]>([])
  const fillSrcRef = useRef(fillSrc)
  fillSrcRef.current = fillSrc
  const fillTargetRef = useRef(fillTarget)
  fillTargetRef.current = fillTarget
  const selectedCellRef = useRef(selectedCell)
  selectedCellRef.current = selectedCell
  const editingCellRef = useRef(editingCell)
  editingCellRef.current = editingCell
  const selFocusRef = useRef(selFocus)
  selFocusRef.current = selFocus
  const undoStack = useRef<{ rowId: string; col: keyof Row; prev: string; next: string }[]>([])
  const redoStack = useRef<{ rowId: string; col: keyof Row; prev: string; next: string }[]>([])
  const isDragSelecting = useRef(false)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const isMeta = e.metaKey || e.ctrlKey
      const sc = selectedCellRef.current
      const ec = editingCellRef.current
      const sf = selFocusRef.current
      if (isMeta && e.key === 'z' && !ec) {
        e.preventDefault()
        if (e.shiftKey) {
          const entry = redoStack.current.pop()
          if (entry) { undoStack.current.push(entry); applyCell(entry.rowId, entry.col, entry.next); setSelectedCell({ rowId: entry.rowId, col: entry.col }); setSelFocus(null) }
        } else {
          const entry = undoStack.current.pop()
          if (entry) { redoStack.current.push(entry); applyCell(entry.rowId, entry.col, entry.prev); setSelectedCell({ rowId: entry.rowId, col: entry.col }); setSelFocus(null) }
        }
        return
      }
      if (sc && !ec && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault()
        const cur = filteredRef.current
        const ri = cur.findIndex(r => r.id === sc.rowId)
        const ci = COL_KEYS.indexOf(sc.col as ColKey)
        if (ri !== -1 && ci !== -1) {
          let nr = ri, nc = ci
          if (e.key === 'ArrowUp') nr = Math.max(0, ri - 1)
          else if (e.key === 'ArrowDown') nr = Math.min(cur.length - 1, ri + 1)
          else if (e.key === 'ArrowLeft') nc = Math.max(0, ci - 1)
          else if (e.key === 'ArrowRight') nc = Math.min(COL_KEYS.length - 1, ci + 1)
          const newRow = cur[nr]; const newCol = COL_KEYS[nc]
          if (newRow && newCol) { setSelectedCell({ rowId: newRow.id, col: newCol }); setSelFocus(null) }
        }
        return
      }
      if (!sc || ec) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isMeta) {
        e.preventDefault()
        const CLEARABLE = new Set<ColKey>(['no', 'name', 'timing', 'subject', 'body'])
        if (sf) {
          const cur = filteredRef.current
          const si = cur.findIndex(r => r.id === sc.rowId)
          const fi = cur.findIndex(r => r.id === sf.rowId)
          const ci = COL_KEYS.indexOf(sc.col as ColKey)
          const fci = COL_KEYS.indexOf(sf.col as ColKey)
          if (si !== -1 && fi !== -1 && ci !== -1 && fci !== -1) {
            const [ra, rb] = [Math.min(si, fi), Math.max(si, fi)]
            const [ca, cb] = [Math.min(ci, fci), Math.max(ci, fci)]
            cur.slice(ra, rb + 1).forEach(r => COL_KEYS.slice(ca, cb + 1).filter(k => CLEARABLE.has(k)).forEach(k => updateCell(r.id, k as keyof Row, '')))
          }
        } else if (CLEARABLE.has(sc.col as ColKey)) {
          updateCell(sc.rowId, sc.col as keyof Row, '')
        }
        return
      }
      if (isMeta && e.key === 'c') {
        e.preventDefault()
        if (sf) {
          const cur = filteredRef.current
          const si = cur.findIndex(r => r.id === sc.rowId)
          const fi = cur.findIndex(r => r.id === sf.rowId)
          const ci = COL_KEYS.indexOf(sc.col as ColKey)
          const fci = COL_KEYS.indexOf(sf.col as ColKey)
          if (si !== -1 && fi !== -1 && ci !== -1 && fci !== -1) {
            const [ra, rb] = [Math.min(si, fi), Math.max(si, fi)]
            const [ca, cb] = [Math.min(ci, fci), Math.max(ci, fci)]
            const cols = COL_KEYS.slice(ca, cb + 1)
            const tsv = cur.slice(ra, rb + 1).map(r => cols.map(k => String(r[k as keyof Row] ?? '')).join('\t')).join('\n')
            navigator.clipboard.writeText(tsv).catch(() => {})
          }
        } else {
          const row = rowsRef.current.find(r => r.id === sc.rowId)
          if (row) navigator.clipboard.writeText(String(row[sc.col as keyof Row] ?? '')).catch(() => {})
        }
      }
      if (isMeta && e.key === 'v') {
        e.preventDefault()
        navigator.clipboard.readText().then(text => {
          const sc2 = selectedCellRef.current
          if (!sc2) return
          const lines = text.split('\n').filter(l => l !== '' || text.includes('\n'))
          if (lines.length <= 1 && !text.includes('\t')) {
            updateCell(sc2.rowId, sc2.col as keyof Row, text)
            return
          }
          const cur = filteredRef.current
          const startRi = cur.findIndex(r => r.id === sc2.rowId)
          const startCi = COL_KEYS.indexOf(sc2.col as ColKey)
          if (startRi === -1 || startCi === -1) return
          text.split('\n').forEach((line, ri) => {
            const row = cur[startRi + ri]
            if (!row) return
            line.split('\t').forEach((val, ci) => {
              const col = COL_KEYS[startCi + ci]
              if (col) updateCell(row.id, col as keyof Row, val)
            })
          })
        }).catch(() => {})
      }
      if (e.key === 'Escape') { setSelectedCell(null); setEditingCell(null); setSelFocus(null) }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!editingCell) return
    const el = document.querySelector<HTMLElement>(`[data-cell="${editingCell.rowId}-${editingCell.col}"]`)
    if (!el) return
    el.focus()
    const range = document.createRange()
    range.selectNodeContents(el)
    range.collapse(false)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
  }, [editingCell])

  useEffect(() => {
    supabase.from('emails').select('*').order('sort_order').then(({ data }) => {
      setRows(data || [])
      setLoading(false)
    })
    supabase.from('email_config').select('*').eq('id', 1).single().then(({ data }) => {
      if (data) setConfig({ from: data.from_address, sender: data.sender_name, footer: data.footer })
    })
  }, [])

  const scheduleSave = useCallback(() => {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      const toSave = [...dirtyRows.current.values()]
      dirtyRows.current.clear()
      if (toSave.length === 0) return
      setSaving(true)
      await supabase.from('emails').upsert(toSave)
      setSaving(false)
    }, 800)
  }, [supabase])

  useEffect(() => {
    if (!fillSrc) return
    document.body.style.cursor = 'crosshair'
    document.body.style.userSelect = 'none'
    function onMouseMove(e: MouseEvent) {
      const tr = (document.elementFromPoint(e.clientX, e.clientY) as Element | null)?.closest('tr[data-row-id]')
      const id = (tr as HTMLElement | null)?.getAttribute('data-row-id')
      if (id) setFillTarget(id)
    }
    function onMouseUp() {
      const src = fillSrcRef.current; const tgt = fillTargetRef.current
      if (src && tgt && src.rowId !== tgt) applyFill(src.rowId, src.col as keyof Row, tgt)
      setFillSrc(null); setFillTarget(null)
      document.body.style.cursor = ''; document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      document.body.style.cursor = ''; document.body.style.userSelect = ''
    }
  }, [fillSrc]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!isDragSelecting.current) return
      const el = document.elementFromPoint(e.clientX, e.clientY)
      const td = (el as Element | null)?.closest('[data-cell]') as HTMLElement | null
      const cellAttr = td?.getAttribute('data-cell')
      if (!cellAttr || cellAttr.length < 38) return
      const rowId = cellAttr.slice(0, 36)
      const col = cellAttr.slice(37)
      setSelFocus(prev => prev?.rowId === rowId && prev?.col === col ? prev : { rowId, col })
    }
    function onMouseUp() {
      if (isDragSelecting.current) {
        isDragSelecting.current = false
        document.body.style.userSelect = ''
      }
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function applyFill(srcRowId: string, col: keyof Row, targetRowId: string) {
    const srcRow = rowsRef.current.find(r => r.id === srcRowId)
    if (!srcRow) return
    const val = String(srcRow[col] ?? '')
    const cur = filteredRef.current
    const si = cur.findIndex(r => r.id === srcRowId)
    const ti = cur.findIndex(r => r.id === targetRowId)
    if (si === -1 || ti === -1) return
    const [a, b] = [Math.min(si, ti), Math.max(si, ti)]
    cur.slice(a, b + 1).filter(r => r.id !== srcRowId).forEach(r => updateCell(r.id, col, val))
  }

  function applyCell(id: string, col: keyof Row, val: string) {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r
      const newRow = { ...r, [col]: val }
      dirtyRows.current.set(id, newRow)
      return newRow
    }))
    scheduleSave()
  }

  function updateCell(id: string, col: keyof Row, val: string) {
    const prevVal = String(rowsRef.current.find(r => r.id === id)?.[col] ?? '')
    if (prevVal === val) return
    undoStack.current.push({ rowId: id, col, prev: prevVal, next: val })
    redoStack.current = []
    applyCell(id, col, val)
  }

  function saveConfig(updated: Config) {
    setConfig(updated)
    clearTimeout(cfgTimer.current)
    cfgTimer.current = setTimeout(async () => {
      setConfigSaving(true)
      await supabase.from('email_config').upsert({
        id: 1, from_address: updated.from, sender_name: updated.sender, footer: updated.footer
      })
      setConfigSaving(false)
    }, 800)
  }

  async function addRowAfter(rowId: string) {
    const idx = rows.findIndex(r => r.id === rowId)
    const after = rows[idx]
    const before = rows[idx + 1]
    const sortOrder = before
      ? (after.sort_order + before.sort_order) / 2
      : after.sort_order + 1
    const newRow: Row = {
      id: crypto.randomUUID(), sort_order: sortOrder,
      no: '', status: '協議中', name: '',
      timing: '', recipient: 'ユーザー', subject: '', body: '',
    }
    setRows(prev => [...prev.slice(0, idx + 1), newRow, ...prev.slice(idx + 1)])
    await supabase.from('emails').insert(newRow)
  }

  async function deleteRow(rowId: string) {
    const row = rows.find(r => r.id === rowId)!
    if (!confirm(`「${row.name || '(空)'}」を削除しますか？`)) return
    await supabase.from('emails').delete().eq('id', row.id)
    setRows(prev => prev.filter(r => r.id !== rowId))
  }

  function startResize(col: ColKey, e: React.MouseEvent) {
    e.preventDefault()
    const startX = e.clientX
    const startW = colWidths[col]
    const onMove = (me: MouseEvent) =>
      setColWidths(prev => ({ ...prev, [col]: Math.max(40, startW + me.clientX - startX) }))
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function handleDragStart(e: React.DragEvent, rowId: string) {
    if (!dragHandleActive.current) { e.preventDefault(); return }
    dragSrcId.current = rowId; setDraggingId(rowId); e.dataTransfer.effectAllowed = 'move'
  }
  function handleDragOver(e: React.DragEvent, rowId: string) {
    e.preventDefault(); e.dataTransfer.dropEffect = 'move'
    if (rowId !== dragSrcId.current) setDragOverId(rowId)
  }
  function handleDragLeave() { setDragOverId(null) }
  async function handleDrop(e: React.DragEvent, targetRowId: string) {
    e.preventDefault(); setDragOverId(null); setDraggingId(null)
    const srcId = dragSrcId.current; dragSrcId.current = null
    if (!srcId || srcId === targetRowId) return
    const srcIdx = rows.findIndex(r => r.id === srcId)
    const tgtIdx = rows.findIndex(r => r.id === targetRowId)
    if (srcIdx === -1 || tgtIdx === -1) return
    const originalOrders = new Map(rows.map(r => [r.id, r.sort_order]))
    const next = [...rows]
    const [moved] = next.splice(srcIdx, 1)
    next.splice(srcIdx < tgtIdx ? tgtIdx - 1 : tgtIdx, 0, moved)
    const updated = next.map((r, i) => ({ ...r, sort_order: i }))
    setRows(updated)
    const changed = updated.filter(r => originalOrders.get(r.id) !== r.sort_order)
    if (changed.length > 0) {
      setSaving(true)
      await supabase.from('emails').upsert(changed)
      setSaving(false)
    }
  }
  function handleDragEnd() { setDraggingId(null); setDragOverId(null); dragSrcId.current = null; dragHandleActive.current = false }

  const filtered = rows.filter(r => {
    if (rcptFilter && r.recipient !== rcptFilter) return false
    if (statusFilter && r.status !== statusFilter) return false
    if (search) {
      const hay = colFilterKey
        ? String(r[colFilterKey] || '').toLowerCase()
        : COL_KEYS.map(k => r[k]).join(' ').toLowerCase()
      if (!hay.includes(search.toLowerCase())) return false
    }
    for (const k of COL_KEYS) {
      if (colFilters[k] && !String(r[k] || '').toLowerCase().includes(colFilters[k].toLowerCase())) return false
    }
    return true
  })
  filteredRef.current = filtered

  const selRange = new Set<string>()
  if (selectedCell && selFocus) {
    const si = filtered.findIndex(r => r.id === selectedCell.rowId)
    const fi = filtered.findIndex(r => r.id === selFocus.rowId)
    const ci = COL_KEYS.indexOf(selectedCell.col as ColKey)
    const fci = COL_KEYS.indexOf(selFocus.col as ColKey)
    if (si !== -1 && fi !== -1 && ci !== -1 && fci !== -1) {
      const [ra, rb] = [Math.min(si, fi), Math.max(si, fi)]
      const [ca, cb] = [Math.min(ci, fci), Math.max(ci, fci)]
      filtered.slice(ra, rb + 1).forEach(r => COL_KEYS.slice(ca, cb + 1).forEach(k => selRange.add(`${r.id}:${k}`)))
    }
  }
  const inSel = (rowId: string, col: string) => selRange.has(`${rowId}:${col}`)

  const fillRange = new Set<string>()
  if (fillSrc && fillTarget) {
    const si = filtered.findIndex(r => r.id === fillSrc.rowId)
    const ti = filtered.findIndex(r => r.id === fillTarget)
    if (si !== -1 && ti !== -1) {
      const [a, b] = [Math.min(si, ti), Math.max(si, ti)]
      filtered.slice(a, b + 1).forEach(r => fillRange.add(r.id))
    }
  }
  const fillHl = (rowId: string, col: string): React.CSSProperties =>
    fillSrc?.col === col && fillRange.has(rowId) && rowId !== fillSrc?.rowId
      ? { background: 'rgba(74,138,216,.15)', outline: '1.5px dashed #4a8ad8', outlineOffset: -1 }
      : {}

  if (loading) return <div style={{ padding: 20, color: '#555568' }}>読み込み中...</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Topbar */}
      <div style={{
        background: '#2a2a2f', padding: '7px 14px', display: 'flex', alignItems: 'center',
        gap: 10, boxShadow: '0 2px 8px rgba(0,0,0,.5)', borderBottom: '1px solid #38383f', flexShrink: 0
      }}>
        <h1 style={{ fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap', color: '#d0d0d8' }}>✉️ メール一覧</h1>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 全体検索..."
          style={{
            flex: 1, maxWidth: 380, padding: '5px 11px', border: '1px solid #444450',
            borderRadius: 4, fontSize: 13, outline: 'none', background: '#38383f', color: '#d0d0d8'
          }}
        />
        {(saving || configSaving) && <span style={{ fontSize: 11, color: '#5588cc' }}>保存中...</span>}
      </div>

      {/* Content (scrollable) */}
      <div style={{ flex: 1, overflow: 'auto', padding: 14 }}>

        {/* ── Card 1: Global config ── */}
        <div style={cardStyle}>
          <div onClick={() => setConfigExpanded(v => !v)}
            style={{ ...cardHdStyle, cursor: 'pointer', userSelect: 'none' }}>
            グローバルメール設定
            <button style={toggleBtnStyle} tabIndex={-1}>{configExpanded ? '▲' : '▼'}</button>
          </div>
          {configExpanded && (
            <table style={{ borderCollapse: 'collapse', width: '100%' }}>
              <tbody>
                <tr>
                  <td style={cfgLabelStyle}>Fromメアド</td>
                  <td contentEditable suppressContentEditableWarning
                    onBlur={e => saveConfig({ ...config, from: e.currentTarget.textContent || '' })}
                    style={cfgTdStyle}
                  >{config.from}</td>
                </tr>
                <tr>
                  <td style={cfgLabelStyle}>送信者名</td>
                  <td contentEditable suppressContentEditableWarning
                    onBlur={e => saveConfig({ ...config, sender: e.currentTarget.textContent || '' })}
                    style={cfgTdStyle}
                  >{config.sender}</td>
                </tr>
                <tr>
                  <td style={cfgLabelStyle}>フッター</td>
                  <td contentEditable suppressContentEditableWarning
                    onBlur={e => saveConfig({ ...config, footer: e.currentTarget.textContent || '' })}
                    style={{ ...cfgTdStyle, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}
                  >{config.footer}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>

        {/* ── Card 2: Email list ── */}
        <div style={{ ...cardStyle, marginBottom: 0 }}>
          <div style={cardHdStyle}>
            メール一覧
            <span style={{ fontSize: 11, color: '#666678' }}>{filtered.length} 件</span>
          </div>

          {/* Toolbar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px',
            background: '#2e2e34', borderBottom: '1px solid #38383f', flexWrap: 'wrap'
          }}>
            <label style={{ color: '#888898', fontSize: 12 }}>列フィルタ:</label>
            <select value={colFilterKey}
              onChange={e => setColFilterKey(e.target.value as ColKey | '')}
              style={selectStyle}>
              <option value="">すべて</option>
              {COL_FILTER_OPTIONS.map(o => (
                <option key={o.key} value={o.key}>{o.label}</option>
              ))}
            </select>
            <div style={sepStyle} />
            <label style={{ color: '#888898', fontSize: 12 }}>宛先:</label>
            <select value={rcptFilter} onChange={e => setRcptFilter(e.target.value)} style={selectStyle}>
              <option value="">すべて</option>
              {RECIPIENTS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <div style={sepStyle} />
            <label style={{ color: '#888898', fontSize: 12 }}>進捗:</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={selectStyle}>
              <option value="">すべて</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 22 }} />
                {COL_KEYS.map(k => <col key={k} style={{ width: colWidths[k] }} />)}
                <col style={{ width: 64 }} />
              </colgroup>
              <thead>
                {/* Header row */}
                <tr>
                  <th style={{ ...thMainStyle, background: '#252528', width: 22 }}></th>
                  {COL_KEYS.map(k => (
                    <th key={k} style={{ ...thMainStyle, width: colWidths[k] }}>
                      {COL_LABELS[k]}
                      <div onMouseDown={e => startResize(k, e)} style={resizerStyle} />
                    </th>
                  ))}
                  <th style={{ ...thMainStyle, background: '#252528', width: 64 }}></th>
                </tr>
                {/* Filter row */}
                <tr>
                  <th style={thFilterStyle}></th>
                  {COL_KEYS.map(k => (
                    <th key={k} style={thFilterStyle}>
                      <input
                        value={colFilters[k]}
                        onChange={e => setColFilters(prev => ({ ...prev, [k]: e.target.value }))}
                        placeholder={COL_PLACEHOLDERS[k]}
                        style={filterInputStyle}
                      />
                    </th>
                  ))}
                  <th style={thFilterStyle}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(row => {
                  const sel = (col: string) => selectedCell?.rowId === row.id && selectedCell?.col === col
                  const edt = (col: string) => editingCell?.rowId === row.id && editingCell?.col === col
                  const onCellClick = (e: React.MouseEvent, col: string) => {
                    e.stopPropagation()
                    if (e.shiftKey && selectedCell) { setSelFocus({ rowId: row.id, col }) }
                    else { setSelectedCell({ rowId: row.id, col }); setSelFocus(null) }
                  }
                  const onCellDbl = (col: string) => { setSelectedCell({ rowId: row.id, col }); setSelFocus(null); setEditingCell({ rowId: row.id, col }) }
                  const onCellBlur = (e: React.FocusEvent<HTMLTableCellElement>, col: keyof Row) => {
                    if (edt(String(col))) { updateCell(row.id, col, e.currentTarget.textContent || ''); setEditingCell(null) }
                  }
                  const hlStyle = (col: string): React.CSSProperties => {
                    if (edt(col)) return {}
                    if (sel(col)) return { outline: '2px solid #4a8ad8', outlineOffset: -2, background: 'rgba(74,138,216,.1)' }
                    if (selFocus && inSel(row.id, col)) return { background: 'rgba(74,138,216,.15)', outline: '1px solid rgba(74,138,216,.35)', outlineOffset: -1 }
                    return {}
                  }
                  const handle = (col: string) => sel(col) && !edt(col) && !selFocus ? (
                    <div style={{ position: 'absolute', bottom: -3, right: -3, width: 7, height: 7, background: '#4a8ad8', border: '1.5px solid #fff', cursor: 'crosshair', zIndex: 10 }}
                      onMouseDown={e => { e.preventDefault(); e.stopPropagation(); setFillSrc({ rowId: row.id, col }) }} />
                  ) : null
                  const onCellMouseDown = (e: React.MouseEvent, col: string) => {
                    if (e.button !== 0 || e.shiftKey) return
                    isDragSelecting.current = true
                    document.body.style.userSelect = 'none'
                    setSelectedCell({ rowId: row.id, col })
                    setSelFocus(null)
                  }
                  return (
                  <tr key={row.id} data-row-id={row.id} draggable
                    onDragStart={e => handleDragStart(e, row.id)}
                    onDragOver={e => handleDragOver(e, row.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={e => handleDrop(e, row.id)}
                    onDragEnd={handleDragEnd}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,.05)',
                      background: '#1e1e24',
                      opacity: draggingId === row.id ? 0.4 : 1,
                      borderTop: dragOverId === row.id ? '2px solid #5588aa' : undefined,
                    }}
                  >
                    <td style={dragTdStyle} onMouseDown={() => { dragHandleActive.current = true }} onMouseUp={() => { dragHandleActive.current = false }}>⠿</td>

                    {/* No */}
                    <td tabIndex={0}
                      data-cell={`${row.id}-no`}
                      onClick={e => onCellClick(e, 'no')}
                      onMouseDown={e => onCellMouseDown(e, 'no')}
                      onDoubleClick={() => onCellDbl('no')}
                      contentEditable={edt('no') || undefined}
                      suppressContentEditableWarning
                      onBlur={e => onCellBlur(e, 'no')}
                      style={{ ...tdStyle, position: 'relative', textAlign: 'center', fontWeight: 600, fontSize: 12, color: '#8898b0', ...hlStyle('no'), ...fillHl(row.id, 'no') }}
                    >{row.no}{handle('no')}</td>

                    {/* Status — full-cell select */}
                    <td data-cell={`${row.id}-status`}
                      onMouseDown={e => onCellMouseDown(e, 'status')}
                      style={{ padding: 0, borderRight: '1px solid rgba(255,255,255,.04)', verticalAlign: 'middle', height: '1px', ...hlStyle('status'), ...fillHl(row.id, 'status') }}>
                      <div style={{
                        position: 'relative', display: 'flex', alignItems: 'center',
                        width: '100%', height: '100%', minHeight: 28,
                        padding: '5px 20px 5px 7px', fontWeight: 600, fontSize: 13,
                        background: STATUS_STYLE[row.status]?.bg ?? '#252528',
                        color: STATUS_STYLE[row.status]?.color ?? '#888898',
                        userSelect: 'none', cursor: 'pointer', boxSizing: 'border-box',
                      }}>
                        {/* 未選択時オーバーレイ: クリックをブロックして選択のみ行う */}
                        {!sel('status') && (
                          <div style={{ position: 'absolute', inset: 0, zIndex: 2 }}
                            onClick={e => { e.stopPropagation(); setSelectedCell({ rowId: row.id, col: 'status' }) }} />
                        )}
                        {row.status}
                        <span style={{ position: 'absolute', right: 5, fontSize: 8, opacity: .5, pointerEvents: 'none' }}>▼</span>
                        <select value={row.status} onChange={e => updateCell(row.id, 'status', e.target.value)}
                          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%', fontSize: 13 }}>
                          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                        {handle('status')}
                      </div>
                    </td>

                    {/* Name */}
                    <td tabIndex={0}
                      data-cell={`${row.id}-name`}
                      onClick={e => onCellClick(e, 'name')}
                      onMouseDown={e => onCellMouseDown(e, 'name')}
                      onDoubleClick={() => onCellDbl('name')}
                      contentEditable={edt('name') || undefined}
                      suppressContentEditableWarning
                      onBlur={e => onCellBlur(e, 'name')}
                      style={{ ...tdStyle, position: 'relative', ...hlStyle('name'), ...fillHl(row.id, 'name') }}
                    >{row.name}{handle('name')}</td>

                    {/* Timing */}
                    <td tabIndex={0}
                      data-cell={`${row.id}-timing`}
                      onClick={e => onCellClick(e, 'timing')}
                      onMouseDown={e => onCellMouseDown(e, 'timing')}
                      onDoubleClick={() => onCellDbl('timing')}
                      contentEditable={edt('timing') || undefined}
                      suppressContentEditableWarning
                      onBlur={e => onCellBlur(e, 'timing')}
                      style={{ ...tdStyle, position: 'relative', ...hlStyle('timing'), ...fillHl(row.id, 'timing') }}
                    >{row.timing}{handle('timing')}</td>

                    {/* Recipient — full-cell select */}
                    <td data-cell={`${row.id}-recipient`}
                      onMouseDown={e => onCellMouseDown(e, 'recipient')}
                      style={{ padding: 0, borderRight: '1px solid rgba(255,255,255,.04)', verticalAlign: 'middle', height: '1px', ...hlStyle('recipient'), ...fillHl(row.id, 'recipient') }}>
                      <div style={{
                        position: 'relative', display: 'flex', alignItems: 'center',
                        width: '100%', height: '100%', minHeight: 28,
                        padding: '5px 20px 5px 7px', fontWeight: 600, fontSize: 13,
                        background: RCPT_STYLE[row.recipient]?.bg ?? '#252528',
                        color: RCPT_STYLE[row.recipient]?.color ?? '#888898',
                        userSelect: 'none', cursor: 'pointer', boxSizing: 'border-box',
                      }}>
                        {/* 未選択時オーバーレイ */}
                        {!sel('recipient') && (
                          <div style={{ position: 'absolute', inset: 0, zIndex: 2 }}
                            onClick={e => { e.stopPropagation(); setSelectedCell({ rowId: row.id, col: 'recipient' }) }} />
                        )}
                        {row.recipient}
                        <span style={{ position: 'absolute', right: 5, fontSize: 8, opacity: .5, pointerEvents: 'none' }}>▼</span>
                        <select value={row.recipient} onChange={e => updateCell(row.id, 'recipient', e.target.value)}
                          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%', fontSize: 13 }}>
                          {RECIPIENTS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        {handle('recipient')}
                      </div>
                    </td>

                    {/* Subject */}
                    <td tabIndex={0}
                      data-cell={`${row.id}-subject`}
                      onClick={e => onCellClick(e, 'subject')}
                      onMouseDown={e => onCellMouseDown(e, 'subject')}
                      onDoubleClick={() => onCellDbl('subject')}
                      contentEditable={edt('subject') || undefined}
                      suppressContentEditableWarning
                      onBlur={e => onCellBlur(e, 'subject')}
                      style={{ ...tdStyle, position: 'relative', ...hlStyle('subject'), ...fillHl(row.id, 'subject') }}
                    >{row.subject}{handle('subject')}</td>

                    {/* Body */}
                    <td tabIndex={0}
                      data-cell={`${row.id}-body`}
                      onClick={e => onCellClick(e, 'body')}
                      onMouseDown={e => onCellMouseDown(e, 'body')}
                      onDoubleClick={() => onCellDbl('body')}
                      contentEditable={edt('body') || undefined}
                      suppressContentEditableWarning
                      onBlur={e => onCellBlur(e, 'body')}
                      style={{ ...tdStyle, position: 'relative', whiteSpace: 'pre-wrap', ...hlStyle('body'), ...fillHl(row.id, 'body') }}
                    >{row.body}{handle('body')}</td>

                    <td style={actTdStyle}>
                      <button onClick={() => addRowAfter(row.id)} style={addBtnStyle}>+</button>
                      <button onClick={() => deleteRow(row.id)} style={delBtnStyle}>−</button>
                    </td>
                  </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={COL_KEYS.length + 2}
                      style={{ padding: '24px', textAlign: 'center', color: '#555568', fontSize: 12 }}>
                      表示するメールがありません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Status bar */}
          <div style={{
            background: '#2e2e34', borderTop: '1px solid #38383f',
            padding: '4px 12px', fontSize: 11, color: '#666678',
            display: 'flex', justifyContent: 'space-between',
          }}>
            <span>{filtered.length} 行表示</span>
            <span>自動保存</span>
          </div>
        </div>

      </div>
    </div>
  )
}

const cardStyle: React.CSSProperties = {
  background: '#2a2a2f', borderRadius: 8, marginBottom: 14,
  boxShadow: '0 2px 8px rgba(0,0,0,.4)', overflow: 'hidden', border: '1px solid #38383f',
}
const cardHdStyle: React.CSSProperties = {
  background: '#2e2e34', borderBottom: '1px solid #38383f', padding: '9px 14px',
  fontSize: 13, fontWeight: 700, color: '#a8b8d0',
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
}
const toggleBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer', color: '#7a8a9a',
  fontSize: 13, padding: '2px 6px', borderRadius: 3, lineHeight: 1,
}
const cfgLabelStyle: React.CSSProperties = {
  border: '1px solid #38383f', padding: '7px 12px', verticalAlign: 'top',
  fontSize: 13, background: '#2e2e34', fontWeight: 700, color: '#a8b8d0',
  whiteSpace: 'nowrap', width: 120,
}
const cfgTdStyle: React.CSSProperties = {
  border: '1px solid #38383f', padding: '7px 12px', verticalAlign: 'top',
  fontSize: 13, color: '#c0c0cc', lineHeight: 1.6, outline: 'none',
}
const selectStyle: React.CSSProperties = {
  padding: '4px 10px', border: '1px solid #444450', borderRadius: 4,
  fontSize: 12, outline: 'none', background: '#38383f', color: '#c0c0d0',
}
const sepStyle: React.CSSProperties = {
  width: 1, height: 20, background: '#444450', margin: '0 2px',
}
const thMainStyle: React.CSSProperties = {
  background: '#2a2a2f', color: '#9090a8', padding: '7px 8px',
  textAlign: 'left', fontSize: 12, fontWeight: 700,
  borderRight: '1px solid rgba(255,255,255,.06)', whiteSpace: 'nowrap',
  overflow: 'hidden', textOverflow: 'ellipsis', userSelect: 'none', position: 'relative',
}
const thFilterStyle: React.CSSProperties = {
  background: '#2e2e34', padding: '3px 5px', borderRight: '1px solid #38383f',
}
const filterInputStyle: React.CSSProperties = {
  width: '100%', border: '1px solid #44444f', borderRadius: 3, padding: '3px 6px',
  fontSize: 11, outline: 'none', background: '#38383f', color: '#b8b8c8',
}
const tdStyle: React.CSSProperties = {
  padding: '5px 7px', verticalAlign: 'top', borderRight: '1px solid rgba(255,255,255,.04)',
  outline: 'none', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5,
  cursor: 'cell', color: '#c0c0cc',
}
const dragTdStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,.15)', width: 22, textAlign: 'center',
  borderRight: '1px solid rgba(255,255,255,.05)', padding: 0,
  verticalAlign: 'middle', cursor: 'grab', color: '#555568', fontSize: 14, userSelect: 'none',
}
const actTdStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,.15)', width: 64, textAlign: 'center',
  borderLeft: '1px solid rgba(255,255,255,.05)', padding: '2px 4px',
  verticalAlign: 'middle', whiteSpace: 'nowrap',
}
const addBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 22, height: 22, border: '1.5px solid #34a853', borderRadius: '50%',
  background: 'transparent', color: '#34a853', fontSize: 15, fontWeight: 700, cursor: 'pointer',
}
const delBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 22, height: 22, border: '1.5px solid #ea4335', borderRadius: '50%',
  background: 'transparent', color: '#ea4335', fontSize: 15, fontWeight: 700,
  cursor: 'pointer', marginLeft: 8,
}
const resizerStyle: React.CSSProperties = {
  position: 'absolute', right: 0, top: 0, width: 5, height: '100%',
  cursor: 'col-resize', userSelect: 'none', zIndex: 1,
}
