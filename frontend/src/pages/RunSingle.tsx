import { useCallback, useEffect, useMemo, useState } from 'react';

import { apiGet, apiPost } from '../services/api.js';
import { RunTargetSelect } from '../components/RunTargetSelect.js';
import { TargetErrors } from '../components/TargetErrors.js';
import { ActiveTestRecord, deleteActiveTest, instantiateActiveTests, listActiveTests } from '../services/active-tests-api.js';
import { TemplateRecord, listTemplates } from '../services/templates-api.js';
import { TargetRecord } from '../services/targets-api.js';

const TEMPLATE_PLACEHOLDERS = new Set([
  'STREAM',
  'TEMPERATURE',
  'MAX_COMPLETION_TOKEN',
  'TOP_P',
  'TOP_K'
]);

type ParamFlags = {
  stream: boolean;
  temperature: boolean;
  topP: boolean;
  topK: boolean;
  maxCompletionTokens: boolean;
};

function defaultParamFlags(): ParamFlags {
  return { stream: false, temperature: false, topP: false, topK: false, maxCompletionTokens: false };
}

function inspectTemplateParams(template: TemplateRecord | undefined): ParamFlags {
  if (!template || template.type !== 'json') {
    return defaultParamFlags();
  }
  try {
    const parsed = JSON.parse(template.content) as Record<string, unknown>;
    const request = (parsed.request as Record<string, unknown>) ?? {};
    const body = (request.body_template as Record<string, unknown>) ?? {};
    const flags = defaultParamFlags();
    if (TEMPLATE_PLACEHOLDERS.has(String(body.stream))) {
      flags.stream = true;
    }
    if (TEMPLATE_PLACEHOLDERS.has(String(body.temperature))) {
      flags.temperature = true;
    }
    if (TEMPLATE_PLACEHOLDERS.has(String(body.top_p))) {
      flags.topP = true;
    }
    if (TEMPLATE_PLACEHOLDERS.has(String(body.top_k))) {
      flags.topK = true;
    }
    if (
      TEMPLATE_PLACEHOLDERS.has(String(body.max_completion_tokens))
    ) {
      flags.maxCompletionTokens = true;
    }
    return flags;
  } catch {
    return defaultParamFlags();
  }
}

