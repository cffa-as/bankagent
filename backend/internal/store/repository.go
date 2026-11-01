package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/cffa-as/bankagent/internal/domain"
)

type Repository struct{ db *sql.DB }

type sqlExecutor interface {
	ExecContext(context.Context, string, ...any) (sql.Result, error)
}

func NewRepository(db *sql.DB) *Repository { return &Repository{db: db} }

func (r *Repository) Seed(ctx context.Context, now time.Time) error {
	_, err := r.db.ExecContext(ctx, `INSERT OR IGNORE INTO accounts(id,user_id,currency,balance_minor) VALUES(?,?,?,?)`, "acct_demo", domain.DemoUserID, "CNY", domain.DemoStartingBalanceMinor)
	if err != nil {
		return fmt.Errorf("seed account: %w", err)
	}
	_, err = r.db.ExecContext(ctx, `INSERT OR IGNORE INTO beneficiaries(id,user_id,name,phone,account_id) VALUES(?,?,?,?,?)`, "beneficiary_zhangsan", domain.DemoUserID, "张三", "13800000001", "acct_zhangsan")
	if err != nil {
		return fmt.Errorf("seed beneficiary: %w", err)
	}
	_, err = r.db.ExecContext(ctx, `INSERT OR IGNORE INTO beneficiaries(id,user_id,name,phone,account_id) VALUES(?,?,?,?,?)`, "beneficiary_lisi", domain.DemoUserID, "李四", "13800000002", "acct_lisi")
	if err != nil {
		return fmt.Errorf("seed beneficiary: %w", err)
	}
	products := []struct {
		id, name, risk, note   string
		minimum, annualRateBPS int64
		termDays               int
	}{
		{"product_conservative", "稳健现金管理", "conservative", "历史业绩不代表未来表现", 10000, 280, 30},
		{"product_balanced", "均衡增值组合", "balanced", "适合中等风险承受能力用户", 100000, 420, 180},
		{"product_aggressive", "进取成长组合", "aggressive", "净值可能出现较大波动", 100000, 700, 365},
	}
	for _, product := range products {
		_, err = r.db.ExecContext(ctx, `INSERT OR IGNORE INTO investment_products(id,name,risk_level,minimum_amount_minor,term_days,benchmark_note,annual_rate_bps) VALUES(?,?,?,?,?,?,?)`, product.id, product.name, product.risk, product.minimum, product.termDays, product.note, product.annualRateBPS)
		if err != nil {
			return fmt.Errorf("seed investment product: %w", err)
		}
	}
	_, err = r.db.ExecContext(ctx, `INSERT OR IGNORE INTO cards(id,user_id,masked_number,status,limit_minor,restrictions_json) VALUES(?,?,?,?,?,?)`, "card_demo", domain.DemoUserID, "**** 1234", "active", 500000, `["online","contactless"]`)
	if err != nil {
		return fmt.Errorf("seed card: %w", err)
	}
	subscriptions := []struct {
		id, merchant, status, currency, cycle, next string
		amount                                      int64
	}{
		{"sub_streaming", "demo-streaming", "active", "CNY", "monthly", now.AddDate(0, 0, 10).Format(time.RFC3339Nano), 2999},
		{"sub_cloud", "demo-cloud", "paused", "CNY", "monthly", now.AddDate(0, 0, 20).Format(time.RFC3339Nano), 1999},
	}
	for _, subscription := range subscriptions {
		_, err = r.db.ExecContext(ctx, `INSERT OR IGNORE INTO subscriptions(id,user_id,merchant_ref,status,amount_minor,currency,billing_cycle,next_charge_at) VALUES(?,?,?,?,?,?,?,?)`, subscription.id, domain.DemoUserID, subscription.merchant, subscription.status, subscription.amount, subscription.currency, subscription.cycle, subscription.next)
		if err != nil {
			return fmt.Errorf("seed subscription: %w", err)
		}
	}
	cashflows := []struct {
		id, direction, category, description, frequency string
		amount                                          int64
		essential                                       bool
		expectedAt                                      time.Time
	}{
		{"cashflow_salary", "in", "income", "工资收入", "monthly", 500000, false, now.AddDate(0, 0, 10)},
		{"cashflow_rent", "out", "housing", "房租", "monthly", 650000, true, now.AddDate(0, 0, 3)},
		{"cashflow_loan", "out", "loan", "贷款还款", "monthly", 200000, true, now.AddDate(0, 0, 5)},
		{"cashflow_insurance", "out", "insurance", "保险缴费", "monthly", 50000, true, now.AddDate(0, 0, 20)},
	}
	for _, cashflow := range cashflows {
		_, err = r.db.ExecContext(ctx, `INSERT OR IGNORE INTO cashflow_events(id,user_id,direction,amount_minor,currency,category,description,essential,expected_at,frequency,status) VALUES(?,?,?,?,?,?,?,?,?,?,?)`, cashflow.id, domain.DemoUserID, cashflow.direction, cashflow.amount, "CNY", cashflow.category, cashflow.description, cashflow.essential, cashflow.expectedAt.Format(time.RFC3339Nano), cashflow.frequency, "active")
		if err != nil {
			return fmt.Errorf("seed cashflow event: %w", err)
		}
	}
	entries := []struct {
		id, category, description string
		amount                    int64
		at                        time.Time
	}{
		{"txn_seed_food", "food", "晚餐消费", 9800, now.Add(-48 * time.Hour)},
		{"txn_seed_transport", "transport", "打车消费", 3200, now.Add(-36 * time.Hour)},
		{"txn_seed_shopping", "shopping", "日用品消费", 12900, now.Add(-24 * time.Hour)},
		{"txn_seed_utilities", "utilities", "生活缴费", 5600, now.Add(-12 * time.Hour)},
	}
	for _, entry := range entries {
		_, err = r.db.ExecContext(ctx, `INSERT OR IGNORE INTO ledger_entries(id,account_id,direction,amount_minor,category,description,created_at) VALUES(?,?,?,?,?,?,?)`, entry.id, "acct_demo", "out", entry.amount, entry.category, entry.description, entry.at.Format(time.RFC3339Nano))
		if err != nil {
			return fmt.Errorf("seed ledger entry: %w", err)
		}
	}
	return nil
}

func (r *Repository) CreateConversation(ctx context.Context, c domain.Conversation, audit domain.AuditEvent) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.ExecContext(ctx, `INSERT INTO conversations(id,user_id,created_at) VALUES(?,?,?)`, c.ID, c.UserID, c.CreatedAt.Format(time.RFC3339Nano)); err != nil {
		return err
	}
	if err := insertAudit(ctx, tx, audit); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *Repository) CreateRun(ctx context.Context, run domain.Run, audit domain.AuditEvent) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.ExecContext(ctx, `INSERT INTO runs(id,conversation_id,user_id,trace_id,status,reason,handoff_to,created_at,updated_at,finished_at) VALUES(?,?,?,?,?,?,?,?,?,'')`,
		run.ID, run.ConversationID, run.UserID, run.TraceID, run.Status, run.Reason, run.HandoffTo, run.CreatedAt.Format(time.RFC3339Nano), run.UpdatedAt.Format(time.RFC3339Nano)); err != nil {
		return err
	}
	if err := insertAudit(ctx, tx, audit); err != nil {
		return err
	}
	return tx.Commit()
}

func scanRun(scanner interface{ Scan(...any) error }, userID *string) (domain.Run, error) {
	var run domain.Run
	var created, updated, finished string
	if err := scanner.Scan(&run.ID, &run.ConversationID, userID, &run.TraceID, &run.Status, &run.Reason, &run.HandoffTo, &created, &updated, &finished); err != nil {
		return run, err
	}
	if userID != nil {
		run.UserID = *userID
	}
	var err error
	if run.CreatedAt, err = time.Parse(time.RFC3339Nano, created); err != nil {
		return run, err
	}
	if run.UpdatedAt, err = time.Parse(time.RFC3339Nano, updated); err != nil {
		return run, err
	}
	if finished != "" {
		value, err := time.Parse(time.RFC3339Nano, finished)
		if err != nil {
			return run, err
		}
		run.FinishedAt = &value
	}
	return run, nil
}

func (r *Repository) Run(ctx context.Context, userID, id string) (domain.Run, error) {
	var ignoredOwner string
	return scanRun(r.db.QueryRowContext(ctx, `SELECT id,conversation_id,user_id,trace_id,status,reason,handoff_to,created_at,updated_at,finished_at FROM runs WHERE id=? AND user_id=?`, id, userID), &ignoredOwner)
}

func (r *Repository) CompleteRun(ctx context.Context, userID, id, status, reason string, now time.Time, audit domain.AuditEvent) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	result, err := tx.ExecContext(ctx, `UPDATE runs SET status=?,reason=?,updated_at=?,finished_at=? WHERE id=? AND user_id=? AND status=?`,
		status, reason, now.Format(time.RFC3339Nano), now.Format(time.RFC3339Nano), id, userID, domain.RunStatusRunning)
	if err != nil {
		return err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if affected != 1 {
		return domain.ErrRunStateConflict
	}
	if err := insertAudit(ctx, tx, audit); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *Repository) TransitionRun(ctx context.Context, userID, id, fromStatus, toStatus, reason, handoffTo string, now time.Time, audit domain.AuditEvent) (domain.Run, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.Run{}, err
	}
	defer tx.Rollback()
	var owner string
	run, err := scanRun(tx.QueryRowContext(ctx, `SELECT id,conversation_id,user_id,trace_id,status,reason,handoff_to,created_at,updated_at,finished_at FROM runs WHERE id=? AND user_id=?`, id, userID), &owner)
	if err != nil {
		return domain.Run{}, err
	}
	if run.Status == toStatus {
		return run, tx.Commit()
	}
	if run.Status != fromStatus {
		return domain.Run{}, domain.ErrRunStateConflict
	}
	finished := ""
	if toStatus == domain.RunStatusInterrupted || toStatus == domain.RunStatusHumanHandoff {
		finished = now.Format(time.RFC3339Nano)
	}
	if _, err := tx.ExecContext(ctx, `UPDATE runs SET status=?,reason=?,handoff_to=?,updated_at=?,finished_at=? WHERE id=? AND user_id=? AND status=?`,
		toStatus, reason, handoffTo, now.Format(time.RFC3339Nano), finished, id, userID, fromStatus); err != nil {
		return domain.Run{}, err
	}
	if err := insertAudit(ctx, tx, audit); err != nil {
		return domain.Run{}, err
	}
	if err := tx.Commit(); err != nil {
		return domain.Run{}, err
	}
	run.Status, run.Reason, run.HandoffTo, run.UpdatedAt = toStatus, reason, handoffTo, now
	if finished != "" {
		run.FinishedAt = &now
	}
	return run, nil
}

