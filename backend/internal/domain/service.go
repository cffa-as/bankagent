package domain

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"regexp"
	"strings"
	"time"

	"github.com/cffa-as/bankagent/internal/agent"
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

func (s *Service) CreateTransferAction(ctx context.Context, userID, conversationID, beneficiaryName string, amountMinor int64, remark string) (Action, string, error) {
	accountID, err := s.repo.Beneficiary(ctx, userID, strings.TrimSpace(beneficiaryName))
	if errors.Is(err, sql.ErrNoRows) {
		return Action{}, "", ErrNotFound
	}
	if err != nil {
		return Action{}, "", err
	}
	return s.createTransferAction(ctx, userID, conversationID, beneficiaryName, "", accountID, amountMinor, remark, nil)
}

func (s *Service) CreateScheduledTransferAction(ctx context.Context, userID, conversationID, beneficiaryName string, amountMinor int64, remark string, scheduledAt time.Time) (Action, string, error) {
	now := s.now()
	if !scheduledAt.After(now) || scheduledAt.After(now.AddDate(1, 0, 0)) {
		return Action{}, "", ErrInvalidArgument
	}
	accountID, err := s.repo.Beneficiary(ctx, userID, strings.TrimSpace(beneficiaryName))
	if errors.Is(err, sql.ErrNoRows) {
		return Action{}, "", ErrNotFound
	}
	if err != nil {
		return Action{}, "", err
	}
	return s.createTransferAction(ctx, userID, conversationID, beneficiaryName, "", accountID, amountMinor, remark, &scheduledAt)
}

func (s *Service) CreateTransferActionByPhone(ctx context.Context, userID, conversationID, phone string, amountMinor int64, remark string) (Action, string, error) {
	phone = strings.TrimSpace(phone)
	if phone == "" {
		return Action{}, "", ErrInvalidArgument
	}
	name, accountID, err := s.repo.BeneficiaryByPhone(ctx, userID, phone)
	if errors.Is(err, sql.ErrNoRows) {
		return Action{}, "", ErrNotFound
	}
	if err != nil {
		return Action{}, "", err
	}
	return s.createTransferAction(ctx, userID, conversationID, name, phone, accountID, amountMinor, remark, nil)
}

func (s *Service) createTransferAction(ctx context.Context, userID, conversationID, beneficiaryName, phone, accountID string, amountMinor int64, remark string, scheduledAt *time.Time) (Action, string, error) {
	beneficiaryName, remark = strings.TrimSpace(beneficiaryName), strings.TrimSpace(remark)
	if amountMinor <= 0 || beneficiaryName == "" || len([]rune(beneficiaryName)) > 100 || len([]rune(remark)) > 200 {
		return Action{}, "", ErrInvalidArgument
	}
	if err := s.checkConversationOwner(ctx, userID, conversationID); err != nil {
		return Action{}, "", err
	}
	loc, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		return Action{}, "", err
	}
	riskDay := s.now().In(loc)
	if scheduledAt != nil {
		riskDay = scheduledAt.In(loc)
	}
	daily, err := s.repo.DailyOutgoing(ctx, userID, riskDay)
	if err != nil {
		return Action{}, "", err
	}
	risk, status := "yellow", "awaiting_confirmation"
	if daily+amountMinor > 100000 {
		risk, status = "red", "awaiting_mfa"
	}
	snapshot := map[string]any{
		"beneficiary_name": beneficiaryName, "beneficiary_phone": phone, "beneficiary_account_id": accountID,
		"amount_minor": amountMinor, "currency": "CNY", "remark": remark,
		"daily_outgoing_before_minor": daily,
	}
	if scheduledAt != nil {
		snapshot["scheduled_at"] = scheduledAt.UTC().Format(time.RFC3339)
	}
	return s.createActionRecord(ctx, userID, conversationID, "transfer", risk, status, snapshot)
}

func (s *Service) CreateTransferSplitAction(ctx context.Context, userID, conversationID string, totalAmountMinor int64, participants []SplitParticipant) (Action, string, error) {
	if totalAmountMinor <= 0 || len(participants) < 2 || len(participants) > 10 {
		return Action{}, "", ErrInvalidArgument
	}
	if err := s.checkConversationOwner(ctx, userID, conversationID); err != nil {
		return Action{}, "", err
	}
	payers, seen := 0, make(map[string]bool, len(participants))
	normalized := make([]SplitParticipant, len(participants))
	for i, participant := range participants {
		name, phone := strings.TrimSpace(participant.Name), strings.TrimSpace(participant.Phone)
		key := phone
		if key == "" {
			key = "name:" + name
		}
		if (name == "" && phone == "") || len([]rune(name)) > 100 || (phone != "" && !regexp.MustCompile(`^[0-9]{11}$`).MatchString(phone)) || seen[key] {
			return Action{}, "", ErrInvalidArgument
		}
		seen[key] = true
		if participant.IsPayer {
			payers++
		}
		normalized[i] = participant
		normalized[i].Name, normalized[i].Phone = name, phone
	}
	if payers != 1 {
		return Action{}, "", ErrInvalidArgument
	}
	base, remainder := totalAmountMinor/int64(len(normalized)), totalAmountMinor%int64(len(normalized))
	var collectible int64
	for i := range normalized {
		normalized[i].AmountMinor = base
		if int64(i) < remainder {
			normalized[i].AmountMinor++
		}
		if !normalized[i].IsPayer {
			collectible += normalized[i].AmountMinor
		}
	}
	snapshot := map[string]any{
		"total_amount_minor": totalAmountMinor, "collectible_minor": collectible,
		"currency": "CNY", "participants": normalized,
	}
	return s.createActionRecord(ctx, userID, conversationID, "transfer_split", "yellow", "awaiting_confirmation", snapshot)
}

func (s *Service) CreateCardApplicationAction(ctx context.Context, userID, conversationID, cardType string) (Action, string, error) {
	cardType = strings.TrimSpace(cardType)
	if cardType != "virtual" {
		return Action{}, "", ErrInvalidArgument
	}
	if err := s.checkConversationOwner(ctx, userID, conversationID); err != nil {
		return Action{}, "", err
	}
	return s.createActionRecord(ctx, userID, conversationID, "card_application", "yellow", "awaiting_confirmation", map[string]any{
		"card_type": cardType,
	})
}

func (s *Service) CreateCardLimitAction(ctx context.Context, userID, conversationID, cardID string, limitMinor int64) (Action, string, error) {
	if limitMinor < 0 {
		return Action{}, "", ErrInvalidArgument
	}
	if err := s.checkConversationOwner(ctx, userID, conversationID); err != nil {
		return Action{}, "", err
	}
	cards, err := s.repo.Cards(ctx, userID)
	if err != nil {
		return Action{}, "", err
	}
	for _, card := range cards {
		if card.ID == cardID {
			snapshot := map[string]any{"card_id": card.ID, "previous_limit_minor": card.LimitMinor, "target_limit_minor": limitMinor, "masked_number": card.MaskedNumber}
			return s.createActionRecord(ctx, userID, conversationID, "card_limit_change", "red", "awaiting_mfa", snapshot)
		}
	}
	return Action{}, "", ErrNotFound
}

