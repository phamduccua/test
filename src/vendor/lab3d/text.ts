import definition from '../../content/lab3d.json'

/** Chữ hiển thị của bộ mô phỏng 3D dùng chung (nhãn dụng cụ, HUD, thanh điều khiển…); khoá do codemod sinh từ chuỗi gốc. */
export function labText(key: string): string {
  const value = (definition.text as Record<string, string>)[key]
  if (value === undefined) throw new Error(`MISSING_TEXT: ${key}`)
  return value
}
