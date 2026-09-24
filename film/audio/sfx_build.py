#!/usr/bin/env python3
"""
SFX layer for "Chapters" — The Wedding Chapter launch film.

Every sound is synthesised from scratch (numpy/scipy). Deterministic: all
randomness is seeded. Run:   python3 film/audio/sfx_build.py

Outputs
  film/audio/stems/sfx.wav      48 kHz stereo float->PCM24, exactly 60.000 s
  film/audio/sfx/*.wav          individual one-shots (for reference / reuse)
  film/data/sfx_pings.json      notification ping times (s) for 15.6–29.7
  film/audio/qc/*.png           spectrogram QC (written with --qc)

Conventions
  every generator returns (stereo float32 array [N,2], anchor_samples)
  "anchor" = the sample that must land exactly on the cue time (the impact /
  attack). Sounds with a pre-roll (reverse suck, air compression) have
  anchor > 0; everything else anchors at 0.
"""
import json
import os
import sys

import numpy as np
from scipy import signal
import soundfile as sf

try:  # optional JIT for the time-varying filters; pure-python fallback works
    from numba import njit
except Exception:  # pragma: no cover
    def njit(*a, **k):
        if a and callable(a[0]):
            return a[0]
        return lambda f: f

SR = 48000
DUR = 60.0
NTOT = int(round(SR * DUR))  # 2,880,000

HERE = os.path.dirname(os.path.abspath(__file__))
FILM = os.path.dirname(HERE)
SFX_DIR = os.path.join(HERE, "sfx")
STEM_DIR = os.path.join(HERE, "stems")
QC_DIR = os.path.join(HERE, "qc")
DATA_DIR = os.path.join(FILM, "data")

# ----------------------------------------------------------------------------
# DSP helpers
# ----------------------------------------------------------------------------


def rng(seed):
    return np.random.default_rng(seed)


def tt(dur):
    return np.arange(int(round(dur * SR))) / SR


def db(x):
    return 10 ** (x / 20.0)


def sos_filter(x, kind, f, order=2):
    nyq = SR / 2
    if kind == "band":
        lo, hi = f
        lo = max(lo, 10) / nyq
        hi = min(hi, nyq * 0.95) / nyq
        sos = signal.butter(order, [lo, hi], btype="band", output="sos")
    else:
        sos = signal.butter(order, min(f, nyq * 0.95) / nyq, btype=kind, output="sos")
    return signal.sosfilt(sos, x, axis=0)


def lp(x, f, order=2):
    return sos_filter(x, "low", f, order)


def hp(x, f, order=2):
    return sos_filter(x, "high", f, order)


def bp(x, lo, hi, order=2):
    return sos_filter(x, "band", (lo, hi), order)


def peak_eq(x, f0, gain_db, q=1.0):
    """RBJ peaking EQ."""
    A = 10 ** (gain_db / 40)
    w0 = 2 * np.pi * f0 / SR
    al = np.sin(w0) / (2 * q)
    b = np.array([1 + al * A, -2 * np.cos(w0), 1 - al * A])
    a = np.array([1 + al / A, -2 * np.cos(w0), 1 - al / A])
    return signal.lfilter(b / a[0], a / a[0], x, axis=0)


@njit(cache=True)
def _svf(x, fc, q, mode):
    # TPT state-variable filter with per-sample cutoff. mode 0=LP 1=BP 2=HP
    n = x.shape[0]
    y = np.zeros(n)
    ic1 = 0.0
    ic2 = 0.0
    for i in range(n):
        g = np.tan(np.pi * min(fc[i], 0.45 * 48000.0) / 48000.0)
        k = 1.0 / q[i]
        a1 = 1.0 / (1.0 + g * (g + k))
        a2 = g * a1
        a3 = g * a2
        v3 = x[i] - ic2
        v1 = a1 * ic1 + a2 * v3
        v2 = ic2 + a2 * ic1 + a3 * v3
        ic1 = 2.0 * v1 - ic1
        ic2 = 2.0 * v2 - ic2
        if mode == 0:
            y[i] = v2
        elif mode == 1:
            y[i] = v1 * k  # unity-peak band-pass
        else:
            y[i] = x[i] - k * v1 - v2
    return y


def svf(x, fc, q=0.707, mode="bp"):
    fc = np.broadcast_to(np.asarray(fc, dtype=np.float64), x.shape).copy()
    q = np.broadcast_to(np.asarray(q, dtype=np.float64), x.shape).copy()
    m = {"lp": 0, "bp": 1, "hp": 2}[mode]
    return _svf(np.ascontiguousarray(x, dtype=np.float64), fc, q, m)


def env_exp(n, tau_s, attack_s=0.001):
    t = np.arange(n) / SR
    a = np.clip(t / max(attack_s, 1e-5), 0, 1)
    a = np.sin(a * np.pi / 2) ** 2
    return a * np.exp(-t / tau_s)


def env_ar(n, attack_s, release_s, curve=2.0):
    """Attack (raised-cos) then power-curve release to zero at the end."""
    t = np.arange(n) / SR
    na = max(1, int(attack_s * SR))
    e = np.ones(n)
    e[:na] = np.sin(np.linspace(0, np.pi / 2, na)) ** 2
    rel = np.clip((t - attack_s) / max(release_s, 1e-5), 0, 1)
    e *= (1 - rel) ** curve
    return e


def fade(x, fin_s=0.0005, fout_s=0.01):
    x = x.copy()
    n = x.shape[0]
    a = min(n, max(1, int(fin_s * SR)))
    b = min(n, max(1, int(fout_s * SR)))
    ramp_in = np.sin(np.linspace(0, np.pi / 2, a)) ** 2
    ramp_out = np.cos(np.linspace(0, np.pi / 2, b)) ** 2
    if x.ndim == 2:
        ramp_in = ramp_in[:, None]
        ramp_out = ramp_out[:, None]
    x[:a] *= ramp_in
    x[n - b:] *= ramp_out
    return x


def pad(x, n):
    if x.shape[0] >= n:
        return x[:n]
    shape = (n - x.shape[0],) + x.shape[1:]
    return np.concatenate([x, np.zeros(shape)])


def mix(*parts):
    n = max(p.shape[0] for p in parts)
    out = np.zeros((n,) + parts[0].shape[1:])
    for p in parts:
        out[: p.shape[0]] += p
    return out


def at(x, offset_s, total_n=None):
    """Delay mono/stereo x by offset seconds."""
    k = int(round(offset_s * SR))
    shape = (k,) + x.shape[1:]
    y = np.concatenate([np.zeros(shape), x])
    return pad(y, total_n) if total_n else y


def pan(mono, p):
    """Constant-power pan. p in [-1 (L), +1 (R)], scalar or per-sample."""
    p = np.clip(np.asarray(p, dtype=np.float64), -1, 1)
    th = (p + 1) * np.pi / 4
    return np.stack([mono * np.cos(th), mono * np.sin(th)], axis=1)


def widen(mono, amount=0.3, seed=0, cutoff=900):
    """Pseudo-stereo: complementary decorrelation of the highs only."""
    r = rng(seed)
    d = int(SR * (0.004 + 0.006 * r.random()))
    hi = hp(mono, cutoff)
    lo = mono - hi
    hd = np.concatenate([np.zeros(d), hi])[: len(hi)]
    L = lo + hi + amount * hd
    R = lo + hi - amount * hd
    return np.stack([L, R], axis=1) * 0.7071


def normalize(x, peak_db=0.0):
    m = np.max(np.abs(x))
    return x * (db(peak_db) / m) if m > 0 else x


def sine_sweep(f, dur_s=None, phase0=0.0):
    """f may be array (per-sample Hz)."""
    return np.sin(phase0 + 2 * np.pi * np.cumsum(f) / SR)


def noise(n, seed):
    return rng(seed).standard_normal(n)


def pink(n, seed):
    w = rng(seed).standard_normal(n)
    # Paul Kellet economy pink filter
    b = [0.049922035, -0.095993537, 0.050612699, -0.004408786]
    a = [1, -2.494956002, 2.017265875, -0.522189400]
    return signal.lfilter(b, a, w) * 8


def modal(freqs, amps, decays, dur, seed=0, detune=0.0, phase_rand=True):
    """Bank of exponentially decaying sines (struck object)."""
    t = tt(dur)
    r = rng(seed)
    out = np.zeros_like(t)
    for f, a, d in zip(freqs, amps, decays):
        f = f * (1 + detune * (r.random() - 0.5))
        ph = r.random() * 2 * np.pi if phase_rand else 0.0
        if f >= SR * 0.45:
            continue
        out += a * np.sin(2 * np.pi * f * t + ph) * np.exp(-t / d)
    return out


_IR_CACHE = {}


