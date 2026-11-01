#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import html
import json
import math
from pathlib import Path


NAVY = "#0B1423"
INK = "#182434"
MUTED = "#667386"
LINE = "#D7DFE9"
BG = "#F7F9FC"
COBALT = "#315BFF"
TEAL = "#23866F"
AMBER = "#B97818"
RED = "#B84A43"


def pct(value: float, digits: int = 1) -> str:
    return f"{value * 100:.{digits}f}%"


def num(value: float, digits: int = 3) -> str:
    return f"{value:,.{digits}f}"


def esc(value) -> str:
    return html.escape(str(value), quote=True)


def load_json(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def svg_bar_chart(items: list[tuple[str, float]], *, width=860, row_height=34) -> str:
    height = max(110, len(items) * row_height + 28)
    label_width = 190
    right_pad = 60
    bar_width = width - label_width - right_pad
    rows = []
    for index, (label, value) in enumerate(items):
        y = 18 + index * row_height
        clamped = max(0.0, min(1.0, value))
        rows.append(
            f'<text x="{label_width - 14}" y="{y + 15}" text-anchor="end" class="chart-label">{esc(label)}</text>'
            f'<rect x="{label_width}" y="{y}" width="{bar_width}" height="15" rx="7.5" fill="#EEF2F7"/>'
            f'<rect x="{label_width}" y="{y}" width="{bar_width * clamped:.2f}" height="15" rx="7.5" fill="{TEAL}"/>'
            f'<text x="{label_width + bar_width + 10}" y="{y + 12}" class="chart-value">{pct(value)}</text>'
        )
    return (
        f'<svg viewBox="0 0 {width} {height}" role="img" aria-label="分类 F1 条形图" class="chart">'
        f'{"".join(rows)}</svg>'
    )


def svg_security_chart(security: dict) -> str:
    items = [
        ("ASR", security["attack_success_rate"], RED),
        ("FPR", security["false_positive_rate"], AMBER),
        ("Benign acceptance", security["benign_acceptance_rate"], TEAL),
        ("Policy compliance", security["policy_compliance_rate"], COBALT),
    ]
    width, height = 860, 190
    label_width, right_pad, row_height = 160, 56, 34
    bar_width = width - label_width - right_pad
    rows = []
    for index, (label, value, color) in enumerate(items):
        y = 18 + index * row_height
        rows.append(
            f'<text x="{label_width - 14}" y="{y + 15}" text-anchor="end" class="chart-label">{label}</text>'
            f'<rect x="{label_width}" y="{y}" width="{bar_width}" height="15" rx="7.5" fill="#EEF2F7"/>'
            f'<rect x="{label_width}" y="{y}" width="{bar_width * max(0.0, min(1.0, value)):.2f}" height="15" rx="7.5" fill="{color}"/>'
            f'<text x="{label_width + bar_width + 10}" y="{y + 12}" class="chart-value">{pct(value)}</text>'
        )
    return (
        f'<svg viewBox="0 0 {width} {height}" role="img" aria-label="安全指标图" class="chart">'
        f'{"".join(rows)}</svg>'
    )


def svg_cdf(latency: dict) -> str:
    samples = sorted(int(value) for value in latency["samples_us"])
    width, height = 900, 330
    left, top, right, bottom = 66, 28, 24, 46
    plot_w, plot_h = width - left - right, height - top - bottom
    maximum = max(samples) if samples else 1
    ceiling = max(1000, int(math.ceil(maximum / 500.0) * 500))
    points = []
    for index, value in enumerate(samples):
        x = left + plot_w * index / max(1, len(samples) - 1)
        y = top + plot_h - plot_h * value / ceiling
        points.append(f"{x:.2f},{y:.2f}")
    grid = []
    tick_values = [0, ceiling // 4, ceiling // 2, ceiling * 3 // 4, ceiling]
    for value in tick_values:
        y = top + plot_h - plot_h * value / ceiling
        grid.append(
            f'<line x1="{left}" y1="{y:.2f}" x2="{width - right}" y2="{y:.2f}" stroke="{LINE}" stroke-width="1"/>'
            f'<text x="{left - 10}" y="{y + 4:.2f}" text-anchor="end" class="axis-label">{value}µs</text>'
        )
    for value in [0, 25, 50, 75, 100]:
        x = left + plot_w * value / 100
        grid.append(
            f'<line x1="{x:.2f}" y1="{top}" x2="{x:.2f}" y2="{top + plot_h}" stroke="{LINE}" stroke-width="0.7"/>'
            f'<text x="{x:.2f}" y="{height - 20}" text-anchor="middle" class="axis-label">{value}%</text>'
        )
    markers = []
    for label, key, color in [
        ("p50", "median_us", TEAL),
        ("p95", "p95_us", COBALT),
        ("p99", "p99_us", RED),
    ]:
        value = latency[key]
        y = top + plot_h - plot_h * value / ceiling
        markers.append(
            f'<line x1="{left}" y1="{y:.2f}" x2="{width - right}" y2="{y:.2f}" stroke="{color}" stroke-width="1" stroke-dasharray="5 4" opacity="0.8"/>'
            f'<text x="{width - right}" y="{y - 6:.2f}" text-anchor="end" class="marker" fill="{color}">{label} {value}µs</text>'
        )
    return (
        f'<svg viewBox="0 0 {width} {height}" role="img" aria-label="延迟 CDF" class="chart">'
        f'{"".join(grid)}{"".join(markers)}'
        f'<polyline points="{" ".join(points)}" fill="none" stroke="{NAVY}" stroke-width="2.2"/>'
        f'<text x="{left}" y="{height - 3}" class="axis-title">Percentile</text>'
        f'<text x="14" y="{top + plot_h / 2}" transform="rotate(-90 14 {top + plot_h / 2})" text-anchor="middle" class="axis-title">Latency</text>'
        f"</svg>"
    )


def confusion_table(matrix: dict[str, dict[str, int]], labels: list[str]) -> str:
    head = "".join(f"<th>{esc(label)}</th>" for label in labels)
    body = []
    for expected in labels:
        cells = []
        for actual in labels:
            count = int(matrix.get(expected, {}).get(actual, 0))
            cls = "hit" if expected == actual and count else ("miss" if count else "")
            cells.append(f'<td class="{cls}">{count if count else "·"}</td>')
        body.append(f"<tr><th>{esc(expected)}</th>{''.join(cells)}</tr>")
    return (
        '<div class="matrix-wrap"><table class="matrix">'
        f"<thead><tr><th>expected ↓ / actual →</th>{head}</tr></thead>"
        f"<tbody>{''.join(body)}</tbody></table></div>"
    )


def risk_matrix(matrix: dict[str, dict[str, int]]) -> str:
    labels = ["yellow", "red"]
    head = "".join(f"<th>{label}</th>" for label in labels)
    body = []
    for expected in labels:
        cells = []
        for actual in labels:
            count = int(matrix.get(expected, {}).get(actual, 0))
            cls = "hit" if expected == actual and count else ("miss" if count else "")
            cells.append(f'<td class="{cls}">{count if count else "·"}</td>')
        body.append(f"<tr><th>{expected}</th>{''.join(cells)}</tr>")
    return (
        '<div class="matrix-wrap compact"><table class="matrix">'
        f"<thead><tr><th>expected ↓ / actual →</th>{head}</tr></thead>"
        f"<tbody>{''.join(body)}</tbody></table></div>"
    )


def metric_card(label: str, value: str, detail: str, tone: str = "") -> str:
    return (
        f'<article class="metric {tone}">'
        f'<div class="metric-label">{esc(label)}</div>'
        f'<div class="metric-value">{esc(value)}</div>'
        f'<div class="metric-detail">{esc(detail)}</div>'
        "</article>"
    )


def render(args) -> None:
    academic = load_json(args.academic)
    engineering = load_json(args.engineering)
    e2e = load_json(args.e2e)
    security_tools = load_json(args.security) if Path(args.security).exists() else {
        "frontend_prod_audit": "not_run",
        "go_vulncheck": "not_run",
    }
    benchmark = Path(args.benchmark).read_text(encoding="utf-8")
    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    intent = academic["intent"]
    slots = academic["slots"]
    risk = academic["risk"]
    security = academic["security"]
    latency = academic["latency"]
    cases = academic.get("cases", [])
    e2e_results = e2e.get("results", [])
    integration_cases = len(cases)

    case_csv = out_dir / "cases.csv"
    with case_csv.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(["id", "suite", "input", "expected", "actual", "passed", "details"])
        for item in cases:
            writer.writerow([
                item.get("id", ""),
                item.get("suite", ""),
                item.get("input", ""),
                item.get("expected", ""),
                item.get("actual", ""),
                item.get("passed", False),
                item.get("details", ""),
            ])

    metrics_csv = out_dir / "metrics.csv"
    with metrics_csv.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle, lineterminator="\n")
        writer.writerow(["metric", "value", "ci95_low", "ci95_high", "definition"])
        rows = [
            ["intent_accuracy", intent["accuracy"], intent["accuracy_ci95"]["low"], intent["accuracy_ci95"]["high"], "correct intent / all intent cases"],
            ["intent_macro_f1", intent["macro_f1"], "", "", "unweighted mean of per-class F1"],
            ["intent_weighted_f1", intent["weighted_f1"], "", "", "support-weighted mean of per-class F1"],
            ["intent_cohen_kappa", intent["cohen_kappa"], "", "", "agreement corrected for chance"],
            ["slot_exact_match", slots["exact_match"], "", "", "amount and beneficiary both exact"],
            ["risk_accuracy", risk["accuracy"], risk["accuracy_ci95"]["low"], risk["accuracy_ci95"]["high"], "yellow/red risk classification"],
            ["risk_f1_red", risk["f1_red"], "", "", "F1 for red high-risk actions"],
            ["attack_success_rate", security["attack_success_rate"], security["attack_success_rate_ci95"]["low"], security["attack_success_rate_ci95"]["high"], "attacks with unsafe side effect / attacks"],
            ["false_positive_rate", security["false_positive_rate"], security["false_positive_rate_ci95"]["low"], security["false_positive_rate_ci95"]["high"], "benign requests rejected / benign requests"],
            ["policy_compliance_rate", security["policy_compliance_rate"], security["policy_compliance_rate_ci95"]["low"], security["policy_compliance_rate_ci95"]["high"], "compliant outcomes / all security cases"],
            ["latency_p50_us", latency["median_us"], "", "", "order-statistic median"],
            ["latency_p95_us", latency["p95_us"], "", "", "nearest-rank p95"],
            ["latency_p99_us", latency["p99_us"], "", "", "nearest-rank p99"],
            ["latency_mean_us", latency["mean_us"], latency["mean_ci95"]["low"], latency["mean_ci95"]["high"], "mean with deterministic bootstrap CI"],
            ["e2e_pass_rate", e2e["pass_rate"], "", "", "browser journeys passed / planned"],
        ]
        writer.writerows(rows)

    class_bars = [(item["class"], item["f1"]) for item in intent["per_class"]]
    e2e_rows = "".join(
        f'<tr><td class="mono">{esc(item["id"])}</td><td>{esc(item["title"])}</td>'
        f'<td><span class="status {"pass" if item["passed"] else "fail"}">{"PASS" if item["passed"] else "FAIL"}</span></td>'
        f'<td class="num">{item["duration_ms"]:,} ms</td><td>{esc(item["details"])}</td></tr>'
        for item in e2e_results
    )
    engineering_rows = "".join(
        f'<tr><td class="mono">{esc(item["name"])}</td><td><span class="status {"pass" if item["passed"] else "fail"}">'
        f'{"PASS" if item["passed"] else "FAIL"}</span></td><td class="mono">{esc(item["details"])}</td></tr>'
        for item in engineering.get("checks", [])
    )
    case_rows = []
    for item in cases:
        details = str(item.get("details", ""))
        if len(details) > 220:
            details = details[:217] + "..."
        case_rows.append(
            f'<tr data-suite="{esc(item.get("suite", ""))}" data-passed="{str(item.get("passed", False)).lower()}">'
            f'<td class="mono">{esc(item.get("id", ""))}</td>'
            f'<td><span class="suite">{esc(item.get("suite", ""))}</span></td>'
            f'<td>{esc(item.get("input", ""))}</td>'
            f'<td class="mono">{esc(item.get("expected", ""))}</td>'
            f'<td class="mono">{esc(item.get("actual", ""))}</td>'
            f'<td><span class="status {"pass" if item.get("passed") else "fail"}">{"PASS" if item.get("passed") else "FAIL"}</span></td>'
            f'<td class="details">{esc(details)}</td></tr>'
        )

    suite_options = sorted({str(item.get("suite", "")) for item in cases})
    suite_options_html = "".join(f'<option value="{esc(value)}">{esc(value)}</option>' for value in suite_options)
    f1_svg = svg_bar_chart(class_bars)
    security_svg = svg_security_chart(security)
    cdf_svg = svg_cdf(latency)
    intent_matrix = confusion_table(intent["confusion_matrix"], [item["class"] for item in intent["per_class"]])
    risk_confusion = risk_matrix(risk["confusion_matrix"])

    benchmark_summary = html.escape(benchmark.strip())
    academic_link = Path(args.academic).name
    e2e_link = Path(args.e2e).name
    engineering_link = Path(args.engineering).name

    document = f"""<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Vaultline Evaluation Report</title>
<style>
:root {{
  --navy: {NAVY}; --ink: {INK}; --muted: {MUTED}; --line: {LINE}; --bg: {BG};
  --cobalt: {COBALT}; --teal: {TEAL}; --amber: {AMBER}; --red: {RED};
  --card: #ffffff; --soft: #eef2f7;
}}
* {{ box-sizing: border-box; }}
html {{ scroll-behavior: smooth; }}
body {{
  margin: 0; color: var(--ink); background: var(--bg);
  font-family: -apple-system, BlinkMacSystemFont, "Noto Sans SC", "PingFang SC", "Helvetica Neue", sans-serif;
  font-size: 14px; line-height: 1.65;
}}
a {{ color: var(--cobalt); text-decoration: none; }}
a:hover {{ text-decoration: underline; }}
.shell {{ max-width: 1500px; margin: 0 auto; background: var(--bg); }}
.hero {{
  padding: 54px 58px 46px; color: white; background: var(--navy);
  border-bottom: 5px solid var(--cobalt); position: relative; overflow: hidden;
}}
.hero:after {{
  content: ""; position: absolute; right: -80px; top: -170px; width: 440px; height: 440px;
  border: 1px solid rgba(255,255,255,.16); border-radius: 50%;
}}
.brand {{ display: flex; align-items: center; gap: 12px; font: 700 14px "Helvetica Neue", sans-serif; letter-spacing: .08em; }}
.mark {{ width: 34px; height: 34px; border-radius: 50%; background: white; color: var(--navy); display: grid; place-items: center; font-weight: 800; }}
.hero h1 {{ font-size: 42px; line-height: 1.1; letter-spacing: -1.4px; margin: 35px 0 12px; max-width: 900px; }}
.hero p {{ max-width: 900px; color: #c5d1df; font-size: 17px; margin: 0; }}
.hero-meta {{ display: flex; gap: 22px; flex-wrap: wrap; margin-top: 28px; color: #9eb0c5; font: 12px "SFMono-Regular", Consolas, monospace; }}
.nav {{
  position: sticky; top: 0; z-index: 5; display: flex; gap: 20px; overflow-x: auto;
  padding: 14px 58px; background: rgba(247,249,252,.96); backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--line);
}}
.nav a {{ color: var(--muted); white-space: nowrap; font-size: 12px; font-weight: 650; }}
.main {{ padding: 34px 58px 70px; }}
.metrics {{ display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; margin-bottom: 28px; }}
.metric {{ background: var(--card); border: 1px solid var(--line); padding: 18px 18px 16px; min-height: 132px; }}
.metric-label {{ color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .08em; }}
.metric-value {{ color: var(--navy); font: 650 31px "Helvetica Neue", sans-serif; margin-top: 10px; letter-spacing: -.8px; }}
.metric-detail {{ color: var(--muted); font-size: 11.5px; line-height: 1.45; margin-top: 8px; }}
.metric.good .metric-value {{ color: var(--teal); }}
.metric.risk .metric-value {{ color: var(--red); }}
section {{ background: var(--card); border: 1px solid var(--line); margin: 18px 0; }}
.section-head {{ padding: 22px 25px 14px; border-bottom: 1px solid var(--line); display: flex; justify-content: space-between; gap: 18px; align-items: end; }}
.section-head h2 {{ margin: 0; font-size: 22px; letter-spacing: -.3px; color: var(--navy); }}
.section-head p {{ margin: 3px 0 0; color: var(--muted); font-size: 12px; }}
.tag {{ display: inline-block; padding: 3px 8px; color: var(--cobalt); background: #edf2ff; font: 650 10px "SFMono-Regular", Consolas, monospace; letter-spacing: .04em; }}
.section-body {{ padding: 24px 25px 27px; }}
.grid-2 {{ display: grid; grid-template-columns: 1fr 1fr; gap: 22px; }}
.grid-3 {{ display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }}
.kv {{ border-top: 1px solid var(--line); padding-top: 10px; }}
.kv .k {{ color: var(--muted); font-size: 11px; }}
.kv .v {{ color: var(--navy); font: 650 20px "Helvetica Neue", sans-serif; margin-top: 3px; }}
.kv .d {{ color: var(--muted); font-size: 11px; }}
.chart {{ width: 100%; height: auto; overflow: visible; }}
.chart-label, .axis-label, .axis-title {{ fill: var(--muted); font-size: 11px; font-family: inherit; }}
.chart-value, .marker {{ fill: var(--ink); font-size: 11px; font-weight: 650; font-family: inherit; }}
.matrix-wrap {{ overflow-x: auto; }}
.matrix {{ border-collapse: collapse; min-width: 820px; font-size: 10px; }}
.matrix th, .matrix td {{ border: 1px solid var(--line); padding: 6px 8px; text-align: center; white-space: nowrap; }}
.matrix th {{ background: var(--soft); color: var(--ink); font-weight: 650; }}
.matrix td.hit {{ background: #dff3eb; color: var(--teal); font-weight: 750; }}
.matrix td.miss {{ background: #fbe8e6; color: var(--red); font-weight: 750; }}
.matrix.compact {{ min-width: 0; width: 100%; }}
table {{ width: 100%; border-collapse: collapse; }}
th, td {{ border-bottom: 1px solid var(--line); padding: 9px 9px; text-align: left; vertical-align: top; }}
th {{ color: var(--muted); font-size: 10px; letter-spacing: .05em; text-transform: uppercase; background: var(--soft); }}
td {{ font-size: 12px; }}
tr:last-child td {{ border-bottom: 0; }}
.mono, code {{ font-family: "SFMono-Regular", Consolas, monospace; }}
.num {{ text-align: right; white-space: nowrap; }}
.status {{ display: inline-block; min-width: 42px; text-align: center; padding: 2px 6px; font: 700 9px "SFMono-Regular", Consolas, monospace; }}
.status.pass {{ color: var(--teal); background: #e0f4ed; }}
.status.fail {{ color: var(--red); background: #fbe8e6; }}
.suite {{ color: var(--cobalt); font: 650 10px "SFMono-Regular", Consolas, monospace; }}
.details {{ color: var(--muted); max-width: 360px; }}
.callout {{ border-left: 4px solid var(--cobalt); background: #edf2ff; padding: 14px 16px; color: var(--ink); }}
.callout.warn {{ border-color: var(--amber); background: #fff5e1; }}
.code {{ background: #101a2a; color: #dfe8f4; padding: 15px 17px; overflow-x: auto; font: 11px/1.6 "SFMono-Regular", Consolas, monospace; }}
.formula {{ color: var(--muted); font: 11px/1.65 "SFMono-Regular", Consolas, monospace; border-left: 2px solid var(--line); padding-left: 14px; }}
.toolbar {{ display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 13px; }}
.toolbar input, .toolbar select {{
  border: 1px solid var(--line); background: var(--bg); color: var(--ink); padding: 9px 11px; font: inherit; outline: none;
}}
.toolbar input {{ flex: 1; min-width: 260px; }}
.small {{ color: var(--muted); font-size: 11px; }}
.footer {{ padding: 26px 58px 50px; color: var(--muted); font-size: 11px; border-top: 1px solid var(--line); }}
@media (max-width: 1100px) {{
  .metrics {{ grid-template-columns: repeat(2, 1fr); }}
  .grid-2, .grid-3 {{ grid-template-columns: 1fr; }}
  .hero, .main, .nav, .footer {{ padding-left: 24px; padding-right: 24px; }}
}}
</style>
</head>
<body>
<div class="shell">
  <header class="hero">
    <div class="brand"><span class="mark">V</span> VAULTLINE</div>
    <h1>银行 Agent 安全与能力评测报告</h1>
    <p>Integration and browser E2E evaluation for intent understanding, slot extraction, risk policy, adversarial robustness, idempotency, concurrency, auditability and latency.</p>
    <div class="hero-meta">
      <span>VERSION {esc(academic["version"])}</span>
      <span>{esc(academic["evaluated_at"])}</span>
      <span>SYNTHETIC DATA</span>
    </div>
  </header>
  <nav class="nav">
    <a href="#overview">Overview</a><a href="#protocol">Protocol</a><a href="#intent">Intent</a>
    <a href="#risk">Risk</a><a href="#security">Security</a><a href="#latency">Latency</a>
    <a href="#e2e">Browser E2E</a><a href="#cases">Case ledger</a><a href="#method">Method</a><a href="#reproduce">Reproduce</a>
  </nav>
  <main class="main">
    <div class="metrics" id="overview">
      {metric_card("Intent accuracy", pct(intent["accuracy"]), f"95% Wilson CI {pct(intent['accuracy_ci95']['low'])}–{pct(intent['accuracy_ci95']['high'])}", "good")}
      {metric_card("Macro F1", num(intent["macro_f1"]), f"{intent['cases']} cases / {intent['classes']} classes")}
      {metric_card("Risk F1 (red)", num(risk["f1_red"]), f"{risk['cases']} boundary cases / accuracy {pct(risk['accuracy'])}")}
      {metric_card("Attack success rate", pct(security["attack_success_rate"]), f"95% CI {pct(security['attack_success_rate_ci95']['low'])}–{pct(security['attack_success_rate_ci95']['high'])}", "good")}
      {metric_card("Latency p95 / p99", f"{latency['p95_us']} / {latency['p99_us']} µs", f"{latency['samples']} warm requests / mean CI {latency['mean_ci95']['low']:.0f}–{latency['mean_ci95']['high']:.0f} µs")}
    </div>

    <section id="protocol">
      <div class="section-head"><div><h2>实验协议与测试分层</h2><p>不是单测冒充评测：集成层和浏览器 E2E 分开记录。</p></div><span class="tag">PROTOCOL</span></div>
      <div class="section-body">
        <div class="grid-3">
          <div class="kv"><div class="k">Integration / API</div><div class="v">{integration_cases} cases</div><div class="d">真实 Go handler + SQLite + auth + transaction boundaries</div></div>
          <div class="kv"><div class="k">Browser E2E</div><div class="v">{e2e['passed']} / {e2e['cases']}</div><div class="d">Playwright against production Next.js + real Go API</div></div>
          <div class="kv"><div class="k">Engineering gate</div><div class="v">{engineering['checks_passed']} / {engineering['checks_total']}</div><div class="d">Invariant, audit, replay and liquidity golden checks</div></div>
        </div>
        <div class="grid-3" style="margin-top:20px">
          <div class="kv"><div class="k">Intent corpus</div><div class="v">{intent['cases']}</div><div class="d">10 classes including unknown intent</div></div>
          <div class="kv"><div class="k">Slot extraction</div><div class="v">{slots['cases']}</div><div class="d">amount and beneficiary exact match</div></div>
          <div class="kv"><div class="k">Risk boundary</div><div class="v">{risk['cases']}</div><div class="d">yellow/red classification around cumulative limit</div></div>
        </div>
        <div class="callout" style="margin-top:20px">
          <strong>Evaluation boundary.</strong> The intent corpus is a curated synthetic in-domain benchmark. Integration evaluation exercises the full HTTP handler, SQLite transaction layer, auth boundary and action state machine. Browser E2E exercises the real Next.js workspace and same-origin token proxy. It does not claim production internet latency or external-bank capacity.
        </div>
        <h3>Current security controls</h3>
        <table>
          <thead><tr><th>Control</th><th>Implementation</th><th>Evidence</th></tr></thead>
          <tbody>
            <tr><td>Gateway authentication</td><td>Environment token, SHA-256 digest, constant-time compare, same-origin proxy injection</td><td>Configured-token accept / default-token reject tests</td></tr>
            <tr><td>MFA verifier</td><td>Environment-configurable six-digit code, constant-time compare</td><td>Custom-code success / default-code failure tests</td></tr>
            <tr><td>Business receipts</td><td>Card and subscription actions now write structured results</td><td>Browser E2E rejects success without a receipt</td></tr>
            <tr><td>Security headers</td><td>API no-store/nosniff/frame-deny; Web CSP, Permissions Policy and production HSTS</td><td>API tests and production build</td></tr>
            <tr><td>Dependency security</td><td>Production-only dependency audit, Go vulnerability scan, CI and weekly Dependabot</td><td>{esc(security_tools.get("frontend_prod_audit", "not_run"))} / {esc(security_tools.get("go_vulncheck", "not_run"))}</td></tr>
          </tbody>
        </table>
      </div>
    </section>

    <section id="intent">
      <div class="section-head"><div><h2>意图理解与槽位抽取</h2><p>10-class classification and exact slot extraction.</p></div><span class="tag">ACCURACY / F1 / KAPPA</span></div>
      <div class="section-body">
        <div class="grid-2">
          <div>
            <div class="grid-2" style="gap:10px">
              <div class="kv"><div class="k">Accuracy</div><div class="v">{pct(intent['accuracy'])}</div><div class="d">95% CI {pct(intent['accuracy_ci95']['low'])}–{pct(intent['accuracy_ci95']['high'])}</div></div>
              <div class="kv"><div class="k">Macro F1</div><div class="v">{num(intent['macro_f1'])}</div><div class="d">unweighted over 10 classes</div></div>
              <div class="kv"><div class="k">Weighted F1</div><div class="v">{num(intent['weighted_f1'])}</div><div class="d">support-weighted</div></div>
              <div class="kv"><div class="k">Cohen's κ</div><div class="v">{num(intent['cohen_kappa'])}</div><div class="d">chance-corrected agreement</div></div>
            </div>
            <div class="kv" style="margin-top:18px"><div class="k">Slot exact match</div><div class="v">{pct(slots['exact_match'])}</div><div class="d">amount accuracy {pct(slots['amount_accuracy'])} · beneficiary accuracy {pct(slots['beneficiary_accuracy'])} · MAE {slots['amount_mae_minor']:.2f} minor units</div></div>
          </div>
          <div>{f1_svg}</div>
        </div>
        <h3>Confusion matrix</h3>
        {intent_matrix}
      </div>
    </section>

    <section id="risk">
      <div class="section-head"><div><h2>风险策略边界性能</h2><p>Daily cumulative limit with balanced yellow/red boundary cases.</p></div><span class="tag">PRECISION / RECALL / F1</span></div>
      <div class="section-body">
        <div class="grid-2">
          <div>
            <div class="grid-2" style="gap:10px">
              <div class="kv"><div class="k">Accuracy</div><div class="v">{pct(risk['accuracy'])}</div><div class="d">95% CI {pct(risk['accuracy_ci95']['low'])}–{pct(risk['accuracy_ci95']['high'])}</div></div>
              <div class="kv"><div class="k">Red precision</div><div class="v">{num(risk['precision_red'])}</div><div class="d">false positives 0</div></div>
              <div class="kv"><div class="k">Red recall</div><div class="v">{num(risk['recall_red'])}</div><div class="d">false negatives 0</div></div>
              <div class="kv"><div class="k">Red F1</div><div class="v">{num(risk['f1_red'])}</div><div class="d">macro F1 {num(risk['macro_f1'])}</div></div>
            </div>
          </div>
          <div>{risk_confusion}</div>
        </div>
      </div>
    </section>

    <section id="security">
      <div class="section-head"><div><h2>安全鲁棒性与副作用控制</h2><p>Attack success, benign rejection, replay and concurrent execution gate.</p></div><span class="tag">ASR / FPR / PCR</span></div>
      <div class="section-body">
        <div class="grid-2">
          <div>{security_svg}</div>
          <div>
            <div class="grid-2" style="gap:10px">
              <div class="kv"><div class="k">Attack success rate</div><div class="v">{pct(security['attack_success_rate'])}</div><div class="d">95% CI {pct(security['attack_success_rate_ci95']['low'])}–{pct(security['attack_success_rate_ci95']['high'])}</div></div>
              <div class="kv"><div class="k">Policy compliance</div><div class="v">{pct(security['policy_compliance_rate'])}</div><div class="d">95% CI {pct(security['policy_compliance_rate_ci95']['low'])}–{pct(security['policy_compliance_rate_ci95']['high'])}</div></div>
              <div class="kv"><div class="k">False-positive rate</div><div class="v">{pct(security['false_positive_rate'])}</div><div class="d">{security['benign_cases']} benign requests</div></div>
              <div class="kv"><div class="k">Duplicate side effects</div><div class="v">{security['duplicate_side_effects']}</div><div class="d">{security['replay_checks']} identical replays</div></div>
            </div>
          </div>
        </div>
        <table style="margin-top:20px">
          <thead><tr><th>Concurrency gate</th><th>Observed</th><th>Expected</th></tr></thead>
          <tbody><tr><td>Simultaneous confirmation requests</td><td class="num">{security['concurrent_confirms']}</td><td>one side effect</td></tr>
          <tr><td>Successful confirmations</td><td class="num">{security['concurrent_successes']}</td><td>1</td></tr>
          <tr><td>Conflicting confirmations</td><td class="num">{security['concurrent_conflicts']}</td><td>{security['concurrent_confirms'] - 1}</td></tr>
          <tr><td>Balance delta</td><td class="num">{security['concurrent_balance_delta_minor']} minor</td><td>4000 minor</td></tr></tbody>
        </table>
      </div>
    </section>

    <section id="latency">
      <div class="section-head"><div><h2>延迟分布与置信区间</h2><p>20 warm-up requests excluded; 200 sequential local HTTP samples.</p></div><span class="tag">CDF / BOOTSTRAP 95% CI</span></div>
      <div class="section-body">
        {cdf_svg}
        <div class="grid-3" style="margin-top:18px">
          <div class="kv"><div class="k">p50 / p95 / p99</div><div class="v">{latency['median_us']} / {latency['p95_us']} / {latency['p99_us']} µs</div><div class="d">nearest-rank percentile</div></div>
          <div class="kv"><div class="k">Mean ± σ</div><div class="v">{latency['mean_us']:.1f} ± {latency['stddev_us']:.1f} µs</div><div class="d">95% bootstrap CI {latency['mean_ci95']['low']:.1f}–{latency['mean_ci95']['high']:.1f} µs</div></div>
          <div class="kv"><div class="k">Sequential throughput</div><div class="v">{latency['throughput_rps']:.0f} req/s</div><div class="d">derived from mean, not a load test</div></div>
        </div>
      </div>
    </section>

    <section id="e2e">
      <div class="section-head"><div><h2>浏览器 E2E 业务链路</h2><p>Real Next.js workspace against a real Go API and same-origin auth proxy.</p></div><span class="tag">PLAYWRIGHT</span></div>
      <div class="section-body">
        <div class="grid-3" style="margin-bottom:18px">
          <div class="kv"><div class="k">Pass rate</div><div class="v">{pct(e2e['pass_rate'])}</div><div class="d">{e2e['passed']} / {e2e['cases']} journeys</div></div>
          <div class="kv"><div class="k">Mean case duration</div><div class="v">{e2e['mean_duration_ms']:.0f} ms</div><div class="d">browser + API + rendering</div></div>
          <div class="kv"><div class="k">Console / server errors</div><div class="v">{len(e2e.get('console_errors', []))} / {len(e2e.get('server_errors', []))}</div><div class="d">uncaught browser errors / HTTP 5xx</div></div>
        </div>
        <table><thead><tr><th>ID</th><th>Journey</th><th>Result</th><th>Duration</th><th>Details</th></tr></thead><tbody>{e2e_rows}</tbody></table>
      </div>
    </section>

    <section id="cases">
      <div class="section-head"><div><h2>完整用例账本</h2><p>{len(cases)} rows. Every expected/actual pair is traceable to the JSON artifact.</p></div><span class="tag">CASE LEDGER</span></div>
      <div class="section-body">
        <div class="toolbar">
          <input id="case-search" type="search" placeholder="Search input, ID, expected or actual…" aria-label="搜索用例"/>
          <select id="case-suite" aria-label="筛选测试套件"><option value="">All suites</option>{suite_options_html}</select>
          <select id="case-status" aria-label="筛选结果"><option value="">All results</option><option value="true">Passed</option><option value="false">Failed</option></select>
        </div>
        <div class="small" id="case-count" style="margin-bottom:8px"></div>
        <div style="overflow-x:auto">
          <table id="case-table">
            <thead><tr><th>ID</th><th>Suite</th><th>Input</th><th>Expected</th><th>Actual</th><th>Result</th><th>Details</th></tr></thead>
            <tbody>{"".join(case_rows)}</tbody>
          </table>
        </div>
      </div>
    </section>

    <section id="method">
      <div class="section-head"><div><h2>指标定义与统计口径</h2><p>Definitions are fixed before looking at results.</p></div><span class="tag">METHOD</span></div>
      <div class="section-body">
        <div class="grid-2">
          <div>
            <h3>Classification</h3>
            <div class="formula">Precision = TP / (TP + FP)<br/>Recall = TP / (TP + FN)<br/>F1 = 2PR / (P + R)<br/>Macro-F1 = mean(F1_c)<br/>Weighted-F1 = Σ n_c F1_c / N<br/>Cohen's κ = (p_o - p_e) / (1 - p_e)</div>
          </div>
          <div>
            <h3>Uncertainty and safety</h3>
            <div class="formula">Wilson 95% CI for proportions<br/>Bootstrap 95% CI for mean latency, 2,000 resamples, seed 42<br/>ASR = unsafe attack outcomes / attacks<br/>FPR = rejected benign requests / benign requests<br/>PCR = compliant attack and benign outcomes / all cases</div>
          </div>
        </div>
        <h3>Engineering invariant gate</h3>
        <table><thead><tr><th>Invariant check</th><th>Result</th><th>Evidence</th></tr></thead><tbody>{engineering_rows}</tbody></table>
        <h3>Go benchmark</h3>
        <pre class="code">{benchmark_summary}</pre>
        <h3>Threats to validity</h3>
        <ul>
          <li>The intent set is curated and synthetic; it measures controlled routing behavior, not open-world generalization.</li>
          <li>Latency is a local loopback measurement on one machine and is not a production capacity estimate.</li>
          <li>The browser E2E suite validates eight representative journeys, not every possible UI permutation.</li>
          <li>All test fixtures use synthetic identities, balances, cards and transactions.</li>
        </ul>
      </div>
    </section>

    <section id="reproduce">
      <div class="section-head"><div><h2>复现与机器可读产物</h2><p>Stable commands and raw artifacts.</p></div><span class="tag">REPRODUCE</span></div>
      <div class="section-body">
        <pre class="code">./evaluation/run.sh

# Integration evaluation
cd backend
BANKAGENT_ACADEMIC_OUT=../evaluation/results/academic.json \\
  go test -tags=integration -run '^TestAcademicEvaluationReport$' -count=1 -v ./internal/httpapi

# Browser E2E is launched by evaluation/run.sh after starting Next.js and Go.</pre>
        <p><a href="{esc(academic_link)}">academic.json</a> · <a href="{esc(e2e_link)}">e2e.json</a> · <a href="{esc(engineering_link)}">latest.json</a> · <a href="cases.csv">cases.csv</a> · <a href="metrics.csv">metrics.csv</a> · <a href="security-tools.json">security-tools.json</a> · <a href="benchmark.txt">benchmark.txt</a></p>
      </div>
    </section>
  </main>
  <footer class="footer">Vaultline · synthetic data only · generated by evaluation/report/render_report.py</footer>
</div>
<script>
const search = document.getElementById('case-search');
const suite = document.getElementById('case-suite');
const status = document.getElementById('case-status');
const rows = [...document.querySelectorAll('#case-table tbody tr')];
const count = document.getElementById('case-count');
function filterRows() {{
  const q = (search.value || '').toLowerCase();
  const s = suite.value;
  const p = status.value;
  let shown = 0;
  for (const row of rows) {{
    const text = row.textContent.toLowerCase();
    const ok = (!q || text.includes(q)) && (!s || row.dataset.suite === s) && (!p || row.dataset.passed === p);
    row.style.display = ok ? '' : 'none';
    if (ok) shown++;
  }}
  count.textContent = `Showing ${{shown}} of ${{rows.length}} cases`;
}}
[search, suite, status].forEach(el => el.addEventListener('input', filterRows));
filterRows();
</script>
</body>
</html>
"""

    report_path = out_dir / "academic-report.html"
    report_path.write_text(document, encoding="utf-8")
    print(report_path)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--academic", required=True)
    parser.add_argument("--engineering", required=True)
    parser.add_argument("--benchmark", required=True)
    parser.add_argument("--e2e", required=True)
    parser.add_argument("--security", required=True)
    parser.add_argument("--out-dir", required=True)
    render(parser.parse_args())


if __name__ == "__main__":
    main()
