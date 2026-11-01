'use client'

import { ArrowRight, Bell, Lock, RefreshCw, ShoppingBag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDateTime, formatMoney, shortId } from '@/lib/vaultline/format'
import { describeWorkflowStatus, TONE } from '@/lib/vaultline/status'
import type { Workflow, WorkflowNode } from '@/lib/vaultline/types'
import type { WorkflowsState } from '@/lib/vaultline/use-workflows'
import { Callout, CopyId, RiskBadge, SectionLabel, Spinner, StatusPill } from './primitives'

const NODE_META: Record<string, { label: string; icon: typeof Lock; mode: string }> = {
  budget_lock: { label: '预算锁定', icon: Lock, mode: '需 MFA' },
  reminder: { label: '提醒', icon: Bell, mode: '自动' },
  external_order: { label: '外部下单', icon: ShoppingBag, mode: '需授权' },
}

/** Display fallback only when the server omits `risk_level` on a node. */
function nodeRisk(node: WorkflowNode) {
  if (node.risk_level) return node.risk_level
  if (node.kind === 'budget_lock') return 'red'
  if (node.kind === 'reminder') return 'green'
  if (node.kind === 'external_order') return node.amount !== null && node.amount <= 1000 ? 'yellow' : 'red'
  return null
}

function layers(nodes: WorkflowNode[]) {
  const byId = new Map(nodes.map((n) => [n.node_id, n]))
  const depth = new Map<string, number>()
  const visit = (n: WorkflowNode, trail: Set<string>): number => {
    if (depth.has(n.node_id)) return depth.get(n.node_id) as number
    if (trail.has(n.node_id)) return 0
    trail.add(n.node_id)
    const d = n.depends_on.reduce((max, id) => {
      const parent = byId.get(id)
      return parent ? Math.max(max, visit(parent, trail) + 1) : max
    }, 0)
    depth.set(n.node_id, d)
    return d
  }
  nodes.forEach((n) => visit(n, new Set()))
  const result: WorkflowNode[][] = []
  nodes.forEach((n) => {
    const d = depth.get(n.node_id) ?? 0
    ;(result[d] ??= []).push(n)
  })
  return result.filter(Boolean)
}

function NodeCard({ node, nodes, currency, onOpenAction }: { node: WorkflowNode; nodes: WorkflowNode[]; currency: string; onOpenAction: (id: string) => void }) {
  const meta = NODE_META[node.kind] ?? { label: node.kind, icon: ArrowRight, mode: '' }
  // The server only advances a ready node once its due time has passed.
  const notYetDue = node.status === 'ready' && node.due_at !== null && new Date(node.due_at).getTime() > Date.now()
  const status = notYetDue ? { label: '到期后办理', tone: 'neutral' as const } : describeWorkflowStatus(node.status)
  const Icon = meta.icon
  const deps = node.depends_on.map((id) => nodes.find((n) => n.node_id === id)?.label ?? NODE_META[nodes.find((n) => n.node_id === id)?.kind ?? '']?.label ?? shortId(id, 8))
  return (
    <li className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className={cn('size-2 shrink-0 rounded-full', TONE[status.tone].dot)} aria-hidden />
        <Icon className="size-4 shrink-0 text-steel" aria-hidden />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-medium">{node.label ?? meta.label}</p>
          <p className="truncate text-[13px] text-muted-foreground">
            {meta.label}
            {meta.mode && ` · ${meta.mode}`}
            {deps.length > 0 && ` · 依赖 ${deps.join('、')}`}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pl-5 sm:pl-0">
        <RiskBadge level={nodeRisk(node)} />
        <StatusPill tone={status.tone} label={status.label} />
        <span className="w-28 text-right font-mono text-[13px]">{node.amount !== null ? formatMoney(node.amount, currency) : '—'}</span>
        <span className="w-28 text-right font-mono text-[12.5px] text-muted-foreground">{node.due_at ? formatDateTime(node.due_at) : '无到期'}</span>
        {node.action_id && (
          <button
            type="button"
            onClick={() => onOpenAction(node.action_id as string)}
            aria-label={`在控制台查看动作 ${shortId(node.action_id)}`}
            className="inline-flex h-10 items-center rounded-md px-2 text-[13px] font-medium text-cobalt-ink hover:bg-ice"
          >
            查看动作
          </button>
        )}
      </div>
    </li>
  )
}

