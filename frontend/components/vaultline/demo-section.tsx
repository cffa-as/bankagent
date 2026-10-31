import { DemoVideo } from './demo-video'

export function DemoSection() {
  return (
    <section aria-labelledby="demo-title" className="border-t border-white/10 bg-[#07111f] py-20 text-rail-foreground md:py-28">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-9 px-5 md:px-8">
        <div className="flex flex-col gap-6 border-b border-white/10 pb-8 md:flex-row md:items-end md:justify-between">
          <div className="flex max-w-2xl flex-col gap-3">
            <p className="text-sm text-teal">产品演示</p>
            <h2 id="demo-title" className="font-display text-4xl font-semibold tracking-[-0.04em] md:text-5xl">
              从一句话，到一笔业务回执。
            </h2>
          </div>
          <p className="max-w-xs text-sm leading-6 text-rail-muted">
            真实前端、真实 Go API、合成账本。所有成功状态都来自服务端业务回执。
          </p>
        </div>
        <DemoVideo />
      </div>
    </section>
  )
}
