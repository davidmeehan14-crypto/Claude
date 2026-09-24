/* The Wedding Chapter — launch film motion kit.
 * Pure function of time. Scenes: KIT.addScene({ name, start, end, draw(ctx, t, lt, dur) }) draw the FULL frame.
 * Canvas 1920×1080. Everything deterministic (no Math.random / Date).
 */
(function () {
  const W = 1920, H = 1080, FPS = 30, DURATION = 45, TAU = Math.PI * 2, BEAT = 0.5;
  const C = {
    white: '#FFFFFF', cream: '#FBF7F2', ink: '#2A1B3D', ink2: '#6B5A7E', ink3: '#A79BB5', line: '#ECE6F0',
    gold: '#B88A3E', gold2: '#E6C27A', rose: '#E07A93', blush: '#F6C9D0', champagne: '#F3DDB8',
    lilac: '#D9CCF5', lavender: '#B9A6F0', peach: '#FAD7C3', sage: '#BFD8C2', sky: '#CFE3F5', mint: '#9ED9B8',
  };
  const F = {
    sans: '"Plus Jakarta Sans", "Inter", system-ui, sans-serif',
    serif: '"Fraunces", Georgia, serif',
    caps: '"Montserrat", "Plus Jakarta Sans", sans-serif',
  };

  // ───────────── math ─────────────
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, p) => a + (b - a) * p;
  const invLerp = (a, b, v) => clamp((v - a) / (b - a));
  const ease = {
    linear: p => p,
    inQuad: p => p * p, outQuad: p => 1 - (1 - p) * (1 - p), inOutQuad: p => (p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2),
    inCubic: p => p ** 3, outCubic: p => 1 - Math.pow(1 - p, 3), inOutCubic: p => (p < .5 ? 4 * p ** 3 : 1 - Math.pow(-2 * p + 2, 3) / 2),
    outQuart: p => 1 - Math.pow(1 - p, 4), inQuart: p => p ** 4, inOutQuart: p => (p < .5 ? 8 * p ** 4 : 1 - Math.pow(-2 * p + 2, 4) / 2),
    outQuint: p => 1 - Math.pow(1 - p, 5), inOutQuint: p => (p < .5 ? 16 * p ** 5 : 1 - Math.pow(-2 * p + 2, 5) / 2),
    inExpo: p => (p === 0 ? 0 : Math.pow(2, 10 * p - 10)), outExpo: p => (p === 1 ? 1 : 1 - Math.pow(2, -10 * p)),
    inOutExpo: p => p === 0 ? 0 : p === 1 ? 1 : p < .5 ? Math.pow(2, 20 * p - 10) / 2 : (2 - Math.pow(2, -20 * p + 10)) / 2,
    inOutSine: p => -(Math.cos(Math.PI * p) - 1) / 2, outSine: p => Math.sin(p * Math.PI / 2), inSine: p => 1 - Math.cos(p * Math.PI / 2),
    outBack: (p, s = 1.70158) => 1 + (s + 1) * Math.pow(p - 1, 3) + s * Math.pow(p - 1, 2),
    inBack: (p, s = 1.70158) => (s + 1) * p ** 3 - s * p * p,
  };
  /** remap v∈[a,b] → [c,d] with easing, clamped */
  const remap = (v, a, b, c = 0, d = 1, e = ease.linear) => lerp(c, d, e(invLerp(a, b, v)));
  function spring(dt, freq = 2.6, damp = 0.42) {
    if (dt <= 0) return 0;
    const w = TAU * freq; return 1 - Math.exp(-damp * w * dt) * Math.cos(w * Math.sqrt(1 - damp * damp) * dt);
  }
  const pulse = (t, a, b) => (t < a || t > b ? 0 : Math.sin(Math.PI * (t - a) / (b - a)));
  function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return x - Math.floor(x); }
  function rng(seed) {
    let s = (seed * 2654435761) >>> 0;
    return function () { s |= 0; s = (s + 0x6D2B79F5) | 0; let r = Math.imul(s ^ (s >>> 15), 1 | s); r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r; return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
  }
  function noise1(x, seed = 0) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash(i + seed * 57.3), hash(i + 1 + seed * 57.3), u) * 2 - 1; }
  /** gentle floating drift for hovering objects */
  const float = (t, seed, amp = 10, speed = .6) => [noise1(t * speed, seed) * amp, noise1(t * speed, seed + 9.1) * amp];

  // ───────────── canvases ─────────────
  const _c = {};
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = Math.ceil(w); c.height = Math.ceil(h); return c; }
  function offscreen(key, w = W, h = H) { const c = _c['o:' + key]; if (c && c.width === Math.ceil(w) && c.height === Math.ceil(h)) return c; return (_c['o:' + key] = canvas(w, h)); }
  /** cache(key, w, h, draw) → canvas drawn once */
  function cache(key, w, h, draw) { if (_c['k:' + key]) return _c['k:' + key]; const c = canvas(w, h); draw(c.getContext('2d'), w, h); return (_c['k:' + key] = c); }
  function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }

  // ───────────── backgrounds ─────────────
  function blobSprite(color, alpha = 1) {
    return cache('blob:' + color + alpha, 512, 512, (g) => {
      const gr = g.createRadialGradient(256, 256, 0, 256, 256, 256);
      const rgb = hexRgb(color);
      gr.addColorStop(0, `rgba(${rgb},${alpha})`); gr.addColorStop(.45, `rgba(${rgb},${alpha * .6})`); gr.addColorStop(1, `rgba(${rgb},0)`);
      g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
    });
  }
  function hexRgb(h) { const n = parseInt(h.slice(1), 16); return `${n >> 16},${(n >> 8) & 255},${n & 255}`; }
  function blob(ctx, color, x, y, rx, ry = rx, alpha = 1) { ctx.drawImage(blobSprite(color, alpha), x - rx, y - ry, rx * 2, ry * 2); }
  /** Clean white stage with the soft pastel "cloud band" along the bottom (the reference's signature). */
  function bgWhite(ctx, t, o = {}) {
    ctx.fillStyle = o.base || C.white; ctx.fillRect(0, 0, W, H);
    const band = o.band == null ? 1 : o.band; if (band <= 0) return;
    const y0 = H + (o.bandY || 0);
    const cols = o.colors || [C.lilac, C.blush, C.lavender, C.peach, C.lilac, C.champagne, C.lavender, C.blush];
    ctx.save(); ctx.globalAlpha = band;
    for (let i = 0; i < 14; i++) {
      const u = i / 13, x = lerp(-150, W + 150, u) + noise1(t * .25 + i, i) * 90, y = y0 - 40 - hash(i) * 140 + noise1(t * .3, i + 5) * 30;
      const r = 260 + hash(i + 3) * 220;
      blob(ctx, cols[i % cols.length], x, y, r * 1.3, r * .75, .9);
    }
    // wispy tops
    for (let i = 0; i < 10; i++) { const x = hash(i + 20) * W + noise1(t * .2, i + 30) * 120, y = y0 - 190 - hash(i + 40) * 90; blob(ctx, cols[(i + 2) % cols.length], x, y, 200, 70, .5); }
    ctx.restore();
  }
  /** Airy pastel mesh gradient world (hero / demo backgrounds). */
  function bgMesh(ctx, t, o = {}) {
    ctx.fillStyle = o.base || '#FDF9FB'; ctx.fillRect(0, 0, W, H);
    const pts = o.blobs || [
      [C.lavender, .12, .2, 820], [C.lilac, .85, .15, 760], [C.peach, .9, .85, 820], [C.blush, .2, .9, 760], [C.champagne, .55, .55, 620], [C.lilac, .5, 1.05, 700],
    ];
    pts.forEach(([col, u, v, r], i) => {
      const [dx, dy] = float(t, i * 3.7, 120, .18);
      blob(ctx, col, u * W + dx, v * H + dy, r, r * .9, o.alpha == null ? .95 : o.alpha);
    });
  }
  /** Soft sky with clouds (logo end card). p = sun intensity */
  function bgSky(ctx, t, o = {}) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#C9DDF0'); g.addColorStop(.45, '#E9EEF6'); g.addColorStop(1, '#FBF1E6');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const drift = t * (o.speed || 18);
    const r = rng(77);
    for (let i = 0; i < 46; i++) {
      const layer = i % 3, sp = .4 + layer * .5;
      const x = ((r() * (W + 800) + drift * sp) % (W + 800)) - 400, y = H * (.35 + r() * .75) + layer * 30;
      const s = 180 + r() * 260 + layer * 60;
      blob(ctx, '#FFFFFF', x, y, s * 1.5, s * .55, .55 + layer * .15);
    }
    const sun = o.sun == null ? 1 : o.sun;
    if (sun > 0) { ctx.save(); ctx.globalCompositeOperation = 'screen'; blob(ctx, '#FFE7B8', W * .5, H * .44, 900, 700, .55 * sun); blob(ctx, '#FFFFFF', W * .5, H * .44, 380, 300, .7 * sun); ctx.restore(); }
  }

  // ───────────── text ─────────────
  function font(ctx, size, weight = 600, family = F.sans, style = 'normal') { ctx.font = `${style} ${weight} ${size}px ${family}`; }
  /**
   * Rich line layout. parts: [{ text, size, weight, family, style, color, gap }] → glyph list with x offsets.
   * Returns { width, glyphs: [{ch, x, w, part}] } measured left-to-right from 0.
   */
  function layout(ctx, parts, letterSpacing = 0) {
    const glyphs = []; let x = 0;
    parts.forEach((p, pi) => {
      font(ctx, p.size, p.weight || 600, p.family || F.sans, p.style || 'normal');
      if (p.gap) x += p.gap;
      let prefix = '';
      for (const ch of p.text) {
        const before = ctx.measureText(prefix).width; prefix += ch; const after = ctx.measureText(prefix).width;
        glyphs.push({ ch, x: x + before + glyphs.filter(g => g.pi === pi).length * letterSpacing, w: after - before, part: p, pi });
      }
      x += ctx.measureText(p.text).width + p.text.length * letterSpacing;
    });
    return { width: x, glyphs };
  }
  /**
   * Draw a laid-out line. anim(i, glyph) → { a, dx, dy, s, blur } per glyph. align: 'center'|'left'.
   */
  function drawLine(ctx, L, x, y, anim, align = 'center') {
    const x0 = align === 'center' ? x - L.width / 2 : align === 'right' ? x - L.width : x;
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    L.glyphs.forEach((g, i) => {
      const s = anim ? anim(i, g) : {}; const a = s.a == null ? 1 : s.a; if (a <= 0.003) return;
      const p = g.part; font(ctx, p.size, p.weight || 600, p.family || F.sans, p.style || 'normal');
      ctx.save(); ctx.globalAlpha *= a;
      const gx = x0 + g.x + (s.dx || 0), gy = y + (s.dy || 0);
      if (s.s != null && s.s !== 1) { ctx.translate(gx + g.w / 2, gy - p.size * .35); ctx.scale(s.s, s.s); ctx.translate(-(gx + g.w / 2), -(gy - p.size * .35)); }
      if (s.blur) ctx.filter = `blur(${s.blur.toFixed(1)}px)`;
      ctx.fillStyle = s.color || p.color || C.ink;
      if (p.grad) { const gr = ctx.createLinearGradient(gx, gy - p.size, gx + g.w, gy); p.grad.forEach((c, k) => gr.addColorStop(k / (p.grad.length - 1), c)); ctx.fillStyle = gr; }
      ctx.fillText(g.ch, gx, gy);
      ctx.restore();
    });
    return x0;
  }
  /** Typewriter reveal helper: n chars visible at time lt with cps chars/sec; returns caret x. */
  function typeAnim(lt, cps = 22, soft = true) {
    return (i) => { const ti = i / cps; const k = clamp((lt - ti) / .08); return { a: soft ? k : (k > 0 ? 1 : 0), dy: soft ? (1 - k) * 6 : 0 }; };
  }
  function caret(ctx, x, y, size, t, color = C.ink, on = true) {
    if (!on) return; if (Math.floor(t * 2.2) % 2 === 1) return;
    ctx.fillStyle = color; ctx.fillRect(x + 4, y - size * .78, Math.max(2, size * .045), size * .92);
  }
  /** Rise-and-unblur reveal per glyph starting at t0 with stagger. */
  function riseAnim(lt, stagger = .025, dur = .5, dist = 40) {
    return (i) => { const k = ease.outQuart(clamp((lt - i * stagger) / dur)); return { a: k, dy: (1 - k) * dist, blur: (1 - k) * 8 }; };
  }

  // ───────────── logo ─────────────
  /** Draw the real logo centred at (cx,cy) with given width. o: {ink, gold, alpha, reveal (0..1 L→R wipe)} */
  function logo(ctx, cx, cy, w, o = {}) {
    const L = window.LOGO; if (!L || !L.inkImg) return;
    const h = w * L.h / L.w, x = cx - w / 2, y = cy - h / 2;
    const key = 'logo:' + (o.ink || 'orig') + (o.gold || 'orig');
    const sprite = cache(key, L.w, L.h, (g) => {
      g.drawImage(L.inkImg, 0, 0); if (o.ink) { g.globalCompositeOperation = 'source-in'; g.fillStyle = o.ink; g.fillRect(0, 0, L.w, L.h); g.globalCompositeOperation = 'source-over'; }
      const gc = canvas(L.w, L.h), gg = gc.getContext('2d'); gg.drawImage(L.goldImg, 0, 0);
      if (o.gold) { gg.globalCompositeOperation = 'source-in'; gg.fillStyle = o.gold; gg.fillRect(0, 0, L.w, L.h); }
      g.drawImage(gc, 0, 0);
    });
    ctx.save(); ctx.globalAlpha *= (o.alpha == null ? 1 : o.alpha);
    if (o.reveal != null && o.reveal < 1) { ctx.beginPath(); ctx.rect(x - 20, y - 20, (w + 40) * clamp(o.reveal), h + 40); ctx.clip(); }
    ctx.drawImage(sprite, x, y, w, h); ctx.restore();
    return { x, y, w, h };
  }

  // ───────────── glossy 3D objects (pre-rendered sprites, 400×400) ─────────────
  const OBJ = {};
  function shade(g, x, y, r, c0, c1, c2) { const gr = g.createRadialGradient(x - r * .35, y - r * .4, r * .05, x, y, r * 1.1); gr.addColorStop(0, c0); gr.addColorStop(.55, c1); gr.addColorStop(1, c2); return gr; }
  function spec(g, x, y, rx, ry, rot = -.5, a = .8) { g.save(); g.translate(x, y); g.rotate(rot); const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx); gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.scale(1, ry / rx); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, TAU); g.fill(); g.restore(); }
  function heartPath(g, x, y, s) {
    g.beginPath(); g.moveTo(x, y + s * .35);
    g.bezierCurveTo(x - s * .05, y + s * .3, x - s * .5, y + s * .05, x - s * .5, y - s * .18);
    g.bezierCurveTo(x - s * .5, y - s * .42, x - s * .22, y - s * .5, x, y - s * .28);
    g.bezierCurveTo(x + s * .22, y - s * .5, x + s * .5, y - s * .42, x + s * .5, y - s * .18);
    g.bezierCurveTo(x + s * .5, y + s * .05, x + s * .05, y + s * .3, x, y + s * .35); g.closePath();
  }
  OBJ.heart = g => { heartPath(g, 200, 215, 300); g.fillStyle = shade(g, 170, 170, 190, '#FFC2CF', '#F2728F', '#B83A5E'); g.fill(); spec(g, 130, 130, 60, 34, -.7, .9); spec(g, 265, 250, 40, 20, -.6, .25); };
  OBJ.ring = g => {
    g.save(); g.translate(200, 230);
    // band (torus as thick ellipse stroke with gradient)
    const band = g.createLinearGradient(-120, -80, 120, 80); band.addColorStop(0, '#FFF1C9'); band.addColorStop(.3, '#E6B85C'); band.addColorStop(.55, '#FFF4D6'); band.addColorStop(.8, '#B98526'); band.addColorStop(1, '#8A5E14');
    g.lineWidth = 34; g.strokeStyle = band; g.beginPath(); g.ellipse(0, 0, 120, 92, 0, 0, TAU); g.stroke();
    g.lineWidth = 6; g.strokeStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.ellipse(0, -4, 120, 90, 0, Math.PI * 1.1, Math.PI * 1.7); g.stroke();
    // diamond
    g.translate(0, -110);
    const facets = [[-58, 0, -30, -40, 0, 0], [-30, -40, 0, -48, 0, 0], [0, -48, 30, -40, 0, 0], [30, -40, 58, 0, 0, 0], [-58, 0, 0, 0, 0, 62], [0, 0, 58, 0, 0, 62]];
    const cols = ['#E9F4FF', '#FFFFFF', '#CFE6FF', '#A9CCF2', '#D8ECFF', '#8FB6E6'];
    facets.forEach((f, i) => { g.beginPath(); g.moveTo(f[0], f[1]); g.lineTo(f[2], f[3]); g.lineTo(f[4], f[5]); g.closePath(); g.fillStyle = cols[i]; g.fill(); g.lineWidth = 1.5; g.strokeStyle = 'rgba(120,160,210,.5)'; g.stroke(); });
    g.fillStyle = '#E6B85C'; g.fillRect(-14, 58, 28, 16);
    g.restore(); spec(g, 170, 80, 26, 14, -.3, 1);
  };
  OBJ.coupe = g => {
    g.save(); g.translate(200, 140);
    // bowl
    g.beginPath(); g.moveTo(-120, 0); g.quadraticCurveTo(0, 150, 120, 0); g.closePath();
    const bowl = g.createLinearGradient(0, 0, 0, 100); bowl.addColorStop(0, 'rgba(255,226,150,.95)'); bowl.addColorStop(1, 'rgba(230,170,70,.95)'); g.fillStyle = bowl; g.fill();
    g.beginPath(); g.ellipse(0, 0, 120, 20, 0, 0, TAU); g.fillStyle = 'rgba(255,240,200,.95)'; g.fill(); g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,.9)'; g.stroke();
    for (let i = 0; i < 7; i++) { g.beginPath(); g.arc(-50 + i * 17, 30 + (i % 3) * 14, 4, 0, TAU); g.fillStyle = 'rgba(255,255,255,.8)'; g.fill(); }
    // stem & foot
    const glass = g.createLinearGradient(-10, 0, 10, 0); glass.addColorStop(0, 'rgba(200,215,235,.9)'); glass.addColorStop(.5, 'rgba(255,255,255,.95)'); glass.addColorStop(1, 'rgba(180,195,220,.9)');
    g.fillStyle = glass; g.fillRect(-7, 72, 14, 120);
    g.beginPath(); g.ellipse(0, 196, 70, 16, 0, 0, TAU); g.fill();
    g.restore(); spec(g, 130, 150, 40, 12, -.2, .9);
  };
  OBJ.envelope = g => {
    g.save(); g.translate(200, 210); g.rotate(-.08);
    rr(g, -150, -95, 300, 190, 18); g.fillStyle = shade(g, -40, -60, 260, '#FFFFFF', '#F7EFE4', '#E3D3BD'); g.fill();
    g.beginPath(); g.moveTo(-150, -85); g.lineTo(0, 20); g.lineTo(150, -85); g.lineWidth = 5; g.strokeStyle = 'rgba(190,160,120,.45)'; g.stroke();
    g.beginPath(); g.moveTo(-150, 90); g.lineTo(-30, -5); g.moveTo(150, 90); g.lineTo(30, -5); g.lineWidth = 3; g.strokeStyle = 'rgba(190,160,120,.25)'; g.stroke();
    // wax seal
    g.beginPath(); g.arc(0, 18, 38, 0, TAU); g.fillStyle = shade(g, -10, 5, 40, '#F59AAE', '#D9486E', '#9E2448'); g.fill();
    heartPath(g, 0, 20, 36); g.fillStyle = 'rgba(255,255,255,.35)'; g.fill();
    g.restore(); spec(g, 120, 140, 70, 20, -.2, .7);
  };
  OBJ.cake = g => {
    const tier = (y, w, h) => { rr(g, 200 - w / 2, y, w, h, 16); const gr = g.createLinearGradient(200 - w / 2, 0, 200 + w / 2, 0); gr.addColorStop(0, '#FFFFFF'); gr.addColorStop(.6, '#FBF3EE'); gr.addColorStop(1, '#E9DAD2'); g.fillStyle = gr; g.fill(); g.fillStyle = '#F4A9BA'; g.fillRect(200 - w / 2, y + h - 22, w, 12); };
    tier(250, 260, 100); tier(170, 200, 90); tier(98, 140, 80);
    for (const [x, y] of [[170, 92], [200, 84], [232, 92]]) { g.beginPath(); g.arc(x, y, 14, 0, TAU); g.fillStyle = shade(g, x, y, 14, '#FFD3DD', '#F07C98', '#C04465'); g.fill(); }
    spec(g, 150, 120, 30, 10, 0, .8);
  };
  OBJ.rose = g => {
    g.save(); g.translate(200, 200);
    for (let k = 3; k >= 0; k--) {
      const n = 5 + k, R = 50 + k * 34;
      for (let i = 0; i < n; i++) { const a = i / n * TAU + k * .5; g.save(); g.rotate(a); g.beginPath(); g.ellipse(0, -R * .55, R * .42, R * .55, 0, 0, TAU); g.fillStyle = shade(g, 0, -R * .7, R * .6, ['#FFE3E8', '#FFD0DA', '#FBB6C6', '#F59AB0'][k], ['#F6A8BA', '#F0879F', '#E66C8A', '#D85678'][k], ['#D86F8C', '#C9577A', '#B8456A', '#A2375C'][k]); g.fill(); g.restore(); }
    }
    g.beginPath(); g.arc(0, 0, 36, 0, TAU); g.fillStyle = shade(g, -8, -8, 36, '#FFDCE4', '#E86F8E', '#A83A5F'); g.fill();
    g.restore();
  };
  OBJ.calendar = g => {
    g.save(); g.translate(200, 205); g.rotate(.06);
    rr(g, -125, -120, 250, 250, 40); g.fillStyle = shade(g, -40, -60, 260, '#FFFFFF', '#F6F1FA', '#DCD2E8'); g.fill();
    g.save(); rr(g, -125, -120, 250, 78, [40, 40, 0, 0]); g.clip(); g.fillStyle = shade(g, -40, -120, 200, '#FFB7C6', '#EE7390', '#C44B6C'); g.fillRect(-125, -120, 250, 80); g.restore();
    font(g, 34, 700, F.sans); g.textAlign = 'center'; g.fillStyle = '#fff'; g.fillText('JUNE', 0, -68);
    font(g, 124, 800, F.sans); g.fillStyle = C.ink; g.fillText('14', 0, 90);
    g.restore(); spec(g, 120, 110, 50, 16, -.2, .7);
  };
  OBJ.gift = g => {
    g.save(); g.translate(200, 215);
    rr(g, -120, -60, 240, 170, 22); g.fillStyle = shade(g, -40, -30, 220, '#EFE6FF', '#B9A2F2', '#7F63C9'); g.fill();
    rr(g, -135, -105, 270, 60, 18); g.fillStyle = shade(g, -40, -100, 220, '#F5EEFF', '#C8B4F6', '#8C70D6'); g.fill();
    g.fillStyle = '#F2C35E'; g.fillRect(-18, -105, 36, 215);
    for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 44, -122, 48, 26, s * .5, 0, TAU); g.fillStyle = shade(g, s * 30, -130, 50, '#FFE7A8', '#F2B640', '#B97F16'); g.fill(); }
    g.restore(); spec(g, 130, 150, 50, 16, -.3, .6);
  };
  OBJ.star = g => {
    g.save(); g.translate(200, 200); g.beginPath();
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 - Math.PI / 2; g.lineTo(Math.cos(a) * 170, Math.sin(a) * 170); g.quadraticCurveTo(0, 0, Math.cos(a + Math.PI / 2) * 170, Math.sin(a + Math.PI / 2) * 170); }
    g.closePath(); g.fillStyle = shade(g, -30, -40, 170, '#FFF6D8', '#F2C35E', '#C08A22'); g.fill(); g.restore(); spec(g, 175, 150, 34, 16, -.6, .9);
  };
  OBJ.bouquet = g => {
    g.save(); g.translate(200, 200);
    g.fillStyle = '#8DBF95'; for (const a of [-.5, -.2, .2, .5]) { g.save(); g.rotate(a); g.beginPath(); g.ellipse(0, -110, 26, 70, 0, 0, TAU); g.fill(); g.restore(); }
    g.beginPath(); g.moveTo(-40, 40); g.lineTo(40, 40); g.lineTo(18, 180); g.lineTo(-18, 180); g.closePath(); g.fillStyle = shade(g, -10, 60, 120, '#FFF3E4', '#EAD7BD', '#C8AE8A'); g.fill();
    const fl = [[-60, -30, '#F7B6C5'], [55, -40, '#FFFFFF'], [0, -80, '#F2A0B4'], [-20, 10, '#FFE0A8'], [40, 15, '#F7B6C5'], [-70, -90, '#D9CCF5'], [70, -100, '#FFE0A8']];
    for (const [x, y, c] of fl) { g.beginPath(); g.arc(x, y, 44, 0, TAU); g.fillStyle = shade(g, x - 10, y - 10, 44, '#FFFFFF', c, '#C98C9E'); g.fill(); }
    g.fillStyle = '#E07A93'; g.fillRect(-45, 70, 90, 16);
    g.restore();
  };
  function objSprite(name) { return cache('obj:' + name, 400, 400, (g) => { g.save(); OBJ[name](g); g.restore(); }); }
  /** Glossy 3D object with soft contact shadow. size = px width. */
  function obj(ctx, name, x, y, size, o = {}) {
    const s = objSprite(name), a = o.alpha == null ? 1 : o.alpha; if (a <= 0 || size <= 1) return;
    ctx.save(); ctx.globalAlpha *= a; ctx.translate(x, y); ctx.rotate(o.rot || 0);
    if (o.shadow !== false) { ctx.save(); ctx.globalAlpha *= .22; blob(ctx, '#6B4C8A', size * .08, size * .42, size * .42, size * .12, 1); ctx.restore(); }
    if (o.blur) ctx.filter = `blur(${o.blur.toFixed(1)}px)`;
    ctx.drawImage(s, -size / 2, -size / 2, size, size); ctx.restore();
  }
  const OBJECTS = Object.keys(OBJ);

  // ───────────── line icons (outline, drawn in a 24×24 box) ─────────────
  const ICON = {
    ring: g => { g.beginPath(); g.ellipse(12, 15, 6.5, 6.5, 0, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(9, 7); g.lineTo(12, 3.5); g.lineTo(15, 7); g.lineTo(12, 9.5); g.closePath(); g.stroke(); },
    heart: g => { heartPath(g, 12, 13, 18); g.stroke(); },
    cake: g => { g.strokeRect(5, 13, 14, 7); g.strokeRect(7.5, 8, 9, 5); g.beginPath(); g.moveTo(12, 8); g.lineTo(12, 5); g.stroke(); g.beginPath(); g.moveTo(3, 20); g.lineTo(21, 20); g.stroke(); },
    envelope: g => { g.strokeRect(3.5, 6, 17, 12); g.beginPath(); g.moveTo(3.5, 6.5); g.lineTo(12, 13); g.lineTo(20.5, 6.5); g.stroke(); },
    venue: g => { g.beginPath(); g.moveTo(4, 20); g.lineTo(4, 10); g.lineTo(12, 4); g.lineTo(20, 10); g.lineTo(20, 20); g.closePath(); g.stroke(); g.beginPath(); g.moveTo(10, 20); g.lineTo(10, 15); g.arc(12, 15, 2, Math.PI, 0); g.lineTo(14, 20); g.stroke(); },
    music: g => { g.beginPath(); g.moveTo(9, 17); g.lineTo(9, 5); g.lineTo(19, 3.5); g.lineTo(19, 15); g.stroke(); g.beginPath(); g.arc(7, 17, 2.4, 0, TAU); g.stroke(); g.beginPath(); g.arc(17, 15, 2.4, 0, TAU); g.stroke(); },
    camera: g => { rr(g, 3, 7, 18, 12, 2.5); g.stroke(); g.beginPath(); g.arc(12, 13, 3.5, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(8, 7); g.lineTo(9.5, 4.5); g.lineTo(14.5, 4.5); g.lineTo(16, 7); g.stroke(); },
    flower: g => { for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; g.beginPath(); g.ellipse(12 + Math.cos(a) * 4, 10 + Math.sin(a) * 4, 3, 3, 0, 0, TAU); g.stroke(); } g.beginPath(); g.moveTo(12, 14); g.lineTo(12, 21); g.stroke(); },
    calendar: g => { rr(g, 3.5, 5, 17, 15, 2.5); g.stroke(); g.beginPath(); g.moveTo(3.5, 10); g.lineTo(20.5, 10); g.moveTo(8, 3); g.lineTo(8, 7); g.moveTo(16, 3); g.lineTo(16, 7); g.stroke(); },
    pound: g => { g.beginPath(); g.arc(12, 12, 9, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(15, 8.5); g.quadraticCurveTo(12, 6, 10.5, 9); g.lineTo(10.5, 16.5); g.lineTo(15.5, 16.5); g.moveTo(8.5, 12.5); g.lineTo(13.5, 12.5); g.stroke(); },
    guests: g => { g.beginPath(); g.arc(9, 9, 3.2, 0, TAU); g.stroke(); g.beginPath(); g.arc(16.5, 10, 2.6, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(3.5, 19); g.quadraticCurveTo(9, 11, 14.5, 19); g.moveTo(14, 15); g.quadraticCurveTo(17, 12.5, 21, 18); g.stroke(); },
    table: g => { g.beginPath(); g.arc(12, 12, 4.5, 0, TAU); g.stroke(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; g.beginPath(); g.arc(12 + Math.cos(a) * 8.3, 12 + Math.sin(a) * 8.3, 1.6, 0, TAU); g.stroke(); } },
    check: g => { g.beginPath(); g.arc(12, 12, 9, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(8, 12.5); g.lineTo(11, 15.5); g.lineTo(16.5, 9); g.stroke(); },
    pin: g => { g.beginPath(); g.moveTo(12, 21); g.bezierCurveTo(5, 13, 5, 3.5, 12, 3.5); g.bezierCurveTo(19, 3.5, 19, 13, 12, 21); g.stroke(); g.beginPath(); g.arc(12, 10, 2.6, 0, TAU); g.stroke(); },
    glass: g => { g.beginPath(); g.moveTo(7, 4); g.lineTo(17, 4); g.quadraticCurveTo(17, 12, 12, 13); g.quadraticCurveTo(7, 12, 7, 4); g.moveTo(12, 13); g.lineTo(12, 20); g.moveTo(8.5, 20); g.lineTo(15.5, 20); g.stroke(); },
    gift: g => { g.strokeRect(4, 10, 16, 10); g.strokeRect(3, 7, 18, 3.5); g.beginPath(); g.moveTo(12, 7); g.lineTo(12, 20); g.stroke(); g.beginPath(); g.ellipse(9.5, 5.5, 2.5, 1.6, .4, 0, TAU); g.ellipse(14.5, 5.5, 2.5, 1.6, -.4, 0, TAU); g.stroke(); },
    sparkle: g => { g.beginPath(); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; g.lineTo(12 + Math.cos(a) * 9, 12 + Math.sin(a) * 9); g.quadraticCurveTo(12, 12, 12 + Math.cos(a + Math.PI / 2) * 9, 12 + Math.sin(a + Math.PI / 2) * 9); } g.closePath(); g.stroke(); },
    chat: g => { rr(g, 3.5, 4.5, 17, 12, 4); g.stroke(); g.beginPath(); g.moveTo(8, 16.5); g.lineTo(7, 20.5); g.lineTo(12, 16.5); g.stroke(); },
    dress: g => { g.beginPath(); g.moveTo(9, 3); g.lineTo(9.5, 8); g.lineTo(5, 20.5); g.lineTo(19, 20.5); g.lineTo(14.5, 8); g.lineTo(15, 3); g.moveTo(9.5, 8); g.lineTo(14.5, 8); g.stroke(); },
    list: g => { for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(6, 7 + i * 5, 1.2, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(10, 7 + i * 5); g.lineTo(20, 7 + i * 5); g.stroke(); } },
    search: g => { g.beginPath(); g.arc(10.5, 10.5, 6, 0, TAU); g.stroke(); g.beginPath(); g.moveTo(15, 15); g.lineTo(20, 20); g.stroke(); },
    send: g => { g.beginPath(); g.moveTo(12, 19); g.lineTo(12, 5); g.moveTo(6.5, 10.5); g.lineTo(12, 5); g.lineTo(17.5, 10.5); g.stroke(); },
    home: g => { g.beginPath(); g.moveTo(4, 11); g.lineTo(12, 4); g.lineTo(20, 11); g.moveTo(6, 9.5); g.lineTo(6, 20); g.lineTo(18, 20); g.lineTo(18, 9.5); g.stroke(); },
    plus: g => { g.beginPath(); g.moveTo(12, 5); g.lineTo(12, 19); g.moveTo(5, 12); g.lineTo(19, 12); g.stroke(); },
  };
  function icon(ctx, name, x, y, size, color = C.ink, lw = 1.8) {
    const f = ICON[name]; if (!f) return;
    ctx.save(); ctx.translate(x - size / 2, y - size / 2); ctx.scale(size / 24, size / 24);
    ctx.lineWidth = lw; ctx.strokeStyle = color; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; f(ctx); ctx.restore();
  }
  const ICONS = Object.keys(ICON);

  // ───────────── UI kit (phone screens use logical 390×844 pt) ─────────────
  const UI = {
    text(g, s, x, y, size, weight = 500, color = C.ink, align = 'left', family = F.sans) { font(g, size, weight, family); g.fillStyle = color; g.textAlign = align; g.textBaseline = 'alphabetic'; g.fillText(s, x, y); return g.measureText(s).width; },
    card(g, x, y, w, h, r = 22, o = {}) {
      if (o.shadow !== false) { g.save(); g.fillStyle = 'rgba(60,30,90,.07)'; rr(g, x, y + 6, w, h, r); g.fill(); g.fillStyle = 'rgba(60,30,90,.05)'; rr(g, x - 2, y + 2, w + 4, h + 8, r + 2); g.fill(); g.restore(); }
      rr(g, x, y, w, h, r); g.fillStyle = o.fill || '#FFFFFF'; g.fill();
      if (o.stroke !== false) { g.lineWidth = 1; g.strokeStyle = o.stroke || 'rgba(42,27,61,.07)'; g.stroke(); }
    },
    pill(g, s, x, y, o = {}) {
      font(g, o.size || 12, o.weight || 600, F.sans); const w = g.measureText(s).width + (o.padX || 12) * 2, h = o.h || (o.size || 12) * 2.1;
      const x0 = o.align === 'right' ? x - w : o.align === 'center' ? x - w / 2 : x;
      rr(g, x0, y - h / 2, w, h, h / 2); g.fillStyle = o.bg || '#F1ECF7'; g.fill();
      g.fillStyle = o.fg || C.ink; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s, x0 + w / 2, y + .5); g.textBaseline = 'alphabetic';
      return w;
    },
    avatar(g, x, y, r, initials, col) {
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = col || C.lilac; g.fill();
      font(g, r * .8, 700, F.sans); g.fillStyle = 'rgba(42,27,61,.8)'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(initials, x, y + 1); g.textBaseline = 'alphabetic';
    },
    ring(g, x, y, r, p, col = C.gold, lw = 10, track = '#F1ECF7') {
      g.lineCap = 'round'; g.lineWidth = lw; g.strokeStyle = track; g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke();
      if (p > 0) { g.strokeStyle = col; g.beginPath(); g.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(p)); g.stroke(); }
    },
    bar(g, x, y, w, h, p, col = C.gold, track = '#F1ECF7') { rr(g, x, y, w, h, h / 2); g.fillStyle = track; g.fill(); if (p > 0) { rr(g, x, y, Math.max(h, w * clamp(p)), h, h / 2); g.fillStyle = col; g.fill(); } },
    check(g, x, y, r, on, col = C.mint) {
      g.beginPath(); g.arc(x, y, r, 0, TAU); if (on > 0) { g.fillStyle = col; g.fill(); } else { g.lineWidth = 1.6; g.strokeStyle = '#D6CDE0'; g.stroke(); }
      if (on > 0) { g.save(); g.lineWidth = r * .28; g.strokeStyle = '#fff'; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath(); const pts = [[x - r * .45, y + r * .02], [x - r * .1, y + r * .38], [x + r * .5, y - r * .35]]; const L = partial(pts, on); g.moveTo(L[0][0], L[0][1]); L.slice(1).forEach(p => g.lineTo(p[0], p[1])); g.stroke(); g.restore(); }
    },
    statusBar(g, dark = false) {
      const col = dark ? '#fff' : C.ink; UI.text(g, '9:41', 42, 34, 16, 700, col);
      g.fillStyle = col; for (let i = 0; i < 4; i++) g.fillRect(292 + i * 5.5, 30 - i * 2.5, 3.5, 4 + i * 2.5);
      rr(g, 320, 22, 26, 13, 4); g.lineWidth = 1.2; g.strokeStyle = col; g.stroke(); rr(g, 322.5, 24.5, 19, 8, 2); g.fill();
    },
    tabBar(g, active = 0, h = 844) {
      g.fillStyle = 'rgba(255,255,255,.92)'; g.fillRect(0, h - 84, 390, 84); g.fillStyle = 'rgba(42,27,61,.06)'; g.fillRect(0, h - 84, 390, 1);
      ['home', 'guests', 'pound', 'list', 'chat'].forEach((n, i) => icon(g, n, 39 + i * 78, h - 52, 24, i === active ? C.rose : C.ink3, 2));
      rr(g, 128, h - 12, 134, 5, 3); g.fillStyle = C.ink; g.fill();
    },
    button(g, s, x, y, w, h, o = {}) { rr(g, x, y, w, h, h / 2); g.fillStyle = o.bg || C.ink; g.fill(); font(g, o.size || 15, 700, F.sans); g.fillStyle = o.fg || '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s, x + w / 2, y + h / 2 + 1); g.textBaseline = 'alphabetic'; },
  };
  function partial(pts, p) {
    if (p >= 1) return pts; const lens = [0]; for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const T = lens[lens.length - 1] * clamp(p), out = [pts[0]];
    for (let i = 1; i < pts.length; i++) { if (lens[i] <= T) out.push(pts[i]); else { const f = (T - lens[i - 1]) / (lens[i] - lens[i - 1] || 1); out.push([lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)]); break; } }
    return out;
  }
  /** Frosted glass card on the main canvas (bubbles etc.). */
  function glass(ctx, x, y, w, h, r = 24, o = {}) {
    ctx.save();
    ctx.fillStyle = 'rgba(80,40,120,.08)'; rr(ctx, x + 2, y + 10, w, h, r); ctx.fill();
    rr(ctx, x, y, w, h, r); ctx.fillStyle = o.fill || 'rgba(255,255,255,.78)'; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.stroke();
    ctx.restore();
  }

  // ───────────── phone mockup ─────────────
  const SCR_W = 390, SCR_H = 844, SS = 2; // logical screen & supersample
  /**
   * Draw a phone. o: { x, y (centre), h (body height px, portrait), rot, yaw (−1..1 fake turn), landscape (0..1 rotation to landscape),
   *                    alpha, shadow }  screen(g, t) draws in logical 390×844 (or 844×390 when o.land) coordinates.
   * key: offscreen cache key for the screen buffer (one per phone on screen).
   */
  function phone(ctx, o, screen, key = 'main') {
    const land = !!o.land;
    const sw = land ? SCR_H : SCR_W, sh = land ? SCR_W : SCR_H;
    const buf = offscreen('phone:' + key + (land ? 'L' : 'P'), sw * SS, sh * SS), g = buf.getContext('2d');
    g.setTransform(SS, 0, 0, SS, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none';
    g.fillStyle = '#fff'; g.fillRect(0, 0, sw, sh); g.save(); screen(g, sw, sh); g.restore();
    const bodyH = o.h || 760, k = bodyH / 880; // body 430×880 logical incl. bezel
    const bw = 430 * k, bh = 880 * k, bez = 20 * k, R = 66 * k;
    ctx.save(); ctx.globalAlpha *= (o.alpha == null ? 1 : o.alpha);
    ctx.translate(o.x, o.y);
    if (o.rot) ctx.rotate(o.rot);
    const yaw = o.yaw || 0;
    if (land) ctx.rotate(-Math.PI / 2);
    // fake 3D turn: horizontal squash + slight vertical shear
    ctx.transform(Math.cos(yaw * .9), Math.sin(yaw) * .12, 0, 1, 0, 0);
    if (o.shadow !== false) { ctx.save(); ctx.globalAlpha *= .35; blob(ctx, '#3A2250', bw * .12, bh * .5 + 20 * k, bw * .75, 60 * k, 1); ctx.restore(); ctx.save(); ctx.globalAlpha *= .18; blob(ctx, '#3A2250', bw * .08, 30 * k, bw * .75, bh * .6, 1); ctx.restore(); }
    // side thickness (visible when yawed)
    if (Math.abs(yaw) > .02) { ctx.save(); rr(ctx, -bw / 2 - Math.sign(yaw) * 10 * k * Math.abs(Math.sin(yaw)) * 3, -bh / 2, bw, bh, R); ctx.fillStyle = '#6E6A75'; ctx.fill(); ctx.restore(); }
    // titanium frame
    rr(ctx, -bw / 2, -bh / 2, bw, bh, R);
    const fr = ctx.createLinearGradient(-bw / 2, -bh / 2, bw / 2, bh / 2); fr.addColorStop(0, '#E9E6EE'); fr.addColorStop(.25, '#9C98A6'); fr.addColorStop(.5, '#F4F2F7'); fr.addColorStop(.75, '#8E8A97'); fr.addColorStop(1, '#D6D2DD');
    ctx.fillStyle = fr; ctx.fill();
    rr(ctx, -bw / 2 + 4 * k, -bh / 2 + 4 * k, bw - 8 * k, bh - 8 * k, R - 4 * k); ctx.fillStyle = '#0B0A0F'; ctx.fill();
    // buttons
    ctx.fillStyle = '#A9A5B2'; rr(ctx, -bw / 2 - 4 * k, -bh * .22, 5 * k, 70 * k, 2); ctx.fill(); rr(ctx, -bw / 2 - 4 * k, -bh * .1, 5 * k, 70 * k, 2); ctx.fill(); rr(ctx, bw / 2 - 1 * k, -bh * .16, 5 * k, 110 * k, 2); ctx.fill();
    // screen
    const sx = -bw / 2 + bez, sy = -bh / 2 + bez, sW = bw - bez * 2, sH = bh - bez * 2;
    ctx.save(); rr(ctx, sx, sy, sW, sH, R - bez); ctx.clip();
    if (land) { ctx.translate(sx + sW, sy); ctx.rotate(Math.PI / 2); ctx.drawImage(buf, 0, 0, sH, sW); }
    else ctx.drawImage(buf, sx, sy, sW, sH);
    ctx.restore();
    // dynamic island
    const di = land ? null : 1;
    ctx.save(); if (land) { /* island sits on the left short edge in landscape — drawn in portrait space anyway */ }
    rr(ctx, -62 * k, sy + 12 * k, 124 * k, 36 * k, 18 * k); ctx.fillStyle = '#000'; ctx.fill(); ctx.restore();
    // glass glare
    ctx.save(); rr(ctx, sx, sy, sW, sH, R - bez); ctx.clip();
    const gl = ctx.createLinearGradient(-bw / 2, -bh / 2, bw / 2, bh * .1); gl.addColorStop(0, 'rgba(255,255,255,.10)'); gl.addColorStop(.45, 'rgba(255,255,255,.03)'); gl.addColorStop(.46, 'rgba(255,255,255,0)'); ctx.fillStyle = gl; ctx.fillRect(-bw, -bh, bw * 2, bh * 2);
    ctx.restore();
    ctx.restore();
    return { bw, bh, k, sx, sy, sW, sH };
  }
  /** Map a logical screen point (portrait) to canvas coords for a phone drawn with o (no yaw/rot). */
  function phonePoint(o, px, py) { const k = (o.h || 760) / 880, sW = (430 - 40) * k, sH = (880 - 40) * k; return [o.x - sW / 2 + px / SCR_W * sW, o.y - sH / 2 + py / SCR_H * sH]; }

  // ───────────── touch cursor ─────────────
  function touch(ctx, x, y, press = 0, o = {}) {
    const r = (o.r || 26) * (1 - press * .18);
    ctx.save(); ctx.globalAlpha *= o.alpha == null ? 1 : o.alpha;
    blob(ctx, '#7C5CE0', x, y + 6, r * 2.2, r * 2.2, .18);
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = `rgba(124,92,224,${.55 + press * .25})`; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.stroke();
    if (o.ripple != null && o.ripple > 0 && o.ripple < 1) { ctx.beginPath(); ctx.arc(x, y, r + o.ripple * 50, 0, TAU); ctx.lineWidth = 3 * (1 - o.ripple); ctx.strokeStyle = `rgba(124,92,224,${1 - o.ripple})`; ctx.stroke(); }
    ctx.restore();
  }
  function arrowCursor(ctx, x, y, s = 1) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 26); ctx.lineTo(7, 20); ctx.lineTo(12, 31); ctx.lineTo(16, 29); ctx.lineTo(11, 18.5); ctx.lineTo(20, 18.5); ctx.closePath();
    ctx.fillStyle = '#111'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke(); ctx.restore();
  }

  // ───────────── transitions / fx ─────────────
  /** Zoom-blur a full-frame draw: renders fn into a buffer then composites n scaled copies (radial motion blur). */
  function zoomBlur(ctx, amount, fn, cx = W / 2, cy = H / 2, n = 6) {
    const b = offscreen('zb'), g = b.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.save(); fn(g); g.restore();
    if (amount <= .001) { ctx.drawImage(b, 0, 0); return; }
    ctx.save();
    for (let i = 0; i < n; i++) { const s = 1 + amount * i / (n - 1); ctx.globalAlpha = i === 0 ? 1 : 1 / (i + 1); ctx.setTransform(s, 0, 0, s, cx - cx * s, cy - cy * s); ctx.drawImage(b, 0, 0); }
    ctx.restore();
  }
  /** Horizontal whip blur: draws fn at offsets along x. */
  function whip(ctx, dist, fn, n = 7) {
    const b = offscreen('wh'), g = b.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.save(); fn(g); g.restore();
    ctx.save(); for (let i = 0; i < n; i++) { ctx.globalAlpha = i === 0 ? 1 : .5 / n * 3; ctx.drawImage(b, dist * i / (n - 1), 0); } ctx.restore();
  }
  function fade(ctx, a, color = '#fff') { if (a <= 0) return; ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = clamp(a); ctx.fillStyle = color; ctx.fillRect(0, 0, W, H); ctx.restore(); }

  // ───────────── scenes & rendering ─────────────
  const scenes = [];
  function addScene(s) { scenes.push(s); scenes.sort((a, b) => (a.layer || 0) - (b.layer || 0)); }
  function renderScenes(ctx, t) {
    let any = false;
    for (const sc of scenes) if (t >= sc.start && t < sc.end) { any = true; ctx.save(); try { sc.draw(ctx, t, t - sc.start, sc.end - sc.start); } catch (e) { console.error('scene', sc.name, t, e); } ctx.restore(); }
    if (!any) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); }
  }
  const snaps = new Map();
  function snapshot(ts) { const k = Math.round(ts * 1000); if (snaps.has(k)) return snaps.get(k); const c = canvas(W, H); renderScenes(c.getContext('2d'), ts); snaps.set(k, c); if (snaps.size > 20) snaps.delete(snaps.keys().next().value); return c; }
  let _ctx = null;
  function attach(cnv) { _ctx = cnv.getContext('2d'); return _ctx; }
  function renderFrame(t, ctx = _ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
    renderScenes(ctx, t);
  }

  window.KIT = {
    W, H, FPS, DURATION, TAU, BEAT, C, F,
    clamp, lerp, invLerp, ease, remap, spring, pulse, hash, rng, noise1, float,
    canvas, offscreen, cache, rr, blob, bgWhite, bgMesh, bgSky,
    font, layout, drawLine, typeAnim, caret, riseAnim, logo,
    obj, OBJECTS, heartPath, icon, ICONS, UI, partial, glass,
    phone, phonePoint, SCR_W, SCR_H, touch, arrowCursor,
    zoomBlur, whip, fade,
    scenes, addScene, renderScenes, snapshot, attach, renderFrame,
  };
})();
