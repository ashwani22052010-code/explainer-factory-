"""1-minute 3D test video (lottery story opening):  python -m pipeline.demo3d [workers]"""
import json, shutil, subprocess, sys, wave
import numpy as np
from . import ghibli_audio, sfx
from .util import ROOT, log

HERO = {"gender": "m", "skin": "brown", "hair": "short", "top": "tshirt", "top_color": "teal", "bottom": "pants", "bottom_color": "navy"}
HERO_RICH = {**HERO, "top": "suit", "top_color": "black", "bottom_color": "black"}
MOM = {"gender": "f", "age": "old", "skin": "brown", "hair": "bun", "hair_color": "grey", "top": "saree", "top_color": "maroon", "bindi": True}
SHOP = {"gender": "m", "age": "old", "skin": "brown", "hair": "bald", "beard": "mustache", "top": "kurta", "top_color": "cream", "bottom_color": "white", "glasses": True}

SCENES = [
 dict(dur=11, set="small_room", light="morning", text="सोचिए, एक आम सी सुबह। आप एक छोटे से शहर में रहते हैं। महीने की तनख्वाह, अट्ठाईस हज़ार रुपये।",
      caption_top="एक आम सी सुबह", caption_main="", main=None,
      cast=[dict(id="hero", spec=HERO, at="window", face=180, track=[
          dict(t=0, action="idle"), dict(t=3.6, action="idle", face=20), dict(t=4.6, to=[-1.0, .5]), dict(t=7.4, action="look_phone", emotion="worried", face=200)])],
      props=[dict(type="phone", attach="hero.handR", p=[0, -.1, .05], r=[-80, 0, 0])],
      shots=[dict(t=0, shot="establish", target="hero", side=150, move="push"), dict(t=4.6, shot="wide", target="hero", side=40), dict(t=7.4, shot="close", target="hero", side=10)],
      counter=dict(t=7.6, value=28000, prefix="₹", label="महीने की तनख्वाह")),
 dict(dur=11, set="street", light="day", text="उस दिन ऑफिस से लौटते हुए, एक छोटी सी दुकान पर आपकी नज़र एक लॉटरी टिकट पर पड़ती है। बंपर इनाम, सौ करोड़ रुपये!",
      caption_top="लॉटरी टिकट", caption_main="₹100 करोड़", main="करोड़",
      cast=[dict(id="hero", spec=HERO, at=[-6, -1.4], face=90, track=[dict(t=0, to=[.4, -2.0]), dict(t=4.2, action="idle", face=150), dict(t=8.4, action="hold", emotion="smirk", face=150)]),
            dict(id="shop", spec=SHOP, at=[1.4, -3.05], face=0, track=[dict(t=0, action="idle", emotion="happy"), dict(t=5.4, action="talk", emotion="happy")], talk=[[5.6, 10.6]])],
      props=[dict(type="ticket", attach="hero.handR", p=[0, -.1, .06], r=[-60, 0, 0])],
      shots=[dict(t=0, shot="wide", target="hero", side=60, move="still"), dict(t=4.4, shot="two", target="hero", target2="shop", side=-30), dict(t=6.2, shot="medium", target="shop", side=10), dict(t=8.6, shot="close", target="hero", side=-25)],
      counter=dict(t=8.0, value=100, prefix="₹", suffix=" करोड़", label="बंपर इनाम")),
 dict(dur=14, set="small_room", light="lamp", variant=dict(night=True), text="दो हफ्ते बाद। आप फोन पर रिज़ल्ट खोलते हैं। पहला अंक मिलता है। दूसरा भी। तीसरा, चौथा, पाँचवाँ। हाथ काँपने लगते हैं। आप जीत चुके हैं!",
      caption_top="रिज़ल्ट का दिन", caption_main="जीत गए!", main="जीत", flash_word="जीत", grade="linear-gradient(rgba(255,150,60,.18),rgba(255,120,40,.10))",
      cast=[dict(id="hero", spec=HERO, at="table", face=180, track=[dict(t=0, action="sit_phone", emotion="neutral"), dict(t=4.5, action="sit_phone", emotion="worried"), dict(t=9.6, action="sit_shock", emotion="shock")])],
      props=[dict(type="phone", attach="hero.handR", p=[0, -.1, .05], r=[-80, 0, 0])],
      shots=[dict(t=0, shot="medium", target="hero", side=150), dict(t=4.0, shot="close", target="hero", side=20), dict(t=7.2, shot="extreme", target="hero", side=5, move="push"), dict(t=9.6, shot="low", target="hero", side=-30)]),
 dict(dur=11, set="small_room", light="morning", text="आप ज़ोर से चिल्लाते हैं। माँ, हम जीत गए! माँ रसोई से भागकर आती है, और खुशी से रो पड़ती है।",
      caption_top="माँ, हम जीत गए!", caption_main="", main=None,
      cast=[dict(id="hero", spec=HERO, at=[0, .2], face=40, track=[dict(t=0, action="celebrate", emotion="joy"), dict(t=6.2, action="hug", emotion="joy", face=70)], talk=[[1.4, 3.6]]),
            dict(id="mom", spec=MOM, at="door", face=-90, track=[dict(t=0, action="idle"), dict(t=3.4, to=[.95, .45], emotion="shock"), dict(t=6.2, action="hug", emotion="joy", face=-110), dict(t=8.4, action="cry", emotion="sad", face=-110)])],
      shots=[dict(t=0, shot="medium", target="hero", side=10, move="pull"), dict(t=3.4, shot="wide", target="hero", target2="mom", side=-10), dict(t=8.0, shot="two", target="mom", target2="hero", side=-40, dist=.7)]),
 dict(dur=13, set="mansion", light="lamp", variant=dict(night=True), text="डेढ़ साल बाद। बड़ा सा बंगला, महँगी चीज़ें, और एक अजीब सा अकेलापन।",
      caption_top="डेढ़ साल बाद", caption_main="अकेलापन", main="अकेलापन", grade="linear-gradient(rgba(60,90,200,.25),rgba(20,30,90,.20))",
      cast=[dict(id="hero", spec=HERO_RICH, at=[0, 2.5], face=180, track=[dict(t=0, to=[-3.4, -3.2]), dict(t=5.5, action="sad", emotion="sad", face=180), dict(t=9, action="sad", emotion="sad", face=30)])],
      shots=[dict(t=0, shot="wide", target="hero", side=200, dist=1.0), dict(t=5.5, shot="medium", target="hero", side=150), dict(t=9, shot="close", target="hero", side=10, move="push")]),
]


