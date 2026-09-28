"""Mix voice + music (ducked) + SFX into the final soundtrack.

  python pipeline/mix.py build/ep01/timeline.json build/ep01/mix.wav
"""
import json
import subprocess
import sys
from pathlib import Path

import numpy as np
import pyloudnorm as pyln
import soundfile as sf

ROOT = Path(__file__).resolve().parent.parent
SR = 48000

# dB offsets per SFX (relative to the file's own level)
SFX_GAIN = {
    "whoosh_1": -9, "whoosh_2": -11, "whoosh_3": -7, "boom": -6, "hit": -8, "click": -2, "key_typing": -12,
    "pop": -10, "pop_2": -12, "ding": -12, "notify": -11, "error": -12, "glitch": -16, "sad_trombone": -9,
    "record_scratch": -9, "riser": -8, "sparkle": -13, "camera_shake_rumble": -10,
}
# shift so the "hit" of the sound lands on the cut (seconds, negative = earlier)
SFX_OFFSET = {"whoosh_1": -0.16, "whoosh_2": -0.26, "whoosh_3": -0.3, "record_scratch": -0.05}


def load(path, stereo=True):
    a, sr = sf.read(path, dtype="float32", always_2d=True)
    if sr != SR:
        from scipy.signal import resample_poly
        from math import gcd
        g = gcd(sr, SR)
        a = resample_poly(a, SR // g, sr // g, axis=0).astype(np.float32)
    if stereo and a.shape[1] == 1:
        a = np.repeat(a, 2, axis=1)
    return a


def db(x):
    return 10 ** (x / 20)


def process_voice(src, dst):
    """Broadcast-style voice chain (EQ, de-ess, compression) with ffmpeg."""
    chain = ",".join([
        "highpass=f=85",
        "equalizer=f=180:t=q:w=1.0:g=2",
        "equalizer=f=320:t=q:w=1.2:g=-2.5",
        "equalizer=f=3200:t=q:w=1.0:g=3.5",
        "equalizer=f=8500:t=h:w=2000:g=2",
        "deesser=i=0.4",
        "acompressor=threshold=0.08:ratio=3.5:attack=4:release=90:makeup=2",
        "aresample=48000",
    ])
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-af", chain, "-ac", "1", str(dst)], check=True)


def smooth_env(x, attack, release):
    out = np.zeros_like(x)
    a_a = np.exp(-1 / (attack * SR))
    a_r = np.exp(-1 / (release * SR))
    y = 0.0
    # decimate for speed
    step = 48
    xs = x[::step]
    ys = np.zeros_like(xs)
    a_a = np.exp(-step / (attack * SR))
    a_r = np.exp(-step / (release * SR))
    for i, v in enumerate(xs):
        c = a_a if v > y else a_r
        y = c * y + (1 - c) * v
        ys[i] = y
    out = np.interp(np.arange(len(x)), np.arange(len(xs)) * step, ys)
    return out.astype(np.float32)


def limiter(x, ceiling_db=-1.2, lookahead=0.005, release=0.08):
    ceil = db(ceiling_db)
    peak = np.max(np.abs(x), axis=1)
    la = int(lookahead * SR)
    # running max over lookahead window
    from scipy.ndimage import maximum_filter1d
    pk = maximum_filter1d(peak, size=2 * la + 1)
    gain = np.minimum(1.0, ceil / np.maximum(pk, 1e-9))
    # smooth gain (instant attack thanks to lookahead window, slow release)
    g = 1 - smooth_env(1 - gain, 0.0005, release)
    g = np.minimum(g, gain)
    return x * g[:, None]


def main(tl_path, out_path):
    tl = json.loads(Path(tl_path).read_text())
    ep = tl["episode"]
    build = Path(tl_path).parent
    n = int(tl["duration"] * SR)

    process_voice(build / "voice_raw.wav", build / "voice_fx.wav")
    voice = load(build / "voice_fx.wav")[:n]
    voice = np.pad(voice, ((0, n - len(voice)), (0, 0)))
    meter = pyln.Meter(SR)
    voice *= db(-16 - meter.integrated_loudness(voice))

    mcfg = ep.get("music", {})
    music = load(ROOT / mcfg.get("file", f"build/{tl['id']}/music.wav"))[:n]
    music = np.pad(music, ((0, n - len(music)), (0, 0)))
    music *= db(mcfg.get("lufs", -21) - meter.integrated_loudness(music))
    # sidechain ducking
    vabs = np.abs(voice[:, 0])
    env = smooth_env(vabs, 0.005, 0.05)
    active = np.clip((20 * np.log10(env + 1e-9) + 42) / 12, 0, 1)
    duck = smooth_env(active, 0.04, 0.35)
    music *= db(mcfg.get("duckDb", -9) * duck)[:, None]

    sfx_bus = np.zeros((n, 2), np.float32)
    shots = tl["shots"]
    cache = {}
    for ev in tl["sfx"]:
        name = ev["name"]
        path = ROOT / "assets" / "sfx" / f"{name}.wav"
        if not path.exists():
            print("missing sfx", name)
            continue
        if name not in cache:
            cache[name] = load(path)
        a = cache[name] * db(SFX_GAIN.get(name, -8))
        t = ev["t"] + SFX_OFFSET.get(name, 0)
        if name == "riser":  # end the riser exactly on the next cut
            nxt = [s["start"] for s in shots if s["start"] > ev["t"] + 0.3]
            if nxt and nxt[0] - ev["t"] < 3.5:
                t = nxt[0] - len(a) / SR
        i = max(0, int(t * SR))
        seg = a[: max(0, min(len(a), n - i))]
        sfx_bus[i:i + len(seg)] += seg

    sfx_bus *= db(mcfg.get("sfxDuckDb", -5) * duck)[:, None]
    mix = voice + music + sfx_bus
    mix *= db(-14 - meter.integrated_loudness(mix))
    mix = limiter(mix, -1.2)
    mix *= db(-14 - meter.integrated_loudness(mix))
    mix = limiter(mix, -1.0)
    fade = int(0.25 * SR)
    mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
    sf.write(out_path, mix, SR, subtype="PCM_24")
    print(f"mix: {meter.integrated_loudness(mix):.1f} LUFS, peak {20*np.log10(np.abs(mix).max()):.2f} dBFS")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
