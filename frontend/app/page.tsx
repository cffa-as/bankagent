'use client'

import { FormEvent, useState } from 'react'
import { VaultlineMark } from '../components/vaultline-mark'
import { cancelAction, confirmAction, createConversation, getAction, sendMessage, verifyMfa, type Action, type MessageResult } from '../lib/api'

type Stage = 'intent' | 'risk' | 'auth' | 'mfa'

const stages: Array<{ id: Stage; no: string; label: string; english: string }> = [
  { id: 'intent', no: '01', label: '意图', english: 'Intent' },
  { id: 'risk', no: '02', label: '风险', english: 'Server risk' },
  { id: 'auth', no: '03', label: '授权', english: 'Authorization' },
  { id: 'mfa', no: '04', label: 'MFA', english: 'Bank MFA' },
]

const stageCopy: Record<Stage, { status: string; title: string; body: string }> = {
  intent: { status: '候选操作 · 不可执行', title: '等待真实请求', body: '输入一条银行业务请求，页面会把服务端返回的查询结果或动作快照呈现在这里。' },
  risk: { status: '服务端已分级', title: '风险由银行判定', body: '金额、收款人和动作类型进入服务端规则，风险结果不能由模型或页面修改。' },
  auth: { status: '等待显式授权', title: '动作快照已锁定', body: '授权前展示不可静默修改的动作快照，并绑定单一 Action ID 和有效期。' },
  mfa: { status: '需银行 MFA · 未执行', title: '执行门等待验证', body: 'MFA 只由银行通道验证。验证通过也只打开执行门，最终结果仍以业务回执为准。' },
}

const capabilities = [
  ['01', '智能转账', '按人名、手机号或备注发起转账，金额和收款人由服务端生成动作快照。'],
  ['02', '账单分析', '按分类查看消费、识别异常交易，查询结果保留 Trace ID。'],
  ['03', '理财操作', '查看产品与持仓，申购和赎回进入高风险授权路径。'],
  ['04', '卡片管理', '申请、额度调整、冻结与解冻都经过动作状态机。'],
  ['05', '订阅 / 代扣', '识别周期性扣费，查询或取消订阅时保留可审计记录。'],
  ['06', '跨场景联动', '把预算、日程和服务预订拆成可审核的工作流，逐步执行。'],
]

function getStage(action?: Action): Stage {
  if (!action) return 'intent'
  if (action.status === 'awaiting_mfa') return 'mfa'
  if (action.status === 'awaiting_confirmation') return 'auth'
  if (['executing', 'processing', 'reconciliation_required', 'succeeded', 'failed', 'cancelled', 'expired'].includes(action.status)) return 'risk'
  return 'risk'
}