def build(fps=30):
    t, scenes, words_all = 0.4, [], []
    for sc in SCENES:
        ws = sc["text"].split()
        span = sc["dur"] - 1.2
        weights = [len(w) + 2 for w in ws]
        tot = sum(weights); cur = t + .5; words = []
        for w, wt in zip(ws, weights):
            d = span * wt / tot
            words.append({"w": w, "start": round(cur, 3), "end": round(cur + d, 3)}); cur += d
        main_t = None
        if sc.get("main"):
            main_t = next((w["start"] for w in words if sc["main"] in w["w"]), t + 1)
        flash_t = next((w["start"] for w in words if sc.get("flash_word") and sc["flash_word"] in w["w"]), None)
        d = {k: v for k, v in sc.items() if k not in ("dur", "text", "main", "flash_word")}
        d.update(start=round(t, 3), end=round(t + sc["dur"], 3), words=words, main_t=main_t, flash_t=flash_t)
        scenes.append(d); t += sc["dur"]
    return {"w": 1920, "h": 1080, "fps": fps, "duration": round(t + .6, 2), "scenes": scenes}


def audio(data, path):
    total = data["duration"]; n = int(44100 * total)
    music = ghibli_audio.music(total) * .32
    track = np.zeros(n, dtype=np.float64); track[:len(music)] += music[:n]
    ev = []
    for i, sc in enumerate(data["scenes"]):
        if i: ev.append((sc["start"] - .1, "whoosh", .7))
        if sc.get("counter"):
            c0 = sc["start"] + sc["counter"]["t"]
            ev += [(c0 + k * .12, "tick", .4) for k in range(10)] + [(c0 + 1.35, "ding", .5)]
        if sc.get("main_t"): ev.append((sc["main_t"], "thud", .5))
        if sc.get("flash_t"): ev += [(sc["flash_t"] - 1.6, "riser", .5), (sc["flash_t"], "thud", .9)]
    ev.append((data["scenes"][2]["start"] + 4.5, "heartbeat", .6)); ev.append((data["scenes"][2]["start"] + 6.5, "heartbeat", .7))
    for (t0, kind, g) in ev:
        clip = sfx.get(kind) * g; s = int(max(0, t0) * 44100); m = min(len(clip), n - s)
        if m > 0: track[s:s + m] += clip[:m]
    track = track / (np.abs(track).max() or 1) * .9
    st = np.repeat((track * 32767).astype(np.int16)[:, None], 2, axis=1)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(44100); w.writeframes(st.tobytes())


def main():
    workers = int(sys.argv[1]) if len(sys.argv) > 1 else 3
    work = ROOT / "out" / "demo3d"; work.mkdir(parents=True, exist_ok=True)
    rdir = work / "render"
    if rdir.exists(): shutil.rmtree(rdir)
    shutil.copytree(ROOT / "renderer3d", rdir)
    (rdir / "fonts").mkdir(exist_ok=True)
    for f in (ROOT / "renderer" / "fonts").glob("*.ttf"): shutil.copy(f, rdir / "fonts" / f.name)
    data = build()
    (rdir / "data.js").write_text("window.DATA=" + json.dumps(data, ensure_ascii=False) + ";", encoding="utf-8")
    if len(sys.argv) > 2 and sys.argv[2] == "snap":
        from playwright.sync_api import sync_playwright
        times = [float(x) for x in sys.argv[3:]]
        with sync_playwright() as p:
            b = p.chromium.launch(); pg = b.new_page(viewport={"width": 1920, "height": 1080})
            pg.on("pageerror", lambda e: print("ERR", e))
            pg.goto((rdir / "index.html").resolve().as_uri()); pg.wait_for_function("window.__ready===true")
            for t in times:
                pg.evaluate(f"renderAt({t})"); pg.screenshot(path=f"/tmp/d3_{t:05.1f}.png")
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
                    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart", str(work / "demo3d.mp4")], check=True)
    log(f"✅ {work / 'demo3d.mp4'}")


if __name__ == "__main__":
    main()
