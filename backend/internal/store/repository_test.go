package store

import (
	"context"
	"errors"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/cffa-as/bankagent/internal/domain"
)

func TestCreateWorkflowActionClaimsNodeAtomically(t *testing.T) {
	db, err := Open(filepath.Join(t.TempDir(), "bankagent.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	repo := NewRepository(db)
	now := time.Now()
	workflow := domain.Workflow{
		ID: "wf_race", UserID: domain.DemoUserID, Purpose: "race", Deadline: now.Add(time.Hour),
		Status: "pending", CreatedAt: now, UpdatedAt: now,
		Nodes: []domain.WorkflowNode{{ID: "lock", Kind: "budget_lock", Status: "ready", AmountMinor: 10000, DueAt: now}},
	}
	audit := domain.AuditEvent{
		ID: "evt_workflow_create", TraceID: "tr_workflow_create", EventType: "workflow_created",
		Outcome: "succeeded", Actor: "user", PolicyVersion: "test", Detail: map[string]any{"workflow_id": workflow.ID},
		OccurredAt: now,
	}
	if err := repo.CreateWorkflow(context.Background(), workflow, audit); err != nil {
		t.Fatal(err)
	}
	makeAction := func(id, trace string) domain.Action {
		return domain.Action{
			ID: id, TraceID: trace, UserID: domain.DemoUserID, Kind: "workflow_budget_lock",
			RiskLevel: "red", Status: "awaiting_mfa", SnapshotJSON: `{"workflow_id":"wf_race","node_id":"lock","amount_minor":10000}`,
			SnapshotHash: strings.Repeat("a", 64), ExpiresAt: now.Add(5 * time.Minute), CreatedAt: now, UpdatedAt: now,
		}
	}
	start := make(chan struct{})
	results := make(chan error, 2)
	var wait sync.WaitGroup
	for _, action := range []domain.Action{makeAction("act_race_1", "tr_race_1"), makeAction("act_race_2", "tr_race_2")} {
		wait.Add(1)
		go func(action domain.Action) {
			defer wait.Done()
			<-start
			results <- repo.CreateWorkflowAction(context.Background(), action, workflow.ID, "lock", "awaiting_authorization", now)
		}(action)
	}
	close(start)
	wait.Wait()
	close(results)
	successes, conflicts := 0, 0
	for err := range results {
		switch {
		case err == nil:
			successes++
		case errors.Is(err, domain.ErrActionStateConflict):
			conflicts++
		default:
			t.Fatalf("unexpected error: %v", err)
		}
	}
	if successes != 1 || conflicts != 1 {
		t.Fatalf("successes=%d conflicts=%d", successes, conflicts)
	}
	var actionCount int
	if err := db.QueryRow(`SELECT COUNT(*) FROM actions`).Scan(&actionCount); err != nil {
		t.Fatal(err)
	}
	if actionCount != 1 {
		t.Fatalf("orphan actions=%d", actionCount)
	}
}
