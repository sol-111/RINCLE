'use client'

import { useEffect, useRef } from 'react'

// ─── COLOR TYPES ──────────────────────────────────────────────────────────────
const T: Record<string, { fill: string; stroke: string; tc: string }> = {
  bubble:   { fill:'#1a3a28', stroke:'#34a853', tc:'#a0e8b8' },
  external: { fill:'#1a2a4a', stroke:'#4a90d9', tc:'#90b8f8' },
  popup:    { fill:'#3a3010', stroke:'#c8a030', tc:'#ffe066' },
}

// ─── NODES ────────────────────────────────────────────────────────────────────
// [id, x, y, w, h, type, label_lines...]
const NODES: (string | number)[][] = [
  ['top',        60,  280, 110, 52, 'bubble',   'TOP', '(top_search)'],
  ['search',    230,  280, 120, 52, 'bubble',   '空車検索', '(TOP内)'],
  ['results',   420,  280, 110, 52, 'bubble',   '検索', '結果一覧'],
  ['bicycle',   600,  280, 110, 52, 'bubble',   '自転車', '詳細'],
  ['cart1',     790,  280, 130, 52, 'bubble',   '予約内容①', '(空車確認)'],
  ['cart2',     990,  280, 130, 52, 'bubble',   '予約内容②', '(顧客情報)'],
  ['cart3',    1190,  280, 130, 52, 'bubble',   '予約内容③', '(内容確認)'],
  ['cart4',    1390,  280, 130, 52, 'bubble',   '予約内容④', '(決済)'],
  ['resv',     1590,  280, 110, 52, 'bubble',   '予約', '一覧'],

  ['card',     1390,  160, 130, 52, 'popup',    'カード情報', '入力'],
  ['payjp',    1590,  160, 100, 52, 'external', 'Pay.JP'],

  ['news_top',  230,  440, 120, 52, 'bubble',   '新着情報', '(TOP内)'],
  ['news_dtl',  420,  440, 110, 52, 'bubble',   '新着情報', '詳細'],
  ['topics_top',230,  510, 120, 52, 'bubble',   'TOPICS', '(TOP内)'],
  ['topics_dtl',420,  510, 110, 52, 'bubble',   'TOPICS', '詳細'],

  ['login',     230,  630, 120, 52, 'popup',    'ログイン', 'ポップアップ'],
  ['signup',    230,  698, 120, 52, 'popup',    '新規登録', 'ポップアップ'],
  ['mypage',    420,  630, 110, 52, 'bubble',   'マイページ'],
  ['edit',      600,  630, 120, 52, 'bubble',   'アカウント', '編集'],
  ['user_resv', 600,  698, 120, 52, 'bubble',   '予約一覧', '(マイページ)'],

  ['guide',     240,  830, 100, 44, 'bubble',   'ガイド'],
  ['howtopay',  355,  830, 110, 44, 'bubble',   '料金・', 'お支払い'],
  ['faq',       480,  830, 110, 44, 'bubble',   'よくある', '質問'],
  ['privacy',   605,  830, 130, 44, 'bubble',   'プライバシー', 'ポリシー'],
  ['contact',   750,  830, 120, 44, 'bubble',   'お問い合わせ'],
]

// ─── EDGES ────────────────────────────────────────────────────────────────────
const EDGES: (string | boolean)[][] = [
  ['r:l','top','search',''],
  ['r:l','search','results',''],
  ['r:l','results','bicycle',''],
  ['r:l','bicycle','cart1',''],
  ['r:l','cart1','cart2',''],
  ['r:l','cart2','cart3',''],
  ['r:l','cart3','cart4',''],
  ['r:l','cart4','resv',''],

  ['t:b','cart4','card',''],
  ['r:l','card','payjp',''],

  ['r:l','news_top','news_dtl',''],
  ['r:l','topics_top','topics_dtl',''],

  ['r:l','login','mypage',''],
  ['r:l','mypage','edit',''],
  ['b:t','mypage','user_resv',''],

  ['r:l','guide','howtopay','', true],
  ['r:l','howtopay','faq','', true],
  ['r:l','faq','privacy','', true],
  ['r:l','privacy','contact','', true],
]

// ─── NODE MAP ─────────────────────────────────────────────────────────────────
type NodeDef = { id: string; x: number; y: number; w: number; h: number; type: string; lines: string[] }
const NM: Record<string, NodeDef> = {}
NODES.forEach(n => {
  NM[n[0] as string] = {
    id: n[0] as string, x: n[1] as number, y: n[2] as number,
    w: n[3] as number,  h: n[4] as number,  type: n[5] as string,
    lines: n.slice(6) as string[],
  }
})

