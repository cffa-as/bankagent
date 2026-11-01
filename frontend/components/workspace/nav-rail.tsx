'use client'

import { BellRing, CalendarClock, ChevronRight, History, MessagesSquare, Plus, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import { VaultlineLockup } from '@/components/vaultline/seal'
import { cn } from '@/lib/utils'
import type { ConnectionState } from '@/lib/vaultline/use-workspace-session'

export type WorkspaceView = 'assistant' | 'workflows' | 'audit'

export const VIEWS: { id: WorkspaceView; label: string; icon: typeof MessagesSquare }[] = [
  { id: 'assistant', label: '智能助理', icon: MessagesSquare },
  { id: 'workflows', label: '资金计划', icon: CalendarClock },
  { id: 'audit', label: '操作记录', icon: History },
]

const CONNECTION: Record<ConnectionState, { label: string; dot: string }> = {
  idle: { label: '安全通道就绪', dot: 'bg-steel' },
  connected: { label: '已安全连接', dot: 'bg-teal' },
  unavailable: { label: '服务暂不可用', dot: 'bg-red' },
}

interface NavRailProps {
  view: WorkspaceView
  onChange: (view: WorkspaceView) => void
  onNewSession: () => void
  canReset: boolean
  connection: ConnectionState
  pendingLabel: string | null
  onOpenPending: () => void
}

export function NavRail({ view, onChange, onNewSession, canReset, connection, pendingLabel, onOpenPending }: NavRailProps) {
  const c = CONNECTION[connection]
  return (
    <aside aria-label="工作台导航" className="hidden w-[248px] shrink-0 flex-col border-r border-border bg-card md:flex">
      <div className="flex h-16 items-center px-5">
        <Link href="/" aria-label="返回 Vaultline 首页" className="rounded-md">
          <VaultlineLockup descriptor="银行助理" />
        </Link>
      </div>

      <div className="px-3">
        <button
          type="button"
          onClick={onNewSession}
          disabled={!canReset}
          className="flex h-10 w-full items-center gap-2 rounded-lg border border-border px-3 text-[14px] font-medium transition-colors hover:border-line-strong hover:bg-background disabled:cursor-default disabled:opacity-60 disabled:hover:border-border disabled:hover:bg-transparent"
        >
          <Plus className="size-4 text-steel" aria-hidden />
          新对话
        </button>
      </div>

      <nav aria-label="主功能" className="mt-4 px-3">
        <ul className="flex flex-col gap-0.5">
          {VIEWS.map(({ id, label, icon: Icon }) => {
            const active = view === id
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => onChange(id)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex h-10 w-full items-center gap-3 rounded-lg px-3 text-[14px] transition-colors duration-150',
                    active ? 'bg-ice font-medium text-cobalt-ink' : 'text-muted-foreground hover:bg-background hover:text-foreground',
                  )}
                >
                  <Icon className="size-[18px]" aria-hidden />
                  {label}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      {pendingLabel && (
        <div className="mt-6 px-3">
          <button
            type="button"
            onClick={onOpenPending}
            className="flex w-full items-start gap-3 rounded-lg border border-amber/50 bg-amber-soft p-3 text-left transition-colors hover:border-amber"
          >
            <BellRing className="mt-0.5 size-4 shrink-0 text-amber-ink" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-medium text-amber-ink">1 笔业务待你处理</span>
              <span className="mt-0.5 block truncate text-[12px] text-amber-ink/80">{pendingLabel}</span>
            </span>
            <ChevronRight className="mt-0.5 size-4 shrink-0 text-amber-ink" aria-hidden />
          </button>
        </div>
      )}

      <div className="mt-auto flex flex-col gap-3 border-t border-border px-5 py-4">
        <p className="flex items-center gap-2 text-[12px] text-muted-foreground" role="status">
          <span className={cn('size-1.5 rounded-full', c.dot)} aria-hidden />
          {c.label}
        </p>
        <p className="flex gap-2 text-[12px] leading-5 text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-teal-ink" aria-hidden />
          Vaultline 不会以任何形式索要你的登录密码或验证码。
        </p>
      </div>
    </aside>
  )
}