def make_ir(decay_s=0.6, predelay_s=0.008, bright=6000, seed=7, early=True):
    key = (decay_s, predelay_s, bright, seed, early)
    if key in _IR_CACHE:
        return _IR_CACHE[key]
    n = int(SR * (decay_s * 1.6 + predelay_s))
    t = np.arange(n) / SR
    r = rng(seed)
    irs = []
    for ch in range(2):
        nz = r.standard_normal(n)
        # frequency dependent decay: highs die faster
        hi = hp(nz, 2500) * np.exp(-t / (decay_s * 0.18))
        mid = bp(nz, 300, 2500) * np.exp(-t / (decay_s * 0.30))
        lo = lp(nz, 300) * np.exp(-t / (decay_s * 0.36))
        ir = lp(hi * 0.8 + mid + lo * 0.8, bright)
        # onset ramp so the tail blooms rather than clicks
        ir *= np.clip(t / 0.004, 0, 1)
        if early:
            for k in range(6):
                pos = int(SR * (0.002 + r.random() * 0.02))
                if pos < n:
                    ir[pos] += (0.5 - 0.06 * k) * (1 if r.random() > 0.5 else -1) * 3
        pdl = int(predelay_s * SR)
        ir = np.concatenate([np.zeros(pdl), ir])[:n]
        irs.append(ir)
    ir = np.stack(irs, 1)
    ir /= np.sqrt(np.sum(ir ** 2) / 2)
    _IR_CACHE[key] = ir
    return ir


def reverb(st, wet=0.2, decay_s=0.6, predelay_s=0.008, bright=6000, seed=7):
    """st: stereo [N,2] (or mono). Returns dry + wet with a tail appended."""
    if st.ndim == 1:
        st = np.stack([st, st], 1) * 0.7071
    st = tail_window(st)
    ir = make_ir(decay_s, predelay_s, bright, seed)
    mono_in = st.mean(axis=1)
    wetL = signal.fftconvolve(mono_in * 0.5 + st[:, 0] * 0.5, ir[:, 0])
    wetR = signal.fftconvolve(mono_in * 0.5 + st[:, 1] * 0.5, ir[:, 1])
    w = np.stack([wetL, wetR], 1)
    out = pad(st, w.shape[0]) + wet * w
    return trim_tail(out)


def tail_window(x, frac=0.2, max_s=0.12):
    """Half-cosine fade over the last part of a generated buffer so sounds whose
    generator length is shorter than their natural ring never truncate."""
    n = x.shape[0]
    k = max(2, min(int(n * frac), int(max_s * SR)))
    w = np.cos(np.linspace(0, np.pi / 2, k)) ** 2
    x = x.copy()
    x[n - k:] *= w[:, None] if x.ndim == 2 else w
    return x


def trim_tail(x, thresh_db=-96):
    a = np.abs(x) if x.ndim == 1 else np.max(np.abs(x), axis=1)
    m = a.max()
    if m == 0:
        return x
    idx = np.nonzero(a > m * db(thresh_db))[0]
    end = min(x.shape[0], idx[-1] + int(0.01 * SR)) if len(idx) else x.shape[0]
    return fade(x[:end], 0.0, 0.01)


def finish(st, anchor=0, peak_db=-1.0, fin=0.0003):
    """Standard tail: DC-block, fade, trim, normalise."""
    if st.ndim == 1:
        st = np.stack([st, st], 1) * 0.7071
    st = tail_window(st, 0.1, 0.05)
    st = hp(st, 18, order=2)  # DC / subsonic removal
    st = trim_tail(st)
    st = fade(st, fin, 0.012)
    return normalize(st, peak_db).astype(np.float64), anchor


def soft_sat(x, drive=1.5):
    return np.tanh(x * drive) / np.tanh(drive)


# ----------------------------------------------------------------------------
# Sound generators
# ----------------------------------------------------------------------------


def s_heartbeat(seed=1):
    """Felt 'lub-dub': pitched sub thumps + chest-muffled knock."""
    def beat(f0, f1, tau, amp, s):
        n = int(0.6 * SR)
        t = np.arange(n) / SR
        f = f1 + (f0 - f1) * np.exp(-t / 0.03)
        body = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(n, tau, 0.004)
        # harmonics for small speakers (felt + heard)
        body = soft_sat(body * 1.0, 2.2)
        knock = lp(noise(n, s), 260, 4) * env_exp(n, 0.018, 0.002) * 2.2
        return amp * (body + knock)

    lub = beat(78, 46, 0.085, 1.0, seed)
    dub = beat(92, 56, 0.06, 0.72, seed + 1)
    x = mix(lub, at(dub, 0.165))
    x = lp(x, 900, 2)
    x = peak_eq(x, 110, 4, 1.0)
    st = reverb(np.stack([x, x], 1) * 0.707, wet=0.08, decay_s=0.5, bright=1500)
    return finish(st, fin=0.002)


def s_typewriter(seed=0):
    r = rng(seed)
    n = int(0.09 * SR)
    t = np.arange(n) / SR
    click = hp(noise(n, seed), 2500, 2) * env_exp(n, 0.0018, 0.0002)
    typebar = modal([2100 * (1 + 0.05 * r.standard_normal()), 3420, 5150],
                    [0.5, 0.35, 0.25], [0.012, 0.008, 0.005], 0.09, seed)
    thump = np.sin(2 * np.pi * 190 * t) * env_exp(n, 0.012, 0.001) * 0.6
    platen = bp(noise(n, seed + 3), 400, 1500) * env_exp(n, 0.006, 0.0005) * 0.8
    x = click * 1.2 + typebar + thump + platen
    st = pan(x, 0.25 * (r.random() - 0.5))
    st = reverb(st, wet=0.12, decay_s=0.35, bright=7000)
    return finish(st)


def s_plip(seed=0):
    """Cartoon ink-drop landing: tick + pitch-dropping 'bloop' + tiny thump."""
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    f = 380 + 1250 * np.exp(-t / 0.028)
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(n, 0.05, 0.0015)
    tone += 0.25 * np.sin(2 * np.pi * np.cumsum(2 * f) / SR) * env_exp(n, 0.02, 0.001)
    tick = hp(noise(n, seed), 3000) * env_exp(n, 0.0015, 0.0002) * 0.5
    thump = np.sin(2 * np.pi * np.cumsum(140 * np.exp(-t / 0.05) + 60) / SR) * env_exp(n, 0.04, 0.002) * 0.45
    # little secondary droplet splash
    f2 = 900 + 900 * np.exp(-t / 0.015)
    sec = np.sin(2 * np.pi * np.cumsum(f2) / SR) * env_exp(n, 0.02, 0.001) * 0.2
    x = tone + tick + thump + at(sec, 0.075, n)
    st = pan(x, -0.25)
    st = reverb(st, wet=0.18, decay_s=0.5)
    return finish(st)


def s_whoosh(seed=0, dur=0.62, pan_from=0.9, pan_to=-0.9, f_lo=350, f_hi=2600,
             peak_at=0.55, tonal=True):
    """Filtered noise sweep with moving pan + doppler-ish tonal edge."""
    n = int(dur * SR)
    u = np.linspace(0, 1, n)
    # swell shape peaking at peak_at
    e = np.where(u < peak_at, (u / peak_at) ** 2.2, np.exp(-(u - peak_at) / 0.12))
    e = e * (1 - np.clip((u - 0.93) / 0.07, 0, 1))
    fc = f_lo + (f_hi - f_lo) * np.where(u < peak_at, (u / peak_at) ** 1.5,
                                         np.exp(-(u - peak_at) / 0.2))
    nz = pink(n, seed)
    a = svf(nz, fc, 1.4, "bp")
    b = svf(noise(n, seed + 1), fc * 2.2, 2.5, "bp") * 0.35  # airy top
    c = svf(nz, fc * 0.45, 0.9, "lp") * 0.5                 # body
    x = (a + b + c) * e
    if tonal:
        # doppler whistle: speed-line 'zip'
        fz = 900 + 700 * np.tanh((u - peak_at) * -8)
        z = np.sin(2 * np.pi * np.cumsum(fz) / SR) * e ** 2 * 0.08
        x += z
    p = pan_from + (pan_to - pan_from) * (0.5 - 0.5 * np.cos(np.pi * u))
    st = pan(x, p)
    st = reverb(st, wet=0.12, decay_s=0.45)
    return finish(st, fin=0.005)


def s_boop(seed=0):
    """Soft rubbery bonk with wobble."""
    n = int(0.7 * SR)
    t = np.arange(n) / SR
    wob = 1 + 0.06 * np.sin(2 * np.pi * 17 * t) * np.exp(-t / 0.12)
    f = (175 + 180 * np.exp(-t / 0.035)) * wob
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR)
    tone += 0.35 * np.sin(2 * np.pi * np.cumsum(f * 2.01) / SR) * np.exp(-t / 0.05)
    tone += 0.12 * np.sin(2 * np.pi * np.cumsum(f * 3.03) / SR) * np.exp(-t / 0.03)
    tone *= env_exp(n, 0.12, 0.003)
    squish = lp(noise(n, seed), 700, 2) * env_exp(n, 0.025, 0.002) * 0.9
    x = soft_sat(tone * 0.9 + squish, 1.3)
    st = widen(x, 0.15, seed)
    st = reverb(st, wet=0.12, decay_s=0.4)
    return finish(st, fin=0.001)


