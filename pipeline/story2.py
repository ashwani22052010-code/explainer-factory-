"""Story engine v2: AI plans scenes for the code-drawn 2D engine (renderer_story)."""
from .planner import coerce_plan, _num, _pick, _l, _d
from .timeline import word_time
from .util import log, slugify, split_into_chunks

SETS = ["city", "room_poor", "street", "mansion", "office", "bank", "hospital", "library", "party", "rooftop", "village", "spotlight", "desk"]
TODS = ["day", "morning", "sunset", "night"]
POSES = ["stand", "hands_hips", "cross_arms", "point", "hey", "secret", "think", "shock", "celebrate", "phone_look", "phone_ear", "hold",
         "shrug", "sad", "pray", "wave", "count", "fist_up", "cry", "hug", "explain", "present", "headache"]
EXPRS = ["neutral", "happy", "joy", "sad", "angry", "shock", "scared", "worried", "smirk", "thinking", "determined", "sleep"]
SHOTS = ["wide", "medium", "close", "push_in", "pull_out", "pan"]
OVERLAYS = ["nametag", "callout", "prop", "inset", "card", "title", "tag", "year", "counter", "bubble"]
PROPS = ["ticket", "phone", "money", "envelope", "car", "chai"]
MOODS = {"warm": "linear-gradient(rgba(255,180,90,.12), rgba(120,60,20,.14))", "cold": "linear-gradient(rgba(80,120,220,.18), rgba(30,50,120,.22))",
         "night": "linear-gradient(rgba(40,60,160,.28), rgba(10,20,80,.32))", "danger": "radial-gradient(ellipse at 50% 50%, rgba(255,255,255,0) 40%, rgba(170,20,30,.45) 100%)",
         "sad": "linear-gradient(rgba(90,100,130,.30), rgba(50,55,75,.32))", "dream": "linear-gradient(rgba(170,120,255,.18), rgba(255,170,220,.14))"}
CHAR_KEYS = {"gender": ["m", "f"], "age": ["child", "teen", "adult", "old"], "skin": ["light", "medium", "brown", "dark"],
             "hair": ["short", "side_part", "messy", "curly", "long", "bun", "ponytail", "braid", "bald"],
             "hair_color": ["black", "brown", "grey", "white", "blonde"], "beard": ["none", "stubble", "mustache", "full"],
             "top": ["shirt", "tshirt", "kurta", "suit", "vest", "coat", "saree", "kameez"], "bottom": ["pants", "shorts", "dhoti", "skirt_long"],
             "hat": ["none", "cap", "topi"], "shoes": ["shoes", "sandal"]}
COLORS = "red maroon orange yellow mustard green olive teal blue navy purple pink white cream grey charcoal black brown khaki beige denim gold"

