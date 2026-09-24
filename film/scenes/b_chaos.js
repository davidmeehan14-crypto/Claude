/* Scene B — ACT 3 "THE PLANNING" (14.0–16.0) + ACT 4 "CHAOS" (16.0–30.0).
 *
 *  14.00  record-scratch FREEZE of 13.99 (snapshot), glitch slices, desaturate, zoom/tilt jolt
 *  14.30  "Chapter Six." + "The Planning." slams in letter by letter (ink splats, dust, shake)
 *  15.00  hard cut (on the beat) to a sickly two-shot; Dot's face falls, Dash gulps (15.75)
 *  15.60  first notification ("Mum: what about Uncle Gary??")
 *  16.00  whip out to wide — chaos items land on every ping (PINGS = data/sfx_pings.json)
 *  19.4 / 21.0 / 23.3 / 26.6 dialogue beats with camera whips, peony cut-away gag
 *  27.5–29.7 ink scribble engulfs everything, compresses into a ball
 *  29.80  HARD CUT: still ink ball on cream paper, centred (960,540), r≈220 (hand-off to scene C)
 */
(function () {
  const F = FILM, P = F.PAL, FT = F.FONT, W = F.W, H = F.H, TAU = F.TAU;
  const { clamp, lerp, invLerp, remap, ease, spring, jiggle, hash, hash2, rng, noise1 } = F;

  // ── ping times, pasted from data/sfx_pings.json (sound team). One chaos item lands on each. ──
  const PINGS = [15.6, 16.0, 16.372, 16.907, 17.336, 17.7, 18.034, 18.47, 18.898, 19.119, 19.438, 19.663, 20.016, 20.338, 20.59, 20.851, 21.062, 21.315, 21.5, 21.663, 21.813, 21.952, 22.13, 22.29, 22.478, 22.576, 22.728, 22.867, 22.982, 23.143, 23.282, 23.403, 23.512, 23.693, 23.861, 24.006, 24.12, 24.295, 24.427, 24.544, 24.705, 24.808, 24.944, 25.043, 25.136, 25.268, 25.356, 25.466, 25.582, 25.663, 25.789, 25.899, 26.013, 26.105, 26.2, 26.301, 26.398, 26.51, 26.613, 26.703, 26.76, 26.877, 26.972, 27.052, 27.144, 27.205, 27.325, 27.45, 27.507, 27.584, 27.687, 27.761, 27.851, 27.93, 28.033, 28.146, 28.254, 28.344, 28.403, 28.512, 28.561, 28.627, 28.692, 28.781, 28.858, 28.91, 28.957, 29.04, 29.115, 29.196, 29.275, 29.372, 29.47, 29.525, 29.623];

  const DOTX = 800, DASHX = 1100, GROUND = 760;
  const BALL = { x: 960, y: 540, r: 220 };

  // dialogue line lookup (real times when dialogue.js exists, SPEC targets otherwise)
  function LN(speaker, approx, dur) {
    let best = null;
    for (const l of F.lines()) if (l.speaker === speaker && Math.abs(l.start - approx) < 1.2 && (!best || Math.abs(l.start - approx) < Math.abs(best.start - approx))) best = l;
    return best ? { start: best.start, end: best.end } : { start: approx, end: approx + dur };
  }
  function beats() {
    const wait = LN('dot', 14.9, 1.7), gary = LN('dash', 19.4, 1.3), know = LN('dot', 21.0, 1.4);
    const peony = LN('dash', 23.3, 3.1), cant = LN('dot', 26.6, 1.3);
    const cutA = Math.min(peony.start + (peony.end - peony.start) * .55, 25.3), cutB = Math.min(cutA + 1.05, 26.2);
    return { wait, gary, know, peony, cant, cutA, cutB };
  }

  // ─────────────────────────── content ───────────────────────────
  const N = (app, col, glyph, title, body, badge) => ({ k: 'notif', app, col, glyph, title, body, badge });
  const C = (name, text, col) => ({ k: 'chat', name, text, col });
  const S = (file, bad) => ({ k: 'sheet', file, bad });
  const K = (mon, day, note) => ({ k: 'cal', mon, day, note });
  const I = (vendor, amt, stamp) => ({ k: 'inv', vendor, amt, stamp });
  const T = (text, col) => ({ k: 'sticky', text, col });
  const D = (name, ext, col) => ({ k: 'file', name, ext, col });
  const E = (from, subj) => ({ k: 'mail', from, subj });
  const CURATED = [
    N('MESSAGES', P.mint, 'M', 'Mum', 'what about Uncle Gary??', 1),
    N('VENUE', P.red, 'V', 'The Old Barn', 'Deposit due TODAY', 3),
    S('Budget_FINAL_v7_REAL.xlsx', '#REF!'),
    C('Auntie Pam', 'is it a buffet', P.lilac),
    N('MAIL', P.cobalt, '@', 'Florist', 're: re: re: peonies', 12),
    T('DJ or band???', P.acid),
    N('RSVP', P.gold, 'R', 'New RSVP', 'Gary +3', 1),
    K('JUN', '14', 'VENUE DEPOSIT'),
    C('Group chat', '214 new messages', P.mint),
    D('Seating_plan_HELP.pdf', 'PDF', P.red),
    I('Bloom & Co. Florist', '£2,340.00', 'DUE TODAY'),
    N('CALENDAR', P.red, '14', 'Cake tasting 3pm', "(you're late)", 1),
    E('Florist', 're: re: re: re: peonies'),
    C('Mum', 'Gary says hi!!', P.lilac),
    N('MAIL', P.cobalt, '@', 'Photographer', 'availability?', 4),
    T('WHO IS GARY', P.blush),
  ];
  const POOL = [
    C('Dad', "who's paying for the bar", P.acid),
    N('BANK', P.ink, '£', 'Card declined', 'Venue deposit £8,500', 1),
    S('Guests_v12 (2).xlsx', 'N/A'),
    T('chairs: gold or white??', P.gold),
    C('Cousin Tim', 'can I bring my ferret', P.mint),
    K('FRI', '13', 'dress fitting'),
    N('CATERER', P.coral, 'C', 'Menu', '14 dietary requirements', 7),
    I('The Old Barn', '£8,500.00', 'OVERDUE'),
    E('Venue', 'Fwd: Fwd: chair covers?'),
    D('Vows_draft_3.docx', 'DOC', P.cobalt),
    C('Maid of honour', 'HEN DO WHEN', P.coral),
    N('RSVP', P.gold, 'R', 'New RSVP', 'Gary +4 (update)', 2),
    T('vows!!!', P.acid),
    C('Group chat', '381 new messages', P.mint),
    N('HOTEL', P.lilac, 'H', 'Room block', 'expires in 2 hours', 1),
    K('SAT', '02', 'SAVE THE DATES??'),
    D('Playlist_NO_CONGA.m3u', 'MP3', P.mint),
    N('MESSAGES', P.mint, 'M', 'Auntie Pam', 'is it a BUFFET though', 9),
    I('DJ Spinz', '£1,200.00', 'UNPAID'),
    T('call Auntie Pam back', P.lilac),
    C('Best man', 'is a roast ok for the speech', P.acid),
    E('Photographer', 're: drone?? (+£400)'),
    S('Budget_FINAL_v8_ACTUAL.xlsx', '-£3,212'),
    N('DRESS SHOP', P.blush, 'D', 'Alterations', 'fitting moved ×4', 3),
    C('Mum', 'GARY IS COMING', P.lilac),
    T('peonies???', P.blush),
    D('Timeline_v9_FINAL.pdf', 'PDF', P.red),
    N('MAIL', P.cobalt, '@', 'Venue', 'confirm chair colour', 21),
  ];
  const TAB_TITLES = ['venues near me', 'cheap wedding venues', 'how to seat divorced parents', 'is a buffet tacky', 'uncle gary', 'peony season uk', 'dj vs band reddit', 'wedding budget calculator', 'how many guests is too many', 'ferret wedding etiquette', 'chair covers gold', 'what is a hen do', 'eloping costs'];

  // ─────────────────────────── items ───────────────────────────
  const ITEMS = (function () {
    const r = rng(314), out = [], placed = [];
    const inZone = (x, y) => (x > 560 && x < 1360 && y > 110 && y < 480) || (x > 640 && x < 1260 && y > 470 && y < 820);
    const inFace = (x, y) => Math.hypot(x - DOTX, (y - 660) * 1.3) < 250 || Math.hypot(x - DASHX, y - 600) < 160;
    let poolI = 0;
    PINGS.forEach((ti, i) => {
      let spec;
      if (i < CURATED.length) spec = CURATED[i]; else { spec = POOL[(poolI * 5 + 3) % POOL.length]; poolI++; }
      let x, y;
      if (i === 0) { x = 905; y = 372; }
      else {
        let best = null, bd = -1;
        for (let c = 0; c < 14; c++) {
          const cx = 40 + r() * 1840, cy = 150 + r() * 880;
          if (ti < 24.2 && inZone(cx, cy)) continue;
          if (ti < 27.5 && inFace(cx, cy)) continue;
          let d = 1e9;
          for (const p of placed) { if (p.t < ti - (ti > 24 ? 3.5 : 99)) continue; d = Math.min(d, Math.hypot((p.x - cx) * .8, p.y - cy)); }
          if (d > bd) { bd = d; best = [cx, cy]; }
        }
        if (!best) best = [40 + r() * 400, 200 + r() * 700];
        [x, y] = best;
      }
      const pop = spec.k === 'notif' || spec.k === 'chat';
      const ang = Math.atan2(y - 540, x - 960) + (r() - .5) * 1.2;
      out.push({
        i, t: ti, spec, x, y, rot: i === 0 ? -.04 : (r() - .5) * .5, sc: i === 0 ? .9 : .78 + r() * .32 + (ti > 25 ? .12 : 0),
        pop, fromA: ang, spin: (r() - .5) * 3, front: ti > 24.2, seed: 50 + i * 3.7, scrib: Math.floor(r() * 6), scribT: 27.5 + r() * .5,
      });
      placed.push({ x, y, t: ti });
    });
    return out;
  })();

  // ─────────────────────────── sprite builders ───────────────────────────
  const SS = 1.25, PAD = 18;
  const sprites = new Map();
  function wrap(g, text, maxW) {
    const words = text.split(' '), lines = []; let cur = '';
    for (const w of words) { const tst = cur ? cur + ' ' + w : w; if (g.measureText(tst).width > maxW && cur) { lines.push(cur); cur = w; } else cur = tst; }
    if (cur) lines.push(cur); return lines;
  }
  function fitFont(g, text, maxW, size, fam, wt) { let s = size; do { F.font(g, s, fam, wt); s -= 1; } while (g.measureText(text).width > maxW && s > 10); }
  function cardBase(g, w, h, r, fill, seed, shadow = true) {
    if (shadow) { g.fillStyle = 'rgba(22,22,29,.92)'; g.beginPath(); g.roundRect(7, 9, w, h, r); g.fill(); }
    F.inkShape(g, F.roundRectPts(0, 0, w, h, r, 64), { fill, t: 0, seed, lw: 4, amp: .9 });
  }
  function buildSprite(it) {
    const s = it.spec, key = CURATED.includes(s) ? 'c' + CURATED.indexOf(s) : 'p' + POOL.indexOf(s);
    if (sprites.has(key)) return sprites.get(key);
    let w = 440, h = 116;
    const tmp = F.canvas(10, 10).getContext('2d');
    if (s.k === 'chat') { F.font(tmp, 28, FT.ui, 800); w = Math.max(220, tmp.measureText(s.text).width + 60); h = 104; }
    if (s.k === 'sheet') { w = 390; h = 250; }
    if (s.k === 'cal') { w = 196; h = 226; }
    if (s.k === 'inv') { w = 250; h = 312; }
    if (s.k === 'sticky') { w = 200; h = 196; }
    if (s.k === 'file') { w = 190; h = 236; }
    if (s.k === 'mail') { w = 470; h = 164; }
    const cw = Math.ceil((w + PAD * 2) * SS), ch = Math.ceil((h + PAD * 2 + (s.k === 'chat' ? 22 : 0)) * SS);
    const c = document.createElement('canvas'); c.width = cw; c.height = ch; const g = c.getContext('2d', { willReadFrequently: true });
    g.scale(SS, SS); g.translate(PAD, PAD);
    g.textBaseline = 'alphabetic'; g.lineJoin = 'round'; g.lineCap = 'round';
    const seed = key.length * 13 + (key.charCodeAt(1) || 0) * 3.1;
    if (s.k === 'notif') {
      cardBase(g, w, h, 28, '#FFFFFF', seed);
      g.beginPath(); g.roundRect(20, 24, 66, 66, 18); g.fillStyle = s.col; g.fill(); g.lineWidth = 3; g.strokeStyle = P.ink; g.stroke();
      F.font(g, s.glyph.length > 1 ? 28 : 36, FT.ui, 800); g.textAlign = 'center'; g.fillStyle = s.col === P.gold || s.col === P.acid || s.col === P.mint || s.col === P.blush || s.col === P.lilac ? P.ink : '#fff'; g.fillText(s.glyph, 53, 70);
      if (s.badge) {
        const bt = s.badge > 99 ? '99+' : String(s.badge); F.font(g, 17, FT.ui, 800); const bw = Math.max(30, g.measureText(bt).width + 16);
        g.beginPath(); g.roundRect(86 - bw / 2 + 4, 12, bw, 30, 15); g.fillStyle = P.red; g.fill(); g.lineWidth = 3; g.strokeStyle = P.ink; g.stroke();
        g.fillStyle = '#fff'; g.fillText(bt, 90, 33);
      }
      g.textAlign = 'left'; F.font(g, 15, FT.label, 700); g.fillStyle = '#8a8478'; g.fillText(s.app, 108, 40);
      g.textAlign = 'right'; F.font(g, 15, FT.label, 500); g.fillText('now', w - 22, 40); g.textAlign = 'left';
      fitFont(g, s.title, w - 130, 22, FT.ui, 800); g.fillStyle = P.ink; g.fillText(s.title, 108, 68);
      fitFont(g, s.body, w - 130, 22, FT.ui, 400); g.fillStyle = '#34323a'; g.fillText(s.body, 108, 95);
    } else if (s.k === 'chat') {
      g.translate(0, 22);
      F.font(g, 16, FT.label, 700); g.fillStyle = P.ink; g.fillText(s.name.toUpperCase(), 14, -6);
      const bub = (gg, ox, oy) => { gg.beginPath(); gg.roundRect(ox, oy, w, h - 18, 34); gg.moveTo(ox + 30, oy + h - 22); gg.lineTo(ox + 14, oy + h + 4); gg.lineTo(ox + 62, oy + h - 22); };
      g.fillStyle = 'rgba(22,22,29,.92)'; bub(g, 7, 9); g.fill();
      F.inkShape(g, F.roundRectPts(0, 0, w, h - 18, 34, 60), { fill: s.col, t: 0, seed, lw: 4, amp: .9 });
      g.beginPath(); g.moveTo(26, h - 21); g.lineTo(12, h + 2); g.lineTo(60, h - 21); g.fillStyle = s.col; g.fill(); g.lineWidth = 4; g.strokeStyle = P.ink; g.stroke();
      g.fillStyle = s.col; g.fillRect(28, h - 26, 30, 8);
      F.font(g, 28, FT.ui, 800); g.fillStyle = s.col === P.cobalt || s.col === P.ink ? '#fff' : P.ink; g.fillText(s.text, 30, (h - 18) / 2 + 10);
    } else if (s.k === 'sheet') {
      cardBase(g, w, h, 14, '#FFFFFF', seed);
      g.save(); g.beginPath(); g.roundRect(2, 2, w - 4, 44, [12, 12, 0, 0]); g.fillStyle = P.mint; g.fill(); g.restore();
      g.fillStyle = '#fff'; g.beginPath(); g.roundRect(14, 12, 24, 24, 5); g.fill(); F.font(g, 16, FT.ui, 800); g.fillStyle = P.mint; g.textAlign = 'center'; g.fillText('X', 26, 30); g.textAlign = 'left';
      fitFont(g, s.file, w - 64, 18, FT.label, 700); g.fillStyle = P.ink; g.fillText(s.file, 48, 31);
      g.strokeStyle = P.ink; g.lineWidth = 3; g.beginPath(); g.moveTo(2, 46); g.lineTo(w - 2, 46); g.stroke();
      const cols = [0, 46, 170, 260, w], rows = 6, rh = (h - 56) / rows;
      g.fillStyle = P.paperShade; g.fillRect(2, 48, w - 4, rh - 2);
      g.strokeStyle = 'rgba(22,22,29,.25)'; g.lineWidth = 1.5;
      for (let rr = 1; rr < rows; rr++) { g.beginPath(); g.moveTo(4, 48 + rr * rh); g.lineTo(w - 4, 48 + rr * rh); g.stroke(); }
      for (const cx of cols.slice(1, -1)) { g.beginPath(); g.moveTo(cx, 48); g.lineTo(cx, h - 6); g.stroke(); }
      const labs = ['ITEM', 'Venue', 'Flowers', 'Catering', 'Dress', 'TOTAL'], vals = ['£', '8,500', '2,340', '11,760', '1,950', ''];
      F.font(g, 14, FT.label, 700);
      for (let rr = 0; rr < rows; rr++) {
        const y = 48 + rr * rh + rh * .66;
        g.fillStyle = '#8a8478'; g.fillText(String(rr + 1), 16, y);
        g.fillStyle = P.ink; F.font(g, 15, rr === 0 || rr === 5 ? FT.label : FT.ui, rr === 0 || rr === 5 ? 700 : 400); g.fillText(labs[rr], 54, y);
        if (rr < 5) { g.textAlign = 'right'; g.fillText(vals[rr], 250, y); g.fillText(rr ? ['', '??', 'TBC', '???', 'lol'][rr] : 'PAID?', w - 12, y); g.textAlign = 'left'; }
      }
      g.fillStyle = P.red; g.fillRect(171, 48 + 5 * rh + 1, 88, rh - 3); F.font(g, 16, FT.ui, 800); g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText(s.bad, 215, 48 + 5 * rh + rh * .68); g.textAlign = 'left';
      g.strokeStyle = P.red; g.lineWidth = 3.5; g.beginPath(); g.ellipse(215, 48 + 5 * rh + rh / 2, 58, rh * .75, -.08, 0, TAU); g.stroke();
    } else if (s.k === 'cal') {
      cardBase(g, w, h, 16, '#FFFFFF', seed);
      g.save(); g.beginPath(); g.roundRect(2, 2, w - 4, 58, [14, 14, 0, 0]); g.fillStyle = P.red; g.fill(); g.restore();
      g.strokeStyle = P.ink; g.lineWidth = 3; g.beginPath(); g.moveTo(2, 60); g.lineTo(w - 2, 60); g.stroke();
      for (const rx of [50, w - 50]) { g.beginPath(); g.roundRect(rx - 6, -14, 12, 30, 6); g.fillStyle = P.paperShade; g.fill(); g.stroke(); }
      F.font(g, 28, FT.label, 700); g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText(s.mon, w / 2, 44);
      F.font(g, 104, FT.display, 900); g.fillStyle = P.ink; g.fillText(s.day, w / 2, 162);
      fitFont(g, s.note, w - 20, 30, FT.hand, 700); g.fillStyle = P.red; g.fillText(s.note, w / 2, 204); g.textAlign = 'left';
    } else if (s.k === 'inv') {
      cardBase(g, w, h, 6, '#FFFDF6', seed);
      F.font(g, 28, FT.label, 700); g.fillStyle = P.ink; g.fillText('INVOICE', 20, 46);
      F.font(g, 13, FT.label, 500); g.fillStyle = '#8a8478'; g.fillText('#00' + (40 + (seed | 0) % 50), w - 60, 46);
      fitFont(g, s.vendor, w - 40, 17, FT.ui, 600); g.fillStyle = P.ink; g.fillText(s.vendor, 20, 76);
      g.fillStyle = 'rgba(22,22,29,.18)'; for (let k = 0; k < 6; k++) g.fillRect(20, 98 + k * 22, (k % 3 === 2 ? 110 : 180) + (k * 17) % 30, 8);
      g.strokeStyle = P.ink; g.lineWidth = 2; g.beginPath(); g.moveTo(20, 240); g.lineTo(w - 20, 240); g.stroke();
      F.font(g, 14, FT.label, 700); g.fillStyle = P.ink; g.fillText('TOTAL', 20, 266);
      fitFont(g, s.amt, w - 40, 30, FT.ui, 800); g.textAlign = 'right'; g.fillText(s.amt, w - 20, 294); g.textAlign = 'left';
      g.save(); g.translate(w / 2 + 10, 160); g.rotate(-.32); F.font(g, 34, FT.label, 700); const sw = g.measureText(s.stamp).width + 24;
      g.globalAlpha = .9; g.strokeStyle = P.red; g.lineWidth = 5; g.strokeRect(-sw / 2, -30, sw, 46); g.fillStyle = P.red; g.textAlign = 'center'; g.fillText(s.stamp, 0, 5); g.restore();
    } else if (s.k === 'sticky') {
      g.fillStyle = 'rgba(22,22,29,.92)'; g.fillRect(7, 9, w, h);
      F.inkShape(g, [[0, 0], [w, 0], [w, h], [0, h]].flatMap((p, i, a) => { const q = a[(i + 1) % 4]; return [p, [lerp(p[0], q[0], .5), lerp(p[1], q[1], .5)]]; }), { fill: s.col, t: 0, seed, lw: 4, amp: .8 });
      g.fillStyle = 'rgba(255,255,255,.55)'; g.save(); g.translate(w / 2, 2); g.rotate(-.06); g.fillRect(-46, -14, 92, 28); g.restore();
      F.font(g, 42, FT.hand, 700); g.fillStyle = P.ink; g.textAlign = 'center';
      const ls = wrap(g, s.text, w - 30); ls.forEach((l, k) => g.fillText(l, w / 2, h / 2 + 14 + (k - (ls.length - 1) / 2) * 42)); g.textAlign = 'left';
    } else if (s.k === 'file') {
      g.fillStyle = 'rgba(22,22,29,.92)'; g.beginPath(); g.moveTo(7, 9); g.lineTo(w - 50 + 7, 9); g.lineTo(w + 7, 59); g.lineTo(w + 7, h + 9); g.lineTo(7, h + 9); g.fill();
      F.inkShape(g, [[0, 0], [w * .4, 0], [w - 50, 0], [w, 50], [w, h * .5], [w, h], [w * .5, h], [0, h], [0, h * .5]], { fill: '#fff', t: 0, seed, lw: 0, amp: .6 });
      g.beginPath(); g.moveTo(0, 0); g.lineTo(w - 50, 0); g.lineTo(w, 50); g.lineTo(w, h); g.lineTo(0, h); g.closePath(); g.lineWidth = 4; g.strokeStyle = P.ink; g.stroke();
      g.beginPath(); g.moveTo(w - 50, 0); g.lineTo(w - 50, 50); g.lineTo(w, 50); g.fillStyle = P.paperShade; g.fill(); g.stroke();
      g.beginPath(); g.roundRect(18, 70, 86, 40, 8); g.fillStyle = s.col; g.fill(); g.lineWidth = 3; g.stroke();
      F.font(g, 22, FT.label, 700); g.fillStyle = '#fff'; g.textAlign = 'center'; g.fillText(s.ext, 61, 98); g.textAlign = 'left';
      F.font(g, 17, FT.ui, 600); g.fillStyle = P.ink; const nm = s.name.replace(/_/g, '_​');
      const ls = wrap(g, nm.replace(/​/g, ' ').replace(/_ /g, '_ '), w - 30); ls.forEach((l, k) => g.fillText(l.replace(/_ /g, '_'), 18, 146 + k * 22));
    } else if (s.k === 'mail') {
      cardBase(g, w, h, 16, '#FFFFFF', seed);
      g.save(); g.beginPath(); g.roundRect(2, 2, w - 4, 38, [14, 14, 0, 0]); g.fillStyle = P.paperShade; g.fill(); g.restore();
      [P.red, P.gold, P.mint].forEach((cc, k) => { g.beginPath(); g.arc(24 + k * 22, 21, 7, 0, TAU); g.fillStyle = cc; g.fill(); g.lineWidth = 2; g.strokeStyle = P.ink; g.stroke(); });
      g.strokeStyle = P.ink; g.lineWidth = 3; g.beginPath(); g.moveTo(2, 40); g.lineTo(w - 2, 40); g.stroke();
      F.font(g, 16, FT.label, 500); g.fillStyle = '#8a8478'; g.fillText('From: ' + s.from, 22, 66);
      fitFont(g, s.subj, w - 44, 26, FT.ui, 800); g.fillStyle = P.ink; g.fillText(s.subj, 22, 100);
      g.fillStyle = 'rgba(22,22,29,.16)'; g.fillRect(22, 118, w - 90, 8); g.fillRect(22, 136, w - 170, 8);
      g.beginPath(); g.arc(w - 30, 64, 8, 0, TAU); g.fillStyle = P.cobalt; g.fill();
    }
    const sp = { c, w: cw / SS, h: ch / SS, cx: PAD + w / 2, cy: PAD + h / 2 + (s.k === 'chat' ? 11 : 0), bw: w, bh: h };
    sprites.set(key, sp);
    return sp;
  }

  // ─────────────────────────── scribble geometry ───────────────────────────
  const SCRIBS = (function () { // local zig-zag scribbles in unit square
    const out = [];
    for (let v = 0; v < 6; v++) {
      const r = rng(700 + v), pts = []; let x = -.45, y = -.4 + r() * .1;
      for (let k = 0; k < 26; k++) { x = (k % 2 ? .45 : -.45) + (r() - .5) * .2; y += .035 + r() * .02; pts.push([x, y]); }
      for (let k = 0; k < 10; k++) { const a = r() * TAU, rr = .15 + r() * .35; pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
      out.push(pts);
    }
    return out;
  })();
  const BALLSTROKES = (function () { // tangled strokes in unit-disc space
    const r = rng(2029), out = [];
    for (let s = 0; s < 72; s++) {
      const a0 = r() * TAU, r0 = Math.sqrt(r()) * .75; let x = Math.cos(a0) * r0, y = Math.sin(a0) * r0, h = r() * TAU, turn = (r() - .5) * .6;
      const pts = [[x, y]], steps = 70 + Math.floor(r() * 40);
      for (let k = 0; k < steps; k++) {
        turn = turn * .85 + (r() - .5) * .9; h += turn;
        const d = Math.hypot(x, y), rim = .92 + .1 * Math.sin(Math.atan2(y, x) * 3 + s);
        if (d > rim * .78) { const toC = Math.atan2(-y, -x); let dh = ((toC - h + Math.PI * 3) % TAU) - Math.PI; h += dh * .45; }
        const st = .055 + r() * .03; x += Math.cos(h) * st; y += Math.sin(h) * st; pts.push([x, y]);
      }
      out.push({ pts, lw: s % 9 === 0 ? 5.5 : s % 3 === 0 ? 2.5 : 3.6, t0: s / 72 });
    }
    return out;
  })();
  function strokePts(ctx, pts, lw, col = P.ink) {
    if (pts.length < 2) return;
    F.smoothOpen(ctx, pts); ctx.lineWidth = lw; ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke();
  }
  /** The final ink ball (also exported for scene C as window.B_CHAOS.inkBall). */
  function inkBall(ctx, o = {}) {
    const cx = o.x == null ? BALL.x : o.x, cy = o.y == null ? BALL.y : o.y, R = (o.r || BALL.r) * 1.14 * (o.scale || 1);
    const prog = o.progress == null ? 1 : o.progress, bt = o.t == null ? null : F.boil(o.t), lwk = o.lwScale || 1;
    BALLSTROKES.forEach((st, si) => {
      const p = clamp((prog - st.t0 * .72) / .28);
      if (p <= 0) return;
      let pts = st.pts.map((q, k) => {
        let x = cx + q[0] * R, y = cy + q[1] * R;
        if (bt != null) { x += (hash2(bt * 13 + k, si) - .5) * 3; y += (hash2(bt * 13 + k, si + 9) - .5) * 3; }
        return [x, y];
      });
      if (p < 1) pts = F.partialPolyline(pts, p);
      strokePts(ctx, pts, st.lw * lwk);
    });
  }
  window.B_CHAOS = { inkBall, BALL };
  window.B_CHAOS._dbg = () => ({ drawBoard, drawItem, ITEMS, drawTabBar, characters, beats, drawWorld });

  // ─────────────────────────── title data ───────────────────────────
  const SPLATS = (function () {
    const r = rng(99), out = [];
    for (let i = 0; i < 16; i++) {
      const a = r() * TAU, d = 380 + r() * 520;
      out.push({ x: 960 + Math.cos(a) * d, y: 560 + Math.sin(a) * d * .5, r: 12 + r() * 34, col: i % 4 === 0 ? P.red : P.ink, n: 5 + Math.floor(r() * 5), seed: i, dl: r() * .08 });
    }
    return out;
  })();
  function splat(ctx, s, k, t) {
    if (k <= 0) return;
    ctx.save(); ctx.translate(s.x, s.y); ctx.scale(k, k);
    const r = rng(500 + s.seed), pts = [];
    for (let i = 0; i < 18; i++) { const a = i / 18 * TAU, rr = s.r * (.75 + r() * .5); pts.push([Math.cos(a) * rr, Math.sin(a) * rr]); }
    F.inkShape(ctx, pts, { fill: s.col, lw: 0, t, seed: s.seed, amp: 1.5 });
    ctx.fillStyle = s.col;
    for (let i = 0; i < s.n; i++) { const a = r() * TAU, d = s.r * (1.4 + r() * 1.8), rr = 2 + r() * s.r * .22; ctx.beginPath(); ctx.arc(Math.cos(a) * d, Math.sin(a) * d, rr, 0, TAU); ctx.fill(); }
    ctx.restore();
  }

  // ─────────────────────────── helpers ───────────────────────────
  let grayCache = null;
  function grayFreeze() {
    const snap = F.snapshot(13.99), c = F.offscreen('b_gray'), g = c.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
    g.filter = 'grayscale(1) contrast(1.08) brightness(.97)'; g.drawImage(snap, 0, 0); g.filter = 'none';
    return (grayCache = c);
  }
  const getGray = () => grayCache || grayFreeze();

  function landedBefore(t) { let n = 0; while (n < ITEMS.length && ITEMS[n].t <= t) n++; return n; }
  function flinch(t) {
    let f = 0; for (let i = landedBefore(t) - 1; i >= 0 && t - ITEMS[i].t < .5; i--) f += jiggle(t - ITEMS[i].t, 5, 9);
    return f;
  }
  function lookAtLatest(t, hx, hy) {
    const n = landedBefore(t); if (!n) return [0, 0];
    const it = ITEMS[n - 1]; const dx = it.x - hx, dy = it.y - hy, d = Math.hypot(dx, dy) || 1;
    return [dx / d, dy / d * .8];
  }

  // ─────────────────────────── seating board ───────────────────────────
  const BOARD = { x: 560, y: 128, w: 800, h: 344 };
  const TABLES = [[690, 262], [960, 252], [1230, 264], [700, 392], [960, 398], [1220, 388]];
  const GUESTS = (function () { const g = []; TABLES.forEach((tb, ti) => { for (let k = 0; k < 7; k++) { const a = k / 7 * TAU + ti; g.push([tb[0] + Math.cos(a) * 50, tb[1] + Math.sin(a) * 42, ti]); } }); return g; })();
  const LINKS = (function () {
    const r = rng(77), out = [];
    for (let i = 0; i < 70; i++) {
      const a = Math.floor(r() * GUESTS.length); let b = Math.floor(r() * GUESTS.length); if (GUESTS[b][2] === GUESTS[a][2]) b = (b + 9) % GUESTS.length;
      out.push({ a, b, col: i % 5 === 0 ? P.red : i % 7 === 3 ? P.cobalt : P.ink, loops: 1 + Math.floor(r() * 3), seed: i * 1.7, bend: (r() - .5) * 160 });
    }
    return out;
  })();
  function drawBoard(ctx, t) {
    const k = spring(t - 16.9, 2.6, .35); if (k <= 0) return;
    ctx.save(); const cx = BOARD.x + BOARD.w / 2, cy = BOARD.y + BOARD.h / 2;
    ctx.translate(cx, cy + (1 - k) * -40); ctx.rotate(-.015 + jiggle(t - 16.9, 3, 4) * .05); ctx.scale(k, k); ctx.translate(-cx, -cy);
    ctx.fillStyle = 'rgba(22,22,29,.92)'; ctx.beginPath(); ctx.roundRect(BOARD.x + 9, BOARD.y + 11, BOARD.w, BOARD.h, 14); ctx.fill();
    F.inkShape(ctx, F.roundRectPts(BOARD.x, BOARD.y, BOARD.w, BOARD.h, 14, 64), { fill: '#FFFDF6', t, seed: 5, lw: 5 });
    F.font(ctx, 38, FT.hand, 700); ctx.fillStyle = P.ink; ctx.textAlign = 'left'; ctx.fillText('SEATING PLAN v3 (help)', BOARD.x + 26, BOARD.y + 48);
    // tables + guests
    TABLES.forEach((tb, i) => {
      F.inkShape(ctx, F.circlePts(tb[0], tb[1], 30, 20), { fill: P.paperShade, t, seed: 30 + i, lw: 3.5 });
      F.font(ctx, 26, FT.display, 900); ctx.fillStyle = P.ink; ctx.textAlign = 'center'; ctx.fillText(String(i + 1), tb[0], tb[1] + 9);
    });
    const cols = [P.coral, P.cobalt, P.gold, P.mint, P.lilac, P.blush];
    GUESTS.forEach((g, i) => { ctx.beginPath(); ctx.arc(g[0], g[1], 8.5, 0, TAU); ctx.fillStyle = cols[i % 6]; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = P.ink; ctx.stroke(); });
    // tangled links
    const nL = Math.floor(remap(t, 17.3, 27.2, 2, LINKS.length, ease.inQuad)), mess = remap(t, 17.3, 27, .2, 1.6, ease.inQuad), bt = F.boil(t);
    ctx.save(); ctx.beginPath(); ctx.rect(BOARD.x - 40, BOARD.y + 56, BOARD.w + 80, BOARD.h - 50); ctx.clip();
    for (let i = 0; i < nL; i++) {
      const L = LINKS[i], A = GUESTS[L.a], B = GUESTS[L.b], t0 = 17.3 + (i / LINKS.length) * 9.9;
      const p = clamp((t - t0) / .35); if (p <= 0) continue;
      const pts = [], n = 22;
      for (let s = 0; s <= n; s++) {
        const u = s / n, bx = lerp(A[0], B[0], u), by = lerp(A[1], B[1], u) + Math.sin(u * Math.PI) * L.bend;
        const la = u * TAU * L.loops, lr = Math.sin(u * Math.PI) * 38 * mess;
        pts.push([bx + Math.cos(la + L.seed) * lr + (hash2(bt + s, L.seed) - .5) * 3, by + Math.sin(la + L.seed) * lr * .8 + (hash2(bt + s, L.seed + 4) - .5) * 3]);
      }
      strokePts(ctx, F.partialPolyline(pts, p), 2.6, L.col);
    }
    ctx.restore();
    // "GARY?" sticky on the board
    const gk = spring(t - 19.45, 3, .35);
    if (gk > 0) {
      ctx.save(); ctx.translate(1296, 176); ctx.rotate(.12); ctx.scale(gk, gk);
      ctx.fillStyle = P.acid; ctx.fillRect(-58, -40, 116, 80); ctx.lineWidth = 3; ctx.strokeStyle = P.ink; ctx.strokeRect(-58, -40, 116, 80);
      F.font(ctx, 38, FT.hand, 700); ctx.fillStyle = P.red; ctx.textAlign = 'center'; ctx.fillText('GARY??', 0, 12); ctx.restore();
    }
    ctx.restore();
  }

  // ─────────────────────────── browser tab bar ───────────────────────────
  const TAB0 = 16.6, TAB1 = 27.3;
  const tabCount = t => t < TAB0 ? 3 : Math.round(3 * Math.pow(49, Math.pow(invLerp(TAB0, TAB1, t), 1.5)));
  function drawTabBar(ctx, t) {
    const k = spring(t - (TAB0 - .3), 2.8, .45); if (k <= 0) return;
    const n = tabCount(t), y0 = 28 - (1 - k) * 160, x0 = 40, bw = 1840, bh = 74;
    ctx.save();
    ctx.fillStyle = 'rgba(22,22,29,.92)'; ctx.beginPath(); ctx.roundRect(x0 + 8, y0 + 9, bw, bh, 18); ctx.fill();
    F.inkShape(ctx, F.roundRectPts(x0, y0, bw, bh, 18, 64), { fill: P.paperShade, t, seed: 3, lw: 4 });
    [P.red, P.gold, P.mint].forEach((cc, i) => { ctx.beginPath(); ctx.arc(x0 + 30 + i * 26, y0 + 37, 8, 0, TAU); ctx.fillStyle = cc; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = P.ink; ctx.stroke(); });
    const tx0 = x0 + 110, tx1 = x0 + bw - 250, tw = (tx1 - tx0) / n;
    const favs = [P.coral, P.cobalt, P.gold, P.mint, P.lilac, P.red];
    for (let i = 0; i < n; i++) {
      const x = tx0 + i * tw, active = i === n - 1;
      ctx.beginPath(); ctx.roundRect(x + 1, y0 + 14, Math.max(1, tw - 2), bh - 14, [Math.min(10, tw / 3), Math.min(10, tw / 3), 0, 0]);
      ctx.fillStyle = active ? '#FFFFFF' : (i % 2 ? '#F3EADA' : '#FBF5EA'); ctx.fill();
      ctx.lineWidth = tw > 12 ? 2.5 : 1; ctx.strokeStyle = P.ink; ctx.stroke();
      if (tw > 18) { ctx.beginPath(); ctx.arc(x + Math.min(22, tw / 2), y0 + 44, Math.min(8, tw / 4), 0, TAU); ctx.fillStyle = favs[i % favs.length]; ctx.fill(); }
      if (tw > 70) {
        ctx.save(); ctx.beginPath(); ctx.rect(x + 36, y0 + 14, tw - 44, bh); ctx.clip();
        F.font(ctx, 17, FT.ui, 600); ctx.fillStyle = P.ink; ctx.textAlign = 'left'; ctx.fillText(TAB_TITLES[i % TAB_TITLES.length], x + 38, y0 + 50); ctx.restore();
      }
    }
    // counter
    const bump = jiggle(t - tabT(n), 6, 10), cx = x0 + bw - 128, cy = y0 + 37;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(bump * .12 + (n > 99 ? Math.sin(t * 40) * .04 : 0)); ctx.scale(1 + Math.abs(bump) * .2, 1 + Math.abs(bump) * .2);
    ctx.beginPath(); ctx.roundRect(-104, -26, 208, 52, 26); ctx.fillStyle = n > 40 ? P.red : P.ink; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = P.ink; ctx.stroke();
    F.font(ctx, 32, FT.ui, 800); ctx.fillStyle = '#fff'; ctx.textAlign = 'right'; ctx.fillText(String(n), 6, 12);
    F.font(ctx, 20, FT.label, 700); ctx.textAlign = 'left'; ctx.fillText('TABS', 16, 10);
    ctx.restore();
    ctx.restore();
  }
  function tabT(n) { // time at which count became n (for the bump)
    if (n <= 3) return TAB0; const p = Math.pow(Math.log((n - .5) / 3) / Math.log(49), 1 / 1.5); return lerp(TAB0, TAB1, clamp(p));
  }

  // ─────────────────────────── items ───────────────────────────
  function drawItem(ctx, it, t, o = {}) {
    const dt = t - it.t;
    if (dt < -.22) return;
    const sp = buildSprite(it);
    let x = it.x, y = it.y, rot = it.rot, sx = it.sc, sy = it.sc, alpha = 1, ghost = 0;
    if (it.pop) {
      if (dt < -.05) return;
      const k = spring(dt + .05, 3.6, .38); sx *= k * (1 + jiggle(dt, 5, 9) * .12); sy *= k * (1 - jiggle(dt, 5, 9) * .1);
      rot += (1 - clamp(k)) * .4;
    } else {
      if (dt < 0) {
        const p = ease.outCubic(clamp((dt + .22) / .22)), d = (1 - p) * 1500;
        x += Math.cos(it.fromA) * d; y += Math.sin(it.fromA) * d; rot += (1 - p) * it.spin; ghost = 1 - p;
      } else {
        const sq = jiggle(dt, 4.5, 10); sx *= 1 + sq * .16; sy *= 1 - sq * .16;
      }
    }
    // idle agitation
    const ag = remap(t, 16, 27, .4, 2.4);
    x += noise1(t * 3 + it.seed, it.seed) * ag * 3; y += noise1(t * 3 + it.seed, it.seed + 5) * ag * 3;
    rot += noise1(t * 2 + it.seed, 3) * .02 * ag + (hash2(F.boil(t), it.seed) - .5) * .008;
    if (ghost > .05) { // smear trail
      ctx.save(); ctx.globalAlpha = .25;
      for (let g = 1; g <= 3; g++) {
        const gx = x + Math.cos(it.fromA) * g * 70 * ghost, gy = y + Math.sin(it.fromA) * g * 70 * ghost;
        ctx.save(); ctx.translate(gx, gy); ctx.rotate(rot); ctx.scale(sx * 1.05, sy * .95); ctx.drawImage(sp.c, -sp.cx, -sp.cy, sp.w, sp.h); ctx.restore();
      }
      ctx.restore();
      ctx.save(); ctx.strokeStyle = P.ink; ctx.lineWidth = 4; ctx.lineCap = 'round';
      for (let s = -1; s <= 1; s++) {
        const px = x - Math.sin(it.fromA) * s * 40, py = y + Math.cos(it.fromA) * s * 40, L = 260 * ghost;
        ctx.beginPath(); ctx.moveTo(px + Math.cos(it.fromA) * (140 + s * 20), py + Math.sin(it.fromA) * (140 + s * 20)); ctx.lineTo(px + Math.cos(it.fromA) * (140 + L), py + Math.sin(it.fromA) * (140 + L)); ctx.stroke();
      }
      ctx.restore();
    }
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(sx, sy); ctx.globalAlpha *= alpha;
    ctx.drawImage(sp.c, -sp.cx, -sp.cy, sp.w, sp.h);
    // ping burst lines on landing
    if (dt >= 0 && dt < .2) {
      const q = dt / .2; ctx.strokeStyle = P.ink; ctx.lineWidth = 5 * (1 - q); ctx.lineCap = 'round';
      for (let k = 0; k < 6; k++) {
        const a = k / 6 * TAU + .3, r0 = Math.max(sp.bw, sp.bh) * .5 + 10 + q * 40, r1 = r0 + 26 * (1 - q) + 6;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * r0 * (sp.bw / Math.max(sp.bw, sp.bh)) * 1.05, Math.sin(a) * r0 * (sp.bh / Math.max(sp.bw, sp.bh)) * 1.5);
        ctx.lineTo(Math.cos(a) * r1 * (sp.bw / Math.max(sp.bw, sp.bh)) * 1.05, Math.sin(a) * r1 * (sp.bh / Math.max(sp.bw, sp.bh)) * 1.5); ctx.stroke();
      }
    }
    // scribble over (act-end)
    if (o.scrib && t > it.scribT) {
      const p = clamp((t - it.scribT) / .4), pts = SCRIBS[it.scrib].map(q => [q[0] * sp.bw * 1.1, q[1] * sp.bh * 1.25]);
      strokePts(ctx, F.partialPolyline(F.wobble(pts, t, it.seed, 2), p), 7 / it.sc);
    }
    ctx.restore();
  }

  // ─────────────────────────── characters ───────────────────────────
  function phone(t, dashT) {
    return (ctx) => {
      const bz = [18, 22, 26].some(b => t > b && t < b + .45) ? Math.sin(t * 120) * 3 : 0;
      ctx.save(); ctx.translate(bz, 0); ctx.rotate(-.15);
      ctx.beginPath(); ctx.roundRect(-18, -54, 36, 64, 8); ctx.fillStyle = P.ink; ctx.fill();
      ctx.beginPath(); ctx.roundRect(-13, -48, 26, 50, 4); ctx.fillStyle = P.lilac; ctx.fill();
      ctx.fillStyle = '#fff'; for (let k = 0; k < 4; k++) ctx.fillRect(-10, -43 + k * 12, 20 - (k % 2) * 6, 6);
      const c = t < 16.8 ? 0 : Math.round(1 + 150 * Math.pow(clamp((t - 16.8) / 8.5), 2));
      if (c > 0) {
        const txt = c > 99 ? '99+' : String(c); F.font(ctx, 15, FT.ui, 800); const bw = Math.max(26, ctx.measureText(txt).width + 12);
        const bj = 1 + Math.max(0, jiggle(t - 16.8, 4, 3)) * .3;
        ctx.save(); ctx.translate(18, -54); ctx.scale(bj, bj);
        ctx.beginPath(); ctx.roundRect(-bw / 2, -13, bw, 26, 13); ctx.fillStyle = P.red; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = P.ink; ctx.stroke();
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.fillText(txt, 0, 6); ctx.restore();
      }
      if (bz) { ctx.strokeStyle = P.ink; ctx.lineWidth = 3; ctx.lineCap = 'round'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 28, -40); ctx.lineTo(s * 36, -30); ctx.moveTo(s * 28, -20); ctx.lineTo(s * 38, -12); ctx.stroke(); } }
      ctx.restore();
    };
  }
  function ringBox(ctx) {
    ctx.save(); ctx.translate(6, -8);
    ctx.beginPath(); ctx.roundRect(-14, -10, 28, 20, 4); ctx.fillStyle = P.red; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = P.ink; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -16, 7, 0, TAU); ctx.lineWidth = 4; ctx.strokeStyle = P.gold; ctx.stroke(); ctx.restore();
  }
  function sweat(ctx, x, y, t, t0, dur = .8) {
    const p = (t - t0) / dur; if (p < 0 || p > 1) return;
    ctx.save(); ctx.translate(x, y + p * 40); ctx.globalAlpha = 1 - Math.max(0, p - .7) / .3;
    ctx.beginPath(); ctx.moveTo(0, -16); ctx.quadraticCurveTo(11, 2, 0, 8); ctx.quadraticCurveTo(-11, 2, 0, -16);
    ctx.fillStyle = '#BFE3FF'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = P.ink; ctx.stroke(); ctx.restore();
  }
  function characters(ctx, t, B) {
    const fl = flinch(t);
    // ── Dot ──
    const d = { x: DOTX, y: GROUND, t, mood: 'worried', seed: 11 };
    const dh = [DOTX, GROUND - 110];
    if (t < 16) {
      const p = ease.outCubic(clamp((t - 15) / .45));
      d.mood = t < 15.38 ? 'shock' : 'worried';
      d.armL = [lerp(-60, -30, p), lerp(-90, 46, p)]; d.armR = [lerp(60, 30, p), lerp(-90, 46, p)];
      d.y = GROUND - Math.max(0, (1 - p)) * 30; d.sy = 1 - .05 * ease.outCubic(clamp((t - 15.38) / .3)); d.sx = 1 + .03 * clamp((t - 15.38) / .3);
      d.look = t > 15.6 ? [.4, -.9] : [.7, -.2];
      d.face = t > 15.6 ? .25 : .4;
    } else {
      d.look = lookAtLatest(t, dh[0], dh[1]); d.face = d.look[0] * .3;
      d.sx = 1 + fl * .04; d.sy = 1 - fl * .05;
    }
    if (t >= B.gary.start - .1 && t < B.know.start - .15) { d.mood = 'shock'; d.look = [1, -.25]; d.face = .6; d.armL = [-40, -10]; d.armR = [40, -10]; }
    if (t >= B.know.start - .15 && t < B.know.end + .35) {
      const u = t - B.know.start; d.mood = 'angry';
      d.armL = [-60 + Math.sin(u * 16) * 22, -80 + Math.cos(u * 16) * 25]; d.armR = [60 - Math.sin(u * 16 + 1) * 22, -80 + Math.cos(u * 16 + 1) * 25];
      const hop = Math.abs(Math.sin(u * Math.PI * 2 * 1.5)); d.y = GROUND - hop * 22; d.sy = 1 + hop * .08 - (1 - hop) * .06; d.sx = 2 - d.sy;
      d.look = [0, -.1]; d.face = 0; d.blush = .5;
    }
    if (t >= B.peony.start && t < B.cant.start - .3) {
      d.mood = 'worried'; d.look = t > B.cutB - .02 ? [0, 0] : [1, 0]; d.face = t > B.cutB - .02 ? 0 : .5; d.blink = t > B.cutB ? .45 : undefined;
    }
    if (t >= B.cant.start - .3 && t < 27.5) {
      const p = ease.inOutSine(clamp((t - B.cant.start + .3) / .6));
      d.mood = 'sad'; d.scale = lerp(1, .86, p); d.look = [0, .6]; d.face = 0; d.armL = [lerp(-30, 26, p), lerp(46, 18, p)]; d.armR = [lerp(30, -26, p), lerp(46, 18, p)];
      d.sy = 1 - .04 * p + Math.sin(t * 30) * .004;
    }
    // ── Dash ──
    const s = { x: DASHX, y: GROUND, t, mood: 'shock', seed: 23 };
    const sh = [DASHX, GROUND - 160];
    if (t < 16.45) {
      s.kneel = 1 - ease.inOutCubic(clamp((t - 16.05) / .35));
      s.mood = t < 15.5 ? 'happy' : 'worried'; s.look = t > 15.6 ? [-.6, -.9] : [-.8, -.1]; s.face = t > 15.6 ? -.2 : -.4;
      s.armR = [34, -34]; s.holdR = t < 16.3 ? ringBox : null;
      const g = t - 15.75; if (g > 0 && g < .5) { s.sy = 1 - Math.sin(g / .5 * Math.PI) * .07; s.sx = 1 + Math.sin(g / .5 * Math.PI) * .04; }
    } else {
      s.look = lookAtLatest(t, sh[0], sh[1]); s.face = s.look[0] * .3; s.sx = 1 + fl * .04; s.sy = 1 - fl * .05;
      if (t > 16.8) { s.armR = [-4, 6]; s.phone = true; }
    }
    if (t >= B.gary.start - .1 && t < B.gary.end + .3) {
      const u = t - B.gary.start; s.mood = 'panic'; s.armL = [-50, -120 + Math.sin(u * 20) * 8]; s.armR = [50, -120 + Math.cos(u * 20) * 8];
      s.rot = Math.sin(u * 30) * .03; s.sy = 1.06; s.sx = .95; s.look = [0, -.2]; s.face = 0;
    }
    if (t >= B.know.start - .15 && t < B.know.end + .35) { s.mood = 'shock'; s.rot = .09 * ease.outBack(clamp((t - B.know.start + .15) / .3)); s.look = [-1, 0]; s.face = -.5; }
    if (t >= B.peony.start - .1 && t < B.cant.start - .3) {
      s.mood = 'neutral'; s.blink = .72; s.look = [.9, .2]; s.face = .1; s.rot = 0; s.sx = s.sy = 1;
      s.armR = [8, -22]; s.phone = true;
    }
    if (t >= B.cant.start - .3 && t < 27.5) { s.mood = 'worried'; s.look = [-1, .3]; s.face = -.5; }
    if (t >= 27.5) {
      d.mood = s.mood = 'panic'; d.armL = [-50, -100]; d.armR = [50, -100]; s.armL = [-50, -120]; s.armR = [50, -120];
      d.look = s.look = [Math.sin(t * 9), Math.cos(t * 7) * .5]; d.scale = 1; d.sy = s.sy = 1 + Math.sin(t * 40) * .03;
    }
    // shadows
    ctx.fillStyle = 'rgba(22,22,29,.14)';
    for (const x of [DOTX, DASHX]) { ctx.beginPath(); ctx.ellipse(x, GROUND + 4, 80, 13, 0, 0, TAU); ctx.fill(); }
    F.drawDash(ctx, s);
    if (s.phone && t > 16.8) { const a = s.armR, k = s.kneel || 0; const pin = spring(t - 16.8, 3, .4); ctx.save(); ctx.translate(DASHX + 42.3 + a[0], GROUND - 128 + a[1] + 22 * k); ctx.scale(pin, pin); phone(t)(ctx); ctx.restore(); }
    F.drawDot(ctx, d);
    if (t < 16.4) sweat(ctx, DASHX + 58, GROUND - 190, t, 15.7, .75);
    if (t >= B.gary.start && t < B.gary.end + .3) { sweat(ctx, DASHX - 60, GROUND - 200, t, B.gary.start, .6); sweat(ctx, DASHX + 62, GROUND - 170, t, B.gary.start + .35, .6); }
    if (t >= B.know.start && t < B.know.end + .3) { // anger scribble puff
      const bt = F.boil(t);
      ctx.save(); ctx.translate(DOTX + 60, GROUND - 190); ctx.strokeStyle = P.red; ctx.lineWidth = 5; ctx.lineCap = 'round';
      for (let k = 0; k < 4; k++) { const a = k * 1.57 + bt * .3; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 8, Math.sin(a) * 8); ctx.lineTo(Math.cos(a) * 24, Math.sin(a) * 24); ctx.stroke(); }
      ctx.restore();
    }
    if (t >= B.cant.start - .3 && t < 27.5) { // tiny tremble lines
      ctx.strokeStyle = P.ink; ctx.lineWidth = 3; ctx.lineCap = 'round'; const bt = F.boil(t) % 2;
      for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(DOTX + sd * (82 + bt * 3), GROUND - 120); ctx.lineTo(DOTX + sd * (92 + bt * 3), GROUND - 100); ctx.stroke(); }
    }
  }

  // ─────────────────────────── camera ───────────────────────────
  function camKeys(B) {
    const whip = ease.inOutExpo, soft = ease.inOutSine;
    return [
      { t: 16.0, x: 960, y: 520, z: 1.0, r: 0, d: .2, e: ease.outExpo },
      { t: 18.0, x: 940, y: 520, z: 1.04, r: -.045, d: .25, e: ease.outBack },
      { t: B.gary.start - .12, x: 1090, y: 560, z: 1.38, r: .06, d: .2, e: whip },
      { t: B.know.start - .15, x: 820, y: 590, z: 1.38, r: -.07, d: .2, e: whip },
      { t: 22.0, x: 960, y: 530, z: 1.08, r: .05, d: .25, e: whip },
      { t: B.peony.start - .12, x: 1060, y: 540, z: 1.55, r: 0, d: .2, e: whip },
      { t: B.cutB, x: 960, y: 530, z: 1.02, r: .085, d: .15, e: ease.outExpo },
      { t: B.cant.start - .25, x: DOTX, y: 650, z: 2.05, r: -.02, d: 1.3, e: soft },
      { t: 27.5, x: 960, y: 540, z: 1.0, r: 0, d: .22, e: ease.outExpo },
    ];
  }
  function camAt(t, B) {
    const ks = camKeys(B); let v = { x: 950, y: 610, z: 1.5, r: 0 };
    if (t < 16) { const p = ease.inOutSine(clamp((t - 15) / 1)); v = { x: 950, y: lerp(612, 600, p), z: lerp(1.48, 1.6, p), r: lerp(0, -.02, p) }; }
    for (const k of ks) { if (t < k.t) break; const p = k.e(clamp((t - k.t) / k.d)); v = { x: lerp(v.x, k.x, p), y: lerp(v.y, k.y, p), z: lerp(v.z, k.z, p), r: lerp(v.r, k.r, p) }; }
    return v;
  }
  function camFull(t, B) {
    const v = camAt(t, B);
    const deadpan = t > B.peony.start && t < B.cutB, muffle = t > B.cant.start - .25 && t < 27.5;
    let dx = 0, dy = 0;
    if (t >= 16 && !deadpan) {
      const ramp = remap(t, 16, 27.5, 0, 1);
      const bt = Math.floor(t * 2) / 2, amp = (muffle ? .004 : .012 + .035 * ramp) * (bt % 1 === 0 ? 1.4 : 1);
      v.z *= 1 + amp * Math.exp(-(t - bt) * 9);
      const j = (muffle ? 2 : 3 + 10 * ramp);
      dx += noise1(t * 6, 41) * j; dy += noise1(t * 6, 43) * j; v.r += noise1(t * 2.5, 47) * .02 * ramp;
    }
    return { ...v, dx, dy };
  }
  function applyCam(ctx, c) { F.camera(ctx, { x: c.x, y: c.y, zoom: c.z, rot: c.r, dx: c.dx, dy: c.dy }); }

  // ─────────────────────────── world ───────────────────────────
  function drawWorld(g, t, B, o = {}) {
    if (!o.noPaper) F.paper(g, { tint: '#DCE3B0', tintAlpha: t < 16 ? .38 : lerp(.28, .5, invLerp(16, 27.5, t)) });
    g.save();
    if (o.pre) o.pre(g);
    const cam = camFull(t, B); applyCam(g, cam);
    // ground line
    F.inkLine(g, [[-600, GROUND + 2], [300, GROUND - 2], [960, GROUND + 3], [1600, GROUND - 1], [2500, GROUND + 2]], { t, seed: 2, lw: 4, amp: 1.2 });
    drawBoard(g, t);
    const n = landedBefore(t + .25);
    for (let i = 0; i < n; i++) if (!ITEMS[i].front) drawItem(g, ITEMS[i], t, o);
    characters(g, t, B);
    if (o.scrib) charScrib(g, t);
    for (let i = 0; i < n; i++) if (ITEMS[i].front) drawItem(g, ITEMS[i], t, o);
    drawTabBar(g, t);
    g.restore();
  }
  function charScrib(g, t) {
    [[DOTX, GROUND - 90, 0, 27.6], [DASHX, GROUND - 110, 3, 27.7]].forEach(([x, y, v, t0]) => {
      const p = clamp((t - t0) / .45); if (p <= 0) return;
      const pts = SCRIBS[v].map(q => [x + q[0] * 230, y + q[1] * 260]);
      strokePts(g, F.partialPolyline(F.wobble(pts, t, v, 3), p), 8);
    });
  }

  // ─────────────────────────── peony cut-away ───────────────────────────
  function peony(ctx, t, B) {
    const lt = t - B.cutA;
    F.paper(ctx, { tint: P.lilac, tintAlpha: .55 });
    ctx.save();
    const z = 1.04 + lt * .05; ctx.translate(960, 560); ctx.scale(z, z); ctx.translate(-960, -560);
    // spotlight
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(960, 840, 380, 60, 0, 0, TAU); ctx.fill();
    // pot
    F.inkShape(ctx, [[830, 700], [1090, 700], [1060, 860], [860, 860]], { fill: P.coral, t, seed: 4, lw: 5, amp: 1 });
    F.inkShape(ctx, F.roundRectPts(812, 676, 296, 50, 14, 40), { fill: P.coralShade, t, seed: 6, lw: 5 });
    // stem + crossed-leaf arms
    F.inkLine(ctx, [[960, 690], [955, 600], [962, 520]], { t, seed: 8, lw: 9, stroke: '#2E9E6A' });
    F.inkLine(ctx, [[960, 690], [955, 600], [962, 520]], { t, seed: 8, lw: 3 });
    const droop = Math.sin(lt * 2) * .03;
    ctx.save(); ctx.translate(960, 600); ctx.rotate(droop);
    F.inkShape(ctx, [[-10, 0], [-70, -30], [-110, 10], [-60, 30], [60, -12], [100, -40], [120, 0], [50, 20]], { fill: P.mint, t, seed: 12, lw: 4.5, amp: 1.2 });
    ctx.restore();
    // flower head
    ctx.save(); ctx.translate(960, 430 + Math.sin(lt * 2.2) * 4); ctx.rotate(-.06 + droop);
    for (let ring = 0; ring < 3; ring++) {
      const n = 9 - ring * 2, R = 150 - ring * 45, pr = 70 - ring * 14, col = [P.blush, '#FF8FA6', P.coral][ring];
      for (let k = 0; k < n; k++) { const a = k / n * TAU + ring * .4; F.inkShape(ctx, F.ellipsePts(Math.cos(a) * R * .72, Math.sin(a) * R * .62, pr, pr * .85, 18), { fill: col, t, seed: ring * 20 + k, lw: 4, amp: 1.3 }); }
    }
    F.inkShape(ctx, F.circlePts(0, 0, 70, 24), { fill: '#FFC9D4', t, seed: 77, lw: 4 });
    // sunglasses
    ctx.fillStyle = P.ink;
    ctx.beginPath(); ctx.roundRect(-66, -30, 58, 38, [6, 6, 18, 18]); ctx.roundRect(8, -30, 58, 38, [6, 6, 18, 18]); ctx.fill();
    ctx.fillRect(-12, -26, 24, 7);
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.moveTo(-54, -22); ctx.lineTo(-40, -22); ctx.lineTo(-52, 0); ctx.fill(); ctx.beginPath(); ctx.moveTo(20, -22); ctx.lineTo(34, -22); ctx.lineTo(22, 0); ctx.fill();
    // tear
    const tp = (lt * .9) % 1; ctx.save(); ctx.translate(46, 14 + tp * 34); ctx.globalAlpha = 1 - tp;
    ctx.beginPath(); ctx.moveTo(0, -8); ctx.quadraticCurveTo(7, 4, 0, 7); ctx.quadraticCurveTo(-7, 4, 0, -8); ctx.fillStyle = '#BFE3FF'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = P.ink; ctx.stroke(); ctx.restore();
    // unimpressed mouth
    ctx.beginPath(); ctx.moveTo(-20, 36); ctx.quadraticCurveTo(0, 30, 22, 38); ctx.lineWidth = 5; ctx.strokeStyle = P.ink; ctx.lineCap = 'round'; ctx.stroke();
    ctx.restore();
    // Do Not Disturb pill
    const k = spring(lt - .15, 3, .4);
    if (k > 0) {
      ctx.save(); ctx.translate(1340, 300); ctx.rotate(.06); ctx.scale(k, k);
      ctx.fillStyle = 'rgba(22,22,29,.92)'; ctx.beginPath(); ctx.roundRect(-160 + 7, -40 + 9, 330, 80, 40); ctx.fill();
      ctx.beginPath(); ctx.roundRect(-160, -40, 330, 80, 40); ctx.fillStyle = P.ink; ctx.fill();
      ctx.beginPath(); ctx.arc(-116, 0, 22, 0, TAU); ctx.fillStyle = P.lilac; ctx.fill();
      ctx.beginPath(); ctx.arc(-108, -8, 18, 0, TAU); ctx.fillStyle = P.ink; ctx.fill();
      F.font(ctx, 30, FT.ui, 800); ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.fillText('Do Not Disturb', -80, 11);
      ctx.restore();
    }
    F.font(ctx, 34, FT.hand, 700); ctx.fillStyle = P.ink; ctx.textAlign = 'center'; ctx.globalAlpha = clamp((lt - .3) * 4);
    ctx.fillText('(the peonies)', 960, 200);
    ctx.restore();
    F.vignette(ctx, .3);
  }

  // ─────────────────────────── freeze + title ───────────────────────────
  function freezeTitle(ctx, t) {
    const lt = t - 14;
    const gray = getGray(), snap = F.snapshot(13.99);
    const jolt = spring(lt, 3.2, .32);
    ctx.save();
    const z = 1 + .07 * jolt + Math.max(0, lt - .3) * .03, rot = -.03 * jolt;
    let [sx, sy] = F.shake(t, lt < .12 ? 26 * (1 - lt / .12) : 0, 5, 40);
    const slam = t - 14.3; if (slam > 0) { const a = 30 * Math.exp(-slam * 7); const s2 = F.shake(t, a, 9, 30); sx += s2[0]; sy += s2[1]; }
    ctx.translate(960 + sx, 540 + sy); ctx.rotate(rot); ctx.scale(z, z); ctx.translate(-960, -540);
    ctx.fillStyle = '#111'; ctx.fillRect(-200, -200, W + 400, H + 400);
    const desat = clamp(lt / .15);
    if (lt < .1) { // record-scratch glitch slices
      const b = Math.floor(t * 60);
      for (let k = 0; k < 9; k++) {
        const y0 = k * 120, off = (hash2(b, k) - .5) * 120 * (1 - lt / .1);
        ctx.drawImage(snap, 0, y0, W, 120, off, y0, W, 120);
      }
    } else ctx.drawImage(snap, 0, 0);
    ctx.globalAlpha = desat; ctx.drawImage(gray, 0, 0); ctx.globalAlpha = 1;
    // darken for the title
    const dk = remap(t, 14.12, 14.3, 0, 1, ease.outCubic);
    ctx.fillStyle = `rgba(40,38,44,${.42 * dk})`; ctx.fillRect(-200, -200, W + 400, H + 400);
    ctx.restore();
    F.vignette(ctx, .35 + .35 * dk);
    // flash on scratch
    if (lt < .08) { ctx.fillStyle = `rgba(255,255,255,${.5 * (1 - lt / .08)})`; ctx.fillRect(0, 0, W, H); }
    // big scratch zig-zag
    if (lt < .14) {
      const p = clamp(lt / .07), pts = []; for (let k = 0; k <= 14; k++) pts.push([k / 14 * 2200 - 140, 520 + (k % 2 ? -70 : 70) + hash(k) * 30]);
      ctx.save(); ctx.globalAlpha = 1 - clamp((lt - .07) / .07); strokePts(ctx, F.partialPolyline(pts, p), 12, P.red); ctx.restore();
    }
    if (t < 14.12) return;
    // title
    ctx.save();
    const [tx, ty] = slam > 0 ? F.shake(t, 20 * Math.exp(-slam * 6), 12, 26) : [0, 0];
    ctx.translate(tx, ty);
    const push = 1 + Math.max(0, t - 14.55) * .05; ctx.translate(960, 560); ctx.scale(push, push); ctx.translate(-960, -560);
    // splats
    for (const s of SPLATS) splat(ctx, s, ease.outBack(clamp((slam - s.dl) / .12)) * (slam > 0 ? 1 : 0), t);
    // "Chapter Six."
    const ck = spring(t - 14.14, 3.4, .4);
    if (ck > 0) {
      ctx.save(); ctx.globalAlpha = clamp(ck * 2); ctx.translate(960, 400 - (1 - ck) * 30);
      F.font(ctx, 64, FT.display, 400, 'italic'); ctx.textAlign = 'center'; ctx.fillStyle = P.paper; ctx.fillText('Chapter Six.', 0, 0); ctx.restore();
    }
    // "The Planning."
    const str = 'The Planning.'; F.font(ctx, 230, FT.display, 900);
    const widths = [...str].map(ch => ctx.measureText(ch).width), total = ctx.measureText(str).width;
    let x = 960 - total / 2; let li = 0;
    [...str].forEach((ch, i) => {
      if (ch === ' ') { x += widths[i]; return; }
      const land = 14.3 + li * .022; li++;
      const fall = clamp((t - (land - .13)) / .13);
      if (fall <= 0) { x += widths[i]; return; }
      const yOff = (1 - ease.inQuad(fall)) * -720, d = t - land;
      let ssx = 1, ssy = 1;
      if (d > 0) { const j = jiggle(d, 5, 9); ssy = 1 - .3 * Math.exp(-d * 18) + j * .08; ssx = 1 + .22 * Math.exp(-d * 18) - j * .06; }
      else { ssy = 1 + .35 * fall; ssx = 1 - .15 * fall; }
      const cx = x + widths[i] / 2, by = 680;
      ctx.save(); ctx.translate(cx, by + yOff); ctx.scale(ssx, ssy); ctx.textAlign = 'center';
      ctx.fillStyle = P.red; ctx.fillText(ch, 9, 9);
      ctx.lineWidth = 10; ctx.strokeStyle = P.ink; ctx.lineJoin = 'round'; ctx.strokeText(ch, 0, 0);
      ctx.fillStyle = P.paper; ctx.fillText(ch, 0, 0);
      ctx.restore();
      if (d > 0 && d < .45) { // dust puffs
        const q = d / .45; ctx.save(); ctx.globalAlpha = (1 - q) * .8; ctx.fillStyle = '#D9D3C7';
        for (const sd of [-1, 1]) { ctx.beginPath(); ctx.arc(cx + sd * (20 + q * 60), by + 10 - q * 16, 10 + q * 16, 0, TAU); ctx.fill(); }
        ctx.restore();
      }
      x += widths[i];
    });
    // underline slash
    const ul = remap(t, 14.56, 14.72, 0, 1, ease.outCubic);
    if (ul > 0) strokePts(ctx, F.partialPolyline(F.wobble([[960 - total / 2, 736], [960 - total / 6, 728], [960 + total / 6, 740], [960 + total / 2, 730]], t, 3, 2), ul), 12, P.red);
    ctx.restore();
  }

  // ─────────────────────────── subtitle pill ───────────────────────────
  const SUB_Y = H - 92;
  function subPill(ctx, t) {
    const l = F.lines().find(l => t >= l.start - .05 && t < l.end + .45 && (l.speaker === 'dot' || l.speaker === 'dash'));
    if (!l) return;
    const a = clamp((t - l.start + .05) / .12) * (1 - invLerp(l.end + .2, l.end + .45, t));
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    F.font(ctx, 46, FT.ui, 800); const tw = ctx.measureText(l.text).width;
    F.font(ctx, 20, FT.label, 700); const tag = ctx.measureText(l.speaker === 'dot' ? 'DOT' : 'DASH').width + 26;
    const x0 = W / 2 - tw / 2 - tag - 18 - 26, x1 = W / 2 + tw / 2 + 30;
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(22,22,29,.92)'; ctx.beginPath(); ctx.roundRect(x0 + 6, SUB_Y - 40 + 8, x1 - x0, 80, 40); ctx.fill();
    ctx.fillStyle = P.paper; ctx.beginPath(); ctx.roundRect(x0, SUB_Y - 40, x1 - x0, 80, 40); ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = P.ink; ctx.stroke();
    ctx.restore();
  }

  // ─────────────────────────── main ───────────────────────────
  F.addScene({
    name: 'b_chaos', start: 14.0, end: 30.0,
    subtitle(t, line) { return { x: W / 2, y: SUB_Y }; },
    draw(ctx, t) {
      const B = beats();
      if (t < 15.0) { freezeTitle(ctx, t); subPill(ctx, t); return; }
      if (t >= 29.8) { // HARD CUT: still ink ball on paper (hand-off to scene C)
        F.paper(ctx); inkBall(ctx, {}); return;
      }
      if (t >= B.cutA && t < B.cutB) { peony(ctx, t, B); subPill(ctx, t); return; }

      const buf = F.offscreen('b_world'), g = buf.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.filter = 'none'; g.globalCompositeOperation = 'source-over';

      if (t >= 27.5) { // ── scribble apocalypse ──
        const u = t - 27.5;
        const comp = ease.inOutCubic(clamp((t - 28.05) / 1.5));          // 0 → 1 compress
        const Bs = lerp(4.3, 1, comp) * (1 + .03 * Math.sin(t * 17));      // ball stroke scale
        const ws = lerp(1, .2, comp), spin = comp * .9;                    // world scale / spin
        const wa = 1 - clamp((t - 29.0) / .5);
        F.paper(g);
        if (wa > 0) {
          const wb = F.offscreen('b_world2'), g2 = wb.getContext('2d'); g2.setTransform(1, 0, 0, 1, 0, 0); g2.clearRect(0, 0, W, H);
          drawWorld(g2, t, B, { scrib: true, noPaper: true });
          g.save(); g.globalAlpha = wa; g.translate(960, 540); g.rotate(spin); g.scale(ws, ws); g.translate(-960, -540); g.drawImage(wb, 0, 0); g.restore();
        }
        const prog = clamp((t - 27.55) / 1.9);
        inkBall(g, { progress: prog, scale: Bs, t, lwScale: lerp(1.9, 1, comp) });
        // outer flying strands whipping around
        const [sx, sy] = F.shake(t, lerp(8, 34, clamp(u / 2.2)), 71, 28);
        ctx.save(); ctx.fillStyle = P.paper; ctx.fillRect(0, 0, W, H);
        ctx.translate(sx, sy); ctx.drawImage(buf, -40, -40, W + 80, H + 80); ctx.restore();
        F.vignette(ctx, .25 + .25 * comp, '255,45,85');
        subPill(ctx, t);
        return;
      }

      drawWorld(g, t, B, {});
      // composite with effects
      const c1 = camAt(t, B), c0 = camAt(t - 1 / 60, B);
      const vx = (c1.x - c0.x) * c1.z, vz = (c1.z - c0.z) * 300, vr = (c1.r - c0.r) * 300, speed = Math.hypot(vx, vz, vr);
      const muffle = t > B.cant.start - .25 && t < 27.5 ? remap(t, B.cant.start - .25, B.cant.start + .5, 0, 1, ease.outCubic) : 0;
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
      if (speed > 10) { // whip-pan motion blur
        ctx.drawImage(buf, 0, 0);
        const n = 5, dirx = -vx / (Math.abs(vx) + 1e-3);
        for (let k = 1; k <= n; k++) { ctx.globalAlpha = .28; const o = k / n * Math.min(160, speed * 1.2) * (Math.abs(vx) > Math.abs(vz) ? dirx : 0); const zz = 1 + (Math.abs(vx) > Math.abs(vz) ? 0 : k * .012 * Math.sign(vz)); ctx.drawImage(buf, o + W / 2 * (1 - zz), H / 2 * (1 - zz), W * zz, H * zz); }
        ctx.globalAlpha = 1;
      } else ctx.drawImage(buf, 0, 0);
      if (muffle > 0) { // noise muffles: blurred, darkened edges
        const sm = F.offscreen('b_small', 480, 270), sg = sm.getContext('2d');
        sg.setTransform(1, 0, 0, 1, 0, 0); sg.filter = 'blur(4px)'; sg.drawImage(buf, 0, 0, 480, 270); sg.filter = 'none';
        const mk = F.offscreen('b_mask'), mg = mk.getContext('2d');
        mg.setTransform(1, 0, 0, 1, 0, 0); mg.globalCompositeOperation = 'source-over'; mg.clearRect(0, 0, W, H); mg.drawImage(sm, 0, 0, W, H);
        mg.globalCompositeOperation = 'destination-out';
        const cc = camFull(t, B), ddx = (DOTX - cc.x) * cc.z, ddy = (GROUND - 95 - cc.y) * cc.z, fx = 960 + cc.dx + ddx * Math.cos(cc.r) - ddy * Math.sin(cc.r), fy = 540 + cc.dy + ddx * Math.sin(cc.r) + ddy * Math.cos(cc.r);
        const rg = mg.createRadialGradient(fx, fy, 150 * cc.z, fx, fy, 420 * cc.z); rg.addColorStop(0, 'rgba(0,0,0,1)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
        mg.fillStyle = rg; mg.fillRect(0, 0, W, H); mg.globalCompositeOperation = 'source-over';
        ctx.globalAlpha = muffle; ctx.drawImage(mk, 0, 0); ctx.globalAlpha = 1;
        F.vignette(ctx, .75 * muffle);
      }
      ctx.restore();
      // alarm vignette pulsing on the beat
      if (t >= 16) {
        const ramp = invLerp(16, 27.5, t), bp = Math.exp(-((t * 2) % 1) * 3);
        F.vignette(ctx, (.08 + .3 * ramp) * (.6 + .4 * bp) * (1 - muffle), '255,45,85');
      }
      // whip flash frame on cuts
      subPill(ctx, t);
    },
  });
})();
