#!/usr/bin/env python3
"""
SFX library for "The Wedding Chapter" 45 s launch film. Everything synthesised
(numpy/scipy), deterministic (seeded).

    python3 audio/sfx_build.py          # writes audio/sfx/*.wav + audio/sfx/offsets.json
    python3 audio/sfx_build.py --qc     # + spectrograms in audio/qc/

offsets.json: {file_stem: seconds} = the sample inside the file that must land
ON the cue time (whoosh/riser peak; transient onset for everything else).
Variants: pop_1..4, pop_soft_1..4, type_1..6 (pop.wav / pop_soft.wav / type.wav
are copies of variant 1 for auditioning).
"""
import json
import os
import sys

import numpy as np
import soundfile as sf

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sfx_dsp import (SR, rng, tt, db, lp, hp, bp, peak_eq, svf, env_exp, env_ar, fade, pad,
                     at, pan, widen, normalize, noise, pink, modal, reverb, finish, soft_sat,
                     grains, sparkle)

HERE = os.path.dirname(os.path.abspath(__file__))
SFX_DIR = os.path.join(HERE, "sfx")
QC_DIR = os.path.join(HERE, "qc")


def peak_anchor(st, win_s=0.02):
    """Sample index of the loudness peak (smoothed RMS)."""
    e = np.mean(st ** 2, axis=1)
    k = int(win_s * SR)
    e = np.convolve(e, np.ones(k) / k, mode="same")
    return int(np.argmax(e))


def trim_rel(st, thr_db=-62):
    """Cut the inaudible reverb tail (relative to peak) with a short fade."""
    a = np.max(np.abs(st), axis=1)
    idx = np.nonzero(a > a.max() * db(thr_db))[0]
    end = min(len(st), idx[-1] + int(0.005 * SR))
    return fade(st[:end], 0.0, min(0.03, end / SR / 4))


def tone(f, n, ph=0.0):
    f = np.broadcast_to(np.asarray(f, float), (n,))
    return np.sin(ph + 2 * np.pi * np.cumsum(f) / SR)


def gentle(st, top=9000):
    """House EQ: tame highs, keep it soft."""
    return lp(st, top, 2)


# ---------------------------------------------------------------------------
# Transitions
# ---------------------------------------------------------------------------

def s_whoosh(seed=0, dur=0.72, peak_at=0.70, f_lo=320, f_hi=2600, pan_from=0.7, pan_to=-0.7,
             wet=0.14, air=0.35):
    n = int(dur * SR)
    u = np.linspace(0, 1, n)
    e = np.where(u < peak_at, (u / peak_at) ** 2.4, np.exp(-(u - peak_at) / 0.07))
    e *= 1 - np.clip((u - 0.95) / 0.05, 0, 1)
    shape = np.where(u < peak_at, (u / peak_at) ** 1.6, np.exp(-(u - peak_at) / 0.12))
    fc = f_lo + (f_hi - f_lo) * shape
    nz = pink(n, seed)
    a = svf(nz, fc, 1.2, "bp")
    b = svf(noise(n, seed + 1), fc * 2.0, 2.0, "bp") * air
    c = svf(nz, fc * 0.5, 0.8, "lp") * 0.45
    x = (a + b + c) * e
    p = pan_from + (pan_to - pan_from) * (0.5 - 0.5 * np.cos(np.pi * u))
    st = pan(x, p)
    st = hp(gentle(st, 7000), 160, 2)
    st = reverb(st, wet=wet, decay_s=0.5)
    st, _ = finish(st, fin=0.005)
    return st, peak_anchor(st)


def s_whoosh_short(seed=0):
    return s_whoosh(seed + 10, dur=0.36, peak_at=0.70, f_lo=450, f_hi=3200, pan_from=0.5,
                    pan_to=-0.5, wet=0.1)


def s_swish(seed=0):
    """Card flying past: quick bright swish with slight card flutter."""
    dur = 0.32
    n = int(dur * SR)
    u = np.linspace(0, 1, n)
    pk = 0.55
    e = np.where(u < pk, (u / pk) ** 2.0, np.exp(-(u - pk) / 0.09))
    flutter = 1 + 0.25 * np.sin(2 * np.pi * 38 * u * dur)
    fc = 900 + 3000 * np.where(u < pk, u / pk, np.exp(-(u - pk) / 0.15))
    x = svf(noise(n, seed), fc, 1.6, "bp") + 0.4 * svf(pink(n, seed + 1), fc * 0.5, 1.0, "bp")
    x *= e * flutter
    st = pan(x, 0.8 - 1.6 * u)
    st = hp(gentle(st, 6000), 200, 2)
    st = reverb(st, wet=0.1, decay_s=0.35)
    st, _ = finish(st, fin=0.003)
    return st, peak_anchor(st)


