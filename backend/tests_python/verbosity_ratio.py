# verbosity_ratio.py
#
# Python-defined quality/performance test: Verbosity ratio.
#
# Contract:
# - The runner imports this module and calls `entrypoint(ctx, params)`.
# - `ctx` must expose:
#     - ctx.http.request(method, url, headers=None, query=None, json=None, timeout_ms=None, stream=False, transport=None)
#       -> returns a normalised response object with `.status`, `.headers`, `.body`, `.text`, `.stream`, `.metrics`.
#     - ctx.render(obj): templating resolver (optional).
#     - ctx.logger.info/debug/warn/error (optional).
# - `params` is an object/dict matching your python-test template "parameters".
#
# Metric:
#     verbosity_ratio = output_tokens / input_tokens
#
# Interpretation:
# - < 1.0: output is shorter than the prompt, in token terms.
# - ~ 1.0: output length roughly matches prompt length.
# - > 1.0: output is more verbose than the prompt.
#
# Output:
# - Returns a dict containing samples + aggregations, suitable for unified results persistence.

from __future__ import annotations

import json
import re
import time
from typing import Any, Dict, List, Optional, Sequence

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
)


DEFAULT_INPUT_TOKEN_PATHS = [
    "usage.prompt_tokens",                # OpenAI-compatible chat/completions
    "usage.input_tokens",                 # Anthropic-style / generic
    "prompt_eval_count",                  # Ollama generate/chat
    "metrics.input_tokens",               # generic normalised body
    "input_tokens",                       # generic top-level
]

DEFAULT_OUTPUT_TOKEN_PATHS = [
    "usage.completion_tokens",            # OpenAI-compatible chat/completions
    "usage.output_tokens",                # Anthropic-style / generic
    "eval_count",                         # Ollama generate/chat
    "metrics.output_tokens",              # generic normalised body
    "output_tokens",                      # generic top-level
]

TEXT_OUTPUT_PATHS = [
    "choices.0.message.content",          # OpenAI-compatible chat
    "choices.0.text",                     # OpenAI-compatible completion
    "message.content",                    # Ollama chat
    "response",                           # Ollama generate
    "content.0.text",                     # Anthropic-style content list
    "text",                               # generic
]

PROMPT_BODY_PATHS = [
    "prompt",                             # Ollama generate / generic completion
    "messages",                           # chat payload
    "input",                              # generic input
]


_TOKEN_RE = re.compile(r"\S+")


def _get_attr_or_key(obj: Any, key: str) -> Any:
    if isinstance(obj, dict):
        return obj.get(key)
    return getattr(obj, key, None)


def _get_path(obj: Any, path: str) -> Any:
    """Read dotted paths from dicts/lists/objects. Numeric path segments index lists."""
    current = obj
    for part in path.split("."):
        if current is None:
            return None
        if isinstance(current, list):
            if not part.isdigit():
                return None
            idx = int(part)
            if idx < 0 or idx >= len(current):
                return None
            current = current[idx]
        elif isinstance(current, dict):
            current = current.get(part)
        else:
            current = getattr(current, part, None)
    return current


def _first_number_at_paths(obj: Any, paths: Sequence[str]) -> Optional[float]:
    for path in paths:
        value = _get_path(obj, path)
        if isinstance(value, bool):
            continue
        if isinstance(value, (int, float)):
            return float(value)
        if isinstance(value, str):
            try:
                return float(value)
            except ValueError:
                continue
    return None


def _first_text_at_paths(obj: Any, paths: Sequence[str]) -> Optional[str]:
    for path in paths:
        value = _get_path(obj, path)
        if isinstance(value, str) and value:
            return value
    return None


def _rough_token_count(value: Any) -> int:
    """
    Fallback token estimate used only when the server does not return token usage.

    It deliberately uses a simple, deterministic approximation rather than adding
    tokenizer dependencies to the Python-defined test.
    """
    if value is None:
        return 0
    if not isinstance(value, str):
        value = json.dumps(value, ensure_ascii=False, sort_keys=True)
    return len(_TOKEN_RE.findall(value))


