// node_modules/ogl/src/core/Program.js
var ID = 1;
var arrayCacheF32 = {};

class Program {
  constructor(gl, {
    vertex,
    fragment,
    uniforms = {},
    transparent = false,
    cullFace = gl.BACK,
    frontFace = gl.CCW,
    depthTest = true,
    depthWrite = true,
    depthFunc = gl.LEQUAL
  } = {}) {
    if (!gl.canvas)
      console.error("gl not passed as first argument to Program");
    this.gl = gl;
    this.uniforms = uniforms;
    this.id = ID++;
    if (!vertex)
      console.warn("vertex shader not supplied");
    if (!fragment)
      console.warn("fragment shader not supplied");
    this.transparent = transparent;
    this.cullFace = cullFace;
    this.frontFace = frontFace;
    this.depthTest = depthTest;
    this.depthWrite = depthWrite;
    this.depthFunc = depthFunc;
    this.blendFunc = {};
    this.blendEquation = {};
    this.stencilFunc = {};
    this.stencilOp = {};
    if (this.transparent && !this.blendFunc.src) {
      if (this.gl.renderer.premultipliedAlpha)
        this.setBlendFunc(this.gl.ONE, this.gl.ONE_MINUS_SRC_ALPHA);
      else
        this.setBlendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
    }
    this.vertexShader = gl.createShader(gl.VERTEX_SHADER);
    this.fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
    this.program = gl.createProgram();
    gl.attachShader(this.program, this.vertexShader);
    gl.attachShader(this.program, this.fragmentShader);
    this.setShaders({ vertex, fragment });
  }
  setShaders({ vertex, fragment }) {
    if (vertex) {
      this.gl.shaderSource(this.vertexShader, vertex);
      this.gl.compileShader(this.vertexShader);
      if (this.gl.getShaderInfoLog(this.vertexShader) !== "") {
        console.warn(`${this.gl.getShaderInfoLog(this.vertexShader)}
Vertex Shader
${addLineNumbers(vertex)}`);
      }
    }
    if (fragment) {
      this.gl.shaderSource(this.fragmentShader, fragment);
      this.gl.compileShader(this.fragmentShader);
      if (this.gl.getShaderInfoLog(this.fragmentShader) !== "") {
        console.warn(`${this.gl.getShaderInfoLog(this.fragmentShader)}
Fragment Shader
${addLineNumbers(fragment)}`);
      }
    }
    this.gl.linkProgram(this.program);
    if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
      return console.warn(this.gl.getProgramInfoLog(this.program));
    }
    this.uniformLocations = new Map;
    let numUniforms = this.gl.getProgramParameter(this.program, this.gl.ACTIVE_UNIFORMS);
    for (let uIndex = 0;uIndex < numUniforms; uIndex++) {
      let uniform = this.gl.getActiveUniform(this.program, uIndex);
      this.uniformLocations.set(uniform, this.gl.getUniformLocation(this.program, uniform.name));
      const split = uniform.name.match(/(\w+)/g);
      uniform.uniformName = split[0];
      uniform.nameComponents = split.slice(1);
    }
    this.attributeLocations = new Map;
    const locations = [];
    const numAttribs = this.gl.getProgramParameter(this.program, this.gl.ACTIVE_ATTRIBUTES);
    for (let aIndex = 0;aIndex < numAttribs; aIndex++) {
      const attribute = this.gl.getActiveAttrib(this.program, aIndex);
      const location = this.gl.getAttribLocation(this.program, attribute.name);
      if (location === -1)
        continue;
      locations[location] = attribute.name;
      this.attributeLocations.set(attribute, location);
    }
    this.attributeOrder = locations.join("");
  }
  setBlendFunc(src, dst, srcAlpha, dstAlpha) {
    this.blendFunc.src = src;
    this.blendFunc.dst = dst;
    this.blendFunc.srcAlpha = srcAlpha;
    this.blendFunc.dstAlpha = dstAlpha;
    if (src)
      this.transparent = true;
  }
  setBlendEquation(modeRGB, modeAlpha) {
    this.blendEquation.modeRGB = modeRGB;
    this.blendEquation.modeAlpha = modeAlpha;
  }
  setStencilFunc(func, ref, mask) {
    this.stencilRef = ref;
    this.stencilFunc.func = func;
    this.stencilFunc.ref = ref;
    this.stencilFunc.mask = mask;
  }
  setStencilOp(stencilFail, depthFail, depthPass) {
    this.stencilOp.stencilFail = stencilFail;
    this.stencilOp.depthFail = depthFail;
    this.stencilOp.depthPass = depthPass;
  }
  applyState() {
    if (this.depthTest)
      this.gl.renderer.enable(this.gl.DEPTH_TEST);
    else
      this.gl.renderer.disable(this.gl.DEPTH_TEST);
    if (this.cullFace)
      this.gl.renderer.enable(this.gl.CULL_FACE);
    else
      this.gl.renderer.disable(this.gl.CULL_FACE);
    if (this.blendFunc.src)
      this.gl.renderer.enable(this.gl.BLEND);
    else
      this.gl.renderer.disable(this.gl.BLEND);
    if (this.cullFace)
      this.gl.renderer.setCullFace(this.cullFace);
    this.gl.renderer.setFrontFace(this.frontFace);
    this.gl.renderer.setDepthMask(this.depthWrite);
    this.gl.renderer.setDepthFunc(this.depthFunc);
    if (this.blendFunc.src)
      this.gl.renderer.setBlendFunc(this.blendFunc.src, this.blendFunc.dst, this.blendFunc.srcAlpha, this.blendFunc.dstAlpha);
    this.gl.renderer.setBlendEquation(this.blendEquation.modeRGB, this.blendEquation.modeAlpha);
    if (this.stencilFunc.func || this.stencilOp.stencilFail)
      this.gl.renderer.enable(this.gl.STENCIL_TEST);
    else
      this.gl.renderer.disable(this.gl.STENCIL_TEST);
    this.gl.renderer.setStencilFunc(this.stencilFunc.func, this.stencilFunc.ref, this.stencilFunc.mask);
    this.gl.renderer.setStencilOp(this.stencilOp.stencilFail, this.stencilOp.depthFail, this.stencilOp.depthPass);
  }
  use({ flipFaces = false } = {}) {
    let textureUnit = -1;
    const programActive = this.gl.renderer.state.currentProgram === this.id;
    if (!programActive) {
      this.gl.useProgram(this.program);
      this.gl.renderer.state.currentProgram = this.id;
    }
    this.uniformLocations.forEach((location, activeUniform) => {
      let uniform = this.uniforms[activeUniform.uniformName];
      for (const component of activeUniform.nameComponents) {
        if (!uniform)
          break;
        if (component in uniform) {
          uniform = uniform[component];
        } else if (Array.isArray(uniform.value)) {
          break;
        } else {
          uniform = undefined;
          break;
        }
      }
      if (!uniform) {
        return warn(`Active uniform ${activeUniform.name} has not been supplied`);
      }
      if (uniform && uniform.value === undefined) {
        return warn(`${activeUniform.name} uniform is missing a value parameter`);
      }
      if (uniform.value.texture) {
        textureUnit = textureUnit + 1;
        uniform.value.update(textureUnit);
        return setUniform(this.gl, activeUniform.type, location, textureUnit);
      }
      if (uniform.value.length && uniform.value[0].texture) {
        const textureUnits = [];
        uniform.value.forEach((value) => {
          textureUnit = textureUnit + 1;
          value.update(textureUnit);
          textureUnits.push(textureUnit);
        });
        return setUniform(this.gl, activeUniform.type, location, textureUnits);
      }
      setUniform(this.gl, activeUniform.type, location, uniform.value);
    });
    this.applyState();
    if (flipFaces)
      this.gl.renderer.setFrontFace(this.frontFace === this.gl.CCW ? this.gl.CW : this.gl.CCW);
  }
  remove() {
    this.gl.deleteProgram(this.program);
  }
}
function setUniform(gl, type, location, value) {
  value = value.length ? flatten(value) : value;
  const setValue = gl.renderer.state.uniformLocations.get(location);
  if (value.length) {
    if (setValue === undefined || setValue.length !== value.length) {
      gl.renderer.state.uniformLocations.set(location, value.slice(0));
    } else {
      if (arraysEqual(setValue, value))
        return;
      setValue.set ? setValue.set(value) : setArray(setValue, value);
      gl.renderer.state.uniformLocations.set(location, setValue);
    }
  } else {
    if (setValue === value)
      return;
    gl.renderer.state.uniformLocations.set(location, value);
  }
  switch (type) {
    case 5126:
      return value.length ? gl.uniform1fv(location, value) : gl.uniform1f(location, value);
    case 35664:
      return gl.uniform2fv(location, value);
    case 35665:
      return gl.uniform3fv(location, value);
    case 35666:
      return gl.uniform4fv(location, value);
    case 35670:
    case 5124:
    case 35678:
    case 36306:
    case 35680:
    case 36289:
      return value.length ? gl.uniform1iv(location, value) : gl.uniform1i(location, value);
    case 35671:
    case 35667:
      return gl.uniform2iv(location, value);
    case 35672:
    case 35668:
      return gl.uniform3iv(location, value);
    case 35673:
    case 35669:
      return gl.uniform4iv(location, value);
    case 35674:
      return gl.uniformMatrix2fv(location, false, value);
    case 35675:
      return gl.uniformMatrix3fv(location, false, value);
    case 35676:
      return gl.uniformMatrix4fv(location, false, value);
  }
}
function addLineNumbers(string) {
  let lines = string.split(`
`);
  for (let i = 0;i < lines.length; i++) {
    lines[i] = i + 1 + ": " + lines[i];
  }
  return lines.join(`
`);
}
function flatten(a) {
  const arrayLen = a.length;
  const valueLen = a[0].length;
  if (valueLen === undefined)
    return a;
  const length = arrayLen * valueLen;
  let value = arrayCacheF32[length];
  if (!value)
    arrayCacheF32[length] = value = new Float32Array(length);
  for (let i = 0;i < arrayLen; i++)
    value.set(a[i], i * valueLen);
  return value;
}
function arraysEqual(a, b) {
  if (a.length !== b.length)
    return false;
  for (let i = 0, l = a.length;i < l; i++) {
    if (a[i] !== b[i])
      return false;
  }
  return true;
}
function setArray(a, b) {
  for (let i = 0, l = a.length;i < l; i++) {
    a[i] = b[i];
  }
}
var warnCount = 0;
function warn(message) {
  if (warnCount > 100)
    return;
  console.warn(message);
  warnCount++;
  if (warnCount > 100)
    console.warn("More than 100 program warnings - stopping logs.");
}
// node_modules/ogl/src/math/functions/Vec3Func.js
function length(a) {
  let x = a[0];
  let y = a[1];
  let z = a[2];
  return Math.sqrt(x * x + y * y + z * z);
}
function copy(out, a) {
  out[0] = a[0];
  out[1] = a[1];
  out[2] = a[2];
  return out;
}
function set(out, x, y, z) {
  out[0] = x;
  out[1] = y;
  out[2] = z;
  return out;
}
function add(out, a, b) {
  out[0] = a[0] + b[0];
  out[1] = a[1] + b[1];
  out[2] = a[2] + b[2];
  return out;
}
function subtract(out, a, b) {
  out[0] = a[0] - b[0];
  out[1] = a[1] - b[1];
  out[2] = a[2] - b[2];
  return out;
}
function multiply(out, a, b) {
  out[0] = a[0] * b[0];
  out[1] = a[1] * b[1];
  out[2] = a[2] * b[2];
  return out;
}
function divide(out, a, b) {
  out[0] = a[0] / b[0];
  out[1] = a[1] / b[1];
  out[2] = a[2] / b[2];
  return out;
}
function scale(out, a, b) {
  out[0] = a[0] * b;
  out[1] = a[1] * b;
  out[2] = a[2] * b;
  return out;
}
function distance(a, b) {
  let x = b[0] - a[0];
  let y = b[1] - a[1];
  let z = b[2] - a[2];
  return Math.sqrt(x * x + y * y + z * z);
}
function squaredDistance(a, b) {
  let x = b[0] - a[0];
  let y = b[1] - a[1];
  let z = b[2] - a[2];
  return x * x + y * y + z * z;
}
function squaredLength(a) {
  let x = a[0];
  let y = a[1];
  let z = a[2];
  return x * x + y * y + z * z;
}
function negate(out, a) {
  out[0] = -a[0];
  out[1] = -a[1];
  out[2] = -a[2];
  return out;
}
function inverse(out, a) {
  out[0] = 1 / a[0];
  out[1] = 1 / a[1];
  out[2] = 1 / a[2];
  return out;
}
function normalize(out, a) {
  let x = a[0];
  let y = a[1];
  let z = a[2];
  let len = x * x + y * y + z * z;
  if (len > 0) {
    len = 1 / Math.sqrt(len);
  }
  out[0] = a[0] * len;
  out[1] = a[1] * len;
  out[2] = a[2] * len;
  return out;
}
function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function cross(out, a, b) {
  let ax = a[0], ay = a[1], az = a[2];
  let bx = b[0], by = b[1], bz = b[2];
  out[0] = ay * bz - az * by;
  out[1] = az * bx - ax * bz;
  out[2] = ax * by - ay * bx;
  return out;
}
function lerp(out, a, b, t) {
  let ax = a[0];
  let ay = a[1];
  let az = a[2];
  out[0] = ax + t * (b[0] - ax);
  out[1] = ay + t * (b[1] - ay);
  out[2] = az + t * (b[2] - az);
  return out;
}
function smoothLerp(out, a, b, decay, dt) {
  const exp = Math.exp(-decay * dt);
  let ax = a[0];
  let ay = a[1];
  let az = a[2];
  out[0] = b[0] + (ax - b[0]) * exp;
  out[1] = b[1] + (ay - b[1]) * exp;
  out[2] = b[2] + (az - b[2]) * exp;
  return out;
}
function transformMat4(out, a, m) {
  let x = a[0], y = a[1], z = a[2];
  let w = m[3] * x + m[7] * y + m[11] * z + m[15];
  w = w || 1;
  out[0] = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w;
  out[1] = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
  out[2] = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w;
  return out;
}
function scaleRotateMat4(out, a, m) {
  let x = a[0], y = a[1], z = a[2];
  let w = m[3] * x + m[7] * y + m[11] * z + m[15];
  w = w || 1;
  out[0] = (m[0] * x + m[4] * y + m[8] * z) / w;
  out[1] = (m[1] * x + m[5] * y + m[9] * z) / w;
  out[2] = (m[2] * x + m[6] * y + m[10] * z) / w;
  return out;
}
function transformMat3(out, a, m) {
  let x = a[0], y = a[1], z = a[2];
  out[0] = x * m[0] + y * m[3] + z * m[6];
  out[1] = x * m[1] + y * m[4] + z * m[7];
  out[2] = x * m[2] + y * m[5] + z * m[8];
  return out;
}
function transformQuat(out, a, q) {
  let x = a[0], y = a[1], z = a[2];
  let qx = q[0], qy = q[1], qz = q[2], qw = q[3];
  let uvx = qy * z - qz * y;
  let uvy = qz * x - qx * z;
  let uvz = qx * y - qy * x;
  let uuvx = qy * uvz - qz * uvy;
  let uuvy = qz * uvx - qx * uvz;
  let uuvz = qx * uvy - qy * uvx;
  let w2 = qw * 2;
  uvx *= w2;
  uvy *= w2;
  uvz *= w2;
  uuvx *= 2;
  uuvy *= 2;
  uuvz *= 2;
  out[0] = x + uvx + uuvx;
  out[1] = y + uvy + uuvy;
  out[2] = z + uvz + uuvz;
  return out;
}
var angle = function() {
  const tempA = [0, 0, 0];
  const tempB = [0, 0, 0];
  return function(a, b) {
    copy(tempA, a);
    copy(tempB, b);
    normalize(tempA, tempA);
    normalize(tempB, tempB);
    let cosine = dot(tempA, tempB);
    if (cosine > 1) {
      return 0;
    } else if (cosine < -1) {
      return Math.PI;
    } else {
      return Math.acos(cosine);
    }
  };
}();
function exactEquals(a, b) {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

// node_modules/ogl/src/math/Vec3.js
class Vec3 extends Array {
  constructor(x = 0, y = x, z = x) {
    super(x, y, z);
    return this;
  }
  get x() {
    return this[0];
  }
  get y() {
    return this[1];
  }
  get z() {
    return this[2];
  }
  set x(v) {
    this[0] = v;
  }
  set y(v) {
    this[1] = v;
  }
  set z(v) {
    this[2] = v;
  }
  set(x, y = x, z = x) {
    if (x.length)
      return this.copy(x);
    set(this, x, y, z);
    return this;
  }
  copy(v) {
    copy(this, v);
    return this;
  }
  add(va, vb) {
    if (vb)
      add(this, va, vb);
    else
      add(this, this, va);
    return this;
  }
  sub(va, vb) {
    if (vb)
      subtract(this, va, vb);
    else
      subtract(this, this, va);
    return this;
  }
  multiply(v) {
    if (v.length)
      multiply(this, this, v);
    else
      scale(this, this, v);
    return this;
  }
  divide(v) {
    if (v.length)
      divide(this, this, v);
    else
      scale(this, this, 1 / v);
    return this;
  }
  inverse(v = this) {
    inverse(this, v);
    return this;
  }
  len() {
    return length(this);
  }
  distance(v) {
    if (v)
      return distance(this, v);
    else
      return length(this);
  }
  squaredLen() {
    return squaredLength(this);
  }
  squaredDistance(v) {
    if (v)
      return squaredDistance(this, v);
    else
      return squaredLength(this);
  }
  negate(v = this) {
    negate(this, v);
    return this;
  }
  cross(va, vb) {
    if (vb)
      cross(this, va, vb);
    else
      cross(this, this, va);
    return this;
  }
  scale(v) {
    scale(this, this, v);
    return this;
  }
  normalize() {
    normalize(this, this);
    return this;
  }
  dot(v) {
    return dot(this, v);
  }
  equals(v) {
    return exactEquals(this, v);
  }
  applyMatrix3(mat3) {
    transformMat3(this, this, mat3);
    return this;
  }
  applyMatrix4(mat4) {
    transformMat4(this, this, mat4);
    return this;
  }
  scaleRotateMatrix4(mat4) {
    scaleRotateMat4(this, this, mat4);
    return this;
  }
  applyQuaternion(q) {
    transformQuat(this, this, q);
    return this;
  }
  angle(v) {
    return angle(this, v);
  }
  lerp(v, t) {
    lerp(this, this, v, t);
    return this;
  }
  smoothLerp(v, decay, dt) {
    smoothLerp(this, this, v, decay, dt);
    return this;
  }
  clone() {
    return new Vec3(this[0], this[1], this[2]);
  }
  fromArray(a, o = 0) {
    this[0] = a[o];
    this[1] = a[o + 1];
    this[2] = a[o + 2];
    return this;
  }
  toArray(a = [], o = 0) {
    a[o] = this[0];
    a[o + 1] = this[1];
    a[o + 2] = this[2];
    return a;
  }
  transformDirection(mat4) {
    const x = this[0];
    const y = this[1];
    const z = this[2];
    this[0] = mat4[0] * x + mat4[4] * y + mat4[8] * z;
    this[1] = mat4[1] * x + mat4[5] * y + mat4[9] * z;
    this[2] = mat4[2] * x + mat4[6] * y + mat4[10] * z;
    return this.normalize();
  }
}

// node_modules/ogl/src/core/Renderer.js
var tempVec3 = /* @__PURE__ */ new Vec3;
var ID2 = 1;

class Renderer {
  constructor({
    canvas = document.createElement("canvas"),
    width = 300,
    height = 150,
    dpr = 1,
    alpha = false,
    depth = true,
    stencil = false,
    antialias = false,
    premultipliedAlpha = false,
    preserveDrawingBuffer = false,
    powerPreference = "default",
    autoClear = true,
    webgl = 2
  } = {}) {
    const attributes = { alpha, depth, stencil, antialias, premultipliedAlpha, preserveDrawingBuffer, powerPreference };
    this.dpr = dpr;
    this.alpha = alpha;
    this.color = true;
    this.depth = depth;
    this.stencil = stencil;
    this.premultipliedAlpha = premultipliedAlpha;
    this.autoClear = autoClear;
    this.id = ID2++;
    if (webgl === 2)
      this.gl = canvas.getContext("webgl2", attributes);
    this.isWebgl2 = !!this.gl;
    if (!this.gl)
      this.gl = canvas.getContext("webgl", attributes);
    if (!this.gl)
      console.error("unable to create webgl context");
    this.gl.renderer = this;
    this.setSize(width, height);
    this.state = {};
    this.state.blendFunc = { src: this.gl.ONE, dst: this.gl.ZERO };
    this.state.blendEquation = { modeRGB: this.gl.FUNC_ADD };
    this.state.cullFace = false;
    this.state.frontFace = this.gl.CCW;
    this.state.depthMask = true;
    this.state.depthFunc = this.gl.LEQUAL;
    this.state.premultiplyAlpha = false;
    this.state.flipY = false;
    this.state.unpackAlignment = 4;
    this.state.framebuffer = null;
    this.state.viewport = { x: 0, y: 0, width: null, height: null };
    this.state.textureUnits = [];
    this.state.activeTextureUnit = 0;
    this.state.boundBuffer = null;
    this.state.uniformLocations = new Map;
    this.state.currentProgram = null;
    this.extensions = {};
    if (this.isWebgl2) {
      this.getExtension("EXT_color_buffer_float");
      this.getExtension("OES_texture_float_linear");
    } else {
      this.getExtension("OES_texture_float");
      this.getExtension("OES_texture_float_linear");
      this.getExtension("OES_texture_half_float");
      this.getExtension("OES_texture_half_float_linear");
      this.getExtension("OES_element_index_uint");
      this.getExtension("OES_standard_derivatives");
      this.getExtension("EXT_sRGB");
      this.getExtension("WEBGL_depth_texture");
      this.getExtension("WEBGL_draw_buffers");
    }
    this.getExtension("WEBGL_compressed_texture_astc");
    this.getExtension("EXT_texture_compression_bptc");
    this.getExtension("WEBGL_compressed_texture_s3tc");
    this.getExtension("WEBGL_compressed_texture_etc1");
    this.getExtension("WEBGL_compressed_texture_pvrtc");
    this.getExtension("WEBKIT_WEBGL_compressed_texture_pvrtc");
    this.vertexAttribDivisor = this.getExtension("ANGLE_instanced_arrays", "vertexAttribDivisor", "vertexAttribDivisorANGLE");
    this.drawArraysInstanced = this.getExtension("ANGLE_instanced_arrays", "drawArraysInstanced", "drawArraysInstancedANGLE");
    this.drawElementsInstanced = this.getExtension("ANGLE_instanced_arrays", "drawElementsInstanced", "drawElementsInstancedANGLE");
    this.createVertexArray = this.getExtension("OES_vertex_array_object", "createVertexArray", "createVertexArrayOES");
    this.bindVertexArray = this.getExtension("OES_vertex_array_object", "bindVertexArray", "bindVertexArrayOES");
    this.deleteVertexArray = this.getExtension("OES_vertex_array_object", "deleteVertexArray", "deleteVertexArrayOES");
    this.drawBuffers = this.getExtension("WEBGL_draw_buffers", "drawBuffers", "drawBuffersWEBGL");
    this.parameters = {};
    this.parameters.maxTextureUnits = this.gl.getParameter(this.gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS);
    this.parameters.maxAnisotropy = this.getExtension("EXT_texture_filter_anisotropic") ? this.gl.getParameter(this.getExtension("EXT_texture_filter_anisotropic").MAX_TEXTURE_MAX_ANISOTROPY_EXT) : 0;
  }
  setSize(width, height) {
    this.width = width;
    this.height = height;
    this.gl.canvas.width = width * this.dpr;
    this.gl.canvas.height = height * this.dpr;
    if (!this.gl.canvas.style)
      return;
    Object.assign(this.gl.canvas.style, {
      width: width + "px",
      height: height + "px"
    });
  }
  setViewport(width, height, x = 0, y = 0) {
    if (this.state.viewport.width === width && this.state.viewport.height === height)
      return;
    this.state.viewport.width = width;
    this.state.viewport.height = height;
    this.state.viewport.x = x;
    this.state.viewport.y = y;
    this.gl.viewport(x, y, width, height);
  }
  setScissor(width, height, x = 0, y = 0) {
    this.gl.scissor(x, y, width, height);
  }
  enable(id) {
    if (this.state[id] === true)
      return;
    this.gl.enable(id);
    this.state[id] = true;
  }
  disable(id) {
    if (this.state[id] === false)
      return;
    this.gl.disable(id);
    this.state[id] = false;
  }
  setBlendFunc(src, dst, srcAlpha, dstAlpha) {
    if (this.state.blendFunc.src === src && this.state.blendFunc.dst === dst && this.state.blendFunc.srcAlpha === srcAlpha && this.state.blendFunc.dstAlpha === dstAlpha)
      return;
    this.state.blendFunc.src = src;
    this.state.blendFunc.dst = dst;
    this.state.blendFunc.srcAlpha = srcAlpha;
    this.state.blendFunc.dstAlpha = dstAlpha;
    if (srcAlpha !== undefined)
      this.gl.blendFuncSeparate(src, dst, srcAlpha, dstAlpha);
    else
      this.gl.blendFunc(src, dst);
  }
  setBlendEquation(modeRGB, modeAlpha) {
    modeRGB = modeRGB || this.gl.FUNC_ADD;
    if (this.state.blendEquation.modeRGB === modeRGB && this.state.blendEquation.modeAlpha === modeAlpha)
      return;
    this.state.blendEquation.modeRGB = modeRGB;
    this.state.blendEquation.modeAlpha = modeAlpha;
    if (modeAlpha !== undefined)
      this.gl.blendEquationSeparate(modeRGB, modeAlpha);
    else
      this.gl.blendEquation(modeRGB);
  }
  setCullFace(value) {
    if (this.state.cullFace === value)
      return;
    this.state.cullFace = value;
    this.gl.cullFace(value);
  }
  setFrontFace(value) {
    if (this.state.frontFace === value)
      return;
    this.state.frontFace = value;
    this.gl.frontFace(value);
  }
  setDepthMask(value) {
    if (this.state.depthMask === value)
      return;
    this.state.depthMask = value;
    this.gl.depthMask(value);
  }
  setDepthFunc(value) {
    if (this.state.depthFunc === value)
      return;
    this.state.depthFunc = value;
    this.gl.depthFunc(value);
  }
  setStencilMask(value) {
    if (this.state.stencilMask === value)
      return;
    this.state.stencilMask = value;
    this.gl.stencilMask(value);
  }
  setStencilFunc(func, ref, mask) {
    if (this.state.stencilFunc === func && this.state.stencilRef === ref && this.state.stencilFuncMask === mask)
      return;
    this.state.stencilFunc = func || this.gl.ALWAYS;
    this.state.stencilRef = ref || 0;
    this.state.stencilFuncMask = mask || 0;
    this.gl.stencilFunc(func || this.gl.ALWAYS, ref || 0, mask || 0);
  }
  setStencilOp(stencilFail, depthFail, depthPass) {
    if (this.state.stencilFail === stencilFail && this.state.stencilDepthFail === depthFail && this.state.stencilDepthPass === depthPass)
      return;
    this.state.stencilFail = stencilFail;
    this.state.stencilDepthFail = depthFail;
    this.state.stencilDepthPass = depthPass;
    this.gl.stencilOp(stencilFail, depthFail, depthPass);
  }
  activeTexture(value) {
    if (this.state.activeTextureUnit === value)
      return;
    this.state.activeTextureUnit = value;
    this.gl.activeTexture(this.gl.TEXTURE0 + value);
  }
  bindFramebuffer({ target = this.gl.FRAMEBUFFER, buffer = null } = {}) {
    if (this.state.framebuffer === buffer)
      return;
    this.state.framebuffer = buffer;
    this.gl.bindFramebuffer(target, buffer);
  }
  getExtension(extension, webgl2Func, extFunc) {
    if (webgl2Func && this.gl[webgl2Func])
      return this.gl[webgl2Func].bind(this.gl);
    if (!this.extensions[extension]) {
      this.extensions[extension] = this.gl.getExtension(extension);
    }
    if (!webgl2Func)
      return this.extensions[extension];
    if (!this.extensions[extension])
      return null;
    return this.extensions[extension][extFunc].bind(this.extensions[extension]);
  }
  sortOpaque(a, b) {
    if (a.renderOrder !== b.renderOrder) {
      return a.renderOrder - b.renderOrder;
    } else if (a.program.id !== b.program.id) {
      return a.program.id - b.program.id;
    } else if (a.zDepth !== b.zDepth) {
      return a.zDepth - b.zDepth;
    } else {
      return b.id - a.id;
    }
  }
  sortTransparent(a, b) {
    if (a.renderOrder !== b.renderOrder) {
      return a.renderOrder - b.renderOrder;
    }
    if (a.zDepth !== b.zDepth) {
      return b.zDepth - a.zDepth;
    } else {
      return b.id - a.id;
    }
  }
  sortUI(a, b) {
    if (a.renderOrder !== b.renderOrder) {
      return a.renderOrder - b.renderOrder;
    } else if (a.program.id !== b.program.id) {
      return a.program.id - b.program.id;
    } else {
      return b.id - a.id;
    }
  }
  getRenderList({ scene, camera, frustumCull, sort }) {
    let renderList = [];
    if (camera && frustumCull)
      camera.updateFrustum();
    scene.traverse((node) => {
      if (!node.visible)
        return true;
      if (!node.draw)
        return;
      if (frustumCull && node.frustumCulled && camera) {
        if (!camera.frustumIntersectsMesh(node))
          return;
      }
      renderList.push(node);
    });
    if (sort) {
      const opaque = [];
      const transparent = [];
      const ui = [];
      renderList.forEach((node) => {
        if (!node.program.transparent) {
          opaque.push(node);
        } else if (node.program.depthTest) {
          transparent.push(node);
        } else {
          ui.push(node);
        }
        node.zDepth = 0;
        if (node.renderOrder !== 0 || !node.program.depthTest || !camera)
          return;
        node.worldMatrix.getTranslation(tempVec3);
        tempVec3.applyMatrix4(camera.projectionViewMatrix);
        node.zDepth = tempVec3.z;
      });
      opaque.sort(this.sortOpaque);
      transparent.sort(this.sortTransparent);
      ui.sort(this.sortUI);
      renderList = opaque.concat(transparent, ui);
    }
    return renderList;
  }
  render({ scene, camera, target = null, update = true, sort = true, frustumCull = true, clear }) {
    if (target === null) {
      this.bindFramebuffer();
      this.setViewport(this.width * this.dpr, this.height * this.dpr);
    } else {
      this.bindFramebuffer(target);
      this.setViewport(target.width, target.height);
    }
    if (clear || this.autoClear && clear !== false) {
      if (this.depth && (!target || target.depth)) {
        this.enable(this.gl.DEPTH_TEST);
        this.setDepthMask(true);
      }
      if (this.stencil || (!target || target.stencil)) {
        this.enable(this.gl.STENCIL_TEST);
        this.setStencilMask(255);
      }
      this.gl.clear((this.color ? this.gl.COLOR_BUFFER_BIT : 0) | (this.depth ? this.gl.DEPTH_BUFFER_BIT : 0) | (this.stencil ? this.gl.STENCIL_BUFFER_BIT : 0));
    }
    if (update)
      scene.updateMatrixWorld();
    if (camera)
      camera.updateMatrixWorld();
    const renderList = this.getRenderList({ scene, camera, frustumCull, sort });
    renderList.forEach((node) => {
      node.draw({ camera });
    });
  }
}
// node_modules/ogl/src/math/functions/Vec4Func.js
function copy2(out, a) {
  out[0] = a[0];
  out[1] = a[1];
  out[2] = a[2];
  out[3] = a[3];
  return out;
}
function set2(out, x, y, z, w) {
  out[0] = x;
  out[1] = y;
  out[2] = z;
  out[3] = w;
  return out;
}
function normalize2(out, a) {
  let x = a[0];
  let y = a[1];
  let z = a[2];
  let w = a[3];
  let len = x * x + y * y + z * z + w * w;
  if (len > 0) {
    len = 1 / Math.sqrt(len);
  }
  out[0] = x * len;
  out[1] = y * len;
  out[2] = z * len;
  out[3] = w * len;
  return out;
}
function dot2(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
}

// node_modules/ogl/src/math/functions/QuatFunc.js
function identity(out) {
  out[0] = 0;
  out[1] = 0;
  out[2] = 0;
  out[3] = 1;
  return out;
}
function setAxisAngle(out, axis, rad) {
  rad = rad * 0.5;
  let s = Math.sin(rad);
  out[0] = s * axis[0];
  out[1] = s * axis[1];
  out[2] = s * axis[2];
  out[3] = Math.cos(rad);
  return out;
}
function multiply2(out, a, b) {
  let ax = a[0], ay = a[1], az = a[2], aw = a[3];
  let bx = b[0], by = b[1], bz = b[2], bw = b[3];
  out[0] = ax * bw + aw * bx + ay * bz - az * by;
  out[1] = ay * bw + aw * by + az * bx - ax * bz;
  out[2] = az * bw + aw * bz + ax * by - ay * bx;
  out[3] = aw * bw - ax * bx - ay * by - az * bz;
  return out;
}
function rotateX(out, a, rad) {
  rad *= 0.5;
  let ax = a[0], ay = a[1], az = a[2], aw = a[3];
  let bx = Math.sin(rad), bw = Math.cos(rad);
  out[0] = ax * bw + aw * bx;
  out[1] = ay * bw + az * bx;
  out[2] = az * bw - ay * bx;
  out[3] = aw * bw - ax * bx;
  return out;
}
function rotateY(out, a, rad) {
  rad *= 0.5;
  let ax = a[0], ay = a[1], az = a[2], aw = a[3];
  let by = Math.sin(rad), bw = Math.cos(rad);
  out[0] = ax * bw - az * by;
  out[1] = ay * bw + aw * by;
  out[2] = az * bw + ax * by;
  out[3] = aw * bw - ay * by;
  return out;
}
function rotateZ(out, a, rad) {
  rad *= 0.5;
  let ax = a[0], ay = a[1], az = a[2], aw = a[3];
  let bz = Math.sin(rad), bw = Math.cos(rad);
  out[0] = ax * bw + ay * bz;
  out[1] = ay * bw - ax * bz;
  out[2] = az * bw + aw * bz;
  out[3] = aw * bw - az * bz;
  return out;
}
function slerp(out, a, b, t) {
  let ax = a[0], ay = a[1], az = a[2], aw = a[3];
  let bx = b[0], by = b[1], bz = b[2], bw = b[3];
  let omega, cosom, sinom, scale0, scale1;
  cosom = ax * bx + ay * by + az * bz + aw * bw;
  if (cosom < 0) {
    cosom = -cosom;
    bx = -bx;
    by = -by;
    bz = -bz;
    bw = -bw;
  }
  if (1 - cosom > 0.000001) {
    omega = Math.acos(cosom);
    sinom = Math.sin(omega);
    scale0 = Math.sin((1 - t) * omega) / sinom;
    scale1 = Math.sin(t * omega) / sinom;
  } else {
    scale0 = 1 - t;
    scale1 = t;
  }
  out[0] = scale0 * ax + scale1 * bx;
  out[1] = scale0 * ay + scale1 * by;
  out[2] = scale0 * az + scale1 * bz;
  out[3] = scale0 * aw + scale1 * bw;
  return out;
}
function invert(out, a) {
  let a0 = a[0], a1 = a[1], a2 = a[2], a3 = a[3];
  let dot = a0 * a0 + a1 * a1 + a2 * a2 + a3 * a3;
  let invDot = dot ? 1 / dot : 0;
  out[0] = -a0 * invDot;
  out[1] = -a1 * invDot;
  out[2] = -a2 * invDot;
  out[3] = a3 * invDot;
  return out;
}
function conjugate(out, a) {
  out[0] = -a[0];
  out[1] = -a[1];
  out[2] = -a[2];
  out[3] = a[3];
  return out;
}
function fromMat3(out, m) {
  let fTrace = m[0] + m[4] + m[8];
  let fRoot;
  if (fTrace > 0) {
    fRoot = Math.sqrt(fTrace + 1);
    out[3] = 0.5 * fRoot;
    fRoot = 0.5 / fRoot;
    out[0] = (m[5] - m[7]) * fRoot;
    out[1] = (m[6] - m[2]) * fRoot;
    out[2] = (m[1] - m[3]) * fRoot;
  } else {
    let i = 0;
    if (m[4] > m[0])
      i = 1;
    if (m[8] > m[i * 3 + i])
      i = 2;
    let j = (i + 1) % 3;
    let k = (i + 2) % 3;
    fRoot = Math.sqrt(m[i * 3 + i] - m[j * 3 + j] - m[k * 3 + k] + 1);
    out[i] = 0.5 * fRoot;
    fRoot = 0.5 / fRoot;
    out[3] = (m[j * 3 + k] - m[k * 3 + j]) * fRoot;
    out[j] = (m[j * 3 + i] + m[i * 3 + j]) * fRoot;
    out[k] = (m[k * 3 + i] + m[i * 3 + k]) * fRoot;
  }
  return out;
}
function fromEuler(out, euler, order = "YXZ") {
  let sx = Math.sin(euler[0] * 0.5);
  let cx = Math.cos(euler[0] * 0.5);
  let sy = Math.sin(euler[1] * 0.5);
  let cy = Math.cos(euler[1] * 0.5);
  let sz = Math.sin(euler[2] * 0.5);
  let cz = Math.cos(euler[2] * 0.5);
  if (order === "XYZ") {
    out[0] = sx * cy * cz + cx * sy * sz;
    out[1] = cx * sy * cz - sx * cy * sz;
    out[2] = cx * cy * sz + sx * sy * cz;
    out[3] = cx * cy * cz - sx * sy * sz;
  } else if (order === "YXZ") {
    out[0] = sx * cy * cz + cx * sy * sz;
    out[1] = cx * sy * cz - sx * cy * sz;
    out[2] = cx * cy * sz - sx * sy * cz;
    out[3] = cx * cy * cz + sx * sy * sz;
  } else if (order === "ZXY") {
    out[0] = sx * cy * cz - cx * sy * sz;
    out[1] = cx * sy * cz + sx * cy * sz;
    out[2] = cx * cy * sz + sx * sy * cz;
    out[3] = cx * cy * cz - sx * sy * sz;
  } else if (order === "ZYX") {
    out[0] = sx * cy * cz - cx * sy * sz;
    out[1] = cx * sy * cz + sx * cy * sz;
    out[2] = cx * cy * sz - sx * sy * cz;
    out[3] = cx * cy * cz + sx * sy * sz;
  } else if (order === "YZX") {
    out[0] = sx * cy * cz + cx * sy * sz;
    out[1] = cx * sy * cz + sx * cy * sz;
    out[2] = cx * cy * sz - sx * sy * cz;
    out[3] = cx * cy * cz - sx * sy * sz;
  } else if (order === "XZY") {
    out[0] = sx * cy * cz - cx * sy * sz;
    out[1] = cx * sy * cz - sx * cy * sz;
    out[2] = cx * cy * sz + sx * sy * cz;
    out[3] = cx * cy * cz + sx * sy * sz;
  }
  return out;
}
var copy3 = copy2;
var set3 = set2;
var dot3 = dot2;
var normalize3 = normalize2;

// node_modules/ogl/src/math/Quat.js
class Quat extends Array {
  constructor(x = 0, y = 0, z = 0, w = 1) {
    super(x, y, z, w);
    this.onChange = () => {};
    this._target = this;
    const triggerProps = ["0", "1", "2", "3"];
    return new Proxy(this, {
      set(target, property) {
        const success = Reflect.set(...arguments);
        if (success && triggerProps.includes(property))
          target.onChange();
        return success;
      }
    });
  }
  get x() {
    return this[0];
  }
  get y() {
    return this[1];
  }
  get z() {
    return this[2];
  }
  get w() {
    return this[3];
  }
  set x(v) {
    this._target[0] = v;
    this.onChange();
  }
  set y(v) {
    this._target[1] = v;
    this.onChange();
  }
  set z(v) {
    this._target[2] = v;
    this.onChange();
  }
  set w(v) {
    this._target[3] = v;
    this.onChange();
  }
  identity() {
    identity(this._target);
    this.onChange();
    return this;
  }
  set(x, y, z, w) {
    if (x.length)
      return this.copy(x);
    set3(this._target, x, y, z, w);
    this.onChange();
    return this;
  }
  rotateX(a) {
    rotateX(this._target, this._target, a);
    this.onChange();
    return this;
  }
  rotateY(a) {
    rotateY(this._target, this._target, a);
    this.onChange();
    return this;
  }
  rotateZ(a) {
    rotateZ(this._target, this._target, a);
    this.onChange();
    return this;
  }
  inverse(q = this._target) {
    invert(this._target, q);
    this.onChange();
    return this;
  }
  conjugate(q = this._target) {
    conjugate(this._target, q);
    this.onChange();
    return this;
  }
  copy(q) {
    copy3(this._target, q);
    this.onChange();
    return this;
  }
  normalize(q = this._target) {
    normalize3(this._target, q);
    this.onChange();
    return this;
  }
  multiply(qA, qB) {
    if (qB) {
      multiply2(this._target, qA, qB);
    } else {
      multiply2(this._target, this._target, qA);
    }
    this.onChange();
    return this;
  }
  dot(v) {
    return dot3(this._target, v);
  }
  fromMatrix3(matrix3) {
    fromMat3(this._target, matrix3);
    this.onChange();
    return this;
  }
  fromEuler(euler, isInternal) {
    fromEuler(this._target, euler, euler.order);
    if (!isInternal)
      this.onChange();
    return this;
  }
  fromAxisAngle(axis, a) {
    setAxisAngle(this._target, axis, a);
    this.onChange();
    return this;
  }
  slerp(q, t) {
    slerp(this._target, this._target, q, t);
    this.onChange();
    return this;
  }
  fromArray(a, o = 0) {
    this._target[0] = a[o];
    this._target[1] = a[o + 1];
    this._target[2] = a[o + 2];
    this._target[3] = a[o + 3];
    this.onChange();
    return this;
  }
  toArray(a = [], o = 0) {
    a[o] = this[0];
    a[o + 1] = this[1];
    a[o + 2] = this[2];
    a[o + 3] = this[3];
    return a;
  }
}

// node_modules/ogl/src/math/functions/Mat4Func.js
var EPSILON = 0.000001;
function copy4(out, a) {
  out[0] = a[0];
  out[1] = a[1];
  out[2] = a[2];
  out[3] = a[3];
  out[4] = a[4];
  out[5] = a[5];
  out[6] = a[6];
  out[7] = a[7];
  out[8] = a[8];
  out[9] = a[9];
  out[10] = a[10];
  out[11] = a[11];
  out[12] = a[12];
  out[13] = a[13];
  out[14] = a[14];
  out[15] = a[15];
  return out;
}
function set4(out, m00, m01, m02, m03, m10, m11, m12, m13, m20, m21, m22, m23, m30, m31, m32, m33) {
  out[0] = m00;
  out[1] = m01;
  out[2] = m02;
  out[3] = m03;
  out[4] = m10;
  out[5] = m11;
  out[6] = m12;
  out[7] = m13;
  out[8] = m20;
  out[9] = m21;
  out[10] = m22;
  out[11] = m23;
  out[12] = m30;
  out[13] = m31;
  out[14] = m32;
  out[15] = m33;
  return out;
}
function identity2(out) {
  out[0] = 1;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = 1;
  out[6] = 0;
  out[7] = 0;
  out[8] = 0;
  out[9] = 0;
  out[10] = 1;
  out[11] = 0;
  out[12] = 0;
  out[13] = 0;
  out[14] = 0;
  out[15] = 1;
  return out;
}
function invert2(out, a) {
  let a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  let a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  let a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  let a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
  let b00 = a00 * a11 - a01 * a10;
  let b01 = a00 * a12 - a02 * a10;
  let b02 = a00 * a13 - a03 * a10;
  let b03 = a01 * a12 - a02 * a11;
  let b04 = a01 * a13 - a03 * a11;
  let b05 = a02 * a13 - a03 * a12;
  let b06 = a20 * a31 - a21 * a30;
  let b07 = a20 * a32 - a22 * a30;
  let b08 = a20 * a33 - a23 * a30;
  let b09 = a21 * a32 - a22 * a31;
  let b10 = a21 * a33 - a23 * a31;
  let b11 = a22 * a33 - a23 * a32;
  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) {
    return null;
  }
  det = 1 / det;
  out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
  out[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
  out[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
  out[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
  out[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
  out[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
  out[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
  out[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
  out[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
  out[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
  out[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
  out[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
  out[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det;
  out[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
  out[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det;
  out[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
  return out;
}
function determinant(a) {
  let a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  let a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  let a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  let a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
  let b00 = a00 * a11 - a01 * a10;
  let b01 = a00 * a12 - a02 * a10;
  let b02 = a00 * a13 - a03 * a10;
  let b03 = a01 * a12 - a02 * a11;
  let b04 = a01 * a13 - a03 * a11;
  let b05 = a02 * a13 - a03 * a12;
  let b06 = a20 * a31 - a21 * a30;
  let b07 = a20 * a32 - a22 * a30;
  let b08 = a20 * a33 - a23 * a30;
  let b09 = a21 * a32 - a22 * a31;
  let b10 = a21 * a33 - a23 * a31;
  let b11 = a22 * a33 - a23 * a32;
  return b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
}
function multiply3(out, a, b) {
  let a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  let a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  let a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  let a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
  let b0 = b[0], b1 = b[1], b2 = b[2], b3 = b[3];
  out[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  b0 = b[4];
  b1 = b[5];
  b2 = b[6];
  b3 = b[7];
  out[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  b0 = b[8];
  b1 = b[9];
  b2 = b[10];
  b3 = b[11];
  out[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  b0 = b[12];
  b1 = b[13];
  b2 = b[14];
  b3 = b[15];
  out[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  out[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  out[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  out[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  return out;
}
function translate(out, a, v) {
  let x = v[0], y = v[1], z = v[2];
  let a00, a01, a02, a03;
  let a10, a11, a12, a13;
  let a20, a21, a22, a23;
  if (a === out) {
    out[12] = a[0] * x + a[4] * y + a[8] * z + a[12];
    out[13] = a[1] * x + a[5] * y + a[9] * z + a[13];
    out[14] = a[2] * x + a[6] * y + a[10] * z + a[14];
    out[15] = a[3] * x + a[7] * y + a[11] * z + a[15];
  } else {
    a00 = a[0];
    a01 = a[1];
    a02 = a[2];
    a03 = a[3];
    a10 = a[4];
    a11 = a[5];
    a12 = a[6];
    a13 = a[7];
    a20 = a[8];
    a21 = a[9];
    a22 = a[10];
    a23 = a[11];
    out[0] = a00;
    out[1] = a01;
    out[2] = a02;
    out[3] = a03;
    out[4] = a10;
    out[5] = a11;
    out[6] = a12;
    out[7] = a13;
    out[8] = a20;
    out[9] = a21;
    out[10] = a22;
    out[11] = a23;
    out[12] = a00 * x + a10 * y + a20 * z + a[12];
    out[13] = a01 * x + a11 * y + a21 * z + a[13];
    out[14] = a02 * x + a12 * y + a22 * z + a[14];
    out[15] = a03 * x + a13 * y + a23 * z + a[15];
  }
  return out;
}
function scale3(out, a, v) {
  let x = v[0], y = v[1], z = v[2];
  out[0] = a[0] * x;
  out[1] = a[1] * x;
  out[2] = a[2] * x;
  out[3] = a[3] * x;
  out[4] = a[4] * y;
  out[5] = a[5] * y;
  out[6] = a[6] * y;
  out[7] = a[7] * y;
  out[8] = a[8] * z;
  out[9] = a[9] * z;
  out[10] = a[10] * z;
  out[11] = a[11] * z;
  out[12] = a[12];
  out[13] = a[13];
  out[14] = a[14];
  out[15] = a[15];
  return out;
}
function rotate(out, a, rad, axis) {
  let x = axis[0], y = axis[1], z = axis[2];
  let len = Math.hypot(x, y, z);
  let s, c, t;
  let a00, a01, a02, a03;
  let a10, a11, a12, a13;
  let a20, a21, a22, a23;
  let b00, b01, b02;
  let b10, b11, b12;
  let b20, b21, b22;
  if (Math.abs(len) < EPSILON) {
    return null;
  }
  len = 1 / len;
  x *= len;
  y *= len;
  z *= len;
  s = Math.sin(rad);
  c = Math.cos(rad);
  t = 1 - c;
  a00 = a[0];
  a01 = a[1];
  a02 = a[2];
  a03 = a[3];
  a10 = a[4];
  a11 = a[5];
  a12 = a[6];
  a13 = a[7];
  a20 = a[8];
  a21 = a[9];
  a22 = a[10];
  a23 = a[11];
  b00 = x * x * t + c;
  b01 = y * x * t + z * s;
  b02 = z * x * t - y * s;
  b10 = x * y * t - z * s;
  b11 = y * y * t + c;
  b12 = z * y * t + x * s;
  b20 = x * z * t + y * s;
  b21 = y * z * t - x * s;
  b22 = z * z * t + c;
  out[0] = a00 * b00 + a10 * b01 + a20 * b02;
  out[1] = a01 * b00 + a11 * b01 + a21 * b02;
  out[2] = a02 * b00 + a12 * b01 + a22 * b02;
  out[3] = a03 * b00 + a13 * b01 + a23 * b02;
  out[4] = a00 * b10 + a10 * b11 + a20 * b12;
  out[5] = a01 * b10 + a11 * b11 + a21 * b12;
  out[6] = a02 * b10 + a12 * b11 + a22 * b12;
  out[7] = a03 * b10 + a13 * b11 + a23 * b12;
  out[8] = a00 * b20 + a10 * b21 + a20 * b22;
  out[9] = a01 * b20 + a11 * b21 + a21 * b22;
  out[10] = a02 * b20 + a12 * b21 + a22 * b22;
  out[11] = a03 * b20 + a13 * b21 + a23 * b22;
  if (a !== out) {
    out[12] = a[12];
    out[13] = a[13];
    out[14] = a[14];
    out[15] = a[15];
  }
  return out;
}
function getTranslation(out, mat) {
  out[0] = mat[12];
  out[1] = mat[13];
  out[2] = mat[14];
  return out;
}
function getScaling(out, mat) {
  let m11 = mat[0];
  let m12 = mat[1];
  let m13 = mat[2];
  let m21 = mat[4];
  let m22 = mat[5];
  let m23 = mat[6];
  let m31 = mat[8];
  let m32 = mat[9];
  let m33 = mat[10];
  out[0] = Math.hypot(m11, m12, m13);
  out[1] = Math.hypot(m21, m22, m23);
  out[2] = Math.hypot(m31, m32, m33);
  return out;
}
function getMaxScaleOnAxis(mat) {
  let m11 = mat[0];
  let m12 = mat[1];
  let m13 = mat[2];
  let m21 = mat[4];
  let m22 = mat[5];
  let m23 = mat[6];
  let m31 = mat[8];
  let m32 = mat[9];
  let m33 = mat[10];
  const x = m11 * m11 + m12 * m12 + m13 * m13;
  const y = m21 * m21 + m22 * m22 + m23 * m23;
  const z = m31 * m31 + m32 * m32 + m33 * m33;
  return Math.sqrt(Math.max(x, y, z));
}
var getRotation = function() {
  const temp = [1, 1, 1];
  return function(out, mat) {
    let scaling = temp;
    getScaling(scaling, mat);
    let is1 = 1 / scaling[0];
    let is2 = 1 / scaling[1];
    let is3 = 1 / scaling[2];
    let sm11 = mat[0] * is1;
    let sm12 = mat[1] * is2;
    let sm13 = mat[2] * is3;
    let sm21 = mat[4] * is1;
    let sm22 = mat[5] * is2;
    let sm23 = mat[6] * is3;
    let sm31 = mat[8] * is1;
    let sm32 = mat[9] * is2;
    let sm33 = mat[10] * is3;
    let trace = sm11 + sm22 + sm33;
    let S = 0;
    if (trace > 0) {
      S = Math.sqrt(trace + 1) * 2;
      out[3] = 0.25 * S;
      out[0] = (sm23 - sm32) / S;
      out[1] = (sm31 - sm13) / S;
      out[2] = (sm12 - sm21) / S;
    } else if (sm11 > sm22 && sm11 > sm33) {
      S = Math.sqrt(1 + sm11 - sm22 - sm33) * 2;
      out[3] = (sm23 - sm32) / S;
      out[0] = 0.25 * S;
      out[1] = (sm12 + sm21) / S;
      out[2] = (sm31 + sm13) / S;
    } else if (sm22 > sm33) {
      S = Math.sqrt(1 + sm22 - sm11 - sm33) * 2;
      out[3] = (sm31 - sm13) / S;
      out[0] = (sm12 + sm21) / S;
      out[1] = 0.25 * S;
      out[2] = (sm23 + sm32) / S;
    } else {
      S = Math.sqrt(1 + sm33 - sm11 - sm22) * 2;
      out[3] = (sm12 - sm21) / S;
      out[0] = (sm31 + sm13) / S;
      out[1] = (sm23 + sm32) / S;
      out[2] = 0.25 * S;
    }
    return out;
  };
}();
function decompose(srcMat, dstRotation, dstTranslation, dstScale) {
  let sx = length([srcMat[0], srcMat[1], srcMat[2]]);
  const sy = length([srcMat[4], srcMat[5], srcMat[6]]);
  const sz = length([srcMat[8], srcMat[9], srcMat[10]]);
  const det = determinant(srcMat);
  if (det < 0)
    sx = -sx;
  dstTranslation[0] = srcMat[12];
  dstTranslation[1] = srcMat[13];
  dstTranslation[2] = srcMat[14];
  const _m1 = srcMat.slice();
  const invSX = 1 / sx;
  const invSY = 1 / sy;
  const invSZ = 1 / sz;
  _m1[0] *= invSX;
  _m1[1] *= invSX;
  _m1[2] *= invSX;
  _m1[4] *= invSY;
  _m1[5] *= invSY;
  _m1[6] *= invSY;
  _m1[8] *= invSZ;
  _m1[9] *= invSZ;
  _m1[10] *= invSZ;
  getRotation(dstRotation, _m1);
  dstScale[0] = sx;
  dstScale[1] = sy;
  dstScale[2] = sz;
}
function compose(dstMat, srcRotation, srcTranslation, srcScale) {
  const te = dstMat;
  const x = srcRotation[0], y = srcRotation[1], z = srcRotation[2], w = srcRotation[3];
  const x2 = x + x, y2 = y + y, z2 = z + z;
  const xx = x * x2, xy = x * y2, xz = x * z2;
  const yy = y * y2, yz = y * z2, zz = z * z2;
  const wx = w * x2, wy = w * y2, wz = w * z2;
  const sx = srcScale[0], sy = srcScale[1], sz = srcScale[2];
  te[0] = (1 - (yy + zz)) * sx;
  te[1] = (xy + wz) * sx;
  te[2] = (xz - wy) * sx;
  te[3] = 0;
  te[4] = (xy - wz) * sy;
  te[5] = (1 - (xx + zz)) * sy;
  te[6] = (yz + wx) * sy;
  te[7] = 0;
  te[8] = (xz + wy) * sz;
  te[9] = (yz - wx) * sz;
  te[10] = (1 - (xx + yy)) * sz;
  te[11] = 0;
  te[12] = srcTranslation[0];
  te[13] = srcTranslation[1];
  te[14] = srcTranslation[2];
  te[15] = 1;
  return te;
}
function fromQuat(out, q) {
  let x = q[0], y = q[1], z = q[2], w = q[3];
  let x2 = x + x;
  let y2 = y + y;
  let z2 = z + z;
  let xx = x * x2;
  let yx = y * x2;
  let yy = y * y2;
  let zx = z * x2;
  let zy = z * y2;
  let zz = z * z2;
  let wx = w * x2;
  let wy = w * y2;
  let wz = w * z2;
  out[0] = 1 - yy - zz;
  out[1] = yx + wz;
  out[2] = zx - wy;
  out[3] = 0;
  out[4] = yx - wz;
  out[5] = 1 - xx - zz;
  out[6] = zy + wx;
  out[7] = 0;
  out[8] = zx + wy;
  out[9] = zy - wx;
  out[10] = 1 - xx - yy;
  out[11] = 0;
  out[12] = 0;
  out[13] = 0;
  out[14] = 0;
  out[15] = 1;
  return out;
}
function perspective(out, fovy, aspect, near, far) {
  let f = 1 / Math.tan(fovy / 2);
  let nf = 1 / (near - far);
  out[0] = f / aspect;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = f;
  out[6] = 0;
  out[7] = 0;
  out[8] = 0;
  out[9] = 0;
  out[10] = (far + near) * nf;
  out[11] = -1;
  out[12] = 0;
  out[13] = 0;
  out[14] = 2 * far * near * nf;
  out[15] = 0;
  return out;
}
function ortho(out, left, right, bottom, top, near, far) {
  let lr = 1 / (left - right);
  let bt = 1 / (bottom - top);
  let nf = 1 / (near - far);
  out[0] = -2 * lr;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 0;
  out[5] = -2 * bt;
  out[6] = 0;
  out[7] = 0;
  out[8] = 0;
  out[9] = 0;
  out[10] = 2 * nf;
  out[11] = 0;
  out[12] = (left + right) * lr;
  out[13] = (top + bottom) * bt;
  out[14] = (far + near) * nf;
  out[15] = 1;
  return out;
}
function targetTo(out, eye, target, up) {
  let eyex = eye[0], eyey = eye[1], eyez = eye[2], upx = up[0], upy = up[1], upz = up[2];
  let z0 = eyex - target[0], z1 = eyey - target[1], z2 = eyez - target[2];
  let len = z0 * z0 + z1 * z1 + z2 * z2;
  if (len === 0) {
    z2 = 1;
  } else {
    len = 1 / Math.sqrt(len);
    z0 *= len;
    z1 *= len;
    z2 *= len;
  }
  let x0 = upy * z2 - upz * z1, x1 = upz * z0 - upx * z2, x2 = upx * z1 - upy * z0;
  len = x0 * x0 + x1 * x1 + x2 * x2;
  if (len === 0) {
    if (upz) {
      upx += 0.000001;
    } else if (upy) {
      upz += 0.000001;
    } else {
      upy += 0.000001;
    }
    x0 = upy * z2 - upz * z1, x1 = upz * z0 - upx * z2, x2 = upx * z1 - upy * z0;
    len = x0 * x0 + x1 * x1 + x2 * x2;
  }
  len = 1 / Math.sqrt(len);
  x0 *= len;
  x1 *= len;
  x2 *= len;
  out[0] = x0;
  out[1] = x1;
  out[2] = x2;
  out[3] = 0;
  out[4] = z1 * x2 - z2 * x1;
  out[5] = z2 * x0 - z0 * x2;
  out[6] = z0 * x1 - z1 * x0;
  out[7] = 0;
  out[8] = z0;
  out[9] = z1;
  out[10] = z2;
  out[11] = 0;
  out[12] = eyex;
  out[13] = eyey;
  out[14] = eyez;
  out[15] = 1;
  return out;
}
function add3(out, a, b) {
  out[0] = a[0] + b[0];
  out[1] = a[1] + b[1];
  out[2] = a[2] + b[2];
  out[3] = a[3] + b[3];
  out[4] = a[4] + b[4];
  out[5] = a[5] + b[5];
  out[6] = a[6] + b[6];
  out[7] = a[7] + b[7];
  out[8] = a[8] + b[8];
  out[9] = a[9] + b[9];
  out[10] = a[10] + b[10];
  out[11] = a[11] + b[11];
  out[12] = a[12] + b[12];
  out[13] = a[13] + b[13];
  out[14] = a[14] + b[14];
  out[15] = a[15] + b[15];
  return out;
}
function subtract2(out, a, b) {
  out[0] = a[0] - b[0];
  out[1] = a[1] - b[1];
  out[2] = a[2] - b[2];
  out[3] = a[3] - b[3];
  out[4] = a[4] - b[4];
  out[5] = a[5] - b[5];
  out[6] = a[6] - b[6];
  out[7] = a[7] - b[7];
  out[8] = a[8] - b[8];
  out[9] = a[9] - b[9];
  out[10] = a[10] - b[10];
  out[11] = a[11] - b[11];
  out[12] = a[12] - b[12];
  out[13] = a[13] - b[13];
  out[14] = a[14] - b[14];
  out[15] = a[15] - b[15];
  return out;
}
function multiplyScalar(out, a, b) {
  out[0] = a[0] * b;
  out[1] = a[1] * b;
  out[2] = a[2] * b;
  out[3] = a[3] * b;
  out[4] = a[4] * b;
  out[5] = a[5] * b;
  out[6] = a[6] * b;
  out[7] = a[7] * b;
  out[8] = a[8] * b;
  out[9] = a[9] * b;
  out[10] = a[10] * b;
  out[11] = a[11] * b;
  out[12] = a[12] * b;
  out[13] = a[13] * b;
  out[14] = a[14] * b;
  out[15] = a[15] * b;
  return out;
}

// node_modules/ogl/src/math/Mat4.js
class Mat4 extends Array {
  constructor(m00 = 1, m01 = 0, m02 = 0, m03 = 0, m10 = 0, m11 = 1, m12 = 0, m13 = 0, m20 = 0, m21 = 0, m22 = 1, m23 = 0, m30 = 0, m31 = 0, m32 = 0, m33 = 1) {
    super(m00, m01, m02, m03, m10, m11, m12, m13, m20, m21, m22, m23, m30, m31, m32, m33);
    return this;
  }
  get x() {
    return this[12];
  }
  get y() {
    return this[13];
  }
  get z() {
    return this[14];
  }
  get w() {
    return this[15];
  }
  set x(v) {
    this[12] = v;
  }
  set y(v) {
    this[13] = v;
  }
  set z(v) {
    this[14] = v;
  }
  set w(v) {
    this[15] = v;
  }
  set(m00, m01, m02, m03, m10, m11, m12, m13, m20, m21, m22, m23, m30, m31, m32, m33) {
    if (m00.length)
      return this.copy(m00);
    set4(this, m00, m01, m02, m03, m10, m11, m12, m13, m20, m21, m22, m23, m30, m31, m32, m33);
    return this;
  }
  translate(v, m = this) {
    translate(this, m, v);
    return this;
  }
  rotate(v, axis, m = this) {
    rotate(this, m, v, axis);
    return this;
  }
  scale(v, m = this) {
    scale3(this, m, typeof v === "number" ? [v, v, v] : v);
    return this;
  }
  add(ma, mb) {
    if (mb)
      add3(this, ma, mb);
    else
      add3(this, this, ma);
    return this;
  }
  sub(ma, mb) {
    if (mb)
      subtract2(this, ma, mb);
    else
      subtract2(this, this, ma);
    return this;
  }
  multiply(ma, mb) {
    if (!ma.length) {
      multiplyScalar(this, this, ma);
    } else if (mb) {
      multiply3(this, ma, mb);
    } else {
      multiply3(this, this, ma);
    }
    return this;
  }
  identity() {
    identity2(this);
    return this;
  }
  copy(m) {
    copy4(this, m);
    return this;
  }
  fromPerspective({ fov, aspect, near, far } = {}) {
    perspective(this, fov, aspect, near, far);
    return this;
  }
  fromOrthogonal({ left, right, bottom, top, near, far }) {
    ortho(this, left, right, bottom, top, near, far);
    return this;
  }
  fromQuaternion(q) {
    fromQuat(this, q);
    return this;
  }
  setPosition(v) {
    this.x = v[0];
    this.y = v[1];
    this.z = v[2];
    return this;
  }
  inverse(m = this) {
    invert2(this, m);
    return this;
  }
  compose(q, pos, scale) {
    compose(this, q, pos, scale);
    return this;
  }
  decompose(q, pos, scale) {
    decompose(this, q, pos, scale);
    return this;
  }
  getRotation(q) {
    getRotation(q, this);
    return this;
  }
  getTranslation(pos) {
    getTranslation(pos, this);
    return this;
  }
  getScaling(scale) {
    getScaling(scale, this);
    return this;
  }
  getMaxScaleOnAxis() {
    return getMaxScaleOnAxis(this);
  }
  lookAt(eye, target, up) {
    targetTo(this, eye, target, up);
    return this;
  }
  determinant() {
    return determinant(this);
  }
  fromArray(a, o = 0) {
    this[0] = a[o];
    this[1] = a[o + 1];
    this[2] = a[o + 2];
    this[3] = a[o + 3];
    this[4] = a[o + 4];
    this[5] = a[o + 5];
    this[6] = a[o + 6];
    this[7] = a[o + 7];
    this[8] = a[o + 8];
    this[9] = a[o + 9];
    this[10] = a[o + 10];
    this[11] = a[o + 11];
    this[12] = a[o + 12];
    this[13] = a[o + 13];
    this[14] = a[o + 14];
    this[15] = a[o + 15];
    return this;
  }
  toArray(a = [], o = 0) {
    a[o] = this[0];
    a[o + 1] = this[1];
    a[o + 2] = this[2];
    a[o + 3] = this[3];
    a[o + 4] = this[4];
    a[o + 5] = this[5];
    a[o + 6] = this[6];
    a[o + 7] = this[7];
    a[o + 8] = this[8];
    a[o + 9] = this[9];
    a[o + 10] = this[10];
    a[o + 11] = this[11];
    a[o + 12] = this[12];
    a[o + 13] = this[13];
    a[o + 14] = this[14];
    a[o + 15] = this[15];
    return a;
  }
}

// node_modules/ogl/src/math/functions/EulerFunc.js
function fromRotationMatrix(out, m, order = "YXZ") {
  if (order === "XYZ") {
    out[1] = Math.asin(Math.min(Math.max(m[8], -1), 1));
    if (Math.abs(m[8]) < 0.99999) {
      out[0] = Math.atan2(-m[9], m[10]);
      out[2] = Math.atan2(-m[4], m[0]);
    } else {
      out[0] = Math.atan2(m[6], m[5]);
      out[2] = 0;
    }
  } else if (order === "YXZ") {
    out[0] = Math.asin(-Math.min(Math.max(m[9], -1), 1));
    if (Math.abs(m[9]) < 0.99999) {
      out[1] = Math.atan2(m[8], m[10]);
      out[2] = Math.atan2(m[1], m[5]);
    } else {
      out[1] = Math.atan2(-m[2], m[0]);
      out[2] = 0;
    }
  } else if (order === "ZXY") {
    out[0] = Math.asin(Math.min(Math.max(m[6], -1), 1));
    if (Math.abs(m[6]) < 0.99999) {
      out[1] = Math.atan2(-m[2], m[10]);
      out[2] = Math.atan2(-m[4], m[5]);
    } else {
      out[1] = 0;
      out[2] = Math.atan2(m[1], m[0]);
    }
  } else if (order === "ZYX") {
    out[1] = Math.asin(-Math.min(Math.max(m[2], -1), 1));
    if (Math.abs(m[2]) < 0.99999) {
      out[0] = Math.atan2(m[6], m[10]);
      out[2] = Math.atan2(m[1], m[0]);
    } else {
      out[0] = 0;
      out[2] = Math.atan2(-m[4], m[5]);
    }
  } else if (order === "YZX") {
    out[2] = Math.asin(Math.min(Math.max(m[1], -1), 1));
    if (Math.abs(m[1]) < 0.99999) {
      out[0] = Math.atan2(-m[9], m[5]);
      out[1] = Math.atan2(-m[2], m[0]);
    } else {
      out[0] = 0;
      out[1] = Math.atan2(m[8], m[10]);
    }
  } else if (order === "XZY") {
    out[2] = Math.asin(-Math.min(Math.max(m[4], -1), 1));
    if (Math.abs(m[4]) < 0.99999) {
      out[0] = Math.atan2(m[6], m[5]);
      out[1] = Math.atan2(m[8], m[0]);
    } else {
      out[0] = Math.atan2(-m[9], m[10]);
      out[1] = 0;
    }
  }
  return out;
}

// node_modules/ogl/src/math/Euler.js
var tmpMat4 = /* @__PURE__ */ new Mat4;

class Euler extends Array {
  constructor(x = 0, y = x, z = x, order = "YXZ") {
    super(x, y, z);
    this.order = order;
    this.onChange = () => {};
    this._target = this;
    const triggerProps = ["0", "1", "2"];
    return new Proxy(this, {
      set(target, property) {
        const success = Reflect.set(...arguments);
        if (success && triggerProps.includes(property))
          target.onChange();
        return success;
      }
    });
  }
  get x() {
    return this[0];
  }
  get y() {
    return this[1];
  }
  get z() {
    return this[2];
  }
  set x(v) {
    this._target[0] = v;
    this.onChange();
  }
  set y(v) {
    this._target[1] = v;
    this.onChange();
  }
  set z(v) {
    this._target[2] = v;
    this.onChange();
  }
  set(x, y = x, z = x) {
    if (x.length)
      return this.copy(x);
    this._target[0] = x;
    this._target[1] = y;
    this._target[2] = z;
    this.onChange();
    return this;
  }
  copy(v) {
    this._target[0] = v[0];
    this._target[1] = v[1];
    this._target[2] = v[2];
    this.onChange();
    return this;
  }
  reorder(order) {
    this._target.order = order;
    this.onChange();
    return this;
  }
  fromRotationMatrix(m, order = this.order) {
    fromRotationMatrix(this._target, m, order);
    this.onChange();
    return this;
  }
  fromQuaternion(q, order = this.order, isInternal) {
    tmpMat4.fromQuaternion(q);
    this._target.fromRotationMatrix(tmpMat4, order);
    if (!isInternal)
      this.onChange();
    return this;
  }
  fromArray(a, o = 0) {
    this._target[0] = a[o];
    this._target[1] = a[o + 1];
    this._target[2] = a[o + 2];
    return this;
  }
  toArray(a = [], o = 0) {
    a[o] = this[0];
    a[o + 1] = this[1];
    a[o + 2] = this[2];
    return a;
  }
}

// node_modules/ogl/src/core/Transform.js
class Transform {
  constructor() {
    this.parent = null;
    this.children = [];
    this.visible = true;
    this.matrix = new Mat4;
    this.worldMatrix = new Mat4;
    this.matrixAutoUpdate = true;
    this.worldMatrixNeedsUpdate = false;
    this.position = new Vec3;
    this.quaternion = new Quat;
    this.scale = new Vec3(1);
    this.rotation = new Euler;
    this.up = new Vec3(0, 1, 0);
    this.rotation._target.onChange = () => this.quaternion.fromEuler(this.rotation, true);
    this.quaternion._target.onChange = () => this.rotation.fromQuaternion(this.quaternion, undefined, true);
  }
  setParent(parent, notifyParent = true) {
    if (this.parent && parent !== this.parent)
      this.parent.removeChild(this, false);
    this.parent = parent;
    if (notifyParent && parent)
      parent.addChild(this, false);
  }
  addChild(child, notifyChild = true) {
    if (!~this.children.indexOf(child))
      this.children.push(child);
    if (notifyChild)
      child.setParent(this, false);
  }
  removeChild(child, notifyChild = true) {
    if (!!~this.children.indexOf(child))
      this.children.splice(this.children.indexOf(child), 1);
    if (notifyChild)
      child.setParent(null, false);
  }
  updateMatrixWorld(force) {
    if (this.matrixAutoUpdate)
      this.updateMatrix();
    if (this.worldMatrixNeedsUpdate || force) {
      if (this.parent === null)
        this.worldMatrix.copy(this.matrix);
      else
        this.worldMatrix.multiply(this.parent.worldMatrix, this.matrix);
      this.worldMatrixNeedsUpdate = false;
      force = true;
    }
    for (let i = 0, l = this.children.length;i < l; i++) {
      this.children[i].updateMatrixWorld(force);
    }
  }
  updateMatrix() {
    this.matrix.compose(this.quaternion, this.position, this.scale);
    this.worldMatrixNeedsUpdate = true;
  }
  traverse(callback) {
    if (callback(this))
      return;
    for (let i = 0, l = this.children.length;i < l; i++) {
      this.children[i].traverse(callback);
    }
  }
  decompose() {
    this.matrix.decompose(this.quaternion._target, this.position, this.scale);
    this.rotation.fromQuaternion(this.quaternion);
  }
  lookAt(target, invert = false) {
    if (invert)
      this.matrix.lookAt(this.position, target, this.up);
    else
      this.matrix.lookAt(target, this.position, this.up);
    this.matrix.getRotation(this.quaternion._target);
    this.rotation.fromQuaternion(this.quaternion);
  }
}

// node_modules/ogl/src/math/functions/Mat3Func.js
function fromMat4(out, a) {
  out[0] = a[0];
  out[1] = a[1];
  out[2] = a[2];
  out[3] = a[4];
  out[4] = a[5];
  out[5] = a[6];
  out[6] = a[8];
  out[7] = a[9];
  out[8] = a[10];
  return out;
}
function fromQuat2(out, q) {
  let x = q[0], y = q[1], z = q[2], w = q[3];
  let x2 = x + x;
  let y2 = y + y;
  let z2 = z + z;
  let xx = x * x2;
  let yx = y * x2;
  let yy = y * y2;
  let zx = z * x2;
  let zy = z * y2;
  let zz = z * z2;
  let wx = w * x2;
  let wy = w * y2;
  let wz = w * z2;
  out[0] = 1 - yy - zz;
  out[3] = yx - wz;
  out[6] = zx + wy;
  out[1] = yx + wz;
  out[4] = 1 - xx - zz;
  out[7] = zy - wx;
  out[2] = zx - wy;
  out[5] = zy + wx;
  out[8] = 1 - xx - yy;
  return out;
}
function copy5(out, a) {
  out[0] = a[0];
  out[1] = a[1];
  out[2] = a[2];
  out[3] = a[3];
  out[4] = a[4];
  out[5] = a[5];
  out[6] = a[6];
  out[7] = a[7];
  out[8] = a[8];
  return out;
}
function set5(out, m00, m01, m02, m10, m11, m12, m20, m21, m22) {
  out[0] = m00;
  out[1] = m01;
  out[2] = m02;
  out[3] = m10;
  out[4] = m11;
  out[5] = m12;
  out[6] = m20;
  out[7] = m21;
  out[8] = m22;
  return out;
}
function identity3(out) {
  out[0] = 1;
  out[1] = 0;
  out[2] = 0;
  out[3] = 0;
  out[4] = 1;
  out[5] = 0;
  out[6] = 0;
  out[7] = 0;
  out[8] = 1;
  return out;
}
function invert3(out, a) {
  let a00 = a[0], a01 = a[1], a02 = a[2];
  let a10 = a[3], a11 = a[4], a12 = a[5];
  let a20 = a[6], a21 = a[7], a22 = a[8];
  let b01 = a22 * a11 - a12 * a21;
  let b11 = -a22 * a10 + a12 * a20;
  let b21 = a21 * a10 - a11 * a20;
  let det = a00 * b01 + a01 * b11 + a02 * b21;
  if (!det) {
    return null;
  }
  det = 1 / det;
  out[0] = b01 * det;
  out[1] = (-a22 * a01 + a02 * a21) * det;
  out[2] = (a12 * a01 - a02 * a11) * det;
  out[3] = b11 * det;
  out[4] = (a22 * a00 - a02 * a20) * det;
  out[5] = (-a12 * a00 + a02 * a10) * det;
  out[6] = b21 * det;
  out[7] = (-a21 * a00 + a01 * a20) * det;
  out[8] = (a11 * a00 - a01 * a10) * det;
  return out;
}
function multiply4(out, a, b) {
  let a00 = a[0], a01 = a[1], a02 = a[2];
  let a10 = a[3], a11 = a[4], a12 = a[5];
  let a20 = a[6], a21 = a[7], a22 = a[8];
  let b00 = b[0], b01 = b[1], b02 = b[2];
  let b10 = b[3], b11 = b[4], b12 = b[5];
  let b20 = b[6], b21 = b[7], b22 = b[8];
  out[0] = b00 * a00 + b01 * a10 + b02 * a20;
  out[1] = b00 * a01 + b01 * a11 + b02 * a21;
  out[2] = b00 * a02 + b01 * a12 + b02 * a22;
  out[3] = b10 * a00 + b11 * a10 + b12 * a20;
  out[4] = b10 * a01 + b11 * a11 + b12 * a21;
  out[5] = b10 * a02 + b11 * a12 + b12 * a22;
  out[6] = b20 * a00 + b21 * a10 + b22 * a20;
  out[7] = b20 * a01 + b21 * a11 + b22 * a21;
  out[8] = b20 * a02 + b21 * a12 + b22 * a22;
  return out;
}
function translate2(out, a, v) {
  let a00 = a[0], a01 = a[1], a02 = a[2], a10 = a[3], a11 = a[4], a12 = a[5], a20 = a[6], a21 = a[7], a22 = a[8], x = v[0], y = v[1];
  out[0] = a00;
  out[1] = a01;
  out[2] = a02;
  out[3] = a10;
  out[4] = a11;
  out[5] = a12;
  out[6] = x * a00 + y * a10 + a20;
  out[7] = x * a01 + y * a11 + a21;
  out[8] = x * a02 + y * a12 + a22;
  return out;
}
function rotate2(out, a, rad) {
  let a00 = a[0], a01 = a[1], a02 = a[2], a10 = a[3], a11 = a[4], a12 = a[5], a20 = a[6], a21 = a[7], a22 = a[8], s = Math.sin(rad), c = Math.cos(rad);
  out[0] = c * a00 + s * a10;
  out[1] = c * a01 + s * a11;
  out[2] = c * a02 + s * a12;
  out[3] = c * a10 - s * a00;
  out[4] = c * a11 - s * a01;
  out[5] = c * a12 - s * a02;
  out[6] = a20;
  out[7] = a21;
  out[8] = a22;
  return out;
}
function scale4(out, a, v) {
  let x = v[0], y = v[1];
  out[0] = x * a[0];
  out[1] = x * a[1];
  out[2] = x * a[2];
  out[3] = y * a[3];
  out[4] = y * a[4];
  out[5] = y * a[5];
  out[6] = a[6];
  out[7] = a[7];
  out[8] = a[8];
  return out;
}
function normalFromMat4(out, a) {
  let a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  let a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  let a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  let a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
  let b00 = a00 * a11 - a01 * a10;
  let b01 = a00 * a12 - a02 * a10;
  let b02 = a00 * a13 - a03 * a10;
  let b03 = a01 * a12 - a02 * a11;
  let b04 = a01 * a13 - a03 * a11;
  let b05 = a02 * a13 - a03 * a12;
  let b06 = a20 * a31 - a21 * a30;
  let b07 = a20 * a32 - a22 * a30;
  let b08 = a20 * a33 - a23 * a30;
  let b09 = a21 * a32 - a22 * a31;
  let b10 = a21 * a33 - a23 * a31;
  let b11 = a22 * a33 - a23 * a32;
  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
  if (!det) {
    return null;
  }
  det = 1 / det;
  out[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det;
  out[1] = (a12 * b08 - a10 * b11 - a13 * b07) * det;
  out[2] = (a10 * b10 - a11 * b08 + a13 * b06) * det;
  out[3] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
  out[4] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
  out[5] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
  out[6] = (a31 * b05 - a32 * b04 + a33 * b03) * det;
  out[7] = (a32 * b02 - a30 * b05 - a33 * b01) * det;
  out[8] = (a30 * b04 - a31 * b02 + a33 * b00) * det;
  return out;
}

// node_modules/ogl/src/math/Mat3.js
class Mat3 extends Array {
  constructor(m00 = 1, m01 = 0, m02 = 0, m10 = 0, m11 = 1, m12 = 0, m20 = 0, m21 = 0, m22 = 1) {
    super(m00, m01, m02, m10, m11, m12, m20, m21, m22);
    return this;
  }
  set(m00, m01, m02, m10, m11, m12, m20, m21, m22) {
    if (m00.length)
      return this.copy(m00);
    set5(this, m00, m01, m02, m10, m11, m12, m20, m21, m22);
    return this;
  }
  translate(v, m = this) {
    translate2(this, m, v);
    return this;
  }
  rotate(v, m = this) {
    rotate2(this, m, v);
    return this;
  }
  scale(v, m = this) {
    scale4(this, m, v);
    return this;
  }
  multiply(ma, mb) {
    if (mb) {
      multiply4(this, ma, mb);
    } else {
      multiply4(this, this, ma);
    }
    return this;
  }
  identity() {
    identity3(this);
    return this;
  }
  copy(m) {
    copy5(this, m);
    return this;
  }
  fromMatrix4(m) {
    fromMat4(this, m);
    return this;
  }
  fromQuaternion(q) {
    fromQuat2(this, q);
    return this;
  }
  fromBasis(vec3a, vec3b, vec3c) {
    this.set(vec3a[0], vec3a[1], vec3a[2], vec3b[0], vec3b[1], vec3b[2], vec3c[0], vec3c[1], vec3c[2]);
    return this;
  }
  inverse(m = this) {
    invert3(this, m);
    return this;
  }
  getNormalMatrix(m) {
    normalFromMat4(this, m);
    return this;
  }
}

// node_modules/ogl/src/core/Mesh.js
var ID3 = 0;

class Mesh extends Transform {
  constructor(gl, { geometry, program, mode = gl.TRIANGLES, frustumCulled = true, renderOrder = 0 } = {}) {
    super();
    if (!gl.canvas)
      console.error("gl not passed as first argument to Mesh");
    this.gl = gl;
    this.id = ID3++;
    this.geometry = geometry;
    this.program = program;
    this.mode = mode;
    this.frustumCulled = frustumCulled;
    this.renderOrder = renderOrder;
    this.modelViewMatrix = new Mat4;
    this.normalMatrix = new Mat3;
    this.beforeRenderCallbacks = [];
    this.afterRenderCallbacks = [];
  }
  onBeforeRender(f) {
    this.beforeRenderCallbacks.push(f);
    return this;
  }
  onAfterRender(f) {
    this.afterRenderCallbacks.push(f);
    return this;
  }
  draw({ camera } = {}) {
    if (camera) {
      if (!this.program.uniforms.modelMatrix) {
        Object.assign(this.program.uniforms, {
          modelMatrix: { value: null },
          viewMatrix: { value: null },
          modelViewMatrix: { value: null },
          normalMatrix: { value: null },
          projectionMatrix: { value: null },
          cameraPosition: { value: null }
        });
      }
      this.program.uniforms.projectionMatrix.value = camera.projectionMatrix;
      this.program.uniforms.cameraPosition.value = camera.worldPosition;
      this.program.uniforms.viewMatrix.value = camera.viewMatrix;
      this.modelViewMatrix.multiply(camera.viewMatrix, this.worldMatrix);
      this.normalMatrix.getNormalMatrix(this.modelViewMatrix);
      this.program.uniforms.modelMatrix.value = this.worldMatrix;
      this.program.uniforms.modelViewMatrix.value = this.modelViewMatrix;
      this.program.uniforms.normalMatrix.value = this.normalMatrix;
    }
    this.beforeRenderCallbacks.forEach((f) => f && f({ mesh: this, camera }));
    let flipFaces = this.program.cullFace && this.worldMatrix.determinant() < 0;
    this.program.use({ flipFaces });
    this.geometry.draw({ mode: this.mode, program: this.program });
    this.afterRenderCallbacks.forEach((f) => f && f({ mesh: this, camera }));
  }
}
// node_modules/ogl/src/core/Texture.js
var emptyPixel = new Uint8Array(4);
function isPowerOf2(value) {
  return (value & value - 1) === 0;
}
var ID4 = 1;

class Texture {
  constructor(gl, {
    image,
    target = gl.TEXTURE_2D,
    type = gl.UNSIGNED_BYTE,
    format = gl.RGBA,
    internalFormat = format,
    wrapS = gl.CLAMP_TO_EDGE,
    wrapT = gl.CLAMP_TO_EDGE,
    wrapR = gl.CLAMP_TO_EDGE,
    generateMipmaps = target === (gl.TEXTURE_2D || gl.TEXTURE_CUBE_MAP),
    minFilter = generateMipmaps ? gl.NEAREST_MIPMAP_LINEAR : gl.LINEAR,
    magFilter = gl.LINEAR,
    premultiplyAlpha = false,
    unpackAlignment = 4,
    flipY = target == (gl.TEXTURE_2D || gl.TEXTURE_3D) ? true : false,
    anisotropy = 0,
    level = 0,
    width,
    height = width,
    length = 1
  } = {}) {
    this.gl = gl;
    this.id = ID4++;
    this.image = image;
    this.target = target;
    this.type = type;
    this.format = format;
    this.internalFormat = internalFormat;
    this.minFilter = minFilter;
    this.magFilter = magFilter;
    this.wrapS = wrapS;
    this.wrapT = wrapT;
    this.wrapR = wrapR;
    this.generateMipmaps = generateMipmaps;
    this.premultiplyAlpha = premultiplyAlpha;
    this.unpackAlignment = unpackAlignment;
    this.flipY = flipY;
    this.anisotropy = Math.min(anisotropy, this.gl.renderer.parameters.maxAnisotropy);
    this.level = level;
    this.width = width;
    this.height = height;
    this.length = length;
    this.texture = this.gl.createTexture();
    this.store = {
      image: null
    };
    this.glState = this.gl.renderer.state;
    this.state = {};
    this.state.minFilter = this.gl.NEAREST_MIPMAP_LINEAR;
    this.state.magFilter = this.gl.LINEAR;
    this.state.wrapS = this.gl.REPEAT;
    this.state.wrapT = this.gl.REPEAT;
    this.state.anisotropy = 0;
  }
  bind() {
    if (this.glState.textureUnits[this.glState.activeTextureUnit] === this.id)
      return;
    this.gl.bindTexture(this.target, this.texture);
    this.glState.textureUnits[this.glState.activeTextureUnit] = this.id;
  }
  update(textureUnit = 0) {
    const needsUpdate = !(this.image === this.store.image && !this.needsUpdate);
    if (needsUpdate || this.glState.textureUnits[textureUnit] !== this.id) {
      this.gl.renderer.activeTexture(textureUnit);
      this.bind();
    }
    if (!needsUpdate)
      return;
    this.needsUpdate = false;
    if (this.flipY !== this.glState.flipY) {
      this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, this.flipY);
      this.glState.flipY = this.flipY;
    }
    if (this.premultiplyAlpha !== this.glState.premultiplyAlpha) {
      this.gl.pixelStorei(this.gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, this.premultiplyAlpha);
      this.glState.premultiplyAlpha = this.premultiplyAlpha;
    }
    if (this.unpackAlignment !== this.glState.unpackAlignment) {
      this.gl.pixelStorei(this.gl.UNPACK_ALIGNMENT, this.unpackAlignment);
      this.glState.unpackAlignment = this.unpackAlignment;
    }
    if (this.minFilter !== this.state.minFilter) {
      this.gl.texParameteri(this.target, this.gl.TEXTURE_MIN_FILTER, this.minFilter);
      this.state.minFilter = this.minFilter;
    }
    if (this.magFilter !== this.state.magFilter) {
      this.gl.texParameteri(this.target, this.gl.TEXTURE_MAG_FILTER, this.magFilter);
      this.state.magFilter = this.magFilter;
    }
    if (this.wrapS !== this.state.wrapS) {
      this.gl.texParameteri(this.target, this.gl.TEXTURE_WRAP_S, this.wrapS);
      this.state.wrapS = this.wrapS;
    }
    if (this.wrapT !== this.state.wrapT) {
      this.gl.texParameteri(this.target, this.gl.TEXTURE_WRAP_T, this.wrapT);
      this.state.wrapT = this.wrapT;
    }
    if (this.wrapR !== this.state.wrapR) {
      this.gl.texParameteri(this.target, this.gl.TEXTURE_WRAP_R, this.wrapR);
      this.state.wrapR = this.wrapR;
    }
    if (this.anisotropy && this.anisotropy !== this.state.anisotropy) {
      this.gl.texParameterf(this.target, this.gl.renderer.getExtension("EXT_texture_filter_anisotropic").TEXTURE_MAX_ANISOTROPY_EXT, this.anisotropy);
      this.state.anisotropy = this.anisotropy;
    }
    if (this.image) {
      if (this.image.width) {
        this.width = this.image.width;
        this.height = this.image.height;
      }
      if (this.target === this.gl.TEXTURE_CUBE_MAP) {
        for (let i = 0;i < 6; i++) {
          this.gl.texImage2D(this.gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, this.level, this.internalFormat, this.format, this.type, this.image[i]);
        }
      } else if (ArrayBuffer.isView(this.image)) {
        if (this.target === this.gl.TEXTURE_2D) {
          this.gl.texImage2D(this.target, this.level, this.internalFormat, this.width, this.height, 0, this.format, this.type, this.image);
        } else if (this.target === this.gl.TEXTURE_2D_ARRAY || this.target === this.gl.TEXTURE_3D) {
          this.gl.texImage3D(this.target, this.level, this.internalFormat, this.width, this.height, this.length, 0, this.format, this.type, this.image);
        }
      } else if (this.image.isCompressedTexture) {
        for (let level = 0;level < this.image.length; level++) {
          this.gl.compressedTexImage2D(this.target, level, this.internalFormat, this.image[level].width, this.image[level].height, 0, this.image[level].data);
        }
      } else {
        if (this.target === this.gl.TEXTURE_2D) {
          this.gl.texImage2D(this.target, this.level, this.internalFormat, this.format, this.type, this.image);
        } else {
          this.gl.texImage3D(this.target, this.level, this.internalFormat, this.width, this.height, this.length, 0, this.format, this.type, this.image);
        }
      }
      if (this.generateMipmaps) {
        if (!this.gl.renderer.isWebgl2 && (!isPowerOf2(this.image.width) || !isPowerOf2(this.image.height))) {
          this.generateMipmaps = false;
          this.wrapS = this.wrapT = this.gl.CLAMP_TO_EDGE;
          this.minFilter = this.gl.LINEAR;
        } else {
          this.gl.generateMipmap(this.target);
        }
      }
      this.onUpdate && this.onUpdate();
    } else {
      if (this.target === this.gl.TEXTURE_CUBE_MAP) {
        for (let i = 0;i < 6; i++) {
          this.gl.texImage2D(this.gl.TEXTURE_CUBE_MAP_POSITIVE_X + i, 0, this.gl.RGBA, 1, 1, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, emptyPixel);
        }
      } else if (this.width) {
        if (this.target === this.gl.TEXTURE_2D) {
          this.gl.texImage2D(this.target, this.level, this.internalFormat, this.width, this.height, 0, this.format, this.type, null);
        } else {
          this.gl.texImage3D(this.target, this.level, this.internalFormat, this.width, this.height, this.length, 0, this.format, this.type, null);
        }
      } else {
        this.gl.texImage2D(this.target, 0, this.gl.RGBA, 1, 1, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, emptyPixel);
      }
    }
    this.store.image = this.image;
  }
}
// node_modules/ogl/src/core/RenderTarget.js
class RenderTarget {
  constructor(gl, {
    width = gl.canvas.width,
    height = gl.canvas.height,
    target = gl.FRAMEBUFFER,
    color = 1,
    depth = true,
    stencil = false,
    depthTexture = false,
    wrapS = gl.CLAMP_TO_EDGE,
    wrapT = gl.CLAMP_TO_EDGE,
    wrapR = gl.CLAMP_TO_EDGE,
    minFilter = gl.LINEAR,
    magFilter = minFilter,
    type = gl.UNSIGNED_BYTE,
    format = gl.RGBA,
    internalFormat = format,
    unpackAlignment,
    premultiplyAlpha
  } = {}) {
    this.gl = gl;
    this.width = width;
    this.height = height;
    this.depth = depth;
    this.stencil = stencil;
    this.buffer = this.gl.createFramebuffer();
    this.target = target;
    this.gl.renderer.bindFramebuffer(this);
    this.textures = [];
    const drawBuffers = [];
    for (let i = 0;i < color; i++) {
      this.textures.push(new Texture(gl, {
        width,
        height,
        wrapS,
        wrapT,
        wrapR,
        minFilter,
        magFilter,
        type,
        format,
        internalFormat,
        unpackAlignment,
        premultiplyAlpha,
        flipY: false,
        generateMipmaps: false
      }));
      this.textures[i].update();
      this.gl.framebufferTexture2D(this.target, this.gl.COLOR_ATTACHMENT0 + i, this.gl.TEXTURE_2D, this.textures[i].texture, 0);
      drawBuffers.push(this.gl.COLOR_ATTACHMENT0 + i);
    }
    if (drawBuffers.length > 1)
      this.gl.renderer.drawBuffers(drawBuffers);
    this.texture = this.textures[0];
    if (depthTexture && (this.gl.renderer.isWebgl2 || this.gl.renderer.getExtension("WEBGL_depth_texture"))) {
      this.depthTexture = new Texture(gl, {
        width,
        height,
        minFilter: this.gl.NEAREST,
        magFilter: this.gl.NEAREST,
        format: this.stencil ? this.gl.DEPTH_STENCIL : this.gl.DEPTH_COMPONENT,
        internalFormat: gl.renderer.isWebgl2 ? this.stencil ? this.gl.DEPTH24_STENCIL8 : this.gl.DEPTH_COMPONENT16 : this.gl.DEPTH_COMPONENT,
        type: this.stencil ? this.gl.UNSIGNED_INT_24_8 : this.gl.UNSIGNED_INT
      });
      this.depthTexture.update();
      this.gl.framebufferTexture2D(this.target, this.stencil ? this.gl.DEPTH_STENCIL_ATTACHMENT : this.gl.DEPTH_ATTACHMENT, this.gl.TEXTURE_2D, this.depthTexture.texture, 0);
    } else {
      if (depth && !stencil) {
        this.depthBuffer = this.gl.createRenderbuffer();
        this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, this.depthBuffer);
        this.gl.renderbufferStorage(this.gl.RENDERBUFFER, this.gl.DEPTH_COMPONENT16, width, height);
        this.gl.framebufferRenderbuffer(this.target, this.gl.DEPTH_ATTACHMENT, this.gl.RENDERBUFFER, this.depthBuffer);
      }
      if (stencil && !depth) {
        this.stencilBuffer = this.gl.createRenderbuffer();
        this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, this.stencilBuffer);
        this.gl.renderbufferStorage(this.gl.RENDERBUFFER, this.gl.STENCIL_INDEX8, width, height);
        this.gl.framebufferRenderbuffer(this.target, this.gl.STENCIL_ATTACHMENT, this.gl.RENDERBUFFER, this.stencilBuffer);
      }
      if (depth && stencil) {
        this.depthStencilBuffer = this.gl.createRenderbuffer();
        this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, this.depthStencilBuffer);
        this.gl.renderbufferStorage(this.gl.RENDERBUFFER, this.gl.DEPTH_STENCIL, width, height);
        this.gl.framebufferRenderbuffer(this.target, this.gl.DEPTH_STENCIL_ATTACHMENT, this.gl.RENDERBUFFER, this.depthStencilBuffer);
      }
    }
    this.gl.renderer.bindFramebuffer({ target: this.target });
  }
  setSize(width, height) {
    if (this.width === width && this.height === height)
      return;
    this.width = width;
    this.height = height;
    this.gl.renderer.bindFramebuffer(this);
    for (let i = 0;i < this.textures.length; i++) {
      this.textures[i].width = width;
      this.textures[i].height = height;
      this.textures[i].needsUpdate = true;
      this.textures[i].update();
      this.gl.framebufferTexture2D(this.target, this.gl.COLOR_ATTACHMENT0 + i, this.gl.TEXTURE_2D, this.textures[i].texture, 0);
    }
    if (this.depthTexture) {
      this.depthTexture.width = width;
      this.depthTexture.height = height;
      this.depthTexture.needsUpdate = true;
      this.depthTexture.update();
      this.gl.framebufferTexture2D(this.target, this.gl.DEPTH_ATTACHMENT, this.gl.TEXTURE_2D, this.depthTexture.texture, 0);
    } else {
      if (this.depthBuffer) {
        this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, this.depthBuffer);
        this.gl.renderbufferStorage(this.gl.RENDERBUFFER, this.gl.DEPTH_COMPONENT16, width, height);
      }
      if (this.stencilBuffer) {
        this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, this.stencilBuffer);
        this.gl.renderbufferStorage(this.gl.RENDERBUFFER, this.gl.STENCIL_INDEX8, width, height);
      }
      if (this.depthStencilBuffer) {
        this.gl.bindRenderbuffer(this.gl.RENDERBUFFER, this.depthStencilBuffer);
        this.gl.renderbufferStorage(this.gl.RENDERBUFFER, this.gl.DEPTH_STENCIL, width, height);
      }
    }
    this.gl.renderer.bindFramebuffer({ target: this.target });
  }
}
// node_modules/ogl/src/core/Geometry.js
var tempVec32 = /* @__PURE__ */ new Vec3;
var ID5 = 1;
var ATTR_ID = 1;
var isBoundsWarned = false;

class Geometry {
  constructor(gl, attributes = {}) {
    if (!gl.canvas)
      console.error("gl not passed as first argument to Geometry");
    this.gl = gl;
    this.attributes = attributes;
    this.id = ID5++;
    this.VAOs = {};
    this.drawRange = { start: 0, count: 0 };
    this.instancedCount = 0;
    this.gl.renderer.bindVertexArray(null);
    this.gl.renderer.currentGeometry = null;
    this.glState = this.gl.renderer.state;
    for (let key in attributes) {
      this.addAttribute(key, attributes[key]);
    }
  }
  addAttribute(key, attr) {
    this.attributes[key] = attr;
    attr.id = ATTR_ID++;
    attr.size = attr.size || 1;
    attr.type = attr.type || (attr.data.constructor === Float32Array ? this.gl.FLOAT : attr.data.constructor === Uint16Array ? this.gl.UNSIGNED_SHORT : this.gl.UNSIGNED_INT);
    attr.target = key === "index" ? this.gl.ELEMENT_ARRAY_BUFFER : this.gl.ARRAY_BUFFER;
    attr.normalized = attr.normalized || false;
    attr.stride = attr.stride || 0;
    attr.offset = attr.offset || 0;
    attr.count = attr.count || (attr.stride ? attr.data.byteLength / attr.stride : attr.data.length / attr.size);
    attr.divisor = attr.instanced || 0;
    attr.needsUpdate = false;
    attr.usage = attr.usage || this.gl.STATIC_DRAW;
    if (!attr.buffer) {
      this.updateAttribute(attr);
    }
    if (attr.divisor) {
      this.isInstanced = true;
      if (this.instancedCount && this.instancedCount !== attr.count * attr.divisor) {
        console.warn("geometry has multiple instanced buffers of different length");
        return this.instancedCount = Math.min(this.instancedCount, attr.count * attr.divisor);
      }
      this.instancedCount = attr.count * attr.divisor;
    } else if (key === "index") {
      this.drawRange.count = attr.count;
    } else if (!this.attributes.index) {
      this.drawRange.count = Math.max(this.drawRange.count, attr.count);
    }
  }
  updateAttribute(attr) {
    const isNewBuffer = !attr.buffer;
    if (isNewBuffer)
      attr.buffer = this.gl.createBuffer();
    if (this.glState.boundBuffer !== attr.buffer) {
      this.gl.bindBuffer(attr.target, attr.buffer);
      this.glState.boundBuffer = attr.buffer;
    }
    if (isNewBuffer) {
      this.gl.bufferData(attr.target, attr.data, attr.usage);
    } else {
      this.gl.bufferSubData(attr.target, 0, attr.data);
    }
    attr.needsUpdate = false;
  }
  setIndex(value) {
    this.addAttribute("index", value);
  }
  setDrawRange(start, count) {
    this.drawRange.start = start;
    this.drawRange.count = count;
  }
  setInstancedCount(value) {
    this.instancedCount = value;
  }
  createVAO(program) {
    this.VAOs[program.attributeOrder] = this.gl.renderer.createVertexArray();
    this.gl.renderer.bindVertexArray(this.VAOs[program.attributeOrder]);
    this.bindAttributes(program);
  }
  bindAttributes(program) {
    program.attributeLocations.forEach((location, { name, type }) => {
      if (!this.attributes[name]) {
        console.warn(`active attribute ${name} not being supplied`);
        return;
      }
      const attr = this.attributes[name];
      this.gl.bindBuffer(attr.target, attr.buffer);
      this.glState.boundBuffer = attr.buffer;
      let numLoc = 1;
      if (type === 35674)
        numLoc = 2;
      if (type === 35675)
        numLoc = 3;
      if (type === 35676)
        numLoc = 4;
      const size = attr.size / numLoc;
      const stride = numLoc === 1 ? 0 : numLoc * numLoc * 4;
      const offset = numLoc === 1 ? 0 : numLoc * 4;
      for (let i = 0;i < numLoc; i++) {
        this.gl.vertexAttribPointer(location + i, size, attr.type, attr.normalized, attr.stride + stride, attr.offset + i * offset);
        this.gl.enableVertexAttribArray(location + i);
        this.gl.renderer.vertexAttribDivisor(location + i, attr.divisor);
      }
    });
    if (this.attributes.index)
      this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.attributes.index.buffer);
  }
  draw({ program, mode = this.gl.TRIANGLES }) {
    if (this.gl.renderer.currentGeometry !== `${this.id}_${program.attributeOrder}`) {
      if (!this.VAOs[program.attributeOrder])
        this.createVAO(program);
      this.gl.renderer.bindVertexArray(this.VAOs[program.attributeOrder]);
      this.gl.renderer.currentGeometry = `${this.id}_${program.attributeOrder}`;
    }
    program.attributeLocations.forEach((location, { name }) => {
      const attr = this.attributes[name];
      if (attr.needsUpdate)
        this.updateAttribute(attr);
    });
    let indexBytesPerElement = 2;
    if (this.attributes.index?.type === this.gl.UNSIGNED_INT)
      indexBytesPerElement = 4;
    if (this.isInstanced) {
      if (this.attributes.index) {
        this.gl.renderer.drawElementsInstanced(mode, this.drawRange.count, this.attributes.index.type, this.attributes.index.offset + this.drawRange.start * indexBytesPerElement, this.instancedCount);
      } else {
        this.gl.renderer.drawArraysInstanced(mode, this.drawRange.start, this.drawRange.count, this.instancedCount);
      }
    } else {
      if (this.attributes.index) {
        this.gl.drawElements(mode, this.drawRange.count, this.attributes.index.type, this.attributes.index.offset + this.drawRange.start * indexBytesPerElement);
      } else {
        this.gl.drawArrays(mode, this.drawRange.start, this.drawRange.count);
      }
    }
  }
  getPosition() {
    const attr = this.attributes.position;
    if (attr.data)
      return attr;
    if (isBoundsWarned)
      return;
    console.warn("No position buffer data found to compute bounds");
    return isBoundsWarned = true;
  }
  computeBoundingBox(attr) {
    if (!attr)
      attr = this.getPosition();
    const array = attr.data;
    const stride = attr.size;
    if (!this.bounds) {
      this.bounds = {
        min: new Vec3,
        max: new Vec3,
        center: new Vec3,
        scale: new Vec3,
        radius: Infinity
      };
    }
    const min = this.bounds.min;
    const max = this.bounds.max;
    const center = this.bounds.center;
    const scale = this.bounds.scale;
    min.set(Infinity);
    max.set(-Infinity);
    for (let i = 0, l = array.length;i < l; i += stride) {
      const x = array[i];
      const y = array[i + 1];
      const z = array[i + 2];
      min.x = Math.min(x, min.x);
      min.y = Math.min(y, min.y);
      min.z = Math.min(z, min.z);
      max.x = Math.max(x, max.x);
      max.y = Math.max(y, max.y);
      max.z = Math.max(z, max.z);
    }
    scale.sub(max, min);
    center.add(min, max).divide(2);
  }
  computeBoundingSphere(attr) {
    if (!attr)
      attr = this.getPosition();
    const array = attr.data;
    const stride = attr.size;
    if (!this.bounds)
      this.computeBoundingBox(attr);
    let maxRadiusSq = 0;
    for (let i = 0, l = array.length;i < l; i += stride) {
      tempVec32.fromArray(array, i);
      maxRadiusSq = Math.max(maxRadiusSq, this.bounds.center.squaredDistance(tempVec32));
    }
    this.bounds.radius = Math.sqrt(maxRadiusSq);
  }
  remove() {
    for (let key in this.VAOs) {
      this.gl.renderer.deleteVertexArray(this.VAOs[key]);
      delete this.VAOs[key];
    }
    for (let key in this.attributes) {
      this.gl.deleteBuffer(this.attributes[key].buffer);
      delete this.attributes[key];
    }
  }
}

// node_modules/ogl/src/extras/Triangle.js
class Triangle extends Geometry {
  constructor(gl, { attributes = {} } = {}) {
    Object.assign(attributes, {
      position: { size: 2, data: new Float32Array([-1, -1, 3, -1, -1, 3]) },
      uv: { size: 2, data: new Float32Array([0, 0, 2, 0, 0, 2]) }
    });
    super(gl, attributes);
  }
}
// src/microSlatsVanilla.js
var SWELL_PRESETS = {
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
var FLUID_SIZE = 96;
var PRESSURE_STEPS = 16;
var SPLAT_FORCE = 6900;
var SPLASH_JETS = 3;
var PIXEL_BUDGET = 4500000;
var clamp = (value, min, max) => Math.min(Math.max(value, min), max);
var parseColor = (value, fallback) => {
  try {
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx)
      return fallback;
    ctx.fillStyle = "#000000";
    ctx.fillStyle = value;
    const resolved = ctx.fillStyle;
    if (resolved.startsWith("#")) {
      const n = parseInt(resolved.slice(1), 16);
      return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255, 1];
    }
    const parts = resolved.match(/[\d.]+/g);
    if (!parts || parts.length < 3)
      return fallback;
    return [Number(parts[0]) / 255, Number(parts[1]) / 255, Number(parts[2]) / 255, parts[3] ? Number(parts[3]) : 1];
  } catch {
    return fallback;
  }
};
var passVertex = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;
var fluidVertex = `#version 300 es
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
var fluidHead = `#version 300 es
precision highp float;
in vec2 vUv;
in vec2 vL;
in vec2 vR;
in vec2 vT;
in vec2 vB;
out vec4 fragColor;
`;
var splatFragment = `${fluidHead}
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
var curlFragment = `${fluidHead}
uniform sampler2D uVelocity;
void main() {
  float left = texture(uVelocity, vL).y;
  float right = texture(uVelocity, vR).y;
  float top = texture(uVelocity, vT).x;
  float bottom = texture(uVelocity, vB).x;
  fragColor = vec4(0.5 * (right - left - top + bottom), 0.0, 0.0, 1.0);
}
`;
var vorticityFragment = `${fluidHead}
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
var divergenceFragment = `${fluidHead}
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
var pressureFragment = `${fluidHead}
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
var projectFragment = `${fluidHead}
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
var advectFragment = `${fluidHead}
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
var scaleFragment = `${fluidHead}
uniform sampler2D uSource;
uniform float uValue;
void main() {
  fragColor = vec4(texture(uSource, vUv).xyz * uValue, 1.0);
}
`;
var fieldFragment = `#version 300 es
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
var slatFragment = `#version 300 es
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
function initMicroSlats(container, customOpts = {}) {
  if (!container)
    return () => {};
  const preset = customOpts.preset || "swell";
  const base = SWELL_PRESETS[preset] || SWELL_PRESETS.swell;
  const pick = (val, key) => val === undefined || val === null ? base[key] : val;
  const s = {
    color: parseColor(customOpts.color || "#f97316", [0.97, 0.45, 0.08, 1]),
    glintColor: parseColor(customOpts.glintColor || "#803edc", [0.5, 0.24, 0.86, 1]),
    backgroundColor: parseColor(customOpts.backgroundColor || "#120f17", [0.07, 0.06, 0.09, 1]),
    slatWidth: customOpts.slatWidth ?? 10,
    slatHeight: customOpts.slatHeight ?? 25,
    gap: customOpts.gap ?? 3,
    roundness: customOpts.roundness ?? 0.75,
    scale: pick(customOpts.scale, "scale"),
    speed: pick(customOpts.speed, "speed"),
    direction: pick(customOpts.direction, "direction"),
    chop: pick(customOpts.chop, "chop"),
    stretch: pick(customOpts.stretch, "stretch"),
    glint: pick(customOpts.glint, "glint"),
    contrast: pick(customOpts.contrast, "contrast"),
    perspective: pick(customOpts.perspective, "perspective"),
    fog: pick(customOpts.fog, "fog"),
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
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return () => {};
  }
  gl.clearColor(0, 0, 0, 0);
  const canvas = gl.canvas;
  canvas.style.display = "block";
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.setAttribute("aria-hidden", "true");
  container.appendChild(canvas);
  const geometry = new Triangle(gl);
  const blank = new Texture(gl);
  const floatTargets = !!(gl.getExtension("EXT_color_buffer_float") || gl.getExtension("EXT_color_buffer_half_float"));
  const dispose = (target) => {
    if (target?.buffer)
      gl.deleteFramebuffer(target.buffer);
    if (target?.texture?.texture)
      gl.deleteTexture(target.texture.texture);
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
  const fluidPass = (fragment, uniforms) => new Mesh(gl, {
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
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
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
  const floatTarget = (w, h) => new RenderTarget(gl, {
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
    if (!fluid)
      return;
    [fluid.velocity, fluid.ink, fluid.pressure].forEach((pair) => {
      dispose(pair.read);
      dispose(pair.write);
    });
    dispose(fluid.divergence);
    dispose(fluid.curl);
    fluid = null;
  };
  const buildFluid = () => {
    if (!floatTargets)
      return;
    const aspect = width / height;
    const w = Math.max(8, Math.round(aspect >= 1 ? FLUID_SIZE * aspect : FLUID_SIZE));
    const h = Math.max(8, Math.round(aspect >= 1 ? FLUID_SIZE : FLUID_SIZE / aspect));
    if (fluid && fluid.width === w && fluid.height === h)
      return;
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
    for (let i = 0;i < PRESSURE_STEPS; i++) {
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
  const frame = (now) => {
    raf = 0;
    if (!alive)
      return;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (!s.paused && !reducedMotion)
      time += dt * s.speed;
    introClock = s.intro && !reducedMotion ? introClock + dt / Math.max(0.2, s.introDuration) : 1;
    const introLinear = Math.min(introClock, 1);
    const introEase = introLinear < 0.5 ? 4 * introLinear * introLinear * introLinear : 1 - Math.pow(-2 * introLinear + 2, 3) / 2;
    if (fluid && splats.length) {
      const radius = Math.pow(clamp(s.cursorSize, 4, 600) / height, 2) * 0.35;
      const aspect = width / height;
      for (const [u, v, du, dv, turn] of splats) {
        if (turn !== null) {
          for (let i = 0;i < SPLASH_JETS; i++) {
            const angle = turn + i * Math.PI * 2 / SPLASH_JETS;
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
    if (fluidActive)
      stepFluid(fluid, dt);
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
    const moving = !s.paused && !reducedMotion && s.speed !== 0 || introClock < 1;
    if (visible && (moving || fluidActive))
      raf = requestAnimationFrame(frame);
  };
  const start = () => {
    if (raf || !visible || !alive)
      return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };
  const locate = (e) => {
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    return { x, y, u: x / w, v: 1 - y / h, h, inside: x >= 0 && y >= 0 && x <= w && y <= h };
  };
  const queue = (u, v, du, dv, turn) => {
    if (splats.length > 32)
      splats.shift();
    splats.push([u, v, du, dv, turn]);
    fluidUntil = performance.now() + Math.max(1.5, s.trail * 5) * 1000;
    start();
  };
  const onPointerMove = (e) => {
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
  const onPointerDown = (e) => {
    const spot = locate(e);
    if (!fluid || !s.interactive || reducedMotion || !spot.inside)
      return;
    splashTurn += 2.39996;
    queue(spot.u, spot.v, 0, 0, splashTurn);
  };
  const onPointerLeave = () => {
    pointer.tracked = false;
  };
  const onPointerOut = (e) => {
    if (!e.relatedTarget)
      onPointerLeave();
  };
  const onVisibility = () => {
    if (!document.hidden)
      start();
  };
  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerdown", onPointerDown, { passive: true });
  window.addEventListener("pointerout", onPointerOut, { passive: true });
  window.addEventListener("blur", onPointerLeave);
  document.addEventListener("visibilitychange", onVisibility);
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
    if (visible)
      start();
    else
      cancelAnimationFrame(raf);
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
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerdown", onPointerDown);
    window.removeEventListener("pointerout", onPointerOut);
    window.removeEventListener("blur", onPointerLeave);
    document.removeEventListener("visibilitychange", onVisibility);
    disposeFluid();
    dispose(fieldTarget);
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    if (canvas.parentNode)
      canvas.parentNode.removeChild(canvas);
  };
}
if (typeof window !== "undefined") {
  window.initMicroSlats = initMicroSlats;
}
export {
  initMicroSlats
};
