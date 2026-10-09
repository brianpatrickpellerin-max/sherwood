// Between-mission content: procedural roadside ambushes, the Defence of Sherwood and the camp walk.
'use strict';
(function (RH) {
  const AW = 26, AH = 30;
  const KINDS = {
    wagon: { name: 'Wagon raid', ic: '🛒', desc: 'A strongbox on its way to the Prince. Stop the wagon at the felled tree.' },
    collector: { name: 'Tax collector', ic: '💰', desc: 'A collector with a fat purse and his guards. Knock him down and search him.' },
    supply: { name: 'Supply cart', ic: '🏹', desc: 'War supplies for the garrison: arrows and ale, and a little silver.' },
  };
  const ROADS = ['the Great North Road', 'the Mansfield road', 'Watling Way', 'the Ollerton track', 'the Blyth road', 'the Southwell lane', 'Fosse Way', 'the Edwinstowe road'];
  const setc = (rows, x, y, c) => { rows[y] = rows[y].slice(0, x) + c + rows[y].slice(x + 1); };

  // A forest road that wanders north to south, with bushes, clearings and a hideout clearing for the band.
  function roadMap(r) {
    const rows = [];
    let cx = 8 + Math.floor(r() * 6);
    const xs = [];
    for (let y = 0; y < AH; y++) {
      if (y > 1 && y < AH - 2 && r() < 0.18) cx = Math.max(6, Math.min(AW - 9, cx + (r() < 0.5 ? -1 : 1)));
      xs.push(cx);
    }
    const side = xs[14] < AW / 2 ? 1 : -1;
    const hx = side > 0 ? Math.min(AW - 4, xs[14] + 8) : Math.max(3, xs[14] - 7);
    const hy = 14;
    for (let y = 0; y < AH; y++) {
      let row = '';
      for (let x = 0; x < AW; x++) {
        const d = x < xs[y] ? xs[y] - x : x - (xs[y] + 1);
        const dh = Math.hypot(x - hx, (y - hy) * 1.2);
        let c;
        if (x >= xs[y] && x <= xs[y] + 1) c = ',';
        else if (dh < 3.4) c = dh < 1.2 ? ',' : (r() < 0.08 ? 'b' : '.');
        else if (y === hy && (side > 0 ? x > xs[y] && x < hx : x < xs[y] && x > hx)) c = ',';
        else if (d <= 2 + ((y * 7 + x) % 5 === 0 ? 2 : 0)) c = r() < 0.13 ? 'b' : '.';
        else if (d <= 5 && r() < 0.5) c = r() < 0.18 ? 'b' : '.';
        else c = 'T';
        if ((x === 0 || x === AW - 1) && c !== ',') c = 'T';
        row += c;
      }
      rows.push(row);
    }
    for (let y = hy - 1; y <= hy + 1; y++) for (let x = hx - 2; x <= hx + 2; x++) setc(rows, x, y, '.');
    return { rows, xs, hx, hy };
  }

  function make(kind, seed, rank) {
    rank = rank || 0;
    const r = RH.rng(seed * 104729 + kind.length * 7);
    const K = KINDS[kind] || KINDS.wagon;
    const { rows, xs, hx, hy } = roadMap(r);
    const road = (y) => xs[y];
    const place = ROADS[seed % ROADS.length];
    const m = {
      id: 'amb-' + kind + '-' + seed, kind: 'ambush', akind: kind, seed, rank, theme: 'forest',
      title: K.name + ': ' + place, place, type: 'Roadside ambush', ic: K.ic,
      night: r() < 0.3, map: rows, reward: 0, slots: 5,
      heroes: {}, band: [hx, hy + 1],
      exit: { x: hx - 1, y: hy - 1, w: 3, h: 3 },
      guards: [], gold: [], traps: [], props: [], tips: [],
    };
    ['robin', 'john', 'marian', 'tuck', 'scarlet'].forEach((k, i) => { m.heroes[k] = [hx - 2 + i, hy]; });
    // leaf-covered pits on the road and a trap net on a post
    for (const y of [5 + Math.floor(r() * 5), 18 + Math.floor(r() * 6)]) m.traps.push({ kind: 'pit', x: road(y) + (r() < 0.5 ? 0 : 1), y });
    const ny = 9 + Math.floor(r() * 3);
    const postX = road(ny) + (hx > road(ny) ? 3 : -2);
    setc(rows, postX, ny, '.');
    m.props.push({ id: 'netpost', kind: 'target', x: postX, y: ny, netAt: [road(ny), ny], label: '\u{1F3AF} Shoot the trap-net rope' });
    const gate = rank >= 2 ? 'officer' : 'soldier';
    const purse = () => 4 + Math.floor(r() * 8);
    if (kind === 'collector') {
      const top = 1, bot = AH - 2;
      const a = [road(top), top], b = [road(bot), bot];
      const cp = 45 + rank * 15 + Math.floor(r() * 20);
      m.guards.push({ type: 'collector', name: 'the tax collector', purse: cp, route: [[a[0], a[1], 1], [b[0], b[1], 1]] });
      m.guards.push({ type: rank >= 3 ? 'knight' : gate, purse: purse() + 8, route: [[a[0] + 1, a[1] + 1, 1], [b[0] + 1, b[1] - 1, 1]] });
      m.guards.push({ purse: purse(), route: [[a[0], a[1] + 2, 1], [b[0], b[1] - 2, 1]] });
      if (rank >= 1) m.guards.push({ type: 'archer', purse: purse(), route: [[a[0] + 1, a[1] + 3, 1], [b[0] + 1, b[1] - 3, 1]] });
      m.objectives = [{ k: 'gold', n: cp, text: 'Rob the collector' }];
      m.intro = 'A tax collector walks ' + place + ' with his guards and a purse full of the shire\u2019s money.\n\nKnock him down and search him. He is a coward and runs if he sees you. The ambush is over the moment his purse is ours.';
      m.tips.push({ id: 'coll', when: 'start', text: 'The collector runs if he sees you. Knock him out, then tap him to search him. The pits and the trap-net post can deal with his guards.' });
    } else {
      const ys = [0]; for (let y = 4; y < AH - 1; y += 4) ys.push(y); ys.push(AH - 1);
      const path = ys.map((y) => [road(y) + 1, y]);
      const value = kind === 'supply' ? 25 + rank * 10 : 55 + rank * 20 + Math.floor(r() * 20);
      m.convoy = { path, logStop: 3, logWait: 14, speed: 0.6, value };
      m.guards.push({ escort: [-1.1, -1.4], purse: purse() });
      m.guards.push({ escort: [1.1, -1.4], purse: purse(), type: rank >= 2 ? 'archer' : 'soldier' });
      if (rank >= 1 || kind === 'wagon') m.guards.push({ escort: [0, -2.6], purse: purse() + 5, type: gate });
      if (rank >= 3) m.guards.push({ escort: [0, 1.6], purse: purse(), type: 'knight' });
      m.objectives = [{ k: 'gold', n: value, text: kind === 'supply' ? 'Take the supply cart\u2019s silver' : 'Take the strongbox' }];
      if (kind === 'supply') m.loot = { arrows: 8, ale: 1, potions: 1 };
      m.intro = (kind === 'supply' ? 'A supply cart for the garrison rolls along ' : 'A wagon with a strongbox for the Prince rolls along ') + place + '. We have felled a tree across the road; the carter will have to stop.\n\nKnock out the carter and take the box. The ambush ends the moment the silver is ours.';
      m.tips.push({ id: 'wagon', when: 'start', text: 'The wagon stops at the felled tree for a while. Knock out the carter (tap him), then tap the wagon to take the box. On the road Robin fights with a quarterstaff: his blows don\u2019t kill.' });
    }
    m.tips.push({ id: 'traps', when: 'time10', text: 'Leaf-covered pits on the road swallow any soldier who walks over them. Shoot the target on the post to drop a net on the road beside it.' });
    if (r() < 0.45) {
      const y = 3 + Math.floor(r() * 4), x = road(y) + (r() < 0.5 ? -1 : 2);
      setc(rows, x, y, '.'); m.captive = [x, y];
    }
    for (let i = 0; i < 3; i++) {
      const y = 3 + Math.floor(r() * (AH - 6)); const x = road(y) + (r() < 0.5 ? -2 : 3);
      if (x > 0 && x < AW - 1 && '.,'.includes(rows[y][x])) m.gold.push([x, y, 5 + Math.floor(r() * 3) * 5]);
    }
    return m;
  }
  RH.ambush = { make, KINDS };

  // 1-2 roadside jobs after each story mission; they're gone once you play the next story mission
  RH.makeOffers = function (P) {
    P.offerSeed = (P.offerSeed || 7) + 13;
    const r = RH.rng(P.offerSeed * 31);
    const ks = Object.keys(KINDS);
    const n = 1 + (r() < 0.6 ? 1 : 0);
    const out = [];
    for (let i = 0; i < n; i++) out.push({ kind: ks[Math.floor(r() * ks.length)], seed: Math.floor(r() * 9000) + 1 });
    return out;
  };

  // ---------- The Sherwood camp map (defence and camp walk) ----------
  const CAMP = [
    'TTTTTTTTTTTTT,,TTTTTTTTTTTTT',
    'TTTTTTTTTTTT.,,.TTTTTTTTTTTT',
    'TTTTTTTTTTT..,,..TTTTTTTTTTT',
    'TTTTTTTTTb...,,...bTTTTTTTTT',
    'TTTTTTT......,,......TTTTTTT',
    'TTTTTT...p...,,...p...TTTTTT',
    'TTTTT................b.TTTTT',
    'TTTT..b....l......l.....TTTT',
    'TTTT...p............p...TTTT',
    'TTT.....................bTTT',
    'TTT....,,,,,,,,,,,,,,....TTT',
    'TTTb...,............,...bTTT',
    'TT.....,..p......p..,.....TT',
    ',,,,,,,,..............,,,,,,',
    ',,,,,,,,......c.......,,,,,,',
    'TT.....,..p......p..,.....TT',
    'TTTb...,............,...bTTT',
    'TTT....,,,,,,,,,,,,,,....TTT',
    'TTT.....................TTTT',
    'TTTT...p.....,,.....p...TTTT',
    'TTTT..b......,,......b..TTTT',
    'TTTTT........,,........TTTTT',
    'TTTTTT..h....,,....h..TTTTTT',
    'TTTTTTT......,,......TTTTTTT',
    'TTTTTTTTb....,,....bTTTTTTTT',
    'TTTTTTTTT....,,....TTTTTTTTT',
    'TTTTTTTTTT...,,...TTTTTTTTTT',
    'TTTTTTTTTTTTT,,TTTTTTTTTTTTT',
  ];
  const campHeroes = () => ({ robin: [12, 15], john: [15, 15], marian: [11, 14], tuck: [16, 14], scarlet: [13, 16] });

  RH.defenseMission = function (rank) {
    rank = rank || 1;
    return {
      id: 'defense', kind: 'defense', rank, theme: 'forest', night: true, title: 'The Defence of Sherwood', place: 'Our camp in Sherwood', type: 'Base defence', ic: '🛡',
      map: CAMP.slice(), heroes: campHeroes(), band: [14, 16], slots: 8,
      exit: { x: -9, y: -9, w: 1, h: 1 },
      objectives: ['defend'],
      torches: [[14, 13], [10, 12], [17, 12], [10, 15], [17, 15]],
      props: [{ id: 'fire', kind: 'fire', x: 14, y: 13 }],
      defense: {
        fire: [14, 13], max: 4,
        waves: [
          { t: 4, n: 4, from: [[13, 0], [14, 0]], types: ['soldier', 'soldier', 'archer', 'soldier'] },
          { t: 45, n: 5, from: [[0, 13], [27, 14]], types: ['soldier', 'halberd', 'soldier', 'archer', 'soldier'] },
          { t: 90, n: 6, from: [[13, 0], [0, 14], [27, 13]], types: ['officer', 'soldier', 'soldier', 'archer', 'soldier', rank >= 3 ? 'knight' : 'soldier'] },
        ],
      },
      guards: [], gold: [],
      intro: 'The Sheriff knows where we sleep. Scouts report three companies marching into Sherwood tonight, coming for the camp fire under the great oak.\n\nKnock them down before they reach the fire: if four get through, the camp is lost. Every blazon you have gathered turns two of his men away before the fight.',
      outro: 'By dawn the Sheriff\u2019s men are tied to the trees in a long, embarrassed row. Tuck walks along it handing out ale.\n\nSherwood is ours. Let them come again.',
      reward: 80,
      tips: [{ id: 'def', when: 'start', text: 'They come down the trails from the north, east and west. Wait for them in the bushes and knock them down as they pass. Arrows and nets are your friends tonight.' }],
    };
  };

  RH.JOBPOS = { rest: [13, 15], arrows: [9, 11], purses: [17, 11], nets: [9, 16], potions: [17, 16], apples: [5, 9], ale: [21, 9], hives: [7, 21], train: [20, 20], hunt: [4, 12], scout: [13, 4] };
  RH.baseMission = function () {
    const props = [{ id: 'fire', kind: 'fire', x: 14, y: 13 }];
    const owned = (RH.profile && RH.profile.heroes) || [];
    for (const j of RH.JOBS) {
      const p = RH.JOBPOS[j.id]; if (!p) continue;
      if (j.need && !owned.includes(j.need)) continue;
      props.push({ id: 'st-' + j.id, kind: 'station', job: j.id, x: p[0], y: p[1], label: j.ic + ' ' + j.name + ' (' + j.desc + ')', name: j.name, ic: j.ic });
    }
    return {
      id: 'base', kind: 'base', theme: 'forest', title: 'Walk the camp', place: 'Our camp in Sherwood', type: 'Base inspection',
      map: CAMP.slice(), heroes: { robin: [14, 17] }, band: [14, 18], slots: 99,
      exit: { x: 12, y: 25, w: 4, h: 3 },
      objectives: [], props, guards: [], gold: [], torches: [[14, 13]],
      intro: '', reward: 0,
      tips: [{ id: 'base', when: 'start', text: 'Each man stands at his job. Select a merry man, then tap a work station to give him that job. Jobs pay out once for every mission you play. Tap \u2714 Done when you\u2019re finished.' }],
    };
  };
  RH.CAMP_MAP = CAMP;
})(window.RH);
