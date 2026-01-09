import { useState } from 'react';

import { TargetInput, TargetRecord } from '../services/targets-api';

interface TargetEditFormProps {
  target: TargetRecord;
  onSave: (updates: Partial<TargetInput>) => Promise<void>;
  onCancel: () => void;
}

export function TargetEditForm({ target, onSave, onCancel }: TargetEditFormProps) {
  const [name, setName] = useState(target.name);
  const [baseUrl, setBaseUrl] = useState(target.base_url);
  const [provider, setProvider] = useState<'openai' | 'ollama' | 'auto'>(target.provider ?? 'openai');
  const [authTokenRef, setAuthTokenRef] = useState(target.auth_token_ref ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave({
        name,
        base_url: baseUrl,
        provider,
        auth_token_ref: authTokenRef || null
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <h3>Edit target</h3>
      <label>
        Name
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label>
        Base URL
        <input
          type="url"
          value={baseUrl}
          onChange={(event) => setBaseUrl(event.target.value)}
          required
        />
      </label>
      <label>
        Provider
        <select
          value={provider}
          onChange={(event) => setProvider(event.target.value as 'openai' | 'ollama' | 'auto')}
        >
          <option value="openai">OpenAI-compatible</option>
          <option value="ollama">Ollama</option>
          <option value="auto">Auto (try both)</option>
        </select>
      </label>
      <label>
        Auth token env var
        <input value={authTokenRef} onChange={(event) => setAuthTokenRef(event.target.value)} />
      </label>
      <div className="actions">
        <button type="submit" disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
