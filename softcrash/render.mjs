// Frame-exact render of Soft Crash to MP4 (1920x1080, 30 fps) with the original song.
// usage: node render.mjs [--workers=2] [--from=0] [--to=202.72] [--out=out/soft_crash.mp4] [--crf=20] [--resume]
import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import path from 'node:path'; import fs from 'node:fs';
const flags = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const here = path.dirname(new URL(import.meta.url).pathname);
const FFMPEG = execFileSync('python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())']).toString().trim();
const FPS = 30, from = +(flags.from || 0), to = +(flags.to || 202.72), workers = +(flags.workers || 2), crf = flags.crf || '20';
const out = path.resolve(here, flags.out || 'out/soft_crash.mp4');
const tmp = path.resolve(here, flags.tmp || 'out/.segments'); fs.mkdirSync(tmp, { recursive: true });
const f0 = Math.round(from * FPS), f1 = Math.round(to * FPS), CH = +(flags.chunk || 300);
const url = 'file://' + path.resolve(here, 'index.html') + '?render=1';
const t0 = Date.now(); let done = 0, todo = 0;
// fixed 10 s chunks so single sections can be re-rendered (delete out/.segments/cNNNN.mp4 and run with --resume)
const chunks = []; for (let a = f0; a < f1; a += CH) chunks.push([a, Math.min(f1, a + CH)]);
const segOf = ([a]) => path.join(tmp, `c${String(a).padStart(5, '0')}.mp4`);
const queue = chunks.filter(c => !(flags.resume && fs.existsSync(segOf(c) + '.done')));
queue.forEach(([a, b]) => todo += b - a);
console.log(`${chunks.length} chunks, ${queue.length} to render (${todo} frames)`);
async function worker(k) {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--allow-file-access-from-files', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', e => console.error('PAGEERROR', e.message));
  await page.goto(url); await page.evaluate(() => window.FILM_READY);
  while (queue.length) {
    const [a, b] = queue.shift(); const seg = segOf([a]);
    const ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-tune', 'film', '-x264-params', 'keyint=60', seg], { stdio: ['pipe', 'inherit', 'inherit'] });
    for (let f = a; f < b; f++) {
      const d = await page.evaluate(t => { FILM.renderFrame(t); return document.getElementById('c').toDataURL('image/jpeg', 0.97); }, f / FPS);
      const buf = Buffer.from(d.slice(d.indexOf(',') + 1), 'base64');
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (++done % 30 === 0) { const el = (Date.now() - t0) / 1000; process.stdout.write(`\r${done}/${todo} frames  ${el.toFixed(0)}s  eta ${((todo - done) * el / done / 60).toFixed(1)}min   `); }
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r));
    fs.writeFileSync(seg + '.done', '1');
  }
  await browser.close();
}
await Promise.all([...Array(workers).keys()].map(worker));
const segs = chunks.map(segOf);
console.log(`\nframes done in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
fs.writeFileSync(path.join(tmp, 'list.txt'), segs.map(s => `file '${s}'`).join('\n'));
const audio = path.resolve(here, 'audio/soft_crash.mp3');
const args = ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', path.join(tmp, 'list.txt')];
if (!flags.noaudio) args.push('-ss', String(from), '-t', String(to - from), '-i', audio, '-map', '0:v', '-map', '1:a:0', '-c:a', 'aac', '-b:a', '256k', '-shortest');
args.push('-c:v', 'copy', '-movflags', '+faststart', out);
execFileSync(FFMPEG, args, { stdio: 'inherit' });
console.log('wrote', out);
