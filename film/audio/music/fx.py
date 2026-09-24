"""Effects: synthetic-IR convolution reverb, chorus, ping-pong delay, sidechain,
bitcrush, stutter, tape-stop, rewind, compressor, look-ahead limiter."""
import numpy as np
from scipy import signal
from scipy.ndimage import minimum_filter1d, uniform_filter1d
from core import SR, ns, tarr, butter, biquad, onepole_lp, njit, pan_gains, softclip


# ------------------------------------------------------------------- reverb
def make_ir(rt60=2.4, predelay=0.02, damp=0.35, lowcut=180.0, er=0.3, seed=7,
            width=1.0, bass_ratio=1.1):
    """Stereo reverb impulse response: band-wise exponentially decaying noise
    (frequency-dependent RT), soft onset, early reflections, pre-delay."""
    r = np.random.default_rng(seed)
    n = ns(rt60 * 1.3 + predelay)
    t = tarr(n)
    bands = [(20, 250), (250, 700), (700, 1800), (1800, 4000), (4000, 8000), (8000, 20000)]
    mult = [bass_ratio, 1.0, 0.9, 0.75, 0.55 * (1 - damp) + 0.2, 0.35 * (1 - damp) + 0.08]
    irs = []
    for c in range(2):
        y = np.zeros(n)
        for (lo, hi), mu in zip(bands, mult):
            nz = r.standard_normal(n)
            if lo <= 20:
                b = signal.butter(4, hi, 'low', fs=SR, output='sos')
            elif hi >= 20000:
                b = signal.butter(4, lo, 'high', fs=SR, output='sos')
            else:
                b = signal.butter(2, [lo, hi], 'band', fs=SR, output='sos')
            y += signal.sosfilt(b, nz) * np.exp(-6.9 * t / (rt60 * mu))
        tt = np.clip(t - predelay, 0, None)
        y *= (1 - np.exp(-tt / 0.03)) * (t >= predelay)
        # early reflections
        for k in range(12):
            d = predelay * 0.4 + r.uniform(0.004, 0.07)
            g = er * r.uniform(0.3, 1.0) * np.exp(-d / 0.05) * r.choice([-1, 1])
            y[ns(d)] += g * np.sqrt(np.sum(y ** 2)) * 0.02
        irs.append(y)
    ir = np.stack(irs, axis=1)
    if lowcut:
        ir = butter(ir, 'hp', lowcut, 2)
    # width: blend towards mono
    mid = ir.mean(axis=1, keepdims=True)
    ir = mid + (ir - mid) * width
    ir /= np.sqrt(np.sum(ir ** 2, axis=0, keepdims=True)) + 1e-12
    return ir


def convolve(x, ir):
    out = np.zeros_like(x)
    n = len(x)
    for c in range(2):
        y = signal.oaconvolve(x[:, c], ir[:, c])[:n]
        out[:, c] = y
    return out


# ------------------------------------------------------------- modulation fx
def _frac_delay(x, delay_samples):
    n = len(x)
    idx = np.arange(n) - delay_samples
    return np.interp(idx, np.arange(n), x, left=0.0, right=0.0)


def chorus(x, base_ms=12.0, depth_ms=3.0, rate=0.7, mix=0.35):
    t = tarr(len(x))
    out = x.copy()
    for c, ph in ((0, 0.0), (1, np.pi / 2)):
        d = (base_ms + depth_ms * np.sin(2 * np.pi * rate * t + ph)) * SR / 1000
        src = x[:, 1 - c] * 0.3 + x[:, c] * 0.7
        out[:, c] = x[:, c] * (1 - mix * 0.5) + mix * _frac_delay(src, d)
    return out


def wobble(x, depth_cents=15.0, rate=5.0, seed=3, rate_var=0.5):
    """Pitch wobble / detune via modulated delay (tape warble)."""
    r = np.random.default_rng(seed)
    n = len(x)
    t = tarr(n)
    lfo = np.sin(2 * np.pi * rate * t + r.uniform(0, 6)) + 0.5 * np.sin(2 * np.pi * rate * 2.3 * t)
    dep = np.asarray(depth_cents) * np.ones(n)
    # delay modulation amplitude that gives the requested pitch deviation
    amp = (2 ** (dep / 1200) - 1) / (2 * np.pi * rate) * SR
    d = 60 + amp * lfo
    return np.stack([_frac_delay(x[:, c], d) for c in range(2)], axis=1)


