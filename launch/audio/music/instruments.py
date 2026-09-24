"""Pitched instruments, all synthesized from scratch.

Every function returns a mono (n,) or stereo (n, 2) float array, roughly
peak-normalised to ~1, starting at the note onset.
"""
import numpy as np
from core import (SR, ns, tarr, hz, m, mtof, adsr, perc, automation, saw, pulse,
                  sine, tri, noise, svf, lp24, biquad, butter, onepole_lp, karplus,
                  normalize, softclip, rng, pan_gains)


def _f(note):
    """Note name, MIDI number (< 128) or frequency in Hz (>= 128) -> Hz."""
    if isinstance(note, str):
        return hz(note)
    v = float(note)
    return float(mtof(v)) if v < 128 else v


def _modal(f, dur, parts, att=0.001, click=0.0, click_fc=6000, phase_rand=True):
    """Sum of exponentially decaying partials (ratio, amp, t60)."""
    n = ns(dur)
    t = tarr(n)
    y = np.zeros(n)
    for ratio, amp, t60 in parts:
        fr = f * ratio
        if fr > 0.45 * SR:
            continue
        ph = rng().uniform(0, 2 * np.pi) if phase_rand else 0.0
        y += amp * np.sin(2 * np.pi * fr * t + ph) * np.exp(-6.9 * t / t60)
    ka = max(2, int(att * SR))
    y[:ka] *= np.sin(0.5 * np.pi * np.linspace(0, 1, ka)) ** 2
    if click > 0:
        kc = int(0.004 * SR)
        c = noise(kc) * np.exp(-np.arange(kc) / (0.0008 * SR))
        c = butter(c, 'hp', click_fc)
        y[:kc] += click * c
    k = min(256, n)
    y[-k:] *= np.linspace(1, 0, k)
    return y


# ------------------------------------------------------------ mallets & boxes
def marimba(note, dur=1.2, vel=1.0):
    f = _f(note)
    t1 = float(np.clip(1.5 - 0.33 * np.log2(f / 130.0), 0.35, 1.6))
    parts = [(1.0, 1.0, t1), (3.93, 0.28 * vel, t1 * 0.22), (9.21, 0.08 * vel, 0.06),
             (1.0012, 0.25, t1 * 0.9)]
    y = _modal(f, dur, parts, att=0.0012, click=0.12 * vel, click_fc=2500)
    # woody mallet thump
    k = int(0.012 * SR)
    th = butter(noise(k), 'lp', 900) * np.exp(-np.arange(k) / (0.002 * SR))
    y[:k] += 0.25 * vel * th
    return normalize(y, 0.9)


def musicbox(note, dur=2.5, vel=1.0):
    f = _f(note)
    parts = [(1.0, 1.0, 2.3), (1.0017, 0.45, 2.0), (2.0, 0.12, 0.9), (3.0, 0.05, 0.45),
             (5.87, 0.20 * vel, 0.30), (9.75, 0.08 * vel, 0.12), (14.6, 0.04 * vel, 0.06)]
    y = _modal(f, dur, parts, att=0.0006, click=0.12 * vel, click_fc=5000)
    return normalize(y, 0.9)


def celesta(note, dur=2.5, vel=1.0):
    f = _f(note)
    parts = [(1.0, 1.0, 2.0), (0.9993, 0.4, 1.8), (2.0, 0.22, 0.8), (3.0, 0.05, 0.4),
             (4.02, 0.10 * vel, 0.25), (6.9, 0.03 * vel, 0.1)]
    y = _modal(f, dur, parts, att=0.0025, click=0.03 * vel, click_fc=3000)
    k = int(0.01 * SR)
    th = butter(noise(k), 'lp', 1200) * np.exp(-np.arange(k) / (0.002 * SR))
    y[:k] += 0.08 * vel * th
    return normalize(y, 0.9)


def glock(note, dur=2.0, vel=1.0):
    f = _f(note)
    parts = [(1.0, 1.0, 2.2), (1.0021, 0.3, 2.0), (2.76, 0.35 * vel, 0.7),
             (5.40, 0.18 * vel, 0.28), (8.93, 0.08 * vel, 0.12)]
    y = _modal(f, dur, parts, att=0.0005, click=0.2 * vel, click_fc=7000)
    return normalize(y, 0.9)


