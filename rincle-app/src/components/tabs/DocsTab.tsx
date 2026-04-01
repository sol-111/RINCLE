'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table'
import { Markdown } from 'tiptap-markdown'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import { TextStyle, Color } from '@tiptap/extension-text-style'

type Folder = { id: string; name: string; sort_order: number }
type Doc = {
  id: string
  folder_id: string | null
  sort_order: number
  name: string
  content: object
}

const supabase = createClient()

// ── Cell background colors ────────────────────────────────────
const CELL_COLORS = [
  { label: 'なし',     value: '' },
  { label: 'ネイビー', value: '#1a2a4a' },
  { label: 'ブルー',   value: '#1e3860' },
  { label: 'グリーン', value: '#1a3a28' },
  { label: 'ブラウン', value: '#3a2810' },
  { label: 'パープル', value: '#2a1a40' },
  { label: 'レッド',   value: '#3a1a20' },
  { label: 'グレー',   value: '#2a2a38' },
]

// ── Cell text colors ──────────────────────────────────────────
const CELL_TEXT_COLORS = [
  { label: 'なし',       value: '' },
  { label: 'ホワイト',   value: '#e8e8f0' },
  { label: 'ライトグレー', value: '#aaaabc' },
  { label: 'ブルー',     value: '#7ab0f0' },
  { label: 'グリーン',   value: '#7acca0' },
  { label: 'イエロー',   value: '#e8cc70' },
  { label: 'オレンジ',   value: '#e09050' },
  { label: 'レッド',     value: '#e07070' },
]

// TableCell with backgroundColor and textColor attributes
const ColoredTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: el => el.style.backgroundColor || null,
        renderHTML: attrs => {
          if (!attrs.backgroundColor) return {}
          return { style: `background-color: ${attrs.backgroundColor}` }
        },
      },
      textColor: {
        default: null,
        parseHTML: el => el.style.color || null,
        renderHTML: attrs => {
          if (!attrs.textColor) return {}
          return { style: `color: ${attrs.textColor}` }
        },
      },
    }
  },
})

const ColoredTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      backgroundColor: {
        default: null,
        parseHTML: el => el.style.backgroundColor || null,
        renderHTML: attrs => {
          if (!attrs.backgroundColor) return {}
          return { style: `background-color: ${attrs.backgroundColor}` }
        },
      },
      textColor: {
        default: null,
        parseHTML: el => el.style.color || null,
        renderHTML: attrs => {
          if (!attrs.textColor) return {}
          return { style: `color: ${attrs.textColor}` }
        },
      },
    }
  },
})

// ── Toolbar components ────────────────────────────────────────
function TB({ active, onClick, title, children }: {
  active?: boolean; onClick: () => void; title: string; children: React.ReactNode
}) {
  return (
    <button onMouseDown={e => { e.preventDefault(); onClick() }} title={title} style={{
      padding: '3px 8px', borderRadius: 4, border: 'none', cursor: 'pointer',
      background: active ? 'rgba(74,138,216,.3)' : 'transparent',
      color: active ? '#7ab0f0' : '#8888a0',
      fontSize: 12, fontWeight: active ? 700 : 400, lineHeight: 1.5, whiteSpace: 'nowrap',
    }}
      onMouseEnter={e => { if (!active) e.currentTarget.style.color = '#c0c0d0' }}
      onMouseLeave={e => { if (!active) e.currentTarget.style.color = '#8888a0' }}
    >
      {children}
    </button>
  )
}

function Sep() {
  return <div style={{ width: 1, height: 16, background: '#333344', margin: '0 3px', flexShrink: 0 }} />
}