def pingpong(x, delay=0.375, fb=0.45, taps=6, lp=4000.0, hp=300.0, mix=0.3):
    mono = x.mean(axis=1)
    mono = butter(mono, 'hp', hp)
    out = np.zeros_like(x)
    d = ns(delay)
    sig = mono
    g = 1.0
    for k in range(1, taps + 1):
        sig = onepole_lp(sig, lp)
        g *= fb
        c = (k + 1) % 2
        if k * d >= len(x):
            break
        out[k * d:, c] += g * sig[:len(x) - k * d]
    return x + mix * out


def widen(x, amount=1.3):
    mid = (x[:, 0] + x[:, 1]) / 2
    side = (x[:, 0] - x[:, 1]) / 2 * amount
    return np.stack([mid + side, mid - side], axis=1)


def haas(x, ms=12.0, amount=0.5):
    """Mono-safe widening: add a delayed, high-passed copy to the side channel."""
    mid = x.mean(axis=1)
    d = butter(_frac_delay(mid, ms * SR / 1000), 'hp', 400)
    return x + amount * np.stack([d, -d], axis=1) * 0.5


# ------------------------------------------------------------- dynamics fx
def sidechain_gain(n, t0, kick_times, depth=0.6, attack=0.004, release=0.16):
    """Deterministic ducking envelope from known kick onset times."""
    g = np.ones(n)
    ra = ns(attack)
    for tk in kick_times:
        i0 = ns(tk - t0)
        L = ns(release * 4)
        seg = np.arange(L)
        shape = np.where(seg < ra, seg / max(ra, 1),
                         np.exp(-(seg - ra) / (release * SR)))
        s0 = max(i0, 0)
        e0 = min(i0 + L, n)
        if e0 <= s0:
            continue
        gg = 1 - depth * shape[s0 - i0:e0 - i0]
        g[s0:e0] = np.minimum(g[s0:e0], gg)
    return onepole_lp(g, 300)


