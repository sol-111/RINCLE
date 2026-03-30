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

  const dragSrcId = useRef<string | null>(null)
  const dirtyRows = useRef<Map<string, Row>>(new Map())
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const cfgTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const supabase = useRef(createClient()).current

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

  function updateCell(id: string, col: keyof Row, val: string) {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r
      const newRow = { ...r, [col]: val }
      dirtyRows.current.set(id, newRow)
      return newRow
    }))
    scheduleSave()
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
  function handleDragEnd() { setDraggingId(null); setDragOverId(null); dragSrcId.current = null }

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
                {filtered.map(row => (
                  <tr key={row.id} draggable
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
                    <td style={dragTdStyle}>⠿</td>

                    {/* No */}
                    <td contentEditable suppressContentEditableWarning
                      onBlur={e => updateCell(row.id, 'no', e.currentTarget.textContent || '')}
                      style={{ ...tdStyle, textAlign: 'center', fontWeight: 600, fontSize: 12, color: '#8898b0' }}
                    >{row.no}</td>

                    {/* Status — full-cell select */}
                    <td style={{ padding: 0, borderRight: '1px solid rgba(255,255,255,.04)', verticalAlign: 'middle', height: '1px' }}>
                      <div style={{
                        position: 'relative', display: 'flex', alignItems: 'center',
                        width: '100%', height: '100%', minHeight: 28,
                        padding: '5px 20px 5px 7px', fontWeight: 600, fontSize: 13,
                        background: STATUS_STYLE[row.status]?.bg ?? '#252528',
                        color: STATUS_STYLE[row.status]?.color ?? '#888898',
                        userSelect: 'none', cursor: 'pointer', boxSizing: 'border-box',
                      }}>
                        {row.status}
                        <span style={{ position: 'absolute', right: 5, fontSize: 8, opacity: .5, pointerEvents: 'none' }}>▼</span>
                        <select value={row.status} onChange={e => updateCell(row.id, 'status', e.target.value)}
                          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%', fontSize: 13 }}>
                          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </td>

                    {/* Name */}
                    <td contentEditable suppressContentEditableWarning
                      onBlur={e => updateCell(row.id, 'name', e.currentTarget.textContent || '')}
                      style={tdStyle}
                    >{row.name}</td>

                    {/* Timing */}
                    <td contentEditable suppressContentEditableWarning
                      onBlur={e => updateCell(row.id, 'timing', e.currentTarget.textContent || '')}
                      style={tdStyle}
                    >{row.timing}</td>

                    {/* Recipient — full-cell select */}
                    <td style={{ padding: 0, borderRight: '1px solid rgba(255,255,255,.04)', verticalAlign: 'middle', height: '1px' }}>
                      <div style={{
                        position: 'relative', display: 'flex', alignItems: 'center',
                        width: '100%', height: '100%', minHeight: 28,
                        padding: '5px 20px 5px 7px', fontWeight: 600, fontSize: 13,
                        background: RCPT_STYLE[row.recipient]?.bg ?? '#252528',
                        color: RCPT_STYLE[row.recipient]?.color ?? '#888898',
                        userSelect: 'none', cursor: 'pointer', boxSizing: 'border-box',
                      }}>
                        {row.recipient}
                        <span style={{ position: 'absolute', right: 5, fontSize: 8, opacity: .5, pointerEvents: 'none' }}>▼</span>
                        <select value={row.recipient} onChange={e => updateCell(row.id, 'recipient', e.target.value)}
                          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%', fontSize: 13 }}>
                          {RECIPIENTS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                    </td>

                    {/* Subject */}
                    <td contentEditable suppressContentEditableWarning
                      onBlur={e => updateCell(row.id, 'subject', e.currentTarget.textContent || '')}
                      style={tdStyle}
                    >{row.subject}</td>

                    {/* Body */}
                    <td contentEditable suppressContentEditableWarning
                      onBlur={e => updateCell(row.id, 'body', e.currentTarget.textContent || '')}
                      style={{ ...tdStyle, whiteSpace: 'pre-wrap' }}
                    >{row.body}</td>

                    <td style={actTdStyle}>
                      <button onClick={() => addRowAfter(row.id)} style={addBtnStyle}>+</button>
                      <button onClick={() => deleteRow(row.id)} style={delBtnStyle}>−</button>
                    </td>
                  </tr>
                ))}
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
