package domain

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

const (
	defaultLiquidityHorizonDays = 30
	maxLiquidityHorizonDays     = 366
	defaultEssentialBufferMinor = 100000
)

func (s *Service) CreateLiquiditySimulation(ctx context.Context, userID, accountID string, horizonDays int, proposedBudgetMinor int64, essentialBufferMinor *int64) (LiquiditySimulation, string, error) {
	return s.createLiquiditySimulationAt(ctx, userID, accountID, horizonDays, proposedBudgetMinor, essentialBufferMinor, s.now())
}

func (s *Service) createLiquiditySimulationAt(ctx context.Context, userID, accountID string, horizonDays int, proposedBudgetMinor int64, essentialBufferMinor *int64, at time.Time) (LiquiditySimulation, string, error) {
	if horizonDays == 0 {
		horizonDays = defaultLiquidityHorizonDays
	}
	buffer := int64(defaultEssentialBufferMinor)
	if essentialBufferMinor != nil {
		buffer = *essentialBufferMinor
	}
	if strings.TrimSpace(accountID) == "" || horizonDays < 1 || horizonDays > maxLiquidityHorizonDays || proposedBudgetMinor < 0 || proposedBudgetMinor > 1e15 || buffer < 0 || buffer > 1e15 {
		return LiquiditySimulation{}, "", ErrInvalidArgument
	}
	account, err := s.repo.Account(ctx, userID)
	if errors.Is(err, sql.ErrNoRows) {
		return LiquiditySimulation{}, "", ErrNotFound
	}
	if err != nil {
		return LiquiditySimulation{}, "", err
	}
	if account.ID != accountID {
		return LiquiditySimulation{}, "", ErrForbidden
	}
	loc, err := time.LoadLocation("Asia/Shanghai")
	if err != nil {
		return LiquiditySimulation{}, "", err
	}
	now := at.In(loc)
	startAt := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
	historyAnchor := s.now().In(loc)
	historyStart := historyAnchor.AddDate(0, 0, -30)
	profile, err := s.repo.HistoricalSpending(ctx, userID, historyStart, historyAnchor)
	if err != nil {
		return LiquiditySimulation{}, "", err
	}
	cashflowEvents, err := s.repo.CashflowEvents(ctx, userID)
	if err != nil {
		return LiquiditySimulation{}, "", err
	}
	subscriptions, err := s.repo.Subscriptions(ctx, userID, "active")
	if err != nil {
		return LiquiditySimulation{}, "", err
	}
	scheduledTransfers, err := s.repo.ScheduledCashflows(ctx, userID, now)
	if err != nil {
		return LiquiditySimulation{}, "", err
	}
	events := liquidityEvents(startAt, horizonDays, account.Currency, cashflowEvents, subscriptions, scheduledTransfers)
	proposedEvent := LiquidityEvent{
		Date: startAt.Format("2006-01-02"), Kind: "proposed_budget", Direction: "out",
		Description: "计划预留预算", AmountMinor: proposedBudgetMinor, SourceID: "proposed_budget",
	}
	withProposal := append(append([]LiquidityEvent{}, events...), proposedEvent)
	sortLiquidityEvents(withProposal)
	baseEvents := append([]LiquidityEvent{}, events...)
	sortLiquidityEvents(baseEvents)

	expectedBase := projectLiquidityScenario("expected", profile.AverageDailyMinor, account.AvailableMinor, startAt, horizonDays, buffer, baseEvents)
	conservativeBase := projectLiquidityScenario("conservative", profile.ConservativeDailyMinor, account.AvailableMinor, startAt, horizonDays, buffer, baseEvents)
	incomeStressBase := projectLiquidityScenario("income_stress", profile.ConservativeDailyMinor, account.AvailableMinor, startAt, horizonDays, buffer, withoutInflows(baseEvents))
	baseMinimum := min(expectedBase.MinimumAvailableMinor, conservativeBase.MinimumAvailableMinor, incomeStressBase.MinimumAvailableMinor)
	maxSafeBudget := baseMinimum - buffer
	if maxSafeBudget < 0 {
		maxSafeBudget = 0
	}
	if maxSafeBudget > account.AvailableMinor {
		maxSafeBudget = account.AvailableMinor
	}
	scenarios := []LiquidityScenario{
		projectLiquidityScenario("essential_only", 0, account.AvailableMinor, startAt, horizonDays, buffer, withProposal),
		projectLiquidityScenario("expected", profile.AverageDailyMinor, account.AvailableMinor, startAt, horizonDays, buffer, withProposal),
		projectLiquidityScenario("conservative", profile.ConservativeDailyMinor, account.AvailableMinor, startAt, horizonDays, buffer, withProposal),
		projectLiquidityScenario("income_stress", profile.ConservativeDailyMinor, account.AvailableMinor, startAt, horizonDays, buffer, withoutInflows(withProposal)),
	}
	expected, conservative, incomeStress := scenarios[1], scenarios[2], scenarios[3]
	verdict := combineLiquidityStatus(expected.Status, conservative.Status, incomeStress.Status)
	alternatives := buildLiquidityAlternatives(startAt, horizonDays, profile, account.AvailableMinor, proposedBudgetMinor, maxSafeBudget, buffer, baseEvents)
	recommendedAlternativeID := ""
	if len(alternatives) > 0 {
		best := -1
		for i := range alternatives {
			if alternatives[i].Conditional || alternatives[i].Status == "unsafe" {
				continue
			}
			if best == -1 {
				best = i
				continue
			}
			candidate, current := alternatives[i], alternatives[best]
			if alternativeRiskRank(candidate.Status) < alternativeRiskRank(current.Status) ||
				(alternativeRiskRank(candidate.Status) == alternativeRiskRank(current.Status) && candidate.ConservativeMinimumAvailable > current.ConservativeMinimumAvailable) ||
				(alternativeRiskRank(candidate.Status) == alternativeRiskRank(current.Status) && candidate.ConservativeMinimumAvailable == current.ConservativeMinimumAvailable && candidate.TotalBudgetMinor > current.TotalBudgetMinor) {
				best = i
			}
		}
		if best >= 0 {
			alternatives[best].Recommended = true
			recommendedAlternativeID = alternatives[best].ID
		}
	}
	riskReason := liquidityRiskReason(verdict, expected, conservative, incomeStress, withProposal)
	trace := NewID("tr")
	simulation := LiquiditySimulation{
		ID: NewID("liq"), UserID: userID, AccountID: account.ID, Currency: account.Currency,
		StartAt: startAt, HorizonDays: horizonDays, StartingAvailableMinor: account.AvailableMinor,
		ProposedBudgetMinor: proposedBudgetMinor, EssentialBufferMinor: buffer,
		HistoricalAverageDaily: profile.AverageDailyMinor, HistoricalConservativeDay: profile.ConservativeDailyMinor,
		MaximumSafeBudgetMinor: maxSafeBudget, Verdict: verdict, RiskReason: riskReason,
		IncomeStressMinimumMinor: incomeStress.MinimumAvailableMinor, IncomeStressMinimumDate: incomeStress.MinimumDate,
		IncomeStressStatus: incomeStress.Status, DependsOnUnconfirmedIncome: expected.Status != "unsafe" && incomeStress.Status == "unsafe",
		Recommendation: liquidityRecommendation(verdict, maxSafeBudget, buffer, account.Currency),
		Assumptions: []string{
			"工资、房租、还款和保险按预置现金流计划展开。",
			"活跃订阅和已确认的预约转账计入预测。",
			"收入压力情景假设预测期内的收入均未按时到账。",
			fmt.Sprintf("预期情景按过去30天可支配消费日均 %s %s 计算。", yuan(profile.AverageDailyMinor), account.Currency),
			fmt.Sprintf("保守情景按过去30天最高单日可支配消费 %s %s 计算。", yuan(profile.ConservativeDailyMinor), account.Currency),
			"计划预算在预测起点即从可用余额中占用。",
		},
		Events: withProposal, Scenarios: scenarios, Alternatives: alternatives,
		RecommendedAlternativeID: recommendedAlternativeID, TraceID: trace, CreatedAt: s.now(),
	}
	event := newAuditEvent(trace, "", "", "liquidity_simulation_completed", "succeeded", "tool", map[string]any{
		"simulation_id": simulation.ID, "account_id": account.ID, "horizon_days": horizonDays,
		"proposed_budget_minor": proposedBudgetMinor, "verdict": verdict,
		"minimum_expected_minor": expected.MinimumAvailableMinor, "minimum_income_stress_minor": incomeStress.MinimumAvailableMinor,
		"maximum_safe_budget_minor": maxSafeBudget,
	}, simulation.CreatedAt)
	if err := s.repo.CreateLiquiditySimulation(ctx, simulation, event); err != nil {
		return LiquiditySimulation{}, trace, err
	}
	return simulation, trace, nil
}

