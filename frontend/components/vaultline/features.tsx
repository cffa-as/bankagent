import { ArrowLeftRight, CreditCard, LineChart, Receipt, Repeat, Wallet } from 'lucide-react'

const FEATURES = [
  { title: '余额与收支', body: '随时查看可用余额、冻结金额和最近交易，不用在菜单里层层查找。', icon: Wallet },
  { title: '转账汇款', body: '说出收款人和金额，助理整理好转账单，由你核对后确认。', icon: ArrowLeftRight },
  { title: '账单分析', body: '按类别汇总本月消费，标出金额异常或重复的扣款。', icon: Receipt },
  { title: '理财产品', body: '按风险等级与期限比较产品，查看持仓与到期情况。', icon: LineChart },
  { title: '卡片管理', body: '查看卡片状态、额度与账单日，需要时一句话办理挂失或冻结。', icon: CreditCard },
  { title: '订阅代扣', body: '集中查看所有自动续费，提前提醒即将发生的扣款。', icon: Repeat },
] as const

const BALANCE_DAYS = [7.1, 6.8, 6.4, 6.2, 5.1, 4.9, 4.6, 3.2, 2.9, 2.6, 1.8, 1.4, 2.1, 9.6, 9.2] as const
const LOWEST_INDEX = 11
const BUFFER = 1.5

function CashflowPreview() {
  const max = Math.max(...BALANCE_DAYS)
  return (
    <div aria-hidden className="flex h-full flex-col gap-5 rounded-xl border border-border bg-card p-5 shadow-[0_20px_50px_-30px_rgb(15_23_42/0.25)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[13px] text-muted-foreground">预留 ¥2,000 后 · 未来 30 天</p>
          <p className="mt-1 font-mono text-[24px] font-medium leading-none tracking-tight">¥1,400.00</p>
          <p className="mt-1.5 text-[12.5px] text-muted-foreground">最低余额，出现在 11 月 22 日</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-soft px-2.5 py-1 text-[12px] font-medium text-amber-ink">
          <span className="size-1.5 rounded-full bg-amber" />
          低于安全线
        </span>
      </div>
      <div className="relative flex h-32 items-end gap-1.5">
        <div
          className="absolute inset-x-0 border-t border-dashed border-amber"
          style={{ bottom: `${(BUFFER / max) * 100}%` }}
        />
        {BALANCE_DAYS.map((v, i) => (
          <div
            key={i}
            className={`flex-1 rounded-t-sm ${i === LOWEST_INDEX ? 'bg-amber' : i === 13 || i === 14 ? 'bg-teal/70' : 'bg-cobalt/80'}`}
            style={{ height: `${(v / max) * 100}%` }}
          />
        ))}
      </div>
      <ul className="flex flex-col divide-y divide-border border-t border-border text-[13.5px]">
        <li className="flex justify-between pt-3 pb-2.5">
          <span>改为 25 日工资到账后再预留</span>
          <span className="text-teal-ink">推荐</span>
        </li>
        <li className="flex justify-between pt-2.5">
          <span>本月先预留 ¥1,200</span>
          <span className="text-muted-foreground">可选</span>
        </li>
      </ul>
    </div>
  )
}

export function Features() {
  return (
    <section id="features" aria-labelledby="features-title" className="scroll-mt-16 bg-background py-20 md:py-28">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-14 px-5 md:px-8">
        <div className="flex max-w-2xl flex-col gap-4">
          <h2 id="features-title" className="font-display text-balance text-4xl font-semibold leading-tight tracking-[-0.03em] md:text-[44px]">
            日常银行业务，一个对话框就够了
          </h2>
          <p className="text-pretty text-[16px] leading-relaxed text-muted-foreground">
            不需要记住功能入口。用你习惯的说法描述需求，助理会给出结果，或准备好需要你确认的业务单。
          </p>
        </div>

        <ul className="grid grid-cols-1 gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ title, body, icon: Icon }) => (
            <li key={title} className="flex flex-col gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg bg-ice text-cobalt-ink">
                <Icon className="size-5" aria-hidden />
              </span>
              <h3 className="text-[17px] font-semibold">{title}</h3>
              <p className="text-pretty text-[14.5px] leading-relaxed text-muted-foreground">{body}</p>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-10 overflow-hidden rounded-2xl border border-border bg-card md:flex-row md:items-center">
          <div className="flex flex-col gap-4 p-8 md:w-5/12 md:p-12">
            <p className="text-[13px] font-medium text-cobalt-ink">现金流测算</p>
            <h3 className="font-display text-balance text-[28px] font-semibold leading-snug tracking-[-0.02em]">
              花钱之前，先看看未来 30 天
            </h3>
            <p className="text-pretty text-[15px] leading-relaxed text-muted-foreground">
              问一句“预留 2000 元会影响必要支出吗？”，助理会根据你的收支推演余额走势，标出最紧张的那一天，并给出几种可选的安排方式。
            </p>
          </div>
          <div className="border-t border-border bg-background p-6 md:w-7/12 md:border-t-0 md:border-l md:p-10">
            <CashflowPreview />
          </div>
        </div>
      </div>
    </section>
  )
}
