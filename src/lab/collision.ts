import type { Box2 } from './layout'

/** Đẩy hình tròn (px, pz, r) ra khỏi hộp theo hướng xâm nhập ít nhất. Trả vị trí mới. */
export function resolveCircleAABB(px: number, pz: number, r: number, b: Box2): [number, number] {
  const cx = Math.max(b.minX, Math.min(px, b.maxX))
  const cz = Math.max(b.minZ, Math.min(pz, b.maxZ))
  const dx = px - cx
  const dz = pz - cz
  const d2 = dx * dx + dz * dz
  if (d2 > r * r) return [px, pz]
  if (d2 > 1e-12) {
    // Tâm ở ngoài hộp: đẩy theo pháp tuyến từ điểm gần nhất (trượt mượt quanh góc).
    const d = Math.sqrt(d2)
    return [cx + (dx / d) * r, cz + (dz / d) * r]
  }
  // Tâm nằm trong hộp: ra theo cạnh gần nhất.
  const opts: [number, number, number][] = [
    [px - b.minX, b.minX - r, pz],
    [b.maxX - px, b.maxX + r, pz],
    [pz - b.minZ, px, b.minZ - r],
    [b.maxZ - pz, px, b.maxZ + r],
  ]
  opts.sort((a, c) => a[0] - c[0])
  const [, x, z] = opts[0]!
  return [x, z]
}

/** Lặp vài lần qua mọi hộp để không kẹt ở góc. */
export function resolveCollisions(px: number, pz: number, r: number, boxes: readonly Box2[], iterations = 4): [number, number] {
  let x = px
  let z = pz
  for (let i = 0; i < iterations; i++) {
    let moved = false
    for (const b of boxes) {
      const [nx, nz] = resolveCircleAABB(x, z, r, b)
      if (nx !== x || nz !== z) {
        moved = true
        x = nx
        z = nz
      }
    }
    if (!moved) break
  }
  return [x, z]
}

export function overlaps(px: number, pz: number, r: number, boxes: readonly Box2[]): boolean {
  return boxes.some((b) => {
    const cx = Math.max(b.minX, Math.min(px, b.maxX))
    const cz = Math.max(b.minZ, Math.min(pz, b.maxZ))
    return (px - cx) ** 2 + (pz - cz) ** 2 < r * r - 1e-9
  })
}
