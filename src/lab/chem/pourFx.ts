import * as THREE from 'three'
import type { Tracker } from '../../vendor/lab3d/lab/types'
import { mm } from '../../vendor/lab3d/lab/units'

/** Gia tốc trọng trường theo đơn vị cảnh (1 đv = 1 dm): 9,8 m/s² = 98 dm/s². */
export const G = 98

/**
 * Hiệu ứng chuyển chất giữa hai bình, vẽ trong toạ độ thế giới:
 * - dòng chảy theo đúng quỹ đạo ném ngang từ mép miệng (x tuyến tính, y bậc hai theo thời gian), thắt lại khi rơi nhanh dần
 *   (bảo toàn lưu lượng: r ∝ 1/√v), đầu dòng rơi xuống dần khi bắt đầu rót và đuôi dòng rời mép khi dừng;
 * - gợn sáng chảy dọc dòng, mép sáng kiểu Fresnel, nhuốm màu dung dịch;
 * - giọt bắn ở chỗ dòng chạm mặt thoáng, gợn sóng tròn lan ra (bị giới hạn trong lòng bình), giọt rớt cuối cùng ở mép.
 */
export interface PourFx {
  setTint(hex: string, density: number, opaque?: boolean): void
  /** Màu hạt bột khi xúc chất rắn. */
  setGrainColor(hex: string): void
  /**
   * Vẽ dòng từ `lip` tới `land`; `r0` bán kính ở mép; `head`, `tail` (0…1) = phần quỹ đạo đang có nước
   * (head: đầu dòng đã rơi tới đâu, tail: đuôi đã rời mép tới đâu).
   */
  setStream(lip: THREE.Vector3, land: THREE.Vector3, r0: number, head: number, tail: number): void
  hideStream(): void
  /** Bắn `n` giọt quanh điểm chạm; `axis` = tâm lòng bình (x, z), `wallR` = bán kính lòng ở mặt thoáng. */
  splash(at: THREE.Vector3, n: number, strength: number, axis: THREE.Vector3, wallR: number): void
  /** Một giọt rơi tự do từ `from` xuống mặt `floorY`; chạm thì gợn sóng. `solid` = hạt bột (không gợn). */
  drip(from: THREE.Vector3, floorY: number, axis: THREE.Vector3, wallR: number, size?: number, solid?: boolean): void
  ripple(at: THREE.Vector3, axis: THREE.Vector3, wallR: number, strength?: number): void
  update(dt: number): void
  clear(): void
}

const VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`

const FRAG = /* glsl */ `
uniform vec3 uTint;
uniform float uBase;
uniform float uTime;
uniform float uOpaque;
varying vec3 vN;
varying vec3 vV;
varying vec2 vUv;
void main() {
  vec3 n = normalize(vN);
  if (!gl_FrontFacing) n = -n;
  float ndv = abs(dot(n, vV));
  float fres = pow(1.0 - ndv, 2.2);
  // Gợn sáng trôi dọc dòng (vUv.y = theo chiều dài, vUv.x = quanh chu vi).
  float a1 = sin(vUv.x * 18.85 + vUv.y * 42.0 - uTime * 26.0);
  float a2 = sin(vUv.x * 6.28 - vUv.y * 17.0 - uTime * 15.0 + 1.7);
  float streak = smoothstep(0.55, 1.0, a1 * 0.6 + a2 * 0.4);
  vec3 L = normalize(vec3(0.3, 0.9, 0.35));
  float spec = pow(max(dot(reflect(-vV, n), L), 0.0), 36.0);
  vec3 col = mix(uTint, vec3(1.0), clamp(0.45 * fres + 0.55 * streak + spec, 0.0, 1.0) * (1.0 - 0.6 * uOpaque));
  float a = clamp(uBase + 0.55 * fres + 0.35 * streak + spec, 0.0, 0.96);
  a = mix(a, 0.95, uOpaque);
  gl_FragColor = vec4(col, a);
  #include <colorspace_fragment>
}`

const RINGS = 44
const SIDES = 10

interface Drop { p: THREE.Vector3; v: THREE.Vector3; floor: number; r: number; alive: boolean; solid: boolean; axis: THREE.Vector3; wallR: number }
interface Ripple { mesh: THREE.Mesh; t: number; maxR: number; life: number; strength: number }

export function createPourFx(ctx: Tracker, scene: THREE.Object3D): PourFx {
  // ---------- Dòng chảy: ống tự dựng, cấp phát một lần ----------
  const nv = RINGS * (SIDES + 1)
  const pos = new Float32Array(nv * 3)
  const nor = new Float32Array(nv * 3)
  const uv = new Float32Array(nv * 2)
  const idx: number[] = []
  for (let i = 0; i < RINGS - 1; i++)
    for (let j = 0; j < SIDES; j++) {
      const a = i * (SIDES + 1) + j
      const b = a + SIDES + 1
      idx.push(a, b, a + 1, b, b + 1, a + 1)
    }
  const geo = ctx.track(new THREE.BufferGeometry())
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage))
  geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3).setUsage(THREE.DynamicDrawUsage))
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2).setUsage(THREE.DynamicDrawUsage))
  geo.setIndex(idx)
  const uniforms = {
    uTint: { value: new THREE.Color(0xdff0ff) },
    uBase: { value: 0.16 },
    uTime: { value: 0 },
    uOpaque: { value: 0 },
  }
  const mat = ctx.track(new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms, transparent: true, depthWrite: false, side: THREE.DoubleSide }))
  const stream = new THREE.Mesh(geo, mat)
  stream.name = 'pour-stream'
  stream.frustumCulled = false
  stream.visible = false
  stream.renderOrder = 3
  scene.add(stream)

  // ---------- Giọt bắn, giọt rớt, hạt bột ----------
  const MAX_DROPS = 96
  const dropMat = ctx.track(new THREE.MeshStandardMaterial({ color: 0xe6f3ff, roughness: 0.05, transparent: true, opacity: 0.7, depthWrite: false }))
  const solidMat = ctx.track(new THREE.MeshStandardMaterial({ color: 0xf2f2ee, roughness: 1 }))
  const sphere = ctx.track(new THREE.SphereGeometry(1, 8, 6))
  const dropMesh = new THREE.InstancedMesh(sphere, dropMat, MAX_DROPS)
  const grainMesh = new THREE.InstancedMesh(sphere, solidMat, MAX_DROPS)
  for (const m of [dropMesh, grainMesh]) {
    m.frustumCulled = false
    m.count = 0
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    m.renderOrder = 3
    scene.add(m)
  }
  const drops: Drop[] = Array.from({ length: MAX_DROPS * 2 }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), floor: 0, r: 0, alive: false, solid: false, axis: new THREE.Vector3(), wallR: 1 }))
  const spawn = (): Drop | null => drops.find((d) => !d.alive) ?? null

  // ---------- Gợn sóng ----------
  const ringGeo = ctx.track(new THREE.RingGeometry(0.82, 1, 40))
  ringGeo.rotateX(-Math.PI / 2)
  const ripples: Ripple[] = Array.from({ length: 10 }, () => {
    const m = new THREE.Mesh(ringGeo, ctx.track(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })))
    m.visible = false
    m.renderOrder = 3
    scene.add(m)
    return { mesh: m, t: 0, maxR: 0, life: 0.7, strength: 1 }
  })

  const ripple = (at: THREE.Vector3, axis: THREE.Vector3, wallR: number, strength = 1) => {
    const r = ripples.find((x) => !x.mesh.visible) ?? ripples.reduce((a, b) => (a.t > b.t ? a : b))
    // Vòng tròn quanh điểm chạm không vượt thành bình.
    const off = Math.hypot(at.x - axis.x, at.z - axis.z)
    r.maxR = Math.max(mm(1.5), Math.min(wallR - off, wallR * 0.9, mm(18)))
    r.mesh.position.set(at.x, at.y + mm(0.3), at.z)
    r.t = 0
    r.life = 0.55 + 0.25 * strength
    r.strength = strength
    r.mesh.visible = true
  }

  const tmpM = new THREE.Matrix4()
  const tmpQ = new THREE.Quaternion()
  const tmpS = new THREE.Vector3()
  const P = new THREE.Vector3()
  const T = new THREE.Vector3()
  const S = new THREE.Vector3()
  const N = new THREE.Vector3()
  const UP = new THREE.Vector3(0, 1, 0)
  let time = 0

  return {
    setTint(hex, density, opaque = false) {
      uniforms.uTint.value.set(hex)
      // Dung dịch không màu: thân dòng gần như trong, chỉ thấy nhờ mép sáng + gợn sáng.
      uniforms.uBase.value = 0.1 + 0.55 * THREE.MathUtils.clamp(density, 0, 1)
      uniforms.uOpaque.value = opaque ? 1 : 0
      dropMat.color.set(hex).lerp(new THREE.Color(0xffffff), 0.5 - 0.4 * density)
      dropMat.opacity = 0.45 + 0.4 * density
    },
    setStream(lip, land, r0, head, tail) {
      if (head - tail < 1e-3) {
        stream.visible = false
        return
      }
      stream.visible = true
      const hx = land.x - lip.x
      const hz = land.z - lip.z
      const drop = Math.max(1e-3, lip.y - land.y)
      const tFall = Math.sqrt((2 * drop) / G)
      const v0 = Math.max(0.6, Math.hypot(hx, hz) / tFall)
      const side = new THREE.Vector3(-hz, 0, hx)
      if (side.lengthSq() < 1e-8) side.set(1, 0, 0)
      side.normalize()
      for (let i = 0; i < RINGS; i++) {
        const k = i / (RINGS - 1)
        const s = tail + (head - tail) * k
        // Quỹ đạo ném ngang + rung nhẹ ngang dòng (tăng dần về phía dưới).
        const wob = mm(0.35) * s * Math.sin(s * 19 - time * 11) * Math.min(1, r0 / mm(1.2))
        P.set(lip.x + hx * s + side.x * wob, lip.y - drop * s * s, lip.z + hz * s + side.z * wob)
        T.set(hx, -2 * drop * s, hz).normalize()
        S.crossVectors(T, UP)
        if (S.lengthSq() < 1e-8) S.copy(side)
        S.normalize()
        N.crossVectors(S, T).normalize()
        // Bảo toàn lưu lượng: dòng nhanh dần thì thắt lại; cộng gợn Rayleigh–Plateau nhỏ.
        const v = Math.sqrt(v0 * v0 + 2 * G * drop * s * s)
        let r = r0 * Math.max(0.38, Math.sqrt(v0 / v)) * (1 + 0.13 * s * Math.sin(s * 55 - time * 32))
        // Đầu dòng tròn như giọt, đuôi vuốt nhọn khi đã rời mép.
        if (i === RINGS - 1) r *= head < 0.999 ? 0.55 : 0.8
        if (i === 0 && tail > 0) r *= 0.3
        for (let j = 0; j <= SIDES; j++) {
          const a = (j / SIDES) * Math.PI * 2
          const ca = Math.cos(a)
          const sa = Math.sin(a)
          const nx = S.x * ca + N.x * sa
          const ny = S.y * ca + N.y * sa
          const nz = S.z * ca + N.z * sa
          const o = (i * (SIDES + 1) + j) * 3
          pos[o] = P.x + nx * r
          pos[o + 1] = P.y + ny * r
          pos[o + 2] = P.z + nz * r
          nor[o] = nx
          nor[o + 1] = ny
          nor[o + 2] = nz
          const u = (i * (SIDES + 1) + j) * 2
          uv[u] = j / SIDES
          uv[u + 1] = s * drop * 10
        }
      }
      geo.attributes.position!.needsUpdate = true
      geo.attributes.normal!.needsUpdate = true
      geo.attributes.uv!.needsUpdate = true
    },
    hideStream() {
      stream.visible = false
    },
    splash(at, n, strength, axis, wallR) {
      for (let i = 0; i < n; i++) {
        const d = spawn()
        if (!d) return
        const a = Math.random() * Math.PI * 2
        const h = (0.25 + Math.random() * 0.9) * strength
        d.p.set(at.x + Math.cos(a) * mm(0.8), at.y + mm(0.3), at.z + Math.sin(a) * mm(0.8))
        d.v.set(Math.cos(a) * h, (1.2 + Math.random() * 2.4) * strength, Math.sin(a) * h)
        d.floor = at.y
        d.r = mm(0.35 + Math.random() * 0.6)
        d.solid = false
        d.axis.copy(axis)
        d.wallR = wallR
        d.alive = true
      }
    },
    drip(from, floorY, axis, wallR, size = mm(1.1), solid = false) {
      const d = spawn()
      if (!d) return
      d.p.copy(from)
      d.v.set((Math.random() - 0.5) * 0.05, -0.05, (Math.random() - 0.5) * 0.05)
      d.floor = floorY
      d.r = size
      d.solid = solid
      d.axis.copy(axis)
      d.wallR = wallR
      d.alive = true
    },
    ripple,
    update(dt) {
      time += dt
      uniforms.uTime.value = time
      let nd = 0
      let ng = 0
      for (const d of drops) {
        if (!d.alive) continue
        d.v.y -= G * dt
        d.p.addScaledVector(d.v, dt)
        // Bật lại khi chạm thành trong.
        const dx = d.p.x - d.axis.x
        const dz = d.p.z - d.axis.z
        const off = Math.hypot(dx, dz)
        if (off > d.wallR - d.r && off > 1e-6) {
          const k = (d.wallR - d.r) / off
          d.p.x = d.axis.x + dx * k
          d.p.z = d.axis.z + dz * k
          d.v.x *= -0.3
          d.v.z *= -0.3
        }
        if (d.p.y <= d.floor && d.v.y < 0) {
          d.alive = false
          if (!d.solid && d.r > mm(0.7)) ripple(d.p.setY(d.floor), d.axis, d.wallR, 0.6)
          continue
        }
        const target = d.solid ? grainMesh : dropMesh
        const n = d.solid ? ng++ : nd++
        if (n >= MAX_DROPS) continue
        // Giọt rơi nhanh hơi kéo dài theo phương chuyển động.
        const stretch = d.solid ? 1 : 1 + Math.min(0.8, Math.abs(d.v.y) * 0.25)
        tmpS.set(d.r, d.r * stretch, d.r)
        tmpM.compose(d.p, tmpQ.identity(), tmpS)
        target.setMatrixAt(n, tmpM)
      }
      dropMesh.count = Math.min(nd, MAX_DROPS)
      grainMesh.count = Math.min(ng, MAX_DROPS)
      dropMesh.instanceMatrix.needsUpdate = true
      grainMesh.instanceMatrix.needsUpdate = true
      for (const r of ripples) {
        if (!r.mesh.visible) continue
        r.t += dt
        const e = r.t / r.life
        if (e >= 1) {
          r.mesh.visible = false
          continue
        }
        const rad = mm(0.8) + r.maxR * (1 - (1 - e) * (1 - e))
        r.mesh.scale.set(rad, 1, rad)
        ;(r.mesh.material as THREE.MeshBasicMaterial).opacity = 0.32 * r.strength * (1 - e)
      }
    },
    clear() {
      stream.visible = false
      for (const d of drops) d.alive = false
      dropMesh.count = 0
      grainMesh.count = 0
      for (const r of ripples) r.mesh.visible = false
    },
    setGrainColor(hex) {
      solidMat.color.set(hex)
    },
  }
}
