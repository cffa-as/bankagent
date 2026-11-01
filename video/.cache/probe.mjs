const B = process.env.B ?? 'http://localhost:8090'
let n = 0
export async function api(method, path, body) {
  const headers = { Authorization: 'Bearer demo-user-1' }
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    headers['Idempotency-Key'] = `probe-${Date.now()}-${n++}`
  }
  const r = await fetch(B + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  const t = await r.text()
  try { return { status: r.status, ...JSON.parse(t) } } catch { return { status: r.status, raw: t.slice(0, 400) } }
}
const step = process.argv[2]
if (step === 'send') {
  const c = await api('POST', '/v1/conversations', {})
  console.log('conv', JSON.stringify(c).slice(0, 300))
  const id = c.data.conversation_id
  const m = await api('POST', `/v1/conversations/${id}/messages`, { text: process.argv[3] })
  const { writeFileSync } = await import('node:fs')
  writeFileSync('.cache/last.json', JSON.stringify(m, null, 1))
  console.log(JSON.stringify(m).slice(0, 600))
}