func (s *Service) CreateCardStatusAction(ctx context.Context, userID, conversationID, cardID, targetStatus string) (Action, string, error) {
	if targetStatus != "active" && targetStatus != "frozen" && targetStatus != "lost" {
		return Action{}, "", ErrInvalidArgument
	}
	if err := s.checkConversationOwner(ctx, userID, conversationID); err != nil {
		return Action{}, "", err
	}
	cards, err := s.repo.Cards(ctx, userID)
	if err != nil {
		return Action{}, "", err
	}
	for _, card := range cards {
		if card.ID == cardID {
			validTransition := (targetStatus == "frozen" && card.Status == "active") ||
				(targetStatus == "lost" && (card.Status == "active" || card.Status == "frozen")) ||
				(targetStatus == "active" && (card.Status == "frozen" || card.Status == "lost"))
			if !validTransition {
				return Action{}, "", ErrActionStateConflict
			}
			snapshot := map[string]any{"card_id": card.ID, "previous_status": card.Status, "target_status": targetStatus, "masked_number": card.MaskedNumber}
			risk, status := "yellow", "awaiting_confirmation"
			if targetStatus != "frozen" {
				risk, status = "red", "awaiting_mfa"
			}
			return s.createActionRecord(ctx, userID, conversationID, "card_status_change", risk, status, snapshot)
		}
	}
	return Action{}, "", ErrNotFound
}

func (s *Service) CreateSubscriptionCancelAction(ctx context.Context, userID, conversationID, subscriptionID string) (Action, string, error) {
	if err := s.checkConversationOwner(ctx, userID, conversationID); err != nil {
		return Action{}, "", err
	}
	subscriptions, err := s.repo.Subscriptions(ctx, userID, "")
	if err != nil {
		return Action{}, "", err
	}
	for _, subscription := range subscriptions {
		if subscription.ID == subscriptionID && (subscription.Status == "active" || subscription.Status == "paused") {
			snapshot := map[string]any{"subscription_id": subscription.ID, "merchant_ref": subscription.MerchantRef}
			return s.createActionRecord(ctx, userID, conversationID, "subscription_cancel", "yellow", "awaiting_confirmation", snapshot)
		}
	}
	return Action{}, "", ErrNotFound
}

func (s *Service) checkConversationOwner(ctx context.Context, userID, conversationID string) error {
	owner, err := s.repo.ConversationOwner(ctx, conversationID)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if owner != userID {
		return ErrForbidden
	}
	return nil
}

func (s *Service) CreateInvestmentPurchaseAction(ctx context.Context, userID, conversationID, productID string, amountMinor int64, riskAcknowledged bool) (Action, string, error) {
	return s.createInvestmentAction(ctx, userID, conversationID, productID, "", amountMinor, riskAcknowledged)
}

func (s *Service) CreateInvestmentRedemptionAction(ctx context.Context, userID, conversationID, holdingID string) (Action, string, error) {
	return s.createInvestmentAction(ctx, userID, conversationID, "", holdingID, 0, false)
}

func (s *Service) createInvestmentAction(ctx context.Context, userID, conversationID, productID, holdingID string, amountMinor int64, riskAcknowledged bool) (Action, string, error) {
	owner, err := s.repo.ConversationOwner(ctx, conversationID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Action{}, "", ErrNotFound
		}
		return Action{}, "", err
	}
	if owner != userID {
		return Action{}, "", ErrForbidden
	}
	if productID != "" {
		if amountMinor <= 0 || !riskAcknowledged {
			return Action{}, "", ErrInvalidArgument
		}
		product, err := s.repo.Product(ctx, productID)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return Action{}, "", ErrNotFound
			}
			return Action{}, "", err
		}
		if amountMinor < product.MinimumAmountMinor {
			return Action{}, "", ErrInvalidArgument
		}
		snapshot := map[string]any{"product_id": product.ID, "product_name": product.Name, "amount_minor": amountMinor, "currency": "CNY", "risk_acknowledged": true}
		return s.createInvestmentActionRecord(ctx, userID, conversationID, "investment_purchase", snapshot)
	}
	if holdingID == "" {
		return Action{}, "", ErrInvalidArgument
	}
	holding, err := s.repo.ActiveHolding(ctx, userID, holdingID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return Action{}, "", ErrNotFound
		}
		return Action{}, "", err
	}
	snapshot := map[string]any{"holding_id": holding.ID, "product_id": holding.ProductID, "product_name": holding.ProductName, "principal_minor": holding.AmountMinor, "currency": "CNY"}
	return s.createInvestmentActionRecord(ctx, userID, conversationID, "investment_redemption", snapshot)
}

func (s *Service) createInvestmentActionRecord(ctx context.Context, userID, conversationID, kind string, snapshot map[string]any) (Action, string, error) {
	return s.createActionRecord(ctx, userID, conversationID, kind, "red", "awaiting_mfa", snapshot)
}

