package httpapi

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/cffa-as/bankagent/internal/domain"
)

const demoUser = domain.DemoUserID

type Handler struct {
	service *domain.Service
	mu      sync.Mutex
}

func New(service *domain.Service) http.Handler { return &Handler{service: service} }

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path == "/healthz" {
		writeJSON(w, http.StatusOK, envelope(map[string]string{"status": "ok"}, "tr_health"))
		return
	}
	userID, ok := authenticate(r)
	if !ok {
		writeError(w, http.StatusUnauthorized, "UNAUTHENTICATED", "缺失或无效认证", "tr_auth")
		return
	}
	path := r.URL.Path
	if r.Method == http.MethodPost && path == "/v1/conversations" {
		h.createConversation(w, r, userID)
		return
	}
	if r.Method == http.MethodPost && strings.HasPrefix(path, "/v1/conversations/") && strings.HasSuffix(path, "/messages") {
		h.message(w, r, userID, path)
		return
	}
	if r.Method == http.MethodGet && path == "/v1/investments/products" {
		h.products(w, r, userID)
		return
	}
	if r.Method == http.MethodGet && path == "/v1/investments/holdings" {
		h.holdings(w, r, userID)
		return
	}
	if r.Method == http.MethodPost && strings.HasPrefix(path, "/v1/investments/products/") && strings.HasSuffix(path, "/subscriptions") {
		h.createInvestmentPurchase(w, r, userID, path)
		return
	}
	if r.Method == http.MethodPost && path == "/v1/transfers" {
		h.createTransfer(w, r, userID)
		return
	}
	if r.Method == http.MethodPost && path == "/v1/transfer-splits" {
		h.createTransferSplit(w, r, userID)
		return
	}
	if r.Method == http.MethodPost && strings.HasPrefix(path, "/v1/investments/holdings/") && strings.HasSuffix(path, "/redemptions") {
		h.createInvestmentRedemption(w, r, userID, path)
		return
	}
	if r.Method == http.MethodPost && strings.HasPrefix(path, "/v1/cards/") && strings.HasSuffix(path, "/apply") {
		h.createCardApplication(w, r, userID, path)
		return
	}
	if r.Method == http.MethodPost && strings.HasPrefix(path, "/v1/cards/") && strings.HasSuffix(path, "/limit") {
		h.createCardLimit(w, r, userID, path)
		return
	}
	if r.Method == http.MethodPost && strings.HasPrefix(path, "/v1/cards/") && (strings.HasSuffix(path, "/freeze") || strings.HasSuffix(path, "/unfreeze") || strings.HasSuffix(path, "/lost") || strings.HasSuffix(path, "/unlost")) {
		h.createCardStatus(w, r, userID, path)
		return
	}
	if r.Method == http.MethodPost && strings.HasPrefix(path, "/v1/subscriptions/") && strings.HasSuffix(path, "/cancel") {
		h.createSubscriptionCancel(w, r, userID, path)
		return
	}
	if r.Method == http.MethodGet && path == "/v1/cards" {
		h.cards(w, r, userID)
		return
	}
	if r.Method == http.MethodGet && path == "/v1/subscriptions/reminders" {
		h.subscriptionReminders(w, r, userID)
		return
	}
	if r.Method == http.MethodGet && path == "/v1/subscriptions" {
		h.subscriptions(w, r, userID)
		return
	}
	if r.Method == http.MethodGet && strings.HasPrefix(path, "/v1/accounts/") && strings.HasSuffix(path, "/balance") {
		h.accountBalance(w, r, userID, path)
		return
	}
	if r.Method == http.MethodGet && strings.HasPrefix(path, "/v1/accounts/") && strings.HasSuffix(path, "/transactions") {
		h.transactions(w, r, userID, path)
		return
	}
	if r.Method == http.MethodGet && strings.HasPrefix(path, "/v1/accounts/") && strings.HasSuffix(path, "/bills/summary") {
		h.billSummary(w, r, userID, path)
		return
	}
	if r.Method == http.MethodGet && strings.HasPrefix(path, "/v1/actions/") {
		h.getAction(w, r, userID, path)
		return
	}
	if r.Method == http.MethodPost && strings.HasPrefix(path, "/v1/actions/") && strings.HasSuffix(path, "/confirm") {
		h.confirm(w, r, userID, path)
		return
	}
	if r.Method == http.MethodPost && strings.HasPrefix(path, "/v1/actions/") && strings.HasSuffix(path, "/mfa/verify") {
		h.verifyMFA(w, r, userID, path)
		return
	}
	if r.Method == http.MethodPost && strings.HasPrefix(path, "/v1/actions/") && strings.HasSuffix(path, "/cancel") {
		h.cancel(w, r, userID, path)
		return
	}
	if r.Method == http.MethodPost && strings.HasPrefix(path, "/v1/actions/") && strings.HasSuffix(path, "/trigger") {
		h.trigger(w, r, userID, path)
		return
	}
	if r.Method == http.MethodPost && path == "/v1/workflows" {
		h.createWorkflow(w, r, userID)
		return
	}
	if r.Method == http.MethodGet && path == "/v1/workflows" {
		h.listWorkflows(w, r, userID)
		return
	}
	if r.Method == http.MethodGet && strings.HasPrefix(path, "/v1/workflows/") {
		h.getWorkflow(w, r, userID, path)
		return
	}
	if r.Method == http.MethodPost && strings.HasPrefix(path, "/v1/workflows/") && strings.HasSuffix(path, "/cancel") {
		h.cancelWorkflow(w, r, userID, path)
		return
	}
	if r.Method == http.MethodPost && strings.HasPrefix(path, "/v1/workflows/") && strings.HasSuffix(path, "/advance") {
		h.advanceWorkflow(w, r, userID, path)
		return
	}
	if r.Method == http.MethodGet && strings.HasPrefix(path, "/v1/audit-traces/") {
		h.audit(w, r, userID, path)
		return
	}
	writeError(w, http.StatusNotFound, "NOT_FOUND", "资源不存在", "tr_not_found")
}

