import { useEffect, useState } from 'react';

import type { InferenceConfig } from '../services/eval-inference-api.js';
import { runEvalInference } from '../services/eval-inference-api.js';
import type { EvaluationInput } from '../services/evaluations-api.js';
import { createEvaluation } from '../services/evaluations-api.js';
import type { InferenceServerRecord } from '../services/inference-servers-api.js';
import { listInferenceServers } from '../services/inference-servers-api.js';
import { listModels } from '../services/models-api.js';
import type { ModelRecord } from '../services/models-api.js';
import { RunInferenceServerSelect } from './RunInferenceServerSelect.js';
import { ScoreSliders } from './ScoreSliders.js';

type Dimension = 'accuracy' | 'relevance' | 'coherence' | 'completeness' | 'helpfulness';
type ScoreMap = Record<Dimension, number | null>;

function nullScores(): ScoreMap {
  return {
    accuracy: null,
    relevance: null,
    coherence: null,
    completeness: null,
    helpfulness: null
  };
}

interface MetricsResult {
  answer_text: string;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  latency_ms: number;
  word_count: number;
  estimated_cost: number | null;
}

interface EvaluationFormProps {
  sharedPromptText?: string;
  sharedInferenceConfig?: InferenceConfig;
  onPromptTextChange?: (text: string) => void;
  onInferenceConfigChange?: (config: InferenceConfig) => void;
}

function formatMetric(value: number | null, decimals = 0): string {
  if (value === null) return 'N/A';
  return typeof value === 'number' ? value.toFixed(decimals) : String(value);
}

