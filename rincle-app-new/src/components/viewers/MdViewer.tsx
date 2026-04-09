'use client'

import { useState, useEffect, useMemo } from 'react'
import { marked } from 'marked'
import { readTextFile } from '@/lib/fs'

export default function MdViewer({ rootHandle, filePath }: { rootHandle: FileSystemDirectoryHandle; filePath: string }) {
  const [content, setContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setContent(null)
    setError(null)
    readTextFile(rootHandle, filePath)
      .then(setContent)
      .catch(e => setError(e.message))
  }, [rootHandle, filePath])

  const html = useMemo(() => {
    if (!content) return ''
    return marked.parse(content) as string
  }, [content])

  if (error) return <div style={{ padding: 20, color: '#f48771' }}>{error}</div>
  if (content === null) return <div style={{ padding: 20, color: '#888' }}>読み込み中...</div>

  return (
    <div style={{ height: '100%', overflow: 'auto', background: '#1a1a22' }}>
      <div className="md-body" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}
