from playwright.sync_api import sync_playwright
URL='http://localhost:18431/index.html'
with sync_playwright() as p:
    b=p.webkit.launch()
    ctx=b.new_context(viewport={'width':390,'height':844}, device_scale_factor=3, has_touch=True)
    pg=ctx.new_page(); errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL); pg.wait_for_timeout(500)
    E=pg.evaluate
    E("localStorage.clear()"); pg.reload(); pg.wait_for_timeout(500)
    pg.screenshot(path='shots/01_title.png')
    E("localStorage.setItem('sherwood.save.v1', JSON.stringify({v:1,gold:185,arrows:14,potions:2,up:{yew:true},unlocked:4,stars:[3,2,1,0,0],best:{},muted:true,started:true}))")
    pg.reload(); pg.wait_for_timeout(400)
    E("__sherwood.RH.ui.showCamp()"); pg.wait_for_timeout(400)
    pg.screenshot(path='shots/02_camp.png')
    def play(i, setup, cam, z, secs, name, tip=False):
        E(f"__sherwood.begin({i})")
        if not tip: E("__sherwood.G.tipList=[]; __sherwood.RH.ui.closeTip()")
        E(setup)
        E(f"__sherwood.center({cam[0]},{cam[1]}); __sherwood.G.cam.z={z}")
        pg.wait_for_timeout(int(secs*1000))
        pg.screenshot(path=f'shots/{name}.png')
    play(0, "__sherwood.tp('robin',16,17); __sherwood.tp('john',17,17); __sherwood.hero('robin').sneak=true; __sherwood.hero('john').sneak=true; __sherwood.select('robin','john'); __sherwood.RH.game.moveSel(15.5*32,12.5*32)", (13,11), 1.05, 2.2, '03_m1_woodcutters')
    play(1, "(()=>{const G=__sherwood.G;[2,3].forEach(i=>{const g=G.guards[i];g.x=(i===2?8.5:19.5)*32;g.y=20.5*32;g.route=[{tx:i===2?8:19,ty:20,x:g.x,y:g.y,wait:0}];});__sherwood.tp('marian',13,12);__sherwood.tp('robin',9,8);__sherwood.tp('john',8,9);__sherwood.hero('robin').sneak=true;__sherwood.hero('john').sneak=true;__sherwood.order('marian','charm',0);__sherwood.select('robin','john');__sherwood.RH.game.moveSel(12.5*32,8.5*32);})()", (12,8), 1.1, 1.6, '04_m2_market')
    play(2, "__sherwood.tp('robin',4,18); __sherwood.tp('john',5,18); __sherwood.tp('marian',3,18); __sherwood.hero('robin').sneak=true", (8,12), 1.0, 2.0, '05_m3_castle_night')
    play(3, "__sherwood.tp('robin',14,15); __sherwood.tp('scarlet',13,13); __sherwood.tp('john',17,17); __sherwood.tp('tuck',15,16); __sherwood.tp('marian',16,13); __sherwood.G.heroes.forEach(h=>h.sneak=true); __sherwood.select('scarlet'); __sherwood.step(17)", (11,15), 1.05, 0.6, '06_m4_forest_road')
    E("__sherwood.RH.ui.setMode('purse')"); pg.wait_for_timeout(500); pg.screenshot(path='shots/06_m4_forest_road.png')
    E("__sherwood.RH.ui.setMode(null)")
    play(4, "__sherwood.tp('robin',2,20); __sherwood.tp('john',4,20); __sherwood.tp('marian',7,22); __sherwood.tp('tuck',3,22); __sherwood.tp('scarlet',2,19); __sherwood.G.heroes.forEach(h=>h.sneak=true); __sherwood.select('scarlet'); __sherwood.RH.game.moveSel(2.5*32,17.5*32)", (6,15), 0.95, 1.8, '07_m5_sheriffs_keep')
    E("__sherwood.RH.ui.setMode(null)")
    # combat moment
    play(1, "(()=>{__sherwood.tp('robin',13,13);__sherwood.tp('john',12,13);__sherwood.tp('marian',14,14);const G=__sherwood.G;const g=G.guards[2];g.x=13.5*32;g.y=12.4*32;__sherwood.RH.game.spot(g,__sherwood.hero('robin'));__sherwood.order('john','attack',2);})()", (13,13), 1.4, 1.6, '08_combat_alert')
    # win screen
    E("__sherwood.begin(0)"); E("__sherwood.G.tipList=[]; __sherwood.RH.ui.closeTip(); __sherwood.G.paused=true")
    E("(()=>{const G=__sherwood.G;G.guards.slice(0,2).forEach(g=>{__sherwood.RH.game.knockOut(g,999);g.tied=true});__sherwood.RH.game.freePrisoner();G.stats.gold=35;G.time=212;G.heroes.forEach(h=>{h.x=12.5*32;h.y=26.5*32});})()")
    E("__sherwood.step(0.5)"); pg.wait_for_timeout(1500)
    pg.screenshot(path='shots/09_win.png')
    print('errors', errs)
    b.close()
