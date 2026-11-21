"""Turns plan + voice timings into an exact timeline shared by the video engine AND the audio mixer."""
import re

from .voice import norm_word

ENTER_SFX = {"pop": "pop", "zoom": "pop", "drop": "thud", "slide_left": "click",
             "slide_right": "click", "rise": "click", "fade": None, "draw": "click"}


def word_time(words, target, default, after=0.0):
    t = norm_word(target or "")
    if not t:
        return default
    for w in words:
        if w["start"] + 1e-6 < after:
            continue
        nw = norm_word(w["w"])
        if nw and (nw == t or (len(t) > 3 and (nw.startswith(t) or t.startswith(nw)))):
            return w["start"]
    return default


def build(plan, timings, assets, cfg):
    scenes_out, events = [], []
    for i, (sc, tm) in enumerate(zip(plan["scenes"], timings)):
        start, end = tm["start"], tm["end"]
        words = tm["words"]
        dur = max(0.5, end - start)
        # transition (except first scene)
        if i > 0:
            events.append({"t": start - 0.12, "type": "whoosh" if sc["transition"] != "flash" else "glitch",
                           "gain": 0.8})
        els = []
        for j, e in enumerate(sc["elements"]):
            default = start + 0.15 + 0.22 * j
            at = word_time(words, e.get("at_word"), default)
            at = min(max(start + 0.05, at), end - 0.4)
            svg, aspect = assets[e["asset"]]
            els.append({**e, "t": round(at, 3), "svg": svg, "aspect": aspect})
            s = ENTER_SFX.get(e["enter"])
            if s:
                events.append({"t": at, "type": s, "gain": 0.55 if s != "thud" else 0.5})
        wid = []
        for k, w in enumerate(sc["widgets"]):
            at = start + 0.3 + 0.25 * k
            if w["type"] == "counter":
                for q in range(9):
                    events.append({"t": at + 0.12 * q, "type": "tick", "gain": 0.5})
                events.append({"t": at + 1.15, "type": "ding", "gain": 0.4})
            elif w["type"] == "paper":
                events.append({"t": at, "type": "swoosh_down", "gain": 0.5})
            elif w["type"] in ("bars", "clock"):
                events.append({"t": at, "type": "riser", "gain": 0.25})
            wid.append({**w, "t": round(at, 3)})
        main_t = word_time(words, sc.get("main_word"), start + min(0.9, dur * 0.35))
        main_t = min(max(start + 0.2, main_t), end - 0.3)
        if sc["caption_main"]:
            events.append({"t": main_t, "type": "thud", "gain": 0.35})
        for x in sc["sfx"]:
            events.append({"t": word_time(words, x.get("at_word"), start + 0.3), "type": x["type"], "gain": 0.6})
        scenes_out.append({
            "start": round(start, 3), "end": round(end, 3),
            "caption_top": sc["caption_top"], "caption_main": sc["caption_main"],
            "main_t": round(main_t, 3), "accent": sc["accent"], "background": sc["background"],
            "camera": sc["camera"], "transition": sc["transition"], "elements": els, "widgets": wid,
            "words": words,
        })
    duration = timings[-1]["end"] + 0.6 if timings else 1
    pal = cfg["style"]
    return {
        "w": cfg["video"]["width"], "h": cfg["video"]["height"], "fps": cfg["video"]["fps"],
        "duration": round(duration, 3), "palette": pal["palette"], "captionColors": pal["caption_colors"],
        "scenes": scenes_out,
    }, sorted(events, key=lambda e: e["t"])
