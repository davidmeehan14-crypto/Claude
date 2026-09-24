import { chromium } from 'playwright';
import path from 'node:path';
const url = 'file://' + path.resolve('index.html') + '?render=1';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(url); await page.evaluate(() => window.FILM_READY);
const r = await page.evaluate(async () => { const cnv = document.getElementById('c'), ctx = cnv.getContext('2d');
  const T = (f, n = 20) => { f(); const a = performance.now(); for (let i = 0; i < n; i++) { ctx.save(); f(); ctx.restore(); } ctx.getImageData(0,0,1,1); return +((performance.now() - a) / n).toFixed(2); };
  const s = FILM.canvas(600, 200), g = s.getContext('2d'); g.fillStyle = '#f00'; g.fillRect(0,0,600,200);
  const bmp = await createImageBitmap(s);
  const s2 = document.createElement('canvas'); s2.width=600; s2.height=200; const g2 = s2.getContext('2d', {willReadFrequently:true}); g2.fillRect(0,0,600,200);
  return { axis: T(() => ctx.drawImage(s, 100, 100)), scaled: T(() => ctx.drawImage(s, 100, 100, 480, 160)),
    rot: T(() => { ctx.translate(400, 300); ctx.rotate(.2); ctx.drawImage(s, -300, -100, 480, 160); }),
    rotBmp: T(() => { ctx.translate(400, 300); ctx.rotate(.2); ctx.drawImage(bmp, -300, -100, 480, 160); }),
    rotCpu: T(() => { ctx.translate(400, 300); ctx.rotate(.2); ctx.drawImage(s2, -300, -100, 480, 160); }),
    rotNoSmooth: T(() => { ctx.imageSmoothingEnabled = false; ctx.translate(400, 300); ctx.rotate(.2); ctx.drawImage(s, -300, -100, 480, 160); }),
    fillRot: T(() => { ctx.translate(400, 300); ctx.rotate(.2); ctx.fillRect(-300, -100, 480, 160); }),
  }; });
console.log(r); await browser.close();