def bell(note, dur=4.0, bright=1.0, t60=4.0):
    """FM church/tubular bell (stereo, slow beating between channels)."""
    f = _f(note)
    n = ns(dur)
    t = tarr(n)
    out = []
    for ratio, det in ((3.5, 0.0), (3.507, 0.35)):
        fm = f * ratio
        imax = max(0.3, min(3.2 * bright, (19000 - f) / fm - 1.5))
        idx = imax * np.exp(-t / 0.35) + 0.35 * min(bright, imax)
        car = np.sin(2 * np.pi * (f + det) * t + idx * np.sin(2 * np.pi * fm * t))
        y = car * np.exp(-6.9 * t / t60)
        y += 0.35 * np.sin(2 * np.pi * 0.5 * f * t) * np.exp(-6.9 * t / (t60 * 1.3))   # hum
        y += 0.22 * np.sin(2 * np.pi * 1.19 * f * t + 1.0) * np.exp(-6.9 * t / (t60 * .45))  # tierce
        y += 0.15 * np.sin(2 * np.pi * 2.0 * f * t) * np.exp(-6.9 * t / (t60 * .3))
        out.append(y)
    y = np.stack(out, axis=1)
    ka = int(0.0015 * SR)
    y[:ka] *= np.linspace(0, 1, ka)[:, None]
    k = min(512, n)
    y[-k:] *= np.linspace(1, 0, k)[:, None]
    return normalize(y, 0.9)


# ---------------------------------------------------------------- strings
def harp(note, dur=3.0, vel=1.0):
    f = _f(note)
    t60 = float(np.clip(4.0 - 0.6 * np.log2(f / 130.0), 1.2, 5.0))
    y = karplus(f, dur, bright=0.45 + 0.25 * vel, t60=t60, pos=0.12)
    y = y + 0.3 * sine(f, len(y)) * np.exp(-6.9 * tarr(len(y)) / t60)
    y = biquad(y, 'peak', 180, 1.0, 2.0)
    y = butter(y, 'lp', min(12000, f * 9))
    y[:48] *= np.linspace(0, 1, 48)
    return normalize(y, 0.9)


def pizz(note, dur=0.7, vel=1.0):
    f = _f(note)
    y = karplus(f, dur, bright=0.35 + 0.2 * vel, t60=0.45, pos=0.25)
    y *= perc(len(y), 0.002, 0.9)
    y = biquad(y, 'peak', 260, 1.2, 5.0)
    y = biquad(y, 'peak', 3200, 1.0, -4.0)
    return normalize(y, 0.9)


def kspluck(note, dur=0.8, bright=0.8, t60=0.8, width=0.0):
    """Bright KS pluck; width>0 renders a slightly detuned stereo pair."""
    f = _f(note)
    if width > 0:
        l = karplus(f * 2 ** (-width / 1200), dur, bright, t60)
        r = karplus(f * 2 ** (width / 1200), dur, bright, t60)
        return np.stack([l, r], axis=1) * 0.9
    return karplus(f, dur, bright, t60) * 0.9


# ------------------------------------------------------------ analogue synths
def supersaw(notes, dur, voices=7, detune=18.0, a=0.3, d=0.5, s=0.8, r=0.6, gate=None,
             cutoff=3000.0, cutoff_env=None, res=0.7, width=1.0, drift=3.0, sub=0.0,
             hp=0.0, vib=0.0):
    """Unison poly-BLEP saw pad/lead -> 24 dB LP -> amp ADSR. Stereo.
    detune = total spread in cents. cutoff_env: [(t, hz), ...] (relative)."""
    n = ns(dur)
    t = tarr(n)
    L = np.zeros(n)
    R = np.zeros(n)
    for note in notes:
        f = _f(note)
        for v in range(voices):
            pos = (v / (voices - 1) - 0.5) * 2 if voices > 1 else 0.0
            cents = pos * detune / 2 + rng().uniform(-1.5, 1.5)
            lfo = drift * np.sin(2 * np.pi * rng().uniform(0.08, 0.3) * t + rng().uniform(0, 6.3))
            if vib:
                lfo = lfo + vib * np.sin(2 * np.pi * 5.2 * t + rng().uniform(0, 6.3)) * \
                    np.clip(t / 0.4, 0, 1)
            fr = f * 2 ** ((cents + lfo) / 1200)
            y = saw(fr, n, rng().uniform())
            gl, gr = pan_gains(pos * width * 0.9)
            L += y * gl
            R += y * gr
        if sub:
            y = sine(f / 2, n) * sub * voices * 0.35
            L += y
            R += y
    x = np.stack([L, R], axis=1) / np.sqrt(voices * len(notes))
    fc = automation(n, cutoff_env, log=True) if cutoff_env else cutoff
    x = lp24(x, fc, res)
    if hp:
        x = butter(x, 'hp', hp)
    env = adsr(n, a, d, s, r, gate)
    return x * env[:, None]


