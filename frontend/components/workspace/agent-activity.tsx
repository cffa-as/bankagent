'use client'

import { Check, ChevronRight, Hand, Pause, ShieldAlert, Undo2, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { EVENT_STEPS as STEPS, type StepTone } from '@/lib/vaultline/event-labels'
import type { LiveActivityEvent } from '@/lib/vaultline/types'

const NEXT: Record<string, string> = {
  agent_run_started: '正在理解你的需求',
  model_plan_requested: '正在理解你的需求',
  model_plan_validated: '正在调取所需信息',
  balance_queried: '正在整理账户情况',
  transactions_queried: '正在整理交易明细',
  bill_analyzed: '正在整理消费分析',
  investment_products_queried: '正在整理产品对比',
  investment_holdings_queried: '正在整理持仓情况',
  cards_queried: '正在整理卡片信息',
  subscriptions_queried: '正在整理订阅情况',
  subscription_reminders_queried: '正在整理续费提醒',
  model_liquidity_simulation_selected: '正在测算现金流',
  liquidity_simulation_completed: '正在整理测算结论',
  action_created: '正在准备业务单',
  confirmation_succeeded: '正在提交银行办理',
  mfa_succeeded: '正在提交银行办理',
  authorization_gate_passed: '银行正在办理',
}

const TONE_ICON = { done: Check, guard: ShieldAlert, fail: ShieldAlert } as const

function useElapsed(events: LiveActivityEvent[], running: boolean) {
  const [startedAt] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!running) return
    const timer = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(timer)
  }, [running])
  if (running) return now - startedAt
  const first = events.at(0) && new Date(events[0].occurredAt).getTime()
  const last = events.at(-1) && new Date(events[events.length - 1].occurredAt).getTime()
  if (!first || !last || Number.isNaN(first) || Number.isNaN(last)) return null
  return Math.max(0, last - first)
}

function formatElapsed(ms: number | null) {
  if (ms === null || ms < 100) return null
  return ms < 60_000 ? `${(ms / 1000).toFixed(1)} 秒` : `${Math.floor(ms / 60_000)} 分 ${Math.round((ms % 60_000) / 1000)} 秒`
}

function summarize(events: LiveActivityEvent[]) {
  const types = new Set(events.map((e) => e.eventType))
  if (types.has('run_human_handoff')) return { text: '已转交人工客服', tone: 'guard' as const }
  if (types.has('run_interrupted')) return { text: '已停止处理', tone: 'guard' as const }
  if (types.has('suspicious_input_detected') || types.has('model_plan_rejected')) return { text: '已按安全规则处理', tone: 'guard' as const }
  if (types.has('run_failed') || events.some((e) => e.outcome === 'failed')) return { text: '处理未完成', tone: 'fail' as const }
  return { text: '处理完成', tone: 'done' as const }
}

function ControlButton({
  icon: Icon,
  label,
  busyLabel,
  busy,
  disabled,
  onClick,
}: {
  icon: typeof Pause
  label: string
  busyLabel: string
  busy: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[12px] text-muted-foreground transition-colors hover:bg-card hover:text-foreground disabled:opacity-50"
    >
      <Icon className="size-3" aria-hidden />
      {busy ? busyLabel : label}
    </button>
  )
}

