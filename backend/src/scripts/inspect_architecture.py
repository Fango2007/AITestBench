#!/usr/bin/env python3
"""Architecture inspection script for AITestBench.

Emits an ArchitectureTree JSON to stdout on success.
Emits structured error JSON to stderr and exits non-zero on failure.
"""
from __future__ import annotations

import argparse
import json
import os
import struct
import sys
import warnings
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")
warnings.filterwarnings(
    "ignore",
    message=r"resource_tracker: There appear to be .* leaked semaphore objects to clean up at shutdown",
    category=UserWarning,
)

CONFIG_FIRST_MLX_MODEL_TYPES = {"ministral3"}
DECODER_CONFIG_KEYS = ("text_config", "llm_config", "language_config", "decoder_config", "model_config")
TOP_LEVEL_PRESERVE_KEYS = (
    "architectures",
    "model_type",
    "quantization_config",
    "quantization",
    "quant_method",
    "torch_dtype",
    "dtype",
    "modality",
    "modalities",
    "vision_config",
    "projector_config",
    "mm_projector_type",
    "tie_word_embeddings",
)


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


def _architecture_tree(
    model_id: str,
    output_format: str,
    root_node: dict,
    inspection_method: str,
    accuracy: str,
    warnings_: list[str] | None = None,
    cache_config: dict[str, Any] | None = None,
) -> dict:
    tree = {
        "schema_version": "1.0.0",
        "model_id": model_id,
        "format": output_format,
        "inspection_method": inspection_method,
        "accuracy": accuracy,
        "warnings": warnings_ or [],
        "summary": _build_summary(root_node),
        "root": root_node,
        "inspected_at": datetime.now(timezone.utc).isoformat(),
    }
    if cache_config is not None:
        tree["_cache_config"] = cache_config
    return tree


def _is_auth_error(message: str) -> bool:
    lower = message.lower()
    return "401" in message or "403" in message or "authentication" in lower or "gated" in lower


def _is_unsupported_model_error(exc: Exception) -> bool:
    if isinstance(exc, KeyError):
        return True
    msg = str(exc).lower()
    return (
        "architecture registry" in msg
        or "is not supported" in msg
        or ("model type" in msg and "not recognized" in msg)
        or ("model type" in msg and "does not recognize this architecture" in msg)
        or ("not found in" in msg and "mapping" in msg)
    )


def _read_config_dict(model_source: str, hf_token: str | None) -> dict[str, Any]:
    source_path = Path(model_source)
    if source_path.exists():
        config_path = source_path / "config.json" if source_path.is_dir() else source_path
        if config_path.name != "config.json":
            _emit_error("not_inspectable", "Config fallback requires a config.json file")
            sys.exit(1)
        try:
            return json.loads(config_path.read_text(encoding="utf8"))
        except Exception as exc:
            _emit_error("inspection_failed", f"Failed to read MLX config.json: {exc}")
            sys.exit(1)

    try:
        from huggingface_hub import hf_hub_download
    except ImportError as exc:
        _emit_error("inspection_failed", f"huggingface_hub not installed: {exc}")
        sys.exit(1)

    try:
        config_path = hf_hub_download(
            repo_id=model_source,
            filename="config.json",
            token=hf_token if hf_token else None,
        )
        return json.loads(Path(config_path).read_text(encoding="utf8"))
    except Exception as exc:
        msg = str(exc)
        if _is_auth_error(msg):
            _emit_error("hf_token_required", msg)
        else:
            _emit_error("inspection_failed", f"Failed to read MLX config.json: {msg}")
        sys.exit(1)


def _int_config(config: dict[str, Any], *keys: str, default: int = 0) -> int:
    for key in keys:
        value = config.get(key)
        if isinstance(value, bool):
            continue
        if isinstance(value, int):
            return value
        if isinstance(value, float) and value.is_integer():
            return int(value)
    return default


def _bool_config(config: dict[str, Any], key: str, default: bool) -> bool:
    value = config.get(key)
    return value if isinstance(value, bool) else default


