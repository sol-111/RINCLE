'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── Types ─────────────────────────────────────────────────────────────────
type SaveStatus  = 'idle' | 'saving' | 'saved' | 'error'
type CommentDef  = { id: string; text: string }

// ─── Component ──────────────────────────────────────────────────────────────
export default function FlowTab() {
  const iframeRef    = useRef<HTMLIFrameElement>(null)
  const initDoneRef  = useRef(false)
  const xmlReadyRef  = useRef<string | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [saveStatus,   setSaveStatus]   = useState<SaveStatus>('idle')
  const [xmlData,      setXmlData]      = useState<string | null>(null)
  const [comments,     setComments]     = useState<CommentDef[]>([])
  const [showComments, setShowComments] = useState(false)
  const [cmtInput,     setCmtInput]     = useState('')

  // ── Load .drawio file via API ─────────────────────────────────────────
  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch('/api/flow-diagram')
        if (!res.ok) throw new Error('load failed')
        const xml = await res.text()
        setXmlData(xml)
      } catch {
        setXmlData(null)
      }

      // Load comments from Supabase
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: cmts } = await supabase
          .from('flow_comments')
          .select('id, text')
          .eq('user_id', user.id)
        if (cmts) setComments(cmts)
      }
    })()
  }, [])

  // ── Save .drawio file via API ─────────────────────────────────────────
  const saveToFile = useCallback(async (xml: string) => {
    setSaveStatus('saving')
    try {
      const res = await fetch('/api/flow-diagram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/xml' },
        body: xml,
      })
      if (!res.ok) throw new Error('save failed')
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch {
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3000)
    }
  }, [])

  // ── Send XML to draw.io ───────────────────────────────────────────────
  function sendLoad(xml: string) {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ action: 'load', xml }),
      '*'
    )
  }

  // When XML is loaded, send it if draw.io is already initialized
  useEffect(() => {
    if (xmlData === null) return
    xmlReadyRef.current = xmlData
    if (initDoneRef.current) sendLoad(xmlData)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xmlData])

  // ── Handle messages from draw.io iframe ──────────────────────────────
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (!iframeRef.current || e.source !== iframeRef.current.contentWindow) return
      let msg: { event: string; xml?: string }
      try { msg = JSON.parse(e.data) } catch { return }

      if (msg.event === 'configure') {
        iframeRef.current!.contentWindow!.postMessage(
          JSON.stringify({ action: 'configure', config: { defaultPageBackgroundColor: '#000000', ui: 'dark' } }),
          '*'
        )
      } else if (msg.event === 'init') {
        initDoneRef.current = true
        if (xmlReadyRef.current) sendLoad(xmlReadyRef.current)
      } else if ((msg.event === 'save' || msg.event === 'autosave') && msg.xml) {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
        saveTimerRef.current = setTimeout(() => saveToFile(msg.xml!), 1500)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [saveToFile])

  // ── Comments (Supabase) ───────────────────────────────────────────────
  async function addComment() {
    if (!cmtInput.trim()) return
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data, error } = await supabase
      .from('flow_comments')
      .insert({ user_id: user.id, svg_x: 0, svg_y: 0, svg_w: 0, svg_h: 0, text: cmtInput.trim() })
      .select('id, text')
      .single()
    if (!error && data) {
      setComments(prev => [...prev, data])
      setCmtInput('')
    }
  }

  async function deleteComment(id: string) {
    const supabase = createClient()
    await supabase.from('flow_comments').delete().eq('id', id)
    setComments(prev => prev.filter(c => c.id !== id))
  }

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'#000' }}>

      {/* ── Toolbar ── */}
      <div style={{ background:'#2a2a2f', padding:'6px 12px', display:'flex', alignItems:'center', gap:8, borderBottom:'1px solid #38383f', flexShrink:0, boxShadow:'0 2px 8px rgba(0,0,0,.4)' }}>
        <h1 style={{ fontSize:14, fontWeight:700, color:'#d0d0d8', margin:'0 4px 0 0', whiteSpace:'nowrap' }}>画面遷移図</h1>
        <div style={{ width:1, height:18, background:'#38383f', flexShrink:0 }} />
        <button
          onClick={() => setShowComments(v => !v)}
          style={{ padding:'4px 10px', border:'1px solid #444450', borderRadius:4, background: showComments ? '#3a5a8a' : '#38383f', color: showComments ? '#b0d0f8' : '#a0a0b8', fontSize:11, cursor:'pointer', whiteSpace:'nowrap', userSelect:'none' }}
        >
          コメント{comments.length > 0 ? ` (${comments.length})` : ''}
        </button>
        <span style={{ fontSize:10, marginLeft:'auto', whiteSpace:'nowrap', color: saveStatus==='saving' ? '#d4b000' : saveStatus==='saved' ? '#34a853' : saveStatus==='error' ? '#e03020' : '#666678' }}>
          {saveStatus==='saving' ? '保存中...' : saveStatus==='saved' ? '保存済み ✓' : saveStatus==='error' ? '保存エラー' : '自動保存'}
        </span>
      </div>

      {/* ── Main area ── */}
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

        {/* draw.io embed */}
        {xmlData !== null ? (
          <iframe
            ref={iframeRef}
            src="https://embed.diagrams.net/?embed=1&spin=1&proto=json&stealth=1&dark=1&lang=ja&noSaveBtn=0&configure=1"
            style={{ flex:1, border:'none' }}
            title="画面遷移図エディタ"
          />
        ) : (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'#555568', fontSize:13 }}>
            読み込み中...
          </div>
        )}

        {/* ── Comment panel ── */}
        {showComments && (
          <div style={{ width:240, background:'#23232a', borderLeft:'1px solid #38383f', display:'flex', flexDirection:'column', flexShrink:0 }}>
            <div style={{ padding:'10px 12px', borderBottom:'1px solid #38383f' }}>
              <div style={{ fontSize:10, color:'#888898', fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px', marginBottom:6 }}>コメント</div>
              <textarea
                value={cmtInput}
                onChange={e => setCmtInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) addComment() }}
                placeholder="コメントを入力... (⌘Enter で追加)"
                style={{ width:'100%', background:'#2a2a33', border:'1px solid #444450', borderRadius:3, color:'#c0c0cc', padding:'4px 6px', fontSize:11, resize:'vertical', minHeight:54, fontFamily:'inherit', boxSizing:'border-box' }}
              />
              <button
                onClick={addComment}
                style={{ width:'100%', marginTop:5, padding:5, border:'1px solid #5a8abf', borderRadius:4, background:'#3a5a8a', color:'#b0d0f8', fontSize:11, cursor:'pointer' }}
              >
                追加
              </button>
            </div>
            <div style={{ flex:1, overflowY:'auto', padding:8, display:'flex', flexDirection:'column', gap:6 }}>
              {comments.length === 0 && (
                <div style={{ fontSize:11, color:'#555568', padding:'8px 0' }}>コメントはありません</div>
              )}
              {comments.map(c => (
                <div key={c.id} style={{ background:'#2a2a33', border:'1px solid #38383f', borderRadius:4, padding:'6px 8px' }}>
                  <div style={{ fontSize:11, color:'#c0c0cc', lineHeight:1.5, whiteSpace:'pre-wrap' }}>{c.text}</div>
                  <button
                    onClick={() => deleteComment(c.id)}
                    style={{ marginTop:4, background:'none', border:'none', color:'#a05050', cursor:'pointer', fontSize:10, padding:0 }}
                  >
                    削除
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
