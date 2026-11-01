'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import { liveAdapter, type VaultlineAdapter } from './adapters'
import { newIdempotencyKey, toApiError } from './api'
import { mapApiError, type SafeErrorState } from './errors'
import { describeStatus } from './status'
import type { BankAction, LiquiditySimulation, LiveActivityEvent, MessageResult } from './types'

export type ThreadItem =
  | { id: string; role: 'user'; text: string; at: number }
  | { id: string; role: 'assistant'; result: MessageResult; activity: LiveActivityEvent[]; at: number }
  | {
      id: string
      role: 'notice'
      state: SafeErrorState
      code: string | null
      traceId: string | null
      retry: { text: string; key: string } | null
      at: number
    }

export type ConnectionState = 'idle' | 'connected' | 'unavailable'
export type Gate = 'confirm' | 'mfa' | 'cancel' | 'trigger'
export type RunControl = 'interrupt' | 'handoff' | 'rollback'

export interface GateError {
  gate: Gate
  state: SafeErrorState
  code: string | null
}

const POLL_INTERVAL_MS = 2500

let seq = 0
const localId = () => `m${Date.now().toString(36)}${(seq++).toString(36)}`

const ACTIVITY_PRIORITY: Record<string, number> = {
  agent_run_started: 0,
  model_plan_requested: 10,
  model_plan_validated: 20,
  model_plan_rejected: 20,
  model_plan_unknown: 20,
  suspicious_input_detected: 30,
  balance_queried: 40,
  transactions_queried: 40,
  bill_analyzed: 40,
  investment_products_queried: 40,
  investment_holdings_queried: 40,
  cards_queried: 40,
  subscriptions_queried: 40,
  subscription_reminders_queried: 40,
  model_liquidity_simulation_selected: 40,
  liquidity_simulation_completed: 45,
  action_created: 50,
  confirmation_succeeded: 55,
  mfa_succeeded: 55,
  authorization_gate_passed: 60,
  action_scheduled: 65,
  action_succeeded: 70,
  action_failed: 70,
  action_cancelled: 70,
  action_expired: 70,
  run_failed: 90,
  run_completed: 90,
  run_interrupted: 95,
  run_human_handoff: 95,
  run_rollback_completed: 96,
}

function orderActivity(events: LiveActivityEvent[]) {
  return [...events].sort((left, right) => {
    const byTime = Date.parse(left.occurredAt) - Date.parse(right.occurredAt)
    if (byTime !== 0) return byTime
    const byPriority = (ACTIVITY_PRIORITY[left.eventType] ?? 50) - (ACTIVITY_PRIORITY[right.eventType] ?? 50)
    return byPriority !== 0 ? byPriority : left.eventId.localeCompare(right.eventId)
  })
}

