'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { readTextFile } from '@/lib/fs'

// ── Types ──────────────────────────────────────────────────────────
type CsvField = { field_name:string; display_name:string; required:string; ix:string; dtype:string; list:string; ref_target:string; notes:string }
type FieldDef = { d:string; t:string; r?:string; l?:boolean }
type TableDef = { fields:FieldDef[] }
type EdgeDef  = { f:string; t:string }
type PosMap   = Record<string, { x:number; y:number }>
type OsRow    = { display:string; [k:string]:string }

// ── Constants ──────────────────────────────────────────────────────
const BOX_W = 260, ROW_H = 26, HDR_H = 30
const GAP_X = 40, GAP_Y = 40
const COL_MAX_H = 1600

const TYPE_COLORS: Record<string,string> = {
  text:'#5a90c0', number:'#5a9060', date:'#a07040',
  boolean:'#8060a0', image:'#a06080', ref:'#50a0a0', option:'#a09050',
}

// ── CSV Parser ─────────────────────────────────────────────────────
function parseCsv(text:string):string[][] {
  const rows:string[][]=[];let row:string[]=[],cell='',q=false
  for(let i=0;i<text.length;i++){
    const c=text[i]
    if(q){if(c==='"'&&text[i+1]==='"'){cell+='"';i++}else if(c==='"')q=false;else cell+=c}
    else{if(c==='"')q=true;else if(c===','){row.push(cell);cell=''}else if(c==='\n'||(c==='\r'&&text[i+1]==='\n')){row.push(cell);cell='';rows.push(row);row=[];if(c==='\r')i++}else cell+=c}
  }
  if(cell||row.length){row.push(cell);rows.push(row)}
  return rows
}

function csvToObjects(text:string):{headers:string[];rows:Record<string,string>[]} {
  const parsed = parseCsv(text)
  if(parsed.length===0) return {headers:[],rows:[]}
  const headers = parsed[0]
  const rows = parsed.slice(1).filter(r=>r.some(c=>c.trim())).map(r=>{
    const obj:Record<string,string>={}
    headers.forEach((h,i)=>obj[h]=r[i]||'')
    return obj
  })
  return {headers,rows}
}

// ── Data processing (ported from rincle-app ErTab.tsx) ────────────
function buildTablesFromCsvFiles(fileData:Map<string,CsvField[]>):Record<string,TableDef> {
  const tables:Record<string,TableDef>={}
  for(const [tableName,fields] of fileData){
    tables[tableName]={fields:fields.map(f=>({
      d: f.display_name || f.field_name,
      t: f.dtype,
      r: f.dtype==='ref' && f.ref_target ? f.ref_target : undefined,
      l: f.list==='true' || undefined,
    }))}
  }
  return tables
}

function autoLayout(tables:Record<string,TableDef>):PosMap {
  const pos:PosMap={}
  let colX=30,colY=30
  for(const[id,tbl]of Object.entries(tables)){
    const h=HDR_H+ROW_H+tbl.fields.length*ROW_H
    if(colY>30&&colY+h>COL_MAX_H){colX+=BOX_W+GAP_X;colY=30}
    pos[id]={x:colX,y:colY}
    colY+=h+GAP_Y
  }
  return pos
}

function buildEdges(tables:Record<string,TableDef>):EdgeDef[] {
  const edges:EdgeDef[]=[], seen=new Set<string>()
  for(const[fromTable,tbl]of Object.entries(tables)){
    for(const field of tbl.fields){
      if(field.t==='ref'&&field.r&&tables[field.r]){
        const key=`${fromTable}=>${field.r}`
        if(!seen.has(key)){seen.add(key);edges.push({f:fromTable,t:field.r})}
      }
    }
  }
  return edges
}

