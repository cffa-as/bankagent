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
    body: '服务端未通过本次验证，请核对后重新输入。',
    tone: 'mfa',
    retryable: false,
    requiresNewRequest: false,
  },
  MFA_LOCKED: {
    title: '此动作已锁定',
    body: '安全验证失败次数过多，服务端已锁定该动作。请重新发起请求。',
    tone: 'mfa',
    retryable: false,
    requiresNewRequest: true,
  },
  SECURITY_LOCKED: {
    title: '写操作暂时受限',
    body: '服务端已暂时阻止资金类操作，查询类功能仍可使用。',
    tone: 'mfa',
    retryable: false,
    requiresNewRequest: false,
  },
  INSUFFICIENT_BALANCE: {
    title: '可用余额不足',
    body: '服务端判定可用余额不足，账户未发生任何变化。',
    tone: 'fail',
    retryable: false,
    requiresNewRequest: true,
  },
  TOOL_FAILED: {
    title: '未完成',
    body: '银行处理未成功完成，服务端未返回业务回执。',
    tone: 'fail',
    retryable: false,
    requiresNewRequest: true,
  },
  TOOL_REJECTED: {
    title: '未完成',
    body: '银行处理被拒绝，服务端未返回业务回执。',
    tone: 'fail',
    retryable: false,
    requiresNewRequest: true,
  },
  EXECUTION_UNKNOWN: {
    title: '等待对账',
    body: '执行结果尚未确定，账户状态待确认。请勿重复发起，服务端对账后会更新状态。',
    tone: 'held',
    retryable: false,
    requiresNewRequest: false,
  },
}

export function mapApiError(error: VaultlineApiError): SafeErrorState {
  if (error.kind === 'unavailable') {
    return {
      title: '银行服务端不可用',
      body: '请求未送达服务端，未产生任何变化。可以使用同一幂等键安全重试。',
      tone: 'fail',
      retryable: true,
      requiresNewRequest: false,
    }
  }
  const known = error.code ? CODE_STATES[error.code] : undefined
  if (known) {
    if (error.code === 'MFA_INVALID') {
      const remaining = asNumber(error.details?.attempts_remaining ?? error.details?.remaining_attempts)
      return { ...known, body: remaining !== null ? `服务端未通过本次验证，还可尝试 ${remaining} 次。` : known.body }
    }
    return known
  }
  if (error.kind === 'invalid') {
    return {
      title: '响应无法识别',
      body: '服务端响应格式与约定不一致，界面不会推断结果。',
      tone: 'fail',
      retryable: true,
      requiresNewRequest: false,
    }
  }
  return {
    title: '服务端未接受请求',
    body: error.message,
    tone: 'fail',
    retryable: false,
    requiresNewRequest: false,
  }
}
