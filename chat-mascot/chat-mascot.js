/*
 * <chat-mascot> — an origami fish mascot for an AI chat button.
 *
 * Usage:
 *   <script type="module" src="chat-mascot.js"></script>
 *   <chat-mascot mood="idle" size="64" follow-pointer></chat-mascot>
 *
 *   const m = document.querySelector('chat-mascot');
 *   m.mood = 'thinking';          // persistent mood
 *   m.react('happy', 1500);       // temporary mood, then back to the previous one
 *   m.play('wiggle');             // one-shot body animation
 *
 * Moods:  idle smile happy wink excited thinking talking laughing confused
 *         cool sleepy determined starstruck surprised sad
 * Plays:  wiggle jump spin dash nod
 *
 * Add `compact` for small sizes (≤ 72px, e.g. inside a chat button): tighter framing, bigger face.
 *
 * CSS hooks: --mascot-ink (eyes/face), --mascot-accent (!, ?, dots, z).
 * Dependency-free. Respects prefers-reduced-motion.
 */

const MOODS = {
  idle:       { face: 'eyes',      anim: 'float' },
  smile:      { face: 'smile',     anim: 'float' },
  happy:      { face: 'happy',     anim: 'bounce' },
  wink:       { face: 'wink',      anim: 'float' },
  excited:    { face: 'excited',   anim: 'hop',   fx: 'spark' },
  thinking:   { face: 'lookup',    anim: 'swim',  fx: 'dots' },
  talking:    { face: 'talk',      anim: 'float' },
  laughing:   { face: 'laugh',     anim: 'shake' },
  confused:   { face: 'eyes',      anim: 'tilt',  fx: 'question' },
  cool:       { face: 'cool',      anim: 'float' },
  sleepy:     { face: 'sleep',     anim: 'drift', fx: 'zzz' },
  determined: { face: 'brows',     anim: 'swim' },
  starstruck: { face: 'stars',     anim: 'bounce' },
  surprised:  { face: 'surprised', anim: 'jolt',  fx: 'spark' },
  sad:        { face: 'sad',       anim: 'sink' },
};

const PLAYS = {
  wiggle: [[0, 0, 0], [0, 0, -12], [0, 0, 10], [0, 0, -8], [0, 0, 5], [0, 0, 0]],
  jump:   [[0, 0, 0], [0, 3, 0, 1.08, 0.9], [0, -14, -6], [0, -16, -4], [0, 2, 0, 1.06, 0.93], [0, 0, 0]],
  spin:   [[0, 0, 0], [0, -6, 180], [0, 0, 360]],
  dash:   [[0, 0, 0], [-6, 0, 4], [18, -2, -4], [-3, 0, 0], [0, 0, 0]],
  nod:    [[0, 0, 0], [0, 1, 10], [0, 0, 0], [0, 1, 10], [0, 0, 0]],
};
const PLAY_MS = { wiggle: 650, jump: 700, spin: 650, dash: 650, nod: 700 };

const EYE_L = [76, 40.5];
const EYE_R = [87, 42.5];

const eye = (cx, cy, rx, ry, cls = 'eye') =>
  `<g class="${cls}"><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" class="ink"/>` +
  `<circle cx="${cx - rx * 0.32}" cy="${cy - ry * 0.42}" r="${rx * 0.33}" class="shine"/></g>`;
const eyes = (dx = 0, dy = 0, s = 1) =>
  eye(EYE_L[0] + dx, EYE_L[1] + dy, 2.9 * s, 4.4 * s) + eye(EYE_R[0] + dx, EYE_R[1] + dy, 2.6 * s, 4.1 * s);
const line = d => `<path d="${d}" class="line"/>`;
const star = (cx, cy, rx, ry) =>
  `<path class="shine" d="M${cx} ${cy - ry}Q${cx} ${cy} ${cx + rx} ${cy}Q${cx} ${cy} ${cx} ${cy + ry}` +
  `Q${cx} ${cy} ${cx - rx} ${cy}Q${cx} ${cy} ${cx} ${cy - ry}Z"/>`;

