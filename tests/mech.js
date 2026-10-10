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
  ok('beehive: a group panics and runs', g.state === 'panic' && g2.state === 'panic', g.state + ',' + g2.state + ' ' + [g.x, g.y, g2.x, g2.y, g2.type, g2.koT, game.isActive(g2)].join(' '));
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
  L = lab(11); L.G.time = 30; const nb = L.G.civs.find((c) => c.noble);
  if (nb) {
    g = guard(L, 4, 0, 'soldier', Math.PI); nb.x = L.c(L.at[0] + 1); nb.y = L.c(L.at[1]); nb.dir = Math.PI; nb.state = 'ok'; nb.wait = 0; h = hero(L, 'robin', -1, 0);
    let rep = false; for (let i = 0; i < 30; i++) { step(0.25); if (nb.state === 'report') rep = true; if (g.state === 'investigate' || g.state === 'alert') break; }
    ok('noble runs to report outlaws', rep && (g.state === 'investigate' || g.state === 'alert'), nb.state + ' guard ' + g.state);
  } else ok('noble runs to report outlaws', false, 'no noble in m12');
  // pit trap in an ambush
  S.begin({ type: 'ambush', kind: 'wagon', seed: 2 }, []); let G = S.G; G.paused = true;
  const pit = G.traps.find((t) => t.kind === 'pit');
  if (pit) { const pg = G.guards.find((x) => x.type !== 'collector'); pg.x = pit.x; pg.y = pit.y; step(0.3); ok('pit trap swallows a guard', pg.inPit && pg.state === 'ko', pg.state); } else ok('pit trap swallows a guard', false, 'no pit');
  // winch lowers a cage (m6), bell brings allies (m11)
  S.begin(8, []); G = S.G; G.paused = true; G.guards.forEach((x) => { x.x = -9999; x.y = -9999; });
  const wn = G.props.find((p) => p.kind === 'winch'); h = G.heroes[0];
  if (wn) { h.x = wn.x + 10; h.y = wn.y + 20; game.orderAction('use', { kind: 'prop', e: wn }, [h]); step(4); const cage = G.prisoners.find((p) => p.cage === wn.id); ok('winch lowers the cage', wn.used && cage && !cage.raised, JSON.stringify({ used: wn.used, raised: cage && cage.raised })); } else ok('winch lowers the cage', false, 'none');
  S.begin(14, []); G = S.G; G.paused = true;
  const bell = G.props.find((p) => p.kind === 'bell'); h = G.heroes[0]; G.guards.forEach((x) => { x.x = -9999; x.y = -9999; });
  if (bell) { const a0 = G.allies.length; h.x = bell.x + 10; h.y = bell.y + 20; game.orderAction('use', { kind: 'prop', e: bell }, [h]); step(3); ok('bell calls the villagers to arms', G.allies.length > a0, a0 + '->' + G.allies.length); } else ok('bell calls the villagers to arms', false, 'none');
  // beggar reveals and costs gold
  S.begin(3, []); G = S.G; G.paused = true; G.guards.forEach((x) => { x.x = -9999; x.y = -9999; });
  RH.profile.gold = 50; const bg = G.beggars[0]; h = G.heroes[0];
  if (bg) { const m0 = game.money(); h.x = bg.x + 20; h.y = bg.y; game.orderAction('pay', { kind: 'beggar', e: bg }, [h]); step(1); RH.ui.closeTip(); ok('alms to a beggar reveal a contact', game.money() < m0 && Object.keys(G.revealed).length > 0, m0 + '->' + game.money()); } else ok('alms to a beggar reveal a contact', false, 'none');
  return out;
};

