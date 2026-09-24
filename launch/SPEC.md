# The Wedding Chapter — product launch film ("Your next chapter")

45.000 s · 1920×1080 · 30 fps · 120 BPM (beat = 0.5 s, bar = 2 s) · music + sound design, **no voiceover**.

Reference: a premium mobile-app launch ad (Apple-style SaaS spot). Its grammar, which we recreate from scratch for
The Wedding Chapter: airy white/pastel worlds, soft gradient "cloud" bands, kinetic typography that types on with a
caret while little line-icons pop around the words, glossy 3D objects orbiting a floating phone, a ring of UI cards
orbiting a line of text, a split-letter word with typographic guide lines, product UI demos with a cursor, an
invitation QR scan, floating question bubbles around a phone, "Plan it. / Love it." type beat, and a logo reveal in
soft clouds. Everything cuts or moves ON the beat.

## Brand
- Logo: `assets/logo.js` → `window.LOGO` (script "The Wedding" + spaced "CHAPTER" + gold underline). Never redraw it.
- Palette: white `#FFFFFF`, cream `#FBF7F2`, plum ink `#2A1B3D` (type), soft plum `#6B5A7E` (secondary),
  gold `#B88A3E` / light gold `#E6C27A`, rose `#E07A93`, blush `#F6C9D0`, champagne `#F3DDB8`, lilac `#D9CCF5`,
  peach `#FAD7C3`, sage `#BFD8C2`.
- Type: **Plus Jakarta Sans** (400–800) for all kinetic type & UI; **Fraunces italic** for accent words;
  **Montserrat 500** letter-spaced for small caps labels.
- Feel: premium, light, joyful, calm confidence. Motion: fast ease-out (expo/quart) entrances, gentle drifts,
  springy pops for icons, whip/zoom transitions with motion blur.

## Timeline
| # | Time | Scene | Owner |
|---|---|---|---|
| 1 | 0.0–3.0 | **Hero**: floating phone (lock screen "Saturday 14 June · 9:41", notification "The Wedding Chapter · 142 days to go ✨"), glossy 3D wedding objects pop in around it on the beats with thin orbit rings; the logo large and pale behind. 2.5–3.0 push-through to white. | A |
| 2 | 3.0–9.0 | **Type A**: "Every love story" (3.0) → "starts with a yes." (4.5, ring icon pops on "yes") → line-icons swarm → "Then comes" (6.5) → "the planning." (7.25), icons orbit, letters jitter; 8.5 icons sucked in, whoosh. | A |
| 3 | 9.0–13.0 | **Card orbit**: a ring of UI cards (guest list, budget, venue, mood board, seating, RSVP, supplier chat, invitation, timeline…) orbits the centre text: "Guests." "Budget." "Suppliers." "Seating." (one per beat 9.0–10.5) → "…all in one place." (11.0); 12.5 cards collapse in. | A |
| 4 | 13.0–15.0 | **Split word**: "Effortless." with typographic guide lines + handles; letters pulled apart (13.0) then snap together (14.0); 14.5 collapses into a gold ring glyph. | B |
| 5 | 15.0–16.0 | **Brand beat**: the gold ring expands, revealing a golden-hour gradient world; logo flashes on; into the demo. | B |
| 6 | 16.0–22.0 | **Phone demo**: home ("Sophie & James", 142 days countdown, 68% ring) → cursor taps the planner search, types "Find a florist in Bath under £1,500" → results cards slide in → "Book a call ✓" → swipe to Budget (bars animate "£18,400 of £24,000"). | B |
| 7 | 22.0–25.0 | **Landscape seating**: phone rotates to landscape; guest chips dragged onto round tables; "Uncle Gary → Table 9" pops. | B |
| 8 | 25.0–29.0 | **Type B**: "Whatever you're planning," (25.0) → "we'll guide you" (26.5) → "A new ◯ chapter." (27.5) with a glossy 3D object morphing between words. | C |
| 9 | 29.0–33.0 | **Invitation scan**: letterpress invitation ("Sophie & James", date, QR); 29.5 scanner corners snap, scan line; 30.5 pull back to a phone showing RSVP "You're invited!" → "Attending ✓"; 32.0 RSVP counter 87 → 88. | C |
| 10 | 33.0–38.0 | **Question bubbles**: phone (checklist/timeline scrolling) with glass question bubbles floating around: "Who still needs to RSVP?", "How much is left for flowers?", "When's the cake tasting?", "Where's Gary sitting?", plus 3D objects; 37.5 blur-zoom out. | C |
| 11 | 38.0–41.0 | **Type C**: "Plan it." (38.0) → "Love it." (39.5), caret typing; 40.75 whoosh. | D |
| 12 | 41.0–45.0 | **Logo**: soft champagne sky with clouds + sun glow; the real logo writes on (41.3–42.8); tagline "Plan the day. Love the story." (43.0); "Available now" (43.6); fade to white 44.6–45.0. | D |

## Music (one agent) — 120 BPM, bright modern pop/electronic
0–3 airy intro swell + pluck arp + riser into 3.0 · 3.0 light beat in (claps, shaker, sub) under Type A ·
9.0 fuller (chords, bass groove) · 13.0 break/stutter lift · 15.0 DROP (full) · 16–25 groove · 25 variation ·
29 full · 37.5–38.0 stop (half-bar gap) · 38–41 minimal (plucks + claps under the type) · 41.0 final hit + airy outro
resolving by ~44.5, silence at 45.0.

## Sound design (one agent) — library + placement
Scene animators write their SFX cues as JSON to `data/cues/<scene>.json`: `[{"t": 3.02, "sfx": "type", "gain": 1, "pan": 0}]`.
Available sfx names (the SFX agent builds these): `whoosh`, `whoosh_short`, `swish` (card fly), `pop`, `pop_soft`,
`type` (single key tick), `caret`, `tap` (UI tap), `click`, `toggle`, `success` (chime), `notify` (phone notification),
`scan` (scanner beep + sweep), `shutter`, `drag` (pick-up), `drop` (put-down plop), `bubble`, `sparkle`, `riser`,
`impact_soft`, `glass_ting`, `paper` (card slide), `swipe`, `logo_shimmer`, `bass_drop`.
`audio/place_sfx.py` reads all cue files → `audio/stems/sfx.wav`. `audio/mix.py` → `soundtrack.wav/.m4a`.
