'use client'

import { FormEvent, useState } from 'react'
import { VaultlineMark } from '../components/vaultline-mark'
import { cancelAction, confirmAction, createConversation, sendMessage, verifyMfa, type Action, type MessageResult } from '../lib/api'

type Stage = 'intent' | 'risk' | 'auth' | 'mfa'

const stages: Array<{ id: Stage; no: string; label: string; english: string }> = [
  { id: 'intent', no: '01', label: '意图', english: 'Intent' },
  { id: 'risk', no: '02', label: '风险', english: 'Server risk' },
  { id: 'auth', no: '03', label: '授权', english: 'Authorization' },
  { id: 'mfa', no: '04', label: 'MFA', english: 'Bank MFA' },
]

const stageCopy: Record<Stage, { status: string; title: string; body: string; action: string }> = {
  intent: { status: '候选操作 · 不可执行', title: '意图已理解', body: '自然语言请求被整理成候选操作，模型只负责准备，不拥有执行权限。', action: '交给服务端审查' },
  risk: { status: '服务端已分级 · L2', title: '风险由银行判定', body: '金额、收款人和动作类型进入服务端规则，风险结果不能由模型或页面修改。', action: '查看授权快照' },
  auth: { status: '等待显式授权', title: '动作快照已锁定', body: '授权前展示不可静默修改的动作快照，并绑定单一 Action ID 和有效期。', action: '进入银行 MFA' },
  mfa: { status: '需银行 MFA · 未执行', title: '执行门等待验证', body: 'MFA 只由银行通道验证。验证通过也只打开执行门，最终结果仍以业务回执为准。', action: '已到授权门' },
}

