/* Scene C — ACT 5 THE TURN + ACT 6 ORDER (30.0 – 46.0 s)
 *
 * 30.00  still: tangled ink ball on tired paper (hand-off from B)
 * 30.00–30.30  golden silk bookmark ribbon descends, sparkle at its tip, hooks the ball
 * 30.25–31.15  PAGE TURN (big, slow) → fresh glowing page; ball dangles from the ribbon
 * 31.20  "Chapter Seven." caption · ribbon hoists the ball up & away
 * 32.00  ANTHEM: The Wedding Chapter hardback pops in (rays, gold burst)
 * 32.50–33.00  cover swings open · 33.00–33.40 book folds into a phone
 * 33.00–33.35  ribbon lets go, ball is sucked into the phone
 * 33.35–34.00  scribble UNSPOOLS into perfectly straight guide lines (the card grid)
 * 34.0–36.5  cards shoot out of the phone and snap onto the grid every half beat
 * 37.0–39.0  completion ticks · 39.5 seating card lifts · 40.0 flips: Uncle Gary → Table 9
 * 42.0 / 43.0 / 44.0  PLAN IT. / SHARE IT. / SAVOUR IT. slams
 * 44.45 phone rises · 45.5 zoom through the screen into white-gold light → paper at 46.0
 */
