import { TestTemplateVersionRecord } from '../services/test-templates-api';

interface TestTemplateVersionsProps {
  versions: TestTemplateVersionRecord[];
  selectedId?: string | null;
  onSelect: (version: TestTemplateVersionRecord) => void;
}

export function TestTemplateVersions({ versions, selectedId, onSelect }: TestTemplateVersionsProps) {
  if (!versions.length) {
    return <p className="muted">No versions yet.</p>;
  }

  return (
    <ul className="list">
      {versions.map((version) => (
        <li
          key={version.id}
          className={`list-item ${selectedId === version.id ? 'selected' : ''}`}
        >
          <div>
            <strong>v{version.version_number}</strong>
            <div className="muted">{new Date(version.created_at).toLocaleString()}</div>
          </div>
          <div className="actions">
            <button type="button" onClick={() => onSelect(version)}>
              View
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
