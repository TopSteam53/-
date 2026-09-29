"""Auto-bleep profanity in a voice recording.

  python pipeline/bleep.py in.wav out.wav [--json bleeps.json] [--freq 1000]

Finds swear words with ASR (same list as the TTS take filter), replaces each with a 1 kHz TV-style
beep and writes the times to JSON so the video can show a meme/censor graphic at the same moments.
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

sys.path.insert(0, str(Path(__file__).parent))
from asr import words_with_times  # noqa: E402
from build_timeline import BAD_WORDS  # noqa: E402


def find_bleeps(audio, sr, pad=0.06):
    out = []
    for w, s, e in words_with_times(audio, sr):
        if BAD_WORDS.search(w):
            # token timestamps mark token starts; extend the end to cover the last syllable
            out.append({"word": w, "start": round(max(0, s - pad), 3), "end": round(e + 0.22, 3)})
    return out


def apply_bleeps(audio, sr, bleeps, freq=1000.0):
    y = audio.copy()
    for b in bleeps:
        i0, i1 = int(b["start"] * sr), min(len(y), int(b["end"] * sr))
        if i1 <= i0:
            continue
        seg = y[i0:i1]
        level = np.sqrt(np.mean(seg ** 2)) * 1.6 + 1e-4  # beep about as loud as the speech it hides
        t = np.arange(i1 - i0) / sr
        beep = np.sin(2 * np.pi * freq * t) * min(level * 1.41, 0.7)
        ramp = min(len(beep) // 4, int(0.008 * sr))
        env = np.ones_like(beep)
        env[:ramp] = np.linspace(0, 1, ramp)
        env[-ramp:] = np.linspace(1, 0, ramp)
        beep = beep * env
        y[i0:i1] = beep if y.ndim == 1 else beep[:, None]
    return y


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("inp")
    ap.add_argument("out")
    ap.add_argument("--json")
    ap.add_argument("--freq", type=float, default=1000.0)
    a = ap.parse_args()
    audio, sr = sf.read(a.inp, dtype="float32")
    mono = audio.mean(1) if audio.ndim > 1 else audio
    bleeps = find_bleeps(mono, sr)
    sf.write(a.out, apply_bleeps(audio, sr, bleeps, a.freq), sr)
    if a.json:
        Path(a.json).write_text(json.dumps(bleeps, ensure_ascii=False, indent=1))
    print(f"{len(bleeps)} bleep(s):", ", ".join(f"{b['start']:.2f}-{b['end']:.2f}" for b in bleeps))


if __name__ == "__main__":
    main()
