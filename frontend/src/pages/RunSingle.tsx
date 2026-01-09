import { useEffect, useMemo, useState } from 'react';

import { apiGet, apiPost } from '../services/api';
import { RunTargetSelect } from '../components/RunTargetSelect';
import { TargetErrors } from '../components/TargetErrors';
import { TargetRecord } from '../services/targets-api';

interface TestDefinition {
  id: string;
  version: string;
  name: string;
  description: string | null;
}

export function RunSingle() {
  const [targetId, setTargetId] = useState('');
  const [targets, setTargets] = useState<TargetRecord[]>([]);
  const [model, setModel] = useState('');
  const [tests, setTests] = useState<TestDefinition[]>([]);
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [profileId, setProfileId] = useState('');
  const [profileVersion, setProfileVersion] = useState('');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedTarget = useMemo(
    () => targets.find((target) => target.id === targetId) ?? null,
    [targets, targetId]
  );
  const modelOptions = selectedTarget?.models ?? [];

  useEffect(() => {
    apiGet<TestDefinition[]>('/tests')
      .then((data) => setTests(data))
      .catch(() => setTests([]));
  }, []);

  async function handleRun() {
    setError(null);
    if (!targetId) {
      setError('Select a target before running.');
      return;
    }
    if (selectedTests.length === 0) {
      setError('Select at least one test.');
      return;
    }

    const basePayload = {
      target_id: targetId,
      model: model || undefined,
      profile_id: profileId || undefined,
      profile_version: profileVersion || undefined
    };

    try {
      if (selectedTests.length === 1) {
        const run = await apiPost('/runs', {
          ...basePayload,
          test_id: selectedTests[0]
        });
        setResult(run as Record<string, unknown>);
        return;
      }

      const suiteId = `adhoc-${Date.now()}`;
      await apiPost('/suites', {
        id: suiteId,
        name: `Ad-hoc suite ${new Date().toISOString()}`,
        ordered_test_ids: selectedTests,
        stop_on_fail: false
      });
      const run = await apiPost('/runs', {
        ...basePayload,
        suite_id: suiteId
      });
      setResult(run as Record<string, unknown>);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start run');
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
          onTargetsLoaded={(data) => setTargets(data)}
        />
        {modelOptions.length > 0 ? (
          <label>
            Model
            <select value={model} onChange={(event) => setModel(event.target.value)}>
              <option value="">Use target default</option>
              {modelOptions.map((entry) => (
                <option key={`${entry.provider ?? 'unknown'}-${entry.name}`} value={entry.name}>
                  {entry.name}
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
          Tests
          <select
            multiple
            value={selectedTests}
            onChange={(event) => {
              const values = Array.from(event.target.selectedOptions).map((option) => option.value);
              setSelectedTests(values);
            }}
          >
            {tests.map((test) => (
              <option key={`${test.id}:${test.version}`} value={test.id}>
                {test.name} ({test.id})
              </option>
            ))}
          </select>
        </label>
        <label>
          Profile ID
          <input value={profileId} onChange={(event) => setProfileId(event.target.value)} />
        </label>
        <label>
          Profile Version
          <input value={profileVersion} onChange={(event) => setProfileVersion(event.target.value)} />
        </label>
        <button type="button" onClick={handleRun}>
          Run
        </button>
      </div>
      {result ? (
        <div className="card">
          <h3>Result</h3>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      ) : null}
    </section>
  );
}
