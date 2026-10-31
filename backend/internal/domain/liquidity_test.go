package domain

import (
	"testing"
	"time"
)

func TestProjectLiquidityScenario(t *testing.T) {
	loc := time.FixedZone("CST", 8*60*60)
	start := time.Date(2026, 11, 15, 0, 0, 0, 0, loc)
	events := []LiquidityEvent{
		{Date: "2026-11-15", Kind: "proposed_budget", Direction: "out", AmountMinor: 100000, Description: "计划预留预算"},
		{Date: "2026-11-17", Kind: "housing", Direction: "out", AmountMinor: 800000, Description: "房租", Essential: true},
		{Date: "2026-11-19", Kind: "income", Direction: "in", AmountMinor: 300000, Description: "工资"},
	}
	tests := []struct {
		name       string
		starting   int64
		daily      int64
		events     []LiquidityEvent
		wantMin    int64
		wantStatus string
	}{
		{name: "safe", starting: 1200000, daily: 1000, events: events, wantMin: 297000, wantStatus: "safe"},
		{name: "tight", starting: 1000000, daily: 1000, events: events, wantMin: 97000, wantStatus: "tight"},
		{name: "unsafe", starting: 900000, daily: 1000, events: events, wantMin: -3000, wantStatus: "unsafe"},
		{name: "essential only ignores discretionary", starting: 1000000, daily: 0, events: events, wantMin: 100000, wantStatus: "safe"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			scenario := projectLiquidityScenario(test.name, test.daily, test.starting, start, 5, 100000, test.events)
			if scenario.MinimumAvailableMinor != test.wantMin || scenario.Status != test.wantStatus {
				t.Fatalf("scenario=%+v, want min=%d status=%s", scenario, test.wantMin, test.wantStatus)
			}
			if len(scenario.Points) != 6 {
				t.Fatalf("points=%d", len(scenario.Points))
			}
		})
	}
}

func TestRecurringDatesMonthlyWithinHorizon(t *testing.T) {
	loc := time.FixedZone("CST", 8*60*60)
	start := time.Date(2026, 11, 1, 0, 0, 0, 0, loc)
	dates := recurringDates(time.Date(2026, 10, 20, 9, 0, 0, 0, loc), "monthly", start, start.AddDate(0, 0, 50))
	if len(dates) != 2 || dates[0].Format("2006-01-02") != "2026-11-20" || dates[1].Format("2006-01-02") != "2026-12-20" {
		t.Fatalf("unexpected dates: %+v", dates)
	}
}

func TestParseLiquidityBudgetUsesLatestAmount(t *testing.T) {
	amount, ok := parseLiquidityBudget("原计划预算500元，重新锁定一笔1000元会影响房租吗")
	if !ok || amount != 100000 {
		t.Fatalf("amount=%d ok=%v", amount, ok)
	}
}

func TestParseLiquidityHorizonAndZeroBuffer(t *testing.T) {
	if got := parseLiquidityHorizon("锁定100元，会影响未来45天房租吗"); got != 45 {
		t.Fatalf("horizon=%d", got)
	}
	buffer := parseLiquidityBuffer("锁定100元，不保留缓冲，会影响未来30天房租吗")
	if buffer == nil || *buffer != 0 {
		t.Fatalf("buffer=%v", buffer)
	}
	buffer = parseLiquidityBuffer("必要支出缓冲设为500元，锁定100元")
	if buffer == nil || *buffer != 50000 {
		t.Fatalf("buffer=%v", buffer)
	}
}

func TestLiquidityEventsIncludeConfirmedScheduledTransfer(t *testing.T) {
	loc := time.FixedZone("CST", 8*60*60)
	start := time.Date(2026, 11, 15, 0, 0, 0, 0, loc)
	events := liquidityEvents(start, 30, "CNY", nil, nil, []ScheduledCashflow{{
		ActionID: "act_scheduled", AmountMinor: 30000, Currency: "CNY",
		ScheduledAt: time.Date(2026, 11, 17, 10, 0, 0, 0, loc), Description: "预约转账",
	}})
	if len(events) != 1 || events[0].Kind != "scheduled_transfer" || events[0].Direction != "out" || events[0].AmountMinor != 30000 {
		t.Fatalf("events=%+v", events)
	}
}