export function WorkflowDag({ workflow, onOpenAction }: { workflow: Workflow; onOpenAction: (id: string) => void }) {
  const groups = layers(workflow.nodes)
  if (groups.length === 0) return <p className="text-[13px] text-muted-foreground">暂无步骤。</p>
  return (
    <ol className="flex flex-col gap-4" aria-label="计划步骤">
      {groups.map((group, i) => (
        <li key={i} className="relative flex gap-4">
          <div className="flex w-6 shrink-0 flex-col items-center" aria-hidden>
            <span className="flex size-6 items-center justify-center rounded-full border border-cobalt/50 bg-card font-mono text-[12px] text-cobalt-ink">
              {i + 1}
            </span>
            {i < groups.length - 1 && <span className="-mb-4 mt-1 w-px flex-1 bg-cobalt/40" />}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <p className="text-[13px] text-muted-foreground">{i === 0 ? '可立即办理' : `在第 ${i} 步完成后办理`}</p>
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card">
              {group.map((node) => (
                <NodeCard key={node.node_id} node={node} nodes={workflow.nodes} currency={workflow.currency} onOpenAction={onOpenAction} />
              ))}
            </ul>
          </div>
        </li>
      ))}
    </ol>
  )
}

export function WorkflowView({
  workflows,
  onOpenAction,
  onAdvance,
  onCancel,
}: {
  workflows: WorkflowsState
  onOpenAction: (id: string) => void
  onAdvance: (workflowId: string) => void
  onCancel: (workflowId: string) => void
}) {
  const { list, detail, selectedId, setSelectedId, pending, error } = workflows
  const items = list.data ?? []
  const workflow = detail.data ?? items.find((w) => w.workflow_id === selectedId) ?? null
  const status = describeWorkflowStatus(workflow?.status)
  const terminal = ['completed', 'succeeded', 'cancelled', 'failed'].includes(workflow?.status ?? '')

  return (
    <div className="flex flex-col gap-6 px-5 py-6 sm:px-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-semibold tracking-tight">资金计划</h2>
          <p className="text-[13px] text-muted-foreground">按计划分步办理。创建计划不会立即动用资金，每一步执行前都需你确认。</p>
        </div>
        <button
          type="button"
          onClick={() => void list.mutate()}
          aria-label="刷新计划列表"
          className="inline-flex size-10 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
        >
          <RefreshCw className={cn('size-4', list.isValidating && 'animate-spin')} aria-hidden />
        </button>
      </div>

      {list.error && (
        <Callout tone="fail" title="暂时无法读取资金计划">
          <p>服务暂时不可用，请稍后重试。</p>
        </Callout>
      )}

      {!list.error && !list.isLoading && items.length === 0 && (
        <div className="flex flex-col gap-1 rounded-lg border border-border bg-card px-5 py-6">
          <p className="text-[15px] font-medium">还没有资金计划</p>
          <p className="text-pretty text-[14px] leading-relaxed text-muted-foreground">在流动性预检中选择一个方案，或在对话中描述跨场景需求。</p>
        </div>
      )}

      {items.length > 0 && (
        <ul className="flex flex-col divide-y divide-border rounded-lg border border-border bg-card" aria-label="资金计划列表">
          {items.map((w) => {
            const s = describeWorkflowStatus(w.status)
            const active = w.workflow_id === selectedId
            return (
              <li key={w.workflow_id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(w.workflow_id)}
                  aria-current={active}
                  className={cn('flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-muted', active && 'bg-ice')}
                >
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-medium">{w.title ?? '未命名计划'}</p>
                    <p className="font-mono text-[12px] text-muted-foreground">
                      {shortId(w.workflow_id)} · {w.nodes.length} 个步骤 · {formatDateTime(w.created_at)}
                    </p>
                  </div>
                  <StatusPill tone={s.tone} label={s.label} />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {workflow && (
        <section className="flex flex-col gap-4" aria-labelledby="ws-workflow-title">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 id="ws-workflow-title" className="text-[16px] font-semibold">
                {workflow.title ?? '计划详情'}
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <StatusPill tone={status.tone} label={status.label} />
                <CopyId label="计划编号" value={workflow.workflow_id} />
              </div>
            </div>
            {!terminal && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onCancel(workflow.workflow_id)}
                  disabled={pending !== null}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-red-ink transition-colors hover:bg-red-soft disabled:opacity-50"
                >
                  {pending === 'cancel' && <Spinner className="size-3.5" />}
                  取消计划
                </button>
                <button
                  type="button"
                  onClick={() => onAdvance(workflow.workflow_id)}
                  disabled={pending !== null}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-cobalt px-3 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-cobalt-ink disabled:opacity-50"
                >
                  {pending === 'advance' && <Spinner className="size-3.5" />}
                  办理下一步
                </button>
              </div>
            )}
          </div>

          {error && (
            <Callout tone={error.tone} title={error.title}>
              <p>{error.body}</p>
            </Callout>
          )}

          <SectionLabel>办理步骤</SectionLabel>
          <WorkflowDag workflow={workflow} onOpenAction={onOpenAction} />
          {workflow.trace_id && workflow.trace_id !== 'tr_workflow' && <CopyId label="流水号" value={workflow.trace_id} />}
        </section>
      )}
      {detail.isLoading && selectedId && !workflow && (
        <p role="status" className="flex items-center gap-2 text-[13px] text-muted-foreground">
          <Spinner /> 正在读取计划…
        </p>
      )}
    </div>
  )
}
