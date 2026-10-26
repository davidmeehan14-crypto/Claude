/*
 * <paper-comet> — the Paper Comet AI mascot: a folded-paper comet with ribbon tails, in real-time 3D.
 *
 * Requires three.js (npm i three, or an import map that resolves "three" and "three/addons/").
 *
 *   <script type="module" src="paper-comet.js"></script>
 *   <paper-comet mood="idle" follow-pointer rotatable style="width:200px"></paper-comet>
 *
 *   const comet = document.querySelector('paper-comet');
 *   comet.mood = 'thinking';        // lasting mood: face + body position
 *   comet.react('happy', 1500);     // temporary mood, then back to the previous one
 *   comet.play('loop');             // one-shot move layered on top of the mood
 *
 * Moods: idle smile happy wink excited thinking talking laughing confused cool
 *        sleepy determined starstruck surprised sad launch
 * Plays: loop spin flip swoop dash jump wiggle nod
 *
 * Attributes: mood, follow-pointer (turns to look at the cursor), rotatable (drag to spin it in 3D).
 * The canvas is transparent. Rendering pauses off screen. Respects prefers-reduced-motion.
 */
import * as THREE from 'three';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const MOODS = {
  idle:       { face: 'eyes',      pose: 'cruise' },
  smile:      { face: 'smile',     pose: 'cruise' },
  happy:      { face: 'happy',     pose: 'bounce', dust: 2 },
  wink:       { face: 'wink',      pose: 'cruise' },
  excited:    { face: 'excited',   pose: 'hop',    dust: 2, fx: 'spark' },
  thinking:   { face: 'lookup',    pose: 'orbit',  dust: 1.5, fx: 'dots' },
  talking:    { face: 'talk',      pose: 'cruise' },
  laughing:   { face: 'laugh',     pose: 'shake',  dust: 1.5 },
  confused:   { face: 'eyes',      pose: 'tilt',   fx: 'question' },
  cool:       { face: 'cool',      pose: 'glide' },
  sleepy:     { face: 'sleep',     pose: 'doze',   dust: 0, fx: 'zzz' },
  determined: { face: 'brows',     pose: 'charge', dust: 2.5 },
  starstruck: { face: 'stars',     pose: 'bounce', dust: 3 },
  surprised:  { face: 'surprised', pose: 'jolt',   fx: 'spark' },
  sad:        { face: 'sad',       pose: 'droop',  dust: 0 },
  launch:     { face: 'excited',   pose: 'rocket', dust: 5 },
};

const PLAYS = { loop: 1.4, spin: 0.9, flip: 1.3, swoop: 1.2, dash: 0.8, jump: 0.9, wiggle: 0.8, nod: 0.9 };

const INK = '#1B2F5B';
const ACCENT = '#EE7452';

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
  rocket: t => ({ x: 0.015 * Math.sin(t * 41) - 0.45, y: 0.05 + 0.02 * Math.sin(t * 33), pitch: 1.42, roll: 0.25 * Math.sin(t * 2.2), yaw: -0.25, stiff: 1.8, flap: 3 }),
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
  { anchor: v(-0.22, 0.24, 0.1),   dir: [0.2, 0.1],  len: 1.75, w: 0.14, root: '#F4E0CF', tip: '#F9EDE2', twist: 0.1,   ph: 0 },
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

// ---------------------------------------------------------------- face

const FACE_DIR = v(0.3, 0.08, 1).normalize();
const FACE_SIZE = 1.0;
const EYE_UV = [[-0.31, 0.1], [0.31, 0.1]];

