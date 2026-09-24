// Kinetic typography, drawn per frame into a 1920x1080 2D canvas that the composite pass lights and shatters.
window.TYPE = (() => {
const { LY, CH, BEAT, BAR, clamp, lerp, ss, eio, eo } = TL;
const SERIF = '"Instrument Serif"', MONO = '"DM Mono"';
const W = 1920, H = 1080;
const cache = new Map();
function layout(ctx, text, font, track) {
  const key = font + '|' + track + '|' + text;
  let L = cache.get(key); if (L) return L;
  ctx.font = font;
  const xs = [];
  for (let i = 0; i <= text.length; i++) xs.push(ctx.measureText(text.slice(0, i)).width + i * track);
  L = { xs, w: xs[text.length] - track, ch: [...text] };
  cache.set(key, L); return L;
}
const hsh = (i, s = 0) => { const x = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };
function glyph(ctx, ch, x, y, o) {
  const a = o.a ?? 1; if (a <= .003) return;
  ctx.save();
  ctx.translate(x, y);
  if (o.rot) ctx.rotate(o.rot);
  ctx.scale(o.sx ?? 1, o.sy ?? 1);
  if (o.blur > .3) {
    const n = 6, r = o.blur;
    ctx.globalAlpha = a / n * 1.6;
    for (let k = 0; k < n; k++) { const an = k / n * Math.PI * 2; ctx.fillText(ch, Math.cos(an) * r, Math.sin(an) * r * .6); }
  } else { ctx.globalAlpha = a; ctx.fillText(ch, 0, 0); }
  ctx.restore();
}
// generic per-letter line: appear staggered, leave staggered
function line(ctx, c, t, o) {
  const { text } = c;
  const font = o.font, track = o.track ?? 0;
  const L = layout(ctx, text, font, track);
  ctx.font = font; ctx.fillStyle = o.color ?? '#fff3e6'; ctx.textBaseline = 'alphabetic';
  if (o.shadow !== false) { ctx.shadowColor = o.shadowColor ?? 'rgba(30,14,16,0.42)'; ctx.shadowBlur = o.shadowBlur ?? 22; ctx.shadowOffsetY = 3; } else { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; }
  let x0 = o.x; if (o.align === 'center') x0 = o.x - L.w / 2; else if (o.align === 'right') x0 = o.x - L.w;
  const n = L.ch.length, inDur = o.inDur ?? .55, stag = o.stag ?? .028, outDur = o.outDur ?? .5, ostag = o.ostag ?? .015;
  for (let i = 0; i < n; i++) {
    const ch = L.ch[i]; if (ch === ' ') continue;
    const ti = t - c.t - i * stag, to = t - (c.end - outDur - (n - i) * ostag * 0) + 0 - i * ostag;
    const pin = clamp(ti / inDur), pout = clamp(to / outDur);
    if (pin <= 0) continue;
    const cx = x0 + (L.xs[i] + L.xs[i + 1] - track) / 2;
    const g = { a: eo(pin) * (1 - pout), blur: (1 - eo(pin)) * 6 + pout * 8, sx: 1, sy: 1, rot: 0, dx: 0, dy: (1 - eo(pin)) * 18 - pout * 16 };
    if (o.fx) o.fx(g, i, n, t, pin, pout, cx, L);
    ctx.textAlign = 'center';
    if (o.color2 && g.col) ctx.fillStyle = g.col;
    glyph(ctx, ch, cx + g.dx, o.y + g.dy, g);
  }
  return L;
}
const VERSE_X = 150, VERSE_Y = 842;
function drawCue(ctx, c, t, F, st) {
  const lt = t - c.t;
  switch (c.style) {
    case 'verse': {
      const fxs = {
        silver: (g, i, n, t, pin) => { const fl = hsh(i, Math.floor(t * 14)); g.col = fl > .8 ? '#ffffff' : fl > .4 ? '#dfe4ee' : '#aeb6c6'; g.a *= .75 + .25 * fl; },
        undone: (g, i, n, t, pin, pout) => { const k = ss(.8, 2.6, lt); g.dx = (hsh(i) - .5) * 26 * k; g.dy += (hsh(i, 2) - .5) * 22 * k; g.rot = (hsh(i, 3) - .5) * .5 * k; },
        run: (g, i, n, t, pin, pout, cx) => { const k = ss(.5, 3.2, lt); const hue = 12 + i * 11 + lt * 30; g.col = `hsl(${hue % 360},85%,${78 - k * 8}%)`; g.sy = 1 + k * (.3 + hsh(i) * .9); g.dy += k * (14 + hsh(i, 5) * 40); g.blur += k * 1.5; },
        one: (g, i, n, t, pin, pout, cx, L) => { const k = eio(clamp((t - (c.end - .9)) / .9)); const mid = VERSE_X + L.w / 2; g.dx = (mid - cx) * k; g.a *= 1 - k * .5; g.col = '#ffe2c8'; },
      };
      line(ctx, c, t, { font: `italic 64px ${SERIF}`, x: VERSE_X, y: VERSE_Y, fx: fxs[c.fx], color2: true, color: '#fff3e6' });
      break;
    }
    case 'hum': {
      line(ctx, c, t, {
        font: `italic 58px ${SERIF}`, x: 960, y: c.alt ? 858 : 842, align: 'center', track: 6, stag: .035,
        fx: (g, i) => { g.dy += Math.sin(t * 42 + i * .9) * (1.5 + 7 * F.kick) + Math.sin(t * 3 + i * .4) * 3; g.sy = 1 + .04 * Math.sin(t * 30 + i); },
      });
      break;
    }
    case 'walk': {
      const left = c.second === 0;
      const drift = (t - c.t) * 7;
      line(ctx, c, t, {
        font: `italic ${left ? 62 : 62}px ${SERIF}`, x: left ? 300 - drift * .2 : 1620 + drift * .2, y: left ? 770 : 846, align: left ? 'left' : 'right', stag: .04, inDur: .7,
        fx: (g) => { g.dx += (1 - eo(g.a)) * -30; },
      });
      break;
    }
    case 'chorus': case 'echo': {
      const echo = c.style === 'echo';
      const pal = c.pal;
      const col = echo ? 'rgba(255,238,224,0.55)' : pal === 1 ? '#f3ecff' : '#fff3e6';
      const big = c.fx !== 'sub' && c.fx !== 'rise';
      const baseY = echo ? 560 : 575;
      if (c.fx === 'crash') {
        const sc = echo ? 118 : 176;
        line(ctx, c, t, {
          font: `italic ${sc}px ${SERIF}`, x: 960 + (echo ? Math.sin(c.t) * 260 : 0), y: baseY - (echo ? 0 : 20), align: 'center', track: echo ? 18 : 10, stag: .012, inDur: .18, outDur: .35, color: col,
          fx: (g, i, n) => { const k = eo(clamp(lt / .5)); g.sx = g.sy = 1.12 - .12 * k; g.dx += (i - n / 2) * 10 * (1 - k); g.blur = (1 - k) * 3 + g.blur * .3; if (echo) g.dy += -lt * 18; },
        });
      } else if (c.fx === 'sub') {
        line(ctx, c, t, { font: `italic ${echo ? 60 : 78}px ${SERIF}`, x: 960 + (echo ? Math.sin(c.t) * 260 : 0), y: baseY + (echo ? 80 : 110), align: 'center', track: 4, stag: .03, inDur: .5, color: col,
          fx: (g) => { if (echo) g.dy += -lt * 18; } });
      } else if (c.fx === 'pull') {
        line(ctx, c, t, {
          font: `italic 170px ${SERIF}`, x: 960, y: baseY - 20, align: 'center', track: 8, stag: .03, inDur: .45, color: col,
          fx: (g, i) => { const k = eo(clamp((lt - i * .03) / .5)); g.sy = 1 + (1 - k) * 1.1; g.sx = 1 - (1 - k) * .25; g.dy = (1 - k) * -70 - ss(.4, 1.1, lt) * 30; },
        });
      } else if (c.fx === 'rise') {
        line(ctx, c, t, { font: `italic 84px ${SERIF}`, x: 960, y: baseY + 100, align: 'center', track: 5, stag: .03, inDur: .6, color: col,
          fx: (g, i) => { g.dy += (1 - eo(clamp((lt - i * .03) / .6))) * 70 - ss(.2, 1, lt) * 18; } });
      } else if (c.fx === 'half') {
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, baseY - 52); ctx.clip();
        line(ctx, c, t, { font: `italic 170px ${SERIF}`, x: 960, y: baseY, align: 'center', track: 8, stag: .02, inDur: .3, outDur: .2, color: col });
        ctx.restore();
        ctx.save(); ctx.beginPath(); ctx.rect(0, baseY - 52, W, 400); ctx.clip();
        line(ctx, c, t, { font: `italic 170px ${SERIF}`, x: 960, y: baseY, align: 'center', track: 8, stag: .02, inDur: .3, outDur: .2, color: col, fx: (g) => { g.a *= .28; g.blur = 7; g.dx += 10; } });
        ctx.restore();
      } else if (c.fx === 'dream') {
        line(ctx, c, t, { font: `italic 170px ${SERIF}`, x: 960, y: baseY, align: 'center', track: 14, stag: .035, inDur: .45, outDur: .25, color: pal === 1 ? '#e8dcff' : '#ffe6f0',
          fx: (g, i) => { g.dy += Math.sin(t * 3 + i * .7) * 10; g.blur = Math.max(g.blur, 1.2); g.a *= .9; } });
      } else if (c.fx === 'gleam') {
        line(ctx, c, t, { font: `italic 170px ${SERIF}`, x: 960, y: baseY, align: 'center', track: 8, stag: .02, inDur: .3, outDur: .2, color: col,
          color2: true, fx: (g, i, n) => { const p = lt / (c.end - c.t) * (n + 6) - 3; const d = Math.abs(i - p); g.col = d < 1.5 ? '#ffffff' : col; g.sy = 1 + Math.max(0, 1.5 - d) * .05; } });
      }
      break;
    }
    case 'phase': {
      const off = 7 * Math.sin(lt * 1.6) * (1 - ss(1.5, 3.2, lt) * .7) + 2;
      ctx.save(); line(ctx, c, t, { font: `italic 64px ${SERIF}`, x: VERSE_X, y: VERSE_Y, stag: .03, color: 'rgba(0,0,0,0.01)', shadowColor: 'rgba(30,14,30,0.5)', shadowBlur: 26 }); ctx.globalCompositeOperation = 'lighter';
      const o = { font: `italic 64px ${SERIF}`, x: VERSE_X, y: VERSE_Y, stag: .03, shadow: false };
      line(ctx, c, t, { ...o, color: 'rgba(255,120,110,0.45)', fx: (g) => { g.dx -= off; } });
      line(ctx, c, t, { ...o, color: 'rgba(110,210,255,0.45)', fx: (g) => { g.dx += off; g.dy += off * .15; } });
      line(ctx, c, t, { ...o, color: 'rgba(255,245,235,0.9)' });
      ctx.restore();
      break;
    }
    case 'pulse': {
      line(ctx, c, t, { font: `italic 60px ${SERIF}`, x: 960, y: c.alt ? 858 : 842, align: 'center', track: 5, stag: .03,
        fx: (g, i, n) => { const s = 1 + F.kick * .12; g.sx = g.sy = s; g.dx += (i - n / 2) * 30 * F.kick * .15; } });
      break;
    }
    case 'weightless': {
      const pos = [[960, 330], [960, 560], [960, 790]][c.i];
      line(ctx, c, t, { font: `italic ${c.i === 0 ? 96 : 76}px ${SERIF}`, x: pos[0], y: pos[1], align: 'center', track: c.i === 0 ? 12 : 6, stag: .04, inDur: .8, outDur: .8,
        fx: (g, i) => { const k = lt; if (c.i === 0) { g.dy -= k * (6 + hsh(i) * 22); g.rot = (hsh(i, 1) - .5) * k * .18; g.dx += (hsh(i, 2) - .5) * k * 14; } else if (c.i === 1) { g.dy += k * 14 * ss(0, 1, k); } else { g.a *= .85; g.blur += ss(1, 3, k) * 2; } } });
      break;
    }
    case 'shapeless': {
      const pos = [[960, 330], [960, 560], [960, 790]][c.i];
      const ink = '#3a3034';
      line(ctx, c, t, { font: `italic ${c.i === 0 ? 96 : 76}px ${SERIF}`, x: pos[0], y: pos[1], align: 'center', track: c.i === 0 ? 12 : 6, stag: .04, inDur: .9, outDur: .9, color: ink, shadow: false,
        fx: (g, i) => { const k = lt; if (c.i === 0) { g.sx = 1 + Math.sin(k * 2 + i) * .18 * ss(.3, 1.5, k); g.sy = 1 + Math.cos(k * 1.7 + i * 1.3) * .22 * ss(.3, 1.5, k); g.blur += ss(.8, 3, k) * 2.5; } else if (c.i === 1) { const s = 1 + .06 * Math.sin(k / (4 * BEAT) * Math.PI * 2); g.sx = g.sy = s; } else { g.a *= 1 - ss(.6, 3.2, k) * .75; } } });
      break;
    }
  }
}
function title(ctx, t) {
  if (t > 15.5) return;
  const c1 = { t: 3.2, end: 13.4, text: 'soft crash' };
  line(ctx, c1, t, { font: `italic 150px ${SERIF}`, x: 960, y: 560, align: 'center', track: 26, stag: .16, inDur: 1.6, outDur: 1.4, ostag: .06,
    fx: (g, i) => { g.dy = g.dy * 1.5 - (t - 3) * 1.6; g.blur *= 1.6; } });
  const c2 = { t: 6.2, end: 13.0, text: 'dave_m' };
  line(ctx, c2, t, { font: `300 26px ${MONO}`, x: 960, y: 640, align: 'center', track: 14, stag: .06, inDur: 1, outDur: 1, color: 'rgba(255,240,228,0.8)', fx: (g) => { g.dy -= (t - 6) * 1.2; } });
}
function chapter(ctx, t, st) {
  for (const [ct, txt] of CH) {
    const lt = t - ct; if (lt < 0 || lt > 5.5) continue;
    const a = ss(0, .5, lt) * (1 - ss(4.3, 5.5, lt));
    const top = st.post.bars > .5 ? 138 + 54 : 72;
    ctx.save(); ctx.globalAlpha = a * .7; ctx.font = `300 22px ${MONO}`; ctx.fillStyle = '#fff1e6'; ctx.textAlign = 'left';
    const shown = txt.slice(0, Math.floor(clamp(lt / 1.1) * txt.length));
    ctx.fillText(shown, 96, top);
    ctx.fillRect(96, top + 14, 60 * eo(lt / .8), 1.5);
    ctx.restore();
  }
}
function hud(ctx, t, st) {
  if (t < 16.5 || t > 197) return;
  const inBlank = st.B.scene === 5;
  const a = .38 * ss(16.5, 18, t) * (1 - ss(195.5, 197, t));
  const bottom = st.post.bars > .5 ? 1080 - 138 - 40 : 1080 - 56;
  ctx.save(); ctx.globalAlpha = a; ctx.font = `300 18px ${MONO}`; ctx.fillStyle = inBlank ? '#4a3f44' : '#fff1e6'; ctx.textAlign = 'right';
  const m = Math.floor(t / 60), s = Math.floor(t % 60), f = Math.floor((t % 1) * 30);
  const pad = n => String(n).padStart(2, '0');
  ctx.fillText(`MEM ${pad(m)}:${pad(s)}:${pad(f)}`, 1920 - 96, bottom);
  ctx.textAlign = 'left';
  const bar = Math.max(0, Math.floor((t - .042) / BAR)) + 1;
  ctx.fillText(`${String(bar).padStart(3, '0')} / 097`, 96, bottom);
  ctx.restore();
}
function draw(ctx, t, F, st) {
  ctx.clearRect(0, 0, W, H);
  title(ctx, t);
  for (const c of LY) if (t >= c.t - .05 && t <= c.end + .05) drawCue(ctx, c, t, F, st);
  chapter(ctx, t, st);
  hud(ctx, t, st);
  if (t > 196.8) {
    const c1 = { t: 197.2, end: 202.1, text: 'soft crash' };
    line(ctx, c1, t, { font: `italic 96px ${SERIF}`, x: 960, y: 800, align: 'center', track: 20, stag: .1, inDur: 1.2, outDur: 1.2, ostag: .03 });
    const c2 = { t: 198.2, end: 202.0, text: 'dave_m' };
    line(ctx, c2, t, { font: `300 22px ${MONO}`, x: 960, y: 852, align: 'center', track: 12, stag: .05, inDur: .8, outDur: 1, color: 'rgba(255,240,228,0.75)' });
  }
}
return { draw };
})();
