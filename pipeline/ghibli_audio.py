"""Cozy, Ghibli-inspired soundtrack + nature ambience — fully synthesized (no copyright issues)."""
import numpy as np
from scipy.signal import butter, sosfilt

SR = 44100
rng = np.random.default_rng(11)


def lp(x, f):
    return sosfilt(butter(2, f, "low", fs=SR, output="sos"), x)


def bp(x, f1, f2):
    return sosfilt(butter(2, [f1, f2], "band", fs=SR, output="sos"), x)


def add(out, s, x):
    if s >= len(out) or s < 0:
        return
    m = min(len(x), len(out) - s)
    out[s:s + m] += x[:m]


def note_freq(n):  # MIDI -> Hz
    return 440 * 2 ** ((n - 69) / 12)


def piano(f, dur, vel=1.0):
    t = np.arange(int(SR * dur)) / SR
    env = np.exp(-t * 3.2) * (1 - np.exp(-t * 400))
    tone = (np.sin(2 * np.pi * f * t) + .45 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 2)
            + .18 * np.sin(2 * np.pi * 3 * f * t) * np.exp(-t * 4) + .08 * np.sin(2 * np.pi * 4.01 * f * t) * np.exp(-t * 6))
    return tone * env * vel


def pad(freqs, dur):
    t = np.arange(int(SR * dur)) / SR
    x = np.zeros_like(t)
    for f in freqs:
        for det in (-0.004, 0, 0.004):
            x += np.sin(2 * np.pi * f * (1 + det) * t + rng.uniform(0, 6))
    att = np.minimum(1, t / 1.2)
    rel = np.minimum(1, np.maximum(0, (dur - t) / 1.2))
    return lp(x, 1400) * att * rel


def music(seconds):
    n = int(SR * seconds)
    out = np.zeros(n + SR * 4)
    # I - vi - IV - V in C, then vi - IV - I - V
    prog = [[48, 52, 55, 60], [45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 59],
            [45, 48, 52, 57], [41, 45, 48, 53], [48, 52, 55, 60], [43, 47, 50, 55]]
    bar = 4.0
    melody_pool = [72, 74, 76, 79, 81, 84, 76, 74]
    k = 0
    tpos = 0.0
    while tpos < seconds + bar:
        chord = prog[k % len(prog)]
        s = int(tpos * SR)
        p = pad([note_freq(m) for m in chord], bar + 1.2) * .05
        add(out, s, p)
        # gentle arpeggio (eighths)
        arp = chord + [chord[1] + 12, chord[2] + 12]
        for i in range(8):
            m = arp[[0, 2, 1, 3, 2, 4, 3, 5][i]] + 12
            nt = piano(note_freq(m), 2.2, .11 if i % 2 == 0 else .08)
            ss = s + int(i * bar / 8 * SR)
            add(out, ss, nt)
        # soft melody on some bars
        if k % 2 == 1 or k > 3:
            for j, frac in enumerate((0, .375, .75)):
                m = melody_pool[(k * 3 + j) % len(melody_pool)]
                if m % 12 not in [c % 12 for c in chord] and j == 0:
                    m = chord[-1] + 24
                nt = piano(note_freq(m), 3.0, .16)
                ss = s + int(frac * bar * SR)
                add(out, ss, nt)
        # bass
        b = piano(note_freq(chord[0] - 12), 3.5, .18)
        add(out, s, lp(b, 500))
        k += 1
        tpos += bar
    out = out[:n]
    # simple room reverb (comb feedback)
    rev = np.zeros_like(out)
    for d, g in ((0.031, .35), (0.047, .3), (0.071, .25), (0.113, .2), (0.161, .15)):
        dd = int(d * SR)
        rev[dd:] += out[:-dd] * g
    out = out + lp(rev, 3500) * .9
    t = np.arange(n) / SR
    out *= np.minimum(1, t / 3) * np.minimum(1, np.maximum(0, (seconds - t) / 4))
    return out / (np.max(np.abs(out)) or 1)