func (s *Service) createActionRecord(ctx context.Context, userID, conversationID, kind, riskLevel, status string, snapshot map[string]any) (Action, string, error) {
	now := s.now()
	trace := NewID("tr")
	snapshotJSON, err := json.Marshal(snapshot)
	if err != nil {
		return Action{}, trace, err
	}
	expiresAt := now.Add(5 * time.Minute)
	if value, ok := snapshot["scheduled_at"].(string); ok {
		if scheduledAt, err := time.Parse(time.RFC3339, value); err == nil {
			expiresAt = scheduledAt.Add(5 * time.Minute)
		}
	}
	action := Action{ID: NewID("act"), ConversationID: conversationID, UserID: userID, Kind: kind, RiskLevel: riskLevel, Status: status, SnapshotJSON: string(snapshotJSON), Snapshot: snapshot, ExpiresAt: expiresAt, CreatedAt: now, UpdatedAt: now}
	if err := s.repo.CreateAction(ctx, action); err != nil {
		return Action{}, trace, err
	}
	if err := s.audit(ctx, trace, conversationID, action.ID, "action_created", "succeeded", "system", map[string]any{"kind": action.Kind, "risk_level": action.RiskLevel}, now); err != nil {
		return Action{}, trace, err
	}
	return action.Public(), trace, nil
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
	recent, err := s.repo.ConversationMessages(ctx, userID, conversationID, 6)
	if err != nil {
		return MessageResult{}, trace, err
	}
	history := make([]string, 0, len(recent))
	for _, message := range recent {
		if now.Sub(message.CreatedAt) <= 30*time.Minute {
			history = append(history, message.Text)
		}
	}
	if err := s.repo.AddConversationMessage(ctx, ConversationMessage{
		ID: NewID("msg"), ConversationID: conversationID, UserID: userID, Role: "user", Text: conversationContextText(text), CreatedAt: now,
	}); err != nil {
		return MessageResult{}, trace, err
	}
	continuation := strings.TrimSpace(text)
	if len(history) > 0 && len([]rune(text)) <= 50 {
		continuation = history[len(history)-1] + " " + continuation
	}
	if strings.Contains(text, "余额") {
		account, err := s.repo.Account(ctx, userID)
		if err != nil {
			return MessageResult{}, trace, err
		}
		if err := s.audit(ctx, trace, conversationID, "", "balance_queried", "succeeded", "tool", map[string]any{"account_id": account.ID}, now); err != nil {
			return MessageResult{}, trace, err
		}
		return MessageResult{RunID: runID, ReplyType: "query_result", Text: fmt.Sprintf("当前余额 %s %s，可用余额 %s %s。", yuan(account.BalanceMinor), account.Currency, yuan(account.AvailableMinor), account.Currency), Balance: &account}, trace, nil
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
	if strings.Contains(text, "理财") && strings.Contains(text, "赎回") {
		holdings, err := s.repo.Holdings(ctx, userID)
		if err != nil {
			return MessageResult{}, trace, err
		}
		active := make([]Holding, 0, len(holdings))
		for _, holding := range holdings {
			if holding.Status == "active" {
				active = append(active, holding)
			}
		}
		holdingID := parseHoldingID(text)
		if holdingID == "" && len(active) == 1 {
			holdingID = active[0].ID
		}
		if holdingID == "" {
			if len(active) == 0 {
				return MessageResult{RunID: runID, ReplyType: "question", Text: "当前没有可赎回的理财持仓。"}, trace, nil
			}
			return MessageResult{RunID: runID, ReplyType: "question", Text: "你有多笔可赎回持仓，请提供持仓 ID。"}, trace, nil
		}
		holding, err := s.repo.ActiveHolding(ctx, userID, holdingID)
		if err != nil {
			if err == sql.ErrNoRows {
				return MessageResult{RunID: runID, ReplyType: "question", Text: "没有找到可赎回的持仓，请提供有效的持仓 ID。"}, trace, nil
			}
			return MessageResult{}, trace, err
		}
		snapshot := map[string]any{"holding_id": holding.ID, "product_id": holding.ProductID, "product_name": holding.ProductName, "principal_minor": holding.AmountMinor, "currency": "CNY"}
		snapshotJSON, _ := json.Marshal(snapshot)
		action := Action{ID: NewID("act"), ConversationID: conversationID, UserID: userID, Kind: "investment_redemption", RiskLevel: "red", Status: "awaiting_mfa", SnapshotJSON: string(snapshotJSON), Snapshot: snapshot, ExpiresAt: now.Add(5 * time.Minute), CreatedAt: now, UpdatedAt: now}
		if err := s.repo.CreateAction(ctx, action); err != nil {
			return MessageResult{}, trace, err
		}
		if err := s.audit(ctx, trace, conversationID, action.ID, "action_created", "succeeded", "system", map[string]any{"kind": action.Kind, "risk_level": action.RiskLevel}, now); err != nil {
			return MessageResult{}, trace, err
		}
		return MessageResult{RunID: runID, ReplyType: "action_required", Text: "该理财赎回需要完成 MFA 验证。", Action: ptr(action.Public())}, trace, nil
	}
	if strings.Contains(text, "理财") && strings.Contains(text, "申购") {
		amount, ok := parseInvestmentPurchase(text)
		if !ok {
			return MessageResult{RunID: runID, ReplyType: "question", Text: "请提供申购金额，例如：申购稳健理财 100 元。"}, trace, nil
		}
		productID := "product_conservative"
		if strings.Contains(text, "均衡") {
			productID = "product_balanced"
		} else if strings.Contains(text, "进取") {
			productID = "product_aggressive"
		}
		product, err := s.repo.Product(ctx, productID)
		if err != nil {
			if err == sql.ErrNoRows {
				return MessageResult{}, trace, ErrNotFound
			}
			return MessageResult{}, trace, err
		}
		if amount < product.MinimumAmountMinor {
			return MessageResult{}, trace, ErrInvalidArgument
		}
		snapshot := map[string]any{"product_id": product.ID, "product_name": product.Name, "amount_minor": amount, "currency": "CNY"}
		snapshotJSON, _ := json.Marshal(snapshot)
		action := Action{ID: NewID("act"), ConversationID: conversationID, UserID: userID, Kind: "investment_purchase", RiskLevel: "red", Status: "awaiting_mfa", SnapshotJSON: string(snapshotJSON), Snapshot: snapshot, ExpiresAt: now.Add(5 * time.Minute), CreatedAt: now, UpdatedAt: now}
		if err := s.repo.CreateAction(ctx, action); err != nil {
			return MessageResult{}, trace, err
		}
		if err := s.audit(ctx, trace, conversationID, action.ID, "action_created", "succeeded", "system", map[string]any{"kind": action.Kind, "risk_level": action.RiskLevel}, now); err != nil {
			return MessageResult{}, trace, err
		}
		return MessageResult{RunID: runID, ReplyType: "action_required", Text: "该理财申购需要完成 MFA 验证。", Action: ptr(action.Public())}, trace, nil
	}
	if strings.Contains(text, "卡") && (strings.Contains(text, "冻结") || strings.Contains(text, "解冻") || strings.Contains(text, "挂失") || strings.Contains(text, "解挂")) {
		status, verb := "frozen", "冻结"
		if strings.Contains(text, "解冻") {
			status, verb = "active", "解冻"
		}
		if strings.Contains(text, "挂失") {
			status, verb = "lost", "挂失"
		}
		if strings.Contains(text, "解挂") {
			status, verb = "active", "解挂"
		}
		action, actionTrace, err := s.CreateCardStatusAction(ctx, userID, conversationID, "card_demo", status)
		if errors.Is(err, ErrActionStateConflict) {
			return MessageResult{RunID: runID, ReplyType: "question", Text: "当前卡片状态不支持该操作。"}, trace, nil
		}
		if err != nil {
			return MessageResult{}, trace, err
		}
		text := "请确认" + verb + "卡片 **** 1234。"
		if action.RiskLevel == "red" {
			text = "该操作需要完成 MFA 验证。"
		}
		return MessageResult{RunID: runID, ReplyType: "action_required", Text: text, Action: ptr(action.Public())}, actionTrace, nil
	}
	if strings.Contains(text, "订阅") && strings.Contains(text, "取消") {
		subscriptionID := "sub_streaming"
		merchant := "demo-streaming"
		if strings.Contains(text, "云") || strings.Contains(text, "cloud") {
			subscriptionID, merchant = "sub_cloud", "demo-cloud"
		}
		action, actionTrace, err := s.CreateSubscriptionCancelAction(ctx, userID, conversationID, subscriptionID)
		if errors.Is(err, ErrNotFound) {
			return MessageResult{RunID: runID, ReplyType: "question", Text: "没有找到可取消的预置订阅。"}, trace, nil
		}
		if err != nil {
			return MessageResult{}, trace, err
		}
		return MessageResult{RunID: runID, ReplyType: "action_required", Text: "请确认取消" + merchant + "订阅。", Action: ptr(action.Public())}, actionTrace, nil
	}
	if strings.Contains(continuation, "生日") && strings.Contains(continuation, "预算") {
		budget, eventAt, ok := parseBirthdayPlan(continuation)
		if !ok {
			return MessageResult{RunID: runID, ReplyType: "question", Text: "请提供预算金额和生日日期，例如：爱人生日预算1000元，日期2026-11-08。"}, trace, nil
		}
		workflow, workflowTrace, err := s.CreateBirthdayWorkflow(ctx, userID, budget, eventAt)
		if err != nil {
			return MessageResult{}, trace, err
		}
		return MessageResult{RunID: runID, ReplyType: "workflow_created", Text: "已生成生日预算、提醒和采购 DAG。", Workflow: &workflow}, workflowTrace, nil
	}
	phone, phoneAmount, phoneRemark, phoneOK := parsePhoneTransfer(text)
	if !phoneOK && continuation != text {
		phone, phoneAmount, phoneRemark, phoneOK = parsePhoneTransfer(continuation)
	}
	if phoneOK {
		action, actionTrace, err := s.CreateTransferActionByPhone(ctx, userID, conversationID, phone, phoneAmount, phoneRemark)
		if errors.Is(err, ErrNotFound) {
			return MessageResult{RunID: runID, ReplyType: "question", Text: "没有找到对应手机号，请提供预置收款人手机号。"}, trace, nil
		}
		if err != nil {
			return MessageResult{}, trace, err
		}
		text := "请确认转账详情。"
		if action.RiskLevel == "red" {
			text = "该转账需要完成 MFA 验证。"
		}
		return MessageResult{RunID: runID, ReplyType: "action_required", Text: text, Action: ptr(action.Public())}, actionTrace, nil
	}
	name, amount, remark, ok := parseTransfer(text)
	if !ok && continuation != text {
		name, amount, remark, ok = parseTransfer(strings.ReplaceAll(continuation, "转账", "转"))
	}
	if ok {
		action, actionTrace, err := s.CreateTransferAction(ctx, userID, conversationID, name, amount, remark)
		if errors.Is(err, ErrNotFound) {
			return MessageResult{RunID: runID, ReplyType: "question", Text: "没有找到对应收款人，请提供预置收款人姓名。"}, trace, nil
		}
		if err != nil {
			return MessageResult{}, trace, err
		}
		text := "请确认转账详情。"
		if action.RiskLevel == "red" {
			text = "该转账需要完成 MFA 验证。"
		}
		return MessageResult{RunID: runID, ReplyType: "action_required", Text: text, Action: ptr(action.Public())}, actionTrace, nil
	}
	if s.model != nil {
		plan, modelErr := s.model.Plan(ctx, text, history)
		if modelErr == nil && plan.Intent != "unknown" {
			result, handled, err := s.handleIntentPlan(ctx, userID, conversationID, runID, plan, trace)
			if err != nil {
				return MessageResult{}, trace, err
			}
			if handled {
				return result, trace, nil
			}
		} else if modelErr != nil {
			if err := s.audit(ctx, trace, conversationID, "", "model_plan_rejected", "failed", "model", nil, now); err != nil {
				return MessageResult{}, trace, err
			}
		} else {
			if err := s.audit(ctx, trace, conversationID, "", "model_plan_unknown", "failed", "model", nil, now); err != nil {
				return MessageResult{}, trace, err
			}
		}
	}
	return MessageResult{RunID: runID, ReplyType: "question", Text: "我可以处理预置账户的转账、AA 收款、账单分析、理财、卡片、订阅和跨场景计划。"}, trace, nil
}

func (s *Service) handleIntentPlan(ctx context.Context, userID, conversationID, runID string, plan agent.IntentPlan, trace string) (MessageResult, bool, error) {
	steps := make([]string, 0, len(plan.CandidatePlan))
	for _, step := range plan.CandidatePlan {
		steps = append(steps, step.Kind)
	}
	if err := s.audit(ctx, trace, conversationID, "", "model_plan_validated", "succeeded", "model", map[string]any{"intent": plan.Intent, "candidate_steps": steps}, s.now()); err != nil {
		return MessageResult{}, true, err
	}
	question := func(message string) (MessageResult, bool, error) {
		return MessageResult{RunID: runID, ReplyType: "question", Text: message}, true, nil
	}
	actionReply := func(action Action, err error) (MessageResult, bool, error) {
		if errors.Is(err, ErrNotFound) {
			return question("没有找到对应业务资源，请检查收款人、卡片、产品或持仓。")
		}
		if err != nil {
			return MessageResult{}, true, err
		}
		if err := s.audit(ctx, trace, conversationID, action.ID, "model_action_candidate_selected", "succeeded", "model", map[string]any{"kind": action.Kind, "risk_level": action.RiskLevel}, s.now()); err != nil {
			return MessageResult{}, true, err
		}
		text := "请确认操作详情。"
		if action.RiskLevel == "red" {
			text = "该操作需要完成 MFA 验证。"
		}
		return MessageResult{RunID: runID, ReplyType: "action_required", Text: text, Action: ptr(action.Public())}, true, nil
	}

	switch plan.Intent {
	case "balance_query":
		account, err := s.repo.Account(ctx, userID)
		if err != nil {
			return MessageResult{}, true, err
		}
		if err := s.audit(ctx, trace, conversationID, "", "balance_queried", "succeeded", "tool", map[string]any{"account_id": account.ID}, s.now()); err != nil {
			return MessageResult{}, true, err
		}
		return MessageResult{RunID: runID, ReplyType: "query_result", Text: fmt.Sprintf("当前余额 %s %s，可用余额 %s %s。", yuan(account.BalanceMinor), account.Currency, yuan(account.AvailableMinor), account.Currency), Balance: &account}, true, nil
	case "transaction_query":
		records, err := s.repo.Transactions(ctx, userID)
		if err != nil {
			return MessageResult{}, true, err
		}
		if err := s.audit(ctx, trace, conversationID, "", "transactions_queried", "succeeded", "tool", map[string]any{"count": len(records)}, s.now()); err != nil {
			return MessageResult{}, true, err
		}
		return MessageResult{RunID: runID, ReplyType: "query_result", Text: fmt.Sprintf("已找到 %d 笔交易记录。", len(records)), Records: records}, true, nil
	case "bill_query":
		bill, err := s.repo.BillSummary(ctx, userID, s.now())
		if err != nil {
			return MessageResult{}, true, err
		}
		if err := s.audit(ctx, trace, conversationID, "", "bill_analyzed", "succeeded", "tool", map[string]any{"month": bill.Month, "transaction_count": bill.TransactionCount}, s.now()); err != nil {
			return MessageResult{}, true, err
		}
		return MessageResult{RunID: runID, ReplyType: "query_result", Text: fmt.Sprintf("本月消费共 %s，发现 %d 笔异常交易。", yuan(bill.TotalMinor), len(bill.Anomalies)), Bill: &bill}, true, nil
	case "investment_query":
		products, err := s.repo.Products(ctx, "")
		if err != nil {
			return MessageResult{}, true, err
		}
		if err := s.audit(ctx, trace, conversationID, "", "investment_products_queried", "succeeded", "tool", map[string]any{"count": len(products)}, s.now()); err != nil {
			return MessageResult{}, true, err
		}
		return MessageResult{RunID: runID, ReplyType: "query_result", Text: fmt.Sprintf("找到 %d 款理财产品。", len(products)), Data: products}, true, nil
	case "card_query":
		cards, err := s.repo.Cards(ctx, userID)
		if err != nil {
			return MessageResult{}, true, err
		}
		if err := s.audit(ctx, trace, conversationID, "", "cards_queried", "succeeded", "tool", map[string]any{"count": len(cards)}, s.now()); err != nil {
			return MessageResult{}, true, err
		}
		return MessageResult{RunID: runID, ReplyType: "query_result", Text: fmt.Sprintf("找到 %d 张卡片。", len(cards)), Data: cards}, true, nil
	case "subscription_query":
		subscriptions, err := s.repo.Subscriptions(ctx, userID, "")
		if err != nil {
			return MessageResult{}, true, err
		}
		if err := s.audit(ctx, trace, conversationID, "", "subscriptions_queried", "succeeded", "tool", map[string]any{"count": len(subscriptions)}, s.now()); err != nil {
			return MessageResult{}, true, err
		}
		return MessageResult{RunID: runID, ReplyType: "query_result", Text: fmt.Sprintf("找到 %d 项订阅代扣。", len(subscriptions)), Data: subscriptions}, true, nil
	case "transfer", "scheduled_transfer":
		name := planString(plan, "beneficiary_name")
		phone := planString(plan, "beneficiary_phone")
		amount, ok := planInt64(plan, "amount_minor")
		if (name == "" && phone == "") || !ok {
			return question("请补充收款人姓名和转账金额。")
		}
		var action Action
		var err error
		if plan.Intent == "scheduled_transfer" {
			scheduledAt, parseErr := time.Parse(time.RFC3339, planString(plan, "scheduled_at"))
			if parseErr != nil {
				return question("请补充 RFC3339 格式的预约时间。")
			}
			action, _, err = s.CreateScheduledTransferAction(ctx, userID, conversationID, name, amount, planString(plan, "remark"), scheduledAt)
		} else if name == "" {
			action, _, err = s.CreateTransferActionByPhone(ctx, userID, conversationID, phone, amount, planString(plan, "remark"))
		} else {
			action, _, err = s.CreateTransferAction(ctx, userID, conversationID, name, amount, planString(plan, "remark"))
		}
		return actionReply(action, err)
	case "transfer_split":
		total, ok := planInt64(plan, "total_amount_minor")
		participants, participantsOK := planParticipants(plan)
		if !ok || !participantsOK {
			return question("请补充 AA 总金额和至少两位参与人，并标明由谁收款。")
		}
		action, _, err := s.CreateTransferSplitAction(ctx, userID, conversationID, total, participants)
		return actionReply(action, err)
	case "birthday_plan":
		budget, ok := planInt64(plan, "budget_minor")
		eventAt, parseErr := time.Parse(time.RFC3339, planString(plan, "event_at"))
		if !ok || parseErr != nil {
			return question("请补充生日预算和生日日期。")
		}
		workflow, _, err := s.CreateBirthdayWorkflow(ctx, userID, budget, eventAt)
		if err != nil {
			return MessageResult{}, true, err
		}
		return MessageResult{RunID: runID, ReplyType: "workflow_created", Text: "已生成生日预算、提醒和采购 DAG。", Workflow: &workflow}, true, nil
	case "investment_purchase":
		productID := planString(plan, "product_id")
		amount, amountOK := planInt64(plan, "amount_minor")
		riskAcknowledged := planBool(plan, "risk_acknowledged")
		if productID == "" || !amountOK || !riskAcknowledged {
			return question("请补充理财产品、申购金额，并确认已阅读风险提示。")
		}
		action, _, err := s.CreateInvestmentPurchaseAction(ctx, userID, conversationID, productID, amount, true)
		return actionReply(action, err)
	case "investment_redemption":
		holdingID := planString(plan, "holding_id")
		if holdingID == "" {
			return question("请提供要赎回的持仓 ID。")
		}
		action, _, err := s.CreateInvestmentRedemptionAction(ctx, userID, conversationID, holdingID)
		return actionReply(action, err)
	case "card_status_change":
		cardID, target := planString(plan, "card_id"), planString(plan, "target_status")
		if cardID == "" || target == "" {
			return question("请提供卡片和要执行的状态操作。")
		}
		action, _, err := s.CreateCardStatusAction(ctx, userID, conversationID, cardID, target)
		return actionReply(action, err)
	case "subscription_cancel":
		subscriptionID := planString(plan, "subscription_id")
		if subscriptionID == "" {
			return question("请提供要取消的订阅 ID。")
		}
		action, _, err := s.CreateSubscriptionCancelAction(ctx, userID, conversationID, subscriptionID)
		return actionReply(action, err)
	default:
		return MessageResult{}, false, nil
	}
}

func planString(plan agent.IntentPlan, key string) string {
	value, _ := plan.Entities[key].(string)
	return strings.TrimSpace(value)
}

func planInt64(plan agent.IntentPlan, key string) (int64, bool) {
	value, ok := plan.Entities[key].(float64)
	if !ok || value <= 0 || value != math.Trunc(value) || value > 1e15 {
		return 0, false
	}
	return int64(value), true
}

func planBool(plan agent.IntentPlan, key string) bool {
	value, _ := plan.Entities[key].(bool)
	return value
}

func planParticipants(plan agent.IntentPlan) ([]SplitParticipant, bool) {
	raw, ok := plan.Entities["participants"].([]any)
	if !ok || len(raw) < 2 || len(raw) > 10 {
		return nil, false
	}
	participants := make([]SplitParticipant, 0, len(raw))
	for _, item := range raw {
		object, ok := item.(map[string]any)
		if !ok {
			return nil, false
		}
		participant := SplitParticipant{}
		participant.Name, _ = object["name"].(string)
		participant.Phone, _ = object["phone"].(string)
		participant.IsPayer, _ = object["is_payer"].(bool)
		participants = append(participants, participant)
	}
	return participants, true
}

func (s *Service) ListProducts(ctx context.Context, riskLevel string, page, pageSize int) (ProductPage, string, error) {
	if page < 1 || pageSize < 1 || pageSize > 100 {
		return ProductPage{}, "", ErrInvalidArgument
	}
	if riskLevel != "" && riskLevel != "conservative" && riskLevel != "balanced" && riskLevel != "aggressive" {
		return ProductPage{}, "", ErrInvalidArgument
	}
	products, err := s.repo.Products(ctx, riskLevel)
	if err != nil {
		return ProductPage{}, "", err
	}
	total := len(products)
	start := (page - 1) * pageSize
	if start > total {
		start = total
	}
	end := start + pageSize
	if end > total {
		end = total
	}
	items := products[start:end]
	if items == nil {
		items = []Product{}
	}
	trace := NewID("tr")
	if err := s.audit(ctx, trace, "", "", "investment_products_queried", "succeeded", "tool", map[string]any{"risk_level": riskLevel, "count": total, "page": page, "page_size": pageSize}, s.now()); err != nil {
		return ProductPage{}, trace, err
	}
	return ProductPage{Items: items, Page: page, PageSize: pageSize, Total: total}, trace, nil
}

func (s *Service) ListHoldings(ctx context.Context, userID string) ([]Holding, string, error) {
	holdings, err := s.repo.Holdings(ctx, userID)
	if err != nil {
		return nil, "", err
	}
	trace := NewID("tr")
	if err := s.audit(ctx, trace, "", "", "investment_holdings_queried", "succeeded", "tool", map[string]any{"count": len(holdings)}, s.now()); err != nil {
		return nil, trace, err
	}
	if holdings == nil {
		holdings = []Holding{}
	}
	return holdings, trace, nil
}

func (s *Service) ListCards(ctx context.Context, userID string) ([]Card, string, error) {
	cards, err := s.repo.Cards(ctx, userID)
	if err != nil {
		return nil, "", err
	}
	trace := NewID("tr")
	if err := s.audit(ctx, trace, "", "", "cards_queried", "succeeded", "tool", map[string]any{"count": len(cards)}, s.now()); err != nil {
		return nil, trace, err
	}
	if cards == nil {
		cards = []Card{}
	}
	return cards, trace, nil
}

func (s *Service) ListSubscriptions(ctx context.Context, userID, status string) ([]Subscription, string, error) {
	if status != "" && status != "active" && status != "cancelled" && status != "paused" {
		return nil, "", ErrInvalidArgument
	}
	subscriptions, err := s.repo.Subscriptions(ctx, userID, status)
	if err != nil {
		return nil, "", err
	}
	trace := NewID("tr")
	if err := s.audit(ctx, trace, "", "", "subscriptions_queried", "succeeded", "tool", map[string]any{"status": status, "count": len(subscriptions)}, s.now()); err != nil {
		return nil, trace, err
	}
	if subscriptions == nil {
		subscriptions = []Subscription{}
	}
	return subscriptions, trace, nil
}

func (s *Service) AccountBalance(ctx context.Context, userID, accountID string) (Account, string, error) {
	account, err := s.repo.Account(ctx, userID)
	if err != nil {
		if err == sql.ErrNoRows {
			return Account{}, "", ErrNotFound
		}
		return Account{}, "", err
	}
	if account.ID != accountID {
		return Account{}, "", ErrForbidden
	}
	trace := NewID("tr")
	if err := s.audit(ctx, trace, "", "", "balance_queried", "succeeded", "tool", map[string]any{"account_id": accountID}, s.now()); err != nil {
		return Account{}, trace, err
	}
	return account, trace, nil
}

func (s *Service) ListTransactions(ctx context.Context, userID, accountID string, from, to *time.Time, category string, page, pageSize int) (TransactionPage, string, error) {
	account, err := s.repo.Account(ctx, userID)
	if err != nil {
		if err == sql.ErrNoRows {
			return TransactionPage{}, "", ErrNotFound
		}
		return TransactionPage{}, "", err
	}
	if account.ID != accountID {
		return TransactionPage{}, "", ErrForbidden
	}
	if page < 1 || pageSize < 1 || pageSize > 100 {
		return TransactionPage{}, "", ErrInvalidArgument
	}
	records, err := s.repo.Transactions(ctx, userID)
	if err != nil {
		return TransactionPage{}, "", err
	}
	filtered := make([]Transaction, 0, len(records))
	for _, record := range records {
		if from != nil && record.CreatedAt.Before(*from) {
			continue
		}
		if to != nil && !record.CreatedAt.Before(*to) {
			continue
		}
		if category != "" && record.Category != category {
			continue
		}
		filtered = append(filtered, record)
	}
	total := len(filtered)
	start := (page - 1) * pageSize
	if start > total {
		start = total
	}
	end := start + pageSize
	if end > total {
		end = total
	}
	items := filtered[start:end]
	if items == nil {
		items = []Transaction{}
	}
	trace := NewID("tr")
	if err := s.audit(ctx, trace, "", "", "transactions_queried", "succeeded", "tool", map[string]any{"account_id": accountID, "count": total, "page": page, "page_size": pageSize}, s.now()); err != nil {
		return TransactionPage{}, trace, err
	}
	return TransactionPage{Items: items, Page: page, PageSize: pageSize, Total: total}, trace, nil
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

func (s *Service) BillReport(ctx context.Context, userID, accountID, period string, year int) (BillSummary, string, error) {
	account, err := s.repo.Account(ctx, userID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return BillSummary{}, "", ErrNotFound
		}
		return BillSummary{}, "", err
	}
	if accountID != "" && account.ID != accountID {
		return BillSummary{}, "", ErrForbidden
	}
	loc, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		return BillSummary{}, "", err
	}
	if year <= 0 {
		year = s.now().In(loc).Year()
	}
	if period == "" {
		period = "year"
	}
	if period != "year" {
		return BillSummary{}, "", ErrInvalidArgument
	}
	start := time.Date(year, 1, 1, 0, 0, 0, 0, loc)
	summary, err := s.repo.BillSummaryRange(ctx, userID, start, start.AddDate(1, 0, 0), fmt.Sprintf("%d", year))
	trace := NewID("tr")
	if err != nil {
		return BillSummary{}, trace, err
	}
	if err := s.audit(ctx, trace, "", "", "bill_report_queried", "succeeded", "tool", map[string]any{"period": period, "year": year}, s.now()); err != nil {
		return BillSummary{}, trace, err
	}
	return summary, trace, nil
}