func (s *Service) GetLiquiditySimulation(ctx context.Context, userID, id string) (LiquiditySimulation, string, error) {
	simulation, err := s.repo.LiquiditySimulation(ctx, userID, id)
	return simulation, simulation.TraceID, err
}

func (s *Service) enforceWorkflowBudgetLiquidity(ctx context.Context, action *Action, trace string, now time.Time) error {
	if action.Kind != "workflow_budget_lock" {
		return nil
	}
	var snapshot struct {
		WorkflowID  string `json:"workflow_id"`
		NodeID      string `json:"node_id"`
		AmountMinor int64  `json:"amount_minor"`
	}
	if err := json.Unmarshal([]byte(action.SnapshotJSON), &snapshot); err != nil {
		return err
	}
	workflow, err := s.repo.Workflow(ctx, snapshot.WorkflowID, action.UserID)
	if err != nil {
		return err
	}
	account, err := s.repo.Account(ctx, action.UserID)
	if err != nil {
		return err
	}
	simulation, _, err := s.createLiquiditySimulationAt(ctx, action.UserID, account.ID, liquidityHorizonDays(now, workflow.Deadline), snapshot.AmountMinor, nil, now)
	if err != nil {
		return err
	}
	if simulation.Verdict != "unsafe" {
		return nil
	}
	action.Status, action.UpdatedAt = "failed", now
	if err := s.repo.UpdateAction(ctx, *action); err != nil {
		return err
	}
	if err := s.failWorkflowAction(ctx, action, now); err != nil {
		return err
	}
	if err := s.audit(ctx, trace, action.ConversationID, action.ID, "workflow_budget_liquidity_blocked", "failed", "system", map[string]any{
		"workflow_id": snapshot.WorkflowID, "node_id": snapshot.NodeID, "simulation_id": simulation.ID,
		"minimum_expected_minor": simulation.Scenarios[1].MinimumAvailableMinor,
	}, now); err != nil {
		return err
	}
	return ErrActionStateConflict
}

