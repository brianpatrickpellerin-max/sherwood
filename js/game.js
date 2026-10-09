// Core simulation: world setup, heroes, guard AI, abilities, objectives.
// v3: guard classes, beggars & scrolls, props (banner/bell/winch/lever/target/listen), allies & blazons,
// nobles who report you, nets/apples/ale/sling/whistle, traps, defence waves and the camp walk.
'use strict';
(function (RH) {
  const TILE = RH.TILE;
  const S = Math.PI / 2, N = -Math.PI / 2;
  const NRAYS = 22;
  const G = {};
  RH.G = G;
  const game = {};
  RH.game = game;
  let uid = 1;

  const tcx = (tx) => (tx + 0.5) * TILE;
  const tileOf = (v) => Math.floor(v / TILE);
  const sfx = (n) => RH.audio.play(n);
  const toast = (t, kind) => RH.ui && RH.ui.toast(t, kind);
  const d2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

  // Guard classes (after the original's soldier types)
  const GT = {
    soldier: { hp: 4, dmg: 1, weapon: 'spear' },
    archer: { hp: 3, dmg: 1, weapon: 'bow', ranged: true },
    officer: { hp: 6, dmg: 1, weapon: 'sword', tough: true, nogreed: true, callR: 12, purse: 15 },
    halberd: { hp: 5, dmg: 1, weapon: 'halberd', nogreed: true },
    knight: { hp: 8, dmg: 2, weapon: 'sword', tough: true, nogreed: true, arrowproof: true, purse: 25 },
    black: { hp: 5, dmg: 1, weapon: 'sword', leash: 5, nogreed: true },
    collector: { hp: 2, dmg: 0, weapon: null, purse: 0, nogreed: true, coward: true },
    boss: { hp: 12, dmg: 2, weapon: 'sword', tough: true, nogreed: true, arrowproof: true, leash: 4.5 },
  };
  game.GT = GT;
  // ability table: how each action-bar skill is aimed and what it spends
  const ABIL = {
    bow: { ic: '🏹', t: 'Bow', item: 'arrows', aim: 'guard', range: () => G.bowRange },
    sling: { ic: '🪨', t: 'Sling', item: 'stones', aim: 'guard', range: () => 6 * TILE },
    charm: { ic: '🌹', t: 'Charm', aim: 'guard', range: () => 5 * TILE },
    heal: { ic: '✚', t: 'Heal', aim: 'friend', range: () => 1.1 * TILE },
    purse: { ic: '💰', t: 'Purse', item: 'purses', aim: 'ground', range: () => 7 * TILE },
    hive: { ic: '🐝', t: 'Hive', item: 'hives', aim: 'ground', range: () => 6 * TILE },
    net: { ic: '🕸', t: 'Net', item: 'nets', aim: 'ground', range: () => 5 * TILE },
    apple: { ic: '🍎', t: 'Apple', item: 'apples', aim: 'ground', range: () => 7 * TILE },
    ale: { ic: '🍺', t: 'Ale', item: 'ale', aim: 'ground', range: () => 6 * TILE },
    whistle: { ic: '🎵', t: 'Whistle', aim: 'self' },
  };
  game.ABIL = ABIL;
  const has = (h, a) => !!(h && !h.down && h.def.abil && h.def.abil.includes(a));
  game.has = has;

  function mkUnit(kind, tx, ty) {
    return {
      id: uid++, kind, x: tcx(tx), y: tcx(ty), dir: S, path: null, pi: 0, moving: false, anim: 0,
      hp: 1, maxhp: 1, atkCd: 0, repathT: 0, flash: 0, bob: Math.random() * 6,
    };
  }
  const normObj = (o) => (typeof o === 'string' ? (o.includes(':') ? { k: o.split(':')[0], id: o.split(':')[1] } : { k: o }) : o);

  // ---------- Mission setup ----------
  // idx: story mission index, or a mission object (ambush / defence / camp walk)
  game.start = function (idx, band, picks) {
    const m = typeof idx === 'object' ? idx : RH.MISSIONS[idx];
    const P = RH.profile;
    for (const k of Object.keys(G)) delete G[k];
    const grid = RH.makeGrid(m.map);
    const night = !!m.night;
    Object.assign(G, {
      idx: typeof idx === 'object' ? -1 : idx, m, kind: m.kind || 'story', grid, night, weather: m.weather || null,
      time: 0, runId: Math.random(), exitReady: false, paused: false, speed: 1,
      heroes: [], guards: [], civs: [], projs: [], fx: [], coins: [], gold: [], allies: [],
      sel: [], mode: null, over: null, failPending: null, alarmT: 0, alarmed: false, reinforced: false,
      stats: { ko: 0, kills: 0, tied: 0, gold: 0, spotted: false, alarm: false, alms: 0, treasures: [] },
      inv: {
        arrows: P.arrows, potions: P.potions, purses: P.purses, nets: P.nets, apples: P.apples, ale: P.ale, hives: P.hives,
        stones: 5,
      },
      spent: 0, flags: {}, revealed: {},
      tipsShown: {}, tipQ: [], torches: (m.torches || []).map(([x, y]) => ({ x: tcx(x), y: tcx(y) })),
      exit: m.exit || { x: -50, y: -50, w: 1, h: 1 }, prisoners: [], prisoner: null, chest: null, cart: null, sheriff: null, log: null,
      bowRange: (P.up.yew ? 12 : 9) * TILE, sneakMul: P.up.boots ? 0.27 : 0.4,
      cdMarian: 0, cdTuck: 0, captive: null, climbs: [], newRecruits: [], joined: [], swipes: 0,
      beggars: [], scrolls: [], contacts: [], props: [], blazons: [], traps: [], treasure: null, contest: null, def: null,
      objs: (m.objectives || []).map(normObj),
    });
    if (P.up.pouch) { G.inv.purses++; G.inv.hives++; }
    // Heroes: those picked in the briefing (named), else every hero listed for the mission
    const keys = Object.keys(m.heroes || {}).filter((k) => !picks || picks.includes(k) || (m.need || []).includes(k));
    for (const key of keys) { const [tx, ty] = m.heroes[key]; G.heroes.push(mkHero(key, tx, ty)); }
    const taken = new Set(G.heroes.map((h) => tileOf(h.y) * grid.w + tileOf(h.x)));
    const recs = (band || []).map((id) => (P.recruits || []).find((r) => r.id === id)).filter(Boolean);
    const anchor = m.band || (G.heroes[0] ? [tileOf(G.heroes[0].x), tileOf(G.heroes[0].y)] : [1, 1]);
    for (const rec of recs) {
      const at = rec.at || anchor;
      const n = RH.nearestWalk(grid, at[0], at[1] + (rec.at ? 0 : 1), taken);
      if (n < 0) continue;
      taken.add(n);
      const h = mkHero('outlaw', n % grid.w, (n / grid.w) | 0, RH.recruitDef(rec));
      h.rid = rec.id; h.rec = rec;
      G.heroes.push(h);
    }
    // A captured outlaw who joins the band if freed (optional)
    if (m.captive && (P.recruits || []).length < 40) {
      const seed = (P.nextRid || 1);
      const rec = RH.makeRecruit('r' + seed, seed);
      G.captive = { key: 'outlaw', rec, def: RH.recruitDef(rec), x: tcx(m.captive[0]), y: tcx(m.captive[1]), tx: m.captive[0], ty: m.captive[1], freed: false, captive: true };
    }
    G.climbs = (m.climbs || []).map(([ax, ay, bx, by]) => ({ a: { x: tcx(ax), y: tcx(ay) }, b: { x: tcx(bx), y: tcx(by) }, wx: tcx((ax + bx) / 2), wy: tcx((ay + by) / 2), x: tcx((ax + bx) / 2), y: tcx((ay + by) / 2), rope: false }));
    // Prisoners (named heroes or friends hidden in town). m.prisoner kept for v2 maps.
    const plist = m.prisoners || (m.prisoner ? [m.prisoner] : []);
    for (const p of plist) G.prisoners.push({ key: p.id, x: tcx(p.x), y: tcx(p.y), tx: p.x, ty: p.y, freed: false, cage: p.cage || null, friend: !!p.friend, name: p.name, prisoner: true });
    G.prisoner = G.prisoners[0] || null;
    if (m.chest) G.chest = { x: tcx(m.chest.x), y: tcx(m.chest.y), carrier: null, onCart: false, taken: false, letter: !!m.chest.letter, value: m.chest.value || 0 };
    // Guards
    (m.guards || []).forEach((gd) => {
      let g;
      if (gd.escort) {
        g = mkGuard(Math.floor(m.convoy.path[0][0] + gd.escort[0]), Math.max(0, Math.floor(m.convoy.path[0][1] + gd.escort[1])), gd.type, m.rank);
        g.escort = gd.escort;
        g.route = [{ x: g.x, y: g.y, wait: 0, dir: S }];
        g.looks = [S, S - 0.8, S, S + 0.8];
      } else {
        g = mkGuard(gd.route[0][0], gd.route[0][1], gd.type, m.rank);
        g.route = gd.route.map((r) => ({ tx: r[0], ty: r[1], x: tcx(r[0]), y: tcx(r[1]), wait: r[2] || 0, dir: r[3] }));
        g.looks = gd.looks || null;
        if (g.looks) g.dir = g.looks[0];
        else if (g.route.length > 1) g.dir = Math.atan2(g.route[1].y - g.route[0].y, g.route[1].x - g.route[0].x);
        if (g.route[0].dir != null) g.dir = g.route[0].dir;
      }
      if (gd.tag) g.tag = gd.tag;
      if (gd.purse != null) g.purse = gd.purse;
      if (gd.name) g.name = gd.name;
      if (gd.hp) g.hp = g.maxhp = gd.hp;
      if (gd.check) g.check = { x: tcx(gd.check[0]), y: tcx(gd.check[1]), tag: gd.check[2] };
      if (gd.watch) { g.state = 'watch'; }
      if (gd.boss) { g.boss = true; G.boss = g; }
      g.home = { x: g.x, y: g.y };
      g.faceTo = g.dir;
      G.guards.push(g);
    });
    if (m.sheriff) {
      const s = mkGuard(m.sheriff.x, m.sheriff.y, 'soldier', m.rank);
      s.sheriff = true; s.hp = s.maxhp = 10; s.dmg = 2; s.chase = 2.1 * TILE; s.tough = true; s.nogreed = true; s.purse = 40;
      s.route = [{ tx: m.sheriff.x, ty: m.sheriff.y, x: s.x, y: s.y, wait: 0 }];
      s.looks = [S, S - 0.5, S + 0.5]; s.dir = S; s.faceTo = S; s.home = { x: s.x, y: s.y };
      G.sheriff = s; G.guards.push(s);
    }
    // Civilians, nobles (hostile informers) and beggars
    (m.civilians || []).forEach(([x, y], i) => {
      const c = mkUnit('civ', x, y);
      c.home = { x, y }; c.wait = 1 + i; c.speedV = 1.1 * TILE; c.look = i; c.state = 'ok';
      G.civs.push(c);
    });
    (m.nobles || []).forEach(([x, y], i) => {
      const c = mkUnit('civ', x, y);
      c.home = { x, y }; c.wait = 2 + i; c.speedV = 1.0 * TILE; c.look = i; c.noble = true; c.state = 'ok'; c.wander = 3; c.dir = i * 1.7;
      G.civs.push(c);
    });
    (m.beggars || []).forEach((b) => G.beggars.push({ id: b.id, x: tcx(b.x), y: tcx(b.y), price: b.price || 10, pays: (b.pays || []).slice(), paid: 0, hidden: !!b.hidden, say: b.say || [], beggar: true }));
    (m.scrolls || []).forEach((s) => G.scrolls.push({ id: s.id, x: tcx(s.x), y: tcx(s.y), text: s.text, gold: s.gold || 0, item: s.item || null, reveals: s.reveals || [], hidden: !!s.hidden, read: false, scroll: true }));
    (m.contacts || []).forEach((c) => G.contacts.push(Object.assign({}, c, { x: tcx(c.x), y: tcx(c.y), tx: c.x, ty: c.y, met: false, hidden: !!c.hidden, contact: true, dir: c.dir != null ? c.dir : S })));
    (m.props || []).forEach((p) => G.props.push(Object.assign({}, p, { x: tcx(p.x), y: tcx(p.y), used: false, prop: true, hits: 0 })));
    (m.blazons || []).forEach(([x, y, label]) => G.blazons.push({ x: tcx(x), y: tcx(y), label: label || 'Blazon', cap: false, t: 0 }));
    (m.traps || []).forEach((t) => G.traps.push({ kind: t.kind || 'pit', x: tcx(t.x), y: tcx(t.y), used: false }));
    if (m.treasure) G.treasure = { x: tcx(m.treasure.x), y: tcx(m.treasure.y), id: m.treasure.id, name: m.treasure.name, taken: (RH.profile.treasures || []).includes(m.treasure.id) };
    // gates closed until a lever is pulled
    for (const p of G.props) if (p.gate) for (const [x, y] of p.gate) grid.block[y * grid.w + x] = 1;
    for (const p of G.props) if (p.plank) for (const [x, y] of p.plank) grid.block[y * grid.w + x] = 1;
    if (m.contest) G.contest = { hits: 0, need: m.contest.need || 3, sprung: false };
    if (m.defense) {
      const D = m.defense;
      const cut = Math.min(D.waves.reduce((a, w) => a + w.n, 0) - 2, (P.blazons || 0) * 2);
      let left = cut;
      const waves = D.waves.map((w) => { const k = Math.min(left, w.n - 1); left -= k; return Object.assign({}, w, { n: w.n - k }); });
      G.def = { waves, wi: 0, t: 0, reached: 0, max: D.max || 4, fire: { x: tcx(D.fire[0]), y: tcx(D.fire[1]) }, cut };
    }
    // Convoy
    if (m.convoy) {
      const cv = m.convoy;
      G.cart = { x: cv.path[0][0] * TILE, y: cv.path[0][1] * TILE, dir: S, pi: 1, state: 'moving', waitT: 0, speed: cv.speed * TILE, chest: true, wheel: 0 };
      const c = mkUnit('civ', Math.floor(cv.path[0][0]) - 1, Math.max(0, Math.floor(cv.path[0][1])));
      c.carter = true; c.hp = c.maxhp = 2; c.state = 'ok';
      G.cart.carter = c; G.civs.push(c);
      G.chest = { x: G.cart.x, y: G.cart.y, carrier: null, onCart: true, taken: false, value: cv.value || 0 };
      G.log = { x: cv.path[cv.logStop][0] * TILE, y: cv.path[cv.logStop][1] * TILE + TILE * 1.2 };
    }
    (m.gold || []).forEach(([x, y, v]) => G.gold.push({ x: tcx(x), y: tcx(y), v, taken: false }));
    G.cam = { x: 0, y: 0, z: 1 };
    G.tipList = (m.tips || []).slice();
    G.sel = G.heroes.length ? [G.heroes[0]] : [];
    if (G.kind === 'base') for (const h of G.heroes) h.station = h.rec ? h.rec.job : null;
    return G;
  };

  function mkHero(key, tx, ty, def) {
    const d = def || RH.HEROES[key];
    const h = mkUnit('hero', tx, ty);
    h.key = key; h.def = d; h.name = d.name;
    const tr = (!def && RH.profile.train && RH.profile.train[key]) || 0;
    h.maxhp = d.hp + tr + (RH.profile.up.jerkin && !d.npc ? 2 : 0); h.hp = h.maxhp;
    h.strokeCd = 0; h.parryT = 0; h.cd = 0;
    h.spd = d.speed * TILE; h.sneak = false; h.task = null; h.busy = 0; h.carry = null; h.down = false;
    h.dmg = d.dmg; h.npc = !!d.npc; h.dir = N; h.bowT = 0; h.hurtT = 0;
    // in ambushes Robin fights with a quarterstaff, as in the original
    if (key === 'robin' && G.kind === 'ambush') h.staff = true;
    return h;
  }
  game.mkHero = mkHero;
  const RANK = ['#2c4f96', '#c49a1e', '#c8641e', '#a8261e'];
  function mkGuard(tx, ty, type, rank) {
    const g = mkUnit('guard', tx, ty);
    const t = GT[type] || GT.soldier;
    g.type = GT[type] ? type : 'soldier';
    g.state = 'patrol'; g.sus = 0; g.target = null; g.ri = 0; g.wait = 0; g.lookI = 0; g.lookT = 2 + Math.random() * 2;
    g.hp = g.maxhp = t.hp; g.dmg = t.dmg; g.walk = 1.35 * TILE; g.chase = 2.45 * TILE;
    g.fov = 1.45; g.cone = new Float32Array(NRAYS); g.coneR = 0;
    g.koT = 0; g.tied = false; g.carried = false; g.found = false; g.lostT = 0; g.searchT = 0;
    g.lx = g.x; g.ly = g.y; g.icon = ''; g.iconT = 0; g.stateT = 0;
    g.tough = !!t.tough; g.nogreed = !!t.nogreed; g.arrowproof = !!t.arrowproof; g.ranged = !!t.ranged; g.leash = t.leash ? t.leash * TILE : 0;
    g.purse = t.purse || 0; g.coward = !!t.coward;
    g.tabard = g.type === 'black' ? '#1e1e24' : RANK[RH.clamp(rank | 0, 0, 3)];
    if (g.type === 'knight') g.chase = 2.0 * TILE;
    return g;
  }
  game.mkGuard = mkGuard;
  game.NRAYS = NRAYS;

  // ---------- Helpers ----------
  const active = (g) => g.state !== 'ko' && g.state !== 'dead' && !g.carried && g.state !== 'gone';
  game.isActive = active;
  const isBody = (g) => (g.state === 'ko' || g.state === 'dead') && !g.carried;
  game.isBody = isBody;
  const passive = (g) => g.state === 'watch' || g.state === 'netted' || g.state === 'stunned' || g.state === 'drinking' || g.state === 'counting' || g.state === 'charmed';

  function setPath(u, tx, ty) {
    const g = G.grid;
    let sx = tileOf(u.x), sy = tileOf(u.y);
    if (!RH.isWalk(g, sx, sy)) { const n = RH.nearestWalk(g, sx, sy); if (n < 0) return false; sx = n % g.w; sy = (n / g.w) | 0; }
    if (!RH.isWalk(g, tx, ty)) { const n = RH.nearestWalk(g, tx, ty); if (n < 0) return false; tx = n % g.w; ty = (n / g.w) | 0; }
    const p = RH.astar(g, sx, sy, tx, ty);
    if (!p) return false;
    u.path = p; u.pi = 0;
    u.goalX = tcx(tx); u.goalY = tcx(ty);
    return true;
  }
  game.setPath = setPath;

  function follow(u, speed, dt, turnRate) {
    if (!u.path || u.pi >= u.path.length) { u.path = null; u.moving = false; return true; }
    const w = G.grid.w;
    const idx = u.path[u.pi];
    const tx = tcx(idx % w), ty = tcx((idx / w) | 0);
    const dx = tx - u.x, dy = ty - u.y, d = Math.hypot(dx, dy);
    const step = speed * dt;
    const a = Math.atan2(dy, dx);
    if (d > 0.5) u.dir = turnRate ? RH.turnToward(u.dir, a, turnRate * dt) : a;
    u.moving = true;
    u.anim += dt * speed / TILE * 6;
    if (d <= step) {
      u.x = tx; u.y = ty; u.pi++;
      if (u.pi >= u.path.length) { u.path = null; u.moving = false; return true; }
    } else { u.x += dx / d * step; u.y += dy / d * step; }
    return false;
  }

  function heroSpeed(h) {
    let s = h.spd;
    if (h.sneak) s *= 0.55;
    if (h.carry && !(h.carry === 'chest' && G.chest && G.chest.letter)) s *= (h.def.big || h.def.strong ? 0.85 : 0.55);
    return s;
  }

  function fx(type, x, y, text, color, life) {
    G.fx.push({ type, x, y, text: text || '', color: color || '#fff', t: 0, life: life || 1 });
  }
  game.fx = fx;

  function litAt(x, y) {
    for (const t of G.torches) { const dx = t.x - x, dy = t.y - y; if (dx * dx + dy * dy < (3.2 * TILE) ** 2) return true; }
    return false;
  }
  game.litAt = litAt;

  function guardRange(g) {
    let r = G.night ? 4.6 * TILE : 6.5 * TILE;
    if (G.weather === 'fog') r *= 0.72;
    if (g.state === 'alert') r *= 1.25;
    if (g.type === 'archer') r *= 1.1;
    return r;
  }
  game.guardRange = guardRange;
  const visible = (e) => !e.hidden || G.revealed[e.id];
  game.visible = visible;

  // ---------- Orders ----------
  game.heroAt = function (wx, wy, r) {
    let best = null, bd = r * r;
    for (const h of G.heroes) {
      const dx = h.x - wx, dy = h.y - 10 - wy, d = dx * dx + dy * dy;
      if (d < bd) { bd = d; best = h; }
    }
    return best;
  };
  game.entityAt = function (wx, wy, r) {
    let best = null, bd = r * r;
    const test = (e, x, y, kind) => { const dx = x - wx, dy = y - wy, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = { kind, e }; } };
    for (const g of G.guards) { if (g.carried || g.state === 'gone') continue; test(g, g.x, g.y - (isBody(g) ? 0 : 10), isBody(g) ? 'body' : 'guard'); }
    for (const p of G.prisoners) if (!p.freed) test(p, p.x, p.y - 8, 'prisoner');
    if (G.chest && !G.chest.carrier && !G.chest.onCart && !G.chest.done) test(G.chest, G.chest.x, G.chest.y, 'chest');
    if (G.cart && G.cart.chest) test(G.cart, G.cart.x, G.cart.y, 'cart');
    for (const c of G.civs) {
      if (c.carter) { if (c.state === 'ok') test(c, c.x, c.y - 10, 'carter'); }
      else if (c.noble && c.state !== 'ko') test(c, c.x, c.y - 10, 'noble');
    }
    if (G.captive && !G.captive.freed) test(G.captive, G.captive.x, G.captive.y - 8, 'captive');
    for (const c of G.climbs) test(c, c.wx, c.wy - 14, 'climb');
    for (const b of G.beggars) if (visible(b)) test(b, b.x, b.y - 8, 'beggar');
    for (const s of G.scrolls) if (visible(s) && !s.read) test(s, s.x, s.y - 4, 'scroll');
    for (const c of G.contacts) if (visible(c) && !c.met) test(c, c.x, c.y - 10, 'contact');
    for (const p of G.props) if (!p.used || p.kind === 'target') test(p, p.x, p.y - (p.kind === 'target' ? 16 : 10), 'prop');
    return best;
  };

  game.defaultAction = function (hit, h) {
    if (!hit) return null;
    const e = hit.e;
    switch (hit.kind) {
      case 'guard': return e.state === 'alert' ? 'attack' : 'ko';
      case 'body': return (e.purse > 0 && !e.searched) ? 'search' : (e.state === 'ko' && !e.tied) ? 'tie' : 'carry';
      case 'prisoner': case 'captive': return 'free';
      case 'climb': return 'climb';
      case 'chest': case 'cart': return 'loot';
      case 'carter': case 'noble': return 'ko';
      case 'beggar': return 'pay';
      case 'scroll': return 'read';
      case 'contact': return 'talk';
      case 'prop': return e.kind === 'target' ? 'shoot' : 'use';
    }
    return null;
  };

  const PROP_LABEL = { banner: '🚩 Raise the banner', bell: '🔔 Ring the bell', winch: '⚙️ Work the winch', lever: '⚙️ Open the gate', listen: '👂 Listen here', target: '🎯 Shoot the target' };
  game.PROP_LABEL = PROP_LABEL;
  game.contextActions = function (hit, h) {
    const out = [];
    if (!hit || !h || h.down) return out;
    const e = hit.e;
    if (hit.kind === 'guard') {
      if (e.state !== 'alert' && !h.npc) out.push({ id: 'ko', label: '👊 Knock out' });
      if (!h.npc) out.push({ id: 'attack', label: '⚔️ Attack' });
      if (G.heroes.some((x) => has(x, 'bow'))) out.push({ id: 'shoot', label: `🏹 Shoot (${G.inv.arrows})` });
      if (G.heroes.some((x) => has(x, 'sling'))) out.push({ id: 'sling', label: `🪨 Sling (${G.inv.stones})` });
      if (G.heroes.some((x) => has(x, 'charm')) && e.state !== 'alert') out.push({ id: 'charm', label: '🌹 Charm' });
    } else if (hit.kind === 'body') {
      if (e.purse > 0 && !e.searched) out.push({ id: 'search', label: '🔍 Search for gold' });
      if (e.state === 'ko' && !e.tied) out.push({ id: 'tie', label: '🪢 Tie up' });
      if (!h.carry) out.push({ id: 'carry', label: '🧺 Pick up & carry' });
    } else if (hit.kind === 'prisoner') out.push({ id: 'free', label: e.friend ? '🤝 Call him over' : '🔓 Cut loose' });
    else if (hit.kind === 'chest' || hit.kind === 'cart') out.push({ id: 'loot', label: G.chest && G.chest.letter ? '📜 Take the letter' : '💰 Take the chest' });
    else if (hit.kind === 'carter' || hit.kind === 'noble') out.push({ id: 'ko', label: '👊 Knock out' });
    else if (hit.kind === 'captive') out.push({ id: 'free', label: '🔓 Cut loose (he\u2019ll join you)' });
    else if (hit.kind === 'climb') out.push({ id: 'climb', label: e.rope || canLead(h) ? '🧗 Climb over' : '🧗 Climb (Robin first)' });
    else if (hit.kind === 'beggar') out.push({ id: 'pay', label: `🪙 Give £${e.price}` });
    else if (hit.kind === 'scroll') out.push({ id: 'read', label: '📜 Read the parchment' });
    else if (hit.kind === 'contact') out.push({ id: 'talk', label: '💬 Talk' });
    else if (hit.kind === 'prop') out.push({ id: e.kind === 'target' ? 'shoot' : 'use', label: e.label || PROP_LABEL[e.kind] || 'Use' });
    return out;
  };

  const canLead = (h) => h.key === 'robin' || (!G.heroes.some((x) => x.key === 'robin' && !x.down) && !h.def.big && !h.npc);
  function canDo(h, type) {
    if (h.down || h.climbing) return false;
    if (h.npc) return type === 'move' || type === 'loot' || type === 'carry';
    return true;
  }

  game.orderAction = function (type, hit, heroes) {
    heroes = (heroes || G.sel).filter((h) => canDo(h, type));
    if (!heroes.length || !hit) return false;
    let best = null, bd = 1e12;
    for (const h of heroes) {
      if (type === 'shoot' && !has(h, 'bow')) continue;
      if (type === 'sling' && !has(h, 'sling')) continue;
      if (type === 'charm' && !has(h, 'charm')) continue;
      if (type === 'heal' && !has(h, 'heal')) continue;
      if (type === 'climb' && !hit.e.rope && !canLead(h)) continue;
      if ((type === 'carry' || type === 'loot') && h.carry) continue;
      const d = (h.x - hit.e.x) ** 2 + (h.y - hit.e.y) ** 2;
      const pref = (type === 'carry' && (h.def.big || h.def.strong)) ? 0.3 : (type === 'shoot' && h.key === 'robin') ? 0.5 : 1;
      if (d * pref < bd) { bd = d * pref; best = h; }
    }
    if (!best) {
      if (type === 'climb') toast('Only Robin can climb here. Once he is up, he lets down a rope.');
      else if (type === 'shoot') toast('Nobody here carries a bow');
      return false;
    }
    if (type === 'climb' && hit.e.rope) {
      for (const h of heroes) { h.task = { type: 'climb', target: hit.e, kind: 'climb', t: 0 }; h.path = null; h.repathT = 0; }
      sfx('move'); return true;
    }
    best.task = { type, target: hit.e, kind: hit.kind, t: 0 };
    best.path = null; best.repathT = 0;
    if (type === 'attack') {
      for (const h of heroes) if (h !== best && !h.npc && !h.carry) { h.task = { type: 'attack', target: hit.e, kind: hit.kind, t: 0 }; h.path = null; h.repathT = 0; }
    }
    sfx('move');
    return true;
  };

  game.moveSel = function (wx, wy) {
    const heroes = G.sel.filter((h) => !h.down && !h.climbing);
    if (!heroes.length) return false;
    const g = G.grid;
    const tx = tileOf(wx), ty = tileOf(wy);
    const taken = new Set();
    heroes.sort((a, b) => ((a.x - wx) ** 2 + (a.y - wy) ** 2) - ((b.x - wx) ** 2 + (b.y - wy) ** 2));
    let ok = false;
    for (const h of heroes) {
      const n = RH.nearestWalk(g, tx, ty, taken);
      if (n < 0) continue;
      taken.add(n);
      h.task = null; h.busy = 0;
      if (setPath(h, n % g.w, (n / g.w) | 0)) { ok = true; h.task = { type: 'move' }; }
    }
    if (ok) { fx('marker', tcx(tx), tcx(ty), '', '#ffe066', 0.8); sfx('move'); }
    return ok;
  };

  // A thrown item (purse, hive, net, apple, ale) aimed at a spot on the ground
  game.groundAbility = function (type, wx, wy) {
    const a = ABIL[type]; if (!a) return false;
    const h = G.sel.find((x) => has(x, type)) || G.heroes.find((x) => has(x, type));
    if (!h) return false;
    if (a.item && G.inv[a.item] <= 0) { toast('None left: make more in camp'); return false; }
    h.task = { type: 'throw', item: type, x: wx, y: wy, t: 0 };
    h.path = null; h.repathT = 0;
    return true;
  };
  game.whistle = function (h) {
    h = h || G.sel.find((x) => has(x, 'whistle')) || G.heroes.find((x) => has(x, 'whistle'));
    if (!h || h.cd > 0) return false;
    h.cd = 6; sfx('whistle'); fx('text', h.x, h.y - 40, '♪ ♫', '#fff6c0', 1.2); fx('ring', h.x, h.y, '', '#fff', 0.8);
    let n = 0;
    for (const g of G.guards) {
      if (!active(g) || g.state === 'alert' || passive(g) || g.boss || g.sheriff) continue;
      if (d2(g, h) < (7 * TILE) ** 2) { g.state = 'investigate'; g.lx = h.x; g.ly = h.y; g.path = null; g.sus = Math.max(g.sus, 0.45); g.icon = '?'; g.iconT = 3; n++; }
    }
    return n;
  };

  game.toggleSneak = function () {
    const hs = G.sel.filter((h) => !h.down);
    const on = !hs.every((h) => h.sneak);
    hs.forEach((h) => (h.sneak = on));
    sfx('tap');
    return on;
  };
  game.drop = function (h) {
    h = h || G.sel[0];
    if (!h || !h.carry) return;
    dropCarry(h);
  };
  function dropCarry(h) {
    const c = h.carry;
    if (!c) return;
    h.carry = null;
    if (c === 'chest') { G.chest.carrier = null; G.chest.x = h.x; G.chest.y = h.y + 4; }
    else { c.carried = false; c.x = h.x + 6; c.y = h.y + 2; c.found = false; c.carrier = null; }
    sfx('ko');
  }
  game.usePotion = function () {
    const h = G.sel[0];
    if (!h || h.down || G.inv.potions <= 0 || h.hp >= h.maxhp) return false;
    G.inv.potions--; h.hp = Math.min(h.maxhp, h.hp + 5);
    fx('text', h.x, h.y - 30, '+5', '#7dff7a'); sfx('heal');
    return true;
  };
  // money you can spend in a mission: camp purse + what you've found - what you've given
  game.money = () => RH.profile.gold + G.stats.gold - G.spent;

  // ---------- Hero update ----------
  function inRange(h, x, y, r) { return (h.x - x) ** 2 + (h.y - y) ** 2 <= r * r; }

  function approach(h, x, y, dt) {
    h.repathT -= dt;
    if (!h.path || h.repathT <= 0) {
      h.repathT = 0.5;
      if (!setPath(h, tileOf(x), tileOf(y))) { h.task = null; return; }
    }
    follow(h, heroSpeed(h), dt);
    if (!h.path) {
      const dx = x - h.x, dy = y - h.y, d = Math.hypot(dx, dy);
      if (d > 2) { const s = Math.min(d, heroSpeed(h) * dt); const nx = h.x + dx / d * s, ny = h.y + dy / d * s; if (RH.isWalk(G.grid, tileOf(nx), tileOf(ny))) { h.x = nx; h.y = ny; } h.dir = Math.atan2(dy, dx); h.moving = true; }
    }
  }
  const lethalOf = (h) => h.def.weapon === 'sword' && !h.staff;

  function updHero(h, dt) {
    h.atkCd -= dt; h.bowT -= dt; h.hurtT -= dt; if (h.flash > 0) h.flash -= dt;
    if (h.strokeCd > 0) h.strokeCd -= dt; if (h.parryT > 0) h.parryT -= dt; if (h.cd > 0) h.cd -= dt;
    if (h.down) { h.moving = false; return; }
    if (h.carry && h.carry !== 'chest') { h.carry.x = h.x; h.carry.y = h.y; }
    if (h.carry === 'chest') { G.chest.x = h.x; G.chest.y = h.y; }
    for (const c of G.gold) if (!c.taken && inRange(h, c.x, c.y, TILE * 0.7)) {
      c.taken = true; G.stats.gold += c.v; fx('text', c.x, c.y - 20, '+' + c.v, '#ffd84a'); sfx('coin');
    }
    const tr = G.treasure;
    if (tr && !tr.taken && inRange(h, tr.x, tr.y, TILE * 0.8)) {
      tr.taken = true; G.stats.treasures.push(tr.id); fx('text', tr.x, tr.y - 30, tr.name + '!', '#ffe680', 2); sfx('win');
      toast('Royal treasure found: ' + tr.name, 'good');
    }
    if (h.busy > 0) { h.busy -= dt; h.moving = false; if (h.busy <= 0) finishBusy(h); return; }
    const t = h.task;
    if (!t) {
      h.moving = false;
      if (!h.npc) for (const g of G.guards) if (g.state === 'alert' && active(g) && inRange(h, g.x, g.y, TILE * 1.1)) { h.task = { type: 'attack', target: g, kind: 'guard', t: 0 }; break; }
      return;
    }
    if (t.type === 'move') { if (follow(h, heroSpeed(h), dt)) h.task = null; return; }
    const e = t.target;
    switch (t.type) {
      case 'ko': {
        if (!e || (e.kind === 'guard' && !active(e)) || (e.kind === 'civ' && e.state === 'ko')) { h.task = null; return; }
        if (!inRange(h, e.x, e.y, TILE * 0.95)) { approach(h, e.x, e.y, dt); return; }
        h.path = null; h.moving = false; h.dir = Math.atan2(e.y - h.y, e.x - h.x);
        if (e.kind === 'civ') { e.state = 'ko'; e.koT = 999; e.path = null; G.stats.ko++; fx('stars', e.x, e.y - 24); sfx('ko'); h.task = null; h.punchT = 0.35; return; }
        if (e.state === 'alert' && e.type !== 'collector') { t.type = 'attack'; return; }
        h.punchT = 0.35; h.busy = 0.35; h.task = null;
        punch(h, e);
        return;
      }
      case 'attack': {
        if (!e || !active(e)) { h.task = null; return; }
        if (!inRange(h, e.x, e.y, TILE * 0.95)) { approach(h, e.x, e.y, dt); return; }
        h.path = null; h.moving = false; h.dir = Math.atan2(e.y - h.y, e.x - h.x);
        if (h.queued) { const q = h.queued; h.queued = null; doStroke(h, e, q); return; }
        if (!G.swipeTipped && e.state === 'alert' && !(RH.profile.seen && RH.profile.seen.swipe) && RH.ui && !RH.ui.tipShowing()) {
          G.swipeTipped = true; RH.profile.seen = Object.assign(RH.profile.seen || {}, { swipe: 1 }); RH.saveProfile();
          RH.ui.tip('Sword fight! Swipe across the guard to strike: sideways to slash, down for a heavy blow, up to thrust, back-and-forth to parry.');
        }
        if (h.atkCd <= 0) {
          h.atkCd = 1.0; h.swingT = 0.25; h.stroke = 'auto';
          if (e.state !== 'alert' && !passive(e)) spot(e, h, true);
          e.hp -= h.dmg; e.flash = 0.15; sfx('clang');
          fx('spark', (e.x + h.x) / 2, (e.y + h.y) / 2 - 12);
          if (e.hp <= 0) defeat(e, lethalOf(h));
        }
        return;
      }
      case 'tie': {
        if (!e || e.state !== 'ko' || e.tied || e.carried) { h.task = null; return; }
        if (!inRange(h, e.x, e.y, TILE * 0.9)) { approach(h, e.x, e.y, dt); return; }
        h.path = null; h.busy = 1.0; h.busyType = 'tie'; h.busyTarget = e; h.task = null; sfx('tie');
        return;
      }
      case 'search': {
        if (!e || !isBody(e) || e.searched) { h.task = null; return; }
        if (!inRange(h, e.x, e.y, TILE * 0.9)) { approach(h, e.x, e.y, dt); return; }
        h.path = null; h.busy = 0.7; h.busyType = 'search'; h.busyTarget = e; h.task = null; sfx('tap');
        return;
      }
      case 'carry': {
        if (!e || !isBody(e) || h.carry) { h.task = null; return; }
        if (!inRange(h, e.x, e.y, TILE * 0.9)) { approach(h, e.x, e.y, dt); return; }
        h.path = null; e.carried = true; e.carrier = h; h.carry = e; h.task = null; h.busy = 0.3; sfx('ko');
        return;
      }
      case 'free': {
        const p = e;
        if (!p || p.freed) { h.task = null; return; }
        if (p.cage) { const w = G.props.find((q) => q.id === p.cage); if (w && !w.used) { toast('The cage hangs too high: lower it with the winch first.'); h.task = null; return; } }
        if (!inRange(h, p.x, p.y, TILE * 1.25)) { approach(h, p.x, p.y, dt); return; }
        h.path = null; h.busy = p.friend ? 0.4 : 1.4; h.busyType = 'free'; h.busyTarget = p; h.task = null; sfx('tie');
        return;
      }
      case 'climb': {
        if (!e) { h.task = null; return; }
        if (!e.rope && !canLead(h)) { toast('Robin must climb up first and let down a rope'); h.task = null; return; }
        if (!t.from) {
          const da = d2(h, e.a), db = d2(h, e.b);
          t.from = da <= db ? e.a : e.b; t.to = da <= db ? e.b : e.a;
        }
        if (!t.t && !inRange(h, t.from.x, t.from.y, TILE * 0.35)) { approach(h, t.from.x, t.from.y, dt); return; }
        h.path = null; h.moving = false;
        if (t.t === 0) { sfx('tie'); if (h.carry && h.carry !== 'chest') dropCarry(h); h.climbing = true; h.x = t.from.x; h.y = t.from.y; }
        const dur = h.key === 'robin' ? 1.4 : 2.0;
        t.t += dt;
        const k = Math.min(1, t.t / dur);
        h.x = RH.lerp(t.from.x, t.to.x, k); h.y = RH.lerp(t.from.y, t.to.y, k);
        h.climbZ = Math.sin(k * Math.PI) * 26; h.climbT = k; h.dir = Math.atan2(t.to.y - t.from.y, t.to.x - t.from.x);
        if (k >= 1) {
          h.climbZ = 0; h.climbT = 0; h.task = null; h.climbing = false;
          if (!e.rope) { e.rope = true; fx('text', h.x, h.y - 34, 'Rope down!', '#ffe08a', 1.4); toast(h.name + ' ties off a rope: the others can climb now', 'good'); }
          G.stats.climbs = (G.stats.climbs || 0) + 1;
        }
        return;
      }
      case 'loot': {
        const c = G.chest;
        if (!c || c.carrier || h.carry || c.done) { h.task = null; return; }
        const tx = c.onCart ? G.cart.x : c.x, ty = c.onCart ? G.cart.y : c.y;
        if (!inRange(h, tx, ty, TILE * (c.onCart ? 1.5 : 0.9))) { approach(h, tx, ty, dt); return; }
        if (c.onCart && G.cart.state === 'moving') { if (!t.warned) { toast('The cart is still moving! Knock out the carter first.'); t.warned = true; } approach(h, tx, ty, dt); return; }
        h.path = null; h.busy = c.onCart ? 1.5 : 0.8; h.busyType = 'loot'; h.task = null; sfx('coin');
        return;
      }
      case 'heal': {
        if (!e || !has(h, 'heal')) { h.task = null; return; }
        const tuck = h.key === 'tuck';
        if (tuck && G.cdTuck > 0 && e !== h) { toast('Tuck needs a moment to catch his breath'); h.task = null; return; }
        if (!tuck && G.inv.potions <= 0) { toast('No draughts left: set a man to brew them in camp'); h.task = null; return; }
        if (!inRange(h, e.x, e.y, TILE * 1.1)) { approach(h, e.x, e.y, dt); return; }
        h.path = null; h.busy = 1.2; h.busyType = 'heal'; h.busyTarget = e; h.task = null;
        return;
      }
      case 'shoot': case 'sling': {
        const prop = t.kind === 'prop';
        if (!e || (!prop && !active(e))) { h.task = null; return; }
        const sling = t.type === 'sling';
        const item = sling ? 'stones' : 'arrows';
        if (G.inv[item] <= 0) { toast(sling ? 'Out of sling stones' : 'Out of arrows! Fletch more in camp.'); h.task = null; return; }
        const R = sling ? 6 * TILE : G.bowRange;
        if (!inRange(h, e.x, e.y, R) || !RH.los(G.grid, h.x, h.y - 10, e.x, e.y - 10)) { approach(h, e.x, e.y, dt); return; }
        h.path = null; h.moving = false; h.dir = Math.atan2(e.y - h.y, e.x - h.x);
        if (!t.draw) { t.draw = sling ? 0.3 : 0.45; h.drawT = t.draw; return; }
        t.draw -= dt; h.drawT = t.draw;
        if (t.draw <= 0) {
          G.inv[item]--; h.drawT = 0;
          let miss = false;
          if (prop && G.contest && e.kind === 'target' && e.contest) miss = Math.abs(game.sway()) > 0.5;
          G.projs.push({ kind: sling ? 'stone' : 'arrow', x: h.x, y: h.y - 14, target: e, from: h, t: 0, sx: h.x, sy: h.y - 14, prop, miss });
          sfx(sling ? 'sling' : 'bow'); h.task = null;
        }
        return;
      }
      case 'charm': {
        if (!e || !active(e) || e.state === 'alert') { h.task = null; return; }
        if (G.cdMarian > 0) { toast('Marian needs a little while before charming again'); h.task = null; return; }
        if (!inRange(h, e.x, e.y, 5 * TILE) || !RH.los(G.grid, h.x, h.y, e.x, e.y)) { approach(h, e.x, e.y, dt); return; }
        h.path = null; h.moving = false;
        e.state = 'charmed'; e.charmBy = h; e.stateT = 11; e.path = null; e.sus = 0; e.icon = '♥'; e.iconT = 11;
        G.cdMarian = 15; sfx('charm'); fx('text', e.x, e.y - 34, '♥', '#ff7aa8');
        h.task = null;
        return;
      }
      case 'throw': {
        const a = ABIL[t.item];
        if (!inRange(h, t.x, t.y, a.range()) || !RH.los(G.grid, h.x, h.y, t.x, t.y)) { approach(h, t.x, t.y, dt); return; }
        h.path = null; h.moving = false; h.dir = Math.atan2(t.y - h.y, t.x - h.x);
        if (a.item) { if (G.inv[a.item] <= 0) { h.task = null; return; } G.inv[a.item]--; }
        G.projs.push({ kind: t.item, sx: h.x, sy: h.y - 14, x: h.x, y: h.y, tx: t.x, ty: t.y, t: 0, dur: 0.6 });
        sfx('throw'); h.task = null; h.busy = 0.3;
        return;
      }
      case 'pay': {
        if (!e) { h.task = null; return; }
        if (!inRange(h, e.x, e.y, TILE * 1.2)) { approach(h, e.x, e.y, dt); return; }
        h.path = null; h.task = null; h.dir = Math.atan2(e.y - h.y, e.x - h.x);
        payBeggar(e);
        return;
      }
      case 'read': {
        if (!e || e.read) { h.task = null; return; }
        if (!inRange(h, e.x, e.y, TILE * 0.9)) { approach(h, e.x, e.y, dt); return; }
        h.path = null; h.busy = 0.5; h.busyType = 'read'; h.busyTarget = e; h.task = null; sfx('tap');
        return;
      }
      case 'talk': {
        if (!e || e.met) { h.task = null; return; }
        if (!inRange(h, e.x, e.y, TILE * 1.3)) { approach(h, e.x, e.y, dt); return; }
        h.path = null; h.task = null; h.dir = Math.atan2(e.y - h.y, e.x - h.x);
        talk(h, e);
        return;
      }
      case 'use': {
        if (!e) { h.task = null; return; }
        if (e.used && e.kind !== 'station') { h.task = null; return; }
        if (e.kind === 'station' && !h.rid) { toast('Only merry men take camp jobs'); h.task = null; return; }
        if (!inRange(h, e.x, e.y, TILE * 1.2)) { approach(h, e.x, e.y, dt); return; }
        h.path = null; h.moving = false; h.task = null;
        if (e.kind === 'listen') { h.listen = e; return; }
        h.busy = e.kind === 'winch' ? 2.2 : e.kind === 'station' ? 0.3 : 1.0; h.busyType = 'use'; h.busyTarget = e; sfx('tie');
        return;
      }
    }
  }

  // a knockout punch on an unaware guard; officers and knights need two unless John or a strongman hits
  function punch(h, g) {
    const strong = h.def.big || h.def.strong;
    if (g.type === 'collector' || g.state === 'netted' || g.state === 'drinking' || g.dazedT > 0 || !g.tough || strong) {
      knockOut(g, strong ? 55 : 35);
      if (g.state === 'ko') g.dazedT = 0;
      return;
    }
    g.dazedT = 2.5; g.state = 'stunned'; g.stateT = 1.4; g.path = null; g.flash = 0.2;
    fx('text', g.x, g.y - 40, 'Dazed! Again!', '#ffe08a', 1); sfx('clang');
  }

  function payBeggar(b) {
    if (game.money() < b.price) { toast(`You need £${b.price} for him`); return; }
    G.spent += b.price; G.stats.alms += b.price; b.paid++; sfx('coin');
    fx('text', b.x, b.y - 30, '-£' + b.price, '#ffd84a');
    const line = b.say[Math.min(b.paid - 1, b.say.length - 1)] || 'Bless you, master. Look about you: we beggars see more than the guards think.';
    RH.ui && RH.ui.tip('🪙 ' + line);
    for (const id of b.pays) { G.revealed[id] = true; const s = G.scrolls.find((x) => x.id === id) || G.contacts.find((x) => x.id === id) || G.beggars.find((x) => x.id === id); if (s) fx('ring', s.x, s.y, '', '#ffe680', 1.4); }
    b.pays = [];
    b.price = Math.max(5, Math.round(b.price / 2));
  }
  function readScroll(s) {
    s.read = true;
    if (s.gold) { G.stats.gold += s.gold; fx('text', s.x, s.y - 20, '+' + s.gold, '#ffd84a'); }
    if (s.item) { G.inv[s.item[0]] = (G.inv[s.item[0]] || 0) + s.item[1]; fx('text', s.x, s.y - 34, '+' + s.item[1] + ' ' + s.item[0], '#cfe8a0'); }
    for (const id of s.reveals) G.revealed[id] = true;
    RH.ui && RH.ui.tip('📜 ' + s.text);
  }
  function talk(h, c) {
    if (c.needs === 'letter' && !(G.chest && G.chest.carrier && inRange(G.chest.carrier, c.x, c.y, TILE * 2))) { toast(c.wait || 'He wants the letter. Bring it to him.'); return; }
    if (c.needs === 'robin' && h.key !== 'robin') { toast(c.wait || 'He will only speak to Robin himself.'); return; }
    c.met = true; sfx('charm');
    if (c.needs === 'letter') { const car = G.chest.carrier; car.carry = null; G.chest.carrier = null; G.chest.done = true; G.chest.x = -999; }
    if (c.say) RH.ui && RH.ui.tip('💬 ' + c.say);
    for (const id of (c.reveals || [])) G.revealed[id] = true;
    if (c.joins) joinHero(c.joins, c);
    fx('text', c.x, c.y - 40, '✓', '#9dff8a', 1.2);
  }
  function joinHero(key, at) {
    if (G.heroes.some((h) => h.key === key)) return;
    const h = mkHero(key, at.tx || tileOf(at.x), at.ty || tileOf(at.y));
    h.x = at.x; h.y = at.y + 4;
    G.heroes.push(h); G.joined.push(key);
    fx('text', at.x, at.y - 34, h.name + ' joins you!', '#9dff8a', 1.8);
    sfx('win');
    RH.ui && RH.ui.rosterChanged();
  }
  game.joinHero = joinHero;

  function useProp(h, p) {
    switch (p.kind) {
      case 'station':
        if (h.rid && RH.setJob) { RH.setJob(h.rid, p.job); h.station = p.job; const j = RH.JOBS.find((x) => x.id === p.job); fx('text', p.x, p.y - 40, (j ? j.ic + ' ' + j.name : p.job), '#ffe8a0', 1.4); sfx('coin'); RH.ui && RH.ui.rosterChanged(); }
        return;
      case 'banner':
        p.used = true; sfx('bell'); fx('text', p.x, p.y - 50, 'The King\u2019s banner!', '#ffe680', 2);
        toast(p.say || 'The banner flies! Guards are running to tear it down.', 'good');
        for (const g of G.guards) if (active(g) && (!p.lure || p.lure.includes(g.tag))) {
          const to = p.to || [tileOf(p.x), tileOf(p.y) + 2];
          g.route = [{ tx: to[0], ty: to[1], x: tcx(to[0]), y: tcx(to[1]), wait: 0 }]; g.looks = [N, N - 0.6, N + 0.6]; g.ri = 0; g.wait = 0;
          if (g.state !== 'alert') { g.state = 'patrol'; g.path = null; g.icon = '!'; g.iconT = 2; }
        }
        break;
      case 'bell':
        p.used = true; sfx('bell'); fx('ring', p.x, p.y, '', '#ffe680', 1.6);
        toast(p.say || 'The bell rings out! The King\u2019s men are coming.', 'good');
        for (const [x, y] of (G.m.allies || [])) spawnAlly(x, y);
        break;
      case 'winch':
        p.used = true; sfx('tie'); fx('text', p.x, p.y - 40, 'Creak\u2026', '#e8dcc0', 1.4);
        for (const q of G.prisoners) if (q.cage === p.id) { q.lowered = true; fx('ring', q.x, q.y, '', '#ffe680', 1); }
        // the noise draws the nearest guards
        for (const g of G.guards) if (active(g) && !passive(g) && g.state !== 'alert' && d2(g, p) < (6 * TILE) ** 2) { g.state = 'investigate'; g.lx = p.x; g.ly = p.y; g.path = null; g.sus = Math.max(g.sus, 0.4); g.icon = '?'; g.iconT = 3; }
        break;
      case 'lever':
        p.used = true; sfx('tie');
        for (const [x, y] of p.gate) G.grid.block[y * G.grid.w + x] = 0;
        G.gatesOpen = (G.gatesOpen || 0) + 1;
        toast(p.say || 'The gate grinds open.', 'good');
        break;
    }
  }
  function hitTarget(p, miss) {
    if (miss) { fx('text', p.x, p.y - 40, 'Wide!', '#ffb08a', 1); sfx('tap'); return; }
    p.hits++; sfx('hit'); fx('text', p.x, p.y - 44, 'Bull\u2019s-eye!', '#ffe680', 1.2);
    if (p.contest && G.contest) {
      G.contest.hits++;
      if (G.contest.hits >= G.contest.need && !G.contest.sprung) springTrap();
      return;
    }
    if (p.used) return;
    p.used = true;
    if (p.plank) {
      for (const [x, y] of p.plank) { const i = y * G.grid.w + x; G.grid.block[i] = 0; G.grid.walk[i] = 1; }
      G.planks = (G.planks || []).concat(p.plank);
      toast('The rope parts and a plank bridge crashes down!', 'good');
    }
    if (p.netAt) {
      const nx = tcx(p.netAt[0]), ny = tcx(p.netAt[1]);
      sfx('net'); fx('net', nx, ny, '', '#d8c890', 2);
      for (const g of G.guards) if (active(g) && (g.x - nx) ** 2 + (g.y - ny) ** 2 < (2 * TILE) ** 2) netGuard(g, 9);
      toast('The trap net drops on them!', 'good');
    }
  }
  function springTrap() {
    G.contest.sprung = true; sfx('alarm');
    toast('It\u2019s a trap! The Sheriff\u2019s men close in. Find John and Tuck and get out!', 'bad');
    const robin = G.heroes.find((h) => h.key === 'robin') || G.heroes[0];
    for (const g of G.guards) if (g.state === 'watch') { g.state = 'investigate'; g.lx = robin.x; g.ly = robin.y; g.sus = 0.7; g.icon = '!'; g.iconT = 3; g.path = null; }
    for (const c of G.civs) if (!c.noble) { c.flee = 8; }
    G.alarmT = 20; G.alarmed = true;
  }
  function netGuard(g, t) {
    g.state = 'netted'; g.stateT = t; g.path = null; g.target = null; g.sus = 0; g.icon = '🕸'; g.iconT = t; g.moving = false;
  }

  function finishBusy(h) {
    const e = h.busyTarget;
    switch (h.busyType) {
      case 'tie':
        if (e && e.state === 'ko' && !e.carried) { e.tied = true; G.stats.tied++; fx('text', e.x, e.y - 20, 'Tied!', '#ffe08a'); }
        break;
      case 'search':
        if (e && !e.searched) {
          e.searched = true;
          if (e.purse > 0) { G.stats.gold += e.purse; fx('text', e.x, e.y - 24, '+£' + e.purse, '#ffd84a', 1.2); sfx('coin'); }
          else fx('text', e.x, e.y - 24, 'Empty', '#ccc');
          e.purse = 0;
        }
        break;
      case 'free': if (e && e.captive) freeCaptive(e); else freePrisoner(e); break;
      case 'read': if (e) readScroll(e); break;
      case 'use': if (e) useProp(h, e); break;
      case 'loot': {
        const c = G.chest;
        if (c && !c.carrier && !h.carry) {
          if (c.onCart) { c.onCart = false; G.cart.chest = false; }
          c.taken = true;
          if (c.value) { c.done = true; G.stats.gold += c.value; fx('text', h.x, h.y - 34, '+£' + c.value, '#ffd84a', 1.5); sfx('coin'); c.x = -999; break; }
          c.carrier = h; h.carry = 'chest';
          fx('text', h.x, h.y - 34, c.letter ? 'Got the letter!' : 'Got the chest!', '#ffd84a', 1.5); sfx('coin');
        }
        break;
      }
      case 'heal':
        if (e) {
          if (h.key !== 'tuck') G.inv.potions--;
          if (e.down) { e.down = false; e.hp = Math.ceil(e.maxhp / 2); fx('text', e.x, e.y - 30, 'Back on your feet!', '#7dff7a', 1.4); }
          else { e.hp = e.maxhp; fx('text', e.x, e.y - 30, 'Healed', '#7dff7a'); }
          if (h.key === 'tuck') G.cdTuck = 10;
          sfx('heal');
        }
        break;
    }
    h.busyType = null; h.busyTarget = null;
  }

  function freePrisoner(p) {
    p = p || G.prisoners.find((x) => !x.freed);
    if (!p || p.freed) return;
    p.freed = true;
    const h = mkHero(p.key, p.tx, p.ty);
    h.x = p.x; h.y = p.y;
    G.heroes.push(h); G.joined.push(p.key);
    fx('text', p.x, p.y - 34, (p.name || h.name) + ' is free!', '#9dff8a', 1.6);
    sfx('win');
    RH.ui && RH.ui.rosterChanged();
  }
  game.freePrisoner = freePrisoner;
  function freeCaptive(c) {
    if (!c || c.freed) return;
    c.freed = true;
    const h = mkHero('outlaw', c.tx, c.ty, c.def);
    h.x = c.x; h.y = c.y; h.rid = c.rec.id; h.fresh = true;
    G.heroes.push(h);
    G.newRecruits.push(c.rec);
    fx('text', c.x, c.y - 34, c.def.short + ' joins the band!', '#9dff8a', 1.8);
    sfx('win');
    RH.ui && RH.ui.rosterChanged();
  }
  game.freeCaptive = freeCaptive;

  // ---------- Swipe sword fighting ----------
  const STROKES = {
    slash: { cd: 0.45, dmg: 0, block: 0.2, label: 'Slash!' },
    heavy: { cd: 0.95, dmg: 1, block: 0.45, label: 'Overhead!', stagger: 0.8 },
    thrust: { cd: 0.65, dmg: 0, block: 0, label: 'Thrust!' },
    parry: { cd: 0.5, dmg: -1, block: 0, label: 'Parry' },
  };
  game.STROKES = STROKES;
  game.swipeStrike = function (e, stroke, heroes) {
    const st = STROKES[stroke]; if (!st || !e || !active(e) || e.kind !== 'guard') return false;
    heroes = (heroes || G.sel).filter((h) => !h.down && !h.npc && !h.carry && h.busy <= 0);
    let h = null, bd = 1e12;
    for (const x of heroes) { const d = d2(x, e); if (d < bd) { bd = d; h = x; } }
    if (!h) return false;
    if (bd > (TILE * 1.25) ** 2) { h.task = { type: 'attack', target: e, kind: 'guard', t: 0 }; h.path = null; h.repathT = 0; h.queued = stroke; return 'approach'; }
    if (h.strokeCd > 0) return 'cooldown';
    return doStroke(h, e, stroke);
  };
  function doStroke(h, e, stroke) {
    const st = STROKES[stroke];
    h.strokeCd = st.cd; h.atkCd = Math.max(h.atkCd, 0.7); h.swingT = 0.3; h.stroke = stroke;
    h.dir = Math.atan2(e.y - h.y, e.x - h.x); h.path = null; h.moving = false;
    if (!h.task || h.task.target !== e) h.task = { type: 'attack', target: e, kind: 'guard', t: 0 };
    G.swipes++;
    if (e.state !== 'alert' && !passive(e)) spot(e, h, true);
    if (stroke === 'parry') { h.parryT = 0.8; fx('text', h.x, h.y - 36, 'Parry', '#cfe8ff', 0.7); sfx('tap'); return 'parry'; }
    const open = e.stagger > 0 || passive(e);
    const block = st.block * (e.type === 'knight' || e.boss ? 1.5 : 1);
    if (!open && Math.random() < block) {
      e.atkCd = Math.max(e.atkCd, 0.25); sfx('clang');
      fx('text', e.x, e.y - 40, 'Blocked', '#d8d8d8', 0.7); fx('spark', (e.x + h.x) / 2, (e.y + h.y) / 2 - 12);
      return 'blocked';
    }
    const dmg = Math.max(1, h.dmg + st.dmg + (open ? 1 : 0));
    e.hp -= dmg; e.flash = 0.18; sfx('clang');
    fx('spark', (e.x + h.x) / 2, (e.y + h.y) / 2 - 12);
    fx('text', e.x, e.y - 40, st.label, '#ffe6a0', 0.7);
    if (st.stagger) { e.stagger = st.stagger; e.atkCd = Math.max(e.atkCd, st.stagger); }
    if (stroke === 'thrust') { const a = Math.atan2(e.y - h.y, e.x - h.x), nx = e.x + Math.cos(a) * 6, ny = e.y + Math.sin(a) * 6; if (RH.isWalk(G.grid, tileOf(nx), tileOf(ny))) { e.x = nx; e.y = ny; } }
    if (e.hp <= 0) defeat(e, lethalOf(h));
    return 'hit';
  }

  function heroHurt(h, d) {
    if (h.down) return;
    h.hp -= d; h.flash = 0.2;
    fx('text', h.x, h.y - 30, '-' + d, '#ff6a5a');
    if (h.hp <= 0) {
      h.hp = 0; h.down = true; h.task = null; h.path = null; h.busy = 0; h.sneak = false;
      if (h.carry) dropCarry(h);
      sfx('down');
      if (h.kind === 'ally') return;
      toast(h.name + ' is down!', 'bad');
      if (h.npc) G.failPending = G.failPending || { t: 1.2, reason: h.name + ' was recaptured.' };
    }
  }
  game.heroHurt = heroHurt;

  // ---------- Guards ----------
  function knockOut(g, t) {
    g.state = 'ko'; g.koT = G.kind === 'defense' ? 999 : t; g.path = null; g.sus = 0; g.target = null; g.icon = ''; g.found = false;
    G.stats.ko++; sfx('ko'); fx('stars', g.x, g.y - 20);
  }
  game.knockOut = knockOut;
  function defeat(g, lethal) {
    if (g.sheriff || g.boss || !lethal) { g.hp = 0; knockOut(g, 70); return; }
    g.state = 'dead'; g.path = null; g.icon = ''; g.found = false; g.target = null;
    G.stats.kills++; sfx('hit');
    if (G.objs.some((o) => o.k === 'nokill')) G.failPending = G.failPending || { t: 1.2, reason: 'A man was killed. Tonight there must be no blood.' };
  }
  game.defeat = defeat;

  function raiseAlarm(x, y, why) {
    G.alarmT = 30;
    if (!G.alarmed) {
      G.alarmed = true; G.stats.alarm = true;
      sfx('alarm'); toast(why === 'body' ? 'A guard found a body: ALARM!' : why === 'woke' ? 'A guard woke up: ALARM!' : why === 'missing' ? 'The sergeant missed his man: ALARM!' : 'ALARM!', 'bad');
      if (G.m.alarmFail) G.failPending = G.failPending || { t: 1.6, reason: why === 'woke' ? 'A guard woke up and raised the alarm.' : why === 'body' ? 'A guard found a body and raised the alarm.' : why === 'missing' ? 'The sergeant found his gate guard gone.' : 'You were spotted. The alarm was raised.' };
      if (G.m.reinforce && !G.reinforced) {
        G.reinforced = true;
        for (const r of G.m.reinforce) {
          const [tx, ty, type] = r;
          const g = mkGuard(tx, ty, type, G.m.rank);
          g.route = [{ tx, ty, x: g.x, y: g.y, wait: 0 }]; g.looks = [S, S - 0.6, S + 0.6]; g.home = { x: g.x, y: g.y };
          g.state = 'investigate'; g.lx = x; g.ly = y; g.sus = 0.7; g.faceTo = g.dir;
          G.guards.push(g);
        }
        toast('Reinforcements are coming!', 'bad');
      }
    }
    for (const g of G.guards) {
      if (!active(g) || g.state === 'alert' || passive(g)) continue;
      if ((g.x - x) ** 2 + (g.y - y) ** 2 < (10 * TILE) ** 2) {
        g.state = 'investigate'; g.lx = x; g.ly = y; g.path = null; g.sus = Math.max(g.sus, 0.6); g.icon = '?'; g.iconT = 3;
      }
    }
  }
  game.raiseAlarm = raiseAlarm;

  const SHOUTS = ['Outlaws!', 'Halt!', 'Seize him!', 'To arms!', 'There!', 'Hood\u2019s men!'];
  function spot(g, h, silentToast) {
    if (g.coward) { g.state = 'flee'; g.target = h; g.icon = '!'; g.iconT = 3; g.path = null; G.stats.spotted = true; fx('text', g.x, g.y - 44, 'Help! Thieves!', '#ffb08a', 1.4); return; }
    if (g.state === 'alert') { g.target = h; return; }
    g.state = 'alert'; g.target = h; g.sus = 1; g.icon = '!'; g.iconT = 2.5; g.path = null; g.lostT = 0;
    g.lx = h.x; g.ly = h.y;
    if (h.kind !== 'ally') G.stats.spotted = true;
    sfx('alert');
    fx('text', g.x, g.y - 44, SHOUTS[(g.id + Math.floor(G.time)) % SHOUTS.length], '#ffb08a', 1.4);
    if (!silentToast && h.kind !== 'ally') toast(`Spotted! ${h.name} has been seen!`, 'bad');
    for (const o of G.guards) {
      if (o === g || !active(o) || o.state === 'alert' || passive(o) || o.coward) continue;
      if (d2(o, g) < ((GT[g.type] && GT[g.type].callR || 8) * TILE) ** 2) {
        o.state = 'alert'; o.target = h; o.sus = 1; o.icon = '!'; o.iconT = 2; o.path = null; o.lx = h.x; o.ly = h.y; o.lostT = 0;
      }
    }
    if (h.kind !== 'ally') raiseAlarm(g.x, g.y, 'spotted');
  }
  game.spot = spot;

  function wake(g) {
    g.state = 'search'; g.searchT = 10; g.sus = 0.8; g.lx = g.x; g.ly = g.y; g.icon = '?'; g.iconT = 3; g.tied = false;
    g.hp = Math.max(g.hp, 2);
    fx('text', g.x, g.y - 30, '!?', '#ffcf5a');
    raiseAlarm(g.x, g.y, 'woke');
  }

  function canSeePoint(g, x, y, R) {
    const dx = x - g.x, dy = y - g.y, dd = dx * dx + dy * dy;
    if (dd > R * R) return false;
    const d = Math.sqrt(dd);
    if (d > TILE * 0.8 && Math.abs(RH.angDiff(g.dir, Math.atan2(dy, dx))) > g.fov / 2) return false;
    return RH.los(G.grid, g.x, g.y - 8, x, y - 6);
  }
  game.canSeePoint = canSeePoint;

  function vision(g, dt) {
    const st = g.state;
    if (passive(g)) { g.seeing = null; return; }
    const R0 = guardRange(g);
    let best = 0, bh = null;
    const targets = G.allies.length ? G.heroes.concat(G.allies) : G.heroes;
    for (const h of targets) {
      if (h.down) continue;
      let R = R0;
      if (G.night && litAt(h.x, h.y)) R = 7.5 * TILE;
      const dx = h.x - g.x, dy = h.y - g.y, dd = dx * dx + dy * dy;
      if (dd > R * R) continue;
      const d = Math.sqrt(dd);
      if (RH.hideAt(G.grid, h.x, h.y) && d > 1.5 * TILE && st !== 'alert') continue;
      if (h.climbZ > 8 && d > 2 * TILE) continue;
      if (!canSeePoint(g, h.x, h.y, R)) continue;
      const k = 1 - d / R;
      let rate = 0.65 + 3.4 * k * k;
      if (h.sneak) rate *= G.sneakMul;
      if (!h.moving) rate *= 0.75;
      if (st === 'search' || st === 'investigate') rate *= 1.6;
      if (G.alarmT > 0) rate *= 1.3;
      if (d < 1.2 * TILE) rate = 6;
      if (h.kind === 'ally') rate = 6;
      if (rate > best) { best = rate; bh = h; }
    }
    g.seeing = bh;
    if (st === 'alert' || st === 'flee') {
      if (bh) { g.lostT = 0; g.lx = bh.x; g.ly = bh.y; if (!g.target || g.target.down) g.target = bh; }
      else g.lostT += dt;
      return;
    }
    if (bh) {
      g.sus += best * dt;
      g.lx = bh.x; g.ly = bh.y;
      if (g.sus >= 1) { spot(g, bh); return; }
      if (g.sus >= 0.6 && (st === 'look' || st === 'patrol' || st === 'lured')) { g.state = 'investigate'; g.path = null; }
      else if (g.sus >= 0.28 && (st === 'patrol' || st === 'lured')) { g.state = 'look'; g.stateT = 0; g.path = null; g.icon = '?'; g.iconT = 99; sfx('suspect'); }
    } else g.sus = Math.max(0, g.sus - 0.16 * dt);
    // bodies: raise the alarm, then go and wake or untie the fallen man
    if (G.kind === 'defense') return;
    for (const b of G.guards) {
      if (b === g || b.found || !isBody(b)) continue;
      if (RH.hideAt(G.grid, b.x, b.y)) continue;
      if (!canSeePoint(g, b.x, b.y, R0 * 0.9)) continue;
      b.found = true;
      g.state = 'investigate'; g.lx = b.x; g.ly = b.y; g.path = null; g.icon = '!'; g.iconT = 2; g.rescue = b.state === 'ko' ? b : null;
      fx('text', g.x, g.y - 40, b.state === 'ko' ? 'Wake up, you fool!' : 'A body!', '#ff8a6a', 1.4);
      raiseAlarm(b.x, b.y, 'body');
      break;
    }
  }

  function resumePatrol(g) {
    g.state = 'patrol'; g.path = null; g.icon = ''; g.target = null; g.sus = Math.min(g.sus, 0.2);
  }

  function updGuard(g, dt) {
    g.atkCd -= dt; if (g.flash > 0) g.flash -= dt; if (g.dazedT > 0) g.dazedT -= dt;
    if (g.iconT > 0) { g.iconT -= dt; if (g.iconT <= 0) g.icon = ''; }
    if (g.state === 'dead' || g.carried || g.state === 'gone') return;
    if (g.state === 'ko') {
      if (!g.tied) { g.koT -= dt; if (g.koT <= 0) wake(g); }
      return;
    }
    // pit traps on the road
    for (const t of G.traps) if (!t.used && (g.x - t.x) ** 2 + (g.y - t.y) ** 2 < (TILE * 0.55) ** 2) {
      t.used = true; knockOut(g, 999); g.tied = true; g.inPit = true; fx('text', g.x, g.y - 30, 'Aaagh!', '#ffb08a', 1.2); sfx('ko');
      toast('Into the pit with him!', 'good'); return;
    }
    if (g.state === 'stunned') { g.stateT -= dt; g.dir += dt * 6; if (g.stateT <= 0) { g.state = 'search'; g.searchT = 6; g.sus = 0.7; g.lx = g.x; g.ly = g.y; } return; }
    if (g.state === 'netted') { g.stateT -= dt; g.moving = false; if (g.stateT <= 0) { g.state = 'search'; g.searchT = 8; g.sus = 0.8; g.lx = g.x; g.ly = g.y; g.icon = '!'; g.iconT = 2; } return; }
    if (g.state === 'watch') { g.moving = false; lookCycle(g, dt); return; }
    vision(g, dt);
    const st = g.state;
    switch (st) {
      case 'patrol': patrol(g, dt); break;
      case 'raid': raid(g, dt); break;
      case 'look': {
        g.stateT += dt;
        g.dir = RH.turnToward(g.dir, Math.atan2(g.ly - g.y, g.lx - g.x), 4 * dt);
        if (g.sus <= 0.02 || g.stateT > 6) resumePatrol(g);
        break;
      }
      case 'investigate': {
        if (!g.path) {
          if ((g.x - g.lx) ** 2 + (g.y - g.ly) ** 2 < (TILE * 1.2) ** 2 || !setPath(g, tileOf(g.lx), tileOf(g.ly))) { arrive(g); break; }
        }
        if (follow(g, g.walk * 1.25, dt, 7)) arrive(g);
        break;
      }
      case 'search': {
        g.searchT -= dt;
        if (!g.path) {
          g.wait -= dt;
          g.dir += dt * 1.4 * (g.id % 2 ? 1 : -1);
          if (g.wait <= 0) {
            g.wait = 1.5 + Math.random() * 1.5;
            const tx = tileOf(g.lx) + Math.floor(Math.random() * 7) - 3, ty = tileOf(g.ly) + Math.floor(Math.random() * 7) - 3;
            if (RH.isWalk(G.grid, tx, ty)) setPath(g, tx, ty);
          }
        } else follow(g, g.walk, dt, 6);
        if (g.searchT <= 0 && g.sus < 0.6) resumePatrol(g);
        break;
      }
      case 'flee': {
        const t = g.target;
        if (!t || g.lostT > 4) { resumePatrol(g); break; }
        if (!g.path) {
          const a = Math.atan2(g.y - t.y, g.x - t.x);
          setPath(g, tileOf(g.x + Math.cos(a) * 5 * TILE), tileOf(g.y + Math.sin(a) * 5 * TILE));
        }
        follow(g, g.walk * 1.5, dt, 8);
        break;
      }
      case 'alert': {
        const t = g.target;
        if (g.leash && g.home && d2(g, g.home) > g.leash * g.leash) {
          g.state = 'investigate'; g.lx = g.home.x; g.ly = g.home.y; g.path = null; g.target = null; g.icon = ''; g.sus = 0.3;
          fx('text', g.x, g.y - 44, g.boss ? 'Come back and fight!' : 'Back to my post\u2026', '#ffcf9a', 1.2);
          break;
        }
        if (!t || t.down || g.lostT > 5) {
          if (g.seeing) { g.target = g.seeing; break; }
          if (G.kind === 'defense' && g.raider) { g.state = 'raid'; g.path = null; g.target = null; break; }
          g.state = 'search'; g.searchT = 10; g.path = null; g.icon = '?'; g.iconT = 3; g.target = null; break;
        }
        const dd = d2(t, g);
        if (g.ranged && dd > (TILE * 2.5) ** 2 && dd < (7 * TILE) ** 2 && g.seeing === t) {
          g.path = null; g.moving = false; g.dir = Math.atan2(t.y - g.y, t.x - g.x);
          if (g.atkCd <= 0) { g.atkCd = 1.7; g.drawT = 0.3; G.projs.push({ kind: 'garrow', x: g.x, y: g.y - 14, sx: g.x, sy: g.y - 14, target: t, from: g, t: 0 }); sfx('bow'); }
          break;
        }
        if (dd < (TILE * 0.9) ** 2) {
          g.path = null; g.moving = false;
          g.dir = Math.atan2(t.y - g.y, t.x - g.x);
          if (g.stagger > 0) g.stagger -= dt;
          else if (g.atkCd <= 0) {
            g.atkCd = g.sheriff || g.boss ? 0.9 : g.type === 'knight' ? 1.3 : 1.15; g.swingT = 0.25;
            if (t.parryT > 0) {
              t.parryT = 0; g.stagger = 1.3; sfx('clang');
              fx('text', t.x, t.y - 40, 'Parried!', '#cfe8ff', 0.9); fx('spark', (t.x + g.x) / 2, (t.y + g.y) / 2 - 12);
            } else { heroHurt(t, g.dmg); sfx('clang'); }
          }
        } else {
          g.repathT -= dt;
          if (!g.path || g.repathT <= 0) { g.repathT = 0.45; setPath(g, tileOf(g.lostT > 0 ? g.lx : t.x), tileOf(g.lostT > 0 ? g.ly : t.y)); }
          if (follow(g, g.chase, dt, 10) && dd > (TILE * 0.9) ** 2) {
            const dx = t.x - g.x, dy = t.y - g.y, d = Math.sqrt(dd);
            const s = Math.min(d - TILE * 0.7, g.chase * dt);
            if (s > 0) { g.x += dx / d * s; g.y += dy / d * s; g.dir = Math.atan2(dy, dx); g.moving = true; }
          }
        }
        break;
      }
      case 'charmed': {
        g.stateT -= dt; g.moving = false;
        const m = g.charmBy;
        if (m && !m.down) g.dir = RH.turnToward(g.dir, Math.atan2(m.y - g.y, m.x - g.x), 6 * dt);
        if (g.stateT <= 0 || !m || m.down || d2(m, g) > (7 * TILE) ** 2) { resumePatrol(g); g.sus = 0; }
        break;
      }
      case 'lured': {
        const c = g.coin;
        if (!c || c.gone) { resumePatrol(g); break; }
        if (!g.path && d2(g, c) > (TILE * 0.8) ** 2) { if (!setPath(g, tileOf(c.x), tileOf(c.y))) { resumePatrol(g); break; } }
        if (follow(g, g.walk * 1.3, dt, 7) || d2(g, c) < (TILE * 0.8) ** 2) {
          g.path = null;
          if (c.ale) { g.state = 'drinking'; g.stateT = 2.5; g.icon = '🍺'; g.iconT = 2.5; c.gone = true; }
          else { g.state = 'counting'; g.stateT = 6; g.icon = '$'; g.iconT = 6; }
          g.dir = Math.atan2(c.y - g.y, c.x - g.x) + Math.PI * 0.15;
        }
        break;
      }
      case 'counting': {
        g.stateT -= dt; g.moving = false;
        if (g.stateT <= 0) { if (g.coin) g.coin.gone = true; g.coin = null; resumePatrol(g); }
        break;
      }
      case 'drinking': {
        g.stateT -= dt; g.moving = false;
        if (g.stateT <= 0) { g.coin = null; knockOut(g, 60); g.icon = 'z'; g.iconT = 60; fx('text', g.x, g.y - 30, 'Zzz\u2026', '#cfe8ff', 2); }
        break;
      }
    }
  }
  function arrive(g) {
    const b = g.rescue;
    g.rescue = null;
    if (b && b.state === 'ko' && !b.carried && d2(g, b) < (TILE * 1.6) ** 2) {
      fx('text', b.x, b.y - 26, b.tied ? 'Untied!' : 'Up!', '#ffb08a', 1.2);
      b.tied = false; wake(b);
    }
    g.state = 'search'; g.searchT = 7; g.path = null;
  }

  function patrol(g, dt) {
    if (g.escort && G.cart) return escortMove(g, dt);
    const r = g.route;
    const wp = r[g.ri % r.length];
    if (g.wait > 0) { g.wait -= dt; g.moving = false; lookCycle(g, dt); return; }
    const atWp = (g.x - wp.x) ** 2 + (g.y - wp.y) ** 2 < 4;
    if (atWp) {
      g.path = null; g.moving = false;
      // a sergeant who checks on his gate guard
      if (g.check && d2(g, g.check) < (TILE * 2) ** 2 && !G.alarmed) {
        const m = G.guards.find((o) => o.tag === g.check.tag);
        if (m && (!active(m) || d2(m, m.home) > (3 * TILE) ** 2)) { fx('text', g.x, g.y - 44, 'Where\u2019s Wat?!', '#ffb08a', 1.6); g.icon = '!'; g.iconT = 2; raiseAlarm(g.x, g.y, 'missing'); }
      }
      if (r.length === 1) { lookCycle(g, dt); return; }
      g.wait = wp.wait; if (wp.dir != null) g.faceTo = wp.dir; else g.faceTo = g.dir;
      g.ri = (g.ri + 1) % r.length;
      return;
    }
    if (!g.path) { if (!setPath(g, wp.tx != null ? wp.tx : tileOf(wp.x), wp.ty != null ? wp.ty : tileOf(wp.y))) { g.ri = (g.ri + 1) % r.length; return; } }
    if (follow(g, g.walk, dt, 6) && r.length === 1) g.faceTo = g.looks ? g.looks[g.lookI % g.looks.length] : g.dir;
  }
  function lookCycle(g, dt) {
    if (g.looks) {
      g.lookT -= dt;
      if (g.lookT <= 0) { g.lookI = (g.lookI + 1) % g.looks.length; g.lookT = 2.2 + (g.id % 3) * 0.5; }
      g.faceTo = g.looks[g.lookI];
    }
    if (g.faceTo != null) g.dir = RH.turnToward(g.dir, g.faceTo, 2.2 * dt);
  }

  function escortMove(g, dt) {
    const c = G.cart;
    const ox = g.escort[0] * TILE, oy = g.escort[1] * TILE;
    const tx = c.x + ox, ty = c.y + oy;
    const dx = tx - g.x, dy = ty - g.y, d = Math.hypot(dx, dy);
    if (d > TILE * 2.2) {
      g.repathT -= dt;
      if (!g.path || g.repathT <= 0) { g.repathT = 0.6; setPath(g, tileOf(tx), tileOf(ty)); }
      follow(g, g.walk * 1.4, dt, 6);
      return;
    }
    g.path = null;
    if (d > 2) {
      const s = Math.min(d, (c.state === 'moving' ? c.speed * 1.3 : g.walk) * dt);
      const nx = g.x + dx / d * s, ny = g.y + dy / d * s;
      if (RH.isWalk(G.grid, tileOf(nx), tileOf(ny))) { g.x = nx; g.y = ny; }
      g.moving = s > 0.05; g.anim += dt * 4;
    } else g.moving = false;
    if (c.state === 'moving') {
      g.lookT -= dt;
      if (g.lookT <= 0) { g.lookI = (g.lookI + 1) % g.looks.length; g.lookT = 2.5; }
      g.dir = RH.turnToward(g.dir, g.looks[g.lookI], 2 * dt);
    } else {
      const out = g.escort[0] < -0.5 ? Math.PI : g.escort[0] > 0.5 ? 0 : N;
      g.lookT -= dt;
      if (g.lookT <= 0) { g.lookI = (g.lookI + 1) % 3; g.lookT = 2.6; }
      g.dir = RH.turnToward(g.dir, out + (g.lookI - 1) * 0.6, 2 * dt);
    }
  }

  // ---------- Defence of Sherwood ----------
  function raid(g, dt) {
    const f = G.def.fire;
    if (d2(g, f) < (TILE * 1.6) ** 2) {
      g.state = 'gone'; G.def.reached++; sfx('alarm');
      toast(`A soldier reached the camp fire! (${G.def.reached}/${G.def.max})`, 'bad');
      fx('text', f.x, f.y - 40, 'Fire!', '#ff8a5a', 1.4);
      return;
    }
    g.repathT -= dt;
    if (!g.path || g.repathT <= 0) { g.repathT = 2; setPath(g, tileOf(f.x), tileOf(f.y)); }
    follow(g, g.walk * 1.1, dt, 6);
  }
  function updDefense(dt) {
    const D = G.def; if (!D) return;
    D.t += dt;
    const w = D.waves[D.wi];
    if (w && D.t >= w.t) {
      D.wi++;
      for (let i = 0; i < w.n; i++) {
        const [fx0, fy0] = w.from[i % w.from.length];
        const n = RH.nearestWalk(G.grid, fx0 + (i % 3) - 1, fy0 + ((i / 3) | 0));
        if (n < 0) continue;
        const g = mkGuard(n % G.grid.w, (n / G.grid.w) | 0, w.types ? w.types[i % w.types.length] : 'soldier', G.m.rank);
        g.route = [{ x: g.x, y: g.y, tx: n % G.grid.w, ty: (n / G.grid.w) | 0, wait: 0 }]; g.home = { x: g.x, y: g.y };
        g.state = 'raid'; g.raider = true; g.purse = 5; g.walk *= 1.05;
        G.guards.push(g);
      }
      sfx('alarm'); toast(`Wave ${D.wi} of ${D.waves.length}: the Sheriff\u2019s men are in the forest!`, 'bad');
    }
    if (D.reached >= D.max) G.failPending = G.failPending || { t: 0.8, reason: 'The Sheriff\u2019s men overran the camp fire.' };
  }
  game.defenseDone = () => G.def && G.def.wi >= G.def.waves.length && G.guards.every((g) => !g.raider || !active(g));

  // ---------- Allies (the King's men) ----------
  function spawnAlly(tx, ty) {
    const a = mkUnit('ally', tx, ty);
    a.name = 'King\u2019s man'; a.hp = a.maxhp = 6; a.dmg = 1; a.def = { weapon: 'sword', name: 'King\u2019s man' };
    a.down = false; a.spd = 2.4 * TILE;
    G.allies.push(a);
    fx('text', a.x, a.y - 30, 'For the King!', '#b8ffb0', 1.4);
  }
  game.spawnAlly = spawnAlly;
  function updAlly(a, dt) {
    a.atkCd -= dt; if (a.flash > 0) a.flash -= dt;
    if (a.down) { a.moving = false; return; }
    let t = a.target;
    if (!t || !active(t)) {
      t = null; let bd = (10 * TILE) ** 2;
      for (const g of G.guards) { if (!active(g) || g.coward) continue; const d = d2(a, g); if (d < bd) { bd = d; t = g; } }
      a.target = t;
    }
    if (!t) { a.moving = false; return; }
    if (d2(a, t) > (TILE * 0.95) ** 2) {
      a.repathT -= dt;
      if (!a.path || a.repathT <= 0) { a.repathT = 0.6; setPath(a, tileOf(t.x), tileOf(t.y)); }
      follow(a, a.spd, dt, 9);
      return;
    }
    a.path = null; a.moving = false; a.dir = Math.atan2(t.y - a.y, t.x - a.x);
    if (t.state !== 'alert') spot(t, a, true);
    if (a.atkCd <= 0) {
      a.atkCd = 1.1; a.swingT = 0.25; t.hp -= a.dmg; t.flash = 0.15; sfx('clang');
      fx('spark', (a.x + t.x) / 2, (a.y + t.y) / 2 - 12);
      if (t.hp <= 0) defeat(t, false);
    }
  }

  // blazon points: stand on one with nobody hostile nearby to raise our colours
  function updBlazons(dt) {
    for (const b of G.blazons) {
      if (b.cap) continue;
      const near = G.heroes.some((h) => !h.down && (h.x - b.x) ** 2 + (h.y - b.y) ** 2 < (TILE * 1.3) ** 2);
      const foe = G.guards.some((g) => active(g) && !passive(g) && (g.x - b.x) ** 2 + (g.y - b.y) ** 2 < (TILE * 3.5) ** 2);
      if (near && !foe) { b.t += dt; if (b.t >= 3) { b.cap = true; sfx('win'); fx('text', b.x, b.y - 50, b.label + ' taken!', '#b8ffb0', 1.6); toast(b.label + ' is ours!', 'good'); } }
      else b.t = Math.max(0, b.t - dt * 0.5);
    }
  }

  // listening spots: stand still unseen until you've overheard everything
  function updListen(dt) {
    for (const h of G.heroes) {
      const p = h.listen;
      if (!p) continue;
      if (h.down || h.task || h.moving || p.used || (h.x - p.x) ** 2 + (h.y - p.y) ** 2 > (TILE * 1.4) ** 2) { h.listen = null; continue; }
      const seen = G.guards.some((g) => g.seeing === h || (g.state === 'alert' && g.target === h));
      if (seen) { p.t = Math.max(0, (p.t || 0) - dt * 2); continue; }
      p.t = (p.t || 0) + dt;
      if (Math.floor(p.t * 2) !== Math.floor((p.t - dt) * 2)) fx('text', p.x + (Math.random() - 0.5) * 30, p.y - 50, '\u2026', '#e8dcc0', 0.8);
      if (p.t >= (p.dur || 4)) { p.used = true; h.listen = null; sfx('charm'); RH.ui && RH.ui.tip('👂 ' + (p.say || 'You hear enough.')); }
    }
  }

  // ---------- Civilians, nobles & convoy ----------
  function updCiv(c, dt) {
    if (c.state === 'ko') { if (c.carriedBy) { c.x = c.carriedBy.x; c.y = c.carriedBy.y; } c.moving = false; return; }
    if (c.carter) {
      const cart = G.cart;
      c.x = cart.x - TILE * 0.95; c.y = cart.y + 4; c.dir = cart.dir;
      c.moving = cart.state === 'moving'; if (c.moving) c.anim += dt * 4;
      return;
    }
    if (c.flee > 0) {
      c.flee -= dt;
      if (!c.path) setPath(c, c.home.x + Math.floor(Math.random() * 13) - 6, c.home.y + Math.floor(Math.random() * 13) - 6);
      follow(c, c.speedV * 1.8, dt); return;
    }
    if (c.noble) return updNoble(c, dt);
    if (c.path) { follow(c, c.speedV, dt); return; }
    c.wait -= dt; c.moving = false;
    if (c.wait <= 0) {
      c.wait = 2 + Math.random() * 4;
      const tx = c.home.x + Math.floor(Math.random() * 9) - 4, ty = c.home.y + Math.floor(Math.random() * 9) - 4;
      if (RH.isWalk(G.grid, tx, ty)) setPath(c, tx, ty);
    }
  }
  // a noble who sees an outlaw hurries to the nearest guard and points him at you
  function updNoble(c, dt) {
    if (c.state === 'report') {
      const g = c.to;
      if (!g || !active(g)) { c.state = 'ok'; c.path = null; return; }
      c.repathT -= dt;
      if (!c.path || c.repathT <= 0) { c.repathT = 1; setPath(c, tileOf(g.x), tileOf(g.y)); }
      follow(c, c.speedV * 1.6, dt);
      if (d2(c, g) < (TILE * 1.4) ** 2) {
        fx('text', c.x, c.y - 40, 'Guard! Outlaws, there!', '#ffcf9a', 1.6);
        if (g.state !== 'alert' && !passive(g)) { g.state = 'investigate'; g.lx = c.lx; g.ly = c.ly; g.path = null; g.sus = Math.max(g.sus, 0.75); g.icon = '!'; g.iconT = 3; }
        c.state = 'ok'; c.path = null; c.wait = 8; c.icon = '';
      }
      return;
    }
    // look for outlaws
    let seen = null;
    for (const h of G.heroes) {
      if (h.down || RH.hideAt(G.grid, h.x, h.y)) continue;
      const R = (G.night && !litAt(h.x, h.y) ? 3.5 : 5) * TILE;
      const dd = d2(h, c); if (dd > R * R) continue;
      if (Math.sqrt(dd) > TILE && Math.abs(RH.angDiff(c.dir, Math.atan2(h.y - c.y, h.x - c.x))) > 1.1) continue;
      if (!RH.los(G.grid, c.x, c.y - 8, h.x, h.y - 6)) continue;
      seen = h; break;
    }
    if (seen) {
      c.sus = (c.sus || 0) + dt * (seen.sneak ? 0.8 : 1.6);
      c.icon = '?';
      if (c.sus >= 1) {
        let best = null, bd = 1e12;
        for (const g of G.guards) { if (!active(g) || g.coward) continue; const d = d2(g, c); if (d < bd) { bd = d; best = g; } }
        c.sus = 0;
        if (best) { c.state = 'report'; c.to = best; c.lx = seen.x; c.ly = seen.y; c.path = null; c.repathT = 0; c.icon = '!'; sfx('suspect'); fx('text', c.x, c.y - 40, 'Outlaws!', '#ffcf9a', 1.2); G.stats.spotted = true; }
      }
      return;
    }
    c.sus = Math.max(0, (c.sus || 0) - dt * 0.4); if (c.sus === 0) c.icon = '';
    if (c.path) { follow(c, c.speedV, dt, 5); return; }
    c.wait -= dt; c.moving = false;
    c.dir += Math.sin(G.time * 0.7 + c.id) * dt * 0.6;
    if (c.wait <= 0) {
      c.wait = 3 + Math.random() * 4;
      const tx = c.home.x + Math.floor(Math.random() * 7) - 3, ty = c.home.y + Math.floor(Math.random() * 7) - 3;
      if (RH.isWalk(G.grid, tx, ty)) setPath(c, tx, ty);
    }
  }

  function updCart(dt) {
    const c = G.cart; if (!c) return;
    const cv = G.m.convoy;
    if (c.state === 'escaped' || c.state === 'stopped') return;
    if (c.carter.state !== 'ok') { c.state = 'stopped'; toast('The cart has stopped. Take the chest!', 'good'); return; }
    if (c.state === 'log') { c.waitT -= dt; if (c.waitT <= 0) { c.state = 'moving'; G.log.cleared = true; toast('The road is clear: the cart is moving again!'); } return; }
    const wp = cv.path[c.pi];
    const tx = wp[0] * TILE, ty = wp[1] * TILE;
    const dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy);
    const sp = c.speed * (G.alarmed ? 1.7 : 1);
    c.wheel += sp * dt / 6;
    if (d <= sp * dt) {
      c.x = tx; c.y = ty;
      if (c.pi === cv.logStop && !G.log.cleared) { c.state = 'log'; c.waitT = cv.logWait; c.pi++; return; }
      c.pi++;
      if (c.pi >= cv.path.length) { c.state = 'escaped'; if (!G.chest.taken) G.failPending = G.failPending || { t: 0.5, reason: 'The cart got away.' }; }
      return;
    }
    c.x += dx / d * sp * dt; c.y += dy / d * sp * dt; c.dir = Math.atan2(dy, dx);
    if (G.chest.onCart) { G.chest.x = c.x; G.chest.y = c.y; }
  }

  // ---------- Projectiles ----------
  function updProjs(dt) {
    for (let i = G.projs.length - 1; i >= 0; i--) {
      const p = G.projs[i];
      p.t += dt;
      if (p.kind === 'arrow' || p.kind === 'stone' || p.kind === 'garrow') {
        const e = p.target;
        const tx = e.x + (p.miss ? 22 : 0), ty = e.y - (p.prop ? 18 : 12);
        const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy), s = (p.kind === 'stone' ? 560 : 720) * dt;
        p.ang = Math.atan2(dy, dx);
        if (d <= s || p.t > 2) {
          G.projs.splice(i, 1);
          if (p.kind === 'garrow') { if (!e.down && RH.los(G.grid, p.sx, p.sy, e.x, e.y - 8)) { if (e.parryT > 0) fx('text', e.x, e.y - 40, 'Deflected', '#cfe8ff', 0.7); else heroHurt(e, 1); } continue; }
          if (p.prop) { hitTarget(e, p.miss); continue; }
          if (!active(e)) continue;
          if (p.kind === 'stone') {
            if (e.type === 'knight' || e.boss || e.sheriff) { e.state = 'stunned'; e.stateT = 2; e.path = null; e.dazedT = 3; fx('text', e.x, e.y - 40, 'Clonk!', '#ffe08a', 0.9); sfx('clang'); }
            else knockOut(e, 25);
            continue;
          }
          if (e.arrowproof) { fx('text', e.x, e.y - 40, 'Clang! Arrows bounce off.', '#d8d8d8', 1.1); sfx('clang'); if (e.state !== 'alert') spot(e, p.from, true); continue; }
          const unaware = e.state !== 'alert';
          e.hp -= unaware ? 4 : 2; e.flash = 0.2; sfx('hit');
          if (e.hp <= 0) defeat(e, true);
          else spot(e, p.from, true);
          continue;
        }
        p.x += dx / d * s; p.y += dy / d * s;
      } else {
        const k = Math.min(1, p.t / p.dur);
        p.x = RH.lerp(p.sx, p.tx, k); p.y = RH.lerp(p.sy, p.ty, k); p.z = Math.sin(k * Math.PI) * 40;
        if (k >= 1) { G.projs.splice(i, 1); landItem(p); }
      }
    }
  }
  const lurable = (g) => active(g) && g.state !== 'alert' && !passive(g) && !g.coward && !g.boss && !g.sheriff;
  function nearestTo(x, y, R, ok) {
    let best = null, bd = R * R;
    for (const g of G.guards) { if (!ok(g)) continue; const d = (g.x - x) ** 2 + (g.y - y) ** 2; if (d < bd) { bd = d; best = g; } }
    return best;
  }
  function landItem(p) {
    const at = { x: p.tx, y: p.ty };
    switch (p.kind) {
      case 'hive':
        sfx('buzz'); fx('bees', p.tx, p.ty, '', '#ffd23a', 2.5);
        for (const g of G.guards) if (active(g) && d2(g, at) < (1.8 * TILE) ** 2) { g.state = 'stunned'; g.stateT = 7; g.path = null; g.icon = '🐝'; g.iconT = 7; g.target = null; g.sus = 0; }
        break;
      case 'net':
        sfx('net'); fx('net', p.tx, p.ty, '', '#d8c890', 2);
        { let n = 0; for (const g of G.guards) if (active(g) && d2(g, at) < (1.5 * TILE) ** 2) { netGuard(g, 7); n++; } if (!n) fx('text', p.tx, p.ty - 20, 'Missed!', '#ccc'); }
        break;
      case 'apple': {
        sfx('throw'); fx('ring', p.tx, p.ty, '', '#ff6a4a', 0.6);
        const g = nearestTo(p.tx, p.ty, 5 * TILE, lurable);
        if (g) { g.state = 'investigate'; g.lx = p.tx; g.ly = p.ty; g.path = null; g.sus = Math.max(g.sus, 0.35); g.icon = '🍎'; g.iconT = 3; }
        G.coins.push({ x: p.tx, y: p.ty, apple: true, gone: false, t: 8 });
        break;
      }
      case 'ale': {
        sfx('gulp');
        const mug = { x: p.tx, y: p.ty, ale: true, gone: false };
        G.coins.push(mug);
        const g = nearestTo(p.tx, p.ty, 6 * TILE, (x) => active(x) && x.state !== 'alert' && !passive(x) && !x.coward && !x.boss && !x.sheriff);
        if (g) { g.state = 'lured'; g.coin = mug; g.path = null; g.icon = '🍺'; g.iconT = 2; g.sus = 0; }
        break;
      }
      default: { // purse
        const coin = { x: p.tx, y: p.ty, gone: false };
        G.coins.push(coin); sfx('coin');
        let n = 0;
        for (const g of G.guards) {
          if (!lurable(g)) continue;
          if (d2(g, at) < (6 * TILE) ** 2) {
            if (g.nogreed) { if (d2(g, at) < (4 * TILE) ** 2) { fx('text', g.x, g.y - 40, 'Hmph. A trick.', '#ffcf9a', 1.1); g.state = 'investigate'; g.lx = p.tx; g.ly = p.ty; g.path = null; g.sus = Math.max(g.sus, 0.4); } continue; }
            g.state = 'lured'; g.coin = coin; g.path = null; g.icon = '$'; g.iconT = 2; g.sus = 0; n++;
          }
        }
        if (n >= 2) fx('text', p.tx, p.ty - 30, 'Mine! No, mine!', '#ffe08a', 1.4);
      }
    }
  }

  // archery contest: aim sways; release when the ring is steady
  game.sway = () => Math.sin(G.time * 2.1) * 0.8 + Math.sin(G.time * 5.3) * 0.35;

  // ---------- Objectives ----------
  const inExit = (x, y) => {
    const e = G.exit; const tx = x / TILE, ty = y / TILE;
    return tx >= e.x && tx < e.x + e.w && ty >= e.y && ty < e.y + e.h;
  };
  game.inExit = inExit;
  const byId = (arr, id) => arr.find((x) => x.id === id || x.key === id);

  game.objectives = function () {
    const out = [];
    const m = G.m;
    for (const o of G.objs) {
      const tx = o.text;
      switch (o.k) {
        case 'rescue': case 'free': {
          const p = o.id ? byId(G.prisoners, o.id) : G.prisoners[0];
          if (p) out.push({ text: tx || ('Free ' + (p.name || RH.HEROES[p.key].name)), done: p.freed });
          break;
        }
        case 'meet': { const c = byId(G.contacts, o.id); if (c) out.push({ text: tx || 'Meet ' + c.name, done: c.met }); break; }
        case 'listen': case 'use': { const p = byId(G.props, o.id); if (p) out.push({ text: tx || (PROP_LABEL[p.kind] || 'Use it'), done: p.used }); break; }
        case 'steal': out.push({ text: tx || 'Steal the tax chest', done: G.chest.taken }); break;
        case 'convoy': {
          const d = G.chest.taken, c = G.cart;
          const extra = d ? '' : c.state === 'log' ? ` · tree ${Math.ceil(c.waitT)}s` : c.state === 'stopped' ? ' · stopped!' : '';
          out.push({ text: (tx || 'Stop the cart, take the chest') + extra, done: d }); break;
        }
        case 'sheriff': { const s = G.sheriff; out.push({ text: tx || 'Knock out & tie up the Sheriff', done: s.state === 'ko' && s.tied }); break; }
        case 'boss': { const b = G.boss; out.push({ text: tx || 'Defeat ' + (b.name || 'the captain'), done: b && (b.state === 'ko' || b.state === 'dead') }); break; }
        case 'contest': out.push({ text: (tx || 'Win the archery contest') + (G.contest.sprung ? '' : ` (${G.contest.hits}/${G.contest.need})`), done: G.contest.sprung }); break;
        case 'blazons': { const n = G.blazons.filter((b) => b.cap).length; out.push({ text: (tx || 'Take the blazon points') + ` (${n}/${G.blazons.length})`, done: n === G.blazons.length }); break; }
        case 'defend': { const D = G.def; out.push({ text: (tx || 'Hold the camp fire') + ` · wave ${Math.min(D.wi, D.waves.length)}/${D.waves.length} · ${D.reached}/${D.max} through`, done: game.defenseDone() }); break; }
        case 'gold': out.push({ text: (tx || 'Rob them of £' + o.n) + ` (£${G.stats.gold}/${o.n})`, done: G.stats.gold >= o.n, instant: true }); break;
        case 'deliver': out.push({ text: tx || 'Deliver the letter', done: !!(G.chest && G.chest.done) }); break;
        case 'noalarm': out.push({ text: tx || 'Don\u2019t raise the alarm', done: !G.alarmed, neg: true }); break;
        case 'nokill': out.push({ text: tx || 'Kill no one', done: G.stats.kills === 0, neg: true }); break;
      }
    }
    if (G.captive) out.push({ text: G.captive.freed ? G.captive.def.short + ' has joined the band' : 'Optional: free the captive', done: G.captive.freed, opt: true });
    if (G.treasure && G.objs.length) out.push({ text: G.treasure.taken ? G.treasure.name + ' found' : 'Optional: find the hidden treasure', done: G.treasure.taken, opt: true });
    if (G.objs.some((o) => o.k === 'exit')) out.push({ text: G.chest && !G.chest.done && G.chest.taken ? 'Bring the chest to the exit' : (G.kind === 'base' ? 'Walk out of camp when you\u2019re done' : 'Everyone back to the exit'), done: false, last: true, ready: true });
    return out;
  };

  function checkEnd(dt) {
    if (G.over) return;
    if (G.failPending) { G.failPending.t -= dt; if (G.failPending.t <= 0) return end(false, G.failPending.reason); }
    const fighters = G.heroes.filter((h) => !h.npc);
    if (fighters.length && fighters.every((h) => h.down)) return end(false, 'The whole band has fallen.');
    const objs = game.objectives();
    const main = objs.filter((o) => !o.last && !o.neg && !o.opt);
    const mainDone = main.every((o) => o.done);
    G.exitReady = mainDone;
    if (!mainDone) return;
    if (main.some((o) => o.instant)) return end(true);
    if (!objs.some((o) => o.last)) { if (main.length) end(true); return; }
    const standing = G.heroes.filter((h) => !h.down);
    if (!standing.every((h) => inExit(h.x, h.y))) return;
    if (G.chest && G.chest.taken && !G.chest.done && !(G.chest.carrier ? inExit(G.chest.carrier.x, G.chest.carrier.y) : inExit(G.chest.x, G.chest.y))) return;
    end(true);
  }

  function end(win, reason) {
    const st = G.stats;
    st.time = G.time;
    const stars = win ? 1 + (!st.spotted && !st.alarm ? 1 : 0) + (st.kills === 0 ? 1 : 0) : 0;
    G.over = { win, reason, stars, stats: st };
    sfx(win ? 'win' : 'lose');
    RH.ui && RH.ui.onEnd(G.over);
  }
  game.forceEnd = end;

  // ---------- Tips ----------
  function updTips() {
    if (!G.tipList || !G.tipList.length || (RH.ui && RH.ui.tipShowing())) return;
    const nearGuard = (r) => G.heroes.some((h) => !h.down && G.guards.some((g) => active(g) && d2(g, h) < (r * TILE) ** 2));
    const nearE = (e, r) => e && G.heroes.some((h) => !h.down && d2(h, e) < (r * TILE) ** 2);
    for (let i = 0; i < G.tipList.length; i++) {
      const t = G.tipList[i];
      let ok = false;
      switch (t.when) {
        case 'start': ok = true; break;
        case 'nearGuard': ok = nearGuard(9); break;
        case 'nearGuard2': ok = G.tipsShown.cone && nearGuard(5.5); break;
        case 'firstKO': ok = G.stats.ko > 0; break;
        case 'firstTie': ok = G.stats.tied > 0; break;
        case 'nearPrisoner': ok = G.prisoners.some((p) => !p.freed && nearE(p, 5)); break;
        case 'freed': ok = G.prisoners.length && G.prisoners.every((p) => p.freed); break;
        case 'nearChest': ok = G.chest && !G.chest.taken && nearE(G.chest, 5); break;
        case 'nearBeggar': ok = G.beggars.some((b) => visible(b) && nearE(b, 5)); break;
        case 'nearProp': ok = G.props.some((p) => !p.used && nearE(p, 5)); break;
        case 'sprung': ok = G.contest && G.contest.sprung; break;
        default:
          if (t.when.startsWith('time')) ok = G.time > +t.when.slice(4);
          else if (t.when.startsWith('met:')) { const c = byId(G.contacts, t.when.slice(4)); ok = c && c.met; }
          else if (t.when.startsWith('used:')) { const p = byId(G.props, t.when.slice(5)); ok = p && p.used; }
      }
      if (ok) {
        G.tipList.splice(i, 1);
        G.tipsShown[t.id] = true;
        RH.ui && RH.ui.tip(t.text);
        return;
      }
    }
  }

  // ---------- Main step ----------
  game.update = function (dt) {
    if (!G.m || G.over) return;
    G.time += dt;
    if (G.alarmT > 0) G.alarmT -= dt;
    if (G.cdMarian > 0) G.cdMarian -= dt;
    if (G.cdTuck > 0) G.cdTuck -= dt;
    for (const h of G.heroes) updHero(h, dt);
    for (const a of G.allies) updAlly(a, dt);
    for (const g of G.guards) updGuard(g, dt);
    for (const c of G.civs) updCiv(c, dt);
    updCart(dt);
    updProjs(dt);
    updDefense(dt);
    updBlazons(dt);
    updListen(dt);
    for (let i = G.fx.length - 1; i >= 0; i--) { const f = G.fx[i]; f.t += dt; if (f.t >= f.life) G.fx.splice(i, 1); }
    for (let i = G.coins.length - 1; i >= 0; i--) { const c = G.coins[i]; if (c.t != null) { c.t -= dt; if (c.t <= 0) c.gone = true; } if (c.gone) G.coins.splice(i, 1); }
    updTips();
    checkEnd(dt);
    RH.audio.ambient(dt, G.night);
  };

  game.computeCone = function (g) {
    const R = guardRange(g);
    g.coneR = R;
    const half = g.fov / 2;
    for (let i = 0; i < NRAYS; i++) {
      const a = g.dir - half + (g.fov * i) / (NRAYS - 1);
      g.cone[i] = RH.rayDist(G.grid, g.x, g.y - 4, a, R);
    }
  };
})(window.RH);
