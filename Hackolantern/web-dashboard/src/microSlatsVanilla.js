import { Renderer, Program, Mesh, Triangle, RenderTarget, Texture } from 'ogl';

const SWELL_PRESETS = {
  swell: {
    scale: 1.5,
    speed: 0.6,
    direction: 250,
    chop: 0.55,
    stretch: 0,
    glint: 0.7,
    contrast: 1.25,
    perspective: 0.55,
    fog: 0.55
  },
  tide: {
    scale: 1.3,
    speed: 0.5,
    direction: 262,
    chop: 0.2,
    stretch: 0.12,
    glint: 0.45,
    contrast: 1.1,
    perspective: 0.5,
    fog: 0.4
  },
  storm: {
    scale: 0.55,
    speed: 1.6,
    direction: 236,
    chop: 1,
    stretch: 0.3,
    glint: 1.3,
    contrast: 1.8,
    perspective: 0.8,
    fog: 0.35
  },
  signal: {
    scale: 0.85,
    speed: 1.2,
    direction: 180,
    chop: 0.6,
    stretch: 0.85,
    glint: 0.25,
    contrast: 1.2,
    perspective: 0,
    fog: 0
  }
};

const FLUID_SIZE = 96;
const PRESSURE_STEPS = 16;
const SPLAT_FORCE = 6900;
const SPLASH_JETS = 3;
const PIXEL_BUDGET = 4.5e6;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const parseColor = (value, fallback) => {
  try {
    const ctx = document.createElement('canvas').getContext('2d');
    if (!ctx) return fallback;
    ctx.fillStyle = '#000000';
    ctx.fillStyle = value;
    const resolved = ctx.fillStyle;
    if (resolved.startsWith('#')) {
      const n = parseInt(resolved.slice(1), 16);
      return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
    }
    const parts = resolved.match(/[\d.]+/g);
    if (!parts || parts.length < 3) return fallback;
    return [Number(parts[0]) / 255, Number(parts[1]) / 255, Number(parts[2]) / 255, parts[3] ? Number(parts[3]) : 1];
  } catch {
    return fallback;
  }
};

