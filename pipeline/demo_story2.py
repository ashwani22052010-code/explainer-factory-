"""Sample of the upgraded 2D story engine (lottery opening):  python -m pipeline.demo_story2 [workers] [snap t1 t2 ...]"""
import json, shutil, subprocess, sys, wave
import numpy as np
from . import ghibli_audio, sfx
from .util import ROOT, log

HERO = {"gender": "m", "skin": "brown", "hair": "side_part", "top": "shirt", "top_color": "white", "bottom_color": "navy"}
MOM = {"gender": "f", "age": "old", "skin": "brown", "hair": "bun", "hair_color": "grey", "top": "saree", "top_color": "maroon", "bindi": True}
SHOP = {"gender": "m", "age": "old", "skin": "brown", "hair": "bald", "beard": "mustache", "top": "kurta", "top_color": "cream", "bottom": "dhoti", "glasses": True, "shoes": "sandal"}

SC = [
 dict(dur=8, set=dict(type="city", tod="morning"), text="सोचिए, एक आम सी सुबह। आप एक छोटे से शहर में रहते हैं।",
      camera=[dict(t=0, z=1.0, x=960, y=540), dict(t=8, z=1.12, x=960, y=600, move=True)],
      overlays=[dict(type="year", text="2026", t=.8, dur=6, x=960, y=180), dict(type="tag", text="एक छोटा शहर", t=2.2, dur=5, x=330, y=110)], fx=dict(glow=dict(x=20, y=25))),
 dict(dur=10, set=dict(type="room_poor"), text="महीने की तनख्वाह, अट्ठाईस हज़ार रुपये। आधा किराया और बाइक की किश्त में चला जाता है।",
      cast=[dict(id="hero", x=960, track=[dict(t=0, pose="stand"), dict(t=1.2, pose="hands_hips", expr="neutral"), dict(t=5, pose="phone_look", expr="worried")])],
      camera=[dict(t=0, z=1, x=960, y=560), dict(t=4.8, z=1.0, x=960, y=560), dict(t=6.6, z=1.75, x=960, y=470, move=True)],
      overlays=[dict(type="nametag", text="आप", sub="उम्र 26 · प्राइवेट नौकरी", t=1, dur=3.4, x=960, y=270, space="world"),
                dict(type="counter", value=28000, prefix="₹", label="महीने की तनख्वाह", t=1.6, dur=3.2, x=1460, y=330),
                dict(type="callout", text="EMI बाकी!", label=[1300, 300], to=[1015, 500], t=7, dur=3, space="world", bend=-80)],
      fx=dict(dust=True, glow=dict(x=72, y=30))),
 dict(dur=11, set=dict(type="street", stallX=1300), text="उस दिन ऑफिस से लौटते हुए, एक दुकान पर आपकी नज़र एक लॉटरी टिकट पर पड़ती है। बंपर इनाम, सौ करोड़ रुपये!",
      cast=[dict(id="shop", x=1640, h=640, track=[dict(t=0, pose="stand", expr="happy"), dict(t=6.3, pose="hey", expr="joy")], talk=[[6.5, 10]], flip=True),
            dict(id="hero", x=220, track=[dict(t=0, x=980, walk=3.4), dict(t=3.6, pose="stand", expr="neutral"), dict(t=8.6, pose="hold", expr="smirk")])],
      camera=[dict(t=0, z=1, x=960, y=540), dict(t=6, z=1.25, x=1200, y=520, move=True), dict(t=8.4, z=1.25, x=1100, y=520)],
      overlays=[dict(type="callout", text="लॉटरी टिकट", label=[920, 300], to=[1240, 640], t=4.2, dur=3.4, space="world", bend=40),
                dict(type="bubble", text="बंपर! सौ करोड़!", t=6.6, dur=3.6, x=1660, y=280, space="world"),
                dict(type="inset", prop="ticket", t=8.8, dur=2.2, x=1560, y=330)]),
 dict(dur=11, set=dict(type="room_poor", tod="night"), text="दो हफ्ते बाद। आप फोन पर रिज़ल्ट खोलते हैं। पहला अंक मिलता है। दूसरा भी। तीसरा। आप जीत चुके हैं!",
      cast=[dict(id="hero", x=960, track=[dict(t=0, pose="phone_look", expr="neutral"), dict(t=4.5, pose="phone_look", expr="worried"), dict(t=8.6, pose="shock", expr="shock")])],
      camera=[dict(t=0, z=1.2, x=960, y=520), dict(t=4.5, z=1.9, x=960, y=420, move=True), dict(t=8.6, z=1.4, x=960, y=500)],
      overlays=[dict(type="inset", prop="phone", t=2.4, dur=2, x=1420, y=420), dict(type="title", text="जीत गए!", t=8.8, dur=2.2, x=960, y=300)],
      flash=[8.6], grade="linear-gradient(rgba(60,80,170,.25), rgba(20,20,80,.3))", fx=dict(glow=dict(x=36, y=12, color="rgba(255,250,220,.35)"))),
 dict(dur=9, set=dict(type="room_poor"), text="आप ज़ोर से चिल्लाते हैं। माँ, हम जीत गए! माँ की आँखों में खुशी के आँसू आ जाते हैं।",
      cast=[dict(id="hero", x=760, track=[dict(t=0, pose="celebrate", expr="joy"), dict(t=5.4, pose="hug", expr="happy")], talk=[[1.4, 3.6]]),
            dict(id="mom", x=1900, h=660, flip=True, track=[dict(t=0, pose="stand", expr="neutral"), dict(t=2.6, x=1180, walk=2.0, expr="shock"), dict(t=4.8, pose="cry", expr="happy")])],
      camera=[dict(t=0, z=1.25, x=800, y=500), dict(t=3.2, z=1.0, x=960, y=540, move=True)],
      overlays=[dict(type="bubble", text="माँ, हम जीत गए!", t=1.4, dur=2.6, x=930, y=230, space="world")], fx=dict(dust=True, glow=dict(x=72, y=30))),
 dict(dur=6, set=dict(type="desk"), text="लेकिन सौ करोड़ पूरे नहीं मिलते। टैक्स कटने के बाद, लगभग साठ करोड़।",
      overlays=[dict(type="card", kicker="लॉटरी विभाग", strike="₹100 करोड़", text="₹60 करोड़", sub="टैक्स कटने के बाद (लगभग)", stamp="OFFICIAL", t=.3, dur=5.5, x=960, y=520, keep=True)],
      camera=[dict(t=0, z=1, x=960, y=540), dict(t=6, z=1.08, x=960, y=540, move=True)]),
 dict(dur=9, set=dict(type="mansion", tod="night"), text="डेढ़ साल बाद। बड़ा सा बंगला, महँगी चीज़ें, और एक अजीब सा अकेलापन।",
      cast=[dict(id="hero", x=960, spec=dict(top="suit", top_color="charcoal", bottom_color="charcoal"), track=[dict(t=0, pose="stand", expr="neutral"), dict(t=4, pose="sad", expr="sad")])],
      camera=[dict(t=0, z=1, x=960, y=540), dict(t=4, z=1.0, x=960, y=540), dict(t=9, z=1.7, x=960, y=470, move=True)],
      overlays=[dict(type="tag", text="डेढ़ साल बाद", t=.5, dur=3.5, x=300, y=110), dict(type="title", text="अकेलापन", t=6.2, dur=2.6, x=960, y=240)],
      fx=dict(glow=dict(x=50, y=12, color="rgba(255,210,130,.3)"))),
]


