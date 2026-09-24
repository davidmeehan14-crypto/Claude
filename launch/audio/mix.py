"""Final mix: music + sfx -> audio/soundtrack.wav + soundtrack.m4a (45 s, -14 LUFS, -1 dBTP-ish)."""
import os, subprocess, numpy as np, soundfile as sf, imageio_ffmpeg, pyloudnorm as pyln
from scipy.ndimage import maximum_filter1d
HERE = os.path.dirname(os.path.abspath(__file__)); SR = 48000; N = SR * 45
def load(n):
    p = os.path.join(HERE, 'stems', n)
    if not os.path.exists(p): print('missing', n); return np.zeros((N, 2))
    x, sr = sf.read(p, always_2d=True); assert sr == SR
    o = np.zeros((N, 2)); o[:min(N, len(x))] = x[:N]; return o
music, sfx = load('music.wav'), load('sfx.wav')
# duck music gently under dense SFX (keeps UI sounds crisp)
env = maximum_filter1d(np.abs(sfx).max(1), int(SR * .03)); env = np.convolve(env, np.ones(int(SR * .05)) / int(SR * .05), 'same')
gain = 10 ** (-3 * np.clip(env / .15, 0, 1) / 20)
mix = music * gain[:, None] * 0.9 + sfx * 0.8
lufs = pyln.Meter(SR).integrated_loudness(mix); mix *= 10 ** ((-14 - lufs) / 20); print('lufs', round(lufs, 2), '-> -14')
ceil = 10 ** (-1 / 20); need = np.minimum(1, ceil / np.maximum(maximum_filter1d(np.abs(mix).max(1), int(SR * .004) * 2 + 1), 1e-9))
gr = need.copy(); rel = np.exp(-1 / (SR * .08))
for i in range(1, N): gr[i] = min(need[i], rel * gr[i - 1] + (1 - rel))
mix *= gr[:, None]; mix[-int(SR * .01):] *= np.linspace(1, 0, int(SR * .01))[:, None]
out = os.path.join(HERE, 'soundtrack.wav'); sf.write(out, mix.astype(np.float32), SR, subtype='PCM_16')
subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(), '-y', '-loglevel', 'error', '-i', out, '-c:a', 'aac', '-b:a', '256k', os.path.join(HERE, '..', 'soundtrack.m4a')], check=True)
print('wrote soundtrack.wav + soundtrack.m4a, max GR dB', round(20 * np.log10(gr.min()), 2))
