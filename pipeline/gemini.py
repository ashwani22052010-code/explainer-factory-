"""Tiny Gemini REST client with model fallback + free-tier friendly pacing."""
import base64
import re
import time

import requests

from .util import log, parse_json_loose

API = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


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

    def _pace(self):
        wait = self.min_gap - (time.time() - self._last)
        if wait > 0:
            time.sleep(wait)
        self._last = time.time()

    def generate(self, prompt, images=None, json_mode=False, temperature=0.7,
                 max_tokens=16384, vision=False):
        parts = [{"text": prompt}]
        for png in images or []:
            parts.append({"inline_data": {"mime_type": "image/png",
                                          "data": base64.b64encode(png).decode()}})
        cfg = {"temperature": temperature, "maxOutputTokens": max_tokens}
        if json_mode:
            cfg["responseMimeType"] = "application/json"
        body = {"contents": [{"role": "user", "parts": parts}], "generationConfig": cfg}

        models = [m for m in (self.vision_models if vision else self.text_models)
                  if m not in self.dead]
        if not models:
            raise GeminiError("Saare Gemini models fail ho gaye (aaj ki free limit khatam ho sakti hai).")
        last_err = ""
        for model in models:
            for attempt in range(5):
                self._pace()
                try:
                    r = requests.post(API.format(model=model), params={"key": self.key},
                                      json=body, timeout=240)
                except requests.RequestException as e:
                    last_err = str(e)
                    time.sleep(5 * (attempt + 1))
                    continue
                if r.status_code == 200:
                    text = self._text(r.json())
                    if text:
                        self.calls += 1
                        return text
                    last_err = "empty response"
                    continue
                last_err = f"{r.status_code}: {r.text[:300]}"
                low = r.text.lower()
                if r.status_code == 429 and ("limit: 0" in low or "perday" in low or "per day" in low):
                    log(f"   {model}: free limit nahi / khatam → agla model")
                    self.dead.add(model)
                    break
                if r.status_code in (429, 500, 502, 503, 504):
                    m = re.search(r'"retryDelay":\s*"(\d+)', r.text)
                    delay = int(m.group(1)) + 1 if m else min(60, 6 * 2 ** attempt)
                    log(f"   {model}: busy ({r.status_code}), {delay}s ruk ke dobara…")
                    time.sleep(delay)
                    continue
                if r.status_code in (400, 403, 404):
                    if "api key" in low or "api_key" in low or "permission" in low:
                        raise GeminiError("Gemini API key galat hai: " + r.text[:200])
                    log(f"   {model}: use nahi ho saka ({r.status_code}) → agla model")
                    self.dead.add(model)
                    break
                break
        raise GeminiError("Gemini call fail: " + last_err)

    @staticmethod
    def _text(data):
        try:
            parts = data["candidates"][0]["content"]["parts"]
        except (KeyError, IndexError, TypeError):
            return ""
        return "".join(p.get("text", "") for p in parts if not p.get("thought"))

    def generate_json(self, prompt, **kw):
        last = None
        for _ in range(3):
            text = self.generate(prompt, json_mode=True, **kw)
            try:
                return parse_json_loose(text)
            except ValueError as e:
                last = e
                prompt += "\n\nIMPORTANT: Return ONLY valid JSON. No comments, no trailing commas."
        raise GeminiError(str(last))
