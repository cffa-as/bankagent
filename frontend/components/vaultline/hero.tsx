import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

const EXAMPLES = ['给张三转 300 元，备注项目款', '分析本月消费和异常交易', '预留 2000 元会影响必要支出吗？'] as const

export function Hero() {
  return (
    <section id="top" aria-labelledby="hero-title" className="overflow-hidden bg-navy text-rail-foreground">
      <div className="mx-auto flex max-w-[1200px] flex-col items-center px-5 pt-16 text-center md:px-8 md:pt-24">
        <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 px-3 py-1 text-[13px] text-rail-muted">
          <span className="size-1.5 rounded-full bg-teal" aria-hidden />
          Vaultline 智能助理
        </p>
        <h1 id="hero-title" className="font-display text-balance text-[40px] font-semibold leading-[1.15] tracking-[-0.04em] sm:text-6xl lg:text-[68px]">
          说一句话，办好银行业务
        </h1>
        <p className="mt-6 max-w-[560px] text-pretty text-[16px] leading-relaxed text-rail-muted md:text-[17px]">
          查余额、转账、分析账单、规划现金流。助理帮你把事情准备好，每一笔资金操作都由你核对确认后才会执行。
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Link
            href="/workspace"
            className="inline-flex h-12 items-center gap-2 rounded-lg bg-cobalt px-6 text-[15px] font-medium text-primary-foreground transition-colors hover:bg-cobalt-ink"
          >
            打开智能助理
            <ArrowRight className="size-4" aria-hidden />
          </Link>
          <a
            href="#security"
            className="inline-flex h-12 items-center rounded-lg border border-white/20 px-6 text-[15px] font-medium text-rail-foreground transition-colors hover:border-white/40 hover:bg-white/5"
          >
            了解安全保障
          </a>
        </div>
        <ul className="mt-10 flex flex-wrap justify-center gap-2" aria-label="可以这样说">
          {EXAMPLES.map((e) => (
            <li key={e} className="rounded-full bg-white/[0.06] px-3.5 py-1.5 text-[13px] text-rail-muted">
              {'“'}
              {e}
              {'”'}
            </li>
          ))}
        </ul>

        <div className="relative mt-14 w-full max-w-[1080px] md:mt-16">
          <div className="overflow-hidden rounded-t-xl border border-b-0 border-white/15 bg-card shadow-[0_-20px_80px_-30px_rgb(49_91_255/0.35)]">
            <Image
              src="/product/workspace-assistant.png"
              alt="Vaultline 智能助理界面：左侧为功能导航，中间为常用业务与对话区"
              width={1440}
              height={900}
              priority
              className="h-auto w-full"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
