from playwright.sync_api import sync_playwright
import sys
URL='http://localhost:18431/index.html'
with sync_playwright() as p:
    for eng in ('webkit',):
        b = p.webkit.launch()
        for (w,h) in ((375,667),(844,390),(667,375)):
            ctx=b.new_context(viewport={'width':w,'height':h}, device_scale_factor=2, has_touch=True)
            pg=ctx.new_page(); errs=[]
            pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.goto(URL); pg.wait_for_timeout(500)
            pg.screenshot(path=f'shots/_L{w}x{h}_title.png')
            for mi in (0,3):
                pg.evaluate(f"__sherwood.begin({mi})"); pg.wait_for_timeout(900)
                pg.screenshot(path=f'shots/_L{w}x{h}_m{mi+1}.png')
            pg.evaluate("__sherwood.RH.main.toCamp()"); pg.wait_for_timeout(300)
            pg.screenshot(path=f'shots/_L{w}x{h}_camp.png')
            # check all buttons within viewport and >=44px
            bad = pg.evaluate("""(()=>{__sherwood.begin(3);const out=[];document.querySelectorAll('#hud button').forEach(b=>{const r=b.getBoundingClientRect();if(r.width===0)return;if(r.width<44||r.height<44)out.push('small:'+b.id+b.className+':'+r.width+'x'+r.height);if(r.left<0||r.top<0||r.right>innerWidth||r.bottom>innerHeight)out.push('offscreen:'+(b.id||b.className)+':'+Math.round(r.left)+','+Math.round(r.top)+','+Math.round(r.right)+','+Math.round(r.bottom));});return out})()""")
            print(w,h,'errors',errs,'bad',bad)
            ctx.close()
        b.close()
