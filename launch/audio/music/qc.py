#!/usr/bin/env python3
"""Analytical QC for the music stem: format, peaks, DC, loudness, dynamic
shape, silence gaps, click detection, stereo balance, onset grid, spectrograms.
Usage: python3 qc.py [wav] [png_out_dir]"""
import os
import sys
import numpy as np
import soundfile as sf
from scipy import signal

HERE = os.path.dirname(os.path.abspath(__file__))
wav = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', 'stems', 'music.wav')
outdir = sys.argv[2] if len(sys.argv) > 2 else None

x, sr = sf.read(wav, always_2d=True)
print(f'file: {wav}\n  sr={sr} ch={x.shape[1]} samples={len(x)} dur={len(x)/sr:.4f}s')
pk = np.abs(x).max()
print(f'  peak {20*np.log10(pk):.2f} dBFS | DC L {x[:,0].mean():+.2e} R {x[:,1].mean():+.2e}')
try:
    import pyloudnorm as pyln
    print(f'  integrated loudness {pyln.Meter(sr).integrated_loudness(x):.2f} LUFS')
except Exception:
    pass
rl, rr = np.sqrt((x ** 2).mean(0))
print(f'  L/R RMS balance {20*np.log10(rl/rr):+.2f} dB, corr {np.corrcoef(x[:,0], x[:,1])[0,1]:.2f}')

# dynamic shape (0.5 s windows)
w = sr // 2
rms = [20 * np.log10(np.sqrt((x[i:i + w] ** 2).mean()) + 1e-9) for i in range(0, len(x), w)]
print('RMS per 0.5 s (dBFS):')
for r0 in range(0, 90, 12):
    print(f'  {r0*0.5:5.1f}s ' + ' '.join(f'{v:6.1f}' for v in rms[r0:r0 + 12]))


def seg_rms(a, b):
    s = x[int(a * sr):int(b * sr)]
    return 20 * np.log10(np.sqrt((s ** 2).mean()) + 1e-12)


print('Section RMS:')
for a, b, lab in ((0, 3, 'intro'), (3, 9, 'light beat'), (9, 13, 'fuller'), (13, 14.875, 'break'),
                  (14.88, 14.99, 'pre-drop breath'), (15, 16, 'DROP'), (16, 25, 'groove'), (25, 29, 'variation'),
                  (29, 37.5, 'full'), (37.505, 37.995, 'SILENT gap'), (38, 41, 'minimal'), (41, 42, 'final hit'),
                  (42, 44.5, 'outro'), (44.5, 44.9, 'fade'), (44.9, 45, 'end silence')):
    print(f'  {lab:16s} {a:6.2f}-{b:6.2f}  {seg_rms(a, b):7.1f} dBFS')
print('  max |x| in 37.5-38.0:', np.abs(x[int(37.5*sr):int(38.0*sr)]).max(), ' in 44.9-45:', np.abs(x[int(44.9*sr):]).max())

# clicks: sample-to-sample jumps far above what the local HF content predicts
hp = signal.sosfilt(signal.butter(4, 12000, 'high', fs=sr, output='sos'), x, axis=0)
d = np.abs(hp).max(1)
env = np.sqrt(signal.convolve(d ** 2, np.ones(2400) / 2400, mode='same')) + 1e-5
ratio = d / env
cand = np.where((ratio > 12) & (d > 0.02))[0]
groups = []
for c in cand:
    if not groups or c - groups[-1][-1] > sr * 0.02:
        groups.append([c])
    else:
        groups[-1].append(c)
print(f'possible clicks: {len(groups)}', [round(g[0] / sr, 3) for g in groups[:30]])

# onsets near key hit points
mono = x.mean(1)
f, t, Z = signal.stft(mono, sr, nperseg=1024, noverlap=768)
mag = np.abs(Z)
flux = np.maximum(np.diff(mag, axis=1), 0).sum(0)
tf = t[1:]
for hp_t in (3.0, 4.5, 9.0, 11.0, 13.0, 14.0, 15.0, 17.0, 21.0, 25.0, 27.0, 29.0, 33.0, 37.0, 38.0, 39.5, 41.0, 43.0):
    msk = (tf > hp_t - 0.08) & (tf < hp_t + 0.08)
    i = np.argmax(flux[msk])
    print(f'  hit {hp_t:5.2f}s -> flux peak at {tf[msk][i]:.3f}s (strength {flux[msk][i]/np.median(flux):.1f}x median)')

if outdir:
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    os.makedirs(outdir, exist_ok=True)
    for a, b in ((0, 10), (8, 18), (16, 30), (28, 38.5), (36, 45), (0, 45)):
        s = mono[int(a * sr):int(b * sr)]
        fig, ax = plt.subplots(2, 1, figsize=(16, 7), gridspec_kw={'height_ratios': [3, 1]})
        ax[0].specgram(s, NFFT=2048, Fs=sr, noverlap=1536, cmap='magma', vmin=-130, xextent=(a, b))
        ax[0].set_yscale('symlog', linthresh=200)
        ax[0].set_ylim(30, 20000)
        tt = np.arange(len(s)) / sr + a
        ax[1].plot(tt[::50], x[int(a * sr):int(b * sr):50, 0], lw=0.3)
        ax[1].plot(tt[::50], x[int(a * sr):int(b * sr):50, 1], lw=0.3, alpha=0.6)
        ax[1].set_xlim(a, b)
        for axx in ax:
            axx.set_xticks(np.arange(np.ceil(a * 2) / 2, b + 0.01, 0.5 if b - a < 20 else 2), minor=False)
            axx.grid(alpha=0.3)
        ax[0].set_title(f'music {a}-{b}s')
        fig.tight_layout()
        fig.savefig(os.path.join(outdir, f'spec_{a:04.1f}_{b:04.1f}.png'), dpi=70)
        plt.close(fig)
    print('spectrograms ->', outdir)