// v4 mechanics (the second pass toward the original)
window.__mech4 = function () {
  const S = window.__sherwood, RH = S.RH, game = RH.game, T = RH.TILE, out = [];
  const ok = (n, c, info) => out.push([n, !!c, info == null ? '' : String(info)]);
  const step = (s) => window.__step(s);
  const c = (tx) => (tx + 0.5) * T;
  RH.profile.heroes = ['robin', 'john', 'marian', 'tuck', 'scarlet'];
  const away = (G) => { G.guards.forEach((g) => { g.x = -9999; g.y = -9999; g.state = 'ko'; g.tied = true; g.koT = 999; g.found = true; }); (G.civs || []).forEach((q) => { q.x = -9999; q.y = -9999; }); G.heroes.forEach((h) => { h.x = -5000 - Math.random() * 100; h.y = -5000; }); };
  const open = (G) => { const gr = G.grid; for (let y = 3; y < gr.h - 3; y++) for (let x = 4; x < gr.w - 4; x++) { let all = true; for (let dy = -2; dy <= 2 && all; dy++) for (let dx = -3; dx <= 3 && all; dx++) if (!RH.isWalk(gr, x + dx, y + dy) || gr.hide[(y + dy) * gr.w + x + dx]) all = false; if (all) return { x: c(x), y: c(y) }; } return null; };
  const begin = (mi) => { S.begin(mi, []); const G = S.G; G.paused = true; G.tipList = []; RH.ui.closeTip(); return G; };
  const putG = (G, g, x, y, dir, st) => { Object.assign(g, { x, y, state: st || 'patrol', tied: false, koT: 0, found: false, sus: 0, hp: g.maxhp || 3, path: null, dir: dir || 0, vd: dir || 0, target: null, dazedT: 0, inPit: false, hoisted: false, leash: null, coin: null, home: { x, y }, route: [{ tx: Math.floor(x / T), ty: Math.floor(y / T), x, y, wait: 0 }], looks: null, faceTo: dir || 0 }); return g; };
  const putH = (G, key, x, y) => { const h = G.heroes.find((q) => q.key === key); Object.assign(h, { x, y, down: false, task: null, path: null, busy: 0, inside: null, roof: null, climbZ: 0, carry: null, crimeT: 0, cd: 0 }); h.hp = h.maxhp; G.sel = [h]; return h; };
  // town missions with houses / ivy / horn
  let mi = -1; for (let i = 0; i < RH.MISSIONS.length; i++) { const G = begin(i); if (G.houses.length && G.ivy.length && G.horn && ['robin', 'john', 'marian'].every((k) => G.heroes.some((q) => q.key === k))) { mi = i; break; } }
  ok('a town mission has houses, ivy and an alarm horn', mi >= 0, mi >= 0 ? RH.MISSIONS[mi].id : 'none');
  let G, g, g2, h;
  // sweeping cones
  G = begin(mi); g = G.guards.find((q) => game.isActive(q) && q.state === 'patrol');
  const vds = []; for (let i = 0; i < 8; i++) { step(0.4); if (g) vds.push(+(g.vd - g.dir).toFixed(2)); }
  ok('view cones sweep as guards turn their heads', new Set(vds).size > 3, vds.join(','));
  // shake a fallen mate awake
  G = begin(mi); away(G); const hs = G.houses.find((q) => q.door);
  const dx = hs.door.x, dy = hs.door.y;
  g = putG(G, G.guards[0], dx + T, dy, 0); game.knockOut(g, 60);
  g2 = putG(G, G.guards[1], dx + 4 * T, dy, Math.PI); 
  let states = ''; for (let i = 0; i < 40 && g.state === 'ko'; i++) { step(0.25); states += g2.state[0] + (g2.state === 'shaking' ? '!' : ''); }
  ok('a guard shakes his knocked-out mate awake', states.includes('!') && g.state !== 'ko', states.slice(0, 60));
  // carry a body and hide it in a house
  G = begin(mi); away(G); const H2 = G.houses.find((q) => q.door);
  h = putH(G, 'john', H2.door.x, H2.door.y + T * 0.2); g = putG(G, G.guards[0], H2.door.x + T, H2.door.y, 0); game.knockOut(g, 60);
  game.orderAction('carry', { kind: 'body', e: g }, [h]); step(1.5);
  const carried = h.carry === g;
  game.orderAction('stash', { kind: 'house', e: H2 }, [h]); step(2);
  ok('carry a body and stuff it into a house', carried && g.state === 'gone' && H2.bodies === 1 && !h.carry, carried + ' ' + g.state + ' ' + H2.bodies);
  // hide inside: an alert guard loses you
  h = putH(G, 'robin', H2.door.x, H2.door.y + T * 0.2); g2 = putG(G, G.guards[1], H2.door.x, H2.door.y + 2.5 * T, -Math.PI / 2);
  game.orderAction('enter', { kind: 'house', e: H2 }, [h]); step(0.6);
  const inside = h.inside === H2; for (let i = 0; i < 10; i++) step(0.3);
  ok('hide inside a house: guards cannot see you', inside && g2.state !== 'alert' && g2.sus < 0.2, inside + ' ' + g2.state + ' sus=' + g2.sus.toFixed(2));
  game.moveSel(H2.door.x, H2.door.y + 2 * T); step(0.1);
  ok('leaving the house', !h.inside, String(h.inside));
  // ivy to the roof, then drop onto a guard
  G = begin(mi); away(G); const iv = G.ivy[0];
  const jn = putH(G, 'john', iv.x, iv.y);
  ok('Little John is too heavy for ivy', game.orderAction('roof', { kind: 'ivy', e: iv }, [jn]) === false);
  jn.x = -5000;
  h = putH(G, 'robin', iv.x, iv.y);
  game.orderAction('roof', { kind: 'ivy', e: iv }, [h]); step(2);
  ok('Robin climbs the ivy onto the roof', h.roof === iv.house && h.climbZ > 20, (h.roof && h.roof.id) + ' z=' + (h.climbZ | 0));
  // a guard below the far edge of the roof
  const rf = iv.house; let gx = null, gdir = Math.PI / 2;
  const cand = [];
  for (let k = 0; k < rf.w; k++) cand.push([rf.x + k, rf.y + rf.h, Math.PI / 2], [rf.x + k, rf.y - 1, -Math.PI / 2]);
  for (let k = 0; k < rf.h; k++) cand.push([rf.x + rf.w, rf.y + k, 0], [rf.x - 1, rf.y + k, Math.PI]);
  for (const [tx, ty, d] of cand) if (!gx && RH.isWalk(G.grid, tx, ty) && Math.abs(tx - iv.tx) + Math.abs(ty - iv.ty) >= 3 && !(rf.door && false)) { gx = [tx, ty]; gdir = d; }
  if (!gx) gx = [iv.tx, iv.ty];
  g = putG(G, G.guards[2], c(gx[0]), c(gx[1]), gdir);
  g.vd = g.dir; step(0.5);
  const seenOnRoof = g.state === 'alert';
  game.startDrop(h, g.x, g.y, null); for (let i = 0; i < 12 && h.roof; i++) step(0.25); step(0.3);
  ok('drop from the roof flattens a guard', !h.roof && g.state === 'ko' && !seenOnRoof, 'roof=' + !!h.roof + ' guard=' + g.state + ' seen=' + seenOnRoof + ' drops=' + G.stats.drops);
  // net snare hoists a guard (and his mate)
  G = begin(mi); away(G);
  const sp = open(G); h = putH(G, 'john', sp.x - T, sp.y); G.inv.nets = 3;
  game.groundAbility('snare', sp.x, sp.y); step(2.5);
  const sn = G.snares.find((q) => q.armed);
  ok('Little John sets a net snare', !!sn, G.snares.length);
  if (sn) { g = putG(G, G.guards[0], sn.x + T * 0.2, sn.y, 0); g2 = putG(G, G.guards[1], sn.x + T * 1.0, sn.y + T * 0.3, 0); step(0.4); }
  ok('the snare hoists enemies into the trees', g && g.hoisted && g.state === 'ko' && g2.hoisted, g && (g.state + ' ' + g.hoisted + ' / ' + g2.hoisted));
  // two guards fight over one purse
  G = begin(mi); away(G); const pd = open(G);
  h = putH(G, 'robin', pd.x - 3 * T, pd.y); G.inv.purses = 2;
  g = putG(G, G.guards[0], pd.x + 2 * T, pd.y - 2 * T, 0); g2 = putG(G, G.guards[1], pd.x + 2 * T, pd.y + 2 * T, 0);
  g.type = g2.type = 'soldier'; g.nogreed = g2.nogreed = false;
  game.groundAbility('purse', pd.x, pd.y);
  step(0.5); h.x = -5000; h.y = -5000; // Robin slips away once the purse is in the air
  let br = false; for (let i = 0; i < 40; i++) { step(0.25); if (g.state === 'brawl' && g2.state === 'brawl') { br = true; break; } }
  ok('two guards brawl over one purse', br, g.state + ',' + g2.state);
  if (br) { const p0 = putH(G, 'john', g.x - T * 0.6, g.y); game.orderAction('ko', { kind: 'guard', e: g }, [p0]); step(1.2); ok('a brawling guard is easy to knock out', g.state === 'ko', g.state); }
  // Marian walks freely; Robin in the same spot is seen
  G = begin(mi); away(G); const md = open(G);
  g = putG(G, G.guards[0], md.x + 2 * T, md.y, Math.PI);
  const mar = putH(G, 'marian', md.x, md.y); g.dir = g.vd = Math.atan2(mar.y - g.y, mar.x - g.x);
  for (let i = 0; i < 8; i++) step(0.25);
  const mOk = g.state !== 'alert' && g.sus < 0.1;
  mar.x = -5000; const rb = putH(G, 'robin', md.x, md.y); g.sus = 0; g.dir = g.vd = Math.atan2(rb.y - g.y, rb.x - g.x);
  for (let i = 0; i < 8; i++) step(0.25);
  ok('Marian walks freely among guards (Robin would be seen)', mOk && (g.state === 'alert' || g.sus > 0.5), 'marian ok=' + mOk + ' robin->' + g.state);
  // alarm horn brings endless reinforcements; stuffing it stops that
  G = begin(mi); const HN = G.horn; const n0 = G.guards.length;
  game.raiseAlarm(HN.x, HN.y, 'spotted'); step(0.2);
  const run = HN.runner;
  ok('when the alarm goes up a guard runs for the horn', run && (run.state === 'tohorn' || run.state === 'horn'), run && run.state);
  if (run) { run.x = HN.x + 4; run.y = HN.y + 4; run.path = null; }
  step(3);
  ok('the horn is blown', HN.blown, HN.blown);
  for (let i = 0; i < 30; i++) { step(1); G.alarmT = Math.max(G.alarmT, 20); }
  ok('reinforcements keep marching in', G.stats.reinf >= 4, n0 + ' -> ' + G.guards.length + ' (reinf ' + G.stats.reinf + ')');
  G = begin(mi); const HN2 = G.horn; h = G.heroes[0]; G.guards.forEach((q) => { if (q !== HN2.runner) { q.x = -9999; q.y = -9999; } });
  h.x = HN2.x + 10; h.y = HN2.y + 20; game.orderAction('use', { kind: 'prop', e: HN2 }, [h]); step(3);
  game.raiseAlarm(HN2.x, HN2.y, 'spotted'); step(3);
  ok('stuffing the horn with moss stops it', HN2.used && !HN2.blown && !HN2.runner, HN2.used + ' ' + HN2.blown);
  // robbing the wagon spills its silver
  S.begin({ type: 'ambush', kind: 'wagon', seed: 2 }, []); G = S.G; G.paused = true; G.tipList = []; RH.ui.closeTip();
  G.guards.forEach((q) => { q.x = -9999; q.y = -9999; q.state = 'ko'; q.tied = true; q.koT = 999; q.found = true; });
  const cr = G.cart.carter; cr.state = 'ko'; G.cart.state = 'stopped'; h = G.heroes[0]; h.x = G.cart.x + T; h.y = G.cart.y; const g0 = G.stats.gold;
  game.orderAction('loot', { kind: 'cart', e: G.cart }, [h]); step(3);
  const spills = G.gold.filter((q) => q.spill != null);
  ok('robbing the cart spills gold on the road', spills.length >= 3 && spills.some((q) => !q.taken), spills.length + ' piles, gold ' + G.stats.gold);
  for (const q of spills) { h.x = q.x; h.y = q.y; h.task = null; step(0.1); }
  ok('walk over the coins to scoop them up', spills.every((q) => q.taken) && G.stats.gold > g0, G.stats.gold);
  // boss duel: counter the telegraphed blow by swiping the same way
  let bi = -1; for (let i = 0; i < RH.MISSIONS.length; i++) if ((RH.MISSIONS[i].guards || []).some((q) => q.boss) || RH.MISSIONS[i].sheriff) { bi = i; break; }
  G = begin(bi); const boss = G.boss || G.sheriff; away(G);
  const bo = open(G); Object.assign(boss, { state: 'patrol', tied: false, koT: 0, found: false, x: bo.x, y: bo.y, stagger: 0 });
  h = putH(G, 'robin', boss.x - T * 0.7, boss.y); boss.home = { x: boss.x, y: boss.y }; boss.leash = null; boss.atkCd = 0;
  game.spot(boss, h, true);
  let tele = null; for (let i = 0; i < 60 && !tele; i++) { step(1 / 15); if (boss.duel) tele = boss.duel.need; h.hp = h.maxhp; }
  h.strokeCd = 0; h.busy = 0; const sr = tele && game.swipeStrike(boss, tele, [h]); step(0.2);
  ok('boss duel: swipe the shown way to counter', tele && G.stats.counters >= 1 && boss.stagger > 0, tele + ' ' + sr + ' counters=' + G.stats.counters + ' d=' + (Math.hypot(h.x - boss.x, h.y - boss.y) / T).toFixed(2) + ' ' + boss.state + ' hp' + boss.hp);
  return out;
};
