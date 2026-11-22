"""Narration: free AI voice (edge-tts, gTTS backup) or the user's own recording.
Output: one narration WAV + absolute timings per scene and per word."""
import asyncio
import re
import subprocess
import time
from pathlib import Path

from .util import ROOT, ffprobe_duration, log

DEFAULT_VOICES = {"hindi": "hi-IN-MadhurNeural", "english": "en-US-AndrewNeural",
                  "portuguese": "pt-BR-AntonioNeural"}
GTTS_LANG = {"hindi": "hi", "english": "en", "portuguese": "pt"}
SR = 44100
AUDIO_EXT = (".mp3", ".wav", ".m4a", ".aac", ".ogg", ".opus", ".flac")


def to_wav(src, dst):
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(src), "-ac", "1", "-ar", str(SR), str(dst)],
                   check=True)


def silence(dst, seconds):
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", f"anullsrc=r={SR}:cl=mono",
                    "-t", f"{max(0.05, seconds):.3f}", str(dst)], check=True)


def estimate_words(text, start, end):
    words = text.split()
    if not words:
        return []
    weights = [len(w) + 2 for w in words]
    total = sum(weights)
    out, t = [], start
    for w, wt in zip(words, weights):
        d = (end - start) * wt / total
        out.append({"w": w, "start": round(t, 3), "end": round(t + d, 3)})
        t += d
    return out


# ---------------- edge-tts ----------------
async def _edge_one(text, voice, rate, path):
    import edge_tts
    try:
        comm = edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary")
    except TypeError:
        comm = edge_tts.Communicate(text, voice, rate=rate)
    words = []
    with open(path, "wb") as f:
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                s = chunk["offset"] / 1e7
                words.append({"w": chunk["text"], "start": s, "end": s + chunk["duration"] / 1e7})
    return words


def edge_tts_scene(text, voice, rate, path):
    for attempt in range(4):
        try:
            return asyncio.run(_edge_one(text, voice, rate, path))
        except Exception as e:
            log(f"   edge-tts retry ({e.__class__.__name__}: {str(e)[:80]})")
    raise RuntimeError("edge-tts failed")


def gtts_scene(text, lang, path):
    from gtts import gTTS
    gTTS(text=text, lang=lang).save(str(path))
    return []


# ---------------- main entry ----------------
def find_own_voice(stem):
    d = ROOT / "voice"
    for ext in AUDIO_EXT:
        p = d / f"{stem}{ext}"
        if p.exists():
            return p
    return None


def make_voice(scenes, cfg, work, stem, demo=False):
    work = Path(work)
    vdir = work / "voice"
    vdir.mkdir(parents=True, exist_ok=True)
    own = find_own_voice(stem)
    if own and not demo:
        log(f"Teri apni recording mili: {own.name}")
        return own_voice(scenes, own, work, cfg.get("language"))

    lang = cfg.get("language", "hindi")
    vc = cfg.get("voice", {})
    if vc.get("engine", "edge") == "gemini" and not demo:
        try:
            res = gemini_voice(scenes, cfg, work)
            log("   ✓ Gemini natural voice ready (sun ke check ki hui)")
            return res
        except Exception as e:
            log(f"   Gemini voice nahi mili ({str(e)[:120]}) → free edge voice")
    voice = vc.get("edge_voice", "auto")
    if voice == "auto":
        voice = DEFAULT_VOICES.get(lang, "en-US-AndrewNeural")
    rate = vc.get("rate", "+0%")
    gap = float(vc.get("gap_seconds", 0.18))

    parts, timings, t = [], [], 0.0
    use_gtts = False
    for i, sc in enumerate(scenes):
        text = sc["narration"]
        mp3 = vdir / f"s{i:03d}.mp3"
        wav = vdir / f"s{i:03d}.wav"
        words = []
        if demo:
            dur = max(1.6, len(text.split()) / 2.7)
            silence(wav, dur)
        else:
            if not use_gtts:
                try:
                    words = edge_tts_scene(text, voice, rate, mp3)
                except Exception:
                    log("   edge-tts kaam nahi kar raha → backup voice (gTTS)")
                    use_gtts = True
            if use_gtts:
                words = gtts_scene(text, GTTS_LANG.get(lang, "en"), mp3)
            to_wav(mp3, wav)
            dur = ffprobe_duration(wav)
        parts.append(wav)
        start, end = t, t + dur
        if words:
            ws = [{"w": w["w"], "start": round(start + w["start"], 3), "end": round(start + w["end"], 3)}
                  for w in words]
        else:
            ws = estimate_words(text, start + 0.05, end - 0.05)
        timings.append({"start": round(start, 3), "end": round(end + gap, 3), "words": ws})
        if gap > 0:
            g = vdir / f"g{i:03d}.wav"
            silence(g, gap)
            parts.append(g)
        t = end + gap
        log(f"   voice {i + 1}/{len(scenes)} ({dur:.1f}s)")

    lst = vdir / "list.txt"
    lst.write_text("".join(f"file '{p.resolve()}'\n" for p in parts))
    out = work / "narration.wav"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(lst),
                    "-ac", "1", "-ar", str(SR), str(out)], check=True)
    return out, timings


