#!/usr/bin/env python3
"""'Chapters' — The Wedding Chapter launch film: original score.

Renders film/audio/stems/music.wav (48 kHz stereo, exactly 60.000 s) plus an
mp3 preview. Everything is synthesized from scratch (see core/instruments/
drums/fx). Run:  python3 film/audio/music/compose.py

Form (120 BPM, bar = 2 s):
  S1  0.0-14.0  MEET + MONTAGE   (C major)  music-box love theme -> playful groove -> 13.6 hit -> tape-stop 14.0
  S2 14.0-29.8  PLANNING + CHAOS (C minor, climbing)  14.3 ominous hit, drone, accelerating glitch chaos, dead stop 29.8
  S3 30.0-52.0  TURN + ANTHEM + WEDDING  celesta 30.0, anthem drop 32.0 (C), hits 42/43/44 (F-G-A), key lift to D at 46, climax 51.2
  S4 52.0-60.0  REWIND + LOGO    tape-rewind 52-54, warm Dmaj9 chord 54.0, music-box reprise, resolved D at 58.5
"""
import os
import sys
import subprocess
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from core import (SR, N_TOTAL, T, ns, m, hz, mtof, tarr, undb, to_stereo, automation,  # noqa: E402
                  butter, biquad, svf, softclip, reseed, fade_edges, normalize, rng, dcblock)
import instruments as I  # noqa: E402
import drums as D  # noqa: E402
import fx  # noqa: E402

STEMS = os.path.normpath(os.path.join(HERE, '..', 'stems'))
OUT_WAV = os.path.join(STEMS, 'music.wav')
OUT_MP3 = os.path.join(STEMS, 'music_preview.mp3')

# ------------------------------------------------------------------- the theme
# Love theme (in C): E5 G5 C6 B5 | A5 G5 E5 G5 | F5 A5 D6 C6 | B5 G5 C6 -
THEME = [4, 7, 12, 11, 9, 7, 4, 7, 5, 9, 14, 12, 11, 7, 12]
THEME_MIN = [3, 7, 12, 11, 8, 7, 3, 7, 5, 8, 14, 12, 11, 7, 12]


def theme(tonic, t0, step, minor=False, idx=range(15)):
    """[(time, midi, dur)] for the love theme starting at t0 with given step."""
    src = THEME_MIN if minor else THEME
    out = []
    for i in idx:
        dur = step * (2 if i == 14 else 1)
        out.append((t0 + i * step, m(tonic) + src[i], dur))
    return out


VOIC = {
    'C': ['C3', 'G3', 'C4', 'E4', 'G4'], 'Am': ['A2', 'E3', 'A3', 'C4', 'E4'],
    'F': ['F2', 'C3', 'F3', 'A3', 'C4'], 'G': ['G2', 'D3', 'G3', 'B3', 'D4'],
    'Gsus': ['G2', 'D3', 'G3', 'C4', 'D4'],
    'D': ['D3', 'A3', 'D4', 'F#4', 'A4'], 'Bm': ['B2', 'F#3', 'B3', 'D4', 'F#4'],
    'A': ['A2', 'E3', 'A3', 'C#4', 'E4'], 'Asus': ['A2', 'E3', 'A3', 'D4', 'E4'],
}
ROOT = {'C': 'C2', 'Am': 'A1', 'F': 'F1', 'G': 'G1', 'Gsus': 'G1', 'D': 'D2', 'Bm': 'B1',
        'A': 'A1', 'Asus': 'A1'}


def up(notes, semis):
    return [m(n) + semis for n in notes]


# ------------------------------------------------------------ mixing classes
class Track:
    def __init__(self, sec, name, gain_db=0.0, sends=None, post=None):
        self.sec, self.name = sec, name
        self.gain = undb(gain_db)
        self.sends = sends or {}
        self.post = post or []
        self.buf = np.zeros((sec.n, 2))

    def add(self, t, sig, db=0.0, pan=0.0):
        st = to_stereo(np.asarray(sig, dtype=float), pan) * undb(db)
        i0 = ns(t - self.sec.t0)
        if i0 < 0:
            st, i0 = st[-i0:], 0
        L = min(len(st), self.sec.n - i0)
        if L > 0:
            self.buf[i0:i0 + L] += st[:L]


class Section:
    def __init__(self, name, t0, t1, tail=3.0):
        self.name, self.t0, self.t1 = name, t0, t1
        self.n = ns(t1 - t0 + tail)
        self.tracks = {}
        self.returns = {}

    def tr(self, name, gain_db=0.0, sends=None, post=None):
        if name not in self.tracks:
            self.tracks[name] = Track(self, name, gain_db, sends, post)
        return self.tracks[name]

    def auto(self, points, log=False):
        return automation(self.n, points, t0=self.t0, log=log)

    def render(self, irs, ret_db=None):
        ret_db = ret_db or {}
        dry = np.zeros((self.n, 2))
        buses = {k: np.zeros((self.n, 2)) for k in irs}
        for trk in self.tracks.values():
            x = trk.buf * trk.gain
            for f in trk.post:
                x = f(x)
            dry += x
            for k, v in trk.sends.items():
                buses[k] += x * v
        out = dry
        for k, b in buses.items():
            if np.any(b):
                out = out + fx.convolve(b, irs[k]) * undb(ret_db.get(k, 0.0))
        return out


def sc(sec, kicks, depth=0.6, release=0.16):
    return lambda x: x * fx.sidechain_gain(len(x), sec.t0, kicks, depth, 0.004, release)[:, None]


def pp(delay=0.375, fb=0.42, mix=0.35, lp=3800):
    return lambda x: fx.pingpong(x, delay, fb, 6, lp, 350, mix)


def chorus(mix=0.35):
    return lambda x: fx.chorus(x, mix=mix)


def eq(kind, f, q=0.707, g=0.0):
    return lambda x: biquad(x, kind, f, q, g)


def autogain(sec, points):
    return lambda x: x * sec.auto(points)[:, None]