func (r *Repository) RollbackRun(ctx context.Context, userID, id string, now time.Time) (domain.RunRollbackResult, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.RunRollbackResult{}, err
	}
	defer tx.Rollback()
	var owner string
	run, err := scanRun(tx.QueryRowContext(ctx, `SELECT id,conversation_id,user_id,trace_id,status,reason,handoff_to,created_at,updated_at,finished_at FROM runs WHERE id=? AND user_id=?`, id, userID), &owner)
	if err != nil {
		return domain.RunRollbackResult{}, err
	}
	switch run.Status {
	case domain.RunStatusCompleted, domain.RunStatusInterrupted, domain.RunStatusHumanHandoff, domain.RunStatusRolledBack, domain.RunStatusRollbackReviewRequired:
	default:
		return domain.RunRollbackResult{}, domain.ErrRunStateConflict
	}
	rows, err := tx.QueryContext(ctx, `SELECT id,status FROM actions WHERE run_id=? AND user_id=? ORDER BY created_at,id`, id, userID)
	if err != nil {
		return domain.RunRollbackResult{}, err
	}
	var cancelled, review []string
	for rows.Next() {
		var actionID, status string
		if err := rows.Scan(&actionID, &status); err != nil {
			rows.Close()
			return domain.RunRollbackResult{}, err
		}
		switch status {
		case "awaiting_confirmation", "awaiting_mfa", "scheduled":
			cancelled = append(cancelled, actionID)
		case "executing", "processing", "reconciliation_required", "succeeded":
			review = append(review, actionID)
		}
	}
	if err := rows.Close(); err != nil {
		return domain.RunRollbackResult{}, err
	}
	for _, actionID := range cancelled {
		if _, err := tx.ExecContext(ctx, `UPDATE actions SET status='cancelled',updated_at=? WHERE id=? AND user_id=? AND status IN ('awaiting_confirmation','awaiting_mfa','scheduled')`,
			now.Format(time.RFC3339Nano), actionID, userID); err != nil {
			return domain.RunRollbackResult{}, err
		}
	}
	status := domain.RunStatusRolledBack
	reason := "待执行动作已取消"
	if len(review) > 0 {
		status = domain.RunStatusRollbackReviewRequired
		reason = "存在已执行或执行中的动作，必须进入人工复核或补偿流程"
	}
	if _, err := tx.ExecContext(ctx, `UPDATE runs SET status=?,reason=?,updated_at=?,finished_at=CASE WHEN finished_at='' THEN ? ELSE finished_at END WHERE id=? AND user_id=?`,
		status, reason, now.Format(time.RFC3339Nano), now.Format(time.RFC3339Nano), id, userID); err != nil {
		return domain.RunRollbackResult{}, err
	}
	audit := domain.AuditEvent{
		ID: domain.NewID("evt"), TraceID: run.TraceID, RunID: run.ID, ConversationID: run.ConversationID,
		EventType: "run_rollback_completed", Outcome: "succeeded", Actor: "user", PolicyVersion: "bankagent-policy-v1",
		Detail: map[string]any{
			"cancelled_action_ids": cancelled,
			"review_action_ids":    review,
			"rollback_status":      status,
		},
		OccurredAt: now, Sequence: 1,
	}
	if err := insertAudit(ctx, tx, audit); err != nil {
		return domain.RunRollbackResult{}, err
	}
	if err := tx.Commit(); err != nil {
		return domain.RunRollbackResult{}, err
	}
	run.Status, run.Reason, run.UpdatedAt = status, reason, now
	if run.FinishedAt == nil {
		run.FinishedAt = &now
	}
	return domain.RunRollbackResult{Run: run, CancelledActionIDs: cancelled, ReviewActionIDs: review}, nil
}

func (r *Repository) ConversationOwner(ctx context.Context, id string) (string, error) {
	var userID string
	err := r.db.QueryRowContext(ctx, `SELECT user_id FROM conversations WHERE id=?`, id).Scan(&userID)
	return userID, err
}

func (r *Repository) ConversationMessages(ctx context.Context, userID, conversationID string, limit int) ([]domain.ConversationMessage, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT id,conversation_id,user_id,role,text,created_at FROM conversation_messages WHERE conversation_id=? AND user_id=? ORDER BY created_at DESC,rowid DESC LIMIT ?`, conversationID, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var messages []domain.ConversationMessage
	for rows.Next() {
		var message domain.ConversationMessage
		var created string
		if err := rows.Scan(&message.ID, &message.ConversationID, &message.UserID, &message.Role, &message.Text, &created); err != nil {
			return nil, err
		}
		if message.CreatedAt, err = time.Parse(time.RFC3339Nano, created); err != nil {
			return nil, err
		}
		messages = append(messages, message)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	for left, right := 0, len(messages)-1; left < right; left, right = left+1, right-1 {
		messages[left], messages[right] = messages[right], messages[left]
	}
	return messages, nil
}

func (r *Repository) AddConversationMessage(ctx context.Context, message domain.ConversationMessage) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO conversation_messages(id,conversation_id,user_id,role,text,created_at) VALUES(?,?,?,?,?,?)`, message.ID, message.ConversationID, message.UserID, message.Role, message.Text, message.CreatedAt.Format(time.RFC3339Nano))
	return err
}

func (r *Repository) Account(ctx context.Context, userID string) (domain.Account, error) {
	var a domain.Account
	err := r.db.QueryRowContext(ctx, `SELECT id,user_id,currency,balance_minor,reserved_minor FROM accounts WHERE user_id=?`, userID).Scan(&a.ID, &a.UserID, &a.Currency, &a.BalanceMinor, &a.ReservedMinor)
	a.AvailableMinor = a.BalanceMinor - a.ReservedMinor
	return a, err
}

func (r *Repository) Transactions(ctx context.Context, userID string) ([]domain.Transaction, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT l.id,l.direction,l.amount_minor,l.category,l.description,l.created_at FROM ledger_entries l JOIN accounts a ON a.id=l.account_id WHERE a.user_id=? ORDER BY l.created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []domain.Transaction
	for rows.Next() {
		var t domain.Transaction
		var created string
		if err := rows.Scan(&t.ID, &t.Direction, &t.AmountMinor, &t.Category, &t.Description, &created); err != nil {
			return nil, err
		}
		t.CreatedAt, err = time.Parse(time.RFC3339Nano, created)
		if err != nil {
			return nil, err
		}
		result = append(result, t)
	}
	return result, rows.Err()
}

func (r *Repository) Product(ctx context.Context, id string) (domain.Product, error) {
	var product domain.Product
	err := r.db.QueryRowContext(ctx, `SELECT id,name,risk_level,minimum_amount_minor,term_days,benchmark_note,annual_rate_bps FROM investment_products WHERE id=?`, id).Scan(&product.ID, &product.Name, &product.RiskLevel, &product.MinimumAmountMinor, &product.TermDays, &product.BenchmarkNote, &product.AnnualRateBPS)
	return product, err
}

func (r *Repository) Holdings(ctx context.Context, userID string) ([]domain.Holding, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT h.id,h.product_id,p.name,h.amount_minor,h.status,h.purchased_at FROM investment_holdings h JOIN investment_products p ON p.id=h.product_id WHERE h.user_id=? ORDER BY h.purchased_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var holdings []domain.Holding
	for rows.Next() {
		var holding domain.Holding
		var purchased string
		if err := rows.Scan(&holding.ID, &holding.ProductID, &holding.ProductName, &holding.AmountMinor, &holding.Status, &purchased); err != nil {
			return nil, err
		}
		var err error
		holding.PurchasedAt, err = time.Parse(time.RFC3339Nano, purchased)
		if err != nil {
			return nil, err
		}
		holdings = append(holdings, holding)
	}
	return holdings, rows.Err()
}

func (r *Repository) ActiveHolding(ctx context.Context, userID, holdingID string) (domain.Holding, error) {
	var holding domain.Holding
	var purchased string
	err := r.db.QueryRowContext(ctx, `SELECT h.id,h.product_id,p.name,h.amount_minor,h.status,h.purchased_at FROM investment_holdings h JOIN investment_products p ON p.id=h.product_id WHERE h.user_id=? AND h.id=? AND h.status='active'`, userID, holdingID).Scan(&holding.ID, &holding.ProductID, &holding.ProductName, &holding.AmountMinor, &holding.Status, &purchased)
	if err != nil {
		return holding, err
	}
	var parseErr error
	holding.PurchasedAt, parseErr = time.Parse(time.RFC3339Nano, purchased)
	return holding, parseErr
}

