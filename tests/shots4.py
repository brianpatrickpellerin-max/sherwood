# v4 feature screenshots at phone size. Usage: shots4.py [chromium|webkit]
import sys, os
from playwright.sync_api import sync_playwright
URL = os.environ.get('URL', 'http://localhost:18431/index.html')
eng = sys.argv[1] if len(sys.argv) > 1 else 'webkit'
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox']) if eng == 'chromium' else p.webkit.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, is_mobile=(eng == 'chromium'))
    pg = ctx.new_page()
    pg.on('console', lambda m: errs.append('console:' + m.text) if m.type == 'error' else None)
    pg.on('pageerror', lambda e: errs.append('pageerror:' + str(e)))
    pg.goto(URL); pg.wait_for_timeout(800)
    pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(800)
    pg.add_script_tag(path='tests/solver.js'); pg.add_script_tag(path='tests/mech.js')
    E = pg.evaluate
    pre = """const S=__sherwood, RH=S.RH, game=RH.game, T=RH.TILE; RH.profile.heroes=['robin','john','marian','tuck','scarlet']; RH.profile.seen=Object.assign(RH.profile.seen||{}, {duel:1});
      const B=(id)=>{ S.begin(RH.MISSIONS.findIndex(m=>m.id===id), []); const G=S.G; G.tipList=[]; RH.ui.closeTip(); G.paused=true; return G; };
      const cam=(x,y,z)=>{ S.G.cam.z=z||S.G.cam.z; RH.main.centerOn(x,y); };"""
    def shot(name, js, wait=500):
        E("(() => {" + pre + js + "})()")
        pg.wait_for_timeout(wait)
        if pg.locator('#tipok').is_visible(): pg.locator('#tipok').click(); pg.wait_for_timeout(200)
        pg.screenshot(path=f'shots4/{eng[0]}_{name}.png'); print('shot', name, flush=True)
    # 1: green sweeping cones, one flashing red on alert; minimap dots
    shot('cones', """const G=B('m8'); __step(2.5); const gs=G.guards.filter(g=>game.isActive(g));
      let best=null, bn=-1; for (const g of gs) { const n=gs.filter(o=>Math.hypot(o.x-g.x,o.y-g.y)<7*T).length; if (n>bn) { bn=n; best=g; } }
      const near=gs.filter(o=>o!==best && Math.hypot(o.x-best.x,o.y-best.y)<7*T);
      const h=G.heroes[0]; const al=near[0]||best; al.state='alert'; al.target=h; al.icon='!'; al.iconT=99; al.sus=1;
      cam(best.x,best.y,1.15);""", 900)
    # 2: houses: two hiding inside (roof faded), body count on the door, Robin on the roof by the ivy
    shot('houses', """const G=B('m8'); G.guards.forEach(g=>{ if (Math.random()<0.7) { g.x=-9999; g.y=-9999; g.state='ko'; g.tied=true; g.koT=999; g.found=true; } });
      let iv=null, hs=null, bd=1e9; for (const v of G.ivy) for (const q of G.houses) { if (q===v.house||!q.door) continue; const d=Math.hypot(q.cx-v.x,q.cy-v.y); if (d<bd) { bd=d; iv=v; hs=q; } }
      const by=(k)=>G.heroes.find(q=>q.key===k)||G.heroes[0];
      for (const k of ['john','tuck']) { const h=by(k); h.x=hs.door.x; h.y=hs.door.y; h.inside=hs; }
      hs.bodies=2;
      const r=by('robin'); r.x=iv.x; r.y=iv.y; r.task=null; game.orderAction('roof',{kind:'ivy',e:iv},[r]); __step(2.5);
      const rx=iv.house.x+Math.floor(iv.house.w/2), ry=iv.house.y+Math.floor(iv.house.h/2); RH.game.moveSel; G.sel=[r]; game.moveSel((rx+.5)*T,(ry+.5)*T); __step(0.6);
      const m=by('scarlet'); m.x=iv.x+T*0.6; m.y=iv.y+T*0.4; G.sel=[r];
      cam((hs.cx+iv.x)/2,(hs.cy+iv.y)/2,1.35);""", 900)
    # 3: ambush: snare hoists two guards, robbed wagon spills its silver
    shot('ambush', """S.begin({type:'ambush',kind:'wagon',seed:4},[]); const G=S.G; G.tipList=[]; RH.ui.closeTip(); G.paused=true;
      const gs=G.guards.filter(g=>g.type!=='collector'); const c=G.cart; c.carter.state='ko';
      const sn={x:c.x+T*2.2,y:c.y-T*1.5,armed:true}; G.snares.push(sn); gs[0].x=sn.x; gs[0].y=sn.y; gs[1].x=sn.x+T*0.7; gs[1].y=sn.y+T*0.4; game.springSnare(sn);
      for (const g of gs.slice(2)) { game.knockOut(g, 60); }
      const h=G.heroes[0]; h.x=c.x-T*1.4; h.y=c.y+T*0.6; game.orderAction('loot',{kind:'cart',e:c},[h]); __step(2.2);
      const j=G.heroes[1]; j.x=c.x+T*0.4; j.y=c.y+T*1.8; G.sel=[h];
      cam(c.x+T*0.6,c.y-T*0.2,1.5);""", 900)
    # 4: boss duel: arrow prompt
    shot('duel', """const G=B('m8'); const boss=G.boss; const h=G.heroes.find(q=>q.key==='robin');
      G.guards.forEach(g=>{ if (g!==boss && Math.hypot(g.x-boss.x,g.y-boss.y)<5*T) { game.knockOut(g, 999); g.tied=true; } });
      h.x=boss.x-T*0.75; h.y=boss.y+T*0.1; boss.leash=null; game.spot(boss,h,true); boss.atkCd=0; const s=G.heroes.find(q=>q.key==='scarlet'); if (s){ s.x=boss.x+T*0.5; s.y=boss.y+T*0.9; }
      for (let i=0;i<60 && !(boss.duel && boss.duel.t<0.8);i++){ __step(1/30); h.hp=h.maxhp; }
      G.sel=[h]; cam(boss.x,boss.y,1.9);""", 700)
    # 5: bees panic + purse brawl + shake awake
    shot('panic', """const G=B('m8'); const h=G.heroes[0]; const gs=G.guards.filter(g=>game.isActive(g)).sort((a,b)=>Math.hypot(a.x-h.x,a.y-h.y)-Math.hypot(b.x-h.x,b.y-h.y));
      const a=gs[0], b=gs[1], c=gs[2];
      G.swarms.push({x:a.x,y:a.y,t:9,r:2.3*T}); __step(1.0);
      cam(a.x,a.y,1.5);""", 900)
    # 6: end of mission stats
    E("(() => {" + pre + "const G=B('m1'); G.paused=true; window.__godmode=true; __solve(45); })()")
    pg.wait_for_function("__sherwood.screen() == 'end'", timeout=8000); pg.wait_for_timeout(600)
    pg.screenshot(path=f'shots4/{eng[0]}_end.png'); print('shot end')
    print('errors', errs)
    b.close()
