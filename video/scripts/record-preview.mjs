import {copyFile, mkdir, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {chromium} from 'playwright'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const recordingsDir = path.join(root, 'public', 'recordings')
const tempDir = path.join(tmpdir(), `vaultline-playwright-${Date.now()}`)
const destination = path.join(recordingsDir, 'transfer.webm')
const timelinePath = path.join(root, 'public', 'timeline.json')
const url = process.env.VAULTLINE_PREVIEW_URL ?? 'http://localhost:3001/#demo'

await mkdir(recordingsDir, {recursive: true})
await mkdir(tempDir, {recursive: true})

const browser = await chromium.launch({channel: 'chrome', headless: true})
const context = await browser.newContext({
  deviceScaleFactor: 1,
  recordVideo: {dir: tempDir, size: {width: 1440, height: 900}},
  viewport: {width: 1440, height: 900},
})
const page = await context.newPage()
const video = page.video()
const startedAt = Date.now()
const events = {}

try {
  await page.goto(url, {waitUntil: 'networkidle'})
  await page.waitForTimeout(2000)

  const input = page.getByLabel('发送给银行服务端的自然语言请求')
  await input.click()
  await input.fill('')
  await input.pressSequentially('给张三转300元，备注房租', {delay: 70})
  events.intentAt = Date.now()
  await page.getByRole('button', {name: /发送到服务端/}).click()

  const actionHeading = page.locator('.control-heading h2')
  await actionHeading.filter({hasText: 'awaiting_confirmation'}).waitFor({timeout: 10000})
  events.actionAt = Date.now()
  await page.waitForTimeout(4000)

  await page.getByRole('button', {name: /确认并执行/}).click()
  await actionHeading.filter({hasText: 'succeeded'}).waitFor({timeout: 10000})
  events.receiptAt = Date.now()
  await page.waitForTimeout(4000)
  events.endedAt = Date.now()

  await page.close()
  await context.close()

  const source = await video.path()
  await copyFile(source, destination)

  const seconds = (timestamp) => Number(((timestamp - startedAt) / 1000).toFixed(3))
  await writeFile(
    timelinePath,
    `${JSON.stringify(
      {
        clip: 'recordings/transfer.webm',
        durationSeconds: seconds(events.endedAt),
        events: {
          intent: seconds(events.intentAt),
          action: seconds(events.actionAt),
          receipt: seconds(events.receiptAt),
          ended: seconds(events.endedAt),
        },
      },
      null,
      2,
    )}\n`,
  )
  console.log(`recorded ${destination}`)
} finally {
  await browser.close()
  await rm(tempDir, {force: true, recursive: true})
}
