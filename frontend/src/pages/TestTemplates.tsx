import { useEffect, useState } from 'react';

import { TestTemplateCreateForm } from '../components/TestTemplateCreateForm';
import { TestTemplateDetails } from '../components/TestTemplateDetails';
import { TestTemplateEditForm } from '../components/TestTemplateEditForm';
import { TestTemplateErrors } from '../components/TestTemplateErrors';
import { TestTemplateList } from '../components/TestTemplateList';
import {
  TestTemplateCreateInput,
  TestTemplateDetail,
  TestTemplateRecord,
  TestTemplateUpdateInput,
  createTestTemplate,
  getTestTemplateDetail,
  listTestTemplates,
  updateTestTemplate
} from '../services/test-templates-api';

export function TestTemplates() {
  const [templates, setTemplates] = useState<TestTemplateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TestTemplateDetail | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);

  async function refreshTemplates() {
    setLoading(true);
    setError(null);
    try {
      const data = await listTestTemplates('all');
      setTemplates(data);
      if (selectedId) {
        await loadDetail(selectedId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load templates');
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(templateId: string) {
    setDetailLoading(true);
    try {
      const data = await getTestTemplateDetail(templateId);
      setDetail(data);
      setSelectedVersionId(data.current_version_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load template details');
      setDetail(null);
      setSelectedVersionId(null);
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    refreshTemplates();
  }, []);

  async function handleCreate(input: TestTemplateCreateInput) {
    setError(null);
    try {
      const created = await createTestTemplate(input);
      setSelectedId(created.id);
      await loadDetail(created.id);
      await refreshTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create template');
    }
  }

  async function handleSelect(template: TestTemplateRecord) {
    setSelectedId(template.id);
    await loadDetail(template.id);
  }

  async function handleUpdate(input: TestTemplateUpdateInput) {
    if (!detail) {
      return;
    }
    setError(null);
    try {
      await updateTestTemplate(detail.id, input);
      await loadDetail(detail.id);
      await refreshTemplates();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update template');
    }
  }

  const activeTemplates = templates.filter((template) => template.status === 'active');
  const archivedTemplates = templates.filter((template) => template.status === 'archived');
  const selectedVersion =
    detail?.versions.find((version) => version.id === selectedVersionId)
    ?? detail?.versions[0]
    ?? null;

  return (
    <section className="page">
      <div className="page-header">
        <h2>Test Templates</h2>
        <p className="muted">Manage reusable JSON and Python templates.</p>
      </div>
      <TestTemplateErrors message={error} />
      {loading ? <p className="muted">Loading templates...</p> : null}
      <div className="targets-grid">
        <div className="targets-column">
          <TestTemplateCreateForm onCreate={handleCreate} disabled={loading} />
          {detail ? (
            <TestTemplateEditForm
              template={detail}
              currentContent={selectedVersion?.content ?? ''}
              onSave={handleUpdate}
              disabled={detailLoading}
            />
          ) : null}
          <TestTemplateDetails
            template={detail}
            selectedVersion={selectedVersion}
            onSelectVersion={(version) => setSelectedVersionId(version.id)}
          />
        </div>
        <div className="targets-column">
          <TestTemplateList
            title="Active templates"
            templates={activeTemplates}
            selectedId={selectedId}
            onInspect={handleSelect}
          />
          <TestTemplateList
            title="Archived templates"
            templates={archivedTemplates}
            selectedId={selectedId}
            onInspect={handleSelect}
          />
        </div>
      </div>
    </section>
  );
}
