// Validates mission maps: row lengths, walkable points, reachability.
const fs = require('fs');
global.window = {}; window.RH = {};
global.localStorage = { getItem: () => null, setItem() {} };
for (const f of ['util', 'data', 'missions', 'ambush']) { if (fs.existsSync(`js/${f}.js`)) new Function('window', fs.readFileSync(`js/${f}.js`, 'utf8'))(window); }
const RH = window.RH;
let bad = 0;
function check(m, label) {
  const rows = m.map; const w = rows[0].length;
  rows.forEach((r, i) => { if (r.length !== w) { console.log(label, 'row', i, 'len', r.length, '!=', w, JSON.stringify(r)); bad++; } });
  const g = RH.makeGrid(rows);
  for (const p of m.props || []) if (p.plank) for (const [x, y] of p.plank) { g.walk[y * g.w + x] = 1; }
  const W = (x, y) => x >= 0 && y >= 0 && x < g.w && y < g.h && g.walk[y * g.w + x];
  const pts = [];
  const add = (what, x, y, adj) => pts.push({ what, x, y, adj });
  for (const [k, [x, y]] of Object.entries(m.heroes || {})) add('hero ' + k, x, y);
  for (const p of m.prisoners || []) add('prisoner ' + p.id, p.x, p.y);
  for (const c of m.contacts || []) add('contact ' + c.id, c.x, c.y);
  for (const b of m.beggars || []) add('beggar ' + b.id, b.x, b.y);
  for (const s of m.scrolls || []) add('scroll ' + s.id, s.x, s.y);
  for (const p of m.props || []) add('prop ' + (p.id || p.kind), p.x, p.y, p.kind === 'target');
  for (const t of m.traps || []) add('trap', t.x, t.y);
  for (const b of m.blazons || []) add('blazon', b[0], b[1]);
  if (m.captive) add('captive', m.captive[0], m.captive[1]);
  if (m.chest) add('chest', m.chest.x, m.chest.y);
  if (m.treasure) add('treasure', m.treasure.x, m.treasure.y);
  if (m.sheriff) add('sheriff', m.sheriff.x, m.sheriff.y);
  for (const gd of m.guards || []) if (gd.route) gd.route.forEach((r, i) => add('guard wp' + i + (gd.tag ? ' ' + gd.tag : ''), r[0], r[1]));
  for (const [x, y] of m.civilians || []) add('civ', x, y);
  for (const [x, y] of m.nobles || []) add('noble', x, y);
  for (const [x, y] of m.gold || []) add('gold', x, y);
  for (const c of m.climbs || []) { add('climb a', c[0], c[1]); add('climb b', c[2], c[3]); }
  if (m.exit) add('exit', m.exit.x, m.exit.y);
  // reachability from first hero, with climbs, planks and gates open
  const start = Object.values(m.heroes || {})[0] || [0, 0];
  const seen = new Uint8Array(g.w * g.h); const q = [start];
  seen[start[1] * g.w + start[0]] = 1;
  const links = {};
  for (const c of m.climbs || []) { (links[c[1] * g.w + c[0]] = links[c[1] * g.w + c[0]] || []).push([c[2], c[3]]); (links[c[3] * g.w + c[2]] = links[c[3] * g.w + c[2]] || []).push([c[0], c[1]]); }
  while (q.length) {
    const [x, y] = q.pop();
    const nb = [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]].concat(links[y * g.w + x] || []);
    for (const [nx, ny] of nb) if (W(nx, ny) && !seen[ny * g.w + nx]) { seen[ny * g.w + nx] = 1; q.push([nx, ny]); }
  }
  for (const p of pts) {
    const ok = p.adj ? [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => W(p.x + dx, p.y + dy)) : W(p.x, p.y);
    if (!ok) { console.log(label, 'NOT WALKABLE', p.what, p.x, p.y, JSON.stringify(rows[p.y] && rows[p.y][p.x])); bad++; continue; }
    const r = p.adj ? [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen[(p.y + dy) * g.w + p.x + dx]) : seen[p.y * g.w + p.x];
    if (!r && !/guard|civ|noble|gold/.test(p.what)) { console.log(label, 'UNREACHABLE', p.what, p.x, p.y); bad++; }
  }
}
(RH.MISSIONS || []).forEach((m, i) => check(m, m.id));
if (RH.ambush) { for (let s = 1; s < 40; s++) for (const k of ['wagon', 'collector', 'supply']) check(RH.ambush.make(k, s, 1), 'amb-' + k + s); }
if (RH.defenseMission) check(RH.defenseMission(), 'defense');
if (RH.baseMission) check(RH.baseMission(), 'base');
console.log(bad ? bad + ' problems' : 'all maps ok', (RH.MISSIONS || []).length, 'missions');
