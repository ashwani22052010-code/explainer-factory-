"""Explainer Factory: script -> finished video.

  python -m pipeline.main scripts/angithi.txt
  python -m pipeline.main --list .picked.txt
  python -m pipeline.main --demo          (offline test, no API key needed)
"""
import argparse
import shutil
import subprocess
import sys
import time
from pathlib import Path

from .util import ROOT, env_key, load_config, log, read_json, write_json


def make(script_path, cfg, demo=False):
    from playwright.sync_api import sync_playwright
    from . import mixer, planner, render, timeline, voice
    from .artist import Artist

    t_start = time.time()
    script_path = Path(script_path)
    stem = script_path.stem if not demo else "demo"
    work = ROOT / "out" / stem
    work.mkdir(parents=True, exist_ok=True)
    log(f"=== {stem} ===")

    gem = None
    if demo:
        plan = read_json(ROOT / "demo" / "plan.json")
    else:
        from .gemini import Gemini
        g = cfg["gemini"]
        gem = Gemini(env_key(), g["text_models"], g["vision_models"], g.get("min_seconds_between_calls", 4.5))
        script = script_path.read_text(encoding="utf-8").strip()
        if len(script.split()) < 5:
            raise SystemExit(f"{script_path} mein script bahut chhoti hai.")

    with sync_playwright() as p:
        browser = p.chromium.launch()
        artist = Artist(gem, cfg, browser)
        if not demo:
            plan = planner.build_plan(gem, script, cfg, artist.names())
        write_json(work / "plan.json", plan)
        log(f"Plan: {len(plan['scenes'])} scenes")

        # draw / reuse every asset
        assets = {}
        need = {}
        for sc in plan["scenes"]:
            for e in sc["elements"]:
                need.setdefault(e["asset"], e["describe"])
        reuse = [n for n in need if artist.has(n)]
        log(f"Drawings: {len(need)} chahiye ({len(reuse)} library se, {len(need) - len(reuse)} nayi)")
        for name, desc in need.items():
            if demo and not artist.has(name):
                svg_file = ROOT / "demo" / f"{name}.svg"
                from .svgsafe import sanitize
                assets[name] = sanitize(svg_file.read_text(), name[:20]) if svg_file.exists() else \
                    (__import__("pipeline.artist", fromlist=["placeholder"]).placeholder(name, desc), 1.0)
                continue
            assets[name] = artist.get(name, desc)
        browser.close()

    narration, timings = voice.make_voice(plan["scenes"], cfg, work, stem, demo=demo)
    data, events = timeline.build(plan, timings, assets, cfg)
    write_json(work / "timeline_events.json", events)

    mix_wav = mixer.mix(narration, events, data["duration"], cfg, work / "mix.wav")
    silent = render.render_video(work, data, work / "video_silent.mp4", cfg["video"].get("workers", 3))
    final = work / f"{stem}.mp4"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(silent), "-i", str(mix_wav), "-c:v", "copy",
                    "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", str(final)], check=True)

    meta = (f"TITLE:\n{plan.get('title', '')}\n\nDESCRIPTION:\n{plan.get('description', '')}\n\n"
            f"TAGS:\n{', '.join(plan.get('tags', []))}\n")
    (work / "metadata.txt").write_text(meta, encoding="utf-8")
    for junk in ["render", "voice"]:
        shutil.rmtree(work / junk, ignore_errors=True)
    for f in list(work.glob("seg*.mp4")) + [silent]:
        f.unlink(missing_ok=True)
    calls = gem.calls if gem else 0
    log(f"✅ Video ready: {final.relative_to(ROOT)}  ({data['duration']:.0f}s, "
        f"{time.time() - t_start:.0f}s me bani, {calls} Gemini calls)")
    return final


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("scripts", nargs="*")
    ap.add_argument("--list")
    ap.add_argument("--demo", action="store_true")
    a = ap.parse_args()
    cfg = load_config()
    if a.demo:
        make("demo", cfg, demo=True)
        return
    files = list(a.scripts)
    if a.list and Path(a.list).exists():
        files += [l.strip() for l in Path(a.list).read_text(encoding="utf-8").splitlines() if l.strip()]
    if not files:
        log("Koi script nahi mili. scripts/ folder mein .txt file daalo.")
        return
    if not env_key():
        log("❌ GEMINI_API_KEY secret set nahi hai. README ka Step 2 dekho.")
        sys.exit(1)
    failed = []
    for f in files:
        try:
            make(ROOT / f if not Path(f).is_absolute() else f, cfg)
        except Exception as e:
            log(f"❌ {f} fail: {e}")
            failed.append(f)
    if failed:
        sys.exit(1)


if __name__ == "__main__":
    main()
