// Quét tương tác toàn phòng trên trình duyệt thật (bản dev, cần `npm run dev`):
//  1) 8 loại đồ đại diện × lưới điểm trên MỌI bề mặt (cả vùng cấm, mép ngoài) + đúng vị trí MỌI ổ cắm:
//     cầm → đặt → kiểm tra bất biến (nhìn thấy, đúng mặt, ngoài vùng cấm), gợi ý khớp kết quả, không từ chối oan giữa bề mặt.
//  2) Đinh sắt thả vào mọi loại bình chứa: nằm trong lòng bình.
//  3) Làm lại: mọi đồ hiện và về chỗ.
// Mã thoát 1 nếu có lỗi.   node scripts/visual/sweep.mjs
import { openLab } from './common.mjs'

const { browser, page, errors } = await openLab({ query: 'q=low', width: 1200, height: 800 })
const t0 = Date.now()
const res = await page.evaluate(() => {
  const ix = window.__ix
  const dbg = ix.debug
  const placed = window.__room.placed
  const V = window.__camera.position.constructor
  const cam = window.__camera
  const items = [...placed.values()].filter((p) => p.parentId && p.meta.grabbable)
  const PICK = ['testTube', 'beaker250', 'erlenmeyer250', 'reagentBottle', 'nail', 'thermometer', 'deliveryTube', 'alcoholLamp']
  const byKind = new Map()
  for (const it of items) if (PICK.includes(it.meta.kind) && !byKind.has(it.meta.kind)) byKind.set(it.meta.kind, it)
  const targets = []
  for (const p of placed.values()) {
    for (const s of p.meta.surfaces ?? []) {
      const sx = Math.max(1, (s.maxX - s.minX) / 5)
      const sz = Math.max(0.5, (s.maxZ - s.minZ) / 3)
      for (let x = s.minX - 0.5; x <= s.maxX + 0.5; x += sx)
        for (let z = s.minZ - 0.5; z <= s.maxZ + 0.5; z += sz)
          targets.push({ owner: p, local: [x, s.y + 0.6, z], inside: x > s.minX + 0.6 && x < s.maxX - 0.6 && z > s.minZ + 0.6 && z < s.maxZ - 0.6, sname: s.name })
    }
    for (const s of p.meta.sockets ?? []) targets.push({ owner: placed.get(p.parentId ?? p.id) ?? p, socketOwner: p, local: s.pos })
  }
  const counts = { socket: 0, surface: 0, reject: 0, notHeld: 0 }
  const hintMismatch = []
  const badRejects = {}
  for (const it of byKind.values())
    for (const t of targets) {
      if (!dbg.pick(it.id)) break
      const w = (t.socketOwner ?? t.owner).group.localToWorld(new V(...t.local))
      cam.position.set(w.x, w.y + 5, w.z - 6)
      cam.updateMatrixWorld(true)
      const hint = dbg.hintAt(t.owner.id, w)
      const type = dbg.placeAt(t.owner.id, w)
      counts[type]++
      if (type === 'reject' && t.inside) badRejects[`${it.meta.kind}@${t.owner.id}.${t.sname}`] = (badRejects[`${it.meta.kind}@${t.owner.id}.${t.sname}`] ?? 0) + 1
      const okHint = type === 'socket' ? /kẹp|cắm|ngọn lửa|đặt/.test(hint) : type === 'surface' ? /lên/.test(hint) : /Không|kín/.test(hint)
      if (!okHint) hintMismatch.push(`${it.meta.kind} @ ${t.owner.id}: ${type} / "${hint}"`)
      dbg.returnHome(ix.held?.id ?? it.id)
    }
  const box = (o) => {
    const min = new V(Infinity, Infinity, Infinity)
    const max = new V(-Infinity, -Infinity, -Infinity)
    const v = new V()
    o.updateMatrixWorld(true)
    o.traverse((m) => {
      if (!m.isMesh || !m.visible || m.userData.outlineShell || m.name === 'pick-proxy' || !m.geometry?.attributes?.position) return
      const pos = m.geometry.attributes.position
      for (let i = 0; i < pos.count; i += 7) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld)
        min.min(v)
        max.max(v)
      }
    })
    return { min, max }
  }
  const nail = items.find((p) => p.meta.kind === 'nail')
  const vessels = new Map()
  for (const p of items) if (p.meta.vessel && window.__chem.content(p.id)?.kind === 'container' && !vessels.has(p.meta.kind)) vessels.set(p.meta.kind, p)
  const nailBad = []
  for (const [kind, v] of vessels) {
    dbg.pick(nail.id)
    window.__chem.autoUse(nail.id, v.id)
    const nb = box(nail.group)
    const vb = box(v.meta.vessel.group)
    const e = 0.05
    const ok = nb.min.x >= vb.min.x - e && nb.max.x <= vb.max.x + e && nb.min.z >= vb.min.z - e && nb.max.z <= vb.max.z + e && nb.min.y >= vb.min.y - e && nb.max.y <= vb.max.y + e
    if (!ok) nailBad.push(kind)
    ix.resetAll()
    window.__chem.reset()
  }
  const hidden = items.filter((p) => { for (let o = p.group; o; o = o.parent) if (!o.visible) return true; return false }).map((p) => p.id)
  return { kinds: byKind.size, targets: targets.length, vessels: vessels.size, counts, problems: [...new Set(dbg.problems)], badRejects, hintMismatch: hintMismatch.slice(0, 10), nailBad, hidden }
})
await browser.close()
const fails = [
  ...res.problems,
  ...Object.entries(res.badRejects).map(([k, n]) => `từ chối oan ${n} lần: ${k}`),
  ...res.hintMismatch.map((h) => `gợi ý lệch: ${h}`),
  ...res.nailBad.map((k) => `đinh lọt ra ngoài: ${k}`),
  ...res.hidden.map((id) => `bị ẩn sau Làm lại: ${id}`),
  ...errors.map((e) => `lỗi trang: ${e}`),
]
const n = res.counts.socket + res.counts.surface + res.counts.reject
console.log(`${res.kinds} loại đồ × ${res.targets} điểm bấm = ${n} lần đặt (ổ ${res.counts.socket}, bề mặt ${res.counts.surface}, từ chối ${res.counts.reject}); đinh vào ${res.vessels} loại bình; ${((Date.now() - t0) / 1000).toFixed(0)} s`)
if (fails.length) {
  console.log(`LỖI (${fails.length}):\n  ` + fails.join('\n  '))
  process.exit(1)
}
console.log('Không có lỗi.')
