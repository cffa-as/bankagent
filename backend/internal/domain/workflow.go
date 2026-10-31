package domain

import (
	"context"
	"errors"
	"fmt"
	"time"
)

type WorkflowNode struct {
	ID          string   `json:"node_id"`
	Kind        string   `json:"kind"`
	DependsOn   []string `json:"depends_on,omitempty"`
	Status      string   `json:"status"`
	ActionID    string   `json:"action_id,omitempty"`
	AmountMinor int64    `json:"amount_minor,omitempty"`
	Merchant    string   `json:"merchant,omitempty"`
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
	ID          string   `json:"node_id"`
	Kind        string   `json:"kind"`
	DependsOn   []string `json:"depends_on"`
	AmountMinor int64    `json:"amount_minor"`
	Merchant    string   `json:"merchant"`
}

func (s *Service) CreateWorkflow(ctx context.Context, userID, purpose string, deadline time.Time, inputs []WorkflowNodeInput) (Workflow, string, error) {
	if purpose == "" || len(inputs) == 0 || len(inputs) > 10 || !deadline.After(s.now()) {
		return Workflow{}, "", ErrInvalidArgument
	}
	seen := make(map[string]bool, len(inputs))
	indegree := make(map[string]int, len(inputs))
	graph := make(map[string][]string, len(inputs))
	for _, node := range inputs {
		if node.ID == "" || seen[node.ID] || !validWorkflowKind(node.Kind) || node.AmountMinor < 0 {
			return Workflow{}, "", ErrInvalidArgument
		}
		seen[node.ID] = true
		indegree[node.ID] = 0
	}
	for _, node := range inputs {
		for _, dep := range node.DependsOn {
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
	workflow := Workflow{ID: NewID("wf"), UserID: userID, Purpose: purpose, Deadline: deadline, Status: "pending", CreatedAt: s.now(), UpdatedAt: s.now()}
	for _, input := range inputs {
		status := "pending"
		if len(input.DependsOn) == 0 {
			status = "ready"
		}
		workflow.Nodes = append(workflow.Nodes, WorkflowNode{ID: input.ID, Kind: input.Kind, DependsOn: input.DependsOn, Status: status, AmountMinor: input.AmountMinor, Merchant: input.Merchant})
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
