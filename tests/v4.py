# v4 checks: every mission loads and renders, new mechanics pass. Usage: v4.py [chromium|webkit]
import sys, json, os
from playwright.sync_api import sync_playwright
URL = os.environ.get('URL', 'http://localhost:18431/index.html')
eng = sys.argv[1] if len(sys.argv) > 1 else 'chromium'
errs = []; fails = 0
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox']) if eng == 'chromium' else p.webkit.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, is_mobile=(eng == 'chromium'))
    pg = ctx.new_page()
    pg.on('console', lambda m: errs.append('console:' + m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append('pageerror:' + str(e)))
    pg.goto(URL); pg.wait_for_timeout(800)
    pg.add_script_tag(path='tests/solver.js'); pg.add_script_tag(path='tests/mech.js')
    n = pg.evaluate("__sherwood.RH.MISSIONS.length")
    for i in range(n):
        info = pg.evaluate(f"""(() => {{ __sherwood.RH.profile.heroes=['robin','john','marian','tuck','scarlet']; __sherwood.begin({i}, []); const G=__sherwood.G; return {{ id: G.m.id, houses: G.houses.length, doors: G.houses.filter(h=>h.door).length, ivy: G.ivy.length, horn: !!G.horn, spawn: G.spawnAt }}; }})()""")
        pg.wait_for_timeout(500)
        print('mission', json.dumps(info), flush=True)
    for fn in ['__mech', '__mech4']:
        out = pg.evaluate(f"{fn}()")
        for nme, okk, inf in out:
            print(('PASS ' if okk else 'FAIL ') + nme, inf, flush=True)
            if not okk: fails += 1
    print('errors:', errs[:10])
    b.close()
sys.exit(1 if fails or errs else 0)
