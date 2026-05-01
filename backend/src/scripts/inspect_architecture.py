#!/usr/bin/env python3
"""Architecture inspection script for AITestBench.

Emits an ArchitectureTree JSON to stdout on success.
Emits structured error JSON to stderr and exits non-zero on failure.
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone


def _emit_error(code: str, message: str) -> None:
    json.dump({"error": code, "message": message}, sys.stderr)
    sys.stderr.write("\n")
    sys.stderr.flush()


def _count_params(module) -> int:
    return sum(p.numel() for p in module.parameters(recurse=False))


def _is_trainable(module) -> bool:
    params = list(module.parameters(recurse=False))
    if not params:
        return True
    return all(p.requires_grad for p in params)


def _node_shape(module) -> list | None:
    for p in module.parameters(recurse=False):
        return list(p.shape)
    return None


def _build_node(name: str, module) -> dict:
    children = []
    for child_name, child_module in module.named_children():
        children.append(_build_node(child_name, child_module))
    return {
        "name": name,
        "type": type(module).__name__,
        "parameters": _count_params(module),
        "trainable": _is_trainable(module),
        "shape": _node_shape(module),
        "children": children,
    }


def _build_summary(root_node: dict) -> dict:
    total = 0
    trainable = 0
    by_type: dict[str, dict] = {}

    def _walk(node: dict) -> None:
        nonlocal total, trainable
        params = node["parameters"]
        total += params
        if node["trainable"]:
            trainable += params
        t = node["type"]
        if t not in by_type:
            by_type[t] = {"type": t, "count": 0, "parameters": 0}
        by_type[t]["count"] += 1
        by_type[t]["parameters"] += params
        for child in node["children"]:
            _walk(child)

    _walk(root_node)
    sorted_by_type = sorted(by_type.values(), key=lambda x: x["parameters"], reverse=True)
    return {
        "total_parameters": total,
        "trainable_parameters": trainable,
        "non_trainable_parameters": total - trainable,
        "by_type": sorted_by_type,
    }


def inspect_transformers(model_id: str, hf_token: str | None, trust_remote_code: bool) -> dict:
    try:
        from transformers import AutoConfig, AutoModel
    except ImportError as exc:
        _emit_error("inspection_failed", f"transformers not installed: {exc}")
        sys.exit(1)

    try:
        config = AutoConfig.from_pretrained(
            model_id,
            token=hf_token if hf_token else None,
            trust_remote_code=trust_remote_code,
        )
    except OSError as exc:
        msg = str(exc)
        if "401" in msg or "403" in msg or "authentication" in msg.lower():
            _emit_error("hf_token_required", msg)
            sys.exit(1)
        _emit_error("inspection_failed", msg)
        sys.exit(1)
    except Exception as exc:
        _emit_error("inspection_failed", str(exc))
        sys.exit(1)

    try:
        model = AutoModel.from_config(config, trust_remote_code=trust_remote_code)
    except OSError as exc:
        msg = str(exc)
        if "not found in architecture registry" in msg or "architecture registry" in msg.lower():
            _emit_error("unregistered_architecture", msg)
            sys.exit(1)
        _emit_error("inspection_failed", msg)
        sys.exit(1)
    except Exception as exc:
        msg = str(exc)
        if "architecture registry" in msg.lower() or "is not supported" in msg.lower():
            _emit_error("unregistered_architecture", msg)
            sys.exit(1)
        _emit_error("inspection_failed", msg)
        sys.exit(1)

    root_node = _build_node("", model)
    summary = _build_summary(root_node)

    return {
        "schema_version": "1.0.0",
        "model_id": model_id,
        "format": "transformers",
        "summary": summary,
        "root": root_node,
        "inspected_at": datetime.now(timezone.utc).isoformat(),
    }


def _infer_layer_type(segment: str) -> str:
    seg = segment.lower()
    if any(x in seg for x in ("attn_q", "attn_k", "attn_v", "attn_output", "q_proj", "k_proj", "v_proj")):
        return "Attention"
    if "norm" in seg:
        return "LayerNorm"
    if any(x in seg for x in ("ffn_down", "ffn_up", "ffn_gate", "down_proj", "up_proj", "gate_proj")):
        return "Linear"
    if any(x in seg for x in ("embed", "tok_emb")):
        return "Embedding"
    return "Unknown"


def _insert_gguf_node(root: dict, parts: list[str], shape: list[int]) -> None:
    node = root
    for i, part in enumerate(parts[:-1]):
        existing = next((c for c in node["children"] if c["name"] == part), None)
        if existing is None:
            existing = {
                "name": part,
                "type": "Module",
                "parameters": 0,
                "trainable": False,
                "shape": None,
                "children": [],
            }
            node["children"].append(existing)
        node = existing

    leaf_name = parts[-1]
    leaf_type = _infer_layer_type(leaf_name)
    param_count = 1
    for dim in shape:
        param_count *= dim

    existing_leaf = next((c for c in node["children"] if c["name"] == leaf_name), None)
    if existing_leaf is None:
        node["children"].append({
            "name": leaf_name,
            "type": leaf_type,
            "parameters": param_count,
            "trainable": False,
            "shape": shape,
            "children": [],
        })
    else:
        existing_leaf["parameters"] += param_count


def inspect_gguf(model_id: str, model_path: str) -> dict:
    try:
        from gguf import GGUFReader
    except ImportError as exc:
        _emit_error("inspection_failed", f"gguf not installed: {exc}")
        sys.exit(1)

    try:
        reader = GGUFReader(model_path)
    except Exception as exc:
        _emit_error("inspection_failed", f"Failed to open GGUF file: {exc}")
        sys.exit(1)

    root_node: dict = {
        "name": "",
        "type": "GGUFModel",
        "parameters": 0,
        "trainable": False,
        "shape": None,
        "children": [],
    }

    for tensor in reader.tensors:
        name: str = tensor.name
        shape = list(tensor.shape) if hasattr(tensor, "shape") else []
        parts = name.split(".")
        if not parts:
            continue
        _insert_gguf_node(root_node, parts, shape)

    summary = _build_summary(root_node)

    return {
        "schema_version": "1.0.0",
        "model_id": model_id,
        "format": "gguf",
        "summary": summary,
        "root": root_node,
        "inspected_at": datetime.now(timezone.utc).isoformat(),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Inspect model architecture")
    parser.add_argument("--model_id", required=True)
    parser.add_argument("--hf_token", default=None)
    parser.add_argument("--trust_remote_code", action="store_true", default=False)
    parser.add_argument("--format", dest="format_", default=None, choices=["gguf"])
    parser.add_argument("--model_path", default=None)
    args = parser.parse_args()

    if args.format_ == "gguf":
        if not args.model_path:
            _emit_error("not_inspectable", "GGUF inspection requires --model_path")
            sys.exit(1)
        result = inspect_gguf(args.model_id, args.model_path)
    else:
        result = inspect_transformers(
            args.model_id,
            args.hf_token,
            args.trust_remote_code,
        )

    print(json.dumps(result))


if __name__ == "__main__":
    main()