function pt(id: string, side: string): [number, number] {
  const n = NM[id]
  const cx = n.x + n.w / 2, cy = n.y + n.h / 2
  return ({ r:[n.x+n.w, cy], l:[n.x, cy], t:[cx, n.y], b:[cx, n.y+n.h] } as Record<string, [number,number]>)[side]
}

function esc(s: string) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }

function nodeEl(n: NodeDef): string {
  const t = T[n.type]
  const cx = n.x + n.w / 2
  let labels = ''
  if (n.lines.length === 1) {
    labels = `<text x="${cx}" y="${n.y+n.h/2+4}" text-anchor="middle" fill="${t.tc}" font-size="11">${esc(n.lines[0])}</text>`
  } else {
    n.lines.forEach((l, i) => {
      const dy = n.y + n.h/2 + (i - (n.lines.length-1)/2)*15 + 4
      labels += `<text x="${cx}" y="${dy}" text-anchor="middle" fill="${t.tc}" font-size="11">${esc(l)}</text>`
    })
  }
  return `<g class="node" id="n-${n.id}"><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="8" fill="${t.fill}" stroke="${t.stroke}" stroke-width="1.5"/>${labels}</g>`
}

function orthoPath(fx: number, fy: number, tx: number, ty: number, dash=false): string {
  const dashAttr = dash ? ' stroke-dasharray="5,3"' : ''
  let d: string
  if (Math.abs(fy-ty) < 2) {
    d = `M ${fx} ${fy} H ${tx}`
  } else if (Math.abs(fx-tx) < 2) {
    d = `M ${fx} ${fy} V ${ty}`
  } else {
    const midX = (fx+tx)/2
    d = `M ${fx} ${fy} H ${midX} V ${ty} H ${tx}`
  }
  return `<path d="${d}" fill="none" stroke="#5a6a7a" stroke-width="1.5"${dashAttr} marker-end="url(#arr)"/>`
}

function edgeEl(e: (string | boolean)[]): string {
  const [sides, fid, tid, , dashed] = e as [string, string, string, string, boolean|undefined]
  const [fs, ts] = sides.split(':')
  const [fx,fy] = pt(fid, fs)
  const [tx,ty] = pt(tid, ts)
  if (fs==='t' || fs==='b') {
    const dashAttr = dashed ? ' stroke-dasharray="5,3"' : ''
    const midY = (fy+ty)/2
    const d = Math.abs(fx-tx) < 2
      ? `M ${fx} ${fy} V ${ty}`
      : `M ${fx} ${fy} V ${midY} H ${tx} V ${ty}`
    return `<path d="${d}" fill="none" stroke="#5a6a7a" stroke-width="1.5"${dashAttr} marker-end="url(#arr)"/>`
  }
  return orthoPath(fx, fy, tx, ty, dashed||false)
}

function backArrows(): string {
  const routeY = 248
  const searchX = NM.search.x + NM.search.w/2
  const searchY = NM.search.y
  const sources: [number,number][] = [
    [NM.bicycle.x + NM.bicycle.w/2, NM.bicycle.y],
    [NM.cart1.x   + NM.cart1.w/2,   NM.cart1.y],
    [NM.resv.x    + NM.resv.w/2,     NM.resv.y],
  ]
  const rightX = sources[sources.length-1][0]
  let svg = ''
  sources.forEach(([sx, sy]) => {
    svg += `<line x1="${sx}" y1="${sy}" x2="${sx}" y2="${routeY}" stroke="#4a5a6a" stroke-width="1.2" stroke-dasharray="5,3"/>`
  })
  svg += `<line x1="${rightX}" y1="${routeY}" x2="${searchX}" y2="${routeY}" stroke="#4a5a6a" stroke-width="1.2" stroke-dasharray="5,3"/>`
  svg += `<line x1="${searchX}" y1="${routeY}" x2="${searchX}" y2="${searchY}" stroke="#4a5a6a" stroke-width="1.2" stroke-dasharray="5,3" marker-end="url(#arr-back)"/>`
  return svg
}