def s_swipe(seed=0):
    """UI swipe: short soft brushed 'fft' with a directional pan."""
    dur = 0.22
    n = int(dur * SR)
    u = np.linspace(0, 1, n)
    pk = 0.45
    e = np.where(u < pk, np.sin(np.pi / 2 * u / pk) ** 2, np.exp(-(u - pk) / 0.12))
    fc = 1200 + 1800 * np.sin(np.pi * u)
    x = svf(noise(n, seed), fc, 1.1, "bp") * e
    x += 0.3 * svf(pink(n, seed + 2), 600, 0.9, "bp") * e
    st = pan(x, 0.5 - 1.0 * u)
    st = hp(gentle(st, 5500), 200, 2)
    st = reverb(st, wet=0.08, decay_s=0.3)
    st, _ = finish(st, fin=0.003)
    return st, peak_anchor(st)


def s_riser(seed=0, dur=1.5):
    """Rising air + tonal sweep; peak at the end (cue lands on the peak)."""
    tail = 0.12
    n = int((dur + tail) * SR)
    t = np.arange(n) / SR
    u = np.clip(t / dur, 0, 1)
    after = np.clip((t - dur) / tail, 0, 1)
    e = (u ** 2.2) * (1 - after) ** 2
    fc = 350 + 3400 * u ** 1.8
    air = svf(noise(n, seed), fc, 1.5, "bp") + 0.5 * svf(pink(n, seed + 1), fc * 0.4, 1.0, "bp")
    # tonal: stacked fifths gliding up an octave
    f0 = 220 * 2 ** (u * 1.0)
    ton = sum(a * tone(f0 * m, n, seed + i) for i, (m, a) in enumerate([(1, 0.5), (1.5, 0.3), (2, 0.25), (3.0, 0.08)]))
    ton *= 1 + 0.15 * np.sin(2 * np.pi * (4 + 10 * u) * t)  # accelerating tremolo
    x = (air * 0.8 + ton * 0.25) * e
    st = widen(x, 0.6, seed)
    st = hp(gentle(st, 6000), 150, 2)
    st = reverb(st, wet=0.2, decay_s=0.8)
    st, _ = finish(st, fin=0.01)
    return st, int(dur * SR) - int(0.01 * SR)


# ---------------------------------------------------------------------------
# Pops, bubbles, taps
# ---------------------------------------------------------------------------

POP_NOTES = [659.3, 784.0, 880.0, 987.8]  # E5 G5 A5 B5


def s_pop(seed=0, note=784.0):
    """Premium bubbly pop: quick upward pitch 'bloop' + soft tick, rounded."""
    n = int(0.22 * SR)
    t = np.arange(n) / SR
    f = note * (0.62 + 0.38 * (1 - np.exp(-t / 0.010)))
    body = tone(f, n) * env_exp(n, 0.045, 0.0015)
    body += 0.18 * tone(f * 2, n) * env_exp(n, 0.02, 0.0015)
    tick = bp(noise(n, seed), 1500, 5000) * env_exp(n, 0.0018, 0.0003) * 0.35
    x = soft_sat(body + tick, 1.2)
    st = widen(x, 0.2, seed)
    st = gentle(st, 7500)
    st = reverb(st, wet=0.12, decay_s=0.4)
    return finish(st)


def s_pop_soft(seed=0, note=784.0):
    """Softer bubble-bloop for icon appear: rounder attack, lower, gentle."""
    n = int(0.28 * SR)
    t = np.arange(n) / SR
    f = note * 0.75 * (0.55 + 0.45 * (1 - np.exp(-t / 0.018)))
    wob = 1 + 0.02 * np.sin(2 * np.pi * 28 * t) * np.exp(-t / 0.05)
    body = tone(f * wob, n) * env_exp(n, 0.06, 0.004)
    body += 0.1 * tone(f * 2.0, n) * env_exp(n, 0.03, 0.004)
    x = lp(body, 4000, 2)
    st = widen(x, 0.25, seed)
    st = reverb(st, wet=0.14, decay_s=0.45)
    return finish(st)


