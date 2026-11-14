/**
 * Kiểm thử E2E bằng trình duyệt thật (Chrome/Edge headless qua puppeteer-core).
 *
 *   npm run dev            # cửa sổ 1
 *   npm run e2e            # cửa sổ 2
 *
 * Biến môi trường: BASE_URL (mặc định http://localhost:5290/), CHROME_PATH, E2E_OUT (thư mục ảnh chụp).
 * Ảnh thử được vẽ bằng canvas ngay trong trình duyệt — không dùng ảnh cá nhân nào.
 */
import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const BASE = process.env.BASE_URL || 'http://localhost:5290/'
const OUT = process.env.E2E_OUT || path.join(os.tmpdir(), 'secret-garden-e2e')
const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean)
const executablePath = CANDIDATES.find((p) => fs.existsSync(p))
if (!executablePath) throw new Error('Không tìm thấy Chrome/Edge — đặt CHROME_PATH')
fs.mkdirSync(OUT, { recursive: true })

const results = []
const ok = (name, pass, detail = '') => {
  results.push({ name, pass, detail })
  console.log(`${pass ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  userDataDir: fs.mkdtempSync(path.join(os.tmpdir(), 'sg-profile-')),
  args: ['--no-first-run', '--disable-extensions', '--autoplay-policy=no-user-gesture-required'],
})
const page = await browser.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => m.type() === 'error' && !m.text().includes('vibrate') && errors.push(m.text()))
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const shot = (name) => page.screenshot({ path: path.join(OUT, `${name}.png`) })

/* ---------- tiện ích trong trang ---------- */
const idb = (fn) =>
  page.evaluate(async (src) => {
    const db = await new Promise((r) => {
      const q = indexedDB.open('the-secret-garden')
      q.onsuccess = () => r(q.result)
    })
    const req = (s, m, ...a) =>
      new Promise((r) => {
        const q = db.transaction(s).objectStore(s)[m](...a)
        q.onsuccess = () => r(q.result)
      })
    const out = await new Function('req', `return (${src})(req)`)(req)
    db.close()
    return out
  }, fn.toString())

const state = () =>
  idb(async (req) => {
    const images = await req('images', 'getAll')
    const history = await req('history', 'getAll')
    const bag = await req('kv', 'get', 'bag')
    const current = await req('kv', 'get', 'current')
    const name = (id) => images.find((i) => i.id === id)?.name
    return { images: images.length, history: history.length, bag, current, lockedName: current ? name(current.imageId) : null }
  })

const dropPosters = (specs, extras = false) =>
  page.evaluate(
    async (specs, extras) => {
      async function poster(w, h, title, hue, type) {
        const c = document.createElement('canvas')
        c.width = w
        c.height = h
        const x = c.getContext('2d')
        const g = x.createLinearGradient(0, 0, w, h)
        g.addColorStop(0, `hsl(${hue},45%,82%)`)
        g.addColorStop(1, `hsl(${hue + 40},50%,62%)`)
        x.fillStyle = g
        x.fillRect(0, 0, w, h)
        x.fillStyle = '#2a1d10'
        x.textAlign = 'center'
        x.font = `bold ${Math.round(w / 11)}px serif`
        x.fillText(title, w / 2, h * 0.16)
        x.font = `${Math.round(w / 24)}px sans-serif`
        const L = ['Cảm ơn vì hôm nay con được khỏe mạnh', 'Cảm ơn bố mẹ luôn ở bên con', 'Gia đình bình an, ấm áp', 'Mỗi ngày là một món quà', 'Tôi biết ơn hơi thở này', 'Tình yêu thương lan tỏa', 'Sức khỏe dồi dào, tâm an', 'Kỷ niệm đẹp nuôi dưỡng tôi', 'Tôi đón nhận điều tốt đẹp', 'Hạnh phúc ở ngay đây', 'Bình an trong từng bước chân', 'Tôi xứng đáng được yêu thương']
        L.forEach((l, i) => x.fillText(l, w / 2, h * 0.27 + i * (w / 15)))
        x.fillStyle = '#b23'
        x.fillRect(w * 0.05, h * 0.02, w * 0.9, 6)
        x.fillRect(w * 0.05, h * 0.97, w * 0.9, 6)
        x.font = `${Math.round(w / 30)}px sans-serif`
        x.fillStyle = '#000'
        x.fillText('— dòng cuối cùng ở mép dưới —', w / 2, h * 0.95)
        return new Promise((r) => c.toBlob((b) => r(b), type, 0.9))
      }
      const files = []
      for (const [w, h, t, hue, type = 'image/jpeg'] of specs) {
        const b = await poster(w, h, t, hue, type)
        const ext = type.split('/')[1].replace('jpeg', 'jpg')
        files.push(new File([b], `${t}.${ext}`, { type: b.type }))
      }
      if (extras) {
        files.push(new File([files[0]], 'ban-sao.jpg', { type: 'image/jpeg' }))
        files.push(new File([new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])], 'anh-hong.jpg', { type: 'image/jpeg' }))
        files.push(new File([new Uint8Array([0, 0, 0, 24])], 'IMG_0001.HEIC', { type: 'image/heic' }))
        files.push(new File([new Uint8Array([71, 73, 70])], 'dong.gif', { type: 'image/gif' }))
      }
      const dt = new DataTransfer()
      files.forEach((f) => dt.items.add(f))
      window.dispatchEvent(new DragEvent('dragenter', { dataTransfer: dt, bubbles: true, cancelable: true }))
      window.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true, cancelable: true }))
    },
    specs,
    extras,
  )

const waitImportDone = () =>
  page.waitForFunction(() => document.querySelector('.import-progress')?.innerText.includes('Đã nhập xong'), { timeout: 30000 })
const closeSheet = async () => {
  await page.keyboard.press('Escape')
  await sleep(500)
}
const cta = async () => {
  const handles = await page.$$('.controls .btn-primary')
  return handles[0]
}
const phase = () => page.$eval('main', (m) => m.className)
const waitRevealed = (timeout = 15000) => page.waitForFunction(() => document.querySelector('main.phase-revealed'), { timeout })
/** Bấm rồi chờ lượt MỚI hiện rõ (bỏ qua trạng thái revealed của lượt trước) */
async function clickAndReveal(click) {
  const prev = (await state()).current?.drawId ?? null
  await click()
  await page.waitForFunction(
    async (prev) => {
      if (!document.querySelector('main.phase-revealed')) return false
      const db = await new Promise((r) => { const q = indexedDB.open('the-secret-garden'); q.onsuccess = () => r(q.result) })
      const cur = await new Promise((r) => { const q = db.transaction('kv').objectStore('kv').get('current'); q.onsuccess = () => r(q.result) })
      db.close()
      return cur && cur.drawId !== prev && cur.revealed
    },
    { timeout: 15000, polling: 50 },
    prev,
  )
}

/** Bấm CTA, đo thời gian tới khi ảnh hiện rõ, đối chiếu ảnh hiện với kết quả đã khoá */
async function drawOnce(label) {
  const t0 = Date.now()
  await clickAndReveal(async () => (await cta()).click())
  const ms = Date.now() - t0
  const shown = await page.$eval('.hero-img', (i) => i.alt)
  const s = await state()
  return { ms, shown, locked: s.lockedName, s, label }
}

/* ================= Kịch bản ================= */
await page.goto(BASE, { waitUntil: 'networkidle0' })
await page.waitForSelector('.home')
ok('Trạng thái trống hiển thị tiêu đề và CTA', await page.evaluate(() => document.body.innerText.includes('Kho báu của bạn đang chờ được lấp đầy') && document.body.innerText.includes('Thêm ảnh của bạn')))
await shot('01-empty-mobile')

// Nhập ảnh: 6 hợp lệ (dọc, ngang, vuông; JPEG/PNG/WebP) + trùng + hỏng + HEIC + GIF
await dropPosters(
  [
    [1080, 1920, 'Biết ơn', 20],
    [1920, 1080, 'Gia đình', 140],
    [1200, 1200, 'Sức khỏe', 200],
    [900, 1600, 'Kỷ niệm', 300],
    [1080, 1350, 'Mong ước', 60, 'image/png'],
    [1080, 1920, 'Bình an', 100, 'image/webp'],
  ],
  true,
)
await waitImportDone()
const importText = await page.$eval('.import-progress', (e) => e.innerText)
ok('Nhập 6 ảnh hợp lệ', importText.includes('6 ảnh nhập thành công'), importText.split('\n')[2])
ok('Bỏ qua ảnh trùng theo hash', importText.includes('1 ảnh trùng'))
ok('Báo lỗi file hỏng', importText.includes('anh-hong.jpg') && importText.includes('hỏng'))
ok('Báo rõ HEIC chưa hỗ trợ', importText.includes('HEIC chưa được hỗ trợ'))
ok('Từ chối định dạng không hỗ trợ (GIF)', importText.includes('dong.gif'))
await shot('02-import-progress')
await closeSheet()

await page.reload({ waitUntil: 'networkidle0' })
await page.waitForSelector('.level-bar')
ok('Reload: ảnh vẫn còn', (await state()).images === 6)
ok('Thanh cấp độ bắt đầu ở LV.1', (await page.$eval('.level-bar', (e) => e.innerText)).includes('LV.1'))
await sleep(400)
await shot('03-idle-mobile')

// Chụp giữa hiệu ứng lướt
;(await cta()).click()
await sleep(450)
await shot('04a-spinning')
await sleep(700)
await shot('04b-spinning')
await sleep(1500)
await shot('04c-pixel-step')
await waitRevealed()
await sleep(300)
await shot('05-revealed')
const first = await state()
ok('Hiện nhãn "Món quà dành cho bạn" khi mở', (await page.$eval('.ribbon', (e) => e.textContent)) === 'Món quà dành cho bạn')
ok('Thanh cấp độ cộng 1 sau khi mở', (await page.$eval('.level-total', (e) => e.innerText.trim())) === '1')

// Bốc hết vòng
const names = [first.lockedName]
const timings = []
let mismatch = 0
for (let i = 1; i < 6; i++) {
  const r = await drawOnce(`draw-${i}`)
  names.push(r.locked)
  timings.push(r.ms)
  if (r.shown !== r.locked) mismatch++
}
ok('Một vòng 6 lượt không lặp ảnh', new Set(names).size === 6, names.join(', '))
ok('Ảnh hiện ra khớp chính xác kết quả đã khoá', mismatch === 0)
const avg = Math.round(timings.reduce((a, b) => a + b, 0) / timings.length)
ok('Tổng thời gian một lượt khoảng 3–4,5 giây', avg >= 2800 && avg <= 4600, `trung bình ${avg} ms`)
ok('Lịch sử ghi đủ 6 lượt', (await state()).history === 6)

;(await cta()).click()
await page.waitForSelector('.complete-card', { timeout: 5000 })
ok('Hết vòng: hiện lời chúc và "Bắt đầu vòng mới"', (await page.$eval('.controls', (e) => e.innerText)).includes('Bắt đầu vòng mới'))
await shot('06-round-complete')
;(await cta()).click()
await sleep(400)
const nr = (await state()).bag
ok('Vòng mới đủ 6 ảnh', nr.round === 2 && nr.remaining.length === 6)
ok('Lên cấp sau 6 thông điệp (LV.2)', (await page.$eval('.level-badge', (e) => e.innerText)) === 'LV.2', await page.$eval('.level-bar', (e) => e.innerText.split('\n').join(' ')))

// Bấm liên tục
const h0 = (await state()).history
await clickAndReveal(() =>
  page.evaluate(() => {
    const b = document.querySelector('.controls .btn-primary')
    for (let i = 0; i < 8; i++) b.click()
  }),
)
await sleep(800)
ok('Bấm liên tục chỉ tạo đúng 1 lượt', (await state()).history === h0 + 1)

// Reload giữa hiệu ứng
;(await cta()).click()
await sleep(600)
const mid = await state()
await page.reload({ waitUntil: 'networkidle0' })
await waitRevealed()
const after = await state()
const shownAfter = await page.$eval('.hero-img', (i) => i.alt)
ok('Reload giữa lượt: vẫn mở đúng ảnh đã khoá', shownAfter === mid.lockedName && after.current.revealed, shownAfter)
ok('Reload giữa lượt: không ghi lịch sử trùng', after.history === mid.history)

// Thêm ảnh giữa vòng
const before = (await state()).bag.remaining.length
await dropPosters([[1080, 1920, 'Ánh sáng', 40]])
await waitImportDone()
await closeSheet()
const added = await state()
ok('Thêm ảnh giữa vòng: vào nhóm chưa mở', added.bag.remaining.length === before + 1 && added.images === 7)

// Xoá ảnh đang hiển thị qua giao diện (có xác nhận)
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Bộ sưu tập').click())
await sleep(600)
await shot('07-collection')
const lockedBeforeDelete = (await state()).current.imageId
const delLabel = `Xoá ${(await state()).lockedName}`
await page.evaluate((label) => document.querySelector(`button[aria-label="${label}"]`).click(), delLabel)
await page.waitForSelector('.confirm')
await shot('08-confirm-delete')
await page.evaluate(() => document.querySelector('.confirm .btn-danger').click())
await sleep(500)
const del = await state()
ok(
  'Xoá ảnh: loại mọi tham chiếu (túi, lịch sử, lượt hiện tại)',
  del.images === 6 && !del.bag.remaining.includes(lockedBeforeDelete) && !del.bag.drawn.includes(lockedBeforeDelete) && del.current === undefined,
)
await closeSheet()
ok('Xoá ảnh đang mở: quay về trạng thái chờ', (await phase()).includes('phase-idle'))

// Lịch sử + cài đặt
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Đã đón nhận').click())
await sleep(600)
ok('Lịch sử nhóm theo ngày', (await page.$eval('.sheet-body', (e) => e.textContent)).includes('Hôm nay'))
await shot('09-history')
await closeSheet()
await page.evaluate(() => [...document.querySelectorAll('button')].find((b) => b.innerText.trim() === 'Cài đặt').click())
await sleep(600)
await shot('10-settings')
await closeSheet()

// Ảnh dọc nhiều chữ hiển thị trọn vẹn
await drawOnce('portrait-check')
const fit = await page.$eval('.hero-img', (i) => ({ fit: getComputedStyle(i).objectFit, nw: i.naturalWidth, nh: i.naturalHeight, w: i.clientWidth, h: i.clientHeight }))
ok('Ảnh hiển thị object-fit: contain (không cắt chữ)', fit.fit === 'contain', `${fit.nw}x${fit.nh} trong khung ${fit.w}x${fit.h}`)

// Xem toàn ảnh + bàn phím
await page.evaluate(() => [...document.querySelectorAll('.result-actions button')].find((b) => b.innerText.includes('Xem toàn ảnh')).click())
await page.waitForSelector('.viewer-img')
await sleep(400)
await shot('11-viewer')
const vr = await page.evaluate(() => {
  const a = document.querySelector('.viewer-img').getBoundingClientRect()
  const b = document.querySelector('.viewer-stage').getBoundingClientRect()
  return Math.abs(a.left - b.left) + Math.abs(a.top - b.top) + Math.abs(a.width - b.width) + Math.abs(a.height - b.height)
})
ok('Viewer: ảnh nằm gọn giữa khung, không tràn', vr < 2, `lệch ${vr.toFixed(1)}px`)
// Chạm vào ảnh: thả tim bay tung toé + đánh dấu Yêu thích
const favBefore = await idb(async (req) => {
  const cur = await req('kv', 'get', 'current')
  return (await req('images', 'get', cur.imageId)).favorite
})
const stageBox = await (await page.$('.viewer-stage')).boundingBox()
const cx = stageBox.x + stageBox.width / 2
const cy = stageBox.y + stageBox.height / 2
await page.mouse.click(cx, cy)
await sleep(60)
await page.mouse.click(cx + 40, cy + 30)
await sleep(220)
const fxCount = await page.$$eval('.fx-emoji', (els) => els.length)
await shot('11b-hearts')
const favAfter = await idb(async (req) => {
  const cur = await req('kv', 'get', 'current')
  return (await req('images', 'get', cur.imageId)).favorite
})
ok('Chạm vào ảnh: emoji bay tung toé', fxCount >= 15, `${fxCount} emoji`)
ok('Chạm vào ảnh: tự đánh dấu Yêu thích', favBefore === false && favAfter === true)
await sleep(2800)
ok('Emoji tự dọn sau khi bay xong', (await page.$$eval('.fx-emoji', (els) => els.length)) === 0)
// Kéo (không phải chạm) thì không thả tim
await page.mouse.move(cx, cy)
await page.mouse.down()
await page.mouse.move(cx + 60, cy + 40, { steps: 5 })
await page.mouse.up()
await sleep(150)
ok('Kéo ảnh không thả tim', (await page.$$eval('.fx-emoji', (els) => els.length)) === 0)
await page.keyboard.press('+')
await sleep(400)
const zoomed = await page.$eval('.viewer-img', (i) => i.style.transform)
ok('Viewer phóng to bằng bàn phím', /scale\(1\.[1-9]/.test(zoomed), zoomed)
await page.keyboard.press('Escape')
await sleep(300)
ok('Esc đóng viewer', !(await page.$('.viewer')))
ok('Focus quay về nút chính sau khi mở ảnh', await page.evaluate(() => document.activeElement?.className.includes('btn')))
await page.focus('.controls .btn-primary')
const hk = (await state()).history
await clickAndReveal(() => page.keyboard.press('Enter'))
ok('Bốc bằng phím Enter', (await state()).history === hk + 1)

// Giảm chuyển động
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
await sleep(200)
const rm = await drawOnce('reduced')
ok('prefers-reduced-motion: chuyển cảnh ngắn, không carousel', rm.ms < 1600 && rm.shown === rm.locked, `${rm.ms} ms`)
await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }])

// Nạp nhiều ảnh một lần (không giới hạn số lượng), có cả ảnh cỡ 48MP như iPhone đời mới
const imgsBefore = (await state()).images
const many = Array.from({ length: 30 }, (_, i) => (i < 2 ? [8064, 6048, `Lớn ${i + 1}`, i * 11] : [1080, 1350, `Lô ${i + 1}`, i * 11]))
await dropPosters(many)
await page.waitForFunction(() => document.querySelector('.import-progress')?.innerText.includes('Đã nhập xong'), { timeout: 120000 })
const manyText = await page.$eval('.import-progress', (e) => e.innerText)
ok('Nạp 30 ảnh một lần (có 2 ảnh 48MP) đều thành công', manyText.includes('30 ảnh nhập thành công') && (await state()).images === imgsBefore + 30, manyText.split('\n').slice(0, 3).join(' · '))
await closeSheet()

// Layout 360px và desktop
await page.setViewport({ width: 360, height: 740, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
await page.reload({ waitUntil: 'networkidle0' })
await sleep(600)
ok('360px: không cuộn ngang', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
ok('360px: nút chính nằm trong màn hình', await page.$eval('.controls .btn-primary', (b) => b.getBoundingClientRect().bottom <= innerHeight))
await shot('12-360')
await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 })
await page.reload({ waitUntil: 'networkidle0' })
await sleep(600)
await shot('13-desktop-idle')
await drawOnce('desktop')
await sleep(300)
await shot('14-desktop-revealed')
ok('Desktop: không cuộn ngang', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))

ok('Không có lỗi JavaScript', errors.length === 0, errors.slice(0, 3).join(' | '))

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} kiểm thử đạt · ảnh chụp: ${OUT}`)
process.exit(failed.length ? 1 : 0)
