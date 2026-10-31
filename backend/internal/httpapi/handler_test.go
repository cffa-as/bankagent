package httpapi_test

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/cffa-as/bankagent/internal/app"
)

type envelope struct {
	Data    json.RawMessage `json:"data"`
	TraceID string          `json:"trace_id"`
}

type conversation struct {
	ID string `json:"conversation_id"`
}

type messageResult struct {
	ReplyType string `json:"reply_type"`
	Action    struct {
		ID   string `json:"action_id"`
		Risk string `json:"risk_level"`
	} `json:"action"`
}

type action struct {
	Status string `json:"status"`
}

func newServer(t *testing.T) (*httptest.Server, func()) {
	t.Helper()
	application, err := app.New(app.Config{Database: filepath.Join(t.TempDir(), "bankagent.db")})
	if err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(application.Handler())
	return server, func() { server.Close(); _ = application.Close() }
}

func request(t *testing.T, client *http.Client, method, url, body, idem string) (*http.Response, []byte) {
	t.Helper()
	req, err := http.NewRequest(method, url, bytes.NewBufferString(body))
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Authorization", "Bearer demo-user-1")
	req.Header.Set("Content-Type", "application/json")
	if idem != "" {
		req.Header.Set("Idempotency-Key", idem)
	}
	resp, err := client.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	data, err := io.ReadAll(resp.Body)
	_ = resp.Body.Close()
	if err != nil {
		t.Fatal(err)
	}
	return resp, data
}

func createConversation(t *testing.T, serverURL string) string {
	t.Helper()
	resp, body := request(t, http.DefaultClient, http.MethodPost, serverURL+"/v1/conversations", "{}", "conversation-1")
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create conversation: status=%d body=%s", resp.StatusCode, body)
	}
	var result envelope
	var value conversation
	if err := json.Unmarshal(body, &result); err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(result.Data, &value); err != nil {
		t.Fatal(err)
	}
	return value.ID
}

func sendMessage(t *testing.T, serverURL, conversationID, text, idem string) (int, messageResult, []byte) {
	t.Helper()
	resp, body := request(t, http.DefaultClient, http.MethodPost, serverURL+"/v1/conversations/"+conversationID+"/messages", `{"text":"`+text+`"}`, idem)
	var result envelope
	var value messageResult
	if err := json.Unmarshal(body, &result); err == nil {
		_ = json.Unmarshal(result.Data, &value)
	}
	return resp.StatusCode, value, body
}

func TestYellowTransferAndIdempotency(t *testing.T) {
	server, cleanup := newServer(t)
	defer cleanup()
	conversationID := createConversation(t, server.URL)

	status, result, body := sendMessage(t, server.URL, conversationID, "给张三转300元，备注房租", "message-1")
	if status != http.StatusOK || result.ReplyType != "action_required" || result.Action.Risk != "yellow" {
		t.Fatalf("message: status=%d result=%+v body=%s", status, result, body)
	}
	confirmBody := `{}`
	resp, body := request(t, http.DefaultClient, http.MethodPost, server.URL+"/v1/actions/"+result.Action.ID+"/confirm", confirmBody, "confirm-1")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("confirm: status=%d body=%s", resp.StatusCode, body)
	}
	var first envelope
	if err := json.Unmarshal(body, &first); err != nil {
		t.Fatal(err)
	}
	var firstAction action
	if err := json.Unmarshal(first.Data, &firstAction); err != nil {
		t.Fatal(err)
	}
	if firstAction.Status != "succeeded" {
		t.Fatalf("status=%s", firstAction.Status)
	}

	resp, secondBody := request(t, http.DefaultClient, http.MethodPost, server.URL+"/v1/actions/"+result.Action.ID+"/confirm", confirmBody, "confirm-1")
	if resp.StatusCode != http.StatusOK || !bytes.Equal(bytes.TrimSpace(secondBody), bytes.TrimSpace(body)) {
		t.Fatalf("idempotent replay: status=%d first=%s second=%s", resp.StatusCode, body, secondBody)
	}
}

func TestBillSummaryQuery(t *testing.T) {
	server, cleanup := newServer(t)
	defer cleanup()
	month := time.Now().Format("2006-01")
	resp, body := request(t, http.DefaultClient, http.MethodGet, server.URL+"/v1/accounts/acct_demo/bills/summary?month="+month, "", "")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("bill summary: status=%d body=%s", resp.StatusCode, body)
	}
	var result envelope
	if err := json.Unmarshal(body, &result); err != nil {
		t.Fatal(err)
	}
	var value struct {
		TotalMinor       int64 `json:"total_minor"`
		TransactionCount int64 `json:"transaction_count"`
		Categories       []any `json:"categories"`
	}
	if err := json.Unmarshal(result.Data, &value); err != nil {
		t.Fatal(err)
	}
	if value.TotalMinor != 31500 || value.TransactionCount != 4 || len(value.Categories) != 4 {
		t.Fatalf("unexpected summary: %+v", value)
	}
}

