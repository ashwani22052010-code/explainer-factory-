"""All sound effects and background music are SYNTHESIZED in code (no copyright issues)."""
import numpy as np

SR = 44100
_rng = np.random.default_rng(7)


def _t(sec):
    return np.arange(int(SR * sec)) / SR


def _env(n, attack=0.005, release=None, curve=4.0):
    t = np.linspace(0, 1, n)
    a = max(1, int(SR * attack))
    e = np.exp(-curve * t)
    e[:a] *= np.linspace(0, 1, a)
    return e


def _lowpass(x, cutoff):
    """One-pole low-pass; cutoff may be an array (sweeps)."""
    cutoff = np.broadcast_to(np.asarray(cutoff, dtype=float), x.shape)
    alpha = 1 - np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc += alpha[i] * (x[i] - acc)
        y[i] = acc
    return y


def _norm(x, peak=0.9):
    m = np.max(np.abs(x)) or 1
    return (x / m * peak).astype(np.float32)


def whoosh(dur=0.5):
    n = int(SR * dur)
    noise = _rng.standard_normal(n)
    t = np.linspace(0, 1, n)
    sweep = 300 + 5000 * np.sin(np.pi * t) ** 2
    x = _lowpass(noise, sweep) - _lowpass(noise, sweep * 0.25)
    env = np.sin(np.pi * t) ** 1.5
    return _norm(x * env, 0.7)


def swoosh_down(dur=0.6):
    n = int(SR * dur)
    t = np.linspace(0, 1, n)
    x = _lowpass(_rng.standard_normal(n), 6000 * (1 - t) + 200)
    return _norm(x * np.sin(np.pi * t), 0.6)


def pop():
    t = _t(0.14)
    f = 900 * np.exp(-t * 30) + 180
    x = np.sin(2 * np.pi * np.cumsum(f) / SR) * _env(len(t), 0.002, curve=9)
    return _norm(x, 0.55)


def click():
    t = _t(0.03)
    x = _rng.standard_normal(len(t)) * _env(len(t), 0.0005, curve=40)
    return _norm(x, 0.4)


def tick():
    t = _t(0.05)
    x = (np.sin(2 * np.pi * 2400 * t) + 0.5 * np.sin(2 * np.pi * 3900 * t)) * _env(len(t), 0.0005, curve=35)
    return _norm(x, 0.35)


def thud():
    t = _t(0.7)
    f = 95 * np.exp(-t * 4) + 38
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * _env(len(t), 0.002, curve=5)
    hit = _lowpass(_rng.standard_normal(len(t)), 900) * _env(len(t), 0.001, curve=25)
    return _norm(body + 0.6 * hit, 0.9)


def riser(dur=1.6):
    t = _t(dur)
    p = t / dur
    f = 180 + 900 * p ** 2
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.4
    noise = _lowpass(_rng.standard_normal(len(t)), 500 + 7000 * p) * 0.6
    return _norm((tone + noise) * p ** 2, 0.6)


def ding():
    t = _t(1.4)
    x = sum(a * np.sin(2 * np.pi * f * t) for f, a in ((1320, 1), (2640, .4), (3960, .2), (1980, .25)))
    return _norm(x * _env(len(t), 0.001, curve=4.5), 0.45)


def heartbeat():
    one = thud()[: int(SR * 0.35)] * 0.9
    out = np.zeros(int(SR * 0.9), dtype=np.float32)
    out[: len(one)] += one
    s = int(SR * 0.28)
    out[s: s + len(one)] += one * 0.7
    return _norm(out, 0.85)


def glitch():
    n = int(SR * 0.35)
    x = np.zeros(n)
    pos = 0
    while pos < n:
        seg = int(SR * _rng.uniform(0.01, 0.05))
        f = _rng.uniform(80, 2000)
        tt = np.arange(min(seg, n - pos)) / SR
        x[pos: pos + len(tt)] = np.sign(np.sin(2 * np.pi * f * tt)) * _rng.uniform(0.2, 1)
        pos += seg
    return _norm(x * _env(n, 0.001, curve=2), 0.35)


def alarm():
    t = _t(0.9)
    x = np.sin(2 * np.pi * (880 + 220 * np.sign(np.sin(2 * np.pi * 6 * t))) * t)
    return _norm(x * _env(len(t), 0.01, curve=2), 0.3)


BANK = {"whoosh": whoosh, "swoosh_down": swoosh_down, "pop": pop, "click": click, "tick": tick,
        "thud": thud, "riser": riser, "ding": ding, "heartbeat": heartbeat, "glitch": glitch,
        "alarm": alarm}
_cache = {}


def get(name):
    if name not in _cache:
        _cache[name] = BANK[name]() if name in BANK else pop()
    return _cache[name]


def music_bed(seconds, seed=3):
    """Dark, cinematic ambient pad: slow evolving minor chords + soft pulse."""
    rng = np.random.default_rng(seed)
    n = int(SR * seconds)
    t = np.arange(n) / SR
    chords = [(73.42, 110.0, 146.83, 174.61),   # Dm
              (58.27, 116.54, 146.83, 174.61),  # Bb
              (65.41, 98.0, 130.81, 155.56),    # Cm-ish
              (55.0, 110.0, 130.81, 164.81)]    # Am
    bar = 8.0
    out = np.zeros(n)
    for k in range(int(seconds // bar) + 2):
        s = int(k * bar * SR)
        if s >= n:
            break
        e = min(n, int((k + 1) * bar * SR + 2 * SR))
        tt = t[s:e] - k * bar
        seg = np.zeros(e - s)
        for f in chords[k % len(chords)]:
            det = 1 + rng.uniform(-0.003, 0.003)
            seg += np.sin(2 * np.pi * f * det * tt) + 0.3 * np.sin(2 * np.pi * 2 * f * tt)
        fade = np.minimum(1, tt / 2.0) * np.minimum(1, np.maximum(0, (bar + 2 - tt) / 2.0))
        out[s:e] += seg * fade
    out *= 0.75 + 0.25 * np.sin(2 * np.pi * 0.11 * t)            # slow swell
    pulse = np.sin(2 * np.pi * 36.7 * t) * (0.5 + 0.5 * np.sign(np.sin(2 * np.pi * 1.0 * t)))
    out += 0.25 * pulse * np.exp(-((t % 1.0) * 6))               # soft heartbeat-ish pulse
    fade_in = np.minimum(1, t / 2.5)
    fade_out = np.minimum(1, np.maximum(0, (seconds - t) / 3))
    return _norm(out * fade_in * fade_out, 0.8)
