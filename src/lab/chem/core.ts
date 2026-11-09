import {
  cloneMixture, describe, getSpecies, heat, makeGas, makeSolid, makeSolution, makeWater, mix, step, toDisplay,
  type Conditions, type Indicator, type Mixture, type Phenomenon, type ReactionResult,
} from '../../chem/index'

/**
 * Lõi hóa học của phòng (thuần, không three): nội dung từng bình và ý nghĩa của "dùng vật đang cầm lên vật khác".
 * Mọi phản ứng đi qua bộ máy `src/chem` – ở đây KHÔNG có cặp chất nào được gọi tên.
 */
export type ContentKind =
  /** Dụng cụ chứa (cốc, ống nghiệm, bình…): nhận và cho đi được. */
  | 'container'
  /** Chai dung dịch gốc: chỉ cho đi (không đổ ngược vào). */
  | 'stock'
  /** Lọ chất rắn gốc: xúc từng thìa. */
  | 'solidStock'
  /** Lọ nhỏ giọt chỉ thị. */
  | 'indicator'
  /** Bình tia nước cất. */
  | 'water'
  /** Mẫu rắn thả nguyên (đinh sắt). */
  | 'sample'

export interface Content {
  id: string
  name: string
  kind: ContentKind
  mixture: Mixture
  capacityMl: number
  indicator?: Indicator
  /** Đang nằm trong tủ hút / có nút đậy (điều kiện cho bộ máy). */
  inFumeHood?: boolean
  /** Khí thoát ra gần đây: chất → thời điểm (s, giờ mô phỏng) – để thử bằng que đóm. */
  recentGas: Record<string, number>
  /** Thời điểm trộn gần nhất (s) – đo thời gian khuất dấu X. */
  mixedAt?: number
  crossHidden?: boolean
  /** Lần đun gần nhất đã gọi bộ máy ở nhiệt độ nào (tránh gọi mỗi khung hình). */
  heatEvalC?: number
}

export interface ContentSpec { speciesId?: string; concM?: number; volumeMl?: number; grams?: number }

/** Tạo nội dung ban đầu cho một vật theo loại và `meta.chem` của nó. */
export function makeContent(id: string, name: string, kind: ContentKind, capacityMl: number, spec?: ContentSpec, indicator?: Indicator): Content {
  let mixture: Mixture
  if (kind === 'water') mixture = makeWater(spec?.volumeMl ?? 400)
  else if (kind === 'indicator') mixture = makeWater(20, indicator)
  else if (spec?.speciesId && spec.grams !== undefined) mixture = makeSolid(spec.speciesId, spec.grams)
  else if (spec?.speciesId) mixture = makeSolution(spec.speciesId, spec.concM ?? 1, spec.volumeMl ?? 180)
  else mixture = makeWater(0)
  return { id, name, kind, mixture, capacityMl, indicator, recentGas: {} }
}

export const volumeMl = (m: Mixture) => m.volumeL * 1000
const hasSolutes = (m: Mixture) => Object.values(m.solutes).some((x) => x > 1e-12)
const hasSolids = (m: Mixture) => Object.values(m.solids).some((x) => x > 1e-12)
export const isEmpty = (m: Mixture) => volumeMl(m) < 1e-6 && !hasSolids(m) && !hasSolutes(m)

/** Lấy phần `f` (0…1) của hỗn hợp (dung dịch và cặn chia theo tỉ lệ). Trả về [phần lấy, phần còn]. */
export function splitMixture(m: Mixture, f: number): [Mixture, Mixture] {
  const k = Math.min(1, Math.max(0, f))
  const take = cloneMixture(m)
  const rest = cloneMixture(m)
  take.volumeL = m.volumeL * k
  rest.volumeL = m.volumeL - take.volumeL
  for (const key of ['solutes', 'solids'] as const)
    for (const [id, mol] of Object.entries(m[key])) {
      take[key][id] = mol * k
      rest[key][id] = mol - mol * k
    }
  take.gases = {}
  delete take.kinetic
  return [take, rest]
}

