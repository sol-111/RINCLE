import { chromium } from 'playwright'; // 実行は playwright が入ったフォルダ（Playwrightが node_modules に入っているフォルダ）で node <このファイル> <出力dir> <ページ一覧txt>
import fs from 'fs'; import path from 'path';
const ROOT=process.argv[4] || process.cwd(); // 資料フォルダ（第4引数）
const OUT=process.argv[2];
const files=fs.readFileSync(process.argv[3],'utf8').trim().split('\n');
const CH=1800, W=1280;
const browser=await chromium.launch();
const ctx=await browser.newContext({viewport:{width:W,height:900},reducedMotion:'reduce',deviceScaleFactor:1});
const page=await ctx.newPage();
async function settle(){
  await page.addStyleTag({content:'*{animation:none!important;transition:none!important} .reveal,[data-reveal],.section,section{opacity:1!important;transform:none!important}'});
  const h=await page.evaluate(()=>document.documentElement.scrollHeight);
  for(let y=0;y<h;y+=800){await page.evaluate(v=>window.scrollTo(0,v),y);await page.waitForTimeout(60);}
  await page.evaluate(()=>window.scrollTo(0,0)); await page.waitForTimeout(300);
}
async function shootChunks(base){
  const h=await page.evaluate(()=>document.documentElement.scrollHeight);
  let i=0;
  for(let y=0;y<h;y+=CH){
    await page.screenshot({path:`${base}-${String(++i).padStart(2,'0')}.png`,clip:{x:0,y,width:W,height:Math.min(CH,h-y)},fullPage:true});
  }
  return i;
}
for(const rel of files){
  const name=rel.replace(/\.html$/,'').replace(/[\/.]/g,'_');
  await page.goto('file://'+path.join(ROOT,rel),{waitUntil:'load'}); await page.waitForTimeout(700);
  await settle();
  const tabs=await page.$$('.tab-btn');
  if(tabs.length){
    for(let t=0;t<tabs.length;t++){
      await tabs[t].click(); await page.waitForTimeout(200); await settle();
      const n=await shootChunks(`${OUT}/${name}__tab${t+1}`); console.log(rel,'tab',t+1,n,'chunks');
    }
  } else { const n=await shootChunks(`${OUT}/${name}`); console.log(rel,n,'chunks'); }
}
// index.html（SPAシェル）がある案件だけ: welcome + one loaded page
await page.goto('file://'+ROOT+'/index.html',{waitUntil:'load'}); await page.waitForTimeout(500);
await page.screenshot({path:`${OUT}/index__welcome.png`});
await page.goto('file://'+ROOT+'/index.html#stripe-payment-flow',{waitUntil:'load'}); await page.waitForTimeout(1200);
await page.screenshot({path:`${OUT}/index__page-open.png`}); console.log('index 2 shots');
await browser.close();
