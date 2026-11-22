"""Script -> scene plan (JSON). Narration stays EXACTLY the user's words.
Two modes: short (9:16 explainer) and story (16:9 "What if you were born as…" style)."""
from .util import log, slugify, split_into_chunks

ENTER = ["pop", "slide_left", "slide_right", "drop", "rise", "fade", "zoom", "draw", "sketch"]
MOTION = ["none", "float", "pulse", "shake", "sway", "spin", "glow", "breathe", "bob"]
CAMERA = ["zoom_in", "zoom_out", "pan_left", "pan_right", "push", "still"]
BG_TYPES = ["wall", "night", "sunset", "dark", "sky"]
BG_COLORS = ["mustard", "teal", "purple", "terracotta", "navy", "cream", "red"]
SFX = ["whoosh", "pop", "tick", "thud", "riser", "ding", "heartbeat", "glitch", "click", "swoosh_down", "alarm"]
WIDGETS = ["counter", "paper", "particles", "bars", "clock", "sign", "tag", "bubble"]
TRANSITIONS = ["slide_left", "slide_up", "fade", "zoom", "flash"]
MOODS = ["none", "warm", "cold", "danger", "night", "dream", "sad"]
POSES = ["stand", "wave", "point", "hands_up", "walk", "run", "sit", "shrug", "hold", "lie", "drown", "think"]
EXPR = ["neutral", "happy", "sad", "scared", "angry", "shocked", "sleeping", "thinking", "dead"]
ACTIONS = ["idle", "walk", "run", "wave", "panic"]
PERSON_KEYS = {
    "gender": ["m", "f"], "age": ["child", "teen", "adult", "old"], "skin": ["light", "medium", "brown", "dark"],
    "hair": ["short", "long", "bun", "ponytail", "curly", "spiky", "bald"],
    "hair_color": ["black", "brown", "blonde", "red", "grey", "white"],
    "beard": ["none", "stubble", "full", "mustache"],
    "top": ["shirt", "tshirt", "kurta", "suit", "uniform", "saree", "coat", "vest"],
    "bottom": ["pants", "shorts", "skirt", "dhoti", "dress"],
    "hat": ["none", "cowboy", "cap", "turban", "police", "helmet", "crown"],
}

COMMON_RULES = """
VISUAL TOOLKIT (use it richly, every scene should feel designed and alive):
1. "set": a full illustrated BACKGROUND drawn edge-to-edge by an AI artist (a room, street, pool, river bank, saloon,
   hospital, village at night...). Give it a reusable snake_case asset name + vivid description WITHOUT people.
   Reuse the same set across scenes in the same location. If no set, a plain stylised backdrop is used.
2. "elements": things drawn on top.
   - PEOPLE are NOT drawn by the artist: use {{"person": "<character id>", "pose": .., "expression": .., "framing": "full|bust|head"}}.
     Define every character once in "characters" with fixed look. Use "talks": true when that character is the one
     speaking/being described, "action" for limb animation (walk/run/wave/panic/idle). "bust" = close-up.
   - Objects/animals/diagrams: {{"asset": "snake_case_name", "describe": "precise visual description"}}.
     The artist rigs moving parts (wheels, flames, tails, water...) automatically.
   - "layer": back | mid | front  (depth parallax; back gets blurred).  "to_x": target x to move/walk across the scene.
   - "rotate": degrees (e.g. 90 for a person lying down). "submerge": 0-85 = % of the element hidden below a water line
     (swimming/drowning people, boats, half-sunk objects).
3. "widgets": counter (big flip number), paper (pinned study/news card with highlighted line), particles
   (smoke/dust/sparks/rain/snow/bubbles/embers), bars (comparison chart), clock (time passing),
   sign (wooden location board: {{"type":"sign","text":"THE GANG'S CAMP","sub":"1894","x":22,"y":14}}),
   tag (name label with arrow: {{"type":"tag","text":"ARTHUR","x":..,"y":..,"dir":"down|left|right"}}),
   bubble (speech bubble: {{"type":"bubble","text":"Leave her.","x":..,"y":..,"tail":"left|right"}}).
4. "mood": tint for emotion (warm/cold/danger/night/dream/sad/none). "rays": true for god-rays light.
5. Enter animations: pop, slide_left, slide_right, drop, rise, fade, zoom, draw, sketch (line-drawing reveal).
   Motions: float, pulse, shake, sway, spin, glow, breathe, bob, none.
"""