func authenticate(r *http.Request) (string, bool) {
	value := strings.TrimSpace(r.Header.Get("Authorization"))
	if value == "Bearer demo-user-1" || value == "Bearer "+demoUser {
		return demoUser, true
	}
	return "", false
}

func (h *Handler) createConversation(w http.ResponseWriter, r *http.Request, userID string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	body, err := readBody(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_ARGUMENT", "请求体无效", "tr_invalid")
		return
	}
	if len(body) > 2 && string(body) != "{}" {
		writeError(w, http.StatusBadRequest, "INVALID_ARGUMENT", "创建会话不接受请求字段", "tr_invalid")
		return
	}
	fp := fingerprint(body)
	if h.replay(w, r, userID, r.URL.Path, fp) {
		return
	}
	conversation, trace, err := h.service.CreateConversation(r.Context(), userID)
	if err != nil {
		writeServiceError(w, err, trace)
		return
	}
	response := envelope(conversation, trace)
	h.saveReplay(r, userID, r.URL.Path, fp, http.StatusCreated, response)
	writeJSON(w, http.StatusCreated, response)
}

func (h *Handler) message(w http.ResponseWriter, r *http.Request, userID, path string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	conversationID := segment(path, 2)
	var request struct {
		Text string `json:"text"`
	}
	body, err := decodeJSON(r, &request)
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_ARGUMENT", "请求体无效", "tr_invalid")
		return
	}
	fingerprint := fingerprint(body)
	if h.replay(w, r, userID, path, fingerprint) {
		return
	}
	result, trace, err := h.service.Message(r.Context(), userID, conversationID, request.Text)
	if err != nil {
		writeServiceError(w, err, trace)
		return
	}
	response := envelope(result, trace)
	h.saveReplay(r, userID, path, fingerprint, http.StatusOK, response)
	writeJSON(w, http.StatusOK, response)
}

