'use client'

import { useCallback, useRef, useState } from 'react'
import useSWR from 'swr'
import type { VaultlineAdapter } from './adapters'
import { newIdempotencyKey, toApiError } from './api'
import { mapApiError, type SafeErrorState } from './errors'
import type { JsonObject, WorkflowAdvanceResult } from './types'

export function useWorkflows(adapter: VaultlineAdapter, enabled: boolean) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [pending, setPending] = useState<'advance' | 'cancel' | 'create' | null>(null)
  const [error, setError] = useState<SafeErrorState | null>(null)
  const keysRef = useRef(new Map<string, string>())

  const list = useSWR(enabled ? 'vaultline/workflows' : null, () => adapter.listWorkflows(), {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  })

  const detail = useSWR(
    enabled && selectedId ? (['vaultline/workflow', selectedId] as const) : null,
    ([, id]) => adapter.getWorkflow(id),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  )

  const keyFor = (scope: string) => {
    let key = keysRef.current.get(scope)
    if (!key) {
      key = newIdempotencyKey()
      keysRef.current.set(scope, key)
    }
    return key
  }

  const run = useCallback(
    async <T,>(kind: 'advance' | 'cancel' | 'create', scope: string, request: (key: string) => Promise<T>) => {
      setPending(kind)
      setError(null)
      try {
        const result = await request(keyFor(scope))
        keysRef.current.delete(scope)
        return result
      } catch (e) {
        setError(mapApiError(toApiError(e)))
        return null
      } finally {
        setPending(null)
      }
    },
    [],
  )

  const advance = useCallback(
    async (id: string): Promise<WorkflowAdvanceResult | null> => {
      // Each advance is a distinct step, but a retry of the same click reuses its key.
      const result = await run('advance', `advance:${id}:${detail.data?.status ?? ''}`, (key) => adapter.advanceWorkflow(id, key))
      if (result?.workflow) await detail.mutate(result.workflow, { revalidate: false })
      void list.mutate()
      return result
    },
    [adapter, detail, list, run],
  )

  const cancel = useCallback(
    async (id: string) => {
      const result = await run('cancel', `cancel:${id}`, (key) => adapter.cancelWorkflow(id, key))
      if (result) await detail.mutate(result, { revalidate: false })
      void list.mutate()
      return result
    },
    [adapter, detail, list, run],
  )

  const create = useCallback(
    async (input: JsonObject, scope: string) => {
      const result = await run('create', `create:${scope}`, (key) => adapter.createWorkflow(input, key))
      if (result) {
        setSelectedId(result.workflow_id)
        void list.mutate()
      }
      return result
    },
    [adapter, list, run],
  )

  return { list, detail, selectedId, setSelectedId, pending, error, advance, cancel, create }
}

export type WorkflowsState = ReturnType<typeof useWorkflows>
