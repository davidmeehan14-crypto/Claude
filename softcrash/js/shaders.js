// GLSL for Soft Crash. One scene program (6 worlds, picked by uScene), a transition mix pass,
// a bloom down/up chain and the final composite (shatter, lens, text, grade, grain, letterbox).
window.SHADERS = (() => {
const VS = `#version 300 es
in vec2 aP; void main(){ gl_Position = vec4(aP, 0., 1.); }`;

const COMMON = `#version 300 es
precision highp float;
const float PI = 3.14159265;
float hash11(float p){ p = fract(p*.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash21(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y)*p3.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz)*p3.zy); }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3. - 2.*f);
  return mix(mix(hash21(i), hash21(i + vec2(1,0)), u.x), mix(hash21(i + vec2(0,1)), hash21(i + vec2(1,1)), u.x), u.y); }
const mat2 ROT = mat2(.8, .6, -.6, .8);
float fbm3(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 3; i++){ s += a*vnoise(p); p = ROT*p*2.03; a *= .5; } return s/.875; }
float fbm5(vec2 p){ float s = 0., a = .5; for (int i = 0; i < 5; i++){ s += a*vnoise(p); p = ROT*p*2.03; a *= .5; } return s/.96875; }
float luma(vec3 c){ return dot(c, vec3(.2126, .7152, .0722)); }
mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
float sdSeg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba)/dot(ba, ba), 0., 1.); return length(pa - ba*h); }
vec3 hueRot(vec3 c, float a){ const vec3 k = vec3(.57735); float ca = cos(a); return c*ca + cross(k, c)*sin(a) + k*dot(k, c)*(1. - ca); }
`;

const SCENE = COMMON + `
out vec4 o;
uniform vec2 uRes; uniform float uT; uniform int uScene; uniform vec4 uP[4];
uniform float uKick, uSnare, uRms, uAir, uSub, uFrame;

// ---------------- shared sky ----------------
vec3 skyGrad(vec2 q, vec2 sun, float night){
  float d = length(q - sun);
  vec3 top = mix(vec3(.62,.44,.42), vec3(.04,.05,.13), night);
  vec3 mid = mix(vec3(.80,.46,.38), vec3(.16,.11,.28), night);
  vec3 hor = mix(vec3(.86,.56,.44), vec3(.36,.22,.36), night);
  vec3 c = mix(hor, mid, smoothstep(0., .2, q.y));
  c = mix(c, top, smoothstep(.12, .62, q.y));
  c += mix(vec3(1.,.30,.22), vec3(.40,.50,1.), night)*exp(-d*4.2)*.75;
  c += mix(vec3(1.,.55,.38), vec3(.70,.78,1.), night)*exp(-d*13.)*1.1;
  return c;
}
vec3 sunDisc(vec2 q, vec2 sun, float r, float night){
  float d = length(q - sun);
  float m = smoothstep(r, r - .012, d);
  float limb = 1. - .3*pow(clamp(d/r, 0., 1.), 2.);
  return mix(vec3(1.,.90,.78), vec3(.86,.9,1.), night)*3.2*limb*m;
}

// ---------------- 2D figure silhouette (world units, feet at y=0) ----------------
float smin(float a, float b, float k){ float h = clamp(.5 + .5*(b - a)/k, 0., 1.); return mix(b, a, h) - k*h*(1. - h); }
float sdWalker(vec2 f, float ph){
  float s = sin(ph), c = cos(ph);
  f.y -= abs(c)*.025;
  float hd = length(f - vec2(0., 1.63)) - .1;
  hd = smin(hd, length((f - vec2(.0, 1.555))*vec2(1., 1.5)) - .085, .05);
  float d = hd;
  d = smin(d, sdSeg(f, vec2(0., 1.52), vec2(0., 1.42)) - .042, .03);
  d = smin(d, min(sdSeg(f, vec2(-.16, 1.33), vec2(0., 1.41)), sdSeg(f, vec2(.16, 1.33), vec2(0., 1.41))) - .06, .05);
  d = smin(d, sdSeg(f, vec2(0., 1.36), vec2(0., 1.02)) - .14, .06);
  float y = clamp((f.y - .56)/(1.08 - .56), 0., 1.);
  float sway = .02*s*(1. - y);
  float w = mix(.215, .15, y);
  float coat = max(abs(f.x - sway) - w, max(f.y - 1.1, .56 - f.y + .02*sin(f.x*30. + ph)));
  d = smin(d, coat, .04);
  d = min(d, sdSeg(f, vec2(-.19, 1.33), vec2(-.23 - .02*s, .92 + .07*s)) - .04);
  d = min(d, sdSeg(f, vec2(.19, 1.33), vec2(.23 + .02*s, .92 - .07*s)) - .04);
  float l1 = max(0., s)*.12, l2 = max(0., -s)*.12;
  d = min(d, sdSeg(f, vec2(-.075, .62), vec2(-.08, .06 + l1)) - .045);
  d = min(d, sdSeg(f, vec2(.075, .62), vec2(.08, .06 + l2)) - .045);
  d = min(d, sdSeg(f, vec2(-.08, .05 + l1), vec2(-.1, .03 + l1)) - .04);
  d = min(d, sdSeg(f, vec2(.08, .05 + l2), vec2(.1, .03 + l2)) - .04);
  return d;
}
float sdFaller(vec2 f, float t){
  float w = sin(t*1.7)*.06;
  float d = length(f - vec2(0., .56)) - .1;
  d = min(d, sdSeg(f, vec2(0., .44), vec2(0., -.02)) - .12);
  d = min(d, sdSeg(f, vec2(-.13, .38), vec2(-.52, .66 + w)) - .045);
  d = min(d, sdSeg(f, vec2(.13, .38), vec2(.54, .60 - w)) - .045);
  d = min(d, sdSeg(f, vec2(-.07, -.05), vec2(-.26, -.40)) - .06);
  d = min(d, sdSeg(f, vec2(-.26, -.40), vec2(-.22, -.72 - w)) - .05);
  d = min(d, sdSeg(f, vec2(.07, -.05), vec2(.22, -.44)) - .06);
  d = min(d, sdSeg(f, vec2(.22, -.44), vec2(.34, -.70 + w)) - .05);
  return d;
}

// ================= 1. HAZE : sun through fog, treeline =================
// P0 sun.xy, sunR, horizonY | P1 sparkle, colourRun, intoOne, hum | P2 night, pulse, treeline, split | P3 fog, drift, splitAngle, exposure
vec3 hazeCore(vec2 p, float t, float night, vec2 sun){
  float sr = uP[0].z, hy = uP[0].w, hum = uP[1].w, pulse = uP[2].y;
  p.y += hum*.007*sin(p.x*36. + t*26.)*exp(-abs(p.y - hy)*16.)*(.4 + uKick);
  vec2 q = vec2(p.x, p.y - hy), sq = sun - vec2(0., hy);
  vec3 c = skyGrad(q, sq, night);
  c += sunDisc(q, sq, sr*(1. + pulse*.14*uKick), night);
  vec2 dq = q - sq; float r = length(dq);
  if (pulse > 0.){
    float an = atan(dq.y, dq.x);
    float rays = pow(fbm3(vec2(an*5., t*.25)), 3.)*2.2;
    c += mix(vec3(1.,.58,.4), vec3(.6,.7,1.), night)*rays*exp(-r*2.4)*pulse*(.5 + 1.2*uKick);
  }
  if (hum > 0.){
    float rg = pow(.5 + .5*sin((r - t*.16)*72.), 6.);
    c += mix(vec3(1.,.7,.5), vec3(.7,.8,1.), night)*rg*exp(-r*3.)*hum*(.3 + 1.1*uKick);
  }
  float fogD = uP[3].x, drift = uP[3].y;
  vec3 fogLit = mix(vec3(.42,.38,.42), vec3(.08,.08,.16), night);
  vec3 fogWarm = mix(vec3(.95,.52,.42), vec3(.38,.42,.72), night);
  float g = exp(-length(p - sun)*2.8);
  for (int i = 0; i < 4; i++){
    float fi = float(i);
    float yc = hy + .08 - fi*.085;
    float sc = 1.8 + fi*1.1;
    float n = fbm5(vec2(p.x*sc + t*drift*(.035 + fi*.03) + fi*7.3, (p.y - yc)*sc*3.2 + fi*3.1));
    float band = smoothstep(.2, 0., abs(p.y - yc + .02*sin(p.x*2. + fi + t*.05)));
    float a = smoothstep(.38, .82, n)*band*fogD*(.5 + fi*.13);
    c = mix(c, mix(fogLit, fogWarm, g*.85), clamp(a, 0., 1.));
  }
  float low = smoothstep(hy + .02, hy - .42, p.y);
  c = mix(c, mix(vec3(.25,.24,.28), vec3(.04,.04,.09), night)*(.8 + .6*g), low*.9*fogD);
  float tl = uP[2].z;
  if (tl > 0.){
    float x = p.x;
    float r1 = hy - .24 + .03*fbm3(vec2(x*4., 1.)) + .012*vnoise(vec2(x*38., 0.)) + .006*vnoise(vec2(x*120., 3.));
    float r2 = hy - .33 + .04*fbm3(vec2(x*2.6, 7.)) + .018*vnoise(vec2(x*30., 2.)) + .01*vnoise(vec2(x*95., 5.));
    c = mix(c, mix(vec3(.17,.15,.18), vec3(.03,.03,.07), night)*(.8 + .5*g), smoothstep(.003, -.003, p.y - r1)*tl*.7);
    c = mix(c, mix(vec3(.09,.08,.10), vec3(.02,.02,.04), night), smoothstep(.003, -.003, p.y - r2)*tl);
  }
  return c;
}
vec3 sHaze(vec2 p, float t){
  float night = uP[2].x, run = uP[1].y, split = uP[2].w;
  vec2 sun = uP[0].xy;
  vec3 c;
  if (run > .001){
    float col = pow(vnoise(vec2(p.x*70., 0.)), 2.)*.6 + .4*fbm3(vec2(p.x*9., t*.25));
    float off = run*(.05 + .32*col)*smoothstep(-.6, .3, p.y);
    vec3 a = hazeCore(p + vec2(0., off), t, night, sun);
    vec3 b = hazeCore(p + vec2(0., off*1.35), t, night, sun);
    vec3 d = hazeCore(p + vec2(0., off*1.75), t, night, sun);
    c = vec3(a.r, b.g, d.b);
    c = mix(c, hueRot(c, (col - .5)*4.*run + p.y*2.*run), run*.7);
    c *= 1. + run*.35;
  } else if (split > .001){
    float ang = uP[3].z;
    float s = dot(p, vec2(cos(ang), sin(ang)));
    float m = smoothstep(-.12, .12, s + .04*fbm3(p*3. + t*.2));
    vec3 day = hazeCore(p, t, night, sun);
    vec3 nit = hazeCore(p, t + 9., 1., vec2(-sun.x, sun.y + .06));
    c = mix(day, nit, m*split);
    c += vec3(1.,.85,.8)*exp(-abs(s)*40.)*.25*split;
  } else c = hazeCore(p, t, night, sun);
  float one = uP[1].z;
  if (one > 0.) c = mix(c, vec3(luma(c))*vec3(1.2,.74,.58)*1.15, one);
  float sp = uP[1].x;
  if (sp > 0.){
    vec2 g = p*vec2(170.);
    vec2 id = floor(g); vec2 f = fract(g) - .5;
    float h = hash21(id);
    float tw = pow(max(0., sin(t*(3. + h*9.) + h*40.)), 24.);
    float star = smoothstep(.35, 0., length(f))*step(.86, h)*tw;
    float line = pow(vnoise(vec2(p.y*260., t*9.)), 40.)*.5*step(.7, hash11(floor(t*12.)));
    c += vec3(.86,.9,1.)*(star*3. + line)*sp;
  }
  return c*uP[3].w;
}

// ================= 2. PLAIN : mirror salt flat, walker, floating frames =================
// P0 camZ, camH, pitch, fov | P1 figure, figDist, walkRate, frames | P2 night, sunEl, frameGlow, roll | P3 ripple, fogK, wildness, exposure
vec4 frames(vec3 ro, vec3 rd, float tMax, float t){
  int NF = int(uP[1].w); float camZ = uP[0].x; float wild = uP[3].z;
  vec4 acc = vec4(0.); float best = tMax;
  vec3 glow = vec3(0.);
  for (int i = 0; i < 18; i++){
    if (i >= NF) break;
    float fi = float(i);
    float h1 = hash11(fi*3.1 + .7), h2 = hash11(fi*7.3 + 1.9), h3 = hash11(fi*1.7 + 4.2);
    float zr = mod(h1*38. + t*(.5 + wild*2.) - camZ, 38.) + 1.2;
    float side = h2 < .5 ? -1. : 1.;
    vec3 c = vec3(side*(.9 + fract(h2*7.)*3.8), .45 + h3*2.3 + .15*sin(t*.5 + fi), camZ + zr);
    float a = (h1 - .5)*1.3 + .3*sin(t*.2 + fi*2.) + wild*t*(h3 - .5)*1.5;
    vec3 nrm = vec3(sin(a), 0., -cos(a)), rgt = vec3(cos(a), 0., sin(a));
    float tl = (h3 - .5)*.5*wild;
    vec3 up = vec3(0., cos(tl), 0.) + rgt*sin(tl);
    float w = .3 + .18*h2, hh = w*1.22;
    float den = dot(rd, nrm);
    if (abs(den) < 1e-4) continue;
    float tt = dot(c - ro, nrm)/den;
    if (tt <= 0.) continue;
    vec3 hp = ro + rd*tt - c;
    float u = dot(hp, rgt), v = dot(hp, up);
    vec2 bx = abs(vec2(u, v)) - vec2(w, hh);
    float sd = length(max(bx, 0.)) + min(max(bx.x, bx.y), 0.);
    float fade = smoothstep(39., 26., zr)*smoothstep(1.2, 2.6, zr);
    glow += vec3(1.,.8,.62)*exp(-max(sd, 0.)*14.)*.18*fade*uP[2].z*(.6 + .8*uKick);
    if (sd < 0. && tt < best){
      best = tt;
      float b = .045*w/.3;
      vec2 ph = vec2(u, v + b*1.2);
      bool inPhoto = abs(ph.x) < w - b && abs(ph.y) < hh - b*2.2;
      vec3 col = vec3(.96,.9,.84)*1.3;
      if (inPhoto){
        vec2 uv = ph/vec2(w, hh);
        vec2 sp = vec2(fract(h1*13.) - .5, fract(h3*5.)*.4)*.8;
        vec3 ph1 = mix(vec3(.98,.66,.52), vec3(.55,.42,.52), uv.y*.5 + .5);
        ph1 = mix(ph1, vec3(.32,.28,.32), smoothstep(-.05, -.25, uv.y + .1*vnoise(uv*6. + fi)));
        ph1 += vec3(1.,.85,.6)*exp(-length(uv - sp)*9.)*1.5;
        ph1 = mix(ph1, vec3(luma(ph1)), .35) + .12*vnoise(uv*40. + fi*9.);
        col = ph1*1.35;
      }
      acc = vec4(col*(.7 + .4*uP[2].z), .92*fade);
    }
  }
  acc.rgb += glow;
  return acc;
}
vec3 sPlain(vec2 p, float t){
  float camZ = uP[0].x, camH = uP[0].y, pitch = uP[0].z, fov = uP[0].w;
  float night = uP[2].x, sunEl = uP[2].y, fogK = uP[3].y;
  p = rot(uP[2].w)*p;
  vec3 ro = vec3(0., camH, camZ);
  vec3 rd = normalize(vec3(p.x, p.y + pitch, fov));
  vec2 sunS = vec2(0., sunEl);
  vec3 mist = mix(vec3(.84,.58,.50), vec3(.28,.20,.36), night);
  vec3 col; float tg = 1e4;
  if (rd.y > 0.){
    vec2 q = rd.xy/rd.z;
    col = skyGrad(q, sunS, night) + sunDisc(q, sunS, .055, night);
    float n = fbm5(vec2(q.x*2.2 + t*.02, q.y*9.));
    col = mix(col, mist*(.9 + .5*exp(-length(q - sunS)*3.)), smoothstep(.45, .8, n)*exp(-q.y*9.)*.8);
    col = mix(col, mist, exp(-q.y*26.)*.7);
  } else {
    tg = camH/(-rd.y);
    vec3 hp = ro + rd*tg;
    vec2 g = hp.xz;
    float e = .03, rp = uP[3].x;
    vec2 tf = vec2(t*.15, t*.07);
    float n0 = fbm3(g*1.1 + tf), nx = fbm3((g + vec2(e, 0.))*1.1 + tf), nz = fbm3((g + vec2(0., e))*1.1 + tf);
    float wr = 0.;
    if (uP[1].x > 0.){ vec2 dfo = g - vec2(0., camZ + uP[1].y); float rr = length(dfo); wr = sin(rr*18. - t*5.)*exp(-rr*1.2)*.5; }
    vec3 n = normalize(vec3(-(nx - n0)/e*.05*rp, 1., -(nz - n0)/e*.05*rp + wr*.03));
    vec3 rr = reflect(rd, n);
    vec2 rq = rr.xy/max(rr.z, 1e-3);
    vec3 refl = skyGrad(rq, sunS, night) + sunDisc(rq, sunS, .055, night);
    refl = mix(refl, mist, exp(-rq.y*26.)*.7);
    vec2 vc = g*.55; vec2 vi = floor(vc), vf = fract(vc); float F1 = 8., F2 = 8.;
    for (int j = -1; j <= 1; j++) for (int k = -1; k <= 1; k++){
      vec2 o2 = vec2(float(j), float(k)); vec2 pt = o2 + hash22(vi + o2)*.8 + .1 - vf; float dd = dot(pt, pt);
      if (dd < F1){ F2 = F1; F1 = dd; } else if (dd < F2) F2 = dd; }
    float crack = smoothstep(.07, 0., sqrt(F2) - sqrt(F1))*exp(-tg*.12);
    float fres = mix(.55, 1., pow(1. - abs(rd.y), 6.));
    vec3 base = mix(vec3(.30,.26,.28), vec3(.05,.05,.1), night);
    col = mix(base, refl*.82, fres);
    col = mix(col, col*.55 + vec3(.9,.85,.82)*.08, crack*.8);
    vec4 fr = frames(hp, rr, 60., t);
    col = mix(col, fr.rgb*.8, fr.a*.75) + fr.rgb*(1. - fr.a)*.3;
    if (uP[1].x > 0.){
      vec2 lo = hp.xz - vec2(0., camZ + uP[1].y);
      float L = 1.7/max(tan(sunEl*.9 + .02), .05);
      float sh = smoothstep(.2, .07, abs(lo.x + lo.y*.02))*smoothstep(-L, -L*.35, lo.y)*step(lo.y, 0.);
      col *= 1. - sh*.55*uP[1].x;
    }
    col = mix(col, mist, 1. - exp(-tg*fogK));
  }
  vec4 fr = frames(ro, rd, tg, t);
  col = mix(col, fr.rgb, fr.a) + fr.rgb*(1. - fr.a)*.0;
  col += (1. - fr.a)*fr.rgb*.0;
  if (uP[1].x > 0.){
    vec3 rel = vec3(0., 0., camZ + uP[1].y) - ro;
    float s = fov/rel.z;
    vec2 foot = vec2(0., -camH*s - pitch);
    vec2 f = (p - foot)/s;
    float ph = t*uP[1].z;
    float aa = 1.5/(uRes.y*s);
    if (f.y > -.02){
      float d = sdWalker(f, ph);
      float m = smoothstep(aa, -aa, d)*uP[1].x;
      float rim = exp(-abs(d)*55.)*smoothstep(.03, -.01, d);
      col = mix(col, vec3(.05,.04,.05), m);
      col += vec3(1.,.66,.46)*rim*.9*uP[1].x*(1. - night*.5);
    } else {
      vec2 fr2 = vec2(f.x + .03*sin(f.y*14. + t*3.), -f.y*1.05);
      float d = sdWalker(fr2, ph);
      float m = smoothstep(aa*3., -aa*3., d)*uP[1].x*smoothstep(-2.2, -.2, f.y);
      col = mix(col, col*.18, m*.8);
    }
  }
  return col*uP[3].w;
}

// ================= 3. MEZZANINE : raymarched brutalist hall, window light, god rays =================
// P0 camX, camY, camZ, yaw | P1 pitch, palette, dust, fov | P2 rays, fogD, sunEl, roll | P3 slowmo, sunYaw, glow, exposure
float sdBox2(vec2 p, vec2 b){ vec2 q = abs(p) - b; return length(max(q, 0.)) + min(max(q.x, q.y), 0.); }
float sdBox(vec3 p, vec3 b){ vec3 q = abs(p) - b; return length(max(q, 0.)) + min(max(q.x, max(q.y, q.z)), 0.); }
float mapM(vec3 p){
  float d = p.y;
  d = min(d, 9. - p.y);
  float zc = mod(p.z, 5.) - 2.5;
  float wall = abs(p.x + 7.3) - .3;
  wall = max(wall, -sdBox(vec3(p.x + 7.3, p.y - 4.5, zc), vec3(.5, 3.5, 1.4)));
  wall = min(wall, sdBox(vec3(p.x + 7.3, p.y - 4.5, zc), vec3(.22, .07, 1.4)));
  wall = min(wall, sdBox(vec3(p.x + 7.3, p.y - 4.5, zc), vec3(.22, 3.5, .05)));
  d = min(d, wall);
  float zr = mod(p.z + 2.5, 5.) - 2.5;
  float rw = 7. - p.x;
  rw = max(rw, -sdBox(vec3(p.x - 7., p.y - 5.4, zr), vec3(.6, 1.4, .8)));
  d = min(d, rw);
  d = min(d, sdBox2(p.xy - vec2(4.75, 3.8), vec2(2.25, .2)));
  d = min(d, sdBox2(p.xy - vec2(2.65, 4.5), vec2(.15, .5)));
  d = min(d, max(length(vec2(p.x - 3.0, zr)) - .34, p.y - 3.7));
  d = min(d, sdBox(vec3(p.x, p.y - 8.7, zc), vec3(7., .3, .22)));
  return d;
}
vec3 nrmM(vec3 p){ const vec2 k = vec2(1, -1)*.002;
  return normalize(k.xyy*mapM(p + k.xyy) + k.yyx*mapM(p + k.yyx) + k.yxy*mapM(p + k.yxy) + k.xxx*mapM(p + k.xxx)); }
float winOpen(vec2 yz){
  float zc = mod(yz.y, 5.) - 2.5;
  float a = smoothstep(1.4, 1.34, abs(zc))*smoothstep(1., 1.06, yz.x)*smoothstep(8., 7.94, yz.x);
  a *= smoothstep(.07, .13, abs(yz.x - 4.5))*smoothstep(.05, .1, abs(zc));
  return a;
}
float winLight(vec3 p, vec3 L){
  float s1 = (-7. - p.x)/L.x; if (s1 < 0.) return 0.;
  vec3 w1 = p + L*s1; float s2 = (-7.6 - p.x)/L.x; vec3 w2 = p + L*s2;
  return winOpen(w1.yz)*winOpen(w2.yz);
}
vec3 sMezz(vec2 p, float t){
  float pal = uP[1].y;
  p = rot(uP[2].w)*p;
  vec3 ro = vec3(uP[0].x, uP[0].y, uP[0].z);
  float yaw = uP[0].w, pit = uP[1].x;
  vec3 fw = normalize(vec3(sin(yaw)*cos(pit), sin(pit), cos(yaw)*cos(pit)));
  vec3 rt = normalize(cross(vec3(0,1,0), fw)), up = cross(fw, rt);
  vec3 rd = normalize(p.x*rt + p.y*up + uP[1].w*fw);
  float sy = uP[3].y, se = uP[2].z;
  vec3 L = normalize(vec3(-cos(sy)*cos(se), sin(se), sin(sy)*cos(se)));
  vec3 sunC = pal < .5 ? vec3(1.,.66,.40)*4.2 : (pal < 1.5 ? vec3(1.,.40,.58)*4. : vec3(1.,.60,.36)*5.2);
  vec3 amb = pal < .5 ? vec3(.075,.055,.05) : (pal < 1.5 ? vec3(.035,.04,.09) : vec3(.09,.06,.05));
  float night = pal < .5 ? 0. : (pal < 1.5 ? .6 : 0.);
  float tt = 0.; bool hit = false; vec3 pp = ro;
  for (int i = 0; i < 90; i++){
    pp = ro + rd*tt; float d = mapM(pp);
    if (d < .0015*tt + .001){ hit = true; break; }
    tt += d; if (tt > 70. || pp.x < -7.62) break;
  }
  vec3 col;
  if (!hit || pp.x < -7.6){
    float ha = atan(rd.z, -rd.x) - atan(L.z, -L.x);
    vec2 q = vec2(ha, asin(clamp(rd.y, -1., 1.)));
    vec2 sq = vec2(0., asin(L.y));
    col = skyGrad(q*.9, sq*.9, night) + sunDisc(q, sq, .05, night)*1.5;
    col *= pal > .5 && pal < 1.5 ? .7 : 1.;
    if (!hit) tt = 70.;
  } else {
    vec3 n = nrmM(pp);
    float ao = 0., sc = 1.;
    for (int k = 1; k <= 3; k++){ float h = .18*float(k); ao += (h - mapM(pp + n*h))*sc; sc *= .6; }
    ao = clamp(1. - ao*1.6, 0., 1.);
    vec3 alb = vec3(.64,.60,.56);
    if (pp.y < .01) alb = vec3(.40,.37,.36);
    alb *= .9 + .2*vnoise(pp.xz*3. + pp.y*2.);
    float li = winLight(pp + n*.02, L)*max(0., dot(n, L));
    col = alb*(li*sunC + amb*ao*(1.2 + .8*n.y));
    col += alb*sunC*.035*ao*smoothstep(0., 7., pp.x + 7.);
    if (pp.y < .01){
      vec3 r = reflect(rd, n); vec3 rf = vec3(0.);
      if (r.x < 0.){ float s = (-7. - pp.x)/r.x; vec3 w = pp + r*s; if (w.y < 9.) rf = vec3(1.,.8,.62)*winOpen(w.yz)*3.; }
      else { float s = (7. - pp.x)/r.x; vec3 w = pp + r*s; if (w.y < 9.) rf = winLight(w, L)*sunC*.5*alb; }
      col += rf*.22;
    }
  }
  float fogD = uP[2].y;
  float tv = min(tt, 45.);
  float jit = fract(52.9829189*fract(dot(gl_FragCoord.xy, vec2(.06711056, .00583715))) + uFrame*.618);
  float cth = dot(rd, L), g = .62;
  float phase = (1. - g*g)/(4.*PI*pow(1. + g*g - 2.*g*cth, 1.5));
  vec3 acc = vec3(0.); float tr = 1.; float stp = tv/28.;
  for (int i = 0; i < 28; i++){
    vec3 sp = ro + rd*((float(i) + jit)*stp);
    float dens = fogD*(.55 + .9*vnoise(sp.xz*.3 + vec2(t*.12, sp.y*.25)));
    float li = winLight(sp, L);
    acc += tr*dens*stp*(li*sunC*phase*uP[2].x*4. + amb*.7);
    tr *= exp(-dens*stp);
  }
  col = col*tr + acc;
  float dust = uP[1].z;
  if (dust > 0.){
    for (int i = 0; i < 36; i++){
      float fi = float(i);
      vec3 q = vec3(hash11(fi*1.3), hash11(fi*2.7 + .3), hash11(fi*5.1 + .8));
      vec3 wp = vec3(-6.5 + q.x*11., .3 + mod(q.y*8. + t*(.05 + q.z*.08), 8.), ro.z + 1. + mod(q.z*16. - ro.z*0. + fi, 16.));
      vec3 rel = wp - ro; float dz = dot(rel, rd); if (dz < .2) continue;
      float dd = length(rel - rd*dz);
      float sz = .012 + .01*q.x;
      float li = winLight(wp, L);
      acc = vec3(1.,.85,.65)*li*smoothstep(sz, 0., dd)*(.5 + .5*sin(t*3. + fi))*dust;
      col += acc*4.*exp(-dz*.05);
    }
  }
  return col*uP[3].w;
}

// ================= 4. FALL : dropping through lit cloud sheets =================
// P0 speed, lateness, cloudAmt, figure | P1 figRot, roll, streaks, stars | P2 figX, figY, figScale, - | P3 -, -, -, exposure
vec3 sFall(vec2 p, float t){
  float late = uP[0].y;
  p = rot(uP[1].y)*p;
  float r = length(p);
  vec3 core = mix(vec3(1.,.62,.42), vec3(.62,.16,.24), late);
  vec3 edge = mix(vec3(.30,.20,.30), vec3(.01,.015,.05), late);
  vec3 c = mix(core*1.2, edge, smoothstep(0., .7, r));
  c += core*exp(-r*6.)*1.4;
  float st = uP[1].w;
  if (st > 0.){
    vec2 g = p*55.; vec2 id = floor(g); float h = hash21(id);
    float tw = .6 + .4*sin(t*(2. + h*6.) + h*30.);
    c += vec3(.85,.9,1.)*smoothstep(.12, 0., length(fract(g) - .5))*step(.975, h)*tw*st*smoothstep(.1, .5, r)*2.;
  }
  float base = t*uP[0].x*6.;
  float fb = fract(base), nb = floor(base);
  for (int k = 0; k < 6; k++){
    float fk = float(k);
    float z = (fk + fb)/6.;
    float id = fk - nb;
    vec2 q = p*mix(4.2, .32, z*z) + vec2(id*13.1, id*7.7);
    float n = fbm5(q*1.4);
    float a = smoothstep(.46, .8, n)*smoothstep(0., .3, z)*smoothstep(1., .72, z)*uP[0].z;
    vec3 cc = mix(core*1.15, edge*1.25 + .04, smoothstep(0., .9, r))*(.6 + .7*n);
    c = mix(c, cc, a*.88);
  }
  float strk = uP[1].z;
  if (strk > 0.){
    float an = atan(p.y, p.x)/(2.*PI)*150.;
    float cell = floor(an); float h = hash11(cell + 3.);
    float rr = fract(h*7. + t*(.35 + h*.6))*1.3;
    float w = smoothstep(.12, 0., abs(fract(an) - .5) - .02);
    float s2 = smoothstep(.16*rr, 0., abs(r - rr))*w*step(.55, h);
    c += vec3(1.,.9,.8)*s2*strk*rr*1.5;
  }
  if (uP[0].w > 0.){
    vec2 f = (p - uP[2].xy)/uP[2].z;
    f = rot(uP[1].x)*f;
    float d = sdFaller(f, t);
    float aa = 1.5/(uRes.y*uP[2].z);
    float m = smoothstep(aa, -aa, d)*uP[0].w;
    c = mix(c, vec3(.04,.03,.05), m);
    c += core*exp(-abs(d)*40.)*smoothstep(.04, -.01, d)*1.2*uP[0].w;
  }
  return c*uP[3].w;
}

// ================= 5. VOID : the blankness, breathing pastel forms =================
// P0 breath, blobs, horizonLine, whiteness | P1 sunDot, grainy, tint, - | P3 -, -, -, exposure
vec3 sVoid(vec2 p, float t){
  float br = uP[0].x;
  vec3 base = vec3(.97,.93,.87)*uP[0].w;
  vec3 acc = vec3(0.); float wsum = 0.;
  for (int i = 0; i < 5; i++){
    float fi = float(i);
    vec2 c = vec2(sin(t*.11 + fi*2.1)*.6, cos(t*.09 + fi*1.7)*.26);
    float rr = .2 + .06*sin(t*.3 + fi) + .06*br;
    float w = exp(-dot(p - c, p - c)/(rr*rr));
    vec3 pc = fi < .5 ? vec3(1.,.72,.60) : fi < 1.5 ? vec3(.78,.70,.95) : fi < 2.5 ? vec3(.86,.80,.92) : fi < 3.5 ? vec3(1.,.58,.52) : vec3(1.,.88,.68);
    acc += pc*w; wsum += w;
  }
  vec3 bc = acc/max(wsum, 1e-3);
  float blob = smoothstep(.05, 1.1, wsum);
  vec3 c = mix(base, bc*uP[0].w, blob*uP[0].y*.75);
  float hl = uP[0].z;
  c = mix(c, vec3(.35,.32,.34), smoothstep(.0022, 0., abs(p.y + .03))*smoothstep(hl*.95, hl*.95 - .06, abs(p.x))*step(.001, hl));
  float sd = uP[1].x;
  if (sd > 0.){ float d = length(p - vec2(0., .06)); c = mix(c, vec3(1.,.42,.34)*1.4, smoothstep(sd, sd - .004, d)); c += vec3(1.,.5,.4)*exp(-d*14.)*sd*4.; }
  c *= 1. - .03*vnoise(p*vec2(300., 30.)) + .02*br;
  return c*uP[3].w;
}

void main(){
  vec2 p = (gl_FragCoord.xy - .5*uRes)/uRes.y;
  vec3 c = vec3(0.);
#if SCENE == 1
  c = sHaze(p, uT);
#elif SCENE == 2
  c = sPlain(p, uT);
#elif SCENE == 3
  c = sMezz(p, uT);
#elif SCENE == 4
  c = sFall(p, uT);
#elif SCENE == 5
  c = sVoid(p, uT);
#endif
  o = vec4(max(c, 0.), 1.);
}
`;

// transition mix: 0 crossfade, 1 light-burn (bright areas first), 2 noise dissolve, 3 iris from centre
const MIX = COMMON + `
out vec4 o; uniform sampler2D uA, uB; uniform float uMix; uniform int uType; uniform vec2 uRes; uniform float uT;
void main(){
  vec2 uv = gl_FragCoord.xy/uRes;
  vec3 a = texture(uA, uv).rgb, b = texture(uB, uv).rgb;
  float m = uMix;
  if (uType == 1){ float k = clamp(luma(b)*.35, 0., 1.); m = smoothstep(0., 1., uMix*1.6 - (1. - k)*.6); }
  else if (uType == 2){ float n = fbm5(uv*vec2(6., 3.4) + uT*.1); m = smoothstep(n - .12, n + .12, uMix*1.3 - .15); }
  else if (uType == 3){ float d = length((uv - .5)*vec2(uRes.x/uRes.y, 1.)); m = smoothstep(uMix*1.2 - .15, uMix*1.2 - .35, d); }
  vec3 c = mix(a, b, m);
  if (uType == 1) c += vec3(1.,.8,.65)*sin(PI*uMix)*.35;
  o = vec4(c, 1.);
}`;

const DOWN = `#version 300 es
precision highp float; out vec4 o; uniform sampler2D uS; uniform vec2 uTexel;
void main(){
  vec2 uv = gl_FragCoord.xy*uTexel*.5 ; uv = (floor(gl_FragCoord.xy)*2. + 1.)*uTexel;
  vec2 x = uTexel;
  vec3 a = texture(uS, uv + x*vec2(-2, 2)).rgb, b = texture(uS, uv + x*vec2(0, 2)).rgb, c = texture(uS, uv + x*vec2(2, 2)).rgb;
  vec3 d = texture(uS, uv + x*vec2(-2, 0)).rgb, e = texture(uS, uv).rgb, f = texture(uS, uv + x*vec2(2, 0)).rgb;
  vec3 g = texture(uS, uv + x*vec2(-2, -2)).rgb, h = texture(uS, uv + x*vec2(0, -2)).rgb, i = texture(uS, uv + x*vec2(2, -2)).rgb;
  vec3 j = texture(uS, uv + x*vec2(-1, 1)).rgb, k = texture(uS, uv + x*vec2(1, 1)).rgb, l = texture(uS, uv + x*vec2(-1, -1)).rgb, m = texture(uS, uv + x*vec2(1, -1)).rgb;
  vec3 s = e*.125 + (a + c + g + i)*.03125 + (b + d + f + h)*.0625 + (j + k + l + m)*.125;
  o = vec4(min(s, vec3(40.)), 1.);
}`;

const UP = `#version 300 es
precision highp float; out vec4 o; uniform sampler2D uS, uD; uniform vec2 uTexel, uRes;
void main(){
  vec2 uv = gl_FragCoord.xy/uRes; vec2 x = uTexel;
  vec3 s = texture(uS, uv).rgb*4.;
  s += (texture(uS, uv + x*vec2(-1, 0)).rgb + texture(uS, uv + x*vec2(1, 0)).rgb + texture(uS, uv + x*vec2(0, 1)).rgb + texture(uS, uv + x*vec2(0, -1)).rgb)*2.;
  s += texture(uS, uv + x*vec2(-1, -1)).rgb + texture(uS, uv + x*vec2(1, -1)).rgb + texture(uS, uv + x*vec2(-1, 1)).rgb + texture(uS, uv + x*vec2(1, 1)).rgb;
  o = vec4(s/16. + texture(uD, uv).rgb, 1.);
}`;

const COMP = COMMON + `
out vec4 o;
uniform sampler2D uScene, uBloom, uText;
uniform vec2 uRes; uniform float uT, uFrame;
uniform float uCA, uGrain, uVig, uBars, uFade, uWhite, uStatic, uCrash, uSeed, uBlur, uLeak, uExpo, uZoom, uGhost, uBloomAmt, uHalf, uGleam, uDream, uTextGlow, uShard, uKick;
uniform vec3 uTint, uTextGlowCol; uniform vec2 uShake;
vec3 aces(vec3 x){ return clamp((x*(2.51*x + .03))/(x*(2.43*x + .59) + .14), 0., 1.); }
vec3 sampleScene(vec2 uv, float ca){
  vec2 dc = uv - .5;
  vec3 c;
  c.r = texture(uScene, uv - dc*ca).r;
  c.g = texture(uScene, uv).g;
  c.b = texture(uScene, uv + dc*ca).b;
  return c;
}
void main(){
  vec2 uv = gl_FragCoord.xy/uRes;
  float asp = uRes.x/uRes.y;
  vec2 cuv = uv + uShake;
  vec2 dc0 = cuv - .5;
  cuv = .5 + dc0*(1. - .035*dot(dc0, dc0));
  float edge = 0., shardLight = 0.;
  vec2 duv = vec2(0.);
  if (uCrash > .001){
    vec2 a = vec2(cuv.x*asp, cuv.y)*uShard;
    vec2 ai = floor(a), af = fract(a);
    float F1 = 9., F2 = 9.; vec2 cid = vec2(0.), cpt = vec2(0.);
    for (int j = -1; j <= 1; j++) for (int k = -1; k <= 1; k++){
      vec2 o2 = vec2(float(j), float(k)); vec2 hp = hash22(ai + o2 + uSeed);
      vec2 pt = o2 + .05 + hp*.9 - af; float d = dot(pt, pt);
      if (d < F1){ F2 = F1; F1 = d; cid = ai + o2; cpt = pt; } else if (d < F2) F2 = d;
    }
    vec2 hr = hash22(cid*1.7 + uSeed*3.1) - .5;
    float ang = (hash21(cid + uSeed) - .5)*.5*uCrash;
    vec2 local = -cpt/uShard; local.x /= asp;
    duv = hr*vec2(.11, .08)*uCrash*uCrash + (rot(ang)*local - local);
    edge = smoothstep(.02, 0., sqrt(F2) - sqrt(F1))*uCrash*uCrash*(.4 + .6*hash21(cid + uSeed*1.3));
    shardLight = (hash21(cid*3.3 + uSeed) - .3)*uCrash;
  }
  vec2 suv = cuv + duv;
  float ca = uCA*(.35 + length(suv - .5)*1.6) + edge*.012;
  vec3 col = sampleScene(suv, ca);
  if (uZoom > .001){
    vec3 zs = vec3(0.);
    for (int i = 1; i <= 8; i++){ float s = 1. - uZoom*float(i)/8.*.14; zs += sampleScene(.5 + (suv - .5)*s, ca); }
    col = mix(col, zs/8., min(uZoom*1.4, .85));
  }
  if (uGhost > .001){
    vec3 g1 = texture(uScene, suv + vec2(uGhost*.03, uGhost*.004)).rgb;
    vec3 g2 = texture(uScene, suv - vec2(uGhost*.03, uGhost*.004)).rgb;
    col = mix(col, vec3(g1.r, col.g, g2.b), .7)*1. + vec3(g1.r*.12, 0., g2.b*.12)*uGhost;
  }
  vec3 bl = texture(uBloom, suv).rgb/5.;
  float blurAmt = clamp(uBlur + uHalf*smoothstep(.62, .44, uv.y) + uDream*.35, 0., 1.);
  col = mix(col, bl*1.05, blurAmt);
  col += bl*uBloomAmt;
  col += bl*vec3(.35,.08,.02)*uBloomAmt*.6;
  col += vec3(1.,.9,.8)*shardLight*.25*luma(bl) + edge*vec3(1.,.95,.9)*.6*(.4 + luma(bl));
  if (uGleam > 0. && uGleam < 1.){
    float gx = (uv.x*asp - uv.y*.6) - mix(-.8, asp + .4, uGleam);
    col += vec3(1.,.9,.78)*exp(-gx*gx*55.)*.8*luma(bl + .2);
  }
  if (uDream > 0.) col = mix(col, hueRot(col, .35)*vec3(1.05,.95,1.12), uDream*.5);
  vec4 tx = texture(uText, suv);
  float tg = textureLod(uText, suv, 3.).a*.55 + textureLod(uText, suv, 5.).a*.6 + textureLod(uText, suv, 6.5).a*.5;
  float tgain = mix(1., 1.9, smoothstep(.3, .8, luma(tx.rgb)));
  col = mix(col, tx.rgb*tgain, tx.a*mix(1., .8, tgain - 1.)) + tx.rgb*tx.a*(tgain - 1.)*.0 + uTextGlowCol*tg*uTextGlow;
  if (uStatic > .001){
    float n = hash21(floor(gl_FragCoord.xy*.5) + fract(uFrame*.1731)*vec2(311., 173.));
    float lines = .5 + .5*sin(uv.y*uRes.y*1.2 + uFrame*2.);
    float roll = smoothstep(.02, 0., abs(fract(uv.y - uT*.23) - .5))*.6;
    vec3 st = vec3(.78,.8,.86)*(n*.9 + roll*.5)*(.75 + .25*lines);
    col = mix(col, st, uStatic);
  }
  if (uLeak > .001){
    vec2 lp = vec2(uv.x*asp, uv.y);
    vec2 c1 = vec2(asp*(.1 + .8*fract(uT*.021)), .8 + .2*sin(uT*.3));
    col += vec3(1.,.45,.2)*exp(-length(lp - c1)*2.2)*uLeak + vec3(1.,.7,.4)*exp(-abs(lp.x - asp*.95 + .1*sin(uT*.2))*5.)*uLeak*.6;
  }
  col *= uExpo;
  col = aces(col*.82);
  col = pow(col, vec3(1.04));
  col = mix(col, col*col*(3. - 2.*col), .35);
  col = col*uTint + vec3(.028,.02,.036)*(1. - col);
  float vd = length((uv - .5)*vec2(asp*.62, 1.));
  col *= 1. - uVig*smoothstep(.35, 1.05, vd);
  col = mix(col, vec3(.965,.945,.915), uWhite);
  col *= 1. - uFade;
  vec2 gp = floor(gl_FragCoord.xy/1.5); float gn = hash21(gp + fract(uFrame*.61803)*vec2(97., 57.)) + hash21(gp*1.3 + fract(uFrame*.3141)*vec2(17., 131.)) - 1.;
  col += gn*uGrain*(.35 + .65*(1. - abs(luma(col) - .45)*1.6));
  float bh = uBars*(1. - (1920./803.)/asp*1.)*.5;
  bh = uBars*.1282;
  if (uv.y < bh || uv.y > 1. - bh) col = vec3(.008,.007,.01) + gn*.01;
  o = vec4(clamp(col, 0., 1.), 1.);
}`;
const sceneSrc = id => SCENE.replace('precision highp float;', 'precision highp float;\n#define SCENE ' + id);
return { VS, SCENE, sceneSrc, MIX, DOWN, UP, COMP };
})();
