/* CLI bộ máy hóa học: npm run chem -- mix "HCl 1M 20ml" "Na2CO3 0.5M 10ml" [--heated] [--temp 60] [--hood] [--catalyst MnO2] */
import { describe, heat, listSpecies, mix, parseAmount, step, toDisplay, type Conditions, type ReactionResult } from '../src/chem/index'

const [cmd, ...args] = process.argv.slice(2)
const flags = new Set(args.filter((a) => a.startsWith('--')))
const val = (name: string) => {
  const i = args.indexOf(name)
  return i >= 0 ? args[i + 1] : undefined
}
const positional = args.filter((a, i) => !a.startsWith('--') && !['--temp', '--catalyst', '--step'].includes(args[i - 1] ?? ''))
const cond: Partial<Conditions> = {
  heated: flags.has('--heated') || undefined,
  temperatureC: val('--temp') ? Number(val('--temp')) : flags.has('--heated') ? 120 : undefined,
  inFumeHood: flags.has('--hood'),
  catalyst: val('--catalyst'),
}

function print(r: ReactionResult) {
  console.log(r.happened ? '✔ CÓ PHẢN ỨNG' : `✘ KHÔNG PHẢN ỨNG (${r.reasonCode})`)
  for (const e of r.equations) console.log('  ' + e.text)
  console.log('  ' + r.explanationVi)
  if (r.wouldHappenIf) console.log('  → ' + r.wouldHappenIf.noteVi)
  for (const s of r.safety) console.log(`  [${s.level}] ${s.messageVi}`)
  const a = describe(r.mixtureAfter)
  const fmt = (o: Record<string, number>) => Object.entries(o).map(([k, v]) => `${toDisplay(k)} ${v.toExponential(2)}`).join(', ') || '–'
  console.log(`  Sau: ${(r.mixtureAfter.volumeL * 1000).toFixed(1)} mL, ${r.mixtureAfter.temperatureC.toFixed(1)} °C, pH ${a.pH?.toFixed(2) ?? '–'}, màu ${a.colorHex} (${a.opacity.toFixed(2)})${a.indicatorState ? ', chỉ thị ' + a.indicatorState : ''}`)
  console.log(`  Tan: ${fmt(r.mixtureAfter.solutes)} | Rắn: ${fmt(r.mixtureAfter.solids)} | Khí: ${fmt(r.mixtureAfter.gases)}`)
}

if (cmd === 'mix') {
  let r = mix(parseAmount(positional[0]!), parseAmount(positional[1]!), cond)
  print(r)
  const s = val('--step')
  if (s) {
    const st = step(r.mixtureAfter, Number(s), cond)
    console.log(`Sau ${s} s:`, JSON.stringify(st.progress))
    r = { ...r, mixtureAfter: st.mixture }
    print(r)
  }
} else if (cmd === 'heat') {
  print(heat(parseAmount(positional[0]!), Number(positional[1] ?? 300), cond))
} else if (cmd === 'list') {
  for (const s of listSpecies()) console.log(`${s.id.padEnd(12)} ${s.nameVi} / ${s.nameEn}`)
} else {
  console.log('Lệnh: mix "<A>" "<B>" [--heated] [--temp T] [--hood] [--step giây] | heat "<A>" T | list')
}
