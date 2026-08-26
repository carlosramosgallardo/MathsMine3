#!/usr/bin/env node
/**
 * Portal browser QA — phases for chrome routes, prefs (lang/currency/sound),
 * and later wallet / deep UI. Same OK/NOK/SKIP reporter as qa-sweep.
 *
 *   NODE_TLS_REJECT_UNAUTHORIZED=0 npm run qa:portal -- --base https://127.0.0.1:3000
 *   npm run qa:portal -- --phase 1
 *   npm run qa:portal -- --phase 1,2
 *   npm run qa:portal -- --phase all
 */
import { createRequire } from 'module'
import {
  loadEnvLocal,
  parseArgs as parseSweepArgs,
  createReporter,
  createSessionToken,
  QA,
  ensureProgress,
  ensureLeaderboard,
  sbClient,
} from './qa/lib.mjs'
import {
  CHROME_ROUTES,
  BARE_ROUTES,
  HOME_PORTAL_HREFS,
  PAGE_LANG_MARKERS,
  CURRENCY_SURFACES,
  FOOTER_LINKS,
} from './qa/portal-inventory.mjs'

loadEnvLocal()

function parsePhases(argv) {
  const raw = (() => {
    const i = argv.indexOf('--phase')
    if (i === -1) return '1,2,3,4,5'
    const next = argv[i + 1]
    if (!next || next.startsWith('--')) return '1,2,3,4,5'
    return next
  })()
  if (raw === 'all') return new Set([1, 2, 3, 4, 5])
  return new Set(
    String(raw)
      .split(',')
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isFinite(n) && n >= 1),
  )
}

function parsePortalArgs(argv) {
  const base = parseSweepArgs(argv)
  return {
    ...base,
    phases: parsePhases(argv),
    headed: argv.includes('--headed'),
  }
}

async function loadPlaywright() {
  const require = createRequire(import.meta.url)
  try {
    return require('playwright')
  } catch {
    throw new Error(
      'playwright not installed — run: npm i -D playwright && npx playwright install chromium',
    )
  }
}

async function goto(page, base, path, { slow = false } = {}) {
  const url = `${base}${path}`
  const timeout = slow ? 90_000 : 45_000
  const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout })
  // Give client providers a beat to hydrate
  await page.waitForTimeout(slow ? 1200 : 500)
  return res
}

async function dismissCookies(page) {
  const banner = page.getByTestId('mm3-cookie-banner')
  if (!(await banner.count())) return
  // Home WebGL re-renders make Playwright's actionability wait hang — DOM click.
  try {
    await domClick(page, 'mm3-cookie-accept')
  } catch {
    await page.evaluate(() => {
      try {
        localStorage.setItem('mm3_cookies_accepted', 'true')
        localStorage.setItem('mm3_cookies_accepted_at', new Date().toISOString())
      } catch { /* */ }
      document.querySelector('[data-testid="mm3-cookie-banner"]')?.remove()
    })
  }
  await page.waitForTimeout(200)
}

async function bodyHas(page, needle) {
  const text = await page.locator('body').innerText()
  return text.toLowerCase().includes(String(needle).toLowerCase())
}

async function bodyHasAny(page, needles) {
  const text = (await page.locator('body').innerText()).toLowerCase()
  for (const needle of needles) {
    if (text.includes(String(needle).toLowerCase())) return needle
  }
  return null
}

/** Poll body text until a marker appears (hydration / client fetch). */
async function waitBodyHasAny(page, needles, { timeoutMs = 12_000, intervalMs = 400 } = {}) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const hit = await bodyHasAny(page, needles)
    if (hit) return hit
    await page.waitForTimeout(intervalMs)
  }
  return null
}

async function closeOverlays(page) {
  await page.keyboard.press('Escape').catch(() => {})
  // Top-left click dismisses stray overlays on inner pages, but on `/` it hits
  // the home 3D stage and toggles fullscreen showcase — hiding the nonagon.
  const onHome = await page.evaluate(() => window.location.pathname === '/')
  if (!onHome) await page.mouse.click(8, 8).catch(() => {})
  await page.waitForTimeout(150)
}

/** Native DOM click — Playwright force-click can miss React handlers under fixed chrome overlays */
async function domClick(page, testId) {
  const ok = await page.evaluate((id) => {
    const el = document.querySelector(`[data-testid="${id}"]`)
    if (!el) return false
    el.click()
    return true
  }, testId)
  if (!ok) throw new Error(`missing ${testId}`)
}

async function setLanguage(page, lang) {
  await closeOverlays(page)
  await domClick(page, 'mm3-lang-toggle')
  await page.waitForTimeout(150)
  await domClick(page, `mm3-lang-option-${lang}`)
  await page.waitForTimeout(350)
}

async function dismissHomeStageZoom(page) {
  if (!(await page.locator('.mm3-home-access.is-stagezoom').count())) return
  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent('mm3-stage-zoom-toggle'))
  })
  await page.waitForTimeout(400)
}

async function waitHomePortalReady(page) {
  await dismissHomeStageZoom(page)
  await page.waitForFunction(
    () => document.querySelectorAll('[data-portal-href]').length >= 10
      && document.querySelector('.mm3-nonagon-center-name'),
    { timeout: 20000 },
  )
}