export default function Home() {
  const [stage, setStage] = useState<Stage>('intent')
  const [message, setMessage] = useState('转 500 元给王明，备注房租')
  const [conversationId, setConversationId] = useState<string>()
  const [liveResult, setLiveResult] = useState<MessageResult>()
  const [liveAction, setLiveAction] = useState<Action>()
  const [liveState, setLiveState] = useState<'idle' | 'sending' | 'connected' | 'error'>('idle')
  const [liveError, setLiveError] = useState('')
  const [mfaCode, setMfaCode] = useState('123456')
  const [actionBusy, setActionBusy] = useState(false)
  const currentIndex = stages.findIndex((item) => item.id === stage)
  const current = stageCopy[stage]

  function advance() {
    setStage(stages[Math.min(currentIndex + 1, stages.length - 1)].id)
  }

  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!message.trim() || liveState === 'sending') return
    setLiveState('sending')
    setLiveError('')
    try {
      const activeConversation = conversationId ?? (await createConversation()).data.conversation_id
      if (!conversationId) setConversationId(activeConversation)
      const response = await sendMessage(activeConversation, message.trim())
      setLiveResult(response.data)
      setLiveAction(response.data.action)
      setStage(response.data.action?.status === 'awaiting_mfa' ? 'mfa' : response.data.action ? 'auth' : 'intent')
      setLiveState('connected')
    } catch (error) {
      setLiveState('error')
      setLiveError(error instanceof Error ? error.message : '无法连接服务端')
    }
  }

  async function authorizeAction() {
    if (!liveAction || actionBusy) return
    setActionBusy(true)
    setLiveError('')
    try {
      const response = liveAction.risk_level === 'yellow'
        ? await confirmAction(liveAction.action_id)
        : await verifyMfa(liveAction.action_id, mfaCode)
      setLiveAction(response.data)
      setStage(response.data.status === 'awaiting_mfa' ? 'mfa' : 'auth')
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
      setStage('intent')
    } catch (error) {
      setLiveError(error instanceof Error ? error.message : '动作取消失败')
    } finally {
      setActionBusy(false)
    }
  }

  const liveStatus = liveState === 'sending' ? 'sending' : liveState === 'connected' ? 'server linked' : liveState === 'error' ? 'offline' : 'demo only'
  const liveActionStatus = liveAction ? `${liveAction.status} · ${liveAction.risk_level}` : '尚未生成 Action'
  const actionSummary = liveAction?.summary ?? {}
  const actionLabel = liveAction?.risk_level === 'red' ? '验证并继续' : liveAction?.risk_level === 'yellow' ? '确认并执行' : '服务端已处理'
  const actionLocked = !liveAction || ['succeeded', 'failed', 'cancelled', 'expired'].includes(liveAction.status)


  return (
    <main>
      <header className="site-header">
        <a className="brand-link" href="#top" aria-label="Vaultline 首页"><VaultlineMark /></a>
        <nav className="top-nav" aria-label="主导航"><a href="#product">Product</a><a href="#security">Security</a><a href="#docs">Docs</a></nav>
        <div className="header-actions"><span className="status-dot"><i /> Synthetic environment</span><a className="header-cta" href="#demo">Open demo <span>↗</span></a></div>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="kicker"><span className="kicker-line" /> SERVER-CONTROLLED BANKING INTELLIGENCE</p>
          <h1>智能理解意图，<br /><em>控制权留在银行。</em></h1>
          <p className="hero-lede">Vaultline 把自然语言请求变成可审查的候选动作。风险、授权、MFA、执行、幂等与审计，始终由银行服务端掌握。</p>
          <div className="hero-actions"><a className="primary-button" href="#demo">查看受控路径 <span>↓</span></a><a className="text-button" href="#security">安全边界 <span>↗</span></a></div>
          <div className="hero-stats" aria-label="安全控制摘要"><div><strong>04</strong><span>server gates</span></div><div><strong>01</strong><span>action snapshot</span></div><div><strong>00</strong><span>executed in demo</span></div></div>
        </div>

        <div className="hero-stage" id="demo">
          <div className="stage-grid" aria-hidden="true" /><div className="stage-orbit stage-orbit--one" aria-hidden="true" /><div className="stage-orbit stage-orbit--two" aria-hidden="true" />
          <div className="floating-seal"><VaultlineMark /></div><div className="stage-caption"><span>VAULTLINE OS / 01</span><span>CONTROL SURFACE</span></div>
          <div className="terminal-window">
            <div className="terminal-topbar"><span className="window-dots"><i /><i /><i /></span><code>secure-session / demo-0417</code><span className="terminal-status"><i /> server controlled</span></div>
            <div className="terminal-content">
              <div className="terminal-request"><span className="terminal-label">USER · NATURAL LANGUAGE REQUEST</span><p>“转 500 元给王明，备注房租”</p><div className="request-line"><span>CONVERSATION</span><code>{conversationId ?? 'CNV-20A8'}</code></div><div className="request-line"><span>TRACE</span><code>{liveResult?.run_id ?? 'TRC-91D4E'}</code></div><div className="live-console"><div className="live-console-heading"><span className="terminal-label">LIVE API ADAPTER</span><span className={`live-status live-status--${liveState}`}><i /> {liveStatus}</span></div><form onSubmit={submitMessage}><input aria-label="发送给银行服务端的自然语言请求" value={message} onChange={(event) => setMessage(event.target.value)} /><button type="submit" disabled={liveState === 'sending'}>{liveState === 'sending' ? '发送中' : '发送到服务端'} <span>↗</span></button></form>{liveResult && <p className="live-result">{liveResult.text ?? liveResult.reply_type} · <code>{liveActionStatus}</code></p>}{liveError && <p className="live-error">{liveError} · 当前仍可浏览合成演示</p>}</div></div>
              <div className="terminal-control"><div className="control-heading"><span className={`control-icon control-icon--${stage}`}>{stage === 'intent' ? '↗' : stage === 'risk' ? '!' : stage === 'auth' ? '◎' : '⌁'}</span><div><span className="terminal-label">{current.status}</span><h2>{liveAction ? liveActionStatus : current.title}</h2></div></div><p className="control-copy">{liveAction?.result ? '服务端已返回业务回执，页面只展示回执中的结果。' : current.body}</p><dl className="action-snapshot"><div><dt>收款人</dt><dd>{String(actionSummary.beneficiary_name ?? '王明')} ···8842</dd></div><div><dt>金额</dt><dd>¥{(Number(actionSummary.amount_minor ?? 50000) / 100).toFixed(2)}</dd></div><div><dt>Action ID</dt><dd>{liveAction?.action_id ?? 'ACT-7F2A'}</dd></div><div><dt>回执</dt><dd>{liveAction?.tool_receipt?.reference ?? '未签发'}</dd></div></dl>{liveAction?.risk_level === 'red' && liveAction.status === 'awaiting_mfa' && <label className="mfa-field">MFA 验证码<input inputMode="numeric" maxLength={6} value={mfaCode} onChange={(event) => setMfaCode(event.target.value)} aria-label="MFA 验证码" /></label>}<div className="action-controls"><button className="terminal-button" onClick={liveAction ? authorizeAction : advance} disabled={actionBusy || (liveAction ? actionLocked : stage === 'mfa')}>{liveAction ? actionLabel : current.action}<span>→</span></button>{liveAction && !actionLocked && <button className="text-button" onClick={revokeAction} disabled={actionBusy}>取消动作</button>}</div><p className="terminal-note">合成演示数据 · 无真实账户 · 没有发生真实资金操作</p></div>
            </div>
            <div className="controlled-path" aria-label="服务端受控路径">{stages.map((item, index) => <button key={item.id} className={`path-node ${item.id === stage ? 'is-active' : ''} ${index < currentIndex ? 'is-complete' : ''}`} onClick={() => setStage(item.id)}><span>{item.no}</span><b>{item.label}</b><small>{item.english}</small></button>)}</div>
          </div>
          <div className="stage-foot"><span>MODEL PROPOSES</span><span className="stage-arrow">→</span><span>BANK SERVER DECIDES</span><span className="stage-arrow">→</span><span>RECEIPT PENDING</span></div>
        </div>
      </section>

      <section className="control-strip" id="product" aria-label="四道控制">{['Server Risk', 'Explicit Auth', 'Bank MFA', 'Audit Trail'].map((item, index) => <div key={item}><span>0{index + 1}</span><strong>{item}</strong><i /></div>)}</section>
      <section className="principles" id="security"><div className="section-intro"><span className="eyebrow">THE VAULTLINE PRINCIPLE</span><h2>智能体可以准备动作，<br /><em>但不能替银行做决定。</em></h2><p>把理解交给模型，把责任和执行留给受监管的服务端。</p></div><div className="principle-list"><article><span className="principle-index">01 / SNAPSHOT</span><h3>先锁定动作</h3><p>收款人、金额、备注、有效期和 Action ID 在授权前清晰呈现。</p></article><article><span className="principle-index">02 / MFA</span><h3>再打开执行门</h3><p>敏感动作必须走银行 MFA，页面永远不会伪造成功或交易回执。</p></article><article><span className="principle-index">03 / AUDIT</span><h3>最后等待回执</h3><p>每一次状态变化都绑定 Trace ID，最终结果只来自服务端业务回执。</p></article></div></section>
      <footer className="site-footer" id="docs"><VaultlineMark compact /><span>Secure banking intelligence for a world that checks twice.</span><span className="footer-code">BANKAGENT / 0.1.0</span></footer>
    </main>
  )
}
