'use client'

import { useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import ScreensTab from './tabs/ScreensTab'
import FlowTab from './tabs/FlowTab'
import BizFlowTab from './tabs/BizFlowTab'
import EmailsTab from './tabs/EmailsTab'
import DbTab from './tabs/DbTab'
import ErTab from './tabs/ErTab'
import DocsTab from './tabs/DocsTab'
import SheetTab from './tabs/SheetTab'

type Tab = 'screens' | 'docs' | 'flow' | 'bizflow' | 'emails' | 'db' | 'er' | 'sheet'

const TABS = [
  // { id: 'sheet'   as Tab, label: 'Sheet',       icon: '🔢' },
  // { id: 'docs'    as Tab, label: 'Docs',        icon: '📄' },
  { id: 'screens' as Tab, label: '画面設計書',  icon: '📊' },
  { id: 'flow'    as Tab, label: '画面遷移図',  icon: '📐' },
  { id: 'bizflow' as Tab, label: '業務フロー図', icon: '📋' },
  { id: 'emails'  as Tab, label: 'メール一覧',  icon: '✉️' },
  { id: 'db'      as Tab, label: 'DB設計書',    icon: '🗄️' },
  { id: 'er'      as Tab, label: 'ER図',        icon: '🔗' },
]

export default function Dashboard({ user }: { user: User }) {
  const [tab, setTab] = useState<Tab>('screens')
  const [visited, setVisited] = useState<Set<Tab>>(new Set(['screens']))
  const router = useRouter()

  function switchTab(t: Tab) {
    setTab(t)
    setVisited(prev => { const s = new Set(prev); s.add(t); return s })
  }
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* Navbar */}
      <div style={{
        height: 42, background: '#1e1e24', borderBottom: '1px solid #2e2e38',
        display: 'flex', alignItems: 'stretch', flexShrink: 0,
        boxShadow: '0 2px 10px rgba(0,0,0,.5)', padding: '0 10px', gap: 2
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', fontSize: 14, fontWeight: 700,
          color: '#d0d0d8', whiteSpace: 'nowrap', padding: '0 12px 0 4px',
          borderRight: '1px solid #2e2e38', marginRight: 6, letterSpacing: '.3px'
        }}>
          <span style={{ color: '#5588cc', marginRight: 6 }}>📂</span>Rincle 要件定義
        </div>

        {TABS.map(t => (
          <button key={t.id} onClick={() => switchTab(t.id)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '0 16px',
            border: 'none', background: 'transparent',
            color: tab === t.id ? '#90b8f0' : '#686880',
            fontSize: 12, fontWeight: 600, cursor: 'pointer',
            borderBottom: `2px solid ${tab === t.id ? '#4a8ad8' : 'transparent'}`,
            borderTop: '2px solid transparent',
            backgroundColor: tab === t.id ? 'rgba(74,138,216,.07)' : 'transparent',
            whiteSpace: 'nowrap'
          }}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}

        <div style={{ flex: 1 }} />

        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, paddingRight: 4
        }}>
          <span style={{ fontSize: 11, color: '#555568' }}>{user.email}</span>
          <button onClick={handleLogout} style={{
            padding: '4px 12px', border: '1px solid #444450', borderRadius: 4,
            background: 'transparent', color: '#888898', fontSize: 11,
            cursor: 'pointer'
          }}>
            ログアウト
          </button>
        </div>
      </div>

      {/* Content — visited tabs stay mounted (display:none) to avoid re-fetching */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {visited.has('sheet')   && <div style={{ display: tab === 'sheet'   ? 'block' : 'none', position: 'absolute', inset: 0 }}><SheetTab /></div>}
        {visited.has('screens') && <div style={{ display: tab === 'screens' ? 'block' : 'none', position: 'absolute', inset: 0 }}><ScreensTab /></div>}
        {visited.has('docs')    && <div style={{ display: tab === 'docs'    ? 'block' : 'none', position: 'absolute', inset: 0 }}><DocsTab /></div>}
        {visited.has('flow')    && <div style={{ display: tab === 'flow'    ? 'block' : 'none', position: 'absolute', inset: 0 }}><FlowTab /></div>}
        {visited.has('bizflow') && <div style={{ display: tab === 'bizflow' ? 'block' : 'none', position: 'absolute', inset: 0 }}><BizFlowTab /></div>}
        {visited.has('emails')  && <div style={{ display: tab === 'emails'  ? 'block' : 'none', position: 'absolute', inset: 0 }}><EmailsTab /></div>}
        {visited.has('db')      && <div style={{ display: tab === 'db'      ? 'block' : 'none', position: 'absolute', inset: 0 }}><DbTab /></div>}
        {visited.has('er')      && <div style={{ display: tab === 'er'      ? 'block' : 'none', position: 'absolute', inset: 0 }}><ErTab /></div>}
      </div>
    </div>
  )
}
