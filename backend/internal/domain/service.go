package domain

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

func (s *Service) CreateConversation(ctx context.Context, userID string) (Conversation, string, error) {
	now := s.now()
	conversation := Conversation{ID: NewID("conv"), UserID: userID, CreatedAt: now}
	if err := s.repo.CreateConversation(ctx, conversation); err != nil {
		return Conversation{}, "", err
	}
	trace := NewID("tr")
	if err := s.audit(ctx, trace, conversation.ID, "", "conversation_created", "succeeded", "user", nil, now); err != nil {
		return Conversation{}, "", err
	}
	return conversation, trace, nil
}

func (s *Service) Message(ctx context.Context, userID, conversationID, text string) (MessageResult, string, error) {
	if strings.TrimSpace(text) == "" || len([]rune(text)) > 500 {
		return MessageResult{}, "", ErrInvalidArgument
	}
	owner, err := s.repo.ConversationOwner(ctx, conversationID)
	if err != nil {
		if err == sql.ErrNoRows {
			return MessageResult{}, "", ErrNotFound
		}
		return MessageResult{}, "", err
	}
	if owner != userID {
		return MessageResult{}, "", ErrForbidden
	}
	trace := NewID("tr")
	runID := NewID("run")
	now := s.now()
	if strings.Contains(text, "余额") {
		account, err := s.repo.Account(ctx, userID)
		if err != nil {
			return MessageResult{}, trace, err
		}
		if err := s.audit(ctx, trace, conversationID, "", "balance_queried", "succeeded", "tool", map[string]any{"account_id": account.ID}, now); err != nil {
			return MessageResult{}, trace, err
		}
		return MessageResult{RunID: runID, ReplyType: "query_result", Text: fmt.Sprintf("当前余额 %s %s。", yuan(account.BalanceMinor), account.Currency), Balance: &account}, trace, nil
	}
	if strings.Contains(text, "账单") || strings.Contains(text, "消费") {
		loc, err := time.LoadLocation("Asia/Shanghai")
		if err != nil {
			return MessageResult{}, trace, err
		}
		bill, err := s.repo.BillSummary(ctx, userID, now.In(loc))
		if err != nil {
			return MessageResult{}, trace, err
		}
		if err := s.audit(ctx, trace, conversationID, "", "bill_analyzed", "succeeded", "tool", map[string]any{"month": bill.Month, "transaction_count": bill.TransactionCount}, now); err != nil {
			return MessageResult{}, trace, err
		}
		return MessageResult{RunID: runID, ReplyType: "query_result", Text: fmt.Sprintf("本月消费共 %s，共 %d 笔。", yuan(bill.TotalMinor), bill.TransactionCount), Bill: &bill}, trace, nil
	}
	if strings.Contains(text, "流水") || strings.Contains(text, "交易记录") {
		records, err := s.repo.Transactions(ctx, userID)
		if err != nil {
			return MessageResult{}, trace, err
		}
		if err := s.audit(ctx, trace, conversationID, "", "transactions_queried", "succeeded", "tool", map[string]any{"count": len(records)}, now); err != nil {
			return MessageResult{}, trace, err
		}
		return MessageResult{RunID: runID, ReplyType: "query_result", Text: fmt.Sprintf("已找到 %d 笔交易记录。", len(records)), Records: records}, trace, nil
	}
	name, amount, remark, ok := parseTransfer(text)
	if ok {
		accountID, err := s.repo.Beneficiary(ctx, userID, name)
		if err != nil {
			if err == sql.ErrNoRows {
				return MessageResult{RunID: runID, ReplyType: "question", Text: "没有找到对应收款人，请提供预置收款人姓名。"}, trace, nil
			}
			return MessageResult{}, trace, err
		}
		loc, err := time.LoadLocation("Asia/Shanghai")
		if err != nil {
			return MessageResult{}, trace, err
		}
		daily, err := s.repo.DailyOutgoing(ctx, userID, now.In(loc))
		if err != nil {
			return MessageResult{}, trace, err
		}
		risk := "yellow"
		status := "awaiting_confirmation"
		if daily+amount > 100000 {
			risk, status = "red", "awaiting_mfa"
		}
		snapshot := map[string]any{"beneficiary_name": name, "beneficiary_account_id": accountID, "amount_minor": amount, "currency": "CNY", "remark": remark, "daily_outgoing_before_minor": daily}
		snapshotJSON, _ := json.Marshal(snapshot)
		action := Action{ID: NewID("act"), ConversationID: conversationID, UserID: userID, Kind: "transfer", RiskLevel: risk, Status: status, SnapshotJSON: string(snapshotJSON), Snapshot: snapshot, ExpiresAt: now.Add(5 * time.Minute), CreatedAt: now, UpdatedAt: now}
		if err := s.repo.CreateAction(ctx, action); err != nil {
			return MessageResult{}, trace, err
		}
		if err := s.audit(ctx, trace, conversationID, action.ID, "action_created", "succeeded", "system", map[string]any{"kind": action.Kind, "risk_level": risk}, now); err != nil {
			return MessageResult{}, trace, err
		}
		text := "请确认转账详情。"
		if risk == "red" {
			text = "该转账需要完成 MFA 验证。"
		}
		return MessageResult{RunID: runID, ReplyType: "action_required", Text: text, Action: ptr(action.Public())}, trace, nil
	}
	return MessageResult{RunID: runID, ReplyType: "question", Text: "我可以帮你查询余额、交易记录，或处理预置收款人的转账。"}, trace, nil
}

