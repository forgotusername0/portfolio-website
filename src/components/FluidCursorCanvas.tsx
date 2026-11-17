import { useEffect, useRef } from 'react'

/**
 * Mouse-driven Navier–Stokes dye simulation (velocity + dye advection, vorticity confinement, pressure projection).
 * Structure follows Pavel Dobryakov's WebGL-Fluid-Simulation (MIT), trimmed down and recalibrated for a light page:
 * the dye is drawn with soft alpha so it reads as pastel watercolor over white and over images, never as black.
 */
const CONFIG = {
  SIM_RESOLUTION: 128,
  DYE_RESOLUTION: 512,
  DENSITY_DISSIPATION: 1.6, // dye lingers ~1.5–2s
  VELOCITY_DISSIPATION: 0.35,
  PRESSURE: 0.8,
  PRESSURE_ITERATIONS: 20,
  CURL: 28,
  SPLAT_RADIUS: 0.32,
  SPLAT_FORCE: 5500,
  SATURATION: 0.85,
  LIGHTNESS: 0.62,
  DYE_AMOUNT: 0.11, // how much colour each splat adds
  MAX_ALPHA: 0.55, // keeps the thickest cloud translucent
  IDLE_MS: 4000, // stop the loop this long after the last mouse move (the dye is gone well before)
}

const VERT = `
precision highp float;
attribute vec2 aPosition;
varying vec2 vUv, vL, vR, vT, vB;
uniform vec2 texelSize;
void main () {
  vUv = aPosition * 0.5 + 0.5;
  vL = vUv - vec2(texelSize.x, 0.0);
  vR = vUv + vec2(texelSize.x, 0.0);
  vT = vUv + vec2(0.0, texelSize.y);
  vB = vUv - vec2(0.0, texelSize.y);
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`

const HEAD = `
precision highp float;
precision highp sampler2D;
varying vec2 vUv, vL, vR, vT, vB;
`

const FRAG = {
  splat: `${HEAD}
uniform sampler2D uTarget; uniform float aspectRatio; uniform vec3 color; uniform vec2 point; uniform float radius;
void main () {
  vec2 p = vUv - point; p.x *= aspectRatio;
  gl_FragColor = vec4(texture2D(uTarget, vUv).xyz + exp(-dot(p, p) / radius) * color, 1.0);
}`,
  advection: `${HEAD}
uniform sampler2D uVelocity, uSource; uniform vec2 texelSize; uniform float dt, dissipation;
void main () {
  vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
  gl_FragColor = texture2D(uSource, coord) / (1.0 + dissipation * dt);
}`,
  divergence: `${HEAD}
uniform sampler2D uVelocity;
void main () {
  float L = texture2D(uVelocity, vL).x, R = texture2D(uVelocity, vR).x;
  float T = texture2D(uVelocity, vT).y, B = texture2D(uVelocity, vB).y;
  vec2 C = texture2D(uVelocity, vUv).xy;
  if (vL.x < 0.0) L = -C.x; if (vR.x > 1.0) R = -C.x;
  if (vT.y > 1.0) T = -C.y; if (vB.y < 0.0) B = -C.y;
  gl_FragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`,
  curl: `${HEAD}
uniform sampler2D uVelocity;
void main () {
  float L = texture2D(uVelocity, vL).y, R = texture2D(uVelocity, vR).y;
  float T = texture2D(uVelocity, vT).x, B = texture2D(uVelocity, vB).x;
  gl_FragColor = vec4(0.5 * (R - L - T + B), 0.0, 0.0, 1.0);
}`,
  vorticity: `${HEAD}
uniform sampler2D uVelocity, uCurl; uniform float curl, dt;
void main () {
  float L = texture2D(uCurl, vL).x, R = texture2D(uCurl, vR).x;
  float T = texture2D(uCurl, vT).x, B = texture2D(uCurl, vB).x, C = texture2D(uCurl, vUv).x;
  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  force /= length(force) + 0.0001;
  force *= curl * C;
  force.y *= -1.0;
  vec2 v = texture2D(uVelocity, vUv).xy + force * dt;
  gl_FragColor = vec4(clamp(v, -1000.0, 1000.0), 0.0, 1.0);
}`,
  pressure: `${HEAD}
uniform sampler2D uPressure, uDivergence;
void main () {
  float L = texture2D(uPressure, vL).x, R = texture2D(uPressure, vR).x;
  float T = texture2D(uPressure, vT).x, B = texture2D(uPressure, vB).x;
  gl_FragColor = vec4((L + R + B + T - texture2D(uDivergence, vUv).x) * 0.25, 0.0, 0.0, 1.0);
}`,
  gradient: `${HEAD}
uniform sampler2D uPressure, uVelocity;
void main () {
  float L = texture2D(uPressure, vL).x, R = texture2D(uPressure, vR).x;
  float T = texture2D(uPressure, vT).x, B = texture2D(uPressure, vB).x;
  gl_FragColor = vec4(texture2D(uVelocity, vUv).xy - vec2(R - L, T - B), 0.0, 1.0);
}`,
  clear: `${HEAD}
uniform sampler2D uTexture; uniform float value;
void main () { gl_FragColor = value * texture2D(uTexture, vUv); }`,
  // Overlapping splats add up; dividing by the brightest channel keeps the hue instead of blowing out to white.
  // Output is premultiplied alpha: thin dye is a faint tint, thick dye a translucent pastel.
  display: `${HEAD}
uniform sampler2D uTexture; uniform float maxAlpha;
void main () {
  vec3 c = max(texture2D(uTexture, vUv).rgb, 0.0);
  float m = max(c.r, max(c.g, c.b));
  vec3 col = c / max(m, 1.0);
  float a = smoothstep(0.0, 1.0, min(m, 1.0));
  gl_FragColor = vec4(col * (a / max(min(m, 1.0), 0.0001)), a) * maxAlpha;
}`,
}

