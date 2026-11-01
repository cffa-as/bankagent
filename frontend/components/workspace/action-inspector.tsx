'use client'

import { Clock, KeyRound, PencilLine, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react'
import { useEffect, useId, useState, type FormEvent } from 'react'
import { cn } from '@/lib/utils'
import { SYNTHETIC_ENVIRONMENT } from '@/lib/vaultline/api'
import { formatField, formatRemaining, labelField, shortId } from '@/lib/vaultline/format'
import { describeStatus } from '@/lib/vaultline/status'
import type { BankAction } from '@/lib/vaultline/types'
import type { GateError, WorkspaceSession } from '@/lib/vaultline/use-workspace-session'
import { ActionEvidence, ActionHeading, SnapshotFields, actionCurrency, confirmLabel } from './action-snapshot'
import { Callout, FieldList, SectionLabel, Spinner } from './primitives'

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
      {error.code && <p className="mt-1 font-mono text-[12px] text-muted-foreground">错误码 {error.code}</p>}
    </Callout>
  )
}

function RiskNotice({ action }: { action: BankAction }) {
  const tone = describeStatus(action.status).tone
  if (tone === 'confirm') {
    return (
      <div className="flex gap-3 rounded-lg bg-amber-soft px-3.5 py-3 text-amber-ink">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p className="text-[13px] leading-relaxed">请仔细核对以下信息。确认后银行才会执行，信息如有变化将需要重新确认。</p>
      </div>
    )
  }
  if (tone === 'mfa') {
    return (
      <div className="flex gap-3 rounded-lg bg-red-soft px-3.5 py-3 text-red-ink">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p className="text-[13px] leading-relaxed">这笔业务风险等级较高，需要完成安全验证。验证码仅对本笔业务有效。</p>
      </div>
    )
  }
  return null
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
      <Callout tone="mfa" title="本笔业务已锁定">
        <p>验证失败次数已达上限，为保护账户安全，本笔业务已停止办理。如仍需办理，请在对话中重新发起。</p>
      </Callout>
    )
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" aria-labelledby={`${inputId}-title`}>
      <div className="flex items-center justify-between gap-3">
        <h3 id={`${inputId}-title`} className="flex items-center gap-2 text-[14px] font-medium">
          <KeyRound className="size-4 text-red-ink" aria-hidden />
          输入 6 位动态验证码
        </h3>
        <span className={cn('font-mono text-[12.5px]', remaining !== null && remaining < 60000 ? 'text-red-ink' : 'text-muted-foreground')}>
          {remaining === null ? '' : formatRemaining(remaining)}
        </span>
      </div>
      <label htmlFor={inputId} className="sr-only">
        6 位动态验证码
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
        placeholder="······"
        aria-describedby={hintId}
        disabled={busy || expired}
        className="h-12 w-full rounded-lg border border-input bg-background px-3 text-center font-mono text-[20px] tracking-[0.6em] outline-none transition-colors focus:border-cobalt focus:bg-card disabled:opacity-60"
      />
      <p id={hintId} className="text-[12.5px] text-muted-foreground">
        {failures > 0 ? (
          <span className="text-red-ink">验证码有误，还可尝试 {attemptsLeft} 次。</span>
        ) : (
          <>还可尝试 {attemptsLeft} 次。</>
        )}
        {SYNTHETIC_ENVIRONMENT && <> 测试环境验证码为 <code className="font-mono">000000</code>。</>}
      </p>
      <button
        type="submit"
        disabled={code.length !== 6 || busy || expired}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-cobalt px-4 text-[15px] font-medium text-primary-foreground transition-colors hover:bg-cobalt-ink disabled:cursor-not-allowed disabled:opacity-50"
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
      <Callout tone="held" title="暂未收到银行回执">
        <p>办理结果仍在确认中，请稍后刷新查看，或在操作记录中核对。</p>
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
    <div className="flex flex-col gap-2 rounded-lg border border-teal/40 bg-teal-soft px-4 py-3">
      <p className="flex items-center gap-2 text-[14px] font-medium text-teal-ink">
        <ShieldCheck className="size-4" aria-hidden />
        办理成功
      </p>
      <FieldList rows={rows} />
    </div>
  )
}

