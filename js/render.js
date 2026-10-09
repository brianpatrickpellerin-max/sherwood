// Canvas renderer: cached static map layer, procedural sprites, view cones, night lighting.
'use strict';
(function (RH) {
  const TILE = RH.TILE;
  const R = {};
  RH.render = R;
  const G = RH.G;
  const OUT = '#1b140d';
  let staticC = null, staticS = 2, darkC = null, darkX = null, lightSprite = null, glowSprite = null;
  let now = 0;
  const units = [];
  const sortY = (a, b) => a.y - b.y;

  // ---------- Static layer ----------
  function rnd(seed) { return RH.rng(seed); }
  R.buildStatic = function () {
    const g = G.grid;
    const W = g.w * TILE, H = g.h * TILE;
    staticS = Math.min(2, 4096 / Math.max(W, H));
    staticC = document.createElement('canvas');
    staticC.width = Math.ceil(W * staticS); staticC.height = Math.ceil(H * staticS);
    const c = staticC.getContext('2d');
    c.scale(staticS, staticS);
    const r = rnd(1234 + G.idx * 77);
    const town = g.ch.filter((x) => x === 'f').length > g.ch.length * 0.15;
    const at = (x, y) => (x < 0 || y < 0 || x >= g.w || y >= g.h) ? 'T' : g.ch[y * g.w + x];
    // ground
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      const ch = at(x, y), px = x * TILE, py = y * TILE;
      let base;
      if (ch === ',') base = 'path';
      else if (ch === 'f' || (town && (ch === 'h' || ch === 'c' || ch === 'm'))) base = 'cob';
      else if (ch === 'd') base = 'wood';
      else if (ch === 'w') base = 'water';
      else if (ch === '#' || ch === 'r') base = 'stone';
      else base = 'grass';
      groundTile(c, base, px, py, r, x, y, at);
    }
    // soft shadows cast to the south-east by tall things
    c.fillStyle = 'rgba(10,15,5,0.28)';
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      const ch = at(x, y);
      if (ch === '#' || ch === 'r' || ch === 'T' || ch === 'p' || ch === 'm') {
        const px = x * TILE, py = y * TILE;
        if (!'#rTpm'.includes(at(x, y + 1))) c.fillRect(px + 4, py + TILE, TILE, 9);
        if (!'#rTpm'.includes(at(x + 1, y))) c.fillRect(px + TILE, py + 6, 7, TILE);
      }
    }
    // objects row by row
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      const ch = at(x, y), px = x * TILE, py = y * TILE;
      switch (ch) {
        case '#': wall(c, px, py, at, x, y, r); break;
        case 'r': roof(c, px, py, at, x, y, r); break;
        case 'c': crate(c, px, py, r); break;
        case 'm': stall(c, px, py, at, x, y); break;
        case 'p': tent(c, px, py, r); break;
        case 'l': logs(c, px, py); break;
        case 'x': fence(c, px, py, at, x, y); break;
        case 'h': hay(c, px, py, r); break;
      }
    }
    // bushes and trees on top
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      const ch = at(x, y), px = x * TILE, py = y * TILE;
      if (ch === 'b') bush(c, px, py, r);
    }
    for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
      if (at(x, y) === 'T') tree(c, x * TILE, y * TILE, r, at, x, y);
    }
  };

  function groundTile(c, base, px, py, r, x, y, at) {
    if (base === 'grass') {
      const v = r();
      c.fillStyle = v < 0.33 ? '#4d7a31' : v < 0.66 ? '#527f34' : '#4a742f';
      c.fillRect(px, py, TILE + 0.5, TILE + 0.5);
      c.strokeStyle = 'rgba(140,190,80,0.35)'; c.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        const gx = px + r() * TILE, gy = py + r() * TILE;
        c.beginPath(); c.moveTo(gx, gy); c.lineTo(gx - 1.5, gy - 4); c.moveTo(gx + 2, gy); c.lineTo(gx + 3, gy - 4); c.stroke();
      }
      if (r() < 0.08) { c.fillStyle = r() < 0.5 ? '#f3e7a0' : '#e9a6c9'; c.beginPath(); c.arc(px + r() * TILE, py + r() * TILE, 1.6, 0, 7); c.fill(); }
    } else if (base === 'path') {
      c.fillStyle = '#9c7b4d'; c.fillRect(px, py, TILE + 0.5, TILE + 0.5);
      // soft edges onto grass
      c.fillStyle = 'rgba(80,110,40,0.5)';
      if (at(x - 1, y) !== ',') c.fillRect(px, py, 3, TILE);
      if (at(x + 1, y) !== ',') c.fillRect(px + TILE - 3, py, 3, TILE);
      c.fillStyle = 'rgba(60,40,20,0.35)';
      for (let i = 0; i < 5; i++) { c.beginPath(); c.arc(px + r() * TILE, py + r() * TILE, 1 + r() * 1.5, 0, 7); c.fill(); }
      c.strokeStyle = 'rgba(70,50,25,0.25)'; c.beginPath(); c.moveTo(px + 10, py); c.lineTo(px + 10, py + TILE); c.moveTo(px + 22, py); c.lineTo(px + 22, py + TILE); c.stroke();
    } else if (base === 'cob') {
      c.fillStyle = '#7f776a'; c.fillRect(px, py, TILE + 0.5, TILE + 0.5);
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
        const off = (j % 2) * 4;
        const v = 120 + Math.floor(r() * 30);
        c.fillStyle = `rgb(${v + 14},${v + 8},${v - 6})`;
        c.beginPath(); c.roundRect(px + i * 8 + off - 3 + 1, py + j * 8 + 1, 6.5, 6.5, 2); c.fill();
      }
    } else if (base === 'wood') {
      c.fillStyle = '#6b4a2e'; c.fillRect(px, py, TILE + 0.5, TILE + 0.5);
      c.strokeStyle = 'rgba(30,18,8,0.5)'; c.lineWidth = 1;
      for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(px, py + i * 8 + 0.5); c.lineTo(px + TILE, py + i * 8 + 0.5); c.stroke(); }
      c.fillStyle = 'rgba(160,40,40,0.35)'; // red carpet hint
      if ((x + y) % 7 === 0) c.fillRect(px + 2, py + 2, 2, 2);
    } else if (base === 'water') {
      c.fillStyle = '#2f6f8f'; c.fillRect(px, py, TILE + 0.5, TILE + 0.5);
      c.strokeStyle = 'rgba(190,230,255,0.35)'; c.lineWidth = 1.2;
      for (let i = 0; i < 2; i++) { const wx = px + 4 + r() * 18, wy = py + 6 + r() * 20; c.beginPath(); c.moveTo(wx, wy); c.quadraticCurveTo(wx + 4, wy - 3, wx + 8, wy); c.stroke(); }
      c.fillStyle = 'rgba(20,40,30,0.35)';
      if (at(x, y - 1) !== 'w') c.fillRect(px, py, TILE, 4);
    } else {
      c.fillStyle = '#5d564b'; c.fillRect(px, py, TILE + 0.5, TILE + 0.5);
    }
  }
  function wall(c, px, py, at, x, y, r) {
    const below = at(x, y + 1);
    c.fillStyle = '#a49882'; c.fillRect(px, py, TILE + 0.5, TILE + 0.5);
    c.strokeStyle = 'rgba(60,50,40,0.55)'; c.lineWidth = 1;
    for (let j = 0; j < 4; j++) {
      c.beginPath(); c.moveTo(px, py + j * 8 + 0.5); c.lineTo(px + TILE, py + j * 8 + 0.5); c.stroke();
      const off = (j % 2) * 8;
      for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(px + off + i * 16 + 0.5, py + j * 8); c.lineTo(px + off + i * 16 + 0.5, py + j * 8 + 8); c.stroke(); }
    }
    c.fillStyle = 'rgba(255,240,210,0.18)'; c.fillRect(px, py, TILE, 3);
    if (below !== '#' && below !== 'r') {
      // front face
      c.fillStyle = '#6f6455'; c.fillRect(px, py + TILE - 8, TILE + 0.5, 8);
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(px, py + TILE - 1, TILE, 1);
    }
    if (r() < 0.05) { c.fillStyle = 'rgba(70,110,40,0.6)'; c.beginPath(); c.arc(px + r() * TILE, py + 20, 4, 0, 7); c.fill(); }
  }
  function roof(c, px, py, at, x, y, r) {
    const shade = ((x * 7 + y * 3) % 5) * 4;
    c.fillStyle = `rgb(${140 + shade},${62 + shade / 2},${42})`;
    c.fillRect(px, py, TILE + 0.5, TILE + 0.5);
    c.strokeStyle = 'rgba(60,20,10,0.45)'; c.lineWidth = 1;
    for (let j = 0; j < 4; j++) {
      c.beginPath(); c.moveTo(px, py + j * 8 + 7.5); c.lineTo(px + TILE, py + j * 8 + 7.5); c.stroke();
      for (let i = 0; i < 4; i++) { const ox = px + i * 8 + (j % 2) * 4; c.beginPath(); c.moveTo(ox, py + j * 8); c.lineTo(ox, py + j * 8 + 7.5); c.stroke(); }
    }
    if (at(x, y - 1) !== 'r') { c.fillStyle = 'rgba(255,220,180,0.25)'; c.fillRect(px, py, TILE, 3); }
    if (at(x, y + 1) !== 'r') { c.fillStyle = '#5a2a1c'; c.fillRect(px, py + TILE - 6, TILE + 0.5, 6); c.fillStyle = '#d9c7a4'; c.fillRect(px, py + TILE - 6, TILE, 1.5); }
    if (r() < 0.06 && at(x, y + 1) === 'r') { c.fillStyle = '#5b5148'; c.fillRect(px + 10, py + 6, 9, 11); c.fillStyle = '#2a2420'; c.fillRect(px + 11, py + 7, 7, 3); }
  }
  function crate(c, px, py, r) {
    if (r() < 0.5) {
      c.fillStyle = '#9a6a38'; c.strokeStyle = OUT; c.lineWidth = 1.4;
      c.beginPath(); c.roundRect(px + 3, py + 3, 26, 26, 2); c.fill(); c.stroke();
      c.strokeStyle = '#5a3a1a'; c.beginPath(); c.moveTo(px + 4, py + 4); c.lineTo(px + 28, py + 28); c.moveTo(px + 28, py + 4); c.lineTo(px + 4, py + 28); c.stroke();
    } else {
      for (const [ox, oy] of [[10, 11], [22, 13], [16, 22]]) {
        c.fillStyle = '#7a4f2a'; c.strokeStyle = OUT; c.lineWidth = 1.3;
        c.beginPath(); c.arc(px + ox, py + oy, 7, 0, 7); c.fill(); c.stroke();
        c.strokeStyle = '#3d2a18'; c.beginPath(); c.arc(px + ox, py + oy, 4.5, 0, 7); c.stroke();
      }
    }
  }
  function stall(c, px, py, at, x, y) {
    const left = at(x - 1, y) === 'm';
    c.fillStyle = '#6d4c2c'; c.fillRect(px + 2, py + 4, TILE - 2, TILE - 6);
    const cols = (x + y) % 2 ? ['#c43c2e', '#f1e3c2'] : ['#2f5ea8', '#f2cf55'];
    for (let i = 0; i < 4; i++) { c.fillStyle = cols[i % 2]; c.fillRect(px + (left ? 0 : 2) + i * 8, py + 1, 8, 18); }
    c.strokeStyle = OUT; c.lineWidth = 1.2; c.strokeRect(px + (left ? 0 : 2), py + 1, left ? TILE : TILE - 2, 18);
    for (let i = 0; i < 3; i++) { c.fillStyle = ['#e0662a', '#a7c940', '#e8d27a'][(x + i) % 3]; c.beginPath(); c.arc(px + 8 + i * 8, py + 24, 3.5, 0, 7); c.fill(); }
  }
  function tent(c, px, py, r) {
    c.fillStyle = '#d8c79e'; c.strokeStyle = OUT; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(px - 2, py + 30); c.lineTo(px + 16, py - 2); c.lineTo(px + 34, py + 30); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#b6a47a'; c.beginPath(); c.moveTo(px + 16, py - 2); c.lineTo(px + 34, py + 30); c.lineTo(px + 16, py + 30); c.closePath(); c.fill();
    c.fillStyle = '#3a2a18'; c.beginPath(); c.moveTo(px + 12, py + 30); c.lineTo(px + 16, py + 16); c.lineTo(px + 20, py + 30); c.fill();
  }
  function logs(c, px, py) {
    for (let i = 0; i < 3; i++) {
      c.fillStyle = '#7b5532'; c.strokeStyle = OUT; c.lineWidth = 1.3;
      c.beginPath(); c.roundRect(px + 1, py + 4 + i * 8, 30, 8, 4); c.fill(); c.stroke();
      c.fillStyle = '#d5b07a'; c.beginPath(); c.arc(px + 27, py + 8 + i * 8, 3, 0, 7); c.fill();
    }
  }
  function fence(c, px, py, at, x, y) {
    c.strokeStyle = '#6b4a2a'; c.lineWidth = 3; c.lineCap = 'round';
    const h = at(x - 1, y) === 'x' || at(x + 1, y) === 'x';
    const v = at(x, y - 1) === 'x' || at(x, y + 1) === 'x';
    c.beginPath();
    if (h) { c.moveTo(px, py + 12); c.lineTo(px + TILE, py + 12); c.moveTo(px, py + 20); c.lineTo(px + TILE, py + 20); }
    if (v || !h) { c.moveTo(px + 16, py); c.lineTo(px + 16, py + TILE); }
    c.stroke();
    c.fillStyle = '#4a3018'; c.fillRect(px + 13, py + 8, 6, 16);
    c.lineCap = 'butt';
  }
  function hay(c, px, py, r) {
    c.fillStyle = '#d9b44a'; c.strokeStyle = '#7a5a18'; c.lineWidth = 1.3;
    c.beginPath(); c.ellipse(px + 16, py + 18, 15, 12, 0, 0, 7); c.fill(); c.stroke();
    c.strokeStyle = 'rgba(120,80,20,0.6)'; c.lineWidth = 1;
    for (let i = 0; i < 7; i++) { const a = r() * 6.28, l = 4 + r() * 8; c.beginPath(); c.moveTo(px + 16, py + 17); c.lineTo(px + 16 + Math.cos(a) * l, py + 17 + Math.sin(a) * l * 0.8); c.stroke(); }
    c.fillStyle = 'rgba(255,240,170,0.4)'; c.beginPath(); c.ellipse(px + 12, py + 12, 6, 4, 0, 0, 7); c.fill();
  }
  function bush(c, px, py, r) {
    c.strokeStyle = '#17300f'; c.lineWidth = 1.5;
    const blobs = [[9, 18, 9], [22, 17, 9], [16, 10, 9], [15, 22, 8]];
    c.fillStyle = '#2f5f22';
    for (const [x, y, s] of blobs) { c.beginPath(); c.arc(px + x, py + y, s + 1.5, 0, 7); c.stroke(); }
    for (const [x, y, s] of blobs) { c.beginPath(); c.arc(px + x, py + y, s, 0, 7); c.fill(); }
    c.fillStyle = '#4c8a32';
    for (const [x, y, s] of blobs) { c.beginPath(); c.arc(px + x - 2, py + y - 2, s * 0.55, 0, 7); c.fill(); }
    if (r() < 0.4) { c.fillStyle = '#c23a4a'; for (let i = 0; i < 4; i++) { c.beginPath(); c.arc(px + 6 + r() * 20, py + 6 + r() * 18, 1.6, 0, 7); c.fill(); } }
  }
  function tree(c, px, py, r, at, x, y) {
    const cx = px + 16 + (r() - 0.5) * 6, cy = py + 14 + (r() - 0.5) * 6;
    const s = 19 + r() * 6;
    const edge = at(x, y + 1) !== 'T' || at(x - 1, y) !== 'T' || at(x + 1, y) !== 'T' || at(x, y - 1) !== 'T';
    if (edge && at(x, y + 1) !== 'T') { c.fillStyle = '#4a321c'; c.fillRect(px + 13, py + 18, 6, 14); }
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.arc(cx + 5, cy + 7, s, 0, 7); c.fill();
    c.fillStyle = '#1d3d17'; c.beginPath(); c.arc(cx, cy, s, 0, 7); c.fill();
    c.strokeStyle = '#0f220c'; c.lineWidth = 1.5; c.stroke();
    const tone = r() < 0.5 ? '#2c5a21' : '#336526';
    c.fillStyle = tone;
    c.beginPath(); c.arc(cx - s * 0.25, cy - s * 0.2, s * 0.65, 0, 7); c.fill();
    c.fillStyle = 'rgba(150,200,90,0.35)';
    c.beginPath(); c.arc(cx - s * 0.35, cy - s * 0.35, s * 0.3, 0, 7); c.fill();
  }

  // ---------- Sprites ----------
  const GUARD_LOOK = { tunic: '#8e2b25', trim: '#2c2c34', skin: '#e8be98', hair: '#3a2a1a', helmet: true, legs: '#3a3a44', weapon: 'spear' };
  const SHERIFF_LOOK = { tunic: '#2a2238', trim: '#d8b240', skin: '#e6c0a0', hair: '#1a1a1a', sheriffHat: true, legs: '#1d1a26', weapon: 'sword', big: true };
  const CIV_LOOKS = [
    { tunic: '#9a7a4a', trim: '#5a4a2a', skin: '#f0c8a0', hair: '#6a4020', legs: '#5a4a3a', hood: '#7a6040' },
    { tunic: '#5a7a8a', trim: '#e8dcc0', skin: '#e9bf96', hair: '#c09050', legs: '#4a4a4a', dress: true, kerchief: '#e8dcc0' },
    { tunic: '#7a5a8a', trim: '#e0c080', skin: '#d9a77c', hair: '#2a1a10', legs: '#3a3030' },
    { tunic: '#6a8a4a', trim: '#3a2a1a', skin: '#f2d0b0', hair: '#8a5a2a', legs: '#4a3a2a', dress: true },
  ];
  const CARTER_LOOK = { tunic: '#7a6a4a', trim: '#3a2a1a', skin: '#e8b890', hair: '#5a3a1a', legs: '#4a3a2a', hood: '#5a4a2a' };

  function heroLook(h) {
    const d = h.def || RH.HEROES[h.key];
    return d._look || (d._look = { tunic: d.tunic, trim: d.trim, skin: d.skin, hair: d.hair, hat: d.hat, legs: '#3b2f22', big: d.big, round: d.round, key: h.key, weapon: d.weapon, dress: h.key === 'marian' });
  }

  function person(c, x, y, u, L, opts) {
    const sc = L.big ? 1.2 : 1;
    const face = Math.cos(u.dir) >= -0.05 ? 1 : -1;
    const walk = u.moving ? Math.sin(u.anim) : 0;
    const bob = u.moving ? Math.abs(Math.sin(u.anim)) * 1.8 : Math.sin(now * 2 + u.bob) * 0.4;
    c.save();
    c.translate(x, y);
    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.beginPath(); c.ellipse(0, 0, 9 * sc, 3.6 * sc, 0, 0, 7); c.fill();
    c.scale(sc * face, sc);
    c.lineWidth = 1.3; c.strokeStyle = OUT; c.lineJoin = 'round';
    // legs
    c.fillStyle = L.legs;
    if (!L.dress && !L.round) {
      c.beginPath(); c.roundRect(-4.5 + walk * 2.2, -9, 3.6, 9, 1); c.fill(); c.stroke();
      c.beginPath(); c.roundRect(0.9 - walk * 2.2, -9, 3.6, 9, 1); c.fill(); c.stroke();
    } else {
      c.beginPath(); c.roundRect(-3.5 + walk * 1.5, -4, 3, 4, 1); c.fill(); c.stroke();
      c.beginPath(); c.roundRect(0.5 - walk * 1.5, -4, 3, 4, 1); c.fill(); c.stroke();
    }
    c.translate(0, -bob);
    // back weapon
    if (L.key === 'robin' && !(u.drawT > 0)) {
      c.strokeStyle = '#6b3e1a'; c.lineWidth = 2;
      c.beginPath(); c.arc(-3, -15, 9, -1.2, 1.2); c.stroke();
      c.strokeStyle = 'rgba(240,240,220,0.8)'; c.lineWidth = 0.7;
      c.beginPath(); c.moveTo(-3 + Math.cos(-1.2) * 9, -15 + Math.sin(-1.2) * 9); c.lineTo(-3 + Math.cos(1.2) * 9, -15 + Math.sin(1.2) * 9); c.stroke();
      c.fillStyle = '#7a4a22'; c.fillRect(-7, -22, 3, 9);
      c.strokeStyle = OUT; c.lineWidth = 1.3;
    }
    // body
    c.fillStyle = L.tunic;
    c.beginPath();
    if (L.dress) { c.moveTo(-5, -20); c.lineTo(5, -20); c.lineTo(8, -3); c.lineTo(-8, -3); c.closePath(); }
    else if (L.round) { c.ellipse(0, -11, 8, 9.5, 0, 0, 7); }
    else c.roundRect(-6, -20, 12, 12, 3);
    c.fill(); c.stroke();
    // belt / trim
    c.fillStyle = L.trim;
    if (L.round) c.fillRect(-7, -10, 14, 2);
    else if (L.dress) c.fillRect(-5.5, -14, 11, 2);
    else c.fillRect(-6, -11.5, 12, 2);
    if (L.helmet) { c.fillStyle = '#e8d8a0'; c.fillRect(-1.5, -19, 3, 7); } // tabard cross
    if (L.sheriffHat) { c.strokeStyle = '#e6c04a'; c.lineWidth = 1.2; c.beginPath(); c.arc(0, -18, 4.5, 0.2, Math.PI - 0.2); c.stroke(); c.strokeStyle = OUT; c.lineWidth = 1.3; }
    // weapon in hand
    const swing = u.swingT > 0 ? Math.sin((u.swingT / 0.25) * Math.PI) * 1.4 : 0;
    const wp = L.weapon;
    if (wp === 'staff') {
      c.save(); c.translate(6, -13); c.rotate(-0.35 - swing);
      c.strokeStyle = '#5b3a1a'; c.lineWidth = 2.6; c.beginPath(); c.moveTo(0, 10); c.lineTo(0, -16); c.stroke();
      c.restore();
    } else if (wp === 'spear') {
      c.save(); c.translate(7, -12); c.rotate(-swing * 0.8);
      c.strokeStyle = '#6a4a2a'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 10); c.lineTo(0, -18); c.stroke();
      c.fillStyle = '#cfd6dc'; c.strokeStyle = OUT; c.lineWidth = 1;
      c.beginPath(); c.moveTo(0, -24); c.lineTo(2.4, -18); c.lineTo(-2.4, -18); c.closePath(); c.fill(); c.stroke();
      c.restore();
    } else if (wp === 'sword' && !(u.drawT > 0)) {
      c.save(); c.translate(6, -11); c.rotate(0.5 - swing * 1.6);
      c.strokeStyle = '#dde4ea'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -12); c.stroke();
      c.strokeStyle = '#8a6a2a'; c.lineWidth = 2; c.beginPath(); c.moveTo(-2.5, 0); c.lineTo(2.5, 0); c.stroke();
      c.restore();
    }
    // bow draw
    if (u.drawT > 0) {
      const k = 1 - u.drawT / 0.45;
      c.strokeStyle = '#6b3e1a'; c.lineWidth = 2.2;
      c.beginPath(); c.arc(4, -14, 9, -1.1, 1.1); c.stroke();
      c.strokeStyle = 'rgba(250,250,230,0.9)'; c.lineWidth = 0.8;
      const sx = 4 + Math.cos(1.1) * 9 - k * 6;
      c.beginPath(); c.moveTo(4 + Math.cos(-1.1) * 9, -14 + Math.sin(-1.1) * 9); c.lineTo(sx, -14); c.lineTo(4 + Math.cos(1.1) * 9, -14 + Math.sin(1.1) * 9); c.stroke();
      c.strokeStyle = '#d9c08a'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(sx, -14); c.lineTo(sx + 14, -14); c.stroke();
      c.strokeStyle = OUT; c.lineWidth = 1.3;
    }
    // head
    const hy = L.round ? -23 : -24.5;
    c.fillStyle = L.skin;
    c.beginPath(); c.arc(0, hy, 5.6, 0, 7); c.fill(); c.stroke();
    // hair
    c.fillStyle = L.hair;
    if (L.key === 'tuck') {
      c.beginPath(); c.arc(0, hy, 5.6, Math.PI * 0.55, Math.PI * 1.15); c.lineTo(0, hy); c.fill();
      c.beginPath(); c.arc(0, hy, 5.6, -0.15, Math.PI * 0.45); c.lineTo(0, hy); c.fill();
    } else if (L.key === 'marian') {
      c.beginPath(); c.arc(0, hy - 1, 6, Math.PI * 0.9, Math.PI * 2.05); c.fill();
      c.beginPath(); c.moveTo(-5.5, hy); c.quadraticCurveTo(-8, hy + 8, -4, hy + 11); c.lineTo(-2, hy + 2); c.fill();
    } else if (!L.helmet && !L.sheriffHat && !L.hood) {
      c.beginPath(); c.arc(0, hy - 1, 5.8, Math.PI * 1.0, Math.PI * 2.0); c.fill();
      c.fillRect(-5.8, hy - 1, 2.5, 4);
    }
    if (L.key === 'john') { c.fillStyle = L.hair; c.beginPath(); c.arc(1.5, hy + 3, 4.2, 0.1, Math.PI - 0.3); c.fill(); }
    if (L.key === 'tuck') { c.fillStyle = 'rgba(255,255,255,0.25)'; c.beginPath(); c.arc(-1, hy - 3, 2, 0, 7); c.fill(); }
    // eye
    c.fillStyle = '#1a1210'; c.beginPath(); c.arc(2.6, hy - 0.5, 0.95, 0, 7); c.fill();
    // headgear
    if (L.hat) {
      c.fillStyle = L.hat;
      c.beginPath(); c.moveTo(-6.5, hy - 2); c.quadraticCurveTo(0, hy - 9, 7, hy - 2.5); c.lineTo(-8, hy - 10); c.closePath(); c.fill(); c.stroke();
      if (L.key === 'robin') { c.strokeStyle = '#d23b2e'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-3, hy - 5); c.quadraticCurveTo(-8, hy - 12, -12, hy - 11); c.stroke(); c.strokeStyle = OUT; c.lineWidth = 1.3; }
    }
    if (L.helmet) {
      c.fillStyle = '#9aa3ab';
      c.beginPath(); c.arc(0, hy - 1.5, 6, Math.PI, 0); c.fill(); c.stroke();
      c.beginPath(); c.ellipse(0, hy - 1.2, 8.5, 1.8, 0, 0, 7); c.fill(); c.stroke();
    }
    if (L.sheriffHat) {
      c.fillStyle = '#16121e';
      c.beginPath(); c.ellipse(0, hy - 3.5, 8.5, 2.4, 0, 0, 7); c.fill(); c.stroke();
      c.beginPath(); c.roundRect(-4.5, hy - 10, 9, 7, 2); c.fill(); c.stroke();
      c.fillStyle = '#d8b240'; c.fillRect(-4.5, hy - 5, 9, 1.4);
    }
    if (L.hood) { c.fillStyle = L.hood; c.beginPath(); c.arc(0, hy - 0.5, 6.3, Math.PI * 0.85, Math.PI * 2.15); c.fill(); c.stroke(); }
    if (L.kerchief) { c.fillStyle = L.kerchief; c.beginPath(); c.arc(0, hy - 1, 6, Math.PI, 0); c.fill(); c.stroke(); }
    c.restore();
  }

  function lying(c, x, y, u, L, kind) {
    c.save();
    c.translate(x, y);
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(0, 0, 14, 5, 0, 0, 7); c.fill();
    c.rotate(-Math.PI / 2); c.translate(4, 6);
    c.globalAlpha = kind === 'dead' ? 0.75 : 1;
    const fake = { dir: 0, moving: false, anim: 0, bob: 0, drawT: 0, swingT: 0 };
    const L2 = kind === 'dead' ? Object.assign({}, L, { tunic: '#5a3a36' }) : L;
    person(c, 0, 0, fake, Object.assign({}, L2, { weapon: null }), null);
    c.restore();
    if (u.tied) {
      c.strokeStyle = '#d9b46a'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(x - 6, y - 8); c.lineTo(x - 6, y + 2); c.moveTo(x + 2, y - 8); c.lineTo(x + 2, y + 2); c.stroke();
    }
  }

  // ---------- Frame ----------
  R.resize = function (canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const w = window.innerWidth, h = window.innerHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    R.W = w; R.H = h; R.dpr = dpr;
    darkC = document.createElement('canvas');
    darkC.width = Math.ceil(w / 2); darkC.height = Math.ceil(h / 2);
    darkX = darkC.getContext('2d');
    if (!lightSprite) {
      lightSprite = document.createElement('canvas'); lightSprite.width = lightSprite.height = 128;
      const lx = lightSprite.getContext('2d');
      const gr = lx.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.85)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      lx.fillStyle = gr; lx.fillRect(0, 0, 128, 128);
      glowSprite = document.createElement('canvas'); glowSprite.width = glowSprite.height = 128;
      const gx = glowSprite.getContext('2d');
      const g2 = gx.createRadialGradient(64, 64, 0, 64, 64, 64);
      g2.addColorStop(0, 'rgba(255,170,70,0.35)'); g2.addColorStop(1, 'rgba(255,120,40,0)');
      gx.fillStyle = g2; gx.fillRect(0, 0, 128, 128);
    }
  };

  R.toScreen = function (wx, wy, out) {
    const cam = G.cam;
    out.x = (wx - cam.x) * cam.z + R.W / 2; out.y = (wy - cam.y) * cam.z + R.H / 2;
    return out;
  };
  R.toWorld = function (sx, sy, out) {
    const cam = G.cam;
    out.x = (sx - R.W / 2) / cam.z + cam.x; out.y = (sy - R.H / 2) / cam.z + cam.y;
    return out;
  };
  const tmp = { x: 0, y: 0 };

  R.draw = function (ctx, dt) {
    now += dt;
    const W = R.W, H = R.H, dpr = R.dpr, cam = G.cam, z = cam.z;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = G.night ? '#0b120c' : '#1c2c14';
    ctx.fillRect(0, 0, W, H);
    // visible world rect
    const vx0 = cam.x - W / 2 / z, vy0 = cam.y - H / 2 / z, vx1 = cam.x + W / 2 / z, vy1 = cam.y + H / 2 / z;
    // static layer
    ctx.imageSmoothingEnabled = true;
    const sx = Math.max(0, vx0), sy = Math.max(0, vy0);
    const ex = Math.min(G.grid.w * TILE, vx1), ey = Math.min(G.grid.h * TILE, vy1);
    if (ex > sx && ey > sy) {
      ctx.drawImage(staticC, sx * staticS, sy * staticS, (ex - sx) * staticS, (ey - sy) * staticS,
        (sx - cam.x) * z + W / 2, (sy - cam.y) * z + H / 2, (ex - sx) * z, (ey - sy) * z);
    }
    // world transform
    ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (W / 2 - cam.x * z), dpr * (H / 2 - cam.y * z));
    const inView = (x, y, m) => x > vx0 - m && x < vx1 + m && y > vy0 - m && y < vy1 + m;

    // exit zone
    const e = G.exit;
    const pulse = 0.5 + 0.5 * Math.sin(now * 3);
    const objs = RH.game.objectives();
    const ready = objs.length && objs[objs.length - 1].ready;
    ctx.fillStyle = ready ? `rgba(120,255,120,${0.16 + pulse * 0.14})` : 'rgba(120,255,140,0.08)';
    ctx.fillRect(e.x * TILE, e.y * TILE, e.w * TILE, e.h * TILE);
    ctx.strokeStyle = ready ? `rgba(170,255,150,${0.6 + pulse * 0.4})` : 'rgba(170,255,150,0.35)';
    ctx.lineWidth = 2; ctx.setLineDash([6, 5]); ctx.lineDashOffset = -now * 12;
    ctx.strokeRect(e.x * TILE + 1, e.y * TILE + 1, e.w * TILE - 2, e.h * TILE - 2);
    ctx.setLineDash([]);

    // log on road
    if (G.log && !G.log.cleared) {
      ctx.fillStyle = '#6a4424'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(G.log.x - 40, G.log.y - 7, 80, 14, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#c9a06a'; ctx.beginPath(); ctx.ellipse(G.log.x + 38, G.log.y, 4, 6.5, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = '#2f5a1f'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(G.log.x - 20, G.log.y - 6); ctx.lineTo(G.log.x - 28, G.log.y - 16); ctx.moveTo(G.log.x + 5, G.log.y - 6); ctx.lineTo(G.log.x + 12, G.log.y - 15); ctx.stroke();
    }
    // gold
    for (const gd of G.gold) {
      if (gd.taken || !inView(gd.x, gd.y, 20)) continue;
      const b = Math.sin(now * 3 + gd.x) * 1.5;
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(gd.x, gd.y + 5, 6, 2.5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#8a5a22'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(gd.x, gd.y - 1 + b, 6, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffd84a'; ctx.beginPath(); ctx.arc(gd.x, gd.y - 5 + b, 3.4, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,220,' + (0.5 + 0.5 * Math.sin(now * 5 + gd.y)) + ')';
      ctx.fillRect(gd.x + 3, gd.y - 10 + b, 1.5, 1.5);
    }
    for (const cn of G.coins) {
      ctx.fillStyle = '#ffd84a'; ctx.strokeStyle = OUT; ctx.lineWidth = 1;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(cn.x - 5 + i * 3.5, cn.y + (i % 2) * 3, 2.6, 0, 7); ctx.fill(); ctx.stroke(); }
    }
    // cart
    if (G.cart) drawCart(ctx, G.cart);
    // chest on ground
    if (G.chest && !G.chest.carrier && !G.chest.onCart) drawChest(ctx, G.chest.x, G.chest.y, 1);

    // view cones (day: under units)
    if (!G.night) drawCones(ctx, inView, 1);

    // selection rings + paths
    for (const h of G.sel) {
      if (h.down) continue;
      ctx.strokeStyle = 'rgba(255,230,90,0.95)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(h.x, h.y, 12, 5.5, 0, 0, 7); ctx.stroke();
      if (h.path && h.pi < h.path.length) {
        const w = G.grid.w;
        ctx.strokeStyle = 'rgba(255,240,150,0.7)'; ctx.lineWidth = 2; ctx.setLineDash([4, 5]);
        ctx.beginPath(); ctx.moveTo(h.x, h.y);
        for (let i = h.pi; i < h.path.length; i++) { const id = h.path[i]; ctx.lineTo(((id % w) + 0.5) * TILE, (((id / w) | 0) + 0.5) * TILE); }
        ctx.stroke(); ctx.setLineDash([]);
        const last = h.path[h.path.length - 1];
        const lx = ((last % w) + 0.5) * TILE, ly = (((last / w) | 0) + 0.5) * TILE;
        ctx.strokeStyle = 'rgba(255,230,90,0.9)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(lx, ly, 8 + pulse * 2, 4 + pulse, 0, 0, 7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(lx - 4, ly); ctx.lineTo(lx + 4, ly); ctx.moveTo(lx, ly - 2.5); ctx.lineTo(lx, ly + 2.5); ctx.stroke();
      }
    }
    // marker fx (ground)
    for (const f of G.fx) {
      if (f.type !== 'marker') continue;
      const k = f.t / f.life;
      ctx.strokeStyle = `rgba(255,230,90,${1 - k})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(f.x, f.y, 6 + k * 14, 3 + k * 6, 0, 0, 7); ctx.stroke();
    }

    // units sorted by y
    units.length = 0;
    for (const h of G.heroes) if (inView(h.x, h.y, 40)) units.push(h);
    for (const g of G.guards) if (!g.carried && inView(g.x, g.y, 40)) units.push(g);
    for (const c of G.civs) if (!c.carriedBy && inView(c.x, c.y, 40)) units.push(c);
    units.sort(sortY);
    if (G.prisoner && !G.prisoner.freed) drawPrisoner(ctx, G.prisoner);
    for (const u of units) {
      if (u.swingT > 0) u.swingT -= dt;
      const hidden = u.kind === 'hero' && RH.hideAt(G.grid, u.x, u.y);
      if (hidden) ctx.globalAlpha = 0.55;
      if (u.kind === 'hero') {
        const L = heroLook(u);
        if (u.down) lying(ctx, u.x, u.y, u, L, 'down');
        else {
          person(ctx, u.x, u.y, u, L);
          if (u.carry) drawCarried(ctx, u);
        }
        if (u.flash > 0) { ctx.fillStyle = 'rgba(255,60,40,0.4)'; ctx.beginPath(); ctx.arc(u.x, u.y - 14, 12, 0, 7); ctx.fill(); }
      } else if (u.kind === 'guard') {
        const L = u.sheriff ? SHERIFF_LOOK : GUARD_LOOK;
        if (u.state === 'ko' || u.state === 'dead') lying(ctx, u.x, u.y, u, L, u.state);
        else person(ctx, u.x, u.y, u, L);
        if (u.flash > 0) { ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(u.x, u.y - 14, 11, 0, 7); ctx.fill(); }
      } else {
        const L = u.carter ? CARTER_LOOK : CIV_LOOKS[u.look % CIV_LOOKS.length];
        if (u.state === 'ko') lying(ctx, u.x, u.y, u, L, 'ko');
        else person(ctx, u.x, u.y, u, L);
      }
      ctx.globalAlpha = 1;
    }
    // projectiles
    for (const p of G.projs) {
      if (p.kind === 'arrow') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.ang || 0);
        ctx.strokeStyle = '#e8d8a8'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(6, 0); ctx.stroke();
        ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.moveTo(9, 0); ctx.lineTo(5, -2.5); ctx.lineTo(5, 2.5); ctx.fill();
        ctx.fillStyle = '#c33'; ctx.fillRect(-11, -2, 3, 4);
        ctx.restore();
      } else {
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + 14, 5, 2, 0, 0, 7); ctx.fill();
        const y = p.y + 14 - p.z;
        if (p.kind === 'hive') { ctx.fillStyle = '#d9a83a'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(p.x, y, 6, 7, 0, 0, 7); ctx.fill(); ctx.stroke(); ctx.strokeStyle = '#8a5a1a'; ctx.beginPath(); ctx.moveTo(p.x - 6, y - 2); ctx.lineTo(p.x + 6, y - 2); ctx.moveTo(p.x - 6, y + 2); ctx.lineTo(p.x + 6, y + 2); ctx.stroke(); }
        else { ctx.fillStyle = '#7a4a22'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(p.x, y, 5, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#ffd84a'; ctx.fillRect(p.x - 1.5, y - 7, 3, 3); }
      }
    }
    // bees
    for (const f of G.fx) {
      if (f.type !== 'bees') continue;
      ctx.fillStyle = '#ffd23a';
      for (let i = 0; i < 12; i++) { const a = now * (3 + i % 3) + i * 0.52; const rr = 14 + (i % 4) * 8; ctx.fillRect(f.x + Math.cos(a) * rr, f.y - 10 + Math.sin(a * 1.3) * rr * 0.6, 2.6, 2.6); }
    }

    // night lighting
    if (G.night) {
      drawNight(ctx, inView);
      ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (W / 2 - cam.x * z), dpr * (H / 2 - cam.y * z));
      drawCones(ctx, inView, 1.25);
    }
    // torches flames
    for (const t of G.torches) {
      if (!inView(t.x, t.y, 30)) continue;
      ctx.fillStyle = '#4a3420'; ctx.fillRect(t.x - 1.5, t.y - 6, 3, 10);
      const fl = Math.sin(now * 18 + t.x) * 1.2;
      ctx.fillStyle = '#ff9a2a'; ctx.beginPath(); ctx.ellipse(t.x, t.y - 9, 3.6, 5.5 + fl, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.ellipse(t.x, t.y - 8, 1.8, 3 + fl * 0.5, 0, 0, 7); ctx.fill();
    }

    // ---- screen-space overlays ----
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const g of G.guards) {
      if (!inView(g.x, g.y, 40)) continue;
      R.toScreen(g.x, g.y, tmp);
      const top = tmp.y - (g.sheriff ? 38 : 34) * z;
      if (g.state === 'ko') {
        if (!g.tied) {
          // wake timer ring + zzz
          const k = RH.clamp(g.koT / 55, 0, 1);
          ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(tmp.x, tmp.y - 22 * z, 9, 0, 7); ctx.stroke();
          ctx.strokeStyle = k < 0.25 ? '#ff6a4a' : '#ffe38a'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(tmp.x, tmp.y - 22 * z, 9, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.stroke();
          label(ctx, 'z', tmp.x + 14 + Math.sin(now * 2) * 2, tmp.y - 30 * z - (now * 8 % 8), 13, '#e8f0ff');
        } else label(ctx, '🪢', tmp.x, tmp.y - 22 * z, 14, '#fff');
        continue;
      }
      if (g.state === 'dead') continue;
      if (g.sus > 0.02 && g.state !== 'alert') {
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(tmp.x - 15, top - 3, 30, 6);
        ctx.fillStyle = g.sus > 0.6 ? '#ff8a2a' : '#ffd23a'; ctx.fillRect(tmp.x - 14, top - 2, 28 * Math.min(1, g.sus), 4);
      }
      if (g.icon) {
        const col = g.icon === '!' ? '#ff3b2e' : g.icon === '?' ? '#ffd23a' : g.icon === '♥' ? '#ff7aa8' : '#ffe08a';
        label(ctx, g.icon, tmp.x, top - 16 - Math.abs(Math.sin(now * 6)) * 3, 22, col);
      }
      if (g.hp < g.maxhp || g.state === 'alert') hpBar(ctx, tmp.x, top - (g.icon ? 32 : 8), g.hp / g.maxhp, '#e8483a');
    }
    for (const h of G.heroes) {
      if (!inView(h.x, h.y, 40)) continue;
      R.toScreen(h.x, h.y, tmp);
      const top = tmp.y - 36 * z;
      if (h.down) { label(ctx, '✚', tmp.x, tmp.y - 22 * z, 18, '#ff6a5a'); continue; }
      if (h.hp < h.maxhp || G.sel.includes(h)) hpBar(ctx, tmp.x, top, h.hp / h.maxhp, '#5adc4a');
      if (h.busy > 0) label(ctx, '…', tmp.x, top - 14, 20, '#fff');
      if (h.sneak) label(ctx, '🦶', tmp.x + 16, tmp.y - 6, 12, '#fff');
      if (RH.hideAt(G.grid, h.x, h.y)) label(ctx, 'hidden', tmp.x, tmp.y + 12, 11, '#bff5a0');
    }
    if (G.prisoner && !G.prisoner.freed && inView(G.prisoner.x, G.prisoner.y, 40)) {
      R.toScreen(G.prisoner.x, G.prisoner.y, tmp);
      label(ctx, 'HELP!', tmp.x, tmp.y - 40 * z - Math.abs(Math.sin(now * 3)) * 3, 13, '#fff2a8');
    }
    for (const f of G.fx) {
      if (f.type === 'text') {
        R.toScreen(f.x, f.y, tmp);
        const k = f.t / f.life;
        ctx.globalAlpha = 1 - k * k;
        label(ctx, f.text, tmp.x, tmp.y - k * 26, 16, f.color);
        ctx.globalAlpha = 1;
      } else if (f.type === 'stars') {
        R.toScreen(f.x, f.y, tmp);
        for (let i = 0; i < 4; i++) { const a = now * 5 + i * 1.57; label(ctx, '★', tmp.x + Math.cos(a) * 14, tmp.y + Math.sin(a) * 5 - f.t * 6, 12, '#ffe86a'); }
      } else if (f.type === 'spark') {
        R.toScreen(f.x, f.y, tmp);
        ctx.strokeStyle = `rgba(255,240,180,${1 - f.t / f.life})`; ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) { const a = i * 1.26; const r1 = 4 + f.t * 30; ctx.beginPath(); ctx.moveTo(tmp.x + Math.cos(a) * r1, tmp.y + Math.sin(a) * r1); ctx.lineTo(tmp.x + Math.cos(a) * (r1 + 5), tmp.y + Math.sin(a) * (r1 + 5)); ctx.stroke(); }
      }
    }
    // targeting overlay
    if (G.mode) drawTargeting(ctx);
  };

  function label(ctx, t, x, y, size, col) {
    ctx.font = `800 ${size}px system-ui, -apple-system, sans-serif`;
    ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(15,10,5,0.85)';
    ctx.strokeText(t, x, y); ctx.fillStyle = col; ctx.fillText(t, x, y);
  }
  function hpBar(ctx, x, y, k, col) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - 17, y - 3.5, 34, 7);
    ctx.fillStyle = k < 0.34 ? '#ff4a3a' : col; ctx.fillRect(x - 16, y - 2.5, 32 * RH.clamp(k, 0, 1), 5);
  }

  function drawCones(ctx, inView, alphaMul) {
    const NR = RH.game.NRAYS;
    for (const g of G.guards) {
      if (!RH.game.isActive(g) || g.state === 'stunned' || g.state === 'counting') continue;
      const range = RH.game.guardRange(g);
      if (!inView(g.x, g.y, range + 20)) continue;
      RH.game.computeCone(g);
      let fill, line;
      if (g.state === 'alert') { fill = `rgba(255,40,30,${0.3 * alphaMul})`; line = 'rgba(255,60,40,0.7)'; }
      else if (g.state === 'charmed') { fill = `rgba(255,120,180,${0.14 * alphaMul})`; line = 'rgba(255,140,190,0.5)'; }
      else if (g.sus > 0.25 || g.state === 'investigate' || g.state === 'search') { fill = `rgba(255,190,40,${0.26 * alphaMul})`; line = 'rgba(255,200,60,0.65)'; }
      else { fill = `rgba(255,90,70,${0.2 * alphaMul})`; line = 'rgba(255,110,80,0.45)'; }
      const half = g.fov / 2, ox = g.x, oy = g.y - 4;
      ctx.beginPath(); ctx.moveTo(ox, oy);
      for (let i = 0; i < NR; i++) {
        const a = g.dir - half + (g.fov * i) / (NR - 1);
        const d = g.cone[i];
        ctx.lineTo(ox + Math.cos(a) * d, oy + Math.sin(a) * d);
      }
      ctx.closePath();
      ctx.fillStyle = fill; ctx.fill();
      ctx.strokeStyle = line; ctx.lineWidth = 1; ctx.stroke();
    }
  }

  function drawNight(ctx, inView) {
    const W = R.W, H = R.H, cam = G.cam, z = cam.z;
    const dx = darkX, q = 0.5;
    dx.globalCompositeOperation = 'source-over';
    dx.clearRect(0, 0, darkC.width, darkC.height);
    dx.fillStyle = 'rgba(6,10,32,0.74)';
    dx.fillRect(0, 0, darkC.width, darkC.height);
    dx.globalCompositeOperation = 'destination-out';
    const put = (x, y, r, a) => {
      R.toScreen(x, y, tmp);
      const s = r * z * q;
      if (tmp.x * q + s < 0 || tmp.y * q + s < 0 || tmp.x * q - s > darkC.width || tmp.y * q - s > darkC.height) return;
      dx.globalAlpha = a;
      dx.drawImage(lightSprite, tmp.x * q - s, tmp.y * q - s, s * 2, s * 2);
    };
    for (const t of G.torches) put(t.x, t.y, 3.4 * TILE, 1);
    for (const h of G.heroes) put(h.x, h.y - 10, 1.5 * TILE, 0.7);
    for (const g of G.guards) if (RH.game.isActive(g)) put(g.x, g.y - 10, 1.1 * TILE, 0.5);
    dx.globalAlpha = 1;
    dx.globalCompositeOperation = 'source-over';
    ctx.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
    ctx.drawImage(darkC, 0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    for (const t of G.torches) {
      R.toScreen(t.x, t.y, tmp);
      const s = 2.6 * TILE * z * (1 + Math.sin(now * 9 + t.x) * 0.03);
      if (tmp.x + s < 0 || tmp.y + s < 0 || tmp.x - s > W || tmp.y - s > H) continue;
      ctx.drawImage(glowSprite, tmp.x - s, tmp.y - s, s * 2, s * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawChest(ctx, x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 3, 11, 4, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#7a4a1e'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.roundRect(-10, -12, 20, 14, 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#9a6028'; ctx.beginPath(); ctx.roundRect(-10, -16, 20, 6, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e8c04a'; ctx.fillRect(-6, -16, 2.5, 18); ctx.fillRect(3.5, -16, 2.5, 18); ctx.fillRect(-1.5, -10, 3, 3.5);
    ctx.restore();
  }
  function drawCart(ctx, c) {
    ctx.save(); ctx.translate(c.x, c.y);
    // horse in front (south)
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 4, 18, 30, 0, 0, 7); ctx.fill();
    const step = c.state === 'moving' ? Math.sin(c.wheel * 2) * 2 : 0;
    ctx.fillStyle = '#6a4226'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.ellipse(0, 30, 7, 14, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 46 + step * 0.3, 4.5, 7, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2a1a10'; ctx.fillRect(-1.5, 36, 3, 10);
    ctx.strokeStyle = '#3a2a18'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-8, 10); ctx.lineTo(-5, 22); ctx.moveTo(8, 10); ctx.lineTo(5, 22); ctx.stroke();
    // wheels
    ctx.fillStyle = '#3a2a1a'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.4;
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.roundRect(s * 16 - 3, -14, 6, 18, 2); ctx.fill(); ctx.stroke(); }
    // bed
    ctx.fillStyle = '#9a7040'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.roundRect(-14, -24, 28, 36, 3); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(60,40,20,0.6)'; ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-14, -24 + i * 9); ctx.lineTo(14, -24 + i * 9); ctx.stroke(); }
    // sacks
    ctx.fillStyle = '#d8c49a'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(-6, 4, 6, 5, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(6, 5, 6, 5, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.restore();
    if (c.chest) drawChest(ctx, c.x, c.y - 6, 0.9);
  }
  function drawPrisoner(ctx, p) {
    const L = heroLook({ key: p.key, def: RH.HEROES[p.key] });
    const fake = { dir: 0, moving: false, anim: 0, bob: 1, drawT: 0, swingT: 0 };
    ctx.save(); ctx.translate(p.x, p.y);
    ctx.fillStyle = '#5a3a1a'; ctx.fillRect(-2, -30, 4, 30); // post
    ctx.restore();
    person(ctx, p.x, p.y + 2, fake, Object.assign({}, L, { weapon: null }));
    ctx.strokeStyle = '#d9b46a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(p.x - 7, p.y - 16); ctx.lineTo(p.x + 7, p.y - 13); ctx.moveTo(p.x - 7, p.y - 11); ctx.lineTo(p.x + 7, p.y - 8); ctx.stroke();
  }
  function drawCarried(ctx, h) {
    if (h.carry === 'chest') { drawChest(ctx, h.x, h.y - 30, 0.85); return; }
    const L = h.carry.sheriff ? SHERIFF_LOOK : GUARD_LOOK;
    ctx.save(); ctx.translate(h.x, h.y - 26); ctx.rotate(-Math.PI / 2); ctx.scale(0.8, 0.8);
    person(ctx, 6, 8, { dir: 0, moving: false, anim: 0, bob: 0, drawT: 0, swingT: 0 }, Object.assign({}, L, { weapon: null, big: false }));
    ctx.restore();
  }

  function drawTargeting(ctx) {
    const m = G.mode;
    let h = null, range = 0;
    if (m === 'shoot') { h = G.heroes.find((x) => x.key === 'robin'); range = G.bowRange; }
    if (m === 'charm') { h = G.heroes.find((x) => x.key === 'marian'); range = 5 * TILE; }
    if (m === 'hive') { h = G.heroes.find((x) => x.key === 'tuck'); range = 6 * TILE; }
    if (m === 'purse') { h = G.heroes.find((x) => x.key === 'scarlet'); range = 7 * TILE; }
    if (m === 'heal') { h = G.heroes.find((x) => x.key === 'tuck'); range = 1.1 * TILE; }
    if (!h) return;
    R.toScreen(h.x, h.y, tmp);
    ctx.strokeStyle = 'rgba(255,240,150,0.85)'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
    ctx.beginPath(); ctx.arc(tmp.x, tmp.y, range * G.cam.z, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,240,150,0.06)'; ctx.fill();
    if (m === 'shoot' || m === 'charm') {
      for (const g of G.guards) {
        if (!RH.game.isActive(g)) continue;
        if (m === 'charm' && g.state === 'alert') continue;
        R.toScreen(g.x, g.y - 12, tmp);
        ctx.strokeStyle = m === 'shoot' ? '#ff5a4a' : '#ff8ac0'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(tmp.x, tmp.y, 16, 0, 7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(tmp.x - 22, tmp.y); ctx.lineTo(tmp.x - 10, tmp.y); ctx.moveTo(tmp.x + 10, tmp.y); ctx.lineTo(tmp.x + 22, tmp.y); ctx.stroke();
      }
    }
  }

  R.staticCanvas = () => staticC;
  R._person = person;
})(window.RH);
// Portrait helper (appended): draws a hero bust on a small canvas
(function (RH) {
  RH.render.portrait = function (canvas, key) {
    const c = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const s = canvas.clientWidth || 48;
    canvas.width = s * dpr; canvas.height = s * dpr;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, s, s);
    const d = RH.HEROES[key];
    const L = { tunic: d.tunic, trim: d.trim, skin: d.skin, hair: d.hair, hat: d.hat, legs: '#3b2f22', round: d.round, key, weapon: null, dress: key === 'marian' };
    c.translate(s / 2, s * 1.18);
    c.scale(s / 26, s / 26);
    RH.render._person(c, 0, 0, { dir: 0, moving: false, anim: 0, bob: 0, drawT: 0, swingT: 0 }, L);
  };
})(window.RH);