const FACES = {
  eyes: eyes(),
  lookup: eyes(-1.2, -1.8),
  smile: eyes() + line('M80.4 49.2q2.3 1.9 4.6 0'),
  happy: line('M73 42.2q3-4.4 6 0') + line('M84.3 44.2q2.7-4 5.4 0'),
  wink: eye(...EYE_L, 2.9, 4.4) + line('M84.3 43.4q2.7-3.2 5.4 0'),
  sleep: line('M73 40.4q3 3.2 6 0') + line('M84.3 42.4q2.7 3 5.4 0'),
  excited: eyes() + `<path class="ink" d="M79.2 48.2q3.3 .9 6.4 .4q-.5 4.2-3.4 4.3q-2.6 0-3-4.7z"/>` +
    `<path class="tongue" d="M80.6 51.4q1.7-1.1 3.6.1q-.9 1.4-1.9 1.4q-1.1 0-1.7-1.5z"/>`,
  talk: eyes() + `<g class="mouth"><ellipse cx="82.4" cy="50.4" rx="2" ry="1.7" class="ink"/></g>`,
  laugh: line('M73.4 37.6l4.4 2.9l-4.4 2.9') + line('M89.8 39.6l-4.2 2.9l4.2 2.9') +
    `<path class="ink" d="M78.6 47.6q3.6 1 7.2.4q-.6 4.8-3.8 4.9q-2.9 0-3.4-5.3z"/>` +
    `<path class="tongue" d="M80.2 51.3q1.9-1.2 4 .1q-1 1.6-2.1 1.6q-1.2 0-1.9-1.7z"/>`,
  surprised: eye(EYE_L[0], EYE_L[1], 3.4, 3.8) + eye(EYE_R[0], EYE_R[1], 3.1, 3.5) +
    `<ellipse cx="82.2" cy="51" rx="1.3" ry="1.6" class="ink"/>`,
  brows: eye(EYE_L[0], EYE_L[1] + .8, 2.9, 3.5) + eye(EYE_R[0], EYE_R[1] + .8, 2.6, 3.3) +
    line('M72.2 34.6l6.6 2.6') + line('M90.8 36.4l-5.6 2.4'),
  sad: eye(EYE_L[0], EYE_L[1] + .6, 2.6, 3.8) + eye(EYE_R[0], EYE_R[1] + .6, 2.4, 3.5) +
    line('M72.6 36.6l5.6-2') + line('M90 37.8l-4.6-1.4') + line('M80.4 50.6q2.2-1.6 4.4 0'),
  stars: `<ellipse cx="${EYE_L[0]}" cy="${EYE_L[1]}" rx="3.2" ry="4.4" class="ink"/>` +
    `<ellipse cx="${EYE_R[0]}" cy="${EYE_R[1]}" rx="2.9" ry="4.1" class="ink"/>` +
    star(EYE_L[0], EYE_L[1], 2, 3) + star(EYE_R[0], EYE_R[1], 1.8, 2.8),
  cool: `<g transform="translate(-1.6 1.4) rotate(-1 82 43)"><path class="ink" d="M69.6 37.4L93.6 41.4q.4 .2 .2 .8l-1.2 4.4q-.4 1.6-2.2 1.4l-3.6-.6q-1.6-.3-1.6-1.9v-1.3` +
    `q-1.2-.8-2.6-.6l-.6 1.4q-.6 1.4-2.2 1.2l-5.6-.9q-1.7-.3-1.8-2l-.3-3.3q-1.1-.3-2-.1z"/>` +
    `<path d="M74.8 39.6l2.6 4.4M87.4 41.8l1.8 3" class="glint"/></g>`,
};

const FX = {
  spark: `<g class="fx-spark"><path d="M90.4 27.6l-.8-5.2"/><path d="M94.2 28.8l3.2-4"/><path d="M96.6 32.6l5-1.4"/></g>`,
  question: `<g class="fx-q"><text x="94" y="28">?</text></g>`,
  dots: `<g class="fx-dots"><circle cx="62" cy="11" r="2"/><circle cx="69" cy="11" r="2"/><circle cx="76" cy="11" r="2"/></g>`,
  zzz: `<g class="fx-z"><text x="90" y="27">z</text><text x="90" y="27">z</text><text x="90" y="27">z</text></g>`,
};

const poly = (pts, fill, cls = '') =>
  `<polygon class="p ${cls}" points="${pts}" fill="${fill}" stroke="${fill}"/>`;

const BODY = `
  <g class="fin f1">${poly('2,44 26,31 46,29 22,41', 'url(#s1)')}</g>
  <g class="fin f2">${poly('6,57 24,48 46,47 28,56', 'url(#s2)')}</g>
  <g class="fin f3">${poly('24,69 38,61 60,60 46,68', 'url(#s3)')}</g>
  <g class="fin f4">${poly('32,21 38,17.5 49,17 45,21 36,22.5', '#FF9476')}</g>
  ${poly('16,37 66,17 54,40 28,43', 'url(#top)')}
  ${poly('20,45 54,40 44,54 18,52', 'url(#deep)')}
  ${poly('66,17 96,49 54,40', 'url(#cream)')}
  ${poly('54,40 96,49 74,63', 'url(#cream2)')}
  ${poly('54,40 40,57 70,62', 'url(#cheek)')}
  <polyline points="66,17 54,40 96,49" class="crease"/>`;

