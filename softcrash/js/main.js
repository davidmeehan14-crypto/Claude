// Soft Crash engine: scene -> (transition mix) -> bloom chain -> composite with text layer.
// Live mode plays the song and renders in real time; render mode exposes FILM.renderFrame(t) for the offline renderer.
(() => {
const W = 1920, H = 1080;
const q = new URLSearchParams(location.search);
const RENDER = q.has('render');
const SCALE = +(q.get('scale') || (RENDER ? 1 : 1));
const SW = Math.round(1280 * SCALE), SH = Math.round(720 * SCALE);
const canvas = document.getElementById('c');
canvas.width = W; canvas.height = H;
const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true, premultipliedAlpha: false });
if (!gl) { document.body.innerHTML = '<p style="color:#fff">WebGL2 is required.</p>'; return; }
const hasFloat = !!gl.getExtension('EXT_color_buffer_float');
gl.getExtension('OES_texture_float_linear');

function compile(type, src) {
  const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { const log = gl.getShaderInfoLog(s); console.error(log); throw new Error(log); }
  return s;
}
function program(fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl.VERTEX_SHADER, SHADERS.VS)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, 'aP'); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const U = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); const name = info.name.replace(/\[0\]$/, ''); U[name] = gl.getUniformLocation(p, info.name); }
  return { p, U };
}
const scenes = [null, 1, 2, 3, 4, 5].map(id => id && program(SHADERS.sceneSrc(id)));
const prog = { mix: program(SHADERS.MIX), down: program(SHADERS.DOWN), up: program(SHADERS.UP), comp: program(SHADERS.COMP) };
const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

function target(w, h) {
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, hasFloat ? gl.RGBA16F : gl.RGBA8, w, h, 0, gl.RGBA, hasFloat ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  return { tex, fb, w, h };
}
const tA = target(SW, SH), tB = target(SW, SH), tM = target(SW, SH);
const down = [], up = [];
{ let w = SW, h = SH; for (let i = 0; i < 5; i++) { w = Math.max(2, w >> 1); h = Math.max(2, h >> 1); down.push(target(w, h)); up.push(target(w, h)); } }

const tc = document.createElement('canvas'); tc.width = W; tc.height = H;
const tctx = tc.getContext('2d');
const textTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, textTex);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

function bindOut(t) { gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fb : null); gl.viewport(0, 0, t ? t.w : W, t ? t.h : H); }
function tex(unit, t) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t); }
const draw = () => gl.drawArrays(gl.TRIANGLES, 0, 3);

