/* ===========================================================================
 * WebGL Liquid Ripple Hover
 * – На каждой карточке создаётся overlay <canvas> с WebGL-сценой.
 * – На канвасе натянута текстура из <img> или <video>.
 * – Шейдер реализует «жидкое» искажение от точки курсора
 *   (плавная радиальная рябь, затухание, ripple effect).
 * – Канвас активируется только при mouseenter (perf), уничтожается на
 *   mouseleave + затухание.
 * – Графический fallback: если WebGL2 недоступен → возвращаемся к CSS scale.
 * --------------------------------------------------------------------------- */

const VERTEX_SRC = `#version 300 es
in vec2 aPos;
in vec2 aUV;
out vec2 vUV;
void main() {
  vUV = aUV;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAGMENT_SRC = `#version 300 es
precision highp float;
in vec2 vUV;
out vec4 outColor;

uniform sampler2D uTex;
uniform vec2  uMouse;
uniform float uTime;
uniform float uIntensity;

void main() {
  vec2 uv = vUV;
  vec2 d = uv - uMouse;
  float dist = length(d);

  float wave = sin(dist * 38.0 - uTime * 6.5) * 0.012;
  float falloff = smoothstep(0.55, 0.0, dist);
  vec2 disp = normalize(d + 0.0001) * wave * falloff * uIntensity;

  float ca = 0.0035 * uIntensity * falloff;
  float r = texture(uTex, uv - disp - vec2(ca, 0.0)).r;
  float g = texture(uTex, uv - disp).g;
  float b = texture(uTex, uv - disp + vec2(ca, 0.0)).b;
  vec3 col = vec3(r, g, b);

  float hl = smoothstep(0.18, 0.0, dist) * 0.18 * uIntensity;
  col += vec3(hl);

  outColor = vec4(col, 1.0);
}`;

function createShader(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.warn('Shader compile error', gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}
function createProgram(gl, vsSrc, fsSrc) {
  const vs = createShader(gl, gl.VERTEX_SHADER, vsSrc);
  const fs = createShader(gl, gl.FRAGMENT_SHADER, fsSrc);
  if (!vs || !fs) return null;
  const p = gl.createProgram();
  gl.attachShader(p, vs); gl.attachShader(p, fs);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.warn('Program link error', gl.getProgramInfoLog(p));
    return null;
  }
  return p;
}

class LiquidScene {
  constructor(cell) {
    this.cell   = cell;
    this.media  = cell.querySelector('img, video');
    if (!this.media) return;

    const canvas = document.createElement('canvas');
    canvas.className = 'gx-liquid-canvas';
    cell.appendChild(canvas);
    this.canvas = canvas;

    const gl = canvas.getContext('webgl2', { premultipliedAlpha: false, antialias: true });
    if (!gl) { canvas.remove(); return; }
    this.gl = gl;

    this.program = createProgram(gl, VERTEX_SRC, FRAGMENT_SRC);
    if (!this.program) { canvas.remove(); return; }
    gl.useProgram(this.program);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1,-1,    0,1,
       1,-1,    1,1,
      -1, 1,    0,0,
       1, 1,    1,0,
    ]), gl.STATIC_DRAW);

    const aPos = gl.getAttribLocation(this.program, 'aPos');
    const aUV  = gl.getAttribLocation(this.program, 'aUV');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 16, 0);
    gl.enableVertexAttribArray(aUV);
    gl.vertexAttribPointer(aUV, 2, gl.FLOAT, false, 16, 8);

    this.uTex       = gl.getUniformLocation(this.program, 'uTex');
    this.uMouse     = gl.getUniformLocation(this.program, 'uMouse');
    this.uTime      = gl.getUniformLocation(this.program, 'uTime');
    this.uIntensity = gl.getUniformLocation(this.program, 'uIntensity');

    this.tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.uniform1i(this.uTex, 0);

    this.mouse = [0.5, 0.5];
    this.targetMouse = [0.5, 0.5];
    this.intensity = 0;
    this.targetIntensity = 0;
    this.t0 = performance.now();
    this.running = false;

    this.resize();
    this.uploadTexture();
    this.bindEvents();
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = this.cell.getBoundingClientRect();
    this.canvas.width  = Math.max(2, Math.round(r.width  * dpr));
    this.canvas.height = Math.max(2, Math.round(r.height * dpr));
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
  }

  uploadTexture() {
    const { gl } = this;
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    try {
      const m = this.media;
      if (m.tagName === 'IMG' && !m.complete) {
        m.addEventListener('load', () => this.uploadTexture(), { once: true });
        return;
      }
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, m);
    } catch (_) { /* CORS / not ready */ }
  }

  start() {
    if (this.running) return;
    this.running = true;
    const tick = () => {
      if (!this.running) return;
      this.mouse[0] += (this.targetMouse[0] - this.mouse[0]) * 0.18;
      this.mouse[1] += (this.targetMouse[1] - this.mouse[1]) * 0.18;
      this.intensity += (this.targetIntensity - this.intensity) * 0.08;

      if (this.media && this.media.tagName === 'VIDEO' && !this.media.paused) {
        this.uploadTexture();
      }

      const t = (performance.now() - this.t0) / 1000;
      const { gl } = this;
      gl.useProgram(this.program);
      gl.uniform2f(this.uMouse, this.mouse[0], 1.0 - this.mouse[1]);
      gl.uniform1f(this.uTime, t);
      gl.uniform1f(this.uIntensity, this.intensity);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      if (this.intensity < 0.005 && this.targetIntensity === 0) {
        this.running = false;
        this.canvas.style.opacity = '0';
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  bindEvents() {
    const cell = this.cell;
    cell.addEventListener('mouseenter', () => {
      this.resize();
      this.uploadTexture();
      this.canvas.style.opacity = '1';
      this.targetIntensity = 1;
      this.start();
    });
    cell.addEventListener('mouseleave', () => {
      this.targetIntensity = 0;
    });
    cell.addEventListener('mousemove', (e) => {
      const r = cell.getBoundingClientRect();
      this.targetMouse[0] = (e.clientX - r.left) / r.width;
      this.targetMouse[1] = (e.clientY - r.top)  / r.height;
    });

    const ro = new ResizeObserver(() => this.resize());
    ro.observe(cell);
  }
}

export function initLiquidHover(selector) {
  const test = document.createElement('canvas').getContext('webgl2');
  if (!test) return;

  const cells = Array.from(document.querySelectorAll(selector));
  const scenes = new WeakMap();
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting && !scenes.has(e.target)) {
        scenes.set(e.target, new LiquidScene(e.target));
      }
    });
  }, { rootMargin: '300px' });

  cells.forEach((c) => io.observe(c));
}
