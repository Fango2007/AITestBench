import { useState } from 'react';

import type { InferenceConfig } from '../services/eval-inference-api.js';
import { EvaluationForm } from '../components/EvaluationForm.js';

export function Evaluate() {
  const [compareMode, setCompareMode] = useState(false);
  const [formCount, setFormCount] = useState(2);
  const [sharedPromptText, setSharedPromptText] = useState('');
  const [sharedInferenceConfig, setSharedInferenceConfig] = useState<InferenceConfig>({
    temperature: null,
    top_p: null,
    max_tokens: null,
    quantization_level: null
  });

  function handleToggleCompare() {
    const next = !compareMode;
    setCompareMode(next);
    if (next) setFormCount(2);
  }

  return (
    <div className="page-evaluate">
      <div className="page-header">
        <h2>Evaluate</h2>
        <div className="compare-controls">
          <button type="button" onClick={handleToggleCompare}>
            {compareMode ? 'Single Mode' : 'Compare Mode'}
          </button>
          {compareMode ? (
            <div className="form-count-controls">
              <button
                type="button"
                disabled={formCount <= 2}
                onClick={() => setFormCount((n) => Math.max(2, n - 1))}
              >
                −
              </button>
              <span>{formCount} models</span>
              <button
                type="button"
                disabled={formCount >= 4}
                onClick={() => setFormCount((n) => Math.min(4, n + 1))}
              >
                +
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {compareMode ? (
        <div className="compare-layout">
          <div className="shared-prompt-area">
            <label>
              Shared Prompt
              <textarea
                value={sharedPromptText}
                onChange={(e) => setSharedPromptText(e.target.value)}
                rows={4}
                placeholder="Enter a prompt to send to all models…"
                maxLength={10000}
              />
            </label>
          </div>
          <div className="forms-row">
            {Array.from({ length: formCount }).map((_, i) => (
              <EvaluationForm
                key={i}
                sharedPromptText={sharedPromptText}
                sharedInferenceConfig={sharedInferenceConfig}
                onInferenceConfigChange={i === 0 ? setSharedInferenceConfig : undefined}
              />
            ))}
          </div>
        </div>
      ) : (
        <EvaluationForm />
      )}
    </div>
  );
}
