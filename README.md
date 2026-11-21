# 🎬 Explainer Factory

Script do → GitHub khud poori explainer video bana dega. AI images nahi: har drawing **code se** banti hai, aur saath mein motion, sound effects, voiceover, captions aur music bhi. Sab free.

```
script (.txt)
   ↓  Gemini: script samjho → scenes, captions, kya dikhana hai
   ↓  AI artist: har cheez ka SVG drawing code likho → render karke khud check karo → kharab ho to dobara banao
   ↓  library: pass hui drawings hamesha ke liye save (agli video mein reuse)
   ↓  voice: free AI voice ya teri recording
   ↓  engine: motion + camera + transitions + captions + particles + counters/papers/clock/charts
   ↓  sound: whoosh, pop, tick, thud, heartbeat… sab code se synthesize + background music
   ↓
 1080×1920 MP4  →  Releases mein download
```

---

## ⚙️ Ek baar ka setup (10 minute, mobile se ho jayega)

### Step 1 — Gemini API key (free)
1. **aistudio.google.com** kholo → Google account se login karo
2. **Get API key** → **Create API key** → key copy kar lo

### Step 2 — Key ko repo mein daalo
Repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
- Name: `GEMINI_API_KEY`
- Secret: copy ki hui key → **Add secret**

### Step 3 — Actions ko permission do (sirf agar video Releases mein na aaye)
Repo → **Settings** → **Actions** → **General** → *Workflow permissions* → **Read and write permissions** → Save

---

## 🎥 Video kaise banaye (roz ka kaam)

1. Repo mein **`scripts`** folder kholo → **Add file** → **Create new file**
2. Naam do, jaise `angithi.txt`. **Space mat rakhna**, `angithi-death.txt` jaisa naam sahi hai.
3. Apni script paste karo → **Commit changes**
4. **Actions** tab mein progress dikhega, 10–25 minute lagenge
5. Ready hone pe **Releases** (repo ke main page pe right side) → MP4 download. Saath mein `metadata.txt` bhi milega jisme **title, description aur tags** hain.

Example scripts `examples/` folder mein hain. Unhe copy karke `scripts/` mein daal do, pehla test ho jayega.

### Apni awaaz use karni hai?
Pehle `voice/` folder mein recording upload karo, script ke **same naam** se (`voice/angithi.mp3`), **phir** script daalo. System recording ko sun ke scenes ki timing khud set kar dega.

### Dobara banana hai bina script badle?
**Actions** → **🎬 Make Video** → **Run workflow** → file ka naam likho → Run.

---

## 🎛️ Settings (`config.yaml`)

| Setting | Kya karta hai |
|---|---|
| `language` | voiceover ki language: hindi / english / portuguese |
| `caption_language` | screen pe captions ki language |
| `voice.edge_voice` | AI voice ka naam (auto = language ke hisaab se) |
| `voice.rate` | bolne ki speed |
| `audio.music` | `auto` = code wali music, `off`, ya `music/` folder ki file |
| `style.palette` | poore channel ke rang |
| `gemini.min_score` | drawing kitni achhi ho tab pass ho (10 mein se) |

---

## 🧠 Library apne aap badhti hai
Har nayi drawing jo self-check pass karti hai, `assets/library/` mein save ho jaati hai. Agli video mein wahi cheez aaye (angithi, darwaza, dimaag…) to dobara banane ki zarurat nahi. Jitni zyada videos banaoge, utni tez aur sasti (kam Gemini calls) har video banegi.

Koi drawing pasand nahi aayi? `assets/library/` se uski `.svg` file delete kar do. Agli baar wo naye sire se banegi.

## ⚠️ Free limits
- **GitHub Actions:** public repo pe free.
- **Gemini free tier:** roz ki ek limit hai. Shuru mein ek video mein bahut drawings banti hain, isliye roz 1–2 video aaram se banengi. Library badhne ke saath ye number badhta jayega. Limit khatam hone pe system agla model try karta hai, aur phir bhi na chale to agle din chalao.
- **Upload se pehle video ek baar dekh lena.** AI kabhi-kabhi galat drawing ya galat caption de deta hai.

## 🧪 Offline test (bina API key)
```
pip install -r requirements.txt && python -m playwright install chromium
python -m pipeline.main --demo
```
