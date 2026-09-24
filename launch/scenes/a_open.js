/* Animator A — 0.0–13.0 s: Hero (0–3), Type A (3–9), Card orbit (9–13).
 * Pure function of t. Cues are generated from the same timing constants (window.A_OPEN_CUES).
 */
(function () {
  const K = KIT, C = K.C, F = K.F, W = K.W, H = K.H, TAU = K.TAU;
  const { clamp, lerp, remap, ease, spring, hash, noise1 } = K;
  const cues = [];
  const cue = (t, sfx, gain = .7, pan = 0) => cues.push({ t: +t.toFixed(3), sfx, gain: +clamp(gain, .3, 1).toFixed(2), pan: +clamp(pan, -1, 1).toFixed(2) });
  const panX = x => (x - W / 2) / (W / 2) * .6;

  // ───────────── shared helpers ─────────────
  const LAY = {};
  function lay(ctx, key, parts) { return LAY[key] || (LAY[key] = K.layout(ctx, parts)); }
  /** like K.drawLine but gradient spans the whole part (not per glyph) + per-glyph rotation */
  function drawRich(ctx, L, x, y, anim, align = 'center') {
    const x0 = align === 'center' ? x - L.width / 2 : x;
    if (!L.ext) { L.ext = {}; L.glyphs.forEach(g => { const e = L.ext[g.pi] || (L.ext[g.pi] = { a: 1e9, b: -1e9 }); e.a = Math.min(e.a, g.x); e.b = Math.max(e.b, g.x + g.w); }); }
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    L.glyphs.forEach((g, i) => {
      const s = anim ? anim(i, g) : {}; const a = s.a == null ? 1 : s.a; if (a <= .003 || g.ch === ' ') return;
      const p = g.part; K.font(ctx, p.size, p.weight || 600, p.family || F.sans, p.style || 'normal');
      ctx.save(); ctx.globalAlpha *= a;
      const gx = x0 + g.x + (s.dx || 0), gy = y + (s.dy || 0);
      if ((s.s != null && s.s !== 1) || s.r) { const cx = gx + g.w / 2, cy = gy - p.size * .35; ctx.translate(cx, cy); ctx.rotate(s.r || 0); ctx.scale(s.s == null ? 1 : s.s, s.s == null ? 1 : s.s); ctx.translate(-cx, -cy); }
      if (s.blur > .3) ctx.filter = `blur(${s.blur.toFixed(1)}px)`;
      if (p.grad) { const e = L.ext[g.pi], gr = ctx.createLinearGradient(x0 + e.a, 0, x0 + e.b, 0); p.grad.forEach((c, k) => gr.addColorStop(k / (p.grad.length - 1), c)); ctx.fillStyle = gr; }
      else ctx.fillStyle = s.color || p.color || C.ink;
      ctx.fillText(g.ch, gx, gy); ctx.restore();
    });
    return x0;
  }
  const GRAD = [C.gold, '#D98A7E', C.rose];
  /** typed glyph reveal given per-glyph time fn */
  function typed(t, tf) { return (i) => { const k = clamp((t - tf(i)) / .07), e = ease.outCubic(k); return { a: k, dy: (1 - e) * 10, s: .82 + .18 * e, blur: (1 - k) * 3 }; }; }
  function caretAt(ctx, x, y, size, t, typingEnd, alpha = 1) {
    if (alpha <= 0) return; const since = t - typingEnd;
    if (since > 0 && ((since % .5) > .3)) return;
    ctx.save(); ctx.globalAlpha *= alpha; ctx.fillStyle = C.rose; K.rr(ctx, x + 6, y - size * .8, 4, size * .98, 2); ctx.fill(); ctx.restore();
  }
  function typedCount(L, t, tf) { let n = 0; for (let i = 0; i < L.glyphs.length; i++) if (t >= tf(i) + .03) n = i + 1; return n; }
  function glyphEnd(L, n) { return n <= 0 ? 0 : L.glyphs[n - 1].x + L.glyphs[n - 1].w; }
  /** springy pop scale (0→overshoot→1) */
  const pop = (dt, f = 2.4, d = .38) => dt <= 0 ? 0 : spring(dt, f, d);

  // ═════════════ SCENE 1 — HERO 0.0–3.0 ═════════════
  const HERO_OBJ = [ // name, x, y, size, popT, depth, baseRot
    ['ring', 545, 335, 150, .50, .9, -.25],
    ['coupe', 1395, 300, 150, .75, .9, .18],
    ['heart', 420, 640, 160, 1.25, 1.15, -.15],
    ['envelope', 1500, 650, 180, 1.25, 1.15, .12],
    ['cake', 640, 930, 180, 1.50, 1.3, .06],
    ['rose', 1290, 915, 160, 1.75, 1.3, -.1],
    ['calendar', 235, 330, 130, 1.75, .8, -.14],
    ['gift', 1700, 360, 130, 2.00, .8, .16],
    ['star', 690, 95, 96, 2.25, .75, .3],
  ];
  const NOTIFY_T = 1.0, LOGO_T = .5, PUSH_T = 2.5, WHOOSH1 = 2.95;
  const PH = { x: 960, y: 770, h: 880 };

  function wallpaper() {
    return K.cache('A:wall', 780, 1688, (g) => {
      g.scale(2, 2);
      const gr = g.createLinearGradient(0, 0, 390, 844); gr.addColorStop(0, '#F9E1EA'); gr.addColorStop(.45, '#E4D6F6'); gr.addColorStop(1, '#FBDCC8');
      g.fillStyle = gr; g.fillRect(0, 0, 390, 844);
      K.blob(g, '#FFFFFF', 80, 160, 260, 220, .75); K.blob(g, C.rose, 360, 520, 240, 260, .35); K.blob(g, C.lavender, 40, 700, 260, 220, .5); K.blob(g, C.champagne, 300, 820, 260, 160, .7);
      g.filter = 'blur(10px)'; g.lineCap = 'round';
      for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-60, 420 + i * 70); g.bezierCurveTo(120, 300 + i * 90, 260, 620 + i * 40, 460, 380 + i * 80); g.lineWidth = 34 - i * 5; g.strokeStyle = `rgba(255,255,255,${.35 - i * .06})`; g.stroke(); }
      g.filter = 'none';
    });
  }
  function lockScreen(g, t) {
    g.drawImage(wallpaper(), 0, 0, 390, 844);
    // status icons
    g.fillStyle = '#fff'; for (let i = 0; i < 4; i++) g.fillRect(292 + i * 5.5, 30 - i * 2.5, 3.5, 4 + i * 2.5);
    K.rr(g, 320, 22, 26, 13, 4); g.lineWidth = 1.2; g.strokeStyle = '#fff'; g.stroke(); K.rr(g, 322.5, 24.5, 19, 8, 2); g.fill();
    // lock glyph
    g.save(); g.strokeStyle = 'rgba(255,255,255,.95)'; g.lineWidth = 2; K.rr(g, 187, 82, 16, 12, 3); g.fillStyle = 'rgba(255,255,255,.95)'; g.fill(); g.beginPath(); g.arc(195, 82, 5, Math.PI, 0); g.stroke(); g.restore();
    g.save(); g.shadowColor = 'rgba(90,50,120,.22)'; g.shadowBlur = 18; g.shadowOffsetY = 3;
    K.UI.text(g, 'Saturday 14 June', 195, 142, 19, 600, 'rgba(255,255,255,.96)', 'center');
    K.UI.text(g, '9:41', 195, 250, 104, 700, 'rgba(255,255,255,.97)', 'center');
    g.restore();
    // notification
    const dt = t - NOTIFY_T; if (dt > 0) {
      const s = pop(dt, 2.2, .5), a = clamp(dt / .12);
      g.save(); g.globalAlpha = a; g.translate(195, 330); g.scale(lerp(.8, 1, s), lerp(.8, 1, s)); g.translate(-195, -330 + (1 - s) * -40);
      g.fillStyle = 'rgba(80,40,110,.10)'; K.rr(g, 14, 290 + 6, 362, 86, 24); g.fill();
      K.rr(g, 14, 290, 362, 86, 24); g.fillStyle = 'rgba(255,255,255,.72)'; g.fill(); g.lineWidth = 1; g.strokeStyle = 'rgba(255,255,255,.9)'; g.stroke();
      K.rr(g, 28, 311, 44, 44, 11); const ig = g.createLinearGradient(28, 311, 72, 355); ig.addColorStop(0, '#FFF3DC'); ig.addColorStop(1, C.blush); g.fillStyle = ig; g.fill();
      K.icon(g, 'ring', 50, 333, 28, C.gold, 2.2);
      K.UI.text(g, 'The Wedding Chapter', 84, 316, 12.5, 700, C.ink2);
      K.UI.text(g, 'now', 360, 316, 12, 500, C.ink3, 'right');
      K.UI.text(g, '142 days to go ✨', 84, 338, 16.5, 800, C.ink);
      K.UI.text(g, 'Sophie & James', 84, 360, 14, 500, C.ink2);
      g.restore();
    }
    // bottom controls
    for (const x of [62, 328]) { g.beginPath(); g.arc(x, 770, 24, 0, TAU); g.fillStyle = 'rgba(255,255,255,.35)'; g.fill(); }
    K.icon(g, 'sparkle', 62, 770, 20, '#fff', 2); K.icon(g, 'camera', 328, 770, 22, '#fff', 2);
    K.rr(g, 128, 826, 134, 5, 3); g.fillStyle = 'rgba(255,255,255,.9)'; g.fill();
  }
  function logoTint() {
    const L = window.LOGO;
    return K.cache('A:logoTint', L.w, L.h, (g) => {
      const tmp = K.canvas(L.w, L.h), tg = tmp.getContext('2d');
      K.logo(tg, L.w / 2, L.h / 2, L.w);
      tg.globalCompositeOperation = 'source-in';
      const gr = tg.createLinearGradient(0, 0, L.w, L.h * .6); gr.addColorStop(0, '#FFFFFF'); gr.addColorStop(.5, '#FFF4F8'); gr.addColorStop(1, '#F8D3E0');
      tg.fillStyle = gr; tg.fillRect(0, 0, L.w, L.h);
      g.shadowColor = 'rgba(190,120,200,.45)'; g.shadowBlur = 28; g.drawImage(tmp, 0, 0);
      g.shadowColor = 'rgba(255,255,255,.9)'; g.shadowBlur = 6; g.drawImage(tmp, 0, 0);
    });
  }
  function heroCamera(t) {
    const base = lerp(1.42, 1, ease.outQuart(clamp(t / 1.5))) + .014 * t;
    const push = t > PUSH_T ? ease.inExpo(clamp((t - PUSH_T) / .47)) : 0;
    return { S: base * (1 + push * 6.5), push };
  }
  function camLayer(ctx, S, d, t) {
    const fx = 960, fy = 560, s = 1 + (S - 1) * d;
    const dx = noise1(t * .45, 3) * 10 * d, dy = noise1(t * .45, 7) * 8 * d;
    ctx.translate(fx, fy); ctx.scale(s, s); ctx.translate(-fx + dx, -fy + dy);
  }
  function heroObj(ctx, o, t, S) {
    const [name, x, y, size, t0, d, rot0] = o, dt = t - t0; if (dt <= -.06) return;
    ctx.save(); camLayer(ctx, S, d, t);
    const [fx, fy] = K.float(t, x * .01, 12, .5);
    const px = x + fx, py = y + fy;
    // orbit outline
    const cr = size * .78 * lerp(.55, 1, ease.outExpo(clamp((dt + .06) / .6)));
    const ca = clamp((dt + .06) / .2) * .8;
    ctx.beginPath(); ctx.arc(px, py, cr, 0, TAU); ctx.fillStyle = `rgba(255,255,255,${.1 * ca})`; ctx.fill();
    ctx.lineWidth = 1.4; ctx.strokeStyle = `rgba(255,255,255,${ca})`; ctx.stroke();
    // little orbiting dot on the ring
    const oa = t * (.9 + hash(x) * .6) + hash(y) * TAU; ctx.beginPath(); ctx.arc(px + Math.cos(oa) * cr, py + Math.sin(oa) * cr, 3.2, 0, TAU); ctx.fillStyle = `rgba(255,255,255,${ca})`; ctx.fill();
    if (dt > 0) {
      const s = pop(dt, 2.3, .36), rot = rot0 + (1 - s) * .9 * (hash(x) > .5 ? 1 : -1) + Math.sin(t * 1.3 + x) * .07;
      K.obj(ctx, name, px, py, size * s, { rot, alpha: clamp(dt / .06), shadow: false, blur: dt < .12 ? (1 - dt / .12) * 4 : 0 });
    }
    ctx.restore();
  }
  function heroWorld(ctx, t) {
    const { S } = heroCamera(t);
    ctx.save(); camLayer(ctx, S, .5, t);
    K.bgMesh(ctx, t, { blobs: [[C.lavender, .1, .15, 900], [C.lilac, .85, .1, 800], [C.peach, .92, .85, 820], [C.blush, .18, .9, 760], [C.champagne, .55, .6, 600], [C.lavender, .5, 1.1, 760], ['#C9B5F2', .02, .6, 600]] });
    ctx.restore();
    // logo — large, pale, rising from behind the phone
    const lt = t - LOGO_T;
    if (lt > 0) {
      const e = ease.outExpo(clamp(lt / .7)), sp = logoTint();
      ctx.save(); camLayer(ctx, S, .7, t);
      ctx.globalAlpha = clamp(lt / .35) * .92; if (lt < .45) ctx.filter = `blur(${((1 - lt / .45) * 14).toFixed(1)}px)`;
      const w = 760 * lerp(.92, 1, e), h = w * sp.height / sp.width;
      ctx.drawImage(sp, 960 - w / 2, 222 - h / 2 + (1 - e) * 120, w, h);
      ctx.restore();
    }
    HERO_OBJ.filter(o => o[5] < 1).forEach(o => heroObj(ctx, o, t, S));
    // phone
    ctx.save(); camLayer(ctx, S, 1, t);
    const settle = ease.outQuart(clamp(t / 1.5));
    K.phone(ctx, { x: PH.x, y: PH.y + (1 - settle) * 70 + Math.sin(t * 1.1) * 5, h: PH.h, rot: lerp(-.17, -.065, settle) + Math.sin(t * .9) * .008, yaw: .1 + Math.sin(t * .8) * .03 }, (g) => lockScreen(g, t), 'A:hero');
    ctx.restore();
    HERO_OBJ.filter(o => o[5] >= 1).forEach(o => heroObj(ctx, o, t, S));
  }
  K.addScene({
    name: 'A:hero', start: 0, end: 3,
    draw(ctx, t) {
      const { push } = heroCamera(t);
      const amt = remap(t, PUSH_T, WHOOSH1, 0, .32, ease.inQuad);
      if (amt > .001) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); K.zoomBlur(ctx, amt, g => heroWorld(g, t), 960, 560, 12); }
      else heroWorld(ctx, t);
      K.fade(ctx, remap(t, 2.62, WHOOSH1, 0, 1, ease.inQuad));
      void push;
    },
  });
  // hero cues
  cue(LOGO_T, 'logo_shimmer', .55, 0);
  HERO_OBJ.forEach((o, i) => { cue(o[4], i % 2 ? 'pop_soft' : 'pop', .55 + (o[3] / 180) * .3, panX(o[1])); });
  cue(NOTIFY_T, 'notify', .8, 0);
  cue(2.2, 'sparkle', .35, .3);
  cue(WHOOSH1, 'whoosh', 1, 0);
  cue(3.0, 'impact_soft', .45, 0);

  // ═════════════ SCENE 2 — TYPE A 3.0–9.0 ═════════════
  const TA = {
    l1: 3.0, cps1: 16, lift: 4.25, l2: 4.5, cps2: 20, ringPop: 5.25, swarm: 5.5, exit: 6.25,
    l3: 6.5, l3b: 7.25, cps3: 18, jitter: 7.9, suck: 8.5, suckEnd: 8.95,
  };
  const SZ = 84;
  const P_SANS = (text, extra) => Object.assign({ text, size: SZ, weight: 600, family: F.sans, color: C.ink }, extra);
  const P_ACC = (text) => ({ text, size: SZ + 12, weight: 400, family: F.serif, style: 'italic', grad: GRAD });
  const SWARM = ['ring', 'cake', 'envelope', 'dress', 'venue', 'music', 'camera', 'flower', 'calendar', 'pound', 'guests', 'table'];
  const SWARM_POS = [[545, 395], [610, 395], [675, 395], [740, 395], [1290, 410], [1355, 410], [1420, 410], [590, 725], [655, 725], [1140, 725], [1205, 725], [1270, 725]];
  const SWARM2 = ['heart', 'glass', 'gift', 'sparkle', 'pin', 'chat', 'check', 'list', 'flower', 'music', 'ring', 'calendar'];
  const tf3 = i => (i < 11 ? TA.l3 + i / TA.cps3 : TA.l3b + (i - 11) / TA.cps3);
  const orbitPos = (i, t) => {
    const ring = i < 12 ? 0 : 1, u = Math.max(0, t - TA.l3), dir = ring ? -1 : 1;
    const a0 = (i % 12) / 12 * TAU + ring * .26;
    const sq = t > TA.suck ? ease.inCubic(clamp((t - TA.suck) / (TA.suckEnd - TA.suck))) : 0;
    const a = a0 + dir * (.45 * u + .09 * u * u * u) + sq * 3.2 * dir;
    const rx = (ring ? 820 : 650) * (1 - sq), ry = (ring ? 330 : 215) * (1 - sq);
    return { x: 960 + Math.cos(a) * rx, y: 535 + Math.sin(a) * ry, depth: Math.sin(a), sq };
  };
  function typeContent(ctx, t) {
    const L1 = lay(ctx, 'l1', [P_SANS('Every '), P_ACC('love story')]);
    const L2 = lay(ctx, 'l2', [P_SANS('starts with a '), P_ACC('yes.')]);
    const L3 = lay(ctx, 'l3', [P_SANS('Then comes '), P_SANS('the planning.', { weight: 700 })]);
    const lift = ease.outQuart(clamp((t - TA.lift) / .4));
    const y1 = lerp(578, 505, lift), y2 = 625;
    const ex = t > TA.exit ? clamp((t - TA.exit) / .25) : 0;
    const exitAnim = (base) => (i, g) => {
      const s = base(i, g); if (ex <= 0) return s;
      const p = clamp(ex * 1.25 - (1 - i / 20) * .25), e = ease.inCubic(p);
      return Object.assign({}, s, { a: (s.a == null ? 1 : s.a) * (1 - e), dx: -e * 260, blur: e * 10 });
    };
    // line 1
    if (t < TA.exit + .3) {
      const tf1 = i => TA.l1 + i / TA.cps1;
      const x0 = drawRich(ctx, L1, 960, y1, exitAnim(typed(t, tf1)));
      const n = typedCount(L1, t, tf1);
      if (t < TA.l2) caretAt(ctx, x0 + glyphEnd(L1, n), y1, SZ, t, tf1(L1.glyphs.length - 1));
      // line 2
      const tf2 = i => TA.l2 + i / TA.cps2;
      if (t >= TA.l2) {
        const x2 = drawRich(ctx, L2, 960, y2, exitAnim(typed(t, tf2)));
        const n2 = typedCount(L2, t, tf2);
        caretAt(ctx, x2 + glyphEnd(L2, n2), y2, SZ, t, tf2(L2.glyphs.length - 1), 1 - ex);
        // 3D ring pops on "yes"
        const dt = t - TA.ringPop;
        if (dt > 0) {
          const s = pop(dt, 2.2, .35), gx = x2 + glyphEnd(L2, L2.glyphs.length) + 70, gy = y2 - 95;
          const [fx, fy] = K.float(t, 21, 8, .8), e = ease.inCubic(ex);
          K.obj(ctx, 'ring', gx + fx - e * 300, gy + fy, 118 * s * (1 - e * .4), { rot: .25 - (1 - s) * 1.2 + Math.sin(t * 1.6) * .08, alpha: clamp(dt / .06) * (1 - e), shadow: false, blur: e * 8 });
          // sparkle burst
          if (dt < .5) { const q = dt / .5; for (let k = 0; k < 8; k++) { const a = k / 8 * TAU + .3; ctx.save(); ctx.globalAlpha = (1 - q) * .9; ctx.fillStyle = k % 2 ? C.gold2 : C.rose; ctx.beginPath(); ctx.arc(gx + Math.cos(a) * (40 + q * 70), gy + Math.sin(a) * (40 + q * 70), 4 * (1 - q) + 1, 0, TAU); ctx.fill(); ctx.restore(); } }
        }
      }
    }
    // line 3 "Then comes the planning."
    if (t >= TA.l3) {
      const sq = t > TA.suck ? ease.inCubic(clamp((t - TA.suck) / (TA.suckEnd - TA.suck))) : 0;
      const jit = remap(t, TA.jitter, TA.suck, 0, 1) * (1 - sq);
      const base = typed(t, tf3);
      ctx.save(); const sc = 1 - sq * .92; ctx.translate(960, 535); ctx.scale(sc, sc); ctx.translate(-960, -535); ctx.globalAlpha *= 1 - sq * sq;
      if (sq > .02) ctx.filter = `blur(${(sq * 10).toFixed(1)}px)`;
      const x3 = drawRich(ctx, L3, 960, 565, (i, g) => {
        const s = base(i, g); if (jit <= 0 || i < 11) return s;
        return Object.assign(s, { dy: (s.dy || 0) + noise1(t * 16, i * 3) * 6 * jit, dx: noise1(t * 13, i * 5 + 1) * 3 * jit, r: noise1(t * 11, i * 7 + 2) * .08 * jit });
      });
      ctx.restore();
      const n3 = typedCount(L3, t, tf3);
      if (sq < .05) caretAt(ctx, x3 + glyphEnd(L3, n3), 565, SZ, t, tf3(L3.glyphs.length - 1), 1 - remap(t, 8.3, 8.5));
    }
    // outline icons: swarm → orbit → sucked in
    for (let i = 0; i < 24; i++) {
      const first = i < 12, t0 = first ? TA.swarm + i * .0625 : TA.l3b + (i - 12) * .0625, dt = t - t0;
      if (dt <= 0) continue;
      let x, y, sc = 1, al = 1, depth = 0;
      const op = orbitPos(i, t);
      if (first) {
        const m = ease.inOutCubic(clamp((t - (TA.exit + .1 + (i % 6) * .03)) / .7));
        const [bx, by] = SWARM_POS[i], [fx, fy] = K.float(t, i * 2.3, 5, .9);
        x = lerp(bx + fx, op.x, m); y = lerp(by + fy, op.y, m); depth = op.depth * m;
      } else { x = op.x; y = op.y; depth = op.depth; }
      sc = pop(dt, 3, .34) * (1 + depth * .22) * (1 - op.sq * .7);
      al = clamp(dt / .05) * lerp(1, .55 + .45 * (depth + 1) / 2, t > TA.l3 ? 1 : 0) * (1 - op.sq * op.sq);
      if (sc <= .01 || al <= .01) continue;
      const name = first ? SWARM[i] : SWARM2[i - 12], col = i % 5 === 2 ? C.rose : i % 7 === 3 ? C.gold : C.ink;
      ctx.save(); ctx.globalAlpha *= al; ctx.translate(x, y); ctx.rotate(Math.sin(t * 2 + i) * .12 + (1 - Math.min(1, sc)) * .6); ctx.scale(sc, sc);
      K.icon(ctx, name, 0, 0, 50, col, 2); ctx.restore();
    }
  }
  K.addScene({
    name: 'A:typeA', start: 3, end: 9,
    draw(ctx, t) {
      K.bgWhite(ctx, t, { band: remap(t, 3, 3.6, 0, .85, ease.outCubic), bandY: remap(t, 3, 3.8, 260, 120, ease.outQuart) });
      // faint orbit guides for the icon rings
      const og = remap(t, 6.55, 7.1, 0, 1, ease.outCubic) * (1 - remap(t, TA.suck, TA.suck + .3));
      if (og > 0) { ctx.save(); ctx.lineWidth = 1.2; ctx.strokeStyle = `rgba(107,90,126,${.13 * og})`; [[650, 215], [820, 330]].forEach(([rx, ry], k) => { ctx.beginPath(); ctx.ellipse(960, 535, rx * lerp(.85, 1, og), ry * lerp(.85, 1, og), 0, 0, TAU); ctx.stroke(); }); ctx.restore(); }
      const amt = t > TA.suck ? -ease.inQuad(clamp((t - TA.suck - .05) / .45)) * .35 : 0;
      if (amt < -.001) K.zoomBlur(ctx, amt, g => typeContent(g, t), 960, 540, 12); else typeContent(ctx, t);
      K.fade(ctx, remap(t, 3, 3.18, 1, 0, ease.outQuad));
      K.fade(ctx, remap(t, 8.8, 9, 0, .75, ease.inQuad));
    },
  });
  // Type A cues
  (function () {
    const n1 = 'Every love story'.length, n2 = 'starts with a yes.'.length, s3 = 'Then comes the planning.';
    cue(TA.l1, 'caret', .4, 0);
    for (let i = 0; i < n1; i++) if ('Every love story'[i] !== ' ') cue(TA.l1 + i / TA.cps1, 'type', .5 + hash(i) * .2, -.3 + i / n1 * .6);
    cue(TA.lift + .1, 'whoosh_short', .4, 0);
    for (let i = 0; i < n2; i++) if ('starts with a yes.'[i] !== ' ') cue(TA.l2 + i / TA.cps2, 'type', .5 + hash(i + 40) * .2, -.3 + i / n2 * .6);
    cue(TA.ringPop, 'pop', .9, .45); cue(TA.ringPop + .02, 'glass_ting', .55, .45); cue(TA.ringPop + .05, 'sparkle', .45, .45);
    SWARM_POS.forEach(([x], i) => cue(TA.swarm + i * .0625, 'pop_soft', .42 + hash(i + 9) * .15, panX(x)));
    cue(TA.exit + .15, 'whoosh_short', .6, -.3);
    cue(TA.exit + .35, 'swish', .4, .2);
    for (let i = 0; i < s3.length; i++) if (s3[i] !== ' ') cue(tf3(i), 'type', .5 + hash(i + 80) * .2, -.3 + i / s3.length * .6);
    for (let j = 0; j < 12; j++) { const op = orbitPos(12 + j, TA.l3b + j * .0625); cue(TA.l3b + j * .0625, 'pop_soft', .35 + hash(j + 3) * .12, panX(op.x)); }
    cue(TA.suckEnd, 'whoosh', .95, 0);
    cue(TA.suckEnd - .05, 'riser', .35, 0);
  })();

  // ═════════════ SCENE 3 — CARD ORBIT 9.0–13.0 ═════════════
  const T3 = { start: 9, collapse: 12.5, collapseEnd: 12.9 };
  const WORDS = [
    { t: 9.0, parts: [{ text: 'Guests.', size: 104, weight: 700 }], hl: 'guests' },
    { t: 9.5, parts: [{ text: 'Budget.', size: 104, weight: 700 }], hl: 'budget' },
    { t: 10.0, parts: [{ text: 'Suppliers.', size: 104, weight: 700 }], hl: 'chat' },
    { t: 10.5, parts: [{ text: 'Seating.', size: 104, weight: 700 }], hl: 'seating' },
    { t: 11.0, parts: [{ text: '…all in ', size: 84, weight: 600 }, { text: 'one place.', size: 96, weight: 400, family: F.serif, style: 'italic', grad: GRAD }], hl: '*' },
  ];
  const TXT = (g, s, x, y, size, weight = 600, color = C.ink, align = 'left', family) => K.UI.text(g, s, x, y, size, weight, color, align, family);
  function paintedPhoto(g, x, y, w, h, r) {
    g.save(); K.rr(g, x, y, w, h, r); g.clip();
    const sky = g.createLinearGradient(0, y, 0, y + h); sky.addColorStop(0, '#F6C9D0'); sky.addColorStop(.45, '#FBE3CF'); sky.addColorStop(.7, '#F3DDB8'); sky.addColorStop(1, '#CFE0C4');
    g.fillStyle = sky; g.fillRect(x, y, w, h);
    K.blob(g, '#FFF4DA', x + w * .68, y + h * .42, 70, 60, .95);
    const hill = (yy, amp, col, ph) => { g.beginPath(); g.moveTo(x, y + h); g.lineTo(x, y + h * yy); for (let i = 0; i <= 20; i++) { const u = i / 20; g.lineTo(x + u * w, y + h * yy - Math.sin(u * 3.4 + ph) * amp - Math.sin(u * 7 + ph * 2) * amp * .3); } g.lineTo(x + w, y + h); g.closePath(); g.fillStyle = col; g.fill(); };
    hill(.58, 14, '#D9CCF5', 1.2); hill(.68, 12, '#B9CFB6', 2.6); hill(.8, 10, '#9DBF9E', .4);
    // barn silhouette
    g.fillStyle = '#FBF7F2'; g.beginPath(); g.moveTo(x + w * .3, y + h * .72); g.lineTo(x + w * .3, y + h * .6); g.lineTo(x + w * .37, y + h * .53); g.lineTo(x + w * .44, y + h * .6); g.lineTo(x + w * .44, y + h * .72); g.closePath(); g.fill();
    g.fillStyle = '#C79A6A'; g.fillRect(x + w * .355, y + h * .64, w * .03, h * .08);
    // trees
    for (const [u, s] of [[.14, 1], [.2, .8], [.82, 1.1], [.9, .8]]) { K.blob(g, '#7FA487', x + w * u, y + h * .66, 16 * s, 20 * s, 1); }
    g.restore();
  }
  const CARDS = {
    guests: [250, 232, (g, w) => {
      TXT(g, 'Guests', 18, 34, 17, 800); K.UI.pill(g, '120 invited', w - 16, 28, { align: 'right', size: 10.5 });
      const rows = [['EC', 'Emma Clarke', 'Attending', C.blush], ['OH', 'Oliver Hughes', 'Pending', C.lilac], ['PS', 'Priya Shah', 'Attending', C.champagne], ['TB', 'Tom Bennett', 'Declined', C.sage]];
      const st = { Attending: ['#E3F5EA', '#2E7D4F'], Pending: ['#FFF1D6', '#9A6A12'], Declined: ['#FBE3E8', '#B23A5A'] };
      rows.forEach(([ini, nm, s, c], i) => { const y = 72 + i * 40; K.UI.avatar(g, 34, y, 14, ini, c); TXT(g, nm, 56, y + 5, 12.5, 600); K.UI.pill(g, s, w - 16, y, { align: 'right', size: 10, bg: st[s][0], fg: st[s][1] }); });
    }],
    budget: [250, 204, (g, w) => {
      TXT(g, 'Budget', 18, 34, 17, 800); TXT(g, '£18,400', 18, 72, 28, 800); TXT(g, 'of £24,000', 132, 72, 12.5, 500, C.ink2);
      [['Venue', .82, C.gold], ['Flowers', .55, C.rose], ['Catering', .68, C.lavender]].forEach(([n, p, c], i) => { const y = 100 + i * 32; TXT(g, n, 18, y, 11.5, 600, C.ink2); K.UI.bar(g, 18, y + 7, w - 36, 8, p, c); });
    }],
    venue: [240, 244, (g, w) => {
      paintedPhoto(g, 10, 10, w - 20, 150, 16);
      TXT(g, 'Orchard Barn', 18, 188, 16, 800); TXT(g, 'Bath · 120 guests', 18, 210, 12, 500, C.ink2);
      K.UI.pill(g, 'Booked', w - 16, 184, { align: 'right', size: 10.5, bg: '#E3F5EA', fg: '#2E7D4F' });
    }],
    mood: [224, 204, (g, w) => {
      TXT(g, 'Mood board', 18, 34, 16, 800);
      const cols = [C.blush, C.champagne, C.sage, C.lilac, C.gold2, C.peach];
      cols.forEach((c, i) => { const x = 16 + (i % 3) * 64, y = 50 + Math.floor(i / 3) * 70; K.rr(g, x, y, 58, 62, 12); g.fillStyle = c; g.fill(); K.blob(g, '#FFFFFF', x + 18, y + 16, 26, 20, .45); });
    }],
    seating: [236, 214, (g, w) => {
      TXT(g, 'Seating', 18, 34, 16, 800); K.UI.pill(g, 'Table 9', w - 16, 28, { align: 'right', size: 10.5, bg: '#FBE3E8', fg: '#B23A5A' });
      const tabs = [[60, 90], [140, 88], [205, 110], [72, 165], [150, 170]];
      tabs.forEach(([x, y], i) => { g.beginPath(); g.arc(x, y, 20, 0, TAU); g.fillStyle = i === 4 ? '#FBE3E8' : '#F1ECF7'; g.fill(); if (i === 4) { g.lineWidth = 2; g.strokeStyle = C.rose; g.stroke(); }
        for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; g.beginPath(); g.arc(x + Math.cos(a) * 30, y + Math.sin(a) * 30, 4.5, 0, TAU); g.fillStyle = (k + i) % 3 ? [C.lavender, C.gold2, C.sage, C.blush][(k + i) % 4] : '#E6E0EC'; g.fill(); } });
      TXT(g, '9', 150, 175, 13, 800, C.rose, 'center');
    }],
    rsvp: [196, 204, (g, w) => {
      TXT(g, 'RSVPs', w / 2, 32, 14, 800, C.ink, 'center');
      K.UI.ring(g, w / 2, 112, 58, .73, C.rose, 11);
      TXT(g, '88', w / 2, 122, 34, 800, C.ink, 'center'); TXT(g, 'of 120', w / 2, 142, 11, 600, C.ink2, 'center');
    }],
    chat: [276, 184, (g, w) => {
      K.UI.avatar(g, 34, 34, 16, 'PS', C.blush); TXT(g, 'Petal & Stem', 58, 32, 14, 800); TXT(g, 'Florist · online', 58, 48, 11, 500, C.ink2);
      K.rr(g, 16, 66, 206, 44, [16, 16, 16, 4]); g.fillStyle = '#F4EFF8'; g.fill(); TXT(g, 'Peonies are perfect for June 🌸', 28, 93, 11.5, 500);
      K.rr(g, w - 196, 122, 180, 40, [16, 16, 4, 16]); g.fillStyle = C.ink; g.fill(); TXT(g, 'Lovely — let\'s book!', w - 106, 147, 12, 600, '#fff', 'center');
    }],
    invite: [206, 276, (g, w, h) => {
      g.lineWidth = 1; g.strokeStyle = 'rgba(184,138,62,.55)'; K.rr(g, 12, 12, w - 24, h - 24, 10); g.stroke();
      K.logo(g, w / 2, 78, 150);
      g.fillStyle = C.gold2; g.fillRect(w / 2 - 20, 128, 40, 1.5);
      K.font(g, 23, 400, F.serif, 'italic'); g.fillStyle = C.ink; g.textAlign = 'center'; g.fillText('Sophie & James', w / 2, 168);
      g.save(); K.font(g, 9.5, 600, F.caps); g.fillStyle = C.gold; g.textAlign = 'center'; if ('letterSpacing' in g) g.letterSpacing = '2px'; g.fillText('SATURDAY 14 JUNE', w / 2, 200); g.restore();
      TXT(g, 'Orchard Barn · Bath', w / 2, 226, 11, 500, C.ink2, 'center');
    }, { fill: '#FBF7F2' }],
    timeline: [236, 238, (g, w) => {
      TXT(g, 'The day', 18, 34, 16, 800); TXT(g, 'Sat 14 June', w - 16, 34, 11, 600, C.ink2, 'right');
      g.fillStyle = '#ECE6F0'; g.fillRect(31, 60, 2, 150);
      [['2:00', 'Ceremony', C.rose], ['3:30', 'Drinks reception', C.gold2], ['5:00', 'Wedding breakfast', C.lavender], ['8:00', 'First dance', C.sage]].forEach(([tm, n, c], i) => {
        const y = 66 + i * 44; g.beginPath(); g.arc(32, y, 6, 0, TAU); g.fillStyle = c; g.fill(); g.lineWidth = 2.5; g.strokeStyle = '#fff'; g.stroke();
        TXT(g, tm, 48, y + 4.5, 11.5, 700, C.ink2); TXT(g, n, 86, y + 4.5, 12.5, 600); });
    }],
    checklist: [236, 214, (g, w) => {
      TXT(g, 'Checklist', 18, 34, 16, 800); TXT(g, '12 of 18', w - 16, 34, 11, 600, C.ink2, 'right');
      [['Book the venue', 1], ['Send invitations', 1], ['Choose flowers', 1], ['Cake tasting', 0]].forEach(([n, on], i) => { const y = 66 + i * 36; K.UI.check(g, 30, y, 10, on); TXT(g, n, 50, y + 4.5, 12.5, 600, on ? C.ink2 : C.ink); });
    }],
    countdown: [226, 150, (g, w, h) => {
      g.save(); K.rr(g, 0, 0, w, h, 22); g.clip(); const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#F6C9D0'); gr.addColorStop(1, '#D9CCF5'); g.fillStyle = gr; g.fillRect(0, 0, w, h); K.blob(g, '#FFFFFF', 40, 20, 120, 80, .6); g.restore();
      TXT(g, '142', 20, 78, 50, 800, '#fff'); TXT(g, 'days to go', 22, 104, 14, 700, C.ink); TXT(g, 'Saturday 14 June', 22, 126, 11.5, 600, C.ink2);
    }],
    florist: [214, 250, (g, w) => {
      g.save(); K.rr(g, 10, 10, w - 20, 158, 16); g.clip(); const gr = g.createLinearGradient(0, 10, 0, 168); gr.addColorStop(0, '#FBEBDD'); gr.addColorStop(1, '#F6C9D0'); g.fillStyle = gr; g.fillRect(10, 10, w - 20, 158); g.restore();
      K.obj(g, 'bouquet', w / 2, 92, 150, { shadow: false });
      TXT(g, 'Petal & Stem', 18, 194, 15, 800); TXT(g, 'Florist · Bath', 18, 214, 11.5, 500, C.ink2); TXT(g, '★ 4.9', w - 16, 194, 12, 700, C.gold, 'right');
    }],
    ringSticker: [150, 150, (g, w, h) => { g.beginPath(); g.arc(w / 2, h / 2, 70, 0, TAU); const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#FFFFFF'); gr.addColorStop(1, '#F3E8FA'); g.fillStyle = gr; g.fill(); K.obj(g, 'ring', w / 2, h / 2 + 4, 118, { shadow: false }); }, { bare: true }],
    rose: [160, 160, (g, w, h) => K.obj(g, 'rose', w / 2, h / 2, 160, { shadow: false }), { bare: true }],
    coupe: [150, 150, (g, w, h) => K.obj(g, 'coupe', w / 2, h / 2, 150, { shadow: false }), { bare: true }],
    heart: [140, 140, (g, w, h) => K.obj(g, 'heart', w / 2, h / 2, 140, { shadow: false }), { bare: true }],
  };
  const RING = ['guests', 'ringSticker', 'budget', 'venue', 'coupe', 'mood', 'chat', 'rsvp', 'rose', 'invite', 'seating', 'timeline', 'heart', 'countdown', 'florist', 'checklist'];
  const PAD = 18, RES = 2;
  function cardSprite(kind) {
    const [w, h, draw, o = {}] = CARDS[kind];
    return K.cache('A:card:' + kind, (w + PAD * 2) * RES, (h + PAD * 2) * RES, (g) => {
      g.scale(RES, RES); g.translate(PAD, PAD);
      if (o.bare) {
        if (kind === 'ringSticker') { g.save(); g.shadowColor = 'rgba(70,40,110,.16)'; g.shadowBlur = 16; g.shadowOffsetY = 6; g.beginPath(); g.arc(w / 2, h / 2, 70, 0, TAU); g.fillStyle = '#fff'; g.fill(); g.restore(); }
        draw(g, w, h); return;
      }
      g.save(); g.shadowColor = 'rgba(70,40,110,.14)'; g.shadowBlur = 18; g.shadowOffsetY = 7; K.rr(g, 0, 0, w, h, 22); g.fillStyle = o.fill || '#fff'; g.fill(); g.restore();
      K.rr(g, 0, 0, w, h, 22); g.lineWidth = 1; g.strokeStyle = 'rgba(42,27,61,.06)'; g.stroke();
      g.save(); K.rr(g, 0, 0, w, h, 22); g.clip(); draw(g, w, h); g.restore();
    });
  }
  function ringState(t) {
    const c = t > T3.collapse ? ease.inCubic(clamp((t - T3.collapse) / (T3.collapseEnd - T3.collapse))) : 0;
    const rot = -1.2 + .22 * (t - T3.start) + c * 2.4;
    return { c, rot };
  }
  function orbitContent(ctx, t) {
    const { c, rot } = ringState(t), N = RING.length;
    const tilt = .12 + Math.sin(t * .6) * .02;
    const items = RING.map((kind, i) => {
      const e = t - T3.start - i * .028, ent = ease.outExpo(clamp(e / .75));
      const a = i / N * TAU + rot + (1 - ease.outCubic(clamp(e / .9))) * 1.1;
      const rx = 770 * ent * (1 - c), ry = 405 * ent * (1 - c);
      const depth = Math.sin(a);
      const word = WORDS.filter(w => t >= w.t).pop();
      let hl = 0; if (word && (word.hl === kind || word.hl === '*')) { const dt = t - word.t; hl = (word.hl === '*' ? .5 : 1) * Math.exp(-dt * 3.2) * Math.sin(Math.min(dt * 14, Math.PI / 2)); }
      const sc = lerp(.25, 1, ease.outBack(clamp(e / .6), 1.3)) * (1 + depth * tilt) * (1 + hl * .14) * (1 - c * .75);
      const [fx, fy] = K.float(t, i * 1.7, 6, .6);
      return { kind, i, x: 960 + Math.cos(a) * rx + fx, y: 540 + Math.sin(a) * ry + fy, depth: depth + hl * 2, sc, al: clamp(e / .1) * (1 - clamp((c - .75) / .25)), rot: (hash(i * 3.1) - .5) * .22 + Math.sin(t * .9 + i) * .03 + (1 - ent) * .5 };
    }).sort((p, q) => p.depth - q.depth);
    items.forEach(it => {
      if (it.al <= 0 || it.sc <= .01) return;
      const sp = cardSprite(it.kind);
      ctx.save(); ctx.globalAlpha *= it.al; ctx.translate(it.x, it.y); ctx.rotate(it.rot); ctx.scale(it.sc / RES, it.sc / RES);
      ctx.drawImage(sp, -sp.width / 2, -sp.height / 2); ctx.restore();
    });
  }
  function orbitWords(ctx, t) {
    WORDS.forEach((w, k) => {
      const next = WORDS[k + 1], tOut = next ? next.t : T3.collapse;
      if (t < w.t || t > tOut + .2) return;
      const L = lay(ctx, 'w' + k, w.parts.map(p => Object.assign({ family: F.sans, color: C.ink }, p)));
      const out = clamp((t - tOut) / (next ? .14 : .4)), cs = next ? 1 : 1 - ease.inQuart(out) * .9;
      ctx.save(); ctx.translate(960, 540); ctx.scale(cs, cs); ctx.translate(-960, -540);
      drawRich(ctx, L, 960, 540 + (w.parts[0].size) * .33, (i) => {
        const q = ease.outQuart(clamp((t - w.t - i * .022) / .34));
        const o = next ? ease.inCubic(out) : ease.inQuad(out);
        return { a: q * (1 - o), dy: (1 - q) * 42 - o * 34, blur: (1 - q) * 9 + o * 8, s: .94 + .06 * q };
      });
      ctx.restore();
    });
  }
  K.addScene({
    name: 'A:orbit', start: 9, end: 13,
    draw(ctx, t) {
      K.bgWhite(ctx, t, { band: .85, bandY: 120 });
      const { c } = ringState(t);
      const burst = remap(t, 9, 9.35, .22, 0, ease.outQuad);
      const amt = c > 0 ? -c * .4 : burst;
      if (Math.abs(amt) > .002) K.zoomBlur(ctx, amt, g => orbitContent(g, t), 960, 540, 12); else orbitContent(ctx, t);
      orbitWords(ctx, t);
      K.fade(ctx, remap(t, 9, 9.22, .75, 0, ease.outQuad));
      K.fade(ctx, remap(t, 12.74, 12.95, 0, 1, ease.inQuad));
    },
  });
  // card orbit cues
  cue(9.0, 'impact_soft', .7, 0);
  cue(9.02, 'whoosh_short', .55, 0);
  for (let k = 0; k < 6; k++) cue(9.03 + k * .075, 'swish', .45 - k * .02, (k % 2 ? 1 : -1) * (.3 + k * .08));
  WORDS.forEach((w, k) => {
    if (k < 4) { cue(w.t, 'click', .6, 0); cue(w.t + .03, 'pop_soft', .5, k % 2 ? .4 : -.4); }
    else { cue(w.t, 'sparkle', .7, 0); cue(w.t + .02, 'glass_ting', .5, .1); cue(w.t, 'pop_soft', .4, -.2); }
  });
  cue(11.75, 'paper', .35, .5); cue(12.25, 'paper', .3, -.5);
  cue(T3.collapse + .12, 'swish', .5, -.2);
  cue(12.9, 'whoosh', .9, 0);

  cues.sort((a, b) => a.t - b.t);
  window.A_OPEN_CUES = cues;
})();
