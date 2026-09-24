/* Scene D — ACT 7 "THE DAY" (46–54) + ACT 8 "THE LOGO" (54–60).
 *
 * 46.00  white-gold flash (hand-off from C's zoom-through) resolves to the paper world
 * 46.0–49.0  ink draws the aisle; flowers bloom on the 16th grid (every 0.25 s), arch grows + curls
 * 46.7–49.3  Dot (veil, bouquet) & Dash (bow tie) walk in from both sides; Biscuit trots up the aisle with the rings
 * 49.35  camera pushes in; 49.7 Dot "I do." 50.5 Dash "I do." (hands held, glistening eyes)
 * 51.20  kiss → heart shockwave, petals, confetti; fireworks 51.30 / 51.80 (+ small 51.47 / 51.95)
 * 52.0–52.55  pull back: the world is a spread in a picture book on a dark table
 * 52.32–53.74 pages riffle BACKWARDS through the film (FILM.snapshot thumbnails)
 * 53.62–54.00 the front cover swings over; 54.00 THUMP (dust, camera bump)
 * 54.3  foil shimmer sweep · 56.1 hand-lettered "Write the next one together."
 * 57.3  tagline on cover · 57.85 "OUT NOW" · 58.8 Biscuit pops up "WOOF!" · 59.5 iris → black
 */
