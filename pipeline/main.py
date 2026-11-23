"""Explainer Factory: script -> finished video.

  python -m pipeline.main scripts/angithi.txt
  python -m pipeline.main --list .picked.txt
  python -m pipeline.main --demo          (offline test, no API key needed)
"""
import argparse
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

from .util import ROOT, load_config, log, read_json, write_json



def any_key():
    return any(os.environ.get(k, '').strip() for k in
               ('GROQ_API_KEY', 'CEREBRAS_API_KEY', 'OPENROUTER_API_KEY', 'GEMINI_API_KEY'))


def apply_mode(cfg, mode):
    import copy
    cfg = copy.deepcopy(cfg)
    if mode == "story":
        cfg["video"]["width"], cfg["video"]["height"] = 1920, 1080
    return cfg


def parse_header(script, cfg):
    """Optional first line like:  #story english   or   #short hindi Fenrir"""
    import copy
    mode = cfg.get("mode", "short")
    lines = script.splitlines()
    if lines and lines[0].strip().startswith("#"):
        cfg = copy.deepcopy(cfg)
        for tok in lines[0].strip("# \t").lower().split():
            if tok in ("story", "long", "horizontal"):
                mode = "story"
            elif tok in ("short", "shorts", "vertical"):
                mode = "short"
            elif tok in ("hindi", "english", "portuguese"):
                cfg["language"] = tok
                cfg["caption_language"] = "english" if tok == "hindi" else tok
            elif tok.capitalize() in ("Charon", "Orus", "Fenrir", "Kore", "Aoede", "Puck", "Zephyr", "Leda"):
                cfg.setdefault("voice", {})["gemini_voice"] = tok.capitalize()
        script = "\n".join(lines[1:]).strip()
    return script, mode, apply_mode(cfg, mode)


def make(script_path, cfg, demo=False):
    from playwright.sync_api import sync_playwright
    from . import mixer, planner, render, timeline, voice
    from .artist import Artist

    t_start = time.time()
    script_path = Path(script_path)
    stem = script_path.stem if not demo else f"demo_{demo}"
    work = ROOT / "out" / stem
    work.mkdir(parents=True, exist_ok=True)
    log(f"=== {stem} ===")

    gem = None
    mode = "short"
    if demo:
        plan = read_json(ROOT / "demo" / ("plan_story.json" if demo == "story" else "plan.json"))
        mode = plan.get("mode", "short")
        cfg = apply_mode(cfg, mode)
    else:
        from .llm import Router
        gem = Router(cfg)
        script = script_path.read_text(encoding="utf-8").strip()
        script, mode, cfg = parse_header(script, cfg)
        if len(script.split()) < 5:
            raise SystemExit(f"{script_path} mein script bahut chhoti hai.")

    if mode == "story" and not demo:
        return make_story2(script, cfg, gem, work, stem, t_start)

    with sync_playwright() as p:
        browser = p.chromium.launch()
        artist = Artist(gem, cfg, browser, mode)
        if not demo:
            plan = planner.build_plan(gem, script, cfg, artist.names(), mode)
        write_json(work / "plan.json", plan)
        log(f"Plan: {len(plan['scenes'])} scenes")

        # draw / reuse every asset
        assets = {}
        need = {}
        for sc in plan["scenes"]:
            if sc.get("set"):
                need.setdefault(sc["set"]["asset"], sc["set"]["describe"])
            for e in sc["elements"]:
                if e.get("asset"):
                    need.setdefault(e["asset"], e["describe"])
        reuse = [n for n in need if artist.has(n)]
        log(f"Drawings: {len(need)} chahiye ({len(reuse)} library se, {len(need) - len(reuse)} nayi)")
        if demo:
            from .svgsafe import sanitize
            from .artist import placeholder
            for name, desc in need.items():
                f = ROOT / "demo" / f"{name}.svg"
                assets[name] = sanitize(f.read_text(), name[:20]) if f.exists() else (placeholder(name, desc), 1.0)
        else:
            assets = artist.draw_many(need)
        browser.close()

    narration, timings = voice.make_voice(plan["scenes"], cfg, work, stem, demo=demo)
    env = mixer.envelope(narration, cfg["video"]["fps"])
    data, events = timeline.build(plan, timings, assets, cfg, env=env, mode=mode)
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


def make_story2(script, cfg, gem, work, stem, t_start):
    """Story mode v2: AI plans, code draws everything (renderer_story)."""
    from . import mixer, render, story2, voice
    plan = story2.plan(gem, script, cfg)
    write_json(work / "plan.json", plan)
    log(f"Plan: {len(plan['scenes'])} scenes, {len(plan['characters'])} characters")
    narration, timings = voice.make_voice(plan["scenes"], cfg, work, stem)
    env = mixer.envelope(narration, cfg["video"]["fps"])
    data, events = story2.build_data(plan, timings, cfg, env)
    write_json(work / "data_story.json", {k: v for k, v in data.items() if k != "env"})
    mix_wav = mixer.mix(narration, events, data["duration"], {**cfg, "_story": True}, work / "mix.wav")
    silent = render.render_video(work, data, work / "video_silent.mp4", cfg["video"].get("workers", 3), renderer="renderer_story")
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
    log(f"✅ Video ready: {final.relative_to(ROOT)}  ({data['duration']:.0f}s, {time.time() - t_start:.0f}s me bani, {gem.calls} AI calls)")
    return final


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("scripts", nargs="*")
    ap.add_argument("--list")
    ap.add_argument("--demo", nargs="?", const="short")
    a = ap.parse_args()
    cfg = load_config()
    if a.demo:
        make("demo", cfg, demo=a.demo)
        return
    files = list(a.scripts)
    if a.list and Path(a.list).exists():
        files += [l.strip() for l in Path(a.list).read_text(encoding="utf-8").splitlines() if l.strip()]
    if not files:
        log("Koi script nahi mili. scripts/ folder mein .txt file daalo.")
        return
    if not any_key():
        log("ℹ️ Koi AI key nahi mili — free bina-key services (llm7, pollinations) se chalega (thoda dheere).")
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