def s_pop(seed=0, pitch=1.0):
    """Bubble pop / cork: fast upward chirp + snap + resonant body."""
    n = int(0.25 * SR)
    t = np.arange(n) / SR
    f = (520 + 1300 * (1 - np.exp(-t / 0.012))) * pitch
    chirp = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(n, 0.03, 0.0008)
    snap = bp(noise(n, seed), 1500, 7000) * env_exp(n, 0.002, 0.0002) * 1.1
    cork = modal([780 * pitch, 1650 * pitch], [0.4, 0.15], [0.03, 0.015], 0.25, seed)
    x = chirp + snap + cork
    st = widen(x, 0.2, seed)
    st = reverb(st, wet=0.15, decay_s=0.45)
    return finish(st)


def grains(n, rate_fn, seed, lo=1800, hi=7000, glen=(0.002, 0.012), amp_fn=None):
    """Sparse paper-crinkle grains. rate_fn(u)->grains/s."""
    r = rng(seed)
    out = np.zeros(n)
    t = 0.0
    dur = n / SR
    while t < dur:
        rate = max(rate_fn(t / dur), 1e-3)
        t += r.exponential(1 / rate)
        if t >= dur:
            break
        gl = r.uniform(*glen)
        gn = int(gl * SR)
        g = r.standard_normal(gn) * np.exp(-np.linspace(0, 5, gn))
        g[: min(8, gn)] *= np.linspace(0, 1, min(8, gn))
        k = int(t * SR)
        a = r.uniform(0.3, 1.0) * (amp_fn(t / dur) if amp_fn else 1.0)
        out[k:k + gn] += a * g[: max(0, min(gn, n - k))]
    return bp(out, lo, hi)


def s_pageflip(seed=0, dur=0.34, direction=1):
    """Crisp page flutter: swish + crinkle grains + end snap."""
    n = int(dur * SR)
    u = np.linspace(0, 1, n)
    e = np.sin(np.pi * np.clip(u / 0.85, 0, 1)) ** 1.5
    fc = 1200 + 3500 * np.sin(np.pi * np.clip(u / 0.85, 0, 1))
    sw = svf(pink(n, seed), fc, 0.9, "bp") * e
    # flutter AM (paper edge vibrating)
    flut = 1 + 0.5 * np.sin(2 * np.pi * np.cumsum(28 + 30 * u) / SR)
    sw *= flut
    cr = grains(n, lambda v: 260 * np.sin(np.pi * v) + 20, seed + 1, 2000, 9000) * 0.9
    snapn = int(0.03 * SR)
    snap = bp(noise(snapn, seed + 2), 800, 6000) * env_exp(snapn, 0.004, 0.0003) * 1.6
    grab = bp(noise(n, seed + 7), 1500, 8000) * env_exp(n, 0.004, 0.0003) * 0.9
    x = sw + cr + grab
    x = mix(x, at(snap, dur * 0.82))
    p = direction * np.interp(np.arange(len(x)), [0, len(x) - 1], [-0.6, 0.6])
    st = pan(x, p)
    st = reverb(st, wet=0.1, decay_s=0.35)
    return finish(st, fin=0.003)


def s_clink(seed=0):
    """Two ceramic cups: inharmonic modal partials, slightly offset."""
    def cup(f0, s, amp):
        ratios = [1.0, 2.31, 3.93, 5.72, 7.9]
        amps = [1.0, 0.6, 0.35, 0.2, 0.1]
        dec = [0.45, 0.28, 0.16, 0.09, 0.05]
        m = modal([f0 * r_ for r_ in ratios], amps, dec, 1.8, s, detune=0.004)
        # beating from the cup's ovalness
        t = tt(1.8)
        m2 = modal([f0 * 1.006], [0.5], [0.4], 1.8, s + 9)
        n = len(t)
        contact = hp(noise(n, s), 3000) * env_exp(n, 0.0012, 0.0001) * 0.6
        return amp * (m + m2 + contact)

    a = cup(2230, seed, 1.0)
    b = cup(2610, seed + 1, 0.8)
    st = mix(pan(a, -0.3), at(pan(b, 0.3), 0.004))
    st = lp(st, 9000)
    st = reverb(st, wet=0.2, decay_s=0.7)
    return finish(st)


def s_thud(seed=0, pitch=1.0):
    """Cardboard box landing: low thump + box modes + flap rattle."""
    n = int(0.6 * SR)
    t = np.arange(n) / SR
    f = (55 + 70 * np.exp(-t / 0.03)) * pitch
    thump = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(n, 0.09, 0.002)
    box = modal(np.array([172, 251, 397, 530]) * pitch, [0.5, 0.45, 0.3, 0.2],
                [0.06, 0.045, 0.035, 0.02], 0.6, seed)
    body = lp(noise(n, seed), 500, 2) * env_exp(n, 0.035, 0.001) * 1.5
    rattle = bp(noise(n, seed + 1), 700, 2400) * env_exp(n, 0.03, 0.001) * 0.45
    rattle *= 1 + 0.8 * np.sign(np.sin(2 * np.pi * 45 * t))
    x = soft_sat(thump * 1.1 + box + body + rattle, 1.4)
    st = widen(x, 0.2, seed, 400)
    st = reverb(st, wet=0.16, decay_s=0.55, bright=4000)
    return finish(st, fin=0.001)


def formant_env(freq, formants):
    """freq [T,K]; formants list of (Fc[T], Bw[T], gain) -> amplitude."""
    g = np.zeros_like(freq)
    for Fc, Bw, gain in formants:
        Fc = Fc[:, None]
        Bw = Bw[:, None]
        g += gain / (1 + ((freq - Fc) / (Bw / 2)) ** 2)
    return g + 0.02


def s_woof(seed=0, pitch=1.0, dur=0.27):
    """Small cute dog bark: additive glottal source + moving formants.

    'w' onset (closed, low formants) -> open 'AR' (high, bright, rough)
    -> 'oof' close with breathy fricative tail. f0 contour rises then falls.
    """
    r = rng(seed)
    n = int(dur * SR)
    u = np.linspace(0, 1, n)
    # f0 contour (Hz): quick rise then droop — the "wOOF!" inflection
    f0 = np.interp(u, [0, 0.12, 0.28, 0.6, 1.0], [470, 760, 820, 600, 390]) * pitch
    # jitter + roughness
    jit = signal.lfilter([0.02], [1, -0.98], r.standard_normal(n)) * 0.6
    f0 = f0 * (1 + 0.015 * jit)
    # amplitude: sharp onset, peak ~0.2, decay
    amp = np.interp(u, [0, 0.04, 0.14, 0.4, 0.7, 1.0], [0, 0.6, 1.0, 0.7, 0.22, 0.0]) ** 1.2
    amp = signal.savgol_filter(amp, 481, 2).clip(0, None)
    # formant trajectories (small dog: high formants)
    F1 = np.interp(u, [0, 0.1, 0.3, 0.7, 1.0], [480, 1050, 1150, 800, 520]) * pitch ** 0.5
    F2 = np.interp(u, [0, 0.1, 0.3, 0.7, 1.0], [950, 1850, 1950, 1350, 1000]) * pitch ** 0.5
    F3 = np.interp(u, [0, 0.15, 0.5, 1.0], [2600, 3300, 3200, 2700]) * pitch ** 0.5
    B1 = np.full(n, 220.0)
    B2 = np.full(n, 300.0)
    B3 = np.full(n, 450.0)
    forms = [(F1, B1, 1.0), (F2, B2, 0.7), (F3, B3, 0.3)]
    K = int(10000 / (380 * pitch))
    k = np.arange(1, K + 1)[None, :]
    freq = f0[:, None] * k
    # spectral tilt: brighter when louder (vocal effort)
    tilt = 1.7 - 0.55 * amp
    src = k ** (-tilt[:, None])
    A = src * formant_env(freq, forms)
    A *= 1 / (1 + (freq / 6000) ** 4)
    phase = 2 * np.pi * np.cumsum(f0) / SR
    ph_off = r.random(K) * 0.3
    x = np.sum(A * np.sin(phase[:, None] * k + ph_off[None, :]), axis=1)
    # subharmonic roughness (period doubling) in the loud middle
    rough = np.interp(u, [0, 0.12, 0.35, 0.6, 1], [0, 0.5, 0.35, 0.1, 0])
    kk = np.arange(1, K * 2, 2)[None, :] * 0.5
    fr = f0[:, None] * kk
    Ar = kk ** (-1.3) * formant_env(fr, forms)
    Ar *= 1 / (1 + (fr / 6000) ** 4)
    x += rough * np.sum(Ar * np.sin(phase[:, None] * kk), axis=1) * 0.5
    x *= amp
    # breath / aspiration through the same formants
    nz = noise(n, seed + 5)
    asp = (svf(nz, F1, 4, "bp") + 0.7 * svf(nz, F2, 5, "bp") + 0.3 * svf(nz, F3, 5, "bp"))
    x += asp * amp * 0.12
    x = x / np.max(np.abs(x))
    # 'f' fricative tail of "oof"
    tn = int(0.07 * SR)
    fric = bp(noise(tn, seed + 6), 1200, 5000) * np.sin(np.linspace(0, np.pi, tn)) ** 2 * 0.09
    x = mix(x, at(fric, dur * 0.72))
    x = peak_eq(x, 3000, 2, 1.0)
    st = pan(x, 0.0)
    st = reverb(st, wet=0.1, decay_s=0.4)
    return finish(st, fin=0.004)


