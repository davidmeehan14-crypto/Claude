/*
 * <paper-comet> — the Paper Comet AI bot: a folded-paper comet with a glowing screen face,
 * an antenna light and ribbon tails, in real-time 3D.
 *
 * Requires three.js (npm i three, or an import map that resolves "three" and "three/addons/").
 *
 *   <script type="module" src="paper-comet.js"></script>
 *   <paper-comet mood="idle" follow-pointer rotatable style="width:200px"></paper-comet>
 *
 *   const comet = document.querySelector('paper-comet');
 *   comet.mood = 'thinking';        // lasting mood: face, body position, antenna light
 *   comet.react('happy', 1500);     // temporary mood, then back to the previous one
 *   comet.play('loop');             // one-shot move layered on top of the mood
 *
 * Moods: idle smile happy wink excited thinking talking laughing confused cool
 *        sleepy determined starstruck surprised sad launch
 * Plays: loop spin flip swoop dash jump wiggle nod
 *
 * Attributes: mood, follow-pointer (eyes and head follow the cursor), rotatable (drag to spin it in 3D).
 * The canvas is transparent. Rendering pauses off screen. Respects prefers-reduced-motion.
 */
import * as THREE from 'three';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// pulse: antenna light rhythm (0 = dim, 1 = calm breathing, higher = busier) · ring: processing ring orbits the head
const MOODS = {
  idle:       { face: 'eyes',      pose: 'cruise', pulse: 1 },
  smile:      { face: 'smile',     pose: 'cruise', pulse: 1 },
  happy:      { face: 'happy',     pose: 'bounce', pulse: 2, dust: 2 },
  wink:       { face: 'wink',      pose: 'cruise', pulse: 1.5 },
  excited:    { face: 'excited',   pose: 'hop',    pulse: 3, dust: 2, fx: 'spark' },
  thinking:   { face: 'process',   pose: 'orbit',  pulse: 4, dust: 1.5, ring: true },
  talking:    { face: 'talk',      pose: 'cruise', pulse: 2.5 },
  laughing:   { face: 'laugh',     pose: 'shake',  pulse: 2.5, dust: 1.5 },
  confused:   { face: 'eyes',      pose: 'tilt',   pulse: 1.5, fx: 'question' },
  cool:       { face: 'cool',      pose: 'glide',  pulse: 0.8 },
  sleepy:     { face: 'sleep',     pose: 'doze',   pulse: 0.25, dust: 0, fx: 'zzz' },
  determined: { face: 'brows',     pose: 'charge', pulse: 3, dust: 2.5 },
  starstruck: { face: 'stars',     pose: 'bounce', pulse: 3, dust: 3 },
  surprised:  { face: 'surprised', pose: 'jolt',   pulse: 3, fx: 'spark' },
  sad:        { face: 'sad',       pose: 'droop',  pulse: 0.4, dust: 0 },
  launch:     { face: 'excited',   pose: 'rocket', pulse: 6, dust: 5, ring: true },
};

const PLAYS = { loop: 1.4, spin: 0.9, flip: 1.3, swoop: 1.2, dash: 0.8, jump: 0.9, wiggle: 0.8, nod: 0.9 };

const INK = '#1B2F5B';
const ACCENT = '#EE7452';
const GLOW = '#9ED2FF';

const v = (x, y, z) => new THREE.Vector3(x, y, z);
const smooth = u => u * u * (3 - 2 * u);
const TAU = Math.PI * 2;
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------- body positions
// Each returns the head's offset and orientation, plus how the tails behave.
//   pitch: nose up (+) / down (-) · yaw: turn · roll: around the flight axis
//   stiff: how tightly the tails hold their shape · droop: gravity on the tails · flap: flutter speed

const POSES = {
  cruise: t => ({ y: 0.07 * Math.sin(t * 1.8), pitch: 0.42 + 0.05 * Math.sin(t * 1.8 + 1), roll: 0.06 * Math.sin(t * 1.1), yaw: -0.12 + 0.1 * Math.sin(t * 0.6) }),
  glide:  t => ({ y: 0.05 * Math.sin(t * 1.2), x: 0.04 * Math.sin(t * 0.7), pitch: 0.2, roll: -0.18 + 0.05 * Math.sin(t * 1.2), yaw: -0.2, flap: 0.7 }),
  bounce: t => { const b = Math.abs(Math.sin(Math.PI * t / 0.9)); return { y: 0.24 * b - 0.03, pitch: 0.45 + 0.18 * b, roll: 0.05 * Math.sin(t * 3), flap: 1.4 }; },
  hop:    t => { const b = Math.abs(Math.sin(Math.PI * t / 0.55)); return { y: 0.18 * b, pitch: 0.5 + 0.2 * b, yaw: -0.1 * b, flap: 1.8 }; },
  orbit:  t => { const a = t * 2.4; return { x: 0.32 * Math.cos(a) - 0.1, y: 0.2 * Math.sin(a), pitch: 0.42 + 0.4 * Math.cos(a), roll: 0.12 * Math.sin(a), flap: 1.6, stiff: 0.9 }; },
  tilt:   t => ({ y: 0.04 * Math.sin(t * 1.6), pitch: 0.3, roll: -0.5 + 0.05 * Math.sin(t * 2.4), yaw: -0.35 }),
  shake:  t => ({ yaw: 0.14 * Math.sin(t * 17), roll: 0.1 * Math.sin(t * 17 + 1), y: 0.06 * Math.abs(Math.sin(t * 8.5)), pitch: 0.45, flap: 2 }),
  doze:   t => ({ y: -0.1 + 0.04 * Math.sin(t * 1.1), pitch: -0.25 + 0.04 * Math.sin(t * 1.1), roll: 0.12, yaw: -0.1, droop: 1, stiff: 0.35, flap: 0.3 }),
  droop:  t => ({ y: -0.2 + 0.02 * Math.sin(t * 1.4), pitch: -0.55, roll: 0.06, yaw: -0.15, droop: 0.8, stiff: 0.4, flap: 0.35 }),
  charge: t => ({ x: 0.06 * Math.sin(t * 6), y: 0.03 * Math.sin(t * 3), pitch: 0.12, yaw: -0.08, stiff: 1.6, flap: 2.6 }),
  rocket: t => ({ x: 0.015 * Math.sin(t * 41) - 0.45, y: 0.3 + 0.02 * Math.sin(t * 33), pitch: 1.42, roll: 0.25 * Math.sin(t * 2.2), yaw: -0.25, stiff: 1.8, flap: 3 }),
  jolt:   (t, tm) => { const u = Math.min(1, tm / 0.35); return { x: -0.14 * smooth(u), y: 0.14 * Math.sin(Math.PI * Math.min(1, tm / 0.5)) + 0.06, pitch: 0.75 * smooth(u) + 0.3, flap: 2 }; },
};

