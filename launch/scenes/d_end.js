/* Animator D — scenes 11 (Type C "Plan it." → "Love it.") and 12 (Logo end card).  38.0–45.0 s
 * One continuous world: a white type stage, then the camera tilts/rises up into a cloud sky where the logo resolves.
 * Both scenes call drawWorld(), which is a pure function of t.  Cue timings live in the constants below and are
 * exported as window.D_END_CUES (data/cues/d_end.json is generated from them).
 */
(function () {
  const K = window.KIT, C = K.C, F = K.F, W = K.W, H = K.H, E = K.ease, TAU = Math.PI * 2;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, p) => a + (b - a) * p;
  const inv = (a, b, v) => clamp((v - a) / (b - a));

  // ───────── timing (law: SPEC 38.0–41.0 Type C, 41.0–45.0 Logo) ─────────
  const T0 = 38.0, T1 = 41.0, T2 = 45.0;
  const TYPE_DT = 0.5 / 7;                                 // "Plan it." fully typed 38.0 → 38.5
  const tType = i => T0 + i * TYPE_DT;                     // i = 0..7
  const T_CARET_MOVE = 39.3, CARET_MOVE_DUR = 0.14;        // caret hops back to after "Plan"
  const T_CARET_BACK = 40.35;                              // caret glides back to the end
  const tDel = k => 39.5 + k * 0.07;                       // backspace n, a, l, P
  const tLove = k => 39.85 + k * 0.075;                    // type L, o, v, e
  const T_HEART = 40.2;
  const PAN0 = 40.5, PAN1 = 41.4;                          // camera tilts up into the sky (peak speed ≈ 40.95)
  const T_WHOOSH = 40.9;
  // logo
  const LOGO_W = 1000, LOGO_CX = 960, LOGO_CY = 418;
  const REV0 = 41.3, REV1 = 42.45;                         // script write-on (soft glowing mask L→R)
  const tChap = i => 42.02 + i * 0.06;                     // C H A P T E R letters settle
  const UL0 = 42.5, UL1 = 42.95;                           // gold underline draws from centre outward
  const T_TAG = 43.0, T_AVAIL = 43.6;
  const SHEEN0 = 43.25, SHEEN1 = 44.15;
  const FADE0 = 44.6, FADE1 = 44.93;                       // last frame (44.967) fully white
  // twinkles (logo-space coords of the 1270×649 logo art)
  const TWINKLES = [
    { t: 42.25, lx: 856, ly: 232, r: 34 },   // dot of the i
    { t: 42.95, lx: 835, ly: 625, r: 30 },   // underline right end
    { t: 43.05, lx: 383, ly: 625, r: 24 },   // underline left end
    { t: 43.75, lx: 520, ly: 22, r: 22 },    // top of "The" during sheen
  ];

  // ───────── sound cues (generated from the constants above) ─────────
  const CUES = [];
  const cue = (t, sfx, gain, pan = 0) => CUES.push({ t: +t.toFixed(3), sfx, gain: +gain.toFixed(2), pan: +pan.toFixed(2) });
  for (let i = 0; i < 8; i++) cue(tType(i), 'type', i === 4 ? 0.45 : 0.75, -0.25 + i * 0.07);
  cue(38.6, 'caret', 0.45);
  cue(T_CARET_MOVE, 'click', 0.6, -0.1);
  for (let k = 0; k < 4; k++) cue(tDel(k), 'type', 0.55, -0.05 - k * 0.04);
  for (let k = 0; k < 4; k++) cue(tLove(k), 'type', 0.8, -0.2 + k * 0.05);
  cue(T_CARET_BACK, 'click', 0.45, 0.1);
  cue(T_HEART, 'pop_soft', 0.65, 0.05);
  cue(T_HEART + 0.03, 'sparkle', 0.7, 0.1);
  cue(T_WHOOSH, 'whoosh', 0.9);
  cue(T1, 'impact_soft', 0.8);
  cue(41.4, 'logo_shimmer', 0.9);
  TWINKLES.forEach((w, i) => cue(w.t, 'sparkle', [0.5, 0.6, 0.45, 0.35][i], ((w.lx - 635) / 635) * 0.5));
  cue(T_TAG, 'pop_soft', 0.5);
  cue(T_AVAIL, 'pop_soft', 0.4);
  cue(T_AVAIL + 0.02, 'glass_ting', 0.35);
  CUES.sort((a, b) => a.t - b.t);
  window.D_END_CUES = CUES;
  if (!K.cache) return; // cue-export mode (node)

  // ───────── helpers ─────────
  function star4(g, x, y, r, rot, fill) {
    g.save(); g.translate(x, y); g.rotate(rot); g.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 - Math.PI / 2, b = a + Math.PI / 2;
      g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      g.quadraticCurveTo(0, 0, Math.cos(b) * r, Math.sin(b) * r);
    }
    g.closePath(); g.fillStyle = fill; g.fill(); g.restore();
  }
  /** twinkle: glow + 4-point star, life 0..1 */
  function twinkle(g, x, y, r, life, rot = 0) {
    if (life <= 0 || life >= 1) return;
    const s = Math.sin(Math.PI * life), sc = E.outBack(clamp(life * 2.2)) * (1 - E.inQuad(clamp((life - .55) / .45)));
    g.save(); g.globalAlpha *= s;
    K.blob(g, '#FFF3D6', x, y, r * 2.4, r * 2.4, .9);
    star4(g, x, y, r * sc, rot + life * .8, '#FFFFFF');
    star4(g, x, y, r * .55 * sc, rot + life * .8 + Math.PI / 4, 'rgba(230,194,122,.9)');
    g.restore();
  }

  /** cheap blur without ctx.filter (too slow in software): text drawn with faint offset ghosts */
  function ghostText(g, ch, x, y, blur) {
    if (blur < .8) { g.fillText(ch, x, y); return; }
    const a0 = g.globalAlpha, d = blur * .7;
    g.globalAlpha = a0 * .22;
    for (const [ox, oy] of [[-d, 0], [d, 0], [0, -d], [0, d], [-d * .7, -d * .7], [d * .7, d * .7]]) g.fillText(ch, x + ox, y + oy);
    g.globalAlpha = a0 * clamp(1 - blur / 10, .35, 1); g.fillText(ch, x, y); g.globalAlpha = a0;
  }
  function ghostLine(ctx, L, x, y, anim) {
    const x0 = x - L.width / 2;
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    L.glyphs.forEach((gl, i) => {
      const s = anim(i), p = gl.part; if (s.a <= .003) return;
      K.font(ctx, p.size, p.weight || 600, p.family || F.sans, p.style || 'normal');
      ctx.save(); ctx.globalAlpha *= s.a; const gx = x0 + gl.x, gy = y + (s.dy || 0);
      ctx.fillStyle = p.color || C.ink;
      if (p.grad) { const gr = ctx.createLinearGradient(x0 + L.width * .45, gy - p.size, x0 + L.width, gy); p.grad.forEach((c, k) => gr.addColorStop(k / (p.grad.length - 1), c)); ctx.fillStyle = gr; }
      ghostText(ctx, gl.ch, gx, gy, s.blur || 0); ctx.restore();
    });
  }
  /** downsample chain blur; returns a small canvas to be drawn scaled up */
  function cheapBlur(src, key, amount) {
    let f = 1, cur = src, lvl = 0;
    while (f * 2 <= Math.max(1, amount * .9) && lvl < 5) {
      f *= 2; lvl++;
      const c = K.offscreen('d:cb' + key + lvl, src.width / f, src.height / f), g = c.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, c.width, c.height);
      g.imageSmoothingQuality = 'high'; g.drawImage(cur, 0, 0, c.width, c.height); cur = c;
    }
    return cur;
  }

  /** soft cumulus sprite (white top, lilac-shadowed belly) */
  function cloudSprite(seed) {
    return K.cache('d:cloud' + seed, 900, 460, (g, w, h) => {
      const r = K.rng(seed * 31 + 7), tmp = K.canvas(w, h), t = tmp.getContext('2d');
      t.fillStyle = '#fff';
      const n = 16;
      for (let i = 0; i < n; i++) {
        const u = (i + r() * .6) / n, x = 150 + u * 600;
        const hump = Math.sin(Math.PI * u) * (110 + r() * 90);
        const rad = 55 + r() * 60 + Math.sin(Math.PI * u) * 60;
        t.beginPath(); t.arc(x, 330 - hump * .8, rad, 0, TAU); t.fill();
      }
      t.fillRect(140, 300, 620, 70);
      t.beginPath(); t.ellipse(450, 350, 330, 40, 0, 0, TAU); t.fill();
      g.filter = 'blur(16px)'; g.drawImage(tmp, 0, 0); g.filter = 'none';
      g.globalCompositeOperation = 'source-atop';
      const sh = g.createLinearGradient(0, 120, 0, 400);
      sh.addColorStop(0, 'rgba(255,248,236,0)'); sh.addColorStop(.55, 'rgba(214,206,236,.18)'); sh.addColorStop(1, 'rgba(176,166,214,.55)');
      g.fillStyle = sh; g.fillRect(0, 0, w, h);
      const hi = g.createLinearGradient(0, 40, 0, 220);
      hi.addColorStop(0, 'rgba(255,240,214,.45)'); hi.addColorStop(1, 'rgba(255,240,214,0)');
      g.fillStyle = hi; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'source-over';
    });
  }
  function cloud(g, seed, cx, cy, w, alpha = 1, flip = false) {
    if (alpha <= 0.003) return;
    const s = cloudSprite(seed), h = w * s.height / s.width;
    if (cy - h / 2 > H + 20 || cy + h / 2 < -20 || cx + w / 2 < -20 || cx - w / 2 > W + 20) return;
    g.save(); g.globalAlpha *= alpha;
    if (flip) { g.translate(cx, 0); g.scale(-1, 1); g.translate(-cx, 0); }
    g.drawImage(s, cx - w / 2, cy - h / 2, w, h); g.restore();
  }

  // camera pan: 0 → H (type stage slides down, sky comes down from above)
  const pan = t => H * E.inOutCubic(inv(PAN0, PAN1, t));
  const panVel = t => (pan(t + .004) - pan(t - .004)) / .008;

  // ───────── Type C stage ─────────
  let TL = null;
  function typeLayout(ctx) {
    if (TL) return TL;
    const size = 124;
    const sans = { size, weight: 600, family: F.sans };
    const serif = { size: size * 1.12, weight: 400, family: F.serif, style: 'italic' };
    const P = K.layout(ctx, [{ text: 'Plan', ...sans }]).glyphs;
    const R = K.layout(ctx, [{ text: ' it.', ...sans }]).glyphs;
    const L = K.layout(ctx, [{ text: 'Love', ...serif }]).glyphs;
    const items = [];
    P.forEach((g, k) => items.push({ ch: g.ch, w: g.w, part: g.part, ta: tType(k), td: tDel(3 - k), kind: 'plan' }));
    L.forEach((g, k) => items.push({ ch: g.ch, w: g.w + (k === 3 ? 20 : 0), part: g.part, ta: tLove(k), td: Infinity, kind: 'love' }));
    R.forEach((g, j) => items.push({ ch: g.ch, w: g.w, part: g.part, ta: tType(4 + j), td: Infinity, kind: 'rest' }));
    const loveW = L.reduce((s, g) => s + g.w, 0) + 20;
    return (TL = { items, size, loveW });
  }
  function presence(it, t) {
    const pin = it.kind === 'love' ? E.outQuart(clamp((t - it.ta) / .16)) : E.outQuart(clamp((t - it.ta) / .11));
    const pout = E.inOutCubic(clamp((t - it.td) / .12));
    return { pin, pout, p: pin * (1 - pout) };
  }

  function drawTypeStage(g, t) {
    const band = E.outCubic(inv(T0, T0 + .6, t));
    K.bgWhite(g, t, { bandY: (1 - band) * 220 });
    const TLy = typeLayout(g), size = TLy.size, cx = 960, base = 570;
    const appear = E.outCubic(inv(T0, T0 + .7, t)), loveK = E.inOutSine(inv(39.8, 40.5, t));
    const br = Math.sin((t - T0) * Math.PI * .9);
    // soft blurry glow behind the words (lilac + champagne → blush + gold when it becomes love)
    g.save(); g.globalAlpha = appear;
    K.blob(g, C.lilac, cx - 60 + br * 14, 520, 620 + br * 20, 230, .75 * (1 - loveK * .5));
    K.blob(g, C.champagne, cx + 120 - br * 12, 540, 420, 170, .6);
    K.blob(g, C.blush, cx - 110, 520, 460 * (.6 + .4 * loveK), 190, .75 * loveK);
    K.blob(g, C.gold2, cx - 150, 505, 260, 120, .35 * loveK);
    g.restore();

    // line (centred on the currently present glyph widths)
    const its = TLy.items, pres = its.map(it => presence(it, t));
    let total = 0, prefixW = 0, loveX0 = null;
    its.forEach((it, i) => { const w = it.w * pres[i].p; total += w; if (it.kind !== 'rest') prefixW += w; });
    const zoom = 1 + .035 * E.inOutSine(inv(38.4, 40.6, t)) + .006 * br;
    g.save(); g.translate(cx, base - size * .35); g.scale(zoom, zoom); g.translate(-cx, -(base - size * .35));
    const x0 = cx - total / 2;
    // position of "Love" slot for the gradient
    loveX0 = x0 + its.filter(it => it.kind === 'plan').reduce((s, it, i) => s + it.w * pres[i].p, 0);
    const grad = g.createLinearGradient(loveX0, base - size, loveX0 + TLy.loveW, base);
    grad.addColorStop(0, C.gold); grad.addColorStop(.55, '#D98A7E'); grad.addColorStop(1, C.rose);
    let x = x0;
    its.forEach((it, i) => {
      const { pin, pout, p } = pres[i], w = it.w * p;
      const a = it.kind === 'love' ? clamp((t - it.ta) / .07) * (1 - pout) : pin * (1 - pout);
      if (a > .003 && it.ch !== ' ') {
        const pt = it.part; K.font(g, pt.size, pt.weight, pt.family, pt.style || 'normal');
        g.save(); g.globalAlpha *= a;
        let s = 1 - .35 * pout, dy = (1 - pin) * 12 - pout * 8, blur = (1 - pin) * 7 + pout * 8;
        if (it.kind === 'love') { const sp = K.spring(t - it.ta, 3.1, .45); s = .35 + .65 * sp; dy = (1 - E.outQuart(clamp((t - it.ta) / .25))) * -26; blur = (1 - clamp((t - it.ta) / .12)) * 6; }
        const gx = x + w / 2, gy = base + dy, ccy = gy - pt.size * .35;
        g.translate(gx, ccy); g.scale(s, s); g.translate(-gx, -ccy);
        g.fillStyle = it.kind === 'love' ? grad : C.ink;
        g.textBaseline = 'alphabetic'; g.textAlign = 'left';
        ghostText(g, it.ch, x, gy, blur);
        g.restore();
      }
      x += w;
    });
    // caret
    const endX = x0 + total, slotX = x0 + prefixW;
    const cm = E.outExpo(inv(T_CARET_MOVE, T_CARET_MOVE + CARET_MOVE_DUR, t));
    const cb = E.outExpo(inv(T_CARET_BACK, T_CARET_BACK + CARET_MOVE_DUR, t));
    const caretX = lerp(lerp(endX, slotX, cm), endX, cb) + 6;
    const busy = (t >= T0 - .05 && t < 38.6) || (t >= T_CARET_MOVE - .05 && t < T_CARET_BACK + .2);
    let ca = 1;
    if (!busy) { const ph = ((t - (t < 39 ? 38.6 : T_CARET_BACK + .2)) % 1.0 + 1) % 1.0; ca = ph < .5 ? 1 : 0; ca = ph < .5 ? clamp((.5 - ph) / .06) : clamp((ph - .94) / .06); ca = Math.max(ca, ph < .44 ? 1 : 0); }
    ca *= E.outCubic(inv(T0 - .02, T0 + .08, t)) * (1 - inv(40.6, 40.8, t));
    if (ca > .01) {
      g.save(); g.globalAlpha *= ca; g.fillStyle = cm > .5 && t > 39.85 && cb < .5 ? '#C98463' : C.ink;
      K.rr(g, caretX, base - size * .8, 6, size * .98, 3); g.fill(); g.restore();
    }
    // heart sparkle above the end of "Love"
    if (t >= T_HEART - .02) {
      const lt = t - T_HEART, sp = K.spring(lt, 2.6, .38), [fx, fy] = K.float(t, 4.2, 5, .9);
      const hx = loveX0 + TLy.loveW + 14 + fx, hy = base - size * 1.12 + fy - 10 * E.outCubic(clamp(lt / .4));
      K.obj(g, 'heart', hx, hy, 62 * sp, { rot: -.22 + Math.sin(lt * 3) * .06, shadow: false });
      // burst ring of dots
      const bk = E.outCubic(clamp(lt / .5));
      if (lt < .6) for (let i = 0; i < 8; i++) {
        const an = i / 8 * TAU + .3, rr = 30 + bk * 60;
        g.save(); g.globalAlpha *= (1 - bk); g.fillStyle = i % 2 ? C.gold2 : C.rose;
        g.beginPath(); g.arc(hx + Math.cos(an) * rr, hy + Math.sin(an) * rr, 4 * (1 - bk * .5), 0, TAU); g.fill(); g.restore();
      }
      twinkle(g, hx + 46, hy - 30, 18, clamp((lt - .05) / .6), .2);
      twinkle(g, hx - 40, hy - 42, 12, clamp((lt - .15) / .55), .6);
      twinkle(g, hx + 30, hy + 36, 10, clamp((lt - .25) / .55), 1.1);
    }
    g.restore();
  }

  // ───────── sky world ─────────
  const MID = [ // seed, x, y, width, parallax
    [1, 180, 820, 900, 1], [2, 760, 900, 1000, 1.2], [3, 1500, 840, 950, 1], [4, 1120, 980, 900, 1.4],
    [5, 340, 1000, 1000, 1.3], [6, 1830, 700, 700, .8], [7, 90, 640, 620, .7], [8, 1780, 990, 900, 1.3],
  ];
  const FG = [ // sweep clouds (pass during the pan) + corner clouds that stay
    [11, 380, H + 420, 1500], [12, 1300, H + 520, 1700], [13, 900, H + 820, 1900], [14, 1650, H + 1050, 1500],
    [15, 250, H + 1100, 1600], [16, 1000, H + 1300, 1800],
    [17, 120, H + 20, 1100], [18, 1840, H + 40, 1150],
  ];
  function drawSky(g, t) {
    const lt = t - T1;
    const sunK = .45 + .2 * E.inOutSine(inv(41.0, 42.8, t));
    const sb = K.offscreen('d:sky', W / 2, H / 2), sg = sb.getContext('2d');
    sg.setTransform(.5, 0, 0, .5, 0, 0); sg.globalAlpha = 1; sg.globalCompositeOperation = 'source-over';
    const s = 1.05 + .05 * E.inOutSine(inv(40.8, 45, t));
    sg.translate(W / 2, H * .44); sg.scale(s, s); sg.translate(-W / 2, -H * .44 + 9 * lt);
    K.bgSky(sg, t, { speed: 26, sun: sunK });
    g.drawImage(sb, 0, 0, W, H);
    const sw = g.createLinearGradient(0, 0, 0, H * .7); sw.addColorStop(0, 'rgba(150,186,226,.45)'); sw.addColorStop(1, 'rgba(190,210,240,0)');
    g.fillStyle = sw; g.fillRect(0, 0, W, H);
    // warm halo behind the logo
    g.save(); g.globalCompositeOperation = 'screen';
    K.blob(g, '#FFE3B0', W * .5, H * .42, 760 + 30 * Math.sin(lt * 1.6), 460, .3 * sunK);
    g.restore();
    // mid clouds, slowly sinking (camera rising) and drifting
    MID.forEach(([sd, x, y, w, par]) => cloud(g, sd, x + lt * 10 * (sd % 2 ? 1 : -1), y + lt * 14 * par, w, .8, sd % 3 === 0));
  }

  function drawWorld(g, t) {
    const P = pan(t);
    if (P < H) {
      g.save(); g.translate(0, P);
      if (t < T1) drawTypeStage(g, t); else { g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); }
      g.restore();
    }
    if (P > 0) { g.save(); g.translate(0, P - H); g.beginPath(); g.rect(0, 0, W, H); g.clip(); drawSky(g, t); g.restore(); }
    // seam: a dense cloud bank at the boundary between stage and sky
    if (P > 0 && P < H + 300) {
      for (let i = 0; i < 9; i++) cloud(g, 21 + (i % 4), -120 + i * 270, P - 30 + (i % 2) * 70, 900, 1, i % 2 === 1);
    }
    // foreground clouds: move faster than the pan (closer to camera)
    const rise = (H - P) * 3.1, drift = 22 * Math.max(0, t - PAN1);
    FG.forEach(([sd, x, yEnd, w], i) => {
      const corner = i >= 6, y = yEnd - rise + drift * (corner ? 1 : 2) - (corner ? 0 : 0);
      cloud(g, sd, x + (corner ? (i === 6 ? -1 : 1) * drift * .6 : 0), y, w, corner ? .95 : 1, i % 2 === 1);
    });
  }

  function drawWorldBlurred(ctx, t) {
    const v = Math.abs(panVel(t));
    if (v < 150) { drawWorld(ctx, t); return; }
    // fast vertical move: render at half resolution (it is motion-blurred anyway) and smear along y
    const hr = v > 900, sc = hr ? .5 : 1;
    const b = K.offscreen('d:world' + (hr ? 'h' : ''), W * sc, H * sc), g = b.getContext('2d');
    g.setTransform(sc, 0, 0, sc, 0, 0); g.globalAlpha = 1; g.filter = 'none'; g.clearRect(0, 0, W, H);
    drawWorld(g, t);
    const spread = v * .024, n = 8;
    ctx.save(); ctx.drawImage(b, 0, 0, W, H);
    for (let i = 1; i < n; i++) { ctx.globalAlpha = 1 / (i + 1); ctx.drawImage(b, 0, -spread * i / (n - 1), W, H); }
    ctx.restore();
  }

  // ───────── logo ─────────
  function logoSprites() {
    const L = window.LOGO;
    const ink = K.cache('d:logoInk', L.w, L.h, g => { g.drawImage(L.inkImg, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = C.ink; g.fillRect(0, 0, L.w, L.h); });
    const gink = K.cache('d:logoGoldInk', L.w, L.h, g => {
      g.drawImage(L.inkImg, 0, 0); g.globalCompositeOperation = 'source-in';
      const gr = g.createLinearGradient(0, 0, 0, L.h); gr.addColorStop(0, '#F2D494'); gr.addColorStop(1, C.gold);
      g.fillStyle = gr; g.fillRect(0, 0, L.w, L.h);
    });
    return { L, ink, gink };
  }
  const CHAP = [[310, 356], [408, 448], [497, 546], [595, 631], [678, 718], [768, 802], [854, 891]];
  const CH_Y = 485, CH_H = 75;
  function scriptClip(g, L) { g.beginPath(); g.rect(0, 0, L.w, L.h); g.rect(300, CH_Y, 600, CH_H); g.clip('evenodd'); }

  function drawLogo(ctx, t) {
    if (!window.LOGO || !window.LOGO.inkImg) return null;
    const { L, ink, gink } = logoSprites();
    const b = K.offscreen('d:logo', L.w, L.h), g = b.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.filter = 'none'; g.globalCompositeOperation = 'source-over';
    g.clearRect(0, 0, L.w, L.h);
    const rp = E.outQuad(inv(REV0, REV1, t)), soft = 260;
    const e = lerp(60, L.w + soft + 40, rp);   // leading edge (x at which alpha hits 0)
    if (rp > 0) {
      g.save(); scriptClip(g, L); g.drawImage(ink, 0, 0); g.restore();
      if (rp < 1) {
        g.globalCompositeOperation = 'destination-in';
        const m = g.createLinearGradient(e - soft, -soft * .35, e, soft * .35);
        m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = m; g.fillRect(0, 0, L.w, L.h); g.globalCompositeOperation = 'source-over';
        // golden leading edge: gold ink in a band just behind the edge
        const eb = K.offscreen('d:logoEdge', L.w, L.h), eg = eb.getContext('2d');
        eg.setTransform(1, 0, 0, 1, 0, 0); eg.globalCompositeOperation = 'source-over'; eg.clearRect(0, 0, L.w, L.h);
        eg.save(); scriptClip(eg, L); eg.drawImage(gink, 0, 0); eg.restore();
        eg.globalCompositeOperation = 'destination-in';
        const bm = eg.createLinearGradient(e - soft * 1.3, -soft * .45, e - 20, soft * .3);
        bm.addColorStop(0, 'rgba(0,0,0,0)'); bm.addColorStop(.65, 'rgba(0,0,0,.95)'); bm.addColorStop(1, 'rgba(0,0,0,0)');
        eg.fillStyle = bm; eg.fillRect(0, 0, L.w, L.h);
        g.drawImage(eb, 0, 0);
      }
    }
    // CHAPTER: letters close in from wide tracking and rise
    CHAP.forEach(([a, z], i) => {
      const k = E.outCubic(inv(tChap(i), tChap(i) + .55, t)); if (k <= 0) return;
      const mid = (a + z) / 2, dx = (mid - 600) * .45 * (1 - k), dy = (1 - k) * 20;
      g.save(); g.globalAlpha = k; g.drawImage(ink, a - 6, CH_Y, z - a + 12, CH_H, a - 6 + dx, CH_Y + dy, z - a + 12, CH_H); g.restore();
    });
    // gold underline from the centre outward
    const uk = E.outCubic(inv(UL0, UL1, t)), ucx = 609, half = 232 * uk;
    if (uk > 0) g.drawImage(L.goldImg, ucx - half, 598, half * 2, 51, ucx - half, 598, half * 2, 51);
    // sheen across everything
    const sk = inv(SHEEN0, SHEEN1, t);
    if (sk > 0 && sk < 1) {
      const sx = lerp(-300, L.w + 300, E.inOutSine(sk));
      g.globalCompositeOperation = 'source-atop';
      const sg = g.createLinearGradient(sx - 140, -80, sx + 140, 80);
      sg.addColorStop(0, 'rgba(214,168,86,0)'); sg.addColorStop(.42, 'rgba(226,184,104,.85)'); sg.addColorStop(.5, 'rgba(255,238,200,.95)'); sg.addColorStop(.58, 'rgba(226,184,104,.85)'); sg.addColorStop(1, 'rgba(214,168,86,0)');
      g.fillStyle = sg; g.fillRect(0, 0, L.w, L.h); g.globalCompositeOperation = 'source-over';
    }
    // composite onto the frame
    const settle = E.outCubic(inv(REV0, 43.4, t));
    const sc = (LOGO_W / L.w) * lerp(1.06, 1, settle) * (1 + .006 * Math.sin((t - T1) * TAU / 2.6));
    const cy = LOGO_CY + 16 * (1 - settle), blur = 11 * (1 - E.outCubic(inv(REV0, 42.7, t)));
    const w = L.w * sc, h = L.h * sc;
    ctx.save();
    ctx.globalAlpha *= E.outCubic(inv(REV0 - .1, REV0 + .35, t));
    if (blur > .3) {
      const bk = clamp(blur / 4), lo = cheapBlur(b, 'logo', blur / sc);
      ctx.drawImage(lo, LOGO_CX - w / 2, cy - h / 2, w, h);
      if (bk < 1) { ctx.globalAlpha *= 1 - bk; ctx.drawImage(b, LOGO_CX - w / 2, cy - h / 2, w, h); }
    } else ctx.drawImage(b, LOGO_CX - w / 2, cy - h / 2, w, h);
    ctx.restore();
    // edge glow travelling with the write-on
    if (rp > 0 && rp < 1) {
      const ex = LOGO_CX - w / 2 + (e - soft * .55) * sc;
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      K.blob(ctx, '#FFE7B8', ex, cy - 30, 170, 300, .55 * Math.sin(Math.PI * rp));
      ctx.restore();
    }
    // underline end sparks while drawing
    if (uk > 0 && uk < 1) {
      const y = cy - h / 2 + 625 * sc;
      for (const sgn of [-1, 1]) { const x = LOGO_CX - w / 2 + (ucx + sgn * half) * sc; K.blob(ctx, '#FFF1CF', x, y, 40, 40, .9 * (1 - uk)); star4(ctx, x, y, 14 * (1 - uk * .5), t * 3, 'rgba(255,255,255,.95)'); }
    }
    TWINKLES.forEach((tw, i) => twinkle(ctx, LOGO_CX - w / 2 + tw.lx * sc, cy - h / 2 + tw.ly * sc, tw.r, inv(tw.t - .05, tw.t + .6, t), i * .7));
    return { w, h, cy };
  }

  let TAGL = null, AVL = null;
  function drawEndText(ctx, t) {
    if (!TAGL) {
      TAGL = K.layout(ctx, [
        { text: 'Plan the day. ', size: 46, weight: 500, family: F.sans, color: C.ink },
        { text: 'Love the story.', size: 52, weight: 400, family: F.serif, style: 'italic', grad: [C.gold, '#D98A7E', C.rose] },
      ]);
      AVL = K.layout(ctx, [{ text: 'AVAILABLE NOW', size: 20, weight: 600, family: F.caps, color: C.gold }], 7);
    }
    const bt = Math.sin((t - T1) * TAU / 3.2);
    if (t >= T_TAG) ghostLine(ctx, TAGL, 960, 778 + bt * 1.5, i => { const k = E.outQuart(clamp((t - T_TAG - i * .018) / .6)); return { a: k, dy: (1 - k) * 26, blur: (1 - k) * 8 }; });
    if (t >= T_AVAIL) {
      const lt = t - T_AVAIL, y = 846;
      ghostLine(ctx, AVL, 960 + 3.5, y, i => { const k = E.outQuart(clamp((lt - Math.abs(i - 6) * .03) / .5)); return { a: k, dy: (1 - k) * 10, blur: (1 - k) * 5 }; });
      const lk = E.outQuart(clamp((lt - .15) / .7)), half = AVL.width / 2 + 26;
      ctx.save(); ctx.globalAlpha *= lk; ctx.fillStyle = C.gold2;
      ctx.fillRect(960 - half - 70 * lk, y - 8, 70 * lk, 1.5); ctx.fillRect(960 + half, y - 8, 70 * lk, 1.5);
      ctx.restore();
    }
  }

  // ───────── scenes ─────────
  K.addScene({
    name: 'd_typeC', start: T0, end: T1,
    draw(ctx, t) {
      drawWorldBlurred(ctx, t);
      // hand-off from scene 10's blur-zoom: its last frame keeps expanding and dissolves into white
      if (t < T0 + .3) {
        const p = E.outCubic(inv(T0, T0 + .3, t)), snap = K.snapshot(T0 - .001), s = 1 + .12 * p;
        ctx.save(); ctx.globalAlpha = 1 - p; ctx.translate(W / 2, H / 2); ctx.scale(s, s); ctx.drawImage(cheapBlur(snap, 'snap', 4 + 14 * p), -W / 2, -H / 2, W, H); ctx.restore();
      }
    },
  });
  K.addScene({
    name: 'd_logo', start: T1, end: T2,
    draw(ctx, t) {
      drawWorldBlurred(ctx, t);
      // the logo emerges out of a soft cloud veil
      const veil = 1 - E.inOutSine(inv(41.05, 42.5, t));
      if (veil > 0) { ctx.save(); K.blob(ctx, '#FFFFFF', LOGO_CX, LOGO_CY, 700 + 500 * (1 - veil), 380 + 200 * (1 - veil), .6 * veil); ctx.restore(); }
      drawLogo(ctx, t);
      drawEndText(ctx, t);
      K.fade(ctx, E.inOutSine(inv(FADE0, FADE1, t)));
    },
  });
})();
