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

	"github.com/cffa-as/bankagent/internal/agent"
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
	ErrBudgetNotReserved   = errors.New("workflow budget not reserved")
	ErrIdempotencyConflict = errors.New("idempotency conflict")
)

type Conversation struct {
	ID        string    `json:"conversation_id"`
	UserID    string    `json:"-"`
	CreatedAt time.Time `json:"created_at"`
}

type ConversationMessage struct {
	ID             string    `json:"message_id"`
	ConversationID string    `json:"conversation_id"`
	UserID         string    `json:"-"`
	Role           string    `json:"role"`
	Text           string    `json:"text"`
	CreatedAt      time.Time `json:"created_at"`
}

type Account struct {
	ID             string `json:"account_id"`
	UserID         string `json:"-"`
	Currency       string `json:"currency"`
	BalanceMinor   int64  `json:"balance_minor"`
	ReservedMinor  int64  `json:"reserved_minor"`
	AvailableMinor int64  `json:"available_minor"`
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

type TransferResult struct {
	TransactionID string `json:"transaction_id"`
	AmountMinor   int64  `json:"amount_minor"`
	Currency      string `json:"currency"`
}

type InvestmentPurchaseResult struct {
	HoldingID   string `json:"holding_id"`
	ProductID   string `json:"product_id"`
	AmountMinor int64  `json:"amount_minor"`
	Currency    string `json:"currency"`
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

type BillAnomaly struct {
	TransactionID string `json:"transaction_id"`
	AmountMinor   int64  `json:"amount_minor"`
	Category      string `json:"category"`
	Description   string `json:"description"`
	Reason        string `json:"reason"`
}

type BillSummary struct {
	Month            string         `json:"month"`
	Period           string         `json:"period,omitempty"`
	TotalMinor       int64          `json:"total_minor"`
	Currency         string         `json:"currency"`
	TransactionCount int64          `json:"transaction_count"`
	Categories       []BillCategory `json:"categories"`
	Anomalies        []BillAnomaly  `json:"anomalies,omitempty"`
}

type SubscriptionReminder struct {
	SubscriptionID string    `json:"subscription_id"`
	MerchantRef    string    `json:"merchant_ref"`
	AmountMinor    int64     `json:"amount_minor"`
	Currency       string    `json:"currency"`
	NextChargeAt   time.Time `json:"next_charge_at"`
	DaysUntil      int       `json:"days_until"`
}

type CashflowEvent struct {
	ID          string    `json:"cashflow_event_id"`
	UserID      string    `json:"-"`
	Direction   string    `json:"direction"`
	AmountMinor int64     `json:"amount_minor"`
	Currency    string    `json:"currency"`
	Category    string    `json:"category"`
	Description string    `json:"description"`
	Essential   bool      `json:"essential"`
	ExpectedAt  time.Time `json:"expected_at"`
	Frequency   string    `json:"frequency"`
	Status      string    `json:"status"`
}

type ScheduledCashflow struct {
	ActionID    string    `json:"action_id"`
	AmountMinor int64     `json:"amount_minor"`
	Currency    string    `json:"currency"`
	ScheduledAt time.Time `json:"scheduled_at"`
	Description string    `json:"description"`
}

type HistoricalSpending struct {
	AverageDailyMinor      int64 `json:"average_daily_minor"`
	ConservativeDailyMinor int64 `json:"conservative_daily_minor"`
}

type LiquidityTimelinePoint struct {
	Date           string `json:"date"`
	AvailableMinor int64  `json:"available_minor"`
}

type LiquidityScenario struct {
	Name                    string                   `json:"name"`
	DailyDiscretionaryMinor int64                    `json:"daily_discretionary_minor"`
	EndingAvailableMinor    int64                    `json:"ending_available_minor"`
	MinimumAvailableMinor   int64                    `json:"minimum_available_minor"`
	MinimumDate             string                   `json:"minimum_date"`
	Status                  string                   `json:"status"`
	Points                  []LiquidityTimelinePoint `json:"points"`
}

type LiquidityEvent struct {
	Date        string `json:"date"`
	Kind        string `json:"kind"`
	Direction   string `json:"direction"`
	Description string `json:"description"`
	AmountMinor int64  `json:"amount_minor"`
	Essential   bool   `json:"essential"`
	SourceID    string `json:"source_id,omitempty"`
}

type LiquiditySimulation struct {
	ID                        string              `json:"simulation_id"`
	UserID                    string              `json:"-"`
	AccountID                 string              `json:"account_id"`
	TraceID                   string              `json:"trace_id"`
	Currency                  string              `json:"currency"`
	StartAt                   time.Time           `json:"start_at"`
	HorizonDays               int                 `json:"horizon_days"`
	StartingAvailableMinor    int64               `json:"starting_available_minor"`
	ProposedBudgetMinor       int64               `json:"proposed_budget_minor"`
	EssentialBufferMinor      int64               `json:"essential_buffer_minor"`
	HistoricalAverageDaily    int64               `json:"historical_average_daily_minor"`
	HistoricalConservativeDay int64               `json:"historical_conservative_daily_minor"`
	MaximumSafeBudgetMinor    int64               `json:"maximum_safe_budget_minor"`
	Verdict                   string              `json:"verdict"`
	RiskReason                string              `json:"risk_reason"`
	Recommendation            string              `json:"recommendation"`
	Assumptions               []string            `json:"assumptions"`
	Events                    []LiquidityEvent    `json:"events"`
	Scenarios                 []LiquidityScenario `json:"scenarios"`
	CreatedAt                 time.Time           `json:"created_at"`
}

type SplitParticipant struct {
	Name        string `json:"name,omitempty"`
	Phone       string `json:"phone,omitempty"`
	IsPayer     bool   `json:"is_payer,omitempty"`
	AmountMinor int64  `json:"amount_minor"`
}

type TransferSplit struct {
	ID               string             `json:"transfer_split_id"`
	ConversationID   string             `json:"conversation_id"`
	TotalAmountMinor int64              `json:"total_amount_minor"`
	CollectibleMinor int64              `json:"collectible_minor"`
	Currency         string             `json:"currency"`
	Participants     []SplitParticipant `json:"participants"`
	Status           string             `json:"status"`
	CreatedAt        time.Time          `json:"created_at"`
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
	RunID     string               `json:"run_id"`
	ReplyType string               `json:"reply_type"`
	Text      string               `json:"text"`
	Action    *Action              `json:"action,omitempty"`
	Balance   *Account             `json:"balance,omitempty"`
	Records   []Transaction        `json:"transactions,omitempty"`
	Bill      *BillSummary         `json:"bill,omitempty"`
	Data      any                  `json:"data,omitempty"`
	Workflow  *Workflow            `json:"workflow,omitempty"`
	Liquidity *LiquiditySimulation `json:"liquidity,omitempty"`
}

type Service struct {
	repo  Repository
	now   func() time.Time
	model agent.ModelClient
}

// Repository is the small persistence boundary used by the domain service.
type Repository interface {
	Seed(context.Context, time.Time) error
	CreateConversation(context.Context, Conversation) error
	ConversationOwner(context.Context, string) (string, error)
	ConversationMessages(context.Context, string, string, int) ([]ConversationMessage, error)
	AddConversationMessage(context.Context, ConversationMessage) error
	Account(context.Context, string) (Account, error)
	Transactions(context.Context, string) ([]Transaction, error)
	Products(context.Context, string) ([]Product, error)
	Product(context.Context, string) (Product, error)
	Holdings(context.Context, string) ([]Holding, error)
	ActiveHolding(context.Context, string, string) (Holding, error)
	Cards(context.Context, string) ([]Card, error)
	Subscriptions(context.Context, string, string) ([]Subscription, error)
	CashflowEvents(context.Context, string) ([]CashflowEvent, error)
	ScheduledCashflows(context.Context, string, time.Time) ([]ScheduledCashflow, error)
	HistoricalSpending(context.Context, string, time.Time, time.Time) (HistoricalSpending, error)
	CreateLiquiditySimulation(context.Context, LiquiditySimulation) error
	LiquiditySimulation(context.Context, string, string) (LiquiditySimulation, error)
	BillSummary(context.Context, string, time.Time) (BillSummary, error)
	BillSummaryRange(context.Context, string, time.Time, time.Time, string) (BillSummary, error)
	DailyOutgoing(context.Context, string, time.Time) (int64, error)
	Beneficiary(context.Context, string, string) (string, error)
	BeneficiaryByPhone(context.Context, string, string) (string, string, error)
	CreateAction(context.Context, Action) error
	Action(context.Context, string) (Action, error)
	UpdateAction(context.Context, Action) error
	ExecuteTransfer(context.Context, Action, int64, string, time.Time) (TransferResult, error)
	ExecuteInvestmentPurchase(context.Context, Action, string, int64, time.Time) (InvestmentPurchaseResult, error)
	ExecuteInvestmentRedemption(context.Context, Action, string, time.Time) (RedemptionResult, error)
	ExecuteCardStatus(context.Context, Action, string, string, time.Time) error
	ExecuteCardApplication(context.Context, Action, string, time.Time) (Card, error)
	ExecuteCardLimit(context.Context, Action, string, int64, time.Time) error
	ExecuteSubscriptionCancel(context.Context, Action, string, time.Time) error
	ExecuteTransferSplit(context.Context, Action, TransferSplitSnapshot, time.Time) (TransferSplit, error)
	CancelAction(context.Context, string, time.Time) (bool, error)
	ScheduleAction(context.Context, string, string, time.Time) (bool, error)
	RecordMFAFailure(context.Context, string, time.Time) (int, bool, error)
	AddAudit(context.Context, AuditEvent) error
	Audit(context.Context, string) ([]AuditEvent, error)
	Idempotency(context.Context, string, string, string, string, string) ([]byte, int, error)
	SaveIdempotency(context.Context, string, string, string, string, string, int, []byte, time.Time) error
	CreateWorkflow(context.Context, Workflow) error
	Workflows(context.Context, string) ([]Workflow, error)
	Workflow(context.Context, string, string) (Workflow, error)
	WorkflowOwner(context.Context, string) (string, error)
	CancelWorkflow(context.Context, string, string, time.Time) error
	ExpireWorkflow(context.Context, string, string, time.Time) error
	CompleteWorkflowNode(context.Context, string, string, time.Time) error
	FailWorkflowNode(context.Context, string, string, time.Time) error
	CancelWorkflowNode(context.Context, string, string, time.Time) error
	SetWorkflowNodeAction(context.Context, string, string, string, string, time.Time) error
	ExecuteWorkflowBudgetLock(context.Context, Action, string, string, int64, time.Time) error
	ExecuteWorkflowOrder(context.Context, Action, string, string, int64, string, time.Time) error
}

type TransferSplitSnapshot struct {
	TotalAmountMinor int64              `json:"total_amount_minor"`
	Currency         string             `json:"currency"`
	Participants     []SplitParticipant `json:"participants"`
}

func NewService(repo Repository, now func() time.Time) *Service {
	if now == nil {
		now = time.Now
	}
	return &Service{repo: repo, now: now}
}

func (s *Service) SetModelClient(client agent.ModelClient) { s.model = client }

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

func parseBirthdayPlan(text string) (budgetMinor int64, eventAt time.Time, ok bool) {
	budgetMatches := regexp.MustCompile(`预算\s*([0-9]+(?:\.[0-9]{1,2})?)\s*元`).FindAllStringSubmatch(strings.TrimSpace(text), -1)
	dateMatches := regexp.MustCompile(`(20[0-9]{2}-[0-9]{2}-[0-9]{2})`).FindAllStringSubmatch(text, -1)
	if len(budgetMatches) == 0 || len(dateMatches) == 0 {
		return 0, time.Time{}, false
	}
	amount, err := strconv.ParseFloat(budgetMatches[len(budgetMatches)-1][1], 64)
	if err != nil || amount <= 0 {
		return 0, time.Time{}, false
	}
	loc, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		return 0, time.Time{}, false
	}
	eventAt, err = time.ParseInLocation("2006-01-02", dateMatches[len(dateMatches)-1][1], loc)
	if err != nil {
		return 0, time.Time{}, false
	}
	return int64(amount*100 + 0.5), eventAt, true
}

func parsePhoneTransfer(text string) (phone string, amountMinor int64, remark string, ok bool) {
	pattern := regexp.MustCompile(`(?:手机号|手机|电话)\s*([0-9]{11}).*?转(?:账)?\s*([0-9]+(?:\.[0-9]{1,2})?)\s*元(?:[，,。 ]*备注\s*(.*))?$`)
	matches := pattern.FindStringSubmatch(strings.TrimSpace(text))
	if len(matches) == 0 {
		return "", 0, "", false
	}
	amount, err := strconv.ParseFloat(matches[2], 64)
	if err != nil || amount <= 0 {
		return "", 0, "", false
	}
	return matches[1], int64(amount*100 + 0.5), strings.TrimSpace(matches[3]), true
}

func parseTransfer(text string) (name string, amountMinor int64, remark string, ok bool) {
	pattern := regexp.MustCompile(`给\s*(.+?)\s*转(?:账)?\s*([0-9]+(?:\.[0-9]{1,2})?)\s*元(?:[，,。 ]*备注\s*(.*))?$`)
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
