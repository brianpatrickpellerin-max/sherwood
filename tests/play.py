# Automated playthrough checks. Usage: play.py [chromium|webkit] [w] [h]
import sys, json, time
from playwright.sync_api import sync_playwright
URL = 'http://localhost:18431/index.html'
engine = sys.argv[1] if len(sys.argv) > 1 else 'chromium'
W = int(sys.argv[2]) if len(sys.argv) > 2 else 390
H = int(sys.argv[3]) if len(sys.argv) > 3 else 844
tag = f'{engine[0]}{W}'
results = []; errs = []
def ok(name, cond, info=''):
    results.append((name, bool(cond), info)); print(('PASS ' if cond else 'FAIL ') + name, info, flush=True)

with sync_playwright() as p:
    if engine == 'chromium':
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    else:
        b = p.webkit.launch()
    ctx = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=3, has_touch=True, is_mobile=(engine == 'chromium'))
    pg = ctx.new_page()
    pg.on('console', lambda m: errs.append('console:' + m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append('pageerror:' + str(e)))
    pg.goto(URL); pg.wait_for_timeout(600)
    pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(600)
    E = pg.evaluate
    def tap_el(sel):
        pg.locator(sel).first.scroll_into_view_if_needed(); pg.wait_for_timeout(150)
        bb = pg.locator(sel).first.bounding_box()
        pg.touchscreen.tap(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2); pg.wait_for_timeout(250)
    def tap_world(x, y):
        s = E(f"__sherwood.worldToScreen({x},{y})"); pg.touchscreen.tap(s['x'], s['y']); pg.wait_for_timeout(120)
    def tap_tile(tx, ty):
        s = E(f"__sherwood.tileToScreen({tx},{ty})"); pg.touchscreen.tap(s['x'], s['y']); pg.wait_for_timeout(120)
    def pause():  # freeze real-time loop so the test drives the simulation deterministically
        E("__sherwood.G.paused = true")
    def notips():
        E("__sherwood.G.tipList = []; __sherwood.RH.ui.closeTip()")

    # --- Title -> new game -> briefing -> begin via real taps
    pg.screenshot(path=f'shots/{tag}_01_title.png')
    tap_el('[data-act=newgame]')
    ok('briefing shown', E("__sherwood.screen()") == 'brief')
    pg.screenshot(path=f'shots/{tag}_02_brief.png')
    tap_el('[data-act=begin]')
    pg.wait_for_timeout(500)
    ok('mission 1 started', E("!!__sherwood.G.m && __sherwood.G.m.id") == 'm1')
    pg.screenshot(path=f'shots/{tag}_03_m1_start.png')
    tap_el('#tipok'); notips(); pause()

    # --- Pathing via a real tap on the ground
    E("__sherwood.select('robin'); __sherwood.center(12,21)")
    tap_tile(12, 22)
    has_path = E("!!__sherwood.hero('robin').path")
    E("__sherwood.step(4)")
    pos = E("(()=>{const h=__sherwood.hero('robin');return [Math.floor(h.x/32),Math.floor(h.y/32)]})()")
    ok('tap ground -> A* path + walk', has_path and pos == [12, 22], str(pos))
    # Path around obstacles: walk from start to the camp (goes around trees)
    E("__sherwood.G.guards.forEach(g=>{g.x=-9999;g.y=-9999})")  # move guards out of the way for this check
    r = E("""(()=>{const RH=__sherwood.RH,G=__sherwood.G;const p=RH.astar(G.grid,12,25,10,8);
      return p? {len:p.length, ok:p.every(i=>G.grid.walk[i]===1)}:null})()""")
    ok('A* finds walkable route to camp', r and r['ok'] and r['len'] > 10, str(r))

    # --- Vision cone + walls (Market: door guard looks into strongroom through the door)
    E("__sherwood.begin(1)"); notips(); pause()
    E("""(()=>{const G=__sherwood.G;G.guards.forEach((g,i)=>{if(i>0){g.x=-9999;g.y=-9999;g.route=[{x:-9999,y:-9999,wait:0}]}});
      const g=G.guards[0];g.looks=[-Math.PI/2];g.dir=-Math.PI/2;g.faceTo=g.dir;
      G.heroes.forEach(h=>{h.x=27*32;h.y=30*32});})()""")
    E("__sherwood.tp('robin',10,4); __sherwood.step(1.5)")
    sus_wall = E("__sherwood.G.guards[0].sus")
    ok('wall blocks line of sight', sus_wall == 0, f'sus={sus_wall}')
    E("__sherwood.tp('robin',13,5); __sherwood.step(0.4)")
    sus_open = E("__sherwood.G.guards[0].sus"); st = E("__sherwood.G.guards[0].state")
    ok('guard notices hero in cone', sus_open > 0.2 or st == 'alert', f'sus={sus_open} state={st}')
    E("__sherwood.step(2)")
    ok('suspicion escalates to alert (!)', E("__sherwood.G.guards[0].state") == 'alert' and E("__sherwood.G.stats.spotted"))
    # sneaking slows detection
    def detect_time(sneak):
        E("__sherwood.begin(1)"); notips(); pause()
        E("""(()=>{const G=__sherwood.G;G.guards.forEach((g,i)=>{if(i>0){g.x=-9999;g.y=-9999;g.route=[{x:-9999,y:-9999,wait:0}]}});
          const g=G.guards[0];g.looks=[Math.PI/2];g.dir=Math.PI/2;g.faceTo=g.dir;G.heroes.forEach(h=>{h.x=27*32;h.y=30*32});})()""")
        E(f"(()=>{{const h=__sherwood.tp('robin',13,13);h.sneak={str(sneak).lower()};}})()")
        return E("(()=>{let t=0;const g=__sherwood.G.guards[0];while(g.state!=='alert'&&t<20){__sherwood.step(0.1);t+=0.1}return +t.toFixed(1)})()")
    tw, ts = detect_time(False), detect_time(True)
    ok('sneaking slows detection', ts > tw * 1.5, f'walk={tw}s sneak={ts}s')
    # close-up detection is faster
    E("__sherwood.begin(1)"); notips(); pause()
    E("""(()=>{const G=__sherwood.G;G.guards.forEach((g,i)=>{if(i>0){g.x=-9999;g.y=-9999;g.route=[{x:-9999,y:-9999,wait:0}]}});
      const g=G.guards[0];g.looks=[Math.PI/2];g.dir=Math.PI/2;g.faceTo=g.dir;G.heroes.forEach(h=>{h.x=27*32;h.y=30*32});})()""")
    E("__sherwood.tp('robin',13,10)")
    tclose = E("(()=>{let t=0;const g=__sherwood.G.guards[0];while(g.state!=='alert'&&t<20){__sherwood.step(0.1);t+=0.1}return +t.toFixed(1)})()")
    ok('closer = faster detection', tclose < tw, f'close={tclose}s far={tw}s')
    # hiding in hay
    E("__sherwood.begin(1)"); notips(); pause()
    E("""(()=>{const G=__sherwood.G;G.guards.forEach((g,i)=>{if(i!==5){g.x=-9999;g.y=-9999;g.route=[{x:-9999,y:-9999,wait:0}]}});
      const g=G.guards[5];g.x=(3+.5)*32;g.y=(5+.5)*32;g.route=[{tx:3,ty:5,x:g.x,y:g.y,wait:0}];g.looks=[Math.PI];g.dir=Math.PI;g.faceTo=g.dir;
      G.heroes.forEach(h=>{h.x=27*32;h.y=30*32});})()""")
    E("__sherwood.tp('robin',1,4); __sherwood.step(2)")
    ok('hay hides hero from a guard looking at him', E("__sherwood.G.guards[5].sus") == 0)

    # --- Knockout + tie via real taps (Woodcutters' camp, guard by the pen)
    E("__sherwood.begin(0)"); notips(); pause()
    E("__sherwood.G.guards.forEach((g,i)=>{if(i!==3){g.x=-9999;g.y=-9999;g.route=[{x:-9999,y:-9999,wait:0}]}})")
    E("__sherwood.tp('robin',16,6); __sherwood.select('robin'); __sherwood.center(15,6)")
    g3 = E("(()=>{const g=__sherwood.G.guards[3];return [g.x,g.y-10]})()")
    tap_world(g3[0], g3[1])
    E("__sherwood.step(1.2)")
    ok('tap guard from behind -> knockout', E("__sherwood.G.guards[3].state") == 'ko', E("__sherwood.G.guards[3].state"))
    ok('knockout did not alert', not E("__sherwood.G.stats.spotted"))
    g3 = E("(()=>{const g=__sherwood.G.guards[3];return [g.x,g.y]})()")
    tap_world(g3[0], g3[1])
    E("__sherwood.step(1.6)")
    ok('tap body -> tied up', E("__sherwood.G.guards[3].tied"))
    E("__sherwood.step(70)")
    ok('tied guard never wakes', E("__sherwood.G.guards[3].state") == 'ko')
    pg.screenshot(path=f'shots/{tag}_04_tied.png')
    # untied guard wakes
    E("__sherwood.begin(0)"); notips(); pause()
    E("__sherwood.G.guards.forEach((g,i)=>{if(i!==3){g.x=-9999;g.y=-9999;g.route=[{x:-9999,y:-9999,wait:0}]}})")
    E("__sherwood.tp('john',16,6); __sherwood.order('john','ko',3); __sherwood.step(1.2)")
    ok('Little John knocks out', E("__sherwood.G.guards[3].state") == 'ko')
    kot = E("__sherwood.G.guards[3].koT")
    E(f"__sherwood.tp('john',20,12); __sherwood.step({kot + 1})")
    ok('untied guard wakes up and raises alarm', E("__sherwood.G.guards[3].state") != 'ko' and E("__sherwood.G.alarmed"), f'koT={kot:.0f}s')
    # carry + body discovery
    E("__sherwood.begin(0)"); notips(); pause()
    E("__sherwood.G.guards.forEach((g,i)=>{if(i!==3&&i!==2){g.x=-9999;g.y=-9999;g.route=[{x:-9999,y:-9999,wait:0}]}})")
    E("(()=>{const g=__sherwood.G.guards[2];g.x=-9999;g.y=-9999;g.route=[{x:-9999,y:-9999,wait:0}]})()")
    E("__sherwood.tp('john',16,6); __sherwood.order('john','ko',3); __sherwood.step(1.2); __sherwood.order('john','carry',3); __sherwood.step(1.5)")
    ok('John carries a body', E("__sherwood.G.guards[3].carried && __sherwood.hero('john').carry===__sherwood.G.guards[3]"))
    E("__sherwood.select('john'); __sherwood.center(20,7)")
    tap_tile(20, 7); E("__sherwood.step(4)")
    E("__sherwood.RH.game.drop(__sherwood.hero('john'))")
    ok('body dropped in bush', not E("__sherwood.G.guards[3].carried") and E("__sherwood.RH.hideAt(__sherwood.G.grid,__sherwood.G.guards[3].x,__sherwood.G.guards[3].y)") == 1)
    # bring a guard to look at an exposed body
    E("""(()=>{const G=__sherwood.G,b=G.guards[3];b.x=(14+.5)*32;b.y=(6+.5)*32;const g=G.guards[2];g.x=(17+.5)*32;g.y=(6+.5)*32;
       g.route=[{tx:17,ty:6,x:g.x,y:g.y,wait:0}];g.looks=[Math.PI];g.dir=Math.PI;g.faceTo=g.dir;__sherwood.tp('john',3,16);})()""")
    E("__sherwood.step(1)")
    ok('body in view raises the alarm', E("__sherwood.G.alarmed && __sherwood.G.guards[3].found"))

    # --- Abilities
    E("__sherwood.begin(3)"); notips(); pause()
    E("__sherwood.G.cart.state='stopped'")
    E("""(()=>{const G=__sherwood.G;const g=G.guards[3];g.looks=[0];g.dir=0;g.faceTo=0;})()""")  # lookout faces east
    E("__sherwood.tp('marian',13,20)")
    E("__sherwood.order('marian','charm',3); __sherwood.step(0.5)")
    ok('Marian charms a guard', E("__sherwood.G.guards[3].state") == 'charmed')
    E("__sherwood.step(1.5)")
    ok('charmed guard ignores Marian', E("__sherwood.G.guards[3].state") == 'charmed' and not E("__sherwood.G.stats.spotted"))
    E("__sherwood.tp('scarlet',16,20); __sherwood.RH.game.groundAbility('purse',(16.5)*32,(24.5)*32); __sherwood.step(1)")
    E("(()=>{const G=__sherwood.G;const g=G.guards[4];g.x=(15.5)*32;g.y=(23.5)*32;g.state='patrol';})()")
    E("__sherwood.tp('scarlet',16,18); __sherwood.RH.game.groundAbility('purse',(15.5)*32,(25.5)*32); __sherwood.step(1.2)")
    ok('purse lures a guard', E("['lured','counting'].includes(__sherwood.G.guards[4].state)"), E("__sherwood.G.guards[4].state"))
    E("__sherwood.tp('tuck',13,18); __sherwood.RH.game.groundAbility('hive',(15.5)*32,(23.5)*32); __sherwood.step(1.2)")
    ok('beehive stuns guards', E("__sherwood.G.guards[4].state") == 'stunned', E("__sherwood.G.guards[4].state"))
    arrows0 = E("__sherwood.G.inv.arrows")
    E("__sherwood.tp('robin',10,21); __sherwood.order('robin','shoot',4); __sherwood.step(2)")
    ok('Robin shoots an arrow', E("__sherwood.G.inv.arrows") == arrows0 - 1 and E("__sherwood.G.guards[4].state") in ('dead', 'alert'), E("__sherwood.G.guards[4].state"))
    # combat + Tuck revive
    E("__sherwood.begin(3)"); notips(); pause()
    E("__sherwood.G.cart.state='stopped'")
    E("(()=>{const h=__sherwood.hero('scarlet');h.hp=1;})()")
    E("(()=>{const G=__sherwood.G;const g=G.guards[3];__sherwood.tp('scarlet',11,21);__sherwood.RH.game.spot(g,__sherwood.hero('scarlet'));})()")
    E("__sherwood.step(3)")
    ok('alerted guard fights; hero can be knocked down', E("__sherwood.hero('scarlet').down"))
    E("__sherwood.tp('tuck',12,21); __sherwood.RH.game.orderAction('heal',{kind:'hero',e:__sherwood.hero('scarlet')},[__sherwood.hero('tuck')]); __sherwood.step(0.3)")
    E("(()=>{const G=__sherwood.G;const g=G.guards[3];G.guards.forEach(x=>{if(x.state==='alert'){x.hp=0;x.state='ko';x.koT=99;x.tied=true}})})()")
    E("__sherwood.step(2)")
    ok('Tuck revives a fallen friend', not E("__sherwood.hero('scarlet').down"))
    E("__sherwood.begin(3)"); notips(); pause()
    E("__sherwood.G.cart.state='stopped'")
    E("(()=>{const G=__sherwood.G;const g=G.guards[3];g.hp=4;__sherwood.tp('john',11,21);__sherwood.tp('robin',10,21);__sherwood.RH.game.spot(g,__sherwood.hero('john'));})()")
    E("__sherwood.order('john','attack',3); __sherwood.step(6)")
    ok('sword/staff fight defeats a guard', E("__sherwood.G.guards[3].state") in ('ko', 'dead'), E("__sherwood.G.guards[3].state"))

    # --- Loss when spotted in the alarm-fail mission (castle)
    E("__sherwood.begin(2)"); notips()
    E("__sherwood.G.paused=false")
    E("(()=>{const g=__sherwood.G.guards[3];__sherwood.tp('robin',Math.floor(g.x/32)+Math.round(Math.cos(g.dir)*2),Math.floor(g.y/32)+Math.round(Math.sin(g.dir)*2));__sherwood.center(Math.floor(g.x/32),Math.floor(g.y/32));})()")
    pg.wait_for_timeout(700)
    pg.screenshot(path=f'shots/{tag}_05_m3_spotted.png')
    E("__sherwood.G.paused=true; __sherwood.step(4)")
    pg.wait_for_timeout(1300)
    lost = E("__sherwood.G.over && !__sherwood.G.over.win")
    ok('spotted in castle -> mission failed', lost, str(E("__sherwood.G.over && __sherwood.G.over.reason")))
    pg.screenshot(path=f'shots/{tag}_06_fail.png')
    # Convoy escape loss
    E("__sherwood.begin(3)"); notips(); pause()
    E("__sherwood.step(200)")
    ok('convoy escaping -> mission failed', E("__sherwood.G.over && !__sherwood.G.over.win && /cart/.test(__sherwood.G.over.reason)"))

    # --- Win every mission (guards neutralised through the real knockOut/tie path, objectives via real orders + pathing)
    NEUTRAL = "(()=>{const G=__sherwood.G,RH=__sherwood.RH;G.guards.forEach(g=>{if(g.sheriff)return;RH.game.knockOut(g,999);g.tied=true;});})()"
    def go_exit(timeout=120):
        E("(()=>{const G=__sherwood.G;const e=G.exit;G.sel=G.heroes.filter(h=>!h.down);__sherwood.RH.game.moveSel((e.x+e.w/2)*32,(e.y+e.h/2)*32);})()")
        return E(f"(()=>{{let t=0;while(!__sherwood.G.over&&t<{timeout}){{__sherwood.step(0.5);t+=0.5}}return t}})()")
    def wait_until(expr, timeout=60):
        return E(f"(()=>{{let t=0;while(!({expr})&&t<{timeout}){{__sherwood.step(0.25);t+=0.25}}return t}})()")
    for mi in range(5):
        E(f"__sherwood.begin({mi})"); notips(); pause()
        E(NEUTRAL)
        mid = E("__sherwood.G.m.id")
        if mid in ('m1', 'm3'):
            E("(()=>{const G=__sherwood.G;const r=G.heroes[0];r.task={type:'free',t:0};})()")
            wait_until("__sherwood.G.prisoner.freed", 90)
            ok(f'{mid}: prisoner freed by walking there', E("__sherwood.G.prisoner.freed"))
        if mid in ('m2', 'm5'):
            E("(()=>{const G=__sherwood.G;const h=G.heroes.find(x=>x.key==='john');__sherwood.RH.game.orderAction('loot',{kind:'chest',e:G.chest},[h]);})()")
            wait_until("__sherwood.G.chest.taken", 120)
            ok(f'{mid}: chest picked up', E("__sherwood.G.chest.taken"))
        if mid == 'm4':
            E("__sherwood.step(8)")
            E("(()=>{const G=__sherwood.G;const c=G.cart.carter;__sherwood.RH.game.orderAction('ko',{kind:'carter',e:c},[G.heroes.find(x=>x.key==='john')]);})()")
            wait_until("__sherwood.G.cart.carter.state!=='ok'", 60)
            ok('m4: carter knocked out, cart stops', E("__sherwood.G.cart.state") == 'stopped')
            E("(()=>{const G=__sherwood.G;__sherwood.RH.game.orderAction('loot',{kind:'cart',e:G.cart},[G.heroes.find(x=>x.key==='john')]);})()")
            wait_until("__sherwood.G.chest.taken", 60)
            ok('m4: chest taken from cart', E("__sherwood.G.chest.taken"))
        if mid == 'm5':
            E("(()=>{const G=__sherwood.G;const s=G.sheriff;__sherwood.tp('scarlet',14,2);s.dir=Math.PI/2;s.looks=[Math.PI/2];__sherwood.RH.game.orderAction('ko',{kind:'guard',e:s},[__sherwood.hero('scarlet')]);})()")
            wait_until("__sherwood.G.sheriff.state==='ko'", 20)
            E("(()=>{const G=__sherwood.G;__sherwood.RH.game.orderAction('tie',{kind:'body',e:G.sheriff},[__sherwood.hero('scarlet')]);})()")
            wait_until("__sherwood.G.sheriff.tied", 20)
            ok('m5: Sheriff captured', E("__sherwood.G.sheriff.tied"))
        t = go_exit()
        won = E("__sherwood.G.over && __sherwood.G.over.win")
        ok(f'{mid}: mission won', won, f'exit walk {t}s, over={E("__sherwood.G.over && (__sherwood.G.over.reason||__sherwood.G.over.stars)")}')
        pg.wait_for_timeout(1000)
        if mi == 0: pg.screenshot(path=f'shots/{tag}_07_win.png')
        ok(f'{mid}: progress saved', E(f"JSON.parse(__sherwood.save()).unlocked") >= min(5, mi + 2) and E(f"JSON.parse(__sherwood.save()).stars[{mi}]") >= 1)

    # --- Save/load: reload, continue, camp shows unlocked missions; buy an item
    pg.reload(); pg.wait_for_timeout(800)
    ok('title offers Continue after reload', pg.locator('[data-act=continue]').count() == 1)
    tap_el('[data-act=continue]')
    ok('camp hub shown', E("__sherwood.screen()") == 'camp')
    gold0 = E("__sherwood.profile().gold")
    pg.screenshot(path=f'shots/{tag}_08_camp.png', full_page=False)
    tap_el('[data-act=buy][data-arg=arrows]')
    gold1 = E("__sherwood.profile().gold")
    pg.reload(); pg.wait_for_timeout(600)
    ok('shop purchase persists', gold1 == gold0 - 15 and E("JSON.parse(__sherwood.save()).gold") == gold1, f'{gold0}->{gold1}')
    ok('all 5 missions unlocked', E("JSON.parse(__sherwood.save()).unlocked") == 5)

    # --- Pause menu via real tap
    E("__sherwood.begin(0)")
    pg.wait_for_timeout(300)
    tap_el('#tipok')
    tap_el('#btnPause')
    ok('pause menu opens', E("__sherwood.screen()") == 'pause' and E("__sherwood.G.paused"))
    pg.screenshot(path=f'shots/{tag}_09_pause.png')
    tap_el('[data-act=resume]')
    ok('resume', E("__sherwood.screen()") is None and not E("__sherwood.G.paused"))
    # long press context menu on a guard
    E("__sherwood.G.paused=true; __sherwood.G.tipList=[]; __sherwood.select('john')")
    E("(()=>{const g=__sherwood.G.guards[0];__sherwood.G.cam.x=g.x;__sherwood.G.cam.y=g.y;})()")
    s = E("(()=>{const g=__sherwood.G.guards[0];return __sherwood.worldToScreen(g.x,g.y-10)})()")
    cdp = None
    if engine == 'chromium':
        cdp = ctx.new_cdp_session(pg)
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': s['x'], 'y': s['y']}]})
        pg.wait_for_timeout(650)
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
    else:
        E(f"__sherwood.RH.ui.handleLong({s['x']},{s['y']})")
    pg.wait_for_timeout(200)
    ok('long-press opens context menu', pg.locator('#ctxmenu:not(.hidden) button').count() >= 2)
    pg.screenshot(path=f'shots/{tag}_10_ctx.png')
    # drag pans the camera
    cx0 = E("__sherwood.G.cam.y")
    if cdp:
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': 200, 'y': 500}]})
        for k in range(1, 8):
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': 200, 'y': 500 - k * 20}]})
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
        pg.wait_for_timeout(100)
        ok('one-finger drag pans camera', abs(E("__sherwood.G.cam.y") - cx0) > 30)
        z0 = E("__sherwood.G.cam.z")
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': 150, 'y': 450, 'id': 1}, {'x': 250, 'y': 450, 'id': 2}]})
        for k in range(1, 8):
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': 150 - k * 10, 'y': 450, 'id': 1}, {'x': 250 + k * 10, 'y': 450, 'id': 2}]})
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
        pg.wait_for_timeout(100)
        ok('pinch zooms', E("__sherwood.G.cam.z") > z0 * 1.2, f'{z0:.2f}->{E("__sherwood.G.cam.z"):.2f}')
    ok('no console/page errors', len(errs) == 0, '; '.join(errs[:5]))
    b.close()
fails = [r for r in results if not r[1]]
print(f'\n{engine} {W}x{H}: {len(results) - len(fails)}/{len(results)} passed')
json.dump({'engine': engine, 'w': W, 'h': H, 'results': results, 'errors': errs}, open(f'tests/result_{tag}.json', 'w'))
