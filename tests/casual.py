# A careless phone player on mission 1: real touch taps, no sneaking, ignores hints.
# Usage: casual.py [chromium|webkit] [mission index] [runs]
import sys, os, json, random
from playwright.sync_api import sync_playwright
URL = os.environ.get('URL', 'http://localhost:18431/index.html')
eng = sys.argv[1] if len(sys.argv) > 1 else 'chromium'
MI = int(sys.argv[2]) if len(sys.argv) > 2 else 0
RUNS = int(sys.argv[3]) if len(sys.argv) > 3 else 2
STRATS = ['beeline', 'brawler', 'wander', 'afk', 'charge_gate']
errs = []; results = []
SAMPLE = """(() => { const G=__sherwood.G; if (!G.m) return null; const T=__sherwood.RH.TILE;
  const hs=G.heroes.map(h=>({k:h.key,hp:h.hp,down:h.down,x:h.x,y:h.y}));
  const al=G.guards.filter(g=>g.state==='alert'&&__sherwood.RH.game.isActive(g));
  const near=[]; for (const h of G.heroes) for (const g of al) if (Math.hypot(g.x-h.x,g.y-h.y)<1.3*T) near.push(g.type);
  return {t:G.time, hs, alert:al.length, melee:near, arrows:G.projs.filter(p=>p.kind==='garrow').length, over:G.over, spotted:G.stats.spotted, sus:Math.max(0,...G.guards.map(g=>g.sus||0)), screen:__sherwood.screen()}; })()"""
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox']) if eng == 'chromium' else p.webkit.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, is_mobile=(eng == 'chromium'), service_workers='block')
    pg = ctx.new_page()
    pg.on('console', lambda m: errs.append('console:' + m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append('pageerror:' + str(e)))
    pg.goto(URL); pg.wait_for_timeout(800)
    E = pg.evaluate
    def scr(wx, wy):
        return E(f"(() => {{ const t={{x:0,y:0}}; __sherwood.RH.render.toScreen({wx},{wy},t); return t; }})()")
    for run in range(RUNS):
        for strat in STRATS:
            rnd = random.Random(run * 31 + len(strat))
            E("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(700)
            E(f"__sherwood.begin({MI}, [])"); pg.wait_for_timeout(500)
            E("__sherwood.G.speed = 3")
            log = []; last = None; dmg = []; t_end = 150; first_spot = None
            for k in range(400):
                s = E(SAMPLE)
                if not s: break
                if s['spotted'] and first_spot is None: first_spot = round(s['t'], 1)
                if last:
                    for a, b2 in zip(last['hs'], s['hs']):
                        if b2['hp'] < a['hp']: dmg.append({'t': round(s['t'], 1), 'hero': a['k'], 'd': a['hp'] - b2['hp'], 'melee': s['melee'], 'alert': s['alert'], 'arrows': s['arrows']})
                last = s
                if s['over'] or s['t'] > t_end or s['screen'] == 'end': break
                # careless input
                if pg.locator('#tipok').is_visible() and rnd.random() < 0.5: pg.locator('#tipok').tap()
                G = E("(() => { const G=__sherwood.G, T=__sherwood.RH.TILE; const h=G.heroes.find(q=>!q.down)||G.heroes[0]; const gs=G.guards.filter(g=>__sherwood.RH.game.isActive(g)).map(g=>({x:g.x,y:g.y,d:Math.hypot(g.x-h.x,g.y-h.y)})).sort((a,b)=>a.d-b.d); const ct=G.contacts.find(c=>__sherwood.RH.game.visible(c)&&!c.met); return {h:{x:h.x,y:h.y}, g:gs[0]||null, goal: ct?{x:ct.x,y:ct.y}:(G.exitReady?{x:(G.exit.x+2)*T,y:(G.exit.y+1)*T}:null)}; })()")
                if strat == 'afk':
                    pass
                elif strat == 'beeline' and G['goal'] and k % 4 == 0:
                    # tap the screen in the direction of the goal (as far as is visible)
                    gx, gy = G['goal']['x'], G['goal']['y']; hx, hy = G['h']['x'], G['h']['y']
                    d = max(1, ((gx - hx) ** 2 + (gy - hy) ** 2) ** 0.5); st = min(d, 32 * 6)
                    E(f"__sherwood.RH.main.centerOn({hx},{hy})")
                    pt = scr(hx + (gx - hx) / d * st, hy + (gy - hy) / d * st)
                    if 90 < pt['y'] < 700: pg.touchscreen.tap(pt['x'], pt['y'])
                elif strat in ('brawler', 'charge_gate') and k % 3 == 0:
                    tgt = G['g'] if strat == 'brawler' else (G['g'] if G['g'] and G['g']['d'] < 32 * 5 else G['goal'])
                    if tgt:
                        hx, hy = G['h']['x'], G['h']['y']
                        E(f"__sherwood.RH.main.centerOn({(hx + tgt['x']) / 2},{(hy + tgt['y']) / 2})")
                        pt = scr(tgt['x'], tgt['y'] - 12)
                        if 90 < pt['y'] < 700: pg.touchscreen.tap(pt['x'] + rnd.uniform(-14, 14), pt['y'] + rnd.uniform(-14, 14))
                elif strat == 'wander' and k % 3 == 0:
                    pg.touchscreen.tap(rnd.uniform(20, 370), rnd.uniform(120, 680))
                pg.wait_for_timeout(120)
            s = E(SAMPLE) or {}
            over = s.get('over') or {}
            r = {'strat': strat, 'run': run, 'died': bool(over and not over.get('win')), 'win': bool(over and over.get('win')), 'reason': over.get('reason') if over else None,
                 't': round(s.get('t', 0), 1), 'first_spotted': first_spot, 'hp': [h['hp'] for h in s.get('hs', [])], 'hits': len(dmg), 'melee_types': sorted(set(sum([d['melee'] for d in dmg], []))), 'arrow_hits': sum(1 for d in dmg if d['arrows'] and not d['melee']), 'max_alert': max([d['alert'] for d in dmg] or [0])}
            results.append(r); print(json.dumps(r), flush=True)
    b.close()
print('SUMMARY deaths', sum(r['died'] for r in results), '/', len(results), 'errors', errs[:5])
json.dump(results, open(f'tests/casual_{eng[0]}_m{MI}.json', 'w'), indent=1)
