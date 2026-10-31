'use client'

import { useState } from 'react'
import type { LiquidityAlternative, LiquiditySimulation, LiquidityTimelinePoint, Workflow } from '../lib/api'

type Props = {
  simulation: LiquiditySimulation
  workflow?: Workflow
  creating: boolean
  error?: string
  onCreatePlan: (alternative: LiquidityAlternative) => void
}

const chartWidth = 920
const chartHeight = 280
const chartPadding = { top: 24, right: 24, bottom: 38, left: 62 }

function money(minor: number) {
  return `¥${(minor / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function shortDate(date: string) {
  return date.slice(5).replace('-', '/')
}

function chartPoints(points: LiquidityTimelinePoint[], min: number, max: number) {
  const width = chartWidth - chartPadding.left - chartPadding.right
  const height = chartHeight - chartPadding.top - chartPadding.bottom
  return points.map((point, index) => {
    const x = chartPadding.left + (points.length === 1 ? width : (index / (points.length - 1)) * width)
    const y = chartPadding.top + ((max - point.available_minor) / Math.max(1, max - min)) * height
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
}

function chartY(value: number, min: number, max: number) {
  const height = chartHeight - chartPadding.top - chartPadding.bottom
  return chartPadding.top + ((max - value) / Math.max(1, max - min)) * height
}

const scenarioLabels = {
  essential_only: '仅必要支出',
  expected: '预期消费',
  conservative: '保守消费',
}

export function LiquiditySandbox({ simulation, workflow, creating, error, onCreatePlan }: Props) {
  const [selectedID, setSelectedID] = useState(simulation.recommended_alternative_id || simulation.alternatives[0]?.alternative_id || 'current')
  const selected = simulation.alternatives.find((alternative) => alternative.alternative_id === selectedID) ?? simulation.alternatives[0]
  const allValues = [
    ...simulation.scenarios.flatMap((scenario) => scenario.points.map((point) => point.available_minor)),
    ...(selected?.expected_points.map((point) => point.available_minor) ?? []),
  ]
  const rawMin = Math.min(0, simulation.essential_buffer_minor, ...allValues)
  const rawMax = Math.max(simulation.essential_buffer_minor, ...allValues)
  const range = Math.max(1, rawMax - rawMin)
  const minValue = rawMin - range * 0.08
  const maxValue = rawMax + range * 0.08
  const bufferY = chartY(simulation.essential_buffer_minor, minValue, maxValue)
  const firstPoints = simulation.scenarios[0]?.points ?? []
  const lastPoints = firstPoints.length ? firstPoints : selected?.expected_points ?? []
  const xTicks = [0, Math.floor((lastPoints.length - 1) / 2), Math.max(0, lastPoints.length - 1)]
    .filter((value, index, values) => values.indexOf(value) === index)

  return (
    <section className="liquidity-sandbox" aria-labelledby="liquidity-title">
      <div className="liquidity-heading">
        <div>
          <span className="eyebrow">LIQUIDITY DIGITAL TWIN / WHAT-IF</span>
          <h2 id="liquidity-title">这笔预算，会碰到哪一天的房租？</h2>
          <p>{simulation.risk_reason}</p>
        </div>
        <div className={`liquidity-verdict liquidity-verdict--${simulation.verdict}`}>
          <span>SERVER VERDICT</span>
          <strong>{simulation.verdict.toUpperCase()}</strong>
          <small>{simulation.horizon_days} 天预测 · {simulation.trace_id}</small>
        </div>
      </div>

      <div className="liquidity-metrics">
        <div><span>起点可用余额</span><strong>{money(simulation.starting_available_minor)}</strong></div>
        <div><span>计划预留</span><strong>{money(simulation.proposed_budget_minor)}</strong></div>
        <div><span>建议上限</span><strong>{money(simulation.maximum_safe_budget_minor)}</strong></div>
        <div><span>必要缓冲</span><strong>{money(simulation.essential_buffer_minor)}</strong></div>
      </div>

      <div className="liquidity-main">
        <div className="liquidity-chart-panel">
          <div className="liquidity-chart-legend" aria-label="现金流情景图例">
            {simulation.scenarios.map((scenario) => (
              <span key={scenario.name} className={`chart-legend chart-legend--${scenario.name}`}>
                <i />{scenarioLabels[scenario.name]}
              </span>
            ))}
            {selected && selected.alternative_id !== 'current' && <span className="chart-legend chart-legend--selected"><i />选定方案 · 预期</span>}
          </div>
          <svg className="liquidity-chart" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label={`未来 ${simulation.horizon_days} 天可用余额情景`}>
            {[0, 1, 2, 3, 4].map((tick) => {
              const value = maxValue - ((maxValue - minValue) / 4) * tick
              const y = chartY(value, minValue, maxValue)
              return (
                <g key={tick}>
                  <line className="chart-grid" x1={chartPadding.left} x2={chartWidth - chartPadding.right} y1={y} y2={y} />
                  <text className="chart-axis-label" x={chartPadding.left - 10} y={y + 4} textAnchor="end">{money(value)}</text>
                </g>
              )
            })}
            <line className="chart-buffer" x1={chartPadding.left} x2={chartWidth - chartPadding.right} y1={bufferY} y2={bufferY} />
            <text className="chart-buffer-label" x={chartWidth - chartPadding.right} y={bufferY - 7} textAnchor="end">必要缓冲</text>
            {simulation.scenarios.map((scenario) => (
              <polyline
                key={scenario.name}
                className={`chart-line chart-line--${scenario.name}`}
                points={chartPoints(scenario.points, minValue, maxValue)}
              />
            ))}
            {selected && selected.alternative_id !== 'current' && (
              <polyline className="chart-line chart-line--selected" points={chartPoints(selected.expected_points, minValue, maxValue)} />
            )}
            {xTicks.map((index) => {
              const point = lastPoints[index]
              if (!point) return null
              const width = chartWidth - chartPadding.left - chartPadding.right
              const x = chartPadding.left + (lastPoints.length === 1 ? width / 2 : (index / (lastPoints.length - 1)) * width)
              return <text key={point.date} className="chart-axis-label" x={x} y={chartHeight - 12} textAnchor={index === 0 ? 'start' : index === lastPoints.length - 1 ? 'end' : 'middle'}>{shortDate(point.date)}</text>
            })}
          </svg>
        </div>

        <aside className="liquidity-evidence">
          <span className="terminal-label">COLLISION EVIDENCE</span>
          <h3>{simulation.recommendation}</h3>
          <div className="liquidity-event-list">
            {simulation.events.slice(0, 5).map((event, index) => (
              <div key={`${event.source_id ?? event.kind}-${index}`}>
                <span>{shortDate(event.date)}</span>
                <p>{event.description}</p>
                <code className={event.direction === 'in' ? 'is-income' : event.essential ? 'is-essential' : ''}>
                  {event.direction === 'in' ? '+' : '−'}{money(event.amount_minor)}
                </code>
              </div>
            ))}
          </div>
          <p className="liquidity-assumption">{simulation.assumptions[1]}</p>
        </aside>
      </div>

      <div className="liquidity-options">
        <div className="liquidity-options-heading">
          <div><span className="terminal-label">BANK-GENERATED ALTERNATIVES</span><h3>选择一条可执行路线</h3></div>
          <span>新方案会生成独立工作流，旧方案不会被执行</span>
        </div>
        <div className="liquidity-option-grid">
          {simulation.alternatives.map((alternative) => (
            <button
              type="button"
              key={alternative.alternative_id}
              className={`liquidity-option ${selected?.alternative_id === alternative.alternative_id ? 'is-selected' : ''}`}
              aria-pressed={selected?.alternative_id === alternative.alternative_id}
              disabled={Boolean(workflow)}
              onClick={() => setSelectedID(alternative.alternative_id)}
            >
              <span className={`liquidity-option-status liquidity-option-status--${alternative.status}`}>{alternative.status}</span>
              {alternative.recommended && <span className="liquidity-recommended">推荐</span>}
              <strong>{alternative.label}</strong>
              <b>{money(alternative.total_budget_minor)}</b>
              <p>{alternative.description}</p>
              <dl>
                <div><dt>预期最低</dt><dd>{money(alternative.expected_minimum_available_minor)}</dd></div>
                <div><dt>保守最低</dt><dd>{money(alternative.conservative_minimum_available_minor)}</dd></div>
              </dl>
              <small>{alternative.tradeoff}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="liquidity-selection">
        <div>
          <span className="terminal-label">SELECTED ROUTE</span>
          <strong>{selected?.label ?? '选择一个方案'}</strong>
          <p>{selected?.reservations.map((reservation) => `${shortDate(reservation.date)} · ${money(reservation.amount_minor)}`).join(' / ')}</p>
        </div>
        <button type="button" className="terminal-button" disabled={!selected || creating || selected.total_budget_minor <= 0 || Boolean(workflow)} onClick={() => selected && onCreatePlan(selected)}>
          {creating ? '生成工作流中' : workflow ? '已生成待授权工作流' : selected && selected.total_budget_minor <= 0 ? '当前方案无需执行' : '生成待授权预算计划'} <span>→</span>
        </button>
      </div>
      {workflow && <div className="liquidity-workflow-success"><span>WORKFLOW CREATED</span><code>{workflow.workflow_id}</code><p>状态 {workflow.status}，预算节点仍需逐项确认或 MFA。</p></div>}
      {error && <p className="live-error">{error}</p>}
    </section>
  )
}
