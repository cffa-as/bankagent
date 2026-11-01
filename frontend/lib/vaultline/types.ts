/**
 * Client view of the Vaultline Go banking API. Every value here is server-authored:
 * the UI renders it, but never derives risk, authorization, MFA or execution outcomes.
 * Unknown enum values are kept verbatim (`string & {}`) so new server states are never remapped.
 */

type Open<T extends string> = T | (string & {})

export type RiskLevel = Open<'green' | 'yellow' | 'red'>

export type KnownActionStatus =
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

export type ActionStatus = Open<KnownActionStatus>

export type ReplyType = Open<'question' | 'query_result' | 'action_required' | 'workflow_created' | 'rejected'>

export type JsonObject = Record<string, unknown>

export interface ApiErrorBody {
  code: string | null
  message: string | null
  details: JsonObject | null
}

export interface Conversation {
  conversation_id: string
}

export type RunStatus = Open<
  'running' | 'completed' | 'failed' | 'interrupted' | 'human_handoff' | 'rolled_back' | 'rollback_review_required'
>

export interface Run {
  run_id: string
  conversation_id: string
  trace_id: string
  status: RunStatus
  reason: string | null
  handoff_to: string | null
  created_at: string | null
  updated_at: string | null
  finished_at: string | null
}

export interface RunRollbackResult {
  run: Run
  cancelled_action_ids: string[]
  review_action_ids: string[]
}

/** A server-authored audit milestone. Details stay server-side; this is not model chain-of-thought. */
export interface LiveActivityEvent {
  eventId: string
  traceId: string
  runId: string | null
  actionId: string | null
  eventType: string
  outcome: string
  occurredAt: string
}

export interface MfaState {
  failed_attempts: number | null
  attempts_remaining: number | null
  locked: boolean
  expires_at: string | null
}

export interface ActionSecuritySource {
  type: string | null
  trust: string | null
  sanitized: boolean
  injection_checked: boolean
}

export interface ActionSecurityIdentity {
  method: string | null
  state: string | null
  attempts_remaining: number | null
}

export interface ActionSecurityOutcome {
  receipt: string | null
}

export interface ActionSecurity {
  source: ActionSecuritySource
  identity: ActionSecurityIdentity
  outcome: ActionSecurityOutcome
}

export interface BankAction {
  action_id: string
  kind: string | null
  status: ActionStatus
  risk_level: RiskLevel | null
  expires_at: string | null
  created_at: string | null
  trace_id: string | null
  snapshot_hash: string | null
  /** Immutable, server-frozen parameters of the action (amount, beneficiary, product, …). */
  snapshot: JsonObject
  mfa: MfaState | null
  security: ActionSecurity | null
  /** Final business receipt. Success is only shown when this exists and status is `succeeded`. */
  receipt: JsonObject | null
  error: ApiErrorBody | null
}

export type QueryKind = Open<
  'balance' | 'transactions' | 'bill_summary' | 'products' | 'holdings' | 'cards' | 'subscriptions' | 'reminders'
>

export interface QueryResult {
  kind: QueryKind
  data: unknown
}

export type LiquidityVerdict = Open<'safe' | 'tight' | 'unsafe'>

export interface LiquidityPoint {
  date: string
  balance: number
}

export interface LiquidityScenario {
  key: string
  label: string | null
  points: LiquidityPoint[]
}

export interface LiquidityEvent {
  date: string
  label: string
  amount: number | null
  direction: string | null
}

export interface LiquidityAlternative {
  alternative_id: string
  label: string
  description: string | null
  conditional: boolean
  status: string | null
  tradeoff: string | null
  reservations: Array<{ date: string; amount: number }>
  reservation_dates: string[]
  recommended: boolean
}

export interface LiquiditySimulation {
  simulation_id: string | null
  start_at: string | null
  verdict: LiquidityVerdict | null
  currency: string
  starting_available: number | null
  proposed_budget: number | null
  essential_buffer: number | null
  max_safe_budget: number | null
  risk_reason: string | null
  horizon_days: number | null
  scenarios: LiquidityScenario[]
  events: LiquidityEvent[]
  alternatives: LiquidityAlternative[]
  trace_id: string | null
}

export type WorkflowNodeKind = Open<'budget_lock' | 'reminder' | 'external_order'>

export interface WorkflowNode {
  node_id: string
  kind: WorkflowNodeKind
  label: string | null
  status: string | null
  depends_on: string[]
  due_at: string | null
  action_id: string | null
  amount: number | null
  risk_level: RiskLevel | null
}

export interface Workflow {
  workflow_id: string
  title: string | null
  status: string | null
  created_at: string | null
  currency: string
  nodes: WorkflowNode[]
  trace_id: string | null
}

export interface MessageResult {
  run_id: string | null
  run_status: RunStatus | null
  reply_type: ReplyType | null
  reply_text: string | null
  action: BankAction | null
  query: QueryResult | null
  liquidity: LiquiditySimulation | null
  workflow: Workflow | null
  rejection: ApiErrorBody | null
  trace_id: string | null
  /** The server `data` object, kept for the collapsed “查看服务端数据” disclosure. */
  raw: unknown
}

export interface WorkflowAdvanceResult {
  workflow: Workflow | null
  liquidity: LiquiditySimulation | null
  action: BankAction | null
  trace_id: string | null
}

export interface AuditEvent {
  sequence: number | null
  run_id: string | null
  event_type: string
  actor: string | null
  outcome: string | null
  occurred_at: string | null
  policy_version: string | null
  action_id: string | null
  summary: string | null
}

export interface AuditTrace {
  trace_id: string
  events: AuditEvent[]
}
