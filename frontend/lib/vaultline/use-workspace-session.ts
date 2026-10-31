'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import { liveAdapter, type VaultlineAdapter } from './adapters'
import { newIdempotencyKey, toApiError } from './api'
import { mapApiError, type SafeErrorState } from './errors'
import { describeStatus } from './status'
import type { BankAction, LiquiditySimulation, MessageResult } from './types'

export type ThreadItem =
  | { id: string; role: 'user'; text: string; at: number }
  | { id: string; role: 'assistant'; result: MessageResult; at: number }
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

export interface GateError {
  gate: Gate
  state: SafeErrorState
  code: string | null
}

const POLL_INTERVAL_MS = 2500

let seq = 0
const localId = () => `m${Date.now().toString(36)}${(seq++).toString(36)}`

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

  /** Bumped on reset so late responses from an abandoned session are dropped. */
  const epochRef = useRef(0)
  const conversationKeyRef = useRef<string | null>(null)
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
      const isCurrent = () => epoch === epochRef.current
      setSending(true)
      try {
        let cid = conversationId
        if (!cid) {
          conversationKeyRef.current ??= newIdempotencyKey()
          const conversation = await adapter.createConversation(conversationKeyRef.current)
          if (!isCurrent()) return
          cid = conversation.conversation_id
          setConversationId(cid)
        }
        const result = await adapter.sendMessage(cid, text, key)
        if (!isCurrent()) return
        setConnection('connected')
        setThread((prev) => [...prev, { id: localId(), role: 'assistant', result, at: Date.now() }])
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
        if (isCurrent()) setSending(false)
      }
    },
    [adapter, adoptAction, conversationId, rememberTrace],
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

  return {
    adapter,
    connection,
    conversationId,
    thread,
    sending,
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
