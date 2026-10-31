'use client'

import { ChartLine, SquarePen } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ConnectionState } from '@/lib/vaultline/use-workspace-session'

const CONNECTION: Record<ConnectionState, { label: string; dot: string }> = {
  idle: { label: '待连接，发送首条消息时建立会话', dot: 'bg-steel' },
  connected: { label: '已连接银行服务端', dot: 'bg-teal' },
  unavailable: { label: '银行服务端不可达', dot: 'bg-red' },
}

export function ConversationHeader({
  connection,
  onNewSession,
  onOpenLiquidity,
}: {
  connection: ConnectionState
  onNewSession?: () => void
  onOpenLiquidity: () => void
}) {
  const c = CONNECTION[connection]
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border px-4 sm:px-8">
      <div className="min-w-0">
        <h1 className="truncate text-[16px] font-semibold tracking-tight">Vaultline 助理</h1>
        <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted-foreground" role="status">
          <span className={cn('size-1.5 shrink-0 rounded-full', c.dot)} aria-hidden />
          <span className="truncate">{c.label}</span>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onOpenLiquidity}
          className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-card px-3 text-[13px] font-medium transition-colors hover:border-line-strong"
        >
          <ChartLine className="size-4 text-muted-foreground" aria-hidden />
          <span className="hidden sm:inline">流动性预检</span>
          <span className="sr-only sm:hidden">流动性预检</span>
        </button>
        {onNewSession && (
          <button
            type="button"
            onClick={onNewSession}
            aria-label="新会话"
            title="新会话"
            className="inline-flex size-10 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
          >
            <SquarePen className="size-4" aria-hidden />
          </button>
        )}
      </div>
    </header>
  )
}
