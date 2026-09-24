/* Animator C — SPEC scenes 8 (Type B), 9 (Invitation scan), 10 (Question bubbles). 25.0–38.0 s.
 * Pure function of t. Timing constants below also generate data/cues/c_invite.json:
 *   node -e "require('fs').writeFileSync('data/cues/c_invite.json', JSON.stringify(require('./scenes/c_invite.js'),null,1))"
 */
(function () {
  // ───────────────────────── timing (absolute seconds) ─────────────────────────
  const TB = {
    w1: [25.0, 25.25, 25.5], split: 26.0, out1: 26.28,
    w2: [26.5, 26.625, 26.75], out2: 27.18,
    l3: 27.5, chap: 27.75, morph: [27.5, 27.75, 28.0, 28.25, 28.5], zoom: 28.75,
  };
  const MORPH = ['ring', 'envelope', 'cake', 'heart', 'ring'];
  const SC = {
    start: 29.0, snap: 29.5, sweep: 29.75, sweepEnd: 30.2, confirm: 30.25, found: 30.32,
    pull: 30.5, pullEnd: 31.1, sheet: 30.9, touchIn: 30.95, tap: 31.25, confirm2: 31.35,
    meals: [31.5, 31.6, 31.7], meal: 31.85, counterIn: 31.75, tick: 32.0, swipe: 32.75, swipeEnd: 33.1,
    objs: [30.9, 31.1],
  };
  const BUBBLES = [
    { t: 33.5, text: 'Who still needs to RSVP?', icon: 'guests', col: '#E6DCFB', x: 440, y: 290, side: -1, ans: '12 guests', aIcon: 'guests', aCol: '#A993EE' },
    { t: 34.0, text: 'How much is left for flowers?', icon: 'flower', col: '#FBD9E1', x: 1515, y: 250, side: 1, ans: '£640 left', aIcon: 'pound', aCol: '#C99A4B' },
    { t: 34.5, text: "When's the cake tasting?", icon: 'cake', col: '#FCE3CF', x: 425, y: 585, side: -1, ans: 'Thu 3pm', aIcon: 'calendar', aCol: '#E07A93' },
    { t: 35.0, text: "Where's Uncle Gary sitting?", icon: 'table', col: '#DCEFE0', x: 1505, y: 575, side: 1, ans: 'Table 9', aIcon: 'table', aCol: '#7FB892' },
    { t: 35.5, text: 'Have we booked the band?', icon: 'music', col: '#D9E7F7', x: 455, y: 875, side: -1, ans: 'Booked', aIcon: 'tick', aCol: '#5DBE8A' },
  ];
  const ANS_DELAY = 0.5;
  const TICKS = { flowers: 34.0, seating: 35.0, band: 36.0 };
  // scene-3 3D objects: [name, popT, x, y, size, blur]; ring/envelope carry over from scene 9
  const OBJ3 = [
    ['ring', null, 150, 185, 240, 3], ['envelope', null, 95, 520, 185, 5], ['coupe', 33.15, 1790, 165, 215, 5],
    ['star', 33.2, 655, 125, 84, 0], ['heart', 33.25, 1665, 905, 230, 1.5], ['cake', 33.35, 1850, 575, 190, 7], ['bouquet', 33.45, 135, 965, 285, 8],
  ];
  const ICONS3 = [['calendar', 33.3, 1290, 420], ['camera', 33.4, 640, 760], ['dress', 33.55, 1295, 800]];
  const ZOOM_OUT = 37.5;

  // ───────────────────────── cues ─────────────────────────
  function buildCues() {
    const q = [], pan = x => +(((x - 960) / 960) * 0.6).toFixed(2), c = (t, sfx, gain, p = 0) => q.push({ t: +t.toFixed(3), sfx, gain, pan: p });
    TB.w1.forEach((t, i) => c(t + 0.02, 'swish', 0.45, [-0.3, 0, 0.3][i]));
    c(TB.split + 0.08, 'whoosh_short', 0.5, 0); c(TB.out1 + 0.12, 'swish', 0.3, 0);
    TB.w2.forEach((t, i) => c(t + 0.02, 'swish', 0.4, [-0.25, 0, 0.25][i]));
    c(26.66, 'pop_soft', 0.3, 0);
    c(TB.out2 + 0.12, 'whoosh_short', 0.4, 0);
    c(TB.l3, 'swish', 0.4, -0.3); c(TB.chap, 'swish', 0.4, 0.3);
    TB.morph.forEach((t, i) => c(t, i === 0 ? 'pop' : i === TB.morph.length - 1 ? 'pop' : 'pop_soft', i === 0 ? 0.8 : i === 4 ? 0.7 : 0.55, 0));
    c(28.52, 'sparkle', 0.55, 0);
    c(29.0, 'whoosh', 0.9, 0); c(29.02, 'impact_soft', 0.45, 0); c(29.1, 'paper', 0.35, 0);
    c(SC.snap + 0.03, 'click', 0.75, 0); c(SC.snap + 0.1, 'glass_ting', 0.35, 0);
    c(SC.sweep, 'scan', 0.9, 0);
    c(SC.confirm, 'glass_ting', 0.7, 0); c(SC.found, 'pop_soft', 0.5, 0);
    c(30.72, 'whoosh', 0.7, 0);
    c(SC.objs[0], 'pop_soft', 0.4, pan(450)); c(SC.objs[1], 'pop_soft', 0.4, pan(560));
    c(SC.sheet + 0.05, 'paper', 0.5, 0);
    c(SC.tap, 'tap', 0.9, 0); c(SC.confirm2 + 0.05, 'toggle', 0.5, 0); c(SC.confirm2 + 0.15, 'sparkle', 0.35, 0);
    SC.meals.forEach((t, i) => c(t, 'pop_soft', 0.35, 0));
    c(SC.counterIn, 'pop', 0.55, pan(1490));
    c(SC.meal, 'tap', 0.7, 0);
    c(SC.tick, 'success', 1.0, pan(1400)); c(SC.tick + 0.02, 'click', 0.5, pan(1400)); c(SC.tick + 0.06, 'sparkle', 0.45, pan(1400)); c(SC.tick + 0.05, 'pop_soft', 0.35, pan(1560));
    c(32.86, 'whoosh_short', 0.45, 0.4); c(32.92, 'swipe', 0.6, 0);
    OBJ3.forEach(o => { if (o[1]) c(o[1], 'pop_soft', 0.3, pan(o[2])); });
    ICONS3.forEach(o => c(o[1], 'pop_soft', 0.28, pan(o[2])));
    BUBBLES.forEach(b => { c(b.t, 'bubble', 0.8, pan(b.x)); c(b.t + 0.22, 'type', 0.3, pan(b.x)); c(b.t + ANS_DELAY, 'pop_soft', 0.6, pan(b.x)); });
    Object.values(TICKS).forEach(t => c(t, 'toggle', 0.45, 0));
    c(37.8, 'whoosh', 0.9, 0);
    return q.sort((a, b) => a.t - b.t);
  }
  if (typeof module !== 'undefined' && typeof window === 'undefined') { module.exports = buildCues(); return; }

  // ───────────────────────── kit aliases ─────────────────────────
  const K = KIT, C = K.C, F = K.F, W = K.W, H = K.H, TAU = K.TAU;
  const { clamp, lerp, ease, remap, hash, rng, noise1 } = K;
  const sp = (dt, f = 2.4, d = 0.45) => (dt <= 0 ? 0 : K.spring(dt, f, d));
  const pulse = K.pulse;

  // generic text with alpha/blur/scale about glyph centre
  function mw(ctx, s, o) { K.font(ctx, o.size, o.weight || 500, o.family || F.sans, o.style || 'normal'); return ctx.measureText(s).width; }
  function txt(ctx, s, x, y, o) {
    const a = o.a == null ? 1 : o.a; if (a <= 0.003) return 0;
    const w = mw(ctx, s, o);
    ctx.save(); ctx.globalAlpha *= clamp(a);
    if (o.blur > 0.3) ctx.filter = `blur(${o.blur.toFixed(1)}px)`;
    const cx = x + (o.dx || 0) + w / 2, cy = y + (o.dy || 0) - o.size * 0.35;
    ctx.translate(cx, cy); const sc = o.s == null ? 1 : o.s; if (sc !== 1) ctx.scale(sc, sc); if (o.rot) ctx.rotate(o.rot);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    const X = -w / 2, Y = o.size * 0.35;
    if (o.grad) {
      const g0 = X - (o.gOff || 0), gr = ctx.createLinearGradient(g0, Y - o.size, g0 + (o.gw || w), Y);
      o.grad.forEach((c, k) => gr.addColorStop(k / (o.grad.length - 1), c)); ctx.fillStyle = gr;
    } else ctx.fillStyle = o.color || C.ink;
    ctx.fillText(s, X, Y); ctx.restore(); return w;
  }
  function star4(ctx, x, y, r, col) {
    ctx.beginPath();
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 - Math.PI / 2; ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); ctx.quadraticCurveTo(x, y, x + Math.cos(a + Math.PI / 2) * r, y + Math.sin(a + Math.PI / 2) * r); }
    ctx.closePath(); ctx.fillStyle = col; ctx.fill();
  }
  function burst(ctx, x, y, dt, n, R, seed, cols = [C.gold2, C.rose, C.gold, '#FFFFFF']) {
    if (dt < 0 || dt > 0.9) return;
    const e = ease.outExpo(clamp(dt / 0.7)), a = 1 - clamp((dt - 0.25) / 0.6);
    ctx.save(); ctx.globalAlpha *= a;
    for (let i = 0; i < n; i++) {
      const ang = i / n * TAU + hash(seed + i) * 0.6, d = R * (0.55 + 0.45 * hash(seed + i * 3.1)) * e;
      star4(ctx, x + Math.cos(ang) * d, y + Math.sin(ang) * d, (6 + hash(seed + i * 7.7) * 10) * (1 - 0.5 * e), cols[i % cols.length]);
    }
    ctx.restore();
  }
  const tick = (g, x, y, s, col, lw = 2.6, p = 1) => {
    const pts = K.partial([[x - s * 0.45, y + s * 0.02], [x - s * 0.1, y + s * 0.38], [x + s * 0.5, y - s * 0.35]], p);
    g.save(); g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(q => g.lineTo(q[0], q[1])); g.stroke(); g.restore();
  };
  const iconX = (g, name, x, y, size, col, lw) => (name === 'tick' ? tick(g, x, y, size * 0.55, col, lw * 1.2) : K.icon(g, name, x, y, size, col, lw));

  // ═════════════════════════ SCENE 8 — TYPE B (25.0–29.0) ═════════════════════════
  const SZ = 104, Y0 = 552, SANS = { size: SZ, weight: 500 };
  const SERIF = { size: SZ * 1.16, weight: 400, family: F.serif, style: 'italic' };
  const GRAD = [C.gold, '#D7A15C', C.rose];

  function line1(ctx, t) {
    const words = ["Whatever", "you're", "planning,"], ws = words.map(w => mw(ctx, w, SANS)), gap = SZ * 0.27;
    let x = 960 - (ws[0] + ws[1] + ws[2] + gap * 2) / 2;
    const from = [[-130, 0], [0, 90], [150, -40]];
    const pS = remap(t, TB.split, TB.split + 0.42, 0, 1, ease.outExpo), mb = t < TB.split ? 0 : Math.sin(Math.PI * clamp((t - TB.split) / 0.28)) * 9;
    const pE = remap(t, TB.out1, TB.out1 + 0.3, 0, 1, ease.inCubic);
    words.forEach((w, i) => {
      const q = remap(t, TB.w1[i], TB.w1[i] + 0.6, 0, 1, ease.outExpo), grp = i < 2 ? [-70, -64] : [-250, 66];
      txt(ctx, w, x, Y0, {
        ...SANS, a: clamp(q * 1.5) * (1 - pE), blur: (1 - q) * 18 + mb + pE * 22,
        dx: from[i][0] * (1 - q) + grp[0] * pS, dy: from[i][1] * (1 - q) + grp[1] * pS - 50 * pE, s: 1 - 0.06 * pE,
        color: i === 2 ? C.ink2 : C.ink,
      });
      x += ws[i] + gap;
    });
  }
  function line2(ctx, t) {
    const words = ["we'll", 'guide', 'you'], ws = words.map(w => mw(ctx, w, SANS)), gap = SZ * 0.27;
    let x = 960 - (ws[0] + ws[1] + ws[2] + gap * 2) / 2;
    const pE = remap(t, TB.out2, TB.out2 + 0.28, 0, 1, ease.inCubic), from = [[-110, 0], [0, 0], [120, 0]];
    words.forEach((w, i) => {
      const common = { ...SANS, s: 1 - 0.08 * pE };
      if (i === 1) { // per-letter bounce
        let lx = x; [...w].forEach((ch, j) => {
          const q = remap(t, TB.w2[1] + j * 0.035, TB.w2[1] + j * 0.035 + 0.5, 0, 1), e = ease.outBack(q, 2.4);
          const lw = txt(ctx, ch, lx, Y0, { ...common, grad: GRAD, gOff: lx - x, gw: ws[1], a: clamp(q * 3) * (1 - pE), dy: 70 * (1 - e) - 30 * pE, blur: (1 - clamp(q * 1.6)) * 12 + pE * 20 });
          lx += mw(ctx, ch, SANS);
        });
      } else {
        const q = remap(t, TB.w2[i], TB.w2[i] + 0.55, 0, 1, ease.outExpo);
        txt(ctx, w, x, Y0, { ...common, a: clamp(q * 1.5) * (1 - pE), dx: from[i][0] * (1 - q), dy: -30 * pE, blur: (1 - q) * 16 + pE * 20 });
      }
      x += ws[i] + gap;
    });
  }
  function line3Layout(ctx) {
    const wA = mw(ctx, 'A new', SANS), wC = mw(ctx, 'chapter.', SERIF), G = 215, tot = wA + G + wC, x0 = 960 - tot / 2;
    return { x0, wA, wC, G, ox: x0 + wA + G / 2, oy: Y0 - SZ * 0.34, xC: x0 + wA + G };
  }
  function drawMorph(ctx, t, ox, oy) {
    if (t < TB.morph[0]) return;
    let i = 0; while (i + 1 < MORPH.length && t >= TB.morph[i + 1]) i++;
    const dt = t - TB.morph[i], size = 196, last = i === MORPH.length - 1, first = i === 0;
    const bob = Math.sin((t - 27.5) * 2.6) * 5, rot = Math.sin((t - 27.5) * 1.7) * 0.06;
    if (!first && dt < 0.12) { const u = dt / 0.12; K.obj(ctx, MORPH[i - 1], ox, oy + bob, size * (1 - 0.45 * u), { rot: rot - u * 0.5, alpha: 1 - u, blur: u * 10, shadow: false }); }
    const s = first ? sp(dt, 2.2, 0.36) : last ? 0.55 + 0.45 * sp(dt, 2.0, 0.3) : 0.55 + 0.45 * sp(dt, 3.2, 0.45);
    const r0 = (i % 2 ? 1 : -1) * 0.45 * (1 - ease.outCubic(clamp(dt / 0.25)));
    K.obj(ctx, MORPH[i], ox, oy + bob, size * s, { rot: rot + r0, alpha: first ? clamp(dt / 0.06) : clamp(0.4 + dt / 0.06), blur: (1 - clamp(dt / (first ? 0.15 : 0.1))) * (first ? 12 : 8) });
    if (last) { burst(ctx, ox, oy, dt, 10, 190, 41); const gl = pulse(t, 28.5, 28.8); if (gl > 0) { ctx.save(); ctx.globalCompositeOperation = 'screen'; K.blob(ctx, '#FFF3D0', ox, oy - 40, 160 * gl + 40, 140 * gl + 30, 0.8 * gl); ctx.restore(); } }
  }
  function line3(ctx, t) {
    const L = line3Layout(ctx);
    if (t >= TB.morph[0]) { ctx.save(); ctx.globalAlpha *= clamp((t - 27.5) / 0.25) * 0.8; K.blob(ctx, C.champagne, L.ox, L.oy + 10, 150, 130, 0.7); K.blob(ctx, C.blush, L.ox + 20, L.oy + 30, 110, 90, 0.35); ctx.restore(); }
    let lx = L.x0;
    [...'A new'].forEach((ch, j) => {
      const q = remap(t, TB.l3 + j * 0.03, TB.l3 + j * 0.03 + 0.5, 0, 1, ease.outExpo);
      txt(ctx, ch, lx, Y0, { ...SANS, a: clamp(q * 1.4), dx: -80 * (1 - q), blur: (1 - q) * 14 });
      lx += mw(ctx, ch, SANS);
    });
    lx = L.xC;
    [...'chapter.'].forEach((ch, j) => {
      const q = remap(t, TB.chap + j * 0.035, TB.chap + j * 0.035 + 0.55, 0, 1, ease.outExpo);
      txt(ctx, ch, lx, Y0, { ...SERIF, grad: GRAD, gOff: lx - L.xC, gw: L.wC, a: clamp(q * 1.4), dy: 70 * (1 - q), blur: (1 - q) * 14, rot: (1 - q) * 0.12 });
      lx += mw(ctx, ch, SERIF);
    });
    drawMorph(ctx, t, L.ox, L.oy);
    // underline flourish under "chapter."
    const u = remap(t, 28.5, 28.9, 0, 1, ease.outCubic);
    if (u > 0) { const gr = ctx.createLinearGradient(L.xC, 0, L.xC + L.wC, 0); gr.addColorStop(0, 'rgba(184,138,62,0)'); gr.addColorStop(0.3, C.gold2); gr.addColorStop(1, 'rgba(224,122,147,.6)'); ctx.save(); ctx.strokeStyle = gr; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(L.xC + 10, Y0 + 34); ctx.quadraticCurveTo(L.xC + L.wC * 0.5, Y0 + 26 + 10 * (1 - u), L.xC + 10 + (L.wC - 10) * u, Y0 + 30); ctx.stroke(); ctx.restore(); }
    return L;
  }
  function typeFrame(g, t) {
    K.bgWhite(g, t);
    g.save(); const zs = 1 + (t - 25) * 0.012; g.translate(960, 540); g.scale(zs, zs); g.translate(-960, -540);
    if (t < TB.out1 + 0.32) line1(g, t);
    if (t >= TB.w2[0] - 0.02 && t < TB.out2 + 0.3) line2(g, t);
    if (t >= TB.l3 - 0.02) line3(g, t);
    g.restore();
  }
  function drawTypeB(ctx, t) {
    if (t < TB.zoom) { typeFrame(ctx, t); return; }
    const L = line3Layout(ctx), zs = 1 + (t - 25) * 0.012, ox = 960 + (L.ox - 960) * zs, oy = 540 + (L.oy - 540) * zs;
    const p = clamp((t - TB.zoom) / 0.25), s = 1 + ease.inExpo(p) * 7 + p * 0.3;
    K.zoomBlur(ctx, 0.45 * ease.inQuad(p), g => { g.translate(ox, oy); g.scale(s, s); g.translate(-ox, -oy); typeFrame(g, t); }, ox, oy, 7);
    K.fade(ctx, remap(t, 28.86, 29.0, 0, 0.92, ease.inQuad));
  }

  // ═════════════════════════ SCENE 9 — INVITATION SCAN (29.0–33.0) ═════════════════════════
  const QN = 29, QS = 261, QY = 430; // QR modules, size (card px), QR centre y in world (card centre = 0,0)
  let _qr = null;
  function qrGrid() {
    return _qr || (_qr = (() => {
      const R = rng(1406), M = [];
      for (let y = 0; y < QN; y++) { M.push([]); for (let x = 0; x < QN; x++) M[y].push(R() < 0.48 ? 1 : 0); }
      const fin = (ox, oy) => { for (let y = -1; y < 8; y++) for (let x = -1; x < 8; x++) { const X = ox + x, Y = oy + y; if (X < 0 || Y < 0 || X >= QN || Y >= QN) continue; const ring = x >= 0 && x <= 6 && y >= 0 && y <= 6 && (x === 0 || x === 6 || y === 0 || y === 6), core = x >= 2 && x <= 4 && y >= 2 && y <= 4; M[Y][X] = ring || core ? 1 : 0; } };
      fin(0, 0); fin(QN - 7, 0); fin(0, QN - 7);
      for (let i = 8; i < QN - 8; i++) { M[6][i] = i % 2 === 0 ? 1 : 0; M[i][6] = i % 2 === 0 ? 1 : 0; }
      for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) M[22 + y][22 + x] = Math.max(Math.abs(x), Math.abs(y)) !== 1 ? 1 : 0;
      return M;
    })());
  }
  function lp(g, s, x, y, col) { // letterpress: debossed text
    g.fillStyle = 'rgba(255,255,255,.85)'; g.fillText(s, x, y + 1.6);
    g.fillStyle = 'rgba(90,60,30,.22)'; g.fillText(s, x, y - 1);
    g.fillStyle = col; g.fillText(s, x, y);
  }
  function sprig(g, x, y, dir, s = 1) {
    g.save(); g.translate(x, y); g.scale(dir * s, s);
    g.strokeStyle = C.gold; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(60, -18, 130, -6); g.stroke();
    for (let i = 0; i < 6; i++) {
      const u = (i + 1) / 7, px = u * 125, py = -18 * Math.sin(u * Math.PI) * 0.9;
      for (const sd of [-1, 1]) { g.save(); g.translate(px, py); g.rotate(sd * 0.9 - 0.25); g.beginPath(); g.ellipse(0, -9 * sd * 0 - 10, 5.5, 11, 0, 0, TAU); g.fillStyle = i % 2 ? 'rgba(184,138,62,.85)' : 'rgba(206,164,90,.8)'; g.fill(); g.restore(); }
    }
    g.restore();
  }
  function cardSprite() {
    return K.cache('c:card', 1100, 1500, g => {
      const x0 = 50, y0 = 50, w = 1000, h = 1400;
      // deckled outline
      const pts = [], step = 5, per = 2 * (w + h);
      for (let d = 0; d < per; d += step) {
        let x, y, nx, ny;
        if (d < w) { x = x0 + d; y = y0; nx = 0; ny = -1; } else if (d < w + h) { x = x0 + w; y = y0 + d - w; nx = 1; ny = 0; } else if (d < 2 * w + h) { x = x0 + w - (d - w - h); y = y0 + h; nx = 0; ny = 1; } else { x = x0; y = y0 + h - (d - 2 * w - h); nx = -1; ny = 0; }
        const j = noise1(d * 0.09, 3) * 2.2 + (hash(d * 0.37) - 0.5) * 2.6;
        pts.push([x + nx * j, y + ny * j]);
      }
      const path = () => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.closePath(); };
      g.save(); g.shadowColor = 'rgba(70,45,20,.30)'; g.shadowBlur = 38; g.shadowOffsetY = 16; g.shadowOffsetX = 6; path(); g.fillStyle = '#FBF6EC'; g.fill(); g.restore();
      g.save(); path(); g.clip();
      const pg = g.createLinearGradient(0, 0, 1100, 1500); pg.addColorStop(0, '#FFFCF5'); pg.addColorStop(0.6, '#FAF3E6'); pg.addColorStop(1, '#F2E8D6'); g.fillStyle = pg; g.fillRect(0, 0, 1100, 1500);
      const R = rng(99); for (let i = 0; i < 9000; i++) { g.fillStyle = R() < 0.5 ? 'rgba(150,120,80,.07)' : 'rgba(255,255,255,.5)'; g.fillRect(x0 + R() * w, y0 + R() * h, 1 + R() * 1.6, 1 + R() * 1.6); }
      for (let i = 0; i < 70; i++) { g.strokeStyle = 'rgba(160,130,90,.07)'; g.lineWidth = 1; const fx = x0 + R() * w, fy = y0 + R() * h; g.beginPath(); g.moveTo(fx, fy); g.quadraticCurveTo(fx + R() * 10, fy + R() * 6, fx + 6 + R() * 14, fy + R() * 10 - 5); g.stroke(); }
      // edge fibre shading
      g.lineWidth = 10; g.strokeStyle = 'rgba(200,175,135,.14)'; path(); g.stroke();
      g.restore();
      // gold foil frame
      const fg = g.createLinearGradient(0, 0, 1100, 1500); fg.addColorStop(0, '#E6C27A'); fg.addColorStop(0.35, '#B88A3E'); fg.addColorStop(0.55, '#F3DDB0'); fg.addColorStop(1, '#A87A30');
      g.strokeStyle = fg; g.lineWidth = 3; K.rr(g, 100, 100, 900, 1300, 10); g.stroke(); g.lineWidth = 1.2; K.rr(g, 112, 112, 876, 1276, 6); g.stroke();
      const cx = 550; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
      sprig(g, cx - 12, 200, -1, 0.9); sprig(g, cx + 12, 200, 1, 0.9);
      g.beginPath(); g.arc(cx, 196, 6, 0, TAU); g.fillStyle = C.gold; g.fill();
      g.letterSpacing = '7px'; K.font(g, 22, 500, F.caps); lp(g, 'TOGETHER WITH THEIR FAMILIES', cx + 3, 290, C.ink2);
      g.letterSpacing = '0px';
      K.font(g, 150, 400, F.serif, 'italic'); lp(g, 'Sophie', cx - 20, 460, C.ink);
      K.font(g, 92, 400, F.serif, 'italic'); lp(g, '&', cx, 548, C.gold);
      K.font(g, 150, 400, F.serif, 'italic'); lp(g, 'James', cx + 20, 668, C.ink);
      g.letterSpacing = '6px'; K.font(g, 20, 500, F.caps); lp(g, 'REQUEST THE PLEASURE OF YOUR COMPANY', cx + 3, 738, C.ink2); lp(g, 'AT THEIR WEDDING', cx + 3, 772, C.ink2);
      g.strokeStyle = C.gold; g.lineWidth = 1.5; g.beginPath(); g.moveTo(cx - 170, 818); g.lineTo(cx - 16, 818); g.moveTo(cx + 16, 818); g.lineTo(cx + 170, 818); g.stroke();
      g.save(); g.translate(cx, 818); g.rotate(Math.PI / 4); g.fillStyle = C.gold; g.fillRect(-6, -6, 12, 12); g.restore();
      g.letterSpacing = '10px'; K.font(g, 40, 600, F.caps); lp(g, 'SATURDAY 14 JUNE', cx + 5, 890, C.ink);
      g.letterSpacing = '0px'; K.font(g, 32, 400, F.serif, 'italic'); lp(g, 'at half past two in the afternoon', cx, 942, C.ink2);
      g.letterSpacing = '6px'; K.font(g, 20, 500, F.caps); lp(g, 'THE ORANGERY  ·  COMBE HALL  ·  BATH', cx + 3, 992, C.ink2);
      // QR
      const M = qrGrid(), m = QS / QN, qx = cx - QS / 2, qy = 750 + QY - QS / 2;
      g.fillStyle = 'rgba(255,255,255,.5)'; K.rr(g, qx - 16, qy - 16, QS + 32, QS + 32, 14); g.fill();
      g.strokeStyle = 'rgba(184,138,62,.5)'; g.lineWidth = 1.2; g.stroke();
      const cell = (x, y) => { g.fillRect(Math.round(qx + x * m), Math.round(qy + y * m), m, m); };
      g.fillStyle = C.ink; for (let y = 0; y < QN; y++) for (let x = 0; x < QN; x++) if (M[y][x]) cell(x, y);
      g.letterSpacing = '5px'; K.font(g, 18, 600, F.caps); lp(g, 'RSVP WITH THE WEDDING CHAPTER', cx + 3, 1350, C.gold);
      g.letterSpacing = '0px'; K.font(g, 24, 400, F.serif, 'italic'); lp(g, 'kindly reply by the first of May', cx, 1382, C.ink2);
    });
  }
  function linenSprite() {
    return K.cache('c:linen', 2800, 2200, g => {
      const Wt = 2800, Ht = 2200, R = rng(7);
      g.fillStyle = '#EDE3D3'; g.fillRect(0, 0, Wt, Ht);
      for (let y = 0; y < Ht; y += 3) { g.fillStyle = R() < 0.5 ? `rgba(255,255,255,${0.05 + R() * 0.12})` : `rgba(120,95,60,${0.03 + R() * 0.06})`; g.fillRect(0, y + R(), Wt, 1.3); }
      for (let x = 0; x < Wt; x += 3) { g.fillStyle = R() < 0.5 ? `rgba(255,255,255,${0.04 + R() * 0.08})` : `rgba(120,95,60,${0.02 + R() * 0.05})`; g.fillRect(x + R(), 0, 1.2, Ht); }
      for (let i = 0; i < 500; i++) { g.fillStyle = `rgba(110,85,55,${0.04 + R() * 0.05})`; g.fillRect(R() * Wt, R() * Ht, 8 + R() * 40, 1.5); }
      const lg = g.createRadialGradient(700, 400, 100, 900, 700, 2000); lg.addColorStop(0, 'rgba(255,250,240,.55)'); lg.addColorStop(1, 'rgba(160,130,95,.25)'); g.fillStyle = lg; g.fillRect(0, 0, Wt, Ht);
      const O = [1400, 1100]; // world origin in texture
      // envelope peeking under card (top-right)
      g.save(); g.translate(O[0] + 330, O[1] - 560); g.rotate(0.2);
      g.shadowColor = 'rgba(70,45,20,.25)'; g.shadowBlur = 30; g.shadowOffsetY = 12; K.rr(g, -520, -360, 1040, 720, 8); g.fillStyle = '#E6D5BC'; g.fill(); g.shadowColor = 'transparent';
      g.strokeStyle = 'rgba(150,115,70,.25)'; g.lineWidth = 3; g.beginPath(); g.moveTo(-520, -350); g.lineTo(0, 60); g.lineTo(520, -350); g.stroke();
      g.restore();
      // satin ribbon (right)
      const rib = (w, col) => { g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.beginPath(); g.moveTo(O[0] + 420, O[1] - 260); g.bezierCurveTo(O[0] + 820, O[1] - 120, O[0] + 620, O[1] + 380, O[0] + 1150, O[1] + 820); g.stroke(); };
      g.save(); g.shadowColor = 'rgba(120,60,70,.25)'; g.shadowBlur = 20; g.shadowOffsetY = 10; rib(64, '#EBC3CB'); g.restore(); rib(56, '#F4D2D9'); rib(16, 'rgba(255,255,255,.35)');
      // eucalyptus sprig (bottom-left)
      g.save(); g.translate(O[0] - 820, O[1] + 520); g.rotate(-0.5);
      g.strokeStyle = '#8FA68F'; g.lineWidth = 7; g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(220, -60, 520, -10); g.stroke();
      for (let i = 0; i < 7; i++) { const u = (i + 0.5) / 7, py = -40 * Math.sin(u * Math.PI); for (const sd of [-1, 1]) { const px = u * 500 + sd * 18; g.save(); g.translate(px, py); g.rotate(sd * 0.75 - 0.15); g.translate(0, -sd * 40); g.shadowColor = 'rgba(40,60,40,.22)'; g.shadowBlur = 12; g.shadowOffsetY = 6; g.beginPath(); g.ellipse(0, 0, 16 - i * 0.8, 44 - i * 2.5, 0, 0, TAU); const lgr = g.createLinearGradient(-16, 0, 16, 0); lgr.addColorStop(0, '#B9CFBA'); lgr.addColorStop(1, '#88A58E'); g.fillStyle = lgr; g.fill(); g.restore(); } }
      g.restore();
    });
  }
  function cam(t) {
    const lt = t - SC.start, p = ease.outCubic(clamp(lt / 1.6));
    return {
      s: lerp(1.0, 1.3, p) + lt * 0.025,
      fx: lerp(-60, 0, p) + noise1(t * 0.9, 3) * 5 + lt * 3,
      fy: lerp(40, 330, p) + lt * 8 + noise1(t * 0.9, 5) * 5,
      r: lerp(-0.08, -0.035, p) + noise1(t * 0.5, 7) * 0.004,
    };
  }
  function w2s(c, x, y) { const dx = (x - c.fx) * c.s, dy = (y - c.fy) * c.s, cs = Math.cos(c.r), sn = Math.sin(c.r); return [960 + dx * cs - dy * sn, 540 + dx * sn + dy * cs]; }
  function drawScanner(g, t, c) {
    if (t < SC.snap) return;
    const [qx, qy] = w2s(c, 0, QY), half = QS * 0.5 * c.s * 1.2;
    const p = clamp((t - SC.snap) / 0.3), sc = lerp(1.8, 1, ease.outBack(p, 2.2)), a = clamp(p * 3);
    const pc = pulse(t, SC.confirm, SC.confirm + 0.3), conf = clamp((t - SC.confirm) / 0.12);
    g.save(); g.translate(qx, qy); g.rotate(c.r * p + (1 - p) * 0.25);
    const S = sc * (1 + 0.07 * pc); g.scale(S, S);
    // soft dim outside focus square (camera UI feel)
    g.save(); g.globalAlpha = a * 0.18; g.fillStyle = '#1B1030'; g.beginPath(); g.rect(-3000, -3000, 6000, 6000); K.rr(g, -half, -half, half * 2, half * 2, 34); g.fill('evenodd'); g.restore();
    // scan sweep
    if (t >= SC.sweep && t < SC.sweepEnd + 0.06) {
      const u = clamp((t - SC.sweep) / (SC.sweepEnd - SC.sweep)), down = u < 0.5, v = ease.inOutSine(down ? u * 2 : 2 - u * 2), y = lerp(-half * 0.9, half * 0.9, v), fadeL = 1 - clamp((t - SC.sweepEnd) / 0.06);
      g.save(); K.rr(g, -half * 0.94, -half * 0.94, half * 1.88, half * 1.88, 26); g.clip(); g.globalAlpha = fadeL;
      const tr = 110 * (down ? -1 : 1), gr = g.createLinearGradient(0, y + tr, 0, y);
      gr.addColorStop(0, 'rgba(185,166,240,0)'); gr.addColorStop(1, 'rgba(205,190,255,.55)'); g.fillStyle = gr; g.fillRect(-half, Math.min(y, y + tr), half * 2, Math.abs(tr));
      g.shadowColor = 'rgba(160,130,255,.9)'; g.shadowBlur = 18; g.fillStyle = '#FFFFFF'; g.fillRect(-half * 0.94, y - 2, half * 1.88, 4);
      g.restore();
    }
    // flash
    const fl = pulse(t, SC.confirm, SC.confirm + 0.28);
    if (fl > 0) { g.fillStyle = `rgba(255,255,255,${0.75 * fl})`; K.rr(g, -half * 0.94, -half * 0.94, half * 1.88, half * 1.88, 26); g.fill(); }
    // corner brackets
    g.globalAlpha *= a;
    const L = half * 0.42, R = 30;
    const corners = () => { g.beginPath(); for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { g.moveTo(sx * half, sy * (half - L)); g.lineTo(sx * half, sy * (half - R)); g.arcTo(sx * half, sy * half, sx * (half - R), sy * half, R); g.lineTo(sx * (half - L), sy * half); } };
    g.save(); g.shadowColor = 'rgba(40,20,60,.35)'; g.shadowBlur = 14; g.shadowOffsetY = 3; g.lineWidth = 9; g.lineCap = 'round'; g.strokeStyle = '#FFFFFF'; corners(); g.stroke(); g.restore();
    if (conf > 0) { g.save(); g.globalAlpha *= conf; g.lineWidth = 9; g.lineCap = 'round'; g.strokeStyle = '#8FE0B5'; g.shadowColor = 'rgba(120,220,170,.8)'; g.shadowBlur = 20 * (0.4 + pc); corners(); g.stroke(); g.restore(); }
    g.restore();
    // "Invitation found" pill
    const fa = t - SC.found;
    if (fa > 0) {
      const s2 = 0.5 + 0.5 * sp(fa, 2.6, 0.45), al = clamp(fa / 0.1);
      const pw = 470, ph = 74, px = qx, py = qy - half * S - 70;
      g.save(); g.globalAlpha *= al; g.translate(px, py); g.scale(s2, s2);
      K.glass(g, -pw / 2, -ph / 2, pw, ph, ph / 2, { fill: 'rgba(255,255,255,.9)' });
      g.beginPath(); g.arc(-pw / 2 + 38, 0, 22, 0, TAU); g.fillStyle = '#6CC393'; g.fill(); tick(g, -pw / 2 + 38, 0, 12, '#fff', 3.4, clamp((fa - 0.08) / 0.2));
      K.UI.text(g, 'Invitation found', -pw / 2 + 74, 3, 25, 700, C.ink); K.UI.text(g, 'Sophie & James', -pw / 2 + 290, 3, 21, 500, C.ink2);
      g.restore();
    }
  }
  /** Full-frame scan world (DOF, scanner) into ctx. */
  function drawScanWorld(ctx, t) {
    const c = cam(t), sharp = K.offscreen('c:sharp'), sg = sharp.getContext('2d');
    sg.setTransform(1, 0, 0, 1, 0, 0); sg.filter = 'none';
    sg.save(); sg.translate(960, 540); sg.rotate(c.r); sg.scale(c.s, c.s); sg.translate(-c.fx, -c.fy);
    sg.drawImage(linenSprite(), -1400, -1100); sg.drawImage(cardSprite(), -550, -750); sg.restore();
    const small = K.offscreen('c:small', 480, 270), mg = small.getContext('2d');
    mg.setTransform(1, 0, 0, 1, 0, 0); mg.filter = 'blur(2.2px)'; mg.drawImage(sharp, 0, 0, 480, 270); mg.filter = 'none';
    ctx.drawImage(small, 0, 0, W, H);
    const mask = K.offscreen('c:mask'), kg = mask.getContext('2d');
    kg.setTransform(1, 0, 0, 1, 0, 0); kg.globalCompositeOperation = 'source-over'; kg.clearRect(0, 0, W, H); kg.drawImage(sharp, 0, 0);
    const [qx, qy] = w2s(c, 0, QY), fx = lerp(960, qx, 0.6), fy = lerp(540, qy, 0.6);
    kg.globalCompositeOperation = 'destination-in';
    const gr = kg.createRadialGradient(fx, fy, 260, fx, fy, 820); gr.addColorStop(0, '#000'); gr.addColorStop(1, 'rgba(0,0,0,0)'); kg.fillStyle = gr; kg.fillRect(0, 0, W, H);
    kg.globalCompositeOperation = 'source-over';
    ctx.drawImage(mask, 0, 0);
    // warm light + vignette
    ctx.save(); ctx.globalCompositeOperation = 'soft-light'; K.blob(ctx, '#FFE9C7', 500, 200, 1100, 800, 0.6); ctx.restore();
    const vg = ctx.createRadialGradient(960, 540, 500, 960, 540, 1250); vg.addColorStop(0, 'rgba(60,35,20,0)'); vg.addColorStop(1, 'rgba(60,35,20,.28)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    drawScanner(ctx, t, c);
  }
  function scanBuffer(t) {
    const b = K.offscreen('c:scanbuf'), g = b.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.filter = 'none';
    drawScanWorld(g, t); return b;
  }

  // ───── phone world (30.5–38) ─────
  const MESH = () => [[C.lavender, 0.1, 0.22, 900], [C.lilac, 0.86, 0.12, 760], [C.peach, 0.9, 0.82, 840], [C.blush, 0.16, 0.92, 780], [C.champagne, 0.55, 0.5, 560], [C.lavender, 0.62, 1.08, 720], [C.sky, 0.45, -0.08, 620]];
  function phoneLayout(t) {
    if (t < SC.pullEnd) { const p = ease.inOutCubic(clamp((t - SC.pull) / (SC.pullEnd - SC.pull))); return { x: 960, y: lerp(540, 548, p), h: Math.exp(lerp(Math.log(4480), Math.log(900), p)), p }; }
    if (t < 33.0) return { x: 960, y: 548 + Math.sin((t - SC.pullEnd) * 1.6) * 6, h: 900, p: 1 };
    const y33 = 548 + Math.sin((33 - SC.pullEnd) * 1.6) * 6, p = ease.inOutCubic(clamp((t - 33.0) / 0.6));
    return { x: 960, y: lerp(y33, 612, p) - (t - 33) * 3, h: lerp(900, 1040, p) + (t - 33) * 5, yaw: Math.sin((t - 33) * 0.6) * 0.05 * p, p: 1 };
  }

  function drawRSVP(g, t) {
    const bg = g.createLinearGradient(0, 0, 0, 844); bg.addColorStop(0, '#FDEDEF'); bg.addColorStop(0.45, '#FBF7F2'); bg.addColorStop(1, '#FBF7F2'); g.fillStyle = bg; g.fillRect(0, 0, 390, 844);
    K.UI.statusBar(g);
    g.save(); g.strokeStyle = C.ink; g.lineWidth = 2.4; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); g.moveTo(33, 71); g.lineTo(25, 79); g.lineTo(33, 87); g.stroke(); g.restore();
    K.UI.text(g, 'Invitation', 195, 85, 16, 700, C.ink, 'center');
    K.UI.card(g, 20, 108, 350, 500, 28);
    g.save(); K.rr(g, 20, 108, 350, 500, 28); g.clip();
    const hg = g.createLinearGradient(0, 108, 0, 420); hg.addColorStop(0, '#FCE6EA'); hg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = hg; g.fillRect(20, 108, 350, 320);
    g.strokeStyle = 'rgba(184,138,62,.4)'; g.lineWidth = 1; K.rr(g, 32, 120, 326, 476, 20); g.stroke(); g.restore();
    const q = remap(t, SC.confirm2, SC.confirm2 + 0.25, 0, 1, ease.outCubic);
    if (q < 1) { g.save(); g.globalAlpha = 1 - q; g.translate(0, -18 * q); inviteContent(g, t); g.restore(); }
    if (q > 0) { g.save(); g.globalAlpha = q; g.translate(0, 18 * (1 - q)); confirmContent(g, t); g.restore(); }
    // buttons
    const pr = pulse(t, SC.tap - 0.06, SC.tap + 0.12), conf = clamp((t - (SC.tap + 0.05)) / 0.2);
    g.save(); g.translate(195, 667); g.scale(1 - 0.05 * pr, 1 - 0.05 * pr); g.translate(-195, -667);
    if (conf < 1) { g.globalAlpha = 1 - conf; K.UI.button(g, 'Joyfully accept', 30, 638, 330, 58, { size: 17 }); }
    if (conf > 0) {
      g.globalAlpha = conf; K.rr(g, 30, 638, 330, 58, 29); g.fillStyle = '#DDF3E6'; g.fill();
      K.UI.text(g, 'Attending', 185, 673, 17, 700, '#2F7A55', 'center'); tick(g, 250, 667, 12, '#2F7A55', 2.8, clamp((t - SC.tap - 0.1) / 0.2));
    }
    g.restore();
    g.globalAlpha = 1 - conf; K.UI.button(g, 'Regretfully decline', 30, 710, 330, 50, { bg: '#F1ECF7', fg: C.ink, size: 15 });
    g.globalAlpha = conf; K.icon(g, 'calendar', 128, 735, 18, C.ink2, 1.8); K.UI.text(g, 'Add to calendar', 144, 741, 15, 600, C.ink2);
    g.globalAlpha = 1;
    K.rr(g, 128, 830, 134, 5, 3); g.fillStyle = C.ink; g.fill();
  }
  function inviteContent(g, t) {
    K.font(g, 40, 400, F.serif, 'italic'); const tw = g.measureText("You're invited!").width;
    const gr = g.createLinearGradient(195 - tw / 2, 0, 195 + tw / 2, 0); gr.addColorStop(0, C.gold); gr.addColorStop(1, C.rose); g.fillStyle = gr; g.textAlign = 'center'; g.fillText("You're invited!", 195, 180);
    const mg = g.createRadialGradient(185, 255, 5, 195, 272, 70); mg.addColorStop(0, '#FFFFFF'); mg.addColorStop(1, '#F8DDE3'); g.beginPath(); g.arc(195, 272, 64, 0, TAU); g.fillStyle = mg; g.fill(); g.strokeStyle = C.gold2; g.lineWidth = 2; g.stroke();
    for (const [x, col, s] of [[172, C.lilac, 'S'], [218, C.peach, 'J']]) { g.beginPath(); g.arc(x, 268, 31, 0, TAU); g.fillStyle = '#fff'; g.fill(); K.UI.avatar(g, x, 268, 28, s, col); }
    K.heartPath(g, 195, 318, 26); g.fillStyle = C.rose; g.fill();
    K.UI.text(g, 'Sophie & James', 195, 384, 27, 800, C.ink, 'center');
    K.UI.text(g, 'are getting married', 195, 410, 17, 400, C.ink2, 'center', F.serif);
    K.icon(g, 'calendar', 76, 452, 18, C.gold, 1.9); K.UI.text(g, 'Saturday 14 June · 2:30pm', 94, 458, 14, 600, C.ink);
    K.icon(g, 'pin', 76, 484, 18, C.gold, 1.9); K.UI.text(g, 'The Orangery, Combe Hall, Bath', 94, 490, 14, 600, C.ink);
    K.UI.pill(g, 'Kindly reply by 1 May', 195, 548, { align: 'center', bg: '#FBF0DC', fg: '#9A6F2A', size: 13 });
  }
  function confirmContent(g, t) {
    const a = t - SC.confirm2, s = 0.4 + 0.6 * sp(a, 2.6, 0.4);
    g.save(); g.translate(195, 198); g.scale(s, s); g.beginPath(); g.arc(0, 0, 46, 0, TAU); g.fillStyle = 'rgba(108,195,147,.18)'; g.fill(); K.UI.check(g, 0, 0, 36, clamp((a - 0.05) / 0.25), '#6CC393'); g.restore();
    burst(g, 195, 198, a - 0.05, 8, 80, 9, [C.gold2, C.rose, '#8FE0B5']);
    K.font(g, 36, 400, F.serif, 'italic'); const tw = g.measureText('See you there!').width;
    const gr = g.createLinearGradient(195 - tw / 2, 0, 195 + tw / 2, 0); gr.addColorStop(0, C.gold); gr.addColorStop(1, C.rose); g.fillStyle = gr; g.textAlign = 'center'; g.fillText('See you there!', 195, 290);
    K.UI.text(g, 'Attending · Saturday 14 June', 195, 318, 14, 600, C.ink2, 'center');
    g.letterSpacing = '2px'; K.UI.text(g, 'CHOOSE YOUR MEAL', 44, 368, 11, 600, C.ink3, 'left', F.caps); g.letterSpacing = '0px';
    ['Herb-crusted lamb', 'Pan-roasted sea bass', 'Wild mushroom risotto'].forEach((lab, i) => {
      const da = t - SC.meals[i]; if (da <= 0) return;
      const y0 = 384 + i * 58, ps = 0.7 + 0.3 * sp(da, 2.8, 0.45), sel = i === 1 ? clamp((t - SC.meal) / 0.15) : 0;
      g.save(); g.globalAlpha *= clamp(da / 0.1); g.translate(195, y0 + 24); g.scale(ps, ps); g.translate(-195, -(y0 + 24));
      K.rr(g, 40, y0, 310, 48, 16); g.fillStyle = sel ? '#FFF6E6' : '#FFFFFF'; g.fill(); g.lineWidth = 1 + sel * 0.8; g.strokeStyle = sel ? C.gold2 : 'rgba(42,27,61,.09)'; g.stroke();
      g.beginPath(); g.arc(66, y0 + 24, 9, 0, TAU); g.lineWidth = 1.6; g.strokeStyle = sel ? C.gold : '#D6CDE0'; g.stroke();
      if (sel) { g.beginPath(); g.arc(66, y0 + 24, 9 * sel, 0, TAU); g.fillStyle = C.gold; g.fill(); g.beginPath(); g.arc(66, y0 + 24, 3.2 * sel, 0, TAU); g.fillStyle = '#fff'; g.fill(); }
      K.UI.text(g, lab, 86, y0 + 29, 15, 600, C.ink);
      g.restore();
    });
  }
  function drawChecklist(g, t) {
    g.fillStyle = '#FBF7F2'; g.fillRect(0, 0, 390, 844);
    const scroll = 250 * ease.inOutSine(clamp((t - 33.4) / 4.3));
    const rows = [
      ['THIS WEEK'], ['Send invitations', '142 sent · 130 opened', 1, null], ['Chase RSVPs', '12 guests still to reply', 0, null, '12 left'],
      ['Pay florist deposit', 'Bath Blooms · £640 left', 0, TICKS.flowers], ['Cake tasting', 'Thu 3pm · Bramble Bakery', 0, null, 'Thu'],
      ['NEXT WEEK'], ['Draft seating plan', 'Uncle Gary → Table 9', 0, TICKS.seating], ['Book the band', 'The Velvet Notes · 7–11pm', 0, TICKS.band],
      ['Dress fitting', 'Sat 11am · final fitting', 0, null, 'Sat'], ['Order favours', 'Honey jars × 120', 0, null],
      ['MAY'], ['Hair & makeup trial', 'Studio Belle', 0, null], ['Book transport', 'Vintage car · 2 trips', 0, null], ['Choose readings', 'Two readers', 0, null],
    ];
    let done = 0; rows.forEach(r => { if (r.length > 1 && r[3]) done += clamp((t - r[3]) / 0.3); });
    g.save(); g.beginPath(); g.rect(0, 150, 390, 700); g.clip(); g.translate(0, -scroll);
    let y = 170;
    rows.forEach(r => {
      if (r.length === 1) { g.letterSpacing = '2px'; K.UI.text(g, r[0], 24, y + 20, 11, 600, C.ink3, 'left', F.caps); g.letterSpacing = '0px'; y += 34; return; }
      const [title, sub, d0, tt, pill] = r, on = d0 || (tt ? clamp((t - tt) / 0.3) : 0), fl = tt ? pulse(t, tt, tt + 0.5) : 0;
      K.UI.card(g, 16, y, 358, 64, 18, { fill: fl > 0 ? `rgba(${Math.round(lerp(255, 236, fl))},${Math.round(lerp(255, 250, fl))},${Math.round(lerp(255, 241, fl))},1)` : '#FFFFFF' });
      const cs = 1 + 0.3 * (tt ? pulse(t, tt, tt + 0.3) : 0);
      g.save(); g.translate(46, y + 32); g.scale(cs, cs); K.UI.check(g, 0, 0, 12, on, '#6CC393'); g.restore();
      K.UI.text(g, title, 70, y + 29, 15, 700, on >= 1 ? C.ink3 : C.ink); K.UI.text(g, sub, 70, y + 48, 12, 500, C.ink2);
      if (pill) K.UI.pill(g, pill, 358, y + 32, { align: 'right', bg: pill === 'Thu' || pill === 'Sat' ? '#FDE7EC' : '#F1ECF7', fg: pill === 'Thu' || pill === 'Sat' ? '#B84E6B' : C.ink, size: 11 });
      if (on > 0 && on < 1) burst(g, 46, y + 32, (t - tt) - 0.05, 6, 34, tt * 10, [C.gold2, '#8FE0B5', C.rose]);
      y += 74;
    });
    g.restore();
    const hg = g.createLinearGradient(0, 0, 0, 160); hg.addColorStop(0, '#FDF0F2'); hg.addColorStop(0.85, '#FBF7F2'); hg.addColorStop(1, 'rgba(251,247,242,0)'); g.fillStyle = hg; g.fillRect(0, 0, 390, 168);
    K.UI.statusBar(g);
    K.UI.text(g, 'Checklist', 24, 104, 30, 800, C.ink); K.UI.text(g, 'Sophie & James · 142 days to go', 24, 128, 13, 600, C.ink2);
    const pct = 68 + done * 2;
    K.UI.ring(g, 340, 102, 26, pct / 100, C.gold, 7); K.UI.text(g, Math.round(pct) + '%', 340, 107, 13, 800, C.ink, 'center');
    K.UI.tabBar(g, 3);
  }
  function drawScreen2(g, t) {
    // camera feed (pull-back) → RSVP sheet → swipe to checklist
    if (t < SC.sheet + 0.32) {
      const L = phoneLayout(t), k = L.h / 880, m = lerp(1, 0.8, L.p);
      g.fillStyle = '#000'; g.fillRect(0, 0, 390, 844);
      g.save(); g.translate(195 + (960 - L.x) / k, 422 + (540 - L.y) / k); g.scale(m / k, m / k); g.drawImage(scanBuffer(t), -960, -540); g.restore();
      K.UI.statusBar(g, true);
      const dim = clamp((t - SC.sheet) / 0.3); if (dim > 0) { g.fillStyle = `rgba(20,10,30,${0.45 * dim})`; g.fillRect(0, 0, 390, 844); }
    }
    if (t >= SC.sheet) {
      const ys = 844 * (1 - ease.outQuart(clamp((t - SC.sheet) / 0.32))), sw = ease.inOutQuart(clamp((t - SC.swipe) / (SC.swipeEnd - SC.swipe)));
      g.save(); g.translate(-390 * sw, ys); if (ys > 0.5) { K.rr(g, 0, 0, 390, 900, 26); g.clip(); } drawRSVP(g, t); g.restore();
      if (sw > 0) { g.save(); g.translate(390 * (1 - sw), 0); drawChecklist(g, t); g.restore(); }
    }
  }
  function drawCounter(ctx, t, ex) {
    const a = t - SC.counterIn; if (a < 0 || ex >= 1) return;
    const s = 0.55 + 0.45 * sp(a, 2.4, 0.5), x = 1300 + ex * 420, y = 330, w = 400, h = 250;
    ctx.save(); ctx.globalAlpha *= clamp(a / 0.12) * (1 - ex); if (ex > 0) ctx.filter = `blur(${(ex * 16).toFixed(1)}px)`;
    ctx.translate(x, y + h / 2); ctx.scale(s, s); ctx.translate(-x, -(y + h / 2));
    K.glass(ctx, x, y, w, h, 34, { fill: 'rgba(255,255,255,.82)' });
    ctx.beginPath(); ctx.arc(x + 50, y + 50, 22, 0, TAU); ctx.fillStyle = '#FBE3E8'; ctx.fill(); K.icon(ctx, 'envelope', x + 50, y + 50, 24, C.rose, 2);
    ctx.letterSpacing = '4px'; K.UI.text(ctx, 'RSVPS', x + 86, y + 57, 17, 600, C.ink2, 'left', F.caps); ctx.letterSpacing = '0px';
    const p = remap(t, SC.tick, SC.tick + 0.38, 0, 1, ease.outExpo);
    K.font(ctx, 112, 800, F.sans); const d8 = ctx.measureText('8').width;
    ctx.save(); ctx.beginPath(); ctx.rect(x + 20, y + 80, 260, 116); ctx.clip();
    K.UI.text(ctx, '8', x + 32, y + 180, 112, 800, C.ink);
    if (p < 1) { ctx.save(); ctx.globalAlpha *= 1 - p; if (p > 0) ctx.filter = `blur(${(p * 8).toFixed(1)}px)`; K.UI.text(ctx, '7', x + 32 + d8, y + 180 - p * 110, 112, 800, C.ink); ctx.restore(); }
    if (p > 0) { ctx.save(); ctx.globalAlpha *= p; if (p < 1) ctx.filter = `blur(${((1 - p) * 8).toFixed(1)}px)`; K.UI.text(ctx, '8', x + 32 + d8, y + 180 + (1 - p) * 110, 112, 800, C.ink); ctx.restore(); }
    ctx.restore();
    const pa = t - (SC.tick + 0.05);
    if (pa > 0) { ctx.save(); const ps = sp(pa, 2.8, 0.4); ctx.translate(x + 60 + d8 * 2 + 36, y + 142); ctx.scale(ps, ps); K.UI.pill(ctx, '+1', 0, 0, { align: 'center', bg: '#DDF3E6', fg: '#2F7A55', size: 20, padX: 14 }); ctx.restore(); }
    K.UI.text(ctx, 'attending · 12 to go', x + 34, y + 222, 18, 600, C.ink2);
    const av = [['AC', C.lilac], ['TM', C.peach], ['RL', C.sage], ['JB', C.sky]];
    av.forEach(([s0, col], i) => { const ax = x + w - 44 - i * 26, ay = y + 50; ctx.beginPath(); ctx.arc(ax, ay, 18, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill(); K.UI.avatar(ctx, ax, ay, 16, s0, col); });
    if (pa > 0) { const ax = x + w - 44 - 4 * 26, ay = y + 50, ps = sp(pa, 2.8, 0.4); ctx.save(); ctx.translate(ax, ay); ctx.scale(ps, ps); ctx.beginPath(); ctx.arc(0, 0, 18, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill(); K.UI.avatar(ctx, 0, 0, 16, 'GP', C.blush); ctx.restore(); }
    ctx.restore();
    if (ex <= 0) burst(ctx, x + 32 + d8 * 1.5, y + 140, t - SC.tick, 12, 170, 77);
  }
  function objPos(i, t) { // 3D objects in phone world (scene 9 → 10)
    const [name, popT, x3, y3, s3, b3] = OBJ3[i];
    const [fx, fy] = K.float(t, i * 2.3 + 1, 14, 0.5), rot = Math.sin(t * 0.6 + i * 1.7) * 0.09;
    if (popT == null) { // carried from scene 9
      const s2 = [[470, 400, 250, 0], [575, 790, 190, 0]][i], pt = SC.objs[i], a = t - pt;
      if (a < 0) return null;
      const m = ease.inOutCubic(clamp((t - 32.85) / 0.75));
      return { name, x: lerp(s2[0], x3, m) + fx, y: lerp(s2[1], y3, m) + fy, size: lerp(s2[2], s3, m) * sp(a, 2.2, 0.4), blur: lerp(0, b3, m), rot, alpha: clamp(a / 0.08) };
    }
    const a = t - popT; if (a < 0) return null;
    return { name, x: x3 + fx, y: y3 + fy, size: s3 * sp(a, 2.2, 0.42), blur: b3, rot, alpha: clamp(a / 0.08) };
  }
  function drawObjs(ctx, t) { OBJ3.forEach((o, i) => { const p = objPos(i, t); if (p && p.size > 2) K.obj(ctx, p.name, p.x, p.y, p.size, { rot: p.rot, blur: p.blur > 0.3 ? p.blur : 0, alpha: p.alpha }); }); }

  function drawScan(ctx, t) {
    if (t < SC.pull) {
      const b = scanBuffer(t);
      if (t < SC.start + 0.3) { // zoom-blur in from type B
        const p = clamp((t - SC.start) / 0.3), s = lerp(1.25, 1, ease.outCubic(p));
        K.zoomBlur(ctx, 0.3 * (1 - ease.outCubic(p)), g => { g.translate(960, 540); g.scale(s, s); g.translate(-960, -540); g.drawImage(b, 0, 0); });
        K.fade(ctx, 0.92 * (1 - ease.outQuad(clamp(p * 1.4))));
      } else ctx.drawImage(b, 0, 0);
      return;
    }
    const L = phoneLayout(t), mb = t < SC.pullEnd ? Math.sin(Math.PI * clamp((t - SC.pull) / (SC.pullEnd - SC.pull))) * 0.05 : 0;
    const ex = ease.inCubic(clamp((t - 32.75) / 0.3));
    const world = g => {
      K.bgMesh(g, t, { blobs: MESH() });
      drawObjs(g, t);
      K.phone(g, { x: L.x, y: L.y, h: L.h }, sg => drawScreen2(sg, t), 'c');
      drawCounter(g, t, ex);
      const ts = touchState(t, L);
      if (ts) K.touch(g, ts.x, ts.y, ts.press, { alpha: ts.a, ripple: ts.ripple });
    };
    if (mb > 0.002) K.zoomBlur(ctx, mb, world); else world(ctx);
  }
  function touchState(t, L) {
    if (t < SC.touchIn || t > 32.4) return null;
    let lx, ly;
    if (t < SC.tap - 0.05) { const q = ease.outCubic(clamp((t - SC.touchIn) / 0.25)); lx = lerp(330, 205, q); ly = lerp(830, 669, q); }
    else if (t < 31.55) { lx = 205; ly = 669; }
    else { const q = ease.inOutCubic(clamp((t - 31.55) / 0.25)); lx = lerp(205, 250, q); ly = lerp(669, 466, q); }
    const press = Math.max(pulse(t, SC.tap - 0.06, SC.tap + 0.1), pulse(t, SC.meal - 0.06, SC.meal + 0.1));
    let ripple = null; if (t >= SC.tap && t < SC.tap + 0.45) ripple = (t - SC.tap) / 0.45; else if (t >= SC.meal && t < SC.meal + 0.45) ripple = (t - SC.meal) / 0.45;
    const [x, y] = K.phonePoint(L, lx, ly);
    return { x, y, press, ripple, a: clamp((t - SC.touchIn) / 0.1) * (1 - clamp((t - 32.1) / 0.25)) };
  }

  // ═════════════════════════ SCENE 10 — QUESTION BUBBLES (33.0–38.0) ═════════════════════════
  function drawBubble(ctx, b, t) {
    const a = t - b.t; if (a <= 0) return;
    const [fx, fy] = K.float(t, b.x * 0.01, 9, 0.55), x = b.x + fx, y = b.y + fy;
    K.font(ctx, 25, 600, F.sans); const tw = ctx.measureText(b.text).width, h = 80, w = 16 + 52 + 16 + tw + 30;
    const s = 0.35 + 0.65 * sp(a, 2.3, 0.42), al = clamp(a / 0.12), bl = (1 - clamp(a / 0.2)) * 8;
    const ax = x - b.side * 0 + (b.side < 0 ? w / 2 - 30 : -w / 2 + 30), ay = y + h / 2; // tail anchor
    ctx.save(); ctx.globalAlpha *= al; if (bl > 0.3) ctx.filter = `blur(${bl.toFixed(1)}px)`;
    ctx.translate(ax, ay); ctx.scale(s, s); ctx.translate(-ax, -ay);
    // tail dots toward the phone
    for (const [dx, dy, r] of [[b.side < 0 ? 14 : -14, 16, 9], [b.side < 0 ? 30 : -30, 32, 5]]) { ctx.beginPath(); ctx.arc(ax + dx, ay + dy, r, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.fill(); }
    K.glass(ctx, x - w / 2, y - h / 2, w, h, h / 2, { fill: 'rgba(255,255,255,.8)' });
    ctx.beginPath(); ctx.arc(x - w / 2 + 16 + 26, y, 26, 0, TAU); ctx.fillStyle = b.col; ctx.fill();
    K.icon(ctx, b.icon, x - w / 2 + 42, y, 28, C.ink, 1.9);
    // text types on
    const n = Math.floor(clamp((a - 0.05) / 0.35) * b.text.length);
    K.UI.text(ctx, b.text.slice(0, Math.max(n, 0)), x - w / 2 + 84, y + 9, 25, 600, C.ink);
    ctx.restore();
    // answer chip (typing dots → answer)
    const ta = a - 0.18; if (ta <= 0) return;
    K.font(ctx, 22, 700, F.sans); const aw = ctx.measureText(b.ans).width, fullW = 14 + 36 + 12 + aw + 22, ch = 54;
    const mo = ease.outExpo(clamp((a - ANS_DELAY) / 0.35)), cw = lerp(86, fullW, mo);
    const cx = b.side < 0 ? x + w / 2 - cw / 2 - 8 : x - w / 2 + cw / 2 + 8, cy = y + h / 2 + 42 + K.float(t, b.y, 4, 0.7)[1];
    const cs = 0.4 + 0.6 * sp(ta, 2.6, 0.45) + 0.08 * pulse(a, ANS_DELAY, ANS_DELAY + 0.25);
    ctx.save(); ctx.globalAlpha *= clamp(ta / 0.1); ctx.translate(cx, cy); ctx.scale(cs, cs);
    ctx.fillStyle = 'rgba(80,40,120,.10)'; K.rr(ctx, -cw / 2 + 2, -ch / 2 + 8, cw, ch, ch / 2); ctx.fill();
    K.rr(ctx, -cw / 2, -ch / 2, cw, ch, ch / 2); ctx.fillStyle = '#FFFFFF'; ctx.fill();
    ctx.save(); ctx.clip();
    if (mo < 1) { ctx.globalAlpha *= 1 - clamp(mo * 2.5); for (let i = 0; i < 3; i++) { const bo = Math.sin((t * 9) - i * 0.9) * 0.5 + 0.5; ctx.beginPath(); ctx.arc(-18 + i * 18, -bo * 4, 5, 0, TAU); ctx.fillStyle = `rgba(107,90,126,${0.35 + bo * 0.5})`; ctx.fill(); } ctx.globalAlpha = 1; }
    if (mo > 0) {
      ctx.globalAlpha = clamp(mo * 1.6); const lx = -cw / 2 + 14;
      ctx.beginPath(); ctx.arc(lx + 18, 0, 18, 0, TAU); ctx.fillStyle = b.aCol; ctx.fill(); iconX(ctx, b.aIcon, lx + 18, 0, 21, '#fff', 2.2);
      K.UI.text(ctx, b.ans, lx + 48, 8, 22, 700, C.ink);
    }
    ctx.restore(); ctx.restore();
  }
  function drawSmallIcons(ctx, t) {
    ICONS3.forEach(([name, pt, x, y], i) => {
      const a = t - pt; if (a <= 0) return; const [fx, fy] = K.float(t, 40 + i * 3, 10, 0.6), s = sp(a, 2.6, 0.4);
      ctx.save(); ctx.globalAlpha *= clamp(a / 0.1); ctx.translate(x + fx, y + fy); ctx.scale(s, s);
      K.glass(ctx, -34, -34, 68, 68, 34, { fill: 'rgba(255,255,255,.55)' }); K.icon(ctx, name, 0, 0, 30, '#7A63A8', 1.9);
      ctx.restore();
    });
  }
  function bubblesFrame(g, t) {
    K.bgMesh(g, t, { blobs: MESH() });
    // far objects (blurred) first, then phone, then near things
    drawObjs(g, t);
    const L = phoneLayout(t);
    K.phone(g, { x: L.x, y: L.y, h: L.h, yaw: L.yaw }, sg => {
      const sw = ease.inOutQuart(clamp((t - SC.swipe) / (SC.swipeEnd - SC.swipe)));
      if (sw < 1) { sg.save(); sg.translate(-390 * sw, 0); drawRSVP(sg, t); sg.restore(); sg.save(); sg.translate(390 * (1 - sw), 0); drawChecklist(sg, t); sg.restore(); }
      else drawChecklist(sg, t);
    }, 'c');
    drawSmallIcons(g, t);
    BUBBLES.forEach(b => drawBubble(g, b, t));
  }
  function drawBubbles(ctx, t) {
    if (t < ZOOM_OUT) { bubblesFrame(ctx, t); return; }
    const p = clamp((t - ZOOM_OUT) / 0.5), s = 1 + ease.inCubic(p) * 0.9;
    K.zoomBlur(ctx, 0.38 * ease.inQuad(p), g => { g.translate(960, 540); g.scale(s, s); g.translate(-960, -540); bubblesFrame(g, t); }, 960, 540, 7);
    K.fade(ctx, ease.inQuad(clamp((t - 37.55) / 0.4)));
  }

  K.addScene({ name: 'c_typeB', start: 25.0, end: 29.0, draw: (ctx, t) => drawTypeB(ctx, t) });
  K.addScene({ name: 'c_scan', start: 29.0, end: 33.0, draw: (ctx, t) => drawScan(ctx, t) });
  K.addScene({ name: 'c_bubbles', start: 33.0, end: 38.0, draw: (ctx, t) => drawBubbles(ctx, t) });
})();