def sparkle(n, seed, rate_fn, notes, amp_fn=None, dec=(0.06, 0.25), pan_fn=None):
    """Random bell grains on given note frequencies, stereo."""
    r = rng(seed)
    out = np.zeros((n, 2))
    t = 0.0
    dur = n / SR
    while True:
        t += r.exponential(1 / max(rate_fn(t / dur), 1e-3))
        if t >= dur:
            break
        f = notes[r.integers(len(notes))] * (1 + 0.003 * r.standard_normal())
        d = r.uniform(*dec)
        gn = int(min(d * 5, 1.2) * SR)
        tg = np.arange(gn) / SR
        g = (np.sin(2 * np.pi * f * tg) + 0.3 * np.sin(2 * np.pi * f * 2.76 * tg) * np.exp(-tg / (d * 0.3)))
        g *= np.exp(-tg / d) * np.clip(tg / 0.0015, 0, 1)
        a = r.uniform(0.3, 1.0) * (amp_fn(t / dur) if amp_fn else 1.0)
        p = pan_fn(t / dur) + 0.3 * r.standard_normal() if pan_fn else r.uniform(-0.9, 0.9)
        k = int(t * SR)
        m = min(gn, n - k)
        out[k:k + m] += pan(g[:m] * a, p)
    return out


def s_ting(seed=0):
    """Ring glint: high bell + shimmer grains."""
    n = int(2.4 * SR)
    f0 = 2637.0  # E7
    bell = modal([f0, f0 * 2.0, f0 * 2.76, f0 * 5.4], [1, 0.3, 0.45, 0.12],
                 [0.55, 0.3, 0.2, 0.06], 2.4, seed)
    t = tt(2.4)
    bell += 0.5 * np.sin(2 * np.pi * f0 * 1.003 * t) * np.exp(-t / 0.5)  # beating
    strike = hp(noise(n, seed), 5000) * env_exp(n, 0.002, 0.0002) * 0.4
    notes = [2093, 2349, 2637, 3136, 3520, 4186, 4699, 5274]
    sh = sparkle(n, seed + 1, lambda v: 40 * np.exp(-v * 3), notes,
                 amp_fn=lambda v: np.exp(-v * 2.5), dec=(0.03, 0.12))
    st = pan(bell + strike, 0.1) + 0.28 * sh
    st = reverb(st, wet=0.3, decay_s=1.0)
    return finish(st)


def s_confetti(seed=0):
    """Party popper: sharp bang + tube pop + long paper-rustle tail."""
    n = int(2.6 * SR)
    t = np.arange(n) / SR
    bang = noise(n, seed) * env_exp(n, 0.012, 0.0003)
    bang = bp(bang, 300, 9000) * 1.3
    boom = np.sin(2 * np.pi * np.cumsum(60 + 110 * np.exp(-t / 0.02)) / SR) * env_exp(n, 0.09, 0.001)
    tube = modal([420, 980], [0.5, 0.2], [0.03, 0.02], 2.6, seed)
    # rustle: dense then thinning, falling paper
    rust_rate = lambda v: 1400 * np.exp(-v * 3.2) + 30
    rust_amp = lambda v: np.exp(-v * 2.2) * np.clip(v / 0.03, 0, 1) * np.cos(np.pi / 2 * v) ** 2
    rs = [grains(n, rust_rate, seed + 10 + c, 2500, 11000, (0.001, 0.006), rust_amp) for c in range(2)]
    swish = svf(pink(n, seed + 3), 2500 + 3000 * np.exp(-t / 0.4), 0.8, "bp") * \
        env_exp(n, 0.35, 0.01) * 0.35
    front = soft_sat(bang + boom * 0.9 + tube, 1.6)
    st = np.stack([front, front], 1) * 0.707
    st += np.stack([rs[0], rs[1]], 1) * 0.55
    st += widen(swish, 0.6, seed)
    st = reverb(st, wet=0.18, decay_s=0.8)
    return finish(st)


def s_scratch(seed=0):
    """Vinyl record scratch: an 'aaah' record played back-and-forth + stop."""
    # source "record": formant voice chord + hats, 2 s
    sn = int(2.0 * SR)
    ts = np.arange(sn) / SR
    src = np.zeros(sn)
    for f0, a in [(196, 1.0), (247, 0.6), (294, 0.5)]:
        for k in range(1, 40):
            f = f0 * k
            if f > 12000:
                break
            g = 1 / k * (1 / (1 + ((f - 800) / 250) ** 2) + 0.6 / (1 + ((f - 1200) / 300) ** 2) + 0.1)
            src += a * g * np.sin(2 * np.pi * f * ts)
    src += 0.15 * hp(noise(sn, seed), 5000)
    src /= np.max(np.abs(src))
    # rate curve: forward -> pull back -> push forward -> back -> stop
    dur = 0.55
    n = int(dur * SR)
    u = np.arange(n) / SR
    keys_t = [0, 0.02, 0.09, 0.15, 0.22, 0.29, 0.36, 0.55]
    keys_r = [1.0, 0.6, -2.6, 0.2, 3.2, -1.8, -0.4, 0.0]
    rate = np.interp(u, keys_t, keys_r)
    rate = signal.savgol_filter(rate, 801, 2)
    pos = 0.8 + np.cumsum(rate) / SR
    y = np.interp(pos * SR, np.arange(sn), src)
    speed = np.abs(rate)
    y = svf(y, 300 + 3500 * np.clip(speed / 2.5, 0, 1), 0.8, "lp") * np.clip(speed * 1.2, 0, 1.5)
    # stylus friction noise
    fr = svf(noise(n, seed + 1), 1500 + 2500 * np.clip(speed / 3, 0, 1), 1.5, "bp") * speed * 0.35
    x = y + fr
    x *= np.clip((0.55 - u) / 0.05, 0, 1)
    st = widen(x, 0.15, seed)
    st = reverb(st, wet=0.08, decay_s=0.35)
    return finish(st, fin=0.002)


def s_slam(seed=0):
    """Ominous: reverse-suck pre-roll, sub boom, low metallic hit, long tail."""
    pre = 0.18
    n = int(3.5 * SR)
    t = np.arange(n) / SR
    sub = np.sin(2 * np.pi * np.cumsum(34 + 40 * np.exp(-t / 0.08)) / SR) * env_exp(n, 0.7, 0.002)
    sub = soft_sat(sub, 1.8)
    metal_f = [98, 151, 223, 297, 409, 553, 771]
    metal = modal(metal_f, [0.6, 0.55, 0.45, 0.35, 0.3, 0.2, 0.12],
                  [1.1, 0.9, 0.7, 0.55, 0.4, 0.25, 0.15], 3.5, seed, detune=0.01)
    metalR = modal([f * 1.004 for f in metal_f], [0.6, 0.55, 0.45, 0.35, 0.3, 0.2, 0.12],
                   [1.1, 0.9, 0.7, 0.55, 0.4, 0.25, 0.15], 3.5, seed + 1, detune=0.01)
    crack = bp(noise(n, seed), 200, 4000) * env_exp(n, 0.02, 0.0005) * 1.2
    L = sub * 1.2 + metal * 0.7 + crack
    R = sub * 1.2 + metalR * 0.7 + crack
    hit = np.stack([L, R], 1) * 0.707
    hit = reverb(hit, wet=0.45, decay_s=2.4, predelay_s=0.02, bright=2500, seed=11)
    # reverse suck-in
    pn = int(pre * SR)
    pu = np.linspace(0, 1, pn)
    suck = svf(pink(pn, seed + 4), 200 + 1400 * pu ** 2, 1.0, "bp") * pu ** 3
    suck = np.stack([suck, suck], 1) * 0.25
    out = np.concatenate([suck, hit])
    return finish(out, anchor=pn, fin=0.005)


PING_APPS = ["chime2", "marimba", "glass", "bloop", "arp", "pluck"]


