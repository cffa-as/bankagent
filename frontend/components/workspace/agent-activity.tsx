'use client'

import {
  BrainCircuit,
  Check,
  ChevronRight,
  Database,
  Fingerprint,
  Pause,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Undo2,
  UserRoundCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatTime, shortId } from '@/lib/vaultline/format'
import type { LiveActivityEvent } from '@/lib/vaultline/types'

type StepKind = 'intent' | 'tool' | 'policy' | 'action' | 'security' | 'result'

interface StepMeta {
  label: string
  detail: string
  kind: StepKind
}

const STEP_META: Record<string, StepMeta> = {
  agent_run_started: { label: '接收业务请求', detail: '建立运行上下文与审计 Trace', kind: 'intent' },
  model_plan_requested: { label: '解析业务意图', detail: '模型仅生成候选计划，不参与授权', kind: 'intent' },
  model_plan_validated: { label: '候选计划通过校验', detail: 'Schema、意图与工具白名单检查完成', kind: 'policy' },
  model_plan_rejected: { label: '候选计划已拒绝', detail: '未创建动作，等待重新表述', kind: 'security' },
  model_plan_unknown: { label: '未识别业务意图', detail: '未进入工具调用或授权流程', kind: 'security' },
  suspicious_input_detected: { label: '可疑输入已拦截', detail: '安全策略阻止越权指令并记录证据', kind: 'security' },
  balance_queried: { label: '查询账户余额', detail: '只读工具 · 服务端账本', kind: 'tool' },
  transactions_queried: { label: '读取交易记录', detail: '只读工具 · 服务端账本', kind: 'tool' },
  bill_analyzed: { label: '分析消费与异常', detail: '只读工具 · 账单分析', kind: 'tool' },
  investment_products_queried: { label: '读取理财产品', detail: '只读工具 · 产品目录', kind: 'tool' },
  investment_holdings_queried: { label: '读取理财持仓', detail: '只读工具 · 持仓账本', kind: 'tool' },
  cards_queried: { label: '读取卡片状态', detail: '只读工具 · 卡片中心', kind: 'tool' },
  subscriptions_queried: { label: '检查订阅代扣', detail: '只读工具 · 订阅账本', kind: 'tool' },
  subscription_reminders_queried: { label: '读取续费提醒', detail: '只读工具 · 代扣计划', kind: 'tool' },
  model_liquidity_simulation_selected: { label: '运行未来现金流测算', detail: '确定性现金流模型 · 非模型结论', kind: 'tool' },
  liquidity_simulation_completed: { label: '现金流测算完成', detail: '多情景现金流结果已生成', kind: 'result' },
  action_created: { label: '锁定动作快照', detail: '风险级别与授权边界由服务端生成', kind: 'action' },
  confirmation_succeeded: { label: '用户确认已记录', detail: '动作快照未发生静默修改', kind: 'action' },
  mfa_succeeded: { label: 'MFA 验证通过', detail: '验证凭证绑定当前 Action', kind: 'security' },
  authorization_gate_passed: { label: '一次性执行闸门放行', detail: '状态、授权和幂等检查通过', kind: 'policy' },
  action_scheduled: { label: '动作已预约', detail: '等待服务端在指定时间复核', kind: 'action' },
  action_succeeded: { label: '业务回执已返回', detail: '最终结果来自银行业务工具', kind: 'result' },
  action_failed: { label: '业务执行未完成', detail: '服务端已返回失败或对账状态', kind: 'security' },
  action_cancelled: { label: '动作已取消', detail: '后续执行与工具调用已拒绝', kind: 'result' },
  action_expired: { label: '动作已过期', detail: '授权窗口已关闭，未继续执行', kind: 'result' },
  run_completed: { label: '运行已完成', detail: '本次 Agent 运行正常结束', kind: 'result' },
  run_failed: { label: '运行未完成', detail: '服务端终止本次运行，未伪装业务成功', kind: 'security' },
  run_interrupted: { label: '运行已停止', detail: '用户停止后不再进入新的工具或动作', kind: 'result' },
  run_human_handoff: { label: '已转人工接管', detail: 'Agent 已冻结后续推进，等待人工处理', kind: 'action' },
  run_rollback_completed: { label: '撤销边界已处理', detail: '取消可撤销动作；已执行动作进入人工复核', kind: 'policy' },
}

const STEP_ICON: Record<StepKind, typeof BrainCircuit> = {
  intent: BrainCircuit,
  tool: Database,
  policy: ShieldCheck,
  action: Fingerprint,
  security: ShieldAlert,
  result: Check,
}

