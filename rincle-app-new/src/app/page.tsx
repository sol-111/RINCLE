'use client'

import { useState, useCallback } from 'react'
import type { OpenTab } from '@/lib/types'
import { getExt } from '@/lib/fs'
import Sidebar from '@/components/Sidebar'
import TabBar from '@/components/TabBar'
import CsvViewer from '@/components/viewers/CsvViewer'
import MdViewer from '@/components/viewers/MdViewer'
import MediaViewer from '@/components/viewers/MediaViewer'
import HtmlViewer from '@/components/viewers/HtmlViewer'
import FlowViewer from '@/components/viewers/FlowViewer'
import ErViewer from '@/components/viewers/ErViewer'

export default function Home() {
  const [rootHandle, setRootHandle] = useState<FileSystemDirectoryHandle | null>(null)
  const [tabs, setTabs] = useState<OpenTab[]>([])
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const [sidebarWidth, setSidebarWidth] = useState(260)

  const openFile = useCallback((path: string, name: string) => {
    const ext = getExt(name)
    setTabs(prev => {
      if (prev.some(t => t.path === path)) return prev
      return [...prev, { path, name, ext }]
    })
    setActiveTab(path)
  }, [])

  const closeTab = useCallback((path: string) => {
    setTabs(prev => {
      const next = prev.filter(t => t.path !== path)
      setActiveTab(a => {
        if (a !== path) return a
        const idx = prev.findIndex(t => t.path === path)
        return next[Math.min(idx, next.length - 1)]?.path ?? null
      })
      return next
    })
  }, [])

  const openFolder = useCallback(async () => {
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
      setRootHandle(handle)
      setTabs([])
      setActiveTab(null)
    } catch {
      // user cancelled
    }
  }, [])

  const current = tabs.find(t => t.path === activeTab)
  const isDbIndex = current?.name === '_index.csv' && current.path.includes('05_db')

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = sidebarWidth
    const onMove = (me: MouseEvent) => setSidebarWidth(Math.max(180, Math.min(500, startW + me.clientX - startX)))
    const onUp = () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [sidebarWidth])

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={{ width: sidebarWidth, flexShrink: 0, background: '#252526', borderRight: '1px solid #3c3c3c', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '8px 12px', fontSize: 11, fontWeight: 600, color: '#bbbbbb', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #3c3c3c' }}>
          <span>Explorer</span>
          <button onClick={openFolder} style={{ background: 'none', border: 'none', color: '#cccccc', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 4px' }} title="フォルダを開く">+</button>
        </div>
        {rootHandle ? (
          <Sidebar rootHandle={rootHandle} onFileSelect={openFile} activeFile={activeTab} />
        ) : (
          <div style={{ padding: 20, textAlign: 'center', color: '#888' }}>
            <p style={{ marginBottom: 12, fontSize: 12 }}>フォルダが開かれていません</p>
            <button onClick={openFolder} style={{
              padding: '6px 16px', background: '#0e639c', color: '#fff', border: 'none',
              borderRadius: 4, cursor: 'pointer', fontSize: 12,
            }}>
              フォルダを開く
            </button>
          </div>
        )}
      </div>

      {/* Resize handle */}
      <div onMouseDown={startResize} style={{ width: 4, cursor: 'col-resize', background: 'transparent', flexShrink: 0 }}
        onMouseEnter={e => (e.currentTarget.style.background = '#007acc')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      />

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#1e1e1e' }}>
        <TabBar tabs={tabs} activeTab={activeTab} onSelect={setActiveTab} onClose={closeTab} />

        <div style={{ flex: 1, overflow: 'auto' }}>
          {current && rootHandle ? (
            <>
              {isDbIndex && <ErViewer key={`er-${current.path}`} rootHandle={rootHandle} filePath={current.path} />}
              {current.ext === '.csv' && !isDbIndex && <CsvViewer key={current.path} rootHandle={rootHandle} filePath={current.path} />}
              {current.ext === '.md' && <MdViewer key={current.path} rootHandle={rootHandle} filePath={current.path} />}
              {current.ext === '.json' && <FlowViewer key={current.path} rootHandle={rootHandle} filePath={current.path} />}
              {['.pdf', '.jpeg', '.jpg', '.png'].includes(current.ext) && (
                <MediaViewer key={current.path} rootHandle={rootHandle} filePath={current.path} ext={current.ext} />
              )}
              {['.html', '.htm'].includes(current.ext) && (
                <HtmlViewer key={current.path} rootHandle={rootHandle} filePath={current.path} />
              )}
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#555' }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 18, marginBottom: 8 }}>Rincle Explorer</p>
                <p style={{ fontSize: 12 }}>左のサイドバーからファイルを選択してください</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