export function RunSingle() {
  const [targetId, setTargetId] = useState('');
  const [targets, setTargets] = useState<TargetRecord[]>([]);
  const [model, setModel] = useState('');
  const [templates, setTemplates] = useState<TemplateRecord[]>([]);
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [activeTests, setActiveTests] = useState<ActiveTestRecord[]>([]);
  const [profileId, setProfileId] = useState('');
  const [profileVersion, setProfileVersion] = useState('');
  const [requestTimeoutSec, setRequestTimeoutSec] = useState('30');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [runResults, setRunResults] = useState<Record<string, unknown>[] | null>(null);
  const [lastRunId, setLastRunId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [runInProgress, setRunInProgress] = useState(false);
  const [streamOverride, setStreamOverride] = useState<'unset' | 'true' | 'false'>('unset');
  const [temperatureOverride, setTemperatureOverride] = useState('');
  const [topPOverride, setTopPOverride] = useState('');
  const [topKOverride, setTopKOverride] = useState('');
  const [maxCompletionOverride, setMaxCompletionOverride] = useState('');
  const handleTargetsLoaded = useCallback((data: TargetRecord[]) => {
    setTargets(data);
  }, []);
  const formatPercent = (value: unknown) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return `${(value * 100).toFixed(1)}%`;
    }
    return 'N/A';
  };
  const formatMetric = (value: unknown) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return `${value.toFixed(2)} ms`;
    }
    return 'N/A';
  };

  const selectedTarget = useMemo(
    () => targets.find((target) => target.id === targetId) ?? null,
    [targets, targetId]
  );
  const modelOptions = selectedTarget?.models ?? [];
  const resolvedModel = model || selectedTarget?.default_model || '';
  const activeTestsForSelection = useMemo(
    () =>
      activeTests.filter(
        (activeTest) =>
          activeTest.target_id === targetId && activeTest.model_name === resolvedModel
      ),
    [activeTests, resolvedModel, targetId]
  );
  const paramFlags = useMemo(() => {
    return selectedTemplates.reduce<ParamFlags>((acc, templateId) => {
      const template = templates.find((entry) => entry.id === templateId);
      const flags = inspectTemplateParams(template);
      return {
        stream: acc.stream || flags.stream,
        temperature: acc.temperature || flags.temperature,
        topP: acc.topP || flags.topP,
        topK: acc.topK || flags.topK,
        maxCompletionTokens: acc.maxCompletionTokens || flags.maxCompletionTokens
      };
    }, defaultParamFlags());
  }, [selectedTemplates, templates]);
  const showParamOverrides =
    paramFlags.stream ||
    paramFlags.temperature ||
    paramFlags.topP ||
    paramFlags.topK ||
    paramFlags.maxCompletionTokens;
  const missingOverrides = useMemo(() => {
    if (!showParamOverrides) {
      return false;
    }
    const missingStream = paramFlags.stream && streamOverride === 'unset';
    const missingTemp = paramFlags.temperature && temperatureOverride.trim() === '';
    const missingTopP = paramFlags.topP && topPOverride.trim() === '';
    const missingTopK = paramFlags.topK && topKOverride.trim() === '';
    const missingMax = paramFlags.maxCompletionTokens && maxCompletionOverride.trim() === '';
    return missingStream || missingTemp || missingTopP || missingTopK || missingMax;
  }, [
    maxCompletionOverride,
    paramFlags,
    showParamOverrides,
    streamOverride,
    temperatureOverride,
    topPOverride,
    topKOverride
  ]);

  const canGenerate = Boolean(targetId && resolvedModel && selectedTemplates.length > 0 && !busy);
  const canRun = Boolean(
    activeTestsForSelection.length > 0 &&
      targetId &&
      resolvedModel &&
      !busy &&
      !missingOverrides
  );
  const runCompleted = Boolean(result && typeof result.status === 'string' && result.status !== 'running');
  const canViewResults = Boolean(lastRunId && runCompleted && !busy);
  const paramOverrides = useMemo(() => {
    const overrides: Record<string, unknown> = {};
    if (paramFlags.stream && streamOverride !== 'unset') {
      overrides.stream = streamOverride === 'true';
    }
    if (paramFlags.temperature && temperatureOverride.trim() !== '') {
      const value = Number(temperatureOverride);
      if (!Number.isNaN(value)) {
        overrides.temperature = value;
      }
    }
    if (paramFlags.topP && topPOverride.trim() !== '') {
      const value = Number(topPOverride);
      if (!Number.isNaN(value)) {
        overrides.top_p = value;
      }
    }
    if (paramFlags.topK && topKOverride.trim() !== '') {
      const value = Number(topKOverride);
      if (!Number.isNaN(value)) {
        overrides.top_k = value;
      }
    }
    if (paramFlags.maxCompletionTokens && maxCompletionOverride.trim() !== '') {
      const value = Number(maxCompletionOverride);
      if (!Number.isNaN(value)) {
        overrides.max_completion_tokens = value;
      }
    }
    return overrides;
  }, [
    maxCompletionOverride,
    paramFlags,
    streamOverride,
    temperatureOverride,
    topPOverride,
    topKOverride
  ]);

  useEffect(() => {
    const payload = Object.keys(paramOverrides).length ? paramOverrides : null;
    if (payload) {
      localStorage.setItem('aitestbench:param-overrides', JSON.stringify(payload));
    } else {
      localStorage.removeItem('aitestbench:param-overrides');
    }
    window.dispatchEvent(new Event('param-overrides:updated'));
  }, [paramOverrides]);

  useEffect(() => {
    listTemplates()
      .then((data) => setTemplates(data))
      .catch(() => setTemplates([]));
    listActiveTests()
      .then((data) => setActiveTests(data))
      .catch(() => setActiveTests([]));
  }, []);

  useEffect(() => {
    setResult(null);
    setRunResults(null);
    setLastRunId(null);
    setRunInProgress(false);
  }, [targetId, resolvedModel]);

  useEffect(() => {
    setStreamOverride('unset');
    setTemperatureOverride('');
    setTopPOverride('');
    setTopKOverride('');
    setMaxCompletionOverride('');
  }, [selectedTemplates]);

  async function refreshActiveTests() {
    const data = await listActiveTests();
    setActiveTests(data);
  }

  async function handleInstantiate() {
    setError(null);
    if (!targetId || !resolvedModel) {
      setError('Select a target and model before generating tests.');
      return;
    }
    if (selectedTemplates.length === 0) {
      setError('Select at least one template to generate tests.');
      return;
    }
    setBusy(true);
    try {
      await instantiateActiveTests({
        target_id: targetId,
        model_name: resolvedModel,
        template_ids: selectedTemplates,
        param_overrides: Object.keys(paramOverrides).length ? paramOverrides : undefined
      });
      await refreshActiveTests();
      setResult(null);
      setRunResults(null);
      setLastRunId(null);
      setRunInProgress(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate active tests.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteActiveTest(activeTestId: string) {
    setError(null);
    setBusy(true);
    try {
      await deleteActiveTest(activeTestId);
      await refreshActiveTests();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete active test.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRun() {
    setError(null);
    if (!targetId) {
      setError('Select a target before running.');
      return;
    }
    if (!resolvedModel) {
      setError('Select a model before running.');
      return;
    }
    if (activeTestsForSelection.length === 0) {
      setError('Generate at least one active test before running.');
      return;
    }

    const timeoutValue = Number(requestTimeoutSec);
    const timeoutOverride =
      Number.isFinite(timeoutValue) && timeoutValue > 0 ? { request_timeout_sec: timeoutValue } : {};
    const basePayload = {
      target_id: targetId,
      model: resolvedModel || undefined,
      profile_id: profileId || undefined,
      profile_version: profileVersion || undefined,
      test_overrides: Object.keys({ ...paramOverrides, ...timeoutOverride }).length
        ? { ...paramOverrides, ...timeoutOverride }
        : undefined
    };

    try {
      setBusy(true);
      setRunResults(null);
      setRunInProgress(true);
      if (activeTestsForSelection.length === 1) {
        const run = await apiPost('/runs', {
          ...basePayload,
          test_id: activeTestsForSelection[0].id
        });
        setResult(run as Record<string, unknown>);
        setLastRunId((run as { id?: string }).id ?? null);
        setRunInProgress(false);
        return;
      }

      const suiteId = `adhoc-${Date.now()}`;
      await apiPost('/suites', {
        id: suiteId,
        name: `Ad-hoc suite ${new Date().toISOString()}`,
        ordered_test_ids: activeTestsForSelection.map((test) => test.id),
        stop_on_fail: false
      });
      const run = await apiPost('/runs', {
        ...basePayload,
        suite_id: suiteId
      });
      setResult(run as Record<string, unknown>);
      setLastRunId((run as { id?: string }).id ?? null);
      setRunInProgress(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start run');
      setRunInProgress(false);
    } finally {
      setBusy(false);
    }
  }

  async function handleResults() {
    setError(null);
    if (!lastRunId) {
      setError('Run a test before viewing results.');
      return;
    }
    setBusy(true);
    try {
      const data = await apiGet<Record<string, unknown>[]>(`/runs/${lastRunId}/results`);
      setRunResults(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load results.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page">
      <div className="page-header">
        <h2>Run Single Test</h2>
        <p className="muted">Launch a one-off run against a selected target.</p>
      </div>
      <TargetErrors message={error} />
      <div className="card">
        <RunTargetSelect
          value={targetId}
          onChange={setTargetId}
          onTargetsLoaded={handleTargetsLoaded}
        />
        {modelOptions.length > 0 ? (
          <label>
            Model
            <select value={model} onChange={(event) => setModel(event.target.value)}>
              <option value="">Use target default</option>
              {modelOptions.map((entry) => (
                <option
                  key={`${entry.source ?? 'unknown'}-${entry.model_id ?? entry.api_model_name}`}
                  value={entry.api_model_name ?? entry.model_id}
                >
                  {entry.model_id ?? entry.api_model_name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label>
            Model
            <input
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder="mistral:latest"
            />
          </label>
        )}
        <label>
          Templates
          <select
            multiple
            value={selectedTemplates}
            onChange={(event) => {
              const values = Array.from(event.target.selectedOptions).map((option) => option.value);
              setSelectedTemplates(values);
            }}
          >
            {templates.map((template) => (
              <option key={`${template.id}:${template.version}`} value={template.id}>
                {template.name} ({template.type})
              </option>
            ))}
          </select>
        </label>
        {showParamOverrides ? (
          <div className="param-section">
            <p className="metrics-title">Template Parameters</p>
            <div className="param-grid">
              {paramFlags.stream ? (
                <label>
                  Stream
                  <select
                    value={streamOverride}
                    onChange={(event) =>
                      setStreamOverride(event.target.value as 'unset' | 'true' | 'false')
                    }
                  >
                    <option value="unset">Use template value</option>
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                </label>
              ) : null}
              {paramFlags.temperature ? (
                <label>
                  Temperature
                  <input
                    type="number"
                    step="0.1"
                    value={temperatureOverride}
                    onChange={(event) => setTemperatureOverride(event.target.value)}
                    placeholder="0.7"
                  />
                </label>
              ) : null}
              {paramFlags.topP ? (
                <label>
                  Top P
                  <input
                    type="number"
                    step="0.05"
                    value={topPOverride}
                    onChange={(event) => setTopPOverride(event.target.value)}
                    placeholder="0.9"
                  />
                </label>
              ) : null}
              {paramFlags.topK ? (
                <label>
                  Top K
                  <input
                    type="number"
                    step="1"
                    value={topKOverride}
                    onChange={(event) => setTopKOverride(event.target.value)}
                    placeholder="40"
                  />
                </label>
              ) : null}
              {paramFlags.maxCompletionTokens ? (
                <label>
                  Max completion tokens
                  <input
                    type="number"
                    step="1"
                    value={maxCompletionOverride}
                    onChange={(event) => setMaxCompletionOverride(event.target.value)}
                    placeholder="256"
                  />
                </label>
              ) : null}
            </div>
            {missingOverrides ? (
              <p className="muted">Fill all placeholders to enable Run.</p>
            ) : null}
          </div>
        ) : null}
        <div className="actions">
          <button type="button" onClick={handleInstantiate} disabled={!canGenerate}>
            Generate Active Tests
          </button>
          <button type="button" onClick={handleRun} disabled={!canRun}>
            Run
          </button>
          <button
            type="button"
            onClick={handleResults}
            disabled={!canViewResults}
            className={runInProgress && !runCompleted ? 'is-pending' : undefined}
          >
            {runInProgress && !runCompleted ? 'Running…' : 'Results'}
          </button>
        </div>
        <div className="divider" />
        <div className="field">
          <h3>Active Tests</h3>
          {activeTestsForSelection.length === 0 ? (
            <p className="muted">No active tests generated for this target and model yet.</p>
          ) : (
            <ul className="list">
              {activeTestsForSelection.map((activeTest) => {
                const template = templates.find((entry) => entry.id === activeTest.template_id);
                return (
                  <li key={activeTest.id} className="list-item">
                    <div>
                      <strong>{template?.name ?? activeTest.template_id}</strong>
                      <div className="meta">
                        Model: {activeTest.model_name} • Version: {activeTest.template_version}
                      </div>
                      {activeTest.python_ready ? (
                        <div className="meta">Sandbox ready</div>
                      ) : null}
                    </div>
                    <div className="actions">
                      <button
                        type="button"
                        onClick={() => handleDeleteActiveTest(activeTest.id)}
                        disabled={busy}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {activeTestsForSelection.some((test) => test.command_preview) ? (
            <div className="card">
              <h3>Runnable Command Preview</h3>
              {activeTestsForSelection.map((test) =>
                test.command_preview ? (
                  <pre key={test.id}>{test.command_preview}</pre>
                ) : null
              )}
            </div>
          ) : null}
        </div>
        <label>
          Profile ID
          <input value={profileId} onChange={(event) => setProfileId(event.target.value)} />
        </label>
        <label>
          Profile Version
          <input value={profileVersion} onChange={(event) => setProfileVersion(event.target.value)} />
        </label>
        <label>
          Request timeout (sec)
          <input
            type="number"
            min="1"
            step="1"
            value={requestTimeoutSec}
            onChange={(event) => setRequestTimeoutSec(event.target.value)}
            placeholder="30"
          />
        </label>
      </div>
      {result ? (
        <div className="card">
          <h3>Result</h3>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      ) : null}
      {runResults ? (
        <div className="card">
          <h3>HTTP Results</h3>
          {runResults[0]?.metrics ? (
            <p className="muted">
              TTFB: {formatMetric((runResults[0].metrics as Record<string, unknown>).ttfb_ms)} · Total:{' '}
              {formatMetric((runResults[0].metrics as Record<string, unknown>).total_ms)} · Prefill:{' '}
              {formatMetric((runResults[0].metrics as Record<string, unknown>).prefill_ms)} · Decode:{' '}
              {formatMetric((runResults[0].metrics as Record<string, unknown>).decode_ms)}
              {(runResults[0].metrics as Record<string, unknown>).proxy_accuracy != null ? (
                <>
                  {' '}
                  · Proxy accuracy:{' '}
                  {formatPercent((runResults[0].metrics as Record<string, unknown>).proxy_accuracy)} (
                  {(runResults[0].metrics as Record<string, unknown>).proxy_correct ?? 0}/
                  {(runResults[0].metrics as Record<string, unknown>).proxy_total ?? 0})
                </>
              ) : null}
            </p>
          ) : null}
          <pre>{JSON.stringify(runResults, null, 2)}</pre>
        </div>
      ) : null}
    </section>
  );
}
