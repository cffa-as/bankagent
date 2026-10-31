import Image from 'next/image'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'

export function Hero() {
  return (
    <section id="top" aria-labelledby="hero-title" className="border-b border-border bg-background">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-12 px-5 pt-16 pb-0 md:px-8 md:pt-24">
        <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <div className="flex max-w-2xl flex-col gap-5">
            <p className="text-sm font-medium text-cobalt-ink">面向银行的受控智能助理</p>
            <h1 id="hero-title" className="text-balance text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
              智能理解意图，
              <br />
              控制权留在银行。
            </h1>
          </div>
          <div className="flex max-w-sm flex-col gap-6">
            <p className="text-pretty text-base leading-relaxed text-muted-foreground">
              用一句中文描述业务，Vaultline 整理成候选动作。风险评级、授权、MFA、执行与回执，全部由银行服务端决定。
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/workspace"
                className="inline-flex h-11 items-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-cobalt-ink"
              >
                进入工作台
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <a
                href="#demo"
                className="inline-flex h-11 items-center rounded-md border border-border bg-card px-5 text-sm font-medium transition-colors hover:border-line-strong"
              >
                观看演示
              </a>
            </div>
          </div>
        </div>

        <figure className="overflow-hidden rounded-t-xl border border-b-0 border-border bg-card shadow-[0_24px_60px_-30px_rgb(15_23_42/0.35)]">
          <Image
            src="/product/workspace-assistant.png"
            alt="Vaultline 工作台：左侧为对话助理，右侧为由服务端控制的决策与动作面板"
            width={1440}
            height={900}
            priority
            className="h-auto w-full"
          />
        </figure>
      </div>
    </section>
  )
}
