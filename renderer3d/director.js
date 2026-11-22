/* Director: turns a plan (window.DATA) into frames. Deterministic renderAt(t). */
(function () {
  const D = window.DATA;
  const W = D.w || 1920, H = D.h || 1080, FPS = D.fps || 30;
  const canvas = document.getElementById('gl');
  canvas.width = W; canvas.height = H;
  const R = new E3.Renderer(canvas);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, p) => a + (b - a) * p;
  const ease = p => { p = clamp(p, 0, 1); return p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; };
  const easeBack = p => { p = clamp(p, 0, 1); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };
  const ENV = D.env || [];
  const envAt = t => ENV.length ? (ENV[clamp(Math.floor(t * FPS), 0, ENV.length - 1)] || 0) : 0;
  const deg = d => d * Math.PI / 180;

  // ---------- build scenes ----------
  const scenes = D.scenes.map((sc, si) => {
    const set = (W3.SETS[sc.set] || W3.SETS.void)(sc.variant || {});
    const root = E3.group(); root.add(set.root);
    const spot = v => Array.isArray(v) ? v : (set.spots[v] || set.spots.center || [0, 0]);
    const cast = {};
    for (const c of sc.cast || []) {
      const ch = C3.build({ ...(D.characters?.[c.id] || c.spec || {}), seed: (c.id || 'x').length + si });
      root.add(ch.root);
      const track = (c.track && c.track.length ? c.track : [{ t: 0, action: 'idle', emotion: 'neutral' }]).slice().sort((a, b) => a.t - b.t);
      // positions along the track
      let pos = spot(c.at || 'center'), face = c.face ?? 0;
      const keys = [];
      track.forEach((k, i) => {
        const next = track[i + 1];
        const from = pos.slice();
        const to = k.to != null ? spot(k.to) : null;
        const t1 = next ? next.t : (sc.end - sc.start);
        if (to) { face = Math.atan2(to[0] - from[0], to[1] - from[1]) * 180 / Math.PI; pos = to; }
        else if (k.face != null) face = k.face;
        keys.push({ ...k, from, to, t1, face, action: k.action || (to ? 'walk' : 'idle'), emotion: k.emotion || 'neutral' });
      });
      cast[c.id] = { ch, keys, talk: c.talk || [], c };
    }
    for (const pr of sc.props || []) {
      const mk = W3.P[pr.type]; if (!mk) continue;
      const node = mk({ p: pr.p || [0, 0, 0], r: (pr.r || [0, 0, 0]).map(deg), s: pr.s || [1, 1, 1], col: pr.col });
      if (pr.attach) { const [id, joint] = pr.attach.split('.'); const who = cast[id]; if (who && who.ch.J[joint]) { who.ch.J[joint].add(node); continue; } }
      root.add(node);
    }
    return { sc, set, root, cast, spot, si };
  });

  // ---------- per-frame character state ----------
  function updateCast(S, lt, t) {
    for (const id in S.cast) {
      const { ch, keys, talk } = S.cast[id];
      let i = 0; for (let k = 0; k < keys.length; k++) if (lt >= keys[k].t) i = k;
      const k = keys[i], prev = keys[i - 1];
      const st = ch.state;
      st.action = k.action; st.since = S.sc.start + k.t; st.prev = prev ? prev.action : null; st.prevSince = prev ? S.sc.start + prev.t : 0;
      st.emotion = k.emotion; st.prevEmo = prev ? prev.emotion : null; st.emoSince = S.sc.start + k.t;
      // position
      let p = k.to || k.from;
      if (k.to) { const dur = Math.max(.3, k.t1 - k.t), q = clamp((lt - k.t) / dur, 0, 1); p = [lerp(k.from[0], k.to[0], q), lerp(k.from[1], k.to[1], q)]; if (q >= 1) { st.action = k.after || 'idle'; st.since = S.sc.start + k.t + dur; st.prev = 'walk'; st.prevSince = S.sc.start + k.t; } }
      ch.root.p = [p[0], 0, p[1]];
      ch.root.r = [k.lie ? -Math.PI / 2 : 0, deg(k.face), 0];
      if (k.lie) ch.root.p = [p[0], .55, p[1]];
      // talking?
      let talking = false, word = '', frac = 0, amp = 0;
      for (const tr of talk) if (lt >= tr[0] && lt <= tr[1]) talking = true;
      if (talking) {
        amp = ENV.length ? envAt(t) : (.35 + .65 * Math.abs(Math.sin(t * 11.7)) * (.6 + .4 * Math.sin(t * 2.3)));
        const words = S.sc.words || [];
        for (const w of words) if (t >= w.start && t < w.end) { word = w.w; frac = (t - w.start) / Math.max(.05, w.end - w.start); }
      }
      C3.apply(ch, t, { talking, amp, word, wordFrac: frac });
    }
  }

  // ---------- camera ----------
  const SHOTS = {
    wide: { d: 7.5, h: 2.4, look: 1.0, fov: 42 }, establish: { d: 11, h: 4, look: 1.2, fov: 45 },
    medium: { d: 3.0, h: 1.55, look: 1.3, fov: 34 }, close: { d: 1.35, h: 1.62, look: 1.58, fov: 30 },
    extreme: { d: .85, h: 1.6, look: 1.6, fov: 26 }, low: { d: 2.6, h: .55, look: 1.4, fov: 38 },
    top: { d: 3.5, h: 6.5, look: .8, fov: 40 }, ots: { d: 2.4, h: 1.65, look: 1.45, fov: 34 }, two: { d: 4.2, h: 1.7, look: 1.25, fov: 36 },
  };
  function camFor(S, lt, t) {
    const shots = (S.sc.shots && S.sc.shots.length) ? S.sc.shots : [{ t: 0, shot: 'medium', target: Object.keys(S.cast)[0] }];
    let i = 0; for (let k = 0; k < shots.length; k++) if (lt >= shots[k].t) i = k;
    const sh = shots[i], next = shots[i + 1];
    const dur = (next ? next.t : (S.sc.end - S.sc.start)) - sh.t, q = clamp((lt - sh.t) / Math.max(.5, dur), 0, 1);
    const P = SHOTS[sh.shot] || SHOTS.medium;
    let tx = 0, tz = 0, face = 0, k = 1;
    const tgt = sh.target && S.cast[sh.target];
    if (tgt) { tx = tgt.ch.root.p[0]; tz = tgt.ch.root.p[2]; face = tgt.ch.root.r[1]; k = tgt.ch.k; }
    else if (sh.at) { const sp = S.spot(sh.at); tx = sp[0]; tz = sp[1]; }
    if (sh.target2 && S.cast[sh.target2]) { const t2 = S.cast[sh.target2].ch.root.p; tx = (tx + t2[0]) / 2; tz = (tz + t2[2]) / 2; }
    const side = deg(sh.side ?? 18) + (sh.orbit ? deg(sh.orbit) * ease(q) : 0);
    const push = sh.move === 'pull' ? lerp(.9, 1.12, ease(q)) : sh.move === 'still' ? 1 : lerp(1.1, .94, ease(q));
    const d = P.d * push * (sh.dist || 1);
    const look = [tx, P.look * k, tz];
    const others = Object.keys(S.cast).filter(id => id !== sh.target && id !== sh.target2).map(id => S.cast[id].ch.root.p);
    const B = S.set.cam;
    let clampMove = 0;
    const place = a => {
      const raw = [tx + Math.sin(a) * d, P.h * (P.h > 2 ? 1 : k), tz + Math.cos(a) * d];
      let e = raw;
      if (B) e = [clamp(raw[0], B.x[0], B.x[1]), clamp(raw[1], B.y[0], B.y[1]), clamp(raw[2], B.z[0], B.z[1])];
      clampMove = Math.hypot(e[0] - raw[0], e[2] - raw[2]) / d;
      return e;
    };
    const blocked = e => clampMove > .35 || others.some(o => { // any other character near the camera->target line?
      const vx = look[0] - e[0], vz = look[2] - e[2], L = Math.hypot(vx, vz) || 1;
      const ux = (o[0] - e[0]) * vx / L + (o[2] - e[2]) * vz / L; if (ux < -.2 || ux > L - .25) return false;
      const px = e[0] + vx / L * ux, pz = e[2] + vz / L * ux; return Math.hypot(o[0] - px, o[2] - pz) < .45;
    });
    let ang = face + side + (sh.shot === 'ots' ? deg(160) : 0), eye = place(ang);
    if (blocked(eye)) { let found = false; for (const off of [35, -35, 65, -65, 95, -95, 130, -130]) { const e2 = place(ang + deg(off)); if (!blocked(e2)) { eye = e2; ang += deg(off); found = true; break; } } if (!found) eye = place(ang); }
    const hn = t => Math.sin(t * .9) * .012 + Math.sin(t * 2.3) * .006;
    eye[0] += hn(t) * d; eye[1] += hn(t + 3) * d * .6;
    return { eye, target: look, fov: P.fov };
  }

  // ---------- overlays ----------
  const capTop = document.getElementById('capTop'), capMain = document.getElementById('capMain'), subs = document.getElementById('subs');
  const flash = document.getElementById('flash'), fade = document.getElementById('fade'), counter = document.getElementById('counter');
  function overlays(S, lt, t) {
    const sc = S.sc;
    capTop.textContent = sc.caption_top || ''; capMain.textContent = sc.caption_main || '';
    const tp = (lt - .15) / .35; capTop.style.opacity = clamp(tp, 0, 1); capTop.style.transform = `translateY(${(1 - ease(tp)) * 24}px)`;
    const mt = sc.main_t != null ? sc.main_t - sc.start : .8, mp = (lt - mt) / .3;
    capMain.style.opacity = clamp(mp * 2, 0, 1); capMain.style.transform = `scale(${mp <= 0 ? 1.3 : lerp(1.3, 1, easeBack(mp))})`;
    // subtitles: current group of words
    const words = sc.words || [];
    let gi = -1; const per = 6;
    for (let i = 0; i < words.length; i++) if (t >= words[i].start - .05) gi = i;
    if (gi >= 0 && t < (words[words.length - 1].end + .3)) {
      const g0 = Math.floor(gi / per) * per, grp = words.slice(g0, g0 + per);
      subs.innerHTML = grp.map((w, k) => `<span style="color:${g0 + k === gi ? '#FFD45E' : '#fff'};opacity:${g0 + k <= gi ? 1 : .55}">${w.w}</span>`).join(' ');
      subs.style.opacity = 1;
    } else subs.style.opacity = 0;
    if (sc.counter) { const c = sc.counter, p = ease((lt - (c.t || .5)) / 1.4); counter.style.opacity = lt > (c.t || .5) ? 1 : 0; counter.querySelector('.n').textContent = (c.prefix || '') + Math.round(c.value * p).toLocaleString('en-IN') + (c.suffix || ''); counter.querySelector('.l').textContent = c.label || ''; }
    else counter.style.opacity = 0;
    flash.style.opacity = sc.flash_t != null ? clamp(1 - Math.abs(t - sc.flash_t) / .25, 0, 1) * .9 : 0;
    const total = D.duration;
    fade.style.opacity = clamp(1 - t / .8, 0, 1) + clamp((t - (total - 1.2)) / 1.2, 0, 1) + (lt < .12 && S.si > 0 ? (1 - lt / .12) * .8 : 0);
  }

  window.__ready = false;
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { window.__ready = true; });

  window.renderAt = function (t) {
    let S = scenes[0];
    for (const s of scenes) if (t >= s.sc.start) S = s;
    const lt = t - S.sc.start;
    updateCast(S, lt, t);
    const cam = camFor(S, lt, t);
    const light = { ...(W3.LIGHT[S.sc.light] || W3.LIGHT.day), shadowCenter: [cam.target[0], 0, cam.target[2]], shadowRadius: S.set.bounds + 3,
      fogNear: S.sc.fogNear ?? 14, fogFar: S.sc.fogFar ?? 60 };
    R.render(S.root, cam, light);
    overlays(S, lt, t);
    document.getElementById('grade').style.background = S.sc.grade || 'transparent';
    document.getElementById('grain').style.transform = `translate(${(Math.floor(t * 24) * 37) % 50 - 25}px,${(Math.floor(t * 24) * 53) % 50 - 25}px)`;
    return true;
  };
})();
