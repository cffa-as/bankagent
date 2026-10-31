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

func TestDirectInvestmentPurchaseIsIdempotentAndRequiresRiskAcknowledgement(t *testing.T) {
	server, cleanup := newServer(t)
	defer cleanup()
	conversationID := createConversation(t, server.URL)
	path := server.URL + "/v1/investments/products/product_conservative/subscriptions"
	body := `{"conversation_id":"` + conversationID + `","amount_minor":10000,"risk_acknowledged":true}`
	resp, first := request(t, http.DefaultClient, http.MethodPost, path, body, "direct-purchase-1")
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("direct purchase: status=%d body=%s", resp.StatusCode, first)
	}
	resp, replay := request(t, http.DefaultClient, http.MethodPost, path, body, "direct-purchase-1")
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("direct purchase replay: status=%d body=%s", resp.StatusCode, replay)
	}
	var firstEnvelope, replayEnvelope envelope
	if err := json.Unmarshal(first, &firstEnvelope); err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(replay, &replayEnvelope); err != nil {
		t.Fatal(err)
	}
	var firstAction, replayAction struct {
		ID string `json:"action_id"`
	}
	if err := json.Unmarshal(firstEnvelope.Data, &firstAction); err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(replayEnvelope.Data, &replayAction); err != nil {
		t.Fatal(err)
	}
	if firstAction.ID == "" || firstAction.ID != replayAction.ID {
		t.Fatalf("direct purchase replay returned a different action: first=%s replay=%s", firstAction.ID, replayAction.ID)
	}
	resp, conflict := request(t, http.DefaultClient, http.MethodPost, path, `{"conversation_id":"`+conversationID+`","amount_minor":12000,"risk_acknowledged":true}`, "direct-purchase-1")
	if resp.StatusCode != http.StatusConflict || !bytes.Contains(conflict, []byte(`IDEMPOTENCY_CONFLICT`)) {
		t.Fatalf("direct purchase conflict: status=%d body=%s", resp.StatusCode, conflict)
	}
	resp, missingBody := request(t, http.DefaultClient, http.MethodPost, path, `{"conversation_id":"`+conversationID+`","amount_minor":10000}`, "direct-purchase-2")
	if resp.StatusCode != http.StatusBadRequest || !bytes.Contains(missingBody, []byte(`INVALID_ARGUMENT`)) {
		t.Fatalf("risk acknowledgement: status=%d body=%s", resp.StatusCode, missingBody)
	}
}

func TestDirectInvestmentRedemptionValidatesHoldingAndCreatesMFAAction(t *testing.T) {
	server, cleanup := newServer(t)
	defer cleanup()
	conversationID := createConversation(t, server.URL)
	purchasePath := server.URL + "/v1/investments/products/product_conservative/subscriptions"
	resp, body := request(t, http.DefaultClient, http.MethodPost, purchasePath, `{"conversation_id":"`+conversationID+`","amount_minor":10000,"risk_acknowledged":true}`, "direct-redeem-purchase")
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("direct purchase: status=%d body=%s", resp.StatusCode, body)
	}
	var created envelope
	if err := json.Unmarshal(body, &created); err != nil {
		t.Fatal(err)
	}
	var purchase struct {
		ID string `json:"action_id"`
	}
	if err := json.Unmarshal(created.Data, &purchase); err != nil {
		t.Fatal(err)
	}
	resp, body = request(t, http.DefaultClient, http.MethodPost, server.URL+"/v1/actions/"+purchase.ID+"/mfa/verify", `{"code":"000000"}`, "direct-redeem-purchase-mfa")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("purchase mfa: status=%d body=%s", resp.StatusCode, body)
	}
	resp, body = request(t, http.DefaultClient, http.MethodGet, server.URL+"/v1/investments/holdings", "", "")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("holdings: status=%d body=%s", resp.StatusCode, body)
	}
	var holdingsEnvelope envelope
	if err := json.Unmarshal(body, &holdingsEnvelope); err != nil {
		t.Fatal(err)
	}
	var holdings []struct {
		ID     string `json:"holding_id"`
		Status string `json:"status"`
	}
	if err := json.Unmarshal(holdingsEnvelope.Data, &holdings); err != nil {
		t.Fatal(err)
	}
	if len(holdings) != 1 || holdings[0].Status != "active" {
		t.Fatalf("unexpected holdings: %+v", holdings)
	}
	redemptionPath := server.URL + "/v1/investments/holdings/" + holdings[0].ID + "/redemptions"
	resp, body = request(t, http.DefaultClient, http.MethodPost, redemptionPath, `{"conversation_id":"`+conversationID+`"}`, "direct-redeem-1")
	if resp.StatusCode != http.StatusCreated || !bytes.Contains(body, []byte(`"status":"awaiting_mfa"`)) {
		t.Fatalf("direct redemption: status=%d body=%s", resp.StatusCode, body)
	}
	resp, body = request(t, http.DefaultClient, http.MethodPost, server.URL+"/v1/investments/holdings/holding_missing/redemptions", `{"conversation_id":"`+conversationID+`"}`, "direct-redeem-missing")
	if resp.StatusCode != http.StatusNotFound || !bytes.Contains(body, []byte(`NOT_FOUND`)) {
		t.Fatalf("missing holding: status=%d body=%s", resp.StatusCode, body)
	}
}

