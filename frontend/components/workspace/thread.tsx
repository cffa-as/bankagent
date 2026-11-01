'use client'

import { CalendarClock, ChartLine, ChevronRight, RotateCcw } from 'lucide-react'
import { VaultlineSeal } from '@/components/vaultline/seal'
import { cn } from '@/lib/utils'
import { describeKind, formatMoney } from '@/lib/vaultline/format'
import { describeRisk, describeStatus, describeWorkflowStatus, VERDICT } from '@/lib/vaultline/status'
import type { BankAction, MessageResult } from '@/lib/vaultline/types'
import type { ThreadItem, WorkspaceSession } from '@/lib/vaultline/use-workspace-session'
import { actionAmount, actionCurrency, actionTarget } from './action-snapshot'
import { AgentStatus } from './agent-activity'
import { Callout, StatusPill } from './primitives'
import { QueryResultView } from './query-results'

interface ThreadProps {
  session: WorkspaceSession
  onInspectAction: (actionId: string) => void
  onOpenLiquidity: () => void
  onOpenWorkflow: (workflowId: string) => void
}

function ActionCard({ action, active, onInspect }: { action: BankAction; active: boolean; onInspect: () => void }) {
  const status = describeStatus(action.status)
  const risk = describeRisk(action.risk_level)
  const amount = actionAmount(action)
  const target = actionTarget(action)
  const needsUser = status.tone === 'confirm' || status.tone === 'mfa'
  return (
    <div className={cn('overflow-hidden rounded-xl border bg-card', active ? 'border-cobalt/40' : 'border-border')}>
      <div className="flex items-start justify-between gap-3 px-4 pt-4">
        <div className="min-w-0">
          <p className="text-[13px] text-muted-foreground">{describeKind(action.kind)}</p>
          {target && <p className="mt-0.5 truncate text-[15px] font-medium">{target}</p>}
        </div>
        <StatusPill tone={status.tone} label={status.label} />
      </div>
      {amount !== null && (
        <p className="px-4 pt-3 font-mono text-[26px] font-medium leading-none tracking-tight">
          {formatMoney(amount, actionCurrency(action))}
        </p>
      )}
      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border bg-background/60 px-4 py-2.5">
        <p className="min-w-0 truncate text-[12.5px] text-muted-foreground">
          {needsUser ? (status.tone === 'mfa' ? '需要完成安全验证后才会执行' : '需要你核对并确认后才会执行') : risk.label}
        </p>
        <button
          type="button"
          onClick={onInspect}
          className={cn(
            'inline-flex h-9 shrink-0 items-center gap-1 rounded-lg px-3 text-[13px] font-medium transition-colors',
            needsUser ? 'bg-cobalt text-primary-foreground hover:bg-cobalt-ink' : 'text-cobalt-ink hover:bg-ice',
          )}
        >
          {needsUser ? '去处理' : '查看详情'}
          <ChevronRight className="size-3.5" aria-hidden />
        </button>
      </div>
    </div>
  )
}

function LinkRow({
  icon: Icon,
  title,
  meta,
  badge,
  onClick,
}: {
  icon: typeof ChartLine
  title: string
  meta: string
  badge?: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-14 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-cobalt/40"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-ice text-cobalt-ink">
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium">{title}</span>
        <span className="block truncate text-[12.5px] text-muted-foreground">{meta}</span>
      </span>
      {badge}
      <ChevronRight className="size-4 shrink-0 text-steel" aria-hidden />
    </button>
  )
}

function AssistantShell({ children }: { children: React.ReactNode }) {
  return (
    <li className="vl-enter flex gap-3">
      <VaultlineSeal className="mt-0.5 size-7 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <p className="sr-only">Vaultline 助理</p>
        {children}
      </div>
    </li>
  )
}

function AssistantMessage({
  result,
  session,
  onInspectAction,
  onOpenLiquidity,
  onOpenWorkflow,
}: { result: MessageResult } & ThreadProps) {
  const live = result.action ? (session.actions[result.action.action_id] ?? result.action) : null
  const rejected = result.reply_type === 'rejected'
  const verdict = result.liquidity?.verdict ? VERDICT[result.liquidity.verdict] : null
  const workflowStatus = result.workflow ? describeWorkflowStatus(result.workflow.status) : null

  return (
    <AssistantShell>
      {result.reply_text && <p className="whitespace-pre-wrap text-pretty pt-0.5 text-[15px] leading-relaxed">{result.reply_text}</p>}

      {rejected && (
        <Callout tone="fail" title="这项业务暂时无法办理">
          <p>{result.rejection?.message ?? '请求不符合银行业务规则，未产生任何操作。'}</p>
        </Callout>
      )}

      {result.query && <QueryResultView query={result.query} traceId={result.trace_id} />}

      {live && (
        <ActionCard action={live} active={session.activeActionId === live.action_id} onInspect={() => onInspectAction(live.action_id)} />
      )}

      {result.liquidity && (
        <LinkRow
          icon={ChartLine}
          title="未来现金流测算"
          meta="查看余额走势与可选方案"
          badge={verdict ? <StatusPill tone={verdict.tone} label={verdict.label} /> : undefined}
          onClick={onOpenLiquidity}
        />
      )}

      {result.workflow && workflowStatus && (
        <LinkRow
          icon={CalendarClock}
          title={result.workflow.title ?? '资金计划'}
          meta={`共 ${result.workflow.nodes.length} 步 · 尚未开始执行`}
          badge={<StatusPill tone={workflowStatus.tone} label={workflowStatus.label} />}
          onClick={() => onOpenWorkflow(result.workflow?.workflow_id as string)}
        />
      )}
    </AssistantShell>
  )
}

function Item({ item, ...props }: { item: ThreadItem } & ThreadProps) {
  if (item.role === 'user') {
    return (
      <li className="vl-enter flex justify-end">
        <p className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-navy px-4 py-2.5 text-[15px] leading-relaxed text-rail-foreground">
          {item.text}
        </p>
      </li>
    )
  }
  if (item.role === 'notice') {
    return (
      <AssistantShell>
        <Callout tone={item.state.tone} title={item.state.title}>
          <p>{item.state.body}</p>
          {item.code && <p className="mt-1 font-mono text-[12px] text-muted-foreground">错误码 {item.code}</p>}
        </Callout>
        {item.retry && (
          <button
            type="button"
            onClick={() => props.session.retry(item.id)}
            disabled={props.session.sending}
            className="inline-flex h-9 items-center gap-1.5 self-start rounded-lg border border-border bg-card px-3 text-[13px] font-medium transition-colors hover:border-line-strong disabled:opacity-50"
          >
            <RotateCcw className="size-3.5" aria-hidden />
            重新发送
          </button>
        )}
      </AssistantShell>
    )
  }
  return <AssistantMessage result={item.result} {...props} />
}

export function Thread(props: ThreadProps) {
  const { session } = props
  return (
    <ol className="flex flex-col gap-6" aria-label="对话记录" aria-live="polite" aria-relevant="additions">
      {session.thread.map((item) => (
        <Item key={item.id} item={item} {...props} />
      ))}
      {session.sending && (
        <AssistantShell>
          <AgentStatus events={session.activity} />
        </AssistantShell>
      )}
    </ol>
  )
}
