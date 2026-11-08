import definition from '../content/chem-text.json'

const TEXT = definition as Record<string, string>

/** Chữ tiếng Việt của bộ máy hóa học; `{tên}` được thay bằng giá trị trong `vars`. */
export function chemText(key: string, vars: Record<string, string | number> = {}): string {
  const value = TEXT[key]
  if (value === undefined) throw new Error(`MISSING_TEXT: ${key}`)
  return value.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`))
}
