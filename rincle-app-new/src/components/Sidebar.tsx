'use client'

import { useState, useEffect, useCallback } from 'react'
import { isSupportedFile, getExt } from '@/lib/fs'

type TreeEntry = {
  name: string
  path: string
  isDir: boolean
  handle: FileSystemDirectoryHandle | FileSystemFileHandle
}

const FILE_ICONS: Record<string, string> = {
  '.csv': '📊', '.md': '📝', '.json': '{}', '.pdf': '📄', '.jpeg': '🖼', '.jpg': '🖼', '.png': '🖼',
  '.html': '🌐', '.htm': '🌐',
}

async function listDir(dirHandle: FileSystemDirectoryHandle, parentPath: string): Promise<TreeEntry[]> {
  const entries: TreeEntry[] = []
  for await (const [name, handle] of dirHandle.entries()) {
    if (name.startsWith('.')) continue
    const path = parentPath ? `${parentPath}/${name}` : name
    const isDir = handle.kind === 'directory'
    if (isDir || isSupportedFile(name)) {
      entries.push({ name, path, isDir, handle })
    }
  }
  entries.sort((a, b) => {
    if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  return entries
}

function TreeItem({ entry, depth, onFileSelect, activeFile }: {
  entry: TreeEntry; depth: number; onFileSelect: (path: string, name: string) => void; activeFile: string | null
}) {
  const [expanded, setExpanded] = useState(false)
  const [children, setChildren] = useState<TreeEntry[] | null>(null)
  const [loading, setLoading] = useState(false)

  const toggle = useCallback(async () => {
    if (!entry.isDir) {
      onFileSelect(entry.path, entry.name)
      return
    }
    if (!expanded) {
      setLoading(true)
      try {
        const items = await listDir(entry.handle as FileSystemDirectoryHandle, entry.path)
        setChildren(items)
      } catch { setChildren([]) }
      setLoading(false)
      setExpanded(true)
    } else {
      setExpanded(false)
    }
  }, [entry, expanded, onFileSelect])

  const isActive = activeFile === entry.path
  const ext = getExt(entry.name)

  return (
    <>
      <div
        onClick={toggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '2px 8px 2px 0', paddingLeft: 12 + depth * 16,
          cursor: 'pointer', fontSize: 13, lineHeight: '22px',
          color: isActive ? '#fff' : '#cccccc',
          background: isActive ? '#094771' : 'transparent',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}
        onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#2a2d2e' }}
        onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
      >
        {entry.isDir ? (
          <span style={{ fontSize: 10, width: 16, textAlign: 'center', color: '#888', transition: 'transform .1s', transform: expanded ? 'rotate(90deg)' : 'none' }}>&#9654;</span>
        ) : (
          <span style={{ width: 16 }} />
        )}
        <span style={{ fontSize: 14, width: 18, textAlign: 'center' }}>
          {entry.isDir ? (expanded ? '📂' : '📁') : (FILE_ICONS[ext] || '📄')}
        </span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{entry.name}</span>
        {loading && <span style={{ fontSize: 10, color: '#888' }}>...</span>}
      </div>
      {expanded && children && children.map(c => (
        <TreeItem key={c.path} entry={c} depth={depth + 1} onFileSelect={onFileSelect} activeFile={activeFile} />
      ))}
    </>
  )
}

export default function Sidebar({ rootHandle, onFileSelect, activeFile }: {
  rootHandle: FileSystemDirectoryHandle; onFileSelect: (path: string, name: string) => void; activeFile: string | null
}) {
  const [entries, setEntries] = useState<TreeEntry[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setError(null)
    listDir(rootHandle, '')
      .then(setEntries)
      .catch(e => setError(e.message))
  }, [rootHandle])

  return (
    <div style={{ flex: 1, overflow: 'auto' }}>
      <div style={{ padding: '6px 12px', fontSize: 11, fontWeight: 700, color: '#bbbbbb', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {rootHandle.name}
      </div>
      {error && <div style={{ padding: '8px 12px', color: '#f48771', fontSize: 12 }}>{error}</div>}
      {entries.map(e => (
        <TreeItem key={e.path} entry={e} depth={0} onFileSelect={onFileSelect} activeFile={activeFile} />
      ))}
    </div>
  )
}
