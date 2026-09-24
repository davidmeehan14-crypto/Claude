import { chromium } from 'playwright';
import path from 'node:path';
const url = 'file://' + path.resolve('index.html') + '?render=1';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(url); await page.evaluate(() => window.FILM_READY);
const r = await page.evaluate(() => { const cnv = document.getElementById('c'), ctx = cnv.getContext('2d');
  const T = (f, n = 10) => { ctx.save(); f(); ctx.restore(); const a = performance.now(); for (let i = 0; i < n; i++) { ctx.save(); f(); ctx.restore(); } ctx.getImageData(0,0,1,1); return +((performance.now() - a) / n).toFixed(1); };
  const D = B_CHAOS._dbg(), B = D.beats(), t = 24.2;
  return { board: T(() => D.drawBoard(ctx, t)), tab: T(() => D.drawTabBar(ctx, t)), chars: T(() => D.characters(ctx, t, B)),
    items: T(() => { for (const it of D.ITEMS) if (it.t < t) D.drawItem(ctx, it, t, {}); }), nItems: D.ITEMS.filter(i => i.t < t).length,
    items29: T(() => { for (const it of D.ITEMS) if (it.t < 28.5) D.drawItem(ctx, it, 28.5, {scrib:true}); }),
    ball: T(() => B_CHAOS.inkBall(ctx, {t: 28.5, scale: 3})), world: T(() => D.drawWorld(ctx, t, B, {})) }; });
console.log(r); await browser.close();
