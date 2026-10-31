package tools

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/cffa-as/bankagent/internal/domain"
)

var ErrToolNotFound = errors.New("tool not found")
var ErrToolInvalid = errors.New("invalid tool request")

type Context struct {
	UserID         string
	RunID          string
	ActionID       string
	TraceID        string
	ToolRequestID  string
	IdempotencyKey string
}

type Receipt struct {
	ToolRequestID string         `json:"tool_request_id"`
	ToolName      string         `json:"tool_name"`
	Outcome       string         `json:"outcome"`
	Data          map[string]any `json:"data,omitempty"`
	ErrorCode     string         `json:"error_code,omitempty"`
	OccurredAt    time.Time      `json:"occurred_at"`
}

type Handler func(context.Context, Context, json.RawMessage) (map[string]any, error)

type Definition struct {
	Name        string
	Description string
	InputSchema map[string]any
	ReadOnly    bool
	Handle      Handler
}

type Registry struct {
	mu    sync.RWMutex
	tools map[string]Definition
}

func NewRegistry() *Registry { return &Registry{tools: make(map[string]Definition)} }

func (r *Registry) Register(def Definition) error {
	if def.Name == "" || def.Handle == nil || def.InputSchema == nil {
		return ErrToolInvalid
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, exists := r.tools[def.Name]; exists {
		return fmt.Errorf("%w: duplicate %s", ErrToolInvalid, def.Name)
	}
	r.tools[def.Name] = def
	return nil
}

func (r *Registry) List() []Definition {
	r.mu.RLock()
	defer r.mu.RUnlock()
	result := make([]Definition, 0, len(r.tools))
	for _, def := range r.tools {
		result = append(result, def)
	}
	sort.Slice(result, func(i, j int) bool { return result[i].Name < result[j].Name })
	return result
}

func (r *Registry) Call(ctx context.Context, name string, callContext Context, args json.RawMessage) Receipt {
	r.mu.RLock()
	def, ok := r.tools[name]
	r.mu.RUnlock()
	if !ok {
		return Receipt{ToolRequestID: callContext.ToolRequestID, ToolName: name, Outcome: "failed", ErrorCode: "TOOL_NOT_FOUND", OccurredAt: time.Now()}
	}
	if callContext.UserID == "" || callContext.TraceID == "" || callContext.ToolRequestID == "" {
		return Receipt{ToolRequestID: callContext.ToolRequestID, ToolName: name, Outcome: "failed", ErrorCode: "INVALID_CONTEXT", OccurredAt: time.Now()}
	}
	if len(args) == 0 {
		args = json.RawMessage("{}")
	}
	var object map[string]any
	if json.Unmarshal(args, &object) != nil || object == nil {
		return Receipt{ToolRequestID: callContext.ToolRequestID, ToolName: name, Outcome: "failed", ErrorCode: "INVALID_ARGUMENT", OccurredAt: time.Now()}
	}
	data, err := def.Handle(ctx, callContext, args)
	receipt := Receipt{ToolRequestID: callContext.ToolRequestID, ToolName: name, OccurredAt: time.Now()}
	if err != nil {
		receipt.Outcome = "failed"
		receipt.ErrorCode = toolErrorCode(err)
		return receipt
	}
	receipt.Outcome, receipt.Data = "succeeded", data
	return receipt
}

func toolErrorCode(err error) string {
	if errors.Is(err, domain.ErrForbidden) {
		return "FORBIDDEN"
	}
	if errors.Is(err, domain.ErrInvalidArgument) {
		return "INVALID_ARGUMENT"
	}
	return "TOOL_FAILED"
}
