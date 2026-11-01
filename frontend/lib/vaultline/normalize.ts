import type {
  ApiErrorBody,
  AuditEvent,
  AuditTrace,
  BankAction,
  JsonObject,
  LiquidityAlternative,
  LiquidityEvent,
  LiquidityScenario,
  LiquiditySimulation,
  MessageResult,
  MfaState,
  QueryKind,
  QueryResult,
  Run,
  RunRollbackResult,
  Workflow,
  WorkflowAdvanceResult,
  WorkflowNode,
} from './types'

/**
 * The single place that maps wire JSON onto typed client models.
 * Normalizers only rename and coerce; they never invent values. Missing fields stay null.
 */

export function asObject(value: unknown): JsonObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : null
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

export function asText(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) return value
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return null
}

export function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value)
  return null
}

function asBool(value: unknown): boolean {
  return value === true || value === 'true'
}

function pick(source: JsonObject | null, ...keys: string[]): unknown {
  if (!source) return undefined
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) return source[key]
  }
  return undefined
}

/** Money fields arrive either as major units (`amount`) or minor units (`amount_minor`, `*_cents`). */
export function pickMoney(source: JsonObject | null, base: string): number | null {
  if (!source) return null
  const major = asNumber(source[base])
  if (major !== null) return major
  for (const suffix of ['_minor', '_cents', '_fen']) {
    const minor = asNumber(source[`${base}${suffix}`])
    if (minor !== null) return minor / 100
  }
  return null
}

export function normalizeErrorBody(value: unknown): ApiErrorBody | null {
  const root = asObject(value)
  if (!root) return null
  const nested = asObject(root.error) ?? root
  const code = asText(nested.code)
  const message = asText(nested.message) ?? asText(root.error)
  if (!code && !message) return null
  return { code, message, details: asObject(nested.details) }
}

function normalizeMfa(value: unknown, action: JsonObject): MfaState | null {
  const source = asObject(value) ?? asObject(action.mfa_state)
  if (!source) return null
  return {
    failed_attempts: asNumber(pick(source, 'failed_attempts', 'failures', 'error_count')),
    attempts_remaining: asNumber(pick(source, 'attempts_remaining', 'remaining_attempts')),
    locked: asBool(source.locked) || asText(source.status) === 'locked',
    expires_at: asText(pick(source, 'expires_at', 'challenge_expires_at')),
  }
}

function normalizeSecurity(value: unknown): BankAction['security'] {
  const source = asObject(value)
  if (!source) return null
  const input = asObject(source.source)
  const identity = asObject(source.identity)
  const outcome = asObject(source.outcome)
  if (!input || !identity || !outcome) return null
  return {
    source: {
      type: asText(input.type),
      trust: asText(input.trust),
      sanitized: asBool(input.sanitized),
      injection_checked: asBool(input.injection_checked),
    },
    identity: {
      method: asText(identity.method),
      state: asText(identity.state),
      attempts_remaining: asNumber(identity.attempts_remaining),
    },
    outcome: {
      receipt: asText(outcome.receipt),
    },
  }
}

const ACTION_META_KEYS = new Set([
  'action_id',
  'id',
  'kind',
  'action_kind',
  'type',
  'status',
  'risk_level',
  'risk',
  'expires_at',
  'created_at',
  'updated_at',
  'trace_id',
  'snapshot',
  'snapshot_hash',
  'integrity_hash',
  'hash',
  'mfa',
  'mfa_state',
  'security',
  'receipt',
  'business_receipt',
  'tool_receipt',
  'error',
  'authorization',
  'idempotency_key',
])

export function normalizeAction(value: unknown, fallbackTraceId: string | null = null): BankAction | null {
  const root = asObject(value)
  const source = asObject(root?.action) ?? root
  if (!source) return null
  const actionId = asText(pick(source, 'action_id', 'id'))
  if (!actionId) return null

  const explicitSnapshot = asObject(source.snapshot)
  const snapshot: JsonObject = explicitSnapshot
    ? { ...explicitSnapshot }
    : Object.fromEntries(Object.entries(source).filter(([key]) => !ACTION_META_KEYS.has(key)))

  return {
    action_id: actionId,
    kind: asText(pick(source, 'kind', 'action_kind', 'type')) ?? asText(snapshot.kind),
    status: asText(source.status) ?? 'unknown',
    risk_level: asText(pick(source, 'risk_level', 'risk'))?.toLowerCase() ?? null,
    expires_at: asText(source.expires_at),
    created_at: asText(source.created_at),
    trace_id: asText(source.trace_id) ?? fallbackTraceId,
    snapshot_hash: asText(pick(source, 'snapshot_hash', 'integrity_hash', 'hash')),
    snapshot,
    mfa: normalizeMfa(source.mfa, source),
    security: normalizeSecurity(source.security),
    receipt: asObject(pick(source, 'receipt', 'business_receipt', 'result')),
    error: normalizeErrorBody(source.error),
  }
}

