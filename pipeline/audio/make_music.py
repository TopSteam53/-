#!/usr/bin/env python3
"""
make_music.py - procedural chiptune / game-pop instrumental generator (100% synthesized, no samples).

Every sound (drums, bass, pads, arps, lead, risers, cymbals, reverb) is generated with numpy/scipy
from oscillators and filtered noise (see synthlib.py). The motif and chord loop are original, so the
output is safe from copyright claims on TikTok/YouTube.

USAGE
    python pipeline/audio/make_music.py --duration 58 --bpm 124 --seed 1 \
        --out assets/music/track_ep01.wav \
        [--sections "intro:0,main:2.0,break:30,build:38,drop:44,outro:54"] \
        [--snap bar|beat] [--key 0] [--lufs -14] [--swing 0.57]

    --duration  total length in seconds (the track ends on a final hit + short tail at exactly this length)
    --bpm       tempo (4/4). Beat grid starts at t=0 (the very first sample is beat 1 of bar 1).
    --seed      RNG seed: humanisation, hat ghost notes, fills, small melodic variations. Same seed -> same file.
    --sections  comma list name:start_seconds. Names: intro, main, break, build, drop, outro
                (a trailing digit is allowed for repeats, e.g. main2, drop2). Times are snapped to the nearest
                bar (or beat with --snap beat). If omitted, a layout proportional to --duration is used
                (break ~52%, build ~65%, drop ~76%, outro ~93% of the duration).
    --key       transpose in semitones (default 0 = C major / A minor).
    --lufs      integrated loudness target of the master (default -14 LUFS); true peak is limited to -1 dBTP.

OUTPUT
    <out>.wav   48 kHz / 24-bit stereo
    <out>.json  bpm, beat/bar times (seconds, for syncing video cuts), sections (snapped), drop time,
                final-hit time, accent (impact) times, measured loudness/peak.

SECTIONS (musical content)
    intro  : 1-bar full-band hit at 0 s (crash + kick + chord stab), drums in, snare pickup -> hook starts at once
    main   : four-on-the-floor groove, swung hats, pumping triangle/saw bass + pads, 12.5% pulse arp,
             25% pulse lead motif (rests every 3rd 4-bar phrase to leave room for voice)
    break  : no drums, soft sustained pads + music-box arp + gentle melody in minor (the "sad/honest" moment)
    build  : rising chord steps, snare roll accelerating, noise riser + high-pass sweep, half-beat gap
    drop   : everything + octave-doubled lead, second arp, open hats, saw bass, impact on the downbeat
    outro  : groove without lead, IV-V cadence into a final tonic hit with a clean decaying tail
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from synthlib import (  # noqa: E402
    SR, add_at, apply_reverb, compressor, dc_block, db2lin, env_adsr, env_exp, fade, highpass,
    integrated_lufs, limiter, lowpass, make_reverb_ir, midi2hz, n_samples, noise, osc_pulse, osc_saw,
    osc_sine, osc_tri, pan_stereo, pingpong_delay, sample_peak_db, saturate, sidechain_env,
    true_peak_db, tv_filter, bandpass, write_wav,
)

SECTION_TYPES = ("intro", "main", "break", "build", "drop", "outro")
DEFAULT_FRACTIONS = [("break", 30 / 58), ("build", 38 / 58), ("drop", 44 / 58), ("outro", 54 / 58)]

# ------------------------------------------------------------------------------------------ harmony
# chord = (bass root midi, chord-tone pitch classes relative to C)
CHORDS = {
    "C": (36, [0, 4, 7]),
    "Dm": (38, [2, 5, 9]),
    "E": (40, [4, 8, 11]),
    "Em": (40, [4, 7, 11]),
    "F": (41, [5, 9, 0]),
    "G": (43, [7, 11, 2]),
    "Am": (45, [9, 0, 4]),
}
PROG_MAIN = ["F", "G", "Em", "Am"]      # IV V iii vi  (game-pop staple progression, not a melody)
PROG_BREAK = ["Am", "F", "Dm", "E"]     # bittersweet minor turn
PROG_BUILD = ["Dm", "Em", "F", "G"]     # stepwise climb, always ends on G (V) before the drop
PROG_OUTRO = ["F", "G"]                 # IV V -> final I

# Original lead motif, (step16, midi, length16). Two 4-bar phrases A/B.
PHRASE_A = [
    [(0, 69, 2), (2, 72, 2), (4, 77, 3), (7, 76, 1), (8, 77, 2), (10, 79, 2), (12, 81, 4)],
    [(0, 79, 2), (2, 74, 2), (4, 71, 2), (6, 74, 2), (8, 79, 3), (11, 81, 1), (12, 83, 2), (14, 81, 2)],
    [(0, 79, 3), (3, 76, 1), (4, 71, 2), (6, 76, 2), (8, 79, 2), (10, 83, 2), (12, 81, 2), (14, 79, 2)],
    [(0, 76, 4), (4, 72, 2), (6, 74, 2), (8, 76, 6)],
]
PHRASE_B_TAIL_VARIANTS = [
    [
        [(0, 79, 2), (2, 81, 2), (4, 83, 2), (6, 86, 2), (8, 83, 3), (11, 79, 1), (12, 76, 4)],
        [(0, 84, 3), (3, 83, 1), (4, 81, 4), (8, 76, 2), (10, 81, 6)],
    ],
    [
        [(0, 83, 2), (2, 81, 2), (4, 79, 2), (6, 83, 2), (8, 86, 4), (12, 83, 2), (14, 79, 2)],
        [(0, 81, 3), (3, 79, 1), (4, 76, 2), (6, 79, 2), (8, 81, 8)],
    ],
]
BREAK_MELODY = [
    [(0, 76, 6), (6, 74, 2), (8, 72, 8)],
    [(0, 69, 6), (6, 72, 2), (8, 77, 8)],
    [(0, 77, 4), (4, 76, 4), (8, 74, 8)],
    [(0, 71, 8), (8, 68, 4), (12, 71, 4)],
]
INTRO_PICKUP = [(12, 67, 1), (13, 69, 1), (14, 71, 1), (15, 72, 1)]


def voice_chord(pcs, lo, hi):
    """Place pitch classes into [lo, hi) range, sorted."""
    out = []
    for pc in pcs:
        m = lo + ((pc - lo) % 12)
        if m >= hi:
            m -= 12
        out.append(m)
    return sorted(out)


# ------------------------------------------------------------------------------------------ instruments
class Synth:
    def __init__(self, rng: np.random.Generator):
        self.rng = rng

    # --- drums
    def kick(self, vel=1.0, hard=False):
        n = n_samples(0.42)
        t = np.arange(n) / SR
        f = 50 + 110 * np.exp(-t / 0.035) + 260 * np.exp(-t / 0.0035)
        body = osc_sine(f, n) * (np.exp(-t / (0.17 if hard else 0.13)))
        click = highpass(noise(n, self.rng), 1800) * np.exp(-t / 0.0025) * 0.9
        x = saturate(body * 1.25 + click, 1.8 if hard else 1.4)
        return fade(x * vel, 0.0005, 0.03)

    def snare(self, vel=1.0, tune=1.0):
        n = n_samples(0.3)
        t = np.arange(n) / SR
        f = 190 * tune * (1 + 0.35 * np.exp(-t / 0.012))
        body = osc_sine(f, n) * np.exp(-t / 0.06) + 0.5 * osc_sine(f * 1.72, n) * np.exp(-t / 0.035)
        nz = noise(n, self.rng)
        snap = bandpass(nz, 1500, 9000) * np.exp(-t / 0.11)
        sizzle = highpass(nz, 6000) * np.exp(-t / 0.06) * 0.6
        x = saturate(0.8 * body + 1.4 * snap + sizzle, 1.3)
        return fade(x * vel, 0.0005, 0.02)

    def clap(self, vel=1.0):
        n = n_samples(0.3)
        t = np.arange(n) / SR
        nz = bandpass(noise(n, self.rng), 900, 5200)
        env = np.zeros(n)
        for k, off in enumerate((0.0, 0.009, 0.019)):
            s = int(off * SR)
            env[s:] = np.maximum(env[s:], np.exp(-(t[: n - s]) / 0.006) * (0.8 + 0.1 * k))
        s = int(0.019 * SR)
        env[s:] = np.maximum(env[s:], 0.9 * np.exp(-t[: n - s] / 0.11))
        return fade(nz * env * vel * 1.8, 0.0005, 0.02)

    def _metal(self, n, base=320.0):
        ratios = [2.0, 3.0, 4.16, 5.43, 6.79, 8.21]
        return sum(osc_pulse(base * r * self.rng.uniform(0.99, 1.01), n, 0.5) for r in ratios) / 6.0

    def hat(self, vel=1.0, open_=False):
        n = n_samples(0.35 if open_ else 0.09)
        t = np.arange(n) / SR
        src = 0.6 * self._metal(n) + 0.9 * noise(n, self.rng)
        x = highpass(src, 7200, order=4)
        tau = 0.12 if open_ else 0.022
        return fade(x * np.exp(-t / tau) * vel, 0.0003, 0.01)

    def crash(self, vel=1.0, length=1.8):
        n = n_samples(length)
        t = np.arange(n) / SR
        chans = []
        for _ in range(2):
            src = 0.5 * self._metal(n, base=self.rng.uniform(300, 360)) + noise(n, self.rng)
            x = highpass(src, 3800, order=2)
            x = x * (0.55 * np.exp(-t / 0.45) + 0.45 * np.exp(-t / 0.05))
            chans.append(fade(x, 0.0005, 0.2))
        return np.array(chans) * vel

    def sub_boom(self, vel=1.0):
        n = n_samples(0.9)
        t = np.arange(n) / SR
        f = 38 + 45 * np.exp(-t / 0.12)
        x = osc_sine(f, n) * np.exp(-t / 0.35)
        return fade(saturate(x * 1.3, 1.5) * vel, 0.001, 0.1)

    # --- tonal
    def bass(self, midi, dur, style="main"):
        n_on = n_samples(dur)
        env = env_adsr(n_on, a=0.003, d=0.12, s=0.75, r=0.03)
        n = len(env)
        f = midi2hz(midi)
        tri = osc_tri(f, n, steps=32)
        saw = osc_saw(f, n)
        t = np.arange(n) / SR
        if style == "drop":
            x = 0.55 * tri + 0.65 * saw + 0.25 * osc_pulse(f * 0.5, n, 0.25)
            x = tv_filter(x, 500 + 2600 * np.exp(-t / 0.09), "lp", q=1.1)
            x = saturate(x, 2.0)
        elif style == "soft":
            x = 0.9 * tri + 0.15 * osc_sine(f, n)
            x = lowpass(x, 1200)
        else:
            x = 0.8 * tri + 0.35 * lowpass(saw, 1400)
            x = saturate(x, 1.3)
        return x * env

    def pad(self, midis, dur, bright=3200.0, soft=False):
        n_on = n_samples(dur)
        env = env_adsr(n_on, a=0.25 if soft else 0.012, d=0.4, s=0.75 if soft else 0.62, r=0.35 if soft else 0.18)
        n = len(env)
        L = np.zeros(n)
        R = np.zeros(n)
        for m in midis:
            f = midi2hz(m)
            ph = self.rng.uniform(0, 1, 4)
            L += osc_saw(f * 2 ** (-9 / 1200), n, phase0=ph[0]) + 0.6 * osc_pulse(f * 2 ** (5 / 1200), n, 0.3, phase0=ph[1])
            R += osc_saw(f * 2 ** (9 / 1200), n, phase0=ph[2]) + 0.6 * osc_pulse(f * 2 ** (-5 / 1200), n, 0.3, phase0=ph[3])
        st = np.stack([L, R]) / max(1, len(midis))
        st = lowpass(st, bright, order=2)
        return st * env

    def arp_note(self, midi, dur, duty=0.125, soft=False):
        n_on = n_samples(dur)
        if soft:
            env = env_adsr(n_on, a=0.004, d=0.25, s=0.25, r=0.2)
            n = len(env)
            x = 0.8 * osc_tri(midi2hz(midi), n) + 0.25 * osc_sine(midi2hz(midi) * 2, n)
        else:
            env = env_adsr(n_on, a=0.001, d=0.07, s=0.35, r=0.025)
            n = len(env)
            x = lowpass(osc_pulse(midi2hz(midi), n, duty), 7000)
        return x * env

    def lead_note(self, midi, dur, style="main"):
        n_on = n_samples(dur)
        if style == "soft":
            env = env_adsr(n_on, a=0.02, d=0.3, s=0.6, r=0.25)
        else:
            env = env_adsr(n_on, a=0.003, d=0.12, s=0.72, r=0.07)
        n = len(env)
        t = np.arange(n) / SR
        chirp = 0.6 * np.exp(-t / 0.012)                     # tiny upper chirp on attack (chip flavour)
        vib = 0.22 * np.clip((t - 0.13) / 0.12, 0, 1) * np.sin(2 * np.pi * 5.8 * t)
        f = midi2hz(midi + chirp + vib)
        if style == "soft":
            x = 0.85 * osc_tri(f, n) + 0.25 * osc_pulse(f, n, 0.5)
            return lowpass(x, 3000) * env
        x = osc_pulse(f, n, 0.25)
        if style == "drop":
            x = 0.7 * x + 0.35 * osc_saw(f * 2 ** (11 / 1200), n) + 0.3 * osc_pulse(f * 0.5, n, 0.5)
        return lowpass(x, 8000) * env

    def stab(self, midis, tau=0.35, length=1.6):
        n = n_samples(length)
        t = np.arange(n) / SR
        L = np.zeros(n)
        R = np.zeros(n)
        for m in midis:
            f = midi2hz(m)
            L += osc_saw(f * 2 ** (-7 / 1200), n) + 0.5 * osc_pulse(f, n, 0.25)
            R += osc_saw(f * 2 ** (7 / 1200), n) + 0.5 * osc_pulse(f, n, 0.25)
        st = np.stack([L, R]) / len(midis)
        fc = 700 + 6000 * np.exp(-t / (tau * 0.8))
        st = np.stack([tv_filter(st[c], fc, "lp", q=0.9) for c in range(2)])
        return fade(st * np.exp(-t / tau), 0.001, 0.25)

    def riser(self, length):
        n = n_samples(length)
        t = np.arange(n) / SR
        u = t / length
        fc = 300 * (9000 / 300) ** (u ** 1.3)
        chans = []
        for _ in range(2):
            nz = noise(n, self.rng)
            chans.append(tv_filter(nz, fc, "bp", q=1.4) * 2.5)
        st = np.array(chans)
        tone = lowpass(osc_saw(midi2hz(55 + 24 * u ** 1.5), n), 5000) * 0.25
        st = st + tone
        amp = db2lin(-32 + 28 * u ** 1.4)
        return fade(st * amp, 0.01, 0.004)


# ------------------------------------------------------------------------------------------ arrangement
def parse_sections(spec, duration, bar, beat, snap):
    if spec:
        items = []
        for part in spec.split(","):
            part = part.strip()
            if not part:
                continue
            name, t = part.split(":")
            items.append((name.strip(), float(t)))
    else:
        items = [("intro", 0.0), ("main", bar)] + [(nm, f * duration) for nm, f in DEFAULT_FRACTIONS]
    grid = bar if snap == "bar" else beat
    out = []
    for name, t in sorted(items, key=lambda x: x[1]):
        kind = re.sub(r"\d+$", "", name.lower())
        if kind not in SECTION_TYPES:
            raise SystemExit(f"unknown section type '{name}' (allowed: {', '.join(SECTION_TYPES)})")
        ts = round(t / grid) * grid
        if out and ts <= out[-1][2] + 1e-9:
            ts = out[-1][2] + grid  # keep strictly increasing
        out.append((name, kind, ts))
    if not out or out[0][2] > 1e-9:
        out.insert(0, ("intro", "intro", 0.0))
    out[0] = (out[0][0], out[0][1], 0.0)
    return out


def final_hit_time(duration, sections, bar, beat, min_tail=1.45, max_tail=2.6):
    """Latest musical grid point leaving a tail of at least min_tail seconds (bar > half-bar > beat)."""
    limit = duration - min_tail
    last_start = sections[-1][2]
    for grid in (bar, bar / 2, beat):
        t = np.floor(limit / grid + 1e-9) * grid
        if duration - t <= max_tail and t > last_start - 1e-9:
            return t
    return max(np.floor(limit / beat + 1e-9) * beat, beat)


def build_timeline(args):
    beat = 60.0 / args.bpm
    bar = 4 * beat
    step = beat / 4
    D = args.duration
    secs = parse_sections(args.sections, D, bar, beat, args.snap)
    t_end = final_hit_time(D, secs, bar, beat)
    secs = [s for s in secs if s[2] < t_end - 1e-9]
    bounds = [s[2] for s in secs] + [t_end]
    sections = [dict(name=s[0], kind=s[1], start=bounds[i], end=bounds[i + 1]) for i, s in enumerate(secs)]
    return beat, bar, step, sections, t_end


def render(args):
    rng = np.random.default_rng(args.seed)
    syn = Synth(rng)
    beat, bar, step, sections, t_hit = build_timeline(args)
    D = args.duration
    N = n_samples(D)
    tr = {k: np.zeros((2, N)) for k in
          ("kick", "snare", "hats", "cym", "bass", "pads", "arp", "lead", "fx", "stab")}
    send = np.zeros((2, N))       # reverb send bus
    lead_dry_mono = np.zeros(N)   # feeds ping-pong delay
    kicks = []
    accents = []
    K = args.key
    swing_off = (args.swing - 0.5) * 2 * step
    b_variant = PHRASE_B_TAIL_VARIANTS[int(rng.integers(0, len(PHRASE_B_TAIL_VARIANTS)))] if args.seed != 1 \
        else PHRASE_B_TAIL_VARIANTS[0]

    def S(t):
        return int(round(t * SR))

    def put(name, x, t, pan=0.0, gain=1.0, rev=0.0):
        st = pan_stereo(x, pan) if x.ndim == 1 else x
        add_at(tr[name], st * gain, S(t))
        if rev > 0:
            add_at(send, st * gain * rev, S(t))

    def hum(v, amt=0.08):
        return v * (1 + rng.uniform(-amt, amt))

    def section_at(t):
        for s in sections:
            if s["start"] - 1e-9 <= t < s["end"] - 1e-9:
                return s
        return None

    n_bars = int(np.ceil(t_hit / bar))
    for bi in range(n_bars):
        b0 = bi * bar
        for st16 in range(16):
            t = b0 + st16 * step
            if t >= t_hit - 1e-9:
                break
            sec = section_at(t)
            kind = sec["kind"]
            sec_bar0 = int(np.floor(sec["start"] / bar + 1e-9))
            rb = bi - sec_bar0                                    # bar index within section
            sec_bars = int(round((sec["end"] - sec_bar0 * bar) / bar))
            to_end = sec["end"] - t                                # seconds until section change
            last_bar = to_end <= bar + 1e-9
            swung = t + (swing_off if st16 % 2 == 1 else 0.0)
            is_beat = st16 % 4 == 0

            # ---------------------------------------------------------------- chord for this bar
            if kind == "break":
                chord = PROG_BREAK[rb % 4]
            elif kind == "build":
                chord = PROG_BUILD[(rb - sec_bars) % 4]
            elif kind == "outro":
                bars_left = int(round((t_hit - b0) / bar))
                chord = PROG_OUTRO[(-bars_left) % 2]
            elif kind == "intro":
                chord = "C"
            else:
                chord = PROG_MAIN[rb % 4]
            root, pcs = CHORDS[chord]
            root += K
            pcs = [(p + K) % 12 for p in pcs]

            # ---------------------------------------------------------------- drums
            gap = kind == "build" and to_end <= beat / 2 + 1e-9   # half-beat silence before the drop
            if kind in ("intro", "main", "drop", "outro", "build") and not gap:
                # kick: four on the floor (build keeps quarters but drops out in last bar)
                if is_beat and not (kind == "build" and last_bar and sec_bars > 1):
                    hard = kind == "drop" or abs(t - sec["start"]) < 1e-6
                    put("kick", syn.kick(hum(1.0, 0.03), hard=hard), t)
                    kicks.append(S(t))
                if kind in ("main", "drop") and rb % 4 == 3 and st16 == 14 and rng.random() < 0.6:
                    put("kick", syn.kick(0.7), t)
                    kicks.append(S(t))
                # snare / clap backbeat
                fill = last_bar and kind != "build" and st16 >= 12
                if kind == "build":
                    pos_from_end = int(np.ceil(to_end / bar - 1e-9))   # 1 = last bar
                    prog = 1 - to_end / max(sec["end"] - sec["start"], 1e-6)
                    if pos_from_end == 1:
                        hit_now = True                      # 16ths
                    elif pos_from_end == 2:
                        hit_now = st16 % 2 == 0             # 8ths
                    else:
                        hit_now = st16 in (4, 12)           # backbeat
                    if hit_now:
                        put("snare", syn.snare(0.35 + 0.65 * prog, tune=1 + 0.25 * prog),
                            t, pan=0.05, gain=0.9, rev=0.18)
                elif fill:
                    v = 0.5 + 0.15 * (st16 - 12)
                    put("snare", syn.snare(v, tune=1.05 + 0.03 * (st16 - 12)), t, gain=0.9, rev=0.15)
                elif st16 in (4, 12):
                    put("snare", syn.snare(hum(1.0, 0.04)), t, rev=0.2)
                    put("snare", syn.clap(hum(0.9)), t + 0.004, pan=0.12, gain=0.8, rev=0.3)
                elif kind in ("main", "drop") and st16 in (7, 15) and rng.random() < 0.18:
                    put("snare", syn.snare(0.22), swung, pan=-0.1, gain=0.8)
                # hats
                if kind != "build" or not last_bar:
                    if kind == "drop":
                        if st16 % 4 == 2:
                            put("hats", syn.hat(hum(0.8), open_=True), t, pan=0.25, rev=0.05)
                        else:
                            put("hats", syn.hat(hum([1.0, 0.5, 0.5, 0.55][st16 % 4])), swung, pan=-0.2)
                    elif kind in ("main", "outro", "intro"):
                        v = [0.95, 0.4, 0.7, 0.45][st16 % 4]
                        if st16 % 2 == 0 or rng.random() < 0.7:
                            put("hats", syn.hat(hum(v)), swung + rng.uniform(-0.002, 0.002), pan=-0.18)
                    elif kind == "build" and st16 % 2 == 0:
                        put("hats", syn.hat(0.6), t, pan=-0.18)
            if kind == "break" and last_bar and st16 % 2 == 0 and not gap:
                put("hats", syn.hat(0.25 + 0.4 * (st16 / 16)), swung, pan=-0.18)

            # ---------------------------------------------------------------- cymbals / impacts
            if abs(t - sec["start"]) < 1e-6 and kind in ("intro", "main", "drop", "break"):
                put("cym", syn.crash(1.0 if kind != "break" else 0.6), t, rev=0.25)
                accents.append(round(t, 4))
                if kind in ("intro", "drop"):
                    put("kick", syn.sub_boom(), t, gain=0.8)
            elif kind in ("main", "drop") and st16 == 0 and rb > 0 and rb % 8 == 0:
                put("cym", syn.crash(0.55), t, rev=0.2)

            # ---------------------------------------------------------------- bass
            if gap:
                pass
            elif kind == "break":
                if st16 == 0:
                    put("bass", syn.bass(root, bar * 0.97, "soft"), t, gain=0.55)
            elif kind == "build":
                if st16 % 2 == 0:
                    put("bass", syn.bass(root + (12 if st16 % 4 == 2 else 0), step * 1.7), t)
            elif kind == "intro":
                if st16 == 0:
                    put("bass", syn.bass(root, beat * 1.8, "drop"), t)
                elif st16 >= 8 and st16 % 2 == 0:
                    put("bass", syn.bass(root + (12 if st16 % 4 == 2 else 0), step * 1.6), t)
            else:
                style = "drop" if kind == "drop" else "main"
                if st16 % 2 == 0:
                    oct_ = 12 if st16 % 4 == 2 else 0
                    note = root + oct_
                    if st16 == 14 and rb % 2 == 1:
                        note = root + 7          # fifth pickup for movement
                    put("bass", syn.bass(note, step * 1.75, style), t)

            # ---------------------------------------------------------------- pads (one chord per bar)
            if st16 == 0 and not gap:
                voiced = voice_chord(pcs, 55, 67)
                if kind == "break":
                    put("pads", syn.pad(voiced + [voiced[0] + 12], bar * 0.98, bright=1600, soft=True), t, gain=0.6, rev=0.55)
                elif kind in ("main", "drop", "outro", "build"):
                    d = bar * 0.95 if not (kind == "build" and last_bar) else bar - beat / 2 - 0.2
                    put("pads", syn.pad(voiced, d, bright=4200 if kind == "drop" else 3000), t, rev=0.3)
                elif kind == "intro":
                    put("stab", syn.stab(voiced + [voiced[0] + 12, voiced[1] + 12], tau=0.45, length=bar),
                        t, rev=0.4)

            # ---------------------------------------------------------------- arps
            arp_tones = voice_chord(pcs, 72, 84)
            arp_tones = arp_tones + [arp_tones[0] + 12]
            up_down = [0, 1, 2, 3, 2, 1, 0, 1]
            if gap:
                pass
            elif kind in ("main", "drop", "outro", "build"):
                idx = up_down[st16 % 8]
                if kind == "build":
                    idx = st16 % 4
                m = arp_tones[idx]
                g = 0.9 if (kind == "main" and (rb // 4) % 3 == 2) else 0.7
                put("arp", syn.arp_note(m, step * 0.6), swung, pan=0.35, gain=g, rev=0.15)
                if kind == "drop":
                    m2 = arp_tones[[3, 2, 1, 0][st16 % 4]] + 12
                    put("arp", syn.arp_note(m2, step * 0.45, duty=0.25), swung,
                        pan=-0.45, gain=0.35, rev=0.2)
            elif kind == "break" and st16 % 2 == 0:
                m = arp_tones[[0, 2, 1, 3, 2, 1, 3, 2][(st16 // 2) % 8]]
                put("arp", syn.arp_note(m, step * 1.8, soft=True), t, pan=0.3 * (1 if st16 % 4 else -1),
                    gain=0.6, rev=0.5)

            # ---------------------------------------------------------------- lead
            if st16 == 0 and not gap:
                notes = []
                style = None
                if kind == "main" and (rb // 4) % 3 != 2:
                    phrase = PHRASE_A if (rb // 4) % 2 == 0 else PHRASE_A[:2] + b_variant
                    notes, style, shift = phrase[rb % 4], "main", 0
                elif kind == "drop":
                    phrase = PHRASE_A if (rb // 4) % 2 == 0 else PHRASE_A[:2] + b_variant
                    notes, style, shift = phrase[rb % 4], "drop", 12
                elif kind == "break":
                    notes, style, shift = BREAK_MELODY[rb % 4], "soft", 0
                elif kind == "intro":
                    notes, style, shift = INTRO_PICKUP, "main", 0
                for s16, m, ln in notes:
                    tn = b0 + s16 * step
                    if tn >= sec["end"] - 1e-9:
                        continue
                    ln_s = min(ln * step * 0.92, sec["end"] - tn - 0.01)
                    x = syn.lead_note(m + K + (shift if style == "drop" else 0), ln_s, style)
                    gain = {"main": 0.85, "drop": 0.9, "soft": 0.55}[style]
                    put("lead", x, tn, gain=gain, rev=0.22 if style != "soft" else 0.45)
                    add_at(lead_dry_mono, x * gain, S(tn))
                    if style == "drop":  # octave-down doubling, slightly left/right spread
                        x2 = syn.lead_note(m + K, ln_s, "main")
                        put("lead", x2, tn, pan=-0.25, gain=0.35)
                        put("lead", x2, tn + 0.012, pan=0.25, gain=0.35)

    # -------------------------------------------------------------------- build riser (once per build)
    for sec in sections:
        if sec["kind"] == "build":
            L = sec["end"] - sec["start"]
            put("fx", syn.riser(L), sec["start"], gain=1.0, rev=0.1)

    # ---------------------------------------------------------------- final hit
    fin_root, fin_pcs = CHORDS["C"]
    fin_root += K
    fin_pcs = [(p + K) % 12 for p in fin_pcs]
    tail = D - t_hit
    voiced = voice_chord(fin_pcs, 60, 72)
    put("stab", syn.stab(voiced + [voiced[0] + 12, voiced[0] - 12], tau=0.6, length=tail), t_hit, gain=1.1, rev=0.5)
    put("kick", syn.kick(1.0, hard=True), t_hit)
    put("kick", syn.sub_boom(), t_hit, gain=0.8)
    put("cym", syn.crash(1.0, length=tail), t_hit, rev=0.3)
    fb = syn.bass(fin_root, tail * 0.9, "drop")
    fb = fade(fb * env_exp(len(fb), 0.45), 0.0, 0.3)
    put("bass", fb, t_hit)
    x = syn.lead_note(84 + K, min(tail * 0.5, 0.9), "main")
    put("lead", x, t_hit, gain=0.6, rev=0.5)
    accents.append(round(t_hit, 4))

    # ---------------------------------------------------------------- build high-pass sweep on music buses
    for sec in sections:
        if sec["kind"] == "build":
            xf = int(0.006 * SR)                      # crossfade back to the dry bus after the build
            s0, s1 = S(sec["start"]), min(N, S(sec["end"]))
            s2 = min(N, s1 + xf)
            u = np.clip(np.linspace(0, (s2 - s0) / max(s1 - s0, 1), s2 - s0), 0, 1)
            fc = 25 * (500 / 25) ** (u ** 1.5)
            w = np.ones(s2 - s0)
            w[s1 - s0:] = np.linspace(1, 0, s2 - s1)
            for name in ("bass", "pads", "arp"):
                for c in range(2):
                    seg = tr[name][c, s0:s2].copy()
                    tr[name][c, s0:s2] = w * tv_filter(seg, fc, "hp", q=0.8) + (1 - w) * seg

    # ---------------------------------------------------------------- sidechain pumping
    sc_strong = sidechain_env(N, kicks, depth=0.72, release_s=beat * 0.55)
    sc_light = sidechain_env(N, kicks, depth=0.35, release_s=beat * 0.45)
    tr["bass"] *= sc_strong
    tr["pads"] *= sc_strong
    tr["arp"] *= sc_light

    # ---------------------------------------------------------------- mix
    gains = dict(kick=0.55, snare=0.5, hats=0.34, cym=0.2, bass=0.4, pads=0.3, arp=0.42,
                 lead=0.32, fx=0.9, stab=0.35)
    mix = np.zeros((2, N))
    for k, g in gains.items():
        mix += tr[k] * g
    # ping-pong delay on lead (dotted 8th)
    dl = pingpong_delay(lead_dry_mono, beat * 0.75, feedback=0.38, repeats=5)
    add_at(mix, dl[:, :N] * gains["lead"] * 0.55, 0)
    # reverb
    ir = make_reverb_ir(np.random.default_rng(args.seed + 1000), seconds=2.2, rt60=1.5, width=1.0)
    wet = apply_reverb(highpass(send, 250), ir)[:, :N]
    mix += wet * 0.3

    # tail fade so the final hit decays to digital silence exactly at the end
    t = np.arange(N) / SR
    f0 = t_hit + 0.45 * tail
    fo = np.clip((t - f0) / max(D - f0, 1e-3), 0, 1)
    mix *= (0.5 + 0.5 * np.cos(np.pi * fo)) ** 1.5
    mix = fade(mix, 0.002, 0.02)

    return mix, dict(beat=beat, bar=bar, sections=sections, t_hit=t_hit, accents=accents,
                     stems={k: tr[k] * gains[k] for k in gains})


def master(mix, target_lufs=-14.0, ceiling_db=-1.0):
    x = dc_block(mix, fc=28.0)
    x = x / (np.max(np.abs(x)) + 1e-12) * db2lin(-6)
    x = compressor(x, thresh_db=-14, ratio=2.0, attack=0.008, release=0.12)
    gain_db = 0.0
    y = x
    for _ in range(6):
        lu = integrated_lufs(x * db2lin(gain_db))
        gain_db += target_lufs - lu
        y = limiter(x * db2lin(gain_db), ceiling_db=ceiling_db - 0.2)
        if abs(integrated_lufs(y) - target_lufs) < 0.1:
            break
    # final safety: sample peaks strictly under the ceiling
    pk = np.max(np.abs(y))
    if pk > db2lin(ceiling_db - 0.1):
        y *= db2lin(ceiling_db - 0.1) / pk
    y = fade(y, 0.002, 0.02)
    return y


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--duration", type=float, default=58.0)
    ap.add_argument("--bpm", type=float, default=124.0)
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--out", default="assets/music/track_ep01.wav")
    ap.add_argument("--sections", default=None)
    ap.add_argument("--snap", choices=("bar", "beat"), default="bar")
    ap.add_argument("--key", type=int, default=0, help="transpose semitones")
    ap.add_argument("--swing", type=float, default=0.57, help="16th swing ratio (0.5 = straight)")
    ap.add_argument("--lufs", type=float, default=-14.0)
    ap.add_argument("--stems", default=None, help="optional dir to also dump raw stems (debug)")
    args = ap.parse_args()
    if args.duration < 6:
        raise SystemExit("--duration must be >= 6 s")

    mix, info = render(args)
    y = master(mix, args.lufs)
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    write_wav(args.out, y)

    if args.stems:
        os.makedirs(args.stems, exist_ok=True)
        for k, v in info["stems"].items():
            write_wav(os.path.join(args.stems, f"{k}.wav"), v * 0.5)

    beat, bar, t_hit = info["beat"], info["bar"], info["t_hit"]
    nb = int(np.floor(t_hit / beat + 1e-9)) + 1
    beats = [round(i * beat, 4) for i in range(nb)]
    bars = [round(i * bar, 4) for i in range(int(np.floor(t_hit / bar + 1e-9)) + 1)]
    lufs = integrated_lufs(y)
    meta = {
        "file": os.path.basename(args.out),
        "generator": "pipeline/audio/make_music.py",
        "seed": args.seed,
        "sample_rate": SR,
        "channels": 2,
        "duration": round(args.duration, 4),
        "bpm": args.bpm,
        "time_signature": "4/4",
        "beat_duration": round(beat, 6),
        "bar_duration": round(bar, 6),
        "key": f"C major / A minor transposed {args.key:+d} st",
        "sections": [dict(name=s["name"], type=s["kind"], start=round(s["start"], 4), end=round(s["end"], 4),
                          start_bar=int(round(s["start"] / bar, 6)) if args.snap == "bar" else round(s["start"] / bar, 3))
                     for s in info["sections"]],
        "drop_times": [round(s["start"], 4) for s in info["sections"] if s["kind"] == "drop"],
        "final_hit": round(t_hit, 4),
        "accents": sorted(set(info["accents"])),
        "beats": beats,
        "bars": bars,
        "notes": "beats/bars run from 0 to the final hit (inclusive); after final_hit only the decaying tail plays. "
                 "Section times were snapped to the " + args.snap + " grid.",
        "loudness_lufs": round(lufs, 2),
        "true_peak_dbtp": round(true_peak_db(y), 2),
        "sample_peak_dbfs": round(sample_peak_db(y), 2),
    }
    js = os.path.splitext(args.out)[0] + ".json"
    with open(js, "w") as f:
        json.dump(meta, f, indent=1)
    print(f"wrote {args.out}  ({args.duration:.2f}s, {lufs:.2f} LUFS, TP {meta['true_peak_dbtp']} dBTP)")
    for s in meta["sections"]:
        print(f"  {s['name']:<7} {s['start']:7.3f} -> {s['end']:7.3f}")
    print(f"  final hit {t_hit:.3f}s; json -> {js}")


if __name__ == "__main__":
    main()