# =================================================================== SECTION 1
def section_meet(irs):
    S = Section('meet', 0.0, 14.0, tail=0.6)
    kicks = []
    pad = S.tr('pad', -22, {'hall': 0.35}, [chorus(0.3), eq('peak', 250, 0.8, -3)])
    mbox = S.tr('mbox', -11, {'hall': 0.35, 'plate': 0.2})
    pz = S.tr('pizz', -12, {'room': 0.25, 'hall': 0.12})
    harp = S.tr('harp', -13, {'hall': 0.4})
    cel = S.tr('cel', -16, {'hall': 0.45, 'plate': 0.1})
    kick = S.tr('kick', -7, {'room': 0.04})
    perc = S.tr('perc', -15, {'room': 0.18, 'plate': 0.06})
    bassT = S.tr('bass', -11, {}, [sc(S, kicks, 0.35, 0.1)])
    mar = S.tr('marimba', -10, {'room': 0.2, 'plate': 0.12})
    arp = S.tr('arp', -22, {'hall': 0.15}, [pp(0.375, 0.4, 0.4)])
    strg = S.tr('strings', -15, {'hall': 0.3})
    fxT = S.tr('fx', -14, {'hall': 0.25})
    hit = S.tr('hit', -8, {'hall': 0.3})

    # ---- intro bloom (1.0): reversed celesta swell -> harp gliss + pad + sparkle
    swell = np.zeros(ns(0.62))
    for nn in ('C6', 'G6'):
        c = I.celesta(nn, 0.62)
        swell += c
    swell = swell[::-1] * np.linspace(0, 1, len(swell)) ** 2
    cel.add(1.0 - 0.62, fade_edges(swell, 0.01, 0.004), -6)
    gl = ['C4', 'E4', 'G4', 'A4', 'C5', 'D5', 'E5', 'G5', 'A5', 'C6', 'D6', 'E6']
    for i, nn in enumerate(gl):
        harp.add(1.0 + i * 0.042, I.harp(nn, 3.0, 0.6 + 0.03 * i), -4 + 0.3 * i,
                 pan=-0.5 + i / len(gl))
    cel.add(1.0, I.celesta('C7', 2.0), -10, 0.3)
    cel.add(1.5, I.glock('G6', 2.0, 0.6), -14, -0.3)
    pad.add(1.0, I.supersaw(['C3', 'G3', 'D4', 'E4'], 2.6, a=0.35, gate=2.0, r=0.6,
                            cutoff_env=[(0, 350), (1.0, 2200), (2.6, 1400)]), 0)
    for t0, name in ((3.0, 'Am'), (4.0, 'F'), (5.0, 'Gsus')):
        v = {'Am': ['A2', 'E3', 'G3', 'C4'], 'F': ['F2', 'C3', 'E3', 'A3'],
             'Gsus': ['G2', 'D3', 'G3', 'C4']}[name]
        pad.add(t0, I.supersaw(v, 1.6, a=0.15, gate=1.0, r=0.5, cutoff=1500), 0)

    # ---- love theme on music box (curious), pizzicato walking underneath
    for i, (t, mi, d) in enumerate(theme('C5', 2.0, 0.25)):
        vel = 0.8 + 0.2 * (i % 2 == 0)
        mbox.add(t, I.musicbox(mi, 2.4 if i == 14 else 1.6, vel), -1 + 1.5 * (i % 2 == 0), 0.12)
    for t, nn in ((2.0, 'C3'), (2.5, 'G3'), (3.0, 'A2'), (3.5, 'E3'), (4.0, 'F2'), (4.5, 'C3'),
                  (5.0, 'G2'), (5.5, 'G2'), (5.625, 'A2'), (5.75, 'B2'), (5.875, 'D3')):
        pz.add(t, I.pizz(nn, 0.7), -2 if t < 5.5 else -4 + (t - 5.5) * 10, -0.15)
    for t, ch in ((2.75, ['E4', 'G4']), (3.75, ['C4', 'E4']), (4.75, ['A3', 'C4']),
                  (5.25, ['B3', 'D4'])):
        for nn in ch:
            pz.add(t, I.pizz(nn, 0.5, 0.6), -10, 0.35)
    for i, t in enumerate(np.arange(4.0, 6.0, 0.25)):
        perc.add(t, D.shaker(), -14 + i * 1.1 - 4 * (i % 2), 0.3)
    fxT.add(6.0 - 1.2, D.reverse_cymbal(1.2), -8)

    # ---- montage groove (6.0-12.0), chords per half bar: C Am F G
    chords = [('C', 6.0), ('Am', 7.0), ('F', 8.0), ('G', 9.0), ('C', 10.0), ('Am', 11.0)]
    fxT.add(6.0, D.crash(2.5, 1.8), -8, 0.3)
    for b in range(3, 6):
        tb = T(b)
        ks = [0, 6, 8] + ([11] if b == 4 else []) + ([14] if b == 3 else [])
        for s in ks:
            kick.add(tb + s * 0.125, D.kick('punch'), 0 if s in (0, 8) else -3)
            kicks.append(tb + s * 0.125)
        for s in (4, 12):
            perc.add(tb + s * 0.125, D.clap(), 5, 0)
            perc.add(tb + s * 0.125, D.snare(tone=210), -2)
        for s in range(16):
            if b == 5 and s >= 12:
                break
            if s % 4 == 2:
                perc.add(tb + s * 0.125, D.hat(False), 0, 0.25)
            perc.add(tb + s * 0.125, D.shaker(), -4 - 3 * (s % 2), 0.4)
    for i, (t, f) in enumerate(((11.5, 200), (11.625, 170), (11.75, 140), (11.875, 115))):
        perc.add(t, D.tom(f), 3, -0.4 + 0.25 * i)
    for name, t0 in chords:
        r = m(ROOT[name])
        for s, off, dur, g in ((0, 0, 0.22, 0), (3, 12, 0.1, -4), (4, 0, 0.22, -1),
                               (6, 7, 0.1, -4), (7, 12, 0.09, -5)):
            bassT.add(t0 + s * 0.125, I.bass(r + off, dur + 0.05, gate=dur, cut_hi=1500, decay=0.08), g)
            if s in (0, 4):
                bassT.add(t0 + s * 0.125, I.kspluck(r + 24, 0.3, 0.5, 0.3), g - 9)
        pad.add(t0, I.supersaw(VOIC[name][1:], 1.3, a=0.02, gate=0.95, r=0.3, cutoff=1300), -3)
        tones = [m(x) + 24 for x in VOIC[name][1:4]]
        for s in range(8):
            nn = tones[[0, 1, 2, 1, 2, 0, 1, 2][s]] + (12 if s in (2, 4) else 0)
            arp.add(t0 + s * 0.125, I.kspluck(nn, 0.4, 0.9, 0.5), -2 * (s % 2), 0.5 if s % 2 else -0.5)
    # marimba theme 6-10, then first half again 10-12 with glock doubling
    for t, mi, d in theme('C5', 6.0, 0.25):
        mar.add(t, I.marimba(mi, 1.2), 0, -0.1)
    for t, mi, d in theme('C5', 10.0, 0.25, idx=range(8)):
        mar.add(t, I.marimba(mi, 1.2), 0, -0.1)
        cel.add(t, I.glock(mi + 12, 1.5, 0.8), 0, 0.25)

    # ---- the question (12.0-13.6): breakdown, tremolo strings, roll, riser
    for t, mi, d in theme('C5', 12.0, 0.25, idx=range(8, 12)):
        cel.add(t, I.glock(mi, 1.5, 0.8), 2, 0.2)
        mar.add(t, I.marimba(mi, 1.0, 0.7), -4, -0.1)
    cel.add(13.0, I.glock('B5', 1.0, 0.8), 2, 0.2)
    strg.add(12.0, I.strings(['F3', 'A3', 'C4', 'G4'], 1.2, a=0.4, gate=1.0, r=0.2, trem=12), 0)
    strg.add(13.0, I.strings(['G3', 'B3', 'D4', 'G4', 'B4'], 0.8, a=0.3, gate=0.6, r=0.05, trem=16), 2)
    bassT.add(12.0, I.bass('F1', 1.0, gate=0.95, cut_hi=900, cut_lo=300, decay=0.5), -2)
    bassT.add(13.0, I.bass('G1', 0.6, gate=0.55, cut_hi=900, cut_lo=300, decay=0.5), -2)
    for t in (12.0, 12.5, 13.0, 13.25):
        kick.add(t, D.kick('soft'), -2)
    for t in (12.0, 12.25, 12.5, 12.75, 13.0, 13.125, 13.25, 13.375):
        nn = 'F3' if t < 13 else 'G3'
        pz.add(t, I.pizz(m(nn) + (12 if (t * 4) % 2 else 0), 0.4), -6 + (t - 12) * 4, 0.2)
    for i, t in enumerate(D.roll_times(13.0, 13.55, 8, 26)):
        perc.add(t, D.snare(0.2, 230, 1.0), -14 + i * 1.3, 0)
    fxT.add(12.4, D.riser(1.2, 400, 9000, True, 2.2, 200, 800), -4)

    # ---- 13.6 BIG HIT (confetti): C major everything, then tape-stop at 14.0
    hit.add(13.6, D.impact(1.0, 110, 40), -2)
    hit.add(13.6, I.brass(['C3', 'G3', 'C4', 'E4', 'G4'], 0.6, gate=0.4, bright=1.2), -2)
    hit.add(13.6, I.supersaw(VOIC['C'] + ['C5'], 0.6, a=0.005, gate=0.4, r=0.3, cutoff=5000), -4)
    hit.add(13.6, I.bass('C2', 0.5, gate=0.4, cut_hi=2000, decay=0.2), -2)
    fxT.add(13.6, D.crash(1.0, 2.0), 0, 0.2)
    kick.add(13.6, D.kick('big'), 0)
    for i, nn in enumerate(['C6', 'E6', 'G6', 'C7', 'E7', 'G7']):
        cel.add(13.6 + i * 0.05, I.glock(nn, 0.8, 0.8), 1, -0.6 + 0.24 * i)
    mbox.add(13.6, I.musicbox('C6', 0.6), -2)

    x = S.render(irs)
    x = fx.tapestop(x, S.t0, 13.86, 14.04, power=1.4)
    return S, x


