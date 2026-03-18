
# avg_output_tokens.py
# Average Output Tokens Test
# --------------------------

# Estimates the average number of output tokens produced by a model
# over a fixed set of canonical prompts, with temperature and top_p fixed.

# Test kind: python-defined


from typing import List, Dict, Any
import time
import statistics
import requests

TEST_ID = "perf.avg_output_tokens.v1"


def run(test_context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Required entrypoint for python-defined tests.

    test_context provides:
      - inference_server.base_url
      - inference_server.headers
      - model.id
      - test.params
    """

    base_url = test_context["inference_server"]["base_url"]
    headers = test_context["inference_server"].get("headers", {})
    model = test_context["model"]["id"]

    params = test_context.get("params", {})
    prompts: List[str] = params.get("prompts", [])
    temperature: float = params.get("temperature", 0.7)
    top_p: float = params.get("top_p", 0.9)
    max_tokens: int = params.get("max_tokens", 512)

    if not prompts:
        raise ValueError("avg_output_tokens test requires a non-empty prompts list")

    endpoint = f"{base_url}/v1/chat/completions"

    per_prompt_results = []
    token_counts = []

    for idx, prompt in enumerate(prompts, start=1):
        body = {
            "model": model,
            "temperature": temperature,
            "top_p": top_p,
            "max_completion_tokens": max_tokens,
            "stream": False,
            "messages": [
                {"role": "system", "content": "You are a concise assistant."},
                {"role": "user", "content": prompt},
            ],
        }

        start = time.perf_counter()
        resp = requests.post(endpoint, headers=headers, json=body, timeout=30)
        elapsed_ms = (time.perf_counter() - start) * 1000

        if resp.status_code != 200:
            raise RuntimeError(
                f"Request failed for prompt {idx}: "
                f"{resp.status_code} {resp.text}"
            )

        data = resp.json()

        # Preferred: server-reported token usage
        completion_tokens = None
        usage = data.get("usage")
        if usage and "completion_tokens" in usage:
            completion_tokens = usage["completion_tokens"]

        # Fallback: naive token estimation (clearly flagged)
        estimation_method = "reported"
        if completion_tokens is None:
            estimation_method = "estimated"
            content = data["choices"][0]["message"]["content"]
            completion_tokens = len(content.split())

        token_counts.append(completion_tokens)

        per_prompt_results.append({
            "prompt_index": idx,
            "prompt": prompt,
            "completion_tokens": completion_tokens,
            "token_source": estimation_method,
            "latency_ms": elapsed_ms,
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