SHORT_PROMPT = """You are the director of a viral vertical (9:16) explainer channel.
Style: real-incident / science explainers ("a family of four, next morning none woke up…").
Each scene = ONE strong visual idea, punchy captions, constant motion.

CHUNKS (narration, already split; group consecutive chunks into scenes, usually 1 per scene, max 2;
every chunk exactly once, in order):
{chunks}

Narration language: {language}. Captions language: {caption_language}.
{context}
EXISTING LIBRARY (already drawn, reuse by exact name if it fits): {library}

FRAME 1080x1920. Captions occupy the top (y 5-22%). Word subtitles appear near y 85%. Put visuals between y 28% and 80%.
x,y = element CENTER in % of frame; w = width in % of frame width (15-95).
""" + COMMON_RULES + """
Return JSON:
{{"title": "...", "description": "...", "tags": [...],
 "characters": {{"id": {{"gender":..,"age":..,"skin":..,"hair":..,"hair_color":..,"beard":..,"top":..,"top_color":"colour name",
                 "bottom":..,"bottom_color":"colour name","hat":..,"glasses":false}}}},
 "scenes": [{{"chunks":[1], "caption_top":"2-4 WORDS", "caption_main":"1-4 WORDS or empty", "main_word":"word in chunk",
   "accent":"orange|red|teal|yellow", "background":{{"type":..,"color":..,"floor":true}},
   "set": {{"asset":"..","describe":".."}} or null, "mood":.., "rays":false, "camera":.., "transition":..,
   "elements":[...], "widgets":[...], "sfx":[{{"type":..,"at_word":".."}}]}}]}}
Rules: facts/numbers ONLY from the script. Captions ALL CAPS, short. Vary sets/cameras/enters. Use sets often.
"""

STORY_PROMPT = """You are the director of a hit 16:9 animated storytelling channel ("What if you were born as…",
life stories, history). Flat 2D cartoon look: fully illustrated locations, recurring characters with consistent looks,
name tags with arrows, location/year signs, speech bubbles, insert documents, chapter title cards.

CHUNKS (narration; group consecutive chunks into scenes, 1-2 per scene; every chunk exactly once, in order):
{chunks}

Narration language: {language}. On-screen text language: {caption_language}.
{context}
EXISTING LIBRARY (reuse by exact name if it fits): {library}

FRAME 1920x1080 (landscape). Top-left has small headline captions (optional, use sparingly in story mode -
often leave caption_top/caption_main empty and use signs/tags/bubbles instead). Subtitles at bottom.
x,y = element CENTER in % of frame; w = width in % of frame width (8-60). People standing on ground: y 60-72, w 12-20.
Close-up talking person: framing "bust", w 22-30, y 62.
""" + COMMON_RULES + """
Story extras: when a new chapter of life starts, set "chapter": "Short Chapter Title" and "chapter_num": "CHAPTER II"
on that scene (max ~1 per 6-10 scenes; first scene can be a chapter). Use "sign" when a location/time first appears,
"tag" when a character first appears, "bubble" for short spoken lines.

Return JSON:
{{"title":"...","description":"...","tags":[...],
 "characters": {{"id": {{...look fields...}}}},
 "scenes":[{{"chunks":[1],"caption_top":"","caption_main":"","main_word":"","accent":"orange",
   "background":{{"type":..,"color":..,"floor":true}},"set":{{"asset":"..","describe":".."}},"mood":..,"rays":false,
   "camera":..,"transition":..,"chapter":null,"chapter_num":null,"elements":[...],"widgets":[...],"sfx":[]}}]}}
Rules: facts ONLY from the script. Keep characters consistent (same id = same look). Every scene should have a set.
"""

