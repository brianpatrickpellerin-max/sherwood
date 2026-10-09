// Procedural UI art: parchment fibre texture, the ivy border under the portrait cards,
// and the painted title backdrop (an isometric walled town in Sherwood, built with the game's own sprites).
'use strict';
(function (RH) {
  const art = {};
  RH.art = art;
  const cv = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  function parchTex() {
    const c = cv(160, 160), x = c.getContext('2d'), r = RH.rng(77);
    for (let i = 0; i < 2600; i++) {
      x.fillStyle = r() < 0.5 ? `rgba(120,80,30,${0.05 + r() * 0.07})` : `rgba(255,248,220,${0.05 + r() * 0.08})`;
      x.fillRect(r() * 160, r() * 160, 1 + r() * 1.5, 1 + r() * 1.5);
    }
    x.lineWidth = 0.6;
    for (let i = 0; i < 60; i++) {
      x.strokeStyle = `rgba(110,70,25,${0.05 + r() * 0.08})`;
      const a = r() * 160, b = r() * 160, l = 6 + r() * 18, ang = r() * 6.28;
      x.beginPath(); x.moveTo(a, b); x.quadraticCurveTo(a + Math.cos(ang) * l * 0.5 + 3, b + Math.sin(ang) * l * 0.5, a + Math.cos(ang) * l, b + Math.sin(ang) * l); x.stroke();
    }
    for (let i = 0; i < 6; i++) {
      const a = r() * 160, b = r() * 160, rad = 10 + r() * 22;
      const g = x.createRadialGradient(a, b, 0, a, b, rad);
      g.addColorStop(0, 'rgba(140,90,30,0.08)'); g.addColorStop(1, 'rgba(140,90,30,0)');
      x.fillStyle = g; x.fillRect(a - rad, b - rad, rad * 2, rad * 2);
    }
    return c.toDataURL('image/png');
  }

  function leaf(x, cx, cy, s, ang, col, vein) {
    x.save(); x.translate(cx, cy); x.rotate(ang); x.scale(s, s);
    x.fillStyle = col;
    x.beginPath();
    x.moveTo(0, 6);
    x.bezierCurveTo(-3, 4, -9, 3, -8, -1); x.bezierCurveTo(-7, -3, -4, -2, -3, -3);
    x.bezierCurveTo(-4, -7, -1, -10, 0, -11); x.bezierCurveTo(1, -10, 4, -7, 3, -3);
    x.bezierCurveTo(4, -2, 7, -3, 8, -1); x.bezierCurveTo(9, 3, 3, 4, 0, 6);
    x.fill();
    x.strokeStyle = vein; x.lineWidth = 0.7;
    x.beginPath(); x.moveTo(0, 5); x.lineTo(0, -8); x.moveTo(0, 1); x.lineTo(-6, -1); x.moveTo(0, 1); x.lineTo(6, -1); x.stroke();
    x.restore();
  }
  // Ivy strip, seamlessly tileable horizontally, drawn at 2x for crisp phones.
  function ivyStrip() {
    const W = 360, H = 64, c = cv(W, H), x = c.getContext('2d'), r = RH.rng(31);
    // dark bed
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(8,16,6,0)'); g.addColorStop(0.35, 'rgba(8,16,6,0.85)'); g.addColorStop(1, '#08110a');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    // stems
    x.strokeStyle = '#2a1c0e'; x.lineWidth = 2.2;
    for (let k = 0; k < 3; k++) {
      x.beginPath();
      for (let i = 0; i <= 36; i++) { const px = i * W / 36, py = 30 + k * 9 + Math.sin(i * 0.9 + k * 2) * 6; if (i) x.lineTo(px, py); else x.moveTo(px, py); }
      x.stroke();
    }
    const cols = ['#1d3512', '#24421a', '#2c4e1e', '#183010', '#355a24', '#20381a'];
    const leaves = [];
    for (let i = 0; i < 120; i++) leaves.push([r() * W, 14 + r() * 46, 0.9 + r() * 0.9, (r() - 0.5) * 1.8, cols[Math.floor(r() * cols.length)]]);
    for (let i = 0; i < 26; i++) leaves.push([r() * W, 4 + r() * 14, 0.8 + r() * 0.6, (r() - 0.5) * 1.2, cols[Math.floor(r() * 3) + 2]]);
    leaves.sort((a, b) => a[1] - b[1]);
    for (const [lx, ly, s, a, col] of leaves) for (const ox of [-W, 0, W]) {
      if (lx + ox < -24 || lx + ox > W + 24) continue;
      leaf(x, lx + ox, ly, s, a, col, 'rgba(120,160,70,0.35)');
    }
    // a few highlights catching light
    for (let i = 0; i < 18; i++) { const lx = r() * W, ly = 10 + r() * 30; for (const ox of [-W, 0, W]) leaf(x, lx + ox, ly, 0.7 + r() * 0.4, (r() - 0.5) * 1.4, 'rgba(90,130,50,0.55)', 'rgba(170,200,110,0.3)'); }
    return c.toDataURL('image/png');
  }

  art.init = function () {
    const root = document.documentElement.style;
    try {
      root.setProperty('--tex', `url(${parchTex()})`);
      root.setProperty('--ivy', `url(${ivyStrip()})`);
    } catch (e) { /* keep flat colours */ }
  };

  // ---------- Title backdrop ----------
  const TITLE_MAP = [
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTT....TTTTTTTTTT....TTTTT',
    'TTTTT.........TTTT.........TTT',
    'TTTT....###########.........TT',
    'TTT.....#rrrr.rrrr#...T......T',
    'TTT.....#rrrr.rrrr#..........T',
    'TT......#.........#...rrr....T',
    'TT..T...#rrr.m.rrr#...rrr....T',
    'TT......#rrr...rrr#..........T',
    'TT......#.h.....c.#.....b....T',
    'TTT.....####,,#####..........T',
    'TTTb.......,,..........wwwwwwT',
    'TTTT.......,,.......wwwww...TT',
    'TTTT........,,...wwwww......TT',
    'TTT..T.......,wwwww...T....TTT',
    'TT..........wwww,,.........TTT',
    'TT.......wwww....,,...rr..TTTT',
    'TT....wwww.........,..rr..TTTT',
    'TT..www....T..rr...,,.....TTTT',
    'TTwww.....TT..rr....,,..TTTTTT',
    'Tww...........hh.....,,TTTTTTT',
    'ww..b....T............,TTTTTTT',
    'w....................TTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
  ];
  let titleScene = null;
  art.drawTitle = function (canvas) {
    const W = window.innerWidth, H = window.innerHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    const c = canvas.getContext('2d');
    if (!titleScene) {
      try { titleScene = RH.iso.buildScene(RH.makeGrid(TITLE_MAP), { theme: 'town', night: false, torches: [], seed: 4711, margin: 4 }); }
      catch (e) { titleScene = null; }
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#1e2a12'; c.fillRect(0, 0, canvas.width, canvas.height);
    const sc = titleScene;
    if (sc) {
      const T = RH.TILE, fx = 14 * T, fy = 9 * T; // focus: the walled town
      const FX = fx - fy, FY = (fx + fy) / 2;
      const z = Math.max(W / (19 * T), H / (30 * T)) * 0.92;
      const ox = W / 2 - FX * z, oy = H * 0.36 - FY * z;
      c.setTransform(dpr * z, 0, 0, dpr * z, dpr * ox, dpr * oy);
      const pat = c.createPattern(sc.pat, 'repeat');
      if (pat.setTransform && typeof DOMMatrix !== 'undefined') pat.setTransform(new DOMMatrix([1 / sc.s, 0, 0, 1 / sc.s, 0, 0]));
      c.fillStyle = pat; c.fillRect(-ox / z - 10, -oy / z - 10, W / z + 20, H / z + 20);
      c.drawImage(sc.ground, sc.X0, sc.Y0, sc.ground.width / sc.s, sc.ground.height / sc.s);
      for (const o of sc.objs) c.drawImage(o.img, o.sx, o.sy, o.sw, o.sh, o.X, o.Y, o.w, o.h);
    }
    // golden afternoon haze, vignette and a dark foot for the menu
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    let g = c.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, 'rgba(255,214,140,0.22)'); g.addColorStop(0.5, 'rgba(255,200,120,0.05)'); g.addColorStop(1, 'rgba(40,20,0,0.15)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    g = c.createRadialGradient(W / 2, H * 0.4, Math.min(W, H) * 0.3, W / 2, H * 0.45, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(8,10,4,0.75)');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    g = c.createLinearGradient(0, H * 0.45, 0, H);
    g.addColorStop(0, 'rgba(8,12,5,0)'); g.addColorStop(1, 'rgba(8,12,5,0.9)');
    c.fillStyle = g; c.fillRect(0, H * 0.45, W, H * 0.55);
  };
})(window.RH);