func TestDirectCardLimitRequiresMFA(t *testing.T) {
	server, cleanup := newServer(t)
	defer cleanup()
	conversationID := createConversation(t, server.URL)
	path := server.URL + "/v1/cards/card_demo/limit"
	resp, body := request(t, http.DefaultClient, http.MethodPost, path, `{"conversation_id":"`+conversationID+`","limit_minor":800000}`, "direct-card-limit")
	if resp.StatusCode != http.StatusCreated || !bytes.Contains(body, []byte(`"status":"awaiting_mfa"`)) {
		t.Fatalf("direct card limit: status=%d body=%s", resp.StatusCode, body)
	}
	var created envelope
	if err := json.Unmarshal(body, &created); err != nil {
		t.Fatal(err)
	}
	var action struct {
		ID string `json:"action_id"`
	}
	if err := json.Unmarshal(created.Data, &action); err != nil {
		t.Fatal(err)
	}
	resp, body = request(t, http.DefaultClient, http.MethodPost, server.URL+"/v1/actions/"+action.ID+"/mfa/verify", `{"code":"000000"}`, "direct-card-limit-mfa")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("card limit mfa: status=%d body=%s", resp.StatusCode, body)
	}
	resp, body = request(t, http.DefaultClient, http.MethodGet, server.URL+"/v1/cards", "", "")
	if resp.StatusCode != http.StatusOK || !bytes.Contains(body, []byte(`"limit_minor":800000`)) {
		t.Fatalf("updated card limit: status=%d body=%s", resp.StatusCode, body)
	}
}

func TestDirectCardAndSubscriptionActionsUseConfirmation(t *testing.T) {
	server, cleanup := newServer(t)
	defer cleanup()
	conversationID := createConversation(t, server.URL)
	cardPath := server.URL + "/v1/cards/card_demo/freeze"
	resp, body := request(t, http.DefaultClient, http.MethodPost, cardPath, `{"conversation_id":"`+conversationID+`"}`, "direct-card-freeze")
	if resp.StatusCode != http.StatusCreated || !bytes.Contains(body, []byte(`"status":"awaiting_confirmation"`)) {
		t.Fatalf("direct card action: status=%d body=%s", resp.StatusCode, body)
	}
	var created envelope
	if err := json.Unmarshal(body, &created); err != nil {
		t.Fatal(err)
	}
	var cardAction struct {
		ID string `json:"action_id"`
	}
	if err := json.Unmarshal(created.Data, &cardAction); err != nil {
		t.Fatal(err)
	}
	resp, body = request(t, http.DefaultClient, http.MethodPost, server.URL+"/v1/actions/"+cardAction.ID+"/confirm", `{}`, "direct-card-confirm")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("card confirm: status=%d body=%s", resp.StatusCode, body)
	}
	resp, body = request(t, http.DefaultClient, http.MethodGet, server.URL+"/v1/cards", "", "")
	if resp.StatusCode != http.StatusOK || !bytes.Contains(body, []byte(`"status":"frozen"`)) {
		t.Fatalf("frozen card: status=%d body=%s", resp.StatusCode, body)
	}

	subscriptionPath := server.URL + "/v1/subscriptions/sub_streaming/cancel"
	resp, body = request(t, http.DefaultClient, http.MethodPost, subscriptionPath, `{"conversation_id":"`+conversationID+`"}`, "direct-sub-cancel")
	if resp.StatusCode != http.StatusCreated || !bytes.Contains(body, []byte(`"status":"awaiting_confirmation"`)) {
		t.Fatalf("direct subscription action: status=%d body=%s", resp.StatusCode, body)
	}
	if err := json.Unmarshal(body, &created); err != nil {
		t.Fatal(err)
	}
	var subscriptionAction struct {
		ID string `json:"action_id"`
	}
	if err := json.Unmarshal(created.Data, &subscriptionAction); err != nil {
		t.Fatal(err)
	}
	resp, body = request(t, http.DefaultClient, http.MethodPost, server.URL+"/v1/actions/"+subscriptionAction.ID+"/confirm", `{}`, "direct-sub-confirm")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("subscription confirm: status=%d body=%s", resp.StatusCode, body)
	}
	resp, body = request(t, http.DefaultClient, http.MethodGet, server.URL+"/v1/subscriptions?status=cancelled", "", "")
	if resp.StatusCode != http.StatusOK || !bytes.Contains(body, []byte(`"subscription_id":"sub_streaming"`)) {
		t.Fatalf("cancelled subscription: status=%d body=%s", resp.StatusCode, body)
	}
}

