# cold_start_penalty.py
#
# Python-defined performance test: Cold-start penalty.
#
# Contract:
# - The runner imports this module and calls `entrypoint(ctx, params)`.
# - `ctx` must expose:
#     - ctx.http.request(method, url, headers=None, query=None, json=None, timeout_ms=None, stream=False, transport=None)
#       -> returns a *normalised response* object with `.status`, `.headers`, `.body`, `.text`, `.stream`, `.metrics`
#          where `.metrics.total_ms` exists (float or int, milliseconds).
#     - ctx.render(obj): templating resolver (optional; if absent, we perform minimal string templating ourselves)
#     - ctx.logger.info/debug/warn/error (optional)
# - `params` is an object/dict matching your python-test template "parameters".
#
# Output:
# - Returns a dict containing samples + aggregations, suitable for your unified results persistence.

from __future__ import annotations

import time
from typing import Any, Dict, List

from common import (
    http_json_request,
    log_debug,
    log_info,
    log_warn,
    mean,
    median,
    percentile,
    redact_body,
    redact_headers,
    render_value,
    require_total_ms,
)


def entrypoint(ctx: Any, params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Executes the cold-start penalty test.

    Expected params shape (suggested):
      {
        "request": {
          "url": "...",
          "method": "POST",
          "headers": {...},
          "body": {...},
          "query": {...} (optional),
          "timeout_ms": 300000 (optional)
        },
        "iterations": 5,
        "sleep_between_ms": 0,
        "cold_condition": {"mode": "none" | "...", ...} (optional),
        "aggregation": {"primary": "median", "also_compute": ["mean","p95"]} (optional)
      }
    """
    # ---- Validate parameters (minimal but strict on essentials)
    req = params.get("request")
    if not isinstance(req, dict):
        raise ValueError("params.request must be an object")

    url = req.get("url")
    method = (req.get("method") or "POST").upper()
    headers = req.get("headers") or {}
    query = req.get("query") or None
    body = req.get("body")

    if not isinstance(url, str) or not url.strip():
        raise ValueError("params.request.url must be a non-empty string")
    if not isinstance(method, str) or not method.strip():
        raise ValueError("params.request.method must be a non-empty string")
    if headers is not None and not isinstance(headers, dict):
        raise ValueError("params.request.headers must be an object if provided")

    iterations = params.get("iterations", 5)
    if not isinstance(iterations, int) or iterations <= 0:
        raise ValueError("params.iterations must be a positive integer")

    sleep_between_ms = params.get("sleep_between_ms", 0)
    if not isinstance(sleep_between_ms, (int, float)) or sleep_between_ms < 0:
        raise ValueError("params.sleep_between_ms must be a non-negative number")

    timeout_ms = req.get("timeout_ms", params.get("timeout_ms", None))

    # ---- Resolve templating if runner supports it
    # If ctx.render exists, it should apply {{vars.*}}/{{profile.*}}/{{env.*}} style rules.
    resolved_req = render_value(ctx, req)
    if resolved_req is not req:
        url = resolved_req.get("url", url)
        method = (resolved_req.get("method", method) or method).upper()
        headers = resolved_req.get("headers", headers) or {}
        query = resolved_req.get("query", query)
        body = resolved_req.get("body", body)
        timeout_ms = resolved_req.get("timeout_ms", timeout_ms)
        log_debug(ctx, "Applied ctx.render to request.")

    # ---- Optional cold condition hook (best-effort)
    # We do NOT assume server supports eviction. We only record intent.
    cold_condition = params.get("cold_condition") or {"mode": "none"}
    cold_mode = (cold_condition.get("mode") or "none") if isinstance(cold_condition, dict) else "none"
    if cold_mode != "none":
        log_warn(ctx, f"cold_condition.mode={cold_mode!r} requested, but this test does not implement eviction. Recording only.")

    # ---- Execute iterations: each iteration does one "cold" then one "hot" request.
    cold_total_ms_samples: List[float] = []
    hot_total_ms_samples: List[float] = []
    penalty_ms_samples: List[float] = []
    per_iteration: List[Dict[str, Any]] = []

    for i in range(iterations):
        if sleep_between_ms:
            time.sleep(float(sleep_between_ms) / 1000.0)

        log_info(ctx, f"Cold-start penalty: iteration {i+1}/{iterations} (cold request)")
        cold_resp = http_json_request(ctx, method, url, headers, query, body, timeout_ms=timeout_ms)
        cold_total = require_total_ms(cold_resp, label="cold")

        log_info(ctx, f"Cold-start penalty: iteration {i+1}/{iterations} (hot request)")
        hot_resp = http_json_request(ctx, method, url, headers, query, body, timeout_ms=timeout_ms)
        hot_total = require_total_ms(hot_resp, label="hot")

        penalty = float(cold_total) - float(hot_total)

        cold_total_ms_samples.append(float(cold_total))
        hot_total_ms_samples.append(float(hot_total))
        penalty_ms_samples.append(float(penalty))

        per_iteration.append(
            {
                "iteration": i + 1,
                "cold": {
                    "status": getattr(cold_resp, "status", None),
                    "total_ms": float(cold_total),
                },
                "hot": {
                    "status": getattr(hot_resp, "status", None),
                    "total_ms": float(hot_total),
                },
                "cold_penalty_ms": float(penalty),
            }
        )

    # ---- Aggregations
    aggregation = params.get("aggregation") or {}
    primary = (aggregation.get("primary") or "median") if isinstance(aggregation, dict) else "median"
    also = aggregation.get("also_compute") if isinstance(aggregation, dict) else None
    also = also if isinstance(also, list) else ["mean", "p95"]

    summary: Dict[str, Any] = {
        "cold_penalty_ms_median": median(penalty_ms_samples),
        "cold_penalty_ms_mean": mean(penalty_ms_samples),
        "cold_penalty_ms_p95": percentile(penalty_ms_samples, 95),
    }

    primary_key = {
        "median": "cold_penalty_ms_median",
        "mean": "cold_penalty_ms_mean",
        "p95": "cold_penalty_ms_p95",
    }.get(str(primary).lower(), "cold_penalty_ms_median")

    # Ensure we only include requested stats (but always include primary + baseline trio for safety)
    requested = set([primary_key])
    for k in also:
        lk = str(k).lower()
        requested.add(
            {
                "median": "cold_penalty_ms_median",
                "mean": "cold_penalty_ms_mean",
                "p95": "cold_penalty_ms_p95",
            }.get(lk, lk)
        )

    # Keep a stable output, but mark which is primary
    output_summary = {
        "primary_metric": primary_key,
        **{key: summary[key] for key in summary.keys() if key in requested or key == primary_key},
    }

    # ---- Traceability (redacted)
    request_snapshot = {
        "url": url,
        "method": method,
        "headers": redact_headers(headers),
        "query": query,
        "body": redact_body(body),
        "timeout_ms": timeout_ms,
    }

    result: Dict[str, Any] = {
        "test_kind": "python",
        "test_id": params.get("id") or params.get("test_id") or "perf.cold_start_penalty.v1",
        "observability": {
            "cold_condition": cold_condition,
            "note": "Cold request is best-effort; true cold depends on server eviction/model residency behaviour.",
        },
        "request_snapshot": request_snapshot,
        "samples": {
            "cold_total_ms": cold_total_ms_samples,
            "hot_total_ms": hot_total_ms_samples,
            "cold_penalty_ms": penalty_ms_samples,
        },
        "per_iteration": per_iteration,
        "metrics": output_summary,
    }

    return result


def run(ctx: Any, params: Dict[str, Any]) -> Dict[str, Any]:
    """Backward-compatible alias for older descriptors."""
    return entrypoint(ctx, params)
