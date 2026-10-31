package store

import (
	"database/sql"
	"path/filepath"
	"testing"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

func TestOpenBackfillsLegacyActionEvidence(t *testing.T) {
	path := filepath.Join(t.TempDir(), "legacy.db")
	legacy, err := sql.Open("sqlite3", path)
	if err != nil {
		t.Fatal(err)
	}
	_, err = legacy.Exec(`
CREATE TABLE actions (
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
INSERT INTO actions(id,conversation_id,user_id,kind,risk_level,status,snapshot_json,result_json,expires_at,created_at,updated_at,mfa_attempts)
VALUES('act_legacy','conv_legacy','user_demo','transfer','yellow','awaiting_confirmation','{"amount_minor":10000}','',?,?,?,0);`,
		time.Now().Add(time.Minute).Format(time.RFC3339Nano),
		time.Now().Format(time.RFC3339Nano),
		time.Now().Format(time.RFC3339Nano),
	)
	if err != nil {
		legacy.Close()
		t.Fatal(err)
	}
	_ = legacy.Close()

	db, err := Open(path)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	var traceID, snapshotHash string
	if err := db.QueryRow(`SELECT trace_id,snapshot_hash FROM actions WHERE id='act_legacy'`).Scan(&traceID, &snapshotHash); err != nil {
		t.Fatal(err)
	}
	if traceID == "" || snapshotHash == "" {
		t.Fatalf("missing evidence: trace=%q hash=%q", traceID, snapshotHash)
	}
}
