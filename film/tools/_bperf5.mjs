import { chromium } from 'playwright';
import path from 'node:path';
const url = 'file://' + path.resolve('index.html') + '?render=1';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(url); await page.evaluate(() => window.FILM_READY);
const r = await page.evaluate(() => { const cnv = document.getElementById('c'), ctx = cnv.getContext('2d');
  const T = (f, n = 10) => { ctx.save(); f(); ctx.restore(); const a = performance.now(); for (let i = 0; i < n; i++) { ctx.save(); f(); ctx.restore(); } ctx.getImageData(0,0,1,1); return +((performance.now() - a) / n).toFixed(1); };
  const D = B_CHAOS._dbg(); const its = D.ITEMS.filter(i => i.t < 24.2);
  const off = FILM.offscreen('b_world'), og = off.getContext('2d');
  return {
    itemsMain: T(() => { for (const it of its) D.drawItem(ctx, it, 24.2, {}); }),
    itemsOff: T(() => { for (const it of its) D.drawItem(og, it, 24.2, {}); og.getImageData(0,0,1,1); }),
    rectsOnly: T(() => { for (const it of its) { ctx.save(); ctx.translate(it.x, it.y); ctx.rotate(it.rot); ctx.fillRect(-200, -60, 400, 120); ctx.restore(); } }),
  }; });
console.log(r); await browser.close();