PROMPT = """You are the director of a top-tier animated storytelling YouTube channel (16:9, flat 2D, cel-shaded characters,
detailed illustrated sets, purposeful acting). Every visual must SHOW exactly what the narration says at that moment.

CHUNKS of narration (group consecutive chunks into scenes: 1-3 chunks, each scene 3-9 seconds; every chunk exactly once, in order):
{chunks}

Narration language: {language}. On-screen text language: {text_language} (keep it SHORT).
{context}

TOOLKIT
- set.type: {sets}   set.tod (time of day): {tods}
  (city = town skyline establishing shot, room_poor = small rented room, street = Indian shop street with a lottery stall,
   mansion = rich hall, office, bank, hospital, library, party, rooftop (night city view), village, spotlight = dramatic dark stage, desk = close-up table for documents)
- characters: define each person ONCE in "characters" with a fixed look:
  {char_keys}; colours for top_color/bottom_color/shirt_color/vest_color: {colors}; glasses/bindi true|false.
  Same person in a new outfit (e.g. rich later) -> put "outfit": {{"top":"suit","top_color":"charcoal"}} on the cast entry.
- cast entry: {{"id":"hero","pos":"left|center|right|far_left|far_right","flip":false,"pose":P,"expr":E,
   "then":[{{"at_word":"word from narration","pose":P,"expr":E,"move_to":"right"}}],"talks":false}}
  poses: {poses}
  expressions: {exprs}
  Poses must MATCH the meaning (phone_look when checking phone, shock on shocking news, celebrate on victory, sad when lonely,
  think when deciding, point/explain when telling, hug for family). Change pose only when the story changes. Max 3 people per scene.
  "talks": true only if that character literally speaks a quoted line in this scene.
- shot: {shots} with "focus": character id. Vary shots: wide to establish, close for emotions, push_in for tension.
- overlays (each with "at_word" = narration word when it appears):
  nametag {{"target":id,"text":"NAME","sub":"short role"}} - first time a person appears
  callout {{"target":id,"text":"2-3 words"}} - hand-drawn arrow pointing at a detail of that person / what they hold
  prop {{"prop": one of {props}, "side":"left|right"}} - object appearing next to the focus person
  inset {{"prop": one of {props}}} - circular zoom close-up of an object
  card {{"kicker":"small label","strike":"crossed-out old value or empty","text":"BIG VALUE","sub":"short note"}} - facts / numbers / rules
  title {{"text":"1-2 WORDS"}} - big emotional punch word
  tag {{"text":"time / place label"}}   year {{"text":"2026"}}
  counter {{"value":28000,"prefix":"₹","suffix":"","label":"short label"}} - numbers from the script
  bubble {{"target":id,"text":"short spoken line"}} - only for dialogue in the script
- "flash_word": a word for a white flash at a shocking moment (optional). "mood": warm|cold|night|danger|sad|dream|none. "dust": true for cozy interiors.

Return JSON: {{"title":"YouTube title","description":"2 lines","tags":["..."],
 "characters":{{"hero":{{...}}}},
 "scenes":[{{"chunks":[1],"set":{{"type":"room_poor","tod":"day"}},"cast":[...],"shot":"medium","focus":"hero","overlays":[...],"flash_word":"","mood":"warm","dust":true}}]}}
Rules: facts/numbers ONLY from the script. 1-3 overlays per scene, never clutter. The hero ("you"/main person) should appear in most scenes.
"""


def plan(gem, script, cfg):
    chunks = split_into_chunks(script, max_words=20)
    merged = {"title": "", "description": "", "tags": [], "characters": {}, "scenes": []}
    batch = 14
    for b0 in range(0, len(chunks), batch):
        part = chunks[b0:b0 + batch]
        ctx = ""
        if merged["characters"]:
            ctx += "CHARACTERS ALREADY DEFINED (reuse ids, do not redefine): " + "; ".join(f"{k}={v}" for k, v in merged["characters"].items())
        if merged["scenes"]:
            last = merged["scenes"][-1]
            ctx += f"\nThis continues the video (earlier chunks done). Previous scene set: {_d(last.get('set')).get('type')}."
        prompt = PROMPT.format(chunks="\n".join(f"{b0 + i + 1}. {c}" for i, c in enumerate(part)), language=cfg["language"],
                               text_language=cfg.get("caption_language", cfg["language"]) if cfg["language"] != "hindi" else "hindi",
                               context=ctx, sets=SETS, tods=TODS, poses=POSES, exprs=EXPRS, shots=SHOTS, props=PROPS, colors=COLORS,
                               char_keys="; ".join(f"{k}: {'|'.join(v)}" for k, v in CHAR_KEYS.items()))
        log(f"Planner (story v2): chunks {b0 + 1}-{b0 + len(part)} / {len(chunks)}")
        out = coerce_plan(gem.generate_json(prompt, temperature=0.75, task="plan"))
        if not merged["title"]:
            for k in ("title", "description", "tags"):
                merged[k] = out.get(k, merged[k])
        for k, v in out["characters"].items():
            if isinstance(v, dict):
                merged["characters"].setdefault(slugify(k), v)
        merged["scenes"] += out["scenes"]
    return normalize(merged, chunks)


