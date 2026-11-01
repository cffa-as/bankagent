'use client'

import { BellRing, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { VaultlineSeal } from '@/components/vaultline/seal'
import { cn } from '@/lib/utils'
import { describeKind, formatMoney } from '@/lib/vaultline/format'
import { describeStatus } from '@/lib/vaultline/status'
import type { BankAction, LiquidityAlternative, LiquiditySimulation } from '@/lib/vaultline/types'
import { useWorkflows } from '@/lib/vaultline/use-workflows'
import { useWorkspaceSession } from '@/lib/vaultline/use-workspace-session'
import { actionAmount, actionCurrency, actionTarget } from './action-snapshot'
import { AuditView } from './audit-view'
import { Composer, type ComposerHandle } from './composer'
import { ConversationHeader } from './conversation-header'
import { EmptyState } from './empty-state'
import { Inspector } from './inspector'
import { LiquidityDrawer } from './liquidity-drawer'
import { NavRail, VIEWS, type WorkspaceView } from './nav-rail'
import { Thread } from './thread'
import { WorkflowView } from './workflow-view'

function pendingSummary(action: BankAction) {
  const amount = actionAmount(action)
  const target = actionTarget(action)
  return [describeKind(action.kind), target, amount !== null ? formatMoney(amount, actionCurrency(action)) : null]
    .filter(Boolean)
    .join(' · ')
}

export function WorkspaceShell() {
  const session = useWorkspaceSession()
  const [view, setView] = useState<WorkspaceView>('assistant')
  const [panelOpen, setPanelOpen] = useState(false)
  const [liquidityOpen, setLiquidityOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const workflows = useWorkflows(session.adapter, view === 'workflows' || session.connection === 'connected')
  const scrollRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<ComposerHandle>(null)
  const lastLiquidityRef = useRef(session.liquidity)
  const lastActionIdRef = useRef(session.activeActionId)

  const action = session.activeAction
  const attentionTone = describeStatus(action?.status).tone
  const attention = attentionTone === 'confirm' || attentionTone === 'mfa'
  const pendingLabel = action && attention ? pendingSummary(action) : null

  useEffect(() => {
    const el = scrollRef.current
    if (!el || view !== 'assistant') return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ top: session.thread.length ? el.scrollHeight : 0, behavior: reduce ? 'auto' : 'smooth' })
  }, [session.activity.length, session.thread.length, session.sending, view])

  // A message that returns a fresh liquidity simulation opens the report automatically.
  useEffect(() => {
    if (session.liquidity && session.liquidity !== lastLiquidityRef.current && session.thread.length > 0) {
      const last = session.thread[session.thread.length - 1]
      if (last.role === 'assistant' && last.result.liquidity) setLiquidityOpen(true)
    }
    lastLiquidityRef.current = session.liquidity
  }, [session.liquidity, session.thread])

  // A newly created action that needs the customer opens the confirmation panel on desktop.
  useEffect(() => {
    if (session.activeActionId && session.activeActionId !== lastActionIdRef.current && attention) {
      if (window.matchMedia('(min-width: 768px)').matches) setPanelOpen(true)
    }
    lastActionIdRef.current = session.activeActionId
  }, [session.activeActionId, attention])

  // Plan nodes settle through the action panel, so a status change there must
  // re-read the plan; otherwise the DAG keeps showing the node as pending.
  const refreshWorkflowDetail = workflows.detail.mutate
  const refreshWorkflowList = workflows.list.mutate
  useEffect(() => {
    if (view !== 'workflows' || !action?.status) return
    void refreshWorkflowDetail()
    void refreshWorkflowList()
  }, [action?.action_id, action?.status, view, refreshWorkflowDetail, refreshWorkflowList])

  const switchView = (next: WorkspaceView) => {
    setView(next)
    if (window.matchMedia('(max-width: 767px)').matches) setPanelOpen(false)
  }

  const inspectAction = async (actionId: string) => {
    const known = session.actions[actionId]
    if (known) session.adoptAction(known)
    else {
      try {
        session.adoptAction(await session.adapter.getAction(actionId))
      } catch {
        return
      }
    }
    setPanelOpen(true)
  }

  const openWorkflow = (workflowId: string) => {
    workflows.setSelectedId(workflowId)
    switchView('workflows')
  }

  const advanceWorkflow = async (workflowId: string) => {
    const result = await workflows.advance(workflowId)
    if (!result) return
    session.rememberTrace(result.trace_id)
    if (result.action) {
      session.adoptAction(result.action)
      setPanelOpen(true)
    }
    if (result.liquidity) {
      session.setLiquidity(result.liquidity)
      setLiquidityOpen(true)
    }
  }

  const selectAlternative = async (simulation: LiquiditySimulation, alt: LiquidityAlternative) => {
    if (alt.reservations.length === 0) return
    const start = new Date(simulation.start_at ?? Date.now())
    const horizon = simulation.horizon_days ?? 30
    const deadline = new Date(start.getTime() + (horizon + 1) * 86_400_000).toISOString()
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai' }).format(new Date())
    const nodes = alt.reservations.map((reservation, index) => ({
      node_id: `liquidity_lock_${index + 1}`,
      kind: 'budget_lock' as const,
      amount_minor: Math.round(reservation.amount * 100),
      due_at: reservation.date === today ? new Date().toISOString() : `${reservation.date}T09:00:00+08:00`,
      ...(index === 0 ? {} : { depends_on: [`liquidity_lock_${index}`] }),
    }))
    const created = await workflows.create(
      {
        purpose: `流动性方案：${alt.label}`.slice(0, 200),
        deadline,
        nodes,
      },
      `${simulation.simulation_id ?? simulation.trace_id}:${alt.alternative_id}`,
    )
    if (!created) return
    session.rememberTrace(created.trace_id)
    setLiquidityOpen(false)
    switchView('workflows')
  }

  const editRequest = (text: string) => {
    setDraft(text)
    setView('assistant')
    setPanelOpen(false)
    requestAnimationFrame(() => composerRef.current?.focus())
  }

  const resetSession = () => {
    session.reset()
    setPanelOpen(false)
  }

  const showPanel = Boolean(action) && panelOpen

  return (
    <div className="fixed inset-0 flex h-dvh overflow-hidden bg-background">
      <NavRail
        view={view}
        onChange={switchView}
        onNewSession={resetSession}
        canReset={session.thread.length > 0}
        connection={session.connection}
        pendingLabel={pendingLabel}
        onOpenPending={() => setPanelOpen(true)}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-3 md:hidden">
          <Link href="/" aria-label="返回 Vaultline 首页" className="inline-flex size-10 shrink-0 items-center justify-center rounded-md">
            <VaultlineSeal className="size-7" />
          </Link>
          <nav aria-label="工作台导航" className="flex items-center gap-1">
            {VIEWS.map(({ id, label, icon: Icon }) => {
              const active = view === id
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => switchView(id)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-[13px] transition-colors',
                    active ? 'bg-ice font-medium text-cobalt-ink' : 'text-muted-foreground',
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {label}
                </button>
              )
            })}
          </nav>
        </header>

        <div className="flex min-h-0 flex-1">
          <main id="ws-panel-main" className="flex min-h-0 min-w-0 flex-1 flex-col">
            {view === 'assistant' && (
              <section aria-label="智能助理" className="flex min-h-0 flex-1 flex-col">
                <ConversationHeader title="智能助理" onNewSession={session.thread.length > 0 ? resetSession : undefined} />
                <div ref={scrollRef} className="ws-scroll min-h-0 flex-1 overflow-y-auto">
                  <div className="mx-auto w-full max-w-[760px] px-4 py-6 sm:px-8 sm:py-8">
                    {session.thread.length === 0 ? (
                      <EmptyState disabled={session.sending} onPick={session.send} />
                    ) : (
                      <Thread
                        session={session}
                        onInspectAction={(id) => void inspectAction(id)}
                        onOpenLiquidity={() => setLiquidityOpen(true)}
                        onOpenWorkflow={openWorkflow}
                      />
                    )}
                  </div>
                </div>
                <div className="shrink-0 px-4 pb-4 pt-2 sm:px-8 sm:pb-5">
                  <div className="mx-auto flex w-full max-w-[760px] flex-col gap-2">
                    {pendingLabel && !showPanel && (
                      <button
                        type="button"
                        onClick={() => setPanelOpen(true)}
                        className="flex items-center gap-3 rounded-lg border border-amber/50 bg-amber-soft px-3.5 py-2.5 text-left text-amber-ink md:hidden"
                      >
                        <BellRing className="size-4 shrink-0" aria-hidden />
                        <span className="min-w-0 flex-1 truncate text-[13px]">
                          <span className="font-medium">待你确认</span> · {pendingLabel}
                        </span>
                        <ChevronRight className="size-4 shrink-0" aria-hidden />
                      </button>
                    )}
                    <Composer ref={composerRef} value={draft} onChange={setDraft} onSend={session.send} sending={session.sending} />
                  </div>
                </div>
              </section>
            )}

            {view === 'workflows' && (
              <div className="ws-scroll min-h-0 flex-1 overflow-y-auto">
                <WorkflowView workflows={workflows} onOpenAction={(id) => void inspectAction(id)} onAdvance={(id) => void advanceWorkflow(id)} />
              </div>
            )}

            {view === 'audit' && (
              <div className="ws-scroll min-h-0 flex-1 overflow-y-auto">
                <AuditView session={session} />
              </div>
            )}
          </main>

          {action && (
            <Inspector
              session={session}
              action={action}
              onClose={() => setPanelOpen(false)}
              onEditRequest={editRequest}
              className={cn('max-md:fixed max-md:inset-0 max-md:z-40 max-md:border-l-0', !showPanel && 'hidden')}
            />
          )}
        </div>
      </div>

      <LiquidityDrawer
        open={liquidityOpen}
        onClose={() => setLiquidityOpen(false)}
        session={session}
        creatingWorkflow={workflows.pending === 'create'}
        onSelectAlternative={(sim, alt) => void selectAlternative(sim, alt)}
      />
    </div>
  )
}
