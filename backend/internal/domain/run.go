package domain

import (
	"context"
	"strings"
	"time"
)

type runIDContextKey struct{}

func withRunID(ctx context.Context, runID string) context.Context {
	return context.WithValue(ctx, runIDContextKey{}, runID)
}

func runIDFromContext(ctx context.Context) string {
	value, _ := ctx.Value(runIDContextKey{}).(string)
	return value
}

func (s *Service) beginRun(ctx context.Context, userID, conversationID, trace, runID string, now time.Time) (context.Context, error) {
	run := Run{
		ID:             runID,
		ConversationID: conversationID,
		UserID:         userID,
		TraceID:        trace,
		Status:         RunStatusRunning,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	event := newAuditEvent(trace, conversationID, "", "agent_run_started", "succeeded", "system", nil, now)
	event.RunID = runID
	if err := s.repo.CreateRun(ctx, run, event); err != nil {
		return ctx, err
	}
	return withRunID(ctx, runID), nil
}

func (s *Service) GetRun(ctx context.Context, userID, id string) (Run, error) {
	return s.repo.Run(ctx, userID, id)
}

func (s *Service) InterruptRun(ctx context.Context, userID, id, reason string) (Run, string, error) {
	run, err := s.repo.Run(ctx, userID, id)
	if err != nil {
		return Run{}, "", err
	}
	reason = normalizeRunReason(reason, "用户停止当前运行")
	if run.Status == RunStatusInterrupted {
		return run, run.TraceID, nil
	}
	event := newRunAuditEvent(run, "run_interrupted", "succeeded", "user", reason, s.now())
	updated, err := s.repo.TransitionRun(context.WithoutCancel(ctx), userID, id, RunStatusRunning, RunStatusInterrupted, reason, "", s.now(), event)
	return updated, run.TraceID, err
}

func (s *Service) HandoffRun(ctx context.Context, userID, id, reason string) (Run, string, error) {
	run, err := s.repo.Run(ctx, userID, id)
	if err != nil {
		return Run{}, "", err
	}
	reason = normalizeRunReason(reason, "用户请求人工接管")
	if run.Status == RunStatusHumanHandoff {
		return run, run.TraceID, nil
	}
	const handoffTo = "human_agent"
	event := newRunAuditEvent(run, "run_human_handoff", "succeeded", "user", reason, s.now())
	updated, err := s.repo.TransitionRun(context.WithoutCancel(ctx), userID, id, RunStatusRunning, RunStatusHumanHandoff, reason, handoffTo, s.now(), event)
	return updated, run.TraceID, err
}

func (s *Service) RollbackRun(ctx context.Context, userID, id string) (RunRollbackResult, string, error) {
	run, err := s.repo.Run(ctx, userID, id)
	if err != nil {
		return RunRollbackResult{}, "", err
	}
	result, err := s.repo.RollbackRun(context.WithoutCancel(ctx), userID, id, s.now())
	return result, run.TraceID, err
}

func (s *Service) finishRun(ctx context.Context, userID, id string, status string, cause error) error {
	run, err := s.repo.Run(ctx, userID, id)
	if err != nil {
		return err
	}
	if run.Status != RunStatusRunning {
		return nil
	}
	reason := "运行完成"
	outcome := "succeeded"
	eventType := "run_completed"
	if status == RunStatusFailed {
		reason = "运行未完成"
		outcome = "failed"
		eventType = "run_failed"
	}
	event := newRunAuditEvent(run, eventType, outcome, "system", reason, s.now())
	return s.repo.CompleteRun(context.WithoutCancel(ctx), userID, id, status, reason, s.now(), event)
}

func (s *Service) controlledRunResult(ctx context.Context, userID, id string) (MessageResult, bool, error) {
	run, err := s.repo.Run(ctx, userID, id)
	if err != nil {
		return MessageResult{}, false, err
	}
	switch run.Status {
	case RunStatusInterrupted:
		return MessageResult{
			RunID: run.ID, RunStatus: run.Status, ReplyType: "question",
			Text: "已停止当前运行，未继续执行新的业务动作。",
		}, true, nil
	case RunStatusHumanHandoff:
		return MessageResult{
			RunID: run.ID, RunStatus: run.Status, ReplyType: "question",
			Text: "已将当前请求转交人工处理，Agent 不会继续推进原有动作。",
		}, true, nil
	default:
		return MessageResult{}, false, nil
	}
}

func newRunAuditEvent(run Run, eventType, outcome, actor, reason string, now time.Time) AuditEvent {
	event := newAuditEvent(run.TraceID, run.ConversationID, "", eventType, outcome, actor, nil, now)
	event.RunID = run.ID
	if strings.TrimSpace(reason) != "" {
		event.Detail = map[string]any{"reason": reason}
	}
	return event
}

func normalizeRunReason(value, fallback string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return fallback
	}
	if len([]rune(value)) > 200 {
		value = string([]rune(value)[:200])
	}
	return value
}
