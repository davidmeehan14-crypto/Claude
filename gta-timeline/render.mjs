// Renders index.html to frames/MP4 deterministically.
// Usage: node render.mjs sheet <outdir> t1 t2 ...   |   node render.mjs video <out.mp4> [fps] [fontsDir]
import { createRequire } from 'module';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH || 'playwright');

const [mode, out, ...rest] = process.argv.slice(2);
const FFMPEG = process.env.FFMPEG || 'ffmpeg';
const fontsDir = process.env.FONTS_DIR;
const page0 = 'file://' + path.resolve(path.dirname(new URL(import.meta.url).pathname), 'index.html') + '?export';

const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
if (fontsDir) {
  const map = Object.fromEntries(fs.readFileSync(path.join(fontsDir, 'map.txt'), 'utf8').trim().split('\n').map(l => l.split(' ')));
  await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ contentType: 'text/css', body: fs.readFileSync(path.join(fontsDir, 'fonts.css')) }));
  await page.route('https://fonts.gstatic.com/**', r => r.fulfill({ contentType: 'font/woff2', body: fs.readFileSync(path.join(fontsDir, map[r.request().url()])) }));
}
page.on('pageerror', e => console.error('PAGE ERROR', e.message));
await page.goto(page0);
await page.evaluate(() => window.__ready);
const DUR = await page.evaluate(() => window.__DUR);
const grab = t => page.evaluate(t => { window.__render(t); return document.getElementById('screen').toDataURL('image/jpeg', .9).split(',')[1]; }, t);

if (mode === 'sheet') {
  fs.mkdirSync(out, { recursive: true });
  for (const t of rest.map(Number)) fs.writeFileSync(path.join(out, `f_${String(t).padStart(6, '0')}.jpg`), Buffer.from(await grab(t), 'base64'));
} else {
  const fps = Number(rest[0] || 30);
  const wav = out.replace(/\.mp4$/, '.wav');
  fs.writeFileSync(wav, Buffer.from(await page.evaluate(() => window.__audioWav()), 'base64'));
  console.log('audio done');
  const ff = spawn(FFMPEG, ['-y', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', '-i', wav,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '21', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', out], { stdio: ['pipe', 'ignore', 'inherit'] });
  const N = Math.floor(DUR * fps);
  for (let i = 0; i < N; i++) {
    const buf = Buffer.from(await grab(i / fps), 'base64');
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 300 === 0) console.log(`frame ${i}/${N}`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  fs.unlinkSync(wav);
}
await browser.close();
