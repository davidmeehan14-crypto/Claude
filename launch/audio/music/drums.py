"""Synthesized drum kit, cymbals, risers and impacts."""
import numpy as np
from core import (SR, ns, tarr, noise, sine, pulse, saw, svf, butter, biquad, perc,
                  softclip, normalize, onepole_lp, rng, automation, lp24)


def kick(kind='punch', dur=0.55):
    n = ns(dur)
    t = tarr(n)
    if kind == 'soft':
        f0, f1, tp, td, click, drive = 120, 52, 0.045, 0.20, 0.0, 1.3
    elif kind == 'big':
        f0, f1, tp, td, click, drive = 190, 44, 0.04, 0.40, 0.35, 2.4
    else:
        f0, f1, tp, td, click, drive = 165, 48, 0.034, 0.30, 0.28, 2.0
    fr = f1 + (f0 - f1) * np.exp(-t / tp)
    body = sine(fr, n)
    env = np.exp(-t / td) * np.clip(1.15 - t / (dur * 1.1), 0, 1)
    y = body * env
    if click:
        k = int(0.006 * SR)
        c = butter(noise(k), 'bp', [1500, 9000]) * np.exp(-np.arange(k) / (0.0012 * SR))
        y[:k] += click * c
    y = softclip(y * 1.1, drive)
    ka = 12
    y[:ka] *= np.linspace(0, 1, ka)
    y[-128:] *= np.linspace(1, 0, 128)
    return normalize(y, 0.95)


def snare(dur=0.35, tone=190.0, snap=1.0):
    n = ns(dur)
    t = tarr(n)
    fr = tone * (1 + 0.3 * np.exp(-t / 0.01))
    body = 0.7 * sine(fr, n) * np.exp(-t / 0.055) + 0.35 * sine(fr * 1.75, n) * np.exp(-t / 0.035)
    nz = butter(noise(n), 'bp', [1200, 11000]) * np.exp(-t / 0.11) * snap
    y = body + 0.9 * nz
    y = softclip(y, 1.5)
    y[:8] *= np.linspace(0, 1, 8)
    y[-64:] *= np.linspace(1, 0, 64)
    return normalize(y, 0.9)


def clap(dur=0.45, width=True):
    n = ns(dur)
    t = tarr(n)
    chans = []
    for c in range(2 if width else 1):
        e = np.zeros(n)
        for k, off in enumerate((0.0, 0.0105, 0.0205, 0.031)):
            tt = t - off - rng().uniform(0, 0.0015)
            msk = tt >= 0
            tau = 0.0045 if k < 3 else 0.12
            e[msk] += np.exp(-tt[msk] / tau) * (0.8 if k < 3 else 1.0)
        nz = biquad(noise(n), 'bp', 1350, 0.9) + 0.4 * butter(noise(n), 'hp', 3500)
        chans.append(nz * e)
    y = np.stack(chans, axis=1) if width else chans[0]
    y[-64:] *= np.linspace(1, 0, 64)[(...,) + (None,) * (y.ndim - 1)]
    return normalize(y, 0.9)


_METAL = np.array([205.3, 304.4, 369.6, 522.7, 540.0, 800.0])


def _metal(n, scale=1.7):
    y = np.zeros(n)
    for f in _METAL * scale:
        y += pulse(f, n, rng().uniform(), 0.5)
    return y / 6


def hat(open_=False, dur=None, bright=1.0):
    dur = dur or (0.5 if open_ else 0.12)
    n = ns(dur)
    t = tarr(n)
    y = 0.7 * _metal(n) + 0.5 * noise(n)
    y = butter(y, 'hp', 6500 if bright >= 1 else 5000, 4)
    y = butter(y, 'lp', 15000, 2)
    y *= np.exp(-t / (0.16 if open_ else 0.028))
    y[:6] *= np.linspace(0, 1, 6)
    y[-64:] *= np.linspace(1, 0, 64)
    return normalize(y, 0.9)


def shaker(dur=0.12):
    n = ns(dur)
    t = tarr(n)
    y = biquad(noise(n), 'bp', 6000, 0.8)
    env = (1 - np.exp(-t / 0.008)) * np.exp(-t / 0.035)
    y *= env
    y[-32:] *= np.linspace(1, 0, 32)
    return normalize(y, 0.9)


