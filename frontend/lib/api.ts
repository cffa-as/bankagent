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
    | 'scheduled'
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

export type LiquidityTimelinePoint = {
  date: string
  available_minor: number
}

export type LiquidityScenario = {
  name: 'essential_only' | 'expected' | 'conservative'
  daily_discretionary_minor: number
  ending_available_minor: number
  minimum_available_minor: number
  minimum_date: string
  status: 'safe' | 'tight' | 'unsafe'
  points: LiquidityTimelinePoint[]
}

export type LiquidityReservation = {
  date: string
  amount_minor: number
}

export type LiquidityAlternative = {
  alternative_id: 'current' | 'buffer_preserving' | 'after_income' | 'split'
  label: string
  description: string
  total_budget_minor: number
  reservations: LiquidityReservation[]
  status: 'safe' | 'tight' | 'unsafe'
  expected_minimum_available_minor: number
  expected_minimum_date: string
  conservative_minimum_available_minor: number
  conservative_minimum_date: string
  expected_points: LiquidityTimelinePoint[]
  recommended: boolean
  tradeoff: string
}

export type LiquiditySimulation = {
  simulation_id: string
  account_id: string
  trace_id: string
  currency: string
  start_at: string
  horizon_days: number
  starting_available_minor: number
  proposed_budget_minor: number
  essential_buffer_minor: number
  historical_average_daily_minor: number
  historical_conservative_daily_minor: number
  maximum_safe_budget_minor: number
  verdict: 'safe' | 'tight' | 'unsafe'
  risk_reason: string
  recommendation: string
  assumptions: string[]
  events: Array<{
    date: string
    kind: string
    direction: 'in' | 'out'
    description: string
    amount_minor: number
    essential: boolean
    source_id?: string
  }>
  scenarios: LiquidityScenario[]
  alternatives: LiquidityAlternative[]
  recommended_alternative_id: string
  created_at: string
}

export type WorkflowNodeInput = {
  node_id: string
  kind: 'budget_lock' | 'reminder' | 'external_order'
  depends_on?: string[]
  amount_minor?: number
  merchant?: string
  due_at?: string
}

export type Workflow = {
  workflow_id: string
  purpose: string
  deadline: string
  status: 'pending' | 'running' | 'partially_completed' | 'completed' | 'failed' | 'cancelled'
  nodes: Array<{
    node_id: string
    kind: 'budget_lock' | 'reminder' | 'external_order'
    status: string
    amount_minor?: number
    due_at?: string
  }>
  created_at: string
  updated_at: string
}

export type MessageResult = {
  run_id: string
  reply_type: 'question' | 'query_result' | 'action_required' | 'workflow_created' | 'rejected'
  text?: string
  action?: Action
  balance?: Record<string, unknown>
  transactions?: Array<Record<string, unknown>>
  bill?: Record<string, unknown>
  liquidity?: LiquiditySimulation
  workflow?: Workflow
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

export function createWorkflow(purpose: string, deadline: string, nodes: WorkflowNodeInput[]) {
  return request<Workflow>('/v1/workflows', {
    method: 'POST',
    headers: { 'Idempotency-Key': idempotencyKey() },
    body: JSON.stringify({ purpose, deadline, nodes }),
  })
}
