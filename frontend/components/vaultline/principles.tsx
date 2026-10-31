const PRINCIPLES = [
  { title: '服务端是唯一事实来源', body: '状态、金额与风险等级都由银行服务端返回，界面不推断、不补全。' },
  { title: '授权绑定动作快照', body: '确认与 MFA 只对冻结后的单个 Action ID 有效，字段一变即作废。' },
  { title: '执行一次性放行', body: '每次执行携带幂等键，重复提交不会产生第二笔交易。' },
  { title: '回执才算完成', body: '没有业务回执就不显示成功；失败与撤销同样如实呈现。' },
  { title: '全程可审计', body: '每一步按 Trace 追加写入审计链，可在工作台逐条查看。' },
  { title: '查询无需授权', body: '只读请求直接返回结果，涉及资金的动作才进入受控路径。' },
]

export function Principles() {
  return (
    <section id="principles" aria-labelledby="principles-title" className="scroll-mt-16 bg-navy py-20 text-rail-foreground md:py-28">
      <div className="mx-auto grid max-w-[1200px] gap-12 px-5 md:px-8 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
        <div className="flex flex-col gap-5">
          <h2 id="principles-title" className="font-display text-4xl font-semibold leading-tight tracking-[-0.04em] md:text-5xl">
            把可控性
            <br />
            做进每一步。
          </h2>
          <p className="max-w-sm text-pretty text-[15px] leading-7 text-rail-muted">
            助理可以理解、整理和提出建议，但不能越过银行的风险、授权与执行边界。
          </p>
          <p className="mt-4 border-l-2 border-cobalt pl-4 font-mono text-xs leading-6 text-rail-muted">
            MODEL PROPOSES
            <br />
            BANK SERVER DECIDES
          </p>
        </div>
        <ul className="border-t border-white/10">
          {PRINCIPLES.map((p, index) => (
            <li key={p.title} className="grid gap-2 border-b border-white/10 py-5 sm:grid-cols-[44px_180px_1fr] sm:items-baseline sm:gap-5">
              <span className={`font-mono text-[12px] ${index < 2 ? 'text-teal' : index < 4 ? 'text-amber' : 'text-rail-muted'}`}>
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3 className="text-[15px] font-medium">{p.title}</h3>
              <p className="text-pretty text-[13px] leading-6 text-rail-muted">{p.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
