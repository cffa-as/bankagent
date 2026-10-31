'use client'

import { ArrowLeft, GitBranch, MessagesSquare, ScrollText } from 'lucide-react'
import Link from 'next/link'
import { VaultlineSeal } from '@/components/vaultline/seal'
import { cn } from '@/lib/utils'

export type WorkspaceView = 'assistant' | 'workflows' | 'audit'

export const VIEWS: { id: WorkspaceView; label: string; icon: typeof MessagesSquare }[] = [
  { id: 'assistant', label: '助理', icon: MessagesSquare },
  { id: 'workflows', label: '工作流', icon: GitBranch },
  { id: 'audit', label: '审计', icon: ScrollText },
]

export function NavRail({ view, onChange }: { view: WorkspaceView; onChange: (view: WorkspaceView) => void }) {
  return (
    <nav aria-label="工作台导航" className="hidden w-[72px] shrink-0 flex-col items-center bg-rail py-4 text-rail-foreground md:flex">
      <Link href="/" aria-label="返回 Vaultline 首页" className="mb-6 rounded-full">
        <VaultlineSeal tone="reverse" className="size-9" />
      </Link>
      <ul className="flex flex-col gap-1">
        {VIEWS.map(({ id, label, icon: Icon }) => {
          const active = view === id
          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onChange(id)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex w-14 flex-col items-center gap-1 rounded-md py-2.5 text-[12px] transition-colors duration-150 focus-visible:outline-rail-accent',
                  active ? 'bg-rail-hover text-rail-foreground' : 'text-rail-muted hover:text-rail-foreground',
                )}
              >
                {active && <span className="absolute -left-2 inset-y-2.5 w-0.5 rounded-full bg-cobalt" aria-hidden />}
                <Icon className="size-[18px]" aria-hidden />
                {label}
              </button>
            </li>
          )
        })}
      </ul>
      <Link
        href="/"
        className="mt-auto inline-flex size-10 items-center justify-center rounded-md text-rail-muted transition-colors hover:bg-rail-hover hover:text-rail-foreground"
        aria-label="返回首页"
        title="返回首页"
      >
        <ArrowLeft className="size-4" aria-hidden />
      </Link>
    </nav>
  )
}