func (h *Handler) createTransfer(w http.ResponseWriter, r *http.Request, userID string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	var request struct {
		ConversationID  string `json:"conversation_id"`
		BeneficiaryName string `json:"beneficiary_name"`
		AmountMinor     int64  `json:"amount_minor"`
		Remark          string `json:"remark"`
		ScheduledAt     string `json:"scheduled_at"`
	}
	body, err := decodeJSON(r, &request)
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_ARGUMENT", "请求体无效", "tr_invalid")
		return
	}
	fp := fingerprint(body)
	if h.replay(w, r, userID, r.URL.Path, fp) {
		return
	}
	var action domain.Action
	var trace string
	if request.ScheduledAt == "" {
		action, trace, err = h.service.CreateTransferAction(r.Context(), userID, request.ConversationID, request.BeneficiaryName, request.AmountMinor, request.Remark)
	} else {
		scheduledAt, parseErr := time.Parse(time.RFC3339, request.ScheduledAt)
		if parseErr != nil {
			writeError(w, http.StatusBadRequest, "INVALID_ARGUMENT", "scheduled_at 必须是 RFC3339 时间", "tr_invalid")
			return
		}
		action, trace, err = h.service.CreateScheduledTransferAction(r.Context(), userID, request.ConversationID, request.BeneficiaryName, request.AmountMinor, request.Remark, scheduledAt)
	}
	if err != nil {
		writeServiceError(w, err, trace)
		return
	}
	response := envelope(action, trace)
	h.saveReplay(r, userID, r.URL.Path, fp, http.StatusCreated, response)
	writeJSON(w, http.StatusCreated, response)
}

func (h *Handler) createTransferSplit(w http.ResponseWriter, r *http.Request, userID string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	var request struct {
		ConversationID   string                    `json:"conversation_id"`
		TotalAmountMinor int64                     `json:"total_amount_minor"`
		Participants     []domain.SplitParticipant `json:"participants"`
	}
	body, err := decodeJSON(r, &request)
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_ARGUMENT", "请求体无效", "tr_invalid")
		return
	}
	fp := fingerprint(body)
	if h.replay(w, r, userID, r.URL.Path, fp) {
		return
	}
	action, trace, err := h.service.CreateTransferSplitAction(r.Context(), userID, request.ConversationID, request.TotalAmountMinor, request.Participants)
	if err != nil {
		writeServiceError(w, err, trace)
		return
	}
	response := envelope(action, trace)
	h.saveReplay(r, userID, r.URL.Path, fp, http.StatusCreated, response)
	writeJSON(w, http.StatusCreated, response)
}

func (h *Handler) createCardApplication(w http.ResponseWriter, r *http.Request, userID, path string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	var request struct {
		ConversationID string `json:"conversation_id"`
	}
	body, err := decodeJSON(r, &request)
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_ARGUMENT", "请求体无效", "tr_invalid")
		return
	}
	fp := fingerprint(body)
	if h.replay(w, r, userID, path, fp) {
		return
	}
	action, trace, err := h.service.CreateCardApplicationAction(r.Context(), userID, request.ConversationID, segment(path, 2))
	if err != nil {
		writeServiceError(w, err, trace)
		return
	}
	response := envelope(action, trace)
	h.saveReplay(r, userID, path, fp, http.StatusCreated, response)
	writeJSON(w, http.StatusCreated, response)
}

func (h *Handler) createInvestmentPurchase(w http.ResponseWriter, r *http.Request, userID, path string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	var request struct {
		ConversationID   string `json:"conversation_id"`
		AmountMinor      int64  `json:"amount_minor"`
		RiskAcknowledged bool   `json:"risk_acknowledged"`
	}
	body, err := decodeJSON(r, &request)
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_ARGUMENT", "请求体无效", "tr_invalid")
		return
	}
	fp := fingerprint(body)
	if h.replay(w, r, userID, path, fp) {
		return
	}
	action, trace, err := h.service.CreateInvestmentPurchaseAction(r.Context(), userID, request.ConversationID, segment(path, 3), request.AmountMinor, request.RiskAcknowledged)
	if err != nil {
		writeServiceError(w, err, trace)
		return
	}
	response := envelope(action, trace)
	h.saveReplay(r, userID, path, fp, http.StatusCreated, response)
	writeJSON(w, http.StatusCreated, response)
}

func (h *Handler) createInvestmentRedemption(w http.ResponseWriter, r *http.Request, userID, path string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	var request struct {
		ConversationID string `json:"conversation_id"`
	}
	body, err := decodeJSON(r, &request)
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_ARGUMENT", "请求体无效", "tr_invalid")
		return
	}
	fp := fingerprint(body)
	if h.replay(w, r, userID, path, fp) {
		return
	}
	action, trace, err := h.service.CreateInvestmentRedemptionAction(r.Context(), userID, request.ConversationID, segment(path, 3))
	if err != nil {
		writeServiceError(w, err, trace)
		return
	}
	response := envelope(action, trace)
	h.saveReplay(r, userID, path, fp, http.StatusCreated, response)
	writeJSON(w, http.StatusCreated, response)
}

