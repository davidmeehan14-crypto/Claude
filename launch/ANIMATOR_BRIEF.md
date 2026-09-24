# Brief for scene animators — The Wedding Chapter app launch film

We are recreating, from scratch, the *style* of a premium Apple-style mobile-app launch ad (client reference) for
**The Wedding Chapter**, a wedding-planning app. 45 s, 1920×1080, 30 fps, 120 BPM (beat = 0.5 s). No voiceover —
the story is told by kinetic typography, product UI and motion, over music + sound design.

Reference frames (study them!): `/tmp/claude-0/-home-user-Claude/40923ba0-b069-591e-9ab7-e4c3329b6782/scratchpad/ref/`
(`sheet_01.png`, `sheet_02.png` = 1 frame/second of the whole reference; `key.png` = 8 full-size key frames).
The reference MP4 itself: `/root/.claude/uploads/40923ba0-b069-591e-9ab7-e4c3329b6782/ffd9eb5c-YTDown.com_YouTube_Best-Mobile-App-Product-Launch-Ad-Video-_Media_jlKJDf5uObc_001_1080p.mp4`
— extract more frames of the matching section with ffmpeg (`python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"`),
e.g. every 0.1 s, to study HOW things move (easing, timing, stagger, blur, transitions) and match that polish.
Ignore the "sleeko" watermark in the reference — don't copy it. Don't copy its content: make it about weddings.

## Read first
1. `launch/SPEC.md` — timeline; your section's times are law. Brand palette and fonts.
2. `launch/kit.js` — the shared toolkit (read all of it): easing/springs, `bgWhite` (white stage + pastel cloud band =
   the reference's signature), `bgMesh` (pastel gradient world), `bgSky`, kinetic type (`layout` + `drawLine` with
   per-glyph anim, `typeAnim`, `riseAnim`, `caret`), the real `logo`, glossy 3D objects `obj(ctx, name, …)`
   (heart, ring, coupe, envelope, cake, rose, calendar, gift, star, bouquet), outline `icon`s, a UI kit `UI.*` for phone
   screens (logical 390×844), `phone()` mockup (fake 3D yaw, landscape), `touch` cursor, `glass` bubbles,
   `zoomBlur`, `whip`, `fade`, `snapshot(t)`.
3. `launch/scenes/_kittest.js` — tiny usage sample (not loaded by index.html).

## Rules
- Write ONLY your scene file `launch/scenes/<yours>.js` (+ optional `launch/scenes/<prefix>_*.js` helpers added to
  index.html right before your file) and your cue file `launch/data/cues/<yours>.json`. Don't edit kit.js — if you need
  something generic, implement it in your file; report kit bugs to the lead.
- `KIT.addScene({ name, start, end, draw(ctx, t, lt, dur) })`, draw the FULL frame, pure function of t (no Math.random,
  no Date, no state between frames except caches). Target < 70 ms/frame; cache static art with `KIT.cache`.
- Stay on brand: white/cream/pastel worlds, plum ink type (`C.ink`), gold/rose accents, Plus Jakarta Sans; accent words
  may use Fraunces italic with a gold→rose gradient. The app name is exactly "The Wedding Chapter" and the logo is only
  ever drawn with `KIT.logo` (never re-typeset it). Couple names in UI: "Sophie & James"; wedding date Saturday 14 June.
  Don't invent prices/claims about the app itself; demo data (budgets, guest counts) is fine.
- Motion quality bar: fast expo/quart ease-outs, springy icon pops, per-letter staggers, subtle constant drift so nothing
  is ever dead-still, motion blur on fast moves (`zoomBlur`/`whip` or per-object `blur`), depth via scale/blur/parallax.
  Cut and land on the beat grid (multiples of 0.25 s).
- Hand-offs: each scene boundary should read as a designed transition (whoosh/zoom/whip/mask). Coordinate with
  neighbours through SPEC.md times; at your start you may use `KIT.snapshot(start - 0.001)` to transition from the
  previous scene's last frame if it exists.
- SOUND: write every sound moment as cues in `launch/data/cues/<yours>.json`:
  `[{"t": 3.02, "sfx": "type", "gain": 0.8, "pan": -0.2}, …]` using ONLY these names: whoosh, whoosh_short, swish, pop,
  pop_soft, type, caret, tap, click, toggle, success, notify, scan, shutter, drag, drop, bubble, sparkle, riser,
  impact_soft, glass_ting, paper, swipe, logo_shimmer, bass_drop. Be generous but tasteful (every key typed, every pop,
  every tap, every whoosh), gains 0.3–1.0. For whooshes/risers give the time of the PEAK (the placer aligns it).
  Generate the JSON from your timing constants (e.g. a small node/python script) so it stays in sync.

## QA loop (mandatory)
```
cd launch && node tools/stills.mjs /tmp/<you>_sheet.png 3:9:0.25      # contact sheet
node tools/stills.mjs /tmp/<you>_f.png 5.5                           # full frame
```
Look at them with the Read tool; compare against the reference frames side by side; iterate until it's genuinely
premium. Check fast moves at 1/30 s steps. Console must be clean. Check timing per frame for speed.

## Final report (short)
Beat-by-beat what you built, cue count, known weaknesses, any kit issues.
