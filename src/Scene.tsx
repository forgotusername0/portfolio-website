import { Component, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import * as THREE from 'three'
import { settings, type SphereColors } from './content'

const PAPER = '#f1f3f7' // keep in sync with --color-paper in index.css

type Pose = { section: string; position: number[]; scale: number; morph: number; camera: number[] }
const POSES: Pose[] = settings.sphere.choreography

// 3D simplex noise, Ian McEwan / Ashima Arts (MIT). Prefixed so it cannot collide with three's own chunks.
const NOISE = /* glsl */ `
uniform float uTime;
uniform float uMorph;
vec3 lqMod(vec3 x){return x-floor(x*(1./289.))*289.;}
vec4 lqMod(vec4 x){return x-floor(x*(1./289.))*289.;}
vec4 lqPerm(vec4 x){return lqMod(((x*34.)+1.)*x);}
float lqNoise(vec3 v){
  const vec2 C=vec2(1./6.,1./3.); const vec4 D=vec4(0.,.5,1.,2.);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=lqMod(i);
  vec4 p=lqPerm(lqPerm(lqPerm(i.z+vec4(0.,i1.z,i2.z,1.))+i.y+vec4(0.,i1.y,i2.y,1.))+i.x+vec4(0.,i1.x,i2.x,1.));
  vec3 ns=.142857142857*D.wyz-D.xzx;
  vec4 j=p-49.*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.+1.; vec4 s1=floor(b1)*2.+1.; vec4 sh=-step(h,vec4(0.));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 n=1.79284291400159-.85373472095314*vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3));
  p0*=n.x; p1*=n.y; p2*=n.z; p3*=n.w;
  vec4 m=max(.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.); m=m*m;
  return 42.*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
// Two octaves: slow wide lobes plus a finer ripple, pushed out along the sphere normal.
vec3 lqDisplace(vec3 dir){
  float n=lqNoise(dir*.72+vec3(0.,uTime*.2,uTime*.12));
  n+=.22*lqNoise(dir*1.6+vec3(uTime*.27,0.,-uTime*.17));
  return dir*(1.+n*uMorph);
}
`

// Runs where three declares objectNormal: displace the vertex and two neighbours, rebuild the normal from them.
const DISPLACE = /* glsl */ `
vec3 lqDir=normalize(position);
vec3 lqT=normalize(cross(lqDir,abs(lqDir.y)<.99?vec3(0.,1.,0.):vec3(1.,0.,0.)));
vec3 lqB=cross(lqDir,lqT);
vec3 lqPos=lqDisplace(lqDir);
objectNormal=normalize(cross(lqDisplace(normalize(lqDir+lqT*.012))-lqPos,lqDisplace(normalize(lqDir+lqB*.012))-lqPos));
`

function makeLiquid(uniforms: Record<string, THREE.IUniform>) {
  const material = new THREE.MeshPhysicalMaterial({
    transmission: 1,
    thickness: 1.2,
    ior: 1.32,
    roughness: 0.2, // the frost: blurs whatever is refracted through the sphere
    attenuationDistance: 4,
    iridescence: 0.6,
    iridescenceIOR: 1.3,
    iridescenceThicknessRange: [120, 520],
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    emissiveIntensity: 0.32,
    envMapIntensity: 1.1,
  })
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader =
      NOISE +
      shader.vertexShader
        .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>\n${DISPLACE}`)
        .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed=lqPos;')
    // Emissive glow gathers at the silhouette instead of washing the whole surface.
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      totalEmissiveRadiance*=.1+.9*pow(1.-saturate(dot(normalize(vViewPosition),normal)),2.5);`,
    )
  }
  return material
}

// Soft clouds of the two light colours and the tint, fading to the page colour. Sits behind the sphere so the glass has something to bend.
function makeHalo() {
  return new THREE.ShaderMaterial({
    toneMapped: false,
    uniforms: {
      uTime: { value: 0 },
      uPaper: { value: new THREE.Color(PAPER) },
      uA: { value: new THREE.Color() },
      uB: { value: new THREE.Color() },
      uC: { value: new THREE.Color() },
    },
    vertexShader: /* glsl */ `
      varying vec2 vP;
      void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uPaper,uA,uB,uC; varying vec2 vP;
      float cloud(vec2 c,float r){ vec2 d=vP-c; return exp(-dot(d,d)/(r*r)); }
      void main(){
        vec3 col=uPaper;
        col=mix(col,uA,.62*cloud(vec2(-1.7+.3*sin(uTime*.11),1.1+.2*cos(uTime*.13)),2.3));
        col=mix(col,uB,.58*cloud(vec2(1.9+.3*cos(uTime*.09),-1.2),2.5));
        col=mix(col,uC,.5*cloud(vec2(.3,.4+.3*sin(uTime*.07)),3.2));
        gl_FragColor=vec4(col,1.);
        #include <colorspace_fragment>
      }`,
  })
}

type Props = { colors: SphereColors; drawerOpen: boolean }