def bitcrush(x, bits=8, down=4, mix=1.0):
    n = len(x)
    idx = (np.arange(n) // down) * down
    y = x[idx]
    q = 2 ** (bits - 1)
    y = np.round(y * q) / q
    y = butter(y, 'lp', min(0.45 * SR, SR / down * 0.9))  # tame fold-over hash
    return x * (1 - mix) + y * mix


def stutter(x, t0, t_start, t_end, slice_len, pitch_up=0.0, fade=0.0015, decay=1.0):
    """Repeat the slice beginning at t_start until t_end (in place)."""
    i0, i1 = ns(t_start - t0), ns(t_end - t0)
    L = ns(slice_len)
    src = x[i0:i0 + L].copy()
    k = ns(fade)
    w = np.ones(L)
    w[:k] = np.linspace(0, 1, k)
    w[-k:] = np.linspace(1, 0, k)
    pos = i0
    rep = 0
    while pos < i1:
        s = src
        if pitch_up:
            ratio = 2 ** (pitch_up * rep / 12)
            idx = np.arange(L) * ratio
            idx = idx[idx < L - 1]
            s = np.stack([np.interp(idx, np.arange(L), src[:, c]) for c in range(2)], axis=1)
            s = np.vstack([s, np.zeros((L - len(s), 2))])
        seg = min(L, i1 - pos)
        ww = w[:seg].copy()
        if seg < L:
            ww[-min(k, seg):] = np.linspace(1, 0, min(k, seg))
        x[pos:pos + seg] = s[:seg] * ww[:, None] * (decay ** rep)
        pos += L
        rep += 1
    # smooth join at exit
    if i1 < len(x):
        x[i1:i1 + k] *= np.linspace(0, 1, k)[:, None]
    return x


def tapestop(x, t0, t_start, t_end, power=1.6):
    """Tape-stop: playback speed ramps 1 -> 0 between t_start and t_end; silence after."""
    i0, i1 = ns(t_start - t0), ns(t_end - t0)
    L = i1 - i0
    u = np.arange(L) / L
    speed = (1 - u) ** power
    pos = i0 + np.cumsum(speed) - speed[0]
    for c in range(2):
        seg = np.interp(pos, np.arange(len(x)), x[:, c])
        x[i0:i1, c] = seg
    x[i1:] = 0
    k = ns(0.004)
    x[i1 - k:i1] *= np.linspace(1, 0, k)[:, None]
    # darken as it slows
    tail = x[i0:i1]
    x[i0:i1] = tail * 0.5 + butter(tail, 'lp', 1800) * 0.5
    return x


def rewind(src, src_end_idx, n_out, v0=1.0, v1=6.0, curve=2.0, flutter=0.004, seed=11):
    """Tape-rewind: read src backwards from src_end_idx with speed ramping v0->v1."""
    r = np.random.default_rng(seed)
    u = np.arange(n_out) / n_out
    v = v0 + (v1 - v0) * u ** curve
    t = tarr(n_out)
    v = v * (1 + flutter * np.sin(2 * np.pi * 7.3 * t) + flutter * 0.6 * np.sin(2 * np.pi * 1.9 * t + 1))
    pos = src_end_idx - np.cumsum(v)
    pos = np.clip(pos, 0, len(src) - 1)
    y = np.stack([np.interp(pos, np.arange(len(src)), src[:, c]) for c in range(2)], axis=1)
    return y


@njit(cache=True)
def _comp_gain(level_db, thr, ratio, knee, att_c, rel_c):
    n = level_db.shape[0]
    g = np.empty(n)
    env = 0.0
    for i in range(n):
        x = level_db[i]
        over = x - thr
        if 2 * over < -knee:
            gr = 0.0
        elif 2 * abs(over) <= knee:
            gr = (1 / ratio - 1) * (over + knee / 2) ** 2 / (2 * knee)
        else:
            gr = (1 / ratio - 1) * over
        # gr <= 0 ; smooth (attack when gain reduces further)
        if gr < env:
            env = att_c * env + (1 - att_c) * gr
        else:
            env = rel_c * env + (1 - rel_c) * gr
        g[i] = env
    return g


def compress(x, thr=-18.0, ratio=2.0, knee=6.0, attack=0.02, release=0.2, makeup=0.0,
             rms_ms=5.0, return_gain=False):
    lvl = np.max(np.abs(x), axis=1) if x.ndim == 2 else np.abs(x)
    lvl = np.sqrt(uniform_filter1d(lvl ** 2, max(1, ns(rms_ms / 1000))) + 1e-12)
    ldb = 20 * np.log10(lvl + 1e-9)
    gdb = _comp_gain(ldb, thr, ratio, knee, np.exp(-1 / (attack * SR)), np.exp(-1 / (release * SR)))
    g = 10 ** ((gdb + makeup) / 20)
    if return_gain:
        return g
    return x * g[:, None] if x.ndim == 2 else x * g


@njit(cache=True)
def _release(g, rc):
    out = np.empty_like(g)
    cur = 1.0
    for i in range(g.shape[0]):
        if g[i] < cur:
            cur = g[i]
        else:
            cur = rc * cur + (1 - rc) * g[i]
        out[i] = cur
    return out


def limit(x, ceiling_db=-1.2, look_ms=3.0, release=0.08):
    """Offline look-ahead peak limiter (no overshoot on sample peaks)."""
    ceil = 10 ** (ceiling_db / 20)
    pk = np.max(np.abs(x), axis=1)
    graw = np.minimum(1.0, ceil / np.maximum(pk, 1e-9))
    L = max(3, ns(look_ms / 1000))
    gmin = minimum_filter1d(graw, size=2 * L + 1)
    gs = uniform_filter1d(gmin, size=L + 1)
    gs = _release(gs, np.exp(-1 / (release * SR)))
    gs = np.minimum(gs, graw)
    y = x * gs[:, None]
    return y