const PLAY_FNS = {
  loop:   u => { const a = TAU * smooth(u); return { x: 0.55 * Math.sin(a), y: 0.55 * (1 - Math.cos(a)), pitch: a, flap: 2.5 }; },
  spin:   u => ({ roll: TAU * smooth(u), y: 0.15 * Math.sin(Math.PI * u) }),
  flip:   u => ({ yaw: TAU * smooth(u), y: 0.1 * Math.sin(Math.PI * u) }),
  swoop:  u => ({ x: 0.5 * Math.sin(Math.PI * u), y: -0.45 * Math.sin(Math.PI * u), pitch: -1.1 * Math.sin(TAU * u), flap: 2.5 }),
  dash:   u => ({ x: 0.7 * Math.sin(Math.PI * u), y: 0.25 * Math.sin(Math.PI * u), flap: 3.5, stiff: 1.5 }),
  jump:   u => ({ y: 0.55 * Math.sin(Math.PI * u), pitch: 0.5 * Math.sin(TAU * u) }),
  wiggle: u => ({ yaw: 0.45 * Math.sin(u * 2 * TAU) * (1 - u), roll: 0.3 * Math.sin(u * 2 * TAU + 0.5) * (1 - u) }),
  nod:    u => ({ pitch: -0.4 * Math.abs(Math.sin(TAU * u)) }),
};

// ---------------------------------------------------------------- textures

function paperTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = `rgba(120,90,70,${Math.random() * 0.07})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 1.5, 1 + Math.random() * 1.5);
  }
  g.lineWidth = 0.6;
  for (let i = 0; i < 160; i++) {
    const x = Math.random() * 256, y = Math.random() * 256, a = Math.random() * TAU, l = 4 + Math.random() * 12;
    g.strokeStyle = `rgba(110,80,60,${0.04 + Math.random() * 0.05})`;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function glowTexture(inner = 'rgba(255,255,255,1)', mid = 'rgba(158,210,255,.55)') {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, inner); r.addColorStop(0.35, mid); r.addColorStop(1, 'rgba(158,210,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function textSprite(text, color, size) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.font = '800 104px system-ui, -apple-system, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = color; g.fillText(text, 64, 70);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.setScalar(size);
  return s;
}

function shadowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(27,47,91,.32)'); r.addColorStop(0.55, 'rgba(27,47,91,.12)'); r.addColorStop(1, 'rgba(27,47,91,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------------------------------------------------------------- head

const R = 0.5;

function buildHead(mat) {
  // A faceted paper ball, folded into two tones like the logo: lighter upper-back, deeper lower-front.
  const g = new THREE.IcosahedronGeometry(R, 2);
  const pos = g.attributes.position;
  const jitter = new Map();
  const key = (x, y, z) => `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
  for (let i = 0; i < pos.count; i++) {
    const k = key(pos.getX(i), pos.getY(i), pos.getZ(i));
    if (!jitter.has(k)) jitter.set(k, 1 + (Math.random() - 0.5) * 0.035);
    const s = jitter.get(k);
    pos.setXYZ(i, pos.getX(i) * s, pos.getY(i) * s, pos.getZ(i) * s);
  }
  const fold = v(0.75, -0.62, 0.22).normalize();
  const light = new THREE.Color('#F7A285'), deep = new THREE.Color('#DB5734'), crease = new THREE.Color('#E86E4C');
  const colors = [], a = v(0, 0, 0), b = v(0, 0, 0), c = v(0, 0, 0);
  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i); b.fromBufferAttribute(pos, i + 1); c.fromBufferAttribute(pos, i + 2);
    const d = a.clone().add(b).add(c).normalize().dot(fold);
    const col = d > 0.05 ? deep : d > -0.05 ? crease : light;
    const jit = 0.97 + Math.random() * 0.05;
    for (let k = 0; k < 3; k++) colors.push(col.r * jit, col.g * jit, col.b * jit);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, mat);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

// ---------------------------------------------------------------- tails

const SEG = 24;
const TAILS = [
  { anchor: v(-0.22, 0.24, 0.1),   dir: [0.2, 0.1],    len: 1.75, w: 0.14, root: '#F4E0CF', tip: '#F9EDE2', twist: 0.1,   ph: 0 },
  { anchor: v(-0.32, 0.04, 0.16),  dir: [0.03, 0.14],  len: 1.45, w: 0.15, root: '#F5A887', tip: '#F9CDB7', twist: -0.15, ph: 1.7 },
  { anchor: v(-0.24, -0.22, 0.08), dir: [-0.17, 0.08], len: 1.2,  w: 0.14, root: '#E8663F', tip: '#F2916F', twist: 0.2,   ph: 3.1 },
  { anchor: v(-0.26, 0.10, -0.18), dir: [0.06, -0.16], len: 1.4,  w: 0.13, root: '#EE7A58', tip: '#F6A78A', twist: 0.05,  ph: 4.4 },
  { anchor: v(-0.24, -0.06, -0.06), dir: [-0.05, -0.02], len: 0.95, w: 0.11, root: '#F08A6A', tip: '#F7B49B', twist: -0.1,  ph: 5.6 },
];

