"""
Average output tokens performance test.

Canonical Python test module contract:
- The runner imports this module and calls `entrypoint(ctx, params)`.
- `ctx` exposes runner helpers such as `ctx.http`, `ctx.render`, `ctx.logger`,
  `ctx.profile`, `ctx.env`, and `ctx.vars`.
- `params` comes from the Python template descriptor `parameters` object.
"""

from typing import List, Dict, Any
import statistics

from common import http_json_request, log_debug, render_value

TEST_ID = "perf.avg_output_tokens.v1"


def entrypoint(ctx: Any, params: Dict[str, Any]) -> Dict[str, Any]:
    prompts: List[str] = params.get("prompts", [])
    temperature: float = params.get("temperature", 0.7)
    top_p: float = params.get("top_p", 0.9)
    max_tokens: int = params.get("max_tokens", 512)
    system_prompt: str = params.get("system_prompt", "You are a concise assistant.")
    request_timeout_ms = params.get("timeout_ms", 30000)

    if not prompts:
        raise ValueError("avg_output_tokens test requires a non-empty prompts list")

    per_prompt_results = []
    token_counts = []

    for idx, prompt in enumerate(prompts, start=1):
        request_body = {
            "model": "{{profile.selection.model}}",
            "temperature": temperature,
            "top_p": top_p,
            "max_completion_tokens": max_tokens,
            "stream": False,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt},
            ],
        }

        request = render_value(
            ctx,
            {
                "method": "POST",
                "url": "{{profile.server.base_url}}/v1/chat/completions",
                "headers": {"content-type": "application/json"},
                "body": request_body,
                "timeout_ms": request_timeout_ms,
            }
        )
        log_debug(ctx, f"avg_output_tokens request {idx}: {request['url']}")

        response = http_json_request(
            ctx,
            method=request["method"],
            url=request["url"],
            headers=request.get("headers"),
            body=request.get("body"),
            timeout_ms=request.get("timeout_ms"),
        )

        if response.status != 200:
            raise RuntimeError(
                f"Request failed for prompt {idx}: "
                f"{response.status} {response.text}"
            )

        data = response.body or {}
        if not isinstance(data, dict):
            raise RuntimeError(f"Request returned non-JSON body for prompt {idx}")

        # Preferred: server-reported token usage
        completion_tokens = None
        usage = data.get("usage")
        if isinstance(usage, dict) and "completion_tokens" in usage:
            completion_tokens = usage["completion_tokens"]

        # Fallback: naive token estimation (clearly flagged)
        estimation_method = "reported"
        if completion_tokens is None:
            estimation_method = "estimated"
            content = data["choices"][0]["message"]["content"]
            completion_tokens = len(content.split())

        token_counts.append(completion_tokens)
        latency_ms = None
        if isinstance(response.metrics, dict):
            latency_ms = response.metrics.get("total_ms")

        per_prompt_results.append({
            "prompt_index": idx,
            "prompt": prompt,
            "completion_tokens": completion_tokens,
            "token_source": estimation_method,
            "latency_ms": latency_ms,
        })

    metrics = {
        "primary_metric": "avg_output_tokens_mean",
        "avg_output_tokens_mean": statistics.mean(token_counts),
        "avg_output_tokens_median": statistics.median(token_counts),
        "avg_output_tokens_p95": (
            statistics.quantiles(token_counts, n=20)[-1]
            if len(token_counts) >= 5
            else max(token_counts)
        ),
        "samples": len(token_counts),
    }

    return {
        "test_kind": "python",
        "test_id": TEST_ID,
        "parameters": {
            "temperature": temperature,
            "top_p": top_p,
            "max_tokens": max_tokens,
            "num_prompts": len(prompts),
        },
        "per_prompt": per_prompt_results,
        "metrics": metrics,
        "notes": {
            "token_counting": (
                "Uses server-reported completion_tokens when available; "
                "falls back to word-based estimation otherwise."
            )
        },
    }


def run(ctx: Any, params: Dict[str, Any]) -> Dict[str, Any]:
    """Backward-compatible alias for older descriptors."""
    return entrypoint(ctx, params)
