package store

import (
	"database/sql"
	"fmt"

	_ "github.com/mattn/go-sqlite3"
)

func Open(path string) (*sql.DB, error) {
	db, err := sql.Open("sqlite3", path+"?_foreign_keys=on&_journal_mode=WAL")
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
	return nil
}

const schema = `
CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE,
    currency TEXT NOT NULL,
    balance_minor INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS beneficiaries (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
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
    conversation_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    risk_level TEXT NOT NULL,
    status TEXT NOT NULL,
    snapshot_json TEXT NOT NULL,
    result_json TEXT NOT NULL DEFAULT '',
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    mfa_attempts INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    trace_id TEXT NOT NULL,
    conversation_id TEXT,
    action_id TEXT,
    event_type TEXT NOT NULL,
    outcome TEXT NOT NULL,
    actor TEXT NOT NULL,
    detail_json TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    sequence INTEGER NOT NULL
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
CREATE INDEX IF NOT EXISTS idx_actions_user ON actions(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_trace ON audit_events(trace_id, sequence);
CREATE INDEX IF NOT EXISTS idx_ledger_account ON ledger_entries(account_id, created_at);
`
