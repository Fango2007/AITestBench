export interface ContextStrategyInput {
  declared_max_tokens?: number | null;
  profile_strategy?: {
    type: 'fixed' | 'percentage' | 'ramp';
    value?: number;
    ramp?: number[];
    truncation_policy?: 'fail' | 'warn' | 'allow';
  } | null;
}

export interface ContextStrategyResult {
  max_context_tokens: number | null;
  truncation_policy: 'fail' | 'warn' | 'allow';
  ramp_sequence: number[];
}

export function resolveContextStrategy(input: ContextStrategyInput): ContextStrategyResult {
  const strategy = input.profile_strategy;
  const declared = input.declared_max_tokens ?? null;

  if (!strategy) {
    return {
      max_context_tokens: declared,
      truncation_policy: 'warn',
      ramp_sequence: []
    };
  }

  if (strategy.type === 'percentage' && declared) {
    return {
      max_context_tokens: Math.floor((strategy.value ?? 100) / 100 * declared),
      truncation_policy: strategy.truncation_policy ?? 'warn',
      ramp_sequence: []
    };
  }

  if (strategy.type === 'ramp') {
    return {
      max_context_tokens: declared,
      truncation_policy: strategy.truncation_policy ?? 'warn',
      ramp_sequence: strategy.ramp ?? []
    };
  }

  return {
    max_context_tokens: strategy.value ?? declared,
    truncation_policy: strategy.truncation_policy ?? 'warn',
    ramp_sequence: []
  };
}