func liquidityEvents(startAt time.Time, horizonDays int, currency string, cashflows []CashflowEvent, subscriptions []Subscription, transfers []ScheduledCashflow) []LiquidityEvent {
	endAt := startAt.AddDate(0, 0, horizonDays)
	var events []LiquidityEvent
	for _, cashflow := range cashflows {
		if cashflow.Status != "active" || cashflow.Currency != currency || cashflow.AmountMinor <= 0 {
			continue
		}
		for _, occurredAt := range recurringDates(cashflow.ExpectedAt, cashflow.Frequency, startAt, endAt) {
			events = append(events, LiquidityEvent{
				Date: occurredAt.Format("2006-01-02"), Kind: cashflow.Category, Direction: cashflow.Direction,
				Description: cashflow.Description, AmountMinor: cashflow.AmountMinor, Essential: cashflow.Essential, SourceID: cashflow.ID,
			})
		}
	}
	for _, subscription := range subscriptions {
		if subscription.Currency != currency || subscription.AmountMinor <= 0 {
			continue
		}
		for _, occurredAt := range recurringDates(subscription.NextChargeAt, subscription.BillingCycle, startAt, endAt) {
			events = append(events, LiquidityEvent{
				Date: occurredAt.Format("2006-01-02"), Kind: "subscription", Direction: "out",
				Description: subscription.MerchantRef, AmountMinor: subscription.AmountMinor, SourceID: subscription.ID,
			})
		}
	}
	for _, transfer := range transfers {
		if transfer.Currency != currency || transfer.AmountMinor <= 0 || transfer.ScheduledAt.Before(startAt) || transfer.ScheduledAt.After(endAt) {
			continue
		}
		events = append(events, LiquidityEvent{
			Date: transfer.ScheduledAt.In(startAt.Location()).Format("2006-01-02"), Kind: "scheduled_transfer", Direction: "out",
			Description: transfer.Description, AmountMinor: transfer.AmountMinor, SourceID: transfer.ActionID,
		})
	}
	sortLiquidityEvents(events)
	return events
}