def build():
    t, scenes = 0.3, []
    for sc in SC:
        ws = sc["text"].split(); span = sc["dur"] - 1.0; wt = [len(w) + 2 for w in ws]; tot = sum(wt); cur = t + .4; words = []
        for w, k in zip(ws, wt):
            d = span * k / tot; words.append({"w": w, "start": round(cur, 3), "end": round(cur + d, 3)}); cur += d
        d = {k: v for k, v in sc.items() if k not in ("dur", "text")}
        d.update(start=round(t, 3), end=round(t + sc["dur"], 3), words=words)
        scenes.append(d); t += sc["dur"]
    return {"w": 1920, "h": 1080, "fps": 30, "duration": round(t + .5, 2), "characters": {"hero": HERO, "mom": MOM, "shop": SHOP}, "scenes": scenes}


def audio(data, path):
    total = data["duration"]; n = int(44100 * total)
    track = np.zeros(n); m = ghibli_audio.music(total) * .3; track[:len(m)] += m[:n]
    ev = []
    for sc in data["scenes"]:
        if sc["start"] > 1: ev.append((sc["start"] - .1, "whoosh", .6))
        for o in sc.get("overlays", []):
            k = {"callout": "swoosh_down", "bubble": "pop", "nametag": "pop", "inset": "pop", "title": "thud", "card": "thud", "tag": "click", "year": "thud"}.get(o["type"])
            if k: ev.append((sc["start"] + o["t"], k, .55))
            if o["type"] == "counter": ev += [(sc["start"] + o["t"] + i * .12, "tick", .35) for i in range(10)] + [(sc["start"] + o["t"] + 1.3, "ding", .45)]
        for f in sc.get("flash", []): ev += [(sc["start"] + f - 1.5, "riser", .5), (sc["start"] + f, "thud", .9)]
    for (t0, k, g) in ev:
        c = sfx.get(k) * g; s = int(max(0, t0) * 44100); mm = min(len(c), n - s)
        if mm > 0: track[s:s + mm] += c[:mm]
    track = track / (np.abs(track).max() or 1) * .9
    st = np.repeat((track * 32767).astype(np.int16)[:, None], 2, axis=1)
    with wave.open(str(path), "wb") as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(44100); w.writeframes(st.tobytes())