# ---------------- listening (Whisper) + alignment ----------------
_WHISPER = None
WLANG = {"hindi": "hi", "english": "en", "portuguese": "pt"}


def whisper_words(wav, lang=None, offset=0.0):
    """Transcribe with word timestamps. Returns [{"w","start","end"}] (absolute with offset) or None."""
    global _WHISPER
    try:
        from faster_whisper import WhisperModel
    except Exception:
        return None
    if _WHISPER is None:
        _WHISPER = WhisperModel("base", device="cpu", compute_type="int8")
    segs, _ = _WHISPER.transcribe(str(wav), word_timestamps=True, vad_filter=False,
                                  language=WLANG.get(lang) if lang else None, beam_size=1)
    return [{"w": w.word.strip(), "start": w.start + offset, "end": w.end + offset} for sg in segs for w in sg.words]


def _norm_text(t):
    return re.sub(r"[^\w]+", "", t.lower())


def similarity(a, b):
    import difflib
    return difflib.SequenceMatcher(None, _norm_text(a), _norm_text(b)).ratio()


def align_scenes(scenes, heard, total):
    """Map every script word to a time using the heard (Whisper) words; scene times follow."""
    import difflib
    sw, owner = [], []
    for i, sc in enumerate(scenes):
        for w in sc["narration"].split():
            sw.append(w)
            owner.append(i)
    hw = [norm_word(h["w"]) for h in heard]
    times = [None] * len(sw)
    sm = difflib.SequenceMatcher(None, [norm_word(w) for w in sw], hw, autojunk=False)
    for a, b, n in sm.get_matching_blocks():
        for k in range(n):
            times[a + k] = (heard[b + k]["start"], heard[b + k]["end"])
    anchors = [(i, t[0]) for i, t in enumerate(times) if t]
    if not anchors:
        anchors = [(0, 0.0)]
    anchors = [(-1, 0.0)] + anchors + [(len(sw), total)]
    starts = []
    for i in range(len(sw)):
        if times[i]:
            starts.append(times[i][0])
            continue
        lo = max(a for a in anchors if a[0] < i)
        hi = min((a for a in anchors if a[0] > i), key=lambda a: a[0])
        f = (i - lo[0]) / max(1, hi[0] - lo[0])
        starts.append(lo[1] + (hi[1] - lo[1]) * f)
    for i in range(1, len(starts)):  # monotonic
        starts[i] = max(starts[i], starts[i - 1] + 0.02)
    timings = []
    for si in range(len(scenes)):
        idx = [k for k, o in enumerate(owner) if o == si]
        st = 0.0 if si == 0 else (starts[idx[0]] - 0.08 if idx else timings[-1]["start"])
        words = [{"w": sw[k], "start": round(starts[k], 3),
                  "end": round(starts[k + 1] if k + 1 < len(starts) else total, 3)} for k in idx]
        timings.append({"start": round(max(0, st), 3), "end": None, "words": words})
    for i in range(len(timings)):
        timings[i]["end"] = round(timings[i + 1]["start"] if i + 1 < len(timings) else total, 3)
    return timings


def own_voice(scenes, src, work, lang=None, heard=None):
    out = Path(work) / "narration.wav"
    if Path(src).resolve() != out.resolve():
        to_wav(src, out)
    total = ffprobe_duration(out)
    if heard is None:
        try:
            heard = whisper_words(out, lang)
        except Exception as e:
            log(f"   whisper nahi chala ({e})")
            heard = None
    if heard:
        return out, align_scenes(scenes, heard, total)
    counts = [len(s["narration"].split()) for s in scenes]
    t, tot, timings = 0.0, sum(counts), []
    for sc, n in zip(scenes, counts):
        d = total * n / tot
        timings.append({"start": t, "end": t + d, "words": estimate_words(sc["narration"], t, t + d)})
        t += d
    return out, timings


def norm_word(w):
    return re.sub(r"[^\w]", "", w.lower())


# ---------------- Gemini TTS (natural narrator), verified by listening ----------------
TTS_DIRECTIVE = {"hindi": "Read aloud in Hindi, like a warm, gripping storyteller", "english": "Read aloud like a warm, gripping storyteller",
                 "portuguese": "Read aloud in Brazilian Portuguese, like a warm, gripping storyteller"}


def _tts_models(key):
    import requests
    base = "https://generativelanguage.googleapis.com/v1beta/models"
    r = requests.get(base, params={"key": key, "pageSize": 1000}, timeout=30)
    names = [m["name"].split("/", 1)[-1] for m in r.json().get("models", [])] if r.ok else []
    tts = [n for n in names if "tts" in n]
    tts.sort(key=lambda n: (-float((re.search(r"gemini-(\d+(?:\.\d+)?)", n) or [0, 0])[1]), "pro" in n))
    return tts


