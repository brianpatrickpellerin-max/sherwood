# Quick load + error check. Usage: quick.py [chromium|webkit]
import sys
from playwright.sync_api import sync_playwright
URL = 'http://localhost:18431/index.html'
eng = sys.argv[1] if len(sys.argv) > 1 else 'chromium'
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox']) if eng == 'chromium' else p.webkit.launch()
    pg = b.new_page(viewport={'width': 390, 'height': 844})
    pg.on('console', lambda m: errs.append('console:' + m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append('pageerror:' + str(e)))
    pg.goto(URL + '?nocache=' + str(id(pg))); pg.wait_for_timeout(800)
    pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(800)
    pg.add_script_tag(path='tests/solver.js')
    out = pg.evaluate("""() => { const S = __sherwood, RH = S.RH; const res = [];
      RH.profile.heroes = ['robin','john','marian','tuck','scarlet']; RH.profile.unlocked = 12; RH.profile.ransom = 999;
      for (let i = 0; i < RH.MISSIONS.length; i++) { let r; try { S.begin(i, []); S.G.paused = true; window.__godmode = true; r = __solve(40); } catch (e) { res.push([RH.MISSIONS[i].id, 'EXC', String(e.stack).slice(0,300)]); continue; } res.push([RH.MISSIONS[i].id, !!(S.G.over && S.G.over.win), S.G.over && S.G.over.reason, S.G.objs && RH.game.objectives().filter(o=>!o.done&&!o.neg).map(o=>o.text).join('|')]); }
      return res; }""")
    for r in out: print(r)
    print('errors', errs[:10])
    b.close()
