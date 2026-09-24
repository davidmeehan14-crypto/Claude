import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--allow-file-access-from-files'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto('file:///home/user/Claude/film/index.html?render=1'); await p.evaluate(() => window.FILM_READY);
const r = await p.evaluate(() => { const out = {}; const c = document.getElementById('c');
  for (let t = 46; t < 60; t += 1/30) { const a = performance.now(); FILM.renderFrame(t); c.getContext('2d').getImageData(0,0,1,1); const d = performance.now() - a; const k = Math.floor(t); out[k] = out[k] || []; out[k].push(d); }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, [Math.round(v.reduce((a,b)=>a+b)/v.length), Math.round(Math.max(...v))]])); });
console.log(r); await b.close();
