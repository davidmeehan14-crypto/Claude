// Choreography for Soft Crash. Everything is placed on the 115 BPM bar grid measured from the track.
// B(bar, beat) -> seconds. Lyric cue times were estimated from the audio (section/phrase analysis), edit here to nudge.
window.TL = (() => {
const BPM = 115, BEAT = 60 / BPM, BAR = 4 * BEAT, T0 = 0.042, DUR = 202.72;
const B = (bar, beat = 0) => T0 + bar * BAR + beat * BEAT;
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const eio = t => (t = clamp(t), t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const eo = t => 1 - Math.pow(1 - clamp(t), 3);
const pulse = (t, at, a = .04, d = .6) => t < at - a ? 0 : t < at ? (t - at + a) / a : Math.exp(-(t - at) / d * 3);

// ---------------- lyric cues ----------------
const LY = [];
const add = (t, end, text, style, extra = {}) => LY.push({ t, end, text, style, ...extra });
// verse 1: two bars per line
const v1 = ['silver static on my tongue', 'something’s shifting, coming undone', 'all the colours start to run', 'into one, into one'];
v1.forEach((s, i) => add(B(8 + 2 * i) - .12, B(10 + 2 * i) - .2, s, 'verse', { fx: ['silver', 'undone', 'run', 'one'][i] }));
add(B(16) - .12, B(18) - .2, 'i can hear the distant hum', 'hum');
add(B(18) - .12, B(20) - .25, 'i can hear the distant hum', 'hum', { alt: 1 });
const walk = ['i’ve been walking', 'through that glow', 'where the lost things', 'tend to go'];
function walking(bar0) {
  for (let k = 0; k < 8; k++) {
    const pair = Math.floor(k / 2), second = k % 2;
    add(B(bar0 + k) - .1, B(bar0 + pair * 2 + 2) - .18, walk[k % 4], 'walk', { second, pair });
  }
}
walking(20);
function chorus(bar0, pal, echo = false) {
  const st = echo ? 'echo' : 'chorus';
  add(B(bar0) - .05, B(bar0 + 1) - .1, 'soft crash', st, { fx: 'crash', pal });
  add(B(bar0, 2) - .15, B(bar0 + 1) - .1, 'in my memory', st, { fx: 'sub', pal });
  add(B(bar0 + 1) - .08, B(bar0 + 2) - .1, 'pull me', st, { fx: 'pull', pal });
  add(B(bar0 + 1, 2) - .15, B(bar0 + 2) - .1, 'to the mezzanine', st, { fx: 'rise', pal });
  add(B(bar0 + 2) - .08, B(bar0 + 2, 1.33) - .02, 'half-seen', st, { fx: 'half', pal });
  add(B(bar0 + 2, 1.33) - .06, B(bar0 + 2, 2.67) - .02, 'daydream', st, { fx: 'dream', pal });
  add(B(bar0 + 2, 2.67) - .06, B(bar0 + 3) - .06, 'quiet gleam', st, { fx: 'gleam', pal });
  add(B(bar0 + 3) - .05, B(bar0 + 4) - .12, 'soft crash', st, { fx: 'crash', pal });
  add(B(bar0 + 3, 2) - .15, B(bar0 + 4) + (echo ? .3 : -.12), 'in my memory', st, { fx: 'sub', pal });
}
chorus(28, 0); chorus(32, 0);
const v2 = ['are we drifting out of phase?', 'caught between the nights and days', 'i can’t read the shifting haze', 'in these strange familiar ways'];
v2.forEach((s, i) => add(B(38 + 2 * i) - .12, B(40 + 2 * i) - .2, s, 'phase', { idx: i }));
add(B(46) - .12, B(48) - .2, 'in the pulse where daylight stays', 'pulse');
add(B(48) - .12, B(50) - .25, 'in the pulse where daylight stays', 'pulse', { alt: 1 });
walking(50);
chorus(58, 1); chorus(62, 1);
const br = [['it’s weightless', 'to fall into', 'the lateness'], ['it’s shapeless', 'to breathe inside', 'the blankness']];
for (let s = 0; s < 4; s++) {
  const b0 = 67 + s * 2, lines = br[s % 2];
  lines.forEach((l, i) => add(B(b0, i * 2.67) - .1, B(b0 + 2) - .15 + (s === 3 && i === 2 ? 2.2 : 0), l, s % 2 ? 'shapeless' : 'weightless', { i, stanza: s }));
}
chorus(79, 2); chorus(83, 2);
chorus(87, 2, true); chorus(91, 2, true);

// chapter captions (small mono, top-left)
const CH = [[B(8), 'i. silver static'], [B(20), 'ii. through that glow'], [B(28), 'iii. the mezzanine'], [B(38), 'iv. out of phase'],
  [B(50), 'v. where the lost things go'], [B(58), 'vi. the mezzanine, later'], [B(67), 'vii. weightless'], [B(79), 'viii. soft crash']];

// ---------------- crash (shatter) events ----------------
const CR = [];
[28, 32, 58, 62, 79, 83].forEach(b => { CR.push([B(b), 1.0]); CR.push([B(b + 3), .6]); });
[87, 91].forEach(b => CR.push([B(b), .75]));
CR.push([B(38) , .5]);
function crashAt(t) {
  let v = 0, seed = 0;
  for (const [c, a] of CR) {
    const x = t - c; if (x < -0.001 || x > 3) continue;
    const e = (1 - Math.exp(-x * 14)) * Math.exp(-x * 1.5) * a;
    if (e > v) { v = e; seed = c; }
  }
  return { v, seed: (seed * 7.31) % 97 };
}

// ---------------- scenes ----------------
// scene ids: 1 haze, 2 plain, 3 mezzanine, 4 fall, 5 void
const P = () => [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];

function hazeP(t, o = {}) {
  const p = P();
  p[0] = [o.sx ?? .18, o.sy ?? -.02, o.sr ?? .075, o.hy ?? -.12];
  p[1] = [o.sparkle ?? 0, o.run ?? 0, o.one ?? 0, o.hum ?? 0];
  p[2] = [o.night ?? 0, o.pulse ?? 0, o.tree ?? 1, o.split ?? 0];
  p[3] = [o.fog ?? 1, o.drift ?? 1, o.ang ?? 0, o.expo ?? 1];
  return p;
}
function plainP(t, o = {}) {
  const p = P();
  p[0] = [o.camZ ?? t * 1.2, o.camH ?? .9, o.pitch ?? -.03, o.fov ?? 1.25];
  p[1] = [o.fig ?? 1, o.figD ?? 5.5, o.walk ?? 5.2, o.frames ?? 10];
  p[2] = [o.night ?? 0, o.sunEl ?? .05, o.glow ?? 1, o.roll ?? 0];
  p[3] = [o.ripple ?? 1, o.fogK ?? .035, o.wild ?? 0, o.expo ?? 1];
  return p;
}
function mezzP(t, o = {}) {
  const p = P();
  p[0] = [o.x ?? -1.5, o.y ?? 1.7, o.z ?? 0, o.yaw ?? .3];
  p[1] = [o.pitch ?? 0, o.pal ?? 0, o.dust ?? 1, o.fov ?? 1.05];
  p[2] = [o.rays ?? 1, o.fog ?? .05, o.sunEl ?? .3, o.roll ?? 0];
  p[3] = [0, o.sunYaw ?? .5, 0, o.expo ?? 1];
  return p;
}
function fallP(t, o = {}) {
  const p = P();
  p[0] = [o.speed ?? .12, o.late ?? 0, o.clouds ?? 1, o.fig ?? 1];
  p[1] = [o.figRot ?? t * .25, o.roll ?? t * .03, o.streaks ?? .8, o.stars ?? 0];
  p[2] = [o.fx ?? .05 * Math.sin(t * .4), o.fy ?? .03 * Math.cos(t * .3), o.fs ?? .17, 0];
  p[3] = [0, 0, 0, o.expo ?? 1];
  return p;
}
function voidP(t, o = {}) {
  const p = P();
  p[0] = [o.breath ?? 0, o.blobs ?? 1, o.line ?? 0, o.white ?? 1];
  p[1] = [o.sun ?? 0, 0, 0, 0];
  p[3] = [0, 0, 0, o.expo ?? 1];
  return p;
}

// mezzanine camera for one 4-bar chorus. v = variant (0 ground->mezzanine, 1 mezzanine->ceiling)
function mezzCam(lt, v, zBase) {
  const b = lt / BAR;
  if (v === 0) {
    const rise = eio((b - 1) / 1.1), onto = eio((b - 1.8) / 1.2);
    return {
      z: zBase + lt * 1.9, x: lerp(lerp(-2.2, .8, rise), 4.6, onto), y: lerp(1.7, 5.7, rise),
      yaw: lerp(.42, -.55, eio((b - 1.6) / 1.6)) + .03 * Math.sin(lt * .7), pitch: lerp(.02, -.12, rise) + lerp(0, .1, eio((b - 2.5) / 1.3)),
      roll: .025 * Math.sin(lt * .5) - .04 * Math.sin(Math.PI * clamp(b - 1)),
    };
  }
  const rise = eio((b - 1) / 1.2);
  return {
    z: zBase + lt * 1.5, x: lerp(5.4, lerp(1.2, -3.2, eio((b - 2) / 2)), rise), y: lerp(5.9, 7.3, rise) - .9 * eio((b - 2.6) / 1.4),
    yaw: lerp(-.45, .25, eio(b / 4)), pitch: lerp(-.08, -.36, rise) + .18 * eio((b - 2.6) / 1.4),
    roll: -.05 * Math.sin(lt * .4),
  };
}

// Section list: [start, end, scene, paramFn(lt, t), post(lt, t) , xin, xtype]
const S = [];
const sec = (start, end, scene, fn, post, xin = 0, xtype = 0) => S.push({ start, end, scene, fn, post, xin, xtype });

// 1. intro + verse 1 + hum (one continuous haze take)
sec(0, B(20), 1, (lt, t) => {
  const rise = eio(t / B(16));
  const run = t > B(12) - .5 && t < B(14) + .3 ? ss(B(12) - .5, B(13, 2), t) * (1 - ss(B(14) - .4, B(14) + .3, t)) : 0;
  const one = ss(B(14), B(14, 2), t) * (1 - ss(B(15, 3), B(16, 2), t)) * .8;
  return hazeP(t, {
    sx: .2 - .06 * rise, sy: lerp(-.1, .02, rise) + .02 * eo((t - B(16)) / BAR), sr: .07 + .012 * rise, hy: -.12,
    sparkle: ss(B(8) - 1, B(8), t) * (1 - ss(B(9, 3), B(10, 2), t)) * 1.0 + ss(0, 3, t) * (1 - ss(6, 14, t)) * .6,
    run, one, hum: ss(B(16) - .3, B(16, 1), t) * (1 - ss(B(19, 3), B(20), t)),
    fog: 1.05 - .2 * rise, drift: 1 + ss(B(16), B(20), t), expo: .25 + .75 * ss(1, 12, t),
  });
}, (lt, t) => ({
  static: (1 - ss(1.5, 11, t)) * .85 + pulse(t, B(8), .05, .5) * .25 + ss(B(12) - .5, B(13), t) * (1 - ss(B(14), B(14, 2), t)) * .05,
  fade: 1 - ss(0, 2.5, t), bars: 1, ca: .0025 + ss(B(12), B(13, 2), t) * (1 - ss(B(14), B(14, 2), t)) * .01,
  blur: (1 - ss(2, 13, t)) * .55, leak: ss(B(8), B(10), t) * .25, bloom: 0.096,
}));
// 2. walking 1 : mirror plain
sec(B(20), B(28), 2, (lt, t) => {
  const b = lt / BAR, build = ss(4, 8, b);
  return plainP(t, {
    camZ: lt * (1.1 + build * .6) + build * build * 4, camH: .85 + .25 * eio(b / 8), pitch: -.04 + .02 * Math.sin(lt * .3),
    fov: 1.25 - .15 * build, frames: 4 + Math.floor(ss(3, 5, b) * 14), figD: 5.4 - build * .6, walk: 5.35,
    sunEl: .05 + .03 * eio(b / 8), glow: .7 + build * .8, roll: .012 * Math.sin(lt * .4), wild: build * .4, expo: .95 + build * .25,
  });
}, (lt, t) => { const b = lt / BAR; return { bars: 1 - ss(6.5, 8, b) * .3, zoom: ss(5.5, 8, b) * .9, bloom: 0.096 + ss(4, 8, b) * .1, ca: .0025 + ss(6, 8, b) * .006 }; }, BAR * .75, 1);
// 3. chorus 1 : mezzanine golden hour
sec(B(28), B(36), 3, (lt, t) => {
  const v = lt < 4 * BAR ? 0 : 1, l2 = v ? lt - 4 * BAR : lt;
  const c = mezzCam(l2, v, v ? 40 : 0);
  return mezzP(t, { ...c, pal: 0, fog: .055, rays: 1.1, sunEl: .28 + .02 * Math.sin(t * .1), sunYaw: .55 });
}, (lt, t) => ({ bars: 1 - eo(lt / (BEAT * 1.5)), bloom: 0.120, ca: .003 }));
// 4. the drop : sustained note, then silence (white)
sec(B(36), B(37), 3, (lt, t) => {
  const c = mezzCam(4 * BAR + lt * .25, 1, 40);
  return mezzP(t, { ...c, pal: 0, fog: .07 + lt * .02, rays: 1.4, expo: 1 + lt * .4 });
}, (lt, t) => ({ bars: 0, white: ss(.2, BAR, lt), bloom: 0.180, blur: ss(0, BAR, lt) * .6 }));
sec(B(37), B(38), 5, (lt, t) => voidP(t, { breath: .5 + .5 * Math.sin(lt * 2), blobs: ss(.5, BAR, lt) * .6, white: 1.3 }),
  (lt, t) => ({ bars: ss(0, BAR, lt), white: 1 - ss(.2, BAR, lt) * .9, grain: .028 }));
// 5. verse 2 + pulse : day / night split haze
sec(B(38), B(50), 1, (lt, t) => {
  const b = lt / BAR;
  const pul = ss(8, 8.2, b);
  return hazeP(t, {
    sx: .12 + .05 * Math.sin(lt * .1), sy: .03 + .03 * eo(b / 8), sr: .078, hy: -.1,
    night: 0, split: ss(0, 1.5, b) * (1 - pul * .85), ang: -1.2 + lt * .045, pulse: pul * 1.2,
    fog: .95, drift: 1.4, tree: 1, expo: 1 + pul * .1,
  });
}, (lt, t) => { const b = lt / BAR; return { bars: 1, ghost: (b < 8 ? .45 + .35 * Math.sin(lt * 1.3) : .15) * ss(0, .5, b), white: 1 - ss(0, .6, lt), bloom: 0.102 + ss(8, 9, b) * .1, leak: .15 }; }, 0, 0);
// 6. walking 2 : night towards dawn
sec(B(50), B(58), 2, (lt, t) => {
  const b = lt / BAR, build = ss(4, 8, b);
  return plainP(t, {
    camZ: 40 + lt * (1.2 + build * .8) + build * build * 5, camH: 1.1 - .2 * eio(b / 8), pitch: -.02,
    fov: 1.2 - .15 * build, frames: 8 + Math.floor(build * 10), figD: 5 - build * .5, walk: 5.35,
    night: .75 - .45 * eio(b / 8), sunEl: .03 + .05 * eio(b / 8), glow: 1 + build, roll: -.015 * Math.sin(lt * .35), wild: .2 + build * .5, expo: 1.05 + build * .2,
  });
}, (lt, t) => { const b = lt / BAR; return { bars: 1 - ss(6.5, 8, b) * .3, zoom: ss(5.5, 8, b) * .9, bloom: 0.108 + ss(4, 8, b) * .12, ca: .003 + ss(6, 8, b) * .006, ghost: .15 * (1 - ss(0, 2, b)) }; }, BAR * .75, 3);
// 7. chorus 2 : mezzanine blue hour
sec(B(58), B(66), 3, (lt, t) => {
  const v = lt < 4 * BAR ? 1 : 0, l2 = lt < 4 * BAR ? lt : lt - 4 * BAR;
  const c = mezzCam(l2, v, v ? 80 : 120);
  return mezzP(t, { ...c, pal: 1, fog: .06, rays: 1.25, sunEl: .2, sunYaw: .35 });
}, (lt, t) => ({ bars: 1 - eo(lt / (BEAT * 1.5)), bloom: 0.132, ca: .0035, tint: [.97, .98, 1.05] }));
// 8. bar 66 breath -> bridge
sec(B(66), B(67), 3, (lt, t) => {
  const c = mezzCam(4 * BAR + lt * .3, 0, 120);
  return mezzP(t, { ...c, pal: 1, fog: .08, rays: 1.5, sunEl: .2, sunYaw: .35, expo: 1 - lt * .25 });
}, (lt, t) => ({ bars: ss(0, BAR, lt) * .5, blur: ss(0, BAR, lt) * .5, bloom: 0.180 }));
// 9. bridge : fall / void / fall / void
const fallSec = (s) => sec(B(67 + s * 2), B(69 + s * 2), 4, (lt, t) => fallP(t, {
  speed: .1 + s * .03, late: s === 0 ? .15 + lt * .03 : .55 + lt * .04, clouds: 1, stars: s === 0 ? .2 : 1, streaks: .7 + s * .2,
  fs: .15 + lt * .004, figRot: t * .22 + s, expo: 1,
}), (lt, t) => ({ bars: .5, bloom: 0.132, ca: .004, leak: .08 }), s === 0 ? BAR * .9 : .9, s === 0 ? 2 : 2);
const voidSec = (s) => sec(B(67 + s * 2), B(69 + s * 2), 5, (lt, t) => voidP(t, {
  breath: Math.sin(lt / (4 * BEAT) * Math.PI * 2 - 1.5), blobs: 1, white: s === 1 ? 1.25 : 1.3, line: 0,
}), (lt, t) => ({ bars: .5, bloom: 0.060, grain: .026, vig: .15, textGlow: .15 }), .9, 1);
fallSec(0); voidSec(1); fallSec(2); voidSec(3);
// 10. rebirth : horizon line draws, the sun returns, then the dark before the last crash
sec(B(75), B(79), 5, (lt, t) => {
  const b = lt / BAR;
  return voidP(t, { breath: Math.sin(lt / (4 * BEAT) * Math.PI * 2 - 1.5) * (1 - ss(2, 3.2, b)), blobs: 1 - ss(1, 3, b), line: eio(b / 2.6) * 1.1, sun: ss(1.2, 2.8, b) * .045, white: 1.3 * (1 - ss(2.9, 3.9, b) * .96) });
}, (lt, t) => { const b = lt / BAR; return { bars: .5 + ss(2.8, 3.8, b) * .5, bloom: 0.060 + ss(1, 3, b) * .25, grain: .028, vig: .15 + ss(3, 4, b) * .5, textGlow: .15 }; }, 0, 0);
// 11. chorus 3 : golden, everything
sec(B(79), B(86), 3, (lt, t) => {
  const v = lt < 4 * BAR ? 0 : 1, l2 = lt < 4 * BAR ? lt : lt - 4 * BAR;
  const c = mezzCam(l2, v, v ? 200 : 160);
  return mezzP(t, { ...c, pal: 2, fog: .06, rays: 1.35, sunEl: .24, sunYaw: .6 });
}, (lt, t) => ({ bars: 1 - eo(lt / (BEAT * 1.5)), bloom: 0.144, ca: .0035, leak: .12 }));
sec(B(86), B(87), 3, (lt, t) => {
  const c = mezzCam(3 * BAR + lt * .35, 1, 200);
  return mezzP(t, { ...c, pal: 2, fog: .075, rays: 1.6, sunEl: .24, sunYaw: .6, expo: 1 + lt * .15 });
}, (lt, t) => ({ bars: 0, bloom: 0.192, blur: ss(0, BAR, lt) * .4, white: ss(BAR * .6, BAR, lt) * .5 }));
// 12. reprise : all the lost things rush into the glow
sec(B(87), B(94), 2, (lt, t) => {
  const b = lt / BAR;
  return plainP(t, {
    camZ: 300 + lt * 3.2, camH: 1.4 + 1.2 * eio(b / 7), pitch: -.08 + .08 * eio(b / 7), fov: 1.05,
    frames: 18, fig: 1 - ss(5, 7, b), figD: 6 + b * .9, walk: 5.35, sunEl: .07 + .03 * eio(b / 7), glow: 1.8, wild: 1, roll: .03 * Math.sin(lt * .3), expo: .95, fogK: .022,
  });
}, (lt, t) => ({ bars: ss(5, 7, lt / BAR) * .5, bloom: 0.156, zoom: .35, ca: .004, white: 1 - ss(0, .5, lt) * 1 + 0, leak: .15 }), 0, 0);
// 13. outro : the cover, sun in fog
sec(B(94), DUR + 1, 1, (lt, t) => hazeP(t, {
  sx: 0, sy: -.02 - lt * .004, sr: .078, hy: -.12, fog: 1.1, drift: .6, expo: 1 - ss(4.5, 6.2, lt) * .2,
}), (lt, t) => ({ bars: 1, fade: ss(DUR - 1.6, DUR - .1, t), bloom: 0.108, blur: .1 + ss(3, 6, lt) * .2, static: ss(4.8, 6.3, lt) * .15 }), 1.1, 1);

const POST0 = { ca: .0025, grain: .032, vig: .35, bars: 1, fade: 0, white: 0, static: 0, blur: 0, leak: 0, expo: 1, zoom: 0, ghost: 0, bloom: 0.060, half: 0, gleam: -1, dream: 0, textGlow: 1, tint: [1, 1, 1], textGlowCol: [1, .72, .55], shake: [0, 0], shard: 1.8 };

function frameState(t, F) {
  let i = S.findIndex(s => t >= s.start && t < s.end); if (i < 0) i = t < 0 ? 0 : S.length - 1;
  const s = S[i], lt = t - s.start;
  const st = { A: null, B: { scene: s.scene, P: s.fn(lt, t), t }, mix: 1, xtype: s.xtype };
  const post = Object.assign({}, POST0, s.post(lt, t));
  if (s.xin > 0 && lt < s.xin && i > 0) {
    const p = S[i - 1];
    st.A = { scene: p.scene, P: p.fn(t - p.start, t), t };
    st.mix = eio(lt / s.xin);
    const pp = p.post(t - p.start, t);
    for (const k of ['bars', 'bloom', 'ca', 'zoom', 'ghost', 'leak', 'grain', 'vig']) if (k in pp || k in post) post[k] = lerp(pp[k] ?? POST0[k], post[k] ?? POST0[k], st.mix);
  }
  // global audio reactivity
  const k = F.kick, inChorus = s.scene === 3;
  post.expo *= 1 + k * (inChorus ? .09 : .04);
  post.ca += k * (inChorus ? .003 : .001);
  const cr = crashAt(t); post.crash = cr.v; post.seed = cr.seed;
  if (cr.v > 0) post.shake = [Math.sin(t * 91) * .002 * cr.v, Math.cos(t * 77) * .002 * cr.v];
  // chorus word effects
  for (const c of LY) {
    if (c.style !== 'chorus' && c.style !== 'echo') continue;
    if (t < c.t - .1 || t > c.end + .3) continue;
    const x = (t - c.t) / (c.end - c.t);
    if (c.fx === 'half') post.half = Math.max(post.half, ss(0, .15, x) * (1 - ss(.85, 1.1, x)) * .9);
    if (c.fx === 'dream') post.dream = Math.max(post.dream, Math.sin(Math.PI * clamp(x)) * .9);
    if (c.fx === 'gleam') post.gleam = clamp(x * 1.1);
  }
  return { ...st, post, sec: i };
}
return { B, BAR, BEAT, DUR, LY, CH, S, frameState, clamp, lerp, ss, eio, eo };
})();
