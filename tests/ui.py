# UI screenshots: title, camp, brief, in-mission HUD.  python ui.py [engine] [w h]
import sys, time
from playwright.sync_api import sync_playwright
eng = sys.argv[1] if len(sys.argv) > 1 else 'chromium'
W = int(sys.argv[2]) if len(sys.argv) > 2 else 390; H = int(sys.argv[3]) if len(sys.argv) > 3 else 844
tag = f'{eng[0]}_{W}x{H}'
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox']) if eng == 'chromium' else p.webkit.launch()
    pg = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=True).new_page()
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://localhost:18431/index.html?' + str(time.time())); pg.wait_for_timeout(1500)
    pg.screenshot(path=f'shots/ui_title_{tag}.png')
    pg.evaluate("""(()=>{const P=__sherwood.RH.profile;P.started=true;P.gold=140;P.unlocked=4;P.stars=[3,2,1,0,0];
      P.recruits=[__sherwood.RH.makeRecruit('r1',1),__sherwood.RH.makeRecruit('r2',2)];P.nextRid=3;P.recruits[1].job='arrows';P.pop=18;
      __sherwood.RH.ui.showCamp();})()""")
    pg.wait_for_timeout(400)
    pg.screenshot(path=f'shots/ui_camp_{tag}.png')
    pg.evaluate("document.getElementById('screen').scrollTop=700"); pg.wait_for_timeout(200)
    pg.screenshot(path=f'shots/ui_camp2_{tag}.png')
    pg.evaluate("__sherwood.RH.ui.showBrief(3)"); pg.wait_for_timeout(300)
    pg.evaluate("document.getElementById('screen').scrollTop=400"); pg.wait_for_timeout(200)
    pg.screenshot(path=f'shots/ui_brief_{tag}.png')
    pg.evaluate("__sherwood.begin(1,['r1']);__sherwood.G.tipList=[];__sherwood.RH.ui.closeTip()"); pg.wait_for_timeout(800)
    pg.screenshot(path=f'shots/ui_hud_{tag}.png')
    print('errors', errs[:5])
    b.close()
