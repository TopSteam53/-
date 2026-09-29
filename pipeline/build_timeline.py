"""Episode -> voice track + word-level timeline.

  python pipeline/build_timeline.py episodes/ep01

Reads episodes/<ep>/episode.json, synthesizes every line (cached), aligns words with ASR,
and writes build/<ep>/voice_raw.wav + build/<ep>/timeline.json (all times in seconds).
"""
import difflib
import hashlib
import json
import re
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

sys.path.insert(0, str(Path(__file__).parent))
from tts import SR, synth, trim_silence  # noqa: E402
from asr import words_with_times  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
TOKEN_RE = re.compile(r"\[\[.*?\]\]|\S+")
BAD_WORDS = re.compile(r"еба|ёба|бля|хуй|хуе|пизд|сука|муда", re.I)
WORD_CHARS = re.compile(r"[0-9A-Za-zА-Яа-яЁё]")


def tokens(text):
    return [t for t in TOKEN_RE.findall(text) if t.startswith("[[") or WORD_CHARS.search(t)]


def norm(s):
    s = s.lower().replace("ё", "е").replace("́", "")
    return re.sub(r"[^0-9a-zа-я]", "", s)


def align_words(expected, asr_words, audio_len):
    """Map each expected word to a start time using char-level alignment with ASR output."""
    exp_str, exp_idx = "", []
    for i, w in enumerate(expected):
        for c in norm(w):
            exp_str += c
            exp_idx.append(i)
    hyp_str, hyp_t = "", []
    for w, s, e in asr_words:
        cs = norm(w)
        for k, c in enumerate(cs):
            hyp_str += c
            hyp_t.append(s + (e - s + 0.06) * k / max(len(cs), 1))
    starts = [None] * len(expected)
    sm = difflib.SequenceMatcher(None, exp_str, hyp_str, autojunk=False)
    for a, b, n in sm.get_matching_blocks():
        for k in range(n):
            wi = exp_idx[a + k]
            if starts[wi] is None:
                starts[wi] = hyp_t[b + k]
    # interpolate gaps by char counts
    lens = [max(len(norm(w)), 1) for w in expected]
    known = [(i, t) for i, t in enumerate(starts) if t is not None]
    if not known:
        known = [(0, 0.0)]
    if known[0][0] != 0:
        known.insert(0, (0, min(0.02, known[0][1])))
    end_t = audio_len
    for j in range(len(known)):
        i0, t0 = known[j]
        i1, t1 = known[j + 1] if j + 1 < len(known) else (len(expected), end_t)
        span = sum(lens[i0:i1]) or 1
        acc = 0
        for i in range(i0, i1):
            if starts[i] is None:
                starts[i] = t0 + (t1 - t0) * acc / span
            acc += lens[i]
    # enforce monotonic
    for i in range(1, len(starts)):
        starts[i] = max(starts[i], starts[i - 1] + 0.06)
    return starts


def take_score(ref, hyp):
    a = re.sub(r"[^0-9a-zа-я]", "", ref.lower().replace("ё", "е"))
    b = re.sub(r"[^0-9a-zа-я]", "", hyp.lower().replace("ё", "е"))
    return difflib.SequenceMatcher(None, a, b, autojunk=False).ratio()


def best_take(say, target, v, line, wav_path):
    """VITS is stochastic: render several takes and keep the one ASR understands best."""
    from asr import transcribe

    text = say.replace("_", " ")
    speed = line.get("speed", v.get("speed", 1.0))
    n = line.get("takes", v.get("takes", 6))
    takes = []
    for k in range(n):
        a = trim_silence(synth(text, v["engine"], speed, v.get("noise_scale"), v.get("noise_w")))
        hyp = transcribe(a, SR)[0]
        if BAD_WORDS.search(hyp) and not BAD_WORDS.search(target):
            print(f"    rejected take (sounds like profanity): {hyp}")
            continue
        takes.append((take_score(target, hyp), -abs(len(a)), a, hyp))
        if takes[-1][0] >= 0.995:
            break
    if not takes:
        raise SystemExit(f"No acceptable take for: {say}")
    takes.sort(key=lambda x: (round(x[0], 3), x[1]), reverse=True)
    sc, _, a, hyp = takes[0]
    print(f"    take {sc:.3f} of {len(takes)}: {hyp}")
    sf.write(wav_path, a, SR)