func (r *Repository) Products(ctx context.Context, riskLevel string) ([]domain.Product, error) {
	query := `SELECT id,name,risk_level,minimum_amount_minor,term_days,benchmark_note,annual_rate_bps FROM investment_products`
	args := []any{}
	if riskLevel != "" {
		query += ` WHERE risk_level=?`
		args = append(args, riskLevel)
	}
	query += ` ORDER BY minimum_amount_minor, id`
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var products []domain.Product
	for rows.Next() {
		var product domain.Product
		if err := rows.Scan(&product.ID, &product.Name, &product.RiskLevel, &product.MinimumAmountMinor, &product.TermDays, &product.BenchmarkNote, &product.AnnualRateBPS); err != nil {
			return nil, err
		}
		products = append(products, product)
	}
	return products, rows.Err()
}

func (r *Repository) Cards(ctx context.Context, userID string) ([]domain.Card, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT id,masked_number,status,limit_minor,restrictions_json FROM cards WHERE user_id=? ORDER BY id`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var cards []domain.Card
	for rows.Next() {
		var card domain.Card
		var restrictions string
		if err := rows.Scan(&card.ID, &card.MaskedNumber, &card.Status, &card.LimitMinor, &restrictions); err != nil {
			return nil, err
		}
		if err := json.Unmarshal([]byte(restrictions), &card.Restrictions); err != nil {
			return nil, err
		}
		cards = append(cards, card)
	}
	return cards, rows.Err()
}

func (r *Repository) Subscriptions(ctx context.Context, userID, status string) ([]domain.Subscription, error) {
	query := `SELECT id,merchant_ref,status,amount_minor,currency,billing_cycle,next_charge_at FROM subscriptions WHERE user_id=?`
	args := []any{userID}
	if status != "" {
		query += ` AND status=?`
		args = append(args, status)
	}
	query += ` ORDER BY next_charge_at, id`
	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var subscriptions []domain.Subscription
	for rows.Next() {
		var subscription domain.Subscription
		var nextCharge string
		if err := rows.Scan(&subscription.ID, &subscription.MerchantRef, &subscription.Status, &subscription.AmountMinor, &subscription.Currency, &subscription.BillingCycle, &nextCharge); err != nil {
			return nil, err
		}
		var err error
		subscription.NextChargeAt, err = time.Parse(time.RFC3339Nano, nextCharge)
		if err != nil {
			return nil, err
		}
		subscriptions = append(subscriptions, subscription)
	}
	return subscriptions, rows.Err()
}

func (r *Repository) CashflowEvents(ctx context.Context, userID string) ([]domain.CashflowEvent, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT id,user_id,direction,amount_minor,currency,category,description,essential,expected_at,frequency,status FROM cashflow_events WHERE user_id=? AND status='active' ORDER BY expected_at,id`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var events []domain.CashflowEvent
	for rows.Next() {
		var event domain.CashflowEvent
		var expectedAt string
		var essential int
		if err := rows.Scan(&event.ID, &event.UserID, &event.Direction, &event.AmountMinor, &event.Currency, &event.Category, &event.Description, &essential, &expectedAt, &event.Frequency, &event.Status); err != nil {
			return nil, err
		}
		event.Essential = essential == 1
		if event.ExpectedAt, err = time.Parse(time.RFC3339Nano, expectedAt); err != nil {
			return nil, err
		}
		events = append(events, event)
	}
	return events, rows.Err()
}

func (r *Repository) ScheduledCashflows(ctx context.Context, userID string, now time.Time) ([]domain.ScheduledCashflow, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT id,snapshot_json FROM actions WHERE user_id=? AND kind='transfer' AND status='scheduled' AND datetime(expires_at)>=datetime(?) ORDER BY created_at,id`, userID, now.Format(time.RFC3339Nano))
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var transfers []domain.ScheduledCashflow
	for rows.Next() {
		var actionID, snapshotJSON string
		if err := rows.Scan(&actionID, &snapshotJSON); err != nil {
			return nil, err
		}
		var snapshot struct {
			AmountMinor     int64  `json:"amount_minor"`
			Currency        string `json:"currency"`
			ScheduledAt     string `json:"scheduled_at"`
			BeneficiaryName string `json:"beneficiary_name"`
			Remark          string `json:"remark"`
		}
		if err := json.Unmarshal([]byte(snapshotJSON), &snapshot); err != nil {
			return nil, err
		}
		scheduledAt, err := time.Parse(time.RFC3339, snapshot.ScheduledAt)
		if err != nil {
			return nil, err
		}
		description := "预约转账给" + snapshot.BeneficiaryName
		if snapshot.Remark != "" {
			description += " " + snapshot.Remark
		}
		transfers = append(transfers, domain.ScheduledCashflow{ActionID: actionID, AmountMinor: snapshot.AmountMinor, Currency: snapshot.Currency, ScheduledAt: scheduledAt, Description: description})
	}
	return transfers, rows.Err()
}

func (r *Repository) HistoricalSpending(ctx context.Context, userID string, start, end time.Time) (domain.HistoricalSpending, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT date(datetime(l.created_at),'+8 hours'),COALESCE(SUM(l.amount_minor),0) FROM ledger_entries l JOIN accounts a ON a.id=l.account_id WHERE a.user_id=? AND l.direction='out' AND l.category IN ('food','transport','shopping','entertainment','other') AND datetime(l.created_at)>=datetime(?) AND datetime(l.created_at)<datetime(?) GROUP BY date(datetime(l.created_at),'+8 hours')`, userID, start.Format(time.RFC3339Nano), end.Format(time.RFC3339Nano))
	if err != nil {
		return domain.HistoricalSpending{}, err
	}
	defer rows.Close()
	var total, maximum int64
	for rows.Next() {
		var day string
		var amount int64
		if err := rows.Scan(&day, &amount); err != nil {
			return domain.HistoricalSpending{}, err
		}
		total += amount
		if amount > maximum {
			maximum = amount
		}
	}
	if err := rows.Err(); err != nil {
		return domain.HistoricalSpending{}, err
	}
	days := int64(end.Sub(start).Hours() / 24)
	if days < 1 {
		days = 1
	}
	average := (total + days - 1) / days
	if maximum < average {
		maximum = average
	}
	return domain.HistoricalSpending{AverageDailyMinor: average, ConservativeDailyMinor: maximum}, nil
}

func (r *Repository) CreateLiquiditySimulation(ctx context.Context, simulation domain.LiquiditySimulation, audit domain.AuditEvent) error {
	result, err := json.Marshal(simulation)
	if err != nil {
		return err
	}
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.ExecContext(ctx, `INSERT INTO liquidity_simulations(id,user_id,account_id,trace_id,result_json,created_at) VALUES(?,?,?,?,?,?)`, simulation.ID, simulation.UserID, simulation.AccountID, simulation.TraceID, string(result), simulation.CreatedAt.Format(time.RFC3339Nano)); err != nil {
		return err
	}
	if err := insertAudit(ctx, tx, audit); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *Repository) LiquiditySimulation(ctx context.Context, userID, id string) (domain.LiquiditySimulation, error) {
	var result string
	err := r.db.QueryRowContext(ctx, `SELECT result_json FROM liquidity_simulations WHERE id=? AND user_id=?`, id, userID).Scan(&result)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.LiquiditySimulation{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.LiquiditySimulation{}, err
	}
	var simulation domain.LiquiditySimulation
	if err := json.Unmarshal([]byte(result), &simulation); err != nil {
		return domain.LiquiditySimulation{}, err
	}
	simulation.UserID = userID
	return simulation, nil
}

func (r *Repository) BillSummary(ctx context.Context, userID string, month time.Time) (domain.BillSummary, error) {
	loc, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		return domain.BillSummary{}, err
	}
	month = month.In(loc)
	start := time.Date(month.Year(), month.Month(), 1, 0, 0, 0, 0, loc)
	return r.BillSummaryRange(ctx, userID, start, start.AddDate(0, 1, 0), start.Format("2006-01"))
}

func (r *Repository) BillSummaryRange(ctx context.Context, userID string, start, end time.Time, period string) (domain.BillSummary, error) {
	loc, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		return domain.BillSummary{}, err
	}
	start, end = start.In(loc), end.In(loc)
	rows, err := r.db.QueryContext(ctx, `SELECT l.category, COALESCE(SUM(l.amount_minor),0), COUNT(*) FROM ledger_entries l JOIN accounts a ON a.id=l.account_id WHERE a.user_id=? AND l.direction='out' AND datetime(l.created_at)>=datetime(?) AND datetime(l.created_at)<datetime(?) GROUP BY l.category ORDER BY SUM(l.amount_minor) DESC`, userID, start.Format(time.RFC3339Nano), end.Format(time.RFC3339Nano))
	if err != nil {
		return domain.BillSummary{}, err
	}
	defer rows.Close()
	summary := domain.BillSummary{Month: period, Period: period, Currency: "CNY"}
	for rows.Next() {
		var item domain.BillCategory
		if err := rows.Scan(&item.Category, &item.AmountMinor, &item.Count); err != nil {
			return domain.BillSummary{}, err
		}
		summary.TotalMinor += item.AmountMinor
		summary.TransactionCount += item.Count
		summary.Categories = append(summary.Categories, item)
	}
	if err := rows.Err(); err != nil {
		return domain.BillSummary{}, err
	}
	for i := range summary.Categories {
		if summary.TotalMinor > 0 {
			summary.Categories[i].ShareBPS = summary.Categories[i].AmountMinor * 10000 / summary.TotalMinor
		}
	}
	anomalyRows, err := r.db.QueryContext(ctx, `SELECT l.id,l.amount_minor,l.category,l.description FROM ledger_entries l JOIN accounts a ON a.id=l.account_id WHERE a.user_id=? AND l.direction='out' AND l.amount_minor>=? AND datetime(l.created_at)>=datetime(?) AND datetime(l.created_at)<datetime(?) ORDER BY l.amount_minor DESC`, userID, int64(10000), start.Format(time.RFC3339Nano), end.Format(time.RFC3339Nano))
	if err != nil {
		return domain.BillSummary{}, err
	}
	defer anomalyRows.Close()
	for anomalyRows.Next() {
		var item domain.BillAnomaly
		if err := anomalyRows.Scan(&item.TransactionID, &item.AmountMinor, &item.Category, &item.Description); err != nil {
			return domain.BillSummary{}, err
		}
		item.Reason = "金额超过演示异常阈值"
		summary.Anomalies = append(summary.Anomalies, item)
	}
	return summary, anomalyRows.Err()
}

