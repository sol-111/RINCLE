'use client'

import { useState, useEffect } from 'react'
import { readTextFile } from '@/lib/fs'

function JsonNode({ data, name, depth, defaultOpen }: {
  data: unknown; name?: string; depth: number; defaultOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  if (data === null) return <Line name={name} depth={depth}><span style={{ color: '#569cd6' }}>null</span></Line>
  if (typeof data === 'boolean') return <Line name={name} depth={depth}><span style={{ color: '#569cd6' }}>{String(data)}</span></Line>
  if (typeof data === 'number') return <Line name={name} depth={depth}><span style={{ color: '#b5cea8' }}>{data}</span></Line>
  if (typeof data === 'string') return <Line name={name} depth={depth}><span style={{ color: '#ce9178' }}>&quot;{data}&quot;</span></Line>

  const isArr = Array.isArray(data)
  const entries = isArr ? (data as unknown[]).map((v, i) => [String(i), v]) : Object.entries(data as Record<string, unknown>)
  const bracket = isArr ? ['[', ']'] : ['{', '}']
  const count = entries.length

  return (
    <div>
      <div
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          paddingLeft: depth * 20, cursor: 'pointer', lineHeight: '24px', fontSize: 13,
        }}
        onMouseEnter={e => (e.currentTarget.style.background = '#2a2d2e')}
        onMouseLeave={e => (e.currentTarget.style.background = '')}
      >
        <span style={{ fontSize: 10, color: '#888', width: 14, textAlign: 'center', transition: 'transform .1s', transform: open ? 'rotate(90deg)' : 'none' }}>&#9654;</span>
        {name !== undefined && <span style={{ color: '#9cdcfe' }}>{name}</span>}
        {name !== undefined && <span style={{ color: '#666' }}>: </span>}
        <span style={{ color: '#888' }}>{bracket[0]}</span>
        {!open && <span style={{ color: '#555', fontSize: 11 }}> {count} items </span>}
        {!open && <span style={{ color: '#888' }}>{bracket[1]}</span>}
      </div>
      {open && (
        <>
          {entries.map(([k, v]) => (
            <JsonNode key={String(k)} data={v} name={isArr ? undefined : String(k)} depth={depth + 1} defaultOpen={depth < 1} />
          ))}
          <div style={{ paddingLeft: depth * 20, lineHeight: '24px', color: '#888', fontSize: 13 }}>
            <span style={{ width: 14, display: 'inline-block' }} />
            {bracket[1]}
          </div>
        </>
      )}
    </div>
  )
}

function Line({ name, depth, children }: { name?: string; depth: number; children: React.ReactNode }) {
  return (
    <div style={{ paddingLeft: depth * 20 + 14, lineHeight: '24px', fontSize: 13 }}>
      {name !== undefined && <><span style={{ color: '#9cdcfe' }}>{name}</span><span style={{ color: '#666' }}>: </span></>}
      {children}
    </div>
  )
}

export default function JsonViewer({ rootHandle, filePath }: { rootHandle: FileSystemDirectoryHandle; filePath: string }) {
  const [data, setData] = useState<unknown>(undefined)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setData(undefined)
    setError(null)
    readTextFile(rootHandle, filePath)
      .then(text => {
        try { setData(JSON.parse(text)) }
        catch { setError('Invalid JSON') }
      })
      .catch(e => setError(e.message))
  }, [rootHandle, filePath])

  if (error) return <div style={{ padding: 20, color: '#f48771' }}>{error}</div>
  if (data === undefined) return <div style={{ padding: 20, color: '#888' }}>読み込み中...</div>

  return (
    <div style={{ padding: '12px 8px', fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace", overflow: 'auto', height: '100%' }}>
      <JsonNode data={data} depth={0} defaultOpen={true} />
    </div>
  )
}
