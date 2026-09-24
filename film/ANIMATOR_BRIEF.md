# Brief for scene animators

You are one of four animators building a 60 s 2D launch film for **The Wedding Chapter** (a wedding-planning app).
The bar is: *the most incredible animated launch film the client has seen* — modern, bold, emotional, funny,
nothing like a typical wedding-app advert. Think premium motion-design studio (Buck, Giant Ant, Oddfellows) meets a
Pixar short: snappy squash & stretch, anticipation/overshoot, smear & speed lines, kinetic typography, camera moves,
layered parallax, satisfying rhythmic timing locked to a 120 BPM grid (beat = 0.5 s).

## Read first
1. `film/SPEC.md` — story, cast, style guide, exact timeline, SFX + music cue times. Your act's section is law for timing.
2. `film/engine.js` — shared helpers (read the whole file; it's the toolbox): easing/springs/jiggle, seeded noise,
   wobbly "boiled" ink shapes (`inkShape`, `inkLine`, `partialPolyline`), paper background (`paper`), `vignette`,
   `camera`, characters `drawDot`, `drawDash`, `drawBiscuit` (moods, arms, walk, kneel, blush, look, holdL/holdR),
   lip-sync (`mouth(speaker,t)` is automatic when `mouth` is omitted), `heart`, `sparkle`, `confetti`,
   text (`font`, `typeText`, `chapterCaption`), `pageTurn` transition, `snapshot(t)` (cached render of any
   other moment of the film — use it for freezes, flipbooks, transitions from the previous act), subtitles.
3. Look at `film/scenes/_test.js` for a minimal usage example (NOT loaded by index.html; it is just a reference).

## Rules
- Write ONLY your own file(s) under `film/scenes/` (and optional helper file `film/scenes/<yourprefix>_*.js`
  which you must then also add as a <script> tag in `film/index.html` right before your scene file). Don't edit
  engine.js — if you need a helper, write it inside your scene file (namespaced). If you find an engine BUG, tell
  the lead in your final report (with the fix) rather than editing.
- Register with `FILM.addScene({ name, start, end, draw(ctx, t, lt, dur) { ... } })`. You own the whole frame for
  your time range: draw the background yourself (`FILM.paper(ctx)` or your own). Pure function of t —
  no state carried between frames, no Math.random (use FILM.rng/hash/noise), no Date.
- Performance: each frame must render in < 60 ms on the headless renderer. Cache static expensive
  things in `FILM.offscreen(key)` canvases built once.
- Subtitles are drawn globally by the engine from `window.DIALOGUE` (bottom-centre). If your composition needs
  them elsewhere, give your scene a `subtitle(t, line)` method returning `{x, y}` (or `false` to hide).
  Keep the bottom ~160 px reasonably clear during dialogue.
- `film/data/dialogue.js` may not exist yet (the voice team is producing it). Lip-sync falls back to closed
  mouths; that's fine. Once it exists, use real line times (`FILM.lines()`) if you animate reactions to them.
- Characters' canonical size: scale 1 = Dot ~190 px tall incl. legs, Dash ~230 px. Ground line y≈760 in wide shots.
  Palette & fonts are in `FILM.PAL` / `FILM.FONT` — stay on-palette. Keep the hand-inked look (5px ink outlines,
  12 fps line boil) — flat, bold, tactile. Use Fraunces 900 for big slams, Fraunces italic for storybook captions.
- Make it FUNNY and EMOTIONAL: acting matters — eye direction, blinks, blush, anticipation before moves,
  reactions to other characters' lines, secondary motion (hair curl, ears, tails), little background gags.

## QA loop (mandatory)
Render stills and contact sheets and LOOK at them with the Read tool, iterate until it's great:
```
cd film && node tools/stills.mjs /tmp/<you>_sheet.png 14:16:0.1          # contact sheet (any range a:b:step)
node tools/stills.mjs /tmp/<you>_f.png 21.5                               # one full-res frame
```
It prints console errors — must be clean. Check: boundaries with neighbouring acts (continuity of character
positions/colours at the hand-off times in SPEC.md), readability of all text, no frames that are empty/broken,
motion reads well across consecutive frames (sample at 1/30 s around fast moves).
Also time a full pass of your range for speed:
`node -e` is fine, or add `--w=160` to a stills run over your whole range at 0.0333 step and time it.

## Final report (keep it short)
What you built beat-by-beat with times, any SFX/cue times you added or moved (the lead syncs audio),
anything you need from the engine, known weaknesses.