const QUERY_KEY_HINTS: [QueryKind, string[]][] = [
  ['balance', ['balance', 'account']],
  ['transactions', ['transactions']],
  ['bill_summary', ['bill_summary', 'bill', 'bills', 'spending']],
  ['products', ['products']],
  ['holdings', ['holdings']],
  ['cards', ['cards']],
  ['subscriptions', ['subscriptions']],
  ['reminders', ['reminders']],
]

export function normalizeQuery(value: unknown): QueryResult | null {
  const source = asObject(value)
  if (!source) return null
  const kind = asText(pick(source, 'kind', 'query_kind', 'query_type', 'type', 'tool'))
  if (kind) return { kind: kind.toLowerCase(), data: pick(source, 'data', 'result', 'items') ?? source }
  for (const [hint, keys] of QUERY_KEY_HINTS) {
    for (const key of keys) {
      if (source[key] !== undefined) return { kind: hint, data: source[key] }
    }
  }
  if (source.available !== undefined || source.available_minor !== undefined) return { kind: 'balance', data: source }
  return { kind: 'unknown', data: source }
}

function normalizeScenario(value: unknown, fallbackKey: string): LiquidityScenario | null {
  const source = asObject(value)
  const points = asArray(source ? pick(source, 'points', 'series', 'balances') : value)
    .map((raw) => {
      const point = asObject(raw)
      const date = asText(pick(point, 'date', 'day', 'at'))
      const balance = pickMoney(point, 'balance') ?? pickMoney(point, 'available')
      return date && balance !== null ? { date, balance } : null
    })
    .filter((point): point is NonNullable<typeof point> => point !== null)
  if (points.length === 0) return null
  return {
    key: asText(pick(source, 'key', 'scenario', 'name')) ?? fallbackKey,
    label: asText(source?.label),
    points,
  }
}

export function normalizeLiquidity(value: unknown, fallbackTraceId: string | null = null): LiquiditySimulation | null {
  const source = asObject(value)
  if (!source) return null

  const rawScenarios = source.scenarios
  const scenarios = (
    Array.isArray(rawScenarios)
      ? rawScenarios.map((s, i) => normalizeScenario(s, `scenario_${i}`))
      : Object.entries(asObject(rawScenarios) ?? {}).map(([key, s]) => {
          const scenario = normalizeScenario(s, key)
          return scenario ? { ...scenario, key } : null
        })
  ).filter((s): s is LiquidityScenario => s !== null)

  const events: LiquidityEvent[] = asArray(pick(source, 'events', 'cashflow_events', 'key_events'))
    .map((raw) => {
      const event = asObject(raw)
      const date = asText(pick(event, 'date', 'at', 'due_at'))
      const label = asText(pick(event, 'label', 'description', 'name'))
      if (!date || !label) return null
      return { date, label, amount: pickMoney(event, 'amount'), direction: asText(event?.direction) }
    })
    .filter((e): e is LiquidityEvent => e !== null)

  const recommendedId = asText(pick(source, 'recommended_alternative_id', 'recommended_id'))
  const alternatives: LiquidityAlternative[] = asArray(source.alternatives)
    .map((raw, i) => {
      const alt = asObject(raw)
      const label = asText(pick(alt, 'label', 'title', 'name'))
      if (!alt || !label) return null
      const id = asText(pick(alt, 'alternative_id', 'id', 'key')) ?? `alt_${i}`
      const reservations = asArray(alt.reservations)
        .map((rawReservation) => {
          const reservation = asObject(rawReservation)
          const date = asText(pick(reservation, 'date', 'reserve_date'))
          const amount = pickMoney(reservation, 'amount')
          return date && amount !== null && amount > 0 ? { date, amount } : null
        })
        .filter((reservation): reservation is { date: string; amount: number } => reservation !== null)
      return {
        alternative_id: id,
        label,
        description: asText(pick(alt, 'description', 'summary')),
        conditional: asBool(pick(alt, 'conditional', 'is_conditional')),
        status: asText(alt.status),
        tradeoff: asText(pick(alt, 'tradeoff', 'trade_off')),
        reservations,
        reservation_dates: reservations.length > 0
          ? reservations.map((reservation) => reservation.date)
          : asArray(pick(alt, 'reservation_dates', 'reserve_dates'))
          .map(asText)
          .filter((d): d is string => d !== null),
        recommended: asBool(alt.recommended) || id === recommendedId,
      }
    })
    .filter((a): a is LiquidityAlternative => a !== null)

  return {
    simulation_id: asText(pick(source, 'simulation_id', 'id')),
    start_at: asText(source.start_at),
    verdict: asText(source.verdict)?.toLowerCase() ?? null,
    currency: asText(source.currency) ?? 'CNY',
    starting_available: pickMoney(source, 'starting_available') ?? pickMoney(source, 'available_balance'),
    proposed_budget: pickMoney(source, 'proposed_budget') ?? pickMoney(source, 'budget'),
    essential_buffer: pickMoney(source, 'essential_buffer'),
    max_safe_budget: pickMoney(source, 'max_safe_budget') ?? pickMoney(source, 'maximum_safe_budget'),
    risk_reason: asText(pick(source, 'risk_reason', 'reason')),
    horizon_days: asNumber(pick(source, 'horizon_days', 'days')),
    scenarios,
    events,
    alternatives,
    trace_id: asText(source.trace_id) ?? fallbackTraceId,
  }
}

