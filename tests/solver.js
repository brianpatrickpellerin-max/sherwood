// Test-only auto-player: wins a mission by driving the real game API (orders, swipes, throws),
// teleporting heroes next to their targets to keep runs short. Not shipped with the game.
(function () {
  const S = window.__sherwood, RH = S.RH, T = RH.TILE;
  const G = () => S.G;
  const game = RH.game;
  const tile = (v) => Math.floor(v / T);
  const log = [];
  function step(sec) { const n = Math.round(sec * 30); for (let i = 0; i < n && !G().over; i++) { if (window.__godmode) for (const h of G().heroes) if (h.down || h.hp < h.maxhp - 1) { h.down = false; h.hp = h.maxhp; } game.update(1 / 30); } }
  function free(tx, ty, avoid) {
    const g = G().grid;
    for (let r = 0; r < 4; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const x = tx + dx, y = ty + dy;
      if (RH.isWalk(g, x, y) && !(avoid && x === avoid[0] && y === avoid[1])) return [x, y];
    }
    const n = RH.nearestWalk(g, tx, ty); return [n % g.w, (n / g.w) | 0];
  }
  function place(h, x, y) { h.x = x; h.y = y; h.path = null; h.task = null; h.busy = 0; }
  function tpNear(h, e, behind) {
    let tx = tile(e.x), ty = tile(e.y);
    if (behind && e.dir != null) { tx = tile(e.x - Math.cos(e.dir) * T); ty = tile(e.y - Math.sin(e.dir) * T); }
    const [x, y] = free(tx, ty, [tile(e.x), tile(e.y)]);
    place(h, (x + 0.5) * T, (y + 0.5) * T);
  }
  const fighters = () => G().heroes.filter((h) => !h.down && !h.npc && !h.climbing);
  const nonLethal = () => fighters().find((h) => h.def.weapon !== 'sword' || h.staff) || fighters()[0];
  function heal() { for (const h of G().heroes) { if (h.down) { h.down = false; } h.hp = h.maxhp; } }
  function waitTask(h, sec) { for (let t = 0; t < sec && (h.task || h.busy > 0) && !G().over; t += 0.2) step(0.2); }

  function fight(e, useSwipes) {
    const nk = G().objs.some((o) => o.k === 'nokill');
    let h = nk ? nonLethal() : fighters()[0];
    if (useSwipes) h = fighters()[0];
    let guard = 0;
    while (game.isActive(e) && guard++ < 200 && !G().over) {
      if (h.down || h.hp < 3) { heal(); }
      tpNear(h, e, true);
      if (useSwipes || e.state === 'alert') {
        if (e.state !== 'alert') game.spot(e, h, true);
        const strokes = ['thrust', 'slash', 'parry', 'heavy', 'thrust'];
        const r = game.swipeStrike(e, strokes[guard % strokes.length], [h]);
        S.G.swipesUsed = (S.G.swipesUsed || 0) + (r ? 1 : 0);
        step(0.7);
      } else {
        game.orderAction('ko', { kind: 'guard', e }, [h]);
        waitTask(h, 3);
        step(0.2);
      }
    }
    if (game.isBody(e) && e.state === 'ko' && !e.tied) { const t = fighters()[0]; tpNear(t, e); game.orderAction('tie', { kind: 'body', e }, [t]); waitTask(t, 3); }
    return !game.isActive(e);
  }
  function koAll(filter) {
    for (const g of G().guards.slice()) if (game.isActive(g) && (!filter || filter(g)) && !g.boss && !g.sheriff) fight(g);
  }
  function exitAll() {
    const e = G().exit;
    const pts = []; for (let y = e.y; y < e.y + e.h; y++) for (let x = e.x; x < e.x + e.w; x++) if (RH.isWalk(G().grid, x, y)) pts.push([x, y]);
    G().heroes.forEach((h, i) => { if (h.down) { h.down = false; h.hp = 1; } const p = pts[i % pts.length]; place(h, (p[0] + 0.5) * T, (p[1] + 0.5) * T); });
    step(1.5);
  }
  function shootTarget(p) {
    const h = fighters().find((x) => game.has(x, 'bow'));
    if (!h) return false;
    tpNear(h, { x: p.x, y: p.y + 3 * T });
    if (p.contest) {
      // release when the swaying ring will be steady
      for (let k = 0; k < 400; k++) { const tt = G().time + 1 / 30 + 0.45 + 1 / 30; const sw = Math.sin(tt * 2.1) * 0.8 + Math.sin(tt * 5.3) * 0.35; if (Math.abs(sw) < 0.25) break; step(1 / 30); }
    }
    game.orderAction('shoot', { kind: 'prop', e: p }, [h]);
    step(1.5);
    return true;
  }
  window.__solve = function (maxLoops) {
    const g = G();
    g.tipList = []; RH.ui.closeTip();
    const kind = g.kind;
    if (kind === 'base') return 'base';
    if (kind === 'defense') {
      for (let k = 0; k < 400 && !g.over; k++) {
        step(1);
        for (const r of g.guards) if (r.raider && game.isActive(r)) { heal(); fight(r); }
      }
      return g.over;
    }
    koAll((x) => !(x.type === 'collector'));
    for (let loop = 0; loop < (maxLoops || 30) && !g.over; loop++) {
      heal();
      const h = fighters()[0];
      for (const b of g.beggars) if (game.visible(b) && b.pays.length) { RH.profile.gold = Math.max(RH.profile.gold, 60); tpNear(h, b); game.orderAction('pay', { kind: 'beggar', e: b }, [h]); waitTask(h, 3); }
      for (const s of g.scrolls) if (game.visible(s) && !s.read) { tpNear(h, s); game.orderAction('read', { kind: 'scroll', e: s }, [h]); waitTask(h, 3); }
      for (const p of g.props) {
        if (p.used && !p.contest) continue;
        if (p.kind === 'target') { if (!p.contest || !g.contest.sprung) shootTarget(p); continue; }
        if (p.kind === 'fire' || p.kind === 'station') continue;
        if (p.kind === 'listen') { place(h, p.x, p.y); game.orderAction('use', { kind: 'prop', e: p }, [h]); step(0.3); step((p.dur || 4) + 1); continue; }
        if (p.kind === 'bell' && g.blazons.some((b) => !b.cap)) continue;
        tpNear(h, p); game.orderAction('use', { kind: 'prop', e: p }, [h]); waitTask(h, 4);
      }
      for (const b of g.blazons) if (!b.cap) { koAll(); place(h, b.x, b.y); step(3.5); }
      if (g.chest && !g.chest.done && !g.chest.carrier && !g.chest.onCart) { tpNear(h, g.chest); game.orderAction('loot', { kind: 'chest', e: g.chest }, [h]); waitTask(h, 3); }
      if (g.cart && g.chest && g.chest.onCart) {
        const c = g.cart.carter;
        if (c.state === 'ok') { tpNear(h, c); game.orderAction('ko', { kind: 'carter', e: c }, [h]); waitTask(h, 4); }
        koAll();
        tpNear(h, g.cart); game.orderAction('loot', { kind: 'cart', e: g.cart }, [h]); waitTask(h, 4);
      }
      for (const c of g.gold) if (!c.taken && c.spill != null) { step(0.7); place(h, c.x, c.y); step(0.1); }
      for (const coll of g.guards.filter((x) => x.type === 'collector')) {
        if (game.isActive(coll)) fight(coll);
        if (game.isBody(coll) && !coll.searched) { tpNear(h, coll); game.orderAction('search', { kind: 'body', e: coll }, [h]); waitTask(h, 3); }
      }
      for (const c of g.contacts) if (game.visible(c) && !c.met) {
        let who = h;
        if (c.needs === 'letter') { who = g.chest.carrier || h; if (!g.chest.carrier) { tpNear(h, g.chest); game.orderAction('loot', { kind: 'chest', e: g.chest }, [h]); waitTask(h, 3); who = h; } }
        tpNear(who, c); game.orderAction('talk', { kind: 'contact', e: c }, [who]); waitTask(who, 3); step(0.3);
      }
      for (const p of g.prisoners) if (!p.freed) { const w = p.cage && g.props.find((q) => q.id === p.cage); if (w && !w.used) continue; if (p.friend && g.contest && !g.contest.sprung) continue; tpNear(h, p); game.orderAction('free', { kind: 'prisoner', e: p }, [h]); waitTask(h, 3); }
      if (g.captive && !g.captive.freed) { tpNear(h, g.captive); game.orderAction('free', { kind: 'captive', e: g.captive }, [h]); waitTask(h, 3); }
      if (g.boss && game.isActive(g.boss) && (!g.objs.some((o) => o.k === 'use') || g.props.every((p) => p.used || p.kind !== 'banner'))) { koAll(); fight(g.boss, true); }
      if (g.sheriff && game.isActive(g.sheriff)) { koAll(); fight(g.sheriff, true); }
      if (g.sheriff && g.sheriff.state === 'ko' && !g.sheriff.tied) { tpNear(h, g.sheriff); game.orderAction('tie', { kind: 'body', e: g.sheriff }, [h]); waitTask(h, 3); }
      if (g.treasure && !g.treasure.taken) { place(h, g.treasure.x, g.treasure.y); step(0.3); }
      koAll();
      step(0.5);
      if (g.chest && g.chest.taken && !g.chest.done && !g.chest.carrier) continue;
      if (g.exitReady && !g.over && g.exit.x >= 0) exitAll();
      step(0.5);
    }
    return g.over;
  };
  window.__step = step;
})();
