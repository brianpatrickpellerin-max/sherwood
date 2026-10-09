// Isometric (2:1) scene builder: painterly top-down ground skewed into iso, procedural
// volumetric sprites (walls, round towers, half-timbered houses, trees, props), depth strips.
// World coords: x,y in px (TILE=32). Iso: X = x - y, Y = (x + y) / 2, height z lifts Y.
'use strict';
(function (RH) {
  const T = RH.TILE;
  const iso = {};
  RH.iso = iso;
  iso.X = (x, y) => x - y;
  iso.Y = (x, y) => (x + y) / 2;

  // ---------- helpers ----------
  function cv(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
  iso.cv = cv;
  function hex(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function sh(h, k, a) { const [r, g, b] = hex(h); const f = (v) => Math.max(0, Math.min(255, Math.round(v * k))); return a == null ? `rgb(${f(r)},${f(g)},${f(b)})` : `rgba(${f(r)},${f(g)},${f(b)},${a})`; }
  iso.sh = sh;
  function mix(h1, h2, t) { const a = hex(h1), b = hex(h2); return `rgb(${Math.round(a[0] + (b[0] - a[0]) * t)},${Math.round(a[1] + (b[1] - a[1]) * t)},${Math.round(a[2] + (b[2] - a[2]) * t)})`; }
  const pick = (r, arr) => arr[Math.floor(r() * arr.length) % arr.length];

  // soft round blob sprites per colour (cached)
  const blobCache = {};
  function blob(col) {
    let b = blobCache[col];
    if (b) return b;
    b = cv(64, 64);
    const x = b.getContext('2d');
    const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, col); gr.addColorStop(0.55, sh(col, 1, 0.55)); gr.addColorStop(1, sh(col, 1, 0));
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    return (blobCache[col] = b);
  }
  function splat(c, col, x, y, r, a) { c.globalAlpha = a; c.drawImage(blob(col), x - r, y - r, r * 2, r * 2); c.globalAlpha = 1; }
  // value-noise canvas
  function noiseCanvas(n, r) {
    const c = cv(n, n), x = c.getContext('2d'), d = x.createImageData(n, n);
    for (let i = 0; i < n * n; i++) { const v = Math.floor(r() * 255); d.data[i * 4] = v; d.data[i * 4 + 1] = v; d.data[i * 4 + 2] = v; d.data[i * 4 + 3] = 255; }
    x.putImageData(d, 0, 0);
    return c;
  }

  // ---------- palettes ----------
  const GRASS = ['#6f7d35', '#7d8a3c', '#5f6f2c', '#8a903f', '#55662a', '#909848'];
  const GRASS_D = ['#4a5a22', '#3f4f1e', '#56642a'];
  const FOREST = ['#3f4c20', '#4a5624', '#36421c', '#5a5a26'];
  const DIRT = ['#8a6a44', '#7d5e3a', '#9a7a50', '#6e5234'];
  const COB = ['#8e8472', '#9a907c', '#80786a', '#a49a84', '#776e60'];
  const FLAG = ['#9c9282', '#a89e8c', '#908676', '#b0a690'];
  const WATER = '#4a6658';
  const STONE_W = ['#8f8268', '#857a62', '#9c8f74', '#7a705c', '#968a6e'];
  const STONE_C = ['#8c887c', '#7e7a6e', '#989282', '#726e64', '#908878'];
  const ROOF_CLAY = ['#9a4a2c', '#8a4228', '#a85a34', '#7e3c26'];
  const ROOF_BROWN = ['#6e5644', '#7a604a', '#5e4a3c'];
  const ROOF_THATCH = ['#a8864a', '#9a7a40', '#b8955a'];
  const PLASTER = ['#d9c9a2', '#cfbf98', '#e2d4ae', '#c8b48a'];
  const TIMBER = '#4a3020';
  const TREE_PALS = [
    ['#24361a', '#3d5824', '#6a8a34', '#9cb24c'],
    ['#2a3c1c', '#486226', '#78923e', '#a6ba56'],
    ['#383c1a', '#5c6226', '#8c9036', '#b8b458'],
    ['#46320f', '#88581a', '#bc8628', '#e0b24e'],
    ['#46220e', '#863c16', '#b4622a', '#d8984a'],
    ['#2c3a18', '#4e6a2a', '#7e9a3c', '#c0b048'],
  ];

  // ---------- classify tiles ----------
  function classOf(ch, theme) {
    switch (ch) {
      case ',': return 'dirt';
      case 'f': return theme === 'castle' ? 'flag' : 'cob';
      case 'd': return 'wood';
      case 'w': return 'water';
      case '#': case 'r': return theme === 'forest' ? 'dirt' : theme === 'castle' ? 'flag' : 'cob';
      case 'h': case 'c': case 'm': return theme === 'town' ? 'cob' : theme === 'castle' ? 'flag' : 'dirt';
      case 'T': return 'forest';
      case 'p': case 'l': return 'dirt';
      case '.': return theme === 'town' ? 'mud' : 'grass';
      default: return 'grass';
    }
  }

  // ---------- ground (painted top-down, then skewed) ----------
  function paintGround(g, theme, q, r, bridges) {
    const W = g.w * T, H = g.h * T;
    const c0 = cv(W * q, H * q), c = c0.getContext('2d');
    c.scale(q, q);
    const at = (x, y) => (x < 0 || y < 0 || x >= g.w || y >= g.h) ? 'T' : g.ch[y * g.w + x];
    const cl = (x, y) => classOf(at(x, y), theme);
    const BASE = { mud: '#7a6244', grass: '#6c7a34', forest: '#3e4a20', dirt: '#86663f', cob: '#7e715c', flag: '#887e6c', wood: '#6e4c30', water: WATER };
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) { c.fillStyle = BASE[cl(x, y)]; c.fillRect(x * T, y * T, T + 0.6, T + 0.6); }
    // soft splats: natural ground bleeds over its neighbours
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      const k = cl(x, y), px = x * T + 16, py = y * T + 16;
      if (k === 'grass' || k === 'forest') {
        const pal = k === 'grass' ? GRASS : FOREST;
        for (let i = 0; i < 5; i++) splat(c, pick(r, pal), px + (r() - 0.5) * 34, py + (r() - 0.5) * 34, 12 + r() * 18, 0.35 + r() * 0.4);
        if (r() < 0.3) splat(c, pick(r, GRASS_D), px + (r() - 0.5) * 30, py + (r() - 0.5) * 30, 10 + r() * 14, 0.4);
        if (k === 'grass' && r() < 0.18) splat(c, '#a09a50', px + (r() - 0.5) * 30, py + (r() - 0.5) * 30, 8 + r() * 12, 0.35);
      } else if (k === 'dirt') {
        for (let i = 0; i < 6; i++) splat(c, pick(r, DIRT), px + (r() - 0.5) * 30, py + (r() - 0.5) * 30, 12 + r() * 14, 0.5 + r() * 0.4);
      } else if (k === 'mud') {
        for (let i = 0; i < 6; i++) splat(c, pick(r, ['#7a6244', '#6a5438', '#8a7050', '#5e4a32', '#7e6a4e']), px + (r() - 0.5) * 30, py + (r() - 0.5) * 30, 12 + r() * 14, 0.5 + r() * 0.4);
        if (r() < 0.25) splat(c, pick(r, GRASS), px + (r() - 0.5) * 30, py + (r() - 0.5) * 30, 8 + r() * 10, 0.45);
        if (r() < 0.12) splat(c, '#4e4a40', px + (r() - 0.5) * 20, py + (r() - 0.5) * 20, 6 + r() * 8, 0.5);
        c.fillStyle = 'rgba(40,28,16,0.3)';
        for (let i = 0; i < 5; i++) { c.beginPath(); c.ellipse(px + r() * T, py + r() * T, 1 + r() * 2, 0.8 + r() * 1.4, r() * 3, 0, 7); c.fill(); }
      }
    }
    // paths: soften edges into grass and add ruts
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      if (at(x, y) !== ',') continue;
      const px = x * T, py = y * T;
      for (let i = 0; i < 3; i++) splat(c, '#7a5a36', px + 16 + (r() - 0.5) * 20, py + 16 + (r() - 0.5) * 20, 18 + r() * 6, 0.5);
      c.fillStyle = 'rgba(60,40,22,0.28)';
      for (let i = 0; i < 6; i++) { c.beginPath(); c.ellipse(px + r() * T, py + r() * T, 1 + r() * 2, 0.8 + r() * 1.4, r() * 3, 0, 7); c.fill(); }
      c.fillStyle = 'rgba(200,180,140,0.35)';
      for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(px + r() * T, py + r() * T, 0.8 + r() * 1.2, 0, 7); c.fill(); }
    }
    // noise overlay for painterly variation
    const nz = noiseCanvas(48, r);
    c.save(); c.imageSmoothingEnabled = true;
    c.globalCompositeOperation = 'soft-light';
    c.globalAlpha = 0.55; c.drawImage(nz, 0, 0, W, H);
    c.globalAlpha = 0.35; c.drawImage(nz, 0, 0, 12, 12, 0, 0, W, H);
    c.restore();
    // cobbles / flagstones / planks
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      const k = cl(x, y), px = x * T, py = y * T;
      if (k === 'cob') {
        const edge = cl(x - 1, y) !== k || cl(x + 1, y) !== k || cl(x, y - 1) !== k || cl(x, y + 1) !== k;
        for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) {
          if (edge && r() < 0.18) continue;
          const sx = px + i * 6.4 + (j % 2) * 3.2 + (r() - 0.5) * 1.2, sy = py + j * 6.4 + (r() - 0.5) * 1.2;
          const col = pick(r, COB);
          c.fillStyle = 'rgba(40,34,26,0.55)'; c.beginPath(); c.ellipse(sx + 3.2, sy + 3.6, 3.3, 3, 0, 0, 7); c.fill();
          c.fillStyle = col; c.beginPath(); c.ellipse(sx + 3, sy + 3, 2.9, 2.6, r(), 0, 7); c.fill();
          c.fillStyle = 'rgba(255,245,220,0.22)'; c.beginPath(); c.ellipse(sx + 2.3, sy + 2.2, 1.5, 1.1, 0, 0, 7); c.fill();
        }
      } else if (k === 'flag') {
        c.strokeStyle = 'rgba(50,44,36,0.55)'; c.lineWidth = 0.9;
        const n = 2;
        for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
          const sx = px + i * 16 + ((j + y) % 2) * 8, sy = py + j * 16;
          c.fillStyle = pick(r, FLAG); c.fillRect(sx + 0.6, sy + 0.6, 15, 15);
          c.strokeRect(sx + 0.5, sy + 0.5, 15.5, 15.5);
          c.fillStyle = 'rgba(255,250,230,0.12)'; c.fillRect(sx + 1, sy + 1, 14, 2);
          if (r() < 0.2) { c.beginPath(); c.moveTo(sx + r() * 16, sy); c.lineTo(sx + r() * 16, sy + 16); c.stroke(); }
        }
      } else if (k === 'wood') {
        for (let j = 0; j < 4; j++) {
          c.fillStyle = sh('#7a5636', 0.85 + r() * 0.3); c.fillRect(px, py + j * 8, T + 0.5, 8);
          c.fillStyle = 'rgba(30,18,8,0.55)'; c.fillRect(px, py + j * 8 + 7.2, T + 0.5, 0.9);
          c.fillStyle = 'rgba(30,18,8,0.4)'; c.fillRect(px + ((j * 13 + x * 7) % 32), py + j * 8, 0.9, 8);
          c.strokeStyle = 'rgba(200,150,100,0.12)'; c.lineWidth = 0.6; c.beginPath(); c.moveTo(px, py + j * 8 + 3 + r() * 2); c.lineTo(px + T, py + j * 8 + 3 + r() * 2); c.stroke();
        }
        if (theme === 'castle' && x % 6 === 0) { c.fillStyle = 'rgba(140,30,30,0.0)'; }
      }
    }
    // carpet runner in great halls (rows of wood at the centre column band)
    // water with banks
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      if (at(x, y) !== 'w' && !(bridges && bridges[y * g.w + x])) continue;
      const px = x * T, py = y * T;
      const gr = c.createLinearGradient(px, py, px + T, py + T);
      gr.addColorStop(0, '#567262'); gr.addColorStop(1, '#3e5a4c');
      c.fillStyle = gr; c.fillRect(px, py, T + 0.6, T + 0.6);
      c.strokeStyle = 'rgba(190,215,200,0.32)'; c.lineWidth = 0.9;
      for (let i = 0; i < 3; i++) { const wx = px + 2 + r() * 24, wy = py + 4 + r() * 24; c.beginPath(); c.moveTo(wx, wy); c.quadraticCurveTo(wx + 4, wy - 1.8, wx + 8, wy); c.stroke(); }
      splat(c, '#8aa89a', px + r() * T, py + r() * T, 6 + r() * 8, 0.25);
    }
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      if (at(x, y) !== 'w') continue;
      const px = x * T, py = y * T;
      const land = (ax, ay) => { const ch = at(ax, ay); return ch !== 'w' && !(bridges && bridges[ay * g.w + ax]); };
      const edges = [[0, -1], [0, 1], [-1, 0], [1, 0]];
      for (const [dx, dy] of edges) {
        if (!land(x + dx, y + dy)) continue;
        const ex = px + 16 + dx * 15, ey = py + 16 + dy * 15;
        for (let i = 0; i < 3; i++) splat(c, '#5a4a30', ex + (dy ? (r() - 0.5) * 30 : 0), ey + (dx ? (r() - 0.5) * 30 : 0), 7 + r() * 5, 0.6);
        c.fillStyle = 'rgba(20,30,24,0.35)'; c.fillRect(dx < 0 ? px : dx > 0 ? px + T - 4 : px, dy < 0 ? py : dy > 0 ? py + T - 4 : py, dx ? 4 : T, dy ? 4 : T);
        // reeds on the bank
        if (r() < 0.6) {
          const rx = px + 16 + dx * 20, ry = py + 16 + dy * 20;
          c.strokeStyle = 'rgba(60,80,30,0.9)'; c.lineWidth = 1;
          for (let i = 0; i < 5; i++) { const a = rx + (r() - 0.5) * 22, b = ry + (r() - 0.5) * 22; c.beginPath(); c.moveTo(a, b); c.lineTo(a + (r() - 0.5) * 3, b - 4 - r() * 4); c.stroke(); }
        }
      }
    }
    // grass details: tufts, flowers, leaves; stones
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      const k = cl(x, y), px = x * T, py = y * T;
      if (k === 'grass' || k === 'forest') {
        c.lineWidth = 0.8;
        for (let i = 0; i < 7; i++) {
          const gx = px + r() * T, gy = py + r() * T;
          c.strokeStyle = r() < 0.5 ? 'rgba(170,190,90,0.5)' : 'rgba(40,55,20,0.45)';
          c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx - 1.2, gy - 3.5); c.moveTo(gx + 1, gy); c.lineTo(gx + 2, gy - 3.2); c.stroke();
        }
        if (k === 'grass' && r() < 0.12) { c.fillStyle = pick(r, ['#efe3a8', '#e7c45a', '#c9a0d8', '#f4f0e0']); for (let i = 0; i < 3; i++) { c.beginPath(); c.arc(px + r() * T, py + r() * T, 1.1, 0, 7); c.fill(); } }
        if (r() < (k === 'forest' ? 0.7 : 0.12)) { for (let i = 0; i < 5; i++) { c.fillStyle = pick(r, ['#a87a2a', '#c09030', '#8a4a1a', '#b0602a']); c.beginPath(); c.ellipse(px + r() * T, py + r() * T, 1.6, 0.9, r() * 3, 0, 7); c.fill(); } }
        if (r() < 0.05) { c.fillStyle = '#8a8676'; c.beginPath(); c.ellipse(px + r() * T, py + r() * T, 2.5, 1.8, 0, 0, 7); c.fill(); }
      }
    }
    // bridges: wooden planks over water
    if (bridges) for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      const b = bridges[y * g.w + x]; if (!b) continue;
      const px = x * T, py = y * T;
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(px - 2, py + 2, T + 4, T);
      for (let i = 0; i < 6; i++) {
        c.fillStyle = sh('#8a6a44', 0.8 + r() * 0.35);
        if (b === 1) c.fillRect(px - 2 + i * 5.6, py, 5, T); else c.fillRect(px, py - 2 + i * 5.6, T, 5);
      }
      c.fillStyle = 'rgba(30,18,8,0.4)';
      if (b === 1) { c.fillRect(px - 2, py, T + 4, 2); c.fillRect(px - 2, py + T - 2, T + 4, 2); } else { c.fillRect(px, py - 2, 2, T + 4); c.fillRect(px + T - 2, py - 2, 2, T + 4); }
    }
    return c0;
  }

  // ---------- sprite construction ----------
  // A sprite covers the iso rect [left, top, w, h] relative to its anchor.
  function sprite(s, left, top, w, h, fn) {
    const c = cv(w * s, h * s), x = c.getContext('2d');
    x.setTransform(s, 0, 0, s, -left * s, -top * s);
    x.lineJoin = 'round';
    fn(x);
    return { img: c, left, top, w: c.width / s, h: c.height / s };
  }

  // Draw stone courses on a face in local coords (u along edge 0..L, v up 0..H)
  function stoneFace(c, L, H, pal, lit, r, opts) {
    c.fillStyle = sh(pal[0], lit); c.fillRect(0, 0, L, H);
    const ch = opts && opts.course || 6.5;
    for (let v = 0, row = 0; v < H; v += ch, row++) {
      let u = -((row * 5.3) % 11);
      while (u < L) {
        const bw = 8 + r() * 7;
        c.fillStyle = sh(pick(r, pal), lit * (0.9 + r() * 0.18));
        c.fillRect(u + 0.5, v + 0.5, bw - 1, Math.min(ch, H - v) - 1);
        c.fillStyle = `rgba(255,245,215,${0.12 * lit})`; c.fillRect(u + 0.5, v + Math.min(ch, H - v) - 1.6, bw - 1, 1);
        u += bw;
      }
    }
    c.fillStyle = 'rgba(30,24,16,0.25)';
    for (let v = 0; v < H; v += ch) c.fillRect(0, v, L, 0.7);
    // grime at the foot, moss
    const gr = c.createLinearGradient(0, 0, 0, Math.min(14, H));
    gr.addColorStop(0, 'rgba(40,34,20,0.45)'); gr.addColorStop(1, 'rgba(40,34,20,0)');
    c.fillStyle = gr; c.fillRect(0, 0, L, Math.min(14, H));
    if (r() < 0.35) splat(c, '#4a6024', r() * L, r() * H * 0.6, 4 + r() * 6, 0.5);
  }
  // affine helpers for faces of a tile-sized block (anchor = tile centre)
  // SW face: u from left corner (-32,0) to bottom (0,16); v up.  SE face: from bottom (0,16) to right (32,0).
  const FACE_SW = [1, 0.5, 0, -1, -32, 0];
  const FACE_SE = [1, -0.5, 0, -1, 0, 16];
  function withFace(c, m, fn) { c.save(); c.transform(m[0], m[1], m[2], m[3], m[4], m[5]); fn(); c.restore(); }

  function wallBlock(s, H, sw, se, cren, style, seed) {
    const r = RH.rng(seed);
    const pal = style === 'castle' ? STONE_C : STONE_W;
    return sprite(s, -33, -18 - H - 8, 66, 36 + H + 10, (c) => {
      if (sw) withFace(c, FACE_SW, () => stoneFace(c, 32, H, pal, 1.0, r));
      if (se) withFace(c, FACE_SE, () => stoneFace(c, 32, H, pal, 0.68, r));
      // top
      c.beginPath(); c.moveTo(0, -16 - H); c.lineTo(32, -H); c.lineTo(0, 16 - H); c.lineTo(-32, -H); c.closePath();
      c.fillStyle = sh(pal[2], 0.94); c.fill();
      c.strokeStyle = 'rgba(40,34,26,0.1)'; c.lineWidth = 0.7; c.stroke();
      for (let k = 0; k < 5; k++) { c.fillStyle = `rgba(${r() < 0.5 ? '60,50,34' : '230,220,190'},0.12)`; c.beginPath(); c.ellipse((r() - 0.5) * 30, -H + (r() - 0.5) * 12, 3 + r() * 5, 1.5 + r() * 2, 0, 0, 7); c.fill(); }
      if (cren) {
        const merl = (m, lit) => withFace(c, m, () => {
          for (let i = 0; i < 3; i++) {
            const u = 3 + i * 11;
            c.fillStyle = sh(pal[1], lit); c.fillRect(u, H, 6, 7);
            c.fillStyle = `rgba(255,245,220,${0.2 * lit})`; c.fillRect(u, H + 6, 6, 1);
          }
        });
        if (sw) merl(FACE_SW, 1); if (se) merl(FACE_SE, 0.7);
      }
      // edge lines
      c.strokeStyle = 'rgba(30,24,16,0.45)'; c.lineWidth = 0.8;
      c.beginPath();
      if (sw) { c.moveTo(-32, -H); c.lineTo(-32, 0); }
      if (sw || se) { c.moveTo(0, 16 - H); c.lineTo(0, 16); }
      if (se) { c.moveTo(32, -H); c.lineTo(32, 0); }
      c.stroke();
    });
  }

  function roofTiles(c, L, V, pal, lit, r, kind) {
    // local coords: u along eave (0..L), v up the slope (0..V)
    c.fillStyle = sh(pal[0], lit * 0.9); c.fillRect(-1, -1, L + 2, V + 2);
    if (kind === 'thatch') {
      for (let v = 0; v < V; v += 3) {
        for (let u = 0; u < L; u += 2.2) {
          c.strokeStyle = sh(pick(r, pal), lit * (0.8 + r() * 0.4)); c.lineWidth = 1.1;
          c.beginPath(); c.moveTo(u, v); c.lineTo(u + (r() - 0.5) * 1.5, v + 4 + r() * 2); c.stroke();
        }
      }
      c.fillStyle = 'rgba(40,24,8,0.35)'; for (let v = 6; v < V; v += 9) c.fillRect(0, v, L, 1);
      return;
    }
    const rowH = 4.2, tw = 5;
    for (let v = 0, row = 0; v < V + rowH; v += rowH, row++) {
      const off = (row % 2) * tw / 2;
      for (let u = -tw + off; u < L + tw; u += tw) {
        const col = sh(pick(r, pal), lit * (0.82 + r() * 0.32));
        c.fillStyle = col;
        c.beginPath(); c.moveTo(u, v + rowH); c.lineTo(u, v + 1.2); c.quadraticCurveTo(u + tw / 2, v - 1.2, u + tw, v + 1.2); c.lineTo(u + tw, v + rowH); c.closePath(); c.fill();
        c.fillStyle = 'rgba(25,12,6,0.42)'; c.fillRect(u, v + 0.6, 0.6, rowH);
      }
      c.fillStyle = 'rgba(25,12,6,0.38)'; c.fillRect(0, v, L, 0.8);
      c.fillStyle = `rgba(255,220,180,${0.08 * lit})`; c.fillRect(0, v + rowH - 1.2, L, 0.8);
    }
    // weathering streaks
    for (let i = 0; i < 4; i++) splat(c, r() < 0.5 ? '#3a3020' : '#b0a080', r() * L, r() * V, 6 + r() * 10, 0.18);
  }

  function timberFace(c, L, H, lit, r, opts) {
    const pl = pick(r, PLASTER);
    c.fillStyle = sh(pl, lit); c.fillRect(0, 0, L, H);
    // grime gradient
    const gr = c.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, 'rgba(70,50,30,0.35)'); gr.addColorStop(0.3, 'rgba(70,50,30,0.05)'); gr.addColorStop(1, 'rgba(70,50,30,0.12)');
    c.fillStyle = gr; c.fillRect(0, 0, L, H);
    // stone plinth
    c.save(); stoneFace(c, L, 7, STONE_W, lit * 0.95, r, { course: 3.5 }); c.restore();
    const tb = sh(TIMBER, lit);
    c.fillStyle = tb;
    const beams = [7, H * 0.52, H - 3];
    for (const b of beams) c.fillRect(0, b, L, 2.2);
    const step = opts.step || 10.7;
    const posts = [];
    for (let u = 0; u <= L + 0.1; u += step) posts.push(Math.min(u, L - 2));
    for (const u of posts) c.fillRect(u, 7, 2.2, H - 7);
    // braces / windows / door per panel
    for (let i = 0; i < posts.length - 1; i++) {
      const u0 = posts[i] + 2.2, u1 = posts[i + 1];
      // lower storey
      if (opts.door === i) {
        c.fillStyle = sh('#5a3a20', lit); c.fillRect(u0 + 1, 7, u1 - u0 - 2, H * 0.52 - 8);
        c.fillStyle = 'rgba(20,10,4,0.5)'; for (let k = 1; k < 3; k++) c.fillRect(u0 + 1 + k * (u1 - u0 - 2) / 3, 7, 0.6, H * 0.52 - 8);
        c.fillStyle = '#c8a050'; c.fillRect(u1 - 4, 7 + (H * 0.52 - 8) * 0.45, 1.2, 1.2);
        continue;
      }
      const lowWin = r() < 0.35, upWin = r() < 0.6;
      if (lowWin) window1(c, (u0 + u1) / 2, 7 + (H * 0.52 - 7) * 0.5, lit, r);
      else if (r() < 0.5) { c.strokeStyle = tb; c.lineWidth = 1.8; c.beginPath(); if (r() < 0.5) { c.moveTo(u0, 8); c.lineTo(u1, H * 0.52); } else { c.moveTo(u1, 8); c.lineTo(u0, H * 0.52); } c.stroke(); }
      if (upWin) window1(c, (u0 + u1) / 2, H * 0.52 + (H * 0.48) * 0.48, lit, r);
      else { c.strokeStyle = tb; c.lineWidth = 1.8; c.beginPath(); c.moveTo(u0, H * 0.52 + 2); c.lineTo((u0 + u1) / 2, H - 3); c.lineTo(u1, H * 0.52 + 2); c.stroke(); }
    }
  }
  function window1(c, u, v, lit, r) {
    const w = 4.6, h = 6;
    c.fillStyle = sh('#3a2a1a', lit); c.fillRect(u - w / 2 - 1, v - h / 2 - 1, w + 2, h + 2);
    c.fillStyle = r() < 0.12 ? '#e0b060' : sh('#20242a', 1); c.fillRect(u - w / 2, v - h / 2, w, h);
    c.fillStyle = sh('#5a4028', lit); c.fillRect(u - 0.4, v - h / 2, 0.8, h); c.fillRect(u - w / 2, v - 0.4, w, 0.8);
    // shutters
    c.fillStyle = sh(pick(r, ['#5a6a3a', '#6a4a2a', '#7a3a2a']), lit * 0.9);
    c.fillRect(u - w / 2 - 3, v - h / 2, 2, h); c.fillRect(u + w / 2 + 1, v - h / 2, 2, h);
  }
  function castleFace(c, L, H, lit, r, opts) {
    stoneFace(c, L, H, STONE_C, lit, r);
    for (let u = 8; u < L - 6; u += 14 + r() * 8) {
      if (r() < 0.45) continue;
      const v = H * 0.55 + r() * H * 0.2;
      c.fillStyle = sh('#2a2622', 1); c.beginPath(); c.moveTo(u - 2.4, v - 5); c.lineTo(u - 2.4, v + 2); c.arc(u, v + 2, 2.4, Math.PI, 0, true); c.lineTo(u + 2.4, v - 5); c.closePath(); c.fill();
      c.strokeStyle = sh('#c8c0b0', lit * 0.9); c.lineWidth = 0.8; c.stroke();
    }
    if (opts.door != null) {
      const u = opts.doorU;
      c.fillStyle = sh('#4a3020', lit); c.beginPath(); c.moveTo(u - 5, 0); c.lineTo(u - 5, 11); c.arc(u, 11, 5, Math.PI, 0, true); c.lineTo(u + 5, 0); c.closePath(); c.fill();
      c.strokeStyle = sh('#c8c0b0', lit); c.lineWidth = 1; c.stroke();
    }
  }

  // House / hall volume with a pitched roof. Returns sprite in absolute iso coords + depth strips.
  function building(s, b, style, r, frontWalk) {
    const x0 = b.x * T, y0 = b.y * T, x1 = (b.x + b.w) * T, y1 = (b.y + b.h) * T;
    const alongX = b.w >= b.h;
    const short = (alongX ? b.h : b.w) * T;
    const Hw = style === 'castle' ? 46 + r() * 8 : 30 + Math.min(14, short * 0.12) + r() * 6;
    const lean = short <= T;
    const Rh = lean ? 14 : Math.min(58, short * (style === 'castle' ? 0.42 : 0.55));
    const ov = 4;
    const roofPal = style === 'castle' ? (r() < 0.5 ? ROOF_CLAY : ['#6a6a70', '#5a5a62', '#74747a']) : (r() < 0.62 ? ROOF_CLAY : r() < 0.6 ? ROOF_BROWN : ROOF_THATCH);
    const roofKind = roofPal === ROOF_THATCH ? 'thatch' : 'tile';
    const P = (x, y, z) => [x - y, (x + y) / 2 - z];
    // bbox
    const pts = [P(x0 - ov, y0 - ov, 0), P(x1 + ov, y0 - ov, Hw + Rh + 20), P(x1 + ov, y1 + ov, 0), P(x0 - ov, y1 + ov, Hw + Rh + 20), P(x0 - ov, y0 - ov, Hw + Rh + 20), P(x1 + ov, y1 + ov, Hw + Rh + 20)];
    let L = 1e9, Tp = 1e9, Rr = -1e9, B = -1e9;
    for (const [X, Y] of pts) { L = Math.min(L, X); Rr = Math.max(Rr, X); Tp = Math.min(Tp, Y); B = Math.max(B, Y); }
    L -= 4; Rr += 4; Tp -= 4; B += 4;
    const spr = sprite(s, L, Tp, Rr - L, B - Tp, (c) => {
      // affine to map local (u along a, v along b) from origin o
      const face = (o, a, bv, fn) => { c.save(); c.transform(a[0], a[1], bv[0], bv[1], o[0], o[1]); fn(); c.restore(); };
      const unit = (p, q, len) => [(q[0] - p[0]) / len, (q[1] - p[1]) / len];
      const facadeFn = (Lf, lit, isFront, gable) => () => {
        const doorI = isFront ? Math.floor(Lf / 10.7 / 2) : null;
        if (style === 'castle') castleFace(c, Lf, Hw, lit, r, { door: isFront ? 1 : null, doorU: Lf / 2 });
        else timberFace(c, Lf, Hw, lit, r, { door: doorI });
      };
      const up = [0, -1];
      // roof planes and walls, back to front
      if (alongX) {
        const ym = (y0 + y1) / 2;
        const zr = Hw + Rh;
        const ridge0 = P(x0 - ov, ym, zr), ridge1 = P(x1 + ov, ym, zr);
        const eN0 = P(x0 - ov, y0 - ov, Hw - 3), eN1 = P(x1 + ov, y0 - ov, Hw - 3);
        const eS0 = P(x0 - ov, y1 + ov, Hw - 3), eS1 = P(x1 + ov, y1 + ov, Hw - 3);
        const Lu = (x1 - x0) + 2 * ov;
        const Vn = Math.hypot(ym - (y0 - ov), Rh + 3), Vs = Vn;
        if (!lean) face(eN0, unit(eN0, eN1, Lu), unit(eN0, ridge0, Vn), () => roofTiles(c, Lu, Vn, roofPal, 1.12, r, roofKind));
        // east wall (SE face) with gable
        const eB = P(x1, y0, 0), eC = P(x1, y1, 0);
        face(eC, unit(eC, eB, y1 - y0), up, () => {
          const Lf = y1 - y0;
          (facadeFn(Lf, 0.7, false))();
          if (!lean) { // gable triangle
            c.save(); c.beginPath(); c.moveTo(0, Hw); c.lineTo(Lf / 2, Hw + Rh); c.lineTo(Lf, Hw); c.closePath(); c.clip();
            if (style === 'castle') stoneFace(c, Lf, Hw + Rh, STONE_C, 0.68, r); else { c.fillStyle = sh(pick(r, PLASTER), 0.7); c.fillRect(0, Hw, Lf, Rh); c.fillStyle = sh(TIMBER, 0.7); c.fillRect(Lf / 2 - 1, Hw, 2, Rh); c.fillRect(0, Hw + Rh * 0.45, Lf, 1.8); }
            c.restore();
          }
        });
        // south wall (SW face)
        const sD = P(x0, y1, 0);
        face(sD, unit(sD, P(x1, y1, 0), x1 - x0), up, facadeFn(x1 - x0, 1.0, frontWalk));
        if (lean) {
          // lean-to roof sloping down to the south
          const top0 = P(x0 - ov, y0, Hw + Rh), top1 = P(x1 + ov, y0, Hw + Rh);
          const V = Math.hypot(y1 + ov - y0, Rh + 3);
          face(eS0, unit(eS0, eS1, Lu), unit(eS0, top0, V), () => roofTiles(c, Lu, V, roofPal, 1.0, r, roofKind));
        } else {
          face(eS0, unit(eS0, eS1, Lu), unit(eS0, ridge0, Vs), () => roofTiles(c, Lu, Vs, roofPal, 1.0, r, roofKind));
          c.strokeStyle = 'rgba(40,20,10,0.8)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(ridge0[0], ridge0[1]); c.lineTo(ridge1[0], ridge1[1]); c.stroke();
          c.strokeStyle = sh(roofPal[0], 1.25); c.lineWidth = 0.8; c.beginPath(); c.moveTo(ridge0[0], ridge0[1] - 0.8); c.lineTo(ridge1[0], ridge1[1] - 0.8); c.stroke();
          // barge board on the east gable
          c.strokeStyle = sh('#4a3020', 0.8); c.lineWidth = 1.4; c.beginPath(); c.moveTo(eS1[0], eS1[1]); c.lineTo(ridge1[0], ridge1[1]); c.lineTo(eN1[0], eN1[1]); c.stroke();
        }
        // chimney
        if (r() < 0.7 && !lean) chimney(c, P, x0 + (x1 - x0) * (0.2 + r() * 0.6), ym + (y1 - ym) * 0.4, Hw + Rh * 0.6, Rh * 0.55 + 10, style);
      } else {
        const xm = (x0 + x1) / 2;
        const zr = Hw + Rh;
        const ridge0 = P(xm, y0 - ov, zr), ridge1 = P(xm, y1 + ov, zr);
        const eW0 = P(x0 - ov, y0 - ov, Hw - 3), eW1 = P(x0 - ov, y1 + ov, Hw - 3);
        const eE0 = P(x1 + ov, y0 - ov, Hw - 3), eE1 = P(x1 + ov, y1 + ov, Hw - 3);
        const Lu = (y1 - y0) + 2 * ov;
        const V = Math.hypot(xm - (x0 - ov), Rh + 3);
        if (!lean) face(eW0, unit(eW0, eW1, Lu), unit(eW0, ridge0, V), () => roofTiles(c, Lu, V, roofPal, 1.15, r, roofKind));
        // south wall with gable (SW face)
        const sD = P(x0, y1, 0);
        face(sD, unit(sD, P(x1, y1, 0), x1 - x0), up, () => {
          const Lf = x1 - x0;
          (facadeFn(Lf, 1.0, frontWalk))();
          if (!lean) {
            c.save(); c.beginPath(); c.moveTo(0, Hw); c.lineTo(Lf / 2, Hw + Rh); c.lineTo(Lf, Hw); c.closePath(); c.clip();
            if (style === 'castle') stoneFace(c, Lf, Hw + Rh, STONE_C, 1, r); else { c.fillStyle = sh(pick(r, PLASTER), 1); c.fillRect(0, Hw, Lf, Rh); c.fillStyle = TIMBER; c.fillRect(Lf / 2 - 1, Hw, 2, Rh); c.fillRect(0, Hw + Rh * 0.45, Lf, 1.8); window1(c, Lf / 2 + 6, Hw + Rh * 0.25, 1, r); }
            c.restore();
          }
        });
        // east wall (SE face)
        const eC = P(x1, y1, 0);
        face(eC, unit(eC, P(x1, y0, 0), y1 - y0), up, facadeFn(y1 - y0, 0.7, false));
        if (lean) {
          const top0 = P(x0, y0 - ov, Hw + Rh);
          const Vl = Math.hypot(x1 + ov - x0, Rh + 3);
          face(eE0, unit(eE0, eE1, Lu), unit(eE0, top0, Vl), () => roofTiles(c, Lu, Vl, roofPal, 0.78, r, roofKind));
        } else {
          face(eE0, unit(eE0, eE1, Lu), unit(eE0, ridge0, V), () => roofTiles(c, Lu, V, roofPal, 0.78, r, roofKind));
          c.strokeStyle = 'rgba(40,20,10,0.8)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(ridge0[0], ridge0[1]); c.lineTo(ridge1[0], ridge1[1]); c.stroke();
          c.strokeStyle = sh('#4a3020', 1); c.lineWidth = 1.4; c.beginPath(); c.moveTo(eW1[0], eW1[1]); c.lineTo(ridge1[0], ridge1[1]); c.lineTo(eE1[0], eE1[1]); c.stroke();
        }
        if (r() < 0.7 && !lean) chimney(c, P, xm + (x1 - xm) * 0.4, y0 + (y1 - y0) * (0.2 + r() * 0.6), Hw + Rh * 0.6, Rh * 0.55 + 10, style);
      }
    });
    spr.absX = 0; spr.absY = 0; // sprite coords are absolute iso
    spr.height = Hw + Rh;
    return spr;
  }
  function chimney(c, P, x, y, z0, h, style) {
    const w = 5;
    const a = P(x - w, y + w, z0), b = P(x + w, y + w, z0), d = P(x + w, y - w, z0);
    const at = P(x - w, y + w, z0 + h), bt = P(x + w, y + w, z0 + h), dt = P(x + w, y - w, z0 + h), lt = P(x - w, y - w, z0 + h);
    c.fillStyle = '#8a7a66'; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(bt[0], bt[1]); c.lineTo(at[0], at[1]); c.closePath(); c.fill();
    c.fillStyle = '#5e5446'; c.beginPath(); c.moveTo(b[0], b[1]); c.lineTo(d[0], d[1]); c.lineTo(dt[0], dt[1]); c.lineTo(bt[0], bt[1]); c.closePath(); c.fill();
    c.fillStyle = '#2a2420'; c.beginPath(); c.moveTo(at[0], at[1]); c.lineTo(bt[0], bt[1]); c.lineTo(dt[0], dt[1]); c.lineTo(lt[0], lt[1]); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(30,24,16,0.5)'; c.lineWidth = 0.6;
    for (let k = 3; k < h; k += 3.5) { const p1 = P(x - w, y + w, z0 + k), p2 = P(x + w, y + w, z0 + k), p3 = P(x + w, y - w, z0 + k); c.beginPath(); c.moveTo(p1[0], p1[1]); c.lineTo(p2[0], p2[1]); c.lineTo(p3[0], p3[1]); c.stroke(); }
  }

  function tower(s, rW, H, style, seed) {
    const r = RH.rng(seed);
    const rx = rW * Math.SQRT2, ry = rx / 2;
    const cone = style !== 'castle' || r() < 0.75;
    const hoard = cone && style !== 'castle';
    const rr = rx * 1.2, roofH = cone ? rr * 1.7 : 0;
    const top = -H - (hoard ? 10 : 7) - roofH - 10;
    return sprite(s, -rr - 4, top, rr * 2 + 8, -top + ry + 6, (c) => {
      const pal = style === 'castle' ? STONE_C : STONE_W;
      // body
      c.save();
      c.beginPath(); c.moveTo(-rx, -H); c.lineTo(-rx, 0); c.ellipse(0, 0, rx, ry, 0, Math.PI, 0, true); c.lineTo(rx, -H); c.ellipse(0, -H, rx, ry, 0, 0, Math.PI, true); c.closePath();
      c.clip();
      c.fillStyle = pal[0]; c.fillRect(-rx, -H - ry, rx * 2, H + ry * 2);
      const ch = 6;
      for (let k = 0; k * ch < H + ry; k++) {
        const y = -k * ch;
        for (let j = 0; j < 14; j++) {
          const p0 = (j + (k % 2) * 0.5) / 14 * Math.PI, p1 = (j + 1 + (k % 2) * 0.5) / 14 * Math.PI;
          c.fillStyle = sh(pick(r, pal), 0.9 + r() * 0.2);
          c.beginPath(); c.moveTo(rx * Math.cos(p0), y + ry * Math.sin(p0)); c.lineTo(rx * Math.cos(p1), y + ry * Math.sin(p1));
          c.lineTo(rx * Math.cos(p1), y - ch + 0.8 + ry * Math.sin(p1)); c.lineTo(rx * Math.cos(p0), y - ch + 0.8 + ry * Math.sin(p0)); c.closePath(); c.fill();
        }
      }
      // shading: lit from the left
      const gr = c.createLinearGradient(-rx, 0, rx, 0);
      gr.addColorStop(0, 'rgba(255,240,200,0.12)'); gr.addColorStop(0.35, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(10,8,4,0.55)');
      c.fillStyle = gr; c.fillRect(-rx, -H - ry, rx * 2, H + ry * 2);
      const g2 = c.createLinearGradient(0, -H, 0, 6);
      g2.addColorStop(0.7, 'rgba(40,30,20,0)'); g2.addColorStop(1, 'rgba(40,30,20,0.4)');
      c.fillStyle = g2; c.fillRect(-rx, -H - ry, rx * 2, H + ry * 2);
      // slits
      c.fillStyle = '#1e1a16';
      for (let i = 0; i < 3; i++) { const a = 0.6 + r() * 1.6, y = -H * (0.3 + r() * 0.5); c.fillRect(rx * Math.cos(a) - 1, y + ry * Math.sin(a) - 5, 2, 7); }
      if (r() < 0.4) splat(c, '#4a6024', -rx * 0.5, -6, 10, 0.5);
      c.restore();
      c.strokeStyle = 'rgba(30,24,16,0.45)'; c.lineWidth = 0.8;
      c.beginPath(); c.moveTo(-rx, -H); c.lineTo(-rx, 0); c.ellipse(0, 0, rx, ry, 0, Math.PI, 0, true); c.lineTo(rx, -H); c.stroke();
      let y = -H;
      if (hoard) {
        // timber hoarding gallery
        const hx = rx * 1.08;
        c.fillStyle = '#5a4028'; c.beginPath(); c.moveTo(-hx, y); c.lineTo(-hx, y - 10); c.ellipse(0, y - 10, hx, hx / 2, 0, Math.PI, 0, true); c.lineTo(hx, y); c.ellipse(0, y, hx, hx / 2, 0, 0, Math.PI, false); c.closePath(); c.fill();
        c.strokeStyle = 'rgba(20,12,6,0.6)'; c.lineWidth = 0.8;
        for (let j = 1; j < 16; j++) { const a = j / 16 * Math.PI; const px = hx * Math.cos(a), py = (hx / 2) * Math.sin(a); c.beginPath(); c.moveTo(px, y + py); c.lineTo(px, y - 10 + py); c.stroke(); }
        const gr2 = c.createLinearGradient(-hx, 0, hx, 0); gr2.addColorStop(0, 'rgba(255,220,160,0.15)'); gr2.addColorStop(1, 'rgba(0,0,0,0.5)');
        c.fillStyle = gr2; c.beginPath(); c.moveTo(-hx, y); c.lineTo(-hx, y - 10); c.lineTo(hx, y - 10); c.lineTo(hx, y); c.ellipse(0, y, hx, hx / 2, 0, 0, Math.PI, false); c.fill();
        y -= 10;
      } else {
        // parapet with merlons
        c.fillStyle = sh(pal[2], 1); c.beginPath(); c.ellipse(0, y, rx, ry, 0, 0, 7); c.fill();
        c.fillStyle = 'rgba(40,34,26,0.5)'; c.beginPath(); c.ellipse(0, y + 1, rx * 0.72, ry * 0.72, 0, 0, 7); c.fill();
        for (let j = 0; j < 9; j++) {
          const a = (j + 0.5) / 9 * Math.PI; const px = rx * Math.cos(a), py = ry * Math.sin(a);
          c.fillStyle = sh(pal[1], a < 1.6 ? 1 : 0.7); c.fillRect(px - 2.4, y + py - 7, 4.8, 7);
        }
        y -= 7;
      }
      if (cone) {
        const base = y;
        c.save();
        c.beginPath(); c.moveTo(-rr, base); c.lineTo(0, base - roofH); c.lineTo(rr, base); c.ellipse(0, base, rr, rr / 2, 0, 0, Math.PI, false); c.closePath();
        c.clip();
        const pal2 = style === 'castle' && r() < 0.4 ? ['#5c5c64', '#6a6a72', '#50505a'] : ROOF_CLAY;
        c.fillStyle = pal2[0]; c.fillRect(-rr, base - roofH, rr * 2, roofH + rr);
        const rows = Math.floor(roofH / 4.2);
        for (let k = rows; k >= 0; k--) {
          const t = k / rows, R = rr * (1 - t), yy = base - roofH * t;
          const n = Math.max(3, Math.floor(R / 2.6));
          for (let j = 0; j < n; j++) {
            const a0 = (j + (k % 2) * 0.5) / n * Math.PI, a1 = (j + 1 + (k % 2) * 0.5) / n * Math.PI;
            const x0 = R * Math.cos(a0), x1 = R * Math.cos(a1), y0 = yy + R / 2 * Math.sin(a0), y1 = yy + R / 2 * Math.sin(a1);
            c.fillStyle = sh(pick(r, pal2), 0.85 + r() * 0.3);
            c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + 2.2, x1, y1); c.lineTo(x1 * 0.9, y1 - 4.6); c.lineTo(x0 * 0.9, y0 - 4.6); c.closePath(); c.fill();
            c.fillStyle = 'rgba(30,14,6,0.4)'; c.fillRect(x0 - 0.3, y0 - 4, 0.6, 4);
          }
        }
        const gr3 = c.createLinearGradient(-rr, 0, rr, 0);
        gr3.addColorStop(0, 'rgba(255,220,170,0.18)'); gr3.addColorStop(0.4, 'rgba(0,0,0,0)'); gr3.addColorStop(1, 'rgba(10,4,0,0.55)');
        c.fillStyle = gr3; c.fillRect(-rr, base - roofH, rr * 2, roofH + rr);
        c.restore();
        c.strokeStyle = 'rgba(40,18,8,0.7)'; c.lineWidth = 0.9;
        c.beginPath(); c.moveTo(-rr, base); c.lineTo(0, base - roofH); c.lineTo(rr, base); c.ellipse(0, base, rr, rr / 2, 0, 0, Math.PI, false); c.stroke();
        c.strokeStyle = '#3a3a3a'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, base - roofH); c.lineTo(0, base - roofH - 8); c.stroke();
        c.fillStyle = '#c8a040'; c.beginPath(); c.arc(0, base - roofH - 8, 1.6, 0, 7); c.fill();
      }
    });
  }

  function tree(s, pal, seed, big) {
    const r = RH.rng(seed);
    const R = (big ? 34 : 27) + r() * 10, th = 16 + r() * 10;
    const cy = -th - R * 0.62;
    return sprite(s, -R * 1.35, cy - R * 1.15, R * 2.7, -cy + R * 1.15 + 8, (c) => {
      // trunk
      c.fillStyle = '#4a3420';
      c.beginPath(); c.moveTo(-4.5, 2); c.quadraticCurveTo(-2.6, -th * 0.5, -2.4, -th - 6); c.lineTo(2.6, -th - 6); c.quadraticCurveTo(3, -th * 0.5, 5, 2); c.closePath(); c.fill();
      c.fillStyle = 'rgba(200,170,120,0.35)'; c.fillRect(-3.3, -th, 1.4, th);
      c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(1, -th, 2.4, th);
      c.strokeStyle = '#4a3420'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(0, -th); c.lineTo(-R * 0.4, cy + R * 0.2); c.moveTo(0, -th - 2); c.lineTo(R * 0.45, cy + R * 0.25); c.stroke();
      // canopy clusters
      const cl = [];
      const n = 22 + Math.floor(r() * 8);
      for (let i = 0; i < n; i++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r());
        cl.push([Math.cos(a) * d * R * 0.82, cy + Math.sin(a) * d * R * 0.66, R * (0.28 + r() * 0.18)]);
      }
      cl.sort((a, b) => a[1] - b[1]);
      for (const [x, y, rc] of cl) { c.fillStyle = pal[0]; c.beginPath(); c.arc(x + 1.5, y + 2.5, rc, 0, 7); c.fill(); }
      for (const [x, y, rc] of cl) { c.fillStyle = r() < 0.15 ? pal[0] : pal[1]; c.beginPath(); c.arc(x, y, rc * 0.92, 0, 7); c.fill(); }
      for (const [x, y, rc] of cl) {
        const lit = (-(x / R) - (y - cy) / R) * 0.5 + 0.5;
        if (lit < 0.42) continue;
        c.globalAlpha = Math.min(1, lit); c.fillStyle = pal[2];
        c.beginPath(); c.arc(x - rc * 0.28, y - rc * 0.3, rc * 0.55, 0, 7); c.fill();
      }
      c.globalAlpha = 1;
      // leaf speckles
      for (let i = 0; i < 170; i++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r());
        const x = Math.cos(a) * d * R * 0.95, y = cy + Math.sin(a) * d * R * 0.78;
        const lit = (-(x / R) - (y - cy) / R) * 0.5 + 0.5 + (r() - 0.5) * 0.4;
        c.fillStyle = lit > 0.62 ? pal[3] : lit > 0.4 ? pal[2] : lit > 0.2 ? pal[1] : pal[0];
        c.globalAlpha = 0.85;
        c.beginPath(); c.ellipse(x, y, 1.6 + r(), 1 + r() * 0.6, r() * 3, 0, 7); c.fill();
      }
      c.globalAlpha = 1;
      // a few dark holes
      for (let i = 0; i < 6; i++) { c.fillStyle = 'rgba(10,16,6,0.5)'; c.beginPath(); c.arc((r() - 0.5) * R * 1.2, cy + (r() - 0.2) * R * 0.8, 1.5 + r() * 2, 0, 7); c.fill(); }
    });
  }

  function bush(s, pal, seed, flowers) {
    const r = RH.rng(seed);
    const R = 15 + r() * 3;
    return sprite(s, -R * 1.5, -R * 1.9, R * 3, R * 2.4, (c) => {
      const cl = [];
      for (let i = 0; i < 13; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()); cl.push([Math.cos(a) * d * R, -R * 0.55 + Math.sin(a) * d * R * 0.5, R * (0.35 + r() * 0.2)]); }
      cl.sort((a, b) => a[1] - b[1]);
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(3, 2, R * 1.2, R * 0.45, 0, 0, 7); c.fill();
      for (const [x, y, rc] of cl) { c.fillStyle = pal[0]; c.beginPath(); c.arc(x + 1, y + 2, rc, 0, 7); c.fill(); }
      for (const [x, y, rc] of cl) { c.fillStyle = pal[1]; c.beginPath(); c.arc(x, y, rc * 0.9, 0, 7); c.fill(); }
      for (const [x, y, rc] of cl) if (x + y < -R * 0.5) { c.fillStyle = pal[2]; c.beginPath(); c.arc(x - rc * 0.3, y - rc * 0.3, rc * 0.5, 0, 7); c.fill(); }
      for (let i = 0; i < 60; i++) { const a = r() * 7, d = Math.sqrt(r()); const x = Math.cos(a) * d * R * 1.05, y = -R * 0.55 + Math.sin(a) * d * R * 0.6; c.fillStyle = (x + y < -R * 0.4) ? pal[3] : pal[r() < 0.5 ? 1 : 2]; c.globalAlpha = 0.8; c.beginPath(); c.ellipse(x, y, 1.4, 0.9, r() * 3, 0, 7); c.fill(); }
      c.globalAlpha = 1;
      if (flowers) { c.fillStyle = flowers; for (let i = 0; i < 7; i++) { c.beginPath(); c.arc((r() - 0.5) * R * 1.6, -R * 0.55 + (r() - 0.5) * R * 0.8, 1.2, 0, 7); c.fill(); } }
    });
  }

  // small iso box in world dims relative to anchor (cx, cy world offsets, z base)
  function box(c, cx, cy, z, sx, sy, sz, col, lit2) {
    const P = (x, y, zz) => [x - y, (x + y) / 2 - zz];
    const x0 = cx - sx / 2, x1 = cx + sx / 2, y0 = cy - sy / 2, y1 = cy + sy / 2;
    const q = (pts, fill) => { c.fillStyle = fill; c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); c.fill(); };
    q([P(x0, y1, z), P(x1, y1, z), P(x1, y1, z + sz), P(x0, y1, z + sz)], sh(col, 1));
    q([P(x1, y1, z), P(x1, y0, z), P(x1, y0, z + sz), P(x1, y1, z + sz)], sh(col, lit2 || 0.68));
    q([P(x0, y0, z + sz), P(x1, y0, z + sz), P(x1, y1, z + sz), P(x0, y1, z + sz)], sh(col, 1.18));
    return P;
  }
  function crateStack(s, seed) {
    const r = RH.rng(seed);
    return sprite(s, -34, -52, 68, 72, (c) => {
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(4, 2, 26, 10, 0, 0, 7); c.fill();
      const kind = r();
      if (kind < 0.5) {
        const P = box(c, -3, 3, 0, 18, 18, 16, '#9a6a3a');
        box(c, 9, -7, 0, 14, 14, 12, '#8a5c30');
        box(c, -1, 1, 16, 14, 14, 12, '#a87a48');
        c.strokeStyle = 'rgba(40,20,8,0.55)'; c.lineWidth = 0.8;
        const a = P(-12, 12, 2), b = P(6, 12, 14); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
      } else {
        for (const [bx, by] of [[-6, 6], [8, 2], [0, -8]]) barrel(c, bx - by, (bx + by) / 2, 7, 15);
        barrel(c, 1 - 0, (1 + 0) / 2 - 15, 6.5, 13);
      }
    });
  }
  function barrel(c, X, Y, rx, h) {
    const ry = rx * 0.5;
    c.fillStyle = '#7a5030'; c.beginPath(); c.moveTo(X - rx, Y - h); c.lineTo(X - rx, Y); c.ellipse(X, Y, rx, ry, 0, Math.PI, 0, true); c.lineTo(X + rx, Y - h); c.closePath(); c.fill();
    const gr = c.createLinearGradient(X - rx, 0, X + rx, 0); gr.addColorStop(0, 'rgba(255,220,170,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0.45)');
    c.fillStyle = gr; c.fill();
    c.strokeStyle = '#3a3a3a'; c.lineWidth = 1.2;
    for (const t of [0.2, 0.8]) { c.beginPath(); c.ellipse(X, Y - h * t, rx, ry, 0, 0, Math.PI); c.stroke(); }
    c.fillStyle = '#9a6a40'; c.beginPath(); c.ellipse(X, Y - h, rx, ry, 0, 0, 7); c.fill();
    c.strokeStyle = 'rgba(40,20,8,0.6)'; c.lineWidth = 0.7; c.stroke();
  }
  function stall(s, seed) {
    const r = RH.rng(seed);
    const cols = pick(r, [['#b8402e', '#efe2c0'], ['#2f5e98', '#e8cf60'], ['#3e7a3a', '#efe2c0'], ['#8a3a6a', '#e8d8b0']]);
    return sprite(s, -36, -62, 72, 82, (c) => {
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(4, 2, 28, 10, 0, 0, 7); c.fill();
      const P = box(c, 0, 2, 0, 24, 14, 11, '#7a5434');
      // goods
      for (let i = 0; i < 9; i++) { const p = P(-10 + (i % 3) * 7 + r() * 2, -3 + Math.floor(i / 3) * 4, 11); c.fillStyle = pick(r, ['#d8622a', '#a7c940', '#e8d27a', '#c8463a', '#8a5a3a', '#e8e0c8']); c.beginPath(); c.ellipse(p[0], p[1] - 1.5, 2.6, 1.8, 0, 0, 7); c.fill(); }
      // posts
      c.strokeStyle = '#4a3020'; c.lineWidth = 2;
      for (const [x, y] of [[-12, -6], [12, -6], [-12, 10], [12, 10]]) { const a = P(x, y, 0), b = P(x, y, y < 0 ? 34 : 26); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
      // awning (sloped quad) with stripes
      const a0 = P(-14, 13, 25), a1 = P(14, 13, 25), b1 = P(14, -8, 35), b0 = P(-14, -8, 35);
      c.save(); c.beginPath(); c.moveTo(a0[0], a0[1]); c.lineTo(a1[0], a1[1]); c.lineTo(b1[0], b1[1]); c.lineTo(b0[0], b0[1]); c.closePath(); c.clip();
      for (let i = 0; i < 7; i++) {
        const t0 = i / 7, t1 = (i + 1) / 7;
        const p = (t, k) => [a0[0] + (a1[0] - a0[0]) * t + (b0[0] - a0[0]) * k, a0[1] + (a1[1] - a0[1]) * t + (b0[1] - a0[1]) * k];
        c.fillStyle = cols[i % 2]; c.beginPath(); const q1 = p(t0, 0), q2 = p(t1, 0), q3 = p(t1, 1), q4 = p(t0, 1); c.moveTo(q1[0], q1[1]); c.lineTo(q2[0], q2[1]); c.lineTo(q3[0], q3[1]); c.lineTo(q4[0], q4[1]); c.fill();
      }
      c.restore();
      // scalloped valance
      c.fillStyle = cols[0];
      for (let i = 0; i < 7; i++) { const t = (i + 0.5) / 7; const x = a0[0] + (a1[0] - a0[0]) * t, y = a0[1] + (a1[1] - a0[1]) * t; c.beginPath(); c.arc(x, y, 2.4, 0, Math.PI); c.fill(); }
      c.strokeStyle = 'rgba(40,20,10,0.5)'; c.lineWidth = 0.7; c.beginPath(); c.moveTo(a0[0], a0[1]); c.lineTo(a1[0], a1[1]); c.lineTo(b1[0], b1[1]); c.stroke();
    });
  }
  function tent(s, seed) {
    const r = RH.rng(seed);
    const canvasCol = pick(r, ['#d8c8a0', '#cdb98c', '#c8b48a', '#a8a070']);
    return sprite(s, -40, -50, 80, 70, (c) => {
      const P = (x, y, z) => [x - y, (x + y) / 2 - z];
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(5, 3, 30, 11, 0, 0, 7); c.fill();
      const hX = 15, hY = 12, H = 28;
      const n0 = P(-hX, -hY, 0), n1 = P(hX, -hY, 0), s0 = P(-hX, hY, 0), s1 = P(hX, hY, 0), r0 = P(-hX - 2, 0, H), r1 = P(hX + 2, 0, H);
      const q = (pts, fill) => { c.fillStyle = fill; c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); c.fill(); };
      q([s0, s1, r1, r0], sh(canvasCol, 1));
      q([s1, n1, r1], sh(canvasCol, 0.72));
      c.fillStyle = '#2a1e12'; c.beginPath(); const d0 = P(hX, 6, 0), d1 = P(hX, -6, 0), d2 = P(hX + 1, 0, H * 0.75); c.moveTo(d0[0], d0[1]); c.lineTo(d2[0], d2[1]); c.lineTo(d1[0], d1[1]); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(60,40,20,0.5)'; c.lineWidth = 0.7;
      for (let i = 1; i < 5; i++) { const t = i / 5; c.beginPath(); c.moveTo(s0[0] + (s1[0] - s0[0]) * t, s0[1] + (s1[1] - s0[1]) * t); c.lineTo(r0[0] + (r1[0] - r0[0]) * t, r0[1] + (r1[1] - r0[1]) * t); c.stroke(); }
      c.strokeStyle = '#4a3020'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(r0[0], r0[1] - 3); c.lineTo(r1[0], r1[1] - 3); c.stroke();
      if (r() < 0.5) { c.fillStyle = 'rgba(120,60,30,0.5)'; const p = P(-4, hY, 10); c.fillRect(p[0] - 3, p[1] - 3, 7, 5); }
    });
  }
  function logPile(s, seed) {
    const r = RH.rng(seed);
    return sprite(s, -36, -34, 72, 50, (c) => {
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(4, 2, 28, 9, 0, 0, 7); c.fill();
      const P = (x, y, z) => [x - y, (x + y) / 2 - z];
      const logs = [[-6, 0, 4.5], [0, 0, 4.5], [6, 0, 4.5], [-3, 0, 12], [3, 0, 12], [0, 0, 19]];
      logs.sort((a, b) => a[2] - b[2] || a[0] - b[0]);
      for (const [oy, , z] of logs) {
        const r0 = 4.4;
        const a = P(-14, oy, z), b = P(14, oy, z);
        c.fillStyle = sh('#7a5532', 0.85 + r() * 0.3);
        c.beginPath(); c.moveTo(a[0], a[1] - r0); c.lineTo(b[0], b[1] - r0); c.lineTo(b[0], b[1] + r0); c.lineTo(a[0], a[1] + r0); c.closePath(); c.fill();
        c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.moveTo(a[0], a[1] + r0 * 0.3); c.lineTo(b[0], b[1] + r0 * 0.3); c.lineTo(b[0], b[1] + r0); c.lineTo(a[0], a[1] + r0); c.closePath(); c.fill();
        c.fillStyle = '#d8b07a'; c.beginPath(); c.ellipse(b[0], b[1], r0 * 0.7, r0, 0, 0, 7); c.fill();
        c.strokeStyle = 'rgba(120,80,40,0.7)'; c.lineWidth = 0.6; c.beginPath(); c.ellipse(b[0], b[1], r0 * 0.35, r0 * 0.5, 0, 0, 7); c.stroke();
      }
    });
  }
  function fencePiece(s, mask) {
    return sprite(s, -34, -36, 68, 56, (c) => {
      const P = (x, y, z) => [x - y, (x + y) / 2 - z];
      const wood = '#7a6248';
      const rail = (x1, y1) => {
        for (const z of [7, 14]) { const a = P(0, 0, z), b = P(x1, y1, z); c.strokeStyle = '#3a2a18'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); c.strokeStyle = wood; c.lineWidth = 1.6; c.stroke(); }
      };
      if (mask & 1) rail(16, 0); if (mask & 2) rail(0, 16); if (mask & 4) rail(-16, 0); if (mask & 8) rail(0, -16);
      const a = P(0, 0, 0), b = P(0, 0, 19);
      c.strokeStyle = '#3a2a18'; c.lineWidth = 3.4; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
      c.strokeStyle = wood; c.lineWidth = 2.2; c.stroke();
    });
  }
  function hayStack(s, seed) {
    const r = RH.rng(seed);
    return sprite(s, -32, -42, 64, 58, (c) => {
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(4, 3, 24, 9, 0, 0, 7); c.fill();
      c.beginPath(); c.moveTo(-22, 2); c.bezierCurveTo(-22, -22, -8, -32, 0, -32); c.bezierCurveTo(10, -32, 22, -22, 22, 2); c.ellipse(0, 2, 22, 9, 0, 0, Math.PI, false); c.closePath();
      c.fillStyle = '#c69a40'; c.fill();
      c.save(); c.clip();
      const gr = c.createLinearGradient(-22, -30, 22, 4); gr.addColorStop(0, 'rgba(255,235,160,0.5)'); gr.addColorStop(1, 'rgba(60,30,0,0.5)');
      c.fillStyle = gr; c.fillRect(-24, -34, 48, 46);
      for (let i = 0; i < 140; i++) { const x = (r() - 0.5) * 44, y = -30 + r() * 34; c.strokeStyle = pick(r, ['rgba(240,210,120,0.8)', 'rgba(150,100,30,0.7)', 'rgba(210,170,80,0.8)']); c.lineWidth = 0.7; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (r() - 0.5) * 3, y + 3 + r() * 3); c.stroke(); }
      c.restore();
    });
  }
  function brazier(s) {
    return sprite(s, -10, -40, 20, 46, (c) => {
      c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(1, 1, 7, 3, 0, 0, 7); c.fill();
      c.strokeStyle = '#2a2420'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -26); c.stroke();
      c.strokeStyle = '#4a3a2a'; c.lineWidth = 1; c.beginPath(); c.moveTo(-1, 0); c.lineTo(-1, -26); c.stroke();
      c.fillStyle = '#3a302a'; c.beginPath(); c.moveTo(-5, -30); c.lineTo(5, -30); c.lineTo(3, -25); c.lineTo(-3, -25); c.closePath(); c.fill();
    });
  }
  function nightTint(img, k) {
    const x = img.getContext('2d');
    x.save(); x.setTransform(1, 0, 0, 1, 0, 0);
    x.globalCompositeOperation = 'source-atop';
    x.fillStyle = `rgba(18,26,62,${k})`; x.fillRect(0, 0, img.width, img.height);
    x.restore();
  }

  function padGrid(g, M, theme) {
    if (!M) return g;
    const w = g.w + 2 * M, h = g.h + 2 * M;
    const ch = new Array(w * h), walk = new Uint8Array(w * h);
    const r = RH.rng(77);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const ox = x - M, oy = y - M, i = y * w + x;
      if (ox >= 0 && oy >= 0 && ox < g.w && oy < g.h) { ch[i] = g.ch[oy * g.w + ox]; walk[i] = g.walk[oy * g.w + ox]; }
      else { ch[i] = (theme !== 'forest' && r() < 0.25) ? '.' : 'T'; walk[i] = 0; }
    }
    return { w, h, ch, walk, M };
  }

  // ---------- scene ----------
  // Returns { ground, s, X0, Y0, objs: [{img, sx,sy,sw,sh (src px), X,Y,w,h (iso dest), d, bx0..}] }
  iso.buildScene = function (g0, opts) {
    const theme = opts.theme || 'forest';
    const M = opts.margin != null ? opts.margin : 3;
    const g = padGrid(g0, M, theme);
    const torches0 = opts.torches || [];
    opts = Object.assign({}, opts, { torches: torches0.map((t) => ({ x: t.x + M * T, y: t.y + M * T })) });
    const night = !!opts.night;
    const r = RH.rng(opts.seed || 1);
    const W = g.w, H = g.h;
    const isoW = (W + H) * T, isoH = (W + H) * T / 2;
    const pad = 120;
    const s = opts.scale || Math.min(2, 4096 / (isoW + pad * 2), 4096 / (isoH + pad * 2 + 140));
    const X0 = -H * T - pad, Y0 = -pad - 140;
    const at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 'T' : g.ch[y * W + x];
    const isWall = (x, y) => at(x, y) === '#';
    const walkable = (x, y) => x >= 0 && y >= 0 && x < W && y < H && g.walk[y * W + x] === 1;
    // bridges: path tiles whose row (or column) of path ends in water on both sides
    const bridges = new Uint8Array(W * H);
    const isPathC = (ch) => ch === ',' || ch === 'f';
    const runEnds = (x, y, dx, dy) => { let k = 1; while (k < 5 && isPathC(at(x + dx * k, y + dy * k))) k++; return at(x + dx * k, y + dy * k) === 'w'; };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!isPathC(at(x, y))) continue;
      if (runEnds(x, y, -1, 0) && runEnds(x, y, 1, 0) && at(x, y - 1) !== 'w') bridges[y * W + x] = 2; // walk north-south over water
      else if (runEnds(x, y, 0, -1) && runEnds(x, y, 0, 1)) bridges[y * W + x] = 1;
    }
    const top = paintGround(g, theme, s >= 1.6 ? 2 : 1.5, r, bridges);
    const ground = cv((isoW + pad * 2) * s, (isoH + pad * 2 + 140) * s);
    const gc = ground.getContext('2d');
    // iso transform: canvas = s * (iso - origin)
    gc.setTransform(s, s / 2, -s, s / 2, -X0 * s, -Y0 * s);
    gc.imageSmoothingEnabled = true;
    gc.drawImage(top, 0, 0, W * T, H * T);
    // soft shadows (top-down, low-res, skewed)
    const shq = 0.25;
    const shC = cv(W * T * shq, H * T * shq), shx = shC.getContext('2d');
    shx.scale(shq, shq); shx.fillStyle = '#000';
    const sv = [0.95, 0.32];
    const castShadow = (x, y, w, h, len) => {
      for (let k = 0; k <= 6; k++) { const t = k / 6 * len; shx.fillRect(x + sv[0] * t, y + sv[1] * t, w, h); }
    };

    // ---- objects ----
    const objs = [];
    const add = (spr, ax, ay, d, tx, ty, height, extra) => {
      // ax, ay: iso anchor (absolute). spr.left/top relative
      objs.push(Object.assign({ img: spr.img, sx: 0, sy: 0, sw: spr.img.width, sh: spr.img.height, X: ax + spr.left, Y: ay + spr.top, w: spr.w, h: spr.h, d, tx, ty, height, dyn: false }, extra || {}));
    };
    const tc = (tx, ty) => [(tx - ty) * T, (tx + ty + 1) * T / 2]; // iso of tile centre
    // walls
    const isOutside = (x, y) => { const ch = at(x, y); return ch === '.' || ch === ',' || ch === 'T' || ch === 'w' || ch === 'b' || x < 0 || y < 0 || x >= W || y >= H; };
    const wallH = new Float32Array(W * H);
    const perim = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!isWall(x, y)) continue;
      const p = isOutside(x - 1, y) || isOutside(x + 1, y) || isOutside(x, y - 1) || isOutside(x, y + 1) || isOutside(x - 1, y - 1) || isOutside(x + 1, y + 1) || isOutside(x + 1, y - 1) || isOutside(x - 1, y + 1);
      perim[y * W + x] = p ? 1 : 0;
      wallH[y * W + x] = theme === 'castle' ? (p ? 50 : 32) : (p ? 38 : 28);
    }
    const towerAt = new Uint8Array(W * H);
    if (theme !== 'forest') for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!isWall(x, y) || !perim[y * W + x]) continue;
      const h = isWall(x - 1, y) || isWall(x + 1, y), v = isWall(x, y - 1) || isWall(x, y + 1);
      const corner = (isWall(x - 1, y) || isWall(x + 1, y)) && (isWall(x, y - 1) || isWall(x, y + 1)) && !(isWall(x - 1, y) && isWall(x + 1, y)) && !(isWall(x, y - 1) && isWall(x, y + 1));
      const endH = h && !v && (walkable(x - 1, y) || walkable(x + 1, y)) && !(isWall(x - 1, y) && isWall(x + 1, y));
      const endV = v && !h && (walkable(x, y - 1) || walkable(x, y + 1)) && !(isWall(x, y - 1) && isWall(x, y + 1));
      if (corner || endH || endV) towerAt[y * W + x] = 1;
    }
    // avoid adjacent towers
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (towerAt[y * W + x] && ((x > 0 && towerAt[y * W + x - 1]) || (y > 0 && towerAt[(y - 1) * W + x]))) towerAt[y * W + x] = 0;
    const wallCache = {};
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!isWall(x, y)) continue;
      const i = y * W + x, h = wallH[i];
      const [ax, ay] = tc(x, y);
      castShadow(x * T, y * T, T, T, h * 0.7);
      if (towerAt[i]) {
        const tw = tower(s, 21, h + 26, theme, 99 + i);
        add(tw, ax, ay, (x + y + 1) * T + 2, x, y, h + 80, { fade: 1 });
        continue;
      }
      const sw = !isWall(x, y + 1) || wallH[(y + 1) * W + x] < h || towerAt[(y + 1) * W + x];
      const se = !isWall(x + 1, y) || wallH[y * W + x + 1] < h || towerAt[y * W + x + 1];
      const cren = perim[i] && theme === 'castle';
      const key = `${h}|${sw}|${se}|${cren}|${(x * 7 + y * 3) % 3}`;
      const spr = wallCache[key] || (wallCache[key] = wallBlock(s, h, sw, se, cren, theme, 500 + (x * 7 + y * 3) % 3));
      add(spr, ax, ay, (x + y + 1) * T, x, y, h, { fade: 1 });
    }
    // buildings from 'r' rectangles
    const used = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (at(x, y) !== 'r' || used[y * W + x]) continue;
      let w = 0; while (x + w < W && at(x + w, y) === 'r' && !used[y * W + x + w]) w++;
      let h = 1;
      outer: while (y + h < H) { for (let k = 0; k < w; k++) if (at(x + k, y + h) !== 'r' || used[(y + h) * W + x + k]) break outer; h++; }
      // split very long thin halls into segments for variety
      const segs = [];
      if (w >= h) { let sx = x; while (sx < x + w) { const sw = Math.min(x + w - sx, Math.max(3, Math.min(7, 3 + Math.floor(r() * 5)))); segs.push({ x: sx, y, w: (x + w - sx - sw) < 2 ? x + w - sx : sw, h }); sx += segs[segs.length - 1].w; } }
      else { let sy = y; while (sy < y + h) { const shh = Math.min(y + h - sy, Math.max(3, Math.min(6, 3 + Math.floor(r() * 4)))); segs.push({ x, y: sy, w, h: (y + h - sy - shh) < 2 ? y + h - sy : shh }); sy += segs[segs.length - 1].h; } }
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) used[yy * W + xx] = 1;
      for (const b of segs) {
        let front = false; for (let k = 0; k < b.w; k++) if (walkable(b.x + k, b.y + b.h)) front = true;
        const spr = building(s, b, theme === 'castle' ? 'castle' : 'town', r, front);
        castShadow(b.x * T, b.y * T, b.w * T, b.h * T, spr.height * 0.7);
        // depth strips
        const kmin = b.x - (b.y + b.h - 1) - 1, kmax = (b.x + b.w - 1) - b.y;
        for (let k = kmin; k <= kmax; k++) {
          let d = -1e9;
          for (let ty = b.y; ty < b.y + b.h; ty++) for (let tx = b.x; tx < b.x + b.w; tx++) { const c = tx - ty; if (c === k || c === k + 1) d = Math.max(d, (tx + ty + 1) * T); }
          let X0s = k * T, X1s = (k + 1) * T;
          if (k === kmin) X0s = spr.left; if (k === kmax) X1s = spr.left + spr.w;
          X0s = Math.max(X0s, spr.left); X1s = Math.min(X1s, spr.left + spr.w);
          if (X1s <= X0s) continue;
          const sx = (X0s - spr.left) * s, sw = (X1s - X0s) * s;
          objs.push({ img: spr.img, sx, sy: 0, sw, sh: spr.img.height, X: X0s, Y: spr.top, w: X1s - X0s, h: spr.h, d: d + 1, tx: b.x + b.w - 1, ty: b.y + b.h - 1, height: spr.height, dyn: false, bld: b });
        }
      }
    }
    // trees, bushes, props
    const treeVar = [], treeVarBig = [];
    const pals = theme === 'castle' ? [0, 1, 2, 5] : theme === 'town' ? [0, 1, 2, 3, 5] : [0, 1, 2, 3, 4, 5, 0, 1];
    for (let i = 0; i < 10; i++) { const p = TREE_PALS[pals[i % pals.length]]; treeVar.push(tree(s, p, 1000 + i * 17, false)); }
    for (let i = 0; i < 4; i++) { const p = TREE_PALS[pals[(i * 3) % pals.length]]; treeVarBig.push(tree(s, p, 2000 + i * 31, true)); }
    const bushVar = [];
    for (let i = 0; i < 6; i++) bushVar.push(bush(s, TREE_PALS[[0, 1, 5, 0, 2, 1][i]], 3000 + i * 13, [null, '#c23a4a', null, '#efe8d0', null, '#e8c040'][i]));
    const fenceCache = {};
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const ch = at(x, y);
      const [ax, ay] = tc(x, y);
      const d = (x + y + 1) * T;
      const rr = RH.rng(x * 73856093 ^ y * 19349663);
      switch (ch) {
        case 'T': {
          const big = rr() < 0.2;
          const spr = big ? treeVarBig[Math.floor(rr() * treeVarBig.length)] : treeVar[Math.floor(rr() * treeVar.length)];
          const jx = (rr() - 0.5) * 14, jy = (rr() - 0.5) * 7;
          add(spr, ax + jx, ay + jy, d + jy * 2, x, y, 80, { fade: 1 });
          shx.globalAlpha = 0.6; shx.beginPath(); shx.ellipse(x * T + 16 + 26, y * T + 16 + 10, 28, 20, 0.3, 0, 7); shx.fill(); shx.globalAlpha = 1;
          break;
        }
        case 'b': add(bushVar[Math.floor(rr() * bushVar.length)], ax + (rr() - 0.5) * 6, ay + 2, d + 10, x, y, 26); break;
        case 'h': add(hayStack(s, 4000 + x * 31 + y), ax, ay + 1, d + 10, x, y, 34); break;
        case 'c': add(crateStack(s, 5000 + x * 13 + y * 7), ax, ay, d, x, y, 30); castShadow(x * T + 4, y * T + 4, 24, 24, 18); break;
        case 'm': add(stall(s, 6000 + x * 11 + y * 5), ax, ay, d, x, y, 38); castShadow(x * T + 4, y * T + 6, 24, 20, 26); break;
        case 'p': add(tent(s, 7000 + x * 3 + y), ax, ay, d, x, y, 30); castShadow(x * T + 2, y * T + 4, 28, 24, 22); break;
        case 'l': add(logPile(s, 8000 + x + y * 3), ax, ay, d, x, y, 22); break;
        case 'x': {
          const m = (at(x + 1, y) === 'x' ? 1 : 0) | (at(x, y + 1) === 'x' ? 2 : 0) | (at(x - 1, y) === 'x' ? 0 : 0) | (at(x, y - 1) === 'x' ? 0 : 0);
          const spr = fenceCache[m] || (fenceCache[m] = fencePiece(s, m));
          add(spr, ax, ay, d, x, y, 20);
          break;
        }
      }
    }
    // bridge rails along the outer edges
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const b = bridges[y * W + x]; if (!b) continue;
      const m = b === 1 ? 1 : 2;
      const spr = fenceCache['b' + m] || (fenceCache['b' + m] = fencePiece(s, m));
      const put = (wx, wy) => add(spr, wx - wy, (wx + wy) / 2, wx + wy, x, y, 20);
      if (b === 2) {
        if (!bridges[y * W + x - 1]) { put(x * T + 2, y * T); put(x * T + 2, y * T + 16); }
        if (!bridges[y * W + x + 1]) { put(x * T + 30, y * T); put(x * T + 30, y * T + 16); }
      } else {
        if (!bridges[(y - 1) * W + x]) { put(x * T, y * T + 2); put(x * T + 16, y * T + 2); }
        if (!bridges[(y + 1) * W + x]) { put(x * T, y * T + 30); put(x * T + 16, y * T + 30); }
      }
    }
    // torches (posts)
    const braz = brazier(s);
    for (const t of opts.torches || []) {
      const tx = Math.floor(t.x / T), ty = Math.floor(t.y / T);
      if (isWall(tx, ty)) continue;
      add(braz, t.x - t.y, (t.x + t.y) / 2, t.x + t.y + 2, tx, ty, 30);
    }
    // shadows onto the ground
    gc.save();
    gc.globalAlpha = 0.32; gc.drawImage(shC, 0, 0, W * T, H * T);
    gc.restore();

    // ---- dynamic vs baked ----
    objs.sort((a, b) => a.d - b.d);
    const dynTile = new Uint8Array(W * H);
    const reach = (o) => Math.min(9, Math.ceil((o.height + 20) / 16));
    for (const o of objs) {
      if (opts.bakeAll) { o.dyn = false; continue; }
      const n = reach(o);
      let dyn = !!o.bld;
      const bx = o.tx, by = o.ty;
      if (!dyn) for (let dy = 0; dy <= n && !dyn; dy++) for (let dx = 0; dx <= n - dy && !dyn; dx++) {
        if (!dx && !dy) continue;
        if (Math.abs(dx - dy) > 2) continue;
        const qx = bx - dx, qy = by - dy;
        if (walkable(qx, qy) || (qx >= 0 && qy >= 0 && qx < W && qy < H && dynTile[qy * W + qx])) dyn = true;
      }
      o.dyn = dyn;
      if (dyn && bx >= 0 && by >= 0 && bx < W && by < H) dynTile[by * W + bx] = 1;
    }
    // bake static objects into the ground layer in depth order
    gc.setTransform(s, 0, 0, s, -X0 * s, -Y0 * s);
    for (const o of objs) if (!o.dyn) gc.drawImage(o.img, o.sx, o.sy, o.sw, o.sh, o.X, o.Y, o.w, o.h);
    // night: blue multiply + baked torch pools; dynamic sprites tinted
    if (night) {
      gc.setTransform(1, 0, 0, 1, 0, 0);
      gc.globalCompositeOperation = 'source-atop';
      gc.fillStyle = 'rgba(14,22,60,0.62)'; gc.fillRect(0, 0, ground.width, ground.height);
      gc.globalCompositeOperation = 'lighter';
      for (const t of opts.torches || []) {
        const X = (t.x - t.y - X0) * s, Y = ((t.x + t.y) / 2 - Y0) * s, R = 3.4 * T * s * 1.3;
        const gr = gc.createRadialGradient(X, Y, 0, X, Y, R);
        gr.addColorStop(0, 'rgba(255,150,60,0.42)'); gr.addColorStop(0.5, 'rgba(200,100,40,0.18)'); gr.addColorStop(1, 'rgba(160,80,30,0)');
        gc.fillStyle = gr; gc.save(); gc.translate(X, Y); gc.scale(1, 0.5); gc.translate(-X, -Y); gc.fillRect(X - R, Y - R, R * 2, R * 2); gc.restore();
      }
      gc.globalCompositeOperation = 'source-over';
      const seen = new Set();
      for (const o of objs) if (o.dyn && !seen.has(o.img)) { seen.add(o.img); nightTint(o.img, 0.55); }
    }
    // background pattern of endless forest for the area outside the map
    const pat = cv(256 * s, 128 * s), px = pat.getContext('2d');
    px.setTransform(s, 0, 0, s, 0, 0);
    px.fillStyle = theme === 'forest' ? '#2c3a1a' : '#34401f'; px.fillRect(0, 0, 256, 128);
    const pr = RH.rng(4242), pt = [];
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) pt.push([i * 64 + (j % 2) * 32 + (pr() - 0.5) * 10, j * 32 + 8 + (pr() - 0.5) * 6]);
    pt.sort((a, b) => a[1] - b[1]);
    for (let pass = 0; pass < 2; pass++) for (const [x, y] of pt) {
      const sp = treeVar[Math.floor(pr() * treeVar.length)];
      for (const ox of [-256, 0, 256]) for (const oy of [-128, 0, 128]) {
        const X = x + ox + sp.left, Y = y + oy + sp.top + (pass ? 0 : -16);
        if (X > 256 || Y > 128 || X + sp.w < 0 || Y + sp.h < 0) continue;
        px.drawImage(sp.img, X, Y, sp.w, sp.h);
      }
    }
    if (night) { px.setTransform(1, 0, 0, 1, 0, 0); px.globalCompositeOperation = 'source-atop'; px.fillStyle = 'rgba(14,22,60,0.62)'; px.fillRect(0, 0, pat.width, pat.height); }
    const dyn = objs.filter((o) => o.dyn);
    const dY = M * T, dD = 2 * M * T;
    for (const o of dyn) { o.Y -= dY; o.d -= dD; o.bx1 = o.X + o.w; o.by1 = o.Y + o.h; }
    return { ground, pat, s, X0, Y0: Y0 - dY, objs: dyn, nObjs: objs.length, isoW, isoH, top: opts.keepTop ? top : null };
  };

  // shared sprites for the renderer (glow)
  iso.glow = function (col0, col1) {
    const c = cv(128, 128), x = c.getContext('2d');
    const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, col0); gr.addColorStop(1, col1);
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    return c;
  };
  iso._tree = tree; iso._tower = tower; iso._building = building; iso.TREE_PALS = TREE_PALS;
})(window.RH);