func (h *Handler) createCardLimit(w http.ResponseWriter, r *http.Request, userID, path string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	var request struct {
		ConversationID string `json:"conversation_id"`
		LimitMinor     int64  `json:"limit_minor"`
	}
	body, err := decodeJSON(r, &request)
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_ARGUMENT", "请求体无效", "tr_invalid")
		return
	}
	fp := fingerprint(body)
	if h.replay(w, r, userID, path, fp) {
		return
	}
	action, trace, err := h.service.CreateCardLimitAction(r.Context(), userID, request.ConversationID, segment(path, 2), request.LimitMinor)
	if err != nil {
		writeServiceError(w, err, trace)
		return
	}
	response := envelope(action, trace)
	h.saveReplay(r, userID, path, fp, http.StatusCreated, response)
	writeJSON(w, http.StatusCreated, response)
}

func (h *Handler) createCardStatus(w http.ResponseWriter, r *http.Request, userID, path string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	var request struct {
		ConversationID string `json:"conversation_id"`
	}
	body, err := decodeJSON(r, &request)
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_ARGUMENT", "请求体无效", "tr_invalid")
		return
	}
	fp := fingerprint(body)
	if h.replay(w, r, userID, path, fp) {
		return
	}
	target := "frozen"
	if strings.HasSuffix(path, "/unfreeze") || strings.HasSuffix(path, "/unlost") {
		target = "active"
	}
	if strings.HasSuffix(path, "/lost") {
		target = "lost"
	}
	action, trace, err := h.service.CreateCardStatusAction(r.Context(), userID, request.ConversationID, segment(path, 2), target)
	if err != nil {
		writeServiceError(w, err, trace)
		return
	}
	response := envelope(action, trace)
	h.saveReplay(r, userID, path, fp, http.StatusCreated, response)
	writeJSON(w, http.StatusCreated, response)
}

func (h *Handler) createSubscriptionCancel(w http.ResponseWriter, r *http.Request, userID, path string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	var request struct {
		ConversationID string `json:"conversation_id"`
	}
	body, err := decodeJSON(r, &request)
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_ARGUMENT", "请求体无效", "tr_invalid")
		return
	}
	fp := fingerprint(body)
	if h.replay(w, r, userID, path, fp) {
		return
	}
	action, trace, err := h.service.CreateSubscriptionCancelAction(r.Context(), userID, request.ConversationID, segment(path, 2))
	if err != nil {
		writeServiceError(w, err, trace)
		return
	}
	response := envelope(action, trace)
	h.saveReplay(r, userID, path, fp, http.StatusCreated, response)
	writeJSON(w, http.StatusCreated, response)
}

func (h *Handler) products(w http.ResponseWriter, r *http.Request, _ string) {
	page, pageSize, err := queryPage(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_ARGUMENT", "page 和 page_size 参数无效", "tr_invalid")
		return
	}
	result, trace, err := h.service.ListProducts(r.Context(), strings.TrimSpace(r.URL.Query().Get("risk_level")), page, pageSize)
	if err != nil {
		writeServiceError(w, err, trace)
		return
	}
	writeJSON(w, http.StatusOK, envelope(result, trace))
}

func (h *Handler) holdings(w http.ResponseWriter, r *http.Request, userID string) {
	holdings, trace, err := h.service.ListHoldings(r.Context(), userID)
	if err != nil {
		writeServiceError(w, err, trace)
		return
	}
	writeJSON(w, http.StatusOK, envelope(holdings, trace))
}

func (h *Handler) cards(w http.ResponseWriter, r *http.Request, userID string) {
	cards, trace, err := h.service.ListCards(r.Context(), userID)
	if err != nil {
		writeServiceError(w, err, trace)
		return
	}
	writeJSON(w, http.StatusOK, envelope(cards, trace))
}

func (h *Handler) subscriptions(w http.ResponseWriter, r *http.Request, userID string) {
	subscriptions, trace, err := h.service.ListSubscriptions(r.Context(), userID, strings.TrimSpace(r.URL.Query().Get("status")))
	if err != nil {
		if errors.Is(err, domain.ErrInvalidArgument) {
			writeError(w, http.StatusBadRequest, "INVALID_ARGUMENT", "status 参数无效", "tr_invalid")
			return
		}
		writeServiceError(w, err, trace)
		return
	}
	writeJSON(w, http.StatusOK, envelope(subscriptions, trace))
}

