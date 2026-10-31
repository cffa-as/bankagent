export type Envelope<T> = {
  trace_id: string
  data: T
}

export type ApiErrorBody = {
  trace_id?: string
  error?: {
    code?: string
    message?: string
    details?: Record<string, unknown>
  }
}

export type Conversation = {
  conversation_id: string
  created_at: string
}

export type Authorization = {
  method: 'none' | 'confirmation' | 'mfa'
  status: 'pending' | 'succeeded' | 'failed' | 'expired'
  attempts?: number
  expires_at?: string
}

export type ToolReceipt = {
  tool_name?: string
  status: 'succeeded' | 'rejected' | 'failed' | 'processing' | 'unknown'
  reference?: string
  result?: Record<string, unknown>
  occurred_at?: string
}

export type Action = {
  action_id: string
  conversation_id?: string
  kind: string
  risk_level: 'green' | 'yellow' | 'red'
  status:
    | 'awaiting_confirmation'
    | 'awaiting_mfa'
    | 'executing'
    | 'processing'
    | 'reconciliation_required'
    | 'succeeded'
    | 'failed'
    | 'cancelled'
    | 'expired'
  snapshot_hash?: string
  snapshot?: Record<string, unknown>
  authorization?: Authorization
  result?: Record<string, unknown>
  expires_at: string
  created_at?: string
  updated_at?: string
}

export type MessageResult = {
  run_id: string
  reply_type: 'question' | 'query_result' | 'action_required' | 'workflow_created' | 'rejected'
  text?: string
  action?: Action
  balance?: Record<string, unknown>
  transactions?: Array<Record<string, unknown>>
  bill?: Record<string, unknown>
}

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? '/backend'
const demoToken = process.env.NEXT_PUBLIC_DEMO_TOKEN ?? 'demo-user-1'

function idempotencyKey() {
  return crypto.randomUUID()
}

async function request<T>(path: string, init: RequestInit = {}): Promise<Envelope<T>> {
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${demoToken}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  const body = (await response.json()) as Envelope<T> & ApiErrorBody
  if (!response.ok) {
    throw new Error(body.error?.message ?? `服务端请求失败（${response.status}）`)
  }
  return body
}

export function createConversation() {
  return request<Conversation>('/v1/conversations', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey() },
    body: '{}',
  })
}

export function sendMessage(conversationId: string, text: string) {
  return request<MessageResult>(`/v1/conversations/${encodeURIComponent(conversationId)}/messages`, {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey() },
    body: JSON.stringify({ text }),
  })
}

export function getAction(actionId: string) {
  return request<Action>(`/v1/actions/${encodeURIComponent(actionId)}`)
}

export function confirmAction(actionId: string) {
  return request<Action>(`/v1/actions/${encodeURIComponent(actionId)}/confirm`, {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey() },
    body: '{}',
  })
}

export function cancelAction(actionId: string) {
  return request<Action>(`/v1/actions/${encodeURIComponent(actionId)}/cancel`, {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey() },
    body: '{}',
  })
}

export function verifyMfa(actionId: string, code: string) {
  return request<Action>(`/v1/actions/${encodeURIComponent(actionId)}/mfa/verify`, {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey() },
    body: JSON.stringify({ code }),
  })
}
