"""Multi-provider AI router.

Jis bhi free service ki key repo Secrets mein ho, wo use hogi:
  GROQ_API_KEY       (sabse tez, recommended)
  CEREBRAS_API_KEY   (bahut tez, badi limits)
  OPENROUTER_API_KEY (free models)
  GEMINI_API_KEY     (backup + drawing self-check + natural voice)
Ek service atke/limit ho to agli service pe chala jata hai. Jo chal gayi, usi pe tikta hai.
"""
import base64
import os
import re
import threading
import time

import requests

from .gemini import Gemini, GeminiError
from .util import log, parse_json_loose


class AIError(RuntimeError):
    pass


class AuthError(AIError):
    pass


PROVIDERS = {
    "groq": {"base": "https://api.groq.com/openai/v1", "env": "GROQ_API_KEY", "max_out": 7000, "gap": 2.1,
             "prefer": ["gpt-oss-120b", "kimi-k2", "qwen3", "llama-3.3-70b", "gpt-oss-20b", "llama-4-maverick",
                        "llama-4-scout"]},
    "cerebras": {"base": "https://api.cerebras.ai/v1", "env": "CEREBRAS_API_KEY", "max_out": 8000, "gap": 2.1,
                 "prefer": ["gpt-oss-120b", "qwen-3-235b", "qwen-3", "zai-glm", "llama-3.3-70b", "llama"]},
    "openrouter": {"base": "https://openrouter.ai/api/v1", "env": "OPENROUTER_API_KEY", "max_out": 12000,
                   "gap": 3.5, "prefer": [":free"]},
    # ---- bina key, bina signup (koi account nahi chahiye) ----
    "llm7": {"base": "https://api.llm7.io/v1", "env": None, "keyless": "unused", "max_out": 8000, "gap": 2.5,
             "prefer": ["gpt-oss", "deepseek", "qwen", "gpt", "llama", "mistral", "gemini"]},
    "pollinations": {"base": "https://text.pollinations.ai", "env": None, "keyless": "", "max_out": 8000, "gap": 16,
                     "chat_path": "/openai", "static_models": ["openai", "openai-large", "mistral"],
                     "prefer": ["openai", "mistral"]},
}
SKIP = ("whisper", "tts", "guard", "embed", "orpheus", "playai", "distil", "prompt", "compound", "safeguard")
VISION_HINT = ("llama-4", "vision", "-vl", "vl-", "gemma-3", "pixtral")


class OpenAICompat:
    def __init__(self, name, key):
        spec = PROVIDERS[name]
        self.name, self.key, self.spec = name, key, spec
        self.base, self.max_out, self.gap = spec["base"], spec["max_out"], spec["gap"]
        self._ids = None
        self.dead, self.cool = set(), {}
        self.best = {}
        self._last, self._lock = 0.0, threading.Lock()
        self.calls = 0

    def _h(self):
        h = {"Content-Type": "application/json"}
        if self.key:
            h["Authorization"] = f"Bearer {self.key}"
        return h

    def _discover(self):
        if self._ids is None and self.spec.get("static_models"):
            self._ids = list(self.spec["static_models"])
        if self._ids is None:
            try:
                r = requests.get(f"{self.base}/models", headers=self._h(), timeout=30)
                if r.status_code in (401, 403):
                    raise AuthError(f"{self.name}: API key galat hai")
                data = r.json().get("data", []) if r.ok else []
                ids = [m["id"] for m in data if not any(s in m["id"].lower() for s in SKIP)]
                if self.name == "openrouter":
                    ids = [i for i in ids if i.endswith(":free")]
            except requests.RequestException:
                ids = []
            self._ids = ids
            log(f"   {self.name} models: {', '.join(self.ranked(False)[:6]) or '(none)'}")
        return self._ids

    def ranked(self, vision):
        ids = self._ids or []
        pref = self.spec["prefer"]

        def score(i):
            low = i.lower()
            for k, p in enumerate(pref):
                if p in low:
                    return k
            return len(pref)
        if vision:
            ids = [i for i in ids if any(v in i.lower() for v in VISION_HINT)]
        return sorted(ids, key=score)

    def has_vision(self):
        self._discover()
        return bool(self.ranked(True))

    def _models(self, vision):
        self._discover()
        kind = "vision" if vision else "text"
        order = self.ranked(vision)
        if self.best.get(kind) in order:
            order.remove(self.best[kind])
            order.insert(0, self.best[kind])
        now = time.time()
        live = [m for m in order if m not in self.dead]
        return sorted(live, key=lambda m: self.cool.get(m, 0) > now)  # cooled ones last (stable)

    def _pace(self):
        with self._lock:
            w = self.gap - (time.time() - self._last)
            if w > 0:
                time.sleep(w)
            self._last = time.time()

    def generate(self, prompt, images=None, json_mode=False, temperature=0.7, max_tokens=16384, vision=False):
        content = prompt
        if images:
            content = [{"type": "text", "text": prompt}] + [
                {"type": "image_url", "image_url": {"url": "data:image/png;base64," + base64.b64encode(p).decode()}}
                for p in images]
        models = self._models(vision)
        if not models:
            raise AIError(f"{self.name}: koi model nahi")
        kind = "vision" if vision else "text"
        last = ""
        for model in models[:5]:
            wait = self.cool.get(model, 0) - time.time()
            if wait > 0:
                if wait > 25:
                    continue
                time.sleep(wait)
            mt = min(max_tokens, self.max_out)
            use_json = json_mode
            for attempt in range(3):
                body = {"model": model, "messages": [{"role": "user", "content": content}],
                        "temperature": temperature, "max_tokens": mt}
                if use_json:
                    body["response_format"] = {"type": "json_object"}
                if "gpt-oss" in model:
                    body["reasoning_effort"] = "low"
                self._pace()
                t0 = time.time()
                try:
                    r = requests.post(self.base + self.spec.get("chat_path", "/chat/completions"),
                                      headers=self._h(), json=body, timeout=(15, 150))
                except requests.RequestException as e:
                    last = f"{model}: {e.__class__.__name__}"
                    log(f"   {self.name}/{model}: jawab nahi aaya → agla model")
                    self.cool[model] = time.time() + 120
                    break
                low = r.text.lower()
                if r.status_code in (401, 402, 403) and self.name == "pollinations" and not images:
                    try:
                        from urllib.parse import quote
                        g = requests.get(f"{self.base}/{quote(prompt[:6000])}",
                                         params={"model": "openai", "json": "true" if json_mode else "false"},
                                         timeout=(15, 150))
                        if g.ok and g.text.strip():
                            self.calls += 1
                            log(f"   ✓ pollinations (GET, {time.time() - t0:.0f}s)")
                            return g.text.strip()
                    except requests.RequestException:
                        pass
                if r.status_code == 200:
                    try:
                        text = r.json()["choices"][0]["message"].get("content") or ""
                    except (KeyError, IndexError, ValueError):
                        text = ""
                    text = re.sub(r"<think>[\s\S]*?</think>", "", text).strip()
                    if text:
                        self.calls += 1
                        self.best[kind] = model
                        log(f"   ✓ {self.name}/{model} ({time.time() - t0:.0f}s)")
                        return text
                    last = f"{model}: empty"
                    continue
                last = f"{model}: {r.status_code} {r.text[:160]}"
                if r.status_code in (401, 403) and "model" not in low:
                    raise AuthError(f"{self.name}: key galat/blocked")
                if r.status_code == 429:
                    ra = r.headers.get("retry-after")
                    try:
                        ra = float(ra)
                    except (TypeError, ValueError):
                        ra = 30.0
                    self.cool[model] = time.time() + ra
                    log(f"   {self.name}/{model}: limit ({ra:.0f}s) → agla model")
                    break
                if r.status_code == 413 or "too large" in low or "context" in low or "max_tokens" in low:
                    if mt // 2 >= 2500:
                        mt = mt // 2
                        continue
                    break
                if use_json and r.status_code == 400 and ("json" in low or "response_format" in low):
                    use_json = False
                    continue
                if r.status_code in (500, 502, 503, 504):
                    time.sleep(4 * (attempt + 1))
                    continue
                log(f"   {self.name}/{model}: {r.status_code} → agla model")
                self.dead.add(model)
                break
        raise AIError(f"{self.name} fail: {last}")