def pluck_lead(note, dur=0.6, bright=1.0, decay=0.22, width=12.0):
    """Bright modern pluck: saw+pulse pair through a snappy LP envelope."""
    f = _f(note)
    n = ns(dur)
    t = tarr(n)
    out = []
    for sgn in (-1, 1):
        fr = f * 2 ** (sgn * width / 2 / 1200)
        y = 0.6 * saw(fr, n, rng().uniform()) + 0.4 * pulse(fr * 2, n, rng().uniform(), 0.35) * 0.5
        y += 0.25 * sine(fr, n)
        out.append(y)
    x = np.stack(out, axis=1)
    fc = 500 + f * 0.8 + 7000 * bright * np.exp(-t / decay)
    x = lp24(x, fc, 0.9)
    env = adsr(n, 0.002, decay * 1.4, 0.18, min(0.25, dur * 0.4))
    return x * env[:, None] * 1.2


def lead(note, dur, gate=None, cutoff=2600, vib=12.0, glide_from=None):
    """Warm sustaining lead (2 saws + square), gentle vibrato."""
    f = _f(note)
    n = ns(dur)
    t = tarr(n)
    pitch = np.full(n, f)
    if glide_from is not None:
        f0 = _f(glide_from)
        pitch = f * (f0 / f) ** np.exp(-t / 0.03)
    v = vib * np.sin(2 * np.pi * 5.5 * t) * np.clip((t - 0.15) / 0.3, 0, 1)
    out = []
    for c in (-7, 7):
        fr = pitch * 2 ** ((c + v) / 1200)
        out.append(0.5 * saw(fr, n, rng().uniform()) + 0.35 * pulse(fr, n, rng().uniform(), 0.5))
    x = np.stack(out, axis=1)
    x = lp24(x, cutoff * (1 + 0.8 * np.exp(-t / 0.08)), 0.8)
    return x * adsr(n, 0.01, 0.3, 0.8, 0.12, gate)[:, None]


def bass(note, dur, gate=None, cut_hi=1600, cut_lo=220, decay=0.12, sub=0.8, drive=1.6,
         res=1.0):
    """Warm plucky bass: saw + pulse + sine sub through LP env, saturated."""
    f = _f(note)
    n = ns(dur)
    t = tarr(n)
    y = 0.6 * saw(f * 1.002, n, 0.3) + 0.4 * pulse(f * 0.998, n, 0.7, 0.45)
    fc = cut_lo + (cut_hi - cut_lo) * np.exp(-t / decay)
    y = lp24(y, fc, res)
    y = y + sub * sine(f, n, 0.25)
    y = softclip(y * 0.8, drive)
    env = adsr(n, 0.003, 0.3, 0.85, 0.05, gate)
    return y * env


def sub808(note, dur, glide=1.8, drive=2.0, t60=None):
    f = _f(note)
    n = ns(dur)
    t = tarr(n)
    fr = f * (1 + (glide - 1) * np.exp(-t / 0.03))
    y = sine(fr, n)
    y = softclip(y, drive)
    y = butter(y, 'lp', 400)
    env = perc(n, 0.002, t60 or dur * 1.2)
    return y * env


def brass(notes, dur, gate=None, bright=1.0, scoop=0.8, drive=1.8, a=0.012, r=0.25):
    """Brass-ish stab: detuned saws, pitch scoop, filter snap, saturation."""
    n = ns(dur)
    t = tarr(n)
    L = np.zeros(n)
    R = np.zeros(n)
    for i, note in enumerate(notes):
        f = _f(note)
        bend = -scoop * np.exp(-t / 0.035)
        for c, (gl, gr) in zip((-6, 0, 6), ((0.9, 0.3), (0.7, 0.7), (0.3, 0.9))):
            fr = f * 2 ** ((bend * 100 + c) / 1200)
            y = saw(fr, n, rng().uniform())
            L += y * gl
            R += y * gr
    x = np.stack([L, R], axis=1) / np.sqrt(3 * len(notes))
    fc = 350 + bright * (3200 * np.exp(-t / 0.10) + 900)
    x = lp24(x, fc, 0.9)
    x = softclip(x * 1.2, drive)
    return x * adsr(n, a, 0.25, 0.65, r, gate)[:, None]