def main():
    workers = int(sys.argv[1]) if len(sys.argv) > 1 else 2
    work = ROOT / "out" / "story2"; work.mkdir(parents=True, exist_ok=True)
    rdir = work / "render"
    if rdir.exists(): shutil.rmtree(rdir)
    shutil.copytree(ROOT / "renderer_story", rdir)
    (rdir / "fonts").mkdir(exist_ok=True)
    for f in (ROOT / "renderer" / "fonts").glob("*.ttf"): shutil.copy(f, rdir / "fonts" / f.name)
    data = build()
    (rdir / "data.js").write_text("window.DATA=" + json.dumps(data, ensure_ascii=False) + ";", encoding="utf-8")
    if len(sys.argv) > 2 and sys.argv[2] == "snap":
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1920, "height": 1080})
            pg.on("pageerror", lambda e: print("ERR", e))
            pg.goto((rdir / "index.html").resolve().as_uri()); pg.wait_for_function("window.__ready===true")
            for t in [float(x) for x in sys.argv[3:]]:
                pg.evaluate(f"renderAt({t})"); pg.screenshot(path=f"/tmp/s2_{t:05.1f}.png")
            b.close()
        return
    audio(data, work / "audio.wav")
    total = int(data["duration"] * 30); step = -(-total // workers); procs, segs = [], []
    log(f"Rendering {total} frames, {workers} workers…")
    for k in range(workers):
        a, b = k * step, min(total, (k + 1) * step); seg = work / f"seg{k}.mp4"; segs.append(seg)
        procs.append(subprocess.Popen([sys.executable, "-m", "pipeline.render", "worker", str(rdir), str(a), str(b), "30", "1920", "1080", str(seg)], cwd=ROOT))
    if any(p.wait() for p in procs): raise SystemExit("render failed")
    (work / "segs.txt").write_text("".join(f"file '{s.resolve()}'\n" for s in segs))
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(work / "segs.txt"), "-i", str(work / "audio.wav"),
                    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", str(work / "story_sample.mp4")], check=True)
    log(f"✅ {work / 'story_sample.mp4'}")


if __name__ == "__main__":
    main()
