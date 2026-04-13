'use client'

import { useEffect, useRef, useState } from 'react'
import { readTextFile, writeTextFile } from '@/lib/fs'
import JsonViewer from './JsonViewer'

// ─── TYPES ────────────────────────────────────────────────────────────────────
type NodeObj  = { id:string;x:number;y:number;w:number;h:number;type:string;shape?:'rect'|'diamond'|'ellipse';lines:string[];fill?:string|null;fillOpacity?:number;stroke?:string|null;dashed?:boolean }
type EdgeObj  = { id:string;from:string;fromSide:string;to:string;toSide:string;label:string;dashed:boolean;offset?:number|null;arrowDir?:'end'|'start'|'both'|'none';ng?:boolean }
type FrameObj = { id:string;x:number;y:number;w:number;h:number;label:string;fillHex?:string;fillOpacity?:number;stroke:string;labelColor:string;dashed:boolean }
type LaneObj  = { id:string;label:string;y:number;height:number;type:string }
type PhaseObj = { id:string;label:string;x:number;width:number;type?:string }
type SelObj   = { type:'node'|'edge'|'frame'|'lane'|'phase'; id:string } | null
type MultiSel = { type:'node'|'frame'; id:string }
type FlowState = { nodes:NodeObj[];edges:EdgeObj[];frames:FrameObj[];lanes:LaneObj[];phases:PhaseObj[];nextId:number }
type UnifiedFlowJson = { title?:string; colorLegend?:Record<string,{label:string;fill:string;stroke:string}>; diagrams:Record<string,FlowState>; activeDiagram?:string }

