"""AI artist: writes SVG drawings, looks at them, fixes them, and grows the library."""
import html
import time
from concurrent.futures import ThreadPoolExecutor

from .svgsafe import sanitize
from .util import ROOT, log, read_json, write_json, slugify

LIB = ROOT / "assets" / "library"
INDEX = LIB / "index.json"

DRAW_PROMPT = """You are a senior vector illustrator for a hit animated YouTube channel.
Draw: "{describe}"

HOUSE STYLE (every drawing in the channel must match):
- Polished flat-2D cartoon illustration with depth: every surface has a base colour, a darker shade side,
  a soft highlight, and small details (texture strokes, seams, bolts, wood grain, folds, reflections, rim light).
- Palette (plus natural skin/wood/metal tones): {palette}
- Dark warm outline {outline}, stroke-width 4-7, round joins/caps. Bold readable silhouette, pleasing proportions.
- NO background, NO ground, NO frame: only the subject, transparent, centred, filling ~90% of the viewBox.
- Avoid drawing people unless the subject is a body part / diagram (people are drawn by another system).
- No text unless the subject itself needs a short label.

RIGGING (important — the animation engine moves these): wrap moving parts in groups with a data-part attribute:
  <g data-part="wheel">, "flame", "smoke", "tail", "wing_left", "wing_right", "water", "leaf", "light",
  "eye", "mouth", "head", "arm_left", "arm_right", "leg_left", "leg_right" (for animals/creatures).
  Only rig parts that really exist. Optional subtle SMIL loops (<animate>, repeatCount="indefinite").

TECHNICAL:
- Single <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 W H"> (~1000 on the long side).
- Allowed: g, path, rect, circle, ellipse, line, polyline, polygon, defs, linearGradient, radialGradient, stop,
  clipPath, mask, use, animate, animateTransform. NO <style>, <script>, <image>, <filter>, <foreignObject>, CSS classes.
- Attributes for colour (fill="#...", stroke=...). Short gradient ids. 40-160 shapes of real detail.
{feedback}
Return ONLY the SVG code."""

SET_PROMPT = """You are a background painter for a hit animated YouTube channel (flat-2D cartoon with depth).
Paint a FULL BACKGROUND SET: "{describe}"

- Edge-to-edge scene filling the whole canvas, {orientation} composition, viewBox="0 0 {w} {h}".
- NO people or characters (they are added on top later). Leave open floor/ground space in the lower-middle
  area where characters will stand.
- Depth: far layer (sky/walls, softer & lighter), mid layer (buildings/furniture), near layer details at the edges.
  Atmospheric perspective, soft light direction, warm/cool contrast, small storytelling props.
- Palette: {palette}; dark warm outline {outline} (thinner, 2-4) on mid/near objects.
- Rig a few living things with <g data-part="water|smoke|flame|leaf|light|wheel"> where they exist; optional subtle SMIL loops.
- Allowed: g, path, rect, circle, ellipse, line, polyline, polygon, defs, linearGradient, radialGradient, stop, clipPath,
  use, animate, animateTransform. NO <style>, <script>, <image>, <filter>, <text>. 60-200 shapes.
{feedback}
Return ONLY the SVG code."""

CHECK_PROMPT = """This image should show: "{describe}"{kind}.
It is for a polished illustrated YouTube explainer (warm storybook diorama style).
Judge it strictly. Return JSON:
{{"score": 1-10 (7+ = clearly recognisable and nice looking; 4 or less = wrong/ugly/broken),
 "problems": "short list of the biggest visual problems to fix (empty if none)"}}"""


