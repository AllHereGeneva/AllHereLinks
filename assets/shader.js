/**
 * Animated atmosphere background — the LAKE shader from the All Here app,
 * ported verbatim from AllHereApp/src/shaders/glsl.ts
 * (FRAG_EARTH_TOPDOWN + COMMON). It's the atmosphere a first-time app user
 * lands on, mapped to the `lake` theme.
 *
 * Same uniforms as the app so the GLSL is a straight copy:
 *   uniform float uTime;   // seconds since mount (pre-warmed, see WARMUP)
 *   uniform vec2  uRes;    // drawing-buffer size in pixels
 *
 * To switch atmosphere, paste another FRAG_* body from the app's glsl.ts
 * into FRAG below — `FRAG_SPACE` (twinkling stars + milky way) is the livelier
 * alternative.
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

  // LAKE — a small lake seen from above. Concentric ripples expanding from a
  // few slowly wandering drop points, a fine surface shimmer, and a depth
  // gradient so the centre reads deeper than the rim. Anchored to navy, so it
  // sits under the UI as a still pond at dusk rather than a bright sea.
  //
  // Deliberately very slow in the app: the rings expand over 6–9 minutes, so
  // the surface barely moves on a short visit. That's the intended
  // contemplative reading, not a stalled render.
  var FRAG = COMMON + '\n' + [
    '',
    '// One ripple from a centre point. `waveSpeed` and `spreadSpeed` let each',
    '// drop have its own pace, so the lake never reads as a single regular',
    '// metronome. `age` is the time since this drop landed, looping over',
    '// `cycle`; `life` fades the amplitude as the drop ages out.',
    'float ripple(vec2 p, vec2 centre, float age, float cycle,',
    '             float waveSpeed, float spreadSpeed, float k) {',
    '  float d = length(p - centre);',
    '  float wave = sin(d * k - age * waveSpeed);',
    '  float wavefront = age * spreadSpeed;',
    '  float front = smoothstep(wavefront, wavefront - 0.08, d);',
    '  float life = 1.0 - smoothstep(0.0, cycle, age);',
    '  return wave * front * life * 0.5;',
    '}',
    '',
    'void main() {',
    '  vec2 uv = gl_FragCoord.xy / uRes.xy;',
    '  vec2 p = uv;',
    '  p.x *= uRes.x / uRes.y;',
    '',
    '  vec2 centre = vec2(0.5 * uRes.x / uRes.y, 0.5);',
    '',
    '  float a1 = mod(uTime + 0.0,  380.0);',
    '  float a2 = mod(uTime + 4.7,  248.0);',
    '  float a3 = mod(uTime + 8.3,  520.0);',
    '  vec2 c1 = centre + vec2(cos(uTime * 0.0045),        sin(uTime * 0.0063))        * 0.22;',
    '  vec2 c2 = centre + vec2(cos(uTime * 0.0033 + 1.2),  sin(uTime * 0.0040 + 0.5))  * 0.32;',
    '  vec2 c3 = centre + vec2(cos(uTime * 0.0058 + 2.7),  sin(uTime * 0.0048 + 1.9))  * 0.16;',
    '  float macroRipples = ripple(p, c1, a1, 380.0, 0.140, 0.0035, 28.0)',
    '                     + ripple(p, c2, a2, 248.0, 0.200, 0.0050, 36.0)',
    '                     + ripple(p, c3, a3, 520.0, 0.115, 0.0025, 22.0);',
    '',
    '  float b1 = mod(uTime + 1.7,  312.0);',
    '  float b2 = mod(uTime + 6.3,  416.0);',
    '  vec2 m1 = centre + vec2(cos(uTime * 0.0050 + 3.2),  sin(uTime * 0.0060 + 0.9))  * 0.28;',
    '  vec2 m2 = centre + vec2(cos(uTime * 0.0040 + 4.8),  sin(uTime * 0.0048 + 2.4))  * 0.20;',
    '  float microRipples = ripple(p, m1, b1, 312.0, 0.165, 0.0033, 38.0)',
    '                     + ripple(p, m2, b2, 416.0, 0.125, 0.0020, 48.0);',
    '',
    '  float ripples = macroRipples * (1.0 + microRipples * 0.4) + microRipples * 0.18;',
    '',
    '  float shimmer = fbm(p * 7.0 + ripples * 0.6 + uTime * 0.0025);',
    '  shimmer = smoothstep(0.55, 0.85, shimmer);',
    '',
    '  float caustics = fbm(p * 2.6 + uTime * 0.00075);',
    '',
    '  // Depth: centre = deep water (darkest), rim = shallows.',
    '  float fromCentre = length(p - centre);',
    '  float depth = 1.0 - smoothstep(0.10, 0.65, fromCentre);',
    '',
    '  vec3 navy   = vec3(0.000, 0.063, 0.180);',
    '  vec3 deep   = vec3(0.010, 0.050, 0.190);',
    '  vec3 mid    = vec3(0.040, 0.130, 0.260);',
    '  vec3 light  = vec3(0.220, 0.380, 0.520);',
    '',
    '  vec3 col = navy;',
    '  col = mix(col, deep, depth * 0.85);',
    '  col = mix(col, mid,  smoothstep(0.30, 0.75, caustics) * (0.55 + 0.40 * depth));',
    '  // Crests lift more in blue than green/red, so wave tops glow watery.',
    '  col += vec3(0.05, 0.10, 0.18) * ripples;',
    '  // Specular glints where shimmer and ripple crests align.',
    '  col = mix(col, light, shimmer * smoothstep(0.05, 0.20, ripples) * 0.55);',
    '',
    '  // Outer vignette anchors the page edges back to navy.',
    '  float vig = 1.0 - smoothstep(0.55, 1.20, fromCentre * 1.6);',
    '  col *= 0.7 + 0.3 * vig;',
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
