import { describe, expect, it } from 'vitest';

import { guessModelCharacteristics } from '../../src/services/model-name-parser.js';

describe('guessModelCharacteristics', () => {
  it('extracts params, quantisation, and provider from an MLX name', () => {
    const result = guessModelCharacteristics('/inferencerlabs/Devstral-Small-2-24B-Instruct-2512-MLX-6.5bit');
    expect(result.provider).toBe('mistral');
    expect(result.parameter_count).toBe(24_000_000_000);
    expect(result.parameter_count_label).toBe('24B');
    expect(result.quantisation.method).toBe('mlx');
    expect(result.quantisation.bits).toBe(6.5);
    expect(result.precision).toBeNull();
  });

  it('extracts meta and precision hints', () => {
    const result = guessModelCharacteristics('meta-llama/Llama-3.1-8B-Instruct-fp16');
    expect(result.provider).toBe('meta');
    expect(result.parameter_count).toBe(8_000_000_000);
    expect(result.precision).toBe('fp16');
  });

  it('extracts AWQ quantisation', () => {
    const result = guessModelCharacteristics('Qwen2.5-72B-AWQ');
    expect(result.provider).toBe('qwen');
    expect(result.parameter_count).toBe(72_000_000_000);
    expect(result.quantisation.method).toBe('awq');
  });
});