def _extract_prompt_material(body: Any) -> Any:
    for path in PROMPT_BODY_PATHS:
        value = _get_path(body, path)
        if value is not None:
            return value
    return body


def _response_body(resp: Any) -> Any:
    body = _get_attr_or_key(resp, "body")
    if body is not None:
        return body

    text = _get_attr_or_key(resp, "text")
    if isinstance(text, str) and text.strip():
        try:
            return json.loads(text)
        except Exception:
            return {"text": text}

    return None


def _status(resp: Any) -> Any:
    return _get_attr_or_key(resp, "status")


def _compute_ratio(input_tokens: float, output_tokens: float) -> Optional[float]:
    if input_tokens <= 0:
        return None
    return float(output_tokens) / float(input_tokens)


def entrypoint(ctx: Any, params: Dict[str, Any]) -> Dict[str, Any]:
    """
    Executes the verbosity-ratio test.

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
        "iterations": 3,
        "sleep_between_ms": 0,
        "token_paths": {
          "input": ["usage.prompt_tokens", "prompt_eval_count"],
          "output": ["usage.completion_tokens", "eval_count"]
        },
        "fallback_token_estimate": true,
        "aggregation": {"primary": "median", "also_compute": ["mean", "p95"]}
      }
    """
    # ---- Validate parameters
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

    iterations = params.get("iterations", 1)
    if not isinstance(iterations, int) or iterations <= 0:
        raise ValueError("params.iterations must be a positive integer")

    sleep_between_ms = params.get("sleep_between_ms", 0)
    if not isinstance(sleep_between_ms, (int, float)) or sleep_between_ms < 0:
        raise ValueError("params.sleep_between_ms must be a non-negative number")

    timeout_ms = req.get("timeout_ms", params.get("timeout_ms", None))

    token_paths = params.get("token_paths") or {}
    if token_paths is not None and not isinstance(token_paths, dict):
        raise ValueError("params.token_paths must be an object if provided")

    input_token_paths = token_paths.get("input") if isinstance(token_paths, dict) else None
    output_token_paths = token_paths.get("output") if isinstance(token_paths, dict) else None

    if input_token_paths is not None and not isinstance(input_token_paths, list):
        raise ValueError("params.token_paths.input must be an array if provided")
    if output_token_paths is not None and not isinstance(output_token_paths, list):
        raise ValueError("params.token_paths.output must be an array if provided")

    input_token_paths = input_token_paths or DEFAULT_INPUT_TOKEN_PATHS
    output_token_paths = output_token_paths or DEFAULT_OUTPUT_TOKEN_PATHS

    fallback_token_estimate = params.get("fallback_token_estimate", True)
    if not isinstance(fallback_token_estimate, bool):
        raise ValueError("params.fallback_token_estimate must be a boolean")

    # ---- Resolve templating if runner supports it
    resolved_req = render_value(ctx, req)
    if resolved_req is not req:
        url = resolved_req.get("url", url)
        method = (resolved_req.get("method", method) or method).upper()
        headers = resolved_req.get("headers", headers) or {}
        query = resolved_req.get("query", query)
        body = resolved_req.get("body", body)
        timeout_ms = resolved_req.get("timeout_ms", timeout_ms)
        log_debug(ctx, "Applied ctx.render to request.")

    # ---- Execute requests
    input_token_samples: List[float] = []
    output_token_samples: List[float] = []
    verbosity_ratio_samples: List[float] = []
    missing_ratio_iterations: List[int] = []
    per_iteration: List[Dict[str, Any]] = []

    for i in range(iterations):
        if sleep_between_ms:
            time.sleep(float(sleep_between_ms) / 1000.0)

        log_info(ctx, f"Verbosity ratio: iteration {i + 1}/{iterations}")
        resp = http_json_request(ctx, method, url, headers, query, body, timeout_ms=timeout_ms)
        resp_body = _response_body(resp)

        input_tokens = _first_number_at_paths(resp_body, input_token_paths)
        output_tokens = _first_number_at_paths(resp_body, output_token_paths)
        source = "server_usage"

        if (input_tokens is None or output_tokens is None) and fallback_token_estimate:
            if input_tokens is None:
                input_tokens = float(_rough_token_count(_extract_prompt_material(body)))
            if output_tokens is None:
                output_text = _first_text_at_paths(resp_body, TEXT_OUTPUT_PATHS)
                output_tokens = float(_rough_token_count(output_text if output_text is not None else resp_body))
            source = "rough_estimate"
            log_warn(ctx, "Server token usage was incomplete; used rough token-count estimate.")

        ratio = None
        if input_tokens is not None and output_tokens is not None:
            ratio = _compute_ratio(float(input_tokens), float(output_tokens))

        if ratio is None:
            missing_ratio_iterations.append(i + 1)
        else:
            input_token_samples.append(float(input_tokens))
            output_token_samples.append(float(output_tokens))
            verbosity_ratio_samples.append(float(ratio))

        per_iteration.append(
            {
                "iteration": i + 1,
                "status": _status(resp),
                "input_tokens": None if input_tokens is None else float(input_tokens),
                "output_tokens": None if output_tokens is None else float(output_tokens),
                "verbosity_ratio": ratio,
                "token_source": source,
            }
        )

    # ---- Aggregations
    aggregation = params.get("aggregation") or {}
    primary = (aggregation.get("primary") or "median") if isinstance(aggregation, dict) else "median"
    also = aggregation.get("also_compute") if isinstance(aggregation, dict) else None
    also = also if isinstance(also, list) else ["mean", "p95"]

    summary: Dict[str, Any] = {
        "verbosity_ratio_median": median(verbosity_ratio_samples),
        "verbosity_ratio_mean": mean(verbosity_ratio_samples),
        "verbosity_ratio_p95": percentile(verbosity_ratio_samples, 95),
        "input_tokens_mean": mean(input_token_samples),
        "output_tokens_mean": mean(output_token_samples),
        "valid_sample_count": len(verbosity_ratio_samples),
        "missing_sample_count": len(missing_ratio_iterations),
    }

    primary_key = {
        "median": "verbosity_ratio_median",
        "mean": "verbosity_ratio_mean",
        "p95": "verbosity_ratio_p95",
    }.get(str(primary).lower(), "verbosity_ratio_median")

    requested = {primary_key, "valid_sample_count", "missing_sample_count"}
    for k in also:
        lk = str(k).lower()
        requested.add(
            {
                "median": "verbosity_ratio_median",
                "mean": "verbosity_ratio_mean",
                "p95": "verbosity_ratio_p95",
                "input_tokens_mean": "input_tokens_mean",
                "output_tokens_mean": "output_tokens_mean",
            }.get(lk, lk)
        )

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
        "test_id": params.get("id") or params.get("test_id") or "quality.verbosity_ratio.v1",
        "observability": {
            "formula": "output_tokens / input_tokens",
            "input_token_paths": input_token_paths,
            "output_token_paths": output_token_paths,
            "fallback_token_estimate": fallback_token_estimate,
            "missing_ratio_iterations": missing_ratio_iterations,
            "note": "Prefer server-reported token usage. Rough estimates are fallback-only and tokenizer-agnostic.",
        },
        "request_snapshot": request_snapshot,
        "samples": {
            "input_tokens": input_token_samples,
            "output_tokens": output_token_samples,
            "verbosity_ratio": verbosity_ratio_samples,
        },
        "per_iteration": per_iteration,
        "metrics": output_summary,
    }

    return result


def run(ctx: Any, params: Dict[str, Any]) -> Dict[str, Any]:
    """Backward-compatible alias for older descriptors."""
    return entrypoint(ctx, params)
