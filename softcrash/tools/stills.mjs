// Render stills or a contact sheet. usage: node tools/stills.mjs out.png 12.5  |  node tools/stills.mjs sheet.png 10:40:2 [--w=480]
import { chromium } from 'playwright';
import path from 'node:path'; import fs from 'node:fs';
const [out, spec, ...rest] = process.argv.slice(2);
const flags = Object.fromEntries(rest.map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const here = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--allow-file-access-from-files', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await b.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('CONSOLE', m.type(), m.text().slice(0, 600)); });
page.on('pageerror', e => console.log('PAGEERROR', e.message.slice(0, 800)));
await page.goto('file://' + path.join(here, 'index.html') + '?render=1');
await page.evaluate(() => window.FILM_READY);
let times;
if (spec.includes(':')) { const [a, z, s] = spec.split(':').map(Number); times = []; for (let t = a; t <= z + 1e-6; t += s) times.push(+t.toFixed(3)); }
else times = spec.split(',').map(Number);
const tw = +(flags.w || (times.length > 1 ? 480 : 1920)), th = Math.round(tw * 9 / 16);
const shots = [];
for (const t of times) {
  const r = await page.evaluate(async ({ t, tw, th }) => {
    const t0 = performance.now(); FILM.renderFrame(t); const c = document.getElementById('c');
    const gl = c.getContext('webgl2'); const px = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const ms = performance.now() - t0;
    const o = document.createElement('canvas'); o.width = tw; o.height = th; const x = o.getContext('2d');
    x.drawImage(c, 0, 0, tw, th);
    if (tw < 1920) { x.fillStyle = 'rgba(0,0,0,.6)'; x.fillRect(0, 0, 150, 22); x.fillStyle = '#0f0'; x.font = '14px monospace'; x.fillText(t.toFixed(2) + 's ' + ms.toFixed(0) + 'ms', 4, 16); }
    return { d: o.toDataURL('image/png'), ms };
  }, { t, tw, th });
  shots.push(r); console.log(`t=${t} ${r.ms.toFixed(0)}ms`);
}
if (shots.length === 1) fs.writeFileSync(out, Buffer.from(shots[0].d.split(',')[1], 'base64'));
else {
  const cols = +(flags.cols || 4);
  const d = await page.evaluate(async ({ imgs, cols, tw, th }) => {
    const rows = Math.ceil(imgs.length / cols); const c = document.createElement('canvas'); c.width = cols * tw; c.height = rows * th;
    const x = c.getContext('2d');
    for (let i = 0; i < imgs.length; i++) { const im = new Image(); im.src = imgs[i]; await im.decode(); x.drawImage(im, (i % cols) * tw, Math.floor(i / cols) * th); }
    return c.toDataURL('image/png');
  }, { imgs: shots.map(s => s.d), cols, tw, th });
  fs.writeFileSync(out, Buffer.from(d.split(',')[1], 'base64'));
}
await b.close();
