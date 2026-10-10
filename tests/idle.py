# Each mission (and the ambushes/defences): stand still at the start for 12 s; nobody should be spotted.
import sys
from playwright.sync_api import sync_playwright
eng = sys.argv[1] if len(sys.argv) > 1 else 'chromium'
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox']) if eng == 'chromium' else p.webkit.launch()
    pg = b.new_page(viewport={'width': 390, 'height': 844}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://localhost:18431/index.html'); pg.wait_for_timeout(900)
    pg.add_script_tag(path='tests/solver.js')
    print(pg.evaluate("""() => { const S=__sherwood, RH=S.RH, out=[]; RH.profile.heroes=['robin','stutely','scarlet','john','marian','tuck'];
      for (let i=0;i<RH.MISSIONS.length;i++){ S.begin(i, []); S.G.tipList=[]; S.G.paused=true; for(let k=0;k<360;k++) __step(1/30);
        out.push(RH.MISSIONS[i].id+':'+(S.G.stats.spotted?'SPOTTED':'ok')+(S.G.over?' OVER':'')); }
      return out.join(' '); }"""))
    print('errors', errs[:5]); b.close()
