import Image from 'next/image'
import Link from 'next/link'
import { LockKeyhole, ReceiptText, ShieldCheck } from 'lucide-react'

const CONTROLS = [
  { label: '风险判定', value: '银行服务端', icon: ShieldCheck, color: 'text-teal' },
  { label: '动作授权', value: '绑定 Action ID', icon: LockKeyhole, color: 'text-amber' },
  { label: '业务完成', value: '只认执行回执', icon: ReceiptText, color: 'text-cobalt' },
] as const

export function Hero() {
  return (
    <section id="top" aria-labelledby="hero-title" className="relative overflow-hidden border-b border-white/10 bg-navy text-rail-foreground">
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[46%] border-l border-white/10 bg-[#0a1728] lg:block" />
      <div className="pointer-events-none absolute top-0 right-[12%] h-px w-40 bg-cobalt" />
      <div className="relative mx-auto grid max-w-[1320px] gap-14 px-5 py-16 md:px-8 md:py-20 lg:min-h-[760px] lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:gap-20">
        <div className="flex max-w-[610px] flex-col">
          <p className="mb-7 flex items-center gap-3 text-sm text-teal">
            <span className="h-px w-8 bg-teal" aria-hidden />
            面向受监管银行业务的 AI 工作台
          </p>
          <h1 id="hero-title" className="font-display text-[44px] font-semibold leading-[1.16] tracking-[-0.055em] sm:text-6xl lg:text-[72px]">
            一句话开始，
            <br />
            每一步可控。
          </h1>
          <p className="mt-7 max-w-[540px] text-pretty text-[16px] leading-8 text-rail-muted md:text-[17px]">
            Vaultline 理解你真正想办的银行业务，并把金额、收款人、风险与授权冻结成一份可审查的动作。执行权和最终结果始终留在银行服务端。
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link
              href="/workspace"
              className="inline-flex h-12 items-center rounded-md bg-cobalt px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-cobalt-ink"
            >
              进入工作台
            </Link>
            <a
              href="#demo"
              className="inline-flex h-12 items-center rounded-md border border-white/20 px-6 text-sm font-medium text-rail-foreground transition-colors hover:border-white/40 hover:bg-white/5"
            >
              播放产品演示
            </a>
          </div>

          <dl className="mt-12 grid grid-cols-1 gap-px overflow-hidden border-y border-white/10 sm:grid-cols-3">
            {CONTROLS.map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="flex items-start gap-3 py-4 sm:px-4 sm:first:pl-0 sm:last:pr-0">
                <Icon className={`mt-0.5 size-4 shrink-0 ${color}`} aria-hidden />
                <div>
                  <dt className="text-[13px] font-medium text-rail-foreground">{label}</dt>
                  <dd className="mt-1 text-[12px] text-rail-muted">{value}</dd>
                </div>
              </div>
            ))}
          </dl>
        </div>

        <div className="relative lg:pl-4">
          <div className="absolute top-10 -left-3 hidden h-[calc(100%-5rem)] w-px bg-white/15 lg:block" aria-hidden>
            <span className="absolute top-0 -left-1 size-2 rounded-full bg-teal" />
            <span className="absolute top-1/3 -left-1 size-2 rounded-full bg-amber" />
            <span className="absolute top-2/3 -left-1 size-2 rounded-full bg-cobalt" />
            <span className="absolute bottom-0 -left-1 size-2 rounded-full bg-white" />
          </div>
          <figure className="overflow-hidden rounded-sm border border-white/15 bg-[#0a1728] p-2 shadow-[0_30px_80px_-35px_rgb(0_0_0/0.85)]">
            <div className="mb-2 flex items-center justify-between border-b border-white/10 px-2 pb-2 text-[11px] text-rail-muted">
              <span>服务端控制面</span>
              <span className="font-mono">合成演示数据</span>
            </div>
            <div className="overflow-hidden border border-white/10">
              <Image
                src="/product/workspace-assistant.png"
                alt="Vaultline 工作台：左侧为对话助理，右侧为由服务端控制的决策与动作面板"
                width={1440}
                height={900}
                priority
                className="h-auto w-full"
              />
            </div>
          </figure>
          <div className="ml-auto mt-4 flex w-fit items-center gap-2 border-l-2 border-cobalt pl-3 text-[12px] text-rail-muted">
            <span className="size-1.5 rounded-full bg-teal" aria-hidden />
            页面状态只跟随服务端响应
          </div>
        </div>
      </div>
    </section>
  )
}