/** Tên ngắn của nội dung: "dd HCl 1 M", "Zn", "nước cất", "trống". */
export function contentLabel(m: Mixture): string {
  const V = m.volumeL
  const parts: string[] = []
  const solutes = Object.entries(m.solutes).filter(([, mol]) => mol > 1e-9).sort((a, b) => b[1] - a[1])
  for (const [id, mol] of solutes.slice(0, 2)) {
    const c = V > 0 ? mol / V : 0
    parts.push(`${toDisplay(getSpecies(id).formula)}${c > 0 ? ` ${fmt(c)} M` : ''}`)
  }
  for (const [id] of Object.entries(m.solids).filter(([, mol]) => mol > 1e-9).slice(0, 2)) parts.push(toDisplay(getSpecies(id).formula))
  if (parts.length) return (solutes.length ? 'dd ' : '') + parts.join(' + ')
  return V > 0 ? 'nước cất' : 'trống'
}

export const fmt = (x: number, digits = 2) => {
  const r = Number(x.toPrecision(digits))
  return String(r).replace('.', ',')
}

// ---------- Dùng vật đang cầm lên vật khác ----------

export type UsePlan =
  | { type: 'pour'; ml: number }
  | { type: 'drop'; drops: number }
  | { type: 'scoop'; grams: number }
  | { type: 'sample' }

export const DROP_ML = 0.05

/** Lượng rót mặc định theo dung tích bình nhận: ống nghiệm 2 mL, cốc/bình nhỏ 10 mL, cốc lớn 25 mL. */
export function defaultPourMl(src: Content, dst: Content): number {
  const fromTube = src.kind === 'container' && src.capacityMl <= 40
  if (fromTube) return volumeMl(src.mixture)
  return dst.capacityMl <= 40 ? 2 : dst.capacityMl <= 150 ? 10 : 25
}

/** Quyết định thao tác (hoặc lý do không làm được) khi dùng `src` lên `dst`. */
export function planUse(src: Content, dst: Content): UsePlan | { error: string } {
  if (src === dst) return { error: 'Không thể đổ vào chính nó' }
  if (dst.kind !== 'container') {
    if (dst.kind === 'stock' || dst.kind === 'solidStock' || dst.kind === 'indicator')
      return { error: 'Không đổ ngược vào lọ hóa chất gốc – lấy một ống nghiệm hoặc cốc sạch để làm thí nghiệm' }
    return { error: `Không cho chất vào ${dst.name}` }
  }
  const free = dst.capacityMl - volumeMl(dst.mixture)
  if (src.kind === 'indicator') return volumeMl(dst.mixture) > 0 ? { type: 'drop', drops: 2 } : { error: 'Nhỏ chỉ thị vào dung dịch – bình này đang trống' }
  if (src.kind === 'solidStock') return { type: 'scoop', grams: 0.5 }
  if (src.kind === 'sample') return { type: 'sample' }
  const have = volumeMl(src.mixture)
  if (have < 1e-6) return { error: `${src.name} đang trống` }
  if (free < 0.05) return { error: `${dst.name} đã đầy` }
  return { type: 'pour', ml: Math.min(have, defaultPourMl(src, dst), free) }
}

export interface UseOutcome {
  /** Câu mô tả thao tác cho sổ: "Rót 2 mL dd HCl 1 M vào Ống nghiệm (dd Na₂CO₃ 0,5 M)". */
  title: string
  /** Kết quả bộ máy (null khi chỉ chuyển chất vào bình trống). */
  result: ReactionResult | null
  plan: UsePlan
  /** Chỉ nhỏ chỉ thị (đổi màu theo môi trường, không phải phản ứng giữa hai chất). */
  indicatorOnly?: boolean
}

