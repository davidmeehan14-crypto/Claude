/* Animator B — scenes 4–7 (13.0–25.0 s): Split word · Brand beat · Phone demo · Landscape seating.
 * Timing constants at the top drive both the drawing and the SFX cues (node: require(this).cues()).
 */
(function () {
  // ───────────── timing (law) ─────────────
  const TY = { text: 'Find a florist in Bath under £1,500', t0: 17.1, dt: 0.035 };
  const TAP = { search: 16.75, send: 18.5, book: 20.0 };
  const CARD_T = [18.75, 18.95, 19.15];
  const SWIPE = { press: 20.58, a: 20.6, b: 20.88 };
  const OBJS = [
    { n: 'rose', p: [150, 175], q: [175, 175], s: 170, blur: 0, d: 16.1, rot: -.2 },
    { n: 'coupe', p: [1775, 215], q: [1765, 175], s: 200, blur: 0, d: 16.2, rot: .15 },
    { n: 'envelope', p: [1765, 885], q: [1790, 900], s: 220, blur: 0, d: 16.3, rot: -.12 },
    { n: 'ring', p: [660, 930], q: [175, 975], s: 150, blur: 2, d: 16.35, rot: .25 },
    { n: 'heart', p: [845, 160], q: [1575, 110], s: 95, blur: 3.5, d: 16.45, rot: .2 },
    { n: 'cake', p: [115, 895], q: [110, 650], s: 170, blur: 1, d: 16.5, rot: -.05 },
  ];
  const DRAGS = [
    { chip: 0, table: 1, pick: 22.75, drop: 23.0 },
    { chip: 1, table: 0, pick: 23.2, drop: 23.5 },
    { chip: 2, table: 5, pick: 23.65, drop: 24.0 },
  ];
  const LABEL_T = 24.0, OUT_T = 24.5;

  function hsh(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return x - Math.floor(x); }
  function cues() {
    const q = [];
    const c = (t, sfx, gain = .7, pan = 0) => q.push({ t: +t.toFixed(3), sfx, gain: +Math.min(1, Math.max(.3, gain)).toFixed(2), pan: +pan.toFixed(2) });
    // 4 · split word
    c(13.08, 'whoosh_short', .75, 0);
    c(13.14, 'swish', .45, -.25);
    [13.22, 13.3, 13.38, 13.46].forEach((x, i) => c(x, 'pop_soft', .3 + .04 * i, -.45 + .3 * i));
    c(14.0, 'impact_soft', .75, 0); c(14.02, 'click', .55, 0);
    c(14.58, 'whoosh_short', .55, 0); c(14.64, 'glass_ting', .7, 0); c(14.66, 'pop', .45, 0);
    c(15.0, 'riser', .6, 0);
    // 5 · brand beat
    c(15.0, 'bass_drop', 1.0, 0); c(15.08, 'whoosh', .8, 0);
    c(15.22, 'logo_shimmer', .75, 0); c(15.34, 'sparkle', .4, .2);
    c(15.98, 'whoosh', .75, 0);
    // 6 · phone demo
    c(16.15, 'swish', .5, .25);
    OBJS.forEach(o => c(o.d + .03, 'pop_soft', .32, (o.p[0] / 1920 - .5) * 1.4));
    c(TAP.search, 'tap', .9, .2); c(16.92, 'whoosh_short', .35, .2);
    for (let i = 0; i < TY.text.length; i++) c(TY.t0 + i * TY.dt, 'type', .45 + .25 * hsh(i + 3), .15 + (hsh(i + 9) - .5) * .2);
    c(TAP.send, 'tap', .9, .25); c(18.56, 'bubble', .6, .2); c(18.62, 'whoosh_short', .35, .2); c(18.68, 'pop_soft', .3, .2);
    CARD_T.forEach((x, i) => { c(x + .05, 'paper', .6, .3); c(x + .12, 'pop_soft', .32, .3 - i * .05); });
    c(TAP.book, 'tap', .9, .25); c(20.1, 'success', .8, .2); c(20.14, 'sparkle', .38, .25); c(20.22, 'notify', .45, .2);
    c(20.75, 'swipe', .8, 0);
    for (let i = 0; i < 5; i++) c(20.97 + i * .07, 'pop_soft', .3, -.1 + i * .08);
    c(21.62, 'sparkle', .35, .2);
    // 7 · landscape seating
    c(22.25, 'whoosh', .7, 0); c(22.42, 'impact_soft', .45, 0); c(22.52, 'pop_soft', .35, 0);
    DRAGS.forEach((d, i) => { c(d.pick, 'drag', .7, -.4); c(d.drop, 'drop', .8, -.1 + i * .2); c(d.drop + .06, 'pop_soft', .4, -.1 + i * .2); });
    c(LABEL_T + .02, 'success', .85, .3); c(LABEL_T + .04, 'pop', .7, .3); c(LABEL_T + .08, 'sparkle', .5, .3);
    c(24.8, 'whoosh', .9, 0);
    return q.sort((a, b) => a.t - b.t);
  }
  if (typeof KIT === 'undefined') { if (typeof module !== 'undefined') module.exports = { cues }; return; }

  // ───────────── shorthand ─────────────
  const K = KIT, C = K.C, F = K.F, E = K.ease, W = K.W, H = K.H, TAU = K.TAU, UI = K.UI;
  const cl = K.clamp, lerp = K.lerp, rr = K.rr, font = K.font;
  const R = (t, a, b, e = E.outQuart) => e(cl((t - a) / (b - a)));
  const txt = (g, s, x, y, size, weight = 600, color = C.ink, align = 'left', family = F.sans) => UI.text(g, s, x, y, size, weight, color, align, family);
  function tracked(g, s, x, y, size, weight, color, sp, align = 'left', family = F.caps) {
    font(g, size, weight, family); g.letterSpacing = sp + 'px'; g.fillStyle = color; g.textAlign = align; g.textBaseline = 'alphabetic';
    g.fillText(s, x, y); const w = g.measureText(s).width; g.letterSpacing = '0px'; return w;
  }
  const smooth = p => p * p * (3 - 2 * p);

  // ═════════════ 4 · SPLIT WORD (13.0–15.0) ═════════════
  const WORD = 'Effortless.', GROUPS = ['E', 'ff', 'ort', 'l', 'ess.'], GAPS = [0, 92, 58, 150, 78];
  const WSIZE = 220, WY = 612;
  function splitBg(ctx, t) {
    K.bgWhite(ctx, t, { band: .75, colors: [C.lilac, C.blush, C.peach, C.champagne, C.lavender, C.blush, C.lilac, C.peach] });
    K.blob(ctx, C.sky, 420 + Math.sin(t * .4) * 40, -40, 760, 380, .5);
    K.blob(ctx, C.lilac, 1500, -80, 600, 300, .35);
  }
  function splitAmt(t) {
    if (t < 13.5) return E.outExpo(cl((t - 13.0) / .5));
    if (t < 14.0) return 1 + .07 * E.inOutSine((t - 13.5) / .5);
    return 1.07 * (1 - E.outBack(cl((t - 14.0) / .32), 1.7));
  }
  function wordGeom(ctx, t) {
    font(ctx, WSIZE, 700);
    const full = ctx.measureText(WORD).width, s = splitAmt(t); let idx = 0, acc = 0; const gs = [];
    GROUPS.forEach((str, i) => {
      acc += GAPS[i] * s; const x0 = ctx.measureText(WORD.slice(0, idx)).width; const m = ctx.measureText(str);
      gs.push({ s: str, x: x0 + acc, w: m.width, l: -m.actualBoundingBoxLeft, r: m.actualBoundingBoxRight }); idx += str.length;
    });
    const off = W / 2 - (full + acc) / 2; gs.forEach(g => { g.x += off; g.L = g.x + g.l; g.R = g.x + g.r; });
    const asc = ctx.measureText('l').actualBoundingBoxAscent;
    return { gs, top: WY - asc, bot: WY };
  }
  function goldRing(ctx, x, y, r, lw, a0 = 0, alpha = 1) {
    if (r <= .5 || alpha <= 0) return;
    ctx.save(); ctx.globalAlpha *= alpha;
    K.blob(ctx, C.gold2, x, y + r * .08, r * 2.3, r * 2.3, .32);
    const g = ctx.createConicGradient(a0, x, y);
    [['#FFF3D2', 0], ['#E6C27A', .16], ['#A8782E', .36], ['#F6DCA0', .55], ['#C8964A', .74], ['#E9B7A0', .88], ['#FFF3D2', 1]].forEach(([c, s]) => g.addColorStop(s, c));
    ctx.lineWidth = lw; ctx.strokeStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    ctx.lineWidth = Math.max(1, lw * .22); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(255,255,255,.7)';
    ctx.beginPath(); ctx.arc(x, y, r - lw * .12, Math.PI * 1.08, Math.PI * 1.55); ctx.stroke();
    ctx.lineWidth = Math.max(1, lw * .12); ctx.strokeStyle = 'rgba(140,90,30,.25)';
    ctx.beginPath(); ctx.arc(x, y, r + lw * .3, Math.PI * .1, Math.PI * .7); ctx.stroke();
    ctx.restore();
  }
  function ringR(t) { let r = 62 * K.spring(t - 14.62, 2.8, .45); r *= 1 - .12 * E.inQuad(R(t, 14.82, 15.0, E.linear)); return r; }

  function drawSplit(ctx, t) {
    splitBg(ctx, t);
    const G = wordGeom(ctx, t), gs = G.gs;
    const inA = R(t, 12.96, 13.2, E.outCubic);
    const gA = inA * (1 - R(t, 14.06, 14.34, E.outQuad)); // guides alpha
    // ── guides ──
    if (gA > 0.01) {
      ctx.save(); ctx.globalAlpha = gA;
      const pH = R(t, 13.06, 13.5, E.outExpo), mid = (G.top + G.bot) / 2;
      ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(42,27,61,.2)';
      for (const y of [G.top, G.bot]) { ctx.beginPath(); ctx.moveTo(W / 2 - W / 2 * pH, y); ctx.lineTo(W / 2 + W / 2 * pH, y); ctx.stroke(); }
      const edges = gs.flatMap(g => [g.L, g.R]);
      edges.forEach((x, i) => {
        const p = R(t, 13.1 + i * .022, 13.6 + i * .022, E.outExpo); if (p <= 0) return;
        ctx.beginPath(); ctx.moveTo(x, mid - (mid + 20) * p); ctx.lineTo(x, mid + (H - mid + 20) * p); ctx.stroke();
      });
      edges.forEach((x, i) => {
        const sc = K.spring(t - (13.2 + i * .022), 3.2, .5) * (1 - R(t, 14.05, 14.25, E.inQuad)); if (sc <= 0.01) return;
        for (const y of [G.top, G.bot]) { const s = 9 * sc; ctx.fillStyle = C.ink; ctx.fillRect(x - s / 2, y - s / 2, s, s); }
      });
      // spacing measurements between groups
      const mA = R(t, 13.35, 13.6, E.outQuad);
      if (mA > 0) {
        ctx.globalAlpha = gA * mA;
        for (let i = 1; i < gs.length; i++) {
          const x1 = gs[i - 1].R + 8, x2 = gs[i].L - 8; if (x2 - x1 < 26) continue;
          const y = G.top - 42; ctx.strokeStyle = C.rose; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.moveTo(x1, y - 6); ctx.lineTo(x1, y + 6); ctx.moveTo(x2, y - 6); ctx.lineTo(x2, y + 6); ctx.stroke();
          const lab = String(Math.round(x2 - x1 + 16)); font(ctx, 14, 600, F.caps); const lw = ctx.measureText(lab).width + 14;
          rr(ctx, (x1 + x2) / 2 - lw / 2, y - 30, lw, 22, 11); ctx.fillStyle = C.rose; ctx.fill();
          ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(lab, (x1 + x2) / 2, y - 14);
        }
      }
      ctx.restore();
    }
    // ── word ──
    const col = R(t, 14.45, 14.7, E.inCubic);
    if (col < 1) {
      const antic = 1 + .035 * R(t, 14.22, 14.45, E.outQuad);
      const sIn = lerp(1.12, 1, inA), blurIn = (1 - inA) * 12;
      font(ctx, WSIZE, 700); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      const cy = WY - WSIZE * .36;
      gs.forEach((g, i) => {
        const gc = g.x + g.w / 2;
        const x = lerp(gc, W / 2, col), s = sIn * antic * (1 - .92 * col);
        const settle = t > 14.0 ? 0 : Math.sin(t * 2.2 + i) * 2;
        ctx.save(); ctx.globalAlpha = inA * (1 - col * col);
        const b = blurIn + col * 14; if (b > .3) ctx.filter = `blur(${b.toFixed(1)}px)`;
        ctx.translate(W / 2 + (x - W / 2) * sIn * antic, cy + settle); ctx.scale(s, s);
        ctx.fillStyle = C.ink; ctx.fillText(g.s, -g.w / 2, WY - cy); ctx.restore();
      });
    }
    // ── gold ring glyph ──
    if (t >= 14.62) goldRing(ctx, W / 2, WY - WSIZE * .36, ringR(t), 24, t * 2.4);
  }
  K.addScene({ name: 'b_split', start: 13.0, end: 15.0, draw(ctx, t) { drawSplit(ctx, t); } });

  // ═════════════ 5 · BRAND BEAT (15.0–16.0) ═════════════
  function goldenBase() {
    return K.cache('b:golden', W, H, (g) => {
      const gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, '#F4CB98'); gr.addColorStop(.42, '#EFAE8E'); gr.addColorStop(.72, '#E3939C'); gr.addColorStop(1, '#C982A6');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      const sun = g.createRadialGradient(W * .5, H * .2, 0, W * .5, H * .2, 720);
      sun.addColorStop(0, 'rgba(255,248,228,.9)'); sun.addColorStop(.35, 'rgba(255,230,190,.4)'); sun.addColorStop(1, 'rgba(255,220,180,0)');
      g.fillStyle = sun; g.fillRect(0, 0, W, H);
      g.filter = 'blur(10px)';
      const hills = [[.70, 'rgba(236,168,150,.55)', 60, 1.3], [.79, 'rgba(214,142,152,.55)', 48, 2.1], [.9, 'rgba(186,128,160,.5)', 36, 2.9]];
      hills.forEach(([v, c, amp, f], k) => {
        g.beginPath(); g.moveTo(-40, H + 40);
        for (let x = -40; x <= W + 40; x += 20) g.lineTo(x, H * v - Math.sin(x / W * Math.PI * f + k) * amp - Math.sin(x / W * 11 + k * 2) * amp * .25);
        g.lineTo(W + 40, H + 40); g.closePath(); g.fillStyle = c; g.fill();
      });
      g.filter = 'none';
    });
  }
  function goldenWorld(ctx, t, z = 1) {
    ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2);
    ctx.drawImage(goldenBase(), 0, 0);
    ctx.globalCompositeOperation = 'screen';
    // soft light rays
    ctx.save(); ctx.translate(W * .5, H * .2); ctx.rotate(t * .05);
    for (let i = 0; i < 9; i++) {
      ctx.rotate(TAU / 9); const a = .05 + .04 * Math.sin(t * 1.3 + i * 2);
      const gr = ctx.createLinearGradient(0, 0, 1100, 0); gr.addColorStop(0, `rgba(255,240,210,${a})`); gr.addColorStop(1, 'rgba(255,240,210,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(1100, -60 - 30 * K.hash(i)); ctx.lineTo(1100, 60 + 30 * K.hash(i + 4)); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    // bokeh
    for (let i = 0; i < 30; i++) {
      const sp = .5 + K.hash(i + 9);
      const x = K.hash(i) * W + K.noise1(t * .4, i) * 40;
      const y = ((K.hash(i + 50) * (H + 200) - (t - 15) * 40 * sp) % (H + 200) + H + 200) % (H + 200) - 100;
      const rad = 14 + K.hash(i + 3) * 52, a = .1 + .22 * K.hash(i + 21);
      K.blob(ctx, '#FFF1D6', x, y, rad * 1.5, rad * 1.5, a);
      ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fillStyle = `rgba(255,246,228,${a * .55})`; ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = `rgba(255,255,255,${a * .8})`; ctx.stroke();
    }
    ctx.restore();
  }
  function drawBrand(ctx, t) {
    const e = E.outExpo(cl((t - 15.0) / .55));
    const push = E.inQuart(R(t, 15.55, 16.0, E.linear));
    const r = lerp(55, 1560, e), lw = lerp(20, 200, e);
    splitBg(ctx, t);
    ctx.save(); ctx.beginPath(); ctx.arc(W / 2, WY - WSIZE * .36, Math.max(0, r - lw / 2), 0, TAU); ctx.clip();
    goldenWorld(ctx, t, lerp(1.3, 1.0, e) + .4 * push);
    // logo
    const la = R(t, 15.15, 15.45, E.outQuart);
    if (la > 0) {
      const lw2 = 700, lh = lw2 * 649 / 1270, buf = K.offscreen('b:logo', lw2 + 40, lh + 40), g = buf.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, buf.width, buf.height); g.globalCompositeOperation = 'source-over';
      K.logo(g, buf.width / 2, buf.height / 2, lw2, { ink: '#FFFFFF', gold: '#FFF0CC' });
      const sh = R(t, 15.3, 15.8, E.inOutCubic);
      if (sh > 0 && sh < 1) {
        g.globalCompositeOperation = 'source-atop'; const x = lerp(-200, buf.width + 200, sh);
        const gr = g.createLinearGradient(x - 120, 0, x + 120, 0); gr.addColorStop(0, 'rgba(255,214,140,0)'); gr.addColorStop(.5, 'rgba(255,214,140,.9)'); gr.addColorStop(1, 'rgba(255,214,140,0)');
        g.fillStyle = gr; g.fillRect(0, 0, buf.width, buf.height); g.globalCompositeOperation = 'source-over';
      }
      const s = (1.1 - .1 * la) * (1 + 1.3 * push), blur = (1 - la) * 14 + push * 6;
      ctx.save(); ctx.globalAlpha = la * (1 - R(t, 15.78, 16.0, E.inQuad));
      ctx.shadowColor = 'rgba(120,50,50,.42)'; ctx.shadowBlur = 36; ctx.shadowOffsetY = 10;
      if (blur > .3) ctx.filter = `blur(${blur.toFixed(1)}px)`;
      ctx.translate(W / 2, 520); ctx.scale(s, s); ctx.drawImage(buf, -buf.width / 2, -buf.height / 2); ctx.restore();
    }
    ctx.restore();
    // ring + shockwave
    if (e < 1) {
      goldRing(ctx, W / 2, WY - WSIZE * .36, r, lw, t * 2.4, 1 - R(t, 15.25, 15.5, E.linear));
      ctx.save(); ctx.globalAlpha = (1 - e) * .8; ctx.lineWidth = 3; ctx.strokeStyle = '#fff';
      ctx.beginPath(); ctx.arc(W / 2, WY - WSIZE * .36, r * 1.18 + 20, 0, TAU); ctx.stroke(); ctx.restore();
    }
    K.fade(ctx, .35 * (1 - R(t, 15.0, 15.2, E.outQuad)), '#FFF6E6');
  }
  K.addScene({
    name: 'b_brand', start: 15.0, end: 16.0, draw(ctx, t) {
      const amt = .1 * (1 - R(t, 15.0, 15.35, E.outQuad)) + .22 * E.inQuad(R(t, 15.65, 16.0, E.linear));
      K.zoomBlur(ctx, amt, g => drawBrand(g, t), W / 2, 520);
    },
  });

  // ═════════════ 6+7 · PHONE (16.0–25.0) ═════════════
  function phoneState(t) {
    const e = R(t, 16.0, 16.6, E.outExpo);
    const rp = t < 22 ? 0 : K.spring(t - 22, 1.4, .75);
    const [dx, dy] = K.float(t, 4, 7, .5);
    const land = t >= 22.24;
    const rotBody = (1 - e) * .07 - Math.PI / 2 * rp;
    return {
      x: lerp(1190, 960, rp) + dx, y: lerp(548 + (1 - e) * 200, 592, rp) + dy, h: lerp(990, 1320, rp),
      yaw: lerp(-0.09 - (1 - e) * .38 + .025 * Math.sin(t * .8), .012 * Math.sin(t * .8), cl(rp)),
      land, rot: land ? rotBody + Math.PI / 2 : rotBody, rp, e,
    };
  }
  function mapPt(ps, u, v) {
    const k = ps.h / 880, sW = 390 * k, sH = 840 * k; let lx, ly;
    if (!ps.land) { lx = -sW / 2 + u / 390 * sW; ly = -sH / 2 + v / 844 * sH; }
    else { const U = u / 844 * sH, V = v / 390 * sW; lx = sW / 2 - V; ly = -sH / 2 + U; }
    const a = Math.cos(ps.yaw * .9), b = Math.sin(ps.yaw) * .12, X = a * lx, Y = b * lx + ly;
    const r = ps.rot + (ps.land ? -Math.PI / 2 : 0), c = Math.cos(r), s = Math.sin(r);
    return [ps.x + c * X - s * Y, ps.y + s * X + c * Y];
  }
  function camera(t) {
    const push = R(t, 16.85, 17.4, E.inOutCubic) * (1 - R(t, 18.5, 19.0, E.inOutCubic));
    const s = 1 + .075 * push + .03 * R(t, 16.3, 22, E.inOutSine) * (1 - R(t, 22, 22.5, E.inOutCubic));
    return { s, fx: 1190, fy: lerp(560, 840, push) };
  }

  // ── painted florist thumbnails ──
  function thumb(i) {
    return K.cache('b:thumb' + i, 200, 200, (g) => {
      const r = K.rng(31 + i * 17);
      const bgs = [['#FBE3E6', '#F9D7C2'], ['#F3E6D6', '#E6D8F3'], ['#FCEBDF', '#F6C9D0']][i];
      const gr = g.createLinearGradient(0, 0, 200, 200); gr.addColorStop(0, bgs[0]); gr.addColorStop(1, bgs[1]); g.fillStyle = gr; g.fillRect(0, 0, 200, 200);
      for (let k = 0; k < 9; k++) { g.save(); g.translate(r() * 200, r() * 200); g.rotate(r() * TAU); g.beginPath(); g.ellipse(0, 0, 12, 34, 0, 0, TAU); g.fillStyle = ['#A9CDA9', '#8DBF95', '#BFD8C2'][k % 3]; g.globalAlpha = .85; g.fill(); g.restore(); }
      const pal = [['#F59AB0', '#E07A93'], ['#FFFFFF', '#F3DDB8'], ['#FAD7C3', '#F2A07E'], ['#D9CCF5', '#B9A6F0'], ['#F6C9D0', '#E88FA5']];
      for (let k = 0; k < 8; k++) {
        const x = 20 + r() * 160, y = 20 + r() * 160, s = 18 + r() * 22, [c0, c1] = pal[(k + i) % pal.length];
        for (let p = 0; p < 6; p++) {
          g.save(); g.translate(x, y); g.rotate(p / 6 * TAU + k); g.beginPath(); g.ellipse(0, -s * .55, s * .42, s * .6, 0, 0, TAU);
          const pg = g.createRadialGradient(0, -s * .2, 1, 0, -s * .5, s * .8); pg.addColorStop(0, c0); pg.addColorStop(1, c1); g.fillStyle = pg; g.fill(); g.restore();
        }
        g.beginPath(); g.arc(x, y, s * .28, 0, TAU); g.fillStyle = '#E6C27A'; g.fill();
      }
      const sh = g.createLinearGradient(0, 0, 0, 200); sh.addColorStop(0, 'rgba(255,255,255,.15)'); sh.addColorStop(1, 'rgba(60,20,50,.12)'); g.fillStyle = sh; g.fillRect(0, 0, 200, 200);
    });
  }
  function star(g, x, y, r, col) { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r * .45 : r; g.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); } g.closePath(); g.fillStyle = col; g.fill(); }
  function goldGrad(g, x0, y0, x1, y1) { const gr = g.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, '#E6C27A'); gr.addColorStop(1, '#E07A93'); return gr; }

  // ── HOME ──
  function drawHome(g, t) {
    const lt = t - 16.0;
    g.fillStyle = '#FBF7F2'; g.fillRect(0, 0, 390, 844);
    K.blob(g, C.blush, 340, 40, 260, 190, .5); K.blob(g, C.champagne, 60, 110, 240, 170, .45);
    UI.statusBar(g);
    const blk = (i, fn) => { const a = R(lt, i * .05, .5 + i * .05, E.outQuart); if (a <= 0) return; g.save(); g.globalAlpha *= a; g.translate(0, (1 - a) * 28); fn(); g.restore(); };
    blk(0, () => {
      txt(g, 'Good morning', 24, 80, 15, 500, C.ink2); txt(g, 'Sophie & James', 24, 112, 28, 800);
      UI.avatar(g, 334, 94, 19, 'S', C.blush); g.lineWidth = 3; g.strokeStyle = '#FBF7F2'; g.beginPath(); g.arc(356, 94, 19, 0, TAU); g.stroke(); UI.avatar(g, 356, 94, 19, 'J', C.lilac);
    });
    blk(1, () => {
      const gr = g.createLinearGradient(20, 132, 370, 304); gr.addColorStop(0, '#FFF3E3'); gr.addColorStop(1, '#FBE0E6');
      UI.card(g, 20, 132, 350, 172, 26, { fill: gr });
      tracked(g, 'COUNTDOWN', 40, 166, 11, 600, C.gold, 2);
      txt(g, '142', 36, 226, 58, 800); txt(g, 'days to go', 40, 252, 16, 600, C.ink2);
      K.icon(g, 'calendar', 47, 277, 14, C.ink3, 2); txt(g, 'Saturday 14 June', 60, 282, 13, 500, C.ink2);
      const prog = .68 * E.outCubic(R(lt, .3, 1.3, E.linear));
      UI.ring(g, 292, 216, 46, prog, goldGrad(g, 246, 170, 338, 262), 11, 'rgba(184,138,62,.14)');
      txt(g, Math.round(prog * 100) + '%', 292, 221, 21, 800, C.ink, 'center'); txt(g, 'planned', 292, 238, 11, 600, C.ink2, 'center');
    });
    blk(2, () => {
      const pr = K.pulse(t, TAP.search - .06, TAP.search + .14);
      g.save(); g.translate(195, 349); g.scale(1 - .025 * pr, 1 - .025 * pr); g.translate(-195, -349);
      UI.card(g, 20, 322, 350, 54, 27, { fill: pr > 0 ? `rgba(${255 - 8 * pr},${255 - 12 * pr},255,1)` : '#fff' });
      K.icon(g, 'sparkle', 48, 349, 20, C.gold, 2); txt(g, 'Ask your planner...', 70, 354, 15, 500, C.ink3);
      g.beginPath(); g.arc(344, 349, 17, 0, TAU); g.fillStyle = goldGrad(g, 327, 332, 361, 366); g.fill(); K.icon(g, 'send', 344, 349, 16, '#fff', 2.4);
      g.restore();
    });
    blk(3, () => { txt(g, 'Your plan', 24, 412, 18, 800); txt(g, 'See all', 366, 412, 13, 700, C.rose, 'right'); });
    blk(4, () => {
      UI.card(g, 20, 428, 169, 130, 22);
      g.beginPath(); g.arc(46, 456, 16, 0, TAU); g.fillStyle = '#EFE9FB'; g.fill(); K.icon(g, 'guests', 46, 456, 18, '#7B62C9', 2);
      txt(g, 'Guests', 70, 461, 13, 600, C.ink2); txt(g, '124', 34, 512, 32, 800);
      UI.pill(g, '87 attending', 34, 537, { bg: '#E3F5EA', fg: '#2F7A52', size: 11, h: 22, padX: 10 });
      UI.card(g, 201, 428, 169, 130, 22);
      g.beginPath(); g.arc(227, 456, 16, 0, TAU); g.fillStyle = '#FDEDE3'; g.fill(); K.icon(g, 'pound', 227, 456, 18, '#C9784A', 2);
      txt(g, 'Budget', 251, 461, 13, 600, C.ink2); txt(g, '£18.4k', 215, 510, 28, 800);
      UI.bar(g, 215, 524, 141, 8, .77 * E.outCubic(R(lt, .5, 1.3, E.linear)), goldGrad(g, 215, 0, 356, 0)); txt(g, 'of £24,000', 215, 548, 11, 600, C.ink3);
    });
    blk(5, () => {
      UI.card(g, 20, 572, 350, 96, 22);
      g.beginPath(); g.arc(46, 600, 16, 0, TAU); g.fillStyle = '#E8F3EA'; g.fill(); K.icon(g, 'flower', 46, 600, 18, '#5E9C6C', 2);
      txt(g, 'Suppliers', 70, 605, 13, 600, C.ink2); txt(g, '6 of 9 booked', 34, 648, 20, 800);
      [['FL', C.blush], ['PH', C.lilac], ['CK', C.champagne], ['DJ', C.sage]].forEach(([s, c], i) => {
        const x = 258 + i * 24; g.beginPath(); g.arc(x, 628, 18, 0, TAU); g.fillStyle = '#fff'; g.fill(); UI.avatar(g, x, 628, 16, s, c);
      });
    });
    blk(6, () => {
      UI.card(g, 20, 682, 350, 66, 22);
      g.beginPath(); g.arc(50, 715, 18, 0, TAU); g.fillStyle = '#FCE8EE'; g.fill(); K.icon(g, 'cake', 50, 715, 18, C.rose, 2);
      txt(g, 'Cake tasting', 78, 711, 15, 700); txt(g, 'Thursday · 2:00 pm', 78, 730, 12, 500, C.ink2);
      g.lineWidth = 2; g.strokeStyle = C.ink3; g.lineCap = 'round'; g.beginPath(); g.moveTo(346, 709); g.lineTo(352, 715); g.lineTo(346, 721); g.stroke();
    });
    UI.tabBar(g, 0);
  }

  // ── KEYBOARD ──
  let _keys = null;
  function keys() {
    if (_keys) return _keys; const out = [], kw = 33.3, gp = 5, x0 = 6;
    'qwertyuiop'.split('').forEach((k, i) => out.push({ k, x: x0 + i * (kw + gp), y: 10, w: kw }));
    'asdfghjkl'.split('').forEach((k, i) => out.push({ k, x: x0 + (kw + gp) / 2 + i * (kw + gp), y: 64, w: kw }));
    out.push({ k: 'shift', x: x0, y: 118, w: 44, sp: 1 });
    'zxcvbnm'.split('').forEach((k, i) => out.push({ k, x: x0 + 1.5 * (kw + gp) + i * (kw + gp), y: 118, w: kw }));
    out.push({ k: 'del', x: 390 - x0 - 44, y: 118, w: 44, sp: 1 });
    out.push({ k: '123', x: x0, y: 172, w: 86, sp: 1 }, { k: 'space', x: x0 + 91, y: 172, w: 196 }, { k: 'return', x: x0 + 292, y: 172, w: 86, sp: 1 });
    return (_keys = out);
  }
  function keyFor(ch) { if (ch === ' ') return 'space'; const l = ch.toLowerCase(); return /[a-z]/.test(l) ? l : '123'; }
  function drawKeyboard(g, top, t) {
    g.fillStyle = '#ECE7F0'; g.fillRect(0, top, 390, 300);
    const n = typedN(t), last = n > 0 ? TY.t0 + (n - 1) * TY.dt : -9, act = (t - last < .1 && t < TAP.send) ? keyFor(TY.text[n - 1]) : null;
    let pop = null;
    keys().forEach(k => {
      const on = act === k.k;
      g.fillStyle = 'rgba(60,40,80,.18)'; rr(g, k.x, top + k.y + 1.2, k.w, 44, 7); g.fill();
      g.fillStyle = on && k.k.length > 1 ? '#D8D1E0' : k.sp ? '#D9D2E1' : '#FFFFFF'; rr(g, k.x, top + k.y, k.w, 44, 7); g.fill();
      if (k.k.length === 1) txt(g, k.k, k.x + k.w / 2, top + k.y + 29, 21, 400, C.ink, 'center');
      else if (k.k === 'shift') K.icon(g, 'send', k.x + k.w / 2, top + k.y + 22, 18, C.ink, 1.8);
      else if (k.k === 'del') { g.lineWidth = 1.8; g.strokeStyle = C.ink; g.beginPath(); const x = k.x + 12, y = top + k.y + 22; g.moveTo(x, y); g.lineTo(x + 6, y - 7); g.lineTo(x + 22, y - 7); g.lineTo(x + 22, y + 7); g.lineTo(x + 6, y + 7); g.closePath(); g.stroke(); }
      else txt(g, k.k, k.x + k.w / 2, top + k.y + 27, 15, 500, C.ink, 'center');
      if (on && k.k.length === 1) pop = k;
    });
    if (pop) {
      const x = pop.x - 7, w = pop.w + 14, y = top + pop.y - 58;
      g.save(); g.shadowColor = 'rgba(40,20,60,.25)'; g.shadowBlur = 10; g.shadowOffsetY = 2; rr(g, x, y, w, 102, 10); g.fillStyle = '#fff'; g.fill(); g.restore();
      txt(g, pop.k, x + w / 2, y + 40, 32, 400, C.ink, 'center');
    }
    rr(g, 128, top + 280, 134, 5, 3); g.fillStyle = C.ink; g.fill();
  }
  function typedN(t) { return cl(Math.floor((t - TY.t0) / TY.dt) + 1, 0, TY.text.length); }

  // ── PLANNER SHEET ──
  function drawSheet(g, t) {
    // content coords assume sheet top at 50
    g.fillStyle = '#FFFDFB'; rr(g, 0, 50, 390, 820, [24, 24, 0, 0]); g.fill();
    K.blob(g, C.lilac, 330, 120, 220, 140, .35);
    rr(g, 175, 58, 40, 5, 3); g.fillStyle = '#DDD5E4'; g.fill();
    g.beginPath(); g.arc(42, 98, 18, 0, TAU); g.fillStyle = goldGrad(g, 24, 80, 60, 116); g.fill(); K.icon(g, 'sparkle', 42, 98, 18, '#fff', 2);
    txt(g, 'Planner', 70, 96, 18, 800); txt(g, 'Your wedding assistant', 70, 114, 12, 500, C.ink2);
    g.beginPath(); g.arc(348, 97, 15, 0, TAU); g.fillStyle = '#F3EFF6'; g.fill();
    g.lineWidth = 2; g.strokeStyle = C.ink2; g.lineCap = 'round'; g.beginPath(); g.moveTo(343, 92); g.lineTo(353, 102); g.moveTo(353, 92); g.lineTo(343, 102); g.stroke();
    // greeting
    rr(g, 20, 134, 292, 62, [18, 18, 18, 6]); g.fillStyle = '#F4EFFA'; g.fill();
    txt(g, 'Hi Sophie! What would you like', 36, 160, 15, 500); txt(g, 'to plan today?', 36, 182, 15, 500);
    // suggestion chips
    const chA = 1 - R(t, TAP.send, TAP.send + .12, E.linear);
    if (chA > 0) {
      g.save(); g.globalAlpha *= chA; let x = 20;
      ['Venues near Bath', 'Cake tastings', 'Band ideas'].forEach(s => { font(g, 13, 600); const w = g.measureText(s).width + 26; rr(g, x, 212, w, 32, 16); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 1.2; g.strokeStyle = 'rgba(184,138,62,.45)'; g.stroke(); txt(g, s, x + 13, 233, 13, 600, C.ink2); x += w + 8; });
      g.restore();
    }
    const kb = R(t, 16.92, 17.14, E.outQuart) * (1 - R(t, 18.54, 18.8, E.inOutCubic));
    const barY = lerp(752, 496, kb);
    // user bubble after send
    if (t >= TAP.send) {
      const ub = R(t, TAP.send, TAP.send + .3, E.outQuart);
      const l1 = 'Find a florist in Bath', l2 = 'under £1,500'; font(g, 15, 600); const w = Math.max(g.measureText(l1).width, g.measureText(l2).width) + 32;
      const y = lerp(barY, 212, ub), x = 370 - w, s = lerp(.85, 1, ub);
      g.save(); g.globalAlpha *= R(t, TAP.send, TAP.send + .06, E.linear); g.translate(370, y + 56); g.scale(s, s); g.translate(-370, -(y + 56));
      rr(g, x, y, w, 56, [18, 18, 6, 18]); const gr = g.createLinearGradient(x, y, x + w, y + 56); gr.addColorStop(0, '#3A2656'); gr.addColorStop(1, '#5E4180'); g.fillStyle = gr; g.fill();
      txt(g, l1, x + 16, y + 24, 15, 600, '#fff'); txt(g, l2, x + 16, y + 44, 15, 600, '#fff');
      g.restore();
      txt(g, 'Delivered', 366, 286, 10, 600, C.ink3, 'right');
    }
    // typing dots
    const dA = R(t, 18.62, 18.66, E.linear) * (1 - R(t, 18.76, 18.8, E.linear));
    if (dA > 0) {
      g.save(); g.globalAlpha *= dA; rr(g, 20, 296, 64, 34, 17); g.fillStyle = '#F4EFFA'; g.fill();
      for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(38 + i * 14, 313 - Math.max(0, Math.sin(t * 18 - i * 1.2)) * 4, 4, 0, TAU); g.fillStyle = C.ink3; g.fill(); }
      g.restore();
    }
    // reply + result cards
    const rA = R(t, 18.75, 18.95);
    if (rA > 0) { g.save(); g.globalAlpha *= rA; K.icon(g, 'sparkle', 30, 302, 14, C.gold, 2); txt(g, '3 florists in Bath under £1,500', 44, 307, 13, 700, C.ink2); g.restore(); }
    const FLO = [
      { n: 'Wildflower & Co.', d: 'Bath · 1.2 mi', r: '4.9', c: '(212)', p: '£1,200' },
      { n: 'Petal & Stem', d: 'Bath · 2.4 mi', r: '4.8', c: '(168)', p: '£1,350' },
      { n: 'The Bloom Room', d: 'Widcombe · 1.8 mi', r: '4.9', c: '(96)', p: '£1,450' },
    ];
    FLO.forEach((f, i) => {
      const ci = R(t, CARD_T[i], CARD_T[i] + .5, E.outExpo); if (ci <= 0) return;
      const y = 320 + i * 132;
      g.save(); g.globalAlpha *= cl(ci * 1.6); g.translate((1 - ci) * 90, 0); g.translate(195, y + 62); g.scale(.95 + .05 * ci, .95 + .05 * ci); g.translate(-195, -(y + 62));
      const booked = i === 0 ? R(t, TAP.book + .05, TAP.book + .3, E.outQuart) : 0;
      UI.card(g, 16, y, 358, 122, 22, { stroke: booked > 0 ? `rgba(79,180,127,${.6 * booked})` : undefined });
      g.save(); rr(g, 28, y + 11, 100, 100, 16); g.clip(); g.drawImage(thumb(i), 28, y + 11, 100, 100); g.restore();
      txt(g, f.n, 142, y + 33, 16, 800);
      K.icon(g, 'pin', 149, y + 49, 13, C.ink3, 2); txt(g, f.d, 159, y + 53, 12, 500, C.ink2);
      star(g, 148, y + 72, 6.5, C.gold); txt(g, f.r, 159, y + 77, 13, 700); font(g, 13, 700); const rw = g.measureText(f.r).width; txt(g, f.c, 163 + rw, y + 77, 12, 500, C.ink3);
      UI.pill(g, f.p, 142, y + 101, { bg: '#FBF1DF', fg: '#8A6420', size: 12, h: 26, padX: 11, weight: 700 });
      K.heartPath(g, 352, y + 27, 18); g.lineWidth = 1.8; g.strokeStyle = C.ink3; g.stroke();
      if (i === 0) {
        const pr = K.pulse(t, TAP.book - .06, TAP.book + .1), s = 1 - .06 * pr;
        g.save(); g.translate(309, y + 102); g.scale(s, s); g.translate(-309, -(y + 102));
        if (booked <= 0) UI.button(g, 'Book a call', 256, y + 86, 106, 32, { size: 13, bg: C.ink });
        else {
          rr(g, 256, y + 86, 106, 32, 16); g.fillStyle = `rgb(${lerp(42, 79, booked)},${lerp(27, 180, booked)},${lerp(61, 127, booked)})`; g.fill();
          UI.check(g, 276, y + 102, 8, R(t, TAP.book + .12, TAP.book + .35, E.outCubic), 'rgba(255,255,255,.28)');
          txt(g, 'Booked', 316, y + 107, 13, 700, '#fff', 'center');
        }
        g.restore();
        // sparkle burst
        const bp = R(t, TAP.book + .05, TAP.book + .5, E.outCubic);
        if (bp > 0 && bp < 1) for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + .3, d = 30 + 34 * bp; g.globalAlpha = (1 - bp); g.beginPath(); g.arc(309 + Math.cos(a) * d * 1.4, y + 102 + Math.sin(a) * d, 3 * (1 - bp) + 1, 0, TAU); g.fillStyle = [C.gold, C.rose, C.mint, C.lavender][k % 4]; g.fill(); }
      } else { rr(g, 300, y + 86, 62, 32, 16); g.lineWidth = 1.4; g.strokeStyle = 'rgba(42,27,61,.18)'; g.stroke(); txt(g, 'View', 331, y + 107, 13, 700, C.ink, 'center'); }
      g.restore();
    });
    // input bar
    g.save(); g.shadowColor = 'rgba(60,30,90,.10)'; g.shadowBlur = 16; g.shadowOffsetY = 4; rr(g, 12, barY, 366, 48, 24); g.fillStyle = '#fff'; g.fill(); g.restore();
    rr(g, 12, barY, 366, 48, 24); g.lineWidth = 1; g.strokeStyle = 'rgba(42,27,61,.10)'; g.stroke();
    g.beginPath(); g.arc(36, barY + 24, 14, 0, TAU); g.fillStyle = '#F3EFF6'; g.fill(); K.icon(g, 'plus', 36, barY + 24, 16, C.ink2, 2);
    const n = t < TAP.send ? typedN(t) : 0, s = TY.text.slice(0, n);
    g.save(); g.beginPath(); g.rect(58, barY, 266, 48); g.clip();
    if (n === 0) txt(g, 'Message your planner...', 60, barY + 29, 15, 500, C.ink3);
    else { font(g, 15, 500); const w = g.measureText(s).width, sh = Math.max(0, w - 252); txt(g, s, 60 - sh, barY + 29, 15, 500, C.ink); if (t > 16.9) { if (t - (TY.t0 + (n - 1) * TY.dt) < .3 || Math.floor(t * 2.4) % 2 === 0) { g.fillStyle = C.rose; g.fillRect(62 - sh + w, barY + 13, 2, 21); } } }
    if (n === 0 && t > 16.95 && t < TAP.send && Math.floor(t * 2.4) % 2 === 0) { g.fillStyle = C.rose; g.fillRect(60, barY + 13, 2, 21); }
    g.restore();
    const has = n > 0, sp = K.pulse(t, TAP.send - .06, TAP.send + .1);
    g.save(); g.translate(352, barY + 24); g.scale(1 - .12 * sp, 1 - .12 * sp);
    g.beginPath(); g.arc(0, 0, 17, 0, TAU); g.fillStyle = has ? goldGrad(g, -17, -17, 17, 17) : '#EFE9F3'; g.fill(); K.icon(g, 'send', 0, 0, 16, has ? '#fff' : C.ink3, 2.4);
    g.restore();
    return kb;
  }
  function drawToast(g, t) {
    if (t < TAP.book + .1) return;
    const y = lerp(-80, 56, K.spring(t - (TAP.book + .12), 2.2, .62));
    g.save(); g.shadowColor = 'rgba(60,30,90,.16)'; g.shadowBlur = 20; g.shadowOffsetY = 6; rr(g, 18, y, 354, 58, 20); g.fillStyle = 'rgba(255,255,255,.97)'; g.fill(); g.restore();
    UI.check(g, 46, y + 29, 13, R(t, TAP.book + .2, TAP.book + .45, E.outCubic), '#4FB47F');
    txt(g, 'Call booked', 70, y + 25, 14, 800); txt(g, 'Wildflower & Co. · Thu 10:00 am', 70, y + 43, 12, 500, C.ink2);
  }

  // ── BUDGET ──
  const CATS = [['Venue', 8500, 9000, '#B9A6F0'], ['Catering', 5200, 6000, '#F2B38F'], ['Flowers', 1200, 1500, '#E07A93'], ['Photography', 2300, 2500, '#8FB8E0'], ['Dress', 1200, 2000, '#8CC29A']];
  function drawBudget(g, t) {
    g.fillStyle = '#FBF7F2'; g.fillRect(0, 0, 390, 844); K.blob(g, C.champagne, 320, 60, 240, 160, .5);
    UI.statusBar(g);
    txt(g, 'Budget', 24, 96, 30, 800); txt(g, '14 June · 142 days to go', 24, 120, 13, 500, C.ink2);
    g.beginPath(); g.arc(346, 88, 18, 0, TAU); g.fillStyle = C.ink; g.fill(); K.icon(g, 'plus', 346, 88, 16, '#fff', 2.2);
    // summary card
    g.save(); rr(g, 20, 140, 350, 176, 26); const gr = g.createLinearGradient(20, 140, 370, 316); gr.addColorStop(0, '#2A1B3D'); gr.addColorStop(1, '#553A78'); g.fillStyle = gr; g.fill(); g.clip();
    K.blob(g, C.gold2, 360, 150, 170, 130, .5); K.blob(g, C.rose, 60, 330, 170, 90, .35); g.restore();
    const cp = E.outCubic(R(t, 20.85, 21.6, E.linear)), v = Math.round(18400 * cp / 10) * 10;
    txt(g, 'Spent so far', 40, 176, 13, 600, 'rgba(255,255,255,.7)');
    const aw = txt(g, '£' + v.toLocaleString('en-GB'), 40, 226, 40, 800, '#fff'); txt(g, 'of £24,000', 50 + aw, 226, 15, 500, 'rgba(255,255,255,.7)');
    UI.bar(g, 40, 248, 310, 10, .767 * cp, goldGrad(g, 40, 0, 350, 0), 'rgba(255,255,255,.14)');
    txt(g, '£' + (24000 - v).toLocaleString('en-GB') + ' left', 40, 290, 13, 600, '#fff'); txt(g, Math.round(76.7 * cp) + '% used', 350, 290, 13, 700, C.gold2, 'right');
    // chart
    UI.card(g, 20, 330, 350, 170, 24);
    txt(g, 'By category', 36, 360, 14, 800); UI.pill(g, 'June', 354, 355, { align: 'right', size: 11, h: 22, bg: '#F6F1EC', fg: C.ink2 });
    CATS.forEach(([n, a, , col], i) => {
      const x = 46 + i * 64, bh = 78 * a / 8500 * E.outBack(R(t, 20.95 + i * .07, 21.45 + i * .07, E.linear), 1.6);
      if (bh > 0) { rr(g, x, 468 - bh, 34, bh, [10, 10, 4, 4]); const bg = g.createLinearGradient(0, 468 - bh, 0, 468); bg.addColorStop(0, col); bg.addColorStop(1, col + '99'); g.fillStyle = bg; g.fill(); }
      const la = R(t, 21.25 + i * .07, 21.45 + i * .07); if (la > 0) { g.save(); g.globalAlpha *= la; txt(g, '£' + (a / 1000).toFixed(1) + 'k', x + 17, 460 - bh, 10, 700, C.ink, 'center'); g.restore(); }
      txt(g, n === 'Photography' ? 'Photo' : n === 'Catering' ? 'Food' : n, x + 17, 486, 10, 600, C.ink2, 'center');
    });
    // rows
    CATS.forEach(([n, a, cap, col], i) => {
      const ra = R(t, 21.0 + i * .06, 21.4 + i * .06); if (ra <= 0) return; const y = 512 + i * 48;
      g.save(); g.globalAlpha *= ra; g.translate(0, (1 - ra) * 16);
      g.beginPath(); g.arc(34, y + 20, 5, 0, TAU); g.fillStyle = col; g.fill();
      const nw = txt(g, n, 48, y + 25, 15, 700);
      if (n === 'Flowers') UI.pill(g, 'New', 56 + nw, y + 20, { size: 10, h: 18, padX: 7, bg: '#FCE3EA', fg: C.rose, weight: 700 });
      txt(g, '£' + a.toLocaleString('en-GB'), 356, y + 25, 15, 800, C.ink, 'right');
      UI.bar(g, 48, y + 34, 308, 5, a / cap * E.outCubic(R(t, 21.1 + i * .06, 21.7 + i * .06, E.linear)), col, '#EFE8EF');
      g.restore();
    });
    UI.tabBar(g, 2);
  }

  function screenP(g, t) {
    const swp = R(t, SWIPE.a, SWIPE.b + .12, E.outQuart);
    if (swp < 1) {
      g.save(); g.translate(-390 * swp, 0);
      const sp = R(t, 16.8, 17.12, E.outQuart);
      if (sp > 0) { g.fillStyle = '#1B1224'; g.fillRect(0, 0, 390, 844); }
      g.save(); if (sp > 0) { const s = 1 - .07 * sp; g.translate(195, 30 * sp); g.scale(s, s); g.translate(-195, 0); rr(g, 0, 0, 390, 844, 34 * sp); g.clip(); }
      drawHome(g, t); if (sp > 0) { g.fillStyle = `rgba(27,18,36,${.22 * sp})`; g.fillRect(0, 0, 390, 844); } g.restore();
      if (sp > 0) {
        const sy = lerp(844, 50, sp); g.save(); g.translate(0, sy - 50); drawSheet(g, t); g.restore();
        const kb = R(t, 16.92, 17.14, E.outQuart) * (1 - R(t, 18.54, 18.8, E.inOutCubic));
        if (kb > 0) drawKeyboard(g, 844 - 290 * kb, t); else { rr(g, 128, 832, 134, 5, 3); g.fillStyle = C.ink; g.fill(); }
        drawToast(g, t);
      }
      g.restore();
    }
    if (swp > 0) {
      g.save(); g.translate(390 * (1 - swp), 0);
      g.fillStyle = 'rgba(40,20,60,.12)'; g.fillRect(-12, 0, 12, 844);
      drawBudget(g, t); g.restore();
    }
    const blank = R(t, 22.06, 22.22, E.linear); if (blank > 0) { g.fillStyle = `rgba(251,247,242,${blank})`; g.fillRect(0, 0, 390, 844); }
  }

  // ── SEATING (landscape 844×390) ──
  const CHIPS = [
    { n: 'Tom & Priya', i: 'TP', c: C.lilac, s: 'Friends · 2 guests', seats: 2 },
    { n: 'Grandma June', i: 'GJ', c: C.peach, s: "Bride's family", seats: 1 },
    { n: 'Uncle Gary', i: 'UG', c: C.sage, s: "Groom's family", seats: 1 },
    { n: 'Mia Chen', i: 'MC', c: C.blush, s: 'Work friends', seats: 1 },
    { n: 'Oliver Hart', i: 'OH', c: C.sky, s: 'University', seats: 1 },
  ];
  const TABLES = [{ n: 4, x: 345, y: 160, f: 5 }, { n: 5, x: 505, y: 160, f: 6 }, { n: 6, x: 665, y: 160, f: 8 }, { n: 7, x: 425, y: 298, f: 7 }, { n: 8, x: 585, y: 298, f: 4 }, { n: 9, x: 745, y: 298, f: 7 }];
  const SEATC = ['#D9CCF5', '#FAD7C3', '#F6C9D0', '#BFD8C2', '#F3DDB8', '#CFE3F5'];
  const GRAB = [76, 120];
  function chipDraw(g, ch, x, y, lift = 0) {
    g.save();
    if (lift > 0) { g.shadowColor = `rgba(60,30,90,${.28 * lift})`; g.shadowBlur = 20 * lift; g.shadowOffsetY = 10 * lift; }
    rr(g, x, y, 180, 40, 20); g.fillStyle = '#fff'; g.fill(); g.restore();
    rr(g, x, y, 180, 40, 20); g.lineWidth = 1; g.strokeStyle = lift > 0 ? `rgba(224,122,147,${.6 * lift})` : 'rgba(42,27,61,.09)'; g.stroke();
    UI.avatar(g, x + 20, y + 20, 13, ch.i, ch.c);
    txt(g, ch.n, x + 40, y + 18, 13, 700); txt(g, ch.s, x + 40, y + 32, 10, 500, C.ink3);
    g.fillStyle = C.ink3; for (let a = 0; a < 2; a++) for (let b = 0; b < 3; b++) { g.beginPath(); g.arc(x + 162 + a * 6, y + 14 + b * 6, 1.4, 0, TAU); g.fill(); }
  }
  function curL(t) {
    const segs = []; let prev = [620, 400], pt = 22.5;
    DRAGS.forEach(d => {
      const tb = TABLES[d.table];
      segs.push([pt, d.pick - .02, prev, GRAB, E.inOutCubic, 0]);
      segs.push([d.pick, d.drop, GRAB, [tb.x, tb.y], E.inOutCubic, 1]);
      prev = [tb.x, tb.y]; pt = d.drop + .06;
    });
    segs.push([pt, 24.4, prev, [800, 372], E.inOutCubic, 0]);
    let x = 620, y = 400, drag = 0;
    for (const [a, b, p0, p1, e, dr] of segs) {
      if (t < a) break; const p = e(cl((t - a) / (b - a)));
      x = lerp(p0[0], p1[0], p); y = lerp(p0[1], p1[1], p) - (dr ? Math.sin(Math.PI * p) * 36 : 0); drag = dr && t <= b ? 1 : 0;
    }
    let press = drag ? 1 : 0, ripple = null;
    DRAGS.forEach(d => { press = Math.max(press, K.pulse(t, d.pick - .08, d.pick + .02) * (t < d.pick ? 1 : 0)); if (t >= d.pick && t < d.pick + .4) ripple = (t - d.pick) / .4; });
    return { x, y, press, ripple, alpha: R(t, 22.5, 22.62, E.linear) * (1 - R(t, 24.25, 24.4, E.linear)) };
  }
  function drawSeating(g, t) {
    g.fillStyle = '#FBF7F2'; g.fillRect(0, 0, 844, 390);
    g.fillStyle = 'rgba(42,27,61,.06)'; for (let x = 262; x < 844; x += 22) for (let y = 78; y < 390; y += 22) g.fillRect(x, y, 2, 2);
    K.blob(g, C.blush, 800, 30, 200, 120, .35);
    // header
    txt(g, 'Seating plan', 272, 38, 18, 800); txt(g, 'The Orangery · 124 guests', 272, 57, 12, 500, C.ink2);
    rr(g, 700, 22, 124, 28, 14); g.fillStyle = '#F1ECF7'; g.fill(); rr(g, 702, 24, 60, 24, 12); g.fillStyle = '#fff'; g.fill();
    txt(g, 'Tables', 732, 40, 11, 700, C.ink, 'center'); txt(g, 'Floor', 793, 40, 11, 600, C.ink2, 'center');
    // tables
    TABLES.forEach((tb, ti) => {
      const adds = []; let f = tb.f;
      DRAGS.forEach(d => { if (d.table === ti) { for (let k = 0; k < CHIPS[d.chip].seats; k++) adds.push({ j: f + k, t0: d.drop + .06 + k * .06, c: CHIPS[d.chip].c, ini: CHIPS[d.chip].i[k] || 'P' }); f += CHIPS[d.chip].seats; } });
      const d = DRAGS.find(q => q.table === ti);
      const glow = d ? R(t, lerp(d.pick, d.drop, .5), d.drop - .02, E.outQuad) * (1 - R(t, d.drop, d.drop + .3, E.linear)) : 0;
      const bump = d ? 1 + .08 * K.pulse(t, d.drop, d.drop + .3) : 1;
      g.save(); g.translate(tb.x, tb.y); g.scale(bump, bump);
      if (glow > 0) { K.blob(g, C.rose, 0, 0, 90, 90, .45 * glow); g.lineWidth = 2; g.strokeStyle = `rgba(224,122,147,${glow})`; g.setLineDash([5, 4]); g.beginPath(); g.arc(0, 0, 60, 0, TAU); g.stroke(); g.setLineDash([]); }
      let filled = tb.f;
      for (let j = 0; j < 8; j++) {
        const a = -Math.PI / 2 + j * TAU / 8, sx = Math.cos(a) * 44, sy = Math.sin(a) * 44;
        const ad = adds.find(q => q.j === j);
        if (j < tb.f) { g.beginPath(); g.arc(sx, sy, 9, 0, TAU); g.fillStyle = SEATC[(ti * 3 + j) % SEATC.length]; g.fill(); g.lineWidth = 2; g.strokeStyle = '#fff'; g.stroke(); }
        else if (ad && t >= ad.t0) {
          filled++; const s = K.spring(t - ad.t0, 3, .45);
          g.save(); g.translate(sx, sy); g.scale(s, s); g.beginPath(); g.arc(0, 0, 10, 0, TAU); g.fillStyle = ad.c; g.fill(); g.lineWidth = 2; g.strokeStyle = '#fff'; g.stroke();
          txt(g, ad.ini, 0, 3.5, 9, 800, 'rgba(42,27,61,.8)', 'center'); g.restore();
        } else { g.beginPath(); g.arc(sx, sy, 8.5, 0, TAU); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 1.3; g.setLineDash([3, 2.5]); g.strokeStyle = '#CFC4DA'; g.stroke(); g.setLineDash([]); }
      }
      K.blob(g, '#6B4C8A', 2, 8, 40, 36, .12);
      g.beginPath(); g.arc(0, 0, 27, 0, TAU); g.fillStyle = '#fff'; g.fill();
      const full = filled >= 8;
      g.lineWidth = full ? 2.5 : 1.2; g.strokeStyle = full ? '#57B887' : 'rgba(42,27,61,.12)'; g.stroke();
      txt(g, String(tb.n), 0, 3, 17, 800, C.ink, 'center'); txt(g, filled + '/8', 0, 16, 8, 700, full ? '#3F9A6B' : C.ink3, 'center');
      g.restore();
    });
    // sidebar
    g.save(); g.shadowColor = 'rgba(60,30,90,.06)'; g.shadowBlur = 16; g.fillStyle = '#fff'; g.fillRect(0, 0, 250, 390); g.restore();
    g.fillStyle = 'rgba(42,27,61,.07)'; g.fillRect(250, 0, 1, 390);
    txt(g, 'Guests', 56, 40, 17, 800);
    let toSeat = 6; DRAGS.forEach(d => { if (t >= d.drop) toSeat -= CHIPS[d.chip].seats; });
    UI.pill(g, toSeat + ' to seat', 236, 34, { align: 'right', size: 11, h: 22, bg: '#FCE3EA', fg: C.rose, weight: 700 });
    rr(g, 56, 54, 180, 30, 15); g.fillStyle = '#F4F0F7'; g.fill(); K.icon(g, 'search', 72, 69, 13, C.ink3, 2); txt(g, 'Search guests', 84, 73, 12, 500, C.ink3);
    // list with gap closing
    CHIPS.forEach((ch, i) => {
      const d = DRAGS.find(q => q.chip === i);
      if (d && t >= d.pick) return;
      let slot = i; DRAGS.forEach(q => { if (q.chip < i) slot -= R(t, q.pick + .04, q.pick + .32, E.outQuart); });
      const pre = d ? K.pulse(t, d.pick - .08, d.pick + .02) : 0;
      g.save(); const y = 100 + slot * 48; g.translate(146, y + 20); g.scale(1 + .03 * pre, 1 + .03 * pre); g.translate(-146, -(y + 20)); chipDraw(g, ch, 56, y, pre); g.restore();
    });
    // dragged chip
    const cur = curL(t);
    DRAGS.forEach(d => {
      if (t < d.pick || t > d.drop + .18) return;
      const ch = CHIPS[d.chip], tb = TABLES[d.table];
      const q = R(t, d.drop, d.drop + .16, E.inCubic), lift = R(t, d.pick, d.pick + .1);
      const cx = lerp(cur.x, tb.x, q), cy = lerp(cur.y, tb.y, q), s = lerp(1.06, .3, q) * lerp(1, 1.06, lift) / 1.06;
      g.save(); g.globalAlpha *= 1 - q; g.translate(cx, cy); g.rotate(-.04 * lift * (1 - q)); g.scale(s, s); chipDraw(g, ch, -20, -20, lift); g.restore();
    });
  }
  function screenL(g, t) {
    const a = R(t, 22.3, 22.58, E.outCubic);
    g.fillStyle = '#FBF7F2'; g.fillRect(0, 0, 844, 390);
    if (a <= 0) return;
    g.save(); g.globalAlpha = a; g.translate(422, 195); g.scale(.96 + .04 * a, .96 + .04 * a); g.translate(-422, -195); drawSeating(g, t); g.restore();
  }

  // ── cursor (portrait) ──
  const CURP = [[16.3, 360, 790], [16.7, 200, 350], [17.0, 200, 350], [18.1, 300, 430], [18.45, 352, 520], [18.75, 352, 520], [19.45, 250, 640], [19.9, 309, 418], [20.35, 309, 418], [20.4, 340, 470], [SWIPE.press, 340, 470], [SWIPE.b, 70, 470], [21.1, 70, 470]];
  function curP(t) {
    let x = CURP[0][1], y = CURP[0][2];
    for (let i = 1; i < CURP.length; i++) { const [a, x0, y0] = CURP[i - 1], [b, x1, y1] = CURP[i]; if (t >= a) { const p = E.inOutCubic(cl((t - a) / (b - a))); x = lerp(x0, x1, p); y = lerp(y0, y1, p); } }
    const vis = [[16.3, 17.0], [18.05, 18.8], [19.4, 20.35], [20.38, 21.05]];
    let alpha = 0; vis.forEach(([a, b]) => { alpha = Math.max(alpha, R(t, a, a + .1, E.linear) * (1 - R(t, b - .1, b, E.linear)) * (t >= a && t <= b ? 1 : 0)); });
    let press = 0, ripple = null;
    [TAP.search, TAP.send, TAP.book].forEach(tp => { press = Math.max(press, K.pulse(t, tp - .07, tp + .08)); if (t >= tp && t < tp + .4) ripple = (t - tp) / .4; });
    if (t >= SWIPE.press && t <= SWIPE.b + .02) press = 1;
    return { x, y, press, ripple, alpha };
  }

  // ── captions ──
  const CAPS = [
    { a: 16.3, b: 18.45, n: '01', ti: 'Ask your planner', su: 'Just say what you need.' },
    { a: 18.7, b: 20.45, n: '02', ti: 'Find suppliers', su: 'Handpicked, local, on budget.' },
    { a: 20.75, b: 21.85, n: '03', ti: 'Track your budget', su: 'Every pound, beautifully clear.' },
    { a: 22.4, b: 24.4, n: '04', ti: 'Seat everyone', su: null, center: true },
  ];
  function caption(ctx, t, c) {
    if (t < c.a || t > c.b + .3) return;
    const out = R(t, c.b, c.b + .25, E.inCubic), x = c.center ? W / 2 : 200, y = c.center ? 190 : 575, lt = t - c.a;
    ctx.save(); ctx.globalAlpha = 1 - out; ctx.translate(0, -out * 24);
    const la = R(t, c.a, c.a + .45);
    ctx.globalAlpha = (1 - out) * la;
    if (c.center) { tracked(ctx, c.n, x, y - 70, 16, 600, C.gold, 5, 'center'); }
    else {
      const w = tracked(ctx, c.n, x, y - 80, 16, 600, C.gold, 5);
      ctx.fillStyle = C.gold; ctx.fillRect(x + w + 12, y - 86, 70 * la, 1.5);
    }
    ctx.globalAlpha = 1 - out;
    const L = K.layout(ctx, [{ text: c.ti, size: c.center ? 48 : 58, weight: 700, color: C.ink }]);
    const ra = K.riseAnim(lt - .04, .018, .5, 34); K.drawLine(ctx, L, x, y, (i) => { const v = ra(i); v.blur = 0; return v; }, c.center ? 'center' : 'left');
    if (c.su) { const sa = R(t, c.a + .2, c.a + .65); ctx.globalAlpha = (1 - out) * sa; txt(ctx, c.su, x, y + 52 + (1 - sa) * 14, 24, 500, C.ink2); }
    ctx.restore();
  }

  // pre-blurred object sprites (live ctx.filter blur is far too slow)
  function objSprite(o) {
    return K.cache('b:obj' + o.n + o.blur, 480, 480, (g) => { if (o.blur) g.filter = `blur(${(o.blur * 400 / o.s).toFixed(1)}px)`; K.obj(g, o.n, 240, 240, 400, {}); });
  }
  function drawPhoneWorld(ctx, t) {
    K.bgMesh(ctx, t);
    const ps = phoneState(t), cam = camera(t);
    // floating 3D objects
    OBJS.forEach((o, i) => {
      const pop = K.spring(t - o.d, 2.2, .5); if (pop <= 0) return;
      const [fx, fy] = K.float(t, 20 + i * 3, 14, .45);
      let x = lerp(o.p[0], o.q[0], cl(ps.rp)) + fx, y = lerp(o.p[1], o.q[1], cl(ps.rp)) + fy;
      x += (x - cam.fx) * (cam.s - 1) * 1.4; y += (y - cam.fy) * (cam.s - 1) * 1.4;
      const sz = o.s * pop * (1 + (cam.s - 1) * 1.2), spr = objSprite(o);
      ctx.save(); ctx.translate(x, y); ctx.rotate(o.rot + Math.sin(t * .7 + i) * .06); ctx.drawImage(spr, -sz * .6, -sz * .6, sz * 1.2, sz * 1.2); ctx.restore();
    });
    CAPS.forEach(c => caption(ctx, t, c));
    ctx.save(); ctx.translate(cam.fx, cam.fy); ctx.scale(cam.s, cam.s); ctx.translate(-cam.fx, -cam.fy);
    K.phone(ctx, { x: ps.x, y: ps.y, h: ps.h, yaw: ps.yaw, rot: ps.rot, land: ps.land }, (g) => (ps.land ? screenL(g, t) : screenP(g, t)), 'b');
    if (!ps.land && t < 21.2) { const c = curP(t); if (c.alpha > 0) { const [x, y] = mapPt(ps, c.x, c.y); K.touch(ctx, x, y, c.press, { alpha: c.alpha, ripple: c.ripple }); } }
    if (ps.land) { const c = curL(t); if (c.alpha > 0) { const [x, y] = mapPt(ps, c.x, c.y); K.touch(ctx, x, y, c.press, { alpha: c.alpha, ripple: c.ripple, r: 22 }); } }
    ctx.restore();
    // celebration: Uncle Gary → Table 9
    if (t >= LABEL_T) {
      const [tx, ty] = mapPt(ps, TABLES[5].x, TABLES[5].y);
      for (let i = 0; i < 18; i++) {
        const lt = t - LABEL_T - K.hash(i) * .05; if (lt <= 0 || lt > .9) continue;
        const a = i / 18 * TAU + K.hash(i + 3), sp = 260 + K.hash(i + 7) * 260;
        const px = tx + Math.cos(a) * sp * lt, py = ty + Math.sin(a) * sp * lt + 520 * lt * lt;
        ctx.save(); ctx.globalAlpha = 1 - lt / .9; ctx.translate(px, py); ctx.rotate(lt * 8 + i);
        ctx.fillStyle = [C.gold, C.rose, C.lavender, '#57B887', C.gold2, C.blush][i % 6]; rr(ctx, -6, -3, 12, 6, 2); ctx.fill(); ctx.restore();
      }
      const s = K.spring(t - LABEL_T - .04, 2.6, .45), lx = tx - 130, ly = ty - 170;
      ctx.save(); ctx.translate(lx, ly); ctx.scale(s, s); ctx.rotate(-.03 * (1 - s));
      font(ctx, 30, 700); const w1 = ctx.measureText('Uncle Gary').width, w2 = ctx.measureText('Table 9').width, bw = 64 + w1 + 64 + w2 + 34;
      K.glass(ctx, -bw / 2, -38, bw, 76, 38, { fill: 'rgba(255,255,255,.93)' });
      let x = -bw / 2 + 22; UI.check(ctx, x + 18, 0, 18, R(t, LABEL_T + .1, LABEL_T + .35, E.outCubic), '#57B887'); x += 50;
      txt(ctx, 'Uncle Gary', x, 11, 30, 700); x += w1 + 16;
      ctx.lineWidth = 3; ctx.strokeStyle = C.rose; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 32, 0); ctx.moveTo(x + 22, -9); ctx.lineTo(x + 32, 0); ctx.lineTo(x + 22, 9); ctx.stroke(); x += 48;
      const L = K.layout(ctx, [{ text: 'Table 9', size: 30, weight: 700, grad: [C.gold, C.rose] }]); K.drawLine(ctx, L, x, 11, null, 'left');
      // pointer tail
      ctx.beginPath(); ctx.moveTo(114, 37); ctx.lineTo(130, 56); ctx.lineTo(146, 37); ctx.fillStyle = 'rgba(255,255,255,.93)'; ctx.fill();
      ctx.restore();
    }
  }
  K.addScene({
    name: 'b_phone', start: 16.0, end: 25.0, draw(ctx, t) {
      if (t < 16.32) {
        const a = 1 - R(t, 16.0, 16.32, E.outCubic);
        K.zoomBlur(ctx, .2 * a, g => { g.translate(W / 2, H / 2); g.scale(1 + .14 * a, 1 + .14 * a); g.translate(-W / 2, -H / 2); drawPhoneWorld(g, t); });
        K.fade(ctx, .7 * a * a, '#FFF6EC');
      } else if (t >= OUT_T) {
        const p = E.inCubic(R(t, OUT_T, 25.0, E.linear)), ps = phoneState(t), [tx, ty] = mapPt(ps, TABLES[5].x, TABLES[5].y - 60);
        K.zoomBlur(ctx, .45 * p, g => { const s = 1 + 2.4 * p; g.translate(tx, ty); g.scale(s, s); g.translate(-tx, -ty); drawPhoneWorld(g, t); }, tx, ty, 9);
        K.fade(ctx, R(t, 24.72, 24.97, E.inQuad));
      } else drawPhoneWorld(ctx, t);
    },
  });
})();
