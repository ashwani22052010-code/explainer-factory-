/* Puppet: parametric cartoon people, fully rigged (data-part groups) for animation.
   buildPerson(spec, pose, expression, framing) -> svg string */
(function () {
  const OUT = '#3A2418';
  const SK = { light: '#F3CBA5', medium: '#DFA77A', brown: '#B97C52', dark: '#7B4C30' };
  const HC = { black: '#231812', brown: '#5B3720', blonde: '#D9A94E', red: '#9A3B1E', grey: '#B9B4AC', white: '#EDEAE4' };
  const COL = {
    red: '#C8323A', maroon: '#7E2531', orange: '#E07B39', yellow: '#E2B33B', mustard: '#C9962E', green: '#3F8A4E',
    teal: '#1F7A74', blue: '#2F5FA8', navy: '#22305A', purple: '#5B3C8C', pink: '#D86A8E', white: '#F2EEE6',
    cream: '#EADBB8', grey: '#8A8A8A', black: '#2A2522', brown: '#7A4E2D', khaki: '#A8935E', beige: '#D6BF94'
  };
  const c = (v, d) => COL[v] || (typeof v === 'string' && v[0] === '#' ? v : COL[d] || d);
  const dark = (hex, a = .22) => { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; r = Math.round(r * (1 - a)); g = Math.round(g * (1 - a)); b = Math.round(b * (1 - a)); return `rgb(${r},${g},${b})`; };
  const S = `stroke="${OUT}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"`;

  function hairBack(h, col, age) {
    if (h === 'long') return `<path d="M120 150 Q110 330 150 390 L250 390 Q290 330 280 150 Z" fill="${col}" ${S}/>`;
    if (h === 'ponytail') return `<path d="M250 120 Q330 150 300 300 Q285 330 268 300 Q290 210 240 150 Z" fill="${col}" ${S}/>`;
    return '';
  }
  function hairFront(h, col) {
    switch (h) {
      case 'bald': return '';
      case 'curly': return `<path d="M126 160 Q118 92 160 78 Q170 56 200 64 Q232 52 246 78 Q286 88 276 160 Q262 118 236 112 Q214 124 196 110 Q172 124 150 112 Q134 126 126 160 Z" fill="${col}" ${S}/>
        <g fill="${col}" ${S}><circle cx="140" cy="100" r="16"/><circle cx="176" cy="74" r="17"/><circle cx="222" cy="72" r="17"/><circle cx="258" cy="98" r="16"/></g>`;
      case 'bun': return `<circle cx="200" cy="62" r="30" fill="${col}" ${S}/><path d="M126 165 Q120 82 200 78 Q280 82 274 165 Q262 112 200 106 Q138 112 126 165 Z" fill="${col}" ${S}/>`;
      case 'long': case 'ponytail': return `<path d="M124 175 Q118 80 200 76 Q282 80 276 175 Q268 118 214 108 Q200 132 170 116 Q140 126 124 175 Z" fill="${col}" ${S}/>`;
      case 'spiky': return `<path d="M128 150 L132 96 L152 112 L160 72 L182 100 L200 62 L218 100 L240 72 L248 112 L268 96 L272 150 Q240 112 200 112 Q160 112 128 150 Z" fill="${col}" ${S}/>`;
      default: return `<path d="M126 158 Q118 84 200 80 Q282 84 274 158 Q268 120 240 112 Q206 126 160 110 Q138 120 126 158 Z" fill="${col}" ${S}/>`;
    }
  }
  function hat(t, col) {
    switch (t) {
      case 'cowboy': return `<g fill="${c(col, 'brown')}" ${S}><path d="M70 128 Q200 168 330 128 Q318 150 200 160 Q82 150 70 128 Z"/><path d="M134 132 Q136 70 170 60 Q200 76 230 60 Q264 70 266 132 Q200 148 134 132 Z"/></g><path d="M136 120 Q200 136 264 120" fill="none" stroke="${dark(c(col, 'brown'), .4)}" stroke-width="12"/>`;
      case 'cap': return `<g fill="${c(col, 'red')}" ${S}><path d="M128 128 Q130 70 200 68 Q270 70 272 128 Z"/><path d="M200 126 Q290 118 320 138 Q280 146 200 140 Z"/></g>`;
      case 'turban': return `<g fill="${c(col, 'orange')}" ${S}><path d="M120 140 Q110 70 200 58 Q290 70 280 140 Q200 118 120 140 Z"/><path d="M130 112 Q200 70 270 112" fill="none"/><path d="M140 132 Q200 92 262 130" fill="none"/></g>`;
      case 'police': return `<g ${S}><path d="M126 130 Q126 74 200 72 Q274 74 274 130 Z" fill="${c(col, 'khaki')}"/><rect x="120" y="122" width="160" height="22" rx="8" fill="${dark(c(col, 'khaki'), .45)}"/><circle cx="200" cy="100" r="12" fill="#E2B33B"/></g>`;
      case 'helmet': return `<path d="M120 150 Q118 66 200 62 Q282 66 280 150 Z" fill="${c(col, 'yellow')}" ${S}/><path d="M200 62 L200 150" stroke="${OUT}" stroke-width="6"/>`;
      case 'crown': return `<path d="M140 108 L150 52 L178 86 L200 44 L222 86 L250 52 L260 108 Z" fill="#E2B33B" ${S}/>`;
      default: return '';
    }
  }
  function brows(ex) {
    const L = { neutral: 'M150 132 Q170 124 188 130', happy: 'M150 128 Q170 118 188 126', sad: 'M150 128 Q168 132 188 122', scared: 'M150 124 Q168 112 188 122', angry: 'M150 122 Q170 128 188 138', shocked: 'M150 118 Q170 106 188 116', sleeping: 'M152 136 Q170 132 188 136', thinking: 'M150 126 Q170 116 188 126' }[ex] || 'M150 132 Q170 124 188 130';
    const R = L.replace(/(\d+)(\s+)(\d+)/g, (m, x, s, y) => `${400 - +x}${s}${y}`);
    return `<g fill="none" stroke="${OUT}" stroke-width="7" stroke-linecap="round"><path d="${L}"/><path d="${R}"/></g>`;
  }
  function eyes(ex) {
    if (ex === 'sleeping' || ex === 'dead') return `<g fill="none" stroke="${OUT}" stroke-width="5" stroke-linecap="round"><path d="M156 166 Q170 174 186 166"/><path d="M214 166 Q230 174 244 166"/></g>`;
    const big = ex === 'shocked' || ex === 'scared';
    const ry = big ? 15 : 12, pr = big ? 5.5 : 7;
    const e = (x) => `<g data-part="eye"><ellipse cx="${x}" cy="166" rx="12" ry="${ry}" fill="#fff" stroke="${OUT}" stroke-width="4"/><circle cx="${x + 1}" cy="167" r="${pr}" fill="#2a1a12"/><circle cx="${x + 3}" cy="163" r="2.2" fill="#fff"/></g>`;
    return e(171) + e(229);
  }
  function mouth(ex) {
    let shape;
    switch (ex) {
      case 'happy': shape = `<path d="M176 214 Q200 238 224 214 Q200 222 176 214 Z" fill="#7a2a22" ${S}/>`; break;
      case 'sad': shape = `<path d="M182 226 Q200 212 218 226" fill="none" stroke="${OUT}" stroke-width="6" stroke-linecap="round"/>`; break;
      case 'shocked': case 'scared': shape = `<ellipse cx="200" cy="222" rx="13" ry="17" fill="#5a1d18" ${S}/>`; break;
      case 'angry': shape = `<path d="M180 224 Q200 214 220 224 Z" fill="#5a1d18" ${S}/>`; break;
      case 'sleeping': case 'dead': shape = `<path d="M188 220 Q200 224 212 220" fill="none" stroke="${OUT}" stroke-width="5" stroke-linecap="round"/>`; break;
      default: shape = `<path d="M182 216 Q200 228 218 216 Q200 224 182 216 Z" fill="#6e2620" ${S}/>`;
    }
    return `<g data-part="mouth" data-origin="200 216">${shape}</g>`;
  }
  function beard(b, col) {
    if (b === 'full') return `<path d="M132 182 Q136 268 200 276 Q264 268 268 182 Q252 232 226 236 Q200 222 174 236 Q148 232 132 182 Z" fill="${col}" ${S}/>`;
    if (b === 'stubble') return `<path d="M140 196 Q150 262 200 268 Q250 262 260 196 Q246 240 200 246 Q154 240 140 196 Z" fill="${col}" opacity=".35"/>`;
    if (b === 'mustache') return `<path d="M172 204 Q186 194 200 202 Q214 194 228 204 Q220 214 200 208 Q180 214 172 204 Z" fill="${col}" ${S}/>`;
    return '';
  }

  function torso(top, col, bottom, bcol, sk, len) {
    const y0 = 262, y1 = 262 + len;
    const cd = dark(col);
    let t = `<path d="M118 ${y0 + 34} Q122 ${y0} 170 ${y0 - 4} L230 ${y0 - 4} Q278 ${y0} 282 ${y0 + 34} L292 ${y1} Q200 ${y1 + 18} 108 ${y1} Z" fill="${col}" ${S}/>`;
    t += `<path d="M260 ${y0 + 40} L268 ${y1 - 6}" stroke="${cd}" stroke-width="16" opacity=".35"/>`;
    switch (top) {
      case 'shirt': t += `<path d="M176 ${y0 - 4} L200 ${y0 + 34} L224 ${y0 - 4}" fill="${sk}" ${S}/><path d="M168 ${y0 - 4} L190 ${y0 + 30} L176 ${y0 + 40} Z M232 ${y0 - 4} L210 ${y0 + 30} L224 ${y0 + 40} Z" fill="${COL.white}" ${S}/>` + [0, 1, 2].map(i => `<circle cx="200" cy="${y0 + 60 + i * 50}" r="5" fill="${cd}"/>`).join(''); break;
      case 'kurta': t += `<path d="M186 ${y0 - 4} L200 ${y0 + 60} L214 ${y0 - 4}" fill="none" stroke="${cd}" stroke-width="6"/>` + [0, 1, 2].map(i => `<circle cx="200" cy="${y0 + 18 + i * 18}" r="4" fill="${cd}"/>`).join(''); break;
      case 'suit': t += `<path d="M184 ${y0 - 4} L200 ${y0 + 80} L216 ${y0 - 4} Z" fill="${COL.white}" ${S}/><path d="M196 ${y0 + 6} L204 ${y0 + 6} L210 ${y0 + 80} L200 ${y0 + 96} L190 ${y0 + 80} Z" fill="${COL.red}" ${S}/><path d="M170 ${y0 - 4} L196 ${y0 + 90} L150 ${y0 + 40} Z M230 ${y0 - 4} L204 ${y0 + 90} L250 ${y0 + 40} Z" fill="${cd}" ${S}/>`; break;
      case 'uniform': t += `<path d="M176 ${y0 - 4} L200 ${y0 + 30} L224 ${y0 - 4}" fill="${sk}" ${S}/><rect x="112" y="${y1 - 70}" width="176" height="22" fill="${dark(col, .5)}"/><path d="M236 ${y0 + 50} l14 -10 l14 10 l-4 18 l-20 0 z" fill="#E2B33B" ${S}/>`; break;
      case 'saree': t += `<path d="M150 ${y0} Q230 ${y0 + 120} 290 ${y1} L250 ${y1} Q200 ${y0 + 140} 136 ${y0 + 20} Z" fill="${dark(col, -.0)}" opacity=".9" ${S}/><path d="M150 ${y0 + 14} Q230 ${y0 + 130} 280 ${y1 - 6}" fill="none" stroke="#E2B33B" stroke-width="8"/>`; break;
      case 'coat': t += `<path d="M170 ${y0 - 4} L198 ${y0 + 120} L148 ${y0 + 60} Z M230 ${y0 - 4} L202 ${y0 + 120} L252 ${y0 + 60} Z" fill="${cd}" ${S}/><path d="M200 ${y0 + 120} L200 ${y1}" stroke="${OUT}" stroke-width="4"/>`; break;
      case 'vest': t += `<path d="M150 ${y0 + 4} L196 ${y0 + 100} L196 ${y1} L118 ${y1} Z M250 ${y0 + 4} L204 ${y0 + 100} L204 ${y1} L282 ${y1} Z" fill="${dark(col, .35)}" ${S}/>`; break;
      default: t += `<path d="M176 ${y0 - 2} Q200 ${y0 + 18} 224 ${y0 - 2}" fill="none" stroke="${cd}" stroke-width="6"/>`; // tshirt
    }
    return t;
  }

  function arm(side, col, sk, len, base, sleeveLong) {
    const sx = side === 'l' ? 128 : 272, sy = 290;
    const dir = side === 'l' ? -1 : 1;
    const ex = sx + dir * 18, ey = sy + len;
    const sleeve = sleeveLong ? len - 16 : len * .45;
    const part = side === 'l' ? 'arm_left' : 'arm_right';
    return `<g data-part="${part}" data-origin="${sx} ${sy}"><g transform="rotate(${base} ${sx} ${sy})">
      <path d="M${sx - 22} ${sy - 6} L${ex - 17} ${ey} L${ex + 17} ${ey} L${sx + 22} ${sy - 6} Z" fill="${sk}" ${S}/>
      <path d="M${sx - 24} ${sy - 10} L${sx + dir * 18 * sleeve / len - 21} ${sy + sleeve} L${sx + dir * 18 * sleeve / len + 21} ${sy + sleeve} L${sx + 24} ${sy - 10} Q${sx} ${sy - 26} ${sx - 24} ${sy - 10} Z" fill="${col}" ${S}/>
      <circle cx="${ex}" cy="${ey + 10}" r="22" fill="${sk}" ${S}/></g></g>`;
  }

  function leg(side, bcol, len, hip, base, shoe, bare) {
    const lx = side === 'l' ? 168 : 232;
    const part = side === 'l' ? 'leg_left' : 'leg_right';
    const dir = side === 'l' ? -1 : 1;
    return `<g data-part="${part}" data-origin="${lx} ${hip}"><g transform="rotate(${base} ${lx} ${hip})">
      <path d="M${lx - 30} ${hip - 10} L${lx - 26} ${hip + len} L${lx + 26} ${hip + len} L${lx + 30} ${hip - 10} Z" fill="${bcol}" ${S}/>
      <path d="M${lx + dir * 6 - 34} ${hip + len + 22} Q${lx - 30} ${hip + len - 8} ${lx} ${hip + len - 6} Q${lx + 36} ${hip + len - 4} ${lx + dir * 26 + 20} ${hip + len + 22} Z" fill="${bare ? bare : shoe}" ${S}/></g></g>`;
  }

  const POSES = { // [armL, armR, legL, legR]
    stand: [8, -8, 2, -2], wave: [8, -150, 2, -2], point: [8, -95, 2, -2], hands_up: [160, -160, 4, -4],
    walk: [14, -14, 8, -8], sit: [10, -10, -80, -80], shrug: [40, -40, 2, -2], hold: [-30, 30, 2, -2],
    lie: [8, -8, 2, -2], drown: [60, -60, 4, -4], run: [40, -40, 20, -20], think: [8, -140, 2, -2]
  };

  window.buildPerson = function (spec, pose, expression, framing) {
    spec = spec || {};
    const age = spec.age || 'adult';
    const sk = SK[spec.skin] || SK.medium;
    const hcol = HC[spec.hair_color] || (age === 'old' ? HC.grey : HC.black);
    const top = spec.top || 'shirt', tcol = c(spec.top_color, 'teal');
    const bottom = spec.bottom || 'pants', bcol = c(spec.bottom_color, 'navy');
    const female = spec.gender === 'f';
    const torsoLen = age === 'child' ? 170 : age === 'teen' ? 230 : 270;
    const legLen = age === 'child' ? 190 : age === 'teen' ? 300 : 340;
    const armLen = age === 'child' ? 140 : 210;
    const hip = 262 + torsoLen - 10;
    const p = POSES[pose] || POSES.stand;
    const ex = expression || 'neutral';
    const longSleeve = ['shirt', 'kurta', 'suit', 'uniform', 'coat'].includes(top);
    const shoe = spec.shoes === 'none' ? null : '#3a2a20';
    const bare = (spec.shoes === 'none' || bottom === 'dhoti') ? sk : null;
    const H = hip + legLen + 40;

    let legs;
    if (bottom === 'skirt' || bottom === 'dress' || (female && top === 'saree')) {
      const skirtCol = top === 'saree' ? tcol : bcol;
      legs = leg('l', sk, legLen, hip + 60, p[2], shoe, bare) + leg('r', sk, legLen, hip + 60, p[3], shoe, bare) +
        `<path d="M118 ${hip - 20} L${top === 'saree' ? 96 : 92} ${hip + legLen * (top === 'saree' ? 1 : .55)} L${top === 'saree' ? 304 : 308} ${hip + legLen * (top === 'saree' ? 1 : .55)} L282 ${hip - 20} Z" fill="${skirtCol}" ${S}/>`;
    } else if (bottom === 'shorts') {
      legs = leg('l', sk, legLen, hip, p[2], shoe, bare) + leg('r', sk, legLen, hip, p[3], shoe, bare) +
        `<path d="M122 ${hip - 20} L118 ${hip + 110} L196 ${hip + 110} L200 ${hip + 40} L204 ${hip + 110} L282 ${hip + 110} L278 ${hip - 20} Z" fill="${bcol}" ${S}/>`;
    } else if (bottom === 'dhoti') {
      legs = leg('l', sk, legLen, hip, p[2], shoe, sk) + leg('r', sk, legLen, hip, p[3], shoe, sk) +
        `<path d="M118 ${hip - 20} L110 ${hip + legLen * .7} L196 ${hip + legLen * .72} L200 ${hip + 60} L204 ${hip + legLen * .72} L290 ${hip + legLen * .7} L282 ${hip - 20} Z" fill="${bcol}" ${S}/>`;
    } else {
      legs = leg('l', bcol, legLen, hip, p[2], shoe, null) + leg('r', bcol, legLen, hip, p[3], shoe, null);
    }
    const kurtaHem = top === 'kurta' ? `<path d="M110 ${hip - 30} L100 ${hip + 120} L300 ${hip + 120} L290 ${hip - 30} Z" fill="${tcol}" ${S}/>` : '';
    const coatHem = top === 'coat' ? `<path d="M110 ${hip - 30} L96 ${hip + 160} L196 ${hip + 160} L200 ${hip} L204 ${hip + 160} L304 ${hip + 160} L290 ${hip - 30} Z" fill="${tcol}" ${S}/>` : '';
    const wrinkles = age === 'old' ? `<g fill="none" stroke="${OUT}" stroke-width="3" opacity=".45"><path d="M160 112 Q200 104 240 112"/><path d="M146 196 Q152 204 150 214"/><path d="M254 196 Q248 204 250 214"/></g>` : '';
    const glasses = spec.glasses ? `<g fill="rgba(255,255,255,.25)" stroke="${OUT}" stroke-width="5"><circle cx="171" cy="166" r="21"/><circle cx="229" cy="166" r="21"/><path d="M192 164 L208 164"/></g>` : '';
    const blush = ['happy', 'shocked'].includes(ex) ? `<g fill="#e07a6a" opacity=".35"><ellipse cx="146" cy="200" rx="14" ry="8"/><ellipse cx="254" cy="200" rx="14" ry="8"/></g>` : '';
    const tear = ex === 'sad' ? `<path d="M244 182 Q250 196 244 204 Q238 196 244 182 Z" fill="#7cc0ee" stroke="${OUT}" stroke-width="2"/>` : '';
    const sweat = ex === 'scared' ? `<path d="M276 120 Q286 138 276 148 Q266 138 276 120 Z" fill="#9ad3f5" stroke="${OUT}" stroke-width="3"/>` : '';

    const backHair = `<g>${hairBack(spec.hair, hcol)}</g>`;
    const head = `<g data-part="head" data-origin="200 250">
      <ellipse cx="128" cy="176" rx="14" ry="20" fill="${sk}" ${S}/><ellipse cx="272" cy="176" rx="14" ry="20" fill="${sk}" ${S}/>
      <path d="M128 160 Q126 84 200 82 Q274 84 272 160 Q272 250 200 258 Q128 250 128 160 Z" fill="${sk}" ${S}/>
      <path d="M248 120 Q268 170 250 230" fill="none" stroke="${dark(sk, .25)}" stroke-width="10" opacity=".4"/>
      ${wrinkles}${blush}${eyes(ex)}${brows(ex)}
      <path d="M198 178 Q192 198 200 202 Q206 202 210 198" fill="none" stroke="${dark(sk, .45)}" stroke-width="5" stroke-linecap="round"/>
      ${beard(spec.beard, hcol)}${mouth(ex)}${tear}${sweat}${glasses}
      ${hat(spec.hat, spec.hat_color) ? hairFront(spec.hair === 'long' ? 'long' : 'bald', hcol) + hat(spec.hat, spec.hat_color) : hairFront(spec.hair, hcol)}
      ${female && spec.bindi !== false && spec.bindi ? `<circle cx="200" cy="140" r="5" fill="#C8323A"/>` : ''}
    </g>`;

    const body = `<g data-part="body" data-origin="200 ${hip}">
      ${legs}${kurtaHem}${coatHem}
      ${torso(top, tcol, bottom, bcol, sk, torsoLen)}
      <rect x="180" y="236" width="40" height="34" fill="${sk}" ${S}/>
    </g>`;
    const arms = arm('l', tcol, sk, armLen, p[0], longSleeve) + arm('r', tcol, sk, armLen, p[1], longSleeve);
    const raised = ['wave', 'point', 'think', 'hands_up', 'drown'].includes(pose);
    const order = backHair + (raised ? body + head + arms : body + arms + head);
    let vb = `-70 20 540 ${H}`;
    if (framing === 'bust') vb = `0 40 400 ${Math.round(torsoLen * .62 + 240)}`;
    if (framing === 'head') vb = `90 40 220 240`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" preserveAspectRatio="xMidYMid meet">${order}</svg>`;
  };
})();
