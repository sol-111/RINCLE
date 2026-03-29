'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

type Row = {
  id: string
  sort_order: number
  screen_id: string
  item: string
  component: string
  feature: string
  detail: string
  improvement: string
  path: string
}

const COLS: (keyof Row)[] = ['screen_id', 'item', 'component', 'feature', 'detail', 'improvement', 'path']
const COL_LABELS = ['画面ID', '項目', 'コンポーネント', '機能', '詳細', '改善', 'パス']
const COL_WIDTHS = [90, 140, 140, 180, 220, 180, 160]

const IMPROVEMENT_COLORS: Record<string, string> = {
  '必須': '#e53935', '推奨': '#fb8c00', '任意': '#43a047', '対応済': '#5588cc', '': ''
}

function ImprovementBadge({ val }: { val: string }) {
  const color = IMPROVEMENT_COLORS[val] || '#666'
  if (!val) return null
  return (
    <span style={{
      background: color + '22', color, border: `1px solid ${color}55`,
      borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 700
    }}>{val}</span>
  )
}

export default function ScreensTab() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    supabase
      .from('screens')
      .select('*')
      .order('sort_order')
      .then(({ data }) => {
        setRows(data || [])
        setLoading(false)
      })
  }, [])

  const autoSave = useCallback(async (updated: Row[]) => {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      for (const row of updated) {
        await supabase.from('screens').upsert(row)
      }
      setSaving(false)
    }, 1000)
  }, [])

  function updateCell(id: string, col: keyof Row, val: string) {
    const updated = rows.map(r => r.id === id ? { ...r, [col]: val } : r)
    setRows(updated)
    autoSave(updated)
  }

  async function addRowAfter(idx: number) {
    const newRow: Row = {
      id: crypto.randomUUID(),
      sort_order: idx + 1,
      screen_id: '', item: '', component: '', feature: '',
      detail: '', improvement: '', path: ''
    }
    const updated = [
      ...rows.slice(0, idx + 1),
      newRow,
      ...rows.slice(idx + 1).map((r, i) => ({ ...r, sort_order: idx + 2 + i }))
    ]
    setRows(updated)
    await supabase.from('screens').upsert(updated)
  }

  async function deleteRow(idx: number) {
    const row = rows[idx]
    if (!confirm(`「${row.item || '(空)'}」を削除しますか？`)) return
    await supabase.from('screens').delete().eq('id', row.id)
    setRows(rows.filter((_, i) => i !== idx))
  }

  const filtered = rows.filter(r =>
    !search || COLS.some(c => String(r[c] || '').toLowerCase().includes(search.toLowerCase()))
  )

  if (loading) return <div style={{ padding: 20, color: '#555568' }}>読み込み中...</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{
        padding: '7px 14px', background: '#2a2a2f', borderBottom: '1px solid #38383f',
        display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0
      }}>
        <h1 style={{ fontSize: 15, fontWeight: 700, color: '#d0d0d8', whiteSpace: 'nowrap' }}>
          📊 画面設計書
        </h1>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 全体検索..."
          style={{
            flex: 1, maxWidth: 380, padding: '5px 11px', border: '1px solid #444450',
            borderRadius: 4, fontSize: 13, outline: 'none', background: '#38383f', color: '#d0d0d8'
          }}
        />
        {saving && <span style={{ fontSize: 11, color: '#5588cc' }}>保存中...</span>}
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 22 }} />
            {COL_WIDTHS.map((w, i) => <col key={i} style={{ width: w }} />)}
            <col style={{ width: 68 }} />
          </colgroup>
          <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
            <tr>
              <th style={thStyle}></th>
              {COL_LABELS.map((l, i) => (
                <th key={i} style={thStyle}>{l}</th>
              ))}
              <th style={{ ...thStyle, background: '#252528' }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, idx) => (
              <tr key={row.id} style={{ borderBottom: '1px solid rgba(255,255,255,.05)' }}>
                <td style={dragTdStyle}>⠿</td>
                {COLS.map(col => (
                  <td
                    key={col}
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={e => updateCell(row.id, col, e.currentTarget.textContent || '')}
                    style={{
                      ...tdStyle,
                      ...(col === 'screen_id' ? { fontFamily: 'monospace', color: '#8898b0' } : {}),
                    }}
                  >
                    {col === 'improvement'
                      ? <ImprovementBadge val={row[col]} />
                      : row[col]
                    }
                  </td>
                ))}
                <td style={actTdStyle}>
                  <button onClick={() => addRowAfter(idx)} style={addBtnStyle}>+</button>
                  <button onClick={() => deleteRow(idx)} style={delBtnStyle}>−</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Statusbar */}
      <div style={{
        background: '#2e2e34', borderTop: '1px solid #38383f',
        padding: '4px 12px', fontSize: 11, color: '#666678',
        display: 'flex', justifyContent: 'space-between', flexShrink: 0
      }}>
        <span>{filtered.length} 件</span>
        <span>自動保存</span>
      </div>
    </div>
  )
}

const thStyle: React.CSSProperties = {
  background: '#2a2a2f', color: '#9090a8', padding: '7px 8px',
  textAlign: 'left', fontSize: 12, fontWeight: 700,
  borderRight: '1px solid rgba(255,255,255,.06)', whiteSpace: 'nowrap',
  overflow: 'hidden', textOverflow: 'ellipsis'
}
const tdStyle: React.CSSProperties = {
  padding: '4px 7px', verticalAlign: 'middle',
  borderRight: '1px solid rgba(255,255,255,.04)',
  whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.4,
  color: '#c0c0cc', outline: 'none'
}
const dragTdStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,.15)', width: 22, textAlign: 'center',
  borderRight: '1px solid rgba(255,255,255,.05)', padding: 0,
  verticalAlign: 'middle', cursor: 'grab', color: '#555568', fontSize: 14, userSelect: 'none'
}
const actTdStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,.15)', width: 68, textAlign: 'center',
  borderLeft: '1px solid rgba(255,255,255,.05)', padding: '2px 4px',
  verticalAlign: 'middle', whiteSpace: 'nowrap'
}
const addBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 22, height: 22, border: '1.5px solid #34a853', borderRadius: '50%',
  background: 'transparent', color: '#34a853', fontSize: 15, fontWeight: 700,
  cursor: 'pointer', marginRight: 8
}
const delBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 22, height: 22, border: '1.5px solid #ea4335', borderRadius: '50%',
  background: 'transparent', color: '#ea4335', fontSize: 15, fontWeight: 700,
  cursor: 'pointer'
}