function displayValue(value: unknown, fallback = '—') {
  if (value === undefined || value === null || value === '') return fallback
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

export default function Home() {
  const [message, setMessage] = useState('转 500 元给王明，备注房租')
  const [conversationId, setConversationId] = useState<string>()
  const [liveResult, setLiveResult] = useState<MessageResult>()
  const [liveAction, setLiveAction] = useState<Action>()
  const [liveState, setLiveState] = useState<'idle' | 'sending' | 'connected' | 'error'>('idle')
  const [liveError, setLiveError] = useState('')
  const [mfaCode, setMfaCode] = useState('')
  const [actionBusy, setActionBusy] = useState(false)
  const stage = getStage(liveAction)
  const current = stageCopy[stage]
  const currentIndex = stages.findIndex((item) => item.id === stage)

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!message.trim() || liveState === 'sending') return
    setLiveState('sending')
    setLiveError('')
    setLiveResult(undefined)
    setLiveAction(undefined)
    try {
      const activeConversation = conversationId ?? (await createConversation()).data.conversation_id
      if (!conversationId) setConversationId(activeConversation)
      const response = await sendMessage(activeConversation, message.trim())
      setLiveResult(response.data)
      setLiveAction(response.data.action)
      setLiveState('connected')
    } catch (error) {
      setLiveState('error')
      setLiveError(error instanceof Error ? error.message : '无法连接服务端')
    }
  }

  async function settleAction(action: Action) {
    if (!['executing', 'processing', 'reconciliation_required'].includes(action.status)) return action
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 500))
      const response = await getAction(action.action_id)
      if (!['executing', 'processing', 'reconciliation_required'].includes(response.data.status)) return response.data
      action = response.data
    }
    return action
  }

  async function authorizeAction() {
    if (!liveAction || actionBusy) return
    setActionBusy(true)
    setLiveError('')
    try {
      const response = liveAction.risk_level === 'yellow'
        ? await confirmAction(liveAction.action_id)
        : await verifyMfa(liveAction.action_id, mfaCode)
      setLiveAction(await settleAction(response.data))
    } catch (error) {
      setLiveError(error instanceof Error ? error.message : '动作授权失败')
    } finally {
      setActionBusy(false)
    }
  }

  async function revokeAction() {
    if (!liveAction || actionBusy) return
    setActionBusy(true)
    setLiveError('')
    try {
      const response = await cancelAction(liveAction.action_id)
      setLiveAction(response.data)
    } catch (error) {
      setLiveError(error instanceof Error ? error.message : '动作取消失败')
    } finally {
      setActionBusy(false)
    }
  }

  const liveStatus = liveState === 'sending' ? 'sending' : liveState === 'connected' ? 'server linked' : liveState === 'error' ? 'offline' : 'ready'
  const liveActionStatus = liveAction ? `${liveAction.status} · ${liveAction.risk_level}` : liveResult?.reply_type ?? '尚未生成 Action'
  const actionLabel = liveAction?.risk_level === 'red' ? '验证并继续' : liveAction?.risk_level === 'yellow' ? '确认并执行' : '服务端已处理'
  const actionLocked = !liveAction || ['succeeded', 'failed', 'cancelled', 'expired'].includes(liveAction.status)
  const result = liveAction?.result
  const queryData = liveResult && !liveAction ? liveResult.balance ?? liveResult.bill : undefined
  const isQueryResult = liveResult?.reply_type === 'query_result'
  const controlStatus = isQueryResult ? '只读查询 · 服务端已返回' : liveResult?.reply_type === 'rejected' ? '请求已拒绝' : current.status
  const controlTitle = isQueryResult ? '查询结果已返回' : liveResult?.reply_type === 'rejected' ? '请求被服务端拒绝' : liveAction ? liveActionStatus : current.title
  const controlBody = result ? '服务端已返回业务回执，页面只展示回执中的结果。' : liveResult?.text ?? current.body

  return (
    <main>
      <header className="site-header">
        <a className="brand-link" href="#top" aria-label="Vaultline 首页"><VaultlineMark /></a>
        <nav className="top-nav" aria-label="主导航"><a href="#product">Product</a><a href="#security">Security</a><a href="#demo-film">Demo film</a></nav>
        <div className="header-actions"><span className="status-dot"><i /> Synthetic environment</span><a className="header-cta" href="#demo-film">Watch demo <span>↗</span></a></div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="kicker"><span className="kicker-line" /> SECURE BANKING INTELLIGENCE</p>
          <h1>让银行业务<br /><em>一句话开始。</em></h1>
          <p className="hero-lede">Vaultline 是一个面向银行业务场景的 AI 工作台：理解自然语言，准备可审查动作，把风险、授权、MFA、执行和回执交给银行服务端。</p>
          <div className="hero-actions"><a className="primary-button" href="#demo">进入真实工作台 <span>↓</span></a><a className="text-button" href="#demo-film">观看产品演示 <span>↗</span></a></div>
          <div className="hero-stats" aria-label="产品能力摘要"><div><strong>06</strong><span>banking scenarios</span></div><div><strong>01</strong><span>server owned path</span></div><div><strong>00</strong><span>fake receipts</span></div></div>
        </div>

        <div className="hero-stage" id="demo">
          <div className="stage-grid" aria-hidden="true" /><div className="stage-orbit stage-orbit--one" aria-hidden="true" /><div className="stage-orbit stage-orbit--two" aria-hidden="true" />
          <div className="floating-seal"><VaultlineMark compact /></div><div className="stage-caption"><span>VAULTLINE / PRODUCT</span><span>REAL API WORKSPACE</span></div>
          <div className="terminal-window">
            <div className="terminal-topbar"><span className="window-dots"><i /><i /><i /></span><code>secure-session / live</code><span className="terminal-status"><i /> server controlled</span></div>
            <div className="terminal-content">
              <div className="terminal-request">
                <span className="terminal-label">USER · NATURAL LANGUAGE REQUEST</span>
                <p>“{message}”</p>
                <div className="request-line"><span>CONVERSATION</span><code>{conversationId ?? '—'}</code></div>
                <div className="request-line"><span>TRACE</span><code>{liveResult?.run_id ?? '—'}</code></div>
                <div className="live-console">
                  <div className="live-console-heading"><span className="terminal-label">LIVE API ADAPTER</span><span className={`live-status live-status--${liveState}`}><i /> {liveStatus}</span></div>
                  <form onSubmit={submitMessage}><input aria-label="发送给银行服务端的自然语言请求" value={message} onChange={(event) => setMessage(event.target.value)} /><button type="submit" disabled={liveState === 'sending'}>{liveState === 'sending' ? '发送中' : '发送到服务端'} <span>↗</span></button></form>
                  {liveResult && <p className="live-result">{liveResult.text ?? liveResult.reply_type} · <code>{liveActionStatus}</code></p>}
                  {liveError && <p className="live-error">{liveError}</p>}
                </div>
              </div>
              <div className="terminal-control">
                <div className="control-heading"><span className={`control-icon control-icon--${stage}`}>{stage === 'intent' ? '↗' : stage === 'risk' ? '!' : stage === 'auth' ? '◎' : '⌁'}</span><div><span className="terminal-label">{controlStatus}</span><h2>{controlTitle}</h2></div></div>
                <p className="control-copy">{controlBody}</p>
                {queryData && <div className="server-result"><span className="terminal-label">SERVER QUERY RESULT</span>{Object.entries(queryData).slice(0, 4).map(([key, value]) => <div key={key}><span>{key}</span><code>{displayValue(value)}</code></div>)}</div>}
                <dl className="action-snapshot"><div><dt>动作类型</dt><dd>{displayValue(liveAction?.kind, isQueryResult ? '只读查询' : '—')}</dd></div><div><dt>风险等级</dt><dd>{displayValue(liveAction?.risk_level, isQueryResult ? '只读 · 服务端返回' : '服务端返回后显示')}</dd></div><div><dt>Action ID</dt><dd>{displayValue(liveAction?.action_id)}</dd></div><div><dt>回执</dt><dd>{result ? '服务端已返回' : '未签发'}</dd></div></dl>
                {liveAction?.risk_level === 'red' && liveAction.status === 'awaiting_mfa' && <label className="mfa-field">Action MFA 验证码<input inputMode="numeric" maxLength={6} value={mfaCode} onChange={(event) => setMfaCode(event.target.value)} aria-label="Action MFA 验证码" /></label>}
                {liveAction && !actionLocked && <div className="action-controls"><button className="terminal-button" onClick={authorizeAction} disabled={actionBusy || (liveAction.risk_level === 'red' && mfaCode.length !== 6)}>{actionBusy ? '等待服务端' : actionLabel}<span>→</span></button><button className="text-button" onClick={revokeAction} disabled={actionBusy}>取消动作</button></div>}
                <p className="terminal-note">合成开发数据 · 无真实账户 · 没有发生真实资金操作</p>
              </div>
            </div>
            <div className="controlled-path" aria-label="服务端受控路径">{stages.map((item, index) => <div key={item.id} className={`path-node ${item.id === stage ? 'is-active' : ''} ${index < currentIndex ? 'is-complete' : ''}`}><span>{item.no}</span><b>{item.label}</b><small>{item.english}</small></div>)}</div>
          </div>
          <div className="stage-foot"><span>MODEL PROPOSES</span><span className="stage-arrow">→</span><span>BANK SERVER DECIDES</span><span className="stage-arrow">→</span><span>RECEIPT ONLY WHEN ISSUED</span></div>
        </div>
      </section>

      <section className="control-strip" id="product" aria-label="产品控制边界">{['Natural language', 'Server risk', 'Action snapshot', 'Bank MFA'].map((item, index) => <div key={item}><span>0{index + 1}</span><strong>{item}</strong><i /></div>)}</section>

      <section className="capabilities" aria-labelledby="capabilities-title"><div className="section-intro"><span className="eyebrow">ONE WORKSPACE / SIX BANKING CAPABILITIES</span><h2 id="capabilities-title">从一句话，<br /><em>走到一张真实回执。</em></h2><p>首页只承担品牌和产品演示。业务能力从真实 API 进入同一个受控工作台。</p></div><div className="capability-grid">{capabilities.map(([no, title, body]) => <article key={no}><span className="capability-no">{no}</span><div><h3>{title}</h3><p>{body}</p></div><span className="capability-arrow">↗</span></article>)}</div></section>

      <section className="demo-film" id="demo-film" aria-labelledby="demo-film-title"><div className="demo-film-heading"><div><span className="eyebrow">VAULTLINE / PRODUCT FILM</span><h2 id="demo-film-title">六种业务，一条安全主线。</h2></div><span className="film-meta">SYNTHETIC DATA · NO REAL TRANSACTIONS</span></div><div className="demo-film-frame"><img src="/demo/vaultline-demo.gif" alt="Vaultline 六类银行业务与安全控制的产品演示动画" /><div className="film-overlay"><span>PLAYING / 01—08</span><span>MODEL PROPOSES · BANK SERVER DECIDES</span></div></div></section>

      <section className="principles" id="security"><div className="section-intro"><span className="eyebrow">THE VAULTLINE PRINCIPLE</span><h2>智能体可以准备动作，<br /><em>但不能替银行做决定。</em></h2><p>把理解交给模型，把责任和执行留给受监管的服务端。</p></div><div className="principle-list"><article><span className="principle-index">01 / SNAPSHOT</span><h3>先锁定动作</h3><p>收款人、金额、备注、有效期和 Action ID 在授权前清晰呈现。</p></article><article><span className="principle-index">02 / MFA</span><h3>再打开执行门</h3><p>敏感动作必须走银行 MFA，页面永远不会伪造成功或交易回执。</p></article><article><span className="principle-index">03 / AUDIT</span><h3>最后等待回执</h3><p>每一次状态变化都绑定 Trace ID，最终结果只来自服务端业务回执。</p></article></div></section>
      <footer className="site-footer" id="docs"><VaultlineMark compact /><span>Secure banking intelligence for a world that checks twice.</span><span className="footer-code">BANKAGENT / 0.1.0</span></footer>
    </main>
  )
}
