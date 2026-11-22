/* Stylized rigged 3D characters: body joints, face rig (blink, brows, emotion mouths, visemes), action library with blending. */
(function () {
  const { box, ball, cap, cyl, group, hex } = E3;
  const SKIN = { light: '#f3cfae', medium: '#e2b18a', brown: '#c08a62', dark: '#8a5a3c' };
  const HAIR = { black: '#2a1d17', brown: '#5b3a22', blonde: '#d8b060', grey: '#a9a49c', white: '#e8e4dc', red: '#8f3a1f' };
  const COL = { red: '#c8423a', maroon: '#7e2a33', orange: '#e0843f', yellow: '#e6bc45', green: '#4a8d55', teal: '#2a8a83', blue: '#3a68b0',
    navy: '#28365e', purple: '#674796', pink: '#d97a98', white: '#f1eee8', cream: '#e9dcbc', grey: '#8d8f93', black: '#2b2725', brown: '#7a5134',
    khaki: '#a99566', beige: '#d7c39a', gold: '#d9a83a' };
  const c = (v, d) => COL[v] || (typeof v === 'string' && v[0] === '#' ? v : COL[d] || d);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, p) => a + (b - a) * p;
  const sm = p => { p = clamp(p, 0, 1); return p * p * (3 - 2 * p); };

  function build(spec = {}) {
    const age = spec.age || 'adult', female = spec.gender === 'f';
    const k = age === 'child' ? .72 : age === 'teen' ? .9 : 1;     // body scale (head stays big)
    const skin = SKIN[spec.skin] || SKIN.medium, hair = HAIR[spec.hair_color] || (age === 'old' ? HAIR.grey : HAIR.black);
    const top = c(spec.top_color, 'teal'), bottom = c(spec.bottom_color, 'navy'), shoe = '#3a2a22';
    const long = ['shirt', 'kurta', 'suit', 'coat', 'uniform'].includes(spec.top);
    const J = {};
    const root = group({ name: 'root' });
    const hips = J.hips = group({ p: [0, .86 * k, 0] }); root.add(hips);
    hips.add(box({ p: [0, -.02, 0], s: [.35 * k, .22 * k, .24 * k], col: bottom, round: .4 }));
    const spine = J.spine = group({ p: [0, .06 * k, 0] }); hips.add(spine);
    const chestW = (female ? .33 : .38) * k;
    spine.add(box({ p: [0, .21 * k, 0], s: [chestW, .46 * k, .25 * k], col: top, round: .42, seg: 4 }));
    spine.add(ball({ p: [0, .38 * k, 0], s: [chestW * 1.05, .14 * k, .25 * k], col: top }));
    if (spec.top === 'kurta' || spec.top === 'coat' || spec.top === 'saree') spine.add(box({ p: [0, -.08 * k, 0], s: [chestW * 1.02, .3 * k, .24 * k], col: spec.top === 'saree' ? c(spec.top_color, 'red') : top, round: .2 }));
    if (spec.top === 'suit') { spine.add(box({ p: [0, .3 * k, .112 * k], s: [.08, .26 * k, .01], col: '#f1eee8', round: .3 })); spine.add(box({ p: [0, .27 * k, .118 * k], s: [.035, .2 * k, .01], col: '#b8323a', round: .3 })); }
    if (spec.top === 'saree') spine.add(box({ p: [.02, .25 * k, .0], s: [.1, .5 * k, .25 * k], r: [0, 0, -.6], col: '#e6bc45', round: .3 }));
    const neck = J.neck = group({ p: [0, .43 * k, 0] }); spine.add(neck);
    neck.add(cyl({ p: [0, .03, 0], s: [.1, .1, .1], col: skin }));
    // ---- head ----
    const head = J.head = group({ p: [0, .05, 0] }); neck.add(head);
    const H = .215; // head radius-ish (stylized, slightly big)
    head.add(ball({ p: [0, H * .95, 0], s: [H * 1.9, H * 2.05, H * 1.85], col: skin, gloss: .1 }));
    head.add(ball({ p: [-H * .95, H * .9, 0], s: [.06, .085, .05], col: skin }));
    head.add(ball({ p: [H * .95, H * .9, 0], s: [.06, .085, .05], col: skin }));
    const face = group({ p: [0, H * .9, H * .9] }); head.add(face);
    face.add(ball({ p: [0, -.01, .045], s: [.05, .055, .05], col: skin }));                     // nose
    const eyes = [];
    for (const sx of [-1, 1]) {
      const eg = group({ p: [sx * .075, .045, 0] });
      eg.add(ball({ p: [0, 0, .006], s: [.085, .1, .05], col: '#fbfbfb', gloss: .4, cast: false }));
      const iris = ball({ p: [0, -.004, .026], s: [.05, .058, .02], col: '#3a2418', gloss: .6, cast: false }); eg.add(iris);
      eg.add(ball({ p: [0, -.004, .033], s: [.024, .028, .01], col: '#0d0806', cast: false }));
      eg.add(ball({ p: [.012, .012, .038], s: [.014, .014, .006], col: '#ffffff', unlit: true, cast: false }));
      const lid = ball({ p: [0, .02, .01], s: [.092, .055, .054], col: skin, cast: false }); eg.add(lid);
      face.add(eg); eyes.push({ eg, lid, iris });
    }
    const brows = [-1, 1].map(sx => { const b = box({ p: [sx * .075, .12, .012], s: [.085, .02, .02], col: hair, round: .45, cast: false }); face.add(b); return b; });
    const mouth = group({ p: [0, -.085, .012] }); face.add(mouth);
    const mDark = ball({ s: [.07, .02, .02], col: '#5a1e1e', cast: false }); mouth.add(mDark);
    const teeth = box({ p: [0, .006, .004], s: [.05, .012, .01], col: '#fbf7f0', round: .4, cast: false }); mouth.add(teeth);
    const cover = ball({ p: [0, .012, .006], s: [.085, .024, .02], col: skin, cast: false }); mouth.add(cover);
    const blush = [-1, 1].map(sx => { const b = ball({ p: [sx * .12, -.045, -.01], s: [.05, .03, .01], col: '#e88a7a', alpha: .45, cast: false }); face.add(b); return b; });
    if (spec.beard === 'full') head.add(ball({ p: [0, H * .45, H * .55], s: [H * 1.6, H * 1.1, H * 1.1], col: hair }));
    if (spec.beard === 'mustache') face.add(box({ p: [0, -.058, .03], s: [.09, .022, .02], col: hair, round: .45 }));
    if (spec.beard === 'stubble') head.add(ball({ p: [0, H * .55, H * .45], s: [H * 1.7, H * 1.0, H * 1.2], col: hair, alpha: .25, cast: false }));
    if (spec.glasses) for (const sx of [-1, 1]) face.add(E3.torus({ p: [sx * .075, .045, .03], r: [Math.PI / 2, 0, 0], s: [.22, .22, .22], R: .4, tr: .05, col: '#2a2a2a' }));
    // hair styles
    const hs = spec.hair || (female ? 'long' : 'short');
    if (hs !== 'bald') head.add(ball({ p: [0, H * 1.3, -H * .28], s: [H * 2.08, H * 1.75, H * 1.95], col: hair, gloss: .25 }));
    if (hs === 'short' || hs === 'spiky' || hs === 'curly') head.add(box({ p: [0, H * 1.72, H * .5], s: [H * 1.6, H * .32, H * .7], r: [.5, 0, 0], col: hair, round: .45 }));
    if (hs === 'long' || hs === 'ponytail') { head.add(box({ p: [0, H * .7, -H * .5], s: [H * 1.95, H * 1.8, H * .9], col: hair, round: .45 })); head.add(box({ p: [0, H * 1.72, H * .5], s: [H * 1.6, H * .3, H * .6], r: [.5, 0, 0], col: hair, round: .45 })); }
    if (hs === 'bun') { head.add(ball({ p: [0, H * 1.95, -H * .7], s: [H * .9, H * .9, H * .9], col: hair })); }
    if (hs === 'curly') for (let i = 0; i < 7; i++) head.add(ball({ p: [Math.cos(i) * H * .8, H * 1.65 + Math.sin(i * 2) * .02, Math.sin(i) * H * .6 - .03], s: [H * .7, H * .6, H * .7], col: hair }));
    if (spec.hat === 'cap') { head.add(ball({ p: [0, H * 1.35, 0], s: [H * 2.08, H * 1.3, H * 2.0], col: c(spec.hat_color, 'red') })); head.add(box({ p: [0, H * 1.3, H * 1.05], s: [H * 1.5, .02, H * .9], col: c(spec.hat_color, 'red'), round: .3 })); }
    if (spec.bindi) face.add(ball({ p: [0, .095, .02], s: [.018, .018, .008], col: '#c8323a', cast: false }));
    // ---- arms ----
    const armLen = .27 * k, foreLen = .25 * k;
    for (const sx of [-1, 1]) {
      const n = sx < 0 ? 'L' : 'R';
      const sh = J['sh' + n] = group({ p: [sx * (chestW / 2 + .02), .4 * k, 0] }); spine.add(sh);
      sh.add(ball({ s: [.13 * k, .13 * k, .13 * k], col: top }));
      sh.add(cap({ p: [0, -armLen / 2, 0], s: [.12 * k, armLen * 1.1 / 1.6, .12 * k], len: .6, col: top }));
      const el = J['el' + n] = group({ p: [0, -armLen, 0] }); sh.add(el);
      el.add(ball({ s: [.105 * k, .105 * k, .105 * k], col: long ? top : skin }));
      el.add(cap({ p: [0, -foreLen / 2, 0], s: [.1 * k, foreLen * 1.1 / 1.6, .1 * k], len: .6, col: long ? top : skin }));
      const hand = J['hand' + n] = group({ p: [0, -foreLen, 0] }); el.add(hand);
      hand.add(ball({ p: [0, -.045, 0], s: [.095 * k, .11 * k, .07 * k], col: skin }));
      hand.add(ball({ p: [sx * -.04 * k, -.02, .02], s: [.035, .06, .035], r: [0, 0, sx * .6], col: skin })); // thumb
    }
    // ---- legs ----
    const thigh = .4 * k, shin = .38 * k;
    for (const sx of [-1, 1]) {
      const n = sx < 0 ? 'L' : 'R';
      const hp = J['hip' + n] = group({ p: [sx * .09 * k, -.06 * k, 0] }); hips.add(hp);
      hp.add(cap({ p: [0, -thigh / 2, 0], s: [.16 * k, thigh * 1.12 / 1.6, .16 * k], len: .6, col: bottom }));
      const kn = J['kn' + n] = group({ p: [0, -thigh, 0] }); hp.add(kn);
      kn.add(ball({ s: [.14 * k, .14 * k, .14 * k], col: (spec.bottom === 'shorts' || spec.bottom === 'skirt') ? skin : bottom }));
      kn.add(cap({ p: [0, -shin / 2, 0], s: [.135 * k, shin * 1.1 / 1.6, .135 * k], len: .6, col: (spec.bottom === 'shorts' || spec.bottom === 'skirt') ? skin : bottom }));
      const ft = J['ft' + n] = group({ p: [0, -shin, 0] }); kn.add(ft);
      ft.add(box({ p: [0, -.03, .05], s: [.12 * k, .08, .24 * k], col: shoe, round: .4 }));
    }
    if (spec.bottom === 'skirt' || spec.bottom === 'dress' || spec.top === 'saree') hips.add(cyl({ p: [0, -.28 * k, 0], s: [.42 * k, .5 * k, .32 * k], rt: .38, rb: .5, col: spec.top === 'saree' ? c(spec.top_color, 'red') : bottom }));
    const ch = { root, J, eyes, brows, mouth: { g: mouth, dark: mDark, teeth, cover }, blush, k, spec, prop: null,
      state: { action: 'idle', prev: null, since: 0, emotion: 'neutral' } };
    return ch;
  }

  // ---------------- poses (joint euler rotations, radians) ----------------
  const base = () => ({ hips: [0, 0, 0], spine: [0, 0, 0], neck: [0, 0, 0], head: [0, 0, 0],
    shL: [0, 0, -.12], shR: [0, 0, .12], elL: [-.15, 0, 0], elR: [-.15, 0, 0], handL: [0, 0, 0], handR: [0, 0, 0],
    hipL: [0, 0, 0], hipR: [0, 0, 0], knL: [0, 0, 0], knR: [0, 0, 0], ftL: [0, 0, 0], ftR: [0, 0, 0], y: 0, lean: 0 });

  const ACTIONS = {
    idle(t, ph) { const p = base(); const b = Math.sin(t * 1.8 + ph); p.spine[0] = b * .015; p.hips[2] = Math.sin(t * .6 + ph) * .02; p.head[1] = Math.sin(t * .35 + ph) * .12; p.head[0] = Math.sin(t * .5 + ph) * .03; p.shL[2] = -.12 - b * .015; p.shR[2] = .12 + b * .015; return p; },
    talk(t, ph, ch) { const p = ACTIONS.idle(t, ph); p.head[0] += Math.sin(t * 4.2) * .04 * (ch._amp || 0) + Math.sin(t * 1.3) * .03; p.head[2] = Math.sin(t * .9 + ph) * .04;
      // occasional beat gesture (every ~4s), not constant waving
      const cyc = (t + ph * 2) % 4.2, g = cyc < 1.6 ? Math.sin(cyc / 1.6 * Math.PI) : 0;
      p.shR[0] = -.5 * g; p.elR[0] = -.15 - 1.0 * g; p.shR[2] = .12 + .15 * g; p.handR[1] = -.6 * g; return p; },
    walk(t, ph) { const p = base(); const w = t * 6.2; const s = Math.sin(w);
      p.hipL[0] = s * .45; p.hipR[0] = -s * .45; p.knL[0] = Math.max(0, -Math.cos(w)) * .7; p.knR[0] = Math.max(0, Math.cos(w)) * .7;
      p.shL[0] = -s * .35; p.shR[0] = s * .35; p.elL[0] = -.35; p.elR[0] = -.35; p.y = Math.abs(Math.cos(w)) * .03; p.spine[1] = s * .06; p.hips[1] = -s * .06; p.spine[0] = .05; return p; },
    run(t, ph) { const p = ACTIONS.walk(t * 1.6, ph); p.spine[0] = .18; p.elL[0] = p.elR[0] = -1.2; p.y *= 2; return p; },
    phone(t, ph) { const p = ACTIONS.idle(t, ph); p.shR[0] = -.35; p.shR[2] = .55; p.elR[0] = -2.3; p.handR[1] = .4; p.head[2] = .12; return p; },
    look_phone(t, ph) { const p = ACTIONS.idle(t, ph); p.shR[0] = -.55; p.elR[0] = -1.5; p.shL[0] = -.45; p.elL[0] = -1.5; p.shL[2] = -.25; p.shR[2] = .25; p.head[0] = .38; p.neck[0] = .1; return p; },
    shock(t, ph) { const p = base(); const j = Math.sin(t * 22) * .01; p.shL[0] = -.4; p.shL[2] = -1.6; p.elL[0] = -2.2; p.shR[0] = -.4; p.shR[2] = 1.6; p.elR[0] = -2.2; p.spine[0] = -.12 + j; p.head[0] = -.12; return p; },
    celebrate(t, ph) { const p = base(); const j = Math.abs(Math.sin(t * 5)); p.y = j * .22; p.shL[2] = -2.6 + Math.sin(t * 10) * .15; p.shR[2] = 2.6 - Math.sin(t * 10) * .15; p.elL[0] = p.elR[0] = -.2; p.knL[0] = p.knR[0] = (1 - j) * .5; p.hipL[0] = p.hipR[0] = -(1 - j) * .25; p.head[0] = -.15; return p; },
    sad(t, ph) { const p = base(); p.head[0] = .42; p.neck[0] = .15; p.spine[0] = .18; p.shL[2] = -.05; p.shR[2] = .05; p.shL[0] = p.shR[0] = .1; p.spine[1] = Math.sin(t * .4) * .03; return p; },
    think(t, ph) { const p = ACTIONS.idle(t, ph); p.shR[0] = -.6; p.shR[2] = .3; p.elR[0] = -2.35; p.handR[0] = .3; p.shL[0] = -.3; p.elL[0] = -1.3; p.shL[2] = -.2; p.head[2] = .1; p.head[0] = -.06; return p; },
    point(t, ph) { const p = ACTIONS.idle(t, ph); p.shR[0] = -1.45; p.shR[2] = .1; p.elR[0] = -.05; return p; },
    hug(t, ph) { const p = ACTIONS.idle(t, ph); p.shL[0] = p.shR[0] = -1.2; p.shL[1] = .5; p.shR[1] = -.5; p.elL[0] = p.elR[0] = -1.1; p.shL[2] = -.3; p.shR[2] = .3; p.spine[0] = .08; return p; },
    hold(t, ph) { const p = ACTIONS.idle(t, ph); p.shL[0] = p.shR[0] = -.5; p.elL[0] = p.elR[0] = -1.25; p.shL[2] = -.1; p.shR[2] = .1; p.head[0] = .25; return p; },
    cry(t, ph) { const p = ACTIONS.sad(t, ph); p.shL[0] = p.shR[0] = -.7; p.elL[0] = p.elR[0] = -2.4; p.shL[2] = -.5; p.shR[2] = .5; p.spine[0] += Math.sin(t * 7) * .03; return p; },
    sit(t, ph) { const p = ACTIONS.idle(t, ph); p.hipL[0] = p.hipR[0] = -1.5; p.knL[0] = p.knR[0] = 1.5; p.y = -.38; p.shL[0] = p.shR[0] = -.35; p.elL[0] = p.elR[0] = -.9; return p; },
    sit_talk(t, ph, ch) { const p = ACTIONS.sit(t, ph); const q = ACTIONS.talk(t, ph, ch); p.head = q.head; p.shR = q.shR; p.elR = q.elR; p.shR[0] -= .35; return p; },
    sit_phone(t, ph) { const p = ACTIONS.sit(t, ph); const q = ACTIONS.look_phone(t, ph); p.shL = q.shL; p.shR = q.shR; p.elL = q.elL; p.elR = q.elR; p.head = q.head; p.neck = q.neck; return p; },
    sit_shock(t, ph) { const p = ACTIONS.sit(t, ph); const q = ACTIONS.shock(t, ph); p.shL = q.shL; p.shR = q.shR; p.elL = q.elL; p.elR = q.elR; p.spine = q.spine; p.head = q.head; return p; },
    lie(t, ph) { const p = base(); p.shL[2] = -.25; p.shR[2] = .25; p.spine[0] = Math.sin(t * 1.4) * .01; return p; },
    wave(t, ph) { const p = ACTIONS.idle(t, ph); p.shR[2] = 2.4; p.elR[0] = -.3; p.elR[2] = Math.sin(t * 9) * .4; return p; },
    walk_away(t, ph) { return ACTIONS.walk(t, ph); },
    shrug(t, ph) { const p = ACTIONS.idle(t, ph); p.shL[2] = -.5; p.shR[2] = .5; p.elL[0] = p.elR[0] = -1.4; p.elL[1] = .8; p.elR[1] = -.8; p.head[2] = .15; return p; },
    count(t, ph) { const p = ACTIONS.hold(t, ph); p.handR[0] = Math.max(0, Math.sin(t * 7)) * .5; return p; }
  };

  const EMO = { // brows: [rotZ inner up?, yOff]; eyeOpen; mouth: smile -1..1, open; blush
    neutral: { brow: [0, 0], eye: 1, smile: 0, open: 0, blush: 0 },
    happy: { brow: [.12, .01], eye: .85, smile: 1, open: .25, blush: .5 },
    joy: { brow: [.2, .02], eye: .7, smile: 1, open: .9, blush: .8 },
    sad: { brow: [-.45, -.005], eye: .7, smile: -.8, open: 0, blush: 0 },
    angry: { brow: [.5, -.02], eye: .8, smile: -.5, open: .15, blush: 0 },
    shock: { brow: [-.1, .04], eye: 1.35, smile: 0, open: 1, blush: 0 },
    scared: { brow: [-.5, .03], eye: 1.25, smile: -.4, open: .5, blush: 0 },
    worried: { brow: [-.4, .015], eye: 1, smile: -.3, open: 0, blush: 0 },
    smirk: { brow: [.1, 0], eye: .8, smile: .6, open: 0, blush: 0 },
    thinking: { brow: [-.2, .02], eye: .85, smile: 0, open: 0, blush: 0 },
    sleep: { brow: [0, -.005], eye: 0, smile: .1, open: 0, blush: 0 },
  };

  // viseme from current letter
  function viseme(word, frac) {
    if (!word) return { w: 1, h: 0 };
    const chars = [...word.toLowerCase()];
    const ch = chars[Math.min(chars.length - 1, Math.floor(frac * chars.length))] || '';
    if (/[mbpमबपभफ]/.test(ch)) return { w: .9, h: .05 };
    if (/[ouोौुूउऊओऔw]/.test(ch)) return { w: .6, h: .8 };
    if (/[eiyिीेैइईएऐ]/.test(ch)) return { w: 1.25, h: .45 };
    if (/[aाअआ]/.test(ch)) return { w: 1.1, h: 1 };
    if (/[fvफव]/.test(ch)) return { w: 1, h: .25 };
    return { w: 1, h: .6 };
  }

  function apply(ch, t, opts = {}) {
    const st = ch.state, ph = (ch.spec.seed || 1) * 1.7;
    const lt = t - st.since;
    const cur = (ACTIONS[st.action] || ACTIONS.idle)(lt, ph, ch);
    let pose = cur;
    if (st.prev && lt < .45) {
      const pv = (ACTIONS[st.prev] || ACTIONS.idle)(t - (st.prevSince || 0), ph, ch), w = sm(lt / .45);
      pose = {};
      for (const key in cur) pose[key] = Array.isArray(cur[key]) ? cur[key].map((v, i) => lerp(pv[key][i], v, w)) : lerp(pv[key], cur[key], w);
    }
    const J = ch.J;
    for (const key of Object.keys(J)) if (pose[key]) J[key].r = pose[key];
    J.hips.p = [0, .86 * ch.k + (pose.y || 0), 0];
    // face
    const E = EMO[st.emotion] || EMO.neutral;
    const PE = st.prevEmo && (t - st.emoSince) < .35 ? (EMO[st.prevEmo] || EMO.neutral) : null;
    const ew = PE ? sm((t - st.emoSince) / .35) : 1;
    const mix = key => PE ? lerp(PE[key], E[key], ew) : E[key];
    const browR = PE ? lerp(PE.brow[0], E.brow[0], ew) : E.brow[0], browY = PE ? lerp(PE.brow[1], E.brow[1], ew) : E.brow[1];
    ch.brows.forEach((b, i) => { const sx = i ? 1 : -1; b.r = [0, 0, sx * browR]; b.p = [sx * .075, .12 + browY, .012]; });
    const blinkC = (t + ph) % 3.7, blink = blinkC < .14 ? Math.abs(blinkC - .07) / .07 : 1;
    const eyeOpen = mix('eye') * blink;
    ch.eyes.forEach(e => { e.eg.s = [1, clamp(.15 + .85 * Math.min(1, eyeOpen), .1, 1.4) * (eyeOpen > 1 ? eyeOpen : 1), 1]; e.lid.p = [0, .022 + .035 * Math.min(1, eyeOpen), .01]; e.lid.visible = eyeOpen < .98;
      e.iris.p = [Math.sin(t * .3 + ph) * .006 + (opts.lookX || 0) * .01, -.004, .018]; });
    // mouth: emotion + talking visemes
    let smile = mix('smile'), open = mix('open'), mw = 1;
    if (opts.talking) {
      const amp = opts.amp || 0; ch._amp = amp;
      const v = viseme(opts.word, opts.wordFrac || 0);
      open = Math.max(open * .5, amp * v.h * 1.1); mw = v.w; smile *= .5;
    } else ch._amp = 0;
    const M = ch.mouth;
    M.dark.s = [.07 * mw * (1 + Math.abs(smile) * .25), .016 + open * .045, .02];
    M.dark.p = [0, -open * .012, 0];
    M.teeth.visible = open > .25; M.teeth.p = [0, .004 + .0, .006];
    // smile = cover from above (crescent bottom); frown = cover from below
    M.cover.visible = Math.abs(smile) > .15 && open < .5;
    M.cover.p = [0, smile > 0 ? .013 - (1 - smile) * .004 : -.014, .007];
    M.cover.s = [.09 * mw, .022, .022];
    ch.blush.forEach(b => b.visible = mix('blush') > .1);
  }

  function setAction(ch, action, t) {
    const st = ch.state;
    if (st.action === action) return;
    st.prev = st.action; st.prevSince = st.since; st.action = action; st.since = t;
  }
  function setEmotion(ch, emo, t) {
    const st = ch.state;
    if (st.emotion === emo) return;
    st.prevEmo = st.emotion; st.emotion = emo; st.emoSince = t;
  }

  window.C3 = { build, apply, setAction, setEmotion, ACTIONS: Object.keys(ACTIONS), EMOTIONS: Object.keys(EMO), COL };
})();
