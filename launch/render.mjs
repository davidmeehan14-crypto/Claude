// Frame-exact render of the film to MP4 (1920x1080, 30 fps) with the mixed soundtrack.
// usage: node render.mjs [--workers=4] [--from=0] [--to=60] [--out=out/the_wedding_chapter_app_launch.mp4] [--crf=16]
import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';
const flags = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const here = path.dirname(new URL(import.meta.url).pathname);
const FFMPEG = execFileSync('python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim();
const FPS = 30, from = +(flags.from || 0), to = +(flags.to || 45), workers = +(flags.workers || 4), crf = flags.crf || '16';
const out = path.resolve(here, flags.out || 'out/the_wedding_chapter_app_launch.mp4');
const tmp = path.resolve(here, 'out/.segments'); fs.mkdirSync(tmp, { recursive: true });
const f0 = Math.round(from * FPS), f1 = Math.round(to * FPS), per = Math.ceil((f1 - f0) / workers);
const url = 'file://' + path.resolve(here, 'index.html') + '?render=1';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--allow-file-access-from-files'] });
const t0 = Date.now(); let done = 0;
async function worker(k) {
  const a = f0 + k * per, b = Math.min(f1, a + per); if (a >= b) return null;
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', e => console.error('PAGEERROR', e.message));
  await page.goto(url); await page.evaluate(() => window.FILM_READY);
  const seg = path.join(tmp, `seg${k}.mp4`);
  const ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-tune', 'animation', seg], { stdio: ['pipe', 'inherit', 'inherit'] });
  for (let f = a; f < b; f++) {
    const d = await page.evaluate(t => { KIT.renderFrame(t); return document.getElementById('c').toDataURL('image/jpeg', 0.96); }, f / FPS);
    const buf = Buffer.from(d.slice(d.indexOf(',') + 1), 'base64');
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (++done % 60 === 0) process.stdout.write(`\r${done}/${f1 - f0} frames  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end(); await new Promise(r => ff.on('close', r)); await page.close();
  return seg;
}
const segs = (await Promise.all([...Array(workers).keys()].map(worker))).filter(Boolean);
await browser.close();
console.log(`\nframes done in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
fs.writeFileSync(path.join(tmp, 'list.txt'), segs.map(s => `file '${s}'`).join('\n'));
const audio = path.resolve(here, 'audio/soundtrack.wav');
const args = ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'list.txt')];
if (fs.existsSync(audio) && !flags.noaudio) args.push('-ss', String(from), '-t', String(to - from), '-i', audio, '-map', '0:v', '-map', '1:a', '-c:a', 'aac', '-b:a', '256k', '-shortest');
args.push('-c:v', 'copy', '-movflags', '+faststart', out);
execFileSync(FFMPEG, args, { stdio: 'inherit' });
console.log('wrote', out);
