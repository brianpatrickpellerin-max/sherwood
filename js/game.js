// Core simulation: world setup, heroes, guard AI, abilities, objectives.
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

  function mkUnit(kind, tx, ty) {
    return {
      id: uid++, kind, x: tcx(tx), y: tcx(ty), dir: S, path: null, pi: 0, moving: false, anim: 0,
      hp: 1, maxhp: 1, atkCd: 0, repathT: 0, flash: 0, bob: Math.random() * 6,
    };
  }

  // ---------- Mission setup ----------
  game.start = function (idx) {
    const m = RH.MISSIONS[idx];
    const P = RH.profile;
    for (const k of Object.keys(G)) delete G[k];
    const grid = RH.makeGrid(m.map);
    const night = !!m.night;
    Object.assign(G, {
      idx, m, grid, night, time: 0, runId: Math.random(), exitReady: false, paused: false, speed: 1,
      heroes: [], guards: [], civs: [], projs: [], fx: [], coins: [], gold: [],
      sel: [], mode: null, over: null, failPending: null, alarmT: 0, alarmed: false, reinforced: false,
      stats: { ko: 0, kills: 0, tied: 0, gold: 0, spotted: false, alarm: false },
      inv: {
        arrows: P.arrows, potions: P.potions,
        hives: 2 + (P.up.pouch ? 1 : 0), purses: 2 + (P.up.pouch ? 1 : 0),
      },
      tipsShown: {}, tipQ: [], torches: (m.torches || []).map(([x, y]) => ({ x: tcx(x), y: tcx(y) })),
      exit: m.exit, prisoner: null, chest: null, cart: null, sheriff: null, log: null,
      bowRange: (P.up.yew ? 12 : 9) * TILE, sneakMul: P.up.boots ? 0.27 : 0.4,
      cdMarian: 0, cdTuck: 0,
    });
    // Heroes
    for (const key of Object.keys(m.heroes)) {
      const [tx, ty] = m.heroes[key];
      G.heroes.push(mkHero(key, tx, ty));
    }
    // Prisoner
    if (m.prisoner) {
      G.prisoner = { key: m.prisoner.id, x: tcx(m.prisoner.x), y: tcx(m.prisoner.y), freed: false, tx: m.prisoner.x, ty: m.prisoner.y };
    }
    if (m.chest) G.chest = { x: tcx(m.chest.x), y: tcx(m.chest.y), carrier: null, onCart: false, taken: false };
    // Guards
    m.guards.forEach((gd) => {
      let g;
      if (gd.escort) {
        g = mkGuard(Math.floor(m.convoy.path[0][0] + gd.escort[0]), Math.max(0, Math.floor(m.convoy.path[0][1] + gd.escort[1])));
        g.escort = gd.escort;
        g.route = [{ x: g.x, y: g.y, wait: 0, dir: S }];
        g.looks = [S, S - 0.8, S, S + 0.8];
      } else {
        g = mkGuard(gd.route[0][0], gd.route[0][1]);
        g.route = gd.route.map((r) => ({ tx: r[0], ty: r[1], x: tcx(r[0]), y: tcx(r[1]), wait: r[2] || 0, dir: r[3] }));
        g.looks = gd.looks || null;
        if (g.looks) g.dir = g.looks[0];
        else if (g.route.length > 1) g.dir = Math.atan2(g.route[1].y - g.route[0].y, g.route[1].x - g.route[0].x);
        if (g.route[0].dir != null) g.dir = g.route[0].dir;
      }
      g.faceTo = g.dir;
      G.guards.push(g);
    });
    if (m.sheriff) {
      const s = mkGuard(m.sheriff.x, m.sheriff.y);
      s.sheriff = true; s.hp = s.maxhp = 10; s.dmg = 2; s.chase = 2.1 * TILE;
      s.route = [{ tx: m.sheriff.x, ty: m.sheriff.y, x: s.x, y: s.y, wait: 0 }];
      s.looks = [S, S - 0.5, S + 0.5]; s.dir = S; s.faceTo = S;
      G.sheriff = s; G.guards.push(s);
    }
    // Civilians
    (m.civilians || []).forEach(([x, y], i) => {
      const c = mkUnit('civ', x, y);
      c.home = { x, y }; c.wait = 1 + i; c.speedV = 1.1 * TILE; c.look = i;
      G.civs.push(c);
    });
    // Convoy
    if (m.convoy) {
      const cv = m.convoy;
      G.cart = { x: cv.path[0][0] * TILE, y: cv.path[0][1] * TILE, dir: S, pi: 1, state: 'moving', waitT: 0, speed: cv.speed * TILE, chest: true, wheel: 0 };
      const c = mkUnit('civ', 7, 0);
      c.carter = true; c.hp = c.maxhp = 2; c.state = 'ok';
      G.cart.carter = c; G.civs.push(c);
      G.chest = { x: G.cart.x, y: G.cart.y, carrier: null, onCart: true, taken: false };
      G.log = { x: cv.path[cv.logStop][0] * TILE, y: cv.path[cv.logStop][1] * TILE + TILE * 1.2 };
    }
    // Gold
    (m.gold || []).forEach(([x, y, v]) => G.gold.push({ x: tcx(x), y: tcx(y), v, taken: false }));
    G.cam = { x: 0, y: 0, z: 1 };
    // queue start tips
    G.tipList = (m.tips || []).slice();
    G.sel = [G.heroes[0]];
    return G;
  };

  function mkHero(key, tx, ty) {
    const d = RH.HEROES[key];
    const h = mkUnit('hero', tx, ty);
    h.key = key; h.def = d; h.name = d.name;
    h.maxhp = d.hp + (RH.profile.up.jerkin && !d.npc ? 2 : 0); h.hp = h.maxhp;
    h.spd = d.speed * TILE; h.sneak = false; h.task = null; h.busy = 0; h.carry = null; h.down = false;
    h.dmg = d.dmg; h.npc = !!d.npc; h.dir = N; h.bowT = 0; h.hurtT = 0;
    return h;
  }
  function mkGuard(tx, ty) {
    const g = mkUnit('guard', tx, ty);
    g.state = 'patrol'; g.sus = 0; g.target = null; g.ri = 0; g.wait = 0; g.lookI = 0; g.lookT = 2 + Math.random() * 2;
    g.hp = g.maxhp = 4; g.dmg = 1; g.walk = 1.35 * TILE; g.chase = 2.45 * TILE;
    g.fov = 1.45; g.cone = new Float32Array(NRAYS); g.coneR = 0;
    g.koT = 0; g.tied = false; g.carried = false; g.found = false; g.lostT = 0; g.searchT = 0;
    g.lx = g.x; g.ly = g.y; g.icon = ''; g.iconT = 0; g.stateT = 0;
    return g;
  }
  game.NRAYS = NRAYS;

  // ---------- Helpers ----------
  const active = (g) => g.state !== 'ko' && g.state !== 'dead' && !g.carried;
  game.isActive = active;
  const isBody = (g) => (g.state === 'ko' || g.state === 'dead') && !g.carried;
  game.isBody = isBody;

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

  // Move along path; returns true when finished.
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
    if (h.carry) s *= (h.key === 'john' ? 0.85 : 0.55);
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
    let r = G.night ? 4.6 * TILE : 7 * TILE;
    if (g.state === 'alert') r *= 1.25;
    return r;
  }
  game.guardRange = guardRange;

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
    for (const g of G.guards) { if (g.carried) continue; test(g, g.x, g.y - (isBody(g) ? 0 : 10), isBody(g) ? 'body' : 'guard'); }
    if (G.prisoner && !G.prisoner.freed) test(G.prisoner, G.prisoner.x, G.prisoner.y - 8, 'prisoner');
    if (G.chest && !G.chest.carrier && !G.chest.onCart) test(G.chest, G.chest.x, G.chest.y, 'chest');
    if (G.cart && G.cart.chest) test(G.cart, G.cart.x, G.cart.y, 'cart');
    if (G.cart) { const c = G.cart.carter; if (c.state === 'ok') test(c, c.x, c.y - 10, 'carter'); }
    return best;
  };

  // Default action when tapping an entity
  game.defaultAction = function (hit, h) {
    if (!hit) return null;
    const e = hit.e;
    switch (hit.kind) {
      case 'guard': return (e.state === 'alert' && !(h && h.key === 'john' && false)) ? 'attack' : 'ko';
      case 'body': return (e.state === 'ko' && !e.tied) ? 'tie' : 'carry';
      case 'prisoner': return 'free';
      case 'chest': return 'loot';
      case 'cart': return 'loot';
      case 'carter': return 'ko';
    }
    return null;
  };

  // Context actions list for long-press
  game.contextActions = function (hit, h) {
    const out = [];
    if (!hit || !h || h.down) return out;
    const e = hit.e, k = h.key;
    if (hit.kind === 'guard') {
      if (e.state !== 'alert' && !h.npc) out.push({ id: 'ko', label: '👊 Knock out' });
      if (!h.npc) out.push({ id: 'attack', label: '⚔️ Attack' });
      if (k === 'robin') out.push({ id: 'shoot', label: `🏹 Shoot (${G.inv.arrows})` });
      if (k === 'marian' && e.state !== 'alert') out.push({ id: 'charm', label: '🌹 Charm' });
    } else if (hit.kind === 'body') {
      if (e.state === 'ko' && !e.tied) out.push({ id: 'tie', label: '🪢 Tie up' });
      if (!h.carry) out.push({ id: 'carry', label: '🧺 Pick up & carry' });
    } else if (hit.kind === 'prisoner') out.push({ id: 'free', label: '🔓 Cut loose' });
    else if (hit.kind === 'chest' || hit.kind === 'cart') out.push({ id: 'loot', label: '💰 Take the chest' });
    else if (hit.kind === 'carter') out.push({ id: 'ko', label: '👊 Knock out' });
    return out;
  };

  function canDo(h, type) {
    if (h.down) return false;
    if (h.npc) return type === 'move' || type === 'loot' || type === 'carry';
    return true;
  }

  // Issue an action for the best-suited selected hero.
  game.orderAction = function (type, hit, heroes) {
    heroes = (heroes || G.sel).filter((h) => canDo(h, type));
    if (!heroes.length || !hit) return false;
    let best = null, bd = 1e12;
    for (const h of heroes) {
      if (type === 'shoot' && h.key !== 'robin') continue;
      if (type === 'charm' && h.key !== 'marian') continue;
      if (type === 'heal' && h.key !== 'tuck') continue;
      if ((type === 'carry' || type === 'loot') && h.carry) continue;
      const d = (h.x - hit.e.x) ** 2 + (h.y - hit.e.y) ** 2;
      const pref = (type === 'carry' && h.key === 'john') ? 0.3 : 1;
      if (d * pref < bd) { bd = d * pref; best = h; }
    }
    if (!best) return false;
    best.task = { type, target: hit.e, kind: hit.kind, t: 0 };
    best.path = null; best.repathT = 0;
    if (type === 'attack') {
      // whole selection joins the fight
      for (const h of heroes) if (h !== best && !h.npc && !h.carry) { h.task = { type: 'attack', target: hit.e, kind: hit.kind, t: 0 }; h.path = null; h.repathT = 0; }
    }
    sfx('move');
    return true;
  };

  game.moveSel = function (wx, wy) {
    const heroes = G.sel.filter((h) => !h.down);
    if (!heroes.length) return false;
    const g = G.grid;
    let tx = tileOf(wx), ty = tileOf(wy);
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

  game.groundAbility = function (type, wx, wy) {
    const key = type === 'hive' ? 'tuck' : 'scarlet';
    const h = G.sel.find((x) => x.key === key && !x.down) || G.heroes.find((x) => x.key === key && !x.down);
    if (!h) return false;
    if (type === 'hive' && G.inv.hives <= 0) { toast('No beehives left'); return false; }
    if (type === 'purse' && G.inv.purses <= 0) { toast('No purses left'); return false; }
    h.task = { type: 'throw', item: type, x: wx, y: wy, t: 0 };
    h.path = null; h.repathT = 0;
    return true;
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

  // ---------- Hero update ----------
  function inRange(h, x, y, r) { return (h.x - x) ** 2 + (h.y - y) ** 2 <= r * r; }

  function approach(h, x, y, dt) {
    h.repathT -= dt;
    if (!h.path || h.repathT <= 0) {
      h.repathT = 0.5;
      if (!setPath(h, tileOf(x), tileOf(y))) { h.task = null; return; }
    }
    follow(h, heroSpeed(h), dt);
    if (!h.path) { // reached tile but not in range: step directly
      const dx = x - h.x, dy = y - h.y, d = Math.hypot(dx, dy);
      if (d > 2) { const s = Math.min(d, heroSpeed(h) * dt); h.x += dx / d * s; h.y += dy / d * s; h.dir = Math.atan2(dy, dx); h.moving = true; }
    }
  }

  function updHero(h, dt) {
    h.atkCd -= dt; h.bowT -= dt; h.hurtT -= dt; if (h.flash > 0) h.flash -= dt;
    if (h.down) { h.moving = false; return; }
    // carry follows
    if (h.carry && h.carry !== 'chest') { h.carry.x = h.x; h.carry.y = h.y; }
    if (h.carry === 'chest') { G.chest.x = h.x; G.chest.y = h.y; }
    // gold pickup
    for (const c of G.gold) if (!c.taken && inRange(h, c.x, c.y, TILE * 0.7)) {
      c.taken = true; G.stats.gold += c.v; fx('text', c.x, c.y - 20, '+' + c.v, '#ffd84a'); sfx('coin');
    }
    if (h.busy > 0) { h.busy -= dt; h.moving = false; if (h.busy <= 0) finishBusy(h); return; }
    const t = h.task;
    if (!t) {
      h.moving = false;
      // auto-defend
      if (!h.npc) for (const g of G.guards) if (g.state === 'alert' && active(g) && inRange(h, g.x, g.y, TILE * 1.1)) { h.task = { type: 'attack', target: g, kind: 'guard', t: 0 }; break; }
      return;
    }
    if (t.type === 'move') { if (follow(h, heroSpeed(h), dt)) h.task = null; return; }
    const e = t.target;
    switch (t.type) {
      case 'ko': {
        if (!e || (e.kind === 'guard' && !active(e)) || (e.carter && e.state !== 'ok')) { h.task = null; return; }
        if (!inRange(h, e.x, e.y, TILE * 0.95)) { approach(h, e.x, e.y, dt); return; }
        h.path = null; h.moving = false; h.dir = Math.atan2(e.y - h.y, e.x - h.x);
        if (e.carter) { e.state = 'ko'; e.koT = 999; G.stats.ko++; fx('stars', e.x, e.y - 24); sfx('ko'); h.task = null; return; }
        if (e.state === 'alert' && !(h.key === 'john' && e.sus < 1.5 && false)) { t.type = 'attack'; return; }
        knockOut(e, h.key === 'john' ? 55 : 35);
        h.busy = 0.35; h.task = null; h.punchT = 0.35;
        return;
      }
      case 'attack': {
        if (!e || !active(e)) { h.task = null; return; }
        if (!inRange(h, e.x, e.y, TILE * 0.95)) { approach(h, e.x, e.y, dt); return; }
        h.path = null; h.moving = false; h.dir = Math.atan2(e.y - h.y, e.x - h.x);
        if (h.atkCd <= 0) {
          h.atkCd = 0.75; h.swingT = 0.25;
          if (e.state !== 'alert' && e.state !== 'stunned') {
            // surprised guard fights back
            spot(e, h, true);
          }
          e.hp -= h.dmg; e.flash = 0.15; sfx('clang');
          fx('spark', (e.x + h.x) / 2, (e.y + h.y) / 2 - 12);
          if (e.hp <= 0) defeat(e, h.def.weapon !== 'staff');
        }
        return;
      }
      case 'tie': {
        if (!e || e.state !== 'ko' || e.tied || e.carried) { h.task = null; return; }
        if (!inRange(h, e.x, e.y, TILE * 0.9)) { approach(h, e.x, e.y, dt); return; }
        h.path = null; h.busy = 1.0; h.busyType = 'tie'; h.busyTarget = e; h.task = null; sfx('tie');
        return;
      }
      case 'carry': {
        if (!e || !isBody(e) || h.carry) { h.task = null; return; }
        if (!inRange(h, e.x, e.y, TILE * 0.9)) { approach(h, e.x, e.y, dt); return; }
        h.path = null; e.carried = true; e.carrier = h; h.carry = e; h.task = null; h.busy = 0.3; sfx('ko');
        return;
      }
      case 'free': {
        const p = G.prisoner;
        if (!p || p.freed) { h.task = null; return; }
        if (!inRange(h, p.x, p.y, TILE * 1.25)) { approach(h, p.x, p.y, dt); return; }
        h.path = null; h.busy = 1.4; h.busyType = 'free'; h.task = null; sfx('tie');
        return;
      }
      case 'loot': {
        const c = G.chest;
        if (!c || c.carrier || h.carry) { h.task = null; return; }
        const tx = c.onCart ? G.cart.x : c.x, ty = c.onCart ? G.cart.y : c.y;
        if (!inRange(h, tx, ty, TILE * (c.onCart ? 1.5 : 0.9))) { approach(h, tx, ty, dt); return; }
        if (c.onCart && G.cart.state === 'moving') { if (!t.warned) { toast('The cart is still moving! Knock out the carter first.'); t.warned = true; } approach(h, tx, ty, dt); return; }
        h.path = null; h.busy = c.onCart ? 1.5 : 0.8; h.busyType = 'loot'; h.task = null; sfx('coin');
        return;
      }
      case 'heal': {
        if (!e || h.key !== 'tuck') { h.task = null; return; }
        if (G.cdTuck > 0 && e !== h) { toast('Tuck needs a moment to catch his breath'); h.task = null; return; }
        if (!inRange(h, e.x, e.y, TILE * 1.1)) { approach(h, e.x, e.y, dt); return; }
        h.path = null; h.busy = 1.2; h.busyType = 'heal'; h.busyTarget = e; h.task = null;
        return;
      }
      case 'shoot': {
        if (!e || !active(e)) { h.task = null; return; }
        if (G.inv.arrows <= 0) { toast('Out of arrows! Buy more at camp.'); h.task = null; return; }
        if (!inRange(h, e.x, e.y, G.bowRange) || !RH.los(G.grid, h.x, h.y - 10, e.x, e.y - 10)) { approach(h, e.x, e.y, dt); return; }
        h.path = null; h.moving = false; h.dir = Math.atan2(e.y - h.y, e.x - h.x);
        if (!t.draw) { t.draw = 0.45; h.drawT = 0.45; return; }
        t.draw -= dt; h.drawT = t.draw;
        if (t.draw <= 0) {
          G.inv.arrows--; h.drawT = 0;
          G.projs.push({ kind: 'arrow', x: h.x, y: h.y - 14, target: e, from: h, t: 0, sx: h.x, sy: h.y - 14 });
          sfx('bow'); h.task = null;
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
        const range = (t.item === 'hive' ? 6 : 7) * TILE;
        if (!inRange(h, t.x, t.y, range) || !RH.los(G.grid, h.x, h.y, t.x, t.y)) { approach(h, t.x, t.y, dt); return; }
        h.path = null; h.moving = false; h.dir = Math.atan2(t.y - h.y, t.x - h.x);
        if (t.item === 'hive') G.inv.hives--; else G.inv.purses--;
        G.projs.push({ kind: t.item, sx: h.x, sy: h.y - 14, x: h.x, y: h.y, tx: t.x, ty: t.y, t: 0, dur: 0.6 });
        sfx('throw'); h.task = null; h.busy = 0.3;
        return;
      }
    }
  }

  function finishBusy(h) {
    const e = h.busyTarget;
    switch (h.busyType) {
      case 'tie':
        if (e && e.state === 'ko' && !e.carried) { e.tied = true; G.stats.tied++; fx('text', e.x, e.y - 20, 'Tied!', '#ffe08a'); }
        break;
      case 'free': freePrisoner(); break;
      case 'loot': {
        const c = G.chest;
        if (c && !c.carrier && !h.carry) {
          if (c.onCart) { c.onCart = false; G.cart.chest = false; }
          c.carrier = h; c.taken = true; h.carry = 'chest';
          fx('text', h.x, h.y - 34, 'Got the chest!', '#ffd84a', 1.5); sfx('coin');
        }
        break;
      }
      case 'heal':
        if (e) {
          if (e.down) { e.down = false; e.hp = Math.ceil(e.maxhp / 2); fx('text', e.x, e.y - 30, 'Back on your feet!', '#7dff7a', 1.4); }
          else { e.hp = e.maxhp; fx('text', e.x, e.y - 30, 'Healed', '#7dff7a'); }
          G.cdTuck = 10; sfx('heal');
        }
        break;
    }
    h.busyType = null; h.busyTarget = null;
  }

  function freePrisoner() {
    const p = G.prisoner;
    if (!p || p.freed) return;
    p.freed = true;
    const h = mkHero(p.key, p.tx, p.ty);
    h.x = p.x; h.y = p.y;
    G.heroes.push(h);
    fx('text', p.x, p.y - 34, p.key === 'tuck' ? 'Tuck is free!' : 'Hob is free!', '#9dff8a', 1.6);
    sfx('win');
    RH.ui && RH.ui.rosterChanged();
  }
  game.freePrisoner = freePrisoner;

  function heroHurt(h, d) {
    if (h.down) return;
    h.hp -= d; h.flash = 0.2;
    fx('text', h.x, h.y - 30, '-' + d, '#ff6a5a');
    if (h.hp <= 0) {
      h.hp = 0; h.down = true; h.task = null; h.path = null; h.busy = 0; h.sneak = false;
      if (h.carry) dropCarry(h);
      sfx('down'); toast(h.name + ' is down!', 'bad');
      if (h.npc) G.failPending = G.failPending || { t: 1.2, reason: h.name + ' was recaptured.' };
    }
  }

  // ---------- Guards ----------
  function knockOut(g, t) {
    g.state = 'ko'; g.koT = t; g.path = null; g.sus = 0; g.target = null; g.icon = ''; g.found = false;
    G.stats.ko++; sfx('ko'); fx('stars', g.x, g.y - 20);
  }
  game.knockOut = knockOut;
  function defeat(g, lethal) {
    if (g.sheriff || !lethal) { g.hp = 0; knockOut(g, 70); return; }
    g.state = 'dead'; g.path = null; g.icon = ''; g.found = false; g.target = null;
    G.stats.kills++; sfx('hit');
  }

  function raiseAlarm(x, y, why) {
    G.alarmT = 30;
    if (!G.alarmed) {
      G.alarmed = true; G.stats.alarm = true;
      sfx('alarm'); toast(why === 'body' ? 'A guard found a body — ALARM!' : (why === 'woke' ? 'A guard woke up — ALARM!' : 'ALARM!'), 'bad');
      if (G.m.alarmFail) G.failPending = G.failPending || { t: 1.6, reason: why === 'woke' ? 'A guard woke up and raised the alarm.' : (why === 'body' ? 'A guard found a body and raised the alarm.' : 'You were spotted. The alarm was raised.') };
      if (G.m.reinforce && !G.reinforced) {
        G.reinforced = true;
        for (const [tx, ty] of G.m.reinforce) {
          const g = mkGuard(tx, ty);
          g.route = [{ tx, ty, x: g.x, y: g.y, wait: 0 }]; g.looks = [S, S - 0.6, S + 0.6];
          g.state = 'investigate'; g.lx = x; g.ly = y; g.sus = 0.7; g.faceTo = g.dir;
          G.guards.push(g);
        }
        toast('Reinforcements are coming!', 'bad');
      }
    }
    for (const g of G.guards) {
      if (!active(g) || g.state === 'alert' || g.state === 'charmed' || g.state === 'stunned') continue;
      if ((g.x - x) ** 2 + (g.y - y) ** 2 < (10 * TILE) ** 2) {
        g.state = 'investigate'; g.lx = x; g.ly = y; g.path = null; g.sus = Math.max(g.sus, 0.6); g.icon = '?'; g.iconT = 3;
      }
    }
  }
  game.raiseAlarm = raiseAlarm;

  function spot(g, h, silentToast) {
    if (g.state === 'alert') { g.target = h; return; }
    g.state = 'alert'; g.target = h; g.sus = 1; g.icon = '!'; g.iconT = 2.5; g.path = null; g.lostT = 0;
    g.lx = h.x; g.ly = h.y;
    G.stats.spotted = true;
    sfx('alert');
    if (!silentToast) toast(`Spotted! ${h.name} has been seen!`, 'bad');
    // call nearby guards
    for (const o of G.guards) {
      if (o === g || !active(o) || o.state === 'alert' || o.state === 'stunned') continue;
      if ((o.x - g.x) ** 2 + (o.y - g.y) ** 2 < (8 * TILE) ** 2) {
        o.state = 'alert'; o.target = h; o.sus = 1; o.icon = '!'; o.iconT = 2; o.path = null; o.lx = h.x; o.ly = h.y; o.lostT = 0;
      }
    }
    raiseAlarm(g.x, g.y, 'spotted');
  }
  game.spot = spot;

  function wake(g) {
    g.state = 'search'; g.searchT = 10; g.sus = 0.8; g.lx = g.x; g.ly = g.y; g.icon = '?'; g.iconT = 3;
    g.hp = Math.max(g.hp, 2);
    fx('text', g.x, g.y - 30, '!?', '#ffcf5a');
    raiseAlarm(g.x, g.y, 'woke');
  }

  function canSeePoint(g, x, y, R) {
    const dx = x - g.x, dy = y - g.y, d2 = dx * dx + dy * dy;
    if (d2 > R * R) return false;
    const d = Math.sqrt(d2);
    if (d > TILE * 0.8 && Math.abs(RH.angDiff(g.dir, Math.atan2(dy, dx))) > g.fov / 2) return false;
    return RH.los(G.grid, g.x, g.y - 8, x, y - 6);
  }

  function vision(g, dt) {
    const st = g.state;
    if (st === 'charmed' || st === 'counting' || st === 'stunned') { g.seeing = null; return; }
    const R0 = guardRange(g);
    let best = 0, bh = null;
    for (const h of G.heroes) {
      if (h.down) continue;
      let R = R0;
      if (G.night && litAt(h.x, h.y)) R = 7.5 * TILE;
      const dx = h.x - g.x, dy = h.y - g.y, d2 = dx * dx + dy * dy;
      if (d2 > R * R) continue;
      const d = Math.sqrt(d2);
      if (RH.hideAt(G.grid, h.x, h.y) && d > 1.5 * TILE && st !== 'alert') continue;
      if (!canSeePoint(g, h.x, h.y, R)) continue;
      const k = 1 - d / R;
      let rate = 0.65 + 3.4 * k * k;
      if (h.sneak) rate *= G.sneakMul;
      if (!h.moving) rate *= 0.75;
      if (st === 'search' || st === 'investigate') rate *= 1.6;
      if (G.alarmT > 0) rate *= 1.3;
      if (d < 1.2 * TILE) rate = 6;
      if (rate > best) { best = rate; bh = h; }
    }
    g.seeing = bh;
    if (st === 'alert') {
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
    } else {
      g.sus = Math.max(0, g.sus - 0.16 * dt);
    }
    // bodies
    for (const b of G.guards) {
      if (b === g || b.found || !isBody(b)) continue;
      if (RH.hideAt(G.grid, b.x, b.y)) continue;
      if (!canSeePoint(g, b.x, b.y, R0 * 0.9)) continue;
      b.found = true;
      g.state = 'investigate'; g.lx = b.x; g.ly = b.y; g.path = null; g.icon = '!'; g.iconT = 2;
      fx('text', g.x, g.y - 40, 'A body!', '#ff8a6a', 1.4);
      raiseAlarm(b.x, b.y, 'body');
      break;
    }
  }

  function resumePatrol(g) {
    g.state = 'patrol'; g.path = null; g.icon = ''; g.target = null; g.sus = Math.min(g.sus, 0.2);
  }

  function updGuard(g, dt) {
    g.atkCd -= dt; if (g.flash > 0) g.flash -= dt;
    if (g.iconT > 0) { g.iconT -= dt; if (g.iconT <= 0) g.icon = ''; }
    if (g.state === 'dead' || g.carried) return;
    if (g.state === 'ko') {
      if (!g.tied) { g.koT -= dt; if (g.koT <= 0) wake(g); }
      return;
    }
    if (g.state === 'stunned') { g.stateT -= dt; g.dir += dt * 6; if (g.stateT <= 0) { g.state = 'search'; g.searchT = 6; g.sus = 0.7; g.lx = g.x; g.ly = g.y; } return; }
    vision(g, dt);
    const st = g.state;
    switch (st) {
      case 'patrol': patrol(g, dt); break;
      case 'look': {
        g.stateT += dt;
        g.dir = RH.turnToward(g.dir, Math.atan2(g.ly - g.y, g.lx - g.x), 4 * dt);
        if (g.sus <= 0.02 || g.stateT > 6) resumePatrol(g);
        break;
      }
      case 'investigate': {
        if (!g.path) {
          if ((g.x - g.lx) ** 2 + (g.y - g.ly) ** 2 < (TILE * 1.2) ** 2 || !setPath(g, tileOf(g.lx), tileOf(g.ly))) {
            g.state = 'search'; g.searchT = 7; g.path = null; break;
          }
        }
        if (follow(g, g.walk * 1.25, dt, 7)) { g.state = 'search'; g.searchT = 7; }
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
      case 'alert': {
        const t = g.target;
        if (!t || t.down || g.lostT > 5) {
          // look for another hero we can see
          if (g.seeing) { g.target = g.seeing; break; }
          g.state = 'search'; g.searchT = 10; g.path = null; g.icon = '?'; g.iconT = 3; g.target = null; break;
        }
        const d2 = (t.x - g.x) ** 2 + (t.y - g.y) ** 2;
        if (d2 < (TILE * 0.9) ** 2) {
          g.path = null; g.moving = false;
          g.dir = Math.atan2(t.y - g.y, t.x - g.x);
          if (g.atkCd <= 0) {
            g.atkCd = g.sheriff ? 0.9 : 1.15; g.swingT = 0.25;
            heroHurt(t, g.dmg); sfx('clang');
          }
        } else {
          g.repathT -= dt;
          if (!g.path || g.repathT <= 0) { g.repathT = 0.45; setPath(g, tileOf(g.lostT > 0 ? g.lx : t.x), tileOf(g.lostT > 0 ? g.ly : t.y)); }
          if (follow(g, g.chase, dt, 10) && d2 > (TILE * 0.9) ** 2) {
            const dx = t.x - g.x, dy = t.y - g.y, d = Math.sqrt(d2);
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
        if (g.stateT <= 0 || !m || m.down || (m.x - g.x) ** 2 + (m.y - g.y) ** 2 > (7 * TILE) ** 2) { resumePatrol(g); g.sus = 0; }
        break;
      }
      case 'lured': {
        const c = g.coin;
        if (!c || c.gone) { resumePatrol(g); break; }
        if (!g.path && (g.x - c.x) ** 2 + (g.y - c.y) ** 2 > (TILE * 0.8) ** 2) { if (!setPath(g, tileOf(c.x), tileOf(c.y))) { resumePatrol(g); break; } }
        if (follow(g, g.walk * 1.3, dt, 7) || (g.x - c.x) ** 2 + (g.y - c.y) ** 2 < (TILE * 0.8) ** 2) {
          g.path = null; g.state = 'counting'; g.stateT = 6; g.icon = '$'; g.iconT = 6;
          g.dir = Math.atan2(c.y - g.y, c.x - g.x) + Math.PI * 0.15;
        }
        break;
      }
      case 'counting': {
        g.stateT -= dt; g.moving = false;
        if (g.stateT <= 0) { if (g.coin) g.coin.gone = true; g.coin = null; resumePatrol(g); }
        break;
      }
    }
  }

  function patrol(g, dt) {
    if (g.escort && G.cart) return escortMove(g, dt);
    const r = g.route;
    const wp = r[g.ri % r.length];
    if (g.wait > 0) {
      g.wait -= dt; g.moving = false;
      lookCycle(g, dt);
      return;
    }
    const atWp = (g.x - wp.x) ** 2 + (g.y - wp.y) ** 2 < 4;
    if (atWp) {
      g.path = null; g.moving = false;
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
      g.moving = s > 0.05;
      g.anim += dt * 4;
    } else g.moving = false;
    if (c.state === 'moving') {
      g.lookT -= dt;
      if (g.lookT <= 0) { g.lookI = (g.lookI + 1) % g.looks.length; g.lookT = 2.5; }
      g.dir = RH.turnToward(g.dir, g.looks[g.lookI], 2 * dt);
    } else {
      // at the log: watch the trees on each side
      const out = g.escort[0] < -0.5 ? Math.PI : g.escort[0] > 0.5 ? 0 : N;
      g.lookT -= dt;
      if (g.lookT <= 0) { g.lookI = (g.lookI + 1) % 3; g.lookT = 2.6; }
      g.dir = RH.turnToward(g.dir, out + (g.lookI - 1) * 0.6, 2 * dt);
    }
  }

  // ---------- Civilians & convoy ----------
  function updCiv(c, dt) {
    if (c.carter) {
      if (c.state !== 'ok') { if (c.carriedBy) { c.x = c.carriedBy.x; c.y = c.carriedBy.y; } return; }
      const cart = G.cart;
      c.x = cart.x - TILE * 0.95; c.y = cart.y + 4; c.dir = cart.dir;
      c.moving = cart.state === 'moving'; if (c.moving) c.anim += dt * 4;
      return;
    }
    if (c.path) { follow(c, c.speedV, dt); return; }
    c.wait -= dt; c.moving = false;
    if (c.wait <= 0) {
      c.wait = 2 + Math.random() * 4;
      const tx = c.home.x + Math.floor(Math.random() * 9) - 4, ty = c.home.y + Math.floor(Math.random() * 9) - 4;
      if (RH.isWalk(G.grid, tx, ty)) setPath(c, tx, ty);
    }
  }

  function updCart(dt) {
    const c = G.cart; if (!c) return;
    const cv = G.m.convoy;
    if (c.state === 'escaped' || c.state === 'stopped') return;
    if (c.carter.state !== 'ok') { c.state = 'stopped'; toast('The cart has stopped. Take the chest!', 'good'); return; }
    if (c.state === 'log') { c.waitT -= dt; if (c.waitT <= 0) { c.state = 'moving'; G.log.cleared = true; toast('The road is clear — the cart is moving again!'); } return; }
    const wp = cv.path[c.pi];
    const tx = wp[0] * TILE, ty = wp[1] * TILE;
    const dx = tx - c.x, dy = ty - c.y, d = Math.hypot(dx, dy);
    const sp = c.speed * (G.alarmed ? 1.7 : 1);
    c.wheel += sp * dt / 6;
    if (d <= sp * dt) {
      c.x = tx; c.y = ty;
      if (c.pi === cv.logStop && !G.log.cleared) { c.state = 'log'; c.waitT = cv.logWait; c.pi++; return; }
      c.pi++;
      if (c.pi >= cv.path.length) { c.state = 'escaped'; G.failPending = G.failPending || { t: 0.5, reason: 'The treasure cart got away.' }; }
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
      if (p.kind === 'arrow') {
        const e = p.target;
        const tx = e.x, ty = e.y - 12;
        const dx = tx - p.x, dy = ty - p.y, d = Math.hypot(dx, dy), s = 720 * dt;
        p.ang = Math.atan2(dy, dx);
        if (d <= s || p.t > 2) {
          G.projs.splice(i, 1);
          if (active(e)) {
            const unaware = e.state !== 'alert';
            e.hp -= unaware ? 4 : 2; e.flash = 0.2; sfx('hit');
            if (e.hp <= 0) defeat(e, true);
            else spot(e, p.from, true);
          }
          continue;
        }
        p.x += dx / d * s; p.y += dy / d * s;
      } else {
        const k = Math.min(1, p.t / p.dur);
        p.x = RH.lerp(p.sx, p.tx, k); p.y = RH.lerp(p.sy, p.ty, k); p.z = Math.sin(k * Math.PI) * 40;
        if (k >= 1) {
          G.projs.splice(i, 1);
          if (p.kind === 'hive') {
            sfx('buzz'); fx('bees', p.tx, p.ty, '', '#ffd23a', 2.5);
            for (const g of G.guards) if (active(g) && (g.x - p.tx) ** 2 + (g.y - p.ty) ** 2 < (1.8 * TILE) ** 2) {
              g.state = 'stunned'; g.stateT = 7; g.path = null; g.icon = '🐝'; g.iconT = 7; g.target = null; g.sus = 0;
            }
          } else {
            const coin = { x: p.tx, y: p.ty, gone: false };
            G.coins.push(coin); sfx('coin');
            for (const g of G.guards) {
              if (!active(g) || g.state === 'alert' || g.state === 'charmed' || g.state === 'stunned') continue;
              if ((g.x - p.tx) ** 2 + (g.y - p.ty) ** 2 < (6 * TILE) ** 2) {
                g.state = 'lured'; g.coin = coin; g.path = null; g.icon = '$'; g.iconT = 2; g.sus = 0;
              }
            }
          }
        }
      }
    }
  }

  // ---------- Objectives ----------
  const inExit = (x, y) => {
    const e = G.exit; const tx = x / TILE, ty = y / TILE;
    return tx >= e.x && tx < e.x + e.w && ty >= e.y && ty < e.y + e.h;
  };
  game.inExit = inExit;

  game.objectives = function () {
    const out = [];
    const m = G.m;
    let main = true;
    for (const o of m.objectives) {
      if (o === 'rescue') { const d = G.prisoner.freed; out.push({ text: G.prisoner.key === 'tuck' ? 'Free Friar Tuck' : 'Free Hob from the pen', done: d }); main = main && d; }
      if (o === 'steal') { const d = G.chest.taken; out.push({ text: 'Steal the tax chest', done: d }); main = main && d; }
      if (o === 'convoy') {
        const d = G.chest.taken, c = G.cart;
        const extra = d ? '' : c.state === 'log' ? ` (stopped: ${Math.ceil(c.waitT)}s)` : c.state === 'stopped' ? ' (cart stopped!)' : '';
        out.push({ text: 'Stop the cart, take its chest' + extra, done: d }); main = main && d;
      }
      if (o === 'sheriff') { const s = G.sheriff; const d = s.state === 'ko' && s.tied; out.push({ text: 'Knock out & tie up the Sheriff', done: d }); main = main && d; }
      if (o === 'noalarm') out.push({ text: 'Don\u2019t raise the alarm', done: !G.alarmed, neg: true });
    }
    if (m.objectives.includes('exit')) out.push({ text: G.chest ? 'Bring the chest to the exit' : 'Everyone back to the exit', done: false, last: true, ready: main });
    return out;
  };

  function checkEnd(dt) {
    if (G.over) return;
    if (G.failPending) { G.failPending.t -= dt; if (G.failPending.t <= 0) return end(false, G.failPending.reason); }
    const fighters = G.heroes.filter((h) => !h.npc);
    if (fighters.every((h) => h.down)) return end(false, 'The whole band has fallen.');
    const objs = game.objectives();
    const mainDone = objs.filter((o) => !o.last && !o.neg).every((o) => o.done);
    G.exitReady = mainDone;
    if (!mainDone) return;
    const standing = G.heroes.filter((h) => !h.down);
    if (!standing.every((h) => inExit(h.x, h.y))) return;
    if (G.chest && !(G.chest.carrier ? inExit(G.chest.carrier.x, G.chest.carrier.y) : inExit(G.chest.x, G.chest.y))) return;
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
    const nearGuard = (r) => G.heroes.some((h) => !h.down && G.guards.some((g) => active(g) && (g.x - h.x) ** 2 + (g.y - h.y) ** 2 < (r * TILE) ** 2));
    for (let i = 0; i < G.tipList.length; i++) {
      const t = G.tipList[i];
      let ok = false;
      switch (t.when) {
        case 'start': ok = true; break;
        case 'nearGuard': ok = nearGuard(9); break;
        case 'nearGuard2': ok = G.tipsShown.cone && nearGuard(5.5); break;
        case 'firstKO': ok = G.stats.ko > 0; break;
        case 'firstTie': ok = G.stats.tied > 0; break;
        case 'nearPrisoner': ok = G.prisoner && !G.prisoner.freed && G.heroes.some((h) => (h.x - G.prisoner.x) ** 2 + (h.y - G.prisoner.y) ** 2 < (5 * TILE) ** 2); break;
        case 'freed': ok = G.prisoner && G.prisoner.freed; break;
        case 'nearChest': ok = G.chest && !G.chest.taken && G.heroes.some((h) => (h.x - G.chest.x) ** 2 + (h.y - G.chest.y) ** 2 < (5 * TILE) ** 2); break;
        default: if (t.when.startsWith('time')) ok = G.time > +t.when.slice(4);
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
    for (const g of G.guards) updGuard(g, dt);
    for (const c of G.civs) updCiv(c, dt);
    updCart(dt);
    updProjs(dt);
    for (let i = G.fx.length - 1; i >= 0; i--) { const f = G.fx[i]; f.t += dt; if (f.t >= f.life) G.fx.splice(i, 1); }
    for (let i = G.coins.length - 1; i >= 0; i--) if (G.coins[i].gone) G.coins.splice(i, 1);
    updTips();
    checkEnd(dt);
    RH.audio.ambient(dt, G.night);
  };

  // View cone rays (computed for rendering)
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
