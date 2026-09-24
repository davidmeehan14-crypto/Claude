import { chromium } from 'playwright';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--allow-file-access-from-files'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
const errs=[]; p.on('console', m => { if (m.type()==='error') errs.push(m.text()); }); p.on('pageerror', e=>errs.push(e.message));
await p.goto('file:///home/user/Claude/launch/index.html?render=1'); await p.evaluate(() => window.FILM_READY);
const r = await p.evaluate(() => { const out = []; for (let t = 13; t < 25; t += 1/30) { const a = performance.now(); KIT.renderFrame(t); document.getElementById('c').getContext('2d').getImageData(0,0,1,1); out.push([t, performance.now() - a]); } out.sort((x,y)=>y[1]-x[1]); return { avg: out.reduce((s,x)=>s+x[1],0)/out.length, worst: out.slice(0,6).map(x=>x[0].toFixed(2)+':'+x[1].toFixed(0)) }; });
console.log(JSON.stringify(r), errs.filter(e=>!e.includes('ERR_FILE')).slice(0,5)); await b.close();
