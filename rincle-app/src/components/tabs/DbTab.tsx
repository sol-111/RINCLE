'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import OptionSetsTab from './OptionSetsTab'

type Row = {
  id: string
  sort_order: number
  field_id: string
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

const DTYPES = ['text', 'number', 'date', 'boolean', 'image', 'option', 'ref']
const DTYPE_COLORS: Record<string, string> = {
  text: '#7ab3ff', number: '#81c784', date: '#ffb74d',
  boolean: '#ce93d8', image: '#f48fb1', option: '#ffcc80', ref: '#80cbc4'
}

const FRONT_COLS: { key: keyof Row; label: string; placeholder: string }[] = [
  { key: 'field_name',   label: 'フィールド名', placeholder: 'フィールド' },
  { key: 'display_name', label: '表示名',       placeholder: '表示名' },
]
const BACK_COLS: { key: keyof Row; label: string; placeholder: string; select?: boolean }[] = [
  { key: 'ref_target', label: '参照先',         placeholder: '参照テーブル名', select: true },
  { key: 'validation', label: 'バリデーション', placeholder: 'バリデーション' },
  { key: 'notes',      label: '備考',           placeholder: '備考' },
]

const INIT_WIDTHS: Record<string, number> = {
  field_name: 200, display_name: 160,
  required: 48, ix: 64, dtype: 100, list: 44,
  ref_target: 140, validation: 200, notes: 200,
}

// ── テーブル説明 (DataType) ────────────────────────────────────────────────────
const TABLE_DESCRIPTIONS: Record<string, string> = {
  user:               'ユーザー（事業者・加盟店）。認証・プロフィール・Pay.JP決済情報を管理。アプリの中心テーブル',
  bicycle:            '自転車情報。加盟店が登録する貸出可能な自転車。料金プランと紐づく',
  price_menu:         '料金プラン。時間・日・週・月単位の単価を管理。自転車に紐づく',
  option:             'オプション商品。自転車に追加できるアクセサリ等。加盟店ごとに管理',
  sub_option:         'サブオプション。オプションの詳細・数量・単価。対応自転車を複数持てる',
  prefecture:         '都道府県マスタ。ショップのサービスエリア管理',
  q_a_category:       'FAQカテゴリ。Q&Aの分類に使用',
  q_a:                'よくある質問と回答。カテゴリに紐づく',
  news:               'お知らせ。管理者・運営からユーザーへの通知',
  banner:             'バナー広告。トップページ等に表示する画像+リンク',
  fv:                 'ファーストビュー。トップページのヒーロー画像・リンク',
  holidays:           '祝日マスタ。貸出不可日の管理に使用',
  access_log:         'アクセスログ。ユーザーの訪問日時・IPを記録',
  webhook_event:      'Webhookイベント。Pay.JPなど外部サービスからの通知を記録',
  reservation:        '予約情報。貸出・返却・決済の中心テーブル。明細・オプション価格と紐づく',
  booking_customer:   '予約顧客情報。会員登録なしで予約した顧客の氏名・連絡先',
  reservation_detail: '予約明細。予約ごとの自転車・料金プラン・金額の詳細',
  option_price:       'オプション価格。予約に紐づくオプション金額の記録',
  shop_schedule:      'ショップスケジュール。特定日の営業状態と対象自転車を管理',
  business_hours:     '営業時間設定。曜日・期間ごとの営業時間ルール',
  sales_record:       '売上記録。月次集計・振込処理用のデータ',
  shop_notification:  'ショップ通知。お問い合わせ・請求・キャンセル等の通知',
  contact_inquiry:    'お問い合わせ。ユーザーからの問い合わせフォームデータ',
}

// ── OptionSet 説明 ─────────────────────────────────────────────────────────────
const OS_DESCRIPTIONS: Record<string, string> = {
  'Rights':                  'ユーザー / 加盟店 / 管理者のアクセス権限',
  '予約ステータス':           '貸出中・来客待ち・返却済み等、予約の進行状態',
  '決済ステータス':           '決済済み・未決済・返金済み等、支払い状態',
  '振り込みステータス':       '振込済 / 未振込',
  '支払い方法':               '店頭決済 / クレカ決済',
  '貸し出し可能ステータス':   '自転車のユーザー表示フラグ',
  'brand_status':            'ブランドレビューの審査状態',
  'Bicycle Category':        '自転車カテゴリ（ロード・クロス・MTB等）',
  'yes/no':                  'True/False の汎用フラグ',
  '営業状態op':              '営業 / 休業',
  '予約管理並び替え':         '予約一覧の並び順オプション',
  '管理者/運営_news_type':   'お知らせ種別（お問い合わせ・請求/入金・キャンセル）',
  'Admin_info':              '管理者メール・サービス名などグローバル設定',
  'Platform_Fee':            'プラットフォーム手数料率（デフォルト10%）',
  'index_page':              'インデックスページのパラメータ定義',
  'Shop_Sidebar_sub':        'ショップ管理画面のサイドバー項目',
  'Admin_Sidebar_sub':       '管理者画面のサイドバー項目',
  'pay_jp_key':              'Pay.JP の公開鍵・秘密鍵',
  '曜日':                    '月〜日・祝日のスラグ定義',
  '月':                      '1月〜12月',
  '日付':                    '1〜31の日付マスタ（31件）',
  'Time':                    '0:00〜23:50の時刻マスタ（10分刻み・144件）',
  'menu_利用規約':            '利用規約本文（長文テキスト）',
  'menu_プライバシーポリシー': 'プライバシーポリシー本文（長文テキスト）',
  'menu_特商法':              '特定商取引法表記（長文テキスト）',
}

export default function DbTab() {
  const [tab, setTab] = useState<'fields' | 'os'>('fields')
  const [rows, setRows] = useState<Row[]>([])
  const [osNames, setOsNames] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [selectedTable, setSelectedTable] = useState<string>('')
  const [dtypeFilter, setDtypeFilter] = useState('')
  const [colFilters, setColFilters] = useState<Record<string, string>>({})
  const [renamingTable, setRenamingTable] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [colWidths, setColWidths] = useState<Record<string, number>>(INIT_WIDTHS)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const dragSrcId = useRef<string | null>(null)
  const dirtyRows = useRef<Map<string, Row>>(new Map())
  const supabase = createClient()
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    supabase.from('db_fields').select('*').order('sort_order').then(({ data }) => {
      const raw = data || []
      let last = ''
      const normalized = raw.map(r => {
        if (r.table_name) { last = r.table_name; return r }
        return { ...r, table_name: last }
      })
      setRows(normalized)
      const tables = getTableOrder(normalized)
      if (tables.length > 0) setSelectedTable('__list__')
      setLoading(false)
    })
    supabase.from('option_items').select('set_name').neq('set_name', '').order('sort_order').then(({ data }) => {
      const seen = new Set<string>()
      const names: string[] = []
      for (const r of data || []) {
        if (!seen.has(r.set_name)) { seen.add(r.set_name); names.push(r.set_name) }
      }
      setOsNames(names)
    })
  }, [])

  const scheduleSave = useCallback(() => {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      const toSave = [...dirtyRows.current.values()]
      dirtyRows.current.clear()
      if (toSave.length === 0) return
      setSaving(true)
      const { error } = await supabase.from('db_fields').upsert(toSave, { onConflict: 'id' })
      if (error) setSaveError(error.message)
      else setSaveError(null)
      setSaving(false)
    }, 800)
  }, [supabase])

  function updateRow(id: string, patch: Partial<Row>) {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r
      const newRow = { ...r, ...patch }
      dirtyRows.current.set(id, newRow)
      return newRow
    }))
    scheduleSave()
  }

  async function addRowAfter(rowId: string) {
    const idx = rows.findIndex(r => r.id === rowId)
    const newRow: Row = {
      id: crypto.randomUUID(),
      sort_order: 0, // renumbered below
      field_id: '', table_name: selectedTable, field_name: '', display_name: '',
      required: false, ix: false, dtype: 'text', list: false, ref_target: '', validation: '', notes: ''
    }
    // 挿入後に全行を連番で振り直す（sort_order は integer カラムなので小数不可）
    const next = [...rows.slice(0, idx + 1), newRow, ...rows.slice(idx + 1)]
    const renumbered = next.map((r, i) => ({ ...r, sort_order: i }))
    setRows(renumbered)

    const originalOrders = new Map(rows.map(r => [r.id, r.sort_order]))
    const changed = renumbered.filter(r => r.id === newRow.id || originalOrders.get(r.id) !== r.sort_order)
    const { error } = await supabase.from('db_fields').upsert(changed, { onConflict: 'id' })
    if (error) setSaveError(error.message)
    else setSaveError(null)
  }

  async function deleteRow(rowId: string) {
    const row = rows.find(r => r.id === rowId)!
    if (!confirm(`「${row.field_name || '(空)'}」を削除しますか？`)) return
    await supabase.from('db_fields').delete().eq('id', row.id)
    const updated = rows.filter(r => r.id !== rowId)
    setRows(updated)
    if (!updated.some(r => r.table_name === selectedTable)) {
      setSelectedTable(getTableOrder(updated)[0] || '')
    }
  }

  async function createTable() {
    const name = prompt('新しいテーブル名を入力')?.trim()
    if (!name) return
    if (getTableOrder(rows).includes(name)) { alert('同名のテーブルが既に存在します'); return }
    const maxOrder = rows.length > 0 ? Math.max(...rows.map(r => r.sort_order)) : -1
    const newRow: Row = {
      id: crypto.randomUUID(), sort_order: maxOrder + 1,
      field_id: '', table_name: name, field_name: '', display_name: '',
      required: false, ix: false, dtype: 'text', list: false, ref_target: '', validation: '', notes: ''
    }
    setRows(prev => [...prev, newRow])
    const { error } = await supabase.from('db_fields').insert(newRow)
    if (error) { setSaveError(error.message); return }
    setSaveError(null)
    setSelectedTable(name)
    setColFilters({})
    setDtypeFilter('')
  }

  async function deleteTable(name: string) {
    const count = rows.filter(r => r.table_name === name).length
    if (!confirm(`テーブル「${name}」（${count} 行）を削除しますか？`)) return
    const ids = rows.filter(r => r.table_name === name).map(r => r.id)
    await supabase.from('db_fields').delete().in('id', ids)
    const updated = rows.filter(r => r.table_name !== name)
    setRows(updated)
    const remaining = getTableOrder(updated)
    setSelectedTable(remaining[0] || '')
  }

  async function commitRename(oldName: string) {
    const newName = renameValue.trim()
    setRenamingTable(null)
    if (!newName || newName === oldName) return
    if (getTableOrder(rows).includes(newName)) { alert('同名のテーブルが既に存在します'); return }
    const updated = rows.map(r => r.table_name === oldName ? { ...r, table_name: newName } : r)
    setRows(updated)
    if (selectedTable === oldName) setSelectedTable(newName)
    const changed = updated.filter(r => r.table_name === newName)
    setSaving(true)
    await supabase.from('db_fields').upsert(changed, { onConflict: 'id' })
    setSaving(false)
  }

  function startResize(col: string, e: React.MouseEvent) {
    e.preventDefault(); e.stopPropagation()
    const startX = e.clientX, startW = colWidths[col]
    const onMove = (me: MouseEvent) =>
      setColWidths(prev => ({ ...prev, [col]: Math.max(36, startW + me.clientX - startX) }))
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
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
      await supabase.from('db_fields').upsert(changed, { onConflict: 'id' })
      setSaving(false)
    }
  }
  function handleDragEnd() { setDraggingId(null); setDragOverId(null); dragSrcId.current = null }

  function getTableOrder(r: Row[]) {
    const seen = new Set<string>(); const result: string[] = []
    for (const row of r) {
      if (row.table_name && !seen.has(row.table_name)) { seen.add(row.table_name); result.push(row.table_name) }
    }
    return result
  }

  const LIST_TAB = '__list__'
  const tables = getTableOrder(rows)
  const tableRows = rows.filter(r => r.table_name === selectedTable)
  const filtered = tableRows.filter(r => {
    if (dtypeFilter && r.dtype !== dtypeFilter) return false
    for (const [col, val] of Object.entries(colFilters)) {
      if (val && !String(r[col as keyof Row] || '').toLowerCase().includes(val.toLowerCase())) return false
    }
    return true
  })

  if (loading) return <div style={{ padding: 20, color: '#555568' }}>読み込み中...</div>

  const ResizableTh = ({ col, children, style }: { col: string; children?: React.ReactNode; style?: React.CSSProperties }) => (
    <th style={{ ...thStyle, width: colWidths[col], position: 'relative', ...style }}>
      {children}
      <div onMouseDown={e => startResize(col, e)} style={resizerStyle} />
    </th>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* DataType / OptionSet tabs */}
      <div style={{
        display: 'flex', alignItems: 'stretch', background: '#252528',
        borderBottom: '1px solid #38383f', padding: '0 14px', gap: 2, flexShrink: 0
      }}>
        {([['fields', 'DataType'], ['os', 'OptionSet']] as const).map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            display: 'flex', alignItems: 'center', padding: '0 14px', border: 'none',
            background: 'transparent', color: tab === id ? '#90b8f0' : '#686880',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', height: 34,
            borderBottom: `2px solid ${tab === id ? '#4a8ad8' : 'transparent'}`,
            marginBottom: -1, whiteSpace: 'nowrap'
          }}>{label}</button>
        ))}
      </div>

      {/* Main area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Content area ── */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

          {tab === 'os' && <OptionSetsTab />}

          {tab === 'fields' && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

              {/* Topbar */}
              <div style={{
                padding: '7px 14px', background: '#2a2a2f', borderBottom: '1px solid #38383f',
                display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0
              }}>
                <h1 style={{ fontSize: 15, fontWeight: 700, color: '#d0d0d8', whiteSpace: 'nowrap' }}>
                  {selectedTable === LIST_TAB ? 'テーブル一覧' : 'DB フィールド一覧'}
                </h1>
                <div style={{ flex: 1 }} />
                {saving && <span style={{ fontSize: 11, color: '#5588cc' }}>保存中...</span>}
                {saveError && (
                  <span style={{ fontSize: 11, color: '#ea4335', background: 'rgba(234,67,53,.1)', border: '1px solid rgba(234,67,53,.3)', borderRadius: 4, padding: '2px 8px', maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={saveError}>
                    ⚠ 保存失敗: {saveError}
                  </span>
                )}
                {selectedTable !== LIST_TAB && <span style={{ fontSize: 11, color: '#666678', whiteSpace: 'nowrap' }}>全 {rows.length} 行</span>}
              </div>

              {/* テーブル一覧ビュー */}
              {selectedTable === LIST_TAB && (
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
                  {/* DataType */}
                  <div style={{ marginBottom: 28 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#5588cc', letterSpacing: '.6px', textTransform: 'uppercase', marginBottom: 8 }}>
                      DataType — {tables.length} テーブル
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr>
                          {['テーブル名', 'フィールド数', '説明'].map(h => (
                            <th key={h} style={{ background: '#252528', color: '#9090a8', padding: '6px 10px', textAlign: 'left', fontWeight: 700, borderBottom: '1px solid #38383f', whiteSpace: 'nowrap' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tables.map(t => {
                          const count = rows.filter(r => r.table_name === t && (r.field_name || r.display_name)).length
                          return (
                            <tr key={t}
                              onClick={() => setSelectedTable(t)}
                              style={{ cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,.05)' }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(74,138,216,.07)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            >
                              <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontWeight: 700, color: '#90b8f0', whiteSpace: 'nowrap' }}>{t}</td>
                              <td style={{ padding: '7px 10px', color: '#666678', textAlign: 'center' }}>{count}</td>
                              <td style={{ padding: '7px 10px', color: '#8888a8' }}>{TABLE_DESCRIPTIONS[t] || '—'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* OptionSet */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#a09050', letterSpacing: '.6px', textTransform: 'uppercase', marginBottom: 8 }}>
                      OptionSet — {osNames.length} セット
                    </div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead>
                        <tr>
                          {['セット名', '説明'].map(h => (
                            <th key={h} style={{ background: '#252528', color: '#9090a8', padding: '6px 10px', textAlign: 'left', fontWeight: 700, borderBottom: '1px solid #38383f' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {osNames.map(name => (
                          <tr key={name}
                            onClick={() => setTab('os')}
                            style={{ cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,.05)' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(160,144,80,.07)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            <td style={{ padding: '7px 10px', fontFamily: 'monospace', fontWeight: 700, color: '#c8b060', whiteSpace: 'nowrap' }}>{name}</td>
                            <td style={{ padding: '7px 10px', color: '#8888a8' }}>{OS_DESCRIPTIONS[name] || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Field editor */}
              {selectedTable !== LIST_TAB && selectedTable ? (
                <div style={{ flex: 1, overflow: 'auto' }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: 22 }} />
                      {FRONT_COLS.map(c => <col key={c.key} style={{ width: colWidths[c.key] }} />)}
                      <col style={{ width: colWidths.required }} />
                      <col style={{ width: colWidths.ix }} />
                      <col style={{ width: colWidths.dtype }} />
                      <col style={{ width: colWidths.list }} />
                      {BACK_COLS.map(c => <col key={c.key} style={{ width: colWidths[c.key] }} />)}
                      <col style={{ width: 68 }} />
                    </colgroup>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                      <tr>
                        <th style={{ ...thStyle, width: 22, background: '#252528' }}></th>
                        {FRONT_COLS.map(c => <ResizableTh key={c.key} col={c.key}>{c.label}</ResizableTh>)}
                        <ResizableTh col="required" style={{ textAlign: 'center' }}>必須</ResizableTh>
                        <ResizableTh col="ix" style={{ textAlign: 'center' }}>index</ResizableTh>
                        <ResizableTh col="dtype">データ型</ResizableTh>
                        <ResizableTh col="list" style={{ textAlign: 'center' }}>List</ResizableTh>
                        {BACK_COLS.map(c => <ResizableTh key={c.key} col={c.key}>{c.label}</ResizableTh>)}
                        <th style={{ ...thStyle, width: 68, background: '#252528' }}></th>
                      </tr>
                      <tr>
                        <th style={thFilterStyle}></th>
                        {FRONT_COLS.map(c => (
                          <th key={c.key} style={thFilterStyle}>
                            <input placeholder={c.placeholder} value={colFilters[c.key] || ''}
                              onChange={e => setColFilters(prev => ({ ...prev, [c.key]: e.target.value }))}
                              style={colFilterInputStyle} />
                          </th>
                        ))}
                        <th style={thFilterStyle}></th>
                        <th style={thFilterStyle}></th>
                        <th style={thFilterStyle}>
                          <select value={dtypeFilter} onChange={e => setDtypeFilter(e.target.value)}
                            style={{ ...colFilterInputStyle, cursor: 'pointer', color: dtypeFilter ? '#b8b8c8' : '#66667a' }}>
                            <option value="">データ型</option>
                            {DTYPES.map(dt => <option key={dt} value={dt}>{dt}</option>)}
                          </select>
                        </th>
                        <th style={thFilterStyle}></th>
                        {BACK_COLS.map(c => (
                          <th key={c.key} style={thFilterStyle}>
                            {!c.select && (
                              <input placeholder={c.placeholder} value={colFilters[c.key] || ''}
                                onChange={e => setColFilters(prev => ({ ...prev, [c.key]: e.target.value }))}
                                style={colFilterInputStyle} />
                            )}
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
                            opacity: draggingId === row.id ? 0.4 : 1,
                            borderTop: dragOverId === row.id ? '2px solid #5588aa' : undefined,
                          }}
                        >
                          <td style={dragTdStyle}>⠿</td>
                          {FRONT_COLS.map(c => (
                            <td key={c.key} contentEditable suppressContentEditableWarning
                              onBlur={e => updateRow(row.id, { [c.key]: e.currentTarget.textContent || '' })}
                              style={{ ...tdStyle, ...(c.key === 'field_name' ? { fontFamily: 'monospace', color: '#a0b0c0' } : {}) }}>
                              {row[c.key] as string}
                            </td>
                          ))}
                          <td style={boolTdStyle} onClick={() => updateRow(row.id, { required: !row.required })}>
                            <input type="checkbox" checked={row.required} readOnly style={cbStyle} />
                          </td>
                          <td style={boolTdStyle} onClick={() => updateRow(row.id, { ix: !row.ix })}>
                            <input type="checkbox" checked={row.ix} readOnly style={cbStyle} />
                          </td>
                          <td style={{ ...tdStyle, padding: '2px 4px' }}>
                            <select value={row.dtype} onChange={e => updateRow(row.id, { dtype: e.target.value })}
                              style={{
                                width: '100%', border: 'none', borderRadius: 3, padding: '2px 4px',
                                fontSize: 13, cursor: 'pointer', outline: 'none', fontFamily: 'inherit',
                                fontWeight: 700, background: 'transparent', color: DTYPE_COLORS[row.dtype] || '#c0c0cc'
                              }}>
                              {DTYPES.map(dt => <option key={dt} value={dt} style={{ background: '#2a2a2f', color: '#c0c0cc' }}>{dt}</option>)}
                            </select>
                          </td>
                          <td style={boolTdStyle} onClick={() => updateRow(row.id, { list: !row.list })}>
                            <input type="checkbox" checked={row.list} readOnly style={cbStyle} />
                          </td>
                          {BACK_COLS.map(c => c.select ? (
                            <td key={c.key} style={{ ...tdStyle, padding: '2px 4px' }}>
                              <select
                                value={row[c.key] as string}
                                onChange={e => updateRow(row.id, { [c.key]: e.target.value })}
                                style={{
                                  width: '100%', border: 'none', borderRadius: 3, padding: '2px 4px',
                                  fontSize: 12, cursor: 'pointer', outline: 'none', fontFamily: 'monospace',
                                  background: 'transparent',
                                  color: row[c.key] ? '#80cbc4' : '#444458'
                                }}>
                                <option value="" style={{ background: '#2a2a2f', color: '#888898' }}>—</option>
                                {tables.map(t => (
                                  <option key={t} value={t} style={{ background: '#2a2a2f', color: '#80cbc4' }}>{t}</option>
                                ))}
                              </select>
                            </td>
                          ) : (
                            <td key={c.key} contentEditable suppressContentEditableWarning
                              onBlur={e => updateRow(row.id, { [c.key]: e.currentTarget.textContent || '' })}
                              style={tdStyle}>
                              {row[c.key] as string}
                            </td>
                          ))}
                          <td style={actTdStyle}>
                            <button onClick={() => addRowAfter(row.id)} style={addBtnStyle}>+</button>
                            <button onClick={() => deleteRow(row.id)} style={delBtnStyle}>−</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : selectedTable !== LIST_TAB ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <button onClick={createTable} style={{
                    padding: '10px 20px', background: '#34a853', border: 'none',
                    borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600
                  }}>+ 最初のテーブルを作成</button>
                </div>
              ) : null}

              {/* Status bar */}
              {selectedTable !== LIST_TAB && (
                <div style={{
                  background: '#2e2e34', borderTop: '1px solid #38383f',
                  padding: '4px 12px', fontSize: 11, color: '#666678',
                  display: 'flex', justifyContent: 'space-between', flexShrink: 0
                }}>
                  <span>{filtered.length} 件 / {tableRows.length} 行</span>
                  <span>自動保存</span>
                </div>
              )}

              {/* Sheet tabs */}
              <div style={{
                display: 'flex', alignItems: 'stretch', background: '#1a1a1f',
                borderTop: '1px solid #38383f', flexShrink: 0, overflowX: 'auto', minHeight: 34
              }}>
                {/* 固定: テーブル一覧 */}
                <button
                  onClick={() => setSelectedTable(LIST_TAB)}
                  style={{
                    padding: '0 18px', border: 'none', borderRight: '1px solid #2e2e38',
                    borderTop: selectedTable === LIST_TAB ? '2px solid #4a8ad8' : '2px solid transparent',
                    background: selectedTable === LIST_TAB ? '#2a2a2f' : 'transparent',
                    color: selectedTable === LIST_TAB ? '#90b8f0' : '#686880',
                    fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                    minHeight: 34,
                  }}>
                  テーブル一覧
                </button>
                {tables.map(t => (
                  <button key={t}
                    onClick={() => { setSelectedTable(t); setColFilters({}); setDtypeFilter('') }}
                    onDoubleClick={() => { setRenamingTable(t); setRenameValue(t) }}
                    title="ダブルクリックでリネーム"
                    style={{
                      padding: '0 18px', border: 'none', borderRight: '1px solid #2e2e38',
                      borderTop: t === selectedTable ? '2px solid #4a8ad8' : '2px solid transparent',
                      background: t === selectedTable ? '#2a2a2f' : 'transparent',
                      color: t === selectedTable ? '#90b8f0' : '#686880',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                      minHeight: 34, transition: 'background .1s, color .1s'
                    }}
                  >
                    {renamingTable === t ? (
                      <input autoFocus value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onBlur={() => commitRename(t)}
                        onKeyDown={e => { if (e.key === 'Enter') commitRename(t); if (e.key === 'Escape') setRenamingTable(null) }}
                        onClick={e => e.stopPropagation()}
                        style={{ background: '#38383f', border: '1px solid #5588aa', borderRadius: 3, color: '#d0d0d8', fontSize: 12, padding: '1px 6px', outline: 'none', width: 120 }}
                      />
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {t}
                        <span
                          onClick={e => { e.stopPropagation(); deleteTable(t) }}
                          title="テーブルを削除"
                          style={{ fontSize: 11, color: '#555568', lineHeight: 1, cursor: 'pointer', padding: '0 1px' }}
                        >✕</span>
                      </span>
                    )}
                  </button>
                ))}
                <button onClick={createTable} title="新しいテーブルを作成"
                  style={{
                    padding: '0 14px', border: 'none', background: 'transparent',
                    color: '#555568', fontSize: 18, cursor: 'pointer', minHeight: 34,
                    display: 'flex', alignItems: 'center', lineHeight: 1, borderTop: '2px solid transparent'
                  }}>+</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const resizerStyle: React.CSSProperties = {
  position: 'absolute', right: 0, top: 0, width: 5, height: '100%',
  cursor: 'col-resize', userSelect: 'none', zIndex: 1,
}
const thFilterStyle: React.CSSProperties = {
  background: '#2e2e34', padding: '3px 5px', borderRight: '1px solid #38383f'
}
const colFilterInputStyle: React.CSSProperties = {
  width: '100%', border: '1px solid #44444f', borderRadius: 3,
  padding: '3px 6px', fontSize: 11, outline: 'none', background: '#38383f', color: '#b8b8c8'
}
const thStyle: React.CSSProperties = {
  background: '#2a2a2f', color: '#9090a8', padding: '7px 8px',
  textAlign: 'left', fontSize: 12, fontWeight: 700,
  borderRight: '1px solid rgba(255,255,255,.06)', whiteSpace: 'nowrap', overflow: 'hidden'
}
const tdStyle: React.CSSProperties = {
  padding: '4px 7px', verticalAlign: 'middle',
  borderRight: '1px solid rgba(255,255,255,.04)',
  lineHeight: 1.4, color: '#c0c0cc', outline: 'none',
  whiteSpace: 'pre-wrap', wordBreak: 'break-word'
}
const boolTdStyle: React.CSSProperties = {
  textAlign: 'center', cursor: 'pointer', padding: 0,
  borderRight: '1px solid rgba(255,255,255,.04)', verticalAlign: 'middle'
}
const cbStyle: React.CSSProperties = {
  width: 14, height: 14, cursor: 'pointer', accentColor: '#7ab3ff', pointerEvents: 'none'
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