// ── Editor ───────────────────────────────────────────────────
function DocEditor({ doc, onRename, onSave }: {
  doc: Doc
  onRename: (name: string) => void
  onSave: (content: object) => void
}) {
  const saveTimer    = useRef<ReturnType<typeof setTimeout>>(undefined)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const contentRef   = useRef<HTMLDivElement>(null)
  const gutterRef    = useRef<HTMLDivElement>(null)
  const [linkDialog, setLinkDialog] = useState(false)
  const [linkUrl, setLinkUrl]       = useState('')
  const [gutterSel, setGutterSel]   = useState<{ top: number; height: number } | null>(null)
  const gutterSelRef = useRef<{ top: number; height: number } | null>(null)
  const [tableInsert, setTableInsert] = useState<{
    type: 'col-after' | 'col-before' | 'row-after' | 'row-before'
    x: number; y: number; cell: HTMLElement
    lineTop?: number; lineBottom?: number
  } | null>(null)
  const isOverInsertBtn = useRef(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      TextStyle,
      Color,
      Underline,
      Placeholder.configure({ placeholder: '本文を入力… (# で見出し、**太字**、- でリストなど)' }),
      Table.configure({ resizable: true }),
      TableRow,
      ColoredTableHeader,
      ColoredTableCell,
      Image.configure({ inline: false, allowBase64: true }),
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } }),
      Markdown.configure({ html: false, transformPastedText: true }),
    ],
    content: doc.content as never,
    editorProps: {
      handlePaste(_, event) {
        const items = Array.from(event.clipboardData?.items ?? [])
        // Only intercept pure-image paste (no text/html alongside)
        const hasText = items.some(i => i.type === 'text/plain' || i.type === 'text/html')
        const imageItem = items.find(i => i.type.startsWith('image/'))
        if (!imageItem || hasText) return false
        const file = imageItem.getAsFile()
        if (!file) return false
        const reader = new FileReader()
        reader.onload = e => {
          const src = e.target?.result as string
          editorRef.current?.chain().focus().setImage({ src }).run()
        }
        reader.readAsDataURL(file)
        return true
      },
    },
    onUpdate({ editor }) {
      clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => onSave(editor.getJSON()), 800)
    },
    immediatelyRender: false,
  })

  // Keep a ref so handlePaste can always access the latest editor instance
  const editorRef = useRef(editor)
  useEffect(() => { editorRef.current = editor }, [editor])

  useEffect(() => {
    if (!editor) return
    const cur = JSON.stringify(editor.getJSON())
    const next = JSON.stringify(doc.content)
    if (cur !== next) editor.commands.setContent(doc.content as never)
  }, [doc.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleImageFile(file: File) {
    const reader = new FileReader()
    reader.onload = e => {
      const src = e.target?.result as string
      editorRef.current?.chain().focus().setImage({ src }).run()
    }
    reader.readAsDataURL(file)
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // ⌘K → open link dialog
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        const cur = editor?.getAttributes('link').href ?? ''
        setLinkUrl(cur)
        setLinkDialog(true)
        return
      }
      // Delete / Backspace → delete gutter-selected blocks
      if ((e.key === 'Delete' || e.key === 'Backspace') && gutterSelRef.current) {
        e.preventDefault()
        editor?.chain().focus().deleteSelection().run()
        gutterSelRef.current = null
        setGutterSel(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [editor]) // eslint-disable-line react-hooks/exhaustive-deps

  function applyLink() {
    if (!editor) return
    if (linkUrl.trim()) {
      editor.chain().focus().setLink({ href: linkUrl.trim() }).run()
    } else {
      editor.chain().focus().unsetLink().run()
    }
    setLinkDialog(false)
    setLinkUrl('')
  }

  // ── Gutter selection ─────────────────────────────────────────
  function getBlockBounds(pos: number) {
    const { doc } = editor!.state
    const $pos = doc.resolve(pos)
    const depth = Math.min($pos.depth, 1)
    return { from: $pos.start(depth), to: $pos.end(depth) }
  }

  function setGutter(val: { top: number; height: number } | null) {
    gutterSelRef.current = val
    setGutterSel(val)
  }

  function updateGutterHighlight(from: number, to: number) {
    if (!editor || !gutterRef.current) return
    try {
      const startCoords = editor.view.coordsAtPos(from)
      const endCoords   = editor.view.coordsAtPos(to)
      const gutterRect  = gutterRef.current.getBoundingClientRect()
      const top    = startCoords.top    - gutterRect.top
      const bottom = endCoords.bottom   - gutterRect.top
      setGutter({ top, height: Math.max(bottom - top, 4) })
    } catch { setGutter(null) }
  }

  function onGutterMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (!editor || !contentRef.current) return
    e.preventDefault()
    const editorRect = contentRef.current.getBoundingClientRect()
    // Use a reliable x inside the editor text area
    const insideX = editorRect.left + editorRect.width * 0.3

    function posAt(clientY: number) {
      const hit = editor!.view.posAtCoords({ left: insideX, top: clientY })
      if (hit) return hit.pos
      // fallback: clamp to doc start/end
      const { doc } = editor!.state
      return clientY < editorRect.top ? 0 : doc.content.size
    }

    const aPos = posAt(e.clientY)
    const { from: aFrom, to: aTo } = getBlockBounds(aPos)
    const startY = e.clientY
    editor.commands.setTextSelection({ from: aFrom, to: aTo })
    editor.view.focus()
    updateGutterHighlight(aFrom, aTo)

    function onMove(me: MouseEvent) {
      if (!editor) return
      const cPos = posAt(me.clientY)
      const { from: cFrom, to: cTo } = getBlockBounds(cPos)
      const sel = me.clientY >= startY ? { from: aFrom, to: cTo } : { from: cFrom, to: aTo }
      editor.commands.setTextSelection(sel)
      updateGutterHighlight(sel.from, sel.to)
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function setCellBg(color: string) {
    if (!editor) return
    editor.chain().focus().updateAttributes('tableCell', { backgroundColor: color || null }).run()
    editor.chain().focus().updateAttributes('tableHeader', { backgroundColor: color || null }).run()
  }

  function setCellTextColor(color: string) {
    if (!editor) return
    editor.chain().focus().updateAttributes('tableCell', { textColor: color || null }).run()
    editor.chain().focus().updateAttributes('tableHeader', { textColor: color || null }).run()
  }

  function onEditorMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!editor) return
    const cell = (e.target as HTMLElement).closest('td, th') as HTMLElement | null
    if (!cell) {
      if (!isOverInsertBtn.current) setTableInsert(null)
      return
    }
    const rect = cell.getBoundingClientRect()
    const tableRect = (cell.closest('table') as HTMLElement | null)?.getBoundingClientRect()
    const T = 10
    if (Math.abs(e.clientX - rect.right) <= T) {
      setTableInsert({ type: 'col-after',  x: rect.right,                    y: (rect.top + rect.bottom) / 2, cell, lineTop: tableRect?.top, lineBottom: tableRect?.bottom }); return
    }
    if (Math.abs(e.clientX - rect.left)  <= T) {
      setTableInsert({ type: 'col-before', x: rect.left,                     y: (rect.top + rect.bottom) / 2, cell, lineTop: tableRect?.top, lineBottom: tableRect?.bottom }); return
    }
    if (Math.abs(e.clientY - rect.bottom) <= T) {
      setTableInsert({ type: 'row-after',  x: (rect.left + rect.right) / 2,  y: rect.bottom,                  cell }); return
    }
    if (!isOverInsertBtn.current) setTableInsert(null)
  }

  function doTableInsert() {
    if (!tableInsert || !editor) return
    try {
      const pos = editor.view.posAtDOM(tableInsert.cell, 0)
      const cmd = {
        'col-after':  () => editor.chain().focus().setTextSelection(pos).addColumnAfter().run(),
        'col-before': () => editor.chain().focus().setTextSelection(pos).addColumnBefore().run(),
        'row-after':  () => editor.chain().focus().setTextSelection(pos).addRowAfter().run(),
        'row-before': () => editor.chain().focus().setTextSelection(pos).addRowBefore().run(),
      }[tableInsert.type]
      cmd()
    } catch { /* ignore */ }
    setTableInsert(null)
  }

  if (!editor) return null
  const E = editor
  const inTable = E.isActive('table')

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap',
        padding: '5px 16px', borderBottom: '1px solid #252530',
        background: '#1a1a24', flexShrink: 0,
      }}>
        <TB active={E.isActive('heading', { level: 1 })} onClick={() => E.chain().focus().toggleHeading({ level: 1 }).run()} title="見出し1">H1</TB>
        <TB active={E.isActive('heading', { level: 2 })} onClick={() => E.chain().focus().toggleHeading({ level: 2 }).run()} title="見出し2">H2</TB>
        <TB active={E.isActive('heading', { level: 3 })} onClick={() => E.chain().focus().toggleHeading({ level: 3 }).run()} title="見出し3">H3</TB>
        <Sep />
        <TB active={E.isActive('bold')}      onClick={() => E.chain().focus().toggleBold().run()}      title="太字"><b>B</b></TB>
        <TB active={E.isActive('italic')}    onClick={() => E.chain().focus().toggleItalic().run()}    title="斜体"><i>I</i></TB>
        <TB active={E.isActive('underline')} onClick={() => E.chain().focus().toggleUnderline().run()} title="下線"><u>U</u></TB>
        <TB active={E.isActive('strike')}    onClick={() => E.chain().focus().toggleStrike().run()}    title="取消線"><s>S</s></TB>
        <TB active={E.isActive('code')}      onClick={() => E.chain().focus().toggleCode().run()}      title="コード">`c`</TB>
        <Sep />
        {/* Text color swatches */}
        <span style={{ fontSize: 11, color: '#666678', marginRight: 2 }}>文字色:</span>
        {CELL_TEXT_COLORS.map(c => (
          <button
            key={c.value}
            onMouseDown={e => {
              e.preventDefault()
              if (c.value) {
                E.chain().focus().setColor(c.value).run()
              } else {
                E.chain().focus().unsetColor().run()
              }
            }}
            title={c.label}
            style={{
              width: c.value ? 18 : 28, height: 18, borderRadius: 3, cursor: 'pointer',
              border: c.value && E.isActive('textStyle', { color: c.value })
                ? '2px solid #7ab0f0' : '1px solid #333344',
              background: c.value ? '#1a1a26' : '#2a2a38',
              fontSize: c.value ? 11 : 10,
              color: c.value || '#666',
              fontWeight: 700,
              flexShrink: 0,
              lineHeight: '18px',
            }}
          >{c.value ? 'A' : 'なし'}</button>
        ))}
        <Sep />
        <TB active={E.isActive('bulletList')}  onClick={() => E.chain().focus().toggleBulletList().run()}  title="箇条書き">• リスト</TB>
        <TB active={E.isActive('orderedList')} onClick={() => E.chain().focus().toggleOrderedList().run()} title="番号リスト">1. リスト</TB>
        <TB active={E.isActive('blockquote')}  onClick={() => E.chain().focus().toggleBlockquote().run()}  title="引用">引用</TB>
        <TB active={E.isActive('codeBlock')}   onClick={() => E.chain().focus().toggleCodeBlock().run()}   title="コードブロック">コード</TB>
        <TB active={false} onClick={() => E.chain().focus().setHorizontalRule().run()} title="区切り線">—</TB>
        <Sep />
        <TB active={false} onClick={() => E.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="表を挿入">⊞ 表</TB>
        {inTable && <>
          <TB active={false} onClick={() => E.chain().focus().addColumnAfter().run()} title="列を追加">+列</TB>
          <TB active={false} onClick={() => E.chain().focus().addRowAfter().run()}    title="行を追加">+行</TB>
          <TB active={false} onClick={() => E.chain().focus().deleteColumn().run()}   title="列を削除">-列</TB>
          <TB active={false} onClick={() => E.chain().focus().deleteRow().run()}      title="行を削除">-行</TB>
          <TB active={false} onClick={() => E.chain().focus().deleteTable().run()}    title="表を削除">×表</TB>
          <Sep />
          <TB active={false} onClick={() => E.chain().focus().mergeCells().run()}     title="セルを結合">⊞結合</TB>
          <TB active={false} onClick={() => E.chain().focus().splitCell().run()}      title="セルを分割">⊟分割</TB>
          <Sep />
          {/* Cell color swatches */}
          <span style={{ fontSize: 11, color: '#666678', marginRight: 2 }}>セル色:</span>
          {CELL_COLORS.map(c => (
            <button
              key={c.value}
              onMouseDown={e => { e.preventDefault(); setCellBg(c.value) }}
              title={c.label}
              style={{
                width: c.value ? 18 : 28, height: 18, borderRadius: 3, cursor: 'pointer',
                border: '1px solid #333344',
                background: c.value || '#2a2a38',
                fontSize: c.value ? 0 : 10, color: '#666',
                flexShrink: 0,
              }}
            >{c.value ? '' : 'なし'}</button>
          ))}
          <Sep />
          {/* Cell text color swatches */}
          <span style={{ fontSize: 11, color: '#666678', marginRight: 2 }}>文字色:</span>
          {CELL_TEXT_COLORS.map(c => (
            <button
              key={c.value}
              onMouseDown={e => { e.preventDefault(); setCellTextColor(c.value) }}
              title={c.label}
              style={{
                width: c.value ? 18 : 28, height: 18, borderRadius: 3, cursor: 'pointer',
                border: '1px solid #333344',
                background: c.value ? '#1a1a26' : '#2a2a38',
                fontSize: c.value ? 11 : 10,
                color: c.value || '#666',
                fontWeight: 700,
                flexShrink: 0,
                lineHeight: '18px',
              }}
            >{c.value ? 'A' : 'なし'}</button>
          ))}
        </>}
        <Sep />
        <TB active={false} onClick={() => fileInputRef.current?.click()} title="画像を挿入">🖼 画像</TB>
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f); e.target.value = '' }} />
        <Sep />
        <TB active={E.isActive('link')} onClick={() => { setLinkUrl(E.getAttributes('link').href ?? ''); setLinkDialog(true) }} title="リンク (⌘K)">🔗 リンク</TB>
        <Sep />
        <TB active={false} onClick={() => E.chain().focus().undo().run()} title="元に戻す">↩</TB>
        <TB active={false} onClick={() => E.chain().focus().redo().run()} title="やり直し">↪</TB>
      </div>

      {/* Link dialog */}
      {linkDialog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1e1e2a', border: '1px solid #2e2e40', borderRadius: 10, padding: 24, width: 420, boxShadow: '0 8px 32px rgba(0,0,0,.6)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#c0c0d0', marginBottom: 14 }}>リンクを設定</div>
            <input
              autoFocus
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') applyLink(); if (e.key === 'Escape') setLinkDialog(false) }}
              placeholder="https://..."
              style={{ width: '100%', background: '#12121a', border: '1px solid #333345', borderRadius: 5, padding: '8px 10px', color: '#d0d0de', fontSize: 13, outline: 'none' }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              {E.isActive('link') && (
                <button onMouseDown={e => { e.preventDefault(); editor?.chain().focus().unsetLink().run(); setLinkDialog(false) }}
                  style={{ padding: '6px 14px', borderRadius: 5, border: '1px solid #3a2030', background: 'transparent', color: '#cc6677', fontSize: 12, cursor: 'pointer' }}>
                  リンク解除
                </button>
              )}
              <button onClick={() => setLinkDialog(false)}
                style={{ padding: '6px 14px', borderRadius: 5, border: '1px solid #333345', background: 'transparent', color: '#888898', fontSize: 12, cursor: 'pointer' }}>
                キャンセル
              </button>
              <button onClick={applyLink}
                style={{ padding: '6px 14px', borderRadius: 5, border: '1px solid #4a8ad8', background: 'rgba(74,138,216,.2)', color: '#7aaef0', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                設定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document area */}
      <div style={{ flex: 1, overflow: 'auto', background: '#16161e' }}>
        <div style={{ maxWidth: 980, margin: '0 auto', padding: '52px 0 120px', display: 'flex' }}>

          {/* ── Gutter (click/drag to select blocks) ── */}
          <div
            ref={gutterRef}
            onMouseDown={onGutterMouseDown}
            style={{
              width: 48, flexShrink: 0, cursor: 'default',
              paddingTop: 80,
              userSelect: 'none', position: 'relative',
            }}
          >
            {gutterSel && (
              <div style={{
                position: 'absolute', left: 4, right: 0,
                top: gutterSel.top, height: gutterSel.height,
                background: 'rgba(74,138,216,0.22)', borderRadius: 3,
                pointerEvents: 'none',
              }} />
            )}
          </div>

          {/* ── Content ── */}
          <div ref={contentRef} style={{ flex: 1, paddingRight: 80 }}
            onMouseDown={() => { setGutter(null) }}
            onMouseMove={onEditorMouseMove}
            onMouseLeave={() => { if (!isOverInsertBtn.current) setTableInsert(null) }}
          >
            <input
              value={doc.name}
              onChange={e => onRename(e.target.value)}
              placeholder="タイトル"
              style={{
                display: 'block', width: '100%', border: 'none', outline: 'none',
                fontSize: 34, fontWeight: 700, color: '#e8e8f0', marginBottom: 36,
                fontFamily: 'inherit', background: 'transparent',
              }}
            />
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>

      {/* Column border blue line on + button hover */}
      {tableInsert && tableInsert.type.startsWith('col') && tableInsert.lineTop != null && (
        <div style={{
          position: 'fixed',
          left: tableInsert.x - 1,
          top: tableInsert.lineTop,
          width: 2,
          height: tableInsert.lineBottom! - tableInsert.lineTop,
          background: '#4a8ad8',
          boxShadow: '0 0 6px rgba(74,138,216,.7)',
          pointerEvents: 'none',
          zIndex: 199,
        }} />
      )}

      {/* Table insert button */}
      {tableInsert && (
        <button
          onMouseDown={e => { e.preventDefault(); doTableInsert() }}
          onMouseEnter={() => { isOverInsertBtn.current = true }}
          onMouseLeave={() => { isOverInsertBtn.current = false; setTableInsert(null) }}
          title={{ 'col-after': '右に列を追加', 'col-before': '左に列を追加', 'row-after': '下に行を追加', 'row-before': '上に行を追加' }[tableInsert.type]}
          style={{
            position: 'fixed',
            left: tableInsert.x - 11,
            top: tableInsert.y - 11,
            width: 22, height: 22,
            borderRadius: '50%',
            background: '#4a8ad8',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            fontSize: 16,
            lineHeight: '22px',
            textAlign: 'center',
            zIndex: 200,
            boxShadow: '0 2px 8px rgba(0,0,0,.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 400,
            userSelect: 'none',
          }}
        >+</button>
      )}
    </div>
  )
}

// ── Main tab ─────────────────────────────────────────────────
export default function DocsTab() {
  const [folders,  setFolders]  = useState<Folder[]>([])
  const [docs,     setDocs]     = useState<Doc[]>([])
  const [loading,  setLoading]  = useState(true)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [saving,   setSaving]   = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [editingName,     setEditingName]     = useState('')
  const [dbError, setDbError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<{ kind: 'before-doc' | 'into-folder' | 'before-folder'; id: string } | null>(null)
  const userIdRef  = useRef<string | null>(null)
  const dragItem   = useRef<{ type: 'doc' | 'folder'; id: string } | null>(null)

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      userIdRef.current = user?.id ?? null

      const [{ data: fData, error: fErr }, { data: dData, error: dErr }] = await Promise.all([
        supabase.from('doc_folders').select('id,name,sort_order').order('sort_order'),
        supabase.from('docs').select('id,folder_id,sort_order,name,content').order('sort_order'),
      ])
      if (fErr || dErr) {
        setDbError((fErr ?? dErr)!.message)
        setLoading(false)
        return
      }
      setFolders((fData ?? []) as Folder[])
      setDocs((dData ?? []) as Doc[])
      if ((dData ?? []).length > 0) setActiveId((dData as Doc[])[0].id)
      setLoading(false)
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const activeDoc = docs.find(d => d.id === activeId) ?? null

  // ── Folder ops ──────────────────────────────────────────────
  async function createFolder() {
    const maxOrder = folders.reduce((m, f) => Math.max(m, f.sort_order), -1)
    const { data, error } = await supabase
      .from('doc_folders')
      .insert({ user_id: userIdRef.current, name: '新しいフォルダ', sort_order: maxOrder + 1 })
      .select().single()
    if (error) { alert('フォルダ作成エラー: ' + error.message); return }
    if (data) {
      const f = data as Folder
      setFolders(prev => [...prev, f])
      setExpanded(prev => new Set([...prev, f.id]))
      setEditingFolderId(f.id)
      setEditingName(f.name)
    }
  }

  async function commitFolderRename(id: string) {
    const name = editingName.trim() || folders.find(f => f.id === id)?.name || '新しいフォルダ'
    setFolders(prev => prev.map(f => f.id === id ? { ...f, name } : f))
    setEditingFolderId(null)
    await supabase.from('doc_folders').update({ name }).eq('id', id)
  }

  async function deleteFolder(id: string) {
    await supabase.from('doc_folders').delete().eq('id', id)
    setFolders(prev => prev.filter(f => f.id !== id))
    setDocs(prev => prev.map(d => d.folder_id === id ? { ...d, folder_id: null } : d))
  }

  // ── Doc ops ─────────────────────────────────────────────────
  async function createDoc(folderId: string | null = null) {
    const maxOrder = docs
      .filter(d => d.folder_id === folderId)
      .reduce((m, d) => Math.max(m, d.sort_order), -1)
    const { data, error } = await supabase
      .from('docs')
      .insert({ user_id: userIdRef.current, folder_id: folderId, sort_order: maxOrder + 1, name: '新しいドキュメント', content: { type: 'doc', content: [] } })
      .select().single()
    if (error) { alert('ドキュメント作成エラー: ' + error.message); return }
    if (data) {
      setDocs(prev => [...prev, data as Doc])
      setActiveId((data as Doc).id)
      if (folderId) setExpanded(prev => new Set([...prev, folderId]))
    }
  }

  async function deleteDoc(id: string) {
    await supabase.from('docs').delete().eq('id', id)
    setDocs(prev => {
      const next = prev.filter(d => d.id !== id)
      if (activeId === id) setActiveId(next[0]?.id ?? null)
      return next
    })
  }

  const renameDoc = useCallback((id: string, name: string) => {
    setDocs(prev => prev.map(d => d.id === id ? { ...d, name } : d))
    supabase.from('docs').update({ name }).eq('id', id).then(() => {})
  }, [])

  const saveContent = useCallback(async (id: string, content: object) => {
    setSaving(true)
    await supabase.from('docs').update({ content, updated_at: new Date().toISOString() }).eq('id', id)
    setSaving(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Drag & Drop ──────────────────────────────────────────────
  async function moveDocTo(docId: string, toFolderId: string | null, beforeDocId: string | null) {
    const group = docs
      .filter(d => d.folder_id === toFolderId && d.id !== docId)
      .sort((a, b) => a.sort_order - b.sort_order)
    const insertIdx = beforeDocId ? group.findIndex(d => d.id === beforeDocId) : group.length
    group.splice(insertIdx < 0 ? group.length : insertIdx, 0,
      { ...docs.find(d => d.id === docId)!, folder_id: toFolderId })
    const updates = group.map((d, i) => ({ id: d.id, folder_id: toFolderId, sort_order: i }))
    setDocs(prev => prev.map(d => { const u = updates.find(x => x.id === d.id); return u ? { ...d, ...u } : d }))
    await Promise.all(updates.map(u =>
      supabase.from('docs').update({ folder_id: u.folder_id, sort_order: u.sort_order }).eq('id', u.id)
    ))
  }

  async function moveFolderBefore(folderId: string, beforeFolderId: string | null) {
    const ordered = folders.filter(f => f.id !== folderId).sort((a, b) => a.sort_order - b.sort_order)
    const insertIdx = beforeFolderId ? ordered.findIndex(f => f.id === beforeFolderId) : ordered.length
    ordered.splice(insertIdx < 0 ? ordered.length : insertIdx, 0, folders.find(f => f.id === folderId)!)
    const updates = ordered.map((f, i) => ({ ...f, sort_order: i }))
    setFolders(updates)
    await Promise.all(updates.map(f =>
      supabase.from('doc_folders').update({ sort_order: f.sort_order }).eq('id', f.id)
    ))
  }

  function dsDragStart(e: React.DragEvent, type: 'doc' | 'folder', id: string) {
    dragItem.current = { type, id }
    e.dataTransfer.effectAllowed = 'move'
    e.stopPropagation()
  }
  function dsDragEnd() { dragItem.current = null; setDragOver(null) }

  function dsDocOver(e: React.DragEvent, docId: string) {
    e.preventDefault(); e.stopPropagation()
    setDragOver(v => v?.kind === 'before-doc' && v.id === docId ? v : { kind: 'before-doc', id: docId })
  }
  function dsFolderOver(e: React.DragEvent, folderId: string) {
    e.preventDefault(); e.stopPropagation()
    const item = dragItem.current; if (!item) return
    const kind = item.type === 'doc' ? 'into-folder' as const : 'before-folder' as const
    setDragOver(v => v?.kind === kind && v.id === folderId ? v : { kind, id: folderId })
  }
  function dsLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null)
  }

  async function dsDocDrop(e: React.DragEvent, beforeDocId: string) {
    e.preventDefault(); e.stopPropagation()
    const item = dragItem.current; setDragOver(null)
    if (!item || item.type !== 'doc' || item.id === beforeDocId) return
    await moveDocTo(item.id, docs.find(d => d.id === beforeDocId)!.folder_id, beforeDocId)
  }
  async function dsFolderDrop(e: React.DragEvent, folderId: string) {
    e.preventDefault(); e.stopPropagation()
    const item = dragItem.current; setDragOver(null)
    if (!item) return
    if (item.type === 'doc') {
      await moveDocTo(item.id, folderId, null)
      setExpanded(prev => new Set([...prev, folderId]))
    } else if (item.type === 'folder' && item.id !== folderId) {
      await moveFolderBefore(item.id, folderId)
    }
  }
  async function dsRootDrop(e: React.DragEvent) {
    e.preventDefault()
    const item = dragItem.current; setDragOver(null)
    if (!item || item.type !== 'doc') return
    await moveDocTo(item.id, null, null)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#555568', fontSize: 13 }}>
      読み込み中...
    </div>
  )

  if (dbError) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12 }}>
      <span style={{ fontSize: 13, color: '#cc5566' }}>DBエラー: {dbError}</span>
      <span style={{ fontSize: 11, color: '#555568' }}>Supabaseで migration_docs.sql を実行してテーブルを作成してください</span>
    </div>
  )

  const rootDocs = docs.filter(d => !d.folder_id)

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>

      {/* Sidebar */}
      <div style={{
        width: 220, flexShrink: 0, background: '#1a1a24',
        borderRight: '1px solid #252530',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{
          padding: '10px 10px 8px', borderBottom: '1px solid #252530',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#555568', letterSpacing: '.05em' }}>DOCS</span>
          <div style={{ display: 'flex', gap: 2 }}>
            <button onClick={createFolder} title="新規フォルダ" style={sbIconBtn}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(74,138,216,.15)'; e.currentTarget.style.color = '#7aaef0' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#445566' }}
            >📁</button>
            <button onClick={() => createDoc(null)} title="ルートに新規ドキュメント" style={sbIconBtn}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(74,138,216,.15)'; e.currentTarget.style.color = '#7aaef0' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#445566' }}
            >+</button>
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}
          onDragOver={e => { if (dragItem.current?.type === 'doc') e.preventDefault() }}
          onDrop={dsRootDrop}
        >
          {rootDocs.length === 0 && folders.length === 0 && (
            <div style={{ padding: '24px 16px', color: '#3a3a50', fontSize: 12, textAlign: 'center' }}>
              ドキュメントなし
            </div>
          )}

          {/* Root docs */}
          {rootDocs.map(doc => (
            <SbDocItem key={doc.id} doc={doc} active={activeId === doc.id}
              dropLine={dragOver?.kind === 'before-doc' && dragOver.id === doc.id}
              onClick={() => setActiveId(doc.id)}
              onDelete={() => deleteDoc(doc.id)}
              onDragStart={e => dsDragStart(e, 'doc', doc.id)}
              onDragEnd={dsDragEnd}
              onDragOver={e => dsDocOver(e, doc.id)}
              onDrop={e => dsDocDrop(e, doc.id)}
              onDragLeave={dsLeave}
            />
          ))}

          {/* Folders */}
          {folders.map(folder => {
            const isOpen     = expanded.has(folder.id)
            const folderDocs = docs.filter(d => d.folder_id === folder.id)
            const isEditing  = editingFolderId === folder.id
            const isDropInto  = dragOver?.kind === 'into-folder'   && dragOver.id === folder.id
            const isDropBefore = dragOver?.kind === 'before-folder' && dragOver.id === folder.id
            return (
              <div key={folder.id}>
                {/* Drop-before indicator */}
                {isDropBefore && <div style={{ height: 2, background: '#4a8ad8', margin: '0 8px', borderRadius: 1 }} />}

                <div
                  draggable
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4, padding: '5px 8px', cursor: 'grab',
                    outline: isDropInto ? '1px solid #4a8ad8' : 'none',
                    background: isDropInto ? 'rgba(74,138,216,.12)' : 'transparent',
                  }}
                  onClick={() => !isEditing && setExpanded(prev => {
                    const s = new Set(prev); isOpen ? s.delete(folder.id) : s.add(folder.id); return s
                  })}
                  onMouseEnter={e => { if (!isDropInto) e.currentTarget.style.background = 'rgba(255,255,255,.04)' }}
                  onMouseLeave={e => { if (!isDropInto) e.currentTarget.style.background = 'transparent' }}
                  onDragStart={e => dsDragStart(e, 'folder', folder.id)}
                  onDragEnd={dsDragEnd}
                  onDragOver={e => dsFolderOver(e, folder.id)}
                  onDrop={e => dsFolderDrop(e, folder.id)}
                  onDragLeave={dsLeave}
                >
                  <span style={{ fontSize: 10, color: '#555568', width: 10, textAlign: 'center', flexShrink: 0 }}>
                    {isOpen ? '▾' : '▸'}
                  </span>
                  <span style={{ fontSize: 12, flexShrink: 0 }}>📁</span>
                  {isEditing ? (
                    <input autoFocus value={editingName}
                      onChange={e => setEditingName(e.target.value)}
                      onBlur={() => commitFolderRename(folder.id)}
                      onKeyDown={e => {
                        if (e.key === 'Enter')  commitFolderRename(folder.id)
                        if (e.key === 'Escape') setEditingFolderId(null)
                      }}
                      onClick={e => e.stopPropagation()}
                      style={{
                        flex: 1, fontSize: 12, border: 'none', outline: 'none',
                        background: 'rgba(74,138,216,.15)', color: '#d0d0d8',
                        borderRadius: 3, padding: '1px 4px',
                      }}
                    />
                  ) : (
                    <span
                      style={{
                        flex: 1, fontSize: 12, color: '#8888a0',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}
                      onDoubleClick={e => {
                        e.stopPropagation()
                        setEditingFolderId(folder.id)
                        setEditingName(folder.name)
                      }}
                    >{folder.name}</span>
                  )}
                  {!isEditing && (
                    <div style={{ display: 'flex', gap: 1 }}>
                      <button title="ドキュメントを追加"
                        onClick={e => { e.stopPropagation(); createDoc(folder.id) }}
                        style={sbSmBtn}
                        onMouseEnter={e => e.currentTarget.style.color = '#7aaef0'}
                        onMouseLeave={e => e.currentTarget.style.color = '#333348'}
                      >+</button>
                      <button title="フォルダを削除"
                        onClick={e => { e.stopPropagation(); deleteFolder(folder.id) }}
                        style={sbSmBtn}
                        onMouseEnter={e => { e.currentTarget.style.color = '#cc5566'; e.currentTarget.style.background = 'rgba(200,60,70,.15)' }}
                        onMouseLeave={e => { e.currentTarget.style.color = '#333348'; e.currentTarget.style.background = 'transparent' }}
                      >×</button>
                    </div>
                  )}
                </div>

                {isOpen && (
                  <>
                    {folderDocs.length === 0 && (
                      <div style={{ paddingLeft: 30, fontSize: 11, color: '#3a3a50', padding: '3px 8px 3px 30px' }}>
                        空のフォルダ
                      </div>
                    )}
                    {folderDocs.map(doc => (
                      <SbDocItem key={doc.id} doc={doc} active={activeId === doc.id} indent
                        dropLine={dragOver?.kind === 'before-doc' && dragOver.id === doc.id}
                        onClick={() => setActiveId(doc.id)}
                        onDelete={() => deleteDoc(doc.id)}
                        onDragStart={e => dsDragStart(e, 'doc', doc.id)}
                        onDragEnd={dsDragEnd}
                        onDragOver={e => dsDocOver(e, doc.id)}
                        onDrop={e => dsDocDrop(e, doc.id)}
                        onDragLeave={dsLeave}
                      />
                    ))}
                  </>
                )}
              </div>
            )
          })}
        </div>

        {saving && (
          <div style={{ padding: '8px 12px', fontSize: 10, color: '#3a3a50', borderTop: '1px solid #252530' }}>
            保存中...
          </div>
        )}
      </div>

      {/* Editor */}
      {activeDoc ? (
        <DocEditor
          key={activeDoc.id}
          doc={activeDoc}
          onRename={name => renameDoc(activeDoc.id, name)}
          onSave={content => saveContent(activeDoc.id, content)}
        />
      ) : (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 14, background: '#16161e',
        }}>
          <span style={{ fontSize: 40 }}>📄</span>
          <span style={{ fontSize: 14, color: '#555568' }}>ドキュメントを選択するか、新規作成してください</span>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => createDoc(null)} style={createBtnSt}>+ 新規ドキュメント</button>
            <button onClick={createFolder} style={{ ...createBtnSt, borderColor: '#7755bb', color: '#9977dd', background: 'rgba(119,85,187,.1)' }}>
              📁 新規フォルダ
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sidebar doc item ─────────────────────────────────────────
function SbDocItem({ doc, active, indent, dropLine, onClick, onDelete, onDragStart, onDragEnd, onDragOver, onDrop, onDragLeave }: {
  doc: Doc; active: boolean; indent?: boolean; dropLine?: boolean
  onClick: () => void; onDelete: () => void
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: () => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  onDragLeave: (e: React.DragEvent) => void
}) {
  return (
    <div>
      {dropLine && <div style={{ height: 2, background: '#4a8ad8', margin: `0 ${indent ? 26 : 8}px 0 8px`, borderRadius: 1 }} />}
      <div
        draggable
        onClick={onClick}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDragLeave={onDragLeave}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: `6px 8px 6px ${indent ? 26 : 12}px`, cursor: 'grab',
          background: active ? 'rgba(74,138,216,.15)' : 'transparent',
          borderLeft: `2px solid ${active ? '#4a8ad8' : 'transparent'}`,
        }}
        onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,.04)' }}
        onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
      >
        <span style={{ fontSize: 12, flexShrink: 0 }}>📄</span>
        <span style={{
          flex: 1, fontSize: 12, color: active ? '#7aaef0' : '#8888a0',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{doc.name || '無題'}</span>
        <button onClick={e => { e.stopPropagation(); onDelete() }} style={{
          flexShrink: 0, width: 16, height: 16, borderRadius: 3,
          border: 'none', background: 'transparent', color: '#333348',
          cursor: 'pointer', fontSize: 11,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(200,60,70,.2)'; e.currentTarget.style.color = '#cc5566' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#333348' }}
        >×</button>
      </div>
    </div>
  )
}

const sbIconBtn: React.CSSProperties = {
  width: 22, height: 22, borderRadius: 4, border: 'none',
  background: 'transparent', color: '#445566', cursor: 'pointer', fontSize: 13,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
const sbSmBtn: React.CSSProperties = {
  width: 16, height: 16, border: 'none', background: 'transparent',
  color: '#333348', cursor: 'pointer', fontSize: 11, padding: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 3,
}
const createBtnSt: React.CSSProperties = {
  padding: '8px 20px', borderRadius: 5, cursor: 'pointer',
  border: '1px solid #4a8ad8', background: 'rgba(74,138,216,.1)',
  color: '#7aaef0', fontSize: 13, fontWeight: 600,
}
