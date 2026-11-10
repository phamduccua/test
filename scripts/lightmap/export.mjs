// Bước 1 của `npm run lightmap`: mở phòng (bản dev, không gắn lightmap cũ) và xuất các mesh tĩnh cho Blender vào .lightmap/.
import { mkdirSync, writeFileSync } from 'node:fs'
import { openLab } from '../visual/common.mjs'

const { browser, page, errors } = await openLab({ query: 'q=medium&nolightmap&fixedres', width: 800, height: 600 })
const data = await page.evaluate(() => window.__lightmapExport())
await browser.close()
if (errors.length) console.warn('Lỗi trang:', errors.slice(0, 3))
mkdirSync('.lightmap', { recursive: true })
writeFileSync('.lightmap/positions.bin', Buffer.from(data.positions, 'base64'))
writeFileSync('.lightmap/normals.bin', Buffer.from(data.normals, 'base64'))
writeFileSync('.lightmap/scene.json', JSON.stringify({ meshes: data.meshes, panels: data.panels }, null, 1))
const verts = data.meshes.reduce((a, m) => a + m.count, 0)
console.log(`Đã xuất ${data.meshes.length} mesh tĩnh, ${verts} đỉnh (${(verts / 3) | 0} tam giác), ${data.panels.length} tấm đèn → .lightmap/`)
