import type { KnownActionStatus } from './types'

/**
 * read   – teal: read-only / verified
 * confirm – amber: needs explicit confirmation
 * mfa    – red: needs MFA / high risk / failed
 * live   – cobalt: server is moving it forward
 * held   – amber: waiting for reconciliation, outcome unknown
 * done   – teal: server receipt exists
 * void   – neutral: cancelled / expired
 */
export type Tone = 'neutral' | 'read' | 'confirm' | 'mfa' | 'live' | 'held' | 'done' | 'fail' | 'void'

export interface StatusMeta {
  label: string
  tone: Tone
  /** The server may still move it forward; keep polling GET /v1/actions/{id}. */
  polling: boolean
  terminal: boolean
}

export const ACTION_STATUS: Record<KnownActionStatus, StatusMeta> = {
  awaiting_confirmation: { label: '待确认', tone: 'confirm', polling: false, terminal: false },
  awaiting_mfa: { label: '待安全验证', tone: 'mfa', polling: false, terminal: false },
  scheduled: { label: '已预约', tone: 'live', polling: false, terminal: false },
  executing: { label: '执行中', tone: 'live', polling: true, terminal: false },
  processing: { label: '银行处理中', tone: 'live', polling: true, terminal: false },
  reconciliation_required: { label: '等待对账', tone: 'held', polling: true, terminal: false },
  succeeded: { label: '服务端已返回回执', tone: 'done', polling: false, terminal: true },
  failed: { label: '未完成', tone: 'fail', polling: false, terminal: true },
  cancelled: { label: '已取消', tone: 'void', polling: false, terminal: true },
  expired: { label: '已过期', tone: 'void', polling: false, terminal: true },
}

export function describeStatus(status: string | null | undefined): StatusMeta {
  if (status && status in ACTION_STATUS) return ACTION_STATUS[status as KnownActionStatus]
  return { label: status ? `未识别状态 · ${status}` : '未返回', tone: 'neutral', polling: false, terminal: false }
}

export interface RiskMeta {
  label: string
  short: string
  tone: Tone
}

export function describeRisk(level: string | null | undefined): RiskMeta {
  switch (level?.toLowerCase()) {
    case 'green':
      return { label: '查询，可直接查看', short: '只读', tone: 'read' }
    case 'yellow':
      return { label: '需确认', short: '需确认', tone: 'confirm' }
    case 'red':
      return { label: '需 MFA', short: '需 MFA', tone: 'mfa' }
    default:
      return { label: level ? `未识别风险 · ${level}` : '风险未返回', short: level ?? '未返回', tone: 'neutral' }
  }
}

/** Text + surface classes per tone. Status is never conveyed by color alone; callers always render the label. */
export const TONE: Record<Tone, { text: string; dot: string; soft: string; line: string }> = {
  neutral: { text: 'text-muted-foreground', dot: 'bg-steel', soft: 'bg-muted text-muted-foreground', line: 'border-border' },
  read: { text: 'text-teal-ink', dot: 'bg-teal', soft: 'bg-teal-soft text-teal-ink', line: 'border-teal/40' },
  confirm: { text: 'text-amber-ink', dot: 'bg-amber', soft: 'bg-amber-soft text-amber-ink', line: 'border-amber/50' },
  mfa: { text: 'text-red-ink', dot: 'bg-red', soft: 'bg-red-soft text-red-ink', line: 'border-red/40' },
  live: { text: 'text-cobalt-ink', dot: 'bg-cobalt', soft: 'bg-ice text-cobalt-ink', line: 'border-cobalt/40' },
  held: { text: 'text-amber-ink', dot: 'bg-amber', soft: 'bg-amber-soft text-amber-ink', line: 'border-amber/50' },
  done: { text: 'text-teal-ink', dot: 'bg-teal', soft: 'bg-teal-soft text-teal-ink', line: 'border-teal/40' },
  fail: { text: 'text-red-ink', dot: 'bg-red', soft: 'bg-red-soft text-red-ink', line: 'border-red/40' },
  void: { text: 'text-muted-foreground', dot: 'bg-steel', soft: 'bg-muted text-muted-foreground', line: 'border-border' },
}

export const WORKFLOW_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: '等待中', tone: 'neutral' },
  waiting: { label: '等待依赖', tone: 'neutral' },
  ready: { label: '可推进', tone: 'live' },
  awaiting_authorization: { label: '待授权', tone: 'confirm' },
  awaiting_confirmation: { label: '待确认', tone: 'confirm' },
  awaiting_mfa: { label: '待安全验证', tone: 'mfa' },
  scheduled: { label: '已预约', tone: 'live' },
  running: { label: '执行中', tone: 'live' },
  in_progress: { label: '进行中', tone: 'live' },
  partially_completed: { label: '部分完成', tone: 'held' },
  completed: { label: '已完成', tone: 'done' },
  succeeded: { label: '已完成', tone: 'done' },
  skipped: { label: '已跳过', tone: 'void' },
  failed: { label: '未完成', tone: 'fail' },
  cancelled: { label: '已取消', tone: 'void' },
  created: { label: '已创建 · 未执行', tone: 'neutral' },
}

export function describeWorkflowStatus(status: string | null | undefined) {
  if (status && WORKFLOW_STATUS[status]) return WORKFLOW_STATUS[status]
  return { label: status ?? '未返回', tone: 'neutral' as Tone }
}

export const VERDICT: Record<string, { label: string; tone: Tone }> = {
  safe: { label: '安全', tone: 'read' },
  tight: { label: '偏紧', tone: 'confirm' },
  unsafe: { label: '不安全', tone: 'mfa' },
}
