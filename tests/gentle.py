# Checks the gentle first mission: coach steps, checkpoint wake-ups, reasoned lose screen with
# one-tap checkpoint retry, the m1-m4 ramp, box-select and John's staff sweep. Usage: gentle.py [chromium|webkit]
import sys, os, json
from playwright.sync_api import sync_playwright
URL = os.environ.get('URL', 'http://localhost:18431/index.html')
eng = sys.argv[1] if len(sys.argv) > 1 else 'chromium'
res = []; errs = []
def ok(n, c, info=''):
    res.append((n, bool(c))); print(('PASS ' if c else 'FAIL ') + n, info, flush=True)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox']) if eng == 'chromium' else p.webkit.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=3, has_touch=True, is_mobile=(eng == 'chromium'), service_workers='block')
    pg = ctx.new_page()
    pg.on('console', lambda m: errs.append('console:' + m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append('pageerror:' + str(e)))
    E = pg.evaluate
    shot = lambda n: pg.screenshot(path=f'shots5/{eng[0]}_{n}.png')
    def tapw(wx, wy, dy=0):
        E(f"__sherwood.RH.main.centerOn({wx},{wy})"); pg.wait_for_timeout(120)
        t = E(f"(() => {{ const t={{x:0,y:0}}; __sherwood.RH.render.toScreen({wx},{wy},t); return t; }})()")
        pg.touchscreen.tap(t['x'], t['y'] + dy); pg.wait_for_timeout(200)
    def run(sec):
        E("__sherwood.G.speed = 4"); pg.wait_for_timeout(int(sec * 250)); E("__sherwood.G.speed = 1")
    pg.goto(URL); pg.wait_for_timeout(900)
    E("__sherwood.begin(0, [])"); pg.wait_for_timeout(1200)
    coach = lambda: E("document.getElementById('coachtext').textContent")
    ok('coach shows step 1', 'Step 1' in coach() and not E("document.getElementById('coach').classList.contains('hidden')"), coach())
    shot('m1_step1')
    T = 32
    E("(() => { const r=__sherwood.G.heroes[0]; })()")
    tapw(8.5 * T, 19.5 * T); run(8)
    ok('walking advances the coach', 'Step 2' in coach(), coach())
    shot('m1_step2_bush')
    tapw(11.5 * T, 18.5 * T); run(4)
    ok('hide step done', 'Step 3' in coach(), coach())
    ok('sneak button pulses', E("!!document.querySelector('#actions .act.pulse')"))
    shot('m1_step3_sneak')
    pg.locator('#actions .act.pulse').first.tap(force=True); pg.wait_for_timeout(400)
    ok('sneak step done', 'Step 4' in coach(), coach())
    run(1); shot('m1_step4_ko')
    # careless: get Robin beaten down
    E("(() => { const G=__sherwood.G, h=G.heroes[0]; const g=G.guards.find(q=>q.route&&q.route.length>1); h.x=g.x+20; h.y=g.y; __sherwood.RH.game.spot ? 0 : 0; for (let i=0;i<20;i++) __sherwood.RH.game.hurtHero ? 0 : 0; h.hp=1; })()")
    E("(() => { const G=__sherwood.G, h=G.heroes[0]; h.hp = 0; h.down = true; })()"); run(1.5)
    st = E("(() => { const G=__sherwood.G, h=G.heroes[0]; return {down:h.down, hp:h.hp, max:h.maxhp, over:!!G.over, retries:G.stats.retries, tip: document.getElementById('tiptext').textContent}; })()")
    ok('m1: falling wakes Robin at the checkpoint (no fail)', not st['down'] and st['hp'] == st['max'] and not st['over'] and st['retries'] == 1, st)
    ok('m1: the tip explains what happened', 'safe' in st['tip'], st['tip'][:90])
    shot('m1_wakeup')
    ok('m1 robin health boosted', st['max'] >= 10, st['max'])
    # regen
    E("__sherwood.G.heroes[0].hp = 4"); run(6)
    ok('m1: Robin heals when nobody chases him', E("__sherwood.G.heroes[0].hp") > 4, E("__sherwood.G.heroes[0].hp"))
    # m2: lose screen with reason + checkpoint retry
    E("__sherwood.begin(1, [])"); pg.wait_for_timeout(900)
    E("(() => { const G=__sherwood.G; G.lastHurt={hero:'Robin', n:3, arrow:false, type:'soldier'}; for (const h of G.heroes) if (!h.npc) { h.hp=0; h.down=true; } })()"); run(1)
    print('dbg', E("(()=>{const G=__sherwood.G; return [G.m.id, !!G.over, G.paused, G.heroes.map(h=>h.key+h.down), G.time]})()"))
    pg.wait_for_timeout(800)
    scr = E("__sherwood.screen()")
    txt = E("document.getElementById('screenInner').innerText")
    ok('m2: lose screen shows', scr == 'end' and 'mission failed' in txt.lower(), scr)
    ok('m2: lose screen gives the reason', '3 guards at once' in txt, txt[:160])
    ok('m2: one-tap Retry from checkpoint', E("!!document.querySelector('[data-act=cpretry]')"))
    shot('m2_lose')
    pg.locator('[data-act=cpretry]').tap(); pg.wait_for_timeout(600)
    st = E("(() => { const G=__sherwood.G; return {over:!!G.over, scr:__sherwood.screen(), up:G.heroes.filter(h=>!h.npc).every(h=>!h.down)}; })()")
    ok('m2: checkpoint retry resumes play', not st['over'] and not st['scr'] and st['up'], st)
    # ramp
    ramp = []
    for i in range(5):
        E(f"__sherwood.begin({i}, [])"); pg.wait_for_timeout(300)
        ramp.append(E("(() => { const e=__sherwood.G.ease; return [e.det, e.atk, e.hp, e.regen]; })()"))
    ok('difficulty ramps m1 -> m5', all(ramp[i][0] < ramp[i + 1][0] for i in range(4)) and ramp[4] == [1, 1, 0, 0], ramp)
    # box select + sweep (a later mission with the whole band)
    E("__sherwood.RH.profile.heroes = ['robin','john','marian','tuck','scarlet']")
    E("__sherwood.begin(4, [])"); pg.wait_for_timeout(900)
    hs = E("__sherwood.G.heroes.filter(h=>!h.npc).map(h=>h.key)")
    E("(() => { const G=__sherwood.G; const r=G.heroes[0]; for (const h of G.heroes) { h.x=r.x+(Math.random()*40-20); h.y=r.y+(Math.random()*40-20); } G.sel=[G.heroes[0]]; __sherwood.RH.main.centerOn(r.x, r.y); })()")
    pg.wait_for_timeout(300)
    c = E("(() => { const t={x:0,y:0}; const r=__sherwood.G.heroes[0]; __sherwood.RH.render.toScreen(r.x,r.y,t); return t; })()")
    x0, y0 = c['x'] - 110, c['y'] - 110
    cdp = None
    # long press on empty ground then drag (dispatch real touch events)
    E(f"""(() => {{ const cv=document.getElementById('cv'); const mk=(type,x,y)=>{{ const t=new Touch({{identifier:7,target:cv,clientX:x,clientY:y}}); cv.dispatchEvent(new TouchEvent(type,{{touches:type==='touchend'?[]:[t],changedTouches:[t],cancelable:true,bubbles:true}})); }};
      window.__mk=mk; mk('touchstart',{x0},{y0}); }})()""")
    pg.wait_for_timeout(650)
    E(f"__mk('touchmove',{x0+120},{y0+120}); __mk('touchmove',{x0+230},{y0+230})")
    shot('box_select'); pg.wait_for_timeout(100)
    E(f"__mk('touchend',{x0+230},{y0+230})"); pg.wait_for_timeout(300)
    ok('long-press drag box selects the group', E("__sherwood.G.sel.length") >= 2, E("__sherwood.G.sel.map(h=>h.key)"))
    if 'john' in hs:
        E("(() => { const G=__sherwood.G; const j=G.heroes.find(h=>h.key==='john'); G.sel=[j]; let n=0; for (const g of G.guards) if (__sherwood.RH.game.isActive(g) && n<3) { g.x=j.x+30*Math.cos(n*2); g.y=j.y+30*Math.sin(n*2); n++; } j.cd=0; })()")
        pg.wait_for_timeout(300)
        btn = pg.locator('#actions .act', has_text='Sweep')
        ok('John has a Sweep button', btn.count() == 1)
        btn.first.tap(force=True); pg.wait_for_timeout(300)
        ok('staff sweep floors or staggers everyone close', E("(()=>{const G=__sherwood.G; const j=G.heroes.find(h=>h.key==='john'); return G.guards.filter(g=>Math.hypot(g.x-j.x,g.y-j.y)<52 && (g.state==='ko' || g.stagger>0)).length})()") >= 3, E("__sherwood.G.guards.filter(g=>g.state==='ko').map(g=>g.type)"))
    ok('no console errors', not errs, errs[:4])
    b.close()
print('RESULT', sum(c for _, c in res), '/', len(res))
