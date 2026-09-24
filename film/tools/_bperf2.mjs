import { chromium } from 'playwright';
import path from 'node:path';
const url = 'file://' + path.resolve('index.html') + '?render=1';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(url); await page.evaluate(() => window.FILM_READY);
const r = await page.evaluate(() => { const cnv = document.getElementById('c'), ctx = cnv.getContext('2d');
  const T = (f, n = 10) => { ctx.save(); f(); ctx.restore(); const a = performance.now(); for (let i = 0; i < n; i++) { ctx.save(); f(); ctx.restore(); } ctx.getImageData(0,0,1,1); return +((performance.now() - a) / n).toFixed(1); };
  const D = B_CHAOS._dbg(), B = D.beats(); const sc = FILM.scenes.find(s => s.name === 'b_chaos');
  const out = {};
  for (const t of [15.5, 20.2, 24.2, 26.9, 27.7, 28.3, 29.2]) {
    out['scene' + t] = T(() => sc.draw(ctx, t, 0));
    out['world' + t] = T(() => D.drawWorld(ctx, t, B, t > 27.5 ? {scrib:true, noPaper:true} : {}));
    out['board' + t] = T(() => D.drawBoard(ctx, t));
    out['chars' + t] = T(() => D.characters(ctx, t, B));
    out['ball' + t] = T(() => B_CHAOS.inkBall(ctx, {t, progress: (t-27.55)/1.9, scale: 3, lwScale: 1.3}));
  }
  return out; });
console.log(r); await browser.close();
