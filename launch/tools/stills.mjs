// Render stills / contact sheets for QA.
// usage: node tools/stills.mjs <out.png> <times...>        e.g. 1.2 3.5 10  or ranges a:b:step
//   --sheet  (default when >1 time) composes a labelled grid; --cols=N; --w=480 (thumb width)
//   --each   also write one full-size PNG per time next to <out>
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
const pos = args.filter(a => !a.startsWith('--'));
const out = pos.shift();
const times = [];
for (const p of pos) { if (p.includes(':')) { const [a, b, s] = p.split(':').map(Number); for (let t = a; t <= b + 1e-9; t += s) times.push(+t.toFixed(4)); } else times.push(+p); }
const here = path.dirname(new URL(import.meta.url).pathname);
const url = 'file://' + path.resolve(here, '..', 'index.html') + '?render=1';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errs = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text()); });
page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
await page.goto(url);
await page.evaluate(() => window.FILM_READY);
const thumbW = +(flags.w || 480), single = times.length === 1 && !flags.sheet;
const data = await page.evaluate(async ({ times, thumbW, single, each }) => {
  const cnv = document.getElementById('c');
  const outs = [];
  if (single) { KIT.renderFrame(times[0]); return { sheet: cnv.toDataURL('image/png'), each: [] }; }
  const cols = Math.min(times.length, Math.ceil(Math.sqrt(times.length * 1.2)));
  const th = Math.round(thumbW * 9 / 16), rows = Math.ceil(times.length / cols);
  const sheet = document.createElement('canvas'); sheet.width = cols * (thumbW + 8) + 8; sheet.height = rows * (th + 30) + 8;
  const g = sheet.getContext('2d'); g.fillStyle = '#222'; g.fillRect(0, 0, sheet.width, sheet.height);
  times.forEach((t, i) => {
    KIT.renderFrame(t);
    if (each) outs.push(cnv.toDataURL('image/png'));
    const x = 8 + (i % cols) * (thumbW + 8), y = 8 + Math.floor(i / cols) * (th + 30);
    g.drawImage(cnv, x, y, thumbW, th);
    g.fillStyle = '#fff'; g.font = '600 18px Inter'; g.fillText(t.toFixed(2) + 's', x + 4, y + th + 20);
  });
  return { sheet: sheet.toDataURL('image/png'), each: outs };
}, { times, thumbW, single, each: !!flags.each });
fs.writeFileSync(out, Buffer.from(data.sheet.split(',')[1], 'base64'));
data.each.forEach((d, i) => fs.writeFileSync(out.replace(/\.png$/, `_${times[i].toFixed(2)}.png`), Buffer.from(d.split(',')[1], 'base64')));
if (errs.length) console.log('CONSOLE:\n' + [...new Set(errs)].slice(0, 20).join('\n'));
console.log('wrote', out, times.length, 'frame(s)');
await browser.close();
