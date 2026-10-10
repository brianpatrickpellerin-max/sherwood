# Tree mechanics: a chasing guard loses a hero who hides in a tree; Robin drops from a tree onto a guard;
# Little John cannot climb.
import sys
from playwright.sync_api import sync_playwright
eng = sys.argv[1] if len(sys.argv) > 1 else 'chromium'
errs, fails = [], []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox']) if eng == 'chromium' else p.webkit.launch()
    pg = b.new_context(viewport={'width': 390, 'height': 844}, has_touch=True, service_workers='block').new_page()
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://localhost:18431/index.html'); pg.wait_for_timeout(800)
    E = pg.evaluate
    E("__sherwood.RH.profile.heroes=['robin','stutely','scarlet','john','marian','tuck']")
    def run(s):
        E(f"(()=>{{const S=__sherwood;for(let i=0;i<{int(s*30)};i++)S.RH.game.update(1/30);}})()")
    E("""(()=>{const S=__sherwood;S.begin(5);S.G.tipList=[];S.RH.ui.closeTip();const G=S.G,T=S.RH.TILE;
      const tr=G.trees[0];window._tr=tr;const r=G.heroes.find(h=>h.key==='robin');G.sel=[r];r.x=tr.stand.x;r.y=tr.stand.y;
      S.RH.game.orderAction('tree',{kind:'tree',e:tr},[r]);})()""")
    run(2)
    r = E("(()=>{const G=__sherwood.G;const r=G.heroes.find(h=>h.key==='robin');return !!r.tree})()")
    print('climbed', r); fails += [] if r else ['climb']
    # a guard who was chasing him
    E("""(()=>{const S=__sherwood,G=S.G,T=S.RH.TILE;const r=G.heroes.find(h=>h.key==='robin');const g=G.guards.find(g=>S.RH.game.isActive(g));window._g=g;
      g.x=_tr.stand.x+T*2;g.y=_tr.stand.y;g.state='alert';g.target=r;g.lostT=0;g.path=null;})()""")
    run(9)
    st = E("_g.state"); print('chaser after 9s:', st); fails += [] if st != 'alert' else ['lose track']
    # drop onto a guard under the tree
    E("""(()=>{const S=__sherwood,G=S.G;const r=G.heroes.find(h=>h.key==='robin');const g=_g;g.state='patrol';g.x=_tr.stand.x;g.y=_tr.stand.y;g.path=null;g.sus=0;
      S.RH.game.orderAction('ko',{kind:'guard',e:g},[r]);})()""")
    run(1.5)
    st = E("_g.state"); print('guard after drop:', st); fails += [] if st == 'ko' else ['drop']
    j = E("""(()=>{const S=__sherwood,G=S.G;const j=G.heroes.find(h=>h.key==='john');if(!j)return 'nojohn';return S.RH.game.orderAction('tree',{kind:'tree',e:G.trees[1]},[j])})()""")
    print('john can climb:', j); fails += [] if j in (False, 'nojohn') else ['john']
    print('errors', errs, 'FAILS', fails)
    b.close()
sys.exit(1 if fails or errs else 0)