function calcCanvasSize(tables:Record<string,TableDef>,pos:PosMap){
  let maxX=600,maxY=400
  for(const[id,tbl]of Object.entries(tables)){
    const p=pos[id];if(!p)continue
    const h=HDR_H+ROW_H+tbl.fields.length*ROW_H
    maxX=Math.max(maxX,p.x+BOX_W)
    maxY=Math.max(maxY,p.y+h)
  }
  return {w:maxX+60,h:maxY+60}
}

// ── DOM Rendering ──────────────────────────────────────────────────
function mkRow(badge:string,name:string,type:string):HTMLElement {
  const row=document.createElement('div')
  Object.assign(row.style,{display:'grid',gridTemplateColumns:'26px 1fr 80px',gap:'0 3px',padding:'2px 5px',borderBottom:'1px solid rgba(255,255,255,.04)',alignItems:'center',minHeight:'20px'})
  const b=document.createElement('span')
  Object.assign(b.style,{fontSize:'9px',fontWeight:'700',textAlign:'center',padding:'1px 3px',borderRadius:'2px',width:'22px',display:'inline-block'})
  if(badge==='PK'){b.style.background='#382800';b.style.color='#ffb74d'}
  else if(badge==='FK'){b.style.background='#0a2828';b.style.color='#80cbc4'}
  b.textContent=badge
  const n=document.createElement('span')
  Object.assign(n.style,{color:'#b0b0c8',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',fontSize:'11px'})
  n.textContent=name
  const typeKey=type.split(' ').pop()||''
  const t=document.createElement('span')
  Object.assign(t.style,{fontSize:'10px',fontFamily:'monospace',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',color:TYPE_COLORS[typeKey]??'#6a7a8a'})
  t.textContent=type
  row.appendChild(b);row.appendChild(n);row.appendChild(t)
  return row
}

function renderTables(canvas:HTMLElement,tables:Record<string,TableDef>,pos:PosMap){
  canvas.querySelectorAll('.er-tbl').forEach(el=>el.remove())
  Object.entries(tables).forEach(([id,tbl])=>{
    const p=pos[id];if(!p)return
    const box=document.createElement('div')
    box.className='er-tbl'
    Object.assign(box.style,{
      position:'absolute',width:'260px',background:'#1c1e26',border:'1px solid #3a3a50',
      borderRadius:'4px',overflow:'hidden',boxShadow:'0 2px 10px rgba(0,0,0,.6)',
      fontSize:'11px',userSelect:'none',left:`${p.x}px`,top:`${p.y}px`,
    })
    const hd=document.createElement('div')
    Object.assign(hd.style,{
      padding:'5px 8px',fontWeight:'700',fontSize:'12px',color:'#d0d8ec',
      textAlign:'center',fontFamily:'monospace',
      background:'#1a3050',borderBottom:'1px solid #2a4870',
    })
    hd.textContent=id
    box.appendChild(hd)
    box.appendChild(mkRow('PK','Unique id','text'))
    tbl.fields.forEach(f=>{
      const isFK=f.t==='ref'
      const typeLabel=isFK?(f.l?'List ':'')+(f.r||'?'):(f.l?'List ':'')+f.t
      box.appendChild(mkRow(isFK?'FK':'',f.d,typeLabel))
    })
    canvas.appendChild(box)
  })
}

function drawLines(svg:SVGSVGElement,edges:EdgeDef[],tables:Record<string,TableDef>,pos:PosMap){
  svg.querySelectorAll('path:not(defs path),line').forEach(el=>el.remove())
  function getBox(id:string){
    const p=pos[id];if(!p)return null
    const tbl=tables[id];if(!tbl)return null
    const h=HDR_H+ROW_H+tbl.fields.length*ROW_H
    return {
      x:p.x,y:p.y,w:BOX_W+2,h:h+2,
      L:{x:p.x,y:p.y+(h+2)/2},R:{x:p.x+BOX_W+2,y:p.y+(h+2)/2},
      T:{x:p.x+(BOX_W+2)/2,y:p.y},B:{x:p.x+(BOX_W+2)/2,y:p.y+h+2},
    }
  }
  edges.forEach(({f,t})=>{
    const s=getBox(f),tg=getBox(t);if(!s||!tg)return
    let x1:number,y1:number,x2:number,y2:number,isHoriz=true
    if(tg.x>s.x+s.w-10){x1=s.R.x;y1=s.R.y;x2=tg.L.x;y2=tg.L.y;isHoriz=true}
    else if(tg.x+tg.w<s.x+10){x1=s.L.x;y1=s.L.y;x2=tg.R.x;y2=tg.R.y;isHoriz=true}
    else if(tg.y>s.y+s.h-10){x1=s.B.x;y1=s.B.y;x2=tg.T.x;y2=tg.T.y;isHoriz=false}
    else{x1=s.T.x;y1=s.T.y;x2=tg.B.x;y2=tg.B.y;isHoriz=false}
    let d:string
    if(isHoriz){const midX=(x1+x2)/2;d=`M${x1},${y1} H${midX} V${y2} H${x2}`}
    else{const midY=(y1+y2)/2;d=`M${x1},${y1} V${midY} H${x2} V${y2}`}
    const path=document.createElementNS('http://www.w3.org/2000/svg','path')
    path.setAttribute('stroke','#384858')
    path.setAttribute('stroke-width','1.5')
    path.setAttribute('fill','none')
    path.setAttribute('d',d)
    path.setAttribute('marker-end','url(#arr)')
    svg.appendChild(path)
  })
}

// ── Main Component ─────────────────────────────────────────────────
export default function ErViewer({rootHandle,filePath}:{rootHandle:FileSystemDirectoryHandle;filePath:string}){
  const [activeTab,setActiveTab]=useState<'er'|'os'|'index'>('index')
  const [loading,setLoading]=useState(true)
  const [canvasSize,setCanvasSize]=useState({w:1560,h:2400})
  const [indexData,setIndexData]=useState<{headers:string[];rows:Record<string,string>[]}>({headers:[],rows:[]})
  const [osFiles,setOsFiles]=useState<{name:string;headers:string[];rows:Record<string,string>[]}[]>([])

  const wrapRef=useRef<HTMLDivElement>(null)
  const canvasRef=useRef<HTMLDivElement>(null)
  const svgRef=useRef<SVGSVGElement>(null)
  const state=useRef({tx:10,ty:10,sc:0.65})
  const dragRef=useRef<{mx0:number;my0:number}|null>(null)

  const tablesRef=useRef<Record<string,TableDef>>({})
  const posRef=useRef<PosMap>({})
  const edgesRef=useRef<EdgeDef[]>([])
  const sizeRef=useRef({w:1560,h:2400})

  function applyT(){
    if(!canvasRef.current)return
    const{tx,ty,sc}=state.current
    canvasRef.current.style.transform=`translate(${tx}px,${ty}px) scale(${sc})`
  }
  function erFit(){
    if(!wrapRef.current)return
    const ww=wrapRef.current.clientWidth,wh=wrapRef.current.clientHeight
    const{w,h}=sizeRef.current
    state.current.sc=Math.min(ww/w,wh/h)*0.9
    state.current.tx=(ww-w*state.current.sc)/2
    state.current.ty=(wh-h*state.current.sc)/2
    applyT()
  }
  function erZoom(f:number){
    state.current.sc=Math.min(3,Math.max(0.15,state.current.sc*f))
    applyT()
  }

  const redraw=useCallback(()=>{
    if(!canvasRef.current||!svgRef.current)return
    renderTables(canvasRef.current,tablesRef.current,posRef.current)
    requestAnimationFrame(()=>{
      if(svgRef.current)drawLines(svgRef.current,edgesRef.current,tablesRef.current,posRef.current)
    })
  },[])

  // ── Load all CSV data ──────────────────────────────────────────
  useEffect(()=>{
    async function load(){
      // Determine base dir from filePath (e.g. "1_requirements/05_db/_index.csv" → "1_requirements/05_db")
      const parts=filePath.split('/')
      parts.pop() // remove _index.csv
      const baseDir=parts.join('/')

      // Load _index.csv
      try{
        const indexText=await readTextFile(rootHandle,filePath)
        setIndexData(csvToObjects(indexText))
      }catch{}

      // Enumerate and load datatype CSVs
      const dtDir=baseDir?`${baseDir}/datatype`:'datatype'
      const fileData=new Map<string,CsvField[]>()
      const tableOrder:string[]=[]

      try{
        let dirHandle=rootHandle
        for(const p of dtDir.split('/')){
          dirHandle=await dirHandle.getDirectoryHandle(p)
        }
        const entries:string[]=[]
        for await(const entry of (dirHandle as any).values()){
          if(entry.kind==='file'&&entry.name.endsWith('.csv'))entries.push(entry.name)
        }
        entries.sort()

        for(const fname of entries){
          // Extract table name: "01_user.csv" → "user"
          const tableName=fname.replace(/^\d+_/,'').replace(/\.csv$/,'')
          try{
            const csvPath=`${dtDir}/${fname}`
            const text=await readTextFile(rootHandle,csvPath)
            const{rows}=csvToObjects(text)
            fileData.set(tableName,rows as unknown as CsvField[])
            tableOrder.push(tableName)
          }catch(e){console.warn(`Failed to read ${fname}`,e)}
        }
      }catch(e){console.warn('Failed to read datatype dir',e)}

      // Build ER data
      const tables=buildTablesFromCsvFiles(fileData)
      const pos=autoLayout(tables)
      const edges=buildEdges(tables)
      const size=calcCanvasSize(tables,pos)
      tablesRef.current=tables
      posRef.current=pos
      edgesRef.current=edges
      sizeRef.current=size
      setCanvasSize(size)

      // Load optionset CSVs
      const osDir=baseDir?`${baseDir}/optionset`:'optionset'
      const osData:{name:string;headers:string[];rows:Record<string,string>[]}[]=[]
      try{
        let dirHandle=rootHandle
        for(const p of osDir.split('/')){
          dirHandle=await dirHandle.getDirectoryHandle(p)
        }
        const entries:string[]=[]
        for await(const entry of (dirHandle as any).values()){
          if(entry.kind==='file'&&entry.name.endsWith('.csv'))entries.push(entry.name)
        }
        entries.sort()
        for(const fname of entries){
          const name=fname.replace(/^\d+_/,'').replace(/\.csv$/,'')
          try{
            const text=await readTextFile(rootHandle,`${osDir}/${fname}`)
            const parsed=csvToObjects(text)
            osData.push({name,...parsed})
          }catch{}
        }
      }catch(e){console.warn('Failed to read optionset dir',e)}
      setOsFiles(osData)

      setLoading(false)
    }
    load()
  },[rootHandle,filePath])

  // Redraw when data loaded
  useEffect(()=>{if(!loading)redraw()},[canvasSize,loading,redraw])

  // Fit view when ER tab becomes visible (or on initial load)
  useEffect(()=>{
    if(loading||activeTab!=='er')return
    redraw()
    requestAnimationFrame(erFit)
  },[activeTab,loading]) // eslint-disable-line react-hooks/exhaustive-deps

  // Pan/zoom — matches FlowViewer: scroll=pan, Ctrl+scroll=zoom
  useEffect(()=>{
    const wrap=wrapRef.current;if(!wrap)return
    const wrapEl=wrap
    function onWheel(e:WheelEvent){
      e.preventDefault()
      const s=state.current
      if(e.ctrlKey||e.metaKey){
        // Zoom centred on cursor (same as FlowViewer)
        const f=e.deltaY<0?1.12:0.88
        const r=wrapEl.getBoundingClientRect()
        const mx=e.clientX-r.left, my=e.clientY-r.top
        s.tx=mx-(mx-s.tx)*f
        s.ty=my-(my-s.ty)*f
        s.sc=Math.min(3,Math.max(0.15,s.sc*f))
      }else{
        // Pan (trackpad / scroll)
        s.tx-=e.deltaX
        s.ty-=e.deltaY
      }
      applyT()
    }
    wrap.addEventListener('wheel',onWheel,{passive:false})
    return()=>{
      wrap.removeEventListener('wheel',onWheel)
    }
  },[])

  const tabBtn=(id:'er'|'os'|'index',label:string)=>(
    <button key={id} onClick={()=>setActiveTab(id)} style={{
      display:'flex',alignItems:'center',padding:'0 16px',height:34,border:'none',
      background:'transparent',color:activeTab===id?'#90b8f0':'#686880',
      fontSize:12,fontWeight:600,cursor:'pointer',whiteSpace:'nowrap',
      borderBottom:`2px solid ${activeTab===id?'#4a8ad8':'transparent'}`,marginBottom:-1,
    }}>{label}</button>
  )

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100%',overflow:'hidden',background:'#212124',fontFamily:"'Segoe UI',-apple-system,BlinkMacSystemFont,'Hiragino Sans',sans-serif"}}>
      {/* Topbar */}
      <div style={{background:'#2a2a2f',padding:'6px 14px',display:'flex',alignItems:'center',gap:10,borderBottom:'1px solid #38383f',boxShadow:'0 2px 8px rgba(0,0,0,.4)',flexShrink:0}}>
        <h1 style={{fontSize:14,fontWeight:700,color:'#d0d0d8',whiteSpace:'nowrap'}}>Rincle ER図</h1>
        {activeTab==='er'&&(<>
          <button onClick={erFit} style={btnStyle}>全体表示</button>
          <button onClick={()=>erZoom(1.25)} style={btnStyle}>拡大</button>
          <button onClick={()=>erZoom(0.8)} style={btnStyle}>縮小</button>
          <div style={{flex:1}}/>
          {loading&&<span style={{fontSize:11,color:'#555568'}}>読み込み中...</span>}
          {!loading&&<span style={{fontSize:11,color:'#555568'}}>
            {Object.keys(tablesRef.current).length} テーブル / {edgesRef.current.length} リレーション
          </span>}
        </>)}
      </div>

      {/* Sub-tabs */}
      <div style={{display:'flex',alignItems:'stretch',background:'#252528',borderBottom:'1px solid #38383f',padding:'0 14px',gap:2,flexShrink:0}}>
        {tabBtn('index','テーブル一覧')}
        {tabBtn('er','ER図')}
        {tabBtn('os','Option Set')}
      </div>

      {/* ── ER Tab ── */}
      <div style={{flex:1,display:activeTab==='er'?'flex':'none',padding:14,overflow:'hidden',flexDirection:'column'}}>
        <div ref={wrapRef} style={{position:'relative',width:'100%',flex:1,minHeight:300,border:'1.5px solid #2a4a7a',borderRadius:6,overflow:'hidden',background:'#181820',cursor:'grab'}}>
          <div ref={canvasRef} style={{position:'absolute',top:0,left:0,transformOrigin:'0 0'}}>
            <svg ref={svgRef} style={{position:'absolute',top:0,left:0,pointerEvents:'none',width:canvasSize.w,height:canvasSize.h}}>
              <defs>
                <marker id="arr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <path d="M0,0 L8,3 L0,6 Z" fill="#4a6a80"/>
                </marker>
              </defs>
            </svg>
          </div>
          <div className="zoom-btns" style={{position:'absolute',bottom:10,left:10,display:'flex',flexDirection:'column',gap:4,zIndex:10}}>
            {[['1.25','+','拡大'],['0.8','−','縮小'],['fit','⊡','全体']].map(([f,icon,title])=>(
              <button key={f} title={title}
                onClick={()=>f==='fit'?erFit():erZoom(parseFloat(f))}
                style={{width:28,height:28,border:'1px solid #38383f',borderRadius:4,background:'#2a2a2f',color:'#a0a0b8',fontSize:f==='fit'?11:16,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',lineHeight:1}}>
                {icon}
              </button>
            ))}
          </div>
          {loading&&(
            <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',color:'#555568',fontSize:13}}>
              読み込み中...
            </div>
          )}
        </div>
      </div>

      {/* ── Option Set Tab ── */}
      <div style={{flex:1,display:activeTab==='os'?'block':'none',padding:14,overflowY:'auto'}}>
        <div style={{display:'flex',flexWrap:'wrap',gap:12}}>
          {osFiles.map(os=>(
            <div key={os.name} style={{background:'#1e1820',border:'1px solid #3a2838',borderRadius:4,overflow:'hidden',minWidth:140,flex:'0 0 auto'}}>
              <div style={{padding:'4px 10px',fontWeight:700,fontSize:11,fontFamily:'monospace',background:'#2a1a28',color:'#c8a0d8',borderBottom:'1px solid #3a2838',textAlign:'center'}}>{os.name}</div>
              {os.rows.length>0?(
                <table style={{borderCollapse:'collapse',width:'100%',fontSize:11}}>
                  <thead>
                    <tr>
                      {os.headers.map(h=>(
                        <th key={h} style={{background:'#1e1620',color:'#9090a8',padding:'3px 8px',borderRight:'1px solid rgba(255,255,255,.05)',fontSize:10,fontWeight:700,whiteSpace:'nowrap',borderBottom:'1px solid rgba(255,255,255,.06)'}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {os.rows.map((row,i)=>(
                      <tr key={i} style={{borderBottom:'1px solid rgba(255,255,255,.04)'}}>
                        {os.headers.map(h=>(
                          <td key={h} style={{padding:'3px 8px',borderRight:'1px solid rgba(255,255,255,.04)',color:'#c0c0cc',whiteSpace:'nowrap'}}>{row[h]||''}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ):(
                <div style={{padding:'6px 10px',color:'#7a7a8a',fontSize:11,fontStyle:'italic'}}>データなし</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Index Tab ── */}
      <div style={{flex:1,display:activeTab==='index'?'block':'none',padding:14,overflowY:'auto'}}>
        {indexData.rows.length>0?(
          <table style={{borderCollapse:'collapse',width:'100%',fontSize:12}}>
            <thead>
              <tr>
                {indexData.headers.map(h=>(
                  <th key={h} style={{background:'#2a2a2f',color:'#9090a8',padding:'7px 10px',textAlign:'left',borderRight:'1px solid rgba(255,255,255,.06)',borderBottom:'1px solid #38383f',fontSize:11,fontWeight:700,whiteSpace:'nowrap',position:'sticky',top:0,zIndex:2}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {indexData.rows.map((row,i)=>(
                <tr key={i} style={{borderBottom:'1px solid rgba(255,255,255,.04)'}}>
                  {indexData.headers.map(h=>(
                    <td key={h} style={{
                      padding:'5px 10px',borderRight:'1px solid rgba(255,255,255,.04)',
                      color:row.type==='datatype'?'#80b8e0':'#c090d0',
                      whiteSpace:h==='description'?'normal':'nowrap',
                      maxWidth:h==='description'?400:undefined,
                    }}>{row[h]||''}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ):(
          <div style={{color:'#555568',textAlign:'center',padding:40}}>データがありません</div>
        )}
      </div>
    </div>
  )
}

const btnStyle:React.CSSProperties={
  padding:'4px 12px',border:'1px solid #444450',borderRadius:4,
  background:'#38383f',color:'#a0a0b8',fontSize:11,cursor:'pointer',
}
