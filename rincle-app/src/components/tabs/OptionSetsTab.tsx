'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

type Row = {
  id: string
  sort_order: number
  set_name: string
  notes: string
  abbrev: string
  display: string
  val_1: string
  val_2: string
  val_3: string
}

const VAL_KEYS = ['val_1', 'val_2', 'val_3'] as const
type ValKey = typeof VAL_KEYS[number]
const DEFAULT_NAMES: Record<ValKey, string> = { val_1: '値1', val_2: '値2', val_3: '値3' }

const isHeader = (r: Row) => r.set_name !== ''

function getActiveCols(header: Row | null): { key: ValKey; name: string }[] {
  if (!header) return []
  return VAL_KEYS.filter(k => header[k] !== '').map(k => ({ key: k, name: header[k] }))
}

export default function OptionSetsTab() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [selectedSetId, setSelectedSetId] = useState<string>('')
  const [renamingSetId, setRenamingSetId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const dragSrcId = useRef<string | null>(null)
  const dirtyRows = useRef<Map<string, Row>>(new Map())
  const supabase = useRef(createClient()).current
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    supabase.from('option_items').select('*').order('sort_order').then(({ data }) => {
      const loaded = data || []
      // 自動マイグレーション: ヘッダーのval名が空でアイテムにデータがある場合デフォルト名を設定
      const migrated: Row[] = []
      const normalized = loaded.map(r => {
        if (!isHeader(r)) return r
        const { itemRows } = getSetSliceFrom(loaded, r.id)
        let changed = false
        const updated = { ...r }
        for (const k of VAL_KEYS) {
          if (!r[k] && itemRows.some(ir => ir[k])) {
            updated[k] = DEFAULT_NAMES[k]
            changed = true
          }
        }
        if (changed) migrated.push(updated)
        return changed ? updated : r
      })
      setRows(normalized)
      if (migrated.length > 0) {
        supabase.from('option_items').upsert(migrated)
      }
      const firstHeader = normalized.find(r => isHeader(r))
      if (firstHeader) setSelectedSetId(firstHeader.id)
      setLoading(false)
    })
  }, [])

  const scheduleSave = useCallback(() => {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      const toSave = [...dirtyRows.current.values()]
      dirtyRows.current.clear()
      if (toSave.length === 0) return
      setSaving(true)
      await supabase.from('option_items').upsert(toSave)
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

  function getSetSlice(setId: string) { return getSetSliceFrom(rows, setId) }

  async function addItem() {
    const { headerIdx, itemRows } = getSetSlice(selectedSetId)
    if (headerIdx === -1) return
    const insertAfterIdx = headerIdx + itemRows.length
    const newRow: Row = {
      id: crypto.randomUUID(),
      sort_order: (rows[insertAfterIdx]?.sort_order ?? rows[headerIdx].sort_order) + 0.5,
      set_name: '', notes: '', abbrev: '', display: '', val_1: '', val_2: '', val_3: ''
    }
    setRows(prev => [...prev.slice(0, insertAfterIdx + 1), newRow, ...prev.slice(insertAfterIdx + 1)])
    await supabase.from('option_items').insert(newRow)
    setTimeout(() => {
      const el = document.querySelector(`[data-rowid="${newRow.id}"][data-col="display"]`) as HTMLElement
      el?.focus()
    }, 50)
  }

  async function deleteItem(rowId: string) {
    const row = rows.find(r => r.id === rowId)!
    if (!confirm(`「${row.display || '(空)'}」を削除しますか？`)) return
    await supabase.from('option_items').delete().eq('id', row.id)
    setRows(rows.filter(r => r.id !== rowId))
  }

  async function createSet() {
    const name = prompt('新しいOptionSet名を入力')?.trim()
    if (!name) return
    if (rows.filter(isHeader).some(r => r.set_name === name)) { alert('同名のセットが既に存在します'); return }
    const maxOrder = rows.length > 0 ? Math.max(...rows.map(r => r.sort_order)) : -1
    const newHeader: Row = {
      id: crypto.randomUUID(), sort_order: maxOrder + 1,
      set_name: name, notes: '', abbrev: '',
      display: '', val_1: DEFAULT_NAMES.val_1, val_2: '', val_3: ''
    }
    setRows(prev => [...prev, newHeader])
    await supabase.from('option_items').insert(newHeader)
    setSelectedSetId(newHeader.id)
  }

  async function deleteSet(setId: string) {
    const header = rows.find(r => r.id === setId)!
    const { itemRows } = getSetSlice(setId)
    if (!confirm(`セット「${header.set_name}」（${itemRows.length} アイテム）を削除しますか？`)) return
    const ids = [setId, ...itemRows.map(r => r.id)]
    await supabase.from('option_items').delete().in('id', ids)
    const updated = rows.filter(r => !ids.includes(r.id))
    setRows(updated)
    setSelectedSetId(updated.filter(isHeader)[0]?.id || '')
  }

  async function commitRename(setId: string) {
    const newName = renameValue.trim()
    setRenamingSetId(null)
    if (!newName) return
    const header = rows.find(r => r.id === setId)
    if (!header || newName === header.set_name) return
    if (rows.filter(isHeader).some(r => r.set_name === newName && r.id !== setId)) {
      alert('同名のセットが既に存在します'); return
    }
    updateCell(setId, 'set_name', newName)
  }

  // ── 列操作 ──────────────────────────────────────────────────────────────────
  function addCol() {
    const header = rows.find(r => r.id === selectedSetId)
    if (!header) return
    const nextKey = VAL_KEYS.find(k => header[k] === '')
    if (!nextKey) return
    updateCell(selectedSetId, nextKey, DEFAULT_NAMES[nextKey])
  }

  function renameCol(colKey: ValKey, newName: string) {
    if (!newName.trim()) return
    updateCell(selectedSetId, colKey, newName.trim())
  }

  async function removeCol(colKey: ValKey) {
    const { itemRows } = getSetSlice(selectedSetId)
    const hasData = itemRows.some(r => r[colKey])
    const header = rows.find(r => r.id === selectedSetId)!
    if (!confirm(`「${header[colKey]}」列を削除しますか？${hasData ? '\nアイテムのデータも削除されます。' : ''}`)) return
    // ヘッダーの列名をクリア
    updateCell(selectedSetId, colKey, '')
    // アイテムのデータをクリア
    if (hasData) {
      setRows(prev => prev.map(r => {
        if (!itemRows.find(ir => ir.id === r.id)) return r
        const newRow = { ...r, [colKey]: '' }
        dirtyRows.current.set(r.id, newRow)
        return newRow
      }))
      scheduleSave()
    }
  }

  // ── 行ドラッグ&ドロップ ────────────────────────────────────────────────────────
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
      await supabase.from('option_items').upsert(changed)
      setSaving(false)
    }
  }
  function handleDragEnd() { setDraggingId(null); setDragOverId(null); dragSrcId.current = null }

  const sets = rows.filter(isHeader)
  const selectedHeader = rows.find(r => r.id === selectedSetId) ?? null
  const { itemRows } = getSetSlice(selectedSetId)
  const activeCols = getActiveCols(selectedHeader)
  const canAddCol = activeCols.length < 3

  if (loading) return <div style={{ padding: 20, color: '#555568' }}>読み込み中...</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Topbar */}
      <div style={{
        padding: '7px 14px', background: '#2a2a2f', borderBottom: '1px solid #38383f',
        display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0
      }}>
        <h1 style={{ fontSize: 15, fontWeight: 700, color: '#d0d0d8', whiteSpace: 'nowrap' }}>
          OptionSet 一覧
        </h1>
        {selectedHeader?.notes && (
          <span style={{ fontSize: 11, color: '#888898' }}>— {selectedHeader.notes}</span>
        )}
        <div style={{ flex: 1 }} />
        {saving && <span style={{ fontSize: 11, color: '#5588cc' }}>保存中...</span>}
        <span style={{ fontSize: 11, color: '#666678', whiteSpace: 'nowrap' }}>全 {sets.length} セット</span>
      </div>

      {/* Table */}
      {selectedSetId ? (
        <div style={{ flex: 1, overflow: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 22 }} />
              <col style={{ width: 260 }} />
              {activeCols.map(c => <col key={c.key} style={{ width: 160 }} />)}
              <col style={{ width: 68 }} />
            </colgroup>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr>
                <th style={thStyle}></th>
                <th style={thStyle}>Display</th>
                {activeCols.map(col => (
                  <th key={col.key} style={{ ...thStyle, position: 'relative' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span
                        contentEditable suppressContentEditableWarning
                        onBlur={e => renameCol(col.key, e.currentTarget.textContent || col.name)}
                        style={{ outline: 'none', flex: 1, cursor: 'text' }}
                      >{col.name}</span>
                      <span
                        onClick={() => removeCol(col.key)}
                        title="この列を削除"
                        style={{ fontSize: 10, color: '#555568', cursor: 'pointer', flexShrink: 0, lineHeight: 1, padding: '1px 2px' }}
                      >✕</span>
                    </div>
                  </th>
                ))}
                <th style={{ ...thStyle, background: '#252528' }}>
                  {canAddCol && (
                    <button onClick={addCol} title="列を追加" style={{
                      background: 'transparent', border: '1px solid #444450', borderRadius: 3,
                      color: '#686880', fontSize: 11, cursor: 'pointer', padding: '1px 6px'
                    }}>+ 列</button>
                  )}
                </th>
              </tr>
            </thead>
            <tbody>
              {itemRows.map(row => (
                <tr key={row.id} draggable
                  onDragStart={e => handleDragStart(e, row.id)}
                  onDragOver={e => handleDragOver(e, row.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={e => handleDrop(e, row.id)}
                  onDragEnd={handleDragEnd}
                  style={{
                    borderBottom: '1px solid rgba(255,255,255,.04)',
                    opacity: draggingId === row.id ? 0.4 : 1,
                    borderTop: dragOverId === row.id ? '2px solid #5588aa' : undefined,
                  }}
                >
                  <td style={dragTdStyle}>⠿</td>
                  <td contentEditable suppressContentEditableWarning
                    data-rowid={row.id} data-col="display"
                    onBlur={e => updateCell(row.id, 'display', e.currentTarget.textContent || '')}
                    style={{ ...tdStyle, color: '#c0c0cc' }}
                  >{row.display}</td>
                  {activeCols.map(col => (
                    <td key={col.key} contentEditable suppressContentEditableWarning
                      data-rowid={row.id} data-col={col.key}
                      onBlur={e => updateCell(row.id, col.key, e.currentTarget.textContent || '')}
                      style={{ ...tdStyle, color: '#907898' }}
                    >{row[col.key]}</td>
                  ))}
                  <td style={actTdStyle}>
                    <button onClick={addItem} style={addBtnStyle}>+</button>
                    <button onClick={() => deleteItem(row.id)} style={delBtnStyle}>−</button>
                  </td>
                </tr>
              ))}
              {itemRows.length === 0 && (
                <tr>
                  <td colSpan={3 + activeCols.length} style={{ padding: '20px 14px', textAlign: 'center' }}>
                    <button onClick={addItem} style={{
                      background: 'transparent', border: '1px dashed #444450', borderRadius: 4,
                      color: '#555568', padding: '6px 16px', cursor: 'pointer', fontSize: 12
                    }}>+ 最初のアイテムを追加</button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button onClick={createSet} style={{
            padding: '10px 20px', background: '#9c6de8', border: 'none',
            borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600
          }}>+ 最初のOptionSetを作成</button>
        </div>
      )}

      {/* Status bar */}
      <div style={{
        background: '#2e2e34', borderTop: '1px solid #38383f',
        padding: '4px 12px', fontSize: 11, color: '#666678',
        display: 'flex', justifyContent: 'space-between', flexShrink: 0
      }}>
        <span>{itemRows.length} アイテム</span>
        <span>自動保存</span>
      </div>

      {/* Sheet tabs */}
      <div style={{
        display: 'flex', alignItems: 'stretch', background: '#1a1a1f',
        borderTop: '1px solid #38383f', flexShrink: 0, overflowX: 'auto', minHeight: 34
      }}>
        {sets.map(s => (
          <button key={s.id}
            onClick={() => setSelectedSetId(s.id)}
            onDoubleClick={() => { setRenamingSetId(s.id); setRenameValue(s.set_name) }}
            title="ダブルクリックでリネーム"
            style={{
              padding: '0 18px', border: 'none', borderRight: '1px solid #2e2e38',
              borderTop: s.id === selectedSetId ? '2px solid #9c6de8' : '2px solid transparent',
              background: s.id === selectedSetId ? '#2a2a2f' : 'transparent',
              color: s.id === selectedSetId ? '#c090f0' : '#686880',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
              minHeight: 34, transition: 'background .1s, color .1s'
            }}
          >
            {renamingSetId === s.id ? (
              <input autoFocus value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onBlur={() => commitRename(s.id)}
                onKeyDown={e => { if (e.key === 'Enter') commitRename(s.id); if (e.key === 'Escape') setRenamingSetId(null) }}
                onClick={e => e.stopPropagation()}
                style={{ background: '#38383f', border: '1px solid #9c6de8', borderRadius: 3, color: '#d0d0d8', fontSize: 12, padding: '1px 6px', outline: 'none', width: 140 }}
              />
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {s.set_name}
                <span onClick={e => { e.stopPropagation(); deleteSet(s.id) }} title="セットを削除"
                  style={{ fontSize: 11, color: '#555568', lineHeight: 1, cursor: 'pointer', padding: '0 1px' }}>✕</span>
              </span>
            )}
          </button>
        ))}
        <button onClick={createSet} title="新しいOptionSetを作成"
          style={{
            padding: '0 14px', border: 'none', background: 'transparent',
            color: '#555568', fontSize: 18, cursor: 'pointer', minHeight: 34,
            display: 'flex', alignItems: 'center', lineHeight: 1, borderTop: '2px solid transparent'
          }}>+</button>
      </div>
    </div>
  )
}

// rows 配列を外から渡せるユーティリティ（useEffect内でも使用）
function getSetSliceFrom(rows: Row[], setId: string) {
  const hi = rows.findIndex(x => x.id === setId)
  if (hi === -1) return { headerIdx: -1, itemRows: [] as Row[] }
  const nextHi = rows.findIndex((x, i) => i > hi && isHeader(x))
  return { headerIdx: hi, itemRows: rows.slice(hi + 1, nextHi === -1 ? undefined : nextHi) }
}

const thStyle: React.CSSProperties = {
  background: '#2a2a2f', color: '#9090a8', padding: '7px 8px',
  textAlign: 'left', fontSize: 12, fontWeight: 700,
  borderRight: '1px solid rgba(255,255,255,.06)', whiteSpace: 'nowrap'
}
const tdStyle: React.CSSProperties = {
  padding: '4px 7px', verticalAlign: 'middle',
  borderRight: '1px solid rgba(255,255,255,.04)',
  lineHeight: 1.4, outline: 'none',
  whiteSpace: 'pre-wrap', wordBreak: 'break-word'
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
