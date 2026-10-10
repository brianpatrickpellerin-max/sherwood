// Count climbable big trees per mission and how many the starting band can actually reach.
const fs = require('fs');
global.window = {}; window.RH = {};
global.localStorage = { getItem: () => null, setItem() {} };
for (const f of ['util', 'data', 'missions']) new Function('window', fs.readFileSync(`js/${f}.js`, 'utf8'))(window);
const RH = window.RH;
for (const m of RH.MISSIONS) {
  const g = RH.makeGrid(m.map), W = g.w;
  const [hx, hy] = Object.values(m.heroes)[0];
  const seen = new Uint8Array(W * g.h), q = [hy * W + hx]; seen[q[0]] = 1;
  for (let i = 0; i < q.length; i++) { const x = q[i] % W, y = (q[i] / W) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < W && ny < g.h && g.walk[ny * W + nx] && !seen[ny * W + nx]) { seen[ny * W + nx] = 1; q.push(ny * W + nx); } } }
  let n = 0, reach = 0, near = 0;
  for (let y = 0; y < g.h; y++) for (let x = 0; x < W; x++) if (RH.climbTree(g, x, y)) {
    n++;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen[(y + dy) * W + x + dx])) { reach++; if (Math.hypot(x - hx, y - hy) < 9) near++; }
  }
  console.log(m.id.padEnd(4), m.theme.padEnd(7), 'trees', String(n).padStart(3), 'reachable', String(reach).padStart(3), 'near start', near);
}