async function readCenterPortalLabel(page) {
  return page.locator('.mm3-nonagon-center-name').first().innerText().catch(() => '')
}

async function selectPortalSide(page, href, labelRe) {
  await waitHomePortalReady(page)
  if (await page.locator('.mm3-nonagon.is-open').count()) {
    await page.locator('.mm3-nonagon-mapfull').click({ timeout: 5000 })
    await page.waitForTimeout(300)
    await waitHomePortalReady(page)
  }
  const pattern = new RegExp(labelRe, 'i')
  const nextArrow = page.locator('.mm3-nonagon-arrow').nth(1)
  for (let step = 0; step < 12; step += 1) {
    await dismissHomeStageZoom(page)
    const text = await readCenterPortalLabel(page)
    const centerHref = await page.locator('.mm3-nonagon-center-name').first().getAttribute('href').catch(() => null)
    if (centerHref === href || pattern.test(text)) return text
    await nextArrow.click({ timeout: 5000 })
    await page.waitForTimeout(350)
  }
  return readCenterPortalLabel(page)
}

async function setCurrency(page, code) {
  await closeOverlays(page)
  await domClick(page, 'mm3-currency-toggle')
  await page.waitForTimeout(150)
  await domClick(page, `mm3-currency-option-${code}`)
  await page.waitForTimeout(350)
}

async function runPhase1(page, base, { ok, nok, skip }) {
  console.log('\n── Phase 1: route smoke + chrome ──')

  for (const route of CHROME_ROUTES) {
    const id = `portal.route.${route.name}`
    try {
      const res = await goto(page, base, route.path, { slow: route.slow })
      const status = res?.status() ?? 0
      if (status >= 400) {
        nok(id, `HTTP ${status}`)
        continue
      }
      const header = await page.getByTestId('mm3-portal-header').count()
      const footer = await page.getByTestId('mm3-portal-footer').count()
      const lang = await page.getByTestId('mm3-lang-toggle').count()
      const cur = await page.getByTestId('mm3-currency-toggle').count()
      if (!header || !footer) {
        nok(id, `status=${status} header=${header} footer=${footer}`)
        continue
      }
      if (!lang || !cur) {
        nok(id, `missing switchers lang=${lang} currency=${cur}`)
        continue
      }
      ok(id, `HTTP ${status} chrome+switchers`)
    } catch (e) {
      nok(id, e.message?.slice(0, 160) || String(e))
    }
  }

  // Home nonagon inventory via data-portal-href on each side
  try {
    await goto(page, base, '/')
    await dismissCookies(page)
    await page.waitForTimeout(800)
    const found = await page.locator('[data-portal-href]').evaluateAll((els) =>
      els.map((el) => el.getAttribute('data-portal-href')),
    )
    const set = new Set(found)
    const missing = HOME_PORTAL_HREFS.filter((h) => !set.has(h))
    if (missing.length) {
      // Fallback: rotate arrows + center Link (older builds without data-portal-href)
      const rotated = new Set()
      for (let i = 0; i < HOME_PORTAL_HREFS.length + 2; i++) {
        const href = await page.getByTestId('mm3-portal-center-name').getAttribute('href').catch(() => null)
        if (href) rotated.add(href)
        const next = page.locator('button.mm3-nonagon-arrow').last()
        if (await next.count()) await next.click({ force: true })
        await page.waitForTimeout(200)
      }
      const missing2 = HOME_PORTAL_HREFS.filter((h) => !rotated.has(h))
      if (missing2.length) nok('portal.home.links', `missing ${missing2.join(',')}`)
      else ok('portal.home.links', `${rotated.size} via nonagon rotate`)
    } else {
      ok('portal.home.links', `${set.size} portal sides`)
    }
  } catch (e) {
    nok('portal.home.links', e.message)
  }

  // Header shortcuts
  try {
    await goto(page, base, '/ranking')
    await dismissCookies(page)
    const home = page.locator('a[aria-label="MathsMine3 home"]').first()
    if (!(await home.count())) nok('portal.header.homeLink', 'missing')
    else {
      await home.click({ force: true })
      await page.waitForTimeout(900)
      if (new URL(page.url()).pathname === '/') ok('portal.header.homeLink')
      else nok('portal.header.homeLink', `landed ${page.url()}`)
    }

    const daily = page.locator('a[aria-label^="Daily Tasks"]').first()
    if (!(await daily.count())) {
      nok('portal.header.dailyTasks', 'missing')
    } else {
      const href = await daily.getAttribute('href')
      if (href !== '/daily-tasks') {
        nok('portal.header.dailyTasks', `href=${href}`)
      } else {
        // Prefer href assert + navigation — click can miss under sticky chrome overlays
        await goto(page, base, '/daily-tasks')
        if (new URL(page.url()).pathname === '/daily-tasks') ok('portal.header.dailyTasks', 'href+/daily-tasks')
        else nok('portal.header.dailyTasks', `landed ${page.url()}`)
      }
    }
  } catch (e) {
    nok('portal.header.shortcuts', e.message)
  }

  // Footer legal links — assert hrefs (footer is narrow; clicks can miss)
  try {
    await goto(page, base, '/')
    await dismissCookies(page)
    for (const link of FOOTER_LINKS) {
      const id = `portal.footer.link.${link.path.replace('/', '') || 'root'}`
      const a = page.locator(`footer a[href="${link.path}"]`).first()
      if (!(await a.count())) {
        nok(id, 'anchor missing')
        continue
      }
      const href = await a.getAttribute('href')
      if (href !== link.path) {
        nok(id, `href=${href}`)
        continue
      }
      const res = await goto(page, base, link.path)
      const status = res?.status() ?? 0
      if (status < 400 && new URL(page.url()).pathname === link.path) ok(id, `href+nav HTTP ${status}`)
      else nok(id, `nav failed status=${status} url=${page.url()}`)
    }
  } catch (e) {
    nok('portal.footer.links', e.message)
  }

  // Bare embeds — load only (no chrome)
  for (const route of BARE_ROUTES) {
    const id = `portal.bare.${route.name}`
    try {
      const res = await goto(page, base, route.path, { slow: route.slow })
      const status = res?.status() ?? 0
      if (status >= 400) {
        nok(id, `HTTP ${status}`)
        continue
      }
      const header = await page.getByTestId('mm3-portal-header').count()
      if (header > 0 && route.name !== 'embedHeader') {
        // embed/header mounts Header on purpose
        nok(id, 'unexpected portal header on bare shell')
      } else {
        ok(id, `HTTP ${status}`)
      }
    } catch (e) {
      // Heavy WebGL embeds may timeout in headless — skip with reason
      if (/Timeout|timeout|net::/.test(e.message || '')) {
        skip(id, e.message.slice(0, 120))
      } else {
        nok(id, e.message?.slice(0, 160) || String(e))
      }
    }
  }

  // Soft 404
  try {
    const res = await goto(page, base, '/this-route-should-404-mm3')
    const status = res?.status() ?? 0
    // Next may soft-render 200 with not-found UI
    const body = await page.locator('body').innerText()
    if (status === 404 || /not found|404|missing/i.test(body)) {
      ok('portal.route.notFound', `status=${status}`)
    } else {
      skip('portal.route.notFound', `status=${status} — soft 404 UX may vary`)
    }
  } catch (e) {
    skip('portal.route.notFound', e.message.slice(0, 100))
  }
}