def wind(seconds, strength=1.0):
    n = int(SR * seconds)
    x = rng.standard_normal(n)
    t = np.arange(n) / SR
    swell = .5 + .5 * np.sin(2 * np.pi * .09 * t) * np.sin(2 * np.pi * .037 * t + 1)
    return bp(x, 150, 900) * (.3 + .7 * swell) * strength * .25


def birds(seconds, density=0.6):
    n = int(SR * seconds)
    out = np.zeros(n)
    tpos = 0.5
    while tpos < seconds - 1:
        f0 = rng.uniform(2600, 4200)
        for c in range(rng.integers(2, 5)):
            d = rng.uniform(.06, .14)
            t = np.arange(int(SR * d)) / SR
            f = f0 * (1 + .25 * np.sin(np.pi * t / d)) * (1 + rng.uniform(-.1, .1))
            ch = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / d) ** 2
            s = int((tpos + c * .16) * SR)
            add(out, s, ch * .12)
        tpos += rng.uniform(1.0, 3.5) / density
    return out


def crickets(seconds):
    n = int(SR * seconds)
    t = np.arange(n) / SR
    out = np.zeros(n)
    for f, rate, ph in ((4600, 3.1, 0), (5200, 2.6, 1.3), (4900, 3.7, 2.1)):
        chirp = (np.sin(2 * np.pi * rate * t + ph) > .6).astype(float)
        trill = (np.sin(2 * np.pi * 38 * t) > 0).astype(float)
        out += np.sin(2 * np.pi * f * t) * chirp * trill * .035
    return lp(out, 7000)


def water(seconds):
    n = int(SR * seconds)
    x = rng.standard_normal(n)
    t = np.arange(n) / SR
    return bp(x, 400, 2500) * (.6 + .4 * np.sin(2 * np.pi * .3 * t)) * .07


def train(seconds, start, pass_dur=9):
    n = int(SR * seconds)
    out = np.zeros(n)
    t = np.arange(int(SR * pass_dur)) / SR
    rumble = lp(rng.standard_normal(len(t)), 160) * 1.4
    clack = np.zeros(len(t))
    for c in np.arange(0, pass_dur, .42):
        s = int(c * SR)
        k = np.exp(-np.arange(int(.05 * SR)) / SR * 80) * rng.standard_normal(int(.05 * SR))
        clack[s:s + len(k)] += bp(k, 800, 3000)[: len(t) - s] * .9
    env = np.sin(np.pi * t / pass_dur) ** 1.5
    seg = (rumble + clack) * env * .22
    s = int(start * SR)
    add(out, s, seg)
    return out


def room(seconds):
    n = int(SR * seconds)
    out = lp(rng.standard_normal(n), 300) * .03
    t = np.arange(n) / SR
    tick = np.zeros(n)
    for c in np.arange(0, seconds, 1.0):
        s = int(c * SR)
        k = np.exp(-np.arange(400) / 40) * .15
        tick[s:s + 400] += k[: n - s] * np.sin(2 * np.pi * 2500 * np.arange(400)[: n - s] / SR)
    return out + tick * .5


def soundtrack(scenes, total):
    """scenes: list of (start, end, kind)."""
    n = int(SR * total)
    mix = music(total) * .55
    for (s, e, kind) in scenes:
        dur = e - s + 2
        layer = {"hills": lambda d: wind(d, .7) + birds(d, .8),
                 "field": lambda d: wind(d, 1.4) + birds(d, .4),
                 "room": room,
                 "forest": lambda d: wind(d, .5) + birds(d, 1.2),
                 "river": lambda d: water(d) + wind(d, .4) + train(d, 1.0),
                 "night": lambda d: crickets(d) + wind(d, .3)}[kind](dur)
        t = np.arange(len(layer)) / SR
        env = np.minimum(1, t / 1.4) * np.minimum(1, np.maximum(0, (dur - t) / 1.4))
        a = int(max(0, s - 1) * SR)
        seg = layer * env
        add(mix, a, seg)
    mix = mix / (np.max(np.abs(mix)) or 1) * .9
    return mix.astype(np.float32)
