#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
results="$root/benchmark/results"

mkdir -p "$results"
cd "$root/backend"

BANKAGENT_EVAL_OUT="$results/latest.json" \
go test -run '^TestExecutableEvaluationReport$' -count=1 -v ./internal/httpapi

go test -run '^$' -bench '^BenchmarkLiquiditySimulationHTTP$' -benchmem ./internal/httpapi \
  | tee "$results/latest-benchmark.txt"