type FBO = { fbo: WebGLFramebuffer; tex: WebGLTexture; w: number; h: number }
type DoubleFBO = { read: FBO; write: FBO; swap: () => void }

function hslToRgb(h: number, s: number, l: number) {
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h * 12) % 12
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  }
  return [f(0), f(8), f(4)]
}

/** Builds the simulation on a canvas. Returns null if the GPU cannot render to half-float textures. */
function createFluid(canvas: HTMLCanvasElement) {
  const params = { alpha: true, depth: false, stencil: false, antialias: false, premultipliedAlpha: true }
  const gl2 = canvas.getContext('webgl2', params)
  const gl = (gl2 ?? canvas.getContext('webgl', params)) as WebGL2RenderingContext | null
  if (!gl) return null

  // Half-float render targets: core in WebGL2 (plus EXT_color_buffer_float), an extension in WebGL1.
  let halfFloat: number
  let internal: number
  let linear: boolean
  if (gl2) {
    gl.getExtension('EXT_color_buffer_float')
    halfFloat = gl.HALF_FLOAT
    internal = gl.RGBA16F
    linear = true
  } else {
    const ext = gl.getExtension('OES_texture_half_float')
    if (!ext) return null
    halfFloat = ext.HALF_FLOAT_OES
    internal = gl.RGBA
    linear = !!gl.getExtension('OES_texture_half_float_linear')
  }
  const filter = linear ? gl.LINEAR : gl.NEAREST

  const createFBO = (w: number, h: number): FBO | null => {
    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, gl.RGBA, halfFloat, null)
    const fbo = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) return null
    gl.viewport(0, 0, w, h)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    return { fbo, tex, w, h }
  }
  const createDouble = (w: number, h: number): DoubleFBO | null => {
    const a = createFBO(w, h)
    const b = createFBO(w, h)
    if (!a || !b) return null
    const d = { read: a, write: b, swap: () => ([d.read, d.write] = [d.write, d.read]) }
    return d
  }
  const resolution = (res: number) => {
    const aspect = Math.max(innerWidth / innerHeight, innerHeight / innerWidth)
    const long = Math.round(res * aspect)
    return innerWidth > innerHeight ? [long, res] : [res, long]
  }
  // ponytail: grid sizes are fixed at creation; a window resize stretches the same grid rather than rebuilding it.
  const [sw, sh] = resolution(CONFIG.SIM_RESOLUTION)
  const [dw, dh] = resolution(CONFIG.DYE_RESOLUTION)
  const velocity = createDouble(sw, sh)
  const pressure = createDouble(sw, sh)
  const divergence = createFBO(sw, sh)
  const curl = createFBO(sw, sh)
  const dye = createDouble(dw, dh)
  if (!velocity || !pressure || !divergence || !curl || !dye) return null

  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!
    gl.shaderSource(s, src)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader error')
    return s
  }
  const vert = compile(gl.VERTEX_SHADER, VERT)
  const program = (frag: string) => {
    const p = gl.createProgram()!
    gl.attachShader(p, vert)
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, frag))
    gl.bindAttribLocation(p, 0, 'aPosition')
    gl.linkProgram(p)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link error')
    const cache: Record<string, WebGLUniformLocation | null> = {}
    const loc = (name: string) => (cache[name] ??= gl.getUniformLocation(p, name))
    return {
      use: () => gl.useProgram(p),
      f: (name: string, ...v: number[]) => {
        if (v.length === 1) gl.uniform1f(loc(name), v[0])
        else if (v.length === 2) gl.uniform2f(loc(name), v[0], v[1])
        else gl.uniform3f(loc(name), v[0], v[1], v[2])
      },
      tex: (name: string, t: FBO, unit: number) => {
        gl.activeTexture(gl.TEXTURE0 + unit)
        gl.bindTexture(gl.TEXTURE_2D, t.tex)
        gl.uniform1i(loc(name), unit)
      },
    }
  }
  const P = {
    splat: program(FRAG.splat),
    advection: program(FRAG.advection),
    divergence: program(FRAG.divergence),
    curl: program(FRAG.curl),
    vorticity: program(FRAG.vorticity),
    pressure: program(FRAG.pressure),
    gradient: program(FRAG.gradient),
    clear: program(FRAG.clear),
    display: program(FRAG.display),
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
  gl.enableVertexAttribArray(0)
  gl.disable(gl.BLEND)

  const blit = (target: FBO | null) => {
    if (target) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo)
      gl.viewport(0, 0, target.w, target.h)
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.viewport(0, 0, canvas.width, canvas.height)
    }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
  }

  const resize = () => {
    const dpr = Math.min(devicePixelRatio, 1.5)
    // The canvas fills the viewport; its own client size reads 0 while the cursor layer is still hidden.
    canvas.width = Math.round(innerWidth * dpr)
    canvas.height = Math.round(innerHeight * dpr)
  }
  resize()

  return {
    resize,
    /** x, y in 0..1 (y up); dx, dy the movement since the last splat in the same units. */
    splat(x: number, y: number, dx: number, dy: number, rgb: number[]) {
      const aspect = canvas.width / canvas.height
      P.splat.use()
      P.splat.tex('uTarget', velocity.read, 0)
      P.splat.f('aspectRatio', aspect)
      P.splat.f('point', x, y)
      P.splat.f('color', dx * CONFIG.SPLAT_FORCE, dy * CONFIG.SPLAT_FORCE, 0)
      P.splat.f('radius', (CONFIG.SPLAT_RADIUS / 100) * (aspect > 1 ? aspect : 1))
      blit(velocity.write)
      velocity.swap()
      P.splat.tex('uTarget', dye.read, 0)
      P.splat.f('color', rgb[0], rgb[1], rgb[2])
      blit(dye.write)
      dye.swap()
    },
    step(dt: number) {
      const texel = [1 / sw, 1 / sh] as const

      P.curl.use()
      P.curl.f('texelSize', ...texel)
      P.curl.tex('uVelocity', velocity.read, 0)
      blit(curl)

      P.vorticity.use()
      P.vorticity.f('texelSize', ...texel)
      P.vorticity.tex('uVelocity', velocity.read, 0)
      P.vorticity.tex('uCurl', curl, 1)
      P.vorticity.f('curl', CONFIG.CURL)
      P.vorticity.f('dt', dt)
      blit(velocity.write)
      velocity.swap()

      P.divergence.use()
      P.divergence.f('texelSize', ...texel)
      P.divergence.tex('uVelocity', velocity.read, 0)
      blit(divergence)

      P.clear.use()
      P.clear.tex('uTexture', pressure.read, 0)
      P.clear.f('value', CONFIG.PRESSURE)
      blit(pressure.write)
      pressure.swap()

      P.pressure.use()
      P.pressure.f('texelSize', ...texel)
      P.pressure.tex('uDivergence', divergence, 0)
      for (let i = 0; i < CONFIG.PRESSURE_ITERATIONS; i++) {
        P.pressure.tex('uPressure', pressure.read, 1)
        blit(pressure.write)
        pressure.swap()
      }

      P.gradient.use()
      P.gradient.f('texelSize', ...texel)
      P.gradient.tex('uPressure', pressure.read, 0)
      P.gradient.tex('uVelocity', velocity.read, 1)
      blit(velocity.write)
      velocity.swap()

      P.advection.use()
      P.advection.f('texelSize', ...texel)
      P.advection.f('dt', dt)
      P.advection.tex('uVelocity', velocity.read, 0)
      P.advection.tex('uSource', velocity.read, 1)
      P.advection.f('dissipation', CONFIG.VELOCITY_DISSIPATION)
      blit(velocity.write)
      velocity.swap()

      P.advection.tex('uVelocity', velocity.read, 0)
      P.advection.tex('uSource', dye.read, 1)
      P.advection.f('dissipation', CONFIG.DENSITY_DISSIPATION)
      blit(dye.write)
      dye.swap()
    },
    render() {
      P.display.use()
      P.display.tex('uTexture', dye.read, 0)
      P.display.f('maxAlpha', CONFIG.MAX_ALPHA)
      blit(null)
    },
    clear() {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
    },
  }
}