def s_bubble(seed=0):
    """Glass bubble appear: rising bloop with glassy partials + short glint."""
    n = int(0.6 * SR)
    t = np.arange(n) / SR
    f = 520 * (1 + 0.7 * (1 - np.exp(-t / 0.03)))
    body = tone(f, n) * env_exp(n, 0.07, 0.003)
    f1 = 1760.0
    glass = modal([f1, f1 * 2.32, f1 * 3.1], [0.35, 0.15, 0.06], [0.25, 0.12, 0.06], 0.6, seed)
    glass = at(glass, 0.02, n) * np.clip(t / 0.03, 0, 1)
    x = body * 0.8 + glass
    st = widen(x, 0.4, seed)
    st = gentle(st, 8000)
    st = reverb(st, wet=0.22, decay_s=0.7)
    return finish(st)


def s_type(seed=0):
    """Crisp modern low-profile key tick: bright click + small body + faint thock."""
    r = rng(seed)
    n = int(0.07 * SR)
    t = np.arange(n) / SR
    fb = r.uniform(1800, 2600)
    click = bp(noise(n, seed), 2200, 6000) * env_exp(n, 0.0012, 0.0001)
    body = modal([fb, fb * 1.6], [0.35, 0.12], [0.006, 0.004], 0.07, seed)
    thock = tone(r.uniform(260, 340) * (1 + 0.5 * np.exp(-t / 0.004)), n) * env_exp(n, 0.008, 0.0005) * 0.35
    rel = at(bp(noise(n, seed + 9), 2500, 5500) * env_exp(n, 0.0008, 0.0001) * 0.3, r.uniform(0.018, 0.026), n)
    x = click + body + thock + rel
    st = pan(x, r.uniform(-0.15, 0.15))
    st = gentle(st, 9000)
    st = reverb(st, wet=0.06, decay_s=0.25)
    return finish(st)


def s_caret(seed=0):
    """Tiny blink tick."""
    n = int(0.04 * SR)
    t = np.arange(n) / SR
    x = np.sin(2 * np.pi * 2400 * t) * env_exp(n, 0.004, 0.0003)
    x += bp(noise(n, seed), 3000, 6000) * env_exp(n, 0.0006, 0.0001) * 0.3
    return finish(lp(x, 8000))


def s_tap(seed=0):
    """iOS-like UI tap: short rounded 'tk' with a tiny pitched body."""
    n = int(0.08 * SR)
    t = np.arange(n) / SR
    body = tone(1150 * (1 + 0.25 * np.exp(-t / 0.002)), n) * env_exp(n, 0.009, 0.0004)
    click = bp(noise(n, seed), 1500, 5000) * env_exp(n, 0.0008, 0.0001) * 0.5
    low = tone(330, n) * env_exp(n, 0.006, 0.0005) * 0.3
    st = pan(body + click + low, 0.0)
    st = gentle(st, 8000)
    st = reverb(st, wet=0.06, decay_s=0.25)
    return finish(st)


def s_click(seed=0):
    """Satisfying UI click (softened from the film)."""
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    snap = bp(noise(n, seed), 2500, 6500) * env_exp(n, 0.0009, 0.0001) * 0.9
    body = np.sin(2 * np.pi * 1500 * t) * env_exp(n, 0.010, 0.0003) * 0.45
    low = tone(260 * np.exp(-t / 0.01) + 140, n) * env_exp(n, 0.012, 0.0005) * 0.6
    st = pan(snap + body + low, 0.0)
    st = hp(gentle(st, 8000), 150, 2)
    st = reverb(st, wet=0.08, decay_s=0.3)
    return finish(st)


def s_toggle(seed=0):
    """Switch: small slide + two-step click, second higher (on)."""
    n = int(0.16 * SR)
    t = np.arange(n) / SR

    def k(f, s):
        m = int(0.06 * SR)
        tm = np.arange(m) / SR
        return (np.sin(2 * np.pi * f * tm) * env_exp(m, 0.008, 0.0003) * 0.6
                + bp(noise(m, s), 2000, 6000) * env_exp(m, 0.0008, 0.0001) * 0.5)
    x = at(k(900, seed), 0.0, n) * 0.7 + at(k(1400, seed + 1), 0.045, n)
    slide = bp(noise(n, seed + 2), 1500, 4000) * np.exp(-((t - 0.022) / 0.012) ** 2) * 0.08
    st = pan(x + slide, 0.0)
    st = gentle(st, 8000)
    st = reverb(st, wet=0.08, decay_s=0.3)
    return finish(st)


