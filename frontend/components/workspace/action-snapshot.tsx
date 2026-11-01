'use client'

import { describeKind, formatDateTime, formatField, formatMoney, labelField } from '@/lib/vaultline/format'
import { asText, pickMoney } from '@/lib/vaultline/normalize'
import { describeStatus } from '@/lib/vaultline/status'
import type { BankAction } from '@/lib/vaultline/types'
import { CopyId, Disclosure, FieldList, RiskBadge, StatusPill } from './primitives'

const HIDDEN_SNAPSHOT_KEYS = new Set(['currency', 'amount', 'amount_minor', 'amount_cents', 'kind'])

export function actionCurrency(action: BankAction) {
  return asText(action.snapshot.currency) ?? 'CNY'
}

export function actionAmount(action: BankAction) {
  return pickMoney(action.snapshot, 'amount')
}

export function actionTarget(action: BankAction) {
  const s = action.snapshot
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
  const rows = Object.entries(action.snapshot)
    .filter(([key, value]) => !HIDDEN_SNAPSHOT_KEYS.has(key) && value !== null && typeof value !== 'object')
    .map(([key, value]) => {
      const f = formatField(key, value, currency)
      return { label: labelField(key), value: f.text, mono: f.mono }
    })
  return (
    <div>
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