/** Full-viewport fluid dye that follows the mouse. `on` fades it in and out. */
export default function FluidCursorCanvas({ on }: { on: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const onRef = useRef(on)
  onRef.current = on

  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let fluid: ReturnType<typeof createFluid> = null
    try {
      fluid = createFluid(canvas.current!)
    } catch (e) {
      console.warn('Fluid cursor disabled:', e)
    }
    if (!fluid) return
    const sim = fluid

    const mouse = { x: 0, y: 0, moved: false }
    let prev: { x: number; y: number } | null = null
    let lastMove = 0
    let lastFrame = 0
    let hue = Math.random()
    let raf = 0

    const frame = (now: number) => {
      raf = 0
      const dt = Math.min((now - lastFrame) / 1000 || 0.016, 0.0167)
      lastFrame = now
      if (mouse.moved) {
        mouse.moved = false
        const w = innerWidth
        const h = innerHeight
        if (prev && onRef.current) {
          let dx = (mouse.x - prev.x) / w
          let dy = -(mouse.y - prev.y) / h
          const aspect = w / h
          if (aspect < 1) dx *= aspect
          else dy /= aspect
          const dist = Math.hypot(dx, dy)
          if (dist > 0) {
            hue = (hue + 0.002 + dist * 1.4) % 1 // colour drifts with time and with distance travelled
            const rgb = hslToRgb(hue, CONFIG.SATURATION, CONFIG.LIGHTNESS).map((c) => c * CONFIG.DYE_AMOUNT)
            sim.splat(mouse.x / w, 1 - mouse.y / h, dx, dy, rgb)
          }
        }
        prev = { x: mouse.x, y: mouse.y }
      }
      sim.step(dt)
      sim.render()
      if (now - lastMove < CONFIG.IDLE_MS) raf = requestAnimationFrame(frame)
      else {
        sim.clear() // idle: leave nothing on screen and stop the loop until the next move
        prev = null
      }
    }

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      mouse.x = e.clientX
      mouse.y = e.clientY
      mouse.moved = true
      lastMove = performance.now()
      if (!raf) {
        lastFrame = lastMove
        raf = requestAnimationFrame(frame)
      }
    }
    addEventListener('pointermove', onMove, { passive: true })
    addEventListener('resize', sim.resize)
    return () => {
      removeEventListener('pointermove', onMove)
      removeEventListener('resize', sim.resize)
      cancelAnimationFrame(raf)
    }
  }, [])

  return <canvas ref={canvas} aria-hidden="true" className="fluid-canvas" style={{ opacity: on ? 1 : 0 }} />
}
