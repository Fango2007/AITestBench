# cold_start_penalty.py
#
# Python-defined performance test: Cold-start penalty.
#
# Contract:
# - The runner imports this module and calls `run(ctx, params)`.
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

import copy
import math
import time
from typing import Any, Dict, List, Optional, Tuple


def run(ctx: Any, params: Dict[str, Any]) -> Dict[str, Any]:
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
    logger = getattr(ctx, "logger", None)
    log_info = getattr(logger, "info", lambda *_: None)
    log_warn = getattr(logger, "warn", getattr(logger, "warning", lambda *_: None))
    log_debug = getattr(logger, "debug", lambda *_: None)

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
    render = getattr(ctx, "render", None)
    if callable(render):
        resolved_req = render(copy.deepcopy(req))
        url = resolved_req.get("url", url)
        method = (resolved_req.get("method", method) or method).upper()
        headers = resolved_req.get("headers", headers) or {}
        query = resolved_req.get("query", query)
        body = resolved_req.get("body", body)
        timeout_ms = resolved_req.get("timeout_ms", timeout_ms)
        log_debug("Applied ctx.render to request.")
    else:
        resolved_req = copy.deepcopy(req)

    # ---- Optional cold condition hook (best-effort)
    # We do NOT assume server supports eviction. We only record intent.
    cold_condition = params.get("cold_condition") or {"mode": "none"}
    cold_mode = (cold_condition.get("mode") or "none") if isinstance(cold_condition, dict) else "none"
    if cold_mode != "none":
        log_warn(f"cold_condition.mode={cold_mode!r} requested, but this test does not implement eviction. Recording only.")

    # ---- Execute iterations: each iteration does one "cold" then one "hot" request.
    cold_total_ms_samples: List[float] = []
    hot_total_ms_samples: List[float] = []
    penalty_ms_samples: List[float] = []
    per_iteration: List[Dict[str, Any]] = []

    for i in range(iterations):
        if sleep_between_ms:
            time.sleep(float(sleep_between_ms) / 1000.0)

        log_info(f"Cold-start penalty: iteration {i+1}/{iterations} (cold request)")
        cold_resp = _http_request(ctx, method, url, headers, query, body, timeout_ms=timeout_ms)
        cold_total = _require_total_ms(cold_resp, label="cold")

        log_info(f"Cold-start penalty: iteration {i+1}/{iterations} (hot request)")
        hot_resp = _http_request(ctx, method, url, headers, query, body, timeout_ms=timeout_ms)
        hot_total = _require_total_ms(hot_resp, label="hot")

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
        "cold_penalty_ms_median": _median(penalty_ms_samples),
        "cold_penalty_ms_mean": _mean(penalty_ms_samples),
        "cold_penalty_ms_p95": _percentile(penalty_ms_samples, 95),
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
        **{k: summary[k] for k in summary.keys()},
    }

    # ---- Traceability (redacted)
    request_snapshot = {
        "url": url,
        "method": method,
        "headers": _redact_headers(headers),
        "query": query,
        "body": _redact_body(body),
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


# ---------------------------
# Helpers
# ---------------------------

def _http_request(
    ctx: Any,
    method: str,
    url: str,
    headers: Optional[Dict[str, str]],
    query: Optional[Dict[str, str]],
    body: Any,
    timeout_ms: Optional[int] = None,
) -> Any:
    """
    Uses ctx.http.request(...) and returns the normalised response.
    """
    http = getattr(ctx, "http", None)
    if http is None or not hasattr(http, "request"):
        raise RuntimeError("ctx.http.request is required for this test")

    # Some runners use json=, some use body=; we assume json= for structured payloads.
    # If your runner expects a different signature, adapt here.
    return http.request(
        method=method,
        url=url,
        headers=headers,
        query=query,
        json=body,
        timeout_ms=timeout_ms,
        stream=False,
    )


def _require_total_ms(resp: Any, label: str) -> float:
    metrics = getattr(resp, "metrics", None)
    if metrics is None:
        raise RuntimeError(f"Response for {label} request missing .metrics")
    total = getattr(metrics, "total_ms", None)
    if total is None:
        # Sometimes metrics is dict-like
        if isinstance(metrics, dict):
            total = metrics.get("total_ms")
    if total is None:
        raise RuntimeError(f"Response for {label} request missing metrics.total_ms")
    return float(total)


def _mean(xs: List[float]) -> Optional[float]:
    if not xs:
        return None
    return float(sum(xs) / len(xs))


def _median(xs: List[float]) -> Optional[float]:
    if not xs:
        return None
    ys = sorted(xs)
    n = len(ys)
    mid = n // 2
    if n % 2 == 1:
        return float(ys[mid])
    return float((ys[mid - 1] + ys[mid]) / 2.0)


def _percentile(xs: List[float], p: float) -> Optional[float]:
    """
    Linear interpolation between closest ranks.
    """
    if not xs:
        return None
    if p <= 0:
        return float(min(xs))
    if p >= 100:
        return float(max(xs))

    ys = sorted(xs)
    n = len(ys)
    if n == 1:
        return float(ys[0])

    # position in [0, n-1]
    k = (p / 100.0) * (n - 1)
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return float(ys[int(k)])
    d0 = ys[f] * (c - k)
    d1 = ys[c] * (k - f)
    return float(d0 + d1)


def _redact_headers(headers: Any) -> Any:
    if not isinstance(headers, dict):
        return headers
    redacted = {}
    for k, v in headers.items():
        lk = str(k).lower()
        if lk in ("authorization", "proxy-authorization", "x-api-key", "api-key"):
            redacted[k] = "REDACTED"
        else:
            redacted[k] = v
    return redacted


def _redact_body(body: Any) -> Any:
    """
    Redact obvious secret-like fields in JSON bodies.
    """
    if isinstance(body, dict):
        body2 = copy.deepcopy(body)
        for key in list(body2.keys()):
            lk = str(key).lower()
            if lk in ("api_key", "apikey", "key", "token", "access_token", "refresh_token"):
                body2[key] = "REDACTED"
        return body2
    return body