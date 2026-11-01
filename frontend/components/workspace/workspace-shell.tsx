'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { VaultlineSeal } from '@/components/vaultline/seal'
import { cn } from '@/lib/utils'
import { describeStatus } from '@/lib/vaultline/status'
import type { LiquidityAlternative, LiquiditySimulation } from '@/lib/vaultline/types'
import { useWorkflows } from '@/lib/vaultline/use-workflows'
import { useWorkspaceSession } from '@/lib/vaultline/use-workspace-session'
import { AuditView } from './audit-view'
import { Composer, type ComposerHandle } from './composer'
import { ConversationHeader } from './conversation-header'
import { EmptyState } from './empty-state'
import { Inspector, type InspectorTab } from './inspector'
import { LiquidityDrawer } from './liquidity-drawer'
import { NavRail, VIEWS, type WorkspaceView } from './nav-rail'
import { Thread } from './thread'
import { WorkflowView } from './workflow-view'

type MobilePane = 'main' | 'console'

export function WorkspaceShell() {
  const session = useWorkspaceSession()
  const [view, setView] = useState<WorkspaceView>('assistant')
  const [mobilePane, setMobilePane] = useState<MobilePane>('main')
  const [tab, setTab] = useState<InspectorTab>('action')
  const [liquidityOpen, setLiquidityOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const workflows = useWorkflows(session.adapter, view === 'workflows' || session.connection === 'connected')
  const scrollRef = useRef<HTMLDivElement>(null)
  const composerRef = useRef<ComposerHandle>(null)
  const lastLiquidityRef = useRef(session.liquidity)

  const attentionTone = describeStatus(session.activeAction?.status).tone
  const attention = attentionTone === 'confirm' || attentionTone === 'mfa'

  useEffect(() => {
    const el = scrollRef.current
    if (!el || view !== 'assistant') return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ top: session.thread.length ? el.scrollHeight : 0, behavior: reduce ? 'auto' : 'smooth' })
  }, [session.thread.length, session.sending, view])

  // A message that returns a fresh liquidity simulation opens the report automatically.
  useEffect(() => {
    if (session.liquidity && session.liquidity !== lastLiquidityRef.current && session.thread.length > 0) {
      const last = session.thread[session.thread.length - 1]
      if (last.role === 'assistant' && last.result.liquidity) setLiquidityOpen(true)
    }
    lastLiquidityRef.current = session.liquidity
  }, [session.liquidity, session.thread])

  const switchView = (next: WorkspaceView) => {
    setView(next)
    setMobilePane('main')
  }

  const openConsole = (nextTab: InspectorTab = 'action') => {
    setTab(nextTab)
    setMobilePane('console')
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
    openConsole('action')
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
      openConsole('action')
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
    const today = new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Shanghai'}).format(new Date())
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
    switchView('assistant')
    requestAnimationFrame(() => composerRef.current?.focus())
  }

  const consoleActive = mobilePane === 'console'

  return (
    <div className="fixed inset-0 flex h-dvh flex-col overflow-hidden bg-background md:flex-row">
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-card px-3 md:hidden">
        <Link href="/" aria-label="返回 Vaultline 首页" className="inline-flex size-10 shrink-0 items-center justify-center rounded-md">
          <VaultlineSeal className="size-7" />
        </Link>
        <div role="tablist" aria-label="工作台面板" className="flex h-10 flex-1 items-center rounded-md bg-surface p-1">
          {(
            [
              { id: 'main', label: '对话' },
              { id: 'console', label: '控制台' },
            ] as const
          ).map((pane) => {
            const selected = mobilePane === pane.id
            return (
              <button
                key={pane.id}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={pane.id === 'main' ? 'ws-panel-main' : 'ws-panel-console'}
                onClick={() => (pane.id === 'console' ? openConsole(tab) : setMobilePane('main'))}
                className={cn(
                  'relative flex h-8 flex-1 items-center justify-center rounded text-[13px] font-medium transition-colors',
                  selected ? 'bg-card text-foreground shadow-[0_0_0_1px_var(--border)]' : 'text-muted-foreground',
                )}
              >
                {pane.id === 'main' ? (VIEWS.find((v) => v.id === view)?.label ?? pane.label) : pane.label}
                {pane.id === 'console' && attention && !selected && (
                  <span className="ml-1.5 size-1.5 rounded-full bg-amber" aria-label="有待处理的授权" />
                )}
              </button>
            )
          })}
        </div>
        <nav aria-label="工作台导航" className="flex shrink-0 items-center">
          {VIEWS.map(({ id, label, icon: Icon }) => {
            const active = view === id && !consoleActive
            return (
              <button
                key={id}
                type="button"
                onClick={() => switchView(id)}
                aria-label={label}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'inline-flex size-10 items-center justify-center rounded-md transition-colors',
                  active ? 'bg-ice text-cobalt-ink' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="size-[18px]" aria-hidden />
              </button>
            )
          })}
        </nav>
      </header>

      <NavRail view={view} onChange={switchView} />

      <div className="flex min-h-0 min-w-0 flex-1">
        <main id="ws-panel-main" className={cn('flex min-h-0 min-w-0 flex-1 flex-col bg-background', consoleActive && 'max-md:hidden')}>
          {view === 'assistant' && (
            <section aria-label="助理" className="flex min-h-0 flex-1 flex-col">
              <ConversationHeader
                connection={session.connection}
                onNewSession={session.thread.length > 0 ? session.reset : undefined}
              />
              <div ref={scrollRef} className="ws-scroll min-h-0 flex-1 overflow-y-auto">
                <div className="mx-auto w-full max-w-[780px] px-4 py-6 sm:px-8 sm:py-8">
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
                <div className="mx-auto w-full max-w-[780px]">
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

        <Inspector
          session={session}
          tab={tab}
          onTabChange={setTab}
          onEditRequest={editRequest}
          className={cn(!consoleActive && 'max-md:hidden')}
        />
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
