import { chromium } from 'playwright';
import path from 'node:path';
const url = 'file://' + path.resolve('index.html') + '?render=1';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(url); await page.evaluate(() => window.FILM_READY);
const r = await page.evaluate(() => { const cnv = document.getElementById('c'), ctx = cnv.getContext('2d');
  const T = (f, n = 20) => { f(); const a = performance.now(); for (let i = 0; i < n; i++) { f(); } ctx.getImageData(0,0,1,1); return +((performance.now() - a) / n).toFixed(1); };
  const off = FILM.offscreen('xx');
  return { frame5: T(() => FILM.renderFrame(5.3)), frame10: T(() => FILM.renderFrame(10.3)), paper: T(() => FILM.paper(ctx)), paperTint: T(() => FILM.paper(ctx, {tint:'#DCE3B0', tintAlpha:.4})),
    drawImg: T(() => ctx.drawImage(off, 0, 0)), grain: T(() => FILM.grain(ctx, 3)), vign: T(() => FILM.vignette(ctx, .3)), scenes: FILM.scenes.map(s => s.name + ':' + s.start + '-' + s.end).join(','),
    test: T(() => { const s = FILM.scenes.find(s => s.name === 'test'); if (s) s.draw(ctx, 20, 20); }),
    b20: T(() => { const s = FILM.scenes.find(s => s.name === 'b_chaos'); s.draw(ctx, 20.2, 6.2); }),
    b24: T(() => { const s = FILM.scenes.find(s => s.name === 'b_chaos'); s.draw(ctx, 24.2, 6.2); }),
  }; });
console.log(r); await browser.close();