func (h *Handler) subscriptionReminders(w http.ResponseWriter, r *http.Request, userID string) {
	days := 7
	if value := strings.TrimSpace(r.URL.Query().Get("days")); value != "" {
		parsed, err := strconv.Atoi(value)
		if err != nil {
			writeError(w, http.StatusBadRequest, "INVALID_ARGUMENT", "days 参数无效", "tr_invalid")
			return
		}
		days = parsed
	}
	reminders, trace, err := h.service.SubscriptionReminders(r.Context(), userID, days)
	if err != nil {
		writeServiceError(w, err, trace)
		return
	}
	writeJSON(w, http.StatusOK, envelope(reminders, trace))
}

func (h *Handler) accountBalance(w http.ResponseWriter, r *http.Request, userID, path string) {
	account, trace, err := h.service.AccountBalance(r.Context(), userID, segment(path, 2))
	if err != nil {
		writeServiceError(w, err, trace)
		return
	}
	writeJSON(w, http.StatusOK, envelope(account, trace))
}

func (h *Handler) transactions(w http.ResponseWriter, r *http.Request, userID, path string) {
	page, pageSize, err := queryPage(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_ARGUMENT", "page 和 page_size 参数无效", "tr_invalid")
		return
	}
	from, to, err := queryDateRange(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_ARGUMENT", "from 和 to 必须使用 YYYY-MM-DD 格式，且 from 不得晚于 to", "tr_invalid")
		return
	}
	result, trace, err := h.service.ListTransactions(r.Context(), userID, segment(path, 2), from, to, strings.TrimSpace(r.URL.Query().Get("category")), page, pageSize)
	if err != nil {
		writeServiceError(w, err, trace)
		return
	}
	writeJSON(w, http.StatusOK, envelope(result, trace))
}

func (h *Handler) billSummary(w http.ResponseWriter, r *http.Request, userID, path string) {
	accountID := segment(path, 2)
	if strings.TrimSpace(r.URL.Query().Get("year")) != "" && strings.TrimSpace(r.URL.Query().Get("month")) != "" {
		writeError(w, http.StatusBadRequest, "INVALID_ARGUMENT", "year 和 month 不能同时使用", "tr_invalid")
		return
	}
	if value := strings.TrimSpace(r.URL.Query().Get("year")); value != "" {
		year, err := strconv.Atoi(value)
		if err != nil || year < 2000 || year > 2100 {
			writeError(w, http.StatusBadRequest, "INVALID_ARGUMENT", "year 参数无效", "tr_invalid")
			return
		}
		summary, trace, err := h.service.BillReport(r.Context(), userID, accountID, "year", year)
		if err != nil {
			writeServiceError(w, err, trace)
			return
		}
		writeJSON(w, http.StatusOK, envelope(summary, trace))
		return
	}
	month := time.Now()
	if value := strings.TrimSpace(r.URL.Query().Get("month")); value != "" {
		parsed, err := time.ParseInLocation("2006-01", value, time.FixedZone("CST", 8*60*60))
		if err != nil {
			writeError(w, http.StatusBadRequest, "INVALID_ARGUMENT", "month 必须使用 YYYY-MM 格式", "tr_invalid")
			return
		}
		month = parsed
	}
	summary, trace, err := h.service.BillSummary(r.Context(), userID, accountID, month)
	if err != nil {
		writeServiceError(w, err, trace)
		return
	}
	writeJSON(w, http.StatusOK, envelope(summary, trace))
}

func (h *Handler) getAction(w http.ResponseWriter, r *http.Request, userID, path string) {
	actionID := segment(path, 2)
	action, trace, err := h.service.GetAction(r.Context(), userID, actionID)
	if err != nil {
		writeServiceError(w, err, trace)
		return
	}
	writeJSON(w, http.StatusOK, envelope(action, trace))
}