func (r *Repository) DailyOutgoing(ctx context.Context, userID string, day time.Time) (int64, error) {
	loc, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		return 0, err
	}
	day = day.In(loc)
	start := time.Date(day.Year(), day.Month(), day.Day(), 0, 0, 0, 0, loc)
	end := start.AddDate(0, 0, 1)
	var total sql.NullInt64
	err = r.db.QueryRowContext(ctx, `SELECT COALESCE(SUM(l.amount_minor),0) FROM ledger_entries l JOIN accounts a ON a.id=l.account_id WHERE a.user_id=? AND l.direction='out' AND l.category='transfer' AND datetime(l.created_at)>=datetime(?) AND datetime(l.created_at)<datetime(?)`, userID, start.Format(time.RFC3339Nano), end.Format(time.RFC3339Nano)).Scan(&total)
	return total.Int64, err
}

func (r *Repository) Beneficiary(ctx context.Context, userID, name string) (string, error) {
	var accountID string
	err := r.db.QueryRowContext(ctx, `SELECT account_id FROM beneficiaries WHERE user_id=? AND name=?`, userID, name).Scan(&accountID)
	return accountID, err
}

func (r *Repository) BeneficiaryByPhone(ctx context.Context, userID, phone string) (string, string, error) {
	var name, accountID string
	err := r.db.QueryRowContext(ctx, `SELECT name,account_id FROM beneficiaries WHERE user_id=? AND phone=?`, userID, phone).Scan(&name, &accountID)
	return name, accountID, err
}

func (r *Repository) CreateAction(ctx context.Context, a domain.Action) error {
	return insertAction(ctx, r.db, a)
}

func insertAction(ctx context.Context, executor sqlExecutor, a domain.Action) error {
	_, err := executor.ExecContext(ctx, `INSERT INTO actions(id,trace_id,run_id,conversation_id,user_id,kind,risk_level,status,snapshot_json,snapshot_hash,result_json,expires_at,created_at,updated_at,mfa_attempts) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, a.ID, a.TraceID, a.RunID, a.ConversationID, a.UserID, a.Kind, a.RiskLevel, a.Status, a.SnapshotJSON, a.SnapshotHash, a.ResultJSON, a.ExpiresAt.Format(time.RFC3339Nano), a.CreatedAt.Format(time.RFC3339Nano), a.UpdatedAt.Format(time.RFC3339Nano), a.MFAAttempts)
	return err
}

func (r *Repository) Action(ctx context.Context, id string) (domain.Action, error) {
	var a domain.Action
	var expires, created, updated string
	err := r.db.QueryRowContext(ctx, `SELECT id,trace_id,run_id,conversation_id,user_id,kind,risk_level,status,snapshot_json,snapshot_hash,result_json,expires_at,created_at,updated_at,mfa_attempts FROM actions WHERE id=?`, id).Scan(&a.ID, &a.TraceID, &a.RunID, &a.ConversationID, &a.UserID, &a.Kind, &a.RiskLevel, &a.Status, &a.SnapshotJSON, &a.SnapshotHash, &a.ResultJSON, &expires, &created, &updated, &a.MFAAttempts)
	if err != nil {
		return a, err
	}
	var parseErr error
	if a.ExpiresAt, parseErr = time.Parse(time.RFC3339Nano, expires); parseErr != nil {
		return a, parseErr
	}
	if a.CreatedAt, parseErr = time.Parse(time.RFC3339Nano, created); parseErr != nil {
		return a, parseErr
	}
	if a.UpdatedAt, parseErr = time.Parse(time.RFC3339Nano, updated); parseErr != nil {
		return a, parseErr
	}
	return a, nil
}

func (r *Repository) UpdateAction(ctx context.Context, a domain.Action) error {
	_, err := r.db.ExecContext(ctx, `UPDATE actions SET status=?,result_json=?,updated_at=?,mfa_attempts=? WHERE id=?`, a.Status, a.ResultJSON, a.UpdatedAt.Format(time.RFC3339Nano), a.MFAAttempts, a.ID)
	return err
}

func (r *Repository) ExecuteTransfer(ctx context.Context, a domain.Action, amount int64, description string, now time.Time) (domain.TransferResult, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.TransferResult{}, err
	}
	defer tx.Rollback()
	result, err := tx.ExecContext(ctx, `UPDATE actions SET status='executing',updated_at=? WHERE id=? AND status=?`, now.Format(time.RFC3339Nano), a.ID, a.Status)
	if err != nil {
		return domain.TransferResult{}, err
	}
	if affected, err := result.RowsAffected(); err != nil {
		return domain.TransferResult{}, err
	} else if affected != 1 {
		return domain.TransferResult{}, domain.ErrActionStateConflict
	}
	var accountID string
	var balance, reserved int64
	if err := tx.QueryRowContext(ctx, `SELECT id,balance_minor,reserved_minor FROM accounts WHERE user_id=?`, a.UserID).Scan(&accountID, &balance, &reserved); err != nil {
		return domain.TransferResult{}, err
	}
	if balance-reserved < amount {
		if _, err := tx.ExecContext(ctx, `UPDATE actions SET status='failed',updated_at=? WHERE id=?`, now.Format(time.RFC3339Nano), a.ID); err != nil {
			return domain.TransferResult{}, err
		}
		if err := tx.Commit(); err != nil {
			return domain.TransferResult{}, err
		}
		return domain.TransferResult{}, domain.ErrInsufficientBalance
	}
	if _, err := tx.ExecContext(ctx, `UPDATE accounts SET balance_minor=balance_minor-? WHERE id=?`, amount, accountID); err != nil {
		return domain.TransferResult{}, err
	}
	transactionID := domain.NewID("txn")
	if _, err := tx.ExecContext(ctx, `INSERT INTO ledger_entries(id,account_id,direction,amount_minor,category,description,created_at) VALUES(?,?,?,?,?,?,?)`, transactionID, accountID, "out", amount, "transfer", description, now.Format(time.RFC3339Nano)); err != nil {
		return domain.TransferResult{}, err
	}
	transferResult := domain.TransferResult{TransactionID: transactionID, AmountMinor: amount, Currency: "CNY"}
	receipt, err := json.Marshal(transferResult)
	if err != nil {
		return domain.TransferResult{}, err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE actions SET status='succeeded',result_json=?,updated_at=? WHERE id=?`, string(receipt), now.Format(time.RFC3339Nano), a.ID); err != nil {
		return domain.TransferResult{}, err
	}
	if err := tx.Commit(); err != nil {
		return domain.TransferResult{}, err
	}
	return transferResult, nil
}

func (r *Repository) ExecuteInvestmentPurchase(ctx context.Context, a domain.Action, productID string, amount int64, now time.Time) (domain.InvestmentPurchaseResult, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.InvestmentPurchaseResult{}, err
	}
	defer tx.Rollback()
	result, err := tx.ExecContext(ctx, `UPDATE actions SET status='executing',updated_at=? WHERE id=? AND status=?`, now.Format(time.RFC3339Nano), a.ID, a.Status)
	if err != nil {
		return domain.InvestmentPurchaseResult{}, err
	}
	if affected, err := result.RowsAffected(); err != nil {
		return domain.InvestmentPurchaseResult{}, err
	} else if affected != 1 {
		return domain.InvestmentPurchaseResult{}, domain.ErrActionStateConflict
	}
	var accountID, currency string
	var balance, reserved int64
	if err := tx.QueryRowContext(ctx, `SELECT id,currency,balance_minor,reserved_minor FROM accounts WHERE user_id=?`, a.UserID).Scan(&accountID, &currency, &balance, &reserved); err != nil {
		return domain.InvestmentPurchaseResult{}, err
	}
	if currency != "CNY" || balance-reserved < amount {
		_, _ = tx.ExecContext(ctx, `UPDATE actions SET status='failed',updated_at=? WHERE id=?`, now.Format(time.RFC3339Nano), a.ID)
		if err := tx.Commit(); err != nil {
			return domain.InvestmentPurchaseResult{}, err
		}
		return domain.InvestmentPurchaseResult{}, domain.ErrInsufficientBalance
	}
	if _, err := tx.ExecContext(ctx, `UPDATE accounts SET balance_minor=balance_minor-? WHERE id=?`, amount, accountID); err != nil {
		return domain.InvestmentPurchaseResult{}, err
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO ledger_entries(id,account_id,direction,amount_minor,category,description,created_at) VALUES(?,?,?,?,?,?,?)`, domain.NewID("txn"), accountID, "out", amount, "investment", "理财申购 "+productID, now.Format(time.RFC3339Nano)); err != nil {
		return domain.InvestmentPurchaseResult{}, err
	}
	holdingID := domain.NewID("holding")
	if _, err := tx.ExecContext(ctx, `INSERT INTO investment_holdings(id,user_id,product_id,amount_minor,status,purchased_at) VALUES(?,?,?,?,?,?)`, holdingID, a.UserID, productID, amount, "active", now.Format(time.RFC3339Nano)); err != nil {
		return domain.InvestmentPurchaseResult{}, err
	}
	purchaseResult := domain.InvestmentPurchaseResult{HoldingID: holdingID, ProductID: productID, AmountMinor: amount, Currency: currency}
	receipt, err := json.Marshal(purchaseResult)
	if err != nil {
		return domain.InvestmentPurchaseResult{}, err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE actions SET status='succeeded',result_json=?,updated_at=? WHERE id=?`, string(receipt), now.Format(time.RFC3339Nano), a.ID); err != nil {
		return domain.InvestmentPurchaseResult{}, err
	}
	if err := tx.Commit(); err != nil {
		return domain.InvestmentPurchaseResult{}, err
	}
	return purchaseResult, nil
}

