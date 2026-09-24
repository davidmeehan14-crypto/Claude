import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--allow-file-access-from-files'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
await p.goto('file:///home/user/Claude/film/index.html?render=1'); await p.evaluate(() => window.FILM_READY);
for (const dx of [{}, {bush:1}, {fl:1}, {arch:1}, {couple:1}])
console.log(JSON.stringify(dx), await p.evaluate((dx) => { window.DX = dx; const c = document.getElementById('c'); for (let t = 48; t < 48.5; t += 1/30) FILM.renderFrame(t);
 let tot = 0; for (let t = 48; t < 49.3; t += 1/30) { const a = performance.now(); FILM.renderFrame(t); c.getContext('2d').getImageData(0,0,1,1); tot += performance.now() - a; }
 return +(tot/39).toFixed(1); }, dx));
await b.close();