func (s *Service) SubscriptionReminders(ctx context.Context, userID string, days int) ([]SubscriptionReminder, string, error) {
	if days < 0 || days > 365 {
		return nil, "", ErrInvalidArgument
	}
	items, err := s.repo.Subscriptions(ctx, userID, "active")
	if err != nil {
		return nil, "", err
	}
	now := s.now()
	var reminders []SubscriptionReminder
	for _, item := range items {
		delta := item.NextChargeAt.Sub(now)
		until := int(math.Ceil(delta.Hours() / 24))
		if delta < 0 {
			until = 0
		}
		if until <= days {
			reminders = append(reminders, SubscriptionReminder{SubscriptionID: item.ID, MerchantRef: item.MerchantRef, AmountMinor: item.AmountMinor, Currency: item.Currency, NextChargeAt: item.NextChargeAt, DaysUntil: until})
		}
	}
	trace := NewID("tr")
	if err := s.audit(ctx, trace, "", "", "subscription_reminders_queried", "succeeded", "tool", map[string]any{"days": days, "count": len(reminders)}, now); err != nil {
		return nil, trace, err
	}
	return reminders, trace, nil
}

func (s *Service) GetAction(ctx context.Context, userID, id string) (Action, string, error) {
	trace := NewID("tr")
	action, err := s.repo.Action(ctx, id)
	if err != nil {
		if err == sql.ErrNoRows {
			return Action{}, trace, ErrNotFound
		}
		return Action{}, trace, err
	}
	if action.UserID != userID {
		return Action{}, trace, ErrForbidden
	}
	if s.now().After(action.ExpiresAt) && isPending(action.Status) {
		if err := s.expireAction(ctx, &action, trace, s.now()); err != nil {
			return Action{}, trace, err
		}
	}
	return action.Public(), trace, nil
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
		if err := s.expireAction(ctx, &action, trace, s.now()); err != nil {
			return Action{}, trace, err
		}
		return Action{}, trace, ErrActionExpired
	}
	if err := s.proceedAuthorized(ctx, &action, trace); err != nil {
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
		if err := s.expireAction(ctx, &action, trace, s.now()); err != nil {
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
			if err := s.failWorkflowAction(ctx, &action, s.now()); err != nil {
				return Action{}, trace, err
			}
			return Action{}, trace, ErrMFALocked
		}
		if err := s.audit(ctx, trace, action.ConversationID, action.ID, "mfa_failed", "failed", "user", map[string]any{"attempt": attempts}, s.now()); err != nil {
			return Action{}, trace, err
		}
		return Action{}, trace, ErrMFAInvalid
	}
	if err := s.proceedAuthorized(ctx, &action, trace); err != nil {
		return Action{}, trace, err
	}
	return action.Public(), trace, nil
}