def s_ping(app="chime2", pitch=1.0, seed=0):
    """Phone-notification ping family. Bright but mostly < 5 kHz."""
    r = rng(seed)
    if app == "chime2":      # classic two-note ascending chime
        notes, gap, dec = [1318.5, 1760.0], 0.075, 0.18
    elif app == "marimba":   # woody single blip
        notes, gap, dec = [1046.5], 0, 0.09
    elif app == "glass":     # glassy tap, inharmonic
        notes, gap, dec = [1568.0], 0, 0.3
    elif app == "bloop":     # FM bloop upward
        notes, gap, dec = [880.0], 0, 0.12
    elif app == "arp":       # quick triad
        notes, gap, dec = [1046.5, 1318.5, 1568.0], 0.045, 0.12
    else:                    # pluck, two same notes
        notes, gap, dec = [1174.7, 1174.7], 0.06, 0.07
    total = gap * (len(notes) - 1) + dec * 6
    n = int(total * SR)
    x = np.zeros(n)
    for i, f in enumerate(notes):
        f = f * pitch
        k0 = int(i * gap * SR)
        m = n - k0
        t = np.arange(m) / SR
        e = env_exp(m, dec, 0.0015) * (0.85 ** i if app != "arp" else 1)
        if app == "marimba":
            s = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * f * 3.9 * t) * np.exp(-t / 0.01)
        elif app == "glass":
            s = (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * f * 2.32 * t) * np.exp(-t / 0.06)
                 + 0.1 * np.sin(2 * np.pi * f * 4.1 * t) * np.exp(-t / 0.02))
        elif app == "bloop":
            fi = f * (0.6 + 0.4 * (1 - np.exp(-t / 0.02)))
            ph = 2 * np.pi * np.cumsum(fi) / SR
            s = np.sin(ph + 1.2 * np.exp(-t / 0.03) * np.sin(ph))
        elif app == "pluck":
            s = np.sin(2 * np.pi * f * t) + 0.4 * np.sin(4 * np.pi * f * t) * np.exp(-t / 0.02)
        else:
            s = np.sin(2 * np.pi * f * t) + 0.18 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / 0.05)
        x[k0:] += s * e
    x = lp(x, 5500, 2)
    return x


def s_ping_st(app, pitch, pan_pos, seed):
    x = s_ping(app, pitch, seed)
    st = pan(x, pan_pos)
    st = reverb(st, wet=0.12, decay_s=0.4, seed=seed % 5 + 20)
    return finish(st)


def s_buzz(seed=0):
    """Phone vibrating on a table: bzz-bzz with table rattle."""
    dur = 0.95
    n = int(dur * SR)
    t = np.arange(n) / SR
    gate = ((t < 0.36) | ((t > 0.52) & (t < 0.88))).astype(float)
    gate = signal.lfilter([1 - 0.995], [1, -0.995], gate)  # 4 ms smoothing
    gate = gate / gate.max()
    f = 165 + 6 * np.sin(2 * np.pi * 3 * t)
    ph = 2 * np.pi * np.cumsum(f) / SR
    motor = np.tanh(3 * np.sin(ph)) * 0.6 + 0.3 * np.sin(2 * ph)
    # the phone hitting the table on each cycle -> rattle impulses
    imp = np.maximum(np.sin(ph), 0) ** 12
    rattle = bp(imp * noise(n, seed), 900, 3500) * 1.8
    table = bp(motor, 100, 1200)
    x = (lp(motor, 1500) * 0.7 + rattle + table * 0.4) * gate
    x = peak_eq(x, 330, 5, 2)
    x = lp(x, 6000)
    st = widen(x, 0.15, seed)
    st = reverb(st, wet=0.1, decay_s=0.4)
    return finish(st, fin=0.003)


def s_scribble_riser(seed=0, dur=2.3):
    """Frantic pen scribbles (crescendo) + riser; ends at full level (hard cut)."""
    n = int(dur * SR)
    u = np.linspace(0, 1, n)
    t = np.arange(n) / SR
    cres = 0.18 + 0.82 * u ** 1.6
    layers = []
    for L in range(4):
        r = rng(seed + L)
        stroke_rate = 7 + 11 * u + 2 * L  # strokes / s accelerating
        ph = 2 * np.pi * np.cumsum(stroke_rate * (1 + 0.1 * r.standard_normal(n).cumsum() / np.sqrt(n))) / SR
        speed = np.abs(np.sin(ph + r.random() * 6))  # pen speed back & forth
        nz = noise(n, seed + 30 + L)
        fc = 1500 + 3000 * speed + 600 * L
        fric = svf(nz, fc, 1.2, "bp")
        # paper-tooth grit: amplitude jitter
        grit = 0.6 + 0.4 * np.abs(signal.lfilter([0.3], [1, -0.7], r.standard_normal(n)))
        layer = fric * speed ** 1.5 * grit
        # reversal ticks
        layer += grains(n, lambda v: 20 + 60 * v, seed + 50 + L, 2500, 8000) * 0.5
        layers.append(pan(layer, [-0.7, 0.7, -0.3, 0.3][L]))
    scr = sum(layers) * cres[:, None]
    # riser: rising noise band + rising detuned tone, exponential crescendo
    rn = svf(pink(n, seed + 90), 400 * 2 ** (u * 4), 2.0, "bp")
    rn = np.stack([rn, svf(pink(n, seed + 91), 410 * 2 ** (u * 4), 2.0, "bp")], 1)
    fr = 110 * 2 ** (u * 3)
    tone = np.zeros(n)
    for d in (-0.012, 0.0, 0.013):
        p_ = 2 * np.pi * np.cumsum(fr * (1 + d)) / SR
        tone += np.sin(p_) + 0.4 * np.sin(2 * p_) + 0.2 * np.sin(3 * p_)
    trem = 1 + 0.25 * np.sin(2 * np.pi * np.cumsum(4 + 20 * u ** 2) / SR)
    riser = (rn * 0.9 + widen(lp(tone, 4000) * 0.12, 0.4, seed)) * (u ** 2.5)[:, None] * trem[:, None]
    out = scr / np.max(np.abs(scr)) * 0.8 + riser / np.max(np.abs(riser)) * 0.7
    out = hp(out, 30)
    out = fade(out, 0.02, 0.0015)  # hard cut, just de-clicked (1.5 ms)
    return normalize(out, -1.0), 0


def s_shimmer(seed=0, dur=1.8, direction=1, notes_base=None):
    """Magical golden sparkle swell (pentatonic), sweeping pan."""
    n = int(dur * SR)
    u = np.linspace(0, 1, n)
    t = np.arange(n) / SR
    notes = notes_base or [1046.5, 1174.7, 1318.5, 1568.0, 1760.0, 2093.0, 2349.3, 2637.0,
                           3136.0, 3520.0, 4186.0]
    sw = lambda v: np.sin(np.pi * np.clip(v / 0.9, 0, 1)) ** 1.2
    sp = sparkle(n, seed, lambda v: 12 + 70 * sw(v), notes, amp_fn=sw, dec=(0.05, 0.35),
                 pan_fn=lambda v: direction * (-0.8 + 1.6 * v))
    # pad swell: detuned high sines
    pad_ = np.zeros(n)
    for f in (2093.0, 2637.0, 3136.0, 4186.0):
        for d in (-0.003, 0.003):
            pad_ += np.sin(2 * np.pi * f * (1 + d) * t + seed)
    swell = sw(u) ** 2
    padst = widen(pad_ * swell * 0.05, 0.7, seed)
    air = svf(noise(n, seed + 3), 6000 + 3000 * u, 0.7, "bp") * swell * 0.08
    st = sp * 0.5 + padst + widen(air, 0.8, seed + 1)
    st = lp(st, 11000)
    st = reverb(st, wet=0.4, decay_s=1.4, predelay_s=0.02)
    return finish(st, fin=0.01)


def s_pageturn(seed=0):
    """HERO: big, slow, close-mic'd page turn (~1.1 s).

    0.00 lift: fingertip on paper + flex crackle
    0.05-0.75 page travels: air swoosh (L->R), paper bending rumble, crinkles
    0.72 page lands: soft low flap + slap
    """
    dur = 1.35
    n = int(dur * SR)
    t = np.arange(n) / SR
    u = t / dur
    # fingertip contact + first flex
    tip = bp(noise(n, seed), 300, 3000) * env_exp(n, 0.02, 0.001) * 0.6
    # bend: low-mid paper rumble (close mic proximity)
    travel = np.clip((t - 0.03) / 0.7, 0, 1)
    trav_env = np.sin(np.pi * travel) ** 1.3 * (t < 0.73)
    bend = svf(pink(n, seed + 1), 250 + 900 * np.sin(np.pi * travel), 0.8, "bp") * trav_env * 0.9
    # air swoosh
    swoosh_fc = 500 + 2600 * np.sin(np.pi * travel) ** 2
    swoosh = svf(noise(n, seed + 2), swoosh_fc, 1.1, "bp") * trav_env ** 1.5 * 0.55
    # crinkles: dense at lift and just before landing
    cr_rate = lambda v: 60 + 700 * np.exp(-((v - 0.05) / 0.06) ** 2) + 450 * np.exp(-((v - 0.48) / 0.07) ** 2)
    crink = grains(n, cr_rate, seed + 3, 1500, 9000, (0.001, 0.01))
    crink *= np.clip((0.82 - t) / 0.08, 0, 1)
    # paper stiffness "creak" (low tonal flex)
    creak_f = 180 + 60 * np.sin(np.pi * travel)
    creak = np.sin(2 * np.pi * np.cumsum(creak_f) / SR) * trav_env * 0.06 * \
        (1 + 0.5 * np.sin(2 * np.pi * 23 * t))
    # landing flap: thump + slap + air puff
    land_t = 0.72
    ln = int(0.5 * SR)
    lt = np.arange(ln) / SR
    flap = np.sin(2 * np.pi * np.cumsum(70 + 90 * np.exp(-lt / 0.02)) / SR) * env_exp(ln, 0.06, 0.003) * 0.8
    slap = bp(noise(ln, seed + 4), 400, 5000) * env_exp(ln, 0.012, 0.0008) * 0.9
    puff = lp(noise(ln, seed + 5), 900) * env_exp(ln, 0.07, 0.005) * 0.9
    land = at(flap + slap + puff, land_t, n)
    moving = (bend + swoosh + creak + crink * 0.8) * 1.35
    p = -0.7 + 1.3 * (0.5 - 0.5 * np.cos(np.pi * np.clip(t / 0.75, 0, 1)))
    st = pan(moving + tip, p) + pan(land, 0.45)
    st = peak_eq(st, 140, 3, 0.8)  # proximity
    st = reverb(st, wet=0.12, decay_s=0.6, bright=5000)
    return finish(st, fin=0.003)


