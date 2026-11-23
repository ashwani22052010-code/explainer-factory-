/* Pro 2D characters: semi-realistic proportions, 2-tone cel shading, outfits with folds,
   hands with fingers, pose library, expressions and visemes.  window.CH.build(spec) -> {svg, rig}
   The SVG is built ONCE per character; per-frame animation only changes transforms / visibility. */
(function () {
  const OUT = '#2a1c16';
  const SK = { light: ['#f1cfb2', '#d9ab8a'], medium: ['#deaa80', '#c08660'], brown: ['#b97e55', '#975f3c'], dark: ['#7d5036', '#5e3a26'] };
  const HC = { black: ['#2a201c', '#171110', '#4a3a33'], brown: ['#5c3b25', '#3e2717', '#7c5638'], grey: ['#9d9893', '#7a7570', '#c2beb9'],
    white: ['#e6e2dc', '#c4bfb8', '#ffffff'], blonde: ['#d2a75c', '#a97f3c', '#ecc983'] };
  const C = { red: '#b8343a', maroon: '#7a2632', orange: '#d9773a', yellow: '#d9ac3a', mustard: '#c29434', green: '#3f7f4c', olive: '#6d7340',
    teal: '#2b7f7a', blue: '#3762a8', navy: '#28365e', purple: '#5e4290', pink: '#d27896', white: '#eeebe4', cream: '#e6d8b8', grey: '#7f8287',
    charcoal: '#3a3a3f', black: '#26232a', brown: '#6e4a30', khaki: '#a39264', beige: '#cfbb93', denim: '#3d5f8c', gold: '#d6a63a' };
  const col = (v, d) => C[v] || (typeof v === 'string' && v[0] === '#' ? v : C[d] || d);
  function shade(hex, a) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; const t = a < 0 ? 0 : 255, p = Math.abs(a);
    r = Math.round(r + (t - r) * p); g = Math.round(g + (t - g) * p); b = Math.round(b + (t - b) * p); return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1); }
  const S = (w = 3) => `stroke="${OUT}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
  let uid = 0;

  // ---------- limbs (local coords: joint at 0,0, limb pointing +y) ----------
  function limb(len, w0, w1, base, dark, extra = '') {
    const p = `M${-w0 / 2} 0 Q${-w0 / 2 - 2} ${len * .5} ${-w1 / 2} ${len} L${w1 / 2} ${len} Q${w0 / 2 + 2} ${len * .5} ${w0 / 2} 0 Z`;
    const sh = `M${w0 * .12} 0 Q${w0 / 2 + 1} ${len * .5} ${w1 / 2} ${len} L${w1 / 2 - w1 * .3} ${len} Q${w0 * .25} ${len * .5} ${w0 * .05} 0 Z`;
    return `<path d="${p}" fill="${base}"/><path d="${sh}" fill="${dark}"/>${extra}<path d="${p}" fill="none" ${S()}/>`;
  }
  function hand(kind, skin, dark, side) {
    const m = side; // mirror for left
    const palm = `<path d="M-15 0 Q-18 22 -12 38 Q0 46 12 38 Q18 22 15 0 Z" fill="${skin}" ${S(2.5)}/><path d="M6 2 Q14 22 10 36 Q14 30 15 14 L15 0 Z" fill="${dark}"/>`;
    const thumb = `<path d="M${-14 * m} 8 Q${-26 * m} 20 ${-22 * m} 30 Q${-16 * m} 30 ${-12 * m} 20" fill="${skin}" ${S(2.5)}/>`;
    if (kind === 'fist') return `<g>${thumb}<path d="M-15 0 Q-18 18 -14 32 Q0 40 14 32 Q18 18 15 0 Z" fill="${skin}" ${S(2.5)}/><path d="M-12 22 Q-6 26 0 22 Q6 26 12 22" fill="none" stroke="${OUT}" stroke-width="2"/></g>`;
    if (kind === 'point') return `<g><path d="M-15 0 Q-18 18 -14 30 Q0 38 14 30 Q18 18 15 0 Z" fill="${skin}" ${S(2.5)}/><path d="M${-4 * m} 28 L${-6 * m} 66 Q${-2 * m} 72 ${3 * m} 66 L${5 * m} 30" fill="${skin}" ${S(2.5)}/>${thumb}</g>`;
    if (kind === 'flat') return `<g>${palm}<path d="M-12 36 L-13 58 M-4 40 L-4 64 M4 40 L5 63 M12 36 L13 56" stroke="${skin}" stroke-width="8" stroke-linecap="round"/><path d="M-12 36 L-13 58 M-4 40 L-4 64 M4 40 L5 63 M12 36 L13 56" stroke="${OUT}" stroke-width="10" stroke-linecap="round" opacity="0"/>${thumb}</g>`;
    // relaxed open hand with fingers
    return `<g>${palm}<g stroke="${OUT}" stroke-width="2" fill="none"><path d="M-8 30 L-9 46"/><path d="M0 33 L0 50"/><path d="M8 30 L9 45"/></g>${thumb}</g>`;
  }

  // ---------- poses: hand targets in character space (2-bone IK solves the arm) ----------
  // R = character's right arm = viewer's LEFT side. {h:[x,y], k:hand kind, f:in front of body, up:elbow bends up}
  const POSES = {
    stand: { R: { h: [104, 640], k: 'open' }, L: { h: [296, 640], k: 'open' } },
    hands_hips: { R: { h: [140, 486], k: 'fist', out: 1 }, L: { h: [260, 486], k: 'fist', out: 1 } },
    cross_arms: { R: { h: [262, 392], k: 'fist', f: 1, out: 1 }, L: { h: [140, 404], k: 'fist', f: 2, out: 1 } },
    point: { R: { h: [-236, 292], k: 'point' }, L: { h: [296, 640], k: 'open' } },
    hey: { R: { h: [-170, 150], k: 'flat', out: 1 }, L: { h: [296, 640], k: 'open' } },
    secret: { R: { h: [204, 196], k: 'point', f: 3 }, L: { h: [296, 640], k: 'open' } },
    think: { R: { h: [206, 222], k: 'fist', f: 3 }, L: { h: [232, 420], k: 'fist', f: 2 } },
    shock: { R: { h: [138, 124], k: 'flat', f: 1, up: 1 }, L: { h: [262, 124], k: 'flat', f: 1, up: 1 } },
    celebrate: { R: { h: [20, -70], k: 'fist', up: 1 }, L: { h: [380, -70], k: 'fist', up: 1 } },
    phone_look: { R: { h: [214, 372], k: 'phone', f: 2 }, L: { h: [186, 384], k: 'open', f: 1 } },
    phone_ear: { R: { h: [136, 142], k: 'phone', f: 3 }, L: { h: [296, 640], k: 'open' } },
    hold: { R: { h: [232, 420], k: 'open', f: 1 }, L: { h: [168, 420], k: 'open', f: 1 } },
    shrug: { R: { h: [36, 372], k: 'flat', out: 1 }, L: { h: [364, 372], k: 'flat', out: 1 } },
    sad: { R: { h: [118, 630], k: 'open' }, L: { h: [282, 630], k: 'open' } },
    pray: { R: { h: [206, 330], k: 'flat', f: 1 }, L: { h: [194, 330], k: 'flat', f: 1 } },
    wave: { R: { h: [-60, 80], k: 'flat', up: 1 }, L: { h: [296, 640], k: 'open' } },
    count: { R: { h: [226, 408], k: 'open', f: 1 }, L: { h: [180, 420], k: 'hold', f: 2 } },
    fist_up: { R: { h: [60, -60], k: 'fist', up: 1 }, L: { h: [296, 640], k: 'open' } },
    cry: { R: { h: [172, 150], k: 'flat', f: 3 }, L: { h: [228, 150], k: 'flat', f: 3 } },
    hug: { R: { h: [40, 330], k: 'open', f: 1 }, L: { h: [360, 330], k: 'open', f: 1 } },
    explain: { R: { h: [60, 420], k: 'flat' }, L: { h: [296, 640], k: 'open' } },
    present: { R: { h: [-40, 380], k: 'flat', out: 1 }, L: { h: [440, 380], k: 'flat', out: 1 } },
    headache: { R: { h: [140, 70], k: 'flat', f: 1, up: 1 }, L: { h: [296, 640], k: 'open' } },
  };
  function ik(S, T, a, b, side, up) {
    let dx = T[0] - S[0], dy = T[1] - S[1], d = Math.hypot(dx, dy);
    const dc = Math.min(a + b - .5, Math.max(Math.abs(a - b) + .5, d)); dx *= dc / (d || 1); dy *= dc / (d || 1);
    const phi = Math.atan2(dy, dx), al = Math.acos(Math.max(-1, Math.min(1, (a * a + dc * dc - b * b) / (2 * a * dc))));
    const cands = [phi + al, phi - al].map(t => [S[0] + Math.cos(t) * a, S[1] + Math.sin(t) * a]);
    // pick elbow: away from body (R -> smaller x, L -> larger x); if up-bend, prefer lower elbow for raised arms looks natural
    let E;
    if (up === 'out') E = side === 'R' ? (cands[0][0] < cands[1][0] ? cands[0] : cands[1]) : (cands[0][0] > cands[1][0] ? cands[0] : cands[1]);
    else if (up) E = cands[0][1] < cands[1][1] ? cands[0] : cands[1];
    else E = cands[0][1] > cands[1][1] ? cands[0] : cands[1];
    const ang = (x, y) => Math.atan2(-x, y) * 180 / Math.PI; // rotation that maps (0,1) to (x,y) (clockwise +)
    const th1 = ang(E[0] - S[0], E[1] - S[1]), th2 = ang(S[0] + dx - E[0], S[1] + dy - E[1]);
    return [th1, th2 - th1];
  }

  const EXP = {
    neutral: { brow: [0, 0], lid: 0, mouth: 'line' }, happy: { brow: [-4, 4], lid: .25, mouth: 'smile' }, joy: { brow: [-8, 6], lid: .45, mouth: 'grin' },
    sad: { brow: [10, -6], lid: .4, mouth: 'frown' }, angry: { brow: [-12, 6], lid: .3, mouth: 'tight' }, shock: { brow: [-12, -12], lid: -.2, mouth: 'O' },
    scared: { brow: [12, -10], lid: -.1, mouth: 'open_frown' }, worried: { brow: [12, -4], lid: .15, mouth: 'line' }, smirk: { brow: [-4, 0], lid: .3, mouth: 'smirk' },
    thinking: { brow: [8, -6], lid: .25, mouth: 'line' }, determined: { brow: [-8, 4], lid: .3, mouth: 'tight' }, sleep: { brow: [0, 2], lid: 1, mouth: 'line' },
  };

  function mouthShape(kind, w = 1) {
    const d = { // centered at 0,0
      line: `<path d="M${-16 * w} 0 Q0 3 ${16 * w} 0" fill="none" stroke="${OUT}" stroke-width="3" stroke-linecap="round"/>`,
      smile: `<path d="M${-18 * w} -3 Q0 12 ${18 * w} -3" fill="none" stroke="${OUT}" stroke-width="3.2" stroke-linecap="round"/>`,
      grin: `<path d="M${-20 * w} -4 Q0 22 ${20 * w} -4 Z" fill="#5b1f1d" ${S(2.5)}/><path d="M${-16 * w} -2 Q0 4 ${16 * w} -2 L${15 * w} 2 Q0 7 ${-15 * w} 2 Z" fill="#fbf6ee"/>`,
      frown: `<path d="M${-15 * w} 4 Q0 -6 ${15 * w} 4" fill="none" stroke="${OUT}" stroke-width="3" stroke-linecap="round"/>`,
      tight: `<path d="M${-14 * w} 1 L${14 * w} -1" stroke="${OUT}" stroke-width="3.4" stroke-linecap="round"/>`,
      O: `<ellipse cx="0" cy="3" rx="${10 * w}" ry="13" fill="#4a1816" ${S(2.5)}/>`,
      open_frown: `<path d="M${-13 * w} 6 Q0 -8 ${13 * w} 6 Q0 14 ${-13 * w} 6 Z" fill="#4a1816" ${S(2.5)}/>`,
      smirk: `<path d="M${-14 * w} 1 Q4 4 ${17 * w} -5" fill="none" stroke="${OUT}" stroke-width="3" stroke-linecap="round"/>`,
      // visemes
      v_closed: `<path d="M-14 0 L14 0" stroke="${OUT}" stroke-width="3.4" stroke-linecap="round"/>`,
      v_small: `<path d="M-12 -1 Q0 -4 12 -1 Q0 8 -12 -1 Z" fill="#4a1816" ${S(2.5)}/>`,
      v_wide: `<path d="M-17 -2 Q0 -6 17 -2 Q0 16 -17 -2 Z" fill="#4a1816" ${S(2.5)}/><path d="M-13 -2 Q0 -4 13 -2 L12 1 Q0 0 -12 1 Z" fill="#fbf6ee"/>`,
      v_e: `<path d="M-18 -1 Q0 -4 18 -1 Q0 8 -18 -1 Z" fill="#4a1816" ${S(2.5)}/><path d="M-14 -1 Q0 -3 14 -1 L13 1 Q0 1 -13 1 Z" fill="#fbf6ee"/>`,
      v_o: `<ellipse cx="0" cy="2" rx="8" ry="10" fill="#4a1816" ${S(2.5)}/>`,
      v_f: `<path d="M-13 0 Q0 -3 13 0 Q0 5 -13 0 Z" fill="#4a1816" ${S(2.5)}/><path d="M-10 -1 L10 -1" stroke="#fbf6ee" stroke-width="2.4"/>`,
    }[kind];
    return d || '';
  }

  function hairFront(style, h, female) {
    const [b, d, hl] = h;
    switch (style) {
      case 'bald': return `<path d="M150 70 Q200 52 250 70" fill="none" stroke="${shade(b, .2)}" stroke-width="2" opacity=".4"/>`;
      case 'long': case 'bun': case 'ponytail': case 'braid':
        return `<path d="M136 112 Q130 48 200 40 Q270 48 264 112 Q256 76 228 66 Q210 84 172 74 Q150 82 136 112 Z" fill="${b}" ${S()}/>
          <path d="M150 70 Q180 56 214 58" fill="none" stroke="${hl}" stroke-width="4" opacity=".5" stroke-linecap="round"/><path d="M200 44 Q196 60 200 72" stroke="${d}" stroke-width="3" fill="none"/>`;
      case 'curly': return `<g fill="${b}" ${S()}>${[[150, 70, 22], [174, 52, 24], [204, 46, 25], [232, 54, 23], [252, 76, 20], [140, 96, 16], [262, 98, 15]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`;
      case 'side_part': return `<path d="M136 116 Q128 46 200 36 Q272 44 266 116 Q262 82 246 72 Q214 66 182 70 Q156 74 142 98 Z" fill="${b}" ${S()}/><path d="M182 40 Q170 60 178 72" stroke="${d}" stroke-width="3" fill="none"/><path d="M196 46 Q232 50 250 70" fill="none" stroke="${hl}" stroke-width="4" opacity=".55" stroke-linecap="round"/>`;
      case 'messy': return `<path d="M134 118 Q124 44 196 34 Q276 38 268 118 L256 86 L246 104 L236 76 L222 96 L206 70 L192 94 L176 72 L164 98 L150 80 L144 104 Z" fill="${b}" ${S()}/><path d="M170 46 Q210 40 240 56" fill="none" stroke="${hl}" stroke-width="4" opacity=".5"/>`;
      default: // short
        return `<path d="M136 114 Q126 48 200 38 Q274 48 264 114 Q258 80 236 70 Q200 80 166 70 Q144 80 136 114 Z" fill="${b}" ${S()}/><path d="M160 56 Q200 44 240 58" fill="none" stroke="${hl}" stroke-width="4" opacity=".5" stroke-linecap="round"/><path d="M190 42 Q186 58 194 68 M214 44 Q216 58 210 68" stroke="${d}" stroke-width="2.5" fill="none"/>`;
    }
  }
  function hairBack(style, h) {
    const [b, d] = h;
    if (style === 'long') return `<path d="M134 110 Q118 260 150 312 L250 312 Q282 260 266 110 Z" fill="${b}" ${S()}/><path d="M236 140 Q250 230 240 306" stroke="${d}" stroke-width="10" fill="none" opacity=".6"/>`;
    if (style === 'bun') return `<circle cx="200" cy="40" r="30" fill="${b}" ${S()}/><path d="M184 30 Q200 22 216 32" stroke="${d}" stroke-width="3" fill="none"/>`;
    if (style === 'braid') return `<g fill="${b}" ${S()}>${[0, 1, 2, 3, 4, 5].map(i => `<ellipse cx="${236 + (i % 2) * 6}" cy="${150 + i * 32}" rx="16" ry="20"/>`).join('')}</g>`;
    if (style === 'ponytail') return `<path d="M246 80 Q300 120 276 230 Q266 250 254 228 Q276 150 232 104 Z" fill="${b}" ${S()}/>`;
    return '';
  }

  function outfit(spec, f, skin) {
    const top = col(spec.top_color, 'teal'), topD = shade(top, -.25), bot = col(spec.bottom_color, 'charcoal'), botD = shade(bot, -.28);
    const type = spec.top || 'shirt';
    const W = f ? 124 : 140; // half shoulder spread from center 200 -> shoulders at 200±W*0.62
    const sx0 = 200 - (f ? 74 : 86), sx1 = 200 + (f ? 74 : 86);
    const wx0 = 200 - (f ? 56 : 66), wx1 = 200 + (f ? 56 : 66);
    const torso = `M${sx0} 238 Q200 224 ${sx1} 238 Q${sx1 + 6} 300 ${wx1 + 4} 380 L${wx1} 500 L${wx0} 500 L${wx0 - 4} 380 Q${sx0 - 6} 300 ${sx0} 238 Z`;
    const torsoSh = `M${200 + 30} 236 Q${sx1} 240 ${sx1 + 2} 300 L${wx1} 500 L${200 + 36} 500 Q${200 + 46} 380 ${200 + 30} 236 Z`;
    let g = '';
    // legs / bottoms
    const longKurta = type === 'kurta' || type === 'kameez';
    if (type === 'saree' || spec.bottom === 'skirt_long') {
      const sc = type === 'saree' ? top : bot;
      g += `<path d="M${wx0 - 4} 470 Q${wx0 - 30} 740 ${wx0 - 46} 988 L${wx1 + 46} 988 Q${wx1 + 30} 740 ${wx1 + 4} 470 Z" fill="${sc}" ${S()}/>
        <path d="M200 520 L196 986 M214 520 L222 986 M228 520 L246 986 M186 520 L172 986" stroke="${shade(sc, -.2)}" stroke-width="3" fill="none"/>
        <path d="M${wx1 - 10} 480 Q${wx1 + 30} 740 ${wx1 + 46} 988 L${wx1 + 10} 988 Q${wx1} 740 ${wx1 - 30} 490 Z" fill="${shade(sc, -.25)}"/>
        <path d="M${wx0 - 46} 972 L${wx1 + 46} 972" stroke="${col(spec.accent, 'gold')}" stroke-width="12"/>`;
    } else {
      const legs = spec.bottom === 'shorts' ? 'shorts' : 'pants';
      for (const [x0, x1, sh] of [[wx0 - 2, 199, false], [201, wx1 + 2, true]]) {
        const knee = 735, ank = 968;
        const lx0 = x0 + 4, lx1 = x1 - 4;
        g += `<path d="M${x0} 492 L${lx0 + 4} ${knee} L${lx0 + 10} ${ank} L${lx1 - 8} ${ank} L${lx1 - 2} ${knee} L${x1} 492 Z" fill="${legs === 'shorts' ? skin[0] : bot}" ${S()}/>`;
        g += `<path d="M${(x0 + x1) / 2 + 8} 500 L${(lx0 + lx1) / 2 + 10} ${knee} L${(lx0 + lx1) / 2 + 8} ${ank} L${lx1 - 8} ${ank} L${lx1 - 2} ${knee} L${x1} 500 Z" fill="${legs === 'shorts' ? skin[1] : botD}"/>`;
        if (legs === 'shorts') g += `<path d="M${x0} 492 L${x0 + 2} 640 L${x1 - 2} 640 L${x1} 492 Z" fill="${bot}" ${S()}/>`;
        else g += `<path d="M${(x0 + x1) / 2} 520 L${(lx0 + lx1) / 2} ${ank - 10}" stroke="${botD}" stroke-width="2" opacity=".7"/><path d="M${lx0 + 12} ${knee - 10} Q${(lx0 + lx1) / 2} ${knee + 4} ${lx1 - 10} ${knee - 8}" stroke="${botD}" stroke-width="2.5" fill="none"/>`;
      }
      if (spec.bottom === 'dhoti') g += `<path d="M${wx0 - 6} 492 Q200 520 ${wx1 + 6} 492 L${wx1 + 20} 900 L${wx0 - 20} 900 Z" fill="${C.white}" ${S()}/><path d="M200 500 Q190 700 206 900" stroke="#cfc8b8" stroke-width="4" fill="none"/>`;
    }
    // shoes
    for (const x of [172, 228]) g += `<path d="M${x - 30} 988 Q${x - 32} 964 ${x - 12} 962 L${x + 14} 962 Q${x + 34} 968 ${x + 36} 988 Z" fill="${spec.shoes === 'sandal' ? skin[0] : '#3b2a22'}" ${S()}/><path d="M${x - 26} 978 L${x + 32} 978" stroke="${spec.shoes === 'sandal' ? '#6e4a30' : '#1e1510'}" stroke-width="${spec.shoes === 'sandal' ? 6 : 3}"/>`;
    // torso garment
    const tl = longKurta ? 680 : 500;
    if (longKurta) g += `<path d="M${wx0 - 4} 380 L${wx0 - 22} ${tl} L${wx1 + 22} ${tl} L${wx1 + 4} 380 Z" fill="${top}" ${S()}/><path d="M${200 + 40} 400 L${wx1 + 22} ${tl} L${200 + 50} ${tl} Z" fill="${topD}"/><path d="M${wx0 - 14} 560 L${wx0 - 8} ${tl} M${wx1 + 14} 560 L${wx1 + 8} ${tl}" stroke="${OUT}" stroke-width="2.5"/>`;
    g += `<path d="${torso}" fill="${type === 'saree' ? col(spec.blouse_color, 'gold') : top}"/><path d="${torsoSh}" fill="${type === 'saree' ? shade(col(spec.blouse_color, 'gold'), -.25) : topD}"/>`;
    // folds
    g += `<path d="M${wx0 + 14} 420 Q${wx0 + 26} 450 ${wx0 + 22} 488 M${wx1 - 18} 410 Q${wx1 - 30} 450 ${wx1 - 24} 488" stroke="${topD}" stroke-width="3" fill="none" opacity=".8"/>`;
    g += `<path d="${torso}" fill="none" ${S()}/>`;
    // neck opening & details per type
    if (type === 'shirt' || type === 'vest' || type === 'suit' || type === 'coat') {
      const inner = type === 'shirt' ? top : col(spec.shirt_color, 'white');
      g += `<path d="M182 228 L200 270 L218 228 Z" fill="${skin[0]}" ${S(2.5)}/>`;
      g += `<path d="M178 226 L200 266 L186 282 L168 238 Z M222 226 L200 266 L214 282 L232 238 Z" fill="${inner}" ${S(2.5)}/>`;
      if (type === 'shirt') { g += [300, 350, 400, 450].map(y => `<circle cx="200" cy="${y}" r="3.6" fill="${topD}" ${S(1.2)}/>`).join('') + `<path d="M200 270 L200 500" stroke="${topD}" stroke-width="2.5"/><path d="M${sx0 + 22} 300 L${sx0 + 56} 300 L${sx0 + 54} 336 L${sx0 + 24} 336 Z" fill="none" stroke="${topD}" stroke-width="2.5"/>`; }
      if (type === 'vest' || type === 'suit' || type === 'coat') {
        const jc = type === 'vest' ? col(spec.vest_color, 'charcoal') : top, jd = shade(jc, -.3);
        if (type !== 'vest') g += `<path d="M186 282 L200 266 L214 282 L210 470 L190 470 Z" fill="${inner}"/>` + (spec.tie !== false ? `<path d="M194 274 L206 274 L210 400 L200 416 L190 400 Z" fill="${col(spec.tie_color, 'red')}" ${S(2)}/>` : '');
        g += `<path d="M${sx0 + 4} 240 L186 282 L196 ${type === 'vest' ? 498 : 520} L${wx0 - 4} ${type === 'vest' ? 498 : 520} L${wx0 - 4} 380 Q${sx0 - 6} 300 ${sx0 + 4} 240 Z" fill="${jc}" ${S()}/>`;
        g += `<path d="M${sx1 - 4} 240 L214 282 L204 ${type === 'vest' ? 498 : 520} L${wx1 + 4} ${type === 'vest' ? 498 : 520} L${wx1 + 4} 380 Q${sx1 + 6} 300 ${sx1 - 4} 240 Z" fill="${jd}" ${S()}/>`;
        if (type !== 'vest') g += `<path d="M178 226 L200 300 L170 262 Z M222 226 L200 300 L230 262 Z" fill="${jd}" ${S(2)}/>`;
        g += [350, 410, 465].map(y => `<circle cx="${type === 'vest' ? 206 : 208}" cy="${y}" r="4" fill="${shade(jc, .35)}" ${S(1.2)}/>`).join('');
      }
    } else if (type === 'kurta' || type === 'kameez') {
      g += `<path d="M184 232 Q200 244 216 232 L212 300 L188 300 Z" fill="${topD}" ${S(2)}/>` + [256, 274, 292].map(y => `<circle cx="200" cy="${y}" r="3" fill="${shade(top, .4)}" ${S(1)}/>`).join('');
    } else if (type === 'saree') {
      g += `<path d="M${sx1 + 4} 236 Q240 330 ${wx0 - 10} 500 L${wx0 + 40} 500 Q260 360 ${sx1 + 8} 280 Z" fill="${top}" ${S()}/><path d="M${sx1 + 2} 246 Q250 330 ${wx0 + 8} 490" stroke="${col(spec.accent, 'gold')}" stroke-width="7" fill="none"/>`;
      g += `<path d="M180 230 Q200 250 220 230" fill="${skin[0]}" ${S(2)}/>`;
    } else { // tshirt
      g += `<path d="M178 230 Q200 252 222 230" fill="${skin[0]}" ${S(2.5)}/><path d="M180 234 Q200 254 220 234" fill="none" stroke="${topD}" stroke-width="4"/>`;
    }
    if (spec.belt !== false && !longKurta && type !== 'saree') g += `<rect x="${wx0 - 2}" y="490" width="${wx1 - wx0 + 4}" height="16" fill="#3b2a22" ${S(2)}/><rect x="192" y="488" width="18" height="20" rx="3" fill="#c9a24a" ${S(2)}/>`;
    return g;
  }

  function build(spec = {}) {
    const id = 'c' + (uid++);
    const f = spec.gender === 'f';
    const skin = SK[spec.skin] || SK.medium;
    const hair = HC[spec.hair_color] || (spec.age === 'old' ? HC.grey : HC.black);
    const hs = spec.hair || (f ? 'long' : 'short');
    const top = col(spec.top_color, 'teal'), topD = shade(top, -.25);
    const longSleeve = !['tshirt', 'saree', 'vest_only'].includes(spec.top || 'shirt') && spec.sleeves !== 'short';
    const sleeveCol = spec.top === 'vest' || spec.top === 'suit' || spec.top === 'coat' ? (spec.top === 'vest' ? col(spec.shirt_color, 'white') : top) : top;
    const sx0 = 200 - (f ? 74 : 86), sx1 = 200 + (f ? 74 : 86);
    const old = spec.age === 'old', child = spec.age === 'child', teen = spec.age === 'teen';

    // ---- head ----
    const jaw = f ? `M140 110 Q138 42 200 40 Q262 42 260 110 L256 144 Q246 180 216 194 Q200 200 184 194 Q154 180 144 144 Z`
                  : `M138 110 Q136 40 200 38 Q264 40 262 110 L260 146 Q254 178 224 194 Q200 202 176 194 Q146 178 140 146 Z`;
    const faceShade = `M226 40 Q262 44 262 110 L260 146 Q254 178 224 194 Q212 198 204 198 Q236 176 240 140 Q248 100 226 40 Z`;
    const head = `
      <g id="${id}-hb">${hairBack(hs, hair)}</g>
      <path d="M182 180 L182 236 Q200 246 218 236 L218 180 Z" fill="${skin[0]}" ${S()}/><path d="M182 186 Q200 214 218 186 L218 210 Q200 224 182 210 Z" fill="${skin[1]}"/>
      <g id="${id}-head">
        <ellipse cx="136" cy="124" rx="12" ry="20" fill="${skin[0]}" ${S()}/><ellipse cx="264" cy="124" rx="12" ry="20" fill="${skin[1]}" ${S()}/>
        <path d="${jaw}" fill="${skin[0]}"/><path d="${faceShade}" fill="${skin[1]}" opacity=".85"/><path d="${jaw}" fill="none" ${S()}/>
        ${old ? `<g stroke="${skin[1]}" stroke-width="2.5" fill="none" opacity=".9"><path d="M168 80 Q200 72 232 80"/><path d="M164 150 Q170 162 168 172"/><path d="M236 150 Q230 162 232 172"/></g>` : ''}
        <g id="${id}-brows">
          <path id="${id}-browL" d="M160 98 Q174 90 190 96" fill="none" stroke="${hair[1]}" stroke-width="${f ? 4 : 6}" stroke-linecap="round"/>
          <path id="${id}-browR" d="M210 96 Q226 90 240 98" fill="none" stroke="${hair[1]}" stroke-width="${f ? 4 : 6}" stroke-linecap="round"/>
        </g>
        <g id="${id}-eyes">
          ${[176, 224].map((x, i) => `<g id="${id}-eye${i}">
            <path d="M${x - 15} 118 Q${x} 106 ${x + 15} 118 Q${x} 128 ${x - 15} 118 Z" fill="#fbf8f3" ${S(2)}/>
            <circle cx="${x}" cy="117.5" r="7.5" fill="${spec.eye_color || '#4a2e1c'}"/><circle cx="${x}" cy="117.5" r="3.6" fill="#120c0a"/><circle cx="${x + 2.5}" cy="115" r="2" fill="#fff"/>
            <path d="M${x - 16} 118 Q${x} 104 ${x + 16} 118" fill="none" stroke="${OUT}" stroke-width="${f ? 4 : 3.2}" stroke-linecap="round"/>
            ${f ? `<path d="M${x + 13} 114 l6 -4 M${x + 9} 110 l4 -5" stroke="${OUT}" stroke-width="2"/>` : ''}
            <path id="${id}-lid${i}" d="M${x - 16} 118 Q${x} 104 ${x + 16} 118 L${x + 16} 104 L${x - 16} 104 Z" fill="${skin[0]}" ${S(2)} transform="scale(1 0)" style="transform-box:fill-box;transform-origin:50% 0%"/>
          </g>`).join('')}
        </g>
        <path d="M200 122 L194 150 Q200 156 208 150" fill="none" stroke="${skin[1]}" stroke-width="3.5" stroke-linecap="round"/><path d="M190 152 Q200 158 210 152" fill="none" stroke="${OUT}" stroke-width="2" opacity=".55"/>
        ${spec.beard === 'full' ? `<path d="M142 140 Q146 196 200 206 Q254 196 258 140 Q250 168 226 172 Q200 166 174 172 Q150 168 142 140 Z" fill="${hair[0]}" ${S()}/>` : ''}
        ${spec.beard === 'stubble' ? `<path d="M146 146 Q152 192 200 200 Q248 192 254 146 Q246 176 200 182 Q154 176 146 146 Z" fill="${hair[0]}" opacity=".28"/>` : ''}
        ${spec.beard === 'mustache' || spec.beard === 'full' ? `<path d="M178 162 Q190 154 200 160 Q210 154 222 162 Q212 168 200 164 Q188 168 178 162 Z" fill="${hair[0]}" ${S(2)}/>` : ''}
        <g id="${id}-mouth" transform="translate(200 172)"></g>
        <path d="M182 186 Q200 192 218 186" fill="none" stroke="${skin[1]}" stroke-width="2" opacity=".7"/>
        ${f ? `<ellipse cx="166" cy="148" rx="11" ry="6" fill="#e0828a" opacity=".22"/><ellipse cx="234" cy="148" rx="11" ry="6" fill="#e0828a" opacity=".22"/>` : ''}
        ${spec.bindi ? `<circle cx="200" cy="96" r="4" fill="#b8282f"/>` : ''}
        ${spec.glasses ? `<g fill="rgba(255,255,255,.12)" stroke="${OUT}" stroke-width="3"><rect x="156" y="104" width="40" height="28" rx="8"/><rect x="204" y="104" width="40" height="28" rx="8"/><path d="M196 114 L204 114"/></g>` : ''}
        <g id="${id}-hf">${hairFront(hs, hair, f)}</g>
        ${spec.hat === 'cap' ? `<path d="M134 88 Q134 30 200 28 Q266 30 266 88 Z" fill="${col(spec.hat_color, 'navy')}" ${S()}/><path d="M134 84 Q200 98 286 84 L290 96 Q200 108 132 96 Z" fill="${shade(col(spec.hat_color, 'navy'), -.3)}" ${S()}/>` : ''}
        ${spec.hat === 'topi' ? `<path d="M146 66 Q200 30 254 66 L250 76 Q200 64 150 76 Z" fill="#f4f0e6" ${S()}/>` : ''}
      </g>`;

    // ---- arms (built as nested groups; angles applied per frame) ----
    const armLen = child ? 150 : 190, foreLen = child ? 135 : 170, aw = f ? 40 : 46;
    const skinD = skin[1];
    const armSvg = (side) => {
      const sx = side === 'R' ? sx0 + 6 : sx1 - 6; // character's right = viewer's left
      const sleeveUpper = sleeveCol, sleeveFore = longSleeve ? sleeveCol : skin[0];
      return `<g id="${id}-arm${side}" transform="translate(${sx} 250)">
        <g id="${id}-up${side}"><circle cx="0" cy="4" r="${aw * .56}" fill="${sleeveUpper}" ${S()}/>${limb(armLen, aw, aw * .82, sleeveUpper, shade(sleeveUpper, -.25))}<circle cx="0" cy="4" r="${aw * .5}" fill="${sleeveUpper}"/>
          <g id="${id}-fo${side}" transform="translate(0 ${armLen - 6})"><circle cx="0" cy="0" r="${aw * .41}" fill="${longSleeve ? sleeveCol : skin[0]}" ${S()}/>${limb(foreLen, aw * .8, aw * .64, sleeveFore, longSleeve ? shade(sleeveFore, -.25) : skinD,
            longSleeve ? `<path d="M${-aw * .33} ${foreLen - 16} L${aw * .33} ${foreLen - 16}" stroke="${shade(sleeveFore, -.35)}" stroke-width="3"/>` : '')}
            <g id="${id}-hand${side}" transform="translate(0 ${foreLen - 4})"></g>
          </g>
        </g></g>`;
    };
    const torso = `<g id="${id}-body">${outfit(spec, f, skin)}</g>`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-60 -20 520 1012" preserveAspectRatio="xMidYMax meet">
      <g id="${id}-all">
        <g id="${id}-back"></g>
        ${armSvg('R').replace(`id="${id}-armR"`, `id="${id}-armR" data-layer="back"`)}
        ${armSvg('L').replace(`id="${id}-armL"`, `id="${id}-armL" data-layer="back"`)}
        <g id="${id}-torsoWrap">${torso}</g>
        <g id="${id}-front"></g>
        <g id="${id}-headWrap">${head}</g>
        <g id="${id}-top"></g>
      </g></svg>`;
    return { id, svg, spec, skin, f, child, armLen, foreLen, sx0, sx1 };
  }

  // ---------- runtime rig ----------
  function attach(rig, container) {
    const q = s => container.querySelector('#' + rig.id + '-' + s);
    rig.el = {
      all: q('all'), head: q('head'), browL: q('browL'), browR: q('browR'), lid0: q('lid0'), lid1: q('lid1'), mouth: q('mouth'),
      armR: q('armR'), armL: q('armL'), upR: q('upR'), upL: q('upL'), foR: q('foR'), foL: q('foL'), handR: q('handR'), handL: q('handL'),
      front: q('front'), back: q('back'), top: q('top'), headWrap: q('headWrap'), torsoWrap: q('torsoWrap'), hb: q('hb')
    };
    rig.cache = {};
  }

  function setHTML(rig, key, el, html) { if (rig.cache[key] !== html) { el.innerHTML = html; rig.cache[key] = html; } }

  const lerp = (a, b, p) => a + (b - a) * p;
  function poseAngles(name) { return POSES[name] || POSES.stand; }

  /* state: {pose, prevPose, poseT (0..1 blend), expr, talking, viseme, t, blink, look} */
  function update(rig, st) {
    const E = rig.el, t = st.t;
    const P = poseAngles(st.pose), Q = st.prevPose ? poseAngles(st.prevPose) : P, w = st.poseT ?? 1;
    const breath0 = 0;
    const breath = Math.sin(t * 1.9 + (rig.spec.seed || 0)) * 1.2;
    // arms: character's right arm (viewer left) rotates with +angle outward (counter-clockwise), left mirrored
    const arm = (side, A, B) => {
      const a = A[side], b = B[side];
      const T = [lerp(b.h[0], a.h[0], w), lerp(b.h[1], a.h[1], w)];
      const sway = (st.pose === 'stand' || st.pose === 'sad') ? Math.sin(t * 1.3 + (side === 'R' ? 0 : 2)) * 4 : 0;
      T[0] += sway * (side === 'R' ? -1 : 1); T[1] += breath * 1.5;
      const S0 = [side === 'R' ? rig.sx0 + 10 : rig.sx1 - 10, 254];
      const pp = (w > .5 ? a : b); const [u, f] = ik(S0, T, rig.armLen - 6, rig.foreLen + 26, side, pp.out ? 'out' : pp.up);
      E['arm' + side].setAttribute('transform', `translate(${S0[0]} 250)`);
      E['up' + side].setAttribute('transform', `rotate(${u})`);
      E['fo' + side].setAttribute('transform', `translate(0 ${rig.armLen - 6}) rotate(${f})`);
      const hk = (w > .5 ? a : b).k, layer = (w > .5 ? a : b).f;
      const sgn = side === 'R' ? 1 : -1;
      const handSvg = hk === 'phone'
        ? `<g>${hand('open', rig.skin[0], rig.skin[1], sgn)}<g transform="translate(-16 12)"><rect width="32" height="56" rx="6" fill="#1d1d24" stroke="${OUT}" stroke-width="2.5"/><rect x="3.5" y="5" width="25" height="44" rx="3" fill="#7cc8f2"/></g><path d="M-14 8 Q-26 20 -22 30" fill="${rig.skin[0]}" stroke="${OUT}" stroke-width="2.5"/></g>`
        : hand(hk === 'hold' ? 'open' : hk, rig.skin[0], rig.skin[1], sgn);
      setHTML(rig, 'hand' + side, E['hand' + side], handSvg);
      const parent = layer === 3 ? E.top : layer ? E.front : E.back;
      if (E['arm' + side].parentNode !== parent || (layer === 2 && parent.lastChild !== E['arm' + side])) parent.appendChild(E['arm' + side]);
    };
    arm('R', P, Q); arm('L', P, Q);
    // body breathing + pose posture
    const slump = st.pose === 'sad' || st.pose === 'cry' ? 1 : 0;
    E.torsoWrap.setAttribute('transform', `translate(0 ${breath * .5}) scale(1 ${1 + breath * .002})`);
    const headTilt = (st.look || 0) * 4 + Math.sin(t * .7 + 1) * 1.5 + (slump ? 6 : 0) + (st.talking ? Math.sin(t * 5.3) * (st.amp || 0) * 2.5 : 0);
    const headDown = slump ? 14 : 0;
    E.headWrap.setAttribute('transform', `translate(0 ${breath * .6 + headDown}) rotate(${headTilt} 200 220)`);
    // expression
    const X = EXP[st.expr] || EXP.neutral;
    E.browL.setAttribute('transform', `translate(0 ${-X.brow[1]}) rotate(${X.brow[0]} 190 96)`);
    E.browR.setAttribute('transform', `translate(0 ${-X.brow[1]}) rotate(${-X.brow[0]} 210 96)`);
    const blink = st.blink ? 1 : 0;
    const lid = Math.min(1, Math.max(0, X.lid + blink));
    for (const L of [E.lid0, E.lid1]) L.setAttribute('transform', `scale(1 ${lid < 0 ? 0 : lid})`);
    // eyes widen for shock via eye group scale
    // mouth
    let m = X.mouth;
    if (st.talking && st.viseme) m = st.viseme;
    setHTML(rig, 'mouth', E.mouth, mouthShape(m));
  }

  window.CH = { build, attach, update, POSES: Object.keys(POSES), EXPR: Object.keys(EXP), hand, shade, col, OUT };
})();
