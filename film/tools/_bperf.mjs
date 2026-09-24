import { chromium } from 'playwright';
import path from 'node:path';
const url = 'file://' + path.resolve('index.html') + '?render=1';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
await page.goto(url); await page.evaluate(() => window.FILM_READY);
const r = await page.evaluate(() => { const out = {}; const cnv = document.getElementById('c');
  for (let t = 14; t < 30; t += 1/30) { const sc = FILM.scenes.find(s => s.name === "b_chaos"); const c2 = cnv.getContext("2d"); c2.save(); const a = performance.now(); sc.draw(c2, t, t - 14); c2.restore(); cnv.getContext('2d').getImageData(0,0,1,1); const d = performance.now() - a; const k = Math.floor(t); (out[k] = out[k] || []).push(d); }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [Math.round(v.reduce((a,b)=>a+b)/v.length), Math.round(Math.max(...v))]])); });
console.log(r); await browser.close();
