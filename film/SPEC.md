# "Chapters" — The Wedding Chapter launch film

60.000 s · 1920×1080 · 30 fps (1800 frames) · 2D canvas animation · stereo 48 kHz

## Logline
Two shapes fall in love in a hand-inked storybook. Their story flies by, chapter
by chapter, until **Chapter 6: The Planning** swallows them in a hurricane of
notifications, spreadsheets and a mysterious Uncle Gary. Then a golden bookmark
drops, the page turns, and **The Wedding Chapter** untangles the chaos into one
calm, beautiful plan. They say "I do", the book flips back through their whole
story, and closes on the logo.

## Cast
| Name | Shape | Colour | Voice |
|---|---|---|---|
| **Dot** | a plump circle (r≈70px at 1× scale), big expressive eyes, blush cheeks | coral `#FF5A4E` | warm, bright, US female |
| **Dash** | a rounded pill / capsule standing upright (≈90w × 170h), lanky, eager | cobalt `#2E4BFF` | friendly, slightly awkward, male |
| **Biscuit** | tiny dog: a golden rounded square with triangle ears, stub tail | gold `#FFC247` | "Woof!" |
| **Narrator** | — | — | warm British female, storybook tone |

Faces: two white oval eyes with ink pupils, a simple ink mouth whose openness is
driven by the dialogue amplitude envelope (lip-sync), optional blush.

## Style guide
- **Paper world.** Warm cream paper `#F6F0E6` with subtle grain; ink `#16161D`
  outlines (3–5 px, slightly wobbly "boiled" lines at 12 fps = hand-drawn feel).
- Bold flat colour, no gradients except soft glows / gold foil.
- Palette: paper `#F6F0E6`, paper-shade `#EADFCB`, ink `#16161D`, coral `#FF5A4E`,
  cobalt `#2E4BFF`, gold `#FFC247`, blush `#FFB3C1`, mint `#3DDC97`,
  lilac `#B8A4FF`, chaos-red `#FF2D55`, acid `#D7FF3A`.
- Type: **Fraunces** (display serif; 900 for slams, italic for storybook
  captions), **Inter** (UI), **Space Grotesk** (labels/tech), **Caveat** (handwriting).
- Motion: snappy anticipation → overshoot springs, squash & stretch on every
  landing, smear frames on fast moves, cuts on the beat. Tempo **120 BPM**:
  1 beat = 0.5 s, 1 bar = 2.0 s. Major events land on beats.
- Everything is deterministic: a pure function of time `t` (seconds).

## Timeline (seconds). Dialogue start times are targets; actual timing lives in `data/dialogue.json`.

### ACT 1 — MEET (0.0 – 6.0) · owner: scene A
- 0.00–0.90 black; two heartbeat thumps (0.25, 0.60). At 0.90 an iris opens to paper.
- 1.00 **Dot** drops from above into centre-left (x≈760, ground y≈760), lands 1.30 with squash (SFX `plip`), bounces, settles.
- 1.10–2.20 caption types top-left in Fraunces italic: *"Chapter One."* (typewriter ticks)
- 2.60 **Dash** zips in from the right with an ink speed-line (SFX `whoosh`), collides with Dot at **3.20** (SFX `boop`); both tumble / wobble.
- **3.55 DASH:** "Oh! Sorry."
- **4.55 DOT:** "…Hi."  Dot blushes; at 5.40 a small heart pops between them (SFX `pop`).
- End state 6.0: both standing, facing each other, Dot x≈820 Dash x≈1100, ground y≈760.

### ACT 2 — MONTAGE (6.0 – 14.0) · owner: scene A
Music groove drops at 6.0. Each bar (2 s) is a new "chapter" with a page-flip wipe
(SFX `pageflip` at 6.0, 8.0, 10.0, 12.0) and a chapter caption:
- 6.0 *"Chapter Two. The first date."* — two coffee cups clink (SFX `clink` 6.9), steam curls into a heart.
- 8.0 *"Chapter Three. Moving in."* — boxes stack on the beat (SFX `thud` ×3: 8.5, 9.0, 9.5), a plant pops up.
- 10.0 *"Chapter Four. Biscuit."* — Biscuit the dog bounces in (SFX `woof` 10.6), licks Dash.
- 12.0 *"Chapter Five. The question."* — Dash drops to "one knee" (tilts), ring box opens with a gold glint (SFX `ting` 12.55).
- **12.75 DASH:** "Marry me?"
- **13.45 DOT:** "YES!" → confetti cannon at 13.6 (SFX `confetti`).
- End state 13.99: confetti mid-air, Dot jumping, Dash kneeling.