func TestCardsAndSubscriptionsQuery(t *testing.T) {
	server, cleanup := newServer(t)
	defer cleanup()

	resp, body := request(t, http.DefaultClient, http.MethodGet, server.URL+"/v1/cards", "", "")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("cards: status=%d body=%s", resp.StatusCode, body)
	}
	var result envelope
	if err := json.Unmarshal(body, &result); err != nil {
		t.Fatal(err)
	}
	var cards []struct {
		ID           string   `json:"card_id"`
		Status       string   `json:"status"`
		Restrictions []string `json:"restrictions"`
	}
	if err := json.Unmarshal(result.Data, &cards); err != nil {
		t.Fatal(err)
	}
	if len(cards) != 1 || cards[0].ID != "card_demo" || cards[0].Status != "active" || len(cards[0].Restrictions) != 2 {
		t.Fatalf("unexpected cards: %+v", cards)
	}

	resp, body = request(t, http.DefaultClient, http.MethodGet, server.URL+"/v1/subscriptions?status=active", "", "")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("subscriptions: status=%d body=%s", resp.StatusCode, body)
	}
	if err := json.Unmarshal(body, &result); err != nil {
		t.Fatal(err)
	}
	var subscriptions []struct {
		ID     string `json:"subscription_id"`
		Status string `json:"status"`
	}
	if err := json.Unmarshal(result.Data, &subscriptions); err != nil {
		t.Fatal(err)
	}
	if len(subscriptions) != 1 || subscriptions[0].ID != "sub_streaming" || subscriptions[0].Status != "active" {
		t.Fatalf("unexpected subscriptions: %+v", subscriptions)
	}

	resp, body = request(t, http.DefaultClient, http.MethodGet, server.URL+"/v1/subscriptions?status=unknown", "", "")
	if resp.StatusCode != http.StatusBadRequest || !bytes.Contains(body, []byte("INVALID_ARGUMENT")) {
		t.Fatalf("invalid subscription status: status=%d body=%s", resp.StatusCode, body)
	}
}

func TestInvestmentProductsQuery(t *testing.T) {
	server, cleanup := newServer(t)
	defer cleanup()

	resp, body := request(t, http.DefaultClient, http.MethodGet, server.URL+"/v1/investments/products?risk_level=balanced", "", "")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("products: status=%d body=%s", resp.StatusCode, body)
	}
	var result envelope
	if err := json.Unmarshal(body, &result); err != nil {
		t.Fatal(err)
	}
	var page struct {
		Items []struct {
			ID        string `json:"product_id"`
			RiskLevel string `json:"risk_level"`
		} `json:"items"`
		Total int `json:"total"`
	}
	if err := json.Unmarshal(result.Data, &page); err != nil {
		t.Fatal(err)
	}
	if page.Total != 1 || len(page.Items) != 1 || page.Items[0].ID != "product_balanced" || page.Items[0].RiskLevel != "balanced" {
		t.Fatalf("unexpected products: %+v", page)
	}

	resp, body = request(t, http.DefaultClient, http.MethodGet, server.URL+"/v1/investments/products?risk_level=unknown", "", "")
	if resp.StatusCode != http.StatusBadRequest || !bytes.Contains(body, []byte("INVALID_ARGUMENT")) {
		t.Fatalf("invalid risk level: status=%d body=%s", resp.StatusCode, body)
	}
}

func TestAccountBalanceAndTransactions(t *testing.T) {
	server, cleanup := newServer(t)
	defer cleanup()

	resp, body := request(t, http.DefaultClient, http.MethodGet, server.URL+"/v1/accounts/acct_demo/balance", "", "")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("balance: status=%d body=%s", resp.StatusCode, body)
	}
	var balanceResult envelope
	if err := json.Unmarshal(body, &balanceResult); err != nil {
		t.Fatal(err)
	}
	var balance struct {
		AccountID    string `json:"account_id"`
		BalanceMinor int64  `json:"balance_minor"`
	}
	if err := json.Unmarshal(balanceResult.Data, &balance); err != nil {
		t.Fatal(err)
	}
	if balance.AccountID != "acct_demo" || balance.BalanceMinor != 1000000 || balanceResult.TraceID == "" {
		t.Fatalf("unexpected balance: %+v trace=%q", balance, balanceResult.TraceID)
	}

	resp, body = request(t, http.DefaultClient, http.MethodGet, server.URL+"/v1/accounts/acct_demo/transactions?page=2&page_size=2", "", "")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("transactions: status=%d body=%s", resp.StatusCode, body)
	}
	var transactionsResult envelope
	if err := json.Unmarshal(body, &transactionsResult); err != nil {
		t.Fatal(err)
	}
	var page struct {
		Items    []any `json:"items"`
		Page     int   `json:"page"`
		PageSize int   `json:"page_size"`
		Total    int   `json:"total"`
	}
	if err := json.Unmarshal(transactionsResult.Data, &page); err != nil {
		t.Fatal(err)
	}
	if page.Page != 2 || page.PageSize != 2 || page.Total != 4 || len(page.Items) != 2 {
		t.Fatalf("unexpected page: %+v", page)
	}

	resp, body = request(t, http.DefaultClient, http.MethodGet, server.URL+"/v1/accounts/acct_demo/transactions?category=food&page_size=100", "", "")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("category filter: status=%d body=%s", resp.StatusCode, body)
	}
	if err := json.Unmarshal(body, &transactionsResult); err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(transactionsResult.Data, &page); err != nil {
		t.Fatal(err)
	}
	if page.Total != 1 || len(page.Items) != 1 {
		t.Fatalf("unexpected category page: %+v", page)
	}
}

