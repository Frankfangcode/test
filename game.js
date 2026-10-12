(function () {
'use strict';

// ===================== CANVAS SETUP =====================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 480; canvas.height = 320;
(function resize() {
  const s = Math.min(window.innerWidth / 480, window.innerHeight / 340);
  canvas.style.width  = Math.floor(480 * s) + 'px';
  canvas.style.height = Math.floor(320 * s) + 'px';
})();
window.addEventListener('resize', () => {
  const s = Math.min(window.innerWidth / 480, window.innerHeight / 340);
  canvas.style.width  = Math.floor(480 * s) + 'px';
  canvas.style.height = Math.floor(320 * s) + 'px';
});

// ===================== INPUT =====================
const keys = {}, pressed = {};
window.addEventListener('keydown', e => {
  if (!keys[e.code]) pressed[e.code] = true;
  keys[e.code] = true;
  if ([' ','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
function key(c) { return !!keys[c]; }
function tap(c) { const v = !!pressed[c]; if (v) pressed[c] = false; return v; }
function anyTap() {
  const c = Object.keys(pressed).find(k => pressed[k]);
  if (c) { pressed[c] = false; return c; }
  return null;
}

// ===================== AUDIO =====================
let aCtx = null;
function getACtx() {
  if (!aCtx) aCtx = new (window.AudioContext || window.webkitAudioContext)();
  return aCtx;
}
function beep(freq, dur, type = 'square', vol = 0.25, delay = 0) {
  try {
    const ac = getACtx(); const t = ac.currentTime + delay;
    const o = ac.createOscillator(); const g = ac.createGain();
    o.connect(g); g.connect(ac.destination);
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.start(t); o.stop(t + dur + 0.01);
  } catch (_) {}
}
const SFX = {
  cursor:  () => beep(440, 0.05, 'square', 0.15),
  confirm: () => { beep(523, 0.08, 'square', 0.2); beep(659, 0.1, 'square', 0.2, 0.08); },
  step:    () => beep(120, 0.03, 'triangle', 0.04),
  hit:     () => { beep(200, 0.08, 'sawtooth', 0.3); beep(130, 0.1, 'sawtooth', 0.2, 0.05); },
  hurt:    () => { beep(150, 0.1, 'sawtooth', 0.35); beep(90, 0.15, 'sawtooth', 0.25, 0.08); },
  faint:   () => [440,392,349,294,262].forEach((f,i) => beep(f, 0.12, 'square', 0.2, i*0.1)),
  victory: () => [523,523,523,784,784,523,784,659].forEach((f,i) => beep(f, 0.13, 'square', 0.25, i*0.13)),
  levelup: () => [262,330,392,523,659,784].forEach((f,i) => beep(f, 0.09, 'square', 0.25, i*0.07)),
  evolve:  () => [262,330,392,523,659,784,1047,1175].forEach((f,i) => beep(f, 0.15, 'square', 0.28, i*0.09)),
  encounter: () => [800,700,600,500,400,300].forEach((f,i) => beep(f, 0.06, 'square', 0.3, i*0.06)),
  run:     () => { beep(600, 0.06, 'square', 0.2); beep(500, 0.06, 'square', 0.15, 0.07); },
};

// ===================== TYPE SYSTEM =====================
const TYPE_COLOR = {
  Normal:'#AAA', Fire:'#F64', Water:'#48F', Grass:'#5C4',
  Electric:'#FD0', Rock:'#A85', Ghost:'#85A', Ice:'#8DF'
};
const EFFECTIVENESS = {
  Fire:     { Grass:2, Ice:2, Water:0.5, Fire:0.5, Rock:0.5 },
  Water:    { Fire:2, Rock:2, Water:0.5, Grass:0.5 },
  Grass:    { Water:2, Rock:2, Fire:0.5, Grass:0.5 },
  Electric: { Water:2, Rock:0.5, Electric:0.5 },
  Rock:     { Fire:2, Ice:2, Electric:0.5, Grass:0.5 },
  Ghost:    { Ghost:2, Normal:0 },
  Ice:      { Grass:2, Rock:0.5, Ice:0.5 },
  Normal:   {}
};
function getEff(atkType, defTypes) {
  let m = 1;
  for (const dt of defTypes) m *= (EFFECTIVENESS[atkType]?.[dt] ?? 1);
  return m;
}

// ===================== MOVES =====================
const MOVES = {
  tackle:       {name:'Tackle',       type:'Normal',   power:40,  acc:100, pp:35, cat:'physical'},
  scratch:      {name:'Scratch',      type:'Normal',   power:40,  acc:100, pp:35, cat:'physical'},
  swift:        {name:'Swift',        type:'Normal',   power:60,  acc:999, pp:20, cat:'special'},
  ember:        {name:'Ember',        type:'Fire',     power:40,  acc:100, pp:25, cat:'special'},
  flamethrower: {name:'Flamethrower', type:'Fire',     power:90,  acc:100, pp:15, cat:'special'},
  fireSpin:     {name:'Fire Spin',    type:'Fire',     power:35,  acc:85,  pp:15, cat:'special'},
  waterGun:     {name:'Water Gun',    type:'Water',    power:40,  acc:100, pp:25, cat:'special'},
  surf:         {name:'Surf',         type:'Water',    power:90,  acc:100, pp:15, cat:'special'},
  bubble:       {name:'Bubble',       type:'Water',    power:30,  acc:100, pp:30, cat:'special'},
  vineWhip:     {name:'Vine Whip',    type:'Grass',    power:45,  acc:100, pp:25, cat:'physical'},
  leafBlade:    {name:'Leaf Blade',   type:'Grass',    power:90,  acc:100, pp:15, cat:'physical'},
  solarBeam:    {name:'Solar Beam',   type:'Grass',    power:120, acc:100, pp:10, cat:'special'},
  thunderShock: {name:'ThunderShock', type:'Electric', power:40,  acc:100, pp:30, cat:'special'},
  thunderbolt:  {name:'Thunderbolt',  type:'Electric', power:90,  acc:100, pp:15, cat:'special'},
  thunder:      {name:'Thunder',      type:'Electric', power:110, acc:70,  pp:10, cat:'special'},
  rockThrow:    {name:'Rock Throw',   type:'Rock',     power:50,  acc:90,  pp:15, cat:'physical'},
  rockSlide:    {name:'Rock Slide',   type:'Rock',     power:75,  acc:90,  pp:10, cat:'physical'},
  lick:         {name:'Lick',         type:'Ghost',    power:30,  acc:100, pp:30, cat:'physical'},
  shadowBall:   {name:'Shadow Ball',  type:'Ghost',    power:80,  acc:100, pp:15, cat:'special'},
  iceShard:     {name:'Ice Shard',    type:'Ice',      power:40,  acc:100, pp:30, cat:'physical'},
  blizzard:     {name:'Blizzard',     type:'Ice',      power:110, acc:70,  pp:5,  cat:'special'},
};

// ===================== CREATURES =====================
const DEFS = {
  1: {name:'Flambit',   types:['Fire'],     base:{hp:39,atk:52,def:43,spd:65},  moves:['tackle','ember','fireSpin','scratch'],        xp:65,  evo:4,  evoLv:16},
  2: {name:'Aquafin',   types:['Water'],    base:{hp:44,atk:48,def:65,spd:43},  moves:['tackle','waterGun','bubble','scratch'],       xp:65,  evo:5,  evoLv:16},
  3: {name:'Leafbud',   types:['Grass'],    base:{hp:45,atk:49,def:49,spd:45},  moves:['tackle','vineWhip','leafBlade','scratch'],    xp:65,  evo:6,  evoLv:16},
  4: {name:'Infernox',  types:['Fire'],     base:{hp:58,atk:64,def:58,spd:80},  moves:['ember','flamethrower','fireSpin','swift'],    xp:142, evo:null},
  5: {name:'Tidalfin',  types:['Water'],    base:{hp:59,atk:63,def:80,spd:58},  moves:['waterGun','bubble','surf','swift'],           xp:142, evo:null},
  6: {name:'Thornvine', types:['Grass'],    base:{hp:60,atk:62,def:63,spd:60},  moves:['vineWhip','leafBlade','solarBeam','swift'],   xp:142, evo:null},
  7: {name:'Zappup',    types:['Electric'], base:{hp:35,atk:55,def:30,spd:90},  moves:['thunderShock','tackle','swift','thunderbolt'],xp:82,  evo:8,  evoLv:18},
  8: {name:'Voltpaw',   types:['Electric'], base:{hp:60,atk:90,def:55,spd:110}, moves:['thunderbolt','thunder','swift','tackle'],     xp:158, evo:null},
  9: {name:'Rockback',  types:['Rock'],     base:{hp:50,atk:60,def:80,spd:30},  moves:['rockThrow','tackle','scratch','rockSlide'],   xp:73,  evo:null},
  10:{name:'Ghostwisp', types:['Ghost'],    base:{hp:30,atk:35,def:30,spd:80},  moves:['lick','tackle','shadowBall','swift'],         xp:95,  evo:null},
  11:{name:'Snowpuff',  types:['Ice'],      base:{hp:55,atk:45,def:50,spd:55},  moves:['iceShard','tackle','blizzard','swift'],       xp:78,  evo:null},
};

function calcMaxHP(id, lv) { const b = DEFS[id].base.hp; return Math.floor(b*2*lv/100) + lv + 10; }
function calcStat(id, stat, lv) { const b = DEFS[id].base[stat]; return Math.floor(b*2*lv/100) + 5; }
function xpToNext(lv) { return lv * 100; }

function makeMon(id, lv) {
  const d = DEFS[id];
  const maxHp = calcMaxHP(id, lv);
  return {
    id, lv, hp: maxHp, maxHp,
    moves: d.moves.map(m => ({id: m, pp: MOVES[m].pp})),
    xp: 0, xpNeeded: xpToNext(lv)
  };
}

function calcDmg(atk, move, def) {
  const m = MOVES[move];
  const atkStat = calcStat(atk.id, 'atk', atk.lv);
  const defStat = calcStat(def.id, 'def', def.lv);
  let dmg = Math.floor(((2*atk.lv/5+2) * m.power * atkStat / defStat) / 50) + 2;
  const eff = getEff(m.type, DEFS[def.id].types);
  dmg = Math.floor(dmg * eff);
  if (DEFS[atk.id].types.includes(m.type)) dmg = Math.floor(dmg * 1.5); // STAB
  dmg = Math.floor(dmg * (0.85 + Math.random() * 0.15));
  return { dmg: Math.max(1, dmg), eff };
}

// ===================== WORLD MAP =====================
// 0=path 1=grass 2=tall_grass 3=tree 4=water 5=building 6=town
const MAP_W = 30, MAP_H = 24, TS = 32;
const WORLD = [
  [3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3], // 0
  [3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3], // 1
  [3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,4,4,4,4,4,4,3,3,3,3], // 2
  [3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,4,4,4,4,4,4,4,4,3,3,3], // 3
  [3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,4,4,4,4,4,4,4,4,3,3,3], // 4
  [3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,4,4,4,4,4,4,3,3,3,3], // 5
  [3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3], // 6
  [3,3,2,2,2,2,2,2,2,2,2,3,3,3,3,3,3,2,2,2,2,2,2,2,2,2,2,3,3,3], // 7
  [3,3,2,2,2,2,2,2,2,2,2,3,3,3,3,3,3,2,2,2,2,2,2,2,2,2,2,3,3,3], // 8
  [3,3,2,2,2,2,2,2,2,2,2,3,0,0,0,0,3,2,2,2,2,2,2,2,2,2,2,3,3,3], // 9
  [3,3,2,2,2,2,2,2,2,2,2,3,0,0,0,0,3,2,2,2,2,2,2,2,2,2,2,3,3,3], // 10
  [3,3,2,2,2,2,2,2,2,2,2,3,0,0,0,0,3,2,2,2,2,2,2,2,2,2,2,3,3,3], // 11
  [3,3,2,2,2,2,2,2,2,2,2,3,0,0,0,0,3,2,2,2,2,2,2,2,2,2,2,3,3,3], // 12
  [3,3,2,2,2,2,2,2,2,2,2,2,0,0,0,0,2,2,2,2,2,2,2,2,2,2,2,3,3,3], // 13
  [3,3,3,3,3,3,3,3,3,3,3,3,0,0,0,0,3,3,3,3,3,3,3,3,3,3,3,3,3,3], // 14
  [3,3,3,3,3,3,3,3,3,3,3,3,0,0,0,0,3,3,3,3,3,3,3,3,3,3,3,3,3,3], // 15
  [3,3,1,1,1,1,1,1,1,1,1,1,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,3,3,3], // 16
  [3,3,1,1,1,1,1,1,1,1,1,1,0,0,0,0,1,1,1,1,1,1,1,1,1,1,1,3,3,3], // 17
  [3,3,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,3,3,3], // 18
  [3,3,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,3,3,3], // 19
  [3,3,6,6,6,5,5,5,6,6,6,5,5,5,6,6,5,5,5,6,6,6,5,5,5,6,6,3,3,3], // 20
  [3,3,6,6,6,5,5,5,6,6,6,5,5,5,6,6,5,5,5,6,6,6,5,5,5,6,6,3,3,3], // 21
  [3,3,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,3,3,3], // 22
  [3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3], // 23
];
function getTile(tx, ty) {
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return 3;
  return WORLD[ty][tx];
}
function walkable(tx, ty) { const t = getTile(tx,ty); return t !== 3 && t !== 4 && t !== 5; }

// ===================== WILD TABLES =====================
const WILD_NORTH = [{id:7,w:30},{id:9,w:25},{id:10,w:15},{id:11,w:15},{id:1,w:8},{id:2,w:7}];
const WILD_SOUTH = [{id:1,w:25},{id:2,w:25},{id:3,w:25},{id:7,w:15},{id:9,w:10}];
function pickWild(ty) {
  const t = ty < 14 ? WILD_NORTH : WILD_SOUTH;
  let r = Math.random() * t.reduce((s,e) => s+e.w, 0);
  for (const e of t) { r -= e.w; if (r <= 0) return e.id; }
  return t[0].id;
}

// ===================== SPRITES =====================
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r, y);
  ctx.lineTo(x+w-r, y); ctx.arcTo(x+w, y, x+w, y+r, r);
  ctx.lineTo(x+w, y+h-r); ctx.arcTo(x+w, y+h, x+w-r, y+h, r);
  ctx.lineTo(x+r, y+h); ctx.arcTo(x, y+h, x, y+h-r, r);
  ctx.lineTo(x, y+r); ctx.arcTo(x, y, x+r, y, r);
  ctx.closePath();
}

function drawFlambit(ctx, cx, cy, s) {
  // flame tail
  ctx.fillStyle='#FF8800'; ctx.beginPath();
  ctx.moveTo(cx+12*s,cy+4*s); ctx.lineTo(cx+22*s,cy-6*s); ctx.lineTo(cx+20*s,cy+10*s); ctx.fill();
  ctx.fillStyle='#FFD700'; ctx.beginPath();
  ctx.moveTo(cx+13*s,cy+4*s); ctx.lineTo(cx+20*s,cy-2*s); ctx.lineTo(cx+18*s,cy+8*s); ctx.fill();
  // body
  ctx.fillStyle='#FF4422';
  rr(ctx, cx-12*s, cy-4*s, 22*s, 18*s, 6*s); ctx.fill();
  // head
  ctx.fillStyle='#FF5533'; ctx.beginPath();
  ctx.arc(cx-2*s, cy-14*s, 12*s, 0, Math.PI*2); ctx.fill();
  // ears
  ctx.fillStyle='#FF4422';
  ctx.beginPath(); ctx.moveTo(cx-12*s,cy-20*s); ctx.lineTo(cx-16*s,cy-30*s); ctx.lineTo(cx-6*s,cy-22*s); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx+8*s,cy-20*s); ctx.lineTo(cx+12*s,cy-30*s); ctx.lineTo(cx+2*s,cy-22*s); ctx.fill();
  ctx.fillStyle='#FF9988';
  ctx.beginPath(); ctx.moveTo(cx-12*s,cy-22*s); ctx.lineTo(cx-14*s,cy-28*s); ctx.lineTo(cx-8*s,cy-23*s); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx+8*s,cy-22*s); ctx.lineTo(cx+10*s,cy-28*s); ctx.lineTo(cx+4*s,cy-23*s); ctx.fill();
  // eyes
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(cx-6*s,cy-14*s,4*s,0,Math.PI*2); ctx.arc(cx+2*s,cy-14*s,4*s,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#222'; ctx.beginPath(); ctx.arc(cx-5*s,cy-14*s,2*s,0,Math.PI*2); ctx.arc(cx+3*s,cy-14*s,2*s,0,Math.PI*2); ctx.fill();
  // legs
  ctx.fillStyle='#FF4422';
  rr(ctx, cx-10*s, cy+12*s, 7*s, 8*s, 3*s); ctx.fill();
  rr(ctx, cx+2*s,  cy+12*s, 7*s, 8*s, 3*s); ctx.fill();
}

function drawAquafin(ctx, cx, cy, s) {
  // tail
  ctx.fillStyle='#1155AA';
  ctx.beginPath(); ctx.moveTo(cx+14*s,cy); ctx.lineTo(cx+24*s,cy-10*s); ctx.lineTo(cx+26*s,cy+10*s); ctx.fill();
  // body
  ctx.fillStyle='#3388EE'; ctx.beginPath();
  ctx.ellipse(cx, cy, 16*s, 12*s, 0, 0, Math.PI*2); ctx.fill();
  // fins
  ctx.fillStyle='#1166CC';
  ctx.beginPath(); ctx.moveTo(cx-6*s,cy-10*s); ctx.lineTo(cx-14*s,cy-20*s); ctx.lineTo(cx+2*s,cy-12*s); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx-6*s,cy+10*s); ctx.lineTo(cx-14*s,cy+20*s); ctx.lineTo(cx+2*s,cy+12*s); ctx.fill();
  // eyes
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(cx-6*s,cy-3*s,4*s,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#1a1a6a'; ctx.beginPath(); ctx.arc(cx-5*s,cy-3*s,2*s,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#88DDFF'; ctx.beginPath(); ctx.arc(cx-4*s,cy-4*s,1*s,0,Math.PI*2); ctx.fill();
}

function drawLeafbud(ctx, cx, cy, s) {
  // body
  ctx.fillStyle='#44BB44'; ctx.beginPath();
  ctx.ellipse(cx, cy+2*s, 13*s, 14*s, 0, 0, Math.PI*2); ctx.fill();
  // leaf
  ctx.fillStyle='#33AA22';
  ctx.beginPath(); ctx.moveTo(cx,cy-14*s); ctx.quadraticCurveTo(cx+20*s,cy-30*s,cx+4*s,cy-10*s); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx,cy-14*s); ctx.quadraticCurveTo(cx-20*s,cy-28*s,cx-4*s,cy-10*s); ctx.fill();
  ctx.fillStyle='#55DD33';
  ctx.beginPath(); ctx.moveTo(cx,cy-14*s); ctx.quadraticCurveTo(cx+10*s,cy-26*s,cx+2*s,cy-10*s); ctx.fill();
  // eyes
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(cx-5*s,cy,4*s,0,Math.PI*2); ctx.arc(cx+5*s,cy,4*s,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#223322'; ctx.beginPath(); ctx.arc(cx-4*s,cy,2*s,0,Math.PI*2); ctx.arc(cx+6*s,cy,2*s,0,Math.PI*2); ctx.fill();
  // feet
  ctx.fillStyle='#33AA22';
  rr(ctx, cx-10*s,cy+12*s,7*s,6*s,3*s); ctx.fill();
  rr(ctx, cx+3*s, cy+12*s,7*s,6*s,3*s); ctx.fill();
}

function drawZappup(ctx, cx, cy, s) {
  // lightning bolt tail
  ctx.fillStyle='#FFAA00';
  ctx.beginPath(); ctx.moveTo(cx+12*s,cy); ctx.lineTo(cx+24*s,cy-8*s); ctx.lineTo(cx+20*s,cy+2*s); ctx.lineTo(cx+28*s,cy+6*s); ctx.fill();
  // body
  ctx.fillStyle='#FFDD00'; ctx.beginPath();
  ctx.ellipse(cx, cy+2*s, 12*s, 10*s, 0, 0, Math.PI*2); ctx.fill();
  // head
  ctx.fillStyle='#FFEE22'; ctx.beginPath();
  ctx.arc(cx-4*s, cy-12*s, 11*s, 0, Math.PI*2); ctx.fill();
  // lightning ears
  ctx.fillStyle='#FFAA00';
  ctx.beginPath(); ctx.moveTo(cx-12*s,cy-18*s); ctx.lineTo(cx-16*s,cy-30*s); ctx.lineTo(cx-8*s,cy-24*s); ctx.lineTo(cx-6*s,cy-32*s); ctx.lineTo(cx-4*s,cy-22*s); ctx.lineTo(cx-8*s,cy-18*s); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx+4*s,cy-20*s); ctx.lineTo(cx+8*s,cy-32*s); ctx.lineTo(cx+10*s,cy-22*s); ctx.lineTo(cx+14*s,cy-30*s); ctx.lineTo(cx+12*s,cy-20*s); ctx.fill();
  // cheeks
  ctx.fillStyle='#FF5555'; ctx.beginPath(); ctx.arc(cx-12*s,cy-12*s,3*s,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx+4*s,cy-12*s,3*s,0,Math.PI*2); ctx.fill();
  // eyes
  ctx.fillStyle='#333'; ctx.beginPath(); ctx.arc(cx-8*s,cy-14*s,2.5*s,0,Math.PI*2); ctx.arc(cx,cy-14*s,2.5*s,0,Math.PI*2); ctx.fill();
  // legs
  ctx.fillStyle='#FFCC00';
  rr(ctx, cx-10*s,cy+10*s,7*s,8*s,3*s); ctx.fill();
  rr(ctx, cx+2*s, cy+10*s,7*s,8*s,3*s); ctx.fill();
}

function drawRockback(ctx, cx, cy, s) {
  // shell
  ctx.fillStyle='#887766';
  rr(ctx, cx-14*s, cy-10*s, 28*s, 24*s, 8*s); ctx.fill();
  ctx.fillStyle='#665544';
  rr(ctx, cx-11*s, cy-7*s, 22*s, 18*s, 6*s); ctx.fill();
  // shell pattern
  ctx.strokeStyle='#998877'; ctx.lineWidth=1.5*s;
  ctx.beginPath(); ctx.moveTo(cx,cy-7*s); ctx.lineTo(cx,cy+11*s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx-11*s,cy+2*s); ctx.lineTo(cx+11*s,cy+2*s); ctx.stroke();
  // head
  ctx.fillStyle='#AABB88'; ctx.beginPath();
  ctx.arc(cx, cy-16*s, 9*s, 0, Math.PI*2); ctx.fill();
  // eyes
  ctx.fillStyle='#333'; ctx.beginPath(); ctx.arc(cx-4*s,cy-17*s,2*s,0,Math.PI*2); ctx.arc(cx+4*s,cy-17*s,2*s,0,Math.PI*2); ctx.fill();
  // legs
  ctx.fillStyle='#AABB88';
  rr(ctx, cx-18*s,cy-2*s,7*s,8*s,3*s); ctx.fill();
  rr(ctx, cx+11*s,cy-2*s,7*s,8*s,3*s); ctx.fill();
  rr(ctx, cx-12*s,cy+12*s,8*s,6*s,3*s); ctx.fill();
  rr(ctx, cx+4*s, cy+12*s,8*s,6*s,3*s); ctx.fill();
}

function drawGhostwisp(ctx, cx, cy, s) {
  // wispy bottom
  ctx.fillStyle='#8844BB';
  ctx.beginPath(); ctx.moveTo(cx-14*s,cy+2*s);
  ctx.quadraticCurveTo(cx-18*s,cy+20*s,cx-10*s,cy+14*s);
  ctx.quadraticCurveTo(cx-4*s, cy+22*s,cx,   cy+14*s);
  ctx.quadraticCurveTo(cx+4*s, cy+22*s,cx+10*s,cy+14*s);
  ctx.quadraticCurveTo(cx+18*s,cy+20*s,cx+14*s,cy+2*s);
  ctx.fill();
  // body
  ctx.fillStyle='#9955CC'; ctx.beginPath();
  ctx.arc(cx, cy-4*s, 14*s, 0, Math.PI*2); ctx.fill();
  rr(ctx, cx-14*s, cy-4*s, 28*s, 16*s, 2*s); ctx.fill();
  // glow eyes
  ctx.fillStyle='#FFEE44'; ctx.beginPath(); ctx.arc(cx-5*s,cy-5*s,5*s,0,Math.PI*2); ctx.arc(cx+5*s,cy-5*s,5*s,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#222'; ctx.beginPath(); ctx.arc(cx-5*s,cy-5*s,2.5*s,0,Math.PI*2); ctx.arc(cx+5*s,cy-5*s,2.5*s,0,Math.PI*2); ctx.fill();
  // arms
  ctx.fillStyle='#8844BB';
  ctx.beginPath(); ctx.arc(cx-18*s,cy-8*s,5*s,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx+18*s,cy-8*s,5*s,0,Math.PI*2); ctx.fill();
}

function drawSnowpuff(ctx, cx, cy, s) {
  // fluffy clouds
  ctx.fillStyle='#CCEEFF';
  [[-10,-4,9],[0,-10,8],[10,-4,9],[-6,4,8],[6,4,8]].forEach(([dx,dy,r]) => {
    ctx.beginPath(); ctx.arc(cx+dx*s,cy+dy*s,r*s,0,Math.PI*2); ctx.fill();
  });
  ctx.fillStyle='#fff';
  [[-8,-6,6],[2,-9,6],[9,-6,6],[-4,2,5],[5,2,5]].forEach(([dx,dy,r]) => {
    ctx.beginPath(); ctx.arc(cx+dx*s,cy+dy*s,r*s,0,Math.PI*2); ctx.fill();
  });
  // eyes
  ctx.fillStyle='#334466'; ctx.beginPath(); ctx.arc(cx-4*s,cy-2*s,2.5*s,0,Math.PI*2); ctx.arc(cx+4*s,cy-2*s,2.5*s,0,Math.PI*2); ctx.fill();
  // icy accents
  ctx.strokeStyle='#88CCFF'; ctx.lineWidth=1.5*s;
  ctx.beginPath(); ctx.moveTo(cx,cy+8*s); ctx.lineTo(cx,cy+14*s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx-4*s,cy+10*s); ctx.lineTo(cx+4*s,cy+10*s); ctx.stroke();
}

function drawInfernox(ctx, cx, cy, s) {
  // large flame aura
  ctx.fillStyle='#FF6600';
  ctx.beginPath(); ctx.moveTo(cx+14*s,cy-4*s); ctx.lineTo(cx+28*s,cy-18*s); ctx.lineTo(cx+24*s,cy+8*s); ctx.fill();
  ctx.fillStyle='#FFAA00';
  ctx.beginPath(); ctx.moveTo(cx+14*s,cy-2*s); ctx.lineTo(cx+24*s,cy-14*s); ctx.lineTo(cx+22*s,cy+6*s); ctx.fill();
  // fire crown
  [[-8,-24],[0,-28],[8,-24]].forEach(([dx,dy]) => {
    ctx.fillStyle='#FF6600'; ctx.beginPath();
    ctx.moveTo(cx+dx*s,cy+(dy+8)*s); ctx.lineTo(cx+(dx-4)*s,cy+dy*s); ctx.lineTo(cx+(dx+4)*s,cy+dy*s); ctx.fill();
  });
  // body
  ctx.fillStyle='#CC2200';
  rr(ctx, cx-14*s, cy-6*s, 28*s, 22*s, 8*s); ctx.fill();
  // head
  ctx.fillStyle='#DD3311'; ctx.beginPath(); ctx.arc(cx,cy-16*s,13*s,0,Math.PI*2); ctx.fill();
  // eyes glow
  ctx.fillStyle='#FFAA00'; ctx.beginPath(); ctx.arc(cx-5*s,cy-17*s,5*s,0,Math.PI*2); ctx.arc(cx+5*s,cy-17*s,5*s,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#FF2200'; ctx.beginPath(); ctx.arc(cx-5*s,cy-17*s,2.5*s,0,Math.PI*2); ctx.arc(cx+5*s,cy-17*s,2.5*s,0,Math.PI*2); ctx.fill();
  // legs
  ctx.fillStyle='#CC2200';
  rr(ctx,cx-12*s,cy+14*s,9*s,10*s,4*s); ctx.fill();
  rr(ctx,cx+3*s, cy+14*s,9*s,10*s,4*s); ctx.fill();
}

function drawTidalfin(ctx, cx, cy, s) {
  // large fin
  ctx.fillStyle='#0033AA';
  ctx.beginPath(); ctx.moveTo(cx-4*s,cy-18*s); ctx.lineTo(cx-20*s,cy-36*s); ctx.lineTo(cx+6*s,cy-16*s); ctx.fill();
  // tail
  ctx.fillStyle='#0044BB';
  ctx.beginPath(); ctx.moveTo(cx+16*s,cy); ctx.lineTo(cx+28*s,cy-12*s); ctx.lineTo(cx+30*s,cy+12*s); ctx.fill();
  // body
  ctx.fillStyle='#1166DD'; ctx.beginPath();
  ctx.ellipse(cx, cy+2*s, 18*s, 14*s, 0, 0, Math.PI*2); ctx.fill();
  // side fins
  ctx.fillStyle='#0055CC';
  ctx.beginPath(); ctx.moveTo(cx-10*s,cy-6*s); ctx.lineTo(cx-24*s,cy-18*s); ctx.lineTo(cx-6*s,cy+4*s); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx-10*s,cy+6*s); ctx.lineTo(cx-24*s,cy+18*s); ctx.lineTo(cx-6*s,cy+2*s); ctx.fill();
  // eyes
  ctx.fillStyle='#fff'; ctx.beginPath(); ctx.arc(cx-6*s,cy-2*s,5*s,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#001166'; ctx.beginPath(); ctx.arc(cx-5*s,cy-2*s,2.5*s,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#88DDFF'; ctx.beginPath(); ctx.arc(cx-4*s,cy-3*s,1.2*s,0,Math.PI*2); ctx.fill();
}

function drawThornvine(ctx, cx, cy, s) {
  // vines hanging
  ctx.strokeStyle='#226622'; ctx.lineWidth=2*s;
  [[-8,6],[0,8],[8,6]].forEach(([dx,l]) => {
    ctx.beginPath(); ctx.moveTo(cx+dx*s,cy+l*s); ctx.lineTo(cx+dx*s,cy+(l+14)*s); ctx.stroke();
  });
  // body
  ctx.fillStyle='#115511';
  rr(ctx, cx-14*s, cy-8*s, 28*s, 24*s, 9*s); ctx.fill();
  // vine wrap
  ctx.strokeStyle='#33AA33'; ctx.lineWidth=2.5*s;
  ctx.beginPath(); ctx.moveTo(cx-14*s,cy+2*s); ctx.quadraticCurveTo(cx,cy-14*s,cx+14*s,cy+2*s); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx-12*s,cy+8*s); ctx.quadraticCurveTo(cx,cy-6*s,cx+12*s,cy+8*s); ctx.stroke();
  // head
  ctx.fillStyle='#226622'; ctx.beginPath(); ctx.arc(cx,cy-18*s,11*s,0,Math.PI*2); ctx.fill();
  // leaf crown
  ctx.fillStyle='#44CC22';
  [[-10,-26],[0,-30],[10,-26]].forEach(([dx,dy]) => {
    ctx.beginPath(); ctx.ellipse(cx+dx*s,cy+dy*s,5*s,8*s,-0.3+Math.PI/2,0,Math.PI*2); ctx.fill();
  });
  // eyes
  ctx.fillStyle='#AAFF66'; ctx.beginPath(); ctx.arc(cx-4*s,cy-19*s,3.5*s,0,Math.PI*2); ctx.arc(cx+4*s,cy-19*s,3.5*s,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#113311'; ctx.beginPath(); ctx.arc(cx-4*s,cy-19*s,1.5*s,0,Math.PI*2); ctx.arc(cx+4*s,cy-19*s,1.5*s,0,Math.PI*2); ctx.fill();
}

function drawVoltpaw(ctx, cx, cy, s) {
  // lightning bolt aura
  ctx.fillStyle='#FFCC00';
  ctx.beginPath(); ctx.moveTo(cx+14*s,cy); ctx.lineTo(cx+26*s,cy-12*s); ctx.lineTo(cx+22*s,cy-2*s); ctx.lineTo(cx+30*s,cy-6*s); ctx.fill();
  // body
  ctx.fillStyle='#FFAA00';
  rr(ctx, cx-14*s, cy-4*s, 28*s, 20*s, 8*s); ctx.fill();
  // head
  ctx.fillStyle='#FFBB00'; ctx.beginPath(); ctx.arc(cx-4*s,cy-14*s,13*s,0,Math.PI*2); ctx.fill();
  // spiky ears
  ctx.fillStyle='#FFAA00';
  ctx.beginPath(); ctx.moveTo(cx-14*s,cy-22*s); ctx.lineTo(cx-18*s,cy-36*s); ctx.lineTo(cx-10*s,cy-26*s); ctx.lineTo(cx-8*s,cy-36*s); ctx.lineTo(cx-4*s,cy-22*s); ctx.fill();
  ctx.beginPath(); ctx.moveTo(cx+6*s,cy-22*s); ctx.lineTo(cx+10*s,cy-36*s); ctx.lineTo(cx+12*s,cy-26*s); ctx.lineTo(cx+16*s,cy-34*s); ctx.lineTo(cx+14*s,cy-22*s); ctx.fill();
  // nose
  ctx.fillStyle='#333'; ctx.beginPath(); ctx.arc(cx-3*s,cy-13*s,2*s,0,Math.PI*2); ctx.fill();
  // eyes
  ctx.fillStyle='#222'; ctx.beginPath(); ctx.arc(cx-10*s,cy-16*s,2.5*s,0,Math.PI*2); ctx.arc(cx+2*s,cy-16*s,2.5*s,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#FFEE00'; ctx.beginPath(); ctx.arc(cx-9*s,cy-17*s,1*s,0,Math.PI*2); ctx.arc(cx+3*s,cy-17*s,1*s,0,Math.PI*2); ctx.fill();
  // legs
  ctx.fillStyle='#FFAA00';
  rr(ctx,cx-12*s,cy+14*s,8*s,10*s,4*s); ctx.fill();
  rr(ctx,cx+4*s, cy+14*s,8*s,10*s,4*s); ctx.fill();
}

const SPRITE_FNS = {
  1:drawFlambit, 2:drawAquafin, 3:drawLeafbud, 4:drawInfernox,
  5:drawTidalfin, 6:drawThornvine, 7:drawZappup, 8:drawVoltpaw,
  9:drawRockback, 10:drawGhostwisp, 11:drawSnowpuff,
};
function drawSprite(ctx, id, cx, cy, size) {
  const fn = SPRITE_FNS[id];
  if (fn) { ctx.save(); fn(ctx, cx, cy, size/64); ctx.restore(); }
}

// ===================== PLAYER SPRITE =====================
function drawPlayer(ctx, cx, cy, dir, frame) {
  const s = TS / 32;
  // shadow
  ctx.fillStyle='rgba(0,0,0,0.2)'; ctx.beginPath();
  ctx.ellipse(cx, cy+14*s, 8*s, 3*s, 0, 0, Math.PI*2); ctx.fill();
  // legs
  const legOff = frame % 2 === 0 ? 3 : -3;
  ctx.fillStyle='#3355AA';
  if (dir === 'left' || dir === 'right') {
    rr(ctx, cx-(6+legOff/2)*s, cy+5*s, 5*s, 9*s, 2*s); ctx.fill();
    rr(ctx, cx+(1-legOff/2)*s, cy+5*s, 5*s, 9*s, 2*s); ctx.fill();
  } else {
    rr(ctx, cx-7*s,       cy+(5+legOff)*s, 5*s, 9*s, 2*s); ctx.fill();
    rr(ctx, cx+2*s,       cy+(5-legOff)*s, 5*s, 9*s, 2*s); ctx.fill();
  }
  // body
  ctx.fillStyle='#EE4444';
  rr(ctx, cx-8*s, cy-4*s, 16*s, 12*s, 4*s); ctx.fill();
  // arms
  ctx.fillStyle='#EE4444';
  rr(ctx, cx-12*s, cy-3*s, 5*s, 9*s, 2*s); ctx.fill();
  rr(ctx, cx+7*s,  cy-3*s, 5*s, 9*s, 2*s); ctx.fill();
  // head
  ctx.fillStyle='#FFCC99'; ctx.beginPath();
  ctx.arc(cx, cy-12*s, 9*s, 0, Math.PI*2); ctx.fill();
  // cap
  ctx.fillStyle='#CC0000';
  rr(ctx, cx-10*s, cy-20*s, 20*s, 9*s, 4*s); ctx.fill();
  ctx.fillStyle='#AA0000';
  rr(ctx, cx-12*s, cy-16*s, 24*s, 5*s, 2*s); ctx.fill();
  // face
  if (dir !== 'up') {
    ctx.fillStyle='#222'; ctx.beginPath();
    ctx.arc(cx-4*s, cy-12*s, 1.5*s, 0, Math.PI*2);
    ctx.arc(cx+4*s, cy-12*s, 1.5*s, 0, Math.PI*2); ctx.fill();
  }
}

// ===================== TILE RENDERING =====================
let animTick = 0;
function drawTile(ctx, tx, ty, px, py) {
  const t = getTile(tx, ty);
  switch(t) {
    case 0: // path
      ctx.fillStyle = '#C8A070';
      ctx.fillRect(px, py, TS, TS);
      // dirt noise
      ctx.fillStyle = 'rgba(0,0,0,0.07)';
      for (let i = 0; i < 3; i++) {
        const nx = ((tx*7+ty*3+i*11)%28)+2, ny = ((tx*5+ty*11+i*7)%26)+2;
        ctx.fillRect(px+nx, py+ny, 2, 2);
      }
      break;
    case 1: // short grass
      ctx.fillStyle = '#5AA832'; ctx.fillRect(px, py, TS, TS);
      ctx.fillStyle = '#4A9228';
      for (let i = 0; i < 4; i++) {
        const gx = ((tx*9+ty*5+i*7)%28)+2, gy = ((tx*3+ty*13+i*11)%26)+2;
        ctx.fillRect(px+gx, py+gy, 1, 4);
        ctx.fillRect(px+gx+1, py+gy-1, 1, 3);
      }
      break;
    case 2: // tall grass
      ctx.fillStyle = '#2A6B1A'; ctx.fillRect(px, py, TS, TS);
      ctx.fillStyle = '#3A8A22';
      for (let i = 0; i < 6; i++) {
        const gx = ((tx*11+ty*7+i*5)%26)+2, gy = ((tx*7+ty*9+i*13)%22)+4;
        ctx.fillRect(px+gx, py+gy, 2, 8);
        ctx.fillRect(px+gx+1, py+gy-3, 1, 6);
      }
      ctx.fillStyle = '#4AAA30';
      for (let i = 0; i < 3; i++) {
        const gx = ((tx*13+ty*11+i*9)%24)+4, gy = ((tx*11+ty*7+i*5)%20)+2;
        ctx.fillRect(px+gx, py+gy, 1, 10);
      }
      break;
    case 3: // tree
      ctx.fillStyle = '#143A06'; ctx.fillRect(px, py, TS, TS);
      ctx.fillStyle = '#1E5C0A';
      ctx.beginPath(); ctx.arc(px+TS/2, py+TS/2+2, 12, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#267010';
      ctx.beginPath(); ctx.arc(px+TS/2-3, py+TS/2-2, 9, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#2E8A14';
      ctx.beginPath(); ctx.arc(px+TS/2+3, py+TS/2-4, 8, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#1A4A08';
      ctx.fillRect(px+TS/2-3, py+TS/2+6, 6, 8);
      break;
    case 4: { // water
      const wave = (animTick / 30 + tx * 0.3 + ty * 0.5);
      ctx.fillStyle = '#1A66CC'; ctx.fillRect(px, py, TS, TS);
      ctx.fillStyle = '#2277DD';
      ctx.fillRect(px, py, TS, TS/2 + Math.sin(wave)*2);
      ctx.fillStyle = 'rgba(180,220,255,0.25)';
      for (let i = 0; i < 2; i++) {
        const wx = ((tx*7+i*13)%20)+4;
        const wy = ((ty*11+i*7)%18)+4 + Math.sin(wave+i)*3;
        ctx.beginPath(); ctx.arc(px+wx, py+wy, 4, 0, Math.PI); ctx.stroke();
      }
      break;
    }
    case 5: // building
      ctx.fillStyle = '#9B8B6F'; ctx.fillRect(px, py, TS, TS);
      ctx.fillStyle = '#7A6248'; ctx.fillRect(px, py, TS, 8);
      ctx.fillStyle = '#B09A7F'; ctx.fillRect(px+2, py+2, TS-4, TS-10);
      break;
    case 6: // town floor
      ctx.fillStyle = '#D4B896'; ctx.fillRect(px, py, TS, TS);
      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      ctx.fillRect(px, py, TS, 1); ctx.fillRect(px, py, 1, TS);
      break;
  }
}

// ===================== GAME STATE =====================
let state = 'title';
let player = { tx: 14, ty: 21, dir: 'down', moving: false, px: 14*TS, py: 21*TS, progress: 0, walkFrame: 0, stepTimer: 0 };
let party = []; // player's monsters
let battleData = null;
let titleTimer = 0;
let starterIdx = 0;
let dialogLines = [], dialogIdx = 0, dialogCb = null;
let battleMsg = '', battleMsgCb = null, battleMsgTimer = 0;
let battleSubState = 'selectAction';
let battleCursor = 0;
let flashTimer = 0, flashTarget = '';
let encounterFlash = 0;
let levelupData = null, evolveData = null;
let gameoverTimer = 0;

function showDialog(lines, cb) {
  dialogLines = typeof lines === 'string' ? [lines] : lines;
  dialogIdx = 0; dialogCb = cb;
  state = 'dialog';
}

function battleMsg_(msg, cb, delay = 1800) {
  battleMsg = msg; battleMsgCb = cb; battleMsgTimer = delay;
}

function startBattle(wildId, wildLv) {
  SFX.encounter();
  encounterFlash = 8;
  const enemy = makeMon(wildId, wildLv);
  battleData = {
    enemy, playerMon: party[0],
    result: null,
  };
  state = 'battleIntro';
}

function loadSave() {
  try {
    const s = localStorage.getItem('pixelmon_save');
    if (!s) return false;
    const d = JSON.parse(s);
    player.tx = d.tx; player.ty = d.ty;
    player.px = d.tx * TS; player.py = d.ty * TS;
    party = d.party;
    return true;
  } catch(_) { return false; }
}

function doSave() {
  try { localStorage.setItem('pixelmon_save', JSON.stringify({ tx:player.tx, ty:player.ty, party })); } catch(_) {}
}

// ===================== OVERWORLD UPDATE =====================
function updateOverworld() {
  if (player.moving) {
    player.progress += 0.18;
    if (player.progress >= 1) {
      player.progress = 1;
      player.moving = false;
      player.px = player.tx * TS;
      player.py = player.ty * TS;
      player.walkFrame++;
      // encounter check
      const t = getTile(player.tx, player.ty);
      if (t === 2 && Math.random() < 0.15) {
        const wid = pickWild(player.ty);
        const plv = party[0].lv;
        const wlv = Math.max(2, plv - 2 + Math.floor(Math.random() * 5));
        startBattle(wid, wlv);
      }
    } else {
      const dx = player.dir === 'right' ? 1 : player.dir === 'left' ? -1 : 0;
      const dy = player.dir === 'down'  ? 1 : player.dir === 'up'   ? -1 : 0;
      player.px = (player.tx - dx + dx * player.progress) * TS;
      player.py = (player.ty - dy + dy * player.progress) * TS;
    }
    return;
  }

  let dx = 0, dy = 0, dir = player.dir;
  if (key('ArrowUp')    || key('KeyW')) { dy = -1; dir = 'up'; }
  else if (key('ArrowDown')  || key('KeyS')) { dy =  1; dir = 'down'; }
  else if (key('ArrowLeft')  || key('KeyA')) { dx = -1; dir = 'left'; }
  else if (key('ArrowRight') || key('KeyD')) { dx =  1; dir = 'right'; }

  player.dir = dir;
  if (dx !== 0 || dy !== 0) {
    const nx = player.tx + dx, ny = player.ty + dy;
    if (walkable(nx, ny)) {
      player.tx = nx; player.ty = ny;
      player.moving = true; player.progress = 0;
      SFX.step();
    }
  }
}

// ===================== BATTLE UPDATE =====================
function updateBattle() {
  if (battleMsgTimer > 0) {
    battleMsgTimer -= 16.67;
    if (battleMsgTimer <= 0) {
      const cb = battleMsgCb; battleMsgCb = null; battleMsg = '';
      if (cb) cb();
    }
    return;
  }

  const { enemy, playerMon } = battleData;

  if (battleSubState === 'selectAction') {
    if (tap('ArrowLeft') || tap('KeyA')) { battleCursor = 0; SFX.cursor(); }
    if (tap('ArrowRight') || tap('KeyD')) { battleCursor = 1; SFX.cursor(); }
    if (tap('Enter') || tap('Space')) {
      SFX.confirm();
      if (battleCursor === 0) { battleSubState = 'selectMove'; battleCursor = 0; }
      else { // RUN
        SFX.run();
        battleMsg_('Got away safely!', () => {
          state = 'overworld'; battleData = null; doSave();
        });
      }
    }
  } else if (battleSubState === 'selectMove') {
    const moves = playerMon.moves;
    if (tap('ArrowUp') || tap('KeyW')) { battleCursor = (battleCursor - 2 + 4) % 4; SFX.cursor(); }
    if (tap('ArrowDown') || tap('KeyS')) { battleCursor = (battleCursor + 2) % 4; SFX.cursor(); }
    if (tap('ArrowLeft') || tap('KeyA')) { battleCursor = battleCursor % 2 === 0 ? battleCursor : battleCursor - 1; SFX.cursor(); }
    if (tap('ArrowRight') || tap('KeyD')) { battleCursor = battleCursor % 2 === 0 ? Math.min(moves.length-1, battleCursor+1) : battleCursor; SFX.cursor(); }
    // number keys 1-4
    for (let i = 1; i <= 4; i++) if (tap('Digit'+i) && i-1 < moves.length) { battleCursor = i-1; }
    if (tap('Escape') || tap('Backspace')) { battleSubState = 'selectAction'; battleCursor = 0; SFX.cursor(); return; }
    if (tap('Enter') || tap('Space')) {
      const mv = moves[battleCursor];
      if (!mv || mv.pp <= 0) return;
      mv.pp--;
      battleSubState = 'playerAttack';
      execPlayerAttack(mv.id);
    }
  } else if (battleSubState === 'showMessage') {
    if (tap('Enter') || tap('Space') || tap('ArrowDown')) {
      const cb = battleMsgCb; battleMsgCb = null; battleMsg = '';
      battleMsgTimer = 0;
      if (cb) cb();
    }
  }
}

function execPlayerAttack(moveId) {
  const { enemy, playerMon } = battleData;
  const m = MOVES[moveId];
  if (Math.random() * 100 > m.acc) {
    battleMsg_(`${playerMon ? DEFS[playerMon.id].name : ''}'s attack missed!`, () => {
      execEnemyTurn();
    });
    return;
  }
  const {dmg, eff} = calcDmg(playerMon, moveId, enemy);
  SFX.hit();
  flashTimer = 8; flashTarget = 'enemy';
  enemy.hp = Math.max(0, enemy.hp - dmg);
  let msg = `${DEFS[playerMon.id].name} used ${m.name}!`;
  if (eff >= 2) msg += " It's super effective!";
  else if (eff <= 0.5 && eff > 0) msg += " It's not very effective.";
  else if (eff === 0) msg += " It had no effect!";
  if (enemy.hp <= 0) {
    battleMsg_(msg, () => enemyFainted());
  } else {
    battleMsg_(msg, () => execEnemyTurn());
  }
}

function execEnemyTurn() {
  const { enemy, playerMon } = battleData;
  // pick random move with pp
  const avail = enemy.moves.filter(m => m.pp > 0);
  if (!avail.length) { battleMsg_(`${DEFS[enemy.id].name} is out of moves!`, () => { battleSubState = 'selectAction'; battleCursor = 0; }); return; }
  const mv = avail[Math.floor(Math.random() * avail.length)];
  mv.pp--;
  const m = MOVES[mv.id];
  if (Math.random() * 100 > m.acc) {
    battleMsg_(`${DEFS[enemy.id].name}'s attack missed!`, () => { battleSubState = 'selectAction'; battleCursor = 0; });
    return;
  }
  const {dmg, eff} = calcDmg(enemy, mv.id, playerMon);
  SFX.hurt();
  flashTimer = 8; flashTarget = 'player';
  playerMon.hp = Math.max(0, playerMon.hp - dmg);
  let msg = `${DEFS[enemy.id].name} used ${m.name}!`;
  if (eff >= 2) msg += " It's super effective!";
  else if (eff <= 0.5 && eff > 0) msg += " It's not very effective.";
  if (playerMon.hp <= 0) {
    battleMsg_(msg, () => playerFainted());
  } else {
    battleMsg_(msg, () => { battleSubState = 'selectAction'; battleCursor = 0; });
  }
}

function enemyFainted() {
  const { enemy, playerMon } = battleData;
  SFX.faint();
  const gain = Math.floor(DEFS[enemy.id].xp * enemy.lv / 7);
  playerMon.xp += gain;
  battleMsg_(`${DEFS[enemy.id].name} fainted! ${DEFS[playerMon.id].name} gained ${gain} XP.`, () => {
    checkLevelUp(() => { SFX.victory(); battleMsg_('Victory!', () => { state = 'overworld'; battleData = null; doSave(); }); });
  });
}

function playerFainted() {
  const { playerMon } = battleData;
  SFX.faint();
  battleMsg_(`${DEFS[playerMon.id].name} fainted!`, () => {
    // heal
    playerMon.hp = playerMon.maxHp;
    playerMon.moves.forEach(m => { m.pp = MOVES[m.id].pp; });
    gameoverTimer = 180;
    state = 'gameover';
    battleData = null;
  });
}

function checkLevelUp(cb) {
  const mon = party[0];
  if (mon.xp >= mon.xpNeeded) {
    mon.xp -= mon.xpNeeded;
    mon.lv++;
    mon.xpNeeded = xpToNext(mon.lv);
    mon.maxHp = calcMaxHP(mon.id, mon.lv);
    mon.hp = Math.min(mon.hp + 10, mon.maxHp);
    SFX.levelup();
    levelupData = { mon, cb };
    state = 'levelup';
  } else cb();
}

function checkEvolve(mon, cb) {
  const d = DEFS[mon.id];
  if (d.evo && mon.lv >= d.evoLv) {
    evolveData = { mon, newId: d.evo, cb };
    state = 'evolve';
  } else cb();
}

// ===================== RENDER =====================
function render() {
  ctx.clearRect(0, 0, 480, 320);
  animTick++;

  if (state === 'title') renderTitle();
  else if (state === 'starter') renderStarter();
  else if (state === 'overworld' || state === 'dialog') renderOverworld(); // dialog renders on top of overworld
  else if (state === 'battleIntro') renderBattleIntro();
  else if (state === 'battle') renderBattle();
  else if (state === 'levelup') renderLevelup();
  else if (state === 'evolve') renderEvolve();
  else if (state === 'gameover') renderGameover();

  if (state === 'dialog') renderDialog();
}

function renderTitle() {
  titleTimer++;
  ctx.fillStyle = '#1a1a2e'; ctx.fillRect(0, 0, 480, 320);
  // stars
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 40; i++) {
    const x = (i * 37 + 11) % 480, y = (i * 53 + 7) % 280;
    const flicker = Math.sin(titleTimer * 0.05 + i) > 0.7;
    if (!flicker) { ctx.beginPath(); ctx.arc(x, y, 1, 0, Math.PI*2); ctx.fill(); }
  }
  // grass hills
  ctx.fillStyle = '#2A6B1A';
  ctx.beginPath(); ctx.moveTo(0, 280); ctx.quadraticCurveTo(120, 240, 240, 270); ctx.quadraticCurveTo(360, 300, 480, 260); ctx.lineTo(480, 320); ctx.lineTo(0, 320); ctx.fill();
  ctx.fillStyle = '#3A8A22';
  ctx.beginPath(); ctx.moveTo(0, 295); ctx.quadraticCurveTo(100, 265, 240, 290); ctx.quadraticCurveTo(380, 315, 480, 280); ctx.lineTo(480, 320); ctx.lineTo(0, 320); ctx.fill();
  // title text
  const grd = ctx.createLinearGradient(0, 100, 0, 160);
  grd.addColorStop(0, '#FFD700'); grd.addColorStop(1, '#FF6600');
  ctx.font = 'bold 52px "Courier New"';
  ctx.fillStyle = '#000'; ctx.fillText('PIXELMON', 240-ctx.measureText('PIXELMON').width/2+3, 133);
  ctx.fillStyle = grd; ctx.fillText('PIXELMON', 240-ctx.measureText('PIXELMON').width/2, 130);
  // tagline
  ctx.font = '14px "Courier New"';
  ctx.fillStyle = '#AAA'; ctx.fillText('A Pixel Adventure', 172, 158);
  // blink prompt
  if (Math.floor(titleTimer / 30) % 2 === 0) {
    ctx.font = '13px "Courier New"';
    ctx.fillStyle = '#fff'; ctx.fillText('Press ENTER to start', 162, 260);
  }
  // mini creatures on title
  ctx.save(); ctx.translate(80, 240); drawSprite(ctx, 1, 0, 0, 48); ctx.restore();
  ctx.save(); ctx.translate(240, 235); drawSprite(ctx, 3, 0, 0, 48); ctx.restore();
  ctx.save(); ctx.translate(400, 240); drawSprite(ctx, 2, 0, 0, 48); ctx.restore();
}

function renderStarter() {
  ctx.fillStyle = '#e8f0ff'; ctx.fillRect(0, 0, 480, 320);
  ctx.fillStyle = '#2244AA'; ctx.font = 'bold 18px "Courier New"';
  ctx.fillText('Choose your partner!', 240 - ctx.measureText('Choose your partner!').width/2, 36);
  ctx.fillStyle = '#666'; ctx.font = '12px "Courier New"';
  ctx.fillText('Arrow Keys to choose, Enter to confirm', 240 - ctx.measureText('Arrow Keys to choose, Enter to confirm').width/2, 56);

  const starters = [1, 2, 3];
  const names = ['Flambit', 'Aquafin', 'Leafbud'];
  const types = ['Fire', 'Water', 'Grass'];
  const descs = ['Fiery and fast', 'Sturdy and calm', 'Balanced power'];
  const xs = [100, 240, 380];

  starters.forEach((id, i) => {
    const x = xs[i], sel = starterIdx === i;
    ctx.fillStyle = sel ? '#FFEECC' : '#D0D8F0';
    rr(ctx, x-46, 70, 92, 180, 10); ctx.fill();
    ctx.strokeStyle = sel ? '#FF8800' : '#8899BB';
    ctx.lineWidth = sel ? 3 : 1.5;
    rr(ctx, x-46, 70, 92, 180, 10); ctx.stroke();
    if (sel) {
      ctx.font = 'bold 18px "Courier New"';
      ctx.fillStyle = '#FF8800'; ctx.fillText('▲', x-6, 68);
    }
    drawSprite(ctx, id, x, 130, 80);
    ctx.font = 'bold 13px "Courier New"';
    ctx.fillStyle = '#222'; ctx.fillText(names[i], x - ctx.measureText(names[i]).width/2, 195);
    ctx.fillStyle = TYPE_COLOR[types[i]]; ctx.font = '11px "Courier New"';
    ctx.fillText('['+types[i]+']', x - ctx.measureText('['+types[i]+']').width/2, 211);
    ctx.fillStyle = '#555'; ctx.fillText(descs[i], x - ctx.measureText(descs[i]).width/2, 228);
  });

  ctx.font = '12px "Courier New"'; ctx.fillStyle = '#777';
  ctx.fillText('← → to browse  |  Enter to confirm', 109, 270);
}

function renderOverworld() {
  const camX = Math.max(0, Math.min(MAP_W * TS - 480, Math.floor(player.px) - 240 + TS/2));
  const camY = Math.max(0, Math.min(MAP_H * TS - 320, Math.floor(player.py) - 160 + TS/2));
  const startTX = Math.floor(camX / TS);
  const startTY = Math.floor(camY / TS);

  for (let ty = startTY - 1; ty <= startTY + 11; ty++) {
    for (let tx = startTX - 1; tx <= startTX + 16; tx++) {
      const px = tx * TS - camX, py = ty * TS - camY;
      drawTile(ctx, tx, ty, px, py);
    }
  }

  // draw player
  const ppx = Math.floor(player.px) - camX + TS/2;
  const ppy = Math.floor(player.py) - camY + TS/2;
  const wf = player.moving ? player.walkFrame : 0;
  drawPlayer(ctx, ppx, ppy, player.dir, wf);

  // encounter flash overlay
  if (encounterFlash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${encounterFlash/8*0.8})`;
    ctx.fillRect(0, 0, 480, 320);
    encounterFlash--;
    if (encounterFlash === 0) {
      state = 'battle'; battleSubState = 'selectAction'; battleCursor = 0;
      battleMsg_(`A wild ${DEFS[battleData.enemy.id].name} appeared!`, null, 2000);
    }
  }

  // HUD
  if (party.length > 0 && state !== 'dialog') {
    const mon = party[0];
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; rr(ctx, 6, 6, 130, 32, 5); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.font = '10px "Courier New"';
    ctx.fillText(`${DEFS[mon.id].name} Lv.${mon.lv}`, 12, 19);
    drawHPBar(ctx, 12, 24, 118, 6, mon.hp, mon.maxHp);
  }
}

function renderBattleIntro() {
  renderBattle();
}

function renderBattle() {
  if (!battleData) return;
  const { enemy, playerMon } = battleData;

  // background
  const bg = ctx.createLinearGradient(0, 0, 0, 160);
  bg.addColorStop(0, '#1a1a2e'); bg.addColorStop(1, '#2a2a4e');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 480, 160);

  // platforms
  ctx.fillStyle = '#3a3a5e';
  ctx.beginPath(); ctx.ellipse(340, 140, 60, 14, 0, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(120, 130, 50, 12, 0, 0, Math.PI*2); ctx.fill();

  // enemy sprite
  const ef = flashTimer > 0 && flashTarget === 'enemy' && Math.floor(flashTimer/2)%2===0;
  if (!ef) {
    ctx.save();
    drawSprite(ctx, enemy.id, 340, 82, 96);
    ctx.restore();
  }

  // player sprite
  const pf = flashTimer > 0 && flashTarget === 'player' && Math.floor(flashTimer/2)%2===0;
  if (!pf) {
    ctx.save();
    drawSprite(ctx, playerMon.id, 110, 112, 80);
    ctx.restore();
  }
  if (flashTimer > 0) flashTimer--;

  // enemy info box
  ctx.fillStyle = 'rgba(0,0,0,0.7)'; rr(ctx, 8, 8, 180, 46, 6); ctx.fill();
  ctx.font = 'bold 11px "Courier New"'; ctx.fillStyle = '#fff';
  ctx.fillText(`${DEFS[enemy.id].name}`, 14, 22);
  ctx.font = '10px "Courier New"'; ctx.fillStyle = '#aaa';
  ctx.fillText(`Lv.${enemy.lv}  [${DEFS[enemy.id].types[0]}]`, 14, 34);
  drawHPBar(ctx, 14, 40, 168, 7, enemy.hp, enemy.maxHp);

  // player info box
  ctx.fillStyle = 'rgba(0,0,0,0.7)'; rr(ctx, 260, 90, 212, 60, 6); ctx.fill();
  ctx.font = 'bold 11px "Courier New"'; ctx.fillStyle = '#fff';
  ctx.fillText(`${DEFS[playerMon.id].name}`, 266, 104);
  ctx.font = '10px "Courier New"'; ctx.fillStyle = '#aaa';
  ctx.fillText(`Lv.${playerMon.lv}`, 266, 116);
  drawHPBar(ctx, 266, 122, 200, 7, playerMon.hp, playerMon.maxHp);
  // XP bar
  ctx.fillStyle = '#333'; ctx.fillRect(266, 136, 200, 4);
  const xpFrac = Math.min(1, playerMon.xp / playerMon.xpNeeded);
  ctx.fillStyle = '#4488FF'; ctx.fillRect(266, 136, 200 * xpFrac, 4);
  ctx.font = '9px "Courier New"'; ctx.fillStyle = '#88AAFF';
  ctx.fillText(`XP ${playerMon.xp}/${playerMon.xpNeeded}`, 266, 148);

  // bottom panel
  ctx.fillStyle = '#F0EEE8'; ctx.fillRect(0, 160, 480, 160);
  ctx.strokeStyle = '#999'; ctx.lineWidth = 2; ctx.strokeRect(0, 160, 480, 160);
  ctx.fillStyle = '#666'; ctx.fillRect(0, 160, 480, 2);

  if (battleMsg) {
    // show message
    ctx.font = '13px "Courier New"'; ctx.fillStyle = '#222';
    const words = battleMsg.split(' ');
    let line = '', y = 195;
    for (const w of words) {
      const test = line + w + ' ';
      if (ctx.measureText(test).width > 440 && line) { ctx.fillText(line, 20, y); line = w + ' '; y += 18; }
      else line = test;
    }
    ctx.fillText(line, 20, y);
    ctx.font = '10px "Courier New"'; ctx.fillStyle = '#999';
    ctx.fillText('▼', 456, 300);
  } else if (battleSubState === 'selectAction') {
    ctx.font = '13px "Courier New"'; ctx.fillStyle = '#222';
    ctx.fillText(`What will ${DEFS[playerMon.id].name} do?`, 20, 190);
    // FIGHT button
    ctx.fillStyle = battleCursor === 0 ? '#FFCC44' : '#DDD';
    rr(ctx, 20, 202, 200, 40, 8); ctx.fill();
    ctx.strokeStyle = battleCursor === 0 ? '#AA6600' : '#BBB'; ctx.lineWidth = 2;
    rr(ctx, 20, 202, 200, 40, 8); ctx.stroke();
    ctx.font = 'bold 16px "Courier New"'; ctx.fillStyle = '#222';
    ctx.fillText('⚔ FIGHT', 20 + 100 - ctx.measureText('⚔ FIGHT').width/2, 228);
    // RUN button
    ctx.fillStyle = battleCursor === 1 ? '#FFCC44' : '#DDD';
    rr(ctx, 260, 202, 200, 40, 8); ctx.fill();
    ctx.strokeStyle = battleCursor === 1 ? '#AA6600' : '#BBB';
    rr(ctx, 260, 202, 200, 40, 8); ctx.stroke();
    ctx.font = 'bold 16px "Courier New"'; ctx.fillStyle = '#222';
    ctx.fillText('🏃 RUN', 260 + 100 - ctx.measureText('🏃 RUN').width/2, 228);
    ctx.font = '10px "Courier New"'; ctx.fillStyle = '#888';
    ctx.fillText('← → to choose, Enter to confirm', 480/2 - ctx.measureText('← → to choose, Enter to confirm').width/2, 296);
  } else if (battleSubState === 'selectMove') {
    ctx.font = '12px "Courier New"'; ctx.fillStyle = '#444';
    ctx.fillText('Choose a move:', 20, 186);
    playerMon.moves.forEach((mv, i) => {
      const m = MOVES[mv.id];
      const bx = i % 2 === 0 ? 10 : 250;
      const by = 194 + Math.floor(i / 2) * 46;
      const sel = battleCursor === i;
      ctx.fillStyle = sel ? TYPE_COLOR[m.type] + '88' : '#E0E0E0';
      rr(ctx, bx, by, 220, 38, 6); ctx.fill();
      ctx.strokeStyle = sel ? TYPE_COLOR[m.type] : '#CCC'; ctx.lineWidth = 1.5;
      rr(ctx, bx, by, 220, 38, 6); ctx.stroke();
      ctx.font = 'bold 11px "Courier New"'; ctx.fillStyle = '#222';
      ctx.fillText(m.name, bx + 8, by + 15);
      ctx.font = '10px "Courier New"'; ctx.fillStyle = TYPE_COLOR[m.type];
      ctx.fillText('['+m.type+']', bx + 8, by + 28);
      ctx.fillStyle = mv.pp <= 0 ? '#c00' : '#555';
      ctx.fillText(`PP ${mv.pp}/${m.pp}`, bx + 140, by + 28);
    });
    ctx.font = '10px "Courier New"'; ctx.fillStyle = '#888';
    ctx.fillText('Esc to go back', 480/2 - ctx.measureText('Esc to go back').width/2, 296);
  }
}

function drawHPBar(ctx, x, y, w, h, hp, maxHp) {
  const frac = Math.max(0, hp / maxHp);
  ctx.fillStyle = '#333'; ctx.fillRect(x, y, w, h);
  const color = frac > 0.5 ? '#44DD44' : frac > 0.25 ? '#FFCC00' : '#FF4422';
  ctx.fillStyle = color; ctx.fillRect(x, y, Math.floor(w * frac), h);
  ctx.strokeStyle = '#555'; ctx.lineWidth = 0.5; ctx.strokeRect(x, y, w, h);
  ctx.font = '9px "Courier New"'; ctx.fillStyle = '#ccc';
  ctx.fillText(`${hp}/${maxHp}`, x + w + 4, y + h);
}

function renderDialog() {
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 220, 480, 100);
  ctx.fillStyle = '#F5F0E0'; rr(ctx, 10, 228, 460, 84, 8); ctx.fill();
  ctx.strokeStyle = '#888'; ctx.lineWidth = 2; rr(ctx, 10, 228, 460, 84, 8); ctx.stroke();
  const line = dialogLines[dialogIdx] || '';
  ctx.font = '13px "Courier New"'; ctx.fillStyle = '#222';
  const words = line.split(' ');
  let l = '', y = 252;
  for (const w of words) {
    const t = l + w + ' ';
    if (ctx.measureText(t).width > 430 && l) { ctx.fillText(l, 22, y); l = w + ' '; y += 20; }
    else l = t;
  }
  ctx.fillText(l, 22, y);
  if (Math.floor(animTick / 20) % 2 === 0) {
    ctx.fillStyle = '#888'; ctx.fillText('▼', 454, 300);
  }
}

function renderLevelup() {
  if (!levelupData) return;
  const { mon } = levelupData;
  renderOverworld();
  ctx.fillStyle = 'rgba(0,0,20,0.7)'; ctx.fillRect(0, 0, 480, 320);
  ctx.font = 'bold 20px "Courier New"';
  const grd = ctx.createLinearGradient(0, 100, 0, 200);
  grd.addColorStop(0,'#FFD700'); grd.addColorStop(1,'#FF8800');
  ctx.fillStyle = grd;
  ctx.fillText(`${DEFS[mon.id].name} grew to Lv.${mon.lv}!`, 240 - ctx.measureText(`${DEFS[mon.id].name} grew to Lv.${mon.lv}!`).width/2, 150);
  drawSprite(ctx, mon.id, 240, 220, 80);
  if (Math.floor(animTick / 25) % 2 === 0) {
    ctx.font = '12px "Courier New"'; ctx.fillStyle = '#aaa';
    ctx.fillText('Press Enter to continue', 165, 295);
  }
}

function renderEvolve() {
  if (!evolveData) return;
  const { mon, newId } = evolveData;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 480, 320);
  const flash = Math.floor(animTick / 4) % 2 === 0;
  if (flash) {
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(0, 0, 480, 320);
  }
  ctx.font = 'bold 18px "Courier New"'; ctx.fillStyle = '#FFD700';
  ctx.fillText(`${DEFS[mon.id].name} is evolving!`, 240 - ctx.measureText(`${DEFS[mon.id].name} is evolving!`).width/2, 60);
  // show both sprites
  ctx.globalAlpha = 0.5 + 0.5 * Math.sin(animTick * 0.08);
  drawSprite(ctx, mon.id, 240, 160, 100);
  ctx.globalAlpha = 1 - (0.5 + 0.5 * Math.sin(animTick * 0.08));
  drawSprite(ctx, newId, 240, 160, 100);
  ctx.globalAlpha = 1;
  if (Math.floor(animTick / 30) % 2 === 0) {
    ctx.font = '12px "Courier New"'; ctx.fillStyle = '#aaa';
    ctx.fillText('Press Enter to complete evolution', 138, 300);
  }
}

function renderGameover() {
  ctx.fillStyle = '#0a0005'; ctx.fillRect(0, 0, 480, 320);
  ctx.font = 'bold 36px "Courier New"'; ctx.fillStyle = '#CC2222';
  ctx.fillText('BLACKED OUT!', 240 - ctx.measureText('BLACKED OUT!').width/2, 130);
  ctx.font = '14px "Courier New"'; ctx.fillStyle = '#888';
  ctx.fillText('Your team has been healed.', 240 - ctx.measureText('Your team has been healed.').width/2, 166);
  if (gameoverTimer <= 0) {
    ctx.font = '12px "Courier New"'; ctx.fillStyle = '#aaa';
    ctx.fillText('Press Enter to continue', 165, 210);
  }
}

// ===================== MAIN LOOP =====================
function update() {
  Object.keys(pressed).forEach(k => { if (!keys[k]) delete pressed[k]; });

  if (state === 'title') {
    if (tap('Enter') || tap('Space')) {
      SFX.confirm();
      if (!loadSave()) {
        state = 'starter'; starterIdx = 0;
      } else {
        state = 'overworld';
      }
    }
  } else if (state === 'starter') {
    if (tap('ArrowLeft') || tap('KeyA'))  { starterIdx = (starterIdx + 2) % 3; SFX.cursor(); }
    if (tap('ArrowRight') || tap('KeyD')) { starterIdx = (starterIdx + 1) % 3; SFX.cursor(); }
    if (tap('Enter') || tap('Space')) {
      SFX.confirm();
      const ids = [1, 2, 3];
      party = [makeMon(ids[starterIdx], 5)];
      state = 'overworld';
      doSave();
    }
  } else if (state === 'overworld') {
    updateOverworld();
    if (tap('Enter') || tap('Space')) {
      showDialog([`HP: ${party[0].hp}/${party[0].maxHp}  Lv: ${party[0].lv}  XP: ${party[0].xp}/${party[0].xpNeeded}`, 'Walk in tall grass (dark green) to find wild PixelMon!'], () => { state = 'overworld'; });
    }
  } else if (state === 'battleIntro') {
    if (encounterFlash <= 0) {
      state = 'battle'; battleSubState = 'selectAction'; battleCursor = 0;
    }
  } else if (state === 'battle') {
    updateBattle();
  } else if (state === 'dialog') {
    if (tap('Enter') || tap('Space') || tap('ArrowDown') || tap('KeyS')) {
      dialogIdx++;
      if (dialogIdx >= dialogLines.length) {
        const cb = dialogCb; dialogCb = null;
        if (cb) cb();
        else state = 'overworld';
      }
    }
  } else if (state === 'levelup') {
    if (tap('Enter') || tap('Space')) {
      const { mon, cb } = levelupData; levelupData = null;
      state = 'battle';
      checkEvolve(mon, cb);
    }
  } else if (state === 'evolve') {
    if (tap('Enter') || tap('Space')) {
      const { mon, newId, cb } = evolveData; evolveData = null;
      SFX.evolve();
      const oldName = DEFS[mon.id].name;
      mon.id = newId;
      mon.maxHp = calcMaxHP(newId, mon.lv);
      mon.hp = Math.min(mon.hp, mon.maxHp);
      mon.moves = DEFS[newId].moves.map(m => ({id: m, pp: MOVES[m].pp}));
      state = 'battle';
      battleMsg_(`${oldName} evolved into ${DEFS[newId].name}!`, cb, 2500);
    }
  } else if (state === 'gameover') {
    gameoverTimer -= 1;
    if (gameoverTimer <= 0 && (tap('Enter') || tap('Space'))) {
      player.tx = 14; player.ty = 21;
      player.px = player.tx * TS; player.py = player.ty * TS;
      state = 'overworld';
      doSave();
    }
  }

  // clear used pressed keys
  for (const k in pressed) if (pressed[k] === false) delete pressed[k];
}

function loop() {
  update();
  render();
  requestAnimationFrame(loop);
}

// kick off
loop();

})();
