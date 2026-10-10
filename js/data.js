// Heroes, shop, and hand-made missions. All names/text original; legend characters are public domain.
'use strict';
(function (RH) {
  const E = 0, S = Math.PI / 2, W = Math.PI, N = -Math.PI / 2;

  RH.HEROES = {
    robin:   { name: 'Robin',       hp: 6, speed: 2.7, dmg: 1, weapon: 'sword', tunic: '#3f7d2c', trim: '#a9c94a', hat: '#2f5e1f', hair: '#7a4a22', skin: '#f0c9a0', icon: '🏹', abil: ['bow', 'purse'], blurb: 'Archer and leader. Bow, coin purses, climbs walls and ivy onto rooftops.' },
    john:    { name: 'Little John', hp: 9, speed: 2.3, dmg: 2, weapon: 'staff', tunic: '#5b6fa8', trim: '#c9b27a', hat: null,      hair: '#4a2c14', skin: '#e2b48a', icon: '💪', abil: ['sweep', 'net', 'snare', 'whistle'], blurb: 'Huge and strong. His staff sweep floors everyone around him; one-blow knockouts on anyone, carries fast, throws nets, sets net snares, whistles to lure.', big: true },
    marian:  { name: 'Marian',      hp: 5, speed: 2.8, dmg: 1, weapon: 'sword', tunic: '#9c2a3a', trim: '#e8c46a', hat: null,      hair: '#b0522a', skin: '#f3d0ae', icon: '🌹', abil: ['charm', 'bow'], social: true, blurb: 'Walks freely among the guards, as long as they don\u2019t see her fight or carry a body. Charms a guard so he sees only her. A fine shot too.' },
    tuck:    { name: 'Friar Tuck',  hp: 7, speed: 2.1, dmg: 1, weapon: 'staff', tunic: '#7a5634', trim: '#d9c08a', hat: null,      hair: '#c8a070', skin: '#eab896', icon: '✚', abil: ['heal', 'hive', 'ale'], blurb: 'Heals and revives. Beehives send a group running in panic; a mug of his ale puts any guard to sleep.', round: true },
    scarlet: { name: 'Will Scarlet', hp: 6, speed: 2.8, dmg: 2, weapon: 'sword', tunic: '#c0362c', trim: '#2a2a2a', hat: '#7d1d18', hair: '#2b1a10', skin: '#efc39c', icon: '🪨', abil: ['sling', 'apple'], blurb: 'Fast blade. His sling knocks a guard out from afar; an apple turns a guard\u2019s head.' },
    hob:     { name: 'Hob',         hp: 4, speed: 2.4, dmg: 0, weapon: null,    tunic: '#8a7a5a', trim: '#5a4a2a', hat: null,      hair: '#9a6a3a', skin: '#efc39c', icon: '🙂', blurb: 'Little John\u2019s cousin.', npc: true },
  };
  RH.HERO_ORDER = ['robin', 'john', 'marian', 'tuck', 'scarlet'];

  // ---------- Generic outlaws (recruits) ----------
  RH.OUTLAW_NAMES = ['Alan Ashdown', 'Hal Thatcher', 'Piers Cooper', 'Ned Fletcher', 'Tom Wainwright', 'Jack Shepherd', 'Cobb Turner', 'Simkin Reeve', 'Dickon Hale', 'Osric Fenn', 'Rafe Tanner', 'Gib Mossop', 'Wyn Carter', 'Hugh Lathe', 'Bennet Rowe', 'Jory Swale'];
  const TUNICS = ['#5c6b34', '#6d5a3a', '#4a5a3a', '#7a6a42', '#55603f', '#6a4e34', '#46584a', '#7a5a3c'];
  const HOODS = ['#4a5a2a', '#5a4a2e', '#3e4a2c', '#6a5a36', '#4c3e2a'];
  const HAIRS = ['#3a2412', '#6a4020', '#9a6a3a', '#2a1a10', '#b08850', '#5a3a1a'];
  const SKINS = ['#efc39c', '#e2b48a', '#f0c9a0', '#d8a47a', '#eab896'];
  // The three kinds of merry men, after the original's generic outlaws
  RH.CLASSES = {
    strong: { name: 'Strongman', ic: '🔨', weapon: 'staff', hp: 5, abil: ['whistle'], strong: true, desc: 'Knocks out anyone in one blow, carries fast, whistles to lure guards.' },
    herbal: { name: 'Herbalist', ic: '🌿', weapon: 'staff', hp: 4, abil: ['heal', 'apple'], desc: 'Heals with draughts and throws apples.' },
    trapper: { name: 'Trapper', ic: '🏹', weapon: 'staff', hp: 4, abil: ['bow', 'snare'], desc: 'Shoots arrows and sets net snares that hoist guards into the trees.' },
  };
  RH.CLASS_ORDER = ['trapper', 'strong', 'herbal'];
  RH.makeRecruit = function (id, seed) {
    const r = RH.rng(seed * 7919 + 13);
    const pick = (a) => a[Math.floor(r() * a.length)];
    return { id, name: RH.OUTLAW_NAMES[(seed - 1) % RH.OUTLAW_NAMES.length], cls: RH.CLASS_ORDER[(seed - 1) % 3], tunic: pick(TUNICS), hood: pick(HOODS), hair: pick(HAIRS), skin: pick(SKINS), beard: r() < 0.45, train: 0, job: 'rest' };
  };
  const rdefs = {};
  RH.recruitDef = function (rec) {
    const k = rec.id + ':' + rec.train + ':' + rec.cls;
    if (rdefs[k]) return rdefs[k];
    const C = RH.CLASSES[rec.cls] || RH.CLASSES.trapper;
    return (rdefs[k] = {
      name: rec.name, short: rec.name.split(' ')[0], hp: C.hp + rec.train, speed: 2.5, dmg: 1 + (rec.train >= 3 ? 1 : 0), weapon: C.weapon,
      tunic: rec.tunic, trim: '#3a2a18', hat: null, hood: rec.hood, hair: rec.hair, skin: rec.skin, beard: rec.beard, legs: '#4a3a2a',
      icon: C.ic, cls: rec.cls, clsName: C.name, abil: C.abil, strong: !!C.strong, blurb: C.name + ': ' + C.desc, outlaw: true, lookKey: 'outlaw',
    });
  };
  // Camp jobs for idle men between missions (yield per day = per mission won)
  RH.JOBS = [
    { id: 'rest', name: 'Rest by the fire', ic: '💤', desc: 'Joins the next mission fresh' },
    { id: 'arrows', name: 'Fletcher', ic: '🏹', desc: '+3 arrows each day' },
    { id: 'purses', name: 'Purse-maker', ic: '💰', desc: '+1 coin purse each day' },
    { id: 'nets', name: 'Net-weaver', ic: '🕸', desc: '+1 net each day' },
    { id: 'potions', name: 'Herb garden', ic: '🧪', desc: '+1 healing draught each day' },
    { id: 'apples', name: 'Orchard', ic: '🍎', desc: '+2 apples each day' },
    { id: 'ale', name: 'Brewery', ic: '🍺', desc: '+1 sleeping ale each day', need: 'tuck' },
    { id: 'hives', name: 'Bee-skeps', ic: '🐝', desc: '+1 beehive each day', need: 'tuck' },
    { id: 'train', name: 'Training ground', ic: '⚔️', desc: '+1 health each day (max +4); at +3, harder blows' },
    { id: 'hunt', name: 'Hunters\u2019 trail', ic: '🦌', desc: '+12 gold each day' },
    { id: 'scout', name: 'Scout the roads', ic: '👁', desc: 'Three scouts find one blazon (defence) each day' },
  ];
  // Popularity needed for each new volunteer (giving gold to the poor raises it)
  RH.POP_STEPS = [10, 25, 45, 70, 100, 140, 190];

  RH.SHOP = [
    { id: 'arrows', name: 'Bundle of arrows', desc: '+5 arrows', cost: 15, kind: 'item' },
    { id: 'potion', name: 'Healing draught', desc: 'Restores 5 health. Use from the action bar.', cost: 25, kind: 'item' },
    { id: 'net', name: 'Fowler\u2019s net', desc: '+1 net (John, trappers)', cost: 20, kind: 'item' },
    { id: 'blazon', name: 'A blazon', desc: 'Buy a soldier\u2019s blazon: each one turns 2 men from the Sheriff\u2019s raid on Sherwood', cost: 40, kind: 'item', need: 'blazonsOpen' },
    { id: 'yew', name: 'Yew longbow', desc: 'Bows shoot 3 tiles further', cost: 70, kind: 'up' },
    { id: 'jerkin', name: 'Leather jerkins', desc: '+2 health for the whole band', cost: 90, kind: 'up' },
    { id: 'boots', name: 'Soft boots', desc: 'Sneaking is even harder to spot', cost: 80, kind: 'up' },
    { id: 'pouch', name: 'Deep pouches', desc: '+1 beehive and +1 purse each mission', cost: 60, kind: 'up' },
  ];

  // Story missions live in js/missions.js; ambushes, the defence and the camp walk in js/ambush.js
})(window.RH);
