/* 3D sets, props and lighting moods. window.W3 */
(function () {
  const { box, ball, cyl, cap, plane, cone, torus, group } = E3;

  // ---------------- lighting moods ----------------
  const LIGHT = {
    morning: { sun: [-.6, .8, .55], sunCol: '#ffe7c4', sky: '#bcd8f0', ground: '#9a8466', fog: '#e8eef2', rim: .55 },
    day: { sun: [.4, 1, .5], sunCol: '#fff6e6', sky: '#a9d0f0', ground: '#8f7a5c', fog: '#d6e8f5', rim: .5 },
    evening: { sun: [.9, .35, .4], sunCol: '#ffb36b', sky: '#d79aa8', ground: '#6e5050', fog: '#f0b48a', rim: .8 },
    night: { sun: [-.4, .7, .5], sunCol: '#9fb4ff', sky: '#5a6aa8', ground: '#2a2a40', fog: '#141a33', rim: .9 },
    lamp: { sun: [.3, .9, .7], sunCol: '#ffcf8a', sky: '#5a4a6a', ground: '#3a2a22', fog: '#2a1f1c', rim: .6 },
    party: { sun: [.2, 1, .6], sunCol: '#ffd9f0', sky: '#7a5ab0', ground: '#3a2a4a', fog: '#3a2850', rim: 1.0 },
    dramatic: { sun: [.8, .5, .2], sunCol: '#ffe0c0', sky: '#4a5070', ground: '#201818', fog: '#1a1820', rim: 1.1 },
  };

  // ---------------- props ----------------
  const P = {
    table: o => group(o).add(box({ p: [0, .74, 0], s: [1.2, .06, .7], col: '#8a5a36', round: .2 }),
      ...[[-.54, -.29], [.54, -.29], [-.54, .29], [.54, .29]].map(([x, z]) => box({ p: [x, .37, z], s: [.06, .74, .06], col: '#6e4428' }))),
    chair: o => group(o).add(box({ p: [0, .45, 0], s: [.46, .06, .46], col: '#7a4e2d' }), box({ p: [0, .78, -.2], s: [.46, .6, .06], col: '#7a4e2d' }),
      ...[[-.2, -.2], [.2, -.2], [-.2, .2], [.2, .2]].map(([x, z]) => box({ p: [x, .22, z], s: [.05, .45, .05], col: '#5e3a20' }))),
    bed: o => group(o).add(box({ p: [0, .25, 0], s: [1.5, .4, 2.1], col: '#7a5236', round: .1 }), box({ p: [0, .5, .05], s: [1.4, .2, 1.95], col: '#f2ede2', round: .3 }),
      box({ p: [0, .62, -.75], s: [.9, .16, .35], col: '#ffffff', round: .5 }), box({ p: [0, .58, .35], s: [1.45, .14, 1.2], col: o.col || '#4a6fa5', round: .4 }), box({ p: [0, .7, -1.05], s: [1.5, .9, .1], col: '#6a4228' })),
    sofa: o => group(o).add(box({ p: [0, .3, 0], s: [2, .4, .9], col: o.col || '#8a3a3a', round: .3 }), box({ p: [0, .7, -.38], s: [2, .6, .2], col: o.col || '#8a3a3a', round: .4 }),
      box({ p: [-.95, .5, 0], s: [.2, .45, .9], col: o.col || '#8a3a3a', round: .4 }), box({ p: [.95, .5, 0], s: [.2, .45, .9], col: o.col || '#8a3a3a', round: .4 })),
    shelf: o => group(o).add(box({ p: [0, .9, 0], s: [1, 1.8, .35], col: '#6a4228', round: .05 }),
      ...[0, 1, 2].map(i => box({ p: [0, .35 + i * .55, .02], s: [.92, .04, .3], col: '#8a5a36' })),
      ...[0, 1, 2, 3, 4, 5].map(i => box({ p: [-.35 + (i % 3) * .3, .5 + Math.floor(i / 3) * .55, .02], s: [.08 + (i % 2) * .04, .26, .22], col: ['#b8323a', '#2f5fa8', '#e6bc45', '#4a8d55'][i % 4] }))),
    plant: o => group(o).add(cyl({ p: [0, .2, 0], s: [.35, .4, .35], rt: .5, rb: .38, col: '#c4683e' }), ...[0, 1, 2, 3, 4].map(i => ball({ p: [Math.cos(i * 1.3) * .12, .55 + (i % 3) * .1, Math.sin(i * 1.3) * .12], s: [.32, .38, .32], col: i % 2 ? '#4a8d45' : '#3a7a3a' }))),
    lamp_floor: o => group(o).add(cyl({ p: [0, .02, 0], s: [.35, .04, .35], col: '#3a3a3a' }), cyl({ p: [0, .8, 0], s: [.04, 1.6, .04], col: '#3a3a3a' }),
      cyl({ p: [0, 1.65, 0], s: [.45, .3, .45], rt: .3, rb: .5, col: '#f6e3b8', emis: '#a07a30' })),
    clock: o => group(o).add(cyl({ p: [0, 0, 0], r: [Math.PI / 2, 0, 0], s: [.4, .05, .4], col: '#f4efe4' }), torus({ r: [Math.PI / 2, 0, 0], s: [.42, .42, .42], R: .48, tr: .06, col: '#5a3a22' }),
      box({ p: [0, .06, .03], s: [.02, .14, .01], col: '#222' }), box({ p: [.05, 0, .03], s: [.11, .02, .01], col: '#222' })),
    window: o => { const g = group(o); const glow = o.glow || '#cfe6ff';
      g.add(box({ p: [0, 0, 0], s: [1.5, 1.4, .08], col: glow, unlit: true, cast: false }));
      for (const [x, y, w, h] of [[0, .72, 1.62, .1], [0, -.72, 1.62, .1], [-.78, 0, .1, 1.5], [.78, 0, .1, 1.5], [0, 0, .06, 1.4], [0, 0, 1.5, .06]]) g.add(box({ p: [x, y, .05], s: [w, h, .1], col: '#f1eadc' }));
      g.add(box({ p: [-.95, 0, .12], s: [.35, 1.7, .05], col: o.curtain || '#c8643b', round: .3 }), box({ p: [.95, 0, .12], s: [.35, 1.7, .05], col: o.curtain || '#c8643b', round: .3 }));
      return g; },
    door: o => group(o).add(box({ p: [0, 1.05, 0], s: [.95, 2.1, .08], col: o.col || '#7a4e2d', round: .05 }), ball({ p: [.35, 1.0, .07], s: [.08, .08, .08], col: '#d9a83a', gloss: .8 })),
    cup: o => group(o).add(cyl({ p: [0, .05, 0], s: [.08, .1, .08], rt: .5, rb: .42, col: '#f4efe4' }), cyl({ p: [0, .095, 0], s: [.07, .01, .07], col: '#9a5b2c' }), torus({ p: [.05, .05, 0], r: [Math.PI / 2, 0, 0], s: [.06, .06, .06], R: .4, tr: .12, col: '#f4efe4' })),
    phone: o => group(o).add(box({ s: [.08, .15, .012], col: '#1d1d22', round: .3 }), box({ p: [0, 0, .007], s: [.07, .13, .002], col: '#9fd8ff', emis: '#3a6a9a', unlit: true })),
    ticket: o => group(o).add(box({ s: [.17, .08, .004], col: '#ff9ec0', round: .2 }), box({ p: [0, 0, .003], s: [.13, .02, .001], col: '#c8323a', unlit: true })),
    money: o => group(o).add(...[0, 1, 2, 3, 4, 5].map(i => box({ p: [(i % 3) * .2 - .2, .04 + Math.floor(i / 3) * .06, 0], s: [.18, .06, .09], col: '#7ab36a', round: .15 })), ...[0, 1, 2].map(i => box({ p: [i * .2 - .2, .07 + .06, 0], s: [.05, .065, .092], col: '#d9c060' }))),
    tv: o => group(o).add(box({ p: [0, .9, 0], s: [1.3, .75, .06], col: '#111', round: .05 }), box({ p: [0, .9, .035], s: [1.22, .67, .01], col: '#2a4a7a', emis: '#1a2a4a' }), box({ p: [0, .25, 0], s: [1.4, .5, .4], col: '#5a3a24' })),
    chandelier: o => { const g = group(o); g.add(cyl({ p: [0, .6, 0], s: [.02, 1.2, .02], col: '#c9a24a' }), torus({ s: [1.4, 1.4, 1.4], R: .4, tr: .05, col: '#d9b45a', gloss: .9 }));
      for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; g.add(ball({ p: [Math.cos(a) * .56, .05, Math.sin(a) * .56], s: [.12, .16, .12], col: '#fff3c8', emis: '#ffd97a', unlit: true, cast: false })); }
      return g; },
    car: o => { const g = group(o), c = o.col || '#c8323a';
      g.add(box({ p: [0, .45, 0], s: [1.8, .45, 3.8], col: c, round: .35, gloss: .9 }), box({ p: [0, .85, -.2], s: [1.5, .45, 2], col: c, round: .4, gloss: .9 }),
        box({ p: [0, .86, -.2], s: [1.52, .32, 1.8], col: '#2a3a4a', round: .4, gloss: 1 }));
      for (const [x, z] of [[-.85, 1.2], [.85, 1.2], [-.85, -1.2], [.85, -1.2]]) g.add(cyl({ p: [x, .32, z], r: [0, 0, Math.PI / 2], s: [.64, .25, .64], col: '#1a1a1a' }), cyl({ p: [x * 1.02, .32, z], r: [0, 0, Math.PI / 2], s: [.34, .26, .34], col: '#c0c0c0', gloss: 1 }));
      g.add(ball({ p: [-.6, .5, 1.9], s: [.25, .15, .05], col: '#fffbe0', unlit: true }), ball({ p: [.6, .5, 1.9], s: [.25, .15, .05], col: '#fffbe0', unlit: true }));
      return g; },
    bike: o => { const g = group(o); for (const z of [-.55, .55]) g.add(torus({ p: [0, .33, z], r: [0, 0, Math.PI / 2], s: [.66, .66, .66], R: .45, tr: .09, col: '#1a1a1a' }));
      g.add(box({ p: [0, .6, 0], s: [.12, .2, 1.0], col: o.col || '#2f5fa8', round: .4 }), box({ p: [0, .75, -.2], s: [.25, .08, .45], col: '#222', round: .4 }), cyl({ p: [0, .9, .45], r: [0, 0, Math.PI / 2], s: [.04, .6, .04], col: '#888' }));
      return g; },
    tree: o => group(o).add(cyl({ p: [0, .8, 0], s: [.3, 1.6, .3], col: '#6a4428' }), ...[[0, 2.1, 0, 1.6], [-.5, 1.7, .2, 1.1], [.5, 1.8, -.2, 1.2], [0, 2.6, 0, 1.0]].map(([x, y, z, r]) => ball({ p: [x, y, z], s: [r, r, r], col: '#4a8a40' }))),
    streetlamp: o => group(o).add(cyl({ p: [0, 1.6, 0], s: [.08, 3.2, .08], col: '#3a3a3a' }), box({ p: [0, 3.25, .25], s: [.3, .12, .6], col: '#3a3a3a' }), box({ p: [0, 3.17, .4], s: [.24, .04, .3], col: '#fff2c0', emis: o.on ? '#ffd27a' : '#000', unlit: !!o.on })),
    stall: o => group(o).add(box({ p: [0, .55, 0], s: [1.6, 1.1, .8], col: '#e6bc45', round: .05 }), box({ p: [0, 1.12, .1], s: [1.7, .06, 1.0], col: '#8a5a36' }),
      box({ p: [0, 2.05, .35], s: [1.9, .1, 1.1], r: [-.25, 0, 0], col: '#c8323a', round: .2 }), cyl({ p: [-.8, 1.55, .5], s: [.05, 1.1, .05], col: '#5a3a22' }), cyl({ p: [.8, 1.55, .5], s: [.05, 1.1, .05], col: '#5a3a22' }),
      ...[0, 1, 2, 3, 4, 5, 6].map(i => box({ p: [-.6 + i * .2, 1.6, .55], s: [.16, .3, .01], col: ['#ff9ec0', '#9ad3f5', '#fff08a'][i % 3] })),
      box({ p: [0, 2.32, .1], s: [1.2, .3, .05], col: '#fff6dc' })),
    house: o => group(o).add(box({ p: [0, 1.2, 0], s: [o.w || 3, 2.4, 2.4], col: o.col || '#e9d8b8', round: .03 }), box({ p: [0, 2.6, 0], s: [(o.w || 3) + .3, .4, 2.7], col: o.roof || '#a6372d', round: .1 }),
      box({ p: [-.7, 1.4, 1.21], s: [.6, .6, .04], col: o.win ? '#ffd27a' : '#5d7fa6', unlit: !!o.win }), box({ p: [.7, 1.4, 1.21], s: [.6, .6, .04], col: o.win ? '#ffd27a' : '#5d7fa6', unlit: !!o.win }), box({ p: [0, .6, 1.21], s: [.6, 1.2, .04], col: '#6a4228' })),
    stairs: o => group(o).add(...[0, 1, 2, 3, 4, 5, 6, 7].map(i => box({ p: [0, .1 + i * .2, -i * .3], s: [2, .2, .32], col: o.col || '#e8e2d6' }))),
    painting: o => group(o).add(box({ s: [1.2, .8, .05], col: '#c9a24a' }), box({ p: [0, 0, .03], s: [1.05, .65, .01], col: o.col || '#4a7a9a' }), ball({ p: [.2, .1, .04], s: [.25, .25, .01], col: '#f2c46a' })),
  };

  // ---------------- sets ----------------
  function walls(g, w, d, h, wallCol, floorCol, opts = {}) {
    g.add(box({ p: [0, -.05, 0], s: [w, .1, d], col: floorCol, round: .01, cast: false }));
    if (opts.planks) for (let i = 0; i < w / .4; i++) g.add(box({ p: [-w / 2 + .2 + i * .4, .002, 0], s: [.012, .004, d], col: '#00000022'.slice(0, 7) === '#000000' ? '#5a3a22' : '#5a3a22', alpha: .25, cast: false }));
    g.add(box({ p: [0, h / 2, -d / 2], s: [w, h, .15], col: wallCol, round: .01, cast: false }));
    g.add(box({ p: [-w / 2, h / 2, 0], s: [.15, h, d], col: E3.hex ? wallCol : wallCol, round: .01, cast: false }));
    g.add(box({ p: [w / 2, h / 2, 0], s: [.15, h, d], col: wallCol, round: .01, cast: false }));
    g.add(box({ p: [0, .06, -d / 2 + .09], s: [w, .12, .04], col: '#f1eadc', cast: false }));
  }
  const SETS = {
    small_room(v = {}) {
      const g = group(); walls(g, 7, 6, 3.2, v.wall || '#e9c98f', v.floor || '#a8784c', { planks: true });
      g.add(P.window({ p: [-1.2, 1.7, -2.9], glow: v.night ? '#2a3a7a' : '#d9eeff', curtain: '#4a7a9a' }));
      g.add(P.bed({ p: [2.2, 0, -1.6], col: '#c8643b' }), P.table({ p: [-1.5, 0, -.8] }), P.chair({ p: [-1.5, 0, -.2], r: [0, Math.PI, 0] }),
        P.shelf({ p: [.6, 0, -2.75] }), P.clock({ p: [2.6, 2.3, -2.9] }), P.plant({ p: [-3, 0, -2.5] }), P.cup({ p: [-1.3, .77, -.9] }), P.door({ p: [3.42, 0, .8], r: [0, -Math.PI / 2, 0] }));
      return { root: g, spots: { window: [-1.2, -2.2], table: [-1.5, -.2], bed: [2.2, -.6], center: [0, .6], door: [3, .8] }, bounds: 3, cam: { x: [-3.25, 3.25], z: [-2.75, 2.85], y: [.3, 3.0] } };
    },
    street(v = {}) {
      const g = group();
      g.add(box({ p: [0, -.05, 0], s: [60, .1, 40], col: v.night ? '#2a2a32' : '#8a8a8a', cast: false }));
      g.add(box({ p: [0, .02, -3.5], s: [60, .12, 3], col: v.night ? '#4a4648' : '#cfc6b4', cast: false }));
      for (let i = -3; i <= 3; i++) g.add(box({ p: [i * 4, .01, 1.5], s: [1.6, .02, .15], col: '#f1eadc', cast: false }));
      const cols = ['#e9d8b8', '#d9a07a', '#b9cfd8', '#e6c86a', '#c8a0b8', '#a8c890'];
      for (let i = -3; i <= 3; i++) g.add(P.house({ p: [i * 3.6, 0, -6.5], col: cols[(i + 9) % cols.length], roof: ['#a6372d', '#5a4a6a', '#2f5f6f'][(i + 9) % 3], win: !!v.night }));
      g.add(P.stall({ p: [1.2, 0, -3.6] }), P.tree({ p: [-5, 0, -4] }), P.tree({ p: [7, 0, -4.2] }), P.streetlamp({ p: [-2.6, 0, -2.4], on: !!v.night }), P.streetlamp({ p: [5, 0, -2.4], on: !!v.night }));
      return { root: g, spots: { stall: [1.2, -2.4], center: [0, -1.2], left: [-4, -1.5], right: [5, -1.5] }, bounds: 7, cam: { x: [-30, 30], z: [-1.9, 30], y: [.3, 12] } };
    },
    mansion(v = {}) {
      const g = group(); walls(g, 14, 10, 6, v.wall || '#efe6d4', v.floor || '#e2d8c8');
      for (let i = -2; i <= 2; i++) g.add(box({ p: [i * 2.6, 0, 0], s: [1.2, .005, 10], col: '#d4c8b4', alpha: .5, cast: false }));
      g.add(P.chandelier({ p: [0, 4.6, -1] }), P.sofa({ p: [-2.5, 0, -2], col: '#6a2a3a' }), P.sofa({ p: [2.5, 0, -2], col: '#6a2a3a' }), P.stairs({ p: [5, 0, -2.5] }),
        P.plant({ p: [-6, 0, -4.3], s: [1.6, 1.6, 1.6] }), P.plant({ p: [6.2, 0, -4.3], s: [1.6, 1.6, 1.6] }), P.painting({ p: [0, 3, -4.9], col: '#6a8aaa' }),
        P.window({ p: [-4, 2.6, -4.9], s: [1.6, 2, 1], glow: v.night ? '#1e2a5e' : '#e0f0ff', curtain: '#8a2a3a' }), P.window({ p: [4, 2.6, -4.9], s: [1.6, 2, 1], glow: v.night ? '#1e2a5e' : '#e0f0ff', curtain: '#8a2a3a' }),
        box({ p: [0, .01, -1.5], s: [4.5, .02, 3], col: '#8a2a2a', round: .1, cast: false }));
      return { root: g, spots: { center: [0, 0], window: [-4, -3.8], sofa: [-2.5, -1.4], stairs: [4, -1] }, bounds: 6, cam: { x: [-6.7, 6.7], z: [-4.7, 4.85], y: [.3, 5.6] } };
    },
    garage(v = {}) {
      const g = group(); walls(g, 10, 8, 3.6, '#c9ccd2', '#7a7e86');
      g.add(P.car({ p: [-1.6, 0, -1.2], r: [0, .35, 0], col: '#c8323a' }), P.car({ p: [2.2, 0, -1.6], r: [0, -.2, 0], col: '#1d3a6a' }));
      return { root: g, spots: { center: [0, 1.4], car: [-.2, .4] }, bounds: 5, cam: { x: [-4.8, 4.8], z: [-3.8, 3.85], y: [.3, 3.4] } };
    },
    void(v = {}) { const g = group(); g.add(plane({ s: [80, 1, 80], col: v.floor || '#3a3040', cast: false })); return { root: g, spots: { center: [0, 0] }, bounds: 4 }; },
  };

  window.W3 = { LIGHT, P, SETS };
})();
