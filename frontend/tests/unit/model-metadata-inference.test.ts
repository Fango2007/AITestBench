import { expect, test } from 'vitest';

import { extractBaseModelName, inferModelMetadata } from '../../src/services/model-metadata-inference.js';

test('infers enriched metadata from Devstral MLX model IDs before persistence', () => {
  const metadata = inferModelMetadata('/inferencerlabs/Devstral-Small-2-24B-Instruct-2512-MLX-6.5bit');

  expect(metadata.baseModelName).toBe('Devstral-Small-2-24B-Instruct');
  expect(metadata.provider).toBe('mistral');
  expect(metadata.quantizedProvider).toBe('inferencerlabs');
  expect(metadata.format).toBe('MLX');
  expect(metadata.quantisation.method).toBe('mlx');
  expect(metadata.quantisation.bits).toBe(6.5);
  expect(metadata.useCase.coding).toBe(true);
  expect(metadata.useCase.instruct).toBe(true);
});

test('infers clean names and MLX metadata from LM Studio-style Qwen model IDs', () => {
  const metadata = inferModelMetadata('/lmstudio-community/Qwen3-Coder-30B-A3B-Instruct-MLX-6bit');

  expect(metadata.baseModelName).toBe('Qwen3-Coder-30B-A3B-Instruct');
  expect(metadata.provider).toBe('qwen');
  expect(metadata.quantizedProvider).toBe('lmstudio-community');
  expect(metadata.format).toBe('MLX');
  expect(metadata.quantisation.bits).toBe(6);
  expect(metadata.useCase.coding).toBe(true);
  expect(metadata.useCase.instruct).toBe(true);
  expect(metadata.useCase.mixture_of_experts).toBe(true);
});

test('does not infer a quantized provider for plain unquantized names', () => {
  expect(inferModelMetadata('mistral-small').quantizedProvider).toBeNull();
});

test('infers Moonshot provider from Moonshot and Kimi model names', () => {
  expect(inferModelMetadata('moonshotai/Kimi-K2-Instruct').provider).toBe('moonshot');
  expect(inferModelMetadata('Kimi-Linear-48B-AWQ').provider).toBe('moonshot');
});

test('extractBaseModelName falls back to the unmodified simple name', () => {
  expect(extractBaseModelName('unknown-model')).toBe('unknown-model');
});

test('extractBaseModelName removes provider prefixes even without a leading slash', () => {
  expect(extractBaseModelName('inferencerlabs/Qwen3-Coder-30B-A3B-Instruct')).toBe(
    'Qwen3-Coder-30B-A3B-Instruct'
  );
});

test('extractBaseModelName removes registry and provider prefixes', () => {
  expect(extractBaseModelName('hf.co/inferencerlabs/Qwen3-Coder-30B-A3B-Instruct')).toBe(
    'Qwen3-Coder-30B-A3B-Instruct'
  );
});

test('infers quantized provider after a registry prefix', () => {
  const metadata = inferModelMetadata('hf.co/inferencerlabs/Qwen3-Coder-30B-A3B-Instruct-MLX-6.5bit');

  expect(metadata.baseModelName).toBe('Qwen3-Coder-30B-A3B-Instruct');
  expect(metadata.quantizedProvider).toBe('inferencerlabs');
});