function normalizeNode(value: unknown, index: number): WorkflowNode | null {
  const node = asObject(value)
  if (!node) return null
  return {
    node_id: asText(pick(node, 'node_id', 'id', 'key')) ?? `node_${index}`,
    kind: asText(pick(node, 'kind', 'type')) ?? 'unknown',
    label: asText(pick(node, 'label', 'title', 'name', 'merchant')),
    status: asText(node.status),
    depends_on: asArray(pick(node, 'depends_on', 'dependencies'))
      .map(asText)
      .filter((d): d is string => d !== null),
    due_at: asText(pick(node, 'due_at', 'scheduled_at', 'run_at')),
    action_id: asText(pick(node, 'action_id', 'linked_action_id')),
    amount: pickMoney(node, 'amount'),
    risk_level: asText(pick(node, 'risk_level', 'risk'))?.toLowerCase() ?? null,
  }
}

export function normalizeWorkflow(value: unknown, fallbackTraceId: string | null = null): Workflow | null {
  const root = asObject(value)
  const source = asObject(root?.workflow) ?? root
  const id = asText(pick(source, 'workflow_id', 'id'))
  if (!source || !id) return null
  return {
    workflow_id: id,
    title: asText(pick(source, 'title', 'name', 'label', 'purpose')),
    status: asText(source.status),
    created_at: asText(source.created_at),
    currency: asText(source.currency) ?? 'CNY',
    nodes: asArray(pick(source, 'nodes', 'steps'))
      .map(normalizeNode)
      .filter((n): n is WorkflowNode => n !== null),
    trace_id: asText(source.trace_id) ?? fallbackTraceId,
  }
}

export function normalizeWorkflowList(value: unknown): Workflow[] {
  const source = asObject(value)
  const list = Array.isArray(value) ? value : asArray(pick(source, 'workflows', 'items'))
  return list.map((w) => normalizeWorkflow(w)).filter((w): w is Workflow => w !== null)
}

export function normalizeAdvance(value: unknown, traceId: string | null): WorkflowAdvanceResult {
  const source = asObject(value)
  return {
    workflow: normalizeWorkflow(source?.workflow ?? source, traceId),
    liquidity: normalizeLiquidity(pick(source, 'liquidity', 'simulation', 'liquidity_simulation'), traceId),
    action: normalizeAction(source?.action, traceId),
    trace_id: traceId,
  }
}

