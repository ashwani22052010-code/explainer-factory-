"""Narration: free AI voice (edge-tts, gTTS backup) or the user's own recording.
Output: one narration WAV + absolute timings per scene and per word."""
import asyncio
import re
import subprocess
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
        return own_voice(scenes, own, work)

    lang = cfg.get("language", "hindi")
    vc = cfg.get("voice", {})
    if vc.get("engine", "edge") == "gemini" and not demo:
        try:
            src = gemini_tts(" ".join(s["narration"] for s in scenes), cfg, vdir / "gemini_voice.wav")
            log("   ✓ Gemini natural voice ready, ab timing set ho rahi hai…")
            return own_voice(scenes, src, work)
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


def own_voice(scenes, src, work):
    """Align the user's recording to scenes using faster-whisper word timestamps."""
    out = Path(work) / "narration.wav"
    to_wav(src, out)
    total = ffprobe_duration(out)
    script_counts = [len(s["narration"].split()) for s in scenes]
    try:
        from faster_whisper import WhisperModel
        model = WhisperModel("base", device="cpu", compute_type="int8")
        segs, _ = model.transcribe(str(out), word_timestamps=True, vad_filter=True)
        heard = [{"w": w.word.strip(), "start": w.start, "end": w.end} for s in segs for w in s.words]
    except Exception as e:
        log(f"   whisper nahi chala ({e}); timing andaaze se")
        heard = []
    timings = []
    if heard:
        ratio = len(heard) / max(1, sum(script_counts))
        idx = 0
        for i, (sc, n) in enumerate(zip(scenes, script_counts)):
            k = max(1, round(n * ratio))
            chunk = heard[idx: idx + k] if i < len(scenes) - 1 else heard[idx:]
            idx += k
            if not chunk:
                chunk = heard[-1:]
            timings.append({"start": chunk[0]["start"], "end": chunk[-1]["end"],
                            "words": estimate_words(sc["narration"], chunk[0]["start"], chunk[-1]["end"])})
        # make scenes contiguous
        for i in range(len(timings)):
            timings[i]["start"] = 0.0 if i == 0 else timings[i - 1]["end"]
            if i + 1 < len(timings):
                timings[i]["end"] = (timings[i]["end"] + timings[i + 1]["start"]) / 2
            else:
                timings[i]["end"] = total
    else:
        t = 0.0
        tot = sum(script_counts)
        for sc, n in zip(scenes, script_counts):
            d = total * n / tot
            timings.append({"start": t, "end": t + d, "words": estimate_words(sc["narration"], t, t + d)})
            t += d
    return out, timings


def norm_word(w):
    return re.sub(r"[^\w]", "", w.lower())


# ---------------- Gemini TTS (natural, human-like narrator) ----------------
TTS_STYLE = ("You are a top YouTube documentary narrator. Read the script below in natural, spoken {lang}, "
             "like a real person telling a gripping true story to a friend: warm, confident, slightly dramatic, "
             "with short natural pauses after shocking lines and questions, varied pace and emphasis. "
             "Never sound robotic or like an announcer. Read EXACTLY these words, nothing else:\n\n{text}")


def gemini_tts(text, cfg, out_wav):
    import base64
    import os
    import requests
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not key:
        raise RuntimeError("no key")
    base = "https://generativelanguage.googleapis.com/v1beta/models"
    r = requests.get(base, params={"key": key, "pageSize": 1000}, timeout=30)
    names = [m["name"].split("/", 1)[-1] for m in r.json().get("models", [])] if r.ok else []
    tts = [n for n in names if "tts" in n]
    tts.sort(key=lambda n: (-float((re.search(r"gemini-(\d+(?:\.\d+)?)", n) or [0, 0])[1]), "pro" in n))
    if not tts:
        raise RuntimeError("koi TTS model available nahi")
    vc = cfg.get("voice", {})
    lang = cfg.get("language", "hindi")
    body = {"contents": [{"parts": [{"text": TTS_STYLE.format(lang=lang, text=text)}]}],
            "generationConfig": {"responseModalities": ["AUDIO"], "speechConfig": {"voiceConfig": {
                "prebuiltVoiceConfig": {"voiceName": vc.get("gemini_voice", "Charon")}}}}}
    last = ""
    for model in tts[:4]:
        log(f"   🎙️ Gemini voice: {model}")
        try:
            rr = requests.post(f"{base}/{model}:generateContent", params={"key": key}, json=body, timeout=(20, 300))
        except requests.RequestException as e:
            last = str(e)
            continue
        if rr.status_code != 200:
            last = f"{rr.status_code} {rr.text[:150]}"
            log(f"      {model}: {last[:120]}")
            continue
        try:
            part = rr.json()["candidates"][0]["content"]["parts"][0]["inlineData"]
        except (KeyError, IndexError):
            last = "no audio in response"
            continue
        pcm = base64.b64decode(part["data"])
        rate = 24000
        m = re.search(r"rate=(\d+)", part.get("mimeType", ""))
        if m:
            rate = int(m.group(1))
        raw = Path(out_wav).with_suffix(".pcm")
        raw.write_bytes(pcm)
        subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "s16le", "-ar", str(rate), "-ac", "1", "-i", str(raw),
                        "-af", "silenceremove=start_periods=1:start_threshold=-45dB", "-ar", str(SR), str(out_wav)],
                       check=True)
        return out_wav
    raise RuntimeError("Gemini voice fail: " + last)