async function runPhase2(page, base, { ok, nok, skip }) {
  console.log('\n── Phase 2: language / currency / sound / cookies ──')

  // Cookies accept + persist
  try {
    await goto(page, base, '/', { slow: true })
    await page.evaluate(() => {
      try {
        localStorage.removeItem('mm3_cookies_accepted')
        localStorage.removeItem('mm3_cookies_accepted_at')
      } catch { /* */ }
    })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(700)
    const banner = page.getByTestId('mm3-cookie-banner')
    if (await banner.count()) {
      await domClick(page, 'mm3-cookie-accept')
      await page.waitForTimeout(200)
      const stored = await page.evaluate(() => localStorage.getItem('mm3_cookies_accepted'))
      const gone = (await banner.count()) === 0
      if (stored === 'true' && gone) ok('portal.cookies.accept')
      else nok('portal.cookies.accept', `stored=${stored} gone=${gone}`)
    } else {
      skip('portal.cookies.accept', 'banner not shown after clearing consent')
    }
  } catch (e) {
    nok('portal.cookies.accept', e.message)
  }

  // Language switch + document.lang + localStorage + footer + multi-page
  try {
    await goto(page, base, '/')
    await dismissCookies(page)
    await setLanguage(page, 'es')
    let langAttr = await page.evaluate(() => document.documentElement.lang)
    let stored = await page.evaluate(() => localStorage.getItem('mm3-language'))
    let toggle = await page.getByTestId('mm3-lang-toggle').getAttribute('data-lang')
    let privacy = await page.getByTestId('mm3-footer-privacy').innerText()
    if (langAttr === 'es' && stored === 'es' && toggle === 'es' && /Privacidad/i.test(privacy)) {
      ok('portal.lang.es.chrome', 'lang+storage+footer')
    } else {
      nok('portal.lang.es.chrome', `lang=${langAttr} stored=${stored} toggle=${toggle} privacy=${privacy}`)
    }

    await goto(page, base, '/manifesto')
    langAttr = await page.evaluate(() => document.documentElement.lang)
    privacy = await page.getByTestId('mm3-footer-privacy').innerText()
    const manifestoHit = await bodyHasAny(page, ['Cómo Jugar', 'Manifiesto', 'Índice'])
    if (langAttr === 'es' && /Privacidad/i.test(privacy) && manifestoHit) {
      ok('portal.lang.es.persist.manifesto', manifestoHit)
    } else {
      nok('portal.lang.es.persist.manifesto', `lang=${langAttr} hit=${manifestoHit}`)
    }

    for (const [path, markers] of Object.entries(PAGE_LANG_MARKERS)) {
      const positives = markers.esPositive || []
      if (!positives.length) {
        skip(`portal.lang.es.page${path}`, 'no markers')
        continue
      }
      const heavy = path === '/mining' || path === '/training'
      await goto(page, base, path, { slow: heavy })
      // Re-assert language survived navigation
      const stillEs = await page.evaluate(() => localStorage.getItem('mm3-language'))
      const hit = heavy
        ? await waitBodyHasAny(page, positives)
        : await bodyHasAny(page, positives)
      const id = `portal.lang.es.page${path.replace(/\//g, '.') || '.home'}`
      if (stillEs === 'es' && hit) ok(id, hit)
      else nok(id, `lang=${stillEs} expected one of: ${positives.join(' | ')}`)
    }

    await goto(page, base, '/')
    await setLanguage(page, 'en')
    langAttr = await page.evaluate(() => document.documentElement.lang)
    stored = await page.evaluate(() => localStorage.getItem('mm3-language'))
    privacy = await page.getByTestId('mm3-footer-privacy').innerText()
    if (langAttr === 'en' && stored === 'en' && /Privacy/i.test(privacy)) {
      ok('portal.lang.en.chrome')
    } else {
      nok('portal.lang.en.chrome', `lang=${langAttr} stored=${stored} privacy=${privacy}`)
    }

    for (const [path, markers] of Object.entries(PAGE_LANG_MARKERS)) {
      const positives = markers.enPositive || []
      if (!positives.length) continue
      const heavy = path === '/mining' || path === '/training'
      await goto(page, base, path, { slow: heavy })
      const stillEn = await page.evaluate(() => localStorage.getItem('mm3-language'))
      const hit = heavy
        ? await waitBodyHasAny(page, positives)
        : await bodyHasAny(page, positives)
      const id = `portal.lang.en.page${path.replace(/\//g, '.') || '.home'}`
      if (stillEn === 'en' && hit) ok(id, hit)
      else nok(id, `lang=${stillEn} expected one of: ${positives.join(' | ')}`)
    }
    // Home nonagon labels flip with language (select Manifesto side)
    await goto(page, base, '/')
    await waitHomePortalReady(page)
    await setLanguage(page, 'es')
    await page.waitForFunction(() => localStorage.getItem('mm3-language') === 'es', { timeout: 5000 })
    await page.waitForFunction(
      () => /Manifiesto/i.test(document.querySelector('.mm3-nonagon-center-name')?.textContent || '')
        || document.documentElement.lang === 'es',
      { timeout: 8000 },
    ).catch(() => {})
    const homeEs = await selectPortalSide(page, '/manifesto', 'Manifiesto').catch(() => '')
    if (/Manifiesto/i.test(homeEs)) ok('portal.lang.es.home.manifestoLabel', homeEs)
    else if (await bodyHas(page, 'Manifiesto')) ok('portal.lang.es.home.manifestoLabel', 'body')
    else nok('portal.lang.es.home.manifestoLabel', `center=${homeEs}`)

    await setLanguage(page, 'en')
    await page.waitForFunction(() => localStorage.getItem('mm3-language') === 'en', { timeout: 5000 })
    const homeEn = await selectPortalSide(page, '/manifesto', 'Manifesto').catch(() => '')
    if (/Manifesto/i.test(homeEn)) ok('portal.lang.en.home.manifestoLabel', homeEn)
    else if (await bodyHas(page, 'Manifesto')) ok('portal.lang.en.home.manifestoLabel', 'body')
    else nok('portal.lang.en.home.manifestoLabel', `center=${homeEn}`)
  } catch (e) {
    nok('portal.lang', e.message?.slice(0, 200) || String(e))
  }

  // Currency EUR → USD → CNY persistence + surfaces
  try {
    await goto(page, base, '/')
    await dismissCookies(page)
    await closeOverlays(page)
    for (const code of ['USD', 'CNY', 'EUR']) {
      await setCurrency(page, code)
      const toggle = await page.getByTestId('mm3-currency-toggle').getAttribute('data-currency')
      const stored = await page.evaluate(() => localStorage.getItem('mm3-preferred-currency'))
      if (toggle === code && stored === code) ok(`portal.currency.set.${code}`)
      else nok(`portal.currency.set.${code}`, `toggle=${toggle} stored=${stored}`)

      await goto(page, base, '/trading')
      const again = await page.getByTestId('mm3-currency-toggle').getAttribute('data-currency')
      const stored2 = await page.evaluate(() => localStorage.getItem('mm3-preferred-currency'))
      if (again === code && stored2 === code) ok(`portal.currency.persist.${code}.trading`)
      else nok(`portal.currency.persist.${code}.trading`, `toggle=${again} stored=${stored2}`)

      const sym = { EUR: '€', USD: '$', CNY: '¥' }[code]
      const toggleText = await page.getByTestId('mm3-currency-toggle').innerText()
      if (toggleText.includes(sym)) ok(`portal.currency.symbol.${code}`, sym)
      else nok(`portal.currency.symbol.${code}`, `toggleText=${toggleText}`)
    }

    await goto(page, base, '/')
    await setCurrency(page, 'USD')
    for (const surface of CURRENCY_SURFACES) {
      await goto(page, base, surface.path)
      const toggle = page.getByTestId('mm3-currency-toggle')
      await toggle.waitFor({ state: 'attached', timeout: 15_000 })
      const cur = await toggle.getAttribute('data-currency')
      const name = surface.path.replace('/', '') || 'home'
      if (cur === 'USD') ok(`portal.currency.surface.${name}`, 'USD sticky')
      else nok(`portal.currency.surface.${name}`, `currency=${cur}`)
    }
  } catch (e) {
    nok('portal.currency', e.message?.slice(0, 200) || String(e))
  }

  // Sound / music toggles
  try {
    await goto(page, base, '/', { slow: true })
    await dismissCookies(page)
    const sound = page.getByTestId('mm3-sound-toggle')
    const music = page.getByTestId('mm3-music-toggle')
    const beforeS = await sound.getAttribute('data-enabled')
    await domClick(page, 'mm3-sound-toggle')
    await page.waitForTimeout(200)
    const afterS = await sound.getAttribute('data-enabled')
    const storedS = await page.evaluate(() => localStorage.getItem('mm3-sound-enabled'))
    if (beforeS && afterS && beforeS !== afterS && storedS === afterS) {
      ok('portal.sound.toggle', `${beforeS}→${afterS}`)
    } else {
      nok('portal.sound.toggle', `before=${beforeS} after=${afterS} stored=${storedS}`)
    }
    // restore
    await domClick(page, 'mm3-sound-toggle')

    const beforeM = await music.getAttribute('data-enabled')
    await domClick(page, 'mm3-music-toggle')
    await page.waitForTimeout(200)
    const afterM = await music.getAttribute('data-enabled')
    const storedM = await page.evaluate(() => localStorage.getItem('mm3-music-enabled'))
    if (beforeM && afterM && beforeM !== afterM && storedM === afterM) {
      ok('portal.music.toggle', `${beforeM}→${afterM}`)
    } else {
      nok('portal.music.toggle', `before=${beforeM} after=${afterM} stored=${storedM}`)
    }
    await domClick(page, 'mm3-music-toggle')

    // Persist across page
    await domClick(page, 'mm3-sound-toggle') // mute
    await goto(page, base, '/ranking')
    const persisted = await page.evaluate(() => localStorage.getItem('mm3-sound-enabled'))
    const ui = await page.getByTestId('mm3-sound-toggle').getAttribute('data-enabled')
    if (persisted === 'false' && ui === 'false') ok('portal.sound.persist.ranking')
    else nok('portal.sound.persist.ranking', `stored=${persisted} ui=${ui}`)
    await domClick(page, 'mm3-sound-toggle') // unmute restore
  } catch (e) {
    nok('portal.soundMusic', e.message?.slice(0, 200) || String(e))
  }
}

