"""Mix narration + synthesized SFX + music bed into one stereo WAV."""
import subprocess
import wave

import numpy as np

from . import sfx
from .util import ROOT, log

SR = sfx.SR


def read_audio(path):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(SR),
                          "-f", "s16le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0


def mix(narration_wav, events, duration, cfg, out_path):
    a = cfg.get("audio", {})
    n = int(SR * duration)
    track = np.zeros(n, dtype=np.float32)

    voice = read_audio(narration_wav) * float(a.get("voice_volume", 1.0))
    track[: min(n, len(voice))] += voice[:n]

    sv = float(a.get("sfx_volume", 0.55))
    for e in events:
        clip = sfx.get(e["type"]) * sv * float(e.get("gain", 1))
        s = int(max(0, e["t"]) * SR)
        if s >= n:
            continue
        m = min(len(clip), n - s)
        track[s: s + m] += clip[:m]

    music = a.get("music", "auto")
    if music and music != "off":
        if music == "auto" and cfg.get("_story"):
            from . import ghibli_audio
            bed = ghibli_audio.music(duration).astype(np.float32) * 1.4
        elif music == "auto":
            bed = sfx.music_bed(duration)
        else:
            p = ROOT / "music" / music
            bed = read_audio(p) if p.exists() else sfx.music_bed(duration)
            if len(bed) < n:
                bed = np.tile(bed, n // max(1, len(bed)) + 1)
        bed = bed[:n] * float(a.get("music_volume", 0.1))
        # duck music under voice
        env = np.abs(np.pad(voice, (0, max(0, n - len(voice))))[:n])
        k = int(SR * 0.25)
        env = np.convolve(env, np.ones(k) / k, mode="same")
        duck = 1 - 0.55 * np.clip(env * 8, 0, 1)
        track[: len(bed)] += bed * duck[: len(bed)]

    peak = np.max(np.abs(track)) or 1
    track = track / peak * 0.89
    stereo = np.repeat((track * 32767).astype(np.int16)[:, None], 2, axis=1)
    with wave.open(str(out_path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(stereo.tobytes())
    log(f"Audio mix ready ({duration:.1f}s, {len(events)} sound effects)")
    return out_path


def envelope(wav, fps):
    """Voice loudness per video frame (0..1) — drives mouth/talk animation."""
    x = read_audio(wav)
    hop = int(SR / fps)
    n = len(x) // hop
    if n == 0:
        return []
    rms = np.sqrt(np.mean(x[: n * hop].reshape(n, hop) ** 2, axis=1))
    ref = np.percentile(rms, 95) or 1
    env = np.clip(rms / ref, 0, 1)
    out, acc = [], 0.0
    for v in env:  # fast attack, slower release
        acc = v if v > acc else acc * 0.6 + v * 0.4
        out.append(round(float(acc), 2))
    return out
