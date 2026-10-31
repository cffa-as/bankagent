package agent

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

var ErrModelUnavailable = errors.New("model unavailable")
var ErrInvalidPlan = errors.New("invalid model plan")

type IntentPlan struct {
	Intent        string         `json:"intent"`
	Entities      map[string]any `json:"entities"`
	MissingFields []string       `json:"missing_fields"`
	CandidatePlan []PlanStep     `json:"candidate_plan"`
}

type PlanStep struct {
	Kind   string `json:"kind"`
	Reason string `json:"reason,omitempty"`
}

type ModelClient interface {
	Plan(context.Context, string, []string) (IntentPlan, error)
}

type OpenAICompatibleClient struct {
	BaseURL string
	APIKey  string
	Model   string
	HTTP    *http.Client
}

func NewOpenAICompatibleClient(baseURL, apiKey, model string) *OpenAICompatibleClient {
	return &OpenAICompatibleClient{BaseURL: strings.TrimRight(baseURL, "/"), APIKey: apiKey, Model: model, HTTP: &http.Client{Timeout: 15 * time.Second}}
}

func (c *OpenAICompatibleClient) Configured() bool {
	return c != nil && c.BaseURL != "" && c.APIKey != "" && c.Model != ""
}

func (c *OpenAICompatibleClient) Plan(ctx context.Context, text string, history []string) (IntentPlan, error) {
	if !c.Configured() {
		return IntentPlan{}, ErrModelUnavailable
	}
	messages := []map[string]string{
		{"role": "system", "content": "你是银行业务意图解析器。只输出 JSON，不执行任何操作，不返回账户结果。intent 只能是 balance_query、transaction_query、bill_query、investment_query、investment_purchase、investment_redemption、card_query、card_status_change、subscription_query、subscription_cancel、transfer、scheduled_transfer、transfer_split、birthday_plan 或 unknown。entities 只填写用户明确提供的业务字段，金额使用最小货币单位整数；生日场景使用 budget_minor 和 RFC3339 的 event_at。不填写 user_id、授权、风险等级、动作状态或执行结果。candidate_plan 只能描述候选步骤。"},
	}
	for _, item := range history {
		messages = append(messages, map[string]string{"role": "user", "content": item})
	}
	messages = append(messages, map[string]string{"role": "user", "content": text})
	request := map[string]any{
		"model":           c.Model,
		"temperature":     0,
		"response_format": map[string]string{"type": "json_object"},
		"messages":        messages,
	}
	body, err := json.Marshal(request)
	if err != nil {
		return IntentPlan{}, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.BaseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return IntentPlan{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.APIKey)
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return IntentPlan{}, fmt.Errorf("%w: %v", ErrModelUnavailable, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 4096))
		return IntentPlan{}, fmt.Errorf("%w: status %d", ErrModelUnavailable, resp.StatusCode)
	}
	var completion struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&completion); err != nil {
		return IntentPlan{}, err
	}
	if len(completion.Choices) != 1 {
		return IntentPlan{}, ErrInvalidPlan
	}
	var plan IntentPlan
	if err := json.Unmarshal([]byte(completion.Choices[0].Message.Content), &plan); err != nil {
		return IntentPlan{}, fmt.Errorf("%w: %v", ErrInvalidPlan, err)
	}
	if err := ValidatePlan(plan); err != nil {
		return IntentPlan{}, err
	}
	return plan, nil
}

func ValidatePlan(plan IntentPlan) error {
	allowed := map[string]bool{
		"balance_query": true, "transaction_query": true, "bill_query": true, "investment_query": true,
		"investment_purchase": true, "investment_redemption": true, "card_query": true, "card_status_change": true,
		"subscription_query": true, "subscription_cancel": true, "transfer": true, "unknown": true,
		"scheduled_transfer": true, "transfer_split": true, "birthday_plan": true,
	}
	if !allowed[plan.Intent] || len(plan.CandidatePlan) > 8 || len(plan.MissingFields) > 16 {
		return ErrInvalidPlan
	}
	for _, step := range plan.CandidatePlan {
		if step.Kind == "" || len(step.Kind) > 64 || len(step.Reason) > 200 {
			return ErrInvalidPlan
		}
	}
	return nil
}
