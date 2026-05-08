import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

import { InferenceServerErrors } from '../components/InferenceServerErrors.js';
import { InferenceServerRecord, listInferenceServers } from '../services/inference-servers-api.js';
import { listModels, ModelRecord } from '../services/models-api.js';
import { TemplateRecord, listTemplates } from '../services/templates-api.js';
import {
  cancelRunGroup,
  createRunGroup,
  getRunGroup,
  type RunGroupDetail,
  type RunGroupItem
} from '../services/run-groups-api.js';
import {
  RUN_ACCENTS,
  assignRunAccents,
  mergeRunModelOptions,
  parseRunTargets,
  serializeRunTargets,
  summarizeRunGroup,
  targetKey,
  type RunModelOption,
  type RunTarget
} from '../services/run-unified-utils.js';

function formatMetric(value: unknown, suffix = 'ms'): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(1)} ${suffix}` : 'N/A';
}

function formatNumber(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toFixed(1) : 'N/A';
}

function optionLabel(option: RunModelOption): string {
  return `${option.display_name} · ${option.server_name}`;
}

function extractPrompt(template: TemplateRecord | undefined): string {
  if (!template) {
    return 'Select a template to preview the shared prompt.';
  }
  try {
    const parsed = JSON.parse(template.content) as Record<string, unknown>;
    const request = (parsed.request as Record<string, unknown>) ?? {};
    const body = (request.body_template as Record<string, unknown>) ?? {};
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const content = messages
      .map((message) => {
        if (!message || typeof message !== 'object') {
          return null;
        }
        const record = message as Record<string, unknown>;
        return typeof record.content === 'string' ? record.content : null;
      })
      .filter(Boolean)
      .join(' ');
    return content || String(body.prompt ?? parsed.description ?? 'No prompt preview available.');
  } catch {
    return 'No prompt preview available.';
  }
}

function extractResponseText(item: RunGroupItem | null): string {
  if (!item) {
    return 'Waiting for a run.';
  }
  const result = item.results[0];
  const artefacts = result?.artefacts ?? null;
  const body = artefacts?.response_body;
  if (typeof body === 'string' && body.trim()) {
    return body;
  }
  const preview = artefacts?.response_preview;
  if (typeof preview === 'string' && preview.trim()) {
    return preview;
  }
  if (item.status === 'failed') {
    return item.failure_reason ?? result?.failure_reason ?? 'Run failed.';
  }
  if (item.status === 'completed') {
    return result?.verdict ? `Completed with verdict: ${result.verdict}` : 'Completed.';
  }
  return item.status === 'queued' ? 'Queued.' : 'Running.';
}

function resultMetrics(item: RunGroupItem | null): Record<string, unknown> {
  return item?.results[0]?.metrics ?? {};
}

function resultAssertions(item: RunGroupItem | null): { passed: number; total: number } {
  const results = item?.results ?? [];
  if (results.length === 0) {
    return { passed: 0, total: 0 };
  }
  return {
    passed: results.filter((result) => result.verdict === 'pass' || result.verdict === 'skip').length,
    total: results.length
  };
}

function findItemForTarget(group: RunGroupDetail | null, target: RunTarget): RunGroupItem | null {
  return group?.items.find((item) => item.inference_server_id === target.inference_server_id && item.model_id === target.model_id) ?? null;
}

function ConfigRail({
  servers,
  options,
  selectedTargets,
  selectedTemplateIds,
  templates,
  busy,
  timeoutSec,
  seed,
  runGroup,
  customServerId,
  customModelId,
  onAddTarget,
  onRemoveTarget,
  onCustomServerChange,
  onCustomModelChange,
  onTemplateChange,
  onTimeoutChange,
  onSeedChange,
  onRun,
  onStop
}: {
  servers: InferenceServerRecord[];
  options: RunModelOption[];
  selectedTargets: RunTarget[];
  selectedTemplateIds: string[];
  templates: TemplateRecord[];
  busy: boolean;
  timeoutSec: string;
  seed: string;
  runGroup: RunGroupDetail | null;
  customServerId: string;
  customModelId: string;
  onAddTarget: (target: RunTarget) => void;
  onRemoveTarget: (target: RunTarget) => void;
  onCustomServerChange: (value: string) => void;
  onCustomModelChange: (value: string) => void;
  onTemplateChange: (ids: string[]) => void;
  onTimeoutChange: (value: string) => void;
  onSeedChange: (value: string) => void;
  onRun: () => void;
  onStop: () => void;
}) {
  const accentedTargets = assignRunAccents(selectedTargets);
  const selectedKeys = new Set(selectedTargets.map(targetKey));
  const remainingOptions = options.filter((option) => !selectedKeys.has(targetKey(option)));
  const selectedOptions = new Map(options.map((option) => [targetKey(option), option]));
  const serverLabel = useMemo(() => {
    const serverIds = Array.from(new Set(selectedTargets.map((target) => target.inference_server_id)));
    if (serverIds.length === 0) {
      return servers[0]?.inference_server.display_name ?? 'No server selected';
    }
    if (serverIds.length > 1) {
      return "any · use each model's home server";
    }
    return servers.find((server) => server.inference_server.server_id === serverIds[0])?.inference_server.display_name ?? serverIds[0];
  }, [selectedTargets, servers]);
  const canRun = selectedTargets.length > 0 && selectedTemplateIds.length > 0 && !busy;
  const isRunning = runGroup?.status === 'running' || runGroup?.status === 'queued';
  const canAddCustom = Boolean(customServerId && customModelId.trim() && selectedTargets.length < 8);

  return (
    <aside className="run-config-rail" aria-label="Run configuration">
      <div className="run-config-step">
        <div className="run-step-label">Step 1 · server</div>
        <div className="run-server-field">
          <span>{serverLabel}</span>
          <button type="button" disabled>edit</button>
        </div>
        <label className="run-server-select">
          Inference server
          <select value={customServerId} onChange={(event) => onCustomServerChange(event.target.value)}>
            <option value="">Select an inference server</option>
            {servers.map((server) => (
              <option key={server.inference_server.server_id} value={server.inference_server.server_id}>
                {server.inference_server.display_name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="run-config-step">
        <div className="run-step-label">Step 2 · model(s)</div>
        <div className={selectedTargets.length === 0 ? 'run-chip-cloud is-empty' : 'run-chip-cloud'}>
          {accentedTargets.map((target) => {
            const option = selectedOptions.get(targetKey(target));
            return (
              <span className="run-model-chip" key={targetKey(target)}>
                <span className="run-avatar" style={{ background: target.accent }}>{target.stable_letter}</span>
                <span title={option?.display_name ?? target.model_id}>{option?.display_name ?? target.model_id}</span>
                <button type="button" aria-label={`Remove ${option?.display_name ?? target.model_id}`} onClick={() => onRemoveTarget(target)}>x</button>
              </span>
            );
          })}
          <label className="run-add-model">
            Add model
            <select
              value=""
              onChange={(event) => {
                const value = event.target.value;
                if (!value) {
                  return;
                }
                const option = options.find((entry) => targetKey(entry) === value);
                if (option) {
                  onAddTarget(option);
                }
              }}
              disabled={selectedTargets.length >= 8 || remainingOptions.length === 0}
            >
              <option value="">{selectedTargets.length >= 8 ? 'Max 8 selected' : 'add another...'}</option>
              {remainingOptions.map((option) => (
                <option key={targetKey(option)} value={targetKey(option)}>
                  {optionLabel(option)}
                </option>
              ))}
            </select>
          </label>
          <label className="run-custom-model">
            Model
            <input
              value={customModelId}
              onChange={(event) => onCustomModelChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && canAddCustom) {
                  event.preventDefault();
                  onAddTarget({ inference_server_id: customServerId, model_id: customModelId.trim() });
                  onCustomModelChange('');
                }
              }}
              placeholder="mistral:latest"
              disabled={selectedTargets.length >= 8}
            />
          </label>
          <button
            type="button"
            className="run-add-custom-button"
            disabled={!canAddCustom}
            onClick={() => {
              onAddTarget({ inference_server_id: customServerId, model_id: customModelId.trim() });
              onCustomModelChange('');
            }}
          >
            Add model
          </button>
        </div>
        <div className="run-count-line">
          {selectedTargets.length} of {options.length} · max 8
        </div>
        <p className="run-hint">
          {selectedTargets.length <= 1
            ? 'Add a second model to compare side-by-side. Same template, same params.'
            : `Comparing ${selectedTargets.length} models. Each gets its own column.`}
        </p>
      </div>

      <div className={selectedTargets.length === 0 ? 'run-config-step is-disabled' : 'run-config-step'}>
        <div className="run-step-label">Step 3 · template</div>
        <label className="run-template-picker">
          Templates
          <select
            multiple
            value={selectedTemplateIds}
            onChange={(event) => onTemplateChange(Array.from(event.target.selectedOptions).map((option) => option.value))}
            disabled={selectedTargets.length === 0}
          >
            {templates.map((template) => (
              <option key={`${template.id}:${template.version}`} value={template.id}>
                {template.name} ({template.type.toUpperCase()})
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className={selectedTargets.length === 0 ? 'run-config-step is-disabled' : 'run-config-step'}>
        <div className="run-step-label">Step 4 · options</div>
        <div className="run-options-grid">
          <label>
            Iterations
            <input value="1" readOnly />
          </label>
          <label>
            Concurrency
            <input value="1" readOnly />
          </label>
          <label>
            Timeout
            <input value={timeoutSec} onChange={(event) => onTimeoutChange(event.target.value)} />
          </label>
          <label>
            Seed
            <input value={seed} onChange={(event) => onSeedChange(event.target.value)} />
          </label>
        </div>
      </div>

      <div className="run-actions-row">
        <button type="button" onClick={onRun} disabled={!canRun}>
          Run · {selectedTargets.length} models × {selectedTemplateIds.length} templates
        </button>
        <button type="button" className="run-ghost-button" onClick={onStop} disabled={!isRunning || busy}>
          Stop
        </button>
      </div>
    </aside>
  );
}

function SharedPromptStrip({ prompt }: { prompt: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="run-prompt-strip">
      <span>Shared prompt</span>
      <code>{prompt}</code>
      <button type="button" onClick={() => setExpanded((value) => !value)}>
        {expanded ? 'collapse' : 'expand'}
      </button>
      {expanded ? <pre>{prompt}</pre> : null}
    </div>
  );
}

function RunUnifiedEmpty() {
  return (
    <div className="run-empty-state">
      <div className="run-empty-blocks" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <h2>Pick model(s) to run</h2>
      <p>One Run page handles both a single target and side-by-side comparison. Add one model for detail, or add more to compare the same template and parameters across every target.</p>
      <div className="actions">
        <button type="button" disabled>Load saved set</button>
        <button type="button" disabled>Browse catalog</button>
      </div>
    </div>
  );
}

function SingleResponseDetail({
  target,
  option,
  item
}: {
  target: RunTarget;
  option: RunModelOption | undefined;
  item: RunGroupItem | null;
}) {
  const metrics = resultMetrics(item);
  const asserts = resultAssertions(item);
  const letter = 'A';
  return (
    <div className="run-single-detail">
      <main className="run-transcript">
        <header className="run-response-header">
          <span className="run-avatar is-large" style={{ background: RUN_ACCENTS[0] }}>{letter}</span>
          <div>
            <strong>{option?.display_name ?? target.model_id}</strong>
            <span>{option?.server_name ?? target.inference_server_id}{option?.quantisation ? ` · ${option.quantisation}` : ''}</span>
          </div>
          <b className={`run-status-pill status-${item?.status ?? 'idle'}`}>{item?.status ?? 'idle'}</b>
        </header>
        <section className="run-message-card">
          <span>assistant · final</span>
          <pre>{extractResponseText(item)}</pre>
        </section>
        <section className="run-asserts">
          <h3>Asserts · {asserts.passed} of {asserts.total} pass</h3>
          {(item?.results ?? []).map((result) => (
            <div key={result.id} className={result.verdict === 'fail' ? 'run-assert-row is-fail' : 'run-assert-row'}>
              <span>{result.verdict === 'fail' ? 'x' : 'ok'}</span>
              <code>{result.test_id}</code>
            </div>
          ))}
        </section>
      </main>
      <aside className="run-side-metrics">
        <h3>Metrics</h3>
        <div className="run-metric-grid">
          <span><b>latency</b>{formatMetric(metrics.total_ms)}</span>
          <span><b>throughput</b>{formatNumber(metrics.tokens_per_sec)} tok/s</span>
          <span><b>tokens in</b>{formatNumber(metrics.prompt_tokens)}</span>
          <span><b>tokens out</b>{formatNumber(metrics.completion_tokens)}</span>
          <span><b>cost</b>N/A</span>
          <span><b>ttft</b>{formatMetric(metrics.ttfb_ms)}</span>
        </div>
        <details>
          <summary>Raw envelope</summary>
          <pre>{JSON.stringify(item ?? {}, null, 2)}</pre>
        </details>
        <div className="run-side-actions">
          <button type="button" disabled>Re-run with same params</button>
          <button type="button" disabled>Open in Evaluate</button>
          <button type="button" disabled>Copy as cURL</button>
        </div>
      </aside>
    </div>
  );
}

function CompareColumn({
  target,
  option,
  item,
  index
}: {
  target: RunTarget;
  option: RunModelOption | undefined;
  item: RunGroupItem | null;
  index: number;
}) {
  const metrics = resultMetrics(item);
  const asserts = resultAssertions(item);
  const status = item?.status ?? 'idle';
  return (
    <article className="run-compare-column">
      <header>
        <span className="run-avatar" style={{ background: RUN_ACCENTS[index] }}>{String.fromCharCode(65 + index)}</span>
        <div>
          <strong>{option?.display_name ?? target.model_id}</strong>
          <span>{option?.server_name ?? target.inference_server_id}{option?.quantisation ? ` · ${option.quantisation}` : ''}</span>
        </div>
        <b className={`run-status-pill status-${status}`}>{status}</b>
        <div className="run-column-metrics">
          <span><b>lat</b>{formatMetric(metrics.total_ms)}</span>
          <span><b>tok/s</b>{formatNumber(metrics.tokens_per_sec)}</span>
          <span><b>assert</b>{asserts.passed}/{asserts.total}</span>
        </div>
      </header>
      <div className="run-column-body">
        {status === 'failed' ? (
          <div className="run-error-card">{item?.failure_reason ?? item?.results[0]?.failure_reason ?? 'Run failed.'}</div>
        ) : null}
        <pre>{extractResponseText(item)}</pre>
      </div>
    </article>
  );
}

function CompareSummary({ group }: { group: RunGroupDetail | null }) {
  const summary = summarizeRunGroup(group);
  return (
    <footer className="run-summary-footer">
      <span>Summary</span>
      <code>{summary.pass} pass · {summary.streaming} streaming · {summary.failed} failed · {summary.canceled} canceled</code>
      {summary.fastest ? <code>fastest: {summary.fastest.letter} · {summary.fastest.total_ms.toFixed(1)}ms</code> : null}
      <div className="run-diff-toggle" aria-label="Diff view">
        <button type="button" className="is-active">aligned</button>
        <button type="button" disabled>raw</button>
        <button type="button" disabled>diff</button>
      </div>
    </footer>
  );
}

export function RunUnified() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [servers, setServers] = useState<InferenceServerRecord[]>([]);
  const [models, setModels] = useState<ModelRecord[]>([]);
  const [templates, setTemplates] = useState<TemplateRecord[]>([]);
  const [selectedTargets, setSelectedTargets] = useState<RunTarget[]>(() => parseRunTargets(searchParams));
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);
  const [customServerId, setCustomServerId] = useState('');
  const [customModelId, setCustomModelId] = useState('');
  const [timeoutSec, setTimeoutSec] = useState('30');
  const [seed, setSeed] = useState('');
  const [runGroup, setRunGroup] = useState<RunGroupDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listInferenceServers(), listModels(), listTemplates()])
      .then(([serverData, modelData, templateData]) => {
        setServers(serverData);
        setModels(modelData);
        setTemplates(templateData);
        setCustomServerId((current) => current || serverData[0]?.inference_server.server_id || '');
        setSelectedTemplateIds((current) => current.length > 0 ? current : templateData.slice(0, 1).map((template) => template.id));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load run configuration.'));
  }, []);

  useEffect(() => {
    setSelectedTargets(parseRunTargets(searchParams));
  }, [searchParams]);

  useEffect(() => {
    const current = parseRunTargets(searchParams);
    if (JSON.stringify(current) === JSON.stringify(selectedTargets)) {
      return;
    }
    setSearchParams(serializeRunTargets(selectedTargets), { replace: true });
  }, [searchParams, selectedTargets, setSearchParams]);

  useEffect(() => {
    if (!runGroup || (runGroup.status !== 'running' && runGroup.status !== 'queued')) {
      return;
    }
    let active = true;
    const intervalId = window.setInterval(() => {
      getRunGroup(runGroup.id)
        .then((next) => {
          if (active) {
            setRunGroup(next);
          }
        })
        .catch((err) => {
          if (active) {
            setError(err instanceof Error ? err.message : 'Unable to refresh run group.');
          }
        });
    }, 1000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [runGroup]);

  const options = useMemo(() => mergeRunModelOptions(servers, models), [servers, models]);
  const optionMap = useMemo(() => new Map(options.map((option) => [targetKey(option), option])), [options]);
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateIds[0]);
  const subtitle = selectedTargets.length <= 1
    ? `${selectedTargets[0]?.model_id ?? 'No model'} · ${selectedTemplate?.name ?? 'No template'}`
    : `${selectedTargets.length} models · running ${selectedTemplate?.name ?? 'template set'}`;

  function addTarget(target: RunTarget) {
    setRunGroup(null);
    setSelectedTargets((current) => {
      if (current.length >= 8 || current.some((entry) => targetKey(entry) === targetKey(target))) {
        return current;
      }
      return [...current, target];
    });
  }

  function removeTarget(target: RunTarget) {
    setRunGroup(null);
    setSelectedTargets((current) => current.filter((entry) => targetKey(entry) !== targetKey(target)));
  }

  async function handleRun() {
    setBusy(true);
    setError(null);
    try {
      const timeoutValue = Number(timeoutSec);
      const seedValue = Number(seed);
      const testOverrides: Record<string, unknown> = {};
      if (Number.isFinite(timeoutValue) && timeoutValue > 0) {
        testOverrides.request_timeout_sec = timeoutValue;
      }
      if (seed.trim() && Number.isFinite(seedValue)) {
        testOverrides.seed = seedValue;
      }
      const group = await createRunGroup({
        targets: selectedTargets,
        selected_template_ids: selectedTemplateIds,
        test_overrides: Object.keys(testOverrides).length ? testOverrides : undefined
      });
      setRunGroup(group);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start run group.');
    } finally {
      setBusy(false);
    }
  }

  async function handleStop() {
    if (!runGroup) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setRunGroup(await cancelRunGroup(runGroup.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to stop run group.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="run-unified-page">
      <InferenceServerErrors message={error} />
      <div className="run-unified-layout">
        <ConfigRail
          servers={servers}
          options={options}
          selectedTargets={selectedTargets}
          selectedTemplateIds={selectedTemplateIds}
          templates={templates}
          busy={busy}
          timeoutSec={timeoutSec}
          seed={seed}
          runGroup={runGroup}
          customServerId={customServerId}
          customModelId={customModelId}
          onAddTarget={addTarget}
          onRemoveTarget={removeTarget}
          onCustomServerChange={setCustomServerId}
          onCustomModelChange={setCustomModelId}
          onTemplateChange={setSelectedTemplateIds}
          onTimeoutChange={setTimeoutSec}
          onSeedChange={setSeed}
          onRun={handleRun}
          onStop={handleStop}
        />
        <main className="run-workspace">
          <header className="run-page-header">
            <div>
              <h1>Run</h1>
              <p>{subtitle}{runGroup ? ` · ${runGroup.status}` : ''}</p>
            </div>
            <div className="run-header-actions">
              <button type="button" disabled={selectedTargets.length < 2}>Promote winner</button>
              <button type="button" disabled>Save as Profile</button>
              <button type="button" disabled={!runGroup}>Export</button>
            </div>
          </header>
          <SharedPromptStrip prompt={extractPrompt(selectedTemplate)} />
          {selectedTargets.length === 0 ? (
            <RunUnifiedEmpty />
          ) : selectedTargets.length === 1 ? (
            <SingleResponseDetail
              target={selectedTargets[0]}
              option={optionMap.get(targetKey(selectedTargets[0]))}
              item={findItemForTarget(runGroup, selectedTargets[0])}
            />
          ) : (
            <>
              <div className="run-compare-grid" style={{ gridTemplateColumns: `repeat(${selectedTargets.length}, minmax(220px, 1fr))` }}>
                {selectedTargets.map((target, index) => (
                  <CompareColumn
                    key={targetKey(target)}
                    target={target}
                    option={optionMap.get(targetKey(target))}
                    item={findItemForTarget(runGroup, target)}
                    index={index}
                  />
                ))}
              </div>
              <CompareSummary group={runGroup} />
            </>
          )}
        </main>
      </div>
    </section>
  );
}
