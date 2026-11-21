"""Script -> scene plan (JSON). Narration stays EXACTLY the user's words."""
from .util import log, slugify, split_into_chunks

ENTER = ["pop", "slide_left", "slide_right", "drop", "rise", "fade", "zoom", "draw"]
MOTION = ["none", "float", "pulse", "shake", "sway", "spin", "glow", "breathe", "bob"]
CAMERA = ["zoom_in", "zoom_out", "pan_left", "pan_right", "push", "still"]
BG_TYPES = ["wall", "night", "sunset", "dark", "sky"]
BG_COLORS = ["mustard", "teal", "purple", "terracotta", "navy", "cream", "red"]
SFX = ["whoosh", "pop", "tick", "thud", "riser", "ding", "heartbeat", "glitch", "click", "swoosh_down", "alarm"]
WIDGETS = ["counter", "paper", "particles", "bars", "clock"]
TRANSITIONS = ["slide_left", "slide_up", "fade", "zoom", "flash"]

PROMPT = """You are the director of a viral vertical (9:16) explainer video channel.
Style: real-incident / science explainers like "a family of four, next morning none woke up…".
Every scene = ONE strong visual idea on a textured illustrated set, short punchy captions, constant motion.

The narration script is already split into numbered CHUNKS. Group consecutive chunks into scenes
(usually 1 chunk per scene, max 2; a scene should last ~2-6 seconds). Every chunk must be used exactly once, in order.

CHUNKS:
{chunks}

Narration language: {language}. Captions language: {caption_language}.

For each scene decide what to SHOW. Visual objects ("elements") will be DRAWN AS VECTOR ILLUSTRATIONS by an AI
artist from your "describe" text, so describe concrete, drawable things (objects, people, places, body parts,
animals, diagrams). One element = one object or a small tight group (e.g. "four people sleeping side by side
under colourful quilts on a wooden bed"). Prefer 1-3 elements per scene. REUSE the same asset name across
scenes when the same thing appears again (consistency + saves cost).

EXISTING LIBRARY (already drawn, reuse by exact name when it fits):
{library}

FRAME LAYOUT: 1080x1920. Captions sit in the top area (y 5%-22%). Put visuals between y 30% and 92%.
x,y = element CENTER in % of frame. w = element width in % of frame width (15-95).
Bigger hero element usually w 60-90 at y 55-65.

Return JSON:
{{
 "title": "catchy YouTube title in {caption_language}",
 "description": "2-3 line YouTube description in {caption_language}",
 "tags": ["5-10 tags"],
 "scenes": [
  {{
   "chunks": [1],
   "caption_top": "2-4 WORDS, small white line",
   "caption_main": "1-4 WORDS, big coloured punch line (or empty string)",
   "main_word": "the narration word when the main caption should pop (copy a word from the chunk), or empty",
   "accent": one of {accents},
   "background": {{"type": one of {bg_types}, "color": one of {bg_colors}, "floor": true/false}},
   "camera": one of {camera},
   "transition": one of {transitions}  (how this scene enters),
   "elements": [
     {{"asset": "short_snake_case_name", "describe": "precise visual description for the artist (only needed if new)",
       "x": 50, "y": 60, "w": 70, "enter": one of {enter}, "motion": one of {motion},
       "at_word": "narration word when it appears (or empty = scene start)", "flip": false}}
   ],
   "widgets": [ optional, any of:
     {{"type":"counter","value":"58,000","label":"EVERY YEAR","x":50,"y":45}},
     {{"type":"paper","title":"headline or study title","source":"AIIMS Delhi","highlight":"95% deaths in winter","x":50,"y":62}},
     {{"type":"particles","kind": one of ["smoke","dust","sparks","rain","snow","bubbles","embers"]}},
     {{"type":"bars","items":[{{"label":"India","value":58}},{{"label":"Rest","value":42}}],"x":50,"y":62}},
     {{"type":"clock","from":"20:00","to":"02:00","x":50,"y":58}}
   ],
   "sfx": [ optional extra sound effects: {{"type": one of {sfx}, "at_word": "word"}} ]
  }}
 ]
}}

Rules:
- Use numbers/facts ONLY if they are in the script. Use "paper"/"counter" widgets when the script cites data or sources.
- Captions: ALL CAPS, very short, never full sentences, they highlight the key idea of the chunk.
- Vary backgrounds/cameras/enters so it never feels static. Dramatic moments: night/dark backgrounds, heartbeat/riser sfx.
- Keep describe texts specific (colours, materials, Indian setting if the story is in India, etc).
"""


