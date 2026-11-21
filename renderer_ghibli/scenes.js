/* Ghibli-inspired storybook sample — every pixel drawn in code. renderAt(t) is deterministic. */
(function () {
  const W = 1920, H = 1080;
  const stage = document.getElementById('stage');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, p) => a + (b - a) * p;
  const ease = p => { p = clamp(p, 0, 1); return p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2; };
  function rng(seed) { let s = seed >>> 0 || 1; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; }
  const NS = 'http://www.w3.org/2000/svg';
  let gid = 0;
  const uid = p => `${p}${gid++}`;

  // ---------- painterly building blocks ----------
  function defsCommon(id) {
    return `<defs>
      <filter id="soft${id}" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="2.2"/></filter>
      <filter id="softer${id}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="6"/></filter>
      <filter id="glow${id}" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="10"/></filter>
      <radialGradient id="cloud${id}" cx=".45" cy=".3" r=".75"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#fbf7f1"/><stop offset="1" stop-color="#d9d3ea"/></radialGradient>
      <radialGradient id="cloudW${id}" cx=".45" cy=".3" r=".75"><stop offset="0" stop-color="#fff3df"/><stop offset=".6" stop-color="#ffd7b0"/><stop offset="1" stop-color="#d98a8a"/></radialGradient>
    </defs>`;
  }
  function cloud(x, y, s, grad, seed) {
    const r = rng(seed); let out = `<g transform="translate(${x} ${y}) scale(${s})">`;
    out += `<ellipse cx="0" cy="40" rx="230" ry="46" fill="${grad}" opacity=".9"/>`;
    const puffs = [[-150, 10, 70], [-80, -30, 95], [10, -60, 120], [110, -25, 95], [180, 15, 70], [-30, 10, 90], [70, 15, 85]];
    for (const [px, py, pr] of puffs) out += `<circle cx="${px + (r() - .5) * 20}" cy="${py + (r() - .5) * 14}" r="${pr * (.9 + r() * .2)}" fill="${grad}"/>`;
    out += `<path d="M-230 44 Q0 70 230 44 L230 60 Q0 86 -230 60 Z" fill="#cfc6e4" opacity=".55"/>`;
    return out + '</g>';
  }
  function hill(d, c1, c2, id, extra = '') {
    const g = uid('h');
    return `<linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>
            <path d="${d}" fill="url(#${g})" ${extra}/>`;
  }
  function texture(seed, n, x0, x1, y0, y1, col, size, op) {
    const r = rng(seed); let s = '';
    for (let i = 0; i < n; i++) s += `<ellipse cx="${lerp(x0, x1, r())}" cy="${lerp(y0, y1, r())}" rx="${size * (.5 + r())}" ry="${size * .35 * (.5 + r())}" fill="${col}" opacity="${op * (.4 + r() * .6)}"/>`;
    return s;
  }
  // grass clumps -> returns {svg, clumps:[ids,x]}
  function grassField(seed, y0, y1, count, cols, hMin, hMax) {
    const r = rng(seed); let svg = ''; const clumps = [];
    for (let i = 0; i < count; i++) {
      const x = r() * (W + 200) - 100, y = lerp(y0, y1, Math.pow(r(), .8));
      const depth = (y - y0) / (y1 - y0 + 1);
      const h = lerp(hMin, hMax, depth) * (.7 + r() * .5);
      const id = uid('g');
      let blades = '';
      const nb = 5 + Math.floor(r() * 5);
      for (let b = 0; b < nb; b++) {
        const bx = (r() - .5) * h * .6, lean = (r() - .5) * h * .5, w = 3 + depth * 6;
        const c = cols[Math.floor(r() * cols.length)];
        blades += `<path d="M${bx - w} 0 Q${bx + lean * .3} ${-h * .55} ${bx + lean} ${-h} Q${bx + lean * .3 + w * .4} ${-h * .5} ${bx + w} 0 Z" fill="${c}"/>`;
      }
      svg += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><g id="${id}" class="sway">${blades}</g></g>`;
      clumps.push({ id, x, depth });
    }
    return { svg, clumps };
  }
  function tree(x, y, s, cols, seed) {
    const r = rng(seed);
    let t = `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-14 0 L-10 -170 Q0 -190 10 -170 L16 0 Z" fill="#5a3b26"/>`;
    const blobs = [[0, -260, 120], [-90, -200, 90], [90, -210, 95], [-40, -330, 85], [50, -320, 90], [0, -170, 80]];
    for (let k = 0; k < 3; k++) for (const [bx, by, br] of blobs) t += `<circle cx="${bx + k * 8 + (r() - .5) * 20}" cy="${by - k * 10 + (r() - .5) * 20}" r="${br * (1 - k * .22)}" fill="${cols[k]}"/>`;
    return t + '</g>';
  }
  function house(x, y, s) {
    return `<g transform="translate(${x} ${y}) scale(${s})">
      <rect x="-120" y="-150" width="240" height="150" fill="#f4ecdc"/><rect x="-120" y="-150" width="60" height="150" fill="#e2d6be"/>
      <path d="M-150 -140 L0 -250 L150 -140 Z" fill="#c4473a"/><path d="M-150 -140 L0 -250 L-20 -140 Z" fill="#a6372d"/>
      <rect x="60" y="-250" width="30" height="70" fill="#8a5a3a"/>
      <rect x="-80" y="-110" width="50" height="50" fill="#5d7fa6"/><rect x="30" y="-110" width="50" height="50" fill="#5d7fa6"/>
      <rect x="-20" y="-80" width="40" height="80" fill="#7a4e2d"/>
      <g class="win" fill="#ffd27a" opacity="0"><rect x="-80" y="-110" width="50" height="50"/><rect x="30" y="-110" width="50" height="50"/></g>
    </g>`;
  }
  function girlBack(id, opts = {}) {
    // girl seen from behind: straw hat with red ribbon, bob hair, white sundress
    const sit = opts.sit;
    const legs = sit ? `<path d="M-40 170 Q-50 230 -90 250 L-60 268 Q-20 240 -10 175 Z" fill="#f2c7a3" stroke="#4a3426" stroke-width="3"/>
                         <path d="M40 170 Q55 230 95 250 L66 268 Q22 240 12 175 Z" fill="#f2c7a3" stroke="#4a3426" stroke-width="3"/>`
      : `<g id="${id}-legL"><path d="M-28 200 L-30 330 L-12 330 L-8 200 Z" fill="#f2c7a3" stroke="#4a3426" stroke-width="3"/><path d="M-36 326 Q-22 316 -8 326 L-8 340 L-38 340 Z" fill="#6b3d2a"/></g>
         <g id="${id}-legR"><path d="M8 200 L12 330 L30 330 L28 200 Z" fill="#f2c7a3" stroke="#4a3426" stroke-width="3"/><path d="M10 326 Q24 316 38 326 L38 340 L8 340 Z" fill="#6b3d2a"/></g>`;
    return `<g>
      ${legs}
      <g id="${id}-armL"><path d="M-58 20 Q-80 90 -74 150 L-58 152 Q-60 90 -42 30 Z" fill="#f2c7a3" stroke="#4a3426" stroke-width="3"/></g>
      <g id="${id}-armR"><path d="M58 20 Q80 90 74 150 L58 152 Q60 90 42 30 Z" fill="#f2c7a3" stroke="#4a3426" stroke-width="3"/></g>
      <path d="M-46 10 Q0 -6 46 10 L52 90 L-52 90 Z" fill="#fbf8f2" stroke="#4a3426" stroke-width="3"/>
      <g id="${id}-skirt"><path d="M-52 86 Q0 78 52 86 L84 ${sit ? 190 : 214} Q0 ${sit ? 206 : 232} -84 ${sit ? 190 : 214} Z" fill="#fbf8f2" stroke="#4a3426" stroke-width="3"/>
        <path d="M-20 92 L-34 ${sit ? 196 : 222} M20 92 L32 ${sit ? 196 : 222}" stroke="#e3dccd" stroke-width="5"/></g>
      <path d="M-20 0 L20 0 L18 -16 L-18 -16 Z" fill="#f2c7a3"/>
      <g id="${id}-hair"><path d="M-54 -60 Q-60 -110 0 -116 Q60 -110 54 -60 L58 -4 Q30 8 0 4 Q-30 8 -58 -4 Z" fill="#3b2a22" stroke="#2a1d17" stroke-width="3"/>
        <path d="M-30 -40 L-34 0 M0 -44 L0 2 M30 -40 L34 0" stroke="#2a1d17" stroke-width="3" opacity=".5"/></g>
      <ellipse cx="0" cy="-96" rx="112" ry="26" fill="#e8c77a" stroke="#8a6a35" stroke-width="3"/>
      <path d="M-56 -100 Q-54 -152 0 -154 Q54 -152 56 -100 Z" fill="#f0d389" stroke="#8a6a35" stroke-width="3"/>
      <path d="M-56 -106 Q0 -96 56 -106 L56 -94 Q0 -84 -56 -94 Z" fill="#c8323a"/>
      <g id="${id}-ribbon"><path d="M50 -100 Q90 -96 120 -80 L112 -66 Q84 -84 48 -88 Z" fill="#c8323a"/><path d="M52 -96 Q96 -76 112 -50 L98 -44 Q84 -70 50 -86 Z" fill="#b02a32"/></g>
    </g>`;
  }
  function birds(id, n, seed) {
    const r = rng(seed); let s = `<g id="${id}">`;
    for (let i = 0; i < n; i++) s += `<g class="bird" transform="translate(${r() * 400} ${r() * 120})"><path class="wing" d="M-18 0 Q-9 -10 0 0 Q9 -10 18 0" fill="none" stroke="#3d3a4a" stroke-width="3.5" stroke-linecap="round"/></g>`;
    return s + '</g>';
  }
  function svgWrap(id, inner) { return `<svg xmlns="${NS}" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice">${defsCommon(id)}${inner}</svg>`; }

  // ---------- scenes ----------
  const scenes = [];
  function addScene(dur, text, build) { scenes.push({ dur, text, build }); }

  // S1 — morning hills
  addScene(16, 'Every summer, Mira came back to the hills.', (id) => {
    const g = grassField(11, 900, 1120, 120, ['#6d9a3f', '#86b04c', '#5b8636', '#9cc05a'], 40, 120);
    const svg = svgWrap(id, `
      <linearGradient id="sky${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6fb3e0"/><stop offset=".6" stop-color="#bfe0ef"/><stop offset="1" stop-color="#f6efd8"/></linearGradient>
      <rect width="${W}" height="${H}" fill="url(#sky${id})"/>
      <circle cx="1500" cy="250" r="140" fill="#fff6d6" opacity=".5" filter="url(#glow${id})"/>
      <g class="L-clouds">${cloud(300, 260, 1.1, `url(#cloud${id})`, 1)}${cloud(1050, 180, 1.5, `url(#cloud${id})`, 2)}${cloud(1700, 330, .9, `url(#cloud${id})`, 3)}${cloud(2300, 220, 1.2, `url(#cloud${id})`, 4)}</g>
      <g class="L-far" filter="url(#soft${id})">${hill('M-200 620 Q200 480 600 560 Q1000 470 1400 560 Q1800 480 2200 580 L2200 1080 L-200 1080 Z', '#9fbfc9', '#b9cdbf', id)}</g>
      <g class="L-mid">${hill('M-200 720 Q300 600 800 690 Q1300 610 1700 690 Q2000 640 2200 700 L2200 1080 L-200 1080 Z', '#8db45a', '#6f9a44', id)}
        ${texture(5, 160, -200, 2200, 700, 900, '#5d8a3a', 10, .35)}
        ${tree(420, 735, .55, ['#3f6e33', '#52863d', '#6ea24a'], 7)}${tree(1580, 700, .45, ['#3f6e33', '#52863d', '#6ea24a'], 8)}
        ${house(1180, 712, .55)}
        <g class="smoke"><circle cx="1210" cy="560" r="16" fill="#fff" opacity=".6"/><circle cx="1222" cy="530" r="22" fill="#fff" opacity=".45"/><circle cx="1236" cy="494" r="28" fill="#fff" opacity=".3"/></g></g>
      <g class="L-near">${hill('M-200 900 Q400 800 1000 880 Q1500 820 2200 900 L2200 1080 L-200 1080 Z', '#7aa848', '#557e33', id)}${g.svg}</g>
      ${birds(`b${id}`, 6, 21)}`);
    return { svg, grass: g.clumps, cam: 'panR', birds: true };
  });

  // S2 — girl in the windy field
  addScene(16, 'The wind here always seemed to remember her.', (id) => {
    const g = grassField(31, 760, 1140, 200, ['#8fb94f', '#a7c95e', '#79a443', '#bcd673', '#6c9a3c'], 60, 190);
    const svg = svgWrap(id, `
      <linearGradient id="sky${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4f9fd8"/><stop offset=".7" stop-color="#a9d6ee"/><stop offset="1" stop-color="#eaf4e6"/></linearGradient>
      <rect width="${W}" height="${H}" fill="url(#sky${id})"/>
      <g class="L-clouds">${cloud(700, 380, 2.6, `url(#cloud${id})`, 9)}${cloud(1500, 250, 1.3, `url(#cloud${id})`, 10)}${cloud(150, 200, 1, `url(#cloud${id})`, 11)}</g>
      <g class="L-far" filter="url(#soft${id})">${hill('M-200 700 Q500 600 1100 680 Q1600 620 2200 690 L2200 1080 L-200 1080 Z', '#a8c7b0', '#9cc08a', id)}</g>
      <g class="L-mid">${hill('M-200 780 Q600 720 1200 770 Q1700 730 2200 780 L2200 1080 L-200 1080 Z', '#9cc35b', '#7ea849', id)}
        <g class="wave">${texture(13, 220, -200, 2200, 780, 1000, '#c3dc7c', 18, .5)}</g></g>
      <g class="L-girl" transform="translate(760 690) scale(1.3)">${girlBack(`girl${id}`)}</g>
      <g class="L-near">${g.svg}</g>
      <g class="petals"></g>`);
    return { svg, grass: g.clumps, cam: 'push', girl: `girl${id}`, wind: 1.4, petals: true };
  });

  // S3 — grandmother's window (interior)
  addScene(15, "Grandmother's house smelled of rain and old books.", (id) => {
    const svg = svgWrap(id, `
      <rect width="${W}" height="${H}" fill="#7a5638"/>
      ${texture(41, 120, 0, W, 0, H, '#5f4029', 40, .35)}
      <g class="L-mid">
        <rect x="620" y="140" width="700" height="560" fill="#8ec7e6"/>
        <g class="L-out" transform="translate(620 140)"><rect width="700" height="560" fill="#9fd1ec"/>${cloud(250, 170, .8, `url(#cloud${id})`, 12)}${cloud(560, 260, .6, `url(#cloud${id})`, 13)}
          <path d="M0 420 Q180 340 360 400 Q540 340 700 410 L700 560 L0 560 Z" fill="#86b45a"/><path d="M0 480 Q260 430 700 480 L700 560 L0 560 Z" fill="#6e9c45"/>${tree(120, 470, .35, ['#3f6e33', '#52863d', '#6ea24a'], 14)}</g>
        <rect x="600" y="120" width="740" height="600" fill="none" stroke="#5a3b24" stroke-width="40"/>
        <path d="M970 140 V700 M620 420 H1320" stroke="#5a3b24" stroke-width="22"/>
        <g id="curL${id}"><path d="M560 90 Q640 400 600 760 L470 760 Q520 400 470 90 Z" fill="#e9dfc8"/><path d="M520 100 Q580 400 560 750" stroke="#d3c6a8" stroke-width="10" fill="none"/></g>
        <g id="curR${id}"><path d="M1380 90 Q1300 400 1340 760 L1470 760 Q1420 400 1470 90 Z" fill="#e9dfc8"/><path d="M1420 100 Q1360 400 1380 750" stroke="#d3c6a8" stroke-width="10" fill="none"/></g>
        <rect x="380" y="740" width="1160" height="40" fill="#a0724a"/><rect x="380" y="780" width="1160" height="300" fill="#8a6040"/>
        <g transform="translate(760 740)"><path d="M-60 0 L-50 -80 L50 -80 L60 0 Z" fill="#c9693f"/><path d="M-40 -80 Q-80 -200 -20 -160 Q0 -260 20 -160 Q80 -210 40 -80 Z" fill="#4f8a3c"/><path d="M-10 -80 Q-30 -180 10 -150" stroke="#3e6e30" stroke-width="6" fill="none"/></g>
        <g transform="translate(1180 740)"><path d="M-46 0 Q-50 -70 -42 -76 L42 -76 Q50 -70 46 0 Z" fill="#f2efe8"/><path d="M42 -60 Q78 -50 44 -24" stroke="#f2efe8" stroke-width="12" fill="none"/><ellipse cx="0" cy="-76" rx="42" ry="9" fill="#9a5b2c"/></g>
        <g class="steam" transform="translate(1180 650)"><path d="M0 0 Q-20 -40 0 -80 Q20 -120 0 -160" stroke="#fff" stroke-width="10" fill="none" opacity=".45" stroke-linecap="round"/></g>
        <g transform="translate(470 740)"><rect x="0" y="-70" width="40" height="70" fill="#7b2d2d"/><rect x="40" y="-60" width="34" height="60" fill="#2f4f6f"/><rect x="74" y="-80" width="44" height="80" fill="#6b7a3a"/></g>
      </g>
      <g class="rays" opacity=".35"><path d="M650 140 L1000 140 L1500 1080 L900 1080 Z" fill="#fff3c8"/><path d="M1050 140 L1300 140 L1900 1080 L1500 1080 Z" fill="#fff3c8" opacity=".6"/></g>
      <g class="dust"></g>`);
    return { svg, cam: 'push', curtains: [`curL${id}`, `curR${id}`], dust: true, warm: true };
  });

  // S4 — forest path
  addScene(15, 'Some paths, she had walked a hundred times.', (id) => {
    let trees = '';
    const r = rng(51);
    for (let i = 0; i < 9; i++) trees += tree(80 + i * 230 + (r() - .5) * 60, 820 + r() * 40, .9 + r() * .5, ['#2f5a2c', '#3f7536', '#5a9245'], 60 + i);
    const g = grassField(52, 840, 1100, 110, ['#4f7d34', '#679a41', '#3f6a2c'], 40, 110);
    const svg = svgWrap(id, `
      <linearGradient id="fsky${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe6c9"/><stop offset="1" stop-color="#9cc58a"/></linearGradient>
      <rect width="${W}" height="${H}" fill="url(#fsky${id})"/>
      <g class="L-far" filter="url(#soft${id})" opacity=".7">${tree(300, 760, 1.4, ['#6f9c74', '#86b083', '#9ec496'], 70)}${tree(900, 740, 1.6, ['#6f9c74', '#86b083', '#9ec496'], 71)}${tree(1600, 760, 1.5, ['#6f9c74', '#86b083', '#9ec496'], 72)}</g>
      <g class="L-mid">${hill('M-200 800 Q900 760 2200 800 L2200 1080 L-200 1080 Z', '#7aa04f', '#5b823a', id)}
        <path d="M860 800 Q960 790 1060 800 L1500 1080 L420 1080 Z" fill="#cdb48a"/><path d="M900 800 L640 1080 M1020 800 L1280 1080" stroke="#b89a6c" stroke-width="6" opacity=".6"/>
        ${trees}</g>
      <g class="L-girl" transform="translate(960 830) scale(.42)">${girlBack(`girl${id}`)}</g>
      <g class="rays" opacity=".28"><path d="M300 0 L420 0 L900 1080 L700 1080 Z" fill="#fff8d0"/><path d="M1100 0 L1180 0 L1500 1080 L1360 1080 Z" fill="#fff8d0"/><path d="M1600 0 L1660 0 L1800 1080 L1700 1080 Z" fill="#fff8d0"/></g>
      <g class="L-near">${g.svg}</g>
      <g class="leaves"></g>`);
    return { svg, grass: g.clumps, cam: 'push', girl: `girl${id}`, walk: true, leaves: true, wind: .6 };
  });

  // S5 — sunset river with a passing train
  addScene(15, 'And some evenings felt like the whole world was holding its breath.', (id) => {
    const g = grassField(81, 900, 1110, 90, ['#3d4a3a', '#55603f', '#6b6f45'], 70, 180);
    let train = `<g id="train${id}">`;
    for (let k = 0; k < 6; k++) train += `<g transform="translate(${k * 190} 0)"><rect x="0" y="-70" width="180" height="70" rx="10" fill="${k === 0 ? '#5a2f2f' : '#7a3a34'}"/><rect x="0" y="-70" width="180" height="14" rx="6" fill="#3a2020"/>${[0, 1, 2, 3].map(w => `<rect x="${16 + w * 42}" y="-52" width="30" height="24" fill="#ffd27a"/>`).join('')}</g>`;
    train += `</g>`;
    const svg = svgWrap(id, `
      <linearGradient id="ss${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b3a78"/><stop offset=".45" stop-color="#d9708a"/><stop offset=".75" stop-color="#f6b46a"/><stop offset="1" stop-color="#fbd99a"/></linearGradient>
      <rect width="${W}" height="${H}" fill="url(#ss${id})"/>
      <circle cx="1100" cy="610" r="210" fill="#ffe0a0" opacity=".5" filter="url(#glow${id})"/><circle cx="1100" cy="610" r="90" fill="#fff0c8"/>
      <g class="L-clouds">${cloud(400, 300, 1.4, `url(#cloudW${id})`, 15)}${cloud(1500, 230, 1.1, `url(#cloudW${id})`, 16)}</g>
      <g class="L-far">${hill('M-200 640 Q300 580 800 630 Q1300 590 2200 640 L2200 700 L-200 700 Z', '#6a4a72', '#5a3f62', id)}
        <rect x="-200" y="560" width="2400" height="16" fill="#3a2a3a"/>${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(k => `<rect x="${-100 + k * 200}" y="560" width="14" height="80" fill="#3a2a3a"/>`).join('')}
        <g class="L-train" transform="translate(0 560)">${train}</g></g>
      <rect x="0" y="700" width="${W}" height="260" fill="#e79a6e"/>
      <g class="shimmer">${[0, 1, 2, 3, 4, 5, 6, 7, 8].map(k => `<rect x="${1040 - k * 10}" y="${710 + k * 26}" width="${120 + k * 22}" height="6" rx="3" fill="#fff0c8" opacity="${.8 - k * .07}"/>`).join('')}</g>
      <g class="L-near">${hill('M-200 930 Q500 880 1000 920 Q1500 890 2200 930 L2200 1080 L-200 1080 Z', '#4b4a3c', '#2f3027', id)}${g.svg}</g>
      <g class="dragonflies"></g>`);
    return { svg, grass: g.clumps, cam: 'panL', train: `train${id}`, shimmer: true, dragonflies: true, wind: .5 };
  });

  // S6 — night of fireflies
  addScene(17, 'That summer, she finally understood why she always came back.', (id) => {
    const g = grassField(91, 975, 1110, 90, ['#1f3a3a', '#2a4a44', '#173030'], 50, 150);
    const r = rng(92); let stars = '';
    for (let i = 0; i < 160; i++) stars += `<circle class="star" cx="${r() * W}" cy="${r() * 620}" r="${.8 + r() * 2.2}" fill="#fff" opacity="${.4 + r() * .6}"/>`;
    const svg = svgWrap(id, `
      <linearGradient id="ns${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1440"/><stop offset=".6" stop-color="#22326e"/><stop offset="1" stop-color="#3d4f86"/></linearGradient>
      <rect width="${W}" height="${H}" fill="url(#ns${id})"/>
      <g class="stars">${stars}</g>
      <circle cx="1500" cy="230" r="170" fill="#fff8d8" opacity=".25" filter="url(#glow${id})"/><circle cx="1500" cy="230" r="78" fill="#fdf6dc"/><circle cx="1478" cy="214" r="12" fill="#ebe2c0"/><circle cx="1520" cy="250" r="8" fill="#ebe2c0"/>
      <g class="L-far" filter="url(#soft${id})">${hill('M-200 720 Q400 640 1000 700 Q1600 650 2200 720 L2200 1080 L-200 1080 Z', '#2c3f6a', '#25365a', id)}</g>
      <g class="L-mid">${hill('M-200 820 Q600 740 1200 800 Q1700 760 2200 820 L2200 1080 L-200 1080 Z', '#1f3a4a', '#18303c', id)}
        <g class="house-n">${house(1550, 800, .5)}</g>${tree(300, 820, .6, ['#14282c', '#1b3438', '#22403f'], 93)}</g>
      <g class="L-girl" transform="translate(820 770) scale(.8)">${girlBack(`girl${id}`, { sit: true })}</g>
      <g class="L-near">${hill('M-200 990 Q700 950 1300 975 Q1800 955 2200 990 L2200 1080 L-200 1080 Z', '#132a2e', '#0c1d20', id)}${g.svg}</g>
      <g class="fireflies"></g>`);
    return { svg, grass: g.clumps, cam: 'push', girl: `girl${id}`, fireflies: true, wind: .4, night: true, endTitle: 'Summer in the Hills' };
  });

  // ---------- build DOM ----------
  let t0 = 0;
  const S = scenes.map((sc, i) => {
    const id = 's' + i;
    const info = sc.build(id);
    const root = document.createElement('div');
    root.className = 'scene';
    root.innerHTML = info.svg;
    stage.appendChild(root);
    const svg = root.querySelector('svg');
    const q = c => svg.querySelector(c);
    const o = { ...info, root, svg, start: t0, end: t0 + sc.dur, text: sc.text, i };
    t0 += sc.dur;
    o.layers = { clouds: q('.L-clouds'), far: q('.L-far'), mid: q('.L-mid'), near: q('.L-near'), girl: q('.L-girl'), train: q('.L-train'), out: q('.L-out') };
    o.baseGirl = o.layers.girl ? o.layers.girl.getAttribute('transform') : '';
    o.grassEls = (info.grass || []).map(c => ({ el: svg.getElementById(c.id), ...c }));
    const r = rng(500 + i);
    function spawn(sel, n, make) { const g = q(sel); if (!g) return []; const arr = []; for (let k = 0; k < n; k++) { const d = { x: r() * W, y: r() * H, s: r(), ph: r() * 6.28 }; const el = document.createElementNS(NS, 'g'); el.innerHTML = make(d); g.appendChild(el); arr.push({ el, d }); } return arr; }
    if (info.petals) o.petals = spawn('.petals', 26, d => `<ellipse rx="${7 + d.s * 6}" ry="${4 + d.s * 3}" fill="${d.s > .5 ? '#ffffff' : '#f8d7e3'}" opacity=".9"/>`);
    if (info.dust) o.dustP = spawn('.dust', 50, d => `<circle r="${1.5 + d.s * 3}" fill="#fff6d0" opacity=".8"/>`);
    if (info.leaves) o.leavesP = spawn('.leaves', 22, d => `<path d="M0 -10 Q10 0 0 10 Q-10 0 0 -10 Z" fill="${['#d9a63a', '#c97a2e', '#9cbc4a'][Math.floor(d.s * 3)]}"/>`);
    if (info.dragonflies) o.dfly = spawn('.dragonflies', 5, d => `<g><path d="M-14 0 L14 0" stroke="#2a2a3a" stroke-width="3"/><ellipse class="dw" cx="0" cy="-6" rx="10" ry="4" fill="#fff" opacity=".6"/></g>`);
    if (info.fireflies) o.ffly = spawn('.fireflies', 46, d => `<circle r="14" fill="#fff6a0" opacity=".25"/><circle r="4" fill="#fffbd0"/>`);
    o.stars = [...svg.querySelectorAll('.star')];
    o.birdEls = [...svg.querySelectorAll('.bird')];
    return o;
  });
  const TOTAL = t0;
  window.TOTAL = TOTAL;

  const textEl = document.getElementById('text');
  const titleEl = document.getElementById('title');
  const fade = document.getElementById('fade');

  function animScene(o, t) {
    const lt = t - o.start, p = clamp(lt / (o.end - o.start), 0, 1), e = ease(p);
    // camera with parallax
    let camX = 0, camS = 1;
    if (o.cam === 'panR') camX = lerp(60, -60, e);
    if (o.cam === 'panL') camX = lerp(-60, 60, e);
    if (o.cam === 'push') camS = 1 + .06 * e;
    const L = o.layers;
    const set = (el, k, extra = '') => { if (el) el.setAttribute('transform', `translate(${W / 2} ${H / 2}) scale(${1 + (camS - 1) * k}) translate(${-W / 2 + camX * k} ${-H / 2}) ${extra}`); };
    if (L.clouds) set(L.clouds, .3, `translate(${-lt * 14} 0)`);
    set(L.far, .5); set(L.mid, .8); set(L.near, 1.3);
    if (L.out) L.out.setAttribute('transform', `translate(${620 + lt * -3} 140)`);
    if (L.girl) {
      const m = o.baseGirl.match(/translate\(([-\d.]+) ([-\d.]+)\) scale\(([-\d.]+)\)/);
      let gx = +m[1], gy = +m[2], gs = +m[3];
      if (o.walk) { gy -= lt * 4; gs *= 1 - lt * .012; }
      L.girl.setAttribute('transform', `translate(${W / 2} ${H / 2}) scale(${1 + (camS - 1)}) translate(${-W / 2 + camX} ${-H / 2}) translate(${gx} ${gy}) scale(${gs})`);
    }
    // wind on grass: travelling gust waves
    const wind = o.wind || 1;
    for (const c of o.grassEls) {
      const gust = Math.sin(t * 1.6 - c.x * .004) * .5 + Math.sin(t * .7 - c.x * .0017) * .5;
      c.el.setAttribute('transform', `skewX(${(gust * 10 + 4) * wind * (.6 + c.depth * .6)})`);
    }
    // girl cloth & hair
    if (o.girl) {
      const s = o.svg;
      const w2 = Math.sin(t * 3.1) * .5 + Math.sin(t * 5.3) * .5;
      const sk = s.getElementById(o.girl + '-skirt'); if (sk) sk.setAttribute('transform', `skewX(${(w2 * 4 + 5) * wind})`);
      const rb = s.getElementById(o.girl + '-ribbon'); if (rb) rb.setAttribute('transform', `rotate(${w2 * 10 * wind} 50 -94)`);
      const hr = s.getElementById(o.girl + '-hair'); if (hr) hr.setAttribute('transform', `skewX(${w2 * 2.5 * wind})`);
      const aL = s.getElementById(o.girl + '-armL'), aR = s.getElementById(o.girl + '-armR');
      const lL = s.getElementById(o.girl + '-legL'), lR = s.getElementById(o.girl + '-legR');
      if (o.walk) {
        const ph = Math.sin(lt * 5.5);
        if (lL) lL.setAttribute('transform', `translate(0 ${Math.max(0, ph) * -10})`);
        if (lR) lR.setAttribute('transform', `translate(0 ${Math.max(0, -ph) * -10})`);
        if (aL) aL.setAttribute('transform', `rotate(${ph * 10} -50 25)`);
        if (aR) aR.setAttribute('transform', `rotate(${-ph * 10} 50 25)`);
      } else {
        if (aL) aL.setAttribute('transform', `rotate(${Math.sin(t * 1.2) * 2} -50 25)`);
        if (aR) aR.setAttribute('transform', `rotate(${-Math.sin(t * 1.2) * 2} 50 25)`);
      }
    }
    // birds
    o.birdEls.forEach((b, k) => {
      const bx = 200 + lt * 70 + k * 40, by = 300 + Math.sin(lt * .8 + k) * 20 + k * 12;
      b.setAttribute('transform', `translate(${bx} ${by}) scale(${.8 + (k % 3) * .2})`);
      b.firstChild.setAttribute('transform', `scale(1 ${.4 + Math.abs(Math.sin(lt * 7 + k)) * .9})`);
    });
    // smoke, steam, curtains, rays, shimmer, train, stars, house windows
    const sm = o.svg.querySelector('.smoke'); if (sm) sm.setAttribute('transform', `translate(${Math.sin(t) * 6 + lt * 2} ${-((lt * 8) % 30)})`);
    const st = o.svg.querySelector('.steam'); if (st) { st.setAttribute('transform', `translate(1180 650) translate(${Math.sin(t * 1.5) * 8} ${-((lt * 12) % 20)})`); st.style.opacity = .7 + .3 * Math.sin(t * 2); }
    if (o.curtains) o.curtains.forEach((cid, k) => { const c = o.svg.getElementById(cid); if (c) c.setAttribute('transform', `skewX(${Math.sin(t * 1.1 + k) * 2.2})`); });
    const ray = o.svg.querySelector('.rays'); if (ray) ray.style.opacity = (o.warm ? .32 : .25) + .08 * Math.sin(t * .9);
    const sh = o.svg.querySelector('.shimmer'); if (sh) [...sh.children].forEach((r2, k) => r2.setAttribute('transform', `translate(${Math.sin(t * 2 + k) * 14} 0)`));
    if (o.train) { const tr = o.svg.getElementById(o.train); if (tr) tr.setAttribute('transform', `translate(${2100 - lt * 230} 0)`); }
    o.stars.forEach((s2, k) => { if (k % 3 === 0) s2.style.opacity = .35 + .65 * Math.abs(Math.sin(t * (.8 + (k % 7) * .2) + k)); });
    const win = o.svg.querySelector('.house-n .win'); if (win) win.setAttribute('opacity', .85 + .15 * Math.sin(t * 3));
    // particles
    const P = (arr, fn) => arr && arr.forEach(({ el, d }) => { const [x, y, a, sc, rot] = fn(d); el.setAttribute('transform', `translate(${x} ${y}) rotate(${rot || 0}) scale(${sc || 1})`); el.style.opacity = a; });
    P(o.petals, d => { const x = ((d.x + lt * (160 + d.s * 120)) % (W + 200)) - 100; const y = d.y * .7 + Math.sin(lt * 1.5 + d.ph) * 60; return [x, y, .9, 1, lt * 90 + d.ph * 50]; });
    P(o.dustP, d => [620 + (d.x % 900) + Math.sin(lt * .4 + d.ph) * 30, 140 + (d.y % 900) + Math.cos(lt * .3 + d.ph) * 30, .3 + .7 * Math.abs(Math.sin(lt + d.ph))]);
    P(o.leavesP, d => { const y = ((d.y + lt * (60 + d.s * 50)) % (H + 100)) - 50; return [d.x + Math.sin(lt * 1.2 + d.ph) * 70, y, .95, 1.2, Math.sin(lt * 2 + d.ph) * 70]; });
    P(o.dfly, d => [300 + (d.x % 1300) + Math.sin(lt * .9 + d.ph) * 120, 760 + Math.sin(lt * 1.7 + d.ph) * 50, 1, 1.4, Math.sin(lt * 3 + d.ph) * 10]);
    P(o.ffly, d => { const cyc = (lt * (.05 + d.s * .05) + d.ph) % 1; return [d.x + Math.sin(lt * .7 + d.ph) * 40, 1080 - cyc * 560 + Math.sin(lt * 1.3 + d.ph) * 20, (.3 + .7 * Math.abs(Math.sin(lt * 1.8 + d.ph * 3))) * Math.sin(cyc * Math.PI), 1]; });
  }

  window.__ready = false;
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => { window.__ready = true; });

  window.renderAt = function (t) {
    let idx = 0;
    for (let i = 0; i < S.length; i++) if (t >= S[i].start) idx = i;
    const cur = S[idx];
    const XF = 1.4;
    const prev = idx > 0 && t < cur.start + XF ? S[idx - 1] : null;
    for (const o of S) { o.root.style.display = (o === cur || o === prev) ? 'block' : 'none'; o.root.style.opacity = 1; o.root.style.zIndex = o === cur ? 2 : 1; }
    if (prev) { cur.root.style.opacity = ease((t - cur.start) / XF); animScene(prev, t); }
    animScene(cur, t);
    // story text
    const lt = t - cur.start, d = cur.end - cur.start;
    textEl.textContent = cur.text;
    textEl.style.opacity = clamp((lt - 1.2) / 1.2, 0, 1) * clamp((d - lt - .6) / 1.0, 0, 1);
    textEl.style.transform = `translate(-50%, ${(1 - ease((lt - 1.2) / 1.6)) * 14}px)`;
    // end title
    if (cur.endTitle) {
      const tt = t - (cur.end - 6.5);
      titleEl.textContent = cur.endTitle;
      titleEl.style.opacity = clamp(tt / 1.6, 0, 1);
      if (tt > 0) textEl.style.opacity = Math.min(+textEl.style.opacity, clamp(1 - tt / .6, 0, 1));
    } else titleEl.style.opacity = 0;
    fade.style.opacity = clamp(1 - t / 1.5, 0, 1) + clamp((t - (TOTAL - 1.8)) / 1.8, 0, 1);
    document.getElementById('paper').style.transform = `translate(${(Math.floor(t * 12) * 37) % 40 - 20}px, ${(Math.floor(t * 12) * 53) % 40 - 20}px)`;
    return true;
  };
})();