def _normalize_decoder_config(config: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any] | None, list[str]]:
    """Return a config with decoder dimensions promoted from common nested locations."""
    normalized = dict(config)
    decoder: dict[str, Any] | None = None
    decoder_key: str | None = None
    for key in DECODER_CONFIG_KEYS:
        candidate = config.get(key)
        if isinstance(candidate, dict):
            score = sum(
                1
                for dim_key in ("hidden_size", "d_model", "n_embd", "num_hidden_layers", "n_layers", "vocab_size")
                if dim_key in candidate
            )
            if score > 0:
                decoder = candidate
                decoder_key = key
                break

    warnings_: list[str] = []
    if decoder is not None:
        merged = dict(decoder)
        for key in TOP_LEVEL_PRESERVE_KEYS:
            if key in config:
                merged[key] = config[key]
        normalized = merged
        warnings_.append(f"Used decoder dimensions from {decoder_key}.")

    return normalized, decoder, warnings_


def _has_quantization_metadata(config: dict[str, Any]) -> bool:
    return any(key in config for key in ("quantization_config", "quantization", "quant_method", "bits", "load_in_4bit"))


def _required_decoder_dimensions(config: dict[str, Any]) -> tuple[int, int, int]:
    hidden_size = _int_config(config, "hidden_size", "d_model", "n_embd", default=0)
    vocab_size = _int_config(config, "vocab_size", default=0)
    num_layers = _int_config(config, "num_hidden_layers", "n_layers", "num_layers", "n_layer", default=0)
    return hidden_size, vocab_size, num_layers


def _param_node(name: str, node_type: str, parameters: int, shape: list[int] | None = None) -> dict:
    return {
        "name": name,
        "type": node_type,
        "parameters": max(parameters, 0),
        "trainable": True,
        "shape": shape,
        "children": [],
    }


def _module_node(name: str, node_type: str, children: list[dict]) -> dict:
    return {
        "name": name,
        "type": node_type,
        "parameters": 0,
        "trainable": True,
        "shape": None,
        "children": children,
    }


def _layer_norm_nodes(hidden_size: int) -> list[dict]:
    return [
        _param_node("input_layernorm", "LayerNorm", hidden_size, [hidden_size]),
        _param_node("post_attention_layernorm", "LayerNorm", hidden_size, [hidden_size]),
    ]


def _dense_mlp_nodes(hidden_size: int, intermediate_size: int) -> list[dict]:
    return [
        _param_node("gate_proj", "Linear", hidden_size * intermediate_size, [intermediate_size, hidden_size]),
        _param_node("up_proj", "Linear", hidden_size * intermediate_size, [intermediate_size, hidden_size]),
        _param_node("down_proj", "Linear", intermediate_size * hidden_size, [hidden_size, intermediate_size]),
    ]


def _moe_mlp_node(config: dict[str, Any], hidden_size: int, intermediate_size: int) -> dict | None:
    num_experts = _int_config(config, "num_local_experts", "num_experts", "n_routed_experts", default=0)
    if num_experts <= 0:
        return None
    moe_intermediate_size = _int_config(
        config,
        "moe_intermediate_size",
        "expert_intermediate_size",
        default=intermediate_size,
    )
    expert_children = [
        _module_node(
            str(index),
            "ConfigExpert",
            _dense_mlp_nodes(hidden_size, moe_intermediate_size),
        )
        for index in range(num_experts)
    ]
    return _module_node(
        "mlp",
        "ConfigMoE",
        [
            _param_node("gate", "Router", hidden_size * num_experts, [num_experts, hidden_size]),
            _module_node("experts", "ModuleList", expert_children),
        ],
    )


