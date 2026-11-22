"""Tiny Gemini REST client with model fallback + free-tier friendly pacing."""
import base64
import re
import threading
import time

import requests

from .util import log, parse_json_loose

API = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
LIST_API = "https://generativelanguage.googleapis.com/v1beta/models"


class GeminiError(RuntimeError):
    pass


class Gemini:
    def __init__(self, key, text_models, vision_models, min_gap=4.5):
        if not key:
            raise GeminiError(
                "GEMINI_API_KEY nahi mili. GitHub repo → Settings → Secrets and variables → "
                "Actions → New repository secret → naam GEMINI_API_KEY, value = AI Studio wali key.")
        self.key = key
        self.text_models = list(text_models)
        self.vision_models = list(vision_models)
        self.dead = set()
        self.min_gap = min_gap
        self._last = 0.0
        self.calls = 0
        self._discovered = None
        self.no_thinking = set()
        self.slow = set()
        self.best = {}
        self._lock = threading.Lock()

    def _pace(self):
        with self._lock:
            wait = self.min_gap - (time.time() - self._last)
            if wait > 0:
                time.sleep(wait)
            self._last = time.time()

    # ---------- model discovery (Google naye models laata/hatata rehta hai) ----------
    def _discover(self):
        if self._discovered is not None:
            return self._discovered
        names = []
        try:
            r = requests.get(LIST_API, params={"key": self.key, "pageSize": 1000}, timeout=30)
            if r.status_code == 200:
                for m in r.json().get("models", []):
                    if "generateContent" in m.get("supportedGenerationMethods", []):
                        names.append(m["name"].split("/", 1)[-1])
            elif r.status_code in (400, 403):
                raise GeminiError("Gemini API key galat hai ya kaam nahi kar rahi: " + r.text[:200])
        except requests.RequestException as e:
            log(f"   model list nahi mili ({e})")
        bad = ("image", "tts", "audio", "live", "embedding", "vision", "learnlm", "gemma", "robotics",
               "computer-use", "native", "exp", "thinking", "aqa")
        good = [n for n in names if n.startswith("gemini") and "flash" in n and not any(b in n for b in bad)]

        def ver(n):
            m = re.search(r"gemini-(\d+(?:\.\d+)?)", n)
            return float(m.group(1)) if m else 0

        good.sort(key=lambda n: (-ver(n), "preview" in n, len(n)))
        self._discovered = good
        log(f"   Available Gemini models: {', '.join(good[:8]) or '(list nahi mili)'}")
        return good

    def _models(self, vision):
        """Order: model that already WORKED this run → newest available → config list → slow ones last."""
        found = self._discover()
        kind = "vision" if vision else "text"
        if found:
            lite = [m for m in found if "lite" in m]
            full = [m for m in found if "lite" not in m]
            ordered = (lite + full) if vision else (full + lite)
        else:
            ordered = list(self.vision_models if vision else self.text_models)
        if self.best.get(kind):
            ordered.insert(0, self.best[kind])
        seen, fast, slow = set(), [], []
        for m in ordered:
            if m in seen or m in self.dead:
                continue
            seen.add(m)
            (slow if m in self.slow else fast).append(m)
        return fast + slow

    @staticmethod
    def _thinking(model):
        if "gemini-3" in model:
            return {"thinkingLevel": "low"}
        if "gemini-2.5" in model:
            return {"thinkingBudget": 0 if "lite" in model else 1024}
        return None

    def generate(self, prompt, images=None, json_mode=False, temperature=0.7,
                 max_tokens=16384, vision=False, task=None):
        parts = [{"text": prompt}]
        for png in images or []:
            parts.append({"inline_data": {"mime_type": "image/png",
                                          "data": base64.b64encode(png).decode()}})
        kind = "vision" if vision else "text"
        models = self._models(vision)
        if not models:
            raise GeminiError("Saare Gemini models fail ho gaye (aaj ki free limit khatam ho sakti hai).")
        last_err = ""
        for model in models:
            use_thinking = model not in self.no_thinking
            for attempt in range(3):
                cfg = {"temperature": temperature, "maxOutputTokens": max_tokens}
                if json_mode:
                    cfg["responseMimeType"] = "application/json"
                th = self._thinking(model) if use_thinking else None
                if th:
                    cfg["thinkingConfig"] = th
                body = {"contents": [{"role": "user", "parts": parts}], "generationConfig": cfg}
                self._pace()
                t0 = time.time()
                log(f"   → {model} (try {attempt + 1})")
                try:
                    r = requests.post(API.format(model=model), params={"key": self.key},
                                      json=body, timeout=(20, 180))
                except requests.RequestException as e:
                    last_err = f"{e.__class__.__name__} after {time.time() - t0:.0f}s"
                    log(f"   {model}: jawab nahi aaya ({last_err}) → agla model")
                    self.slow.add(model)
                    if self.best.get(kind) == model:
                        self.best.pop(kind, None)
                    break
                if r.status_code == 200:
                    data = r.json()
                    text = self._text(data)
                    if text:
                        self.calls += 1
                        self.best[kind] = model
                        self.slow.discard(model)
                        log(f"   ✓ {model} ({time.time() - t0:.0f}s)")
                        return text
                    try:
                        cand = (data.get("candidates") or [{}])[0]
                        why = cand.get("finishReason") or (data.get("promptFeedback") or {}).get("blockReason") or "?"
                    except Exception:
                        why = "?"
                    last_err = f"empty response ({why})"
                    if use_thinking and th:
                        log(f"   {model}: khali jawab ({why}) → bina thinking dobara")
                        self.no_thinking.add(model)
                        use_thinking = False
                        max_tokens = max(max_tokens, 32768)
                        continue
                    log(f"   {model}: khali jawab ({why}) → agla model")
                    self.slow.add(model)
                    break
                last_err = f"{r.status_code}: {r.text[:300]}"
                low = r.text.lower()
                if r.status_code == 400 and "thinking" in low and use_thinking:
                    self.no_thinking.add(model)
                    use_thinking = False
                    continue
                if r.status_code == 429 and ("limit: 0" in low or "perday" in low or "per day" in low):
                    log(f"   {model}: free limit nahi / khatam → agla model")
                    self.dead.add(model)
                    break
                if r.status_code in (429, 500, 502, 503, 504):
                    m = re.search(r'"retryDelay":\s*"(\d+)', r.text)
                    delay = int(m.group(1)) + 1 if m else 8 * (attempt + 1)
                    log(f"   {model}: busy ({r.status_code}), {delay}s ruk ke dobara…")
                    time.sleep(min(delay, 65))
                    continue
                if r.status_code in (400, 403, 404):
                    if "api key" in low or "api_key" in low:
                        raise GeminiError("Gemini API key galat hai: " + r.text[:200])
                    log(f"   {model}: use nahi ho saka ({r.status_code}) → agla model")
                    self.dead.add(model)
                    break
                log(f"   {model}: error {last_err[:120]}")
                break
        raise GeminiError("Gemini call fail: " + last_err)

    @staticmethod
    def _text(data):
        try:
            parts = data["candidates"][0]["content"]["parts"]
        except (KeyError, IndexError, TypeError):
            return ""
        return "".join(p.get("text", "") for p in parts if not p.get("thought"))

    def generate_json(self, prompt, task=None, **kw):
        last = None
        for _ in range(3):
            text = self.generate(prompt, json_mode=True, **kw)
            try:
                return parse_json_loose(text)
            except ValueError as e:
                last = e
                prompt += "\n\nIMPORTANT: Return ONLY valid JSON. No comments, no trailing commas."
        raise GeminiError(str(last))
