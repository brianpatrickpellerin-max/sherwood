// HUD, menus, camp hub, and touch input.
'use strict';
(function (RH) {
  const ui = {};
  RH.ui = ui;
  const G = RH.G;
  const TILE = RH.TILE;
  const $ = (id) => document.getElementById(id);
  let canvas;
  let screenName = null;
  let hudSig = '', actSig = '', objSig = '', porSig = '';
  let tipOpen = false, tipTimer = 0;

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const sfx = (n) => RH.audio.play(n);

  ui.init = function (cv) {
    canvas = cv;
    RH.art && RH.art.init();
    setupInput();
    $('minibox').addEventListener('click', (e) => {
      if (!G.m) return;
      const mm = $('minimap'), r = mm.getBoundingClientRect();
      if (e.clientY > r.bottom + 2) { $('objbox').classList.toggle('collapsed'); return; }
      const M = RH.render.mini; if (!M) return;
      const w = RH.render.miniToWorld((e.clientX - r.left) / r.width * M.w, (e.clientY - r.top) / r.height * M.h);
      if (w) { RH.main.centerOn(w.x, w.y); sfx('tap'); }
    });
    $('btnPause').addEventListener('click', () => { sfx('tap'); ui.showPause(); });
    $('btnSound').addEventListener('click', () => { toggleSound(); });
    $('tipok').addEventListener('click', () => ui.closeTip());
    $('targetcancel').addEventListener('click', () => setMode(null));
    $('btnResume2').addEventListener('click', () => { G.paused = false; ui.refresh(true); });
    $('objbox').addEventListener('click', () => $('objbox').classList.toggle('collapsed'));
    updateSoundBtn();
  };

  function toggleSound() {
    RH.audio.setMuted(!RH.audio.muted);
    RH.profile.muted = RH.audio.muted; RH.saveProfile();
    updateSoundBtn(); sfx('select');
  }
  function updateSoundBtn() {
    $('btnSound').textContent = RH.audio.muted ? '🔇' : '🔊';
    document.querySelectorAll('[data-sound]').forEach((b) => (b.textContent = RH.audio.muted ? '🔇 Sound: off' : '🔊 Sound: on'));
  }
  ui.updateSoundBtn = updateSoundBtn;

  // ---------- Toasts / tips ----------
  let lastToast = '', lastToastT = 0;
  ui.toast = function (text, kind) {
    const now = performance.now();
    if (text === lastToast && now - lastToastT < 2500) return;
    lastToast = text; lastToastT = now;
    const box = $('toasts');
    const d = document.createElement('div');
    d.className = 'toast' + (kind ? ' ' + kind : '');
    d.textContent = text;
    box.appendChild(d);
    while (box.children.length > 3) box.removeChild(box.firstChild);
    setTimeout(() => d.remove(), 2600);
  };
  ui.tip = function (text) {
    $('tiptext').textContent = text;
    $('tip').classList.remove('hidden');
    tipOpen = true; tipTimer = Math.max(9, text.length / 9);
  };
  ui.closeTip = function () { $('tip').classList.add('hidden'); tipOpen = false; };
  ui.tipShowing = () => tipOpen;
  ui.tickTip = function (dt) { if (tipOpen && !G.paused) { tipTimer -= dt; if (tipTimer <= 0) ui.closeTip(); } };

  // ---------- Screens ----------
  function show(html, overlay) {
    const s = $('screen');
    s.classList.remove('hidden');
    s.classList.toggle('overlay', !!overlay);
    const isTitle = screenName === 'title';
    s.classList.toggle('titlescr', isTitle);
    $('titlebg').classList.toggle('hidden', !isTitle);
    $('screenInner').innerHTML = html;
    s.scrollTop = 0;
    s.querySelectorAll('[data-act]').forEach((el) => el.addEventListener('click', (e) => { e.stopPropagation(); sfx('tap'); onAct(el.dataset.act, el.dataset.arg, el); }));
    s.querySelectorAll('canvas[data-por]').forEach((c) => {
      const rid = c.dataset.rid, rec = rid && RH.profile.recruits.find((r) => r.id === rid);
      RH.render.portrait(c, c.dataset.por, rec ? RH.recruitDef(rec) : undefined);
    });
    updateSoundBtn();
  }
  function hideScreen() { $('screen').classList.add('hidden'); $('titlebg').classList.add('hidden'); screenName = null; }
  ui.screen = () => screenName;

  function crestSVG() {
    return `<svg viewBox="0 0 100 100" aria-hidden="true">
      <path d="M50 6 Q70 18 66 42 Q62 62 50 70 Q38 62 34 42 Q30 18 50 6 Z" fill="#2f6a1e" stroke="#e8c25a" stroke-width="3"/>
      <path d="M50 14 L50 66" stroke="#9ad85a" stroke-width="1.6"/>
      <path d="M50 26 L40 20 M50 36 L38 30 M50 46 L40 42 M50 26 L60 20 M50 36 L62 30 M50 46 L60 42" stroke="#9ad85a" stroke-width="1.4"/>
      <path d="M18 80 Q50 50 82 80" fill="none" stroke="#7a4a22" stroke-width="5" stroke-linecap="round"/>
      <path d="M22 92 L78 50" stroke="#efe6c8" stroke-width="2.4" stroke-linecap="round"/><path d="M78 50 l-8 1 l4 5 z" fill="#ddd"/><path d="M24 90 l0 -7 l6 4 z" fill="#c33"/>
    </svg>`;
  }

  ui.showTitle = function () {
    screenName = 'title';
    $('hud').classList.add('hidden');
    const has = RH.hasSave();
    show(`<div class="title">
      <div class="logo">${crestSVG()}<div class="l1">Outlaws</div><div class="l2">of Sherwood</div></div>
      <div class="sub">Rob the rich. Feed the poor. Never be seen.</div>
      <div class="titlepanel">
      ${has ? '<button class="btn prim" data-act="continue">▶ Continue</button>' : ''}
      <button class="btn ${has ? '' : 'prim'}" data-act="newgame">${has ? '✦ New game' : '▶ Begin the legend'}</button>
      <div class="row"><button class="btn" data-act="howto">📜 How to play</button><button class="btn" data-act="sound" data-sound>🔇</button></div>
      <div class="foot">Best in portrait. Share → Add to Home Screen to play full screen and offline.</div>
      </div>
    </div>`);
    // paint the backdrop after the menu shows (building the scene takes a moment)
    setTimeout(() => { if (screenName === 'title') RH.art.drawTitle($('titlebg')); }, 30);
  };
  window.addEventListener('resize', () => { if (screenName === 'title') RH.art.drawTitle($('titlebg')); });

  ui.showHowto = function (back) {
    screenName = 'howto';
    show(`<div class="card scroll"><h2>How to play</h2><ul class="help">
      <li><b>Tap a portrait</b> to choose an outlaw. Tap it again (or 👥 All) to move the whole band.</li>
      <li><b>Tap the ground</b> to walk. <b>Drag</b> to look around, <b>pinch</b> to zoom.</li>
      <li><b>Green wedges</b> are what guards see; they sweep as the guard turns his head. Yellow means suspicious (?), flashing red means you’ve been spotted (!). On the minimap your band are green dots, guards red.</li>
      <li><b>🦶 Sneak</b> makes you much harder to spot. <b>Bushes and hay</b> hide you.</li>
      <li><b>Tap a guard</b> from behind to knock him out. <b>Tap the body</b> to tie him up, or a guard who finds him will shake him awake. Then <b>tap the body again</b> to carry it, and <b>tap a house door</b> to stuff it inside, out of sight for good.</li>
      <li><b>🏠 Houses:</b> tap a door to hide inside (the roof fades so you can see who’s in). Tap ‘Come out’ or the ground to leave.</li>
      <li><b>🌿 Ivy</b> on a house wall leads to the roof. Robin, Marian and Will climb it; walk along the rooftops, shoot from above, and jump down onto an unwary guard to flatten him.</li>
      <li><b>📯 The alarm horn:</b> when the alarm goes up a guard runs for the horn. If he blows it, soldiers keep marching in until the alarm dies down. Knock him out first, or stuff the horn with moss before you start trouble.</li>
      <li><b>Duels:</b> captains and the Sheriff wind up big blows: swipe across them the way the arrow shows to counter.</li>
      <li><b>Long-press</b> a guard or body for more choices: carry, shoot, charm…</li>
      <li><b>Sword fights: swipe across a guard.</b> Sideways ↔ is a quick slash. Downward ↓ is a heavy overhead blow that leaves him reeling, but it is often blocked. Upward ↑ is a thrust that can’t be blocked. A quick back-and-forth ↺ parries his next blow and leaves him open.</li>
      <li><b>🧗 Climbing:</b> scuffed hand-holds on a wall mark a spot Robin can climb. Tap it with Robin selected. Once he is up he lets down a rope, and the rest of the band can follow.</li>
      <li><b>Captured outlaws</b> (🔗) are held in some missions. Cut them loose and they join your band. Give gold to the poor at camp to win popularity: volunteers come to join you.</li>
      <li><b>Camp jobs:</b> men who stay in camp fletch arrows, brew draughts, hunt or train while you’re away.</li>
      <li><b>Skills</b> sit on the action bar. Robin: 🏹 bow and 💰 coin purses (two guards reaching one purse come to blows over it). Little John: one-blow knockouts on anyone, 🕸 nets that pin guards down, 🪢 net snares that hoist whoever steps in up into the trees, 🎵 a whistle that draws guards to look. Marian: walks freely among guards (unless they see her fight or carry a body), 🌹 charm and a bow. Tuck: ✚ heal and revive, 🐝 beehives (everyone near them panics and runs), 🍺 sleeping ale (any guard walks over, drinks and dozes off). Will Scarlet: 🪨 a sling that knocks out from afar and 🍎 apples that turn a guard’s head.</li>
      <li><b>Guards:</b> soldiers grab purses; caped officers and halberdiers don’t. Officers and knights need two blows; knights in great helms shrug off arrows. Archers shoot from afar. Black guards hold their posts. Gentlemen in fine clothes run to fetch the guard if they see you. Guards who find a fallen friend wake him and untie him.</li>
      <li><b>Beggars</b> (🪙) sell what they know: pay them and a parchment, a person or another beggar appears.</li>
      <li><b>Roadside ambushes</b> appear on the map after each story mission and are gone once you play the next. Rob the cart and its silver spills across the road: walk over the coins to scoop them up. Pits, trap nets and snares help; Robin fights with a quarterstaff on the road.</li>
      <li><b>Merry men</b> come in three kinds: 🔨 strongmen, 🌿 herbalists and 🏹 trappers. Men in camp work at a job while you’re away: walk the camp to set them.</li>
      <li><b>The King’s ransom:</b> once you learn of it, pay gold into the ransom chest at camp. The last mission opens when it is paid.</li>
      <li><b>⏸ Pause</b> any time. You can give orders while paused.</li>
      <li>Earn ★ for finishing, staying unseen and sparing lives. Spend gold at camp.</li>
    </ul></div>
    <button class="btn" data-act="${back || 'title'}">◀ Back</button>`);
  };

  // Parchment campaign map of the shire: forest, river, roads, town, castle and mission seals
  function mapSVG() {
    const P = RH.profile;
    const r = RH.rng(7);
    let trees = '';
    const tree = (x, y, s, col) => `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s.toFixed(2)})"><path d="M0 2.4 L0 0.6" stroke="#5a3a1a" stroke-width="0.5"/><path d="M-1.6 1 Q-2 -1.4 0 -2.2 Q2 -1.4 1.6 1 Z" fill="${col}" stroke="#3a2a10" stroke-width="0.25"/></g>`;
    for (let i = 0; i < 150; i++) {
      const x = 3 + r() * 52, y = 18 + r() * 56;
      if ((x - 30) ** 2 / 900 + (y - 48) ** 2 / 900 > 1) continue;
      trees += tree(x, y, 0.9 + r() * 0.8, r() < 0.15 ? '#9a6a2a' : r() < 0.5 ? '#4a6a2a' : '#3a5a22');
    }
    for (let i = 0; i < 22; i++) { const x = 62 + r() * 34, y = 56 + r() * 16; trees += tree(x, y, 0.7 + r() * 0.4, '#5a7a32'); }
    let fields = '';
    for (let i = 0; i < 9; i++) { const x = 64 + r() * 28, y = 30 + r() * 18; fields += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(4 + r() * 4).toFixed(1)}" height="${(2.5 + r() * 2).toFixed(1)}" fill="${r() < 0.5 ? '#c8b06a' : '#a8a05a'}" opacity="0.55" transform="rotate(${(r() * 30 - 15).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`; }
    let nodes = '', lines = '';
    const seal = (x, y, act, arg, fill, txt, sub, pulse) => `<g data-act="${act}" data-arg="${arg}" style="cursor:pointer">
        <circle cx="${x}" cy="${y}" r="5.6" fill="transparent"/>
        ${pulse ? `<circle cx="${x}" cy="${y}" r="6.2" fill="none" stroke="#e8a417" stroke-width="0.8"><animate attributeName="r" values="5.2;7;5.2" dur="1.6s" repeatCount="indefinite"/></circle>` : ''}
        <circle cx="${x}" cy="${y}" r="4.4" fill="${fill}" stroke="#3a1a08" stroke-width="0.7"/>
        <circle cx="${x}" cy="${y}" r="3.3" fill="none" stroke="#f0c060" stroke-width="0.3"/>
        <text x="${x}" y="${y + 1.5}" text-anchor="middle" font-size="${txt.length > 1 ? 3.4 : 4.2}" font-weight="800" font-family="Georgia" fill="#fff4d0">${txt}</text>
        ${sub ? `<text x="${x}" y="${y + 8.8}" text-anchor="middle" font-size="2.9" fill="#7a3a08">${sub}</text>` : ''}
      </g>`;
    RH.MISSIONS.forEach((m, i) => {
      const [x, y] = m.mapPos;
      if (i > 0) { const [px, py] = RH.MISSIONS[i - 1].mapPos; lines += `<path d="M${px} ${py} Q${(px + x) / 2 + 4} ${(py + y) / 2 + 6} ${x} ${y}" stroke="#7a1f14" stroke-width="0.7" stroke-dasharray="1.6 1.4" fill="none" opacity="${i < P.unlocked ? 0.8 : 0.2}"/>`; }
      const open = i < P.unlocked && !(m.needRansom && !RH.ransomPaid());
      const st = P.stars[i] || 0;
      nodes += seal(x, y, open ? 'brief' : 'locked', i, open ? (st ? '#2f6a1e' : '#9a1f12') : '#8a7a5a', open ? String(i + 1) : '?', open ? '★'.repeat(st) + '☆'.repeat(3 - st) : '', open && !st);
    });
    const spots = [[34, 26], [38, 64], [44, 33]];
    (P.offers || []).forEach((o, k) => { const [x, y] = spots[k % spots.length]; nodes += seal(x, y, 'amb', k, '#6a4a1a', RH.ambush.KINDS[o.kind].ic, 'today', true); });
    if (P.defenseOpen && !P.defenseDone) nodes += seal(10, 40, 'defense', 0, '#2a3a6a', '🛡', 'defend!', true);
    return `<svg class="map" viewBox="0 0 100 78" role="img" aria-label="Campaign map">
      <defs>
        <radialGradient id="pg" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#f0dfae"/><stop offset="0.75" stop-color="#ddc184"/><stop offset="1" stop-color="#b8945a"/></radialGradient>
        <pattern id="hatch" width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><line x1="0" y1="0" x2="0" y2="2" stroke="#8a6a3a" stroke-width="0.25" opacity="0.5"/></pattern>
      </defs>
      <rect x="0" y="0" width="100" height="78" fill="url(#pg)"/>
      <ellipse cx="30" cy="48" rx="29" ry="29" fill="#7a9a4a" opacity="0.18"/>
      <path d="M58 0 Q64 10 70 8 T86 16" fill="none" stroke="#9a8a6a" stroke-width="0.3"/>
      <path d="M2 4 Q12 1 24 6 Q30 9 38 5" fill="none" stroke="url(#hatch)" stroke-width="5" opacity="0.6"/>
      ${fields}${trees}
      <path d="M100 26 Q84 30 76 44 Q70 56 72 66 T64 78" stroke="#4a7a98" stroke-width="2.6" fill="none" opacity="0.75"/>
      <path d="M100 26 Q84 30 76 44 Q70 56 72 66 T64 78" stroke="#a8c8d8" stroke-width="0.6" fill="none" opacity="0.7"/>
      <path d="M36 0 Q38 20 36 32 Q34 50 40 78" stroke="#8a6a3a" stroke-width="1" stroke-dasharray="2.4 1.2" fill="none" opacity="0.8"/>
      <path d="M36 32 Q48 40 58 48 Q70 54 84 58" stroke="#8a6a3a" stroke-width="0.9" stroke-dasharray="2.4 1.2" fill="none" opacity="0.8"/>
      <g transform="translate(60 58)">
        <path d="M-9 -2 L-9 6 L9 6 L9 -2" fill="none" stroke="#5a4a3a" stroke-width="0.6"/>
        <rect x="-7" y="-1" width="4" height="4" fill="#d8c8a0" stroke="#3a2a1a" stroke-width="0.3"/><path d="M-7.6 -1 L-5 -3.4 L-2.4 -1 Z" fill="#9a3a24" stroke="#3a2a1a" stroke-width="0.3"/>
        <rect x="-1.5" y="-2" width="4" height="5" fill="#d8c8a0" stroke="#3a2a1a" stroke-width="0.3"/><path d="M-2.1 -2 L0.5 -4.8 L3.1 -2 Z" fill="#8a3420" stroke="#3a2a1a" stroke-width="0.3"/>
        <rect x="4" y="0" width="3.5" height="3.5" fill="#d8c8a0" stroke="#3a2a1a" stroke-width="0.3"/><path d="M3.4 0 L5.75 -2.4 L8.1 0 Z" fill="#9a3a24" stroke="#3a2a1a" stroke-width="0.3"/>
      </g>
      <g transform="translate(70 17)">
        <rect x="-7" y="-3" width="14" height="8" fill="#b8ac90" stroke="#3a2a1a" stroke-width="0.5"/>
        <path d="M-7 -3 h2 v-1.2 h1.4 v1.2 h1.6 v-1.2 h1.4 v1.2 h1.6 v-1.2 h1.4 v1.2 h1.6 v-1.2 h1.4 v1.2 h2" fill="none" stroke="#3a2a1a" stroke-width="0.4"/>
        <rect x="-9" y="-6" width="4" height="11" fill="#b8ac90" stroke="#3a2a1a" stroke-width="0.5"/><path d="M-9.6 -6 L-7 -9.6 L-4.4 -6 Z" fill="#6a5a7a" stroke="#3a2a1a" stroke-width="0.4"/>
        <rect x="5" y="-6" width="4" height="11" fill="#b8ac90" stroke="#3a2a1a" stroke-width="0.5"/><path d="M4.4 -6 L7 -9.6 L9.6 -6 Z" fill="#6a5a7a" stroke="#3a2a1a" stroke-width="0.4"/>
        <rect x="-1.4" y="1" width="2.8" height="4" fill="#3a2a1a"/>
      </g>
      <g transform="translate(90 60)"><rect x="-3" y="-6" width="6" height="10" fill="#a89a80" stroke="#3a2a1a" stroke-width="0.5"/><path d="M-3.6 -6 L0 -9.6 L3.6 -6 Z" fill="#6a5a7a" stroke="#3a2a1a" stroke-width="0.4"/></g>
      <g transform="translate(9 72)"><path d="M-3.5 2.5 L0 -3 L3.5 2.5 Z" fill="#e8d8a8" stroke="#3a2a1a" stroke-width="0.4"/><path d="M1 2.5 L4 -1.5 L7 2.5 Z" fill="#d8c898" stroke="#3a2a1a" stroke-width="0.4"/><circle cx="-5" cy="2" r="0.9" fill="#e86a20"/></g>
      <text x="21" y="16" font-size="5" font-family="Palatino, Georgia" font-style="italic" fill="#2a4a1a" opacity="0.9">Sherwood Forest</text>
      <text x="60" y="65" text-anchor="middle" font-size="3.6" font-family="Palatino, Georgia" fill="#4a2a10">Nottingham</text>
      <text x="70" y="26.5" text-anchor="middle" font-size="3" font-family="Palatino, Georgia" fill="#4a2a10">the Castle</text>
      <text x="88" y="45" font-size="2.8" font-family="Palatino, Georgia" font-style="italic" fill="#2a5a7a" transform="rotate(-50 88 45)">river</text>
      <text x="14" y="77" font-size="3" font-family="Palatino, Georgia" fill="#2a4a1a">our camp</text>
      ${lines}${nodes}
      <g transform="translate(93 9)"><circle r="5" fill="none" stroke="#6a4a1a" stroke-width="0.5"/><text y="-5.8" text-anchor="middle" font-size="3" fill="#6a4a1a">N</text><path d="M0 -4 L1.4 0 L0 4 L-1.4 0 Z" fill="#6a4a1a"/></g>
      <rect x="0.6" y="0.6" width="98.8" height="76.8" fill="none" stroke="#6a4a1a" stroke-width="0.6"/>
    </svg>`;
  }

  const jobName = (id) => (RH.JOBS.find((j) => j.id === id) || RH.JOBS[0]);
  const jobsFor = () => RH.JOBS.filter((j) => !j.need || RH.profile.heroes.includes(j.need));
  ui.showCamp = function (note) {
    screenName = 'camp';
    $('hud').classList.add('hidden');
    const P = RH.profile;
    const roster = RH.rosterUnlocked();
    const band = RH.HERO_ORDER.map((k) => {
      const d = RH.HEROES[k]; const has = roster.includes(k);
      return `<div class="member ${has ? '' : 'locked'}"><canvas data-por="${k}" width="72" height="72"></canvas><div>${has ? esc(d.name) : '???'}</div></div>`;
    }).join('');
    const shop = RH.SHOP.filter((it) => !it.need || (P.defenseOpen && !P.defenseDone)).map((it) => {
      const owned = it.kind === 'up' && P.up[it.id];
      const can = !owned && P.gold >= it.cost;
      const have = { arrows: P.arrows, potion: P.potions, net: P.nets, blazon: P.blazons }[it.id];
      return `<div class="shopitem"><div class="d"><b>${esc(it.name)}</b>${have != null ? ` (have ${have})` : ''}<br>${esc(it.desc)}</div>
        <button data-act="buy" data-arg="${it.id}" ${can ? '' : 'disabled'}>${owned ? 'Owned' : '£ ' + it.cost}</button></div>`;
    }).join('');
    const next = Math.min(P.unlocked, RH.MISSIONS.length) - 1;
    const allDone = P.stars.filter((s) => s > 0).length >= RH.MISSIONS.length;
    const list = RH.MISSIONS.map((m, i) => {
      if (i >= P.unlocked) return `<button class="btn" disabled>🔒 ${i + 1}. ???</button>`;
      if (m.needRansom && !RH.ransomPaid()) return `<button class="btn" data-act="locked" data-arg="ransom">🔒 ${i + 1}. ${esc(m.title)} (pay the King’s ransom first)</button>`;
      return `<button class="btn ${i === next && !P.stars[i] ? 'prim' : ''}" data-act="brief" data-arg="${i}">${i + 1}. ${esc(m.title)} <span style="color:#f2c94c">${'★'.repeat(P.stars[i] || 0)}</span></button>`;
    }).join('');
    const offers = (P.offers || []).map((o, k) => { const K = RH.ambush.KINDS[o.kind]; return `<button class="btn" data-act="amb" data-arg="${k}">${K.ic} ${esc(K.name)} <small>· today only</small></button>`; }).join('');
    const nxt = RH.nextPopStep(P.pop);
    const prev = [0].concat(RH.POP_STEPS).filter((s) => s <= P.pop).pop() || 0;
    const k = nxt ? (P.pop - prev) / (nxt - prev) : 1;
    const alms = [10, 25, 50].map((v) => `<button class="btn" data-act="alms" data-arg="${v}" ${P.gold >= v ? '' : 'disabled'}>£ ${v}</button>`).join('');
    const men = P.recruits.length ? P.recruits.map((rc) => {
      const d = RH.recruitDef(rc);
      return `<div class="recruit"><canvas data-por="outlaw" data-rid="${rc.id}" width="52" height="52"></canvas>
        <div class="info"><b>${esc(rc.name)}</b> <small>${d.icon} ${esc(d.clsName)}</small><small>Health ${d.hp}${rc.train ? ' (trained +' + rc.train + ')' : ''} · ${esc(jobName(rc.job).name)}: ${esc(jobName(rc.job).desc)}</small>
        <div class="jobs">${jobsFor().map((j) => `<button class="${rc.job === j.id ? 'on' : ''}" data-act="job" data-arg="${rc.id}:${j.id}" aria-label="${esc(j.name)}" title="${esc(j.name)}">${j.ic}</button>`).join('')}</div></div></div>`;
    }).join('') : '<p class="small-note">No outlaws have joined yet. Free captured men on missions, or give to the poor until volunteers come.</p>';
    const ransom = P.ransomOpen ? `<div class="card scroll"><h2>👑 The King’s Ransom</h2>
        <p class="small-note">King Richard is held for ransom abroad, and the Prince will never pay it. Every penny paid in here brings him home. The last mission opens once it is paid.</p>
        <div class="popbar"><i style="width:${Math.round(100 * Math.min(1, P.ransom / RH.RANSOM))}%"></i></div>
        <div class="small-note">£ ${P.ransom} of £ ${RH.RANSOM}${RH.ransomPaid() ? ' · paid in full!' : ''}</div>
        ${RH.ransomPaid() ? '' : `<div class="alms">${[25, 50, 100].map((v) => `<button class="btn" data-act="ransom" data-arg="${v}" ${P.gold >= 1 ? '' : 'disabled'}>£ ${v}</button>`).join('')}</div>`}</div>` : '';
    const defense = P.defenseOpen && !P.defenseDone ? `<div class="card scroll"><h2>🛡 The Defence of Sherwood</h2>
        <p class="small-note">The Sheriff is gathering men to raid the camp. Each blazon you hold turns 2 of his men away before the fight. Buy them below, or set 3 men to 👁 Scout the roads for one a day.</p>
        <div class="small-note">Blazons: <b>${P.blazons}</b></div>
        <button class="btn prim" data-act="defense">🛡 Defend the camp</button></div>` : '';
    const treasures = P.treasures.length ? `<div class="card"><h2>Royal treasures (${P.treasures.length}/5)</h2><div class="small-note">${P.treasures.map((t) => '👑 ' + esc(t)).join(' · ')}</div></div>` : '';
    show(`<div class="hdr"><h1>Sherwood Camp</h1><div class="pills"><div class="goldpill">£ ${P.gold}</div><div class="goldpill">♥ ${Math.floor(P.pop)}</div><div class="goldpill">Day ${P.day}</div></div></div>
      ${note ? `<div class="card"><p>${note}</p></div>` : ''}
      ${allDone ? '<div class="card"><p><b>The legend is complete!</b> Replay any mission to earn more stars and gold.</p></div>' : ''}
      <div class="mapwrap">${mapSVG()}</div>
      <div style="margin-top:6px">${list}</div>
      ${offers ? `<div class="card"><h2>On the roads today</h2><p class="small-note">Ambushes for gold and men. They’re gone once you play the next story mission.</p>${offers}</div>` : ''}
      ${defense}${ransom}
      <div class="card scroll"><h2>The poor of the shire</h2>
        <p class="small-note">Give gold to the villagers to raise your popularity. Every so often word spreads and a volunteer walks into camp.</p>
        <div class="popbar"><i style="width:${Math.round(RH.clamp(k, 0, 1) * 100)}%"></i></div>
        <div class="small-note">Popularity ${Math.floor(P.pop)}${nxt ? ` · next volunteer at ${nxt}` : ' · the whole shire is with you'} · given so far £ ${P.given}</div>
        <div class="alms">${alms}</div></div>
      <div class="card scroll"><h2>Merry men</h2><p class="small-note">Men left in camp work while the band is away; their work is done once for each mission you play.</p>${men}
        ${P.recruits.length ? '<button class="btn" data-act="base">🏕 Walk the camp</button>' : ''}</div>
      <div class="card"><h2>The band</h2><div class="band">${band}</div></div>
      ${treasures}
      <div class="card"><h2>Supplies</h2><div class="small-note">🏹 ${P.arrows} · 🧪 ${P.potions} · 💰 ${P.purses} · 🕸 ${P.nets} · 🍎 ${P.apples} · 🍺 ${P.ale} · 🐝 ${P.hives}</div>${shop}</div>
      <div class="row"><button class="btn" data-act="howto" data-arg="camp">📜 How to play</button><button class="btn" data-act="sound" data-sound>🔇</button></div>
      <button class="btn" data-act="title">◀ Title screen</button>`);
  };

  let briefPick = [], heroPick = null, briefSpec = 0;
  const OBJ_TEXT = {
    steal: 'Steal the tax chest', convoy: 'Stop the cart and take its chest', sheriff: 'Capture the Sheriff alive (knock out and tie up)',
    exit: 'Bring everyone to the exit', noalarm: 'Don’t let the alarm be raised', nokill: 'Kill no one', deliver: 'Deliver the letter',
    contest: 'Win the archery contest', blazons: 'Take the blazon points', defend: 'Keep the Sheriff’s men from the camp fire', boss: 'Defeat the captain',
  };
  function briefObjs(m) {
    return (m.objectives || []).map((o) => {
      if (typeof o === 'object') return o.text || OBJ_TEXT[o.k] || o.k;
      const [k, id] = o.split(':');
      if (k === 'free') { const pr = (m.prisoners || []).find((x) => x.id === id); return 'Free ' + (pr && pr.name || (RH.HEROES[id] ? RH.HEROES[id].name : id)); }
      if (k === 'meet') { const c = (m.contacts || []).find((x) => x.id === id); return 'Meet ' + (c ? c.name : id); }
      if (k === 'use') { const pr = (m.props || []).find((x) => x.id === id); return pr ? ({ banner: 'Raise the banner', bell: 'Ring the bell', winch: 'Work the winch', lever: 'Open the gate' }[pr.kind] || 'Use it') : id; }
      if (k === 'listen') return 'Overhear the council from the listening spot';
      if (k === 'boss') { const b = (m.guards || []).find((g) => g.boss); return 'Defeat ' + (b ? b.name : 'the captain'); }
      return OBJ_TEXT[k] || k;
    });
  }
  ui.showBrief = function (spec, keep) {
    screenName = 'brief';
    briefSpec = spec;
    const m = RH.main.missionFor(spec);
    const P = RH.profile;
    const avail = Object.keys(m.heroes).filter((k) => P.heroes.includes(k) || (m.need || []).includes(k));
    if (!keep) heroPick = avail.slice(0, m.kind === 'defense' ? 5 : 5);
    heroPick = heroPick.filter((k) => avail.includes(k));
    for (const k of m.need || []) if (avail.includes(k) && !heroPick.includes(k)) heroPick.unshift(k);
    const slots = m.kind === 'defense' ? 8 : Math.max(0, Math.min(m.slots != null ? m.slots : 5, 5 - heroPick.length));
    if (!keep) {
      briefPick = (P.band || []).filter((id) => P.recruits.some((r) => r.id === id));
      for (const r of P.recruits) { if (!briefPick.includes(r.id) && r.job === 'rest') briefPick.push(r.id); }
    }
    briefPick = briefPick.slice(0, slots);
    const men = slots && P.recruits.length ? `<h3>Merry men (${briefPick.length}/${slots})</h3>
      <div class="band">${P.recruits.map((rc) => `<div class="member pick ${briefPick.includes(rc.id) ? 'on' : ''}" data-act="pick" data-arg="${rc.id}"><canvas data-por="outlaw" data-rid="${rc.id}" width="72" height="72"></canvas><div>${RH.recruitDef(rc).icon} ${esc(rc.name.split(' ')[0])}</div></div>`).join('')}</div>
      <p class="small-note">Tap to bring a man along (at most 5 in the band). Men on a mission don’t work in camp that day.</p>` : '';
    const num = typeof spec === 'number' ? (spec + 1) + '. ' : '';
    const sky = m.night ? ' · Night' : m.weather === 'fog' ? ' · Fog' : m.weather === 'snow' ? ' · Snow' : ' · Day';
    show(`<div class="card scroll"><div class="place">${esc(m.place)}${sky} · ${esc(m.type || '')}</div><h2>${num}${esc(m.title)}</h2>
      <p>${esc(m.intro)}</p>
      <h3>Objectives</h3><ul class="objs">${briefObjs(m).map((o) => `<li>${esc(o)}</li>`).join('')}${m.captive ? '<li><i>Optional:</i> free a captured outlaw. He’ll join the band</li>' : ''}${m.treasure && !P.treasures.includes(m.treasure.id) ? '<li><i>Optional:</i> a royal treasure is hidden here</li>' : ''}</ul>
      <h3>Your band</h3><div class="band">${avail.map((k) => `<div class="member pick ${heroPick.includes(k) ? 'on' : ''}" data-act="hpick" data-arg="${k}"><canvas data-por="${k}" width="72" height="72"></canvas><div>${esc(RH.HEROES[k].name)}${(m.need || []).includes(k) ? ' ✦' : ''}</div></div>`).join('') || '<p class="small-note">None of the named heroes can come.</p>'}</div>
      ${men}
      ${m.climbs && m.climbs.length ? '<p class="small-note">🧗 There is a place here where Robin can climb the wall.</p>' : ''}
      ${m.kind === 'defense' ? `<p class="small-note">🛡 Blazons held: ${P.blazons}. Each turns 2 raiders away.</p>` : ''}
      <p class="small-note">★ Finish · ★ Never spotted, no alarm · ★ Nobody killed</p></div>
      <button class="btn prim" data-act="begin">⚔️ Begin mission</button>
      <button class="btn" data-act="camp">◀ Back to camp</button>`);
  };

  ui.showPause = function () {
    if (!G.m || G.over) return;
    G.paused = true; setMode(null); closeCtx();
    screenName = 'pause';
    show(`<div class="card" style="text-align:center"><h2>Paused</h2><p class="small-note">${esc(G.m.title)} · ${fmtTime(G.time)}</p>
      <ul class="objs" style="text-align:left">${RH.game.objectives().map((o) => `<li>${o.done ? '✅' : o.neg ? '⚠️' : '◻️'} ${esc(o.text)}</li>`).join('')}</ul></div>
      <button class="btn" data-act="resume">▶ Resume</button>
      <button class="btn sec" data-act="plan">🧭 Plan while paused</button>
      <button class="btn sec" data-act="howto" data-arg="pause">📜 Controls</button>
      <button class="btn sec" data-act="sound" data-sound>🔇 Sound: off</button>
      <div class="row"><button class="btn red" data-act="restart">↻ Restart</button><button class="btn red" data-act="quit">🏕 Camp</button></div>`, true);
  };

  ui.onEnd = function (res) {
    const run = G.runId;
    if (res.win) RH.commitWin(res);
    setTimeout(() => { if (G.runId === run && G.over === res) showEnd(res); }, res.win ? 700 : 900);
  };
  function showEnd(res) {
    screenName = 'end';
    closeCtx(); setMode(null);
    const st = res.stats;
    const amb = G.kind === 'ambush';
    if (res.win) {
      const reward = RH.commitWin(res);
      const stars = [0, 1, 2].map((k) => `<span class="${k < res.stars ? '' : 'off'}">★</span>`).join('');
      const outro = G.m.outro || 'The silver is shared out in the villages by nightfall, and the story of it travels faster than the Sheriff\u2019s riders.';
      show(`<div class="card" style="text-align:center"><div class="place">${amb ? 'Ambush complete' : 'Mission complete'}</div><h2>${esc(G.m.title)}</h2>
        ${amb ? '' : `<div class="stars">${stars}</div>`}
        <div style="text-align:left">
        <div class="stat big"><span>Money</span><b>£ ${st.gold}</b></div>
        <div class="stat big"><span>Spared lives</span><b>${st.spared != null ? st.spared : 100}%</b></div>
        <div class="stat big"><span>Time</span><b>${fmtTime(st.time)}</b></div>
        ${st.alms ? `<div class="stat"><span>Given to beggars</span><b>£ ${st.alms}</b></div>` : ''}
        <div class="stat"><span>Knocked out / slain</span><b>${st.ko} / ${st.kills}</b></div>
        ${amb ? '' : `<div class="stat"><span>Finished</span><b>★</b></div>
        <div class="stat"><span>Never spotted, no alarm</span><b>${!st.spotted && !st.alarm ? '★' : '—'}</b></div>
        <div class="stat"><span>Nobody killed</span><b>${st.kills === 0 ? '★' : '—'}</b></div>`}
        ${st.hidden ? `<div class="stat"><span>Bodies hidden indoors</span><b>${st.hidden}</b></div>` : ''}${st.snared ? `<div class="stat"><span>Hoisted in snares</span><b>${st.snared}</b></div>` : ''}${st.reinf ? `<div class="stat"><span>Reinforcements called</span><b>${st.reinf}</b></div>` : ''}
        <div class="stat"><span>${amb ? 'Into the camp chest' : 'Reward'}</span><b>£ ${reward}</b></div>
        </div>${newsHTML(G.campNews)}<p style="text-align:left">${esc(outro)}</p></div>
        <button class="btn" data-act="camp">🏕 Back to camp</button>
        ${amb || G.kind === 'defense' ? '' : '<button class="btn sec" data-act="retry">↻ Play again for more stars</button>'}`, true);
    } else {
      show(`<div class="card" style="text-align:center"><div class="place">Mission failed</div><h2>${esc(G.m.title)}</h2>
        <p>${esc(res.reason || '')}</p><p class="small-note">Try sneaking (🦶), hiding in bushes and tying up every guard you knock out.</p></div>
        <button class="btn" data-act="retry">↻ Try again</button>
        <button class="btn sec" data-act="camp">🏕 Back to camp</button>`, true);
    }
  }
  function newsHTML(n) {
    if (!n) return '';
    const bits = [];
    bits.push(`Word spreads: popularity +${n.popGain}.`);
    for (const r of n.joined) bits.push(`<b>${esc(r.name)}</b> has joined the band.`);
    for (const r of n.volunteers) bits.push(`A volunteer, <b>${esc(r.name)}</b>, walks into camp.`);
    const d = n.day, w = [];
    const NAMES = { arrows: 'arrows', potions: 'draughts', purses: 'purses', nets: 'nets', apples: 'apples', ale: 'mugs of ale', hives: 'beehives', blazons: 'blazons' };
    for (const k of Object.keys(NAMES)) if (d[k]) w.push(`${d[k]} ${NAMES[k]}`);
    if (d.gold) w.push(`£${d.gold}`);
    if (w.length) bits.push(`The men in camp made ${w.join(', ')}.`);
    if (d.trained.length) bits.push(`${esc(d.trained.join(', '))} trained hard (+1 health).`);
    return `<div class="news">${bits.join(' ')}</div>`;
  }
  const fmtTime = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

  function onAct(a, arg) {
    switch (a) {
      case 'continue': ui.showCamp(); break;
      case 'newgame':
        if (RH.hasSave() && arg !== 'yes') {
          screenName = 'confirm';
          show(`<div class="card" style="text-align:center"><h2>Start over?</h2><p>Your saved gold, stars and unlocked missions will be erased.</p></div>
            <button class="btn red" data-act="newgame" data-arg="yes">Yes, start a new game</button>
            <button class="btn sec" data-act="title">◀ Keep my progress</button>`);
          return;
        }
        RH.resetProfile(); ui.showBrief(0); break;
      case 'amb': { const o = RH.profile.offers[+arg]; if (o) ui.showBrief({ type: 'ambush', kind: o.kind, seed: o.seed }); break; }
      case 'defense': ui.showBrief({ type: 'defense' }); break;
      case 'base': RH.main.begin({ type: 'base' }); break;
      case 'ransom': { const n = RH.payRansom(+arg); const y = $('screen').scrollTop; ui.showCamp(n ? `£ ${n} paid toward the King’s ransom.` + (RH.ransomPaid() ? ' <b>The ransom is paid! King Richard is coming home, and the last mission is open.</b>' : '') : ''); $('screen').scrollTop = y; break; }
      case 'hpick': { if (heroPick.includes(arg)) heroPick = heroPick.filter((k) => k !== arg); else heroPick.push(arg); const y = $('screen').scrollTop; ui.showBrief(briefSpec, true); $('screen').scrollTop = y; break; }
      case 'howto': ui.showHowto(arg); break;
      case 'title': ui.showTitle(); break;
      case 'camp': RH.main.toCamp(); break;
      case 'sound': toggleSound(); break;
      case 'brief': ui.showBrief(+arg); break;
      case 'locked': ui.toastScreen(arg === 'ransom' ? 'Pay the King’s ransom at camp first' : 'Finish the earlier missions first'); break;
      case 'begin': RH.main.begin(briefSpec, briefPick.slice(), heroPick.slice()); break;
      case 'buy': RH.buy(arg); ui.showCamp(); break;
      case 'alms': {
        const joined = RH.giveAlms(+arg);
        const note = joined == null ? '' : `The villagers bless your name (popularity +${(+arg / 2)}).` + joined.map((r) => ` <b>${esc(r.name)}</b> has come to join the band!`).join('');
        const y = $('screen').scrollTop; ui.showCamp(note); $('screen').scrollTop = y; break;
      }
      case 'job': { const [rid, job] = arg.split(':'); RH.setJob(rid, job); const y = $('screen').scrollTop; ui.showCamp(); $('screen').scrollTop = y; break; }
      case 'pick': {
        const rid = arg;
        if (briefPick.includes(rid)) briefPick = briefPick.filter((x) => x !== rid); else briefPick.push(rid);
        const y = $('screen').scrollTop; ui.showBrief(briefSpec, true); $('screen').scrollTop = y; break;
      }
      case 'resume': hideScreen(); G.paused = false; ui.refresh(true); break;
      case 'plan': hideScreen(); G.paused = true; ui.refresh(true); break;
      case 'pause': ui.showPause(); break;
      case 'restart': case 'retry': RH.main.begin(G.spec != null ? G.spec : G.idx, G.heroes.filter((h) => h.rid && !h.fresh).map((h) => h.rid), G.picks); break;
      case 'quit': RH.main.toCamp(); break;
    }
  }
  ui.toastScreen = function (t) {
    const d = document.createElement('div'); d.className = 'toast'; d.textContent = t;
    d.style.cssText = 'position:fixed;left:50%;top:40%;transform:translateX(-50%);z-index:9';
    document.body.appendChild(d); setTimeout(() => d.remove(), 1800);
  };

  ui.enterGame = function () {
    hideScreen();
    $('hud').classList.remove('hidden');
    $('objbox').classList.remove('collapsed');
    $('portraits').innerHTML = '';
    ui.rosterChanged();
    ui.closeTip(); setMode(null); closeCtx();
    $('toasts').innerHTML = '';
    porSig = ''; actSig = ''; objSig = '';
    ui.refresh(true);
    // landscape phones: show only the current objective (tap to expand); small portrait screens collapse after a while
    if (window.innerHeight < 520) $('objbox').classList.add('collapsed');
    setTimeout(() => { if (window.innerHeight < 700 && G.m) $('objbox').classList.add('collapsed'); }, 12000);
  };

  // ---------- HUD ----------
  ui.rosterChanged = function () {
    const box = $('portraits');
    box.innerHTML = '';
    for (const h of G.heroes) {
      const b = document.createElement('button');
      b.className = 'por' + (h.rid ? ' recruit' : ''); b.dataset.id = h.id;
      const nm = h.def.short || h.name.replace('Little ', 'L. ').replace('Friar ', '').replace('Will ', '');
      b.innerHTML = `<canvas></canvas><div class="nm">${esc(nm)}</div><div class="sn"></div><div class="hp"><i></i></div>`;
      b.setAttribute('aria-label', h.name);
      b.addEventListener('click', () => onPortrait(h));
      box.appendChild(b);
      RH.render.portrait(b.querySelector('canvas'), h.key, h.def);
    }
    if (G.heroes.length > 1) {
      const a = document.createElement('button');
      a.className = 'por all'; a.id = 'porAll';
      a.innerHTML = '<div><span>👥</span>All</div>';
      a.addEventListener('click', () => { G.sel = G.heroes.filter((h) => !h.down); sfx('select'); ui.refresh(true); });
      box.appendChild(a);
    }
    porSig = '';
    ui.refresh(true);
  };

  function onPortrait(h) {
    sfx('select');
    if (G.mode === 'heal') { RH.game.orderAction('heal', { kind: 'hero', e: h }, G.heroes); setMode(null); return; }
    if (G.sel.length === 1 && G.sel[0] === h) {
      // second tap: select the whole band
      G.sel = G.heroes.filter((x) => !x.down);
    } else {
      G.sel = [h];
      RH.main.centerOn(h.x, h.y);
    }
    setMode(null);
    ui.refresh(true);
  }

  ui.refresh = function (force) {
    if (!G.m) return;
    // portraits
    const ps = $('portraits').children;
    let i = 0;
    for (const h of G.heroes) {
      const b = ps[i++];
      if (!b || b.dataset.id != h.id) { if (!force) ui.rosterChanged(); return; }
      const sel = G.sel.includes(h);
      b.classList.toggle('sel', sel);
      b.classList.toggle('down', h.down);
      const w = Math.round(100 * h.hp / h.maxhp) + '%';
      const bar = b.lastChild.firstChild;
      if (bar.style.width !== w) bar.style.width = w;
      const sn = h.sneak ? '🦶' : (h.carry ? '🧺' : '');
      if (b.children[2].textContent !== sn) b.children[2].textContent = sn;
    }
    const all = $('porAll');
    if (all) all.classList.toggle('sel', G.sel.length > 1);
    // money readout + minimap
    const money = RH.game.money();
    const mv = $('moneyv'); if (mv.textContent !== String(money)) mv.textContent = money;
    RH.render.drawMinimap($('minimap'));
    // objectives
    const objs = RH.game.objectives();
    let firstOpen = objs.findIndex((o) => !o.done && !o.neg && (!o.last || o.ready));
    const sig = objs.map((o) => (o.done ? 1 : 0) + (o.ready ? 'r' : '') + o.text).join('') + G.alarmed;
    if (sig !== objSig || force) {
      objSig = sig;
      $('mtitle').textContent = G.m.title;
      $('objlist').innerHTML = objs.map((o, k) => `<div class="o ${o.done && !o.neg ? 'done' : ''} ${o.neg && G.alarmed ? 'fail' : ''} ${k === firstOpen ? 'cur' : ''}">${o.done && !o.neg ? '✓' : o.neg ? '⚠' : (k === firstOpen ? '➜' : '•')} ${esc(o.text)}</div>`).join('');
    }
    // actions
    buildActions(force);
    $('pausedbar').classList.toggle('hidden', !(G.paused && !screenName) || !!G.mode);
  };

  const MODE_OF = { bow: 'shoot' };
  function buildActions(force) {
    const box = $('actions');
    const hs = G.sel.filter((h) => !h.down);
    const h = hs.length === 1 ? hs[0] : null;
    const inv = G.inv;
    const list = [];
    if (G.kind === 'base') list.push({ id: 'done', ic: '✔', t: 'Done' });
    if (hs.length && G.kind !== 'base') {
      const sneakOn = hs.every((x) => x.sneak);
      list.push({ id: 'sneak', ic: '🦶', t: 'Sneak', on: sneakOn });
    }
    if (h && !h.npc && G.kind !== 'base') {
      for (const ab of h.def.abil || []) {
        const A = RH.game.ABIL[ab]; if (!A) continue;
        const id = MODE_OF[ab] || ab;
        const it = { id, ic: A.ic, t: A.t };
        if (A.item) { it.cnt = inv[A.item] | 0; it.dis = it.cnt <= 0; }
        if (ab === 'charm' && G.cdMarian > 0) { it.t = Math.ceil(G.cdMarian) + 's'; it.dis = true; }
        if (ab === 'heal') { if (h.key === 'tuck') { if (G.cdTuck > 0) { it.t = Math.ceil(G.cdTuck) + 's'; it.dis = true; } } else { it.cnt = inv.potions; it.dis = inv.potions <= 0; } }
        if (ab === 'whistle' && h.cd > 0) { it.t = Math.ceil(h.cd) + 's'; it.dis = true; }
        list.push(it);
      }
    }
    if (h && h.inside) list.push({ id: 'out', ic: '🚪', t: 'Come out' });
    if (h && h.roof && !h.climbing) list.push({ id: 'jump', ic: '⤵️', t: 'Jump down' });
    if (h && h.carry) list.push({ id: 'drop', ic: '⬇️', t: 'Drop' });
    if (h && !h.npc && inv.potions > 0 && h.hp < h.maxhp && G.kind !== 'base') list.push({ id: 'potion', ic: '🧪', t: 'Potion', cnt: inv.potions });
    const sig = list.map((a) => a.id + a.t + (a.on ? 1 : 0) + (a.cnt != null ? a.cnt : '') + (a.dis ? 'd' : '') + (G.mode === a.id ? 'A' : '')).join('|');
    if (sig === actSig && !force) return;
    actSig = sig;
    box.innerHTML = '';
    for (const a of list) {
      const b = document.createElement('button');
      b.className = 'act' + (a.on ? ' on' : '') + (G.mode === a.id ? ' arm' : '');
      b.dataset.id = a.id;
      if (a.dis) b.disabled = true;
      b.innerHTML = `${a.ic}<small>${esc(a.t)}</small>${a.cnt != null ? `<span class="cnt">${a.cnt}</span>` : ''}`;
      b.addEventListener('click', (e) => { e.stopPropagation(); onActionBtn(a.id); });
      box.appendChild(b);
    }
  }

  function onActionBtn(id) {
    sfx('tap');
    closeCtx();
    switch (id) {
      case 'sneak': { const on = RH.game.toggleSneak(); ui.toast(on ? '🦶 Sneaking: slower, much harder to spot' : 'Walking normally'); break; }
      case 'drop': RH.game.drop(); break;
      case 'potion': RH.game.usePotion(); break;
      case 'done': RH.saveProfile(); RH.main.toCamp(); return;
      case 'out': RH.game.leaveHouse(G.sel[0]); break;
      case 'jump': { const h = G.sel[0]; if (h && h.roof) RH.game.startDrop(h, h.x + 40, h.y + 40, null); break; }
      case 'whistle': { const n = RH.game.whistle(G.sel[0]); if (n === false) break; ui.toast(n ? `🎵 ${n} guard${n > 1 ? 's' : ''} turn${n > 1 ? '' : 's'} to look` : '🎵 Nobody close enough to hear'); break; }
      default: setMode(G.mode === id ? null : id);
    }
    ui.refresh(true);
  }

  const MODE_TEXT = { snare: '🪢 Tap the path where the snare should go', shoot: '🏹 Tap a guard or a target to shoot', sling: '🪨 Tap a guard to sling a stone', charm: '🌹 Tap a guard to charm', hive: '🐝 Tap where to throw the hive', purse: '💰 Tap where to toss the coins', net: '🕸 Tap where to throw the net', apple: '🍎 Tap where to throw the apple', ale: '🍺 Tap where to set down the ale', heal: '✚ Tap a friend (or a portrait)' };
  function setMode(m) {
    G.mode = m;
    $('target').classList.toggle('hidden', !m);
    if (m) $('targettext').textContent = MODE_TEXT[m] || '';
    actSig = '';
    if (G.m) ui.refresh(true);
  }
  ui.setMode = setMode;

  // ---------- Context menu ----------
  function closeCtx() { $('ctxmenu').classList.add('hidden'); }
  function openCtx(sx, sy, hit) {
    const h = G.sel.find((x) => !x.down) || null;
    if (!h) { ui.toast('Select an outlaw first'); return; }
    const acts = RH.game.contextActions(hit, h);
    if (!acts.length) return;
    const m = $('ctxmenu');
    const TN = { archer: 'Archer', officer: 'Officer', halberd: 'Halberdier', knight: 'Knight', black: 'Black guard', collector: 'Tax collector', boss: hit.e.name || 'Captain' };
    const name = { guard: hit.e.sheriff ? 'The Sheriff' : (TN[hit.e.type] || 'Guard'), noble: 'Gentleman', beggar: 'Beggar', scroll: 'Parchment', contact: hit.e.name || 'Stranger', prop: hit.e.name || ({ banner: 'Banner', bell: 'Bell', winch: 'Winch', lever: 'Gate lever', listen: 'Listening spot', target: 'Target', station: 'Work station' }[hit.e.kind] || 'Thing'), body: hit.e.tied ? 'Tied-up guard' : (hit.e.state === 'dead' ? 'Fallen guard' : 'Unconscious guard'), prisoner: 'Prisoner', chest: 'Tax chest', cart: 'Treasure cart', carter: 'The carter', captive: 'Captured outlaw', climb: hit.e.rope ? 'Rope over the wall' : 'Climbing spot', house: hit.e.bodies ? `House (${hit.e.bodies} hidden)` : 'House', ivy: 'Ivy on the wall' }[hit.kind];
    m.innerHTML = `<div class="ttl">${esc(name)} — ${esc(h.name)}</div>` + acts.map((a) => `<button data-id="${a.id}">${esc(a.label)}</button>`).join('');
    m.querySelectorAll('button').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation(); closeCtx(); sfx('tap');
      const id = b.dataset.id;
      const heroes = [h];
      if (id === 'shoot' || id === 'charm' || id === 'sling') RH.game.orderAction(id, hit, G.sel.length ? G.sel.concat(G.heroes.filter((x) => !G.sel.includes(x))) : G.heroes);
      else RH.game.orderAction(id, hit, id === 'attack' ? G.sel : heroes);
    }));
    m.classList.remove('hidden');
    const W = window.innerWidth, H = window.innerHeight;
    const r = m.getBoundingClientRect();
    m.style.left = Math.max(8, Math.min(W - r.width - 8, sx - r.width / 2)) + 'px';
    m.style.top = Math.max(60, Math.min(H - r.height - 120, sy - r.height - 20)) + 'px';
  }

  // ---------- Input ----------
  const tw = { x: 0, y: 0 };
  function pickRadius() { return Math.max(16, 26 / G.cam.z); }

  function handleTap(sx, sy) {
    if (!G.m || G.over) return;
    if (!$('ctxmenu').classList.contains('hidden')) { closeCtx(); return; }
    RH.render.toWorld(sx, sy, tw);
    const r = pickRadius();
    const mode = G.mode;
    if (mode) {
      if (mode === 'shoot' || mode === 'charm' || mode === 'sling') {
        const hit = RH.game.entityAt(tw.x, tw.y, r * 1.3);
        const pref = G.sel.concat(G.heroes.filter((x) => !G.sel.includes(x)));
        if (hit && (hit.kind === 'guard' || (mode === 'shoot' && hit.kind === 'prop' && hit.e.kind === 'target'))) { RH.game.orderAction(mode, hit, G.sel.some((x) => RH.game.has(x, mode === 'shoot' ? 'bow' : mode)) ? G.sel : pref); setMode(null); }
        else ui.toast('Tap a guard (they have red circles)');
      } else if (mode === 'heal') {
        const h = RH.game.heroAt(tw.x, tw.y, r * 1.3);
        if (h) { RH.game.orderAction('heal', { kind: 'hero', e: h }, G.heroes); setMode(null); }
        else ui.toast('Tap a friend to heal');
      } else {
        if (RH.game.groundAbility(mode, tw.x, tw.y)) setMode(null);
      }
      return;
    }
    const hero = RH.game.heroAt(tw.x, tw.y, r);
    if (hero && !(G.sel.length && hero.down && G.sel.some((x) => RH.game.has(x, 'heal')))) {
      onPortrait(hero);
      return;
    }
    if (hero && hero.down) { // Tuck selected: tap fallen friend to revive
      RH.game.orderAction('heal', { kind: 'hero', e: hero }, G.sel); return;
    }
    const hit = RH.game.entityAt(tw.x, tw.y, r);
    if (hit && G.sel.length) {
      const leader = G.sel.find((x) => !x.down);
      const act = RH.game.defaultAction(hit, leader);
      if (act && RH.game.orderAction(act, hit)) return;
    }
    if (!G.sel.some((x) => !x.down)) { ui.toast('Tap a portrait to choose an outlaw'); return; }
    if (!RH.game.moveSel(tw.x, tw.y)) ui.toast('Can’t get there');
  }
  function handleLong(sx, sy) {
    if (!G.m || G.over) return;
    RH.render.toWorld(sx, sy, tw);
    const r = pickRadius() * 1.2;
    const hero = RH.game.heroAt(tw.x, tw.y, r);
    if (hero) {
      // toggle in group
      if (G.sel.includes(hero)) { if (G.sel.length > 1) G.sel = G.sel.filter((x) => x !== hero); }
      else G.sel = G.sel.concat([hero]);
      sfx('select'); ui.refresh(true); return;
    }
    const hit = RH.game.entityAt(tw.x, tw.y, r);
    if (hit) { sfx('select'); openCtx(sx, sy, hit); }
  }

  // ---------- Swipe sword strokes ----------
  function swipeTargetAt(sx, sy) {
    if (!G.m || G.over || G.mode) return null;
    RH.render.toWorld(sx, sy, tw);
    const hit = RH.game.entityAt(tw.x, tw.y, pickRadius() * 1.5);
    if (!hit || hit.kind !== 'guard' || !RH.game.isActive(hit.e)) return null;
    const e = hit.e;
    const near = G.sel.some((h) => !h.down && !h.npc && (h.x - e.x) ** 2 + (h.y - e.y) ** 2 < (TILE * (e.state === 'alert' ? 5 : 2.2)) ** 2);
    return near ? e : null;
  }
  function classify(pts) {
    const a = pts[0], b = pts[pts.length - 1];
    const dx = b[0] - a[0], dy = b[1] - a[1], endd = Math.hypot(dx, dy);
    let maxd = 0; for (const p of pts) maxd = Math.max(maxd, Math.hypot(p[0] - a[0], p[1] - a[1]));
    if (maxd > 26 && endd < maxd * 0.5) return 'parry';
    if (endd < 22) return null;
    if (Math.abs(dx) > Math.abs(dy) * 1.1) return 'slash';
    return dy > 0 ? 'heavy' : 'thrust';
  }
  function doSwipe(e, pts) {
    const stroke = classify(pts);
    if (!stroke) return false;
    const a = pts[0], b = pts[pts.length - 1];
    if (stroke === 'parry') { let far = a; for (const p of pts) if (Math.hypot(p[0] - a[0], p[1] - a[1]) > Math.hypot(far[0] - a[0], far[1] - a[1])) far = p; G.fx.push({ type: 'slash', x: a[0], y: a[1], x2: far[0], y2: far[1], t: 0, life: 0.35 }); }
    else G.fx.push({ type: 'slash', x: a[0], y: a[1], x2: b[0], y2: b[1], t: 0, life: 0.35 });
    ui.swipe(e, stroke);
    return true;
  }
  ui.swipe = function (e, stroke) {
    const r = RH.game.swipeStrike(e, stroke);
    if (r === 'approach') ui.toast('Closing in, swipe again to strike');
    else if (!r) ui.toast('Select a fighter first');
    return r;
  };
  ui.classifySwipe = classify;
  ui._swipeTargetAt = (x, y) => swipeTargetAt(x, y);

  let touches = new Map();
  let gesture = null; // {type:'tap'|'pan'|'pinch', ...}
  let longTimer = 0;

  function setupInput() {
    const opt = { passive: false };
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      RH.audio.ctx && RH.audio.ctx.state === 'suspended' && RH.audio.ctx.resume();
      for (const t of e.changedTouches) touches.set(t.identifier, { x: t.clientX, y: t.clientY, sx: t.clientX, sy: t.clientY });
      if (touches.size === 1) {
        const t = [...touches.values()][0];
        gesture = { type: 'tap', sx: t.x, sy: t.y, t0: performance.now(), long: false, swipe: swipeTargetAt(t.x, t.y), pts: [[t.x, t.y]] };
        clearTimeout(longTimer);
        longTimer = setTimeout(() => { if (gesture && gesture.type === 'tap') { gesture.long = true; handleLong(gesture.sx, gesture.sy); } }, 430);
      } else if (touches.size === 2) {
        clearTimeout(longTimer);
        const [a, b] = [...touches.values()];
        gesture = { type: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), z0: G.cam.z, cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
      }
    }, opt);
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) { const p = touches.get(t.identifier); if (p) { p.px = p.x; p.py = p.y; p.x = t.clientX; p.y = t.clientY; } }
      if (!gesture || !G.cam) return;
      if (gesture.type === 'tap' || gesture.type === 'pan' || gesture.type === 'swipe') {
        const t = [...touches.values()][0]; if (!t) return;
        if (gesture.swipe) { gesture.pts.push([t.x, t.y]); if (gesture.type === 'tap' && Math.hypot(t.x - gesture.sx, t.y - gesture.sy) > 10) { gesture.type = 'swipe'; clearTimeout(longTimer); } return; }
        if (gesture.type === 'tap' && Math.hypot(t.x - gesture.sx, t.y - gesture.sy) > 10) { gesture.type = 'pan'; clearTimeout(longTimer); }
        if (gesture.type === 'pan') { RH.main.panBy(t.x - (t.px != null ? t.px : t.x), t.y - (t.py != null ? t.py : t.y)); }
      } else if (gesture.type === 'pinch' && touches.size >= 2) {
        const [a, b] = [...touches.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
        RH.main.zoomAt(gesture.z0 * d / gesture.d0, cx, cy);
        RH.main.panBy(cx - gesture.cx, cy - gesture.cy);
        gesture.cx = cx; gesture.cy = cy;
      }
    }, opt);
    const end = (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) touches.delete(t.identifier);
      if (gesture && gesture.type === 'swipe' && touches.size === 0) {
        if (!doSwipe(gesture.swipe, gesture.pts)) handleTap(gesture.sx, gesture.sy);
        gesture = null; return;
      }
      if (gesture && gesture.type === 'tap' && touches.size === 0) {
        clearTimeout(longTimer);
        if (!gesture.long) handleTap(gesture.sx, gesture.sy);
        gesture = null;
      } else if (touches.size === 0) gesture = null;
      else if (gesture && gesture.type === 'pinch' && touches.size === 1) gesture = { type: 'pan' };
    };
    canvas.addEventListener('touchend', end, opt);
    canvas.addEventListener('touchcancel', (e) => { touches.clear(); gesture = null; clearTimeout(longTimer); }, opt);
    // mouse (desktop)
    let md = null;
    canvas.addEventListener('mousedown', (e) => {
      md = { sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, pan: false, long: false, swipe: swipeTargetAt(e.clientX, e.clientY), pts: [[e.clientX, e.clientY]] };
      clearTimeout(longTimer);
      longTimer = setTimeout(() => { if (md && !md.pan) { md.long = true; handleLong(md.sx, md.sy); } }, 450);
    });
    window.addEventListener('mousemove', (e) => {
      if (!md) return;
      if (!md.pan && Math.hypot(e.clientX - md.sx, e.clientY - md.sy) > 6) { md.pan = true; clearTimeout(longTimer); }
      if (md.swipe) md.pts.push([e.clientX, e.clientY]);
      else if (md.pan) RH.main.panBy(e.clientX - md.x, e.clientY - md.y);
      md.x = e.clientX; md.y = e.clientY;
    });
    window.addEventListener('mouseup', () => {
      if (md && md.swipe && md.pan) { if (!doSwipe(md.swipe, md.pts)) handleTap(md.sx, md.sy); }
      else if (md && !md.pan && !md.long) { clearTimeout(longTimer); handleTap(md.sx, md.sy); }
      md = null;
    });
    canvas.addEventListener('contextmenu', (e) => { e.preventDefault(); });
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); RH.main.zoomAt(G.cam.z * (e.deltaY < 0 ? 1.1 : 0.9), e.clientX, e.clientY); }, opt);
    // block page gestures (iOS)
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('dblclick', (e) => e.preventDefault());
    document.addEventListener('touchmove', (e) => { if (!e.target.closest('#screen')) e.preventDefault(); }, opt);
    window.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'p') { if (screenName === 'pause') onAct('resume'); else if (!screenName) ui.showPause(); }
      if (e.key === 's' && G.m && !screenName) onActionBtn('sneak');
      if (e.key === 'Escape') setMode(null);
    });
  }
  ui.handleTap = handleTap;
  ui.handleLong = handleLong;
})(window.RH);
