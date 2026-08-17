/**
 * Animated atmosphere background — the SPACE shader from the All Here app,
 * ported verbatim from AllHereApp/src/shaders/glsl.ts (FRAG_SPACE + COMMON).
 *
 * Same uniforms as the app so the GLSL is a straight copy:
 *   uniform float uTime;   // seconds since mount (pre-warmed, see WARMUP)
 *   uniform vec2  uRes;    // drawing-buffer size in pixels
 *
 * To switch atmosphere, paste another FRAG_* body from the app's glsl.ts
 * into FRAG below. `lake` (FRAG_EARTH_TOPDOWN) is the quieter alternative —
 * ripples on still water, the theme a first-time app user lands on.
 *
 * Perf guardrails mirror the app's AtmosphereBackground:
 *   - draw every 3rd rAF frame (~20 fps) — the field is slow, and a phone
 *     shading a full-screen fbm at 60 fps just burns battery
 *   - drawing buffer capped at 1.5× CSS pixels (a 3× DPR phone would
 *     otherwise shade 9× the fragments for no visible gain)
 *   - stop submitting frames when the tab is hidden, and keep the clock
 *     continuous across the pause so the field doesn't jump on return
 */
(function () {
  'use strict';

  var COMMON = [
    'precision highp float;',
    '',
    'uniform float uTime;',
    'uniform vec2  uRes;',
    '',
    // Hoskins-style hash — keeps every intermediate small so the field stays
    // stable on GPUs that silently downgrade fragment `highp` to `mediump`
    // (Mali / Tensor). The naive hash banded into visible horizontal bars.
    'float hash(vec2 p) {',
    '  vec3 p3 = fract(vec3(p.xyx) * 0.1031);',
    '  p3 += dot(p3, p3.yzx + 33.33);',
    '  return fract((p3.x + p3.y) * p3.z);',
    '}',
    'float vnoise(vec2 p) {',
    '  vec2 i = floor(p);',
    '  vec2 f = fract(p);',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(',
    '    mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),',
    '    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),',
    '    u.y',
    '  );',
    '}',
    'float fbm(vec2 p) {',
    '  float v = 0.0;',
    '  float a = 0.5;',
    '  for (int i = 0; i < 5; i++) {',
    '    v += a * vnoise(p);',
    '    p = p * 2.02;',
    '    a *= 0.5;',
    '  }',
    '  return v;',
    '}',
    '',
    // Triangular-PDF dither, ~1 LSB of an 8-bit channel — dissolves the
    // gradient banding that shows up when highp isn't honoured.
    'vec3 dither(vec2 fragCoord) {',
    '  float r = hash(fragCoord);',
    '  float g = hash(fragCoord + 17.13);',
    '  return vec3((r + g - 1.0) / 255.0);',
    '}',
  ].join('\n');

  var VERT = [
    'attribute vec2 aPos;',
    'void main() {',
    '  gl_Position = vec4(aPos, 0.0, 1.0);',
    '}',
  ].join('\n');

  // SPACE — twinkling star layers, an irregular milky-way band of ridge-fbm
  // dust, and three distant galaxies. In the app this is the atmosphere a
  // user reaches at the end of the Silent Mind journey.
  var FRAG = COMMON + '\n' + [
    '',
    '// One layer of fixed stars — each star gets an independent twinkle',
    '// rate, phase and intensity, so the field never blinks in unison.',
    'float starLayer(vec2 p, float density, float bri) {',
    '  vec2 i = floor(p);',
    '  vec2 f = fract(p);',
    '  float h = hash(i);',
    '  float exists = step(1.0 - density, h);',
    '  vec2 c = vec2(hash(i + 1.7), hash(i + 3.1));',
    '  float d = length(f - c);',
    '  float hRate  = hash(i + 5.3);',
    '  float hPhase = hash(i + 9.1);',
    '  float hPeak  = hash(i + 11.7);',
    '  float hSize  = hash(i + 17.9);',
    '  float rate   = mix(0.4, 1.6, hRate);',
    '  float phase  = hPhase * 6.28;',
    '  float peak   = mix(0.35, 1.0, hPeak);',
    '  float size   = mix(0.04, 0.07, hSize);',
    '  float twinkle = 0.55 + 0.45 * sin(uTime * rate + phase);',
    '  float disc = 1.0 - smoothstep(0.0, size, d);',
    '  return bri * peak * twinkle * disc * exists;',
    '}',
    '',
    'void main() {',
    '  vec2 uv = gl_FragCoord.xy / uRes.xy;',
    '  vec2 q = uv - 0.5;',
    '  q.x *= uRes.x / uRes.y;',
    '',
    '  float bgN = vnoise(q * 0.7 + 7.3);',
    '  vec3 col = vec3(0.010, 0.008, 0.026) * bgN;',
    '',
    '  float angle = 0.55;',
    '  vec2 bandDir = vec2(cos(angle), sin(angle));',
    '  vec2 perp    = vec2(-bandDir.y, bandDir.x);',
    '  float bandAxis = dot(q, perp);',
    '  float drift = dot(q, bandDir);',
    '  float bandMask = exp(-bandAxis * bandAxis * 5.0);',
    '  float shapeN = vnoise(vec2(drift * 0.6 + uTime * 0.010, bandAxis * 0.5));',
    '  float shapeMask = 0.55 + 0.45 * smoothstep(0.25, 0.70, shapeN);',
    '',
    '  float n1 = fbm(vec2(drift * 3.5, bandAxis * 4.5));',
    '  float n2 = fbm(vec2(drift * 7.0 + 1.7, bandAxis * 7.0));',
    '  float r1 = pow(1.0 - abs(2.0 * n1 - 1.0), 3.0);',
    '  float r2 = pow(1.0 - abs(2.0 * n2 - 1.0), 4.0);',
    '  float dust = clamp(r1 * 0.80 + r2 * 0.55, 0.0, 1.0);',
    '  float hueT = 0.5 + 0.5 * sin(drift * 2.0 + uTime * 0.12);',
    '  vec3 hueA = vec3(0.24, 0.04, 0.14);',
    '  vec3 hueB = vec3(0.06, 0.02, 0.26);',
    '  vec3 hueC = vec3(0.04, 0.16, 0.22);',
    '  vec3 dustWarm = mix(hueA, hueB, smoothstep(0.0, 0.55, hueT));',
    '  dustWarm = mix(dustWarm, hueC, smoothstep(0.55, 1.0, hueT));',
    '  vec3 dustCool = vec3(0.02, 0.00, 0.05);',
    '  vec3 dustCol = mix(dustCool, dustWarm, smoothstep(0.20, 0.70, dust));',
    '  col = mix(col, dustCol, bandMask * shapeMask * 0.70);',
    '',
    '  float spine = exp(-bandAxis * bandAxis * 22.0) * smoothstep(0.40, 0.90, dust);',
    '  vec3 spineCol = mix(vec3(0.36, 0.08, 0.24), vec3(0.10, 0.06, 0.34), smoothstep(0.0, 0.55, hueT));',
    '  spineCol = mix(spineCol, vec3(0.06, 0.22, 0.30), smoothstep(0.55, 1.0, hueT));',
    '  col += spineCol * spine * shapeMask * 0.45;',
    '',
    '  vec2 galPos1 = vec2(-0.30, 0.20);',
    '  vec2 galPos2 = vec2( 0.35,-0.25);',
    '  vec2 galPos3 = vec2(-0.05,-0.40);',
    '',
    '  float core1 = exp(-dot(q - galPos1, q - galPos1) * 500.0);',
    '  float core2 = exp(-dot(q - galPos2, q - galPos2) * 650.0);',
    '  float core3 = exp(-dot(q - galPos3, q - galPos3) * 750.0);',
    '',
    '  float gr1 = length(q - galPos1);',
    '  float gr2 = length(q - galPos2);',
    '  float gr3 = length(q - galPos3);',
    '  float disc1 = (1.0 - smoothstep(0.04, 0.13, gr1));',
    '  float disc2 = (1.0 - smoothstep(0.03, 0.10, gr2));',
    '  float disc3 = (1.0 - smoothstep(0.04, 0.12, gr3));',
    '',
    '  float tex1 = vnoise((q - galPos1) * 16.0);',
    '  float tex2 = vnoise((q - galPos2) * 22.0 + 1.7);',
    '  float tex3 = vnoise((q - galPos3) * 18.0 + 3.3);',
    '  disc1 *= 0.35 + 0.85 * tex1;',
    '  disc2 *= 0.35 + 0.85 * tex2;',
    '  disc3 *= 0.35 + 0.85 * tex3;',
    '',
    '  col += vec3(0.22, 0.06, 0.32) * (core1 * 0.45 + disc1 * 0.55);',
    '  col += vec3(0.30, 0.06, 0.20) * (core2 * 0.45 + disc2 * 0.45);',
    '  col += vec3(0.08, 0.08, 0.30) * (core3 * 0.45 + disc3 * 0.55);',
    '',
    '  float s = 0.0;',
    '  s += starLayer(q * 24.0,  0.040, 0.9);',
    '  s += starLayer(q * 50.0,  0.025, 0.55);',
    '  float bs = starLayer(q * 70.0 + 5.1, 0.080, 1.0);',
    '  col += vec3(1.0, 0.97, 0.92) * (s + bs * bandMask * shapeMask * 1.4);',
    '',
    '  col += dither(gl_FragCoord.xy);',
    '  gl_FragColor = vec4(col, 1.0);',
    '}',
  ].join('\n');

  // Skip the initial "field just spawned" phase so the very first frame
  // already shows a settled sky. Same value the app uses.
  var WARMUP_SECONDS = 60;
  // Cap the drawing buffer. A 3× DPR phone shading a full-screen fbm at
  // native resolution drops frames for detail nobody can see.
  var MAX_DPR = 1.5;
  // Draw 1 frame in 3 (~20 fps). The star twinkle is 0.4–1.6 Hz; the dust
  // and galaxies are static. 20 fps is indistinguishable here.
  var FRAME_DIVISOR = 3;

  function compile(gl, type, src) {
    var sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.warn('[shader] compile failed', gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  function start(canvas) {
    var gl = canvas.getContext('webgl', { antialias: false, alpha: false })
          || canvas.getContext('experimental-webgl', { antialias: false, alpha: false });
    // No WebGL (or blocked): the CSS gradient painted on <body> stays put,
    // which is the same fallback the app uses when GL is unavailable.
    if (!gl) return false;

    var vsh = compile(gl, gl.VERTEX_SHADER, VERT);
    var fsh = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vsh || !fsh) return false;

    var prog = gl.createProgram();
    gl.attachShader(prog, vsh);
    gl.attachShader(prog, fsh);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn('[shader] link failed', gl.getProgramInfoLog(prog));
      return false;
    }
    gl.useProgram(prog);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    var uTime = gl.getUniformLocation(prog, 'uTime');
    var uRes = gl.getUniformLocation(prog, 'uRes');

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      // Read the canvas' own CSS box rather than innerWidth/innerHeight:
      // on mobile Safari the visual viewport shrinks as the URL bar
      // collapses, and resizing to it mid-scroll made the field jump.
      var w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      var h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width === w && canvas.height === h) return;
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uRes, w, h);
      // Assigning width/height clears the drawing buffer to black. Waiting for
      // the next scheduled frame would flash that black through a rotation, so
      // repaint straight away. `submit` is defined below; on the very first
      // call (from setup) it isn't hoisted yet, hence the guard.
      if (submit) submit();
    }
    var submit = null;
    resize();
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', resize);

    var startMs = Date.now() - WARMUP_SECONDS * 1000;
    // uTime is wall-clock based, so a hidden tab would otherwise resume with
    // the whole hidden duration folded in — a visible jump in the field.
    // Accumulate the hidden time and subtract it so the clock is continuous.
    var pausedAccum = 0;
    var frozenSince = null;
    var frameIdx = 0;
    var rafId = 0;

    submit = function () {
      gl.uniform1f(uTime, (Date.now() - startMs - pausedAccum) / 1000);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    function draw() {
      frameIdx++;
      if (frameIdx % FRAME_DIVISOR === 0) submit();
      rafId = requestAnimationFrame(draw);
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        if (frozenSince === null) frozenSince = Date.now();
        if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      } else {
        if (frozenSince !== null) {
          pausedAccum += Date.now() - frozenSince;
          frozenSince = null;
        }
        if (!rafId) { frameIdx = FRAME_DIVISOR - 1; rafId = requestAnimationFrame(draw); }
      }
    });

    rafId = requestAnimationFrame(draw);
    return true;
  }

  var canvas = document.getElementById('atmosphere');
  if (canvas) {
    var ok = false;
    try { ok = start(canvas); } catch (e) { console.warn('[shader]', e); }
    // Hide the canvas on failure so the body gradient shows through cleanly
    // instead of a transparent-but-present element.
    if (!ok) canvas.style.display = 'none';
  }
})();
