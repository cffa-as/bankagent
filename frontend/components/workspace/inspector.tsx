'use client'

import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { describeStatus } from '@/lib/vaultline/status'
import type { BankAction } from '@/lib/vaultline/types'
import type { WorkspaceSession } from '@/lib/vaultline/use-workspace-session'
import { ActionInspector } from './action-inspector'

function panelTitle(action: BankAction) {
  const tone = describeStatus(action.status).tone
  if (tone === 'confirm') return '请核对并确认'
  if (tone === 'mfa') return '安全验证'
  return '业务详情'
}

export function Inspector({
  session,
  action,
  onClose,
  onEditRequest,
  className,
}: {
  session: WorkspaceSession
  action: BankAction
  onClose: () => void
  onEditRequest: (text: string) => void
  className?: string
}) {
  return (
    <aside
      id="ws-panel-console"
      aria-label="业务办理"
      className={cn('flex min-h-0 w-full shrink-0 flex-col border-l border-border bg-card md:w-[384px] xl:w-[412px]', className)}
    >
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-5">
        <h2 className="text-[15px] font-semibold">{panelTitle(action)}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="关闭"
          className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <div className="ws-scroll flex min-h-0 flex-1 flex-col overflow-y-auto">
        <ActionInspector key={action.action_id} action={action} session={session} onEditRequest={onEditRequest} />
      </div>
    </aside>
  )
}