func recurringDates(first time.Time, frequency string, start, end time.Time) []time.Time {
	first = first.In(start.Location())
	frequency = strings.ToLower(strings.TrimSpace(frequency))
	advance := func(current time.Time) time.Time {
		switch frequency {
		case "monthly":
			return current.AddDate(0, 1, 0)
		case "weekly":
			return current.AddDate(0, 0, 7)
		default:
			return time.Time{}
		}
	}
	for first.Before(start) && frequency != "once" {
		first = advance(first)
		if first.IsZero() {
			return nil
		}
	}
	if first.Before(start) && frequency == "once" {
		return nil
	}
	var dates []time.Time
	for !first.After(end) {
		dates = append(dates, first)
		if frequency == "once" {
			break
		}
		first = advance(first)
		if first.IsZero() {
			break
		}
	}
	return dates
}

func projectLiquidityScenario(name string, dailyDiscretionary, startingAvailable int64, startAt time.Time, horizonDays int, buffer int64, events []LiquidityEvent) LiquidityScenario {
	byDay := make(map[int][]LiquidityEvent)
	for _, event := range events {
		date, err := time.ParseInLocation("2006-01-02", event.Date, startAt.Location())
		if err != nil {
			continue
		}
		day := int(date.Sub(startAt).Hours() / 24)
		if day >= 0 && day <= horizonDays {
			byDay[day] = append(byDay[day], event)
		}
	}
	available := startingAvailable
	points := make([]LiquidityTimelinePoint, 0, horizonDays+1)
	minimum, minimumDate := available, startAt.Format("2006-01-02")
	record := func(date time.Time) {
		points = append(points, LiquidityTimelinePoint{Date: date.Format("2006-01-02"), AvailableMinor: available})
		if available < minimum {
			minimum, minimumDate = available, date.Format("2006-01-02")
		}
	}
	for _, event := range byDay[0] {
		available += liquidityEventDelta(event)
	}
	record(startAt)
	for day := 1; day <= horizonDays; day++ {
		available -= dailyDiscretionary
		for _, event := range byDay[day] {
			available += liquidityEventDelta(event)
		}
		record(startAt.AddDate(0, 0, day))
	}
	status := "safe"
	if minimum < 0 {
		status = "unsafe"
	} else if minimum < buffer {
		status = "tight"
	}
	return LiquidityScenario{
		Name: name, DailyDiscretionaryMinor: dailyDiscretionary, EndingAvailableMinor: available,
		MinimumAvailableMinor: minimum, MinimumDate: minimumDate, Status: status, Points: points,
	}
}

func liquidityEventDelta(event LiquidityEvent) int64 {
	if event.Direction == "in" {
		return event.AmountMinor
	}
	return -event.AmountMinor
}

func liquidityRiskReason(verdict string, expected, conservative, incomeStress LiquidityScenario, events []LiquidityEvent) string {
	if verdict == "safe" {
		return "预期、保守消费和收入未到账情景均保持在安全缓冲之上。"
	}
	if expected.Status != "unsafe" && conservative.Status != "unsafe" && incomeStress.Status == "unsafe" {
		return fmt.Sprintf("在预计收入按时到账时风险可控，但收入未到账时将在 %s 出现资金不足。", incomeStress.MinimumDate)
	}
	if expected.Status != "unsafe" && conservative.Status != "safe" {
		if conservative.Status == "unsafe" {
			return fmt.Sprintf("预期情景最低可用余额为 %s，但保守消费情景将在 %s 出现资金不足。", yuan(expected.MinimumAvailableMinor), conservative.MinimumDate)
		}
		return fmt.Sprintf("预期情景最低可用余额为 %s，但保守消费情景将在 %s 低于必要支出缓冲。", yuan(expected.MinimumAvailableMinor), conservative.MinimumDate)
	}
	for _, event := range events {
		if event.Date == expected.MinimumDate && event.Essential {
			return fmt.Sprintf("%s 后预计可用余额降至 %s，低于必要支出安全缓冲。", event.Description, yuan(expected.MinimumAvailableMinor))
		}
	}
	return fmt.Sprintf("预计在 %s 可用余额降至 %s，低于设置的缓冲目标。", expected.MinimumDate, yuan(expected.MinimumAvailableMinor))
}

func liquidityRecommendation(verdict string, maxSafeBudget, buffer int64, currency string) string {
	switch verdict {
	case "unsafe":
		return fmt.Sprintf("建议将预留金额控制在 %s %s 以内，或把预算支出推迟到收入到账后。", yuan(maxSafeBudget), currency)
	case "tight":
		return fmt.Sprintf("该预算可以继续评估，但为保留 %s %s 必要支出缓冲，建议预留不超过 %s %s。", yuan(buffer), currency, yuan(maxSafeBudget), currency)
	default:
		return fmt.Sprintf("预算不会突破必要支出缓冲，仍保留至少 %s %s 的最低安全空间。", yuan(buffer), currency)
	}
}

