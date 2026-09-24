# Voice notes: dialogue pass

**Engine:** Kokoro-82M v1.0 through `kokoro-onnx` 0.4.x (CPU). The model files live in `audio/.models/` (gitignored) and come from the kokoro-onnx GitHub release `model-files-v1.0`.
**Rebuild:** `python3 audio/build_dialogue.py`. It needs `kokoro-onnx soundfile numpy scipy pyworld` (and `setuptools<81` for pyworld). It writes `audio/lines/*.wav`, `audio/stems/dialogue.wav`, `data/dialogue.json` and `data/dialogue.js`.

## Casting
| Character | Voice | Lang | Pan | Why |
|---|---|---|---|---|
| Dot | `af_heart` | en-us | 22% left | Kokoro's best-rated voice. Warm and bright. |
| Dash | `am_fenrir` | en-us | 22% right | Auditioned against `am_puck` and `am_michael`. Fenrir had the most pitch movement (~4.5 st std vs ~2.6 st for puck), so it sounds the most "acted". It was also the only voice that fit the tight slots ("Marry me?", "I do.") without heavy speed-up. `am_puck` is the fallback. |
| Narrator | `bf_emma` | en-gb | centre | Warm British storybook voice. It rated above `bf_isabella`. Espeak's en-gb "one" (/wɒn/) is corrected to /wʌn/. |

## Performance direction (per line)
- Every line was rendered at 3 speeds (plus text variants during auditions). The script picks the take closest to a target length that fits before the next event.
- Ellipsis pauses are **edited in**. Each fragment is synthesised separately and joined with a set silence, because Kokoro mostly ignores "…":
  "Wait… | 0.38 s | we have to plan a wedding." · "the peonies are… | 0.38 s | emotionally unavailable." · "I can't… | 0.42 s | do this." · "Wait… | 0.30 s | it's all in one place?" · "The Wedding Chapter. | 0.22 s | Write the next one together."
- **Pitch** is changed with a WORLD vocoder (pyworld), which keeps formants. "YES!" +2 st (with heavy compression so it is dense and loud). "Who is Uncle Gary?!" +1 st. "I don't KNOW a Gary!" +0.7 st. "Gary has a table!" +0.8 st. "Oh! Sorry." +0.4 st. "Wait… one place?" +0.5 st. "…Hi.", "I can't… do this." and "Wait… plan a wedding." −0.3 to −0.5 st (smaller and darker).
- **"Marry me?"**: Kokoro renders it falling. The f0 contour of "me" was redrawn in WORLD to dip and then rise, so it reads as a nervous question.
- **Levels** (active-speech RMS dBFS): normal lines −20. Exclamations −18.5. "YES!" −15.5. Tender "I do." −22.5. Shy "…Hi." −25. Overwhelmed "I can't… do this." −25.5, with a slow speed (0.85) and 16% room reverb.

## Processing chain
Trim at −48 dB (15 ms pre-roll, 30 ms tail) → 24→48 kHz resample → 80 Hz 2nd-order high-pass → RMS compressor (3:1 default; 4–6:1 on shouted lines, 1.5–2:1 on soft ones) → 4 ms / 30 ms fades → loudness to the per-line target → look-ahead peak limiter with a −3.2 dBFS ceiling → constant-power pan.
The narrator gets 10% of a synthetic 0.45 s warm room reverb. The tail runs about 0.5 s past `end`.

## Final timing (s)
`end` is the end of the dry speech. Reverb tails extend past it on narr_*/dot_cant.

| id | speaker | text | start | end |
|---|---|---|---|---|
| dash_sorry | dash | Oh! Sorry. | 3.55 | 4.240 |
| dot_hi | dot | …Hi. | 4.55 | 5.156 |
| dash_marry | dash | Marry me? | 12.70 | 13.366 |
| dot_yes | dot | YES! | 13.45 | 13.893 |
| dot_plan | dot | Wait… we have to plan a wedding. | 14.90 | 17.110 |
| dash_gary | dash | Who is Uncle Gary?! | 19.40 | 20.386 |
| dot_knowgary | dot | I don't KNOW a Gary! | 21.00 | 22.064 |
| dash_peonies | dash | The florist says the peonies are… emotionally unavailable. | 23.30 | 26.394 |
| dot_cant | dot | I can't… do this. | 26.60 | 28.593 |
| narr_better | narrator | Every love story deserves a better chapter. | 30.50 | 33.053 |
| dot_oneplace | dot | Wait… it's all in one place? | 36.50 | 38.608 |
| dash_table | dash | Gary has a table! | 40.60 | 41.546 |
| dot_ido | dot | I do. | 49.70 | 50.355 |
| dash_ido | dash | I do. | 50.50 | 51.143 |
| narr_logo | narrator | The Wedding Chapter. Write the next one together. | 55.30 | 58.216 |

**Timing shift:** "Marry me?" moved **12.75 → 12.70** (−0.05 s). This leaves an 84 ms gap before "YES!" at 13.45. All other lines are at their spec times.
**Clearances:** "YES!" ends 13.89, before the 14.0 scratch. "Gary has a table!" ends 41.55, before the 42.0 slam. Dash's "I do." ends 51.14, before the 51.2 kiss. The narrator's logo line runs 2.92 s (target ≤ 3) and ends 58.22, before the 58.8 woof.

## Lip-sync data
`data/dialogue.json` / `dialogue.js` (`window.DIALOGUE`): `env[i]` is mouth openness at time `start + i/30`, for i = 0 … ceil((end−start)·30).
How it is computed:
1. 1/30 s RMS windows.
2. Attack/release smoothing (0.75 / 0.45 per frame).
3. Normalised per line to a peak of 1, then gamma 0.8.
4. A gate below 0.06, and the last frame is forced to 0.

Edited pauses read as 0 (mouth closed).
