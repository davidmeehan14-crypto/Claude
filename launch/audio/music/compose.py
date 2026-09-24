#!/usr/bin/env python3
"""'Next Chapter' - music bed for The Wedding Chapter 45 s launch film.

Bright, polished pop/electronic at 120 BPM in D major (bar = 2 s). Musical bar
downbeats sit on ODD seconds (1, 3, 5 ... 41) so every scene cut in SPEC.md
(3, 9, 13, 15, 25, 29, 41) is a downbeat; 38.0 is the "and-of" pickup half-bar.

Form
  0.0- 3.0  intro: airy Gmaj9 pad swell, filtered pluck arp, celesta sparkle, riser -> 3.0
  3.0- 9.0  light beat: soft kick, snaps/claps, shaker, sub; D | A | Bm   (+ arp)
  9.0-13.0  fuller: chords, bass groove, hook teaser; G | D
 13.0-15.0  break: Asus build, filter sweep, snare roll, hook stutter (14.5), 1/16 gap
 15.0-25.0  DROP / groove: 4-floor, claps, hats, bass, stabs, hook; D A Bm G | D
 25.0-29.0  variation, half-time: Gmaj9 | Gm6 (borrowed) -> A7sus, celesta arp
 29.0-37.5  full again: D A Bm G, hook + octave glock + supersaw layer; D -> hard stop 37.5
 37.5-38.0  digital silence (half bar)
 38.0-41.0  minimal: pluck chords on "Plan it." (38.0) / "Love it." (39.5) + claps
 41.0-45.0  final hit Dadd9 (impact, crash, harp gliss, choir), airy resolve by 44.5, silence 45.0
Reverse swells land on 3.0, 9.0, 15.0, 29.0, 41.0.

Run: python3 audio/music/compose.py   ->  audio/stems/music.wav (48 kHz, 24-bit, 2,160,000 samples)
"""
import os
import sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from core import (SR, N_TOTAL, ns, m, tarr, undb, to_stereo, automation, butter, biquad,  # noqa: E402
                  svf, softclip, reseed, fade_edges, normalize, dcblock, noise, sine)
import instruments as I  # noqa: E402
import drums as D  # noqa: E402
import fx  # noqa: E402

STEMS = os.path.normpath(os.path.join(HERE, '..', 'stems'))
OUT_WAV = os.path.join(STEMS, 'music.wav')
S16 = 0.125  # 16th note (s)

# ------------------------------------------------------------------ harmony
PAD = {
    'Gmaj9': ['G3', 'D4', 'F#4', 'A4', 'B4'],
    'D': ['D3', 'A3', 'E4', 'F#4', 'A4'],
    'A': ['C#3', 'A3', 'B3', 'E4', 'A4'],
    'Bm': ['B2', 'F#3', 'A3', 'D4', 'F#4'],
    'G': ['G2', 'D3', 'B3', 'D4', 'F#4'],
    'Asus': ['A2', 'E3', 'B3', 'D4', 'E4'],
    'Gm6': ['G2', 'D3', 'Bb3', 'E4', 'G4'],
    'A7sus': ['A2', 'E3', 'G3', 'D4', 'E4'],
    'G/B': ['B2', 'D3', 'G3', 'B3', 'D4'],
    'Dadd9': ['D3', 'A3', 'E4', 'F#4', 'A4', 'D5'],
}
ROOT = {'Gmaj9': 'G1', 'D': 'D2', 'A': 'A1', 'Bm': 'B1', 'G': 'G1', 'Asus': 'A1', 'Gm6': 'G1',
        'A7sus': 'A1', 'G/B': 'B1', 'Dadd9': 'D2'}
ARP = {  # 8-step 16th arp cells
    'Gmaj9': ['G4', 'D5', 'A5', 'B5', 'F#5', 'D5', 'A5', 'B4'],
    'D': ['D4', 'A4', 'E5', 'F#5', 'A5', 'F#5', 'E5', 'A4'],
    'A': ['C#4', 'A4', 'B4', 'E5', 'A5', 'E5', 'B4', 'E4'],
    'Bm': ['B3', 'F#4', 'D5', 'F#5', 'A5', 'F#5', 'D5', 'A4'],
    'G': ['G4', 'D5', 'B5', 'D5', 'F#5', 'D5', 'B4', 'D5'],
    'Asus': ['A4', 'E5', 'B5', 'E5', 'D6', 'B5', 'E5', 'B4'],
    'Gm6': ['G4', 'D5', 'Bb5', 'E6', 'G5', 'E5', 'Bb4', 'D5'],
    'A7sus': ['A4', 'E5', 'G5', 'D6', 'E5', 'D5', 'G4', 'E5'],
}
# chord per bar (bar starts on odd seconds)
BARS = {1: 'Gmaj9', 3: 'D', 5: 'A', 7: 'Bm', 9: 'G', 11: 'D', 13: 'Asus', 15: 'D', 17: 'A',
        19: 'Bm', 21: 'G', 23: 'D', 25: 'Gmaj9', 27: 'Gm6', 29: 'D', 31: 'A', 33: 'Bm', 35: 'G',
        37: 'D'}