func buildLiquidityAlternatives(startAt time.Time, horizonDays int, profile HistoricalSpending, startingAvailable, proposedBudget, maxSafeBudget, buffer int64, baseEvents []LiquidityEvent) []LiquidityAlternative {
	var alternatives []LiquidityAlternative
	startDate := startAt.Format("2006-01-02")
	add := func(id, label, description string, conditional bool, condition string, total int64, reservations []LiquidityReservation, tradeoff string) {
		events := append([]LiquidityEvent{}, baseEvents...)
		for i, reservation := range reservations {
			if reservation.AmountMinor <= 0 {
				continue
			}
			events = append(events, LiquidityEvent{
				Date: reservation.Date, Kind: "proposed_budget", Direction: "out",
				Description: "计划预留预算", AmountMinor: reservation.AmountMinor, SourceID: fmt.Sprintf("%s_%d", id, i),
			})
		}
		sortLiquidityEvents(events)
		expected := projectLiquidityScenario("expected", profile.AverageDailyMinor, startingAvailable, startAt, horizonDays, buffer, events)
		conservative := projectLiquidityScenario("conservative", profile.ConservativeDailyMinor, startingAvailable, startAt, horizonDays, buffer, events)
		incomeStress := projectLiquidityScenario("income_stress", profile.ConservativeDailyMinor, startingAvailable, startAt, horizonDays, buffer, withoutInflows(events))
		status := combineLiquidityStatus(expected.Status, conservative.Status, incomeStress.Status)
		alternatives = append(alternatives, LiquidityAlternative{
			ID: id, Label: label, Description: description, TotalBudgetMinor: total,
			Conditional: conditional, Condition: condition,
			Reservations: reservations, Status: status,
			ExpectedMinimumAvailableMinor: expected.MinimumAvailableMinor, ExpectedMinimumDate: expected.MinimumDate,
			ConservativeMinimumAvailable: conservative.MinimumAvailableMinor, ConservativeMinimumDate: conservative.MinimumDate,
			IncomeStressMinimumAvailable: incomeStress.MinimumAvailableMinor, IncomeStressMinimumDate: incomeStress.MinimumDate,
			ExpectedPoints: expected.Points, Tradeoff: tradeoff,
		})
	}
	add("current", "保持原计划", "立即按原金额预留预算。", false, "", proposedBudget, []LiquidityReservation{{Date: startDate, AmountMinor: proposedBudget}}, "执行最简单，但会立即降低可用余额。")
	if maxSafeBudget != proposedBudget {
		label := "降至缓冲内额度"
		description := fmt.Sprintf("将预算调整为 %s，保留必要支出缓冲。", yuan(maxSafeBudget))
		if maxSafeBudget == 0 {
			label = "暂不预留"
			description = "当前不占用预算，等待资金状况改善。"
		}
		add("buffer_preserving", label, description, false, "", maxSafeBudget, []LiquidityReservation{{Date: startDate, AmountMinor: maxSafeBudget}}, "会减少可执行预算，但优先保护必要支出。")
	}
	nextIncomeDate := ""
	for _, event := range baseEvents {
		if event.Direction == "in" && event.Date > startDate {
			nextIncomeDate = event.Date
			break
		}
	}
	if nextIncomeDate != "" {
		condition := fmt.Sprintf("仅在 %s 收入确认入账后执行。", nextIncomeDate)
		add("after_income", "等待下一笔收入", fmt.Sprintf("在 %s 收入到账后预留完整预算。", nextIncomeDate), true, condition, proposedBudget, []LiquidityReservation{{Date: nextIncomeDate, AmountMinor: proposedBudget}}, "资金缓冲更稳，但依赖尚未确认的收入。")
		if proposedBudget > 1 {
			first, second := proposedBudget/2, proposedBudget-proposedBudget/2
			add("split", "分两笔预留", "现在预留一半，下一笔收入到账后补齐。", true, condition, proposedBudget, []LiquidityReservation{
				{Date: startDate, AmountMinor: first}, {Date: nextIncomeDate, AmountMinor: second},
			}, "兼顾当前预算与资金安全，但需要两次授权。")
		}
	}
	return alternatives
}

