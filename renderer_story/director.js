/* Story director: scenes, cast, camera, overlays, FX. Deterministic window.renderAt(t). */
(function () {
  const D = window.DATA, W = D.w || 1920, H = D.h || 1080, FPS = D.fps || 30;
  const stage = document.getElementById('stage');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, p) => a + (b - a) * p;
  const ease = p => { p = clamp(p, 0, 1); return p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; };
  const back = p => { p = clamp(p, 0, 1); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };
  const el = (tag, cls, parent, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; if (parent) parent.appendChild(e); return e; };
  function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
  const ENV = D.env || [];
  const amplitude = t => ENV.length ? (ENV[clamp(Math.floor(t * FPS), 0, ENV.length - 1)] || 0) : (.45 + .55 * Math.abs(Math.sin(t * 12.3)) * (.5 + .5 * Math.sin(t * 3.1)));

  function viseme(word, frac, amp) {
    if (!word || amp < .12) return 'v_closed';
    const ch = [...word.toLowerCase()][Math.min(word.length - 1, Math.floor(frac * [...word].length))] || '';
    if (/[mbpमबपभ]/.test(ch)) return 'v_closed';
    if (/[ouोौुूउऊओऔ]/.test(ch)) return 'v_o';
    if (/[eiyिीेैइईएऐ]/.test(ch)) return 'v_e';
    if (/[fvफव]/.test(ch)) return 'v_f';
    if (/[aाअआ]/.test(ch) || amp > .7) return 'v_wide';
    return 'v_small';
  }

  // ---------- props (code drawn) ----------
  const PROPS = {
    ticket: `<svg viewBox="0 0 260 130"><rect x="4" y="4" width="252" height="122" rx="10" fill="#ff9ec0" stroke="#2a1c16" stroke-width="5"/><rect x="18" y="16" width="224" height="30" rx="4" fill="#c8323a"/><text x="130" y="39" font-family="Anton" font-size="24" fill="#fff" text-anchor="middle">BUMPER ₹100 CR</text><text x="130" y="92" font-family="Anton" font-size="40" fill="#2a1c16" text-anchor="middle" letter-spacing="4">472918</text><path d="M200 4 V126" stroke="#2a1c16" stroke-width="3" stroke-dasharray="8 6"/></svg>`,
    phone: `<svg viewBox="0 0 140 260"><rect x="4" y="4" width="132" height="252" rx="22" fill="#1d1d24" stroke="#2a1c16" stroke-width="5"/><rect x="16" y="26" width="108" height="206" rx="8" fill="#7cc8f2"/><rect x="28" y="50" width="84" height="20" rx="4" fill="#fff"/><rect x="28" y="84" width="60" height="14" rx="4" fill="#ffffffaa"/><rect x="28" y="110" width="84" height="54" rx="6" fill="#c8323a"/><text x="70" y="146" font-family="Anton" font-size="26" fill="#fff" text-anchor="middle">EMI DUE</text></svg>`,
    money: `<svg viewBox="0 0 300 180">${[0, 1, 2].map(i => `<g transform="translate(${20 + i * 12} ${100 - i * 34})"><rect width="230" height="60" rx="6" fill="#7ab36a" stroke="#2a1c16" stroke-width="4"/><rect x="95" width="40" height="60" fill="#d9c060" stroke="#2a1c16" stroke-width="3"/><circle cx="50" cy="30" r="16" fill="#5f9a52"/></g>`).join('')}</svg>`,
    envelope: `<svg viewBox="0 0 260 180"><rect x="6" y="6" width="248" height="168" rx="6" fill="#f3e6c8" stroke="#2a1c16" stroke-width="5"/><path d="M6 6 L130 96 L254 6" fill="none" stroke="#2a1c16" stroke-width="4"/><circle cx="130" cy="96" r="24" fill="#b8282f" stroke="#2a1c16" stroke-width="4"/></svg>`,
    car: `<svg viewBox="0 0 400 180"><path d="M20 120 Q24 80 80 74 L130 30 Q150 18 180 18 L260 18 Q290 20 310 44 L340 74 Q384 80 386 120 L386 140 L20 140 Z" fill="#c8323a" stroke="#2a1c16" stroke-width="5"/><path d="M140 36 L180 30 L250 30 L290 70 L140 70 Z" fill="#9fd0ea" stroke="#2a1c16" stroke-width="4"/><circle cx="96" cy="142" r="32" fill="#222" stroke="#2a1c16" stroke-width="5"/><circle cx="310" cy="142" r="32" fill="#222" stroke="#2a1c16" stroke-width="5"/><circle cx="96" cy="142" r="12" fill="#ccc"/><circle cx="310" cy="142" r="12" fill="#ccc"/></svg>`,
    chai: `<svg viewBox="0 0 160 160"><path d="M30 50 L40 140 L110 140 L120 50 Z" fill="#f4efe4" stroke="#2a1c16" stroke-width="5"/><ellipse cx="75" cy="50" rx="45" ry="10" fill="#9a5b2c" stroke="#2a1c16" stroke-width="4"/><path d="M120 70 Q150 80 118 110" fill="none" stroke="#2a1c16" stroke-width="6"/></svg>`,
  };

  // ---------- build scenes ----------
  const scenes = D.scenes.map((sc, si) => {
    const root = el('div', 'scene', stage);
    const cam = el('div', 'cam', root);
    const bg = BG.make(sc.set.type, sc.set);
    const layers = bg.layers.map(L => { const d = el('div', 'layer', cam, L.svg); if (L.blur) d.style.filter = `blur(${L.blur}px)`; d._depth = L.depth; return d; });
    if (sc.set.tod === 'night' && sc.set.type !== 'mansion') layers.forEach(d => { if (d._depth > 0) d.style.filter = (d.style.filter || '') + ' brightness(.62) saturate(.85)'; });
    const fans = [...cam.querySelectorAll('.fan')], flames = [...cam.querySelectorAll('.flame')], twinkles = [...cam.querySelectorAll('.twinkle')].filter((_, i) => i % 4 === 0), steams = [...cam.querySelectorAll('.steam')], clouds = [...cam.querySelectorAll('.cloud')];
    const charLayer = el('div', 'chars', cam);
    const cast = (sc.cast || []).map((c, ci) => {
      const spec = { ...(D.characters?.[c.id] || {}), ...(c.spec || {}), seed: ci + si * 3 };
      const rig = CH.build(spec);
      const box = el('div', 'char', charLayer, rig.svg);
      const svg = box.firstElementChild; svg.style.width = '100%'; svg.style.height = '100%';
      CH.attach(rig, box);
      const hgt = c.h || (spec.age === 'child' ? 520 : 720);
      box.style.width = hgt * 520 / 1012 + 'px'; box.style.height = hgt + 'px';
      const shadow = el('div', 'cshadow', charLayer);
      const spot = v => typeof v === 'number' ? v : (bg.spots[v] ?? 960);
      const track = (c.track || [{ t: 0 }]).map(k => ({ ...k, x: k.x != null ? spot(k.x) : undefined }));
      return { c, rig, box, shadow, hgt, track, x0: spot(c.x ?? 'center'), floor: c.floor ?? bg.floorY, flip: !!c.flip };
    });
    // overlays (world space and screen space)
    const world = el('div', 'world', cam), screen = el('div', 'screen', root);
    const ovs = (sc.overlays || []).map(o => buildOverlay(o, o.space === 'world' ? world : screen, cast));
    const fx = el('div', 'fx', root);
    const dust = [];
    if (sc.fx?.dust) { const r = rng(si + 7); for (let i = 0; i < 45; i++) { const p = el('i', 'mote', fx); dust.push({ p, x: r() * W, y: r() * H, s: r(), ph: r() * 6 }); } }
    if (sc.fx?.glow) { const g = el('div', 'glow', fx); g.style.background = `radial-gradient(ellipse at ${sc.fx.glow.x || 50}% ${sc.fx.glow.y || 30}%, ${sc.fx.glow.color || 'rgba(255,220,150,.35)'}, transparent 60%)`; }
    const grade = el('div', 'grade', root); grade.style.background = sc.grade || (sc.set.tod === 'night' ? 'linear-gradient(rgba(40,60,160,.28), rgba(10,20,80,.32))' : bg.warm ? 'linear-gradient(rgba(255,180,90,.10), rgba(120,60,20,.12))' : 'transparent');
    return { sc, root, cam, layers, cast, ovs, dust, fans, flames, twinkles, steams, clouds, bg, si, start: sc.start, end: sc.end };
  });

  // ---------- overlays ----------
  function buildOverlay(o, parent, cast) {
    const node = el('div', 'ov ov-' + o.type, parent);
    if (o.type === 'nametag') node.innerHTML = `<div class="nt-title">${o.text}</div>${o.sub ? `<div class="nt-sub">${o.sub}</div>` : ''}`;
    else if (o.type === 'tag') node.innerHTML = `<div>${o.text}</div>`;
    else if (o.type === 'year') node.innerHTML = `<div>${o.text}</div>`;
    else if (o.type === 'title') node.innerHTML = `<div>${o.text}</div>`;
    else if (o.type === 'bubble') node.innerHTML = `<div class="bb">${o.text}</div>`;
    else if (o.type === 'callout') {
      const [lx, ly] = o.label, [tx, ty] = o.to;
      const mx = (lx + tx) / 2 + (o.bend ?? 60), my = Math.min(ly, ty) - 40;
      node.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="position:absolute;left:0;top:0;overflow:visible">
        <path class="ar" d="M${lx} ${ly + 26} Q${mx} ${my + 60} ${tx} ${ty}" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" style="filter:drop-shadow(0 2px 0 rgba(0,0,0,.6))"/>
        <path class="ah" d="M${tx} ${ty} l-14 -26 M${tx} ${ty} l20 -18" stroke="#fff" stroke-width="6" stroke-linecap="round" opacity="0" style="filter:drop-shadow(0 2px 0 rgba(0,0,0,.6))"/></svg>
        <div class="cl" style="left:${lx}px;top:${ly}px">${o.text}</div>`;
      node.style.inset = '0';
    } else if (o.type === 'inset') node.innerHTML = `<div class="ins-in">${PROPS[o.prop] || o.svg || ''}</div>`;
    else if (o.type === 'card') node.innerHTML = `<div class="card-in"><div class="card-sub">${o.kicker || ''}</div>${o.strike ? `<div class="card-strike">${o.strike}</div>` : ''}<div class="card-title">${o.text}</div><div class="card-desc">${o.sub || ''}</div>${o.stamp ? `<div class="card-stamp">${o.stamp}</div>` : ''}</div>`;
    else if (o.type === 'counter') node.innerHTML = `<div class="cn-l">${o.label || ''}</div><div class="cn-n"></div>`;
    else if (o.type === 'prop') node.innerHTML = PROPS[o.prop] || '';
    if (o.x != null && o.type !== 'callout') { node.style.left = o.x + 'px'; node.style.top = o.y + 'px'; }
    if (o.w) node.style.width = o.w + 'px';
    return { o, node };
  }
  function updateOverlay(ov, lt) {
    const o = ov.o, d = lt - o.t, dur = o.dur ?? 3.2, end = o.t + dur;
    const out = o.keep ? 1 : clamp((end - lt) / .3, 0, 1);
    if (d < 0 || (!o.keep && lt > end)) { ov.node.style.opacity = 0; return; }
    const n = ov.node;
    n.style.opacity = Math.min(clamp(d / .15, 0, 1), out);
    if (o.type === 'callout') {
      const ar = n.querySelector('.ar'), ah = n.querySelector('.ah'), cl = n.querySelector('.cl');
      ar.style.strokeDashoffset = 1 - ease((d - .15) / .5); ah.style.opacity = d > .6 ? 1 : 0;
      cl.style.transform = `translate(-50%,-50%) scale(${lerp(.3, 1, back(d / .3))}) rotate(-4deg)`;
    } else if (o.type === 'inset') n.style.transform = `translate(-50%,-50%) scale(${lerp(.2, 1, back(d / .35))})`;
    else if (o.type === 'card') n.style.transform = `translate(-50%,-50%) scale(${lerp(1.06, 1, ease(d / .6))}) rotate(${o.rot ?? -1.5}deg)`;
    else if (o.type === 'title') { n.style.transform = `translate(-50%,-50%) scale(${lerp(1.6, 1, back(d / .35))})`; }
    else if (o.type === 'counter') { const p = ease((d - .1) / 1.2); n.querySelector('.cn-n').textContent = (o.prefix || '') + Math.round(o.value * p).toLocaleString('en-IN') + (o.suffix || ''); n.style.transform = `translate(-50%,-50%) scale(${lerp(.6, 1, back(d / .3))})`; }
    else if (o.type === 'prop') n.style.transform = `translate(-50%,-50%) translateY(${(1 - back(d / .4)) * 60}px) rotate(${(o.rot || 0) + Math.sin(lt * 1.5) * 1.5}deg)`;
    else n.style.transform = `translate(-50%,-50%) scale(${lerp(.4, 1, back(d / .3))}) rotate(${o.rot ?? (o.type === 'nametag' ? -3 : 0)}deg)`;
  }

  // ---------- characters ----------
  function updateChar(C, lt, t, S) {
    const tr = C.track;
    let i = 0; for (let k = 0; k < tr.length; k++) if (lt >= tr[k].t) i = k;
    const k = tr[i], pk = tr[i - 1];
    // position (walk between keys with x)
    let x = C.x0; let walking = false;
    for (let j = 0; j <= i; j++) if (tr[j].x != null) {
      const from = j === 0 ? C.x0 : (() => { let px = C.x0; for (let q = 0; q < j; q++) if (tr[q].x != null) px = tr[q].x; return px; })();
      const dur = tr[j].walk ?? Math.max(.6, Math.abs(tr[j].x - from) / 260);
      const q = clamp((lt - tr[j].t) / dur, 0, 1); x = lerp(from, tr[j].x, ease(q)); if (j === i && q < 1) walking = true;
    }
    const facing = k.flip != null ? k.flip : C.flip;
    const bob = walking ? Math.abs(Math.sin(lt * 7)) * -10 : 0;
    C.box.style.transform = `translate(${x - C.box.offsetWidth / 2}px, ${C.floor - C.hgt + bob}px) scaleX(${facing ? -1 : 1})`;
    C.shadow.style.transform = `translate(${x - C.hgt * .2}px, ${C.floor - 14}px)`; C.shadow.style.width = C.hgt * .4 + 'px';
    // talk
    let talking = false; for (const r of C.c.talk || []) if (lt >= r[0] && lt <= r[1]) talking = true;
    let word = '', frac = 0;
    if (talking) for (const w of S.sc.words || []) if (t >= w.start && t < w.end) { word = w.w; frac = (t - w.start) / (w.end - w.start); }
    const amp = talking ? amplitude(t) : 0;
    const pose = walking ? 'stand' : (k.pose || 'stand'), prev = pk ? (pk.pose || 'stand') : null;
    const blinkC = (t + C.rig.spec.seed * 1.37) % 3.9;
    CH.update(C.rig, { t, pose, prevPose: prev, poseT: ease((lt - k.t) / .4), expr: k.expr || 'neutral', talking, amp, viseme: talking ? viseme(word, frac, amp) : null, blink: blinkC < .13, look: k.look || 0 });
  }

  // ---------- camera ----------
  function camera(S, lt) {
    const keys = S.sc.camera || [{ t: 0, z: 1, x: 960, y: 540 }];
    let i = 0; for (let k = 0; k < keys.length; k++) if (lt >= keys[k].t) i = k;
    const a = keys[i], b = keys[i + 1];
    let z = a.z ?? 1, x = a.x ?? 960, y = a.y ?? 540;
    if (b && b.ease !== 'cut') { const p = ease((lt - a.t) / Math.max(.1, (b.t - a.t))); if (a.hold === false || b.move) { z = lerp(z, b.z ?? z, p); x = lerp(x, b.x ?? x, p); y = lerp(y, b.y ?? y, p); } }
    const drift = a.drift ?? .02; z *= 1 + drift * Math.min(1, lt / Math.max(1, S.end - S.start));
    return { z, x, y };
  }

  const subs = document.getElementById('subs'), fade = document.getElementById('fade'), flash = document.getElementById('flash');
  window.__ready = false;
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { window.__ready = true; });

  window.renderAt = function (t) {
    let S = scenes[0]; for (const s of scenes) if (t >= s.start) S = s;
    for (const s of scenes) s.root.style.display = s === S ? 'block' : 'none';
    const lt = t - S.start;
    const cam = camera(S, lt);
    // parallax: layers shift with camera focus; whole cam scales around focus
    const ox = (cam.x - 960), oy = (cam.y - 540);
    S.cam.style.transform = `translate(${W / 2}px, ${H / 2}px) scale(${cam.z}) translate(${-cam.x}px, ${-cam.y}px)`;
    S.layers.forEach(d => { const f = 1 - d._depth; d.style.transform = `translate(${ox * f * .35}px, ${oy * f * .2}px)`; });
    S.fans.forEach(f => f.setAttribute('transform', `scale(${Math.cos(t * 7.3)} 1)`));
    S.flames.forEach((f, i) => f.setAttribute('transform', `scale(1 ${1 + Math.sin(t * 13 + i) * .12})`));
    S.twinkles.forEach((s, i) => s.setAttribute('opacity', .3 + .7 * Math.abs(Math.sin(t * 1.3 + i))));
    S.steams.forEach((s, i) => s.setAttribute('transform', `translate(${Math.sin(t * 2 + i) * 4} ${-(t * 10 % 12)})`));
    S.clouds.forEach((c, i) => c.setAttribute('transform', `translate(${(t * (6 + i % 3 * 3)) % 200} 0)`));
    S.cast.forEach(C => updateChar(C, lt, t, S));
    S.ovs.forEach(ov => updateOverlay(ov, lt));
    S.dust.forEach(d => { d.p.style.transform = `translate(${d.x + Math.sin(t * .4 + d.ph) * 40}px, ${d.y + Math.cos(t * .3 + d.ph) * 30}px) scale(${.6 + d.s})`; d.p.style.opacity = .25 + .5 * Math.abs(Math.sin(t * .8 + d.ph)); });
    // subtitles
    const ws = S.sc.words || []; let gi = -1; for (let i = 0; i < ws.length; i++) if (t >= ws[i].start - .03) gi = i;
    if (gi >= 0 && t < ws[ws.length - 1].end + .35 && D.subtitles !== false) { const g0 = Math.floor(gi / 7) * 7; subs.innerHTML = ws.slice(g0, g0 + 7).map((w, k) => `<span class="${g0 + k === gi ? 'on' : g0 + k < gi ? 'said' : ''}">${w.w}</span>`).join(' '); subs.style.opacity = 1; }
    else subs.style.opacity = 0;
    // transitions: dip at scene start, flash markers
    const fin = clamp(1 - lt / .35, 0, 1) * (S.si ? .9 : 1);
    fade.style.opacity = Math.max(fin, clamp((t - (D.duration - 1)) / 1, 0, 1));
    let fl = 0; for (const f of S.sc.flash || []) fl = Math.max(fl, clamp(1 - Math.abs(lt - f) / .22, 0, 1));
    flash.style.opacity = fl * .95;
    document.getElementById('grain').style.transform = `translate(${(Math.floor(t * 24) * 37) % 50 - 25}px,${(Math.floor(t * 24) * 53) % 50 - 25}px)`;
    return true;
  };
})();
