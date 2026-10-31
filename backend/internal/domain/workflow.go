package domain

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"
)

type WorkflowNode struct {
	ID          string    `json:"node_id"`
	Kind        string    `json:"kind"`
	DependsOn   []string  `json:"depends_on,omitempty"`
	Status      string    `json:"status"`
	ActionID    string    `json:"action_id,omitempty"`
	AmountMinor int64     `json:"amount_minor,omitempty"`
	Merchant    string    `json:"merchant,omitempty"`
	DueAt       time.Time `json:"due_at"`
}

type Workflow struct {
	ID        string         `json:"workflow_id"`
	UserID    string         `json:"-"`
	Purpose   string         `json:"purpose"`
	Deadline  time.Time      `json:"deadline"`
	Status    string         `json:"status"`
	Nodes     []WorkflowNode `json:"nodes"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
}

type WorkflowNodeInput struct {
	ID          string    `json:"node_id"`
	Kind        string    `json:"kind"`
	DependsOn   []string  `json:"depends_on"`
	AmountMinor int64     `json:"amount_minor"`
	Merchant    string    `json:"merchant"`
	DueAt       time.Time `json:"due_at"`
}

func (s *Service) CreateWorkflow(ctx context.Context, userID, purpose string, deadline time.Time, inputs []WorkflowNodeInput) (Workflow, string, error) {
	purpose = strings.TrimSpace(purpose)
	now := s.now()
	if purpose == "" || len([]rune(purpose)) > 200 || len(inputs) == 0 || len(inputs) > 10 || !deadline.After(now) || deadline.After(now.AddDate(1, 0, 0)) {
		return Workflow{}, "", ErrInvalidArgument
	}
	seen := make(map[string]bool, len(inputs))
	indegree := make(map[string]int, len(inputs))
	graph := make(map[string][]string, len(inputs))
	for i := range inputs {
		node := &inputs[i]
		node.ID, node.Kind = strings.TrimSpace(node.ID), strings.TrimSpace(node.Kind)
		node.Merchant = strings.TrimSpace(node.Merchant)
		if node.ID == "" || len([]rune(node.ID)) > 64 || seen[node.ID] || !validWorkflowKind(node.Kind) || node.AmountMinor < 0 || len(node.DependsOn) > 10 {
			return Workflow{}, "", ErrInvalidArgument
		}
		if !node.DueAt.IsZero() && node.DueAt.After(deadline) {
			return Workflow{}, "", ErrInvalidArgument
		}
		if node.Kind != "reminder" && node.AmountMinor <= 0 {
			return Workflow{}, "", ErrInvalidArgument
		}
		if node.Kind == "external_order" && (strings.TrimSpace(node.Merchant) == "" || len([]rune(node.Merchant)) > 200) {
			return Workflow{}, "", ErrInvalidArgument
		}
		seen[node.ID] = true
		indegree[node.ID] = 0
	}
	for i := range inputs {
		node := &inputs[i]
		for j := range node.DependsOn {
			node.DependsOn[j] = strings.TrimSpace(node.DependsOn[j])
			dep := node.DependsOn[j]
			if !seen[dep] || dep == node.ID {
				return Workflow{}, "", ErrInvalidArgument
			}
			indegree[node.ID]++
			graph[dep] = append(graph[dep], node.ID)
		}
	}
	queue := make([]string, 0, len(inputs))
	for id, degree := range indegree {
		if degree == 0 {
			queue = append(queue, id)
		}
	}
	visited := 0
	for len(queue) > 0 {
		id := queue[0]
		queue = queue[1:]
		visited++
		for _, next := range graph[id] {
			indegree[next]--
			if indegree[next] == 0 {
				queue = append(queue, next)
			}
		}
	}
	if visited != len(inputs) {
		return Workflow{}, "", fmt.Errorf("%w: workflow cycle", ErrInvalidArgument)
	}
	workflow := Workflow{ID: NewID("wf"), UserID: userID, Purpose: purpose, Deadline: deadline, Status: "pending", CreatedAt: now, UpdatedAt: now}
	for _, input := range inputs {
		status := "pending"
		if len(input.DependsOn) == 0 {
			status = "ready"
		}
		dueAt := input.DueAt
		if dueAt.IsZero() {
			dueAt = now
		}
		workflow.Nodes = append(workflow.Nodes, WorkflowNode{ID: input.ID, Kind: input.Kind, DependsOn: input.DependsOn, Status: status, AmountMinor: input.AmountMinor, Merchant: input.Merchant, DueAt: dueAt})
	}
	if err := s.repo.CreateWorkflow(ctx, workflow); err != nil {
		return Workflow{}, "", err
	}
	trace := NewID("tr")
	if err := s.audit(ctx, trace, "", "", "workflow_created", "succeeded", "user", map[string]any{"workflow_id": workflow.ID, "node_count": len(workflow.Nodes)}, workflow.CreatedAt); err != nil {
		return Workflow{}, "", err
	}
	return workflow, trace, nil
}

func (s *Service) CreateBirthdayWorkflow(ctx context.Context, userID string, budgetMinor int64, eventAt time.Time) (Workflow, string, error) {
	if budgetMinor < 50000 || !eventAt.After(s.now().Add(48*time.Hour)) {
		return Workflow{}, "", ErrInvalidArgument
	}
	dueAt := eventAt.AddDate(0, 0, -2)
	nodes := []WorkflowNodeInput{
		{ID: "birthday_reminder", Kind: "reminder", DueAt: dueAt},
		{ID: "budget_lock", Kind: "budget_lock", DependsOn: []string{"birthday_reminder"}, AmountMinor: budgetMinor, DueAt: dueAt},
		{ID: "flowers", Kind: "external_order", DependsOn: []string{"budget_lock"}, AmountMinor: 30000, Merchant: "演示花店", DueAt: dueAt},
		{ID: "cake", Kind: "external_order", DependsOn: []string{"budget_lock"}, AmountMinor: 20000, Merchant: "演示蛋糕店", DueAt: dueAt},
	}
	return s.CreateWorkflow(ctx, userID, "爱人生日准备", eventAt, nodes)
}

func validWorkflowKind(kind string) bool {
	return kind == "budget_lock" || kind == "reminder" || kind == "external_order"
}

func (s *Service) ListWorkflows(ctx context.Context, userID string) ([]Workflow, error) {
	return s.repo.Workflows(ctx, userID)
}

func (s *Service) GetWorkflow(ctx context.Context, userID, id string) (Workflow, error) {
	workflow, err := s.repo.Workflow(ctx, id, userID)
	if errors.Is(err, ErrNotFound) || errors.Is(err, context.Canceled) {
		return Workflow{}, err
	}
	if err != nil {
		return Workflow{}, err
	}
	return workflow, nil
}

func (s *Service) CancelWorkflow(ctx context.Context, userID, id string) (Workflow, string, error) {
	workflow, err := s.repo.Workflow(ctx, id, userID)
	if err != nil {
		return Workflow{}, "", err
	}
	if workflow.Status == "completed" || workflow.Status == "cancelled" || workflow.Status == "failed" {
		return Workflow{}, NewID("tr"), ErrActionStateConflict
	}
	if err := s.repo.CancelWorkflow(ctx, id, userID, s.now()); err != nil {
		return Workflow{}, "", err
	}
	workflow.Status = "cancelled"
	workflow.UpdatedAt = s.now()
	for i := range workflow.Nodes {
		if workflow.Nodes[i].Status == "pending" || workflow.Nodes[i].Status == "ready" || workflow.Nodes[i].Status == "awaiting_authorization" {
			workflow.Nodes[i].Status = "skipped"
		}
	}
	trace := NewID("tr")
	if err := s.audit(ctx, trace, "", "", "workflow_cancelled", "succeeded", "user", map[string]any{"workflow_id": id}, workflow.UpdatedAt); err != nil {
		return Workflow{}, "", err
	}
	return workflow, trace, nil
}

type WorkflowAdvanceResult struct {
	Workflow  Workflow             `json:"workflow"`
	Action    *Action              `json:"action,omitempty"`
	Liquidity *LiquiditySimulation `json:"liquidity,omitempty"`
}

func (s *Service) AdvanceWorkflow(ctx context.Context, userID, id string, virtualNow time.Time) (WorkflowAdvanceResult, string, error) {
	workflow, err := s.repo.Workflow(ctx, id, userID)
	if err != nil {
		return WorkflowAdvanceResult{}, "", err
	}
	if virtualNow.IsZero() {
		virtualNow = s.now()
	}
	trace := NewID("tr")
	if workflow.Status == "completed" || workflow.Status == "cancelled" || workflow.Status == "failed" {
		return WorkflowAdvanceResult{}, trace, ErrActionStateConflict
	}
	if !virtualNow.Before(workflow.Deadline) {
		if err := s.repo.ExpireWorkflow(ctx, workflow.ID, userID, virtualNow); err != nil {
			return WorkflowAdvanceResult{}, trace, err
		}
		updated, err := s.repo.Workflow(ctx, workflow.ID, userID)
		if err != nil {
			return WorkflowAdvanceResult{}, trace, err
		}
		if err := s.audit(ctx, trace, "", "", "workflow_expired", "failed", "system", map[string]any{"workflow_id": workflow.ID, "deadline": workflow.Deadline}, virtualNow); err != nil {
			return WorkflowAdvanceResult{}, trace, err
		}
		return WorkflowAdvanceResult{Workflow: updated}, trace, nil
	}
	for _, node := range workflow.Nodes {
		if node.Status == "awaiting_authorization" && node.ActionID != "" {
			action, err := s.repo.Action(ctx, node.ActionID)
			if err != nil {
				return WorkflowAdvanceResult{}, trace, err
			}
			return WorkflowAdvanceResult{Workflow: workflow, Action: ptr(action.Public())}, trace, nil
		}
	}
	var node *WorkflowNode
	for i := range workflow.Nodes {
		if workflow.Nodes[i].Status == "ready" && !workflow.Nodes[i].DueAt.After(virtualNow) {
			node = &workflow.Nodes[i]
			break
		}
	}
	if node == nil {
		return WorkflowAdvanceResult{Workflow: workflow}, trace, nil
	}
	if node.Kind == "reminder" {
		if err := s.repo.CompleteWorkflowNode(ctx, workflow.ID, node.ID, virtualNow); err != nil {
			return WorkflowAdvanceResult{}, trace, err
		}
		updated, err := s.repo.Workflow(ctx, workflow.ID, userID)
		if err != nil {
			return WorkflowAdvanceResult{}, trace, err
		}
		if err := s.audit(ctx, trace, "", "", "workflow_reminder_completed", "succeeded", "system", map[string]any{"workflow_id": workflow.ID, "node_id": node.ID, "virtual_now": virtualNow}, virtualNow); err != nil {
			return WorkflowAdvanceResult{}, trace, err
		}
		return WorkflowAdvanceResult{Workflow: updated}, trace, nil
	}

	var liquidity *LiquiditySimulation
	if node.Kind == "budget_lock" {
		account, err := s.repo.Account(ctx, userID)
		if err != nil {
			return WorkflowAdvanceResult{}, trace, err
		}
		simulationNow := s.now()
		simulation, _, err := s.createLiquiditySimulationAt(ctx, userID, account.ID, liquidityHorizonDays(simulationNow, workflow.Deadline), node.AmountMinor, nil, simulationNow)
		if err != nil {
			return WorkflowAdvanceResult{}, trace, err
		}
		liquidity = &simulation
		if simulation.Verdict == "unsafe" {
			if err := s.audit(ctx, trace, "", "", "workflow_budget_preflight_blocked", "failed", "system", map[string]any{
				"workflow_id": workflow.ID, "node_id": node.ID, "simulation_id": simulation.ID,
				"minimum_expected_minor": simulation.Scenarios[1].MinimumAvailableMinor,
			}, virtualNow); err != nil {
				return WorkflowAdvanceResult{}, trace, err
			}
			return WorkflowAdvanceResult{Workflow: workflow, Liquidity: liquidity}, trace, nil
		}
	}

	risk, status := "red", "awaiting_mfa"
	kind := "workflow_budget_lock"
	if node.Kind == "external_order" {
		kind = "workflow_external_order"
		if node.AmountMinor <= 100000 {
			risk, status = "yellow", "awaiting_confirmation"
		}
	}
	snapshot := map[string]any{
		"workflow_id": workflow.ID, "node_id": node.ID, "amount_minor": node.AmountMinor,
		"merchant": node.Merchant, "purpose": workflow.Purpose, "currency": "CNY", "due_at": node.DueAt,
	}
	action, err := s.createWorkflowActionRecord(ctx, workflow.UserID, kind, risk, status, snapshot)
	if err != nil {
		return WorkflowAdvanceResult{}, trace, err
	}
	if err := s.repo.SetWorkflowNodeAction(ctx, workflow.ID, node.ID, action.ID, "awaiting_authorization", virtualNow); err != nil {
		return WorkflowAdvanceResult{}, trace, err
	}
	updated, err := s.repo.Workflow(ctx, workflow.ID, userID)
	if err != nil {
		return WorkflowAdvanceResult{}, trace, err
	}
	return WorkflowAdvanceResult{Workflow: updated, Action: ptr(action.Public()), Liquidity: liquidity}, trace, nil
}

func (s *Service) createWorkflowActionRecord(ctx context.Context, userID, kind, risk, status string, snapshot map[string]any) (Action, error) {
	now := s.now()
	trace := NewID("tr")
	encoded, err := json.Marshal(snapshot)
	if err != nil {
		return Action{}, err
	}
	action := Action{ID: NewID("act"), TraceID: trace, UserID: userID, Kind: kind, RiskLevel: risk, Status: status, SnapshotJSON: string(encoded), Snapshot: snapshot, SnapshotHash: snapshotHash(string(encoded)), ExpiresAt: now.Add(5 * time.Minute), CreatedAt: now, UpdatedAt: now}
	if err := s.repo.CreateAction(ctx, action); err != nil {
		return Action{}, err
	}
	return action, nil
}

func (s *Service) cancelWorkflowAction(ctx context.Context, action *Action, now time.Time) error {
	var snapshot struct {
		WorkflowID string `json:"workflow_id"`
		NodeID     string `json:"node_id"`
	}
	if err := json.Unmarshal([]byte(action.SnapshotJSON), &snapshot); err != nil || snapshot.WorkflowID == "" || snapshot.NodeID == "" {
		return nil
	}
	return s.repo.CancelWorkflowNode(ctx, snapshot.WorkflowID, snapshot.NodeID, now)
}

func (s *Service) failWorkflowAction(ctx context.Context, action *Action, now time.Time) error {
	var snapshot struct {
		WorkflowID string `json:"workflow_id"`
		NodeID     string `json:"node_id"`
	}
	if err := json.Unmarshal([]byte(action.SnapshotJSON), &snapshot); err != nil || snapshot.WorkflowID == "" || snapshot.NodeID == "" || action.Status != "failed" {
		return nil
	}
	return s.repo.FailWorkflowNode(ctx, snapshot.WorkflowID, snapshot.NodeID, now)
}

func (s *Service) finishWorkflowAction(ctx context.Context, action *Action, now time.Time) error {
	var snapshot struct {
		WorkflowID string `json:"workflow_id"`
		NodeID     string `json:"node_id"`
	}
	if err := json.Unmarshal([]byte(action.SnapshotJSON), &snapshot); err != nil || snapshot.WorkflowID == "" || snapshot.NodeID == "" || action.Status != "succeeded" {
		return nil
	}
	if err := s.repo.CompleteWorkflowNode(ctx, snapshot.WorkflowID, snapshot.NodeID, now); err != nil {
		return err
	}
	return nil
}