def main(ep_dir):
    ep_dir = Path(ep_dir)
    ep = json.loads((ep_dir / "episode.json").read_text())
    out = ROOT / "build" / ep["id"]
    (out / "lines").mkdir(parents=True, exist_ok=True)
    v = ep["voice"]
    t = ep.get("leadIn", 0.15)
    pieces = [np.zeros(int(t * SR), np.float32)]
    lines_out, shots, sfx = [], [], []

    for li, line in enumerate(ep["lines"]):
        say, sub = line["say"], line.get("sub", line["say"])
        st, ut = tokens(say), tokens(sub)
        if len(st) != len(ut):
            raise SystemExit(f"[{line['id']}] word count mismatch say={len(st)} sub={len(ut)}: {st} / {ut}")
        key = hashlib.md5(json.dumps([say, v, line.get("speed"), line.get("target")], ensure_ascii=False).encode()).hexdigest()[:12]
        wav = out / "lines" / f"{li:02d}_{line['id']}_{key}.wav"
        if not wav.exists():
            spoken = " ".join(u if s_.startswith("[[") else s_.replace("_", " ") for s_, u in zip(st, ut))
            best_take(say, line.get("target", spoken), v, line, wav)
        audio, _ = sf.read(wav, dtype="float32")
        dur = len(audio) / SR
        asr = words_with_times(audio, SR)
        # expected words for alignment: phoneme tokens are matched against the subtitle word
        expected = [u if s.startswith("[[") else s for s, u in zip(st, ut)]
        starts = align_words(expected, asr, dur)
        words = []
        emph = set(line.get("emphasis", []))
        for i, (w, s0) in enumerate(zip(ut, starts)):
            e0 = starts[i + 1] if i + 1 < len(starts) else dur
            words.append({"text": w, "start": round(t + max(0, s0 - 0.04), 3), "end": round(t + e0, 3), "emph": i in emph})
        lstart, lend = t, t + dur
        lines_out.append({"id": line["id"], "start": round(lstart, 3), "end": round(lend, 3), "words": words,
                          "asr": " ".join(w for w, _, _ in asr)})
        for sh in line.get("shots", []):
            ts = lstart if sh.get("w", 0) == 0 else words[sh["w"]]["start"]
            shots.append({"start": round(ts, 3), "line": line["id"], **{k: sh[k] for k in sh if k != "w"}})
            for name in sh.get("sfx", []):
                sfx.append({"t": round(ts, 3), "name": name})
        for e in line.get("sfx", []):
            sfx.append({"t": words[e["w"]]["start"], "name": e["name"]})
        pieces.append(audio)
        pause = line.get("pause", ep.get("defaultPause", 0.12))
        pieces.append(np.zeros(int(pause * SR), np.float32))
        t = lend + pause
        print(f"{line['id']:>10} {lstart:6.2f}-{lend:6.2f}  asr: {lines_out[-1]['asr']}")

    total = t + ep.get("tail", 1.5)
    voice = np.concatenate(pieces)
    voice = np.pad(voice, (0, int(total * SR) - len(voice)))
    sf.write(out / "voice_raw.wav", voice, SR)

    shots.sort(key=lambda s: s["start"])
    shots[0]["start"] = 0.0
    for i, s in enumerate(shots):
        s["end"] = shots[i + 1]["start"] if i + 1 < len(shots) else round(total, 3)
        s["idx"] = i
    # hud start
    hud = ep.get("hud")
    if hud:
        ln = next(l for l in lines_out if l["id"] == hud["earnedFromLine"])
        hud = {**hud, "start": ln["words"][hud["earnedFromWord"]]["start"]}
    timeline = {"id": ep["id"], "episode": ep, "fps": 30, "duration": round(total, 3), "lines": lines_out,
                "shots": shots, "sfx": sorted(sfx, key=lambda x: x["t"]), "hud": hud}
    (out / "timeline.json").write_text(json.dumps(timeline, ensure_ascii=False, indent=1))
    print(f"total {total:.2f}s, {len(shots)} shots, {len(sfx)} sfx")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "episodes/ep01")
