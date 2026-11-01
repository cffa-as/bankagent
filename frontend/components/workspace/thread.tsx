'use client'

import { ChartLine, ChevronRight, GitBranch, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { describeKind, formatMoney, shortId } from '@/lib/vaultline/format'
import { describeStatus, describeWorkflowStatus, TONE, VERDICT } from '@/lib/vaultline/status'
import type { BankAction, LiveActivityEvent, MessageResult } from '@/lib/vaultline/types'
import type { ThreadItem, WorkspaceSession } from '@/lib/vaultline/use-workspace-session'
import { actionAmount, actionCurrency, actionTarget } from './action-snapshot'
import { AgentActivity } from './agent-activity'
import { Callout, CopyId, RawData, RiskBadge, StatusPill } from './primitives'
import { QueryResultView } from './query-results'

interface ThreadProps {
  session: WorkspaceSession
  onInspectAction: (actionId: string) => void
  onOpenLiquidity: () => void
  onOpenWorkflow: (workflowId: string) => void
}

function ActionSummary({ action, active, onInspect }: { action: BankAction; active: boolean; onInspect: () => void }) {
  const status = describeStatus(action.status)
  const amount = actionAmount(action)
  const target = actionTarget(action)
  const needsUser = status.tone === 'confirm' || status.tone === 'mfa'
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg border bg-card px-4 py-3 sm:flex-row sm:items-center',
        active ? 'border-cobalt/50' : 'border-border',
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <RiskBadge level={action.risk_level} />
        <StatusPill tone={status.tone} label={status.label} />
      </div>
      <div className="flex min-w-0 flex-1 items-baseline gap-3">
        {amount !== null && <span className="font-mono text-[17px] font-medium">{formatMoney(amount, actionCurrency(action))}</span>}
        <span className="min-w-0 truncate text-[13px] text-muted-foreground">
          {describeKind(action.kind)}
          {target && <span className="text-foreground"> · {target}</span>}
        </span>
      </div>
      <button
        type="button"
        onClick={onInspect}
        aria-label={`查看处理 Action ${shortId(action.action_id)}`}
        className={cn(
          'inline-flex h-10 shrink-0 items-center justify-center gap-1 rounded-md px-3 text-[13px] font-medium transition-colors',
          needsUser ? 'bg-navy text-rail-foreground hover:bg-navy/90' : 'border border-border hover:border-line-strong',
        )}
      >
        查看处理
        <ChevronRight className="size-3.5" aria-hidden />
      </button>
    </div>
  )
}

function SummaryRow({
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
      className="flex min-h-12 items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 text-left transition-colors hover:border-line-strong"
    >
      <Icon className="size-4 shrink-0 text-steel" aria-hidden />
      <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{title}</span>
      {badge}
      <span className="hidden shrink-0 text-[13px] text-muted-foreground sm:inline">{meta}</span>
      <ChevronRight className="size-4 shrink-0 text-steel" aria-hidden />
    </button>
  )
}

function AssistantMessage({
  result,
  activity,
  session,
  onInspectAction,
  onOpenLiquidity,
  onOpenWorkflow,
}: { result: MessageResult; activity: LiveActivityEvent[] } & ThreadProps) {
  const live = result.action ? (session.actions[result.action.action_id] ?? result.action) : null
  const rejected = result.reply_type === 'rejected'
  const spine = rejected ? 'bg-red' : live ? TONE[describeStatus(live.status).tone].dot : result.query ? 'bg-teal' : 'bg-line-strong'
  const verdict = result.liquidity?.verdict ? VERDICT[result.liquidity.verdict] : null
  const workflowStatus = result.workflow ? describeWorkflowStatus(result.workflow.status) : null

  return (
    <li className="vl-enter flex gap-4">
      <span className={cn('w-0.5 shrink-0 self-stretch rounded-full', spine)} aria-hidden />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <p className="sr-only">Vaultline 助理</p>
        {activity.length > 0 && <AgentActivity events={activity} running={false} />}
        {result.reply_text && <p className="whitespace-pre-wrap text-pretty text-[15px] leading-relaxed">{result.reply_text}</p>}

        {rejected && (
          <Callout tone="fail" title="服务端已拒绝此请求">
            <p>{result.rejection?.message ?? '请求不符合银行策略，未创建任何动作。'}</p>
            {result.rejection?.code && <p className="mt-1 font-mono text-[12px]">{result.rejection.code}</p>}
          </Callout>
        )}

        {result.query && <QueryResultView query={result.query} traceId={result.trace_id} />}

        {live && (
          <ActionSummary action={live} active={session.activeActionId === live.action_id} onInspect={() => onInspectAction(live.action_id)} />
        )}

        {result.liquidity && (
          <SummaryRow
            icon={ChartLine}
            title="流动性预检报告"
            meta="打开报告"
            badge={verdict ? <StatusPill tone={verdict.tone} label={verdict.label} /> : undefined}
            onClick={onOpenLiquidity}
          />
        )}

        {result.workflow && workflowStatus && (
          <SummaryRow
            icon={GitBranch}
            title={result.workflow.title ?? '工作流'}
            meta={`${result.workflow.nodes.length} 个节点 · 尚未执行`}
            badge={<StatusPill tone={workflowStatus.tone} label={workflowStatus.label} />}
            onClick={() => onOpenWorkflow(result.workflow?.workflow_id as string)}
          />
        )}

        {!result.query && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {result.trace_id && <CopyId label="Trace" value={result.trace_id} className="text-[12px]" />}
            <RawData value={result.raw} />
          </div>
        )}
      </div>
    </li>
  )
}

function Item({ item, ...props }: { item: ThreadItem } & ThreadProps) {
  if (item.role === 'user') {
    return (
      <li className="vl-enter flex justify-end">
        <p className="max-w-[80%] whitespace-pre-wrap rounded-xl rounded-br-sm bg-navy px-3.5 py-2 text-[15px] leading-relaxed text-rail-foreground">
          {item.text}
        </p>
      </li>
    )
  }
  if (item.role === 'notice') {
    return (
      <li className="vl-enter flex flex-col gap-2">
        <Callout tone={item.state.tone} title={item.state.title}>
          <p>{item.state.body}</p>
          {(item.code || item.traceId) && (
            <p className="mt-1 font-mono text-[12px] text-muted-foreground">
              {item.code}
              {item.code && item.traceId && ' · '}
              {item.traceId && `trace ${shortId(item.traceId)}`}
            </p>
          )}
        </Callout>
        {item.retry && (
          <button
            type="button"
            onClick={() => props.session.retry(item.id)}
            disabled={props.session.sending}
            className="inline-flex h-10 items-center gap-1.5 self-start text-[13px] font-medium text-cobalt-ink hover:underline disabled:opacity-50"
          >
            <RotateCcw className="size-3.5" aria-hidden />
            重试同一请求
          </button>
        )}
      </li>
    )
  }
  return <AssistantMessage result={item.result} activity={item.activity} {...props} />
}

export function Thread(props: ThreadProps) {
  const { session } = props
  return (
    <ol className="flex flex-col gap-7" aria-label="对话记录" aria-live="polite" aria-relevant="additions">
      {session.thread.map((item) => (
        <Item key={item.id} item={item} {...props} />
      ))}
      {session.sending && (
        <li>
          <AgentActivity events={session.activity} running />
        </li>
      )}
    </ol>
  )
}
