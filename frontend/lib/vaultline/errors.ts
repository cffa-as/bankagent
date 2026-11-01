import { asNumber } from './normalize'
import type { Tone } from './status'
import type { VaultlineApiError } from './api'

export interface SafeErrorState {
  title: string
  body: string
  tone: Tone
  /** The same request can be retried with the same idempotency key. */
  retryable: boolean
  /** The action is dead; the user must create a new request through the composer. */
  requiresNewRequest: boolean
}

const CODE_STATES: Record<string, Omit<SafeErrorState, 'body'> & { body: string }> = {
  ACTION_EXPIRED: {
    title: '动作已过期',
    body: '该动作已超过有效期，未产生任何资金变动。请重新发起请求。',
    tone: 'void',
    retryable: false,
    requiresNewRequest: true,
  },
  MFA_INVALID: {
    title: '验证码不正确',
    body: '验证码不正确，请核对后重新输入。',
    tone: 'mfa',
    retryable: false,
    requiresNewRequest: false,
  },
  MFA_LOCKED: {
    title: '此动作已锁定',
    body: '验证失败次数过多，本笔业务已锁定，请重新发起。',
    tone: 'mfa',
    retryable: false,
    requiresNewRequest: true,
  },
  SECURITY_LOCKED: {
    title: '写操作暂时受限',
    body: '资金类业务暂时无法办理，查询功能仍可正常使用。',
    tone: 'mfa',
    retryable: false,
    requiresNewRequest: false,
  },
  INSUFFICIENT_BALANCE: {
    title: '可用余额不足',
    body: '可用余额不足，账户未发生任何变化。',
    tone: 'fail',
    retryable: false,
    requiresNewRequest: true,
  },
  TOOL_FAILED: {
    title: '未完成',
    body: '银行未能完成本笔业务，账户未发生变化。',
    tone: 'fail',
    retryable: false,
    requiresNewRequest: true,
  },
  TOOL_REJECTED: {
    title: '未完成',
    body: '银行拒绝了本笔业务，账户未发生变化。',
    tone: 'fail',
    retryable: false,
    requiresNewRequest: true,
  },
  EXECUTION_UNKNOWN: {
    title: '等待对账',
    body: '执行结果尚未确定，账户状态待确认。请勿重复发起，银行对账完成后会自动更新。',
    tone: 'held',
    retryable: false,
    requiresNewRequest: false,
  },
}

export function mapApiError(error: VaultlineApiError): SafeErrorState {
  if (error.kind === 'unavailable') {
    return {
      title: '暂时无法连接银行服务',
      body: '请求未发送成功，账户未发生任何变化，可以放心重新发送。',
      tone: 'fail',
      retryable: true,
      requiresNewRequest: false,
    }
  }
  const known = error.code ? CODE_STATES[error.code] : undefined
  if (known) {
    if (error.code === 'MFA_INVALID') {
      const remaining = asNumber(error.details?.attempts_remaining ?? error.details?.remaining_attempts)
      return { ...known, body: remaining !== null ? `验证码不正确，还可尝试 ${remaining} 次。` : known.body }
    }
    return known
  }
  if (error.kind === 'invalid') {
    return {
      title: '响应无法识别',
      body: '暂时无法识别银行返回的结果，请稍后在操作记录中查看。',
      tone: 'fail',
      retryable: true,
      requiresNewRequest: false,
    }
  }
  return {
    title: '请求未被受理',
    body: error.message,
    tone: 'fail',
    retryable: false,
    requiresNewRequest: false,
  }
}