class Artist:
    def __init__(self, gem, cfg, browser, mode="short"):
        self.mode = mode
        self.gem = gem
        self.cfg = cfg
        self.browser = browser
        self.index = read_json(INDEX, {}) or {}
        self.new_count = 0
        pal = cfg["style"]["palette"]
        self.palette = ", ".join(f"{k} {v}" for k, v in pal.items() if k != "outline")
        self.outline = pal.get("outline", "#3A2418")
        self.page = None

    # ---------- library ----------
    def names(self):
        return list(self.index.keys())

    def has(self, name):
        return name in self.index and (LIB / self.index[name]["file"]).exists()

    def load(self, name):
        meta = self.index[name]
        return (LIB / meta["file"]).read_text(encoding="utf-8"), meta.get("aspect", 1.0)

    def _save(self, name, describe, svg, aspect, score):
        LIB.mkdir(parents=True, exist_ok=True)
        fn = f"{name}.svg"
        (LIB / fn).write_text(svg, encoding="utf-8")
        self.index[name] = {"file": fn, "describe": describe, "aspect": round(aspect, 4),
                            "score": score, "added": time.strftime("%Y-%m-%d")}
        write_json(INDEX, self.index)

    # ---------- rendering for self-check ----------
    def snapshot(self, svg):
        if self.page is None:
            self.page = self.browser.new_page(viewport={"width": 640, "height": 640})
        sized = svg.replace("<svg", '<svg width="600" height="600"', 1)
        doc = ("<html><body style='margin:0;background:#d9d2c4;display:flex;align-items:center;"
               "justify-content:center;width:640px;height:640px'>"
               "<div style='width:600px;height:600px'>" + sized + "</div></body></html>")
        self.page.set_content(doc)
        self.page.wait_for_timeout(120)
        return self.page.screenshot(type="png")

    # ---------- drawing ----------
    def get(self, name, describe):
        """Return (svg, aspect). Draws + saves if not in library."""
        if self.has(name):
            return self.load(name)
        limit = self.cfg["gemini"].get("max_new_drawings_per_video", 45)
        if self.new_count >= limit:
            log(f"   '{name}': is video ki drawing limit poori → placeholder")
            return placeholder(name, describe), 1.0
        self.new_count += 1
        return self.draw(name, describe)

    def draw(self, name, describe):
        g = self.cfg["gemini"]
        attempts = int(g.get("max_draw_attempts", 3))
        min_score = float(g.get("min_score", 6))
        best = None  # (score, svg, aspect)
        feedback = ""
        for n in range(1, attempts + 1):
            log(f"   🎨 drawing '{name}' (try {n}/{attempts})")
            try:
                text = self.gem.generate(
                    DRAW_PROMPT.format(describe=describe, palette=self.palette,
                                       outline=self.outline, feedback=feedback),
                    temperature=0.9 if n > 1 else 0.7, max_tokens=24000)
                svg, aspect = sanitize(text, slugify(name, 20))
            except Exception as e:
                log(f"      invalid drawing: {str(e)[:120]}")
                feedback = "\nPrevious attempt was invalid/empty SVG. Make a complete, valid drawing.\n"
                continue
            score, problems = 7.0, ""
            if g.get("self_check", True):
                try:
                    png = self.snapshot(svg)
                    res = self.gem.generate_json(CHECK_PROMPT.format(describe=describe, kind=""),
                                                 images=[png], vision=True, temperature=0.2,
                                                 max_tokens=2048)
                    score = float(res.get("score", 5))
                    problems = str(res.get("problems", ""))[:400]
                except Exception as e:
                    log(f"      check skipped: {str(e)[:100]}")
                    score = 6.0
            log(f"      score {score:g}/10 {('— ' + problems) if problems else ''}")
            if best is None or score > best[0]:
                best = (score, svg, aspect)
            if score >= min_score:
                break
            feedback = ("\nA reviewer rejected the previous version. Problems: " + problems +
                        "\nRedraw from scratch fixing these. Make the subject unmistakable.\n")
        if best is None:
            return placeholder(name, describe), 1.0
        score, svg, aspect = best
        if score >= min_score:
            self._save(name, describe, svg, aspect, score)  # good ones join the library forever
        return svg, aspect


    # ---------- parallel drawing (fast path used by main) ----------
    def _prompt(self, name, desc, feedback):
        if name.startswith("set_"):
            w, h = (1600, 900) if self.mode == "story" else (900, 1600)
            return SET_PROMPT.format(describe=desc, palette=self.palette, outline=self.outline, feedback=feedback,
                                     w=w, h=h, orientation="wide landscape 16:9" if self.mode == "story" else "tall portrait 9:16")
        return DRAW_PROMPT.format(describe=desc, palette=self.palette, outline=self.outline, feedback=feedback)

    def _gen(self, name, st, attempt):
        try:
            text = self.gem.generate(self._prompt(name, st["desc"], st["feedback"]),
                                     temperature=0.9 if attempt > 1 else 0.7, max_tokens=24000)
            return sanitize(text, slugify(name, 20))
        except Exception as e:
            log(f"      '{name}': invalid drawing ({str(e)[:100]})")
            return None

    def _check(self, desc, png, name=""):
        if png is None:
            return 7.0, ""
        try:
            kind = " (a full background scene, no people)" if name.startswith("set_") else ""
            res = self.gem.generate_json(CHECK_PROMPT.format(describe=desc, kind=kind), images=[png], vision=True,
                                         temperature=0.2, max_tokens=2048)
            return float(res.get("score", 5)), str(res.get("problems", ""))[:400]
        except Exception as e:
            log(f"      check skipped: {str(e)[:100]}")
            return 6.0, ""

    def draw_many(self, items):
        """items: {name: describe}. Draws all missing ones in parallel rounds. Returns {name: (svg, aspect)}."""
        g = self.cfg["gemini"]
        limit = g.get("max_new_drawings_per_video", 45)
        attempts = int(g.get("max_draw_attempts", 3))
        min_score = float(g.get("min_score", 6))
        par = max(1, int(g.get("parallel_drawings", 4)))
        check = g.get("self_check", True)
        try:
            check = check and self.gem.has_vision()
        except Exception:
            check = False
        if not check:
            log("   (drawing self-check off: koi vision model nahi)")
        results, state = {}, {}
        for name, desc in items.items():
            if self.has(name):
                results[name] = self.load(name)
            elif self.new_count >= limit:
                results[name] = (placeholder(name, desc), 1.0)
            else:
                self.new_count += 1
                state[name] = {"desc": desc, "best": None, "feedback": ""}
        pending = list(state)
        for attempt in range(1, attempts + 1):
            if not pending:
                break
            log(f"   🎨 round {attempt}: {len(pending)} drawings ek saath ban rahi hain…")
            with ThreadPoolExecutor(par) as ex:
                gen = dict(zip(pending, ex.map(lambda n: self._gen(n, state[n], attempt), pending)))
            pngs = {n: (self.snapshot(r[0]) if check else None) for n, r in gen.items() if r}
            names = list(pngs)
            with ThreadPoolExecutor(par) as ex:
                checks = dict(zip(names, ex.map(lambda n: self._check(state[n]["desc"], pngs[n], n), names)))
            nxt = []
            for n in pending:
                st, r = state[n], gen.get(n)
                if not r:
                    st["feedback"] = "\nPrevious attempt was invalid/empty SVG. Make a complete, valid drawing.\n"
                    nxt.append(n)
                    continue
                score, problems = checks.get(n, (7.0, ""))
                log(f"      {n}: {score:g}/10 {('— ' + problems) if problems and score < min_score else ''}")
                if st["best"] is None or score > st["best"][0]:
                    st["best"] = (score, r[0], r[1])
                if score < min_score:
                    st["feedback"] = ("\nA reviewer rejected the previous version. Problems: " + problems +
                                      "\nRedraw from scratch fixing these. Make the subject unmistakable.\n")
                    nxt.append(n)
            pending = nxt
        for n, st in state.items():
            if st["best"] is None:
                results[n] = (placeholder(n, st["desc"]), 1.0)
                continue
            score, svg, aspect = st["best"]
            if score >= min_score:
                self._save(n, st["desc"], svg, aspect, score)
            results[n] = (svg, aspect)
        return results


def placeholder(name, describe):
    label = html.escape(name.replace("_", " ").upper()[:22])
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500">'
            f'<rect x="20" y="20" width="760" height="460" rx="60" fill="#F1E3C2" stroke="#3A2418" stroke-width="10"/>'
            f'<circle cx="400" cy="200" r="80" fill="#E2A93B" stroke="#3A2418" stroke-width="8"/>'
            f'<rect x="150" y="330" width="500" height="20" rx="10" fill="#3A2418" opacity=".25"/>'
            f'<text x="400" y="420" font-size="56" text-anchor="middle" fill="#3A2418" '
            f'font-family="sans-serif" font-weight="bold">{label}</text></svg>')
