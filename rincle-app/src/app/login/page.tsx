'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('メールアドレスまたはパスワードが正しくありません')
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#212124',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Segoe UI', -apple-system, BlinkMacSystemFont, 'Hiragino Sans', sans-serif"
    }}>
      <div style={{
        background: '#2a2a2f', borderRadius: 10, padding: '40px 36px',
        border: '1px solid #38383f', width: 360, boxShadow: '0 4px 24px rgba(0,0,0,.5)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>📂</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#d0d0d8' }}>Rincle</div>
          <div style={{ fontSize: 12, color: '#666678', marginTop: 4 }}>要件定義ツール</div>
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: '#888898', display: 'block', marginBottom: 5 }}>
              メールアドレス
            </label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)} required
              style={{
                width: '100%', padding: '8px 12px', background: '#38383f',
                border: '1px solid #444450', borderRadius: 5, color: '#d0d0d8',
                fontSize: 13, outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, color: '#888898', display: 'block', marginBottom: 5 }}>
              パスワード
            </label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)} required
              style={{
                width: '100%', padding: '8px 12px', background: '#38383f',
                border: '1px solid #444450', borderRadius: 5, color: '#d0d0d8',
                fontSize: 13, outline: 'none', boxSizing: 'border-box'
              }}
            />
          </div>

          {error && (
            <div style={{
              background: '#3a1a1a', border: '1px solid #6a2a2a', borderRadius: 5,
              padding: '8px 12px', fontSize: 12, color: '#e08080', marginBottom: 14
            }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '9px', background: '#4a8ad8', border: 'none',
            borderRadius: 5, color: '#fff', fontSize: 13, fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1
          }}>
            {loading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>
      </div>
    </div>
  )
}
