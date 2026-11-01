import {
  asObject,
  asText,
  normalizeAction,
  normalizeAdvance,
  normalizeAudit,
  normalizeErrorBody,
  normalizeLiquidity,
  normalizeMessage,
  normalizeWorkflow,
  normalizeWorkflowList,
} from './normalize'
import type {
  AuditTrace,
  BankAction,
  Conversation,
  JsonObject,
  LiveActivityEvent,
  MessageResult,
  Workflow,
  WorkflowAdvanceResult,
} from './types'

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || '/backend').replace(/\/+$/, '')
const SYNTHETIC_BEARER = 'demo-user-1'
/** The Go server currently runs one synthetic user and account. Set NEXT_PUBLIC_VAULTLINE_ENV=production to drop synthetic hints. */
export const SYNTHETIC_ENVIRONMENT = process.env.NEXT_PUBLIC_VAULTLINE_ENV !== 'production'
const REQUEST_TIMEOUT_MS = 12000

export type ApiErrorKind = 'unavailable' | 'rejected' | 'invalid'

export class VaultlineApiError extends Error {
  constructor(
    public readonly kind: ApiErrorKind,
    message: string,
    public readonly status: number | null = null,
    public readonly code: string | null = null,
    public readonly details: JsonObject | null = null,
    public readonly traceId: string | null = null,
  ) {
    super(message)
    this.name = 'VaultlineApiError'
  }
}

export function toApiError(error: unknown): VaultlineApiError {
  if (error instanceof VaultlineApiError) return error
  return new VaultlineApiError('invalid', error instanceof Error ? error.message : '未知错误。')
}

/** 8–128 chars, per the server contract. One key per user intent; retries reuse it. */
export function newIdempotencyKey() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `idk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

interface Envelope {
  data: unknown
  traceId: string | null
}

async function call(method: 'GET' | 'POST', path: string, body?: unknown, idempotencyKey?: string): Promise<Envelope> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const headers: Record<string, string> = {
    Authorization: `Bearer ${SYNTHETIC_BEARER}`,
    Accept: 'application/json',
  }
  if (method === 'POST') {
    headers['Content-Type'] = 'application/json'
    headers['Idempotency-Key'] = idempotencyKey ?? newIdempotencyKey()
  }

  try {
    let response: Response
    try {
      response = await fetch(`${API_BASE_URL}${path}`, {
        method,
        headers,
        body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
        signal: controller.signal,
        cache: 'no-store',
      })
    } catch {
      throw new VaultlineApiError('unavailable', '无法连接银行服务端，请求未送达。')
    }

    const isJson = response.headers.get('content-type')?.includes('application/json') ?? false
    const payload = asObject(isJson ? await response.json().catch(() => null) : null)
    const traceId = asText(payload?.trace_id) ?? response.headers.get('x-trace-id')

    if (!response.ok) {
      if (!payload || response.status === 502 || response.status === 503 || response.status === 504) {
        throw new VaultlineApiError('unavailable', `银行服务端不可用（HTTP ${response.status}）。`, response.status, null, null, traceId)
      }
      const error = normalizeErrorBody(payload)
      throw new VaultlineApiError(
        'rejected',
        error?.message ?? `服务端拒绝了请求（HTTP ${response.status}）。`,
        response.status,
        error?.code ?? null,
        error?.details ?? null,
        traceId,
      )
    }

    if (!payload) throw new VaultlineApiError('invalid', '服务端响应不是有效的 JSON。', response.status)
    return { data: payload.data !== undefined ? payload.data : payload, traceId }
  } finally {
    clearTimeout(timeout)
  }
}

const seg = encodeURIComponent

function requireValue<T>(value: T | null, what: string): T {
  if (value === null) throw new VaultlineApiError('invalid', `服务端响应缺少${what}。`)
  return value
}

/* ---------- Conversations ---------- */

export async function createConversation(key?: string): Promise<Conversation> {
  const { data } = await call('POST', '/v1/conversations', {}, key)
  const source = asObject(data)
  return { conversation_id: requireValue(asText(source?.conversation_id ?? source?.id), ' conversation_id') }
}

export async function sendMessage(conversationId: string, content: string, key: string): Promise<MessageResult> {
  const { data, traceId } = await call('POST', `/v1/conversations/${seg(conversationId)}/messages`, { text: content }, key)
  return normalizeMessage(data, traceId)
}

/**
 * Consume the conversation audit stream with a bearer-authenticated fetch.
 * Native EventSource cannot set Authorization, so frames are parsed from ReadableStream.
 */
export async function streamConversationEvents(
  conversationId: string,
  signal: AbortSignal,
  onEvent: (event: LiveActivityEvent) => void,
  onReady?: () => void,
): Promise<void> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/v1/conversations/${seg(conversationId)}/events`, {
      headers: { Authorization: `Bearer ${SYNTHETIC_BEARER}`, Accept: 'text/event-stream' },
      signal,
      cache: 'no-store',
    })
  } catch {
    if (signal.aborted) return
    throw new VaultlineApiError('unavailable', '无法建立实时执行通道。')
  }

  if (!response.ok || !response.body) {
    if (signal.aborted) return
    const payload = asObject(!response.body ? null : await response.json().catch(() => null))
    const error = normalizeErrorBody(payload)
    const unavailable = !response.body || response.status === 502 || response.status === 503 || response.status === 504
    throw new VaultlineApiError(
      unavailable ? 'unavailable' : 'rejected',
      error?.message ?? '实时执行通道暂时不可用。',
      response.status,
      error?.code ?? null,
      null,
      asText(payload?.trace_id) ?? response.headers.get('x-trace-id'),
    )
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true }).replace(/\r/g, '')
      let boundary = buffer.indexOf('\n\n')
      while (boundary >= 0) {
        const frame = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        boundary = buffer.indexOf('\n\n')
        let eventName = 'message'
        const data: string[] = []
        for (const line of frame.split('\n')) {
          if (!line || line.startsWith(':')) continue
          const colon = line.indexOf(':')
          const field = colon < 0 ? line : line.slice(0, colon)
          const value = colon < 0 ? '' : line.slice(colon + 1).replace(/^ /, '')
          if (field === 'event') eventName = value
          if (field === 'data') data.push(value)
        }
        if (eventName === 'ready') {
          onReady?.()
          continue
        }
        if (eventName !== 'step' || data.length === 0) continue
        const source = asObject(JSON.parse(data.join('\n')))
        const eventId = asText(source?.event_id)
        const traceId = asText(source?.trace_id)
        const eventType = asText(source?.event_type)
        const occurredAt = asText(source?.occurred_at)
        if (!eventId || !traceId || !eventType || !occurredAt) continue
        onEvent({
          eventId,
          traceId,
          actionId: asText(source?.action_id),
          eventType,
          outcome: asText(source?.outcome) ?? 'unknown',
          occurredAt,
        })
      }
    }
  } catch (error) {
    if (signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) return
    throw new VaultlineApiError('unavailable', '实时执行轨迹连接中断。')
  } finally {
    reader.releaseLock()
  }
}

