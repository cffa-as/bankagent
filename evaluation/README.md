# Vaultline Evaluation

The evaluation system is split into three layers:

1. Unit tests validate pure policy, state-machine, amount and schema rules.
2. Integration evaluation runs the full Go HTTP handler, SQLite transaction layer, auth boundary, idempotency and action state machine. It is tagged with `integration` and is not part of ordinary unit-test execution.
3. Browser E2E runs the built Next.js workspace against a real Go process and a same-origin auth proxy. Playwright drives the six core user journeys and records UI-level pass/fail evidence.

Run the full protocol:

```bash
./evaluation/run.sh
```

Outputs:

```text
evaluation/results/academic.json
evaluation/results/latest.json
evaluation/results/benchmark.txt
evaluation/results/e2e.json
evaluation/results/security-tools.json
evaluation/results/frontend-audit.txt
evaluation/results/govulncheck.txt
evaluation/results/cases.csv
evaluation/results/metrics.csv
evaluation/results/academic-report.html
evaluation/results/screenshots/workspace-e2e-audit.png
```

The HTML report is self-contained. It contains the metric definitions, confidence intervals, confusion matrices, latency CDF and the complete case table. All data is synthetic.
