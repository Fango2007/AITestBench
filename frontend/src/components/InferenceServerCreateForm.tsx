import { useState } from 'react';

import { ApiSchemaFamily, AuthType, InferenceServerInput } from '../services/inference-servers-api.js';

interface InferenceServerCreateFormProps {
  onCreate: (input: InferenceServerInput) => Promise<void>;
  disabled?: boolean;
}

export function InferenceServerCreateForm({ onCreate, disabled }: InferenceServerCreateFormProps) {
  const [displayName, setDisplayName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [schemaFamilies, setSchemaFamilies] = useState<ApiSchemaFamily[]>(['openai-compatible']);
  const [authType, setAuthType] = useState<AuthType>('none');
  const [authTokenEnv, setAuthTokenEnv] = useState('');
  const [authHeaderName, setAuthHeaderName] = useState('Authorization');
  const [submitting, setSubmitting] = useState(false);
  const schemaFamilyOptions: Array<{ value: ApiSchemaFamily; label: string }> = [
    { value: 'openai-compatible', label: 'OpenAI-compatible' },
    { value: 'ollama', label: 'Ollama' },
    { value: 'custom', label: 'Custom' }
  ];

  function toggleSchemaFamily(value: ApiSchemaFamily) {
    setSchemaFamilies((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!displayName || !baseUrl || schemaFamilies.length === 0) {
      return;
    }
    setSubmitting(true);
    try {
      await onCreate({
        inference_server: {
          display_name: displayName,
          active: true,
          archived: false
        },
        endpoints: {
          base_url: baseUrl
        },
        runtime: {
          api: {
            schema_family: schemaFamilies,
            api_version: null
          }
        },
        auth: {
          type: authType,
          header_name: authHeaderName || 'Authorization',
          token_env: authTokenEnv || null
        }
      });
      setDisplayName('');
      setBaseUrl('');
      setAuthTokenEnv('');
      setSchemaFamilies(['openai-compatible']);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <h2>Create inference server</h2>
      <label>
        Display name
        <input
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          disabled={disabled}
        />
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
      <div>
        <p className="muted">Schema families</p>
        {schemaFamilyOptions.map((option) => (
          <label key={option.value} className="checkbox-row">
            <input
              type="checkbox"
              checked={schemaFamilies.includes(option.value)}
              onChange={() => toggleSchemaFamily(option.value)}
              disabled={disabled}
            />
            {option.label}
          </label>
        ))}
      </div>
      <label>
        Auth type
        <select
          value={authType}
          onChange={(event) => setAuthType(event.target.value as AuthType)}
          disabled={disabled}
        >
          <option value="none">None</option>
          <option value="bearer">Bearer</option>
          <option value="basic">Basic</option>
          <option value="oauth">OAuth</option>
          <option value="custom">Custom</option>
        </select>
      </label>
      <label>
        Auth header name
        <input
          value={authHeaderName}
          onChange={(event) => setAuthHeaderName(event.target.value)}
          disabled={disabled}
        />
      </label>
      <label>
        Auth token env var
        <input
          value={authTokenEnv}
          onChange={(event) => setAuthTokenEnv(event.target.value)}
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
