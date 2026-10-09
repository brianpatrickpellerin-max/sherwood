import sys, json
from playwright.sync_api import sync_playwright
URL='http://localhost:18431/index.html'
def run(engine='chromium', w=390, h=844, tag='c390'):
    errs=[]
    with sync_playwright() as p:
        if engine=='chromium':
            b=p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
        else:
            b=p.webkit.launch()
        ctx=b.new_context(viewport={'width':w,'height':h}, device_scale_factor=3, has_touch=True, is_mobile=(engine=='chromium'))
        pg=ctx.new_page()
        pg.on('console', lambda m: errs.append('console:'+m.text) if m.type=='error' else None)
        pg.on('pageerror', lambda e: errs.append('pageerror:'+str(e)))
        pg.goto(URL); pg.wait_for_timeout(800)
        pg.screenshot(path=f'shots/_{tag}_title.png')
        for i in range(5):
            pg.evaluate(f'__sherwood.begin({i})'); pg.wait_for_timeout(1200)
            pg.screenshot(path=f'shots/_{tag}_m{i+1}.png')
        print(engine, w, h, 'errors:', errs)
        b.close()
run(*(sys.argv[1:2] or ['chromium']))
