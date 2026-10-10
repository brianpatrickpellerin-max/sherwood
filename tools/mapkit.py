# Tiny tile-map kit used to author the campaign maps from the specs (rh_ref/spec/missions/*.md).
# Legend (see js/util.js): . grass  , dirt  f cobbles  d floor/planks  b bush  h hay  # stone wall
# T tree  r roof/house (2x2+ blocks become enterable houses)  c crates  m stall  p tent  l logs  w water  x fence
import random
class Map:
    def __init__(s, w, h, fill='.'):
        s.w, s.h = w, h; s.g = [[fill] * w for _ in range(h)]
    def put(s, x, y, ch):
        if 0 <= x < s.w and 0 <= y < s.h: s.g[y][x] = ch
    def get(s, x, y): return s.g[y][x] if 0 <= x < s.w and 0 <= y < s.h else 'T'
    def rect(s, x0, y0, x1, y1, ch):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): s.put(x, y, ch)
    def box(s, x0, y0, x1, y1, ch='#', inner=None):
        if inner: s.rect(x0, y0, x1, y1, inner)
        for x in range(x0, x1 + 1): s.put(x, y0, ch); s.put(x, y1, ch)
        for y in range(y0, y1 + 1): s.put(x0, y, ch); s.put(x1, y, ch)
    def pts(s, lst, ch):
        for x, y in lst: s.put(x, y, ch)
    def line(s, pts, ch, width=1):
        # orthogonal polyline
        for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
            if x0 == x1:
                for y in range(min(y0, y1), max(y0, y1) + 1):
                    for k in range(width): s.put(x0 + k, y, ch)
            else:
                for x in range(min(x0, x1), max(x0, x1) + 1):
                    for k in range(width): s.put(x, y0 + k, ch)
    def border(s, ch='T', t=1):
        for y in range(s.h):
            for x in range(s.w):
                if x < t or y < t or x >= s.w - t or y >= s.h - t: s.g[y][x] = ch
    def scatter(s, x0, y0, x1, y1, ch, p, seed=1, on='.'):
        r = random.Random(seed)
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                if s.get(x, y) == on and r.random() < p: s.put(x, y, ch)
    def rows(s): return [''.join(r) for r in s.g]
