#!/usr/bin/env python3
"""
Place SFX cues -> audio/stems/sfx.wav  (48 kHz stereo, exactly 45.000 s, peaks <= -1 dBFS)

    python3 audio/place_sfx.py            # re-run any time cues change
    python3 audio/place_sfx.py --verbose  # list every placed cue

Reads every data/cues/*.json: [{"t": sec, "sfx": name, "gain": 1.0?, "pan": -1..1?}, ...]
- Each sound's "anchor" from audio/sfx/offsets.json is aligned to t (whoosh / whoosh_short /
  swish / swipe peaks, riser peak at its end; transient onset = 0 for everything else).
- "pop" / "pop_soft": a variant _1.._4 picked pseudo-randomly (deterministic per cue, never the
  same variant twice in a row). "type": variants _1.._6 round-robin in time order.
  A specific variant can be requested directly ("pop_3", "type_2").
- gain is linear; pan is a constant-power balance (0 = as recorded).
- Unknown names / malformed entries -> warning, skipped.
"""
import glob
import json
import os
import re
import sys
import zlib

import numpy as np
import soundfile as sf

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SFX_DIR = os.path.join(HERE, "sfx")
CUE_DIR = os.path.join(ROOT, "data", "cues")
OUT = os.path.join(HERE, "stems", "sfx.wav")

SR = 48000
DUR = 45.0
NTOT = int(round(SR * DUR))  # 2,160,000
CEIL_DB = -1.0
RANDOM_VARIANTS = {"pop", "pop_soft"}
ROUND_ROBIN = {"type"}


def warn(msg):
    print("WARNING:", msg, file=sys.stderr)


def load_library():
    with open(os.path.join(SFX_DIR, "offsets.json")) as fh:
        offsets = json.load(fh)
    lib, cache = {}, {}
    for path in glob.glob(os.path.join(SFX_DIR, "*.wav")):
        name = os.path.splitext(os.path.basename(path))[0]
        lib[name] = path
    variants = {}
    for name in lib:
        m = re.fullmatch(r"(.+)_(\d+)", name)
        if m and m.group(1) in (RANDOM_VARIANTS | ROUND_ROBIN):
            variants.setdefault(m.group(1), []).append(name)
    for k in variants:
        variants[k].sort(key=lambda s: int(s.rsplit("_", 1)[1]))

    def get(name):
        if name not in cache:
            x, sr = sf.read(lib[name], dtype="float64", always_2d=True)
            if sr != SR:
                raise ValueError(f"{name}: sample rate {sr} != {SR}")
            if x.shape[1] == 1:
                x = np.repeat(x, 2, axis=1) * 0.7071
            cache[name] = x[:, :2]
        return cache[name]
    return lib, offsets, variants, get


def load_cues():
    cues = []
    for path in sorted(glob.glob(os.path.join(CUE_DIR, "*.json"))):
        src = os.path.basename(path)
        try:
            with open(path) as fh:
                data = json.load(fh)
        except Exception as e:  # keep going: one broken file must not kill the stem
            warn(f"{src}: cannot parse ({e}); skipped")
            continue
        if isinstance(data, dict):
            data = data.get("cues", [])
        if not isinstance(data, list):
            warn(f"{src}: expected a JSON array; skipped")
            continue
        for i, c in enumerate(data):
            try:
                t = float(c["t"])
                name = str(c["sfx"]).strip()
                gain = float(c.get("gain", 1.0))
                p = float(c.get("pan", 0.0))
            except Exception:
                warn(f"{src}[{i}]: malformed cue {c!r}; skipped")
                continue
            cues.append({"t": t, "sfx": name, "gain": gain, "pan": max(-1.0, min(1.0, p)),
                         "src": src, "i": i})
    cues.sort(key=lambda c: (c["t"], c["src"], c["i"]))
    return cues


