import { FileCheck2, KeyRound, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { BankAction } from '@/lib/vaultline/types'

type Tone = 'verified' | 'pending' | 'blocked' | 'neutral'

const TONE: Record<Tone, string> = {
  verified: 'border-teal/35 bg-teal-soft text-teal-ink',
  pending: 'border-amber/35 bg-amber-soft text-amber-ink',
  blocked: 'border-red/35 bg-red-soft text-red-ink',
  neutral: 'border-border bg-background text-muted-foreground',
}

function sourceCopy(action: BankAction) {
  const source = action.security?.source
  if (!source) return { title: '输入检查未返回', detail: '无法确认输入边界', tone: 'neutral' as Tone }
  if (!source.injection_checked) return { title: '输入检查缺失', detail: '动作不得被视为已确认安全', tone: 'blocked' as Tone }
  if (source.trust === 'untrusted') {
    return { title: '不可信输入已隔离', detail: source.sanitized ? '隐藏字符已清理 · 注入规则已检查' : '注入规则已检查', tone: 'verified' as Tone }
  }
  return { title: '结构化请求已验证', detail: '来源与参数经过服务端校验', tone: 'verified' as Tone }
}

function identityCopy(action: BankAction) {
  const identity = action.security?.identity
  if (!identity || identity.state === 'not_required') return { title: '无需额外授权', detail: '只读查询', tone: 'neutral' as Tone }
  switch (identity.state) {
    case 'verified':
      return {
        title: identity.method === 'action_bound_mfa' ? '动作绑定 MFA 已通过' : '用户确认已完成',
        detail: identity.method === 'action_bound_mfa' ? '一次性执行门仍会复核快照' : '动作执行前仍会复核快照',
        tone: 'verified' as Tone,
      }
    case 'required':
      return {
        title: identity.method === 'action_bound_mfa' ? '等待动作 MFA' : '等待用户确认',
        detail: identity.attempts_remaining !== null && identity.method === 'action_bound_mfa' ? `剩余 ${identity.attempts_remaining} 次` : '尚未获得执行授权',
        tone: 'pending' as Tone,
      }
    case 'locked':
      return { title: '安全验证已锁定', detail: '本笔动作已停止', tone: 'blocked' as Tone }
    case 'not_verified':
      return { title: '授权未完成', detail: '动作未进入执行门', tone: 'blocked' as Tone }
    case 'failed':
      return { title: '授权失败', detail: '账户与业务状态保持不变', tone: 'blocked' as Tone }
    default:
      return { title: '授权状态处理中', detail: '以服务端最终状态为准', tone: 'neutral' as Tone }
  }
}

function outcomeCopy(action: BankAction) {
  switch (action.security?.outcome.receipt) {
    case 'verified':
      return { title: '银行回执已验证', detail: '结果来自业务工具，不采用模型自述', tone: 'verified' as Tone }
    case 'pending':
      return { title: '等待银行回执', detail: '回执到达前不会显示办理成功', tone: 'pending' as Tone }
    case 'not_issued':
      return { title: '未产生业务回执', detail: '业务未执行，账户状态应保持不变', tone: 'blocked' as Tone }
    case 'missing':
      return { title: '缺少业务回执', detail: '不得把当前状态展示为成功', tone: 'blocked' as Tone }
    default:
      return { title: '回执状态未返回', detail: '结果必须等待服务端裁决', tone: 'neutral' as Tone }
  }
}

export function SecurityPassport({ action }: { action: BankAction }) {
  if (!action.security) return null
  const items = [
    { icon: ShieldCheck, label: 'SOURCE', ...sourceCopy(action) },
    { icon: KeyRound, label: 'IDENTITY', ...identityCopy(action) },
    { icon: FileCheck2, label: 'RECEIPT', ...outcomeCopy(action) },
  ]
  return (
    <section aria-label="可信执行凭证" className="rounded-xl border border-border bg-card p-3.5">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <p className="text-[13px] font-medium">可信执行凭证</p>
        <span className="font-mono text-[10.5px] tracking-[0.12em] text-muted-foreground">SERVER-AUTHORED</span>
      </div>
      <div className="grid gap-2">
        {items.map(({ icon: Icon, label, title, detail, tone }) => (
          <div key={label} className={cn('flex items-start gap-2.5 rounded-lg border px-3 py-2.5', TONE[tone])}>
            <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div className="min-w-0">
              <p className="font-mono text-[10px] font-semibold tracking-[0.14em] opacity-70">{label}</p>
              <p className="text-[12.5px] font-medium leading-snug">{title}</p>
              <p className="text-[11.5px] leading-snug opacity-75">{detail}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
