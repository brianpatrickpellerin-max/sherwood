// Test-only: checks each new mechanic in isolation on a real mission map.
window.__mech = function () {
  const S = window.__sherwood, RH = S.RH, game = RH.game, T = RH.TILE, out = [];
  const ok = (n, c, info) => out.push([n, !!c, info == null ? '' : String(info)]);
  const step = (s) => window.__step(s);
  RH.profile.heroes = ['robin', 'john', 'marian', 'tuck', 'scarlet'];
  function lab(mi) {
    S.begin(mi == null ? { type: 'ambush', kind: 'supply', seed: 3 } : mi, []); const G = S.G; G.paused = true; G.tipList = []; RH.ui.closeTip();
    G.guards.forEach((g) => { g.x = -9999; g.y = -9999; g.state = 'ko'; g.tied = true; g.koT = 999; g.found = true; });
    (G.civs || []).forEach((c) => { c.x = -9999; c.y = -9999; });
    // find an open 9x9 patch
    const gr = G.grid; let at = null;
    for (let y = 5; y < gr.h - 5 && !at; y++) for (let x = 5; x < gr.w - 5 && !at; x++) {
      let all = true; for (let dy = -3; dy <= 3 && all; dy++) for (let dx = -4; dx <= 4 && all; dx++) if (!RH.isWalk(gr, x + dx, y + dy) || RH.hideAt(gr, (x + dx + .5) * T, (y + dy + .5) * T)) all = false;
      if (all) at = [x, y];
    }
    const c = (tx) => (tx + 0.5) * T;
    if (!at) { // clear a test patch in the middle of the map (test-only)
      at = [gr.w >> 1, gr.h >> 1];
      for (let dy = -4; dy <= 4; dy++) for (let dx = -5; dx <= 5; dx++) { const i = (at[1] + dy) * gr.w + at[0] + dx; gr.ch[i] = '.'; gr.walk[i] = 1; gr.see[i] = 1; gr.hide[i] = 0; gr.block[i] = 0; }
    }
    G.heroes.forEach((h) => { h.x = -5000 - Math.random() * 100; });
    return { G, at, c };
  }
  function guard(L, dx, dy, type, dir) {
    const g = L.G.guards.find((x) => x.x < -9000 && (!type || x.type === type)) || L.G.guards.find((x) => x.x < -9000);
    Object.assign(g, { x: L.c(L.at[0] + dx), y: L.c(L.at[1] + dy), state: 'patrol', tied: false, koT: 0, found: false, sus: 0, hp: g.maxhp || 3, path: null, wp: [[L.at[0] + dx, L.at[1] + dy]], wpi: 0, dir: dir || 0, target: null, dazedT: 0, inPit: false, leash: null, home: { x: L.c(L.at[0] + dx), y: L.c(L.at[1] + dy) } });
    if (type) { g.type = type; }
    return g;
  }
  function hero(L, key, dx, dy) { const h = L.G.heroes.find((x) => x.key === key); h.x = L.c(L.at[0] + dx); h.y = L.c(L.at[1] + dy); h.down = false; h.hp = h.maxhp; h.cd = 0; h.task = null; h.path = null; L.G.sel = [h]; return h; }

  let L, g, h;
  // purse: guards walk to it
  L = lab(); g = guard(L, 3, 0, null, Math.PI); h = hero(L, 'robin', -3, 3); L.G.inv.purses = 2;
  game.groundAbility('purse', L.c(L.at[0] + 1), L.c(L.at[1] + 1)); step(1.2);
  ok('purse lures guard', g.state === 'lured' || g.state === 'counting', g.state);
  // net
  L = lab(); g = guard(L, 2, 0, null, 0); h = hero(L, 'john', -2, 0); L.G.inv.nets = 2;
  game.groundAbility('net', g.x, g.y); step(1.0);
  ok('net traps guard', g.state === 'netted', g.state);
  game.orderAction('ko', { kind: 'guard', e: g }, [h]); step(3);
  ok('KO a netted guard', g.state === 'ko', g.state);
  // apple
  L = lab(); g = guard(L, 3, 0, null, 0); h = hero(L, 'scarlet', -3, 3); L.G.inv.apples = 2;
  game.groundAbility('apple', L.c(L.at[0]), L.c(L.at[1] + 2)); step(0.9);
  ok('apple turns a guard', g.state === 'investigate', g.state);
  // ale
  L = lab(); g = guard(L, 3, 0, null, Math.PI); h = hero(L, 'tuck', -3, 3); L.G.inv.ale = 2;
  game.groundAbility('ale', L.c(L.at[0] + 1), L.c(L.at[1])); let saw = '';
  for (let i = 0; i < 20; i++) { step(0.5); saw += g.state[0]; if (g.state === 'ko') break; }
  ok('ale: guard drinks and falls asleep', g.state === 'ko' && saw.includes('d'), saw);
  // hive
  L = lab(); g = guard(L, 3, 0, null, Math.PI); const g2 = guard(L, 3, 1, null, Math.PI); h = hero(L, 'tuck', 0, 3); L.G.inv.hives = 1;
  game.groundAbility('hive', g.x, g.y + T / 2); step(1.0);
  ok('beehive stuns a group', g.state === 'stunned' && g2.state === 'stunned', g.state + ',' + g2.state + ' ' + [g.x, g.y, g2.x, g2.y, g2.type, g2.koT, game.isActive(g2)].join(' '));
  // sling
  L = lab(); g = guard(L, 3, 0, 'soldier', 0); h = hero(L, 'scarlet', -1, 0); L.G.inv.stones = 5;
  game.orderAction('sling', { kind: 'guard', e: g }, [h]); step(2);
  ok('sling stone knocks out', g.state === 'ko', g.state);
  // whistle
  L = lab(); g = guard(L, 4, 0, null, 0); h = hero(L, 'john', -2, 0);
  const n = game.whistle(h); step(0.2);
  ok('whistle draws guards', n >= 1 && g.state === 'investigate', n + ' ' + g.state);
  // charm
  L = lab(); g = guard(L, 3, 0, null, Math.PI); h = hero(L, 'marian', -1, 0); L.G.cdMarian = 0;
  game.orderAction('charm', { kind: 'guard', e: g }, [h]); step(0.5);
  ok('Marian charms a guard', g.state === 'charmed', g.state);
  // heal
  L = lab(); h = hero(L, 'tuck', 0, 0); const r = hero(L, 'robin', 1, 0); r.hp = 1; L.G.cdTuck = 0; L.G.sel = [h];
  game.orderAction('heal', { kind: 'hero', e: r }, [h]); step(2.5);
  ok('Tuck heals', r.hp > 1, r.hp);
  // knight shrugs off arrows
  L = lab(); g = guard(L, 4, 0, 'knight', Math.PI / 2); g.arrowproof = true; const hp0 = g.hp; h = hero(L, 'robin', -1, 0); L.G.inv.arrows = 5;
  game.orderAction('shoot', { kind: 'guard', e: g }, [h]); step(2);
  ok('knight shrugs off arrows', g.state !== 'ko' && g.hp === hp0, g.state + ' hp' + g.hp);
  // officer needs two blows from Robin, one from John
  L = lab(); g = guard(L, 3, 0, 'officer', 0); g.tough = true; h = hero(L, 'robin', 2, 0);
  game.orderAction('ko', { kind: 'guard', e: g }, [h]); step(1.5);
  const after1 = g.state; const dz = g.dazedT > 0;
  ok('officer is dazed, not floored, by one punch', after1 !== 'ko' && dz, after1 + ' dazed=' + dz);
  game.orderAction('ko', { kind: 'guard', e: g }, [h]); step(1.5);
  ok('second blow floors the officer', g.state === 'ko', g.state);
  // comrades wake untied bodies
  L = lab(); g = guard(L, 2, 0, 'soldier', 0); game.knockOut(g, 60); const w = guard(L, 0, 0, 'soldier', 0); w.wp = [[L.at[0], L.at[1]], [L.at[0] + 2, L.at[1]]];
  for (let i = 0; i < 40 && g.state === 'ko'; i++) step(0.5);
  ok('guards wake fallen comrades', g.state !== 'ko', g.state);
  // tying stops it
  L = lab(); h = hero(L, 'robin', 1, 1); g = guard(L, 2, 0, 'soldier', 0); game.knockOut(g, 60);
  game.orderAction('tie', { kind: 'body', e: g }, [h]); step(3);
  ok('tie up a body', g.tied, g.tied);
  // swipe strokes
  L = lab(); g = guard(L, 1, 0, 'soldier', Math.PI); h = hero(L, 'robin', 0, 0); game.spot(g, h, true);
  let hits = 0; for (const s of ['slash', 'heavy', 'thrust', 'slash', 'heavy', 'slash']) { if (game.swipeStrike(g, s, [h])) hits++; step(0.8); if (h.hp < 3) h.hp = h.maxhp; }
  ok('swipe sword fight defeats a guard', !game.isActive(g), hits + ' strokes, ' + g.state);
  // noble raises the alarm
  L = lab(7); const nb = L.G.civs.find((c) => c.noble);
  if (nb) {
    g = guard(L, 4, 0, 'soldier', Math.PI); nb.x = L.c(L.at[0] + 1); nb.y = L.c(L.at[1]); nb.dir = Math.PI; nb.state = 'ok'; nb.wait = 0; h = hero(L, 'robin', -1, 0);
    let rep = false; for (let i = 0; i < 30; i++) { step(0.25); if (nb.state === 'report') rep = true; if (g.state === 'investigate' || g.state === 'alert') break; }
    ok('noble runs to report outlaws', rep && (g.state === 'investigate' || g.state === 'alert'), nb.state + ' guard ' + g.state);
  } else ok('noble runs to report outlaws', false, 'no noble in m8');
  // pit trap in an ambush
  S.begin({ type: 'ambush', kind: 'wagon', seed: 2 }, []); let G = S.G; G.paused = true;
  const pit = G.traps.find((t) => t.kind === 'pit');
  if (pit) { const pg = G.guards.find((x) => x.type !== 'collector'); pg.x = pit.x; pg.y = pit.y; step(0.3); ok('pit trap swallows a guard', pg.inPit && pg.state === 'ko', pg.state); } else ok('pit trap swallows a guard', false, 'no pit');
  // winch lowers a cage (m6), bell brings allies (m11)
  S.begin(5, []); G = S.G; G.paused = true; G.guards.forEach((x) => { x.x = -9999; x.y = -9999; });
  const wn = G.props.find((p) => p.kind === 'winch'); h = G.heroes[0];
  if (wn) { h.x = wn.x + 10; h.y = wn.y + 20; game.orderAction('use', { kind: 'prop', e: wn }, [h]); step(4); const cage = G.prisoners.find((p) => p.cage === wn.id); ok('winch lowers the cage', wn.used && cage && !cage.raised, JSON.stringify({ used: wn.used, raised: cage && cage.raised })); } else ok('winch lowers the cage', false, 'none');
  S.begin(10, []); G = S.G; G.paused = true;
  const bell = G.props.find((p) => p.kind === 'bell'); h = G.heroes[0]; G.guards.forEach((x) => { x.x = -9999; x.y = -9999; });
  if (bell) { const a0 = G.allies.length; h.x = bell.x + 10; h.y = bell.y + 20; game.orderAction('use', { kind: 'prop', e: bell }, [h]); step(3); ok('bell calls the villagers to arms', G.allies.length > a0, a0 + '->' + G.allies.length); } else ok('bell calls the villagers to arms', false, 'none');
  // beggar reveals and costs gold
  S.begin(3, []); G = S.G; G.paused = true; G.guards.forEach((x) => { x.x = -9999; x.y = -9999; });
  RH.profile.gold = 50; const bg = G.beggars[0]; h = G.heroes[0];
  if (bg) { const m0 = game.money(); h.x = bg.x + 20; h.y = bg.y; game.orderAction('pay', { kind: 'beggar', e: bg }, [h]); step(1); RH.ui.closeTip(); ok('alms to a beggar reveal a contact', game.money() < m0 && Object.keys(G.revealed).length > 0, m0 + '->' + game.money()); } else ok('alms to a beggar reveal a contact', false, 'none');
  return out;
};