func (h *Handler) confirm(w http.ResponseWriter, r *http.Request, userID, path string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	actionID := segment(path, 2)
	var request struct{}
	body, err := decodeJSON(r, &request)
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_ARGUMENT", "请求体无效", "tr_invalid")
		return
	}
	fingerprint := fingerprint(body)
	if h.replay(w, r, userID, path, fingerprint) {
		return
	}
	action, trace, err := h.service.Confirm(r.Context(), userID, actionID, "")
	if err != nil {
		writeServiceError(w, err, trace)
		return
	}
	response := envelope(action, trace)
	h.saveReplay(r, userID, path, fingerprint, http.StatusOK, response)
	writeJSON(w, http.StatusOK, response)
}

func (h *Handler) verifyMFA(w http.ResponseWriter, r *http.Request, userID, path string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	actionID := segment(path, 2)
	var request struct {
		Code string `json:"code"`
	}
	body, err := decodeJSON(r, &request)
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_ARGUMENT", "请求体无效", "tr_invalid")
		return
	}
	fingerprint := fingerprint(body)
	if h.replay(w, r, userID, path, fingerprint) {
		return
	}
	action, trace, err := h.service.VerifyMFA(r.Context(), userID, actionID, request.Code)
	if err != nil {
		writeServiceError(w, err, trace)
		return
	}
	response := envelope(action, trace)
	h.saveReplay(r, userID, path, fingerprint, http.StatusOK, response)
	writeJSON(w, http.StatusOK, response)
}

func (h *Handler) cancel(w http.ResponseWriter, r *http.Request, userID, path string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	actionID := segment(path, 2)
	body, err := readBody(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_ARGUMENT", "请求体无效", "tr_invalid")
		return
	}
	fingerprint := fingerprint(body)
	if h.replay(w, r, userID, path, fingerprint) {
		return
	}
	action, trace, err := h.service.Cancel(r.Context(), userID, actionID)
	if err != nil {
		writeServiceError(w, err, trace)
		return
	}
	response := envelope(action, trace)
	h.saveReplay(r, userID, path, fingerprint, http.StatusOK, response)
	writeJSON(w, http.StatusOK, response)
}

func (h *Handler) trigger(w http.ResponseWriter, r *http.Request, userID, path string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	actionID := segment(path, 2)
	var request struct{}
	body, err := decodeJSON(r, &request)
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_ARGUMENT", "请求体无效", "tr_invalid")
		return
	}
	fingerprint := fingerprint(body)
	if h.replay(w, r, userID, path, fingerprint) {
		return
	}
	action, trace, err := h.service.TriggerScheduled(r.Context(), userID, actionID)
	if err != nil {
		writeServiceError(w, err, trace)
		return
	}
	response := envelope(action, trace)
	h.saveReplay(r, userID, path, fingerprint, http.StatusOK, response)
	writeJSON(w, http.StatusOK, response)
}

func queryPage(r *http.Request) (int, int, error) {
	page, pageSize := 1, 20
	if value := strings.TrimSpace(r.URL.Query().Get("page")); value != "" {
		var err error
		page, err = strconv.Atoi(value)
		if err != nil {
			return 0, 0, err
		}
	}
	if value := strings.TrimSpace(r.URL.Query().Get("page_size")); value != "" {
		var err error
		pageSize, err = strconv.Atoi(value)
		if err != nil {
			return 0, 0, err
		}
	}
	if page < 1 || pageSize < 1 || pageSize > 100 {
		return 0, 0, errors.New("invalid page")
	}
	return page, pageSize, nil
}

func queryDateRange(r *http.Request) (*time.Time, *time.Time, error) {
	loc, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		return nil, nil, err
	}
	parse := func(name string) (*time.Time, error) {
		value := strings.TrimSpace(r.URL.Query().Get(name))
		if value == "" {
			return nil, nil
		}
		parsed, err := time.ParseInLocation("2006-01-02", value, loc)
		if err != nil {
			return nil, err
		}
		return &parsed, nil
	}
	from, err := parse("from")
	if err != nil {
		return nil, nil, err
	}
	to, err := parse("to")
	if err != nil {
		return nil, nil, err
	}
	if to != nil {
		end := to.AddDate(0, 0, 1)
		to = &end
	}
	if from != nil && to != nil && !from.Before(*to) {
		return nil, nil, errors.New("invalid date range")
	}
	return from, to, nil
}

