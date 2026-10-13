# v10 feature shots: speech barks, lit interior, KO topple, town view. Usage: shots10.py [chromium|webkit]
import sys, os
from playwright.sync_api import sync_playwright
URL = os.environ.get('URL', 'http://localhost:18431/index.html')
eng = sys.argv[1] if len(sys.argv) > 1 else 'chromium'
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox']) if eng == 'chromium' else p.webkit.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, is_mobile=(eng == 'chromium'), service_workers='block')
    pg = ctx.new_page()
    pg.on('console', lambda m: errs.append('console:' + m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append('pageerror:' + str(e)))
    pg.goto(URL); pg.wait_for_timeout(900)
    E = pg.evaluate
    E("(() => { const RH = __sherwood.RH; RH.profile.started = true; RH.profile.heroes = ['robin','stutely','scarlet','john','marian','tuck']; RH.profile.unlocked = 16; })()")
    def start(mid):
        E(f"(() => {{ const S=__sherwood, RH=S.RH; S.begin(RH.MISSIONS.findIndex(m=>m.id==='{mid}'), []); S.G.tipList=[]; RH.ui.closeTip(); RH.ui.enterGame && RH.ui.enterGame(); S.G.paused=false; }})()")
        pg.wait_for_timeout(700); E("__sherwood.RH.ui.closeTip()")
    # 1: barks over guards in a town
    start('m2')
    E("""(() => { const S=__sherwood, G=S.G, RH=S.RH; const g=G.guards.filter(q=>q.state!=='ko'); const a=g[0], c=g[1]||g[0];
      S.center(a.x/32, a.y/32); RH.game.bark(a,'suspect',true); G.barkG=0; if (c!==a) RH.game.bark(c,'body',true);
      const k=g[2]; if (k) { k.state='ko'; k.koT=99; } })()""")
    pg.wait_for_timeout(700); pg.screenshot(path=f'shots10/{eng[0]}_barks.png')
    # 2: hero inside a house: lit room under the faded roof
    start('m2')
    r = E("""(() => { const S=__sherwood, G=S.G; const hs=(G.houses||[])[0]; if (!hs) return 'nohouse'; const h=G.heroes[0]; h.inside=hs; h.x=(hs.x+hs.w/2)*32; h.y=(hs.y+hs.h)*32+8; S.center(hs.x+hs.w/2, hs.y+hs.h/2); return [hs.x,hs.y,hs.w,hs.h]; })()""")
    print('house', r)
    pg.wait_for_timeout(700); pg.screenshot(path=f'shots10/{eng[0]}_interior.png')
    # 3: town square overview (York)
    start('m12'); E("__sherwood.center(16, 24)"); pg.wait_for_timeout(1500)
    pg.screenshot(path=f'shots10/{eng[0]}_town.png')
    print('errors', errs[:10])
    b.close()