const passVertex = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fluidVertex = `#version 300 es
in vec2 position;
uniform vec2 uTexel;
out vec2 vUv;
out vec2 vL;
out vec2 vR;
out vec2 vT;
out vec2 vB;
void main() {
  vUv = position * 0.5 + 0.5;
  vL = vUv - vec2(uTexel.x, 0.0);
  vR = vUv + vec2(uTexel.x, 0.0);
  vT = vUv + vec2(0.0, uTexel.y);
  vB = vUv - vec2(0.0, uTexel.y);
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fluidHead = `#version 300 es
precision highp float;
in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
out vec4 fragColor;
`;

const splatFragment = `${fluidHead}
uniform sampler2D uTarget;
uniform float uAspect;
uniform vec2 uPoint;
uniform vec3 uValue;
uniform float uRadius;
void main() {
  vec2 offset = vUv - uPoint;
  offset.x *= uAspect;
  float falloff = exp(-dot(offset, offset) / uRadius);
  fragColor = vec4(texture(uTarget, vUv).xyz + uValue * falloff, 1.0);
}
`;

const curlFragment = `${fluidHead}
uniform sampler2D uVelocity;
void main() {
  float left = texture(uVelocity, vL).y;
  float right = texture(uVelocity, vR).y;
  float top = texture(uVelocity, vT).x;
  float bottom = texture(uVelocity, vB).x;
  fragColor = vec4(0.5 * (right - left - top + bottom), 0.0, 0.0, 1.0);
}
`;

const vorticityFragment = `${fluidHead}
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform float uSwirl;
uniform float uDt;
void main() {
  float left = texture(uCurl, vL).x;
  float right = texture(uCurl, vR).x;
  float top = texture(uCurl, vT).x;
  float bottom = texture(uCurl, vB).x;
  float middle = texture(uCurl, vUv).x;
  vec2 force = 0.5 * vec2(abs(top) - abs(bottom), abs(right) - abs(left));
  force = force / (length(force) + 0.0001) * uSwirl * middle;
  force.y = -force.y;
  vec2 velocity = texture(uVelocity, vUv).xy + force * uDt;
  fragColor = vec4(clamp(velocity, -1000.0, 1000.0), 0.0, 1.0);
}
`;

const divergenceFragment = `${fluidHead}
uniform sampler2D uVelocity;
void main() {
  vec2 middle = texture(uVelocity, vUv).xy;
  float left = vL.x < 0.0 ? -middle.x : texture(uVelocity, vL).x;
  float right = vR.x > 1.0 ? -middle.x : texture(uVelocity, vR).x;
  float top = vT.y > 1.0 ? -middle.y : texture(uVelocity, vT).y;
  float bottom = vB.y < 0.0 ? -middle.y : texture(uVelocity, vB).y;
  fragColor = vec4(0.5 * (right - left + top - bottom), 0.0, 0.0, 1.0);
}
`;

const pressureFragment = `${fluidHead}
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
void main() {
  float left = texture(uPressure, vL).x;
  float right = texture(uPressure, vR).x;
  float top = texture(uPressure, vT).x;
  float bottom = texture(uPressure, vB).x;
  float divergence = texture(uDivergence, vUv).x;
  fragColor = vec4((left + right + top + bottom - divergence) * 0.25, 0.0, 0.0, 1.0);
}
`;

const projectFragment = `${fluidHead}
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
void main() {
  float left = texture(uPressure, vL).x;
  float right = texture(uPressure, vR).x;
  float top = texture(uPressure, vT).x;
  float bottom = texture(uPressure, vB).x;
  vec2 velocity = texture(uVelocity, vUv).xy - vec2(right - left, top - bottom) * 0.5;
  fragColor = vec4(velocity, 0.0, 1.0);
}
`;

const advectFragment = `${fluidHead}
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 uTexel;
uniform float uDt;
uniform float uFade;
void main() {
  vec2 coord = vUv - texture(uVelocity, vUv).xy * uTexel * uDt;
  fragColor = vec4(texture(uSource, coord).xyz * uFade, 1.0);
}
`;

const scaleFragment = `${fluidHead}
uniform sampler2D uSource;
uniform float uValue;
void main() {
  fragColor = vec4(texture(uSource, vUv).xyz * uValue, 1.0);
}
`;

const fieldFragment = `#version 300 es
precision highp float;
uniform vec2 uSize;
uniform vec4 uGrid;
uniform vec2 uOrigin;
uniform vec2 uSlat;
uniform float uTime;
uniform float uScale;
uniform float uDirection;
uniform float uChop;
uniform float uStretch;
uniform float uGlint;
uniform float uContrast;
uniform float uPerspective;
uniform float uFog;
uniform float uIntro;
uniform sampler2D tVelocity;
uniform sampler2D tInk;
uniform vec2 uFluidTexel;
uniform float uFluid;
uniform float uInk;
uniform float uLean;
out vec4 fragColor;

const float PI = 3.14159265359;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}

void main() {
  ivec2 coord = ivec2(gl_FragCoord.xy);
  if (coord.x >= int(uGrid.z) || coord.y >= int(uGrid.w)) {
    fragColor = vec4(0.0);
    return;
  }

  vec2 cell = vec2(coord);
  vec2 center = uOrigin + cell * uGrid.xy + uSlat * 0.5;
  vec2 p = (center / uSize) * 2.0 - 1.0;

  float rad = radians(uDirection);
  vec2 dir = vec2(cos(rad), sin(rad));

  float dist = length(p);
  float wave = sin(dot(p * uScale, dir) * 6.28318 + uTime);
  float detail = sin(dot(p * (uScale * 2.5), vec2(-dir.y, dir.x)) * 6.28318 - uTime * 1.3);
  float h = wave * 0.7 + detail * 0.3;
  h = mix(h, sign(h) * pow(abs(h), uChop), 0.5);

  vec2 uv = center / uSize;
  vec2 fluidVel = vec2(0.0);
  float fluidInkVal = 0.0;
  if (uFluid > 0.5) {
    fluidVel = texture(tVelocity, uv).xy;
    fluidInkVal = texture(tInk, uv).x;
  }

  h += fluidInkVal * uInk * 2.0;

  float glow = pow(clamp(h * 0.5 + 0.5, 0.0, 1.0), uContrast);
  float glintVal = pow(clamp(h * 0.5 + 0.5, 0.0, 1.0), 4.0) * uGlint;

  float fogVal = mix(1.0, clamp(1.0 - dist * 0.5, 0.0, 1.0), uFog);

  fragColor = vec4(glow, glintVal, fluidVel.x, fogVal * uIntro);
}
`;

const slatFragment = `#version 300 es
precision highp float;
uniform sampler2D tField;
uniform vec2 uSize;
uniform float uDpr;
uniform vec4 uGrid;
uniform vec2 uOrigin;
uniform vec2 uSlat;
uniform float uRound;
uniform float uTilt;
uniform vec3 uColor;
uniform vec3 uGlintColor;
uniform vec4 uBackground;
out vec4 fragColor;

float roundedBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

void main() {
  vec2 pixel = gl_FragCoord.xy / uDpr;
  vec2 p = pixel - uOrigin;
  vec2 cell = floor(p / uGrid.xy);
  vec2 local = p - cell * uGrid.xy;

  if (cell.x < 0.0 || cell.y < 0.0 || cell.x >= uGrid.z || cell.y >= uGrid.w) {
    fragColor = uBackground;
    return;
  }

  vec4 field = texelFetch(tField, ivec2(cell), 0);
  float glow = field.x;
  float glintVal = field.y;
  float fogVal = field.w;

  vec2 center = uSlat * 0.5;
  vec2 pos = local - center;

  float radius = min(uSlat.x, uSlat.y) * 0.5 * clamp(uRound, 0.0, 1.0);
  float d = roundedBox(pos, center, radius);

  if (d > 0.0) {
    fragColor = uBackground;
    return;
  }

  float edge = smoothstep(0.0, -1.0, d);
  vec3 col = mix(uColor * glow, uGlintColor, glintVal * 0.85);
  col = mix(uBackground.rgb, col, fogVal);

  fragColor = vec4(mix(uBackground.rgb, col, edge), 1.0);
}
`;

export function initMicroSlats(container, customOpts = {}) {
  if (!container) return () => {};

  const preset = customOpts.preset || 'swell';
  const base = SWELL_PRESETS[preset] || SWELL_PRESETS.swell;
  const pick = (val, key) => (val === undefined || val === null ? base[key] : val);

  const s = {
    color: parseColor(customOpts.color || '#f97316', [0.97, 0.45, 0.08, 1]),
    glintColor: parseColor(customOpts.glintColor || '#803edc', [0.5, 0.24, 0.86, 1]),
    backgroundColor: parseColor(customOpts.backgroundColor || '#120f17', [0.07, 0.06, 0.09, 1]),
    slatWidth: customOpts.slatWidth ?? 10,
    slatHeight: customOpts.slatHeight ?? 25,
    gap: customOpts.gap ?? 3,
    roundness: customOpts.roundness ?? 0.75,
    scale: pick(customOpts.scale, 'scale'),
    speed: pick(customOpts.speed, 'speed'),
    direction: pick(customOpts.direction, 'direction'),
    chop: pick(customOpts.chop, 'chop'),
    stretch: pick(customOpts.stretch, 'stretch'),
    glint: pick(customOpts.glint, 'glint'),
    contrast: pick(customOpts.contrast, 'contrast'),
    perspective: pick(customOpts.perspective, 'perspective'),
    fog: pick(customOpts.fog, 'fog'),
    interactive: customOpts.interactive ?? true,
    cursorStrength: customOpts.cursorStrength ?? 1,
    cursorSize: customOpts.cursorSize ?? 40,
    swirl: customOpts.swirl ?? 0,
    trail: customOpts.trail ?? 1.4,
    lean: customOpts.lean ?? 0,
    intro: customOpts.intro ?? true,
    introDuration: customOpts.introDuration ?? 1.5,
    paused: customOpts.paused ?? false
  };

  const renderer = new Renderer({ alpha: true, premultipliedAlpha: true, antialias: false, depth: false });
  const gl = renderer.gl;
  if (!renderer.isWebgl2) {
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return () => {};
  }
  gl.clearColor(0, 0, 0, 0);
  const canvas = gl.canvas;
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.setAttribute('aria-hidden', 'true');
  container.appendChild(canvas);

  const geometry = new Triangle(gl);
  const blank = new Texture(gl);
  const floatTargets = !!(
    gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float')
  );

  const dispose = target => {
    if (target?.buffer) gl.deleteFramebuffer(target.buffer);
    if (target?.texture?.texture) gl.deleteTexture(target.texture.texture);
  };

  let fieldTarget = new RenderTarget(gl, {
    width: 1,
    height: 1,
    depth: false,
    minFilter: gl.NEAREST,
    magFilter: gl.NEAREST
  });

  const fieldUniforms = {
    uSize: { value: [1, 1] },
    uGrid: { value: [1, 1, 1, 1] },
    uOrigin: { value: [0, 0] },
    uSlat: { value: [1, 1] },
    uTime: { value: 0 },
    uScale: { value: 1 },
    uDirection: { value: 0 },
    uChop: { value: 0.5 },
    uStretch: { value: 0.3 },
    uGlint: { value: 1 },
    uContrast: { value: 1 },
    uPerspective: { value: 0.7 },
    uFog: { value: 0.5 },
    uIntro: { value: 0 },
    tVelocity: { value: blank },
    tInk: { value: blank },
    uFluidTexel: { value: [1, 1] },
    uFluid: { value: 0 },
    uInk: { value: 1 },
    uLean: { value: 0.5 }
  };
  const fieldMesh = new Mesh(gl, {
    geometry,
    program: new Program(gl, {
      vertex: passVertex,
      fragment: fieldFragment,
      uniforms: fieldUniforms,
      depthTest: false,
      depthWrite: false
    })
  });

  const slatUniforms = {
    tField: { value: fieldTarget.texture },
    uSize: { value: [1, 1] },
    uDpr: { value: 1 },
    uGrid: { value: [1, 1, 1, 1] },
    uOrigin: { value: [0, 0] },
    uSlat: { value: [1, 1] },
    uRound: { value: 1 },
    uTilt: { value: 0 },
    uColor: { value: [1, 1, 1] },
    uGlintColor: { value: [1, 1, 1] },
    uBackground: { value: [0, 0, 0, 1] }
  };
  const slatMesh = new Mesh(gl, {
    geometry,
    program: new Program(gl, {
      vertex: passVertex,
      fragment: slatFragment,
      uniforms: slatUniforms,
      depthTest: false,
      depthWrite: false
    })
  });

  const fluidTexel = { value: [1, 1] };
  const fluidPass = (fragment, uniforms) =>
    new Mesh(gl, {
      geometry,
      program: new Program(gl, {
        vertex: fluidVertex,
        fragment,
        uniforms: { uTexel: fluidTexel, ...uniforms },
        depthTest: false,
        depthWrite: false
      })
    });
  const splatPass = fluidPass(splatFragment, {
    uTarget: { value: blank },
    uAspect: { value: 1 },
    uPoint: { value: [0, 0] },
    uValue: { value: [0, 0, 0] },
    uRadius: { value: 0.01 }
  });
  const curlPass = fluidPass(curlFragment, { uVelocity: { value: blank } });
  const vorticityPass = fluidPass(vorticityFragment, {
    uVelocity: { value: blank },
    uCurl: { value: blank },
    uSwirl: { value: 0 },
    uDt: { value: 0.016 }
  });
  const divergencePass = fluidPass(divergenceFragment, { uVelocity: { value: blank } });
  const pressurePass = fluidPass(pressureFragment, {
    uPressure: { value: blank },
    uDivergence: { value: blank }
  });
  const projectPass = fluidPass(projectFragment, {
    uPressure: { value: blank },
    uVelocity: { value: blank }
  });
  const advectPass = fluidPass(advectFragment, {
    uVelocity: { value: blank },
    uSource: { value: blank },
    uDt: { value: 0.016 },
    uFade: { value: 1 }
  });
  const scalePass = fluidPass(scaleFragment, { uSource: { value: blank }, uValue: { value: 0 } });

  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  let width = 1;
  let height = 1;
  let raf = 0;
  let last = performance.now();
  let time = 0;
  let introClock = 0;
  let visible = true;
  let alive = true;
  let fluid = null;
  let fluidUntil = 0;
  let splashTurn = 0;
  const splats = [];
  const pointer = { x: 0, y: 0, tracked: false };

  const run = (mesh, target) => renderer.render({ scene: mesh, target, clear: false });

  const floatTarget = (w, h) =>
    new RenderTarget(gl, {
      width: w,
      height: h,
      depth: false,
      type: gl.HALF_FLOAT,
      format: gl.RGBA,
      internalFormat: gl.RGBA16F,
      minFilter: gl.LINEAR,
      magFilter: gl.LINEAR
    });

  const swapPair = (w, h) => ({
    read: floatTarget(w, h),
    write: floatTarget(w, h),
    swap() {
      const next = this.read;
      this.read = this.write;
      this.write = next;
    }
  });

  const disposeFluid = () => {
    if (!fluid) return;
    [fluid.velocity, fluid.ink, fluid.pressure].forEach(pair => {
      dispose(pair.read);
      dispose(pair.write);
    });
    dispose(fluid.divergence);
    dispose(fluid.curl);
    fluid = null;
  };

  const buildFluid = () => {
    if (!floatTargets) return;
    const aspect = width / height;
    const w = Math.max(8, Math.round(aspect >= 1 ? FLUID_SIZE * aspect : FLUID_SIZE));
    const h = Math.max(8, Math.round(aspect >= 1 ? FLUID_SIZE : FLUID_SIZE / aspect));
    if (fluid && fluid.width === w && fluid.height === h) return;
    disposeFluid();
    fluid = {
      width: w,
      height: h,
      velocity: swapPair(w, h),
      ink: swapPair(w, h),
      pressure: swapPair(w, h),
      divergence: floatTarget(w, h),
      curl: floatTarget(w, h)
    };
    fluidTexel.value = [1 / w, 1 / h];
  };

  const layout = () => {
    const slatW = clamp(s.slatWidth, 1, 64);
    const slatH = clamp(s.slatHeight, 2, 240);
    const gapSize = clamp(s.gap, 0, 64);
    const pitchX = slatW + gapSize;
    const pitchY = slatH + gapSize;
    const cols = Math.min(2048, Math.ceil((width + gapSize) / pitchX) + 1);
    const rows = Math.min(2048, Math.ceil((height + gapSize) / pitchY) + 1);
    const originX = (width - (cols * pitchX - gapSize)) / 2;
    const originY = (height - (rows * pitchY - gapSize)) / 2;

    if (fieldTarget.width !== cols || fieldTarget.height !== rows) {
      dispose(fieldTarget);
      fieldTarget = new RenderTarget(gl, {
        width: cols,
        height: rows,
        depth: false,
        minFilter: gl.NEAREST,
        magFilter: gl.NEAREST
      });
      slatUniforms.tField.value = fieldTarget.texture;
    }
    const tilt = Math.min(0.42, Math.asin(clamp((pitchX * 1.5 - slatW * 0.5) / (slatH * 0.5), 0, 1)));
    return { slatW, slatH, tilt, grid: [cols, rows, pitchX, pitchY], origin: [originX, originY] };
  };

  const splat = (pair, point, value, radius) => {
    const u = splatPass.program.uniforms;
    u.uTarget.value = pair.read.texture;
    u.uAspect.value = width / height;
    u.uPoint.value = point;
    u.uValue.value = value;
    u.uRadius.value = radius;
    run(splatPass, pair.write);
    pair.swap();
  };

  const stepFluid = (f, dt) => {
    if (s.swirl > 0) {
      curlPass.program.uniforms.uVelocity.value = f.velocity.read.texture;
      run(curlPass, f.curl);

      const vorticity = vorticityPass.program.uniforms;
      vorticity.uVelocity.value = f.velocity.read.texture;
      vorticity.uCurl.value = f.curl.texture;
      vorticity.uSwirl.value = clamp(s.swirl, 0, 2) * 40;
      vorticity.uDt.value = dt;
      run(vorticityPass, f.velocity.write);
      f.velocity.swap();
    }

    divergencePass.program.uniforms.uVelocity.value = f.velocity.read.texture;
    run(divergencePass, f.divergence);

    scalePass.program.uniforms.uSource.value = f.pressure.read.texture;
    scalePass.program.uniforms.uValue.value = 0.8;
    run(scalePass, f.pressure.write);
    f.pressure.swap();

    pressurePass.program.uniforms.uDivergence.value = f.divergence.texture;
    for (let i = 0; i < PRESSURE_STEPS; i++) {
      pressurePass.program.uniforms.uPressure.value = f.pressure.read.texture;
      run(pressurePass, f.pressure.write);
      f.pressure.swap();
    }

    projectPass.program.uniforms.uPressure.value = f.pressure.read.texture;
    projectPass.program.uniforms.uVelocity.value = f.velocity.read.texture;
    run(projectPass, f.velocity.write);
    f.velocity.swap();

    const fade = 1 / clamp(s.trail, 0.1, 10);
    const advect = advectPass.program.uniforms;
    advect.uDt.value = dt;
    advect.uVelocity.value = f.velocity.read.texture;
    advect.uSource.value = f.velocity.read.texture;
    advect.uFade.value = fade * 1.4;
    run(advectPass, f.velocity.write);
    f.velocity.swap();

    advect.uVelocity.value = f.velocity.read.texture;
    advect.uSource.value = f.ink.read.texture;
    advect.uFade.value = fade;
    run(advectPass, f.ink.write);
    f.ink.swap();
  };

  const frame = now => {
    raf = 0;
    if (!alive) return;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;

    if (!s.paused && !reducedMotion) time += dt * s.speed;
    introClock = s.intro && !reducedMotion ? introClock + dt / Math.max(0.2, s.introDuration) : 1;
    const introLinear = Math.min(introClock, 1);
    const introEase =
      introLinear < 0.5 ? 4 * introLinear * introLinear * introLinear : 1 - Math.pow(-2 * introLinear + 2, 3) / 2;

    if (fluid && splats.length) {
      const radius = Math.pow(clamp(s.cursorSize, 4, 600) / height, 2) * 0.35;
      const aspect = width / height;
      for (const [u, v, du, dv, turn] of splats) {
        if (turn !== null) {
          for (let i = 0; i < SPLASH_JETS; i++) {
            const angle = turn + (i * Math.PI * 2) / SPLASH_JETS;
            const jet = [Math.cos(angle) * SPLAT_FORCE * 0.45, Math.sin(angle) * SPLAT_FORCE * 0.45, 0];
            splat(fluid.velocity, [u, v], jet, radius * 1.3);
          }
          splat(fluid.ink, [u, v], [1, 0, 0], radius * 2.2);
        } else {
          splat(fluid.velocity, [u, v], [du * SPLAT_FORCE, dv * SPLAT_FORCE, 0], radius);
          const speed = Math.hypot(du * aspect, dv);
          splat(fluid.ink, [u, v], [clamp(speed * 3.5, 0.4, 1.2), 0, 0], radius);
        }
      }
      splats.length = 0;
    }

    const fluidActive = fluid && now < fluidUntil;
    if (fluidActive) stepFluid(fluid, dt);

    const grid = layout();

    fieldUniforms.uSize.value = [width, height];
    fieldUniforms.uGrid.value = grid.grid;
    fieldUniforms.uOrigin.value = grid.origin;
    fieldUniforms.uSlat.value = [grid.slatW, grid.slatH];
    fieldUniforms.uTime.value = time;
    fieldUniforms.uScale.value = Math.max(0.001, s.scale);
    fieldUniforms.uDirection.value = s.direction;
    fieldUniforms.uChop.value = clamp(s.chop, 0.001, 1);
    fieldUniforms.uStretch.value = clamp(s.stretch, 0, 1);
    fieldUniforms.uGlint.value = Math.max(0, s.glint);
    fieldUniforms.uContrast.value = clamp(s.contrast, 0.2, 4);
    fieldUniforms.uPerspective.value = clamp(s.perspective, 0, 1);
    fieldUniforms.uFog.value = clamp(s.fog, 0, 1);
    fieldUniforms.uIntro.value = introEase;
    fieldUniforms.uFluid.value = fluidActive ? 1 : 0;
    fieldUniforms.tVelocity.value = fluid ? fluid.velocity.read.texture : blank;
    fieldUniforms.tInk.value = fluid ? fluid.ink.read.texture : blank;
    fieldUniforms.uFluidTexel.value = fluidTexel.value;
    fieldUniforms.uInk.value = clamp(s.cursorStrength, 0, 3);
    fieldUniforms.uLean.value = clamp(s.lean, 0, 1);
    renderer.render({ scene: fieldMesh, target: fieldTarget });

    slatUniforms.uSize.value = [width, height];
    slatUniforms.uDpr.value = renderer.dpr;
    slatUniforms.uGrid.value = grid.grid;
    slatUniforms.uOrigin.value = grid.origin;
    slatUniforms.uSlat.value = [grid.slatW, grid.slatH];
    slatUniforms.uRound.value = clamp(s.roundness, 0, 1);
    slatUniforms.uTilt.value = fluidActive && s.lean > 0 ? grid.tilt : 0;
    slatUniforms.uColor.value = s.color.slice(0, 3);
    slatUniforms.uGlintColor.value = s.glintColor.slice(0, 3);
    slatUniforms.uBackground.value = s.backgroundColor;
    renderer.render({ scene: slatMesh });

    const moving = (!s.paused && !reducedMotion && s.speed !== 0) || introClock < 1;
    if (visible && (moving || fluidActive)) raf = requestAnimationFrame(frame);
  };

  const start = () => {
    if (raf || !visible || !alive) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };

  const locate = e => {
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    return { x, y, u: x / w, v: 1 - y / h, h, inside: x >= 0 && y >= 0 && x <= w && y <= h };
  };

  const queue = (u, v, du, dv, turn) => {
    if (splats.length > 32) splats.shift();
    splats.push([u, v, du, dv, turn]);
    fluidUntil = performance.now() + Math.max(1.5, s.trail * 5) * 1000;
    start();
  };

  const onPointerMove = e => {
    const spot = locate(e);
    if (!fluid || !s.interactive || reducedMotion || !spot.inside) {
      pointer.tracked = false;
      return;
    }
    if (pointer.tracked && (spot.x !== pointer.x || spot.y !== pointer.y)) {
      queue(spot.u, spot.v, (spot.x - pointer.x) / spot.h, (pointer.y - spot.y) / spot.h, null);
    }
    pointer.x = spot.x;
    pointer.y = spot.y;
    pointer.tracked = true;
  };

  const onPointerDown = e => {
    const spot = locate(e);
    if (!fluid || !s.interactive || reducedMotion || !spot.inside) return;
    splashTurn += 2.39996;
    queue(spot.u, spot.v, 0, 0, splashTurn);
  };

  const onPointerLeave = () => {
    pointer.tracked = false;
  };

  const onPointerOut = e => {
    if (!e.relatedTarget) onPointerLeave();
  };

  const onVisibility = () => {
    if (!document.hidden) start();
  };

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerdown', onPointerDown, { passive: true });
  window.addEventListener('pointerout', onPointerOut, { passive: true });
  window.addEventListener('blur', onPointerLeave);
  document.addEventListener('visibilitychange', onVisibility);

  const resize = () => {
    width = Math.max(1, container.clientWidth);
    height = Math.max(1, container.clientHeight);
    renderer.dpr = Math.min(window.devicePixelRatio || 1, 2, Math.sqrt(PIXEL_BUDGET / (width * height)));
    renderer.setSize(width, height);
    buildFluid();
    start();
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);

  const intersectionObserver = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible) start();
    else cancelAnimationFrame(raf);
  });
  intersectionObserver.observe(container);

  resize();
  start();

  return () => {
    alive = false;
    visible = false;
    cancelAnimationFrame(raf);
    resizeObserver.disconnect();
    intersectionObserver.disconnect();
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointerout', onPointerOut);
    window.removeEventListener('blur', onPointerLeave);
    document.removeEventListener('visibilitychange', onVisibility);
    disposeFluid();
    dispose(fieldTarget);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  };
}

if (typeof window !== 'undefined') {
  window.initMicroSlats = initMicroSlats;
}