CHAR_FIELDS = "Character look fields: " + "; ".join(f"{k}: {'|'.join(v)}" for k, v in PERSON_KEYS.items()) + \
              "; top_color/bottom_color/hat_color: colour names (red, maroon, orange, yellow, green, teal, blue, navy, purple, pink, white, cream, grey, black, brown, khaki, beige); glasses: true/false."


def build_plan(gem, script, cfg, library_names, mode="short"):
    chunks = split_into_chunks(script, max_words=16 if mode == "short" else 22)
    lib = ", ".join(sorted(library_names)[:300]) or "(empty)"
    tmpl = STORY_PROMPT if mode == "story" else SHORT_PROMPT
    batch = 16 if mode == "short" else 14
    merged = {"title": "", "description": "", "tags": [], "characters": {}, "scenes": []}
    for b0 in range(0, len(chunks), batch):
        part = chunks[b0:b0 + batch]
        numbered = "\n".join(f"{b0 + i + 1}. {c}" for i, c in enumerate(part))
        ctx = CHAR_FIELDS
        if merged["characters"]:
            ctx += "\nCHARACTERS ALREADY DEFINED (reuse these ids, do not redefine): " + \
                   "; ".join(f"{k}={v}" for k, v in merged["characters"].items())
        if merged["scenes"]:
            last = merged["scenes"][-1]
            used_sets = sorted({(s.get("set") or {}).get("asset", "") for s in merged["scenes"] if s.get("set")} - {""})
            ctx += f"\nThis continues an existing video (chunks before {b0 + 1} are done). Sets already used: {', '.join(used_sets)}." \
                   f" Previous scene caption: {last.get('caption_top', '')} {last.get('caption_main', '')}."
        prompt = tmpl.format(chunks=numbered, language=cfg["language"], caption_language=cfg["caption_language"],
                             library=lib, context=ctx)
        log(f"Planner ({mode}): chunks {b0 + 1}-{b0 + len(part)} / {len(chunks)}")
        out = coerce_plan(gem.generate_json(prompt, temperature=0.8, task="plan"))
        if not merged["title"]:
            for k in ("title", "description", "tags"):
                merged[k] = out.get(k, merged[k])
        for k, v in out["characters"].items():
            if isinstance(v, dict):
                merged["characters"].setdefault(slugify(k), v)
        merged["scenes"] += [s for s in (out.get("scenes") or []) if isinstance(s, dict)]
    return normalize_plan(merged, chunks, library_names, mode)


def coerce_plan(out):
    """AI kabhi JSON ki shape badal deta hai (list, nested). Use hamesha ek hi shape mein lao."""
    if isinstance(out, list):
        if out and all(isinstance(x, dict) and "chunks" in x for x in out):
            out = {"scenes": out}
        else:
            merged = {}
            for x in out:
                if isinstance(x, dict):
                    merged.update(x)
            out = merged
    if not isinstance(out, dict):
        out = {}
    for key in ("plan", "video", "result", "data"):
        if isinstance(out.get(key), dict) and "scenes" in out[key]:
            out = out[key]
    chars = out.get("characters")
    if isinstance(chars, list):
        d = {}
        for c in chars:
            if isinstance(c, dict):
                cid = c.get("id") or c.get("name") or f"c{len(d)}"
                d[str(cid)] = {k: v for k, v in c.items() if k not in ("id", "name")}
        chars = d
    out["characters"] = chars if isinstance(chars, dict) else {}
    sc = out.get("scenes")
    out["scenes"] = [x for x in sc if isinstance(x, dict)] if isinstance(sc, list) else []
    for k, default in (("title", ""), ("description", ""), ("tags", [])):
        if not isinstance(out.get(k), type(default)):
            out[k] = default
    return out


def _d(v):
    return v if isinstance(v, dict) else {}


def _l(v):
    return v if isinstance(v, list) else []


def _num(v, default, lo, hi):
    try:
        return max(lo, min(hi, float(v)))
    except (TypeError, ValueError):
        return default


def _pick(v, options, default):
    return v if v in options else default