def norm_char(c):
    c = _d(c)
    o = {k: _pick(str(c.get(k, "")).lower(), v, {"gender": "m", "age": "adult", "skin": "brown", "hair": "short", "hair_color": "black", "beard": "none",
                                                   "top": "shirt", "bottom": "pants", "hat": "none", "shoes": "shoes"}[k]) for k, v in CHAR_KEYS.items()}
    if str(c.get("gender", "")).lower().startswith(("f", "w")):
        o["gender"] = "f"
    for k in ("top_color", "bottom_color", "shirt_color", "vest_color", "tie_color", "accent"):
        if c.get(k):
            o[k] = str(c[k]).lower()
    o["glasses"], o["bindi"] = bool(c.get("glasses")), bool(c.get("bindi"))
    if o["gender"] == "f" and o["hair"] in ("short", "side_part", "messy", "bald"):
        o["hair"] = "long"
    if o["gender"] == "m" and o["top"] in ("saree", "kameez"):
        o["top"] = "kurta"
    return o


def normalize(p, chunks):
    used, scenes = set(), []
    for s in p["scenes"]:
        ids = []
        for c in _l(s.get("chunks")) or ([s.get("chunks")] if s.get("chunks") is not None else []):
            try:
                c = int(c) - 1
            except (TypeError, ValueError):
                continue
            if 0 <= c < len(chunks) and c not in used:
                ids.append(c)
        if ids:
            used.update(ids)
            s["_ids"] = sorted(ids)
            scenes.append(s)
    scenes.sort(key=lambda s: s["_ids"][0])
    for c in range(len(chunks)):
        if c not in used:
            prev = [s for s in scenes if s["_ids"][0] < c]
            if prev and len(prev[-1]["_ids"]) < 4:
                prev[-1]["_ids"].append(c)
            else:
                base = dict(prev[-1]) if prev else {}
                scenes.append({**base, "_ids": [c], "overlays": []})
            scenes.sort(key=lambda s: s["_ids"][0])
    chars = {slugify(k): norm_char(v) for k, v in _d(p.get("characters")).items()}
    out, last_set = [], {"type": "city", "tod": "day"}
    for s in scenes:
        st = _d(s.get("set"))
        st = {"type": _pick(st.get("type"), SETS, last_set["type"]), "tod": _pick(st.get("tod"), TODS, "day")}
        last_set = st
        cast = []
        for c in _l(s.get("cast"))[:3]:
            if not isinstance(c, dict):
                continue
            cid = slugify(c.get("id") or "hero")
            if cid not in chars:
                chars[cid] = norm_char(c.get("look") or {})
            then = []
            for k in _l(c.get("then"))[:4]:
                if isinstance(k, dict):
                    then.append({"at_word": str(k.get("at_word") or ""), "pose": _pick(k.get("pose"), POSES, None),
                                 "expr": _pick(k.get("expr"), EXPRS, None), "move_to": k.get("move_to")})
            cast.append({"id": cid, "pos": c.get("pos") or "center", "flip": bool(c.get("flip")),
                         "pose": _pick(c.get("pose"), POSES, "stand"), "expr": _pick(c.get("expr"), EXPRS, "neutral"),
                         "then": then, "talks": bool(c.get("talks")), "outfit": _d(c.get("outfit"))})
        ovs = []
        for o in _l(s.get("overlays"))[:4]:
            if isinstance(o, dict) and o.get("type") in OVERLAYS:
                if o["type"] in ("prop", "inset") and o.get("prop") not in PROPS:
                    continue
                ovs.append(o)
        out.append({"narration": " ".join(chunks[c] for c in s["_ids"]), "set": st, "cast": cast,
                    "shot": _pick(s.get("shot"), SHOTS, "medium"), "focus": slugify(s.get("focus") or (cast[0]["id"] if cast else "hero")),
                    "overlays": ovs, "flash_word": str(s.get("flash_word") or ""), "mood": s.get("mood") if s.get("mood") in MOODS else None,
                    "dust": bool(s.get("dust"))})
    return {"title": p.get("title", ""), "description": p.get("description", ""), "tags": p.get("tags", []),
            "characters": chars, "scenes": out, "mode": "story"}


