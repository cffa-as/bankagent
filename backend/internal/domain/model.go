package domain

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"
)

const DemoUserID = "user_demo"

var (
	ErrNotFound            = errors.New("not found")
	ErrForbidden           = errors.New("forbidden")
	ErrInvalidArgument     = errors.New("invalid argument")
	ErrActionStateConflict = errors.New("action state conflict")
	ErrActionExpired       = errors.New("action expired")
	ErrMFAInvalid          = errors.New("mfa invalid")
	ErrMFALocked           = errors.New("mfa locked")
	ErrInsufficientBalance = errors.New("insufficient balance")
	ErrIdempotencyConflict = errors.New("idempotency conflict")
)

type Conversation struct {
	ID        string    `json:"conversation_id"`
	UserID    string    `json:"-"`
	CreatedAt time.Time `json:"created_at"`
}

type Account struct {
	ID           string `json:"account_id"`
	UserID       string `json:"-"`
	Currency     string `json:"currency"`
	BalanceMinor int64  `json:"balance_minor"`
}

type Transaction struct {
	ID          string    `json:"transaction_id"`
	Direction   string    `json:"direction"`
	AmountMinor int64     `json:"amount_minor"`
	Category    string    `json:"category,omitempty"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"created_at"`
}

type TransactionPage struct {
	Items    []Transaction `json:"items"`
	Page     int           `json:"page"`
	PageSize int           `json:"page_size"`
	Total    int           `json:"total"`
}

type Product struct {
	ID                 string `json:"product_id"`
	Name               string `json:"name"`
	RiskLevel          string `json:"risk_level"`
	MinimumAmountMinor int64  `json:"minimum_amount_minor"`
	TermDays           int    `json:"term_days"`
	BenchmarkNote      string `json:"benchmark_note"`
	AnnualRateBPS      int64  `json:"annual_rate_bps"`
}

type ProductPage struct {
	Items    []Product `json:"items"`
	Page     int       `json:"page"`
	PageSize int       `json:"page_size"`
	Total    int       `json:"total"`
}

type RedemptionResult struct {
	HoldingID     string
	Principal     int64
	ProfitMinor   int64
	TotalMinor    int64
	DaysHeld      int64
	AnnualRateBPS int64
}

type Holding struct {
	ID          string    `json:"holding_id"`
	ProductID   string    `json:"product_id"`
	ProductName string    `json:"product_name"`
	AmountMinor int64     `json:"amount_minor"`
	Status      string    `json:"status"`
	PurchasedAt time.Time `json:"purchased_at"`
}

type Card struct {
	ID           string   `json:"card_id"`
	MaskedNumber string   `json:"masked_number"`
	Status       string   `json:"status"`
	LimitMinor   int64    `json:"limit_minor"`
	Restrictions []string `json:"restrictions"`
}

type Subscription struct {
	ID           string    `json:"subscription_id"`
	MerchantRef  string    `json:"merchant_ref"`
	Status       string    `json:"status"`
	AmountMinor  int64     `json:"amount_minor"`
	Currency     string    `json:"currency"`
	BillingCycle string    `json:"billing_cycle"`
	NextChargeAt time.Time `json:"next_charge_at"`
}

type BillCategory struct {
	Category    string `json:"category"`
	AmountMinor int64  `json:"amount_minor"`
	Count       int64  `json:"count"`
	ShareBPS    int64  `json:"share_bps"`
}

type BillSummary struct {
	Month            string         `json:"month"`
	TotalMinor       int64          `json:"total_minor"`
	Currency         string         `json:"currency"`
	TransactionCount int64          `json:"transaction_count"`
	Categories       []BillCategory `json:"categories"`
}

