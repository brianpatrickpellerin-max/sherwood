# Quick visual check: python look.py [engine] [missions] [w h] -> shots/look_*.png
import sys, json
from playwright.sync_api import sync_playwright
eng = sys.argv[1] if len(sys.argv) > 1 else 'chromium'
ms = [int(x) for x in (sys.argv[2] if len(sys.argv) > 2 else '0,1,2,3,4').split(',')]
W = int(sys.argv[3]) if len(sys.argv) > 3 else 390; H = int(sys.argv[4]) if len(sys.argv) > 4 else 844
extra = sys.argv[5] if len(sys.argv) > 5 else ''
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox']) if eng == 'chromium' else p.webkit.launch()
    pg = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=True).new_page()
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://localhost:18431/index.html?' + str(__import__('time').time())); pg.wait_for_timeout(800)
    for i in ms:
        t = pg.evaluate(f"(()=>{{const t=performance.now();__sherwood.begin({i});__sherwood.G.tipList=[];__sherwood.RH.ui.closeTip();return performance.now()-t}})()")
        if extra: pg.evaluate(extra)
        pg.wait_for_timeout(700)
        info = pg.evaluate("__sherwood.RH.render.sceneInfo()")
        print(i, f'build {t:.0f}ms', info, flush=True)
        pg.screenshot(path=f'shots/look_{eng[0]}_{i}.png')
    print('errors', errs[:5])
    b.close()