FORMANTS = {
    'a': [(800, 1.0, 9), (1150, 0.55, 11), (2900, 0.22, 16), (3900, 0.12, 18)],
    'o': [(450, 1.0, 8), (800, 0.45, 9), (2830, 0.08, 16)],
    'u': [(325, 1.0, 8), (700, 0.25, 9), (2530, 0.04, 16)],
}


def choir(notes, dur, a=0.5, r=1.0, gate=None, vowel='a', voices=4, breath=0.06):
    """'Ahh' choir: detuned vibrato saws through parallel formant band-passes."""
    n = ns(dur)
    t = tarr(n)
    chans = []
    for ch in range(2):
        src = np.zeros(n)
        for note in notes:
            f = _f(note)
            for v in range(voices):
                rate = rng().uniform(4.6, 5.8)
                vib = 22 * np.sin(2 * np.pi * rate * t + rng().uniform(0, 6.3)) * np.clip(t / 0.6, 0, 1)
                cents = rng().uniform(-9, 9) + vib
                src += saw(f * 2 ** (cents / 1200), n, rng().uniform())
        src /= np.sqrt(voices * len(notes))
        src += breath * noise(n)
        y = np.zeros(n)
        for fc, g, q in FORMANTS[vowel]:
            y += g * biquad(src, 'bp', fc, q)
        chans.append(y)
    x = np.stack(chans, axis=1)
    x = butter(x, 'hp', 160)
    x = butter(x, 'lp', 7000)
    x = normalize(x, 0.9)
    return x * adsr(n, a, 1.0, 0.9, r, gate)[:, None]


def strings(notes, dur, a=0.25, r=0.8, gate=None, cutoff=3200, trem=0.0):
    """Ensemble strings: supersaw + slow vibrato + optional tremolo bowing."""
    x = supersaw(notes, dur, voices=5, detune=14, a=a, d=1.0, s=0.9, r=r, gate=gate,
                 cutoff=cutoff, res=0.6, width=1.0, drift=4, vib=10, hp=120)
    if trem:
        t = tarr(len(x))
        x *= (0.7 + 0.3 * np.sin(2 * np.pi * trem * t))[:, None]
    return x


def alarm(f1, f2, dur, rate=6.0):
    """Two-tone alarm: pulse wave toggling between two pitches."""
    n = ns(dur)
    t = tarr(n)
    sel = (np.floor(t * rate) % 2)
    sel = onepole_lp(sel, 200)
    fr = f1 + (f2 - f1) * sel
    y = pulse(fr, n, 0, 0.3) * 0.6 + saw(fr * 1.006, n) * 0.4
    y = svf(y, 3500, 1.2, 'lp')
    y = butter(y, 'hp', 500)
    return y * adsr(n, 0.005, 0.2, 0.9, 0.05)


def glitch_lead(note, dur, detune_c=0.0, crush=0.0):
    """Nervous pulse lead with random pitch wobble (chaos theme)."""
    f = _f(note)
    n = ns(dur)
    t = tarr(n)
    wob = detune_c * np.sin(2 * np.pi * rng().uniform(6, 14) * t + rng().uniform(0, 6))
    off = rng().uniform(-detune_c, detune_c) * 0.8
    fr = f * 2 ** ((wob + off) / 1200)
    y = 0.55 * pulse(fr, n, rng().uniform(), 0.25) + 0.45 * saw(fr * 1.01, n)
    y = svf(y, 1800 + 4500 * np.exp(-t / 0.05), 1.4, 'lp')
    return y * adsr(n, 0.002, 0.08, 0.5, 0.03)


def tick(f=1900.0, dur=0.08):
    """Wood-block/clock tick."""
    n = ns(dur)
    t = tarr(n)
    y = np.sin(2 * np.pi * f * t) * np.exp(-t / 0.012) + 0.5 * np.sin(2 * np.pi * f * 2.71 * t) * np.exp(-t / 0.006)
    ka = 24
    y[:ka] *= np.linspace(0, 1, ka)
    y[-64:] *= np.linspace(1, 0, 64)
    return y * 0.8