func (h *Handler) createWorkflow(w http.ResponseWriter, r *http.Request, userID string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	var request struct {
		Purpose  string                     `json:"purpose"`
		Deadline string                     `json:"deadline"`
		Nodes    []domain.WorkflowNodeInput `json:"nodes"`
	}
	body, err := decodeJSON(r, &request)
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_ARGUMENT", "请求体无效", "tr_invalid")
		return
	}
	fp := fingerprint(body)
	if h.replay(w, r, userID, r.URL.Path, fp) {
		return
	}
	deadline, err := time.Parse(time.RFC3339, request.Deadline)
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_ARGUMENT", "deadline 必须是 RFC3339 时间", "tr_invalid")
		return
	}
	workflow, trace, err := h.service.CreateWorkflow(r.Context(), userID, strings.TrimSpace(request.Purpose), deadline, request.Nodes)
	if err != nil {
		writeServiceError(w, err, trace)
		return
	}
	response := envelope(workflow, trace)
	h.saveReplay(r, userID, r.URL.Path, fp, http.StatusCreated, response)
	writeJSON(w, http.StatusCreated, response)
}

func (h *Handler) listWorkflows(w http.ResponseWriter, r *http.Request, userID string) {
	workflows, err := h.service.ListWorkflows(r.Context(), userID)
	if err != nil {
		writeServiceError(w, err, "tr_workflows")
		return
	}
	writeJSON(w, http.StatusOK, envelope(workflows, "tr_workflows"))
}

func (h *Handler) getWorkflow(w http.ResponseWriter, r *http.Request, userID, path string) {
	workflow, err := h.service.GetWorkflow(r.Context(), userID, segment(path, 2))
	if err != nil {
		writeServiceError(w, err, "tr_workflow")
		return
	}
	writeJSON(w, http.StatusOK, envelope(workflow, "tr_workflow"))
}

func (h *Handler) cancelWorkflow(w http.ResponseWriter, r *http.Request, userID, path string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	body, err := readBody(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_ARGUMENT", "请求体无效", "tr_invalid")
		return
	}
	if len(bytes.TrimSpace(body)) == 0 {
		body = []byte("{}")
	}
	var payload map[string]any
	if err := decodeBody(body, &payload); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_ARGUMENT", "请求体无效", "tr_invalid")
		return
	}
	fp := fingerprint(body)
	if h.replay(w, r, userID, path, fp) {
		return
	}
	workflow, trace, err := h.service.CancelWorkflow(r.Context(), userID, segment(path, 2))
	if err != nil {
		writeServiceError(w, err, trace)
		return
	}
	response := envelope(workflow, trace)
	h.saveReplay(r, userID, path, fp, http.StatusOK, response)
	writeJSON(w, http.StatusOK, response)
}

func (h *Handler) advanceWorkflow(w http.ResponseWriter, r *http.Request, userID, path string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	body, err := readBody(r)
	if err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_ARGUMENT", "请求体无效", "tr_invalid")
		return
	}
	if len(bytes.TrimSpace(body)) == 0 {
		body = []byte("{}")
	}
	var request struct {
		VirtualNow string `json:"virtual_now"`
	}
	if err := decodeBody(body, &request); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_ARGUMENT", "请求体无效", "tr_invalid")
		return
	}
	fp := fingerprint(body)
	if h.replay(w, r, userID, path, fp) {
		return
	}
	var virtualNow time.Time
	if request.VirtualNow != "" {
		virtualNow, err = time.Parse(time.RFC3339, request.VirtualNow)
		if err != nil {
			writeError(w, http.StatusBadRequest, "INVALID_ARGUMENT", "virtual_now 必须是 RFC3339 时间", "tr_invalid")
			return
		}
	}
	result, trace, err := h.service.AdvanceWorkflow(r.Context(), userID, segment(path, 2), virtualNow)
	if err != nil {
		writeServiceError(w, err, trace)
		return
	}
	response := envelope(result, trace)
	h.saveReplay(r, userID, path, fp, http.StatusOK, response)
	writeJSON(w, http.StatusOK, response)
}

func (h *Handler) audit(w http.ResponseWriter, r *http.Request, userID, path string) {
	traceID := segment(path, 2)
	events, err := h.service.Audit(r.Context(), userID, traceID)
	if err != nil {
		writeServiceError(w, err, traceID)
		return
	}
	writeJSON(w, http.StatusOK, envelope(map[string]any{"trace_id": traceID, "events": events}, traceID))
}

