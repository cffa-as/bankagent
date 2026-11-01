import { ChevronDown } from 'lucide-react'
import Link from 'next/link'

const FAQ = [
  {
    q: '助理会不会自己把钱转出去？',
    a: '不会。所有涉及资金的业务都会先生成一张业务单，必须由你核对并点击确认；高风险业务还需要输入动态验证码。没有你的确认，账户不会发生任何变化。',
  },
  {
    q: '确认之后还能修改吗？',
    a: '业务单的内容在确认前就已固定。如果需要修改收款人、金额或备注，可以点击“修改信息”重新发起，原业务单会自动作废。',
  },
  {
    q: '业务单有有效期吗？',
    a: '有。每张业务单都有确认时限，超时后会自动失效，账户不会有任何变化，需要时重新发起即可。',
  },
  {
    q: '怎样确认一笔业务真的办好了？',
    a: '只有收到银行回执，业务才会显示“办理成功”。你可以在“操作记录”中查看每一笔业务的完整过程。',
  },
  {
    q: '助理会索要我的密码吗？',
    a: 'Vaultline 不会以任何形式索要你的登录密码、支付密码或验证码。如有人以 Vaultline 名义索要，请立即停止操作。',
  },
] as const

export function Faq() {
  return (
    <section id="faq" aria-labelledby="faq-title" className="scroll-mt-16 bg-background py-20 md:py-28">
      <div className="mx-auto grid max-w-[1200px] gap-12 px-5 md:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20">
        <div className="flex flex-col gap-4">
          <h2 id="faq-title" className="font-display text-4xl font-semibold leading-tight tracking-[-0.03em] md:text-[44px]">
            常见问题
          </h2>
          <p className="max-w-sm text-pretty text-[15px] leading-relaxed text-muted-foreground">
            还有其他问题？直接在智能助理里问就可以。
          </p>
          <Link
            href="/workspace"
            className="mt-2 inline-flex h-11 w-fit items-center rounded-lg bg-navy px-5 text-[14px] font-medium text-rail-foreground transition-colors hover:bg-navy/90"
          >
            打开智能助理
          </Link>
        </div>
        <ul className="flex flex-col divide-y divide-border border-y border-border">
          {FAQ.map(({ q, a }) => (
            <li key={q}>
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-[16px] font-medium [&::-webkit-details-marker]:hidden">
                  {q}
                  <ChevronDown className="size-4 shrink-0 text-steel transition-transform duration-200 group-open:rotate-180" aria-hidden />
                </summary>
                <p className="pb-5 text-pretty text-[14.5px] leading-relaxed text-muted-foreground">{a}</p>
              </details>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
