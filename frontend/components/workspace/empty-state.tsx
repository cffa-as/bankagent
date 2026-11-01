'use client'

import { ArrowLeftRight, ArrowUpRight, CreditCard, LineChart, Receipt, Repeat, Wallet } from 'lucide-react'

const SERVICES = [
  { title: '余额与收支', example: '查一下我的余额', icon: Wallet },
  { title: '转账汇款', example: '给张三转 300 元，备注项目款', icon: ArrowLeftRight },
  { title: '账单分析', example: '分析本月消费和异常交易', icon: Receipt },
  { title: '理财产品', example: '比较稳健型理财产品', icon: LineChart },
  { title: '卡片管理', example: '查询卡片状态与额度', icon: CreditCard },
  { title: '订阅代扣', example: '检查订阅与续费提醒', icon: Repeat },
] as const

const QUESTIONS = ['如果预留 2000 元，会影响未来 30 天的必要支出吗？', '最近一周有没有异常扣款？', '下个月有哪些自动续费？'] as const

export function EmptyState({ onPick, disabled }: { onPick: (prompt: string) => void; disabled: boolean }) {
  return (
    <div className="vl-enter flex flex-col gap-10 pt-2 sm:pt-10">
      <div className="flex flex-col gap-2">
        <h2 className="text-balance text-[26px] font-semibold tracking-tight sm:text-[30px]">你好，今天想办理什么业务？</h2>
        <p className="text-pretty text-[15px] leading-relaxed text-muted-foreground">
          直接用一句话描述即可。涉及资金的操作，都会先请你核对并确认。
        </p>
      </div>

      <section aria-labelledby="ws-services" className="flex flex-col gap-3">
        <h3 id="ws-services" className="text-[13px] font-medium text-muted-foreground">
          常用业务
        </h3>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {SERVICES.map(({ title, example, icon: Icon }) => (
            <li key={title}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onPick(example)}
                className="group flex h-full w-full flex-col gap-3 rounded-xl border border-border bg-card p-4 text-left transition-colors duration-150 hover:border-cobalt/40 disabled:opacity-50"
              >
                <span className="flex size-9 items-center justify-center rounded-lg bg-ice text-cobalt-ink">
                  <Icon className="size-[18px]" aria-hidden />
                </span>
                <span className="flex flex-col gap-1">
                  <span className="text-[14px] font-medium">{title}</span>
                  <span className="line-clamp-2 text-[12.5px] leading-5 text-muted-foreground">{example}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="ws-questions" className="flex flex-col gap-3">
        <h3 id="ws-questions" className="text-[13px] font-medium text-muted-foreground">
          你也可以这样问
        </h3>
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
          {QUESTIONS.map((q) => (
            <li key={q}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onPick(q)}
                className="group flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left text-[14px] transition-colors hover:bg-background disabled:opacity-50"
              >
                <span className="min-w-0 flex-1">{q}</span>
                <ArrowUpRight className="size-4 shrink-0 text-steel transition-colors group-hover:text-cobalt-ink" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