def build_plan(gem, script, cfg, library_names):
    chunks = split_into_chunks(script)
    numbered = "\n".join(f"{i + 1}. {c}" for i, c in enumerate(chunks))
    lib = ", ".join(sorted(library_names)[:400]) or "(empty)"
    prompt = PROMPT.format(
        chunks=numbered, language=cfg["language"], caption_language=cfg["caption_language"],
        library=lib, accents=list(cfg["style"]["caption_colors"].keys()), bg_types=BG_TYPES,
        bg_colors=BG_COLORS, camera=CAMERA, transitions=TRANSITIONS, enter=ENTER, motion=MOTION, sfx=SFX)
    log(f"Planner: {len(chunks)} chunks → scenes")
    plan = gem.generate_json(prompt, temperature=0.8)
    return normalize_plan(plan, chunks, library_names)


def _num(v, default, lo, hi):
    try:
        return max(lo, min(hi, float(v)))
    except (TypeError, ValueError):
        return default


def _pick(v, options, default):
    return v if v in options else default


def normalize_plan(plan, chunks, library_names=()):
    """Make the model output safe: every chunk once, in order; clamp all values."""
    raw = plan.get("scenes") or []
    used = set()
    scenes = []
    for s in raw:
        ids = []
        for c in s.get("chunks") or []:
            try:
                c = int(c) - 1
            except (TypeError, ValueError):
                continue
            if 0 <= c < len(chunks) and c not in used:
                ids.append(c)
        if not ids:
            continue
        used.update(ids)
        s["_ids"] = sorted(ids)
        scenes.append(s)
    scenes.sort(key=lambda s: s["_ids"][0])
    # chunks the model forgot -> attach to the closest previous scene (or a new plain scene)
    for c in range(len(chunks)):
        if c in used:
            continue
        prev = [s for s in scenes if s["_ids"][0] < c]
        if prev:
            prev[-1]["_ids"].append(c)
        else:
            scenes.insert(0, {"_ids": [c], "caption_top": "", "caption_main": "", "elements": []})
    for s in scenes:
        s["_ids"].sort()

    out = []
    for i, s in enumerate(scenes):
        narration = " ".join(chunks[c] for c in s["_ids"])
        bg = s.get("background") or {}
        els = []
        for e in (s.get("elements") or [])[:4]:
            name = slugify(e.get("asset") or e.get("describe") or "thing")
            if not name:
                continue
            els.append({
                "asset": name,
                "describe": (e.get("describe") or name.replace("_", " ")).strip(),
                "x": _num(e.get("x"), 50, 0, 100), "y": _num(e.get("y"), 62, 20, 100),
                "w": _num(e.get("w"), 60, 8, 100),
                "enter": _pick(e.get("enter"), ENTER, "pop"),
                "motion": _pick(e.get("motion"), MOTION, "float"),
                "at_word": str(e.get("at_word") or ""), "flip": bool(e.get("flip")),
            })
        widgets = []
        for w in (s.get("widgets") or [])[:3]:
            if isinstance(w, dict) and w.get("type") in WIDGETS:
                widgets.append(w)
        sfx = [x for x in (s.get("sfx") or []) if isinstance(x, dict) and x.get("type") in SFX][:4]
        out.append({
            "index": i,
            "narration": narration,
            "caption_top": str(s.get("caption_top") or "").upper()[:40],
            "caption_main": str(s.get("caption_main") or "").upper()[:40],
            "main_word": str(s.get("main_word") or ""),
            "accent": s.get("accent") if s.get("accent") in ("orange", "red", "teal", "yellow") else "orange",
            "background": {"type": _pick(bg.get("type"), BG_TYPES, "wall"),
                           "color": _pick(bg.get("color"), BG_COLORS, "mustard"),
                           "floor": bool(bg.get("floor"))},
            "camera": _pick(s.get("camera"), CAMERA, "zoom_in"),
            "transition": _pick(s.get("transition"), TRANSITIONS, "slide_left"),
            "elements": els, "widgets": widgets, "sfx": sfx,
        })
    return {"title": plan.get("title", ""), "description": plan.get("description", ""),
            "tags": plan.get("tags", []), "scenes": out}
