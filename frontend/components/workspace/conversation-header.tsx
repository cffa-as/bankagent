'use client'

import { SquarePen } from 'lucide-react'

export function ConversationHeader({ title, onNewSession }: { title: string; onNewSession?: () => void }) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur sm:px-8">
      <h1 className="truncate text-[15px] font-semibold">{title}</h1>
      {onNewSession && (
        <button
          type="button"
          onClick={onNewSession}
          className="inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-[13px] text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
        >
          <SquarePen className="size-4" aria-hidden />
          <span className="md:hidden">新对话</span>
          <span className="hidden md:inline">清空并新建</span>
        </button>
      )}
    </header>
  )
}
