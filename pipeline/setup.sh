#!/usr/bin/env bash
# One-time setup: system tools, Python/Node deps, offline voice + ASR models (~450 MB).
set -euo pipefail
cd "$(dirname "$0")/.."

if command -v apt-get >/dev/null; then
  sudo_cmd=""; [ "$(id -u)" -ne 0 ] && sudo_cmd="sudo"
  $sudo_cmd apt-get update -qq
  $sudo_cmd apt-get install -y --no-install-recommends ffmpeg espeak-ng fonts-noto-color-emoji rhvoice rhvoice-russian || true
fi

pip install -q piper-tts sherpa-onnx soundfile numpy scipy pyloudnorm librosa

(cd remotion && npm install --no-audit --no-fund)

mkdir -p models && cd models
REL=https://github.com/k2-fsa/sherpa-onnx/releases/download
for v in denis dmitri; do
  d=vits-piper-ru_RU-$v-medium
  [ -d "$d" ] || (curl -fL "$REL/tts-models/$d.tar.bz2" | tar xj)
done
asr=sherpa-onnx-nemo-transducer-giga-am-v2-russian-2025-04-19
[ -d "$asr" ] || (curl -fL "$REL/asr-models/$asr.tar.bz2" | tar xj)
echo "setup done"
