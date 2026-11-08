import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe as group, expect, it } from 'vitest'
import { DATA, getSpecies, listSpecies } from '../../src/chem/data/index'
import {
  describe, heat, makeSolid, makeSolution, makeWater, merge, mix, molarMassOf, parseFormula, step, toDisplay, ionToDisplay,
  type Mixture, type ReasonCode,
} from '../../src/chem/index'
import { balance } from '../../src/chem/util/balance'
import { elementCounts, parseIon } from '../../src/chem/util/formula'
import { makeEquation } from '../../src/chem/util/equation'
import golden from './golden.json'
import { runCase } from './runCase'

group('công thức', () => {
  it('parse', () => {
    expect(parseFormula('Fe2(SO4)3')).toEqual({ Fe: 2, S: 3, O: 12 })
    expect(parseFormula('CuSO4.5H2O')).toEqual({ Cu: 1, S: 1, O: 9, H: 10 })
    expect(parseFormula('(NH4)2SO4')).toEqual({ N: 2, H: 8, S: 1, O: 4 })
    expect(parseFormula('CH3COOH')).toEqual({ C: 2, H: 4, O: 2 })
    expect(parseFormula('Ca3(PO4)2')).toEqual({ Ca: 3, P: 2, O: 8 })
    expect(parseFormula('K2Cr2O7')).toEqual({ K: 2, Cr: 2, O: 7 })
    expect(parseFormula('Fe(SCN)3')).toEqual({ Fe: 1, S: 3, C: 3, N: 3 })
    expect(parseFormula('(CH3COO)2Ca')).toEqual({ C: 4, H: 6, O: 4, Ca: 1 })
    expect(parseFormula('Al2(SO4)3')).toEqual({ Al: 2, S: 3, O: 12 })
    expect(parseFormula('H2O2')).toEqual({ H: 2, O: 2 })
  })
  it('ion', () => {
    expect(parseIon('SO4^2-')).toEqual({ formula: 'SO4', charge: -2 })
    expect(parseIon('Fe3+')).toEqual({ formula: 'Fe', charge: 3 })
    expect(parseIon('NH4+')).toEqual({ formula: 'NH4', charge: 1 })
    expect(parseIon('Cl-')).toEqual({ formula: 'Cl', charge: -1 })
  })
  it('khối lượng mol', () => {
    expect(molarMassOf('H2SO4')).toBeCloseTo(98.08, 1)
    expect(molarMassOf('NaCl')).toBeCloseTo(58.44, 1)
  })
  it('hiển thị', () => {
    expect(toDisplay('H2SO4')).toBe('H₂SO₄')
    expect(toDisplay('Fe2(SO4)3')).toBe('Fe₂(SO₄)₃')
    expect(toDisplay('CuSO4.5H2O')).toBe('CuSO₄·5H₂O')
    expect(ionToDisplay('SO4^2-')).toBe('SO₄²⁻')
  })
})

group('cân bằng phương trình', () => {
  const cases: [string[], string[], number[]][] = [
    [['Cu', 'HNO3'], ['Cu(NO3)2', 'NO', 'H2O'], [3, 8, 3, 2, 4]],
    [['KMnO4', 'HCl'], ['KCl', 'MnCl2', 'Cl2', 'H2O'], [2, 16, 2, 2, 5, 8]],
    [['KMnO4', 'FeSO4', 'H2SO4'], ['K2SO4', 'MnSO4', 'Fe2(SO4)3', 'H2O'], [2, 10, 8, 1, 2, 5, 8]],
    [['Al', 'NaOH', 'H2O'], ['NaAlO2', 'H2'], [2, 2, 2, 2, 3]],
    [['Fe', 'H2SO4'], ['Fe2(SO4)3', 'SO2', 'H2O'], [2, 6, 1, 3, 6]],
    [['Na2S2O3', 'HCl'], ['NaCl', 'S', 'SO2', 'H2O'], [1, 2, 2, 1, 1, 1]],
  ]
  for (const [r, p, k] of cases) it(`${r.join(' + ')}`, () => {
    const b = balance(r, p)!
    expect([...b.reactants, ...b.products]).toEqual(k)
  })
  it('bậc tự do ≠ 1 → null', () => expect(balance(['KMnO4', 'H2O2', 'H2SO4'], ['K2SO4', 'MnSO4', 'O2', 'H2O'])).toBeNull())
  it('định dạng', () => {
    const e = makeEquation([{ id: 'BaCl2', phase: 'aq' }, { id: 'Na2SO4', phase: 'aq' }], [{ id: 'BaSO4', phase: 's' }, { id: 'NaCl', phase: 'aq' }])!
    expect(e.text).toBe('BaCl₂ + Na₂SO₄ → BaSO₄↓ + 2NaCl')
  })
})

