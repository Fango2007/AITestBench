"""
Shared helpers for Python-defined tests.

Canonical usage:
- Keep the public module contract as `entrypoint(ctx, params)`.
- Use the helpers here for HTTP calls, metrics extraction, redaction, and
  simple statistics so test modules follow one common structure.
"""

from __future__ import annotations

import copy
import math
from typing import Any, Dict, List, Optional


def get_logger(ctx: Any) -> Any:
    return getattr(ctx, "logger", None)


def log_debug(ctx: Any, message: str) -> None:
    logger = get_logger(ctx)
    getattr(logger, "debug", lambda *_: None)(message)


def log_info(ctx: Any, message: str) -> None:
    logger = get_logger(ctx)
    getattr(logger, "info", lambda *_: None)(message)


def log_warn(ctx: Any, message: str) -> None:
    logger = get_logger(ctx)
    warn = getattr(logger, "warn", getattr(logger, "warning", lambda *_: None))
    warn(message)


def render_value(ctx: Any, value: Any) -> Any:
    render = getattr(ctx, "render", None)
    if callable(render):
        return render(value)
    return value


def http_json_request(
    ctx: Any,
    method: str,
    url: str,
    headers: Optional[Dict[str, str]] = None,
    query: Optional[Dict[str, str]] = None,
    body: Any = None,
    timeout_ms: Optional[int] = None,
) -> Any:
    http = getattr(ctx, "http", None)
    if http is None or not hasattr(http, "request"):
        raise RuntimeError("ctx.http.request is required for this test")

    return http.request(
        method=method,
        url=url,
        headers=headers,
        query=query,
        json=body,
        timeout_ms=timeout_ms,
        stream=False,
    )


def require_total_ms(resp: Any, label: str) -> float:
    metrics = getattr(resp, "metrics", None)
    if metrics is None:
        raise RuntimeError(f"Response for {label} request missing .metrics")
    total = getattr(metrics, "total_ms", None)
    if total is None and isinstance(metrics, dict):
        total = metrics.get("total_ms")
    if total is None:
        raise RuntimeError(f"Response for {label} request missing metrics.total_ms")
    return float(total)


def mean(xs: List[float]) -> Optional[float]:
    if not xs:
        return None
    return float(sum(xs) / len(xs))


def median(xs: List[float]) -> Optional[float]:
    if not xs:
        return None
    ys = sorted(xs)
    n = len(ys)
    mid = n // 2
    if n % 2 == 1:
        return float(ys[mid])
    return float((ys[mid - 1] + ys[mid]) / 2.0)


def percentile(xs: List[float], p: float) -> Optional[float]:
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

    k = (p / 100.0) * (n - 1)
    floor_idx = math.floor(k)
    ceil_idx = math.ceil(k)
    if floor_idx == ceil_idx:
        return float(ys[int(k)])
    d0 = ys[floor_idx] * (ceil_idx - k)
    d1 = ys[ceil_idx] * (k - floor_idx)
    return float(d0 + d1)


def redact_headers(headers: Any) -> Any:
    if not isinstance(headers, dict):
        return headers
    redacted = {}
    for key, value in headers.items():
        lower_key = str(key).lower()
        if lower_key in ("authorization", "proxy-authorization", "x-api-key", "api-key"):
            redacted[key] = "REDACTED"
        else:
            redacted[key] = value
    return redacted


def redact_body(body: Any) -> Any:
    if isinstance(body, dict):
        output = copy.deepcopy(body)
        for key in list(output.keys()):
            lower_key = str(key).lower()
            if lower_key in ("api_key", "apikey", "key", "token", "access_token", "refresh_token"):
                output[key] = "REDACTED"
        return output
    return body