# ---------------- plan + voice timings -> renderer data ----------------
POSX = {"far_left": 300, "left": 600, "center": 960, "right": 1320, "far_right": 1620}
SFX_FOR = {"callout": "swoosh_down", "bubble": "pop", "nametag": "pop", "inset": "pop", "title": "thud", "card": "thud", "tag": "click",
           "year": "thud", "prop": "pop"}


def build_data(plan, timings, cfg, env):
    scenes, events = [], []
    W, H = 1920, 1080
    for i, (sc, tm) in enumerate(zip(plan["scenes"], timings)):
        start, end, words = tm["start"], tm["end"], tm["words"]
        dur = max(1.0, end - start)
        rel = lambda w, default: max(0.0, min(dur - .3, word_time(words, w, start + default) - start))
        n = len(sc["cast"])
        cast, pos_of = [], {}
        for k, c in enumerate(sc["cast"]):
            x = POSX.get(c["pos"], None)
            if x is None:
                x = [960] if n == 1 else [700, 1220] if n == 2 else [520, 960, 1400]
                x = x[min(k, len(x) - 1)]
            track = [{"t": 0, "pose": c["pose"], "expr": c["expr"]}]
            cur_pose, cur_expr = c["pose"], c["expr"]
            for th in c["then"]:
                t0 = rel(th["at_word"], dur * .5)
                cur_pose, cur_expr = th["pose"] or cur_pose, th["expr"] or cur_expr
                key = {"t": round(t0, 2), "pose": cur_pose, "expr": cur_expr}
                if th.get("move_to") in POSX:
                    key["x"] = POSX[th["move_to"]]
                track.append(key)
            track.sort(key=lambda k: k["t"])
            spec = {**plan["characters"].get(c["id"], {}), **{k: v for k, v in c["outfit"].items() if isinstance(v, (str, bool))}}
            hgt = 520 if spec.get("age") == "child" else 700
            talk = [[0.2, dur - .2]] if c["talks"] else []
            cast.append({"id": c["id"], "spec": spec, "x": x, "h": hgt, "flip": c["flip"] or (n > 1 and x > 960 and k > 0), "track": track, "talk": talk})
            pos_of[c["id"]] = (x, 1000 - hgt)
        # camera
        fid = sc["focus"] if sc["focus"] in pos_of else (cast[0]["id"] if cast else None)
        fx, ftop = pos_of.get(fid, (960, 300))
        head, chest = (fx, ftop + 80), (fx, ftop + 260)
        shot = sc["shot"] if cast else ("push_in" if sc["shot"] in ("close", "medium") else sc["shot"])
        if shot == "wide":
            cam = [{"t": 0, "z": 1, "x": 960, "y": 540}]
        elif shot == "medium":
            cam = [{"t": 0, "z": 1.35, "x": chest[0], "y": chest[1]}]
        elif shot == "close":
            cam = [{"t": 0, "z": 1.95, "x": head[0], "y": head[1] + 40}]
        elif shot == "push_in":
            cam = [{"t": 0, "z": 1, "x": 960, "y": 540}, {"t": dur, "z": 1.75, "x": head[0], "y": head[1] + 60, "move": True}]
        elif shot == "pull_out":
            cam = [{"t": 0, "z": 1.8, "x": head[0], "y": head[1] + 60}, {"t": dur, "z": 1, "x": 960, "y": 540, "move": True}]
        else:  # pan
            cam = [{"t": 0, "z": 1.18, "x": max(700, fx - 240), "y": 560}, {"t": dur, "z": 1.18, "x": min(1220, fx + 240), "y": 560, "move": True}]
        for c in cam:
            z = c["z"]  # keep the view inside the set
            c["x"] = min(max(c["x"], 960 / z), 1920 - 960 / z)
            c["y"] = min(max(c["y"], 540 / z), 1080 - 540 / z)
        # overlays
        ovs = []
        for o in sc["overlays"]:
            t0 = rel(o.get("at_word"), min(1.0, dur * .3))
            typ = o["type"]
            tx, ttop = pos_of.get(o.get("target") and slugify(o.get("target")), (fx, ftop))
            d = {"type": typ, "t": round(t0, 2), "dur": round(min(3.6, dur - t0), 2)}
            if typ == "nametag":
                d.update(text=str(o.get("text", ""))[:24], sub=str(o.get("sub", ""))[:40], x=tx, y=max(90, ttop - 70), space="world")
            elif typ == "bubble":
                d.update(text=str(o.get("text", ""))[:40], x=min(1660, tx + 250), y=max(120, ttop + 30), space="world")
            elif typ == "callout":
                side = -1 if tx > 960 else 1
                d.update(text=str(o.get("text", ""))[:22], label=[tx + side * 360, max(140, ttop + 40)], to=[tx + side * 60, ttop + 330], bend=side * 60, space="world")
            elif typ == "prop":
                side = -1 if o.get("side") == "left" else 1
                d.update(prop=o["prop"], x=tx + side * 260, y=ttop + 380, w=300 if o["prop"] != "car" else 520, space="world", dur=round(dur - t0, 2))
            elif typ == "inset":
                d.update(prop=o["prop"], x=1480 if fx < 960 else 440, y=380)
            elif typ == "card":
                d.update(kicker=str(o.get("kicker", ""))[:30], strike=str(o.get("strike", ""))[:24], text=str(o.get("text", ""))[:24],
                         sub=str(o.get("sub", ""))[:50], stamp="OFFICIAL" if o.get("stamp", True) else "", x=960, y=500, dur=round(min(5, dur - t0), 2))
            elif typ == "title":
                d.update(text=str(o.get("text", ""))[:16], x=960, y=150, dur=round(min(2.6, dur - t0), 2))
            elif typ == "tag":
                d.update(text=str(o.get("text", ""))[:30], x=330, y=110)
            elif typ == "year":
                d.update(text=str(o.get("text", ""))[:10], x=960, y=170)
            elif typ == "counter":
                try:
                    v = float(str(o.get("value", 0)).replace(",", ""))
                except ValueError:
                    continue
                d.update(value=v, prefix=str(o.get("prefix", ""))[:3], suffix=str(o.get("suffix", ""))[:10], label=str(o.get("label", ""))[:30], x=1480 if fx < 960 else 440, y=330)
            ovs.append(d)
            k = SFX_FOR.get(typ)
            if k:
                events.append({"t": start + t0, "type": k, "gain": .5})
            if typ == "counter":
                events += [{"t": start + t0 + j * .12, "type": "tick", "gain": .35} for j in range(10)] + [{"t": start + t0 + 1.3, "type": "ding", "gain": .45}]
        flash = []
        if sc["flash_word"]:
            ft = rel(sc["flash_word"], dur * .6)
            flash = [round(ft, 2)]
            events += [{"t": start + ft - 1.4, "type": "riser", "gain": .45}, {"t": start + ft, "type": "thud", "gain": .85}]
        if i > 0:
            events.append({"t": start - .1, "type": "whoosh", "gain": .5})
        fxd = {}
        if sc["dust"]:
            fxd["dust"] = True
        if sc["set"]["type"] in ("room_poor", "mansion", "library") or sc["set"]["tod"] in ("morning", "sunset"):
            fxd["glow"] = {"x": 72 if sc["set"]["type"] == "room_poor" else 50, "y": 25}
        scenes.append({"start": round(start, 3), "end": round(end, 3), "set": sc["set"], "cast": cast, "camera": cam, "overlays": ovs,
                       "flash": flash, "fx": fxd, "grade": MOODS.get(sc["mood"]) if sc["mood"] else None, "words": words})
    duration = (timings[-1]["end"] if timings else 1) + .6
    data = {"w": W, "h": H, "fps": cfg["video"]["fps"], "duration": round(duration, 3), "characters": plan["characters"], "scenes": scenes,
            "env": env or [], "subtitles": bool(cfg.get("captions", {}).get("subtitles", True))}
    return data, sorted(events, key=lambda e: e["t"])