(function () {
  const F = FILM, P = F.PAL, W = F.W, H = F.H, TAU = F.TAU;
  const { clamp, lerp, invLerp, ease, spring, jiggle, hash, hash2, noise1 } = F;

  const LEAF_DARK = '#1F6B4A', LEAF = '#3DDC97', LEAF_SH = '#25B075', CREAM = '#FFFBF2';
  const CLOTH = '#1B2797', CLOTH_DK = '#0F1765';
  const WHITE_P = '#FFFDF7';

  // ═════════════════════════════ WORLD GEOMETRY ═════════════════════════════
  // One-point perspective: ground point at depth z (1 = near) has screen y = VPY + FH / z.
  const VPX = 960, VPY = 470, FH = 680, GY = 760, ZA = FH / (GY - VPY); // ZA ≈ 2.345 (arch depth)
  const yAt = z => VPY + FH / z;
  const xAt = (off, z) => VPX + off / z;
  const SC = 0.85; // couple scale at the arch

  const tint = (hex, k) => { // mix with white
    const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    const m = v => Math.round(v + (255 - v) * k);
    return `rgb(${m(r)},${m(g)},${m(b)})`;
  };

  // ── bloom schedule: 13 events at 46.00 … 49.00 (every 0.25 s)
  const BLOOM = i => 46 + i * 0.25;
  const FL_COLS = [P.coral, P.blush, P.gold, P.lilac, P.mint, WHITE_P];
  const FLOWERS = [], BUSHES = [];
  (function build() {
    const r = F.rng(4601);
    const pick = a => a[Math.floor(r() * a.length)];
    for (let k = 0; k < 9; k++) {
      for (const side of [-1, 1]) {
        const z = lerp(1.1, 2.2, k / 8) + (side > 0 ? 0.012 : 0), tb = BLOOM(k);
        BUSHES.push({ z: z + 0.03, off: side * (520 + r() * 40), size: 1 + r() * .3, tb: tb - .02, seed: r() * 100 });
        if (k % 2 === 0) BUSHES.push({ z: z - .02, off: side * (820 + r() * 160), size: 1.1 + r() * .4, tb: tb + .1, seed: r() * 100 });
        FLOWERS.push({ z, off: side * (455 + r() * 30), size: 1.1 + r() * .2, type: (k * 2 + (side > 0 ? 1 : 0)) % 5, col: FL_COLS[(k * 3 + (side > 0 ? 2 : 0)) % 6], tb, seed: r() * 100, lean: -side * .1, main: true });
        FLOWERS.push({ z: z - .035, off: side * (575 + r() * 50), size: .72 + r() * .15, type: Math.floor(r() * 5), col: pick(FL_COLS), tb: tb + .07, seed: r() * 100, lean: -side * .05 });
        FLOWERS.push({ z: z + .05, off: side * (405 + r() * 20), size: .55 + r() * .12, type: Math.floor(r() * 5), col: pick(FL_COLS), tb: tb + .13, seed: r() * 100, lean: -side * .12 });
        FLOWERS.push({ z: z - .015, off: side * (700 + r() * 260), size: .85 + r() * .3, type: Math.floor(r() * 5), col: pick(FL_COLS), tb: tb + .18, seed: r() * 100, lean: side * .04 });
      }
    }
  })();

  // ── arch (at depth ZA)
  const ARCH_L = 680, ARCH_R = 1240, ARCH_TOP = 470, ARCH_CX = 960, ARCH_RAD = 280;
  const ARCH = [];
  for (let i = 0; i <= 10; i++) ARCH.push([ARCH_L, GY - (GY - ARCH_TOP) * i / 10]);
  for (let i = 1; i <= 36; i++) { const a = Math.PI + i / 36 * Math.PI; ARCH.push([ARCH_CX + Math.cos(a) * ARCH_RAD, ARCH_TOP + Math.sin(a) * ARCH_RAD]); }
  for (let i = 1; i <= 10; i++) ARCH.push([ARCH_R, ARCH_TOP + (GY - ARCH_TOP) * i / 10]);
  const ARCH_LEN = [0];
  for (let i = 1; i < ARCH.length; i++) ARCH_LEN.push(ARCH_LEN[i - 1] + Math.hypot(ARCH[i][0] - ARCH[i - 1][0], ARCH[i][1] - ARCH[i - 1][1]));
  const ARCH_TOTAL = ARCH_LEN[ARCH_LEN.length - 1];
  function archAt(u) { // point + outward normal at fraction u of the arch
    const d = clamp(u) * ARCH_TOTAL;
    let i = 1; while (i < ARCH.length - 1 && ARCH_LEN[i] < d) i++;
    const a = ARCH[i - 1], b = ARCH[i], f = (d - ARCH_LEN[i - 1]) / ((ARCH_LEN[i] - ARCH_LEN[i - 1]) || 1);
    const tx = b[0] - a[0], ty = b[1] - a[1], L = Math.hypot(tx, ty) || 1;
    return { x: lerp(a[0], b[0], f), y: lerp(a[1], b[1], f), nx: ty / L, ny: -tx / L };
  }
  const ARCH_FL = [
    { u: .10, tb: BLOOM(9), size: 1.25, type: 0, col: P.coral }, { u: .21, tb: BLOOM(9) + .08, size: 1.0, type: 1, col: WHITE_P },
    { u: .90, tb: BLOOM(10), size: 1.25, type: 4, col: P.blush }, { u: .79, tb: BLOOM(10) + .08, size: 1.0, type: 0, col: P.lilac },
    { u: .33, tb: BLOOM(11), size: 1.15, type: 3, col: P.blush }, { u: .67, tb: BLOOM(11), size: 1.15, type: 3, col: P.coral },
    { u: .40, tb: BLOOM(11) + .08, size: .9, type: 1, col: P.gold }, { u: .60, tb: BLOOM(11) + .08, size: .9, type: 0, col: P.gold },
    { u: .50, tb: BLOOM(12), size: 1.75, type: 4, col: P.coral }, { u: .455, tb: BLOOM(12) + .06, size: 1.05, type: 0, col: P.lilac },
    { u: .545, tb: BLOOM(12) + .06, size: 1.05, type: 1, col: WHITE_P }, { u: .02, tb: BLOOM(12) + .1, size: 1.1, type: 2, col: P.gold },
    { u: .98, tb: BLOOM(12) + .1, size: 1.1, type: 2, col: P.lilac },
  ].map((f, i) => Object.assign(f, { seed: 300 + i * 7, stemless: true }));

  // ═════════════════════════════ FLOWERS ═════════════════════════════
  function leafShape(g, x, y, len, ang, lw) {
    if (len < 1) return;
    g.save(); g.translate(x, y); g.rotate(ang);
    g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(len * .5, -len * .42, len, 0); g.quadraticCurveTo(len * .5, len * .42, 0, 0);
    g.fillStyle = LEAF; g.fill(); g.lineWidth = lw; g.strokeStyle = P.ink; g.stroke();
    if (len > 18) { g.beginPath(); g.moveTo(len * .12, 0); g.lineTo(len * .78, 0); g.lineWidth = lw * .6; g.stroke(); }
    g.restore();
  }
  function petal(g, dist, ang, rx, ry, fill) {
    g.save(); g.rotate(ang); g.beginPath(); g.ellipse(dist, 0, Math.max(.5, rx), Math.max(.5, ry), 0, 0, TAU);
    g.fillStyle = fill; g.fill(); g.stroke(); g.restore();
  }
  function flowerHead(g, f, R, dt, t, lw) {
    const o = Math.max(0, spring(dt - .1, 2.4, .36));
    const b = F.boil(t), jit = i => (hash2(b + i * 3.1, f.seed) - .5) * .07;
    const oi = i => Math.max(0, spring(dt - .1 - i * .022, 2.6, .36));
    g.lineWidth = lw; g.strokeStyle = P.ink; g.lineJoin = 'round';
    if (dt < .16) { // bud
      const k = ease.outBack(clamp(dt / .1));
      g.beginPath(); g.ellipse(0, -R * .1, R * .28 * k, R * .4 * k, 0, 0, TAU); g.fillStyle = f.col; g.fill(); g.stroke();
      if (o < .15) return;
    }
    const centre = f.col === P.gold ? P.coral : P.gold;
    switch (f.type) {
      case 0: { // five-petal blossom
        for (let i = 0; i < 5; i++) { const k = oi(i); petal(g, R * .47 * k, -Math.PI / 2 + i * TAU / 5 + (1 - k) * .9 + jit(i), R * .52 * (.3 + .7 * k), R * .42 * (.3 + .7 * k), f.col); }
        g.beginPath(); g.arc(0, 0, R * .26 * o, 0, TAU); g.fillStyle = centre; g.fill(); g.stroke();
        break;
      }
      case 1: { // daisy
        for (let i = 0; i < 12; i++) { const k = oi(i * .5); petal(g, R * .56 * k, i * TAU / 12 + (1 - k) * 1.2 + jit(i), R * .46 * (.25 + .75 * k), R * .15, f.col); }
        g.beginPath(); g.arc(0, 0, R * .3 * o, 0, TAU); g.fillStyle = centre; g.fill(); g.stroke();
        for (let i = 0; i < 5; i++) { const a = i * 2.4; g.beginPath(); g.arc(Math.cos(a) * R * .13 * o, Math.sin(a) * R * .13 * o, Math.max(.6, R * .035), 0, TAU); g.fillStyle = P.ink; g.fill(); }
        break;
      }
      case 2: { // tulip cup
        const sp = .3 * o;
        g.save(); g.translate(0, -R * .2);
        for (const s of [-1, 1]) { g.save(); g.rotate(s * (.28 + sp)); g.beginPath(); g.ellipse(s * R * .16, 0, R * .34 * (.5 + .5 * o), R * .62 * (.4 + .6 * o), 0, 0, TAU); g.fillStyle = f.col; g.fill(); g.stroke(); g.restore(); }
        g.beginPath(); g.moveTo(-R * .3 * o, R * .45); g.quadraticCurveTo(-R * .42, -R * .3, 0, -R * .62 * (.4 + .6 * o)); g.quadraticCurveTo(R * .42, -R * .3, R * .3 * o, R * .45); g.closePath();
        g.fillStyle = tint(f.col === WHITE_P ? P.blush : f.col, .25); g.fill(); g.stroke();
        g.restore();
        break;
      }
      case 3: { // rose / ranunculus
        for (let i = 0; i < 7; i++) { const k = oi(i * .6); petal(g, R * .52 * k, i * TAU / 7 + (1 - k) * .8 + jit(i), R * .36 * (.3 + .7 * k), R * .33 * (.3 + .7 * k), f.col); }
        g.beginPath(); g.arc(0, 0, R * .56 * o, 0, TAU); g.fillStyle = tint(f.col === WHITE_P ? P.blush : f.col, .18); g.fill(); g.stroke();
        const sp = [];
        for (let i = 0; i <= 22; i++) { const u = i / 22, a = u * 3.4 * Math.PI + (dt < .6 ? (1 - o) * 2 : 0); sp.push([Math.cos(a) * R * .5 * (1 - u) * o, Math.sin(a) * R * .5 * (1 - u) * o]); }
        if (o > .2) { F.smoothOpen(g, F.partialPolyline(sp.reverse(), clamp(o))); g.lineWidth = lw * .8; g.stroke(); }
        break;
      }
      default: { // pom / peony
        for (let i = 0; i < 9; i++) { const k = oi(i * .5); petal(g, R * .55 * k, i * TAU / 9 + (1 - k) * 1 + jit(i), R * .36 * (.3 + .7 * k), R * .36 * (.3 + .7 * k), f.col); }
        const inner = tint(f.col === WHITE_P ? P.blush : f.col, .35);
        for (let i = 0; i < 7; i++) { const k = oi(3 + i * .5); petal(g, R * .27 * k, i * TAU / 7 + .3 + (1 - k) * 1.3 + jit(i + 9), R * .28 * (.3 + .7 * k), R * .28 * (.3 + .7 * k), inner); }
        g.beginPath(); g.arc(0, 0, R * .12 * o, 0, TAU); g.fillStyle = centre; g.fill(); g.stroke();
      }
    }
  }
  function drawFlower(g, f, x, y, sc, t) {
    const dt = t - f.tb; if (dt <= 0) return;
    const R = 40 * sc, lw = Math.max(1.5, 3.3 * sc);
    let hx = x, hy = y;
    const sway = noise1(t * .7 + f.seed, 3) * 5 * sc;
    if (!f.stemless) {
      const grow = ease.outBack(clamp(dt / .16), 1.3), stemH = 95 * sc * grow;
      hx = x + sway + (f.lean || 0) * stemH; hy = y - stemH;
      F.inkLine(g, [[x, y], [x + (hx - x) * .25, y - stemH * .5], [hx, hy]], { t, seed: f.seed, lw: Math.max(2, 4.5 * sc), stroke: LEAF_DARK, amp: .5 });
      const lk = Math.max(0, spring(dt - .05, 2.8, .4));
      if (lk > 0) { leafShape(g, x + (hx - x) * .3, y - stemH * .38, 30 * sc * lk, -Math.PI + .65, lw * .8); leafShape(g, x + (hx - x) * .45, y - stemH * .55, 26 * sc * lk, -.6, lw * .8); }
    } else {
      const lk = Math.max(0, spring(dt - .02, 2.8, .4));
      for (let i = 0; i < 3; i++) leafShape(g, x, y, 34 * sc * lk, f.seed + i * 2.1, lw * .8);
    }
    g.save(); g.translate(hx, hy); g.rotate((f.lean || 0) * .6 + sway * .01 + jiggle(dt - .1, 2.5, 4) * .1);
    flowerHead(g, f, R, dt, t, lw);
    g.restore();
    if (f.main || f.stemless) { // bloom sparkle
      const sp = invLerp(.06, .42, dt);
      if (sp > 0 && sp < 1) {
        g.save(); g.globalAlpha = 1 - sp;
        for (let i = 0; i < 3; i++) { const a = f.seed + i * 2.1, d = R * (1 + sp * 1.4); F.sparkle(g, hx + Math.cos(a) * d, hy + Math.sin(a) * d, (10 + 8 * i % 2) * sc * (1 - sp * .4), i ? P.gold : '#fff', sp * 2); }
        g.restore();
      }
    }
  }
  function drawBush(g, b, x, y, sc, t) {
    const dt = t - b.tb; if (dt <= 0) return;
    const k = Math.max(0, spring(dt, 2.6, .35)); if (k <= 0) return;
    const blobs = [[-44, -26, 34], [-8, -46, 42], [34, -30, 34], [8, -14, 36], [-30, -8, 26], [44, -8, 24]];
    g.save(); g.translate(x, y); g.scale(sc * b.size * k, sc * b.size * k);
    const bo = F.boil(t);
    const pts = blobs.map((c, i) => [c[0] + (hash2(bo, i + b.seed) - .5) * 2, c[1] + (hash2(bo + 1, i + b.seed) - .5) * 2, c[2]]);
    g.beginPath(); for (const c of pts) { g.moveTo(c[0] + c[2], c[1]); g.arc(c[0], c[1], c[2], 0, TAU); }
    g.lineWidth = 9; g.strokeStyle = P.ink; g.stroke(); g.fillStyle = LEAF_SH; g.fill();
    g.beginPath(); for (const c of pts) { g.moveTo(c[0] - c[2] * .15 + c[2] * .7, c[1] - c[2] * .2); g.arc(c[0] - c[2] * .15, c[1] - c[2] * .2, c[2] * .7, 0, TAU); }
    g.fillStyle = LEAF; g.fill();
    g.restore();
  }

  // ═════════════════════════════ BACKGROUND ═════════════════════════════
  const HILLS = [];
  for (let i = 0; i <= 24; i++) { const x = -200 + i * 97; HILLS.push([x, VPY - 18 - 34 * (.5 + .5 * Math.sin(i * .9 + 1)) - 20 * (.5 + .5 * Math.sin(i * .37))]); }
  let BG = null;
  function bgStatic() { // paper + golden-hour sky + sun + rays + ground, baked once (world coords == frame at zoom 1)
    if (BG) return BG;
    const c = F.canvas(W, H), g = c.getContext('2d'), t = 46;
    F.paper(g);
    const sky = g.createLinearGradient(0, -200, 0, VPY + 40);
    sky.addColorStop(0, 'rgba(255,190,140,.55)'); sky.addColorStop(.6, 'rgba(255,214,160,.35)'); sky.addColorStop(1, 'rgba(255,236,200,.15)');
    g.save(); g.globalCompositeOperation = 'multiply'; g.fillStyle = sky; g.fillRect(-400, -400, W + 800, VPY + 440); g.restore();
    g.save(); g.globalCompositeOperation = 'lighter';
    const sg = g.createRadialGradient(960, 360, 20, 960, 360, 620);
    sg.addColorStop(0, 'rgba(255,220,150,.55)'); sg.addColorStop(.35, 'rgba(255,196,110,.22)'); sg.addColorStop(1, 'rgba(255,190,110,0)');
    g.fillStyle = sg; g.fillRect(340, -260, 1240, 1240);
    g.globalAlpha = .07; g.fillStyle = '#FFE2A8';
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i - 4.5) * .3 + Math.sin(t * .4 + i) * .03, w = .05 + hash(i) * .05;
      g.beginPath(); g.moveTo(960, 360); g.lineTo(960 + Math.cos(a - w) * 1500, 360 + Math.sin(a - w) * 1500); g.lineTo(960 + Math.cos(a + w) * 1500, 360 + Math.sin(a + w) * 1500); g.fill();
    }
    g.restore();
    g.save(); F.smoothOpen(g, HILLS); g.lineTo(2200, VPY + 20); g.lineTo(-300, VPY + 20); g.closePath(); g.fillStyle = 'rgba(242,206,160,.7)'; g.fill(); g.restore();
    g.save(); g.fillStyle = 'rgba(236,220,190,.55)'; g.fillRect(-400, VPY + 10, W + 800, H + 400); g.restore();
    g.save(); g.globalCompositeOperation = 'soft-light'; g.fillStyle = 'rgba(255,190,110,.35)'; g.fillRect(0, 0, W, H); g.restore();
    F.vignette(g, .22, '120,70,30');
    return (BG = c);
  }
  function background(g, t) {
    g.drawImage(bgStatic(), 0, 0);
    const hills = HILLS;
    const hp = ease.outCubic(invLerp(46.0, 46.6, t));
    if (hp > 0) F.inkLine(g, F.partialPolyline(hills, hp), { t, seed: 5, lw: 3, stroke: 'rgba(22,22,29,.55)' });
    // far lollipop trees
    for (let i = 0; i < 6; i++) {
      const x = [230, 380, 520, 1400, 1560, 1720][i], y = VPY - 6 + (i % 2) * 6, r = 22 + (i % 3) * 6, k = Math.max(0, spring(t - 46.35 - i * .06, 2.5, .4));
      if (k <= 0) continue;
      g.save(); g.translate(x, y); g.scale(k, k);
      F.inkLine(g, [[0, 0], [0, -r * 1.4]], { t, seed: 60 + i, lw: 3 });
      F.inkShape(g, F.circlePts(0, -r * 1.9, r, 14), { fill: [P.blush, P.lilac, P.mint][i % 3], t, seed: 70 + i, lw: 3, amp: .8 });
      g.restore();
    }
    const hz = ease.inOutCubic(invLerp(46.0, 46.5, t));
    if (hz > 0) F.inkLine(g, [[960 - 1300 * hz, VPY + 12], [960, VPY + 11], [960 + 1300 * hz, VPY + 12]], { t, seed: 3, lw: 3.5 });
    // grass ticks
    g.save(); g.lineWidth = 2.5; g.strokeStyle = 'rgba(22,22,29,.35)'; g.lineCap = 'round';
    for (let i = 0; i < 70; i++) {
      const z = 1.05 + hash(i * 1.7) * 3.2, off = (hash(i * 3.3) - .5) * 3200, x = xAt(off, z), y = yAt(z), s = 1.8 / z;
      if (Math.abs(off) < 420 || t < 46.1 + hash(i) * .6) continue;
      g.beginPath(); g.moveTo(x - 8 * s, y); g.lineTo(x - 11 * s, y - 12 * s); g.moveTo(x, y); g.lineTo(x + 1 * s, y - 16 * s); g.moveTo(x + 7 * s, y); g.lineTo(x + 11 * s, y - 11 * s); g.stroke();
    }
    g.restore();
  }
  function aisle(g, t) {
    const zN = .9, zF = ZA - .02, hw = 380;
    const L = [], Rr = [];
    for (let i = 0; i <= 8; i++) { const z = lerp(zN, zF, i / 8); L.push([xAt(-hw, z), yAt(z)]); Rr.push([xAt(hw, z), yAt(z)]); }
    const fp = ease.outCubic(invLerp(46.35, 46.9, t));
    if (fp > 0) { // runner fill
      g.save(); g.globalAlpha = fp;
      g.beginPath(); g.moveTo(L[0][0], L[0][1]); for (const p of L) g.lineTo(p[0], p[1]); for (let i = Rr.length - 1; i >= 0; i--) g.lineTo(Rr[i][0], Rr[i][1]); g.closePath();
      g.fillStyle = CREAM; g.fill();
      // coral inner border lines
      g.setLineDash([22, 16]); g.lineWidth = 3; g.strokeStyle = P.coral;
      for (const s of [-1, 1]) { g.beginPath(); for (let i = 0; i <= 8; i++) { const z = lerp(zN, zF, i / 8); g.lineTo(xAt(s * hw * .84, z), yAt(z)); } g.stroke(); }
      g.setLineDash([]);
      // scattered petals on runner
      for (let i = 0; i < 26; i++) {
        const z = 1 + hash(i * 5.1) * 1.3, off = (hash(i * 2.7) - .5) * 600, tb = 46.5 + hash(i * 9.3) * 2.5;
        if (t < tb) continue;
        const a = Math.min(1, (t - tb) * 4), s = 1.6 / z;
        g.save(); g.translate(xAt(off, z), yAt(z) - 4 * s); g.rotate(i); g.globalAlpha = fp * a;
        g.beginPath(); g.ellipse(0, 0, 9 * s, 5 * s, 0, 0, TAU); g.fillStyle = [P.blush, P.coral, P.lilac][i % 3]; g.fill(); g.restore();
      }
      g.restore();
    }
    // ink edges draw themselves from the viewer to the arch
    const lp = ease.inOutCubic(invLerp(46.05, 46.75, t));
    if (lp > 0) {
      for (const [pts, seed] of [[L, 11], [Rr, 12]]) {
        const pp = F.partialPolyline(pts, lp);
        F.inkLine(g, pp, { t, seed, lw: 6 });
        if (lp < 1) { const h = pp[pp.length - 1]; g.beginPath(); g.arc(h[0], h[1], 7, 0, TAU); g.fillStyle = P.ink; g.fill(); }
      }
    }
  }
  function drawArch(g, t) {
    const half = [ARCH.slice(0, 29), ARCH.slice(28).reverse()];
    const gp = ease.inOutCubic(invLerp(46.35, 47.45, t));
    if (gp <= 0) return;
    for (let s = 0; s < 2; s++) {
      const pp = F.partialPolyline(half[s], gp);
      if (pp.length < 2) continue;
      F.inkLine(g, pp, { t, seed: 40 + s, lw: 30 });
      F.inkLine(g, pp, { t, seed: 40 + s, lw: 19, stroke: '#FFF2D6' });
      // leading ink blob while drawing
      if (gp < 1) { const h = pp[pp.length - 1]; g.beginPath(); g.arc(h[0], h[1], 13, 0, TAU); g.fillStyle = P.ink; g.fill(); }
    }
    // feet
    for (const x of [ARCH_L, ARCH_R]) F.inkShape(g, F.roundRectPts(x - 26, GY - 16, 52, 20, 6, 20), { fill: '#FFF2D6', t, seed: x, lw: 4 });
    // vines winding up both halves
    const vp = invLerp(47.0, 48.4, t);
    if (vp > 0) {
      for (let s = 0; s < 2; s++) {
        const pts = [];
        for (let i = 0; i <= 60; i++) { const u = s ? 1 - .5 * i / 60 : .5 * i / 60, a = archAt(u), o = Math.sin(i * .85) * 14; pts.push([a.x + a.nx * o, a.y + a.ny * o]); }
        F.inkLine(g, F.partialPolyline(pts, ease.outSine(vp)), { t, seed: 50 + s, lw: 4.5, stroke: LEAF_DARK, amp: .6 });
        for (let i = 2; i <= 58; i += 4) {
          const reach = 47.0 + 1.4 * Math.asin(clamp(i / 60)) / (Math.PI / 2); // inverse of outSine
          const k = Math.max(0, spring(t - reach, 3, .4)); if (k <= 0) continue;
          const u = s ? 1 - .5 * i / 60 : .5 * i / 60, a = archAt(u), side = i % 8 < 4 ? 1 : -1;
          leafShape(g, pts[i][0], pts[i][1], 20 * k, Math.atan2(a.ny, a.nx) * side + (s ? .6 : -.6) + (side < 0 ? Math.PI : 0), 2.4);
        }
      }
    }
    // curling tendrils at the apex and bases
    const cp = ease.outCubic(invLerp(47.45, 48.3, t));
    if (cp > 0) {
      for (const [cx, cy, dir, rad, a0] of [[960, 190, -1, 34, -Math.PI / 2], [960, 190, 1, 34, -Math.PI / 2], [ARCH_L, GY - 10, -1, 26, 0], [ARCH_R, GY - 10, 1, 26, Math.PI]]) {
        const pts = [];
        for (let i = 0; i <= 26; i++) {
          const u = i / 26, a = a0 + dir * u * 2.7 * Math.PI, r = rad * (1.6 - u * 1.35);
          pts.push([cx + dir * rad * 1.1 + Math.cos(a) * r * (a0 === 0 || a0 === Math.PI ? 1 : 1) - (a0 === -Math.PI / 2 ? 0 : 0), cy + Math.sin(a) * r - (a0 === -Math.PI / 2 ? rad * .9 : rad * .6)]);
        }
        F.inkLine(g, F.partialPolyline(pts, cp), { t, seed: cx + dir, lw: 4, stroke: LEAF_DARK, amp: .5 });
      }
    }
    // arch flowers
    for (const f of ARCH_FL) {
      const a = archAt(f.u);
      drawFlower(g, f, a.x + a.nx * 6, a.y + a.ny * 6, f.size * 1.2 / ZA, t);
    }
  }

  // ═════════════════════════════ CHARACTERS ═════════════════════════════
  const fakeMouth = (a, b, t) => (t < a || t > b ? 0 : .75 * Math.abs(Math.sin((t - a) / (b - a) * TAU)));
  function mouthOf(sp, t) {
    if (F.lines().length) return undefined; // real lip-sync
    if (sp === 'dot') return fakeMouth(49.7, 50.25, t);
    if (sp === 'dash') return fakeMouth(50.5, 51.05, t);
    return undefined;
  }
  function glisten(g, cx, cy, er, k) { // wet shine on an eye (local coords)
    if (k <= 0) return;
    g.save(); g.globalAlpha = k;
    g.beginPath(); g.ellipse(cx, cy + er * .62, er * .62, er * .22, 0, 0, Math.PI); g.lineWidth = Math.max(2, er * .16); g.strokeStyle = '#9FD8FF'; g.stroke();
    g.beginPath(); g.arc(cx + er * .28, cy + er * .3, er * .15, 0, TAU); g.fillStyle = '#fff'; g.fill();
    g.beginPath(); g.arc(cx - er * .3, cy - er * .32, er * .1, 0, TAU); g.fill();
    g.restore();
  }
  function withChar(g, s, fn) {
    g.save(); g.translate(s.x, s.y); if (s.rot) g.rotate(s.rot);
    const sc = s.scale == null ? 1 : s.scale; g.scale(sc * (s.sx || 1), sc * (s.sy || 1));
    fn(); g.restore();
  }
  function miniBlossom(g, x, y, r, col) {
    g.save(); g.translate(x, y); g.lineWidth = 2.5; g.strokeStyle = P.ink;
    for (let i = 0; i < 5; i++) { const a = i * TAU / 5; g.beginPath(); g.arc(Math.cos(a) * r * .55, Math.sin(a) * r * .55, r * .5, 0, TAU); g.fillStyle = col; g.fill(); g.stroke(); }
    g.beginPath(); g.arc(0, 0, r * .3, 0, TAU); g.fillStyle = P.gold; g.fill(); g.stroke(); g.restore();
  }
  const bouquet = t => g => {
    g.save(); g.rotate(-.2);
    F.inkLine(g, [[0, -4], [-3, 26]], { t, seed: 91, lw: 3, stroke: LEAF_DARK }); F.inkLine(g, [[0, -4], [5, 24]], { t, seed: 92, lw: 3, stroke: LEAF_DARK });
    leafShape(g, 0, -12, 22, -2.4, 2.2); leafShape(g, 0, -12, 22, -.7, 2.2);
    miniBlossom(g, -12, -22, 13, P.blush); miniBlossom(g, 12, -24, 13, WHITE_P); miniBlossom(g, 0, -36, 14, P.coral);
    g.beginPath(); g.moveTo(-6, 4); g.quadraticCurveTo(-16, 16, -12, 24); g.moveTo(4, 4); g.quadraticCurveTo(14, 18, 10, 26); g.lineWidth = 3.5; g.strokeStyle = P.lilac; g.stroke();
    g.restore();
  };
  const ringBox = t => g => {
    const open = ease.outBack(invLerp(49.3, 49.5, t));
    g.save(); g.translate(4, -2);
    g.lineWidth = 3; g.strokeStyle = P.ink; g.lineJoin = 'round';
    // lid
    g.save(); g.translate(-14, -8); g.rotate(-open * 1.9);
    g.beginPath(); g.roundRect(0, -8, 28, 9, 3); g.fillStyle = P.coralShade; g.fill(); g.stroke(); g.restore();
    g.beginPath(); g.roundRect(-14, -8, 28, 18, 4); g.fillStyle = P.coral; g.fill(); g.stroke();
    if (open > .1) {
      g.beginPath(); g.arc(0, -12, 7.5, 0, TAU); g.lineWidth = 4.5; g.strokeStyle = P.gold; g.stroke();
      g.beginPath(); g.arc(0, -12, 7.5, 0, TAU); g.lineWidth = 1.2; g.strokeStyle = P.ink; g.stroke();
      g.beginPath(); g.moveTo(0, -24); g.lineTo(-4, -20); g.lineTo(0, -16); g.lineTo(4, -20); g.closePath(); g.fillStyle = '#E6F7FF'; g.fill(); g.lineWidth = 1.5; g.stroke();
      const gl = F.pulse(t, 49.33, 49.8);
      if (gl > 0) F.sparkle(g, 8, -26, 16 * gl, '#fff', t * 3);
    }
    g.restore();
  };

  function coupleState(t) {
    const kk = ease.inOutCubic(invLerp(50.95, 51.2, t));
    // Dot
    const dp = invLerp(46.7, 49.3, t), de = 1 - Math.pow(1 - dp, 1.7);
    const dX = lerp(-140, 893, de), dWalk = t < 49.3 ? (dX + 140) / 150 : null;
    const dot = { x: dX + 10 * kk, y: GY - 8 * kk, scale: SC, t, seed: 11, face: .45, look: [.75, -.55], mood: 'happy', blush: .45 };
    if (dWalk != null) { dot.walk = dWalk; dot.y -= Math.abs(Math.sin(dWalk * TAU)) * 6; dot.armR = [30 + Math.sin(dWalk * TAU) * 12, 44]; dot.look = [1, -.1]; }
    else { dot.sy = 1 - .07 * jiggle(t - 49.3, 3, 5); dot.sx = 1 + .07 * jiggle(t - 49.3, 3, 5); }
    dot.armL = [-8, 38]; dot.holdL = bouquet(t);
    // Dash
    const hp = invLerp(46.8, 49.3, t), he = 1 - Math.pow(1 - hp, 1.7);
    const hX = lerp(2060, 1027, he), hWalk = t < 49.3 ? (2060 - hX) / 170 : null;
    const dash = { x: hX - 8 * kk, y: GY, scale: SC, t, seed: 23, face: -.45, look: [-.75, .35], mood: 'happy', blush: .3 };
    if (hWalk != null) { dash.walk = hWalk; dash.y -= Math.abs(Math.sin(hWalk * TAU)) * 7; dash.armL = [-30 - Math.sin(hWalk * TAU) * 12, 46]; dash.armR = [30 + Math.sin(hWalk * TAU) * 12, 46]; dash.look = [-1, 0]; }
    else { dash.sy = 1 - .06 * jiggle(t - 49.3, 3, 5); }
    // Dash sees Dot → heart eyes & a little hop
    if (t > 47.9 && t < 48.55) { dash.mood = 'love'; dash.y -= 14 * F.pulse(t, 47.9, 48.2); }
    // hold hands after meeting
    const hh = ease.outBack(invLerp(49.35, 49.6, t));
    if (hh > 0 && kk < .5) { dot.armR = [lerp(30, 12, hh), lerp(44, 14, hh)]; dash.armL = [lerp(-30, -38, hh), lerp(46, 58, hh)]; }
    // "I do" — tender
    if (t > 49.4) { dot.blush = lerp(.45, .9, invLerp(49.4, 50, t)); dash.blush = lerp(.3, .85, invLerp(50.3, 50.9, t)); }
    dot.mouth = mouthOf('dot', t); dash.mouth = mouthOf('dash', t);
    // kiss
    if (kk > 0) {
      dot.rot = .15 * kk; dot.sy = (dot.sy || 1) * (1 + .1 * kk); dot.look = [1, -.6];
      dash.rot = -.21 * kk; dash.sy = (dash.sy || 1) * (1 - .03 * kk);
      if (kk > .5) { dot.armR = [26, -48]; dot.armL = [-40, -30]; dash.armL = [-58, 6]; dash.armR = [34, 20]; }
    }
    if (t > 51.02) { dot.mood = 'closed'; dash.mood = 'closed'; dot.blush = dash.blush = 1; }
    // after the kiss: a happy little bob
    if (t > 51.5) { const b = Math.sin((t - 51.5) * TAU * 2) * 3; dot.y += b; dash.y -= b * .5; }
    return { dot, dash, kk };
  }
  function drawCouple(g, t) {
    const { dot, dash, kk } = coupleState(t);
    const wet = invLerp(49.6, 50.0, t) * (1 - invLerp(50.95, 51.05, t));
    // Dot's veil (behind her)
    withChar(g, dot, () => {
      const fl = i => noise1(t * 1.6 + i * .7, 8) * 6 * (i / 8) + (dot.walk != null ? -6 * i / 8 : 0);
      const pts = [[-8, -168], [-44, -162], [-84, -126], [-110, -80], [-124, -30], [-112, -10], [-82, -18], [-58, -52], [-34, -96]].map((p, i) => [p[0] + fl(i), p[1] + fl(i + 3) * .5]);
      F.inkShape(g, pts, { fill: 'rgba(255,255,255,.88)', t, seed: 81, lw: 3.5, amp: 1 });
      g.save(); g.globalAlpha = .5; F.inkLine(g, [[-50, -150], [-86, -80], [-100, -26]].map((p, i) => [p[0] + fl(i * 3), p[1]]), { t, seed: 82, lw: 2, stroke: '#cfc6d8' }); g.restore();
    });
    F.drawDot(g, dot);
    withChar(g, dot, () => { // flower crown + glistening eyes
      miniBlossom(g, -36, -154, 10, P.blush); miniBlossom(g, -16, -164, 11, WHITE_P); miniBlossom(g, 30, -158, 10, P.gold);
      if (dot.mood !== 'closed') { const fx = dot.face * 70 * .28; for (const s of [-1, 1]) glisten(g, fx + s * 70 * .32, -94 - 70 * .18, 70 * .25, wet); }
    });
    F.drawDash(g, dash);
    withChar(g, dash, () => { // coral bow tie
      const fx = dash.face * 92 * .2, by = -99;
      g.lineWidth = 3.5; g.strokeStyle = P.ink; g.lineJoin = 'round'; g.fillStyle = P.coral;
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(fx, by); g.lineTo(fx + s * 22, by - 11); g.quadraticCurveTo(fx + s * 26, by, fx + s * 22, by + 11); g.closePath(); g.fill(); g.stroke(); }
      g.beginPath(); g.arc(fx, by, 6, 0, TAU); g.fillStyle = P.coralShade; g.fill(); g.stroke();
      if (dash.mood !== 'closed' && dash.mood !== 'love') { const ex = dash.face * 92 * .22; for (const s of [-1, 1]) glisten(g, ex + s * 92 * .2, -202 + 176 * .22, 92 * .15, wet); }
      // a single happy tear while Dot says "I do"
      const tr = invLerp(50.1, 50.9, t);
      if (tr > 0 && tr < 1) { const ex = dash.face * 92 * .22 + 92 * .2 + 6, ey = -202 + 176 * .22 + 12 + tr * 40; g.save(); g.globalAlpha = 1 - invLerp(.8, 1, tr); g.beginPath(); g.moveTo(ex, ey - 9); g.quadraticCurveTo(ex + 6, ey, ex, ey + 4); g.quadraticCurveTo(ex - 6, ey, ex, ey - 9); g.fillStyle = '#9FD8FF'; g.fill(); g.lineWidth = 2; g.stroke(); g.restore(); }
    });
    // kiss heart
    if (t > 51.18) {
      const dt = t - 51.18, k = spring(dt, 2.6, .35);
      g.save(); g.translate(962 + Math.sin(dt * 5) * 6, 600 - 70 * k - dt * 30); g.rotate(Math.sin(dt * 6) * .12);
      F.heart(g, 0, 0, 62 * k, P.red, 4); g.restore();
    }
    return kk;
  }
  function biscuitState(t) {
    const p = invLerp(46.9, 49.2, t), pe = ease.outSine(p);
    const z = lerp(1.12, 1.9, pe), off = lerp(-300, 10, pe), sc = .72 * ZA / z;
    const trot = t < 49.2;
    const s = { x: xAt(off, z), y: yAt(z), scale: sc, t, seed: 37, dir: 1, hold: ringBox(t), wag: t * (trot ? 4 : 7) };
    if (trot) { const ph = (t - 46.9) * 3.4; s.walk = ph; s.y -= Math.abs(Math.sin(ph * TAU)) * 16 * sc; s.rot = -.05; }
    else { s.sy = 1 - .08 * jiggle(t - 49.2, 3, 5); s.sx = 1 + .06 * jiggle(t - 49.2, 3, 5); s.rot = -.18; } // looks up at them
    if (t > 50.1) s.tongue = true;
    const jmp = F.pulse(t, 51.22, 51.62);
    if (jmp > 0) { s.y -= 46 * jmp; s.mood = 'joy'; s.earFlop = jmp; s.sy = 1 + .12 * jmp; }
    if (t > 51.62) s.earFlop = jiggle(t - 51.62, 3, 4) * .8;
    return { s, z };
  }

  // ═════════════════════════════ FX ═════════════════════════════
  const FW = [
    { t: 51.3, x: 440, y: 250, cols: [P.gold, P.coral], n: 44, r: 1.05, seed: 1 },
    { t: 51.47, x: 1500, y: 310, cols: [P.lilac, P.gold], n: 30, r: .7, seed: 2 },
    { t: 51.8, x: 1400, y: 180, cols: [P.cobalt, P.gold], n: 48, r: 1.15, seed: 3 },
    { t: 51.95, x: 610, y: 130, cols: [P.coral, P.cobalt], n: 32, r: .8, seed: 4 },
  ];
  function firework(g, t, fw) {
    const rise = .34; if (t < fw.t - rise) return;
    g.save(); g.lineCap = 'round';
    if (t < fw.t) {
      const p = ease.outQuad(invLerp(fw.t - rise, fw.t, t)), p0 = Math.max(0, p - .3);
      const X = q => lerp(fw.x + 60, fw.x, q), Y = q => lerp(820, fw.y, q);
      g.beginPath(); g.moveTo(X(p0), Y(p0)); g.lineTo(X(p), Y(p)); g.lineWidth = 5; g.strokeStyle = P.gold; g.stroke();
      g.beginPath(); g.arc(X(p), Y(p), 6, 0, TAU); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 2; g.strokeStyle = P.ink; g.stroke();
      g.restore(); return;
    }
    const dt = t - fw.t, r = F.rng(fw.seed * 97), life = 1.5;
    if (dt < .18) { const k = 1 - dt / .18; g.globalAlpha = k; g.fillStyle = '#FFF8E0'; g.beginPath(); g.arc(fw.x, fw.y, 90 * fw.r * (1.2 - k * .6), 0, TAU); g.fill(); g.globalAlpha = 1; }
    const pos = (ang, sp, d) => { const k = (1 - Math.exp(-2 * d)) / 2; return [fw.x + Math.cos(ang) * sp * k, fw.y + Math.sin(ang) * sp * k + 70 * d * d]; };
    for (let ring = 0; ring < 2; ring++) {
      const n = ring ? Math.round(fw.n * .5) : fw.n;
      for (let i = 0; i < n; i++) {
        const ang = i / n * TAU + r() * .15 + ring * .2, sp = (ring ? 300 : 560) * fw.r * (.85 + r() * .3), col = ring ? P.gold : fw.cols[i % 2];
        const a = 1 - invLerp(.55, life, dt + r() * .2); if (a <= 0) continue;
        const p1 = pos(ang, sp, dt), p0 = pos(ang, sp, Math.max(0, dt - .2));
        g.globalAlpha = a;
        g.beginPath(); g.moveTo(p0[0], p0[1]); g.lineTo(p1[0], p1[1]); g.lineWidth = (ring ? 4 : 6) * fw.r; g.strokeStyle = col; g.stroke();
        if (dt > .45 && hash2(F.boil(t, 15), i + ring * 50 + fw.seed * 9) > .55) F.sparkle(g, p1[0], p1[1], 9 * fw.r, i % 3 ? '#FFF6D8' : col, i);
        else { g.beginPath(); g.arc(p1[0], p1[1], 3.5 * fw.r, 0, TAU); g.fillStyle = '#FFF8E6'; g.fill(); }
      }
    }
    g.restore();
  }
  function heartWave(g, t, x, y) {
    const dt = t - 51.2; if (dt < 0 || dt > 1.2) return;
    g.save(); g.lineJoin = 'round';
    for (let k = 0; k < 3; k++) {
      const d = dt - k * .07; if (d <= 0) continue;
      const p = ease.outCubic(clamp(d / 1.0)), s = 60 + 2900 * p;
      g.globalAlpha = (1 - p) * (k === 0 ? 1 : .8);
      F.heartPath(g, x, y + s * .02, s);
      g.lineWidth = (k === 0 ? 70 : 34) * (1 - p) + 4; g.strokeStyle = [P.gold, P.coral, P.blush][k]; g.stroke();
      if (k === 0) { g.lineWidth = 3; g.strokeStyle = P.ink; g.globalAlpha *= .6; g.stroke(); }
    }
    g.restore();
  }
  function petalBurst(g, t, t0, x, y, n, seed) {
    const dt = t - t0; if (dt < 0) return;
    const r = F.rng(seed), cols = [P.blush, P.coral, P.lilac, WHITE_P, P.gold, P.blush];
    g.save(); g.lineWidth = 2; g.strokeStyle = P.ink;
    for (let i = 0; i < n; i++) {
      const ang = r() * TAU, sp = 500 + r() * 1100, drag = 1.8 + r() * 1.4, k = (1 - Math.exp(-drag * dt)) / drag;
      const px = x + Math.cos(ang) * (sp * k + 70 * clamp(dt / .1)) + Math.sin(dt * 3 + i) * 24 * Math.min(1, dt), py = y + Math.sin(ang) * (sp * k + 70 * clamp(dt / .1)) + 150 * dt * dt;
      const sz = (9 + r() * 10) * clamp(dt / .18), rot = r() * TAU + dt * (r() - .5) * 12, flip = Math.cos(dt * (4 + r() * 5) + i), col = cols[i % 6];
      g.save(); g.translate(px, py); g.rotate(rot); g.scale(1, .35 + .65 * Math.abs(flip));
      g.beginPath(); g.ellipse(0, 0, sz, sz * .58, 0, 0, TAU); g.fillStyle = col; g.fill(); g.stroke(); g.restore();
    }
    g.restore();
  }
  function motes(g, t) {
    g.save();
    for (let i = 0; i < 44; i++) {
      const petalMote = i % 4 === 0, sp = 12 + hash(i * 1.9) * 26, x0 = hash(i * 3.1) * 2100 - 90, y0 = hash(i * 7.7) * 1200;
      let y = petalMote ? ((y0 + (t - 46) * sp * 2.2) % 1200) - 60 : 1140 - ((1200 - y0 + (t - 46) * sp) % 1200);
      const x = x0 + Math.sin(t * .7 + i) * 26;
      if (petalMote) {
        g.save(); g.translate(x, y); g.rotate(t * 1.3 + i); g.scale(1, .5 + .5 * Math.sin(t * 3 + i));
        g.globalAlpha = .8; g.beginPath(); g.ellipse(0, 0, 9, 5, 0, 0, TAU); g.fillStyle = [P.blush, P.lilac, P.coral][i % 3]; g.fill(); g.restore();
      } else {
        const r = 2 + hash(i * 1.3) * 4, a = .35 + .3 * Math.sin(t * 2.3 + i * 1.7);
        g.globalAlpha = a * .25; g.fillStyle = '#FFE6A0'; g.beginPath(); g.arc(x, y, r * 3.2, 0, TAU); g.fill();
        g.globalAlpha = a; g.fillStyle = '#FFF4D2'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      }
    }
    g.restore();
  }

  // ═════════════════════════════ WORLD RENDER ═════════════════════════════
  function worldCam(t) {
    let z, x, y;
    if (t < 49.35) { const a = ease.outCubic(invLerp(46, 47.1, t)); z = lerp(1.14, 1, a) + .035 * ease.inOutSine(invLerp(47.1, 49.35, t)); x = 960; y = lerp(600, 560, a); }
    else if (t < 51.22) {
      const a = ease.inOutCubic(invLerp(49.35, 49.95, t)), z0 = 1.035;
      const drift = lerp(0, -18, ease.inOutSine(invLerp(49.6, 50.1, t))) + lerp(0, 40, ease.inOutSine(invLerp(50.35, 50.8, t))) - 22 * ease.inOutSine(invLerp(50.9, 51.2, t));
      z = lerp(z0, 2.15, a) + .12 * ease.inOutSine(invLerp(49.95, 51.2, t));
      x = lerp(960, 956, a) + drift * a; y = lerp(560, 650, a);
    } else { const a = ease.inOutCubic(invLerp(51.25, 51.85, t)); z = lerp(2.27, 1, a); x = lerp(956, 960, a); y = lerp(650, 540, a); }
    let dx = 0, dy = 0;
    if (t > 51.2 && t < 51.6) { const s = F.shake(t, 10 * (1 - (t - 51.2) / .4), 5); dx = s[0]; dy = s[1]; }
    return { zoom: z, x, y, dx, dy };
  }
  function drawWorld(g, t, cam) {
    g.save();
    F.camera(g, cam);
    background(g, t);
    aisle(g, t);
    // depth-sorted items (far → near)
    const items = [];
    for (const b of BUSHES) items.push([b.z, () => drawBush(g, b, xAt(b.off, b.z), yAt(b.z) + 4, 1.2 / b.z, t)]);
    for (const f of FLOWERS) items.push([f.z, () => drawFlower(g, f, xAt(f.off, f.z), yAt(f.z), f.size * 1.2 / f.z, t)]);
    items.push([ZA + .01, () => drawArch(g, t)]);
    items.push([ZA - .005, () => drawCouple(g, t)]);
    const bs = biscuitState(t);
    if (t > 46.85) items.push([bs.z, () => F.drawBiscuit(g, bs.s)]);
    items.sort((a, b) => b[0] - a[0]);
    for (const it of items) { g.save(); it[1](); g.restore(); }
    // climax FX
    heartWave(g, t, 962, 612);
    petalBurst(g, t, 51.2, 962, 620, 70, 511);
    for (const fw of FW) firework(g, t, fw);
    if (t > 51.2) { F.confetti(g, t, 51.2, { x: 120, y: 1100, angle: -1.05, spread: .7, speed: 1900, n: 90, seed: 21 }); F.confetti(g, t, 51.2, { x: 1800, y: 1100, angle: -2.09, spread: .7, speed: 1900, n: 90, seed: 22 }); }
    motes(g, t);
    g.restore();
    // kiss flash
    const kf = 1 - invLerp(51.2, 51.42, t);
    if (t >= 51.2 && kf > 0) { g.save(); g.globalAlpha = kf * .55; g.fillStyle = '#FFF6DE'; g.fillRect(0, 0, W, H); g.restore(); }
  }

  // ═════════════════════════════ BOOK ═════════════════════════════
  const PW = 960, PH = 1080, BM = 24; // page half-width/height, board margin
  const SNAP_T = [44.2, 40.8, 36.8, 28.5, 25, 21, 15.2, 13.7, 12.8, 10.8, 9, 7, 5.5, 3.4, 2.3];
  const NL = SNAP_T.length;
  const LEAVES = [];
  for (let i = 1; i <= NL; i++) { const u = (i - 1) / (NL - 1); LEAVES.push({ i, s: 52.32 + 1.12 * Math.pow(u, 1.45), d: .15 + .15 * u }); }
  const COVER_S = 53.62, COVER_D = .38;
  const leafTheta = (L, t) => Math.PI * ease.inOutSine(clamp((t - L.s) / L.d));
  const coverTheta = t => Math.PI * Math.pow(clamp((t - COVER_S) / COVER_D), 2.2);

  const THUMB = new Map();
  function thumb(ts) {
    let c = THUMB.get(ts); if (c) return c;
    const s = F.snapshot(ts); c = F.canvas(1280, 720);
    c.getContext('2d').drawImage(s, 0, 0, 1280, 720);
    THUMB.set(ts, c); return c;
  }
  let WORLD_IMG = null;
  const spreadImg = k => (k === 0 ? WORLD_IMG : thumb(SNAP_T[k - 1]));
  const half = (img, side) => ({ img, sx: side ? img.width / 2 : 0, sy: 0, sw: img.width / 2, sh: img.height });

  function softShadow(g, x, y, w, h) { // cheap layered drop shadow (shadowBlur is slow on the software renderer)
    g.save(); g.fillStyle = 'rgba(0,0,0,.13)';
    for (let i = 7; i >= 0; i--) { const e = i * 16; rrect(g, x - e * .6, y - e * .4 + 30, w + e * 1.2, h + e * .8 + 10, 20 + e); g.fill(); }
    g.restore();
  }
  function rrect(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
  function clothTexture(g, w, h, seed) {
    const r = F.rng(seed);
    for (let x = 0; x < w; x += 3) { g.fillStyle = `rgba(255,255,255,${.015 + r() * .035})`; g.fillRect(x, 0, 1, h); }
    for (let y = 0; y < h; y += 3) { g.fillStyle = `rgba(0,0,30,${.03 + r() * .06})`; g.fillRect(0, y, w, 1); }
    for (let i = 0; i < 40; i++) { const x = r() * w, y = r() * h, rad = 60 + r() * 200, gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, `rgba(${r() > .5 ? '255,255,255' : '0,0,20'},${.02 + r() * .03})`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
  }

  let TABLE = null;
  function table() {
    if (TABLE) return TABLE;
    const c = F.canvas(W, H), g = c.getContext('2d');
    g.fillStyle = '#120F0C'; g.fillRect(0, 0, W, H);
    const r = F.rng(12);
    for (let i = 0; i < 160; i++) { const y = r() * H; g.fillStyle = `rgba(${r() > .5 ? '90,62,38' : '0,0,0'},${.05 + r() * .08})`; g.fillRect(0, y, W, 1 + r() * 3); }
    const lg = g.createRadialGradient(W / 2, H * .46, 60, W / 2, H * .5, W * .62);
    lg.addColorStop(0, 'rgba(255,196,120,.30)'); lg.addColorStop(.5, 'rgba(200,130,70,.12)'); lg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = lg; g.fillRect(0, 0, W, H);
    const vg = g.createRadialGradient(W / 2, H / 2, H * .4, W / 2, H / 2, H * 1.1);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.6)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    return (TABLE = c);
  }

  // ── cover (984 × 1128, spine on the left)
  const CW = PW + BM, CH = PH + 2 * BM, CCX = 530; // content centre x (spine takes the left)
  let COVER = null;
  function foilGrad(g, y0, y1) {
    const gr = g.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, '#FFE9A8'); gr.addColorStop(.22, '#F3BC4C'); gr.addColorStop(.42, '#FFF4D0'); gr.addColorStop(.58, '#E7A83A');
    gr.addColorStop(.82, '#B47A1C'); gr.addColorStop(1, '#F2C35E');
    return gr;
  }
  function lockup(g, mode) { // mode: 'shadow' | 'foil'
    const S = mode === 'shadow';
    const paint = (y0, y1) => (S ? 'rgba(6,10,50,.75)' : foilGrad(g, y0, y1));
    g.save(); if (S) g.translate(2, 4);
    g.lineJoin = 'round'; g.lineCap = 'round';
    // double-rule frame
    const fx0 = 112, fy0 = 50, fx1 = CW - 48, fy1 = CH - 50;
    g.strokeStyle = paint(fy0, fy1); g.lineWidth = 4; rrect(g, fx0, fy0, fx1 - fx0, fy1 - fy0, 8); g.stroke();
    g.lineWidth = 1.6; rrect(g, fx0 + 14, fy0 + 14, fx1 - fx0 - 28, fy1 - fy0 - 28, 4); g.stroke();
    for (const [x, y] of [[fx0 + 14, fy0 + 14], [fx1 - 14, fy0 + 14], [fx0 + 14, fy1 - 14], [fx1 - 14, fy1 - 14]]) F.sparkle(g, x, y, 16, paint(y - 16, y + 16), Math.PI / 4);
    // monogram: Dot (circle) interlocked with Dash (capsule) + a tiny heart
    const my = 292, cA = [CCX - 38, my + 12], capX = CCX + 30, capY = my - 2, capW = 64, capH = 152;
    const circ = () => { g.beginPath(); g.arc(cA[0], cA[1], 62, 0, TAU); };
    const cap = () => rrect(g, capX - capW / 2, capY - capH / 2, capW, capH, capW / 2);
    const gold = paint(my - 90, my + 90);
    const cut = (path, clip) => { if (S) return; g.save(); if (clip) { g.beginPath(); clip(); g.clip(); } g.globalCompositeOperation = 'destination-out'; g.lineWidth = 19; path(); g.stroke(); g.restore(); };
    const draw = (path, clip) => { g.save(); if (clip) { g.beginPath(); clip(); g.clip(); } g.lineWidth = 7; g.strokeStyle = gold; path(); g.stroke(); g.restore(); };
    draw(circ);
    cut(cap); draw(cap);                                   // capsule over circle (top crossing)
    const lower = () => g.rect(0, my + 14, W, 200);
    cut(circ, lower); draw(circ, lower);                   // circle over capsule (bottom crossing)
    F.heartPath(g, cA[0], cA[1] + 2, 40); g.fillStyle = gold; g.fill();
    // THE
    F.font(g, 46, F.FONT.display, 600); g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.letterSpacing = '22px';
    const theW = g.measureText('THE').width;
    g.fillStyle = paint(440, 480); g.fillText('THE', CCX + 11, 478);
    g.letterSpacing = '0px';
    g.strokeStyle = paint(455, 465); g.lineWidth = 2.5;
    for (const s of [-1, 1]) {
      const a = CCX + s * (theW / 2 + 22), b = CCX + s * (theW / 2 + 128);
      g.beginPath(); g.moveTo(a, 462); g.lineTo(b, 462); g.stroke();
      g.beginPath(); g.moveTo(b, 456); g.lineTo(b + s * 6, 462); g.lineTo(b, 468); g.lineTo(b - s * 6, 462); g.closePath(); g.fillStyle = g.strokeStyle; g.fill();
    }
    // Wedding (big italic)
    F.font(g, 220, F.FONT.display, 700, 'italic');
    let w = g.measureText('Wedding').width, sz = Math.min(220, 220 * 720 / w);
    F.font(g, sz, F.FONT.display, 700, 'italic');
    g.fillStyle = paint(520, 700); g.fillText('Wedding', CCX - 6, 668);
    // Chapter (roman 900)
    F.font(g, 170, F.FONT.display, 900); g.letterSpacing = '4px';
    w = g.measureText('Chapter').width; sz = Math.min(170, 170 * 640 / w);
    F.font(g, sz, F.FONT.display, 900);
    g.fillStyle = paint(720, 840); g.fillText('Chapter', CCX + 2, 838);
    g.letterSpacing = '0px';
    // ornament rule
    g.strokeStyle = paint(880, 900); g.lineWidth = 2.5;
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(CCX + s * 26, 892); g.lineTo(CCX + s * 170, 892); g.stroke(); }
    F.heartPath(g, CCX, 894, 26); g.fillStyle = paint(880, 905); g.fill();
    g.restore();
  }
  function buildCover() {
    if (COVER) return COVER;
    const base = F.canvas(CW, CH), g = base.getContext('2d');
    g.save(); rrect(g, 0, 0, CW, CH, [4, 16, 16, 4]); g.clip();
    g.fillStyle = CLOTH; g.fillRect(0, 0, CW, CH);
    clothTexture(g, CW, CH, 77);
    // spine band + hinge groove
    const sgr = g.createLinearGradient(0, 0, 80, 0); sgr.addColorStop(0, 'rgba(0,0,20,.45)'); sgr.addColorStop(1, 'rgba(0,0,20,0)');
    g.fillStyle = sgr; g.fillRect(0, 0, 80, CH);
    g.fillStyle = 'rgba(0,0,25,.55)'; g.fillRect(60, 0, 5, CH); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(66, 0, 2, CH);
    // soft sheen + edge wear
    const sh = g.createLinearGradient(0, 0, CW, CH); sh.addColorStop(0, 'rgba(255,255,255,.10)'); sh.addColorStop(.45, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,.18)');
    g.fillStyle = sh; g.fillRect(0, 0, CW, CH);
    const vg = g.createRadialGradient(CW / 2, CH / 2, CH * .35, CW / 2, CH / 2, CH * .75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,20,.35)');
    g.fillStyle = vg; g.fillRect(0, 0, CW, CH);
    lockup(g, 'shadow');
    g.restore();
    const foil = F.canvas(CW, CH), fg = foil.getContext('2d');
    lockup(fg, 'foil');
    g.drawImage(foil, 0, 0);
    // ink outline
    rrect(g, 2.5, 2.5, CW - 5, CH - 5, [4, 16, 16, 4]); g.lineWidth = 5; g.strokeStyle = '#0A0A12'; g.stroke();
    return (COVER = { base, foil });
  }
  let COVER_FRONT = null;
  function coverFront() { // inside of the swinging left half: board + first page (Chapter One)
    if (COVER_FRONT) return COVER_FRONT;
    const c = F.canvas(CW, CH), g = c.getContext('2d');
    rrect(g, 0, 0, CW, CH, [16, 4, 4, 16]); g.fillStyle = CLOTH; g.fill();
    g.save(); g.clip(); clothTexture(g, CW, CH, 78); g.restore();
    const h = half(thumb(SNAP_T[NL - 1]), 0);
    g.drawImage(h.img, h.sx, h.sy, h.sw, h.sh, BM, BM, PW, PH);
    const gg = g.createLinearGradient(CW - 120, 0, CW, 0); gg.addColorStop(0, 'rgba(60,40,20,0)'); gg.addColorStop(1, 'rgba(60,40,20,.35)');
    g.fillStyle = gg; g.fillRect(BM, BM, PW, PH);
    return (COVER_FRONT = c);
  }

  /** A leaf hinged at x=0 in desk space; θ 0 = lying on the left, π = lying on the right. */
  function drawLeaf(g, th, w, h, front, back, z) {
    const c = Math.cos(th), s = Math.sin(th), onLeft = c > 0, span = w * Math.abs(c);
    if (span < 1.5) return;
    const src = onLeft ? front : back, N = 14, dir = onLeft ? -1 : 1;
    const lift = u => 1 + .08 * s * u;
    // shadow cast beyond the free edge
    g.save();
    const ex = dir * span, sw = 200 * s;
    const sg = g.createLinearGradient(ex, 0, ex + dir * sw, 0); sg.addColorStop(0, `rgba(10,6,0,${.35 * s})`); sg.addColorStop(1, 'rgba(10,6,0,0)');
    g.fillStyle = sg; g.fillRect(Math.min(ex, ex + dir * sw), -h / 2, sw, h);
    g.restore();
    for (let j = 0; j < N; j++) {
      const u0 = j / N, u1 = (j + 1) / N, L = lift((u0 + u1) / 2);
      const x0 = dir * u0 * span, x1 = dir * u1 * span;
      const sxA = onLeft ? src.sx + src.sw * (1 - u1) : src.sx + src.sw * u0;
      g.drawImage(src.img, sxA, src.sy, src.sw / N, src.sh, Math.min(x0, x1) - .5, -h / 2 * L, Math.abs(x1 - x0) + 1, h * L);
    }
    // shading from hinge to edge
    const Lo = lift(1);
    g.beginPath(); g.moveTo(0, -h / 2); g.lineTo(ex, -h / 2 * Lo); g.lineTo(ex, h / 2 * Lo); g.lineTo(0, h / 2); g.closePath();
    const gr = g.createLinearGradient(0, 0, ex, 0);
    gr.addColorStop(0, `rgba(40,25,10,${.15 + .4 * s})`); gr.addColorStop(.35, `rgba(40,25,10,${.1 * s})`); gr.addColorStop(1, `rgba(255,250,235,${.12 * s})`);
    g.fillStyle = gr; g.fill();
    g.lineWidth = 2 / z; g.strokeStyle = 'rgba(22,22,29,.45)'; g.stroke();
  }
  function bookCamOpen(t) {
    const p = ease.inOutCubic(invLerp(52.0, 52.55, t));
    return { z: lerp(1, .62, p), cx: 0, cy: lerp(0, 24, p), dx: 0, dy: 0 };
  }
  function bookCamClosed(t) {
    const p = ease.inOutCubic(invLerp(54.05, 54.9, t));
    const z = lerp(.62, .55, p) + .014 * ease.inOutSine(invLerp(55, 59.6, t));
    const bump = 1 - .018 * jiggle(t - 54, 4.5, 7);
    const sh = F.shake(t, 11 * Math.exp(-(t - 54) * 10), 9);
    return { z: z * bump, cx: lerp(0, CW / 2, p), cy: lerp(24, 66, p), dx: sh[0], dy: sh[1] };
  }
  function applyCam(g, c) { g.translate(W / 2 + c.dx, H / 2 + c.dy); g.scale(c.z, c.z); g.translate(-c.cx, -c.cy); }

  function drawOpenBook(ctx, t) {
    const cam = bookCamOpen(t), z = cam.z;
    ctx.drawImage(table(), 0, 0);
    ctx.save(); applyCam(ctx, cam);
    const leftGone = t >= COVER_S;
    // shadow + boards
    softShadow(ctx, leftGone ? 0 : -CW, -CH / 2, leftGone ? CW : 2 * CW, CH);
    rrect(ctx, leftGone ? 0 : -CW, -CH / 2, leftGone ? CW : 2 * CW, CH, 16); ctx.fillStyle = CLOTH; ctx.fill(); ctx.lineWidth = 5 / z; ctx.strokeStyle = '#0A0A12'; ctx.stroke();
    // page-block edges
    ctx.fillStyle = '#D9C9AA'; ctx.fillRect(leftGone ? 0 : -PW - 6, -PH / 2 + 4, leftGone ? PW + 6 : 2 * PW + 12, PH + 10);
    ctx.strokeStyle = 'rgba(120,95,60,.5)'; ctx.lineWidth = 1.2 / z;
    for (let k = 1; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(leftGone ? 0 : -PW, PH / 2 + k * 2.6); ctx.lineTo(PW + k * 1.5, PH / 2 + k * 2.6); ctx.stroke(); }
    // base pages
    let m = 0, j = 0;
    for (const L of LEAVES) { if (t >= L.s) m = L.i; if (t >= L.s + L.d) j = L.i; }
    if (!leftGone) { const h = half(spreadImg(m), 0); ctx.drawImage(h.img, h.sx, h.sy, h.sw, h.sh, -PW, -PH / 2, PW, PH); }
    { const h = half(spreadImg(j), 1); ctx.drawImage(h.img, h.sx, h.sy, h.sw, h.sh, 0, -PH / 2, PW, PH); }
    // gutter + page curvature
    const gA = ease.outCubic(invLerp(52.0, 52.35, t));
    if (gA > 0) {
      ctx.save(); ctx.globalAlpha = gA;
      const gg = ctx.createLinearGradient(-PW, 0, PW, 0);
      gg.addColorStop(0, 'rgba(60,40,20,.18)'); gg.addColorStop(.04, 'rgba(60,40,20,0)'); gg.addColorStop(.44, 'rgba(60,40,20,0)'); gg.addColorStop(.497, 'rgba(50,30,10,.45)');
      gg.addColorStop(.503, 'rgba(50,30,10,.45)'); gg.addColorStop(.56, 'rgba(60,40,20,0)'); gg.addColorStop(.96, 'rgba(60,40,20,0)'); gg.addColorStop(1, 'rgba(60,40,20,.18)');
      ctx.fillStyle = gg; ctx.fillRect(leftGone ? 0 : -PW, -PH / 2, leftGone ? PW : 2 * PW, PH);
      ctx.strokeStyle = 'rgba(22,22,29,.35)'; ctx.lineWidth = 2 / z; ctx.strokeRect(leftGone ? 0 : -PW, -PH / 2, leftGone ? PW : 2 * PW, PH);
      ctx.restore();
    }
    // leaves in flight
    const fl = LEAVES.filter(L => t > L.s && t < L.s + L.d).map(L => [L, leafTheta(L, t)]);
    const lefts = fl.filter(x => x[1] < Math.PI / 2).sort((a, b) => b[0].i - a[0].i);
    const rights = fl.filter(x => x[1] >= Math.PI / 2).sort((a, b) => a[0].i - b[0].i);
    for (const [L, th] of lefts.concat(rights)) {
      ctx.save(); drawLeaf(ctx, th, PW, PH, half(spreadImg(L.i - 1), 0), half(spreadImg(L.i), 1), z); ctx.restore();
    }
    if (leftGone) {
      const cv = buildCover(), th = coverTheta(t);
      ctx.save(); ctx.translate(0, 0);
      drawLeaf(ctx, th, CW, CH, { img: coverFront(), sx: 0, sy: 0, sw: CW, sh: CH }, { img: cv.base, sx: 0, sy: 0, sw: CW, sh: CH }, z);
      ctx.restore();
    }
    ctx.restore();
  }

  // ═════════════════════════════ LOGO ═════════════════════════════
  function narratorTimes() {
    const l = F.lines().find(l => l.speaker === 'narrator' && l.start > 54 && l.start < 60);
    if (!l) return { a: 55.3, b: 56.15, end: 58.3 };
    return { a: l.start, b: l.start + (l.end - l.start) * .42, end: l.end };
  }
  function shimmer(g, foil, p, alpha, width = 170) {
    if (p <= 0 || p >= 1 || alpha <= 0) return;
    const S = F.offscreen('d_shim', CW, CH), s = S.getContext('2d');
    s.setTransform(1, 0, 0, 1, 0, 0); s.globalCompositeOperation = 'source-over'; s.clearRect(0, 0, CW, CH);
    s.drawImage(foil, 0, 0); s.globalCompositeOperation = 'source-in';
    const bx = lerp(-500, CW + 500, p), gr = s.createLinearGradient(bx - width, 0, bx + width, 300);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(.42, 'rgba(255,248,225,.5)'); gr.addColorStop(.5, 'rgba(255,255,250,1)'); gr.addColorStop(.58, 'rgba(255,248,225,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    s.fillStyle = gr; s.fillRect(0, 0, CW, CH);
    g.save(); g.globalAlpha = alpha; g.globalCompositeOperation = 'lighter'; g.drawImage(S, 0, -CH / 2); g.restore();
  }
  function dustPuffs(g, t) {
    const dt = t - 54; if (dt < 0 || dt > 1) return;
    const r = F.rng(540);
    g.save();
    for (let i = 0; i < 46; i++) {
      // spawn along the left, bottom and top edges of the closed book
      const e = r(), u = r();
      let x, y, vx, vy;
      if (e < .4) { x = -10; y = lerp(-CH / 2, CH / 2, u); vx = -1; vy = (u - .5) * .6; }
      else if (e < .7) { x = lerp(0, CW, u); y = CH / 2 + 10; vx = (u - .5) * .6; vy = 1; }
      else { x = lerp(0, CW, u); y = -CH / 2 - 10; vx = (u - .5) * .6; vy = -1; }
      const sp = 300 + r() * 520, k = (1 - Math.exp(-5 * dt)) / 5, rad = 3 + r() * 5;
      const a = .75 * (1 - invLerp(.2, .75, dt)), px = x + vx * sp * k, py = y + vy * sp * k + 40 * dt * dt;
      if (a <= 0) continue;
      g.globalAlpha = a; g.fillStyle = r() > .5 ? '#F3E6CC' : '#FFE9B0';
      g.beginPath(); g.arc(px, py, rad * (1 - dt * .6), 0, TAU); g.fill();
    }
    g.restore();
  }
  function drawLogo(ctx, t) {
    const cam = bookCamClosed(t), z = cam.z, cv = buildCover();
    ctx.drawImage(table(), 0, 0);
    ctx.save(); applyCam(ctx, cam);
    // shadow, back board, page block, cover
    softShadow(ctx, 0, -CH / 2 + 4, CW, CH + 22);
    rrect(ctx, 0, -CH / 2 + 4, CW, CH + 22, 16); ctx.fillStyle = CLOTH_DK; ctx.fill();
    ctx.fillStyle = '#E4D6BA'; ctx.fillRect(10, CH / 2 - 10, CW - 26, 24);
    ctx.strokeStyle = 'rgba(120,95,60,.55)'; ctx.lineWidth = 1.3 / z;
    for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(12, CH / 2 + 2 + k * 3.4); ctx.lineTo(CW - 18, CH / 2 + 2 + k * 3.4); ctx.stroke(); }
    ctx.drawImage(cv.base, 0, -CH / 2);
    // warm lamp sheen drifting over the cloth
    ctx.save(); rrect(ctx, 0, -CH / 2, CW, CH, 16); ctx.clip();
    const lx = lerp(200, 700, invLerp(54, 60, t)), lg = ctx.createRadialGradient(lx, -200, 20, lx, -200, 700);
    lg.addColorStop(0, 'rgba(255,210,150,.10)'); lg.addColorStop(1, 'rgba(255,210,150,0)'); ctx.fillStyle = lg; ctx.fillRect(0, -CH / 2, CW, CH);
    ctx.restore();
    // foil shimmer sweeps (54.3 big, 57.25 subtle, 59.0 tiny)
    shimmer(ctx, cv.foil, ease.inOutSine(invLerp(54.3, 55.15, t)), .95);
    shimmer(ctx, cv.foil, ease.inOutSine(invLerp(57.2, 58.1, t)), .5, 120);
    // glints at the end of the sweep
    for (const [gx, gy, t0] of [[CCX + 62, 292 - 76 - CH / 2, 54.95], [CCX + 300, 560 - CH / 2, 55.1], [CCX - 300, 780 - CH / 2, 55.25]]) {
      const k = F.pulse(t, t0, t0 + .45); if (k > 0) F.sparkle(ctx, gx, gy + (gy > 0 ? 0 : 0), 34 * k, '#FFF8E0', (t - t0) * 2);
    }
    // tagline (on the cover)
    const words = 'Plan the day. Love the story.'.split(' ');
    F.font(ctx, 50, F.FONT.display, 400, 'italic'); ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    const space = ctx.measureText(' ').width, ws = words.map(w => ctx.measureText(w).width), tot = ws.reduce((a, b) => a + b, 0) + space * (words.length - 1);
    let x = CCX - tot / 2;
    words.forEach((w, i) => {
      const k = ease.outCubic(invLerp(57.3 + i * .1, 57.75 + i * .1, t));
      if (k > 0) {
        ctx.save(); ctx.globalAlpha = k; const y = 978 - CH / 2 + (1 - k) * 14;
        ctx.fillStyle = 'rgba(6,10,50,.7)'; ctx.fillText(w, x + 1.5, y + 3);
        ctx.fillStyle = foilGrad(ctx, y - 40, y + 8); ctx.fillText(w, x, y);
        ctx.restore();
      }
      x += ws[i] + space;
    });
    dustPuffs(ctx, t);
    ctx.restore();

    // screen-space extras
    const toS = (dx, dy) => [W / 2 + cam.dx + (dx - cam.cx) * z, H / 2 + cam.dy + (dy - cam.cy) * z];
    const [, coverTop] = toS(0, -CH / 2), [, bookBottom] = toS(0, CH / 2 + 24);
    const ty = Math.min(H - 70, bookBottom + 92);
    const nt = narratorTimes();
    // hand-lettered narrator line, written on
    const hw = invLerp(nt.b, nt.b + 1.0, t), hOut = 1 - invLerp(57.25, 57.6, t);
    if (hw > 0 && hOut > 0) {
      ctx.save(); ctx.globalAlpha = hOut;
      F.font(ctx, 66, F.FONT.hand, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      const str = 'Write the next one together.', tw = ctx.measureText(str).width, x0 = W / 2 - tw / 2;
      ctx.save(); ctx.beginPath(); ctx.rect(x0 - 20, ty - 80, (tw + 40) * ease.inOutSine(hw), 140); ctx.clip();
      ctx.fillStyle = '#F6E7C8'; ctx.fillText(str, W / 2, ty);
      ctx.restore();
      const up = ease.outCubic(invLerp(nt.b + .7, nt.b + 1.2, t));
      if (up > 0) F.inkLine(ctx, F.partialPolyline([[x0 + 30, ty + 18], [W / 2, ty + 10], [x0 + tw - 10, ty + 16], [x0 + tw + 20, ty + 4]], up), { t, seed: 5, lw: 4, stroke: P.gold, amp: .6 });
      if (hw < 1) { const px = x0 - 20 + (tw + 40) * ease.inOutSine(hw); F.sparkle(ctx, px, ty - 10, 14, P.gold, t * 6); }
      ctx.restore();
    }
    // OUT NOW
    const on = ease.outCubic(invLerp(57.85, 58.35, t));
    if (on > 0) {
      ctx.save(); ctx.globalAlpha = on;
      F.font(ctx, 30, F.FONT.label, 700); ctx.letterSpacing = `${lerp(24, 12, on)}px`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const w = ctx.measureText('OUT NOW').width;
      ctx.fillStyle = P.gold; ctx.fillText('OUT NOW', W / 2 + 6, ty - 12);
      ctx.letterSpacing = '0px';
      ctx.strokeStyle = 'rgba(255,194,71,.8)'; ctx.lineWidth = 2;
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(W / 2 + s * (w / 2 + 22), ty - 12); ctx.lineTo(W / 2 + s * (w / 2 + 22 + 90 * on), ty - 12); ctx.stroke(); }
      ctx.restore();
    }
    // button: Biscuit (and friends) pop up from behind the book
    drawPeekers(ctx, t, coverTop, toS);
    // iris out on Biscuit, then black
    const ir = invLerp(59.5, 59.92, t);
    if (ir > 0) {
      const b = biscuitPop(t, coverTop), cx = b.x + 40, cy = b.headY;
      const R = lerp(1500, 70, ease.inOutCubic(ir));
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(cx, cy, Math.max(0, R), 0, TAU, true); ctx.fillStyle = '#000'; ctx.fill('evenodd'); ctx.restore();
    }
    const fb = invLerp(59.86, 59.99, t);
    if (fb > 0) { ctx.save(); ctx.globalAlpha = fb; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  }
  function biscuitPop(t, coverTop) {
    const dt = t - 58.8;
    const peek = ease.outCubic(invLerp(58.5, 58.68, t)) * (1 - ease.inCubic(invLerp(58.7, 58.8, t)) * .6); // ears peek, dip (anticipation)
    const k = spring(dt, 2.3, .5);
    const base = coverTop + lerp(lerp(165, 140, peek), 4, clamp(k, 0, 1.3));
    const vel = dt > 0 ? jiggle(dt, 2.3, 4) : 0;
    const sy = 1 + .28 * Math.max(0, vel) - .12 * Math.max(0, -vel), sx = 1 / Math.sqrt(sy);
    return { x: 850, y: base, sy, sx, headY: base - 1.2 * (20 + 62 * sy + 30), k };
  }
  function drawPeekers(ctx, t, coverTop, toS) {
    if (t < 58.45) return;
    const b = biscuitPop(t, coverTop);
    ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, coverTop + 3); ctx.clip();
    // Dot & Dash peek from the corners a beat later
    const dk = spring(t - 58.98, 2.8, .4), hk = spring(t - 59.08, 2.8, .4);
    if (dk > 0) F.drawDot(ctx, { x: 770, y: coverTop + lerp(170, 30, dk), scale: .72, t, rot: .12, look: [1, -.3], mood: t > 59.2 ? 'joy' : 'happy', blush: .7, mouth: t > 59.2 ? .5 : undefined, legs: false, armL: [-10, 20], armR: [10, 20] });
    if (hk > 0) F.drawDash(ctx, { x: 1180, y: coverTop + lerp(210, 88, hk), scale: .72, t, rot: -.12, look: [-1, -.2], mood: t > 59.2 ? 'joy' : 'happy', blush: .5, mouth: t > 59.25 ? .5 : undefined, legs: false });
    // Biscuit
    const bark = F.pulse(t, 58.82, 59.2) + .6 * F.pulse(t, 59.22, 59.42);
    F.drawBiscuit(ctx, { x: b.x, y: b.y, scale: 1.2, sx: b.sx, sy: b.sy, t, dir: 1, bark, tongue: t > 59.45, mood: t > 59.45 ? 'joy' : undefined, earFlop: t > 58.8 ? jiggle(t - 58.84, 3.2, 3) * 1.1 : 0, wag: t * 7, rot: t > 58.8 ? -.08 * jiggle(t - 58.8, 2, 3) : 0 });
    ctx.restore();
    // paws over the edge
    if (b.k > .75 && t > 58.8) {
      for (const px of [872, 928]) { ctx.beginPath(); ctx.ellipse(px, coverTop + 4, 15, 10, 0, 0, TAU); ctx.fillStyle = P.gold; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = P.ink; ctx.stroke(); ctx.beginPath(); for (const o of [-5, 0, 5]) { ctx.moveTo(px + o, coverTop + 8); ctx.lineTo(px + o, coverTop + 12); } ctx.lineWidth = 2.5; ctx.stroke(); }
    }
    // WOOF!
    const wk = spring(t - 58.84, 3, .35);
    if (wk > 0) {
      ctx.save(); ctx.translate(1060, 100); ctx.rotate(-.12 + jiggle(t - 58.84, 4, 5) * .08); ctx.scale(wk, wk);
      F.font(ctx, 104, F.FONT.hand, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round'; ctx.lineWidth = 12; ctx.strokeStyle = P.ink; ctx.strokeText('WOOF!', 0, 0);
      ctx.fillStyle = P.gold; ctx.fillText('WOOF!', 0, 0);
      ctx.restore();
      // action lines
      ctx.save(); ctx.globalAlpha = 1 - invLerp(59.1, 59.4, t);
      for (let i = 0; i < 3; i++) { const a = -.9 + i * .35, r0 = 70 + wk * 10, r1 = r0 + 34 * wk; F.inkLine(ctx, [[970 + Math.cos(a) * r0, 150 + Math.sin(a) * r0], [970 + Math.cos(a) * r1, 150 + Math.sin(a) * r1]], { t, seed: 700 + i, lw: 5 }); }
      ctx.restore();
    }
  }

  // ═════════════════════════════ SCENE ═════════════════════════════
  F.addScene({
    name: 'd_finale', start: 46, end: 60,
    subtitle(t, line) { return line.speaker === 'narrator' ? false : null; },
    draw(ctx, t) {
      // warm the flipbook thumbnails a few at a time before they are needed
      if (t >= 46.5 && t < 52.4) { const n = Math.min(NL, Math.floor((t - 46.5) / .36) + 1); for (let k = 0; k < n; k++) thumb(SNAP_T[k]); }
      if (t < 52) {
        drawWorld(ctx, t, worldCam(t));
        const fl = 1 - ease.outCubic(invLerp(46.0, 46.55, t));
        if (fl > 0) {
          ctx.save(); ctx.globalAlpha = fl;
          const g = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, W * .7); g.addColorStop(0, '#FFFFFF'); g.addColorStop(.6, '#FFF6DE'); g.addColorStop(1, '#FFE8B4');
          ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
        }
      } else if (t < 54) {
        const needWorld = t < LEAVES[0].s + LEAVES[0].d;
        if (needWorld) {
          const lo = t >= 52.2, Wc = lo ? F.offscreen('d_world_lo', 1280, 720) : F.offscreen('d_world'), g = Wc.getContext('2d');
          g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
          if (lo) g.scale(2 / 3, 2 / 3); // the page is already < 0.8× on screen by now
          g.save(); drawWorld(g, t, { zoom: 1, x: 960, y: 540 }); g.restore();
          WORLD_IMG = Wc;
        }
        drawOpenBook(ctx, t);
      } else drawLogo(ctx, t);
    },
  });
  window.D_FINALE = { SNAP_T, LEAVES };
})();
