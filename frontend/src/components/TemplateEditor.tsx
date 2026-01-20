import { useEffect, useState } from 'react';

import { TemplateInput, TemplateRecord, TemplateType } from '../services/templates-api.js';

interface TemplateEditorProps {
  template: TemplateRecord | null;
  onSave: (input: TemplateInput, isUpdate: boolean) => Promise<void>;
  error?: string | null;
  busy?: boolean;
}

const DEFAULT_JSON = `{
  "id": "template-id",
  "version": "1.0.0",
  "name": "Template name",
  "description": "Describe the test",
  "protocols": ["openai_chat_completions"],
  "request": {
    "method": "POST",
    "path": "/v1/chat/completions",
    "body_template": {
      "model": "gpt-4o-mini",
      "messages": [{ "role": "user", "content": "ping" }]
    }
  },
  "assertions": [],
  "metrics": {}
}`;

const DEFAULT_PYTHON_TEMPLATE = `{
  "kind": "python_test",
  "schema_version": "v1",
  "id": "template-id",
  "name": "Python Template",
  "version": "1.0.0",
  "lifecycle": { "status": "active" },
  "python": {
    "module": "tests.python.sample_test",
    "entrypoint": "entrypoint",
    "requirements": { "pip": [] }
  },
  "contracts": { "requires": [], "provides": [] },
  "defaults": { "timeout_ms": 60000, "retries": { "max": 0, "backoff_ms": 0 } },
  "outputs": {
    "result_schema": "scenario_result.v1",
    "normalised_response": "response_normalisation.v1"
  }
}`;

export function TemplateEditor({ template, onSave, error, busy }: TemplateEditorProps) {
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<TemplateType>('json');
  const [version, setVersion] = useState('1.0.0');
  const [content, setContent] = useState('');

  useEffect(() => {
    if (template) {
      setId(template.id);
      setName(template.name);
      setType(template.type);
      setVersion(template.version);
      setContent(template.content);
      return;
    }
    setId('');
    setName('');
    setType('json');
    setVersion('1.0.0');
    setContent(DEFAULT_JSON);
  }, [template]);

  const isUpdate = Boolean(template);

  useEffect(() => {
    if (!isUpdate) {
      setContent(type === 'python' ? DEFAULT_PYTHON_TEMPLATE : DEFAULT_JSON);
    }
  }, [isUpdate, type]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSave(
      {
        id,
        name,
        type,
        content,
        version
      },
      isUpdate
    );
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <h2>{isUpdate ? 'Edit template' : 'Create template'}</h2>
      {error ? <div className="error">{error}</div> : null}
      <label>
        Template ID
        <input
          value={id}
          onChange={(event) => setId(event.target.value)}
          disabled={isUpdate || busy}
          placeholder="openai-compliance"
          required
        />
      </label>
      <label>
        Name
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={busy}
          placeholder="OpenAI compliance"
          required
        />
      </label>
      <label>
        Type
        <select
          value={type}
          onChange={(event) => setType(event.target.value as TemplateType)}
          disabled={busy || isUpdate}
        >
          <option value="json">JSON</option>
          <option value="python">Python</option>
        </select>
      </label>
      <label>
        Version
        <input
          value={version}
          onChange={(event) => setVersion(event.target.value)}
          disabled={busy}
          placeholder="1.0.0"
          required
        />
      </label>
      <label>
        Content
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={16}
          disabled={busy}
          placeholder={type === 'json' ? DEFAULT_JSON : DEFAULT_PYTHON_TEMPLATE}
        />
      </label>
      <button type="submit" disabled={busy}>
        {busy ? 'Saving…' : 'Save'}
      </button>
    </form>
  );
}