export function useWorkspaceSession(adapter: VaultlineAdapter = liveAdapter) {
  const [connection, setConnection] = useState<ConnectionState>('idle')
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [thread, setThread] = useState<ThreadItem[]>([])
  const [sending, setSending] = useState(false)
  const [actions, setActions] = useState<Record<string, BankAction>>({})
  const [activeActionId, setActiveActionId] = useState<string | null>(null)
  const [pendingGate, setPendingGate] = useState<Gate | null>(null)
  const [gateError, setGateError] = useState<GateError | null>(null)
  const [mfaFailures, setMfaFailures] = useState<Record<string, number>>({})
  const [traces, setTraces] = useState<string[]>([])
  const [liquidity, setLiquidity] = useState<LiquiditySimulation | null>(null)
  const [activity, setActivity] = useState<LiveActivityEvent[]>([])
  const [runControl, setRunControl] = useState<{ kind: RunControl; runId: string } | null>(null)

  /** Bumped on reset so late responses from an abandoned session are dropped. */
  const epochRef = useRef(0)
  const conversationKeyRef = useRef<string | null>(null)
  const activityRef = useRef<LiveActivityEvent[]>([])
  const streamAbortRef = useRef<AbortController | null>(null)
  const deliverRef = useRef(0)
  /** Stable keys for confirm / cancel / trigger intents, so a retry after a network failure is idempotent. */
  const gateKeysRef = useRef(new Map<string, string>())

  const rememberTrace = useCallback((traceId: string | null | undefined) => {
    if (!traceId) return
    setTraces((prev) => (prev.includes(traceId) ? prev : [traceId, ...prev]))
  }, [])

  const storeAction = useCallback(
    (action: BankAction) => {
      setActions((prev) => ({ ...prev, [action.action_id]: action }))
      rememberTrace(action.trace_id)
    },
    [rememberTrace],
  )

  const adoptAction = useCallback(
    (action: BankAction) => {
      storeAction(action)
      setActiveActionId(action.action_id)
      setGateError(null)
    },
    [storeAction],
  )

  const activeAction = activeActionId ? (actions[activeActionId] ?? null) : null
  const shouldPoll = describeStatus(activeAction?.status).polling

  useSWR(
    shouldPoll && activeActionId ? (['vaultline/action', activeActionId, epochRef.current] as const) : null,
    async ([, id, epoch]) => ({ epoch, action: await adapter.getAction(id) }),
    {
      refreshInterval: POLL_INTERVAL_MS,
      revalidateOnFocus: false,
      shouldRetryOnError: true,
      errorRetryInterval: POLL_INTERVAL_MS * 2,
      onSuccess: ({ epoch, action }) => {
        if (epoch === epochRef.current) storeAction(action)
      },
      onError: (error) => {
        if (toApiError(error).kind === 'unavailable') setConnection('unavailable')
      },
    },
  )

  const deliver = useCallback(
    async (text: string, key: string) => {
      const epoch = epochRef.current
      const deliverId = ++deliverRef.current
      const isCurrent = () => epoch === epochRef.current && deliverId === deliverRef.current
      const assistantId = localId()
      streamAbortRef.current?.abort()
      streamAbortRef.current = null
      setSending(true)
      setActivity([])
      activityRef.current = []
      let streamController: AbortController | null = null
      let keepStreamOpen = false
      try {
        let cid = conversationId
        if (!cid) {
          conversationKeyRef.current ??= newIdempotencyKey()
          const conversation = await adapter.createConversation(conversationKeyRef.current)
          if (!isCurrent()) return
          cid = conversation.conversation_id
          setConversationId(cid)
        }

        streamController = new AbortController()
        streamAbortRef.current = streamController
        const streamReady = new Promise<boolean>((resolve) => {
          let settled = false
          const finish = (ready: boolean) => {
            if (settled) return
            settled = true
            resolve(ready)
          }
          void adapter
            .streamConversationEvents(
              cid,
              streamController!.signal,
              (event) => {
                if (!isCurrent() || streamController!.signal.aborted) return
                if (
                  activityRef.current.some(
                    (current) =>
                      current.eventId === event.eventId ||
                      (current.traceId === event.traceId &&
                        current.eventType === event.eventType &&
                        current.outcome === event.outcome),
                  )
                ) {
                  return
                }
                const next = orderActivity([...activityRef.current, event])
                activityRef.current = next
                setActivity(next)
                setThread((prev) => {
                  let changed = false
                  const updated = prev.map((item) => {
                    if (item.role !== 'assistant' || item.id !== assistantId) return item
                    changed = true
                    return { ...item, activity: next }
                  })
                  return changed ? updated : prev
                })
              },
              () => finish(true),
            )
            .catch(() => finish(false))
            .finally(() => finish(false))
        })
        await Promise.race([
          streamReady,
          new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 750)),
        ])
        if (!isCurrent()) return

        const result = await adapter.sendMessage(cid, text, key)
        if (!isCurrent()) return
        setConnection('connected')
        setThread((prev) => [
          ...prev,
          { id: assistantId, role: 'assistant', result, activity: activityRef.current, at: Date.now() },
        ])
        if (result.trace_id) {
          const resultTraceId = result.trace_id
          void adapter
            .getAuditTrace(resultTraceId)
            .then((trace) => {
              if (!isCurrent()) return
              const recovered: LiveActivityEvent[] = trace.events.flatMap((event, index) => {
                if (!event.occurred_at) return []
                return [
                  {
                    eventId: `${resultTraceId}:${event.sequence ?? index}`,
                    traceId: resultTraceId,
                    runId: event.run_id,
                    actionId: event.action_id,
                    eventType: event.event_type,
                    outcome: event.outcome ?? 'unknown',
                    occurredAt: event.occurred_at,
                  },
                ]
              })
              const merged = recovered.length
                ? orderActivity([...activityRef.current.filter((event) => event.traceId !== resultTraceId), ...recovered])
                : activityRef.current
              activityRef.current = merged
              setActivity(merged)
              setThread((prev) =>
                prev.map((item) =>
                  item.role === 'assistant' && item.id === assistantId ? { ...item, activity: merged } : item,
                ),
              )
            })
            .catch(() => {})
        }
        // Keep the read-only stream open so later confirmation and receipt milestones extend the same execution trace.
        keepStreamOpen = true
        rememberTrace(result.trace_id)
        if (result.action) adoptAction(result.action)
        if (result.liquidity) setLiquidity(result.liquidity)
      } catch (error) {
        if (!isCurrent()) return
        const apiError = toApiError(error)
        if (apiError.kind === 'unavailable') setConnection('unavailable')
        else setConnection('connected')
        rememberTrace(apiError.traceId)
        const state = mapApiError(apiError)
        setThread((prev) => [
          ...prev,
          {
            id: localId(),
            role: 'notice',
            state,
            code: apiError.code,
            traceId: apiError.traceId,
            retry: state.retryable ? { text, key } : null,
            at: Date.now(),
          },
        ])
      } finally {
        if (!keepStreamOpen) {
          streamController?.abort()
          if (streamAbortRef.current === streamController) streamAbortRef.current = null
        }
        if (isCurrent()) {
          setSending(false)
          setActivity([])
          activityRef.current = []
        }
      }
    },
    [adapter, adoptAction, conversationId, rememberTrace],
  )

  useEffect(
    () => () => {
      streamAbortRef.current?.abort()
    },
    [],
  )

  const send = useCallback(
    (raw: string) => {
      const text = raw.trim()
      if (!text || sending) return
      setThread((prev) => [...prev, { id: localId(), role: 'user', text, at: Date.now() }])
      void deliver(text, newIdempotencyKey())
    },
    [deliver, sending],
  )

  const retry = useCallback(
    (noticeId: string) => {
      if (sending) return
      const notice = thread.find((item) => item.id === noticeId)
      if (!notice || notice.role !== 'notice' || !notice.retry) return
      const { text, key } = notice.retry
      setThread((prev) => prev.filter((item) => item.id !== noticeId))
      void deliver(text, key)
    },
    [deliver, sending, thread],
  )

  const appendControlNotice = useCallback((error: unknown) => {
    const apiError = toApiError(error)
    setConnection(apiError.kind === 'unavailable' ? 'unavailable' : 'connected')
    rememberTrace(apiError.traceId)
    setThread((prev) => [
      ...prev,
      {
        id: localId(),
        role: 'notice',
        state: mapApiError(apiError),
        code: apiError.code,
        traceId: apiError.traceId,
        retry: null,
        at: Date.now(),
      },
    ])
  }, [rememberTrace])

  const interruptRun = useCallback(async () => {
    const runId = activityRef.current.find((event) => event.runId)?.runId
    if (!runId || runControl) return
    const epoch = epochRef.current
    setRunControl({ kind: 'interrupt', runId })
    try {
      const run = await adapter.interruptRun(runId, '用户停止当前运行', newIdempotencyKey())
      if (epoch !== epochRef.current) return
      setConnection('connected')
      rememberTrace(run.trace_id)
    } catch (error) {
      if (epoch === epochRef.current) appendControlNotice(error)
    } finally {
      if (epoch === epochRef.current) setRunControl(null)
    }
  }, [adapter, appendControlNotice, rememberTrace, runControl])

  const handoffRun = useCallback(async () => {
    const runId = activityRef.current.find((event) => event.runId)?.runId
    if (!runId || runControl) return
    const epoch = epochRef.current
    setRunControl({ kind: 'handoff', runId })
    try {
      const run = await adapter.handoffRun(runId, '用户请求人工接管', newIdempotencyKey())
      if (epoch !== epochRef.current) return
      setConnection('connected')
      rememberTrace(run.trace_id)
    } catch (error) {
      if (epoch === epochRef.current) appendControlNotice(error)
    } finally {
      if (epoch === epochRef.current) setRunControl(null)
    }
  }, [adapter, appendControlNotice, rememberTrace, runControl])

  const rollbackRun = useCallback(
    async (runId: string) => {
      if (!runId || runControl) return
      const epoch = epochRef.current
      setRunControl({ kind: 'rollback', runId })
      try {
        const result = await adapter.rollbackRun(runId, newIdempotencyKey())
        if (epoch !== epochRef.current) return
        setConnection('connected')
        rememberTrace(result.run.trace_id)
        setActions((prev) => {
          const next = { ...prev }
          for (const actionId of result.cancelled_action_ids) {
            if (next[actionId]) next[actionId] = { ...next[actionId], status: 'cancelled' }
          }
          return next
        })
        const reviewRequired = result.review_action_ids.length > 0
        setThread((prev) => [
          ...prev,
          {
            id: localId(),
            role: 'notice',
            state: {
              title: reviewRequired ? '部分动作需要人工复核' : '待执行内容已撤销',
              body: reviewRequired
                ? `已取消 ${result.cancelled_action_ids.length} 个待执行动作；${result.review_action_ids.length} 个已执行或处理中动作不能静默冲正，已进入人工复核。`
                : `服务端已取消 ${result.cancelled_action_ids.length} 个待执行动作，账户未发生新的扣款。`,
              tone: reviewRequired ? 'held' : 'done',
              retryable: false,
              requiresNewRequest: false,
            },
            code: null,
            traceId: result.run.trace_id,
            retry: null,
            at: Date.now(),
          },
        ])
      } catch (error) {
        if (epoch === epochRef.current) appendControlNotice(error)
      } finally {
        if (epoch === epochRef.current) setRunControl(null)
      }
    },
    [adapter, appendControlNotice, rememberTrace, runControl],
  )

  const runGate = useCallback(
    async (gate: Gate, request: (id: string) => Promise<BankAction>) => {
      const id = activeActionId
      if (!id || pendingGate) return
      const epoch = epochRef.current
      setPendingGate(gate)
      setGateError(null)
      try {
        const next = await request(id)
        if (epoch !== epochRef.current) return
        storeAction(next)
        setConnection('connected')
        gateKeysRef.current.delete(`${id}:${gate}`)
      } catch (error) {
        if (epoch !== epochRef.current) return
        const apiError = toApiError(error)
        if (apiError.kind === 'unavailable') setConnection('unavailable')
        if (gate === 'mfa' && apiError.code === 'MFA_INVALID') {
          setMfaFailures((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }))
        }
        setGateError({ gate, state: mapApiError(apiError), code: apiError.code })
        // A terminal code means the server state moved; re-read it rather than guessing.
        if (apiError.kind === 'rejected') {
          adapter
            .getAction(id)
            .then((fresh) => epoch === epochRef.current && storeAction(fresh))
            .catch(() => {})
        }
      } finally {
        if (epoch === epochRef.current) setPendingGate(null)
      }
    },
    [activeActionId, adapter, pendingGate, storeAction],
  )

  const gateKey = useCallback(
    (gate: Gate) => {
      const mapKey = `${activeActionId}:${gate}`
      let key = gateKeysRef.current.get(mapKey)
      if (!key) {
        key = newIdempotencyKey()
        gateKeysRef.current.set(mapKey, key)
      }
      return key
    },
    [activeActionId],
  )

  const confirm = useCallback(
    () => runGate('confirm', (id) => adapter.confirmAction(id, gateKey('confirm'))),
    [adapter, gateKey, runGate],
  )
  /** The code goes straight to the adapter. It is never stored in state or logged. Each attempt is a new intent. */
  const verifyMfa = useCallback(
    (code: string) => runGate('mfa', (id) => adapter.verifyActionMfa(id, code, newIdempotencyKey())),
    [adapter, runGate],
  )
  const cancel = useCallback(
    () => runGate('cancel', (id) => adapter.cancelAction(id, gateKey('cancel'))),
    [adapter, gateKey, runGate],
  )
  const trigger = useCallback(
    () => runGate('trigger', (id) => adapter.triggerAction(id, gateKey('trigger'))),
    [adapter, gateKey, runGate],
  )

  const refreshAction = useCallback(async () => {
    if (!activeActionId) return
    const epoch = epochRef.current
    try {
      const next = await adapter.getAction(activeActionId)
      if (epoch === epochRef.current) storeAction(next)
    } catch (error) {
      if (epoch === epochRef.current && toApiError(error).kind === 'unavailable') setConnection('unavailable')
    }
  }, [activeActionId, adapter, storeAction])

  const reset = useCallback(() => {
    streamAbortRef.current?.abort()
    streamAbortRef.current = null
    activityRef.current = []
    deliverRef.current += 1
    epochRef.current += 1
    conversationKeyRef.current = null
    gateKeysRef.current = new Map()
    setConnection('idle')
    setConversationId(null)
    setThread([])
    setSending(false)
    setActions({})
    setActiveActionId(null)
    setPendingGate(null)
    setGateError(null)
    setMfaFailures({})
    setTraces([])
    setLiquidity(null)
    setActivity([])
    setRunControl(null)
  }, [])

  /** The user request that produced a given action, so “修改请求” can return it to the composer. */
  const requestTextFor = useCallback(
    (actionId: string) => {
      for (let i = thread.length - 1; i >= 0; i -= 1) {
        const item = thread[i]
        if (item.role === 'assistant' && item.result.action?.action_id === actionId) {
          for (let j = i - 1; j >= 0; j -= 1) {
            const prev = thread[j]
            if (prev.role === 'user') return prev.text
          }
        }
      }
      return ''
    },
    [thread],
  )

  const awaitingUser = useMemo(() => {
    const tone = describeStatus(activeAction?.status).tone
    return tone === 'confirm' || tone === 'mfa'
  }, [activeAction?.status])

  const activeRunId = useMemo(() => activity.find((event) => event.runId)?.runId ?? null, [activity])

  return {
    adapter,
    connection,
    conversationId,
    thread,
    sending,
    activity,
    activeRunId,
    runControl,
    actions,
    activeAction,
    activeActionId,
    setActiveActionId,
    adoptAction,
    pendingGate,
    gateError,
    mfaFailures,
    traces,
    rememberTrace,
    liquidity,
    setLiquidity,
    awaitingUser,
    send,
    retry,
    interruptRun,
    handoffRun,
    rollbackRun,
    confirm,
    verifyMfa,
    cancel,
    trigger,
    refreshAction,
    reset,
    requestTextFor,
  }
}

export type WorkspaceSession = ReturnType<typeof useWorkspaceSession>
