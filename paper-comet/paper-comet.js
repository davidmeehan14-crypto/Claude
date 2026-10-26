/*
 * <paper-comet> — the Paper Comet AI bot: a glossy little robot with a dark visor, glowing eyes
 * and a soft flame trail, in real-time 3D.
 *
 * Requires three.js (npm i three, or an import map that resolves "three" and "three/addons/").
 *
 *   <script type="module" src="paper-comet.js"></script>
 *   <paper-comet mood="idle" follow-pointer rotatable style="width:200px"></paper-comet>
 *
 *   const comet = document.querySelector('paper-comet');
 *   comet.mood = 'thinking';        // lasting mood: eyes, body position, arms, trail
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
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// arms: rest | up | limp | wave · thrust: thruster brightness · trail: trail size
const MOODS = {
  idle:       { face: 'eyes',      pose: 'cruise', arms: 'rest' },
  smile:      { face: 'smile',     pose: 'cruise', arms: 'rest' },
  happy:      { face: 'happy',     pose: 'bounce', arms: 'up',   dust: 2 },
  wink:       { face: 'wink',      pose: 'cruise', arms: 'rest' },
  excited:    { face: 'happy',     pose: 'hop',    arms: 'wave', dust: 2, fx: 'spark', thrust: 1.6 },
  thinking:   { face: 'process',   pose: 'orbit',  arms: 'rest', dust: 1.5 },
  talking:    { face: 'talk',      pose: 'cruise', arms: 'rest' },
  laughing:   { face: 'laugh',     pose: 'shake',  arms: 'up',   dust: 1.5 },
  confused:   { face: 'eyes',      pose: 'tilt',   arms: 'rest', fx: 'question' },
  cool:       { face: 'cool',      pose: 'glide',  arms: 'rest' },
  sleepy:     { face: 'sleep',     pose: 'doze',   arms: 'limp', dust: 0, fx: 'zzz', thrust: 0.3, trail: 0.7 },
  determined: { face: 'focus',     pose: 'charge', arms: 'rest', dust: 2.5, thrust: 1.5, trail: 1.25 },
  starstruck: { face: 'stars',     pose: 'bounce', arms: 'up',   dust: 3 },
  surprised:  { face: 'big',       pose: 'jolt',   arms: 'up',   fx: 'spark' },
  sad:        { face: 'sad',       pose: 'droop',  arms: 'limp', dust: 0, thrust: 0.4, trail: 0.75 },
  launch:     { face: 'happy',     pose: 'rocket', arms: 'rest', dust: 5, thrust: 2.2, trail: 1.5 },
};

const PLAYS = { loop: 1.4, spin: 0.9, flip: 1.3, swoop: 1.2, dash: 0.8, jump: 0.9, wiggle: 0.8, nod: 0.9 };

const INK = '#141C33';
const CORAL = '#FF7A58';
const EYE = '#FFE9C8';

const v = (x, y, z) => new THREE.Vector3(x, y, z);
const smooth = u => u * u * (3 - 2 * u);
const TAU = Math.PI * 2;
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------- body positions
//   pitch: nose up (+) / down (-) · yaw: turn · roll: around the flight axis
//   flap: how hard the trail and thruster are working

const POSES = {
  cruise: t => ({ y: 0.07 * Math.sin(t * 1.8), pitch: 0.12 + 0.05 * Math.sin(t * 1.8 + 1), roll: 0.05 * Math.sin(t * 1.1), yaw: -0.1 + 0.08 * Math.sin(t * 0.6) }),
  glide:  t => ({ y: 0.05 * Math.sin(t * 1.2), x: 0.04 * Math.sin(t * 0.7), pitch: -0.05, roll: -0.15 + 0.05 * Math.sin(t * 1.2), yaw: -0.2, flap: 0.7 }),
  bounce: t => { const b = Math.abs(Math.sin(Math.PI * t / 0.9)); return { y: 0.24 * b - 0.03, pitch: 0.15 + 0.18 * b, roll: 0.05 * Math.sin(t * 3), flap: 1.4 }; },
  hop:    t => { const b = Math.abs(Math.sin(Math.PI * t / 0.55)); return { y: 0.18 * b, pitch: 0.2 + 0.2 * b, yaw: -0.1 * b, flap: 1.8 }; },
  orbit:  t => { const a = t * 2.4; return { x: 0.32 * Math.cos(a) - 0.1, y: 0.2 * Math.sin(a), pitch: 0.12 + 0.35 * Math.cos(a), roll: 0.12 * Math.sin(a), flap: 1.6 }; },
  tilt:   t => ({ y: 0.04 * Math.sin(t * 1.6), pitch: 0.05, roll: -0.45 + 0.05 * Math.sin(t * 2.4), yaw: -0.35 }),
  shake:  t => ({ yaw: 0.14 * Math.sin(t * 17), roll: 0.1 * Math.sin(t * 17 + 1), y: 0.06 * Math.abs(Math.sin(t * 8.5)), pitch: 0.15, flap: 2 }),
  doze:   t => ({ y: -0.12 + 0.04 * Math.sin(t * 1.1), pitch: -0.45 + 0.04 * Math.sin(t * 1.1), roll: 0.12, yaw: -0.1, flap: 0.3 }),
  droop:  t => ({ y: -0.2 + 0.02 * Math.sin(t * 1.4), pitch: -0.7, roll: 0.06, yaw: -0.15, flap: 0.35 }),
  charge: t => ({ x: 0.06 * Math.sin(t * 6), y: 0.03 * Math.sin(t * 3), pitch: -0.15, yaw: -0.08, flap: 2.6 }),
  rocket: t => ({ x: 0.015 * Math.sin(t * 41) - 0.45, y: 0.3 + 0.02 * Math.sin(t * 33), pitch: 1.1, roll: 0.25 * Math.sin(t * 2.2), yaw: -0.25, flap: 3 }),
  jolt:   (t, tm) => { const u = Math.min(1, tm / 0.35); return { x: -0.14 * smooth(u), y: 0.14 * Math.sin(Math.PI * Math.min(1, tm / 0.5)) + 0.06, pitch: 0.55 * smooth(u) + 0.05, flap: 2 }; },
};

const PLAY_FNS = {
  loop:   u => { const a = TAU * smooth(u); return { x: 0.55 * Math.sin(a), y: 0.55 * (1 - Math.cos(a)), pitch: a, flap: 2.5 }; },
  spin:   u => ({ roll: TAU * smooth(u), y: 0.15 * Math.sin(Math.PI * u) }),
  flip:   u => ({ yaw: TAU * smooth(u), y: 0.1 * Math.sin(Math.PI * u) }),
  swoop:  u => ({ x: 0.5 * Math.sin(Math.PI * u), y: -0.45 * Math.sin(Math.PI * u), pitch: -1.1 * Math.sin(TAU * u), flap: 2.5 }),
  dash:   u => ({ x: 0.7 * Math.sin(Math.PI * u), y: 0.25 * Math.sin(Math.PI * u), flap: 3.5 }),
  jump:   u => ({ y: 0.55 * Math.sin(Math.PI * u), pitch: 0.5 * Math.sin(TAU * u) }),
  wiggle: u => ({ yaw: 0.45 * Math.sin(u * 2 * TAU) * (1 - u), roll: 0.3 * Math.sin(u * 2 * TAU + 0.5) * (1 - u) }),
  nod:    u => ({ pitch: -0.4 * Math.abs(Math.sin(TAU * u)) }),
};

// ---------------------------------------------------------------- textures

function glowTexture(inner, mid, outer) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, inner); r.addColorStop(0.4, mid); r.addColorStop(1, outer);
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

// ---------------------------------------------------------------- visor face
// Drawn on a transparent canvas laid over the visor. Eyes are two glowing pills; expressions change the pills.

const VISOR = { w: 0.7, h: 0.5, r: 0.2 };
const PILL = { x: 0.14, y: 0.0, w: 0.04, h: 0.115 };      // half sizes
const BLINKS = new Set(['eyes', 'smile', 'wink', 'talk', 'big', 'focus', 'sad', 'cool']);
const LIVE = new Set(['process', 'talk', 'sleep']);

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x - w + r, y + h);
  ctx.arcTo(x + w, y + h, x + w, y - h, r); ctx.arcTo(x + w, y - h, x - w, y - h, r);
  ctx.arcTo(x - w, y - h, x - w, y + h, r); ctx.arcTo(x - w, y + h, x + w, y + h, r);
  ctx.closePath();
}

function drawFace(ctx, face, t, { lid = 1, glance = [0, 0] } = {}) {
  const W = ctx.canvas.width, k = W / VISOR.w;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, ctx.canvas.height);
  ctx.setTransform(k, 0, 0, -k, W / 2, ctx.canvas.height / 2);
  ctx.lineCap = ctx.lineJoin = 'round';
  // the panel: deep navy with a soft sheen along the top
  roundRect(ctx, 0, 0, VISOR.w / 2, VISOR.h / 2, VISOR.r);
  const pg = ctx.createLinearGradient(0, VISOR.h / 2, 0, -VISOR.h / 2);
  pg.addColorStop(0, '#1A2544'); pg.addColorStop(0.5, '#0F1830'); pg.addColorStop(1, '#0B1226');
  ctx.fillStyle = pg; ctx.fill();
  ctx.save(); ctx.clip();
  const sheen = ctx.createLinearGradient(0, VISOR.h / 2, 0, VISOR.h / 2 - 0.16);
  sheen.addColorStop(0, 'rgba(255,255,255,.22)'); sheen.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen; ctx.fillRect(-VISOR.w / 2, VISOR.h / 2 - 0.16, VISOR.w, 0.16);
  ctx.restore();
  ctx.shadowColor = 'rgba(255,205,140,.95)'; ctx.shadowBlur = W * 0.08;
  ctx.fillStyle = ctx.strokeStyle = EYE;
  ctx.lineWidth = 0.036;
  const [gx, gy] = glance;
  const L = [-PILL.x + gx, PILL.y + gy], R = [PILL.x + gx, PILL.y + gy];

  const pill = ([x, y], sw = 1, sh = 1, tilt = 0) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(tilt);
    const h = Math.max(0.012, PILL.h * sh * lid), w = PILL.w * sw;
    roundRect(ctx, 0, 0, w, h, Math.min(w, h)); ctx.fill(); ctx.restore();
  };
  const pills = (sw = 1, sh = 1) => { pill(L, sw, sh); pill(R, sw, sh); };
  const arc = ([x, y], up = true, ww = 0.07, hh = 0.07) => {
    ctx.lineWidth = 0.042; ctx.beginPath();
    ctx.moveTo(x - ww, y - (up ? hh / 2 : -hh / 2)); ctx.lineTo(x, y + (up ? hh / 2 : -hh / 2)); ctx.lineTo(x + ww, y - (up ? hh / 2 : -hh / 2)); ctx.stroke();
    ctx.lineWidth = 0.036;
  };
  const chevron = ([x, y], dir) => { // < or >
    ctx.lineWidth = 0.042; ctx.beginPath();
    ctx.moveTo(x + 0.04 * dir, y + 0.07); ctx.lineTo(x - 0.035 * dir, y); ctx.lineTo(x + 0.04 * dir, y - 0.07); ctx.stroke();
    ctx.lineWidth = 0.036;
  };

  switch (face) {
    case 'eyes': pills(); pills(); break;
    case 'smile': pills(1, 0.8); arc([L[0], L[1] - 0.085], false, 0.045, 0.03); arc([R[0], R[1] - 0.085], false, 0.045, 0.03); break;
    case 'happy': arc(L); arc(R); break;
    case 'wink': pill(L); arc(R); break;
    case 'laugh': chevron(L, -1); chevron(R, 1); break;
    case 'focus': pill(L, 1, 0.8, 0.35); pill(R, 1, 0.8, -0.35); break;
    case 'sad': pill([L[0], L[1] - 0.02], 0.9, 0.75, -0.3); pill([R[0], R[1] - 0.02], 0.9, 0.75, 0.3); break;
    case 'big': pills(1.5, 1.1); break;
    case 'cool': for (const p of [L, R]) { ctx.save(); ctx.translate(p[0], p[1]); roundRect(ctx, 0, 0, 0.075, 0.018, 0.018); ctx.fill(); ctx.restore(); } break;
    case 'stars':
      for (const [x, y] of [L, R]) {
        ctx.beginPath();
        for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + Math.PI / 2, rr = i % 2 ? 0.035 : 0.1; ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
        ctx.closePath(); ctx.fill();
      }
      break;
    case 'sleep': {
      ctx.globalAlpha = 0.5 + 0.1 * Math.sin(t * 1.3);
      for (const p of [L, R]) { ctx.save(); ctx.translate(p[0], p[1]); roundRect(ctx, 0, 0, 0.065, 0.016, 0.016); ctx.fill(); ctx.restore(); }
      ctx.globalAlpha = 1; break;
    }
    case 'talk': {
      pills();
      for (let i = -2; i <= 2; i++) {
        const hh = 0.008 + 0.022 * Math.abs(Math.sin(t * 11 + i * 1.3) * Math.sin(t * 3.7 + i));
        roundRect(ctx, gx * 0.5 + i * 0.03, -0.14, 0.008, hh, 0.008); ctx.fill();
      }
      break;
    }
    case 'process':
      for (let i = -1; i <= 1; i++) {
        const b = 0.35 + 0.65 * Math.max(0, Math.sin(t * 5 - i * 1.1));
        ctx.globalAlpha = b; ctx.beginPath(); ctx.arc(i * 0.1 + gx * 0.5, gy * 0.5, 0.028 + 0.01 * b, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1; break;
  }
}

// ---------------------------------------------------------------- model parts

// A soft flame lobe: round at the head end (+y), tapering to a point at -y. Colored root -> tip.
function lobeGeometry({ len, rad, root, tip }) {
  // a rounded tail end, a gentle taper, then the dome that sits inside the head
  const rt = 0.52 * rad, prof = [];
  for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + (i / 6) * (Math.PI / 2); prof.push([rt * Math.cos(a), -len + rt + rt * Math.sin(a)]); }
  for (let i = 1; i <= 6; i++) { const u = i / 6; prof.push([rt + (rad - rt) * Math.pow(u, 0.7), (-len + rt) + (len - rt) * u]); }
  prof.push([0.9 * rad, 0.45 * rad], [0.55 * rad, 0.8 * rad], [0, 0.95 * rad]);
  const prof2 = prof.map(([r, y]) => new THREE.Vector2(r, y));
  const g = new THREE.LatheGeometry(prof2, 28);
  const pos = g.attributes.position, col = [], c0 = new THREE.Color(root), c1 = new THREE.Color(tip);
  for (let i = 0; i < pos.count; i++) {
    const u = Math.max(0, Math.min(1, (pos.getY(i) + len) / (len + 0.95 * rad)));
    const c = c1.clone().lerp(c0, Math.pow(u, 3.2));
    col.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}

// Lobes in trail space: +x forward (toward the head), +y up, +z toward the viewer.
// Lobes in trail space: +x forward (toward the head), +y up, +z toward the viewer.
// at[0] is how much further back than the front line each lobe sits; the front line is a fixed gap behind the head.
const HEAD_BACK = 0.49, GAP = 0.07;
const LOBES = [
  { at: [0.00, -0.02, -0.06], len: 1.10, rad: 0.40, root: '#FFF7EF', tip: '#FFA477', pitch: -0.05, yaw: 0.00, ph: 0.0 },
  { at: [-0.06, 0.21, -0.12], len: 0.92, rad: 0.30, root: '#FFE6D3', tip: '#FF7E52', pitch: 0.24, yaw: -0.04, ph: 1.3 },
  { at: [-0.02, -0.23, -0.02], len: 0.88, rad: 0.30, root: '#FFD6BE', tip: '#FF5E3A', pitch: -0.32, yaw: 0.05, ph: 2.6 },
  { at: [0.00, -0.05, 0.17], len: 0.75, rad: 0.25, root: '#FFF0E5', tip: '#FF9268', pitch: -0.1, yaw: 0.12, ph: 3.9 },
  { at: [-0.04, 0.09, -0.28], len: 0.84, rad: 0.27, root: '#FFE0CC', tip: '#FF7A4E', pitch: 0.06, yaw: -0.12, ph: 5.1 },
  { at: [-0.32, 0.36, 0.02], len: 0.53, rad: 0.17, root: '#FFBCA2', tip: '#FF6440', pitch: 0.42, yaw: 0.0, ph: 0.7 },
  { at: [-0.34, -0.33, 0.07], len: 0.48, rad: 0.16, root: '#FFB096', tip: '#FF5836', pitch: -0.46, yaw: 0.0, ph: 4.4 },
  { at: [-0.5, 0.10, 0.14], len: 0.44, rad: 0.12, root: '#FFC4AC', tip: '#FF7048', pitch: 0.12, yaw: 0.2, ph: 2.1 },
  { at: [-0.55, -0.12, -0.16], len: 0.40, rad: 0.11, root: '#FFB89E', tip: '#FF6A44', pitch: -0.18, yaw: -0.2, ph: 3.3 },
];
const lobeX = def => -(HEAD_BACK + GAP + 0.95 * def.rad) + def.at[0];

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

  /** Spin the whole bot to a view angle in radians. It eases back to its resting view after a moment. */
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
    camera.position.set(0, 0.6, 7.4);
    camera.lookAt(0, -0.05, 0);

    // soft, high-key studio light
    scene.add(new THREE.HemisphereLight('#FFFFFF', '#FFD9C8', 0.9));
    const key = new THREE.DirectionalLight('#FFFFFF', 1.6);
    key.position.set(-2.5, 4.5, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 14 });
    key.shadow.bias = -0.0005; key.shadow.normalBias = 0.03; key.shadow.radius = 4;
    scene.add(key);
    const fill = new THREE.DirectionalLight('#FFE3D5', 0.5);
    fill.position.set(3, 0, 3);
    scene.add(fill);
    const rim = new THREE.DirectionalLight('#FFC7B0', 0.8);
    rim.position.set(-2, 1.5, -4);
    scene.add(rim);

    const ENV = 0.7;
    const shell = new THREE.MeshPhysicalMaterial({ color: '#FFFDFB', roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.18, envMapIntensity: ENV });
    const darkMat = new THREE.MeshPhysicalMaterial({ color: INK, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.15, envMapIntensity: ENV });
    const coralMat = new THREE.MeshPhysicalMaterial({ color: CORAL, roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.15, envMapIntensity: ENV, emissive: '#FF5A3A', emissiveIntensity: 0.12 });
    const lobeMat = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.6, clearcoat: 0.4, clearcoatRoughness: 0.45, envMapIntensity: ENV * 0.3, transparent: true, opacity: 0.94, emissive: '#FF5A30', emissiveIntensity: 0.3 });

    // view: the whole bot, spun by dragging. head: moved and turned by body positions.
    const view = new THREE.Group();
    scene.add(view);
    const head = new THREE.Group();
    view.add(head);

    const body = new THREE.Mesh(new RoundedBoxGeometry(0.98, 0.9, 0.9, 6, 0.38), shell);
    body.castShadow = body.receiveShadow = true;
    head.add(body);

    // visor and eyes: one canvas projected onto the front of the head, so the panel follows its curve
    const faceCanvas = document.createElement('canvas'); faceCanvas.width = 640; faceCanvas.height = Math.round(640 * VISOR.h / VISOR.w);
    const faceCtx = faceCanvas.getContext('2d');
    const faceTex = new THREE.CanvasTexture(faceCanvas);
    faceTex.colorSpace = THREE.SRGBColorSpace; faceTex.anisotropy = 8;
    body.updateMatrixWorld();
    const visor = new THREE.Mesh(
      new DecalGeometry(body, v(0, -0.03, 0.45), new THREE.Euler(0, 0, 0), v(VISOR.w, VISOR.h, 0.7)),
      new THREE.MeshPhysicalMaterial({ map: faceTex, emissiveMap: faceTex, emissive: '#FFFFFF', emissiveIntensity: 0.9, transparent: true,
        roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: ENV * 1.3, polygonOffset: true, polygonOffsetFactor: -4, depthWrite: false }));
    head.add(visor);

    // ears: round discs on each side
    for (const s of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.21, 32, 24), shell);
      ear.scale.set(0.42, 1, 1); ear.position.set(s * 0.5, -0.02, -0.02); ear.castShadow = true;
      head.add(ear);
    }

    // antenna: a little coral drop floating above the head
    const antGeo = new THREE.CapsuleGeometry(0.068, 0.13, 8, 20);
    { const pos = antGeo.attributes.position, col = [], a = new THREE.Color('#FF6A44'), b = new THREE.Color('#FFA585');
      for (let i = 0; i < pos.count; i++) { const c = a.clone().lerp(b, (pos.getY(i) + 0.13) / 0.26); col.push(c.r, c.g, c.b); }
      antGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); }
    const antenna = new THREE.Mesh(antGeo, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.15, envMapIntensity: ENV, emissive: '#FF5A3A', emissiveIntensity: 0.1 }));
    antenna.position.set(-0.1, 0.62, 0); antenna.rotation.z = -0.55; antenna.castShadow = true;
    head.add(antenna);

    // arms: small nubs at the lower sides
    const arms = [-1, 1].map(s => {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.42, -0.22, 0.12);
      const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.14, 6, 12), shell);
      arm.position.y = -0.1; arm.castShadow = true;
      pivot.add(arm); head.add(pivot);
      return pivot;
    });

    // thruster: a dark nozzle with a warm glow under it
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.08, 24), darkMat);
    nozzle.position.y = -0.42; head.add(nozzle);
    const thrust = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,236,200,1)', 'rgba(255,150,110,.7)', 'rgba(255,120,80,0)'), transparent: true, depthWrite: false, opacity: 0.9 }));
    thrust.position.y = -0.56; thrust.scale.set(0.5, 0.5, 1);
    head.add(thrust);

    // trail: soft flame lobes that follow the head with a little lag
    const trail = new THREE.Group();
    view.add(trail);
    const flameGlow = glowTexture('rgba(255,170,130,.55)', 'rgba(255,140,100,.28)', 'rgba(255,120,80,0)');
    const lobes = LOBES.map(def => {
      const m = new THREE.Mesh(lobeGeometry(def), lobeMat);
      m.castShadow = m.receiveShadow = true;
      m.position.set(lobeX(def), def.at[1], def.at[2]);
      const dir = v(1, 0, 0).applyAxisAngle(v(0, 0, 1), def.pitch).applyAxisAngle(v(0, 1, 0), -def.yaw);
      m.quaternion.setFromUnitVectors(v(0, 1, 0), dir);
      trail.add(m);
      // a soft halo behind each lobe takes the hard edge off the geometry
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameGlow, transparent: true, depthWrite: false, opacity: 0.7 }));
      trail.add(glow);
      return { m, def, dir, glow };
    });
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,190,150,.5)', 'rgba(255,150,110,.22)', 'rgba(255,130,90,0)'), transparent: true, depthWrite: false, opacity: 0.6 }));
    halo.position.set(-1.25, -0.05, -0.2); halo.scale.set(2.4, 1.3, 1);
    trail.add(halo);
    const ember = new THREE.PointLight('#FF8E62', 2.2, 3.2, 1.6);
    ember.position.set(-0.75, -0.12, 0.25);
    trail.add(ember);

    // effects
    const fxGroup = new THREE.Group();
    view.add(fxGroup);
    const spark = new THREE.Group();
    for (const [x, y, a] of [[0.05, 0.95, 0.25], [0.38, 0.87, -0.5], [0.62, 0.62, -1.1]]) {
      const c = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.15, 4, 10), coralMat);
      c.position.set(x, y, 0.2); c.rotation.z = a; spark.add(c);
    }
    const question = textSprite('?', CORAL, 0.6); question.position.set(0.5, 1.0, 0.2);
    const zzz = new THREE.Group();
    for (let i = 0; i < 3; i++) zzz.add(textSprite('z', CORAL, 0.3));
    fxGroup.add(spark, question, zzz);

    // embers: little coral drops shed from the trail
    const emberGeo = new THREE.CapsuleGeometry(0.03, 0.16, 4, 10);
    const dust = Array.from({ length: 20 }, () => {
      const m = new THREE.Mesh(emberGeo, new THREE.MeshPhysicalMaterial({ color: '#FF8A66', roughness: 0.35, clearcoat: 0.8, transparent: true, emissive: '#FF6A48', emissiveIntensity: 0.2 }));
      m.visible = false; m.rotation.z = Math.PI / 2; view.add(m);
      return { m, life: 0, max: 1, vel: v(0, 0, 0) };
    });

    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.0), new THREE.MeshBasicMaterial({ map: glowTexture('rgba(27,47,91,.3)', 'rgba(27,47,91,.12)', 'rgba(27,47,91,0)'), transparent: true, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.set(0, -1.35, 0);
    scene.add(shadow);

    const io = new IntersectionObserver(([e]) => { this.#r.visible = e.isIntersecting; this.#wake(); });
    const ro = new ResizeObserver(() => this.#resize());
    document.addEventListener('visibilitychange', () => this.#wake());

    this.#r = {
      renderer, scene, camera, view, head, trail, lobes, halo, arms, antenna, thrust, fxGroup, shadow, faceCtx, faceTex,
      fxMap: { spark, question, zzz }, dust, dustAcc: 0,
      clock: new THREE.Clock(), io, ro, raf: 0, visible: true, plays: [],
      pose: { x: 0, y: 0, yaw: 0, pitch: 0.12, roll: 0, flap: 1 }, prevHead: v(0.82, 0.3, 0), speed: 0,
      trailPos: v(0.82, 0.3, 0), trailQ: new THREE.Quaternion(), trailScale: 1, armAngle: 0, armTarget: 0,
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
    drawFace(r.faceCtx, r.face, t, { lid, glance: r.glance });
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
    const target = { x: 0, y: 0, yaw: 0, pitch: 0, roll: 0, flap: 1, ...(still ? { pitch: 0.12 } : POSES[r.mood.pose](t, now - r.moodT0)) };
    for (const p of [...r.plays]) {
      const u = (now - p.t0) / PLAYS[p.name];
      if (u >= 1) { r.plays.splice(r.plays.indexOf(p), 1); p.res(); continue; }
      const o = PLAY_FNS[p.name](u);
      for (const k in o) target[k] = k === 'flap' ? Math.max(target[k], o[k]) : target[k] + o[k];
    }
    const playing = r.plays.length > 0;
    const k = 1 - Math.exp(-dt * (playing ? 26 : 9));
    const P = r.pose;
    for (const key of ['x', 'y', 'flap']) P[key] += (target[key] - P[key]) * k;
    for (const key of ['yaw', 'pitch', 'roll']) P[key] += wrap(target[key] - P[key]) * k;

    // look toward the pointer: the head turns a little and the eyes glance further
    const pa = this.#pointer.active && !still;
    const lk = 1 - Math.exp(-dt * 5);
    r.look.yaw += ((pa ? this.#pointer.x * 0.45 : 0) - r.look.yaw) * lk;
    r.look.pitch += ((pa ? this.#pointer.y * 0.3 : 0) - r.look.pitch) * lk;
    r.glance[0] += ((pa ? this.#pointer.x * 0.05 : 0) - r.glance[0]) * lk;
    r.glance[1] += ((pa ? -this.#pointer.y * 0.035 : 0) - r.glance[1]) * lk;

    // whole-bot rotation: drag with inertia, or rotateTo(), easing back to rest
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

    // place the head
    const H = r.head;
    H.position.set(0.82 + P.x, 0.3 + P.y, 0);
    const qPose = new THREE.Quaternion().setFromEuler(new THREE.Euler(P.roll, P.yaw, P.pitch, 'YZX'));
    const qLook = new THREE.Quaternion().setFromEuler(new THREE.Euler(r.look.pitch, r.look.yaw, 0, 'YXZ'));
    H.quaternion.copy(qLook).multiply(qPose);
    const popU = Math.min(1, (now - r.pop) / 0.35);
    H.scale.setScalar(1 + 0.08 * Math.sin(Math.PI * popU) * (1 - popU));
    const speed = H.position.distanceTo(r.prevHead) / Math.max(dt, 1e-3);
    r.speed += (Math.min(3, speed) - r.speed) * (1 - Math.exp(-dt * 6));
    r.prevHead.copy(H.position);

    // arms
    const armPose = { rest: 0.25, up: -2.3, wave: -2.6, limp: 0.55 }[r.mood.arms ?? 'rest'];
    r.armAngle += (armPose - r.armAngle) * (1 - Math.exp(-dt * 7));
    r.arms.forEach((a, i) => {
      const s = i ? 1 : -1, wave = r.mood.arms === 'wave' && !still ? 0.35 * Math.sin(t * 9 + i * 2) : 0;
      a.rotation.set(0, 0, s * (r.armAngle + wave));
      a.rotation.x = r.armAngle < 0 ? -0.3 : 0.15;
    });

    // antenna bobs on its own
    r.antenna.position.set(-0.1, 0.62 + 0.03 * Math.sin(t * 2.6), 0);
    r.antenna.rotation.z = -0.55 + 0.1 * Math.sin(t * 1.9);

    this.#updateTrail(t, dt, still);
    this.#updateDust(dt, still);

    // thruster
    const drive = Math.min(1.4, 0.3 + 0.35 * P.flap) * (r.mood.thrust ?? 1);
    r.thrust.material.opacity = Math.min(1, 0.6 * drive + 0.1 * Math.sin(t * 23));
    r.thrust.scale.set(0.5 + 0.4 * drive, 0.45 + 0.45 * drive, 1);

    // shadow tracks the head
    r.scene.updateMatrixWorld();
    const hw = H.getWorldPosition(v(0, 0, 0));
    r.shadow.position.x = hw.x - 0.35;
    r.shadow.scale.setScalar(Math.max(0.55, 1 - (hw.y - 0.3) * 0.35));
    r.shadow.material.opacity = Math.min(1, Math.max(0.35, 1 - (hw.y - 0.3) * 0.5));

    // eyes: blink, glance, live faces
    if (!still && BLINKS.has(r.face) && now > r.blinkAt) { r.blinkT = now; r.blinkAt = now + 2.2 + Math.random() * 4; }
    const bu = (now - r.blinkT) / 0.16;
    const lid = bu >= 0 && bu < 1 ? 1 - 0.9 * Math.sin(Math.PI * bu) : 1;
    this.#drawFace(t, BLINKS.has(r.face) ? lid : 1);

    // effects sit above the head but don't swing with its circling
    r.fxGroup.position.set(0.82, 0.3 + Math.max(P.y, -0.1), 0);
    const { spark, question, zzz } = r.fxMap;
    if (r.mood.fx === 'spark') { const u = still ? 0.5 : (t * 1.3) % 1; spark.visible = u < 0.85; spark.scale.setScalar(u < 0.3 ? 0.01 + smooth(u / 0.3) : 1); }
    if (r.mood.fx === 'question') { question.material.rotation = 0.25 * Math.sin(t * 3.5); question.position.y = 1.0 + 0.05 * Math.sin(t * 2.2); }
    if (r.mood.fx === 'zzz') zzz.children.forEach((z, i) => {
      const u = still ? (i + 1) / 4 : (t / 3 + i / 3) % 1;
      z.position.set(0.3 + u * 0.4, 0.75 + u * 0.7, 0.2); z.scale.setScalar(0.16 + u * 0.2);
      z.material.opacity = still ? 1 : Math.sin(Math.PI * u);
    });

    r.renderer.render(r.scene, r.camera);
    const settling = Math.abs(VR.vx) + Math.abs(VR.vy) > 0.001 || Math.abs(VR.x) + Math.abs(wrap(VR.y)) > 0.001;
    if (!still || playing || this.#drag || settling) this.#wake();
  };

  #updateTrail(t, dt, still) {
    const r = this.#r, H = r.head, P = r.pose;
    // the trail follows the head with a little lag, so turns and dashes leave it streaming behind
    const kp = still ? 1 : 1 - Math.exp(-dt * 12), kq = still ? 1 : 1 - Math.exp(-dt * 7);
    r.trailPos.lerp(H.position, kp);
    r.trailQ.slerp(H.quaternion, kq);
    r.trail.position.copy(r.trailPos);
    r.trail.quaternion.copy(r.trailQ);
    const size = (r.mood.trail ?? 1) * (1 + 0.18 * Math.min(2, P.flap - 1)) * (1 + 0.25 * r.speed);
    r.trailScale += (size - r.trailScale) * (1 - Math.exp(-dt * 5));
    const flutter = still ? 0 : 1;
    // screen-space angle of the trail, so the halos stretch along it
    const fwd = v(1, 0, 0).applyQuaternion(r.trailQ).applyEuler(r.view.rotation);
    const ang = Math.atan2(fwd.y, fwd.x);
    for (const { m, def, dir, glow } of r.lobes) {
      const w = 1 + flutter * 0.06 * Math.sin(t * (4 + P.flap) + def.ph);
      const sway = flutter * 0.05 * Math.sin(t * 2.3 + def.ph);
      m.scale.set(1 + sway * 0.5, r.trailScale * w, 1 - sway * 0.5);
      m.position.set(lobeX(def) * (0.85 + 0.15 * r.trailScale), def.at[1] + flutter * 0.02 * Math.sin(t * 3.1 + def.ph), def.at[2]);
      const L = def.len * r.trailScale * w;
      glow.position.set(m.position.x - dir.x * L * 0.45, m.position.y - dir.y * L * 0.45, def.at[2] - 0.05);
      glow.scale.set(L * 1.15, def.rad * 2.6, 1);
      glow.material.rotation = ang + def.pitch;
    }
    r.halo.scale.set(2.4 * r.trailScale, 1.3, 1); r.halo.material.rotation = ang;
  }

  #updateDust(dt, still) {
    const r = this.#r, rate = still ? 0 : (r.mood.dust ?? 1) * 3;
    r.dustAcc += rate * dt;
    const back = v(-1, 0, 0).applyQuaternion(r.trailQ);
    while (r.dustAcc >= 1) {
      r.dustAcc -= 1;
      const p = r.dust.find(d => d.life <= 0);
      if (!p) break;
      const lobe = r.lobes[Math.floor(Math.random() * r.lobes.length)];
      const local = v(lobeX(lobe.def), lobe.def.at[1], lobe.def.at[2]).addScaledVector(lobe.dir, -lobe.def.len * r.trailScale * (0.7 + Math.random() * 0.6));
      p.m.position.copy(local.applyQuaternion(r.trailQ).add(r.trailPos));
      p.vel.copy(back).multiplyScalar(0.9 + Math.random() * 0.8).add(v((Math.random() - 0.5) * 0.2, (Math.random() - 0.4) * 0.25, (Math.random() - 0.5) * 0.3));
      p.life = p.max = 0.9 + Math.random() * 0.8;
      p.m.quaternion.copy(r.trailQ); p.m.rotateZ(Math.PI / 2);
      p.m.visible = true;
    }
    for (const p of r.dust) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { p.m.visible = false; continue; }
      p.m.position.addScaledVector(p.vel, dt);
      const u = p.life / p.max;
      p.m.scale.setScalar(0.5 + 0.8 * Math.sin(Math.PI * u));
      p.m.material.opacity = Math.min(1, u * 1.6);
    }
  }
}

if (!customElements.get('paper-comet')) customElements.define('paper-comet', PaperComet);
