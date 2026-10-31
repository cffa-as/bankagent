package tools

import (
	"context"
	"encoding/json"
	"testing"
)

func TestRegistryInjectsTrustedContextAndRejectsMissingContext(t *testing.T) {
	registry := NewRegistry()
	if err := registry.Register(Definition{
		Name:        "account.balance",
		InputSchema: map[string]any{"type": "object"},
		ReadOnly:    true,
		Handle: func(_ context.Context, call Context, _ json.RawMessage) (map[string]any, error) {
			return map[string]any{"user_id": call.UserID}, nil
		},
	}); err != nil {
		t.Fatal(err)
	}
	bad := registry.Call(context.Background(), "account.balance", Context{TraceID: "tr_1", ToolRequestID: "tool_1"}, nil)
	if bad.ErrorCode != "INVALID_CONTEXT" {
		t.Fatalf("bad receipt: %+v", bad)
	}
	good := registry.Call(context.Background(), "account.balance", Context{UserID: "user_demo", TraceID: "tr_1", ToolRequestID: "tool_1"}, json.RawMessage(`{}`))
	if good.Outcome != "succeeded" || good.Data["user_id"] != "user_demo" {
		t.Fatalf("good receipt: %+v", good)
	}
}

func TestRegistryRejectsUnknownTool(t *testing.T) {
	receipt := NewRegistry().Call(context.Background(), "unknown", Context{UserID: "user_demo", TraceID: "tr_1", ToolRequestID: "tool_1"}, nil)
	if receipt.ErrorCode != "TOOL_NOT_FOUND" {
		t.Fatalf("receipt: %+v", receipt)
	}
}