export function normalizeMessage(value: unknown, traceId: string | null): MessageResult {
  const source = asObject(value) ?? {}
  const replyType = asText(source.reply_type)
  const rejection =
    normalizeErrorBody(pick(source, 'rejection', 'error')) ??
    (replyType === 'rejected' ? { code: asText(source.reason_code), message: asText(source.reason), details: null } : null)

  const query = normalizeMessageQuery(source)

  return {
    run_id: asText(source.run_id),
    run_status: asText(source.run_status),
    reply_type: replyType,
    reply_text: asText(pick(source, 'reply_text', 'text', 'message')),
    action: normalizeAction(source.action, traceId),
    query,
    liquidity: normalizeLiquidity(pick(source, 'liquidity', 'liquidity_simulation'), traceId),
    workflow: normalizeWorkflow(source.workflow, traceId),
    rejection,
    trace_id: asText(source.trace_id) ?? traceId,
    raw: value,
  }
}

function normalizeMessageQuery(source: JsonObject): QueryResult | null {
  const nested = normalizeQuery(pick(source, 'query', 'query_result', 'result'))
  if (nested) return nested
  if (source.balance !== undefined) return { kind: 'balance', data: source.balance }
  if (source.bill !== undefined) return { kind: 'bill_summary', data: source.bill }
  if (source.transactions !== undefined) return { kind: 'transactions', data: source.transactions }
  if (source.data !== undefined) return inferQueryKind(source.data)
  return null
}

function inferQueryKind(data: unknown): QueryResult {
  const object = asObject(data)
  if (object && (object.subscriptions !== undefined || object.reminders !== undefined)) {
    return { kind: 'subscriptions', data }
  }
  const rows = Array.isArray(data) ? data.map(asObject).filter((row): row is JsonObject => row !== null) : []
  if (rows.length > 0) {
    if (rows.some((row) => asText(row.product_id))) return { kind: 'products', data }
    if (rows.some((row) => asText(row.holding_id))) return { kind: 'holdings', data }
    if (rows.some((row) => asText(row.card_id))) return { kind: 'cards', data }
    if (rows.some((row) => asText(row.subscription_id) || asText(row.merchant_ref))) return { kind: 'subscriptions', data }
  }
  return { kind: 'unknown', data }
}

export function normalizeAudit(value: unknown, traceId: string): AuditTrace {
  const source = asObject(value)
  const list = Array.isArray(value) ? value : asArray(pick(source, 'events', 'items'))
  const events: AuditEvent[] = list
    .map((raw): AuditEvent | null => {
      const event = asObject(raw)
      const type = asText(pick(event, 'event_type', 'type', 'event'))
      if (!event || !type) return null
      return {
        sequence: asNumber(pick(event, 'sequence', 'seq')),
        run_id: asText(event.run_id),
        event_type: type,
        actor: asText(event.actor),
        outcome: asText(pick(event, 'outcome', 'result', 'decision')),
        occurred_at: asText(pick(event, 'occurred_at', 'created_at', 'at', 'timestamp')),
        policy_version: asText(event.policy_version),
        action_id: asText(event.action_id),
        summary: asText(pick(event, 'summary', 'message', 'description')),
      }
    })
    .filter((e): e is AuditEvent => e !== null)
    .sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))
  return { trace_id: asText(source?.trace_id) ?? traceId, events }
}

export function normalizeRun(value: unknown, traceId: string | null): Run | null {
  const source = asObject(value)
  const id = asText(source?.run_id)
  if (!source || !id) return null
  return {
    run_id: id,
    conversation_id: asText(source.conversation_id) ?? '',
    trace_id: asText(source.trace_id) ?? traceId ?? '',
    status: asText(source.status) ?? 'unknown',
    reason: asText(source.reason),
    handoff_to: asText(source.handoff_to),
    created_at: asText(source.created_at),
    updated_at: asText(source.updated_at),
    finished_at: asText(source.finished_at),
  }
}

export function normalizeRunRollback(value: unknown, traceId: string | null): RunRollbackResult | null {
  const source = asObject(value)
  const run = normalizeRun(source?.run, traceId)
  if (!source || !run) return null
  return {
    run,
    cancelled_action_ids: asArray(source.cancelled_action_ids).map(asText).filter((id): id is string => Boolean(id)),
    review_action_ids: asArray(source.review_action_ids).map(asText).filter((id): id is string => Boolean(id)),
  }
}