export function EvaluationForm({
  sharedPromptText,
  sharedInferenceConfig,
  onPromptTextChange,
  onInferenceConfigChange
}: EvaluationFormProps) {
  const [stage, setStage] = useState<'input' | 'score'>('input');
  const [serverId, setServerId] = useState('');
  const [modelName, setModelName] = useState('');
  const [models, setModels] = useState<ModelRecord[]>([]);
  const [promptText, setPromptText] = useState(sharedPromptText ?? '');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [inferenceConfig, setInferenceConfig] = useState<InferenceConfig>(
    sharedInferenceConfig ?? { temperature: null, top_p: null, max_tokens: null, quantization_level: null }
  );
  const [metrics, setMetrics] = useState<MetricsResult | null>(null);
  const [scores, setScores] = useState<ScoreMap>(nullScores());
  const [note, setNote] = useState('');
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showRequired, setShowRequired] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const effectivePromptText = sharedPromptText ?? promptText;
  const effectiveInferenceConfig = sharedInferenceConfig ?? inferenceConfig;

  useEffect(() => {
    if (!serverId) {
      setModels([]);
      return;
    }
    listModels()
      .then((all) => setModels(all.filter((m) => m.model.server_id === serverId && !m.model.archived)))
      .catch(() => setModels([]));
  }, [serverId]);

  function handleInferenceConfigChange(field: keyof InferenceConfig, raw: string) {
    const updated = { ...effectiveInferenceConfig };
    if (field === 'temperature') updated.temperature = raw === '' ? null : parseFloat(raw);
    else if (field === 'top_p') updated.top_p = raw === '' ? null : parseFloat(raw);
    else if (field === 'max_tokens') updated.max_tokens = raw === '' ? null : parseInt(raw, 10);
    else if (field === 'quantization_level') updated.quantization_level = raw === '' ? null : raw;
    if (onInferenceConfigChange) onInferenceConfigChange(updated);
    else setInferenceConfig(updated);
  }

  function addTag(raw: string) {
    const tag = raw.trim().replace(/,+$/, '');
    if (tag && !tags.includes(tag) && tags.length < 20) {
      setTags([...tags, tag]);
    }
    setTagInput('');
  }

  async function handleRun() {
    if (!serverId || !modelName || !effectivePromptText.trim()) return;
    setRunError(null);
    setRunning(true);
    try {
      const result = await runEvalInference({
        server_id: serverId,
        model_name: modelName,
        prompt_text: effectivePromptText,
        inference_config: effectiveInferenceConfig
      });
      setMetrics(result);
      setStage('score');
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Run failed');
    } finally {
      setRunning(false);
    }
  }

  async function handleSave() {
    if (!metrics) return;
    const allScored = Object.values(scores).every((v) => v !== null);
    if (!allScored) {
      setShowRequired(true);
      return;
    }
    setSaveError(null);
    setSaving(true);
    try {
      const input: EvaluationInput = {
        prompt_text: effectivePromptText,
        tags,
        server_id: serverId,
        model_name: modelName,
        inference_config: effectiveInferenceConfig,
        answer_text: metrics.answer_text,
        input_tokens: metrics.input_tokens,
        output_tokens: metrics.output_tokens,
        total_tokens: metrics.total_tokens,
        latency_ms: metrics.latency_ms,
        word_count: metrics.word_count,
        estimated_cost: metrics.estimated_cost,
        accuracy_score: scores.accuracy as number,
        relevance_score: scores.relevance as number,
        coherence_score: scores.coherence as number,
        completeness_score: scores.completeness as number,
        helpfulness_score: scores.helpfulness as number,
        note: note.trim() || null
      };
      await createEvaluation(input);
      window.dispatchEvent(new CustomEvent('evaluations:saved'));
      setSuccessMessage('Evaluation saved successfully.');
      setStage('input');
      setMetrics(null);
      setScores(nullScores());
      setNote('');
      setShowRequired(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const modelOptions = models.map((m) => ({ model_id: m.model.model_id, display_name: m.model.display_name }));

  return (
    <div className="card evaluation-form">
      {successMessage ? (
        <p className="success-message" role="status">{successMessage}</p>
      ) : null}

      {stage === 'input' ? (
        <div className="evaluation-stage-input">
          <RunInferenceServerSelect value={serverId} onChange={setServerId} />
          {modelOptions.length > 0 ? (
            <label>
              Model
              <select value={modelName} onChange={(e) => setModelName(e.target.value)}>
                <option value="">Select a model</option>
                {modelOptions.map((m) => (
                  <option key={m.model_id} value={m.model_id}>{m.display_name ?? m.model_id}</option>
                ))}
              </select>
            </label>
          ) : (
            <label>
              Model
              <input
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                placeholder="mistral:latest"
              />
            </label>
          )}

          {!sharedPromptText ? (
            <label>
              Prompt
              <textarea
                value={promptText}
                onChange={(e) => {
                  setPromptText(e.target.value);
                  onPromptTextChange?.(e.target.value);
                }}
                rows={4}
                placeholder="Enter your prompt..."
                maxLength={10000}
              />
            </label>
          ) : (
            <div className="field">
              <span className="field-label">Prompt (shared)</span>
              <p className="muted">{effectivePromptText}</p>
            </div>
          )}

          <label>
            Tags
            <div className="tag-input-row">
              <div className="tag-chips">
                {tags.map((tag) => (
                  <span key={tag} className="tag-chip">
                    {tag}
                    <button type="button" onClick={() => setTags(tags.filter((t) => t !== tag))} aria-label={`Remove tag ${tag}`}>×</button>
                  </span>
                ))}
              </div>
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === ',' || e.key === 'Enter') {
                    e.preventDefault();
                    addTag(tagInput);
                  }
                }}
                onBlur={() => tagInput.trim() && addTag(tagInput)}
                placeholder="Add tag (press Enter or comma)"
              />
            </div>
          </label>

          <div className="inference-params">
            <label>
              Temperature
              <input
                type="number"
                min={0}
                max={2}
                step={0.01}
                value={effectiveInferenceConfig.temperature ?? ''}
                onChange={(e) => handleInferenceConfigChange('temperature', e.target.value)}
                placeholder="default"
              />
            </label>
            <label>
              Top P
              <input
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={effectiveInferenceConfig.top_p ?? ''}
                onChange={(e) => handleInferenceConfigChange('top_p', e.target.value)}
                placeholder="default"
              />
            </label>
            <label>
              Max Tokens
              <input
                type="number"
                min={1}
                value={effectiveInferenceConfig.max_tokens ?? ''}
                onChange={(e) => handleInferenceConfigChange('max_tokens', e.target.value)}
                placeholder="default"
              />
            </label>
            <label>
              Quantization
              <input
                value={effectiveInferenceConfig.quantization_level ?? ''}
                onChange={(e) => handleInferenceConfigChange('quantization_level', e.target.value)}
                placeholder="default"
              />
            </label>
          </div>

          {runError ? <p className="error">{runError}</p> : null}

          <button
            type="button"
            onClick={() => { setSuccessMessage(null); handleRun(); }}
            disabled={running || !serverId || !modelName || !effectivePromptText.trim()}
          >
            {running ? 'Running…' : 'Run Inference'}
          </button>
        </div>
      ) : (
        <div className="evaluation-stage-score">
          <div className="field">
            <span className="field-label">Answer</span>
            <pre className="answer-text">{metrics?.answer_text}</pre>
          </div>

          {metrics ? (
            <div className="metrics-row">
              <span>Input tokens: <strong>{formatMetric(metrics.input_tokens)}</strong></span>
              <span>Output tokens: <strong>{formatMetric(metrics.output_tokens)}</strong></span>
              <span>Total tokens: <strong>{formatMetric(metrics.total_tokens)}</strong></span>
              <span>Latency: <strong>{metrics.latency_ms.toFixed(0)} ms</strong></span>
              <span>Words: <strong>{formatMetric(metrics.word_count)}</strong></span>
              <span>Cost: <strong>{metrics.estimated_cost !== null ? `$${metrics.estimated_cost.toFixed(6)}` : 'N/A'}</strong></span>
            </div>
          ) : null}

          <ScoreSliders value={scores} onChange={(dim, val) => setScores({ ...scores, [dim]: val })} showRequired={showRequired} />

          <label>
            Note (optional)
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={2000}
              placeholder="Optional notes about this evaluation…"
            />
          </label>

          {saveError ? <p className="error">{saveError}</p> : null}

          <div className="button-row">
            <button type="button" onClick={() => setStage('input')}>Back</button>
            <button type="button" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save Evaluation'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