PERSON_DEFAULTS = {"gender": "m", "age": "adult", "skin": "medium", "hair": "short", "hair_color": "black",
                   "beard": "none", "top": "shirt", "bottom": "pants", "hat": "none"}


def norm_person(spec):
    spec = spec if isinstance(spec, dict) else {}
    out = {k: _pick(str(spec.get(k, "")).lower(), opts, PERSON_DEFAULTS[k]) for k, opts in PERSON_KEYS.items()}
    g = str(spec.get("gender", "")).lower()
    if g not in ("m", "f"):
        out["gender"] = "f" if g.startswith(("f", "w", "g")) else "m"
    for k in ("top_color", "bottom_color", "hat_color"):
        if spec.get(k):
            out[k] = str(spec[k]).lower().strip()
    out["glasses"] = bool(spec.get("glasses"))
    out["bindi"] = bool(spec.get("bindi"))
    return out


def normalize_plan(plan, chunks, library_names=(), mode="short"):
    raw = plan.get("scenes") or []
    used, scenes = set(), []
    for s in raw:
        ids = []
        for c in _l(s.get("chunks")) or ([s.get("chunks")] if s.get("chunks") is not None else []):
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
    for c in range(len(chunks)):
        if c in used:
            continue
        prev = [s for s in scenes if s["_ids"][0] < c]
        if prev and len(prev[-1]["_ids"]) < 3:
            prev[-1]["_ids"].append(c)
        else:  # make a scene that reuses the previous visuals
            base = dict(prev[-1]) if prev else {"elements": []}
            base = {**base, "_ids": [c], "caption_top": "", "caption_main": "", "chapter": None, "widgets": []}
            scenes.append(base)
        scenes.sort(key=lambda s: s["_ids"][0])
    for s in scenes:
        s["_ids"].sort()

    chars = {slugify(k): norm_person(v) for k, v in _d(plan.get("characters")).items()}
    out = []
    for i, s in enumerate(scenes):
        narration = " ".join(chunks[c] for c in s["_ids"])
        bg = _d(s.get("background"))
        els = []
        for e in _l(s.get("elements"))[:6]:
            if not isinstance(e, dict):
                continue
            base = {
                "x": _num(e.get("x"), 50, -10, 110), "y": _num(e.get("y"), 62, 10, 105),
                "w": _num(e.get("w"), 60 if mode == "short" else 20, 5, 100),
                "enter": _pick(e.get("enter"), ENTER, "pop"), "motion": _pick(e.get("motion"), MOTION, "none"),
                "at_word": str(e.get("at_word") or ""), "flip": bool(e.get("flip")),
                "layer": _pick(e.get("layer"), ["back", "mid", "front"], "mid"),
                "action": _pick(e.get("action"), ACTIONS, "idle"), "talks": bool(e.get("talks")),
            }
            if e.get("to_x") is not None:
                base["to_x"] = _num(e.get("to_x"), base["x"], -20, 120)
            if e.get("rotate"):
                base["rotate"] = _num(e.get("rotate"), 0, -180, 180)
            if e.get("submerge"):
                base["submerge"] = _num(e.get("submerge"), 0, 0, 85)
            pid = e.get("person") or e.get("character")
            if pid:
                pid = slugify(pid)
                if pid not in chars:
                    chars[pid] = norm_person(e.get("look") or {})
                pose = _pick(e.get("pose"), POSES, "stand")
                if pose == "lie" and "rotate" not in base:
                    base["rotate"] = -90
                if base["action"] in ("walk", "run") and pose == "stand":
                    pose = base["action"]
                base.update({"person_id": pid, "pose": pose,
                             "expression": _pick(e.get("expression"), EXPR, "neutral"),
                             "framing": _pick(e.get("framing"), ["full", "bust", "head"], "full")})
                if base["motion"] in ("spin",):
                    base["motion"] = "none"
                els.append(base)
                continue
            name = slugify(e.get("asset") or e.get("describe") or "thing")
            base.update({"asset": name, "describe": (e.get("describe") or name.replace("_", " ")).strip()})
            els.append(base)
        widgets = [w for w in _l(s.get("widgets"))[:5] if isinstance(w, dict) and w.get("type") in WIDGETS]
        sfx = [x for x in _l(s.get("sfx")) if isinstance(x, dict) and x.get("type") in SFX][:4]
        st = s.get("set") if isinstance(s.get("set"), dict) else None
        if st and (st.get("asset") or st.get("describe")):
            st = {"asset": "set_" + slugify(st.get("asset") or st.get("describe")).removeprefix("set_"),
                  "describe": (st.get("describe") or st.get("asset")).strip(), "blur": bool(st.get("blur"))}
        else:
            st = None
        out.append({
            "index": i, "narration": narration,
            "caption_top": str(s.get("caption_top") or "").upper()[:40],
            "caption_main": str(s.get("caption_main") or "").upper()[:40],
            "main_word": str(s.get("main_word") or ""),
            "accent": s.get("accent") if s.get("accent") in ("orange", "red", "teal", "yellow") else "orange",
            "background": {"type": _pick(bg.get("type"), BG_TYPES, "wall"),
                           "color": _pick(bg.get("color"), BG_COLORS, "mustard"), "floor": bool(bg.get("floor"))},
            "set": st, "mood": _pick(s.get("mood"), MOODS, "none"), "rays": bool(s.get("rays")),
            "camera": _pick(s.get("camera"), CAMERA, "zoom_in"),
            "transition": _pick(s.get("transition"), TRANSITIONS, "slide_left"),
            "chapter": (str(s.get("chapter"))[:40] if s.get("chapter") else None),
            "chapter_num": (str(s.get("chapter_num"))[:20] if s.get("chapter_num") else None),
            "elements": els, "widgets": widgets, "sfx": sfx,
        })
    if mode == "story":
        fix_story_layout(out)
    return {"title": plan.get("title", ""), "description": plan.get("description", ""),
            "tags": plan.get("tags", []), "mode": mode, "characters": chars, "scenes": out}


