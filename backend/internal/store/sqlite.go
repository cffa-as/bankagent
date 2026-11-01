package store

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"

	"github.com/cffa-as/bankagent/internal/domain"
	_ "github.com/mattn/go-sqlite3"
)

func Open(path string) (*sql.DB, error) {
	db, err := sql.Open("sqlite3", path+"?_foreign_keys=on&_journal_mode=WAL&_busy_timeout=5000&_txlock=immediate")
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}
	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("ping sqlite: %w", err)
	}
	if _, err := db.Exec(schema); err != nil {
		db.Close()
		return nil, fmt.Errorf("init schema: %w", err)
	}
	if err := ensureSchema(db); err != nil {
		db.Close()
		return nil, fmt.Errorf("migrate schema: %w", err)
	}
	return db, nil
}

func ensureSchema(db *sql.DB) error {
	rows, err := db.Query(`PRAGMA table_info(ledger_entries)`)
	if err != nil {
		return err
	}
	defer rows.Close()
	hasCategory := false
	for rows.Next() {
		var cid int
		var name, columnType string
		var notNull, primaryKey int
		var defaultValue any
		if err := rows.Scan(&cid, &name, &columnType, &notNull, &defaultValue, &primaryKey); err != nil {
			return err
		}
		if name == "category" {
			hasCategory = true
		}
	}
	if err := rows.Err(); err != nil {
		return err
	}
	if !hasCategory {
		if _, err := db.Exec(`ALTER TABLE ledger_entries ADD COLUMN category TEXT NOT NULL DEFAULT 'other'`); err != nil {
			return err
		}
	}
	rows, err = db.Query(`PRAGMA table_info(investment_products)`)
	if err != nil {
		return err
	}
	hasAnnualRate := false
	for rows.Next() {
		var cid int
		var name, columnType string
		var notNull, primaryKey int
		var defaultValue any
		if err := rows.Scan(&cid, &name, &columnType, &notNull, &defaultValue, &primaryKey); err != nil {
			rows.Close()
			return err
		}
		if name == "annual_rate_bps" {
			hasAnnualRate = true
		}
	}
	if err := rows.Close(); err != nil {
		return err
	}
	if !hasAnnualRate {
		if _, err := db.Exec(`ALTER TABLE investment_products ADD COLUMN annual_rate_bps INTEGER NOT NULL DEFAULT 300`); err != nil {
			return err
		}
	}
	rows, err = db.Query(`PRAGMA table_info(actions)`)
	if err != nil {
		return err
	}
	hasResult := false
	for rows.Next() {
		var cid, notNull, primaryKey int
		var name, columnType string
		var defaultValue any
		if err := rows.Scan(&cid, &name, &columnType, &notNull, &defaultValue, &primaryKey); err != nil {
			rows.Close()
			return err
		}
		if name == "result_json" {
			hasResult = true
		}
	}
	if err := rows.Close(); err != nil {
		return err
	}
	if !hasResult {
		if _, err := db.Exec(`ALTER TABLE actions ADD COLUMN result_json TEXT NOT NULL DEFAULT ''`); err != nil {
			return err
		}
	}
	rows, err = db.Query(`PRAGMA table_info(beneficiaries)`)
	if err != nil {
		return err
	}
	hasPhone := false
	for rows.Next() {
		var cid, notNull, primaryKey int
		var name, columnType string
		var defaultValue any
		if err := rows.Scan(&cid, &name, &columnType, &notNull, &defaultValue, &primaryKey); err != nil {
			rows.Close()
			return err
		}
		if name == "phone" {
			hasPhone = true
		}
	}
	if err := rows.Close(); err != nil {
		return err
	}
	if !hasPhone {
		if _, err := db.Exec(`ALTER TABLE beneficiaries ADD COLUMN phone TEXT NOT NULL DEFAULT ''`); err != nil {
			return err
		}
	}
	if err := ensureColumn(db, "accounts", "reserved_minor", "INTEGER NOT NULL DEFAULT 0"); err != nil {
		return err
	}
	if err := ensureColumn(db, "workflow_nodes", "due_at", "TEXT NOT NULL DEFAULT ''"); err != nil {
		return err
	}
	if err := ensureColumn(db, "workflow_budget_locks", "remaining_minor", "INTEGER NOT NULL DEFAULT 0"); err != nil {
		return err
	}
	if err := ensureColumn(db, "actions", "trace_id", "TEXT NOT NULL DEFAULT ''"); err != nil {
		return err
	}
	if err := ensureColumn(db, "actions", "snapshot_hash", "TEXT NOT NULL DEFAULT ''"); err != nil {
		return err
	}
	if err := ensureColumn(db, "actions", "run_id", "TEXT NOT NULL DEFAULT ''"); err != nil {
		return err
	}
	if _, err := db.Exec(`CREATE INDEX IF NOT EXISTS idx_actions_run ON actions(run_id, created_at)`); err != nil {
		return err
	}
	if err := ensureColumn(db, "audit_events", "run_id", "TEXT NOT NULL DEFAULT ''"); err != nil {
		return err
	}
	if err := ensureColumn(db, "audit_events", "policy_version", "TEXT NOT NULL DEFAULT ''"); err != nil {
		return err
	}
	if err := ensureActionEvidence(db); err != nil {
		return err
	}
	if _, err := db.Exec(`UPDATE workflow_budget_locks SET remaining_minor=amount_minor WHERE status='locked' AND remaining_minor=0`); err != nil {
		return err
	}
	return ensureActionAuditTriggers(db)
}

