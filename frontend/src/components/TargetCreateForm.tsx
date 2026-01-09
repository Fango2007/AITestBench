import { useState } from 'react';

import { TargetInput } from '../services/targets-api';

interface TargetCreateFormProps {
  onCreate: (input: TargetInput) => Promise<void>;
  disabled?: boolean;
}

export function TargetCreateForm({ onCreate, disabled }: TargetCreateFormProps) {
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [provider, setProvider] = useState<'openai' | 'ollama' | 'auto'>('openai');
  const [authTokenRef, setAuthTokenRef] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name || !baseUrl) {
      return;
    }
    setSubmitting(true);
    try {
      await onCreate({
        name,
        base_url: baseUrl,
        provider,
        auth_token_ref: authTokenRef || null
      });
      setName('');
      setBaseUrl('');
      setAuthTokenRef('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <h2>Create target</h2>
      <label>
        Name
        <input value={name} onChange={(event) => setName(event.target.value)} disabled={disabled} />
      </label>
      <label>
        Base URL
        <input
          type="url"
          value={baseUrl}
          onChange={(event) => setBaseUrl(event.target.value)}
          placeholder="http://localhost:8080"
          required
          disabled={disabled}
        />
      </label>
      <label>
        Provider
        <select
          value={provider}
          onChange={(event) => setProvider(event.target.value as 'openai' | 'ollama' | 'auto')}
          disabled={disabled}
        >
          <option value="openai">OpenAI-compatible</option>
          <option value="ollama">Ollama</option>
          <option value="auto">Auto (try both)</option>
        </select>
      </label>
      <label>
        Auth token env var
        <input
          value={authTokenRef}
          onChange={(event) => setAuthTokenRef(event.target.value)}
          placeholder="AITESTBENCH_API_TOKEN"
          disabled={disabled}
        />
      </label>
      <button type="submit" disabled={disabled || submitting}>
        {submitting ? 'Creating…' : 'Create'}
      </button>
    </form>
  );
}
