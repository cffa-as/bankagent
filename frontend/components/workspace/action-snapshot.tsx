'use client'

import { describeKind, formatDateTime, formatField, formatMoney, labelField } from '@/lib/vaultline/format'
import { asText, pickMoney } from '@/lib/vaultline/normalize'
import { describeStatus } from '@/lib/vaultline/status'
import type { BankAction } from '@/lib/vaultline/types'
import { CopyId, Disclosure, FieldList, RiskBadge, StatusPill } from './primitives'

const HIDDEN_SNAPSHOT_KEYS = new Set(['currency', 'amount', 'amount_minor', 'amount_cents', 'kind', 'total_amount_minor'])

type SplitParticipant = { name: string; amount: number | null; isPayer: boolean }

export function actionCurrency(action: BankAction) {
  return asText(action.snapshot.currency) ?? 'CNY'
}

export function actionAmount(action: BankAction) {
  const s = action.snapshot
  return pickMoney(s, 'amount') ?? pickMoney(s, 'total_amount') ?? pickMoney(s, 'principal')
}

function splitParticipants(action: BankAction): SplitParticipant[] {
  const raw = action.snapshot.participants
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return []
    const entry = item as Record<string, unknown>
    const name = asText(entry.name) ?? asText(entry.phone)
    if (!name) return []
    return [{ name, amount: pickMoney(entry as BankAction['snapshot'], 'amount'), isPayer: entry.is_payer === true }]
  })
}

export function actionTarget(action: BankAction) {
  const s = action.snapshot
  const participants = splitParticipants(action)
  if (participants.length > 0) return `${participants.length} 人均摊`
  return (
    asText(s.beneficiary_name) ??
    asText(s.beneficiary) ??
    asText(s.payee_name) ??
    asText(s.payee) ??
    asText(s.product_name) ??
    asText(s.merchant) ??
    asText(s.subscription) ??
    asText(s.card_last4) ??
    asText(s.masked_number) ??
    null
  )
}

/** The single explicit verb on the cobalt button. Never “提交” or “继续”. */
export function confirmLabel(action: BankAction) {
  const amount = actionAmount(action)
  const money = amount !== null ? ` ${formatMoney(amount, actionCurrency(action))}` : ''
  switch (action.kind) {
    case 'transfer':
      return `确认转账${money}`
    case 'transfer_split':
      return `确认发起 AA 收款${money}`
    case 'payment':
    case 'bill_payment':
      return `确认付款${money}`
    case 'investment_purchase':
    case 'invest':
      return `确认申购${money}`
    case 'investment_redemption':
    case 'investment_redeem':
      return `确认赎回${money}`
    case 'subscription_cancel':
    case 'cancel_subscription':
      return '确认取消订阅'
    case 'card_freeze':
      return '确认冻结卡片'
    case 'card_unfreeze':
      return '确认解冻卡片'
    case 'card_limit_change':
      return '确认调整额度'
    case 'card_application':
      return '确认申请虚拟卡'
    case 'card_status_change':
      return '确认卡片状态变更'
    case 'budget_lock':
    case 'workflow_budget_lock':
      return `确认锁定预算${money}`
    case 'external_order':
    case 'workflow_external_order':
      return `确认下单${money}`
    default:
      return `确认${describeKind(action.kind)}${money}`
  }
}

export function ActionHeading({ action }: { action: BankAction }) {
  const status = describeStatus(action.status)
  const amount = actionAmount(action)
  const target = actionTarget(action)
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <p className="text-[13px] text-muted-foreground">
        {describeKind(action.kind)}
        {target && <span className="text-foreground"> · {target}</span>}
      </p>
      {amount !== null && (
        <p className="font-mono text-[32px] font-medium leading-none tracking-tight">{formatMoney(amount, actionCurrency(action))}</p>
      )}
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <StatusPill tone={status.tone} label={status.label} />
        <RiskBadge level={action.risk_level} />
      </div>
    </div>
  )
}

export function SnapshotFields({ action }: { action: BankAction }) {
  const currency = actionCurrency(action)
  const participants = splitParticipants(action)
  const rows = Object.entries(action.snapshot)
    .filter(([key, value]) => !HIDDEN_SNAPSHOT_KEYS.has(key) && value !== null && value !== '' && typeof value !== 'object')
    .map(([key, value]) => {
      const f = formatField(key, value, currency)
      return { label: labelField(key), value: f.text, mono: f.mono }
    })
  return (
    <div className="flex flex-col gap-3">
      {participants.length > 0 && (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card" aria-label="AA 分摊明细">
          {participants.map((participant) => (
            <li key={participant.name} className="flex items-center justify-between gap-3 px-3 py-2.5 text-[13.5px]">
              <span className="flex items-center gap-2">
                {participant.name}
                {participant.isPayer && (
                  <span className="rounded bg-ice px-1.5 py-px text-[11px] font-medium text-cobalt-ink">收款人</span>
                )}
              </span>
              <span className="flex items-center gap-2">
                <span className="text-[12px] text-muted-foreground">{participant.isPayer ? '自付' : '应付'}</span>
                <span className="font-mono">{formatMoney(participant.amount, currency)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {rows.length > 0 ? (
        <FieldList rows={rows} />
      ) : (
        <p className="py-2 text-[13px] text-muted-foreground">暂无更多信息。</p>
      )}
    </div>
  )
}

export function ActionEvidence({ action }: { action: BankAction }) {
  return (
    <Disclosure summary="业务凭证">
      <div className="flex flex-col gap-1.5 rounded-lg bg-background p-3">
        <CopyId label="业务编号" value={action.action_id} className="text-[12.5px]" />
        <CopyId label="流水号" value={action.trace_id} className="text-[12.5px]" />
        <p className="flex items-center gap-2 text-[12.5px]">
          <span className="text-muted-foreground">有效期至</span>
          <span className="font-mono">{formatDateTime(action.expires_at)}</span>
        </p>
        {action.snapshot_hash && (
          <p className="flex flex-col gap-0.5 text-[12.5px]">
            <span className="text-muted-foreground">信息校验码</span>
            <code className="font-mono text-[11.5px] leading-relaxed [overflow-wrap:anywhere]">{action.snapshot_hash}</code>
          </p>
        )}
      </div>
    </Disclosure>
  )
}