def _vision_nodes(config: dict[str, Any]) -> list[dict]:
    vision = config.get("vision_config")
    if not isinstance(vision, dict):
        return []
    hidden_size = _int_config(vision, "hidden_size", "d_model", default=0)
    image_size = _int_config(vision, "image_size", default=0)
    patch_size = _int_config(vision, "patch_size", default=0)
    num_channels = _int_config(vision, "num_channels", default=3)
    num_layers = _int_config(vision, "num_hidden_layers", "num_layers", default=0)
    intermediate_size = _int_config(vision, "intermediate_size", default=hidden_size * 4)
    if not hidden_size or not image_size or not patch_size:
        return []

    patch_count = max((image_size // patch_size) ** 2, 1)
    children = [
        _param_node(
            "patch_embedding",
            "Conv2d",
            hidden_size * num_channels * patch_size * patch_size,
            [hidden_size, num_channels, patch_size, patch_size],
        ),
        _param_node("position_embedding", "Embedding", (patch_count + 1) * hidden_size, [patch_count + 1, hidden_size]),
    ]
    layer_children = []
    for index in range(num_layers):
        layer_children.append(
            _module_node(
                str(index),
                "ConfigVisionLayer",
                [
                    _param_node("self_attn", "Attention", 4 * hidden_size * hidden_size, [4 * hidden_size, hidden_size]),
                    _module_node("mlp", "ConfigMLP", _dense_mlp_nodes(hidden_size, intermediate_size)),
                    _param_node("layer_norm1", "LayerNorm", hidden_size, [hidden_size]),
                    _param_node("layer_norm2", "LayerNorm", hidden_size, [hidden_size]),
                ],
            )
        )
    if layer_children:
        children.append(_module_node("layers", "ModuleList", layer_children))
    return [_module_node("vision_tower", "ConfigVisionModel", children)]


def _projector_nodes(config: dict[str, Any], text_hidden_size: int) -> list[dict]:
    projector = config.get("projector_config")
    if not isinstance(projector, dict):
        projector = {}
    vision = config.get("vision_config") if isinstance(config.get("vision_config"), dict) else {}
    vision_hidden_size = _int_config(projector, "input_hidden_size", "mm_hidden_size", default=0)
    if not vision_hidden_size and isinstance(vision, dict):
        vision_hidden_size = _int_config(vision, "hidden_size", default=0)
    projector_hidden_size = _int_config(projector, "hidden_size", "projector_hidden_size", default=text_hidden_size)
    if not vision_hidden_size or not text_hidden_size:
        return []
    return [
        _module_node(
            "multi_modal_projector",
            "ConfigProjector",
            [
                _param_node("linear_1", "Linear", vision_hidden_size * projector_hidden_size, [projector_hidden_size, vision_hidden_size]),
                _param_node("linear_2", "Linear", projector_hidden_size * text_hidden_size, [text_hidden_size, projector_hidden_size]),
            ],
        )
    ]


def inspect_config_fallback(model_id: str, config: dict[str, Any], output_format: str) -> dict:
    original_config = config
    config, nested_decoder, warnings_ = _normalize_decoder_config(config)
    model_type = str(config.get("model_type") or "unknown")
    architectures = config.get("architectures")
    root_type = (
        str(architectures[0])
        if isinstance(architectures, list) and architectures and isinstance(architectures[0], str)
        else f"{model_type}ConfigModel"
    )
    hidden_size = _int_config(config, "hidden_size", "d_model", "n_embd", default=0)
    intermediate_size = _int_config(config, "intermediate_size", "ffn_dim", "n_inner", default=hidden_size * 4 if hidden_size else 0)
    vocab_size = _int_config(config, "vocab_size", default=0)
    num_layers = _int_config(config, "num_hidden_layers", "n_layers", "num_layers", "n_layer", default=0)
    num_heads = _int_config(config, "num_attention_heads", "n_head", default=0)
    num_kv_heads = _int_config(config, "num_key_value_heads", default=num_heads)
    head_dim = _int_config(config, "head_dim", default=(hidden_size // num_heads if num_heads else 0))
    kv_size = num_kv_heads * head_dim if num_kv_heads and head_dim else hidden_size
    tied_embeddings = _bool_config(config, "tie_word_embeddings", _bool_config(original_config, "tie_word_embeddings", False))

    if not (hidden_size and vocab_size and num_layers):
        nested_keys = ", ".join(k for k in DECODER_CONFIG_KEYS if isinstance(original_config.get(k), dict))
        detail = f"missing required decoder dimensions hidden_size/vocab_size/num_hidden_layers"
        if nested_keys:
            detail += f" after checking nested configs: {nested_keys}"
        _emit_error("not_inspectable", detail)
        sys.exit(1)

    if _has_quantization_metadata(config) or _has_quantization_metadata(original_config):
        warnings_.append("Quantization metadata was ignored for structural parameter estimates.")
    if nested_decoder is not None:
        warnings_.append("Composite model counts include estimated decoder structure from nested text config.")

    children: list[dict] = []
    children.extend(_vision_nodes(original_config))
    children.extend(_projector_nodes(original_config, hidden_size))
    children.append(_param_node("embed_tokens", "Embedding", vocab_size * hidden_size, [vocab_size, hidden_size]))

    layer_children: list[dict] = []
    for index in range(num_layers):
        attention_children = [
            _param_node("q_proj", "Linear", hidden_size * hidden_size, [hidden_size, hidden_size]),
            _param_node("k_proj", "Linear", hidden_size * kv_size, [kv_size, hidden_size]),
            _param_node("v_proj", "Linear", hidden_size * kv_size, [kv_size, hidden_size]),
            _param_node("o_proj", "Linear", hidden_size * hidden_size, [hidden_size, hidden_size]),
        ]
        mlp_node = _moe_mlp_node(config, hidden_size, intermediate_size) or _module_node(
            "mlp",
            "ConfigMLP",
            _dense_mlp_nodes(hidden_size, intermediate_size),
        )
        layer_children.append(
            _module_node(
                str(index),
                "ConfigDecoderLayer",
                [
                    _module_node("self_attn", "ConfigAttention", attention_children),
                    mlp_node,
                    *_layer_norm_nodes(hidden_size),
                ],
            )
        )

    children.append(_module_node("layers", "ModuleList", layer_children))
    children.append(_param_node("norm", "LayerNorm", hidden_size, [hidden_size]))
    if not tied_embeddings:
        children.append(_param_node("lm_head", "Linear", vocab_size * hidden_size, [vocab_size, hidden_size]))
    else:
        warnings_.append("Tied embeddings detected; lm_head duplicate parameters were excluded.")

    root_node = _module_node("", root_type, children)
    return _architecture_tree(
        model_id,
        output_format,
        root_node,
        "config_fallback",
        "estimated",
        warnings_,
        original_config,
    )


def _uses_config_first_mlx_fallback(config: dict[str, Any]) -> bool:
    model_type = config.get("model_type")
    if isinstance(model_type, str) and model_type.lower() in CONFIG_FIRST_MLX_MODEL_TYPES:
        return True
    architectures = config.get("architectures")
    return (
        isinstance(architectures, list)
        and any(isinstance(name, str) and name.lower().startswith("ministral3") for name in architectures)
    )


def inspect_transformers(
    model_id: str,
    hf_token: str | None,
    trust_remote_code: bool,
    output_format: str = "transformers",
) -> dict:
    try:
        from transformers import AutoConfig, AutoModel
    except ImportError as exc:
        return inspect_config_fallback(model_id, _read_config_dict(model_id, hf_token), output_format)

    try:
        config = AutoConfig.from_pretrained(
            model_id,
            token=hf_token if hf_token else None,
            trust_remote_code=trust_remote_code,
        )
    except OSError as exc:
        msg = str(exc)
        if _is_auth_error(msg):
            _emit_error("hf_token_required", msg)
            sys.exit(1)
        _emit_error("inspection_failed", msg)
        sys.exit(1)
    except Exception as exc:
        if _is_unsupported_model_error(exc):
            return inspect_config_fallback(model_id, _read_config_dict(model_id, hf_token), output_format)
        _emit_error("inspection_failed", str(exc))
        sys.exit(1)

    try:
        model = AutoModel.from_config(config, trust_remote_code=trust_remote_code)
    except OSError as exc:
        msg = str(exc)
        if "not found in architecture registry" in msg or "architecture registry" in msg.lower():
            return inspect_config_fallback(model_id, config.to_dict(), output_format)
        _emit_error("inspection_failed", msg)
        sys.exit(1)
    except Exception as exc:
        msg = str(exc)
        if _is_unsupported_model_error(exc):
            return inspect_config_fallback(model_id, config.to_dict(), output_format)
        _emit_error("inspection_failed", msg)
        sys.exit(1)

    root_node = _build_node("", model)
    return _architecture_tree(model_id, output_format, root_node, "transformers_exact", "exact", [], config.to_dict())


def _infer_layer_type(segment: str) -> str:
    seg = segment.lower()
    if any(x in seg for x in ("attn_q", "attn_k", "attn_v", "attn_output", "attention", "self_attn", "q_proj", "k_proj", "v_proj", "wo", "wq", "wk", "wv")):
        return "Attention"
    if "norm" in seg:
        return "LayerNorm"
    if any(x in seg for x in ("ffn_down", "ffn_up", "ffn_gate", "feed_forward", "mlp", "down_proj", "up_proj", "gate_proj", "w1", "w2", "w3")):
        return "Linear"
    if any(x in seg for x in ("embed", "tok_emb", "token_embd", "output.weight")):
        return "Embedding"
    if "router" in seg or "expert" in seg:
        return "MoE"
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

    metadata: dict[str, Any] = {"model_path": model_path, "tensor_count": len(reader.tensors)}
    try:
        metadata["fields"] = {str(key): str(value) for key, value in getattr(reader, "fields", {}).items()}
    except Exception:
        pass
    return _architecture_tree(model_id, "gguf", root_node, "gguf_header", "exact", [], metadata)


def _safetensors_files(model_path: str) -> list[Path]:
    path = Path(model_path)
    if path.is_file() and path.suffix == ".safetensors":
        return [path]
    if path.is_dir():
        return sorted(path.glob("*.safetensors"))
    return []


def _read_safetensors_header(file_path: Path) -> dict[str, Any]:
    with file_path.open("rb") as handle:
        header_len_bytes = handle.read(8)
        if len(header_len_bytes) != 8:
            raise ValueError(f"{file_path.name} is not a valid safetensors file")
        header_len = struct.unpack("<Q", header_len_bytes)[0]
        if header_len <= 0 or header_len > 100 * 1024 * 1024:
            raise ValueError(f"{file_path.name} has an invalid safetensors header length")
        header = handle.read(header_len)
        if len(header) != header_len:
            raise ValueError(f"{file_path.name} has a truncated safetensors header")
    return json.loads(header.decode("utf8"))


def inspect_safetensors_header(model_id: str, model_path: str, hf_token: str | None) -> dict:
    files = _safetensors_files(model_path)
    if not files:
        return inspect_config_fallback(model_id, _read_config_dict(model_path, hf_token), "safetensors")

    root_node: dict = {
        "name": "",
        "type": "SafeTensorsModel",
        "parameters": 0,
        "trainable": False,
        "shape": None,
        "children": [],
    }
    warnings_: list[str] = []
    for file_path in files:
        try:
            header = _read_safetensors_header(file_path)
        except Exception as exc:
            _emit_error("inspection_failed", f"Failed to read SafeTensors header: {exc}")
            sys.exit(1)
        metadata = header.pop("__metadata__", None)
        if isinstance(metadata, dict) and metadata:
            warnings_.append(f"Read metadata keys from {file_path.name}: {', '.join(sorted(metadata.keys()))}.")
        for name, tensor_meta in header.items():
            if not isinstance(tensor_meta, dict):
                continue
            shape = tensor_meta.get("shape")
            if not isinstance(shape, list) or not all(isinstance(dim, int) for dim in shape):
                continue
            _insert_gguf_node(root_node, str(name).split("."), shape)

    if not root_node["children"]:
        _emit_error("not_inspectable", "SafeTensors header did not contain tensor shape metadata")
        sys.exit(1)

    return _architecture_tree(
        model_id,
        "safetensors",
        root_node,
        "safetensors_header",
        "exact",
        warnings_,
        {"model_path": model_path, "files": [file_path.name for file_path in files]},
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Inspect model architecture")
    parser.add_argument("--model_id", required=True)
    parser.add_argument("--hf_token", default=None)
    parser.add_argument("--trust_remote_code", action="store_true", default=False)
    parser.add_argument("--format", dest="format_", default=None, choices=["gguf", "mlx", "gptq", "awq", "safetensors"])
    parser.add_argument("--model_path", default=None)
    args = parser.parse_args()

    if args.format_ == "gguf":
        if not args.model_path:
            _emit_error("not_inspectable", "GGUF inspection requires --model_path")
            sys.exit(1)
        result = inspect_gguf(args.model_id, args.model_path)
    elif args.format_ == "safetensors" and args.model_path:
        result = inspect_safetensors_header(args.model_id, args.model_path, args.hf_token)
    else:
        model_source = args.model_path if args.format_ in {"mlx", "gptq", "awq", "safetensors"} and args.model_path else args.model_id
        if args.format_ == "mlx":
            mlx_config = _read_config_dict(model_source, args.hf_token)
            result = inspect_config_fallback(model_source, mlx_config, "mlx")
        elif args.format_ in {"gptq", "awq", "safetensors"}:
            result = inspect_transformers(model_source, args.hf_token, args.trust_remote_code, args.format_)
        else:
            result = inspect_transformers(model_source, args.hf_token, args.trust_remote_code)
        result["model_id"] = args.model_id

    print(json.dumps(result))


if __name__ == "__main__":
    main()
