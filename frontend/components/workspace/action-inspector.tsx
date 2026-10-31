'use client'

import { KeyRound, PencilLine, RefreshCw } from 'lucide-react'
import { useEffect, useId, useState, type FormEvent } from 'react'
import { cn } from '@/lib/utils'
import { SYNTHETIC_ENVIRONMENT } from '@/lib/vaultline/api'
import { formatField, formatRemaining, labelField, shortId } from '@/lib/vaultline/format'
import { describeStatus } from '@/lib/vaultline/status'
import type { BankAction } from '@/lib/vaultline/types'
import type { GateError, WorkspaceSession } from '@/lib/vaultline/use-workspace-session'
import { ActionEvidence, ActionHeading, SnapshotFields, actionCurrency, confirmLabel } from './action-snapshot'
import { Callout, FieldList, RawData, SectionLabel, Spinner } from './primitives'

const MFA_MAX_ATTEMPTS = 3

function useCountdown(expiresAt: string | null, active: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active || !expiresAt) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [active, expiresAt])
  if (!expiresAt) return null
  const end = new Date(expiresAt).getTime()
  return Number.isNaN(end) ? null : end - now
}

function GateErrorCallout({ error }: { error: GateError | null }) {
  if (!error) return null
  return (
    <Callout tone={error.state.tone} title={error.state.title}>
      <p>{error.state.body}</p>
      {error.code && <p className="mt-1 font-mono text-[12px] text-muted-foreground">{error.code}</p>}
    </Callout>
  )
}

function MfaStep({
  action,
  session,
  remaining,
}: {
  action: BankAction
  session: WorkspaceSession
  remaining: number | null
}) {
  const inputId = useId()
  const hintId = useId()
  const [code, setCode] = useState('')
  const busy = session.pendingGate === 'mfa'
  const failures = action.mfa?.failed_attempts ?? session.mfaFailures[action.action_id] ?? 0
  const attemptsLeft = action.mfa?.attempts_remaining ?? Math.max(0, MFA_MAX_ATTEMPTS - failures)
  const locked = action.mfa?.locked || session.gateError?.code === 'MFA_LOCKED'
  const expired = remaining !== null && remaining <= 0

  function submit(event: FormEvent) {
    event.preventDefault()
    if (code.length !== 6 || busy || locked || expired) return
    const value = code
    setCode('')
    void session.verifyMfa(value)
  }

  if (locked) {
    return (
      <Callout tone="mfa" title="此动作已锁定">
        <p>安全验证失败次数达到上限，服务端已锁定 Action {shortId(action.action_id)}。请通过对话重新发起请求。</p>
      </Callout>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-lg border border-red/35 bg-card p-4" aria-labelledby={`${inputId}-title`}>
      <div className="flex items-center gap-2">
        <KeyRound className="size-4 text-red-ink" aria-hidden />
        <h3 id={`${inputId}-title`} className="text-[14px] font-medium">
          安全验证
        </h3>
      </div>
      <p className="text-[13px] leading-relaxed text-muted-foreground">
        验证码仅绑定此动作 <code className="font-mono text-foreground">{shortId(action.action_id, 16)}</code>
        ，不可用于其他请求。
      </p>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
        <span>
          <span className="text-muted-foreground">剩余时间 </span>
          <span className={cn('font-mono', remaining !== null && remaining < 60000 ? 'text-red-ink' : 'text-foreground')}>
            {remaining === null ? '未返回' : formatRemaining(remaining)}
          </span>
        </span>
        <span>
          <span className="text-muted-foreground">已失败 </span>
          <span className={cn('font-mono', failures > 0 && 'text-red-ink')}>
            {failures} / {MFA_MAX_ATTEMPTS}
          </span>
        </span>
        <span>
          <span className="text-muted-foreground">可再尝试 </span>
          <span className="font-mono">{attemptsLeft}</span>
        </span>
      </div>
      <label htmlFor={inputId} className="sr-only">
        6 位安全验证码
      </label>
      <input
        id={inputId}
        name="mfa_code"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        spellCheck={false}
        maxLength={6}
        placeholder="••••••"
        aria-describedby={SYNTHETIC_ENVIRONMENT ? hintId : undefined}
        disabled={busy || expired}
        className="h-11 w-full rounded-lg border border-input bg-background px-3 text-center font-mono text-[18px] tracking-[0.5em] outline-none transition-colors focus:border-cobalt disabled:opacity-60"
      />
      {SYNTHETIC_ENVIRONMENT && (
        <p id={hintId} className="text-[12.5px] text-muted-foreground">
          合成环境：验证码为 <code className="font-mono">000000</code>
        </p>
      )}
      <button
        type="submit"
        disabled={code.length !== 6 || busy || expired}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-cobalt px-4 text-[14px] font-medium text-primary-foreground transition-colors hover:bg-cobalt-ink disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy && <Spinner />}
        验证并继续
      </button>
    </form>
  )
}

function Receipt({ action }: { action: BankAction }) {
  if (!action.receipt) {
    return (
      <Callout tone="held" title="未收到业务回执">
        <p>状态显示完成，但服务端未返回业务回执，界面不将其视为成功。请刷新或在审计中核对。</p>
      </Callout>
    )
  }
  const currency = actionCurrency(action)
  const rows = Object.entries(action.receipt)
    .filter(([, v]) => v !== null && typeof v !== 'object')
    .map(([k, v]) => {
      const f = formatField(k, v, currency)
      return { label: labelField(k), value: f.text, mono: f.mono }
    })
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-teal/40 bg-teal-soft p-4">
      <p className="text-[14px] font-medium text-teal-ink">服务端已返回回执</p>
      <FieldList rows={rows} />
    </div>
  )
}

