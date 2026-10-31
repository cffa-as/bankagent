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

func NewRepository(db *sql.DB) *Repository { return &Repository{db: db} }

func (r *Repository) Seed(ctx context.Context, now time.Time) error {
	_, err := r.db.ExecContext(ctx, `INSERT OR IGNORE INTO accounts(id,user_id,currency,balance_minor) VALUES(?,?,?,?)`, "acct_demo", domain.DemoUserID, "CNY", 1000000)
	if err != nil {
		return fmt.Errorf("seed account: %w", err)
	}
	_, err = r.db.ExecContext(ctx, `INSERT OR IGNORE INTO beneficiaries(id,user_id,name,account_id) VALUES(?,?,?,?)`, "beneficiary_zhangsan", domain.DemoUserID, "张三", "acct_zhangsan")
	if err != nil {
		return fmt.Errorf("seed beneficiary: %w", err)
	}
	_, err = r.db.ExecContext(ctx, `INSERT OR IGNORE INTO beneficiaries(id,user_id,name,account_id) VALUES(?,?,?,?)`, "beneficiary_lisi", domain.DemoUserID, "李四", "acct_lisi")
	if err != nil {
		return fmt.Errorf("seed beneficiary: %w", err)
	}
	return nil
}

func (r *Repository) CreateConversation(ctx context.Context, c domain.Conversation) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO conversations(id,user_id,created_at) VALUES(?,?,?)`, c.ID, c.UserID, c.CreatedAt.Format(time.RFC3339Nano))
	return err
}

func (r *Repository) ConversationOwner(ctx context.Context, id string) (string, error) {
	var userID string
	err := r.db.QueryRowContext(ctx, `SELECT user_id FROM conversations WHERE id=?`, id).Scan(&userID)
	return userID, err
}

func (r *Repository) Account(ctx context.Context, userID string) (domain.Account, error) {
	var a domain.Account
	err := r.db.QueryRowContext(ctx, `SELECT id,user_id,currency,balance_minor FROM accounts WHERE user_id=?`, userID).Scan(&a.ID, &a.UserID, &a.Currency, &a.BalanceMinor)
	return a, err
}

func (r *Repository) Transactions(ctx context.Context, userID string) ([]domain.Transaction, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT l.id,l.direction,l.amount_minor,l.description,l.created_at FROM ledger_entries l JOIN accounts a ON a.id=l.account_id WHERE a.user_id=? ORDER BY l.created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []domain.Transaction
	for rows.Next() {
		var t domain.Transaction
		var created string
		if err := rows.Scan(&t.ID, &t.Direction, &t.AmountMinor, &t.Description, &created); err != nil {
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

func (r *Repository) DailyOutgoing(ctx context.Context, userID string, day time.Time) (int64, error) {
	loc, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		return 0, err
	}
	day = day.In(loc)
	start := time.Date(day.Year(), day.Month(), day.Day(), 0, 0, 0, 0, loc)
	end := start.AddDate(0, 0, 1)
	var total sql.NullInt64
	err = r.db.QueryRowContext(ctx, `SELECT COALESCE(SUM(l.amount_minor),0) FROM ledger_entries l JOIN accounts a ON a.id=l.account_id WHERE a.user_id=? AND l.direction='out' AND l.created_at>=? AND l.created_at<?`, userID, start.Format(time.RFC3339Nano), end.Format(time.RFC3339Nano)).Scan(&total)
	return total.Int64, err
}

func (r *Repository) Beneficiary(ctx context.Context, userID, name string) (string, error) {
	var accountID string
	err := r.db.QueryRowContext(ctx, `SELECT account_id FROM beneficiaries WHERE user_id=? AND name=?`, userID, name).Scan(&accountID)
	return accountID, err
}

func (r *Repository) CreateAction(ctx context.Context, a domain.Action) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO actions(id,conversation_id,user_id,kind,risk_level,status,snapshot_json,expires_at,created_at,updated_at,mfa_attempts) VALUES(?,?,?,?,?,?,?,?,?,?,?)`, a.ID, a.ConversationID, a.UserID, a.Kind, a.RiskLevel, a.Status, a.SnapshotJSON, a.ExpiresAt.Format(time.RFC3339Nano), a.CreatedAt.Format(time.RFC3339Nano), a.UpdatedAt.Format(time.RFC3339Nano), a.MFAAttempts)
	return err
}