function describeStep(event: LiveActivityEvent): StepMeta {
  return STEP_META[event.eventType] ?? {
    label: '服务端执行里程碑',
    detail: event.eventType.replaceAll('_', ' '),
    kind: 'policy',
  }
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
  const last = events.at(-1)
  const lastMeta = last ? describeStep(last) : null
  const controlled = events.some((event) => event.eventType === 'run_interrupted' || event.eventType === 'run_human_handoff')
  const live = running && !controlled

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border bg-card transition-colors duration-200',
        live ? 'border-cobalt/35 shadow-[0_8px_28px_rgb(49_91_255_/_0.07)]' : 'border-border',
      )}
    >
      <details open={running || undefined} className="group">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
          <span
            className={cn(
              'relative flex size-8 shrink-0 items-center justify-center rounded-lg border',
              live ? 'border-cobalt/25 bg-ice text-cobalt-ink' : 'border-border bg-surface text-steel',
            )}
            aria-hidden
          >
            {live && <span className="absolute inset-0 animate-ping rounded-lg bg-cobalt/10 motion-reduce:animate-none" />}
            <Sparkles className="relative size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-cobalt-ink">
                Agent execution
              </span>
              {live && (
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-cobalt-ink">
                  <span className="size-1.5 animate-pulse rounded-full bg-cobalt motion-reduce:animate-none" aria-hidden />
                  实时
                </span>
              )}
            </span>
            <span className="mt-0.5 block truncate text-[13px] font-medium text-foreground">
              {running
                ? lastMeta
                  ? controlled
                    ? `${lastMeta.label}，控制状态已生效`
                    : `${lastMeta.label}已完成，等待下一步`
                  : '正在建立安全执行上下文'
                : `${events.length} 个服务端执行里程碑`}
            </span>
          </span>
          <span className="hidden shrink-0 font-mono text-[11px] text-muted-foreground sm:block">
            {controlled ? 'CONTROLLED' : running ? 'LIVE' : 'AUDITABLE'}
          </span>
          <ChevronRight className="size-4 shrink-0 text-steel transition-transform group-open:rotate-90" aria-hidden />
        </summary>

        <div className="border-t border-border px-4 pb-3 pt-3">
          <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
            以下为服务端审计事件与工具里程碑，不包含模型私有思维链。
          </p>
          {events.length === 0 ? (
            <div className="flex items-center gap-3 text-[13px] text-muted-foreground" aria-live="polite">
              <span className="relative flex size-7 items-center justify-center rounded-full border border-cobalt/30 bg-ice text-cobalt-ink">
                <span className="absolute inset-0 animate-ping rounded-full bg-cobalt/10 motion-reduce:animate-none" aria-hidden />
                <BrainCircuit className="relative size-3.5" aria-hidden />
              </span>
              等待服务端返回首个执行里程碑…
            </div>
          ) : (
            <ol aria-live="polite" aria-relevant="additions">
              {events.map((event, index) => {
                const meta = describeStep(event)
                const Icon = STEP_ICON[meta.kind]
                const active = running && index === events.length - 1
                const failed = event.outcome === 'failed'
                return (
                  <li key={event.eventId} className="relative flex gap-3 pb-4 last:pb-0">
                    {index < events.length - 1 && (
                      <span className="absolute bottom-0 left-[13px] top-7 w-px bg-border" aria-hidden />
                    )}
                    <span
                      className={cn(
                        'relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border',
                        active
                          ? 'border-cobalt/35 bg-ice text-cobalt-ink'
                          : failed
                            ? 'border-red/35 bg-red-soft text-red-ink'
                            : 'border-teal/30 bg-teal-soft text-teal-ink',
                      )}
                    >
                      {active && <span className="absolute inset-0 animate-ping rounded-full bg-cobalt/10 motion-reduce:animate-none" aria-hidden />}
                      <Icon className="relative size-3.5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 pt-0.5">
                      <span className="flex items-baseline justify-between gap-3">
                        <span
                          className={cn(
                            'text-[13px] font-medium',
                            failed ? 'text-red-ink' : active ? 'text-cobalt-ink' : 'text-foreground',
                          )}
                        >
                          {meta.label}
                        </span>
                        <time className="shrink-0 font-mono text-[10.5px] text-muted-foreground" dateTime={event.occurredAt}>
                          {formatTime(event.occurredAt)}
                        </time>
                      </span>
                      <span className="mt-0.5 block text-[11.5px] leading-relaxed text-muted-foreground">{meta.detail}</span>
                    </span>
                  </li>
                )
              })}
            </ol>
          )}
          {last && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2.5">
              <div className="flex min-h-7 items-center gap-2">
                {running && runId && !controlled && onInterrupt && (
                  <button
                    type="button"
                    onClick={onInterrupt}
                    disabled={Boolean(control)}
                    className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-card px-2 text-[11px] font-medium text-foreground transition-colors hover:border-line-strong disabled:opacity-50"
                  >
                    <Pause className="size-3" aria-hidden />
                    {control === 'interrupt' ? '停止中…' : '停止运行'}
                  </button>
                )}
                {running && runId && !controlled && onHandoff && (
                  <button
                    type="button"
                    onClick={onHandoff}
                    disabled={Boolean(control)}
                    className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-card px-2 text-[11px] font-medium text-foreground transition-colors hover:border-line-strong disabled:opacity-50"
                  >
                    <UserRoundCheck className="size-3" aria-hidden />
                    {control === 'handoff' ? '转接中…' : '转人工'}
                  </button>
                )}
                {!running && runId && onRollback && (
                  <button
                    type="button"
                    onClick={onRollback}
                    disabled={Boolean(control)}
                    className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-card px-2 text-[11px] font-medium text-foreground transition-colors hover:border-line-strong disabled:opacity-50"
                  >
                    <Undo2 className="size-3" aria-hidden />
                    {control === 'rollback' ? '撤销中…' : '撤销可撤销项'}
                  </button>
                )}
                <span className="text-[10.5px] text-muted-foreground">
                  {controlled ? '控制状态已生效，等待原请求安全收敛。' : running ? '继续等待真实服务端状态…' : '显示内容均可追溯至审计链'}
                </span>
              </div>
              <code className="min-w-0 truncate font-mono text-[10.5px] text-muted-foreground" title={last.traceId}>
                trace {shortId(last.traceId)}
              </code>
            </div>
          )}
        </div>
      </details>
    </div>
  )
}
