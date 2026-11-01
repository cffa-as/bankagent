'use client'

import { Check, ChevronRight, Copy, Eye, LoaderCircle, Lock, ShieldAlert } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { describeRisk, TONE, type Tone } from '@/lib/vaultline/status'

export function StatusPill({ tone, label, className }: { tone: Tone; label: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium leading-none',
        TONE[tone].soft,
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full', TONE[tone].dot)} aria-hidden />
      {label}
    </span>
  )
}

const RISK_ICON = { read: Eye, confirm: ShieldAlert, mfa: Lock } as const

export function RiskBadge({ level, className }: { level: string | null | undefined; className?: string }) {
  const risk = describeRisk(level)
  const Icon = RISK_ICON[risk.tone as keyof typeof RISK_ICON] ?? ShieldAlert
  return (
    <span
      className={cn(
        'inline-flex h-6 shrink-0 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium leading-none',
        TONE[risk.tone].soft,
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {risk.label}
    </span>
  )
}

export function CopyId({ label, value, className }: { label: string; value: string | null | undefined; className?: string }) {
  const [copied, setCopied] = useState(false)
  if (!value) {
    return (
      <span className={cn('inline-flex items-center gap-2 text-[13px] text-muted-foreground', className)}>
        <span>{label}</span>
        <span>未返回</span>
      </span>
    )
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(value as string)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      setCopied(false)
    }
  }
  return (
    <span className={cn('inline-flex min-w-0 items-center gap-2 text-[13px]', className)}>
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <code className="min-w-0 truncate font-mono text-[12.5px] text-foreground" title={value}>
        {value}
      </code>
      <button
        type="button"
        onClick={copy}
        aria-label={`复制 ${label}`}
        className="inline-flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        {copied ? <Check className="size-3.5 text-teal-ink" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
        <span className="sr-only" aria-live="polite">
          {copied ? '已复制' : ''}
        </span>
      </button>
    </span>
  )
}

export function FieldList({ rows, className }: { rows: { label: string; value: ReactNode; mono?: boolean }[]; className?: string }) {
  return (
    <dl className={cn('flex flex-col', className)}>
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline justify-between gap-4 border-b border-border py-2 last:border-b-0">
          <dt className="shrink-0 text-[13px] text-muted-foreground">{row.label}</dt>
          <dd className={cn('min-w-0 text-right text-[14px] text-foreground [overflow-wrap:anywhere]', row.mono && 'font-mono text-[13px]')}>
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={cn('text-[12px] font-medium tracking-wide text-muted-foreground', className)}>{children}</h3>
}

export function Disclosure({ summary, children, className }: { summary: string; children: ReactNode; className?: string }) {
  return (
    <details className={cn('group', className)}>
      <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded text-[13px] text-muted-foreground transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" aria-hidden />
        {summary}
      </summary>
      <div className="mt-2">{children}</div>
    </details>
  )
}

export function RawData({ value }: { value: unknown }) {
  if (value === null || value === undefined) return null
  return (
    <Disclosure summary="查看原始数据">
      <pre className="ws-scroll max-h-72 overflow-auto rounded-lg border border-border bg-muted p-3 font-mono text-[12px] leading-relaxed text-foreground">
        {JSON.stringify(value, null, 2)}
      </pre>
    </Disclosure>
  )
}

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle className={cn('size-4 animate-spin', className)} aria-hidden />
}

export function Callout({ tone, title, children }: { tone: Tone; title: string; children?: ReactNode }) {
  return (
    <div role="status" className={cn('rounded-lg border px-3.5 py-3', TONE[tone].line, TONE[tone].soft)}>
      <p className="text-[14px] font-medium">{title}</p>
      {children && <div className="mt-1 text-[13px] leading-relaxed text-foreground/80">{children}</div>}
    </div>
  )
}