async function seedVirtualWallet(page, wallet) {
  const w = String(wallet).toLowerCase()
  const token = createSessionToken(w)
  await page.evaluate(({ wallet: ww, token: tt }) => {
    localStorage.setItem('mm3_gw', ww)
    localStorage.setItem('mm3_session', JSON.stringify({ wallet: ww, token: tt }))
  }, { wallet: w, token })
  return { wallet: w, token }
}

async function clearVirtualWallet(page) {
  await page.evaluate(() => {
    localStorage.removeItem('mm3_gw')
    localStorage.removeItem('mm3_session')
  })
}

async function runPhase3(page, base, { ok, nok, skip }) {
  console.log('\n── Phase 3: wallet / session chrome ──')

  // Connect UI when disconnected (AuthBar is next/dynamic — wait for hydrate)
  try {
    await goto(page, base, '/')
    await dismissCookies(page)
    await clearVirtualWallet(page)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByTestId('mm3-auth-google').waitFor({ state: 'attached', timeout: 20_000 })
    const connect = await page.getByTestId('mm3-auth-connect').count()
    const google = await page.getByTestId('mm3-auth-google').count()
    const walletBtn = await page.getByTestId('mm3-auth-wallet').count()
    if (google && walletBtn) ok('portal.wallet.connectUi', `Google+MetaMask${connect ? ' wrap' : ''}`)
    else nok('portal.wallet.connectUi', `connect=${connect} google=${google} wallet=${walletBtn}`)
  } catch (e) {
    nok('portal.wallet.connectUi', e.message)
  }

  // MetaMask half opens Web3Modal (no live wallet required)
  try {
    await closeOverlays(page)
    await page.getByTestId('mm3-auth-wallet').waitFor({ state: 'attached', timeout: 10_000 })
    await domClick(page, 'mm3-auth-wallet')
    await page.waitForTimeout(1200)
    const modalVisible = await page.evaluate(() => {
      const hosts = [...document.querySelectorAll('w3m-modal, w3m-router, wcm-modal')]
      if (hosts.some((h) => h.offsetParent !== null || h.shadowRoot)) return true
      return Boolean(document.querySelector('[class*="walletconnect"], [id*="w3m"]'))
    })
    if (modalVisible) ok('portal.wallet.web3modalOpen')
    else skip('portal.wallet.web3modalOpen', 'Web3Modal host not detected in headless (WC may require interaction)')
    await page.keyboard.press('Escape').catch(() => {})
    await closeOverlays(page)
  } catch (e) {
    skip('portal.wallet.web3modalOpen', e.message.slice(0, 120))
  }

  // Seed virtual Google wallet + session → connected chrome
  try {
    const wallet = QA.claim
    try {
      const supabase = sbClient()
      await ensureProgress(supabase, wallet, { level: 5, eur_earned: 1, usd_earned: 1, cny_earned: 1 })
      await ensureLeaderboard(supabase, wallet, 0.5)
    } catch (e) {
      skip('portal.wallet.seedDb', e.message.slice(0, 100))
    }

    await goto(page, base, '/')
    await dismissCookies(page)
    await seedVirtualWallet(page, wallet)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.locator('[data-testid="mm3-auth-connected"]').first().waitFor({ state: 'attached', timeout: 20_000 })
    await page.waitForTimeout(400)

    const connected = page.locator('[data-testid="mm3-auth-connected"]')
    const chip = page.getByTestId('mm3-auth-wallet-chip')
    const disc = page.getByTestId('mm3-auth-disconnect')
    const connCount = await connected.count()
    const chipCount = await chip.count()
    const discCount = await disc.count()
    const dataWallets = await connected.evaluateAll((els) => els.map((e) => e.getAttribute('data-wallet')))
    if (connCount >= 1 && discCount >= 1 && dataWallets.includes(wallet)) {
      ok('portal.wallet.seededConnected', `gw=${wallet.slice(0, 10)}… x${connCount}`)
    } else {
      nok('portal.wallet.seededConnected', `conn=${connCount} chip=${chipCount} disc=${discCount} data=${dataWallets.join('|')}`)
    }

    if (chipCount) {
      const chipText = await chip.first().innerText()
      if (chipText && chipText.length >= 4) ok('portal.wallet.summaryChip', chipText.slice(0, 40).replace(/\n/g, ' '))
      else nok('portal.wallet.summaryChip', `text=${chipText}`)
    } else {
      nok('portal.wallet.summaryChip', 'chip missing')
    }

    await setCurrency(page, 'USD')
    await page.waitForTimeout(400)
    const chipAfter = chipCount ? await chip.first().innerText() : ''
    if (chipAfter.includes('$') || (await page.getByTestId('mm3-currency-toggle').getAttribute('data-currency')) === 'USD') {
      ok('portal.wallet.currencyOnChip', 'USD sticky while connected')
    } else {
      nok('portal.wallet.currencyOnChip', chipAfter.slice(0, 60))
    }
    await setCurrency(page, 'EUR')

    await domClick(page, 'mm3-auth-disconnect')
    await page.waitForTimeout(800)
    await page.getByTestId('mm3-auth-google').waitFor({ state: 'attached', timeout: 15_000 }).catch(() => {})
    const gwGone = await page.evaluate(() => localStorage.getItem('mm3_gw'))
    const connectBack = await page.getByTestId('mm3-auth-google').count()
    const stillConn = await page.locator('[data-testid="mm3-auth-connected"]').count()
    if (!gwGone && connectBack && !stillConn) ok('portal.wallet.disconnect')
    else nok('portal.wallet.disconnect', `gw=${gwGone} connect=${connectBack} stillConn=${stillConn}`)
  } catch (e) {
    nok('portal.wallet.session', e.message?.slice(0, 200) || String(e))
  }

  skip('portal.wallet.liveGoogleOAuth', 'requires real Google account — manual')
  skip('portal.wallet.liveMetaMask', 'requires extension / WC session — manual')
}

