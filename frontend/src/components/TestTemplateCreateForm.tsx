import { useState } from 'react';

import { TestTemplateCreateInput } from '../services/test-templates-api';

interface TestTemplateCreateFormProps {
  onCreate: (input: TestTemplateCreateInput) => Promise<void>;
  disabled?: boolean;
}

export function TestTemplateCreateForm({ onCreate, disabled }: TestTemplateCreateFormProps) {
  const [name, setName] = useState('');
  const [format, setFormat] = useState<'json' | 'python'>('json');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name || !content) {
      return;
    }
    setSubmitting(true);
    try {
      await onCreate({ name, format, content });
      setName('');
      setContent('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <h2>Create template</h2>
      <label>
        Name
        <input value={name} onChange={(event) => setName(event.target.value)} required disabled={disabled} />
      </label>
      <label>
        Format
        <select
          value={format}
          onChange={(event) => setFormat(event.target.value as 'json' | 'python')}
          disabled={disabled}
        >
          <option value="json">JSON</option>
          <option value="python">Python</option>
        </select>
      </label>
      <label>
        Content
        <textarea
          rows={6}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder={format === 'json' ? '{"request": {}}' : 'def run_test():\n  pass'}
          required
          disabled={disabled}
        />
      </label>
      <button type="submit" disabled={disabled || submitting}>
        {submitting ? 'Creating...' : 'Create'}
      </button>
    </form>
  );
}