# ---------------------------------------------------------------------------
# Chimes / notifications
# ---------------------------------------------------------------------------

def bell(f, dur, seed=0, bright=1.0, tau=0.35):
    return modal([f, f * 2.0, f * 3.0, f * 4.16], [1, 0.25 * bright, 0.08 * bright, 0.04 * bright],
                 [tau, tau * 0.5, tau * 0.3, tau * 0.18], dur, seed) * np.clip(tt(dur) / 0.002, 0, 1)


def s_success(seed=0):
    """Bright 3-note ascending chime (C6 E6 G6 + C7 shimmer)."""
    dur = 1.3
    n = int(dur * SR)
    notes = [(1046.5, 0.0, -0.3), (1318.5, 0.085, 0.0), (1568.0, 0.17, 0.3)]
    st = np.zeros((n, 2))
    for i, (f, o, p) in enumerate(notes):
        b = bell(f, dur - o, seed + i, 0.8, 0.28 + 0.1 * i)
        st += at(pan(b, p), o, n) * (0.8 + 0.1 * i)
    st += at(pan(bell(2093.0, dur - 0.17, seed + 9, 0.3, 0.25), 0.0), 0.17, n) * 0.18
    st = gentle(st, 8000)
    st = reverb(st, wet=0.25, decay_s=0.9)
    return finish(st)


def s_notify(seed=0):
    """Tasteful phone notification: two soft marimba-glass notes (A5 -> E6)."""
    dur = 1.0
    n = int(dur * SR)

    def note(f, s):
        m = int(0.9 * SR)
        x = modal([f, f * 3.98, f * 2.0], [1, 0.12, 0.15], [0.22, 0.03, 0.12], 0.9, s)
        x *= np.clip(tt(0.9) / 0.003, 0, 1)
        return x
    x = at(note(880.0, seed), 0.0, n) * 0.8 + at(note(1318.5, seed + 1), 0.11, n)
    st = widen(x, 0.3, seed)
    st = gentle(st, 7000)
    st = reverb(st, wet=0.2, decay_s=0.7)
    return finish(st)


def s_scan(seed=0):
    """Scanner: soft shimmering sweep (0-0.55 s) + confirm double-beep (0.62 s)."""
    dur = 1.1
    n = int(dur * SR)
    t = np.arange(n) / SR
    sw_n = int(0.55 * SR)
    u = np.linspace(0, 1, sw_n)
    f = 700 + 1500 * u
    env = np.sin(np.pi * u) ** 1.5
    sweep = (0.5 * tone(f, sw_n) * (1 + 0.3 * np.sin(2 * np.pi * 30 * u * 0.55))
             + svf(noise(sw_n, seed), f * 2, 3.0, "bp") * 0.6) * env * 0.5
    sweep_st = pan(sweep, -0.6 + 1.2 * u)

    def beep(f, m):
        tm = np.arange(m) / SR
        return (np.sin(2 * np.pi * f * tm) + 0.15 * np.sin(2 * np.pi * 2 * f * tm)) * env_ar(m, 0.003, m / SR - 0.003, 1.5)
    b = at(beep(1760.0, int(0.06 * SR)), 0.62, n) + at(beep(2349.3, int(0.12 * SR)), 0.71, n)
    st = pad(sweep_st, n) + pan(b * 0.55, 0.0)
    st = gentle(st, 6000)
    st = reverb(st, wet=0.14, decay_s=0.45)
    return finish(st)


def s_shutter(seed=0):
    """Camera shutter: two soft mechanical clicks with a short air burst."""
    n = int(0.25 * SR)
    t = np.arange(n) / SR

    def clk(s, lo, hi, tau):
        return bp(noise(n, s), lo, hi) * env_exp(n, tau, 0.0002)
    a = clk(seed, 1200, 5500, 0.004) + tone(420, n) * env_exp(n, 0.008, 0.0005) * 0.4
    b = clk(seed + 1, 900, 4500, 0.006) + tone(320, n) * env_exp(n, 0.012, 0.0005) * 0.35
    air = bp(noise(n, seed + 2), 1500, 5000) * np.exp(-((t - 0.04) / 0.02) ** 2) * 0.12
    x = a + at(b, 0.075, n) * 0.85 + air
    st = widen(x, 0.2, seed)
    st = gentle(st, 8000)
    st = reverb(st, wet=0.08, decay_s=0.3)
    return finish(st)


