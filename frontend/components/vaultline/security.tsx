import { FileClock, KeyRound, ShieldAlert, ShieldCheck } from 'lucide-react'

const GUARANTEES = [
  {
    title: '确认后才执行',
    body: '涉及资金的业务都会先生成业务单，收款人、金额、备注一目了然。你点击确认之前，账户不会有任何变化。',
    icon: ShieldCheck,
  },
  {
    title: '高风险必须多因素确认',
    body: '大额或异常操作需要动作绑定 MFA；单一验证信号不能代替银行授权，信息变化后必须重新验证。',
    icon: KeyRound,
  },
  {
    title: '输入也先过安全边界',
    body: '隐藏字符、疑似注入和越权指令会在服务端被清理或拒绝，用户文本不能改写权限、工具白名单或执行状态。',
    icon: ShieldAlert,
  },
  {
    title: '每一步都有记录',
    body: '从发起、确认、验证到银行回执，每笔业务都留有完整记录，随时可以在“操作记录”中查看。',
    icon: FileClock,
  },
] as const

function ConfirmPreview() {
  return (
    <div aria-hidden className="w-full max-w-[380px] rounded-xl border border-white/10 bg-card p-5 text-foreground shadow-[0_30px_80px_-40px_rgb(0_0_0/0.8)]">
      <p className="text-[13px] text-muted-foreground">转账 · 张三</p>
      <p className="mt-1.5 font-mono text-[30px] font-medium leading-none tracking-tight">¥300.00</p>
      <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber-soft px-2.5 py-1 text-[12px] font-medium text-amber-ink">
        <span className="size-1.5 rounded-full bg-amber" />
        待你确认
      </p>
      <dl className="mt-5 flex flex-col divide-y divide-border border-y border-border text-[13.5px]">
        {[
          ['收款人', '张三'],
          ['收款账户', '尾号 4821'],
          ['备注', '项目款'],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between py-2.5">
            <dt className="text-muted-foreground">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-5 flex h-11 items-center justify-center rounded-lg bg-cobalt text-[14px] font-medium text-primary-foreground">
        确认转账
      </div>
    </div>
  )
}

export function Security() {
  return (
    <section id="security" aria-labelledby="security-title" className="scroll-mt-16 bg-navy py-20 text-rail-foreground md:py-28">
      <div className="mx-auto grid max-w-[1200px] gap-14 px-5 md:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-20">
        <div className="flex flex-col gap-10">
          <div className="flex flex-col gap-4">
            <h2 id="security-title" className="font-display text-balance text-4xl font-semibold leading-tight tracking-[-0.03em] md:text-[44px]">
              助理可以帮你准备，但只有你能决定
            </h2>
            <p className="max-w-lg text-pretty text-[16px] leading-relaxed text-rail-muted">
              风险判断、授权和执行都由银行系统完成。助理无法替你确认，也无法绕过任何一道验证。
            </p>
          </div>
          <ul className="flex flex-col gap-7">
            {GUARANTEES.map(({ title, body, icon: Icon }) => (
              <li key={title} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/[0.07] text-rail-accent">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-[16px] font-semibold">{title}</h3>
                  <p className="text-pretty text-[14.5px] leading-relaxed text-rail-muted">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex justify-center lg:justify-end">
          <ConfirmPreview />
        </div>
      </div>
    </section>
  )
}
