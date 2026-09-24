import { chromium } from 'playwright';
import path from 'node:path';
const url = 'file://' + path.resolve('index.html') + '?render=1';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(url); await page.evaluate(() => window.FILM_READY);
const r = await page.evaluate(() => { const cnv = document.getElementById('c'), ctx = cnv.getContext('2d');
  const T = (f, n = 30) => { ctx.save(); f(); ctx.restore(); const a = performance.now(); for (let i = 0; i < n; i++) { ctx.save(); f(); ctx.restore(); } ctx.getImageData(0,0,1,1); return +((performance.now() - a) / n).toFixed(2); };
  const s = FILM.canvas(480, 160), g = s.getContext('2d'); g.fillStyle = '#f00'; g.fillRect(0,0,480,160); g.fillStyle='#000'; g.font='30px Inter'; g.fillText('hello world', 20, 80);
  const big = FILM.canvas(600, 200), gb = big.getContext('2d'); gb.drawImage(s, 0, 0, 600, 200);
  const full = FILM.canvas(1920,1080);
  const out = {};
  for (const [nm, src] of [['s1', s], ['s125', big]]) for (const q of ['low','medium','high']) for (const rot of [0, .2]) for (const sc of [1, 1.3])
    out[`${nm}_${q}_r${rot}_z${sc}`] = T(() => { ctx.imageSmoothingQuality = q; ctx.translate(400, 300); ctx.rotate(rot); ctx.scale(sc, sc); ctx.drawImage(src, -240, -80, 480, 160); });
  out.fullRot = T(() => { ctx.translate(960,540); ctx.rotate(.05); ctx.scale(1.05,1.05); ctx.drawImage(full, -960, -540); }, 5);
  out.fullScale = T(() => { ctx.translate(960,540); ctx.scale(1.05,1.05); ctx.drawImage(full, -960, -540); }, 5);
  return out; });
console.log(r); await browser.close();