# ---------------------------------------------------------------------------
# Drag / drop / paper
# ---------------------------------------------------------------------------

def s_drag(seed=0):
    """Pick-up: soft upward 'fwip' lift with a tiny tick."""
    n = int(0.2 * SR)
    t = np.arange(n) / SR
    u = t / t[-1]
    f = 380 * 2 ** (u * 0.8)
    body = tone(f, n) * np.sin(np.pi * np.clip(u / 0.7, 0, 1)) ** 2 * 0.5
    air = svf(noise(n, seed), 1200 + 2500 * u, 1.3, "bp") * np.sin(np.pi * u) ** 2 * 0.5
    tick = bp(noise(n, seed + 1), 2000, 5000) * env_exp(n, 0.0008, 0.0001) * 0.4
    st = pan(body + air + tick, 0.0)
    st = gentle(st, 7500)
    st = reverb(st, wet=0.1, decay_s=0.3)
    return finish(st)


def s_drop(seed=0):
    """Put-down plop: downward rounded 'bup' + soft thud."""
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    f = 200 + 380 * np.exp(-t / 0.018)
    body = tone(f, n) * env_exp(n, 0.05, 0.001)
    body += 0.2 * tone(f * 2.02, n) * env_exp(n, 0.02, 0.001)
    thud = lp(noise(n, seed), 500) * env_exp(n, 0.012, 0.0008) * 0.6
    tick = bp(noise(n, seed + 1), 1500, 4500) * env_exp(n, 0.001, 0.0001) * 0.25
    x = soft_sat(body + thud + tick, 1.2)
    st = widen(x, 0.15, seed)
    st = hp(gentle(st, 7000), 110, 2)
    st = reverb(st, wet=0.1, decay_s=0.35)
    return finish(st)


def s_paper(seed=0):
    """Card sliding on paper: soft friction hiss with fine grains, ends in a light settle."""
    dur = 0.45
    n = int(dur * SR)
    u = np.linspace(0, 1, n)
    e = np.sin(np.pi * np.clip(u / 0.85, 0, 1)) ** 1.2
    hiss = svf(pink(n, seed), 1800 + 1200 * u, 0.8, "bp") * 0.6
    gr = grains(n, lambda v: 60 + 200 * np.sin(np.pi * v), seed + 1, 1500, 5500, (0.001, 0.006)) * 0.8
    x = (hiss + gr) * e
    settle = at(bp(noise(int(0.05 * SR), seed + 2), 800, 3500) * env_exp(int(0.05 * SR), 0.004, 0.0005), 0.38, n) * 0.4
    st = pan(x + settle, 0.3 - 0.6 * u)
    st = gentle(st, 7000)
    st = reverb(st, wet=0.08, decay_s=0.3)
    st, _ = finish(st, fin=0.004)
    return st, 0


# ---------------------------------------------------------------------------
# Magic / glass / impacts
# ---------------------------------------------------------------------------

def s_sparkle(seed=0):
    """Magic twinkle: quick cascade of soft bell grains, gently falling."""
    dur = 1.0
    n = int(dur * SR)
    notes = [1568.0, 1760.0, 2093.0, 2349.3, 2637.0, 3136.0, 3520.0]
    sp = sparkle(n, seed, lambda v: 55 * np.exp(-v * 3.5) + 2, notes,
                 amp_fn=lambda v: np.exp(-v * 2.5), dec=(0.04, 0.18),
                 pan_fn=lambda v: -0.5 + v)
    head = pan(bell(2637.0, dur, seed + 5, 0.4, 0.2), 0.0) * 0.5
    st = sp * 0.6 + head
    st = gentle(st, 6000)
    st = reverb(st, wet=0.3, decay_s=0.9, predelay_s=0.015)
    return finish(st)