const FE = window.FEAT;
function feat(t) {
  const x = t * FE.fps, i = Math.max(0, Math.min(FE.n - 2, Math.floor(x))), f = Math.min(1, Math.max(0, x - i));
  const g = k => FE[k][i] * (1 - f) + FE[k][i + 1] * f;
  return { kick: g('kick'), snare: g('snare'), rms: g('rms'), air: g('air'), sub: g('sub') };
}
function renderScene(target, s, F, frame) {
  const { p, U } = scenes[s.scene]; gl.useProgram(p); bindOut(target);
  gl.uniform2f(U.uRes, target.w, target.h); gl.uniform1f(U.uT, s.t); gl.uniform1i(U.uScene, s.scene);
  gl.uniform4fv(U.uP, new Float32Array(s.P.flat()));
  gl.uniform1f(U.uKick, F.kick); gl.uniform1f(U.uSnare, F.snare); gl.uniform1f(U.uRms, F.rms); gl.uniform1f(U.uAir, F.air); gl.uniform1f(U.uSub, F.sub);
  gl.uniform1f(U.uFrame, frame);
  draw();
}
const PX = new Uint8Array(4); const PROF = {}; const mark = (k) => { if (!window.PROFILE) return; gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, PX); const n = performance.now(); PROF[k] = (PROF[k] || 0) + n - (PROF._l || n); PROF._l = n; };
function renderFrame(t) {
  mark('_start');
  const frame = Math.round(t * 30);
  const F = feat(t);
  const st = TL.frameState(t, F);
  let src;
  if (st.A && st.mix < .999) {
    renderScene(tA, st.A, F, frame); renderScene(tB, st.B, F, frame);
    const { p, U } = prog.mix; gl.useProgram(p); bindOut(tM);
    tex(0, tA.tex); tex(1, tB.tex); gl.uniform1i(U.uA, 0); gl.uniform1i(U.uB, 1);
    gl.uniform1f(U.uMix, st.mix); gl.uniform1i(U.uType, st.xtype); gl.uniform2f(U.uRes, SW, SH); gl.uniform1f(U.uT, t);
    draw(); src = tM;
  } else { renderScene(tB, st.B, F, frame); src = tB; }
  mark('scene');
  // bloom chain
  { const { p, U } = prog.down; gl.useProgram(p); let s = src;
    for (const d of down) { bindOut(d); tex(0, s.tex); gl.uniform1i(U.uS, 0); gl.uniform2f(U.uTexel, 1 / s.w, 1 / s.h); draw(); s = d; } }
  { const { p, U } = prog.up; gl.useProgram(p); let s = down[down.length - 1];
    for (let i = down.length - 2; i >= 0; i--) { bindOut(up[i]); tex(0, s.tex); tex(1, down[i].tex); gl.uniform1i(U.uS, 0); gl.uniform1i(U.uD, 1);
      gl.uniform2f(U.uTexel, 1 / s.w, 1 / s.h); gl.uniform2f(U.uRes, up[i].w, up[i].h); draw(); s = up[i]; } }
  mark('bloom');
  // text
  TYPE.draw(tctx, t, F, st);
  gl.bindTexture(gl.TEXTURE_2D, textTex); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tc); gl.generateMipmap(gl.TEXTURE_2D);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  mark('text');
  // composite
  const P = st.post; const { p, U } = prog.comp; gl.useProgram(p); bindOut(null);
  tex(0, src.tex); tex(1, up[0].tex); tex(2, textTex);
  gl.uniform1i(U.uScene, 0); gl.uniform1i(U.uBloom, 1); gl.uniform1i(U.uText, 2);
  gl.uniform2f(U.uRes, W, H); gl.uniform1f(U.uT, t); gl.uniform1f(U.uFrame, frame);
  const f1 = (n, v) => U[n] && gl.uniform1f(U[n], v);
  f1('uCA', P.ca); f1('uGrain', P.grain); f1('uVig', P.vig); f1('uBars', P.bars); f1('uFade', P.fade); f1('uWhite', P.white);
  f1('uStatic', P.static); f1('uCrash', P.crash); f1('uSeed', P.seed); f1('uBlur', P.blur); f1('uLeak', P.leak); f1('uExpo', P.expo);
  f1('uZoom', P.zoom); f1('uGhost', P.ghost); f1('uBloomAmt', P.bloom); f1('uHalf', P.half); f1('uGleam', P.gleam); f1('uDream', P.dream);
  f1('uTextGlow', P.textGlow); f1('uShard', P.shard); f1('uKick', F.kick);
  U.uTint && gl.uniform3fv(U.uTint, P.tint); U.uTextGlowCol && gl.uniform3fv(U.uTextGlowCol, P.textGlowCol); U.uShake && gl.uniform2fv(U.uShake, P.shake);
  draw(); mark('comp');
  return st;
}
window.FILM = { renderFrame, PROF, DUR: TL.DUR, W, H };
window.FILM_READY = document.fonts.load('italic 64px "Instrument Serif"').then(() => document.fonts.load('300 22px "DM Mono"')).then(() => document.fonts.ready).then(() => true);

if (!RENDER) {
  const audio = document.getElementById('a'), btn = document.getElementById('play'), ui = document.getElementById('ui');
  let playing = false;
  const t0 = +(q.get('t') || 0);
  audio.currentTime = t0;
  function loop() { renderFrame(Math.min(TL.DUR, audio.currentTime)); if (playing) requestAnimationFrame(loop); }
  btn.onclick = () => { FILM_READY.then(() => { audio.play(); playing = true; ui.classList.add('hide'); loop(); }); };
  audio.onended = () => { playing = false; ui.classList.remove('hide'); };
  audio.onpause = () => { playing = false; ui.classList.remove('hide'); };
  FILM_READY.then(() => renderFrame(t0 || 9));
  addEventListener('keydown', e => { if (e.code === 'Space') { e.preventDefault(); playing ? audio.pause() : btn.onclick(); } });
}
})();