/** Thực hiện thao tác: đổi `src.mixture` và `dst.mixture`, gọi bộ máy khi bình nhận đã có chất. */
export function applyUse(src: Content, dst: Content, plan: UsePlan, cond: Partial<Conditions>, now: number): UseOutcome {
  const before = isEmpty(dst.mixture)
  const dstLabel = before ? dst.name : `${dst.name} (${contentLabel(dst.mixture)})`
  let added: Mixture
  let what: string
  if (plan.type === 'pour') {
    const label = contentLabel(src.mixture)
    const [take, rest] = splitMixture(src.mixture, plan.ml / volumeMl(src.mixture))
    if (src.kind !== 'water') src.mixture = rest
    added = take
    what = `Rót ${fmt(plan.ml)} mL ${label}`
  } else if (plan.type === 'drop') {
    added = makeWater(plan.drops * DROP_ML, src.indicator)
    what = `Nhỏ ${plan.drops} giọt ${src.name.replace(/^Lọ nhỏ giọt /, '')}`
  } else if (plan.type === 'scoop') {
    const id = Object.keys(src.mixture.solids)[0]!
    added = makeSolid(id, plan.grams)
    what = `Cho ${fmt(plan.grams)} g ${toDisplay(getSpecies(id).formula)}`
  } else {
    added = src.mixture
    src.mixture = makeWater(0)
    what = `Thả ${src.name}`
  }
  const title = `${what} vào ${dstLabel}`
  if (before) {
    // Bình trống: chỉ chuyển chất, chưa có gì để phán xét.
    dst.mixture = cloneMixture(added)
    return { title, result: null, plan }
  }
  const r = mix(dst.mixture, added, { ...cond, temperatureC: dst.mixture.temperatureC })
  dst.mixture = r.mixtureAfter
  dst.mixedAt = now
  dst.crossHidden = false
  noteGas(dst, r.phenomena, now)
  return { title, result: r, plan, indicatorOnly: plan.type === 'drop' && !r.happened }
}

/** Ghi khí thoát ra (bỏ qua lượng vết – H₂O₂ tự phân hủy rất chậm không làm que đóm bùng). */
function noteGas(c: Content, ph: Phenomenon[], now: number) {
  for (const p of ph) if (p.type === 'gas' && p.intensity >= 0.02) c.recentGas[p.species] = now
}

// ---------- Dẫn khí ----------

/** Khí (mol) bình nguồn sinh ra trong lần gọi này – lấy từ phần tăng của `mixture.gases` kể từ lần trước. */
export function takeNewGas(c: Content, seen: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [id, mol] of Object.entries(c.mixture.gases)) {
    const d = mol - (seen[id] ?? 0)
    if (d > 1e-12) out[id] = d
    seen[id] = mol
  }
  return out
}

/** Sục khí vào bình nhận (CO₂ vào nước vôi trong, Cl₂ vào dung dịch…) qua bộ máy. */
export function bubbleGas(dst: Content, gas: Record<string, number>, cond: Partial<Conditions>, now: number): ReactionResult | null {
  const ids = Object.keys(gas)
  if (!ids.length || volumeMl(dst.mixture) < 0.01) return null
  let r: ReactionResult | null = null
  for (const id of ids) {
    r = mix(dst.mixture, makeGas(id, gas[id]!), { ...cond, temperatureC: dst.mixture.temperatureC })
    dst.mixture = r.mixtureAfter
  }
  dst.mixedAt ??= now
  return r
}

// ---------- Đun ----------

/** Nguồn nhiệt: tốc độ tăng (°C/s cho 100 mL) và nhiệt độ tối đa (chất rắn khô). */
export const HEATERS = {
  lamp: { rate: 0.6, maxSolidC: 400 },
  burner: { rate: 1.2, maxSolidC: 700 },
} as const
export type HeaterKind = keyof typeof HEATERS

