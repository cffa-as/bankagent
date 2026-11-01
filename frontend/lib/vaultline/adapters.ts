import * as api from './api'
import type {
  AuditTrace,
  BankAction,
  Conversation,
  JsonObject,
  LiveActivityEvent,
  MessageResult,
  Run,
  RunRollbackResult,
  Workflow,
  WorkflowAdvanceResult,
} from './types'

/**
 * The workspace talks to exactly this surface. `liveAdapter` is the Go banking API over HTTP.
 * POST methods take the idempotency key of the user intent so a retry reuses it.
 */
export interface VaultlineAdapter {
  createConversation(key?: string): Promise<Conversation>
  sendMessage(conversationId: string, content: string, key: string): Promise<MessageResult>
  getRun(runId: string): Promise<Run>
  interruptRun(runId: string, reason: string, key: string): Promise<Run>
  handoffRun(runId: string, reason: string, key: string): Promise<Run>
  rollbackRun(runId: string, key: string): Promise<RunRollbackResult>
  streamConversationEvents(
    conversationId: string,
    signal: AbortSignal,
    onEvent: (event: LiveActivityEvent) => void,
    onReady?: () => void,
  ): Promise<void>
  getAction(actionId: string): Promise<BankAction>
  confirmAction(actionId: string, key: string): Promise<BankAction>
  verifyActionMfa(actionId: string, code: string, key: string): Promise<BankAction>
  cancelAction(actionId: string, key: string): Promise<BankAction>
  triggerAction(actionId: string, key: string): Promise<BankAction>
  listWorkflows(): Promise<Workflow[]>
  getWorkflow(workflowId: string): Promise<Workflow>
  createWorkflow(input: JsonObject, key: string): Promise<Workflow>
  advanceWorkflow(workflowId: string, key: string): Promise<WorkflowAdvanceResult>
  cancelWorkflow(workflowId: string, key: string): Promise<Workflow>
  getAuditTrace(traceId: string): Promise<AuditTrace>
}

export const liveAdapter: VaultlineAdapter = {
  createConversation: api.createConversation,
  sendMessage: api.sendMessage,
  getRun: api.getRun,
  interruptRun: api.interruptRun,
  handoffRun: api.handoffRun,
  rollbackRun: api.rollbackRun,
  streamConversationEvents: api.streamConversationEvents,
  getAction: api.getAction,
  confirmAction: api.confirmAction,
  verifyActionMfa: api.verifyActionMfa,
  cancelAction: api.cancelAction,
  triggerAction: api.triggerAction,
  listWorkflows: api.listWorkflows,
  getWorkflow: api.getWorkflow,
  createWorkflow: api.createWorkflow,
  advanceWorkflow: api.advanceWorkflow,
  cancelWorkflow: api.cancelWorkflow,
  getAuditTrace: api.getAuditTrace,
}