# hook: tresillo-shaped 1-bar cells (16th step, note, length in 16ths)
HOOK = {
    'D': [(0, 'A5', 2), (3, 'F#5', 2), (6, 'A5', 2), (8, 'B5', 2), (10, 'A5', 2), (12, 'F#5', 3)],
    'A': [(0, 'E5', 2), (3, 'C#5', 2), (6, 'E5', 2), (8, 'A5', 2), (10, 'F#5', 2), (12, 'E5', 3)],
    'Bm': [(0, 'D5', 2), (3, 'F#5', 2), (6, 'B5', 2), (8, 'A5', 2), (10, 'F#5', 2), (12, 'D6', 4)],
    'G': [(0, 'B5', 2), (3, 'A5', 2), (6, 'F#5', 2), (8, 'E5', 2), (10, 'D5', 4), (14, 'E5', 1),
          (15, 'F#5', 1)],
}
# bass groove (16th step, octave offset, length) - locks with the hook's tresillo
BASS_PAT = [(0, 0, 2), (3, 0, 2), (6, 12, 1), (8, 0, 2), (10, 0, 1), (11, 7, 1), (12, 0, 2), (14, 12, 1)]


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
        i0 = ns(t)
        if i0 < 0:
            st, i0 = st[-i0:], 0
        L = min(len(st), self.sec.n - i0)
        if L > 0:
            self.buf[i0:i0 + L] += st[:L]


class Mix:
    def __init__(self):
        self.n = N_TOTAL
        self.t0 = 0.0
        self.tracks = {}

    def tr(self, name, gain_db=0.0, sends=None, post=None):
        if name not in self.tracks:
            self.tracks[name] = Track(self, name, gain_db, sends, post)
        return self.tracks[name]

    def auto(self, points, log=False):
        return automation(self.n, points, log=log)

    def render(self, irs, ret_db=None):
        ret_db = ret_db or {}
        dry = np.zeros((self.n, 2))
        buses = {k: np.zeros((self.n, 2)) for k in irs}
        self.stems = {}
        for trk in self.tracks.values():
            x = trk.buf * trk.gain
            for f in trk.post:
                x = f(x)
            self.stems[trk.name] = x
            dry += x
            for k, v in trk.sends.items():
                buses[k] += x * v
        out = dry
        for k, b in buses.items():
            if np.any(b):
                out = out + fx.convolve(b, irs[k]) * undb(ret_db.get(k, 0.0))
        return out


def sc(kicks, depth=0.6, release=0.16):
    return lambda x: x * fx.sidechain_gain(len(x), 0.0, kicks, depth, 0.004, release)[:, None]


def pp(delay=0.375, fb=0.42, mix=0.35, lp=3800):
    return lambda x: fx.pingpong(x, delay, fb, 6, lp, 350, mix)


def eq(kind, f, q=0.707, g=0.0):
    return lambda x: biquad(x, kind, f, q, g)


def gainauto(M, points):
    return lambda x: x * undb(M.auto(points))[:, None]


def build_irs():
    return {
        'room': fx.make_ir(0.6, 0.005, 0.4, 220, seed=1, width=0.9),
        'plate': fx.make_ir(1.5, 0.012, 0.2, 250, seed=2, width=1.0),
        'hall': fx.make_ir(2.8, 0.03, 0.3, 200, seed=3, width=1.0),
        'huge': fx.make_ir(4.5, 0.04, 0.4, 150, seed=4, width=1.0, bass_ratio=0.9),
    }


# ------------------------------------------------------------ extra sounds
def snap(dur=0.18):
    """Finger snap: sharp band-passed noise + short resonant body."""
    n = ns(dur)
    t = tarr(n)
    y = biquad(noise(n), 'bp', 2600, 1.4) * np.exp(-t / 0.012)
    y += 0.5 * butter(noise(n), 'hp', 6000) * np.exp(-t / 0.006)
    y += 0.25 * np.sin(2 * np.pi * 1850 * t) * np.exp(-t / 0.018)
    y[:6] *= np.linspace(0, 1, 6)
    y[-32:] *= np.linspace(1, 0, 32)
    return normalize(y, 0.9)


