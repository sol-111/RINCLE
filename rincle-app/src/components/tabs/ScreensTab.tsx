'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'
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



type ColKey = 'screen_id' | 'item' | 'component' | 'feature' | 'improvement' | 'path'
const ALL_COLS: ColKey[] = ['screen_id', 'item', 'component', 'feature', 'improvement', 'path']

const COL_LABELS: Record<ColKey, string> = {
  screen_id: '機能ID', item: '項目', component: '画面 / コンポーネント',
  feature: '含まれる機能', improvement: '改善点', path: 'path / para',
}

const COL_PLACEHOLDERS: Record<ColKey, string> = {
  screen_id: 'ID', item: '項目', component: '画面 / コンポーネント', feature: '機能',
  improvement: '改善点', path: 'path',
}

const INIT_WIDTHS: Record<ColKey, number> = {
  screen_id: 44, item: 150, component: 140, feature: 250,
  improvement: 220, path: 190,
}

// ── Static content ──────────────────────────────────────────────────────────
type SummaryTab = '全体' | '利用者' | '店舗管理者' | 'システム管理者'
const SUMMARY_TABS: SummaryTab[] = ['全体', '利用者', '店舗管理者', 'システム管理者']

const ROLE_DATA: Record<Exclude<SummaryTab, '全体'>, {
  accent: string; screenCount: number; uiElements: number; workflows: number; screens: string[]
}> = {
  '利用者': {
    accent: '#4a90d9', screenCount: 23, uiElements: 75, workflows: 228,
    screens: ['TOP', '空車検索', '検索一覧', '店舗詳細', '自転車詳細', '予約内容(空車検索)', '予約内容(顧客情報入力)', '予約内容(予約内容確認)', '予約内容(決済)', '予約一覧', 'カード情報入力', '新着情報一覧', '新着情報詳細', 'お知らせ一覧', 'お知らせ詳細', 'FAQ一覧', 'ログイン', '新規会員登録', 'マイページ', 'アカウント詳細/編集', 'お問い合わせ', '規約等', 'パスワード再設定'],
  },
  '店舗管理者': {
    accent: '#66bb6a', screenCount: 15, uiElements: 32, workflows: 156,
    screens: ['ログイン', '予約一覧', '過去の予約', '売上レポート', '顧客一覧', '自転車一覧', 'オプション管理', '営業時間設定', '営業カレンダー', '店舗情報', 'お問い合わせ一覧', 'メールアドレス変更', 'パスワード変更', 'パスワードリセット', 'ログアウト'],
  },
  'システム管理者': {
    accent: '#ef5350', screenCount: 17, uiElements: 29, workflows: 127,
    screens: ['ログイン', '顧客一覧', '加盟店一覧', '料金表管理', '予約一覧', '売上レポート', 'FV管理', 'お知らせ管理', 'バナー管理', 'Q&A管理', 'お問い合わせ一覧', 'メールアドレス変更', 'パスワード変更', '営業カレンダー', '料金シミュレーション', 'パスワードリセット', 'ログアウト'],
  },
}