### ACT 3 — THE PLANNING (14.0 – 16.0) · owner: scene B
- 14.00 record scratch (SFX `scratch`). Frame FREEZES (render 13.99 frozen), desaturates, confetti hangs in air.
- 14.30 title SLAMS in, heavy: **"Chapter Six. The Planning."** (SFX `slam` — ominous low hit).
- **14.90 DOT:** "Wait… we have to plan a wedding."
- 15.6 first notification ping lands on screen.

### ACT 4 — CHAOS (16.0 – 30.0) · owner: scene B
The couple get buried by wedding-planning chaos; the frame becomes a storm.
- Notifications, chat bubbles, spreadsheet tiles, calendar deadlines, invoices,
  sticky notes fly in, accelerating (SFX `ping` per item; density ramps up).
  Example content: "Mum: what about Uncle Gary??", "Venue: deposit due TODAY",
  "Budget_FINAL_v7_REAL.xlsx", "Florist: re: re: re: peonies", "Group chat (214 new)",
  "Seating_plan_HELP.pdf", "DJ or band???", "RSVP: Gary +3".
- A **tab counter** in a browser bar climbs 3 → 147.
- A seating chart becomes tangled spaghetti ink.
- **19.40 DASH:** "Who is Uncle Gary?!"
- **21.00 DOT:** "I don't KNOW a Gary!"
- **23.30 DASH:** "The florist says the peonies are… emotionally unavailable."
- **26.60 DOT (small, overwhelmed):** "I can't… do this."
- 27.5–29.7 ink scribble engulfs everything into a black tangled ball; camera shakes; riser. **29.80 HARD CUT to silence** (screen: the tangled ink ball, still).

### ACT 5 — THE TURN (30.0 – 32.5) · owner: scene C
- 30.00 near silence. A single golden thread / bookmark ribbon descends from the top (SFX `shimmer`).
- 30.20 the page turns (SFX `pageturn`, big and tactile).
- **30.50 NARRATOR:** "Every love story deserves a better chapter."

### ACT 6 — ORDER (32.5 – 46.0) · owner: scene C
The anthem kicks in at 32.0 (bar 16). The Wedding Chapter app appears — a
book that folds open into a phone. The tangled ink ball is pulled in and UNSPOOLS
into clean, perfectly straight lines that become tidy UI:
- Cards snap onto a grid on the beat (SFX `click` each, 34.0, 34.5, 35.0 … ):
  **Guests** · **Budget** · **Suppliers** · **Timeline** · **Seating** · **To-dos**.
  Each gets a green tick (SFX `tick`). Budget bar fills; RSVP counter counts up;
  the tangled seating chart re-lays itself into round tables.
- **36.50 DOT:** "Wait… it's all in one place?"
- 40.0 a card flips: *"Uncle Gary → Table 9 (next to the bar)"*.
- **40.60 DASH:** "Gary has a table!"
- 42.0–46.0 kinetic typography slams on the beat: **"PLAN IT."** (42.0) **"SHARE IT."** (43.0) **"SAVOUR IT."** (44.0), then the phone screen becomes a doorway (zoom-through at 45.5, SFX `whoosh`).

### ACT 7 — THE DAY (46.0 – 54.0) · owner: scene D
- 46.0 an ink line draws an aisle in perspective; flowers bloom along it in time with music (SFX `bloom` sparkles), an arch grows.
- Dot and Dash walk toward each other; Biscuit trots between them carrying the rings.
- **49.70 DOT:** "I do."  **50.50 DASH:** "I do."
- 51.2 they kiss → a giant heart shockwave, petals + fireworks (SFX `firework`s 51.3, 51.8).
- 52.0–54.0 camera pulls back: the scene is a page in a book. The pages FLIP BACKWARDS
  through every chapter (flipbook recap of earlier frames; SFX `flipbook` fast riffle).

