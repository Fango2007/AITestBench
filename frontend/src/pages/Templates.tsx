import { useCallback, useEffect, useMemo, useState } from 'react';

import { TemplateEditor } from '../components/TemplateEditor.js';
import { TemplateList } from '../components/TemplateList.js';
import {
  TemplateInput,
  TemplateRecord,
  createTemplate,
  deleteTemplate,
  listTemplates,
  updateTemplate
} from '../services/templates-api.js';

export function Templates() {
  const [templates, setTemplates] = useState<TemplateRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedId) ?? null,
    [templates, selectedId]
  );

  const loadTemplates = useCallback(async () => {
    const data = await listTemplates();
    setTemplates(data);
  }, []);

  useEffect(() => {
    loadTemplates().catch(() => setTemplates([]));
  }, [loadTemplates]);

  async function handleSave(input: TemplateInput, isUpdate: boolean) {
    setError(null);
    setBusy(true);
    try {
      if (isUpdate) {
        await updateTemplate(input.id, {
          name: input.name,
          type: input.type,
          content: input.content,
          version: input.version
        });
      } else {
        await createTemplate(input);
      }
      await loadTemplates();
      setSelectedId(input.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save template');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(template: TemplateRecord) {
    const confirmed = window.confirm(`Delete template "${template.name}"?`);
    if (!confirmed) {
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await deleteTemplate(template.id);
      await loadTemplates();
      if (selectedId === template.id) {
        setSelectedId(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete template');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="page templates-page">
      <div className="page-header">
        <h2>Templates</h2>
        <p className="muted">Manage JSON and Python templates for the test library.</p>
      </div>
      <div className="actions" style={{ marginBottom: 16 }}>
        <button type="button" onClick={() => setSelectedId(null)} disabled={busy}>
          New template
        </button>
        <button type="button" onClick={() => loadTemplates()} disabled={busy}>
          Refresh
        </button>
      </div>
      <div className="templates-grid">
        <TemplateList
          templates={templates}
          selectedId={selectedId}
          onSelect={(template) => setSelectedId(template.id)}
          onDelete={handleDelete}
        />
        <TemplateEditor template={selectedTemplate} onSave={handleSave} error={error} busy={busy} />
      </div>
    </section>
  );
}
