/* Explainer Factory — deterministic frame engine.
   window.renderAt(t) draws the exact frame for time t (seconds). */
(function () {
  const D = window.DATA;
  const W = D.w, H = D.h;
  const stage = document.getElementById('stage');
  stage.style.width = W + 'px';
  stage.style.height = H + 'px';
  const PAL = D.palette, CAPC = D.captionColors;
  const TR = 0.38; // transition length

  // ---------- helpers ----------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, p) => a + (b - a) * p;
  const easeOut = p => 1 - Math.pow(1 - clamp(p, 0, 1), 3);
  const easeInOut = p => { p = clamp(p, 0, 1); return p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; };
  const easeBack = p => { p = clamp(p, 0, 1); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2); };
  const bounce = p => {
    p = clamp(p, 0, 1); const n1 = 7.5625, d1 = 2.75;
    if (p < 1 / d1) return n1 * p * p;
    if (p < 2 / d1) return n1 * (p -= 1.5 / d1) * p + .75;
    if (p < 2.5 / d1) return n1 * (p -= 2.25 / d1) * p + .9375;
    return n1 * (p -= 2.625 / d1) * p + .984375;
  };
  function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
  function hex(c) { c = PAL[c] || c || '#888'; const m = String(c).match(/rgba?\(([^)]+)\)/); if (m) return m[1].split(',').slice(0, 3).map(v => parseFloat(v)); c = c.replace('#', ''); if (c.length === 3) c = c.split('').map(x => x + x).join(''); return [0, 2, 4].map(i => parseInt(c.substr(i, 2), 16)); }
  function shade(c, amt) { // amt -1..1
    const [r, g, b] = hex(c); const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    return `rgb(${Math.round(lerp(r, t, p))},${Math.round(lerp(g, t, p))},${Math.round(lerp(b, t, p))})`;
  }
  function rgba(c, a) { const [r, g, b] = hex(c); return `rgba(${r},${g},${b},${a})`; }
  function el(tag, cls, parent) { const e = document.createElement(tag); if (cls) e.className = cls; if (parent) parent.appendChild(e); return e; }
  let uid = 0;
  function uniqueSvg(svg) { // unique ids per instance so hidden scenes never break gradients
    const n = 'i' + (uid++);
    const ids = [...new Set([...svg.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]))].sort((a, b) => b.length - a.length);
    for (const id of ids) {
      const esc = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      svg = svg.replace(new RegExp(`(\\sid=")${esc}"`, 'g'), `$1${id}-${n}"`)
        .replace(new RegExp(`#${esc}([)"'])`, 'g'), `#${id}-${n}$1`);
    }
    return svg;
  }

  // ---------- backgrounds ----------
  function buildBg(parent, bg, seed) {
    const b = el('div', 'bg', parent);
    const c = bg.color || 'mustard';
    if (bg.type === 'wall') {
      b.style.background = [
        `radial-gradient(ellipse 70% 45% at 50% 48%, rgba(255,240,205,.30), transparent 70%)`,
        `linear-gradient(to bottom, rgba(0,0,0,.28), transparent 22%, transparent 70%, rgba(0,0,0,.30))`,
        `repeating-linear-gradient(90deg, transparent 0 352px, rgba(0,0,0,.13) 352px 355px, rgba(255,255,255,.09) 355px 359px, transparent 359px 540px)`,
        `linear-gradient(${shade(c, .06)}, ${shade(c, -.12)})`].join(',');
      el('div', 'rivets', b);
    } else if (bg.type === 'night') {
      b.style.background = `radial-gradient(ellipse 80% 50% at 50% 35%, ${rgba(shade(c === 'mustard' ? 'purple' : c, .1), .55)}, transparent 70%), linear-gradient(#0b0f2a, #231a4e 55%, #3d2763)`;
      const s = el('div', 'stars', b), r = rng(seed);
      for (let i = 0; i < 70; i++) { const st = el('i', '', s); const z = 1 + r() * 3.5; st.style.cssText = `left:${r() * 100}%;top:${r() * 55}%;width:${z}px;height:${z}px;opacity:${.3 + r() * .7}`; }
    } else if (bg.type === 'sunset') {
      b.style.background = `radial-gradient(ellipse 60% 30% at 50% 62%, rgba(255,210,140,.55), transparent 70%), linear-gradient(#2a1c4c, #6e3466 38%, #d8704a 66%, #f2c46a 85%)`;
    } else if (bg.type === 'dark') {
      b.style.background = `radial-gradient(ellipse 65% 45% at 50% 46%, ${shade(c, -.25)}, #0d0906 78%)`;
    } else { // sky
      b.style.background = `radial-gradient(ellipse 60% 35% at 50% 30%, rgba(255,255,255,.6), transparent 70%), linear-gradient(#7cc0e4, #d8ecef 62%, ${PAL.cream || '#f1e3c2'})`;
    }
    if (bg.floor) {
      const f = el('div', 'floor', b);
      const fc = bg.type === 'wall' ? shade(c, -.38) : bg.type === 'night' ? '#1a1430' : shade('terracotta', -.35);
      f.style.background = `linear-gradient(${shade(fc, .18)} 0 6px, ${fc} 6px, ${shade(fc, -.35)})`;
    }
    return b;
  }

  // ---------- widgets ----------
  function parseNum(v) {
    const m = String(v).match(/^(\D*?)([\d][\d,\.]*)(.*)$/);
    if (!m) return null;
    const raw = m[2], dec = (raw.split('.')[1] || '').length;
    return { pre: m[1], raw, num: parseFloat(raw.replace(/,/g, '')), dec, suf: m[3] };
  }
  function formatLike(raw, value, dec) {
    const digitsTotal = raw.replace(/[^\d]/g, '').length;
    let s = value.toFixed(dec).replace('.', '');
    s = s.padStart(digitsTotal, '0').slice(-digitsTotal);
    let out = '', k = 0;
    for (const ch of raw) out += /\d/.test(ch) ? s[k++] : ch;
    return out;
  }
  function buildWidget(parent, w, sceneIdx, accent) {
    const x = (w.x ?? 50) / 100 * W, y = (w.y ?? 55) / 100 * H;
    const node = el('div', 'w', parent);
    const obj = { w, node, x, y, t: w.t, kind: w.type };
    if (w.type === 'counter') {
      node.classList.add('w-counter');
      if (w.label) el('div', 'label', node).textContent = w.label;
      const board = el('div', 'board', node);
      const p = parseNum(w.value);
      obj.p = p; obj.cells = [];
      const str = p ? p.raw : String(w.value);
      if (p && p.pre.trim()) { const s = el('div', 'tile suffix', board); s.textContent = p.pre.trim(); }
      for (const ch of str) {
        const c = el('div', /\d/.test(ch) ? 'tile' : 'sep', board); c.textContent = ch; obj.cells.push(c);
      }
      if (p && p.suf.trim()) { const s = el('div', 'tile suffix', board); s.textContent = p.suf.trim(); }
    } else if (w.type === 'paper') {
      node.classList.add('w-paper');
      el('div', 'tape', node);
      if (w.source) el('div', 'src', node).textContent = w.source;
      el('div', 'title', node).textContent = w.title || '';
      el('div', 'line', node).style.width = '92%';
      el('div', 'line', node).style.width = '80%';
      const hl = el('div', 'hl', node);
      obj.mark = el('div', 'mark', hl);
      el('span', '', hl).textContent = w.highlight || '';
      el('div', 'line', node).style.width = '88%';
      el('div', 'line', node).style.width = '60%';
      obj.rot = -2.5 + (sceneIdx % 3) * 1.8;
    } else if (w.type === 'bars') {
      node.classList.add('w-bars');
      const items = (w.items || []).slice(0, 4);
      const max = Math.max(1, ...items.map(i => +i.value || 0));
      const cols = ['terracotta', 'teal', 'mustard', 'purple'];
      obj.bars = items.map((it, i) => {
        const b = el('div', 'bar', node);
        b.style.background = `linear-gradient(90deg, ${shade(cols[i], .12)}, ${shade(cols[i], -.15)})`;
        const v = el('div', 'val', b); el('div', 'lab', b).textContent = it.label || '';
        return { b, v, frac: (+it.value || 0) / max, val: +it.value || 0, raw: String(it.value) };
      });
    } else if (w.type === 'clock') {
      node.classList.add('w-clock');
      el('div', 'rim', node);
      const face = el('div', 'face', node);
      obj.lost = el('div', 'lost', face);
      for (let i = 0; i < 12; i++) { const t = el('div', 'tick', face); t.style.transform = `rotate(${i * 30}deg)`; if (i % 3) t.style.height = '22px'; }
      obj.hh = el('div', 'hand hh', face); obj.mh = el('div', 'hand mh', face); el('div', 'pin', face);
      const hm = s => { const [h, m] = String(s || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
      obj.from = hm(w.from || '20:00'); obj.to = hm(w.to || '02:00');
      if (obj.to <= obj.from) obj.to += 720 * (obj.to + 720 <= obj.from ? 2 : 1);
    } else if (w.type === 'particles') {
      node.className = 'particles';
      obj.x = 0; obj.y = 0;
      const kind = w.kind || 'dust', r = rng(1000 + sceneIdx * 31);
      const count = { smoke: 18, rain: 70, snow: 60, sparks: 40, embers: 40, bubbles: 26, dust: 45 }[kind] || 40;
      obj.parts = [];
      for (let i = 0; i < count; i++) {
        const p = el('i', '', node);
        const d = { x: r() * W, y: r() * H, s: r(), ph: r() * 6.28, v: .5 + r() };
        if (kind === 'smoke') { const z = 140 + d.s * 160; p.style.cssText = `width:${z}px;height:${z}px;background:radial-gradient(circle, rgba(215,210,205,.22), transparent 65%)`; d.x = W * (.35 + r() * .3); }
        else if (kind === 'rain') { p.style.cssText = `width:4px;height:${60 + d.s * 50}px;border-radius:3px;background:rgba(200,220,255,.45)`; }
        else if (kind === 'snow') { const z = 6 + d.s * 12; p.style.cssText = `width:${z}px;height:${z}px;background:rgba(255,255,255,.85)`; }
        else if (kind === 'sparks' || kind === 'embers') { const z = 5 + d.s * 9; p.style.cssText = `width:${z}px;height:${z}px;background:#ffb04d;box-shadow:0 0 14px 4px rgba(255,120,40,.7)`; }
        else if (kind === 'bubbles') { const z = 18 + d.s * 50; p.style.cssText = `width:${z}px;height:${z}px;border:3px solid rgba(255,255,255,.55);background:rgba(255,255,255,.08)`; }
        else { const z = 3 + d.s * 6; p.style.cssText = `width:${z}px;height:${z}px;background:rgba(255,240,210,.7);box-shadow:0 0 8px rgba(255,230,180,.6)`; }
        obj.parts.push({ p, d });
      }
    }
    return obj;
  }

  function updateWidget(o, t, sceneT0) {
    const lt = t - o.t;
    if (o.kind === 'particles') {
      const kind = o.w.kind || 'dust';
      const vis = clamp((t - sceneT0) / .6, 0, 1);
      for (const { p, d } of o.parts) {
        let x = d.x, y = d.y, op = 1, sc = 1;
        const T = t - sceneT0 + 10;
        if (kind === 'smoke') { const cyc = ((T * (0.08 + d.s * .05) + d.ph) % 1); y = H * (.82 - cyc * .55); x = d.x + Math.sin(T * .5 + d.ph) * 60; sc = .6 + cyc * 1.2; op = Math.sin(cyc * Math.PI); }
        else if (kind === 'rain') { y = ((d.y + T * (1700 + d.v * 500)) % (H + 200)) - 100; x = d.x - (y * .08); op = .8; }
        else if (kind === 'snow') { y = ((d.y + T * (70 + d.v * 60)) % (H + 40)) - 20; x = d.x + Math.sin(T * 1.2 + d.ph) * 30; }
        else if (kind === 'sparks' || kind === 'embers') { const cyc = ((T * (.15 + d.v * .15) + d.ph) % 1); y = H * (1 - cyc); x = d.x + Math.sin(T * 2 + d.ph) * 40; op = Math.sin(cyc * Math.PI); }
        else if (kind === 'bubbles') { y = H + 60 - ((d.y + T * (120 + d.v * 90)) % (H + 120)); x = d.x + Math.sin(T * 1.5 + d.ph) * 25; op = .8; }
        else { x = d.x + Math.sin(T * .3 + d.ph) * 50; y = d.y + Math.cos(T * .25 + d.ph) * 40; op = .4 + .6 * Math.abs(Math.sin(T * .8 + d.ph)); }
        p.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%) scale(${sc})`;
        p.style.opacity = op * vis;
      }
      return;
    }
    if (lt < 0) { o.node.style.opacity = 0; return; }
    let tf = `translate(${o.x}px,${o.y}px) translate(-50%,-50%)`;
    const pe = lt / .5;
    if (o.kind === 'paper') {
      const p = easeOut(lt / .55), b = bounce(lt / .7);
      tf += ` translateY(${(1 - b) * -900}px) rotate(${lerp(-14, o.rot, p)}deg)`;
      o.mark.style.width = (easeInOut((lt - .7) / .6) * 100) + '%';
      o.node.style.opacity = 1;
    } else {
      tf += ` scale(${lerp(.3, 1, easeBack(pe))})`;
      o.node.style.opacity = clamp(pe * 3, 0, 1);
    }
    tf += ` translateY(${Math.sin(lt * 1.5) * 6}px)`;
    o.node.style.transform = tf;
    if (o.kind === 'counter' && o.p) {
      const p = easeOut((lt - .1) / 1.05);
      const str = formatLike(o.p.raw, o.p.num * p, o.p.dec);
      o.cells.forEach((c, i) => { c.textContent = str[i]; });
    } else if (o.kind === 'bars') {
      o.bars.forEach((b, i) => {
        const p = easeOut((lt - .15 - i * .15) / .9);
        b.b.style.height = (Math.max(.04, b.frac * p) * 600) + 'px';
        const v = b.val * p; b.v.textContent = (b.raw.includes('.') ? v.toFixed(1) : Math.round(v)) + (b.raw.match(/[^\d.,]+$/) || [''])[0];
      });
    } else if (o.kind === 'clock') {
      const p = easeInOut((lt - .2) / 1.6);
      const m = lerp(o.from, o.to, p);
      const a0 = (o.from % 720) / 2, sweep = (m - o.from) / 2;
      o.hh.style.transform = `rotate(${(m % 720) / 2}deg)`;
      o.mh.style.transform = `rotate(${(m % 60) * 6}deg)`;
      o.lost.style.background = `conic-gradient(from ${a0}deg, rgba(200,50,58,.55) 0deg ${Math.min(360, sweep)}deg, transparent ${Math.min(360, sweep)}deg)`;
    }
  }

  // ---------- elements ----------
  function buildElement(parent, e) {
    const node = el('div', 'el', parent);
    const width = e.w / 100 * W;
    node.style.width = width + 'px';
    const inner = el('div', 'inner', node);
    inner.innerHTML = uniqueSvg(e.svg);
    if (e.flip) inner.style.transform = 'scaleX(-1)';
    const svg = inner.querySelector('svg');
    if (svg && svg.pauseAnimations) { try { svg.pauseAnimations(); } catch (_) { } }
    return { e, node, inner, svg, x: e.x / 100 * W, y: e.y / 100 * H, h: width * (e.aspect || 1) };
  }

  function updateElement(o, t, accent) {
    const e = o.e, lt = t - e.t;
    if (lt < 0) { o.node.style.opacity = 0; return; }
    let tx = 0, ty = 0, s = 1, rot = 0, op = 1, clip = '';
    const p = lt / .5;
    switch (e.enter) {
      case 'pop': s = lerp(.25, 1, easeBack(p)); op = clamp(p * 3, 0, 1); break;
      case 'zoom': s = lerp(1.6, 1, easeOut(p)); op = clamp(p * 2, 0, 1); break;
      case 'slide_left': tx = (1 - easeOut(p)) * 800; op = clamp(p * 2, 0, 1); break;
      case 'slide_right': tx = (1 - easeOut(p)) * -800; op = clamp(p * 2, 0, 1); break;
      case 'drop': ty = (1 - bounce(lt / .75)) * -1100; break;
      case 'rise': ty = (1 - easeOut(p)) * 520; op = clamp(p * 2, 0, 1); break;
      case 'fade': op = clamp(lt / .7, 0, 1); break;
      case 'draw': clip = `inset(0 ${(1 - easeInOut(lt / .8)) * 100}% 0 0)`; break;
    }
    let sx = 1, sy = 1;
    switch (e.motion) {
      case 'float': ty += Math.sin(lt * 1.6) * 12; break;
      case 'bob': ty -= Math.abs(Math.sin(lt * 2.8)) * 16; break;
      case 'pulse': s *= 1 + .035 * Math.sin(lt * 4.2); break;
      case 'breathe': sy = 1 + .022 * Math.sin(lt * 1.9); sx = 1 - .01 * Math.sin(lt * 1.9); break;
      case 'shake': tx += Math.sin(lt * 41) * 4 + Math.sin(lt * 27) * 3; rot += Math.sin(lt * 33) * .6; break;
      case 'sway': rot += Math.sin(lt * 1.4) * 3; break;
      case 'spin': rot += lt * 45; break;
    }
    o.node.style.transform = `translate(${o.x + tx}px,${o.y + ty}px) translate(-50%,-50%) rotate(${rot}deg) scale(${s * sx},${s * sy})`;
    o.node.style.opacity = op;
    o.node.style.clipPath = clip;
    let filt = 'drop-shadow(0 22px 20px rgba(0,0,0,.38))';
    if (e.motion === 'glow') filt += ` drop-shadow(0 0 ${26 + 14 * Math.sin(lt * 3.2)}px ${rgba(CAPC[accent] || '#ff9a4d', .75)})`;
    o.node.style.filter = filt;
    if (o.svg && o.svg.setCurrentTime) { try { o.svg.setCurrentTime(Math.max(0, lt)); } catch (_) { } }
  }

  // ---------- captions ----------
  function fit(node, maxW, minSize) {
    let size = parseFloat(getComputedStyle(node).fontSize);
    const over = () => node.scrollWidth > node.clientWidth + 1;
    while (over() && size > minSize) { size -= 4; node.style.fontSize = size + 'px'; }
    if (over()) { node.style.whiteSpace = 'normal'; }
  }

  // ---------- build all scenes ----------
  const scenes = D.scenes.map((sc, i) => {
    const root = el('div', 'scene', stage);
    const cam = el('div', 'cam', root);
    buildBg(cam, sc.background, 11 + i * 7);
    const items = [];
    const els = sc.elements.map(e => buildElement(cam, e));
    const wids = sc.widgets.map(w => buildWidget(w.type === 'particles' ? root : cam, w, i, sc.accent));
    const caps = el('div', 'caps', root);
    const top = el('div', 'cap cap-top', caps); top.textContent = sc.caption_top || '';
    const main = el('div', 'cap cap-main', caps); main.textContent = sc.caption_main || '';
    const col = CAPC[sc.accent] || '#FF9A4D';
    main.style.color = col;
    main.style.textShadow = `0 6px 0 rgba(40,20,8,.55), 0 0 4px rgba(40,20,8,.6), 0 0 38px ${rgba(col, .6)}`;
    return { sc, root, cam, els, wids, top, main, col, items };
  });

  const grain = el('div', 'overlay grain', stage);
  grain.style.backgroundImage = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='300' height='300' filter='url(%23n)'/></svg>")`;
  el('div', 'overlay crease', stage);
  el('div', 'overlay vignette', stage);
  const flash = el('div', 'overlay flash', stage);

  function updateScene(S, t) {
    const sc = S.sc, dur = Math.max(.5, sc.end - sc.start), p = clamp((t - sc.start) / dur, 0, 1.2);
    // camera
    let cs = 1, cx = 0, cy = 0;
    const e = easeInOut(p);
    switch (sc.camera) {
      case 'zoom_in': cs = 1.0 + .08 * e; break;
      case 'zoom_out': cs = 1.09 - .08 * e; break;
      case 'pan_left': cs = 1.07; cx = lerp(40, -40, e); break;
      case 'pan_right': cs = 1.07; cx = lerp(-40, 40, e); break;
      case 'push': cs = 1 + .13 * Math.pow(p, 1.6); break;
      default: cs = 1.02;
    }
    cx += Math.sin(t * .7) * 4; cy += Math.cos(t * .53) * 3;
    S.cam.style.transform = `translate(${cx}px,${cy}px) scale(${cs})`;
    for (const o of S.els) updateElement(o, t, sc.accent);
    for (const o of S.wids) updateWidget(o, t, sc.start);
    // captions
    const tp = (t - sc.start - .06) / .32;
    S.top.style.opacity = clamp(tp, 0, 1);
    S.top.style.transform = `translateY(${(1 - easeOut(tp)) * 34}px)`;
    const mp = (t - sc.main_t) / .28;
    S.main.style.opacity = clamp(mp * 2, 0, 1);
    S.main.style.transform = `scale(${mp <= 0 ? 1.35 : lerp(1.35, 1, easeBack(mp))})`;
  }

  // ---------- fit captions once fonts are ready ----------
  window.__ready = false;
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
    for (const S of scenes) {
      S.root.style.display = 'block';
      fit(S.top, W - 160, 44); fit(S.main, W - 160, 64);
      S.root.style.display = 'none';
    }
    window.__ready = true;
  });

  let shown = [];
  window.renderAt = function (t) {
    // which scene is current (incl. incoming transition that starts slightly before scene start)
    let idx = 0;
    for (let i = 0; i < scenes.length; i++) if (t >= scenes[i].sc.start - .1) idx = i;
    const cur = scenes[idx];
    const ts = cur.sc.start - .1;
    const inTr = idx > 0 && t < ts + TR;
    const prev = inTr ? scenes[idx - 1] : null;
    const want = prev ? [prev, cur] : [cur];
    for (const S of shown) if (!want.includes(S)) S.root.style.display = 'none';
    for (const S of want) { S.root.style.display = 'block'; S.root.style.transform = ''; S.root.style.opacity = 1; S.root.style.filter = ''; S.root.style.zIndex = S === cur ? 2 : 1; }
    shown = want;
    flash.style.opacity = 0;
    if (prev) {
      const p = easeInOut((t - ts) / TR), kind = cur.sc.transition;
      if (kind === 'slide_left') { cur.root.style.transform = `translateX(${(1 - p) * 100}%)`; prev.root.style.transform = `translateX(${-p * 35}%)`; prev.root.style.filter = `brightness(${1 - p * .4})`; }
      else if (kind === 'slide_up') { cur.root.style.transform = `translateY(${(1 - p) * 100}%)`; prev.root.style.transform = `translateY(${-p * 30}%)`; prev.root.style.filter = `brightness(${1 - p * .4})`; }
      else if (kind === 'zoom') { cur.root.style.transform = `scale(${1.25 - .25 * p})`; cur.root.style.opacity = p; prev.root.style.transform = `scale(${1 + .2 * p})`; }
      else if (kind === 'flash') { const raw = (t - ts) / TR; if (raw < .4) cur.root.style.opacity = 0; flash.style.opacity = Math.max(0, 1 - Math.abs(raw - .4) / .45) * .9; }
      else { cur.root.style.opacity = p; }
      updateScene(prev, t);
    }
    updateScene(cur, t);
    grain.style.transform = `translate(${(Math.floor(t * 24) * 37) % 50 - 25}px, ${(Math.floor(t * 24) * 53) % 50 - 25}px)`;
    return true;
  };
})();