const DEFS = `<defs>
  <linearGradient id="cream" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFDFB"/><stop offset="1" stop-color="#FBE9DD"/></linearGradient>
  <linearGradient id="cream2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F3D8C6"/><stop offset="1" stop-color="#FDEEE4"/></linearGradient>
  <linearGradient id="top" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#FFB49A"/><stop offset="1" stop-color="#FF8466"/></linearGradient>
  <linearGradient id="deep" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F2694F"/><stop offset="1" stop-color="#D9452F"/></linearGradient>
  <linearGradient id="cheek" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF8A6A"/><stop offset="1" stop-color="#FFA586"/></linearGradient>
  <linearGradient id="s1" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFC9B4" stop-opacity=".15"/><stop offset="1" stop-color="#FFB49A"/></linearGradient>
  <linearGradient id="s2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FF8A6E" stop-opacity=".3"/><stop offset="1" stop-color="#F0583F"/></linearGradient>
  <linearGradient id="s3" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFA184" stop-opacity=".35"/><stop offset="1" stop-color="#FF8A6A"/></linearGradient>
</defs>`;

const STYLE = `
:host { display: inline-block; width: 64px; aspect-ratio: 100 / 80; line-height: 0; vertical-align: middle;
  --mascot-ink: #1F2A3A; --mascot-accent: #FF6B4A; }
:host([compact]) { aspect-ratio: 84 / 72; }
:host([hidden]) { display: none; }
svg { width: 100%; height: 100%; overflow: visible; }
* { transform-box: fill-box; }
.p { stroke-width: .7; stroke-linejoin: round; }
.crease { fill: none; stroke: #fff; stroke-opacity: .55; stroke-width: .4; }
.ink { fill: var(--mascot-ink); }
.shine { fill: #fff; }
.tongue { fill: #FF7A68; }
.line { fill: none; stroke: var(--mascot-ink); stroke-width: 1.35; stroke-linecap: round; stroke-linejoin: round; }
.glint { fill: none; stroke: #fff; stroke-opacity: .55; stroke-width: .7; stroke-linecap: round; }
.eye, .mouth { transform-origin: center; }

.rig, .actor { transform-origin: 60% 55%; }
.actor { filter: drop-shadow(0 .8px 1.2px rgba(190, 80, 50, .22)); }
.look { transition: transform .25s ease-out; }
.zoom { transform-box: view-box; transform-origin: 82px 44px; }
:host([compact]) .zoom { transform: scale(1.3); }
.face, .fx > g { display: none; }
.face.on, .fx > g.on { display: inline; }
.face.on { transform-origin: center; animation: pop .28s cubic-bezier(.3,1.6,.5,1); }

.shadow { fill: #E07A5F; opacity: .2; transform-origin: center; }
.fin { transform-origin: right center; animation: flap var(--flap, 1.4s) ease-in-out infinite; }
.f2 { animation-delay: -.25s; } .f3 { animation-delay: -.5s; } .f4 { animation-delay: -.7s; }

/* body animations, keyed off data-anim */
[data-anim=float]  .rig { animation: float 3.2s ease-in-out infinite; }
[data-anim=float]  .shadow { animation: shadow 3.2s ease-in-out infinite; }
[data-anim=bounce] .rig { animation: bounce .9s cubic-bezier(.3,.7,.4,1) infinite; }
[data-anim=bounce] .shadow { animation: shadow .9s cubic-bezier(.3,.7,.4,1) infinite; }
[data-anim=hop]    .rig { animation: hop .55s ease-out infinite; }
[data-anim=hop]    .shadow { animation: shadow .55s ease-out infinite; }
[data-anim=swim]   { --flap: .45s; }
[data-anim=swim]   .rig { animation: swim 1.1s ease-in-out infinite; }
[data-anim=tilt]   .rig { animation: tilt 2.6s ease-in-out infinite; }
[data-anim=shake]  .rig { animation: shake .4s ease-in-out infinite; }
[data-anim=drift]  { --flap: 3s; }
[data-anim=drift]  .rig { animation: drift 5s ease-in-out infinite; }
[data-anim=drift]  .shadow { animation: shadow 5s ease-in-out infinite; }
[data-anim=sink]   { --flap: 2.6s; }
[data-anim=sink]   .rig { animation: sink 4s ease-in-out infinite; }
[data-anim=jolt]   .rig { animation: jolt .5s ease-out both; }

.mouth { animation: talk .32s ease-in-out infinite alternate; }

.fx-spark path { stroke: var(--mascot-accent); stroke-width: 1.5; stroke-linecap: round; fill: none;
  transform-origin: left bottom; animation: spark .9s ease-out infinite; }
.fx-spark path:nth-child(2) { animation-delay: .08s; } .fx-spark path:nth-child(3) { animation-delay: .16s; }
.fx-q text { fill: var(--mascot-accent); font: 800 13px/1 system-ui, sans-serif; transform-origin: center bottom;
  animation: wobble 1.6s ease-in-out infinite; }
.fx-dots circle { fill: var(--mascot-accent); animation: dot 1.1s ease-in-out infinite; }
.fx-dots circle:nth-child(2) { animation-delay: .15s; } .fx-dots circle:nth-child(3) { animation-delay: .3s; }
.fx-z text { fill: var(--mascot-accent); font: 800 8px/1 system-ui, sans-serif; opacity: 0;
  animation: zz 3s ease-out infinite; }
.fx-z text:nth-child(2) { animation-delay: 1s; } .fx-z text:nth-child(3) { animation-delay: 2s; }

@keyframes pop    { from { transform: scale(.55); } to { transform: none; } }
@keyframes flap   { 0%,100% { transform: none; } 50% { transform: translateX(-1.8px) scaleX(1.07) skewY(-2deg); } }
@keyframes float  { 0%,100% { transform: translateY(0) rotate(0); } 50% { transform: translateY(-3px) rotate(-1.5deg); } }
@keyframes shadow { 0%,100% { transform: scaleX(1); opacity: .2; } 50% { transform: scaleX(.82); opacity: .12; } }
@keyframes bounce { 0%,100% { transform: translateY(0) scale(1.04,.96); } 45% { transform: translateY(-7px) scale(.98,1.03) rotate(-3deg); } }
@keyframes hop    { 0%,100% { transform: translateY(0); } 40% { transform: translateY(-6px) rotate(-5deg); } }
@keyframes swim   { 0%,100% { transform: translateX(0) rotate(0); } 50% { transform: translateX(3px) rotate(-2.5deg); } }
@keyframes tilt   { 0%,100% { transform: rotate(-9deg); } 50% { transform: rotate(-12deg) translateY(-1.5px); } }
@keyframes shake  { 0%,100% { transform: rotate(-4deg) translateY(-1px); } 50% { transform: rotate(4deg) translateY(1px); } }
@keyframes drift  { 0%,100% { transform: translateY(1px) rotate(5deg); } 50% { transform: translateY(-1.5px) rotate(3deg); } }
@keyframes sink   { 0%,100% { transform: translateY(3px) rotate(7deg); } 50% { transform: translateY(4.5px) rotate(8deg); } }
@keyframes jolt   { 0% { transform: none; } 35% { transform: translate(-5px,-6px) rotate(-8deg); } 100% { transform: translate(-2px,-2px) rotate(-4deg); } }
@keyframes talk   { from { transform: scale(1,.35); } to { transform: scale(1.1,1.15); } }
@keyframes spark  { 0% { transform: scale(0); opacity: 0; } 30% { transform: scale(1.1); opacity: 1; } 70%,100% { transform: scale(1); opacity: 0; } }
@keyframes wobble { 0%,100% { transform: rotate(-12deg) translateY(0); } 50% { transform: rotate(10deg) translateY(-2px); } }
@keyframes dot    { 0%,60%,100% { transform: translateY(0); opacity: .45; } 30% { transform: translateY(-3px); opacity: 1; } }
@keyframes zz     { 0% { transform: translate(0,0) scale(.6); opacity: 0; } 20% { opacity: 1; } 100% { transform: translate(9px,-20px) scale(1.3); opacity: 0; } }

@media (prefers-reduced-motion: reduce) {
  .rig, .shadow, .fin, .mouth, .fx * { animation: none !important; }
  .fx-z text { opacity: 1; }
  .fx-z text:nth-child(2) { transform: translate(4px,-8px); } .fx-z text:nth-child(3) { transform: translate(8px,-16px); }
}`;

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export class ChatMascot extends HTMLElement {
  static observedAttributes = ['mood', 'size', 'follow-pointer', 'compact'];

  #svg; #look; #reactTimer; #blinkTimer; #raf = 0; #restoreMood = null;

  constructor() {
    super();
    const root = this.attachShadow({ mode: 'open' });
    const faces = Object.entries(FACES)
      .map(([k, v]) => `<g class="face" data-face="${k}">${v}</g>`).join('');
    root.innerHTML = `<style>${STYLE}</style>
      <svg viewBox="0 0 100 80" aria-hidden="true" focusable="false">${DEFS}
        <ellipse class="shadow" cx="56" cy="75" rx="28" ry="2.4"/>
        <g class="rig"><g class="actor">${BODY}
          <g class="look"><g class="zoom">${faces}</g></g>
          <g class="fx">${Object.entries(FX).map(([k, v]) => v.replace('<g ', `<g data-fx="${k}" `)).join('')}</g>
        </g></g>
      </svg>`;
    this.#svg = root.querySelector('svg');
    this.#look = root.querySelector('.look');
  }

  connectedCallback() {
    if (!this.hasAttribute('mood')) this.#apply('idle');
    this.#scheduleBlink();
    if (this.hasAttribute('follow-pointer')) addEventListener('pointermove', this.#onPointer, { passive: true });
  }

  disconnectedCallback() {
    clearTimeout(this.#blinkTimer);
    clearTimeout(this.#reactTimer);
    cancelAnimationFrame(this.#raf);
    removeEventListener('pointermove', this.#onPointer);
  }

  attributeChangedCallback(name, _old, value) {
    if (name === 'mood') this.#apply(value);
    if (name === 'compact') this.#svg.setAttribute('viewBox', value === null ? '0 0 100 80' : '20 4 84 72');
    if (name === 'size') this.style.width = /^\d+$/.test(value ?? '') ? `${value}px` : (value ?? '');
    if (name === 'follow-pointer' && this.isConnected) {
      removeEventListener('pointermove', this.#onPointer);
      if (value !== null) addEventListener('pointermove', this.#onPointer, { passive: true });
      else this.#look.style.transform = '';
    }
  }

  get mood() { return this.getAttribute('mood') || 'idle'; }
  set mood(v) {
    clearTimeout(this.#reactTimer);
    this.#restoreMood = null;
    this.setAttribute('mood', v);
  }

  static get moods() { return Object.keys(MOODS); }
  static get plays() { return Object.keys(PLAYS); }

  /** Show a mood for `ms`, then return to the mood that was set before. */
  react(mood, ms = 1400) {
    clearTimeout(this.#reactTimer);
    this.#restoreMood ??= this.mood;
    this.setAttribute('mood', mood);
    return new Promise(resolve => {
      this.#reactTimer = setTimeout(() => {
        const back = this.#restoreMood;
        this.#restoreMood = null;
        this.setAttribute('mood', back);
        resolve();
      }, ms);
    });
  }

  /** One-shot body animation layered on top of the current mood. */
  play(name) {
    const frames = PLAYS[name];
    if (!frames || reducedMotion()) return Promise.resolve();
    const anim = this.shadowRoot.querySelector('.actor').animate(frames.map(([x, y, r, sx = 1, sy = 1]) =>
      ({ transform: `translate(${x}px,${y}px) rotate(${r}deg) scale(${sx},${sy})` })),
      { duration: PLAY_MS[name], easing: 'ease-in-out' });
    return anim.finished.catch(() => {});
  }

  #apply(mood) {
    const m = MOODS[mood] ?? MOODS.idle;
    this.#svg.dataset.anim = m.anim;
    for (const g of this.shadowRoot.querySelectorAll('.face'))
      g.classList.toggle('on', g.dataset.face === m.face);
    for (const g of this.shadowRoot.querySelectorAll('.fx > g'))
      g.classList.toggle('on', g.dataset.fx === m.fx);
  }

  #scheduleBlink() {
    clearTimeout(this.#blinkTimer);
    this.#blinkTimer = setTimeout(() => {
      if (!reducedMotion()) {
        for (const e of this.shadowRoot.querySelectorAll('.face.on .eye'))
          e.animate([{ transform: 'scaleY(1)' }, { transform: 'scaleY(.08)' }, { transform: 'scaleY(1)' }],
            { duration: 170, easing: 'ease-in-out' });
      }
      this.#scheduleBlink();
    }, 2200 + Math.random() * 4200);
  }

  #onPointer = e => {
    if (this.#raf) return;
    this.#raf = requestAnimationFrame(() => {
      this.#raf = 0;
      const r = this.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width * 0.8);
      const dy = e.clientY - (r.top + r.height * 0.5);
      const d = Math.hypot(dx, dy) || 1;
      const k = Math.min(1, d / 300);
      this.#look.style.transform = `translate(${(dx / d) * 2 * k}px, ${(dy / d) * 1.6 * k}px)`;
    });
  };
}

if (!customElements.get('chat-mascot')) customElements.define('chat-mascot', ChatMascot);