const BEADS = {
  eyes:      { show: [1, 1] },
  lookup:    { show: [1, 1], dx: 0.05, dy: 0.08 },
  smile:     { show: [1, 1] },
  happy:     { show: [0, 0] },
  wink:      { show: [1, 0] },
  sleep:     { show: [0, 0] },
  excited:   { show: [1, 1], sy: 1.08 },
  talk:      { show: [1, 1] },
  laugh:     { show: [0, 0] },
  surprised: { show: [1, 1], sx: 1.25, sy: 1.05 },
  brows:     { show: [1, 1], sy: 0.8, dy: -0.02 },
  sad:       { show: [1, 1], sx: 0.9, sy: 0.85, dy: -0.02 },
  stars:     { show: [1, 1], sx: 1.2, sy: 1.1, stars: true },
  cool:      { show: [0, 0] },
};

function drawFace(ctx, face, t, eyes) {
  const W = ctx.canvas.width, k = W / FACE_SIZE;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, W);
  ctx.setTransform(k, 0, 0, -k, W / 2, W / 2);
  ctx.lineCap = ctx.lineJoin = 'round';
  ctx.strokeStyle = ctx.fillStyle = INK;
  ctx.lineWidth = 0.03;
  const [[nx, ny], [fx, fy]] = eyes;
  const mx = (nx + fx) / 2, my = ny - 0.17;

  for (const [x, y] of [[nx - 0.06, ny - 0.13], [fx + 0.06, fy - 0.13]]) {
    const r = ctx.createRadialGradient(x, y, 0, x, y, 0.09);
    r.addColorStop(0, 'rgba(255,170,160,.75)'); r.addColorStop(1, 'rgba(255,170,160,0)');
    ctx.fillStyle = r; ctx.beginPath(); ctx.ellipse(x, y, 0.09, 0.055, 0, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = INK;

  const arcUp = (x, y) => { ctx.beginPath(); ctx.moveTo(x - 0.065, y - 0.02); ctx.quadraticCurveTo(x, y + 0.085, x + 0.065, y - 0.02); ctx.stroke(); };
  const arcDown = (x, y) => { ctx.beginPath(); ctx.moveTo(x - 0.065, y + 0.01); ctx.quadraticCurveTo(x, y - 0.07, x + 0.065, y + 0.01); ctx.stroke(); };
  const line = (x1, y1, x2, y2) => { ctx.lineWidth = 0.034; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.lineWidth = 0.03; };
  const openMouth = (w, h) => {
    ctx.beginPath(); ctx.moveTo(mx - w, my + 0.01); ctx.quadraticCurveTo(mx, my + 0.025, mx + w, my + 0.01);
    ctx.quadraticCurveTo(mx + w * 0.9, my - h, mx, my - h); ctx.quadraticCurveTo(mx - w * 0.9, my - h, mx - w, my + 0.01); ctx.fill();
    ctx.save(); ctx.clip();
    ctx.fillStyle = '#FF8E86'; ctx.beginPath(); ctx.ellipse(mx, my - h, w * 0.7, h * 0.55, 0, 0, TAU); ctx.fill();
    ctx.restore();
  };
  const smile = (w = 0.05, d = 0.045) => { ctx.beginPath(); ctx.moveTo(mx - w, my); ctx.quadraticCurveTo(mx, my - d, mx + w, my); ctx.stroke(); };

  switch (face) {
    case 'eyes': case 'lookup': smile(0.035, 0.025); break;
    case 'smile': smile(); break;
    case 'happy': arcUp(nx, ny); arcUp(fx, fy); smile(0.06, 0.06); break;
    case 'wink': arcUp(fx, fy); smile(); break;
    case 'sleep': arcDown(nx, ny); arcDown(fx, fy); ctx.beginPath(); ctx.ellipse(mx, my - 0.01, 0.018, 0.022, 0, 0, TAU); ctx.fill(); break;
    case 'excited': openMouth(0.065, 0.085); break;
    case 'talk': {
      const open = Math.abs(Math.sin(t * 9) * (0.6 + 0.4 * Math.sin(t * 3.1)));
      ctx.beginPath(); ctx.ellipse(mx, my - 0.015, 0.042, 0.01 + 0.04 * open, 0, 0, TAU); ctx.fill(); break;
    }
    case 'laugh':
      ctx.beginPath(); ctx.moveTo(nx - 0.055, ny + 0.06); ctx.lineTo(nx + 0.05, ny); ctx.lineTo(nx - 0.055, ny - 0.06); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(fx + 0.055, fy + 0.06); ctx.lineTo(fx - 0.05, fy); ctx.lineTo(fx + 0.055, fy - 0.06); ctx.stroke();
      openMouth(0.075, 0.1); break;
    case 'surprised': ctx.beginPath(); ctx.ellipse(mx, my - 0.02, 0.028, 0.036, 0, 0, TAU); ctx.fill(); break;
    case 'brows':
      line(nx - 0.085, ny + 0.16, nx + 0.06, ny + 0.11); line(fx + 0.085, fy + 0.16, fx - 0.06, fy + 0.11);
      ctx.beginPath(); ctx.moveTo(mx - 0.04, my); ctx.lineTo(mx + 0.04, my - 0.005); ctx.stroke(); break;
    case 'sad':
      line(nx - 0.08, ny + 0.11, nx + 0.06, ny + 0.155); line(fx + 0.08, fy + 0.11, fx - 0.06, fy + 0.155);
      ctx.beginPath(); ctx.moveTo(mx - 0.045, my - 0.03); ctx.quadraticCurveTo(mx, my + 0.01, mx + 0.045, my - 0.03); ctx.stroke(); break;
    case 'stars': smile(0.05, 0.05); break;
    case 'cool': {
      const lens = x => { ctx.beginPath(); ctx.moveTo(x - 0.11, ny + 0.055); ctx.lineTo(x + 0.11, ny + 0.055);
        ctx.quadraticCurveTo(x + 0.11, ny - 0.085, x + 0.02, ny - 0.085); ctx.lineTo(x - 0.03, ny - 0.085);
        ctx.quadraticCurveTo(x - 0.11, ny - 0.085, x - 0.11, ny + 0.055); ctx.fill(); };
      lens(nx); lens(fx);
      ctx.fillRect(nx, ny + 0.025, fx - nx, 0.03);
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 0.016;
      for (const x of [nx, fx]) { ctx.beginPath(); ctx.moveTo(x - 0.06, ny + 0.03); ctx.lineTo(x - 0.015, ny - 0.045); ctx.stroke(); }
      ctx.strokeStyle = INK; ctx.lineWidth = 0.03; smile(0.045, 0.03);
      break;
    }
  }
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

    // view: the whole comet, spun by dragging. head: moved and turned by body positions.
    const view = new THREE.Group();
    scene.add(view);
    const head = new THREE.Group();
    view.add(head);
    const headMesh = buildHead(headMat);
    head.add(headMesh);
    const tails = TAILS.map(def => buildTail(def, tailMat));
    for (const t of tails) view.add(t.mesh);

    // Face frame on the head
    const fz = FACE_DIR.clone(), fx = v(0, 1, 0).cross(fz).normalize(), fy = fz.clone().cross(fx).normalize();
    headMesh.updateMatrixWorld();
    const ray = new THREE.Raycaster();
    const surface = (u, w) => {
      const d = fz.clone().addScaledVector(fx, u).addScaledVector(fy, w).normalize();
      ray.set(d.clone().multiplyScalar(3), d.clone().negate());
      const hit = ray.intersectObject(headMesh)[0];
      return hit && { p: hit.point, d };
    };
    const center = fz.clone().multiplyScalar(R);
    const toFace = p => [p.clone().sub(center).dot(fx), p.clone().sub(center).dot(fy)];

    const proj = new THREE.Object3D();
    proj.position.copy(center); proj.lookAt(center.clone().add(fz)); proj.updateMatrixWorld();
    const faceCanvas = document.createElement('canvas'); faceCanvas.width = faceCanvas.height = 1024;
    const faceCtx = faceCanvas.getContext('2d');
    const faceTex = new THREE.CanvasTexture(faceCanvas);
    faceTex.colorSpace = THREE.SRGBColorSpace; faceTex.anisotropy = 4;
    const decal = new THREE.Mesh(
      new DecalGeometry(headMesh, center, proj.rotation, v(FACE_SIZE, FACE_SIZE, 0.7)),
      new THREE.MeshStandardMaterial({ map: faceTex, transparent: true, roughness: 0.9, envMapIntensity: ENV * 0.4, polygonOffset: true, polygonOffsetFactor: -4, depthWrite: false }));
    decal.receiveShadow = true;
    head.add(decal);

    // Eyes: glossy navy beads with highlights
    const beadMat = new THREE.MeshPhysicalMaterial({ color: INK, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 0.5 });
    const shineMat = new THREE.MeshBasicMaterial({ color: '#FFFFFF' });
    const starShape = new THREE.Shape();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + Math.PI / 2, rr = i % 2 ? 0.2 : 0.8;
      starShape[i ? 'lineTo' : 'moveTo'](Math.cos(a) * rr, Math.sin(a) * rr);
    }
    const starGeo = new THREE.ShapeGeometry(starShape);
    const beads = EYE_UV.map(() => {
      const holder = new THREE.Group();
      const bead = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), beadMat);
      bead.castShadow = true;
      const shine = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), shineMat);
      shine.position.set(-0.3, 0.4, 0.84); shine.scale.set(1.3, 1.5, 0.5);
      const shine2 = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), shineMat);
      shine2.position.set(0.3, -0.38, 0.9);
      const star = new THREE.Mesh(starGeo, shineMat);
      star.position.z = 1.02;
      bead.add(shine, shine2, star);
      holder.add(bead);
      head.add(holder);
      return { holder, bead, shine, shine2, star };
    });
    const baseEyes = EYE_UV.map(([u, w]) => toFace(surface(u, w).p));
    const placeBeads = cfg => {
      beads.forEach((b, i) => {
        const [u, w] = EYE_UV[i];
        const hit = surface(u + (cfg.dx ?? 0), w + (cfg.dy ?? 0));
        b.holder.visible = !!cfg.show[i] && !!hit;
        if (!hit) return;
        const n = hit.d, y = fy.clone().sub(n.clone().multiplyScalar(fy.dot(n))).normalize();
        const x = y.clone().cross(n);
        b.holder.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, n));
        b.holder.position.copy(hit.p).addScaledVector(n, 0.012);
        b.base = [0.068 * (cfg.sx ?? 1), 0.1 * (cfg.sy ?? 1), 0.045];
        b.bead.scale.set(...b.base);
        b.star.visible = !!cfg.stars;
        b.shine.visible = b.shine2.visible = !cfg.stars;
      });
    };

    // Effects that follow the head but stay upright
    const fxGroup = new THREE.Group();
    view.add(fxGroup);
    const accentMat = new THREE.MeshStandardMaterial({ color: ACCENT, roughness: 0.5, envMapIntensity: ENV });
    const spark = new THREE.Group();
    for (const [x, y, a] of [[0.05, 0.78, 0.25], [0.38, 0.7, -0.5], [0.62, 0.45, -1.1]]) {
      const c = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.15, 4, 10), accentMat);
      c.position.set(x, y, 0.2); c.rotation.z = a; spark.add(c);
    }
    const dots = new THREE.Group();
    for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.06, 20, 14), accentMat); s.position.set(-0.05 + i * 0.2, 0.78, 0.2); dots.add(s); }
    const question = textSprite('?', ACCENT, 0.6); question.position.set(0.5, 0.85, 0.2);
    const zzz = new THREE.Group();
    for (let i = 0; i < 3; i++) zzz.add(textSprite('z', INK, 0.3));
    fxGroup.add(dots, spark, question, zzz);

    // Stardust: little paper diamonds shed from the tails
    const dustGeo = new THREE.OctahedronGeometry(0.045, 0);
    const dustMats = ['#FFF3E6', '#F6B194', '#EE7A58'].map(c => new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: 0.8, envMapIntensity: ENV }));
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
      renderer, scene, camera, view, head, tails, fxGroup, shadow, faceCtx, faceTex, placeBeads, beads, baseEyes,
      fxMap: { dots, spark, question, zzz }, dust, dustAcc: 0,
      clock: new THREE.Clock(), io, ro, raf: 0, visible: true, plays: [],
      pose: { x: 0, y: 0, yaw: 0, pitch: 0.42, roll: 0, stiff: 1, droop: 0, flap: 1 },
      look: { yaw: 0, pitch: 0 }, viewRot: { x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0 }, viewHold: 0,
      mood: MOODS.idle, moodT0: 0, face: 'eyes', blinkAt: 2, blinkT: -9, faceDrawnAt: 0, pop: -9,
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
    r.placeBeads(BEADS[m.face]);
    this.#drawFace(now);
    for (const [k, g] of Object.entries(r.fxMap)) g.visible = k === m.fx;
    r.pop = now;
    this.#wake();
  }

  #drawFace(t) {
    const r = this.#r, cfg = BEADS[r.face];
    const eyes = r.baseEyes.map(([x, y]) => [x + (cfg.dx ?? 0) * 0.45, y + (cfg.dy ?? 0) * 0.45]);
    drawFace(r.faceCtx, r.face, t, eyes);
    r.faceTex.needsUpdate = true;
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

    // look toward the pointer (the face is on the +z side)
    const pa = this.#pointer.active && !still;
    const lk = 1 - Math.exp(-dt * 5);
    r.look.yaw += ((pa ? this.#pointer.x * 0.55 : 0) - r.look.yaw) * lk;
    r.look.pitch += ((pa ? this.#pointer.y * 0.4 : 0) - r.look.pitch) * lk;

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

    // blink
    if (!still && now > r.blinkAt) { r.blinkT = now; r.blinkAt = now + 2.2 + Math.random() * 4; }
    const bu = (now - r.blinkT) / 0.16;
    const lid = bu >= 0 && bu < 1 ? 1 - 0.92 * Math.sin(Math.PI * bu) : 1;
    for (const b of r.beads) if (b.base) b.bead.scale.set(b.base[0], b.base[1] * lid, b.base[2]);
    if (r.face === 'talk' && !still && now - r.faceDrawnAt > 1 / 30) { this.#drawFace(now); r.faceDrawnAt = now; }

    // effects
    const { dots, spark, question, zzz } = r.fxMap;
    // fx sit above the head but don't swing with its circling
    r.fxGroup.position.set(0.7, 0.3 + Math.max(P.y, -0.1), 0);
    if (r.mood.fx === 'dots') dots.children.forEach((d, i) => { const b = Math.max(0, Math.sin(t * 6 - i * 0.9)); d.position.y = 0.78 + 0.08 * b; d.scale.setScalar(0.8 + 0.3 * b); });
    if (r.mood.fx === 'spark') { const u = still ? 0.5 : (t * 1.3) % 1; spark.visible = u < 0.85; spark.scale.setScalar(u < 0.3 ? 0.01 + smooth(u / 0.3) : 1); }
    if (r.mood.fx === 'question') { question.material.rotation = 0.25 * Math.sin(t * 3.5); question.position.y = 0.85 + 0.05 * Math.sin(t * 2.2); }
    if (r.mood.fx === 'zzz') zzz.children.forEach((z, i) => {
      const u = still ? (i + 1) / 4 : (t / 3 + i / 3) % 1;
      z.position.set(0.3 + u * 0.4, 0.6 + u * 0.7, 0.2); z.scale.setScalar(0.16 + u * 0.2);
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