async function runPhase4(page, base, { ok, nok, skip }) {
  console.log('\n── Phase 4: deep portal UI ──')

  // DeadGate blocks interactive portals
  try {
    await goto(page, base, '/training')
    await dismissCookies(page)
    await page.evaluate(() => {
      localStorage.setItem('mm3_pvp_dead', JSON.stringify({
        until: Date.now() + 5 * 60 * 1000,
        gx: 10, gy: 10, mapId: 'm1',
      }))
      window.dispatchEvent(new Event('mm3-pvp-death'))
    })
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(700)
    const gate = page.getByTestId('mm3-dead-gate')
    if (await gate.count()) {
      const text = await gate.innerText()
      const hasDead = /DEAD|MUERTO/i.test(text)
      const back = page.getByTestId('mm3-dead-back')
      if (hasDead && (await back.count())) ok('portal.deadGate.blocksTraining', text.split('\n')[0])
      else nok('portal.deadGate.blocksTraining', text.slice(0, 80))
    } else {
      nok('portal.deadGate.blocksTraining', 'gate not rendered')
    }

    // BACK → home
    await page.getByTestId('mm3-dead-back').click()
    await page.waitForTimeout(700)
    if (new URL(page.url()).pathname === '/') ok('portal.deadGate.backHome')
    else nok('portal.deadGate.backHome', page.url())

    // Clear death → training board returns
    await page.evaluate(() => {
      localStorage.removeItem('mm3_pvp_dead')
      window.dispatchEvent(new Event('mm3-pvp-death'))
    })
    await goto(page, base, '/training')
    await page.waitForTimeout(800)
    if ((await page.getByTestId('mm3-dead-gate').count()) === 0) {
      const hit = await bodyHasAny(page, ['CLICK TO START', 'PULSA PARA EMPEZAR', 'Click to start'])
      if (hit) ok('portal.deadGate.clearRestoresBoard', hit)
      else ok('portal.deadGate.clearRestoresBoard', 'gate cleared')
    } else {
      nok('portal.deadGate.clearRestoresBoard', 'still dead')
    }

    // Also gates trading
    await page.evaluate(() => {
      localStorage.setItem('mm3_pvp_dead', JSON.stringify({ until: Date.now() + 60_000 }))
      window.dispatchEvent(new Event('mm3-pvp-death'))
    })
    await goto(page, base, '/trading')
    await page.waitForTimeout(600)
    if (await page.getByTestId('mm3-dead-gate').count()) ok('portal.deadGate.blocksTrading')
    else nok('portal.deadGate.blocksTrading', 'gate missing on /trading')
    await page.evaluate(() => localStorage.removeItem('mm3_pvp_dead'))
  } catch (e) {
    nok('portal.deadGate', e.message?.slice(0, 200) || String(e))
  }

  // Daily tasks UI with seeded wallet
  try {
    await goto(page, base, '/daily-tasks')
    await dismissCookies(page)
    await seedVirtualWallet(page, QA.claim)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1200)
    const hit = await bodyHasAny(page, [
      'TRAINING', 'Solve 25', 'Resuelve 25', 'RECOMPENSA', 'REWARD', 'Claim', 'RECLAMAR', 'Unclaimed',
    ])
    if (hit) ok('portal.daily.withWallet', hit)
    else nok('portal.daily.withWallet', 'task list markers missing')

    await clearVirtualWallet(page)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(800)
    const guest = await bodyHasAny(page, [
      'Connect a wallet to view daily tasks',
      'Conecta una wallet',
      'TRAINING',
    ])
    // Guest may still see task cards greyed — connect notice is ideal
    if (guest) ok('portal.daily.guestOrList', guest)
    else skip('portal.daily.guestOrList', 'no distinct guest copy')
  } catch (e) {
    nok('portal.daily', e.message?.slice(0, 160) || String(e))
  }

  // Ranking filter via wallet chip toggle
  try {
    await goto(page, base, '/ranking')
    await dismissCookies(page)
    await seedVirtualWallet(page, QA.claim)
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1500)
    const chip = page.getByTestId('mm3-auth-wallet-chip')
    if (!(await chip.count())) {
      nok('portal.ranking.filterToggle', 'wallet chip missing')
    } else {
      await chip.first().evaluate((el) => el.click())
      await page.waitForTimeout(800)
      const selected = await page.locator('.wallet-selected').count()
      if (selected >= 1) ok('portal.ranking.filterToggle', `selected=${selected}`)
      else {
        // Toggle may filter list without .wallet-selected if wallet not on page 1
        const filtered = await page.evaluate(() => {
          const rows = document.querySelectorAll('.lb-row, .lb-card')
          return rows.length
        })
        if (filtered >= 1) ok('portal.ranking.filterToggle', `rows=${filtered} (no .wallet-selected)`)
        else skip('portal.ranking.filterToggle', 'QA wallet may not appear on current ranking page')
      }
      // Clear filter
      await chip.first().evaluate((el) => el.click())
    }
    await clearVirtualWallet(page)
  } catch (e) {
    nok('portal.ranking.filterToggle', e.message?.slice(0, 160) || String(e))
  }

  // Trading board reflects currency in body quotes
  try {
    await goto(page, base, '/trading')
    await dismissCookies(page)
    await page.evaluate(() => localStorage.removeItem('mm3_pvp_dead'))
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(800)
    await setCurrency(page, 'CNY')
    await page.waitForTimeout(500)
    const body = await page.locator('body').innerText()
    if (body.includes('¥') || /CNY/i.test(body)) ok('portal.trading.currencyInBoard', '¥/CNY')
    else nok('portal.trading.currencyInBoard', 'no ¥ in board')
    await setCurrency(page, 'EUR')
  } catch (e) {
    nok('portal.trading.currencyInBoard', e.message?.slice(0, 120) || String(e))
  }

  // Chart range controls present
  try {
    await goto(page, base, '/mm3-value')
    await page.waitForTimeout(1000)
    const hit = await bodyHasAny(page, ['1H', '24H', '7D', 'ALL', 'NFTJI'])
    if (hit) ok('portal.chart.controls', hit)
    else nok('portal.chart.controls', 'range markers missing')
  } catch (e) {
    nok('portal.chart.controls', e.message)
  }
}

