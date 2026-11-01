'use client'

import { Check, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { VaultlineSeal } from '@/components/vaultline/seal'
import { cn } from '@/lib/utils'
import { formatDate, formatMoney } from '@/lib/vaultline/format'
import { TONE, VERDICT } from '@/lib/vaultline/status'
import type { LiquidityAlternative, LiquiditySimulation } from '@/lib/vaultline/types'
import type { WorkspaceSession } from '@/lib/vaultline/use-workspace-session'
import { LiquidityChart } from './liquidity-chart'
import { CopyId, FieldList, RawData, SectionLabel, Spinner, StatusPill } from './primitives'

interface LiquidityDrawerProps {
  open: boolean
  onClose: () => void
  session: WorkspaceSession
  creatingWorkflow: boolean
  onSelectAlternative: (simulation: LiquiditySimulation, alternative: LiquidityAlternative) => void
}

function Alternatives({
  simulation,
  creating,
  onSelect,
}: {
  simulation: LiquiditySimulation
  creating: boolean
  onSelect: (alt: LiquidityAlternative) => void
}) {
  const [chosen, setChosen] = useState<string | null>(null)
  if (simulation.alternatives.length === 0) return null
  return (
    <section className="flex flex-col gap-2">
      <SectionLabel>可选方案</SectionLabel>
      <ul className="flex flex-col gap-2">
        {simulation.alternatives.map((alt) => {
          const highlight = alt.recommended && !alt.conditional
          const executable = alt.reservations.length > 0
          return (
            <li
              key={alt.alternative_id}
              className={cn('flex flex-col gap-2 rounded-lg border bg-card p-3.5', highlight ? 'border-cobalt/60 ring-1 ring-cobalt/30' : 'border-border')}
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[14px] font-medium">{alt.label}</p>
                {highlight && <StatusPill tone="live" label="服务端推荐" />}
                <StatusPill tone={alt.conditional ? 'confirm' : 'read'} label={alt.conditional ? '有条件' : '无条件'} />
                {alt.status && <span className="text-[12px] text-muted-foreground">{VERDICT[alt.status]?.label ?? alt.status}</span>}
              </div>
              {alt.description && <p className="text-[13px] leading-relaxed text-foreground/80">{alt.description}</p>}
              {alt.tradeoff && (
                <p className="text-[13px] leading-relaxed">
                  <span className="text-muted-foreground">取舍 </span>
                  {alt.tradeoff}
                </p>
              )}
              {alt.reservation_dates.length > 0 && (
                <p className="text-[13px]">
                  <span className="text-muted-foreground">预留日期 </span>
                  <span className="font-mono text-[12.5px]">{alt.reservation_dates.map(formatDate).join('、')}</span>
                </p>
              )}
              <button
                type="button"
                disabled={creating || !executable}
                onClick={() => {
                  setChosen(alt.alternative_id)
                  onSelect(alt)
                }}
                className={cn(
                  'inline-flex h-9 items-center justify-center gap-2 self-start rounded-lg px-3 text-[13px] font-medium transition-colors disabled:opacity-50',
                  highlight ? 'bg-cobalt text-primary-foreground hover:bg-cobalt-ink' : 'border border-border hover:bg-muted',
                )}
              >
                {creating && chosen === alt.alternative_id ? <Spinner className="size-3.5" /> : <Check className="size-3.5" aria-hidden />}
                {executable ? '选择此方案并创建工作流' : '当前方案无需创建预算计划'}
              </button>
            </li>
          )
        })}
      </ul>
      <p className="text-[12.5px] leading-relaxed text-muted-foreground">选择方案会创建一个新的工作流，但不会执行任何节点；每个需授权的节点仍需逐一确认。</p>
    </section>
  )
}

export function LiquidityReport({
  simulation,
  creating,
  onSelect,
}: {
  simulation: LiquiditySimulation
  creating: boolean
  onSelect: (alt: LiquidityAlternative) => void
}) {
  const verdict = simulation.verdict ? VERDICT[simulation.verdict] : null
  const c = simulation.currency
  return (
    <div className="flex flex-col gap-6">
      <div className={cn('flex flex-col gap-2 rounded-lg border p-4', verdict ? TONE[verdict.tone].line : 'border-border', verdict ? TONE[verdict.tone].soft : 'bg-muted')}>
        <p className="text-[12px]">服务端结论</p>
        <p className="text-[22px] font-semibold leading-tight">{verdict?.label ?? simulation.verdict ?? '未返回'}</p>
        {simulation.risk_reason && <p className="text-[13px] leading-relaxed text-foreground/85">{simulation.risk_reason}</p>}
      </div>

      <FieldList
        rows={[
          { label: '起始可用余额', value: formatMoney(simulation.starting_available, c), mono: true },
          { label: '拟锁定预算', value: formatMoney(simulation.proposed_budget, c), mono: true },
          { label: '必要支出缓冲', value: formatMoney(simulation.essential_buffer, c), mono: true },
          { label: '最大安全预算', value: formatMoney(simulation.max_safe_budget, c), mono: true },
          { label: '预测区间', value: simulation.horizon_days ? `${simulation.horizon_days} 天` : '未返回' },
        ]}
      />

      <section className="flex flex-col gap-2">
        <SectionLabel>情景曲线</SectionLabel>
        <LiquidityChart simulation={simulation} />
      </section>

      {simulation.events.length > 0 && (
        <section className="flex flex-col gap-2">
          <SectionLabel>关键现金流事件</SectionLabel>
          <ul className="flex flex-col">
            {simulation.events.map((e, i) => {
              const inbound = e.direction === 'in' || e.direction === 'credit' || e.direction === 'inbound'
              return (
                <li key={`${e.date}-${i}`} className="flex items-baseline justify-between gap-3 border-b border-border py-2 text-[13px] last:border-b-0">
                  <span className="w-14 shrink-0 font-mono text-[12px] text-muted-foreground">{formatDate(e.date)}</span>
                  <span className="min-w-0 flex-1 truncate">{e.label}</span>
                  <span className={cn('font-mono', inbound && 'text-teal-ink')}>
                    {inbound ? '+' : e.direction ? '−' : ''}
                    {formatMoney(e.amount === null ? null : Math.abs(e.amount), c)}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <Alternatives simulation={simulation} creating={creating} onSelect={onSelect} />

      <div className="flex flex-col gap-2">
        <CopyId label="Trace ID" value={simulation.trace_id} />
        <p className="text-[12px] leading-relaxed text-muted-foreground">情景基于账户已知现金流，不代表对未来的准确预测。</p>
        <RawData value={simulation} />
      </div>
    </div>
  )
}

export function LiquidityDrawer({ open, onClose, session, creatingWorkflow, onSelectAlternative }: LiquidityDrawerProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const simulation = session.liquidity

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby="ws-liquidity-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      className="ws-drawer fixed inset-y-0 left-auto right-0 m-0 h-dvh max-h-dvh w-full max-w-[640px] border-l bg-ice p-0 text-foreground backdrop:bg-[rgb(11_20_35/0.32)]"
    >
      {open && <div className="flex h-full flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-card px-6">
          <VaultlineSeal className="size-7 shrink-0" />
          <div className="min-w-0 flex-1">
            <h2 id="ws-liquidity-title" className="text-[16px] font-semibold tracking-tight">
              流动性预检报告
            </h2>
            <p className="truncate text-[13px] text-muted-foreground">由 Agent 发起，银行服务端生成；前端不二次计算</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭流动性预检"
            className="-mr-2 inline-flex size-10 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
          >
            <X className="size-[18px]" aria-hidden />
          </button>
        </header>

        <div className="ws-scroll min-h-0 flex-1 overflow-y-auto">
          <div className="flex flex-col gap-6 px-6 py-6">
            {simulation ? (
              <LiquidityReport
                key={simulation.simulation_id ?? simulation.trace_id ?? 'sim'}
                simulation={simulation}
                creating={creatingWorkflow}
                onSelect={(alt) => onSelectAlternative(simulation, alt)}
              />
            ) : (
              <p className="text-[14px] leading-relaxed text-muted-foreground">
                请先在对话中描述预算和现金流问题。Agent 会调用银行服务端的流动性预检工具。
              </p>
            )}
            {simulation && (
              <button
                type="button"
                onClick={onClose}
                className="self-start text-[13px] font-medium text-cobalt-ink hover:underline"
              >
                关闭报告，返回对话继续追问
              </button>
            )}
          </div>
        </div>
      </div>}
    </dialog>
  )
}
