import { useEffect, useState } from 'react';

import { TestTemplateDetail, TestTemplateUpdateInput } from '../services/test-templates-api';

interface TestTemplateEditFormProps {
  template: TestTemplateDetail;
  currentContent: string;
  onSave: (input: TestTemplateUpdateInput) => Promise<void>;
  disabled?: boolean;
}

export function TestTemplateEditForm({ template, currentContent, onSave, disabled }: TestTemplateEditFormProps) {
  const [name, setName] = useState(template.name);
  const [content, setContent] = useState(currentContent);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setName(template.name);
    setContent(currentContent);
  }, [template.id, template.name, currentContent]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!content) {
      return;
    }
    setSubmitting(true);
    try {
      const payload: TestTemplateUpdateInput = { content };
      if (name && name !== template.name) {
        payload.name = name;
      }
      await onSave(payload);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      <h2>Update template</h2>
      <label>
        Name
        <input value={name} onChange={(event) => setName(event.target.value)} disabled={disabled} />
      </label>
      <label>
        Content
        <textarea
          rows={8}
          value={content}
          onChange={(event) => setContent(event.target.value)}
          required
          disabled={disabled}
        />
      </label>
      <button type="submit" disabled={disabled || submitting}>
        {submitting ? 'Saving...' : 'Save new version'}
      </button>
    </form>
  );
}
