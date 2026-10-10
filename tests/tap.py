# Real touch taps at 390x844: plain taps walk the selected hero (incl. finger jitter in Chromium), taps on walls
# walk to the nearest reachable spot, and a big tree can be climbed, hides the hero, and tapping ground climbs down.
import sys, json
from playwright.sync_api import sync_playwright
eng = sys.argv[1] if len(sys.argv) > 1 else 'chromium'
MIS = [int(x) for x in (sys.argv[2] if len(sys.argv) > 2 else '0,1,2,4,5,7,10').split(',')]
import os
URL = os.environ.get('LIVE', 'http://localhost:18431/index.html')
fails, errs = [], []
def ok(c, m):
    print(('PASS ' if c else 'FAIL ') + m, flush=True)
    if not c: fails.append(m)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox']) if eng == 'chromium' else p.webkit.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, is_mobile=(eng == 'chromium'), service_workers='block')
    pg = ctx.new_page()
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL); pg.wait_for_timeout(900)
    cdp = ctx.new_cdp_session(pg) if eng == 'chromium' else None
    E = lambda s: pg.evaluate(s)
    def tap(x, y, jitter=0):
        if cdp and jitter:
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y}]})
            pg.wait_for_timeout(60)
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x + jitter, 'y': y - jitter * 0.6}]})
            pg.wait_for_timeout(60)
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
        else: pg.touchscreen.tap(x, y)
    if '--calm' in sys.argv: E('window.CALM=1')
    E("__sherwood.RH.profile.heroes=['robin','stutely','scarlet','john','marian','tuck']")
    # find, near the selected hero, an open ground tile with nothing on it, plus a wall tile, plus a climbable tree
    PICK = """(() => { const S = __sherwood, G = S.G, T = S.RH.TILE, g = G.grid; const h = G.sel[0];
      const hx = Math.floor(h.x / T), hy = Math.floor(h.y / T); const o = { h: [hx, hy] };
      const free = (x, y) => S.RH.isWalk(g, x, y) && !S.RH.game.entityAt(x * T + 16, y * T + 16, 40) && !G.heroes.some((q) => Math.hypot(q.x - x * T - 16, q.y - y * T - 16) < 40);
      let best = null;
      for (let r = 3; r <= 6 && !best; r++) for (let dy = -r; dy <= r && !best; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue; const x = hx + dx, y = hy + dy; if (!free(x, y) || !S.RH.astar(g, hx, hy, x, y)) continue;
        const p = {}; S.RH.render.toScreen(x * T + 16, y * T + 16, p); if (p.y < 190 || p.y > 600 || p.x < 40 || p.x > 350) continue; best = [x, y, p.x, p.y]; break; }
      o.walk = best;
      let wall = null;
      for (let r = 2; r <= 8 && !wall; r++) for (let dy = -r; dy <= r && !wall; dy++) for (let dx = -r; dx <= r; dx++) {
        const x = hx + dx, y = hy + dy; if (x < 0 || y < 0 || x >= g.w || y >= g.h) continue; const c = g.ch[y * g.w + x]; if (c !== '#' && c !== 'w') continue;
        if (S.RH.game.entityAt(x * T + 16, y * T + 16, 40)) continue;
        const p = {}; S.RH.render.toScreen(x * T + 16, y * T + 16, p); if (p.y < 190 || p.y > 600 || p.x < 40 || p.x > 350) continue; wall = [x, y, p.x, p.y]; break; }
      o.wall = wall;
      const trs = (G.trees || []).slice().sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y));
      for (const t of trs) { const p = {}; S.RH.render.toScreen(t.x - 40, t.y - 40, p); p.y -= 0; if (p.y < 190 || p.y > 600 || p.x < 40 || p.x > 350) continue;
        if (S.RH.ui._heroAtScreen(p.x, p.y)) continue; if (!(t.stands || [t.stand]).some((q) => S.RH.astar(g, hx, hy, Math.floor(q.x / T), Math.floor(q.y / T)))) continue; const hit = S.RH.game.entityAt(t.x - 40, t.y - 40, 27); if (!hit || hit.kind !== 'tree') continue; o.tree = [t.tx, t.ty, p.x, p.y, t.id]; break; }
      o.nTrees = (G.trees || []).length; return o; })()"""
    for mi in MIS:
        E(f"(()=>{{const S=__sherwood;S.begin({mi});S.G.tipList=[];S.RH.ui.closeTip();const G=S.G;const h=G.heroes.find(x=>S.RH.game.AGILE(x))||G.heroes[0];G.sel=[h];S.RH.ui.refresh(true);S.RH.main.centerOn(h.x,h.y);if(window.CALM)for(const g of G.guards){{g.state='ko';g.koT=1e9;g.tied=true;g.x=-999;g.y=-999;}}}})()")
        pg.wait_for_timeout(500)
        o = E(PICK); tag = f'[{eng} m{mi+1}]'
        if o['walk']:
            x, y, sx, sy = o['walk']
            tap(sx, sy, jitter=9 if cdp else 0); pg.wait_for_timeout(2600)
            d = E(f"(()=>{{const h=__sherwood.G.sel[0],T=__sherwood.RH.TILE;return Math.hypot(h.x-({x}*T+16),h.y-({y}*T+16))/T}})()")
            ok(d < 1.6, f'{tag} tap ground{" (9px jitter)" if cdp else ""} -> walked to {x},{y} (left {d:.1f} tiles)')
            mk = E("__sherwood.G.fx.some(f=>f.type==='marker')||true")
        else: print('skip walk', tag)
        if o['wall']:
            E("(()=>{const S=__sherwood,h=S.G.sel[0];S.RH.main.centerOn(h.x,h.y)})()"); pg.wait_for_timeout(200)
            o = E(PICK)
        if o['wall']:
            x, y, sx, sy = o['wall']
            tap(sx, sy); pg.wait_for_timeout(300)
            mv = E("(()=>{const h=__sherwood.G.sel[0];return !!(h.task&&h.task.type==='move'&&h.path)})()")
            ok(mv, f'{tag} tap on wall/water {x},{y} -> walks to nearest reachable spot')
            pg.wait_for_timeout(2500)
        E("(()=>{const S=__sherwood,h=S.G.sel[0];S.RH.main.centerOn(h.x,h.y)})()"); pg.wait_for_timeout(200)
        o = E(PICK)
        if not o.get('tree'):  # walk-over shortcut: put the hero beside the nearest big tree he could reach
            E("(()=>{const S=__sherwood,G=S.G,h=G.sel[0];const t=(G.trees||[]).filter(t=>(t.stands||[t.stand]).some(q=>S.RH.astar(G.grid,Math.floor(h.x/32),Math.floor(h.y/32),Math.floor(q.x/32),Math.floor(q.y/32)))).sort((a,b)=>Math.hypot(a.x-h.x,a.y-h.y)-Math.hypot(b.x-h.x,b.y-h.y))[0];if(!t)return;h.x=t.stand.x+40;h.y=t.stand.y+40;if(!S.RH.isWalk(G.grid,Math.floor(h.x/32),Math.floor(h.y/32))){h.x=t.stand.x;h.y=t.stand.y;}S.RH.main.centerOn(h.x,h.y)})()"); pg.wait_for_timeout(300)
            o = E(PICK)
        if o.get('tree'):
            tx, ty, sx, sy, tid = o['tree']
            tap(sx, sy); pg.wait_for_timeout(6000)
            st = E("(()=>{const G=__sherwood.G,h=G.sel[0];return {tree:h.tree&&h.tree.id, hid:__sherwood.RH.game.treeHidden(h), going:!!(h.task&&h.task.type==='tree')}})()")
            if st['going'] and not st['tree']: pg.wait_for_timeout(8000); st = E("(()=>{const G=__sherwood.G,h=G.sel[0];return {tree:h.tree&&h.tree.id, hid:__sherwood.RH.game.treeHidden(h), going:!!(h.task&&h.task.type==='tree'),hp:h.hp,down:h.down,pos:[h.x/32,h.y/32],alerts:G.guards.filter(g=>g.state==='alert').length}})()")
            ok(st['tree'] == tid, f'{tag} tap big tree {tx},{ty} -> climbed it ({st})')
            if st['tree']:
                pg.wait_for_timeout(2500)
                seen = E("(()=>{const G=__sherwood.G,h=G.sel[0];return __sherwood.RH.game.treeHidden(h) && !G.guards.some(g=>g.seeing===h)})()")
                ok(seen, f'{tag} hero in the tree is hidden from guards')
                pg.screenshot(path=f'shots9/tap_{eng[0]}_m{mi+1}_tree.png')
                o2 = E(PICK)
                if o2['walk']:
                    x, y, sx, sy = o2['walk']; tap(sx, sy); pg.wait_for_timeout(4500)
                    st = E(f"(()=>{{const h=__sherwood.G.sel[0],T=__sherwood.RH.TILE;return {{tree:!!h.tree,d:Math.hypot(h.x-({x}*T+16),h.y-({y}*T+16))/T,walking:!!(h.task&&h.task.type==='move'&&h.path),task:h.task&&h.task.type,hp:h.hp,down:h.down,alerts:__sherwood.G.guards.filter(g=>g.state==='alert').length,pos:[h.x/T,h.y/T],tgt:[{x},{y}]}}}})()")
                    ok(not st['tree'] and (st['d'] < 1.6 or st['walking']), f'{tag} tap ground from the tree -> climbs down and walks ({st})')
        else: print(f'{tag} no reachable big tree on screen (trees={o["nTrees"]})')
    # jitter just past the slop pans the camera instead of walking
    if cdp:
        E("(()=>{const S=__sherwood;S.begin(1);S.G.tipList=[];S.RH.ui.closeTip();})()"); pg.wait_for_timeout(400)
        c0 = E("[__sherwood.G.cam.x,__sherwood.G.cam.y]")
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': 200, 'y': 400}]})
        for k in range(1, 8): cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': 200 + k * 10, 'y': 400 + k * 6}]}); pg.wait_for_timeout(16)
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []}); pg.wait_for_timeout(200)
        c1 = E("[__sherwood.G.cam.x,__sherwood.G.cam.y]"); mv = E("__sherwood.G.sel.some(h=>h.task&&h.task.type==='move')")
        ok(abs(c1[0] - c0[0]) + abs(c1[1] - c0[1]) > 30 and not mv, f'[{eng}] a 70px drag pans the camera and does not walk')
    print('errors', errs[:5]); print('FAILS', len(fails))
    b.close()
sys.exit(1 if fails else 0)
