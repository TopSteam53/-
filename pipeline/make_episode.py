"""One-command episode build.

  python pipeline/make_episode.py episodes/ep01 [--out output/video_01.mp4] [--draft] [--skip-voice] [--skip-music]

Steps: voice + word timeline -> footage prep -> music (synced to cues) -> Remotion render -> mix -> mux.
Footage: a shot with {"clip": "murmerge_play"} uses footage/murmerge_play.(mp4|mov|webm|mkv).
"""
import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PUB = ROOT / "remotion" / "public" / "_build"


def run(cmd, **kw):
    print("$", " ".join(str(c) for c in cmd), flush=True)
    subprocess.run([str(c) for c in cmd], check=True, **kw)


def find_clip(name):
    for d in (ROOT / "footage",):
        for ext in (".mp4", ".mov", ".webm", ".mkv"):
            p = d / f"{name}{ext}"
            if p.exists():
                return p
    raise SystemExit(f"Footage '{name}' not found in footage/")


def prep_footage(tl):
    """Normalize every referenced clip to 1080x1920 / 30 fps H.264 for Remotion.

    episode.json "footage": {"<clip>": {"crop": "w:h:x:y"}} crops phone/browser UI first; the result is
    fitted by width over a blurred copy of itself (no black bars)."""
    fcfg = tl["episode"].get("footage", {})
    out = PUB / "footage"
    out.mkdir(parents=True, exist_ok=True)
    clips = {s["props"]["clip"] for s in tl["shots"] if s.get("props", {}).get("clip")}
    clips |= set(tl["episode"].get("extraClips", []))
    for c in sorted(clips):
        src = find_clip(c)
        dst = out / f"{c}.mp4"
        cfg = fcfg.get(c, {})
        stamp = out / f"{c}.cfg"
        if dst.exists() and dst.stat().st_mtime > src.stat().st_mtime and stamp.exists() and stamp.read_text() == json.dumps(cfg):
            continue
        crop = f"crop={cfg['crop']}," if cfg.get("crop") else ""
        fc = (f"[0:v]{crop}fps=30,split[a][b];"
              "[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=40:2,eq=brightness=-0.08[bg];"
              "[b]scale=1080:1920:force_original_aspect_ratio=decrease:flags=lanczos,unsharp=5:5:0.6[fg];"
              "[bg][fg]overlay=(W-w)/2:(H-h)/2,format=yuv420p[v]")
        run(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-an", "-filter_complex", fc, "-map", "[v]",
             "-c:v", "libx264", "-crf", "14", "-preset", "fast", "-g", "15", dst])
        stamp.write_text(json.dumps(cfg))


def music(tl, ep_dir):
    m = tl["episode"].get("music", {})
    out = ROOT / "build" / tl["id"] / "music.wav"
    lines = {l["id"]: l for l in tl["lines"]}
    secs = ["intro:0", "main:1.9"]
    for name, (lid, w) in m.get("cues", {}).items():
        secs.append(f"{name}:{lines[lid]['words'][w]['start'] if w else lines[lid]['start']:.2f}")
    run([sys.executable, ROOT / "pipeline/audio/make_music.py", "--duration", f"{tl['duration']:.2f}",
         "--bpm", m.get("bpm", 124), "--seed", m.get("seed", 1), "--snap", "beat",
         "--sections", ",".join(secs), "--out", out])
    tl["episode"]["music"]["file"] = str(out.relative_to(ROOT))
    tl["musicInfo"] = {k: json.loads(out.with_suffix(".json").read_text())[k] for k in ("final_hit", "drop_times", "bpm")}


def mouth_envelope(wav_path, fps=30):
    """Per-frame 0..1 mouth openness from voice loudness (for mascot lip-sync)."""
    import numpy as np
    import soundfile as sf

    a, sr = sf.read(wav_path, dtype="float32", always_2d=True)
    a = a.mean(1)
    hop = sr // fps
    n = len(a) // hop
    rms = np.array([np.sqrt(np.mean(a[i * hop:(i + 1) * hop] ** 2) + 1e-12) for i in range(n)])
    db = 20 * np.log10(rms + 1e-9)
    ref = np.percentile(db[db > -60], 90) if (db > -60).any() else -20
    m = np.clip((db - (ref - 28)) / 24, 0, 1)
    # light smoothing + quantize so the mouth "flaps" readably
    m = np.convolve(m, [0.25, 0.5, 0.25], mode="same")
    return [round(float(x), 2) for x in m]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("episode")
    ap.add_argument("--out")
    ap.add_argument("--draft", action="store_true", help="half-resolution fast render")
    ap.add_argument("--skip-voice", action="store_true")
    ap.add_argument("--skip-music", action="store_true")
    ap.add_argument("--frames", help="render only a frame range, e.g. 0-120")
    a = ap.parse_args()
    ep_dir = ROOT / a.episode
    ep = json.loads((ep_dir / "episode.json").read_text())
    build = ROOT / "build" / ep["id"]
    if not a.skip_voice or not (build / "timeline.json").exists():
        run([sys.executable, ROOT / "pipeline/build_timeline.py", ep_dir])
    tl = json.loads((build / "timeline.json").read_text())
    prep_footage(tl)
    if not a.skip_music or not (build / "music.wav").exists():
        music(tl, ep_dir)
    else:
        tl["episode"]["music"]["file"] = str((build / "music.wav").relative_to(ROOT))
    tl["mouth"] = mouth_envelope(build / "voice_raw.wav")
    (build / "timeline.json").write_text(json.dumps(tl, ensure_ascii=False, indent=1))
    PUB.mkdir(parents=True, exist_ok=True)
    shutil.copy(build / "timeline.json", PUB / "timeline.json")

    silent = build / "video_silent.mp4"
    cmd = ["node", ROOT / "remotion/render.mjs", build / "timeline.json", silent]
    if a.draft:
        cmd.append("--scale=0.5")
    if a.frames:
        cmd.append(f"--frames={a.frames}")
    run(cmd, cwd=ROOT / "remotion")
    run([sys.executable, ROOT / "pipeline/mix.py", build / "timeline.json", build / "mix.wav"])
    if tl["episode"].get("cover"):
        cover = ROOT / "output" / f"cover_{ep['episodeNumber']:02d}.png"
        run(["node", ROOT / "remotion/render.mjs", build / "timeline.json", cover, f"--cover={cover}"], cwd=ROOT / "remotion")
    out = Path(a.out) if a.out else ROOT / "output" / f"video_{ep['episodeNumber']:02d}.mp4"
    out.parent.mkdir(parents=True, exist_ok=True)
    run(["ffmpeg", "-y", "-loglevel", "error", "-i", silent, "-i", build / "mix.wav", "-map", "0:v", "-map", "1:a",
         "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-ar", "48000", "-movflags", "+faststart", "-shortest", out])
    print("OK ->", out)


if __name__ == "__main__":
    main()
