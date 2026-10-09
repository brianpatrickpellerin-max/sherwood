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
    # real touch taps on the new things: a door, ivy, the Jump down button, the snare button
    def tw(js):
        pt = pg.evaluate("(() => { const S=__sherwood, RH=S.RH, t={x:0,y:0}; const e=(" + js + "); S.G.cam.z = 1.4; RH.main.centerOn(e.x, e.y); RH.render.toScreen(e.x, e.y - (e.dz||0), t); return t; })()")
        pg.wait_for_timeout(250); pg.touchscreen.tap(pt['x'], pt['y']); pg.wait_for_timeout(300)
    def chk(n, c, info=''):
        global fails
        print(('PASS ' if c else 'FAIL ') + n, info, flush=True)
        if not c: fails += 1
    pg.evaluate("""(() => { const S=__sherwood, RH=S.RH; RH.profile.heroes=['robin','john','marian','tuck','scarlet']; S.begin(RH.MISSIONS.findIndex(m=>m.id==='m8'), []); const G=S.G; G.tipList=[]; RH.ui.closeTip(); G.paused=true;
      G.guards.forEach(g=>{ g.x=-9999; g.y=-9999; g.state='ko'; g.tied=true; g.koT=999; g.found=true; });
      const hs=G.houses.find(q=>q.door); const r=G.heroes.find(q=>q.key==='robin'); r.x=hs.door.x+20; r.y=hs.door.y+40; G.sel=[r]; RH.ui.refresh(true); window.__hs=hs; })()""")
    pg.wait_for_timeout(300)
    tw("{ x: __hs.door.x, y: __hs.door.y, dz: 12 }")
    pg.evaluate("__step(3)"); pg.wait_for_timeout(300)
    chk('touch: tap a door to hide inside', pg.evaluate("__sherwood.G.sel[0].inside === __hs"))
    btn = pg.locator('#actions button', has_text='Come out')
    chk('touch: Come out button shown', btn.count() > 0)
    if btn.count(): btn.first.tap(); pg.wait_for_timeout(200)
    chk('touch: Come out works', pg.evaluate("!__sherwood.G.sel[0].inside"))
    pg.evaluate("(() => { const G=__sherwood.G; const iv=G.ivy[0]; const r=G.sel[0]; r.x=iv.x+24; r.y=iv.y+24; window.__iv=iv; __sherwood.RH.ui.refresh(true); })()")
    tw("{ x: __iv.x, y: __iv.y, dz: 16 }")
    pg.evaluate("__step(3)"); pg.wait_for_timeout(300)
    chk('touch: tap ivy to climb onto the roof', pg.evaluate("!!__sherwood.G.sel[0].roof"))
    btn = pg.locator('#actions button', has_text='Jump')
    chk('touch: Jump down button shown', btn.count() > 0)
    if btn.count(): btn.first.tap(); pg.wait_for_timeout(200); pg.evaluate("__step(2)")
    chk('touch: Jump down works', pg.evaluate("!__sherwood.G.sel[0].roof && __sherwood.G.sel[0].climbZ === 0"))
    pg.evaluate("(() => { const G=__sherwood.G, RH=__sherwood.RH; const j=G.heroes.find(q=>q.key==='john'); const r=G.sel[0]; j.x=r.x; j.y=r.y; G.sel=[j]; G.inv.nets=3; RH.ui.refresh(true); })()")
    pg.wait_for_timeout(200)
    btn = pg.locator('#actions button', has_text='Snare')
    chk('touch: Snare button for Little John', btn.count() > 0)
    if btn.count():
        btn.first.tap(); pg.wait_for_timeout(200)
        tw("{ x: __sherwood.G.sel[0].x + 20, y: __sherwood.G.sel[0].y }")
        pg.evaluate("__step(3)")
        chk('touch: snare set by tapping the ground', pg.evaluate("__sherwood.G.snares.some(s=>s.armed)"))
    print('errors:', errs[:10])
    b.close()
sys.exit(1 if fails or errs else 0)
