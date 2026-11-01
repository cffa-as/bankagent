const CURRENCY_SYMBOL: Record<string, string> = { CNY: '¥', USD: '$', HKD: 'HK$', EUR: '€' }

const amountFormatter = new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const compactFormatter = new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 })

export function formatMoney(value: number | null | undefined, currency = 'CNY') {
  if (value === null || value === undefined || !Number.isFinite(value)) return '未返回'
  const sign = value < 0 ? '-' : ''
  return `${sign}${CURRENCY_SYMBOL[currency] ?? `${currency} `}${amountFormatter.format(Math.abs(value))}`
}

export function formatCompactMoney(value: number, currency = 'CNY') {
  return `${CURRENCY_SYMBOL[currency] ?? ''}${compactFormatter.format(value)}`
}

const pad = (n: number) => String(n).padStart(2, '0')

function toDate(value: string | null | undefined) {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export function formatDateTime(value: string | null | undefined) {
  const d = toDate(value)
  if (!d) return value ?? '未返回'
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatDate(value: string | null | undefined) {
  const d = toDate(value)
  if (!d) return value ?? '未返回'
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function formatTime(value: string | null | undefined) {
  const d = toDate(value)
  if (!d) return value ?? ''
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function formatRemaining(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const clock = `${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`
  if (days > 0) return `${days} 天 ${pad(hours)}:${clock}`
  if (hours > 0) return `${pad(hours)}:${clock}`
  return clock
}

export function shortId(id: string | null | undefined, keep = 12) {
  if (!id) return '未返回'
  return id.length > keep + 2 ? `${id.slice(0, keep)}…` : id
}

/** Basis points → "2.85%". Always framed as a benchmark, never as a promised return. */
export function formatBps(value: number | null) {
  return value === null ? '未返回' : `${(value / 100).toFixed(2)}%`
}

export const ACTION_KIND_LABELS: Record<string, string> = {
  transfer: '转账',
  transfer_split: 'AA 收款',
  payment: '付款',
  bill_payment: '账单还款',
  investment_purchase: '理财申购',
  investment_redemption: '理财赎回',
  investment_redeem: '理财赎回',
  invest: '理财申购',
  card_freeze: '冻结卡片',
  card_unfreeze: '解冻卡片',
  card_limit_change: '调整卡片额度',
  card_application: '申请虚拟卡',
  card_status_change: '变更卡片状态',
  card_control: '卡片管控',
  subscription_cancel: '取消订阅',
  cancel_subscription: '取消订阅',
  budget_lock: '锁定预算',
  external_order: '外部下单',
  reminder: '提醒',
  workflow_budget_lock: '锁定预算',
  workflow_external_order: '外部下单',
  workflow: '跨场景工作流',
}

export function describeKind(kind: string | null | undefined) {
  if (!kind) return '银行动作'
  return ACTION_KIND_LABELS[kind] ?? kind
}

export const FIELD_LABELS: Record<string, string> = {
  amount: '金额',
  currency: '币种',
  beneficiary: '收款方',
  beneficiary_name: '收款方',
  payee: '收款方',
  payee_name: '收款方',
  beneficiary_account: '收款账户',
  beneficiary_account_id: '收款账户',
  beneficiary_phone: '收款手机号',
  payee_account: '收款账户',
  from_account: '付款账户',
  account_id: '账户',
  remark: '备注',
  memo: '备注',
  purpose: '用途',
  product: '产品',
  product_id: '产品编号',
  product_name: '产品',
  card: '卡片',
  card_id: '卡片编号',
  card_last4: '卡号尾号',
  masked_number: '卡号',
  new_limit: '新额度',
  limit: '额度',
  subscription: '订阅',
  subscription_id: '订阅编号',
  merchant: '商户',
  workflow_id: '工作流',
  scheduled_at: '预约时间',
  execute_at: '执行时间',
  daily_outgoing_before_minor: '今日已转出',
  transaction_id: '交易编号',
  term_days: '期限（天）',
  total_amount: 'AA 总额',
  collectible: '待收金额',
  holding_id: '持仓编号',
  principal: '本金',
  profit: '收益',
  total: '到账金额',
  annual_rate_bps: '业绩比较基准',
  days_held: '持有天数',
  previous_status: '当前状态',
  target_status: '变更为',
  status: '状态',
  merchant_ref: '商户',
  transfer_split_id: 'AA 单号',
  conversation_id: '会话编号',
  created_at: '受理时间',
  node_id: '计划节点',
  lock_id: '锁定编号',
  order_id: '订单编号',
  due_at: '计划时间',
}

const CARD_STATUS_LABELS: Record<string, string> = {
  active: '正常',
  frozen: '已冻结',
  lost: '已挂失',
  closed: '已注销',
  requested: '已发起收款',
  locked: '已锁定',
  placed: '已下单',
  confirmed: '已确认',
  completed: '已完成',
}
const PLAN_NODE_LABELS: Record<string, string> = {
  reminder: '生日提醒',
  budget_lock: '预算锁定',
  flowers: '鲜花订单',
  cake: '蛋糕订单',
}
const STATUS_KEY = /(^|_)status$/

const MONEY_KEY = /(^|_)(amount|limit|budget|balance|principal|profit|total|collectible)(_minor|_cents|_fen)?$/
const MINOR_KEY = /_(minor|cents|fen)$/
const MONO_KEY = /(_id|_account|account|last4|masked_number|number)$/

export function labelField(key: string) {
  const base = key.replace(MINOR_KEY, '')
  return FIELD_LABELS[key] ?? FIELD_LABELS[base] ?? key
}

export function formatField(key: string, value: unknown, currency = 'CNY'): { text: string; mono: boolean } {
  if (value === null || value === undefined) return { text: '未返回', mono: false }
  if (typeof value === 'boolean') return { text: value ? '是' : '否', mono: false }
  if (key.endsWith('_bps')) {
    const n = typeof value === 'number' ? value : Number(value)
    if (Number.isFinite(n)) return { text: formatBps(n), mono: true }
  }
  if (STATUS_KEY.test(key) && typeof value === 'string') return { text: CARD_STATUS_LABELS[value] ?? value, mono: false }
  if (key === 'node_id' && typeof value === 'string') return { text: PLAN_NODE_LABELS[value] ?? value, mono: false }
  if (MINOR_KEY.test(key)) {
    const n = typeof value === 'number' ? value : Number(value)
    if (Number.isFinite(n)) return { text: formatMoney(n / 100, currency), mono: true }
  }
  if (MONEY_KEY.test(key)) {
    const n = typeof value === 'number' ? value : Number(value)
    if (Number.isFinite(n)) return { text: formatMoney(MINOR_KEY.test(key) ? n / 100 : n, currency), mono: true }
  }
  if (typeof value === 'number') return { text: value.toLocaleString('zh-CN'), mono: true }
  if (typeof value === 'string') {
    if (/(_at|_date)$/.test(key)) return { text: formatDateTime(value), mono: true }
    return { text: value, mono: MONO_KEY.test(key) }
  }
  return { text: JSON.stringify(value), mono: true }
}

export function isMoneyKey(key: string) {
  return MONEY_KEY.test(key)
}
