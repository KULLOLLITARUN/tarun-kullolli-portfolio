// Browser smoke test: serves the production build (run `npm run build` first) and checks the
// parts that unit tests can't: the burger menu, the guided tour, the project walk-throughs and
// that every theme loads without console errors. Uses your installed Chrome; set CHROME_PATH
// to use another browser. Run with `npm run smoke`.
import { spawn } from 'node:child_process'
import { chromium } from 'playwright-core'
import AxeBuilder from '@axe-core/playwright'

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

  // Chat fallback: Groq is mocked as out of quota (never the real API), so Kairo answers from the offline script.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' })
    const page = await ctx.newPage()
    await page.route('**/api/chat', (route) =>
      route.request().method() === 'GET'
        ? route.fulfill({ status: 200, contentType: 'application/json', body: '{"logging":false}' })
        : route.fulfill({ status: 429, contentType: 'application/json', body: '{"error":"busy","retryAfter":120}' }),
    )
    await page.goto(URL, { waitUntil: 'load' })
    await page.waitForSelector('.chat.is-visible', { timeout: 30000 })
    await page.fill('#chat-input', 'Tell me about Archiva')
    await page.press('#chat-input', 'Enter')
    await page.waitForSelector('.msg-actions a:has-text("Open Archiva case study")', { timeout: 20000 })
    check((await page.getAttribute('.msg-actions a:has-text("Open Archiva case study")', 'href')) === '#project/archiva', 'chat: offline answer offers "Open Archiva case study"')
    check((await page.locator('.msg-note').count()) === 1, 'chat: says once that the answer is offline')
    await page.fill('#chat-input', 'Start the tour')
    await page.press('#chat-input', 'Enter')
    await page.click('.msg-actions button:has-text("Start the tour")')
    await page.waitForSelector('.tour', { timeout: 8000 })
    check(true, 'chat: "Start the tour" button starts the tour')
    await ctx.close()
  }

  // Every theme loads, and has no serious or critical accessibility violations (axe), which
  // includes colour contrast.
  for (const theme of THEMES) {
    const { ctx, page, errors } = await open(browser, { width: 1280, height: 800 }, theme)
    await page.waitForTimeout(800)
    check((await page.evaluate(() => document.documentElement.dataset.theme)) === theme && errors.length === 0, `theme ${theme} loads cleanly ${errors[0] ?? ''}`)
    const { violations } = await new AxeBuilder({ page }).analyze()
    const bad = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
    check(bad.length === 0, `theme ${theme}: no serious accessibility violations ${bad.map((v) => `${v.id} (${v.nodes.length})`).join(', ')}`)
    await ctx.close()
  }

  // Accessibility of the other states: the command menu, an open case study, recruiter mode and
  // the phone-only Day theme.
  const scan = async (page, name) => {
    // The hero's HUD lines fade in from opacity 0 after the page loads; scanned mid-fade their text
    // is nearly invisible and axe reports a contrast failure that isn't real.
    await page.waitForFunction(() => [...document.querySelectorAll('.hud')].every((e) => Number(getComputedStyle(e).opacity) >= 0.99), null, { timeout: 10000 })
    const { violations } = await new AxeBuilder({ page }).analyze()
    const bad = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
    check(bad.length === 0, `${name}: no serious accessibility violations ${bad.map((v) => `${v.id} (${v.nodes.length})`).join(', ')}`)
  }
  {
    const { ctx, page } = await open(browser, { width: 1280, height: 800 })
    await page.keyboard.press('Control+k')
    await page.waitForSelector('.palette')
    await scan(page, 'command menu')
    await ctx.close()
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const page = await ctx.newPage()
    await page.goto(`${URL}#project/archiva`, { waitUntil: 'load' })
    await page.waitForSelector('.pd-demo', { timeout: 15000 })
    await scan(page, 'case study')
    await ctx.close()
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const page = await ctx.newPage()
    await page.goto(`${URL}?recruiter`, { waitUntil: 'load' })
    await page.waitForSelector('.recruiter')
    await scan(page, 'recruiter mode')
    await ctx.close()
  }
  {
    const { ctx, page } = await open(browser, { width: 393, height: 852 }, 'day')
    await page.waitForTimeout(800)
    await scan(page, 'Day theme on a phone')
    await ctx.close()
  }

  // Kairo's colour picker works from the keyboard: the button opens it, a colour can be chosen, and
  // focus returns to the button.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' })
    const page = await ctx.newPage()
    await page.goto(URL, { waitUntil: 'load' })
    await page.waitForSelector('.mascot.is-visible', { timeout: 30000 })
    const theme = () => page.evaluate(() => document.documentElement.dataset.theme)
    const before = await theme()
    await page.focus('.mascot-key')
    await page.keyboard.press('Enter')
    await page.waitForSelector('.theme-picker')
    check((await page.getAttribute('.mascot-key', 'aria-expanded')) === 'true', 'Kairo button: Enter opens the colour picker')
    await scan(page, 'Kairo colour picker')
    await page.locator('.theme-swatch[aria-pressed="false"]').first().focus()
    await page.keyboard.press('Enter')
    await page.waitForTimeout(300)
    check((await page.locator('.theme-picker').count()) === 0 && (await theme()) !== before, 'Kairo button: choosing a colour changes the theme and closes the picker')
    check(await page.evaluate(() => document.activeElement?.classList.contains('mascot-key')), 'Kairo button: focus returns to the button')
    await page.keyboard.press('Enter')
    await page.waitForSelector('.theme-picker')
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)
    check((await page.locator('.theme-picker').count()) === 0 && (await page.evaluate(() => document.activeElement?.classList.contains('mascot-key'))), 'Kairo button: Escape closes the picker and keeps focus on the button')
    await ctx.close()
  }

  // The custom cursor boxes what it hovers and names its type: Kairo is "alarm", nav items are
  // "link", and the label is a plain word (no made-up confidence number).
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' })
    const page = await ctx.newPage()
    await page.goto(URL, { waitUntil: 'load' })
    await page.waitForSelector('.mascot.is-visible', { timeout: 30000 })
    const hoverLabel = async (selector) => {
      const b = await page.locator(selector).first().boundingBox()
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
      await page.waitForSelector('.cursor-box.is-locked', { timeout: 3000 })
      return page.textContent('.cursor-label')
    }
    check((await hoverLabel('.mascot-hit')) === 'alarm', 'cursor: locks onto Kairo and labels it "alarm"')
    await page.mouse.move(5, 400) // off any target
    await page.waitForFunction(() => !document.querySelector('.cursor-box.is-locked'))
    const link = await hoverLabel('.nav-links a')
    check(link === 'link', `cursor: a nav link is labelled "link" with no number ("${link}")`)
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
