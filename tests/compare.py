# Side-by-side comparison sheet: reference (left) vs Outlaws of Sherwood (right).
# python compare.py  -> shots/cmp_*.png and shots/comparison_sheet.jpg
import time
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw, ImageFont
REF = '/workspace/rh_ref/'
W, H = 1024, 768
def setup(E, js):
    E("__sherwood.G.tipList=[];__sherwood.RH.ui.closeTip();__sherwood.G.paused=false;")
    if js: E(js)
shots = [
    # (name, mission, camera js, reference file, caption)
    ('town', 1, "__sherwood.center(13,13);__sherwood.G.cam.z=1.25;__sherwood.RH.main.clampCam()", 'steam_06.jpg', 'Town: half-timbered houses, red-brown tile roofs, mud & cobbles'),
    ('river', 3, "__sherwood.center(9,10);__sherwood.G.cam.z=1.2;__sherwood.RH.main.clampCam()", 'steam_07.jpg', 'Forest: big leafy autumn trees, paths, fallen oak'),
    ('castle', 4, "__sherwood.center(14,12);__sherwood.G.cam.z=1.1;__sherwood.RH.main.clampCam()", 'steam_01.jpg', 'Castle by night: crenellated walls, round towers, torch pools'),
    ('fort', 2, "__sherwood.center(13,9);__sherwood.G.cam.z=1.0;__sherwood.RH.main.clampCam()", 'steam_09.jpg', 'Stone castle yard and towers'),
    ('hud', 1, "__sherwood.center(14,22);__sherwood.G.cam.z=1.15;__sherwood.RH.main.clampCam()", 'yt_MMNo44vBdBo_max.jpg', 'HUD: parchment minimap + money, scroll portrait cards on ivy'),
]
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    pg = b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=1, has_touch=True).new_page()
    pg.goto('http://localhost:18431/index.html?' + str(time.time())); pg.wait_for_timeout(1800)
    pg.screenshot(path='shots/cmp_title.png')
    E = pg.evaluate
    for name, mi, js, ref, cap in shots:
        E(f"__sherwood.begin({mi})"); setup(E, js); pg.wait_for_timeout(900)
        pg.screenshot(path=f'shots/cmp_{name}.png')
    b.close()
rows = [('title', 'yt_MQPNgluXeO4_max.jpg', 'Title: painted castle town, ornate green logo')] + [(n, r, c) for n, _, _, r, c in shots]
CW, CH = 640, 480
sheet = Image.new('RGB', (CW * 2 + 30, (CH + 40) * len(rows) + 60), (24, 20, 14))
d = ImageDraw.Draw(sheet)
try:
    f = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf', 22); fs = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 17)
except Exception:
    f = fs = ImageFont.load_default()
d.text((10, 14), 'Reference: Robin Hood: The Legend of Sherwood (2002)', fill=(230, 210, 160), font=f)
d.text((CW + 30, 14), 'Ours: Outlaws of Sherwood (original art, procedural)', fill=(170, 230, 120), font=f)
def fit(im):
    im = im.convert('RGB'); r = max(CW / im.width, CH / im.height)
    im = im.resize((int(im.width * r + 0.5), int(im.height * r + 0.5)), Image.LANCZOS)
    x, y = (im.width - CW) // 2, (im.height - CH) // 2
    return im.crop((x, y, x + CW, y + CH))
for i, (name, ref, cap) in enumerate(rows):
    y = 60 + i * (CH + 40)
    sheet.paste(fit(Image.open(REF + ref)), (10, y))
    sheet.paste(fit(Image.open(f'shots/cmp_{name}.png')), (CW + 20, y))
    d.text((10, y + CH + 8), cap, fill=(220, 200, 150), font=fs)
sheet.save('shots/comparison_sheet.jpg', quality=88)
print('ok', sheet.size)