type Action struct {
	ID             string    `json:"action_id"`
	ConversationID string    `json:"conversation_id"`
	UserID         string    `json:"-"`
	Kind           string    `json:"kind"`
	RiskLevel      string    `json:"risk_level"`
	Status         string    `json:"status"`
	SnapshotJSON   string    `json:"-"`
	Snapshot       any       `json:"snapshot,omitempty"`
	ResultJSON     string    `json:"-"`
	Result         any       `json:"result,omitempty"`
	ExpiresAt      time.Time `json:"expires_at"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
	MFAAttempts    int       `json:"mfa_attempts,omitempty"`
}

func (a Action) Public() Action {
	a.UserID = ""
	if a.Snapshot == nil && a.SnapshotJSON != "" {
		_ = json.Unmarshal([]byte(a.SnapshotJSON), &a.Snapshot)
	}
	if a.Result == nil && a.ResultJSON != "" {
		_ = json.Unmarshal([]byte(a.ResultJSON), &a.Result)
	}
	a.SnapshotJSON = ""
	a.ResultJSON = ""
	a.MFAAttempts = 0
	return a
}

type AuditEvent struct {
	ID             string         `json:"event_id"`
	TraceID        string         `json:"trace_id"`
	ConversationID string         `json:"conversation_id,omitempty"`
	ActionID       string         `json:"action_id,omitempty"`
	EventType      string         `json:"event_type"`
	Outcome        string         `json:"outcome"`
	Actor          string         `json:"actor"`
	Detail         map[string]any `json:"detail"`
	OccurredAt     time.Time      `json:"occurred_at"`
	Sequence       int64          `json:"sequence"`
}

type MessageResult struct {
	RunID     string        `json:"run_id"`
	ReplyType string        `json:"reply_type"`
	Text      string        `json:"text"`
	Action    *Action       `json:"action,omitempty"`
	Balance   *Account      `json:"balance,omitempty"`
	Records   []Transaction `json:"transactions,omitempty"`
	Bill      *BillSummary  `json:"bill,omitempty"`
}

type Service struct {
	repo Repository
	now  func() time.Time
}

// Repository is the small persistence boundary used by the domain service.
type Repository interface {
	Seed(context.Context, time.Time) error
	CreateConversation(context.Context, Conversation) error
	ConversationOwner(context.Context, string) (string, error)
	Account(context.Context, string) (Account, error)
	Transactions(context.Context, string) ([]Transaction, error)
	Products(context.Context, string) ([]Product, error)
	Product(context.Context, string) (Product, error)
	Holdings(context.Context, string) ([]Holding, error)
	ActiveHolding(context.Context, string, string) (Holding, error)
	Cards(context.Context, string) ([]Card, error)
	Subscriptions(context.Context, string, string) ([]Subscription, error)
	BillSummary(context.Context, string, time.Time) (BillSummary, error)
	DailyOutgoing(context.Context, string, time.Time) (int64, error)
	Beneficiary(context.Context, string, string) (string, error)
	CreateAction(context.Context, Action) error
	Action(context.Context, string) (Action, error)
	UpdateAction(context.Context, Action) error
	ExecuteTransfer(context.Context, Action, int64, string, time.Time) error
	ExecuteInvestmentPurchase(context.Context, Action, string, int64, time.Time) error
	ExecuteInvestmentRedemption(context.Context, Action, string, time.Time) (RedemptionResult, error)
	ExecuteCardStatus(context.Context, Action, string, string, time.Time) error
	ExecuteSubscriptionCancel(context.Context, Action, string, time.Time) error
	CancelAction(context.Context, string, time.Time) (bool, error)
	RecordMFAFailure(context.Context, string, time.Time) (int, bool, error)
	AddAudit(context.Context, AuditEvent) error
	Audit(context.Context, string) ([]AuditEvent, error)
	Idempotency(context.Context, string, string, string, string, string) ([]byte, int, error)
	SaveIdempotency(context.Context, string, string, string, string, string, int, []byte, time.Time) error
}

func NewService(repo Repository, now func() time.Time) *Service {
	if now == nil {
		now = time.Now
	}
	return &Service{repo: repo, now: now}
}

func (s *Service) Seed() error { return s.repo.Seed(context.Background(), s.now()) }

func NewID(prefix string) string {
	var raw [8]byte
	if _, err := rand.Read(raw[:]); err != nil {
		panic(err)
	}
	return prefix + "_" + hex.EncodeToString(raw[:])
}

func parseInvestmentPurchase(text string) (amountMinor int64, ok bool) {
	pattern := regexp.MustCompile(`申购.*?([0-9]+(?:\.[0-9]{1,2})?)\s*元`)
	matches := pattern.FindStringSubmatch(strings.TrimSpace(text))
	if len(matches) == 0 {
		return 0, false
	}
	amount, err := strconv.ParseFloat(matches[1], 64)
	if err != nil || amount <= 0 {
		return 0, false
	}
	return int64(amount*100 + 0.5), true
}

func parseTransfer(text string) (name string, amountMinor int64, remark string, ok bool) {
	pattern := regexp.MustCompile(`给\s*(.+?)\s*转\s*([0-9]+(?:\.[0-9]{1,2})?)\s*元(?:[，,。 ]*备注\s*(.*))?$`)
	matches := pattern.FindStringSubmatch(strings.TrimSpace(text))
	if len(matches) == 0 {
		return "", 0, "", false
	}
	amount, err := strconv.ParseFloat(matches[2], 64)
	if err != nil || amount <= 0 {
		return "", 0, "", false
	}
	return strings.TrimSpace(matches[1]), int64(amount*100 + 0.5), strings.TrimSpace(matches[3]), true
}

func yuan(minor int64) string { return fmt.Sprintf("%.2f", float64(minor)/100) }
