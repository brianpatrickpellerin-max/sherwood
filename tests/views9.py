# Representative views: each mission's camera centred on its densest town / castle cluster (not the opening forest).
# Usage: views9.py [chromium|webkit] [ids...]   -> shots9v/<e>_v_mN.png
import sys, os
from playwright.sync_api import sync_playwright
URL = os.environ.get('URL', 'http://localhost:18431/index.html')
eng = sys.argv[1] if len(sys.argv) > 1 else 'chromium'
ids = sys.argv[2:] or ['m%d' % i for i in range(1, 17)]
errs = []
FOCUS = """(() => { const S=__sherwood, G=S.G, g=G.grid, W=g.w, H=g.h; const wt={r:3,'#':1.2,m:2,c:1,h:0.6};
  let best=-1, bx=0, by=0;
  for (let y=4;y<H-4;y++) for (let x=4;x<W-4;x++) { let s=0; for (let j=-5;j<=5;j++) for (let i=-4;i<=4;i++) { const ch=g.ch[(y+j)*W+x+i]; s+=wt[ch]||0; } if (s>best) { best=s; bx=x; by=y; } }
  S.center(bx, by); const st=document.createElement('style'); st.textContent='#pausedbar{display:none!important}'; document.head.appendChild(st); return [bx, by, best]; })()"""
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox']) if eng == 'chromium' else p.webkit.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, is_mobile=(eng == 'chromium'), service_workers='block')
    pg = ctx.new_page()
    pg.on('console', lambda m: errs.append('console:' + m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append('pageerror:' + str(e)))
    pg.goto(URL); pg.wait_for_timeout(900)
    pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(900)
    E = pg.evaluate
    E("(() => { const RH = __sherwood.RH; RH.profile.started = true; RH.profile.heroes = ['robin','stutely','scarlet','john','marian','tuck']; RH.profile.unlocked = 16; RH.profile.gold = 1800; })()")
    for mid in ids:
        E(f"(() => {{ const S=__sherwood, RH=S.RH; S.begin(RH.MISSIONS.findIndex(m=>m.id==='{mid}'), []); S.G.tipList=[]; RH.ui.closeTip(); RH.ui.enterGame && RH.ui.enterGame(); }})()")
        pg.wait_for_timeout(600)
        E("(() => { const G=__sherwood.G; G.paused=false; __sherwood.RH.ui.closeTip(); })()"); pg.wait_for_timeout(400)
        f = E(FOCUS); pg.wait_for_timeout(500)
        E("__sherwood.RH.ui.closeTip()"); pg.wait_for_timeout(200)
        pg.screenshot(path=f'shots9v/{eng[0]}_v_{mid}.png')
        print(mid, f)
    print('errors', errs[:10])
    b.close()
