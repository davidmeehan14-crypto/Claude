"""Core DSP primitives: timing grid, note names, envelopes, band-limited
oscillators, filters (TPT state-variable, RBJ biquads) and Karplus-Strong.

Everything is deterministic (seeded RNG) and runs at 48 kHz.
numba is used for the per-sample recursive loops when available (falls back to
plain Python, which is slow but correct).
"""
import numpy as np
from scipy import signal

try:  # pragma: no cover
    from numba import njit
except Exception:  # pragma: no cover
    def njit(*a, **k):
        if a and callable(a[0]):
            return a[0]
        return lambda f: f

SR = 48000
BPM = 120.0
BEAT = 60.0 / BPM          # 0.5 s
BAR = 4 * BEAT             # 2.0 s
DUR = 60.0
N_TOTAL = int(round(DUR * SR))

RNG = np.random.default_rng(20260924)


def reseed(seed):
    global RNG
    RNG = np.random.default_rng(seed)


def rng():
    return RNG


def T(bar, beat=0.0):
    """Absolute time (s) of bar/beat on the 120 BPM grid."""
    return bar * BAR + beat * BEAT


def ns(sec):
    return int(round(sec * SR))


_NOTE = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def m(name):
    """Note name ('C#5', 'Eb3') or number -> MIDI number."""
    if not isinstance(name, str):
        return float(name)
    letter = name[0].upper()
    i, acc = 1, 0
    while i < len(name) and name[i] in '#b':
        acc += 1 if name[i] == '#' else -1
        i += 1
    return 12 * (int(name[i:]) + 1) + _NOTE[letter] + acc


def mtof(mid):
    return 440.0 * 2.0 ** ((np.asarray(mid, dtype=float) - 69.0) / 12.0)


def hz(x):
    return float(mtof(m(x)))


def tarr(n):
    return np.arange(n) / SR


# ----------------------------------------------------------------- envelopes
def adsr(n, a=0.005, d=0.2, s=0.7, r=0.2, gate=None, att_curve='sin'):
    """ADSR over n samples. a = attack time, d = decay time-constant,
    r = release time (~ -40 dB), gate = note-on length (s)."""
    t = tarr(n)
    dur = n / SR
    if gate is None:
        gate = max(dur - r, 1e-3)
    a = max(a, 2e-4)
    e = np.empty(n)
    att = t < a
    x = t[att] / a
    if att_curve == 'sin':
        e[att] = np.sin(0.5 * np.pi * x) ** 2
    elif att_curve == 'exp':
        e[att] = 1 - (1 - x) ** 3
    else:
        e[att] = x
    dec = ~att
    e[dec] = s + (1 - s) * np.exp(-(t[dec] - a) / max(d, 1e-4))
    gi = int(gate * SR)
    if gi < n:
        lvl = e[max(gi - 1, 0)]
        e[gi:] = lvl * np.exp(-(t[gi:] - gate) / max(r / 4.6, 1e-4))
    k = min(128, n)
    e[-k:] *= np.linspace(1, 0, k)
    k2 = min(24, n)
    e[:k2] *= np.linspace(0, 1, k2) ** 0.5 if a < 0.001 else 1.0
    return e


def perc(n, a=0.001, t60=1.0, curve='exp'):
    """Percussive env: short attack, exponential decay with given T60."""
    t = tarr(n)
    e = np.exp(-6.9 * t / max(t60, 1e-4))
    ka = max(int(a * SR), 2)
    ka = min(ka, n)
    e[:ka] *= np.sin(0.5 * np.pi * np.linspace(0, 1, ka)) ** 2
    k = min(96, n)
    e[-k:] *= np.linspace(1, 0, k)
    return e


def automation(n, points, t0=0.0, log=False):
    """Piecewise automation from [(time, value), ...] (times relative to t0)."""
    pts = sorted(points)
    xs = np.array([p[0] for p in pts]) - t0
    ys = np.array([p[1] for p in pts], dtype=float)
    t = tarr(n)
    if log:
        return np.exp(np.interp(t, xs, np.log(ys)))
    return np.interp(t, xs, ys)


def fade_edges(x, fin=0.002, fout=0.005):
    x = np.array(x, copy=True)
    a, b = min(len(x), int(fin * SR)), min(len(x), int(fout * SR))
    if a > 1:
        x[:a] *= np.linspace(0, 1, a)[(...,) + (None,) * (x.ndim - 1)]
    if b > 1:
        x[-b:] *= np.linspace(1, 0, b)[(...,) + (None,) * (x.ndim - 1)]
    return x


