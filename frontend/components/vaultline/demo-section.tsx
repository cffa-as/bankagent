import { DemoVideo } from './demo-video'

export function DemoSection() {
  return (
    <section aria-labelledby="demo-title" className="border-t border-border bg-background py-20 md:py-28">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-10 px-5 md:px-8">
        <h2 id="demo-title" className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
          演示视频
        </h2>
        <DemoVideo />
      </div>
    </section>
  )
}
