import Image from 'next/image'

const POINTS = [
  { title: '看清最低点', body: '服务端推演未来 30 天的余额走势，标出现金流最紧的那一天。' },
  { title: '比较方案', body: '每个方案都给出对最低余额的影响，数值不在前端二次计算。' },
  { title: '只创建，不执行', body: '选择方案会生成一个工作流；其中需授权的节点仍需逐一确认。' },
]

export function LiquiditySection() {
  return (
    <section id="liquidity" aria-labelledby="liquidity-title" className="scroll-mt-16 border-t border-border bg-background py-20 md:py-28">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-12 px-5 md:flex-row md:items-center md:gap-16 md:px-8">
        <div className="flex flex-col gap-8 md:w-5/12">
          <div className="flex flex-col gap-4">
            <h2 id="liquidity-title" className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
              锁定预算之前，先做流动性预检
            </h2>
            <p className="text-pretty leading-relaxed text-muted-foreground">
              从工作台顶部打开预检，输入计划支出，服务端返回推演结果与可选方案。
            </p>
          </div>
          <dl className="flex flex-col divide-y divide-border border-y border-border">
            {POINTS.map((p) => (
              <div key={p.title} className="flex flex-col gap-1 py-4">
                <dt className="font-medium">{p.title}</dt>
                <dd className="text-sm leading-relaxed text-muted-foreground">{p.body}</dd>
              </div>
            ))}
          </dl>
        </div>
        <figure className="relative aspect-[16/7] overflow-hidden rounded-xl border border-border bg-card shadow-[0_24px_60px_-30px_rgb(15_23_42/0.35)] md:w-7/12">
          <Image
            src="/product/workspace-liquidity.png"
            alt="工作台中打开的流动性预检抽屉，用于输入计划支出并请求服务端推演"
            width={1440}
            height={900}
            sizes="(min-width: 768px) 60vw, 100vw"
            className="absolute top-0 right-0 h-auto w-[225%] max-w-none"
          />
        </figure>
      </div>
    </section>
  )
}