def limiter(x, thr, look_s=0.004, rel_s=0.08):
    """Look-ahead peak limiter on the stereo max, smooth release."""
    from scipy.ndimage import minimum_filter1d
    from scipy.signal import lfilter
    a = np.max(np.abs(x), axis=1)
    need = np.minimum(1.0, thr / np.maximum(a, 1e-12))
    if need.min() >= 1.0:
        return x
    la = int(look_s * SR)
    g = minimum_filter1d(need, size=2 * la + 1, mode="nearest")
    # release smoothing: one-pole on the gain, then take the min so attacks stay instant
    coef = np.exp(-1 / (rel_s * SR))
    sm = lfilter([1 - coef], [1, -coef], g - 1.0, zi=[0.0])[0] + 1.0
    g = np.minimum(g, sm)
    k = np.hanning(la) / np.hanning(la).sum()
    g = np.minimum(g, np.convolve(np.pad(g, (la, la), mode="edge"), k, mode="same")[la:-la])
    return x * g[:, None]


def main(verbose=False):
    lib, offsets, variants, get = load_library()
    cues = load_cues()
    out = np.zeros((NTOT, 2))
    placed, skipped = 0, 0
    last_var, rr = {}, {}
    for c in cues:
        name = c["sfx"]
        base = name
        if name in variants:  # pick a variant
            vs = variants[name]
            if name in ROUND_ROBIN:
                idx = rr.get(name, 0)
                rr[name] = idx + 1
                name = vs[idx % len(vs)]
            else:
                h = zlib.crc32(f"{c['src']}|{c['i']}|{c['t']:.4f}|{name}".encode())
                choice = vs[h % len(vs)]
                if choice == last_var.get(base) and len(vs) > 1:
                    choice = vs[(vs.index(choice) + 1 + (h >> 8) % (len(vs) - 1)) % len(vs)]
                last_var[base] = choice
                name = choice
        if name not in lib:
            warn(f"{c['src']}[{c['i']}] t={c['t']:.3f}: unknown sfx '{c['sfx']}'; skipped")
            skipped += 1
            continue
        x = get(name)
        anchor = int(round(offsets.get(name, offsets.get(base, 0.0)) * SR))
        start = int(round(c["t"] * SR)) - anchor
        a, b = max(0, start), min(NTOT, start + x.shape[0])
        if b <= a:
            warn(f"{c['src']}[{c['i']}] t={c['t']:.3f}: '{name}' falls outside 0–45 s; skipped")
            skipped += 1
            continue
        seg = x[a - start:b - start] * c["gain"]
        if c["pan"]:
            th = (c["pan"] + 1) * np.pi / 4
            seg = seg * np.array([np.cos(th), np.sin(th)]) * np.sqrt(2)
            seg = seg / max(1.0, np.sqrt(2) * max(np.cos(th), np.sin(th)))  # no boost on the hard side
        out[a:b] += seg
        placed += 1
        if verbose:
            print(f"  {c['t']:7.3f}s  {name:14s} gain {c['gain']:.2f} pan {c['pan']:+.2f}  ({c['src']})")

    raw_peak = np.abs(out).max()
    thr = 10 ** ((CEIL_DB - 0.3) / 20)
    out = limiter(out, thr)
    # soft safety knee for anything the limiter missed, then hard guarantee
    ceil = 10 ** (CEIL_DB / 20)
    over = np.abs(out) > thr
    if over.any():
        out[over] = np.sign(out[over]) * (thr + (ceil - thr) * np.tanh((np.abs(out[over]) - thr) / (ceil - thr)))
    out = np.clip(out, -ceil * 0.999, ceil * 0.999)
    # 5 ms fade at the very end so a cut-off tail never clicks
    k = int(0.005 * SR)
    out[-k:] *= np.cos(np.linspace(0, np.pi / 2, k))[:, None] ** 2
    assert out.shape == (NTOT, 2)

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    sf.write(OUT, out.astype(np.float32), SR, subtype="PCM_24")
    pk = np.abs(out).max()
    pk_db = 20 * np.log10(pk) if pk > 0 else float("-inf")
    raw_db = 20 * np.log10(raw_peak) if raw_peak > 0 else float("-inf")
    files = len(glob.glob(os.path.join(CUE_DIR, "*.json")))
    print(f"placed {placed} cues from {files} cue file(s), skipped {skipped}; "
          f"pre-limit peak {raw_db:.1f} dBFS -> {pk_db:.2f} dBFS; wrote {OUT} ({NTOT / SR:.3f} s)")


if __name__ == "__main__":
    main(verbose="--verbose" in sys.argv or "-v" in sys.argv)
