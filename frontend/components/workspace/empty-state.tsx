'use client'

import { ArrowLeftRight, ChevronRight, CreditCard, LineChart, Receipt, Repeat, Wallet } from 'lucide-react'

const SHORTCUTS = [
  { prompt: '查一下我的余额', icon: Wallet },
  { prompt: '给张三转 300 元，备注项目款', icon: ArrowLeftRight },
  { prompt: '分析本月消费和异常交易', icon: Receipt },
  { prompt: '比较稳健型理财产品', icon: LineChart },
  { prompt: '查询卡片状态与额度', icon: CreditCard },
  { prompt: '检查订阅与续费提醒', icon: Repeat },
] as const

export function EmptyState({ onPick, disabled }: { onPick: (prompt: string) => void; disabled: boolean }) {
  return (
    <div className="vl-enter flex flex-col gap-8 pt-4 sm:pt-10">
      <div className="flex max-w-xl flex-col gap-2">
        <h2 className="text-balance text-[24px] font-semibold tracking-tight sm:text-[28px]">今天要办理什么银行业务？</h2>
        <p className="text-pretty text-[15px] leading-relaxed text-muted-foreground">
          用一句话描述即可。助理会整理成候选计划，涉及资金的动作需要你在右侧控制台逐项确认。
        </p>
      </div>
      <ul className="grid grid-cols-1 overflow-hidden rounded-lg border border-border bg-card sm:grid-cols-2" aria-label="常用业务">
        {SHORTCUTS.map(({ prompt, icon: Icon }) => (
          <li key={prompt} className="border-b border-border last:border-b-0 sm:odd:border-r sm:[&:nth-last-child(-n+2)]:border-b-0">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(prompt)}
              className="group flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-surface disabled:opacity-50"
            >
              <Icon className="size-4 shrink-0 text-steel" aria-hidden />
              <span className="min-w-0 flex-1 text-[14px]">{prompt}</span>
              <ChevronRight className="size-4 shrink-0 text-steel opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