func combineLiquidityStatus(statuses ...string) string {
	status := "safe"
	for _, current := range statuses {
		if current == "unsafe" {
			return "unsafe"
		}
		if current == "tight" {
			status = "tight"
		}
	}
	return status
}

func withoutInflows(events []LiquidityEvent) []LiquidityEvent {
	result := make([]LiquidityEvent, 0, len(events))
	for _, event := range events {
		if event.Direction != "in" {
			result = append(result, event)
		}
	}
	return result
}

func alternativeRiskRank(status string) int {
	switch status {
	case "safe":
		return 0
	case "tight":
		return 1
	default:
		return 2
	}
}

func sortLiquidityEvents(events []LiquidityEvent) {
	sort.SliceStable(events, func(i, j int) bool {
		if events[i].Date != events[j].Date {
			return events[i].Date < events[j].Date
		}
		if events[i].Direction != events[j].Direction {
			return events[i].Direction == "out"
		}
		return events[i].SourceID < events[j].SourceID
	})
}

func parseLiquidityBudget(text string) (int64, bool) {
	matches := regexp.MustCompile(`(?:锁定|预留|预算)[^0-9]{0,12}([0-9]+(?:\.[0-9]{1,2})?)\s*元`).FindAllStringSubmatch(strings.TrimSpace(text), -1)
	if len(matches) == 0 {
		return 0, false
	}
	amount, err := strconv.ParseFloat(matches[len(matches)-1][1], 64)
	if err != nil || amount <= 0 {
		return 0, false
	}
	return int64(amount*100 + 0.5), true
}

func parseLiquidityHorizon(text string) (int, bool) {
	match := regexp.MustCompile(`未来\s*([0-9]{1,3})\s*天`).FindStringSubmatch(text)
	if len(match) != 2 {
		return defaultLiquidityHorizonDays, true
	}
	days, err := strconv.Atoi(match[1])
	if err != nil || days < 1 || days > maxLiquidityHorizonDays {
		return 0, false
	}
	return days, true
}

func parseLiquidityBuffer(text string) *int64 {
	if regexp.MustCompile(`(?:不保留|无需|不需要|零)\s*(?:必要)?(?:支出)?缓冲|(?:必要)?(?:支出)?缓冲\s*(?:为|设为)?\s*0\s*元`).MatchString(text) {
		value := int64(0)
		return &value
	}
	match := regexp.MustCompile(`(?:必要)?(?:支出)?缓冲\s*(?:保留|设为|为)?\s*([0-9]+(?:\.[0-9]{1,2})?)\s*元`).FindStringSubmatch(text)
	if len(match) != 2 {
		return nil
	}
	amount, err := strconv.ParseFloat(match[1], 64)
	if err != nil || amount < 0 || amount > 1e13 {
		return nil
	}
	value := int64(amount*100 + 0.5)
	return &value
}

func liquiditySummary(simulation LiquiditySimulation) string {
	expected := simulation.Scenarios[1]
	verdict := map[string]string{"safe": "安全", "tight": "偏紧", "unsafe": "不足"}[simulation.Verdict]
	condition := ""
	if simulation.DependsOnUnconfirmedIncome {
		condition = "；当前结果依赖预计收入到账"
	}
	return fmt.Sprintf("未来 %d 天流动性%s：预期最低可用 %s %s，收入未到账时最低 %s %s，建议预留不超过 %s %s%s。",
		simulation.HorizonDays, verdict, yuan(expected.MinimumAvailableMinor), simulation.Currency,
		yuan(simulation.IncomeStressMinimumMinor), simulation.Currency,
		yuan(simulation.MaximumSafeBudgetMinor), simulation.Currency, condition)
}

func liquidityHorizonDays(start, deadline time.Time) int {
	days := liquidityHorizonDaysBetween(start, deadline)
	if days > maxLiquidityHorizonDays {
		days = maxLiquidityHorizonDays
	}
	return days
}

func liquidityHorizonDaysBetween(start, deadline time.Time) int {
	loc := start.Location()
	startLocal := start.In(loc)
	startAt := time.Date(startLocal.Year(), startLocal.Month(), startLocal.Day(), 0, 0, 0, 0, loc)
	days := int(math.Ceil(deadline.In(loc).Sub(startAt).Hours() / 24))
	if days < 1 {
		days = 1
	}
	return days
}