# --------------------------------------------------------------- oscillators
def _f_arr(freq, n):
    f = np.asarray(freq, dtype=float)
    if f.ndim == 0:
        f = np.full(n, float(f))
    return f[:n]


def phase(freq, n, ph0=0.0):
    f = _f_arr(freq, n)
    dt = f / SR
    ph = (ph0 + np.cumsum(dt) - dt) % 1.0
    return ph, dt


def _blep(ph, dt):
    out = np.zeros_like(ph)
    m1 = ph < dt
    t = ph[m1] / dt[m1]
    out[m1] = t + t - t * t - 1.0
    m2 = ph > 1.0 - dt
    t = (ph[m2] - 1.0) / dt[m2]
    out[m2] = t * t + t + t + 1.0
    return out


def saw(freq, n, ph0=0.0):
    """PolyBLEP band-limited sawtooth."""
    ph, dt = phase(freq, n, ph0)
    return 2.0 * ph - 1.0 - _blep(ph, dt)


def pulse(freq, n, ph0=0.0, pw=0.5):
    """PolyBLEP band-limited pulse/square."""
    ph, dt = phase(freq, n, ph0)
    y = np.where(ph < pw, 1.0, -1.0)
    y += _blep(ph, dt)
    y -= _blep((ph + (1.0 - pw)) % 1.0, dt)
    return y - (2 * pw - 1)


def sine(freq, n, ph0=0.0):
    f = _f_arr(freq, n)
    dt = f / SR
    ph = (ph0 + np.cumsum(dt) - dt) % 1.0
    return np.sin(2 * np.pi * ph)


def tri(freq, n, ph0=0.0):
    ph, _ = phase(freq, n, ph0)
    return 4 * np.abs(ph - 0.5) - 1   # fine for low/mid freqs (harmonics fall 12 dB/oct)


def noise(n, color='white'):
    x = RNG.standard_normal(n)
    if color == 'pink':
        b = [0.049922035, -0.095993537, 0.050612699, -0.004408786]
        a = [1, -2.494956002, 2.017265875, -0.522189400]
        x = signal.lfilter(b, a, x) * 4
    return x


# ------------------------------------------------------------------- filters
@njit(cache=True)
def _svf(x, g_arr, k, mode):
    n = x.shape[0]
    y = np.empty(n)
    ic1 = 0.0
    ic2 = 0.0
    for i in range(n):
        g = g_arr[i]
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
            y[i] = v1
        else:
            y[i] = x[i] - k * v1 - v2
    return y


_MODES = {'lp': 0, 'bp': 1, 'hp': 2}


def svf(x, fc, q=0.707, mode='lp'):
    """Zavalishin TPT state-variable filter; fc may be an array (automation)."""
    x = np.asarray(x, dtype=float)
    n = x.shape[0]
    fc = np.clip(_f_arr(fc, n), 5.0, 0.46 * SR)
    g = np.tan(np.pi * fc / SR)
    k = 1.0 / q
    if x.ndim == 2:
        return np.stack([_svf(np.ascontiguousarray(x[:, c]), g, k, _MODES[mode])
                         for c in range(x.shape[1])], axis=1)
    return _svf(x, g, k, _MODES[mode])


def lp24(x, fc, res=0.8):
    """4-pole low-pass (two cascaded SVFs), res = Q of 2nd stage."""
    return svf(svf(x, fc, 0.54, 'lp'), fc, max(res, 0.5), 'lp')


