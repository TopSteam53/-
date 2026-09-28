#!/usr/bin/env python3
"""
make_sfx.py - procedural sound-effect pack (100% synthesized with numpy/scipy, no samples, no voices).

USAGE
    python pipeline/audio/make_sfx.py [--out assets/sfx] [--seed 7] [--peak -1.0] [--only boom,hit]

Writes 48 kHz / 24-bit WAVs (mono, or stereo where width helps), each peak-normalized to --peak dBFS
with short fades at both ends, plus <out>/index.json (file, duration, channels, peak, loudness,
one-line description). Same seed -> identical files.

FILES
    whoosh_1  fast airy pass-by          whoosh_2  deep heavy swoosh       whoosh_3  reverse-style swell, sharp end
    boom      cinematic sub impact       hit       short punchy text-slam accent
    click     UI mouse click             key_typing 2.5 s mechanical keyboard typing
    pop / pop_2  bubbly cartoon pops     ding      coin/success chime      notify   chat message blip
    error     "wrong" double buzzer      glitch    digital stutter/bitcrush burst
    sad_trombone  comedic descending brass-like "wah-wah-wah-waaah" (original contour)
    record_scratch  vinyl scratch + stop riser  1.5 s tension riser (sharp end)
    sparkle   magic twinkle              camera_shake_rumble  0.5 s low rumble
"""
from __future__ import annotations

import argparse
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from synthlib import (  # noqa: E402
    SR, add_at, apply_reverb, bandpass, bitcrush, db2lin, fade, highpass,
    integrated_lufs, lowpass, make_reverb_ir, midi2hz, n_samples, noise, normalize_peak, osc_pulse,
    osc_saw, osc_sine, osc_tri, pan_stereo, peq, sample_peak_db, saturate, true_peak_db, tv_filter,
    write_wav,
)


def tt(sec):
    n = n_samples(sec)
    return n, np.arange(n) / SR


def bell(u, center, width):
    """Smooth swell curve on u in [0,1] (raised cosine bump)."""
    return np.clip(np.cos(np.clip((u - center) / width, -1, 1) * np.pi / 2), 0, 1) ** 2


