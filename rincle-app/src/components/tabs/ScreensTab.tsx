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

const DETAIL_VALUES = ['未着手', '着手中', '協議中', '完了'] as const

const DETAIL_STYLE: Record<string, { bg: string; color: string }> = {
  '完了':   { bg: '#1a3a1a', color: '#81c784' },
  '未着手': { bg: '#252528', color: '#888898' },
  '着手中': { bg: '#1a2e40', color: '#64b5f6' },
  '協議中': { bg: '#3a1a1a', color: '#ff8a80' },
}


type ColKey = 'screen_id' | 'item' | 'component' | 'feature' | 'detail' | 'improvement' | 'path'
const ALL_COLS: ColKey[] = ['screen_id', 'item', 'component', 'feature', 'detail', 'improvement', 'path']

const COL_LABELS: Record<ColKey, string> = {
  screen_id: '機能ID', item: '項目', component: '画面/コンポーネント',
  feature: '含まれる機能', detail: '機能詳細', improvement: '改善点', path: 'path/para',
}

const COL_PLACEHOLDERS: Record<ColKey, string> = {
  screen_id: 'ID', item: '項目', component: '画面', feature: '機能',
  detail: '詳細', improvement: '改善点', path: 'path',
}

const INIT_WIDTHS: Record<ColKey, number> = {
  screen_id: 44, item: 200, component: 130, feature: 230,
  detail: 88, improvement: 220, path: 190,
}

// ── Static content ──────────────────────────────────────────────────────────
type SummaryTab = '全体' | '利用者' | '店舗管理者' | 'システム管理者'
const SUMMARY_TABS: SummaryTab[] = ['全体', '利用者', '店舗管理者', 'システム管理者']