export function AgentActivity({
  events,
  running,
  runId,
  control,
  onInterrupt,
  onHandoff,
  onRollback,
}: {
  events: LiveActivityEvent[]
  running: boolean
  runId?: string | null
  control?: 'interrupt' | 'handoff' | 'rollback' | null
  onInterrupt?: () => void
  onHandoff?: () => void
  onRollback?: () => void
}) {
  const [open, setOpen] = useState(false)
  const elapsed = formatElapsed(useElapsed(events, running))
  const steps = events.filter((e) => STEPS[e.eventType])
  const last = events.at(-1)
  const controlled = events.some((e) => e.eventType === 'run_interrupted' || e.eventType === 'run_human_handoff')
  const live = running && !controlled
  const summary = summarize(events)
  const expanded = live || open
  const nowLabel = live ? ((last && NEXT[last.eventType]) ?? (last ? '正在处理' : '正在理解你的需求')) : summary.text

  return (
    <div className="flex flex-col">
      <div className="flex min-h-8 items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          disabled={live}
          aria-expanded={expanded}
          className="group -ml-1 inline-flex min-w-0 items-center gap-2 rounded-md px-1 py-1 text-left disabled:cursor-default"
        >
          {live ? (
            <span
              className="size-3.5 shrink-0 animate-spin rounded-full border-[1.5px] border-cobalt/20 border-t-cobalt motion-reduce:animate-none"
              aria-hidden
            />
          ) : (
            <span
              className={cn(
                'flex size-4 shrink-0 items-center justify-center rounded-full',
                summary.tone === 'done' ? 'bg-teal-soft text-teal-ink' : summary.tone === 'fail' ? 'bg-red-soft text-red-ink' : 'bg-amber-soft text-amber-ink',
              )}
              aria-hidden
            >
              {summary.tone === 'done' ? <Check className="size-2.5" strokeWidth={3} /> : <ShieldAlert className="size-2.5" />}
            </span>
          )}
          <span role="status" aria-live="polite" className={cn('truncate text-[13.5px]', live ? 'vl-shimmer font-medium' : 'text-muted-foreground')}>
            {nowLabel}
          </span>
          {!live &&
            [steps.length > 0 && `${steps.length} 个步骤`, elapsed && `用时 ${elapsed}`]
              .filter(Boolean)
              .map((part) => (
                <span key={String(part)} className="flex shrink-0 items-center gap-2 text-[12.5px] text-steel">
                  <span className="size-0.5 rounded-full bg-steel" aria-hidden />
                  {part}
                </span>
              ))}
          {live && elapsed && <span className="shrink-0 font-mono text-[11.5px] tabular-nums text-steel">{elapsed}</span>}
          {!live && steps.length > 0 && (
            <ChevronRight className={cn('size-3.5 shrink-0 text-steel transition-transform', expanded && 'rotate-90')} aria-hidden />
          )}
        </button>

        {live && runId && (
          <div className="ml-auto flex shrink-0 items-center">
            {onInterrupt && (
              <ControlButton
                icon={Pause}
                label="停止"
                busyLabel="停止中…"
                busy={control === 'interrupt'}
                disabled={Boolean(control)}
                onClick={onInterrupt}
              />
            )}
            {onHandoff && (
              <ControlButton
                icon={UserRound}
                label="转人工"
                busyLabel="转接中…"
                busy={control === 'handoff'}
                disabled={Boolean(control)}
                onClick={onHandoff}
              />
            )}
          </div>
        )}
      </div>

      {expanded && steps.length > 0 && (
        <ol className="vl-enter ml-[7px] mt-1 flex flex-col gap-2 border-l border-border py-1 pl-4" aria-label="处理过程">
          {steps.map((event) => {
            const step = STEPS[event.eventType]
            const tone: StepTone = event.outcome === 'failed' ? 'fail' : (step.tone ?? 'done')
            const Icon = TONE_ICON[tone]
            return (
              <li key={event.eventId} className="flex items-center gap-2.5 text-[13px]">
                <Icon
                  className={cn('size-3.5 shrink-0', tone === 'done' ? 'text-teal-ink' : tone === 'fail' ? 'text-red-ink' : 'text-amber-ink')}
                  aria-hidden
                />
                <span className={cn('min-w-0 truncate', tone === 'fail' ? 'text-red-ink' : 'text-foreground')}>{step.label}</span>
                {step.source && (
                  <span className="shrink-0 rounded bg-card px-1.5 py-px text-[11px] text-muted-foreground ring-1 ring-border">{step.source}</span>
                )}
              </li>
            )
          })}
          {live && (
            <li className="flex items-center gap-2.5 text-[13px] text-muted-foreground">
              <span className="flex size-3.5 items-center justify-center" aria-hidden>
                <span className="size-1.5 animate-pulse rounded-full bg-cobalt motion-reduce:animate-none" />
              </span>
              {nowLabel.replace(/^正在/, '')}
            </li>
          )}
          {!live && runId && onRollback && (
            <li className="pt-1">
              <button
                type="button"
                onClick={onRollback}
                disabled={Boolean(control)}
                className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[12px] text-muted-foreground ring-1 ring-border transition-colors hover:text-foreground hover:ring-line-strong disabled:opacity-50"
              >
                <Undo2 className="size-3" aria-hidden />
                {control === 'rollback' ? '撤销中…' : '撤销本次可撤销的操作'}
              </button>
            </li>
          )}
          {controlled && (
            <li className="flex items-center gap-2.5 text-[12.5px] text-muted-foreground">
              <Hand className="size-3.5 shrink-0" aria-hidden />
              后续步骤已暂停，不会再发起新的业务。
            </li>
          )}
        </ol>
      )}
    </div>
  )
}
