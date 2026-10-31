package domain

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
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
	now := s.now()
	trace := NewID("tr")
	snapshotJSON, err := json.Marshal(snapshot)
	if err != nil {
		return Action{}, trace, err
	}
	action := Action{ID: NewID("act"), ConversationID: conversationID, UserID: userID, Kind: kind, RiskLevel: "red", Status: "awaiting_mfa", SnapshotJSON: string(snapshotJSON), Snapshot: snapshot, ExpiresAt: now.Add(5 * time.Minute), CreatedAt: now, UpdatedAt: now}
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
	if strings.Contains(text, "卡") && (strings.Contains(text, "冻结") || strings.Contains(text, "解冻")) {
		status, verb := "frozen", "冻结"
		if strings.Contains(text, "解冻") {
			status, verb = "active", "解冻"
		}
		snapshot := map[string]any{"card_id": "card_demo", "target_status": status, "masked_number": "**** 1234"}
		snapshotJSON, _ := json.Marshal(snapshot)
		action := Action{ID: NewID("act"), ConversationID: conversationID, UserID: userID, Kind: "card_status_change", RiskLevel: "yellow", Status: "awaiting_confirmation", SnapshotJSON: string(snapshotJSON), Snapshot: snapshot, ExpiresAt: now.Add(5 * time.Minute), CreatedAt: now, UpdatedAt: now}
		if err := s.repo.CreateAction(ctx, action); err != nil {
			return MessageResult{}, trace, err
		}
		if err := s.audit(ctx, trace, conversationID, action.ID, "action_created", "succeeded", "system", map[string]any{"kind": action.Kind, "risk_level": action.RiskLevel}, now); err != nil {
			return MessageResult{}, trace, err
		}
		return MessageResult{RunID: runID, ReplyType: "action_required", Text: "请确认" + verb + "卡片 **** 1234。", Action: ptr(action.Public())}, trace, nil
	}
	if strings.Contains(text, "订阅") && strings.Contains(text, "取消") {
		subscriptionID := "sub_streaming"
		merchant := "demo-streaming"
		if strings.Contains(text, "云") || strings.Contains(text, "cloud") {
			subscriptionID, merchant = "sub_cloud", "demo-cloud"
		}
		snapshot := map[string]any{"subscription_id": subscriptionID, "merchant_ref": merchant}
		snapshotJSON, _ := json.Marshal(snapshot)
		action := Action{ID: NewID("act"), ConversationID: conversationID, UserID: userID, Kind: "subscription_cancel", RiskLevel: "yellow", Status: "awaiting_confirmation", SnapshotJSON: string(snapshotJSON), Snapshot: snapshot, ExpiresAt: now.Add(5 * time.Minute), CreatedAt: now, UpdatedAt: now}
		if err := s.repo.CreateAction(ctx, action); err != nil {
			return MessageResult{}, trace, err
		}
		if err := s.audit(ctx, trace, conversationID, action.ID, "action_created", "succeeded", "system", map[string]any{"kind": action.Kind, "risk_level": action.RiskLevel}, now); err != nil {
			return MessageResult{}, trace, err
		}
		return MessageResult{RunID: runID, ReplyType: "action_required", Text: "请确认取消" + merchant + "订阅。", Action: ptr(action.Public())}, trace, nil
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
	if s.model != nil {
		plan, modelErr := s.model.Plan(ctx, text)
		if modelErr == nil && plan.Intent != "unknown" {
			if len(plan.MissingFields) > 0 {
				return MessageResult{RunID: runID, ReplyType: "question", Text: "请补充：" + strings.Join(plan.MissingFields, "、")}, trace, nil
			}
			return MessageResult{RunID: runID, ReplyType: "question", Text: "我理解你的需求是“" + plan.Intent + "”，请补充具体业务信息。"}, trace, nil
		}
	}
	return MessageResult{RunID: runID, ReplyType: "question", Text: "我可以帮你查询余额、交易记录，或处理预置收款人的转账。"}, trace, nil
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
		if err := s.repo.ExecuteInvestmentPurchase(ctx, *action, snapshot.ProductID, snapshot.AmountMinor, now); err != nil {
			if errors.Is(err, ErrInsufficientBalance) {
				action.Status, action.UpdatedAt = "failed", now
				if auditErr := s.audit(ctx, trace, action.ConversationID, action.ID, "investment_purchase_failed", "failed", "tool", map[string]any{"reason": err.Error()}, now); auditErr != nil {
					return auditErr
				}
			}
			return err
		}
		action.Status, action.UpdatedAt = "succeeded", now
		return s.audit(ctx, trace, action.ConversationID, action.ID, "investment_purchased", "succeeded", "tool", map[string]any{"product_id": snapshot.ProductID, "amount_minor": snapshot.AmountMinor}, now)
	case "card_status_change":
		var snapshot struct {
			CardID       string `json:"card_id"`
			TargetStatus string `json:"target_status"`
		}
		if err := json.Unmarshal([]byte(action.SnapshotJSON), &snapshot); err != nil {
			return err
		}
		if err := s.repo.ExecuteCardStatus(ctx, *action, snapshot.CardID, snapshot.TargetStatus, now); err != nil {
			return err
		}
		action.Status, action.UpdatedAt = "succeeded", now
		return s.audit(ctx, trace, action.ConversationID, action.ID, "card_status_changed", "succeeded", "tool", map[string]any{"card_id": snapshot.CardID, "status": snapshot.TargetStatus}, now)
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
	return status == "awaiting_confirmation" || status == "awaiting_mfa"
}
func ptr[T any](value T) *T { return &value }
