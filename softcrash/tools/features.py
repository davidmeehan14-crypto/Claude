# Per-frame (30 fps) audio features for the visuals: kick, snare, loudness, air, sub presence.
import numpy as np, soundfile as sf, scipy.signal as ss, json
x, sr = sf.read('audio/stereo22k.wav'); M = x.mean(1)
FPS = 30; dur = len(M) / sr; N = int(np.ceil(dur * FPS))
hop = 256; n = 1024
f, t, Z = ss.stft(M, sr, nperseg=n, noverlap=n - hop, boundary=None); Z = np.abs(Z)
def band(lo, hi): return (Z[(f >= lo) & (f < hi)] ** 2).sum(0)
def onset(e):
    l = np.log1p(e / (np.percentile(e, 90) + 1e-12) * 50); d = np.maximum(0, np.diff(l, prepend=l[0]))
    return d
def to_frames(v, mode='max'):
    out = np.zeros(N)
    idx = np.clip((t * FPS).astype(int), 0, N - 1)
    if mode == 'max': np.maximum.at(out, idx, v)
    else:
        c = np.bincount(idx, minlength=N); s = np.bincount(idx, weights=v, minlength=N); out = s / np.maximum(c, 1)
    return out
def decay(v, tau):
    out = np.zeros_like(v); a = np.exp(-1 / (tau * FPS)); acc = 0
    for i, s in enumerate(v): acc = max(s, acc * a); out[i] = acc
    return out
def norm(v, p=98): return np.clip(v / (np.percentile(v, p) + 1e-12), 0, 1.5)
kick = decay(norm(to_frames(onset(band(30, 140)))), 0.18)
snare = decay(norm(to_frames(onset(band(1500, 6000)))), 0.14)
rms = to_frames(np.sqrt((Z ** 2).mean(0)), 'mean'); rms = 20 * np.log10(rms + 1e-9)
rms = ss.savgol_filter(rms, 15, 2); rms = np.clip((rms - np.percentile(rms, 5)) / (np.percentile(rms, 99) - np.percentile(rms, 5)), 0, 1)
air = to_frames(band(7000, 11000), 'mean'); air = 10 * np.log10(air + 1e-12); air = ss.savgol_filter(air, 9, 2)
air = np.clip((air - np.percentile(air, 5)) / (np.percentile(air, 99) - np.percentile(air, 5)), 0, 1)
sub = to_frames(band(25, 90), 'mean'); sub = 10 * np.log10(sub + 1e-12); sub = ss.savgol_filter(sub, 31, 2)
sub = np.clip((sub - np.percentile(sub, 10)) / (np.percentile(sub, 95) - np.percentile(sub, 10)), 0, 1)
r3 = lambda a: [round(float(v), 3) for v in a]
json.dump({'fps': FPS, 'n': N, 'dur': dur, 'kick': r3(kick), 'snare': r3(snare), 'rms': r3(rms), 'air': r3(air), 'sub': r3(sub)},
          open('data/features.json', 'w'), separators=(',', ':'))
open('data/features.js', 'w').write('window.FEAT=' + open('data/features.json').read() + ';')
print(N, dur, kick.mean(), snare.mean(), rms.mean())