### ACT 8 — THE LOGO (54.0 – 60.0) · owner: scene D
- 54.0 the book closes (SFX `bookclose` thump). Cover: **The Wedding Chapter** in gold foil
  with a shimmer sweep (SFX `shimmer`).
- **55.30 NARRATOR:** "The Wedding Chapter. Write the next one together." (target ≤ 3 s)
- 57.3 tagline under logo: *"Plan the day. Love the story."*  then small "Out now".
- 58.8 Biscuit pops up from behind the book: **"Woof!"** (SFX `woof`) — ear flop, button-end.
- 59.6–60.0 fade to black.

## Music cue sheet (120 BPM, bar = 2 s, 30 bars)
| Bars | Time | Mood |
|---|---|---|
| 0–2 | 0–6 | heartbeat, music-box/pizzicato motif (the "love theme"), sparse and curious; 1.0 intro bloom |
| 3–6 | 6–14 | playful groove drops at 6.0: plucky bass, claps, marimba, love theme, rising to proposal; 13.6 big hit |
| 7 | 14–16 | 14.0 record-scratch STOP; 14.3 ominous low brass/sub hit; tension drone |
| 8–14 | 16–30 | chaos: the love theme detuned, glitchy, tempo feels like it's accelerating (16ths → 32nds), dissonant stabs, alarm synths, rising; stops dead at 29.8 |
| 15 | 30–32 | silence → a single celesta/harp note + soft pad swell under the narrator |
| 16–22 | 32–46 | the anthem: love theme in full major, four-on-floor, warm bass, bright plucks, claps; 42/43/44 big hits for PLAN/SHARE/SAVOUR; riser into 46 |
| 23–26 | 46–54 | euphoric wedding: bells, strings-ish pad, choir-ish "ahh" pad, full drums; 51.2 climax hit; 52–54 riffle/tape-rewind feel |
| 27–29 | 54–60 | logo: final big warm chord at 54.0, gentle music-box reprise of the love theme, ends on a sweet resolved note ~59.5 |

Love theme (in C major, can transpose): `E5 G5 C6 B5 | A5 G5 E5 G5 | F5 A5 D6 C6 | B5 G5 C6 –` (eighth notes, the last held).

## SFX cue list (time → name)
0.25 heartbeat, 0.60 heartbeat, 1.10–2.20 typewriter ticks (≈10), 1.30 plip, 2.60 whoosh, 3.20 boop,
5.40 pop, 6.0 pageflip, 6.9 clink, 8.0 pageflip, 8.5/9.0/9.5 thud, 10.0 pageflip, 10.6 woof,
12.0 pageflip, 12.55 ting, 13.6 confetti, 14.0 scratch, 14.3 slam, 15.6 ping,
16.0–29.7 pings (see `data/sfx_pings.json` if present, otherwise density ramp from 2/s → 14/s), 
18.0/22.0/26.0 phone buzz, 27.5–29.8 scribble noise + riser, 29.8 cut,
30.0 shimmer, 30.2 pageturn, 34.0–39.5 click every 0.5 s, 34.25–39.75 tick every 0.5 s (quiet),
40.0 cardflip, 42.0/43.0/44.0 slam-hit (punchy, not ominous), 45.5 whoosh,
46.0–49.0 bloom sparkles (every 0.25 s), 51.3 firework, 51.8 firework, 52.0–54.0 flipbook riffle,
54.0 bookclose, 54.3 shimmer, 58.8 woof, 58.8 pop.

## File contract
- `film/engine.js` — shared renderer, helpers and characters (see header of the file).
- `film/scenes/a_meet.js`, `b_chaos.js`, `c_order.js`, `d_finale.js` — scene modules.
- `film/data/dialogue.json` — dialogue timing + lip-sync envelopes (written by the voice pass).
- `film/audio/stems/{music,sfx,dialogue}.wav` — 48 kHz stereo, exactly 60.000 s each.
- `film/audio/soundtrack.wav` / `film/soundtrack.m4a` — final mix.
- `film/index.html` — the playable film (canvas + audio); `film/render.mjs` — frame-exact MP4 render.
