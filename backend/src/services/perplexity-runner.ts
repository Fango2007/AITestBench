import { PerplexityItem } from './perplexity';

export interface ProxyPerplexityResult {
  accuracy: number;
  total: number;
  correct: number;
}

export function computeProxyPerplexity(items: PerplexityItem[]): ProxyPerplexityResult {
  if (items.length === 0) {
    return { accuracy: 0, total: 0, correct: 0 };
  }

  const correct = items.filter((item) => item.options.includes(item.correct)).length;
  return {
    accuracy: correct / items.length,
    total: items.length,
    correct
  };
}
