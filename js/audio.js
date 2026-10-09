// WebAudio-generated sound effects (no files). Muted by default; iOS needs a tap to start audio.
'use strict';
(function (RH) {
  const A = { ctx: null, master: null, muted: true, ambT: 0 };
  RH.audio = A;
  A.init = function () {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    A.ctx = new AC();
    A.master = A.ctx.createGain();
    A.master.gain.value = 0.5;
    A.master.connect(A.ctx.destination);
    // noise buffer
    const len = A.ctx.sampleRate * 0.5;
    A.noise = A.ctx.createBuffer(1, len, A.ctx.sampleRate);
    const d = A.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  };
  A.setMuted = function (m) {
    A.muted = m;
    if (!m) A.init();
    if (A.master) A.master.gain.value = m ? 0 : 0.5;
  };
  function tone(freq, dur, type, vol, slide, delay) {
    const c = A.ctx, t = c.currentTime + (delay || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(A.master);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, freq, vol, delay, q) {
    const c = A.ctx, t = c.currentTime + (delay || 0);
    const s = c.createBufferSource(); s.buffer = A.noise;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q || 1;
    const g = c.createGain();
    g.gain.setValueAtTime(vol || 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(A.master);
    s.start(t); s.stop(t + dur + 0.05);
  }
  const FX = {
    tap: () => tone(660, 0.06, 'triangle', 0.08),
    select: () => { tone(520, 0.07, 'triangle', 0.1); tone(780, 0.08, 'triangle', 0.08, null, 0.05); },
    move: () => tone(440, 0.05, 'sine', 0.06),
    bow: () => { noise(0.18, 1800, 0.25, 0, 2); tone(220, 0.12, 'triangle', 0.08, 0.5); },
    hit: () => { noise(0.08, 900, 0.4); tone(160, 0.1, 'square', 0.08, 0.6); },
    clang: () => { tone(1200, 0.15, 'square', 0.06, 0.8); tone(1650, 0.12, 'square', 0.04); noise(0.05, 3000, 0.2); },
    ko: () => { noise(0.12, 300, 0.5); tone(120, 0.18, 'sine', 0.25, 0.5); },
    tie: () => { noise(0.05, 2000, 0.15); noise(0.05, 2200, 0.15, 0.12); noise(0.05, 2000, 0.15, 0.24); },
    coin: () => { tone(988, 0.08, 'square', 0.06); tone(1319, 0.2, 'square', 0.06, null, 0.07); },
    suspect: () => tone(500, 0.25, 'sine', 0.12, 1.4),
    alert: () => { tone(700, 0.12, 'sawtooth', 0.12); tone(950, 0.25, 'sawtooth', 0.12, null, 0.12); },
    alarm: () => { for (let i = 0; i < 4; i++) { tone(880, 0.25, 'triangle', 0.15, null, i * 0.3); tone(660, 0.25, 'triangle', 0.1, null, i * 0.3 + 0.15); } },
    charm: () => { tone(660, 0.15, 'sine', 0.1); tone(880, 0.15, 'sine', 0.1, null, 0.12); tone(1100, 0.3, 'sine', 0.1, null, 0.24); },
    buzz: () => { const c = A.ctx, t = c.currentTime; const o = c.createOscillator(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.value = 180; const l = c.createOscillator(); l.frequency.value = 30; const lg = c.createGain(); lg.gain.value = 40; l.connect(lg); lg.connect(o.frequency); g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2); o.connect(g); g.connect(A.master); o.start(t); l.start(t); o.stop(t + 1.3); l.stop(t + 1.3); },
    heal: () => { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.25, 'sine', 0.08, null, i * 0.08)); },
    down: () => tone(300, 0.5, 'triangle', 0.15, 0.4),
    throw: () => noise(0.2, 1200, 0.2, 0, 1.5),
    win: () => { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.3, 'triangle', 0.12, null, i * 0.14)); },
    lose: () => { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.4, 'triangle', 0.12, null, i * 0.22)); },
    whistle: () => { tone(1400, 0.12, 'sine', 0.1, 1.25); tone(1750, 0.22, 'sine', 0.1, 0.7, 0.14); },
    bell: () => { [0, 0.7, 1.4].forEach((d) => { tone(392, 1.1, 'sine', 0.16, null, d); tone(784, 0.8, 'sine', 0.06, null, d); tone(1176, 0.5, 'triangle', 0.03, null, d); }); },
    net: () => { noise(0.25, 700, 0.25, 0, 0.8); tone(200, 0.2, 'triangle', 0.08, 0.6); },
    gulp: () => { tone(300, 0.08, 'sine', 0.1, 0.6); tone(260, 0.08, 'sine', 0.1, 0.6, 0.14); tone(220, 0.1, 'sine', 0.1, 0.6, 0.28); },
    sling: () => { noise(0.1, 2600, 0.2, 0, 3); tone(500, 0.06, 'triangle', 0.06, 0.5); },
    bird: () => { const b = 2000 + Math.random() * 1500; tone(b, 0.08, 'sine', 0.03, 1.3); tone(b * 1.1, 0.08, 'sine', 0.03, 0.8, 0.1); },
  };
  A.play = function (name) {
    if (A.muted || !A.ctx || !FX[name]) return;
    if (A.ctx.state === 'suspended') A.ctx.resume();
    try { FX[name](); } catch (e) { /* ignore */ }
  };
  A.ambient = function (dt, night) {
    if (A.muted || !A.ctx || night) return;
    A.ambT -= dt;
    if (A.ambT <= 0) { A.ambT = 3 + Math.random() * 6; A.play('bird'); }
  };
})(window.RH);