function Outcome({ action, session }: { action: BankAction; session: WorkspaceSession }) {
  switch (action.status) {
    case 'executing':
    case 'processing':
      return (
        <div role="status" className="flex items-start gap-3 rounded-lg border border-cobalt/30 bg-card p-4">
          <Spinner className="mt-0.5 text-cobalt" />
          <div>
            <p className="text-[14px] font-medium">{describeStatus(action.status).label}</p>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              正在向服务端轮询最新状态。授权已完成不代表交易成功，请以回执为准。
            </p>
          </div>
        </div>
      )
    case 'reconciliation_required':
      return (
        <Callout tone="held" title="等待对账 · 账户状态待确认">
          <p>执行结果尚未确定。请勿重复发起，服务端完成对账后会更新此动作。</p>
        </Callout>
      )
    case 'succeeded':
      return <Receipt action={action} />
    case 'failed':
      return (
        <Callout tone="fail" title="未完成">
          <p>{action.error?.message ?? '银行处理未成功完成，服务端未返回业务回执。'}</p>
          {action.error?.code && <p className="mt-1 font-mono text-[12px]">{action.error.code}</p>}
        </Callout>
      )
    case 'cancelled':
      return (
        <Callout tone="void" title="已取消">
          <p>该动作已在服务端取消，未产生资金变动。</p>
        </Callout>
      )
    case 'expired':
      return (
        <Callout tone="void" title="已过期">
          <p>该动作已超过有效期，未产生资金变动。请重新发起请求。</p>
        </Callout>
      )
    case 'scheduled':
      return (
        <Callout tone="live" title="已预约">
          <p>服务端已登记预约，将按计划时间执行。执行前仍可取消。</p>
        </Callout>
      )
    default:
      if (describeStatus(action.status).tone === 'neutral') {
        return (
          <Callout tone="neutral" title={describeStatus(action.status).label}>
            <p>界面无法识别此状态，不会推断结果。</p>
          </Callout>
        )
      }
      return null
  }
}

export function ActionInspector({
  action,
  session,
  onEditRequest,
}: {
  action: BankAction
  session: WorkspaceSession
  onEditRequest: (text: string) => void
}) {
  const status = action.status
  const awaitingConfirm = status === 'awaiting_confirmation'
  const awaitingMfa = status === 'awaiting_mfa'
  const cancellable = awaitingConfirm || awaitingMfa || status === 'scheduled'
  const remaining = useCountdown(action.expires_at, awaitingConfirm || awaitingMfa)
  const busy = session.pendingGate !== null
  const editRequest = () => onEditRequest(session.requestTextFor(action.action_id))

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex flex-1 flex-col gap-6 px-5 py-6">
        <div className="flex items-start justify-between gap-3">
          <ActionHeading action={action} />
          <button
            type="button"
            onClick={() => void session.refreshAction()}
            aria-label="刷新动作状态"
            title="刷新动作状态"
            className="inline-flex size-10 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-card hover:text-foreground"
          >
            <RefreshCw className="size-4" aria-hidden />
          </button>
        </div>

        <section className="flex flex-col gap-2" aria-labelledby="ws-snapshot-title">
          <div className="flex items-baseline justify-between gap-3">
            <SectionLabel>
              <span id="ws-snapshot-title">动作快照</span>
            </SectionLabel>
            <span className="text-[12px] text-muted-foreground">服务端锁定 · 只读</span>
          </div>
          <SnapshotFields action={action} />
        </section>

        <GateErrorCallout error={session.gateError} />

        {awaitingMfa && <MfaStep key={action.action_id} action={action} session={session} remaining={remaining} />}

        <Outcome action={action} session={session} />

        {(cancellable || status === 'expired' || status === 'failed') && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={editRequest}
              className="inline-flex h-10 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-[13px] font-medium transition-colors hover:border-line-strong"
            >
              <PencilLine className="size-3.5" aria-hidden />
              {status === 'expired' || status === 'failed' ? '重新发起请求' : '修改请求'}
            </button>
            {status === 'scheduled' && (
              <button
                type="button"
                onClick={() => void session.trigger()}
                disabled={busy}
                className="inline-flex h-10 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-[13px] font-medium transition-colors hover:border-line-strong disabled:opacity-50"
              >
                {session.pendingGate === 'trigger' && <Spinner className="size-3.5" />}
                立即执行预约
              </button>
            )}
            {cancellable && (
              <button
                type="button"
                onClick={() => void session.cancel()}
                disabled={busy}
                className="inline-flex h-10 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium text-red-ink transition-colors hover:bg-red-soft disabled:opacity-50"
              >
                {session.pendingGate === 'cancel' && <Spinner className="size-3.5" />}
                取消此动作
              </button>
            )}
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-border pt-4">
          <ActionEvidence action={action} />
          <RawData value={{ ...action }} />
        </div>
      </div>

      {awaitingConfirm && (
        <div className="sticky bottom-0 flex flex-col gap-2 border-t border-border bg-ice px-5 py-4">
          {remaining !== null && (
            <p className="text-[13px] text-muted-foreground">
              授权窗口剩余{' '}
              <span className={cn('font-mono', remaining < 60000 ? 'text-red-ink' : 'text-foreground')}>{formatRemaining(remaining)}</span>
            </p>
          )}
          <button
            type="button"
            onClick={() => void session.confirm()}
            disabled={busy || (remaining !== null && remaining <= 0)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-cobalt px-4 text-[15px] font-medium text-primary-foreground transition-colors duration-150 hover:bg-cobalt-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            {session.pendingGate === 'confirm' && <Spinner />}
            {confirmLabel(action)}
          </button>
        </div>
      )}
    </div>
  )
}
