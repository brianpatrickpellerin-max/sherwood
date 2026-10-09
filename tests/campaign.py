# Full v3 campaign run through the real UI. Usage: campaign.py [chromium|webkit] [w] [h] [shots]
# Wins all 12 story missions, an ambush, the defense mission, walks the base, pays the ransom,
# checks save migration and the new mechanics, and fails on any console error.
import sys, json
from playwright.sync_api import sync_playwright
import os
URL = os.environ.get('URL', 'http://localhost:18431/index.html')
eng = sys.argv[1] if len(sys.argv) > 1 else 'chromium'
W = int(sys.argv[2]) if len(sys.argv) > 2 else 390
H = int(sys.argv[3]) if len(sys.argv) > 3 else 844
SHOTS = len(sys.argv) > 4
tag = f'{eng[0]}{W}x{H}'
res = []; errs = []
def ok(n, c, info=''):
    res.append((n, bool(c), str(info))); print(('PASS ' if c else 'FAIL ') + n, info, flush=True)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox']) if eng == 'chromium' else p.webkit.launch()
    ctx = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=2, has_touch=True, is_mobile=(eng == 'chromium'))
    pg = ctx.new_page()
    pg.on('console', lambda m: errs.append('console:' + m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append('pageerror:' + str(e)))
    E = pg.evaluate
    def shot(name):
        if SHOTS: pg.screenshot(path=f'shots3/{tag}_{name}.png')
    def tap(sel):
        loc = pg.locator(sel).first
        bb = loc.evaluate("e => { e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }")
        pg.wait_for_timeout(150)
        pg.touchscreen.tap(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2); pg.wait_for_timeout(250)
    def inject():
        E("window.__solve || 0") or None
        if not E("!!window.__solve"):
            pg.add_script_tag(path='tests/solver.js'); pg.add_script_tag(path='tests/mech.js')
    def play(label, winshot=None):
        pg.wait_for_timeout(400)
        if pg.locator('#tipok').is_visible(): tap('#tipok')
        if winshot: shot(winshot)
        E("__sherwood.G.paused = true; window.__godmode = true")
        r = E("(() => { __solve(45); return { over: __sherwood.G.over, left: __sherwood.RH.game.objectives().filter(o=>!o.done&&!o.neg&&!o.opt).map(o=>o.text) }; })()")
        try: pg.wait_for_function("__sherwood.screen() == 'end'", timeout=4000)
        except Exception: pass
        win = bool(r['over'] and r['over']['win'])
        ok('win ' + label, win and E("__sherwood.screen()") == 'end', json.dumps(r)[:200])
        if winshot: shot(winshot + '_end')
        tap('[data-act=camp]')
        ok(label + ' -> camp', E("__sherwood.screen()") == 'camp')

    # save migration from v2
    pg.goto(URL); pg.wait_for_timeout(700)
    E("""localStorage.clear(); localStorage.setItem('sherwood.save.v2', JSON.stringify({v:2, unlocked:3, best:{m1:{stars:2},m2:{stars:1},m3:{stars:3}}, gold:120, arrows:14, potions:2, stones:6, recruits:[{id:'r1',name:'Alan of the Dale',tunic:'#556b2f',hood:'#3a4a20',hair:'#3a2412',skin:'#efc39c',beard:true,train:1,job:'arrows'}], nextRid:2, popularity:30, started:true}))""")
    pg.reload(); pg.wait_for_timeout(800); inject()
    P = E("__sherwood.profile()")
    ok('v2 save migrates to v3', P.get('v') == 3 and P['gold'] == 120 and len(P['recruits']) == 1 and P['recruits'][0].get('cls') and 'john' in P['heroes'], json.dumps({k: P.get(k) for k in ['v', 'unlocked', 'heroes', 'gold', 'popularity']}))
    ok('v3 key written', E("!!localStorage.getItem(__sherwood.key3)"))

    # fresh campaign through the real UI
    E("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(800); inject()
    shot('01_title')
    tap('[data-act=newgame]')
    ok('briefing shown', E("__sherwood.screen()") == 'brief'); shot('02_brief')
    tap('[data-act=begin]')
    ok('M1 started', E("__sherwood.G.m && __sherwood.G.m.id") == 'm1')
    inject()
    play('m1', '03_m1')
    shot('04_camp')
    ok('ambush offers appear after a story win', E("__sherwood.profile().offers.length") > 0, E("JSON.stringify(__sherwood.profile().offers)"))
    # base inspection
    tap('[data-act=base]'); pg.wait_for_timeout(500)
    ok('base inspection loads', E("__sherwood.G.kind") == 'base' and E("__sherwood.screen()") is None)
    if pg.locator('#tipok').is_visible(): tap('#tipok')
    shot('05_base')
    tap('#actions [data-id=done]')
    ok('base -> camp', E("__sherwood.screen()") == 'camp')
    amb_done = defense_done = False
    for i in range(1, 12):
        if i == 11:  # last mission needs the ransom
            E("__sherwood.RH.profile.gold = Math.max(__sherwood.RH.profile.gold, 2000); __sherwood.RH.ui.showCamp()")
            ok('ransom section open', pg.locator('[data-act=ransom]').count() > 0)
            for _ in range(20):
                if E("__sherwood.RH.ransomPaid()"): break
                tap('[data-act=ransom]')
            ok('King\'s ransom paid', E("__sherwood.RH.ransomPaid()"), E("__sherwood.profile().ransom"))
        sel = f'[data-act=brief][data-arg="{i}"]'
        if pg.locator(sel).count() == 0:
            ok(f'm{i+1} seal on map', False, 'missing'); E(f"__sherwood.RH.ui.showBrief({i})")
        else:
            tap(sel)
        tap('[data-act=begin]')
        ok(f'm{i+1} started', E("__sherwood.G.m && __sherwood.G.m.id") == f'm{i+1}', E("__sherwood.G.m && __sherwood.G.m.id"))
        play(f'm{i+1}', f'1{i:02d}_m{i+1}' if i in (2, 4, 6, 7, 10, 11) else None)
        if not amb_done and E("__sherwood.profile().offers.length") > 0 and i >= 1:
            g0 = E("__sherwood.profile().gold"); r0 = E("__sherwood.profile().recruits.length")
            tap('[data-act=amb]'); tap('[data-act=begin]')
            ok('ambush started', E("__sherwood.G.kind") == 'ambush', E("__sherwood.G.m.title"))
            play('ambush', '06_ambush')
            ok('ambush pays gold', E("__sherwood.profile().gold") > g0, f'{g0}->{E("__sherwood.profile().gold")} recruits {r0}->{E("__sherwood.profile().recruits.length")}')
            amb_done = True
        if not defense_done and E("__sherwood.profile().defenseOpen") and pg.locator('[data-act=defense]').count():
            tap('[data-act=defense]'); tap('[data-act=begin]')
            ok('defense started', E("__sherwood.G.kind") == 'defense')
            play('defense', '07_defense')
            ok('defense recorded', E("__sherwood.profile().defenseDone") >= 1, E("__sherwood.profile().defenseDone"))
            defense_done = True
    ok('ambush played', amb_done); ok('defense played', defense_done)
    ok('campaign complete', E("__sherwood.profile().unlocked") >= 12, E("__sherwood.profile().unlocked"))
    shot('08_final_camp')
    # mechanics lab
    for n, c, info in E("__mech()"): ok('mech: ' + n, c, info)
    ok('zero console errors', not errs, errs[:5])
    b.close()
fails = [r for r in res if not r[1]]
json.dump({'tag': tag, 'pass': len(res) - len(fails), 'fail': len(fails), 'fails': fails, 'errors': errs}, open(f'tests/result3_{tag}.json', 'w'), indent=1)
print(f'== {tag}: {len(res)-len(fails)}/{len(res)} passed')
sys.exit(1 if fails else 0)