function diagonalEdges(): string {
  const topBx = NM.top.x + NM.top.w/2
  const topBy = NM.top.y + NM.top.h
  const targets: [number,number][] = [
    [NM.news_top.x,   NM.news_top.y   + NM.news_top.h/2],
    [NM.topics_top.x, NM.topics_top.y + NM.topics_top.h/2],
    [NM.login.x,      NM.login.y      + NM.login.h/2],
    [NM.signup.x,     NM.signup.y     + NM.signup.h/2],
    [NM.guide.x,      NM.guide.y      + NM.guide.h/2],
  ]
  const maxTy = Math.max(...targets.map(([,ty]) => ty))
  let svg = ''
  svg += `<line x1="${topBx}" y1="${topBy}" x2="${topBx}" y2="${maxTy}" stroke="#5a6a7a" stroke-width="1.5"/>`
  targets.forEach(([tx, ty]) => {
    svg += `<line x1="${topBx}" y1="${ty}" x2="${tx}" y2="${ty}" stroke="#5a6a7a" stroke-width="1.5" marker-end="url(#arr)"/>`
  })
  return svg
}

function sections(): string {
  return `
    <rect x="30" y="135" width="1720" height="770" rx="12" fill="rgba(30,80,180,0.07)" stroke="#2a3a5a" stroke-width="1"/>
    <text x="48" y="157" fill="#4a6a9a" font-size="13" font-weight="700" font-family="'Hiragino Sans',sans-serif">利用者</text>
    <rect x="210" y="808" width="700" height="82" rx="8" fill="rgba(58,48,16,0.4)" stroke="#6a5820" stroke-width="1" stroke-dasharray="4,3"/>
    <text x="226" y="824" fill="#c8a030" font-size="11" font-weight="700" font-family="'Hiragino Sans',sans-serif">ヘッダー / フッター（全画面共通）</text>
  `
}

function buildSvgContent(): string {
  let html = ''
  html += sections()
  html += backArrows()
  html += diagonalEdges()
  EDGES.forEach(e => { html += edgeEl(e) })
  NODES.forEach(([id]) => { html += nodeEl(NM[id as string]) })
  html += `<text x="310" y="270" fill="#4a5a6a" font-size="9" font-family="monospace" text-anchor="middle">検索する</text>`
  html += `<text x="478" y="270" fill="#4a5a6a" font-size="9" font-family="monospace" text-anchor="middle">詳細を見る</text>`
  html += `<text x="656" y="270" fill="#4a5a6a" font-size="9" font-family="monospace" text-anchor="middle">予約画面へ進む</text>`
  html += `<text x="858" y="270" fill="#4a5a6a" font-size="9" font-family="monospace" text-anchor="middle">顧客情報入力へ</text>`
  html += `<text x="1058" y="270" fill="#4a5a6a" font-size="9" font-family="monospace" text-anchor="middle">内容確認へ</text>`
  html += `<text x="1258" y="270" fill="#4a5a6a" font-size="9" font-family="monospace" text-anchor="middle">予約する</text>`
  html += `<text x="1460" y="270" fill="#4a5a6a" font-size="9" font-family="monospace" text-anchor="middle">予約完了</text>`
  return html
}

const SVG_W = 1800, SVG_H = 960