func ensureActionEvidence(db *sql.DB) error {
	rows, err := db.Query(`SELECT id,trace_id,snapshot_json,snapshot_hash FROM actions WHERE trace_id='' OR snapshot_hash=''`)
	if err != nil {
		return err
	}
	type actionEvidence struct {
		id, traceID, snapshotJSON, snapshotHash string
	}
	var actions []actionEvidence
	for rows.Next() {
		var action actionEvidence
		if err := rows.Scan(&action.id, &action.traceID, &action.snapshotJSON, &action.snapshotHash); err != nil {
			rows.Close()
			return err
		}
		actions = append(actions, action)
	}
	if err := rows.Close(); err != nil {
		return err
	}
	for _, action := range actions {
		traceID, hash := action.traceID, action.snapshotHash
		if traceID == "" {
			traceID = domain.NewID("tr")
		}
		if hash == "" {
			sum := sha256.Sum256([]byte(action.snapshotJSON))
			hash = hex.EncodeToString(sum[:])
		}
		if _, err := db.Exec(`UPDATE actions SET trace_id=?,snapshot_hash=? WHERE id=?`, traceID, hash, action.id); err != nil {
			return err
		}
	}
	return nil
}

func ensureActionAuditTriggers(db *sql.DB) error {
	_, err := db.Exec(`
DROP TRIGGER IF EXISTS audit_action_created;
DROP TRIGGER IF EXISTS audit_action_status_changed;
CREATE TRIGGER audit_action_created
AFTER INSERT ON actions
BEGIN
    INSERT INTO audit_events(id,trace_id,run_id,conversation_id,action_id,event_type,outcome,actor,policy_version,detail_json,occurred_at,sequence)
    VALUES(
        'evt_' || lower(hex(randomblob(8))), NEW.trace_id, NEW.run_id, NEW.conversation_id, NEW.id,
        'action_created', 'succeeded', 'system', 'bankagent-policy-v1',
        json_object('kind',NEW.kind,'risk_level',NEW.risk_level,'snapshot_hash',NEW.snapshot_hash,'workflow_id',json_extract(NEW.snapshot_json,'$.workflow_id')),
        NEW.created_at,
        COALESCE((SELECT MAX(sequence)+1 FROM audit_events WHERE trace_id=NEW.trace_id),1)
    );
END;
CREATE TRIGGER audit_action_status_changed
AFTER UPDATE OF status ON actions
WHEN OLD.status<>NEW.status
BEGIN
    INSERT INTO audit_events(id,trace_id,run_id,conversation_id,action_id,event_type,outcome,actor,policy_version,detail_json,occurred_at,sequence)
    VALUES(
        'evt_' || lower(hex(randomblob(8))), NEW.trace_id, NEW.run_id, NEW.conversation_id, NEW.id,
        CASE
            WHEN OLD.status IN ('awaiting_confirmation','awaiting_mfa') AND NEW.status='executing' THEN 'authorization_gate_passed'
            WHEN OLD.status IN ('awaiting_confirmation','awaiting_mfa') AND NEW.status='scheduled' THEN 'action_scheduled'
            WHEN OLD.status='scheduled' AND NEW.status='awaiting_mfa' THEN 'scheduled_execution_mfa_required'
            WHEN NEW.status='succeeded' THEN 'action_succeeded'
            WHEN NEW.status='failed' THEN 'action_failed'
            WHEN NEW.status='cancelled' THEN 'action_cancelled'
            WHEN NEW.status='expired' THEN 'action_expired'
            ELSE 'action_status_changed'
        END,
        CASE WHEN NEW.status IN ('failed','cancelled','expired') THEN 'failed' ELSE 'succeeded' END,
        'system', 'bankagent-policy-v1',
        json_object(
            'from_status',OLD.status,
            'to_status',NEW.status,
            'snapshot_hash',NEW.snapshot_hash,
            'result',CASE WHEN NEW.result_json<>'' AND json_valid(NEW.result_json) THEN json(NEW.result_json) ELSE NULL END
        ),
        NEW.updated_at,
        COALESCE((SELECT MAX(sequence)+1 FROM audit_events WHERE trace_id=NEW.trace_id),1)
    );
END;
`)
	return err
}