def air_pad(notes, dur, a=0.6, r=1.0, gate=None, cutoff=2600, cutoff_env=None, hp=180):
    """Airy, wide supersaw pad with breathy top (chorused later)."""
    x = I.supersaw(notes, dur, voices=7, detune=22, a=a, d=1.0, s=0.9, r=r, gate=gate,
                   cutoff=cutoff, cutoff_env=cutoff_env, res=0.6, width=1.0, drift=3, hp=hp)
    n = len(x)
    breath = butter(np.stack([noise(n), noise(n)], 1), 'bp', [5000, 12000]) * 0.02
    env = I.adsr(n, a, 1.0, 0.9, r, gate)
    return x + breath * env[:, None]


def rev_swell(sig, dur):
    """Reverse a (stereo/mono) sound's first `dur` seconds so it swells INTO the hit."""
    s = np.asarray(sig)[:ns(dur)][::-1]
    ramp = np.linspace(0, 1, len(s)) ** 2
    s = s * (ramp if s.ndim == 1 else ramp[:, None])
    return fade_edges(np.ascontiguousarray(s), 0.02, 0.003)


def pluck(note, dur=0.5, bright=0.8, decay=0.16):
    return I.pluck_lead(note, dur, bright, decay, 14.0)


# ================================================================= COMPOSE
def compose(irs):
    M = Mix()
    kicks = []
    # ---- tracks (gain dB, sends, post)
    pad = M.tr('pad', -19, {'hall': 0.35}, [lambda x: fx.chorus(x, mix=0.3), eq('peak', 300, 0.8, -3),
                                           sc(kicks, 0.45, 0.18),
                                           gainauto(M, [(0, 0), (15, 0), (15.5, -3), (24.5, -3), (25, 0),
                                                        (29, 0), (29.5, -1.5), (45, -1.5)])])
    arp = M.tr('arp', -20, {'hall': 0.15}, [pp(0.375, 0.38, 0.35, 4500), sc(kicks, 0.3, 0.12)])
    hook = M.tr('hook', -13, {'plate': 0.22, 'hall': 0.1},
                [pp(0.375, 0.3, 0.22, 5000), sc(kicks, 0.2, 0.1),
                 gainauto(M, [(0, 0), (16.0, 0), (16.5, -3.5), (22.5, -3.5), (23, -1), (29, 0), (45, 0)])])
    sparkle = M.tr('sparkle', -18, {'hall': 0.4, 'plate': 0.1}, [pp(0.75, 0.35, 0.25, 7000)])
    stab = M.tr('stab', -18, {'plate': 0.18}, [sc(kicks, 0.45, 0.12), eq('hp', 220)])
    lead2 = M.tr('supersaw_lead', -24, {'hall': 0.25}, [sc(kicks, 0.3, 0.12)])
    bassT = M.tr('bass', -12, {}, [sc(kicks, 0.55, 0.11), eq('hp', 32)])
    subT = M.tr('sub', -14, {}, [sc(kicks, 0.5, 0.14), eq('hp', 28)])
    kick = M.tr('kick', -7, {'room': 0.03})
    clapT = M.tr('clap', -13, {'plate': 0.18, 'room': 0.1})
    snapT = M.tr('snap', -15, {'room': 0.2, 'plate': 0.1})
    snr = M.tr('snare', -15, {'plate': 0.15})
    hats = M.tr('hats', -21, {'room': 0.1})
    shk = M.tr('shaker', -23, {'room': 0.15})
    fxT = M.tr('fx', -16, {'hall': 0.2})
    rise = M.tr('riser', -22, {'hall': 0.25}, [eq('hp', 250)])
    hit = M.tr('hit', -10, {'hall': 0.25})
    choirT = M.tr('choir', -22, {'huge': 0.45})
    harp = M.tr('harp', -16, {'hall': 0.45})
    finalpad = M.tr('finalpad', -17, {'huge': 0.35}, [lambda x: fx.chorus(x, mix=0.3)])

    def K(t, kind='punch', db=0.0):
        kick.add(t, D.kick(kind), db)
        kicks.append(t)

    def chord_pad(t, name, dur=2.0, db=0.0, **kw):
        g = kw.pop('gate', dur)
        pad.add(t, air_pad(PAD[name], dur + 1.0, gate=g, **kw), db)

    def arp_bar(t, name, db=0.0, bright=0.7, steps=16, open_fc=None):
        cell = ARP[name]
        for s in range(steps):
            nn = cell[s % 8]
            v = db - (0 if s % 4 == 0 else 2.5) - (1.5 if s % 2 else 0)
            b = bright if open_fc is None else open_fc(s)
            arp.add(t + s * S16, pluck(nn, 0.35, b, 0.07), v, pan=0.35 * np.sin(s * 1.3))

    def hook_bar(t, name, db=0.0, glock_db=None, saw_db=None, only=None):
        for i, (s, nn, L) in enumerate(HOOK[name]):
            if only is not None and i not in only:
                continue
            tt = t + s * S16
            hook.add(tt, pluck(nn, L * S16 + 0.35, 1.0, 0.12 + 0.03 * L), db + (1 if s in (0, 8) else 0))
            if glock_db is not None:
                sparkle.add(tt, I.glock(m(nn) + 12, 1.2, 0.7), glock_db, pan=0.25)
            if saw_db is not None:
                lead2.add(tt, I.supersaw([nn], L * S16 + 0.3, voices=5, detune=16, a=0.004, d=0.2,
                                         s=0.6, r=0.15, gate=L * S16, cutoff=4200, res=0.7), saw_db)

    def bass_bar(t, name, db=0.0, pat=BASS_PAT):
        r = m(ROOT[name])
        for s, octv, L in pat:
            bassT.add(t + s * S16, I.bass(r + octv, L * S16 + 0.1, gate=L * S16 * 0.9,
                                           cut_hi=1500, cut_lo=180, decay=0.09, sub=0.9),
                      db - (3 if octv else 0))

    def sub_note(t, name, dur, db=0.0):
        n = ns(dur)
        f = float(440 * 2 ** ((m(ROOT[name]) - 69) / 12))
        y = softclip(sine(f, n), 1.4) * I.adsr(n, 0.01, 0.4, 0.85, 0.12)
        subT.add(t, y, db)

    def stabs(t, name, db=0.0, steps=(2, 6, 10, 14)):
        ns_ = PAD[name][1:4]
        for s in steps:
            y = sum(pluck(m(nn) + 12, 0.3, 0.6, 0.06) for nn in ns_) / 2
            stab.add(t + s * S16, y, db + (0.5 if s == 14 else 0))

    def shaker_bar(t, db=0.0, steps=range(16)):
        for s in steps:
            shk.add(t + s * S16, D.shaker(0.1), db - (0 if s % 2 else 5) - (0 if s % 4 == 2 else 1.5),
                    pan=0.3)

    def hats_bar(t, db=0.0, open_=False):
        for s in (2, 6, 10, 14):
            hats.add(t + s * S16, D.hat(open_, 0.25 if open_ else None), db, pan=-0.2)

    def backbeat(t, db=0.0, snare=True, both=(4, 12)):
        for s in both:
            clapT.add(t + s * S16, D.clap(), db)
            if snare:
                snr.add(t + s * S16, D.snare(0.3, 200), db - 5)

    # ================================================= 0-3 INTRO
    # pad swell: Gmaj9 fades in from nothing, filter opening
    pad.add(0.0, air_pad(PAD['Gmaj9'], 3.6, a=2.2, gate=3.0, r=0.5,
                         cutoff_env=[(0, 300), (1.0, 900), (2.6, 3500), (3.6, 2000)]), 2)
    # pluck arp (filtered -> open), starts right away under the hero
    for bar_t in (-1.0, 1.0):
        for s in range(16):
            tt = bar_t + s * S16
            if tt < 0:
                continue
            u = tt / 3.0
            nn = ARP['Gmaj9'][s % 8]
            arp.add(tt, pluck(nn, 0.35, 0.25 + 0.6 * u, 0.06), -9 + 8 * u - (0 if s % 4 == 0 else 2),
                    pan=0.35 * np.sin(s * 1.3))
    # sparkle: celesta droplets on the beats (3D objects pop on beats)
    for tt, nn, pn in ((0.0, 'D6', -0.3), (0.5, 'A6', 0.3), (1.0, 'F#6', -0.1), (1.5, 'B6', 0.4),
                       (2.0, 'D7', -0.4), (2.5, 'A6', 0.2)):
        sparkle.add(tt, I.celesta(nn, 2.0, 0.8), -4 if tt < 1 else -2, pn)
    # riser 1.0 -> 3.0 and reverse swells into 3.0
    rise.add(1.0, D.riser(2.0, 400, 11000, True, 2.2, 146.8, 587.3), 0)
    fxT.add(3.0 - 1.5, D.reverse_cymbal(1.5), -2)
    pad.add(3.0 - 1.0, rev_swell(air_pad(PAD['D'], 1.2, a=0.005, cutoff=5000), 1.0), -2)

    # ================================================= 3-9 LIGHT BEAT
    for bt in (3, 5, 7):
        name = BARS[bt]
        chord_pad(bt, name, 2.0, -2, a=0.08, r=0.6, cutoff=2400)
        arp_bar(bt, name, -1, 0.75)
        K(bt, 'soft', -3)
        K(bt + 1.0, 'soft', -5)
        if bt == 7:
            K(bt + 1.75, 'soft', -8)
        for s in (4, 12):
            snapT.add(bt + s * S16, snap(), 0, pan=0.15)
        clapT.add(bt + 1.5, D.clap(), -6)
        shaker_bar(bt, -2)
        sub_note(bt, name, 1.95, -1)
    # ring "yes" pop at 4.5 -> a little glock accent
    sparkle.add(4.5, I.glock('A6', 1.5, 0.8), -4, 0.2)
    # 8.5 icons sucked in: reverse swell into 9.0
    fxT.add(9.0 - 1.0, D.reverse_cymbal(1.0), -3)
    rise.add(8.0, D.riser(1.0, 800, 9000, False, 2.5), -6)

    # ================================================= 9-13 FULLER
    hit.add(9.0, D.crash(2.5, 1.8), -10, 0.2)
    for bi, bt in enumerate((9, 11)):
        name = BARS[bt]
        chord_pad(bt, name, 2.0, 0, a=0.03, r=0.6, cutoff=3200)
        arp_bar(bt, name, -4, 0.6)
        bass_bar(bt, name, 0)
        stabs(bt, name, -2)
        for s in (0, 8, 10) if bt == 9 else (0, 8, 11, 14):
            K(bt + s * S16, 'punch', 0 if s in (0, 8) else -4)
        backbeat(bt, -1, snare=False)
        for s in (4, 12):
            snapT.add(bt + s * S16, snap(), -2, 0.15)
        hats_bar(bt, -2)
        shaker_bar(bt, -3)
        hook_bar(bt, 'G' if bt == 9 else 'D', -2)
    # "Guests. Budget. Suppliers. Seating." one per beat 9.0-10.5 -> sparkle ticks
    for i, tt in enumerate((9.0, 9.5, 10.0, 10.5)):
        sparkle.add(tt, I.celesta(['D7', 'E7', 'F#7', 'A7'][i], 1.0, 0.6), -9, -0.3 + 0.2 * i)
    sparkle.add(11.0, I.celesta('D7', 2.0, 0.9), -5, 0)  # "...all in one place."

    # ================================================= 13-15 BREAK / LIFT
    hit.add(13.0, D.crash(2.0, 1.5, 0.8), -14, -0.2)
    pad.add(13.0, air_pad(PAD['Asus'], 2.2, a=0.02, gate=1.98, r=0.05,
                          cutoff_env=[(0, 350), (1.0, 900), (1.9, 7000), (2.2, 7000)], hp=250), 3)
    sub_note(13.0, 'Asus', 1.0, -3)
    for s in range(16):  # filtered 8th arp rising
        tt = 13.0 + s * S16
        u = s / 16
        arp.add(tt, pluck(ARP['Asus'][s % 8], 0.3, 0.2 + 0.8 * u, 0.05), -6 + 4 * u,
                pan=0.4 * np.sin(s * 1.3))
    # snap together at 14.0
    clapT.add(14.0, D.clap(), -2)
    snapT.add(14.0, snap(), 0)
    # hook fragment at 14.0 -> stuttered from 14.5 (see post), pitch climbing
    for s, nn in ((0, 'E5'), (2, 'A5'), (4, 'B5')):
        hook.add(14.0 + s * S16, pluck(nn, 0.5, 0.9, 0.12), -1)
    # snare build (accelerating) 13.0 -> 14.875, then 1/16 gap
    for tt in D.roll_times(13.0, 14.875, 4.0, 16.0, 1.0):
        u = (tt - 13.0) / 1.875
        snr.add(tt, D.snare(0.2, 210 + 60 * u), -12 + 12 * u, pan=0.1 * np.sin(tt * 20))
    rise.add(13.0, D.riser(1.875, 300, 12000, True, 2.0, 110.0, 880.0), 2)
    fxT.add(15.0 - 1.9, D.reverse_cymbal(1.9), 0)
    pad.add(15.0 - 1.5, rev_swell(I.choir(PAD['D'][1:], 1.6, a=0.01, vowel='a'), 1.5), -8)

    # ================================================= 15-25 DROP + GROOVE
    hit.add(15.0, D.impact(2.5, 90, 36, 0.35), -6)
    hit.add(15.0, D.crash(3.0, 2.4), -6, 0.25)
    for bt in (15, 17, 19, 21, 23):
        name = BARS[bt]
        chord_pad(bt, name, 2.0, 0 if bt == 15 else -2, a=0.01, r=0.5, cutoff=3500)
        bass_bar(bt, name, 0)
        stabs(bt, name, -1 if bt == 15 else -3)
        for b in range(4):
            K(bt + b * 0.5, 'punch', 0 if b % 2 == 0 else -1.5)
        backbeat(bt, 0)
        hats_bar(bt, -1, open_=(bt in (15, 23)))
        shaker_bar(bt, -2)
        if bt == 15:
            hook_bar(bt, 'D', 0, glock_db=-6)
        elif bt in (17, 19, 21):
            hook_bar(bt, name, -1)  # thinner (mid space for UI SFX, gain automated)
        else:  # 23: answer - first three notes only
            hook_bar(bt, 'D', -1, only=(0, 1, 2))
    arp_bar(23.0, 'D', -6, 0.55, steps=16)
    # into 25: tom-ish flam + reverse
    fxT.add(25.0 - 1.0, D.reverse_cymbal(1.0), -4)
    for tt in (24.5, 24.625, 24.75, 24.875):
        snr.add(tt, D.snare(0.25, 180), -8 + (tt - 24.5) * 12)

    # ================================================= 25-29 VARIATION (half-time)
    chord_pad(25.0, 'Gmaj9', 2.0, 1, a=0.12, r=0.8, cutoff=2800)
    chord_pad(27.0, 'Gm6', 1.0, 1, a=0.05, r=0.4, cutoff=2600)
    chord_pad(28.0, 'A7sus', 1.0, 0, a=0.05, r=0.3, cutoff_env=[(0, 1500), (1.0, 6000), (2.0, 6000)])
    for bt, name, dur in ((25.0, 'Gmaj9', 2.0), (27.0, 'Gm6', 1.0), (28.0, 'A7sus', 1.0)):
        sub_note(bt, name, dur - 0.05, 0)
        bassT.add(bt, I.bass(m(ROOT[name]), dur, gate=dur * 0.9, cut_hi=700, cut_lo=150, decay=0.2), -3)
    for bt in (25.0, 27.0):
        K(bt, 'punch', -1)
        K(bt + 0.75, 'soft', -8)
        clapT.add(bt + 1.0, D.clap(), 0)
        snr.add(bt + 1.0, D.snare(0.35, 185), -4)
        shaker_bar(bt, -6, steps=range(0, 16, 2))
    # celesta arp (romance nod) - one per 8th, answering the "chapter" type
    cel_lines = [('Gmaj9', 25.0, ['B5', 'D6', 'F#6', 'A6', 'B6', 'A6', 'F#6', 'D6']),
                 ('Gm6', 27.0, ['Bb5', 'D6', 'E6', 'G6']), ('A7sus', 28.0, ['A5', 'D6', 'E6', 'G6'])]
    for _, t0, notes in cel_lines:
        for i, nn in enumerate(notes):
            sparkle.add(t0 + i * 0.25, I.celesta(nn, 1.6, 0.8), -3 - 1.5 * (i % 2), 0.4 * np.sin(i))
    hook.add(26.5, pluck('F#5', 0.6, 0.8), -4)  # "we'll guide you"
    hook.add(27.5, pluck('D6', 0.8, 0.8), -4)   # "A new chapter."
    # build back to 29: 8th -> 16th snare, riser, reverse swell
    for tt in list(np.arange(28.0, 28.5, 0.25)) + list(np.arange(28.5, 29.0, S16)):
        snr.add(tt, D.snare(0.2, 205), -9 + (tt - 28) * 8)
    rise.add(27.5, D.riser(1.5, 500, 12000, True, 2.0, 220.0, 880.0), -1)
    fxT.add(29.0 - 1.5, D.reverse_cymbal(1.5), -1)

    # ================================================= 29-37.5 FULL AGAIN
    hit.add(29.0, D.crash(3.0, 2.4), -6, -0.25)
    hit.add(29.0, D.kick('big'), -4)
    for bt in (29, 31, 33, 35, 37):
        name = BARS[bt]
        last = bt == 37
        chord_pad(bt, name, 0.5 if last else 2.0, 0, a=0.01, r=0.1 if last else 0.5, cutoff=4000)
        if last:  # half bar only: D then hard stop at 37.5
            K(37.0, 'punch', 0)
            clapT.add(37.0, D.clap(), -3)
            bassT.add(37.0, I.bass(m('D2'), 0.5, gate=0.45), 0)
            for s in range(4):
                snr.add(37.0 + s * S16, D.snare(0.12, 220), -8 + 2 * s)
            continue
        bass_bar(bt, name, 0)
        stabs(bt, name, -1)
        for b in range(4):
            K(bt + b * 0.5, 'punch', 0 if b % 2 == 0 else -1.5)
        backbeat(bt, 0)
        for s in (4, 12):
            snapT.add(bt + s * S16, snap(), -4, 0.3)
        hats_bar(bt, 0, open_=True)
        shaker_bar(bt, -1)
        hook_bar(bt, name, 0, glock_db=-8, saw_db=-2)
        arp_bar(bt, name, -8, 0.5)
    fxT.add(35.0, D.crash(2.0, 1.5), -12)

    # ================================================= 38-41 MINIMAL ("Plan it." / "Love it.")
    for tt, name, notes in ((38.0, 'G/B', ['B4', 'D5', 'G5']), (39.5, 'Asus', ['A4', 'D5', 'E5', 'A5'])):
        for i, nn in enumerate(notes):
            hook.add(tt + i * 0.012, pluck(nn, 1.0, 0.7, 0.18), -3, pan=-0.2 + 0.15 * i)
        sub_note(tt, name, 0.9 if tt < 39 else 1.2, -4)
        sparkle.add(tt, I.celesta(notes[-1] if tt < 39 else 'A6', 1.8, 0.7), -8, 0.2)
    # little answer plucks (typing feel)
    for tt, nn in ((38.5, 'D5'), (38.75, 'G5'), (39.0, 'B5'), (40.0, 'E5'), (40.25, 'A5'), (40.5, 'B5')):
        hook.add(tt, pluck(nn, 0.4, 0.6, 0.08), -10, pan=0.3)
    for tt in (38.5, 39.5, 40.5):
        clapT.add(tt, D.clap(), -3)
        snapT.add(tt, snap(), -6, -0.2)
    for s in range(8):
        shk.add(40.0 + s * S16, D.shaker(0.1), -10 + s)
    # swell into 41 final hit
    fxT.add(41.0 - 1.25, D.reverse_cymbal(1.25), 0)
    pad.add(41.0 - 1.0, rev_swell(air_pad(PAD['Dadd9'], 1.2, a=0.005, cutoff=6000), 1.0), 0)
    rise.add(40.0, D.riser(1.0, 1500, 12000, False, 2.5), -6)

    # ================================================= 41-45 FINAL HIT + OUTRO
    hit.add(41.0, D.impact(3.0, 85, 34, 0.3), -5)
    hit.add(41.0, D.crash(3.5, 3.0), -6)
    clapT.add(41.0, D.clap(), 0)
    kicks.append(41.0)
    finalpad.add(41.0, air_pad(PAD['Dadd9'], 4.0, a=0.005, gate=2.4, r=1.2,
                               cutoff_env=[(0, 6000), (0.4, 3000), (3.0, 1400), (4.0, 900)]), 0)
    finalpad.add(41.0, I.supersaw(['D2'], 3.6, voices=3, detune=8, a=0.005, gate=2.2, r=1.0, cutoff=500), -8)
    choirT.add(41.0, I.choir(['D4', 'F#4', 'A4', 'E5'], 3.8, a=0.3, r=1.2, gate=2.4, vowel='a'), 0)
    subT.add(41.0, softclip(sine(float(440 * 2 ** ((m('D1') - 69) / 12)), ns(3.0)), 1.3)
             * I.adsr(ns(3.0), 0.005, 0.6, 0.5, 0.8, 2.0), 0)
    gl = ['D4', 'E4', 'F#4', 'A4', 'B4', 'D5', 'E5', 'F#5', 'A5', 'B5', 'D6', 'E6', 'F#6', 'A6']
    for i, nn in enumerate(gl):
        harp.add(41.0 + i * 0.035, I.harp(nn, 3.2, 0.55 + 0.03 * i), -4 + 0.25 * i, pan=-0.6 + 1.2 * i / len(gl))
    # logo write-on sparkle 41.3-42.8, tagline 43.0 resolve
    for tt, nn, pn in ((41.5, 'A6', 0.3), (42.0, 'F#6', -0.3), (42.5, 'E6', 0.2), (43.0, 'D6', 0.0)):
        sparkle.add(tt, I.celesta(nn, 1.8, 0.7), -6 if tt < 43 else -3, pn)
    sparkle.add(43.0, I.glock('D7', 1.5, 0.5), -12, 0)

    # ---- hook stutter 14.5 -> 15.0 (repeats the 14.5 slice, climbing)
    hook.post.insert(0, lambda x: fx.stutter(x, 0.0, 14.5, 14.875, 0.0625, pitch_up=1.0, decay=0.97))
    return M