func (s *Service) BillSummary(ctx context.Context, userID, accountID string, month time.Time) (BillSummary, string, error) {
	account, err := s.repo.Account(ctx, userID)
	if err != nil {
		if err == sql.ErrNoRows {
			return BillSummary{}, "", ErrNotFound
		}
		return BillSummary{}, "", err
	}
	if account.ID != accountID {
		return BillSummary{}, "", ErrForbidden
	}
	trace := NewID("tr")
	summary, err := s.repo.BillSummary(ctx, userID, month)
	if err != nil {
		return BillSummary{}, trace, err
	}
	if err := s.audit(ctx, trace, "", "", "bill_analyzed", "succeeded", "tool", map[string]any{"account_id": accountID, "month": summary.Month, "transaction_count": summary.TransactionCount}, s.now()); err != nil {
		return BillSummary{}, trace, err
	}
	return summary, trace, nil
}

func (s *Service) GetAction(ctx context.Context, userID, id string) (Action, error) {
	action, err := s.repo.Action(ctx, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return Action{}, ErrNotFound
		}
		return Action{}, err
	}
	if action.UserID != userID {
		return Action{}, ErrForbidden
	}
	if s.now().After(action.ExpiresAt) && isPending(action.Status) {
		action.Status = "expired"
		action.UpdatedAt = s.now()
		if err := s.repo.UpdateAction(ctx, action); err != nil {
			return Action{}, err
		}
	}
	return action.Public(), nil
}

func (s *Service) Confirm(ctx context.Context, userID, id, _ string) (Action, string, error) {
	action, err := s.authorizedAction(ctx, userID, id)
	if err != nil {
		return Action{}, "", err
	}
	trace := NewID("tr")
	if action.RiskLevel != "yellow" || action.Status != "awaiting_confirmation" {
		return Action{}, trace, ErrActionStateConflict
	}
	if s.now().After(action.ExpiresAt) {
		action.Status = "expired"
		action.UpdatedAt = s.now()
		if err := s.repo.UpdateAction(ctx, action); err != nil {
			return Action{}, trace, err
		}
		return Action{}, trace, ErrActionExpired
	}
	if err := s.execute(ctx, &action, trace); err != nil {
		return Action{}, trace, err
	}
	return action.Public(), trace, nil
}

