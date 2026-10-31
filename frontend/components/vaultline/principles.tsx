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
    <section id="principles" aria-labelledby="principles-title" className="scroll-mt-16 border-t border-border bg-surface py-20 md:py-28">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-10 px-5 md:px-8">
        <h2 id="principles-title" className="max-w-2xl text-balance text-3xl font-semibold tracking-tight md:text-4xl">
          安全原则
        </h2>
        <ul className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {PRINCIPLES.map((p) => (
            <li key={p.title} className="flex flex-col gap-2 bg-card p-6">
              <h3 className="font-medium">{p.title}</h3>
              <p className="text-pretty text-sm leading-relaxed text-muted-foreground">{p.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
