// Node sim: can mission 1 be finished without being spotted, using only normal orders?
global.window = {}; ['util','data','audio','game'].forEach(f => require('../js/' + f + '.js'));
const RH = window.RH; RH.profile = { arrows: 10, potions: 1, up: {} };
const G = RH.G, T = 32, gm = RH.game;
gm.start(0);
const step = (s) => { for (let i = 0; i < s * 30 && !G.over; i++) gm.update(1 / 30); };
const robin = G.heroes[0], john = G.heroes[1];
const tile = (u) => [Math.floor(u.x / T), Math.floor(u.y / T)];
const until = (f, max = 60) => { let t = 0; while (!f() && t < max && !G.over) { step(0.1); t += 0.1; } return t; };
const log = (...a) => console.log(G.time.toFixed(1), ...a);
robin.sneak = john.sneak = true;
G.sel = [robin]; gm.moveSel(16.5 * T, 23.5 * T); G.sel = [john]; gm.moveSel(17.5 * T, 23.5 * T); step(5); console.log('in bush', tile(robin), tile(john), 'spotted', G.stats.spotted);
const g0 = G.guards[0];
// wait until the trail guard stands at the south end looking north
until(() => g0.ri === 0 && g0.wait > 1.5 && tile(g0)[1] === 17, 40); log('g0 waiting at south end', tile(g0), 'spotted', G.stats.spotted);
robin.sneak = false; G.sel = [robin]; gm.orderAction('ko', { kind: 'guard', e: g0 }); until(() => g0.state === 'ko', 6); log('g0', g0.state, 'spotted', G.stats.spotted);
gm.orderAction('tie', { kind: 'body', e: g0 }); until(() => g0.tied, 4);
G.sel = [john]; gm.orderAction('carry', { kind: 'body', e: g0 }); until(() => john.carry, 6);
G.sel = [john]; gm.moveSel(18.5 * T, 17.5 * T); until(() => !john.path, 10); gm.drop(john); log('body hidden?', RH.hideAt(G.grid, g0.x, g0.y), 'spotted', G.stats.spotted);
// g1 at (14,10) sweeps: approach from the west side when he looks east/south
const g1 = G.guards[1];
G.sel = [robin]; gm.moveSel(9.5 * T, 13.5 * T); until(() => !robin.path, 10); log('robin at', tile(robin), 'spotted', G.stats.spotted, 'g1 sus', g1.sus.toFixed(2));
until(() => Math.abs(RH.angDiff(g1.dir, -0.4)) < 0.3, 20);
gm.orderAction('ko', { kind: 'guard', e: g1 }); until(() => g1.state !== 'patrol' && g1.state !== 'look', 6); log('g1', g1.state, 'spotted', G.stats.spotted);
gm.orderAction('tie', { kind: 'body', e: g1 }); until(() => g1.tied, 4);
console.log('alarm', G.alarmed, 'spotted', G.stats.spotted, 'guards', gm && G.guards.map(g => g.state + (g.tied ? '+t' : '')).join(','));