const ROLE_DATA: Record<Exclude<SummaryTab, '全体'>, {
  accent: string; screenCount: number; uiElements: number; workflows: number; screens: string[]
}> = {
  '利用者': {
    accent: '#4a90d9', screenCount: 17, uiElements: 75, workflows: 228,
    screens: ['TOP', '空車検索', '検索一覧', '店舗詳細', '自転車詳細', '予約内容(空車検索)', '予約内容(顧客情報入力)', '予約内容(予約内容確認)', '予約内容(決済)', '予約一覧', 'ログイン', '新規会員登録', 'マイページ', 'アカウント詳細/編集', 'FAQ一覧', 'お問い合わせ', '規約等'],
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

const PRIO_STYLE: Record<string, { bg: string; color: string }> = {
  '緊急': { bg: '#4a1a1a', color: '#ff8a80' },
  '高':   { bg: '#3a2a10', color: '#ffb74d' },
  '中':   { bg: '#1a3a1a', color: '#81c784' },
  '低':   { bg: '#1a1a3a', color: '#90caf9' },
}

type IssueTab = '全体' | '利用者' | '店舗管理者' | 'システム管理者'
const ISSUE_TABS: IssueTab[] = ['全体', '利用者', '店舗管理者', 'システム管理者']

type IssueSection = { heading: string; items: [string, string][] }

const ISSUES_ALL: IssueSection[] = [
  { heading: 'UI/UX 観点', items: [
    ['ページタイトル・meta description・OGP タグが未設定のため、SNS シェア時にリンクプレビューが表示されず、SEO にも悪影響', '高'],
    ['viewport meta タグの設定が確認できず、スマートフォンでの表示が崩れる可能性がある', '高'],
    ['画像に alt テキストが設定されていないため、スクリーンリーダー利用者がコンテンツを認識できない', '中'],
    ['ARIA ラベルが未設定でキーボードナビゲーションが機能しない。WCAG 準拠が困難な状態', '中'],
    ['CDN リソースの読み込み失敗時に「IT 管理者に連絡してください」という不親切なエラーメッセージが表示される', '中'],
    ['広告ブロッカー利用環境でアプリが起動しないケースがある', '中'],
    ['エラー通知をポップアップに集中させており（63 個）、操作の流れを頻繁に中断する。トースト通知・インライン表示への切り替えを検討', '低'],
    ['空のリスト表示時のエンプティステート（「該当なし」等のメッセージ）が未定義', '低'],
  ]},
  { heading: '開発・セキュリティ観点', items: [
    ['【緊急】 Pay.JP の本番公開鍵・テスト秘密鍵がオプションセットにハードコードされており、JSON 書き出し等で漏洩するリスクがある。即時ローテーションが必要', '緊急'],
    ['16 本の API ワークフローで ignore_privacy_rules: TRUE が設定されており、決済・予約データへのアクセス制御が無効化されている', '緊急'],
    ['複数の決済関連 API で auth_unnecessary: TRUE が設定されており、未認証リクエストが受け入れられる', '緊急'],
    ['birth_date・phone_text・address_text・car_id_text・cus_id_text 等、個人情報 11 フィールドにプライバシーロールが未設定', '高'],
    ['Pay.JP Webhook の署名検証が確認できず、偽造リクエストを受け入れる可能性がある', '高'],
    ['Google Maps API キーがフロントエンドに露出している。ドメイン制限等のリファラー制限を設定する必要がある', '高'],
    ['メールアドレス 5 件・URL 9 件がワークフロー内にハードコードされており、環境切り替えや変更時の修正漏れリスクがある', '中'],
    ['データタイプ名・要素 ID に ___、bTHEn 等の無意味な名前が多数使われており、保守性が著しく低い', '中'],
    ['プロジェクト全体でコメントが 1 件のみ。ワークフローの意図・ロジックが不明瞭で引き継ぎ困難', '中'],
    ['全銀ネット（zengin.ajtw.net）との連携があるが、銀行口座情報の取り扱いにおける PCI DSS 準拠状況が不明', '中'],
    ['クライアントサイドの入力バリデーションが確認できず、不正な値がそのまま送信される可能性がある', '中'],
  ]},
]

const ISSUES_USER: IssueSection[] = [
  { heading: 'UI/UX 観点', items: [
    ['予約フローで Bubble の button_disabled キャッシュにより「予約画面へ進む」ボタンが無反応になる。E2E でも時間選択 UI のロード遅延でテスト失敗（一般ユーザーも同様に操作不能になる）', '緊急'],
    ['195 個の Input と 85 個の Dropdown に should_not_be_empty が 0 件。全フォームで空送信が可能な状態', '高'],
    ['Pikaday カレンダーの月ナビゲーションが直感的でなく、遠い日付の選択に最大 24 回クリックが必要。月ジャンプ機能がない', '高'],
    ['検索結果の「貸出可能な自転車をすべて見る」→「詳細を見る」と 2 ステップ必要で、ユーザーが離脱しやすい導線', '高'],
    ['エラーフィードバックが皆無（alert 1 件のみ）。フォーム送信失敗時やAPI通信エラー時にユーザーへの通知がない', '高'],
    ['予約フローが 4 ステップ（カート → 顧客情報 → 確認 → 決済）と長く、途中離脱率が高いと推測される', '中'],
    ['新着情報・TOPICS のクリックが通常 click() では動作せず jQuery ハンドラ経由でのみ遷移する。タッチデバイスで反応しない可能性', '中'],
    ['「Popup 工事中」が存在しており、未完成機能がユーザーに露出している可能性がある', '中'],
    ['空のリスト表示時のエンプティステート（empty_state 0 件）が未定義。検索結果 0 件時にガイダンスがない', '中'],
    ['検索時に「日付未定」チェックを 2 つ個別に操作する必要がある。1 つのトグルにまとめるべき', '低'],
  ]},
  { heading: '開発・セキュリティ観点', items: [
    ['Pay.JP 本番シークレットキー（sk_live_...）が Bubble 定義ファイルに平文でハードコード。このキーで任意の課金・返金操作が可能。即時ローテーション必須', '緊急'],
    ['テスト用 API キー（sk_test_...、pk_test_...）も平文で格納。テスト環境でも漏洩リスクがある', '緊急'],
    ['ignore_privacy_rules: TRUE が 31 箇所、auth_unnecessary: TRUE が 10 箇所。決済・予約データへのアクセス制御がバイパスされている', '高'],
    ['予約確定後の URL 遷移が不安定（E2E で catch で回避）。ネットワーク遅延時に二重予約の可能性', '高'],
    ['ユーザー登録・ログインフォームに入力バリデーション（メール形式、パスワード強度）が確認できない', '高'],
    ['お問い合わせフォームに CSRF 対策・レート制限が確認できない。メール送信 WF が 18 箇所あるがスパム対策が不明', '中'],
    ['退会機能がマイページにあるが、退会処理のデータ削除範囲（GDPR 対応）が不明', '中'],
    ['テスト用メールアドレス（liveqaaccount@example.com 等）が本番データに残存', '低'],
  ]},
]

const ISSUES_STORE: IssueSection[] = [
  { heading: 'UI/UX 観点', items: [
    ['26 個の Popup と 149 個のワークフローが単一ページに集中。モーダル地獄でユーザーが迷いやすく、読み込み速度にも影響', '高'],
    ['予約一覧がデフォルト画面だが、当日の予約ハイライトやアクションが必要な予約の視覚的区別がない', '高'],
    ['営業時間設定が曜日別で複雑だが、一括コピー（例：月曜の設定を火〜金に適用）機能がない', '高'],
    ['自転車登録/編集ポップアップが 29 要素と長大。ステップウィザードや折りたたみセクションが望ましい', '中'],
    ['CSV ダウンロードが予約一覧のみ。売上レポートや顧客一覧にもエクスポートが必要', '中'],
    ['営業カレンダーの月間ビュー全体で営業/休業を一括設定する UI がない', '中'],
    ['お問い合わせ一覧から返信する導線がサイドバーに見当たらない（別途メール対応が必要と思われる）', '低'],
  ]},
  { heading: '開発・セキュリティ観点', items: [
    ['全ページで page_is_private が未設定。URL 直打ちで認証なしにページが表示される可能性がある', '緊急'],
    ['27 個の API エンドポイント全てで認証が none。「オプション詳細情報の変更」等の書き込み系も含まれ、外部からデータ改ざん可能', '緊急'],
    ['ログインページにブルートフォース対策（rate_limit, captcha, lockout）が一切なし', '緊急'],
    ['149 個のワークフロー全てが unnamed。デバッグやメンテナンスが極めて困難', '高'],
    ['入力バリデーション（validate, required, min_length, sanitize）が未検出。XSS や不正データ投入のリスク', '高'],
    ['「ライド開始」「ライド終了」の排他制御が確認できず、同時操作で不整合が発生する可能性', '高'],
    ['「リカーリング始動」「api テスト」などデバッグ/運用系ボタンが本番 UI に残っている', '中'],
    ['店舗管理者の操作ログ（access_log 型は存在するが）の実装範囲が不明。不正アクセスの検知に必要', '中'],
  ]},
]

const ISSUES_ADMIN: IssueSection[] = [
  { heading: 'UI/UX 観点', items: [
    ['顧客一覧がデフォルト画面だが、アクティブユーザーと退会済みユーザーの区別が視覚的に不明瞭', '高'],
    ['加盟店一覧から個別店舗の詳細・編集への導線が「詳細」ボタンのみで、主要 KPI（売上・予約数）のプレビューがない', '高'],
    ['「シュミレーション」表記が 20 箇所で誤り（正：シミュレーション）。正表記は 1 箇所のみで混在', '中'],
    ['営業カレンダー・料金シミュレーションがサイドバーメニューに含まれず、直接 URL でしかアクセスできない', '中'],
    ['FV 管理・バナー管理・お知らせ管理が別メニューに分かれているが、「トップページ管理」で統合した方が直感的', '中'],
    ['重いデータ表示（料金 518 参照、予約 259 参照）に対してローディングインジケータが不足（spinner 1 件のみ）', '中'],
    ['CSV ダウンロードが顧客一覧にしか確認できず、予約一覧・売上レポート等にもエクスポートが必要', '低'],
    ['検索・フィルタ UI 要素は存在する（39 件）が動作テストが未実施で、正常動作が保証されていない', '低'],
  ]},
  { heading: '開発・セキュリティ観点', items: [
    ['管理者ログインに二段階認証（MFA）が未実装。全顧客・加盟店・売上データにアクセスできるアカウントがパスワード認証のみ', '緊急'],
    ['ignore_privacy_rules: TRUE が 31 箇所で使用。管理者 API 経由で全データにアクセス可能、最小権限原則に違反', '緊急'],
    ['管理者ログイン URL が推測可能（/admin_login）で IP 制限・レート制限が未設定。ブルートフォース攻撃のリスク', '緊急'],
    ['監査ログ（Audit Log）が存在しない。管理者の操作履歴が追跡不能でインシデント対応・コンプライアンスに支障', '高'],
    ['auto_binding が 115 箇所で有効。フォーム入力が DB に直接反映される設定で、意図しないデータ変更のリスクが高い', '高'],
    ['セッションタイムアウトが未設定。管理者がログインしたまま離席した場合に第三者が操作可能', '高'],
    ['管理画面が Popup ベース（19 個）で構成されており、ブラウザバック・ブックマークが不可', '中'],
    ['破壊的操作の確認ダイアログが 7 件のみ。料金変更・カレンダー変更等の誤操作防止が不十分', '中'],
    ['管理者権限のロール分離が不十分（role 7 件、権限 1 件）。全管理者がフルアクセスの可能性', '中'],
  ]},
]

function ImprovementTable({ items }: { items: [string, string][] }) {
  return (
    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
      <tbody>
        <tr>
          <th style={{ ...infoThStyle, width: 36 }}>#</th>
          <th style={infoThStyle}>改善点</th>
          <th style={{ ...infoThStyle, width: 60 }}>優先度</th>
        </tr>
        {items.map(([text, prio], i) => (
          <tr key={i} style={i % 2 === 1 ? { background: '#262628' } : {}}>
            <td style={{ ...infoTdStyle, textAlign: 'center' }}>{i + 1}</td>
            <td style={infoTdStyle}>{text}</td>
            <td style={infoTdStyle}>
              <span style={{
                display: 'inline-block', padding: '2px 8px', borderRadius: 3,
                fontSize: 11, fontWeight: 700,
                background: PRIO_STYLE[prio]?.bg, color: PRIO_STYLE[prio]?.color,
              }}>{prio}</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Main component ──────────────────────────────────────────────────────────
export default function ScreensTab() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(true)
  const [summaryTab, setSummaryTab] = useState<SummaryTab>('全体')
  const [commonOpen, setCommonOpen] = useState(false)
  const [issueTab, setIssueTab] = useState<IssueTab>('全体')
  const [selectedSheet, setSelectedSheet] = useState<string>('__list__')
  const [search, setSearch] = useState('')
  const [colFilterKey, setColFilterKey] = useState<ColKey | ''>('')
  const [groupFilter, setGroupFilter] = useState('')
  const [onlyIssues, setOnlyIssues] = useState(false)
  const [colFilters, setColFilters] = useState<Record<ColKey, string>>({
    screen_id: '', item: '', component: '', feature: '', detail: '', improvement: '', path: ''
  })
  const [colWidths, setColWidths] = useState<Record<ColKey, number>>({ ...INIT_WIDTHS })
  const [renamingSheet, setRenamingSheet] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
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

  useEffect(() => {
    supabase.from('screens').select('*').order('sort_order').then(({ data }) => {
      setRows(data || [])
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

  async function createSheet() {
    const name = prompt('新しい画面名を入力')?.trim()
    if (!name) return
    if (sheetNames.includes(name)) { alert('同名の画面が既に存在します'); return }
    const maxOrder = rows.length > 0 ? Math.max(...rows.map(r => r.sort_order)) : -1
    const newRow: Row = {
      id: crypto.randomUUID(), sort_order: maxOrder + 1,
      screen_id: '', item: name, component: '', feature: '',
      detail: '未着手', improvement: '', path: '',
    }
    setRows(prev => [...prev, newRow])
    await supabase.from('screens').insert(newRow)
    setSelectedSheet(name)
  }

  function computeEffectiveItems(r: Row[]) {
    let last = ''
    return r.map(row => { if (row.item) last = row.item; return last })
  }

  async function deleteSheet(name: string) {
    const eff = computeEffectiveItems(rows)
    const count = rows.filter((_, i) => eff[i] === name).length
    if (!confirm(`画面「${name}」（${count} 行）を削除しますか？`)) return
    const ids = rows.filter((_, i) => eff[i] === name).map(r => r.id)
    await supabase.from('screens').delete().in('id', ids)
    setRows(prev => prev.filter((_, i) => eff[i] !== name))
    setSelectedSheet('__list__')
  }

  async function commitRename(oldName: string) {
    const newName = renameValue.trim()
    setRenamingSheet(null)
    if (!newName || newName === oldName) return
    if (sheetNames.includes(newName)) { alert('同名の画面が既に存在します'); return }
    const eff = computeEffectiveItems(rows)
    // Explicitly set item on every row in the group (including inherited-empty rows)
    const fullyUpdated = rows.map((r, i) =>
      eff[i] === oldName ? { ...r, item: newName } : r
    )
    setRows(fullyUpdated)
    if (selectedSheet === oldName) setSelectedSheet(newName)
    const changed = fullyUpdated.filter((_, i) => eff[i] === oldName)
    setSaving(true)
    await supabase.from('screens').upsert(changed)
    setSaving(false)
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
  const sheetNames = [...new Set(effectiveItems.filter(Boolean))]

  const filtered = rows.filter((r, i) => {
    if (selectedSheet !== '__list__' && effectiveItems[i] !== selectedSheet) return false
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

        {selectedSheet !== '__list__' ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, color: '#555568', fontSize: 14 }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📄</div>
            <div style={{ fontWeight: 700, marginBottom: 6, color: '#888898' }}>{selectedSheet}</div>
            <div>詳細要件シート（準備中）</div>
          </div>
        ) : (<>

        {/* ── Card: サマリー ── */}
        <div style={cardStyle}>
          <div onClick={() => setSummaryOpen(v => !v)} style={{ ...cardHdStyle, cursor: 'pointer', userSelect: 'none' }}>
            サマリー
            <span style={{ fontSize: 16, display: 'inline-block', transition: 'transform .2s', transform: summaryOpen ? 'none' : 'rotate(-90deg)' }}>▼</span>
          </div>
          {summaryOpen && (<>
            {/* Tab bar */}
            <div style={{ display: 'flex', background: '#252528', borderBottom: '1px solid #38383f' }}>
              {SUMMARY_TABS.map(tab => (
                <button key={tab} onClick={() => setSummaryTab(tab)} style={{
                  flex: 1, padding: '8px 0', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                  background: summaryTab === tab ? '#2e2e34' : 'transparent',
                  color: summaryTab === tab ? (tab === '全体' ? '#c0a0e0' : ROLE_DATA[tab as Exclude<SummaryTab,'全体'>]?.accent ?? '#c0a0e0') : '#666678',
                  borderBottom: summaryTab === tab ? `2px solid ${tab === '全体' ? '#9070c0' : ROLE_DATA[tab as Exclude<SummaryTab,'全体'>]?.accent ?? '#9070c0'}` : '2px solid transparent',
                  transition: 'all .15s',
                }}>
                  {tab}
                </button>
              ))}
            </div>
            {/* Tab content */}
            <div style={{ padding: '14px' }}>
              {(() => {
                const roles = Object.keys(ROLE_DATA) as Exclude<SummaryTab, '全体'>[]
                const isAll = summaryTab === '全体'
                const targets = isAll ? roles : [summaryTab as Exclude<SummaryTab, '全体'>]
                const totalScreens = targets.reduce((s, r) => s + ROLE_DATA[r].screenCount, 0)
                const totalUI = targets.reduce((s, r) => s + ROLE_DATA[r].uiElements, 0)
                const totalWF = targets.reduce((s, r) => s + ROLE_DATA[r].workflows, 0)
                const accent = isAll ? '#9070c0' : ROLE_DATA[targets[0]].accent

                return (<>
                  {/* KPI */}
                  <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
                    {[
                      { label: '画面数', value: totalScreens },
                      { label: 'UI 要素数', value: totalUI },
                      { label: 'ワークフロー数', value: totalWF },
                    ].map(kpi => (
                      <div key={kpi.label} style={{
                        flex: 1, background: '#252528', borderRadius: 8, padding: '12px 16px',
                        border: '1px solid #38383f', textAlign: 'center',
                      }}>
                        <div style={{ fontSize: 11, color: '#888898', marginBottom: 4 }}>{kpi.label}</div>
                        <div style={{ fontSize: 26, fontWeight: 800, color: accent, lineHeight: 1 }}>{kpi.value}</div>
                      </div>
                    ))}
                  </div>
                  {/* Screen list */}
                  {targets.map(role => {
                    const d = ROLE_DATA[role]
                    return (
                      <div key={role} style={{ marginBottom: isAll ? 12 : 0 }}>
                        {isAll && (
                          <div style={{ fontSize: 12, fontWeight: 700, color: d.accent, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.accent, display: 'inline-block', flexShrink: 0 }} />
                            {role}
                            <span style={{ fontSize: 11, color: '#666678', fontWeight: 400 }}>{d.screenCount} 画面 / {d.uiElements} UI / {d.workflows} WF</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {d.screens.map(s => (
                            <span key={s} style={{
                              display: 'inline-block', padding: '3px 10px', borderRadius: 4,
                              fontSize: 11, lineHeight: '18px',
                              background: `${d.accent}15`, color: `${d.accent}dd`, border: `1px solid ${d.accent}30`,
                              whiteSpace: 'nowrap',
                            }}>{s}</span>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </>)
              })()}
            </div>
          </>)}
        </div>

        {/* ── Card: 改善点 ── */}
        <div style={cardStyle}>
          <div onClick={() => setCommonOpen(v => !v)} style={{ ...cardHdStyle, cursor: 'pointer', userSelect: 'none' }}>
            改善点
            <span style={{ fontSize: 16, display: 'inline-block', transition: 'transform .2s', transform: commonOpen ? 'none' : 'rotate(-90deg)' }}>▼</span>
          </div>
          {commonOpen && (<>
            {/* Tab bar */}
            <div style={{ display: 'flex', background: '#252528', borderBottom: '1px solid #38383f' }}>
              {ISSUE_TABS.map(tab => {
                const accent = tab === '全体' ? '#9070c0' : ROLE_DATA[tab as Exclude<IssueTab,'全体'>]?.accent ?? '#9070c0'
                return (
                  <button key={tab} onClick={() => setIssueTab(tab)} style={{
                    flex: 1, padding: '8px 0', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                    background: issueTab === tab ? '#2e2e34' : 'transparent',
                    color: issueTab === tab ? accent : '#666678',
                    borderBottom: issueTab === tab ? `2px solid ${accent}` : '2px solid transparent',
                    transition: 'all .15s',
                  }}>
                    {tab}
                  </button>
                )
              })}
            </div>
            <div style={{ padding: '12px 14px' }}>
              {(issueTab === '全体' ? ISSUES_ALL
                : issueTab === '利用者' ? ISSUES_USER
                : issueTab === '店舗管理者' ? ISSUES_STORE
                : ISSUES_ADMIN
              ).map((section, si) => (
                <div key={si} style={{ marginBottom: si === 0 ? 16 : 0 }}>
                  <p style={{ fontWeight: 700, marginBottom: 8, color: '#a8b8d0', fontSize: 13 }}>{section.heading}</p>
                  <ImprovementTable items={section.items} />
                </div>
              ))}
            </div>
          </>)}
        </div>

        {/* ── Card: 画面/機能一覧 ── */}
        <div style={{ ...cardStyle, marginBottom: 0 }}>
          <div style={{ ...cardHdStyle, cursor: 'default' }}>
            画面 / 機能一覧
            <span style={{ fontSize: 11, color: '#666678' }}>{filtered.length} 行</span>
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
            {selectedSheet === '__list__' && (
              <>
                <div style={sepStyle} />
                <label style={{ color: '#888898', fontSize: 12 }}>グループ:</label>
                <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)} style={selectStyle}>
                  <option value="">すべて</option>
                  {sheetNames.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </>
            )}
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
                {ALL_COLS.map(k => <col key={k} style={{ width: colWidths[k] }} />)}
                <col style={{ width: 64 }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={{ ...thMainStyle, background: '#252528', width: 22 }}></th>
                  {ALL_COLS.map(k => (
                    <th key={k} style={{ ...thMainStyle, width: colWidths[k] }}>
                      {COL_LABELS[k]}
                      <div onMouseDown={e => startResize(k, e)} style={resizerStyle} />
                    </th>
                  ))}
                  <th style={{ ...thMainStyle, background: '#252528', width: 64 }}></th>
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
                  const detailVal = row.detail || '未着手'
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

                      {/* 機能詳細 — full-cell select with overlay */}
                      <td data-cell={`${row.id}-detail`}
                        onMouseDown={e => onCellMouseDown(e, 'detail')}
                        style={{ padding: 0, borderRight: '1px solid rgba(255,255,255,.04)', verticalAlign: 'middle', height: '1px', ...hlStyle('detail'), ...fillHl(row.id, 'detail') }}>
                        <div style={{
                          position: 'relative', display: 'flex', alignItems: 'center',
                          width: '100%', height: '100%', minHeight: 28,
                          padding: '5px 20px 5px 7px', fontWeight: 600, fontSize: 13,
                          background: DETAIL_STYLE[detailVal]?.bg ?? '#252528',
                          color: DETAIL_STYLE[detailVal]?.color ?? '#888898',
                          userSelect: 'none', cursor: 'pointer', boxSizing: 'border-box',
                        }}>
                          {!sel('detail') && (
                            <div style={{ position: 'absolute', inset: 0, zIndex: 2 }}
                              onClick={e => { e.stopPropagation(); setSelectedCell({ rowId: row.id, col: 'detail' }) }} />
                          )}
                          {detailVal}
                          <span style={{ position: 'absolute', right: 5, fontSize: 8, opacity: .5, pointerEvents: 'none' }}>▼</span>
                          <select value={detailVal} onChange={e => updateCell(row.id, 'detail', e.target.value)}
                            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%', fontSize: 13 }}>
                            {DETAIL_VALUES.map(v => <option key={v} value={v}>{v}</option>)}
                          </select>
                          {handle('detail')}
                        </div>
                      </td>

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
                    <td colSpan={ALL_COLS.length + 2}
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

      {/* Sheet tabs */}
      <div style={{
        display: 'flex', alignItems: 'stretch', background: '#1a1a1f',
        borderTop: '1px solid #38383f', flexShrink: 0, overflowX: 'auto', minHeight: 34,
      }}>
        {/* 一覧 tab */}
        <button
          onClick={() => setSelectedSheet('__list__')}
          style={{
            padding: '0 18px', border: 'none', borderRight: '1px solid #2e2e38',
            borderTop: selectedSheet === '__list__' ? '2px solid #4a8ad8' : '2px solid transparent',
            background: selectedSheet === '__list__' ? '#2a2a2f' : 'transparent',
            color: selectedSheet === '__list__' ? '#90b8f0' : '#686880',
            fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
            minHeight: 34, transition: 'background .1s, color .1s',
          }}
        >画面 / 機能一覧</button>
        {/* Per-screen tabs */}
        {sheetNames.map(name => (
          <button key={name}
            onClick={() => setSelectedSheet(name)}
            onDoubleClick={() => { setRenamingSheet(name); setRenameValue(name) }}
            title="ダブルクリックでリネーム"
            style={{
              padding: '0 18px', border: 'none', borderRight: '1px solid #2e2e38',
              borderTop: name === selectedSheet ? '2px solid #4a8ad8' : '2px solid transparent',
              background: name === selectedSheet ? '#2a2a2f' : 'transparent',
              color: name === selectedSheet ? '#90b8f0' : '#686880',
              fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
              minHeight: 34, transition: 'background .1s, color .1s',
            }}
          >
            {renamingSheet === name ? (
              <input autoFocus value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onBlur={() => commitRename(name)}
                onKeyDown={e => { if (e.key === 'Enter') commitRename(name); if (e.key === 'Escape') setRenamingSheet(null) }}
                onClick={e => e.stopPropagation()}
                style={{ background: '#38383f', border: '1px solid #4a8ad8', borderRadius: 3, color: '#d0d0d8', fontSize: 12, padding: '1px 6px', outline: 'none', width: 160 }}
              />
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {name}
                <span onClick={e => { e.stopPropagation(); deleteSheet(name) }} title="この画面を削除"
                  style={{ fontSize: 11, color: '#555568', lineHeight: 1, cursor: 'pointer', padding: '0 1px' }}>✕</span>
              </span>
            )}
          </button>
        ))}
        <button onClick={createSheet} title="新しい画面を作成"
          style={{
            padding: '0 14px', border: 'none', background: 'transparent',
            color: '#555568', fontSize: 18, cursor: 'pointer', minHeight: 34,
            display: 'flex', alignItems: 'center', lineHeight: 1, borderTop: '2px solid transparent',
          }}>+</button>
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
