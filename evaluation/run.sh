#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
results="$root/evaluation/results"
runtime="$root/.local/evaluation"
logs="$runtime/logs"
api_port="${EVALUATION_API_PORT:-18080}"
web_port="${EVALUATION_WEB_PORT:-13100}"
token="${BANKAGENT_AUTH_TOKEN:-vaultline-evaluation-token-2026-11-01}"
python_bin="${EVALUATION_PYTHON:-python3}"
db="$runtime/evaluation.db"
backend_bin="$runtime/bankagent"

mkdir -p "$results" "$logs" "$runtime"
rm -f "$db" "$db-shm" "$db-wal" "$logs/api.log" "$logs/web.log"

if [[ "${EVALUATION_SKIP_BUILD:-0}" != "1" ]]; then
  (
    cd "$root/backend"
    go build -o "$backend_bin" ./cmd/bankagent
  )
  (
    cd "$root/frontend"
    pnpm build
  )
else
  (
    cd "$root/backend"
    go build -o "$backend_bin" ./cmd/bankagent
  )
fi

api_pid=""
web_pid=""
cleanup() {
  if [[ -n "$web_pid" ]]; then kill "$web_pid" 2>/dev/null || true; fi
  if [[ -n "$api_pid" ]]; then kill "$api_pid" 2>/dev/null || true; fi
}
trap cleanup EXIT

BANKAGENT_ADDR="127.0.0.1:$api_port" \
BANKAGENT_DATABASE="$db" \
BANKAGENT_AUTH_TOKEN="$token" \
"$backend_bin" >"$logs/api.log" 2>&1 &
api_pid=$!

(
  cd "$root/frontend"
  PORT="$web_port" \
  BANKAGENT_API_PROXY_TARGET="http://127.0.0.1:$api_port" \
  BANKAGENT_AUTH_TOKEN="$token" \
  node node_modules/next/dist/bin/next start -p "$web_port"
) >"$logs/web.log" 2>&1 &
web_pid=$!

for endpoint in "http://127.0.0.1:$api_port/healthz" "http://127.0.0.1:$web_port/backend/healthz"; do
  ready=0
  for _ in $(seq 1 80); do
    if curl -fsS "$endpoint" >/dev/null 2>&1; then
      ready=1
      break
    fi
    sleep 0.25
  done
  if [[ "$ready" != "1" ]]; then
    echo "evaluation service did not become ready: $endpoint" >&2
    tail -n 80 "$logs/api.log" >&2 || true
    tail -n 80 "$logs/web.log" >&2 || true
    exit 1
  fi
done

(
  cd "$root/backend"
  BANKAGENT_ACADEMIC_OUT="$results/academic.json" \
    go test -tags=integration -run '^TestAcademicEvaluationReport$' -count=1 -v ./internal/httpapi
  BANKAGENT_EVAL_OUT="$results/latest.json" \
    go test -run '^TestExecutableEvaluationReport$' -count=1 -v ./internal/httpapi
  go test -run '^$' -bench '^BenchmarkLiquiditySimulationHTTP$' -benchmem ./internal/httpapi \
    | tee "$results/benchmark.txt"
)

VAULTLINE_E2E_BASE_URL="http://127.0.0.1:$web_port" \
VAULTLINE_E2E_OUT="$results/e2e.json" \
  node "$root/evaluation/e2e/workspace-e2e.mjs"

"$python_bin" \
  "$root/evaluation/report/render_report.py" \
  --academic "$results/academic.json" \
  --engineering "$results/latest.json" \
  --benchmark "$results/benchmark.txt" \
  --e2e "$results/e2e.json" \
  --out-dir "$results"

cp "$results/latest.json" "$root/benchmark/results/latest.json"
cp "$results/benchmark.txt" "$root/benchmark/results/latest-benchmark.txt"

echo "evaluation report: $results/academic-report.html"