func TestTransactionQueryValidationAndAccountOwnership(t *testing.T) {
	server, cleanup := newServer(t)
	defer cleanup()

	resp, body := request(t, http.DefaultClient, http.MethodGet, server.URL+"/v1/accounts/acct_demo/transactions?page=0", "", "")
	if resp.StatusCode != http.StatusBadRequest || !bytes.Contains(body, []byte("INVALID_ARGUMENT")) {
		t.Fatalf("invalid page: status=%d body=%s", resp.StatusCode, body)
	}
	resp, body = request(t, http.DefaultClient, http.MethodGet, server.URL+"/v1/accounts/other/transactions", "", "")
	if resp.StatusCode != http.StatusForbidden || !bytes.Contains(body, []byte("PERMISSION_DENIED")) {
		t.Fatalf("other account: status=%d body=%s", resp.StatusCode, body)
	}
}

func BenchmarkBillSummaryHTTP(b *testing.B) {
	application, err := app.New(app.Config{Database: filepath.Join(b.TempDir(), "bankagent.db")})
	if err != nil {
		b.Fatal(err)
	}
	server := httptest.NewServer(application.Handler())
	defer server.Close()
	month := time.Now().Format("2006-01")
	client := server.Client()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		req, err := http.NewRequest(http.MethodGet, server.URL+"/v1/accounts/acct_demo/bills/summary?month="+month, nil)
		if err != nil {
			b.Fatal(err)
		}
		req.Header.Set("Authorization", "Bearer demo-user-1")
		resp, err := client.Do(req)
		if err != nil {
			b.Fatal(err)
		}
		_, _ = io.Copy(io.Discard, resp.Body)
		_ = resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			b.Fatalf("status=%d", resp.StatusCode)
		}
	}
}

func TestRedTransferRequiresMFAAndLocksAfterThreeFailures(t *testing.T) {
	server, cleanup := newServer(t)
	defer cleanup()
	conversationID := createConversation(t, server.URL)
	status, result, body := sendMessage(t, server.URL, conversationID, "给张三转1001元", "message-red")
	if status != http.StatusOK || result.Action.Risk != "red" {
		t.Fatalf("message: status=%d result=%+v body=%s", status, result, body)
	}
	path := server.URL + "/v1/actions/" + result.Action.ID + "/mfa/verify"
	for i, want := range []int{http.StatusUnprocessableEntity, http.StatusUnprocessableEntity, http.StatusLocked} {
		resp, body := request(t, http.DefaultClient, http.MethodPost, path, `{"code":"123456"}`, "mfa-fail-"+string(rune('a'+i)))
		if resp.StatusCode != want {
			t.Fatalf("attempt %d: status=%d want=%d body=%s", i+1, resp.StatusCode, want, body)
		}
	}
}

func TestCardStatusActionAndSubscriptionCancellation(t *testing.T) {
	server, cleanup := newServer(t)
	defer cleanup()
	conversationID := createConversation(t, server.URL)

	status, result, body := sendMessage(t, server.URL, conversationID, "冻结我的卡", "card-message")
	if status != http.StatusOK || result.ReplyType != "action_required" || result.Action.Risk != "yellow" {
		t.Fatalf("card message: status=%d result=%+v body=%s", status, result, body)
	}
	resp, body := request(t, http.DefaultClient, http.MethodPost, server.URL+"/v1/actions/"+result.Action.ID+"/confirm", `{}`, "card-confirm")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("card confirm: status=%d body=%s", resp.StatusCode, body)
	}
	resp, body = request(t, http.DefaultClient, http.MethodGet, server.URL+"/v1/cards", "", "")
	if resp.StatusCode != http.StatusOK || !bytes.Contains(body, []byte(`"status":"frozen"`)) {
		t.Fatalf("cards: status=%d body=%s", resp.StatusCode, body)
	}

	status, result, body = sendMessage(t, server.URL, conversationID, "取消我的流媒体订阅", "sub-message")
	if status != http.StatusOK || result.ReplyType != "action_required" || result.Action.Risk != "yellow" {
		t.Fatalf("subscription message: status=%d result=%+v body=%s", status, result, body)
	}
	resp, body = request(t, http.DefaultClient, http.MethodPost, server.URL+"/v1/actions/"+result.Action.ID+"/confirm", `{}`, "sub-confirm")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("subscription confirm: status=%d body=%s", resp.StatusCode, body)
	}
	resp, body = request(t, http.DefaultClient, http.MethodGet, server.URL+"/v1/subscriptions?status=cancelled", "", "")
	if resp.StatusCode != http.StatusOK || !bytes.Contains(body, []byte(`"subscription_id":"sub_streaming"`)) {
		t.Fatalf("subscriptions: status=%d body=%s", resp.StatusCode, body)
	}
}
