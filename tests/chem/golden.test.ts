import { describe as group, expect, it } from 'vitest'
import { concentration, describe, parseAmount } from '../../src/chem/index'
import { phenKey, runCase, type Case } from './runCase'
import golden from './golden.json'

group('ca vàng (SGK lớp 9 + Hóa 10)', () => {
  for (const c of golden as Case[]) {
    it(c.id, () => {
      const e = c.expect
      if (c.op === 'describe') {
        const app = describe(parseAmount(c.a))
        if (e.indicator) expect(app.indicatorState).toBe(e.indicator)
        if (e.colorFrom) expect(app.colorSources).toContain(e.colorFrom)
        return
      }
      const r = runCase(c)!
      const ctx = `${r.reasonCode} | ${r.equations.map((q) => q.ascii).join(' ; ')} | ${r.phenomena.map(phenKey).join(', ')}`
      if (e.happened !== undefined) expect(r.happened, ctx).toBe(e.happened)
      if (e.reason) expect(r.reasonCode, ctx).toBe(e.reason)
      if (e.eq) expect(r.equations.map((q) => q.ascii), ctx).toContain(e.eq)
      const prods = r.equations.flatMap((q) => q.products.map((t) => t.species))
      for (const p of e.products ?? []) expect(prods, ctx).toContain(p)
      const ph = r.phenomena.map(phenKey)
      for (const p of e.phen ?? []) expect(ph.some((k) => k === p || k.startsWith(p + ':')), ctx).toBe(true)
      for (const p of e.noPhen ?? []) expect(ph, ctx).not.toContain(p)
      const app = describe(r.mixtureAfter)
      if (e.indicator) expect(app.indicatorState, ctx).toBe(e.indicator)
      if (e.colorFrom) expect(app.colorSources, ctx).toContain(e.colorFrom)
      const codes = r.safety.map((s) => s.code)
      if (e.safety?.length === 0) expect(codes.filter((x) => x !== 'CONC_ACID_HANDLING')).toEqual([])
      for (const s of e.safety ?? []) expect(codes, ctx).toContain(s)
      for (const s of e.noSafety ?? []) expect(codes, ctx).not.toContain(s)
      if (e.dT) expect(Math.sign(r.mixtureAfter.temperatureC - 25), ctx).toBe(e.dT)
      if (e.would) expect(r.wouldHappenIf?.noteVi, ctx).toBeTruthy()
      if (e.kinetic) expect(Object.keys(r.mixtureAfter.kinetic ?? {}).length, ctx).toBeGreaterThan(0)
      if (e.equations) expect(r.equations.length, ctx).toBe(e.equations)
      for (const [id, C] of Object.entries(e.concAfter ?? {})) expect(concentration(r.mixtureAfter, id)).toBeCloseTo(C, 6)
      expect(r.explanationVi).not.toMatch(/MISSING_TEXT|\{\w+\}/)
    })
  }
})
