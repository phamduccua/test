// Chụp 6 góc đối chiếu ảnh mẫu (COMPARE_VIEWS) và đo khung hình, draw call, tỉ lệ độ phân giải.
//   node scripts/visual/views.mjs [q=high|medium|low] [rộng] [cao]
// Ảnh: docs/screens/<q>-<góc>.png. Cần `npm run dev` đang chạy (LAB_URL).
import { OUT, measureFps, openLab, sleep } from './common.mjs'

const [q = 'high', W = '1600', H = '900'] = process.argv.slice(2)
const { browser, page, errors } = await openLab({ query: `q=${q}`, width: +W, height: +H })
// Ẩn giao diện DOM để ảnh chỉ còn cảnh 3D.
await page.addStyleTag({ content: '#app > div:not(:first-child), .ix-hint-html { display: none !important }' })
const gpu = await page.evaluate(() => {
  const gl = document.querySelector('canvas').getContext('webgl2')
  const e = gl?.getExtension('WEBGL_debug_renderer_info')
  return e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : '?'
})
console.log(`GPU: ${gpu}  ·  nấc ${q}  ·  ${W}×${H}`)
const views = await page.evaluate(() => window.__viewpoints.slice(-6).map((v) => v.id))
for (const [i, id] of views.entries()) {
  await page.evaluate((i) => {
    window.__walk.setFly(true)
    window.__walk.teleport(window.__viewpoints.at(-6 + i).pose)
  }, i)
  await sleep(4000) // độ phân giải động cần vài giây để ổn định
  const fps = await measureFps(page)
  const info = await page.evaluate(() => ({ calls: window.__renderer.info.render.calls, scale: window.__renderer.getPixelRatio() }))
  await page.screenshot({ path: `${OUT}/${q}-${id}.png` })
  console.log(`${id.padEnd(14)} ${fps.toFixed(0).padStart(3)} khung/s  · độ phân giải ×${info.scale.toFixed(2)}`)
}
if (errors.length) console.log('Lỗi trang:', errors.slice(0, 5))
await browser.close()