function Stage({ colors, drawerOpen }: Props) {
  const rig = useRef<THREE.Group>(null!)
  const ball = useRef<THREE.Mesh>(null!)
  const sections = useRef<(HTMLElement | null)[]>([])
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uMorph: { value: 0 } }), [])
  const liquid = useMemo(() => makeLiquid(uniforms), [uniforms])
  const halo = useMemo(makeHalo, [])
  const detail = useMemo(() => (window.innerWidth < 768 ? 28 : 48), [])
  const speed = useMemo(() => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.25 : 1), [])
  const state = useMemo(
    () => ({
      position: new THREE.Vector3().fromArray(POSES[0].position),
      camera: new THREE.Vector3().fromArray(POSES[0].camera),
      scale: POSES[0].scale * 0.55, // starts small and swells in on load
      morph: POSES[0].morph,
      pointer: new THREE.Vector2(),
      pointerTarget: new THREE.Vector2(),
      goalPosition: new THREE.Vector3(),
      goalCamera: new THREE.Vector3(),
      tmp: new THREE.Vector3(),
      tmpColor: new THREE.Color(),
    }),
    [],
  )

  useEffect(() => {
    sections.current = POSES.map((p) => document.getElementById(p.section))
    const onMove = (e: PointerEvent) =>
      state.pointerTarget.set((e.clientX / innerWidth) * 2 - 1, 1 - (e.clientY / innerHeight) * 2)
    addEventListener('pointermove', onMove, { passive: true })
    return () => removeEventListener('pointermove', onMove)
  }, [state])

  useEffect(() => {
    liquid.color.set('#ffffff').lerp(state.tmpColor.set(colors.tint), 0.3) // surface stays pale; the depth carries the tint
    liquid.attenuationColor.set(colors.tint)
    liquid.emissive.set(colors.glow)
    halo.uniforms.uA.value.set(colors.lightA)
    halo.uniforms.uB.value.set(colors.lightB)
    halo.uniforms.uC.value.set(colors.tint)
  }, [colors, liquid, halo, state])

  useFrame(({ camera, size }, delta) => {
    const dt = Math.min(delta, 0.1)
    const s = state

    // Which two sections is the middle of the viewport between, and how far along?
    const mid = scrollY + innerHeight / 2
    const center = (i: number) => {
      const el = sections.current[i]
      return el ? el.getBoundingClientRect().top + scrollY + el.offsetHeight / 2 : 0
    }
    let i = 0
    while (i < POSES.length - 2 && mid > center(i + 1)) i++
    const t = THREE.MathUtils.smoothstep(mid, center(i), center(i + 1))
    const a = POSES[i]
    const b = POSES[i + 1]

    // On tall, narrow screens the sphere stays near the middle and shrinks to fit.
    const fit = THREE.MathUtils.clamp(size.width / size.height / 1.5, 0.3, 1)
    s.goalPosition.fromArray(a.position).lerp(s.tmp.fromArray(b.position), t)
    s.goalPosition.x *= fit
    s.goalCamera.fromArray(a.camera).lerp(s.tmp.fromArray(b.camera), t)
    let scale = THREE.MathUtils.lerp(a.scale, b.scale, t) * THREE.MathUtils.lerp(0.6, 1, fit)
    let morph = THREE.MathUtils.lerp(a.morph, b.morph, t)
    if (drawerOpen) {
      s.goalPosition.x -= 1.6 * fit // slides clear of the case study drawer
      scale *= 0.9
      morph += 0.14
    }

    const ease = 1 - Math.exp(-3.5 * dt)
    s.position.lerp(s.goalPosition, ease)
    s.camera.lerp(s.goalCamera, ease)
    s.scale += (scale - s.scale) * ease
    s.morph += (morph - s.morph) * ease
    s.pointer.lerp(s.pointerTarget, ease)

    rig.current.position.set(s.position.x + s.pointer.x * 0.14, s.position.y + s.pointer.y * 0.09, s.position.z)
    ball.current.scale.setScalar(s.scale)
    ball.current.rotation.y += dt * 0.07 * speed
    ball.current.rotation.x = s.pointer.y * -0.15
    camera.position.copy(s.camera)
    camera.lookAt(0, 0, 0)

    uniforms.uTime.value += dt * speed
    uniforms.uMorph.value = s.morph
    halo.uniforms.uTime.value = uniforms.uTime.value
  })

  return (
    <group ref={rig}>
      <mesh ref={ball} material={liquid}>
        <icosahedronGeometry args={[1, detail]} />
      </mesh>
      <mesh position={[0, 0, -5]} material={halo}>
        <planeGeometry args={[60, 60]} />
      </mesh>
      <pointLight position={[-3.2, 2.6, 3]} intensity={45} color={colors.lightA} />
      <pointLight position={[3.2, -2.2, 2.6]} intensity={38} color={colors.lightB} />
    </group>
  )
}

/** If WebGL is unavailable the page still works; it just loses the sphere. */
class Safe extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError = () => ({ failed: true })
  render = () => (this.state.failed ? null : this.props.children)
}

export default function Scene(props: Props) {
  return (
    <div className="pointer-events-none fixed top-0 left-0 h-lvh w-full" aria-hidden="true">
      <Safe>
        <Canvas
          dpr={[1, 1.75]}
          camera={{ fov: 35, near: 0.1, far: 60, position: POSES[0].camera as [number, number, number] }}
          gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: THREE.NeutralToneMapping }}
        >
          <color attach="background" args={[PAPER]} />
          <Stage {...props} />
          {/* Soft studio: one overhead softbox, two side cards and a front ring, baked once into the reflections. */}
          <Environment resolution={256}>
            <color attach="background" args={['#dde3ee']} />
            <Lightformer form="rect" intensity={3.2} position={[0, 6, 1]} scale={[12, 5, 1]} target={[0, 0, 0]} />
            <Lightformer form="rect" intensity={1.6} position={[-6, 1, 2]} scale={[5, 8, 1]} target={[0, 0, 0]} />
            <Lightformer form="rect" intensity={1.3} position={[6, -1, 3]} scale={[5, 8, 1]} target={[0, 0, 0]} />
            <Lightformer form="ring" intensity={2} position={[0, 0.5, 8]} scale={3.5} target={[0, 0, 0]} />
          </Environment>
        </Canvas>
      </Safe>
    </div>
  )
}
