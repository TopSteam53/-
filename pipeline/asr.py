"""Russian ASR (GigaAM v2 RNNT via sherpa-onnx) with token timestamps.

Used for: (1) word-level timings for karaoke subtitles, (2) objective TTS intelligibility check.
"""
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
MODEL = ROOT / "models" / "sherpa-onnx-nemo-transducer-giga-am-v2-russian-2025-04-19"
SR = 16000
_rec = None


def recognizer():
    global _rec
    if _rec is None:
        import sherpa_onnx

        _rec = sherpa_onnx.OfflineRecognizer.from_transducer(
            encoder=str(MODEL / "encoder.int8.onnx"),
            decoder=str(MODEL / "decoder.onnx"),
            joiner=str(MODEL / "joiner.onnx"),
            tokens=str(MODEL / "tokens.txt"),
            model_type="nemo_transducer",
            num_threads=4,
        )
    return _rec


def to16k(audio, sr):
    if sr == SR:
        return audio.astype(np.float32)
    from math import gcd
    from scipy.signal import resample_poly

    g = gcd(sr, SR)
    return resample_poly(audio, SR // g, sr // g).astype(np.float32)


def transcribe(audio, sr):
    """Return (text, [(token, start_sec)])."""
    r = recognizer()
    s = r.create_stream()
    s.accept_waveform(SR, to16k(audio, sr))
    r.decode_stream(s)
    res = s.result
    return res.text, list(zip(res.tokens, res.timestamps))


def words_with_times(audio, sr):
    """Group BPE tokens into words -> [(word, start, end_guess)]."""
    _, toks = transcribe(audio, sr)
    # GigaAM emits characters with " " tokens between words; BPE models mark word starts with "▁"
    words = []
    new_word = True
    for tok, t in toks:
        if tok.strip() == "":
            new_word = True
            continue
        if tok.startswith("▁") or new_word or not words:
            words.append([tok.lstrip("▁"), t, t])
        else:
            words[-1][0] += tok
            words[-1][2] = t
        new_word = False
    return [(w, s, e) for w, s, e in words if w]