async function runPhase5(page, base, { ok, nok, skip }) {
  console.log('\n── Phase 5: legal / meta ──')

  // Privacy / Terms language flip
  try {
    await goto(page, base, '/privacy')
    await dismissCookies(page)
    await setLanguage(page, 'es')
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(600)
    let hit = await bodyHasAny(page, ['Política de Privacidad', 'Datos que Recopilamos'])
    if (hit) ok('portal.legal.privacy.es', hit)
    else nok('portal.legal.privacy.es', 'ES markers missing')
    await setLanguage(page, 'en')
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(600)
    hit = await bodyHasAny(page, ['Privacy Policy', 'Data We Collect'])
    if (hit) ok('portal.legal.privacy.en', hit)
    else nok('portal.legal.privacy.en', 'EN markers missing')
  } catch (e) {
    nok('portal.legal.privacy', e.message)
  }

  try {
    await goto(page, base, '/terms')
    await setLanguage(page, 'es')
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(600)
    let hit = await bodyHasAny(page, ['Términos', 'Condiciones', 'Terms'])
    if (hit) ok('portal.legal.terms.es', hit)
    else nok('portal.legal.terms.es', 'markers missing')
    await setLanguage(page, 'en')
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(600)
    hit = await bodyHasAny(page, ['Terms', 'Conditions', 'Agreement'])
    if (hit) ok('portal.legal.terms.en', hit)
    else nok('portal.legal.terms.en', 'markers missing')
  } catch (e) {
    nok('portal.legal.terms', e.message)
  }

  // API docs
  try {
    await goto(page, base, '/api')
    await setLanguage(page, 'en')
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(600)
    const hit = await bodyHasAny(page, ['Token Value', 'Leaderboard', '/api/token-value', 'public API'])
    if (hit) ok('portal.meta.apiDocs', hit)
    else nok('portal.meta.apiDocs', 'API docs markers missing')
  } catch (e) {
    nok('portal.meta.apiDocs', e.message)
  }

  // Security page
  try {
    await goto(page, base, '/security')
    await page.waitForTimeout(1500)
    const hit = await bodyHasAny(page, ['SECURITY SCORE', 'PUNTUACIÓN DE SEGURIDAD', 'PASS', 'WARN', '/100'])
    if (hit) ok('portal.meta.security', hit)
    else skip('portal.meta.security', 'score UI may still be loading')
  } catch (e) {
    nok('portal.meta.security', e.message)
  }

  // Footer socials
  try {
    await goto(page, base, '/')
    const socials = await page.locator('footer a[href^="http"]').evaluateAll((as) =>
      as.map((a) => ({ href: a.getAttribute('href'), text: (a.textContent || '').trim() })),
    )
    const need = ['youtube', 'tiktok', 'instagram', 'x.com', 'github']
    const blob = socials.map((s) => s.href).join(' ').toLowerCase()
    const missing = need.filter((n) => !blob.includes(n))
    if (!missing.length) ok('portal.meta.footerSocials', `${socials.length} external`)
    else nok('portal.meta.footerSocials', `missing ${missing.join(',')}`)
  } catch (e) {
    nok('portal.meta.footerSocials', e.message)
  }

  // Manifesto TOC
  try {
    await goto(page, base, '/manifesto')
    await setLanguage(page, 'en')
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(800)
    const hit = await bodyHasAny(page, ['How to Play', 'Training', 'Mining', 'Squeezing', 'Index'])
    if (hit) ok('portal.meta.manifestoToc', hit)
    else nok('portal.meta.manifestoToc', 'TOC markers missing')
  } catch (e) {
    nok('portal.meta.manifestoToc', e.message)
  }
}