class SFX:
    def __init__(self, seed):
        self.seed = seed
        self.rng = np.random.default_rng(seed)
        self.ir_small = make_reverb_ir(np.random.default_rng(seed + 11), seconds=0.9, rt60=0.6, predelay=0.006)
        self.ir_big = make_reverb_ir(np.random.default_rng(seed + 12), seconds=2.5, rt60=1.8, predelay=0.015)

    def verb(self, st, ir, wet=0.2):
        st = np.atleast_2d(st)
        if st.shape[0] == 1:
            st = np.vstack([st, st])
        w = apply_reverb(st, ir)
        out = np.zeros_like(w)
        out[:, : st.shape[1]] += st
        return out + wet * w

    # ------------------------------------------------------------------ whooshes
    def whoosh_1(self):
        """fast airy pass-by"""
        n, t = tt(0.36)
        u = t / t[-1]
        amp = bell(u, 0.55, 0.55) ** 1.2
        fc = 1800 * (9500 / 1800) ** bell(u, 0.6, 0.6)
        chans = [tv_filter(noise(n, self.rng), fc, "bp", q=0.9) for _ in range(2)]
        air = [highpass(noise(n, self.rng), 6000) * 0.4 for _ in range(2)]
        st = np.array(chans) + np.array(air)
        mono = st.mean(0) * amp
        out = pan_stereo(mono, -0.8 + 1.6 * u)
        return fade(out, 0.004, 0.03)

    def whoosh_2(self):
        """deep heavy swoosh with sub swoop"""
        n, t = tt(0.58)
        u = t / t[-1]
        amp = bell(u, 0.5, 0.5)
        fc = 180 * (1600 / 180) ** bell(u, 0.5, 0.55)
        nz = noise(n, self.rng, "pink")
        body = tv_filter(nz, fc, "lp", q=1.6) * 2.0
        swoop = osc_sine(70 + 60 * bell(u, 0.45, 0.5), n) * 0.55
        mid = tv_filter(noise(n, self.rng), fc * 2.2, "bp", q=2.0) * 0.6
        mono = saturate((body + swoop + mid) * amp, 1.4)
        st = pan_stereo(mono, -0.35 + 0.7 * u)
        st = self.verb(st, self.ir_small, 0.12)[:, :n]
        return fade(st, 0.006, 0.08)

    def whoosh_3(self):
        """reverse-reverb style swell that ends abruptly"""
        n, t = tt(0.5)
        u = t / t[-1]
        amp = (u ** 3.2) * (1 + 0.15 * np.sin(2 * np.pi * 18 * t))
        fc = 350 * (7000 / 350) ** (u ** 1.5)
        chans = [tv_filter(noise(n, self.rng), fc, "bp", q=1.3) * 1.8 for _ in range(2)]
        tone = osc_saw(midi2hz(50 + 22 * u ** 2), n) * 0.18
        st = (np.array(chans) + lowpass(tone, 4000)) * amp
        return fade(st, 0.004, 0.006)

    # ------------------------------------------------------------------ impacts
    def boom(self):
        n, t = tt(1.25)
        f = 35 + 45 * np.exp(-t / 0.18)
        sub = osc_sine(f, n) * (np.exp(-t / 0.5)) * 1.0
        harm = saturate(sub * 2.5, 2.5) * 0.35                 # harmonics so phones "hear" it
        crack = bandpass(noise(n, self.rng), 300, 5000) * np.exp(-t / 0.018) * 1.3
        click = highpass(noise(n, self.rng), 2500) * np.exp(-t / 0.003)
        rumble = lowpass(noise(n, self.rng, "brown"), 180) * np.exp(-t / 0.45) * 1.2
        mono = sub + harm + crack + click * 0.6 + rumble
        st = self.verb(mono, self.ir_big, 0.08)[:, :n]
        return fade(st, 0.001, 0.25)

    def hit(self):
        n, t = tt(0.42)
        f = 55 + 140 * np.exp(-t / 0.02)
        thump = osc_sine(f, n) * np.exp(-t / 0.09)
        smack = bandpass(noise(n, self.rng), 800, 6000) * np.exp(-t / 0.035) * 1.2
        tone = osc_pulse(190, n, 0.5) * np.exp(-t / 0.03) * 0.35
        mono = saturate(thump * 1.4 + smack + lowpass(tone, 2500), 2.0)
        st = self.verb(mono, self.ir_small, 0.18)[:, :n]
        return fade(st, 0.0005, 0.08)

    # ------------------------------------------------------------------ UI
    def click(self):
        n, t = tt(0.09)
        x = np.zeros(n)

        def tick(level, f_res, tau):
            m = int(0.02 * SR)
            tl = np.arange(m) / SR
            nz = bandpass(noise(m, self.rng), 2500, 9000) * np.exp(-tl / 0.0012)
            res = osc_sine(f_res, m) * np.exp(-tl / tau) * 0.5
            return (nz + res) * level

        add_at(x, tick(1.0, 2100, 0.004), 0)
        add_at(x, tick(0.45, 2600, 0.003), int(0.055 * SR))  # release
        return fade(x, 0.0003, 0.01)

    def _keystroke(self, space=False):
        m = int(0.12 * SR)
        tl = np.arange(m) / SR
        r = self.rng
        thock_f = r.uniform(170, 260) if space else r.uniform(320, 620)
        thock = osc_sine(thock_f * (1 + 0.2 * np.exp(-tl / 0.004)), m) * np.exp(-tl / (0.03 if space else 0.018))
        clack = bandpass(noise(m, r), 1800, 7000) * np.exp(-tl / 0.0025) * r.uniform(0.7, 1.1)
        body = bandpass(noise(m, r), 400, 1600) * np.exp(-tl / 0.012) * 0.6
        down = clack + thock * (0.9 if space else 0.55) + body
        up_off = int(r.uniform(0.045, 0.085) * SR)
        up = np.zeros(m)
        k = m - up_off
        up[up_off:] = (bandpass(noise(k, r), 2500, 8000) * np.exp(-tl[:k] / 0.0015) * 0.35
                       + osc_sine(thock_f * 1.4, k) * np.exp(-tl[:k] / 0.008) * 0.15)
        return fade(down + up, 0.0002, 0.01)

    def key_typing(self):
        n, t = tt(2.5)
        x = np.zeros(n)
        pos = 0.03
        r = self.rng
        while pos < 2.38:
            space = r.random() < 0.12
            lvl = r.uniform(0.55, 1.0) * (1.1 if space else 1.0)
            add_at(x, self._keystroke(space) * lvl, int(pos * SR))
            gap = r.gamma(3.0, 0.035)
            if r.random() < 0.08:
                gap += r.uniform(0.15, 0.3)  # thinking pause
            pos += max(0.05, gap)
        x = peq(x, 3500, 1.0, 2.0)
        st = self.verb(x, self.ir_small, 0.06)[:, :n]
        return fade(st, 0.002, 0.03)

    def _pop(self, f0, f1, length=0.16):
        n, t = tt(length)
        sweep = f0 * (f1 / f0) ** np.clip(t / 0.045, 0, 1) ** 0.7
        tone = osc_sine(sweep, n) * np.exp(-t / 0.035)
        tone += 0.25 * osc_sine(sweep * 2.01, n) * np.exp(-t / 0.02)
        p = lowpass(noise(n, self.rng), 3000) * np.exp(-t / 0.003) * 0.6
        env = np.minimum(1.0, t / 0.002)
        x = (tone + p) * env
        st = self.verb(x, self.ir_small, 0.08)[:, :n]
        return fade(st, 0.0005, 0.03)

    def pop(self):
        return self._pop(320, 1150)

    def pop_2(self):
        return self._pop(650, 2300, 0.13)

    def _bell(self, f, n, tau):
        t = np.arange(n) / SR
        partials = [(1.0, 1.0, 1.0), (2.0, 0.5, 0.6), (3.01, 0.25, 0.35), (4.17, 0.18, 0.2), (5.43, 0.1, 0.12)]
        x = sum(a * osc_sine(f * r, n) * np.exp(-t / (tau * d)) for r, a, d in partials)
        return x * np.minimum(1.0, t / 0.001)

    def ding(self):
        n, t = tt(0.95)
        x = np.zeros(n)
        add_at(x, self._bell(midi2hz(91), n, 0.12) * 0.7, 0)                 # G6
        add_at(x, self._bell(midi2hz(98), n - int(0.075 * SR), 0.35), int(0.075 * SR))  # D7 (fifth up)
        x += 0.15 * osc_pulse(midi2hz(98), n, 0.5) * np.exp(-np.maximum(t - 0.075, 0) / 0.08) * (t > 0.075)
        x = lowpass(x, 12000)
        st = self.verb(x, self.ir_small, 0.2)[:, :n]
        return fade(st, 0.0005, 0.12)

    def notify(self):
        n, t = tt(0.38)
        x = np.zeros(n)
        for off, m, ln in ((0.0, 81, 0.07), (0.09, 88, 0.16)):   # A5 -> E6 soft blips
            k = int(ln * SR) + int(0.1 * SR)
            tl = np.arange(k) / SR
            f = midi2hz(m + 1.2 * np.exp(-tl / 0.01))
            tone = osc_sine(f, k) + 0.3 * osc_tri(f * 2, k)
            env = np.minimum(1, tl / 0.004) * np.exp(-tl / (ln * 0.55))
            add_at(x, tone * env, int(off * SR))
        st = self.verb(x, self.ir_small, 0.15)[:, :n]
        return fade(st, 0.0005, 0.05)

    def error(self):
        n, t = tt(0.52)
        x = np.zeros(n)
        for off, ln in ((0.0, 0.19), (0.25, 0.25)):
            k = int(ln * SR)
            tl = np.arange(k) / SR
            buzz = osc_saw(98, k) + osc_pulse(103.5, k, 0.3) + 0.6 * osc_saw(147, k)
            buzz = saturate(buzz * 1.5, 3.0)
            buzz = bandpass(buzz, 150, 4000)
            env = np.minimum(1, tl / 0.004) * np.minimum(1, (ln - tl) / 0.015)
            add_at(x, buzz * env, int(off * SR))
        return fade(x, 0.001, 0.02)

    def glitch(self):
        n, t = tt(0.42)
        r = self.rng
        src_n = n_samples(0.3)
        ts = np.arange(src_n) / SR
        src = (osc_saw(midi2hz(57), src_n) + osc_pulse(midi2hz(64), src_n, 0.25) + osc_saw(midi2hz(69), src_n)) / 3
        src += 0.5 * noise(src_n, r) * (np.sin(2 * np.pi * 23 * ts) > 0)
        out = np.zeros((2, n))
        pos = 0
        while pos < n - 200:
            seg_len = int(r.choice([0.012, 0.018, 0.025, 0.04, 0.06]) * SR)
            reps = int(r.integers(1, 5))
            s0 = int(r.integers(0, src_n - seg_len))
            seg = src[s0:s0 + seg_len]
            if r.random() < 0.4:
                seg = seg[::2].repeat(2)[:seg_len]      # octave-up jump
            seg = bitcrush(seg, bits=int(r.integers(3, 7)), hold=int(r.integers(1, 9)))
            seg = fade(seg, 0.0008, 0.0008)
            pan = r.uniform(-0.7, 0.7)
            for _ in range(reps):
                if pos >= n:
                    break
                add_at(out, pan_stereo(seg, pan) * r.uniform(0.6, 1.0), pos)
                pos += seg_len
            if r.random() < 0.2:
                pos += int(0.015 * SR)                  # dropout
        return fade(out, 0.001, 0.02)

    def sad_trombone(self):
        """Original descending contour: three short 'wah's stepping down, then a long drooping wobbly 'waaah'."""
        notes = [(0.00, 57, 0.30), (0.40, 55, 0.30), (0.80, 53, 0.30), (1.20, 52, 0.85)]  # A3 G3 F3 E3
        n, t = tt(2.15)
        x = np.zeros(n)
        for i, (off, m, ln) in enumerate(notes):
            last = i == len(notes) - 1
            k = int((ln + 0.12) * SR)
            tl = np.arange(k) / SR
            pitch = m - 0.35 * np.exp(-tl / 0.03)                      # lip slide into the note
            if last:
                vib = 0.35 * np.clip((tl - 0.15) / 0.2, 0, 1) * np.sin(2 * np.pi * 5.2 * tl)
                droop = -1.8 * np.clip((tl - 0.55) / 0.35, 0, 1) ** 2
                pitch = pitch + vib + droop
            f = midi2hz(pitch)
            raw = osc_saw(f, k) * 0.8 + osc_pulse(f, k, 0.35) * 0.4
            # plunger 'wah': formant filter opening then closing per note
            wah_u = np.clip(tl / ln, 0, 1)
            fc = 350 + 1500 * np.sin(np.pi * np.clip(wah_u * (1.4 if not last else 0.9), 0, 1)) ** 1.5
            if last:
                fc = fc * (1 + 0.25 * np.sin(2 * np.pi * 5.2 * tl))
            y = tv_filter(raw, fc, "lp", q=2.2)
            y = peq(y, 1100, 1.2, 4.0)
            env = np.minimum(1, tl / 0.03) * np.clip((ln + 0.1 - tl) / (0.45 if last else 0.07), 0, 1) ** 1.5
            add_at(x, saturate(y * env, 1.5), int(off * SR))
        st = self.verb(x, self.ir_small, 0.18)[:, :n]
        return fade(st, 0.002, 0.08)

    def record_scratch(self):
        n, t = tt(0.55)
        r = self.rng
        # "record content": a bright chord + noise, played back at a time-varying speed
        src_len = n_samples(3.0)
        src = sum(osc_saw(midi2hz(m), src_len) for m in (57, 64, 69, 72, 76)) / 5
        src = lowpass(src + 0.4 * noise(src_len, r), 6000)
        speed = np.interp(t, [0, 0.05, 0.1, 0.16, 0.22, 0.3, 0.55], [1.0, 2.6, -2.2, 2.0, -1.2, 0.9, 0.0])
        speed[t > 0.3] = 0.9 * (1 - (t[t > 0.3] - 0.3) / 0.25) ** 2      # spin-down to a stop
        pos = 1.0 * SR + np.cumsum(speed)
        y = np.interp(pos, np.arange(src_len), src)
        y *= np.clip(np.abs(speed) / 0.4, 0, 1) ** 0.8                  # stylus drag loses level when slow
        y = bandpass(y, 150, 7000)
        crackle = np.zeros(n)
        idx = r.integers(0, n, 25)
        crackle[idx] = r.uniform(-0.6, 0.6, 25)
        y = y * 1.6 + lowpass(crackle, 5000)
        st = self.verb(y, self.ir_small, 0.08)[:, :n]
        return fade(st, 0.002, 0.04)

    def riser(self):
        n, t = tt(1.5)
        u = t / t[-1]
        fc = 250 * (10000 / 250) ** (u ** 1.4)
        chans = [tv_filter(noise(n, self.rng), fc, "bp", q=1.5) * 2 for _ in range(2)]
        tone = sum(osc_saw(midi2hz(48 + 24 * u ** 1.6 + d), n) for d in (-0.1, 0.1)) * 0.25
        trem = 1 - 0.35 * (0.5 + 0.5 * np.sin(2 * np.pi * np.cumsum(4 + 22 * u ** 2) / SR))
        st = (np.array(chans) + lowpass(tone, 6000)) * trem
        st = st * db2lin(-30 + 30 * u ** 1.3)
        return fade(st, 0.01, 0.004)

    def sparkle(self):
        n, t = tt(1.1)
        r = self.rng
        out = np.zeros((2, n))
        scale = [84, 86, 88, 91, 93, 96, 98, 100, 103, 105]       # C major pentatonic, high
        k = 0
        pos = 0.0
        while pos < 0.75:
            m = scale[min(len(scale) - 1, int(k * 0.9 + r.integers(0, 3)))]
            ln = int(0.35 * SR)
            tl = np.arange(ln) / SR
            ping = osc_sine(midi2hz(m), ln) + 0.3 * osc_sine(midi2hz(m) * 2.76, ln) * np.exp(-tl / 0.02)
            ping *= np.minimum(1, tl / 0.0015) * np.exp(-tl / 0.07)
            add_at(out, pan_stereo(ping * r.uniform(0.5, 1.0) * (1 - 0.5 * pos), r.uniform(-0.8, 0.8)), int(pos * SR))
            pos += r.uniform(0.025, 0.07)
            k += 1
        shimmer = highpass(noise(n, r), 9000) * np.exp(-t / 0.25) * 0.08
        out += np.vstack([shimmer, np.roll(shimmer, 37)])
        st = self.verb(out, self.ir_big, 0.25)[:, :n]
        return fade(st, 0.001, 0.2)

    def camera_shake_rumble(self):
        n, t = tt(0.5)
        r = self.rng
        env = np.minimum(1, t / 0.012) * np.exp(-t / 0.22)
        wob = 1 + 0.4 * lowpass(noise(n, r), 25) * 6
        sub = osc_sine(42 + 10 * lowpass(noise(n, r), 8) * 10, n)
        body = lowpass(noise(n, r, "brown"), 140) * 1.6
        grit = bandpass(noise(n, r), 150, 900) * 0.7
        mono = saturate((sub * 0.7 + body + grit) * env * wob, 1.8)
        st = np.vstack([mono, lowpass(np.roll(mono, 90), 400) + highpass(mono, 400)])
        return fade(st, 0.002, 0.06)


