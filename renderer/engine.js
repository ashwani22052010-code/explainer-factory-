/* Explainer Factory — deterministic frame engine.
   window.renderAt(t) draws the exact frame for time t (seconds). */
(function () {
  const D = window.DATA;
  const W = D.w, H = D.h;
  const stage = document.getElementById('stage');
  stage.style.width = W + 'px';
  stage.style.height = H + 'px';
  const PAL = D.palette, CAPC = D.captionColors;
  const STORY = D.mode === 'story';
  stage.classList.add(STORY ? 'mode-story' : 'mode-short');
  const ENV = D.env || [];
  const envAt = t => { const i = Math.floor(t * D.fps); return ENV[Math.max(0, Math.min(ENV.length - 1, i))] || 0; };
  const IMPACTS = D.impacts || [];
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
    } else if (w.type === 'sign') {
      node.classList.add('w-sign');
      el('div', 'board', node).textContent = w.text || '';
      if (w.sub) el('div', 'sub', node).textContent = w.sub;
    } else if (w.type === 'tag') {
      node.classList.add('w-tag', 'dir-' + (w.dir || 'down'));
      el('div', 'label', node).textContent = w.text || '';
      el('div', 'arrow', node);
    } else if (w.type === 'bubble') {
      node.classList.add('w-bubble', 'tail-' + (w.tail || 'left'));
      el('div', 'txt', node).textContent = w.text || '';
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
    if (o.nw == null) { o.nw = o.node.offsetWidth; o.nh = o.node.offsetHeight; }
    const px = clamp(o.x, o.nw / 2 + 24, W - o.nw / 2 - 24), py = clamp(o.y, o.nh / 2 + 24, H - o.nh / 2 - 24);
    let tf = `translate(${px}px,${py}px) translate(-50%,-50%)`;
    const pe = lt / .5;
    if (o.kind === 'sign') {
      tf += ` translateY(${(1 - easeBack(lt / .5)) * -260}px) rotate(${Math.sin(lt * 2.2) * 1.2 * Math.exp(-lt)}deg)`;
      o.node.style.opacity = clamp(lt * 4, 0, 1);
      o.node.style.transform = tf; return;
    } else if (o.kind === 'tag') {
      tf += ` scale(${lerp(.4, 1, easeBack(lt / .35))})`;
      o.node.style.opacity = clamp(lt * 5, 0, 1);
      tf += ` translateY(${Math.sin(lt * 3) * 5}px)`;
      o.node.style.transform = tf; return;
    } else if (o.kind === 'bubble') {
      tf += ` scale(${lerp(.2, 1, easeBack(lt / .32))})`;
      o.node.style.opacity = clamp(lt * 6, 0, 1);
      o.node.style.transform = tf; return;
    } else if (o.kind === 'paper') {
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
  const ORIGIN = { eye: '50% 50%', mouth: '50% 40%', head: '50% 95%', arm_left: '85% 6%', arm_right: '15% 6%',
    leg_left: '50% 0%', leg_right: '50% 0%', body: '50% 100%', tail: '0% 50%', wheel: '50% 50%', flame: '50% 100%',
    wing_left: '100% 60%', wing_right: '0% 60%', water: '50% 50%', light: '50% 50%', smoke: '50% 100%', leaf: '50% 100%' };
  function buildElement(parent, e) {
    const node = el('div', 'el', parent);
    const width = e.w / 100 * W;
    node.style.width = width + 'px';
    const inner = el('div', 'inner', node);
    const svgText = e.person ? window.buildPerson(e.person, e.pose, e.expression, e.framing) : e.svg;
    inner.innerHTML = uniqueSvg(svgText);
    if (e.flip) inner.style.transform = 'scaleX(-1)';
    if (e.submerge) {
      inner.style.clipPath = `inset(0 -20% ${e.submerge}% -20%)`;
      const rp = el('div', 'ripple', node); rp.style.bottom = `calc(${e.submerge}% - 14px)`;
    }
    const svg = inner.querySelector('svg');
    if (svg && svg.pauseAnimations) { try { svg.pauseAnimations(); } catch (_) { } }
    const r = rng(Math.floor(e.x * 31 + e.y * 17 + e.w));
    const parts = [...inner.querySelectorAll('[data-part]')].map(g => {
      const t = (g.getAttribute('data-part') || '').toLowerCase().replace(/[^a-z_]/g, '');
      const o = g.getAttribute('data-origin');
      if (o) { const [ox, oy] = o.split(/\s+/).map(Number); g.style.transformBox = 'view-box'; g.style.transformOrigin = `${ox}px ${oy}px`; }
      else { g.style.transformBox = 'fill-box'; g.style.transformOrigin = ORIGIN[t] || '50% 50%'; }
      return { g, t, ph: r() * 6.28, blink: 2.2 + r() * 2.5 };
    });
    let shapes = null;
    if (e.enter === 'sketch' && svg) {
      shapes = [...svg.querySelectorAll('path,rect,circle,ellipse,polygon,polyline,line')].map(sh => {
        sh.setAttribute('pathLength', '1');
        if (!sh.getAttribute('stroke') || sh.getAttribute('stroke') === 'none') { sh.style.stroke = PAL.outline || '#3A2418'; sh.style.strokeWidth = '3'; sh.dataset.tmpStroke = '1'; }
        sh.style.strokeDasharray = '1'; return sh;
      });
    }
    const layer = e.layer || 'mid';
    return { e, node, inner, svg, parts, shapes, layer, x: e.x / 100 * W, y: e.y / 100 * H,
      depth: layer === 'back' ? .55 : layer === 'front' ? 1.35 : 1 };
  }

  function animateParts(o, lt, talking) {
    const act = o.e.action || 'idle';
    const amp = talking ? envAt(o.e.t + lt) : 0;
    for (const p of o.parts) {
      let tf = '';
      switch (p.t) {
        case 'eye': case 'eyes': { const c = (lt + p.ph) % p.blink; tf = c < .13 ? `scaleY(${.12 + Math.abs(c - .065) * 12})` : ''; break; }
        case 'mouth': tf = talking ? `scaleY(${1 + amp * 2.2}) scaleX(${1 - amp * .15})` : ''; break;
        case 'head': tf = `rotate(${Math.sin(lt * 1.3 + p.ph) * 2.2 + (talking ? Math.sin(lt * 7) * amp * 5 : 0)}deg)`; break;
        case 'body': tf = `scaleY(${1 + .012 * Math.sin(lt * 1.9 + p.ph)})`; break;
        case 'arm_left': case 'arm_right': case 'arm': {
          const sgn = p.t === 'arm_left' ? 1 : -1;
          if (act === 'wave' && p.t !== 'arm_left') tf = `rotate(${Math.sin(lt * 9) * 16}deg)`;
          else if (act === 'walk' || act === 'run') tf = `rotate(${Math.sin(lt * (act === 'run' ? 11 : 6.5) + (p.t === 'arm_left' ? 0 : 3.14)) * (act === 'run' ? 30 : 16)}deg)`;
          else if (act === 'panic') tf = `rotate(${Math.sin(lt * 14 + p.ph) * 22}deg)`;
          else if (talking) tf = `rotate(${sgn * (Math.sin(lt * 3.2 + p.ph) * 6 + amp * 10)}deg)`;
          else tf = `rotate(${sgn * Math.sin(lt * 1.4 + p.ph) * 2.5}deg)`;
          break; }
        case 'leg_left': case 'leg_right': case 'leg':
          if (act === 'walk' || act === 'run') tf = `rotate(${Math.sin(lt * (act === 'run' ? 11 : 6.5) + (p.t === 'leg_left' ? 3.14 : 0)) * (act === 'run' ? 28 : 18)}deg)`;
          else if (act === 'panic') tf = `rotate(${Math.sin(lt * 12 + p.ph) * 14}deg)`;
          break;
        case 'wheel': tf = `rotate(${lt * 220}deg)`; break;
        case 'flame': tf = `scaleY(${1 + .13 * Math.sin(lt * 13 + p.ph) + .06 * Math.sin(lt * 23)}) skewX(${Math.sin(lt * 7 + p.ph) * 5}deg)`; break;
        case 'smoke': tf = `translateY(${-((lt * 20) % 30)}px) scale(${1 + ((lt * .6) % 1) * .2})`; break;
        case 'tail': tf = `rotate(${Math.sin(lt * 4 + p.ph) * 14}deg)`; break;
        case 'wing_left': case 'wing_right': tf = `rotate(${Math.sin(lt * 16 + p.ph) * 24 * (p.t === 'wing_left' ? 1 : -1)}deg)`; break;
        case 'water': tf = `translateX(${Math.sin(lt * 2 + p.ph) * 12}px)`; break;
        case 'leaf': tf = `rotate(${Math.sin(lt * 2.2 + p.ph) * 5}deg)`; break;
        case 'light': p.g.style.opacity = .7 + .3 * Math.sin(lt * 5 + p.ph); break;
      }
      p.g.style.transform = tf;
    }
  }

  function updateElement(o, t, accent, cam) {
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
      case 'sketch': op = 1; break;
    }
    if (o.shapes) {
      const p2 = clamp(lt / 1.3, 0, 1);
      const off = 1 - clamp(p2 * 1.5, 0, 1), fo = clamp((p2 - .45) / .45, 0, 1);
      for (const sh of o.shapes) { sh.style.strokeDashoffset = off; sh.style.fillOpacity = fo; if (sh.dataset.tmpStroke) sh.style.strokeOpacity = 1 - fo; }
      if (p2 >= 1) { for (const sh of o.shapes) { sh.style.strokeDasharray = ''; sh.style.strokeDashoffset = ''; } o.shapes = null; }
    }
    if (e.to_x != null && o.sceneDur) { const pp = easeInOut(clamp(lt / Math.max(.5, o.sceneDur - (e.t - o.sceneStart)), 0, 1)); tx += (e.to_x - e.x) / 100 * W * pp; }
    if (cam) { tx += cam.x * (o.depth - 1) * 2.2; ty += cam.y * (o.depth - 1) * 2.2; s *= 1 + (cam.s - 1) * (o.depth - 1) * .8; }
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
    o.node.style.opacity = op;
    o.node.style.clipPath = clip;
    animateParts(o, Math.max(0, lt), !!e.talks);
    let filt = o.layer === 'back' ? 'blur(2.2px) brightness(.92)' : 'drop-shadow(0 22px 20px rgba(0,0,0,.38))';
    if (e.rotate) rot += e.rotate;
    o.node.style.transform = `translate(${o.x + tx}px,${o.y + ty}px) translate(-50%,-50%) rotate(${rot}deg) scale(${s * sx},${s * sy})`;
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

  // ---------- subtitles (word-by-word) ----------
  function buildSubs(root, sc) {
    if (!D.subtitles || !sc.words || !sc.words.length) return null;
    const box = el('div', 'subs', root);
    const per = STORY ? 7 : 3;
    const groups = [];
    for (let i = 0; i < sc.words.length; i += per) groups.push(sc.words.slice(i, i + per));
    return { box, groups, cur: -1, spans: [] };
  }
  function updateSubs(sb, t, col) {
    if (!sb) return;
    let gi = -1;
    for (let i = 0; i < sb.groups.length; i++) if (t >= sb.groups[i][0].start - .05) gi = i;
    if (gi !== sb.cur) {
      sb.cur = gi; sb.box.innerHTML = '';
      sb.spans = gi < 0 ? [] : sb.groups[gi].map(w => { const sp = el('span', '', sb.box); sp.textContent = w.w; return sp; });
      sb.t0 = gi < 0 ? 0 : sb.groups[gi][0].start;
    }
    if (gi < 0) { sb.box.style.opacity = 0; return; }
    const g = sb.groups[gi];
    sb.box.style.opacity = 1;
    sb.box.style.transform = `translateX(-50%) scale(${lerp(.85, 1, easeBack((t - sb.t0) / .22))})`;
    g.forEach((w, k) => {
      const on = t >= w.start - .03;
      const active = on && (k === g.length - 1 || t < g[k + 1].start - .03);
      const sp = sb.spans[k];
      sp.style.color = active ? col : '#FFF8EC';
      sp.style.opacity = on ? 1 : .55;
      sp.style.transform = active ? 'scale(1.12)' : 'scale(1)';
    });
  }

  // ---------- build all scenes ----------
  const MOODS = {
    warm: 'linear-gradient(180deg, rgba(255,170,80,.20), rgba(255,120,40,.10))',
    cold: 'linear-gradient(180deg, rgba(70,130,255,.22), rgba(20,40,120,.18))',
    danger: 'radial-gradient(ellipse at 50% 50%, transparent 45%, rgba(200,20,30,.45) 100%)',
    night: 'linear-gradient(180deg, rgba(20,30,90,.35), rgba(10,10,40,.25))',
    dream: 'linear-gradient(180deg, rgba(170,120,255,.22), rgba(255,170,220,.14))',
    sad: 'linear-gradient(180deg, rgba(90,110,140,.30), rgba(60,70,90,.20))'
  };
  const scenes = D.scenes.map((sc, i) => {
    const root = el('div', 'scene', stage);
    const cam = el('div', 'cam', root);
    buildBg(cam, sc.background, 11 + i * 7);
    if (sc.set && sc.set.svg) {
      const sb = el('div', 'setbg', cam);
      sb.innerHTML = uniqueSvg(sc.set.svg.replace('<svg', '<svg width="100%" height="100%"').replace(/preserveAspectRatio="[^"]*"/, 'preserveAspectRatio="xMidYMid slice"'));
      if (sc.set.blur) sb.style.filter = 'blur(5px) brightness(.85)';
      const ssvg = sb.querySelector('svg'); if (ssvg && ssvg.pauseAnimations) { try { ssvg.pauseAnimations(); } catch (_) { } }
      sb._svg = ssvg;
      cam._set = sb;
    }
    const els = sc.elements.map(e => { const o = buildElement(cam, e); o.sceneStart = sc.start; o.sceneDur = sc.end - sc.start; return o; });
    els.sort((a, b) => (a.depth - b.depth)).forEach(o => cam.appendChild(o.node));
    const wids = sc.widgets.map(w => buildWidget(w.type === 'particles' ? root : cam, w, i, sc.accent));
    if (sc.mood && MOODS[sc.mood]) { const m = el('div', 'mood', root); m.style.background = MOODS[sc.mood]; m._danger = sc.mood === 'danger'; root._mood = m; }
    if (sc.rays) el('div', 'rays', root);
    const caps = el('div', 'caps', root);
    const top = el('div', 'cap cap-top', caps); top.textContent = sc.caption_top || '';
    const main = el('div', 'cap cap-main', caps); main.textContent = sc.caption_main || '';
    const col = CAPC[sc.accent] || '#FF9A4D';
    main.style.color = col;
    main.style.textShadow = `0 6px 0 rgba(40,20,8,.55), 0 0 4px rgba(40,20,8,.6), 0 0 38px ${rgba(col, .6)}`;
    const subs = buildSubs(root, sc);
    let chapter = null;
    if (sc.chapter) {
      chapter = el('div', 'chapter', root);
      el('div', 'ch-num', chapter).textContent = sc.chapter_num || 'CHAPTER';
      el('div', 'ch-title', chapter).textContent = sc.chapter;
      el('div', 'ch-line', chapter);
    }
    return { sc, root, cam, els, wids, top, main, col, subs, chapter };
  });

  const grain = el('div', 'overlay grain', stage);
  grain.style.backgroundImage = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='300' height='300' filter='url(%23n)'/></svg>")`;
  el('div', 'overlay crease', stage);
  el('div', 'overlay vignette', stage);
  const flash = el('div', 'overlay flash', stage);

  function impactAt(t) {
    let punch = 0, shake = 0;
    for (const it of IMPACTS) {
      const d = t - it.t;
      if (d < 0 || d > 1.2) continue;
      punch += it.k * Math.exp(-d * 7);
      shake += it.k * Math.exp(-d * 9) * Math.sin(d * 75);
    }
    return { punch, shake };
  }

  function updateScene(S, t) {
    const sc = S.sc, dur = Math.max(.5, sc.end - sc.start), p = clamp((t - sc.start) / dur, 0, 1.2);
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
    const im = impactAt(t);
    cs *= 1 + im.punch * .045;
    cx += im.shake * 14; cy += im.shake * 9;
    S.cam.style.transform = `translate(${cx}px,${cy}px) scale(${cs})`;
    if (S.cam._set && S.cam._set._svg && S.cam._set._svg.setCurrentTime) { try { S.cam._set._svg.setCurrentTime(Math.max(0, t - sc.start)); } catch (_) { } }
    const camInfo = { x: cx, y: cy, s: cs };
    for (const o of S.els) updateElement(o, t, sc.accent, camInfo);
    for (const o of S.wids) updateWidget(o, t, sc.start);
    if (S.root._mood && S.root._mood._danger) S.root._mood.style.opacity = .75 + .25 * Math.sin(t * 5);
    // captions
    const tp = (t - sc.start - .06) / .32;
    S.top.style.opacity = clamp(tp, 0, 1);
    S.top.style.transform = `translateY(${(1 - easeOut(tp)) * 34}px)`;
    const mp = (t - sc.main_t) / .28;
    S.main.style.opacity = clamp(mp * 2, 0, 1);
    S.main.style.transform = `scale(${mp <= 0 ? 1.35 : lerp(1.35, 1, easeBack(mp))})`;
    updateSubs(S.subs, t, S.col);
    if (S.chapter) {
      const lt = t - sc.start, cd = clamp((sc.end - sc.start) * .5, 1.0, 2.2);
      S.chapter.style.opacity = lt < cd ? 1 : clamp(1 - (lt - cd) / .45, 0, 1);
      S.chapter.style.display = lt > cd + .5 ? 'none' : 'flex';
      S.chapter.querySelector('.ch-title').style.transform = `scale(${lerp(1.08, 1, easeOut(lt / cd))})`;
      S.chapter.querySelector('.ch-line').style.width = (easeInOut((lt - .3) / 1) * 260) + 'px';
    }
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