def s_click(seed=0):
    """Satisfying UI snap."""
    r = rng(seed)
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    snap = hp(noise(n, seed), 3500, 2) * env_exp(n, 0.0009, 0.0001) * 1.2
    f = 1500 * (1 + 0.06 * (r.random() - 0.5))
    body = np.sin(2 * np.pi * f * t) * env_exp(n, 0.012, 0.0003) * 0.45
    low = np.sin(2 * np.pi * np.cumsum(260 * np.exp(-t / 0.01) + 120) / SR) * env_exp(n, 0.014, 0.0005) * 0.7
    x = snap + body + low
    st = pan(x, 0.2 * (r.random() - 0.5))
    st = reverb(st, wet=0.1, decay_s=0.3)
    return finish(st)


def s_tick(seed=0, note=2093.0):
    """Soft checkmark 'tk' + tiny tonal blip."""
    n = int(0.15 * SR)
    t = np.arange(n) / SR
    tk = bp(noise(n, seed), 1200, 4500) * env_exp(n, 0.0015, 0.0002) * 0.8
    blip = (np.sin(2 * np.pi * note * t) + 0.2 * np.sin(2 * np.pi * note * 2 * t)) * \
        env_exp(n, 0.035, 0.002) * 0.5
    x = tk + at(blip, 0.006, n)
    st = pan(x, 0.15)
    st = reverb(st, wet=0.15, decay_s=0.4)
    return finish(st)


def s_cardflip(seed=0):
    """Card flip: short whoosh with rotation flutter, then snap."""
    dur = 0.36
    n = int(dur * SR)
    u = np.linspace(0, 1, n)
    e = np.sin(np.pi * np.clip(u / 0.75, 0, 1)) ** 2
    fc = 800 + 3000 * np.sin(np.pi * np.clip(u / 0.75, 0, 1))
    w = svf(pink(n, seed), fc, 1.2, "bp") * e
    rot = 0.55 + 0.45 * np.abs(np.cos(2 * np.pi * np.cumsum(9 + 8 * u) / SR))  # edge-on/face-on
    w *= rot
    c, _ = s_click(seed + 3)
    snap = c.mean(1) * 0.9
    x = mix(w * 0.8, at(snap, 0.27))
    st = pan(x, np.interp(np.arange(len(x)), [0, len(x)], [0.4, -0.2]))
    st = reverb(st, wet=0.12, decay_s=0.4)
    return finish(st, fin=0.003)


def s_slamhit(seed=0, pitch=1.0):
    """Punchy bright impact for kinetic type (not ominous)."""
    n = int(1.1 * SR)
    t = np.arange(n) / SR
    kick = np.sin(2 * np.pi * np.cumsum((55 + 140 * np.exp(-t / 0.025)) * pitch) / SR) * env_exp(n, 0.14, 0.0008)
    kick = soft_sat(kick, 2.0)
    snap = bp(noise(n, seed), 1800, 9000) * env_exp(n, 0.045, 0.0004) * 0.8
    clapn = np.zeros(n)
    for i, d in enumerate([0, 0.009, 0.017]):  # clap-ish flam
        k = int(d * SR)
        m = n - k
        clapn[k:] += bp(noise(m, seed + 10 + i), 900, 3500) * env_exp(m, 0.012 if i < 2 else 0.05, 0.0005)
    metal = modal(np.array([523, 784, 1318, 2093]) * pitch, [0.25, 0.2, 0.15, 0.1],
                  [0.25, 0.2, 0.15, 0.1], 1.1, seed)
    x = kick * 1.2 + snap + clapn * 0.7 + metal
    st = widen(x, 0.35, seed, 1200)
    st = reverb(st, wet=0.25, decay_s=0.8, bright=8000)
    return finish(st, fin=0.0005)


def s_bloom(seed=0, note=1046.5, pan_pos=0.0):
    """Flower-bloom chime: glock tone + petal 'fwip' + a few sparkles."""
    n = int(2.2 * SR)
    t = np.arange(n) / SR
    tone = (np.sin(2 * np.pi * note * t) * np.exp(-t / 0.5) +
            0.35 * np.sin(2 * np.pi * note * 2.0 * t) * np.exp(-t / 0.2) +
            0.2 * np.sin(2 * np.pi * note * 2.76 * t) * np.exp(-t / 0.08) +
            0.08 * np.sin(2 * np.pi * note * 5.4 * t) * np.exp(-t / 0.03))
    tone *= np.clip(t / 0.002, 0, 1)
    fw = svf(noise(n, seed), 2000 + 5000 * np.clip(t / 0.08, 0, 1), 1.5, "bp") * \
        env_ar(n, 0.02, 0.08, 2) * 0.25
    sp = sparkle(n, seed + 1, lambda v: 25 * np.exp(-v * 6), [note * 2, note * 3, note * 4],
                 amp_fn=lambda v: np.exp(-v * 5), dec=(0.03, 0.1),
                 pan_fn=lambda v: pan_pos)
    st = pan(tone + fw, pan_pos) + 0.15 * sp
    st = lp(st, 12000)
    st = reverb(st, wet=0.3, decay_s=1.0)
    return finish(st, fin=0.001)


def s_firework(seed=0, pan_pos=0.0):
    """Launch thump -> whistle -> burst boom -> crackle tail."""
    dur = 2.6
    n = int(dur * SR)
    t = np.arange(n) / SR
    r = rng(seed)
    launch = np.sin(2 * np.pi * np.cumsum(60 + 90 * np.exp(-t / 0.02)) / SR) * env_exp(n, 0.07, 0.001)
    launch += bp(noise(n, seed), 200, 2000) * env_exp(n, 0.025, 0.0005) * 0.8
    # short whistle up
    wn = int(0.2 * SR)
    wu = np.linspace(0, 1, wn)
    whistle = np.sin(2 * np.pi * np.cumsum(1400 + 1400 * wu) / SR) * np.sin(np.pi * wu) * 0.12
    whistle += svf(noise(wn, seed + 1), 2000 + 2000 * wu, 3, "bp") * np.sin(np.pi * wu) * 0.25
    bt = 0.22
    bn = n - int(bt * SR)
    btt = np.arange(bn) / SR
    boom = lp(noise(bn, seed + 2), 400, 2) * env_exp(bn, 0.18, 0.002) * 2.2
    boom += np.sin(2 * np.pi * np.cumsum(40 + 60 * np.exp(-btt / 0.05)) / SR) * env_exp(bn, 0.3, 0.002)
    boom += bp(noise(bn, seed + 3), 1000, 8000) * env_exp(bn, 0.02, 0.0005) * 0.8
    boom = soft_sat(boom, 1.5)
    # crackle: pops starting ~0.15 s after burst, wide
    crk = np.zeros((bn, 2))
    tc = 0.12
    while tc < 1.9:
        tc += r.exponential(1 / (140 * np.exp(-(tc - 0.12) * 1.4) + 8))
        k = int(tc * SR)
        if k >= bn - 400:
            break
        gl = int(r.uniform(0.0005, 0.003) * SR)
        g = r.standard_normal(gl) * np.exp(-np.linspace(0, 6, gl))
        a = r.uniform(0.2, 1) * np.exp(-(tc - 0.12) * 1.2)
        crk[k:k + gl] += pan(g * a, np.clip(pan_pos + r.uniform(-0.8, 0.8), -1, 1))
    crk = hp(crk, 1500)
    x = pan(launch, pan_pos * 0.5)
    x = mix(x, at(pan(whistle, pan_pos), 0.02))
    x = mix(x, at(pan(boom, pan_pos) + crk * 0.9, bt))
    st = reverb(x, wet=0.35, decay_s=1.6, predelay_s=0.03, bright=5000)
    return finish(st, fin=0.001)


def s_flipbook(seed=0, dur=2.0):
    """Fast page riffle: accelerate then decelerate; each flick a paper flap."""
    n = int(dur * SR)
    u = np.linspace(0, 1, n)
    r = rng(seed)
    rate = lambda v: 7 + 30 * np.sin(np.pi * v) ** 1.3  # flicks per second
    out = np.zeros((n, 2))
    tcur = 0.0
    while True:
        tcur += 1.0 / rate(tcur / dur) * (1 + 0.12 * r.standard_normal())
        if tcur >= dur - 0.02:
            break
        gl = int(0.045 * SR)
        gt = np.arange(gl) / SR
        flick = bp(r.standard_normal(gl), 900, 7000) * env_exp(gl, 0.006, 0.0005)
        flick += np.sin(2 * np.pi * (r.uniform(180, 320)) * gt) * env_exp(gl, 0.01, 0.001) * 0.4
        k = int(tcur * SR)
        m = min(gl, n - k)
        v = tcur / dur
        out[k:k + m] += pan(flick[:m] * r.uniform(0.6, 1.0), 0.5 - v + 0.2 * r.standard_normal())
    # continuous air flutter under it
    air = svf(pink(n, seed + 1), 1200 + 2500 * np.sin(np.pi * u), 0.8, "bp") * np.sin(np.pi * u) ** 1.5 * 0.25
    out += widen(air, 0.5, seed)
    out = reverb(out, wet=0.12, decay_s=0.5)
    out = fade(out, 0.01, 0.03)
    return finish(out)