DESCRIPTIONS = {
    "whoosh_1": "Fast airy whoosh (0.36 s), bright filtered-noise pass-by panning L->R. Quick cuts/slides.",
    "whoosh_2": "Deep heavy whoosh (0.58 s), low swoosh with sub swoop. Big transitions/zoom-ins.",
    "whoosh_3": "Reverse-style swell (0.5 s) that rises and ends abruptly - place so the end lands ON the cut.",
    "boom": "Deep cinematic impact (1.25 s): 80->35 Hz sine drop + crack transient + rumble tail.",
    "hit": "Short punchy accent impact (0.42 s) for text slams / pop-ins.",
    "click": "UI mouse click (press + release, 0.09 s).",
    "key_typing": "2.5 s of randomized mechanical keyboard typing (clacks, spacebar thocks, pauses).",
    "pop": "Bubbly cartoon pop (rising-pitch bubble) for merges/appear.",
    "pop_2": "Higher, shorter pop variant (alternate with pop for successive merges).",
    "ding": "Coin/success chime: bright bell G6 -> D7.",
    "notify": "Soft two-tone chat/message notification blip.",
    "error": "Harsh 'wrong' double buzzer (0.52 s).",
    "glitch": "Digital stutter / bitcrush burst (0.42 s), stereo.",
    "sad_trombone": "Comedic fail: original brass-like 'wah-wah-wah-waaah' descending with wobbly droop (2.15 s).",
    "record_scratch": "Vinyl scratch back-and-forth then spin-down stop (0.55 s) - 'wait, what?' moments.",
    "riser": "1.5 s tension riser (noise sweep + rising saws + accelerating tremolo), sharp end - end it on the cut.",
    "sparkle": "Magic twinkle: cascade of high pentatonic pings + shimmer (1.1 s), for particles/reveals.",
    "camera_shake_rumble": "0.5 s low rumble for camera shake.",
}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default="assets/sfx")
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--peak", type=float, default=-1.0, help="peak normalization (dBFS)")
    ap.add_argument("--only", default=None, help="comma list of names to (re)generate")
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    names = list(DESCRIPTIONS) if not args.only else [s.strip() for s in args.only.split(",")]

    index_path = os.path.join(args.out, "index.json")
    index = {}
    if os.path.exists(index_path):
        try:
            index = {e["file"]: e for e in json.load(open(index_path))["sounds"]}
        except Exception:
            index = {}

    for name in names:
        # fresh RNG per sound so regenerating one file never changes the others
        gen = SFX(args.seed * 1000 + sum(ord(c) for c in name))
        x = getattr(gen, name)()
        x = x - (x.mean(axis=-1, keepdims=True))            # kill any DC
        x = fade(x, 0.001, 0.005)
        x = normalize_peak(x, args.peak)
        x = x * min(1.0, db2lin(args.peak) / db2lin(true_peak_db(x)))   # keep inter-sample peaks under too
        path = os.path.join(args.out, f"{name}.wav")
        write_wav(path, x)
        ch = 1 if x.ndim == 1 else x.shape[0]
        dur = x.shape[-1] / SR
        lufs = integrated_lufs(x)
        index[f"{name}.wav"] = dict(
            file=f"{name}.wav", duration=round(dur, 3), channels=ch, sample_rate=SR,
            peak_dbfs=round(sample_peak_db(x), 2), true_peak_dbtp=round(true_peak_db(x), 2),
            lufs=round(lufs, 1) if np.isfinite(lufs) else None, description=DESCRIPTIONS[name])
        print(f"{name:<22} {dur:5.2f}s ch={ch} peak={sample_peak_db(x):6.2f} dBFS  {lufs:6.1f} LUFS")

    ordered = [index[k] for k in sorted(index, key=lambda f: list(DESCRIPTIONS).index(f[:-4])
                                          if f[:-4] in DESCRIPTIONS else 999)]
    with open(index_path, "w") as f:
        json.dump({"generator": "pipeline/audio/make_sfx.py", "seed": args.seed, "sample_rate": SR,
                   "note": "All sounds synthesized from oscillators/noise (no samples, no voices). "
                           "Peak-normalized (true peak <= --peak); LUFS for sub-0.4 s files is measured over a 0.4 s window.",
                   "sounds": ordered}, f, indent=1)
    print(f"index -> {index_path}")


if __name__ == "__main__":
    main()
