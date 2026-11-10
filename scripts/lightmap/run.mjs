// npm run lightmap – nướng lại lightmap sau khi đổi bố trí/nội thất phòng.
// Cần: `npm run dev` đang chạy (LAB_URL, mặc định http://localhost:5173) và Blender 4.x (biến BLENDER = đường dẫn blender.exe).
// Tham số thêm chuyển cho bake.py, vd. `npm run lightmap -- --size 1024 --samples 16` (bản thử nhanh).
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const blender = [process.env.BLENDER, 'C:/Program Files/Blender Foundation/Blender 4.5/blender.exe', '/usr/bin/blender', '/Applications/Blender.app/Contents/MacOS/Blender'].find((p) => p && existsSync(p))
if (!blender) {
  console.error('Không tìm thấy Blender – đặt biến BLENDER=đường/dẫn/blender.exe (Blender 4.x, bản zip chạy ngay cũng được)')
  process.exit(1)
}
execFileSync(process.execPath, ['scripts/lightmap/export.mjs'], { stdio: 'inherit' })
const t0 = Date.now()
console.log('Đang nướng trong Blender (2048 px, 64 mẫu: ~6–7 phút trên CPU 6 nhân)…')
const out = execFileSync(blender, ['-b', '--factory-startup', '-P', 'scripts/lightmap/bake.py', '--', ...process.argv.slice(2)], { encoding: 'utf8', maxBuffer: 1 << 28 })
for (const line of out.split('\n')) if (line.startsWith('[lightmap') || /Error|Traceback/.test(line)) console.log(line)
console.log(`Xong sau ${((Date.now() - t0) / 60000).toFixed(1)} phút → public/lightmap/`)