def _tts_call(model, key, text, cfg, out_wav):
    import base64
    import requests
    lang = cfg.get("language", "hindi")
    body = {"contents": [{"parts": [{"text": f"{TTS_DIRECTIVE.get(lang, TTS_DIRECTIVE['english'])}:\n\n{text}"}]}],
            "generationConfig": {"responseModalities": ["AUDIO"], "temperature": 0.6, "speechConfig": {"voiceConfig": {
                "prebuiltVoiceConfig": {"voiceName": cfg.get("voice", {}).get("gemini_voice", "Charon")}}}}}
    rr = requests.post(f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                       params={"key": key}, json=body, timeout=(20, 300))
    if rr.status_code != 200:
        raise RuntimeError(f"{rr.status_code} {rr.text[:150]}")
    part = rr.json()["candidates"][0]["content"]["parts"][0]["inlineData"]
    rate = int((re.search(r"rate=(\d+)", part.get("mimeType", "")) or [0, 24000])[1])
    raw = Path(out_wav).with_suffix(".pcm")
    raw.write_bytes(base64.b64decode(part["data"]))
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "s16le", "-ar", str(rate), "-ac", "1", "-i", str(raw),
                    "-ar", str(SR), str(out_wav)], check=True)


def _trim_to_script(wav, text, lang):
    """Listen to the clip; cut any extra talk before/after the script. Returns (ok, words)."""
    heard = whisper_words(wav, lang)
    if heard is None:
        return True, None  # cannot verify -> accept
    if not heard:
        return False, None
    import difflib
    sw = [norm_word(w) for w in text.split()]
    hw = [norm_word(h["w"]) for h in heard]
    blocks = [b for b in difflib.SequenceMatcher(None, sw, hw, autojunk=False).get_matching_blocks() if b.size]
    if not blocks:
        return False, None
    first = blocks[0].b
    lastb = blocks[-1]
    last = lastb.b + lastb.size - 1
    t0 = max(0.0, heard[first]["start"] - 0.12) if first > 0 else 0.0
    t1 = heard[last]["end"] + 0.35
    total = ffprobe_duration(wav)
    if first > 0 or t1 < total - 0.6:
        tmp = Path(wav).with_name(Path(wav).stem + "_t.wav")
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(wav), "-ss", f"{t0:.3f}", "-to", f"{min(t1, total):.3f}",
                        str(tmp)], check=True)
        tmp.replace(wav)
        if first > 0:
            log(f"      shuru ki extra baat kaati ({t0:.1f}s)")
    kept = " ".join(h["w"] for h in heard[first:last + 1])
    score = similarity(text, kept)
    return score >= (0.55 if lang == "hindi" else 0.7), score


def tts_segments(scenes, max_words=110):
    segs, cur, n = [], [], 0
    for sc in scenes:
        w = len(sc["narration"].split())
        if cur and n + w > max_words:
            segs.append(cur)
            cur, n = [], 0
        cur.append(sc)
        n += w
    if cur:
        segs.append(cur)
    return segs


def gemini_voice(scenes, cfg, work):
    import os
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not key:
        raise RuntimeError("no GEMINI_API_KEY")
    models = _tts_models(key)
    if not models:
        raise RuntimeError("koi TTS model available nahi")
    lang = cfg.get("language", "hindi")
    vdir = Path(work) / "voice"
    vdir.mkdir(parents=True, exist_ok=True)
    groups = tts_segments(scenes)
    parts, model_i = [], 0
    for gi, grp in enumerate(groups):
        text = " ".join(s["narration"] for s in grp)
        wav = vdir / f"g{gi:03d}.wav"
        ok = False
        for attempt in range(3):
            if model_i >= len(models):
                raise RuntimeError("Gemini TTS limit khatam")
            try:
                _tts_call(models[model_i], key, text, cfg, wav)
            except Exception as e:
                log(f"      {models[model_i]}: {str(e)[:100]}")
                if "429" in str(e) or "404" in str(e) or "400" in str(e):
                    model_i += 1
                time.sleep(3)
                continue
            ok, score = _trim_to_script(wav, text, lang)
            if ok:
                break
            log(f"      part {gi + 1}: voice script se match nahi hua ({score}), dobara…")
        if not ok:
            raise RuntimeError(f"part {gi + 1} sahi nahi bola gaya")
        parts.append(wav)
        log(f"   🎙️ voice part {gi + 1}/{len(groups)} ✓")
        if gi + 1 < len(groups):
            g = vdir / f"gap{gi:03d}.wav"
            silence(g, 0.25)
            parts.append(g)
    lst = vdir / "list.txt"
    lst.write_text("".join(f"file '{p.resolve()}'\n" for p in parts))
    out = Path(work) / "narration.wav"
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(lst), "-ac", "1",
                    "-ar", str(SR), str(out)], check=True)
    return own_voice(scenes, out, work, lang)