func (s *Service) TriggerScheduled(ctx context.Context, userID, id string) (Action, string, error) {
	action, err := s.authorizedAction(ctx, userID, id)
	if err != nil {
		return Action{}, "", err
	}
	trace := NewID("tr")
	if action.Status != "scheduled" {
		return Action{}, trace, ErrActionStateConflict
	}
	scheduledAt, ok := actionScheduledAt(action)
	if !ok {
		return Action{}, trace, ErrActionStateConflict
	}
	now := s.now()
	if now.Before(scheduledAt) {
		return Action{}, trace, ErrActionStateConflict
	}
	if now.After(action.ExpiresAt) {
		if err := s.expireAction(ctx, &action, trace, now); err != nil {
			return Action{}, trace, err
		}
		return Action{}, trace, ErrActionExpired
	}
	if err := s.enforceTransferLimit(ctx, &action, trace, now); err != nil {
		return Action{}, trace, err
	}
	if err := s.execute(ctx, &action, trace); err != nil {
		if workflowErr := s.failWorkflowAction(ctx, &action, now); workflowErr != nil {
			return Action{}, trace, workflowErr
		}
		return Action{}, trace, err
	}
	if err := s.finishWorkflowAction(ctx, &action, now); err != nil {
		return Action{}, trace, err
	}
	if err := s.audit(ctx, trace, action.ConversationID, action.ID, "scheduled_action_triggered", "succeeded", "system", map[string]any{"scheduled_at": scheduledAt}, now); err != nil {
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
	if err := s.cancelWorkflowAction(ctx, &action, now); err != nil {
		return Action{}, trace, err
	}
	if err := s.audit(ctx, trace, action.ConversationID, action.ID, "action_cancelled", "succeeded", "user", nil, now); err != nil {
		return Action{}, trace, err
	}
	return action.Public(), trace, nil
}

func (s *Service) expireAction(ctx context.Context, action *Action, trace string, now time.Time) error {
	action.Status, action.UpdatedAt = "expired", now
	if err := s.repo.UpdateAction(ctx, *action); err != nil {
		return err
	}
	if err := s.cancelWorkflowAction(ctx, action, now); err != nil {
		return err
	}
	return s.audit(ctx, trace, action.ConversationID, action.ID, "action_expired", "failed", "system", nil, now)
}

func (s *Service) proceedAuthorized(ctx context.Context, action *Action, trace string) error {
	now := s.now()
	if scheduledAt, ok := actionScheduledAt(*action); ok && now.Before(scheduledAt) {
		scheduled, err := s.repo.ScheduleAction(ctx, action.ID, action.Status, now)
		if err != nil {
			return err
		}
		if !scheduled {
			return ErrActionStateConflict
		}
		action.Status, action.UpdatedAt = "scheduled", now
		return s.audit(ctx, trace, action.ConversationID, action.ID, "action_scheduled", "succeeded", "user", map[string]any{"scheduled_at": scheduledAt}, now)
	}
	if err := s.enforceTransferLimit(ctx, action, trace, now); err != nil {
		return err
	}
	if err := s.execute(ctx, action, trace); err != nil {
		if workflowErr := s.failWorkflowAction(ctx, action, now); workflowErr != nil {
			return workflowErr
		}
		return err
	}
	return s.finishWorkflowAction(ctx, action, now)
}

func (s *Service) enforceTransferLimit(ctx context.Context, action *Action, trace string, now time.Time) error {
	if action.Kind != "transfer" || action.RiskLevel != "yellow" {
		return nil
	}
	var snapshot struct {
		AmountMinor int64 `json:"amount_minor"`
	}
	if err := json.Unmarshal([]byte(action.SnapshotJSON), &snapshot); err != nil {
		return err
	}
	daily, err := s.repo.DailyOutgoing(ctx, action.UserID, now)
	if err != nil {
		return err
	}
	if daily+snapshot.AmountMinor <= 100000 {
		return nil
	}
	action.Status, action.UpdatedAt = "failed", now
	if err := s.repo.UpdateAction(ctx, *action); err != nil {
		return err
	}
	if err := s.audit(ctx, trace, action.ConversationID, action.ID, "transfer_reauthorization_required", "failed", "system", map[string]any{"daily_outgoing_minor": daily, "amount_minor": snapshot.AmountMinor}, now); err != nil {
		return err
	}
	return ErrActionStateConflict
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
	} else if workflowID, ok := events[0].Detail["workflow_id"].(string); ok {
		owner, err := s.repo.WorkflowOwner(ctx, workflowID)
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
	switch action.Kind {
	case "transfer":
		var snapshot struct {
			AmountMinor     int64  `json:"amount_minor"`
			Remark          string `json:"remark"`
			BeneficiaryName string `json:"beneficiary_name"`
		}
		if err := json.Unmarshal([]byte(action.SnapshotJSON), &snapshot); err != nil {
			return err
		}
		result, err := s.repo.ExecuteTransfer(ctx, *action, snapshot.AmountMinor, "转账给"+snapshot.BeneficiaryName+" "+snapshot.Remark, now)
		if err != nil {
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
		action.Result = result
		return s.audit(ctx, trace, action.ConversationID, action.ID, "transfer_succeeded", "succeeded", "tool", map[string]any{"transaction_id": result.TransactionID, "amount_minor": result.AmountMinor}, now)
	case "transfer_split":
		var snapshot TransferSplitSnapshot
		if err := json.Unmarshal([]byte(action.SnapshotJSON), &snapshot); err != nil {
			return err
		}
		transferSplit, err := s.repo.ExecuteTransferSplit(ctx, *action, snapshot, now)
		if err != nil {
			return err
		}
		action.Status, action.UpdatedAt, action.Result = "succeeded", now, transferSplit
		return s.audit(ctx, trace, action.ConversationID, action.ID, "transfer_split_requested", "succeeded", "tool", map[string]any{
			"transfer_split_id": transferSplit.ID, "total_amount_minor": transferSplit.TotalAmountMinor,
			"collectible_minor": transferSplit.CollectibleMinor,
		}, now)
	case "investment_redemption":
		var snapshot struct {
			HoldingID string `json:"holding_id"`
		}
		if err := json.Unmarshal([]byte(action.SnapshotJSON), &snapshot); err != nil {
			return err
		}
		result, err := s.repo.ExecuteInvestmentRedemption(ctx, *action, snapshot.HoldingID, now)
		if err != nil {
			if errors.Is(err, ErrActionStateConflict) || errors.Is(err, ErrInsufficientBalance) {
				action.Status, action.UpdatedAt = "failed", now
				if updateErr := s.repo.UpdateAction(ctx, *action); updateErr != nil {
					return updateErr
				}
				if auditErr := s.audit(ctx, trace, action.ConversationID, action.ID, "investment_redemption_failed", "failed", "tool", map[string]any{"reason": err.Error()}, now); auditErr != nil {
					return auditErr
				}
			}
			return err
		}
		action.Status, action.UpdatedAt = "succeeded", now
		action.Result = map[string]any{"holding_id": result.HoldingID, "principal_minor": result.Principal, "profit_minor": result.ProfitMinor, "total_minor": result.TotalMinor, "days_held": result.DaysHeld, "annual_rate_bps": result.AnnualRateBPS}
		resultJSON, err := json.Marshal(action.Result)
		if err != nil {
			return err
		}
		action.ResultJSON = string(resultJSON)
		if err := s.repo.UpdateAction(ctx, *action); err != nil {
			return err
		}
		return s.audit(ctx, trace, action.ConversationID, action.ID, "investment_redeemed", "succeeded", "tool", action.Result.(map[string]any), now)
	case "investment_purchase":
		var snapshot struct {
			ProductID   string `json:"product_id"`
			AmountMinor int64  `json:"amount_minor"`
		}
		if err := json.Unmarshal([]byte(action.SnapshotJSON), &snapshot); err != nil {
			return err
		}
		result, err := s.repo.ExecuteInvestmentPurchase(ctx, *action, snapshot.ProductID, snapshot.AmountMinor, now)
		if err != nil {
			if errors.Is(err, ErrInsufficientBalance) {
				action.Status, action.UpdatedAt = "failed", now
				if auditErr := s.audit(ctx, trace, action.ConversationID, action.ID, "investment_purchase_failed", "failed", "tool", map[string]any{"reason": err.Error()}, now); auditErr != nil {
					return auditErr
				}
			}
			return err
		}
		action.Status, action.UpdatedAt = "succeeded", now
		action.Result = result
		return s.audit(ctx, trace, action.ConversationID, action.ID, "investment_purchased", "succeeded", "tool", map[string]any{"holding_id": result.HoldingID, "product_id": result.ProductID, "amount_minor": result.AmountMinor}, now)
	case "card_application":
		var snapshot struct {
			CardType string `json:"card_type"`
		}
		if err := json.Unmarshal([]byte(action.SnapshotJSON), &snapshot); err != nil {
			return err
		}
		card, err := s.repo.ExecuteCardApplication(ctx, *action, snapshot.CardType, now)
		if err != nil {
			return err
		}
		action.Status, action.UpdatedAt = "succeeded", now
		action.Result = map[string]any{"card_id": card.ID, "masked_number": card.MaskedNumber, "status": card.Status, "card_type": snapshot.CardType}
		resultJSON, err := json.Marshal(action.Result)
		if err != nil {
			return err
		}
		action.ResultJSON = string(resultJSON)
		if err := s.repo.UpdateAction(ctx, *action); err != nil {
			return err
		}
		return s.audit(ctx, trace, action.ConversationID, action.ID, "card_applied", "succeeded", "tool", map[string]any{"card_id": card.ID, "card_type": snapshot.CardType}, now)
	case "card_limit_change":
		var snapshot struct {
			CardID           string `json:"card_id"`
			TargetLimitMinor int64  `json:"target_limit_minor"`
		}
		if err := json.Unmarshal([]byte(action.SnapshotJSON), &snapshot); err != nil {
			return err
		}
		if err := s.repo.ExecuteCardLimit(ctx, *action, snapshot.CardID, snapshot.TargetLimitMinor, now); err != nil {
			return err
		}
		action.Status, action.UpdatedAt = "succeeded", now
		return s.audit(ctx, trace, action.ConversationID, action.ID, "card_limit_changed", "succeeded", "tool", map[string]any{"card_id": snapshot.CardID, "target_limit_minor": snapshot.TargetLimitMinor}, now)
	case "card_status_change":
		var snapshot struct {
			CardID         string `json:"card_id"`
			PreviousStatus string `json:"previous_status"`
			TargetStatus   string `json:"target_status"`
		}
		if err := json.Unmarshal([]byte(action.SnapshotJSON), &snapshot); err != nil {
			return err
		}
		if err := s.repo.ExecuteCardStatus(ctx, *action, snapshot.CardID, snapshot.TargetStatus, now); err != nil {
			return err
		}
		action.Status, action.UpdatedAt = "succeeded", now
		return s.audit(ctx, trace, action.ConversationID, action.ID, "card_status_changed", "succeeded", "tool", map[string]any{"card_id": snapshot.CardID, "previous_status": snapshot.PreviousStatus, "status": snapshot.TargetStatus}, now)
	case "subscription_cancel":
		var snapshot struct {
			SubscriptionID string `json:"subscription_id"`
		}
		if err := json.Unmarshal([]byte(action.SnapshotJSON), &snapshot); err != nil {
			return err
		}
		if err := s.repo.ExecuteSubscriptionCancel(ctx, *action, snapshot.SubscriptionID, now); err != nil {
			return err
		}
		action.Status, action.UpdatedAt = "succeeded", now
		return s.audit(ctx, trace, action.ConversationID, action.ID, "subscription_cancelled", "succeeded", "tool", map[string]any{"subscription_id": snapshot.SubscriptionID}, now)
	case "workflow_budget_lock":
		var snapshot struct {
			WorkflowID  string `json:"workflow_id"`
			NodeID      string `json:"node_id"`
			AmountMinor int64  `json:"amount_minor"`
		}
		if err := json.Unmarshal([]byte(action.SnapshotJSON), &snapshot); err != nil {
			return err
		}
		if err := s.repo.ExecuteWorkflowBudgetLock(ctx, *action, snapshot.WorkflowID, snapshot.NodeID, snapshot.AmountMinor, now); err != nil {
			if errors.Is(err, ErrInsufficientBalance) {
				action.Status, action.UpdatedAt = "failed", now
				if auditErr := s.audit(ctx, trace, action.ConversationID, action.ID, "workflow_budget_lock_failed", "failed", "tool", map[string]any{"reason": err.Error()}, now); auditErr != nil {
					return auditErr
				}
			}
			return err
		}
		action.Status, action.UpdatedAt = "succeeded", now
		action.Result = map[string]any{"workflow_id": snapshot.WorkflowID, "node_id": snapshot.NodeID, "amount_minor": snapshot.AmountMinor, "status": "locked"}
		resultJSON, err := json.Marshal(action.Result)
		if err != nil {
			return err
		}
		action.ResultJSON = string(resultJSON)
		if err := s.repo.UpdateAction(ctx, *action); err != nil {
			return err
		}
		return s.audit(ctx, trace, "", action.ID, "workflow_budget_locked", "succeeded", "tool", map[string]any{"workflow_id": snapshot.WorkflowID, "node_id": snapshot.NodeID, "amount_minor": snapshot.AmountMinor}, now)
	case "workflow_external_order":
		var snapshot struct {
			WorkflowID  string `json:"workflow_id"`
			NodeID      string `json:"node_id"`
			AmountMinor int64  `json:"amount_minor"`
			Merchant    string `json:"merchant"`
		}
		if err := json.Unmarshal([]byte(action.SnapshotJSON), &snapshot); err != nil {
			return err
		}
		if err := s.repo.ExecuteWorkflowOrder(ctx, *action, snapshot.WorkflowID, snapshot.NodeID, snapshot.AmountMinor, snapshot.Merchant, now); err != nil {
			if errors.Is(err, ErrBudgetNotReserved) || errors.Is(err, ErrInsufficientBalance) {
				action.Status, action.UpdatedAt = "failed", now
				if auditErr := s.audit(ctx, trace, action.ConversationID, action.ID, "workflow_order_failed", "failed", "tool", map[string]any{"reason": err.Error()}, now); auditErr != nil {
					return auditErr
				}
			}
			return err
		}
		action.Status, action.UpdatedAt = "succeeded", now
		action.Result = map[string]any{"workflow_id": snapshot.WorkflowID, "node_id": snapshot.NodeID, "merchant": snapshot.Merchant, "amount_minor": snapshot.AmountMinor, "status": "confirmed"}
		resultJSON, err := json.Marshal(action.Result)
		if err != nil {
			return err
		}
		action.ResultJSON = string(resultJSON)
		if err := s.repo.UpdateAction(ctx, *action); err != nil {
			return err
		}
		return s.audit(ctx, trace, "", action.ID, "workflow_order_confirmed", "succeeded", "tool", map[string]any{"workflow_id": snapshot.WorkflowID, "node_id": snapshot.NodeID, "amount_minor": snapshot.AmountMinor}, now)
	default:
		return ErrInvalidArgument
	}
}

func (s *Service) audit(ctx context.Context, trace, conversation, action, event, outcome, actor string, detail map[string]any, now time.Time) error {
	return s.repo.AddAudit(ctx, AuditEvent{ID: NewID("evt"), TraceID: trace, ConversationID: conversation, ActionID: action, EventType: event, Outcome: outcome, Actor: actor, Detail: detail, OccurredAt: now, Sequence: 1})
}

func parseHoldingID(text string) string {
	return regexp.MustCompile(`holding_[a-zA-Z0-9]+`).FindString(text)
}

func isPending(status string) bool {
	return status == "awaiting_confirmation" || status == "awaiting_mfa" || status == "scheduled"
}

func actionScheduledAt(action Action) (time.Time, bool) {
	var snapshot struct {
		ScheduledAt string `json:"scheduled_at"`
	}
	if json.Unmarshal([]byte(action.SnapshotJSON), &snapshot) != nil || snapshot.ScheduledAt == "" {
		return time.Time{}, false
	}
	scheduledAt, err := time.Parse(time.RFC3339, snapshot.ScheduledAt)
	return scheduledAt, err == nil
}

func conversationContextText(text string) string {
	lower := strings.ToLower(text)
	if strings.Contains(lower, "密码") || strings.Contains(lower, "验证码") || strings.Contains(lower, "token") {
		return "[敏感输入已脱敏]"
	}
	return strings.TrimSpace(text)
}

func ptr[T any](value T) *T { return &value }
