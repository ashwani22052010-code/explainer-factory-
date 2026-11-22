/* Mini 3D engine (WebGL2) — deterministic, toon/storybook lighting, soft shadows, fog, rim light.
   Exposes window.E3 */
(function () {
  // ---------------- math ----------------
  const M = {
    ident: () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]),
    mul(a, b) { const o = new Float32Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s; } return o; },
    persp(fov, asp, n, f) { const t = 1 / Math.tan(fov / 2), o = new Float32Array(16); o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f); return o; },
    ortho(l, r, b, t, n, f) { const o = M.ident(); o[0] = 2 / (r - l); o[5] = 2 / (t - b); o[10] = -2 / (f - n); o[12] = -(r + l) / (r - l); o[13] = -(t + b) / (t - b); o[14] = -(f + n) / (f - n); return o; },
    lookAt(e, c, u) {
      let z = norm(sub(e, c)), x = norm(cross(u, z)), y = cross(z, x);
      return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1]);
    },
    // T * Ry * Rx * Rz * S  (euler in radians)
    trs(p, r, s) {
      const [x, y, z] = r || [0, 0, 0];
      const cx = Math.cos(x), sx = Math.sin(x), cy = Math.cos(y), sy = Math.sin(y), cz = Math.cos(z), sz = Math.sin(z);
      // R = Ry*Rx*Rz
      const r00 = cy * cz + sy * sx * sz, r01 = -cy * sz + sy * sx * cz, r02 = sy * cx;
      const r10 = cx * sz, r11 = cx * cz, r12 = -sx;
      const r20 = -sy * cz + cy * sx * sz, r21 = sy * sz + cy * sx * cz, r22 = cy * cx;
      const [a, b, c] = s || [1, 1, 1];
      return new Float32Array([r00 * a, r10 * a, r20 * a, 0, r01 * b, r11 * b, r21 * b, 0, r02 * c, r12 * c, r22 * c, 0, p[0], p[1], p[2], 1]);
    },
    normalMat(m) { // inverse-transpose of upper 3x3
      const a = m[0], b = m[1], c = m[2], d = m[4], e = m[5], f = m[6], g = m[8], h = m[9], i = m[10];
      const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C || 1e-9;
      return new Float32Array([A / det, B / det, C / det, -(b * i - c * h) / det, (a * i - c * g) / det, -(a * h - b * g) / det, (b * f - c * e) / det, -(a * f - c * d) / det, (a * e - b * d) / det]);
    }
  };
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function norm(a) { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }

  // ---------------- geometry ----------------
  function pushTri(P, N, a, b, c, na, nb, nc) { P.push(...a, ...b, ...c); N.push(...na, ...nb, ...nc); }
  const G = {
    sphere(seg = 24, ring = 16) {
      const P = [], N = [];
      const v = (i, j) => { const th = i / seg * Math.PI * 2, ph = j / ring * Math.PI; return [Math.cos(th) * Math.sin(ph), Math.cos(ph), Math.sin(th) * Math.sin(ph)]; };
      for (let j = 0; j < ring; j++) for (let i = 0; i < seg; i++) {
        const a = v(i, j), b = v(i + 1, j), c = v(i + 1, j + 1), d = v(i, j + 1);
        pushTri(P, N, a.map(x => x * .5), c.map(x => x * .5), b.map(x => x * .5), a, c, b); pushTri(P, N, a.map(x => x * .5), d.map(x => x * .5), c.map(x => x * .5), a, d, c);
      }
      return { P, N };
    },
    // rounded box: unit box [-.5,.5]^3 with corner radius r (relative)
    rbox(r = .12, seg = 6) {
      const P = [], N = [];
      const h = .5 - r;
      const faces = [[0, 1, 2, 1], [0, 1, 2, -1], [1, 2, 0, 1], [1, 2, 0, -1], [2, 0, 1, 1], [2, 0, 1, -1]];
      const S = seg * 2;
      for (const [ax, u, v, sgn] of faces) {
        const pt = (i, j) => {
          const q = [0, 0, 0]; q[ax] = sgn * .5; q[u] = -.5 + i / S; q[v] = -.5 + j / S;
          const c = [Math.max(-h, Math.min(h, q[0])), Math.max(-h, Math.min(h, q[1])), Math.max(-h, Math.min(h, q[2]))];
          const d = norm(sub(q, c)); return { p: [c[0] + d[0] * r, c[1] + d[1] * r, c[2] + d[2] * r], n: d };
        };
        for (let i = 0; i < S; i++) for (let j = 0; j < S; j++) {
          const a = pt(i, j), b = pt(i + 1, j), c = pt(i + 1, j + 1), d = pt(i, j + 1);
          if (sgn > 0) { pushTri(P, N, a.p, b.p, c.p, a.n, b.n, c.n); pushTri(P, N, a.p, c.p, d.p, a.n, c.n, d.n); }
          else { pushTri(P, N, a.p, c.p, b.p, a.n, c.n, b.n); pushTri(P, N, a.p, d.p, c.p, a.n, d.n, c.n); }
        }
      }
      return { P, N };
    },
    cyl(rt = .5, rb = .5, seg = 24, caps = true) { // height 1, centered
      const P = [], N = [];
      const slope = (rb - rt);
      for (let i = 0; i < seg; i++) {
        const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2;
        const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
        const n0 = norm([c0, slope, s0]), n1 = norm([c1, slope, s1]);
        const A = [c0 * rb, -.5, s0 * rb], B = [c1 * rb, -.5, s1 * rb], C = [c1 * rt, .5, s1 * rt], D = [c0 * rt, .5, s0 * rt];
        pushTri(P, N, A, C, B, n0, n1, n1); pushTri(P, N, A, D, C, n0, n0, n1);
        if (caps) {
          pushTri(P, N, [0, .5, 0], C, D, [0, 1, 0], [0, 1, 0], [0, 1, 0]);
          pushTri(P, N, [0, -.5, 0], A, B, [0, -1, 0], [0, -1, 0], [0, -1, 0]);
        }
      }
      return { P, N };
    },
    capsule(seg = 20, ring = 12, len = 1) { // radius .5, total height len+1 , centered
      const P = [], N = [];
      const half = len / 2;
      const v = (i, j) => {
        const th = i / seg * Math.PI * 2;
        let ph, yo;
        if (j <= ring / 2) { ph = j / ring * Math.PI; yo = half; } else { ph = j / ring * Math.PI; yo = -half; }
        const n = [Math.cos(th) * Math.sin(ph), Math.cos(ph), Math.sin(th) * Math.sin(ph)];
        return { p: [n[0] * .5, n[1] * .5 + yo, n[2] * .5], n };
      };
      for (let j = 0; j < ring; j++) for (let i = 0; i < seg; i++) {
        const a = v(i, j), b = v(i + 1, j), c = v(i + 1, j + 1), d = v(i, j + 1);
        if (j === ring / 2 - 1) { // equator band stretch
          const cc = { p: [c.p[0], -half, c.p[2]], n: c.n }, dd = { p: [d.p[0], -half, d.p[2]], n: d.n };
          pushTri(P, N, a.p, cc.p, b.p, a.n, cc.n, b.n); pushTri(P, N, a.p, dd.p, cc.p, a.n, dd.n, cc.n);
          const a2 = { p: [d.p[0], half, d.p[2]], n: d.n }, b2 = { p: [c.p[0], half, c.p[2]], n: c.n };
          pushTri(P, N, a2.p, cc.p, b2.p, a2.n, cc.n, b2.n); pushTri(P, N, a2.p, dd.p, cc.p, a2.n, dd.n, cc.n);
          continue;
        }
        pushTri(P, N, a.p, c.p, b.p, a.n, c.n, b.n); pushTri(P, N, a.p, d.p, c.p, a.n, d.n, c.n);
      }
      return { P, N };
    },
    plane() { const n = [0, 1, 0]; const P = [], N = []; pushTri(P, N, [-.5, 0, -.5], [-.5, 0, .5], [.5, 0, .5], n, n, n); pushTri(P, N, [-.5, 0, -.5], [.5, 0, .5], [.5, 0, -.5], n, n, n); return { P, N }; },
    torus(R = .4, r = .1, seg = 28, ring = 12) {
      const P = [], N = [];
      const v = (i, j) => { const u = i / seg * Math.PI * 2, w = j / ring * Math.PI * 2; const n = [Math.cos(u) * Math.cos(w), Math.sin(w), Math.sin(u) * Math.cos(w)]; return { p: [Math.cos(u) * (R + r * Math.cos(w)), r * Math.sin(w), Math.sin(u) * (R + r * Math.cos(w))], n }; };
      for (let i = 0; i < seg; i++) for (let j = 0; j < ring; j++) { const a = v(i, j), b = v(i + 1, j), c = v(i + 1, j + 1), d = v(i, j + 1); pushTri(P, N, a.p, b.p, c.p, a.n, b.n, c.n); pushTri(P, N, a.p, c.p, d.p, a.n, c.n, d.n); }
      return { P, N };
    }
  };
  G.cone = () => G.cyl(0.001, .5, 24, true);

  // ---------------- renderer ----------------
  const VS = `#version 300 es
  layout(location=0) in vec3 aP; layout(location=1) in vec3 aN;
  uniform mat4 uVP, uM, uLVP; uniform mat3 uNM;
  out vec3 vN; out vec3 vW; out vec4 vL;
  void main(){ vec4 w = uM*vec4(aP,1.); vW=w.xyz; vN=normalize(uNM*aN); vL=uLVP*w; gl_Position=uVP*w; }`;
  const FS = `#version 300 es
  precision highp float;
  in vec3 vN; in vec3 vW; in vec4 vL; out vec4 o;
  uniform vec3 uCol, uEmis, uSun, uSunCol, uSky, uGround, uFog, uCam; uniform float uFogN, uFogF, uRim, uShadowOn, uUnlit, uGloss, uAlpha;
  uniform sampler2D uSh; uniform float uShTex;
  float shadow(){
    vec3 p = vL.xyz/vL.w*.5+.5; if(p.x<0.||p.x>1.||p.y<0.||p.y>1.||p.z>1.) return 1.;
    float s=0.; for(int x=-1;x<=1;x++) for(int y=-1;y<=1;y++){ float d=texture(uSh,p.xy+vec2(x,y)*1.5/uShTex).r; s+= (p.z-0.0015>d)?0.:1.; }
    return s/9.;
  }
  void main(){
    vec3 n = normalize(vN);
    vec3 base = uCol;
    if(uUnlit>.5){ o=vec4(pow(base+uEmis,vec3(.5)),uAlpha); return; }
    float nd = dot(n, normalize(uSun));
    float sh = uShadowOn>.5 ? shadow() : 1.;
    float diff = smoothstep(-.05,.35, nd) * sh;          // soft toon band
    float wrap = clamp(nd*.5+.5,0.,1.);
    vec3 hemi = mix(uGround, uSky, n.y*.5+.5);
    vec3 v = normalize(uCam - vW);
    float rim = pow(1.-max(dot(n,v),0.), 3.) * uRim;
    vec3 h = normalize(normalize(uSun)+v);
    float spec = pow(max(dot(n,h),0.), 40.) * uGloss * sh;
    vec3 c = base*(hemi*.85 + uSunCol*diff*1.05 + uSunCol*wrap*.12) + rim*mix(uSky,vec3(1.),.4)*.55 + spec*uSunCol + uEmis;
    float fd = clamp((length(uCam-vW)-uFogN)/(uFogF-uFogN),0.,1.);
    c = mix(c, uFog, fd*fd);
    o = vec4(pow(max(c,vec3(0.)), vec3(1./2.0)), uAlpha);
  }`;
  const SVS = `#version 300 es
  layout(location=0) in vec3 aP; uniform mat4 uLVP, uM; void main(){ gl_Position = uLVP*uM*vec4(aP,1.); }`;
  const SFS = `#version 300 es
  precision highp float; out vec4 o; void main(){ o=vec4(1.); }`;

  function compile(gl, vs, fs) {
    const p = gl.createProgram();
    for (const [t, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      gl.attachShader(p, s);
    }
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); }
    return { p, u };
  }

  function hex(c) { if (Array.isArray(c)) return c; c = (c || '#888').replace('#', ''); if (c.length === 3) c = c.split('').map(x => x + x).join(''); const n = parseInt(c, 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255].map(v => Math.pow(v, 2.0)); }

  class Node {
    constructor(mesh, opt = {}) {
      this.mesh = mesh; this.children = []; this.p = opt.p || [0, 0, 0]; this.r = opt.r || [0, 0, 0]; this.s = opt.s || [1, 1, 1];
      this.col = hex(opt.col || '#cccccc'); this.emis = hex(opt.emis || '#000000'); this.unlit = !!opt.unlit; this.gloss = opt.gloss ?? .15;
      this.cast = opt.cast !== false; this.visible = true; this.alpha = opt.alpha ?? 1; this.name = opt.name || '';
    }
    add(...c) { for (const n of c) n.parent = this; this.children.push(...c); return this; }
    world() { let m = M.trs(this.p, this.r, this.s), n = this.parent; while (n) { m = M.mul(M.trs(n.p, n.r, n.s), m); n = n.parent; } return m; }
    worldPos(off = [0, 0, 0]) { const m = this.world(); return [m[0] * off[0] + m[4] * off[1] + m[8] * off[2] + m[12], m[1] * off[0] + m[5] * off[1] + m[9] * off[2] + m[13], m[2] * off[0] + m[6] * off[1] + m[10] * off[2] + m[14]]; }
  }

  class Renderer {
    constructor(canvas) {
      const gl = canvas.getContext('webgl2', { antialias: true, preserveDrawingBuffer: true, alpha: false });
      if (!gl) throw new Error('WebGL2 not available');
      this.gl = gl; this.canvas = canvas;
      this.prog = compile(gl, VS, FS); this.sprog = compile(gl, SVS, SFS);
      this.meshes = {};
      const SH = this.shSize = 1536;
      this.shTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.shTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, SH, SH, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
      for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
      this.shFb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, this.shFb);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shTex, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    mesh(key) {
      if (this.meshes[key]) return this.meshes[key];
      const [kind, ...args] = key.split(':');
      const g = G[kind](...args.map(Number));
      const gl = this.gl, vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      for (const [loc, arr] of [[0, g.P], [1, g.N]]) { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0); }
      gl.bindVertexArray(null);
      return (this.meshes[key] = { vao, n: g.P.length / 3 });
    }
    collect(node, parent, out) {
      if (!node.visible) return;
      const m = M.mul(parent, M.trs(node.p, node.r, node.s));
      if (node.mesh) out.push({ node, m });
      for (const c of node.children) this.collect(c, m, out);
    }
    render(root, cam, env) {
      const gl = this.gl, W = this.canvas.width, H = this.canvas.height;
      const items = []; this.collect(root, M.ident(), items);
      // light camera
      const sd = norm(env.sun), tgt = env.shadowCenter || cam.target, R = env.shadowRadius || 12;
      const leye = [tgt[0] + sd[0] * 30, tgt[1] + sd[1] * 30, tgt[2] + sd[2] * 30];
      const LVP = M.mul(M.ortho(-R, R, -R, R, 1, 70), M.lookAt(leye, tgt, Math.abs(sd[1]) > .99 ? [0, 0, 1] : [0, 1, 0]));
      // shadow pass
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.shFb); gl.viewport(0, 0, this.shSize, this.shSize);
      gl.enable(gl.DEPTH_TEST); gl.clear(gl.DEPTH_BUFFER_BIT); gl.colorMask(false, false, false, false);
      gl.useProgram(this.sprog.p); gl.uniformMatrix4fv(this.sprog.u.uLVP, false, LVP);
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(2.0, 4.0);
      for (const it of items) { if (!it.node.cast || it.node.unlit || it.node.alpha < 1) continue; const ms = this.mesh(it.node.mesh); gl.uniformMatrix4fv(this.sprog.u.uM, false, it.m); gl.bindVertexArray(ms.vao); gl.drawArrays(gl.TRIANGLES, 0, ms.n); }
      gl.disable(gl.POLYGON_OFFSET_FILL); gl.colorMask(true, true, true, true);
      // main pass
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H);
      const fc = hex(env.fog); gl.clearColor(fc[0] ** .5, fc[1] ** .5, fc[2] ** .5, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const P = this.prog; gl.useProgram(P.p);
      const VP = M.mul(M.persp(cam.fov * Math.PI / 180, W / H, .1, 200), M.lookAt(cam.eye, cam.target, [0, 1, 0]));
      gl.uniformMatrix4fv(P.u.uVP, false, VP); gl.uniformMatrix4fv(P.u.uLVP, false, LVP);
      gl.uniform3fv(P.u.uSun, sd); gl.uniform3fv(P.u.uSunCol, hex(env.sunCol)); gl.uniform3fv(P.u.uSky, hex(env.sky)); gl.uniform3fv(P.u.uGround, hex(env.ground));
      gl.uniform3fv(P.u.uFog, hex(env.fog)); gl.uniform1f(P.u.uFogN, env.fogNear ?? 20); gl.uniform1f(P.u.uFogF, env.fogFar ?? 80);
      gl.uniform3fv(P.u.uCam, cam.eye); gl.uniform1f(P.u.uRim, env.rim ?? .6); gl.uniform1f(P.u.uShadowOn, 1); gl.uniform1f(P.u.uShTex, this.shSize);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.shTex); gl.uniform1i(P.u.uSh, 0);
      const draw = it => {
        const n = it.node, ms = this.mesh(n.mesh);
        gl.uniformMatrix4fv(P.u.uM, false, it.m); gl.uniformMatrix3fv(P.u.uNM, false, M.normalMat(it.m));
        gl.uniform3fv(P.u.uCol, n.col); gl.uniform3fv(P.u.uEmis, n.emis); gl.uniform1f(P.u.uUnlit, n.unlit ? 1 : 0); gl.uniform1f(P.u.uGloss, n.gloss); gl.uniform1f(P.u.uAlpha, n.alpha);
        gl.bindVertexArray(ms.vao); gl.drawArrays(gl.TRIANGLES, 0, ms.n);
      };
      for (const it of items) if (it.node.alpha >= 1) draw(it);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
      for (const it of items) if (it.node.alpha < 1) draw(it);
      gl.depthMask(true); gl.disable(gl.BLEND);
      gl.finish();
    }
  }

  window.E3 = { M, G, Node, Renderer, hex,
    box: (o) => new Node('rbox:' + (o.round ?? .12) + ':' + (o.seg ?? 3), o),
    ball: (o) => new Node('sphere:' + (o.seg ?? 24) + ':' + (o.ring ?? 16), o),
    cyl: (o) => new Node('cyl:' + (o.rt ?? .5) + ':' + (o.rb ?? .5) + ':' + (o.segs ?? 24) + ':1', o),
    cap: (o) => new Node('capsule:20:12:' + (o.len ?? 1), o),
    plane: (o) => new Node('plane', o),
    cone: (o) => new Node('cone', o),
    torus: (o) => new Node('torus:' + (o.R ?? .4) + ':' + (o.tr ?? .1), o),
    group: (o) => new Node(null, o || {}) };
})();