func TestInvestmentPurchaseRequiresMFAAndCreatesHolding(t *testing.T) {
	server, cleanup := newServer(t)
	defer cleanup()
	conversationID := createConversation(t, server.URL)

	status, result, body := sendMessage(t, server.URL, conversationID, "申购稳健理财100元", "investment-message")
	if status != http.StatusOK || result.ReplyType != "action_required" || result.Action.Risk != "red" {
		t.Fatalf("investment message: status=%d result=%+v body=%s", status, result, body)
	}
	resp, body := request(t, http.DefaultClient, http.MethodPost, server.URL+"/v1/actions/"+result.Action.ID+"/mfa/verify", `{"code":"000000"}`, "investment-mfa")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("investment mfa: status=%d body=%s", resp.StatusCode, body)
	}
	resp, body = request(t, http.DefaultClient, http.MethodGet, server.URL+"/v1/investments/holdings", "", "")
	if resp.StatusCode != http.StatusOK || !bytes.Contains(body, []byte(`"product_id":"product_conservative"`)) || !bytes.Contains(body, []byte(`"amount_minor":10000`)) {
		t.Fatalf("holdings: status=%d body=%s", resp.StatusCode, body)
	}
}

func TestInvestmentRedemptionRequiresMFAAndCreditsPrincipal(t *testing.T) {
	server, cleanup := newServer(t)
	defer cleanup()
	conversationID := createConversation(t, server.URL)

	status, purchase, body := sendMessage(t, server.URL, conversationID, "申购稳健理财100元", "redeem-purchase-message")
	if status != http.StatusOK || purchase.Action.Risk != "red" {
		t.Fatalf("purchase message: status=%d result=%+v body=%s", status, purchase, body)
	}
	resp, body := request(t, http.DefaultClient, http.MethodPost, server.URL+"/v1/actions/"+purchase.Action.ID+"/mfa/verify", `{"code":"000000"}`, "redeem-purchase-mfa")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("purchase mfa: status=%d body=%s", resp.StatusCode, body)
	}

	resp, body = request(t, http.DefaultClient, http.MethodGet, server.URL+"/v1/investments/holdings", "", "")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("holdings: status=%d body=%s", resp.StatusCode, body)
	}
	var holdingsEnvelope envelope
	if err := json.Unmarshal(body, &holdingsEnvelope); err != nil {
		t.Fatal(err)
	}
	var holdings []struct {
		ID     string `json:"holding_id"`
		Status string `json:"status"`
	}
	if err := json.Unmarshal(holdingsEnvelope.Data, &holdings); err != nil {
		t.Fatal(err)
	}
	if len(holdings) != 1 || holdings[0].Status != "active" {
		t.Fatalf("unexpected holdings: %+v", holdings)
	}

	status, redemption, body := sendMessage(t, server.URL, conversationID, "赎回我的理财", "redeem-message")
	if status != http.StatusOK || redemption.ReplyType != "action_required" || redemption.Action.Risk != "red" {
		t.Fatalf("redemption message: status=%d result=%+v body=%s", status, redemption, body)
	}
	resp, body = request(t, http.DefaultClient, http.MethodPost, server.URL+"/v1/actions/"+redemption.Action.ID+"/mfa/verify", `{"code":"000000"}`, "redeem-mfa")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("redemption mfa: status=%d body=%s", resp.StatusCode, body)
	}

	resp, body = request(t, http.DefaultClient, http.MethodGet, server.URL+"/v1/actions/"+redemption.Action.ID, "", "")
	if resp.StatusCode != http.StatusOK || !bytes.Contains(body, []byte(`"total_minor":10000`)) || !bytes.Contains(body, []byte(`"profit_minor":0`)) {
		t.Fatalf("redemption result: status=%d body=%s", resp.StatusCode, body)
	}

	resp, body = request(t, http.DefaultClient, http.MethodGet, server.URL+"/v1/investments/holdings", "", "")
	if resp.StatusCode != http.StatusOK || !bytes.Contains(body, []byte(`"status":"redeemed"`)) {
		t.Fatalf("redeemed holdings: status=%d body=%s", resp.StatusCode, body)
	}
	resp, body = request(t, http.DefaultClient, http.MethodGet, server.URL+"/v1/accounts/acct_demo/balance", "", "")
	if resp.StatusCode != http.StatusOK || !bytes.Contains(body, []byte(`"balance_minor":1000000`)) {
		t.Fatalf("redeemed balance: status=%d body=%s", resp.StatusCode, body)
	}
}