(function () {
  const F = FILM, P = F.PAL, FT = F.FONT, W = F.W, H = F.H, TAU = F.TAU;
  const { clamp, lerp, invLerp, remap, ease, spring, jiggle } = F;

  // ─────────────────────────── layout ───────────────────────────
  const BALL = { x: 960, y: 540, r: 220 };
  const PH = { x: 960, y: 515, w: 400, h: 800 };
  const CW = 440, CH = 220;
  const COLX = [150, 1330], ROWY = [115, 365, 615];
  const CARDS = [
    { id: 'guests', col: 0, row: 0, acc: P.coral, title: 'Guests', sub: 'RSVPS' },
    { id: 'timeline', col: 1, row: 0, acc: P.cobalt, title: 'Timeline', sub: 'ON THE DAY' },
    { id: 'budget', col: 0, row: 1, acc: P.mint, title: 'Budget', sub: 'SPENDING' },
    { id: 'seating', col: 1, row: 1, acc: P.lilac, title: 'Seating', sub: 'TABLES' },
    { id: 'suppliers', col: 0, row: 2, acc: P.gold, title: 'Suppliers', sub: 'THE TEAM' },
    { id: 'todos', col: 1, row: 2, acc: P.blush, title: 'To-dos', sub: 'THIS WEEK' },
  ];
  CARDS.forEach((c, i) => {
    c.i = i; c.x = COLX[c.col]; c.y = ROWY[c.row]; c.cx = c.x + CW / 2; c.cy = c.y + CH / 2;
    c.snap = 34 + i * .5;
    c.done = c.id === 'todos' ? 40.5 : 37 + i * .5;
  });
  const CARD = Object.fromEntries(CARDS.map(c => [c.id, c]));
  const CARD_BG = '#FFFDF8', GREY = '#77706A', LINE = '#E8E0D2';

  // ─────────────────────────── ink ball strands ───────────────────────────
  const NS = 24, NP = 64;
  const STRANDS = (() => {
    const r = F.rng(4242), out = [];
    for (let s = 0; s < NS; s++) {
      const a0 = r() * TAU, r0 = Math.sqrt(r()) * BALL.r * .75;
      let x = Math.cos(a0) * r0, y = Math.sin(a0) * r0, h = r() * TAU, turn = (r() - .5) * .8;
      const pts = [];
      for (let i = 0; i < NP; i++) {
        pts.push([x, y]);
        turn = turn * .7 + (r() - .5) * 1.1;
        h += turn;
        const st = 15 + r() * 15;
        x += Math.cos(h) * st; y += Math.sin(h) * st;
        const d = Math.hypot(x, y), lim = BALL.r * (.86 + r() * .1);
        if (d > lim) { x *= lim / d; y *= lim / d; h = Math.atan2(-y, -x) + (r() - .5) * 1.6; }
      }
      out.push(pts);
    }
    return out;
  })();
  // straight targets: 4 edges of each card slot
  const TARGETS = [];
  CARDS.forEach(c => {
    const a = [c.x, c.y], b = [c.x + CW, c.y], d = [c.x + CW, c.y + CH], e = [c.x, c.y + CH];
    for (const [p, q] of [[a, b], [b, d], [d, e], [e, a]]) {
      const pts = [];
      for (let i = 0; i < NP; i++) { const u = i / (NP - 1); pts.push([lerp(p[0], q[0], u), lerp(p[1], q[1], u)]); }
      TARGETS.push(pts);
    }
  });
  const UNSPOOL0 = 33.35, UNSPOOL1 = 34.0;

  function ballState(t) {
    let x = BALL.x, y = BALL.y, s = 1, rot = 0;
    if (t >= 30.3) {
      const k = spring(t - 30.3, 1.6, .35);
      y -= 46 * k;
      x += jiggle(t - 30.3, .8, 1.1) * 22;
      rot = jiggle(t - 30.34, .8, 1.1) * -.06;
    }
    const hoist = remap(t, 31.15, 32.05, 0, 1, ease.inOutCubic);
    if (hoist > 0) { y = lerp(y, 190, hoist); s = lerp(1, .42, hoist); }
    if (t >= 32.0) { y += Math.sin((t - 32) * 5) * 6; x += Math.sin((t - 32) * 3.4) * 5; rot += Math.sin((t - 32) * 3.4) * .05; }
    const suck = remap(t, 33.0, UNSPOOL0, 0, 1, ease.inBack);
    if (suck !== 0) { x = lerp(x, PH.x, suck); y = lerp(y, PH.y, suck); s = lerp(s, .16, clamp(suck)); rot += suck * 5; }
    return { x, y, s, rot };
  }
  function ribbonTip(t, b) {
    const hookY = b.y - BALL.r * b.s + 34 * b.s;
    if (t < 30.3) return lerp(-60, hookY, ease.outCubic(invLerp(30.0, 30.3, t)));
    if (t < 33.0) return hookY;
    return lerp(hookY, -80, ease.inCubic(invLerp(33.0, 33.25, t)));
  }

  function drawBall(ctx, t, b, boilT) {
    ctx.save();
    ctx.translate(b.x, b.y); ctx.rotate(b.rot); ctx.scale(b.s, b.s);
    ctx.strokeStyle = P.ink; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 4.6;
    for (let k = 0; k < NS; k++) {
      F.smoothOpen(ctx, F.wobble(STRANDS[k], boilT, k * 3.1, 1.3));
      ctx.stroke();
    }
    ctx.restore();
  }
  // Strands lerping from the (shrunk) ball to straight lines.
  function drawUnspool(ctx, t, b) {
    const u = invLerp(UNSPOOL0, UNSPOOL1, t);
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = P.ink;
    for (let k = 0; k < NS; k++) {
      const src = STRANDS[k], dst = TARGETS[k];
      const delay = F.hash(k * 7.7) * .3, uk = clamp((u - delay) / (1 - .3));
      const cs = Math.cos(b.rot), sn = Math.sin(b.rot);
      const pts = [];
      for (let i = 0; i < NP; i++) {
        const lead = (NP - 1 - i) / (NP - 1); // tail of the strand straightens first, reads as "pulled"
        const pi = ease.inOutCubic(clamp(uk * 1.5 - lead * .5));
        const sx = b.x + (src[i][0] * cs - src[i][1] * sn) * b.s, sy = b.y + (src[i][0] * sn + src[i][1] * cs) * b.s;
        const wig = Math.sin(pi * Math.PI) * 40 * (1 - pi);
        const nx = F.noise1(i * .35 + t * 9, k) * wig, ny = F.noise1(i * .35 + t * 9, k + 50) * wig;
        pts.push([lerp(sx, dst[i][0], pi) + nx, lerp(sy, dst[i][1], pi) + ny]);
      }
      ctx.lineWidth = lerp(4.6, 3, uk);
      if (uk >= 1) { ctx.beginPath(); ctx.moveTo(dst[0][0], dst[0][1]); ctx.lineTo(dst[NP - 1][0], dst[NP - 1][1]); }
      else F.smoothOpen(ctx, pts);
      ctx.stroke();
    }
    ctx.restore();
  }
  // Straight guide lines that stay until each card lands on them.
  function drawGuides(ctx, t) {
    ctx.save(); ctx.strokeStyle = P.ink; ctx.lineCap = 'round';
    CARDS.forEach(c => {
      const a = 1 - invLerp(c.snap + .1, c.snap + .3, t);
      if (a <= 0) return;
      ctx.globalAlpha = a; ctx.lineWidth = 3;
      ctx.strokeRect(c.x, c.y, CW, CH);
      // little registration corner marks — "order"
      ctx.lineWidth = 2;
      for (const [px, py] of [[c.x, c.y], [c.x + CW, c.y], [c.x + CW, c.y + CH], [c.x, c.y + CH]]) {
        ctx.beginPath(); ctx.moveTo(px - 14, py); ctx.lineTo(px + 14, py); ctx.moveTo(px, py - 14); ctx.lineTo(px, py + 14); ctx.stroke();
      }
    });
    ctx.restore();
  }

  // ─────────────────────────── ribbon ───────────────────────────
  function drawRibbon(ctx, t, tipX, tipY) {
    if (tipY < -50) return;
    const x0 = 960, y0 = -40, n = 22, wR = 34;
    const L = [], R = [];
    for (let i = 0; i <= n; i++) {
      const u = i / n, sway = Math.sin(u * 4.2 + t * 2.2) * 9 * Math.sin(u * Math.PI);
      const x = lerp(x0, tipX, u * u) + sway, y = lerp(y0, tipY, u);
      L.push([x - wR / 2, y]); R.push([x + wR / 2, y]);
    }
    const tip = [tipX, tipY];
    ctx.save();
    ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]);
    L.forEach(p => ctx.lineTo(p[0], p[1]));
    ctx.lineTo(tip[0] - wR / 2, tip[1] + 22); ctx.lineTo(tip[0], tip[1] + 8); ctx.lineTo(tip[0] + wR / 2, tip[1] + 22);
    for (let i = R.length - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
    ctx.closePath();
    const g = ctx.createLinearGradient(tipX - wR, 0, tipX + wR, 0);
    g.addColorStop(0, P.goldShade); g.addColorStop(.45, P.gold); g.addColorStop(.6, '#FFE7A6'); g.addColorStop(1, P.goldShade);
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = P.ink; ctx.lineJoin = 'round'; ctx.stroke();
    // silk sheen
    ctx.beginPath(); L.forEach((p, i) => { const x = p[0] + wR * .62; i ? ctx.lineTo(x, p[1]) : ctx.moveTo(x, p[1]); });
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,250,225,.8)'; ctx.stroke();
    ctx.restore();
  }
  function glowDot(ctx, x, y, r, col = '255,236,170', a = 1) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  // ─────────────────────────── pages ───────────────────────────
  function oldPage(g) {
    const c = F.offscreen('c_oldpage');
    if (!c._done) {
      const q = c.getContext('2d'), r = F.rng(99);
      F.paper(q, { tint: '#DDD3C2', tintAlpha: .55 });
      q.fillStyle = P.ink;
      for (let i = 0; i < 90; i++) {
        const a = r() * TAU, d = 280 + r() * 700, x = 960 + Math.cos(a) * d * 1.3, y = 540 + Math.sin(a) * d * .8;
        q.globalAlpha = .25 + r() * .5; q.beginPath(); q.arc(x, y, 1.5 + r() * 6, 0, TAU); q.fill();
      }
      q.globalAlpha = .18; q.lineWidth = 3; q.strokeStyle = P.ink;
      for (let i = 0; i < 14; i++) {
        const x = r() * W, y = r() * H; q.beginPath(); q.moveTo(x, y);
        for (let j = 0; j < 6; j++) q.lineTo(x + (r() - .5) * 120, y + (r() - .5) * 90);
        q.stroke();
      }
      F.vignette(q, .45);
      c._done = true;
    }
    g.drawImage(c, 0, 0);
  }
  function freshStatic() {
    const c = F.offscreen('c_fresh');
    if (c._done) return c;
    const g = c.getContext('2d');
    F.paper(g);
    const gr = g.createRadialGradient(960, 520, 0, 960, 520, 900);
    gr.addColorStop(0, 'rgba(255,252,240,.95)'); gr.addColorStop(.45, 'rgba(255,246,222,.5)'); gr.addColorStop(1, 'rgba(255,246,222,0)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    c._done = true; return c;
  }
  function dotGrid() {
    const c = F.offscreen('c_grid');
    if (c._done) return c;
    const g = c.getContext('2d'); g.fillStyle = 'rgba(22,22,29,.16)';
    for (let x = 30; x < W; x += 40) for (let y = 35; y < H; y += 40) { g.beginPath(); g.arc(x, y, 2, 0, TAU); g.fill(); }
    c._done = true; return c;
  }
  // Rays are baked once (full-frame, per centre/colour) and drawn 1:1 — rotating a full-frame
  // bitmap costs ~25 ms on the software renderer. Two offset bakes cross-fade for a slow shimmer.
  function raySprite(cx, cy, col, n, rot) {
    const c = F.offscreen(`c_rays_${cx}_${cy}_${col}_${n}_${rot}`);
    if (c._done) return c;
    const g = c.getContext('2d'); g.translate(cx, cy); g.rotate(rot);
    for (let i = 0; i < n; i++) {
      g.rotate(TAU / n);
      const gr = g.createLinearGradient(0, 0, 1300, 0);
      gr.addColorStop(0, `rgba(${col},.22)`); gr.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.lineTo(1300, -110); g.lineTo(1300, 110); g.closePath(); g.fill();
    }
    c._done = true; return c;
  }
  function rays(ctx, t, cx, cy, a, col = '255,214,120', n = 14) {
    if (a <= 0) return;
    const w = .5 + .5 * Math.sin(t * 1.3);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    const ga = ctx.globalAlpha * clamp(a);
    ctx.globalAlpha = ga * (1 - w * .6); ctx.drawImage(raySprite(cx, cy, col, n, 0), 0, 0);
    ctx.globalAlpha = ga * w * .6; ctx.drawImage(raySprite(cx, cy, col, n, Math.PI / n), 0, 0);
    ctx.restore();
  }
  /** pre-blurred soft shadow sprite for a rounded rect (drawn under opaque cards). */
  function shadowSprite(key, w, h, r, blur, alpha) {
    const pad = blur * 2, c = F.offscreen('c_sh_' + key, w + pad * 2, h + pad * 2);
    if (c._done) return c;
    const g = c.getContext('2d'); g.shadowColor = `rgba(80,55,25,${alpha})`; g.shadowBlur = blur;
    g.shadowOffsetX = 0; g.shadowOffsetY = 0; g.fillStyle = '#000'; g.beginPath(); g.roundRect(pad, pad, w, h, r); g.fill();
    c._done = true; c._pad = pad; return c;
  }
  function freshPage(g, t) {
    g.drawImage(freshStatic(), 0, 0);
    rays(g, t, 960, 520, .6 + .4 * Math.sin(t * 2));
    const ga = invLerp(33.5, 34.2, t);
    if (ga > 0) { g.save(); g.globalAlpha = ga; g.drawImage(dotGrid(), 0, 0); g.restore(); }
  }

  // ─────────────────────────── small drawing utils ───────────────────────────
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); }
  function check(ctx, x, y, s, col = '#fff', lw = 5) {
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = col; ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(x - s * .5, y); ctx.lineTo(x - s * .12, y + s * .38); ctx.lineTo(x + s * .55, y - s * .4); ctx.stroke(); ctx.restore();
  }
  function partialCheck(ctx, x, y, s, p, col = '#fff', lw = 5) {
    if (p <= 0) return;
    const pts = F.partialPolyline([[x - s * .5, y], [x - s * .12, y + s * .38], [x + s * .55, y - s * .4]], p);
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = col; ctx.lineWidth = lw;
    ctx.beginPath(); pts.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.stroke(); ctx.restore();
  }
  /** mint tick badge popping at dt */
  function tickBadge(ctx, x, y, r, dt) {
    if (dt <= 0) return;
    const k = spring(dt, 3.6, .32);
    ctx.save(); ctx.translate(x, y); ctx.scale(k, k);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fillStyle = P.mint; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = P.ink; ctx.stroke();
    partialCheck(ctx, 0, 1, r * 1.05, invLerp(.03, .2, dt), '#fff', Math.max(3, r * .22));
    ctx.restore();
    // burst lines
    const b = invLerp(0, .3, dt);
    if (b > 0 && b < 1) {
      ctx.save(); ctx.strokeStyle = P.mint; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.globalAlpha = 1 - b;
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, r0 = r * (1.2 + b * .8), r1 = r * (1.5 + b * 1.1); ctx.beginPath(); ctx.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); ctx.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); ctx.stroke(); }
      ctx.restore();
    }
  }
  function txt(ctx, s, x, y, size, fam, weight, col, align = 'left', style = 'normal') {
    F.font(ctx, size, fam, weight, style); ctx.fillStyle = col; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(s, x, y);
  }
  function avatar(ctx, x, y, r, col, seed, kind = 'circle') {
    ctx.save(); ctx.translate(x, y);
    ctx.beginPath();
    if (kind === 'tri') { ctx.moveTo(0, -r * 1.15); ctx.lineTo(r * 1.05, r * .8); ctx.lineTo(-r * 1.05, r * .8); ctx.closePath(); }
    else if (kind === 'pill') ctx.roundRect(-r * .7, -r, r * 1.4, r * 2, r * .7);
    else ctx.arc(0, 0, r, 0, TAU);
    ctx.fillStyle = col; ctx.fill(); ctx.lineWidth = Math.max(2.5, r * .12); ctx.strokeStyle = P.ink; ctx.stroke();
    ctx.fillStyle = P.ink;
    const ey = kind === 'tri' ? r * .05 : -r * .12;
    ctx.beginPath(); ctx.arc(-r * .3, ey, r * .11, 0, TAU); ctx.arc(r * .3, ey, r * .11, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.lineWidth = Math.max(2, r * .09); ctx.lineCap = 'round';
    ctx.arc(0, ey + r * .15, r * .25, .25, Math.PI - .25); ctx.stroke();
    if (kind === 'tri') { // moustache
      ctx.beginPath(); ctx.moveTo(0, ey + r * .28);
      ctx.quadraticCurveTo(-r * .35, ey + r * .15, -r * .5, ey + r * .38); ctx.moveTo(0, ey + r * .28); ctx.quadraticCurveTo(r * .35, ey + r * .15, r * .5, ey + r * .38);
      ctx.lineWidth = Math.max(3, r * .16); ctx.stroke();
    }
    ctx.restore();
  }

  // ─────────────────────────── the book ───────────────────────────
  const BK = { w: 360, h: 480 };
  function foilGradient(ctx, x0, x1, t) {
    const g = ctx.createLinearGradient(x0, 0, x1, 0), sh = ((t * .7) % 1.6) - .3;
    g.addColorStop(0, P.goldShade); g.addColorStop(clamp(sh - .12), P.gold); g.addColorStop(clamp(sh), '#FFF4CC'); g.addColorStop(clamp(sh + .12), P.gold); g.addColorStop(1, P.goldShade);
    return g;
  }
  function bookCover(ctx, w, h, t) { // local: spine at x=0, cover spans 0..w, centred vertically
    rr(ctx, 0, -h / 2, w, h, [4, 14, 14, 4]);
    ctx.fillStyle = '#F3E6CF'; ctx.fill();
    // linen texture lines
    ctx.save(); ctx.clip(); ctx.strokeStyle = 'rgba(160,120,70,.08)'; ctx.lineWidth = 1;
    for (let y = -h / 2; y < h / 2; y += 5) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    ctx.fillStyle = 'rgba(160,120,70,.18)'; ctx.fillRect(0, -h / 2, 26, h); // spine hinge
    ctx.restore();
    rr(ctx, 0, -h / 2, w, h, [4, 14, 14, 4]); ctx.lineWidth = 5; ctx.strokeStyle = P.ink; ctx.stroke();
    // foil frame
    const fg = foilGradient(ctx, 0, w, t);
    ctx.strokeStyle = fg; ctx.lineWidth = 4; rr(ctx, 44, -h / 2 + 26, w - 70, h - 52, 10); ctx.stroke();
    ctx.lineWidth = 1.5; rr(ctx, 54, -h / 2 + 36, w - 90, h - 72, 6); ctx.stroke();
    // emblem: little ribbon heart
    ctx.save(); ctx.translate(44 + (w - 70) / 2, -h / 2 + 118);
    F.heartPath(ctx, 0, 0, 62); ctx.fillStyle = fg; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = P.goldShade; ctx.stroke();
    ctx.restore();
    const cx = 44 + (w - 70) / 2;
    ctx.textAlign = 'center'; ctx.fillStyle = fg;
    F.font(ctx, 34, FT.display, 400, 'italic'); ctx.fillText('The', cx, -h / 2 + 232);
    F.font(ctx, 58, FT.display, 900); ctx.fillText('Wedding', cx, -h / 2 + 292); ctx.fillText('Chapter', cx, -h / 2 + 350);
    ctx.fillRect(cx - 40, -h / 2 + 384, 80, 3);
    F.font(ctx, 16, FT.label, 700); ctx.fillText('D  ♥  D', cx, -h / 2 + 420);
  }
  function drawBook(ctx, t) {
    const rise = spring(t - 31.84, 2.3, .58);
    const cy = lerp(1500, 640, rise), open = remap(t, 32.5, 33.0, 0, 1, ease.inOutCubic);
    const spineX = lerp(960 - BK.w / 2, 960, open);
    const land = jiggle(t - 32.02, 3.5, 6) * .08;
    ctx.save();
    ctx.translate(960, cy + BK.h / 2); ctx.scale(1 + land, 1 - land); ctx.translate(-960, -(cy + BK.h / 2));
    // soft shadow
    ctx.save(); ctx.globalAlpha = .25 * clamp(rise); ctx.fillStyle = P.ink;
    ctx.beginPath(); ctx.ellipse(960, cy + BK.h / 2 + 30, 260 + open * 180, 22, 0, 0, TAU); ctx.fill(); ctx.restore();
    ctx.translate(spineX, cy);
    // right page block (thickness)
    for (let i = 3; i >= 0; i--) {
      rr(ctx, 0, -BK.h / 2 + 4 + i * 3, BK.w - 6 + i * 2, BK.h - 8, [0, 10, 10, 0]);
      ctx.fillStyle = i ? '#EFE5D2' : '#FFFBF1'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = P.ink; ctx.stroke();
    }
    if (open > 0) { // glowing first page
      ctx.save(); rr(ctx, 0, -BK.h / 2 + 4, BK.w - 6, BK.h - 8, [0, 10, 10, 0]); ctx.clip();
      glowDot(ctx, BK.w / 2, 0, 320, '255,236,170', .9 * open);
      ctx.globalAlpha = open;
      txt(ctx, 'Chapter Seven.', BK.w / 2, -110, 30, FT.display, 400, P.ink, 'center', 'italic');
      F.sparkle(ctx, BK.w / 2, 0, 40 + 8 * Math.sin(t * 10), P.gold, t);
      ctx.restore();
      // left page (inside of the cover side)
      const lw = BK.w * clamp((open - .5) * 2);
      if (lw > 1) {
        rr(ctx, -lw, -BK.h / 2 + 4, lw, BK.h - 8, [10, 0, 0, 10]); ctx.fillStyle = '#FFFBF1'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = P.ink; ctx.stroke();
        const g = ctx.createLinearGradient(-40, 0, 0, 0); g.addColorStop(0, 'rgba(120,90,50,0)'); g.addColorStop(1, 'rgba(120,90,50,.25)');
        ctx.fillStyle = g; ctx.fillRect(-40, -BK.h / 2 + 6, 40, BK.h - 12);
      }
    }
    // cover (swinging about the spine)
    const ang = open * Math.PI, c = Math.cos(ang);
    ctx.save();
    if (c > 0) {
      ctx.transform(c, -Math.sin(ang) * .12, 0, 1, 0, 0);
      bookCover(ctx, BK.w, BK.h, t);
    } else {
      ctx.transform(c, Math.sin(ang) * .12, 0, 1, 0, 0);
      rr(ctx, 0, -BK.h / 2 - 2, BK.w + 8, BK.h + 4, [4, 14, 14, 4]); ctx.fillStyle = P.coral; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = P.ink; ctx.stroke();
      rr(ctx, 10, -BK.h / 2 + 10, BK.w - 10, BK.h - 20, 8); ctx.fillStyle = '#FFE9D6'; ctx.fill();
    }
    ctx.restore();
    // bookmark ribbon tail
    if (open < .5) {
      ctx.save(); ctx.globalAlpha = 1 - open * 2;
      ctx.beginPath(); ctx.moveTo(BK.w * .7, BK.h / 2 - 4); ctx.lineTo(BK.w * .7 + 4, BK.h / 2 + 50); ctx.lineTo(BK.w * .7 + 16, BK.h / 2 + 40); ctx.lineTo(BK.w * .7 + 28, BK.h / 2 + 52); ctx.lineTo(BK.w * .7 + 26, BK.h / 2 - 4);
      ctx.fillStyle = P.coral; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = P.ink; ctx.stroke(); ctx.restore();
    }
    ctx.restore();
  }
  /** book spread → phone morph (m 0..1) */
  function drawMorph(ctx, t, m) {
    const e = ease.inOutCubic(m), pop = jiggle(t - 33.4, 3, 5) * .05;
    const w = lerp(BK.w * 2, PH.w, e), h = lerp(BK.h - 8, PH.h, e), cx = 960, cy = lerp(640, PH.y, e), r = lerp(10, 64, e);
    ctx.save(); ctx.translate(cx, cy); ctx.scale(1 + pop, 1 - pop);
    rr(ctx, -w / 2, -h / 2, w, h, r); ctx.fillStyle = e > .5 ? P.ink : '#FFFBF1'; ctx.fill();
    if (e > .5) { const i = 14 * (e - .5) * 2; rr(ctx, -w / 2 + i, -h / 2 + i, w - i * 2, h - i * 2, Math.max(4, r - i)); ctx.fillStyle = '#FFFBF1'; ctx.fill(); }
    rr(ctx, -w / 2, -h / 2, w, h, r); ctx.lineWidth = 5; ctx.strokeStyle = P.ink; ctx.stroke();
    // spine crease fading
    ctx.globalAlpha = 1 - e; ctx.beginPath(); ctx.moveTo(0, -h / 2); ctx.lineTo(0, h / 2); ctx.lineWidth = 3; ctx.stroke();
    ctx.globalAlpha = 1; glowDot(ctx, 0, 0, 380, '255,236,170', .8 * (1 - Math.abs(e - .5) * 2) + .2);
    ctx.restore();
  }

  // ─────────────────────────── phone ───────────────────────────
  function drawPhone(ctx, t, cx, cy, s, screen) {
    const w = PH.w, h = PH.h;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(s, s);
    const psh = shadowSprite('phone', w, h, 64, 60, .32); ctx.drawImage(psh, -w / 2 - psh._pad, -h / 2 - psh._pad + 30);
    rr(ctx, -w / 2, -h / 2, w, h, 64); ctx.fillStyle = P.ink; ctx.fill();
    // side buttons
    ctx.fillStyle = P.ink; rr(ctx, w / 2 - 2, -h / 2 + 170, 8, 90, 4); ctx.fill(); rr(ctx, -w / 2 - 6, -h / 2 + 150, 8, 60, 4); ctx.fill(); rr(ctx, -w / 2 - 6, -h / 2 + 225, 8, 60, 4); ctx.fill();
    const sw = w - 28, sh = h - 28;
    ctx.save(); rr(ctx, -sw / 2, -sh / 2, sw, sh, 50); ctx.clip();
    ctx.translate(-sw / 2, -sh / 2);
    screen(ctx, sw, sh);
    ctx.restore();
    // island + glare
    rr(ctx, -56, -h / 2 + 26, 112, 32, 16); ctx.fillStyle = P.ink; ctx.fill();
    ctx.save(); rr(ctx, -sw / 2, -sh / 2, sw, sh, 50); ctx.clip();
    const g = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.42, 'rgba(255,255,255,0)'); g.addColorStop(.43, 'rgba(255,255,255,.16)'); g.addColorStop(.55, 'rgba(255,255,255,.05)'); g.addColorStop(.56, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.restore();
    rr(ctx, -w / 2, -h / 2, w, h, 64); ctx.lineWidth = 5; ctx.strokeStyle = P.ink; ctx.stroke();
    ctx.restore();
  }
  function statusBar(g, w) {
    txt(g, '9:41', 42, 44, 19, FT.ui, 600, P.ink);
    g.fillStyle = P.ink; for (let i = 0; i < 4; i++) g.fillRect(w - 110 + i * 8, 38 - i * 4, 5, 6 + i * 4);
    rr(g, w - 70, 28, 34, 17, 5); g.lineWidth = 2; g.strokeStyle = P.ink; g.stroke(); rr(g, w - 67, 31, 24, 11, 3); g.fill();
  }
  const ICON = {
    guests(g, s) { g.beginPath(); g.arc(-s * .18, -s * .12, s * .16, 0, TAU); g.arc(s * .2, -s * .12, s * .16, 0, TAU); g.fill(); g.beginPath(); g.ellipse(-s * .18, s * .28, s * .26, s * .17, 0, Math.PI, 0); g.ellipse(s * .2, s * .28, s * .26, s * .17, 0, Math.PI, 0); g.fill(); },
    budget(g, s) { g.beginPath(); g.arc(0, 0, s * .34, 0, TAU); g.lineWidth = s * .09; g.stroke(); g.fillRect(-s * .04, -s * .2, s * .08, s * .4); },
    suppliers(g, s) { for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; g.beginPath(); g.arc(Math.cos(a) * s * .2, Math.sin(a) * s * .2, s * .14, 0, TAU); g.fill(); } g.save(); g.fillStyle = P.gold; g.beginPath(); g.arc(0, 0, s * .1, 0, TAU); g.fill(); g.restore(); },
    timeline(g, s) { g.beginPath(); g.arc(0, 0, s * .34, 0, TAU); g.lineWidth = s * .09; g.stroke(); g.beginPath(); g.moveTo(0, -s * .2); g.lineTo(0, 0); g.lineTo(s * .15, s * .1); g.stroke(); },
    seating(g, s) { g.beginPath(); g.arc(0, 0, s * .17, 0, TAU); g.fill(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; g.beginPath(); g.arc(Math.cos(a) * s * .33, Math.sin(a) * s * .33, s * .07, 0, TAU); g.fill(); } },
    todos(g, s) { g.lineWidth = s * .09; rr(g, -s * .3, -s * .3, s * .6, s * .6, s * .12); g.stroke(); check(g, 0, 0, s * .42, g.strokeStyle, s * .09); },
  };
  function icon(g, id, x, y, s, fg) {
    g.save(); g.translate(x, y); g.fillStyle = fg; g.strokeStyle = fg; g.lineCap = 'round'; g.lineJoin = 'round'; ICON[id](g, s); g.restore();
  }
  function doneCount(t) { return CARDS.filter(c => t >= c.done).length; }
  function appScreen(t) {
    return (g, w, h) => {
      g.fillStyle = '#FFFBF3'; g.fillRect(0, 0, w, h);
      glowDot(g, w / 2, 260, 300, '255,226,150', .35);
      statusBar(g, w);
      // header
      g.save(); g.translate(40, 92); g.fillStyle = P.gold; g.beginPath(); g.moveTo(0, -14); g.lineTo(14, -14); g.lineTo(14, 8); g.lineTo(7, 2); g.lineTo(0, 8); g.closePath(); g.fill(); g.lineWidth = 2; g.strokeStyle = P.ink; g.stroke(); g.restore();
      txt(g, 'The Wedding Chapter', 64, 100, 22, FT.display, 600, P.ink);
      txt(g, 'Dot & Dash', 36, 162, 38, FT.display, 900, P.ink);
      txt(g, 'Our wedding plan', 38, 192, 18, FT.ui, 400, GREY);
      // progress ring
      const pv = CARDS.reduce((a, c) => a + ease.outCubic(clamp((t - c.done) / .4)), 0) / 6;
      const rx = w - 58, ry = 160;
      g.lineWidth = 11; g.strokeStyle = LINE; g.beginPath(); g.arc(rx, ry, 34, 0, TAU); g.stroke();
      g.strokeStyle = P.gold; g.lineCap = 'round'; g.beginPath(); g.arc(rx, ry, 34, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(.001, pv)); g.stroke();
      txt(g, Math.round(pv * 100) + '%', rx, ry + 7, pv >= 1 ? 17 : 20, FT.display, 900, P.ink, 'center');
      // tiles
      CARDS.forEach((c, i) => {
        const col = i % 2, row = Math.floor(i / 2), tx = 28 + col * (w - 56 + 16) / 2, ty = 240 + row * 112, tw = (w - 56 - 16) / 2, th = 96;
        const lit = clamp((t - c.snap + .12) * 6), pop = jiggle(t - c.snap + .05, 4, 8) * .12;
        g.save(); g.translate(tx + tw / 2, ty + th / 2); g.scale(1 + pop, 1 + pop);
        rr(g, -tw / 2, -th / 2, tw, th, 20); g.fillStyle = lit > 0 ? c.acc : '#F1EADF'; g.globalAlpha = lit > 0 ? .25 + .75 * lit : 1; g.fill(); g.globalAlpha = 1;
        g.lineWidth = 2.5; g.strokeStyle = lit > 0 ? P.ink : LINE; g.stroke();
        icon(g, c.id, -tw / 2 + 30, -8, 34, lit > 0 ? P.ink : '#BDB4A6');
        txt(g, c.title, -tw / 2 + 18, 32, 17, FT.ui, 800, lit > 0 ? P.ink : '#BDB4A6');
        if (t >= c.done) { g.save(); g.translate(tw / 2 - 20, -th / 2 + 20); tickBadge(g, 0, 0, 11, t - c.done); g.restore(); }
        g.restore();
      });
      // bottom nav
      rr(g, 24, h - 96, w - 48, 70, 35); g.fillStyle = P.ink; g.fill();
      ['guests', 'timeline', 'seating', 'todos'].forEach((id, i) => icon(g, id, 24 + (w - 48) * (i + .5) / 4, h - 61, 34, i === 0 ? P.gold : '#FFFBF3'));
    };
  }

  // ─────────────────────────── cards ───────────────────────────
  function cardHeader(g, c, t) {
    rr(g, 22, 22, 54, 54, 16); g.fillStyle = c.acc; g.fill(); g.lineWidth = 2.5; g.strokeStyle = P.ink; g.stroke();
    icon(g, c.id, 49, 49, 40, P.ink);
    txt(g, c.title, 92, 52, 28, FT.ui, 800, P.ink);
    F.font(g, 14, FT.label, 700); g.fillStyle = GREY; g.fillText(c.sub, 93, 74);
    tickBadge(g, CW - 40, 46, 20, t - c.done);
  }
  const CONTENT = {
    guests(g, c, t, ct) {
      const n = Math.round(124 * ease.outCubic(clamp((ct - .15) / 1.6)));
      F.font(g, 76, FT.display, 900); g.fillStyle = P.ink; g.textAlign = 'left'; g.fillText(String(n), 22, 186);
      const nw = g.measureText(String(n)).width;
      txt(g, 'RSVPs in', 30 + nw, 184, 20, FT.ui, 600, GREY);
      if (ct > 1.75) { g.save(); g.translate(40 + nw + g.measureText('RSVPs in').width + 30, 172); tickBadge(g, 0, 0, 13, ct - 1.75); g.restore(); }
      const cols = [P.coral, P.cobalt, P.gold, P.mint, P.lilac, P.blush];
      for (let i = 5; i >= 0; i--) { const k = spring(ct - .2 - i * .12, 4, .4); if (k <= 0) continue; g.save(); g.translate(CW - 50 - i * 26, 124); g.scale(k, k); avatar(g, 0, 0, 17, cols[i]); g.restore(); }
    },
    budget(g, c, t, ct) {
      const p = .72 * ease.outCubic(clamp((ct - .2) / 1.2)) + jiggle(ct - 1.3, 3, 6) * .01;
      const pill = spring(ct - 1.3, 4, .4);
      if (pill > 0) { g.save(); g.translate(24, 102); g.scale(pill, pill); rr(g, 0, 0, 128, 34, 17); g.fillStyle = P.mint; g.fill(); g.lineWidth = 2.5; g.strokeStyle = P.ink; g.stroke(); txt(g, 'On track', 64, 23, 17, FT.ui, 800, P.ink, 'center'); g.restore(); }
      txt(g, Math.round(p * 100) + '%', CW - 24, 132, 36, FT.display, 900, P.ink, 'right');
      rr(g, 24, 156, CW - 48, 28, 14); g.fillStyle = '#EFE8DC'; g.fill();
      rr(g, 24, 156, Math.max(28, (CW - 48) * p), 28, 14); g.fillStyle = P.mint; g.fill();
      rr(g, 24, 156, CW - 48, 28, 14); g.lineWidth = 2.5; g.strokeStyle = P.ink; g.stroke();
      txt(g, 'of plan booked', 24, 208, 15, FT.label, 500, GREY);
    },
    suppliers(g, c, t, ct) {
      [['Florist', P.coral], ['Photographer', P.cobalt], ['Band', P.lilac]].forEach(([name, col], i) => {
        const y = 108 + i * 38, a = clamp((ct - i * .1) * 5);
        g.globalAlpha = a;
        g.beginPath(); g.arc(34, y, 9, 0, TAU); g.fillStyle = col; g.fill(); g.lineWidth = 2; g.strokeStyle = P.ink; g.stroke();
        txt(g, name, 56, y + 8, 22, FT.ui, 600, P.ink);
        const td = ct - (.25 + i * .5);
        if (td > 0) { txt(g, 'Booked', CW - 62, y + 6, 14, FT.label, 700, '#1E9E66', 'right'); tickBadge(g, CW - 38, y, 12, td); }
        g.globalAlpha = 1;
        if (i < 2) { g.fillStyle = LINE; g.fillRect(56, y + 19, CW - 80, 1.5); }
      });
    },
    timeline(g, c, t, ct) {
      const items = [['2:00', 'Ceremony'], ['3:30', 'Photos'], ['5:00', 'Dinner'], ['8:00', 'First dance']];
      const lp = ease.outCubic(clamp((ct - .1) / 1.8));
      g.lineCap = 'round'; g.strokeStyle = LINE; g.lineWidth = 4; g.beginPath(); g.moveTo(40, 104); g.lineTo(40, 200); g.stroke();
      g.strokeStyle = P.cobalt; g.beginPath(); g.moveTo(40, 104); g.lineTo(40, 104 + 96 * lp); g.stroke();
      items.forEach(([tm, ev], i) => {
        const y = 104 + i * 32, on = ct - (.25 + i * .5);
        g.beginPath(); g.arc(40, y, 9, 0, TAU); g.fillStyle = on > 0 ? P.gold : '#fff'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = P.ink; g.stroke();
        if (on > 0) { const k = jiggle(on, 4, 8) * 6; g.beginPath(); g.arc(40, y, 9 + Math.abs(k), 0, TAU); g.stroke(); }
        txt(g, tm, 64, y + 7, 18, FT.label, 700, P.cobalt);
        txt(g, ev, 124, y + 7, 20, FT.ui, 600, on > 0 ? P.ink : '#B9B0A2');
      });
    },
    seating(g, c, t, ct) {
      const tables = [[98, 150, '7'], [220, 150, '8'], [342, 150, '9']];
      const m = ease.inOutCubic(clamp((ct - .15) / .9));
      const cols = [P.coral, P.cobalt, P.gold, P.mint, P.lilac, P.blush];
      tables.forEach(([x, y, lab], ti) => {
        // tangled → round table
        const N = 30, r = F.rng(300 + ti), pts = [];
        let sx = (r() - .5) * 60, sy = (r() - .5) * 40;
        for (let i = 0; i < N; i++) {
          sx += (r() - .5) * 46; sy += (r() - .5) * 40; sx = clamp(sx, -60, 60); sy = clamp(sy, -46, 46);
          const a = i / (N - 1) * TAU - Math.PI / 2;
          pts.push([lerp(x + sx, x + Math.cos(a) * 28, m), lerp(y + sy, y + Math.sin(a) * 28, m)]);
        }
        g.save(); g.lineWidth = lerp(3, 3.5, m); g.strokeStyle = P.ink; g.lineJoin = 'round';
        if (m >= 1) { g.beginPath(); g.arc(x, y, 28, 0, TAU); g.fillStyle = '#FFF3DA'; g.fill(); g.stroke(); txt(g, lab, x, y + 8, 22, FT.display, 900, P.ink, 'center'); }
        else { F.smoothOpen(g, F.wobble(pts, t, ti, 1.2 * (1 - m))); g.stroke(); }
        g.restore();
        for (let s = 0; s < 6; s++) {
          const k = spring(ct - 1.0 - ti * .12 - s * .04, 4, .4); if (k <= 0) continue;
          const a = s / 6 * TAU - Math.PI / 2;
          g.beginPath(); g.arc(x + Math.cos(a) * 44, y + Math.sin(a) * 44, 8 * k, 0, TAU); g.fillStyle = cols[(s + ti * 2) % 6]; g.fill(); g.lineWidth = 2; g.strokeStyle = P.ink; g.stroke();
        }
      });
      // tiny bar next to table 9
      if (m >= 1) { g.save(); g.translate(CW - 26, 196); g.globalAlpha = clamp((ct - 1.2) * 4); g.fillStyle = P.ink; g.beginPath(); g.moveTo(-9, -12); g.lineTo(9, -12); g.lineTo(0, -2); g.closePath(); g.fill(); g.fillRect(-1, -2, 2, 10); g.fillRect(-6, 8, 12, 2); g.restore(); }
    },
    todos(g, c, t, ct) {
      const items = ['Book the venue', 'Send invites', 'Taste the cake', 'Seat Uncle Gary'];
      const at = [.25, .75, 1.25, 40.45 - c.snap];
      items.forEach((s, i) => {
        const y = 104 + i * 31, d = ct - at[i], p = ease.outCubic(clamp(d / .22));
        rr(g, 24, y - 12, 24, 24, 7); g.fillStyle = p > 0 ? P.mint : '#fff'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = P.ink; g.stroke();
        if (p > 0) partialCheck(g, 36, y, 16, p, P.ink, 3.5);
        F.font(g, 20, FT.ui, 600); g.textAlign = 'left'; g.fillStyle = p > 0 ? '#9C948A' : P.ink; g.fillText(s, 62, y + 7);
        if (p > 0) { const w = g.measureText(s).width * p; g.fillStyle = P.coral; g.fillRect(60, y - 1, w + 4, 3.5); }
      });
    },
  };
  function cardShape(g, c, fill) {
    const sh = shadowSprite('card', CW, CH, 28, 36, .22); g.drawImage(sh, -sh._pad, -sh._pad + 16);
    rr(g, 0, 0, CW, CH, 28); g.fillStyle = fill; g.fill();
    rr(g, 0, 0, CW, CH, 28); g.lineWidth = 3; g.strokeStyle = P.ink; g.stroke();
  }
  function cardPose(c, t) {
    const ct = t - c.snap;
    const k = spring(ct, 2.4, .45), ks = spring(ct, 3, .38);
    const side = c.col ? 1 : -1;
    const x = lerp(PH.x, c.cx, k), y = lerp(PH.y, c.cy, k) - Math.sin(clamp(k) * Math.PI) * 60;
    const sq = jiggle(ct - .22, 4.5, 7) * .07;
    return { x, y, s: lerp(.12, 1, ks), rot: (1 - k) * side * .35, sx: 1 + sq, sy: 1 - sq, ct };
  }
  function drawCard(ctx, c, t, pose) {
    const p = pose || cardPose(c, t);
    if (p.ct < 0) return;
    // smear ghosts while travelling fast
    if (p.ct < .16) for (const d of [.05, .025]) {
      const q = cardPose(c, t - d); if (q.ct < 0) continue;
      ctx.save(); ctx.translate(q.x, q.y); ctx.rotate(q.rot); ctx.scale(q.s, q.s); ctx.globalAlpha = .18;
      rr(ctx, -CW / 2, -CH / 2, CW, CH, 28); ctx.fillStyle = c.acc; ctx.fill(); ctx.restore();
    }
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(p.s * p.sx, p.s * p.sy); ctx.translate(-CW / 2, -CH / 2);
    cardShape(ctx, c, CARD_BG);
    ctx.fillStyle = c.acc; ctx.globalAlpha = .9; rr(ctx, 0, 0, 10, CH, [28, 0, 0, 28]); // accent spine
    ctx.globalAlpha = 1;
    cardHeader(ctx, c, t);
    CONTENT[c.id](ctx, c, t, p.ct);
    ctx.restore();
  }
  // Uncle Gary (new character cameo): lilac triangle with moustache and a drink.
  function drawGary(ctx, x, y, s, t) {
    const sip = F.pulse(t, 40.55, 41.1), bob = Math.sin(t * 9) * 2;
    ctx.save(); ctx.translate(x, y + bob); ctx.scale(s, s);
    // arm + martini
    ctx.save(); ctx.translate(34, 6); ctx.rotate(-.3 - sip * .9);
    F.inkLine(ctx, [[0, 0], [16, -8], [24, -22]], { t, seed: 5, lw: 4 });
    ctx.translate(24, -26); ctx.rotate(sip * .5);
    ctx.beginPath(); ctx.moveTo(-14, -18); ctx.lineTo(14, -18); ctx.lineTo(0, -2); ctx.closePath(); ctx.fillStyle = '#E8FFF4'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = P.ink; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(0, 12); ctx.moveTo(-7, 12); ctx.lineTo(7, 12); ctx.stroke();
    ctx.beginPath(); ctx.arc(4, -12, 4, 0, TAU); ctx.fillStyle = '#7BA33A'; ctx.fill(); ctx.stroke();
    ctx.restore();
    F.inkShape(ctx, [[0, -62], [50, 38], [-50, 38]], { fill: P.lilac, t, seed: 77, lw: 4.5, amp: 1 });
    // eyes (squint while sipping)
    ctx.fillStyle = P.ink;
    for (const e of [-1, 1]) {
      if (sip > .3) { ctx.beginPath(); ctx.lineWidth = 3; ctx.moveTo(e * 12 - 6, -8); ctx.quadraticCurveTo(e * 12, -13, e * 12 + 6, -8); ctx.stroke(); }
      else { ctx.beginPath(); ctx.ellipse(e * 12, -9, 5, 6, 0, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 2.5; ctx.stroke(); ctx.beginPath(); ctx.arc(e * 12 + 1.5, -8, 2.6, 0, TAU); ctx.fillStyle = P.ink; ctx.fill(); }
    }
    // moustache
    ctx.beginPath(); ctx.moveTo(0, 6); ctx.bezierCurveTo(-8, -2, -20, 2, -24, 12); ctx.bezierCurveTo(-16, 8, -8, 12, 0, 8);
    ctx.bezierCurveTo(8, 12, 16, 8, 24, 12); ctx.bezierCurveTo(20, 2, 8, -2, 0, 6); ctx.fillStyle = P.ink; ctx.fill();
    ctx.beginPath(); ctx.arc(-2, 20, 4.5, 0, Math.PI); ctx.lineWidth = 2.5; ctx.strokeStyle = P.ink; ctx.stroke();
    ctx.restore();
  }
  function drawGaryCard(ctx, t, pose) {
    const c = CARD.seating, f = ease.inOutCubic(invLerp(40.0, 40.36, t));
    const lift = spring(t - 39.5, 3, .4) * (1 - f), grow = spring(t - 40.0, 2.6, .4);
    const s = 1 + .05 * lift + .3 * grow;
    const x = lerp(c.cx, 1500, grow), y = lerp(c.cy, 470, grow) - 14 * lift;
    const flip = Math.cos(f * Math.PI);
    ctx.save(); ctx.translate(x, y); ctx.rotate(-.03 * lift + jiggle(t - 40.36, 3, 5) * .04); ctx.scale(s * Math.max(.02, Math.abs(flip)), s); ctx.translate(-CW / 2, -CH / 2);
    if (flip >= 0) {
      cardShape(ctx, c, CARD_BG); ctx.fillStyle = c.acc; rr(ctx, 0, 0, 10, CH, [28, 0, 0, 28]); ctx.fill();
      cardHeader(ctx, c, t); CONTENT.seating(ctx, c, t, t - c.snap);
    } else {
      cardShape(ctx, c, '#EDE6FF');
      ctx.save(); rr(ctx, 0, 0, CW, CH, 28); ctx.clip();
      glowDot(ctx, 90, 120, 160, '255,255,255', .8);
      ctx.restore();
      drawGary(ctx, 88, 132, 1.05, t);
      txt(ctx, 'Uncle Gary', 180, 70, 30, FT.ui, 800, P.ink);
      F.font(ctx, 30, FT.ui, 800); const gw = ctx.measureText('Uncle Gary').width;
      txt(ctx, '→', 188 + gw, 70, 30, FT.ui, 800, P.coral);
      txt(ctx, 'Table 9', 178, 136, 58, FT.display, 900, P.ink);
      txt(ctx, '(next to the bar)', 182, 180, 32, FT.hand, 700, P.cobaltShade);
      // highlight swipe under "Table 9"
      const hl = ease.outCubic(invLerp(40.3, 40.6, t));
      if (hl > 0) { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = P.gold; ctx.globalAlpha = .55; rr(ctx, 172, 112, 214 * hl, 26, 8); ctx.fill(); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
      tickBadge(ctx, CW - 34, CH - 34, 20, t - 40.45);
    }
    ctx.restore();
  }

  // ─────────────────────────── characters ───────────────────────────
  function drawDotPeek(ctx, t) {
    const up = spring(t - 34.15, 2.2, .45);
    if (up <= 0) return;
    const x = 675, y = lerp(1260, 1018, up);
    const wonder = t > 36.35 && t < 38.7;
    const say = F.mouth('dot', t), talk = F.talking('dot', t);
    const look = t < 36.3 ? [.5 * Math.sin(t * 1.5), -.4] : t < 40 ? [.2, -.9] : t < 41 ? [1, -.3] : [.8, 0];
    const hop = wonder ? Math.abs(Math.sin((t - 36.4) * 6)) * 10 * Math.exp(-(t - 36.4) * 1.5) : 0;
    const laugh = t > 40.7 && t < 41.8;
    F.drawDot(ctx, {
      x, y: y - hop, t, scale: .95, seed: 11,
      mood: wonder ? 'neutral' : laugh ? 'joy' : 'happy', look, blush: wonder ? .8 : .4,
      mouth: wonder ? Math.max(.4, say) : talk ? say : laugh ? .5 + .3 * Math.sin(t * 30) : undefined,
      armL: wonder ? [-10, -70] : [-22, 40], armR: wonder ? [14, -74] : [26, 40], sy: 1 + jiggle(t - 36.4, 3, 5) * .06, sx: 1 - jiggle(t - 36.4, 3, 5) * .06,
    });
    if (wonder) { // stars in her eyes + sparkles
      const s = .95, cy = y - hop - (24 + 70) * s - 70 * .18 * s;
      for (const e of [-1, 1]) F.sparkle(ctx, x + e * 22.4 * s + 3, cy - 4, 9 + 2 * Math.sin(t * 16), '#fff', t * 3);
      for (let i = 0; i < 3; i++) { const a = t * 1.5 + i * 2.1; F.sparkle(ctx, x + Math.cos(a) * 110, y - 200 + Math.sin(a) * 40, 12 + 5 * Math.sin(t * 8 + i), P.gold, t * 2); }
    }
  }
  function drawDashPeek(ctx, t) {
    const up = spring(t - 34.4, 2.2, .45);
    if (up <= 0) return;
    const pump = spring(t - 40.5, 3, .35) - spring(t - 41.6, 2, .5);
    const x = 1248, y = lerp(1260, 1018, up) - Math.max(0, pump) * 60;
    const hug = t > 37.3 && t < 40.4;
    const talk = F.talking('dash', t);
    F.drawDash(ctx, {
      x, y, t, scale: .9, seed: 23,
      rot: hug ? -.13 + Math.sin(t * 4) * .02 : pump > .2 ? .05 : -.04,
      mood: hug ? 'joy' : pump > .2 ? 'joy' : 'happy', blush: hug ? .9 : .35,
      look: [-.7, -.4],
      mouth: talk ? undefined : pump > .2 ? .55 : undefined,
      armL: hug ? [-66, -20, 10] : [-26, 42], armR: pump > .1 ? [22, -118, -14] : hug ? [-40, 20] : [28, 42],
      sy: 1 + jiggle(t - 40.52, 3, 5) * .08, sx: 1 - jiggle(t - 40.52, 3, 5) * .08,
    });
    if (hug) for (let i = 0; i < 3; i++) {
      const ph = ((t - 37.3) * .8 + i / 3) % 1;
      ctx.save(); ctx.globalAlpha = F.pulse(ph, 0, 1); F.heart(ctx, x - 40 + Math.sin(ph * 9 + i) * 16, y - 240 - ph * 120, 26 + i * 4, P.coral, 3); ctx.restore();
    }
    if (pump > .2) { // triumph lines
      ctx.save(); ctx.strokeStyle = P.ink; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.globalAlpha = clamp(pump);
      const hx = x + 22 * .9 + 42, hy = y - (26 + 176 * .42) * .9 - 118 * .9;
      for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * .45; ctx.beginPath(); ctx.moveTo(hx + Math.cos(a) * 30, hy + Math.sin(a) * 30); ctx.lineTo(hx + Math.cos(a) * 58, hy + Math.sin(a) * 58); ctx.stroke(); }
      ctx.restore();
    }
  }

  // ─────────────────────────── SLAMS ───────────────────────────
  const SLAMS = [
    { t0: 42, word: 'PLAN IT.', bg: P.coral, fg: P.paper, acc: P.cobalt, acc2: P.gold },
    { t0: 43, word: 'SHARE IT.', bg: P.cobalt, fg: P.paper, acc: P.gold, acc2: P.coral },
    { t0: 44, word: 'SAVOUR IT.', bg: P.gold, fg: P.ink, acc: P.coral, acc2: P.cobalt },
  ];
  function slamField(ctx, sl, t) {
    const lt = t - sl.t0;
    F.paper(ctx, { tint: sl.bg });
    ctx.save();
    // rotating stripes band
    ctx.translate(960, 540); ctx.rotate(-.22 + lt * .05);
    const bx = lerp(-2600, 0, ease.outExpo(clamp(lt / .25)));
    ctx.fillStyle = sl.acc; ctx.fillRect(bx - 1400, -120, 2800, 240);
    ctx.fillStyle = sl.bg; for (let i = -14; i < 14; i++) ctx.fillRect(bx + i * 104, -120, 12, 240);
    ctx.restore();
    // expanding rings
    for (let i = 0; i < 3; i++) {
      const k = clamp((lt - i * .08) / .7); if (k <= 0) continue;
      ctx.beginPath(); ctx.arc(960, 540, 120 + ease.outCubic(k) * 900, 0, TAU); ctx.lineWidth = 26 * (1 - k); ctx.strokeStyle = sl.acc2; ctx.stroke();
    }
    // burst of geometric bits
    const r = F.rng(sl.t0 * 13), cols = [P.ink, sl.acc, sl.acc2, P.paper];
    for (let i = 0; i < 26; i++) {
      const a = r() * TAU, sp = 600 + r() * 900, drag = 3, k = (1 - Math.exp(-drag * lt)) / drag;
      const x = 960 + Math.cos(a) * (150 + sp * k), y = 540 + Math.sin(a) * (100 + sp * k * .7);
      const sz = 14 + r() * 26, sh = Math.floor(r() * 3), rot = r() * TAU + lt * (r() - .5) * 8;
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.fillStyle = cols[i % 4]; ctx.strokeStyle = cols[i % 4]; ctx.lineWidth = 7; ctx.lineCap = 'round';
      if (sh === 0) { ctx.beginPath(); ctx.arc(0, 0, sz * .5, 0, TAU); ctx.fill(); }
      else if (sh === 1) { ctx.beginPath(); ctx.moveTo(0, -sz * .6); ctx.lineTo(sz * .55, sz * .4); ctx.lineTo(-sz * .55, sz * .4); ctx.closePath(); ctx.fill(); }
      else { ctx.beginPath(); ctx.moveTo(-sz, 0); ctx.quadraticCurveTo(-sz / 2, -sz * .6, 0, 0); ctx.quadraticCurveTo(sz / 2, sz * .6, sz, 0); ctx.stroke(); }
      ctx.restore();
    }
  }
  function slamWord(ctx, sl, t, cx, cy, sc) {
    const lt = t - sl.t0;
    F.font(ctx, 100, FT.display, 900);
    const w100 = ctx.measureText(sl.word).width, size = Math.min(270, 1640 / w100 * 100);
    F.font(ctx, size, FT.display, 900);
    const chars = [...sl.word], widths = chars.map(ch => ctx.measureText(ch).width), total = widths.reduce((a, b) => a + b, 0);
    const punch = 1 + jiggle(lt - .1, 3, 6) * .05;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(sc * punch, sc * punch);
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    let x = -total / 2;
    chars.forEach((ch, i) => {
      const d = lt + .12 - i * .016, k = spring(d, 4.4, .38);
      if (d <= 0) { x += widths[i]; return; }
      ctx.save();
      // mask: letters rise out of the baseline
      ctx.beginPath(); ctx.rect(x - 30, -size * 1.1, widths[i] + 60, size * 1.35); ctx.clip();
      ctx.translate(x + widths[i] / 2, (1 - k) * size * 1.05);
      ctx.rotate((1 - k) * (F.hash(i + sl.t0) - .5) * .35);
      const st = 1 + (1 - k) * .4; ctx.scale(1 / st, st);
      ctx.fillStyle = P.ink; ctx.fillText(ch, 9, 11);
      ctx.lineWidth = 10; ctx.strokeStyle = P.ink; ctx.strokeText(ch, 0, 0);
      ctx.fillStyle = sl.fg; ctx.fillText(ch, 0, 0);
      ctx.restore();
      x += widths[i];
    });
    // underline swipe
    const ul = ease.outExpo(clamp((lt - .12) / .3));
    if (ul > 0) { ctx.fillStyle = P.ink; ctx.fillRect(-total / 2 + 8, size * .12, (total - 16) * ul, 16); ctx.fillStyle = sl.acc; ctx.fillRect(-total / 2, size * .12 - 8, (total - 16) * ul, 16); }
    ctx.restore();
    return size;
  }
  function glimpsePlan(ctx, t) {
    const d = t - 42.45, k = spring(d, 2.8, .45); if (d <= 0) return;
    ctx.save(); ctx.translate(960, lerp(1300, 760, k)); ctx.rotate((1 - k) * -.15);
    const w = 640, h = 290; ctx.translate(-w / 2, -h / 2);
    ctx.save(); ctx.shadowColor = 'rgba(40,10,10,.3)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 18; rr(ctx, 0, 0, w, h, 28); ctx.fillStyle = CARD_BG; ctx.fill(); ctx.restore();
    rr(ctx, 0, 0, w, h, 28); ctx.lineWidth = 4; ctx.strokeStyle = P.ink; ctx.stroke();
    txt(ctx, 'This week', 34, 62, 32, FT.display, 900, P.ink);
    ['Venue booked', 'Menu chosen', 'Dress fitting'].forEach((s, i) => {
      const y = 116 + i * 58, dd = d - .08 - i * .1;
      rr(ctx, 34, y - 18, 36, 36, 10); ctx.fillStyle = dd > 0 ? P.mint : '#fff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = P.ink; ctx.stroke();
      if (dd > 0) partialCheck(ctx, 52, y, 24, clamp(dd / .1), P.ink, 5);
      txt(ctx, s, 90, y + 10, 28, FT.ui, 600, dd > 0 ? '#8F877D' : P.ink);
      if (dd > 0) { F.font(ctx, 28, FT.ui, 600); ctx.fillStyle = P.coral; ctx.fillRect(88, y, (ctx.measureText(s).width + 4) * clamp(dd / .12), 4); }
    });
    ctx.restore();
  }
  function glimpseShare(ctx, t) {
    const d = t - 43.42, k = spring(d, 2.8, .45); if (d <= 0) return;
    ctx.save(); ctx.translate(960, lerp(1300, 770, k)); ctx.rotate((1 - k) * .15);
    const w = 820, h = 280; ctx.translate(-w / 2, -h / 2);
    ctx.save(); ctx.shadowColor = 'rgba(10,10,40,.35)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 18; rr(ctx, 0, 0, w, h, 28); ctx.fillStyle = CARD_BG; ctx.fill(); ctx.restore();
    rr(ctx, 0, 0, w, h, 28); ctx.lineWidth = 4; ctx.strokeStyle = P.ink; ctx.stroke();
    txt(ctx, 'Shared with family', 34, 60, 32, FT.display, 900, P.ink);
    const fam = [['Mum', P.coral, 'circle'], ['Dad', P.cobalt, 'pill'], ['Gran', P.gold, 'circle'], ['Best mate', P.mint, 'pill'], ['Uncle Gary', P.lilac, 'tri']];
    fam.forEach(([n, col, kind], i) => {
      const dd = d - .06 - i * .07, kk = spring(dd, 4, .35); if (kk <= 0) return;
      const x = 110 + i * 150, y = 150;
      ctx.save(); ctx.translate(x, y); ctx.scale(kk, kk); avatar(ctx, 0, 0, 40, col, i, kind); ctx.restore();
      ctx.globalAlpha = clamp(dd * 6); txt(ctx, n, x, 232, 30, FT.hand, 700, P.ink, 'center'); ctx.globalAlpha = 1;
      tickBadge(ctx, x + 34, y - 34, 13, dd - .12);
    });
    ctx.restore();
  }
  function savourScreen(t) {
    return (g, w, h) => {
      g.fillStyle = '#FFFBF3'; g.fillRect(0, 0, w, h);
      glowDot(g, w / 2, h * .42, 380, '255,220,140', .6);
      statusBar(g, w);
      txt(g, 'The Wedding Chapter', w / 2, 102, 22, FT.display, 600, P.ink, 'center');
      const hk = spring(t - 44.6, 3, .35), beat = 1 + .06 * Math.max(0, Math.sin((t - 44.6) * TAU * 2));
      g.save(); g.translate(w / 2, h * .42); g.scale(hk * beat, hk * beat);
      F.heart(g, 0, 0, 220, P.coral, 6);
      partialCheck(g, 0, -8, 90, clamp((t - 44.75) / .15), '#fff', 16);
      g.restore();
      g.globalAlpha = clamp((t - 44.8) * 5);
      txt(g, 'All set.', w / 2, h * .66, 48, FT.display, 900, P.ink, 'center');
      txt(g, 'Now enjoy every moment.', w / 2, h * .66 + 42, 20, FT.ui, 600, GREY, 'center');
      g.globalAlpha = 1;
      // doorway light
      const L = invLerp(45.1, 45.6, t);
      if (L > 0) {
        const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, h * .8);
        gr.addColorStop(0, `rgba(255,255,248,${L})`); gr.addColorStop(.5, `rgba(255,240,200,${L * .9})`); gr.addColorStop(1, `rgba(255,225,160,${L * .8})`);
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
      }
    };
  }

  // ─────────────────────────── main draw ───────────────────────────
  function drawTurn(ctx, t) { // 30.0 – 33.x
    const pt = invLerp(30.25, 31.15, t);
    if (t < 30.25) oldPage(ctx);
    else if (pt < 1) F.pageTurn(ctx, pt, g => freshPage(g, t), g => oldPage(g));
    else freshPage(ctx, t);
    // "Chapter Seven."
    if (t > 31.2 && t < 32.6) F.chapterCaption(ctx, 'Chapter Seven.', t - 31.2, { typeDur: .55, hold: .6, lineColor: P.gold });
    // 32.0 anthem burst
    if (t >= 31.9) {
      const k = invLerp(31.9, 32.1, t) * (1 - invLerp(32.1, 32.9, t));
      rays(ctx, t, 960, 640, invLerp(31.95, 32.2, t), '255,200,90', 18);
      if (k > 0) { ctx.save(); ctx.globalAlpha = k * .7; ctx.fillStyle = '#FFF6DC'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    }
    const b = ballState(t);
    // shadow of the lifted ball on the page
    if (t < 33.35) {
      const lifted = clamp((BALL.y - b.y) / 60);
      ctx.save(); ctx.globalAlpha = .18 * lifted * (1 - invLerp(31.3, 31.8, t)); ctx.fillStyle = P.ink;
      ctx.beginPath(); ctx.ellipse(b.x, BALL.y + BALL.r * .95, BALL.r * b.s * (1.1 - lifted * .3), 26 * b.s, 0, 0, TAU); ctx.fill(); ctx.restore();
    }
    // book / morph / phone
    if (t >= 31.85 && t < 33.0) drawBook(ctx, t);
    else if (t >= 33.0 && t < 33.4) drawMorph(ctx, t, invLerp(33.0, 33.4, t));
    else if (t >= 33.4) drawPhone(ctx, t, PH.x, PH.y, 1 + jiggle(t - 33.4, 3, 5) * .03, appScreen(t));
    // ribbon + ball
    const tipY = ribbonTip(t, b);
    drawRibbon(ctx, t, b.x, tipY);
    if (t < 33.3) {
      const tip = Math.min(1, (t - 30) / .3), sp = t < 30.45 ? 1 : .5 + .3 * Math.sin(t * 7);
      glowDot(ctx, b.x, tipY + 20, 110 * sp, '255,232,160', .9 * tip);
      F.sparkle(ctx, b.x, tipY + 22, (30 + 10 * Math.sin(t * 20)) * sp, '#FFF6D6', t * 2);
      F.sparkle(ctx, b.x + 24, tipY - 6, 12 * sp, P.gold, -t * 3);
    }
    if (t < UNSPOOL0) drawBall(ctx, t, b, t < 30.3 ? 30 : t);
    else drawUnspool(ctx, t, b);
    if (t >= 30.28 && t < 30.6) { // hook contact ping
      const k = invLerp(30.28, 30.6, t);
      ctx.save(); ctx.globalAlpha = 1 - k; ctx.strokeStyle = P.gold; ctx.lineWidth = 6 * (1 - k);
      ctx.beginPath(); ctx.arc(b.x, BALL.y - BALL.r + 20, 20 + k * 140, 0, TAU); ctx.stroke(); ctx.restore();
    }
  }
  function uiCamera(t) {
    let z = 1 + .025 * invLerp(34, 40, t), x = 960, y = 540;
    const g = ease.inOutCubic(invLerp(40.0, 40.5, t)) * (1 - ease.inOutCubic(invLerp(41.2, 41.7, t)));
    z += .06 * g; x += 180 * g; y -= 40 * g;
    const push = ease.inCubic(invLerp(41.55, 42.0, t));
    z *= 1 + push * .9; x = lerp(x, PH.x, push); y = lerp(y, PH.y, push);
    return { zoom: z, x, y };
  }
  function drawUI(ctx, t) { // 33.4 – 42.0
    freshPage(ctx, t);
    ctx.save();
    const cam = uiCamera(t), sh = F.shake(t, 3 * Math.exp(-(t - 34) * 2) * (t > 34 ? 1 : 0), 4);
    F.camera(ctx, { ...cam, dx: sh[0], dy: sh[1] });
    const bob = Math.sin(t * 2.4) * 4;
    drawGuides(ctx, t);
    drawPhone(ctx, t, PH.x, PH.y + bob, 1, appScreen(t));
    if (t < UNSPOOL1 + .05) drawUnspool(ctx, t, ballState(t));
    // anticipation squeeze before 42
    const ant = remap(t, 41.5, 41.9, 0, 1, ease.inOutQuad);
    CARDS.forEach(c => {
      if (c.id === 'seating' && t >= 39.5) return;
      const p = cardPose(c, t); if (p.ct < 0) return;
      if (ant > 0) { p.x = lerp(p.x, PH.x, ant * .15); p.y = lerp(p.y, PH.y, ant * .15); }
      drawCard(ctx, c, t, p);
    });
    drawDotPeek(ctx, t); drawDashPeek(ctx, t);
    if (t >= 39.5) drawGaryCard(ctx, t);
    // click sparkles on each snap
    CARDS.forEach(c => {
      const d = t - c.snap - .2; if (d < 0 || d > .35) return;
      const k = d / .35; ctx.save(); ctx.globalAlpha = 1 - k;
      for (let i = 0; i < 4; i++) { const a = i / 4 * TAU + .6; F.sparkle(ctx, c.cx + Math.cos(a) * (CW * .52 + k * 30), c.cy + Math.sin(a) * (CH * .6 + k * 30), 16 * (1 - k), P.gold); }
      ctx.restore();
    });
    ctx.restore();
    // coral circle wipe into PLAN IT.
    const wp = invLerp(41.9, 42.0, t);
    if (wp > 0) { ctx.save(); ctx.beginPath(); ctx.arc(960, 540, ease.inQuad(wp) * 1150, 0, TAU); ctx.clip(); slamField(ctx, SLAMS[0], 42); ctx.restore(); }
  }
  function drawSlams(ctx, t) { // 42.0 – 46.0
    const i = t < 42.95 ? 0 : t < 43.95 ? 1 : 2, sl = SLAMS[i], lt = t - sl.t0;
    const sh = F.shake(t, 14 * Math.exp(-Math.max(0, lt) * 9), 9);
    const iris = i > 0 && lt < .04;
    if (iris) { ctx.save(); drawSlams(ctx, sl.t0 - .051); ctx.restore(); } // previous slam stays under the iris
    ctx.save(); ctx.translate(sh[0], sh[1]);
    if (iris) { ctx.beginPath(); ctx.arc(960, 540, ease.outQuad(clamp((lt + .05) / .09)) * 1150 + 1, 0, TAU); ctx.clip(); }
    slamField(ctx, sl, t);
    // word: slam centre, then lift to make room for the UI glimpse
    const up = ease.inOutCubic(invLerp(.42, .62, lt));
    let wy = lerp(640, 300, up), sc = lerp(1, .62, up);
    if (i === 2) { const up2 = ease.inOutCubic(invLerp(.42, .7, lt)); wy = lerp(640, 200, up2); sc = lerp(1, .5, up2); }
    const fade = i === 2 ? 1 - invLerp(45.2, 45.5, t) : 1;
    if (fade > 0) { ctx.save(); ctx.globalAlpha = fade; slamWord(ctx, sl, t, 960, wy, sc); ctx.restore(); }
    if (i === 0) glimpsePlan(ctx, t);
    if (i === 1) glimpseShare(ctx, t);
    ctx.restore();
    if (i === 2) drawSavour(ctx, t);
  }
  function drawSavour(ctx, t) {
    const d = t - 44.45; if (d <= 0) return;
    if (t >= 45.8) { drawFlash(ctx, t); return; }
    const k = spring(d, 2.4, .5), s = .74;
    const cy0 = lerp(1600, 650, k);
    const zp = invLerp(45.45, 45.78, t), z = Math.exp(Math.log(18) * ease.inQuad(zp));
    ctx.save();
    // zoom about the screen centre
    ctx.translate(960, cy0); ctx.scale(z, z); ctx.translate(-960, -cy0);
    if (d < .6) { // little heart pop-outs around the phone
      for (let i = 0; i < 6; i++) { const a = i / 6 * TAU - Math.PI / 2, rr0 = 330 + ease.outCubic(clamp(d / .5)) * 60; ctx.save(); ctx.globalAlpha = 1 - clamp(d / .6); F.heart(ctx, 960 + Math.cos(a) * rr0, cy0 + Math.sin(a) * rr0 * .9, 36, P.coral, 3); ctx.restore(); }
    }
    ctx.translate(960, cy0); ctx.rotate((1 - k) * .2); ctx.translate(-960, -cy0);
    drawPhone(ctx, t, 960, cy0, s, savourScreen(t));
    ctx.restore();
    rays(ctx, t, 960, 650, invLerp(45.1, 45.5, t), '255,250,230', 16);
    drawFlash(ctx, t);
  }
  // white-gold flash → settles onto a fresh cream page for D
  function drawFlash(ctx, t) {
    const fl = invLerp(45.66, 45.8, t);
    if (fl > 0) {
      const settle = invLerp(45.8, 46.0, t);
      if (settle > 0) F.paper(ctx);
      ctx.save();
      const a = fl * (1 - settle * .75);
      const g = ctx.createRadialGradient(960, 540, 0, 960, 540, 1150);
      g.addColorStop(0, `rgba(255,255,250,${a})`); g.addColorStop(.6, `rgba(255,246,222,${a})`); g.addColorStop(1, `rgba(255,232,180,${a * (settle > 0 ? .4 : 1)})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
    }
  }

  F.addScene({
    name: 'c_order', start: 30.0, end: 46.0,
    draw(ctx, t) {
      ctx.save();
      if (t < 33.4) drawTurn(ctx, t);
      else if (t < 42.0) drawUI(ctx, t);
      else drawSlams(ctx, t);
      ctx.restore();
    },
    subtitle(t) { return t > 33.5 && t < 42 ? { x: 960, y: 1040 } : null; },
  });
  window.C_ORDER = { _p: { rays, freshPage, oldPage, drawBall, ballState, drawPhone, appScreen, drawCard, CARDS, drawDotPeek, drawDashPeek, glowDot, drawGuides },  drawBall: (ctx, t) => drawBall(ctx, t, { x: BALL.x, y: BALL.y, s: 1, rot: 0 }, t), BALL };
})();
