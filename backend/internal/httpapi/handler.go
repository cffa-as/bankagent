package httpapi

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
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

func (h *Handler) billSummary(w http.ResponseWriter, r *http.Request, userID, path string) {
	accountID := segment(path, 2)
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
	action, err := h.service.GetAction(r.Context(), userID, actionID)
	if err != nil {
		writeServiceError(w, err, "tr_action")
		return
	}
	writeJSON(w, http.StatusOK, envelope(action, "tr_action"))
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
	if err := json.Unmarshal(body, target); err != nil {
		return nil, err
	}
	return body, nil
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
