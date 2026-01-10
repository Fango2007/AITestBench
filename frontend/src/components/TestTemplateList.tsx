import { TestTemplateRecord } from '../services/test-templates-api';

interface TestTemplateListProps {
  templates: TestTemplateRecord[];
  title: string;
  selectedId?: string | null;
  onInspect?: (template: TestTemplateRecord) => void;
}

export function TestTemplateList({ templates, title, selectedId, onInspect }: TestTemplateListProps) {
  if (!templates.length) {
    return (
      <div className="card">
        <h2>{title}</h2>
        <p className="muted">No templates found.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>{title}</h2>
      <ul className="list">
        {templates.map((template) => (
          <li
            key={template.id}
            className={`list-item ${selectedId === template.id ? 'selected' : ''}`}
          >
            <div>
              <strong>{template.name}</strong>
              <div className="muted">
                {template.format.toUpperCase()} • v{template.current_version_number}
              </div>
            </div>
            {onInspect ? (
              <div className="actions">
                <button type="button" onClick={() => onInspect(template)}>
                  View
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