def s_bookclose(seed=0):
    """Heavy hardback closing: air compression pre-roll, thump, slap, puff."""
    pre = 0.14
    pn = int(pre * SR)
    pu = np.linspace(0, 1, pn)
    rush = svf(pink(pn, seed), 300 + 1500 * pu ** 2, 1.0, "bp") * pu ** 2.5 * 0.5
    n = int(1.6 * SR)
    t = np.arange(n) / SR
    thump = np.sin(2 * np.pi * np.cumsum(48 + 80 * np.exp(-t / 0.025)) / SR) * env_exp(n, 0.16, 0.0015)
    thump = soft_sat(thump * 1.2, 1.8)
    board = modal([142, 219, 331, 468, 690], [0.5, 0.45, 0.35, 0.2, 0.1],
                  [0.09, 0.07, 0.05, 0.04, 0.03], 1.6, seed)
    slap = bp(noise(n, seed + 1), 300, 6000) * env_exp(n, 0.008, 0.0004) * 1.4
    puff = lp(noise(n, seed + 2), 1200) * env_exp(n, 0.1, 0.006) * 0.8
    puff = widen(puff, 0.7, seed)
    x = thump + board + slap
    hit = np.stack([x, x], 1) * 0.707 + puff
    hit = peak_eq(hit, 90, 3, 0.9)
    hit = reverb(hit, wet=0.2, decay_s=0.9, bright=3500)
    out = np.concatenate([np.stack([rush, rush], 1) * 0.707, hit])
    return finish(out, anchor=pn, fin=0.005)


def s_ambience(dur, seed=0):
    """Very quiet paper/room tone bed: pinkish air + rare faint crinkles."""
    n = int(dur * SR)
    L = lp(hp(pink(n, seed), 60), 1800)
    R = lp(hp(pink(n, seed + 1), 60), 1800)
    slow = 1 + 0.15 * np.sin(2 * np.pi * np.arange(n) / SR * 0.21)
    bed = np.stack([L, R], 1) * slow[:, None]
    bed /= np.sqrt(np.mean(bed ** 2))
    cr = grains(n, lambda v: 1.4, seed + 5, 2000, 7000, (0.002, 0.02))
    cr = cr / (np.max(np.abs(cr)) + 1e-9)
    bed = bed * db(-50) + widen(cr, 0.8, seed) * db(-44)
    return bed


# ----------------------------------------------------------------------------
# Cue sheet
# ----------------------------------------------------------------------------


def chaos_ping_times(seed=2026):
    """Density ramp 2/s -> 14/s from 16.0 to 29.7 (accelerating), seeded jitter."""
    r = rng(seed)
    t0, t1 = 16.0, 29.7
    times = []
    t = t0
    while True:
        v = (t - t0) / (t1 - t0)
        rate = 2 + 12 * v ** 1.4
        dt = (1 / rate) * r.uniform(0.6, 1.4)
        t += dt
        if t > t1:
            break
        times.append(round(t, 3))
    return [15.6] + [16.0] + times


def build(qc=False):
    os.makedirs(SFX_DIR, exist_ok=True)
    os.makedirs(STEM_DIR, exist_ok=True)
    os.makedirs(DATA_DIR, exist_ok=True)

    stem = np.zeros((NTOT, 2))
    cues = []       # (time, name, gain_db, audio, anchor)
    oneshots = {}

    def cue(time, name, gen, gain_db, save_as=None):
        audio, anchor = gen
        cues.append((time, name, gain_db, audio, anchor))
        if save_as and save_as not in oneshots:
            oneshots[save_as] = audio

    # ---- ACT 1
    hb = s_heartbeat(1)
    cue(0.25, "heartbeat", hb, -5, "heartbeat")
    cue(0.60, "heartbeat", s_heartbeat(2), -6)
    for i in range(12):  # "Chapter One." = 12 characters, 1.10..2.20
        cue(round(1.10 + 0.1 * i, 3), "typewriter", s_typewriter(100 + i), -25 + (i % 3) * 0.8,
            "typewriter")
    cue(1.30, "plip", s_plip(3), -11, "plip")
    cue(2.60, "whoosh", s_whoosh(4), -11, "whoosh")
    cue(3.20, "boop", s_boop(5), -9, "boop")
    cue(5.40, "pop", s_pop(6), -13, "pop")

    # ---- ACT 2
    for i, tm in enumerate([6.0, 8.0, 10.0, 12.0]):
        cue(tm, "pageflip", s_pageflip(10 + i, direction=-1), -12, "pageflip")
    cue(6.9, "clink", s_clink(20), -13, "clink")
    for i, tm in enumerate([8.5, 9.0, 9.5]):
        cue(tm, "thud", s_thud(30 + i, pitch=[1.0, 1.08, 0.94][i]), -9, "thud")
    cue(10.6, "woof", s_woof(40, 1.0), -7, "woof")
    cue(12.55, "ting", s_ting(41), -13, "ting")
    cue(13.6, "confetti", s_confetti(42), -5, "confetti")

    # ---- ACT 3
    cue(14.0, "scratch", s_scratch(50), -7, "scratch")
    cue(14.3, "slam", s_slam(51), -3.5, "slam")

    # ---- ACT 4 chaos
    ptimes = chaos_ping_times()
    r = rng(777)
    last_app = None
    for i, tm in enumerate(ptimes):
        if i == 0:
            app, pitch, pp = "chime2", 1.0, 0.0
        else:
            app = PING_APPS[r.integers(len(PING_APPS))]
            if app == last_app:
                app = PING_APPS[(PING_APPS.index(app) + 1) % len(PING_APPS)]
            pitch = 2 ** (r.uniform(-1.2, 1.2) / 12)
            pp = r.uniform(-0.85, 0.85)
        last_app = app
        v = max(0.0, (tm - 16.0) / 13.7)
        g = -19 - 3.5 * v + r.uniform(-1.5, 1.0)  # density rises -> each quieter
        cue(tm, "ping", s_ping_st(app, pitch, pp, 900 + i), g,
            f"ping_{app}" if i < 40 else None)
    for i, tm in enumerate([18.0, 22.0, 26.0]):
        cue(tm, "buzz", s_buzz(60 + i), -12 + i * 0.5, "phone_buzz")
    cue(27.5, "scribble_riser", s_scribble_riser(70), -6, "scribble_riser")

    # ---- ACT 5
    cue(30.0, "shimmer", s_shimmer(80, dur=1.8, direction=1,
                                   notes_base=[2637.0, 2349.3, 2093.0, 1760.0, 1568.0, 1318.5, 3136.0]),
        -13, "shimmer_descend")
    cue(30.2, "pageturn", s_pageturn(81), -4, "pageturn")

    # ---- ACT 6
    for i in range(12):
        cue(round(34.0 + 0.5 * i, 3), "click", s_click(200 + i), -17, "click")
        cue(round(34.25 + 0.5 * i, 3), "tick", s_tick(300 + i, note=[2093.0, 2349.3, 2637.0][i % 3]),
            -24, "tick")
    cue(40.0, "cardflip", s_cardflip(90), -11, "cardflip")
    for i, tm in enumerate([42.0, 43.0, 44.0]):
        cue(tm, "slam_hit", s_slamhit(91 + i, pitch=[1.0, 1.06, 1.12][i]), -4.5, "slam_hit")
    cue(45.5, "whoosh", s_whoosh(95, dur=0.5, pan_from=-0.3, pan_to=0.3, f_lo=300, f_hi=4200,
                                  peak_at=0.9, tonal=False), -7, "whoosh_zoom")

    # ---- ACT 7
    # C major pentatonic melodic contour for 13 blooms 46.0..49.0
    pent = {"C6": 1046.5, "D6": 1174.7, "E6": 1318.5, "G6": 1568.0, "A6": 1760.0,
            "C7": 2093.0, "D7": 2349.3, "E7": 2637.0}
    seq = ["C6", "E6", "G6", "A6", "G6", "C7", "A6", "D7", "C7", "E7", "D7", "C7", "G6"]
    for i, nm in enumerate(seq):
        side = -1 if i % 2 == 0 else 1
        cue(round(46.0 + 0.25 * i, 3), "bloom",
            s_bloom(400 + i, pent[nm], side * (0.7 - 0.04 * i)), -17, f"bloom_{nm}")
    cue(51.3, "firework", s_firework(97, -0.45), -7, "firework")
    cue(51.8, "firework", s_firework(98, 0.5), -8)
    cue(52.0, "flipbook", s_flipbook(99), -11, "flipbook")

    # ---- ACT 8
    cue(54.0, "bookclose", s_bookclose(100), -3.5, "bookclose")
    cue(54.3, "shimmer", s_shimmer(101, dur=2.0, direction=1), -12, "shimmer_foil")
    cue(58.8, "woof", s_woof(102, 1.1, dur=0.25), -7, "woof_small")
    cue(58.8, "pop", s_pop(103, pitch=1.15), -14)

    # ---- place
    placed = []
    for time, name, gain_db, audio, anchor in cues:
        start = int(round(time * SR)) - anchor
        a = audio * db(gain_db)
        s0 = max(start, 0)
        a = a[s0 - start:]
        e = min(NTOT, s0 + a.shape[0])
        stem[s0:e] += a[: e - s0]
        placed.append({"t": time, "name": name, "gain_db": gain_db})

    # ambience bed: acts 1-2 (0.9 -> 14.0) and act 7 (46 -> 54)
    for a0, a1, sd in [(0.9, 14.0, 500), (46.0, 54.0, 501)]:
        bed = s_ambience(a1 - a0, sd)
        n = bed.shape[0]
        e = np.ones(n)
        fi = int(0.6 * SR)
        fo = int((0.02 if a1 == 14.0 else 0.4) * SR)
        e[:fi] = np.linspace(0, 1, fi) ** 2
        e[-fo:] = np.linspace(1, 0, fo) ** 2
        k = int(round(a0 * SR))
        stem[k:k + n] += bed * e[:, None]

    # hard cut: absolute silence 29.800 -> 30.000 (tails of everything removed)
    c0, c1 = int(round(29.8 * SR)), int(round(30.0 * SR))
    stem[c0:c1] = 0.0

    # ---- master: gentle peak limiter to -1.5 dBFS, then safety ceiling -1 dBFS
    stem = limiter(stem, db(-1.5))
    stem[c0:c1] = 0.0
    ceiling = db(-1.0)
    stem = np.clip(stem, -ceiling, ceiling)
    assert stem.shape == (NTOT, 2)

    sf.write(os.path.join(STEM_DIR, "sfx.wav"), stem.astype(np.float32), SR, subtype="PCM_24")
    for nm, a in oneshots.items():
        sf.write(os.path.join(SFX_DIR, f"{nm}.wav"), normalize(a, -1.0).astype(np.float32), SR,
                 subtype="PCM_24")
    with open(os.path.join(DATA_DIR, "sfx_pings.json"), "w") as f:
        json.dump(ptimes, f)

    print(f"stem: {NTOT} samples, peak {20*np.log10(np.max(np.abs(stem))):.2f} dBFS, "
          f"{len(cues)} cues, {len(ptimes)} pings, {len(oneshots)} one-shots")
    if qc:
        run_qc(stem, cues, oneshots)
    return stem, cues, oneshots