function Outcome({ action }: { action: BankAction }) {
  switch (action.status) {
    case 'executing':
    case 'processing':
      return (
        <div role="status" className="flex items-start gap-3 rounded-lg bg-ice px-4 py-3">
          <Spinner className="mt-0.5 text-cobalt" />
          <div>
            <p className="text-[14px] font-medium text-cobalt-ink">{describeStatus(action.status).label}</p>
            <p className="text-[13px] leading-relaxed text-muted-foreground">银行正在处理，请勿重复操作。结果以银行回执为准。</p>
          </div>
        </div>
      )
    case 'reconciliation_required':
      return (
        <Callout tone="held" title="结果确认中">
          <p>办理结果暂未确定，请勿重复发起。银行完成对账后会自动更新。</p>
        </Callout>
      )
    case 'succeeded':
      return <Receipt action={action} />
    case 'failed':
      return (
        <Callout tone="fail" title="办理未成功">
          <p>{action.error?.message ?? '银行未能完成本笔业务，账户未发生变化。'}</p>
          {action.error?.code && <p className="mt-1 font-mono text-[12px]">错误码 {action.error.code}</p>}
        </Callout>
      )
    case 'cancelled':
      return (
        <Callout tone="void" title="已取消">
          <p>本笔业务已取消，账户未发生变化。</p>
        </Callout>
      )
    case 'expired':
      return (
        <Callout tone="void" title="已超时">
          <p>超过确认时限，本笔业务已自动失效，账户未发生变化。</p>
        </Callout>
      )
    case 'scheduled':
      return (
        <Callout tone="live" title="已预约">
          <p>将按计划时间执行，执行前可随时取消。</p>
        </Callout>
      )
    default:
      if (describeStatus(action.status).tone === 'neutral') {
        return (
          <Callout tone="neutral" title={describeStatus(action.status).label}>
            <p>暂时无法显示此状态，请刷新后查看。</p>
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
      <div className="flex flex-1 flex-col gap-5 px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <ActionHeading action={action} />
          <button
            type="button"
            onClick={() => void session.refreshAction()}
            aria-label="刷新状态"
            title="刷新状态"
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
          >
            <RefreshCw className="size-4" aria-hidden />
          </button>
        </div>

        <RiskNotice action={action} />

        <section className="flex flex-col gap-1" aria-labelledby="ws-snapshot-title">
          <SectionLabel>
            <span id="ws-snapshot-title">业务信息</span>
          </SectionLabel>
          <SnapshotFields action={action} />
        </section>

        <GateErrorCallout error={session.gateError} />

        {awaitingMfa && <MfaStep key={action.action_id} action={action} session={session} remaining={remaining} />}

        <Outcome action={action} />

        {(cancellable || status === 'expired' || status === 'failed') && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={editRequest}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-[13px] font-medium transition-colors hover:border-line-strong"
            >
              <PencilLine className="size-3.5" aria-hidden />
              {status === 'expired' || status === 'failed' ? '重新发起' : '修改信息'}
            </button>
            {status === 'scheduled' && (
              <button
                type="button"
                onClick={() => void session.trigger()}
                disabled={busy}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-border px-3 text-[13px] font-medium transition-colors hover:border-line-strong disabled:opacity-50"
              >
                {session.pendingGate === 'trigger' && <Spinner className="size-3.5" />}
                立即执行
              </button>
            )}
            {cancellable && (
              <button
                type="button"
                onClick={() => void session.cancel()}
                disabled={busy}
                className="inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-red-ink transition-colors hover:bg-red-soft disabled:opacity-50"
              >
                {session.pendingGate === 'cancel' && <Spinner className="size-3.5" />}
                取消办理
              </button>
            )}
          </div>
        )}

        <div className="mt-auto border-t border-border pt-4">
          <ActionEvidence action={action} />
        </div>
      </div>

      {awaitingConfirm && (
        <div className="sticky bottom-0 flex flex-col gap-2 border-t border-border bg-card px-5 py-4">
          {remaining !== null && (
            <p className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground">
              <Clock className="size-3.5" aria-hidden />
              请在
              <span className={cn('font-mono', remaining < 60000 ? 'text-red-ink' : 'text-foreground')}>{formatRemaining(remaining)}</span>
              内完成确认
            </p>
          )}
          <button
            type="button"
            onClick={() => void session.confirm()}
            disabled={busy || (remaining !== null && remaining <= 0)}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-cobalt px-4 text-[15px] font-medium text-primary-foreground transition-colors duration-150 hover:bg-cobalt-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            {session.pendingGate === 'confirm' && <Spinner />}
            {confirmLabel(action)}
          </button>
          <p className="sr-only">业务编号 {shortId(action.action_id)}</p>
        </div>
      )}
    </div>
  )
}