func (h *Handler) replay(w http.ResponseWriter, r *http.Request, userID, path, fingerprint string) bool {
	key := strings.TrimSpace(r.Header.Get("Idempotency-Key"))
	if len(key) < 8 || len(key) > 128 {
		writeError(w, http.StatusBadRequest, "INVALID_ARGUMENT", "Idempotency-Key 长度必须为 8 到 128 个字符", "tr_invalid")
		return true
	}
	response, status, err := h.service.Idempotency(r.Context(), userID, r.Method, path, key, fingerprint)
	if err != nil {
		writeServiceError(w, err, "tr_idempotency")
		return true
	}
	if response != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_, _ = w.Write(response)
		return true
	}
	return false
}

func (h *Handler) saveReplay(r *http.Request, userID, path, fingerprint string, status int, response any) {
	key := strings.TrimSpace(r.Header.Get("Idempotency-Key"))
	if key == "" {
		return
	}
	data, err := json.Marshal(response)
	if err != nil {
		return
	}
	_ = h.service.SaveIdempotency(r.Context(), userID, r.Method, path, key, fingerprint, status, data)
}

func segment(path string, index int) string {
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if index >= len(parts) {
		return ""
	}
	return parts[index]
}

func readBody(r *http.Request) ([]byte, error) { return io.ReadAll(io.LimitReader(r.Body, 1<<20)) }
func decodeJSON(r *http.Request, target any) ([]byte, error) {
	body, err := readBody(r)
	if err != nil {
		return nil, err
	}
	if len(bytes.TrimSpace(body)) == 0 {
		return nil, errors.New("empty body")
	}
	if err := decodeBody(body, target); err != nil {
		return nil, err
	}
	return body, nil
}

func decodeBody(body []byte, target any) error {
	decoder := json.NewDecoder(bytes.NewReader(body))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return err
	}
	if err := decoder.Decode(&struct{}{}); err != io.EOF {
		return errors.New("request body must contain one JSON object")
	}
	return nil
}

func fingerprint(body []byte) string { sum := sha256.Sum256(body); return hex.EncodeToString(sum[:]) }
func envelope(data any, trace string) map[string]any {
	return map[string]any{"data": data, "trace_id": trace}
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
func writeError(w http.ResponseWriter, status int, code, message, trace string) {
	writeJSON(w, status, map[string]any{"error": map[string]string{"code": code, "message": message}, "trace_id": trace})
}
func writeServiceError(w http.ResponseWriter, err error, trace string) {
	if trace == "" {
		trace = domain.NewID("tr")
	}
	switch {
	case errors.Is(err, domain.ErrNotFound):
		writeError(w, http.StatusNotFound, "NOT_FOUND", "资源不存在", trace)
	case errors.Is(err, domain.ErrForbidden):
		writeError(w, http.StatusForbidden, "PERMISSION_DENIED", "无权访问资源", trace)
	case errors.Is(err, domain.ErrActionExpired):
		writeError(w, http.StatusGone, "ACTION_EXPIRED", "动作已过期", trace)
	case errors.Is(err, domain.ErrActionStateConflict):
		writeError(w, http.StatusConflict, "ACTION_STATE_CONFLICT", "动作当前状态不允许此操作", trace)
	case errors.Is(err, domain.ErrIdempotencyConflict):
		writeError(w, http.StatusConflict, "IDEMPOTENCY_CONFLICT", "幂等键已用于不同请求", trace)
	case errors.Is(err, domain.ErrBudgetNotReserved):
		writeError(w, http.StatusConflict, "BUDGET_NOT_RESERVED", "预算未锁定或锁定额度不足", trace)
	case errors.Is(err, domain.ErrMFAInvalid):
		writeError(w, http.StatusUnprocessableEntity, "MFA_INVALID", "验证码错误", trace)
	case errors.Is(err, domain.ErrMFALocked):
		writeError(w, http.StatusLocked, "MFA_LOCKED", "MFA 错误次数达到上限", trace)
	case errors.Is(err, domain.ErrInsufficientBalance):
		writeError(w, http.StatusUnprocessableEntity, "INSUFFICIENT_BALANCE", "余额不足，账本未发生变化", trace)
	case errors.Is(err, domain.ErrInvalidArgument):
		writeError(w, http.StatusBadRequest, "INVALID_ARGUMENT", "请求参数无效", trace)
	default:
		writeError(w, http.StatusInternalServerError, "INTERNAL", "服务内部错误", trace)
	}
}
