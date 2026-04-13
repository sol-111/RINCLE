'use client'

import { useState, useEffect, useRef } from 'react'
import { readBlobFile } from '@/lib/fs'

export default function MediaViewer({ rootHandle, filePath, ext }: {
  rootHandle: FileSystemDirectoryHandle; filePath: string; ext: string
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const urlRef = useRef<string | null>(null)

  useEffect(() => {
    setUrl(null)
    setError(null)
    readBlobFile(rootHandle, filePath)
      .then(({ blob }) => {
        const u = URL.createObjectURL(blob)
        urlRef.current = u
        setUrl(u)
      })
      .catch(e => setError(e.message))

    return () => {
      if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null }
    }
  }, [rootHandle, filePath])

  if (error) return <div style={{ padding: 20, color: '#f48771' }}>{error}</div>
  if (!url) return <div style={{ padding: 20, color: '#888' }}>読み込み中...</div>

  if (ext === '.pdf') {
    return <iframe src={url} style={{ width: '100%', height: '100%', border: 'none' }} title="PDF Viewer" />
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: 24, overflow: 'auto' }}>
      <img
        src={url}
        alt={filePath.split('/').pop() || ''}
        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 4 }}
      />
    </div>
  )
}
