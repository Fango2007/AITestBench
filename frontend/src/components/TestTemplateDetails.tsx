import { TestTemplateDetail, TestTemplateVersionRecord } from '../services/test-templates-api';
import { TestTemplateVersions } from './TestTemplateVersions';

interface TestTemplateDetailsProps {
  template: TestTemplateDetail | null;
  selectedVersion: TestTemplateVersionRecord | null;
  onSelectVersion: (version: TestTemplateVersionRecord) => void;
}

export function TestTemplateDetails({ template, selectedVersion, onSelectVersion }: TestTemplateDetailsProps) {
  if (!template) {
    return (
      <div className="card">
        <h2>Template details</h2>
        <p className="muted">Select a template to view versions.</p>
      </div>
    );
  }

  const displayVersion = selectedVersion ?? template.versions[0] ?? null;

  return (
    <div className="card">
      <h2>Template details</h2>
      <div className="detail-row">
        <span>Name</span>
        <strong>{template.name}</strong>
      </div>
      <div className="detail-row">
        <span>Format</span>
        <strong>{template.format.toUpperCase()}</strong>
      </div>
      <div className="detail-row">
        <span>Status</span>
        <strong>{template.status}</strong>
      </div>
      <div className="divider" />
      <h3>Version history</h3>
      <TestTemplateVersions
        versions={template.versions}
        selectedId={displayVersion?.id ?? null}
        onSelect={onSelectVersion}
      />
      {displayVersion ? (
        <>
          <div className="divider" />
          <h3>Version content</h3>
          <p className="muted">v{displayVersion.version_number}</p>
          <pre>{displayVersion.content}</pre>
        </>
      ) : null}
    </div>
  );
}