function buildTail(def, mat) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(SEG * 9), 3));
  const uv = [], col = [], idx = [];
  const c0 = new THREE.Color(def.root), c1 = new THREE.Color(def.tip);
  for (let i = 0; i < SEG; i++) {
    const s = i / (SEG - 1);
    const c = c0.clone().lerp(c1, s * s);
    for (let k = 0; k < 3; k++) { uv.push(s * def.len * 1.2, (k / 2) * def.w * 4); col.push(c.r, c.g, c.b); }
    if (i < SEG - 1) {
      const a = i * 3, b = a + 3;
      idx.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
    }
  }
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  const mesh = new THREE.Mesh(g, mat);
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  // fan direction: straight back, tilted up/down and toward/away from the viewer
  const dir = v(-1, 0, 0).applyAxisAngle(v(0, 0, 1), -def.dir[0]).applyAxisAngle(v(0, 1, 0), def.dir[1]).normalize();
  return { def, mesh, dir, pts: Array.from({ length: SEG }, () => v(0, 0, 0)), ready: false };
}

// ---------------------------------------------------------------- screen face
// A navy screen set into a paper bezel on the front of the head. Everything on it is light, so it glows.

const FACE_DIR = v(0.3, 0.08, 1).normalize();
const FACE_SIZE = 1.0;
const SCREEN = { w: 0.37, h: 0.25, r: 0.09, cy: 0.02 };   // half sizes
const EYE = { x: 0.16, y: 0.06, w: 0.05, h: 0.075 };   // half sizes
const BLINKS = new Set(['eyes', 'smile', 'wink', 'excited', 'talk', 'surprised', 'brows', 'sad', 'cool']);
const LIVE = new Set(['process', 'talk', 'sleep']);     // faces that animate on their own

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x - w + r, y + h);
  ctx.arcTo(x + w, y + h, x + w, y - h, r); ctx.arcTo(x + w, y - h, x - w, y - h, r);
  ctx.arcTo(x - w, y - h, x - w, y + h, r); ctx.arcTo(x - w, y + h, x + w, y + h, r);
  ctx.closePath();
}

