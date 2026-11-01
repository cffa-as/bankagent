import fs from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import { chromium } from '../../video/node_modules/playwright/index.mjs'

const BASE_URL = (process.env.VAULTLINE_E2E_BASE_URL || 'http://127.0.0.1:13100').replace(/\/+$/, '')
const OUTPUT = process.env.VAULTLINE_E2E_OUT || 'evaluation/results/e2e.json'
const CHROME =
  process.env.VAULTLINE_CHROME_PATH ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const results = []
const consoleErrors = []
const serverErrors = []
const expectedCases = 8

const browser = await chromium.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--disable-dev-shm-usage'],
})
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const page = await context.newPage()

page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text())
})
page.on('pageerror', (error) => consoleErrors.push(error.message))
page.on('response', (response) => {
  if (response.status() >= 500) serverErrors.push(`${response.status()} ${response.url()}`)
})

async function runCase(id, title, fn) {
  const started = performance.now()
  try {
    await fn()
    results.push({
      id,
      title,
      passed: true,
      duration_ms: Math.round(performance.now() - started),
      details: 'browser flow completed',
    })
  } catch (error) {
    results.push({
      id,
      title,
      passed: false,
      duration_ms: Math.round(performance.now() - started),
      details: error instanceof Error ? error.stack || error.message : String(error),
    })
    throw error
  }
}

async function send(text) {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      /\/v1\/conversations\/[^/]+\/messages$/.test(new URL(response.url()).pathname),
    { timeout: 20_000 },
  )
  await page.locator('#ws-composer').fill(text)
  await page.getByRole('button', { name: /发送（Enter 发送/ }).click()
  const response = await responsePromise
  const body = await response.json()
  assert.equal(response.status(), 200, JSON.stringify(body))
  return body.data
}

async function confirmAction(buttonName, pathPattern) {
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      pathPattern.test(new URL(response.url()).pathname),
    { timeout: 20_000 },
  )
  await page.getByRole('button', { name: buttonName }).last().click()
  const response = await responsePromise
  const body = await response.json()
  assert.equal(response.status(), 200, JSON.stringify(body))
  assert.ok(body.data?.result, 'business result is required before showing success')
  await page.getByText('办理成功').last().waitFor({ timeout: 20_000 })
  assert.equal(await page.getByText('暂未收到银行回执').count(), 0, 'success must render a receipt, not a pending-receipt state')
}

try {
  await page.goto(`${BASE_URL}/workspace`, { waitUntil: 'domcontentloaded' })
  await page.locator('#ws-composer').waitFor({ timeout: 20_000 })
  await page.getByText('安全通道就绪').waitFor({ timeout: 20_000 })

  await runCase('E2E-01', '余额查询 UI 到服务端事实', async () => {
    const data = await send('查一下我的余额')
    assert.ok(data.balance, 'balance payload missing')
    await page.getByText(/当前余额/).last().waitFor()
  })

  await runCase('E2E-02', '月度账单分析 UI', async () => {
    const data = await send('分析一下这个月账单')
    assert.ok(data.bill, 'bill payload missing')
    await page.getByText(/本月消费共/).last().waitFor()
  })

  await runCase('E2E-03', '黄色转账确认与真实回执', async () => {
    const data = await send('给张三转300元，备注E2E确认')
    assert.equal(data.action?.risk_level, 'yellow')
    await page.getByRole('button', { name: /确认转账/ }).last().waitFor()
    await confirmAction(/确认转账/, /\/v1\/actions\/[^/]+\/confirm$/)
  })

  await runCase('E2E-04', '红色转账 Action-bound MFA', async () => {
    const data = await send('给张三转800.01元，备注E2E大额')
    assert.equal(data.action?.risk_level, 'red')
    const input = page.locator('input[name="mfa_code"]')
    await input.waitFor({ timeout: 20_000 })
    await input.fill('000000')
    const responsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        /\/v1\/actions\/[^/]+\/mfa\/verify$/.test(new URL(response.url()).pathname),
      { timeout: 20_000 },
    )
    await page.getByRole('button', { name: '验证并继续' }).click()
    const response = await responsePromise
    const body = await response.json()
    assert.equal(response.status(), 200, JSON.stringify(body))
    assert.ok(body.data?.result, 'business result is required before showing success')
    await page.getByText('办理成功').last().waitFor({ timeout: 20_000 })
    assert.equal(await page.getByText('暂未收到银行回执').count(), 0, 'success must render a receipt, not a pending-receipt state')
  })

  await runCase('E2E-05', '订阅取消确认与回执', async () => {
    const data = await send('取消我的订阅')
    assert.equal(data.action?.risk_level, 'yellow')
    await page.getByRole('button', { name: '确认取消订阅' }).last().waitFor()
    await confirmAction('确认取消订阅', /\/v1\/actions\/[^/]+\/confirm$/)
  })

  await runCase('E2E-06', '流动性预检报告', async () => {
    const data = await send('预留2000元未来30天够不够')
    assert.ok(data.liquidity, 'liquidity payload missing')
    const dialog = page.locator('dialog[aria-labelledby="ws-liquidity-title"][open]')
    await dialog.waitFor({ timeout: 20_000 })
    await page.getByText('流动性预检报告').waitFor()
    await page.getByRole('button', { name: '关闭流动性预检' }).click()
  })

  await runCase('E2E-07', '跨场景生日计划 DAG', async () => {
    const data = await send('爱人生日预算1000元，日期2026-12-20')
    assert.ok(data.workflow, 'workflow payload missing')
    const workflowButton = page.getByRole('button', { name: /爱人生日准备/ }).last()
    await workflowButton.waitFor({ timeout: 20_000 })
    await workflowButton.click()
    await page.getByText('资金计划').first().waitFor()
  })

  await runCase('E2E-08', '操作记录审计时间线', async () => {
    await page.getByRole('button', { name: '操作记录' }).click()
    await page.getByText('本次会话的业务').waitFor({ timeout: 20_000 })
    await page.getByText('操作记录').first().waitFor()
  })

  const screenshotDir = path.join(path.dirname(OUTPUT), 'screenshots')
  await fs.mkdir(screenshotDir, { recursive: true })
  await page.screenshot({
    path: path.join(screenshotDir, 'workspace-e2e-audit.png'),
    fullPage: false,
  })
} catch (error) {
  consoleErrors.push(error instanceof Error ? error.stack || error.message : String(error))
} finally {
  await context.close()
  await browser.close()
}

const durations = results.map((item) => item.duration_ms)
const sorted = [...durations].sort((a, b) => a - b)
const passed = results.filter((item) => item.passed).length
const e2e = {
  version: 'vaultline-browser-e2e-v1',
  evaluated_at: new Date().toISOString(),
  base_url: BASE_URL,
  cases: expectedCases,
  passed,
  failed: expectedCases - passed,
  pass_rate: passed / expectedCases,
  mean_duration_ms: durations.length === 0 ? 0 : durations.reduce((sum, value) => sum + value, 0) / durations.length,
  p95_duration_ms:
    sorted.length === 0 ? 0 : sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)],
  console_errors: consoleErrors,
  server_errors: serverErrors,
  results,
}

await fs.mkdir(path.dirname(OUTPUT), { recursive: true })
await fs.writeFile(OUTPUT, `${JSON.stringify(e2e, null, 2)}\n`)
console.log(JSON.stringify({ cases: e2e.cases, passed, failed: e2e.failed, output: OUTPUT }, null, 2))

if (passed !== expectedCases || consoleErrors.length > 0 || serverErrors.length > 0) {
  process.exitCode = 1
}