func (r *Repository) ExecuteInvestmentRedemption(ctx context.Context, a domain.Action, holdingID string, now time.Time) (domain.RedemptionResult, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.RedemptionResult{}, err
	}
	defer tx.Rollback()
	result, err := tx.ExecContext(ctx, `UPDATE actions SET status='executing',updated_at=? WHERE id=? AND status=?`, now.Format(time.RFC3339Nano), a.ID, a.Status)
	if err != nil {
		return domain.RedemptionResult{}, err
	}
	if affected, err := result.RowsAffected(); err != nil {
		return domain.RedemptionResult{}, err
	} else if affected != 1 {
		return domain.RedemptionResult{}, domain.ErrActionStateConflict
	}
	var accountID string
	var principal, annualRateBPS int64
	var purchased string
	err = tx.QueryRowContext(ctx, `SELECT h.user_id,h.amount_minor,p.annual_rate_bps,h.purchased_at FROM investment_holdings h JOIN investment_products p ON p.id=h.product_id WHERE h.id=? AND h.user_id=? AND h.status='active'`, holdingID, a.UserID).Scan(new(string), &principal, &annualRateBPS, &purchased)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.RedemptionResult{}, domain.ErrActionStateConflict
	}
	if err != nil {
		return domain.RedemptionResult{}, err
	}
	purchasedAt, err := time.Parse(time.RFC3339Nano, purchased)
	if err != nil {
		return domain.RedemptionResult{}, err
	}
	daysHeld := int64(now.Sub(purchasedAt).Hours() / 24)
	if daysHeld < 0 {
		daysHeld = 0
	}
	profit := principal * annualRateBPS * daysHeld / (365 * 10000)
	total := principal + profit
	var balance int64
	if err := tx.QueryRowContext(ctx, `SELECT id,balance_minor FROM accounts WHERE user_id=?`, a.UserID).Scan(&accountID, &balance); err != nil {
		return domain.RedemptionResult{}, err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE accounts SET balance_minor=balance_minor+? WHERE id=?`, total, accountID); err != nil {
		return domain.RedemptionResult{}, err
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO ledger_entries(id,account_id,direction,amount_minor,category,description,created_at) VALUES(?,?,?,?,?,?,?)`, domain.NewID("txn"), accountID, "in", total, "investment", "理财赎回 "+holdingID, now.Format(time.RFC3339Nano)); err != nil {
		return domain.RedemptionResult{}, err
	}
	result, err = tx.ExecContext(ctx, `UPDATE investment_holdings SET status='redeemed' WHERE id=? AND user_id=? AND status='active'`, holdingID, a.UserID)
	if err != nil {
		return domain.RedemptionResult{}, err
	}
	if affected, err := result.RowsAffected(); err != nil {
		return domain.RedemptionResult{}, err
	} else if affected != 1 {
		return domain.RedemptionResult{}, domain.ErrActionStateConflict
	}
	redemptionResult := domain.RedemptionResult{HoldingID: holdingID, Principal: principal, ProfitMinor: profit, TotalMinor: total, DaysHeld: daysHeld, AnnualRateBPS: annualRateBPS}
	receipt, err := json.Marshal(map[string]any{
		"holding_id": holdingID, "principal_minor": principal, "profit_minor": profit,
		"total_minor": total, "days_held": daysHeld, "annual_rate_bps": annualRateBPS,
	})
	if err != nil {
		return domain.RedemptionResult{}, err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE actions SET status='succeeded',result_json=?,updated_at=? WHERE id=?`, string(receipt), now.Format(time.RFC3339Nano), a.ID); err != nil {
		return domain.RedemptionResult{}, err
	}
	if err := tx.Commit(); err != nil {
		return domain.RedemptionResult{}, err
	}
	return redemptionResult, nil
}

func (r *Repository) ExecuteCardApplication(ctx context.Context, a domain.Action, cardType string, now time.Time) (domain.Card, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.Card{}, err
	}
	defer tx.Rollback()
	result, err := tx.ExecContext(ctx, `UPDATE actions SET status='executing',updated_at=? WHERE id=? AND status=?`, now.Format(time.RFC3339Nano), a.ID, a.Status)
	if err != nil {
		return domain.Card{}, err
	}
	if affected, err := result.RowsAffected(); err != nil {
		return domain.Card{}, err
	} else if affected != 1 {
		return domain.Card{}, domain.ErrActionStateConflict
	}
	cardID := domain.NewID("card")
	masked := "**** " + cardID[len(cardID)-4:]
	if _, err := tx.ExecContext(ctx, `INSERT INTO cards(id,user_id,masked_number,status,limit_minor,restrictions_json) VALUES(?,?,?,?,?,?)`, cardID, a.UserID, masked, "active", 500000, `[]`); err != nil {
		return domain.Card{}, err
	}
	receipt, err := json.Marshal(map[string]any{"card_id": cardID, "masked_number": masked, "status": "active", "card_type": cardType})
	if err != nil {
		return domain.Card{}, err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE actions SET status='succeeded',result_json=?,updated_at=? WHERE id=?`, string(receipt), now.Format(time.RFC3339Nano), a.ID); err != nil {
		return domain.Card{}, err
	}
	if err := tx.Commit(); err != nil {
		return domain.Card{}, err
	}
	return domain.Card{ID: cardID, MaskedNumber: masked, Status: "active", LimitMinor: 500000, Restrictions: []string{}}, nil
}

func (r *Repository) ExecuteCardLimit(ctx context.Context, a domain.Action, cardID string, limitMinor int64, now time.Time) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	result, err := tx.ExecContext(ctx, `UPDATE actions SET status='executing',updated_at=? WHERE id=? AND status=?`, now.Format(time.RFC3339Nano), a.ID, a.Status)
	if err != nil {
		return err
	}
	if affected, err := result.RowsAffected(); err != nil {
		return err
	} else if affected != 1 {
		return domain.ErrActionStateConflict
	}
	result, err = tx.ExecContext(ctx, `UPDATE cards SET limit_minor=? WHERE id=? AND user_id=?`, limitMinor, cardID, a.UserID)
	if err != nil {
		return err
	}
	if affected, err := result.RowsAffected(); err != nil {
		return err
	} else if affected != 1 {
		return domain.ErrActionStateConflict
	}
	if _, err := tx.ExecContext(ctx, `UPDATE actions SET status='succeeded',updated_at=? WHERE id=?`, now.Format(time.RFC3339Nano), a.ID); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *Repository) ExecuteCardStatus(ctx context.Context, a domain.Action, cardID, status string, now time.Time) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	result, err := tx.ExecContext(ctx, `UPDATE actions SET status='executing',updated_at=? WHERE id=? AND status=?`, now.Format(time.RFC3339Nano), a.ID, a.Status)
	if err != nil {
		return err
	}
	if affected, err := result.RowsAffected(); err != nil {
		return err
	} else if affected != 1 {
		return domain.ErrActionStateConflict
	}
	result, err = tx.ExecContext(ctx, `UPDATE cards SET status=? WHERE id=? AND user_id=? AND ((?='frozen' AND status='active') OR (?='lost' AND status IN ('active','frozen')) OR (?='active' AND status IN ('frozen','lost')))`, status, cardID, a.UserID, status, status, status)
	if err != nil {
		return err
	}
	if affected, err := result.RowsAffected(); err != nil {
		return err
	} else if affected != 1 {
		return domain.ErrActionStateConflict
	}
	if _, err := tx.ExecContext(ctx, `UPDATE actions SET status='succeeded',updated_at=? WHERE id=?`, now.Format(time.RFC3339Nano), a.ID); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *Repository) ExecuteSubscriptionCancel(ctx context.Context, a domain.Action, subscriptionID string, now time.Time) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	result, err := tx.ExecContext(ctx, `UPDATE actions SET status='executing',updated_at=? WHERE id=? AND status=?`, now.Format(time.RFC3339Nano), a.ID, a.Status)
	if err != nil {
		return err
	}
	if affected, err := result.RowsAffected(); err != nil {
		return err
	} else if affected != 1 {
		return domain.ErrActionStateConflict
	}
	result, err = tx.ExecContext(ctx, `UPDATE subscriptions SET status='cancelled' WHERE id=? AND user_id=? AND status IN ('active','paused')`, subscriptionID, a.UserID)
	if err != nil {
		return err
	}
	if affected, err := result.RowsAffected(); err != nil {
		return err
	} else if affected != 1 {
		return domain.ErrActionStateConflict
	}
	if _, err := tx.ExecContext(ctx, `UPDATE actions SET status='succeeded',updated_at=? WHERE id=?`, now.Format(time.RFC3339Nano), a.ID); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *Repository) ExecuteTransferSplit(ctx context.Context, a domain.Action, split domain.TransferSplitSnapshot, now time.Time) (domain.TransferSplit, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.TransferSplit{}, err
	}
	defer tx.Rollback()
	result, err := tx.ExecContext(ctx, `UPDATE actions SET status='executing',updated_at=? WHERE id=? AND status=?`, now.Format(time.RFC3339Nano), a.ID, a.Status)
	if err != nil {
		return domain.TransferSplit{}, err
	}
	if affected, err := result.RowsAffected(); err != nil {
		return domain.TransferSplit{}, err
	} else if affected != 1 {
		return domain.TransferSplit{}, domain.ErrActionStateConflict
	}
	var collectible int64
	for _, participant := range split.Participants {
		if !participant.IsPayer {
			collectible += participant.AmountMinor
		}
	}
	participantsJSON, err := json.Marshal(split.Participants)
	if err != nil {
		return domain.TransferSplit{}, err
	}
	transferSplit := domain.TransferSplit{
		ID: a.ID, ConversationID: a.ConversationID, TotalAmountMinor: split.TotalAmountMinor,
		CollectibleMinor: collectible, Currency: split.Currency, Participants: split.Participants,
		Status: "requested", CreatedAt: now,
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO transfer_splits(id,conversation_id,user_id,total_amount_minor,collectible_minor,currency,participants_json,status,created_at) VALUES(?,?,?,?,?,?,?,?,?)`, transferSplit.ID, transferSplit.ConversationID, a.UserID, transferSplit.TotalAmountMinor, transferSplit.CollectibleMinor, transferSplit.Currency, string(participantsJSON), transferSplit.Status, now.Format(time.RFC3339Nano)); err != nil {
		return domain.TransferSplit{}, err
	}
	receipt, err := json.Marshal(transferSplit)
	if err != nil {
		return domain.TransferSplit{}, err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE actions SET status='succeeded',result_json=?,updated_at=? WHERE id=?`, string(receipt), now.Format(time.RFC3339Nano), a.ID); err != nil {
		return domain.TransferSplit{}, err
	}
	if err := tx.Commit(); err != nil {
		return domain.TransferSplit{}, err
	}
	return transferSplit, nil
}