# =================================================================== SECTION 2
def section_chaos(irs):
    S = Section('chaos', 14.0, 29.8, tail=0.3)
    kicks = []
    hit = S.tr('hit', -6, {'huge': 0.45})
    drone = S.tr('drone', -14, {'hall': 0.3})
    tk = S.tr('tick', -18, {'room': 0.3})
    kick = S.tr('kick', -7, {'room': 0.03})
    perc = S.tr('perc', -16, {'room': 0.15})
    bassT = S.tr('bass', -13, {}, [sc(S, kicks, 0.3, 0.08)])
    crush_mix = S.auto([(16.0, 0.0), (22.0, 0.25), (28.0, 0.55), (29.8, 0.8)])
    leadT = S.tr('lead', -15, {'plate': 0.18, 'hall': 0.1},
                 [lambda x: x * (1 - crush_mix[:, None]) + fx.bitcrush(x, 6, 3) * crush_mix[:, None]])
    wob_depth = S.auto([(14, 5), (16.0, 12.0), (24.0, 35.0), (29.8, 70.0)])
    mboxT = S.tr('mbox', -14, {'hall': 0.3}, [lambda x: fx.wobble(x, wob_depth, 6.5, 5)])
    arpT = S.tr('arp', -19, {'plate': 0.12},
                [lambda x: x * (1 - crush_mix[:, None]) + fx.bitcrush(x, 5, 4) * crush_mix[:, None], pp(0.1875, 0.3, 0.2)])
    stab = S.tr('stab', -14, {'plate': 0.25}, [lambda x: fx.bitcrush(x, 7, 2, 0.5)])
    alarmT = S.tr('alarm', -26, {'plate': 0.2})
    strg = S.tr('strings', -18, {'hall': 0.2})
    fxT = S.tr('fx', -13, {'hall': 0.2})

    # ---- 14.3 ominous low hit + tension drone
    fxT.add(14.3 - 0.25, D.reverse_cymbal(0.25), -14)
    hit.add(14.3, I.brass(['C2', 'G2', 'C3', 'Db3', 'Gb3'], 2.2, gate=0.7, bright=0.55, scoop=1.5, drive=2.6, r=1.2), 0)
    hit.add(14.3, D.impact(2.4, 70, 26, 0.8), 0)
    hit.add(14.3, I.sub808('C1', 2.0, 2.2, 2.5, 2.4), -3)
    drone.add(14.5, I.supersaw(['C2', 'G2', 'C3', 'Db3'], 1.7, a=0.8, gate=1.5, r=0.2,
                               cutoff_env=[(0, 150), (1.5, 900)], sub=0.5), 0)
    strg.add(14.8, I.strings(['B5', 'C6'], 1.3, a=1.0, gate=1.2, r=0.1, trem=10, cutoff=5000), -2)
    for t, g in ((15.0, 0), (15.5, 0), (15.75, 1), (15.875, 2), (15.9375, 3)):
        tk.add(t, I.tick(1900), g, 0.4)
        tk.add(t, I.tick(1320, 0.06), g - 6, -0.4)
    fxT.add(15.3, D.riser(0.7, 500, 6000, False, 2.0), -10)

    # ---- theme statements and harmony map
    # (t_start, step, key offset, bass step, lead octave)
    stm = [(16.0, 0.25, 0, 0.25), (20.0, 0.125, 0, 0.25), (22.0, 0.125, 0, 0.25),
           (24.0, 0.125, 0, 0.125), (26.0, 0.125, 1, 0.125), (28.0, 0.0625, 2, 0.125),
           (29.0, 0.0625, 3, 0.125)]
    QUAL = [(0, [0, 3, 7]), (8, [8, 0, 3]), (5, [5, 8, 0]), (7, [7, 11, 2])]
    chord_map = []   # (t, root_pc, pcs)
    for t0, step, k, bstep in stm:
        for j, (r, pcs) in enumerate(QUAL):
            chord_map.append((t0 + 4 * step * j, (r + k) % 12, [(p + k) % 12 for p in pcs], 4 * step, bstep))

    for si, (t0, step, k, bstep) in enumerate(stm):
        u = (t0 - 16) / 13.8
        for i, (t, mi, d) in enumerate(theme('C5', t0, step, minor=True)):
            if t >= 29.8:
                break
            mi = mi + k
            leadT.add(t, I.glitch_lead(mi, max(d * 0.9, 0.05) + 0.05, 8 + 45 * u), -1 + 2 * (i % 4 == 0),
                      0.15 * np.sin(i))
            if si == 0:
                mboxT.add(t, I.musicbox(mi, 1.2), 0, -0.2)
            if si >= 3:
                leadT.add(t, I.glitch_lead(mi + 12, max(d * 0.9, 0.05) + 0.05, 15 + 45 * u), -7, -0.4)
    for (t, rpc, pcs, cd, bstep) in chord_map:
        root = 36 + rpc - (12 if rpc > 7 else 0)
        nsteps = int(round(cd / bstep))
        for s in range(nsteps):
            tt = t + s * bstep
            if tt >= 29.8:
                break
            nn = root + (12 if s % 2 else 0)
            bassT.add(tt, I.bass(nn, bstep * 0.9 + 0.03, gate=bstep * 0.85, cut_hi=2400, cut_lo=300,
                                 decay=0.06, drive=3.0), -1 * (s % 2))

    # ---- accelerating arpeggio: 4 notes/s at 16.0 -> 32 notes/s at 29.8
    t, idx = 16.0, 0
    while t < 29.78:
        u = (t - 16) / 13.8
        rate = 4 * 8 ** u
        cm_ = [c for c in chord_map if c[0] <= t + 1e-6][-1]
        pcs = cm_[2]
        pool = sorted({72 + 7 + ((p - 7) % 12) + o for p in pcs for o in (0, 12)})
        nn = pool[idx % len(pool)]
        det = rng().uniform(-1, 1) * (5 + 40 * u)
        f = float(mtof(nn)) * 2 ** (det / 1200)
        dur = min(0.25, 1.4 / rate) + 0.05
        arpT.add(t, I.kspluck(f, dur, 0.9, 0.25), -2 + 3 * u, 0.55 * (1 if idx % 2 else -1))
        idx += 1
        t += 1.0 / rate

    # ---- drums
    fx_crash = [16.0, 20.0, 24.0, 28.0]
    for tc in fx_crash:
        fxT.add(tc, D.crash(2.0, 1.6), -4, 0.3 if tc % 4 else -0.3)
    kick.add(16.0, D.kick('big'), 1)
    for b in range(8, 15):
        tb = T(b)
        if b <= 9:
            ks, cl, hats, hat16 = [0, 4, 8, 12], [4, 12], [2, 6, 10, 14], False
        elif b <= 11:
            ks, cl, hats, hat16 = [0, 4, 8, 12, 14], [4, 12], [2, 6, 10, 14], True
        elif b <= 13:
            ks, cl, hats, hat16 = [0, 3, 4, 8, 10, 12], [4, 12, 13, 15], [2, 6, 10, 14], True
        else:
            ks, cl, hats, hat16 = [0, 4, 8, 10, 12, 13, 14], [], [2, 6], True
        for s in ks:
            tt = tb + s * 0.125
            if tt < 29.8:
                kick.add(tt, D.kick('punch'), 0 if s % 4 == 0 else -3)
                kicks.append(tt)
        for s in cl:
            tt = tb + s * 0.125
            perc.add(tt, D.clap(), 4 if s in (4, 12) else -2)
            perc.add(tt, D.snare(0.3, 200), 1 if s in (4, 12) else -4)
        for s in range(16):
            tt = tb + s * 0.125
            if tt >= 29.8:
                break
            if s in hats:
                perc.add(tt, D.hat(True, 0.25) if b >= 12 else D.hat(False), -1, 0.3)
            elif hat16 or s % 2 == 0:
                perc.add(tt, D.hat(False), -6 - 2 * (s % 2), -0.3)
    for t0 in (25.5, 27.5):
        for i, f in enumerate((220, 185, 150, 120)):
            perc.add(t0 + i * 0.125, D.tom(f), 2, 0.5 - 0.33 * i)
    for i, t in enumerate(D.roll_times(28.0, 29.78, 8, 32, 0.8)):
        perc.add(t, D.snare(0.18, 230), -8 + 12 * (t - 28) / 1.8, 0.1 * np.sin(i))
    for tb in (16.0, 18.0, 20.0, 22.0, 24.0, 26.0, 28.0):
        rpc = [c for c in chord_map if c[0] <= tb + 1e-6][-1][1]
        hit.add(tb, I.sub808(24 + rpc, 1.2, 1.5, 2.0, 1.0), -10)

    # ---- alarm stabs, sirens, tension strings, riser
    for t in (17.75, 19.75, 21.5, 21.75, 23.5, 23.75, 25.25, 25.5, 25.75, 26.75, 27.0, 27.25,
              27.5, 27.75, 28.5, 29.0, 29.25, 29.5):
        k = 0 if t < 26 else (1 if t < 28 else (2 if t < 29 else 3))
        stab.add(t, I.brass(up(['C4', 'F#4', 'B4', 'F5'], k), 0.16, gate=0.1, bright=1.3, scoop=0.4,
                            drive=2.5, r=0.05), 0, 0.3 * (1 if (t * 4) % 2 else -1))
    alarmT.add(22.0, I.alarm(1397, 988, 1.9, 4), 0, -0.6)
    alarmT.add(26.0, I.alarm(1480, 1047, 1.9, 8), 1, 0.6)
    alarmT.add(28.0, I.alarm(1568, 1109, 1.78, 16), 2, -0.3)
    strg.add(24.0, I.strings(['C5', 'Db5', 'G5'], 2.2, a=1.5, gate=2.0, r=0.1, trem=14, cutoff=4000), 0)
    strg.add(26.0, I.strings(['Db5', 'D5', 'Ab5'], 2.1, a=0.5, gate=2.0, r=0.1, trem=18, cutoff=4500), 1)
    strg.add(28.0, I.strings(['D5', 'Eb5', 'A5', 'Bb5'], 1.85, a=0.3, gate=1.8, r=0.02, trem=24, cutoff=5000), 3)
    fxT.add(27.5, D.riser(2.3, 250, 11000, True, 2.2, 90, 1400), 0)

    x = S.render(irs)
    # glitch stutters (post-reverb: truly digital)
    for a, b, L, pu in ((19.75, 20.0, 0.0625, 0.0), (21.875, 22.0, 0.03125, 0.0),
                        (23.75, 24.0, 0.0625, 1.0), (25.75, 26.0, 0.03125, 0.0),
                        (27.75, 28.0, 0.0625, 2.0), (29.25, 29.5, 0.03125, 0.0),
                        (29.5, 29.8, 0.015625, 0.5)):
        fx.stutter(x, S.t0, a, b, L, pu)
    # dead stop at 29.8
    i1 = ns(29.8 - S.t0)
    k = ns(0.003)
    x[i1 - k:i1] *= np.linspace(1, 0, k)[:, None]
    x[i1:] = 0
    return S, x


