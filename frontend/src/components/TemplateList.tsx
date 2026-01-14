import { TemplateRecord } from '../services/templates-api.js';

interface TemplateListProps {
  templates: TemplateRecord[];
  selectedId?: string | null;
  onSelect: (template: TemplateRecord) => void;
  onDelete: (template: TemplateRecord) => void;
}

export function TemplateList({ templates, selectedId, onSelect, onDelete }: TemplateListProps) {
  if (!templates.length) {
    return (
      <div className="card">
        <h2>Templates</h2>
        <p className="muted">No templates yet. Create your first one to get started.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>Templates</h2>
      <ul className="list">
        {templates.map((template) => (
          <li
            key={template.id}
            className={`list-item ${selectedId === template.id ? 'selected' : ''}`}
          >
            <div>
              <strong>{template.name}</strong>
              <div className="muted">{template.id}</div>
              <div className="meta">
                Type: {template.type} • Version: {template.version}
              </div>
            </div>
            <div className="actions">
              <button type="button" onClick={() => onSelect(template)}>
                Edit
              </button>
              <button type="button" onClick={() => onDelete(template)}>
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
