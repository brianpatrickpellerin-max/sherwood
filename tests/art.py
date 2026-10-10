# Art review: for each mission, centre the camera on its densest built-up area and screenshot (390x844 @2x).
# Usage: art.py [engine] [mission indices] [tag]
import sys
from playwright.sync_api import sync_playwright
eng = sys.argv[1] if len(sys.argv) > 1 else 'chromium'
ms = [int(x) for x in (sys.argv[2] if len(sys.argv) > 2 else '0,2,3,5,7,11').split(',')]
tag = sys.argv[3] if len(sys.argv) > 3 else 'art'
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox']) if eng == 'chromium' else p.webkit.launch()
    pg = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, service_workers='block').new_page()
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://localhost:18431/index.html'); pg.wait_for_timeout(900)
    pg.evaluate("__sherwood.RH.profile.heroes=['robin','stutely','scarlet','john','marian','tuck']")
    for i in ms:
        t = pg.evaluate(f"""(()=>{{const t=performance.now();const S=__sherwood;S.begin({i},[]);S.G.tipList=[];S.RH.ui.closeTip();S.RH.ui.hideCoach&&S.RH.ui.hideCoach();
          const m=S.G.m.map, T=S.RH.TILE; let best=0,bx=0,by=0;
          for(let y=0;y+8<=m.length;y++)for(let x=0;x+8<=m[0].length;x++){{let n=0;for(let j=0;j<8;j++)for(let k=0;k<8;k++){{const c=m[y+j][x+k];if(c==='#'||c==='r')n++;}}if(n>best){{best=n;bx=x;by=y;}}}}
          S.RH.main.centerOn((bx+4)*T,(by+4)*T); S.RH.main.userPanAt=performance.now()+1e9; return performance.now()-t}})()""")
        pg.wait_for_timeout(900)
        print(i, f'build {t:.0f}ms', flush=True)
        pg.screenshot(path=f'shots9/{tag}_{eng[0]}_{i}.png')
    print('errors', errs[:5])
    b.close()
