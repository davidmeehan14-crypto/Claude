# Soft Crash — animated music video

Song: **Soft Crash** by dave_m (3:22, 115 BPM). 1920×1080, 30 fps, rendered frame-exact from real-time WebGL2 shaders.

## Concept
The cover art (a sun sinking into fog) is the anchor. The video is a walk through memory, from the haze to the
mezzanine and back, in six hand-built shader worlds:

| Time | Section | World |
|---|---|---|
| 0:00 | intro | TV static resolves into the hazy sun; title card |
| 0:16 | verse 1 | *silver static* sparkle, *colours start to run* (spectral drip), *into one* (hues collapse) |
| 0:33 | hum | sound rings ripple out of the sun, horizon vibrates on the kick |
| 0:41 | walking | a mirror salt-flat at dusk: a lone walker, floating polaroids (“lost things”) drifting into the glow |
| 0:58 | chorus ×2 | raymarched brutalist hall at golden hour; window god-rays; camera is *pulled to the mezzanine* on the lyric; every *soft crash* shatters the frame into glass shards |
| 1:15 | the drop | slow-motion white-out into silence |
| 1:19 | verse 2 | day/night split sky that rotates (*caught between the nights and days*), image drifts *out of phase* |
| 1:36 | pulse | the sun beats with the kick |
| 1:44 | walking | the salt flat again, night turning to dawn |
| 2:01 | chorus ×2 | the mezzanine at blue hour |
| 2:20 | bridge | *weightless*: free-fall through lit cloud sheets / *shapeless*: a breathing blank void (alternating) |
| 2:37 | rebirth | a horizon line draws itself, the sun returns as a dot, then darkness |
| 2:45 | final chorus | the mezzanine at full gold |
| 3:01 | reprise | every lost thing rushes past into the glow |
| 3:16 | outro | back to the cover image, fade out |

Chorus words each have their own typographic move: *pull me* (letters stretched upward), *to the mezzanine* (rises),
*half-seen* (lower half defocused), *daydream* (hue-shift + float), *quiet gleam* (a gleam sweeps the frame and letters).

## Files
- `index.html`: live player (open via a local web server, press play). `?t=60` starts at 1:00.
- `js/shaders.js`: all GLSL (scene worlds, transition mix, bloom, composite with shatter/lens/grade/grain/letterbox).
- `js/timeline.js`: choreography on the bar grid, cameras, section params, **lyric cue times**, shatter events.
- `js/type.js`: kinetic typography (per-letter animation into a 2D canvas that the composite lights and shatters).
- `data/features.js`: per-frame audio features (kick, snare, loudness, air, sub) from `tools/features.py`.
- `render.mjs`: offline renderer (headless Chromium, 10 s chunks, `--resume`), muxes the original MP3.
- `tools/stills.mjs`: stills and contact sheets for QA.

## Lyric timing
No speech-recognition model was reachable from the build machine, so line timing comes from signal analysis:
tempo/phase (115.00 BPM, downbeat at 0.042 s), bar-level section repetition, and pitch-tracking of the centre-panned
vocal. Lines sit on the bar grid (verse = 2 bars/line, *walking* = 1 bar/phrase, chorus = 4 bars). If a line
lands early or late, change its bar/beat in `js/timeline.js` (`B(bar, beat)`) and re-render just that
chunk: delete `out/.segments/cNNNNN.mp4*` for the affected 10 s chunk(s) and run `node render.mjs --resume`.

## Render
```
npm i && pip install imageio-ffmpeg numpy scipy soundfile
node render.mjs --workers=2 --out=out/soft_crash_master.mp4      # ~2 h on 4 CPU cores (SwiftShader)
```
