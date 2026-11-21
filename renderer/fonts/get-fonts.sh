#!/usr/bin/env bash
# Free Google Fonts (OFL license) download — GitHub Actions runs this automatically.
cd "$(dirname "$0")"
base="https://github.com/google/fonts/raw/main/ofl"
curl -fsSL -o Anton-Regular.ttf        "$base/anton/Anton-Regular.ttf"                              || echo "Anton font download failed"
curl -fsSL -o NotoSansDevanagari.ttf   "$base/notosansdevanagari/NotoSansDevanagari%5Bwdth%2Cwght%5D.ttf" || echo "Devanagari font download failed"
curl -fsSL -o Lora.ttf                 "$base/lora/Lora%5Bwght%5D.ttf"                              || echo "Lora font download failed"
ls -la
