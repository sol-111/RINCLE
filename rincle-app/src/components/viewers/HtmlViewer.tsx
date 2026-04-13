'use client'

import { useState, useEffect, useRef } from 'react'
import { readTextFile } from '@/lib/fs'

export default function HtmlViewer({ rootHandle, filePath }: {
  rootHandle: FileSystemDirectoryHandle; filePath: string
}) {
  const [html, setHtml] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    setHtml(null)
    setError(null)
    readTextFile(rootHandle, filePath)
      .then(setHtml)
      .catch(e => setError(e.message))
  }, [rootHandle, filePath])

  useEffect(() => {
    if (!html || !iframeRef.current) return
    const doc = iframeRef.current.contentDocument
    if (!doc) return
    doc.open()
    doc.write(html)
    doc.close()
  }, [html])

  if (error) return <div style={{ padding: 20, color: '#f48771' }}>{error}</div>
  if (html === null) return <div style={{ padding: 20, color: '#888' }}>読み込み中...</div>

  return (
    <iframe
      ref={iframeRef}
      sandbox="allow-same-origin allow-scripts"
      style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }}
      title="HTML Viewer"
    />
  )
}
