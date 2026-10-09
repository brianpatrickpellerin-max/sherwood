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
    setupInput();
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
  ui.toast = function (text, kind) {
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
    $('screenInner').innerHTML = html;
    s.scrollTop = 0;
    s.querySelectorAll('[data-act]').forEach((el) => el.addEventListener('click', (e) => { e.stopPropagation(); sfx('tap'); onAct(el.dataset.act, el.dataset.arg, el); }));
    s.querySelectorAll('canvas[data-por]').forEach((c) => RH.render.portrait(c, c.dataset.por));
    updateSoundBtn();
  }
  function hideScreen() { $('screen').classList.add('hidden'); screenName = null; }
  ui.screen = () => screenName;

  function crestSVG() {
    return `<svg class="crest" viewBox="0 0 100 100" aria-hidden="true">
      <defs><radialGradient id="cg" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#5f9a3a"/><stop offset="1" stop-color="#1f3a14"/></radialGradient></defs>
      <path d="M50 4 L90 18 L86 58 Q80 84 50 96 Q20 84 14 58 L10 18 Z" fill="url(#cg)" stroke="#f2c94c" stroke-width="3"/>
      <path d="M30 70 Q50 18 70 70" fill="none" stroke="#7a4a22" stroke-width="5" stroke-linecap="round"/>
      <line x1="34" y1="58" x2="66" y2="58" stroke="#efe6c8" stroke-width="1.6"/>
      <line x1="22" y1="78" x2="78" y2="30" stroke="#e8d8a8" stroke-width="3" stroke-linecap="round"/>
      <path d="M78 30 l-9 1 l5 5 z" fill="#ddd"/><path d="M22 78 l2 -7 l5 5 z" fill="#c33"/>
      <path d="M36 30 q8 -14 20 -10 l-26 8 z" fill="#2f5e1f" stroke="#1b140d"/><path d="M38 26 q-6 -8 -12 -6" stroke="#d23b2e" stroke-width="2.5" fill="none"/>
    </svg>`;
  }

  ui.showTitle = function () {
    screenName = 'title';
    $('hud').classList.add('hidden');
    const has = RH.hasSave();
    show(`<div class="title">${crestSVG()}
      <h1>Outlaws of<br>Sherwood</h1>
      <div class="sub">A Robin Hood stealth adventure</div>
      ${has ? '<button class="btn" data-act="continue">▶ Continue</button>' : ''}
      <button class="btn ${has ? 'sec' : ''}" data-act="newgame">${has ? '✦ New game' : '▶ Start the adventure'}</button>
      <button class="btn sec" data-act="howto">📜 How to play</button>
      <button class="btn sec" data-act="sound" data-sound>🔇 Sound: off</button>
      <div class="foot">Best in portrait. Tip: Share → Add to Home Screen to play full screen and offline.</div>
    </div>`);
  };

  ui.showHowto = function (back) {
    screenName = 'howto';
    show(`<div class="card"><h2>How to play</h2><ul class="help">
      <li><b>Tap a portrait</b> to choose an outlaw. Tap it again (or 👥 All) to move the whole band.</li>
      <li><b>Tap the ground</b> to walk. <b>Drag</b> to look around, <b>pinch</b> to zoom.</li>
      <li><b>Red wedges</b> are what guards see. Yellow means suspicious (?), bright red means you’ve been spotted (!).</li>
      <li><b>🦶 Sneak</b> makes you much harder to spot. <b>Bushes and hay</b> hide you.</li>
      <li><b>Tap a guard</b> from behind to knock him out. <b>Tap the body</b> to tie him up before he wakes.</li>
      <li><b>Long-press</b> a guard or body for more choices: carry, shoot, charm…</li>
      <li>Each outlaw has a special skill on the action bar. Robin: bow. Little John: long knockouts and fast carrying. Marian: charm. Tuck: heal and beehives. Will Scarlet: coin purses.</li>
      <li><b>⏸ Pause</b> any time. You can give orders while paused.</li>
      <li>Earn ★ for finishing, staying unseen and sparing lives. Spend gold at camp.</li>
    </ul></div>
    <button class="btn" data-act="${back || 'title'}">◀ Back</button>`);
  };

  function mapSVG() {
    const P = RH.profile;
    const r = RH.rng(7);
    let trees = '';
    for (let i = 0; i < 70; i++) {
      const x = 4 + r() * 50, y = 22 + r() * 50;
      trees += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(2 + r() * 2).toFixed(1)}" fill="${r() < 0.5 ? '#3f6d2a' : '#2f5a22'}" opacity="0.85"/>`;
    }
    for (let i = 0; i < 18; i++) {
      const x = 60 + r() * 36, y = 52 + r() * 20;
      trees += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(1.5 + r() * 1.5).toFixed(1)}" fill="#4a7a30" opacity="0.7"/>`;
    }
    let nodes = '', lines = '';
    RH.MISSIONS.forEach((m, i) => {
      const [x, y] = m.mapPos;
      if (i > 0) { const [px, py] = RH.MISSIONS[i - 1].mapPos; lines += `<path d="M${px} ${py} Q${(px + x) / 2 + 4} ${(py + y) / 2 + 6} ${x} ${y}" stroke="#7a1f14" stroke-width="0.9" stroke-dasharray="2 1.6" fill="none" opacity="${i < P.unlocked ? 0.9 : 0.3}"/>`; }
      const open = i < P.unlocked;
      const st = P.stars[i] || 0;
      const starTxt = open ? '★'.repeat(st) + '☆'.repeat(3 - st) : '';
      nodes += `<g data-act="${open ? 'brief' : 'locked'}" data-arg="${i}" style="cursor:pointer">
        <circle cx="${x}" cy="${y}" r="7" fill="transparent"/>
        <circle cx="${x}" cy="${y}" r="5" fill="${open ? (st ? '#3f6d2a' : '#b8401f') : '#8a7a5a'}" stroke="#2a1a0a" stroke-width="0.8"/>
        <text x="${x}" y="${y + 1.7}" text-anchor="middle" font-size="5" font-weight="800" fill="#fff">${open ? i + 1 : '🔒'}</text>
        <text x="${x}" y="${y + 9.5}" text-anchor="middle" font-size="3.6" fill="#7a4a10">${starTxt}</text>
      </g>`;
    });
    return `<svg class="map" viewBox="0 0 100 78">
      <rect x="0" y="0" width="100" height="78" fill="#ead9a6"/>
      <path d="M0 6 Q30 2 60 8 T100 4" stroke="#c9b27a" stroke-width="0.6" fill="none"/>
      ${trees}
      <path d="M100 30 Q80 36 74 48 T60 78" stroke="#5a8fb0" stroke-width="2.4" fill="none" opacity="0.8"/>
      <path d="M44 0 L44 78" stroke="#a8875a" stroke-width="1.2" stroke-dasharray="3 1.5" opacity="0.7"/>
      <g transform="translate(60 33)"><rect x="-6" y="-4" width="12" height="8" fill="#b9a888" stroke="#3a2a1a" stroke-width="0.6"/><path d="M-7 -4 L0 -9 L7 -4 Z" fill="#9a3a24" stroke="#3a2a1a" stroke-width="0.6"/></g>
      <g transform="translate(82 15)"><rect x="-7" y="-3" width="14" height="8" fill="#a89a80" stroke="#3a2a1a" stroke-width="0.6"/><rect x="-8" y="-7" width="4" height="12" fill="#a89a80" stroke="#3a2a1a" stroke-width="0.6"/><rect x="4" y="-7" width="4" height="12" fill="#a89a80" stroke="#3a2a1a" stroke-width="0.6"/></g>
      <text x="20" y="18" font-size="4.4" font-family="Georgia" font-style="italic" fill="#2f5a22">Sherwood Forest</text>
      <text x="60" y="42" text-anchor="middle" font-size="3.6" font-family="Georgia" fill="#5a3a14">Nottingham</text>
      <g transform="translate(93 50)"><rect x="-3" y="-6" width="6" height="10" fill="#8a7a60" stroke="#3a2a1a" stroke-width="0.5"/><path d="M-4 -6 h8 v-2 h-2 v1 h-1 v-1 h-2 v1 h-1 v-1 h-2 z" fill="#8a7a60" stroke="#3a2a1a" stroke-width="0.4"/></g>
      <g transform="translate(8 74)"><path d="M-4 3 L0 -4 L4 3 Z" fill="#d8c79e" stroke="#3a2a1a" stroke-width="0.5"/><text x="6" y="2" font-size="3.4" fill="#2f5a22">Our camp</text></g>
      ${lines}${nodes}
      <g transform="translate(92 70)"><circle r="5" fill="none" stroke="#7a5a2a" stroke-width="0.5"/><text y="-5.8" text-anchor="middle" font-size="3" fill="#7a5a2a">N</text><path d="M0 -4 L1.4 0 L0 4 L-1.4 0 Z" fill="#7a5a2a"/></g>
    </svg>`;
  }

  ui.showCamp = function () {
    screenName = 'camp';
    $('hud').classList.add('hidden');
    const P = RH.profile;
    const roster = RH.rosterUnlocked();
    const band = RH.HERO_ORDER.map((k) => {
      const d = RH.HEROES[k]; const has = roster.includes(k);
      return `<div class="member ${has ? '' : 'locked'}"><canvas data-por="${k}" width="72" height="72"></canvas><div>${has ? esc(d.name) : '???'}</div></div>`;
    }).join('');
    const shop = RH.SHOP.map((it) => {
      const owned = it.kind === 'up' && P.up[it.id];
      const can = !owned && P.gold >= it.cost;
      const extra = it.id === 'arrows' ? ` (have ${P.arrows})` : it.id === 'potion' ? ` (have ${P.potions})` : '';
      return `<div class="shopitem"><div class="d"><b>${esc(it.name)}</b>${extra}<br>${esc(it.desc)}</div>
        <button data-act="buy" data-arg="${it.id}" ${can ? '' : 'disabled'}>${owned ? 'Owned' : '🪙 ' + it.cost}</button></div>`;
    }).join('');
    const next = Math.min(P.unlocked, RH.MISSIONS.length) - 1;
    const allDone = P.stars.filter((s) => s > 0).length >= RH.MISSIONS.length;
    const list = RH.MISSIONS.map((m, i) => i < P.unlocked
      ? `<button class="btn ${i === next && !P.stars[i] ? '' : 'sec'}" data-act="brief" data-arg="${i}">${i + 1}. ${esc(m.title)} <span style="color:#f2c94c">${'★'.repeat(P.stars[i] || 0)}</span></button>`
      : `<button class="btn sec" disabled style="opacity:.45">🔒 ${i + 1}. ???</button>`).join('');
    show(`<div class="hdr"><h1>Sherwood Camp</h1><div class="goldpill">🪙 ${P.gold}</div></div>
      ${allDone ? '<div class="card"><p><b>Every mission is won!</b> Replay any of them to earn more stars and gold.</p></div>' : ''}
      <div style="margin-top:12px">${mapSVG()}</div>
      <div style="margin-top:6px">${list}</div>
      <div class="card"><h2>The band</h2><div class="band">${band}</div></div>
      <div class="card"><h2>Supplies</h2><div class="small-note">Arrows ${P.arrows} · Healing draughts ${P.potions}</div>${shop}</div>
      <div class="row"><button class="btn sec" data-act="howto" data-arg="camp">📜 How to play</button><button class="btn sec" data-act="sound" data-sound>🔇</button></div>
      <button class="btn sec" data-act="title">◀ Title screen</button>`);
  };

  ui.showBrief = function (i) {
    screenName = 'brief';
    const m = RH.MISSIONS[i];
    const roster = Object.keys(m.heroes);
    const objText = {
      rescue: m.prisoner && m.prisoner.id === 'tuck' ? 'Free Friar Tuck from his cell' : 'Free Hob from the pen',
      steal: 'Steal the tax chest', convoy: 'Stop the cart and take its chest', sheriff: 'Capture the Sheriff alive',
      exit: 'Bring everyone to the exit', noalarm: 'Don’t let the alarm be raised',
    };
    show(`<div class="card"><div class="place">${esc(m.place)}${m.night ? ' · Night' : ''}</div><h2>${i + 1}. ${esc(m.title)}</h2>
      <p>${esc(m.intro)}</p>
      <h3>Objectives</h3><ul class="objs">${m.objectives.map((o) => `<li>${esc(objText[o])}</li>`).join('')}</ul>
      <h3>Your band</h3><div class="band">${roster.map((k) => `<div class="member"><canvas data-por="${k}" width="72" height="72"></canvas><div>${esc(RH.HEROES[k].name)}</div></div>`).join('')}</div>
      <p class="small-note">★ Finish · ★ Never spotted, no alarm · ★ Nobody killed</p></div>
      <button class="btn" data-act="begin" data-arg="${i}">⚔️ Begin mission</button>
      <button class="btn sec" data-act="camp">◀ Back to camp</button>`);
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
    const i = G.idx;
    if (res.win) {
      const reward = RH.commitWin(res);
      const stars = [0, 1, 2].map((k) => `<span class="${k < res.stars ? '' : 'off'}">★</span>`).join('');
      show(`<div class="card" style="text-align:center"><div class="place">Mission complete</div><h2>${esc(G.m.title)}</h2>
        <div class="stars">${stars}</div>
        <div style="text-align:left">
        <div class="stat"><span>Finished</span><b>★</b></div>
        <div class="stat"><span>Never spotted, no alarm</span><b>${!st.spotted && !st.alarm ? '★' : '—'}</b></div>
        <div class="stat"><span>Nobody killed</span><b>${st.kills === 0 ? '★' : '—'}</b></div>
        <div class="stat"><span>Gold found</span><b>🪙 ${st.gold}</b></div>
        <div class="stat"><span>Knocked out / slain</span><b>${st.ko} / ${st.kills}</b></div>
        <div class="stat"><span>Time</span><b>${fmtTime(st.time)}</b></div>
        <div class="stat"><span>Reward</span><b>🪙 ${reward}</b></div>
        </div><p style="text-align:left">${esc(G.m.outro)}</p></div>
        <button class="btn" data-act="camp">🏕 Back to camp</button>
        <button class="btn sec" data-act="retry">↻ Play again for more stars</button>`, true);
    } else {
      show(`<div class="card" style="text-align:center"><div class="place">Mission failed</div><h2>${esc(G.m.title)}</h2>
        <p>${esc(res.reason || '')}</p><p class="small-note">Try sneaking (🦶), hiding in bushes and tying up every guard you knock out.</p></div>
        <button class="btn" data-act="retry">↻ Try again</button>
        <button class="btn sec" data-act="camp">🏕 Back to camp</button>`, true);
    }
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
      case 'howto': ui.showHowto(arg); break;
      case 'title': ui.showTitle(); break;
      case 'camp': RH.main.toCamp(); break;
      case 'sound': toggleSound(); break;
      case 'brief': ui.showBrief(+arg); break;
      case 'locked': ui.toastScreen('Finish the earlier missions first'); break;
      case 'begin': RH.main.begin(+arg); break;
      case 'buy': RH.buy(arg); ui.showCamp(); break;
      case 'resume': hideScreen(); G.paused = false; ui.refresh(true); break;
      case 'plan': hideScreen(); G.paused = true; ui.refresh(true); break;
      case 'pause': ui.showPause(); break;
      case 'restart': case 'retry': RH.main.begin(G.idx); break;
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
      b.className = 'por'; b.dataset.id = h.id;
      b.innerHTML = `<canvas></canvas><div class="nm">${esc(h.name.replace('Little ', 'L. ').replace('Friar ', '').replace('Will ', ''))}</div><div class="sn"></div><div class="hp"><i></i></div>`;
      b.addEventListener('click', () => onPortrait(h));
      box.appendChild(b);
      RH.render.portrait(b.querySelector('canvas'), h.key);
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

  function buildActions(force) {
    const box = $('actions');
    const hs = G.sel.filter((h) => !h.down);
    const h = hs.length === 1 ? hs[0] : null;
    const inv = G.inv;
    const list = [];
    if (hs.length) {
      const sneakOn = hs.every((x) => x.sneak);
      list.push({ id: 'sneak', ic: '🦶', t: 'Sneak', on: sneakOn });
    }
    if (h && !h.npc) {
      if (h.key === 'robin') list.push({ id: 'shoot', ic: '🏹', t: 'Bow', cnt: inv.arrows, dis: inv.arrows <= 0 });
      if (h.key === 'marian') list.push({ id: 'charm', ic: '🌹', t: G.cdMarian > 0 ? Math.ceil(G.cdMarian) + 's' : 'Charm', dis: G.cdMarian > 0 });
      if (h.key === 'tuck') {
        list.push({ id: 'heal', ic: '✚', t: G.cdTuck > 0 ? Math.ceil(G.cdTuck) + 's' : 'Heal', dis: G.cdTuck > 0 });
        list.push({ id: 'hive', ic: '🐝', t: 'Hive', cnt: inv.hives, dis: inv.hives <= 0 });
      }
      if (h.key === 'scarlet') list.push({ id: 'purse', ic: '💰', t: 'Purse', cnt: inv.purses, dis: inv.purses <= 0 });
    }
    if (h && h.carry) list.push({ id: 'drop', ic: '⬇️', t: 'Drop' });
    if (h && !h.npc && inv.potions > 0 && h.hp < h.maxhp) list.push({ id: 'potion', ic: '🧪', t: 'Potion', cnt: inv.potions });
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
      case 'sneak': { const on = RH.game.toggleSneak(); ui.toast(on ? '🦶 Sneaking — slower, much harder to spot' : 'Walking normally'); break; }
      case 'drop': RH.game.drop(); break;
      case 'potion': RH.game.usePotion(); break;
      case 'shoot': case 'charm': case 'hive': case 'purse': case 'heal':
        setMode(G.mode === id ? null : id); break;
    }
    ui.refresh(true);
  }

  const MODE_TEXT = { shoot: '🏹 Tap a guard to shoot', charm: '🌹 Tap a guard to charm', hive: '🐝 Tap where to throw', purse: '💰 Tap where to toss coins', heal: '✚ Tap a friend (or a portrait)' };
  function setMode(m) {
    G.mode = m;
    $('target').classList.toggle('hidden', !m);
    if (m) $('targettext').textContent = MODE_TEXT[m];
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
    const name = { guard: hit.e.sheriff ? 'The Sheriff' : 'Guard', body: hit.e.tied ? 'Tied-up guard' : (hit.e.state === 'dead' ? 'Fallen guard' : 'Unconscious guard'), prisoner: 'Prisoner', chest: 'Tax chest', cart: 'Treasure cart', carter: 'The carter' }[hit.kind];
    m.innerHTML = `<div class="ttl">${esc(name)} — ${esc(h.name)}</div>` + acts.map((a) => `<button data-id="${a.id}">${esc(a.label)}</button>`).join('');
    m.querySelectorAll('button').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation(); closeCtx(); sfx('tap');
      const id = b.dataset.id;
      const heroes = [h];
      if (id === 'shoot') RH.game.orderAction('shoot', hit, G.heroes);
      else if (id === 'charm') RH.game.orderAction('charm', hit, G.heroes);
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
      if (mode === 'shoot' || mode === 'charm') {
        const hit = RH.game.entityAt(tw.x, tw.y, r * 1.3);
        if (hit && hit.kind === 'guard') { RH.game.orderAction(mode, hit, G.heroes); setMode(null); }
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
    if (hero && !(G.sel.length && hero.down && G.sel.some((x) => x.key === 'tuck'))) {
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
        gesture = { type: 'tap', sx: t.x, sy: t.y, t0: performance.now(), long: false };
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
      if (gesture.type === 'tap' || gesture.type === 'pan') {
        const t = [...touches.values()][0]; if (!t) return;
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
      md = { sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, pan: false, long: false };
      clearTimeout(longTimer);
      longTimer = setTimeout(() => { if (md && !md.pan) { md.long = true; handleLong(md.sx, md.sy); } }, 450);
    });
    window.addEventListener('mousemove', (e) => {
      if (!md) return;
      if (!md.pan && Math.hypot(e.clientX - md.sx, e.clientY - md.sy) > 6) { md.pan = true; clearTimeout(longTimer); }
      if (md.pan) RH.main.panBy(e.clientX - md.x, e.clientY - md.y);
      md.x = e.clientX; md.y = e.clientY;
    });
    window.addEventListener('mouseup', () => { if (md && !md.pan && !md.long) { clearTimeout(longTimer); handleTap(md.sx, md.sy); } md = null; });
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
