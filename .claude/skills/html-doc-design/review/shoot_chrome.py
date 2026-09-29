# 依存なしの撮影: ヘッドレスChromeだけで、ページを幅1280px・縦1800px刻みのPNGにする
# 使い方: python3 shoot_chrome.py <出力dir> <html>...
# 1枚ごとに本文を translateY でずらして窓の大きさで撮る（画像の切り出しツールに頼らない。
# sips の --cropOffset は位置の解釈が当てにならず、順番の狂った画像ができた → 2026-09-29）
import sys,os,re,subprocess
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
out=os.path.abspath(sys.argv[1]); os.makedirs(out,exist_ok=True)
W,STEP=1280,1800
FIX='<style>*{animation:none!important;transition:none!important}.rv,.rv-in{opacity:1!important;transform:none!important}.deck-nav,.progress{display:none!important}</style>'
def wrap(src,dst,extra=''):
    base=os.path.dirname(os.path.abspath(src))
    h=open(src).read()
    h=re.sub(r'<head>',f'<head><base href="file://{base}/">',h,count=1) if '<head>' in h else f'<base href="file://{base}/">'+h
    open(dst,'w').write(h+FIX+extra)
def chrome(*a):
    return subprocess.run([CH,'--headless=new','--disable-gpu','--hide-scrollbars','--virtual-time-budget=5000',*a],capture_output=True,text=True).stdout
for src in sys.argv[2:]:
    name=os.path.splitext(os.path.basename(src))[0]
    tmp=os.path.join(out,f'_{name}.html')
    wrap(src,tmp,'<script>addEventListener("load",()=>setTimeout(()=>document.body.setAttribute("data-h",document.documentElement.scrollHeight),1500))</script>')
    H=int(re.search(r'data-h="(\d+)"',chrome(f'--window-size={W},900','--dump-dom','file://'+tmp)).group(1))
    n=0
    for y in range(0,H,STEP):
        n+=1
        wrap(src,tmp,f'<style>html{{overflow:hidden}}body{{transform:translateY(-{y}px)}}</style>')
        h=min(STEP,H-y)
        chrome(f'--window-size={W},{h}',f'--screenshot={os.path.join(out,f"{name}-{n:02d}.png")}','file://'+tmp)
    os.remove(tmp)
    print(name,H,n)
