"""Shared DSP helpers for The Wedding Chapter launch SFX (adapted from film/audio/sfx_build.py)."""
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

