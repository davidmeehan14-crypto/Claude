/* Scene A — ACT 1 MEET (0–6 s) + ACT 2 MONTAGE (6–14 s).
 * Pure function of t. All helpers are namespaced inside this IIFE.
 */
(function () {
  const F = FILM, P = F.PAL, W = F.W, H = F.H, TAU = F.TAU;
  const { clamp, lerp, remap, ease, spring, jiggle, invLerp, hash } = F;

  // ───────────────────────── timing helpers ─────────────────────────
  /** Dialogue line nearest to a target start (falls back to the SPEC target). */
  function L(speaker, target, dur) {
    const ls = F.lines().filter(l => l.speaker === speaker && Math.abs(l.start - target) < 0.9);
    if (ls.length) {
      ls.sort((a, b) => Math.abs(a.start - target) - Math.abs(b.start - target));
      return { s: ls[0].start, e: ls[0].end, real: true };
    }
    return { s: target, e: target + dur, real: false };
  }
  /** Mouth for a line: undefined → engine lip-sync; fallback flap when no voice data. */
  function mouthOf(line, t) {
    if (line.real) return undefined;
    if (t < line.s || t > line.e) return 0;
    const u = (t - line.s) / (line.e - line.s);
    return clamp((.25 + .75 * Math.abs(Math.sin((t - line.s) * TAU * 2.7))) * Math.sin(Math.PI * u) * 1.25);
  }
  /** Keyframe interpolation. keys: [[t, value(number|array)], ...]; e: easing between keys. */
  function kf(t, keys, e = ease.inOutSine) {
    if (t <= keys[0][0]) return keys[0][1];
    for (let i = 1; i < keys.length; i++) {
      if (t < keys[i][0]) {
        const [t0, a] = keys[i - 1], [t1, b] = keys[i], p = e((t - t0) / (t1 - t0));
        return Array.isArray(a) ? a.map((v, j) => lerp(v, b[j], p)) : lerp(a, b, p);
      }
    }
    return keys[keys.length - 1][1];
  }
  /** Landing squash: returns [sx, sy] for a landing dt seconds ago with strength amt. */
  function squash(dt, amt, freq = 2.8, decay = 9) {
    if (dt < 0 || amt <= 0) return [1, 1];
    const k = amt * Math.exp(-decay * dt) * Math.cos(TAU * freq * dt);
    return [1 + k * .85, 1 - k];
  }
  /** Parabolic hops. segs: [[t0, t1, h]]; returns {h, land (last landing time), amt, vy}. */
  function hops(t, segs) {
    for (let i = 0; i < segs.length; i++) {
      const [t0, t1, h] = segs[i];
      if (t >= t0 && t < t1) { const u = (t - t0) / (t1 - t0); return { h: 4 * h * u * (1 - u), air: true, v: (1 - 2 * u), i }; }
    }
    return { h: 0, air: false, v: 0 };
  }

  // ───────────────────────── drawing helpers ─────────────────────────
  /** Offscreen sprite built once (gradients etc. are slow on the software renderer). */
  const _built = new Set();
  function sprite(key, w, h, build) {
    const c = F.offscreen('a_' + key, w, h);
    if (!_built.has(key)) { const g = c.getContext('2d'); g.clearRect(0, 0, w, h); build(g); _built.add(key); }
    return c;
  }
  function radial(key, r, rgb, a0, r0 = 0) {
    return sprite(key, r * 2, r * 2, g => { const gr = g.createRadialGradient(r, r, r0, r, r, r); gr.addColorStop(0, `rgba(${rgb},${a0})`); gr.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2); });
  }
  function vignetteC(ctx) {
    const c = sprite('vig', W, H, g => F.vignette(g, .24));
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(c, 0, 0); ctx.restore();
  }
  /** Replicates the engine's character transform so we can draw costume overlays in local space. */
  function withChar(ctx, s, fn) {
    ctx.save(); ctx.translate(s.x || 0, s.y || 0); if (s.rot) ctx.rotate(s.rot);
    const sc = s.scale == null ? 1 : s.scale; ctx.scale(sc * (s.sx || 1), sc * (s.sy || 1));
    if (s.alpha != null) ctx.globalAlpha *= s.alpha;
    if (s.kneel) ctx.translate(0, 22 * s.kneel);
    fn(ctx); ctx.restore();
  }
  /** Rotate a character about its body centre (tumbles). hc = centre height above feet. */
  function spun(ctx, drawFn, s, ang, hc) {
    ctx.save(); ctx.translate(s.x, s.y - hc); ctx.rotate(ang);
    const s2 = Object.assign({}, s, { x: 0, y: hc }); drawFn(ctx, s2); ctx.restore();
  }
  function dot(ctx, s, extra) { F.drawDot(ctx, s); if (extra) withChar(ctx, s, extra); }
  function dash(ctx, s, extra) { F.drawDash(ctx, s); if (extra) withChar(ctx, s, extra); }

  function starburst(ctx, x, y, r1, r2, n, rot, fill, lw = 6, seed = 1) {
    ctx.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const a = rot + i * Math.PI / n, r = i % 2 ? r2 : r1 * (.8 + .4 * hash(i * 3.1 + seed));
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
    if (lw) { ctx.lineWidth = lw; ctx.strokeStyle = P.ink; ctx.lineJoin = 'round'; ctx.stroke(); }
  }
  /** Ink cloud: stroke fat circles, then fill → single outer outline. */
  function cloud(ctx, x, y, s, t, seed, fill = '#FFFDF7') {
    const bl = [[-60, 10, 42], [-18, -18, 55], [34, -4, 46], [70, 16, 32], [0, 18, 40]];
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
    const shapes = bl.map((b, i) => F.wobble(F.circlePts(b[0], b[1], b[2], 18), t, seed + i, 1.2));
    for (const p of shapes) { F.smoothClosed(ctx, p); ctx.lineWidth = 10 / s; ctx.strokeStyle = P.ink; ctx.stroke(); }
    ctx.fillStyle = fill; for (const p of shapes) { F.smoothClosed(ctx, p); ctx.fill(); }
    ctx.restore();
  }
  function grassTuft(ctx, x, y, t, seed, col = P.ink) {
    F.inkLine(ctx, [[x - 10, y], [x - 14, y - 16]], { t, seed, lw: 4, stroke: col });
    F.inkLine(ctx, [[x, y], [x + 1, y - 22]], { t, seed: seed + 1, lw: 4, stroke: col });
    F.inkLine(ctx, [[x + 10, y], [x + 15, y - 14]], { t, seed: seed + 2, lw: 4, stroke: col });
  }
  function groundLine(ctx, t, y, fill, seed = 3, lw = 6) {
    const pts = []; for (let x = -60; x <= W + 60; x += 120) pts.push([x, y + Math.sin(x * .004 + seed) * 3]);
    ctx.save();
    ctx.beginPath(); ctx.moveTo(-60, y); pts.forEach(p => ctx.lineTo(p[0], p[1])); ctx.lineTo(W + 60, H + 20); ctx.lineTo(-60, H + 20); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill();
    F.inkLine(ctx, pts, { t, seed, lw, amp: 1.2 });
    ctx.restore();
  }
  function pageNumber(ctx, n, alpha = 1) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = .55 * alpha;
    F.font(ctx, 30, F.FONT.display, 400, 'italic'); ctx.fillStyle = P.ink; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('— ' + n + ' —', W - 70, H - 46); ctx.restore();
  }
  /** Book gutter: soft shade on the left edge so every frame reads as a page. */
  function gutter(ctx) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 90, 0);
    g.addColorStop(0, 'rgba(90,60,30,.22)'); g.addColorStop(1, 'rgba(90,60,30,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 90, H); ctx.restore();
  }
  function shadow(ctx, x, y, rx, a = .18) {
    ctx.save(); ctx.fillStyle = `rgba(22,22,29,${a})`; ctx.beginPath(); ctx.ellipse(x, y, rx, rx * .16, 0, 0, TAU); ctx.fill(); ctx.restore();
  }
  function speedLines(ctx, x, y0, y1, dir, n, len, t, seed, alpha = 1) {
    ctx.save(); ctx.globalAlpha *= alpha;
    for (let i = 0; i < n; i++) {
      const yy = lerp(y0, y1, (i + .5) / n) + (hash(seed + i) - .5) * 20;
      const l = len * (.45 + .55 * hash(seed + i * 7.7)), off = 30 + hash(seed + i * 3.3) * 50;
      F.inkLine(ctx, [[x + dir * off, yy], [x + dir * (off + l * .5), yy], [x + dir * (off + l), yy]], { t, seed: seed + i, lw: 3 + hash(i + seed) * 4 });
    }
    ctx.restore();
  }
  function textPop(ctx, str, x, y, size, k, rot, fill, stroke = P.ink, family = F.FONT.display, weight = 900) {
    if (k <= 0) return;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(k, k);
    F.font(ctx, size, family, weight); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.lineWidth = size * .16; ctx.strokeStyle = stroke; ctx.strokeText(str, 0, 0);
    ctx.fillStyle = fill; ctx.fillText(str, 0, 0); ctx.restore();
  }
  // costume pieces (char-local coords) ------------------------------------------------
  function scarf(ctx, t, who, col = P.mint) {
    const y = who === 'dot' ? -50 : -100, hw = who === 'dot' ? 62 : 52, sag = who === 'dot' ? 14 : 10;
    const band = [[-hw, y - 6], [0, y + sag], [hw, y - 6]];
    ctx.save();
    F.inkLine(ctx, band, { t, seed: 70, lw: 28, amp: .6 });
    F.inkLine(ctx, band, { t, seed: 70, lw: 19, stroke: col, amp: .6 });
    // tail
    const tx = who === 'dot' ? 26 : 22;
    const tail = F.roundRectPts(tx - 11, y + 2, 22, who === 'dot' ? 48 : 58, 6, 20).map(p => [p[0] + (p[1] - y) * .25, p[1]]);
    F.inkShape(ctx, tail, { fill: col, t, seed: 71, lw: 4, amp: .7 });
    ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 4;
    for (const k of [.35, .6]) { const yy = y + 4 + k * (who === 'dot' ? 48 : 58); ctx.beginPath(); ctx.moveTo(tx - 9 + (yy - y) * .25, yy); ctx.lineTo(tx + 9 + (yy - y) * .25, yy); ctx.stroke(); }
    ctx.restore();
  }
  function bowtie(ctx, t) {
    const y = -98;
    F.inkShape(ctx, [[0, y], [-30, y - 17], [-32, y + 15]], { fill: P.coral, t, seed: 80, lw: 4, amp: .6 });
    F.inkShape(ctx, [[0, y], [30, y - 17], [32, y + 15]], { fill: P.coral, t, seed: 81, lw: 4, amp: .6 });
    F.inkShape(ctx, F.circlePts(0, y, 8, 10), { fill: P.coralShade, t, seed: 82, lw: 4, amp: .4 });
  }
  function bandana(ctx, t) {
    const cy = -94, R = 74, pts = [];
    for (let a = -Math.PI * .92; a <= -Math.PI * .08 + 1e-6; a += Math.PI * .84 / 14) pts.push([Math.cos(a) * R, cy + Math.sin(a) * R]);
    pts.push([52, cy - 30], [0, cy - 44], [-52, cy - 30]);
    F.inkShape(ctx, pts, { fill: P.gold, t, seed: 84, lw: 4.5, amp: .8 });
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    for (const d of [[-30, -60], [0, -70], [30, -60], [-14, -50], [16, -48], [-44, -46], [44, -46]]) { ctx.beginPath(); ctx.arc(d[0], cy + d[1] + 2, 4.5, 0, TAU); ctx.fill(); }
    // knot + tails on the right
    F.inkShape(ctx, [[66, cy - 30], [96, cy - 44], [92, cy - 20]], { fill: P.gold, t, seed: 85, lw: 4, amp: .6 });
    F.inkShape(ctx, [[66, cy - 26], [92, cy - 6], [72, cy - 2]], { fill: P.goldShade, t, seed: 86, lw: 4, amp: .6 });
  }
  function flower(ctx, t, x, y, s = 1, col = P.blush) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(Math.sin(t * 2) * .1);
    for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; F.inkShape(ctx, F.ellipsePts(Math.cos(a) * 13, Math.sin(a) * 13, 11, 11, 10), { fill: col, t, seed: 90 + i, lw: 3.5, amp: .5 }); }
    F.inkShape(ctx, F.circlePts(0, 0, 8, 10), { fill: P.gold, t, seed: 96, lw: 3.5, amp: .4 });
    ctx.restore();
  }
  /** Dizzy spiral eyes on Dot (drawn over closed-eye Dot). */
  function spiralEyes(ctx, t) {
    for (const side of [-1, 1]) {
      const cx = side * 22.4, cy = -94 - 12.6;
      ctx.beginPath(); ctx.ellipse(cx, cy, 15, 17.5, 0, 0, TAU); ctx.fillStyle = '#fff'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = P.ink; ctx.stroke();
      ctx.beginPath();
      for (let a = 0; a < TAU * 2.4; a += .25) { const r = a * 1.0, aa = a * side + t * 14 * side; ctx.lineTo(cx + Math.cos(aa) * r, cy + Math.sin(aa) * r * 1.1); }
      ctx.lineWidth = 2.6; ctx.stroke();
    }
  }

  // ═════════════════════════ ACT 1 — MEET ═════════════════════════
  const GY = 760;
  function meetBackground(ctx, t) {
    F.paper(ctx);
    // soft rolling hills
    ctx.save();
    ctx.beginPath(); ctx.moveTo(-40, GY);
    for (let x = -40; x <= W + 40; x += 40) ctx.lineTo(x, GY - 70 - Math.sin(x * .0042 + .8) * 55 - Math.sin(x * .011) * 12);
    ctx.lineTo(W + 40, GY); ctx.closePath(); ctx.fillStyle = 'rgba(234,223,203,.9)'; ctx.fill();
    ctx.restore();
    const hill = []; for (let x = -40; x <= W + 40; x += 80) hill.push([x, GY - 70 - Math.sin(x * .0042 + .8) * 55 - Math.sin(x * .011) * 12]);
    F.inkLine(ctx, hill, { t, seed: 5, lw: 3, stroke: 'rgba(22,22,29,.35)' });
    // doodle sun
    ctx.save(); ctx.globalAlpha = .9;
    F.inkShape(ctx, F.circlePts(1560, 250, 62, 22), { fill: P.gold, t, seed: 6, lw: 5 });
    for (let i = 0; i < 10; i++) { const a = i / 10 * TAU + t * .15; F.inkLine(ctx, [[1560 + Math.cos(a) * 84, 250 + Math.sin(a) * 84], [1560 + Math.cos(a) * 108, 250 + Math.sin(a) * 108]], { t, seed: 8 + i, lw: 4.5 }); }
    ctx.restore();
    cloud(ctx, 640 + t * 9, 250, .8, t, 20);
    cloud(ctx, 1180 - t * 6, 150, .65, t, 30);
    groundLine(ctx, t, GY, 'rgba(234,223,203,.55)', 3);
    for (const [x, s] of [[210, 1], [470, 2], [1340, 3], [1620, 4], [1790, 5], [120, 6]]) grassTuft(ctx, x, GY + 2 + (s % 2) * 60, t, s * 10);
    pageNumber(ctx, 1);
  }

  function actMeet(ctx, t) {
    // ── black open: heartbeat → heart-shaped iris
    const env = (t0) => { const d = t - t0; return d < 0 ? 0 : Math.min(1, d / .035) * Math.exp(-d * 7); };
    const beat = env(.25) + env(.60) * 1.15;
    const irisU = invLerp(.86, 1.3, t);
    const cx0 = 960, cy0 = 540;
    if (t < .86) {
      ctx.fillStyle = '#0b0a0e'; ctx.fillRect(0, 0, W, H);
      if (beat > .01) { ctx.save(); ctx.globalAlpha = clamp(beat); ctx.drawImage(radial('hb', 700, '255,45,85', .32), cx0 - 700, cy0 - 700); ctx.restore(); }
      for (const t0 of [.25, .60]) {
        const d = t - t0; if (d < 0 || d > .6) continue;
        const r = 70 + d * 1300, a = (1 - d / .6);
        F.inkShape(ctx, F.circlePts(cx0, cy0, r, 40), { t, seed: 40 + t0 * 10, lw: 8 * a + 1, stroke: `rgba(255,90,78,${.55 * a})`, amp: 3 });
      }
      const vis = invLerp(.22, .26, t);
      if (vis > 0) {
        const antic = remap(t, .74, .86, 0, 1, ease.inOutSine);
        const size = (80 + 30 * env(.25) + 42 * env(.60)) * (1 - .25 * antic);
        ctx.save(); ctx.globalAlpha = vis;
        F.heart(ctx, cx0, cy0 + size * .08, size, P.red, 0);
        ctx.restore();
      }
      return;
    }

    // ── paper world
    const oh = L('dash', 3.55, .8), hi = L('dot', 4.55, .7);
    const shk = t >= 3.2 ? 13 * Math.exp(-(t - 3.2) * 7) : 0;
    const [sxo, syo] = F.shake(t, shk, 4, 30);
    const zoom = kf(t, [[0, 1.18], [3.9, 1.18], [5.5, 1.5], [6, 1.53]]);
    const impactFrame = t >= 3.2 && t < 3.2 + 1 / 30;
    ctx.save();
    F.camera(ctx, { zoom, x: 955, y: kf(t, [[3.9, 610], [5.5, 590]]), dx: sxo, dy: syo });
    if (impactFrame) { ctx.fillStyle = P.ink; ctx.fillRect(-100, -100, W + 200, H + 200); starburst(ctx, 818, GY - 110, 700, 220, 14, .2, P.gold, 0, 3); starburst(ctx, 818, GY - 110, 380, 120, 10, .5, P.red, 0, 4); }
    else meetBackground(ctx, t);

    // ── Dot
    const dotS = { t, seed: 11, x: 760, y: GY, look: [0, 0], mood: 'neutral', armL: [-30, 46], armR: [30, 46] };
    let dotAng = 0, dotDizzy = false;
    if (t < 1.0) dotS.y = -400;
    else if (t < 1.30) { // fall with stretch
      const u = (t - 1.0) / .30;
      dotS.y = lerp(150, GY, ease.inQuad(u));
      dotS.sy = 1 + .5 * u; dotS.sx = 1 - .22 * u;
      dotS.mood = 'shock'; dotS.armL = [-40, -72]; dotS.armR = [44, -66]; dotS.look = [0, -1];
    } else if (t < 3.2) {
      const hp = hops(t, [[1.30, 1.58, 100], [1.58, 1.77, 38], [1.77, 1.87, 11]]);
      dotS.y = GY - hp.h;
      const lands = [[1.30, .42], [1.58, .26], [1.77, .14], [1.87, .08]];
      let lk = lands[0]; for (const l of lands) if (t >= l[0]) lk = l;
      const [qx, qy] = squash(t - lk[0], lk[1], 3.2, 11);
      const st = hp.air ? 1 + .12 * Math.abs(hp.v) * (lk[1] * 3) : 1;
      dotS.sx = qx / Math.sqrt(st); dotS.sy = qy * st;
      if (t < 1.36) dotS.mood = 'closed';
      else if (t < 1.92) { dotS.mood = 'joy'; dotS.armL = [-50, -30 + 20 * Math.sin(t * 20)]; dotS.armR = [50, -30 - 20 * Math.sin(t * 20)]; }
      else {
        dotS.mood = t > 2.9 ? 'shock' : 'neutral';
        dotS.look = kf(t, [[1.95, [0, 0]], [2.02, [-.95, -.1]], [2.22, [-.95, -.1]], [2.3, [.95, -.25]], [2.45, [.95, -.25]], [2.52, [.1, -.95]], [2.62, [.1, -.95]], [2.7, [1, 0]]], ease.outCubic);
        dotS.face = kf(t, [[1.95, 0], [2.02, -.4], [2.22, -.4], [2.3, .4], [2.45, .4], [2.52, 0], [2.62, 0], [2.7, .5]], ease.outCubic);
        dotS.rot = kf(t, [[2.45, 0], [2.55, -.1], [2.62, -.1], [2.7, .06], [2.95, .06], [3.05, -.1]], ease.outCubic);
        if (t > 2.18 && t < 2.28) dotS.blink = Math.sin((t - 2.18) / .1 * Math.PI); else dotS.blink = 0;
        dotS.sy = (dotS.sy || 1) * (1 + .015 * Math.sin(t * TAU * .9));
        if (t > 2.9) { const k = ease.outBack(invLerp(2.9, 3.0, t)); dotS.armL = [lerp(-30, -46, k), lerp(46, -62, k)]; dotS.armR = [lerp(30, 50, k), lerp(46, -58, k)]; dotS.sy *= 1 + .08 * k; dotS.sx = (dotS.sx || 1) * (1 - .05 * k); }
      }
    } else if (t < 3.55) { // knocked: tumbling arc to the left
      const u = (t - 3.2) / .35;
      dotS.x = lerp(760, 680, ease.outQuad(u)); dotS.y = GY - 95 * Math.sin(Math.PI * u);
      dotAng = -TAU * ease.outQuad(u); dotS.mood = 'shock'; dotS.armL = [-56, -40]; dotS.armR = [56, -46];
    } else if (t < 3.97) { // dizzy stumble back to the right
      const hp = hops(t, [[3.62, 3.79, 26], [3.80, 3.97, 20]]);
      dotS.x = kf(t, [[3.62, 680], [3.79, 750], [3.8, 750], [3.97, 820]], ease.inOutSine);
      dotS.y = GY - hp.h;
      const lk = t < 3.79 ? [3.55, .35] : [3.79, .16];
      const [qx, qy] = squash(t - lk[0], lk[1], 3, 9); dotS.sx = qx; dotS.sy = qy;
      dotS.rot = .22 * Math.sin((t - 3.55) * 13); dotDizzy = true;
    } else {
      dotS.x = 820;
      const [qx, qy] = squash(t - 3.97, .12, 3, 9); dotS.sx = qx; dotS.sy = qy;
      const freeze = t >= 5.45;
      if (t < 4.28) { dotDizzy = true; dotS.rot = .14 * Math.sin((t - 3.55) * 13) * (1 - invLerp(4.0, 4.28, t)); }
      else if (t < hi.s) { // shakes it off, looks up at him
        dotS.face = .45 + .35 * Math.sin((t - 4.28) * 40) * (1 - invLerp(4.28, 4.42, t));
        dotS.look = [.8, -.45]; dotS.blink = t > 4.44 && t < 4.52 ? 1 : 0;
      } else { // "…Hi."
        const k = invLerp(hi.s, hi.s + .7, t);
        dotS.mood = 'shy'; dotS.face = .35; dotS.look = kf(t, [[hi.s, [.7, -.2]], [hi.s + .25, [.4, .35]], [5.05, [.4, .35]], [5.2, [.85, -.4]]], ease.outCubic);
        dotS.blush = lerp(.2, 1, ease.outCubic(invLerp(hi.s, 5.3, t)));
        dotS.rot = freeze ? .04 : .05 * Math.sin((t - hi.s) * 5.5) * k;
        dotS.armL = [-18, 40]; dotS.armR = [18, 44];
        if (freeze) { dotS.mood = 'neutral'; dotS.look = [.9, -.45]; dotS.blink = 0; dotS.blush = 1; }
        if (t > 5.4) { const pk = spring(t - 5.4, 4, .35); dotS.sy = (dotS.sy || 1) * (1 + .06 * pk - .06); }
      }
      dotS.mouth = mouthOf(hi, t);
      if (dotS.blink == null && freeze) dotS.blink = 0;
    }
    // ink splash on landing
    if (t >= 1.3 && t < 2.0 && !impactFrame) {
      const d = t - 1.3, p = invLerp(0, .4, d);
      ctx.save(); ctx.globalAlpha = 1 - p;
      ctx.beginPath(); ctx.ellipse(760, GY + 2, 70 + 250 * ease.outCubic(p), (70 + 250 * ease.outCubic(p)) * .16, 0, 0, TAU);
      ctx.lineWidth = 9 * (1 - p) + 1; ctx.strokeStyle = P.ink; ctx.stroke();
      ctx.restore();
      for (let i = 0; i < 9; i++) {
        const dir = i % 2 ? 1 : -1, vx = dir * (180 + hash(i) * 380), vy = -(320 + hash(i + 9) * 420), dd = Math.min(d, .5);
        const x = 760 + dir * 50 + vx * dd, y = GY - 4 + vy * dd + 1900 * dd * dd;
        if (y > GY + 4 || d > .5) continue;
        ctx.beginPath(); ctx.arc(x, y, 3 + 6 * hash(i + 3) * (1 - d * 1.6), 0, TAU); ctx.fillStyle = P.ink; ctx.fill();
      }
    }
    // fall speed lines
    if (t >= 1.0 && t < 1.34) {
      const a = 1 - invLerp(1.26, 1.34, t);
      for (let i = 0; i < 4; i++) {
        const x = dotS.x - 45 + i * 30, top = dotS.y - 190 * (dotS.sy || 1);
        F.inkLine(ctx, [[x, top - 30 - hash(i) * 40], [x, top - 150 - hash(i + 4) * 160]], { t, seed: i, lw: 4, stroke: `rgba(22,22,29,${.8 * a})` });
      }
    }

    // ── Dash
    const dashS = { t, seed: 23, x: 2300, y: GY, face: -.5, look: [-.8, 0], mood: 'neutral' };
    let dashAng = 0, dashGhost = false;
    if (t >= 2.6 && t < 3.2) {
      const u = (t - 2.6) / .6;
      dashS.x = lerp(2150, 876, u); dashS.rot = -.24; dashS.walk = t * 6; dashS.sx = 1.22; dashS.sy = .9;
      dashS.armL = [-60, 10]; dashS.armR = [62, 30];
      if (t < 3.03) { dashS.face = .6; dashS.look = [1, -.3]; dashS.mood = 'happy'; dashS.mouth = .15; }
      else { dashS.face = -.7; dashS.look = [-1, 0]; dashS.mood = 'shock'; dashS.armL = [-50, -60]; dashS.armR = [50, -70]; }
      dashGhost = true;
    } else if (t >= 3.2 && t < 3.5) {
      const u = (t - 3.2) / .3;
      dashS.x = lerp(876, 1160, ease.outQuad(u)); dashS.y = GY - 110 * Math.sin(Math.PI * u);
      dashAng = TAU * ease.outQuad(u); dashS.mood = 'shock'; dashS.armL = [-60, -50]; dashS.armR = [60, -60];
    } else if (t >= 3.5) {
      dashS.x = kf(t, [[3.86, 1160], [4.12, 1100]], ease.inOutSine);
      if (t > 3.86 && t < 4.12) dashS.walk = (t - 3.86) * 3.8;
      const [qx, qy] = squash(t - 3.5, .32, 3, 8); dashS.sx = qx; dashS.sy = qy;
      dashS.rot = .32 * jiggle(t - 3.5, 1.9, 3.2);
      const freeze = t >= 5.45;
      if (t < oh.s) { dashS.mood = 'closed'; }
      else if (t < oh.s + .3) { dashS.mood = 'shock'; const k = spring(t - oh.s, 5, .3); dashS.sy *= 1 + .08 * k - .08 * (k > 0 ? 1 : 0) + .08; dashS.armL = [-48, -40]; dashS.armR = [48, -44]; }
      else {
        dashS.mood = 'worried'; dashS.blush = .35;
        const scratchOn = invLerp(oh.s + .3, oh.s + .45, t) * (1 - invLerp(hi.s + .25, hi.s + .5, t));
        const sc = Math.sin(t * TAU * 5) * 7 * scratchOn;
        dashS.armR = [lerp(30, -2, scratchOn) + sc, lerp(46, -74, scratchOn)];
        dashS.armL = [-28, 46];
        dashS.look = [-.8, .25];
        if (t > hi.s) { // reacts to "Hi"
          dashS.mood = t > hi.s + .3 ? 'happy' : 'neutral';
          dashS.look = [-.9, -.05];
          dashS.blush = lerp(.35, 1, ease.outCubic(invLerp(hi.s + .2, 5.3, t)));
          const b = spring(t - (hi.s + .35), 4, .3); dashS.sy *= 1 + .05 * (1 - b) * (t > hi.s + .35 ? 1 : 0);
        }
        if (freeze) { dashS.mood = 'neutral'; dashS.look = [-.95, -.1]; dashS.blink = 0; dashS.rot = 0; }
      }
      dashS.mouth = mouthOf(oh, t);
      if (t < oh.s + .3 && t >= oh.s && dashS.mouth === 0) dashS.mouth = undefined;
    }
    // speed trail + ghosts
    if (t >= 2.6 && t < 3.45 && !impactFrame) {
      const head = t < 3.2 ? lerp(2150, 876, (t - 2.6) / .6) : 876;
      const tail = lerp(2100, 900, ease.inQuad(invLerp(2.75, 3.45, t)));
      if (tail > head + 60) {
        const y0 = GY - 120;
        F.inkLine(ctx, [[head + 60, y0], [(head + tail) / 2, y0 + 6], [tail, y0 - 4]], { t, seed: 50, lw: 10 });
        F.inkLine(ctx, [[head + 90, y0 - 60], [lerp(head, tail, .6), y0 - 58]], { t, seed: 51, lw: 5 });
        F.inkLine(ctx, [[head + 80, y0 + 60], [lerp(head, tail, .75), y0 + 62]], { t, seed: 52, lw: 5 });
      }
    }
    if (dashGhost) {
      for (let g = 3; g >= 1; g--) F.drawDash(ctx, Object.assign({}, dashS, { x: dashS.x + g * 70, alpha: .09 * (4 - g), mood: dashS.mood }));
      speedLines(ctx, dashS.x + 20, GY - 200, GY - 30, 1, 5, 260, t, 60);
    }

    // shadows
    if (t >= 1.0 && !impactFrame) {
      shadow(ctx, dotS.x, GY + 4, 70 * clamp(1 - (GY - dotS.y) / 900) * (dotS.sx || 1), .16);
      if (dashS.x < 2000) shadow(ctx, dashS.x, GY + 4, 55 * clamp(1 - (GY - dashS.y) / 700), .16);
    }
    // characters
    const inv = impactFrame ? { fill: P.paper, shade: P.paper } : {};
    const dotFinal = Object.assign({}, dotS, inv), dashFinal = Object.assign({}, dashS, inv);
    if (t >= 1.0) {
      if (dotAng) spun(ctx, F.drawDot, dotFinal, dotAng, 94);
      else dot(ctx, dotFinal, dotDizzy ? (g) => spiralEyes(g, t) : null);
    }
    if (dashAng) spun(ctx, F.drawDash, dashFinal, dashAng, 114);
    else if (dashS.x < 2200) F.drawDash(ctx, dashFinal);

    // impact graphics
    if (t >= 3.2 && t < 3.6) {
      const d = t - 3.2, cx = 818, cy = GY - 110;
      if (impactFrame) {

      } else {
        const k = 1 - invLerp(0, .3, d);
        if (k > 0) {
          starburst(ctx, cx, cy - 20, 170 * (0.6 + .4 * k) + 40, 60, 11, d * 3, P.gold, 6, 5);
          starburst(ctx, cx, cy - 20, 80 * k + 20, 30, 8, -d * 4, P.white, 4, 6);
          for (let i = 0; i < 12; i++) {
            const a = i / 12 * TAU + .2, r0 = 200 + d * 900, r1 = r0 + 120 * k;
            F.inkLine(ctx, [[cx + Math.cos(a) * r0, cy + Math.sin(a) * r0], [cx + Math.cos(a) * r1, cy + Math.sin(a) * r1]], { t, seed: 90 + i, lw: 7 * k + 1 });
          }
        }
        textPop(ctx, 'BOOP!', cx + 40, cy - 250, 120, spring(d - .02, 3.5, .35) * (1 - invLerp(.3, .4, d)), -.12, P.coral);
      }
    }
    // dizzy orbit
    if (t > 3.4 && t < 4.35) {
      const a = 1 - invLerp(4.15, 4.35, t);
      for (let i = 0; i < 3; i++) {
        const ang = t * 7 + i * TAU / 3, x = dotS.x + Math.cos(ang) * 75, y = dotS.y - 200 + Math.sin(ang) * 16;
        ctx.save(); ctx.globalAlpha = a; F.sparkle(ctx, x, y, 17, i === 1 ? P.blush : P.gold, ang); ctx.restore();
      }
    }
    // heart pop between them at 5.40
    if (t >= 5.4) {
      const d = t - 5.4, k = spring(d, 3.2, .3), hx = 960, hy = GY - 300 - d * 30;
      ctx.save();
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * TAU, p = invLerp(0, .3, d), r0 = 40 + 90 * ease.outCubic(p);
        if (p < 1) F.inkLine(ctx, [[hx + Math.cos(a) * r0, hy + Math.sin(a) * r0], [hx + Math.cos(a) * (r0 + 30 * (1 - p)), hy + Math.sin(a) * (r0 + 30 * (1 - p))]], { t, seed: 120 + i, lw: 5 });
      }
      const beatK = 1 + .08 * Math.max(0, Math.sin((d) * TAU * 2));
      F.heart(ctx, hx, hy, 70 * k * beatK, P.red, 5);
      ctx.beginPath(); ctx.ellipse(hx - 13 * k, hy - 13 * k, 7 * k, 4 * k, -.6, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fill();
      ctx.restore();
      // tiny floating hearts
      for (let i = 0; i < 4; i++) {
        const dd = d - .08 * i; if (dd <= 0) continue;
        const x = hx + (i % 2 ? 1 : -1) * (70 + i * 16) + Math.sin(dd * 6 + i) * 8, y = hy + 30 - dd * 160;
        ctx.save(); ctx.globalAlpha = clamp(1 - dd * 1.6); F.heart(ctx, x, y, 22 * spring(dd, 3, .4), P.coral, 3); ctx.restore();
      }
    }
    ctx.restore(); // camera

    // freeze glow (screen space)
    if (t > 5.3) {
      const k = invLerp(5.3, 5.8, t);
      const c = sprite('freeze', W, H, g => { const gr = g.createRadialGradient(960, 600, 200, 960, 600, 1100); gr.addColorStop(0, 'rgba(255,120,150,0)'); gr.addColorStop(1, 'rgba(255,120,150,.35)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); });
      ctx.save(); ctx.globalAlpha = k; ctx.drawImage(c, 0, 0); ctx.restore();
    }
    // caption
    if (!impactFrame) {
      ctx.save(); ctx.translate(sxo * .6, syo * .6);
      F.chapterCaption(ctx, 'Chapter One.', t - 1.1, { typeDur: 1.1, hold: 3.1, size: 64, y: 160 });
      ctx.restore();
      vignetteC(ctx);
      gutter(ctx);
    }

    // iris
    if (irisU < 1) {
      const s = lerp(92, 5600, ease.inCubic(irisU) * .35 + ease.outCubic(irisU) * .65);
      ctx.save();
      F.heartPath(ctx, cx0, cy0 + s * .08, s); ctx.rect(-10, -10, W + 20, H + 20);
      ctx.fillStyle = '#0b0a0e'; ctx.fill('evenodd');
      F.heartPath(ctx, cx0, cy0 + s * .08, s);
      ctx.lineWidth = 16; ctx.strokeStyle = P.ink; ctx.stroke();
      ctx.lineWidth = 5; ctx.strokeStyle = P.red; ctx.stroke();
      ctx.restore();
    }
  }

  // ═════════════════════════ ACT 2 — MONTAGE ═════════════════════════
  function chapterFrame(ctx, tint, alpha) { F.paper(ctx, { tint, tintAlpha: alpha }); }
  /** Paper tag behind a chapter caption so it reads over any background. */
  function captionCard(ctx, lt, hold, t, cap) {
    const parts = cap.split('|');
    F.font(ctx, 44, F.FONT.display, 400, 'italic'); let cw = ctx.measureText(parts[0]).width;
    F.font(ctx, 76, F.FONT.display, 900); cw = Math.max(cw, ctx.measureText(parts[1] || '').width, 360) + 70;
    const inK = spring(lt, 3.2, .45), out = 1 - invLerp(.6 + hold, .6 + hold + .25, lt);
    if (inK <= 0 || out <= 0) return;
    ctx.save(); ctx.globalAlpha *= clamp(inK * 2) * out;
    ctx.translate(80, 92); ctx.rotate(-.015); ctx.scale(1, clamp(.4 + inK * .6, 0, 1.2));
    F.inkShape(ctx, F.roundRectPts(0, 0, cw, 200, 10, 40), { fill: '#FFFBF2', t, seed: 990, lw: 5, amp: 1 });
    ctx.restore();
  }
  function finish(ctx, lt, n, cap, hold = 1.05) {
    captionCard(ctx, lt - .05, hold, lt, cap);
    F.chapterCaption(ctx, cap, lt - .05, { typeDur: .6, hold });
    vignetteC(ctx);
    gutter(ctx);
    pageNumber(ctx, n);
  }

  // ── Chapter Two: the first date (6–8) ─────────────────────────────
  function ch2(ctx, t, lt) {
    chapterFrame(ctx, '#FFD6DE', .55);
    const cam = kf(lt, [[0, 1.44], [2, 1.34]], ease.outCubic);
    ctx.save(); F.camera(ctx, { zoom: cam, x: 960, y: 520 });
    // wall stripes
    ctx.save(); ctx.globalAlpha = .12; ctx.fillStyle = P.coral;
    for (let x = 0; x < W; x += 120) ctx.fillRect(x, 0, 50, 780);
    ctx.restore();
    // window with night city
    const wx = 610, wy = 170, ww = 700, wh = 400;
    F.inkShape(ctx, F.roundRectPts(wx, wy, ww, wh, 18, 60), { fill: '#3A3F8F', t, seed: 200, lw: 7 });
    ctx.save(); F.smoothClosed(ctx, F.roundRectPts(wx + 4, wy + 4, ww - 8, wh - 8, 16, 40)); ctx.clip();
    // moon + stars
    F.inkShape(ctx, F.circlePts(1180, 260, 42, 20), { fill: '#FFF3C4', t, seed: 201, lw: 4 });
    for (let i = 0; i < 12; i++) { const tw = .5 + .5 * Math.sin(t * 5 + i * 2); F.sparkle(ctx, wx + 40 + hash(i) * (ww - 80), wy + 30 + hash(i + 40) * 160, 5 + 6 * tw, '#FFF3C4', 0); }
    // skyline
    for (let i = 0; i < 9; i++) {
      const bx = wx - 10 + i * 82, bh = 110 + hash(i + 3) * 150, by = wy + wh - bh;
      F.inkShape(ctx, F.roundRectPts(bx, by, 74, bh + 20, 4, 24), { fill: i % 2 ? P.cobaltShade : '#262B6E', t, seed: 210 + i, lw: 4 });
      for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (hash(i * 31 + r * 7 + c) > .45 && by + 18 + r * 26 < wy + wh - 10) {
        ctx.fillStyle = hash(i + r + c + Math.floor(t * 2)) > .9 ? P.gold : 'rgba(255,194,71,.8)'; ctx.fillRect(bx + 12 + c * 20, by + 18 + r * 26, 10, 12);
      }
    }
    ctx.restore();
    F.inkLine(ctx, [[wx + ww / 2, wy], [wx + ww / 2, wy + wh]], { t, seed: 220, lw: 7 });
    // awning
    const ay = wy - 70;
    for (let i = 0; i < 9; i++) {
      const x0 = wx - 60 + i * ((ww + 120) / 9), x1 = x0 + (ww + 120) / 9;
      F.inkShape(ctx, [[x0, ay], [x1, ay], [x1, ay + 70], [(x0 + x1) / 2, ay + 92], [x0, ay + 70]], { fill: i % 2 ? P.paper : P.coral, t, seed: 230 + i, lw: 5, amp: .8 });
    }
    // string lights
    const bulbs = []; for (let i = 0; i <= 12; i++) { const u = i / 12; bulbs.push([lerp(80, 1840, u), 70 + Math.sin(u * Math.PI) * 60 + Math.sin(u * TAU * 3) * 8]); }
    F.inkLine(ctx, bulbs, { t, seed: 240, lw: 3 });
    bulbs.forEach((b, i) => {
      if (i === 0 || i === 12) return; const on = .6 + .4 * Math.sin(t * 6 + i * 1.7);
      ctx.save(); ctx.globalAlpha = .35 * on; ctx.drawImage(radial('bulb', 40, '255,194,71', 1), b[0] - 40, b[1] - 24); ctx.restore();
      F.inkShape(ctx, F.ellipsePts(b[0], b[1] + 14, 9, 12, 12), { fill: i % 3 ? P.gold : P.blush, t, seed: 250 + i, lw: 3, amp: .5 });
    });
    // floor
    groundLine(ctx, t, 800, 'rgba(184,120,90,.28)', 7);
    for (let i = 0; i < 16; i++) F.inkLine(ctx, [[i * 130 - 20, 800], [i * 130 - 120, 1080]], { t, seed: 260 + i, lw: 3, stroke: 'rgba(22,22,29,.25)' });
    // pendant lamp glow on table
    ctx.drawImage(radial('lamp', 420, '255,194,71', .35), 540, 220);

    // clink choreography
    const clinkT = 6.9 - 6.0;
    const reach = kf(lt, [[0, 0], [.45, 0], [.62, -.25], [clinkT, 1], [clinkT + .35, 1], [clinkT + .7, .15]], ease.inOutCubic);
    const clinkD = lt - clinkT;
    const hop = clinkD > 0 ? jiggle(clinkD, 4, 7) : 0;
    // cup positions (world)
    const cupL = [lerp(885, 944, Math.max(0, reach)) - (reach < 0 ? 25 * -reach * 4 : 0) * 0, lerp(636, 590, Math.max(0, reach)) - hop * 6];
    const cupR = [lerp(1040, 976, Math.max(0, reach)), lerp(636, 590, Math.max(0, reach)) - hop * 6];
    if (reach < 0) { cupL[0] -= 30 * -reach * 4 * .25; cupR[0] += 30 * -reach * 4 * .25; }
    // stools
    for (const sx of [800, 1120]) {
      F.inkLine(ctx, [[sx - 30, 752], [sx - 40, 800]], { t, seed: sx, lw: 6 }); F.inkLine(ctx, [[sx + 30, 752], [sx + 40, 800]], { t, seed: sx + 1, lw: 6 });
      F.inkShape(ctx, F.roundRectPts(sx - 58, 734, 116, 22, 11, 24), { fill: P.coralShade, t, seed: sx + 2, lw: 5 });
    }
    const dotY = 752, dashY = 752;
    const happyBob = (s) => 1 + .02 * Math.sin(t * TAU * 2 + s);
    const lookUp = lt > 1.35 && lt < 1.65;
    const dS = { t, x: 800, y: dotY, legs: false, face: .35, mood: clinkD > 0 && clinkD < .6 ? 'joy' : 'happy', blush: .45 + .3 * invLerp(1.2, 1.8, lt), look: lookUp ? [.3, -1] : [.9, -.25],
      armR: [cupL[0] - 800 - 68, cupL[1] - (dotY - 83.5)], armL: [-34, 40], sy: happyBob(0) * (1 + .05 * hop), sx: 1 - .03 * hop };
    const hS = { t, x: 1120, y: dashY, legs: false, face: -.4, mood: clinkD > 0 && clinkD < .6 ? 'joy' : 'happy', blush: .35 + .35 * invLerp(1.2, 1.8, lt), look: lookUp ? [-.3, -1] : [-.9, -.2],
      armL: [cupR[0] - 1120 + 42, cupR[1] - (dashY - 26 - 176 + 74)], armR: [30, 44], sy: happyBob(1) * (1 + .05 * hop), sx: 1 - .03 * hop };
    dot(ctx, dS, g => scarf(g, t, 'dot'));
    dash(ctx, hS, g => scarf(g, t, 'dash'));
    // table (in front of bodies)
    F.inkLine(ctx, [[960, 650], [960, 790]], { t, seed: 270, lw: 12 });
    F.inkShape(ctx, F.ellipsePts(960, 796, 70, 12, 20), { fill: P.ink, t, seed: 271, lw: 4 });
    F.inkShape(ctx, F.roundRectPts(820, 636, 280, 26, 13, 40), { fill: P.paper, t, seed: 272, lw: 5 });
    // cups
    const cup = (x, y, col, seed) => {
      F.inkShape(ctx, [[x - 24, y - 26], [x + 24, y - 26], [x + 18, y + 12], [x - 18, y + 12]], { fill: col, t, seed, lw: 5, amp: .6 });
      F.inkLine(ctx, [[x + 22, y - 18], [x + 36, y - 14], [x + 32, y], [x + 18, y + 2]], { t, seed: seed + 1, lw: 5, amp: .5 });
      ctx.beginPath(); ctx.ellipse(x, y - 26, 22, 5, 0, 0, TAU); ctx.fillStyle = '#7a4a2a'; ctx.fill();
    };
    // hands over cups (draw cups, then hand dot on top)
    cup(cupL[0], cupL[1], P.mint, 280); cup(cupR[0], cupR[1], P.gold, 284);
    for (const c of [cupL, cupR]) { ctx.beginPath(); ctx.arc(c[0] + (c === cupL ? -14 : 14), c[1] - 6, 9, 0, TAU); ctx.fillStyle = P.ink; ctx.fill(); }
    // clink burst
    if (clinkD >= 0 && clinkD < .5) {
      const k = 1 - clinkD / .5, cx = 960, cy = 548;
      for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (i - 3) * .42, r0 = 30 + clinkD * 260; F.inkLine(ctx, [[cx + Math.cos(a) * r0, cy + Math.sin(a) * r0], [cx + Math.cos(a) * (r0 + 40 * k), cy + Math.sin(a) * (r0 + 40 * k)]], { t, seed: 290 + i, lw: 5 }); }
      F.sparkle(ctx, cx, cy - 10, 34 * spring(clinkD, 4, .3) * k + 4, P.gold, clinkD * 4);
      ctx.save(); ctx.globalAlpha = k; textPop(ctx, 'clink!', cx + 110, cy - 90, 64, spring(clinkD, 4, .35), .15, P.white, P.ink, F.FONT.hand, 700); ctx.restore();
    }
    // steam → heart
    const st = invLerp(clinkT + .1, clinkT + .75, lt);
    if (lt > .1) { // idle wisps before clink
      for (const [c, s] of [[cupL, 1], [cupR, -1]]) {
        const a = st > 0 ? 1 - st : 1;
        if (a <= 0) continue;
        const pts = []; for (let i = 0; i < 8; i++) { const u = i / 7; pts.push([c[0] + Math.sin(u * 5 + t * 4 + s) * 8, c[1] - 34 - u * 70]); }
        F.inkLine(ctx, pts, { t, seed: 300 + s, lw: 5, stroke: `rgba(255,255,255,${.85 * a})` });
      }
    }
    if (st > 0) {
      const hcx = 960, hcy = 420 - ease.outCubic(invLerp(clinkT + .8, 2.1, lt)) * 50, sc = 5.2;
      const half = (sgn) => {
        const out = [[960 + sgn * -16, 560], [960 + sgn * 10, 540], [960 - sgn * 6, 520]];
        for (let i = 0; i <= 24; i++) {
          const a = Math.PI + i / 24 * Math.PI; const hx = 16 * Math.pow(Math.sin(a), 3), hy = 13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a);
          out.push([hcx + sgn * -hx * sc, hcy - hy * sc]);
        }
        return out;
      };
      const pL = F.partialPolyline(half(1), st), pR = F.partialPolyline(half(-1), st);
      const fillK = spring(lt - (clinkT + .72), 3.5, .35);
      if (fillK > 0) { ctx.save(); F.heart(ctx, hcx, hcy + 2, 150 * fillK, P.red, 5); ctx.restore(); }
      F.inkLine(ctx, pL, { t, seed: 310, lw: 9, stroke: 'rgba(255,255,255,.95)' });
      F.inkLine(ctx, pR, { t, seed: 311, lw: 9, stroke: 'rgba(255,255,255,.95)' });
    }
    ctx.restore();
    finish(ctx, lt, 2, 'Chapter Two.|The first date.');
  }

  // ── Chapter Three: moving in (8–10) ────────────────────────────────
  const BOXES = [
    { land: .5, x: 1400, w: 250, h: 160, label: 'BOOKS', rot: -.02 },
    { land: 1.0, x: 1392, w: 210, h: 140, label: 'KITCHEN', rot: .04 },
    { land: 1.5, x: 1410, w: 170, h: 120, label: 'FRAGILE!!', rot: -.05 },
  ];
  function box(ctx, t, x, y, w, h, label, seed, sx = 1, sy = 1, rot = 0) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sx, sy);
    F.inkShape(ctx, F.roundRectPts(-w / 2, -h, w, h, 8, 36), { fill: '#E2B77E', t, seed, lw: 6 });
    F.inkShape(ctx, [[-w / 2, -h], [w / 2, -h], [w / 2 - 14, -h - 16], [-w / 2 + 14, -h - 16]], { fill: '#C9975A', t, seed: seed + 1, lw: 5, amp: .7 });
    ctx.fillStyle = 'rgba(255,248,230,.75)'; ctx.fillRect(-14, -h, 28, h * .45);
    F.font(ctx, Math.min(40, w * .19), F.FONT.hand, 700); ctx.fillStyle = label.startsWith('FRAG') ? P.red : P.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, -h * .32);
    ctx.restore();
  }
  function ch3(ctx, t, lt) {
    chapterFrame(ctx, '#D6F2E4', .6);
    const GY3 = 790;
    // wallpaper dots
    ctx.drawImage(sprite('wall3', W, H, g => { g.fillStyle = 'rgba(61,220,151,.22)'; g.beginPath(); for (let r = 0; r < 12; r++) for (let c = 0; c < 26; c++) { const x = c * 80 + (r % 2) * 40, y = r * 70 + 30; g.moveTo(x + 6, y); g.arc(x, y, 6, 0, TAU); } g.fill(); }), 0, 0);
    // thud shake
    let shk = 0; for (const b of BOXES) if (lt >= b.land) shk += 7 * Math.exp(-(lt - b.land) * 14);
    const [sx0, sy0] = F.shake(t, shk, 9, 35);
    ctx.save(); F.camera(ctx, { zoom: kf(lt, [[0, 1.22], [2, 1.3]]), x: 1000, y: 560, dx: sx0, dy: sy0 });
    // window with moon
    const wx = 280, wy = 170, ww = 380, wh = 360;
    F.inkShape(ctx, F.roundRectPts(wx, wy, ww, wh, 190, 60), { fill: '#1F2560', t, seed: 400, lw: 7 });
    ctx.save(); F.smoothClosed(ctx, F.roundRectPts(wx + 5, wy + 5, ww - 10, wh - 10, 185, 50)); ctx.clip();
    ctx.drawImage(radial('moon3', 200, '255,243,196', .45), 270, 120);
    ctx.beginPath(); ctx.arc(470, 320, 62, 0, TAU); ctx.arc(496, 300, 56, 0, TAU, true); ctx.fillStyle = '#FFF3C4'; ctx.fill('evenodd');
    for (let i = 0; i < 9; i++) { const tw = .5 + .5 * Math.sin(t * 4 + i * 1.9); F.sparkle(ctx, wx + 40 + hash(i + 70) * (ww - 80), wy + 50 + hash(i + 90) * (wh - 110), 4 + 7 * tw, '#FFF3C4', 0); }
    ctx.restore();
    F.inkLine(ctx, [[wx + ww / 2, wy + 4], [wx + ww / 2, wy + wh]], { t, seed: 401, lw: 6 });
    F.inkLine(ctx, [[wx, wy + wh * .55], [wx + ww, wy + wh * .55]], { t, seed: 402, lw: 6 });
    // curtains
    for (const s of [-1, 1]) {
      const x0 = s < 0 ? wx - 40 : wx + ww + 40, x1 = s < 0 ? wx + 40 : wx + ww - 40;
      F.inkShape(ctx, [[x0, wy - 40], [x1, wy - 40], [x1 + s * -10, wy + 140], [x0 + s * 10, wy + wh + 40], [x0, wy + wh + 40]], { fill: P.coral, t, seed: 410 + s, lw: 5 });
    }
    F.inkLine(ctx, [[wx - 70, wy - 40], [wx + ww + 70, wy - 40]], { t, seed: 415, lw: 8 });
    // framed picture that swings on thuds
    let swing = .06; for (const b of BOXES) swing += .22 * jiggle(lt - b.land, 2.2, 3.5);
    ctx.save(); ctx.translate(960, 180); ctx.rotate(swing);
    F.inkLine(ctx, [[0, 0], [-60, 60]], { t, seed: 420, lw: 3 }); F.inkLine(ctx, [[0, 0], [60, 60]], { t, seed: 421, lw: 3 });
    F.inkShape(ctx, F.roundRectPts(-90, 60, 180, 140, 6, 30), { fill: P.gold, t, seed: 422, lw: 6 });
    F.inkShape(ctx, F.roundRectPts(-70, 80, 140, 100, 4, 30), { fill: P.paper, t, seed: 423, lw: 4 });
    F.heart(ctx, 0, 134, 70, P.coral, 4);
    ctx.restore();
    // floor
    groundLine(ctx, t, GY3, 'rgba(201,151,90,.35)', 11);
    for (let i = 0; i < 6; i++) F.inkLine(ctx, [[-20, GY3 + 40 + i * 50], [W + 20, GY3 + 40 + i * 50]], { t, seed: 430 + i, lw: 3, stroke: 'rgba(22,22,29,.18)' });
    // rug with HOME
    F.inkShape(ctx, F.ellipsePts(940, GY3 + 30, 330, 46, 30), { fill: P.lilac, t, seed: 440, lw: 5 });
    ctx.save(); F.font(ctx, 44, F.FONT.hand, 700); ctx.fillStyle = 'rgba(22,22,29,.7)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('home', 940, GY3 + 32); ctx.restore();

    // boxes
    let stackTop = GY3, compress = [1, 1, 1];
    const drawn = [];
    BOXES.forEach((b, i) => {
      const fall = .24, d = lt - b.land;
      let y, sx = 1, sy = 1;
      if (d < -fall) { drawn.push(null); return; }
      const baseY = stackTop;
      if (d < 0) { const u = (d + fall) / fall; y = lerp(-80, baseY, ease.inQuad(u)); sy = 1 + .25 * u; sx = 1 - .12 * u; }
      else { y = baseY; const q = squash(d, .3, 3, 9); sx = q[0]; sy = q[1]; }
      // lower boxes compress on each landing
      for (let j = 0; j < i; j++) if (d >= 0) compress[j] *= 1 - .08 * Math.exp(-d * 12) * Math.cos(d * 18);
      drawn.push({ b, y, sx, sy, d });
      if (d >= 0) stackTop = baseY - b.h * sy * .98 - 14;
      else stackTop = baseY - b.h - 14;
    });
    // shadow under falling box
    drawn.forEach((o, i) => { if (o && o.d < 0) shadow(ctx, o.b.x, i === 0 ? GY3 + 4 : o.y - 2, o.b.w * .5 * invLerp(-.24, 0, o.d), .2); });
    // re-stack with compression
    let yy = GY3;
    drawn.forEach((o, i) => {
      if (!o) return;
      const sy = o.sy * compress[i];
      const y = o.d >= 0 ? yy : o.y;
      box(ctx, t, o.b.x, y, o.b.w, o.b.h, o.b.label, 450 + i * 5, o.sx, sy, o.b.rot);
      if (o.d >= 0) {
        yy = y - o.b.h * sy - 14;
        // dust puffs
        if (o.d < .45) for (const s of [-1, 1]) {
          const p = o.d / .45; ctx.save(); ctx.globalAlpha = 1 - p;
          for (let k = 0; k < 3; k++) { const px = o.b.x + s * (o.b.w / 2 + 20 + p * 90 + k * 26), py = y - 10 - p * 30 - k * 8; F.inkShape(ctx, F.circlePts(px, py, 14 + p * 16 - k * 3, 12), { fill: P.paper, t, seed: 470 + k + s, lw: 3.5 }); }
          ctx.restore();
          textPop(ctx, 'THUD', o.b.x + 180, y - o.b.h * .6, 44, spring(o.d, 4, .35) * (1 - p), .18, P.gold, P.ink, F.FONT.display, 900);
        }
      }
    });
    // plant pops up at 9.75
    const pd = lt - 1.75, pk = spring(pd, 3.5, .3);
    if (pd > 0) {
      ctx.save(); ctx.translate(560, GY3); ctx.scale(pk, pk);
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i - 2) * .45 + .05 * Math.sin(t * 3 + i), len = 130 + (i === 2 ? 40 : 0);
        const u = spring(pd - i * .04, 3, .35);
        const tip = [Math.cos(a) * len * u, -90 + Math.sin(a) * len * u];
        F.inkShape(ctx, [[0, -90], [tip[0] * .5 - Math.sin(a) * 26, tip[1] * .5 - 45 + Math.cos(a) * 26], tip, [tip[0] * .5 + Math.sin(a) * 26, tip[1] * .5 - 45 - Math.cos(a) * 26]], { fill: P.mint, t, seed: 480 + i, lw: 4.5 });
      }
      F.inkShape(ctx, [[-50, -96], [50, -96], [38, 0], [-38, 0]], { fill: P.coralShade, t, seed: 488, lw: 5 });
      F.inkShape(ctx, F.roundRectPts(-58, -110, 116, 22, 8, 24), { fill: P.coral, t, seed: 489, lw: 5 });
      ctx.restore();
      if (pd < .5) for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * .5; F.sparkle(ctx, 560 + Math.cos(a) * (170 + pd * 200), GY3 - 150 + Math.sin(a) * (120 + pd * 160), 14 * (1 - pd * 2), P.gold, 0); }
    }
    // characters
    const reactD = (i) => lt - BOXES[i].land;
    let hopD = 0, hopH = 0; for (let i = 0; i < 3; i++) { const d = reactD(i); if (d >= 0 && d < .3) { hopD = d; hopH = 26; } }
    const hp = hopH ? 4 * hopH * (hopD / .3) * (1 - hopD / .3) : 0;
    const allDown = lt > 1.62;
    const plantJoy = pd > .1;
    const dS = { t, x: 800, y: GY3 - hp, face: plantJoy ? -.4 : .35, mood: plantJoy ? 'joy' : (hopH && hopD < .25 ? 'shock' : 'happy'), blush: .3,
      look: plantJoy ? [-.9, .3] : lt > .3 ? [.9, -.5] : [.6, -.2], armL: plantJoy ? [-54, -40 + 10 * Math.sin(t * 24)] : [-34, 30], armR: plantJoy ? [50, -44 - 10 * Math.sin(t * 24)] : [40, 20] };
    const dashS = { t, x: 1130, y: GY3 - hp * .8, face: .55, look: allDown ? [-.7, -.2] : [1, -.9], mood: allDown ? 'happy' : (hopH && hopD < .25 ? 'shock' : 'worried'),
      armR: allDown ? [30, 40] : [70, -70], armL: allDown ? [-34, 40] : [-40, 20], rot: allDown ? 0 : .06 };
    if (allDown && lt > 1.7) { dashS.face = -.4; dashS.look = [-.95, 0]; dashS.mood = 'joy'; dashS.armL = [-50, -40]; }
    shadow(ctx, 800, GY3 + 4, 70); shadow(ctx, 1130, GY3 + 4, 55);
    dot(ctx, dS, g => bandana(g, t));
    dash(ctx, dashS, g => { // pencil behind the cowlick — handy-man Dash
      g.save(); g.translate(30, -196); g.rotate(-.6);
      F.inkShape(g, F.roundRectPts(-6, -34, 12, 60, 3, 16), { fill: P.gold, t, seed: 495, lw: 3.5, amp: .4 }); g.restore();
    });
    ctx.restore();
    finish(ctx, lt, 3, 'Chapter Three.|Moving in.');
  }

  // ── Chapter Four: Biscuit (10–12) ──────────────────────────────────
  function ch4(ctx, t, lt) {
    chapterFrame(ctx, '#FFE6A8', .5);
    const GY4 = 780;
    ctx.save(); F.camera(ctx, { zoom: kf(lt, [[0, 1.2], [1.0, 1.24], [1.4, 1.34], [2, 1.36]]), x: kf(lt, [[0, 930], [1.0, 950], [1.4, 1010]]), y: 590 });
    // sun with rays
    ctx.save();
    for (let i = 0; i < 16; i++) { const a = i / 16 * TAU + t * .25; ctx.beginPath(); ctx.moveTo(1600, 200); ctx.arc(1600, 200, 900, a, a + .12); ctx.closePath(); ctx.fillStyle = 'rgba(255,194,71,.13)'; ctx.fill(); }
    ctx.restore();
    F.inkShape(ctx, F.circlePts(1600, 200, 90, 26), { fill: P.gold, t, seed: 500, lw: 6 });
    cloud(ctx, 420 - lt * 20, 190, .8, t, 510);
    cloud(ctx, 1150 + lt * 12, 120, .55, t, 520);
    // hill
    ctx.save(); ctx.beginPath(); ctx.moveTo(-40, GY4 + 40);
    const hill = []; for (let x = -40; x <= W + 40; x += 60) hill.push([x, GY4 - 200 + Math.cos((x - 960) / 700) * -60 + 60]);
    hill.forEach(p => ctx.lineTo(p[0], p[1])); ctx.lineTo(W + 40, H + 20); ctx.lineTo(-40, H + 20); ctx.closePath();
    ctx.fillStyle = 'rgba(61,220,151,.45)'; ctx.fill(); ctx.restore();
    F.inkLine(ctx, hill, { t, seed: 530, lw: 4, stroke: 'rgba(22,22,29,.5)' });
    // picket fence (distant, on the hill)
    for (let i = 0; i < 24; i++) {
      const x = 20 + i * 84, bot = GY4 - 232 + Math.cos((x - 960) / 700) * -60 + 60 + 30, top = bot - 92;
      F.inkShape(ctx, [[x - 15, bot], [x - 15, bot - 30], [x - 15, bot - 60], [x - 15, top + 16], [x - 12, top + 11], [x, top], [x + 12, top + 11], [x + 15, top + 16], [x + 15, bot - 60], [x + 15, bot - 30], [x + 15, bot]], { fill: '#FFFDF7', t, seed: 540 + i, lw: 4, amp: .7 });
    }
    for (const dy of [28, 62]) { const rail = []; for (let x = -40; x <= W + 40; x += 80) rail.push([x, GY4 - 142 + Math.cos((x - 960) / 700) * -60 - dy]); F.inkLine(ctx, rail, { t, seed: 548 + dy, lw: 9 }); F.inkLine(ctx, rail, { t, seed: 548 + dy, lw: 4, stroke: '#FFFDF7' }); }
    groundLine(ctx, t, GY4, 'rgba(61,220,151,.55)', 13);
    for (const x of [140, 380, 660, 1480, 1700, 1860]) grassTuft(ctx, x, GY4 + 40 + (x % 3) * 40, t, x);
    // food bowl
    F.inkShape(ctx, [[1560, GY4 - 34], [1680, GY4 - 34], [1662, GY4], [1578, GY4]], { fill: P.coral, t, seed: 570, lw: 5 });
    ctx.save(); F.font(ctx, 24, F.FONT.label, 700); ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText('BISCUIT', 1620, GY4 - 10); ctx.restore();

    // Biscuit choreography
    const bark = 10.6 - 10, leap = 1.02, lickA = 1.12, lickB = 1.6, down = 1.62;
    let b = { t, x: -150, y: GY4, dir: 1, scale: 1.05, wag: t * 5, tongue: true };
    let bRot = 0, pivot = null, earFlop = 0;
    if (lt < .5) { // bounces in: 3 hops
      const hp = hops(lt, [[.02, .18, 60], [.18, .34, 60], [.34, .5, 44]]);
      b.x = lerp(-150, 930, ease.outQuad(invLerp(0, .5, lt))); b.y = GY4 - hp.h; b.walk = lt * 4;
      const st = hp.air ? 1 + .15 * Math.abs(hp.v) : 1; b.sy = st; b.sx = 1 / st;
      earFlop = hp.air ? -.5 * hp.v : .4;
    } else if (lt < leap) {
      b.x = 930; const [qx, qy] = squash(lt - .5, .3, 3, 9); b.sx = qx; b.sy = qy;
      const bk = lt >= bark - .08 ? pulse01(lt, bark - .08, bark + .3) : 0;
      b.bark = bk; b.tongue = bk < .05; earFlop = bk * 1 + .5 * jiggle(lt - bark, 3, 5);
      if (lt > bark) { const [ax, ay] = squash(lt - bark, .18, 3, 8); b.sx *= ax; b.sy *= ay; }
      if (lt > .86) { const a = invLerp(.86, leap, lt); b.sy *= 1 - .18 * a; b.sx *= 1 + .12 * a; }
    } else if (lt < down) { // leaps onto Dash & licks
      const u = invLerp(leap, lickA, lt);
      pivot = [lerp(930, 1100, ease.outQuad(u)), GY4 - 50 * Math.sin(Math.PI * u * .8) - (u >= 1 ? 30 : 30 * u)];
      bRot = lerp(0, -.72, ease.outBack(u)) + (lt > lickA ? .06 * Math.sin((lt - lickA) * 30) : 0);
      b.mood = 'joy'; earFlop = .6 + .3 * Math.sin(lt * 30); b.wag = t * 12;
    } else {
      const u = invLerp(down, down + .2, lt);
      b.x = lerp(1100, 990, u); const hp = hops(lt, [[down, down + .2, 30]]); b.y = GY4 - hp.h;
      b.mood = lt > 1.9 ? undefined : 'joy'; b.wag = t * 9; b.dir = lt > 1.75 ? -1 : 1;
      if (lt > down + .2) { const [qx, qy] = squash(lt - down - .2, .2, 3, 9); b.sx = qx; b.sy = qy; }
    }
    b.earFlop = earFlop;
    // characters
    const barkD = lt - bark;
    const jolt = barkD > 0 && barkD < .3 ? Math.sin(barkD / .3 * Math.PI) : 0;
    const licking = lt > lickA && lt < lickB;
    const slob = invLerp(lickA + .05, lickA + .25, lt);
    const laugh = lt > lickA + .08;
    const dS = { t, x: 700, y: GY4 - jolt * 26, face: laugh ? .3 : .1, look: lt < .5 ? [-.9, .3] : lt < leap ? [.6, .5] : [.9, -.2],
      mood: jolt > .2 ? 'shock' : laugh ? 'joy' : 'happy', blush: laugh ? .6 : .3, armL: [-30, 46], armR: [30, 46] };
    if (laugh) {
      const lk = Math.abs(Math.sin((lt - lickA) * 22));
      dS.mouth = .45 + .45 * lk; dS.sy = 1 + .05 * lk; dS.sx = 1 - .03 * lk; dS.rot = -.08 + .03 * lk;
      dS.armL = [-18, 12]; dS.armR = [26, 8 - 20 * lk];
    }
    const hS = { t, x: 1180, y: GY4 - jolt * 20, face: -.4, look: lt < .5 ? [-.9, .2] : [-.6, .6], mood: jolt > .2 ? 'shock' : 'happy', armL: [-30, 46], armR: [30, 46], blush: .2 };
    if (lt >= leap && lt < down + .3) {
      hS.mood = licking ? 'closed' : 'shock'; hS.rot = .16 * invLerp(leap, lickA, lt) * (lt < down ? 1 : 1 - invLerp(down, down + .3, lt)); hS.armL = [-50, -60]; hS.armR = [50, -70];
      hS.mouth = licking ? .35 : undefined; hS.face = -.2;
    } else if (lt >= down + .3) {
      const wipe = invLerp(down + .3, 2.0, lt);
      hS.mood = 'happy'; hS.armL = [-40 + 40 * Math.sin(wipe * TAU * 1.5), -80]; hS.blush = .4; hS.look = [-.7, .5];
    }
    shadow(ctx, 700, GY4 + 4, 70); shadow(ctx, 1180, GY4 + 4, 55);
    dot(ctx, dS, g => scarf(g, t, 'dot', P.cobalt));
    dash(ctx, hS, g => {
      if (slob > 0) { // slobber shine
        g.save(); g.globalAlpha = slob * (1 - .6 * invLerp(1.7, 2.1, lt));
        g.beginPath(); g.moveTo(-40, -110); g.quadraticCurveTo(-30, -170, -8, -190); g.lineWidth = 10; g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineCap = 'round'; g.stroke();
        g.beginPath(); g.moveTo(-18, -124); g.quadraticCurveTo(-12, -150, 4, -162); g.lineWidth = 5; g.stroke();
        for (const [x, y, r] of [[-38, -100, 7], [-20, -96, 5]]) { const dy = ((lt - lickA) * 60) % 30; g.beginPath(); g.ellipse(x, y + dy, r * .7, r, 0, 0, TAU); g.fillStyle = 'rgba(200,235,255,.95)'; g.fill(); g.lineWidth = 2.5; g.strokeStyle = P.ink; g.stroke(); }
        F.sparkle(g, -34, -176, 12 + 5 * Math.sin(t * 20), '#fff', 0);
        g.restore();
      }
    });
    // Biscuit (after characters so he's in front)
    shadow(ctx, pivot ? pivot[0] + 20 : b.x, GY4 + 4, 48);
    if (pivot) {
      ctx.save(); ctx.translate(pivot[0], pivot[1]); ctx.rotate(bRot);
      F.drawBiscuit(ctx, Object.assign({}, b, { x: 30, y: 0, tongue: false }));
      ctx.restore();
      if (licking) { // big tongue swipe
        const lk = ((lt - lickA) * 6) % 1, head = [pivot[0] + 2, pivot[1] - 110];
        const b0 = [head[0] + 24, head[1] + 12], tip = [1152, lerp(660, 585, ease.inOutSine(lk))];
        F.inkShape(ctx, [[b0[0] - 6, b0[1]], [tip[0] - 14, tip[1] + 4], [tip[0] - 2, tip[1] - 12], [tip[0] + 8, tip[1] + 2], [b0[0] + 8, b0[1] + 10]], { fill: '#ff7a8a', t, seed: 590, lw: 4, amp: .8 });
        for (let i = 0; i < 3; i++) F.inkLine(ctx, [[1250 + i * 14, 560 + i * 26], [1280 + i * 16, 552 + i * 26]], { t, seed: 595 + i, lw: 4 });
      }
    } else F.drawBiscuit(ctx, b);
    // WOOF!
    if (barkD > -.05 && barkD < .7) {
      const k = spring(barkD + .05, 4, .3) * (1 - invLerp(.5, .7, barkD));
      starburst(ctx, 1010, 520, 150 * k, 105 * k, 12, .1, P.white, 5, 9);
      textPop(ctx, 'WOOF!', 1010, 522, 96, k, -.08, P.gold);
      for (let i = 0; i < 3; i++) { const a = -1.2 + i * .35, r = 60 + barkD * 150; F.inkLine(ctx, [[990 + Math.cos(a) * r, 680 + Math.sin(a) * r], [990 + Math.cos(a) * (r + 40), 680 + Math.sin(a) * (r + 40)]], { t, seed: 600 + i, lw: 5 }); }
    }
    // "ha ha!"
    if (laugh && lt < 2.1) {
      const hd = lt - lickA - .08;
      [['ha', 600, 540, 0], ['ha!', 680, 470, .12], ['haha', 560, 440, .26]].forEach(([s, x, y, d0], i) => {
        const k = spring(hd - d0, 4, .35); if (k <= 0) return;
        ctx.save(); ctx.globalAlpha = clamp(1 - (hd - d0 - .5) * 2); textPop(ctx, s, x, y - (hd - d0) * 40, 52, k, -.2 + i * .15, P.coral, P.ink, F.FONT.hand, 700); ctx.restore();
      });
    }
    ctx.restore();
    finish(ctx, lt, 4, 'Chapter Four.|Biscuit.');
  }
  function pulse01(t, a, b) { return t < a || t > b ? 0 : Math.sin(Math.PI * (t - a) / (b - a)); }

  // ── Chapter Five: the question (12–14) ────────────────────────────
  function ch5(ctx, t, lt) {
    const m = L('dash', 12.75, .6), y = L('dot', 13.45, .45);
    const yesT = y.s - 12;
    chapterFrame(ctx, '#DCD0FF', .62);
    const GY5 = 780;
    const zoom = kf(lt, [[0, 1], [.95, 1.42], [yesT, 1.42], [yesT + .35, 1.2]], ease.inOutCubic);
    const focus = kf(lt, [[0, [960, 560]], [.95, [940, 620]], [yesT, [940, 620]], [yesT + .35, [950, 560]]], ease.inOutCubic);
    ctx.save(); F.camera(ctx, { zoom, x: focus[0], y: focus[1] });
    // dusk sky bands
    ctx.save(); for (let i = 0; i < 5; i++) { ctx.fillStyle = `rgba(184,164,255,${.08 + i * .05})`; ctx.fillRect(-200, i * 140 - 100, W + 400, 140); } ctx.restore();
    // stars
    for (let i = 0; i < 26; i++) { const tw = .5 + .5 * Math.sin(t * 3 + i * 2.3); F.sparkle(ctx, hash(i + 5) * W, hash(i + 9) * 460, 4 + 7 * tw, '#FFF6E0', 0); }
    // big moon halo behind them
    ctx.drawImage(radial('halo', 520, '255,243,196', .55, 150), 430, 0);
    F.inkShape(ctx, F.circlePts(950, 520, 250, 40), { fill: '#FFF3C4', t, seed: 700, lw: 6 });
    ctx.save(); ctx.globalAlpha = .18; ctx.fillStyle = P.goldShade; for (const [x, yy, r] of [[860, 440, 40], [1040, 600, 30], [1010, 420, 18], [880, 620, 22]]) { ctx.beginPath(); ctx.arc(x, yy, r, 0, TAU); ctx.fill(); } ctx.restore();
    // hill silhouette
    ctx.save(); ctx.beginPath(); ctx.moveTo(-200, GY5 + 10);
    for (let x = -200; x <= W + 200; x += 60) ctx.lineTo(x, GY5 - 20 + Math.sin(x * .004) * 30);
    ctx.lineTo(W + 200, H + 200); ctx.lineTo(-200, H + 200); ctx.closePath(); ctx.fillStyle = '#8F7FE0'; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = P.ink; ctx.stroke(); ctx.restore();
    // fireflies
    for (let i = 0; i < 14; i++) { const x = hash(i + 30) * W + Math.sin(t * 1.3 + i) * 30, yy = 520 + hash(i + 31) * 240 + Math.cos(t * 1.7 + i) * 20, a = .5 + .5 * Math.sin(t * 4 + i * 3);
      ctx.save(); ctx.globalAlpha = a; ctx.drawImage(radial('fly', 18, '215,255,58', .9), x - 18, yy - 18); ctx.restore(); }

    // Dash kneel & ring box
    const kneel = ease.outBack(invLerp(.12, .38, lt), 2.2);
    const boxOpen = ease.outBack(invLerp(.5, .56, lt), 3);
    const present = ease.outBack(invLerp(.3, .5, lt), 1.6);
    const glintD = lt - .55;
    const yesD = lt - yesT;
    const dashX = 1085;
    const kn = clamp(kneel, 0, 1.15);
    const hS = { t, x: dashX, y: GY5 + 10 * kn, legs: kn > .02 ? false : undefined, face: -.45, look: lt < .3 ? [-.5, .4] : [-.8, -.55], mood: lt < .3 ? 'neutral' : 'worried', blush: .3 + .5 * invLerp(.4, 1.0, lt),
      armL: [lerp(-30, -96, present), lerp(46, -8, present)], armR: [30, 40], rot: -.12 * kn, mouth: mouthOf(m, t) };
    if (yesD > 0) { hS.mood = 'joy'; hS.armR = [60, -70 + 10 * Math.sin(t * 20)]; hS.blush = .9; hS.mouth = .5; }
    const ringBox = (g) => {
      g.save(); g.rotate(-hS.rot); g.translate(-10, -10);
      F.inkShape(g, F.roundRectPts(-26, -8, 52, 30, 6, 24), { fill: P.coralShade, t, seed: 710, lw: 4, amp: .5 });
      // ring
      if (boxOpen > .1) { g.beginPath(); g.ellipse(0, -14, 12, 10, 0, 0, TAU); g.lineWidth = 6; g.strokeStyle = P.gold; g.stroke(); g.lineWidth = 2; g.strokeStyle = P.ink; g.stroke();
        g.save(); g.translate(0, -26); g.rotate(Math.PI / 4); g.fillStyle = '#E8F7FF'; g.fillRect(-6, -6, 12, 12); g.lineWidth = 2.5; g.strokeRect(-6, -6, 12, 12); g.restore(); }
      // lid (hinged at back-top)
      g.save(); g.translate(-26, -8); g.rotate(-boxOpen * 1.9);
      F.inkShape(g, F.roundRectPts(0, -14, 52, 16, 6, 20), { fill: P.coral, t, seed: 712, lw: 4, amp: .5 }); g.restore();
      g.restore();
    };
    hS.holdL = ringBox;
    // Dot
    const antic = invLerp(yesT - .22, yesT, lt);
    const jumpU = invLerp(yesT + .02, yesT + .6, lt);
    const dS = { t, x: 810, y: GY5, face: .35, mood: 'neutral', look: [.7, .3], blush: .3, armL: [-30, 46], armR: [30, 46] };
    if (lt > .35 && lt < yesT) {
      const g = ease.outBack(invLerp(.35, .55, lt));
      dS.mood = lt < .9 ? 'shock' : 'shy'; dS.look = [.8, .45]; dS.blush = .3 + .7 * invLerp(.55, 1.2, lt);
      dS.armL = [lerp(-30, -20, g), lerp(46, -54, g)]; dS.armR = [lerp(30, 18, g), lerp(46, -58, g)];
      dS.sy = 1 + .04 * g - .16 * ease.inOutSine(antic); dS.sx = 1 - .02 * g + .1 * ease.inOutSine(antic);
      dS.rot = .03 * Math.sin(lt * 9) * (1 - antic);
    }
    if (lt >= yesT) {
      dS.mood = 'love'; dS.blush = 1; dS.mouth = mouthOf(y, t); if (dS.mouth === 0) dS.mouth = .45;
      dS.y = GY5 - 260 * ease.outQuad(jumpU);
      dS.sy = 1 + .22 * (1 - jumpU) * (jumpU > 0 ? 1 : 0); dS.sx = 1 - .1 * (1 - jumpU) * (jumpU > 0 ? 1 : 0);
      dS.armL = [-52, -84]; dS.armR = [56, -80]; dS.rot = -.08 * Math.sin(jumpU * Math.PI);
      if (jumpU <= 0) { const q = squash(0, .2); dS.sx = q[0]; dS.sy = q[1]; }
    }
    // light rays from the ring (behind characters, over halo)
    const ringPos = [dashX - 42 - 96 + 10 - 8, GY5 - 26 - 176 + 74 + 22 - 8 - 22];
    if (glintD > 0 && lt < yesT + .4) {
      const a = clamp(glintD * 4) * (1 - invLerp(yesT, yesT + .4, lt));
      ctx.save(); ctx.globalAlpha = a * .42;
      for (let i = 0; i < 14; i++) { const ang = i / 14 * TAU + glintD * .5; ctx.beginPath(); ctx.moveTo(ringPos[0], ringPos[1]); ctx.arc(ringPos[0], ringPos[1], 700, ang, ang + .09); ctx.closePath(); ctx.fillStyle = i % 2 ? P.gold : '#FFF3C4'; ctx.fill(); }
      ctx.restore();
    }
    // YES heart shockwave
    if (yesD > 0) {
      const p = invLerp(0, .55, yesD);
      ctx.save(); ctx.globalAlpha = 1 - p; F.heartPath(ctx, 900, 560, 200 + 1200 * ease.outCubic(p)); ctx.lineWidth = 24 * (1 - p) + 2; ctx.strokeStyle = P.red; ctx.stroke(); ctx.restore();
    }
    shadow(ctx, dashX, GY5 + 4, 60); shadow(ctx, 810, GY5 + 4, 70 * (1 - .5 * jumpU));
    if (kn > .02) { // hand-built kneel: front knee raised, back knee on the ground
      const hy = GY5 + 10 * kn - 24, x = dashX;
      F.inkLine(ctx, [[x - 16, hy], [x - 16 - 34 * kn, lerp(hy, GY5 - 34, kn)], [x - 20 - 34 * kn, GY5]], { t, seed: 720, lw: 5, amp: .6 });
      F.inkLine(ctx, [[x + 14, hy], [x + 18 + 8 * kn, lerp(hy, GY5 - 4, kn)], [x + 18 + 44 * kn, GY5 - 6]], { t, seed: 721, lw: 5, amp: .6 });
      ctx.fillStyle = P.ink; ctx.beginPath(); ctx.ellipse(x - 12 - 34 * kn, GY5 - 3, 12, 6, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + 26 + 44 * kn, GY5 - 6, 11, 6, -.2, 0, TAU); ctx.fill();
    }
    dash(ctx, hS, g => bowtie(g, t));
    dot(ctx, dS, g => flower(g, t, -44, -170, 1));
    // glint sparkle on top
    if (glintD > 0 && glintD < .9) {
      const k = spring(glintD, 4, .3) * (1 - invLerp(.5, .9, glintD));
      F.sparkle(ctx, ringPos[0], ringPos[1] - 6, 70 * k, '#fff', glintD * 3);
      F.sparkle(ctx, ringPos[0], ringPos[1] - 6, 40 * k, P.gold, glintD * 3 + .78);
      F.sparkle(ctx, ringPos[0] + 40, ringPos[1] - 44, 18 * k, P.gold, 0);
    }
    // nervous sweat drop on Dash while asking
    if (lt > .9 && lt < yesT) { const d = (lt - .9) % .6; ctx.save(); ctx.globalAlpha = 1 - d / .6; ctx.beginPath(); const sx = dashX + 44, sy = GY5 - 200 + 22 + d * 60; ctx.moveTo(sx, sy - 14); ctx.quadraticCurveTo(sx + 10, sy, sx, sy + 6); ctx.quadraticCurveTo(sx - 10, sy, sx, sy - 14); ctx.fillStyle = '#BFE6FF'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = P.ink; ctx.stroke(); ctx.restore(); }
    ctx.restore(); // camera

    // YES! slam (screen space)
    if (yesD > 0) {
      const k = spring(yesD, 3.2, .32);
      textPop(ctx, 'YES!', 330, 250, 200, k, -.1, P.coral);
      for (let i = 0; i < 5; i++) { const d = yesD - i * .05; if (d > 0) { ctx.save(); ctx.globalAlpha = clamp(1 - d * 1.5); F.heart(ctx, 780 + (i - 2) * 90 + Math.sin(d * 8 + i) * 12, 560 - d * 380 - i * 20, 40 * spring(d, 3, .4), i % 2 ? P.red : P.coral, 4); ctx.restore(); } }
    }
    // confetti cannons at 13.6
    const cD = t - 13.6;
    const cannon = (x, flip) => {
      ctx.save(); ctx.translate(x, H - 10); ctx.scale(flip * 1.35, 1.35); ctx.rotate(-.75 - (cD > 0 ? .08 * jiggle(cD, 5, 6) : 0));
      const recoil = cD > 0 ? -30 * Math.exp(-cD * 10) : 0;
      F.inkShape(ctx, [[recoil - 20, -30], [recoil + 190, -60], [recoil + 190, 60], [recoil - 20, 30]], { fill: P.cobalt, t, seed: 740, lw: 6 });
      ctx.fillStyle = P.gold; for (let i = 0; i < 3; i++) ctx.fillRect(recoil + 20 + i * 55, -36 - i * 7, 16, 72 + i * 14);
      ctx.restore();
    };
    const cIn = ease.outBack(invLerp(1.3, 1.55, lt));
    if (cIn > 0) { ctx.save(); ctx.translate(0, (1 - cIn) * 200); cannon(40, 1); cannon(W - 40, -1); ctx.restore(); }
    if (cD >= 0) {
      if (cD < .12) { const k = 1 - cD / .12; starburst(ctx, 230, H - 170, 160 * k + 40, 60 * k + 20, 10, 0, P.white, 5, 11); starburst(ctx, W - 230, H - 170, 160 * k + 40, 60 * k + 20, 10, .3, P.white, 5, 12); }
      F.confetti(ctx, t, 13.6, { x: 220, y: H - 150, angle: -1.05, spread: 1.0, speed: 4200, n: 170, seed: 31, gravity: 500 });
      F.confetti(ctx, t, 13.6, { x: W - 220, y: H - 150, angle: -Math.PI + 1.05, spread: 1.0, speed: 4200, n: 170, seed: 32, gravity: 500 });
      F.confetti(ctx, t, 13.62, { x: 960, y: -40, angle: Math.PI / 2, spread: 2.6, speed: 2400, n: 120, seed: 33, gravity: 300 });
      // streamers
      for (let i = 0; i < 6; i++) {
        const side = i % 2 ? -1 : 1, ang = side > 0 ? -1.05 + (i - 2.5) * .08 : -Math.PI + 1.05 + (i - 2.5) * .08, len = 1400 * (1 - Math.exp(-cD * 5)) * (.6 + hash(i) * .5);
        const ox = side > 0 ? 220 : W - 220, oy = H - 150, pts = [];
        for (let j = 0; j <= 16; j++) { const u = j / 16, r = u * len; pts.push([ox + Math.cos(ang) * r + Math.sin(u * 14 + cD * 10 + i) * 24 * u, oy + Math.sin(ang) * r + Math.cos(u * 14 + i) * 18 * u + 400 * cD * cD * u]); }
        F.inkLine(ctx, pts, { t, seed: 760 + i, lw: 8, stroke: [P.coral, P.gold, P.mint, P.lilac, P.cobalt, P.blush][i], amp: .5 });
      }
    }
    finish(ctx, lt, 5, 'Chapter Five.|The question.', .75);
  }

  const CHAPTERS = [null, ch2, ch3, ch4, ch5];
  function drawChapter(ctx, t, k) {
    if (k === 0) return actMeet(ctx, t);
    const start = 6 + (k - 1) * 2;
    CHAPTERS[k](ctx, t, t - start);
  }
  const FLIP_PRE = .24, FLIP_POST = .11; // fast flip (0.35 s), lands just after the downbeat
  /** Printed pages for the flips: the turning page is frozen at flip start, the revealed page at the downbeat.
   *  Cached per slot (pure function of the key), so a flip costs two blits instead of two scene renders. */
  const _pageKey = {};
  function page(slot, t, k) {
    const c = F.offscreen('a_page_' + slot), key = t.toFixed(4) + ':' + k;
    if (_pageKey[slot] !== key) {
      const g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.clearRect(0, 0, W, H);
      g.save(); drawChapter(g, t, k); g.restore(); _pageKey[slot] = key;
    }
    return c;
  }

  FILM.addScene({
    name: 'a_meet', start: 0, end: 14,
    draw(ctx, t) {
      for (let i = 0; i < 4; i++) {
        const T = 6 + i * 2;
        if (t >= T - FLIP_PRE && t < T + FLIP_POST) {
          const p = (t - (T - FLIP_PRE)) / (FLIP_PRE + FLIP_POST);
          const under = page('under', T, i + 1), over = page('over', T - FLIP_PRE, i);
          F.pageTurn(ctx, p, g => g.drawImage(under, 0, 0), g => g.drawImage(over, 0, 0));
          return;
        }
      }
      const k = t < 6 ? 0 : Math.min(4, 1 + Math.floor((t - 6) / 2));
      drawChapter(ctx, t, k);
    },
  });
})();
