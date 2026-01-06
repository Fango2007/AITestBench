import { useState } from 'react';

import { apiPost } from '../services/api';

export function RunSingle() {
  const [targetId, setTargetId] = useState('');
  const [testId, setTestId] = useState('');
  const [profileId, setProfileId] = useState('');
  const [profileVersion, setProfileVersion] = useState('');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  async function handleRun() {
    const run = await apiPost('/runs', {
      target_id: targetId,
      test_id: testId,
      profile_id: profileId || undefined,
      profile_version: profileVersion || undefined
    });
    setResult(run as Record<string, unknown>);
  }

  return (
    <section className="page">
      <h1>Run Single Test</h1>
      <label>
        Target ID
        <input value={targetId} onChange={(event) => setTargetId(event.target.value)} />
      </label>
      <label>
        Test ID
        <input value={testId} onChange={(event) => setTestId(event.target.value)} />
      </label>
      <label>
        Profile ID
        <input value={profileId} onChange={(event) => setProfileId(event.target.value)} />
      </label>
      <label>
        Profile Version
        <input value={profileVersion} onChange={(event) => setProfileVersion(event.target.value)} />
      </label>
      <button type="button" onClick={handleRun}>Run</button>
      {result && <pre>{JSON.stringify(result, null, 2)}</pre>}
    </section>
  );
}