function drawScreen(ctx, face, t, { lid = 1, glance = [0, 0] } = {}) {
  const W = ctx.canvas.width, k = W / FACE_SIZE;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, W);
  ctx.setTransform(k, 0, 0, -k, W / 2, W / 2);
  ctx.lineCap = ctx.lineJoin = 'round';
  const { w, h, r, cy } = SCREEN;

  // paper bezel, then the screen with a faint top sheen
  roundRect(ctx, 0, cy, w + 0.03, h + 0.03, r + 0.02); ctx.fillStyle = '#F7E6DA'; ctx.fill();
  roundRect(ctx, 0, cy, w, h, r);
  const sg = ctx.createLinearGradient(0, cy + h, 0, cy - h);
  sg.addColorStop(0, '#24406F'); sg.addColorStop(1, '#122142');
  ctx.fillStyle = sg; ctx.fill();
  ctx.save(); ctx.clip();
  const sheen = ctx.createLinearGradient(0, cy + h, 0, cy + h * 0.2);
  sheen.addColorStop(0, 'rgba(255,255,255,.14)'); sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen; ctx.fillRect(-w, cy, 2 * w, h);

  // light elements glow
  ctx.shadowColor = 'rgba(158,210,255,.95)'; ctx.shadowBlur = W * 0.04;
  ctx.fillStyle = ctx.strokeStyle = '#DDF1FF';
  ctx.lineWidth = 0.034;
  const [gx, gy] = glance;
  const L = [-EYE.x + gx, EYE.y + gy], Rr = [EYE.x + gx, EYE.y + gy];
  const mx = gx * 0.5, my = EYE.y - 0.15;

  const oval = ([x, y], sw = 1, sh = 1, tilt = 0) => {
    ctx.beginPath(); ctx.ellipse(x, y, EYE.w * sw, Math.max(0.006, EYE.h * sh * lid), tilt, 0, TAU); ctx.fill();
  };
  const eyes = (sw = 1, sh = 1) => { oval(L, sw, sh, -0.12); oval(Rr, sw, sh, 0.12); };
  const arc = ([x, y], up = true) => {
    ctx.lineWidth = 0.04; ctx.beginPath();
    ctx.moveTo(x - 0.06, y - 0.02 * (up ? 1 : -1)); ctx.quadraticCurveTo(x, y + 0.09 * (up ? 1 : -1), x + 0.06, y - 0.02 * (up ? 1 : -1)); ctx.stroke();
    ctx.lineWidth = 0.034;
  };
  const smile = (ww = 0.045, d = 0.035) => { ctx.beginPath(); ctx.moveTo(mx - ww, my); ctx.quadraticCurveTo(mx, my - d, mx + ww, my); ctx.stroke(); };
  const openMouth = (ww, hh) => { roundRect(ctx, mx, my - hh * 0.5, ww, hh, Math.min(ww, hh) * 0.6); ctx.fill(); };
  // eyes with a slanted top edge, cut back to the screen colour
  const slant = (sign, drop) => {
    ctx.save(); ctx.shadowBlur = 0; ctx.fillStyle = '#1A3160';
    for (const [[x, y], s] of [[L, sign], [Rr, -sign]]) {
      ctx.beginPath(); ctx.moveTo(x - 0.08, y + 0.1 + (s > 0 ? -drop : drop)); ctx.lineTo(x + 0.08, y + 0.1 + (s > 0 ? drop : -drop));
      ctx.lineTo(x + 0.08, y + 0.14); ctx.lineTo(x - 0.08, y + 0.14); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  };

  switch (face) {
    case 'eyes': eyes(); smile(0.03, 0.02); break;
    case 'smile': eyes(); smile(); break;
    case 'happy': arc(L); arc(Rr); smile(0.055, 0.05); break;
    case 'wink': oval(L, 1, 1, -0.12); arc(Rr); smile(); break;
    case 'sleep': {
      const dim = 0.45 + 0.1 * Math.sin(t * 1.3);
      ctx.globalAlpha = dim; ctx.lineWidth = 0.04;
      for (const [x, y] of [L, Rr]) { ctx.beginPath(); ctx.moveTo(x - 0.05, y); ctx.lineTo(x + 0.05, y); ctx.stroke(); }
      ctx.beginPath(); ctx.ellipse(mx, my, 0.014, 0.018, 0, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1; break;
    }
    case 'excited': eyes(1, 1.1); openMouth(0.055, 0.045); break;
    case 'talk': {
      eyes();
      // voice bars
      for (let i = -2; i <= 2; i++) {
        const hh = 0.012 + 0.03 * Math.abs(Math.sin(t * 11 + i * 1.3) * Math.sin(t * 3.7 + i));
        roundRect(ctx, mx + i * 0.03, my, 0.009, hh, 0.009); ctx.fill();
      }
      break;
    }
    case 'laugh':
      ctx.lineWidth = 0.04;
      for (const [[x, y], s] of [[L, 1], [Rr, -1]]) { ctx.beginPath(); ctx.moveTo(x - 0.05 * s, y + 0.055); ctx.lineTo(x + 0.045 * s, y); ctx.lineTo(x - 0.05 * s, y - 0.055); ctx.stroke(); }
      openMouth(0.065, 0.055); break;
    case 'surprised': eyes(1.35, 1.1); ctx.beginPath(); ctx.ellipse(mx, my - 0.01, 0.024, 0.03, 0, 0, TAU); ctx.fill(); break;
    case 'brows': eyes(1.05, 1); slant(1, 0.045); ctx.beginPath(); ctx.moveTo(mx - 0.035, my); ctx.lineTo(mx + 0.035, my); ctx.stroke(); break;
    case 'sad': eyes(0.95, 0.95); slant(-1, 0.04); ctx.beginPath(); ctx.moveTo(mx - 0.04, my - 0.02); ctx.quadraticCurveTo(mx, my + 0.015, mx + 0.04, my - 0.02); ctx.stroke(); break;
    case 'stars':
      for (const [x, y] of [L, Rr]) {
        ctx.beginPath();
        for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + Math.PI / 2, rr = i % 2 ? 0.028 : 0.085; ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
        ctx.closePath(); ctx.fill();
      }
      smile(0.05, 0.045); break;
    case 'cool':
      for (const [x, y] of [L, Rr]) { roundRect(ctx, x, y + 0.01, 0.06, 0.016, 0.016); ctx.fill(); }
      ctx.beginPath(); ctx.moveTo(mx - 0.02, my); ctx.quadraticCurveTo(mx + 0.03, my - 0.005, mx + 0.05, my + 0.025); ctx.stroke(); break;
    case 'process':
      // three lights cycling: the bot is working
      for (let i = -1; i <= 1; i++) {
        const b = 0.35 + 0.65 * Math.max(0, Math.sin(t * 5 - i * 1.1));
        ctx.globalAlpha = b; ctx.beginPath(); ctx.ellipse(i * 0.11 + gx * 0.5, 0.03 + gy * 0.5, 0.032 + 0.012 * b, 0.032 + 0.012 * b, 0, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1; break;
  }
  ctx.restore();
}

// ---------------------------------------------------------------- element

export class PaperComet extends HTMLElement {
  static observedAttributes = ['mood', 'size', 'follow-pointer'];
  static get moods() { return Object.keys(MOODS); }
  static get plays() { return Object.keys(PLAYS); }

  #r; #reactTimer; #restoreMood = null;
  #pointer = { x: 0, y: 0, active: false };
  #drag = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' }).innerHTML = `<style>
      :host { display: inline-block; position: relative; width: 200px; aspect-ratio: 1; line-height: 0; vertical-align: middle; }
      :host([hidden]) { display: none; }
      :host([rotatable]) { cursor: grab; touch-action: pan-y; }
      :host([rotatable].dragging) { cursor: grabbing; }
      canvas { width: 100%; height: 100%; display: block; }
    </style><canvas aria-hidden="true"></canvas>`;
  }

  connectedCallback() {
    if (!this.#r) this.#init();
    this.#apply(this.getAttribute('mood'));
    this.#r.io.observe(this);
    this.#r.ro.observe(this);
    this.#syncPointer();
    this.addEventListener('pointerdown', this.#onDown);
    this.addEventListener('click', this.#onClickCapture, true);
  }

  disconnectedCallback() {
    const r = this.#r;
    r.io.disconnect(); r.ro.disconnect();
    cancelAnimationFrame(r.raf); r.raf = 0;
    clearTimeout(this.#reactTimer);
    removeEventListener('pointermove', this.#onPointer);
    this.removeEventListener('pointerdown', this.#onDown);
    this.removeEventListener('click', this.#onClickCapture, true);
  }

  attributeChangedCallback(name, _old, value) {
    if (name === 'mood' && this.#r) this.#apply(value);
    if (name === 'size') this.style.width = /^\d+$/.test(value ?? '') ? `${value}px` : (value ?? '');
    if (name === 'follow-pointer' && this.isConnected) this.#syncPointer();
  }

  get mood() { return this.getAttribute('mood') || 'idle'; }
  set mood(m) { clearTimeout(this.#reactTimer); this.#restoreMood = null; this.setAttribute('mood', m); }

  /** Show a mood for `ms`, then return to the mood that was set before. */
  react(mood, ms = 1400) {
    clearTimeout(this.#reactTimer);
    this.#restoreMood ??= this.mood;
    this.setAttribute('mood', mood);
    return new Promise(res => {
      this.#reactTimer = setTimeout(() => {
        const back = this.#restoreMood; this.#restoreMood = null;
        this.setAttribute('mood', back); res();
      }, ms);
    });
  }

  /** One-shot move layered on top of the current mood. */
  play(name) {
    if (!PLAYS[name] || reducedMotion() || !this.#r) return Promise.resolve();
    return new Promise(res => { this.#r.plays.push({ name, t0: this.#r.clock.elapsedTime, res }); this.#wake(); });
  }

  /** Spin the whole comet to a view angle in radians. It eases back to its resting view after a moment. */
  rotateTo(yaw, pitch = 0, holdMs = 2500) {
    const r = this.#r; if (!r) return;
    Object.assign(r.viewRot, { ty: yaw, tx: pitch, vx: 0, vy: 0 });
    r.viewHold = r.clock.elapsedTime + holdMs / 1000;
    this.#wake();
  }

  // ------------------------------------------------------------ setup

  #init() {
    const canvas = this.shadowRoot.querySelector('canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;

    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    camera.position.set(0, 0.7, 7.4);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.HemisphereLight('#FFF6EE', '#A9CBEF', 1.25));
    const key = new THREE.DirectionalLight('#FFF4EA', 1.7);
    key.position.set(-2.2, 4.5, 3.5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 14 });
    key.shadow.bias = -0.0006; key.shadow.normalBias = 0.02;
    scene.add(key);
    const fill = new THREE.DirectionalLight('#FFD6C6', 0.6);
    fill.position.set(3, -1, 3);
    scene.add(fill);
    const rim = new THREE.DirectionalLight('#CFE3FF', 0.9);
    rim.position.set(1, 2, -4);
    scene.add(rim);

    const ENV = 0.45;
    const paper = paperTexture();
    const headMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.82, map: paper, bumpMap: paper, bumpScale: 0.6, envMapIntensity: ENV });
    const tailMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85, side: THREE.DoubleSide, map: paper, bumpMap: paper, bumpScale: 0.6, envMapIntensity: ENV });
    const creamMat = new THREE.MeshStandardMaterial({ color: '#F6E4D6', flatShading: true, roughness: 0.85, map: paper, envMapIntensity: ENV });

    // view: the whole comet, spun by dragging. head: moved and turned by body positions.
    const view = new THREE.Group();
    scene.add(view);
    const head = new THREE.Group();
    view.add(head);
    const headMesh = buildHead(headMat);
    head.add(headMesh);
    const tails = TAILS.map(def => buildTail(def, tailMat));
    for (const t of tails) view.add(t.mesh);

    // Screen face: a canvas projected onto the front of the head, lit from within
    const center = FACE_DIR.clone().multiplyScalar(R);
    const proj = new THREE.Object3D();
    proj.position.copy(center); proj.lookAt(center.clone().add(FACE_DIR)); proj.updateMatrixWorld();
    headMesh.updateMatrixWorld();
    const faceCanvas = document.createElement('canvas'); faceCanvas.width = faceCanvas.height = 512;
    const faceCtx = faceCanvas.getContext('2d');
    const faceTex = new THREE.CanvasTexture(faceCanvas);
    faceTex.colorSpace = THREE.SRGBColorSpace; faceTex.anisotropy = 4;
    const screen = new THREE.Mesh(
      new DecalGeometry(headMesh, center, proj.rotation, v(FACE_SIZE, FACE_SIZE, 0.7)),
      new THREE.MeshStandardMaterial({ map: faceTex, emissiveMap: faceTex, emissive: '#FFFFFF', emissiveIntensity: 0.85, transparent: true,
        roughness: 0.6, metalness: 0, envMapIntensity: 0.12, polygonOffset: true, polygonOffsetFactor: -4, depthWrite: false }));
    head.add(screen);

    // Antenna: a paper stalk with a light on top
    const antenna = new THREE.Group();
    const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.024, 0.2, 7), creamMat);
    stalk.position.y = 0.1; stalk.castShadow = true;
    const bulbMat = new THREE.MeshStandardMaterial({ color: '#CFE8FF', emissive: GLOW, emissiveIntensity: 1.2, roughness: 0.4, envMapIntensity: ENV });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), bulbMat);
    bulb.position.y = 0.22;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), transparent: true, depthWrite: false, opacity: 0.8 }));
    halo.position.y = 0.22; halo.scale.setScalar(0.32);
    antenna.add(stalk, bulb, halo);
    antenna.position.set(-0.1, R - 0.03, 0.04); antenna.rotation.z = 0.3;
    head.add(antenna);

    // Engine glow where the tails meet the head
    const engine = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,255,255,.95)', 'rgba(255,205,170,.5)'), transparent: true, depthWrite: false, opacity: 0.55 }));
    engine.position.set(-0.36, 0, 0); engine.scale.setScalar(0.5);
    head.add(engine);

    // Processing ring: a thin paper hoop that orbits the head while it works
    const ringPivot = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.016, 8, 56), creamMat);
    ring.rotation.x = 1.25; ring.castShadow = true;
    ringPivot.add(ring); ringPivot.scale.setScalar(0.001);
    view.add(ringPivot);

    // Effects that follow the head but stay upright
    const fxGroup = new THREE.Group();
    view.add(fxGroup);
    const accentMat = new THREE.MeshStandardMaterial({ color: ACCENT, roughness: 0.5, envMapIntensity: ENV });
    const spark = new THREE.Group();
    for (const [x, y, a] of [[0.05, 0.9, 0.25], [0.38, 0.82, -0.5], [0.62, 0.57, -1.1]]) {
      const c = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.15, 4, 10), accentMat);
      c.position.set(x, y, 0.2); c.rotation.z = a; spark.add(c);
    }
    const question = textSprite('?', ACCENT, 0.6); question.position.set(0.5, 0.95, 0.2);
    const zzz = new THREE.Group();
    for (let i = 0; i < 3; i++) zzz.add(textSprite('z', INK, 0.3));
    fxGroup.add(spark, question, zzz);

    // Stardust: paper flecks and light motes shed from the tails
    const dustGeo = new THREE.OctahedronGeometry(0.045, 0);
    const dustMats = [
      new THREE.MeshStandardMaterial({ color: '#FFF3E6', flatShading: true, roughness: 0.8, envMapIntensity: ENV }),
      new THREE.MeshStandardMaterial({ color: '#F6B194', flatShading: true, roughness: 0.8, envMapIntensity: ENV }),
      new THREE.MeshStandardMaterial({ color: '#D9EEFF', emissive: GLOW, emissiveIntensity: 0.7, flatShading: true, roughness: 0.6, envMapIntensity: ENV }),
    ];
    const dust = Array.from({ length: 22 }, (_, i) => {
      const m = new THREE.Mesh(dustGeo, dustMats[i % 3]);
      m.visible = false; view.add(m);
      return { m, life: 0, max: 1, vel: v(0, 0, 0), spin: v(0, 0, 0) };
    });

    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.0), new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.set(0, -1.35, 0);
    scene.add(shadow);

    const io = new IntersectionObserver(([e]) => { this.#r.visible = e.isIntersecting; this.#wake(); });
    const ro = new ResizeObserver(() => this.#resize());
    document.addEventListener('visibilitychange', () => this.#wake());

    this.#r = {
      renderer, scene, camera, view, head, tails, fxGroup, shadow, faceCtx, faceTex, bulbMat, halo, engine, ringPivot,
      fxMap: { spark, question, zzz }, dust, dustAcc: 0,
      clock: new THREE.Clock(), io, ro, raf: 0, visible: true, plays: [],
      pose: { x: 0, y: 0, yaw: 0, pitch: 0.42, roll: 0, stiff: 1, droop: 0, flap: 1 },
      look: { yaw: 0, pitch: 0 }, glance: [0, 0], viewRot: { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 }, viewHold: 0,
      mood: MOODS.idle, moodT0: 0, face: 'eyes', blinkAt: 2, blinkT: -9, faceKey: '', faceDrawnAt: 0, pop: -9,
    };
  }

  #resize() {
    const { renderer, camera } = this.#r;
    const w = this.clientWidth, h = this.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the whole comet in frame in tall, narrow boxes
    camera.fov = camera.aspect < 1 ? THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(15)) / camera.aspect)) : 30;
    camera.updateProjectionMatrix();
    this.#wake();
  }

  #apply(mood) {
    const r = this.#r;
    const m = MOODS[mood] ?? MOODS.idle;
    const now = r.clock.elapsedTime;
    r.mood = m; r.moodT0 = now; r.face = m.face;
    this.#drawFace(now, 1, true);
    for (const [k, g] of Object.entries(r.fxMap)) g.visible = k === m.fx;
    r.pop = now;
    this.#wake();
  }

  #drawFace(t, lid, force = false) {
    const r = this.#r;
    const key = `${r.face}|${lid.toFixed(2)}|${r.glance[0].toFixed(3)}|${r.glance[1].toFixed(3)}`;
    const live = LIVE.has(r.face) && t - r.faceDrawnAt > 1 / 30;
    if (!force && !live && key === r.faceKey) return;
    drawScreen(r.faceCtx, r.face, t, { lid, glance: r.glance });
    r.faceTex.needsUpdate = true;
    r.faceKey = key; r.faceDrawnAt = t;
  }

  // ------------------------------------------------------------ input

  #syncPointer() {
    removeEventListener('pointermove', this.#onPointer);
    if (this.hasAttribute('follow-pointer')) addEventListener('pointermove', this.#onPointer, { passive: true });
    else this.#pointer.active = false;
  }

  #onPointer = e => {
    const b = this.getBoundingClientRect();
    const dx = e.clientX - (b.left + b.width / 2), dy = e.clientY - (b.top + b.height / 2);
    const reach = Math.max(280, b.width * 1.6);
    this.#pointer = { x: Math.max(-1, Math.min(1, dx / reach)), y: Math.max(-1, Math.min(1, dy / reach)), active: true };
    this.#wake();
  };

  #onDown = e => {
    if (!this.hasAttribute('rotatable') || e.button > 0) return;
    const d = this.#drag = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false };
    const move = ev => {
      const dx = ev.clientX - d.lx, dy = ev.clientY - d.ly;
      d.lx = ev.clientX; d.ly = ev.clientY;
      if (!d.moved && Math.hypot(ev.clientX - d.x, ev.clientY - d.y) > 4) { d.moved = true; this.classList.add('dragging'); }
      if (!d.moved) return;
      const r = this.#r, k = 4.2 / Math.max(160, this.clientWidth), VR = r.viewRot;
      VR.y += dx * k; VR.x += dy * k;
      VR.vy = dx * k * 60; VR.vx = dy * k * 60;
      VR.ty = VR.tx = 0;
      r.viewHold = r.clock.elapsedTime + 2.2;
      this.#wake();
    };
    const up = () => {
      removeEventListener('pointermove', move); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
      this.classList.remove('dragging');
      d.done = true;
      if (!d.moved) this.#drag = null;
      else setTimeout(() => { if (this.#drag === d) this.#drag = null; }, 0);
      this.#wake();
    };
    addEventListener('pointermove', move); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  };

  // A drag that spun the comet should not also count as a click.
  #onClickCapture = e => { if (this.#drag?.moved) { e.stopImmediatePropagation(); e.preventDefault(); } };

  #wake() {
    const r = this.#r;
    if (!r || r.raf || !r.visible || document.hidden || !this.isConnected) return;
    r.raf = requestAnimationFrame(this.#frame);
  }

  // ------------------------------------------------------------ frame

  #frame = () => {
    const r = this.#r;
    r.raf = 0;
    const dt = Math.min(0.05, r.clock.getDelta());
    const now = r.clock.elapsedTime;
    const still = reducedMotion();
    const t = still ? 0 : now;

    // body position from mood + one-shot plays
    const target = { x: 0, y: 0, yaw: 0, pitch: 0, roll: 0, stiff: 1, droop: 0, flap: 1, ...(still ? { pitch: 0.42 } : POSES[r.mood.pose](t, now - r.moodT0)) };
    for (const p of [...r.plays]) {
      const u = (now - p.t0) / PLAYS[p.name];
      if (u >= 1) { r.plays.splice(r.plays.indexOf(p), 1); p.res(); continue; }
      const o = PLAY_FNS[p.name](u);
      for (const k in o) target[k] = k === 'flap' || k === 'stiff' ? Math.max(target[k], o[k]) : target[k] + o[k];
    }
    const playing = r.plays.length > 0;
    const k = 1 - Math.exp(-dt * (playing ? 26 : 9));
    const P = r.pose;
    for (const key of ['x', 'y', 'stiff', 'droop', 'flap']) P[key] += (target[key] - P[key]) * k;
    for (const key of ['yaw', 'pitch', 'roll']) P[key] += wrap(target[key] - P[key]) * k;

    // look toward the pointer: the head turns a little and the eyes glance further
    const pa = this.#pointer.active && !still;
    const lk = 1 - Math.exp(-dt * 5);
    r.look.yaw += ((pa ? this.#pointer.x * 0.45 : 0) - r.look.yaw) * lk;
    r.look.pitch += ((pa ? this.#pointer.y * 0.3 : 0) - r.look.pitch) * lk;
    r.glance[0] += ((pa ? this.#pointer.x * 0.05 : 0) - r.glance[0]) * lk;
    r.glance[1] += ((pa ? -this.#pointer.y * 0.035 : 0) - r.glance[1]) * lk;

    // whole-comet rotation: drag with inertia, or rotateTo(), easing back to rest
    const VR = r.viewRot, dragging = this.#drag?.moved && !this.#drag.done;
    if (!dragging) {
      VR.y += VR.vy * dt; VR.x += VR.vx * dt;
      VR.vy *= Math.exp(-dt * 3); VR.vx *= Math.exp(-dt * 3);
      const home = now > r.viewHold;
      const ty = home ? Math.round(VR.y / TAU) * TAU : (VR.ty || VR.y), tx = home ? 0 : (VR.tx || VR.x);
      const back = 1 - Math.exp(-dt * (home ? 2.2 : 4));
      VR.y += (ty - VR.y) * back; VR.x += (tx - VR.x) * back;
      VR.x = Math.max(-1.2, Math.min(1.2, VR.x));
    }
    r.view.rotation.set(VR.x, VR.y, 0, 'XYZ');

    // place the head (offset so the comet and its tails sit centred in the frame)
    const H = r.head;
    H.position.set(0.7 + P.x, 0.3 + P.y, 0);
    const qPose = new THREE.Quaternion().setFromEuler(new THREE.Euler(P.roll, P.yaw, P.pitch, 'YZX'));
    const qLook = new THREE.Quaternion().setFromEuler(new THREE.Euler(r.look.pitch, r.look.yaw, 0, 'YXZ'));
    H.quaternion.copy(qLook).multiply(qPose);
    const popU = Math.min(1, (now - r.pop) / 0.35);
    H.scale.setScalar(1 + 0.08 * Math.sin(Math.PI * popU) * (1 - popU));

    this.#updateTails(t, dt, still);
    this.#updateDust(dt, still);

    // shadow tracks the head
    r.scene.updateMatrixWorld();
    const hw = H.getWorldPosition(v(0, 0, 0));
    r.shadow.position.x = hw.x - 0.35;
    r.shadow.scale.setScalar(Math.max(0.55, 1 - (hw.y - 0.3) * 0.35));
    r.shadow.material.opacity = Math.min(1, Math.max(0.35, 1 - (hw.y - 0.3) * 0.5));

    // screen: blink, glance, live faces
    if (!still && BLINKS.has(r.face) && now > r.blinkAt) { r.blinkT = now; r.blinkAt = now + 2.2 + Math.random() * 4; }
    const bu = (now - r.blinkT) / 0.16;
    const lid = bu >= 0 && bu < 1 ? 1 - 0.92 * Math.sin(Math.PI * bu) : 1;
    this.#drawFace(t, BLINKS.has(r.face) ? lid : 1);

    // antenna light: breathes at the mood's pace, flashes when the mood changes
    const pulse = r.mood.pulse, flash = Math.max(0, 1 - popU) * 1.2;
    const breath = still ? 0.6 : (pulse < 0.5 ? 0.25 + 0.1 * Math.sin(t * 1.5) : 0.55 + 0.45 * Math.max(0, Math.sin(t * 1.6 * pulse)));
    r.bulbMat.emissiveIntensity = 0.5 + 1.6 * breath + flash;
    r.halo.material.opacity = Math.min(1, 0.25 + 0.6 * breath + flash);
    r.halo.scale.setScalar(0.22 + 0.2 * breath + 0.15 * flash);

    // engine glow follows how hard the tails are working
    const drive = Math.min(1, (P.flap - 0.3) / 2.5);
    r.engine.material.opacity = 0.2 + 0.55 * drive;
    r.engine.scale.setScalar(0.4 + 0.35 * drive + 0.03 * Math.sin(t * 20));

    // processing ring
    const RP = r.ringPivot;
    const ringOn = !!r.mood.ring;
    RP.position.copy(H.position);
    RP.scale.setScalar(RP.scale.x + ((ringOn ? 1 : 0.001) - RP.scale.x) * (1 - Math.exp(-dt * 6)));
    RP.visible = RP.scale.x > 0.01;
    RP.rotation.y = t * 2.2; RP.rotation.z = 0.35 * Math.sin(t * 0.9);

    // effects sit above the head but don't swing with its circling
    r.fxGroup.position.set(0.7, 0.3 + Math.max(P.y, -0.1), 0);
    const { spark, question, zzz } = r.fxMap;
    if (r.mood.fx === 'spark') { const u = still ? 0.5 : (t * 1.3) % 1; spark.visible = u < 0.85; spark.scale.setScalar(u < 0.3 ? 0.01 + smooth(u / 0.3) : 1); }
    if (r.mood.fx === 'question') { question.material.rotation = 0.25 * Math.sin(t * 3.5); question.position.y = 0.95 + 0.05 * Math.sin(t * 2.2); }
    if (r.mood.fx === 'zzz') zzz.children.forEach((z, i) => {
      const u = still ? (i + 1) / 4 : (t / 3 + i / 3) % 1;
      z.position.set(0.3 + u * 0.4, 0.7 + u * 0.7, 0.2); z.scale.setScalar(0.16 + u * 0.2);
      z.material.opacity = still ? 1 : Math.sin(Math.PI * u);
    });

    r.renderer.render(r.scene, r.camera);
    const settling = Math.abs(VR.vx) + Math.abs(VR.vy) > 0.001 || Math.abs(VR.x) + Math.abs(wrap(VR.y)) > 0.001;
    if (!still || playing || this.#drag || settling) this.#wake();
  };

  #updateTails(t, dt, still) {
    const r = this.#r, H = r.head, P = r.pose;
    const q = H.quaternion, hp = H.position;
    const refZ = v(0, 0, 1).applyQuaternion(q), up = v(0, 1, 0).applyQuaternion(q);
    const ideal = v(0, 0, 0), tmp = v(0, 0, 0), tan = v(0, 0, 0), w = v(0, 0, 0), n = v(0, 0, 0);
    const flapSpeed = 5 * P.flap, amp = 0.035 * (0.6 + 0.4 * Math.min(2, P.flap)), K = 26 * P.stiff;
    for (const tail of r.tails) {
      const { def, pts, dir, mesh } = tail;
      const seg = def.len / (SEG - 1);
      const anchor = def.anchor.clone().multiplyScalar(H.scale.x).applyQuaternion(q).add(hp);
      const d = dir.clone().applyQuaternion(q);
      for (let i = 0; i < SEG; i++) {
        const s = i * seg;
        ideal.copy(anchor).addScaledVector(d, s).addScaledVector(up, amp * s * Math.sin(t * flapSpeed - s * 2.4 + def.ph));
        ideal.y -= P.droop * 0.32 * s * s;
        if (i === 0 || !tail.ready || still) pts[i].copy(ideal);
        else pts[i].lerp(ideal, 1 - Math.exp(-dt * K / (1 + i * 0.28)));
      }
      // keep segments from stretching or bunching too far
      for (let i = 1; i < SEG; i++) {
        tmp.subVectors(pts[i], pts[i - 1]);
        const L = tmp.length();
        if (L > seg * 1.25) pts[i].copy(pts[i - 1]).addScaledVector(tmp, seg * 1.25 / L);
        else if (L < seg * 0.6 && L > 1e-5) pts[i].copy(pts[i - 1]).addScaledVector(tmp, seg * 0.6 / L);
      }
      tail.ready = true;

      // build the folded strip: two facets meeting at a raised centre crease
      const pos = mesh.geometry.attributes.position;
      for (let i = 0; i < SEG; i++) {
        tan.subVectors(pts[Math.min(SEG - 1, i + 1)], pts[Math.max(0, i - 1)]).normalize();
        w.crossVectors(refZ, tan);
        if (w.lengthSq() < 1e-6) w.copy(up);
        w.normalize();
        const s = i / (SEG - 1);
        w.applyAxisAngle(tan, def.twist + 0.22 * s * Math.sin(t * flapSpeed * 0.6 - s * 4 + def.ph));
        n.crossVectors(tan, w);
        const hw = def.w * (1 - 0.15 * s), p = pts[i], last = i === SEG - 1;
        // the last row pulls its upper edge back, giving each ribbon an angled cut
        tmp.copy(last ? pts[i - 2] : p).addScaledVector(w, hw);
        pos.setXYZ(i * 3, tmp.x, tmp.y, tmp.z);
        tmp.copy(p).addScaledVector(n, hw * 0.06).addScaledVector(w, last ? hw * 0.2 : 0);
        pos.setXYZ(i * 3 + 1, tmp.x, tmp.y, tmp.z);
        tmp.copy(p).addScaledVector(w, -hw);
        pos.setXYZ(i * 3 + 2, tmp.x, tmp.y, tmp.z);
      }
      pos.needsUpdate = true;
    }
  }

  #updateDust(dt, still) {
    const r = this.#r, rate = still ? 0 : (r.mood.dust ?? 1) * 3;
    r.dustAcc += rate * dt;
    while (r.dustAcc >= 1) {
      r.dustAcc -= 1;
      const p = r.dust.find(d => d.life <= 0);
      if (!p) break;
      const tail = r.tails[Math.floor(Math.random() * r.tails.length)];
      p.m.position.copy(tail.pts[Math.floor((SEG - 1) * (0.3 + Math.random() * 0.7))]);
      p.vel.set((Math.random() - 0.6) * 0.5, (Math.random() - 0.3) * 0.4, (Math.random() - 0.5) * 0.4);
      p.spin.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      p.life = p.max = 1 + Math.random() * 0.8;
      p.m.visible = true;
    }
    for (const p of r.dust) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { p.m.visible = false; continue; }
      p.m.position.addScaledVector(p.vel, dt);
      p.vel.y -= 0.15 * dt;
      p.m.rotation.x += p.spin.x * dt; p.m.rotation.y += p.spin.y * dt;
      p.m.scale.setScalar(Math.sin(Math.PI * (p.life / p.max)) * 1.1);
    }
  }
}

if (!customElements.get('paper-comet')) customElements.define('paper-comet', PaperComet);
