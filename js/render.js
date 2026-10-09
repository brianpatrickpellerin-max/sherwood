// Isometric frame renderer: cached ground, depth-merged sprites and characters, soft view cones,
// night glow, occlusion silhouettes and screen-space HUD overlays.
'use strict';
(function (RH) {
  const TILE = RH.TILE;
  const R = { flags: {} };
  RH.render = R;
  const G = RH.G;
  const OUT = 'rgba(22,14,8,0.85)';
  let scene = null, glowSprite = null, frameNo = 0;
  let now = 0;
  const ents = [];
  const drawn = [];
  const sortD = (a, b) => (a.x + a.y + (a._dz || 0)) - (b.x + b.y + (b._dz || 0));

  // ---------- build ----------
  R.buildStatic = function () {
    const m = G.m;
    scene = RH.iso.buildScene(G.grid, { theme: m.theme || 'forest', night: G.night, torches: G.torches, seed: 1234 + G.idx * 77 });
    R.scene = scene;
    R.buildMinimap();
    if (!glowSprite) glowSprite = RH.iso.glow('rgba(255,170,80,0.55)', 'rgba(255,120,40,0)');
  };
  R.sceneInfo = () => scene && { dyn: scene.objs.length, total: scene.nObjs, w: scene.ground.width, h: scene.ground.height };

  // Minimap: iso diamond on parchment
  R.buildMinimap = function () {
    const g = G.grid, mw = 148, mh = 78;
    const c = RH.iso.cv(mw * 2, mh * 2), x = c.getContext('2d');
    x.scale(2, 2);
    const span = (g.w + g.h);
    const k = Math.min((mw - 8) / span, (mh - 6) / (span / 2));
    const ox = mw / 2 - (g.w - g.h) * k / 2, oy = mh / 2 - span * k / 4;
    R.mini = { k, ox, oy, w: mw, h: mh, img: c };
    const COL = { '.': '#9a9a52', ',': '#a98450', f: '#a89a7c', d: '#8a6a44', b: '#5f7a34', h: '#c8a050', '#': '#6a5e4c', T: '#4a6428', r: '#8a3e26', c: '#8a6a40', m: '#a0603a', p: '#c8b88a', l: '#7a5a34', w: '#5a7a84', x: '#7a6a50' };
    for (let ty = 0; ty < g.h; ty++) for (let tx = 0; tx < g.w; tx++) {
      const ch = g.ch[ty * g.w + tx];
      x.fillStyle = COL[ch] || '#9a9a52';
      const cx = ox + (tx - ty) * k, cy = oy + (tx + ty) * k / 2;
      x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + k, cy + k / 2); x.lineTo(cx, cy + k); x.lineTo(cx - k, cy + k / 2); x.closePath(); x.fill();
    }
    // parchment wash
    x.globalCompositeOperation = 'multiply';
    x.fillStyle = 'rgba(232,212,160,0.9)'; x.fillRect(0, 0, mw, mh);
    x.globalCompositeOperation = 'source-over';
  };
  R.miniToWorld = function (mx, my) {
    const M = R.mini; if (!M) return null;
    const a = (mx - M.ox) / M.k, b = (my - M.oy) / (M.k / 2);
    // a = tx - ty, b = tx + ty  (tile units, at the diamond's top corner)
    const tx = (a + b) / 2, ty = (b - a) / 2;
    return { x: tx * TILE, y: ty * TILE };
  };
  R.drawMinimap = function (canvas) {
    const M = R.mini; if (!M || !G.m) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = canvas.clientWidth || M.w, ch = canvas.clientHeight || M.h;
    if (canvas.width !== Math.round(cw * dpr)) { canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr); }
    const c = canvas.getContext('2d');
    c.setTransform(dpr * cw / M.w, 0, 0, dpr * ch / M.h, 0, 0);
    c.clearRect(0, 0, M.w, M.h);
    c.drawImage(M.img, 0, 0, M.w, M.h);
    const P = (wx, wy) => [M.ox + (wx - wy) / TILE * M.k, M.oy + (wx + wy) / TILE * M.k / 2];
    // exit
    const e = G.exit;
    c.fillStyle = 'rgba(60,160,60,0.55)';
    { const a = P(e.x * TILE, e.y * TILE), b = P((e.x + e.w) * TILE, e.y * TILE), d = P((e.x + e.w) * TILE, (e.y + e.h) * TILE), f = P(e.x * TILE, (e.y + e.h) * TILE); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(d[0], d[1]); c.lineTo(f[0], f[1]); c.closePath(); c.fill(); }
    for (const gd of G.guards) {
      if (gd.carried) continue;
      const [x, y] = P(gd.x, gd.y);
      c.fillStyle = gd.state === 'dead' ? '#5a3a30' : gd.state === 'ko' ? '#8a7a60' : gd.state === 'alert' ? '#ff2a1a' : '#b8281a';
      c.beginPath(); c.arc(x, y, 1.9, 0, 7); c.fill();
    }
    for (const h of G.heroes) {
      const [x, y] = P(h.x, h.y);
      c.fillStyle = h.down ? '#666' : '#1f6a1a'; c.strokeStyle = '#e8ffd0'; c.lineWidth = 0.8;
      c.beginPath(); c.arc(x, y, 2.3, 0, 7); c.fill(); c.stroke();
    }
    if (G.prisoner && !G.prisoner.freed) { const [x, y] = P(G.prisoner.x, G.prisoner.y); c.fillStyle = '#e0b020'; c.beginPath(); c.arc(x, y, 2.2, 0, 7); c.fill(); }
    if (G.chest && !G.chest.taken) { const [x, y] = P(G.chest.x, G.chest.y); c.fillStyle = '#ffd84a'; c.fillRect(x - 2, y - 2, 4, 4); }
    // camera view (diamond-ish quad)
    const q = [[0, 0], [R.W, 0], [R.W, R.H], [0, R.H]].map(([sx, sy]) => { R.toWorld(sx, sy, tmp); return P(tmp.x, tmp.y); });
    c.strokeStyle = 'rgba(40,20,8,0.85)'; c.lineWidth = 1;
    c.beginPath(); q.forEach((p, i) => (i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]))); c.closePath(); c.stroke();
  };

  // ---------- projection ----------
  R.resize = function (canvas) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    R.W = w; R.H = h; R.dpr = dpr;
  };
  R.toScreen = function (wx, wy, out) {
    const cam = G.cam;
    out.x = (wx - wy - cam.x) * cam.z + R.W / 2; out.y = ((wx + wy) / 2 - cam.y) * cam.z + R.H / 2;
    return out;
  };
  R.toWorld = function (sx, sy, out) {
    const cam = G.cam;
    const X = (sx - R.W / 2) / cam.z + cam.x, Y = (sy - R.H / 2) / cam.z + cam.y;
    out.x = Y + X / 2; out.y = Y - X / 2;
    return out;
  };
  const tmp = { x: 0, y: 0 };

  // ---------- characters ----------
  const GUARD_LOOK = { tunic: '#8a8e94', mail: true, tabard: '#a8261e', emblem: '#e8d070', skin: '#e2b894', hair: '#3a2a1a', helmet: true, legs: '#4a4038', weapon: 'spear' };
  const SHERIFF_LOOK = { tunic: '#2a1e34', cloak: '#5a1420', trim: '#d8b240', skin: '#e6c0a0', hair: '#1a1a1a', sheriffHat: true, legs: '#1d1a26', weapon: 'sword', big: true };
  const CIV_LOOKS = [
    { tunic: '#8a6a40', trim: '#4a3a22', skin: '#ecc49c', hair: '#6a4020', legs: '#5a4a3a', hood: '#6a5436' },
    { tunic: '#6a7a8a', trim: '#e8dcc0', skin: '#e9bf96', hair: '#c09050', legs: '#4a4a4a', dress: true, kerchief: '#e8dcc0' },
    { tunic: '#7a5a7a', trim: '#d8b878', skin: '#d9a77c', hair: '#2a1a10', legs: '#3a3030' },
    { tunic: '#6a7a40', trim: '#3a2a1a', skin: '#f2d0b0', hair: '#8a5a2a', legs: '#4a3a2a', dress: true },
  ];
  const CARTER_LOOK = { tunic: '#7a6a4a', trim: '#3a2a1a', skin: '#e8b890', hair: '#5a3a1a', legs: '#4a3a2a', hood: '#5a4a2a' };
  R.GUARD_LOOK = GUARD_LOOK;

  function heroLook(h) {
    const d = h.def || RH.HEROES[h.key];
    if (d._look) return d._look;
    const L = { tunic: d.tunic, trim: d.trim, skin: d.skin, hair: d.hair, hat: d.hat, legs: d.legs || '#3b2f22', big: d.big, round: d.round, key: d.lookKey || h.key, weapon: d.weapon, dress: h.key === 'marian', hood: d.hood, beard: d.beard };
    if (h.key === 'robin') { L.quiver = true; L.feather = '#c8322a'; }
    if (h.key === 'scarlet') L.cloak = '#7a1814';
    return (d._look = L);
  }
  R.heroLook = heroLook;

  // world dir -> screen facing
  function facing(dir) {
    const c = Math.cos(dir), s = Math.sin(dir);
    return { sx: c - s, sy: (c + s) / 2 };
  }

  // Figure in iso units, feet at (0,0) after translate. ~31 units tall.
  function figure(c, X, Y, u, L, flat) {
    const sc = (L.big ? 1.16 : 1) * 1.28;
    const f = facing(u.dir || 0);
    const side = f.sx >= 0 ? 1 : -1;
    const back = f.sy < -0.28;
    const walk = u.moving ? Math.sin(u.anim) : 0;
    const bob = u.moving ? Math.abs(Math.cos(u.anim)) * 0.9 : 0;
    c.save();
    c.translate(X, Y);
    if (!flat) { c.fillStyle = 'rgba(0,0,0,0.32)'; c.beginPath(); c.ellipse(1, 0.5, 7 * sc, 3 * sc, 0, 0, 7); c.fill(); }
    c.scale(side * sc, sc);
    c.lineWidth = 0.75; c.strokeStyle = OUT; c.lineJoin = 'round'; c.lineCap = 'round';
    // legs
    if (!L.dress && !L.round) {
      c.strokeStyle = OUT; c.lineWidth = 3.4;
      c.beginPath(); c.moveTo(-1.6, -12); c.lineTo(-1.6 + walk * 2.2, -0.8); c.moveTo(1.6, -12); c.lineTo(1.6 - walk * 2.2, -0.8); c.stroke();
      c.strokeStyle = L.legs; c.lineWidth = 2.3; c.stroke();
      c.fillStyle = '#2a1c12';
      c.beginPath(); c.ellipse(-1.2 + walk * 2.2, -0.6, 2, 1.1, 0, 0, 7); c.fill();
      c.beginPath(); c.ellipse(2 - walk * 2.2, -0.6, 2, 1.1, 0, 0, 7); c.fill();
    } else {
      c.fillStyle = '#2a1c12';
      c.beginPath(); c.ellipse(-1.5 + walk, -0.6, 1.8, 1, 0, 0, 7); c.fill();
      c.beginPath(); c.ellipse(1.8 - walk, -0.6, 1.8, 1, 0, 0, 7); c.fill();
    }
    c.translate(0, -bob);
    c.lineWidth = 0.75; c.strokeStyle = OUT;
    // cloak / quiver behind
    if (L.cloak) { c.fillStyle = L.cloak; c.beginPath(); c.moveTo(-3.5, -23); c.lineTo(3, -23); c.lineTo(-1 - walk, -5); c.lineTo(-6.5 - walk, -6); c.closePath(); c.fill(); c.stroke(); }
    if (L.quiver && !back) { c.fillStyle = '#6a4222'; c.save(); c.translate(-3.6, -19); c.rotate(-0.35); c.fillRect(-1.4, -6, 2.8, 9); c.fillStyle = '#e8e0c8'; c.fillRect(-1.2, -8, 0.8, 2.4); c.fillRect(0.3, -8.4, 0.8, 2.6); c.restore(); }
    // back arm
    const armCol = L.mail ? '#7e848c' : shade(L.tunic, 0.8);
    c.strokeStyle = OUT; c.lineWidth = 2.8; c.beginPath(); c.moveTo(-2.6, -21.5); c.lineTo(-3.2 - walk * 1.5, -14.5); c.stroke();
    c.strokeStyle = armCol; c.lineWidth = 1.8; c.stroke();
    // body
    c.fillStyle = L.tunic;
    c.beginPath();
    if (L.dress) { c.moveTo(-3.6, -23); c.lineTo(3.6, -23); c.lineTo(5.4, -1.5); c.lineTo(-5.4, -1.5); c.closePath(); }
    else if (L.round) { c.moveTo(-3.8, -23); c.quadraticCurveTo(7.8, -20, 5, -1.5); c.lineTo(-5, -1.5); c.quadraticCurveTo(-7.4, -14, -3.8, -23); }
    else { c.moveTo(-3.8, -23.2); c.lineTo(3.8, -23.2); c.lineTo(4.6, -10.5); c.lineTo(-4.6, -10.5); c.closePath(); }
    c.fill(); c.stroke();
    // mail texture + tabard
    if (L.mail) {
      c.fillStyle = 'rgba(255,255,255,0.18)'; for (let yy = -22; yy < -11; yy += 2) c.fillRect(-3.6, yy, 7.2, 0.6);
      c.fillStyle = L.tabard; c.beginPath(); c.moveTo(-2.6, -22.6); c.lineTo(2.6, -22.6); c.lineTo(3, -9.5); c.lineTo(-3, -9.5); c.closePath(); c.fill(); c.stroke();
      if (!back) { c.fillStyle = L.emblem; c.fillRect(-0.5, -20.5, 1, 6.5); c.fillRect(-2, -18.4, 4, 1); }
    }
    // shading on the far side
    c.fillStyle = 'rgba(0,0,0,0.16)'; c.beginPath(); c.moveTo(1.2, -23); c.lineTo(3.8, -23); c.lineTo(L.dress ? 5.4 : 4.6, L.dress ? -1.5 : -10.5); c.lineTo(1.6, L.dress ? -1.5 : -10.5); c.closePath(); c.fill();
    // belt
    if (L.trim && !L.mail) { c.fillStyle = L.trim; c.fillRect(L.round ? -5 : -4.3, L.dress ? -16 : -13.6, L.round ? 10 : 8.6, 1.5); }
    // head
    const hy = -26.6;
    c.fillStyle = L.skin; c.beginPath(); c.arc(0.4, hy, 3.3, 0, 7); c.fill(); c.stroke();
    // hair & face
    c.fillStyle = L.hair;
    const k = L.key;
    if (back) { c.beginPath(); c.arc(0.4, hy, 3.3, 0, 7); c.fill(); }
    else if (k === 'tuck') { c.beginPath(); c.arc(0.4, hy + 0.4, 3.35, Math.PI * 0.55, Math.PI * 1.2); c.lineTo(0.4, hy); c.fill(); }
    else if (k === 'marian') { c.beginPath(); c.arc(0.2, hy - 0.4, 3.5, Math.PI * 0.85, Math.PI * 2.05); c.fill(); c.beginPath(); c.moveTo(-3, hy - 1); c.quadraticCurveTo(-5.5, hy + 5, -3.2, hy + 9); c.lineTo(-0.6, hy + 2); c.fill(); }
    else if (!L.helmet && !L.sheriffHat && !L.hood) { c.beginPath(); c.arc(0.2, hy - 0.5, 3.45, Math.PI * 0.95, Math.PI * 2.0); c.fill(); c.fillRect(-3.1, hy - 0.5, 1.6, 2.6); }
    if (!back) {
      if (L.beard || k === 'john') { c.fillStyle = L.hair; c.beginPath(); c.arc(1.3, hy + 1.6, 2.5, 0, Math.PI); c.fill(); }
      c.fillStyle = '#1a1210'; c.fillRect(2.1, hy - 0.8, 0.9, 0.9);
      c.fillStyle = shade(L.skin, 0.85); c.fillRect(3.4, hy - 0.2, 0.8, 1.2);
    }
    // headgear
    if (L.hat) {
      c.fillStyle = L.hat;
      c.beginPath(); c.moveTo(-3.8, hy - 1.2); c.quadraticCurveTo(0.5, hy - 3.6, 4.6, hy - 1.4); c.quadraticCurveTo(1, hy - 4.6, -1.6, hy - 6.8); c.closePath(); c.fill(); c.stroke();
      if (L.feather) { c.strokeStyle = L.feather; c.lineWidth = 1.1; c.beginPath(); c.moveTo(-0.5, hy - 4); c.quadraticCurveTo(-4.5, hy - 9, -7.5, hy - 8.5); c.stroke(); }
    }
    if (L.helmet) {
      c.fillStyle = '#8e969e';
      c.beginPath(); c.arc(0.4, hy - 0.6, 3.6, Math.PI, 0); c.lineTo(4.4, hy - 0.2); c.lineTo(-3.6, hy - 0.2); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(-1.6, hy - 3.4, 1.2, 2);
      if (!back) { c.fillStyle = '#8e969e'; c.fillRect(2.6, hy - 0.4, 0.9, 2.6); }
      c.fillStyle = '#7a8088'; c.beginPath(); c.arc(0.4, hy + 2.4, 2.6, 0, Math.PI); c.fill();
    }
    if (L.sheriffHat) {
      c.fillStyle = '#16121e';
      c.beginPath(); c.ellipse(0.4, hy - 2.2, 5, 1.4, 0, 0, 7); c.fill(); c.stroke();
      c.beginPath(); c.roundRect(-2.2, hy - 6.6, 5.2, 4.6, 1.2); c.fill(); c.stroke();
      c.fillStyle = '#d8b240'; c.fillRect(-2.2, hy - 3.2, 5.2, 0.9);
      c.strokeStyle = '#c8322a'; c.lineWidth = 0.9; c.beginPath(); c.moveTo(-1.6, hy - 5); c.quadraticCurveTo(-5, hy - 9, -7, hy - 7); c.stroke();
    }
    if (L.hood) { c.fillStyle = L.hood; c.beginPath(); c.arc(0.2, hy - 0.3, 3.8, Math.PI * 0.8, Math.PI * 2.15); c.lineTo(-3.4, hy + 3); c.closePath(); c.fill(); c.stroke(); }
    if (L.kerchief) { c.fillStyle = L.kerchief; c.beginPath(); c.arc(0.4, hy - 0.6, 3.5, Math.PI, 0); c.fill(); c.stroke(); }
    // front arm + weapon
    const swing = u.swingT > 0 ? Math.sin((u.swingT / 0.25) * Math.PI) : 0;
    const wp = L.weapon;
    c.save(); c.translate(2.8, -21.3);
    const armA = u.drawT > 0 ? -1.35 : (0.2 + walk * 0.25 - swing * 1.6);
    c.rotate(armA);
    c.strokeStyle = OUT; c.lineWidth = 2.8; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 7); c.stroke();
    c.strokeStyle = armCol; c.lineWidth = 1.8; c.stroke();
    c.fillStyle = L.skin; c.beginPath(); c.arc(0, 7.4, 1.1, 0, 7); c.fill();
    c.translate(0, 7.4);
    if (u.drawT > 0) {
      const kk = 1 - u.drawT / 0.45;
      c.rotate(1.35);
      c.strokeStyle = '#6b3e1a'; c.lineWidth = 1.4; c.beginPath(); c.arc(1, 0, 7, -1.2, 1.2); c.stroke();
      c.strokeStyle = 'rgba(240,240,220,0.9)'; c.lineWidth = 0.5; c.beginPath(); c.moveTo(1 + Math.cos(-1.2) * 7, Math.sin(-1.2) * 7); c.lineTo(-kk * 5, 0); c.lineTo(1 + Math.cos(1.2) * 7, Math.sin(1.2) * 7); c.stroke();
      c.strokeStyle = '#d9c08a'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(-kk * 5, 0); c.lineTo(9, 0); c.stroke();
    } else if (wp === 'sword') {
      c.rotate(-0.5); c.strokeStyle = '#3a3a3a'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-1.6, 0); c.lineTo(1.6, 0); c.stroke();
      c.strokeStyle = '#e4e8ee'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -9.5); c.stroke();
    } else if (wp === 'spear') {
      c.rotate(-armA); c.strokeStyle = '#5a3e22'; c.lineWidth = 1.3; c.beginPath(); c.moveTo(0, 6); c.lineTo(0, -24); c.stroke();
      c.fillStyle = '#d0d6dc'; c.beginPath(); c.moveTo(0, -29); c.lineTo(1.6, -24); c.lineTo(-1.6, -24); c.closePath(); c.fill();
    } else if (wp === 'staff') {
      c.rotate(-armA * 0.6 - 0.15); c.strokeStyle = '#5b3a1a'; c.lineWidth = 1.7; c.beginPath(); c.moveTo(0, 8); c.lineTo(0, -20); c.stroke();
    } else if (wp === 'club') {
      c.rotate(-0.4); c.strokeStyle = '#6a4424'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 1); c.lineTo(0, -8); c.stroke();
    }
    c.restore();
    // bow on the back for Robin
    if (L.key === 'robin' && !(u.drawT > 0)) { c.strokeStyle = '#6b3e1a'; c.lineWidth = 1.2; c.beginPath(); c.arc(-1.5, -17, 7.5, -1.4, 1.2); c.stroke(); }
    c.restore();
  }
  function shade(hex, k) {
    if (hex[0] !== '#') return hex;
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
    return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }
  const FAKE = { dir: Math.PI / 4, moving: false, anim: 0, bob: 0, drawT: 0, swingT: 0 };
  function lying(c, X, Y, u, L, kind) {
    c.save(); c.translate(X, Y);
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.ellipse(0, 0, 13, 5, 0, 0, 7); c.fill();
    c.scale(1, 0.62); c.rotate(-Math.PI / 2 + 0.15); c.translate(0, 13);
    if (kind === 'dead') c.globalAlpha = 0.8;
    figure(c, 0, 0, FAKE, kind === 'dead' ? deadLook(L) : noWeapon(L), true);
    c.restore();
    if (u.tied) {
      c.strokeStyle = '#d9b46a'; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(X - 5, Y - 4); c.lineTo(X - 3, Y + 3); c.moveTo(X + 2, Y - 4); c.lineTo(X + 4, Y + 3); c.stroke();
    }
  }
  function noWeapon(L) { return L.__nw || (L.__nw = Object.assign({}, L, { weapon: null, __nw: null, __dead: null })); }
  function deadLook(L) { return L.__dead || (L.__dead = Object.assign({}, L, { weapon: null, tunic: '#5a3a36', tabard: '#4a2a26', __nw: null, __dead: null })); }

  // ---------- frame ----------
  R.draw = function (ctx, dt) {
    now += dt; frameNo++;
    const W = R.W, H = R.H, dpr = R.dpr, cam = G.cam, z = cam.z;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const vx0 = cam.x - W / 2 / z, vy0 = cam.y - H / 2 / z, vx1 = cam.x + W / 2 / z, vy1 = cam.y + H / 2 / z;
    const ex = dpr * (W / 2 - cam.x * z), ey = dpr * (H / 2 - cam.y * z);
    const isoT = () => ctx.setTransform(dpr * z, 0, 0, dpr * z, ex, ey);
    const worldT = () => ctx.setTransform(dpr * z, dpr * z / 2, -dpr * z, dpr * z / 2, ex, ey);
    const sc = scene;
    // endless forest beyond the map edge
    isoT();
    if (!R.bgPat || R.bgPatSrc !== sc.pat) { R.bgPat = ctx.createPattern(sc.pat, 'repeat'); R.bgPatSrc = sc.pat; }
    if (R.bgPat.setTransform && typeof DOMMatrix !== 'undefined') R.bgPat.setTransform(new DOMMatrix([1 / sc.s, 0, 0, 1 / sc.s, 0, 0]));
    ctx.fillStyle = R.bgPat; ctx.fillRect(vx0 - 2, vy0 - 2, vx1 - vx0 + 4, vy1 - vy0 + 4);
    // ground
    if (!R.flags.noStatic) {
      const s = sc.s;
      const gx0 = Math.max(0, (vx0 - sc.X0) * s), gy0 = Math.max(0, (vy0 - sc.Y0) * s);
      const gx1 = Math.min(sc.ground.width, (vx1 - sc.X0) * s), gy1 = Math.min(sc.ground.height, (vy1 - sc.Y0) * s);
      if (gx1 > gx0 && gy1 > gy0) {
        isoT();
        ctx.drawImage(sc.ground, gx0, gy0, gx1 - gx0, gy1 - gy0, gx0 / s + sc.X0, gy0 / s + sc.Y0, (gx1 - gx0) / s, (gy1 - gy0) / s);
      }
    }
    const inView = (x, y, m) => { const X = x - y, Y = (x + y) / 2; return X > vx0 - m && X < vx1 + m && Y > vy0 - m && Y < vy1 + m * 1.6; };
    // ---- ground overlays (world space, skewed) ----
    worldT();
    const e = G.exit;
    const pulse = 0.5 + 0.5 * Math.sin(now * 3);
    const ready = G.exitReady;
    ctx.fillStyle = ready ? `rgba(140,255,120,${0.16 + pulse * 0.14})` : 'rgba(140,255,140,0.07)';
    ctx.fillRect(e.x * TILE, e.y * TILE, e.w * TILE, e.h * TILE);
    ctx.strokeStyle = ready ? `rgba(190,255,160,${0.6 + pulse * 0.4})` : 'rgba(190,255,160,0.35)';
    ctx.lineWidth = 2 / z; ctx.setLineDash([7, 6]); ctx.lineDashOffset = -now * 12;
    ctx.strokeRect(e.x * TILE + 1, e.y * TILE + 1, e.w * TILE - 2, e.h * TILE - 2);
    ctx.setLineDash([]);
    drawCones(ctx, inView, worldT);
    worldT();
    // climb spots
    if (G.climbs) for (const cl of G.climbs) {
      const sel = G.sel.some((h) => h.key === 'robin') || cl.rope;
      ctx.strokeStyle = cl.rope ? 'rgba(230,200,120,0.85)' : `rgba(255,220,120,${sel ? 0.5 + pulse * 0.4 : 0.35})`;
      ctx.lineWidth = 1.6 / z;
      for (const p of [cl.a, cl.b]) { ctx.beginPath(); ctx.ellipse(p.x, p.y, 10, 10, 0, 0, 7); ctx.stroke(); }
    }
    // selection rings + paths
    for (const h of G.sel) {
      if (h.down) continue;
      ctx.strokeStyle = 'rgba(120,255,90,0.95)'; ctx.lineWidth = 2 / z;
      ctx.beginPath(); ctx.arc(h.x, h.y, 10, 0, 7); ctx.stroke();
      ctx.fillStyle = 'rgba(120,255,90,0.16)'; ctx.fill();
      if (h.path && h.pi < h.path.length) {
        const w = G.grid.w;
        ctx.strokeStyle = 'rgba(255,240,150,0.75)'; ctx.lineWidth = 2 / z; ctx.setLineDash([5, 6]);
        ctx.beginPath(); ctx.moveTo(h.x, h.y);
        for (let i = h.pi; i < h.path.length; i++) { const id = h.path[i]; ctx.lineTo(((id % w) + 0.5) * TILE, (((id / w) | 0) + 0.5) * TILE); }
        ctx.stroke(); ctx.setLineDash([]);
        const last = h.path[h.path.length - 1];
        const lx = ((last % w) + 0.5) * TILE, ly = (((last / w) | 0) + 0.5) * TILE;
        ctx.strokeStyle = 'rgba(255,230,90,0.9)';
        ctx.beginPath(); ctx.arc(lx, ly, 7 + pulse * 2, 0, 7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(lx - 4, ly - 4); ctx.lineTo(lx + 4, ly + 4); ctx.moveTo(lx + 4, ly - 4); ctx.lineTo(lx - 4, ly + 4); ctx.stroke();
      }
    }
    for (const f of G.fx) {
      if (f.type !== 'marker') continue;
      const k = f.t / f.life;
      ctx.strokeStyle = `rgba(255,230,90,${1 - k})`; ctx.lineWidth = 2 / z;
      ctx.beginPath(); ctx.arc(f.x, f.y, 6 + k * 14, 0, 7); ctx.stroke();
    }
    for (const cn of G.coins) {
      ctx.fillStyle = '#ffd84a';
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(cn.x - 5 + i * 3.5, cn.y + (i % 2) * 3, 2.4, 0, 7); ctx.fill(); }
    }
    // ---- depth-merged sprites + entities ----
    isoT();
    ents.length = 0;
    for (const h of G.heroes) if (inView(h.x, h.y, 60)) { h._dz = 0; ents.push(h); }
    for (const g of G.guards) if (!g.carried && inView(g.x, g.y, 60)) { g._dz = 0; ents.push(g); }
    for (const c of G.civs) if (!c.carriedBy && inView(c.x, c.y, 60)) { c._dz = 0; ents.push(c); }
    for (const gd of G.gold) if (!gd.taken && inView(gd.x, gd.y, 30)) ents.push(gd);
    if (G.chest && !G.chest.carrier && !G.chest.onCart && inView(G.chest.x, G.chest.y, 30)) ents.push(G.chest);
    if (G.cart && inView(G.cart.x, G.cart.y, 100)) ents.push(G.cart);
    if (G.log && !G.log.cleared && inView(G.log.x, G.log.y, 80)) ents.push(G.log);
    if (G.prisoner && !G.prisoner.freed && inView(G.prisoner.x, G.prisoner.y, 60)) ents.push(G.prisoner);
    if (G.captives) for (const cp of G.captives) if (!cp.freed && inView(cp.x, cp.y, 60)) ents.push(cp);
    ents.sort(sortD);
    const objs = sc.objs;
    let ei = 0;
    drawn.length = 0;
    for (let oi = 0; oi <= objs.length; oi++) {
      const o = oi < objs.length ? objs[oi] : null;
      const od = o ? o.d : 1e12;
      while (ei < ents.length && ents[ei].x + ents[ei].y + (ents[ei]._dz || 0) <= od) { drawEnt(ctx, ents[ei], dt); drawn.push(ents[ei]); ei++; }
      if (!o) break;
      if (o.X > vx1 || o.bx1 < vx0 || o.Y > vy1 || o.by1 < vy0) continue;
      // occlusion: fade trees/walls/towers in front of a hero; otherwise mark for a silhouette
      const cx0 = o.X + o.w * 0.18, cx1 = o.bx1 - o.w * 0.18, cy0 = o.Y + o.h * 0.12, cy1 = o.by1 - o.h * 0.08;
      let fade = false;
      if (o.height > 16) for (let k = 0; k < drawn.length; k++) {
        const u = drawn[k];
        if (u.kind !== 'hero' && u.kind !== 'guard') continue;
        const X = u.x - u.y, Y = (u.x + u.y) / 2;
        if (X + 5 > cx0 && X - 5 < cx1 && Y - 8 > cy0 && Y - 30 < cy1) {
          if (o.fade && u.kind === 'hero' && !u.down) fade = true; else u._occ = frameNo;
        }
      }
      if (!R.flags.noStatic) {
        if (fade) ctx.globalAlpha = 0.42;
        ctx.drawImage(o.img, o.sx, o.sy, o.sw, o.sh, o.X, o.Y, o.w, o.h);
        if (fade) ctx.globalAlpha = 1;
      }
    }
    // projectiles
    for (const p of G.projs) {
      const X = p.x - p.y, Y = (p.x + p.y) / 2;
      if (p.kind === 'arrow') {
        const ca = Math.cos(p.ang || 0), sa = Math.sin(p.ang || 0);
        const ang = Math.atan2((ca + sa) / 2, ca - sa);
        ctx.save(); ctx.translate(X, Y - 14); ctx.rotate(ang);
        ctx.strokeStyle = '#e8d8a8'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(5, 0); ctx.stroke();
        ctx.fillStyle = '#ddd'; ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(4, -1.8); ctx.lineTo(4, 1.8); ctx.fill();
        ctx.fillStyle = '#c33'; ctx.fillRect(-9, -1.5, 2.4, 3);
        ctx.restore();
      } else {
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(X, Y, 4, 2, 0, 0, 7); ctx.fill();
        const y = Y - 10 - p.z;
        if (p.kind === 'hive') { ctx.fillStyle = '#d9a83a'; ctx.strokeStyle = OUT; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.ellipse(X, y, 4.5, 5.5, 0, 0, 7); ctx.fill(); ctx.stroke(); ctx.strokeStyle = '#8a5a1a'; ctx.beginPath(); ctx.moveTo(X - 4.5, y - 1.5); ctx.lineTo(X + 4.5, y - 1.5); ctx.moveTo(X - 4.5, y + 1.5); ctx.lineTo(X + 4.5, y + 1.5); ctx.stroke(); }
        else { ctx.fillStyle = '#7a4a22'; ctx.strokeStyle = OUT; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(X, y, 3.6, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#ffd84a'; ctx.fillRect(X - 1, y - 5, 2, 2); }
      }
    }
    for (const f of G.fx) {
      if (f.type !== 'bees') continue;
      const X = f.x - f.y, Y = (f.x + f.y) / 2;
      ctx.fillStyle = '#ffd23a';
      for (let i = 0; i < 12; i++) { const a = now * (3 + i % 3) + i * 0.52; const rr = 10 + (i % 4) * 6; ctx.fillRect(X + Math.cos(a) * rr, Y - 10 + Math.sin(a * 1.3) * rr * 0.5, 1.8, 1.8); }
    }
    // torch flames + glow
    for (const t of G.torches) {
      if (!inView(t.x, t.y, 40)) continue;
      const X = t.x - t.y, Y = (t.x + t.y) / 2 - 30;
      const fl = Math.sin(now * 18 + t.x) * 1;
      ctx.fillStyle = '#ff8a2a'; ctx.beginPath(); ctx.ellipse(X, Y - 3, 3, 4.6 + fl, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffe27a'; ctx.beginPath(); ctx.ellipse(X, Y - 2, 1.5, 2.6 + fl * 0.5, 0, 0, 7); ctx.fill();
    }
    if (G.night && G.torches.length && !R.flags.noNight) {
      ctx.globalCompositeOperation = 'lighter';
      for (const t of G.torches) {
        if (!inView(t.x, t.y, 120)) continue;
        const X = t.x - t.y, Y = (t.x + t.y) / 2 - 18;
        const r0 = 3.2 * TILE * (1 + Math.sin(now * 7 + t.x) * 0.03);
        ctx.globalAlpha = 0.55; ctx.drawImage(glowSprite, X - r0 * 1.4, Y - r0 * 0.9, r0 * 2.8, r0 * 1.8);
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    }
    // silhouettes for occluded heroes / guards
    for (const u of drawn) {
      if (u._occ !== frameNo) continue;
      if (u.kind === 'guard' && (u.state === 'dead' || u.state === 'ko')) continue;
      if (u.kind === 'hero' && u.down) continue;
      const X = u.x - u.y, Y = (u.x + u.y) / 2;
      const col = u.kind === 'hero' ? (G.sel.includes(u) ? 'rgba(150,255,110,0.6)' : 'rgba(150,230,255,0.5)') : 'rgba(255,90,70,0.55)';
      ctx.fillStyle = col; ctx.strokeStyle = 'rgba(10,10,10,0.6)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.ellipse(X, Y - 12, 4.6, 10, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(X, Y - 26, 3.4, 0, 7); ctx.fill(); ctx.stroke();
    }

    // ---- screen-space overlays ----
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const g of G.guards) {
      if (g.carried || !inView(g.x, g.y, 60)) continue;
      R.toScreen(g.x, g.y, tmp);
      const top = tmp.y - (g.sheriff ? 40 : 35) * z;
      if (g.state === 'ko') {
        if (!g.tied) {
          const k = RH.clamp(g.koT / 55, 0, 1);
          ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(tmp.x, tmp.y - 16 * z, 8, 0, 7); ctx.stroke();
          ctx.strokeStyle = k < 0.25 ? '#ff6a4a' : '#ffe38a'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.arc(tmp.x, tmp.y - 16 * z, 8, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.stroke();
          label(ctx, 'z', tmp.x + 13 + Math.sin(now * 2) * 2, tmp.y - 24 * z - (now * 8 % 8), 13, '#e8f0ff');
        } else label(ctx, '🪢', tmp.x, tmp.y - 16 * z, 13, '#fff');
        continue;
      }
      if (g.state === 'dead') continue;
      if (g.sus > 0.02 && g.state !== 'alert') {
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(tmp.x - 15, top - 3, 30, 6);
        ctx.fillStyle = g.sus > 0.6 ? '#ff8a2a' : '#ffd23a'; ctx.fillRect(tmp.x - 14, top - 2, 28 * Math.min(1, g.sus), 4);
      }
      if (g.icon) {
        const col = g.icon === '!' ? '#ff3b2e' : g.icon === '?' ? '#ffd23a' : g.icon === '♥' ? '#ff7aa8' : '#ffe08a';
        label(ctx, g.icon, tmp.x, top - 15 - Math.abs(Math.sin(now * 6)) * 3, 21, col);
      }
      if (g.hp < g.maxhp || g.state === 'alert') hpBar(ctx, tmp.x, top - (g.icon ? 31 : 8), g.hp / g.maxhp, '#e8483a');
      if (g.stagger > 0) label(ctx, '💫', tmp.x + 14, top + 4, 13, '#fff');
    }
    for (const h of G.heroes) {
      if (!inView(h.x, h.y, 60)) continue;
      R.toScreen(h.x, h.y, tmp);
      const top = tmp.y - 37 * z;
      if (h.down) { label(ctx, '✚', tmp.x, tmp.y - 16 * z, 17, '#ff6a5a'); continue; }
      if (h.hp < h.maxhp || G.sel.includes(h)) hpBar(ctx, tmp.x, top, h.hp / h.maxhp, '#5adc4a');
      if (h.busy > 0) label(ctx, h.busyType === 'climb' ? '🧗' : '…', tmp.x, top - 14, 18, '#fff');
      if (h.parryT > 0) label(ctx, '🛡', tmp.x - 15, top + 8, 13, '#fff');
      if (h.sneak) label(ctx, '🦶', tmp.x + 15, tmp.y - 6, 11, '#fff');
      if (RH.hideAt(G.grid, h.x, h.y)) label(ctx, 'hidden', tmp.x, tmp.y + 11, 11, '#bff5a0');
    }
    if (G.prisoner && !G.prisoner.freed && inView(G.prisoner.x, G.prisoner.y, 60)) {
      R.toScreen(G.prisoner.x, G.prisoner.y, tmp);
      label(ctx, 'HELP!', tmp.x, tmp.y - 42 * z - Math.abs(Math.sin(now * 3)) * 3, 13, '#fff2a8');
    }
    if (G.captives) for (const cp of G.captives) {
      if (cp.freed || !inView(cp.x, cp.y, 60)) continue;
      R.toScreen(cp.x, cp.y, tmp);
      label(ctx, '🔗', tmp.x, tmp.y - 40 * z - Math.abs(Math.sin(now * 3 + 1)) * 3, 14, '#fff');
    }
    if (G.climbs) for (const cl of G.climbs) {
      const mx = (cl.a.x + cl.b.x) / 2, my = (cl.a.y + cl.b.y) / 2;
      if (!inView(mx, my, 60)) continue;
      R.toScreen(mx, my, tmp);
      label(ctx, cl.rope ? '🪢' : '🧗', tmp.x, tmp.y - 44 * z, 16, '#fff');
    }
    for (const f of G.fx) {
      if (f.type === 'text') {
        R.toScreen(f.x, f.y, tmp);
        const k = f.t / f.life;
        ctx.globalAlpha = 1 - k * k;
        label(ctx, f.text, tmp.x, tmp.y - 10 * z - k * 26, 15, f.color);
        ctx.globalAlpha = 1;
      } else if (f.type === 'stars') {
        R.toScreen(f.x, f.y, tmp);
        for (let i = 0; i < 4; i++) { const a = now * 5 + i * 1.57; label(ctx, '★', tmp.x + Math.cos(a) * 12, tmp.y - 10 * z + Math.sin(a) * 4 - f.t * 6, 11, '#ffe86a'); }
      } else if (f.type === 'spark') {
        R.toScreen(f.x, f.y, tmp);
        ctx.strokeStyle = `rgba(255,240,180,${1 - f.t / f.life})`; ctx.lineWidth = 2;
        for (let i = 0; i < 5; i++) { const a = i * 1.26; const r1 = 4 + f.t * 30; ctx.beginPath(); ctx.moveTo(tmp.x + Math.cos(a) * r1, tmp.y - 16 * z + Math.sin(a) * r1); ctx.lineTo(tmp.x + Math.cos(a) * (r1 + 5), tmp.y - 16 * z + Math.sin(a) * (r1 + 5)); ctx.stroke(); }
      } else if (f.type === 'slash') {
        // screen-space sword trail
        const k = f.t / f.life;
        ctx.strokeStyle = `rgba(255,250,230,${0.9 * (1 - k)})`; ctx.lineWidth = 6 * (1 - k) + 1; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(f.x, f.y); ctx.quadraticCurveTo((f.x + f.x2) / 2 + (f.y2 - f.y) * 0.15, (f.y + f.y2) / 2 - (f.x2 - f.x) * 0.15, f.x2, f.y2); ctx.stroke();
        ctx.lineCap = 'butt';
      }
    }
    if (G.mode) drawTargeting(ctx);
  };

  function drawEnt(c, u, dt) {
    const X = u.x - u.y, Y = (u.x + u.y) / 2;
    if (u.kind === 'hero') {
      if (u.swingT > 0) u.swingT -= dt;
      const L = heroLook(u);
      const hidden = RH.hideAt(G.grid, u.x, u.y);
      if (hidden) c.globalAlpha = 0.6;
      if (u.down) lying(c, X, Y, u, L, 'down');
      else {
        if (u.busyType === 'climb' && u.busy > 0) { const k = 1 - u.busy / (u.climbDur || 1.6); figure(c, X, Y - Math.sin(k * Math.PI) * 26, u, L); }
        else figure(c, X, Y, u, L);
        if (u.carry) drawCarried(c, u, X, Y);
      }
      if (u.flash > 0) { c.fillStyle = 'rgba(255,60,40,0.4)'; c.beginPath(); c.arc(X, Y - 14, 10, 0, 7); c.fill(); }
      c.globalAlpha = 1;
    } else if (u.kind === 'guard') {
      if (u.swingT > 0) u.swingT -= dt;
      const L = u.sheriff ? SHERIFF_LOOK : GUARD_LOOK;
      if (u.state === 'ko' || u.state === 'dead') lying(c, X, Y, u, L, u.state);
      else figure(c, X, Y, u, L);
      if (u.flash > 0) { c.fillStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.arc(X, Y - 14, 9, 0, 7); c.fill(); }
    } else if (u.kind === 'civ') {
      const L = u.carter ? CARTER_LOOK : CIV_LOOKS[u.look % CIV_LOOKS.length];
      if (u.state === 'ko') lying(c, X, Y, u, L, 'ko'); else figure(c, X, Y, u, L);
    } else if (u === G.chest) drawChest(c, X, Y, 1);
    else if (u === G.cart) drawCart(c, u);
    else if (u === G.log) drawLog(c, u);
    else if (u === G.prisoner || u.captive) drawPrisoner(c, u, X, Y);
    else if (u.v != null) { // gold
      const b = Math.sin(now * 3 + u.x) * 1.2;
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(X, Y + 1, 5, 2.2, 0, 0, 7); c.fill();
      c.fillStyle = '#8a5a22'; c.strokeStyle = OUT; c.lineWidth = 0.8;
      c.beginPath(); c.arc(X, Y - 4 + b, 4.6, 0, 7); c.fill(); c.stroke();
      c.fillStyle = '#ffd84a'; c.beginPath(); c.arc(X, Y - 7.5 + b, 2.6, 0, 7); c.fill();
      c.fillStyle = 'rgba(255,255,220,' + (0.5 + 0.5 * Math.sin(now * 5 + u.y)) + ')'; c.fillRect(X + 2.5, Y - 12 + b, 1.2, 1.2);
    }
  }

  function label(ctx, t, x, y, size, col) {
    ctx.font = `800 ${size}px system-ui, -apple-system, sans-serif`;
    ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(15,10,5,0.85)';
    ctx.strokeText(t, x, y); ctx.fillStyle = col; ctx.fillText(t, x, y);
  }
  function hpBar(ctx, x, y, k, col) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x - 15, y - 3, 30, 6);
    ctx.fillStyle = k < 0.34 ? '#ff4a3a' : col; ctx.fillRect(x - 14, y - 2, 28 * RH.clamp(k, 0, 1), 4);
  }

  // soft cones: radial gradients defined in unit space, scaled per guard
  let CONE_G = null;
  function coneGrads(ctx) {
    const mk = (a0, a1, rgb) => { const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 1); g.addColorStop(0, `rgba(${rgb},${a0})`); g.addColorStop(0.75, `rgba(${rgb},${(a0 + a1) / 2})`); g.addColorStop(1, `rgba(${rgb},${a1})`); return g; };
    CONE_G = {
      norm: mk(0.34, 0.08, '255,96,60'), sus: mk(0.42, 0.12, '255,206,60'), alert: mk(0.5, 0.16, '255,30,20'), charm: mk(0.28, 0.06, '255,130,190'),
      normN: mk(0.3, 0.1, '255,120,80'),
    };
  }
  function drawCones(ctx, inView, worldT) {
    if (R.flags.noCones) return;
    if (!CONE_G) coneGrads(ctx);
    const NR = RH.game.NRAYS;
    for (const g of G.guards) {
      if (!RH.game.isActive(g) || g.state === 'stunned' || g.state === 'counting') continue;
      const range = RH.game.guardRange(g);
      if (!inView(g.x, g.y, range * 1.5 + 30)) continue;
      RH.game.computeCone(g);
      let fill, line, lw = 1;
      if (g.state === 'alert') { fill = CONE_G.alert; line = 'rgba(255,40,20,0.8)'; lw = 1.6; }
      else if (g.state === 'charmed') { fill = CONE_G.charm; line = 'rgba(255,140,190,0.55)'; }
      else if (g.sus > 0.25 || g.state === 'investigate' || g.state === 'search') { fill = CONE_G.sus; line = 'rgba(255,214,60,0.85)'; lw = 1.5; }
      else { fill = G.night ? CONE_G.normN : CONE_G.norm; line = 'rgba(255,110,70,0.55)'; }
      const half = g.fov / 2, ox = g.x, oy = g.y;
      worldT();
      ctx.translate(ox, oy); ctx.scale(range, range);
      ctx.beginPath(); ctx.moveTo(0, 0);
      for (let i = 0; i < NR; i++) {
        const a = g.dir - half + (g.fov * i) / (NR - 1);
        const d = g.cone[i] / range;
        ctx.lineTo(Math.cos(a) * d, Math.sin(a) * d);
      }
      ctx.closePath();
      ctx.fillStyle = fill; ctx.fill();
      ctx.strokeStyle = line; ctx.lineWidth = lw / (range * G.cam.z); ctx.stroke();
    }
  }

  function drawChest(ctx, X, Y, s) {
    ctx.save(); ctx.translate(X, Y); ctx.scale(s * 0.8, s * 0.8);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 2, 11, 4, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#7a4a1e'; ctx.strokeStyle = OUT; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.roundRect(-10, -12, 20, 14, 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#9a6028'; ctx.beginPath(); ctx.roundRect(-10, -16, 20, 6, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e8c04a'; ctx.fillRect(-6, -16, 2.5, 18); ctx.fillRect(3.5, -16, 2.5, 18); ctx.fillRect(-1.5, -10, 3, 3.5);
    ctx.restore();
  }
  function drawLog(ctx, l) {
    const P = (x, y, zz) => [x - y, (x + y) / 2 - zz];
    const a = P(l.x - 40, l.y, 6), b = P(l.x + 40, l.y, 6);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.moveTo(a[0], a[1] + 8); ctx.lineTo(b[0], b[1] + 8); ctx.lineTo(b[0] + 6, b[1] + 12); ctx.lineTo(a[0] + 6, a[1] + 12); ctx.fill();
    ctx.strokeStyle = OUT; ctx.lineWidth = 13; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    ctx.strokeStyle = '#6a4424'; ctx.lineWidth = 11; ctx.stroke(); ctx.lineCap = 'butt';
    ctx.strokeStyle = 'rgba(200,160,110,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a[0], a[1] - 3); ctx.lineTo(b[0], b[1] - 3); ctx.stroke();
    ctx.fillStyle = '#c9a06a'; ctx.beginPath(); ctx.ellipse(b[0], b[1], 4, 5.5, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#2f5a1f'; ctx.lineWidth = 2.4;
    for (const t of [0.3, 0.6]) { const x = a[0] + (b[0] - a[0]) * t, y = a[1] + (b[1] - a[1]) * t; ctx.beginPath(); ctx.moveTo(x, y - 4); ctx.lineTo(x - 6, y - 14); ctx.stroke(); ctx.fillStyle = '#4a7a2a'; ctx.beginPath(); ctx.arc(x - 6, y - 15, 4, 0, 7); ctx.fill(); }
  }
  function drawCart(ctx, cart) {
    const P = (x, y, zz) => [x - y, (x + y) / 2 - zz];
    const cx = cart.x, cy = cart.y;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; { const p = P(cx, cy + 10, 0); ctx.beginPath(); ctx.ellipse(p[0], p[1], 26, 13, 0, 0, 7); ctx.fill(); }
    // horse (south, i.e. ahead along +y)
    const step = cart.state === 'moving' ? Math.sin(cart.wheel * 2) * 1.5 : 0;
    const hp = P(cx, cy + 34, 0);
    ctx.fillStyle = '#6a4226'; ctx.strokeStyle = OUT; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(hp[0], hp[1] - 13, 8, 6, 0.45, 0, 7); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(hp[0] - 7, hp[1] - 16 + step * 0.2, 3.4, 5.5, -0.4, 0, 7); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#3a2416'; ctx.lineWidth = 1.6;
    for (const [dx, dy] of [[-5, -3], [5, 2], [-2, 4], [3, -4]]) { ctx.beginPath(); ctx.moveTo(hp[0] + dx, hp[1] - 9 + dy * 0.3); ctx.lineTo(hp[0] + dx + step * (dx > 0 ? 1 : -1), hp[1] + dy * 0.3); ctx.stroke(); }
    // bed
    const q = (pts, fill) => { ctx.fillStyle = fill; ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]))); ctx.closePath(); ctx.fill(); ctx.stroke(); };
    ctx.strokeStyle = OUT; ctx.lineWidth = 0.8;
    const x0 = cx - 13, x1 = cx + 13, y0 = cy - 20, y1 = cy + 16, z0 = 8, z1 = 17;
    q([P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)], '#8a6238');
    q([P(x1, y1, z0), P(x1, y0, z0), P(x1, y0, z1), P(x1, y1, z1)], '#6a4a2a');
    q([P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1)], '#a67c4a');
    // wheels
    for (const wy of [cy - 12, cy + 8]) { const p = P(x1 + 1, wy, 7); ctx.fillStyle = '#3a2a1a'; ctx.beginPath(); ctx.ellipse(p[0], p[1], 3.6, 7, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#8a6a4a'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(p[0], p[1] - 6); ctx.lineTo(p[0], p[1] + 6); ctx.stroke(); ctx.strokeStyle = OUT; }
    // sacks
    for (const [sx, sy] of [[-5, 8], [6, 6], [0, -10]]) { const p = P(cx + sx, cy + sy, z1 + 3); ctx.fillStyle = '#d8c49a'; ctx.beginPath(); ctx.ellipse(p[0], p[1], 5, 3.6, 0, 0, 7); ctx.fill(); ctx.stroke(); }
    if (cart.chest) { const p = P(cx, cy - 2, z1); drawChest(ctx, p[0], p[1], 0.85); }
  }
  function drawPrisoner(ctx, p, X, Y) {
    const L = p.look || heroLook({ key: p.key, def: p.def || RH.HEROES[p.key] });
    ctx.fillStyle = '#5a3a1a'; ctx.fillRect(X - 1.5, Y - 30, 3, 30);
    figure(ctx, X + 2, Y + 2, FAKE, noWeapon(L));
    ctx.strokeStyle = '#d9b46a'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(X - 4, Y - 18); ctx.lineTo(X + 7, Y - 16); ctx.moveTo(X - 4, Y - 13); ctx.lineTo(X + 7, Y - 11); ctx.stroke();
  }
  function drawCarried(ctx, h, X, Y) {
    if (h.carry === 'chest') { drawChest(ctx, X, Y - 26, 0.85); return; }
    const L = h.carry.sheriff ? SHERIFF_LOOK : GUARD_LOOK;
    ctx.save(); ctx.translate(X, Y - 24); ctx.rotate(-Math.PI / 2); ctx.scale(0.75, 0.75);
    figure(ctx, 6, 8, FAKE, noWeapon(L), true);
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
    const z = G.cam.z;
    ctx.strokeStyle = 'rgba(255,240,150,0.85)'; ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
    ctx.beginPath(); ctx.ellipse(tmp.x, tmp.y, range * Math.SQRT2 * z, range * Math.SQRT2 * z / 2, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,240,150,0.06)'; ctx.fill();
    if (m === 'shoot' || m === 'charm') {
      for (const g of G.guards) {
        if (!RH.game.isActive(g)) continue;
        if (m === 'charm' && g.state === 'alert') continue;
        R.toScreen(g.x, g.y, tmp); tmp.y -= 14 * z;
        ctx.strokeStyle = m === 'shoot' ? '#ff5a4a' : '#ff8ac0'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(tmp.x, tmp.y, 15, 0, 7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(tmp.x - 21, tmp.y); ctx.lineTo(tmp.x - 9, tmp.y); ctx.moveTo(tmp.x + 9, tmp.y); ctx.lineTo(tmp.x + 21, tmp.y); ctx.stroke();
      }
    }
  }

  // ---------- portraits (painted busts for the scroll cards) ----------
  R.portrait = function (canvas, key, def) {
    const c = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const s = canvas.clientWidth || 48, sh2 = canvas.clientHeight || s;
    canvas.width = Math.round(s * dpr); canvas.height = Math.round(sh2 * dpr);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, s, sh2);
    const d = def || RH.HEROES[key];
    const L = heroLook({ key, def: d });
    bust(c, s, sh2, L, key);
  };
  function bust(c, w, h, L, key) {
    // background vignette
    const bg = c.createRadialGradient(w * 0.45, h * 0.35, 2, w / 2, h / 2, w * 0.75);
    bg.addColorStop(0, '#6f7f4a'); bg.addColorStop(1, '#27301a');
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    c.save();
    const k = w / 40;
    c.translate(w / 2, h * 0.58); c.scale(k, k);
    c.lineJoin = 'round'; c.strokeStyle = 'rgba(25,15,8,0.9)'; c.lineWidth = 0.9;
    const tunic = L.mail ? '#80868e' : L.tunic;
    // shoulders
    c.fillStyle = tunic; c.beginPath(); c.moveTo(-19, 22); c.quadraticCurveTo(-17, 6, -6, 4); c.lineTo(6, 4); c.quadraticCurveTo(17, 6, 19, 22); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = 'rgba(0,0,0,0.18)'; c.beginPath(); c.moveTo(4, 5); c.quadraticCurveTo(16, 7, 19, 22); c.lineTo(6, 22); c.closePath(); c.fill();
    if (L.trim) { c.strokeStyle = L.trim; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-5, 5); c.lineTo(0, 12); c.lineTo(5, 5); c.stroke(); c.strokeStyle = 'rgba(25,15,8,0.9)'; c.lineWidth = 0.9; }
    if (L.quiver) { c.strokeStyle = '#6a4222'; c.lineWidth = 2.2; c.beginPath(); c.moveTo(-14, 20); c.lineTo(10, 4); c.stroke(); c.lineWidth = 0.9; c.strokeStyle = 'rgba(25,15,8,0.9)'; }
    // neck + head
    c.fillStyle = L.skin; c.fillRect(-3, -1, 6, 7);
    c.beginPath(); c.ellipse(0, -8, 8.2, 9.6, 0, 0, 7); c.fill(); c.stroke();
    // cheek shading
    const sk = c.createLinearGradient(-8, 0, 8, 0); sk.addColorStop(0, 'rgba(255,240,220,0.18)'); sk.addColorStop(1, 'rgba(90,40,20,0.25)');
    c.fillStyle = sk; c.beginPath(); c.ellipse(0, -8, 8.2, 9.6, 0, 0, 7); c.fill();
    // hair
    c.fillStyle = L.hair;
    if (key === 'tuck') { c.beginPath(); c.ellipse(-7.6, -9, 2.2, 4, 0, 0, 7); c.fill(); c.beginPath(); c.ellipse(7.6, -9, 2.2, 4, 0, 0, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,0.3)'; c.beginPath(); c.ellipse(-2, -15, 3, 1.6, 0, 0, 7); c.fill(); }
    else if (key === 'marian') { c.beginPath(); c.moveTo(-9, 6); c.quadraticCurveTo(-12, -12, -2, -18); c.quadraticCurveTo(10, -19, 10, -6); c.quadraticCurveTo(11, 4, 9, 8); c.lineTo(7, -6); c.quadraticCurveTo(2, -14, -6, -10); c.lineTo(-6, 6); c.closePath(); c.fill(); c.strokeStyle = '#d8b040'; c.lineWidth = 0.9; c.beginPath(); c.arc(0, -8, 8.6, Math.PI * 1.1, Math.PI * 1.9); c.stroke(); c.strokeStyle = 'rgba(25,15,8,0.9)'; }
    else if (!L.helmet && !L.sheriffHat && !L.hood) { c.beginPath(); c.moveTo(-8.6, -6); c.quadraticCurveTo(-9, -18, 0, -18.4); c.quadraticCurveTo(9, -18, 8.6, -6); c.quadraticCurveTo(5, -13, -2, -13); c.quadraticCurveTo(-6, -12, -8.6, -6); c.fill(); }
    if (L.beard || key === 'john') { c.fillStyle = L.hair; c.beginPath(); c.moveTo(-7.6, -6); c.quadraticCurveTo(-7, 5, 0, 5.6); c.quadraticCurveTo(7, 5, 7.6, -6); c.quadraticCurveTo(4, -1, 0, -1.4); c.quadraticCurveTo(-4, -1, -7.6, -6); c.fill(); }
    if (key === 'robin' || key === 'scarlet') { c.fillStyle = L.hair; c.beginPath(); c.moveTo(-3, -1.6); c.quadraticCurveTo(0, 1, 3, -1.6); c.quadraticCurveTo(0, 4.6, -3, -1.6); c.fill(); }
    // face
    c.fillStyle = '#1a1210';
    c.beginPath(); c.ellipse(-3, -8.5, 1.1, 0.9, 0, 0, 7); c.fill(); c.beginPath(); c.ellipse(3, -8.5, 1.1, 0.9, 0, 0, 7); c.fill();
    c.strokeStyle = shade(L.hair[0] === '#' ? L.hair : '#3a2a1a', 0.8); c.lineWidth = 1; c.beginPath(); c.moveTo(-5, -10.6); c.lineTo(-1.5, -10.2); c.moveTo(1.5, -10.2); c.lineTo(5, -10.6); c.stroke();
    c.strokeStyle = 'rgba(110,50,30,0.6)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(0, -8); c.lineTo(-1, -4.6); c.lineTo(0.6, -4.4); c.stroke();
    c.strokeStyle = 'rgba(120,40,30,0.8)'; c.beginPath(); c.moveTo(-2, -2.4); c.quadraticCurveTo(0, -1.4, 2, -2.4); c.stroke();
    c.strokeStyle = 'rgba(25,15,8,0.9)'; c.lineWidth = 0.9;
    // headgear
    if (L.hat) {
      c.fillStyle = L.hat; c.beginPath(); c.moveTo(-10.5, -12); c.quadraticCurveTo(0, -16.5, 11, -11.5); c.quadraticCurveTo(4, -22, -3, -26); c.quadraticCurveTo(-8, -20, -10.5, -12); c.closePath(); c.fill(); c.stroke();
      if (L.feather) { c.strokeStyle = L.feather; c.lineWidth = 2; c.beginPath(); c.moveTo(-2, -18); c.quadraticCurveTo(-10, -28, -17, -25); c.stroke(); }
    }
    if (L.helmet) { c.fillStyle = '#8e969e'; c.beginPath(); c.arc(0, -10, 9.4, Math.PI, 0); c.lineTo(10.4, -9); c.lineTo(-10.4, -9); c.closePath(); c.fill(); c.stroke(); c.fillRect(-1, -10, 2, 6); }
    if (L.hood) { c.fillStyle = L.hood; c.beginPath(); c.moveTo(-11, 6); c.quadraticCurveTo(-12, -20, 0, -20); c.quadraticCurveTo(12, -20, 11, 6); c.lineTo(8, 6); c.quadraticCurveTo(9, -14, 0, -15); c.quadraticCurveTo(-9, -14, -8, 6); c.closePath(); c.fill(); c.stroke(); }
    if (L.sheriffHat) { c.fillStyle = '#16121e'; c.beginPath(); c.ellipse(0, -15, 12, 3, 0, 0, 7); c.fill(); c.fillRect(-6, -25, 12, 10); }
    c.restore();
  }
  R.bust = bust;
  R._figure = figure;
})(window.RH);
