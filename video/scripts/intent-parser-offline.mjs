// Offline OpenAI-compatible intent parser used only for film recording when no hosted model is reachable.
// It returns the same IntentPlan JSON the backend expects from a model; the Go service still validates
// the plan, resolves beneficiaries, assigns risk, and owns confirmation, MFA and execution.
//
//   node scripts/intent-parser-offline.mjs            # listens on :8095
//   BANKAGENT_LLM_BASE_URL=http://localhost:8095/v1 BANKAGENT_LLM_API_KEY=offline BANKAGENT_LLM_MODEL=offline go run ./cmd/bankagent
import {createServer} from 'node:http'

const port = Number(process.env.PORT ?? 8095)
const CN_DIGITS = {一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10}
const WEEKDAYS = {一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0, 天: 0}

function yuanToMinor(text) {
  const match = text.match(/(\d+(?:\.\d{1,2})?)\s*元/)
  return match ? Math.round(Number(match[1]) * 100) : null
}

function nextWeekday(day, hour = 9) {
  const now = new Date(Date.now() + 8 * 3600_000)
  const offset = (day - now.getUTCDay() + 7) % 7 || 7
  const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset, hour - 8))
  return target.toISOString().replace('.000Z', 'Z')
}

function plan(text) {
  const weekday = text.match(/(?:这|本|下)?(?:周|星期)([一二三四五六日天])/)
  const transfer = text.match(/给\s*([\u4e00-\u9fa5]{2,4})\s*转\s*(\d+(?:\.\d{1,2})?)\s*元[，,\s]*(?:备注|交|用于)?\s*([\u4e00-\u9fa5A-Za-z0-9]{0,20})/)
  if (weekday && transfer) {
    return {
      intent: 'scheduled_transfer',
      entities: {
        beneficiary_name: transfer[1],
        amount_minor: Math.round(Number(transfer[2]) * 100),
        remark: transfer[3] || '预约转账',
        scheduled_at: nextWeekday(WEEKDAYS[weekday[1]]),
      },
      missing_fields: [],
      candidate_plan: [
        {kind: 'resolve_beneficiary', reason: '匹配预置收款人'},
        {kind: 'create_scheduled_transfer', reason: '到期前需用户确认'},
      ],
    }
  }

  if (/AA|均摊|平摊/i.test(text)) {
    const total = yuanToMinor(text)
    const segment = text.match(/(?:我和|和|与)([\u4e00-\u9fa5、，,]+?)(?:\d+|[二两三四五六七八九十])\s*人/)
    const names = [...new Set((segment?.[1] ?? '').split(/[、，,和与]/).map((name) => name.trim()).filter(Boolean))]
    const countMatch = text.match(/(\d+|[二两三四五六七八九十])\s*人/)
    const count = countMatch ? (CN_DIGITS[countMatch[1]] ?? Number(countMatch[1])) : names.length + 1
    if (!total || names.length + 1 !== count) return {intent: 'unknown', entities: {}, missing_fields: ['participants'], candidate_plan: []}
    return {
      intent: 'transfer_split',
      entities: {
        total_amount_minor: total,
        participants: [{name: '我', is_payer: true}, ...names.map((name) => ({name, is_payer: false}))],
      },
      missing_fields: [],
      candidate_plan: [
        {kind: 'split_amount', reason: '服务端按人数均分'},
        {kind: 'create_collection_requests', reason: '向参与人发起收款'},
      ],
    }
  }

  const birthday = text.match(/(\d{1,2})\s*月\s*(\d{1,2})\s*日\s*(\d{1,2})[:：](\d{2})/)
  if (/生日/.test(text) && yuanToMinor(text) && birthday) {
    const year = new Date(Date.now() + 8 * 3600_000).getUTCFullYear()
    const [, month, day, hour, minute] = birthday.map(Number)
    const eventAt = new Date(Date.UTC(year, month - 1, day, hour - 8, minute)).toISOString().replace('.000Z', 'Z')
    return {
      intent: 'birthday_plan',
      entities: {budget_minor: yuanToMinor(text), event_at: eventAt},
      missing_fields: [],
      candidate_plan: [
        {kind: 'reminder', reason: '生日前两天提醒'},
        {kind: 'budget_lock', reason: '锁定预算需 MFA'},
        {kind: 'external_order', reason: '鲜花与蛋糕订单逐项确认'},
      ],
    }
  }

  return {intent: 'unknown', entities: {}, missing_fields: [], candidate_plan: []}
}

createServer((req, res) => {
  if (req.method !== 'POST' || !req.url?.endsWith('/chat/completions')) {
    res.writeHead(404).end()
    return
  }
  let body = ''
  req.on('data', (chunk) => (body += chunk))
  req.on('end', () => {
    const messages = JSON.parse(body).messages ?? []
    const text = messages[messages.length - 1]?.content ?? ''
    const content = JSON.stringify(plan(text))
    // Requests mentioning "下周" model a slow upstream so the run-control scene can stop or hand off a live run.
    const latency = /下周/.test(text) ? Number(process.env.SLOW_MS ?? 9000) : Number(process.env.LATENCY_MS ?? 900)
    console.log(`[intent] ${latency}ms ${text} -> ${content.slice(0, 160)}`)
    setTimeout(() => {
      res.writeHead(200, {'Content-Type': 'application/json'})
      res.end(JSON.stringify({choices: [{message: {role: 'assistant', content}}]}))
    }, latency)
  })
}).listen(port, () => console.log(`offline intent parser on :${port}`))
