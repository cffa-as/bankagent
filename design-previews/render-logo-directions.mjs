import {chromium} from '../video/node_modules/playwright/index.mjs'

const browser = await chromium.launch({channel: 'chrome', headless: true})
const page = await browser.newPage({deviceScaleFactor: 1, viewport: {width: 1800, height: 1200}})
const url = new URL('./vaultline-logo-directions.html', import.meta.url)
await page.goto(url.href)
await page.waitForLoadState('networkidle')

await page.screenshot({
  path: new URL('./vaultline-logo-directions.png', import.meta.url).pathname,
  fullPage: true,
})

for (const name of ['threshold-mark', 'reserve-mark', 'route-mark']) {
  await page.locator(`#${name}`).screenshot({
    path: new URL(`./${name}.png`, import.meta.url).pathname,
  })
}

await browser.close()
