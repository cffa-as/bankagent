export type StepTone = 'done' | 'guard' | 'fail'

export interface EventStep {
  label: string
  source?: string
  tone?: StepTone
}

export const EVENT_STEPS: Record<string, EventStep> = {
  model_plan_requested: { label: '理解你的需求' },
  model_plan_validated: { label: '核对业务规则' },
  model_plan_rejected: { label: '无法按此方式办理', tone: 'guard' },
  model_plan_unknown: { label: '没有识别出具体业务', tone: 'guard' },
  suspicious_input_detected: { label: '已拦截异常指令', tone: 'guard' },
  balance_queried: { label: '查询账户余额', source: '账户' },
  transactions_queried: { label: '读取交易明细', source: '账户' },
  bill_analyzed: { label: '分析消费结构', source: '账单' },
  investment_products_queried: { label: '比较理财产品', source: '理财' },
  investment_holdings_queried: { label: '读取理财持仓', source: '理财' },
  cards_queried: { label: '查看卡片状态', source: '卡片' },
  subscriptions_queried: { label: '检查订阅与代扣', source: '订阅' },
  subscription_reminders_queried: { label: '读取续费提醒', source: '订阅' },
  model_liquidity_simulation_selected: { label: '测算未来 30 天现金流', source: '现金流' },
  liquidity_simulation_completed: { label: '生成现金流方案', source: '现金流' },
  action_created: { label: '生成待确认业务单' },
  confirmation_succeeded: { label: '已收到你的确认' },
  mfa_succeeded: { label: '安全验证通过' },
  mfa_failed: { label: '安全验证未通过', tone: 'fail' },
  authorization_gate_passed: { label: '授权核验通过' },
  action_scheduled: { label: '已预约执行' },
  action_succeeded: { label: '银行已返回回执' },
  action_failed: { label: '办理未完成', tone: 'fail' },
  action_cancelled: { label: '业务已取消' },
  action_expired: { label: '业务已超时', tone: 'guard' },
  run_failed: { label: '处理中断', tone: 'fail' },
  run_interrupted: { label: '已按你的要求停止', tone: 'guard' },
  run_human_handoff: { label: '已转交人工客服', tone: 'guard' },
  run_rollback_completed: { label: '已撤销可撤销的操作' },
}

export const AUDIT_ONLY_STEPS: Record<string, string> = {
  agent_run_started: '收到你的请求',
  run_completed: '本次处理结束',
}

export const ACTOR_LABELS: Record<string, string> = {
  system: '系统',
  agent: '智能助理',
  assistant: '智能助理',
  user: '你',
  customer: '你',
  bank: '银行',
  tool: '银行业务系统',
  operator: '人工客服',
}

export const OUTCOME_LABELS: Record<string, string> = {
  succeeded: '成功',
  success: '成功',
  failed: '未通过',
  pending: '处理中',
  scheduled: '已预约',
  cancelled: '已取消',
  expired: '已超时',
}
