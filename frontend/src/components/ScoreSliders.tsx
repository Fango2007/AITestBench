type Dimension = 'accuracy' | 'relevance' | 'coherence' | 'completeness' | 'helpfulness';

const DIMENSIONS: Array<{ key: Dimension; label: string }> = [
  { key: 'accuracy', label: 'Accuracy' },
  { key: 'relevance', label: 'Relevance' },
  { key: 'coherence', label: 'Coherence' },
  { key: 'completeness', label: 'Completeness' },
  { key: 'helpfulness', label: 'Helpfulness' }
];

interface ScoreSlidersProps {
  value: Record<Dimension, number | null>;
  onChange: (dimension: Dimension, value: number) => void;
  showRequired?: boolean;
}

export function ScoreSliders({ value, onChange, showRequired = false }: ScoreSlidersProps) {
  return (
    <div className="score-sliders">
      {DIMENSIONS.map(({ key, label }) => {
        const currentValue = value[key];
        const isMissing = showRequired && currentValue === null;
        return (
          <div key={key} className={`score-slider-row${isMissing ? ' score-slider-required' : ''}`}>
            <label htmlFor={`score-${key}`}>
              {label}
              {isMissing ? <span className="required-indicator" aria-label="required"> *</span> : null}
            </label>
            <div className="score-slider-input">
              <input
                id={`score-${key}`}
                type="range"
                min={1}
                max={5}
                step={1}
                value={currentValue ?? 1}
                onChange={(e) => onChange(key, parseInt(e.target.value, 10))}
                className={isMissing ? 'input-required' : undefined}
                aria-valuemin={1}
                aria-valuemax={5}
                aria-valuenow={currentValue ?? undefined}
              />
              <span className="score-value">{currentValue ?? '—'}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