func (r *Repository) CancelAction(ctx context.Context, id string, now time.Time) (bool, error) {
	result, err := r.db.ExecContext(ctx, `UPDATE actions SET status='cancelled',updated_at=? WHERE id=? AND status IN ('awaiting_confirmation','awaiting_mfa','scheduled')`, now.Format(time.RFC3339Nano), id)
	if err != nil {
		return false, err
	}
	affected, err := result.RowsAffected()
	return affected == 1, err
}

func (r *Repository) ScheduleAction(ctx context.Context, id, currentStatus string, now time.Time) (bool, error) {
	result, err := r.db.ExecContext(ctx, `UPDATE actions SET status='scheduled',updated_at=? WHERE id=? AND status=?`, now.Format(time.RFC3339Nano), id, currentStatus)
	if err != nil {
		return false, err
	}
	affected, err := result.RowsAffected()
	return affected == 1, err
}

func (r *Repository) RequireScheduledMFA(ctx context.Context, id string, expiresAt, now time.Time) (bool, error) {
	result, err := r.db.ExecContext(ctx, `UPDATE actions SET status='awaiting_mfa',expires_at=?,mfa_attempts=0,updated_at=? WHERE id=? AND status='scheduled'`, expiresAt.Format(time.RFC3339Nano), now.Format(time.RFC3339Nano), id)
	if err != nil {
		return false, err
	}
	affected, err := result.RowsAffected()
	return affected == 1, err
}

func (r *Repository) RecordMFAFailure(ctx context.Context, id string, now time.Time) (int, bool, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, false, err
	}
	defer tx.Rollback()
	result, err := tx.ExecContext(ctx, `UPDATE actions SET mfa_attempts=mfa_attempts+1, status=CASE WHEN mfa_attempts+1>=3 THEN 'failed' ELSE status END, updated_at=? WHERE id=? AND status='awaiting_mfa'`, now.Format(time.RFC3339Nano), id)
	if err != nil {
		return 0, false, err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return 0, false, err
	}
	if affected != 1 {
		return 0, false, domain.ErrActionStateConflict
	}
	var attempts int
	var status string
	if err := tx.QueryRowContext(ctx, `SELECT mfa_attempts,status FROM actions WHERE id=?`, id).Scan(&attempts, &status); err != nil {
		return 0, false, err
	}
	if err := tx.Commit(); err != nil {
		return 0, false, err
	}
	return attempts, status == "failed", nil
}

func (r *Repository) RecordSecurityFailure(ctx context.Context, userID, kind string, now time.Time) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO security_failures(id,user_id,kind,occurred_at) VALUES(?,?,?,?)`, domain.NewID("sec"), userID, kind, now.Format(time.RFC3339Nano))
	return err
}

func (r *Repository) SecurityLocked(ctx context.Context, userID string, now time.Time, window, lockDuration time.Duration, threshold int) (bool, error) {
	var count int
	var latest sql.NullString
	err := r.db.QueryRowContext(ctx, `SELECT COUNT(*),MAX(occurred_at) FROM security_failures WHERE user_id=? AND occurred_at>=?`, userID, now.Add(-window).Format(time.RFC3339Nano)).Scan(&count, &latest)
	if err != nil {
		return false, err
	}
	if count < threshold || !latest.Valid {
		return false, nil
	}
	latestAt, err := time.Parse(time.RFC3339Nano, latest.String)
	if err != nil {
		return false, err
	}
	return now.Before(latestAt.Add(lockDuration)), nil
}

func (r *Repository) AddAudit(ctx context.Context, event domain.AuditEvent) error {
	return insertAudit(ctx, r.db, event)
}

func insertAudit(ctx context.Context, executor sqlExecutor, event domain.AuditEvent) error {
	detail, err := json.Marshal(event.Detail)
	if err != nil {
		return err
	}
	_, err = executor.ExecContext(ctx, `INSERT INTO audit_events(id,trace_id,run_id,conversation_id,action_id,event_type,outcome,actor,policy_version,detail_json,occurred_at,sequence)
		SELECT ?,?,?,?,?,?,?,?,?,?, ?, COALESCE(MAX(sequence),0)+1 FROM audit_events WHERE trace_id=?`,
		event.ID, event.TraceID, event.RunID, event.ConversationID, event.ActionID, event.EventType, event.Outcome, event.Actor, event.PolicyVersion, string(detail), event.OccurredAt.Format(time.RFC3339Nano), event.TraceID)
	return err
}

func (r *Repository) Audit(ctx context.Context, traceID string) ([]domain.AuditEvent, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT id,trace_id,run_id,conversation_id,action_id,event_type,outcome,actor,policy_version,detail_json,occurred_at,sequence FROM audit_events WHERE trace_id=? ORDER BY sequence`, traceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []domain.AuditEvent
	for rows.Next() {
		var e domain.AuditEvent
		var detail, occurred string
		if err := rows.Scan(&e.ID, &e.TraceID, &e.RunID, &e.ConversationID, &e.ActionID, &e.EventType, &e.Outcome, &e.Actor, &e.PolicyVersion, &detail, &occurred, &e.Sequence); err != nil {
			return nil, err
		}
		if err := json.Unmarshal([]byte(detail), &e.Detail); err != nil {
			return nil, err
		}
		e.OccurredAt, err = time.Parse(time.RFC3339Nano, occurred)
		if err != nil {
			return nil, err
		}
		result = append(result, e)
	}
	return result, rows.Err()
}

func (r *Repository) AuditEventsByConversation(ctx context.Context, conversationID string) ([]domain.AuditEvent, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT id,trace_id,run_id,conversation_id,action_id,event_type,outcome,actor,occurred_at FROM audit_events WHERE conversation_id=? ORDER BY occurred_at,rowid`, conversationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []domain.AuditEvent
	for rows.Next() {
		var event domain.AuditEvent
		var occurred string
		if err := rows.Scan(&event.ID, &event.TraceID, &event.RunID, &event.ConversationID, &event.ActionID, &event.EventType, &event.Outcome, &event.Actor, &occurred); err != nil {
			return nil, err
		}
		event.OccurredAt, err = time.Parse(time.RFC3339Nano, occurred)
		if err != nil {
			return nil, err
		}
		result = append(result, event)
	}
	return result, rows.Err()
}

func (r *Repository) Idempotency(ctx context.Context, userID, method, path, key, fingerprint string) ([]byte, int, error) {
	var storedFingerprint, response string
	var status int
	err := r.db.QueryRowContext(ctx, `SELECT fingerprint,status_code,response_json FROM idempotency_records WHERE user_id=? AND method=? AND path=? AND idem_key=?`, userID, method, path, key).Scan(&storedFingerprint, &status, &response)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, 0, nil
	}
	if err != nil {
		return nil, 0, err
	}
	if storedFingerprint != fingerprint {
		return nil, 0, domain.ErrIdempotencyConflict
	}
	return []byte(response), status, nil
}

func (r *Repository) SaveIdempotency(ctx context.Context, userID, method, path, key, fingerprint string, status int, response []byte, now time.Time) error {
	result, err := r.db.ExecContext(ctx, `UPDATE idempotency_records SET status_code=?,response_json=? WHERE user_id=? AND method=? AND path=? AND idem_key=? AND fingerprint=? AND status_code=0`, status, string(response), userID, method, path, key, fingerprint)
	if err != nil {
		return err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if affected != 1 {
		return domain.ErrIdempotencyConflict
	}
	return nil
}

func (r *Repository) ReserveIdempotency(ctx context.Context, userID, method, path, key, fingerprint string, now time.Time) (bool, error) {
	result, err := r.db.ExecContext(ctx, `INSERT OR IGNORE INTO idempotency_records(user_id,method,path,idem_key,fingerprint,status_code,response_json,created_at) VALUES(?,?,?,?,?,0,'',?)`, userID, method, path, key, fingerprint, now.Format(time.RFC3339Nano))
	if err != nil {
		return false, err
	}
	affected, err := result.RowsAffected()
	return affected == 1, err
}

func (r *Repository) DeleteIdempotency(ctx context.Context, userID, method, path, key string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM idempotency_records WHERE user_id=? AND method=? AND path=? AND idem_key=? AND status_code=0`, userID, method, path, key)
	return err
}