export default function FlowTab() {
  const vpRef = useRef<SVGGElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const state = useRef({ vx: 0, vy: 0, vscale: 1 })
  const dragRef = useRef<{ sx: number; sy: number } | null>(null)

  function applyTransform() {
    if (!vpRef.current) return
    const { vx, vy, vscale } = state.current
    vpRef.current.setAttribute('transform', `translate(${vx},${vy}) scale(${vscale})`)
  }

  function fitView() {
    if (!wrapRef.current) return
    const pw = wrapRef.current.clientWidth, ph = wrapRef.current.clientHeight
    state.current.vscale = Math.min(pw/SVG_W, ph/SVG_H) * 0.92
    state.current.vx = (pw - SVG_W * state.current.vscale) / 2
    state.current.vy = (ph - SVG_H * state.current.vscale) / 2
    applyTransform()
  }

  useEffect(() => {
    if (vpRef.current) {
      vpRef.current.innerHTML = buildSvgContent()
    }
    fitView()

    const wrap = wrapRef.current
    if (!wrap) return

    function onWheel(e: WheelEvent) {
      e.preventDefault()
      const factor = e.deltaY < 0 ? 1.12 : 0.88
      const rect = wrap!.getBoundingClientRect()
      const mx = e.clientX - rect.left, my = e.clientY - rect.top
      state.current.vx = mx - (mx - state.current.vx) * factor
      state.current.vy = my - (my - state.current.vy) * factor
      state.current.vscale *= factor
      applyTransform()
    }
    function onMouseDown(e: MouseEvent) {
      dragRef.current = { sx: e.clientX - state.current.vx, sy: e.clientY - state.current.vy }
    }
    function onMouseMove(e: MouseEvent) {
      if (!dragRef.current) return
      state.current.vx = e.clientX - dragRef.current.sx
      state.current.vy = e.clientY - dragRef.current.sy
      applyTransform()
    }
    function onMouseUp() { dragRef.current = null }

    wrap.addEventListener('wheel', onWheel, { passive: false })
    wrap.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      wrap.removeEventListener('wheel', onWheel)
      wrap.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', overflow:'hidden', background:'#212124' }}>
      {/* Topbar */}
      <div style={{
        background:'#2a2a2f', padding:'7px 14px', display:'flex', alignItems:'center',
        gap:10, borderBottom:'1px solid #38383f', flexShrink:0, boxShadow:'0 2px 8px rgba(0,0,0,.4)',
      }}>
        <h1 style={{ fontSize:15, fontWeight:700, color:'#d0d0d8', whiteSpace:'nowrap' }}>📐 Rincle 画面遷移図</h1>
        <div style={{ width:1, height:18, background:'#38383f' }} />
        <button onClick={fitView} style={{
          padding:'4px 12px', border:'1px solid #444450', borderRadius:4,
          background:'#38383f', color:'#a0a0b8', fontSize:11, cursor:'pointer',
        }}>全体表示</button>
        <span style={{ fontSize:11, color:'#666678', marginLeft:'auto' }}>マウスホイールでズーム / ドラッグでパン</span>
      </div>

      {/* Diagram */}
      <div ref={wrapRef} style={{ flex:1, overflow:'hidden', cursor:'grab', background:'#1a1a1f', position:'relative' }}>
        <svg style={{ width:'100%', height:'100%' }}>
          <defs>
            <marker id="arr" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0,8 3,0 6" fill="#7a8a9a"/>
            </marker>
            <marker id="arr-back" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0,8 3,0 6" fill="#5a6a7a"/>
            </marker>
            <marker id="arr-green" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
              <polygon points="0 0,8 3,0 6" fill="#34a853"/>
            </marker>
          </defs>
          <g ref={vpRef} />
        </svg>

        {/* Legend */}
        <div style={{
          position:'absolute', bottom:16, left:16, background:'#2a2a2f',
          border:'1px solid #38383f', borderRadius:8, padding:'10px 14px',
          display:'flex', flexDirection:'column', gap:6, boxShadow:'0 4px 12px rgba(0,0,0,.5)',
        }}>
          <div style={{ fontSize:11, fontWeight:700, color:'#888898', marginBottom:2 }}>凡例</div>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            {[
              { bg:'#1a3a28', stroke:'#34a853', label:'Bubble画面' },
              { bg:'#3a3010', stroke:'#c8a030', label:'ポップアップ' },
              { bg:'#1a2a4a', stroke:'#4a90d9', label:'外部サービス' },
            ].map(({ bg, stroke, label }) => (
              <div key={label} style={{ display:'flex', alignItems:'center', gap:7, fontSize:11, color:'#a0a0b8' }}>
                <div style={{ width:30, height:18, borderRadius:4, border:`1.5px solid ${stroke}`, background:bg, flexShrink:0 }} />
                {label}
              </div>
            ))}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <div style={{ display:'flex', alignItems:'center', gap:7, fontSize:11, color:'#a0a0b8' }}>
              <svg width="36" height="12" viewBox="0 0 36 12">
                <defs><marker id="la" markerWidth="6" markerHeight="5" refX="5" refY="2.5" orient="auto"><polygon points="0 0,6 2.5,0 5" fill="#7a8a9a"/></marker></defs>
                <line x1="0" y1="6" x2="29" y2="6" stroke="#7a8a9a" strokeWidth="1.5" markerEnd="url(#la)"/>
              </svg>
              進む遷移
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:7, fontSize:11, color:'#a0a0b8' }}>
              <svg width="36" height="12" viewBox="0 0 36 12">
                <defs><marker id="lb" markerWidth="6" markerHeight="5" refX="5" refY="2.5" orient="auto"><polygon points="0 0,6 2.5,0 5" fill="#4a5a6a"/></marker></defs>
                <line x1="0" y1="6" x2="29" y2="6" stroke="#4a5a6a" strokeWidth="1.2" strokeDasharray="4,3" markerEnd="url(#lb)"/>
              </svg>
              戻る遷移
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