func (s *Service) VerifyMFA(ctx context.Context, userID, id, code string) (Action, string, error) {
	action, err := s.authorizedAction(ctx, userID, id)
	if err != nil {
		return Action{}, "", err
	}
	trace := NewID("tr")
	if action.RiskLevel != "red" || action.Status != "awaiting_mfa" {
		return Action{}, trace, ErrActionStateConflict
	}
	if s.now().After(action.ExpiresAt) {
		action.Status = "expired"
		action.UpdatedAt = s.now()
		if err := s.repo.UpdateAction(ctx, action); err != nil {
			return Action{}, trace, err
		}
		return Action{}, trace, ErrActionExpired
	}
	if code != "000000" {
		attempts, locked, err := s.repo.RecordMFAFailure(ctx, action.ID, s.now())
		if err != nil {
			return Action{}, trace, err
		}
		action.MFAAttempts = attempts
		if locked {
			action.Status = "failed"
			if err := s.audit(ctx, trace, action.ConversationID, action.ID, "mfa_locked", "failed", "system", nil, s.now()); err != nil {
				return Action{}, trace, err
			}
			return Action{}, trace, ErrMFALocked
		}
		if err := s.audit(ctx, trace, action.ConversationID, action.ID, "mfa_failed", "failed", "user", map[string]any{"attempt": attempts}, s.now()); err != nil {
			return Action{}, trace, err
		}
		return Action{}, trace, ErrMFAInvalid
	}
	if err := s.execute(ctx, &action, trace); err != nil {
		return Action{}, trace, err
	}
	return action.Public(), trace, nil
}

func (s *Service) Cancel(ctx context.Context, userID, id string) (Action, string, error) {
	action, err := s.authorizedAction(ctx, userID, id)
	if err != nil {
		return Action{}, "", err
	}
	trace := NewID("tr")
	if !isPending(action.Status) {
		return Action{}, trace, ErrActionStateConflict
	}
	now := s.now()
	cancelled, err := s.repo.CancelAction(ctx, action.ID, now)
	if err != nil {
		return Action{}, trace, err
	}
	if !cancelled {
		return Action{}, trace, ErrActionStateConflict
	}
	action.Status = "cancelled"
	action.UpdatedAt = now
	if err := s.audit(ctx, trace, action.ConversationID, action.ID, "action_cancelled", "succeeded", "user", nil, now); err != nil {
		return Action{}, trace, err
	}
	return action.Public(), trace, nil
}

func (s *Service) Audit(ctx context.Context, userID, traceID string) ([]AuditEvent, error) {
	events, err := s.repo.Audit(ctx, traceID)
	if err != nil {
		return nil, err
	}
	if len(events) == 0 {
		return nil, ErrNotFound
	}
	if events[0].ConversationID != "" {
		owner, err := s.repo.ConversationOwner(ctx, events[0].ConversationID)
		if err != nil {
			return nil, err
		}
		if owner != userID {
			return nil, ErrForbidden
		}
	}
	return events, nil
}

func (s *Service) authorizedAction(ctx context.Context, userID, id string) (Action, error) {
	action, err := s.repo.Action(ctx, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return Action{}, ErrNotFound
		}
		return Action{}, err
	}
	if action.UserID != userID {
		return Action{}, ErrForbidden
	}
	return action, nil
}

func (s *Service) execute(ctx context.Context, action *Action, trace string) error {
	now := s.now()
	var snapshot struct {
		AmountMinor     int64  `json:"amount_minor"`
		Remark          string `json:"remark"`
		BeneficiaryName string `json:"beneficiary_name"`
	}
	if err := json.Unmarshal([]byte(action.SnapshotJSON), &snapshot); err != nil {
		return err
	}
	if err := s.repo.ExecuteTransfer(ctx, *action, snapshot.AmountMinor, "转账给"+snapshot.BeneficiaryName+" "+snapshot.Remark, now); err != nil {
		if errors.Is(err, ErrInsufficientBalance) {
			action.Status = "failed"
			action.UpdatedAt = now
			if auditErr := s.audit(ctx, trace, action.ConversationID, action.ID, "transfer_failed", "failed", "tool", map[string]any{"reason": err.Error()}, now); auditErr != nil {
				return auditErr
			}
		}
		return err
	}
	action.Status = "succeeded"
	action.UpdatedAt = now
	return s.audit(ctx, trace, action.ConversationID, action.ID, "transfer_succeeded", "succeeded", "tool", map[string]any{"amount_minor": snapshot.AmountMinor}, now)
}

func (s *Service) audit(ctx context.Context, trace, conversation, action, event, outcome, actor string, detail map[string]any, now time.Time) error {
	return s.repo.AddAudit(ctx, AuditEvent{ID: NewID("evt"), TraceID: trace, ConversationID: conversation, ActionID: action, EventType: event, Outcome: outcome, Actor: actor, Detail: detail, OccurredAt: now, Sequence: 1})
}

func isPending(status string) bool {
	return status == "awaiting_confirmation" || status == "awaiting_mfa"
}
func ptr[T any](value T) *T { return &value }
