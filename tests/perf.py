import json, sys
from playwright.sync_api import sync_playwright
URL='http://localhost:18431/index.html'
out={}
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox','--enable-gpu-rasterization','--ignore-gpu-blocklist'])
    ctx=b.new_context(viewport={'width':390,'height':844}, device_scale_factor=3, has_touch=True, is_mobile=True)
    pg=ctx.new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL); pg.wait_for_timeout(500)
    cdp=ctx.new_cdp_session(pg)
    for rate in ((1,4) if len(sys.argv)<2 else (4,)):
        cdp.send('Emulation.setCPUThrottlingRate', {'rate': rate})
        for mi,cam in ((1,(13,12)),(2,(13,10)),(4,(14,12))) if len(sys.argv)<2 else ((2,(13,10)),(4,(14,12))):
            pg.evaluate(f"__sherwood.begin({mi}); __sherwood.G.tipList=[]; __sherwood.RH.ui.closeTip(); __sherwood.center({cam[0]},{cam[1]}); __sherwood.G.cam.z=1.0;")
            pg.wait_for_timeout(800)
            pg.evaluate("__sherwood.resetPerf()")
            pg.wait_for_timeout(5000)
            r=pg.evaluate("__sherwood.perf()")
            out[f'x{rate}_m{mi+1}']={k:round(v,2) for k,v in r.items()}
            print(rate, mi+1, out[f'x{rate}_m{mi+1}'], flush=True)
    print('errors', errs)
    b.close()
json.dump(out, open('tests/perf.json','w'), indent=1)