func (r *Repository) CreateWorkflow(ctx context.Context, workflow domain.Workflow, audit domain.AuditEvent) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err := tx.ExecContext(ctx, `INSERT INTO workflows(id,user_id,purpose,deadline,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)`, workflow.ID, workflow.UserID, workflow.Purpose, workflow.Deadline.Format(time.RFC3339Nano), workflow.Status, workflow.CreatedAt.Format(time.RFC3339Nano), workflow.UpdatedAt.Format(time.RFC3339Nano)); err != nil {
		return err
	}
	for _, node := range workflow.Nodes {
		depends, err := json.Marshal(node.DependsOn)
		if err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `INSERT INTO workflow_nodes(workflow_id,node_id,kind,depends_on_json,status,action_id,amount_minor,merchant,due_at) VALUES(?,?,?,?,?,?,?,?,?)`, workflow.ID, node.ID, node.Kind, string(depends), node.Status, node.ActionID, node.AmountMinor, node.Merchant, node.DueAt.Format(time.RFC3339Nano)); err != nil {
			return err
		}
	}
	if err := insertAudit(ctx, tx, audit); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *Repository) Workflows(ctx context.Context, userID string) ([]domain.Workflow, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT id,purpose,deadline,status,created_at,updated_at FROM workflows WHERE user_id=? ORDER BY created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []domain.Workflow
	for rows.Next() {
		var workflow domain.Workflow
		var deadline, created, updated string
		if err := rows.Scan(&workflow.ID, &workflow.Purpose, &deadline, &workflow.Status, &created, &updated); err != nil {
			return nil, err
		}
		if workflow.Deadline, err = time.Parse(time.RFC3339Nano, deadline); err != nil {
			return nil, err
		}
		if workflow.CreatedAt, err = time.Parse(time.RFC3339Nano, created); err != nil {
			return nil, err
		}
		if workflow.UpdatedAt, err = time.Parse(time.RFC3339Nano, updated); err != nil {
			return nil, err
		}
		workflow.UserID = userID
		workflow.Nodes, err = r.workflowNodes(ctx, workflow.ID)
		if err != nil {
			return nil, err
		}
		result = append(result, workflow)
	}
	return result, rows.Err()
}

func (r *Repository) WorkflowOwner(ctx context.Context, id string) (string, error) {
	var userID string
	err := r.db.QueryRowContext(ctx, `SELECT user_id FROM workflows WHERE id=?`, id).Scan(&userID)
	if errors.Is(err, sql.ErrNoRows) {
		return "", domain.ErrNotFound
	}
	return userID, err
}

func (r *Repository) Workflow(ctx context.Context, id, userID string) (domain.Workflow, error) {
	var workflow domain.Workflow
	var deadline, created, updated string
	err := r.db.QueryRowContext(ctx, `SELECT id,user_id,purpose,deadline,status,created_at,updated_at FROM workflows WHERE id=?`, id).Scan(&workflow.ID, &workflow.UserID, &workflow.Purpose, &deadline, &workflow.Status, &created, &updated)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.Workflow{}, domain.ErrNotFound
	}
	if err != nil {
		return domain.Workflow{}, err
	}
	if workflow.UserID != userID {
		return domain.Workflow{}, domain.ErrForbidden
	}
	if workflow.Deadline, err = time.Parse(time.RFC3339Nano, deadline); err != nil {
		return domain.Workflow{}, err
	}
	if workflow.CreatedAt, err = time.Parse(time.RFC3339Nano, created); err != nil {
		return domain.Workflow{}, err
	}
	if workflow.UpdatedAt, err = time.Parse(time.RFC3339Nano, updated); err != nil {
		return domain.Workflow{}, err
	}
	workflow.Nodes, err = r.workflowNodes(ctx, workflow.ID)
	return workflow, err
}

func (r *Repository) workflowNodes(ctx context.Context, workflowID string) ([]domain.WorkflowNode, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT node_id,kind,depends_on_json,status,action_id,amount_minor,merchant,due_at FROM workflow_nodes WHERE workflow_id=? ORDER BY rowid`, workflowID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var nodes []domain.WorkflowNode
	for rows.Next() {
		var node domain.WorkflowNode
		var depends, dueAt string
		if err := rows.Scan(&node.ID, &node.Kind, &depends, &node.Status, &node.ActionID, &node.AmountMinor, &node.Merchant, &dueAt); err != nil {
			return nil, err
		}
		if err := json.Unmarshal([]byte(depends), &node.DependsOn); err != nil {
			return nil, err
		}
		if dueAt != "" {
			if node.DueAt, err = time.Parse(time.RFC3339Nano, dueAt); err != nil {
				return nil, err
			}
		}
		nodes = append(nodes, node)
	}
	return nodes, rows.Err()
}

func (r *Repository) CancelWorkflow(ctx context.Context, id, userID string, now time.Time) error {
	return r.terminateWorkflow(ctx, id, userID, "cancelled", now)
}

func (r *Repository) ExpireWorkflow(ctx context.Context, id, userID string, now time.Time) error {
	return r.terminateWorkflow(ctx, id, userID, "failed", now)
}

func (r *Repository) terminateWorkflow(ctx context.Context, id, userID, status string, now time.Time) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	result, err := tx.ExecContext(ctx, `UPDATE workflows SET status=?,updated_at=? WHERE id=? AND user_id=? AND status IN ('pending','running','partially_completed')`, status, now.Format(time.RFC3339Nano), id, userID)
	if err != nil {
		return err
	}
	if affected, err := result.RowsAffected(); err != nil {
		return err
	} else if affected != 1 {
		return domain.ErrActionStateConflict
	}
	if _, err := tx.ExecContext(ctx, `UPDATE actions SET status='cancelled',updated_at=? WHERE id IN (SELECT action_id FROM workflow_nodes WHERE workflow_id=? AND action_id<>'' AND status='awaiting_authorization') AND status IN ('awaiting_confirmation','awaiting_mfa','scheduled')`, now.Format(time.RFC3339Nano), id); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE workflow_nodes SET status='skipped' WHERE workflow_id=? AND status IN ('pending','ready','awaiting_authorization')`, id); err != nil {
		return err
	}
	if err := releaseWorkflowBudget(ctx, tx, id); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *Repository) CreateWorkflowAction(ctx context.Context, action domain.Action, workflowID, nodeID, status string, now time.Time) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if err := insertAction(ctx, tx, action); err != nil {
		return err
	}
	result, err := tx.ExecContext(ctx, `UPDATE workflow_nodes SET status=?,action_id=? WHERE workflow_id=? AND node_id=? AND status='ready'`, status, action.ID, workflowID, nodeID)
	if err != nil {
		return err
	}
	if affected, err := result.RowsAffected(); err != nil {
		return err
	} else if affected != 1 {
		return domain.ErrActionStateConflict
	}
	if _, err := tx.ExecContext(ctx, `UPDATE workflows SET status='running',updated_at=? WHERE id=? AND status IN ('pending','running','partially_completed')`, now.Format(time.RFC3339Nano), workflowID); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *Repository) CompleteWorkflowNode(ctx context.Context, workflowID, nodeID string, now time.Time) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	result, err := tx.ExecContext(ctx, `UPDATE workflow_nodes SET status='succeeded' WHERE workflow_id=? AND node_id=? AND status IN ('ready','awaiting_authorization')`, workflowID, nodeID)
	if err != nil {
		return err
	}
	if affected, err := result.RowsAffected(); err != nil {
		return err
	} else if affected != 1 {
		return domain.ErrActionStateConflict
	}
	rows, err := tx.QueryContext(ctx, `SELECT node_id,depends_on_json,status FROM workflow_nodes WHERE workflow_id=?`, workflowID)
	if err != nil {
		return err
	}
	type nodeState struct{ id, depends, status string }
	var states []nodeState
	for rows.Next() {
		var state nodeState
		if err := rows.Scan(&state.id, &state.depends, &state.status); err != nil {
			rows.Close()
			return err
		}
		states = append(states, state)
	}
	if err := rows.Close(); err != nil {
		return err
	}
	allSucceeded := true
	for _, state := range states {
		if state.status != "succeeded" {
			allSucceeded = false
		}
		if state.status == "pending" {
			var deps []string
			if err := json.Unmarshal([]byte(state.depends), &deps); err != nil {
				return err
			}
			ready := true
			for _, dep := range deps {
				var depStatus string
				if err := tx.QueryRowContext(ctx, `SELECT status FROM workflow_nodes WHERE workflow_id=? AND node_id=?`, workflowID, dep).Scan(&depStatus); err != nil {
					return err
				}
				if depStatus != "succeeded" {
					ready = false
				}
			}
			if ready {
				if _, err := tx.ExecContext(ctx, `UPDATE workflow_nodes SET status='ready' WHERE workflow_id=? AND node_id=? AND status='pending'`, workflowID, state.id); err != nil {
					return err
				}
			}
		}
	}
	workflowStatus := "partially_completed"
	if allSucceeded {
		var remainingBudget int64
		if err := tx.QueryRowContext(ctx, `SELECT COALESCE(SUM(remaining_minor),0) FROM workflow_budget_locks WHERE workflow_id=? AND status='locked'`, workflowID).Scan(&remainingBudget); err != nil {
			return err
		}
		var externalOrders int
		if err := tx.QueryRowContext(ctx, `SELECT COUNT(*) FROM workflow_nodes WHERE workflow_id=? AND kind='external_order'`, workflowID).Scan(&externalOrders); err != nil {
			return err
		}
		if remainingBudget == 0 || externalOrders > 0 {
			if err := releaseWorkflowBudget(ctx, tx, workflowID); err != nil {
				return err
			}
			workflowStatus = "completed"
		}
	}
	_, err = tx.ExecContext(ctx, `UPDATE workflows SET status=?,updated_at=? WHERE id=? AND status IN ('pending','running','partially_completed')`, workflowStatus, now.Format(time.RFC3339Nano), workflowID)
	if err != nil {
		return err
	}
	return tx.Commit()
}

