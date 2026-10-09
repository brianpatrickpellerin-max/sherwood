// Boot, game loop, camera, save data, service worker, and a hidden test hook.
'use strict';
(function (RH) {
  const G = RH.G;
  const TILE = RH.TILE;
  const main = {};
  RH.main = main;
  const KEY = 'sherwood.save.v1';

  // ---------- Profile / save ----------
  // v2 added popularity, recruits, camp jobs and training. v3 (the long campaign) adds the hero roster,
  // new supplies (purses, nets, apples, ale, hives), roadside offers, blazons, the King's ransom and treasures.
  const KEY2 = 'sherwood.save.v2';
  const KEY3 = 'sherwood.save.v3';
  const NM = () => RH.MISSIONS.length;
  RH.RANSOM = 500;
  // which named heroes have joined after each story mission is won
  const JOINS = { 1: ['john'], 2: ['scarlet'], 3: ['marian'], 5: ['tuck'] };
  function freshProfile() {
    return {
      v: 3, gold: 30, arrows: 10, potions: 1, purses: 2, nets: 1, apples: 2, ale: 0, hives: 0,
      up: {}, unlocked: 1, stars: new Array(NM()).fill(0), best: {}, muted: true, started: false,
      pop: 0, given: 0, day: 1, recruits: [], nextRid: 1, train: {}, band: [], log: [],
      heroes: ['robin'], offers: [], blazons: 0, ransom: 0, ransomOpen: false, treasures: [],
      defenseOpen: false, defenseDone: false, ambushes: 0, seen: {},
    };
  }
  RH.profile = freshProfile();
  RH.migrate = function (o) {
    const p = Object.assign(freshProfile(), o || {});
    if (!o || !o.v || o.v < 2) {
      // v1 -> v2: grant popularity for what was already won
      const won = (p.stars || []).filter((x) => x > 0).length;
      p.pop = won * 8; p.day = 1 + won; p.v = 2;
      if (won >= 2) { p.recruits = (p.recruits || []).concat([RH.makeRecruit('r' + p.nextRid, p.nextRid)]); p.nextRid++; }
    }
    if (p.v < 3) {
      // v2 -> v3: the 5-mission campaign maps onto the first missions of the new 12
      p.legacyStars = (o && o.stars) || [];
      p.unlocked = Math.min(Math.max(1, p.unlocked | 0), 6);
      p.stars = new Array(NM()).fill(0);
      for (let i = 0; i < p.unlocked - 1; i++) p.stars[i] = Math.max(1, Math.min(3, p.legacyStars[i] | 0));
      p.heroes = ['robin'];
      for (let i = 0; i < p.unlocked - 1; i++) for (const k of JOINS[i] || []) if (!p.heroes.includes(k)) p.heroes.push(k);
      p.ransomOpen = p.unlocked > 5; p.defenseOpen = p.unlocked > 6;
      p.v = 3;
    }
    if (!Array.isArray(p.stars)) p.stars = [];
    while (p.stars.length < NM()) p.stars.push(0);
    for (const k of ['recruits', 'band', 'log', 'heroes', 'offers', 'treasures']) if (!Array.isArray(p[k])) p[k] = [];
    if (!p.heroes.includes('robin')) p.heroes.unshift('robin');
    if (!p.train || typeof p.train !== 'object') p.train = {};
    if (!p.up || typeof p.up !== 'object') p.up = {};
    for (const k of ['gold', 'arrows', 'potions', 'purses', 'nets', 'apples', 'ale', 'hives', 'blazons', 'ransom', 'pop', 'given', 'day']) p[k] = Math.max(0, +p[k] || 0);
    p.recruits.forEach((r, i) => {
      if (!RH.JOBS.some((j) => j.id === r.job)) r.job = 'rest';
      r.train = r.train | 0;
      if (!RH.CLASSES[r.cls]) r.cls = RH.CLASS_ORDER[i % 3];
    });
    return p;
  };
  RH.loadProfile = function () {
    try {
      const raw = localStorage.getItem(KEY3) || localStorage.getItem(KEY2) || localStorage.getItem(KEY);
      if (raw) RH.profile = RH.migrate(JSON.parse(raw));
    } catch (e) { RH.profile = freshProfile(); }
  };
  RH.saveProfile = function () {
    try { localStorage.setItem(KEY3, JSON.stringify(RH.profile)); } catch (e) { /* ignore */ }
  };
  RH.hasSave = () => !!RH.profile.started;
  RH.resetProfile = function () {
    const muted = RH.audio.muted;
    RH.profile = freshProfile(); RH.profile.muted = muted; RH.profile.started = true; RH.saveProfile();
  };
  RH.rosterUnlocked = () => RH.profile.heroes.slice();
  RH.buy = function (id) {
    const P = RH.profile, it = RH.SHOP.find((x) => x.id === id);
    if (!it || P.gold < it.cost) return false;
    if (it.need === 'blazonsOpen' && !(P.defenseOpen && !P.defenseDone)) return false;
    if (it.kind === 'up') { if (P.up[id]) return false; P.up[id] = true; }
    else if (id === 'arrows') P.arrows += 5;
    else if (id === 'potion') P.potions += 1;
    else if (id === 'net') P.nets += 1;
    else if (id === 'blazon') P.blazons += 1;
    P.gold -= it.cost; RH.audio.play('coin'); RH.saveProfile();
    return true;
  };
  RH.payRansom = function (amount) {
    const P = RH.profile;
    amount = Math.min(amount, P.gold, RH.RANSOM - P.ransom);
    if (!P.ransomOpen || amount <= 0) return 0;
    P.gold -= amount; P.ransom += amount; RH.audio.play('coin'); RH.saveProfile();
    return amount;
  };
  RH.ransomPaid = () => RH.profile.ransom >= RH.RANSOM;
  // Popularity: each step reached brings a volunteer to camp
  RH.popLevel = (pop) => RH.POP_STEPS.filter((s) => pop >= s).length;
  RH.nextPopStep = (pop) => RH.POP_STEPS.find((s) => s > pop) || null;
  function addRecruit(P) {
    const r = RH.makeRecruit('r' + P.nextRid, P.nextRid); P.nextRid++;
    P.recruits.push(r);
    return r;
  }
  RH.raisePop = function (amount) {
    const P = RH.profile;
    const before = RH.popLevel(P.pop);
    P.pop = Math.round((P.pop + amount) * 10) / 10;
    const out = [];
    for (let k = before; k < RH.popLevel(P.pop); k++) out.push(addRecruit(P));
    return out;
  };
  RH.giveAlms = function (amount) {
    const P = RH.profile;
    amount = Math.min(amount, P.gold);
    if (amount <= 0) return null;
    P.gold -= amount; P.given += amount;
    const joined = RH.raisePop(amount / 2);
    RH.saveProfile(); RH.audio.play('coin');
    return joined;
  };
  RH.setJob = function (rid, job) {
    const r = RH.profile.recruits.find((x) => x.id === rid);
    const j = RH.JOBS.find((x) => x.id === job);
    if (!r || !j || (j.need && !RH.profile.heroes.includes(j.need))) return false;
    r.job = job; RH.saveProfile(); return true;
  };
  // A day passes in camp after each mission: men at work bring in supplies
  RH.campDay = function (exclude) {
    const P = RH.profile, got = { arrows: 0, potions: 0, gold: 0, purses: 0, nets: 0, apples: 0, ale: 0, hives: 0, blazons: 0, trained: [] };
    let scouts = 0;
    for (const r of P.recruits) {
      if (exclude && exclude.includes(r.id)) continue;
      switch (r.job) {
        case 'arrows': got.arrows += 3; break;
        case 'potions': got.potions += 1; break;
        case 'purses': got.purses += 1; break;
        case 'nets': got.nets += 1; break;
        case 'apples': got.apples += 2; break;
        case 'ale': got.ale += 1; break;
        case 'hives': got.hives += 1; break;
        case 'hunt': got.gold += 12; break;
        case 'scout': scouts++; break;
        case 'train': if (r.train < 4) { r.train++; got.trained.push(r.name.split(' ')[0]); } break;
      }
    }
    if (P.defenseOpen && !P.defenseDone) got.blazons = Math.floor(scouts / 3);
    for (const k of ['arrows', 'potions', 'purses', 'nets', 'apples', 'ale', 'hives', 'blazons']) P[k] += got[k];
    P.gold += got.gold; P.day++;
    return got;
  };
  function keepSupplies(P) {
    P.arrows = Math.max(G.inv.arrows, 3);
    for (const k of ['potions', 'purses', 'nets', 'apples', 'ale', 'hives']) P[k] = Math.max(0, G.inv[k] | 0);
    if (P.up.pouch) { P.purses = Math.max(0, P.purses - 1); P.hives = Math.max(0, P.hives - 1); }
  }
  RH.commitWin = function (res) {
    const P = RH.profile, i = G.idx, kind = G.kind;
    if (G.committed) return G.committedReward;
    G.committed = true;
    let reward;
    const used = G.heroes.filter((h) => h.rid).map((h) => h.rid);
    for (const rec of G.newRecruits || []) if (!P.recruits.some((r) => r.id === rec.id)) { P.recruits.push(rec); P.nextRid = Math.max(P.nextRid, +rec.id.slice(1) + 1); }
    keepSupplies(P);
    for (const t of res.stats.treasures || []) if (!P.treasures.includes(t)) P.treasures.push(t);
    let popGain;
    if (kind === 'ambush') {
      reward = res.stats.gold - G.spent;
      const loot = G.m.loot || {};
      for (const k of Object.keys(loot)) P[k] = (P[k] || 0) + loot[k];
      P.offers = P.offers.filter((o) => !(o.kind === G.m.akind && o.seed === G.m.seed));
      P.ambushes++;
      popGain = 2 + (res.stats.kills === 0 ? 1 : 0);
      P.gold += reward;
    } else if (kind === 'defense') {
      reward = G.m.reward + res.stars * 10 + res.stats.gold - G.spent;
      P.defenseDone = true; P.blazons = 0; P.gold += reward;
      popGain = 8;
    } else {
      reward = G.m.reward + res.stats.gold - G.spent + res.stars * 15;
      P.gold += reward;
      const first = !(P.stars[i] > 0);
      P.stars[i] = Math.max(P.stars[i] || 0, res.stars);
      P.unlocked = Math.max(P.unlocked, Math.min(NM(), i + 2));
      const b = P.best[i];
      if (!b || res.stats.time < b) P.best[i] = Math.round(res.stats.time);
      for (const k of (G.joined || []).concat(JOINS[i] || [])) if (RH.HEROES[k] && !RH.HEROES[k].npc && !P.heroes.includes(k)) P.heroes.push(k);
      if (i >= 4) P.ransomOpen = true;
      if (i >= 5 && !P.defenseDone) P.defenseOpen = true;
      if (i < NM() - 1) P.offers = RH.makeOffers(P);
      popGain = (first ? 6 : 2) + (res.stats.kills === 0 ? 3 : 0) + (G.chest ? 3 : 0);
    }
    popGain += Math.floor((G.stats.alms || 0) / 10);
    const volunteers = RH.raisePop(popGain);
    const day = RH.campDay(used);
    G.campNews = { popGain, volunteers, day, joined: (G.newRecruits || []).slice() };
    P.started = true;
    G.committedReward = reward;
    RH.saveProfile();
    return reward;
  };

  // ---------- Camera (iso space: cam.x = X, cam.y = Y) ----------
  main.clampCam = function () {
    const c = G.cam; if (!c) return;
    const W = RH.render.W, H = RH.render.H;
    const gw = G.grid.w * TILE, gh = G.grid.h * TILE;
    c.z = RH.clamp(c.z, main.minZ(), 2.4);
    const hw = W / 2 / c.z, hh = H / 2 / c.z;
    const X0 = -gh, X1 = gw, Y0 = 0, Y1 = (gw + gh) / 2;
    const padTop = 90 / c.z, padBot = 110 / c.z, padX = 30 / c.z;
    if (X1 - X0 + padX * 2 < hw * 2) c.x = (X0 + X1) / 2; else c.x = RH.clamp(c.x, X0 + hw - padX, X1 - hw + padX);
    if (Y1 - Y0 + padTop + padBot < hh * 2) c.y = (Y0 + Y1) / 2; else c.y = RH.clamp(c.y, Y0 + hh - padTop - 60 / c.z, Y1 - hh + padBot);
  };
  main.minZ = () => {
    const span = (G.grid.w + G.grid.h) * TILE;
    return Math.max(0.32, Math.min(RH.render.W / span, RH.render.H / (span / 2)) * 0.98);
  };
  main.panBy = function (dx, dy) { if (!G.cam) return; G.cam.x -= dx / G.cam.z; G.cam.y -= dy / G.cam.z; main.clampCam(); };
  main.zoomAt = function (z, sx, sy) {
    if (!G.cam) return;
    const W = RH.render.W, H = RH.render.H, c = G.cam;
    const bx = (sx - W / 2) / c.z + c.x, by = (sy - H / 2) / c.z + c.y;
    c.z = RH.clamp(z, main.minZ(), 2.4);
    c.x = bx - (sx - W / 2) / c.z; c.y = by - (sy - H / 2) / c.z;
    main.clampCam();
  };
  main.centerOn = function (x, y) { G.cam.x = x - y; G.cam.y = (x + y) / 2 + 20 / G.cam.z; main.clampCam(); };
  function defaultZoom() {
    const W = RH.render.W, H = RH.render.H;
    return RH.clamp(Math.min(W, H) / (5.8 * 64), 0.78, 1.45);
  }

  // ---------- Flow ----------
  // spec: a story index, or { type: 'ambush', kind, seed } / { type: 'defense' } / { type: 'base' }
  main.missionFor = function (spec) {
    if (typeof spec === 'number') return RH.MISSIONS[spec];
    const rank = Math.min(3, Math.floor((RH.profile.unlocked - 1) / 3));
    if (spec.type === 'ambush') return RH.ambush.make(spec.kind, spec.seed, rank);
    if (spec.type === 'defense') return RH.defenseMission(rank);
    return RH.baseMission();
  };
  main.begin = function (spec, band, picks) {
    const P = RH.profile;
    if (band) P.band = band.slice();
    const m = main.missionFor(spec);
    const heroes = Object.keys(m.heroes).filter((k) => (P.heroes.includes(k) || (m.need || []).includes(k)) && (!picks || picks.includes(k) || (m.need || []).includes(k)));
    let pick;
    if (m.kind === 'base') pick = P.recruits.map((r) => r.id);
    else {
      const room = m.kind === 'defense' ? 8 : Math.max(0, Math.min(m.slots != null ? m.slots : 5, 5 - heroes.length));
      pick = (band || P.band || []).filter((id) => P.recruits.some((r) => r.id === id)).slice(0, room);
    }
    if (m.kind === 'base') {
      // each man waits at his work station
      for (const r of P.recruits) { const at = RH.JOBPOS[r.job] || RH.JOBPOS.rest; r.at = [at[0], at[1] + 1]; }
    }
    RH.game.start(typeof spec === 'number' ? spec : m, pick, heroes);
    G.spec = spec; G.picks = heroes.slice();
    if (m.kind === 'base') for (const r of P.recruits) delete r.at;
    RH.render.buildStatic();
    G.cam.z = defaultZoom();
    const hs = G.heroes.filter((h) => !h.rid).length ? G.heroes.filter((h) => !h.rid) : G.heroes;
    const cx = hs.reduce((a, h) => a + h.x, 0) / hs.length, cy = hs.reduce((a, h) => a + h.y, 0) / hs.length;
    main.centerOn(cx - TILE, cy - TILE);
    P.started = true; RH.saveProfile();
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
    begin: (i, band, picks) => main.begin(i, band, picks),
    step: (sec) => { const n = Math.round(sec * 30); for (let i = 0; i < n && !G.over; i++) RH.game.update(1 / 30); return !!G.over; },
    tileToScreen: (tx, ty) => { const o = RH.render.toScreen(T(tx), T(ty), { x: 0, y: 0 }); return o; },
    worldToScreen: (x, y) => RH.render.toScreen(x, y, { x: 0, y: 0 }),
    center: (tx, ty) => { G.cam.x = T(tx) - T(ty); G.cam.y = (T(tx) + T(ty)) / 2; },
    tp: (key, tx, ty) => { const h = typeof key === 'object' ? key : G.heroes.find((x) => x.key === key); h.x = T(tx); h.y = T(ty); h.path = null; h.task = null; return h; },
    hero: (key) => G.heroes.find((x) => x.key === key),
    select: (...keys) => { G.sel = G.heroes.filter((h) => keys.includes(h.key)); RH.ui.refresh(true); },
    order: (key, type, guardIdx) => { const h = G.heroes.find((x) => x.key === key); const g = G.guards[guardIdx]; return RH.game.orderAction(type, { kind: RH.game.isBody(g) ? 'body' : 'guard', e: g }, [h]); },
    guards: () => G.guards.map((g, i) => ({ i, tx: Math.floor(g.x / TILE), ty: Math.floor(g.y / TILE), state: g.state, sus: +g.sus.toFixed(2), tied: g.tied, dir: +g.dir.toFixed(2) })),
    profile: () => RH.profile,
    save: () => localStorage.getItem(KEY3),
    key3: KEY3,
    screen: () => RH.ui.screen(),
  };

  window.addEventListener('DOMContentLoaded', main.boot);
})(window.RH);
