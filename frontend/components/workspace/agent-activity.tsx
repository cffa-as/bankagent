'use client'

import type { LiveActivityEvent } from '@/lib/vaultline/types'

const PROGRESS: Record<string, string> = {
  agent_run_started: '正在理解你的需求',
  model_plan_requested: '正在理解你的需求',
  model_plan_validated: '正在准备办理',
  balance_queried: '已读取账户余额，正在整理',
  transactions_queried: '已读取交易记录，正在整理',
  bill_analyzed: '正在分析消费情况',
  investment_products_queried: '正在比较理财产品',
  investment_holdings_queried: '正在读取你的持仓',
  cards_queried: '正在读取卡片信息',
  subscriptions_queried: '正在检查订阅与代扣',
  subscription_reminders_queried: '正在读取续费提醒',
  model_liquidity_simulation_selected: '正在测算未来现金流',
  liquidity_simulation_completed: '现金流测算完成，正在整理',
  action_created: '正在生成待确认的业务单',
}

export function AgentStatus({ events }: { events: LiveActivityEvent[] }) {
  const last = events.at(-1)
  const label = (last && PROGRESS[last.eventType]) ?? '正在处理'
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-2.5 py-1 text-[14px] text-muted-foreground">
      <span className="flex items-center gap-1" aria-hidden>
        <span className="size-1.5 animate-bounce rounded-full bg-cobalt [animation-delay:-0.3s] motion-reduce:animate-none" />
        <span className="size-1.5 animate-bounce rounded-full bg-cobalt [animation-delay:-0.15s] motion-reduce:animate-none" />
        <span className="size-1.5 animate-bounce rounded-full bg-cobalt motion-reduce:animate-none" />
      </span>
      {label}…
    </div>
  )
}