def limiter(x, thr, look_s=0.003, rel_s=0.08):
    """Look-ahead peak limiter (gain computed on stereo max)."""
    a = np.max(np.abs(x), axis=1)
    need = np.minimum(1.0, thr / np.maximum(a, 1e-12))
    la = int(look_s * SR)
    # running minimum over look-ahead window (so gain is down before the peak)
    from scipy.ndimage import minimum_filter1d
    g = minimum_filter1d(need, size=2 * la + 1, mode="nearest")
    # smooth: instant attack via min filter, exponential release
    coef = np.exp(-1 / (rel_s * SR))
    g = _release(g, coef)
    # short smoothing of attack corners
    k = np.hanning(la) / np.hanning(la).sum()
    g = np.minimum(g, np.convolve(g, k, mode="same"))
    return x * g[:, None]


@njit(cache=True)
def _release(g, coef):
    out = np.empty_like(g)
    s = 1.0
    for i in range(g.shape[0]):
        if g[i] < s:
            s = g[i]
        else:
            s = g[i] + (s - g[i]) * coef
        out[i] = s
    return out


# ----------------------------------------------------------------------------
# QC
# ----------------------------------------------------------------------------


def run_qc(stem, cues, oneshots):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    os.makedirs(QC_DIR, exist_ok=True)

    mono = stem.mean(1)
    print(f"DC L {stem[:,0].mean():.2e} R {stem[:,1].mean():.2e}")
    # discontinuity check: second difference outliers relative to local level
    d2 = np.abs(np.diff(mono, 2))
    loc = np.convolve(np.abs(mono), np.ones(480) / 480, mode="same")[1:-1]
    bad = np.nonzero((d2 > 0.25) & (d2 > 20 * (loc + 1e-4)))[0]
    print("possible clicks:", len(bad), (bad[:10] / SR).round(3) if len(bad) else "")
    c0, c1 = int(29.8 * SR), int(30.0 * SR)
    print("cut window max:", np.max(np.abs(stem[c0:c1])))

    # onset accuracy: for isolated cues, find first sample > 10% of local peak
    rows = []
    for time, name, gain_db, audio, anchor in cues:
        if name in ("ping",):
            continue
        k = int(round(time * SR))
        seg = np.max(np.abs(audio[anchor:anchor + int(0.05 * SR)]), axis=1)
        pk = seg.max()
        on = np.argmax(seg > 0.1 * pk)
        err_ms = on / SR * 1000
        w = stem[k:k + int(0.25 * SR)]
        pk_db = 20 * np.log10(np.max(np.abs(w)) + 1e-12)
        rms_db = 10 * np.log10(np.mean(w ** 2) + 1e-12)
        rows.append((time, name, err_ms, pk_db, rms_db))
    print(f"{'t':>6} {'name':16} {'onset+ms':>8} {'pk dB':>7} {'rms250':>7}")
    for r_ in rows:
        print(f"{r_[0]:6.2f} {r_[1]:16} {r_[2]:8.2f} {r_[3]:7.1f} {r_[4]:7.1f}")

    # full-stem spectrogram + waveform
    fig, ax = plt.subplots(2, 1, figsize=(26, 9), sharex=True,
                           gridspec_kw={"height_ratios": [1, 2]})
    tax = np.arange(NTOT) / SR
    ax[0].plot(tax[::40], stem[::40, 0], lw=0.3, color="#2E4BFF")
    ax[0].plot(tax[::40], -stem[::40, 1], lw=0.3, color="#FF5A4E")
    for time, name, *_ in cues:
        if name != "ping":
            ax[0].axvline(time, color="k", lw=0.3, alpha=0.4)
    ax[0].set_ylim(-1, 1)
    f, tt_, S = signal.spectrogram(mono, SR, nperseg=2048, noverlap=1024)
    ax[1].pcolormesh(tt_, f, 10 * np.log10(S + 1e-14), vmin=-130, vmax=-40, shading="auto",
                     cmap="magma")
    ax[1].set_ylim(0, 16000)
    ax[1].set_xticks(np.arange(0, 61, 2))
    plt.tight_layout()
    plt.savefig(os.path.join(QC_DIR, "stem.png"), dpi=60)
    plt.close()

    keys = ["heartbeat", "plip", "whoosh", "boop", "clink", "thud", "woof", "ting", "confetti",
            "scratch", "slam", "ping_chime2", "ping_bloop", "ping_arp", "phone_buzz",
            "scribble_riser", "shimmer_descend", "pageturn", "click", "tick", "cardflip",
            "slam_hit", "bloom_C7", "firework", "flipbook", "bookclose", "woof_small", "pageflip"]
    keys = [k for k in keys if k in oneshots]
    cols = 4
    rows_ = int(np.ceil(len(keys) / cols))
    fig, axs = plt.subplots(rows_, cols, figsize=(22, 3.2 * rows_))
    for a_, k in zip(axs.flat, keys):
        x = oneshots[k].mean(1)
        nper = 512 if len(x) < SR * 0.5 else 1024
        f, tt_, S = signal.spectrogram(x, SR, nperseg=nper, noverlap=nper * 3 // 4)
        a_.pcolormesh(tt_, f, 10 * np.log10(S + 1e-14), vmin=-120, vmax=-30, shading="auto",
                      cmap="magma")
        a_.set_ylim(0, 12000)
        a_.set_title(k)
    for a_ in list(axs.flat)[len(keys):]:
        a_.axis("off")
    plt.tight_layout()
    plt.savefig(os.path.join(QC_DIR, "oneshots.png"), dpi=55)
    plt.close()

    # woof close-up (formants + f0)
    fig, axs = plt.subplots(1, 2, figsize=(14, 4))
    for a_, k in zip(axs, ["woof", "woof_small"]):
        x = oneshots[k].mean(1)
        f, tt_, S = signal.spectrogram(x, SR, nperseg=1024, noverlap=960)
        a_.pcolormesh(tt_, f, 10 * np.log10(S + 1e-14), vmin=-120, vmax=-30, shading="auto",
                      cmap="magma")
        a_.set_ylim(0, 8000)
        a_.set_title(k)
    plt.tight_layout()
    plt.savefig(os.path.join(QC_DIR, "woof.png"), dpi=70)
    plt.close()


if __name__ == "__main__":
    build(qc="--qc" in sys.argv)