def tom(f=110.0, dur=0.6):
    n = ns(dur)
    t = tarr(n)
    fr = f * (1 + 0.6 * np.exp(-t / 0.04))
    y = sine(fr, n) * np.exp(-t / 0.22) + 0.15 * butter(noise(n), 'bp', [300, 3000]) * np.exp(-t / 0.03)
    y = softclip(y, 1.5)
    y[:10] *= np.linspace(0, 1, 10)
    y[-64:] *= np.linspace(1, 0, 64)
    return normalize(y, 0.9)


def crash(dur=3.0, t60=2.2, bright=1.0):
    n = ns(dur)
    t = tarr(n)
    chans = []
    for c in range(2):
        y = 0.55 * _metal(n, 2.3 + 0.07 * c) + 0.6 * noise(n)
        y = butter(y, 'hp', 3800 if bright >= 1 else 2500, 2)
        y = biquad(y, 'peak', 8000, 0.7, 3)
        y = butter(y, 'lp', 16000)
        env = np.exp(-6.9 * t / t60) * (0.6 + 0.4 * np.exp(-t / 0.08))
        chans.append(y * env)
    y = np.stack(chans, axis=1)
    y[:12] *= np.linspace(0, 1, 12)[:, None]
    y[-256:] *= np.linspace(1, 0, 256)[:, None]
    return normalize(y, 0.9)


def reverse_cymbal(dur=1.5):
    """Reversed crash, ending at the downbeat (place at t_hit - dur)."""
    c = crash(dur + 0.05, t60=dur * 1.3)[::-1][:ns(dur)]
    c = c * (np.linspace(0, 1, len(c)) ** 1.5)[:, None]
    c[-48:] *= np.linspace(1, 0, 48)[:, None]
    return np.ascontiguousarray(c)


def riser(dur=2.0, f0=300.0, f1=9000.0, tone=True, curve=2.0, tone_f0=110.0, tone_f1=880.0):
    """Noise sweep + rising detuned saws; amplitude ramps up to the end."""
    n = ns(dur)
    u = np.linspace(0, 1, n)
    fc = f0 * (f1 / f0) ** (u ** 1.3)
    chans = []
    for c in range(2):
        y = svf(noise(n), fc, 2.5, 'bp') * 1.4
        if tone:
            fp = tone_f0 * (tone_f1 / tone_f0) ** (u ** 1.6)
            s = np.zeros(n)
            for det in (-12, 0, 12):
                s += saw(fp * 2 ** ((det + 5 * c) / 1200), n, rng().uniform())
            s = svf(s / 3, fc * 0.7 + 300, 1.0, 'lp')
            y = y + 0.5 * s
        chans.append(y)
    y = np.stack(chans, axis=1)
    y *= (u ** curve)[:, None]
    y[-32:] *= np.linspace(1, 0, 32)[:, None]
    y[:32] *= np.linspace(0, 1, 32)[:, None]
    return normalize(y, 0.9)


def impact(dur=2.5, f0=95.0, f1=30.0, noise_amt=0.6):
    """Cinematic impact: sub drop + noise body + punchy kick transient."""
    n = ns(dur)
    t = tarr(n)
    fr = f1 + (f0 - f1) * np.exp(-t / 0.35)
    sub = softclip(sine(fr, n) * np.exp(-t / 0.7), 1.5)
    nz = butter(noise(n), 'lp', 1400) * np.exp(-t / 0.18) * noise_amt
    k = kick('big', min(dur, 0.6))
    y = sub.copy()
    y += nz
    y[:len(k)] += 0.8 * k
    y[:16] *= np.linspace(0, 1, 16)
    y[-256:] *= np.linspace(1, 0, 256)
    return normalize(y, 0.95)


def roll_times(t0, t1, r0, r1, curve=1.0):
    """Onset times of an accelerating roll from rate r0 to r1 (hits/s)."""
    ts = []
    t = t0
    while t < t1 - 1e-6:
        ts.append(t)
        u = ((t - t0) / (t1 - t0)) ** curve
        r = r0 * (r1 / r0) ** u
        t += 1.0 / r
    return ts