def s_glass_ting(seed=0):
    """Champagne glass ting: thin inharmonic partials with slow beating."""
    dur = 2.0
    n = int(dur * SR)
    t = tt(dur)
    f0 = 1480.0
    x = modal([f0, f0 * 2.61, f0 * 4.9, f0 * 1.003], [1, 0.35, 0.08, 0.6], [0.9, 0.35, 0.12, 0.8], dur, seed)
    strike = bp(noise(n, seed), 2500, 7000) * env_exp(n, 0.0015, 0.0001) * 0.4
    x = (x + strike) * np.clip(t / 0.0008, 0, 1)
    st = widen(x, 0.3, seed)
    st = gentle(st, 9000)
    st = reverb(st, wet=0.28, decay_s=1.1)
    return finish(st)


def s_impact_soft(seed=0):
    """Soft cinematic hit: sub thump + airy bloom, no crack."""
    dur = 1.4
    n = int(dur * SR)
    t = np.arange(n) / SR
    sub = tone(52 + 60 * np.exp(-t / 0.04), n) * env_exp(n, 0.35, 0.003)
    sub = soft_sat(sub, 1.6)  # harmonics so it reads on small speakers
    knock = lp(noise(n, seed), 900) * env_exp(n, 0.03, 0.002) * 0.4
    air = bp(pink(n, seed + 1), 400, 5000) * env_exp(n, 0.22, 0.006) * 0.3
    st = pan(sub * 0.9 + knock, 0.0) + widen(air, 0.8, seed)
    st = gentle(st, 7000)
    st = reverb(st, wet=0.22, decay_s=1.2, predelay_s=0.01)
    return finish(st)


def s_logo_shimmer(seed=0, dur=1.5):
    """Warm magical shimmer swell (gold, pentatonic), onset on the cue."""
    n = int(dur * SR)
    u = np.linspace(0, 1, n)
    t = np.arange(n) / SR
    notes = [784.0, 880.0, 1046.5, 1174.7, 1318.5, 1568.0, 1760.0, 2093.0, 2637.0]
    sw = lambda v: np.sin(np.pi * np.clip(v / 0.95, 0, 1)) ** 1.0
    sp = sparkle(n, seed, lambda v: 10 + 55 * sw(v), notes, amp_fn=sw, dec=(0.08, 0.45),
                 pan_fn=lambda v: -0.7 + 1.4 * v)
    padx = np.zeros(n)
    for f in (523.25, 659.3, 784.0, 1046.5):
        for d in (-0.0025, 0.0025):
            padx += np.sin(2 * np.pi * f * (1 + d) * t + seed + f)
    swell = sw(u) ** 1.5
    padst = widen(padx * swell * 0.08, 0.7, seed)
    air = svf(noise(n, seed + 3), 3000 + 2500 * u, 0.8, "bp") * swell * 0.07
    st = sp * 0.45 + padst + widen(air, 0.8, seed + 1)
    st = gentle(st, 8000)
    st = reverb(st, wet=0.4, decay_s=1.5, predelay_s=0.02)
    st, _ = finish(st, fin=0.01)
    return st, 0


def s_bass_drop(seed=0):
    """Cinematic sub drop: 110 -> 32 Hz glide with warm harmonics + air."""
    dur = 2.0
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 32 + 78 * np.exp(-t / 0.35)
    x = tone(f, n) * env_exp(n, 0.7, 0.004)
    x = soft_sat(x * 1.2, 2.0)  # 2nd/3rd harmonics for phone speakers
    x += 0.15 * tone(f * 2, n) * env_exp(n, 0.4, 0.004)
    air = bp(pink(n, seed), 200, 3000) * env_exp(n, 0.25, 0.01) * 0.12
    st = pan(lp(x, 400, 2), 0.0) + widen(air, 0.8, seed)
    st = reverb(st, wet=0.12, decay_s=1.0)
    return finish(st)


# ---------------------------------------------------------------------------

