"""Final mix: music (ducked under dialogue) + sfx + dialogue -> soundtrack.wav / soundtrack.m4a"""
import numpy as np, soundfile as sf, subprocess, os, imageio_ffmpeg
from scipy.signal import butter, sosfilt
HERE = os.path.dirname(os.path.abspath(__file__)); SR = 48000; N = SR * 60
def load(name):
    p = os.path.join(HERE, 'stems', name)
    if not os.path.exists(p): print('missing', name); return np.zeros((N, 2))
    x, sr = sf.read(p, always_2d=True); assert sr == SR, (name, sr)
    if x.shape[1] == 1: x = np.repeat(x, 2, 1)
    out = np.zeros((N, 2)); out[:min(N, len(x))] = x[:N]; return out
music, sfx, dia = load('music.wav'), load('sfx.wav'), load('dialogue.wav')
import json
# per-line dialogue lifts (quiet/shy lines need help over the bed)
LIFT = {'dot_hi': 4, 'dot_cant': 6, 'dot_ido': 3, 'dash_ido': 2, 'dot_oneplace': 3, 'dot_plan': 2, 'dash_peonies': 2}
for l in json.load(open(os.path.join(HERE, '..', 'data', 'dialogue.json'))):
    if l['id'] in LIFT:
        a, b = int(l['start'] * SR), min(N, int((l['end'] + .6) * SR))
        dia[a:b] *= 10 ** (LIFT[l['id']] / 20)
# 'I can't... do this': the world muffles around Dot (26.5-28.7) - lowpass music+sfx
def muffle(x, a, b, fc=700):
    a, b = int(a * SR), int(b * SR); lp = sosfilt(butter(2, fc, 'low', fs=SR, output='sos'), x, axis=0)
    w = np.zeros(N); r = int(.25 * SR); w[a:b] = 1; w[a:a + r] = np.linspace(0, 1, r); w[b - r:b] = np.linspace(1, 0, r)
    return x * (1 - w[:, None]) + lp * w[:, None] * 0.8
music = muffle(music, 26.3, 27.65); sfx = muffle(sfx, 26.3, 27.6)
# sidechain: envelope of dialogue (smoothed), duck music up to -7 dB, and mids more than lows
env = np.abs(dia).max(1)
win = int(SR * .02); env = np.convolve(env, np.ones(win) / win, 'same')
# attack 30 ms / release 350 ms one-pole on a decimated envelope
dec = 48; e = env[::dec]; g = np.zeros_like(e); a_att = np.exp(-1 / (SR / dec * .03)); a_rel = np.exp(-1 / (SR / dec * .35)); s = 0
for i, v in enumerate(e):
    s = a_att * s + (1 - a_att) * v if v > s else a_rel * s + (1 - a_rel) * v; g[i] = s
g = np.interp(np.arange(N), np.arange(len(g)) * dec, g)
duck_db = -10 * np.clip(g / 0.04, 0, 1)
gain = 10 ** (duck_db / 20)[:, None]
lows = sosfilt(butter(2, 250, 'low', fs=SR, output='sos'), music, axis=0)
music_d = lows * (0.5 + 0.5 * gain) + (music - lows) * gain
sfx_d = sfx * (0.55 + 0.45 * gain)
mix = music_d * 0.85 + sfx_d * 0.85 + dia * 1.35
# gentle bus glue + soft clip
peak = np.abs(mix).max(); print('pre peak', peak)
mix = np.tanh(mix * 1.1) / np.tanh(1.1) if peak > 0.9 else mix
mix[-int(SR * .02):] *= np.linspace(1, 0, int(SR * .02))[:, None]
import pyloudnorm as pyln
lufs = pyln.Meter(SR).integrated_loudness(mix); mix = mix * 10 ** ((-14 - lufs) / 20); print('lufs', lufs, '-> -14')
# lookahead peak limiter at -1 dBFS
ceil = 10 ** (-1 / 20); pk = np.abs(mix).max(1); la = int(SR * .004)
from scipy.ndimage import maximum_filter1d
need = np.minimum(1, ceil / np.maximum(maximum_filter1d(pk, la * 2 + 1), 1e-9))
gr = np.copy(need); rel = np.exp(-1 / (SR * .08))
for i in range(1, N): gr[i] = min(need[i], rel * gr[i - 1] + (1 - rel))
mix = mix * gr[:, None]; print('limiter max GR dB', 20 * np.log10(gr.min()))
ff = imageio_ffmpeg.get_ffmpeg_exe(); out = os.path.join(HERE, 'soundtrack.wav')
sf.write(out, mix.astype(np.float32), SR, subtype='PCM_16')
subprocess.run([ff, '-y', '-loglevel', 'error', '-i', out, '-t', '60', '-c:a', 'aac', '-b:a', '256k', os.path.join(HERE, '..', 'soundtrack.m4a')], check=True)
print('wrote soundtrack.wav + soundtrack.m4a')
