import { describe as group, expect, it } from 'vitest'
import type { Indicator } from '../../src/chem/index'
import {
  applyUse, bubbleGas, crossCheck, heatCheck, heatStep, kineticTick, makeContent, planUse, splintTest, takeNewGas,
  type Content, type UsePlan,
} from '../../src/lab/chem/core'

const tube = () => makeContent('t', 'Ống nghiệm', 'container', 20)
const beaker = () => makeContent('b', 'Cốc 250 mL', 'container', 250)
const stock = (s: string, c: number) => makeContent(s, s, 'stock', 300, { speciesId: s, concM: c, volumeMl: 180 })
const solid = (s: string) => makeContent(s, s, 'solidStock', 100, { speciesId: s, grams: 50 })
const ind = (i: Indicator) => makeContent(i, `Lọ nhỏ giọt ${i}`, 'indicator', 30, undefined, i)

function use(a: Content, b: Content, plan?: UsePlan, now = 0) {
  const p = plan ?? planUse(a, b)
  if ('error' in p) throw new Error(p.error)
  return applyUse(a, b, p, {}, now)
}
const eqs = (o: ReturnType<typeof use>) => o.result?.equations.map((e) => e.ascii).join(' | ') ?? ''

group('lõi hóa học của phòng: thao tác → bộ máy', () => {
  it('đổ vào bình trống chỉ chuyển chất; đổ tiếp mới phán xét', () => {
    const t = tube()
    expect(use(stock('NaOH', 1), t).result).toBeNull()
    expect(use(ind('phenolphthalein'), t).indicatorOnly).toBe(true)
    const o = use(stock('HCl', 1), t)
    expect(o.result?.happened).toBe(true)
    expect(eqs(o)).toContain('HCl + NaOH -> NaCl + H2O')
  })

  it.each([
    ['H2SO4', 1, 'HCl', 1, 'SAME_CLASS_ACIDS'],
    ['NaF', 0.5, 'AgNO3', 0.1, 'PRODUCTS_ALL_SOLUBLE'],
    ['NaCl', 0.5, 'Br2', 0.05, 'WEAKER_OXIDIZER'],
  ])('%s + %s: không phản ứng, có lý do', (a, ca, b, cb, reason) => {
    const t = tube()
    use(stock(a, ca), t)
    const o = use(stock(b, cb), t)
    expect(o.result?.happened).toBe(false)
    expect(o.result?.reasonCode).toBe(reason)
    expect(o.result?.explanationVi.length).toBeGreaterThan(10)
  })

  it.each([
    ['Na2SO4', 0.5, 'BaCl2', 0.1, 'BaSO4(s)'],
    ['Na2CO3', 0.5, 'HCl', 1, 'CO2(g)'],
    ['NaBr', 0.5, 'AgNO3', 0.1, 'AgBr(s)'],
    ['KI', 0.5, 'Cl2', 0.05, 'I2'],
  ])('%s + %s → %s', (a, ca, b, cb, product) => {
    const t = tube()
    use(stock(a, ca), t)
    expect(eqs(use(stock(b, cb), t))).toContain(product)
  })

  it('Zn + HCl sủi H₂ dần, que đóm nổ "pép"; Cu + HCl không', () => {
    const t = tube()
    use(solid('Zn'), t)
    use(stock('HCl', 1), t)
    let gas = 0
    for (let i = 1; i <= 5; i++) gas += kineticTick(t, 1, i).gas.length
    expect(gas).toBeGreaterThan(0)
    expect(splintTest(t, 5).sound).toBe('lab/h2-pop')
    const c = tube()
    use(solid('Cu'), c)
    expect(use(stock('HCl', 1), c).result?.reasonCode).toBe('METAL_BELOW_H')
  })

  it('đinh sắt thả vào CuSO₄: đồng bám; bình nguồn hết đinh', () => {
    const t = tube()
    use(stock('CuSO4', 0.5), t)
    const nail = makeContent('n', 'Đinh sắt', 'sample', 0, { speciesId: 'Fe', grams: 2 })
    const o = use(nail, t)
    expect(o.result?.phenomena.some((p) => p.type === 'metal_coating')).toBe(true)
    expect(Object.keys(nail.mixture.solids)).toHaveLength(0)
  })

  it('Cu + H₂SO₄ đặc: nguội không, đun thì SO₂ + cảnh báo khí độc', () => {
    const t = tube()
    use(solid('Cu'), t)
    expect(use(stock('H2SO4', 18), t).result?.reasonCode).toBe('NEEDS_HEAT')
    let hot = null
    for (let i = 0; i < 30 && !hot?.happened; i++) {
      heatStep(t, 1, 'lamp')
      hot = heatCheck(t, {}, i) ?? hot
    }
    expect(hot?.equations[0]?.ascii).toContain('SO2')
    expect(hot?.safety.some((s) => s.code === 'TOXIC_GAS_OUTSIDE_HOOD')).toBe(true)
  })

  it('đèn cồn không đủ nung CaCO₃ (NEEDS_HEAT), đủ nhiệt phân NaHCO₃', () => {
    const a = tube()
    use(solid('CaCO3'), a)
    const b = tube()
    use(solid('NaHCO3'), b)
    const seen = { a: [] as string[], b: [] as boolean[] }
    for (let i = 0; i < 60; i++) {
      heatStep(a, 1, 'lamp')
      heatStep(b, 1, 'lamp')
      const ra = heatCheck(a, {}, i)
      const rb = heatCheck(b, {}, i)
      if (ra) seen.a.push(ra.reasonCode)
      if (rb) seen.b.push(rb.happened)
    }
    expect(a.mixture.temperatureC).toBeLessThanOrEqual(400)
    expect(seen.a.every((r) => r === 'NEEDS_HEAT')).toBe(true)
    expect(seen.b).toContain(true)
  })

  it('trung hòa 50 mL + 50 mL 1 M tăng ≈ 6,8 °C', () => {
    const b = beaker()
    use(stock('NaOH', 1), b, { type: 'pour', ml: 50 })
    use(stock('HCl', 1), b, { type: 'pour', ml: 50 })
    expect(b.mixture.temperatureC - 25).toBeCloseTo(6.8, 0)
  })

  it('Na₂S₂O₃ + HCl: dấu X khuất ≈ 60 s ở 25 °C, nhanh gấp đôi ở 35 °C', () => {
    const times = [25, 35].map((T) => {
      const b = beaker()
      use(stock('Na2S2O3', 0.1), b, { type: 'pour', ml: 50 })
      b.mixture.temperatureC = T
      use(stock('HCl', 1), b, { type: 'pour', ml: 10 }, 0)
      let hid: number | null = null
      for (let t = 0.5; t < 200 && hid === null; t += 0.5) {
        kineticTick(b, 0.5, t)
        hid = crossCheck(b, t)
      }
      return hid!
    })
    expect(times[0]).toBeGreaterThan(45)
    expect(times[0]).toBeLessThan(75)
    expect(times[0]! / times[1]!).toBeGreaterThan(1.6)
  })

  it('H₂O₂: không xúc tác thì que đóm không bùng; có MnO₂ thì bùng', () => {
    const plain = tube()
    use(stock('H2O2', 0.9), plain)
    kineticTick(plain, 1, 1)
    expect(splintTest(plain, 1).flame).toBe('ember')
    const cat = tube()
    use(stock('H2O2', 0.9), cat)
    use(solid('MnO2'), cat)
    kineticTick(cat, 1, 1)
    expect(splintTest(cat, 1).flame).toBe('flame')
  })

  it('dẫn CO₂ vào nước vôi trong → CaCO₃ kết tủa', () => {
    const gen = tube()
    use(solid('CaCO3'), gen)
    use(stock('HCl', 1), gen)
    const lw = tube()
    use(stock('Ca(OH)2', 0.02), lw)
    const seen = {}
    kineticTick(gen, 1, 1)
    const r = bubbleGas(lw, takeNewGas(gen, seen), {}, 1)
    expect(r?.equations[0]?.ascii).toContain('CaCO3(s)')
  })

  it('từ chối: đổ ngược vào chai gốc, bình nguồn trống, nhỏ chỉ thị vào bình trống', () => {
    expect(planUse(stock('HCl', 1), stock('NaOH', 1))).toHaveProperty('error')
    expect(planUse(tube(), tube())).toHaveProperty('error')
    expect(planUse(ind('litmus'), tube())).toHaveProperty('error')
  })
})