/* ---------- Actions ---------- */

async function actionCall(method: 'GET' | 'POST', path: string, body?: unknown, key?: string): Promise<BankAction> {
  const { data, traceId } = await call(method, path, body, key)
  return requireValue(normalizeAction(data, traceId), ' action_id')
}

export const getAction = (id: string) => actionCall('GET', `/v1/actions/${seg(id)}`)
export const confirmAction = (id: string, key: string) => actionCall('POST', `/v1/actions/${seg(id)}/confirm`, {}, key)
/** The code is sent once and never stored, logged or echoed into client state. */
export const verifyActionMfa = (id: string, code: string, key: string) =>
  actionCall('POST', `/v1/actions/${seg(id)}/mfa/verify`, { code }, key)
export const cancelAction = (id: string, key: string) => actionCall('POST', `/v1/actions/${seg(id)}/cancel`, {}, key)
export const triggerAction = (id: string, key: string) => actionCall('POST', `/v1/actions/${seg(id)}/trigger`, {}, key)

/* ---------- Workflows ---------- */

export async function listWorkflows(): Promise<Workflow[]> {
  const { data } = await call('GET', '/v1/workflows')
  return normalizeWorkflowList(data)
}

export async function getWorkflow(id: string): Promise<Workflow> {
  const { data, traceId } = await call('GET', `/v1/workflows/${seg(id)}`)
  return requireValue(normalizeWorkflow(data, traceId), ' workflow_id')
}

export async function createWorkflow(input: JsonObject, key: string): Promise<Workflow> {
  const { data, traceId } = await call('POST', '/v1/workflows', input, key)
  return requireValue(normalizeWorkflow(data, traceId), ' workflow_id')
}

export async function advanceWorkflow(id: string, key: string): Promise<WorkflowAdvanceResult> {
  const { data, traceId } = await call('POST', `/v1/workflows/${seg(id)}/advance`, {}, key)
  return normalizeAdvance(data, traceId)
}

export async function cancelWorkflow(id: string, key: string): Promise<Workflow> {
  const { data, traceId } = await call('POST', `/v1/workflows/${seg(id)}/cancel`, {}, key)
  return requireValue(normalizeWorkflow(data, traceId), ' workflow_id')
}

/* ---------- Audit ---------- */

export async function getAuditTrace(traceId: string): Promise<AuditTrace> {
  const { data } = await call('GET', `/v1/audit-traces/${seg(traceId)}`)
  return normalizeAudit(data, traceId)
}
