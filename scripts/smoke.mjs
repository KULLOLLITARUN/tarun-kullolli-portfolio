// Browser smoke test: serves the production build (run `npm run build` first) and checks the
// parts that unit tests can't: the burger menu, the guided tour, the project walk-throughs and
// that every theme loads without console errors. Uses your installed Chrome; set CHROME_PATH
// to use another browser. Run with `npm run smoke`.
import { spawn } from 'node:child_process'
import { chromium } from 'playwright-core'

const PORT = 4188
const URL = `http://localhost:${PORT}/`
const THEMES = ['night', 'dawn', 'aurora', 'solar', 'dusk', 'mocha']
let failed = 0
const check = (ok, name) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}`)
  if (!ok) failed++
}

const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
const stop = () => server.kill()
process.on('exit', stop)

async function waitForServer() {
  for (let i = 0; i < 40; i++) {
    try {
      if ((await fetch(URL)).ok) return
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error('preview server did not start (did you run `npm run build`?)')
}

async function open(browser, viewport, theme = 'night') {
  const ctx = await browser.newContext({ viewport })
  await ctx.addInitScript((t) => localStorage.setItem('tk-theme', t), theme)
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.goto(URL, { waitUntil: 'load' })
  await page.waitForSelector('.nav')
  return { ctx, page, errors }
}

try {
  await waitForServer()
  const browser = await chromium.launch({
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' }),
    args: ['--enable-unsafe-swiftshader'], // software WebGL on machines without a GPU (CI)
  })

  // Desktop: section links in the bar, no burger.
  {
    const { ctx, page, errors } = await open(browser, { width: 1280, height: 800 })
    check(await page.locator('.nav-links').isVisible(), 'desktop: section links visible')
    check(!(await page.locator('.nav-burger').isVisible()), 'desktop: burger hidden')
    await page.waitForTimeout(1500)
    check(errors.length === 0, `desktop: no console errors ${errors[0] ?? ''}`)
    await ctx.close()
  }

  // Phone: burger menu and the tour.
  {
    const { ctx, page, errors } = await open(browser, { width: 393, height: 852 })
    await page.click('.nav-burger')
    check((await page.locator('.nav-sheet nav a').count()) === 4, 'phone: menu lists the four sections')
    await page.keyboard.press('Escape')
    check((await page.locator('.nav-sheet').count()) === 0, 'phone: Escape closes the menu')
    await page.click('.nav-burger')
    await page.click('.sheet-tour')
    await page.waitForSelector('.tour')
    await page.waitForSelector('.mascot.is-touring')
    check((await page.locator('.nav-sheet').count()) === 0, 'phone: tour starts and closes the menu')
    await page.waitForSelector('.mascot-bubble')
    check(((await page.textContent('.mascot-bubble'))?.length ?? 0) > 10, 'phone: Kairo speaks during the tour')
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.querySelector('.tour') && !document.querySelector('.mascot.is-touring'))
    check(true, 'phone: Escape ends the tour and Kairo returns')
    check(errors.length === 0, `phone: no console errors ${errors[0] ?? ''}`)
    await ctx.close()
  }

  // Project walk-throughs.
  for (const slug of ['archiva', 'pbip-sentinel', 'markpull']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const page = await ctx.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(`${URL}#project/${slug}`, { waitUntil: 'load' })
    await page.waitForSelector('.pd-demo', { timeout: 15000 })
    await page.click('.demo-controls .chip:nth-child(2)') // pause
    const at = async () => (await page.textContent('.demo-line .mono')).trim()
    // Step back to the start, then forward once: the counter must go from 01 to 02.
    for (let i = 0; i < 12 && !(await at()).startsWith('01/'); i++) await page.click('.demo-controls .chip:nth-child(1)')
    check((await at()).startsWith('01/'), `${slug}: walk-through renders (step 01)`)
    await page.click('.demo-controls .chip:nth-child(3)')
    check((await at()).startsWith('02/'), `${slug}: Next moves to step 02`)
    check(errors.length === 0, `${slug}: no errors ${errors[0] ?? ''}`)
    await ctx.close()
  }

  // Every theme loads.
  for (const theme of THEMES) {
    const { ctx, page, errors } = await open(browser, { width: 1280, height: 800 }, theme)
    await page.waitForTimeout(800)
    check((await page.evaluate(() => document.documentElement.dataset.theme)) === theme && errors.length === 0, `theme ${theme} loads cleanly ${errors[0] ?? ''}`)
    await ctx.close()
  }

  await browser.close()
} catch (e) {
  console.error(e)
  failed++
} finally {
  stop()
}
console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed')
process.exit(failed ? 1 : 0)