func (r *Repository) ExecuteWorkflowBudgetLock(ctx context.Context, a domain.Action, workflowID, nodeID string, amount int64, now time.Time) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	result, err := tx.ExecContext(ctx, `UPDATE actions SET status='executing',updated_at=? WHERE id=? AND status=?`, now.Format(time.RFC3339Nano), a.ID, a.Status)
	if err != nil {
		return err
	}
	if affected, err := result.RowsAffected(); err != nil {
		return err
	} else if affected != 1 {
		return domain.ErrActionStateConflict
	}
	var accountID string
	var balance, reserved int64
	if err := tx.QueryRowContext(ctx, `SELECT id,balance_minor,reserved_minor FROM accounts WHERE user_id=?`, a.UserID).Scan(&accountID, &balance, &reserved); err != nil {
		return err
	}
	if amount <= 0 || balance-reserved < amount {
		if _, err := tx.ExecContext(ctx, `UPDATE actions SET status='failed',updated_at=? WHERE id=?`, now.Format(time.RFC3339Nano), a.ID); err != nil {
			return err
		}
		if err := tx.Commit(); err != nil {
			return err
		}
		return domain.ErrInsufficientBalance
	}
	if _, err := tx.ExecContext(ctx, `UPDATE accounts SET reserved_minor=reserved_minor+? WHERE id=?`, amount, accountID); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO workflow_budget_locks(id,workflow_id,node_id,user_id,amount_minor,remaining_minor,status,created_at) VALUES(?,?,?,?,?,?,?,?)`, domain.NewID("lock"), workflowID, nodeID, a.UserID, amount, amount, "locked", now.Format(time.RFC3339Nano)); err != nil {
		return err
	}
	receipt, err := json.Marshal(map[string]any{"workflow_id": workflowID, "node_id": nodeID, "amount_minor": amount, "status": "locked"})
	if err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE actions SET status='succeeded',result_json=?,updated_at=? WHERE id=?`, string(receipt), now.Format(time.RFC3339Nano), a.ID); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *Repository) ExecuteWorkflowOrder(ctx context.Context, a domain.Action, workflowID, nodeID string, amount int64, merchant string, now time.Time) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	result, err := tx.ExecContext(ctx, `UPDATE actions SET status='executing',updated_at=? WHERE id=? AND status=?`, now.Format(time.RFC3339Nano), a.ID, a.Status)
	if err != nil {
		return err
	}
	if affected, err := result.RowsAffected(); err != nil {
		return err
	} else if affected != 1 {
		return domain.ErrActionStateConflict
	}
	var accountID string
	var balance, reserved int64
	if err := tx.QueryRowContext(ctx, `SELECT id,balance_minor,reserved_minor FROM accounts WHERE user_id=?`, a.UserID).Scan(&accountID, &balance, &reserved); err != nil {
		return err
	}
	var availableReserved int64
	if err := tx.QueryRowContext(ctx, `SELECT COALESCE(SUM(remaining_minor),0) FROM workflow_budget_locks WHERE workflow_id=? AND status='locked'`, workflowID).Scan(&availableReserved); err != nil {
		return err
	}
	if amount <= 0 || amount > availableReserved || amount > reserved || amount > balance {
		if _, err := tx.ExecContext(ctx, `UPDATE actions SET status='failed',updated_at=? WHERE id=?`, now.Format(time.RFC3339Nano), a.ID); err != nil {
			return err
		}
		if err := tx.Commit(); err != nil {
			return err
		}
		return domain.ErrBudgetNotReserved
	}
	result, err = tx.ExecContext(ctx, `UPDATE accounts SET balance_minor=balance_minor-?,reserved_minor=reserved_minor-? WHERE id=? AND balance_minor>=? AND reserved_minor>=?`, amount, amount, accountID, amount, amount)
	if err != nil {
		return err
	}
	if affected, err := result.RowsAffected(); err != nil {
		return err
	} else if affected != 1 {
		return domain.ErrInsufficientBalance
	}
	rows, err := tx.QueryContext(ctx, `SELECT id,remaining_minor FROM workflow_budget_locks WHERE workflow_id=? AND status='locked' ORDER BY rowid`, workflowID)
	if err != nil {
		return err
	}
	type budgetLock struct {
		id        string
		remaining int64
	}
	var locks []budgetLock
	for rows.Next() {
		var lock budgetLock
		if err := rows.Scan(&lock.id, &lock.remaining); err != nil {
			rows.Close()
			return err
		}
		locks = append(locks, lock)
	}
	if err := rows.Close(); err != nil {
		return err
	}
	toConsume := amount
	for _, lock := range locks {
		if toConsume == 0 {
			break
		}
		used := min(toConsume, lock.remaining)
		status := "locked"
		if used == lock.remaining {
			status = "consumed"
		}
		if _, err := tx.ExecContext(ctx, `UPDATE workflow_budget_locks SET remaining_minor=remaining_minor-?,status=? WHERE id=?`, used, status, lock.id); err != nil {
			return err
		}
		toConsume -= used
	}
	orderID := domain.NewID("ord")
	if _, err := tx.ExecContext(ctx, `INSERT INTO workflow_orders(id,workflow_id,node_id,user_id,merchant,amount_minor,status,created_at) VALUES(?,?,?,?,?,?,?,?)`, orderID, workflowID, nodeID, a.UserID, merchant, amount, "confirmed", now.Format(time.RFC3339Nano)); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO ledger_entries(id,account_id,direction,amount_minor,category,description,created_at) VALUES(?,?,?,?,?,?,?)`, domain.NewID("txn"), accountID, "out", amount, "workflow_order", "外部订单 "+merchant, now.Format(time.RFC3339Nano)); err != nil {
		return err
	}
	receipt, err := json.Marshal(map[string]any{"order_id": orderID, "merchant": merchant, "amount_minor": amount})
	if err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE actions SET status='succeeded',updated_at=?,result_json=? WHERE id=?`, now.Format(time.RFC3339Nano), string(receipt), a.ID); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *Repository) FailWorkflowNode(ctx context.Context, workflowID, nodeID string, now time.Time) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	result, err := tx.ExecContext(ctx, `UPDATE workflow_nodes SET status='failed' WHERE workflow_id=? AND node_id=? AND status IN ('ready','awaiting_authorization')`, workflowID, nodeID)
	if err != nil {
		return err
	}
	if affected, err := result.RowsAffected(); err != nil {
		return err
	} else if affected != 1 {
		return domain.ErrActionStateConflict
	}
	if _, err := tx.ExecContext(ctx, `UPDATE actions SET status='cancelled',updated_at=? WHERE id IN (SELECT action_id FROM workflow_nodes WHERE workflow_id=? AND action_id<>'' AND status='awaiting_authorization') AND status IN ('awaiting_confirmation','awaiting_mfa','scheduled')`, now.Format(time.RFC3339Nano), workflowID); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE workflow_nodes SET status='skipped' WHERE workflow_id=? AND status IN ('pending','ready','awaiting_authorization')`, workflowID); err != nil {
		return err
	}
	if err := releaseWorkflowBudget(ctx, tx, workflowID); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE workflows SET status='failed',updated_at=? WHERE id=? AND status IN ('pending','running','partially_completed')`, now.Format(time.RFC3339Nano), workflowID); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *Repository) CancelWorkflowNode(ctx context.Context, workflowID, nodeID string, now time.Time) error {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	result, err := tx.ExecContext(ctx, `UPDATE workflow_nodes SET status='skipped' WHERE workflow_id=? AND node_id=? AND status='awaiting_authorization'`, workflowID, nodeID)
	if err != nil {
		return err
	}
	if affected, err := result.RowsAffected(); err != nil {
		return err
	} else if affected != 1 {
		return domain.ErrActionStateConflict
	}
	if _, err := tx.ExecContext(ctx, `UPDATE actions SET status='cancelled',updated_at=? WHERE id IN (SELECT action_id FROM workflow_nodes WHERE workflow_id=? AND action_id<>'' AND status='awaiting_authorization') AND status IN ('awaiting_confirmation','awaiting_mfa','scheduled')`, now.Format(time.RFC3339Nano), workflowID); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE workflow_nodes SET status='skipped' WHERE workflow_id=? AND status IN ('pending','ready','awaiting_authorization')`, workflowID); err != nil {
		return err
	}
	if err := releaseWorkflowBudget(ctx, tx, workflowID); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE workflows SET status='cancelled',updated_at=? WHERE id=? AND status IN ('pending','running','partially_completed')`, now.Format(time.RFC3339Nano), workflowID); err != nil {
		return err
	}
	return tx.Commit()
}

func releaseWorkflowBudget(ctx context.Context, tx *sql.Tx, workflowID string) error {
	var amount int64
	if err := tx.QueryRowContext(ctx, `SELECT COALESCE(SUM(remaining_minor),0) FROM workflow_budget_locks WHERE workflow_id=? AND status='locked'`, workflowID).Scan(&amount); err != nil {
		return err
	}
	if amount == 0 {
		return nil
	}
	result, err := tx.ExecContext(ctx, `UPDATE accounts SET reserved_minor=reserved_minor-? WHERE user_id=(SELECT user_id FROM workflows WHERE id=?) AND reserved_minor>=?`, amount, workflowID, amount)
	if err != nil {
		return err
	}
	if affected, err := result.RowsAffected(); err != nil {
		return err
	} else if affected != 1 {
		return domain.ErrInsufficientBalance
	}
	_, err = tx.ExecContext(ctx, `UPDATE workflow_budget_locks SET remaining_minor=0,status='released' WHERE workflow_id=? AND status='locked'`, workflowID)
	return err
}