def biquad_coef(kind, f, q=0.707, gain_db=0.0):
    A = 10 ** (gain_db / 40)
    w = 2 * np.pi * f / SR
    cw, sw = np.cos(w), np.sin(w)
    al = sw / (2 * q)
    if kind == 'lp':
        b = [(1 - cw) / 2, 1 - cw, (1 - cw) / 2]; a = [1 + al, -2 * cw, 1 - al]
    elif kind == 'hp':
        b = [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2]; a = [1 + al, -2 * cw, 1 - al]
    elif kind == 'bp':
        b = [al, 0, -al]; a = [1 + al, -2 * cw, 1 - al]
    elif kind == 'peak':
        b = [1 + al * A, -2 * cw, 1 - al * A]; a = [1 + al / A, -2 * cw, 1 - al / A]
    elif kind == 'lowshelf':
        sq = 2 * np.sqrt(A) * al
        b = [A * ((A + 1) - (A - 1) * cw + sq), 2 * A * ((A - 1) - (A + 1) * cw),
             A * ((A + 1) - (A - 1) * cw - sq)]
        a = [(A + 1) + (A - 1) * cw + sq, -2 * ((A - 1) + (A + 1) * cw),
             (A + 1) + (A - 1) * cw - sq]
    elif kind == 'highshelf':
        sq = 2 * np.sqrt(A) * al
        b = [A * ((A + 1) + (A - 1) * cw + sq), -2 * A * ((A - 1) + (A + 1) * cw),
             A * ((A + 1) + (A - 1) * cw - sq)]
        a = [(A + 1) - (A - 1) * cw + sq, 2 * ((A - 1) - (A + 1) * cw),
             (A + 1) - (A - 1) * cw - sq]
    else:
        raise ValueError(kind)
    b = np.array(b) / a[0]
    a = np.array(a) / a[0]
    return b, a


def biquad(x, kind, f, q=0.707, gain_db=0.0):
    b, a = biquad_coef(kind, f, q, gain_db)
    return signal.lfilter(b, a, x, axis=0)


def butter(x, kind, f, order=2):
    sos = signal.butter(order, f, btype={'lp': 'low', 'hp': 'high', 'bp': 'band'}[kind],
                        fs=SR, output='sos')
    return signal.sosfilt(sos, x, axis=0)


def onepole_lp(x, fc):
    a = np.exp(-2 * np.pi * fc / SR)
    return signal.lfilter([1 - a], [1, -a], x, axis=0)


def dcblock(x, fc=18.0):
    return butter(x, 'hp', fc, 2)


# -------------------------------------------------------------- Karplus-Strong
@njit(cache=True)
def _ks(exc, n, N, C, loss, S):
    buf = np.zeros(N)
    L = min(N, exc.shape[0])
    for i in range(L):
        buf[i] = exc[i]
    y = np.empty(n)
    idx = 0
    prev = 0.0
    apx = 0.0
    apy = 0.0
    for i in range(n):
        v = buf[idx]
        y[i] = v
        lp = (1.0 - S) * v + S * prev
        prev = v
        ap = C * lp + apx - C * apy
        apx = lp
        apy = ap
        buf[idx] = loss * ap
        idx += 1
        if idx >= N:
            idx = 0
    return y


def karplus(f, dur, bright=0.6, t60=1.5, S=0.5, pos=0.18):
    """Karplus-Strong plucked string with fractional-delay tuning."""
    n = ns(dur)
    P = SR / f
    N = int(np.floor(P - S - 0.1))
    frac = P - S - N
    C = (1 - frac) / (1 + frac)
    exc = RNG.uniform(-1, 1, N)
    a = 0.05 + 0.9 * (1 - bright)
    exc = signal.lfilter([1 - a], [1, -a], exc)
    d = max(1, int(pos * N))
    e2 = exc.copy()
    e2[d:] -= exc[:-d]
    e2 -= e2.mean()
    loss = 10 ** (-3.0 / (f * t60))
    y = _ks(e2, n, N, C, loss, S)
    y /= (np.abs(y[:min(n, 4 * N)]).max() + 1e-9)
    k = min(n, 200)
    y[-k:] *= np.linspace(1, 0, k)
    return y


# ------------------------------------------------------------------- helpers
def pan_gains(p):
    """Constant-power pan, p in [-1, 1]."""
    ang = (p + 1) * np.pi / 4
    return np.cos(ang), np.sin(ang)


def to_stereo(x, p=0.0):
    if x.ndim == 2:
        if p == 0:
            return x
        gl, gr = pan_gains(p)
        return np.stack([x[:, 0] * gl * 1.4142, x[:, 1] * gr * 1.4142], axis=1)
    gl, gr = pan_gains(p)
    return np.stack([x * gl, x * gr], axis=1)


def db(x):
    return 20 * np.log10(np.maximum(np.abs(x), 1e-12))


def undb(d):
    return 10 ** (d / 20)


def normalize(x, peak=1.0):
    mx = np.abs(x).max()
    return x * (peak / mx) if mx > 0 else x


def softclip(x, drive=1.0):
    return np.tanh(drive * x) / np.tanh(drive)
