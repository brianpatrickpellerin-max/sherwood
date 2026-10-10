# v8 screenshots: each mission's opening view, the England map, the camp and the Mission won scroll.
# Usage: shots8.py [chromium|webkit] [ids...]
import sys, os
from playwright.sync_api import sync_playwright
URL = os.environ.get('URL', 'http://localhost:18431/index.html')
eng = sys.argv[1] if len(sys.argv) > 1 else 'chromium'
ids = sys.argv[2:] or ['m%d' % i for i in range(1, 17)]
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox']) if eng == 'chromium' else p.webkit.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, is_mobile=(eng == 'chromium'), service_workers='block')
    pg = ctx.new_page()
    pg.on('console', lambda m: errs.append('console:' + m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append('pageerror:' + str(e)))
    pg.goto(URL); pg.wait_for_timeout(900)
    pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(900)
    pg.add_script_tag(path='tests/solver.js')
    E = pg.evaluate
    E("(() => { const RH = __sherwood.RH; RH.profile.started = true; RH.profile.heroes = ['robin','stutely','scarlet','john','marian','tuck']; RH.profile.unlocked = 9; RH.profile.stars = RH.profile.stars.map((s,i)=> i < 8 ? 2 : 0); RH.profile.offers = RH.makeOffers ? RH.makeOffers(RH.profile) : []; RH.profile.defenseOpen = true; RH.profile.defTown = 'Lincoln'; RH.profile.gold = 1800; RH.profile.score = 4790; RH.profile.foes = 100; RH.profile.kills = 32; })()")
    if 'map' in ids or len(sys.argv) <= 2:
        E("__sherwood.RH.ui.showCamp()"); pg.wait_for_timeout(500)
        pg.screenshot(path=f'shots8/{eng[0]}_map.png')
    for mid in [i for i in ids if i[0] == 'm' and i[1:].isdigit()]:
        E(f"(() => {{ const S=__sherwood, RH=S.RH; S.begin(RH.MISSIONS.findIndex(m=>m.id==='{mid}'), []); S.G.tipList=[]; RH.ui.closeTip(); RH.ui.enterGame && RH.ui.enterGame(); }})()")
        pg.wait_for_timeout(700)
        E("(() => { const G=__sherwood.G; G.paused=false; RH=__sherwood.RH; RH.ui.closeTip(); })()"); pg.wait_for_timeout(1200)
        pg.screenshot(path=f'shots8/{eng[0]}_{mid}.png')
    if 'won' in ids or len(sys.argv) <= 2:
        E("(() => { const S=__sherwood; S.begin(1, []); S.G.paused=true; window.__godmode=true; __solve(40); })()"); pg.wait_for_timeout(1800)
        pg.screenshot(path=f'shots8/{eng[0]}_won.png')
    print('errors', errs[:10])
    b.close()
