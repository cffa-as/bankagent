'use client'

import useSWR from 'swr'
import { cn } from '@/lib/utils'
import type { VaultlineAdapter } from '@/lib/vaultline/adapters'
import { toApiError } from '@/lib/vaultline/api'
import { mapApiError } from '@/lib/vaultline/errors'
import { formatDateTime, shortId } from '@/lib/vaultline/format'
import { TONE, type Tone } from '@/lib/vaultline/status'
import { Callout, CopyId, Spinner } from './primitives'

const EVENT_LABELS: [RegExp, string, Tone][] = [
  [/intent|plan|message|proposal/, '意图与服务端计划校验', 'neutral'],
  [/risk/, '风险评级', 'confirm'],
  [/action[._]?created|created/, '动作已创建', 'live'],
  [/confirm/, '确认结果', 'confirm'],
  [/mfa/, 'MFA 结果', 'mfa'],
  [/gate|execution[._]?start|execute/, '执行闸门', 'live'],
  [/tool|receipt/, '工具回执', 'read'],
  [/reconcil/, '对账', 'held'],
  [/cancel/, '取消', 'void'],
  [/expire/, '过期', 'void'],
  [/outcome|final|succeed|complete/, '最终结果', 'done'],
  [/fail|reject/, '未完成', 'fail'],
]

function describeEvent(type: string) {
  const lower = type.toLowerCase()
  for (const [pattern, label, tone] of EVENT_LABELS) if (pattern.test(lower)) return { label, tone }
  return { label: type, tone: 'neutral' as Tone }
}

export function AuditTimeline({ adapter, traceId }: { adapter: VaultlineAdapter; traceId: string }) {
  const { data, error, isLoading, mutate } = useSWR(['vaultline/audit', traceId] as const, ([, id]) => adapter.getAuditTrace(id), {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  })

  if (isLoading) {
    return (
      <p role="status" className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <Spinner /> 正在读取审计链…
      </p>
    )
  }
  if (error) {
    const state = mapApiError(toApiError(error))
    return (
      <div className="flex flex-col gap-2">
        <Callout tone={state.tone} title={state.title}>
          <p>{state.body}</p>
        </Callout>
        <button type="button" onClick={() => void mutate()} className="self-start text-[13px] font-medium text-cobalt-ink hover:underline">
          重新读取
        </button>
      </div>
    )
  }
  if (!data || data.events.length === 0) {
    return <p className="text-[13px] text-muted-foreground">服务端暂未记录此 Trace 的事件。</p>
  }

  return (
    <div className="flex flex-col gap-3">
      <CopyId label="Trace ID" value={data.trace_id} />
      <ol className="relative flex flex-col">
        {data.events.map((event, i) => {
          const meta = describeEvent(event.event_type)
          const last = i === data.events.length - 1
          return (
            <li key={`${event.sequence ?? i}-${event.event_type}`} className="relative flex gap-3 pb-4 last:pb-0">
              <div className="flex w-4 shrink-0 flex-col items-center" aria-hidden>
                <span className={cn('mt-1.5 size-2.5 rounded-full ring-4 ring-ice', TONE[meta.tone].dot)} />
                {!last && <span className="mt-1 w-px flex-1 bg-border" />}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="text-[14px] font-medium">{meta.label}</p>
                  <time className="font-mono text-[12px] text-muted-foreground" dateTime={event.occurred_at ?? undefined}>
                    {formatDateTime(event.occurred_at)}
                  </time>
                </div>
                {event.summary && <p className="text-[13px] leading-relaxed text-foreground/80">{event.summary}</p>}
                <dl className="flex flex-wrap gap-x-4 gap-y-0.5 text-[12px] text-muted-foreground">
                  <div className="flex gap-1">
                    <dt>序号</dt>
                    <dd className="font-mono text-foreground">{event.sequence ?? '—'}</dd>
                  </div>
                  <div className="flex gap-1">
                    <dt>类型</dt>
                    <dd className="font-mono text-foreground">{event.event_type}</dd>
                  </div>
                  {event.actor && (
                    <div className="flex gap-1">
                      <dt>主体</dt>
                      <dd className="text-foreground">{event.actor}</dd>
                    </div>
                  )}
                  {event.outcome && (
                    <div className="flex gap-1">
                      <dt>结果</dt>
                      <dd className={TONE[meta.tone].text}>{event.outcome}</dd>
                    </div>
                  )}
                  {event.policy_version && (
                    <div className="flex gap-1">
                      <dt>策略</dt>
                      <dd className="font-mono text-foreground">{event.policy_version}</dd>
                    </div>
                  )}
                  {event.action_id && (
                    <div className="flex gap-1">
                      <dt>动作</dt>
                      <dd className="font-mono text-foreground" title={event.action_id}>
                        {shortId(event.action_id)}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            </li>
          )
        })}
      </ol>
      <p className="text-[12px] leading-relaxed text-muted-foreground">
        审计记录为脱敏的过程证据，用于追溯，不构成授权凭证。不包含模型推理过程与验证码。
      </p>
    </div>
  )
}