func ensureColumn(db *sql.DB, table, column, definition string) error {
	rows, err := db.Query(`PRAGMA table_info(` + table + `)`)
	if err != nil {
		return err
	}
	found := false
	for rows.Next() {
		var cid, notNull, primaryKey int
		var name, columnType string
		var defaultValue any
		if err := rows.Scan(&cid, &name, &columnType, &notNull, &defaultValue, &primaryKey); err != nil {
			rows.Close()
			return err
		}
		found = found || name == column
	}
	if err := rows.Close(); err != nil {
		return err
	}
	if found {
		return nil
	}
	_, err = db.Exec(`ALTER TABLE ` + table + ` ADD COLUMN ` + column + ` ` + definition)
	return err
}

const schema = `
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS conversation_messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS runs (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    trace_id TEXT NOT NULL,
    status TEXT NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    handoff_to TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    finished_at TEXT NOT NULL DEFAULT '',
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    currency TEXT NOT NULL,
    balance_minor INTEGER NOT NULL,
    reserved_minor INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS beneficiaries (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL DEFAULT '',
    account_id TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS investment_products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    risk_level TEXT NOT NULL,
    minimum_amount_minor INTEGER NOT NULL,
    term_days INTEGER NOT NULL,
    benchmark_note TEXT NOT NULL,
    annual_rate_bps INTEGER NOT NULL DEFAULT 300
);
CREATE TABLE IF NOT EXISTS investment_holdings (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    amount_minor INTEGER NOT NULL,
    status TEXT NOT NULL,
    purchased_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    masked_number TEXT NOT NULL,
    status TEXT NOT NULL,
    limit_minor INTEGER NOT NULL,
    restrictions_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    merchant_ref TEXT NOT NULL,
    status TEXT NOT NULL,
    amount_minor INTEGER NOT NULL,
    currency TEXT NOT NULL,
    billing_cycle TEXT NOT NULL,
    next_charge_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS cashflow_events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    direction TEXT NOT NULL,
    amount_minor INTEGER NOT NULL,
    currency TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    essential INTEGER NOT NULL,
    expected_at TEXT NOT NULL,
    frequency TEXT NOT NULL,
    status TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS liquidity_simulations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    account_id TEXT NOT NULL,
    trace_id TEXT NOT NULL,
    result_json TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS transfer_splits (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    total_amount_minor INTEGER NOT NULL,
    collectible_minor INTEGER NOT NULL,
    currency TEXT NOT NULL,
    participants_json TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS ledger_entries (
    id TEXT PRIMARY KEY,
    account_id TEXT NOT NULL,
    direction TEXT NOT NULL,
    amount_minor INTEGER NOT NULL,
    category TEXT NOT NULL DEFAULT 'other',
    description TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS actions (
    id TEXT PRIMARY KEY,
    trace_id TEXT NOT NULL DEFAULT '',
    run_id TEXT NOT NULL DEFAULT '',
    conversation_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    risk_level TEXT NOT NULL,
    status TEXT NOT NULL,
    snapshot_json TEXT NOT NULL,
    snapshot_hash TEXT NOT NULL DEFAULT '',
    result_json TEXT NOT NULL DEFAULT '',
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    mfa_attempts INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    trace_id TEXT NOT NULL,
    run_id TEXT NOT NULL DEFAULT '',
    conversation_id TEXT,
    action_id TEXT,
    event_type TEXT NOT NULL,
    outcome TEXT NOT NULL,
    actor TEXT NOT NULL,
    policy_version TEXT NOT NULL DEFAULT '',
    detail_json TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    sequence INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS workflows (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    purpose TEXT NOT NULL,
    deadline TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS workflow_nodes (
    workflow_id TEXT NOT NULL,
    node_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    depends_on_json TEXT NOT NULL,
    status TEXT NOT NULL,
    action_id TEXT NOT NULL DEFAULT '',
    amount_minor INTEGER NOT NULL DEFAULT 0,
    merchant TEXT NOT NULL DEFAULT '',
    due_at TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (workflow_id, node_id),
    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_workflows_user ON workflows(user_id, created_at);
CREATE TABLE IF NOT EXISTS workflow_budget_locks (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    node_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    amount_minor INTEGER NOT NULL,
    remaining_minor INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(workflow_id, node_id),
    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS workflow_orders (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    node_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    merchant TEXT NOT NULL,
    amount_minor INTEGER NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(workflow_id, node_id),
    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS idempotency_records (
    user_id TEXT NOT NULL,
    method TEXT NOT NULL,
    path TEXT NOT NULL,
    idem_key TEXT NOT NULL,
    fingerprint TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    response_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, method, path, idem_key)
);
CREATE TABLE IF NOT EXISTS security_failures (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    occurred_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_actions_user ON actions(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_runs_user ON runs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_runs_conversation ON runs(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_conversation_messages ON conversation_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_cashflow_events_user ON cashflow_events(user_id, expected_at);
CREATE INDEX IF NOT EXISTS idx_liquidity_simulations_user ON liquidity_simulations(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_trace ON audit_events(trace_id, sequence);
CREATE INDEX IF NOT EXISTS idx_ledger_account ON ledger_entries(account_id, created_at);
CREATE INDEX IF NOT EXISTS idx_security_failures_user ON security_failures(user_id, occurred_at);
`