group('dữ liệu chem.json', () => {
  it('mọi chất parse được, khối lượng mol khớp', () => {
    for (const s of listSpecies()) expect(Math.abs(s.molarMass - molarMassOf(s.formula))).toBeLessThan(0.5)
  })
  it('không trùng id', () => {
    const ids = DATA.species.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('ion của chất có trong bảng tính tan', () => {
    for (const s of listSpecies()) if (s.ions) {
      expect(DATA.cations[s.ions.cation], s.id).toBeTruthy()
      expect(DATA.solubility[s.ions.anion], s.id).toBeTruthy()
    }
  })
  it('phương trình bảng oxi hóa – khử và nhiệt phân bảo toàn nguyên tố', () => {
    const f = (id: string) => getSpecies(id).formula
    for (const e of DATA.redoxReactions) {
      const eq = makeEquation(e.reactants.map((id) => ({ id, phase: 'aq' as const })), e.products.map(([id, phase]) => ({ id, phase })), { coefs: e.coefs, productCoefs: e.productCoefs })
      expect(eq, e.id).toBeTruthy()
      expect(elementCounts(eq!.reactants, f), e.id).toEqual(elementCounts(eq!.products, f))
    }
    for (const d of DATA.decompositions) {
      const eq = makeEquation([{ id: d.reactant, phase: 's' }], d.products.map(([id, phase]) => ({ id, phase })), { coefs: d.coefs, productCoefs: d.productCoefs })
      expect(elementCounts(eq!.reactants, f), d.id).toEqual(elementCounts(eq!.products, f))
    }
  })
  it('mọi phương trình sinh ra trong ca vàng bảo toàn nguyên tố', () => {
    const f = (id: string) => getSpecies(id).formula
    for (const c of golden as Parameters<typeof runCase>[0][]) {
      const r = runCase(c)
      for (const e of r?.equations ?? []) expect(elementCounts(e.reactants, f), `${c.id}: ${e.ascii}`).toEqual(elementCounts(e.products, f))
    }
  })
  it('mỗi lý do không phản ứng xuất hiện ít nhất một lần trong ca vàng', () => {
    const all: ReasonCode[] = ['HAPPENED', 'SAME_CLASS_ACIDS', 'SAME_CLASS_BASES', 'PRODUCTS_ALL_SOLUBLE', 'NO_NEW_ION_PAIR', 'METAL_BELOW_H',
      'METAL_LESS_ACTIVE', 'WEAKER_OXIDIZER', 'POTENTIAL_UNFAVORABLE', 'NEEDS_HEAT', 'NEEDS_CONCENTRATED', 'NEEDS_CATALYST', 'PASSIVATED',
      'INERT', 'DILUTION_ONLY', 'SOLIDS_NO_CONTACT']
    const seen = new Set((golden as Parameters<typeof runCase>[0][]).map((c) => runCase(c)?.reasonCode).filter(Boolean))
    for (const r of all) expect(seen.has(r), r).toBe(true)
    expect((golden as unknown[]).length).toBeGreaterThanOrEqual(80)
  })
})

group('dung dịch và trộn tăng dần', () => {
  it('mol và thể tích', () => {
    const m = makeSolution('HCl', 1, 20)
    expect(m.solutes.HCl).toBeCloseTo(0.02, 12)
    expect(merge(m, makeWater(10)).volumeL).toBeCloseTo(0.03, 12)
  })
  const pairs: [string, number, string, number][] = [['HCl', 0.1, 'NaOH', 0.1], ['BaCl2', 0.1, 'Na2SO4', 0.1], ['Na2CO3', 0.1, 'HCl', 0.1]]
  for (const [a, ca, b, cb] of pairs) it(`${a} + ${b}: 10 lần 1 mL = 1 lần 10 mL`, () => {
    const once = mix(makeSolution(a, ca, 20), makeSolution(b, cb, 10)).mixtureAfter
    let m: Mixture = makeSolution(a, ca, 20)
    for (let i = 0; i < 10; i++) m = mix(m, makeSolution(b, cb, 1)).mixtureAfter
    const keys = new Set([...Object.keys(once.solutes), ...Object.keys(m.solutes), ...Object.keys(once.solids), ...Object.keys(m.solids)])
    for (const k of keys) {
      expect(m.solutes[k] ?? 0, k).toBeCloseTo(once.solutes[k] ?? 0, 9)
      expect(m.solids[k] ?? 0, k).toBeCloseTo(once.solids[k] ?? 0, 9)
    }
  })
  it('thuần túy: không đổi đầu vào', () => {
    const a = makeSolution('HCl', 1, 10)
    const b = makeSolution('NaOH', 1, 10)
    const snap = JSON.stringify([a, b])
    mix(a, b)
    expect(JSON.stringify([a, b])).toBe(snap)
  })
})

group('động học', () => {
  const h2After = (conc: number, t: number, T = 25) => {
    const start = mix(makeSolid('Zn', 1), { ...makeSolution('HCl', conc, 50), temperatureC: T }).mixtureAfter
    return step(start, t).mixture.gases.H2 ?? 0
  }
  it('Zn + HCl 2 M nhanh gấp đôi 1 M (đầu phản ứng)', () => {
    const ratio = h2After(2, 5) / h2After(1, 5)
    expect(ratio).toBeGreaterThan(1.8)
    expect(ratio).toBeLessThan(2.2)
  })
  it('Zn 1 g trong 50 mL HCl 1 M gần hết sau ~10 phút', () => {
    const left = step(mix(makeSolid('Zn', 1), makeSolution('HCl', 1, 50)).mixtureAfter, 600).mixture.solids.Zn ?? 0
    expect(left / (1 / 65.38)).toBeLessThan(0.35)
  })
  it('Na2S2O3 + HCl: 35 °C khuất dấu X nhanh ≈ gấp đôi 25 °C; 25 °C khoảng 60 s', () => {
    const hide = (T: number) => {
      let m = mix({ ...makeSolution('Na2S2O3', 0.1, 50), temperatureC: T }, { ...makeSolution('HCl', 1, 5), temperatureC: T }).mixtureAfter
      for (let t = 1; t <= 600; t++) {
        m = step(m, 1).mixture
        if ((m.solids.S ?? 0) / m.volumeL >= DATA.kinetics.thiosulfate.crossHiddenM) return t
      }
      return Infinity
    }
    const t25 = hide(25)
    const t35 = hide(35)
    expect(t25).toBeGreaterThan(40)
    expect(t25).toBeLessThan(90)
    expect(t25 / t35).toBeGreaterThan(1.7)
    expect(t25 / t35).toBeLessThan(2.3)
  })
  it('H2O2: có MnO2 sinh O2 nhiều hơn > 100 lần', () => {
    const cat = step(mix(makeSolution('H2O2', 0.9, 10), makeSolid('MnO2', 0.2)).mixtureAfter, 10).mixture.gases.O2 ?? 0
    const slow = step(makeSolution('H2O2', 0.9, 10), 10).mixture.gases.O2 ?? 0
    expect(slow).toBeGreaterThan(0)
    expect(cat / slow).toBeGreaterThan(100)
  })
  it('xong thì quá trình được gỡ', () => {
    const m = step(mix(makeSolid('Mg', 0.05), makeSolution('HCl', 1, 20)).mixtureAfter, 600).mixture
    expect(m.kinetic).toBeUndefined()
    expect(m.solids.Mg ?? 0).toBe(0)
  })
})

group('nhiệt', () => {
  it('trung hòa 50 mL HCl 1 M + 50 mL NaOH 1 M tăng ≈ 6,8 °C', () => {
    const T = mix(makeSolution('HCl', 1, 50), makeSolution('NaOH', 1, 50)).mixtureAfter.temperatureC
    expect(T - 25).toBeGreaterThan(6.3)
    expect(T - 25).toBeLessThan(7.3)
  })
  it('NH4Cl tan thu nhiệt', () => expect(mix(makeWater(50), makeSolid('NH4Cl', 2)).mixtureAfter.temperatureC).toBeLessThan(25))
})

group('an toàn', () => {
  const codes = (r: { safety: { code: string }[] }) => r.safety.map((s) => s.code)
  it('đổ nước vào axit đặc / đổ axit vào nước', () => {
    expect(codes(mix(makeSolution('H2SO4', 18, 10), makeWater(20)))).toContain('WATER_INTO_CONC_ACID')
    expect(codes(mix(makeWater(50), makeSolution('H2SO4', 18, 5)))).not.toContain('WATER_INTO_CONC_ACID')
  })
  it('khí độc ngoài tủ hút / trong tủ hút', () => {
    expect(codes(mix(makeSolution('Na2SO3', 0.5, 10), makeSolution('H2SO4', 1, 10)))).toContain('TOXIC_GAS_OUTSIDE_HOOD')
    expect(codes(mix(makeSolution('Na2SO3', 0.5, 10), makeSolution('H2SO4', 1, 10), { inFumeHood: true }))).not.toContain('TOXIC_GAS_OUTSIDE_HOOD')
    expect(codes(mix(makeSolution('Na2CO3', 0.5, 10), makeSolution('HCl', 1, 10)))).not.toContain('TOXIC_GAS_OUTSIDE_HOOD')
  })
  it('kim loại kiềm + nước', () => {
    expect(codes(mix(makeWater(50), makeSolid('Na', 0.1)))).toContain('ALKALI_METAL_WATER')
    expect(codes(mix(makeWater(50), makeSolid('Mg', 0.1)))).not.toContain('ALKALI_METAL_WATER')
  })
  it('chất oxi hóa + chất dễ cháy', () => {
    expect(codes(mix(makeSolid('KClO3', 1), makeSolid('S', 1)))).toContain('OXIDIZER_WITH_FLAMMABLE')
    expect(codes(mix(makeSolid('NaCl', 1), makeSolid('S', 1)))).not.toContain('OXIDIZER_WITH_FLAMMABLE')
  })
  it('đun bình kín', () => {
    expect(codes(heat(makeSolution('NaCl', 1, 10), 80, { open: false }))).toContain('HEATING_CLOSED_VESSEL')
    expect(codes(heat(makeSolution('NaCl', 1, 10), 80))).not.toContain('HEATING_CLOSED_VESSEL')
  })
  it('cầm axit đặc', () => {
    expect(codes(mix(makeSolution('HCl', 12, 5), makeWater(50)))).toContain('CONC_ACID_HANDLING')
    expect(codes(mix(makeSolution('HCl', 1, 5), makeWater(50)))).not.toContain('CONC_ACID_HANDLING')
  })
  it('chất lỏng nóng', () => {
    expect(codes(heat(makeSolution('NaCl', 1, 10), 80))).toContain('HOT_LIQUID')
    expect(codes(heat(makeSolution('NaCl', 1, 10), 40))).not.toContain('HOT_LIQUID')
  })
})

group('ngoại hình', () => {
  it('CuSO4 xanh lam, KMnO4 tím, FeCl3 vàng nâu', () => {
    const hue = (id: string, c: number) => describe(makeSolution(id, c, 10)).colorHex
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hue('CuSO4', 0.5).slice(i, i + 2), 16))
    expect(b!).toBeGreaterThan(r!)
    expect(b!).toBeGreaterThan(g!)
    const k = [1, 3, 5].map((i) => parseInt(hue('KMnO4', 0.02).slice(i, i + 2), 16))
    expect(k[0]! > k[1]! && k[2]! > k[1]!).toBe(true)
    const f = [1, 3, 5].map((i) => parseInt(hue('FeCl3', 0.2).slice(i, i + 2), 16))
    expect(f[0]! > f[2]!).toBe(true)
  })
  it('kết tủa làm đục', () => {
    const a = describe(mix(makeSolution('BaCl2', 0.1, 10), makeSolution('Na2SO4', 0.1, 10)).mixtureAfter)
    expect(a.hasPrecipitate).toBe(true)
    expect(a.turbidity).toBeGreaterThan(0.5)
  })
})

group('ranh giới', () => {
  it('src/chem không import three, không dùng DOM', () => {
    const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]))
    for (const f of walk('src/chem').filter((f) => f.endsWith('.ts'))) {
      const src = readFileSync(f, 'utf8')
      expect(src, f).not.toMatch(/from ['"]three/)
      expect(src, f).not.toMatch(/\b(window|document)\./)
    }
  })
})
