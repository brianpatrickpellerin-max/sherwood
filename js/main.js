// Boot, game loop, camera, save data, service worker, and a hidden test hook.
'use strict';
(function (RH) {
  const G = RH.G;
  const TILE = RH.TILE;
  const main = {};
  RH.main = main;
  const KEY = 'sherwood.save.v1';

  // ---------- Profile / save ----------
  function freshProfile() {
    return { v: 1, gold: 30, arrows: 10, potions: 1, up: {}, unlocked: 1, stars: [0, 0, 0, 0, 0], best: {}, muted: true, started: false };
  }
  RH.profile = freshProfile();
  RH.loadProfile = function () {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) RH.profile = Object.assign(freshProfile(), JSON.parse(raw));
    } catch (e) { /* ignore */ }
  };
  RH.saveProfile = function () {
    try { localStorage.setItem(KEY, JSON.stringify(RH.profile)); } catch (e) { /* ignore */ }
  };
  RH.hasSave = () => !!RH.profile.started;
  RH.resetProfile = function () {
    const muted = RH.audio.muted;
    RH.profile = freshProfile(); RH.profile.muted = muted; RH.profile.started = true; RH.saveProfile();
  };
  RH.rosterUnlocked = function () {
    const u = RH.profile.unlocked;
    const r = ['robin', 'john'];
    if (u >= 2) r.push('marian');
    if (u >= 4) r.push('tuck', 'scarlet');
    return r;
  };
  RH.buy = function (id) {
    const P = RH.profile, it = RH.SHOP.find((x) => x.id === id);
    if (!it || P.gold < it.cost) return false;
    if (it.kind === 'up') { if (P.up[id]) return false; P.up[id] = true; }
    else if (id === 'arrows') P.arrows += 5;
    else if (id === 'potion') P.potions += 1;
    P.gold -= it.cost; RH.audio.play('coin'); RH.saveProfile();
    return true;
  };
  RH.commitWin = function (res) {
    const P = RH.profile, i = G.idx;
    const reward = G.m.reward + res.stats.gold + res.stars * 15;
    if (!G.committed) {
      G.committed = true;
      P.gold += reward;
      P.arrows = Math.max(G.inv.arrows, 3);
      P.potions = G.inv.potions;
      P.stars[i] = Math.max(P.stars[i] || 0, res.stars);
      P.unlocked = Math.max(P.unlocked, Math.min(RH.MISSIONS.length, i + 2));
      const b = P.best[i];
      if (!b || res.stats.time < b) P.best[i] = Math.round(res.stats.time);
      P.started = true;
      RH.saveProfile();
    }
    return reward;
  };

  // ---------- Camera ----------
  main.clampCam = function () {
    const c = G.cam; if (!c) return;
    const W = RH.render.W, H = RH.render.H;
    const mw = G.grid.w * TILE, mh = G.grid.h * TILE;
    c.z = RH.clamp(c.z, main.minZ(), 2.6);
    const hw = W / 2 / c.z, hh = H / 2 / c.z;
    const padTop = 110 / c.z, padBot = 170 / c.z;
    if (mw < hw * 2) c.x = mw / 2; else c.x = RH.clamp(c.x, hw - 40 / c.z, mw - hw + 40 / c.z);
    if (mh + padTop + padBot < hh * 2) c.y = mh / 2; else c.y = RH.clamp(c.y, hh - padTop, mh - hh + padBot);
  };
  main.minZ = () => Math.max(0.45, Math.min(RH.render.W / (G.grid.w * TILE), RH.render.H / (G.grid.h * TILE)) * 0.95);
  main.panBy = function (dx, dy) { if (!G.cam) return; G.cam.x -= dx / G.cam.z; G.cam.y -= dy / G.cam.z; main.clampCam(); };
  main.zoomAt = function (z, sx, sy) {
    if (!G.cam) return;
    const before = RH.render.toWorld(sx, sy, { x: 0, y: 0 });
    G.cam.z = RH.clamp(z, main.minZ(), 2.6);
    const after = RH.render.toWorld(sx, sy, { x: 0, y: 0 });
    G.cam.x += before.x - after.x; G.cam.y += before.y - after.y;
    main.clampCam();
  };
  main.centerOn = function (x, y) { G.cam.x = x; G.cam.y = y + 30 / G.cam.z; main.clampCam(); };
  function defaultZoom() {
    const W = RH.render.W, H = RH.render.H;
    return RH.clamp(Math.min(W, H) / (10.5 * TILE), 0.9, 1.6);
  }

  // ---------- Flow ----------
  main.begin = function (i) {
    RH.game.start(i);
    RH.render.buildStatic();
    G.cam.z = defaultZoom();
    const hs = G.heroes;
    const cx = hs.reduce((a, h) => a + h.x, 0) / hs.length, cy = hs.reduce((a, h) => a + h.y, 0) / hs.length;
    G.cam.x = cx; G.cam.y = cy - 2 * TILE;
    main.clampCam();
    RH.profile.started = true; RH.saveProfile();
    RH.ui.enterGame();
    lastT = performance.now();
  };
  main.toCamp = function () {
    for (const k of Object.keys(G)) delete G[k];
    RH.ui.showCamp();
  };

  // ---------- Loop ----------
  let canvas, ctx, lastT = 0, hudT = 0;
  const perf = { frames: 0, work: new Float32Array(600), intervals: new Float32Array(600), wi: 0 };
  function frame(t) {
    requestAnimationFrame(frame);
    const t0 = performance.now();
    let dt = (t - lastT) / 1000;
    const interval = t - lastT;
    lastT = t;
    if (!(dt > 0)) dt = 0;
    if (dt > 0.1) dt = 0.1;
    if (G.m) {
      const covered = RH.ui.screen() && RH.ui.screen() !== 'end';
      if (!G.paused && !covered && !G.over) {
        let left = dt * (G.speed || 1);
        while (left > 0) { const s = Math.min(left, 1 / 30); RH.game.update(s); left -= s; }
      }
      if (!covered || RH.ui.screen() === 'pause') RH.render.draw(ctx, G.paused || covered ? 0 : dt);
      RH.ui.tickTip(dt);
      hudT -= dt;
      if (hudT <= 0) { hudT = 0.1; RH.ui.refresh(false); }
      const w = performance.now() - t0;
      perf.work[perf.wi % 600] = w; perf.intervals[perf.wi % 600] = interval; perf.wi++;
    }
  }

  function resize() {
    RH.render.resize(canvas);
    if (G.m) main.clampCam();
  }

  main.boot = function () {
    canvas = document.getElementById('cv');
    ctx = canvas.getContext('2d', { alpha: false });
    RH.loadProfile();
    RH.audio.setMuted(true);
    RH.audio.muted = RH.profile.muted !== false ? true : true; // always start muted (iOS needs a tap)
    RH.render.resize(canvas);
    RH.ui.init(canvas);
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', () => setTimeout(resize, 200));
    document.addEventListener('visibilitychange', () => { if (document.hidden && G.m && !G.over && !RH.ui.screen()) RH.ui.showPause(); });
    RH.ui.showTitle();
    lastT = performance.now();
    requestAnimationFrame(frame);
    if ('serviceWorker' in navigator && location.protocol !== 'file:') {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  };

  // ---------- Hidden test hook ----------
  const T = (v) => (v + 0.5) * TILE;
  window.__sherwood = {
    G, RH,
    perf: () => {
      const n = Math.min(perf.wi, 600);
      const w = Array.from(perf.work.slice(0, n)).sort((a, b) => a - b);
      const iv = Array.from(perf.intervals.slice(0, n)).sort((a, b) => a - b);
      const q = (a, p) => a.length ? a[Math.min(a.length - 1, Math.floor(a.length * p))] : 0;
      return { n, workAvg: w.reduce((a, b) => a + b, 0) / (n || 1), workP50: q(w, 0.5), workP95: q(w, 0.95), workMax: w[n - 1] || 0, frameP50: q(iv, 0.5), frameP95: q(iv, 0.95) };
    },
    resetPerf: () => { perf.wi = 0; },
    begin: (i) => main.begin(i),
    step: (sec) => { const n = Math.round(sec * 30); for (let i = 0; i < n && !G.over; i++) RH.game.update(1 / 30); return !!G.over; },
    tileToScreen: (tx, ty) => { const o = RH.render.toScreen(T(tx), T(ty), { x: 0, y: 0 }); return o; },
    worldToScreen: (x, y) => RH.render.toScreen(x, y, { x: 0, y: 0 }),
    center: (tx, ty) => { G.cam.x = T(tx); G.cam.y = T(ty); },
    tp: (key, tx, ty) => { const h = G.heroes.find((x) => x.key === key); h.x = T(tx); h.y = T(ty); h.path = null; h.task = null; return h; },
    hero: (key) => G.heroes.find((x) => x.key === key),
    select: (...keys) => { G.sel = G.heroes.filter((h) => keys.includes(h.key)); RH.ui.refresh(true); },
    order: (key, type, guardIdx) => { const h = G.heroes.find((x) => x.key === key); const g = G.guards[guardIdx]; return RH.game.orderAction(type, { kind: RH.game.isBody(g) ? 'body' : 'guard', e: g }, [h]); },
    guards: () => G.guards.map((g, i) => ({ i, tx: Math.floor(g.x / TILE), ty: Math.floor(g.y / TILE), state: g.state, sus: +g.sus.toFixed(2), tied: g.tied, dir: +g.dir.toFixed(2) })),
    profile: () => RH.profile,
    save: () => localStorage.getItem(KEY),
    screen: () => RH.ui.screen(),
  };

  window.addEventListener('DOMContentLoaded', main.boot);
})(window.RH);
