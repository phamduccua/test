// Mở phòng lab trong Chrome không giao diện (puppeteer-core + Chrome đã cài sẵn trên máy).
// Biến môi trường: LAB_URL (mặc định http://localhost:5173 – chạy `npm run dev` trước), CHROME_PATH (đường dẫn chrome.exe).
import { existsSync, mkdirSync } from 'node:fs'
import puppeteer from 'puppeteer-core'

const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean)

export const OUT = 'docs/screens'
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/** Mở trang, bấm "Vào phòng", đóng hộp hướng dẫn; trả { browser, page, errors }. */
export async function openLab({ query = '', width = 1600, height = 900 } = {}) {
  const executablePath = CANDIDATES.find((p) => existsSync(p))
  if (!executablePath) throw new Error('Không tìm thấy Chrome/Edge – đặt CHROME_PATH')
  mkdirSync(OUT, { recursive: true })
  const browser = await puppeteer.launch({
    executablePath, headless: 'new', protocolTimeout: 600000,
    args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', `--window-size=${width},${height}`],
  })
  const page = await browser.newPage()
  await page.setViewport({ width, height })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && !/404|Failed to load resource/.test(m.text()) && errors.push(m.text()))
  const base = process.env.LAB_URL ?? 'http://localhost:5173'
  await page.goto(`${base}/?${query}`, { waitUntil: 'networkidle0', timeout: 120000 })
  await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.textContent.includes('Vào phòng'))?.click())
  await page.waitForFunction(() => window.__walk && window.__ix && window.__chem, { timeout: 120000 })
  await sleep(1500)
  await page.keyboard.press('Escape')
  return { browser, page, errors }
}

/** Đo khung hình trung bình trên `n` khung. */
export const measureFps = (page, n = 60) =>
  page.evaluate(
    (n) =>
      new Promise((res) => {
        let k = 0
        const t0 = performance.now()
        const tick = () => (++k < n ? requestAnimationFrame(tick) : res((k * 1000) / (performance.now() - t0)))
        requestAnimationFrame(tick)
      }),
    n,
  )