/** Một bước nhiệt: đun (nếu có nguồn) hoặc nguội dần về 25 °C. Dung dịch dừng ở 100 °C (sôi). */
export function heatStep(c: Content, dt: number, heater: HeaterKind | null): number {
  const m = c.mixture
  const ml = volumeMl(m)
  let T = m.temperatureC
  if (heater) {
    const h = HEATERS[heater]
    const rate = ml > 0.01 ? Math.min(8, (h.rate * 100) / Math.max(ml, 2)) : 15
    const max = ml > 0.01 ? 100 : h.maxSolidC
    T = Math.min(max, T + rate * dt)
  } else T = 25 + (T - 25) * Math.exp(-0.01 * dt)
  m.temperatureC = T
  return T
}

const HEAT_STEPS = [60, 100, 200, 300, 400, 500, 700]

/** Gọi bộ máy khi đun vượt các mốc nhiệt; null nếu chưa tới mốc mới. */
export function heatCheck(c: Content, cond: Partial<Conditions>, now: number): ReactionResult | null {
  const T = c.mixture.temperatureC
  const last = c.heatEvalC ?? 25
  const mark = HEAT_STEPS.filter((x) => x <= T + 1e-9 && x > last).pop()
  if (mark === undefined || isEmpty(c.mixture)) return null
  c.heatEvalC = mark
  const r = heat(c.mixture, T, { ...cond, heated: true, temperatureC: T })
  if (r.happened) {
    c.mixture = r.mixtureAfter
    c.mixture.temperatureC = T
    noteGas(c, r.phenomena, now)
  }
  return r
}

// ---------- Động học ----------

/** Tiến các phản ứng chậm (kim loại + axit, Na₂S₂O₃, H₂O₂) thêm dt giây; trả về sự kiện khí và độ đục mới. */
export function kineticTick(c: Content, dt: number, now: number): { gas: Phenomenon[]; active: boolean } {
  const m = c.mixture
  if (!m.kinetic && !((m.solutes.H2O2 ?? 0) > 1e-12)) return { gas: [], active: false }
  const s = step(m, dt)
  s.mixture.temperatureC = s.mixture.temperatureC ?? m.temperatureC
  c.mixture = s.mixture
  noteGas(c, s.events, now)
  return { gas: s.events, active: !!c.mixture.kinetic }
}

/** Dấu X khuất khi dung dịch đủ đục (S kết tủa trong thí nghiệm Na₂S₂O₃ + HCl); trả về số giây kể từ khi trộn. */
export function crossCheck(c: Content, now: number, threshold = 0.6): number | null {
  if (c.crossHidden || c.mixedAt === undefined) return null
  if (describe(c.mixture).turbidity < threshold) return null
  c.crossHidden = true
  return now - c.mixedAt
}

// ---------- Thử khí bằng que đóm ----------

export interface SplintTest { sound: string | null; flame: 'ember' | 'flame' | 'out'; textVi: string }

/** Que đóm đưa vào miệng bình: dựa trên khí bình vừa thoát ra (30 s gần nhất). */
export function splintTest(c: Content, now: number): SplintTest {
  const recent = Object.entries(c.recentGas).filter(([, t]) => now - t < 30).map(([id]) => id)
  if (recent.includes('H2')) return { sound: 'lab/h2-pop', flame: 'out', textVi: 'Có tiếng nổ nhỏ "pép" – khí thoát ra là H₂ (cháy được).' }
  if (recent.includes('O2')) return { sound: 'lab/flare-whoosh', flame: 'flame', textVi: 'Que đóm còn tàn đỏ bùng cháy – khí thoát ra là O₂ (duy trì sự cháy).' }
  if (recent.length) {
    const names = recent.map((id) => toDisplay(getSpecies(id).formula)).join(', ')
    return { sound: null, flame: 'out', textVi: `Que đóm tắt – khí ${names} không duy trì sự cháy.` }
  }
  return { sound: null, flame: 'ember', textVi: 'Không có hiện tượng – bình không có khí thoát ra.' }
}