# =================================================================== SECTION 3
def section_anthem(irs):
    S = Section('anthem', 30.0, 52.0, tail=2.0)
    kicks = []
    sideA = lambda d=0.55, r=0.16: sc(S, kicks, d, r)  # noqa: E731
    cel = S.tr('cel', -12, {'huge': 0.5, 'hall': 0.2})
    pad = S.tr('pad', -15, {'hall': 0.25}, [chorus(0.25), sideA(0.55)])
    kick = S.tr('kick', -6, {'room': 0.03})
    perc = S.tr('perc', -15, {'room': 0.12, 'plate': 0.05})
    bassT = S.tr('bass', -11, {}, [sideA(0.7, 0.12)])
    subT = S.tr('sub', -14, {}, [sideA(0.85, 0.14)])
    leadT = S.tr('lead', -12, {'plate': 0.18, 'hall': 0.12}, [pp(0.375, 0.38, 0.3)])
    glk = S.tr('glock', -17, {'hall': 0.3})
    arp = S.tr('arp', -22, {'hall': 0.12}, [pp(0.1875, 0.35, 0.3), sideA(0.3)])
    mar = S.tr('marimba', -13, {'room': 0.2})
    choirT = S.tr('choir', -19, {'hall': 0.35})
    strg = S.tr('strings', -17, {'hall': 0.3}, [sideA(0.35)])
    bells = S.tr('bells', -13, {'hall': 0.35})
    harp = S.tr('harp', -15, {'hall': 0.35})
    hit = S.tr('hit', -8, {'hall': 0.25})
    fxT = S.tr('fx', -12, {'hall': 0.2})

    # ---- 30.0 the turn: single celesta note, pad swell under narrator
    cel.add(30.0, I.celesta('G5', 4.0, 0.8), 0)
    harp.add(30.0, I.harp('G4', 3.0, 0.4), -10)
    pad.add(30.05, I.supersaw(['F2', 'C3', 'E3', 'G3', 'A3'], 1.93, a=1.7, d=1.0, s=1.0, gate=1.88, r=0.05,
                              cutoff_env=[(0, 250), (1.2, 900), (1.9, 2600)]), -2)
    fxT.add(32.0 - 1.1, D.reverse_cymbal(1.1), -9)

    # ---- ANTHEM 32-42 (C): C Am F G | C Am F G  (theme augmented, then in eighths)
    bars = [(32.0, 'C'), (34.0, 'Am'), (36.0, 'F'), (38.0, 'G'), (40.0, 'C')]
    hit.add(32.0, D.impact(2.0, 90, 30, 0.5), -1)
    for i, nn in enumerate(['C4', 'E4', 'G4', 'C5', 'D5', 'E5', 'G5', 'C6', 'E6']):   # sunrise gliss
        harp.add(32.0 + i * 0.04, I.harp(nn, 2.0, 0.8), -3, -0.6 + 0.15 * i)
    bells.add(32.0, I.bell('C6', 3.0, 0.7, 3.0), -4, 0.2)
    for tc in (32.0, 36.0, 40.0):
        fxT.add(tc, D.crash(2.5, 2.0), -3 if tc > 32 else 0, -0.3 if tc == 36 else 0.3)
    for i in range(20):
        t = 32.0 + i * 0.5
        kick.add(t, D.kick('big' if i == 0 else 'punch'), 0)
        kicks.append(t)
        if i % 2 == 1:
            perc.add(t, D.clap(), 5)
            perc.add(t, D.snare(0.3, 200), 0)
        perc.add(t + 0.25, D.hat(True, 0.3), 1, 0.25)
        for s in range(4):
            perc.add(t + s * 0.125, D.shaker(), -3 - 3 * (s % 2), -0.35)
    for i, t in enumerate((41.5, 41.625, 41.75, 41.875)):
        perc.add(t, D.snare(0.25, 220), -3 + 2 * i, 0)
    for t0, name in bars:
        half = t0 == 40.0
        segs = [(t0, 'C', 1.0), (t0 + 1.0, 'Am', 1.0)] if half else [(t0, name, 2.0)]
        for ts, nm, dl in segs:
            r = m(ROOT[nm]) + 12
            for s in range(int(dl / 0.5)):
                tt = ts + s * 0.5 + 0.25
                bassT.add(tt, I.bass(r, 0.26, gate=0.22, cut_hi=1800, cut_lo=350, decay=0.07), 0)
                bassT.add(tt - 0.25, I.bass(r - 12, 0.2, gate=0.16, cut_hi=700, cut_lo=200, decay=0.05), -4)
            subT.add(ts, I.sub808(r - 12, dl, 1.0, 1.5, dl * 3), 0)
            pad.add(ts, I.supersaw(VOIC[nm] + [VOIC[nm][2].replace('3', '5').replace('4', '5')],
                                   dl + 0.3, a=0.01, gate=dl - 0.02, r=0.25,
                                   cutoff_env=[(0, 4000), (dl, 2600)], detune=24), 0)
            tones = sorted(m(x) + 24 for x in VOIC[nm][1:4])
            if ts >= 34.0:
                for s in range(int(dl / 0.125)):
                    nn = tones[[0, 1, 2, 1][s % 4]] + (12 if (s // 4) % 2 else 0)
                    arp.add(ts + s * 0.125, I.kspluck(nn, 0.3, 0.95, 0.35), -1.5 * (s % 2),
                            0.6 if s % 2 else -0.6)
            if ts >= 36.0:
                choirT.add(ts, I.choir([x for x in VOIC[nm][2:]], dl + 0.4, a=0.25, gate=dl, r=0.4), 0)
    # melody: augmented theme (quarters) 32-40, then eighths 40-42
    for i, (t, mi, d) in enumerate(theme('C5', 32.0, 0.5)):
        leadT.add(t, I.pluck_lead(mi, 0.9 if i < 14 else 1.2, 1.0, 0.25), 0, 0.05)
        leadT.add(t, I.lead(mi, d + 0.2, gate=d * 0.95, cutoff=2400), -9)
        glk.add(t, I.glock(mi + 12, 1.2, 0.7), 0, 0.3)
    for i, (t, mi, d) in enumerate(theme('C5', 40.0, 0.25, idx=range(8))):
        leadT.add(t, I.pluck_lead(mi, 0.5, 1.0, 0.18), 0)
        mar.add(t, I.marimba(mi, 1.0), 0, -0.2)
        glk.add(t, I.glock(mi + 12, 1.0, 0.7), -2, 0.3)

    # ---- 42 / 43 / 44: PLAN IT. SHARE IT. SAVOUR IT.  (F - G - A rising unison hits)
    for t, name, top in ((42.0, 'F', 'F5'), (43.0, 'G', 'G5'), (44.0, 'A', 'A5')):
        v = VOIC[name] + [m(VOIC[name][3]) + 12]
        hit.add(t, D.impact(1.4, 100, 34, 0.5), 0)
        hit.add(t, I.brass(v, 0.9, gate=0.35, bright=1.3, scoop=0.5, r=0.4), 0)
        hit.add(t, I.supersaw(v, 0.9, a=0.004, gate=0.3, r=0.5, cutoff=6000, detune=26), -3)
        subT.add(t, I.sub808(ROOT[name], 0.9, 1.8, 2.0, 0.9), 2)
        fxT.add(t, D.crash(1.6, 1.4), -2, {42.0: -0.4, 43.0: 0.4, 44.0: 0.0}[t])
        kick.add(t, D.kick('big'), 1)
        leadT.add(t, I.pluck_lead(top, 0.8, 1.2, 0.3), 0)
        glk.add(t, I.glock(m(top) + 12, 1.4, 1.0), 2)
        bells.add(t, I.bell(top, 2.0, 0.8, 2.0), -3)
    for s in range(1, 8):
        for t0 in (42.0, 43.0):
            perc.add(t0 + s * 0.125, D.hat(False), -8 + s, 0.3)
    for t0 in (42.75, 43.75):
        perc.add(t0, D.snare(0.2, 220), -6)
        perc.add(t0 + 0.125, D.snare(0.2, 230), -3)

    # ---- 44-46 riser into the key change (A sus4 -> A)
    strg.add(44.0, I.strings(VOIC['Asus'], 1.05, a=0.3, gate=1.0, r=0.05, cutoff=2500), 0)
    pad.add(44.5, I.supersaw(VOIC['A'] + ['A4'], 1.37, a=0.4, gate=1.35, r=0.02, detune=28,
                             cutoff_env=[(0, 500), (1.37, 7000)]), 0)
    fxT.add(44.0, D.riser(1.875, 300, 12000, True, 2.0, 110, 1760), 1)
    for i, t in enumerate(D.roll_times(44.5, 45.86, 4, 32, 0.9)):
        perc.add(t, D.snare(0.2, 230), -12 + 14 * (t - 44.5) / 1.36, 0)
    for t in (44.5, 45.0, 45.25, 45.5, 45.625, 45.75):
        kick.add(t, D.kick('punch'), -2)
    for i, t in enumerate(np.arange(45.0, 45.875, 0.125)):
        bassT.add(t, I.bass('A1', 0.12, gate=0.1, cut_hi=2000, decay=0.05), -6 + i)

    # ---- 46 THE DAY (D major): bells theme, choir, strings, full drums
    hit.add(46.0, D.impact(2.5, 100, 30, 0.6), 0)
    fxT.add(46.0, D.crash(3.0, 2.6), 0, -0.3)
    fxT.add(46.0, D.crash(3.0, 2.6), -3, 0.3)
    for i, nn in enumerate(['D4', 'F#4', 'A4', 'D5', 'E5', 'F#5', 'A5', 'D6', 'F#6']):
        harp.add(46.0 + i * 0.04, I.harp(nn, 2.5, 0.8), -2, -0.6 + 0.15 * i)
    wchords = [(46.0, 'D', 1.0), (47.0, 'Bm', 1.0), (48.0, 'G', 1.0), (49.0, 'A', 0.5), (49.5, 'D', 0.5)]
    for t0, nm, dl in wchords:
        r = m(ROOT[nm]) + 12
        v = VOIC[nm] if nm != 'G' else ['G2', 'D3', 'G3', 'B3', 'D4']
        pad.add(t0, I.supersaw(v, dl + 0.3, a=0.01, gate=dl - 0.02, r=0.25, cutoff=4500, detune=24), 0)
        strg.add(t0, I.strings([x for x in up(v[2:], 12)], dl + 0.4, a=0.06, gate=dl, r=0.35), 2)
        choirT.add(t0, I.choir([x for x in v[1:]], dl + 0.5, a=0.1, gate=dl, r=0.5), 3)
        subT.add(t0, I.sub808(r - 12, dl, 1.0, 1.5, dl * 3), 0)
        bells.add(t0, I.bell(r + 24, 3.0, 0.6, 3.5), -6, 0.4)
        for s in range(int(round(dl / 0.5))):
            bassT.add(t0 + s * 0.5 + 0.25, I.bass(r, 0.26, gate=0.22, cut_hi=1800, cut_lo=350, decay=0.07), 0)
        tones = sorted(m(x) + 24 for x in v[1:4])
        for s in range(int(round(dl / 0.125))):
            nn = tones[[0, 1, 2, 1][s % 4]] + (12 if (s // 4) % 2 else 0)
            arp.add(t0 + s * 0.125, I.kspluck(nn, 0.3, 0.95, 0.35), -1.5 * (s % 2), 0.6 if s % 2 else -0.6)
    for i, (t, mi, d) in enumerate(theme('D5', 46.0, 0.25)):
        bells.add(t, I.bell(mi, 3.0 if i == 14 else 1.8, 1.0, 3.0), 0, 0.1 * np.sin(i))
        glk.add(t, I.glock(mi + 12, 1.2, 0.8), -1, 0.3)
        leadT.add(t, I.pluck_lead(mi, 0.5, 0.9, 0.18), -3)
    for i in range(8):
        t = 46.0 + i * 0.5
        kick.add(t, D.kick('big' if i == 0 else 'punch'), 0)
        kicks.append(t)
        if i % 2 == 1:
            perc.add(t, D.clap(), 5)
            perc.add(t, D.snare(0.3, 200), 0)
        perc.add(t + 0.25, D.hat(True, 0.3), 1, 0.25)
        for s in range(4):
            perc.add(t + s * 0.125, D.shaker(), -2 - 3 * (s % 2), -0.35)
    for t in (46.0, 48.0):
        perc.add(t, D.tom(90), 2, -0.2)
    kick.add(49.5, D.kick('soft'), -2)
    fxT.add(49.5, D.crash(2.5, 2.2, 0.8), -9, 0.2)

    # ---- 49.5-51.2: held breath under the vows
    strg.add(49.9, I.strings(['G2', 'D3', 'F#3', 'B3', 'D4'], 0.8, a=0.3, gate=0.62, r=0.2, cutoff=1800), 0)
    strg.add(50.5, I.strings(VOIC['Asus'], 0.7, a=0.25, gate=0.52, r=0.2, cutoff=2000), 1)
    strg.add(51.0, I.strings(VOIC['A'], 0.3, a=0.08, gate=0.2, r=0.05, cutoff=2600), 2)
    choirT.add(50.0, I.choir(['B3', 'D4', 'F#4'], 1.25, a=0.6, gate=1.15, r=0.1, vowel='o'), -4)
    cel.add(50.0, I.celesta('F#6', 2.0, 0.6), -8, 0.4)
    cel.add(50.75, I.celesta('E6', 2.0, 0.6), -9, -0.4)
    fxT.add(51.2 - 1.0, D.reverse_cymbal(1.0), -4)
    fxT.add(50.6, D.riser(0.6, 600, 9000, False, 2.0), -10)
    subT.add(49.5, I.sub808('D1', 0.6, 1.0, 1.5, 1.0), -3)

    # ---- 51.2 CLIMAX: the kiss
    hit.add(51.2, D.impact(2.0, 110, 30, 0.7), 1)
    hit.add(51.2, I.brass(['D3', 'A3', 'D4', 'F#4', 'A4', 'D5'], 0.8, gate=0.6, bright=1.3, r=0.3), -1)
    pad.add(51.2, I.supersaw(['D2', 'A2', 'D3', 'F#3', 'A3', 'D4', 'F#4', 'A4'], 0.9, a=0.004, gate=0.78,
                             r=0.1, cutoff=6000, detune=28), 0)
    choirT.add(51.2, I.choir(['A3', 'D4', 'F#4', 'A4', 'D5'], 0.85, a=0.03, gate=0.78, r=0.07), 4)
    for nn, g in (('D5', 0), ('F#5', -3), ('A5', -3), ('D6', -1)):
        bells.add(51.2, I.bell(nn, 1.0, 1.1, 3.0), g)
    for c in (-0.5, 0.5):
        fxT.add(51.2, D.crash(1.0, 2.5), 0, c)
    subT.add(51.2, I.sub808('D1', 0.8, 1.8, 2.0, 1.0), 3)
    for i, nn in enumerate(['D5', 'F#5', 'A5', 'D6', 'F#6', 'A6', 'D7']):
        harp.add(51.2 + i * 0.04, I.harp(nn, 1.0, 0.9), -2, -0.5 + 0.17 * i)
        glk.add(51.25 + i * 0.05, I.glock(m(nn) + 12, 0.8, 0.8), -4, 0.5 - 0.17 * i)
    for t in (51.5, 51.75):
        kick.add(t, D.kick('punch'), 0)
        kicks.append(t)
    perc.add(51.5, D.clap(), 5)
    for i, (t, f) in enumerate(((51.75, 180), (51.875, 140))):
        perc.add(t, D.tom(f), 2, 0.3 - 0.6 * i)
    bassT.add(51.5, I.bass('D2', 0.5, gate=0.48, cut_hi=1800, decay=0.1), 0)

    x = S.render(irs, {'huge': -2})
    # breath before the drop and gap before the key change (dry cut)
    for a, b in ((31.94, 32.0), (45.875, 46.0)):
        i0, i1 = ns(a - S.t0), ns(b - S.t0)
        k = ns(0.004)
        x[i0 - k:i0] *= np.linspace(1, 0, k)[:, None]
        x[i0:i1] = 0
    return S, x


# =================================================================== SECTION 4
def section_finale(irs, anthem_sec, anthem_x):
    S = Section('finale', 52.0, 60.0, tail=0.1)
    pad = S.tr('pad', -18, {'hall': 0.35}, [chorus(0.3), eq('peak', 220, 0.8, -3)])
    choirT = S.tr('choir', -18, {'hall': 0.4})
    strg = S.tr('strings', -21, {'hall': 0.35})
    bells = S.tr('bells', -15, {'hall': 0.4})
    harp = S.tr('harp', -14, {'hall': 0.35})
    mbox = S.tr('mbox', -10, {'hall': 0.35, 'plate': 0.15})
    pz = S.tr('pizz', -15, {'hall': 0.2})
    cel = S.tr('cel', -16, {'hall': 0.45})
    hit = S.tr('hit', -12, {'hall': 0.3})
    fxT = S.tr('fx', -12, {'hall': 0.25})
    rw = S.tr('rewind', -2, {'plate': 0.12})

    # ---- 52-54 tape rewind of the story so far (source: anthem mix read backwards)
    n_rw = ns(1.96)
    src_end = ns(52.0 - anthem_sec.t0)
    y = fx.rewind(anthem_x, src_end, n_rw, 1.0, 10.0, 1.8)
    u = np.linspace(0, 1, n_rw)
    y = svf(y, 12000 * (1 - 0.75 * u), 0.7, 'lp')
    y = butter(y, 'hp', 120)
    y *= (1 - 0.55 * u ** 0.7)[:, None]
    y[-ns(0.08):] *= np.linspace(1, 0, ns(0.08))[:, None]
    rw.add(52.0, y, 0)
    fxT.add(54.0 - 1.4, D.reverse_cymbal(1.4), -2)
    rb = I.bell('D5', 1.6, 0.8, 3.0)[::-1]
    rb = rb * (np.linspace(0, 1, len(rb)) ** 2)[:, None]
    bells.add(54.0 - len(rb) / SR, rb[:-48], -4)

    # ---- 54.0 final big warm chord (Dmaj9), decaying under the narrator
    V = ['D2', 'A2', 'D3', 'F#3', 'A3', 'C#4', 'E4', 'F#4']
    fade = autogain(S, [(54.0, 1.0), (54.6, 0.9), (55.4, 0.4), (58.0, 0.3), (60, 0.2)])
    pad.post.append(fade)
    pad.add(54.0, I.supersaw(V, 5.5, a=0.006, d=2.0, s=0.6, gate=4.0, r=1.4, detune=20,
                             cutoff_env=[(0, 5000), (1.5, 2000), (5.5, 900)]), 0)
    choirT.add(54.0, I.choir(['A3', 'D4', 'F#4', 'A4', 'E5'], 3.0, a=0.05, gate=1.6, r=1.3), 0)
    strg.add(54.0, I.strings(['D4', 'F#4', 'A4', 'D5', 'E5'], 3.5, a=0.05, gate=1.5, r=1.8), 0)
    hit.add(54.0, D.impact(2.0, 80, 30, 0.3), 0)
    hit.add(54.0, I.sub808('D1', 2.0, 1.4, 1.5, 3.0), -2)
    bells.add(54.0, I.bell('D5', 4.0, 0.7, 4.0), 0, -0.2)
    bells.add(54.0, I.bell('A5', 4.0, 0.6, 4.0), -4, 0.3)
    for i, nn in enumerate(['D3', 'A3', 'D4', 'F#4', 'A4', 'C#5', 'E5', 'F#5', 'A5']):
        harp.add(54.0 + i * 0.045, I.harp(nn, 3.0, 0.7), -1, -0.6 + 0.15 * i)

    # ---- music-box reprise of the love theme in D (55.0 -> resolved D6 at 58.5)
    for i, (t, mi, d) in enumerate(theme('D5', 55.0, 0.25)):
        mbox.add(t, I.musicbox(mi, 3.0 if i == 14 else 1.8, 0.75 + 0.15 * (i % 2 == 0)),
                 -1 + 1.2 * (i % 2 == 0), 0.1)
    for t0, nm, dl in ((55.0, 'D', 1.0), (56.0, 'Bm', 1.0), (57.0, 'G', 1.0), (58.0, 'A', 0.5)):
        v = VOIC[nm]
        strg.add(t0, I.strings(v[1:], dl + 0.5, a=0.3, gate=dl, r=0.5, cutoff=1600), -3)
        pz.add(t0, I.pizz(ROOT[nm].replace('1', '2') if nm != 'D' else 'D2', 0.9), 0, -0.1)
        pz.add(t0 + 0.5, I.pizz(m(v[1]), 0.7, 0.6), -5, -0.1)
    # final resolution 58.5
    strg.add(58.5, I.strings(['D3', 'A3', 'D4', 'F#4', 'A4'], 1.5, a=0.25, gate=0.8, r=0.6, cutoff=1500), -2)
    pz.add(58.5, I.pizz('D2', 1.0), 0)
    for i, nn in enumerate(['D4', 'F#4', 'A4', 'D5', 'F#5']):
        harp.add(58.5 + i * 0.05, I.harp(nn, 1.45, 0.5), -6, -0.4 + 0.2 * i)
    cel.add(58.5, I.celesta('D6', 1.45, 0.6), -2, 0.2)
    cel.add(58.95, I.celesta('A6', 1.0, 0.4), -12, -0.3)

    x = S.render(irs)
    return S, x


# ======================================================================= MAIN
def place(master, x, t0, t_end):
    i0 = ns(t0)
    L = min(len(x), ns(t_end) - i0, len(master) - i0)
    master[i0:i0 + L] += x[:L]


def build_irs():
    return {
        'room': fx.make_ir(0.7, 0.006, 0.4, 200, seed=1, width=0.9),
        'plate': fx.make_ir(1.6, 0.012, 0.15, 250, seed=2, width=1.0),
        'hall': fx.make_ir(2.6, 0.025, 0.35, 180, seed=3, width=1.0),
        'huge': fx.make_ir(5.0, 0.04, 0.45, 120, seed=4, width=1.0, bass_ratio=1.2),
    }


def render(verbose=True):
    reseed(20260924)
    irs = build_irs()
    log = print if verbose else (lambda *a: None)
    log('S1 meet/montage...')
    _, x1 = section_meet(irs)
    log('S2 planning/chaos...')
    _, x2 = section_chaos(irs)
    log('S3 turn/anthem/wedding...')
    s3, x3 = section_anthem(irs)
    log('S4 rewind/finale...')
    _, x4 = section_finale(irs, s3, x3)

    master = np.zeros((N_TOTAL, 2))
    place(master, x1, 0.0, 14.05)
    place(master, x2, 14.0, 29.8)
    # anthem ends at 52.0 exactly where the rewind (which starts from the same sample) takes over
    x3c = x3.copy()
    i52 = ns(52.0 - 30.0)
    k = ns(0.006)
    x3c[i52 - k:i52] *= np.linspace(1, 0, k)[:, None]
    x3c[i52:] = 0
    place(master, x3c, 30.0, 52.0)
    place(master, x4, 52.0, 60.0)

    # macro dynamics (dB): quiet curious intro -> groove -> building chaos -> big anthem/wedding -> soft tail
    lv = [(0, -5), (5.9, -5), (6.0, -2.5), (12.0, -2.5), (13.55, -1), (13.6, 0), (14.0, 0), (14.2, -1),
          (16.0, -5), (20, -4.5), (24, -3), (28, -1.5), (29.8, 0.0), (30.0, 0), (31.9, 0), (32.0, 1.5),
          (42, 1.5), (46, 2), (49.5, 1.5), (51.2, 2.5), (52, 1.5), (53.98, 0.5), (54.0, 2.5), (54.8, 1.0), (55.3, -4), (60, -4)]
    master *= undb(automation(N_TOTAL, lv))[:, None]
    master = dcblock(master, 20)
    master = butter(master, 'lp', 18500, 2)
    # mastering: gentle glue compression, tilt, loudness, limiter
    master = biquad(master, 'lowshelf', 90, 0.7, 1.0)
    master = biquad(master, 'highshelf', 9000, 0.7, 1.0)
    master = fx.compress(master, thr=-16, ratio=1.8, knee=8, attack=0.025, release=0.25, makeup=0)
    try:
        import pyloudnorm as pyln
        meter = pyln.Meter(SR)
    except Exception:
        meter = None
    gain_db = 0.0
    for _ in range(4):
        y = fx.limit(master * undb(gain_db), -1.3, 3.0, 0.06)
        if meter is None:
            break
        lufs = meter.integrated_loudness(y)
        log(f'  loudness pass: gain {gain_db:+.2f} dB -> {lufs:.2f} LUFS')
        if abs(lufs + 16.0) < 0.15:
            break
        gain_db += (-16.0 - lufs)
    master = y
    # fade out 59.40 -> 59.95, silence to 60.0; tiny fade-in at 0
    t = tarr(N_TOTAL)
    fo = np.clip((59.95 - t) / 0.55, 0, 1)
    master *= (0.5 - 0.5 * np.cos(np.pi * fo))[:, None]
    master[:ns(0.005)] *= np.linspace(0, 1, ns(0.005))[:, None]
    # hard gates after mastering filters: dead stop at 29.8 and silence to 30.0
    k = ns(0.002)
    for a, b in ((14.04, 14.05), (29.8, 30.0)):
        i0, i1 = ns(a), ns(b)
        master[i0 - k:i0] *= np.linspace(1, 0, k)[:, None]
        master[i0:i1] = 0
    master[ns(59.95):] = 0
    master = np.clip(master, -0.89, 0.89)   # -1.01 dBFS hard safety (limiter keeps us below)
    return master


def write(master):
    import soundfile as sf
    os.makedirs(STEMS, exist_ok=True)
    assert master.shape == (N_TOTAL, 2)
    sf.write(OUT_WAV, master.astype(np.float32), SR, subtype='PCM_24')
    try:
        import imageio_ffmpeg
        ff = imageio_ffmpeg.get_ffmpeg_exe()
        subprocess.run([ff, '-y', '-loglevel', 'error', '-i', OUT_WAV, '-codec:a', 'libmp3lame',
                        '-b:a', '128k', OUT_MP3], check=True)
    except Exception as e:  # pragma: no cover
        print('mp3 preview skipped:', e)
    print('wrote', OUT_WAV)


if __name__ == '__main__':
    import time
    t0 = time.time()
    mm = render()
    write(mm)
    print(f'done in {time.time() - t0:.1f}s')
