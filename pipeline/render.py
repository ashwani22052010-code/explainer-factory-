"""Render frames with headless Chromium (parallel workers) and encode with FFmpeg."""
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

from .util import ROOT, log

RENDERER = ROOT / "renderer"


def prepare(work, data, renderer=None):
    rdir = Path(work) / "render"
    if rdir.exists():
        shutil.rmtree(rdir)
    src = ROOT / renderer if renderer else RENDERER
    shutil.copytree(src, rdir, ignore=shutil.ignore_patterns("*.sh"))
    fonts = RENDERER / "fonts"
    if src != RENDERER and fonts.exists():
        (rdir / "fonts").mkdir(exist_ok=True)
        for f in fonts.glob("*.ttf"):
            shutil.copy(f, rdir / "fonts" / f.name)
    (rdir / "data.js").write_text("window.DATA=" + json.dumps(data, ensure_ascii=False) + ";", encoding="utf-8")
    return rdir


def worker(rdir, start, end, fps, w, h, out):
    """Runs in its own process: render frames [start, end) to an mp4 segment."""
    from playwright.sync_api import sync_playwright
    ff = subprocess.Popen(
        ["ffmpeg", "-y", "-v", "error", "-f", "image2pipe", "-framerate", str(fps), "-c:v", "mjpeg", "-i", "-",
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "19", "-pix_fmt", "yuv420p", str(out)],
        stdin=subprocess.PIPE)
    f, restarts = start, 0
    t0 = time.time()
    with sync_playwright() as p:
        while f < end:
            try:
                b = p.chromium.launch(args=["--disable-gpu", "--disable-dev-shm-usage",
                                            "--force-color-profile=srgb", "--disable-lcd-text"])
                page = b.new_page(viewport={"width": w, "height": h}, device_scale_factor=1)
                page.goto((Path(rdir) / "index.html").resolve().as_uri())
                page.wait_for_function("window.__ready === true", timeout=60000)
                while f < end:
                    page.evaluate("t => renderAt(t)", f / fps)
                    shot = page.screenshot(type="jpeg", quality=90)
                    ff.stdin.write(shot)
                    f += 1
                    if (f - start) % 300 == 0:
                        rate = (f - start) / (time.time() - t0)
                        print(f"   [frames {start}-{end}] {f - start}/{end - start} ({rate:.1f} fps)", flush=True)
                b.close()
            except Exception as e:
                restarts += 1
                print(f"   browser crash at frame {f} ({str(e)[:80]}), restart {restarts}", flush=True)
                try:
                    b.close()
                except Exception:
                    pass
                if restarts > 5:
                    raise
    ff.stdin.close()
    ff.wait()


def render_video(work, data, out_mp4, workers=3, renderer=None):
    rdir = prepare(work, data, renderer)
    fps, total = data["fps"], int(round(data["duration"] * data["fps"]))
    workers = max(1, min(workers, total // 60 or 1))
    step = -(-total // workers)
    procs, segs = [], []
    log(f"Rendering {total} frames with {workers} workers…")
    for k in range(workers):
        a, b = k * step, min(total, (k + 1) * step)
        if a >= b:
            continue
        seg = Path(work) / f"seg{k}.mp4"
        segs.append(seg)
        procs.append(subprocess.Popen([sys.executable, "-m", "pipeline.render", "worker", str(rdir), str(a), str(b),
                                       str(fps), str(data["w"]), str(data["h"]), str(seg)], cwd=ROOT))
    codes = [p.wait() for p in procs]
    if any(codes):
        raise RuntimeError(f"render worker failed: {codes}")
    lst = Path(work) / "segs.txt"
    lst.write_text("".join(f"file '{s.resolve()}'\n" for s in segs))
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(lst), "-c", "copy",
                    str(out_mp4)], check=True)
    return out_mp4


def snapshot(work, data, times, out_dir):
    """Debug helper: save PNG frames at given times."""
    from playwright.sync_api import sync_playwright
    rdir = prepare(work, data)
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch()
        page = b.new_page(viewport={"width": data["w"], "height": data["h"]})
        page.on("pageerror", lambda e: print("PAGE ERROR:", e))
        page.goto((rdir / "index.html").resolve().as_uri())
        page.wait_for_function("window.__ready === true", timeout=60000)
        for t in times:
            page.evaluate("t => renderAt(t)", t)
            page.screenshot(path=str(out_dir / f"f_{t:06.2f}.png"))
        b.close()


if __name__ == "__main__" and len(sys.argv) > 1 and sys.argv[1] == "worker":
    _, _, rdir, a, b, fps, w, h, out = sys.argv
    worker(rdir, int(a), int(b), int(fps), int(w), int(h), out)
