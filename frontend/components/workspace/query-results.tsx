'use client'

import { ArrowDownLeft, ArrowUpRight, ShieldAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { formatBps, formatDateTime, formatField, formatMoney, labelField } from '@/lib/vaultline/format'
import { asArray, asNumber, asObject, asText, pickMoney } from '@/lib/vaultline/normalize'
import type { JsonObject, QueryResult } from '@/lib/vaultline/types'
import { CopyId, FieldList, SectionLabel, StatusPill } from './primitives'

/** Every renderer reads server values only. Absent fields render “未返回”, never a guess. */

function listOf(data: unknown, ...keys: string[]): JsonObject[] {
  const direct = Array.isArray(data) ? data : null
  const source = asObject(data)
  const nested = direct ?? keys.map((k) => source?.[k]).find(Array.isArray) ?? []
  return asArray(nested)
    .map(asObject)
    .filter((x): x is JsonObject => x !== null)
}

function text(source: JsonObject | null, ...keys: string[]) {
  for (const key of keys) {
    const value = asText(source?.[key])
    if (value) return value
  }
  return null
}

function money(source: JsonObject | null, ...keys: string[]) {
  for (const key of keys) {
    const value = pickMoney(source, key)
    if (value !== null) return value
  }
  return null
}

const CATEGORY_LABELS: Record<string, string> = {
  food: '餐饮',
  transport: '交通',
  shopping: '购物',
  housing: '居住',
  entertainment: '娱乐',
  transfer: '转账',
  utilities: '生活缴费',
  subscription: '订阅',
  subscriptions: '订阅',
  income: '收入',
  salary: '工资',
  investment: '理财',
  digital: '数字服务',
  other: '其他',
}

const PRODUCT_RISK_LABELS: Record<string, string> = {
  conservative: '稳健型',
  balanced: '平衡型',
  aggressive: '进取型',
}

const CARD_STATUS_LABELS: Record<string, { label: string; tone: 'read' | 'confirm' | 'mfa' | 'neutral' }> = {
  active: { label: '正常', tone: 'read' },
  frozen: { label: '已冻结', tone: 'confirm' },
  lost: { label: '已挂失', tone: 'mfa' },
  closed: { label: '已关闭', tone: 'neutral' },
}

const RESTRICTION_LABELS: Record<string, string> = {
  online: '线上交易',
  contactless: '非接触支付',
}

function labelCategory(value: string | null) {
  return value ? CATEGORY_LABELS[value] ?? value : '未分类'
}

function Table({ caption, head, children }: { caption: string; head: string[]; children: ReactNode }) {
  return (
    <div className="ws-scroll -mx-1 overflow-x-auto px-1">
      <table className="w-full min-w-[480px] border-collapse text-left text-[13px]">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border text-[12px] text-muted-foreground">
            {head.map((h, i) => (
              <th key={h} scope="col" className={cn('py-2 pr-3 font-medium', i === head.length - 1 && 'pr-0 text-right')}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

function Balance({ data, traceId }: { data: unknown; traceId: string | null }) {
  const source = asObject(data)
  const currency = text(source, 'currency') ?? 'CNY'
  const available = money(source, 'available', 'available_balance')
  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-[12px] text-muted-foreground">可用余额</p>
        <p className="font-mono text-[28px] font-medium leading-tight tracking-tight text-foreground">
          {formatMoney(available, currency)}
        </p>
      </div>
      <FieldList
        rows={[
          { label: '账面余额', value: formatMoney(money(source, 'balance', 'ledger_balance', 'current_balance'), currency), mono: true },
          { label: '冻结 / 预留', value: formatMoney(money(source, 'reserved', 'reserved_amount', 'held'), currency), mono: true },
          { label: '币种', value: currency, mono: true },
        ]}
      />
      <div className="flex flex-col gap-1">
        <CopyId label="账户" value={text(source, 'account_id', 'account_number', 'masked_account')} />
      </div>
    </div>
  )
}

function Transactions({ data }: { data: unknown }) {
  const rows = listOf(data, 'transactions', 'items')
  if (rows.length === 0) return <p className="text-[13px] text-muted-foreground">暂无交易记录。</p>
  return (
    <Table caption="交易明细" head={['方向', '描述', '类别', '时间', '金额']}>
      {rows.map((row, i) => {
        const direction = text(row, 'direction', 'type')
        const inbound = direction === 'credit' || direction === 'in' || direction === 'inbound'
        const amount = money(row, 'amount')
        return (
          <tr key={text(row, 'transaction_id', 'id') ?? i} className="border-b border-border last:border-b-0">
            <td className="py-2 pr-3">
              <span className={cn('inline-flex items-center gap-1', inbound ? 'text-teal-ink' : 'text-foreground')}>
                {inbound ? <ArrowDownLeft className="size-3.5" aria-hidden /> : <ArrowUpRight className="size-3.5" aria-hidden />}
                {inbound ? '收入' : direction ? '支出' : '未返回'}
              </span>
            </td>
            <td className="max-w-48 truncate py-2 pr-3">{text(row, 'description', 'merchant', 'counterparty') ?? '未返回'}</td>
            <td className="py-2 pr-3 text-muted-foreground">{labelCategory(text(row, 'category'))}</td>
            <td className="py-2 pr-3 font-mono text-[12px] text-muted-foreground">
              {formatDateTime(text(row, 'occurred_at', 'posted_at', 'time', 'created_at'))}
            </td>
            <td className={cn('py-2 text-right font-mono', inbound && 'text-teal-ink')}>
              {formatMoney(amount, text(row, 'currency') ?? 'CNY')}
            </td>
          </tr>
        )
      })}
    </Table>
  )
}

function BillSummary({ data }: { data: unknown }) {
  const source = asObject(data)
  const currency = text(source, 'currency') ?? 'CNY'
  const rawCategories = source?.categories ?? source?.category_breakdown
  const categories = Array.isArray(rawCategories)
    ? listOf(rawCategories).map((c) => {
        const shareBps = asNumber(c.share_bps)
        return {
          name: labelCategory(text(c, 'category', 'name', 'label')),
          amount: money(c, 'amount', 'total'),
          share: shareBps !== null ? shareBps / 10_000 : asNumber(c.share ?? c.ratio ?? c.percent),
        }
      })
    : Object.entries(asObject(rawCategories) ?? {}).map(([name, v]) => ({
        name,
        amount: asNumber(v) ?? money(asObject(v), 'amount'),
        share: asNumber(asObject(v)?.share),
      }))
  const total = money(source, 'total_spending', 'total_spend', 'total')
  const anomalies = listOf(source, 'anomalies', 'anomalous_transactions')

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-x-8 gap-y-2">
        <div>
          <p className="text-[12px] text-muted-foreground">本期支出</p>
          <p className="font-mono text-[26px] font-medium leading-tight">{formatMoney(total, currency)}</p>
        </div>
        <div>
          <p className="text-[12px] text-muted-foreground">交易笔数</p>
          <p className="font-mono text-[18px]">{asNumber(source?.transaction_count ?? source?.count) ?? '未返回'}</p>
        </div>
      </div>

      {anomalies.length > 0 && <AnomalyPanel anomalies={anomalies} currency={currency} />}

      {categories.length > 0 && (
        <div className="flex flex-col gap-2">
          <SectionLabel>类别分布</SectionLabel>
          <ul className="flex flex-col gap-2">
            {categories.map((c) => {
              const share = c.share !== null ? (c.share > 1 ? c.share / 100 : c.share) : total && c.amount !== null ? c.amount / total : null
              return (
                <li key={c.name} className="grid grid-cols-[6rem_1fr_auto] items-center gap-3 text-[13px]">
                  <span className="truncate">{c.name}</span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <span className="block h-full rounded-full bg-cobalt" style={{ width: `${Math.min(100, Math.max(0, (share ?? 0) * 100))}%` }} />
                  </span>
                  <span className="font-mono text-[12.5px]">
                    {formatMoney(c.amount, currency)}
                    {share !== null && <span className="ml-2 text-muted-foreground">{(share * 100).toFixed(1)}%</span>}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

    </div>
  )
}

function AnomalyPanel({ anomalies, currency }: { anomalies: JsonObject[]; currency: string }) {
  const highCount = anomalies.filter((a) => text(a, 'risk_level') === 'high').length
  return (
    <section aria-label="异常交易" className="flex flex-col overflow-hidden rounded-lg border border-red/30 bg-red-soft/60">
      <header className="flex items-center justify-between gap-3 border-b border-red/20 px-3.5 py-2.5">
        <p className="flex items-center gap-2 text-[13.5px] font-medium text-red-ink">
          <ShieldAlert className="size-4" aria-hidden />
          发现 {anomalies.length} 笔异常交易
        </p>
        {highCount > 0 && <span className="text-[12px] text-red-ink">{highCount} 笔高风险</span>}
      </header>
      <ul className="flex flex-col">
        {anomalies.map((a, i) => {
          const high = text(a, 'risk_level') === 'high'
          const signals = asArray(a.signals).map(asText).filter((s): s is string => Boolean(s))
          const reason = text(a, 'reason', 'anomaly_reason')
          const occurredAt = text(a, 'occurred_at', 'created_at')
          return (
            <li
              key={text(a, 'transaction_id', 'id') ?? i}
              data-anomaly-risk={high ? 'high' : 'medium'}
              className="flex flex-col gap-2 border-b border-red/15 bg-card px-3.5 py-3 last:border-b-0"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="flex flex-wrap items-center gap-2 text-[14px] font-medium">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[11.5px] font-medium',
                        high ? 'bg-red text-primary-foreground' : 'bg-amber-soft text-amber-ink',
                      )}
                    >
                      {high ? '高风险' : '需留意'}
                    </span>
                    <span className="truncate">{text(a, 'description', 'merchant', 'label') ?? '未返回描述'}</span>
                  </p>
                  {occurredAt && <p className="font-mono text-[12px] text-muted-foreground">{formatDateTime(occurredAt)}</p>}
                </div>
                <span className={cn('shrink-0 font-mono text-[15px] font-medium', high && 'text-red-ink')}>{formatMoney(money(a, 'amount'), currency)}</span>
              </div>
              {signals.length > 0 ? (
                <ul className="flex flex-wrap gap-1.5" aria-label="触发的风险信号">
                  {signals.map((signal) => (
                    <li key={signal} className={cn('rounded-md border px-2 py-0.5 text-[12px]', high ? 'border-red/30 text-red-ink' : 'border-amber/40 text-amber-ink')}>
                      {signal}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[13px] leading-relaxed text-amber-ink">{reason ?? '未说明原因'}</p>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function Products({ data }: { data: unknown }) {
  const rows = listOf(data, 'products', 'items')
  if (rows.length === 0) return <p className="text-[13px] text-muted-foreground">暂无产品。</p>
  return (
    <div className="flex flex-col gap-2">
      <Table caption="理财产品比较" head={['产品', '风险等级', '起购金额', '期限', '业绩比较基准']}>
        {rows.map((p, i) => {
          const bps = asNumber(p.annual_rate_bps ?? p.benchmark_bps)
          const term = asNumber(p.term_days ?? p.term)
          return (
            <tr key={text(p, 'product_id', 'id') ?? i} className="border-b border-border last:border-b-0">
              <td className="py-2 pr-3">
                <p className="font-medium">{text(p, 'name', 'product_name') ?? '未返回'}</p>
                <p className="font-mono text-[12px] text-muted-foreground">{text(p, 'product_id', 'id') ?? ''}</p>
              </td>
              <td className="py-2 pr-3">
                {PRODUCT_RISK_LABELS[text(p, 'risk_level', 'risk_rating') ?? ''] ?? text(p, 'risk_level', 'risk_rating') ?? '未返回'}
              </td>
              <td className="py-2 pr-3 font-mono">{formatMoney(money(p, 'min_amount', 'minimum_amount', 'min_purchase'), text(p, 'currency') ?? 'CNY')}</td>
              <td className="py-2 pr-3 font-mono">{term !== null ? `${term} 天` : (text(p, 'term') ?? '未返回')}</td>
              <td className="py-2 text-right font-mono">{formatBps(bps)}</td>
            </tr>
          )
        })}
      </Table>
      <p className="text-[12.5px] leading-relaxed text-muted-foreground">
        业绩比较基准为产品说明中的参考值，不代表预期或承诺收益。理财非存款，产品有风险。
      </p>
    </div>
  )
}

function Cards({ data }: { data: unknown }) {
  const rows = listOf(data, 'cards', 'items')
  if (rows.length === 0) return <p className="text-[13px] text-muted-foreground">暂无卡片。</p>
  return (
    <ul className="flex flex-col">
      {rows.map((card, i) => {
        const status = text(card, 'status')
        const statusMeta = CARD_STATUS_LABELS[status ?? ''] ?? { label: status ?? '未返回', tone: 'neutral' as const }
        const restrictions = (asArray(card.restrictions ?? card.controls).map(asText).filter(Boolean) as string[])
          .map((restriction) => RESTRICTION_LABELS[restriction] ?? restriction)
        return (
          <li key={text(card, 'card_id', 'id') ?? i} className="flex flex-col gap-2 border-b border-border py-3 first:pt-0 last:border-b-0">
            <div className="flex items-center justify-between gap-3">
              <p className="flex min-w-0 items-baseline gap-2">
                <span className="text-[14px] font-medium">{text(card, 'name', 'product_name', 'type') ?? '银行卡'}</span>
                <span className="font-mono text-[13px] text-muted-foreground">
                  {text(card, 'masked_number') ?? (text(card, 'last4') ? `•••• ${text(card, 'last4')}` : '卡号未返回')}
                </span>
              </p>
              <StatusPill tone={statusMeta.tone} label={statusMeta.label} />
            </div>
            <FieldList
              rows={[
                { label: '额度', value: formatMoney(money(card, 'limit', 'credit_limit', 'daily_limit'), text(card, 'currency') ?? 'CNY'), mono: true },
                { label: '限制', value: restrictions.length > 0 ? restrictions.join('、') : '无' },
              ]}
            />
          </li>
        )
      })}
    </ul>
  )
}

function Subscriptions({ data }: { data: unknown }) {
  const rows = listOf(data, 'subscriptions', 'items')
  const reminders = listOf(data, 'reminders')
  const reminderDays = new Map(
    reminders
      .map((reminder) => [text(reminder, 'subscription_id'), asNumber(reminder.days_until)] as const)
      .filter((entry): entry is readonly [string, number] => entry[0] !== null && entry[1] !== null),
  )
  if (rows.length === 0) return <p className="text-[13px] text-muted-foreground">暂无订阅。</p>
  return (
    <Table caption="订阅与续费" head={['商户', '周期', '下次扣费', '提醒', '金额']}>
      {rows.map((s, i) => {
        const id = text(s, 'subscription_id', 'id')
        const daysUntil = id ? reminderDays.get(id) : null
        return (
          <tr key={id ?? i} className="border-b border-border last:border-b-0">
            <td className="py-2 pr-3 font-medium">{text(s, 'merchant', 'merchant_ref', 'name') ?? '未返回'}</td>
            <td className="py-2 pr-3 text-muted-foreground">
              {{ daily: '每日', weekly: '每周', monthly: '每月', yearly: '每年' }[text(s, 'billing_cycle', 'cycle', 'interval') ?? ''] ??
                text(s, 'billing_cycle', 'cycle', 'interval') ??
                '未返回'}
            </td>
            <td className="py-2 pr-3 font-mono text-[12px]">{formatDateTime(text(s, 'next_charge_at', 'next_billing_date', 'renews_at'))}</td>
            <td className="py-2 pr-3 text-muted-foreground">{daysUntil != null ? `${daysUntil} 天后` : '未返回'}</td>
            <td className="py-2 text-right font-mono">{formatMoney(money(s, 'amount', 'price'), text(s, 'currency') ?? 'CNY')}</td>
          </tr>
        )
      })}
    </Table>
  )
}

function GenericList({ data, caption }: { data: unknown; caption: string }) {
  const rows = listOf(data, 'items', 'holdings', 'reminders')
  if (rows.length === 0) {
    const source = asObject(data)
    if (!source) return null
    const entries = Object.entries(source).filter(([, v]) => typeof v !== 'object' || v === null)
    if (entries.length === 0) return null
    return <FieldList rows={entries.map(([k, v]) => ({ label: labelField(k), ...formatValue(k, v) }))} />
  }
  const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r).filter((k) => typeof r[k] !== 'object')))).slice(0, 5)
  return (
    <Table caption={caption} head={keys.map(labelField)}>
      {rows.map((row, i) => (
        <tr key={i} className="border-b border-border last:border-b-0">
          {keys.map((k, j) => {
            const f = formatField(k, row[k])
            return (
              <td key={k} className={cn('py-2 pr-3', f.mono && 'font-mono text-[12.5px]', j === keys.length - 1 && 'pr-0 text-right')}>
                {f.text}
              </td>
            )
          })}
        </tr>
      ))}
    </Table>
  )
}

function formatValue(key: string, value: unknown) {
  const f = formatField(key, value)
  return { value: f.text, mono: f.mono }
}

const TITLES: Record<string, string> = {
  balance: '账户概览',
  transactions: '交易明细',
  bill_summary: '账单分析',
  bills: '账单分析',
  products: '理财产品',
  holdings: '持仓',
  cards: '卡片',
  subscriptions: '订阅与续费',
  reminders: '提醒',
}

export function QueryResultView({ query, traceId }: { query: QueryResult; traceId: string | null }) {
  const kind = query.kind
  const body = (() => {
    switch (kind) {
      case 'balance':
      case 'account':
        return <Balance data={query.data} traceId={traceId} />
      case 'transactions':
        return <Transactions data={query.data} />
      case 'bill_summary':
      case 'bills':
        return <BillSummary data={query.data} />
      case 'products':
        return <Products data={query.data} />
      case 'cards':
        return <Cards data={query.data} />
      case 'subscriptions':
        return <Subscriptions data={query.data} />
      default:
        return <GenericList data={query.data} caption={TITLES[kind] ?? '查询结果'} />
    }
  })()

  return (
    <section aria-label={TITLES[kind] ?? '查询结果'} className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h3 className="text-[14px] font-medium">{TITLES[kind] ?? '查询结果'}</h3>
        
      </div>
      {body}
    </section>
  )
}
