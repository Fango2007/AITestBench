import fs from 'fs';

export interface PerplexityItem {
  prompt: string;
  options: string[];
  correct: string;
}

export function loadPerplexityDataset(filePath: string): PerplexityItem[] {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw) as PerplexityItem[];
}