def fix_story_layout(scenes):
    """Guard rails so a weaker AI plan still looks composed: sizes, ground line, no overlaps, set continuity."""
    last_set = None
    for sc in scenes:
        if sc.get("set"):
            last_set = sc["set"]
        elif last_set:
            sc["set"] = dict(last_set)
        people = [e for e in sc["elements"] if e.get("person_id")]
        objs = [e for e in sc["elements"] if not e.get("person_id")]
        for e in people:
            if e.get("rotate"):
                continue
            if e["framing"] == "full":
                e["w"] = max(12, min(20, e["w"]))
                e["y"] = max(60, min(72, e["y"]))
            elif e["framing"] == "bust":
                e["w"] = max(24, min(34, e["w"]))
                e["y"] = max(58, min(66, e["y"]))
            else:
                e["w"] = max(14, min(22, e["w"]))
        for e in objs:
            e["w"] = max(6, min(42, e["w"]))
        grounded = [e for e in people if e["framing"] == "full" and not e.get("rotate")]
        if grounded:
            gy = sum(e["y"] for e in grounded) / len(grounded)
            for e in grounded:
                e["y"] = round(gy, 1)
        full = sorted([e for e in people if e["framing"] == "full" and not e.get("to_x")], key=lambda e: e["x"])
        if len(full) > 1:
            gap = min(18, 70 / len(full))
            for a, b in zip(full, full[1:]):
                if b["x"] - a["x"] < gap:
                    b["x"] = min(92, a["x"] + gap)
            if full[-1]["x"] > 92:
                start = 50 - gap * (len(full) - 1) / 2
                for k, e in enumerate(full):
                    e["x"] = start + gap * k
        busts = [e for e in people if e["framing"] == "bust"]
        if len(busts) > 2:
            for e in busts[2:]:
                sc["elements"].remove(e)
        if len(busts) == 2 and abs(busts[0]["x"] - busts[1]["x"]) < 30:
            busts[0]["x"], busts[1]["x"] = 30, 70
            busts[1]["flip"] = True