const TYPES: Record<string, { fill:string; stroke:string; tc:string }> = {
  bubble:   { fill:'#1a3a28', stroke:'#34a853', tc:'#a0e8b8' },
  popup:    { fill:'#3a3010', stroke:'#c8a030', tc:'#ffe066' },
  external: { fill:'#1a2a4a', stroke:'#4a90d9', tc:'#90b8f8' },
  custom1:  { fill:'#3a1a2a', stroke:'#c040a0', tc:'#f090d0' },
  custom2:  { fill:'#1a1a3a', stroke:'#7060e0', tc:'#b0a0f8' },
  user:     { fill:'#1a3a28', stroke:'#34a853', tc:'#a0e8b8' },
  store:    { fill:'#1e1a38', stroke:'#8060d8', tc:'#c0a0f8' },
  admin:    { fill:'#3a1818', stroke:'#d05050', tc:'#f0a0a0' },
  decision: { fill:'#151e38', stroke:'#4a72c0', tc:'#90b0e8' },
  startend: { fill:'#222230', stroke:'#686890', tc:'#b0b0c8' },
  notify:   { fill:'#182030', stroke:'#3090b0', tc:'#80d0e0' },
  io:       { fill:'#301e10', stroke:'#a07030', tc:'#d0b080' },
}
const PALETTE = [
  null,'#111111','#555566','#3d2868','#2d3d5a','#2d4a8a','#1a3d28','#4a3a18','#4a1a1a',
  '#ffffff','#aaaaaa','#777788','#8040d0','#2060c0','#4a90d9','#34a853','#d4b000','#e03020',
]

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function hexToRgba(hex:string|null|undefined, opacity:number):string {
  if(!hex) return 'none'
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16)
  return `rgba(${r},${g},${b},${opacity})`
}
function getContrastColor(hex:string):string {
  const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16)
  return (0.299*r+0.587*g+0.114*b)>140?'#1a1a1a':'#e8e8f0'
}
function esc(s:string):string { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') }
function resizeHandlesHtml(item:{id:string;x:number;y:number;w:number;h:number}, type:string, vscale:number):string {
  const sc=1/vscale, hs=8*sc
  const handles=[
    {edge:'nw',cx:item.x,          cy:item.y,          cur:'nw-resize'},
    {edge:'n', cx:item.x+item.w/2, cy:item.y,          cur:'n-resize'},
    {edge:'ne',cx:item.x+item.w,   cy:item.y,          cur:'ne-resize'},
    {edge:'e', cx:item.x+item.w,   cy:item.y+item.h/2, cur:'e-resize'},
    {edge:'se',cx:item.x+item.w,   cy:item.y+item.h,   cur:'se-resize'},
    {edge:'s', cx:item.x+item.w/2, cy:item.y+item.h,   cur:'s-resize'},
    {edge:'sw',cx:item.x,          cy:item.y+item.h,   cur:'sw-resize'},
    {edge:'w', cx:item.x,          cy:item.y+item.h/2, cur:'w-resize'},
  ]
  return handles.map(h=>
    `<rect class="ft-rh" data-id="${item.id}" data-type="${type}" data-edge="${h.edge}"
     x="${h.cx-hs/2}" y="${h.cy-hs/2}" width="${hs}" height="${hs}" rx="${1.5*sc}"
     fill="#5a8abf" stroke="#fff" stroke-width="${0.75*sc}" style="cursor:${h.cur}" pointer-events="all"/>`
  ).join('')
}
function nodePt(n:NodeObj,side:string):[number,number] {
  const shape=n.shape||'rect'
  const cx=n.x+n.w/2,cy=n.y+n.h/2
  if(shape==='diamond'){
    return ({r:[n.x+n.w,cy],l:[n.x,cy],t:[cx,n.y],b:[cx,n.y+n.h]} as Record<string,[number,number]>)[side]
  }
  if(shape==='ellipse'){
    return ({r:[n.x+n.w,cy],l:[n.x,cy],t:[cx,n.y],b:[cx,n.y+n.h]} as Record<string,[number,number]>)[side]
  }
  return ({r:[n.x+n.w,cy],l:[n.x,cy],t:[cx,n.y],b:[cx,n.y+n.h]} as Record<string,[number,number]>)[side]
}
const ROUTE_GAP=40
function buildPath(e:EdgeObj,nodes:NodeObj[]):string {
  const fn=nodes.find(n=>n.id===e.from),tn=nodes.find(n=>n.id===e.to)
  if(!fn||!tn) return ''
  const [fx,fy]=nodePt(fn,e.fromSide),[tx,ty]=nodePt(tn,e.toSide)
  const fs=e.fromSide,ts=e.toSide,off=e.offset??null
  if((fs==='r'&&ts==='l')||(fs==='l'&&ts==='r')){
    const fwd=fs==='r'?tx>fx:tx<fx
    const midX=off??(fwd?(fx+tx)/2:(fs==='r'?Math.max(fx,tx)+ROUTE_GAP:Math.min(fx,tx)-ROUTE_GAP))
    if(!off&&Math.abs(fy-ty)<1) return `M ${fx} ${fy} H ${tx}`
    return `M ${fx} ${fy} H ${midX} V ${ty} H ${tx}`
  }
  if((fs==='t'&&ts==='b')||(fs==='b'&&ts==='t')){
    const fwd=fs==='b'?ty>fy:ty<fy
    const midY=off??(fwd?(fy+ty)/2:(fs==='b'?Math.max(fy,ty)+ROUTE_GAP:Math.min(fy,ty)-ROUTE_GAP))
    if(!off&&Math.abs(fx-tx)<1) return `M ${fx} ${fy} V ${ty}`
    return `M ${fx} ${fy} V ${midY} H ${tx} V ${ty}`
  }
  if(fs==='r'&&ts==='r'){const o=off??Math.max(fx,tx)+ROUTE_GAP;return `M ${fx} ${fy} H ${o} V ${ty} H ${tx}`}
  if(fs==='l'&&ts==='l'){const o=off??Math.min(fx,tx)-ROUTE_GAP;return `M ${fx} ${fy} H ${o} V ${ty} H ${tx}`}
  if(fs==='b'&&ts==='b'){const o=off??Math.max(fy,ty)+ROUTE_GAP;return `M ${fx} ${fy} V ${o} H ${tx} V ${ty}`}
  if(fs==='t'&&ts==='t'){const o=off??Math.min(fy,ty)-ROUTE_GAP;return `M ${fx} ${fy} V ${o} H ${tx} V ${ty}`}
  if((fs==='r'||fs==='l')&&(ts==='t'||ts==='b')) return `M ${fx} ${fy} H ${tx} V ${ty}`
  if((fs==='t'||fs==='b')&&(ts==='r'||ts==='l')) return `M ${fx} ${fy} V ${ty} H ${tx}`
  return `M ${fx} ${fy} L ${tx} ${ty}`
}
function getEdgeHandles(e:EdgeObj,nodes:NodeObj[]):{x:number;y:number;axis:'x'|'y';cursor:string}[] {
  const fn=nodes.find(n=>n.id===e.from),tn=nodes.find(n=>n.id===e.to)
  if(!fn||!tn) return []
  const [fx,fy]=nodePt(fn,e.fromSide),[tx,ty]=nodePt(tn,e.toSide)
  const fs=e.fromSide,ts=e.toSide,off=e.offset??null
  if((fs==='r'&&ts==='l')||(fs==='l'&&ts==='r')){const fwd=fs==='r'?tx>fx:tx<fx;const midX=off??(fwd?(fx+tx)/2:(fs==='r'?Math.max(fx,tx)+ROUTE_GAP:Math.min(fx,tx)-ROUTE_GAP));return [{x:midX,y:(fy+ty)/2,axis:'x',cursor:'ew-resize'}]}
  if((fs==='t'&&ts==='b')||(fs==='b'&&ts==='t')){const fwd=fs==='b'?ty>fy:ty<fy;const midY=off??(fwd?(fy+ty)/2:(fs==='b'?Math.max(fy,ty)+ROUTE_GAP:Math.min(fy,ty)-ROUTE_GAP));return [{x:(fx+tx)/2,y:midY,axis:'y',cursor:'ns-resize'}]}
  if(fs==='r'&&ts==='r'){const o=off??Math.max(fx,tx)+ROUTE_GAP;return [{x:o,y:(fy+ty)/2,axis:'x',cursor:'ew-resize'}]}
  if(fs==='l'&&ts==='l'){const o=off??Math.min(fx,tx)-ROUTE_GAP;return [{x:o,y:(fy+ty)/2,axis:'x',cursor:'ew-resize'}]}
  if(fs==='b'&&ts==='b'){const o=off??Math.max(fy,ty)+ROUTE_GAP;return [{x:(fx+tx)/2,y:o,axis:'y',cursor:'ns-resize'}]}
  if(fs==='t'&&ts==='t'){const o=off??Math.min(fy,ty)-ROUTE_GAP;return [{x:(fx+tx)/2,y:o,axis:'y',cursor:'ns-resize'}]}
  return []
}

// ─── FORMAT DETECTION ─────────────────────────────────────────────────────────
const emptyFlowState = ():FlowState => ({nodes:[],edges:[],frames:[],lanes:[],phases:[],nextId:1})

function isUnifiedFlow(d: unknown): d is UnifiedFlowJson {
  if(!d||typeof d!=='object') return false
  const o=d as Record<string,unknown>
  if(typeof o.diagrams!=='object'||o.diagrams===null) return false
  const keys=Object.keys(o.diagrams as Record<string,unknown>)
  if(keys.length===0) return true
  const fd=(o.diagrams as Record<string,unknown>)[keys[0]]
  if(!fd||typeof fd!=='object') return false
  const f=fd as Record<string,unknown>
  return Array.isArray(f.nodes)&&Array.isArray(f.edges)&&typeof f.nextId==='number'
}
function isScreenTransition(d: unknown): d is { nodes: NodeObj[]; edges?: EdgeObj[]; frames?: FrameObj[]; lanes?: LaneObj[]; phases?: PhaseObj[]; nextId?: number } {
  return d!==null && typeof d==='object' && Array.isArray((d as Record<string,unknown>).nodes)
}
function wrapScreenFlow(d: { nodes:NodeObj[]; edges?:EdgeObj[]; frames?:FrameObj[]; lanes?:LaneObj[]; phases?:PhaseObj[]; nextId?:number }): UnifiedFlowJson {
  const fs: FlowState = { nodes:d.nodes, edges:d.edges??[], frames:d.frames??[], lanes:d.lanes??[], phases:d.phases??[], nextId:d.nextId??200 }
  return { diagrams:{ 'default': fs } }
}

// ─── CSS ──────────────────────────────────────────────────────────────────────
const CSS = `
#ft-tb{background:#2a2a2f;padding:6px 12px;display:flex;align-items:center;gap:8px;border-bottom:1px solid #38383f;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,.4);flex-wrap:wrap}
#ft-tb h1{font-size:14px;font-weight:700;color:#d0d0d8;white-space:nowrap;margin:0 4px 0 0}
.ft-sep{width:1px;height:18px;background:#38383f;flex-shrink:0}
.ft-btn{padding:4px 10px;border:1px solid #444450;border-radius:4px;background:#38383f;color:#a0a0b8;font-size:11px;cursor:pointer;white-space:nowrap;user-select:none}
.ft-btn:hover{background:#484855;color:#d0d0d8}
.ft-btn.active{background:#3a5a8a;border-color:#5a8abf;color:#b0d0f8}
#ft-hint{font-size:10px;color:#666678;margin-left:auto;white-space:nowrap}
#ft-panel{width:220px;flex-shrink:0;background:#23232a;border-left:1px solid #38383f;display:flex;flex-direction:column;overflow-y:auto;z-index:10}
#ft-panel-empty{padding:18px 12px;font-size:11px;color:#555568;line-height:1.5}
#ft-panel-inner{padding:12px;display:flex;flex-direction:column;gap:10px}
.ft-ps{display:flex;flex-direction:column;gap:6px}
.ft-pl{font-size:10px;color:#888898;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
textarea.ft-ta{width:100%;background:#2a2a33;border:1px solid #444450;border-radius:3px;color:#c0c0cc;padding:4px 6px;font-size:11px;resize:vertical;min-height:54px;font-family:inherit}
input.ft-ti{flex:1;background:#2a2a33;border:1px solid #444450;border-radius:3px;color:#c0c0cc;padding:3px 5px;font-size:11px;width:100%}
.ft-swrow{display:flex;gap:5px;flex-wrap:wrap}
.ft-sw{width:32px;height:22px;border-radius:4px;border:2px solid transparent;cursor:pointer;transition:border-color .15s}
.ft-sw.sel{border-color:#fff!important}
.ft-del{width:100%;padding:5px;border:1px solid #8a2020;border-radius:4px;background:#3a1010;color:#f08080;font-size:11px;cursor:pointer}
.ft-del:hover{background:#5a1515}
.ft-cbrow{display:flex;align-items:center;gap:6px;font-size:11px;color:#a0a0b8}
.ft-cbrow input{cursor:pointer}
.ft-segrow{display:flex}
.ft-seg{flex:1;padding:4px 0;font-size:11px;color:#888898;background:#2a2a33;border:1px solid #444450;cursor:pointer;text-align:center}
.ft-seg:first-child{border-radius:3px 0 0 3px}
.ft-seg:last-child{border-radius:0 3px 3px 0;border-left:none}
.ft-seg.active{background:#3a5a8a;border-color:#5a8abf;color:#b0d0f8}
#ft-cp{position:fixed;z-index:10000;background:#2a2a33;border:1px solid #444458;border-radius:8px;padding:12px;box-shadow:0 6px 24px rgba(0,0,0,.8);display:none;width:260px}
#ft-cp-grid{display:grid;grid-template-columns:repeat(9,24px);gap:4px;margin-bottom:10px}
.ft-cpsw{width:24px;height:24px;border-radius:50%;cursor:pointer;border:2px solid transparent;flex-shrink:0}
.ft-cpsw:hover{transform:scale(1.2)}
.ft-cpsw.csel{border-color:#fff}
.ft-cpsw.cnone{border-color:#666;display:flex;align-items:center;justify-content:center;font-size:13px;color:#666;line-height:1}
#ft-cp-oprow{display:flex;align-items:center;gap:6px;margin-top:2px}
#ft-cp-oplbl{font-size:10px;color:#888898;width:44px;flex-shrink:0}
#ft-cp-op{flex:1;accent-color:#5a8abf}
#ft-cp-opval{font-size:10px;color:#888898;width:32px;text-align:right}
.ft-cpbtn{display:flex;align-items:center;gap:5px;padding:4px 8px;border:1px solid #444450;border-radius:4px;background:#2a2a33;cursor:pointer;font-size:11px;color:#a0a0b8;flex:1}
.ft-cpbtn:hover{background:#38384a}
.ft-cpdot{width:16px;height:16px;border-radius:3px;border:1px solid rgba(255,255,255,.25);flex-shrink:0}
.ft-cprow{display:flex;gap:6px}
#ft-ctx{position:fixed;background:#2a2a33;border:1px solid #444458;border-radius:5px;padding:4px 0;z-index:9999;min-width:120px;display:none;box-shadow:0 4px 14px rgba(0,0,0,.6)}
#ft-ctx div{padding:6px 14px;font-size:12px;cursor:pointer;color:#c0c0cc}
#ft-ctx div:hover{background:#38384a}
`

// ─── FLOW EDITOR ──────────────────────────────────────────────────────────────
function FlowEditor({ rootHandle, filePath, initData, unifiedData, activeDiagram }: {
  rootHandle: FileSystemDirectoryHandle; filePath: string;
  initData: FlowState; unifiedData: UnifiedFlowJson; activeDiagram: string
}) {
  const [saveStatus, setSaveStatus] = useState<'idle'|'saving'|'saved'>('idle')
  const setSaveStatusRef = useRef(setSaveStatus)
  useEffect(() => { setSaveStatusRef.current = setSaveStatus }, [setSaveStatus])

  const wrapRef=useRef<HTMLDivElement>(null),vpRef=useRef<SVGGElement>(null)
  const pemptyRef=useRef<HTMLDivElement>(null),pinnerRef=useRef<HTMLDivElement>(null)
  const cpRef=useRef<HTMLDivElement>(null),cpGridRef=useRef<HTMLDivElement>(null)
  const cpOpRowRef=useRef<HTMLDivElement>(null),cpOpRef=useRef<HTMLInputElement>(null),cpOpValRef=useRef<HTMLSpanElement>(null)
  const ctxRef=useRef<HTMLDivElement>(null),hintRef=useRef<HTMLSpanElement>(null)
  const btnSelRef=useRef<HTMLButtonElement>(null),btnNdRef=useRef<HTMLButtonElement>(null),btnDmRef=useRef<HTMLButtonElement>(null),btnElRef=useRef<HTMLButtonElement>(null),btnFrRef=useRef<HTMLButtonElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fns=useRef<Record<string,(...a:any[])=>void>>({})

  useEffect(() => {
    const s = {
      nodes:initData.nodes.map(n=>({...n,lines:[...n.lines]})),
      edges:initData.edges.map(e=>({...e})),
      frames:initData.frames.map(f=>({...f})),
      lanes:initData.lanes.map(l=>({...l})),
      phases:initData.phases.map(p=>({...p})),
      nextId:initData.nextId,
      selected:null as SelObj, tool:'select',
      vx:0, vy:0, vscale:1,
      drag:null as unknown, conn:null as unknown, fdraw:null as unknown,
      multi:[] as MultiSel[], rband:null as unknown,
      hist:[] as string[], clip:null as unknown,
      cp:{hex:null as string|null,opacity:1,showOpacity:true,cb:null as unknown},
    }
    const wrap=wrapRef.current!,vp=vpRef.current!
    const pempty=pemptyRef.current!,pinner=pinnerRef.current!
    const cpEl=cpRef.current!,cpGrid=cpGridRef.current!
    const cpOpRow=cpOpRowRef.current!,cpOp=cpOpRef.current!,cpOpVal=cpOpValRef.current!
    const ctx=ctxRef.current!,hint=hintRef.current!
    const btnSel=btnSelRef.current!,btnNd=btnNdRef.current!,btnDm=btnDmRef.current!,btnEl=btnElRef.current!,btnFr=btnFrRef.current!

    let snapGuides:{type:'x'|'y';pos:number}[]=[]
    const SNAP_THRESH=5
    function computeSnapGuides(item:{x:number;y:number;w:number;h:number},excludeIds:Set<string>){
      const guides:{type:'x'|'y';pos:number}[]=[]
      const others=[...s.nodes.filter(n=>!excludeIds.has(n.id)),...s.frames.filter(f=>!excludeIds.has(f.id))]
      const ix=[item.x,item.x+item.w/2,item.x+item.w],iy=[item.y,item.y+item.h/2,item.y+item.h]
      others.forEach(o=>{
        [o.x,o.x+o.w/2,o.x+o.w].forEach(ox=>ix.forEach(iv=>{if(Math.abs(iv-ox)<SNAP_THRESH&&!guides.some(g=>g.type==='x'&&Math.abs(g.pos-ox)<1))guides.push({type:'x',pos:ox})}))
        ;[o.y,o.y+o.h/2,o.y+o.h].forEach(oy=>iy.forEach(iv=>{if(Math.abs(iv-oy)<SNAP_THRESH&&!guides.some(g=>g.type==='y'&&Math.abs(g.pos-oy)<1))guides.push({type:'y',pos:oy})}))
      })
      return guides
    }
    const getNode=(id:string)=>s.nodes.find(n=>n.id===id)
    const getEdge=(id:string)=>s.edges.find(e=>e.id===id)
    const getFrame=(id:string)=>s.frames.find(f=>f.id===id)
    const genId=(p:string)=>p+(s.nextId++)
    const svgPt=(cx:number,cy:number):[number,number]=>{const r=wrap.getBoundingClientRect();return [(cx-r.left-s.vx)/s.vscale,(cy-r.top-s.vy)/s.vscale]}

    // ─── SAVE ─────────────────────────────────────────────────────────────
    let saveTimer:ReturnType<typeof setTimeout>|null=null
    async function saveToFile(){
      setSaveStatusRef.current('saving')
      try{
        const currentFs:FlowState = {nodes:s.nodes,edges:s.edges,frames:s.frames,lanes:s.lanes,phases:s.phases,nextId:s.nextId}
        const keys=Object.keys(unifiedData.diagrams)
        const isSingleDefault = keys.length<=1 && (keys[0]==='default'||keys.length===0) && !unifiedData.title && !unifiedData.colorLegend
        let output:string
        if(isSingleDefault){
          output=JSON.stringify({...currentFs,vx:s.vx,vy:s.vy,vscale:s.vscale},null,2)
        }else{
          const updated:UnifiedFlowJson = {...unifiedData, diagrams:{...unifiedData.diagrams,[activeDiagram]:currentFs}, activeDiagram}
          output=JSON.stringify(updated,null,2)
        }
        await writeTextFile(rootHandle,filePath,output)
        setSaveStatusRef.current('saved')
        setTimeout(()=>setSaveStatusRef.current('idle'),2000)
      }catch{setSaveStatusRef.current('idle')}
    }
    function scheduleSave(){if(saveTimer)clearTimeout(saveTimer);saveTimer=setTimeout(saveToFile,1500)}
    function pushHist(){
      s.hist.push(JSON.stringify({nodes:s.nodes,edges:s.edges,frames:s.frames,lanes:s.lanes,phases:s.phases,nextId:s.nextId}))
      if(s.hist.length>50)s.hist.shift();scheduleSave()
    }
    function undo(){
      if(!s.hist.length)return
      const snap=JSON.parse(s.hist.pop()!)
      s.nodes=snap.nodes;s.edges=snap.edges;s.frames=snap.frames;s.lanes=snap.lanes||[];s.phases=snap.phases||[];s.nextId=snap.nextId
      s.selected=null;updatePanel();render();showHint('元に戻しました');scheduleSave()
    }
    function showHint(msg:string,ms=1500){const prev=hint.textContent;hint.textContent=msg;setTimeout(()=>hint.textContent=prev,ms)}

    // ─── COLOR PICKER ─────────────────────────────────────────────────────
    type CpCb=(hex:string|null,op:number)=>void
    function renderCp(){
      cpGrid.innerHTML=PALETTE.map(c=>{
        if(c===null)return `<div class="ft-cpsw cnone${s.cp.hex===null?' csel':''}" data-cpick="null">⊘</div>`
        return `<div class="ft-cpsw${c===s.cp.hex?' csel':''}" style="background:${c}" data-cpick="${c}"></div>`
      }).join('')
      const pct=Math.round(s.cp.opacity*100);cpOp.value=String(pct);cpOpVal.textContent=pct+'%'
      cpOpRow.style.display=s.cp.showOpacity?'flex':'none'
    }
    function showCp(anchor:HTMLElement,hex:string|null,opacity:number,showOpacity:boolean,cb:CpCb){
      s.cp={hex,opacity,showOpacity,cb};renderCp()
      const ar=anchor.getBoundingClientRect()
      cpEl.style.left=Math.min(ar.left,window.innerWidth-280)+'px';cpEl.style.top=(ar.bottom+6)+'px';cpEl.style.display='block'
    }
    cpGrid.addEventListener('click',ev=>{const t=(ev.target as HTMLElement).closest('[data-cpick]') as HTMLElement|null;if(!t)return;const v=t.dataset.cpick!;s.cp.hex=v==='null'?null:v;renderCp();if(s.cp.cb)(s.cp.cb as CpCb)(s.cp.hex,s.cp.opacity)})
    cpOp.addEventListener('input',()=>{s.cp.opacity=Number(cpOp.value)/100;cpOpVal.textContent=cpOp.value+'%';if(s.cp.cb)(s.cp.cb as CpCb)(s.cp.hex,s.cp.opacity)})

    // ─── TRANSFORM ────────────────────────────────────────────────────────
    function applyTransform(){vp.setAttribute('transform',`translate(${s.vx},${s.vy}) scale(${s.vscale})`)}
    function fitView(){
      const pw=wrap.clientWidth,ph=wrap.clientHeight;if(pw===0||ph===0)return
      let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity
      for(const n of s.nodes){if(n.x<minX)minX=n.x;if(n.y<minY)minY=n.y;if(n.x+n.w>maxX)maxX=n.x+n.w;if(n.y+n.h>maxY)maxY=n.y+n.h}
      for(const f of s.frames){if(f.x<minX)minX=f.x;if(f.y<minY)minY=f.y;if(f.x+f.w>maxX)maxX=f.x+f.w;if(f.y+f.h>maxY)maxY=f.y+f.h}
      for(const l of s.lanes){if(0<minX)minX=0;if(l.y<minY)minY=l.y;if(l.y+l.height>maxY)maxY=l.y+l.height}
      for(const p of s.phases){if(p.x<minX)minX=p.x;if(p.x+p.width>maxX)maxX=p.x+p.width}
      if(!isFinite(minX)){minX=0;minY=0;maxX=1800;maxY=960}
      const pad=40,cw=maxX-minX+pad*2,ch=maxY-minY+pad*2
      s.vscale=Math.min(pw/cw,ph/ch)*0.95
      s.vx=(pw-cw*s.vscale)/2-(minX-pad)*s.vscale;s.vy=(ph-ch*s.vscale)/2-(minY-pad)*s.vscale
      applyTransform()
    }

    // ─── RENDER ───────────────────────────────────────────────────────────
    function render(){
      let h=''
      // compute bounds covering all lanes, phases, nodes, frames
      const allYs = [...s.lanes.map(l=>l.y), ...s.nodes.map(n=>n.y-20), ...s.frames.map(f=>f.y-20)]
      const allYe = [...s.lanes.map(l=>l.y+l.height), ...s.nodes.map(n=>n.y+n.h+20), ...s.frames.map(f=>f.y+f.h+20)]
      const allXs = [...s.phases.map(p=>p.x), ...s.nodes.map(n=>n.x-20), ...s.frames.map(f=>f.x-20)]
      const allXe = [...s.phases.map(p=>p.x+p.width), ...s.nodes.map(n=>n.x+n.w+20), ...s.frames.map(f=>f.x+f.w+20)]
      const minY = allYs.length ? Math.min(0, ...allYs) : 0
      const maxY = allYe.length ? Math.max(1000, ...allYe) : 1000
      const minX = allXs.length ? Math.min(0, ...allXs) : 0
      const maxX = allXe.length ? Math.max(2000, ...allXe) : 2000
      const totalH = maxY - minY + 50
      const maxW = maxX - minX + 200

      // Lanes
      s.lanes.forEach(lane=>{
        const isSel=s.selected?.type==='lane'&&s.selected.id===lane.id
        const t=TYPES[lane.type]||TYPES.bubble
        const fillC=hexToRgba(t.fill,0.25)
        const strokeC=isSel?'#5a8abf':t.stroke
        const sw=isSel?'2':'0.5'
        h+=`<g class="lane-el" data-id="${lane.id}">`
        h+=`<rect x="${minX}" y="${lane.y}" width="${maxW}" height="${lane.height}" fill="${fillC}" stroke="${strokeC}" stroke-width="${sw}" stroke-dasharray="${isSel?'':'4,2'}"/>`
        h+=`<rect x="${minX}" y="${lane.y}" width="28" height="${lane.height}" fill="${hexToRgba(t.stroke,0.15)}" rx="0"/>`
        // Vertical label
        const labelY=lane.y+lane.height/2
        h+=`<text x="14" y="${labelY}" fill="${t.stroke}" font-size="12" font-weight="700" font-family="'Hiragino Sans',sans-serif" text-anchor="middle" dominant-baseline="central" transform="rotate(-90,14,${labelY})" style="letter-spacing:2px">${esc(lane.label)}</text>`
        if(isSel){const sc=1/s.vscale,hs=6*sc
          h+=`<rect class="lane-resize-top" data-id="${lane.id}" x="${minX}" y="${lane.y-hs/2}" width="${maxW}" height="${hs}" fill="rgba(90,138,191,0.15)" style="cursor:ns-resize" pointer-events="all"/>`
          h+=`<rect class="lane-resize" data-id="${lane.id}" x="${minX}" y="${lane.y+lane.height-hs/2}" width="${maxW}" height="${hs}" fill="rgba(90,138,191,0.15)" style="cursor:ns-resize" pointer-events="all"/>`
        }
        h+=`</g>`
      })
      // Phases
      s.phases.forEach((phase,pi)=>{
        const isSel=s.selected?.type==='phase'&&s.selected.id===phase.id
        const pt=phase.type?TYPES[phase.type]:null
        const pStroke=isSel?'#5a8abf':pt?pt.stroke:'#3a3a4a'
        const pFill=pt?hexToRgba(pt.fill,0.12):'transparent'
        const hdrFill=isSel?'rgba(90,138,191,0.12)':pt?hexToRgba(pt.stroke,0.12):'rgba(60,60,80,0.25)'
        const txtFill=isSel?'#b0d0f8':pt?pt.tc:'#8890a0'
        h+=`<g class="phase-el" data-id="${phase.id}">`
        h+=`<rect x="${phase.x}" y="${minY}" width="${phase.width}" height="${totalH}" fill="${isSel?'rgba(90,138,191,0.06)':pFill}"/>`
        h+=`<line x1="${phase.x}" y1="${minY}" x2="${phase.x}" y2="${minY+totalH}" stroke="${pStroke}" stroke-width="${isSel?'1.5':'0.5'}"/>`
        const hdrH=28
        h+=`<rect x="${phase.x}" y="${minY}" width="${phase.width}" height="${hdrH}" rx="0" fill="${hdrFill}"/>`
        h+=`<line x1="${phase.x}" y1="${minY+hdrH}" x2="${phase.x+phase.width}" y2="${minY+hdrH}" stroke="${pStroke}" stroke-width="0.5"/>`
        h+=`<text x="${phase.x+phase.width/2}" y="${minY+hdrH/2+1}" text-anchor="middle" dominant-baseline="central" fill="${txtFill}" font-size="11" font-weight="700" font-family="'Hiragino Sans',sans-serif" style="letter-spacing:0.5px">${esc(phase.label)}</text>`
        if(isSel){const sc=1/s.vscale,ws=6*sc
          h+=`<rect class="phase-resize-left" data-id="${phase.id}" x="${phase.x-ws/2}" y="${minY}" width="${ws}" height="${totalH}" fill="rgba(90,138,191,0.15)" style="cursor:ew-resize" pointer-events="all"/>`
          h+=`<rect class="phase-resize" data-id="${phase.id}" x="${phase.x+phase.width-ws/2}" y="${minY}" width="${ws}" height="${totalH}" fill="rgba(90,138,191,0.15)" style="cursor:ew-resize" pointer-events="all"/>`
        }
        h+=`</g>`
      })
      // Frames
      s.frames.forEach(f=>{
        const isSel=s.selected?.type==='frame'&&s.selected.id===f.id
        const isMS=s.multi.some(m=>m.type==='frame'&&m.id===f.id)
        const da=f.dashed?' stroke-dasharray="4,3"':''
        const ss=(isSel||isMS)?' stroke="#5a8abf" stroke-width="2.5"':` stroke="${f.stroke}" stroke-width="1"`
        const ff=f.fillHex?hexToRgba(f.fillHex,f.fillOpacity??0.1):'rgba(0,0,0,0.05)'
        h+=`<g class="frame-el" data-id="${f.id}">`
        h+=`<rect x="${f.x}" y="${f.y}" width="${f.w}" height="${f.h}" rx="12" fill="${ff}"${ss}${da}/>`
        h+=`<text x="${f.x+18}" y="${f.y+18}" fill="${f.labelColor}" font-size="13" font-weight="700" font-family="'Hiragino Sans',sans-serif">${esc(f.label)}</text>`
        if(isSel) h+=resizeHandlesHtml(f,'frame',s.vscale)
        h+=`</g>`
      })
      // Edges
      s.edges.forEach(e=>{
        const isSel=s.selected?.type==='edge'&&s.selected.id===e.id
        const d=buildPath(e,s.nodes);if(!d)return
        const da=e.dashed?' stroke-dasharray="5,3"':''
        const sc=isSel?'#5a8abf':e.ng?'#c05050':'#5a6a7a',sw=isSel?'2.5':'1.5'
        const dir=e.arrowDir??'end'
        const mEnd=(dir==='end'||dir==='both')?` marker-end="url(#${isSel?'ft-arr-sel':e.ng?'ft-arr-ng':'ft-arr'})"`:'';
        const mStart=(dir==='start'||dir==='both')?` marker-start="url(#${isSel?'ft-arr-rev-sel':'ft-arr-rev'})"`:'';
        h+=`<path class="edge-hit" data-id="${e.id}" d="${d}" fill="none" stroke="transparent" stroke-width="10"/>`
        h+=`<path class="edge-el" data-id="${e.id}" d="${d}" fill="none" stroke="${sc}" stroke-width="${sw}"${da}${mEnd}${mStart}/>`
        const fn2=getNode(e.from),tn2=getNode(e.to)
        if(fn2&&tn2&&e.label){
          const [ex2,ey2]=nodePt(fn2,e.fromSide),[tx2,ty2]=nodePt(tn2,e.toSide)
          const lx=(ex2+tx2)/2,ly=(ey2+ty2)/2-6
          h+=`<rect x="${lx-28}" y="${ly-10}" width="56" height="15" rx="3" fill="#1a1a22" opacity="0.85"/>`
          h+=`<text x="${lx}" y="${ly+2}" text-anchor="middle" fill="${e.ng?'#e06060':'#8090a0'}" font-size="9" font-family="monospace">${esc(e.label)}</text>`
        }
      })
      // Nodes
      s.nodes.forEach(n=>{
        const t=TYPES[n.type]||TYPES.bubble
        const cx=n.x+n.w/2,cy=n.y+n.h/2
        const isSel=s.selected?.type==='node'&&s.selected.id===n.id
        const isMS=s.multi.some(m=>m.type==='node'&&m.id===n.id)
        const fc=n.fill?hexToRgba(n.fill,n.fillOpacity??1):t.fill
        const sc=n.stroke||t.stroke, tc=n.fill?getContrastColor(n.fill):t.tc
        const nd=n.dashed?' stroke-dasharray="5,3"':''
        const sa=(isSel||isMS)?` stroke="#5a8abf" stroke-width="2.5"${nd}`:` stroke="${sc}" stroke-width="1.5"${nd}`
        const shape=n.shape||'rect'
        let labels=''
        if(n.lines.length===1){labels=`<text x="${cx}" y="${cy+4}" text-anchor="middle" fill="${tc}" font-size="11" pointer-events="none">${esc(n.lines[0])}</text>`}
        else{n.lines.forEach((l,i)=>{const dy=cy+(i-(n.lines.length-1)/2)*14+4;labels+=`<text x="${cx}" y="${dy}" text-anchor="middle" fill="${tc}" font-size="10" pointer-events="none">${esc(l)}</text>`})}
        h+=`<g class="node-el" data-id="${n.id}" style="cursor:move">`
        if(shape==='diamond'){
          const pts=`${cx},${n.y} ${n.x+n.w},${cy} ${cx},${n.y+n.h} ${n.x},${cy}`
          h+=`<polygon points="${pts}" fill="${fc}"${sa}/>`
        } else if(shape==='ellipse'){
          h+=`<ellipse cx="${cx}" cy="${cy}" rx="${n.w/2}" ry="${n.h/2}" fill="${fc}"${sa}/>`
        } else {
          h+=`<rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="8" fill="${fc}"${sa}/>`
        }
        h+=labels
        if(isSel) h+=resizeHandlesHtml(n,'node',s.vscale)
        h+=`</g>`
        const isHT=s.conn&&(s.conn as {hoverNodeId?:string;fromId:string}).hoverNodeId===n.id&&n.id!==(s.conn as {fromId:string}).fromId
        if(isSel||isHT){
          ;['t','b','l','r'].forEach(side=>{
            const [px,py]=nodePt(n,side)
            const snap=isHT&&(s.conn as {snapSide?:string}).snapSide===side
            h+=`<circle class="port-dot" data-node="${n.id}" data-side="${side}" cx="${px}" cy="${py}" r="${snap?8:6}" fill="${snap?'#80c0ff':'#5a8abf'}" stroke="#fff" stroke-width="1.5" style="cursor:crosshair" opacity="0.9"/>`
          })
        }
      })
      // Edge handles
      if(s.selected?.type==='edge'){
        const se=getEdge(s.selected.id);if(se){
          const sc2=1/s.vscale
          const efn=getNode(se.from),etn=getNode(se.to)
          if(efn&&etn){const [efx,efy]=nodePt(efn,se.fromSide),[etx,ety]=nodePt(etn,se.toSide);h+=`<circle cx="${efx}" cy="${efy}" r="${6*sc2}" fill="#5a8abf" stroke="#fff" stroke-width="${2*sc2}" style="pointer-events:none"/><circle cx="${etx}" cy="${ety}" r="${6*sc2}" fill="#5a8abf" stroke="#fff" stroke-width="${2*sc2}" style="pointer-events:none"/>`}
          getEdgeHandles(se,s.nodes).forEach(hdl=>{const isX=hdl.axis==='x';const vW=isX?10*sc2:28*sc2,vH=isX?28*sc2:10*sc2;const hW=isX?20*sc2:40*sc2,hH=isX?40*sc2:20*sc2;const sw=Math.max(0.5,1.5*sc2);h+=`<rect class="edge-handle" data-edge="${se.id}" data-axis="${hdl.axis}" x="${hdl.x-hW/2}" y="${hdl.y-hH/2}" width="${hW}" height="${hH}" rx="${3*sc2}" fill="rgba(0,0,0,0.001)" pointer-events="all" style="cursor:${hdl.cursor}"/><rect pointer-events="none" x="${hdl.x-vW/2}" y="${hdl.y-vH/2}" width="${vW}" height="${vH}" rx="${4*sc2}" fill="#5a8abf" stroke="#fff" stroke-width="${sw}"/>`})
        }
      }
      // Previews
      const co=s.conn as {x2?:number;y2?:number;x1:number;y1:number;hoverNodeId?:string;snapSide?:string}|null
      if(co?.x2!=null){let ex=co.x2!,ey=co.y2!;if(co.hoverNodeId&&co.snapSide){const hn=getNode(co.hoverNodeId);if(hn)[ex,ey]=nodePt(hn,co.snapSide)};h+=`<line x1="${co.x1}" y1="${co.y1}" x2="${ex}" y2="${ey}" stroke="#5a8abf" stroke-width="1.5" stroke-dasharray="5,3"/>`}
      const fd=s.fdraw as {sx:number;sy:number;ex?:number;ey?:number}|null
      if(fd?.ex!=null){const fx=Math.min(fd.sx,fd.ex!),fy=Math.min(fd.sy,fd.ey!);h+=`<rect x="${fx}" y="${fy}" width="${Math.abs(fd.ex!-fd.sx)}" height="${Math.abs(fd.ey!-fd.sy)}" rx="8" fill="rgba(30,80,180,0.07)" stroke="#5a8abf" stroke-width="1.5" stroke-dasharray="5,3"/>`}
      const rb=s.rband as {sx:number;sy:number;ex?:number;ey?:number}|null
      if(rb?.ex!=null){const bx=Math.min(rb.sx,rb.ex!),by=Math.min(rb.sy,rb.ey!);const bsw=1/s.vscale;h+=`<rect x="${bx}" y="${by}" width="${Math.abs(rb.ex!-rb.sx)}" height="${Math.abs(rb.ey!-rb.sy)}" fill="rgba(90,138,191,0.12)" stroke="#5a8abf" stroke-width="${bsw}" stroke-dasharray="${4/s.vscale},${2/s.vscale}"/>`}
      snapGuides.forEach(g=>{const sw=1/s.vscale,da=`${6/s.vscale},${3/s.vscale}`;if(g.type==='x')h+=`<line x1="${g.pos}" y1="-9999" x2="${g.pos}" y2="9999" stroke="#5a8abf" stroke-width="${sw}" stroke-dasharray="${da}" opacity="0.75" pointer-events="none"/>`;else h+=`<line x1="-9999" y1="${g.pos}" x2="9999" y2="${g.pos}" stroke="#5a8abf" stroke-width="${sw}" stroke-dasharray="${da}" opacity="0.75" pointer-events="none"/>`})
      vp.innerHTML=h;applyTransform()
    }

    // ─── PANEL ────────────────────────────────────────────────────────────
    function updatePanel(){
      if(!s.selected){
        pempty.style.display='';pinner.style.display='none'
        if(s.multi.length>1){
          const nodeCount=s.multi.filter(m=>m.type==='node').length
          let html=`${s.multi.length} 個選択中<br><small style="color:#666">Deleteで削除</small>`
          if(nodeCount>=2){html+=`<div style="display:flex;gap:6px;margin-top:12px"><button data-dist="h" style="flex:1;padding:6px 0;border:1px solid #444450;border-radius:4px;background:#38383f;color:#a0a0b8;font-size:11px;cursor:pointer">横均等</button><button data-dist="v" style="flex:1;padding:6px 0;border:1px solid #444450;border-radius:4px;background:#38383f;color:#a0a0b8;font-size:11px;cursor:pointer">縦均等</button></div>`}
          pempty.innerHTML=html
          pempty.querySelector('[data-dist="h"]')?.addEventListener('click',()=>distributeMulti('h'))
          pempty.querySelector('[data-dist="v"]')?.addEventListener('click',()=>distributeMulti('v'))
        } else pempty.innerHTML='要素を選択すると<br>プロパティが表示されます'
        return
      }
      pempty.style.display='none';pinner.style.display='flex'
      let h=''
      if(s.selected.type==='node'){
        const n=getNode(s.selected.id)!
        // Shape
        h+=`<div class="ft-ps"><div class="ft-pl">シェイプ</div><div class="ft-segrow">
          <button class="ft-seg${(n.shape||'rect')==='rect'?' active':''}" data-nshape="rect">矩形</button>
          <button class="ft-seg${n.shape==='diamond'?' active':''}" data-nshape="diamond">ひし形</button>
          <button class="ft-seg${n.shape==='ellipse'?' active':''}" data-nshape="ellipse">楕円</button>
        </div></div>`
        // Type (color)
        h+=`<div class="ft-ps"><div class="ft-pl">タイプ</div><div class="ft-swrow">`
        Object.entries(TYPES).forEach(([k,v])=>{h+=`<div class="ft-sw${n.type===k?' sel':''}" title="${k}" data-stype="${k}" style="background:${v.fill};border-color:${v.stroke}"></div>`})
        h+=`</div></div>`
        const nf=n.fill||(TYPES[n.type]||TYPES.bubble).fill,ns=n.stroke||(TYPES[n.type]||TYPES.bubble).stroke
        h+=`<div class="ft-ps"><div class="ft-pl">カラー</div><div class="ft-cprow"><button class="ft-cpbtn" id="ft-nbtnf"><div class="ft-cpdot" style="background:${nf}"></div>背景色</button><button class="ft-cpbtn" id="ft-nbtns"><div class="ft-cpdot" style="background:${ns}"></div>枠色</button></div></div>`
        h+=`<div class="ft-ps"><div class="ft-pl">線の種類</div><div class="ft-segrow"><button class="ft-seg${!n.dashed?' active':''}" data-ndash="solid">実線</button><button class="ft-seg${n.dashed?' active':''}" data-ndash="dashed">点線</button></div></div>`
        h+=`<div class="ft-ps"><div class="ft-pl">ラベル（改行区切り）</div><textarea class="ft-ta" id="ft-nlbl">${esc(n.lines.join('\n'))}</textarea></div>`
        h+=`<button class="ft-del" data-del="1">削除</button>`
      } else if(s.selected.type==='edge'){
        const e=getEdge(s.selected.id)!
        h+=`<div class="ft-ps"><div class="ft-pl">ラベル</div><input class="ft-ti" id="ft-elbl" value="${esc(e.label)}"></div>`
        h+=`<div class="ft-ps"><div class="ft-cbrow"><input type="checkbox" id="ft-edash"${e.dashed?' checked':''}><label for="ft-edash">点線</label></div></div>`
        h+=`<div class="ft-ps"><div class="ft-cbrow"><input type="checkbox" id="ft-eng"${e.ng?' checked':''}><label for="ft-eng">NGパス(赤)</label></div></div>`
        const dir=e.arrowDir??'end'
        h+=`<div class="ft-ps"><div class="ft-pl">矢印の向き</div><div class="ft-segrow"><button class="ft-seg${dir==='end'?' active':''}" data-earrow="end">→</button><button class="ft-seg${dir==='start'?' active':''}" data-earrow="start">←</button><button class="ft-seg${dir==='both'?' active':''}" data-earrow="both">↔</button><button class="ft-seg${dir==='none'?' active':''}" data-earrow="none">—</button></div></div>`
        if(e.offset!=null) h+=`<button class="ft-seg" id="ft-ereset" style="border-radius:3px">ルートをリセット</button>`
        h+=`<button class="ft-del" data-del="1">削除</button>`
      } else if(s.selected.type==='frame'){
        const f=getFrame(s.selected.id)!
        h+=`<div class="ft-ps"><div class="ft-pl">ラベル</div><input class="ft-ti" id="ft-flbl" value="${esc(f.label)}"></div>`
        const ff2=f.fillHex||'#1e50b4'
        h+=`<div class="ft-ps"><div class="ft-pl">カラー</div><div class="ft-cprow"><button class="ft-cpbtn" id="ft-fbtnf"><div class="ft-cpdot" style="background:${hexToRgba(ff2,f.fillOpacity??0.1)}"></div>背景色</button><button class="ft-cpbtn" id="ft-fbtns"><div class="ft-cpdot" style="background:${f.stroke}"></div>枠色</button><button class="ft-cpbtn" id="ft-fbtnl"><div class="ft-cpdot" style="background:${f.labelColor}"></div>文字</button></div></div>`
        h+=`<div class="ft-ps"><div class="ft-pl">線の種類</div><div class="ft-segrow"><button class="ft-seg${!f.dashed?' active':''}" data-fdash="solid">実線</button><button class="ft-seg${f.dashed?' active':''}" data-fdash="dashed">点線</button></div></div>`
        h+=`<button class="ft-del" data-del="1">削除</button>`
      } else if(s.selected.type==='lane'){
        const lane=s.lanes.find(l=>l.id===s.selected!.id)!
        h+=`<div class="ft-ps"><div class="ft-pl">レーン名</div><input class="ft-ti" id="ft-llbl" value="${esc(lane.label)}"></div>`
        h+=`<div class="ft-ps"><div class="ft-pl">高さ</div><input class="ft-ti" id="ft-lh" type="number" value="${lane.height}"></div>`
        h+=`<div class="ft-ps"><div class="ft-pl">タイプ</div><div class="ft-swrow">`
        Object.entries(TYPES).forEach(([k,v])=>{h+=`<div class="ft-sw${lane.type===k?' sel':''}" title="${k}" data-ltype="${k}" style="background:${v.fill};border-color:${v.stroke}"></div>`})
        h+=`</div></div>`
        h+=`<button class="ft-del" data-del="1">削除</button>`
      } else if(s.selected.type==='phase'){
        const phase=s.phases.find(p=>p.id===s.selected!.id)!
        h+=`<div class="ft-ps"><div class="ft-pl">フェーズ名</div><input class="ft-ti" id="ft-plbl" value="${esc(phase.label)}"></div>`
        h+=`<div class="ft-ps"><div class="ft-pl">幅</div><input class="ft-ti" id="ft-pw" type="number" value="${phase.width}"></div>`
        h+=`<div class="ft-ps"><div class="ft-pl">カラー</div><div class="ft-swrow">`
        h+=`<div class="ft-sw${!phase.type?' sel':''}" title="なし" data-ptype="" style="background:#2a2a33;border-color:#444450">⊘</div>`
        Object.entries(TYPES).forEach(([k,v])=>{h+=`<div class="ft-sw${phase.type===k?' sel':''}" title="${k}" data-ptype="${k}" style="background:${v.fill};border-color:${v.stroke}"></div>`})
        h+=`</div></div>`
        h+=`<button class="ft-del" data-del="1">削除</button>`
      }
      pinner.innerHTML=h
      const byId=(id:string)=>document.getElementById(id)
      if(s.selected.type==='node'){
        const n=getNode(s.selected.id)!
        const ta=byId('ft-nlbl') as HTMLTextAreaElement|null
        if(ta){ta.onfocus=pushHist;ta.oninput=()=>{n.lines=ta.value.split('\n');render();scheduleSave()}}
        pinner.querySelectorAll('[data-nshape]').forEach(el=>{(el as HTMLElement).onclick=()=>{pushHist();n.shape=(el as HTMLElement).dataset.nshape as NodeObj['shape'];updatePanel();render()}})
        pinner.querySelectorAll('[data-stype]').forEach(el=>{(el as HTMLElement).onclick=()=>{pushHist();n.type=(el as HTMLElement).dataset.stype!;updatePanel();render()}})
        pinner.querySelectorAll('[data-ndash]').forEach(el=>{(el as HTMLElement).onclick=()=>{pushHist();n.dashed=(el as HTMLElement).dataset.ndash==='dashed';updatePanel();render()}})
        const nbf=byId('ft-nbtnf'),nbs=byId('ft-nbtns')
        if(nbf)(nbf as HTMLElement).onclick=()=>showCp(nbf as HTMLElement,n.fill??null,n.fillOpacity??1,true,(hex,op)=>{pushHist();n.fill=hex;n.fillOpacity=op;updatePanel();render()})
        if(nbs)(nbs as HTMLElement).onclick=()=>showCp(nbs as HTMLElement,n.stroke??null,1,false,(hex)=>{pushHist();n.stroke=hex;updatePanel();render()})
      } else if(s.selected.type==='edge'){
        const e=getEdge(s.selected.id)!
        const li=byId('ft-elbl') as HTMLInputElement|null,dc=byId('ft-edash') as HTMLInputElement|null,ng=byId('ft-eng') as HTMLInputElement|null,rb2=byId('ft-ereset')
        if(li){li.onfocus=pushHist;li.oninput=()=>{e.label=li.value;render();scheduleSave()}}
        if(dc) dc.onchange=()=>{pushHist();e.dashed=dc.checked;render()}
        if(ng) ng.onchange=()=>{pushHist();e.ng=ng.checked;render()}
        if(rb2) rb2.onclick=()=>{pushHist();e.offset=null;updatePanel();render()}
        pinner.querySelectorAll('[data-earrow]').forEach(el=>{(el as HTMLElement).onclick=()=>{pushHist();e.arrowDir=(el as HTMLElement).dataset.earrow as EdgeObj['arrowDir'];updatePanel();render()}})
      } else if(s.selected.type==='frame'){
        const f=getFrame(s.selected.id)!
        const li=byId('ft-flbl') as HTMLInputElement|null
        if(li){li.onfocus=pushHist;li.oninput=()=>{f.label=li.value;render();scheduleSave()}}
        pinner.querySelectorAll('[data-fdash]').forEach(el=>{(el as HTMLElement).onclick=()=>{pushHist();f.dashed=(el as HTMLElement).dataset.fdash==='dashed';updatePanel();render()}})
        const fbf=byId('ft-fbtnf'),fbs=byId('ft-fbtns'),fbl=byId('ft-fbtnl')
        if(fbf)(fbf as HTMLElement).onclick=()=>showCp(fbf as HTMLElement,f.fillHex||'#1e50b4',f.fillOpacity??0.1,true,(hex,op)=>{pushHist();f.fillHex=hex??undefined;f.fillOpacity=op;updatePanel();render()})
        if(fbs)(fbs as HTMLElement).onclick=()=>showCp(fbs as HTMLElement,f.stroke,1,false,(hex)=>{pushHist();if(hex)f.stroke=hex;updatePanel();render()})
        if(fbl)(fbl as HTMLElement).onclick=()=>showCp(fbl as HTMLElement,f.labelColor,1,false,(hex)=>{pushHist();if(hex)f.labelColor=hex;updatePanel();render()})
      } else if(s.selected.type==='lane'){
        const lane=s.lanes.find(l=>l.id===s.selected!.id)!
        const li=byId('ft-llbl') as HTMLInputElement|null, lh=byId('ft-lh') as HTMLInputElement|null
        if(li){li.onfocus=pushHist;li.oninput=()=>{lane.label=li.value;render();scheduleSave()}}
        if(lh){lh.onfocus=pushHist;lh.oninput=()=>{lane.height=Math.max(40,Number(lh.value)||100);render();scheduleSave()}}
        pinner.querySelectorAll('[data-ltype]').forEach(el=>{(el as HTMLElement).onclick=()=>{pushHist();lane.type=(el as HTMLElement).dataset.ltype!;updatePanel();render()}})
      } else if(s.selected.type==='phase'){
        const phase=s.phases.find(p=>p.id===s.selected!.id)!
        const li=byId('ft-plbl') as HTMLInputElement|null, pw2=byId('ft-pw') as HTMLInputElement|null
        if(li){li.onfocus=pushHist;li.oninput=()=>{phase.label=li.value;render();scheduleSave()}}
        if(pw2){pw2.onfocus=pushHist;pw2.oninput=()=>{phase.width=Math.max(60,Number(pw2.value)||200);render();scheduleSave()}}
        pinner.querySelectorAll('[data-ptype]').forEach(el=>{(el as HTMLElement).onclick=()=>{pushHist();const v=(el as HTMLElement).dataset.ptype!;phase.type=v||undefined;updatePanel();render()}})
      }
      pinner.querySelector('[data-del]')?.addEventListener('click',deleteSelected)
    }

    function select(type:'node'|'edge'|'frame'|'lane'|'phase',id:string|null){s.selected=id?{type,id}:null;if(id)s.multi=[];updatePanel();render()}

    function deleteSelected(){
      if(!s.selected&&!s.multi.length) return;pushHist()
      if(s.multi.length>0){
        const nids=new Set(s.multi.filter(m=>m.type==='node').map(m=>m.id)),fids=new Set(s.multi.filter(m=>m.type==='frame').map(m=>m.id))
        s.frames.filter(f=>fids.has(f.id)).forEach(df=>{s.nodes.filter(n=>n.x>=df.x&&n.y>=df.y&&n.x+n.w<=df.x+df.w&&n.y+n.h<=df.y+df.h).forEach(n=>nids.add(n.id));s.frames.filter(f=>!fids.has(f.id)&&f.x>=df.x&&f.y>=df.y&&f.x+f.w<=df.x+df.w&&f.y+f.h<=df.y+df.h).forEach(f=>fids.add(f.id))})
        s.nodes=s.nodes.filter(n=>!nids.has(n.id));s.edges=s.edges.filter(e=>!nids.has(e.from)&&!nids.has(e.to));s.frames=s.frames.filter(f=>!fids.has(f.id));s.multi=[]
      } else if(s.selected){
        const {type,id}=s.selected
        if(type==='node'){s.nodes=s.nodes.filter(n=>n.id!==id);s.edges=s.edges.filter(e=>e.from!==id&&e.to!==id)}
        else if(type==='edge') s.edges=s.edges.filter(e=>e.id!==id)
        else if(type==='lane') s.lanes=s.lanes.filter(l=>l.id!==id)
        else if(type==='phase') s.phases=s.phases.filter(p=>p.id!==id)
        else{
          const delF=getFrame(id);if(delF){
            const inside=(item:{x:number;y:number;w:number;h:number})=>item.x>=delF.x&&item.y>=delF.y&&item.x+item.w<=delF.x+delF.w&&item.y+item.h<=delF.y+delF.h
            const delNids=new Set(s.nodes.filter(inside).map(n=>n.id));s.nodes=s.nodes.filter(n=>!delNids.has(n.id));s.edges=s.edges.filter(e=>!delNids.has(e.from)&&!delNids.has(e.to));s.frames=s.frames.filter(f=>f.id!==id&&!inside(f))
          } else s.frames=s.frames.filter(f=>f.id!==id)
        }
      }
      s.selected=null;updatePanel();render()
    }

    function distributeMulti(axis:'h'|'v'){
      const items:NodeObj[]=[];s.multi.forEach(m=>{if(m.type==='node'){const n=getNode(m.id);if(n)items.push(n)}});if(items.length<2)return;pushHist()
      if(axis==='h'){items.sort((a,b)=>a.y-b.y);const centerX=items[0].x+items[0].w/2;items.forEach(i=>{i.x=Math.round(centerX-i.w/2)})}
      else{items.sort((a,b)=>a.y-b.y);const startY=items[0].y;const GAP=20;let cy=startY;items.forEach(i=>{i.y=Math.round(cy);cy+=i.h+GAP})}
      render();scheduleSave()
    }

    function copySelected(){if(!s.selected)return;const {type,id}=s.selected;const item=type==='node'?getNode(id):type==='frame'?getFrame(id):null;if(item)s.clip={type,data:JSON.parse(JSON.stringify(item))}}
    function pasteClipboard(){
      if(!s.clip)return;pushHist()
      const cl=s.clip as {type:string;data:NodeObj&FrameObj}
      if(cl.type==='node'){const nn={...cl.data,id:genId('n'),x:cl.data.x+24,y:cl.data.y+24,lines:[...cl.data.lines]};s.nodes.push(nn);select('node',nn.id)}
      else if(cl.type==='frame'){const nf={...cl.data,id:genId('f'),x:cl.data.x+24,y:cl.data.y+24};s.frames.push(nf);select('frame',nf.id)}
      render()
    }
    function exportJSON(){
      const currentFs:FlowState = {nodes:s.nodes,edges:s.edges,frames:s.frames,lanes:s.lanes,phases:s.phases,nextId:s.nextId}
      const keys=Object.keys(unifiedData.diagrams)
      const isSingleDefault = keys.length<=1 && (keys[0]==='default'||keys.length===0) && !unifiedData.title && !unifiedData.colorLegend
      let data:unknown
      if(isSingleDefault){ data=currentFs }else{ data={...unifiedData,diagrams:{...unifiedData.diagrams,[activeDiagram]:currentFs},activeDiagram} }
      const b=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='flow.json';a.click()
    }

    function setTool(t:string){s.tool=t;s.conn=null;s.fdraw=null;btnSel.classList.toggle('active',t==='select');btnNd.classList.toggle('active',t==='node');btnDm.classList.toggle('active',t==='diamond');btnEl.classList.toggle('active',t==='ellipse');btnFr.classList.toggle('active',t==='frame');wrap.style.cursor=t==='select'?'default':'crosshair';render()}

    function addLane(){pushHist();const lastY=s.lanes.length?Math.max(...s.lanes.map(l=>l.y+l.height)):30;s.lanes.push({id:genId('lane'),label:'新しいレーン',y:lastY+10,height:200,type:'bubble'});select('lane',s.lanes[s.lanes.length-1].id);render()}
    function addPhase(){pushHist();const lastX=s.phases.length?Math.max(...s.phases.map(p=>p.x+p.width)):0;s.phases.push({id:genId('phase'),label:'新しいフェーズ',x:lastX+10,width:400});select('phase',s.phases[s.phases.length-1].id);render()}

    // ─── CTX MENU ─────────────────────────────────────────────────────────
    const showCtx2=(e:MouseEvent)=>{ctx.style.left=e.clientX+'px';ctx.style.top=e.clientY+'px';ctx.style.display='block'}
    const hideCtx=()=>ctx.style.display='none'
    function ctxDup(){hideCtx();if(!s.selected)return;pushHist();if(s.selected.type==='node'){const n=getNode(s.selected.id)!;const nn={...n,id:genId('n'),x:n.x+20,y:n.y+20,lines:[...n.lines]};s.nodes.push(nn);select('node',nn.id)}else if(s.selected.type==='frame'){const f=getFrame(s.selected.id)!;const nf={...f,id:genId('f'),x:f.x+20,y:f.y+20};s.frames.push(nf);select('frame',nf.id)};render()}
    function ctxDel(){hideCtx();deleteSelected()}
    ctx.querySelector('[data-ctx="dup"]')?.addEventListener('click',ctxDup)
    ctx.querySelector('[data-ctx="del"]')?.addEventListener('click',ctxDel)
    const inFrame=(item:{x:number;y:number;w:number;h:number},fr:FrameObj)=>item.x>=fr.x&&item.y>=fr.y&&item.x+item.w<=fr.x+fr.w&&item.y+item.h<=fr.y+fr.h

    // ─── EVENTS ───────────────────────────────────────────────────────────
    function onWheel(e:WheelEvent){e.preventDefault();if(e.ctrlKey){const f=e.deltaY<0?1.12:0.88,r=wrap.getBoundingClientRect(),mx=e.clientX-r.left,my=e.clientY-r.top;s.vx=mx-(mx-s.vx)*f;s.vy=my-(my-s.vy)*f;s.vscale*=f}else{s.vx-=e.deltaX;s.vy-=e.deltaY};applyTransform()}

    function onDbl(e:MouseEvent){
      const eh=(e.target as HTMLElement).closest('.edge-handle');if(eh){const de=getEdge((eh as HTMLElement).dataset.edge!);if(de){pushHist();de.offset=null;render();return}}
      const pd2=(e.target as HTMLElement).closest('.port-dot'),ne=pd2||(e.target as HTMLElement).closest('.node-el')
      if(ne){
        const id=pd2?(pd2 as HTMLElement).dataset.node!:(ne as HTMLElement).dataset.id!;const n=getNode(id);if(!n)return;select('node',id)
        const r=wrap.getBoundingClientRect(),sx=n.x*s.vscale+s.vx+r.left,sy=n.y*s.vscale+s.vy+r.top,sw=n.w*s.vscale,sh=n.h*s.vscale
        const ta=document.createElement('textarea');ta.value=n.lines.join('\n')
        Object.assign(ta.style,{position:'fixed',left:sx+'px',top:sy+'px',width:sw+'px',height:sh+'px',background:'rgba(0,0,0,0.85)',color:'#a0e8b8',border:'2px solid #5a8abf',borderRadius:(8*s.vscale)+'px',padding:'4px 6px',fontSize:(11*s.vscale)+'px',fontFamily:"'Hiragino Sans',sans-serif",textAlign:'center',resize:'none',outline:'none',zIndex:'9999',boxSizing:'border-box',lineHeight:'1.4'})
        document.body.appendChild(ta);ta.focus();ta.select()
        const commit=()=>{if(!ta.parentNode)return;pushHist();n.lines=ta.value.split('\n');ta.remove();render();updatePanel();scheduleSave()}
        ta.addEventListener('keydown',ke=>{if(ke.key==='Enter'&&!ke.shiftKey){ke.preventDefault();commit()};if(ke.key==='Escape'){ta.remove();render()}})
        ta.addEventListener('blur',commit)
      }
    }

    function onDown(e:MouseEvent){
      if(e.button!==0)return;hideCtx()
      const rh=(e.target as HTMLElement).closest('.ft-rh')
      if(rh){e.stopPropagation();const id=(rh as HTMLElement).dataset.id!,type=(rh as HTMLElement).dataset.type as 'node'|'frame',edge=(rh as HTMLElement).dataset.edge!;const item=type==='node'?getNode(id):getFrame(id);if(item){pushHist();s.drag={mode:'resize',type,id,edge,origX:item.x,origY:item.y,origW:item.w,origH:item.h,sx:e.clientX,sy:e.clientY}};return}
      const pd=(e.target as HTMLElement).closest('.port-dot')
      if(pd&&s.tool==='select'&&e.detail<2){const nid=(pd as HTMLElement).dataset.node!,side=(pd as HTMLElement).dataset.side!;const n=getNode(nid);if(n){const [px,py]=nodePt(n,side);s.conn={fromId:nid,fromSide:side,x1:px,y1:py}};return}
      if(s.tool==='frame'){const [sx,sy]=svgPt(e.clientX,e.clientY);s.fdraw={sx,sy};return}
      // Lane/Phase resize handles
      // Lane top resize
      const lrht=(e.target as HTMLElement).closest('.lane-resize-top')
      if(lrht&&s.tool==='select'){
        const lid=(lrht as HTMLElement).dataset.id!;const lane=s.lanes.find(l=>l.id===lid)
        if(lane){select('lane',lid);pushHist()
          const topEdge=lane.y
          const followerLanes=s.lanes.filter(l=>l.id!==lid&&l.y+l.height<=topEdge+5).map(l=>({id:l.id,origY:l.y}))
          const followerNodeIds=new Set<string>(); const followerFrameIds=new Set<string>()
          followerLanes.forEach(fl=>{const ol=s.lanes.find(l=>l.id===fl.id)!;const ly=ol.y,lb=ol.y+ol.height
            s.nodes.forEach(n=>{if(n.y>=ly-5&&n.y+n.h<=lb+5)followerNodeIds.add(n.id)})
            s.frames.forEach(f=>{if(f.y>=ly-5&&f.y+f.h<=lb+5)followerFrameIds.add(f.id)})
          })
          // Also collect nodes inside THIS lane (they move with the top edge)
          const selfNodeIds=new Set<string>(); const selfFrameIds=new Set<string>()
          const ly=lane.y,lb=lane.y+lane.height
          s.nodes.forEach(n=>{if(n.y>=ly-5&&n.y+n.h<=lb+5)selfNodeIds.add(n.id)})
          s.frames.forEach(f=>{if(f.y>=ly-5&&f.y+f.h<=lb+5)selfFrameIds.add(f.id)})
          const fNodes=[...s.nodes.filter(n=>followerNodeIds.has(n.id)).map(n=>({id:n.id,origY:n.y})),...s.nodes.filter(n=>selfNodeIds.has(n.id)).map(n=>({id:n.id,origY:n.y}))]
          const fFrames=[...s.frames.filter(f=>followerFrameIds.has(f.id)).map(f=>({id:f.id,origY:f.y})),...s.frames.filter(f=>selfFrameIds.has(f.id)).map(f=>({id:f.id,origY:f.y}))]
          s.drag={mode:'resize-lane-top',id:lid,origY:lane.y,origH:lane.height,sy:e.clientY,followers:followerLanes,followerNodes:fNodes,followerFrames:fFrames}
        };return}
      // Lane bottom resize
      const lrh=(e.target as HTMLElement).closest('.lane-resize')
      if(lrh&&s.tool==='select'){
        const lid=(lrh as HTMLElement).dataset.id!;const lane=s.lanes.find(l=>l.id===lid)
        if(lane){select('lane',lid);pushHist()
          const bottomEdge=lane.y+lane.height
          const followerLanes=s.lanes.filter(l=>l.id!==lid&&l.y>=bottomEdge-5).map(l=>({id:l.id,origY:l.y}))
          const followerNodeIds=new Set<string>(); const followerFrameIds=new Set<string>()
          followerLanes.forEach(fl=>{const ol=s.lanes.find(l=>l.id===fl.id)!;const ly=ol.y,lb=ol.y+ol.height
            s.nodes.forEach(n=>{if(n.y>=ly-5&&n.y+n.h<=lb+5)followerNodeIds.add(n.id)})
            s.frames.forEach(f=>{if(f.y>=ly-5&&f.y+f.h<=lb+5)followerFrameIds.add(f.id)})
          })
          const fNodes=s.nodes.filter(n=>followerNodeIds.has(n.id)).map(n=>({id:n.id,origY:n.y}))
          const fFrames=s.frames.filter(f=>followerFrameIds.has(f.id)).map(f=>({id:f.id,origY:f.y}))
          s.drag={mode:'resize-lane',id:lid,origH:lane.height,sy:e.clientY,followers:followerLanes,followerNodes:fNodes,followerFrames:fFrames}
        };return}
      // Phase left resize
      const prhl=(e.target as HTMLElement).closest('.phase-resize-left')
      if(prhl&&s.tool==='select'){
        const pid=(prhl as HTMLElement).dataset.id!;const phase=s.phases.find(p=>p.id===pid)
        if(phase){select('phase',pid);pushHist()
          const leftEdge=phase.x
          const followerPhases=s.phases.filter(p=>p.id!==pid&&p.x+p.width<=leftEdge+5).map(p=>({id:p.id,origX:p.x}))
          const followerNodeIds=new Set<string>(); const followerFrameIds=new Set<string>()
          followerPhases.forEach(fp=>{const op=s.phases.find(p=>p.id===fp.id)!;const px=op.x,pr=op.x+op.width
            s.nodes.forEach(n=>{if(n.x>=px-5&&n.x+n.w<=pr+5)followerNodeIds.add(n.id)})
            s.frames.forEach(f=>{if(f.x>=px-5&&f.x+f.w<=pr+5)followerFrameIds.add(f.id)})
          })
          // Also collect nodes inside THIS phase
          const selfNodeIds=new Set<string>(); const selfFrameIds=new Set<string>()
          const px=phase.x,pr=phase.x+phase.width
          s.nodes.forEach(n=>{if(n.x>=px-5&&n.x+n.w<=pr+5)selfNodeIds.add(n.id)})
          s.frames.forEach(f=>{if(f.x>=px-5&&f.x+f.w<=pr+5)selfFrameIds.add(f.id)})
          const fNodes=[...s.nodes.filter(n=>followerNodeIds.has(n.id)).map(n=>({id:n.id,origX:n.x})),...s.nodes.filter(n=>selfNodeIds.has(n.id)).map(n=>({id:n.id,origX:n.x}))]
          const fFrames=[...s.frames.filter(f=>followerFrameIds.has(f.id)).map(f=>({id:f.id,origX:f.x})),...s.frames.filter(f=>selfFrameIds.has(f.id)).map(f=>({id:f.id,origX:f.x}))]
          s.drag={mode:'resize-phase-left',id:pid,origX:phase.x,origW:phase.width,sx:e.clientX,followers:followerPhases,followerNodes:fNodes,followerFrames:fFrames}
        };return}
      // Phase right resize
      const prh=(e.target as HTMLElement).closest('.phase-resize')
      if(prh&&s.tool==='select'){
        const pid=(prh as HTMLElement).dataset.id!;const phase=s.phases.find(p=>p.id===pid)
        if(phase){select('phase',pid);pushHist()
          const rightEdge=phase.x+phase.width
          const followerPhases=s.phases.filter(p=>p.id!==pid&&p.x>=rightEdge-5).map(p=>({id:p.id,origX:p.x}))
          const followerNodeIds=new Set<string>(); const followerFrameIds=new Set<string>()
          followerPhases.forEach(fp=>{const op=s.phases.find(p=>p.id===fp.id)!;const px2=op.x,pr2=op.x+op.width
            s.nodes.forEach(n=>{if(n.x>=px2-5&&n.x+n.w<=pr2+5)followerNodeIds.add(n.id)})
            s.frames.forEach(f=>{if(f.x>=px2-5&&f.x+f.w<=pr2+5)followerFrameIds.add(f.id)})
          })
          const fNodes=s.nodes.filter(n=>followerNodeIds.has(n.id)).map(n=>({id:n.id,origX:n.x}))
          const fFrames=s.frames.filter(f=>followerFrameIds.has(f.id)).map(f=>({id:f.id,origX:f.x}))
          s.drag={mode:'resize-phase',id:pid,origW:phase.width,sx:e.clientX,followers:followerPhases,followerNodes:fNodes,followerFrames:fFrames}
        };return}
      // Lane click/drag
      const le=(e.target as HTMLElement).closest('.lane-el')
      if(le&&s.tool==='select'){
        const lid=(le as HTMLElement).dataset.id!;select('lane',lid)
        const lane=s.lanes.find(l=>l.id===lid)
        if(lane){pushHist();s.drag={mode:'drag-lane',id:lid,oy:lane.y,sy:e.clientY}}
        return
      }
      // Phase click/drag
      const pe=(e.target as HTMLElement).closest('.phase-el')
      if(pe&&s.tool==='select'){
        const pid=(pe as HTMLElement).dataset.id!;select('phase',pid)
        const phase=s.phases.find(p=>p.id===pid)
        if(phase){pushHist();s.drag={mode:'drag-phase',id:pid,ox:phase.x,sx:e.clientX}}
        return
      }
      const ne2=(e.target as HTMLElement).closest('.node-el')
      if(ne2&&s.tool==='select'){
        const id=(ne2 as HTMLElement).dataset.id!;let n=getNode(id)!
        const inMN=s.multi.length>1&&s.multi.some(m=>m.type==='node'&&m.id===id)
        if(inMN&&!e.altKey){pushHist();const no=s.multi.filter(m=>m.type==='node').map(m=>{const mn=getNode(m.id)!;return{id:m.id,ox:mn.x,oy:mn.y}});const fo=s.multi.filter(m=>m.type==='frame').map(m=>{const mf=getFrame(m.id)!;return{id:m.id,ox:mf.x,oy:mf.y}});s.drag={mode:'drag-multi',sx:e.clientX,sy:e.clientY,nodeOffsets:no,frameOffsets:fo};return}
        if(e.altKey){pushHist();const cl={...n,id:genId('n'),lines:[...n.lines]};s.nodes.push(cl);select('node',cl.id);n=cl}
        else if(e.shiftKey||e.metaKey||e.ctrlKey){const idx=s.multi.findIndex(m=>m.type==='node'&&m.id===id);if(idx>=0)s.multi.splice(idx,1);else{if(s.selected&&!s.multi.length)s.multi.push(s.selected as MultiSel);s.multi.push({type:'node',id})};s.selected=s.multi.length===1?s.multi[0]:null;updatePanel();render();return}
        else{s.multi=[];select('node',id);pushHist()}
        s.drag={mode:'drag-node',id:n.id,ox:n.x,oy:n.y,sx:e.clientX,sy:e.clientY};return
      }
      const eh2=(e.target as HTMLElement).closest('.edge-handle')
      if(eh2&&s.tool==='select'){const eid=(eh2 as HTMLElement).dataset.edge!,axis=(eh2 as HTMLElement).dataset.axis!;const ee=getEdge(eid);if(ee){select('edge',eid);pushHist();const [emx,emy]=svgPt(e.clientX,e.clientY);const hs=getEdgeHandles(ee,s.nodes);const start=hs.length?(axis==='x'?hs[0].x:hs[0].y):(axis==='x'?emx:emy);s.drag={mode:'drag-edge-offset',edgeId:eid,axis,startPos:axis==='x'?emx:emy,startOffset:start}};return}
      const eht=(e.target as HTMLElement).closest('.edge-hit');if(eht&&s.tool==='select'){select('edge',(eht as HTMLElement).dataset.id!);return}
      const fe=(e.target as HTMLElement).closest('.frame-el')
      if(fe&&s.tool==='select'){
        const id=(fe as HTMLElement).dataset.id!;let f=getFrame(id)!
        const alreadySelected=s.selected?.type==='frame'&&s.selected.id===id
        const inMF=s.multi.length>1&&s.multi.some(m=>m.type==='frame'&&m.id===id)
        if(inMF&&!e.altKey){pushHist();const no=s.multi.filter(m=>m.type==='node').map(m=>{const mn=getNode(m.id)!;return{id:m.id,ox:mn.x,oy:mn.y}});const fo=s.multi.filter(m=>m.type==='frame').map(m=>{const mf=getFrame(m.id)!;return{id:m.id,ox:mf.x,oy:mf.y}});s.drag={mode:'drag-multi',sx:e.clientX,sy:e.clientY,nodeOffsets:no,frameOffsets:fo};return}
        if(e.shiftKey||e.metaKey||e.ctrlKey){const idx=s.multi.findIndex(m=>m.type==='frame'&&m.id===id);if(idx>=0)s.multi.splice(idx,1);else{if(s.selected&&!s.multi.length)s.multi.push(s.selected as MultiSel);s.multi.push({type:'frame',id})};s.selected=s.multi.length===1?s.multi[0]:null;updatePanel();render();return}
        if(e.altKey){s.multi=[];pushHist();const cf={...f,id:genId('f')};s.frames.push(cf);const nim:Record<string,string>={};s.nodes.filter(n=>inFrame(n,f)).forEach(n=>{const cn={...n,id:genId('n'),lines:[...n.lines]};nim[n.id]=cn.id;s.nodes.push(cn)});const csf:Array<{id:string;ox:number;oy:number}>=[];s.frames.filter(fr=>fr.id!==f.id&&fr.id!==cf.id&&inFrame(fr,f)).forEach(fr=>{const c={...fr,id:genId('f')};s.frames.push(c);csf.push({id:c.id,ox:c.x,oy:c.y})});const oids=new Set(Object.keys(nim));s.edges.filter(eg=>oids.has(eg.from)&&oids.has(eg.to)).forEach(eg=>s.edges.push({...eg,id:genId('e'),from:nim[eg.from],to:nim[eg.to]}));select('frame',cf.id);const cno=Object.values(nim).map(nid=>{const cn=getNode(nid)!;return{id:nid,ox:cn.x,oy:cn.y}});s.drag={mode:'drag-frame',id:cf.id,ox:cf.x,oy:cf.y,sx:e.clientX,sy:e.clientY,containedNodes:cno,containedFrames:csf};return}
        if(alreadySelected){pushHist();const cno=s.nodes.filter(n=>inFrame(n,f)).map(n=>({id:n.id,ox:n.x,oy:n.y}));const cfo=s.frames.filter(fr=>fr.id!==id&&inFrame(fr,f)).map(fr=>({id:fr.id,ox:fr.x,oy:fr.y}));s.drag={mode:'drag-frame',id,ox:f.x,oy:f.y,sx:e.clientX,sy:e.clientY,containedNodes:cno,containedFrames:cfo};return}
        s.multi=[];select('frame',id);const [rx,ry]=svgPt(e.clientX,e.clientY);s.rband={sx:rx,sy:ry};return
      }
      if(s.tool==='node'||s.tool==='diamond'||s.tool==='ellipse'){
        const [cx,cy]=svgPt(e.clientX,e.clientY);pushHist()
        const shape=s.tool==='diamond'?'diamond' as const:s.tool==='ellipse'?'ellipse' as const:'rect' as const
        const w=shape==='diamond'?72:shape==='ellipse'?88:120
        const h=shape==='diamond'?72:shape==='ellipse'?44:52
        const type=shape==='diamond'?'decision':shape==='ellipse'?'startend':'bubble'
        const label=shape==='diamond'?'判定?':shape==='ellipse'?'開始/終了':'新しい画面'
        const nn:NodeObj={id:genId('n'),x:cx-w/2,y:cy-h/2,w,h,type,shape,lines:[label]}
        s.nodes.push(nn);select('node',nn.id);setTool('select');return
      }
      if(s.tool==='select'){const [rx,ry]=svgPt(e.clientX,e.clientY);s.multi=[];s.selected=null;s.rband={sx:rx,sy:ry};updatePanel();render()}
    }

    function onMove(e:MouseEvent){
      type Drag={mode:string;id?:string;ox?:number;oy?:number;sx:number;sy:number;containedNodes?:{id:string;ox:number;oy:number}[];containedFrames?:{id:string;ox:number;oy:number}[];nodeOffsets?:{id:string;ox:number;oy:number}[];frameOffsets?:{id:string;ox:number;oy:number}[];type?:string;edge?:string;origX?:number;origY?:number;origW?:number;origH?:number;edgeId?:string;axis?:string;startPos?:number;startOffset?:number;followers?:({id:string;origY:number}|{id:string;origX:number})[];followerNodes?:({id:string;origX?:number;origY?:number})[];followerFrames?:({id:string;origX?:number;origY?:number})[]}
      const dr=s.drag as Drag|null
      if(dr){
        if(dr.mode==='drag-node'){const n=getNode(dr.id!);if(n){n.x=dr.ox!+(e.clientX-dr.sx)/s.vscale;n.y=dr.oy!+(e.clientY-dr.sy)/s.vscale;snapGuides=computeSnapGuides(n,new Set([n.id]))};render()}
        else if(dr.mode==='drag-frame'){const dx=(e.clientX-dr.sx)/s.vscale,dy=(e.clientY-dr.sy)/s.vscale;const f=getFrame(dr.id!);if(f){f.x=dr.ox!+dx;f.y=dr.oy!+dy};dr.containedNodes!.forEach(c=>{const n=getNode(c.id);if(n){n.x=c.ox+dx;n.y=c.oy+dy}});dr.containedFrames!.forEach(c=>{const fr=getFrame(c.id);if(fr){fr.x=c.ox+dx;fr.y=c.oy+dy}});if(f){const excl=new Set([f.id,...dr.containedNodes!.map(c=>c.id),...dr.containedFrames!.map(c=>c.id)]);snapGuides=computeSnapGuides(f,excl)};render()}
        else if(dr.mode==='drag-multi'){const dx=(e.clientX-dr.sx)/s.vscale,dy=(e.clientY-dr.sy)/s.vscale;dr.nodeOffsets!.forEach(({id,ox,oy})=>{const n=getNode(id);if(n){n.x=ox+dx;n.y=oy+dy}});dr.frameOffsets!.forEach(({id,ox,oy})=>{const f=getFrame(id);if(f){f.x=ox+dx;f.y=oy+dy}});render()}
        else if(dr.mode==='drag-edge-offset'){const ee=getEdge(dr.edgeId!);if(ee){const [emx,emy]=svgPt(e.clientX,e.clientY);const cur=dr.axis==='x'?emx:emy;ee.offset=dr.startOffset!+(cur-dr.startPos!);render()}}
        else if(dr.mode==='resize'){const dx=(e.clientX-dr.sx)/s.vscale,dy=(e.clientY-dr.sy)/s.vscale;const item=dr.type==='node'?getNode(dr.id!):getFrame(dr.id!);if(item){const minW=dr.type==='node'?40:60,minH=dr.type==='node'?20:40;const edge=dr.edge!;if(edge.includes('e'))item.w=Math.max(minW,dr.origW!+dx);if(edge.includes('s'))item.h=Math.max(minH,dr.origH!+dy);if(edge.includes('w')){const nw=Math.max(minW,dr.origW!-dx);item.x=dr.origX!+(dr.origW!-nw);item.w=nw};if(edge.includes('n')){const nh=Math.max(minH,dr.origH!-dy);item.y=dr.origY!+(dr.origH!-nh);item.h=nh}};render()}
        else if(dr.mode==='drag-lane'){const lane=s.lanes.find(l=>l.id===dr.id!);if(lane){lane.y=dr.oy!+(e.clientY-dr.sy)/s.vscale};render()}
        else if(dr.mode==='drag-phase'){const phase=s.phases.find(p=>p.id===dr.id!);if(phase){phase.x=dr.ox!+(e.clientX-dr.sx)/s.vscale};render()}
        else if(dr.mode==='resize-lane-top'){
          // Drag top edge: y moves, height adjusts inversely, above lanes + their contents shift
          const lane=s.lanes.find(l=>l.id===dr.id!)
          if(lane){const dy=(e.clientY-dr.sy)/s.vscale;const newY=dr.origY!+dy;const newH=Math.max(40,dr.origH!-dy);const delta=newY-dr.origY!;lane.y=newY;lane.height=newH
            const fl=dr.followers as {id:string;origY:number}[]|undefined
            if(fl) fl.forEach(f=>{const ol=s.lanes.find(l=>l.id===f.id);if(ol)ol.y=f.origY+delta})
            const fn2=dr.followerNodes as {id:string;origY:number}[]|undefined
            if(fn2) fn2.forEach(f=>{const n=getNode(f.id);if(n)n.y=f.origY+delta})
            const ff=dr.followerFrames as {id:string;origY:number}[]|undefined
            if(ff) ff.forEach(f=>{const fr=getFrame(f.id);if(fr)fr.y=f.origY+delta})
          };render()
        }
        else if(dr.mode==='resize-lane'){
          const lane=s.lanes.find(l=>l.id===dr.id!)
          if(lane){const newH=Math.max(40,dr.origH!+(e.clientY-dr.sy)/s.vscale);const delta=newH-dr.origH!;lane.height=newH
            const fl=dr.followers as {id:string;origY:number}[]|undefined
            if(fl) fl.forEach(f=>{const ol=s.lanes.find(l=>l.id===f.id);if(ol)ol.y=f.origY+delta})
            const fn2=dr.followerNodes as {id:string;origY:number}[]|undefined
            if(fn2) fn2.forEach(f=>{const n=getNode(f.id);if(n)n.y=f.origY+delta})
            const ff=dr.followerFrames as {id:string;origY:number}[]|undefined
            if(ff) ff.forEach(f=>{const fr=getFrame(f.id);if(fr)fr.y=f.origY+delta})
          };render()
        }
        else if(dr.mode==='resize-phase-left'){
          const phase=s.phases.find(p=>p.id===dr.id!)
          if(phase){const dx=(e.clientX-dr.sx)/s.vscale;const newX=dr.origX!+dx;const newW=Math.max(60,dr.origW!-dx);const delta=newX-dr.origX!;phase.x=newX;phase.width=newW
            const fl=dr.followers as {id:string;origX:number}[]|undefined
            if(fl) fl.forEach(f=>{const op=s.phases.find(p=>p.id===f.id);if(op)op.x=f.origX+delta})
            const fn2=dr.followerNodes as {id:string;origX:number}[]|undefined
            if(fn2) fn2.forEach(f=>{const n=getNode(f.id);if(n)n.x=f.origX+delta})
            const ff=dr.followerFrames as {id:string;origX:number}[]|undefined
            if(ff) ff.forEach(f=>{const fr=getFrame(f.id);if(fr)fr.x=f.origX+delta})
          };render()
        }
        else if(dr.mode==='resize-phase'){
          const phase=s.phases.find(p=>p.id===dr.id!)
          if(phase){const newW=Math.max(60,dr.origW!+(e.clientX-dr.sx)/s.vscale);const delta=newW-dr.origW!;phase.width=newW
            const fl=dr.followers as {id:string;origX:number}[]|undefined
            if(fl) fl.forEach(f=>{const op=s.phases.find(p=>p.id===f.id);if(op)op.x=f.origX+delta})
            const fn2=dr.followerNodes as {id:string;origX:number}[]|undefined
            if(fn2) fn2.forEach(f=>{const n=getNode(f.id);if(n)n.x=f.origX+delta})
            const ff=dr.followerFrames as {id:string;origX:number}[]|undefined
            if(ff) ff.forEach(f=>{const fr=getFrame(f.id);if(fr)fr.x=f.origX+delta})
          };render()
        }
      }
      if(s.conn){const [mx,my]=svgPt(e.clientX,e.clientY);const co=s.conn as {fromId:string;x2?:number;y2?:number;hoverNodeId?:string;snapSide?:string};co.x2=mx;co.y2=my;const hEl=document.elementFromPoint(e.clientX,e.clientY);const pdEl=(hEl as HTMLElement)?.closest('.port-dot');const hnEl=(hEl as HTMLElement)?.closest('.node-el');if(pdEl&&(pdEl as HTMLElement).dataset.node!==co.fromId){co.hoverNodeId=(pdEl as HTMLElement).dataset.node;co.snapSide=(pdEl as HTMLElement).dataset.side}else if(hnEl&&(hnEl as HTMLElement).dataset.id!==co.fromId){co.hoverNodeId=(hnEl as HTMLElement).dataset.id;co.snapSide=undefined}else{co.hoverNodeId=undefined;co.snapSide=undefined};render()}
      if(s.fdraw){const [ex,ey]=svgPt(e.clientX,e.clientY);(s.fdraw as {ex?:number;ey?:number}).ex=ex;(s.fdraw as {ey?:number}).ey=ey;render()}
      if(s.rband){const [rx,ry]=svgPt(e.clientX,e.clientY);(s.rband as {ex?:number;ey?:number}).ex=rx;(s.rband as {ey?:number}).ey=ry;render()}
    }

    function onUp(e:MouseEvent){
      if(s.drag){s.drag=null;snapGuides=[];render();scheduleSave()}
      if(s.rband){const rb=s.rband as {sx:number;sy:number;ex?:number;ey?:number};if(rb.ex!=null&&(Math.abs(rb.ex-rb.sx)>5||Math.abs(rb.ey!-rb.sy)>5)){const rx1=Math.min(rb.sx,rb.ex!),ry1=Math.min(rb.sy,rb.ey!),rx2=Math.max(rb.sx,rb.ex!),ry2=Math.max(rb.sy,rb.ey!);s.multi=[];s.nodes.forEach(n=>{if(n.x>=rx1&&n.y>=ry1&&n.x+n.w<=rx2&&n.y+n.h<=ry2)s.multi.push({type:'node',id:n.id})});s.frames.forEach(f=>{if(f.x>=rx1&&f.y>=ry1&&f.x+f.w<=rx2&&f.y+f.h<=ry2)s.multi.push({type:'frame',id:f.id})});if(s.multi.length===1){s.selected=s.multi[0];updatePanel()}else{s.selected=null;updatePanel()}};s.rband=null;render();return}
      if(s.conn){
        const co=s.conn as {fromId:string;fromSide:string;x2?:number;y2?:number;snapSide?:string}
        if(co.x2==null){const fn2=getNode(co.fromId);if(fn2){const GAP=80;const opp=({r:'l',l:'r',t:'b',b:'t'} as Record<string,string>)[co.fromSide];let nx=fn2.x,ny=fn2.y;if(co.fromSide==='r')nx=fn2.x+fn2.w+GAP;else if(co.fromSide==='l')nx=fn2.x-fn2.w-GAP;else if(co.fromSide==='b')ny=fn2.y+fn2.h+GAP;else ny=fn2.y-fn2.h-GAP;pushHist();const nn:NodeObj={id:genId('n'),x:nx,y:ny,w:fn2.w,h:fn2.h,type:fn2.type,shape:fn2.shape,lines:['新しい画面'],fill:fn2.fill||null,fillOpacity:fn2.fillOpacity,stroke:fn2.stroke||null};s.nodes.push(nn);s.edges.push({id:genId('e'),from:co.fromId,fromSide:co.fromSide,to:nn.id,toSide:opp,label:'',dashed:false});select('node',nn.id)};s.conn=null;render();return}
        if(co.x2!=null){const el=document.elementFromPoint(e.clientX,e.clientY);const port=(el as HTMLElement)?.closest('.port-dot');if(port&&(port as HTMLElement).dataset.node!==co.fromId){pushHist();s.edges.push({id:genId('e'),from:co.fromId,fromSide:co.fromSide,to:(port as HTMLElement).dataset.node!,toSide:(port as HTMLElement).dataset.side!,label:'',dashed:false});select('edge',s.edges[s.edges.length-1].id)}else if(!port){const hn=(el as HTMLElement)?.closest('.node-el');if(hn&&(hn as HTMLElement).dataset.id!==co.fromId){const toId=(hn as HTMLElement).dataset.id!;let toSide=co.snapSide;if(!toSide){const tn=getNode(toId)!,[cx,cy]=svgPt(e.clientX,e.clientY);const dx=cx-(tn.x+tn.w/2),dy=cy-(tn.y+tn.h/2);toSide=Math.abs(dx)>Math.abs(dy)?(dx>0?'r':'l'):(dy>0?'b':'t')};pushHist();s.edges.push({id:genId('e'),from:co.fromId,fromSide:co.fromSide,to:toId,toSide,label:'',dashed:false});select('edge',s.edges[s.edges.length-1].id)}else if(!hn&&!(el as HTMLElement)?.closest('.frame-el')){const fn2=getNode(co.fromId)!,[cx,cy]=svgPt(e.clientX,e.clientY);const opp=({r:'l',l:'r',t:'b',b:'t'} as Record<string,string>)[co.fromSide];let nx=0,ny=0;if(co.fromSide==='r'){nx=cx;ny=cy-fn2.h/2}else if(co.fromSide==='l'){nx=cx-fn2.w;ny=cy-fn2.h/2}else if(co.fromSide==='t'){nx=cx-fn2.w/2;ny=cy-fn2.h}else{nx=cx-fn2.w/2;ny=cy};pushHist();const nn:NodeObj={id:genId('n'),x:nx,y:ny,w:fn2.w,h:fn2.h,type:fn2.type,shape:fn2.shape,lines:['新しい画面'],fill:fn2.fill||null,fillOpacity:fn2.fillOpacity,stroke:fn2.stroke||null};s.nodes.push(nn);s.edges.push({id:genId('e'),from:co.fromId,fromSide:co.fromSide,to:nn.id,toSide:opp,label:'',dashed:false});select('node',nn.id)}}};s.conn=null;render()
      }
      if(s.fdraw){const fd=s.fdraw as {sx:number;sy:number;ex?:number;ey?:number};if(fd.ex!=null){const fx=Math.min(fd.sx,fd.ex!),fy=Math.min(fd.sy,fd.ey!),fw=Math.abs(fd.ex!-fd.sx),fh=Math.abs(fd.ey!-fd.sy);if(fw>20&&fh>20){pushHist();const nf:FrameObj={id:genId('f'),x:fx,y:fy,w:fw,h:fh,label:'新しいフレーム',fillHex:'#1e50b4',fillOpacity:0.07,stroke:'#2a3a5a',labelColor:'#4a6a9a',dashed:false};s.frames.push(nf);select('frame',nf.id)}};s.fdraw=null;setTool('select');render()}
    }

    function onCtx(e:MouseEvent){e.preventDefault();const tgt=(e.target as HTMLElement).closest('[data-id]');if(tgt){const id=(tgt as HTMLElement).dataset.id!;if((tgt as HTMLElement).classList.contains('node-el')||(tgt as HTMLElement).closest('.node-el')){select('node',id);showCtx2(e)}else if((tgt as HTMLElement).classList.contains('frame-el')||(tgt as HTMLElement).closest('.frame-el')){select('frame',id);showCtx2(e)}}}
    function onKey(e:KeyboardEvent){
      const inInput=['INPUT','TEXTAREA'].includes((e.target as HTMLElement)?.tagName||'')
      if((e.metaKey||e.ctrlKey)&&e.key==='z'){if(inInput)return;e.preventDefault();undo();return}
      if((e.metaKey||e.ctrlKey)&&e.key==='c'){if(inInput)return;e.preventDefault();copySelected();return}
      if((e.metaKey||e.ctrlKey)&&e.key==='v'){if(inInput)return;e.preventDefault();pasteClipboard();return}
      if(inInput)return
      if(e.key==='Delete'||e.key==='Backspace')deleteSelected()
      if(e.key==='Escape'){s.conn=null;s.fdraw=null;s.rband=null;s.multi=[];select('node',null);setTool('select');render()}
      if(e.key==='ArrowUp'||e.key==='ArrowDown'||e.key==='ArrowLeft'||e.key==='ArrowRight'){
        const d=e.shiftKey?10:1,dx=e.key==='ArrowLeft'?-d:e.key==='ArrowRight'?d:0,dy=e.key==='ArrowUp'?-d:e.key==='ArrowDown'?d:0
        const moveNode=(id:string)=>{const n=getNode(id);if(n){n.x+=dx;n.y+=dy}}
        const moveFrame=(id:string)=>{const f=getFrame(id);if(f){s.nodes.filter(n=>inFrame(n,f)).forEach(n=>{n.x+=dx;n.y+=dy});s.frames.filter(fr=>fr.id!==id&&inFrame(fr,f)).forEach(fr=>{fr.x+=dx;fr.y+=dy});f.x+=dx;f.y+=dy}}
        let moved=false
        if(s.multi.length>0){
          pushHist();s.multi.forEach(m=>{if(m.type==='node')moveNode(m.id);else if(m.type==='frame')moveFrame(m.id)});moved=true
        }else if(s.selected){
          const{type,id}=s.selected
          if(type==='node'){pushHist();moveNode(id);moved=true}
          else if(type==='frame'){pushHist();moveFrame(id);moved=true}
          else if(type==='lane'){const l=s.lanes.find(l=>l.id===id);if(l){pushHist();l.y+=dy;moved=true}}
          else if(type==='phase'){const p=s.phases.find(p=>p.id===id);if(p){pushHist();p.x+=dx;moved=true}}
        }
        if(moved){e.preventDefault();render()}
      }
    }
    function onDocClick(e:MouseEvent){if(!(e.target as HTMLElement).closest('#ft-cp')&&!(e.target as HTMLElement).closest('.ft-cpbtn'))cpEl.style.display='none';if(!(e.target as HTMLElement).closest('#ft-ctx'))hideCtx()}

    // ─── INIT ─────────────────────────────────────────────────────────────
    render();fitView()
    fns.current.setTool=setTool;fns.current.fitView=fitView;fns.current.exportJSON=exportJSON;fns.current.addLane=addLane;fns.current.addPhase=addPhase

    wrap.addEventListener('wheel',onWheel,{passive:false});wrap.addEventListener('mousedown',onDown);wrap.addEventListener('contextmenu',onCtx);wrap.addEventListener('dblclick',onDbl)
    window.addEventListener('mousemove',onMove);window.addEventListener('mouseup',onUp);document.addEventListener('keydown',onKey);document.addEventListener('click',onDocClick,true)
    return ()=>{if(saveTimer)clearTimeout(saveTimer);wrap.removeEventListener('wheel',onWheel);wrap.removeEventListener('mousedown',onDown);wrap.removeEventListener('contextmenu',onCtx);wrap.removeEventListener('dblclick',onDbl);window.removeEventListener('mousemove',onMove);window.removeEventListener('mouseup',onUp);document.removeEventListener('keydown',onKey);document.removeEventListener('click',onDocClick,true)}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[])

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',overflow:'hidden',background:'#212124',fontFamily:"'Hiragino Sans','Segoe UI',-apple-system,sans-serif",fontSize:13,color:'#c0c0cc'}}>
      <style dangerouslySetInnerHTML={{__html:CSS}}/>
      <div id="ft-tb">
        <h1>フロー図エディタ</h1>
        <div className="ft-sep"/>
        <button ref={btnSelRef} className="ft-btn active" onClick={()=>fns.current.setTool('select')}>選択</button>
        <button ref={btnNdRef} className="ft-btn" onClick={()=>fns.current.setTool('node')}>矩形</button>
        <button ref={btnDmRef} className="ft-btn" onClick={()=>fns.current.setTool('diamond')}>ひし形</button>
        <button ref={btnElRef} className="ft-btn" onClick={()=>fns.current.setTool('ellipse')}>楕円</button>
        <button ref={btnFrRef} className="ft-btn" onClick={()=>fns.current.setTool('frame')}>フレーム</button>
        <div className="ft-sep"/>
        <button className="ft-btn" onClick={()=>fns.current.addLane()}>レーン追加</button>
        <button className="ft-btn" onClick={()=>fns.current.addPhase()}>フェーズ追加</button>
        <div className="ft-sep"/>
        <button className="ft-btn" onClick={()=>fns.current.fitView()}>全体表示</button>
        <button className="ft-btn" onClick={()=>fns.current.exportJSON()}>エクスポート</button>
        {saveStatus==='saving'&&<span style={{fontSize:10,color:'#888898',marginLeft:4}}>保存中...</span>}
        {saveStatus==='saved'&&<span style={{fontSize:10,color:'#34a853',marginLeft:4}}>保存済み</span>}
        <span ref={hintRef} id="ft-hint">Ctrl+ホイールでズーム / ドラッグでパン / Delで削除</span>
      </div>
      <div style={{display:'flex',flex:1,overflow:'hidden'}}>
        <div ref={wrapRef} style={{flex:1,overflow:'hidden',background:'#1a1a1f',position:'relative',cursor:'default'}}>
          <svg style={{width:'100%',height:'100%'}}>
            <defs>
              <marker id="ft-arr" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#7a8a9a"/></marker>
              <marker id="ft-arr-sel" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#5a8abf"/></marker>
              <marker id="ft-arr-ng" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#c05050"/></marker>
              <marker id="ft-arr-rev" markerWidth="8" markerHeight="6" refX="1" refY="3" orient="auto"><polygon points="8 0,0 3,8 6" fill="#7a8a9a"/></marker>
              <marker id="ft-arr-rev-sel" markerWidth="8" markerHeight="6" refX="1" refY="3" orient="auto"><polygon points="8 0,0 3,8 6" fill="#5a8abf"/></marker>
            </defs>
            <g ref={vpRef}/>
          </svg>
        </div>
        <div id="ft-panel">
          <div ref={pemptyRef} id="ft-panel-empty">要素を選択すると<br/>プロパティが表示されます</div>
          <div ref={pinnerRef} id="ft-panel-inner" style={{display:'none'}}/>
        </div>
      </div>
      <div ref={cpRef} id="ft-cp"><div ref={cpGridRef} id="ft-cp-grid"/><div ref={cpOpRowRef} id="ft-cp-oprow"><span id="ft-cp-oplbl">不透明度</span><input type="range" ref={cpOpRef} id="ft-cp-op" min="0" max="100" defaultValue="100"/><span ref={cpOpValRef} id="ft-cp-opval">100%</span></div></div>
      <div ref={ctxRef} id="ft-ctx"><div data-ctx="dup">複製</div><div data-ctx="del">削除</div></div>
    </div>
  )
}

// ─── MAIN COMPONENT ──────────────────────────────────────────────────────────
export default function FlowViewer({ rootHandle, filePath }: { rootHandle: FileSystemDirectoryHandle; filePath: string }) {
  const [mode, setMode] = useState<'loading'|'flow'|'json'|'error'>('loading')
  const [flowData, setFlowData] = useState<FlowState|null>(null)
  const [unifiedData, setUnifiedData] = useState<UnifiedFlowJson|null>(null)
  const [activeDiagram, setActiveDiagram] = useState('')
  const [error, setError] = useState<string|null>(null)

  useEffect(() => {
    setMode('loading');setFlowData(null);setUnifiedData(null);setError(null)
    readTextFile(rootHandle, filePath).then(text => {
      try {
        const d = JSON.parse(text)
        let unified: UnifiedFlowJson|null = null
        if (isUnifiedFlow(d)) {
          unified = d
        } else if (isScreenTransition(d) && d.nodes.length > 0) {
          unified = wrapScreenFlow(d)
        }
        if (unified) {
          setUnifiedData(unified)
          const keys = Object.keys(unified.diagrams)
          const active = unified.activeDiagram && keys.includes(unified.activeDiagram) ? unified.activeDiagram : keys[0]||''
          setActiveDiagram(active)
          setFlowData(unified.diagrams[active]||emptyFlowState())
          setMode('flow')
        } else setMode('json')
      } catch { setMode('json') }
    }).catch(e => {setError(e.message);setMode('error')})
  }, [rootHandle, filePath])

  if (mode==='error') return <div style={{padding:20,color:'#f48771'}}>{error}</div>
  if (mode==='loading') return <div style={{padding:20,color:'#888'}}>読み込み中...</div>
  if (mode==='json') return <JsonViewer rootHandle={rootHandle} filePath={filePath}/>
  if (mode==='flow' && flowData && unifiedData) {
    const keys = Object.keys(unifiedData.diagrams)
    return (
      <div style={{display:'flex',flexDirection:'column',height:'100%'}}>
        {keys.length > 1 && (
          <div style={{display:'flex',gap:0,borderBottom:'1px solid #38383f',background:'#2a2a2f',flexShrink:0}}>
            {keys.map(name => (
              <button key={name} onClick={() => {setActiveDiagram(name);setFlowData(unifiedData.diagrams[name]||emptyFlowState())}} style={{
                padding:'8px 18px',fontSize:12,fontWeight:activeDiagram===name?700:400,cursor:'pointer',
                background:activeDiagram===name?'#1a1a1f':'transparent',color:activeDiagram===name?'#d0d0d8':'#888898',
                border:'none',borderBottom:activeDiagram===name?'2px solid #5a8abf':'2px solid transparent',
              }}>{name}</button>
            ))}
          </div>
        )}
        <FlowEditor key={activeDiagram||filePath} rootHandle={rootHandle} filePath={filePath} initData={flowData} unifiedData={unifiedData} activeDiagram={activeDiagram}/>
      </div>
    )
  }
  return null
}