# ================================================================== MASTER
def render(verbose=True):
    log = print if verbose else (lambda *a: None)
    reseed(20260924)
    irs = build_irs()
    log('composing...')
    M = compose(irs)
    log('rendering tracks + reverbs...')
    master = M.render(irs, {'hall': -1, 'huge': 0, 'plate': -2, 'room': -3})

    # macro dynamics (dB)
    lv = [(0, -3), (2.9, -2), (3.0, -2), (8.9, -2), (9.0, -1), (12.9, -1), (13.0, -1.5), (14.9, 0),
          (15.0, 0.5), (16.0, 0.0), (24.9, 0.0), (25.0, -1.0), (28.9, -0.5), (29.0, 0.5), (37.5, 0.5),
          (38.0, -1.0), (40.9, -1.0), (41.0, 1.0), (45, 1.0)]
    master *= undb(automation(N_TOTAL, lv))[:, None]
    master = dcblock(master, 20)
    master = butter(master, 'lp', 18500, 2)
    master = biquad(master, 'lowshelf', 90, 0.7, 0.5)
    master = biquad(master, 'peak', 400, 0.8, -1.0)
    master = biquad(master, 'highshelf', 10000, 0.7, 1.5)
    master = fx.compress(master, thr=-16, ratio=1.8, knee=8, attack=0.02, release=0.2)
    import pyloudnorm as pyln
    meter = pyln.Meter(SR)
    gain_db = 0.0
    for _ in range(6):
        y = fx.limit(master * undb(gain_db), -1.3, 3.0, 0.06)
        lufs = meter.integrated_loudness(y)
        log(f'  loudness pass: gain {gain_db:+.2f} dB -> {lufs:.2f} LUFS')
        if abs(lufs + 15.0) < 0.1:
            break
        gain_db += (-15.0 - lufs)
    master = y
    t = tarr(N_TOTAL)
    # outro: gentle fade 43.6 -> 44.9, digital silence to 45.0
    fo = np.clip((44.9 - t) / 1.3, 0, 1)
    master *= (0.5 - 0.5 * np.cos(np.pi * fo))[:, None]
    master[:ns(0.004)] *= np.linspace(0, 1, ns(0.004))[:, None]
    # hard stop 37.5 -> 38.0 (half-bar digital silence), short fades to avoid clicks
    k = ns(0.004)
    i0, i1 = ns(37.5), ns(38.0)
    master[i0 - k:i0] *= np.linspace(1, 0, k)[:, None]
    master[i0:i1] = 0
    master[i1:i1 + ns(0.001)] *= np.linspace(0, 1, ns(0.001))[:, None]
    # 1/16 breath before the drop (14.875-15.0): duck, not silence
    g = np.ones(N_TOTAL)
    a, b = ns(14.875), ns(14.995)
    g[a:b] = 0.25
    from core import onepole_lp
    g = onepole_lp(g, 150)
    master *= g[:, None]
    master[ns(44.9):] = 0
    master = np.clip(master, -0.89, 0.89)
    return master


def write(master):
    import soundfile as sf
    os.makedirs(STEMS, exist_ok=True)
    assert master.shape == (N_TOTAL, 2), master.shape
    sf.write(OUT_WAV, master.astype(np.float32), SR, subtype='PCM_24')
    print('wrote', OUT_WAV)


if __name__ == '__main__':
    import time
    t0 = time.time()
    write(render())
    print(f'done in {time.time() - t0:.1f}s')
