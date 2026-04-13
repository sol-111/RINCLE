'use client'

import type { OpenTab } from '@/lib/types'

const EXT_COLORS: Record<string, string> = {
  '.csv': '#4ec9b0', '.md': '#569cd6', '.json': '#dcdcaa',
  '.pdf': '#ce9178', '.jpeg': '#d7ba7d', '.jpg': '#d7ba7d', '.png': '#d7ba7d',
  '.html': '#e06c75', '.htm': '#e06c75',
}

export default function TabBar({ tabs, activeTab, onSelect, onClose }: {
  tabs: OpenTab[]; activeTab: string | null
  onSelect: (path: string) => void; onClose: (path: string) => void
}) {
  if (tabs.length === 0) return null

  return (
    <div style={{
      display: 'flex', background: '#252526', borderBottom: '1px solid #3c3c3c',
      overflow: 'auto', flexShrink: 0,
    }}>
      {tabs.map(tab => {
        const active = tab.path === activeTab
        return (
          <div
            key={tab.path}
            onClick={() => onSelect(tab.path)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', fontSize: 13, cursor: 'pointer',
              background: active ? '#1e1e1e' : '#2d2d2d',
              color: active ? '#ffffff' : '#969696',
              borderRight: '1px solid #252526',
              borderTop: active ? '1px solid #007acc' : '1px solid transparent',
              minWidth: 0, whiteSpace: 'nowrap',
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: EXT_COLORS[tab.ext] || '#888', flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{tab.name}</span>
            <button
              onClick={e => { e.stopPropagation(); onClose(tab.path) }}
              style={{
                background: 'none', border: 'none', color: active ? '#cccccc' : '#666',
                cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '0 2px', marginLeft: 4,
                borderRadius: 3,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#424242')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              ×
            </button>
          </div>
        )
      })}
    </div>
  )
}
