'use client'

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatCompactMoney, formatDate, formatMoney } from '@/lib/vaultline/format'
import type { LiquiditySimulation } from '@/lib/vaultline/types'

const SCENARIO_META: Record<string, { label: string; color: string; dash?: string }> = {
  essential_only: { label: '仅必要支出', color: 'var(--teal)' },
  essential: { label: '仅必要支出', color: 'var(--teal)' },
  expected: { label: '预期', color: 'var(--cobalt)' },
  base: { label: '预期', color: 'var(--cobalt)' },
  conservative: { label: '保守', color: 'var(--amber)', dash: '5 4' },
  stress: { label: '保守', color: 'var(--amber)', dash: '5 4' },
}
const FALLBACK_COLORS = ['var(--cobalt)', 'var(--teal)', 'var(--amber)', 'var(--steel)']

/** Plots only `liquidity.scenarios` as returned by the server. No client-side projection. */
export function LiquidityChart({ simulation }: { simulation: LiquiditySimulation }) {
  const { scenarios, currency, essential_buffer: buffer } = simulation
  if (scenarios.length === 0) {
    return <p className="text-[13px] text-muted-foreground">服务端未返回情景曲线。</p>
  }

  const series = scenarios.map((s, i) => ({
    key: s.key,
    label: s.label ?? SCENARIO_META[s.key]?.label ?? s.key,
    color: SCENARIO_META[s.key]?.color ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length],
    dash: SCENARIO_META[s.key]?.dash,
  }))

  const byDate = new Map<string, Record<string, number | string>>()
  for (const s of scenarios) {
    for (const p of s.points) {
      const row = byDate.get(p.date) ?? { date: p.date }
      row[s.key] = p.balance
      byDate.set(p.date, row)
    }
  }
  const rows = Array.from(byDate.values()).sort((a, b) => String(a.date).localeCompare(String(b.date)))
  const lows = scenarios.map((s) => {
    const low = s.points.reduce((min, p) => (p.balance < min.balance ? p : min), s.points[0])
    return { key: s.key, ...low }
  })

  return (
    <figure className="flex flex-col gap-3">
      <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="图例">
        {series.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-[13px]">
            <svg width="18" height="6" aria-hidden>
              <line x1="0" y1="3" x2="18" y2="3" stroke={s.color} strokeWidth="2" strokeDasharray={s.dash} />
            </svg>
            {s.label}
          </li>
        ))}
        {buffer !== null && (
          <li className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <svg width="18" height="6" aria-hidden>
              <line x1="0" y1="3" x2="18" y2="3" stroke="var(--red)" strokeWidth="1.5" strokeDasharray="2 3" />
            </svg>
            必要缓冲 {formatMoney(buffer, currency)}
          </li>
        )}
      </ul>
      <div className="h-64 w-full" aria-hidden>
        <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{width: 480, height: 256}}>
          <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(v) => formatDate(String(v))}
              tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border)' }}
              minTickGap={24}
            />
            <YAxis
              tickFormatter={(v) => formatCompactMoney(Number(v), currency)}
              tick={{ fontSize: 12, fill: 'var(--muted-foreground)' }}
              tickLine={false}
              axisLine={false}
              width={64}
            />
            <Tooltip
              formatter={(value, name) => [formatMoney(Number(value), currency), series.find((s) => s.key === name)?.label ?? String(name)]}
              labelFormatter={(label) => String(label)}
              contentStyle={{
                borderRadius: 8,
                border: '1px solid var(--border)',
                fontSize: 13,
                fontFamily: 'var(--font-mono)',
              }}
            />
            {buffer !== null && <ReferenceLine y={buffer} stroke="var(--red)" strokeDasharray="2 3" />}
            {series.map((s) => (
              <Line
                key={s.key}
                dataKey={s.key}
                type="monotone"
                stroke={s.color}
                strokeWidth={2}
                strokeDasharray={s.dash}
                dot={false}
                activeDot={{ r: 3 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        {lows.map((l) => `${series.find((s) => s.key === l.key)?.label}情景最低点 ${l.date}，余额 ${formatMoney(l.balance, currency)}。`).join('')}
      </figcaption>
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {lows.map((l) => (
          <div key={l.key} className="flex flex-col rounded-lg border border-border bg-card px-3 py-2">
            <dt className="text-[12px] text-muted-foreground">{series.find((s) => s.key === l.key)?.label} · 最低点</dt>
            <dd className="font-mono text-[14px]">
              {formatMoney(l.balance, currency)}
              <span className="ml-2 text-[12px] text-muted-foreground">{formatDate(l.date)}</span>
            </dd>
          </div>
        ))}
      </dl>
    </figure>
  )
}