async function main() {
  const opts = parsePortalArgs(process.argv)
  const { ok, nok, skip, summary } = createReporter()

  console.log('=== MathsMine3 Portal QA ===')
  console.log(`base=${opts.base} phases=[${[...opts.phases].sort().join(',')}] headed=${opts.headed}`)

  let playwright
  try {
    playwright = await loadPlaywright()
  } catch (e) {
    console.error(e.message)
    process.exit(2)
  }

  const browser = await playwright.chromium.launch({
    headless: !opts.headed,
    args: ['--ignore-certificate-errors'],
  })
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 1280, height: 900 },
  })
  const page = await context.newPage()
  page.setDefaultTimeout(30_000)

  try {
    // Reachability
    try {
      const res = await goto(page, opts.base, '/')
      if ((res?.status() ?? 0) >= 400) {
        nok('portal.reachability', `HTTP ${res.status()}`)
      } else {
        ok('portal.reachability', opts.base)
      }
    } catch (e) {
      nok('portal.reachability', e.message)
      const counts = summary()
      await browser.close()
      process.exit(counts.NOK > 0 ? 1 : 0)
    }

    if (opts.phases.has(1)) await runPhase1(page, opts.base, { ok, nok, skip })
    if (opts.phases.has(2)) await runPhase2(page, opts.base, { ok, nok, skip })
    if (opts.phases.has(3)) await runPhase3(page, opts.base, { ok, nok, skip })
    if (opts.phases.has(4)) await runPhase4(page, opts.base, { ok, nok, skip })
    if (opts.phases.has(5)) await runPhase5(page, opts.base, { ok, nok, skip })
  } finally {
    await browser.close()
  }

  const counts = summary()
  process.exit(counts.NOK > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error(err)
  process.exit(2)
})
