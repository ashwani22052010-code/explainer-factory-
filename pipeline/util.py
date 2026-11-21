import json
import os
import re
import subprocess
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def log(*a):
    print("▶", *a, flush=True)


def load_config():
    import yaml
    with open(ROOT / "config.yaml", encoding="utf-8") as f:
        return yaml.safe_load(f)


def slugify(text, maxlen=48):
    t = unicodedata.normalize("NFKD", str(text)).encode("ascii", "ignore").decode()
    t = re.sub(r"[^a-zA-Z0-9]+", "_", t).strip("_").lower()
    return (t or "asset")[:maxlen].strip("_")


def read_json(p, default=None):
    try:
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default


def write_json(p, data):
    Path(p).parent.mkdir(parents=True, exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)


def parse_json_loose(text):
    """Model output -> JSON, tolerating ```json fences and junk around it."""
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text)
    try:
        return json.loads(text)
    except Exception:
        pass
    for open_c, close_c in (("{", "}"), ("[", "]")):
        s, e = text.find(open_c), text.rfind(close_c)
        if s != -1 and e > s:
            try:
                return json.loads(text[s:e + 1])
            except Exception:
                continue
    raise ValueError("Could not parse JSON from model output:\n" + text[:500])


def ffprobe_duration(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=nw=1:nk=1", str(path)],
        capture_output=True, text=True).stdout.strip()
    try:
        return float(out)
    except ValueError:
        return 0.0


def split_into_chunks(script, max_words=16):
    """Script ko chhote, bolne layak tukdon mein todo (sentence, phir comma)."""
    text = re.sub(r"\s+", " ", script).strip()
    sentences = re.split(r"(?<=[.!?।…])\s+", text)
    chunks = []
    for s in sentences:
        s = s.strip()
        if not s:
            continue
        if len(s.split()) <= max_words:
            chunks.append(s)
            continue
        parts = re.split(r"(?<=[,;:—–])\s+", s)
        buf = ""
        for p in parts:
            if buf and len((buf + " " + p).split()) > max_words:
                chunks.append(buf.strip())
                buf = p
            else:
                buf = (buf + " " + p).strip()
        if buf:
            # very long comma-free piece: hard split by words
            words = buf.split()
            while len(words) > max_words + 6:
                chunks.append(" ".join(words[:max_words]))
                words = words[max_words:]
            chunks.append(" ".join(words))
    return chunks


def env_key():
    return os.environ.get("GEMINI_API_KEY", "").strip()
