"""Render the Ghibli-style sample:  python -m pipeline.ghibli_demo"""
import shutil
import subprocess
import sys
import wave
from pathlib import Path

import numpy as np

from . import ghibli_audio
from .util import ROOT, log

SCENES = [(0, 16, "hills"), (16, 32, "field"), (32, 47, "room"), (47, 62, "forest"), (62, 77, "river"), (77, 94, "night")]
TOTAL, FPS = 94, 30


def main():
    workers = int(sys.argv[1]) if len(sys.argv) > 1 else 3
    work = ROOT / "out" / "ghibli_sample"
    work.mkdir(parents=True, exist_ok=True)
    rdir = work / "render"
    if rdir.exists():
        shutil.rmtree(rdir)
    shutil.copytree(ROOT / "renderer_ghibli", rdir)
    fonts = ROOT / "renderer" / "fonts"
    (rdir / "fonts").mkdir(exist_ok=True)
    for f in fonts.glob("*.ttf"):
        shutil.copy(f, rdir / "fonts" / f.name)

    log("Soundtrack…")
    mix = ghibli_audio.soundtrack(SCENES, TOTAL)
    st = np.repeat((mix * 32767).astype(np.int16)[:, None], 2, axis=1)
    with wave.open(str(work / "audio.wav"), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(ghibli_audio.SR); w.writeframes(st.tobytes())

    total = TOTAL * FPS
    step = -(-total // workers)
    procs, segs = [], []
    log(f"Rendering {total} frames, {workers} workers…")
    for k in range(workers):
        a, b = k * step, min(total, (k + 1) * step)
        seg = work / f"seg{k}.mp4"
        segs.append(seg)
        procs.append(subprocess.Popen([sys.executable, "-m", "pipeline.render", "worker", str(rdir), str(a), str(b),
                                       str(FPS), "1920", "1080", str(seg)], cwd=ROOT))
    if any(p.wait() for p in procs):
        raise SystemExit("render failed")
    (work / "segs.txt").write_text("".join(f"file '{s.resolve()}'\n" for s in segs))
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(work / "segs.txt"),
                    "-i", str(work / "audio.wav"), "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest",
                    "-movflags", "+faststart", str(work / "ghibli_sample.mp4")], check=True)
    log(f"✅ {work / 'ghibli_sample.mp4'}")


if __name__ == "__main__":
    main()