# name -> (generator, peak level dBFS in library; relative balance for gain=1)
LIB = {
    "whoosh": (lambda: s_whoosh(1), -6),
    "whoosh_short": (lambda: s_whoosh_short(2), -8),
    "swish": (lambda: s_swish(3), -9),
    "swipe": (lambda: s_swipe(4), -11),
    "riser": (lambda: s_riser(5), -7),
    "tap": (lambda: s_tap(6), -12),
    "click": (lambda: s_click(7), -12),
    "toggle": (lambda: s_toggle(8), -12),
    "caret": (lambda: s_caret(9), -26),
    "success": (lambda: s_success(10), -9),
    "notify": (lambda: s_notify(11), -9),
    "scan": (lambda: s_scan(12), -11),
    "shutter": (lambda: s_shutter(13), -11),
    "drag": (lambda: s_drag(14), -13),
    "drop": (lambda: s_drop(15), -10),
    "bubble": (lambda: s_bubble(16), -10),
    "sparkle": (lambda: s_sparkle(17), -10),
    "impact_soft": (lambda: s_impact_soft(18), -4),
    "glass_ting": (lambda: s_glass_ting(19), -11),
    "paper": (lambda: s_paper(20), -13),
    "logo_shimmer": (lambda: s_logo_shimmer(21), -7),
    "bass_drop": (lambda: s_bass_drop(22), -3),
}
for i, f in enumerate(POP_NOTES):
    LIB[f"pop_{i+1}"] = (lambda f=f, i=i: s_pop(100 + i, f), -9)
    LIB[f"pop_soft_{i+1}"] = (lambda f=f, i=i: s_pop_soft(200 + i, f), -11)
for i in range(6):
    LIB[f"type_{i+1}"] = (lambda i=i: s_type(300 + i), -15)
ALIASES = {"pop": "pop_1", "pop_soft": "pop_soft_1", "type": "type_1"}


def build(qc=False):
    os.makedirs(SFX_DIR, exist_ok=True)
    offsets, out = {}, {}
    for name, (gen, lvl) in LIB.items():
        st, anchor = gen()
        st = trim_rel(st, -62)
        st = normalize(st, lvl)
        sf.write(os.path.join(SFX_DIR, name + ".wav"), st.astype(np.float32), SR, subtype="PCM_24")
        offsets[name] = round(anchor / SR, 4)
        out[name] = st
    for a, src in ALIASES.items():
        sf.write(os.path.join(SFX_DIR, a + ".wav"), out[src].astype(np.float32), SR, subtype="PCM_24")
        offsets[a] = offsets[src]
        out[a] = out[src]
    with open(os.path.join(SFX_DIR, "offsets.json"), "w") as fh:
        json.dump(dict(sorted(offsets.items())), fh, indent=1)
    for k in sorted(out):
        x = out[k]
        print(f"{k:14s} {x.shape[0]/SR:5.2f}s  anchor {offsets[k]:.3f}s  "
              f"peak {20*np.log10(np.abs(x).max()):6.1f} dB  rms {10*np.log10(np.mean(x**2)+1e-12):6.1f} dB  "
              f"centroid {centroid(x):5.0f} Hz  >6k {hf_ratio(x):4.1f}%  <200 {lf_ratio(x):4.1f}%")
    if qc:
        run_qc(out, offsets)


def _spec(x):
    m = x.mean(axis=1)
    S = np.abs(np.fft.rfft(m * np.hanning(len(m)))) ** 2
    fr = np.fft.rfftfreq(len(m), 1 / SR)
    return fr, S


def centroid(x):
    fr, S = _spec(x)
    return float((fr * S).sum() / S.sum())


def hf_ratio(x):
    fr, S = _spec(x)
    return 100 * S[fr > 6000].sum() / S.sum()


def lf_ratio(x):
    fr, S = _spec(x)
    return 100 * S[fr < 200].sum() / S.sum()


def run_qc(out, offsets):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    os.makedirs(QC_DIR, exist_ok=True)
    names = [k for k in sorted(out) if k not in ALIASES]
    cols = 5
    rows = int(np.ceil(len(names) / cols))
    fig, axs = plt.subplots(rows, cols, figsize=(cols * 4, rows * 2.6))
    for ax, k in zip(axs.flat, names):
        m = out[k].mean(axis=1)
        ax.specgram(m, NFFT=1024, Fs=SR, noverlap=768, cmap="magma", vmin=-140, vmax=-40)
        ax.set_ylim(0, 12000)
        ax.axvline(offsets[k], color="c", lw=0.8)
        ax.set_title(k, fontsize=9)
        ax.tick_params(labelsize=6)
    for ax in list(axs.flat)[len(names):]:
        ax.axis("off")
    fig.tight_layout()
    p = os.path.join(QC_DIR, "sfx_library_spectrograms.png")
    fig.savefig(p, dpi=80)
    print("wrote", p)


if __name__ == "__main__":
    build(qc="--qc" in sys.argv)