// ── Main component ──────────────────────────────────────────────────────────
export default function ScreensTab() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [tableTab, setTableTab] = useState<SummaryTab>('全体')
  const [search, setSearch] = useState('')
  const [colFilterKey, setColFilterKey] = useState<ColKey | ''>('')
  const [groupFilter, setGroupFilter] = useState('')
  const [onlyIssues, setOnlyIssues] = useState(false)
  const [colFilters, setColFilters] = useState<Record<ColKey, string>>({
    screen_id: '', item: '', component: '', feature: '', improvement: '', path: ''
  })
  const [colWidths, setColWidths] = useState<Record<ColKey, number>>({ ...INIT_WIDTHS })
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [selectedCell, setSelectedCell] = useState<{ rowId: string; col: string } | null>(null)
  const [editingCell, setEditingCell] = useState<{ rowId: string; col: string } | null>(null)
  const [selFocus, setSelFocus] = useState<{ rowId: string; col: string } | null>(null)
  const [fillSrc, setFillSrc] = useState<{ rowId: string; col: string } | null>(null)
  const [fillTarget, setFillTarget] = useState<string | null>(null)

  const dragSrcId      = useRef<string | null>(null)
  const dragHandleActive = useRef(false)
  const dirtyRows = useRef<Map<string, Row>>(new Map())
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
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
        const ci = ALL_COLS.indexOf(sc.col as ColKey)
        if (ri !== -1 && ci !== -1) {
          let nr = ri, nc = ci
          if (e.key === 'ArrowUp') nr = Math.max(0, ri - 1)
          else if (e.key === 'ArrowDown') nr = Math.min(cur.length - 1, ri + 1)
          else if (e.key === 'ArrowLeft') nc = Math.max(0, ci - 1)
          else if (e.key === 'ArrowRight') nc = Math.min(ALL_COLS.length - 1, ci + 1)
          const newRow = cur[nr]; const newCol = ALL_COLS[nc]
          if (newRow && newCol) { setSelectedCell({ rowId: newRow.id, col: newCol }); setSelFocus(null) }
        }
        return
      }
      if (!sc || ec) return
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isMeta) {
        e.preventDefault()
        const CLEARABLE = new Set<ColKey>(['item', 'component', 'feature', 'improvement', 'path'])
        if (sf) {
          const cur = filteredRef.current
          const si = cur.findIndex(r => r.id === sc.rowId)
          const fi = cur.findIndex(r => r.id === sf.rowId)
          const ci = ALL_COLS.indexOf(sc.col as ColKey)
          const fci = ALL_COLS.indexOf(sf.col as ColKey)
          if (si !== -1 && fi !== -1 && ci !== -1 && fci !== -1) {
            const [ra, rb] = [Math.min(si, fi), Math.max(si, fi)]
            const [ca, cb] = [Math.min(ci, fci), Math.max(ci, fci)]
            cur.slice(ra, rb + 1).forEach(r => ALL_COLS.slice(ca, cb + 1).filter(k => CLEARABLE.has(k)).forEach(k => updateCell(r.id, k as keyof Row, '')))
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
          const ci = ALL_COLS.indexOf(sc.col as ColKey)
          const fci = ALL_COLS.indexOf(sf.col as ColKey)
          if (si !== -1 && fi !== -1 && ci !== -1 && fci !== -1) {
            const [ra, rb] = [Math.min(si, fi), Math.max(si, fi)]
            const [ca, cb] = [Math.min(ci, fci), Math.max(ci, fci)]
            const cols = ALL_COLS.slice(ca, cb + 1)
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
          const startCi = ALL_COLS.indexOf(sc2.col as ColKey)
          if (startRi === -1 || startCi === -1) return
          text.split('\n').forEach((line, ri) => {
            const row = cur[startRi + ri]
            if (!row) return
            line.split('\t').forEach((val, ci) => {
              const col = ALL_COLS[startCi + ci]
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

  function getRole(screenId: string): Exclude<SummaryTab, '全体'> | null {
    if (screenId.startsWith('U')) return '利用者'
    if (screenId.startsWith('S')) return '店舗管理者'
    if (screenId.startsWith('A')) return 'システム管理者'
    return null
  }

  useEffect(() => {
    supabase.from('screens').select('*').order('sort_order').then(async ({ data }) => {
      if (data && data.length > 0) {
        setRows(data)
        setLoading(false)
        return
      }
      // Seed initial data if table is empty
      // item=画面名(画面遷移図と同名), component=Bubble実装画面名
      const seed: Omit<Row, 'id'>[] = [
        // ── 利用者 ──
        { sort_order:0,  screen_id:'U-01', item:'TOP', component:'index', feature:'FVスライダー、空車検索フォーム、新着情報・TOPICSリスト', detail:'完了', improvement:'', path:'/index/top_search' },
        { sort_order:1,  screen_id:'U-02', item:'空車検索', component:'index', feature:'エリア選択、日付入力（Pikaday）、自転車種類フィルタ、検索ボタン', detail:'完了', improvement:'', path:'/index/top_search' },
        { sort_order:2,  screen_id:'U-03', item:'検索一覧', component:'index', feature:'「貸出可能な自転車をすべて見る」→「詳細を見る」の2ステップ導線', detail:'完了', improvement:'', path:'/index/search_bicycle' },
        { sort_order:3,  screen_id:'U-04', item:'店舗詳細', component:'shop_detail', feature:'店舗名、住所、アクセス、Google Maps表示', detail:'完了', improvement:'', path:'/index/shop_detail' },
        { sort_order:4,  screen_id:'U-05', item:'自転車詳細', component:'index', feature:'画像、スペック、料金表示、Pikadayカレンダー（貸出日/返却日）、時間選択、「予約画面へ進む」', detail:'完了', improvement:'', path:'/index/bicycle_detail' },
        { sort_order:5,  screen_id:'U-06', item:'予約内容(空車検索)', component:'index', feature:'選択自転車の確認、料金表示、「お客様情報の入力へ」ボタン', detail:'完了', improvement:'', path:'/index/cart' },
        { sort_order:6,  screen_id:'U-07', item:'予約内容(顧客情報入力)', component:'index', feature:'氏名、住所、電話番号入力、「予約内容の確認に進む」', detail:'完了', improvement:'', path:'/index/cart' },
        { sort_order:7,  screen_id:'U-08', item:'予約内容(予約内容確認)', component:'index', feature:'予約内容最終確認、「予約する」ボタン', detail:'完了', improvement:'', path:'/index/cart' },
        { sort_order:8,  screen_id:'U-09', item:'予約内容(決済)', component:'index', feature:'Pay.JP連携、カード情報入力、決済処理', detail:'完了', improvement:'', path:'/index/cart' },
        { sort_order:9,  screen_id:'U-10', item:'予約一覧', component:'user_reservation_list', feature:'予約一覧表示、「予約をキャンセルする」、確認ダイアログ', detail:'完了', improvement:'', path:'/user_reservation_list' },
        { sort_order:10, screen_id:'U-11', item:'カード情報入力', component:'index', feature:'Pay.JPカード情報入力ポップアップ', detail:'完了', improvement:'', path:'/index/cart' },
        { sort_order:11, screen_id:'U-12', item:'ログイン', component:'index', feature:'メール/パスワード入力、ログインボタン', detail:'完了', improvement:'', path:'/' },
        { sort_order:12, screen_id:'U-13', item:'新規会員登録', component:'index', feature:'会員情報入力、登録ボタン', detail:'完了', improvement:'', path:'/' },
        { sort_order:13, screen_id:'U-14', item:'マイページ', component:'index', feature:'アカウント編集、予約一覧、退会するボタン、メールアドレス表示', detail:'完了', improvement:'', path:'/index/mypage' },
        { sort_order:14, screen_id:'U-15', item:'アカウント詳細/編集', component:'index', feature:'個人情報編集、「変更を完了する」ボタン', detail:'完了', improvement:'', path:'/index/edit' },
        { sort_order:15, screen_id:'U-16', item:'FAQ一覧', component:'index', feature:'よくある質問の一覧表示', detail:'完了', improvement:'', path:'/index/faq' },
        { sort_order:16, screen_id:'U-17', item:'お問い合わせ', component:'index', feature:'問い合わせフォーム、送信ボタン', detail:'完了', improvement:'', path:'/index/contact' },
        { sort_order:17, screen_id:'U-18', item:'規約等', component:'shop_term', feature:'プライバシーポリシー、利用規約表示', detail:'完了', improvement:'', path:'/index/privacypolicy' },
        { sort_order:18, screen_id:'U-19', item:'新着情報一覧', component:'index', feature:'新着情報リスト表示', detail:'完了', improvement:'', path:'/index/news' },
        { sort_order:19, screen_id:'U-20', item:'新着情報詳細', component:'index', feature:'新着情報本文表示、「一覧へ戻る」ボタン', detail:'完了', improvement:'', path:'/index/news_detail' },
        { sort_order:20, screen_id:'U-21', item:'お知らせ一覧', component:'index', feature:'お知らせリスト表示', detail:'完了', improvement:'', path:'/index/topics' },
        { sort_order:21, screen_id:'U-22', item:'お知らせ詳細', component:'index', feature:'お知らせ本文表示、「一覧へ戻る」ボタン', detail:'完了', improvement:'', path:'/index/topics_detail' },
        { sort_order:22, screen_id:'U-23', item:'会社概要', component:'(外部)', feature:'会社概要ページ（外部リンク）', detail:'完了', improvement:'', path:'' },
        { sort_order:23, screen_id:'U-24', item:'パスワード再設定', component:'reset_pw', feature:'パスワード再設定フォーム', detail:'完了', improvement:'', path:'/reset_pw' },
        // ── 店舗管理者 ──
        { sort_order:24, screen_id:'S-01', item:'店舗管理ログイン', component:'shop_admin_login', feature:'「加盟店様用 管理画面ログイン」、メール/パスワード入力、パスワードリセット', detail:'完了', improvement:'', path:'/shop_admin_login' },
        { sort_order:25, screen_id:'S-02', item:'予約一覧(デフォルト)', component:'shop_admin', feature:'予約リスト、CSVダウンロード、貸出日フィルタ（Pikaday）、ステータス絞り込み', detail:'完了', improvement:'', path:'/shop_admin' },
        { sort_order:26, screen_id:'S-03', item:'過去の予約', component:'shop_admin', feature:'過去の予約リスト表示、検索・フィルタ', detail:'完了', improvement:'', path:'/shop_admin' },
        { sort_order:27, screen_id:'S-04', item:'売上レポート', component:'shop_admin', feature:'売上データ表示、期間選択', detail:'完了', improvement:'', path:'/shop_admin' },
        { sort_order:28, screen_id:'S-05', item:'顧客一覧', component:'shop_admin', feature:'顧客リスト、キーワード検索、ソート（新着順/古い順）', detail:'完了', improvement:'', path:'/shop_admin' },
        { sort_order:29, screen_id:'S-06', item:'自転車一覧', component:'shop_admin', feature:'自転車リスト、追加/編集Popup（29要素）、画像アップロード', detail:'完了', improvement:'', path:'/shop_admin' },
        { sort_order:30, screen_id:'S-07', item:'オプション管理', component:'shop_admin', feature:'オプション追加/編集Popup、オプション一覧', detail:'完了', improvement:'', path:'/shop_admin' },
        { sort_order:31, screen_id:'S-08', item:'営業時間設定', component:'shop_admin', feature:'曜日別営業時間設定、時/分入力', detail:'完了', improvement:'', path:'/shop_admin' },
        { sort_order:32, screen_id:'S-09', item:'営業カレンダー', component:'shop_admin', feature:'日付別の営業/休業設定、月表示', detail:'完了', improvement:'', path:'/shop_admin' },
        { sort_order:33, screen_id:'S-10', item:'店舗情報', component:'shop_admin', feature:'店舗名、住所、「住所に反映」（Google Maps連携）、画像アップロード、保存', detail:'完了', improvement:'', path:'/shop_admin' },
        { sort_order:34, screen_id:'S-11', item:'お問い合わせ一覧', component:'shop_admin', feature:'問い合わせリスト表示', detail:'完了', improvement:'', path:'/shop_admin' },
        { sort_order:35, screen_id:'S-12', item:'メールアドレス変更', component:'shop_admin', feature:'変更後/確認用メールアドレス入力、変更ボタン', detail:'完了', improvement:'', path:'/shop_admin' },
        { sort_order:36, screen_id:'S-13', item:'パスワード変更', component:'shop_admin', feature:'現在/新規/確認パスワード入力、変更ボタン', detail:'完了', improvement:'', path:'/shop_admin' },
        { sort_order:37, screen_id:'S-14', item:'パスワードリセット', component:'shop_admin_login', feature:'パスワード再設定メール送信フォーム', detail:'完了', improvement:'', path:'/shop_admin_login' },
        // ── システム管理者 ──
        { sort_order:38, screen_id:'A-01', item:'管理画面ログイン', component:'admin_login', feature:'「管理画面ログイン」、メール/パスワード入力、パスワードリセット', detail:'完了', improvement:'', path:'/admin_login' },
        { sort_order:39, screen_id:'A-02', item:'顧客一覧(デフォルト)', component:'admin', feature:'顧客リスト、CSVダウンロード、キーワード検索、ソート（新着順/古い順）', detail:'完了', improvement:'', path:'/admin' },
        { sort_order:40, screen_id:'A-03', item:'加盟店一覧', component:'admin', feature:'加盟店リスト、詳細/新規追加/編集/削除/アーカイブ', detail:'完了', improvement:'', path:'/admin' },
        { sort_order:41, screen_id:'A-04', item:'料金表管理', component:'admin', feature:'料金表一覧、登録日/更新日表示、新規追加/編集', detail:'完了', improvement:'', path:'/admin' },
        { sort_order:42, screen_id:'A-05', item:'予約一覧', component:'admin', feature:'全予約リスト、ステータス/決済方法フィルタ、並び替え', detail:'完了', improvement:'', path:'/admin' },
        { sort_order:43, screen_id:'A-06', item:'売上レポート', component:'admin', feature:'売上データ表示、加盟店別レポート', detail:'完了', improvement:'', path:'/admin' },
        { sort_order:44, screen_id:'A-07', item:'FV管理', component:'admin', feature:'ファーストビュー画像/テキスト管理、新規追加/編集/削除', detail:'完了', improvement:'', path:'/admin' },
        { sort_order:45, screen_id:'A-08', item:'お知らせ管理', component:'admin', feature:'お知らせ一覧、新規追加/編集/削除', detail:'完了', improvement:'', path:'/admin' },
        { sort_order:46, screen_id:'A-09', item:'バナー管理', component:'admin', feature:'バナー画像管理、表示順設定', detail:'完了', improvement:'', path:'/admin' },
        { sort_order:47, screen_id:'A-10', item:'Q&A管理', component:'admin', feature:'Q&A一覧、新規追加/編集/削除', detail:'完了', improvement:'', path:'/admin' },
        { sort_order:48, screen_id:'A-11', item:'お問い合わせ一覧', component:'admin', feature:'全問い合わせリスト表示', detail:'完了', improvement:'', path:'/admin' },
        { sort_order:49, screen_id:'A-12', item:'メールアドレス変更', component:'admin', feature:'変更後/確認用メールアドレス入力', detail:'完了', improvement:'', path:'/admin' },
        { sort_order:50, screen_id:'A-13', item:'パスワード変更', component:'admin', feature:'現在/新規/確認パスワード入力', detail:'完了', improvement:'', path:'/admin' },
        { sort_order:51, screen_id:'A-14', item:'営業カレンダー', component:'admin_update_calendar', feature:'祝日処理ボタン、営業カレンダー追加、日付管理', detail:'完了', improvement:'', path:'/admin_update_calendar' },
        { sort_order:52, screen_id:'A-15', item:'料金シミュレーション', component:'admin_price_simulation', feature:'貸出開始日時/返却日入力、料金/適用プラン表示、シミュレーション実行', detail:'完了', improvement:'', path:'/admin_price_simulation' },
        { sort_order:53, screen_id:'A-16', item:'パスワードリセット', component:'admin_login', feature:'パスワード再設定メール送信フォーム', detail:'完了', improvement:'', path:'/admin_login' },
      ]
      const newRows = seed.map(s => ({ ...s, id: crypto.randomUUID() } as Row))
      setRows(newRows)
      setLoading(false)
      await supabase.from('screens').insert(newRows)
    })
  }, [])

  const scheduleSave = useCallback(() => {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      const toSave = [...dirtyRows.current.values()]
      dirtyRows.current.clear()
      if (toSave.length === 0) return
      setSaving(true)
      await supabase.from('screens').upsert(toSave)
      setSaving(false)
    }, 800)
  }, [supabase])

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

  async function addRowAfter(rowId: string) {
    const idx = rows.findIndex(r => r.id === rowId)
    const after = rows[idx]
    const before = rows[idx + 1]
    const sortOrder = before ? (after.sort_order + before.sort_order) / 2 : after.sort_order + 1
    const newRow: Row = {
      id: crypto.randomUUID(), sort_order: sortOrder,
      screen_id: '', item: '', component: '', feature: '',
      detail: '未着手', improvement: '', path: '',
    }
    setRows(prev => [...prev.slice(0, idx + 1), newRow, ...prev.slice(idx + 1)])
    await supabase.from('screens').insert(newRow)
  }

  async function deleteRow(rowId: string) {
    const row = rows.find(r => r.id === rowId)!
    if (!confirm(`「${row.feature || row.item || '(空)'}」を削除しますか？`)) return
    await supabase.from('screens').delete().eq('id', row.id)
    setRows(prev => prev.filter(r => r.id !== rowId))
  }

function startResize(col: ColKey, e: React.MouseEvent) {
    e.preventDefault()
    const startX = e.clientX, startW = colWidths[col]
    const onMove = (me: MouseEvent) =>
      setColWidths(prev => ({ ...prev, [col]: Math.max(40, startW + me.clientX - startX) }))
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function computeEffectiveItems(r: Row[]) {
    let last = ''
    return r.map(row => { if (row.item) last = row.item; return last })
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
    if (changed.length > 0) { setSaving(true); await supabase.from('screens').upsert(changed); setSaving(false) }
  }
  function handleDragEnd() { setDraggingId(null); setDragOverId(null); dragSrcId.current = null; dragHandleActive.current = false }

  // Build effective item per row (inherit from previous non-empty)
  let lastItem = ''
  const effectiveItems = rows.map(r => { if (r.item) lastItem = r.item; return lastItem })

  const filtered = rows.filter((r, i) => {
    if (tableTab !== '全体') {
      const role = getRole(r.screen_id)
      if (role !== tableTab) return false
    }
    if (groupFilter && effectiveItems[i] !== groupFilter) return false
    if (onlyIssues && !r.improvement) return false
    if (search) {
      const hay = colFilterKey
        ? String(r[colFilterKey] || '').toLowerCase()
        : ALL_COLS.map(k => r[k]).join(' ').toLowerCase()
      if (!hay.includes(search.toLowerCase())) return false
    }
    for (const k of ALL_COLS) {
      if (colFilters[k] && !String(r[k] || '').toLowerCase().includes(colFilters[k].toLowerCase())) return false
    }
    return true
  })

  filteredRef.current = filtered

  const selRange = new Set<string>()
  if (selectedCell && selFocus) {
    const si = filtered.findIndex(r => r.id === selectedCell.rowId)
    const fi = filtered.findIndex(r => r.id === selFocus.rowId)
    const ci = ALL_COLS.indexOf(selectedCell.col as ColKey)
    const fci = ALL_COLS.indexOf(selFocus.col as ColKey)
    if (si !== -1 && fi !== -1 && ci !== -1 && fci !== -1) {
      const [ra, rb] = [Math.min(si, fi), Math.max(si, fi)]
      const [ca, cb] = [Math.min(ci, fci), Math.max(ci, fci)]
      filtered.slice(ra, rb + 1).forEach(r => ALL_COLS.slice(ca, cb + 1).forEach(k => selRange.add(`${r.id}:${k}`)))
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
        gap: 10, boxShadow: '0 2px 8px rgba(0,0,0,.5)', borderBottom: '1px solid #38383f', flexShrink: 0,
      }}>
        <h1 style={{ fontSize: 15, fontWeight: 700, color: '#d0d0d8', whiteSpace: 'nowrap' }}>📊 画面設計書</h1>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 全体検索..."
          style={{ flex: 1, maxWidth: 380, padding: '5px 11px', border: '1px solid #444450', borderRadius: 4, fontSize: 13, outline: 'none', background: '#38383f', color: '#d0d0d8' }}
        />
        {saving && <span style={{ fontSize: 11, color: '#5588cc' }}>保存中...</span>}
      </div>

      {/* Content (scrollable) */}
      <div style={{ flex: 1, overflow: 'auto', padding: 14 }}>

        {(<>


        {/* ── Card: 画面/機能一覧 ── */}
        <div style={{ ...cardStyle, marginBottom: 0 }}>
          <div style={{ ...cardHdStyle, cursor: 'default' }}>
            画面 / 機能一覧
            <span style={{ fontSize: 11, color: '#666678' }}>{filtered.length} 行</span>
          </div>

          {/* Tab bar */}
          <div style={{ display: 'flex', background: '#252528', borderBottom: '1px solid #38383f' }}>
            {SUMMARY_TABS.map(tab => {
              const accent = tab === '全体' ? '#9070c0' : ROLE_DATA[tab as Exclude<SummaryTab,'全体'>]?.accent ?? '#9070c0'
              return (
                <button key={tab} onClick={() => setTableTab(tab)} style={{
                  flex: 1, padding: '8px 0', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  background: tableTab === tab ? '#2e2e34' : 'transparent',
                  color: tableTab === tab ? accent : '#666678',
                  borderBottom: tableTab === tab ? `2px solid ${accent}` : '2px solid transparent',
                  transition: 'all .15s',
                }}>
                  {tab}
                </button>
              )
            })}
          </div>

          {/* Toolbar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px',
            background: '#2e2e34', borderBottom: '1px solid #38383f', flexWrap: 'wrap',
          }}>
            <label style={{ color: '#888898', fontSize: 12 }}>列フィルタ:</label>
            <select value={colFilterKey} onChange={e => setColFilterKey(e.target.value as ColKey | '')} style={selectStyle}>
              <option value="">すべて</option>
              <option value="item">項目</option>
              <option value="component">画面/コンポーネント</option>
              <option value="feature">含まれる機能</option>
              <option value="improvement">改善点</option>
              <option value="path">path</option>
            </select>
            <div style={sepStyle} />
            <label style={{ color: '#888898', fontSize: 12, display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
              <input type="checkbox" checked={onlyIssues} onChange={e => setOnlyIssues(e.target.checked)} />
              改善点あり
            </label>
          </div>

          {/* Table */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 22 }} />
                {ALL_COLS.map(k => <col key={k} />)}
                <col style={{ width: 40 }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={{ ...thMainStyle, background: '#252528', width: 22 }}></th>

                  {ALL_COLS.map(k => (
                    <th key={k} style={{ ...thMainStyle }}>
                      {COL_LABELS[k]}
                      <div onMouseDown={e => startResize(k, e)} style={resizerStyle} />
                    </th>
                  ))}
                  <th style={{ ...thMainStyle, background: '#252528', width: 40 }}></th>
                </tr>
                <tr>
                  <th style={thFilterStyle}></th>

                  {ALL_COLS.map(k => (
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
                        background: '#1e1e24',
                        borderBottom: '1px solid rgba(255,255,255,.05)',
                        opacity: draggingId === row.id ? 0.4 : 1,
                        borderTop: dragOverId === row.id ? '2px solid #5588aa' : undefined,
                      }}
                    >
                      <td style={dragTdStyle} onMouseDown={() => { dragHandleActive.current = true }} onMouseUp={() => { dragHandleActive.current = false }}>⠿</td>


                      {/* 機能ID — read only, click to select for copy */}
                      <td tabIndex={0}
                        data-cell={`${row.id}-screen_id`}
                        onClick={e => onCellClick(e, 'screen_id')}
                        onMouseDown={e => onCellMouseDown(e, 'screen_id')}
                        style={{ ...tdStyle, position: 'relative', textAlign: 'center', fontWeight: 600, fontSize: 12, color: '#8898b0', cursor: 'default', ...hlStyle('screen_id'), ...fillHl(row.id, 'screen_id') }}
                      >{row.screen_id}{handle('screen_id')}</td>

                      {/* 項目 */}
                      <td tabIndex={0}
                        data-cell={`${row.id}-item`}
                        onClick={e => onCellClick(e, 'item')}
                        onMouseDown={e => onCellMouseDown(e, 'item')}
                        onDoubleClick={() => onCellDbl('item')}
                        contentEditable={edt('item') || undefined}
                        suppressContentEditableWarning
                        onBlur={e => onCellBlur(e, 'item')}
                        style={{ ...tdStyle, position: 'relative', ...hlStyle('item'), ...fillHl(row.id, 'item') }}
                      >{row.item}{handle('item')}</td>

                      {/* 画面/コンポーネント */}
                      <td tabIndex={0}
                        data-cell={`${row.id}-component`}
                        onClick={e => onCellClick(e, 'component')}
                        onMouseDown={e => onCellMouseDown(e, 'component')}
                        onDoubleClick={() => onCellDbl('component')}
                        contentEditable={edt('component') || undefined}
                        suppressContentEditableWarning
                        onBlur={e => onCellBlur(e, 'component')}
                        style={{ ...tdStyle, position: 'relative', ...hlStyle('component'), ...fillHl(row.id, 'component') }}
                      >{row.component}{handle('component')}</td>

                      {/* 含まれる機能 */}
                      <td tabIndex={0}
                        data-cell={`${row.id}-feature`}
                        onClick={e => onCellClick(e, 'feature')}
                        onMouseDown={e => onCellMouseDown(e, 'feature')}
                        onDoubleClick={() => onCellDbl('feature')}
                        contentEditable={edt('feature') || undefined}
                        suppressContentEditableWarning
                        onBlur={e => onCellBlur(e, 'feature')}
                        style={{ ...tdStyle, position: 'relative', ...hlStyle('feature'), ...fillHl(row.id, 'feature') }}
                      >{row.feature}{handle('feature')}</td>


                      {/* 改善点 */}
                      <td tabIndex={0}
                        data-cell={`${row.id}-improvement`}
                        onClick={e => onCellClick(e, 'improvement')}
                        onMouseDown={e => onCellMouseDown(e, 'improvement')}
                        onDoubleClick={() => onCellDbl('improvement')}
                        contentEditable={edt('improvement') || undefined}
                        suppressContentEditableWarning
                        onBlur={e => onCellBlur(e, 'improvement')}
                        style={{ ...tdStyle, position: 'relative', ...hlStyle('improvement'), ...fillHl(row.id, 'improvement') }}
                      >{row.improvement}{handle('improvement')}</td>

                      {/* path/para */}
                      <td tabIndex={0}
                        data-cell={`${row.id}-path`}
                        onClick={e => onCellClick(e, 'path')}
                        onMouseDown={e => onCellMouseDown(e, 'path')}
                        onDoubleClick={() => onCellDbl('path')}
                        contentEditable={edt('path') || undefined}
                        suppressContentEditableWarning
                        onBlur={e => onCellBlur(e, 'path')}
                        style={{ ...tdStyle, position: 'relative', fontFamily: 'monospace', color: '#7a9ab8', ...hlStyle('path'), ...fillHl(row.id, 'path') }}
                      >{row.path}{handle('path')}</td>

                      <td style={actTdStyle}>
                        <button onClick={() => addRowAfter(row.id)} style={addBtnStyle}>+</button>
                        <button onClick={() => deleteRow(row.id)} style={delBtnStyle}>−</button>
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={ALL_COLS.length + 2 + (tableTab === '全体' ? 1 : 0)}
                      style={{ padding: '24px', textAlign: 'center', color: '#555568', fontSize: 12 }}>
                      表示する行がありません
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

        </>)}
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
const infoThStyle: React.CSSProperties = {
  border: '1px solid #38383f', padding: '6px 12px', fontSize: 13,
  background: '#2e2e34', fontWeight: 700, whiteSpace: 'nowrap', color: '#a8b8d0', textAlign: 'left',
}
const infoTdStyle: React.CSSProperties = {
  border: '1px solid #38383f', padding: '6px 12px', fontSize: 13,
  color: '#b8b8c8', wordBreak: 'break-word',
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
  cursor: 'cell', color: '#c0c0cc', minHeight: 28,
}
const dragTdStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,.15)', width: 22, textAlign: 'center',
  borderRight: '1px solid rgba(255,255,255,.05)', padding: 0,
  verticalAlign: 'middle', cursor: 'grab', color: '#555568', fontSize: 14, userSelect: 'none',
}
const actTdStyle: React.CSSProperties = {
  background: 'rgba(0,0,0,.15)', width: 40, textAlign: 'center',
  borderLeft: '1px solid rgba(255,255,255,.05)', padding: '2px 2px',
  verticalAlign: 'middle', whiteSpace: 'nowrap',
}
const addBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 18, height: 18, border: '1.5px solid #34a853', borderRadius: '50%',
  background: 'transparent', color: '#34a853', fontSize: 13, fontWeight: 700, cursor: 'pointer',
}
const delBtnStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  width: 18, height: 18, border: '1.5px solid #ea4335', borderRadius: '50%',
  background: 'transparent', color: '#ea4335', fontSize: 13, fontWeight: 700,
  cursor: 'pointer', marginLeft: 6,
}
const resizerStyle: React.CSSProperties = {
  position: 'absolute', right: 0, top: 0, width: 5, height: '100%',
  cursor: 'col-resize', userSelect: 'none', zIndex: 1,
}
