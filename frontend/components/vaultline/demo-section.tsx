import { DemoVideo } from './demo-video'

export function DemoSection() {
  return (
    <section aria-labelledby="demo-title" className="border-t border-white/10 bg-[#07111f] py-20 text-rail-foreground md:py-28">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-9 px-5 md:px-8">
        <div className="flex flex-col gap-6 border-b border-white/10 pb-8 md:flex-row md:items-end md:justify-between">
          <div className="flex max-w-2xl flex-col gap-3">
            <p className="text-sm text-teal">30 秒产品片</p>
            <h2 id="demo-title" className="font-display text-4xl font-semibold tracking-[-0.04em] md:text-5xl">
              从一句话，到一笔业务回执。
            </h2>
          </div>
          <p className="max-w-xs text-sm leading-6 text-rail-muted">
            代码化镜头、真实前端画面与原创配乐。所有业务结果仍只来自服务端回执。
          </p>
        </div>
        <DemoVideo />
        <div className="flex flex-col gap-3 border-t border-white/10 pt-5 text-sm text-rail-muted sm:flex-row sm:items-center sm:justify-between">
          <p>需要逐项查看真实功能与安全状态机？</p>
          <a href="/demo/vaultline-product.mp4" className="font-medium text-rail-foreground underline decoration-white/25 underline-offset-4 hover:decoration-white">
            观看 3 分钟完整业务演示
          </a>
        </div>
      </div>
    </section>
  )
}
