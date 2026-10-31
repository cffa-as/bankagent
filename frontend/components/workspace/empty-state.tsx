'use client'

import { ArrowLeftRight, ChevronRight, CreditCard, LineChart, Receipt, Repeat, Wallet } from 'lucide-react'

const SHORTCUTS = [
  { prompt: '查一下我的余额', icon: Wallet, tag: '查询', color: 'bg-teal' },
  { prompt: '给张三转 300 元，备注项目款', icon: ArrowLeftRight, tag: '转账', color: 'bg-amber' },
  { prompt: '分析本月消费和异常交易', icon: Receipt, tag: '账单', color: 'bg-cobalt' },
  { prompt: '比较稳健型理财产品', icon: LineChart, tag: '理财', color: 'bg-red' },
  { prompt: '查询卡片状态与额度', icon: CreditCard, tag: '卡片', color: 'bg-steel' },
  { prompt: '检查订阅与续费提醒', icon: Repeat, tag: '订阅', color: 'bg-teal' },
] as const

export function EmptyState({ onPick, disabled }: { onPick: (prompt: string) => void; disabled: boolean }) {
  return (
    <div className="vl-enter grid gap-10 pt-3 sm:pt-8 lg:grid-cols-[0.78fr_1.22fr] lg:gap-14">
      <div className="flex max-w-sm flex-col gap-5">
        <p className="flex items-center gap-2 text-[13px] font-medium text-cobalt-ink">
          <span className="size-1.5 rounded-full bg-cobalt" aria-hidden />
          银行事务工作台
        </p>
        <h2 className="font-display text-[32px] font-semibold leading-tight tracking-[-0.04em] sm:text-[38px]">
          从一个意图
          <br />
          开始办理。
        </h2>
        <p className="text-pretty text-[14px] leading-7 text-muted-foreground">
          描述你要办的事。Vaultline 会整理候选动作，涉及资金的操作必须经过服务端确认或 MFA。
        </p>
        <div className="mt-2 border-l-2 border-cobalt pl-4 text-[13px] leading-6 text-muted-foreground">
          助理负责理解。
          <br />
          银行服务端负责授权与执行。
        </div>
      </div>
      <div className="flex min-w-0 flex-col">
        <p className="mb-3 text-[12px] font-medium text-muted-foreground">常用业务</p>
        <ul className="border-t border-border" aria-label="常用业务">
        {SHORTCUTS.map(({ prompt, icon: Icon, tag, color }) => (
          <li key={prompt} className="border-b border-border">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(prompt)}
              className="group flex min-h-14 w-full items-center gap-3 px-1 py-3 text-left transition-colors duration-150 hover:bg-card disabled:opacity-50"
            >
              <span className={`size-1.5 shrink-0 rounded-full ${color}`} aria-hidden />
              <Icon className="size-4 shrink-0 text-steel" aria-hidden />
              <span className="min-w-0 flex-1 text-[14px]">{prompt}</span>
              <span className="shrink-0 text-[12px] text-muted-foreground">{tag}</span>
              <ChevronRight className="size-4 shrink-0 text-steel opacity-30 transition-opacity group-hover:opacity-100" aria-hidden />
            </button>
          </li>
        ))}
        </ul>
      </div>
    </div>
  )
}
