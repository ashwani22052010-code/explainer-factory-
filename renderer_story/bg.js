/* Procedural, detailed, layered backgrounds (1920x1080). window.BG.make(type, opts) ->
   { layers: [{svg, depth, blur}], floorY, spots: {name: x} }  depth: 0 far .. 1 near (parallax) */
(function () {
  const W = 1920, H = 1080, OUT = '#2a1c16';
  function rng(seed) { let s = seed >>> 0 || 7; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
  const S = (w = 3) => `stroke="${OUT}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
  function shade(hex, a) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; const t = a < 0 ? 0 : 255, p = Math.abs(a);
    r = Math.round(r + (t - r) * p); g = Math.round(g + (t - g) * p); b = Math.round(b + (t - b) * p); return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1); }
  let gid = 0; const uid = p => p + (gid++);
  const wrap = (inner, defs = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"><defs>${defs}</defs>${inner}</svg>`;

  // ---------- time of day ----------
  const TOD = {
    day: { sky: ['#7fb8e6', '#cfe6f3', '#f1ead8'], sun: ['#fff6d8', 1500, 210, 80], haze: '#dfe9ef', light: 0, ambient: '#ffffff' },
    morning: { sky: ['#9cc6ea', '#f3dcc0', '#f7e7cc'], sun: ['#fff0c8', 380, 300, 90], haze: '#f0e2cf', light: 0, ambient: '#fff3e0' },
    sunset: { sky: ['#3e3a7a', '#c86c7e', '#f2a65e', '#f8d48e'], sun: ['#ffe2a0', 1350, 640, 120], haze: '#e9a07a', light: .1, ambient: '#ffb070' },
    night: { sky: ['#0b1236', '#1d2a63', '#34407a'], moon: ['#f6f0d6', 1500, 180, 60], haze: '#2a3466', light: .5, ambient: '#5d72c0' },
  };
  function sky(tod, seed) {
    const T = TOD[tod] || TOD.day, id = uid('sky'), r = rng(seed);
    let s = `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${T.sky.map((c, i) => `<stop offset="${i / (T.sky.length - 1)}" stop-color="${c}"/>`).join('')}</linearGradient>`;
    let body = `<rect width="${W}" height="${H}" fill="url(#${id})"/>`;
    if (T.sun) { const [c, x, y, rr] = T.sun; const g = uid('sg'); s += `<radialGradient id="${g}"><stop offset="0" stop-color="${c}" stop-opacity=".95"/><stop offset=".25" stop-color="${c}" stop-opacity=".55"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`; body += `<circle cx="${x}" cy="${y}" r="${rr * 5}" fill="url(#${g})"/><circle cx="${x}" cy="${y}" r="${rr}" fill="${c}"/>`; }
    if (T.moon) { const [c, x, y, rr] = T.moon; const g = uid('mg'); s += `<radialGradient id="${g}"><stop offset="0" stop-color="${c}" stop-opacity=".6"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`;
      body += `<circle cx="${x}" cy="${y}" r="${rr * 3.4}" fill="url(#${g})"/><circle cx="${x}" cy="${y}" r="${rr}" fill="${c}"/><circle cx="${x - 18}" cy="${y - 10}" r="9" fill="#e2dabb"/><circle cx="${x + 14}" cy="${y + 16}" r="6" fill="#e2dabb"/>`;
      for (let i = 0; i < 140; i++) body += `<circle class="twinkle" cx="${(r() * W).toFixed(0)}" cy="${(r() * 560).toFixed(0)}" r="${(.8 + r() * 1.8).toFixed(1)}" fill="#fff" opacity="${(.3 + r() * .7).toFixed(2)}"/>`; }
    // stylised streak clouds (like flat illustration)
    const cc = tod === 'night' ? '#2a3770' : tod === 'sunset' ? '#e48a7a' : '#ffffff';
    for (let i = 0; i < 7; i++) { const x = r() * W, y = 70 + r() * 330, w = 160 + r() * 320; body += `<g class="cloud" opacity="${tod === 'night' ? .7 : .85}"><rect x="${x}" y="${y}" width="${w}" height="${6 + r() * 6}" rx="5" fill="${cc}"/><rect x="${x + 40}" y="${y - 12}" width="${w * .55}" height="${8}" rx="4" fill="${cc}" opacity=".7"/></g>`; }
    return { defs: s, body };
  }

  // ---------- building blocks ----------
  function windowGrid(x, y, w, h, cols, rows, lit, r, frame = '#f1e6cf', glass = '#5d7fa6') {
    let s = ''; const cw = w / cols, rh = h / rows;
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const wx = x + i * cw + cw * .2, wy = y + j * rh + rh * .18, ww = cw * .6, wh = rh * .62;
      const on = lit && r() < .55;
      s += `<rect x="${wx}" y="${wy}" width="${ww}" height="${wh}" fill="${on ? '#ffd27a' : glass}" stroke="${frame}" stroke-width="2"/>`;
      if (!on) s += `<path d="M${wx} ${wy} L${wx + ww * .5} ${wy} L${wx} ${wy + wh * .6} Z" fill="#ffffff" opacity=".12"/>`;
    }
    return s;
  }
  function indianBuilding(x, base, w, h, color, r, lit, opts = {}) {
    const top = base - h;
    let s = `<rect x="${x}" y="${top}" width="${w}" height="${h}" fill="${color}" ${S(2.5)}/>`;
    s += `<rect x="${x + w * .62}" y="${top}" width="${w * .38}" height="${h}" fill="${shade(color, -.12)}"/>`;
    s += `<rect x="${x - 6}" y="${top - 12}" width="${w + 12}" height="14" fill="${shade(color, -.25)}" ${S(2)}/>`; // parapet
    const floors = Math.max(1, Math.floor(h / 120));
    for (let f = 0; f < floors; f++) {
      const fy = top + 30 + f * (h / floors);
      s += windowGrid(x + 10, fy, w - 20, (h / floors) * .55, Math.max(1, Math.floor(w / 80)), 1, lit, r);
      if (f > 0 && r() < .6) { // balcony
        s += `<rect x="${x + 10}" y="${fy + (h / floors) * .55}" width="${w - 20}" height="10" fill="${shade(color, -.3)}"/>`;
        for (let k = x + 16; k < x + w - 14; k += 12) s += `<rect x="${k}" y="${fy + (h / floors) * .55 - 26}" width="3" height="26" fill="${shade(color, -.4)}"/>`;
      }
    }
    if (opts.shop) { // ground floor shop with shutter and sign
      const sc = opts.signCol || ['#c8323a', '#2f5fa8', '#e6bc45', '#3f7f4c'][Math.floor(r() * 4)];
      s += `<rect x="${x + 8}" y="${base - 130}" width="${w - 16}" height="40" fill="${sc}" ${S(2)}/><text x="${x + w / 2}" y="${base - 102}" font-family="Anton, 'DevaBold', sans-serif" font-size="26" fill="#fff" text-anchor="middle">${opts.sign || ''}</text>`;
      s += `<rect x="${x + 14}" y="${base - 88}" width="${w - 28}" height="88" fill="#3a3330"/>`;
      for (let k = base - 84; k < base; k += 8) s += `<path d="M${x + 14} ${k} L${x + w - 14} ${k}" stroke="#5a524e" stroke-width="3"/>`;
      s += `<path d="M${x} ${base - 92} L${x + w} ${base - 92} L${x + w + 16} ${base - 72} L${x - 16} ${base - 72} Z" fill="${shade(sc, .25)}" ${S(2)}/>`;
    }
    if (r() < .4) s += `<g><rect x="${x + w * .7}" y="${top - 46}" width="44" height="34" fill="#5a6e7a" ${S(2)}/><rect x="${x + w * .7 + 4}" y="${top - 58}" width="36" height="14" fill="#7a8e9a" ${S(2)}/></g>`; // water tank
    return s;
  }
  function wires(y, r, col = '#2a2a2a') { let s = ''; for (let i = 0; i < 3; i++) { const y0 = y + i * 18 + r() * 10; s += `<path d="M-20 ${y0} Q${W / 2} ${y0 + 60 + r() * 30} ${W + 20} ${y0 + 10}" fill="none" stroke="${col}" stroke-width="2.5"/>`; } return s; }
  function pole(x, base, h, light) { return `<rect x="${x - 7}" y="${base - h}" width="14" height="${h}" fill="#4a4a50" ${S(2)}/><path d="M${x} ${base - h + 10} L${x + 70} ${base - h + 10}" stroke="#4a4a50" stroke-width="8"/><rect x="${x + 56}" y="${base - h + 8}" width="40" height="12" rx="4" fill="${light ? '#ffe7a8' : '#ddd'}" ${S(2)}/>`; }
  function tree(x, base, s, cols, r) { let t = `<path d="M${x - 10} ${base} L${x - 6} ${base - 120 * s} L${x + 6} ${base - 120 * s} L${x + 10} ${base} Z" fill="#6a4428" ${S(2)}/>`;
    for (let k = 0; k < 3; k++) for (const [dx, dy, rr] of [[0, -190, 80], [-60, -150, 60], [60, -150, 62], [-30, -230, 55], [35, -225, 58]]) t += `<circle cx="${x + (dx + k * 4) * s}" cy="${base + (dy - k * 6) * s}" r="${rr * s * (1 - k * .18)}" fill="${cols[k]}" ${k === 0 ? S(2) : ''}/>`;
    return t; }
  function scooter(x, base, c) { return `<g transform="translate(${x} ${base})"><circle cx="-50" cy="-24" r="24" fill="#222" ${S(2)}/><circle cx="50" cy="-24" r="24" fill="#222" ${S(2)}/><circle cx="-50" cy="-24" r="9" fill="#aaa"/><circle cx="50" cy="-24" r="9" fill="#aaa"/>
    <path d="M-70 -40 Q-40 -90 10 -70 L40 -70 L60 -44 L-20 -40 Z" fill="${c}" ${S(2)}/><path d="M40 -70 L56 -130 L72 -132" fill="none" stroke="#333" stroke-width="7"/><rect x="-46" y="-92" width="56" height="16" rx="7" fill="#2a2a2a"/></g>`; }

  // texture patterns
  function patterns() {
    return `<pattern id="brick" width="80" height="40" patternUnits="userSpaceOnUse"><rect width="80" height="40" fill="none"/><path d="M0 20 H80 M40 0 V20 M0 20 V40 M80 20 V40" stroke="#00000022" stroke-width="2"/></pattern>
      <pattern id="tiles" width="120" height="60" patternUnits="userSpaceOnUse"><path d="M0 0 H120 M0 0 V60" stroke="#00000020" stroke-width="2"/></pattern>
      <pattern id="planks" width="160" height="34" patternUnits="userSpaceOnUse"><path d="M0 33 H160 M70 0 V34" stroke="#00000030" stroke-width="2"/></pattern>
      <pattern id="plaster" width="220" height="220" patternUnits="userSpaceOnUse"><circle cx="40" cy="60" r="18" fill="#00000008"/><circle cx="160" cy="140" r="26" fill="#00000008"/><circle cx="110" cy="30" r="10" fill="#ffffff10"/><path d="M180 20 l-14 22 l6 14" stroke="#00000014" fill="none" stroke-width="2"/></pattern>`;
  }


  function interior(o, kind) {
    const night = o.tod === 'night', r = rng(o.seed || 41);
    const wallC = { office: '#dfe3e6', bank: '#e8dcc4', hospital: '#e6f0ee', library: '#c9a77a', party: '#3a2a4a' }[kind];
    let back = `<rect width="${W}" height="${H}" fill="${wallC}"/><rect width="${W}" height="${H}" fill="url(#plaster)"/><rect x="0" y="0" width="${W}" height="70" fill="${shade(wallC, -.15)}"/>`;
    for (let x = 160; x < W; x += 520) back += `<rect x="${x - 90}" y="40" width="180" height="16" rx="8" fill="#fffdf2" ${S(2)}/>${night ? '' : `<ellipse cx="${x}" cy="70" rx="200" ry="40" fill="#ffffff" opacity=".25"/>`}`;
    let floor = `<rect x="0" y="780" width="${W}" height="300" fill="${kind === 'library' ? '#7a5236' : kind === 'party' ? '#2a2034' : '#bfb6a8'}"/><rect x="0" y="780" width="${W}" height="300" fill="url(#${kind === 'library' ? 'planks' : 'tiles'})"/><rect x="0" y="770" width="${W}" height="16" fill="${shade(wallC, -.35)}"/>`;
    let mid = '';
    if (kind === 'office') {
      back += `<g transform="translate(1250 180)"><rect width="520" height="360" fill="#bfe0f2" ${S(3)}/>${indianBuilding(20, 360, 200, 260, '#c9d8de', r, false)}${indianBuilding(250, 360, 230, 300, '#e6c37a', r, false)}${[1, 2, 3].map(i => `<rect x="${i * 130 - 3}" y="0" width="6" height="360" fill="#e8eef2"/>`).join('')}${[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => `<rect x="0" y="${i * 40}" width="520" height="6" fill="#e8eef2" opacity=".8"/>`).join('')}</g>
        <g transform="translate(300 260)"><rect width="300" height="200" fill="#fff" ${S(2)}/><path d="M30 170 L90 110 L150 140 L230 60 L270 80" fill="none" stroke="#3762a8" stroke-width="8"/><text x="150" y="40" font-family="Anton" font-size="30" fill="#333" text-anchor="middle">TARGET 2026</text></g>`;
      for (const x of [260, 980]) mid += `<g transform="translate(${x} 640)"><rect width="520" height="30" fill="#9a7a5a" ${S(2)}/><rect x="20" y="30" width="20" height="160" fill="#6a5a4a"/><rect x="480" y="30" width="20" height="160" fill="#6a5a4a"/><rect x="180" y="-150" width="200" height="130" rx="6" fill="#26282e" ${S(2)}/><rect x="190" y="-140" width="180" height="104" fill="#4a7ab0"/><rect x="265" y="-20" width="30" height="22" fill="#26282e"/><rect x="140" y="-8" width="150" height="10" rx="4" fill="#ddd" ${S(1.5)}/><rect x="40" y="-30" width="80" height="30" fill="#e9e2d0" ${S(1.5)}/></g>`;
    } else if (kind === 'bank') {
      back += `<rect x="560" y="120" width="800" height="90" rx="8" fill="#1f3a6a" ${S(3)}/><text x="960" y="182" font-family="Anton" font-size="56" fill="#ffd45e" text-anchor="middle" letter-spacing="6">STATE BANK</text>`;
      mid += `<rect x="0" y="560" width="${W}" height="230" fill="#8a6a4a" ${S(3)}/><rect x="0" y="540" width="${W}" height="30" fill="#a8885e" ${S(2)}/>${[0, 1, 2, 3].map(i => `<g><rect x="${200 + i * 420}" y="300" width="300" height="240" fill="#cfe6f0" opacity=".55" ${S(2)}/><rect x="${300 + i * 420}" y="250" width="100" height="40" rx="4" fill="#fbf6ea" ${S(2)}/><text x="${350 + i * 420}" y="280" font-family="Anton" font-size="24" fill="#333" text-anchor="middle">${['CASH', 'LOANS', 'ENQUIRY', 'MANAGER'][i]}</text></g>`).join('')}`;
    } else if (kind === 'hospital') {
      back += `<g transform="translate(1300 200)"><rect width="360" height="280" fill="#bfe0f2" ${S(3)}/><path d="M180 0 V280 M0 140 H360" stroke="#fff" stroke-width="10"/></g><rect x="300" y="260" width="120" height="120" fill="#fff" ${S(2)}/><path d="M360 285 V355 M325 320 H395" stroke="#c8323a" stroke-width="18"/>`;
      mid += `<g transform="translate(900 600)"><rect width="640" height="60" rx="10" fill="#fbfbfb" ${S(2)}/><rect x="0" y="-30" width="160" height="40" rx="14" fill="#fff" ${S(2)}/><rect x="200" y="-20" width="440" height="40" rx="10" fill="#9ad3e0" ${S(2)}/><rect x="20" y="60" width="16" height="140" fill="#9aa"/><rect x="600" y="60" width="16" height="140" fill="#9aa"/></g><g transform="translate(720 340)"><rect x="-6" width="12" height="460" fill="#aab"/><rect x="-40" y="-10" width="80" height="12" fill="#aab"/><path d="M-30 0 Q-40 70 -20 110 L20 110 Q40 70 30 0 Z" fill="#cfefff" ${S(2)}/><rect x="80" y="40" width="160" height="110" rx="8" fill="#20242a" ${S(2)}/><path d="M95 100 L130 100 L145 70 L160 125 L175 95 L225 95" fill="none" stroke="#4ef07a" stroke-width="4"/></g>`;
    } else if (kind === 'library') {
      for (let x = 60; x < W; x += 460) { mid += `<g transform="translate(${x} 220)"><rect width="400" height="560" fill="#6a4428" ${S(3)}/>${[0, 1, 2, 3].map(j => `<rect x="12" y="${20 + j * 136}" width="376" height="12" fill="#4a2e18"/>${Array.from({ length: 11 }, (_, k) => `<rect x="${20 + k * 33}" y="${40 + j * 136 + (k % 3) * 6}" width="${26 + (k % 2) * 4}" height="${92 - (k % 3) * 6}" fill="${['#b8343a', '#3762a8', '#d9ac3a', '#3f7f4c', '#7a2632', '#5e4290'][(k + j) % 6]}" stroke="#2a1c16" stroke-width="1.5"/>`).join('')}`).join('')}</g>`; }
      mid += `<g transform="translate(560 680)"><rect width="800" height="30" fill="#8a5a36" ${S(2)}/><rect x="30" y="30" width="20" height="110" fill="#6a4428"/><rect x="750" y="30" width="20" height="110" fill="#6a4428"/><rect x="120" y="-20" width="120" height="20" fill="#f3e6c8" ${S(1.5)}/><rect x="560" y="-26" width="90" height="26" fill="#b8343a" ${S(1.5)}/></g>`;
    } else if (kind === 'party') {
      back += Array.from({ length: 40 }, (_, i) => `<circle class="twinkle" cx="${i * 49 + 20}" cy="${120 + Math.sin(i * .7) * 40}" r="9" fill="${['#ffd45e', '#ff7ab0', '#7ad8ff', '#9aff7a'][i % 4]}"/>`).join('') + `<path d="M0 110 Q480 190 960 120 Q1440 190 1920 110" fill="none" stroke="#2a2030" stroke-width="3"/>`;
      for (const [x, c] of [[260, '#ff7ab0'], [380, '#ffd45e'], [1560, '#7ad8ff'], [1680, '#c8323a']]) back += `<g><path d="M${x} 560 Q${x - 10} 460 ${x} 400" stroke="#ddd" stroke-width="2" fill="none"/><ellipse cx="${x}" cy="370" rx="40" ry="50" fill="${c}" ${S(2)}/></g>`;
      floor += `<ellipse cx="960" cy="900" rx="700" ry="110" fill="#ff7ab0" opacity=".18"/>`;
    }
    return { layers: [{ svg: wrap(back + floor, patterns()), depth: .2 }, { svg: wrap(mid), depth: .5 }], floorY: 1000, spots: { center: 960, left: 520, right: 1400, desk: 600, window: 1450 }, night };
  }

  // ---------- sets ----------
  const SETS = {
    // establishing city skyline (Indian small town)
    city(o) {
      const tod = o.tod || 'morning', r = rng(o.seed || 3), lit = tod === 'night' || tod === 'sunset';
      const sk = sky(tod, 11);
      const hz = TOD[tod].haze;
      let far = '', mid = '', near = '';
      for (let x = -40; x < W + 40; x += 70 + r() * 60) { const h = 140 + r() * 220; far += `<rect x="${x}" y="${640 - h}" width="${60 + r() * 50}" height="${h + 200}" fill="${shade(hz, -.12 - r() * .08)}"/>`; }
      far += `<path d="M1180 470 Q1240 330 1300 470 Z" fill="${shade(hz, -.18)}"/><rect x="1236" y="300" width="10" height="40" fill="${shade(hz, -.2)}"/>`; // temple shikhar silhouette
      const cols = ['#e9d3b0', '#d9a77a', '#c9d8de', '#e6c37a', '#d6a6b3', '#b8cfa8', '#efe3cf'];
      for (let x = -30; x < W + 60;) { const w = 120 + r() * 120, h = 200 + r() * 220; mid += indianBuilding(x, 860, w, h, cols[Math.floor(r() * cols.length)], r, lit); x += w - 4; }
      near += `<rect x="0" y="860" width="${W}" height="220" fill="${tod === 'night' ? '#2c2c38' : '#8d8a86'}"/><rect x="0" y="856" width="${W}" height="10" fill="${tod === 'night' ? '#3a3a48' : '#b5b0a6'}"/>`;
      near += wires(560, r, tod === 'night' ? '#0e0e14' : '#2a2a2a') + pole(240, 880, 420, lit) + pole(1500, 880, 420, lit);
      return { layers: [{ svg: wrap(sk.body, sk.defs), depth: 0 }, { svg: wrap(far), depth: .15, blur: 1.2 }, { svg: wrap(mid), depth: .45 }, { svg: wrap(near), depth: 1 }], floorY: 1000, spots: { center: 960, left: 560, right: 1360 } };
    },
    // poor rented room
    room_poor(o) {
      const night = o.tod === 'night', r = rng(o.seed || 5);
      const wall = o.wall || '#d8c79a', wallD = shade(wall, -.12);
      let back = `<rect width="${W}" height="${H}" fill="${wall}"/><rect width="${W}" height="${H}" fill="url(#plaster)"/>
        <path d="M0 0 H${W} V120 H0 Z" fill="${wallD}" opacity=".45"/><rect x="0" y="770" width="${W}" height="40" fill="${shade(wall, -.25)}"/>
        <path d="M300 200 l-30 60 l20 40 l-24 50" stroke="#00000020" stroke-width="3" fill="none"/><ellipse cx="1600" cy="260" rx="90" ry="40" fill="#5a4a2a" opacity=".08"/>`;
      // window with grill + outside view
      const wx = 1180, wy = 230, ww = 380, wh = 300;
      const view = night ? `<rect x="${wx}" y="${wy}" width="${ww}" height="${wh}" fill="#16204a"/><circle cx="${wx + 280}" cy="${wy + 80}" r="30" fill="#f6f0d6"/>${windowGrid(wx + 20, wy + 160, 300, 120, 5, 2, true, r, '#222')}`
        : `<rect x="${wx}" y="${wy}" width="${ww}" height="${wh}" fill="#bfe0f2"/>${indianBuilding(wx + 20, wy + wh, 160, 170, '#e6c37a', r, false)}${indianBuilding(wx + 190, wy + wh, 170, 220, '#c9d8de', r, false)}`;
      back += `<g>${view}<rect x="${wx - 16}" y="${wy - 16}" width="${ww + 32}" height="${wh + 32}" fill="none" stroke="#6a4a2e" stroke-width="22"/>${[1, 2, 3, 4, 5].map(i => `<rect x="${wx + i * ww / 6 - 3}" y="${wy}" width="6" height="${wh}" fill="#3a3a3a"/>`).join('')}<rect x="${wx}" y="${wy + wh / 2 - 3}" width="${ww}" height="6" fill="#3a3a3a"/>
        <rect x="${wx - 30}" y="${wy + wh + 14}" width="${ww + 60}" height="18" fill="#7a5a3a" ${S(2)}/></g>`;
      back += `<path d="M${wx - 90} ${wy - 40} Q${wx - 70} ${wy + 200} ${wx - 110} ${wy + wh + 40} L${wx - 20} ${wy + wh + 40} Q${wx - 30} ${wy + 200} ${wx - 10} ${wy - 40} Z" fill="#b5523c" ${S(2)}/>`;
      // tube light, calendar, clock, shelf, clothes hook
      back += `<rect x="560" y="140" width="260" height="16" rx="8" fill="${night ? '#fffbe8' : '#f4f4f4'}" ${S(2)}/>${night ? `<ellipse cx="690" cy="160" rx="260" ry="60" fill="#fffbe0" opacity=".18"/>` : ''}
        <g transform="translate(420 300)"><rect width="140" height="190" fill="#fbf6ea" ${S(2)}/><rect width="140" height="70" fill="#c8323a"/><text x="70" y="50" font-family="Anton,sans-serif" font-size="34" fill="#fff" text-anchor="middle">2026</text>${[0, 1, 2, 3, 4].map(i => `<path d="M14 ${90 + i * 20} H126" stroke="#bbb" stroke-width="3"/>`).join('')}</g>
        <g transform="translate(880 330)"><circle r="52" fill="#fbf6ea" ${S(3)}/><path d="M0 0 L0 -32 M0 0 L22 10" stroke="${OUT}" stroke-width="5" stroke-linecap="round"/><circle r="5" fill="${OUT}"/></g>
        <g transform="translate(150 380)"><rect width="200" height="12" fill="#6a4a2e" ${S(2)}/><rect x="10" y="-60" width="34" height="60" fill="#3762a8" ${S(2)}/><rect x="50" y="-48" width="26" height="48" fill="#d9ac3a" ${S(2)}/><rect x="120" y="-36" width="50" height="36" rx="8" fill="#c0c0c0" ${S(2)}/></g>
        <g transform="translate(1700 300)"><circle r="8" fill="#555"/><path d="M-10 6 Q-60 120 -40 260 L60 260 Q80 120 10 6 Z" fill="#3f7f4c" ${S(2)}/></g>`;
      // floor
      let floor = `<rect x="0" y="790" width="${W}" height="290" fill="${o.floor || '#a8876a'}"/><rect x="0" y="790" width="${W}" height="290" fill="url(#tiles)"/><rect x="0" y="790" width="${W}" height="14" fill="#00000022"/>`;
      // furniture (mid layer): steel almirah, cot, table+chair
      let mid = `<g transform="translate(70 360)"><rect width="250" height="470" rx="6" fill="#8a9aa6" ${S()}/><rect x="125" width="125" height="470" fill="#7a8a96"/><path d="M125 0 V470" stroke="${OUT}" stroke-width="3"/><rect x="108" y="220" width="10" height="44" rx="3" fill="#ddd" ${S(1.5)}/><rect x="132" y="220" width="10" height="44" rx="3" fill="#ddd" ${S(1.5)}/></g>`;
      mid += `<g transform="translate(1340 690)"><rect x="0" y="0" width="520" height="40" fill="#8a5a36" ${S()}/>${[0, 1, 2, 3].map(i => `<path d="M10 40 L${10 + i * 2} 160" stroke="#6a4428" stroke-width="14"/>`).join('')}<rect x="10" y="-30" width="500" height="34" rx="10" fill="#e9e2d0" ${S(2)}/><rect x="300" y="-30" width="210" height="40" rx="10" fill="#b5523c" ${S(2)}/><rect x="16" y="-58" width="120" height="34" rx="14" fill="#f6f2e8" ${S(2)}/><path d="M10 40 L10 160 M510 40 L510 160" stroke="#6a4428" stroke-width="14"/></g>`;
      const tx = o.tableX || 700;
      mid += `<g transform="translate(${tx} 640)"><rect x="-200" y="0" width="400" height="26" fill="#8a5a36" ${S()}/><rect x="-190" y="26" width="18" height="190" fill="#6a4428" ${S(2)}/><rect x="172" y="26" width="18" height="190" fill="#6a4428" ${S(2)}/>
        <g transform="translate(120 -2)"><path d="M-22 0 L-18 -40 L18 -40 L22 0 Z" fill="#f4efe4" ${S(2)}/><path d="M20 -32 Q40 -24 20 -10" fill="none" stroke="${OUT}" stroke-width="3"/><path d="M-6 -56 Q-14 -70 -4 -84 M8 -54 Q0 -68 10 -82" stroke="#ffffff" stroke-width="4" fill="none" opacity=".7" class="steam"/></g>
        <rect x="-150" y="-12" width="120" height="12" fill="#e9e2d0" ${S(2)}/><rect x="-140" y="-22" width="100" height="10" fill="#c8323a" ${S(2)}/></g>`;
      // ceiling fan (rig part spins)
      const fan = `<g transform="translate(960 40)"><rect x="-4" y="-40" width="8" height="60" fill="#5a5a5a"/><g class="fan" data-spin="420"><ellipse cx="0" cy="24" rx="300" ry="16" fill="#8a7a6a" opacity=".85" ${S(2)}/><ellipse cx="0" cy="24" rx="16" ry="300" fill="#8a7a6a" opacity=".0"/></g><ellipse cx="0" cy="24" rx="36" ry="16" fill="#6a6a6a" ${S(2)}/></g>`;
      return { layers: [{ svg: wrap(back + floor + fan, patterns()), depth: .2 }, { svg: wrap(mid), depth: .55 }], floorY: 1000, spots: { center: 960, left: 520, right: 1350, table: tx, window: 1370, bed: 1600 }, warm: true, night };
    },
    // Indian market street with lottery stall
    street(o) {
      const tod = o.tod || 'day', r = rng(o.seed || 9), lit = tod === 'night';
      const sk = sky(tod, 13);
      let mid = '', near = '';
      const signs = ['KIRANA STORE', 'MOBILE SHOP', 'CHAI', 'MEDICAL', 'SWEETS', 'TAILOR'];
      let x = -40, k = 0;
      while (x < W + 60) { const w = 240 + r() * 120, h = 360 + r() * 200; mid += indianBuilding(x, 840, w, h, ['#e9d3b0', '#d9a77a', '#c9d8de', '#e6c37a', '#d6a6b3', '#b8cfa8'][k % 6], r, lit, { shop: true, sign: signs[k % signs.length] }); x += w + 6; k++; }
      mid += wires(330, r) + pole(360, 860, 560, lit);
      near += `<rect x="0" y="840" width="${W}" height="240" fill="${lit ? '#3a3640' : '#a59f94'}"/><rect x="0" y="836" width="${W}" height="12" fill="${lit ? '#4a4650' : '#c8c0b2'}"/><path d="M0 1010 H${W}" stroke="#ffffff55" stroke-width="6" stroke-dasharray="80 60"/>`;
      // lottery stall (detailed) at stallX
      const sx = o.stallX || 1280;
      near += `<g transform="translate(${sx} 840)">
        <rect x="-190" y="-230" width="380" height="230" fill="#e6bc45" ${S()}/><rect x="-190" y="-230" width="380" height="30" fill="#c8323a" ${S(2)}/>
        <path d="M-220 -300 L220 -300 L250 -250 L-250 -250 Z" fill="#c8323a" ${S()}/>${[-200, -120, -40, 40, 120].map(px => `<path d="M${px} -300 L${px + 40} -300 L${px + 50} -250 L${px - 4} -250 Z" fill="#ffffff" opacity=".85"/>`).join('')}
        <rect x="-170" y="-360" width="340" height="56" rx="6" fill="#1f3a6a" ${S(2)}/><text x="0" y="-320" font-family="Anton,sans-serif" font-size="40" fill="#ffd45e" text-anchor="middle">LOTTERY</text>
        <rect x="-160" y="-190" width="320" height="110" fill="#fff6dc" ${S(2)}/>${[0, 1, 2, 3, 4, 5].map(i => `<rect x="${-150 + i * 52}" y="-180" width="44" height="90" fill="${['#ff9ec0', '#9ad3f5', '#fff08a'][i % 3]}" ${S(1.5)}/><rect x="${-146 + i * 52}" y="-150" width="36" height="8" fill="#c8323a"/>`).join('')}
        <text x="0" y="-30" font-family="Anton,sans-serif" font-size="30" fill="#7a2632" text-anchor="middle">₹100 CRORE BUMPER</text></g>`;
      near += scooter(220, 990, '#c8323a') + scooter(620, 1000, '#3762a8');
      return { layers: [{ svg: wrap(sk.body, sk.defs), depth: 0 }, { svg: wrap(mid), depth: .4 }, { svg: wrap(near), depth: .8 }], floorY: 1010, spots: { center: 960, stall: sx, left: 520, right: 1500 } };
    },
    // rich mansion hall
    mansion(o) {
      const night = o.tod === 'night', r = rng(o.seed || 21);
      let back = `<rect width="${W}" height="${H}" fill="${night ? '#3a3248' : '#efe4cf'}"/>`;
      for (let x = 0; x < W; x += 240) back += `<rect x="${x + 20}" y="120" width="200" height="560" fill="${night ? '#443a54' : '#f6ecda'}" ${S(1.5)}/><rect x="${x + 40}" y="140" width="160" height="240" fill="none" stroke="${night ? '#55486a' : '#e2d2b4'}" stroke-width="4"/>`;
      // tall windows
      for (const wx of [180, 1500]) back += `<g transform="translate(${wx} 140)"><path d="M0 520 V100 Q120 -20 240 100 V520 Z" fill="${night ? '#1a2258' : '#cfe8f6'}" ${S(3)}/>${night ? `<circle cx="150" cy="140" r="34" fill="#f6f0d6"/>` : ''}<path d="M120 0 V520 M0 260 H240" stroke="#f1e6cf" stroke-width="10"/><path d="M-40 -10 Q-20 260 -60 560 L20 560 Q10 260 10 -10 Z M280 -10 Q260 260 300 560 L220 560 Q230 260 230 -10 Z" fill="#7a2632" ${S(2)}/></g>`;
      // painting + chandelier
      back += `<g transform="translate(860 200)"><rect width="200" height="150" fill="#c9a24a" ${S(3)}/><rect x="14" y="14" width="172" height="122" fill="#4a7a9a"/><circle cx="130" cy="60" r="26" fill="#f2c46a"/><path d="M14 136 L80 80 L130 120 L186 90 L186 136 Z" fill="#3f6f4a"/></g>`;
      const ch = `<g transform="translate(960 0)"><rect x="-3" y="0" width="6" height="120" fill="#c9a24a"/><path d="M-160 150 Q0 230 160 150" fill="none" stroke="#c9a24a" stroke-width="8"/>${[-150, -90, -30, 30, 90, 150].map(px => `<g><rect x="${px - 6}" y="${118 + Math.abs(px) * .1}" width="12" height="30" fill="#fff6dc"/><ellipse cx="${px}" cy="${110 + Math.abs(px) * .1}" rx="8" ry="12" fill="#ffd27a" class="flame"/><circle cx="${px}" cy="${110 + Math.abs(px) * .1}" r="40" fill="#ffd27a" opacity=".18"/></g>`).join('')}<circle cx="0" cy="190" r="22" fill="#c9a24a" ${S(2)}/></g>`;
      let floor = `<rect x="0" y="780" width="${W}" height="300" fill="${night ? '#5a5268' : '#e8e0d2'}"/>${[0, 1, 2, 3, 4, 5, 6, 7, 8].map(i => `<path d="M${i * 240} 780 L${i * 300 - 240} 1080" stroke="#00000018" stroke-width="3"/>`).join('')}<path d="M0 860 H${W} M0 960 H${W}" stroke="#00000014" stroke-width="3"/><ellipse cx="960" cy="950" rx="560" ry="70" fill="#7a2632" opacity=".85"/><ellipse cx="960" cy="950" rx="520" ry="58" fill="none" stroke="#d9ac3a" stroke-width="6"/>`;
      let mid = `<g transform="translate(330 640)"><rect width="420" height="110" rx="30" fill="#6a2a3a" ${S()}/><rect y="-90" width="420" height="110" rx="30" fill="#7a3446" ${S()}/><rect x="-30" y="-40" width="70" height="160" rx="26" fill="#6a2a3a" ${S()}/><rect x="380" y="-40" width="70" height="160" rx="26" fill="#6a2a3a" ${S()}/></g>`;
      mid += `<g transform="translate(1450 560)"><path d="M0 220 L30 0 L130 0 L160 220 Z" fill="#c4683e" ${S()}/>${[0, 1, 2, 3, 4].map(i => `<circle cx="${40 + i * 20}" cy="${-30 - (i % 2) * 40}" r="50" fill="${i % 2 ? '#3f7f4c' : '#4f9a5a'}" ${S(2)}/>`).join('')}</g>`;
      return { layers: [{ svg: wrap(back + floor + ch), depth: .2 }, { svg: wrap(mid), depth: .55 }], floorY: 990, spots: { center: 960, left: 560, right: 1380, window: 300 }, night };
    },

    // generic interior helper used by office / bank / hospital / library / party
    office(o) { return interior(o, 'office'); },
    bank(o) { return interior(o, 'bank'); },
    hospital(o) { return interior(o, 'hospital'); },
    library(o) { return interior(o, 'library'); },
    party(o) { return interior({ ...o, tod: 'night' }, 'party'); },
    rooftop(o) {
      const c = SETS.city({ ...o, tod: o.tod || 'night' });
      const par = `<rect x="0" y="830" width="${W}" height="250" fill="${o.tod === 'day' ? '#b9a88c' : '#3e3a48'}"/><rect x="0" y="810" width="${W}" height="40" fill="${o.tod === 'day' ? '#cfbf9f' : '#555064'}" ${S(2)}/>${[0, 1, 2, 3, 4, 5, 6, 7].map(i => `<rect x="${i * 260 + 40}" y="850" width="10" height="230" fill="#00000022"/>`).join('')}`;
      c.layers.push({ svg: wrap(par), depth: 1 }); c.floorY = 1060; return c;
    },
    village(o) {
      const tod = o.tod || 'day', r = rng(o.seed || 31), sk = sky(tod, 17);
      let far = `<path d="M0 640 Q300 520 640 600 Q980 500 1320 590 Q1640 520 1920 600 L1920 760 L0 760 Z" fill="${tod === 'night' ? '#2a3a4a' : '#9cc08a'}"/>`;
      let mid = `<rect x="0" y="700" width="${W}" height="380" fill="${tod === 'night' ? '#3a4030' : '#c9b27a'}"/>`;
      for (let i = 0; i < 9; i++) mid += `<path d="M0 ${740 + i * 26} Q${W / 2} ${730 + i * 26} ${W} ${744 + i * 26}" stroke="#00000014" stroke-width="3" fill="none"/>`;
      for (const [x, w] of [[180, 300], [1340, 340]]) mid += `<g><rect x="${x}" y="560" width="${w}" height="190" fill="#d9b88a" ${S(2.5)}/><path d="M${x - 30} 570 L${x + w / 2} 450 L${x + w + 30} 570 Z" fill="#8a6a3a" ${S(2.5)}/>${[0, 1, 2, 3, 4, 5, 6].map(k => `<path d="M${x - 20 + k * (w + 40) / 7} 566 L${x + w / 2} 456" stroke="#6a4a22" stroke-width="2"/>`).join('')}<rect x="${x + w / 2 - 30}" y="640" width="60" height="110" fill="#5a3a22" ${S(2)}/><rect x="${x + 30}" y="610" width="60" height="50" fill="${tod === 'night' ? '#ffd27a' : '#3a2a20'}" ${S(2)}/></g>`;
      mid += tree(820, 720, 1.4, ['#3f7a3a', '#4f8a44', '#6aa250'], r) + tree(1750, 720, 1.1, ['#3f7a3a', '#4f8a44', '#6aa250'], r);
      return { layers: [{ svg: wrap(sk.body, sk.defs), depth: 0 }, { svg: wrap(far), depth: .2, blur: 1 }, { svg: wrap(mid), depth: .6 }], floorY: 1010, spots: { center: 960, left: 520, right: 1400 } };
    },
    // dramatic dark spotlight
    spotlight(o) {
      const c = o.color || '#c8323a';
      return { layers: [{ svg: wrap(`<rect width="${W}" height="${H}" fill="#120d0c"/><radialGradient id="spt"><stop offset="0" stop-color="${c}" stop-opacity=".45"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient><ellipse cx="960" cy="560" rx="720" ry="520" fill="url(#spt)"/><ellipse cx="960" cy="1000" rx="360" ry="50" fill="#000" opacity=".5"/>`), depth: .2 }], floorY: 1000, spots: { center: 960 } };
    },
    // paper / desk close-up for props
    desk(o) {
      return { layers: [{ svg: wrap(`<rect width="${W}" height="${H}" fill="#5a3a24"/><rect width="${W}" height="${H}" fill="url(#planks)"/><radialGradient id="dl"><stop offset="0" stop-color="#ffe7b0" stop-opacity=".45"/><stop offset="1" stop-color="#ffe7b0" stop-opacity="0"/></radialGradient><ellipse cx="960" cy="520" rx="900" ry="500" fill="url(#dl)"/>`, patterns()), depth: .2 }], floorY: 1000, spots: { center: 960 } };
    },
  };

  window.BG = { make: (type, o = {}) => (SETS[type] || SETS.spotlight)(o), TYPES: Object.keys(SETS), shade };
})();
