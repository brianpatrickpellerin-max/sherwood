// Robin Hood: Outlaws of Sherwood — utilities (math, RNG, grid, A*, line of sight)
'use strict';
window.RH = window.RH || {};
(function (RH) {
  const TILE = 32;
  RH.TILE = TILE;

  // Tile properties: walk, sight (see-through), hide, name
  const TILES = {
    '.': { walk: 1, see: 1, hide: 0 },  // grass
    ',': { walk: 1, see: 1, hide: 0 },  // dirt path
    'f': { walk: 1, see: 1, hide: 0 },  // cobbles / flagstones
    'd': { walk: 1, see: 1, hide: 0 },  // wooden / hall floor
    'b': { walk: 1, see: 1, hide: 1 },  // bush
    'h': { walk: 1, see: 1, hide: 1 },  // hay
    '#': { walk: 0, see: 0, hide: 0 },  // stone wall
    'T': { walk: 0, see: 0, hide: 0 },  // tree
    'r': { walk: 0, see: 0, hide: 0 },  // roof / building
    'c': { walk: 0, see: 0, hide: 0 },  // crates / barrels
    'm': { walk: 0, see: 0, hide: 0 },  // market stall
    'p': { walk: 0, see: 0, hide: 0 },  // tent
    'l': { walk: 0, see: 0, hide: 0 },  // log pile
    'w': { walk: 0, see: 1, hide: 0 },  // water
    'x': { walk: 0, see: 1, hide: 0 },  // fence
  };
  RH.TILES = TILES;

  RH.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  RH.lerp = (a, b, t) => a + (b - a) * t;
  RH.dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
  RH.angDiff = (a, b) => {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  };
  RH.turnToward = (cur, target, maxStep) => {
    const d = RH.angDiff(cur, target);
    if (Math.abs(d) <= maxStep) return target;
    return cur + Math.sign(d) * maxStep;
  };

  // Seeded RNG (mulberry32)
  RH.rng = function (seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  // ---- Grid ----
  // grid = { w, h, ch: [], walk: Uint8Array, see: Uint8Array, hide: Uint8Array }
  RH.makeGrid = function (rows) {
    const h = rows.length;
    let w = 0;
    for (const r of rows) w = Math.max(w, r.length);
    const ch = new Array(w * h);
    const walk = new Uint8Array(w * h), see = new Uint8Array(w * h), hide = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let c = rows[y][x] || 'T';
        if (!TILES[c]) c = '.';
        const i = y * w + x;
        ch[i] = c;
        walk[i] = TILES[c].walk; see[i] = TILES[c].see; hide[i] = TILES[c].hide;
      }
    }
    return { w, h, ch, walk, see, hide, block: new Uint8Array(w * h) };
  };
  RH.isWalk = (g, tx, ty) => tx >= 0 && ty >= 0 && tx < g.w && ty < g.h && g.walk[ty * g.w + tx] === 1 && g.block[ty * g.w + tx] === 0;
  RH.tileAt = (g, wx, wy) => {
    const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
    if (tx < 0 || ty < 0 || tx >= g.w || ty >= g.h) return null;
    return g.ch[ty * g.w + tx];
  };
  RH.hideAt = (g, wx, wy) => {
    const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
    if (tx < 0 || ty < 0 || tx >= g.w || ty >= g.h) return 0;
    return g.hide[ty * g.w + tx];
  };

  // ---- Binary heap A* (8-dir, no corner cutting) ----
  let AS = null;
  function ensureAS(n) {
    if (AS && AS.n >= n) return AS;
    AS = {
      n,
      g: new Float32Array(n), f: new Float32Array(n), from: new Int32Array(n),
      gen: new Uint32Array(n), closed: new Uint32Array(n), heap: new Int32Array(n * 8), cur: 1,
    };
    return AS;
  }
  const DX = [1, -1, 0, 0, 1, 1, -1, -1], DY = [0, 0, 1, -1, 1, -1, 1, -1];
  const DC = [1, 1, 1, 1, Math.SQRT2, Math.SQRT2, Math.SQRT2, Math.SQRT2];

  // Returns array of tile indices from start (exclusive) to goal (inclusive), or null.
  RH.astar = function (grid, sx, sy, gx, gy, maxIter) {
    const w = grid.w, h = grid.h, n = w * h;
    if (gx < 0 || gy < 0 || gx >= w || gy >= h) return null;
    if (!RH.isWalk(grid, gx, gy)) return null;
    if (sx === gx && sy === gy) return [];
    const A = ensureAS(n);
    A.cur++;
    const cur = A.cur;
    const heap = A.heap; let hs = 0;
    const s = sy * w + sx, goal = gy * w + gx;
    const H = (i) => {
      const x = i % w, y = (i / w) | 0;
      const dx = Math.abs(x - gx), dy = Math.abs(y - gy);
      return (dx + dy) + (Math.SQRT2 - 2) * Math.min(dx, dy);
    };
    const push = (i) => {
      let k = hs++; heap[k] = i;
      while (k > 0) {
        const p = (k - 1) >> 1;
        if (A.f[heap[p]] <= A.f[heap[k]]) break;
        const t = heap[p]; heap[p] = heap[k]; heap[k] = t; k = p;
      }
    };
    const pop = () => {
      const top = heap[0]; hs--;
      if (hs > 0) {
        heap[0] = heap[hs]; let k = 0;
        for (;;) {
          const l = k * 2 + 1, r = l + 1; let m = k;
          if (l < hs && A.f[heap[l]] < A.f[heap[m]]) m = l;
          if (r < hs && A.f[heap[r]] < A.f[heap[m]]) m = r;
          if (m === k) break;
          const t = heap[m]; heap[m] = heap[k]; heap[k] = t; k = m;
        }
      }
      return top;
    };
    A.gen[s] = cur; A.g[s] = 0; A.f[s] = H(s); A.from[s] = -1;
    push(s);
    let iter = 0; const lim = maxIter || 20000;
    while (hs > 0 && iter++ < lim) {
      const c = pop();
      if (c === goal) break;
      if (A.closed[c] === cur) continue;
      A.closed[c] = cur;
      const cx = c % w, cy = (c / w) | 0;
      for (let d = 0; d < 8; d++) {
        const nx = cx + DX[d], ny = cy + DY[d];
        if (!RH.isWalk(grid, nx, ny)) continue;
        if (d >= 4 && (!RH.isWalk(grid, cx + DX[d], cy) || !RH.isWalk(grid, cx, cy + DY[d]))) continue;
        const ni = ny * w + nx;
        if (A.closed[ni] === cur) continue;
        const ng = A.g[c] + DC[d];
        if (A.gen[ni] !== cur || ng < A.g[ni]) {
          A.gen[ni] = cur; A.g[ni] = ng; A.f[ni] = ng + H(ni) * 1.001; A.from[ni] = c;
          if (hs < heap.length) push(ni);
        }
      }
    }
    if (A.gen[goal] !== cur) return null;
    const path = [];
    let c = goal;
    while (c !== s && c !== -1) { path.push(c); c = A.from[c]; }
    if (c === -1) return null;
    path.reverse();
    return path;
  };

  // Nearest walkable tile to (tx,ty) via BFS ring search
  RH.nearestWalk = function (grid, tx, ty, taken) {
    for (let r = 0; r < 8; r++) {
      let best = -1, bd = 1e9;
      for (let y = ty - r; y <= ty + r; y++) {
        for (let x = tx - r; x <= tx + r; x++) {
          if (Math.max(Math.abs(x - tx), Math.abs(y - ty)) !== r) continue;
          if (!RH.isWalk(grid, x, y)) continue;
          const i = y * grid.w + x;
          if (taken && taken.has(i)) continue;
          const d = (x - tx) * (x - tx) + (y - ty) * (y - ty);
          if (d < bd) { bd = d; best = i; }
        }
      }
      if (best >= 0) return best;
    }
    return -1;
  };

  // Grid ray march: returns distance (world px) until an opaque tile, up to maxD
  RH.rayDist = function (grid, x0, y0, ang, maxD) {
    const dx = Math.cos(ang), dy = Math.sin(ang);
    let tx = Math.floor(x0 / TILE), ty = Math.floor(y0 / TILE);
    const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1;
    const tDeltaX = dx !== 0 ? Math.abs(TILE / dx) : 1e9;
    const tDeltaY = dy !== 0 ? Math.abs(TILE / dy) : 1e9;
    let tMaxX = dx !== 0 ? ((dx > 0 ? (tx + 1) * TILE - x0 : x0 - tx * TILE) / Math.abs(dx)) : 1e9;
    let tMaxY = dy !== 0 ? ((dy > 0 ? (ty + 1) * TILE - y0 : y0 - ty * TILE) / Math.abs(dy)) : 1e9;
    const w = grid.w, h = grid.h;
    for (let i = 0; i < 64; i++) {
      let t;
      if (tMaxX < tMaxY) { t = tMaxX; tMaxX += tDeltaX; tx += stepX; }
      else { t = tMaxY; tMaxY += tDeltaY; ty += stepY; }
      if (t >= maxD) return maxD;
      if (tx < 0 || ty < 0 || tx >= w || ty >= h) return t;
      if (grid.see[ty * w + tx] === 0) return t;
    }
    return maxD;
  };

  // Line of sight between two world points
  RH.los = function (grid, x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    if (d < 1) return true;
    const r = RH.rayDist(grid, x0, y0, Math.atan2(y1 - y0, x1 - x0), d);
    return r >= d - 0.5;
  };
})(window.RH);
