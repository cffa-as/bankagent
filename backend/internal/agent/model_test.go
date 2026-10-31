package agent

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestOpenAICompatibleClientValidatesStructuredPlan(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer secret" {
			t.Errorf("missing auth")
			return
		}
		var request struct {
			Messages []struct {
				Role string `json:"role"`
			} `json:"messages"`
		}
		if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
			t.Errorf("decode request: %v", err)
			return
		}
		if len(request.Messages) != 3 || request.Messages[0].Role != "system" || request.Messages[1].Role != "user" {
			t.Errorf("unexpected model context: %+v", request.Messages)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"{\"intent\":\"investment_redemption\",\"entities\":{},\"missing_fields\":[],\"candidate_plan\":[{\"kind\":\"load_holding\"}]}"}}]}`))
	}))
	defer server.Close()
	client := NewOpenAICompatibleClient(server.URL, "secret", "demo")
	plan, err := client.Plan(context.Background(), "赎回我的理财", []string{"我想赎回"})
	if err != nil {
		t.Fatal(err)
	}
	if plan.Intent != "investment_redemption" || len(plan.CandidatePlan) != 1 {
		t.Fatalf("unexpected plan: %+v", plan)
	}
}

func TestValidatePlanRejectsUnknownIntent(t *testing.T) {
	if err := ValidatePlan(IntentPlan{Intent: "delete_account"}); err != ErrInvalidPlan {
		t.Fatalf("error=%v", err)
	}
}
