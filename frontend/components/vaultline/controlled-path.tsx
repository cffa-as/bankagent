const STAGES = [
  { label: '请求', owner: '助理', body: '理解中文意图，整理成一条候选动作，并冻结金额、收款方与备注。' },
  { label: '风险', owner: '银行服务端', body: '按动作快照评定风险等级，决定只需确认，还是必须通过 MFA。' },
  { label: '授权', owner: '银行服务端', body: '确认与 MFA 绑定到同一个 Action ID，任何字段变化都会作废授权。' },
  { label: '回执', owner: '银行服务端', body: '一次性放行执行，带幂等键。只有业务回执才代表完成，并写入审计链。' },
]

export function ControlledPath() {
  return (
    <section id="path" aria-labelledby="path-title" className="scroll-mt-16 bg-surface py-20 md:py-28">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-10 px-5 md:px-8">
        <div className="flex max-w-2xl flex-col gap-4">
          <h2 id="path-title" className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            每一笔资金动作，都走同一条受控路径
          </h2>
          <p className="text-pretty leading-relaxed text-muted-foreground">
            助理只负责第一步。之后的每一个关口都由银行服务端裁决，助理无法跳过，也无法代为完成。
          </p>
        </div>

        <div className="overflow-hidden rounded-xl bg-rail text-rail-foreground">
          <div className="flex items-center justify-between border-b border-rail-line px-5 py-4 md:px-8">
            <p className="text-sm font-medium">转账给张三 · 300.00 元 · 备注 项目款</p>
            <p className="hidden text-sm text-rail-muted sm:block">示意流程</p>
          </div>
          <ol className="grid grid-cols-1 md:grid-cols-4">
            {STAGES.map((stage, i) => (
              <li
                key={stage.label}
                className="flex flex-col gap-3 border-rail-line px-5 py-6 not-last:border-b md:px-8 md:py-8 md:not-last:border-r md:not-last:border-b-0"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-7 items-center justify-center rounded-full border border-rail-accent/60 font-mono text-xs text-rail-accent">
                    {i + 1}
                  </span>
                  <span className="text-lg font-semibold">{stage.label}</span>
                </div>
                <p className="text-xs font-medium text-rail-accent">{stage.owner}</p>
                <p className="text-pretty text-sm leading-relaxed text-rail-muted">{stage.body}</p>
              </li>
            ))}
          </ol>
          <div className="border-t border-rail-line px-5 py-4 md:px-8">
            <p className="text-sm text-rail-muted">
              <span className="text-rail-foreground">决策线：</span>
              从第 2 步起，状态只来自银行服务端，前端只负责呈现。
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
