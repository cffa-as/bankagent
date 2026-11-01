'use client'

import { Search } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import { cn } from '@/lib/utils'
import { shortId } from '@/lib/vaultline/format'
import type { WorkspaceSession } from '@/lib/vaultline/use-workspace-session'
import { AuditTimeline } from './audit-timeline'
import { SectionLabel } from './primitives'

export function AuditView({ session }: { session: WorkspaceSession }) {
  const inputId = useId()
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const traceId = selected ?? session.traces[0] ?? null

  function lookup(event: FormEvent) {
    event.preventDefault()
    const id = query.trim()
    if (id) setSelected(id)
  }

  return (
    <div className="flex flex-col gap-6 px-5 py-6 sm:px-8">
      <div>
        <h2 className="text-[20px] font-semibold tracking-tight">操作记录</h2>
        <p className="text-[13px] text-muted-foreground">查看每笔业务从发起、风险评估、确认、安全验证到银行回执的完整记录。</p>
      </div>

      <form onSubmit={lookup} className="flex gap-2">
        <label htmlFor={inputId} className="sr-only">
          业务流水号
        </label>
        <input
          id={inputId}
          name="trace_id"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoComplete="off"
          placeholder="输入流水号，如 tr_…"
          spellCheck={false}
          className="h-10 min-w-0 flex-1 rounded-lg border border-input bg-card px-3 font-mono text-[13.5px] outline-none focus:border-cobalt"
        />
        <button
          type="submit"
          className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[13px] font-medium transition-colors hover:bg-muted"
        >
          <Search className="size-4" aria-hidden />
          查询
        </button>
      </form>

      {session.traces.length > 0 && (
        <div className="flex flex-col gap-2">
          <SectionLabel>本次会话的业务</SectionLabel>
          <ul className="flex flex-wrap gap-2">
            {session.traces.map((id) => (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => setSelected(id)}
                  aria-pressed={id === traceId}
                  className={cn(
                    'rounded-md border px-2.5 py-1 font-mono text-[12px] transition-colors',
                    id === traceId ? 'border-cobalt bg-ice text-cobalt-ink' : 'border-border bg-card hover:bg-muted',
                  )}
                >
                  {shortId(id, 16)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="max-w-2xl rounded-lg border border-border bg-ice p-5">
        {traceId ? (
          <AuditTimeline key={traceId} adapter={session.adapter} traceId={traceId} />
        ) : (
          <p className="text-[13.5px] text-muted-foreground">在智能助理中办理业务后，记录会显示在这里。</p>
        )}
      </div>
    </div>
  )
}
