"""Offline Russian TTS wrapper.

Engines:
  piper:<voice>    neural VITS voices (models/vits-piper-ru_RU-<voice>-medium), e.g. piper:dmitri
  rhvoice:<voice>  RHVoice (apt: rhvoice-russian), e.g. rhvoice:artemiy

Text conventions (spoken text, not subtitles):
  - `[[ phonemes ]]` inserts raw espeak IPA (piper only), used to force stress:
    "Первая игра — [[ murmʲˈerʃ ]]."
  - A combining acute (U+0301) after a vowel sets stress where espeak supports it: "черно́вике".

Usage:
  python pipeline/tts.py --engine piper:dmitri --text "Привет" --out /tmp/x.wav [--speed 1.1]
"""
import argparse
import os
import re
import subprocess
import tempfile
import wave
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parent.parent
MODELS = ROOT / "models"
SR = 48000

_piper_cache = {}


def _piper_voice(name):
    if name not in _piper_cache:
        from piper import PiperVoice

        path = MODELS / f"vits-piper-ru_RU-{name}-medium" / f"ru_RU-{name}-medium.onnx"
        if not path.exists():
            raise SystemExit(f"Voice model missing: {path}. Run: bash pipeline/setup.sh")
        _piper_cache[name] = PiperVoice.load(str(path))
    return _piper_cache[name]


def _resample(x, sr_in, sr_out=SR):
    if sr_in == sr_out:
        return x.astype(np.float32)
    from scipy.signal import resample_poly
    from math import gcd

    g = gcd(sr_in, sr_out)
    return resample_poly(x, sr_out // g, sr_in // g).astype(np.float32)


def synth(text, engine="piper:dmitri", speed=1.0, noise_scale=None, noise_w=None):
    """Return mono float32 audio at 48 kHz."""
    kind, voice = engine.split(":", 1)
    if kind == "piper":
        from piper import SynthesisConfig

        v = _piper_voice(voice)
        cfg = SynthesisConfig(
            length_scale=1.0 / speed,
            noise_scale=noise_scale,
            noise_w_scale=noise_w,
        )
        chunks = [c.audio_float_array for c in v.synthesize(text, syn_config=cfg)]
        audio = np.concatenate(chunks) if chunks else np.zeros(1, np.float32)
        return _resample(audio, v.config.sample_rate)
    if kind == "rhvoice":
        plain = re.sub(r"\[\[.*?\]\]", "", text).replace("́", "")
        with tempfile.TemporaryDirectory() as td:
            out = os.path.join(td, "o.wav")
            rate = str(int(round(speed * 100)))
            subprocess.run(
                ["RHVoice-test", "-p", voice, "-r", rate, "-o", out],
                input=plain.encode(), check=True, capture_output=True,
            )
            a, sr = sf.read(out, dtype="float32")
            if a.ndim > 1:
                a = a.mean(1)
            return _resample(a, sr)
    raise ValueError(engine)


def trim_silence(a, thresh_db=-45, pad=0.03):
    env = np.abs(a)
    thr = 10 ** (thresh_db / 20) * max(env.max(), 1e-6)
    idx = np.where(env > thr)[0]
    if not len(idx):
        return a
    s = max(0, idx[0] - int(pad * SR))
    e = min(len(a), idx[-1] + int(pad * SR))
    return a[s:e]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--engine", default="piper:dmitri")
    ap.add_argument("--text", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--speed", type=float, default=1.0)
    a = ap.parse_args()
    audio = trim_silence(synth(a.text, a.engine, a.speed))
    sf.write(a.out, audio, SR)


if __name__ == "__main__":
    main()