func (r *Repository) Action(ctx context.Context, id string) (domain.Action, error) {
	var a domain.Action
	var expires, created, updated string
	err := r.db.QueryRowContext(ctx, `SELECT id,conversation_id,user_id,kind,risk_level,status,snapshot_json,expires_at,created_at,updated_at,mfa_attempts FROM actions WHERE id=?`, id).Scan(&a.ID, &a.ConversationID, &a.UserID, &a.Kind, &a.RiskLevel, &a.Status, &a.SnapshotJSON, &expires, &created, &updated, &a.MFAAttempts)
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
	_, err := r.db.ExecContext(ctx, `UPDATE actions SET status=?,updated_at=?,mfa_attempts=? WHERE id=?`, a.Status, a.UpdatedAt.Format(time.RFC3339Nano), a.MFAAttempts, a.ID)
	return err
}

func (r *Repository) ExecuteTransfer(ctx context.Context, a domain.Action, amount int64, description string, now time.Time) error {
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
	var balance int64
	if err := tx.QueryRowContext(ctx, `SELECT id,balance_minor FROM accounts WHERE user_id=?`, a.UserID).Scan(&accountID, &balance); err != nil {
		return err
	}
	if balance < amount {
		if _, err := tx.ExecContext(ctx, `UPDATE actions SET status='failed',updated_at=? WHERE id=?`, now.Format(time.RFC3339Nano), a.ID); err != nil {
			return err
		}
		if err := tx.Commit(); err != nil {
			return err
		}
		return domain.ErrInsufficientBalance
	}
	if _, err := tx.ExecContext(ctx, `UPDATE accounts SET balance_minor=balance_minor-? WHERE id=?`, amount, accountID); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO ledger_entries(id,account_id,direction,amount_minor,description,created_at) VALUES(?,?,?,?,?,?)`, domain.NewID("txn"), accountID, "out", amount, description, now.Format(time.RFC3339Nano)); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE actions SET status='succeeded',updated_at=? WHERE id=?`, now.Format(time.RFC3339Nano), a.ID); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *Repository) CancelAction(ctx context.Context, id string, now time.Time) (bool, error) {
	result, err := r.db.ExecContext(ctx, `UPDATE actions SET status='cancelled',updated_at=? WHERE id=? AND status IN ('awaiting_confirmation','awaiting_mfa')`, now.Format(time.RFC3339Nano), id)
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

func (r *Repository) AddAudit(ctx context.Context, event domain.AuditEvent) error {
	detail, err := json.Marshal(event.Detail)
	if err != nil {
		return err
	}
	_, err = r.db.ExecContext(ctx, `INSERT INTO audit_events(id,trace_id,conversation_id,action_id,event_type,outcome,actor,detail_json,occurred_at,sequence)
		SELECT ?,?,?,?,?,?,?,?, ?, COALESCE(MAX(sequence),0)+1 FROM audit_events WHERE trace_id=?`,
		event.ID, event.TraceID, event.ConversationID, event.ActionID, event.EventType, event.Outcome, event.Actor, string(detail), event.OccurredAt.Format(time.RFC3339Nano), event.TraceID)
	return err
}

func (r *Repository) Audit(ctx context.Context, traceID string) ([]domain.AuditEvent, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT id,trace_id,conversation_id,action_id,event_type,outcome,actor,detail_json,occurred_at,sequence FROM audit_events WHERE trace_id=? ORDER BY sequence`, traceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var result []domain.AuditEvent
	for rows.Next() {
		var e domain.AuditEvent
		var detail, occurred string
		if err := rows.Scan(&e.ID, &e.TraceID, &e.ConversationID, &e.ActionID, &e.EventType, &e.Outcome, &e.Actor, &detail, &occurred, &e.Sequence); err != nil {
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
	_, err := r.db.ExecContext(ctx, `INSERT INTO idempotency_records(user_id,method,path,idem_key,fingerprint,status_code,response_json,created_at) VALUES(?,?,?,?,?,?,?,?)`, userID, method, path, key, fingerprint, status, string(response), now.Format(time.RFC3339Nano))
	return err
}
