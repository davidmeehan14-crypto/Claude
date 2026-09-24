/* The Wedding Chapter — launch film engine.
 *
 * Everything is a pure function of time t (seconds). Scenes register with
 * FILM.addScene({ name, start, end, draw(ctx, t, lt, dur) }) and draw the FULL
 * frame (including background) for any t in [start, end). lt = t - start.
 * Scenes may overlap; later-registered scenes draw on top.
 *
 * Coordinates: 1920×1080 canvas, origin top-left.
 * Characters are positioned by their bottom-centre (feet on the ground).
 */
(function () {
  const W = 1920, H = 1080, FPS = 30, DURATION = 60;
  const PAL = {
    paper: '#F6F0E6', paperShade: '#EADFCB', paperBack: '#E9DCC4', ink: '#16161D',
    coral: '#FF5A4E', coralShade: '#D9392F', cobalt: '#2E4BFF', cobaltShade: '#1B2FC4',
    gold: '#FFC247', goldShade: '#E09A12', blush: '#FFB3C1', mint: '#3DDC97',
    lilac: '#B8A4FF', red: '#FF2D55', acid: '#D7FF3A', white: '#FFFFFF',
  };
  const FONT = {
    display: '"Fraunces", Georgia, serif',
    ui: '"Inter", system-ui, sans-serif',
    label: '"Space Grotesk", "Inter", sans-serif',
    hand: '"Caveat", cursive',
  };

  // ───────────────────────────── math ─────────────────────────────
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, p) => a + (b - a) * p;
  const invLerp = (a, b, v) => clamp((v - a) / (b - a));
  const TAU = Math.PI * 2;
  const ease = {
    linear: p => p,
    inQuad: p => p * p, outQuad: p => 1 - (1 - p) * (1 - p),
    inOutQuad: p => (p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2),
    inCubic: p => p * p * p, outCubic: p => 1 - Math.pow(1 - p, 3),
    inOutCubic: p => (p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2),
    inQuart: p => p ** 4, outQuart: p => 1 - Math.pow(1 - p, 4),
    inOutQuart: p => (p < .5 ? 8 * p ** 4 : 1 - Math.pow(-2 * p + 2, 4) / 2),
    inExpo: p => (p === 0 ? 0 : Math.pow(2, 10 * p - 10)),
    outExpo: p => (p === 1 ? 1 : 1 - Math.pow(2, -10 * p)),
    inOutExpo: p => p === 0 ? 0 : p === 1 ? 1 : p < .5 ? Math.pow(2, 20 * p - 10) / 2 : (2 - Math.pow(2, -20 * p + 10)) / 2,
    inOutSine: p => -(Math.cos(Math.PI * p) - 1) / 2,
    outSine: p => Math.sin(p * Math.PI / 2), inSine: p => 1 - Math.cos(p * Math.PI / 2),
    outBack: (p, s = 1.70158) => 1 + (s + 1) * Math.pow(p - 1, 3) + s * Math.pow(p - 1, 2),
    inBack: (p, s = 1.70158) => (s + 1) * p * p * p - s * p * p,
    outElastic: p => p === 0 ? 0 : p === 1 ? 1 : Math.pow(2, -10 * p) * Math.sin((p * 10 - .75) * (TAU / 3)) + 1,
    outBounce: p => {
      const n = 7.5625, d = 2.75;
      if (p < 1 / d) return n * p * p;
      if (p < 2 / d) return n * (p -= 1.5 / d) * p + .75;
      if (p < 2.5 / d) return n * (p -= 2.25 / d) * p + .9375;
      return n * (p -= 2.625 / d) * p + .984375;
    },
  };
  /** remap time v from [a,b] to [c,d] with easing (clamped). */
  const remap = (v, a, b, c = 0, d = 1, e = ease.linear) => lerp(c, d, e(invLerp(a, b, v)));
  /** Damped spring step response: 0 at dt<=0, overshoots, settles to 1. */
  function spring(dt, freq = 3.2, damp = 0.28) {
    if (dt <= 0) return 0;
    const w = TAU * freq;
    return 1 - Math.exp(-damp * w * dt) * Math.cos(w * Math.sqrt(1 - damp * damp) * dt);
  }
  /** Decaying oscillation 0→(±1)→0, handy for wobble/jiggle after an impact at dt=0. */
  function jiggle(dt, freq = 4, decay = 5) {
    if (dt <= 0) return 0;
    return Math.sin(TAU * freq * dt) * Math.exp(-decay * dt);
  }
  /** 0→1→0 pulse between a and b. */
  const pulse = (t, a, b) => (t < a || t > b ? 0 : Math.sin(Math.PI * (t - a) / (b - a)));

  // seeded randomness / noise
  function hash(n) { // deterministic 0..1 from any number(s)
    let x = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
    return x - Math.floor(x);
  }
  const hash2 = (a, b) => hash(a * 12.9898 + b * 78.233);
  function rng(seed) { // mulberry32
    let s = (seed * 2654435761) >>> 0;
    return function () {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      let r = Math.imul(s ^ (s >>> 15), 1 | s);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  function noise1(x, seed = 0) { // smooth value noise −1..1
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return lerp(hash2(i, seed), hash2(i + 1, seed), u) * 2 - 1;
  }
  function noise2(x, y, seed = 0) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    const h = (a, b) => hash(a * 157.31 + b * 113.97 + seed * 71.13);
    return lerp(lerp(h(ix, iy), h(ix + 1, iy), ux), lerp(h(ix, iy + 1), h(ix + 1, iy + 1), ux), uy) * 2 - 1;
  }
  /** "Boil" frame index: hand-drawn line wobble updates at 12 fps. */
  const boil = (t, fps = 12) => Math.floor(t * fps + 1e-6);
  /** Camera/impact shake offset. */
  function shake(t, amount, seed = 1, freq = 22) {
    return [noise1(t * freq, seed) * amount, noise1(t * freq, seed + 17) * amount];
  }

  // ───────────────────────────── ink shapes ─────────────────────────────
  /** Draw a smooth closed curve through points (midpoint quadratic). */
  function smoothClosed(ctx, pts) {
    const n = pts.length;
    ctx.beginPath();
    const m0 = [(pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2];
    ctx.moveTo(m0[0], m0[1]);
    for (let i = 0; i < n; i++) {
      const p = pts[i], q = pts[(i + 1) % n];
      ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    }
    ctx.closePath();
  }
  function smoothOpen(ctx, pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length - 1; i++) {
      const p = pts[i], q = pts[i + 1];
      ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
    }
    const l = pts[pts.length - 1];
    ctx.lineTo(l[0], l[1]);
  }
  /** Perturb points with boiling noise (amp px). */
  function wobble(pts, t, seed = 0, amp = 1.4) {
    const b = boil(t);
    return pts.map((p, i) => [p[0] + (hash2(b * 7 + i, seed) - .5) * 2 * amp, p[1] + (hash2(b * 7 + i, seed + 3.3) - .5) * 2 * amp]);
  }
  function circlePts(cx, cy, r, n = 28) {
    const out = [];
    for (let i = 0; i < n; i++) { const a = i / n * TAU; out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); }
    return out;
  }
  function ellipsePts(cx, cy, rx, ry, n = 28) {
    const out = [];
    for (let i = 0; i < n; i++) { const a = i / n * TAU; out.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
    return out;
  }
  function roundRectPts(x, y, w, h, r, n = 56) {
    r = Math.min(r, w / 2, h / 2);
    const segs = [], per = [w - 2 * r, Math.PI * r / 2, h - 2 * r, Math.PI * r / 2, w - 2 * r, Math.PI * r / 2, h - 2 * r, Math.PI * r / 2];
    const total = per.reduce((a, b) => a + b, 0);
    for (let i = 0; i < n; i++) {
      let d = i / n * total, k = 0;
      while (d > per[k] && k < 7) { d -= per[k]; k++; }
      let px, py;
      switch (k) {
        case 0: px = x + r + d; py = y; break;
        case 1: { const a = -Math.PI / 2 + d / r; px = x + w - r + Math.cos(a) * r; py = y + r + Math.sin(a) * r; break; }
        case 2: px = x + w; py = y + r + d; break;
        case 3: { const a = d / r; px = x + w - r + Math.cos(a) * r; py = y + h - r + Math.sin(a) * r; break; }
        case 4: px = x + w - r - d; py = y + h; break;
        case 5: { const a = Math.PI / 2 + d / r; px = x + r + Math.cos(a) * r; py = y + h - r + Math.sin(a) * r; break; }
        case 6: px = x; py = y + h - r - d; break;
        default: { const a = Math.PI + d / r; px = x + r + Math.cos(a) * r; py = y + r + Math.sin(a) * r; }
      }
      segs.push([px, py]);
    }
    return segs;
  }
  /** Filled + inked wobbly shape. opts: {fill, stroke=ink, lw=5, t, seed, amp} */
  function inkShape(ctx, pts, o = {}) {
    const p = wobble(pts, o.t || 0, o.seed || 0, o.amp == null ? 1.4 : o.amp);
    smoothClosed(ctx, p);
    if (o.fill) { ctx.fillStyle = o.fill; ctx.fill(); }
    if (o.lw !== 0) { ctx.lineWidth = o.lw || 5; ctx.strokeStyle = o.stroke || PAL.ink; ctx.lineJoin = 'round'; ctx.stroke(); }
    return p;
  }
  /** Hand-inked line through points (open). */
  function inkLine(ctx, pts, o = {}) {
    const p = wobble(pts, o.t || 0, o.seed || 0, o.amp == null ? 1.0 : o.amp);
    smoothOpen(ctx, p);
    ctx.lineWidth = o.lw || 5; ctx.strokeStyle = o.stroke || PAL.ink; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.stroke();
  }
  /** Draw only part of a polyline (0..1) — for "drawing on" lines. */
  function partialPolyline(pts, p) {
    if (p >= 1) return pts;
    const lens = [0];
    for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const target = lens[lens.length - 1] * clamp(p);
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      if (lens[i] <= target) out.push(pts[i]);
      else { const f = (target - lens[i - 1]) / (lens[i] - lens[i - 1] || 1); out.push([lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)]); break; }
    }
    return out;
  }

  // ───────────────────────────── paper & post ─────────────────────────────
  const _cache = {};
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  /** Named persistent offscreen canvas (created once). */
  function offscreen(key, w = W, h = H) {
    const c = _cache['off:' + key];
    if (c && c.width === w && c.height === h) return c;
    return (_cache['off:' + key] = canvas(w, h));
  }
  function paperTexture() {
    if (_cache.paper) return _cache.paper;
    const c = canvas(W, H), g = c.getContext('2d');
    g.fillStyle = PAL.paper; g.fillRect(0, 0, W, H);
    const r = rng(42);
    // soft fibrous blotches
    for (let i = 0; i < 70; i++) {
      const x = r() * W, y = r() * H, rad = 80 + r() * 320;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      const a = 0.025 + r() * 0.035;
      gr.addColorStop(0, `rgba(190,160,110,${a})`); gr.addColorStop(1, 'rgba(190,160,110,0)');
      g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    // fibres
    g.lineWidth = 1;
    for (let i = 0; i < 900; i++) {
      const x = r() * W, y = r() * H, l = 6 + r() * 26, a = r() * TAU;
      g.strokeStyle = `rgba(120,95,60,${0.03 + r() * 0.05})`;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * .5 + r() * 4, y + Math.sin(a) * l * .5 + r() * 4, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    // vignette-ish edge warmth
    const vg = g.createRadialGradient(W / 2, H / 2, H * .35, W / 2, H / 2, H * 1.05);
    vg.addColorStop(0, 'rgba(160,120,70,0)'); vg.addColorStop(1, 'rgba(160,120,70,0.16)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    return (_cache.paper = c);
  }
  /** Fill the frame with cream paper. tint (optional css colour) multiplies over it. */
  function paper(ctx, o = {}) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(paperTexture(), 0, 0);
    if (o.tint) { ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = o.tintAlpha == null ? 1 : o.tintAlpha; ctx.fillStyle = o.tint; ctx.fillRect(0, 0, W, H); }
    ctx.restore();
  }
  function grainTiles() {
    if (_cache.grain) return _cache.grain;
    const tiles = [];
    for (let k = 0; k < 6; k++) {
      const c = canvas(256, 256), g = c.getContext('2d'), img = g.createImageData(256, 256), r = rng(900 + k);
      for (let i = 0; i < img.data.length; i += 4) { const v = r() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
      g.putImageData(img, 0, 0); tiles.push(c);
    }
    return (_cache.grain = tiles);
  }
  function grainFrames() { // full-frame pre-tiled grain canvases (built once)
    if (_cache.grainF) return _cache.grainF;
    return (_cache.grainF = grainTiles().map(tile => {
      const c = canvas(W, H), g = c.getContext('2d');
      g.fillStyle = g.createPattern(tile, 'repeat'); g.fillRect(0, 0, W, H); return c;
    }));
  }
  function grain(ctx, t, amount = 0.07) {
    const fr = grainFrames(), k = boil(t, 24);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = amount; ctx.globalCompositeOperation = 'overlay';
    ctx.drawImage(fr[k % fr.length], 0, 0);
    ctx.restore();
  }
  function vignette(ctx, amount = 0.35, color = '22,22,29') {
    const key = 'vig:' + amount + ':' + color;
    if (!_cache[key]) {
      const c = canvas(W, H), g = c.getContext('2d');
      const gr = g.createRadialGradient(W / 2, H / 2, H * .45, W / 2, H / 2, H * 1.1);
      gr.addColorStop(0, `rgba(${color},0)`); gr.addColorStop(1, `rgba(${color},${amount})`);
      g.fillStyle = gr; g.fillRect(0, 0, W, H); _cache[key] = c;
    }
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(_cache[key], 0, 0); ctx.restore();
  }
  /** Apply camera: zoom about (cx,cy) focus, then optional rotation (radians) and shake. */
  function camera(ctx, o = {}) {
    const z = o.zoom || 1, fx = o.x == null ? W / 2 : o.x, fy = o.y == null ? H / 2 : o.y;
    ctx.translate(W / 2 + (o.dx || 0), H / 2 + (o.dy || 0));
    if (o.rot) ctx.rotate(o.rot);
    ctx.scale(z, z);
    ctx.translate(-fx, -fy);
  }

  // ───────────────────────────── dialogue / lip-sync ─────────────────────────────
  function lines() { return (window.DIALOGUE || []); }
  function lineAt(speaker, t) { return lines().find(l => l.speaker === speaker && t >= l.start && t < l.end); }
  /** Mouth openness 0..1 for a speaker at time t (from the voice envelope). */
  function mouth(speaker, t) {
    const l = lineAt(speaker, t);
    if (!l || !l.env || !l.env.length) return 0;
    const f = (t - l.start) * FPS, i = Math.floor(f), a = l.env[Math.min(i, l.env.length - 1)] || 0, b = l.env[Math.min(i + 1, l.env.length - 1)] || 0;
    return clamp(lerp(a, b, f - i));
  }
  const talking = (speaker, t) => !!lineAt(speaker, t);
  /** Natural auto-blink: returns 0..1 eyelid closure. */
  function blink(t, seed = 0) {
    const period = 2.6 + hash(seed) * 1.6, ph = ((t + hash(seed + 1) * period) % period);
    return ph < 0.14 ? Math.sin(ph / 0.14 * Math.PI) : 0;
  }

  // ───────────────────────────── characters ─────────────────────────────
  /*
   * Character state s:
   *  x,y       bottom-centre (ground contact) in current transform
   *  scale     overall size (1 = hero size)
   *  sx, sy    squash/stretch (applied about the feet), e.g. sy=.8 sx=1.2 on landing
   *  rot       lean (radians) about the feet
   *  look      [lx, ly] pupil direction −1..1
   *  blink     0..1 eyelids (omit → auto-blink)
   *  mouth     0..1 openness (omit → from dialogue for that speaker)
   *  mood      'neutral' | 'happy' | 'joy' | 'shock' | 'worried' | 'panic' | 'love' | 'shy' | 'sad' | 'angry' | 'closed'
   *  blush     0..1
   *  armL,armR [dx, dy] hand position relative to shoulder (local, unscaled px)
   *  walk      phase in cycles (legs swing) — or null for standing
   *  legs      false to hide legs (e.g. sitting, kneeling handled via kneel)
   *  kneel     0..1 drops the body down onto one knee
   *  face      −1..1 turns the face left/right (shifts features)
   *  t         time (for line boil); seed for variety
   *  holdR / holdL  optional function(ctx) drawn at that hand (e.g. a ring box)
   */
  function limb(ctx, x0, y0, x1, y1, bend, t, seed, lw) {
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
    const cx = mx - dy / L * bend, cy = my + dx / L * bend;
    const pts = [];
    for (let i = 0; i <= 8; i++) { const u = i / 8; pts.push([(1 - u) * (1 - u) * x0 + 2 * (1 - u) * u * cx + u * u * x1, (1 - u) * (1 - u) * y0 + 2 * (1 - u) * u * cy + u * u * y1]); }
    inkLine(ctx, pts, { t, seed, lw, amp: .6 });
  }
  function drawEyes(ctx, s, ex, ey, er, gap) {
    const t = s.t || 0, mood = s.mood || 'neutral';
    const bl = s.blink == null ? blink(t, s.seed || 0) : s.blink;
    const lx = (s.look ? s.look[0] : 0), ly = (s.look ? s.look[1] : 0);
    const big = mood === 'shock' || mood === 'panic' ? 1.25 : 1;
    for (const side of [-1, 1]) {
      const cx = ex + side * gap, cy = ey;
      if (mood === 'love') { // heart eyes
        ctx.save(); ctx.translate(cx, cy); const k = er * 1.15 * (1 + .12 * Math.sin(t * 14));
        heartPath(ctx, 0, k * .1, k * 2.1); ctx.fillStyle = PAL.red; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = PAL.ink; ctx.stroke(); ctx.restore();
        continue;
      }
      if (mood === 'joy' || mood === 'closed' || bl > .92) { // ^ ^ or closed
        ctx.beginPath(); ctx.lineWidth = Math.max(3, er * .28); ctx.lineCap = 'round'; ctx.strokeStyle = PAL.ink;
        if (mood === 'joy') { ctx.moveTo(cx - er * .8, cy + er * .25); ctx.quadraticCurveTo(cx, cy - er * .9, cx + er * .8, cy + er * .25); }
        else { ctx.moveTo(cx - er * .8, cy); ctx.quadraticCurveTo(cx, cy + er * .45, cx + er * .8, cy); }
        ctx.stroke(); continue;
      }
      const rx = er * .85 * big, ry = er * big * (1 - bl * .9);
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill();
      ctx.lineWidth = Math.max(2.5, er * .16); ctx.strokeStyle = PAL.ink; ctx.stroke();
      if (ry > 2) {
        ctx.save(); ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); ctx.clip();
        const pr = er * (mood === 'shock' || mood === 'panic' ? .32 : .5);
        const px = cx + lx * (rx - pr) * .8, py = cy + ly * (ry - pr) * .8 + (mood === 'shy' ? er * .25 : 0);
        ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.fillStyle = PAL.ink; ctx.fill();
        ctx.beginPath(); ctx.arc(px - pr * .35, py - pr * .4, pr * .32, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill();
        ctx.restore();
      }
      // brows
      if (mood === 'worried' || mood === 'panic' || mood === 'sad' || mood === 'angry') {
        ctx.beginPath(); ctx.lineWidth = Math.max(3, er * .22); ctx.lineCap = 'round'; ctx.strokeStyle = PAL.ink;
        const by = cy - ry - er * .45, k = mood === 'angry' ? 1 : -1; // worried: inner ends raised
        ctx.moveTo(cx - side * er * .2, by + k * er * .3); ctx.lineTo(cx + side * er * .85, by - k * er * .15);
        ctx.stroke();
      }
    }
  }
  function drawMouth(ctx, s, mx, my, mw, speaker) {
    const t = s.t || 0, mood = s.mood || 'neutral';
    const m = s.mouth == null ? mouth(speaker, t) : s.mouth;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = PAL.ink;
    if (m > .06 || mood === 'shock' || mood === 'panic') {
      const open = Math.max(m, mood === 'shock' ? .55 : mood === 'panic' ? .45 : 0);
      const w = mw * (mood === 'shock' ? .55 : .8 + open * .15), h = mw * (.12 + open * .55);
      ctx.save(); ctx.translate(mx, my);
      ctx.beginPath();
      if (mood === 'joy' || mood === 'happy' || mood === 'love') { // D-shaped open grin
        ctx.moveTo(-w / 2, -h * .2); ctx.quadraticCurveTo(0, -h * .45, w / 2, -h * .2); ctx.quadraticCurveTo(w * .45, h * 1.1, 0, h * 1.05); ctx.quadraticCurveTo(-w * .45, h * 1.1, -w / 2, -h * .2);
      } else ctx.ellipse(0, h * .3, w / 2, h / 1.6, 0, 0, TAU);
      ctx.fillStyle = '#3a0e14'; ctx.fill();
      ctx.save(); ctx.clip(); ctx.beginPath(); ctx.ellipse(0, h * 1.0, w * .32, h * .45, 0, 0, TAU); ctx.fillStyle = '#ff7a8a'; ctx.fill(); ctx.restore();
      ctx.lineWidth = Math.max(3, mw * .09); ctx.stroke(); ctx.restore();
      return;
    }
    ctx.beginPath(); ctx.lineWidth = Math.max(3, mw * .1);
    if (mood === 'sad' || mood === 'worried') { // wavy/frown
      ctx.moveTo(mx - mw * .4, my + mw * .12); ctx.quadraticCurveTo(mx - mw * .2, my - mw * .06, mx, my + mw * .04); ctx.quadraticCurveTo(mx + mw * .2, my + mw * .14, mx + mw * .4, my - mw * .02);
    } else if (mood === 'shy') {
      ctx.moveTo(mx - mw * .18, my); ctx.quadraticCurveTo(mx, my + mw * .14, mx + mw * .18, my);
    } else {
      const k = mood === 'happy' || mood === 'joy' || mood === 'love' ? .32 : .2;
      ctx.moveTo(mx - mw * .38, my - mw * .02); ctx.quadraticCurveTo(mx, my + mw * k * 1.4, mx + mw * .38, my - mw * .02);
    }
    ctx.stroke();
  }
  function drawBlush(ctx, s, cx, cy, gap, r) {
    const b = s.blush || 0; if (b <= 0) return;
    ctx.save(); ctx.globalAlpha = clamp(b) * .85; ctx.fillStyle = PAL.blush;
    for (const side of [-1, 1]) { ctx.beginPath(); ctx.ellipse(cx + side * gap, cy, r, r * .55, 0, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  function legsAndArms(ctx, s, bodyBottom, halfW, shoulderY, t, seed, sc) {
    const lw = 5;
    // legs
    if (s.legs !== false) {
      const kneel = s.kneel || 0;
      const ph = s.walk == null ? null : s.walk * TAU;
      for (const side of [-1, 1]) {
        const hipX = side * halfW * .38, swing = ph == null ? 0 : Math.sin(ph + (side > 0 ? Math.PI : 0)) * 14;
        const lift = ph == null ? 0 : Math.max(0, Math.cos(ph + (side > 0 ? Math.PI : 0))) * 8;
        let fx = hipX + swing + side * 4, fy = -lift;
        if (kneel > 0 && side < 0) { fx = hipX - 34 * kneel; fy = -lift; }
        if (kneel > 0 && side > 0) { fx = hipX + 22 * kneel; fy = 0; }
        limb(ctx, hipX, bodyBottom - 4, fx, fy, side * 3, t, seed + side * 5, lw);
        // foot
        ctx.beginPath(); ctx.ellipse(fx + side * 7, fy - 3, 11, 6, 0, 0, TAU); ctx.fillStyle = PAL.ink; ctx.fill();
      }
    }
    // arms
    for (const side of [-1, 1]) {
      const def = [side * 30, 46];
      const a = (side < 0 ? s.armL : s.armR) || def;
      const sx0 = side * halfW * .92, sy0 = shoulderY;
      const hx = sx0 + a[0], hy = sy0 + a[1];
      limb(ctx, sx0, sy0, hx, hy, (a[2] == null ? side * -10 : a[2]), t, seed + 20 + side, lw);
      ctx.beginPath(); ctx.arc(hx, hy, 8.5, 0, TAU); ctx.fillStyle = PAL.ink; ctx.fill();
      const hold = side < 0 ? s.holdL : s.holdR;
      if (hold) { ctx.save(); ctx.translate(hx, hy); hold(ctx); ctx.restore(); }
    }
  }
  function charBegin(ctx, s) {
    ctx.save();
    ctx.translate(s.x || 0, s.y || 0);
    if (s.rot) ctx.rotate(s.rot);
    const sc = s.scale == null ? 1 : s.scale;
    ctx.scale(sc * (s.sx || 1), sc * (s.sy || 1));
    if (s.alpha != null) ctx.globalAlpha *= s.alpha;
    if (s.kneel) ctx.translate(0, 22 * s.kneel);
  }
  /** Dot: coral circle. */
  function drawDot(ctx, s = {}) {
    const t = s.t || 0, seed = s.seed == null ? 11 : s.seed, R = 70, legH = 24, face = s.face || 0;
    charBegin(ctx, s);
    const cy = -legH - R;
    // arms behind? no — limbs drawn first so body overlaps the joints
    legsAndArms(ctx, s, -legH + 2, R * 1.05, cy + R * .15, t, seed, 1);
    // body
    const pts = circlePts(0, cy, R, 30);
    const body = inkShape(ctx, pts, { fill: s.fill || PAL.coral, t, seed, amp: 1.3, lw: 0 });
    ctx.save(); smoothClosed(ctx, body); ctx.clip();
    ctx.beginPath(); ctx.ellipse(R * .35, cy + R * .45, R * 1.05, R * .75, -.5, 0, TAU); ctx.fillStyle = s.shade || PAL.coralShade; ctx.globalAlpha = .55; ctx.fill(); ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.ellipse(-R * .45, cy - R * .5, R * .2, R * .12, -.6, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fill();
    ctx.restore();
    smoothClosed(ctx, body); ctx.lineWidth = 5; ctx.strokeStyle = PAL.ink; ctx.stroke();
    // face
    const fx = face * R * .28;
    drawBlush(ctx, s, fx, cy + R * .12, R * .5, R * .17);
    drawEyes(ctx, s, fx, cy - R * .18, R * .25, R * .32);
    drawMouth(ctx, s, fx, cy + R * .3, R * .42, s.speaker || 'dot');
    // tiny hair curl (ink)
    inkLine(ctx, [[-4, cy - R + 2], [-10, cy - R - 16], [4, cy - R - 26], [10, cy - R - 14], [0, cy - R - 10]], { t, seed: seed + 9, lw: 4.5 });
    ctx.restore();
  }
  /** Dash: cobalt upright capsule. */
  function drawDash(ctx, s = {}) {
    const t = s.t || 0, seed = s.seed == null ? 23 : s.seed, BW = 92, BH = 176, legH = 26, face = s.face || 0;
    charBegin(ctx, s);
    const top = -legH - BH;
    legsAndArms(ctx, s, -legH + 2, BW / 2, top + BH * .42, t, seed, 1);
    const pts = roundRectPts(-BW / 2, top, BW, BH, BW / 2, 60);
    const body = inkShape(ctx, pts, { fill: s.fill || PAL.cobalt, t, seed, amp: 1.3, lw: 0 });
    ctx.save(); smoothClosed(ctx, body); ctx.clip();
    ctx.beginPath(); ctx.ellipse(BW * .42, top + BH * .75, BW * .6, BH * .6, -.2, 0, TAU); ctx.fillStyle = s.shade || PAL.cobaltShade; ctx.globalAlpha = .55; ctx.fill(); ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.ellipse(-BW * .22, top + BH * .12, BW * .12, BW * .07, -.5, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fill();
    ctx.restore();
    smoothClosed(ctx, body); ctx.lineWidth = 5; ctx.strokeStyle = PAL.ink; ctx.stroke();
    const fx = face * BW * .22;
    drawBlush(ctx, s, fx, top + BH * .37, BW * .32, BW * .12);
    drawEyes(ctx, s, fx, top + BH * .22, BW * .15, BW * .2);
    drawMouth(ctx, s, fx, top + BH * .42, BW * .32, s.speaker || 'dash');
    // cowlick
    inkLine(ctx, [[6, top + 2], [14, top - 18], [26, top - 22]], { t, seed: seed + 9, lw: 4.5 });
    ctx.restore();
  }
  /** Biscuit: small gold dog. s.wag (cycles), s.bark 0..1, s.dir 1/-1 facing. */
  function drawBiscuit(ctx, s = {}) {
    const t = s.t || 0, seed = s.seed == null ? 37 : s.seed;
    charBegin(ctx, s);
    const dir = s.dir || 1; ctx.scale(dir, 1);
    const legH = 14, bw = 96, bh = 58, top = -legH - bh;
    // legs
    for (const lx of [-32, -16, 18, 32]) {
      const ph = s.walk == null ? 0 : Math.sin(s.walk * TAU + (lx > 0 ? 0 : Math.PI) + (Math.abs(lx) > 20 ? .6 : 0)) * 6;
      inkLine(ctx, [[lx, top + bh - 6], [lx + ph, 0]], { t, seed: seed + lx, lw: 6 });
    }
    // tail
    const wag = Math.sin((s.wag == null ? t * 3 : s.wag) * TAU) * .6;
    ctx.save(); ctx.translate(-bw / 2 + 4, top + 16); ctx.rotate(-.8 + wag);
    inkLine(ctx, [[0, 0], [-8, -12], [-6, -24]], { t, seed: seed + 3, lw: 7 }); ctx.restore();
    // body
    inkShape(ctx, roundRectPts(-bw / 2, top, bw, bh, 26, 48), { fill: PAL.gold, t, seed, lw: 5 });
    // head
    const hx = bw * .42, hy = top - 6, hr = 34;
    const earFlop = s.earFlop || 0;
    for (const e of [-1, 1]) {
      ctx.save(); ctx.translate(hx + e * 18, hy - hr * .7); ctx.rotate(e * .5 + earFlop * e * .9);
      inkShape(ctx, [[-10, 6], [0, -24], [12, 6]], { fill: PAL.goldShade, t, seed: seed + e, lw: 4.5, amp: .8 });
      ctx.restore();
    }
    inkShape(ctx, circlePts(hx, hy, hr, 26), { fill: PAL.gold, t, seed: seed + 5, lw: 5 });
    // snout & face
    ctx.beginPath(); ctx.ellipse(hx + 16, hy + 10, 16, 11, 0, 0, TAU); ctx.fillStyle = '#FFE3A3'; ctx.fill();
    ctx.beginPath(); ctx.ellipse(hx + 24, hy + 4, 6.5, 5, 0, 0, TAU); ctx.fillStyle = PAL.ink; ctx.fill();
    const bl = s.blink == null ? blink(t, seed) : s.blink;
    for (const e of [-1, 1]) {
      const ex = hx + e * 11 + 2, ey = hy - 8;
      if (s.mood === 'joy' || bl > .9) { ctx.beginPath(); ctx.lineWidth = 3.5; ctx.strokeStyle = PAL.ink; ctx.moveTo(ex - 5, ey + 2); ctx.quadraticCurveTo(ex, ey - 5, ex + 5, ey + 2); ctx.stroke(); }
      else { ctx.beginPath(); ctx.arc(ex, ey, 5.5, 0, TAU); ctx.fillStyle = PAL.ink; ctx.fill(); ctx.beginPath(); ctx.arc(ex - 1.6, ey - 2, 1.8, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill(); }
    }
    const bark = s.bark || 0;
    if (bark > .05) { ctx.beginPath(); ctx.ellipse(hx + 16, hy + 20, 9, 4 + bark * 9, 0, 0, TAU); ctx.fillStyle = '#3a0e14'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = PAL.ink; ctx.stroke(); }
    else if (s.tongue) { ctx.beginPath(); ctx.ellipse(hx + 14, hy + 25, 6, 9, 0, 0, TAU); ctx.fillStyle = '#ff7a8a'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = PAL.ink; ctx.stroke(); }
    // collar
    ctx.beginPath(); ctx.lineWidth = 6; ctx.strokeStyle = PAL.coral; ctx.moveTo(hx - 26, hy + 20); ctx.quadraticCurveTo(hx - 6, hy + 34, hx + 12, hy + 30); ctx.stroke();
    ctx.beginPath(); ctx.arc(hx - 4, hy + 34, 5, 0, TAU); ctx.fillStyle = PAL.gold; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = PAL.ink; ctx.stroke();
    if (s.hold) { ctx.save(); ctx.translate(hx + 18, hy + 26); s.hold(ctx); ctx.restore(); }
    ctx.restore();
  }

  // ───────────────────────────── small props ─────────────────────────────
  function heartPath(ctx, x, y, s) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * .35);
    ctx.bezierCurveTo(x - s * .05, y + s * .3, x - s * .5, y + s * .05, x - s * .5, y - s * .18);
    ctx.bezierCurveTo(x - s * .5, y - s * .42, x - s * .22, y - s * .5, x, y - s * .28);
    ctx.bezierCurveTo(x + s * .22, y - s * .5, x + s * .5, y - s * .42, x + s * .5, y - s * .18);
    ctx.bezierCurveTo(x + s * .5, y + s * .05, x + s * .05, y + s * .3, x, y + s * .35);
    ctx.closePath();
  }
  function heart(ctx, x, y, size, fill = PAL.red, lw = 4) {
    heartPath(ctx, x, y, size); ctx.fillStyle = fill; ctx.fill();
    if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = PAL.ink; ctx.lineJoin = 'round'; ctx.stroke(); }
  }
  /** 4-point sparkle star. */
  function sparkle(ctx, x, y, r, fill = PAL.gold, rot = 0) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      ctx.quadraticCurveTo(0, 0, Math.cos(a + Math.PI / 2) * r, Math.sin(a + Math.PI / 2) * r);
    }
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.restore();
  }
  /** Deterministic confetti burst. origin (x,y), started at t0. Returns nothing; draws. */
  function confetti(ctx, t, t0, o = {}) {
    const dt = t - t0; if (dt < 0) return;
    const n = o.n || 140, r = rng(o.seed || 7), cols = o.colors || [PAL.coral, PAL.cobalt, PAL.gold, PAL.mint, PAL.lilac, PAL.blush];
    const g = o.gravity == null ? 900 : o.gravity;
    for (let i = 0; i < n; i++) {
      const ang = (o.angle == null ? -Math.PI / 2 : o.angle) + (r() - .5) * (o.spread || 2.2);
      const sp = (o.speed || 1400) * (.35 + r() * .75), drag = 1.6 + r() * 1.2;
      const k = (1 - Math.exp(-drag * dt)) / drag;
      const x = o.x + Math.cos(ang) * sp * k + Math.sin(dt * (2 + r() * 3) + i) * 18 * Math.min(1, dt);
      const y = o.y + Math.sin(ang) * sp * k + g * .35 * dt * dt / (1 + dt * .9) * 1.0;
      const w = 10 + r() * 14, h = 6 + r() * 8, spin = (r() - .5) * 18, col = cols[Math.floor(r() * cols.length)];
      if (y > H + 60) continue;
      ctx.save(); ctx.translate(x, y); ctx.rotate(spin * dt + i);
      ctx.scale(1, Math.cos(dt * (6 + r() * 6) + i));
      ctx.fillStyle = col;
      if (i % 5 === 0) { ctx.beginPath(); ctx.arc(0, 0, h * .7, 0, TAU); ctx.fill(); }
      else ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.restore();
    }
  }

  // ───────────────────────────── text ─────────────────────────────
  function font(ctx, size, family = FONT.display, weight = 900, style = 'normal') {
    ctx.font = `${style} ${weight} ${size}px ${family}`;
  }
  /** Typewriter text: shows first ceil(p*len) chars; caret while typing. */
  function typeText(ctx, str, x, y, p, o = {}) {
    const n = Math.floor(clamp(p) * str.length + 1e-6), s = str.slice(0, n);
    ctx.fillStyle = o.color || PAL.ink; ctx.textBaseline = o.baseline || 'alphabetic'; ctx.textAlign = o.align || 'left';
    ctx.fillText(s, x, y);
    if (o.caret !== false && p > 0 && p < 1.02) {
      const w = ctx.measureText(s).width, size = parseFloat(/(\d+)px/.exec(ctx.font)[1]);
      if (boil(o.t || 0, 4) % 2 === 0 || p < 1) { ctx.fillRect(x + (ctx.textAlign === 'center' ? w / 2 : w) + 4, y - size * .75, 3, size * .9); }
    }
  }
  /** Storybook chapter caption, top-left: italic Fraunces, types on, ink underline draws, then fades. */
  function chapterCaption(ctx, text, lt, o = {}) {
    const typeDur = o.typeDur || .7, hold = o.hold == null ? 1.1 : o.hold, fade = .25;
    const outA = o.persist ? 1 : 1 - invLerp(typeDur + hold, typeDur + hold + fade, lt);
    if (lt < 0 || outA <= 0) return;
    ctx.save(); ctx.globalAlpha *= outA;
    const x = o.x || 110, y = o.y || 150;
    const parts = text.split('|'); // "Chapter Two.|The first date."
    font(ctx, o.size || 44, FONT.display, 400, 'italic');
    typeText(ctx, parts[0], x, y, lt / (typeDur * (parts.length > 1 ? .45 : 1)), { t: lt, caret: parts.length === 1 });
    if (parts[1]) {
      font(ctx, o.size2 || 76, FONT.display, 900);
      typeText(ctx, parts[1], x, y + (o.size2 || 76) * 1.05, (lt - typeDur * .45) / (typeDur * .55), { t: lt });
    }
    const ul = remap(lt, typeDur * .6, typeDur + .25, 0, 1, ease.outCubic);
    if (ul > 0) inkLine(ctx, partialPolyline([[x, y + (parts[1] ? (o.size2 || 76) * 1.35 : 22)], [x + 180, y + (parts[1] ? (o.size2 || 76) * 1.32 : 20)], [x + 360, y + (parts[1] ? (o.size2 || 76) * 1.36 : 24)]], ul), { t: lt, lw: 4, stroke: o.lineColor || PAL.coral });
    ctx.restore();
  }

  // ───────────────────────────── page turn ─────────────────────────────
  /**
   * Page-turn transition. p 0..1. drawUnder(ctx) draws the next page, drawOver(ctx) the current
   * (turning) page. Fold sweeps from the right edge to the left with a curled back and shadows.
   * dir: 1 = turn to the left (forward), -1 = mirror (backward riffle).
   */
  function pageTurn(ctx, p, drawUnder, drawOver, o = {}) {
    const dir = o.dir || 1;
    const A = offscreen('pt_under'), B = offscreen('pt_over');
    const ga = A.getContext('2d'), gb = B.getContext('2d');
    ga.setTransform(1, 0, 0, 1, 0, 0); gb.setTransform(1, 0, 0, 1, 0, 0);
    ga.clearRect(0, 0, W, H); gb.clearRect(0, 0, W, H);
    ga.save(); drawUnder(ga); ga.restore(); gb.save(); drawOver(gb); gb.restore();
    ctx.save();
    if (dir < 0) { ctx.translate(W, 0); ctx.scale(-1, 1); }
    const flipImg = (img) => { if (dir < 0) { ctx.save(); ctx.translate(W, 0); ctx.scale(-1, 1); ctx.drawImage(img, 0, 0); ctx.restore(); } else ctx.drawImage(img, 0, 0); };
    if (p <= 0) { flipImg(B); ctx.restore(); return; }
    if (p >= 1) { flipImg(A); ctx.restore(); return; }
    // fold line: x position of the fold at top and bottom (slanted)
    const e = ease.inOutCubic(p);
    const fx = lerp(W + 200, -W * .55, e);
    const slant = 260 * Math.sin(Math.PI * p);
    const xTop = fx + slant, xBot = fx - slant * .3;
    // under page (right of fold)
    flipImg(A);
    // shadow cast on under page
    ctx.save();
    const sg = ctx.createLinearGradient(Math.min(xTop, xBot), 0, Math.min(xTop, xBot) + 180, 0);
    sg.addColorStop(0, 'rgba(22,22,29,.35)'); sg.addColorStop(1, 'rgba(22,22,29,0)');
    ctx.beginPath(); ctx.moveTo(xTop, 0); ctx.lineTo(W * 2, 0); ctx.lineTo(W * 2, H); ctx.lineTo(xBot, H); ctx.closePath(); ctx.fillStyle = sg; ctx.fill();
    ctx.restore();
    // current page (left of fold)
    ctx.save(); ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(xTop, 0); ctx.lineTo(xBot, H); ctx.lineTo(-10, H); ctx.closePath(); ctx.clip(); flipImg(B); ctx.restore();
    // curled flap (back of page) — mirror across the fold, narrower
    const flapW = Math.min(420, (W - fx) * .5) * Math.sin(Math.PI * Math.min(1, p * 1.2));
    ctx.save();
    ctx.beginPath(); ctx.moveTo(xTop, 0); ctx.lineTo(xTop - flapW * .9, 0); ctx.quadraticCurveTo(xTop - flapW * 1.1, H * .5, xBot - flapW * .8, H); ctx.lineTo(xBot, H); ctx.closePath();
    const fg = ctx.createLinearGradient(xTop - flapW, 0, xTop, 0);
    fg.addColorStop(0, '#fbf6ec'); fg.addColorStop(.6, PAL.paperBack); fg.addColorStop(1, '#cdbd9f');
    ctx.fillStyle = fg; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(22,22,29,.25)'; ctx.stroke();
    ctx.restore();
    ctx.restore();
  }

  // ───────────────────────────── subtitles ─────────────────────────────
  const SPEAKER = { dot: { name: 'DOT', col: PAL.coral }, dash: { name: 'DASH', col: PAL.cobalt }, narrator: { name: '', col: PAL.gold } };
  function subtitles(ctx, t) {
    const l = lines().find(l => t >= l.start - .05 && t < l.end + .45);
    if (!l) return;
    const scn = sceneAt(t), pos = scn && scn.subtitle ? scn.subtitle(t, l) : null;
    if (pos === false) return;
    const lt = t - l.start, dur = Math.max(.3, l.end - l.start);
    const words = l.text.split(/\s+/);
    const isN = l.speaker === 'narrator';
    const size = isN ? 58 : 52;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (isN) font(ctx, size, FONT.display, 400, 'italic'); else font(ctx, size, FONT.ui, 800);
    const space = ctx.measureText(' ').width * 1.3 + 6, widths = words.map(w => ctx.measureText(w).width);
    const total = widths.reduce((a, b) => a + b, 0) + space * (words.length - 1);
    const cx = pos && pos.x != null ? pos.x : W / 2, cy = pos && pos.y != null ? pos.y : H - 92;
    const out = 1 - invLerp(l.end + .2, l.end + .45, t);
    // word timing weighted by length
    const lens = words.map(w => w.length + 2), sum = lens.reduce((a, b) => a + b, 0);
    let acc = 0, x = cx - total / 2;
    ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    words.forEach((w, i) => {
      const wt = acc / sum * dur * .85; acc += lens[i];
      const k = spring(lt - wt + .04, 3.5, .45);
      if (k > 0) {
        ctx.save(); ctx.globalAlpha = clamp(k * 1.5) * out;
        ctx.translate(x + widths[i] / 2, cy + (1 - k) * 26); ctx.scale(.7 + .3 * k, .7 + .3 * k);
        ctx.textAlign = 'center';
        ctx.lineWidth = 12; ctx.strokeStyle = PAL.paper; ctx.strokeText(w, 0, 0);
        ctx.fillStyle = isN ? '#5A3A12' : PAL.ink; ctx.fillText(w, 0, 0);
        ctx.restore();
      }
      x += widths[i] + space;
    });
    if (!isN) { // speaker tag
      const sp = SPEAKER[l.speaker] || SPEAKER.dot, k = spring(lt + .05, 3, .5);
      ctx.globalAlpha = clamp(k) * out;
      font(ctx, 20, FONT.label, 700);
      const tw = ctx.measureText(sp.name).width + 26, tx = cx - total / 2 - tw - 18;
      ctx.fillStyle = sp.col; ctx.beginPath(); ctx.roundRect(tx, cy - 17, tw, 34, 17); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = PAL.ink; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(sp.name, tx + tw / 2, cy + 1);
    }
    ctx.restore();
  }

  // ───────────────────────────── scenes & rendering ─────────────────────────────
  const scenes = [];
  function addScene(s) { scenes.push(s); scenes.sort((a, b) => (a.layer || 0) - (b.layer || 0)); }
  function sceneAt(t) { let s = null; for (const sc of scenes) if (t >= sc.start && t < sc.end) s = sc; return s; }
  function renderScenes(ctx, t) {
    let any = false;
    for (const sc of scenes) {
      if (t >= sc.start && t < sc.end) {
        any = true;
        ctx.save();
        try { sc.draw(ctx, t, t - sc.start, sc.end - sc.start); }
        catch (e) { console.error('scene', sc.name, t, e); }
        ctx.restore();
      }
    }
    if (!any) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
  }
  /** Cached full-frame render of scene content at time ts (no grain/subtitles). */
  const snapCache = new Map();
  function snapshot(ts) {
    const key = Math.round(ts * 1000);
    if (snapCache.has(key)) return snapCache.get(key);
    const c = canvas(W, H), g = c.getContext('2d');
    renderScenes(g, ts);
    snapCache.set(key, c);
    if (snapCache.size > 40) snapCache.delete(snapCache.keys().next().value);
    return c;
  }
  let _ctx = null;
  function attach(cnv) { _ctx = cnv.getContext('2d'); return _ctx; }
  function renderFrame(t, ctx = _ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    renderScenes(ctx, t);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    subtitles(ctx, t);
    grain(ctx, t, 0.06);
  }

  window.FILM = {
    W, H, FPS, DURATION, PAL, FONT, TAU,
    clamp, lerp, invLerp, remap, ease, spring, jiggle, pulse, hash, hash2, rng, noise1, noise2, boil, shake,
    smoothClosed, smoothOpen, wobble, circlePts, ellipsePts, roundRectPts, inkShape, inkLine, partialPolyline,
    canvas, offscreen, paper, grain, vignette, camera,
    lines, lineAt, mouth, talking, blink,
    drawDot, drawDash, drawBiscuit, heartPath, heart, sparkle, confetti,
    font, typeText, chapterCaption, pageTurn, subtitles,
    scenes, addScene, sceneAt, renderScenes, snapshot, attach, renderFrame,
  };
})();
