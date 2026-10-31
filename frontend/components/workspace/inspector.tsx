'use client'

import { cn } from '@/lib/utils'
import type { WorkspaceSession } from '@/lib/vaultline/use-workspace-session'
import { ActionInspector } from './action-inspector'
import { AuditTimeline } from './audit-timeline'

export type InspectorTab = 'action' | 'audit'

const TABS: { id: InspectorTab; label: string }[] = [
  { id: 'action', label: '决策与动作' },
  { id: 'audit', label: '审计链' },
]

const SERVER_OWNED = [
  ['风险评级', '每个候选动作的风险等级'],
  ['确认与 MFA', '与单个 Action ID 绑定'],
  ['执行闸门', '一次性放行，带幂等键'],
  ['业务回执', '只有回执才代表完成'],
  ['审计记录', '按 Trace 追加写入'],
] as const

export function Inspector({
  session,
  tab,
  onTabChange,
  onEditRequest,
  className,
}: {
  session: WorkspaceSession
  tab: InspectorTab
  onTabChange: (tab: InspectorTab) => void
  onEditRequest: (text: string) => void
  className?: string
}) {
  const action = session.activeAction
  const traceId = action?.trace_id ?? session.traces[0] ?? null

  return (
    <aside
      id="ws-panel-console"
      aria-label="控制台"
      className={cn('flex min-h-0 w-full shrink-0 flex-col border-l border-border bg-ice/60 md:w-[372px] xl:w-[400px]', className)}
    >
      <div role="tablist" aria-label="控制台视图" className="flex h-16 shrink-0 items-center gap-1 border-b border-border px-5">
        {TABS.map((t) => {
          const selected = t.id === tab
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`ws-tab-${t.id}`}
              aria-selected={selected}
              aria-controls={`ws-tabpanel-${t.id}`}
              onClick={() => onTabChange(t.id)}
              className={cn(
                'inline-flex h-9 items-center rounded-md px-3 text-[13px] font-medium transition-colors duration-150',
                selected ? 'bg-card text-foreground shadow-[0_0_0_1px_var(--border)]' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      <div
        role="tabpanel"
        id={`ws-tabpanel-${tab}`}
        aria-labelledby={`ws-tab-${tab}`}
        className="ws-scroll flex min-h-0 flex-1 flex-col overflow-y-auto"
      >
        {tab === 'action' &&
          (action ? (
            <ActionInspector key={action.action_id} action={action} session={session} onEditRequest={onEditRequest} />
          ) : (
            <div className="flex flex-col gap-6 px-5 py-6">
              <div className="flex flex-col gap-2">
                <h2 className="text-[18px] font-semibold tracking-tight">尚无候选动作</h2>
                <p className="text-pretty text-[14px] leading-relaxed text-muted-foreground">
                  发起转账、付款、申购或锁定预算后，服务端冻结的动作快照和授权步骤会显示在这里。
                </p>
              </div>
              <dl className="flex flex-col border-t border-border">
                {SERVER_OWNED.map(([term, detail]) => (
                  <div key={term} className="flex items-baseline justify-between gap-4 border-b border-border py-3">
                    <dt className="text-[14px] font-medium">{term}</dt>
                    <dd className="text-right text-[13px] text-muted-foreground">{detail}</dd>
                  </div>
                ))}
              </dl>
              <p className="text-[13px] leading-relaxed text-muted-foreground">以上环节均由银行服务端裁决，助理无法跳过或代为完成。</p>
            </div>
          ))}

        {tab === 'audit' && (
          <div className="px-5 py-6">
            {traceId ? (
              <AuditTimeline key={traceId} adapter={session.adapter} traceId={traceId} />
            ) : (
              <p className="text-[14px] leading-relaxed text-muted-foreground">产生服务端响应后，可在此查看对应 Trace 的审计事件。</p>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