class Router:
    """Same interface as Gemini: generate(), generate_json(), calls, has_vision()."""

    def __init__(self, cfg):
        order = (cfg.get("ai") or {}).get("order") or ["groq", "cerebras", "openrouter", "gemini", "llm7", "pollinations"]
        g = cfg.get("gemini", {})
        self.providers = []
        for name in order:
            if name == "gemini":
                key = os.environ.get("GEMINI_API_KEY", "").strip()
                if key:
                    p = Gemini(key, g.get("text_models", []), g.get("vision_models", []),
                               g.get("min_seconds_between_calls", 4.5))
                    p.name = "gemini"
                    p.has_vision = lambda: True
                    self.providers.append(p)
            elif name in PROVIDERS:
                spec = PROVIDERS[name]
                key = os.environ.get(spec["env"], "").strip() if spec.get("env") else spec.get("keyless", "")
                if key or spec.get("env") is None:
                    self.providers.append(OpenAICompat(name, key))
        if not self.providers:
            raise AIError("Koi AI key nahi mili. README dekho: GROQ_API_KEY (ya GEMINI_API_KEY) secret add karo.")
        log("AI services: " + ", ".join(p.name for p in self.providers))
        self.best = {}
        self._vision = None

    @property
    def calls(self):
        return sum(p.calls for p in self.providers)

    def has_vision(self):
        if self._vision is None:
            self._vision = False
            for p in self.providers:
                try:
                    if p.has_vision():
                        self._vision = True
                        break
                except Exception:
                    continue
        return self._vision

    def generate(self, prompt, vision=False, **kw):
        kind = "vision" if vision else "text"
        order = list(self.providers)
        if self.best.get(kind) in order:
            order.remove(self.best[kind])
            order.insert(0, self.best[kind])
        errs = []
        for p in order:
            if vision:
                try:
                    if not p.has_vision():
                        continue
                except Exception:
                    continue
            try:
                out = p.generate(prompt, vision=vision, **kw)
                self.best[kind] = p
                return out
            except AuthError as e:
                log(f"   {e} → ye service hata di")
                self.providers.remove(p)
                errs.append(str(e))
            except (AIError, GeminiError) as e:
                log(f"   {p.name} abhi nahi chali → agli service")
                errs.append(str(e)[:150])
        raise AIError("Saari AI services fail: " + " | ".join(errs))

    def generate_json(self, prompt, **kw):
        last = None
        for _ in range(3):
            text = self.generate(prompt, json_mode=True, **kw)
            try:
                return parse_json_loose(text)
            except ValueError as e:
                last = e
                prompt += "\n\nIMPORTANT: Return ONLY valid JSON. No comments, no trailing commas."
        raise AIError(str(last))
